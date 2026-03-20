import path from "node:path";
import semver from "semver";
import { PackageJson, packageJsonSchema } from "../schemas/index.js";
import { readJson, writeJson, appendToFile } from "../utils/index.js";
import { SemverBump } from "./commits.js";

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

export function formatCommitList(commits: CommitInfo[], baseUrl: string): { items: string[], references: string[] } {
  const parsedCommits = commits.map(c => {
    const shortHash = c.hash.substring(0, 7);
    
    // Use short hash without markdown link for GitHub autolinking
    const hashLink = baseUrl && c.hash !== "cascade" ? shortHash : `([${shortHash}](${c.hash}))`;
    
    let msg = c.message;
    // Keep #issue for autolinking
    msg = msg.replace(/#(\d+)/g, (match, issueNum) => {
      return baseUrl ? `#${issueNum}` : `([#${issueNum}](#${issueNum}))`;
    });

    let formattedMsg = msg;
    const colonIdx = formattedMsg.indexOf(':');
    if (colonIdx !== -1 && colonIdx < 30) {
      formattedMsg = `**${formattedMsg.substring(0, colonIdx + 1)}**${formattedMsg.substring(colonIdx + 1)}`;
    }

    // @username format works automatically in GitHub
    let authorLink = "";
    if (c.author_name && c.author_name !== "tagman") {
       authorLink = ` @${c.author_name}`;
    }

    return `* ${formattedMsg}${authorLink} ${hashLink}`;
  });

  return { items: parsedCommits, references: [] };
}

export async function appendToChangelog(
  pkgName: string, 
  pkgDir: string, 
  newVersion: string, 
  prevVersion: string, 
  commits: CommitInfo[]
): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const changelogPath = path.join(pkgDir, "CHANGELOG.md");
  
  const baseUrl = await getRepositoryBaseUrl();
  const { items, references } = formatCommitList(commits, baseUrl);
  
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
