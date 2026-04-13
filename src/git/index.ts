import { simpleGit, SimpleGit } from "simple-git";

export const git: SimpleGit = simpleGit();

export interface CommitInfo {
  hash: string;
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
 * Push the current branch and all tags to origin.
 */
export async function pushRelease(): Promise<void> {
  const branch = await git.branch();
  await git.push("origin", branch.current, ["--follow-tags"]);
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
