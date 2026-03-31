import path from "node:path";
import { z } from "zod";
import { readJson, fileExists } from "./utils/index.js";
import * as p from "@clack/prompts";

export const tagmanConfigSchema = z.object({
  tagName: z.enum(["version-only", "full"]).default("full"),
  packagesRoutes: z.array(z.string()).optional(),
  workspace: z.enum(["pnpm", "npm", "yarn", "bun"]).default("pnpm"),
  annotationMessage: z.string().optional(),
}).strict();

export type TagmanConfig = z.infer<typeof tagmanConfigSchema>;

const CONFIG_FILENAME = "tagman.config.json";

const DEFAULTS: TagmanConfig = {
  tagName: "full",
  workspace: "pnpm",
};

export async function loadConfig(cwd: string = process.cwd()): Promise<TagmanConfig> {
  const configPath = path.join(cwd, CONFIG_FILENAME);

  if (!(await fileExists(configPath))) {
    return DEFAULTS;
  }

  let raw: unknown;
  try {
    raw = await readJson(configPath);
  } catch (e) {
    p.log.error(`[tagman] Failed to parse ${CONFIG_FILENAME}: ${(e as Error).message}`);
    process.exit(1);
  }

  const result = tagmanConfigSchema.safeParse(raw);
  if (!result.success) {
    p.log.warn(`[tagman] Invalid config in ${CONFIG_FILENAME} — using defaults.\n${result.error.message}`);
    return DEFAULTS;
  }

  return result.data;
}
