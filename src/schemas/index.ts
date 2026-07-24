import { z } from "zod";

export const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  private: z.boolean().optional(),
  workspaces: z.array(z.string()).optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
}).passthrough();

export type PackageJson = z.infer<typeof packageJsonSchema>;

// pnpm 10 turned pnpm-workspace.yaml into the general settings file
// (allowBuilds, onlyBuiltDependencies, catalog, ...), so `packages` is optional
// and unknown keys must survive the parse.
export const pnpmWorkspaceSchema = z.object({
  packages: z.array(z.string()).optional(),
}).passthrough();

export type PnpmWorkspace = z.infer<typeof pnpmWorkspaceSchema>;
