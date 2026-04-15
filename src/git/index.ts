import { simpleGit, SimpleGit } from "simple-git";

export const git: SimpleGit = simpleGit();

export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  body: string;
  author_name: string;
}

export async function hasUncommittedChanges(): Promise<boolean> {
  const status = await git.status();
  return !status.isClean();
}

/**
 * Gets the last tag for a specific package, format: name@version.
 * Returns null if no such tag exists.
 */
export async function getLastTagForPackage(packageName: string): Promise<string | null> {
  try {
    // Get all tags sorted by semver (v:refname)
    const tags = await git.raw(["tag", "-l", `${packageName}@*`, "--sort=-v:refname"]);
    const lines = tags.split("\n").filter(Boolean);
    return lines.length > 0 ? lines[0] : null;
  } catch (error) {
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

    return log.all.map(c => ({
      hash: c.hash,
      date: c.date,
      message: c.message,
      body: c.body,
      author_name: c.author_name,
    }));
  } catch (error) {
    console.error(`Error getting commits for path ${path}:`, error);
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
    return log.all.map(c => ({
      hash: c.hash,
      date: c.date,
      message: c.message,
      body: c.body,
      author_name: c.author_name,
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
 * Undo the last commit, keeping changes in the working tree (--mixed).
 */
export async function resetLastCommit(): Promise<void> {
  await git.reset(["HEAD~1", "--mixed"]);
}

/**
 * Fetches remote tracking refs and returns how many commits the local branch
 * is behind its upstream. Returns 0 if there is no remote, no tracking branch
 * configured, or the network is unavailable.
 */
export async function getRemoteBehindCount(): Promise<number> {
  try {
    await git.fetch(["--quiet", "--no-tags"]);
    const raw = await git.raw(["rev-list", "--count", "HEAD..@{u}"]);
    return parseInt(raw.trim(), 10) || 0;
  } catch {
    return 0;
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
 * Push the current branch and all tags to origin.
 */
export async function pushRelease(): Promise<void> {
  const branch = await git.branch();
  await git.push("origin", branch.current, ["--follow-tags"]);
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

/**
 * Parse the GitHub owner and repo from the origin remote URL.
 * Supports HTTPS (https://github.com/owner/repo.git) and SSH (git@github.com:owner/repo.git).
 * Returns null if origin is not a GitHub remote or cannot be parsed.
 */
export async function getGitHubRemoteInfo(): Promise<{ owner: string; repo: string } | null> {
  try {
    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === "origin");
    const url = origin?.refs?.fetch ?? "";

    const https = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (https) return { owner: https[1], repo: https[2] };

    const ssh = url.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (ssh) return { owner: ssh[1], repo: ssh[2] };

    return null;
  } catch {
    return null;
  }
}
