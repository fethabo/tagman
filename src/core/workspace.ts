import path from "node:path";
import fg from "fast-glob";
import * as p from "@clack/prompts";
import { readYaml, readJson, fileExists } from "../utils/index.js";
import { formatSchemaError } from "../utils/schema-error.js";
import { packageJsonSchema, pnpmWorkspaceSchema, PackageJson } from "../schemas/index.js";
import { t } from "../i18n/index.js";
import type { TagmanConfig } from "../config.js";

export interface WorkspacePackage {
  dir: string;
  manifest: PackageJson;
}

async function resolvePackagesFromGlobs(rootDir: string, globs: string[]): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  for (const globPattern of globs) {
    const pkgDirs = await fg(globPattern, {
      cwd: rootDir,
      onlyDirectories: true,
      absolute: true,
    });
    for (const pkgDir of pkgDirs) {
      const pkgJsonPath = path.join(pkgDir, "package.json");
      if (await fileExists(pkgJsonPath)) {
        let raw: unknown;
        try {
          raw = await readJson<unknown>(pkgJsonPath);
        } catch {
          // I/O failure or malformed JSON — not a schema problem
          p.log.warn(t().workspace.invalidPackageJson(pkgJsonPath));
          continue;
        }
        const result = packageJsonSchema.safeParse(raw);
        if (!result.success) {
          p.log.warn(formatSchemaError(pkgJsonPath, result.error));
          continue;
        }
        packages.push({ dir: pkgDir, manifest: result.data });
      }
    }
  }
  return packages;
}

/**
 * Resolves the repository as a single package rooted at `rootDir`.
 *
 * Used whenever no workspace is declared — either pnpm-workspace.yaml is absent,
 * or it exists as a settings-only file with no `packages` key (legitimate under
 * pnpm 10, which repurposed that file as pnpm's general settings file).
 */
async function resolveRootPackage(rootDir: string): Promise<WorkspacePackage[]> {
  const rootPkgJsonPath = path.join(rootDir, "package.json");
  if (await fileExists(rootPkgJsonPath)) {
    let raw: unknown;
    try {
      raw = await readJson<unknown>(rootPkgJsonPath);
    } catch {
      throw new Error("Found package.json at root but could not parse it.");
    }
    const result = packageJsonSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(formatSchemaError(rootPkgJsonPath, result.error));
    }
    return [{ dir: rootDir, manifest: result.data }];
  }
  throw new Error("No pnpm-workspace.yaml or valid package.json found.");
}

export async function getWorkspacePackages(rootDir: string = process.cwd(), config?: TagmanConfig): Promise<WorkspacePackage[]> {
  // Config-defined routes take highest priority
  if (config?.packagesRoutes && config.packagesRoutes.length > 0) {
    return resolvePackagesFromGlobs(rootDir, config.packagesRoutes);
  }

  const workspaceType = config?.workspace ?? "pnpm";

  if (workspaceType === "pnpm") {
    const workspaceYamlPath = path.join(rootDir, "pnpm-workspace.yaml");

    if (!(await fileExists(workspaceYamlPath))) {
      return resolveRootPackage(rootDir);
    }

    // An empty file yields `null` from the YAML parser; treat it the same as a
    // settings-only file so it degrades instead of failing validation. A wrong
    // top-level type (string, array, ...) still reports a root-level issue.
    const rawWorkspace = await readYaml<unknown>(workspaceYamlPath) ?? {};
    const parsed = pnpmWorkspaceSchema.safeParse(rawWorkspace);
    if (!parsed.success) {
      // Surface a message that names the file instead of letting Zod's JSON
      // issue dump reach the wizard's generic error handler.
      throw new Error(formatSchemaError(workspaceYamlPath, parsed.error));
    }

    const declaredPackages = parsed.data.packages;
    if (!declaredPackages || declaredPackages.length === 0) {
      p.log.warn(t().workspace.undeclaredPackages(workspaceYamlPath));
      return resolveRootPackage(rootDir);
    }

    return resolvePackagesFromGlobs(rootDir, declaredPackages);
  }

  // npm / yarn / bun — workspaces defined in root package.json `workspaces` field
  const rootPkgJsonPath = path.join(rootDir, "package.json");
  if (!(await fileExists(rootPkgJsonPath))) {
    throw new Error(`No package.json found at root for ${workspaceType} workspace.`);
  }

  const rootManifest = await readJson(rootPkgJsonPath, { parse: packageJsonSchema.parse });
  if (!rootManifest.workspaces || rootManifest.workspaces.length === 0) {
    return [{ dir: rootDir, manifest: rootManifest }];
  }

  const packages = await resolvePackagesFromGlobs(rootDir, rootManifest.workspaces);
  if (packages.length === 0) {
    console.warn(`[tagman] No se encontraron paquetes con los globs del workspace ${workspaceType}. Verificá el campo "workspaces" en package.json.`);
  }
  return packages;
}

export function getDependents(pkgName: string, allPackages: WorkspacePackage[]): WorkspacePackage[] {
  return allPackages.filter(pkg => {
    const deps = {
      ...pkg.manifest.dependencies,
      ...pkg.manifest.devDependencies,
      ...pkg.manifest.peerDependencies,
    };
    return Object.keys(deps).includes(pkgName);
  });
}
