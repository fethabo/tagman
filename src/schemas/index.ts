import { z } from "zod";

export const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  private: z.boolean().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
}).passthrough();

export type PackageJson = z.infer<typeof packageJsonSchema>;

export const pnpmWorkspaceSchema = z.object({
  packages: z.array(z.string()),
});

export type PnpmWorkspace = z.infer<typeof pnpmWorkspaceSchema>;
