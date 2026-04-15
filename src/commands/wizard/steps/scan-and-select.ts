import * as p from "@clack/prompts";
import color from "picocolors";
import semver from "semver";
import { getCommitsForPath, getLastTagForPackage, getLastStableTagForPackage, getRepoCommitsSince, getCurrentBranch, getNotPushedHashes, git, type CommitInfo } from "../../../git/index.js";
import { suggestBump } from "../../../core/commits.js";
import { getRepositoryBaseUrl, formatCommitList } from "../../../core/updater.js";
import { getDependents, type WorkspacePackage } from "../../../core/workspace.js";
import type { ReleaseState } from "../../../core/checkpoint.js";
import type { TagmanConfig } from "../../../config.js";
import { commitMultiSelect, COMMIT_BACK } from "../commit-multiselect.js";
import { wizardSelect, SELECT_BACK } from "../wizard-select.js";
import { t } from "../../../i18n/index.js";

export type PackageInfo = {
  pkg: WorkspacePackage;
  commits: CommitInfo[];
  extraCommits: CommitInfo[];
  lastTag: string | null;
  isGraduation?: boolean;
  isExtraOnly?: boolean;
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
): Promise<Map<string, ReleaseState> | null | "back" | "no-commits"> {
  const { packages: pkgFilter, bump: globalBump, yes = false } = options;
  const packagesWithCommits: PackageInfo[] = [];
  const graduationCandidates: PackageInfo[] = [];
  const extraOnlyCandidates: PackageInfo[] = [];

  const currentBranch = await getCurrentBranch();

  const spinner = p.spinner();
  spinner.start(t().scan.scanning);

  for (const pkg of allPackages) {
    const lastTag = await getLastTagForPackage(pkg.manifest.name);
    const commits = await getCommitsForPath(pkg.dir, lastTag);
    if (commits.length > 0) {
      const repoCommits = await getRepoCommitsSince(lastTag);
      const pathHashes = new Set(commits.map(c => c.hash));
      const extraCommits = repoCommits.filter(c => !pathHashes.has(c.hash));
      packagesWithCommits.push({ pkg, commits, extraCommits, lastTag });
    } else if (semver.prerelease(pkg.manifest.version) !== null) {
      // No new commits but current version is a pre-release → graduation candidate
      const lastStableTag = await getLastStableTagForPackage(pkg.manifest.name);
      const cycleCommits = await getCommitsForPath(pkg.dir, lastStableTag);
      graduationCandidates.push({
        pkg,
        commits: cycleCommits,
        extraCommits: [],
        lastTag,
        isGraduation: true,
      });
    } else {
      // No path commits, not pre-release → check for shared repo commits
      const repoCommits = await getRepoCommitsSince(lastTag);
      if (repoCommits.length > 0) {
        extraOnlyCandidates.push({
          pkg,
          commits: [],
          extraCommits: repoCommits,
          lastTag,
          isExtraOnly: true,
        });
      }
    }
  }

  spinner.stop(t().scan.scanDone(allPackages.length, packagesWithCommits.length));

  if (graduationCandidates.length > 0) {
    p.log.info(t().scan.graduationFound(graduationCandidates.length));
  }

  if (packagesWithCommits.length === 0 && graduationCandidates.length === 0 && extraOnlyCandidates.length === 0) {
    return "no-commits";
  }

  // Unified candidate list: packages with new commits first, then graduation, then extra-only
  const allCandidates: PackageInfo[] = [...packagesWithCommits, ...graduationCandidates, ...extraOnlyCandidates];

  // Step 1: Select packages
  let selectedNames: string[];
  if (pkgFilter) {
    const requested = pkgFilter.split(",").map(s => s.trim()).filter(Boolean);
    selectedNames = allCandidates
      .map(info => info.pkg.manifest.name)
      .filter(name => requested.includes(name));
    if (selectedNames.length === 0) {
      p.log.error(t().scan.noMatchingPackages(pkgFilter));
      return null;
    }
  } else {
    const result = await p.multiselect({
      message: `${t().scan.selectPackages} ${color.dim(`[${currentBranch}]`)}`,
      options: allCandidates.map(info => ({
        value: info.pkg.manifest.name,
        label: info.isExtraOnly
          ? info.pkg.manifest.name
          : info.isGraduation
            ? info.pkg.manifest.name
            : `${info.pkg.manifest.name} (${info.commits.length} commits)`,
        hint: info.isExtraOnly
          ? t().scan.extraOnlyHint
          : info.isGraduation
            ? t().scan.graduationHint(info.pkg.manifest.version)
            : undefined,
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
  let hasReorder = false; // only one package per run can reorder

  while (queue.length > 0) {
    const pkgName = queue.shift()!;
    if (processed.has(pkgName)) continue;

    const pkgInfo = allCandidates.find(info => info.pkg.manifest.name === pkgName);
    if (!pkgInfo) {
      processed.add(pkgName);
      continue;
    }

    const currentVersion = pkgInfo.pkg.manifest.version;
    const isCurrentPrerelease = semver.prerelease(currentVersion) !== null;
    let goBackToCommits = false;
    let chosenCommits: CommitInfo[] = [];
    let bump: string = "";
    let prereleaseChannel: string | undefined;
    let liftCommits: string[] | undefined = undefined;
    let isGraduationMode = false;

    do {
      goBackToCommits = false;
      liftCommits = undefined;
      isGraduationMode = false;

      // Step 2: Path-specific commit selection
      if (globalBump !== undefined || yes) {
        // Headless: select all path commits, skip extras
        chosenCommits = pkgInfo.commits;
      } else if (pkgInfo.isGraduation) {
        // Graduation: no new commits to select — use full pre-release cycle for CHANGELOG
        chosenCommits = pkgInfo.commits;
      } else {
        let selectedPathCommits: CommitInfo[] = [];

        if (pkgInfo.isExtraOnly) {
          // No direct commits — skip Step 2. selectedPathCommits stays [].
          // Fall through to trailing+2b: trailing detection is a no-op, Step 2b runs normally.
        } else {
          const selectedCommitHashes = await commitMultiSelect(
            `${t().scan.selectCommits(pkgName)} ${color.cyan(pkgName)} ${color.dim(`[${currentBranch}]`)}`,
            pkgInfo.commits.map(c => ({
              value: c.hash,
              label: `${c.hash.substring(0, 7)} - ${c.message}`,
              details: `${c.date} · ${c.author_name}`,
            })),
            pkgInfo.commits.map(c => c.hash),
            t().scan.goBackToPackages,
            true,  // allowEmpty: user can proceed to Step 2b with 0 direct commits
          );

          if (selectedCommitHashes === COMMIT_BACK) return "back";

          if (p.isCancel(selectedCommitHashes)) {
            p.cancel(t().scan.cancelled);
            return null;
          }

          selectedPathCommits = pkgInfo.commits.filter(c =>
            (selectedCommitHashes as string[]).includes(c.hash)
          );

          if (selectedPathCommits.length === 0 && isCurrentPrerelease) {
            // Zero commits selected on a pre-release → offer graduation at the pre-release tag's code state.
            // The intervening commits must be lifted (reset + cherry-pick), same as trailing-commit reorder.
            const liftRaw = await git.raw(["log", "--format=%H", `${pkgInfo.lastTag}..HEAD`]);
            const computedLiftCommits = liftRaw.trim().split("\n").filter(Boolean).reverse(); // oldest-first

            const notPushed = await getNotPushedHashes(currentBranch);
            const allLiftNotPushed = notPushed === null || computedLiftCommits.every(h => notPushed.has(h));

            if (!allLiftNotPushed) {
              p.log.warn(t().scan.graduationBlockedPushed);
              goBackToCommits = true;
              continue;
            }
            if (hasReorder) {
              p.log.warn(t().scan.graduationBlockedReorder);
              goBackToCommits = true;
              continue;
            }

            const confirm = await p.confirm({
              message: t().scan.zeroCommitsGraduate(pkgName, currentVersion),
              initialValue: true,
            });
            if (p.isCancel(confirm)) {
              p.cancel(t().scan.cancelled);
              return null;
            }

            if (confirm) {
              // Graduation confirmed: CHANGELOG uses full pre-release cycle commits
              const lastStableTag = await getLastStableTagForPackage(pkgInfo.pkg.manifest.name);
              const cycleCommits = await getCommitsForPath(pkgInfo.pkg.dir, lastStableTag);
              chosenCommits = cycleCommits;
              liftCommits = computedLiftCommits.length > 0 ? computedLiftCommits : undefined;
              hasReorder = true;
              isGraduationMode = true;
              // Skip trailing detection and Step 2b — fall through to Step 3
            }
            // If !confirm: selectedPathCommits = [] → fall through to trailing+2b
          }
        }

        if (!isGraduationMode) {
          // Trailing commit detection: commits more recent than the last selected one
          if (selectedPathCommits.length > 0) {
            const selectedSet = new Set(selectedPathCommits.map(c => c.hash));
            const firstSelectedIdx = pkgInfo.commits.findIndex(c => selectedSet.has(c.hash));
            const trailingCommits = firstSelectedIdx > 0 ? pkgInfo.commits.slice(0, firstSelectedIdx) : [];

            if (trailingCommits.length > 0) {
              const mostRecentSelectedHash = pkgInfo.commits[firstSelectedIdx].hash;
              const liftRaw = await git.raw(["log", "--format=%H", `${mostRecentSelectedHash}..HEAD`]);
              const computedLiftCommits = liftRaw.trim().split("\n").filter(Boolean).reverse();

              const notPushed = await getNotPushedHashes(currentBranch);
              const allLiftNotPushed = notPushed === null || computedLiftCommits.every(h => notPushed.has(h));
              const canReorder = !hasReorder && allLiftNotPushed && computedLiftCommits.length > 0;

              p.log.warn(t().scan.trailingCommitsWarning(trailingCommits.length));
              for (const c of trailingCommits) {
                p.log.message(`  ${color.dim(c.hash.substring(0, 7))} ${c.message}`);
              }

              const trailingOptions: { value: string; label: string }[] = [
                ...(canReorder ? [{ value: "reorder", label: t().scan.trailingReorder }] : []),
                { value: "add",      label: t().scan.trailingAddAll },
                { value: "continue", label: t().scan.trailingContinue },
                { value: "back",     label: t().scan.trailingGoBack },
              ];

              const trailingAction = await wizardSelect(
                t().scan.trailingCommitsQuestion,
                trailingOptions,
                canReorder ? "reorder" : "add",
                undefined,
              );

              if (p.isCancel(trailingAction)) {
                p.cancel(t().scan.cancelled);
                return null;
              }
              if (trailingAction === "back") {
                goBackToCommits = true;
                continue;
              }
              if (trailingAction === "add") {
                selectedPathCommits = [...trailingCommits, ...selectedPathCommits];
              }
              if (trailingAction === "reorder") {
                liftCommits = computedLiftCommits;
                hasReorder = true;
              }
              // "continue" → proceed as-is; trailing commits will be included in tag code but not changelog
            }
          }

          // Step 2b: Optional extra commits from outside this package's directory
          let chosenExtraCommits: CommitInfo[] = [];
          if (pkgInfo.extraCommits.length > 0) {
            const extraHashes = await commitMultiSelect(
              `${t().scan.selectExtraCommits(pkgName)} ${color.cyan(pkgName)}`,
              pkgInfo.extraCommits.map(c => ({
                value: c.hash,
                label: `${c.hash.substring(0, 7)} - ${c.message}`,
                details: `${c.date} · ${c.author_name}`,
              })),
              [],           // none pre-selected
              undefined,    // no go-back shortcut in step 2b
              true,         // allowEmpty — this step is optional
            );

            if (p.isCancel(extraHashes)) {
              p.cancel(t().scan.cancelled);
              return null;
            }

            chosenExtraCommits = pkgInfo.extraCommits.filter(c =>
              (extraHashes as string[]).includes(c.hash)
            );
          }

          chosenCommits = [...selectedPathCommits, ...chosenExtraCommits];
        }
      }

      // Step 3: Version Bump
      const suggested = suggestBump(chosenCommits.map(c => c.message));
      const existingChannel = isCurrentPrerelease
        ? String(semver.prerelease(currentVersion)![0])
        : undefined;

      if (globalBump) {
        bump = globalBump;
      } else {
        const mainBumpOptions: { value: string; label: string; hint?: string }[] = [];

        if (isCurrentPrerelease) {
          const nextPre = semver.inc(currentVersion, "prerelease", existingChannel!)!;
          const stableVer = `${semver.major(currentVersion)}.${semver.minor(currentVersion)}.${semver.patch(currentVersion)}`;
          mainBumpOptions.push(
            { value: "prerelease", label: t().scan.preReleaseIncrement(nextPre), hint: !isGraduationMode ? "suggested" : undefined },
            { value: "graduate",   label: t().scan.preReleaseGraduate(stableVer), hint: isGraduationMode ? "suggested" : undefined },
          );
        }

        mainBumpOptions.push(
          { value: "patch",      label: `Patch (${semver.inc(currentVersion, "patch")})`, hint: !isCurrentPrerelease && suggested === "patch" ? "suggested" : undefined },
          { value: "minor",      label: `Minor (${semver.inc(currentVersion, "minor")})`, hint: !isCurrentPrerelease && suggested === "minor" ? "suggested" : undefined },
          { value: "major",      label: `Major (${semver.inc(currentVersion, "major")})`, hint: !isCurrentPrerelease && suggested === "major" ? "suggested" : undefined },
          { value: "prerelease-new", label: t().scan.preRelease, hint: t().scan.preReleaseHint },
          { value: "none",       label: `No incrementar (solo Git Tag: ${currentVersion})` },
          { value: "custom",     label: `Definir una versión específica...` },
        );

        const result = await wizardSelect(
          `${t().scan.selectBump(pkgName, currentVersion)} ${color.cyan(pkgName)} (Current: ${currentVersion})`,
          mainBumpOptions,
          isGraduationMode ? "graduate" : (isCurrentPrerelease ? "prerelease" : suggested),
          t().scan.goBack,
        );

        if (result === SELECT_BACK) {
          goBackToCommits = true;
          continue;
        }

        if (p.isCancel(result)) {
          p.cancel(t().scan.cancelled);
          return null;
        }

        if (result === "prerelease-new") {
          // Steps 3a + 3b: type and channel selection with back navigation between them
          let preBumpSettled = false;
          preReleaseLoop: while (!preBumpSettled) {
            // Step 3a: Pre-release base bump type
            const typeResult = await wizardSelect(
              t().scan.selectPreReleaseType(pkgName),
              [
                { value: "prepatch", label: t().scan.prepatch(semver.inc(currentVersion, "prepatch", "alpha")!) },
                { value: "preminor", label: t().scan.preminor(semver.inc(currentVersion, "preminor", "alpha")!) },
                { value: "premajor", label: t().scan.premajor(semver.inc(currentVersion, "premajor", "alpha")!) },
              ],
              "preminor",
              t().scan.goBack,
            );

            if (typeResult === SELECT_BACK) {
              // Back from type → back to main bump selector (= back to commits)
              goBackToCommits = true;
              break preReleaseLoop;
            }
            if (p.isCancel(typeResult)) {
              p.cancel(t().scan.cancelled);
              return null;
            }
            const preType = typeResult as string;

            // Step 3b: Pre-release channel (back → returns to type selection)
            const defaultBranches = ["main", "master", "develop", "development"];
            const isDefaultBranch = defaultBranches.includes(currentBranch);
            while (true) {
              const channelOptions: { value: string; label: string; hint?: string }[] = [];
              if (!isDefaultBranch) {
                channelOptions.push({ value: currentBranch, label: currentBranch, hint: t().scan.channelBranchHint });
              }
              channelOptions.push(
                { value: "alpha",  label: "alpha" },
                { value: "beta",   label: "beta" },
                { value: "rc",     label: "rc" },
                { value: "custom", label: t().scan.channelCustom },
              );
              const channelResult = await wizardSelect(
                t().scan.selectChannel,
                channelOptions,
                isDefaultBranch ? "alpha" : currentBranch,
                t().scan.goBack,
              );

              if (channelResult === SELECT_BACK) {
                // Back from channel → loop preReleaseLoop to re-show type selector
                continue preReleaseLoop;
              }
              if (p.isCancel(channelResult)) {
                p.cancel(t().scan.cancelled);
                return null;
              }

              let channelName: string;
              if (channelResult === "custom") {
                const customChannel = await p.text({ message: t().scan.channelCustomInput });
                if (p.isCancel(customChannel)) {
                  p.cancel(t().scan.cancelled);
                  return null;
                }
                channelName = (customChannel as string).trim();
              } else {
                channelName = channelResult as string;
              }

              prereleaseChannel = channelName;
              bump = preType;
              preBumpSettled = true;
              break;
            }
          }

          if (goBackToCommits) continue;
        } else {
          bump = result as string;
        }
      }
    } while (goBackToCommits);

    processed.add(pkgName);

    const isPrereleaseBump = ["premajor", "preminor", "prepatch", "prerelease"].includes(bump);

    let newVersion: string;
    if (bump === "none") {
      newVersion = currentVersion;
    } else if (bump === "graduate") {
      const parsed = semver.parse(currentVersion)!;
      newVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
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
    } else if (bump === "prerelease") {
      const existingChannel = semver.prerelease(currentVersion)?.[0] as string | undefined;
      newVersion = semver.inc(currentVersion, "prerelease", (prereleaseChannel ?? existingChannel)!)!;
    } else if (isPrereleaseBump) {
      newVersion = semver.inc(currentVersion, bump as semver.ReleaseType, prereleaseChannel!)!;
    } else {
      newVersion = semver.inc(currentVersion, bump as semver.ReleaseType)!;
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

          const existing = allCandidates.find(info => info.pkg.manifest.name === dep.manifest.name);
          if (!existing) {
            const cascadeEntry: PackageInfo = {
              pkg: dep,
              commits: [{ hash: "cascade", date: "", message: `chore: update dependency ${pkgName} to ${newVersion}`, body: "", author_name: "tagman", author_email: "tagman" }],
              extraCommits: [],
              lastTag: null,
            };
            allCandidates.push(cascadeEntry);
          } else {
            existing.commits.unshift({ hash: "cascade", date: "", message: `chore: update dependency ${pkgName} to ${newVersion}`, body: "", author_name: "tagman", author_email: "tagman" });
          }
        }
      }
    }

    const baseUrl = await getRepositoryBaseUrl();
    const sortedForAnnotation = [...chosenCommits].sort((a, b) => {
      if (!a.date) return 1;   // cascade entries (empty date) go last
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime(); // newest first
    });
    const { items } = formatCommitList(sortedForAnnotation, baseUrl);

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
      bump: bump as ReleaseState["bump"],
      prereleaseChannel,
      githubPrerelease: isPrereleaseBump || undefined,
      liftCommits,
      newVersion,
      tagMessage: defaultTagMsg,
    });
  }

  return state;
}
