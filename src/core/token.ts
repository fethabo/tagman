import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { t } from "../i18n/index.js";
import * as p from "@clack/prompts";

/**
 * Parse a .npmrc file and return the value of GITHUB_TOKEN or github_token.
 * Ignores comments, empty lines, and registry auth lines (//...).
 */
async function readTokenFromNpmrc(filePath: string, checkPermissions = false): Promise<string | null> {
  try {
    if (checkPermissions && os.platform() !== "win32") {
      const stats = await fs.stat(filePath);
      // Check if file is world-readable or group-readable (mask 0077)
      if ((stats.mode & 0o077) !== 0) {
        p.log.warn(t().execute.githubTokenInsecure(filePath));
      }
    }

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
 *
 * Returns null if no token is found in any source.
 * Project-level .npmrc and configToken are NO LONGER supported for security reasons.
 */
export async function resolveGithubToken(configToken?: string): Promise<string | null> {
  // 1. Environment variable
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  // 2. Global ~/.npmrc
  const globalNpmrc = path.join(os.homedir(), ".npmrc");
  const fromGlobal = await readTokenFromNpmrc(globalNpmrc, true);
  if (fromGlobal) return fromGlobal;

  // 3. Project-level .npmrc (REMOVED)
  const projectNpmrc = path.join(process.cwd(), ".npmrc");
  const projectNpmrcExists = await fs.stat(projectNpmrc).then(() => true).catch(() => false);
  if (projectNpmrcExists) {
    const fromProject = await readTokenFromNpmrc(projectNpmrc);
    if (fromProject) {
      p.log.warn(t().execute.githubTokenProjectExposure);
    }
  }

  // 4. tagman.config.json (REMOVED)
  if (configToken) {
    p.log.warn(t().execute.githubTokenConfigExposure);
  }

  return null;
}
