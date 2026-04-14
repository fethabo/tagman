import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Parse a .npmrc file and return the value of GITHUB_TOKEN or github_token.
 * Ignores comments, empty lines, and registry auth lines (//...).
 */
async function readTokenFromNpmrc(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
      const match = trimmed.match(/^github_token\s*=\s*(.+)$/i);
      if (match) return match[1].trim();
    }
  } catch {
    // File doesn't exist or can't be read — that's fine
  }
  return null;
}

/**
 * Resolve the GitHub token from multiple sources, in priority order:
 *
 * 1. GITHUB_TOKEN environment variable
 * 2. ~/.npmrc  — key: GITHUB_TOKEN or github_token
 * 3. <cwd>/.npmrc — same keys
 * 4. configToken — value from tagman.config.json (backward compat, not recommended)
 *
 * Returns null if no token is found in any source.
 */
export async function resolveGithubToken(configToken?: string): Promise<string | null> {
  // 1. Environment variable
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  // 2. Global ~/.npmrc
  const globalNpmrc = path.join(os.homedir(), ".npmrc");
  const fromGlobal = await readTokenFromNpmrc(globalNpmrc);
  if (fromGlobal) return fromGlobal;

  // 3. Project-level .npmrc
  const projectNpmrc = path.join(process.cwd(), ".npmrc");
  const fromProject = await readTokenFromNpmrc(projectNpmrc);
  if (fromProject) return fromProject;

  // 4. tagman.config.json (backward compat)
  if (configToken) return configToken;

  return null;
}
