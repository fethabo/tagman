import { CommitParser } from "conventional-commits-parser";
import semver from "semver";

export type SemverBump = "patch" | "minor" | "major";

export interface ParsedCommit {
  type: string | null;
  scope: string | null;
  subject: string | null;
  header: string | null;
  body: string | null;
  footer: string | null;
  notes: { title: string; text: string }[];
  references: any[];
}

const parser = new CommitParser();

export function parseCommitMessage(message: string): ParsedCommit {
  return parser.parse(message) as unknown as ParsedCommit;
}

export function suggestBump(commits: string[]): SemverBump {
  let bump: SemverBump = "patch";

  for (const commitMsg of commits) {
    const parsed = parseCommitMessage(commitMsg);
    const msgUpper = commitMsg.toUpperCase();

    // Breaking changes: a `!` only counts when it belongs to a conventional
    // header (`type!:` or `type(scope)!:`), not any incidental `!:` in the body.
    const hasBreakingBang = /^[a-zA-Z]+(\([^)]*\))?!:/.test(commitMsg);
    if (parsed.notes.some(note => note.title.toUpperCase() === "BREAKING CHANGE") || hasBreakingBang || msgUpper.includes("BREAKING CHANGE")) {
      return "major"; // Major takes precedence, we can return early
    }

    // parsed.type is null when the commit doesn't follow conventional format; treat as non-feat
    if (parsed.type?.toLowerCase() === "feat") {
      bump = "minor";
    }
  }

  return bump;
}

/**
 * The bump the interactive bump prompt preselects for a package. `--yes`
 * without `--bump` takes exactly this value, so headless and interactive
 * defaults can never diverge (#71):
 * - a graduation candidate graduates;
 * - a pre-release continues its line (`hotfix` stays on the hotfix line);
 * - a stable version takes the bump suggested by its conventional commits.
 */
export function defaultBumpFor(opts: {
  isGraduation: boolean;
  currentVersion: string;
  suggested: SemverBump;
}): "graduate" | "hotfix" | "prerelease" | SemverBump {
  if (opts.isGraduation) return "graduate";
  const pre = semver.prerelease(opts.currentVersion);
  if (pre !== null) return String(pre[0]) === "hotfix" ? "hotfix" : "prerelease";
  return opts.suggested;
}
