import { CommitParser } from "conventional-commits-parser";

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
