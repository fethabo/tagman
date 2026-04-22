import fs from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../utils/index.js";
import type { ReleaseState } from "./checkpoint.js";

interface DraftFile {
  savedAt: string;
  state: [string, ReleaseState][];
}

const DRAFT_FILE = path.join(process.cwd(), ".tagman-draft.json");

export async function hasDraft(): Promise<boolean> {
  return await fileExists(DRAFT_FILE);
}

export async function loadDraft(): Promise<{ savedAt: string; state: Map<string, ReleaseState> } | null> {
  if (!(await hasDraft())) return null;
  const content = await fs.readFile(DRAFT_FILE, "utf-8");
  try {
    const data = JSON.parse(content) as DraftFile;
    return { savedAt: data.savedAt, state: new Map(data.state) };
  } catch {
    return null;
  }
}

export async function saveDraft(stateMap: Map<string, ReleaseState>): Promise<void> {
  const data: DraftFile = {
    savedAt: new Date().toISOString(),
    state: Array.from(stateMap.entries()),
  };
  await fs.writeFile(DRAFT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function clearDraft(): Promise<void> {
  if (await hasDraft()) {
    await fs.unlink(DRAFT_FILE);
  }
}
