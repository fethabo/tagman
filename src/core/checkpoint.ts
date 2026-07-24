import fs from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../utils/index.js";
import { WorkspacePackage } from "./workspace.js";
import { CommitInfo } from "../git/index.js";

export interface ReleaseState {
  pkg: WorkspacePackage;
  commits: CommitInfo[];
  changelogCommits?: CommitInfo[]; // full pre-release cycle commits for graduation CHANGELOG
  bump: "patch" | "minor" | "major" | "none" | "custom"
      | "premajor" | "preminor" | "prepatch" | "prerelease" | "graduate" | "hotfix";
  prereleaseChannel?: string;  // "alpha", "beta", "rc", or custom
  githubPrerelease?: boolean;  // overrides config.github.prerelease when set
  liftCommits?: string[];      // global commit hashes (oldest-first) to cherry-pick after release commit
  newVersion: string;
  tagMessage: string;
}

export interface Checkpoint {
  step: "writing" | "committing";
  state: [string, ReleaseState][]; // Serialized map
  origHead?: string;               // HEAD prior to a reorder's `reset --hard` (only when liftCommits present)
}

const CHECKPOINT_FILE = path.join(process.cwd(), ".tagman-checkpoint.json");

const PRE_RELEASE_BUMPS = new Set<ReleaseState["bump"]>([
  "premajor", "preminor", "prepatch", "prerelease",
]);

/**
 * Build the release commit message from the plan. Pre-release bumps produce a
 * `chore(pre-release): [...]` subject; everything else (including `hotfix`, a
 * hot release by product decision) uses `chore(release): [...]`. Shared between
 * execution and rollback so both recognize the same commit.
 */
export function buildReleaseCommitMessage(state: Map<string, ReleaseState>): string {
  const pkgsArray = Array.from(state.keys());
  const isPreRelease = Array.from(state.values()).some(d => PRE_RELEASE_BUMPS.has(d.bump));
  return `chore(${isPreRelease ? "pre-release" : "release"}): [${pkgsArray.join(", ")}]`;
}

export async function hasCheckpoint(): Promise<boolean> {
  return await fileExists(CHECKPOINT_FILE);
}

export async function loadCheckpoint(): Promise<Checkpoint | null> {
  if (!(await hasCheckpoint())) return null;
  const content = await fs.readFile(CHECKPOINT_FILE, "utf-8");
  try {
    return JSON.parse(content) as Checkpoint;
  } catch {
    return null;
  }
}

export async function saveCheckpoint(
  step: "writing" | "committing",
  stateMap: Map<string, ReleaseState>,
  origHead?: string,
): Promise<void> {
  const data: Checkpoint = {
    step,
    state: Array.from(stateMap.entries()),
    ...(origHead ? { origHead } : {}),
  };
  await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function clearCheckpoint(): Promise<void> {
  if (await hasCheckpoint()) {
    await fs.unlink(CHECKPOINT_FILE);
  }
}
