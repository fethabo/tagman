import { simpleGit, SimpleGit } from "simple-git";

export const git: SimpleGit = simpleGit();

export interface CommitInfo {
  hash: string;
  message: string;
  body: string;
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
    const from = sinceTag ? `${sinceTag}..HEAD` : "HEAD";
    
    // We use `--` to specify the path
    const log = await git.log({
      from: sinceTag ? sinceTag : undefined,
      to: "HEAD",
      file: path,
    });
    
    // Note: simple-git `.log` doesn't strictly adhere to the `from..to -- path` if we just pass file.
    // So we use raw properly if standard log is not accurate.
    const rawRes = await git.raw([
      "log",
      "--format=%H%x00%s%x00%b",
      sinceTag ? `${sinceTag}..HEAD` : "HEAD",
      "--",
      path
    ]);

    const commits: CommitInfo[] = [];
    if (!rawRes.trim()) return commits;

    const sections = rawRes.split("\n\n").filter(b => b.trim().length > 0);
    for (const section of sections) {
        // Sometimes commits are separated by \n not \n\n if body is empty. Let's do a better parse mapping.
    }
    
    // Use simple-git log with bounds
    const customLog = await git.log([
        sinceTag ? `${sinceTag}..HEAD` : "HEAD",
        "--", 
        path
    ]);

    return customLog.all.map(c => ({
      hash: c.hash,
      message: c.message,
      body: c.body
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
