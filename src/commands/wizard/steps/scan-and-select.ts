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
import { t } from "../../../i18n/index.js";

export type PackageInfo = {
  pkg: WorkspacePackage;
  commits: CommitInfo[];
  lastTag: string | null;
};

export type ScanOptions = {
  packages?: string;
  bump?: "patch" | "minor" | "major";
  yes?: boolean;
};

export async function scanAndSelectPackages(
  allPackages: WorkspacePackage[],
  config: TagmanConfig,
  options: ScanOptions = {}
): Promise<Map<string, ReleaseState> | null> {
  const { packages: pkgFilter, bump: globalBump, yes = false } = options;
  const packagesWithCommits: PackageInfo[] = [];

  const spinner = p.spinner();
  spinner.start(t().scan.scanning);

  for (const pkg of allPackages) {
    const lastTag = await getLastTagForPackage(pkg.manifest.name);
    const commits = await getCommitsForPath(pkg.dir, lastTag);
    if (commits.length > 0) {
      packagesWithCommits.push({ pkg, commits, lastTag });
    }
  }

  spinner.stop(t().scan.scanDone(allPackages.length, packagesWithCommits.length));

  if (packagesWithCommits.length === 0) {
    p.outro(t().scan.nothingToRelease);
    return null;
  }

  // Step 1: Select packages
  let selectedNames: string[];
  if (pkgFilter) {
    const requested = pkgFilter.split(",").map(s => s.trim()).filter(Boolean);
    selectedNames = packagesWithCommits
      .map(info => info.pkg.manifest.name)
      .filter(name => requested.includes(name));
    if (selectedNames.length === 0) {
      p.log.error(t().scan.noMatchingPackages(pkgFilter));
      return null;
    }
  } else {
    const result = await p.multiselect({
      message: t().scan.selectPackages,
      options: packagesWithCommits.map(info => ({
        value: info.pkg.manifest.name,
        label: `${info.pkg.manifest.name} (${info.commits.length} commits)`,
      })),
      required: true,
    });

    if (p.isCancel(result)) {
      p.cancel(t().scan.cancelled);
      return null;
    }
    selectedNames = result as string[];
  }

  const state = new Map<string, ReleaseState>();
  const queue = [...selectedNames];
  const processed = new Set<string>();

  while (queue.length > 0) {
    const pkgName = queue.shift()!;
    if (processed.has(pkgName)) continue;

    const pkgInfo = packagesWithCommits.find(info => info.pkg.manifest.name === pkgName);
    if (!pkgInfo) {
      processed.add(pkgName);
      continue;
    }

    let goBackToCommits = false;
    let chosenCommits: CommitInfo[] = [];
    let bump: string = "";

    do {
      goBackToCommits = false;

      // Step 2: Commits Selection
      if (globalBump !== undefined || yes) {
        // Headless: seleccionar todos los commits
        chosenCommits = pkgInfo.commits;
      } else {
        const selectedCommitHashes = await commitMultiSelect(
          `${t().scan.selectCommits(pkgName)} ${color.cyan(pkgName)}`,
          pkgInfo.commits.map(c => ({ value: c.hash, label: `${c.hash.substring(0, 7)} - ${c.message}` })),
          pkgInfo.commits.map(c => c.hash)
        );

        if (p.isCancel(selectedCommitHashes)) {
          p.cancel(t().scan.cancelled);
          return null;
        }

        chosenCommits = pkgInfo.commits.filter(c =>
          (selectedCommitHashes as string[]).includes(c.hash)
        );
      }

      // Step 3: Version Bump
      const suggested = suggestBump(chosenCommits.map(c => c.message));

      if (globalBump) {
        bump = globalBump;
      } else {
        const result = await p.select({
          message: `${t().scan.selectBump(pkgName, pkgInfo.pkg.manifest.version)} ${color.cyan(pkgName)} (Current: ${pkgInfo.pkg.manifest.version})`,
          options: [
            { value: "patch", label: `Patch (${semver.inc(pkgInfo.pkg.manifest.version, "patch")})`, hint: suggested === "patch" ? "suggested" : undefined },
            { value: "minor", label: `Minor (${semver.inc(pkgInfo.pkg.manifest.version, "minor")})`, hint: suggested === "minor" ? "suggested" : undefined },
            { value: "major", label: `Major (${semver.inc(pkgInfo.pkg.manifest.version, "major")})`, hint: suggested === "major" ? "suggested" : undefined },
            { value: "none", label: `No incrementar (solo Git Tag: ${pkgInfo.pkg.manifest.version})` },
            { value: "custom", label: `Definir una versión específica...` },
            { value: "back", label: t().scan.goBack },
          ],
          initialValue: suggested,
        });

        if (p.isCancel(result)) {
          p.cancel(t().scan.cancelled);
          return null;
        }

        if (result === "back") {
          goBackToCommits = true;
          continue;
        }

        bump = result as string;
      }
    } while (goBackToCommits);

    processed.add(pkgName);

    let newVersion: string;
    if (bump === "none") {
      newVersion = pkgInfo.pkg.manifest.version;
    } else if (bump === "custom") {
      const customV = await p.text({
        message: t().scan.customVersion(pkgName),
        validate: (val) => {
          if (!semver.valid(val)) return t().scan.customVersionError;
        },
      });
      if (p.isCancel(customV)) {
        p.cancel(t().scan.cancelled);
        return null;
      }
      newVersion = semver.clean(customV as string)!;
    } else {
      newVersion = semver.inc(pkgInfo.pkg.manifest.version, bump as semver.ReleaseType)!;
    }

    // Step 4: Cascade analysis
    const dependents = getDependents(pkgName, allPackages);
    for (const dep of dependents) {
      let cascade: boolean;
      if (yes) {
        cascade = true;
      } else {
        const result = await p.confirm({
          message: t().scan.cascadeQuestion(color.cyan(pkgName), color.yellow(dep.manifest.name)),
          initialValue: true,
        });

        if (p.isCancel(result)) {
          p.cancel(t().scan.cancelled);
          return null;
        }
        cascade = result;
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
