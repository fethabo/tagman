import path from "node:path";
import semver from "semver";
import { PackageJson, packageJsonSchema } from "../schemas/index.js";
import { readJson, writeJson, appendToFile } from "../utils/index.js";
import { SemverBump } from "./commits.js";

export async function updatePackageVersion(pkgDir: string, releaseBump: SemverBump): Promise<string> {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const pkg: PackageJson = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
  
  const currentVersion = pkg.version;
  const newVersion = semver.inc(currentVersion, releaseBump);
  if (!newVersion) throw new Error(`Could not increment version for ${pkg.name}`);
  
  pkg.version = newVersion;
  await writeJson(pkgJsonPath, pkg);
  return newVersion;
}

export async function updateConsumerDependencies(
  consumerDir: string, 
  dependencyName: string, 
  newVersion: string
): Promise<void> {
  const pkgJsonPath = path.join(consumerDir, "package.json");
  const pkg: PackageJson = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
  
  const prefix = `^`; // simple default for now, can be improved.
  if (pkg.dependencies && pkg.dependencies[dependencyName]) {
    pkg.dependencies[dependencyName] = `${prefix}${newVersion}`;
  }
  if (pkg.devDependencies && pkg.devDependencies[dependencyName]) {
    pkg.devDependencies[dependencyName] = `${prefix}${newVersion}`;
  }
  if (pkg.peerDependencies && pkg.peerDependencies[dependencyName]) {
    pkg.peerDependencies[dependencyName] = `${prefix}${newVersion}`;
  }

  await writeJson(pkgJsonPath, pkg);
}

export async function appendToChangelog(pkgDir: string, version: string, commits: { hash: string, message: string }[]): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const changelogPath = path.join(pkgDir, "CHANGELOG.md");
  
  const lines = [
    `\n## [${version}] - ${date}`,
    ...commits.map(c => `- ${c.hash.substring(0, 7)} ${c.message}`)
  ];
  
  await appendToFile(changelogPath, lines.join("\n") + "\n");
}

export async function logRelease(summary: Record<string, any>): Promise<void> {
  const logPath = path.join(process.cwd(), ".tagman-release.log");
  const date = new Date().toISOString();
  const entry = `\n--- Release ${date} ---\n${JSON.stringify(summary, null, 2)}\n`;
  await appendToFile(logPath, entry);
}

// Rollback functionalities
export async function rollbackPackageVersion(pkgDir: string, oldVersion: string): Promise<void> {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const pkg: PackageJson = await readJson(pkgJsonPath, { parse: packageJsonSchema.parse });
  pkg.version = oldVersion;
  await writeJson(pkgJsonPath, pkg);
}

export async function rollbackConsumerDependencies(
  consumerDir: string, 
  dependencyName: string, 
  oldVersion: string
): Promise<void> {
  // To keep it simple, we restore using the standard caretaker prefix we use
  await updateConsumerDependencies(consumerDir, dependencyName, oldVersion);
}

import fs from "node:fs/promises";
export async function rollbackChangelog(pkgDir: string, versionToRemove: string): Promise<void> {
  const changelogPath = path.join(pkgDir, "CHANGELOG.md");
  try {
    const content = await fs.readFile(changelogPath, "utf-8");
    const searchString = `\n## [${versionToRemove}] - `;
    const index = content.lastIndexOf(searchString);
    
    if (index !== -1) {
       const restoredContent = content.substring(0, index);
       await fs.writeFile(changelogPath, restoredContent, "utf-8");
    }
  } catch (e) {
    // If changelog doesn't exist or can't be read, we don't have anything to rollback
  }
}
