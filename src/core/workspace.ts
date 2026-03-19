import path from "node:path";
import fg from "fast-glob";
import { readYaml, readJson, fileExists } from "../utils/index.js";
import { packageJsonSchema, pnpmWorkspaceSchema, PackageJson } from "../schemas/index.js";

export interface WorkspacePackage {
  dir: string;
  manifest: PackageJson;
}

export async function getWorkspacePackages(rootDir: string = process.cwd()): Promise<WorkspacePackage[]> {
  const workspaceYamlPath = path.join(rootDir, "pnpm-workspace.yaml");
  
  if (!(await fileExists(workspaceYamlPath))) {
    throw new Error("No pnpm-workspace.yaml found. Are you in a pnpm workspace root?");
  }

  const workspaceDef = await readYaml(workspaceYamlPath, { parse: pnpmWorkspaceSchema.parse });
  
  const packages: WorkspacePackage[] = [];
  
  for (const globPattern of workspaceDef.packages) {
    const pkgDirs = await fg(globPattern, {
      cwd: rootDir,
      onlyDirectories: true,
      absolute: true
    });
    
    for (const pkgDir of pkgDirs) {
      const pkgJsonPath = path.join(pkgDir, "package.json");
      if (await fileExists(pkgJsonPath)) {
        try {
          const manifest = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
          packages.push({ dir: pkgDir, manifest });
        } catch (error) {
          console.warn(`Warning: Could not parse package.json at ${pkgJsonPath}`);
        }
      }
    }
  }

  // Also add the root package if applicable, though usually releases are for workspace packages
  return packages;
}

/**
 * Analyzes the dependency graph to find packages that depend on a given set of packages.
 */
export function getDependents(pkgName: string, allPackages: WorkspacePackage[]): WorkspacePackage[] {
  return allPackages.filter(pkg => {
    const deps = { 
      ...pkg.manifest.dependencies, 
      ...pkg.manifest.devDependencies, 
      ...pkg.manifest.peerDependencies 
    };
    return Object.keys(deps).includes(pkgName);
  });
}
