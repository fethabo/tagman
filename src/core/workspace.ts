import path from "node:path";
import fg from "fast-glob";
import { readYaml, readJson, fileExists } from "../utils/index.js";
import { packageJsonSchema, pnpmWorkspaceSchema, PackageJson } from "../schemas/index.js";
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
        try {
          const manifest = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
          packages.push({ dir: pkgDir, manifest });
        } catch {
          console.warn(`Warning: Could not parse package.json at ${pkgJsonPath}`);
        }
      }
    }
  }
  return packages;
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
      const rootPkgJsonPath = path.join(rootDir, "package.json");
      if (await fileExists(rootPkgJsonPath)) {
        try {
          const manifest = await readJson(rootPkgJsonPath, { parse: packageJsonSchema.parse });
          return [{ dir: rootDir, manifest }];
        } catch {
          throw new Error("Found package.json at root but could not parse it.");
        }
      }
      throw new Error("No pnpm-workspace.yaml or valid package.json found.");
    }

    const workspaceDef = await readYaml(workspaceYamlPath, { parse: pnpmWorkspaceSchema.parse });
    return resolvePackagesFromGlobs(rootDir, workspaceDef.packages);
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

  return resolvePackagesFromGlobs(rootDir, rootManifest.workspaces);
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
