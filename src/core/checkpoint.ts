import fs from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../utils/index.js";
import { WorkspacePackage } from "./workspace.js";

export interface ReleaseState {
  pkg: WorkspacePackage;
  commits: { hash: string, message: string }[];
  bump: "patch" | "minor" | "major" | "none" | "custom";
  newVersion: string;
  tagMessage: string;
}

export interface Checkpoint {
  step: "writing" | "committing";
  state: [string, ReleaseState][]; // Serialized map
}

const CHECKPOINT_FILE = path.join(process.cwd(), ".tagman-checkpoint.json");

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

export async function saveCheckpoint(step: "writing" | "committing", stateMap: Map<string, ReleaseState>): Promise<void> {
  const data: Checkpoint = {
    step,
    state: Array.from(stateMap.entries())
  };
  await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function clearCheckpoint(): Promise<void> {
  if (await hasCheckpoint()) {
    await fs.unlink(CHECKPOINT_FILE);
  }
}
