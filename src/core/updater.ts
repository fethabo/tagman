import path from "node:path";
import semver from "semver";
import { Octokit } from "@octokit/rest";
import { PackageJson, packageJsonSchema } from "../schemas/index.js";
import { readJson, writeJson, appendToFile } from "../utils/index.js";
import { SemverBump } from "./commits.js";

/** Cache of (owner/repo#hash) → GitHub login to avoid redundant API calls. */
const githubLoginCache = new Map<string, string | null>();

export async function updatePackageVersion(pkgDir: string, newVersion: string): Promise<string> {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const pkg: PackageJson = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
  
  if (pkg.version !== newVersion) {
    pkg.version = newVersion;
    await writeJson(pkgJsonPath, pkg);
  }
  return newVersion;
}

export async function updateConsumerDependencies(
  consumerDir: string, 
  dependencyName: string, 
  newVersion: string
): Promise<void> {
  const pkgJsonPath = path.join(consumerDir, "package.json");
  const pkg: PackageJson = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
  
  const prefix = `^`; // simple default for now, can be improved.
  if (pkg.dependencies && pkg.dependencies[dependencyName]) {
    pkg.dependencies[dependencyName] = `${prefix}${newVersion}`;
  }
  if (pkg.devDependencies && pkg.devDependencies[dependencyName]) {
    pkg.devDependencies[dependencyName] = `${prefix}${newVersion}`;
  }
  if (pkg.peerDependencies && pkg.peerDependencies[dependencyName]) {
    pkg.peerDependencies[dependencyName] = `${prefix}${newVersion}`;
  }

  await writeJson(pkgJsonPath, pkg);
}

import { CommitInfo } from "../git/index.js";

export async function getRepositoryBaseUrl(): Promise<string> {
  try {
    const rootPkg = await readJson(path.join(process.cwd(), "package.json"), { parse: packageJsonSchema.parse });
    if (rootPkg.repository) {
      let url = typeof rootPkg.repository === 'string' ? rootPkg.repository : (rootPkg.repository as any).url;
      if (url) {
        return url.replace(/^git\+/, '').replace(/\.git$/, '');
      }
    }
  } catch (e) {}
  return "";
}

function extractGitHubUsername(email: string): string | null {
  const m = email.match(/^(?:\d+\+)?(.+)@users\.noreply\.github\.com$/);
  return m ? m[1] : null;
}

/**
 * Returns true when `name` is a syntactically valid GitHub username.
 * GitHub usernames may only contain alphanumeric characters and hyphens,
 * cannot start or end with a hyphen, and are at most 39 characters long.
 */
function isValidGitHubUsername(name: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(name);
}

/**
 * Resolves the real GitHub login for a commit via the GitHub Commits API.
 * Results are cached per (owner/repo + hash) to avoid redundant network calls.
 * Returns null when the token is unavailable, the commit is not linked to a
 * GitHub account, or any network/API error occurs.
 */
async function fetchGitHubLoginForCommit(
  hash: string,
  owner: string,
  repo: string,
  token: string,
): Promise<string | null> {
  const cacheKey = `${owner}/${repo}#${hash}`;
  if (githubLoginCache.has(cacheKey)) {
    return githubLoginCache.get(cacheKey) ?? null;
  }
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.repos.getCommit({ owner, repo, ref: hash });
    const login = data.author?.login ?? null;
    githubLoginCache.set(cacheKey, login);
    return login;
  } catch {
    githubLoginCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Parses "Co-authored-by: name <email>" lines from a commit body and returns
 * the GitHub username of the first human (non-bot) co-author found.
 */
function extractCoAuthorUsername(body: string): string | null {
  if (!body) return null;
  for (const line of body.split("\n")) {
    const m = line.match(/^Co-authored-by:\s*[^<]*<([^>]+)>/i);
    if (!m) continue;
    const email = m[1];
    // Skip bot emails (copilot, github-actions, etc.)
    if (/\[bot\]|copilot|github-actions/i.test(email)) continue;
    const username = extractGitHubUsername(email);
    if (username) return username;
  }
  return null;
}

export async function formatCommitList(
  commits: CommitInfo[],
  baseUrl: string,
  ghContext?: { owner: string; repo: string; token: string | null },
): Promise<{ items: string[], references: string[] }> {
  const parsedCommits = await Promise.all(commits.map(async c => {
    const shortHash = c.hash.substring(0, 7);
    
    // Use short hash without markdown link for GitHub autolinking
    const hashLink = baseUrl && c.hash !== "cascade" ? shortHash : `([${shortHash}](${c.hash}))`;
    
    // Bold the conventional-commit prefix before linkifying, so the colon
    // lookup never matches the ":" inside an inserted link URL.
    let formattedMsg = c.message;
    const colonIdx = formattedMsg.indexOf(':');
    if (colonIdx !== -1 && colonIdx < 30) {
      formattedMsg = `**${formattedMsg.substring(0, colonIdx + 1)}**${formattedMsg.substring(colonIdx + 1)}`;
    }

    // GitHub doesn't autolink #N inside tag annotations or markdown files,
    // so issue references become explicit markdown links (#57).
    if (baseUrl) {
      // Linkify cross-repo references first (owner/repo#N) to avoid double-processing
      formattedMsg = formattedMsg.replace(/([\w.-]+\/[\w.-]+)#(\d+)/g, (_match, repo, num) => {
        return `[${repo}#${num}](https://github.com/${repo}/issues/${num})`;
      });
      // Then linkify same-repo references (#N) not preceded by a slash or word char
      formattedMsg = formattedMsg.replace(/(^|[^/\w])#(\d+)/g, (_match, prefix, num) => {
        return `${prefix}[#${num}](${baseUrl}/issues/${num})`;
      });
    }

    // Resolution priority:
    // 1. GitHub noreply email extraction (fastest, no network).
    // 2. GitHub Commits API (real login, requires token and a real commit hash).
    // 3. author_name only when it matches the GitHub username format; otherwise
    //    use it as plain text to avoid accidentally @-mentioning an unrelated user.
    let authorLink = "";
    if (c.author_name !== "tagman") {
      const isBotAuthor = c.author_name.endsWith("[bot]");

      let username: string | null = null;
      if (isBotAuthor) {
        username = extractCoAuthorUsername(c.body ?? "");
      }
      if (!username) {
        username = extractGitHubUsername(c.author_email ?? "");
      }

      // When noreply extraction fails, try the GitHub API for the real login.
      if (!username && ghContext?.token && c.hash && c.hash !== "cascade") {
        username = await fetchGitHubLoginForCommit(
          c.hash, ghContext.owner, ghContext.repo, ghContext.token,
        );
      }

      if (username) {
        authorLink = ` @${username}`;
      } else if (isValidGitHubUsername(c.author_name)) {
        // The display name happens to be a valid GitHub username handle.
        authorLink = ` @${c.author_name}`;
      } else {
        // Display name contains spaces or invalid characters (e.g. "Agus muni").
        // Using @mention would link to the wrong user, so show it as plain text.
        authorLink = ` ${c.author_name}`;
      }
    }

    return `* ${formattedMsg}${authorLink} ${hashLink}`;
  }));

  return { items: parsedCommits, references: [] };
}

export async function appendToChangelog(
  pkgName: string, 
  pkgDir: string, 
  newVersion: string, 
  prevVersion: string, 
  commits: CommitInfo[],
  ghContext?: { owner: string; repo: string; token: string | null },
): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const changelogPath = path.join(pkgDir, "CHANGELOG.md");
  
  const baseUrl = await getRepositoryBaseUrl();
  const { items, references } = await formatCommitList(commits, baseUrl, ghContext);
  
  const compareLinkUrl = baseUrl 
    ? `${baseUrl}/compare/${pkgName}@${prevVersion}...${pkgName}@${newVersion}`
    : `${pkgName}@${prevVersion}...${pkgName}@${newVersion}`;

  const header = `## [${newVersion}](${compareLinkUrl}) (${date})`;

  const lines = [
    `\n${header}\n`,
    ...items
  ];
  
  await appendToFile(changelogPath, lines.join("\n") + "\n");
}

export async function logRelease(summary: Record<string, any>): Promise<void> {
  const logPath = path.join(process.cwd(), ".tagman-release.log");
  const date = new Date().toISOString();
  const entry = `\n--- Release ${date} ---\n${JSON.stringify(summary, null, 2)}\n`;
  await appendToFile(logPath, entry);
}

// Rollback functionalities
export async function rollbackPackageVersion(pkgDir: string, oldVersion: string): Promise<void> {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const pkg: PackageJson = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
  pkg.version = oldVersion;
  await writeJson(pkgJsonPath, pkg);
}

export async function rollbackConsumerDependencies(
  consumerDir: string, 
  dependencyName: string, 
  oldVersion: string
): Promise<void> {
  // To keep it simple, we restore using the standard caretaker prefix we use
  await updateConsumerDependencies(consumerDir, dependencyName, oldVersion);
}

import fs from "node:fs/promises";
export async function rollbackChangelog(pkgDir: string, versionToRemove: string): Promise<void> {
  const changelogPath = path.join(pkgDir, "CHANGELOG.md");
  try {
    const content = await fs.readFile(changelogPath, "utf-8");
    const searchString = `\n## [${versionToRemove}] - `;
    const index = content.lastIndexOf(searchString);
    
    if (index !== -1) {
       const restoredContent = content.substring(0, index);
       await fs.writeFile(changelogPath, restoredContent, "utf-8");
    }
  } catch (e) {
    // If changelog doesn't exist or can't be read, we don't have anything to rollback
  }
}
