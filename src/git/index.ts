import { simpleGit, SimpleGit } from "simple-git";
import semver from "semver";

/**
 * Milliseconds of silence (no stdout/stderr) after which simple-git forcibly
 * kills a git process. Turns an otherwise-eternal network hang (unreachable
 * remote, VPN, credential prompt) into a rejected promise we can catch.
 */
const NETWORK_TIMEOUT_MS = 15000;

export const git: SimpleGit = simpleGit({ timeout: { block: NETWORK_TIMEOUT_MS } });

/**
 * Builds an ephemeral simple-git instance for network operations (fetch/push).
 * - Applies the block timeout so the process can never hang forever.
 * - Sets GIT_TERMINAL_PROMPT=0 so a missing credential fails fast instead of
 *   blocking on an interactive Username/Password prompt with no stdin.
 * - Uses SSH BatchMode so an unknown host / passphrase prompt fails fast too.
 *
 * A fresh instance (not the shared `git`) is used because `.env()` REPLACES the
 * child's entire environment; mutating the shared instance would leak this env
 * into unrelated local operations (git.log, git.status, ...).
 */
function networkGit(extraEnv?: Record<string, string>): SimpleGit {
  return simpleGit({ timeout: { block: NETWORK_TIMEOUT_MS } }).env({
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new",
    ...extraEnv,
  });
}

/**
 * Builds the environment that injects a GitHub token as the HTTP Authorization
 * header for git-over-HTTPS, using git's env-based config (git >= 2.31). This
 * keeps the token OUT of `ps` args and OUT of `.git/config`/disk — the token
 * only ever lives in the child process environment.
 */
function tokenAuthEnv(token: string): Record<string, string> {
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.extraHeader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  };
}

/**
 * Classifies a failed network git operation into a coarse reason, without ever
 * surfacing the raw token or command. Used to explain why a remote check could
 * not be completed.
 */
function classifyRemoteError(error: unknown): "timeout" | "auth" | "error" {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes("timeout")) return "timeout";
  if (
    msg.includes("authentication") ||
    msg.includes("could not read username") ||
    msg.includes("could not read password") ||
    msg.includes("terminal prompts disabled") ||
    msg.includes("permission denied") ||
    msg.includes("403")
  ) {
    return "auth";
  }
  return "error";
}

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  body: string;
  author_name: string;
  author_email: string;
}

export interface TagInfo {
  name: string;
  date: string;
  tagger: string;
}

export async function hasUncommittedChanges(): Promise<boolean> {
  const status = await git.status();
  return !status.isClean();
}

/**
 * Lists tags matching `name@*` sorted by semver descending (highest first).
 * Sorting happens in JS because git's `--sort=-v:refname` doesn't understand
 * pre-release suffixes (it ranks `1.2.0-beta.3` above `1.2.0`), which made the
 * scan baseline regress to an old pre-release tag after a graduation (#62).
 * Tags whose version portion is not valid semver are discarded.
 */
async function getTagsSortedBySemver(packageName: string): Promise<string[]> {
  const raw = await git.raw(["tag", "-l", `${packageName}@*`]);
  return raw
    .split("\n")
    .filter(Boolean)
    .map(tag => ({ tag, version: tag.slice(packageName.length + 1) }))
    .filter(({ version }) => semver.valid(version) !== null)
    .sort((a, b) => semver.rcompare(a.version, b.version))
    .map(({ tag }) => tag);
}

/**
 * Gets the last tag for a specific package, format: name@version.
 * Returns null if no such tag exists.
 */
export async function getLastTagForPackage(packageName: string): Promise<string | null> {
  try {
    const tags = await getTagsSortedBySemver(packageName);
    return tags.length > 0 ? tags[0] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Returns the most recent non-prerelease tag for a package (e.g. "my-pkg@1.2.0"),
 * or null if no stable tag exists. Used to gather changelog commits for a graduation.
 */
export async function getLastStableTagForPackage(packageName: string): Promise<string | null> {
  try {
    const tags = await getTagsSortedBySemver(packageName);
    for (const tag of tags) {
      const version = tag.slice(packageName.length + 1); // strip "name@"
      if (semver.prerelease(version) === null) return tag;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches remote tags and returns the highest stable (non-prerelease) version
 * for a package. Returns null if the remote is unavailable or no stable tag exists.
 * Uses a network-hardened git (timeout + no interactive prompts) so a missing
 * credential or unreachable remote fails fast instead of hanging.
 */
export async function getLatestRemoteStableVersion(packageName: string, token?: string | null): Promise<string | null> {
  try {
    await networkGit(token ? tokenAuthEnv(token) : undefined).fetch(["--tags", "--quiet"]);
    const tags = await getTagsSortedBySemver(packageName);
    for (const tag of tags) {
      const version = tag.slice(packageName.length + 1);
      if (semver.prerelease(version) === null) return version;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gets all commits that affected a specific path since a given tag.
 * If tag is null, gets all commits from the beginning.
 */
export async function getCommitsForPath(path: string, sinceTag: string | null): Promise<CommitInfo[]> {
  try {
    const log = await git.log([
      sinceTag ? `${sinceTag}..HEAD` : "HEAD",
      "--",
      path,
    ]);

    return log.all
      .filter(c => !c.message.startsWith("chore(release):") && !c.message.startsWith("chore(pre-release):"))
      .map(c => ({
        hash: c.hash,
        date: c.date,
        message: c.message,
        body: c.body,
        author_name: c.author_name,
        author_email: c.author_email,
      }));
  } catch (error) {
    console.error(`Error getting commits for path ${path}:`, error);
    return [];
  }
}

/**
 * Gets commits that affected a specific path and are not reachable from ANY
 * existing tag of the package. A single `lastTag..HEAD` range is not enough in
 * repos with parallel pre-release channels (#62): the semver-highest tag can
 * belong to another branch's history, while the current branch's commits were
 * already released under its own channel tags — a single-tag baseline re-lists
 * them. Excluding every `name@*` tag handles any branching topology.
 */
export async function getUnreleasedCommitsForPath(path: string, packageName: string): Promise<CommitInfo[]> {
  try {
    const tags = await listAllTags(`${packageName}@*`);
    const log = await git.log(["HEAD", ...tags.map(t => `^${t}`), "--", path]);

    return log.all
      .filter(c => !c.message.startsWith("chore(release):") && !c.message.startsWith("chore(pre-release):"))
      .map(c => ({
        hash: c.hash,
        date: c.date,
        message: c.message,
        body: c.body,
        author_name: c.author_name,
        author_email: c.author_email,
      }));
  } catch (error) {
    console.error(`Error getting unreleased commits for path ${path}:`, error);
    return [];
  }
}

/**
 * Gets all repo commits (no path filter) not reachable from any tag of the
 * package. Counterpart of getUnreleasedCommitsForPath for "extra" commits.
 */
export async function getUnreleasedRepoCommits(packageName: string): Promise<CommitInfo[]> {
  try {
    const tags = await listAllTags(`${packageName}@*`);
    const log = await git.log(["HEAD", ...tags.map(t => `^${t}`)]);
    return log.all
      .filter(c => !c.message.startsWith("chore(release):") && !c.message.startsWith("chore(pre-release):"))
      .map(c => ({
        hash: c.hash,
        date: c.date,
        message: c.message,
        body: c.body,
        author_name: c.author_name,
        author_email: c.author_email,
      }));
  } catch {
    return [];
  }
}

/**
 * Gets all commits in the repository since a given tag (no path filter).
 * Used to find commits that don't touch a specific package's directory.
 */
export async function getRepoCommitsSince(sinceTag: string | null): Promise<CommitInfo[]> {
  try {
    const log = await git.log([sinceTag ? `${sinceTag}..HEAD` : "HEAD"]);
    return log.all
      .filter(c => !c.message.startsWith("chore(release):") && !c.message.startsWith("chore(pre-release):"))
      .map(c => ({
        hash: c.hash,
        date: c.date,
        message: c.message,
        body: c.body,
        author_name: c.author_name,
        author_email: c.author_email,
      }));
  } catch {
    return [];
  }
}

/**
 * Create a release commit
 */
export async function createReleaseCommit(files: string[], message: string): Promise<void> {
  await git.add(files);
  await git.commit(message);
}

/**
 * Create an annotated tag
 */
export async function createAnnotatedTag(tagName: string, message: string): Promise<void> {
  await git.addAnnotatedTag(tagName, message);
}

/**
 * Delete a local tag by name.
 */
export async function deleteLocalTag(tagName: string): Promise<void> {
  await git.tag(["-d", tagName]);
}

/**
 * Return true if a local tag with the given name already exists.
 */
export async function tagExists(tagName: string): Promise<boolean> {
  const out = await git.tag(["-l", tagName]);
  return out.trim().length > 0;
}

/**
 * Undo the last commit, keeping changes in the working tree (--mixed).
 */
export async function resetLastCommit(): Promise<void> {
  await git.reset(["HEAD~1", "--mixed"]);
}

/**
 * Result of checking how far the local branch is behind its upstream.
 * `verified` means the remote was reached; `unverified` means the check could
 * not be completed (and must NOT be treated as "in sync" silently).
 */
export type RemoteSyncResult =
  | { status: "verified"; behind: number }
  | { status: "unverified"; reason: "no-remote" | "timeout" | "auth" | "error" };

/**
 * Fetches remote tracking refs and reports how many commits the local branch is
 * behind its upstream. Network-hardened: the fetch runs with a timeout and with
 * interactive prompts disabled, so a missing credential or unreachable remote
 * returns `unverified` instead of hanging forever.
 *
 * When a token is supplied it is injected for HTTPS auth; the caller decides
 * whether to pass one (lazy read: only if already available, never prompt).
 *
 * A missing upstream tracking branch (fetch succeeds, `@{u}` unresolved) is
 * reported as `verified` with `behind: 0` — there is nothing to be behind of,
 * matching the previous non-noisy behavior for local-only branches.
 */
export async function checkRemoteSync(token?: string | null): Promise<RemoteSyncResult> {
  try {
    await networkGit(token ? tokenAuthEnv(token) : undefined).fetch(["--quiet", "--no-tags"]);
  } catch (error) {
    return { status: "unverified", reason: classifyRemoteError(error) };
  }

  try {
    const raw = await git.raw(["rev-list", "--count", "HEAD..@{u}"]);
    return { status: "verified", behind: parseInt(raw.trim(), 10) || 0 };
  } catch {
    // No upstream tracking branch configured — nothing to compare against.
    return { status: "verified", behind: 0 };
  }
}

/**
 * Returns the set of commit hashes that are ahead of origin/<branch> (not yet pushed).
 * Returns null when the remote tracking branch doesn't exist (no remote configured),
 * which should be treated as "all commits are local — safe to reorder".
 */
export async function getNotPushedHashes(branch: string): Promise<Set<string> | null> {
  try {
    const raw = await git.raw(["log", "--format=%H", `origin/${branch}..HEAD`]);
    return new Set(raw.trim().split("\n").filter(Boolean));
  } catch {
    return null;
  }
}

/**
 * Returns the name of the current git branch.
 */
export async function getCurrentBranch(): Promise<string> {
  const branch = await git.branch();
  return branch.current;
}

/**
 * Return the full SHA of the current HEAD commit.
 */
export async function getHeadHash(): Promise<string> {
  return (await git.revparse(["HEAD"])).trim();
}

/**
 * Push the current branch and all tags to origin. Network-hardened so it fails
 * fast (instead of hanging on a credential prompt) when auth is missing.
 * An optional GitHub token is injected for HTTPS remotes; SSH remotes and
 * remotes with a working credential helper ignore it.
 */
export async function pushRelease(token?: string | null): Promise<void> {
  const branch = await git.branch();
  await networkGit(token ? tokenAuthEnv(token) : undefined)
    .push("origin", branch.current, ["--follow-tags"]);
}

/**
 * List all local git tags, sorted by version descending.
 * Optionally filtered by a glob pattern (e.g. "my-pkg@*").
 */
export async function listAllTags(pattern?: string): Promise<string[]> {
  try {
    const args = pattern
      ? ["tag", "-l", pattern, "--sort=-v:refname"]
      : ["tag", "-l", "--sort=-v:refname"];
    const output = await git.raw(args);
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * List all local git tags with metadata (date, tagger), sorted by creation date descending.
 * Uses a single git call with --format to avoid N+1 round-trips.
 */
export async function listTagsWithMeta(): Promise<TagInfo[]> {
  try {
    const SEP = "\x1f";
    const format = `%(refname:short)${SEP}%(creatordate:short)${SEP}%(taggername)`;
    const output = await git.raw(["tag", "-l", `--sort=-creatordate`, `--format=${format}`]);
    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(SEP);
        return {
          name: parts[0] ?? line,
          date: parts[1] ?? "",
          tagger: parts[2] ?? "",
        };
      });
  } catch {
    return [];
  }
}

/**
 * Get the annotation body of an annotated tag.
 * Falls back to empty string if the tag is lightweight or not found.
 */
export async function getTagAnnotation(tagName: string): Promise<string> {
  try {
    const raw = await git.raw(["tag", "-l", "--format=%(contents)", tagName]);
    return raw.trim();
  } catch {
    return "";
  }
}

export interface GitHubRemoteInfo {
  owner: string;
  repo: string;
  /** Transport used by the origin remote — determines whether token-based
   * HTTPS auth applies (only meaningful for "https"). */
  protocol: "https" | "ssh";
}

/**
 * Parse the GitHub owner, repo and transport from the origin remote URL.
 * Supports HTTPS (https://github.com/owner/repo.git) and SSH (git@github.com:owner/repo.git).
 * Returns null if origin is not a GitHub remote or cannot be parsed.
 */
export async function getGitHubRemoteInfo(): Promise<GitHubRemoteInfo | null> {
  try {
    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === "origin");
    const url = origin?.refs?.fetch ?? "";

    const https = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (https) return { owner: https[1], repo: https[2], protocol: "https" };

    const ssh = url.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (ssh) return { owner: ssh[1], repo: ssh[2], protocol: "ssh" };

    return null;
  } catch {
    return null;
  }
}
