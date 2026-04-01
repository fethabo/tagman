import * as p from "@clack/prompts";
import color from "picocolors";
import semver from "semver";
import { getCommitsForPath, getLastTagForPackage, type CommitInfo } from "../../../git/index.js";
import { suggestBump } from "../../../core/commits.js";
import { getRepositoryBaseUrl, formatCommitList } from "../../../core/updater.js";
import { getDependents, type WorkspacePackage } from "../../../core/workspace.js";
import type { ReleaseState } from "../../../core/checkpoint.js";
import type { TagmanConfig } from "../../../config.js";
import { commitMultiSelect } from "../commit-multiselect.js";

export type PackageInfo = {
  pkg: WorkspacePackage;
  commits: CommitInfo[];
  lastTag: string | null;
};

export async function scanAndSelectPackages(
  allPackages: WorkspacePackage[],
  config: TagmanConfig
): Promise<Map<string, ReleaseState> | null> {
  const packagesWithCommits: PackageInfo[] = [];

  const spinner = p.spinner();
  spinner.start("Scanning packages for new commits...");

  for (const pkg of allPackages) {
    const lastTag = await getLastTagForPackage(pkg.manifest.name);
    const commits = await getCommitsForPath(pkg.dir, lastTag);
    if (commits.length > 0) {
      packagesWithCommits.push({ pkg, commits, lastTag });
    }
  }

  spinner.stop(`Scanned ${allPackages.length} packages. Found ${packagesWithCommits.length} with pending changes.`);

  if (packagesWithCommits.length === 0) {
    p.outro("No new commits found in any package. Nothing to release.");
    return null;
  }

  // Step 1: Select packages
  const selectedPkgNames = await p.multiselect({
    message: "Step 1: Select packages to release",
    options: packagesWithCommits.map(info => ({
      value: info.pkg.manifest.name,
      label: `${info.pkg.manifest.name} (${info.commits.length} commits)`,
    })),
    required: true,
  });

  if (p.isCancel(selectedPkgNames)) {
    p.cancel("Operation cancelled.");
    return null;
  }

  const state = new Map<string, ReleaseState>();
  const queue = [...(selectedPkgNames as string[])];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const pkgName = queue.shift()!;
    if (processed.has(pkgName)) continue;
    processed.add(pkgName);

    const pkgInfo = packagesWithCommits.find(info => info.pkg.manifest.name === pkgName);
    if (!pkgInfo) continue;

    // Step 2: Commits Selection
    const selectedCommitHashes = await commitMultiSelect(
      `Step 2: Commits for ${color.cyan(pkgName)}`,
      pkgInfo.commits.map(c => ({ value: c.hash, label: `${c.hash.substring(0, 7)} - ${c.message}` })),
      pkgInfo.commits.map(c => c.hash)
    );

    if (p.isCancel(selectedCommitHashes)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    const chosenCommits = pkgInfo.commits.filter(c =>
      (selectedCommitHashes as string[]).includes(c.hash)
    );

    // Step 3: Version Bump
    const suggested = suggestBump(chosenCommits.map(c => c.message));

    const bump = await p.select({
      message: `Step 3: Version increment for ${color.cyan(pkgName)} (Current: ${pkgInfo.pkg.manifest.version})`,
      options: [
        { value: "patch", label: `Patch (${semver.inc(pkgInfo.pkg.manifest.version, "patch")})`, hint: suggested === "patch" ? "suggested" : undefined },
        { value: "minor", label: `Minor (${semver.inc(pkgInfo.pkg.manifest.version, "minor")})`, hint: suggested === "minor" ? "suggested" : undefined },
        { value: "major", label: `Major (${semver.inc(pkgInfo.pkg.manifest.version, "major")})`, hint: suggested === "major" ? "suggested" : undefined },
        { value: "none", label: `No incrementar (solo Git Tag: ${pkgInfo.pkg.manifest.version})` },
        { value: "custom", label: `Definir una versión específica...` },
      ],
      initialValue: suggested,
    });

    if (p.isCancel(bump)) {
      p.cancel("Operation cancelled.");
      return null;
    }

    let newVersion: string;
    if (bump === "none") {
      newVersion = pkgInfo.pkg.manifest.version;
    } else if (bump === "custom") {
      const customV = await p.text({
        message: `Escribe la nueva versión exacta (SemVer) para ${pkgName}:`,
        validate: (val) => {
          if (!semver.valid(val)) return "Error: debe ser una versión SemVer válida (ej: 1.2.3)";
        },
      });
      if (p.isCancel(customV)) {
        p.cancel("Operation cancelled.");
        return null;
      }
      newVersion = semver.clean(customV as string)!;
    } else {
      newVersion = semver.inc(pkgInfo.pkg.manifest.version, bump as semver.ReleaseType)!;
    }

    // Step 4: Cascade analysis
    const dependents = getDependents(pkgName, allPackages);
    for (const dep of dependents) {
      const cascade = await p.confirm({
        message: `Aviso: ${color.cyan(pkgName)} es dependencia de ${color.yellow(dep.manifest.name)}. ¿Deseas versionar también ${color.yellow(dep.manifest.name)} para actualizar su referencia?`,
        initialValue: true,
      });

      if (p.isCancel(cascade)) {
        p.cancel("Operation cancelled.");
        return null;
      }

      if (cascade) {
        if (!processed.has(dep.manifest.name) && !queue.includes(dep.manifest.name)) {
          queue.push(dep.manifest.name);

          const existing = packagesWithCommits.find(info => info.pkg.manifest.name === dep.manifest.name);
          if (!existing) {
            packagesWithCommits.push({
              pkg: dep,
              commits: [{ hash: "cascade", message: `chore: update dependency ${pkgName} to ${newVersion}`, body: "", author_name: "tagman" }],
              lastTag: null,
            });
          } else {
            existing.commits.unshift({ hash: "cascade", message: `chore: update dependency ${pkgName} to ${newVersion}`, body: "", author_name: "tagman" });
          }
        }
      }
    }

    const baseUrl = await getRepositoryBaseUrl();
    const { items } = formatCommitList(chosenCommits, baseUrl);

    const tagHeader = config.tagName === "version-only"
      ? newVersion
      : `${pkgName}@${newVersion}`;

    const annotationPrefix = config.annotationMessage
      ? `${config.annotationMessage}\n\n`
      : "";

    const defaultTagMsg = `Release ${tagHeader}\n\n${annotationPrefix}` + items.join("\n");

    state.set(pkgName, {
      pkg: pkgInfo.pkg,
      commits: chosenCommits,
      bump: bump as "patch" | "minor" | "major" | "none" | "custom",
      newVersion,
      tagMessage: defaultTagMsg,
    });
  }

  return state;
}
