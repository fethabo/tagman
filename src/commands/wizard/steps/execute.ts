import path from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
  updatePackageVersion,
  updateConsumerDependencies,
  appendToChangelog,
  logRelease,
} from "../../../core/updater.js";
import { createReleaseCommit, createAnnotatedTag, deleteLocalTag, resetLastCommit, pushRelease, getGitHubRemoteInfo, git } from "../../../git/index.js";
import { resolveGithubToken } from "../../../core/token.js";
import { createGithubRelease } from "../../../integrations/github.js";
import { publishPackage } from "../../../integrations/npm.js";
import { runAfterRelease, type ReleaseResult } from "../../../plugins/index.js";
import { saveCheckpoint, clearCheckpoint, type ReleaseState } from "../../../core/checkpoint.js";
import { getDependents, type WorkspacePackage } from "../../../core/workspace.js";
import type { TagmanConfig } from "../../../config.js";
import { t } from "../../../i18n/index.js";
import { wizardSelect, SELECT_BACK } from "../wizard-select.js";

export type ExecuteOptions = {
  dryRun?: boolean;
  json?: boolean;
  push?: boolean;
  yes?: boolean;
};

function buildTagName(pkgName: string, newVersion: string, config: TagmanConfig): string {
  return config.tagName === "version-only" ? newVersion : `${pkgName}@${newVersion}`;
}

function previewRelease(state: Map<string, ReleaseState>, config: TagmanConfig): void {
  p.log.info(t().execute.dryRunHeader);
  for (const [pkgName, details] of state.entries()) {
    const tagName = buildTagName(pkgName, details.newVersion, config);
    p.log.info(`  ${pkgName}: ${details.pkg.manifest.version} → ${details.newVersion}  (tag: ${tagName})`);
  }
  p.outro(t().execute.dryRunDone);
}

export async function executeRelease(
  state: Map<string, ReleaseState>,
  allPackages: WorkspacePackage[],
  config: TagmanConfig,
  isRecovered: boolean,
  recoveredStep: "writing" | "committing" | null,
  options: ExecuteOptions = {}
): Promise<"back" | void> {
  const { dryRun = false, json = false, push = false, yes = false } = options;

  if (dryRun) {
    previewRelease(state, config);
    return;
  }

  // Collect lift commits from all packages (only one package can have them per plan)
  const seen = new Set<string>();
  const dedupedLift = Array.from(state.values())
    .flatMap(d => d.liftCommits ?? [])
    .filter(h => !seen.has(h) && seen.add(h) as unknown as boolean);

  let origHead: string | null = null;

  if (!isRecovered) {
    if (!yes) {
      const execute = await wizardSelect(
        t().execute.confirmProceed,
        [
          { value: "yes", label: t().execute.confirmYes },
          { value: "no",  label: t().execute.confirmNo },
        ],
        "yes",
        t().execute.goBack,
      );

      if (execute === SELECT_BACK) return "back";
      if (p.isCancel(execute) || execute === "no") {
        p.cancel(t().execute.cancelled);
        return;
      }
    }

    // If reorder was requested, reset HEAD to remove trailing commits before writing
    if (dedupedLift.length > 0) {
      origHead = (await git.raw(["rev-parse", "HEAD"])).trim();
      await git.raw(["reset", "--hard", `HEAD~${dedupedLift.length}`]);
    }

    await saveCheckpoint("writing", state);
  }

  if (!isRecovered || recoveredStep === "writing") {
    const writingSpinner = p.spinner();
    writingSpinner.start(t().execute.writing);

    const releasedLog: Record<string, string> = {};

    for (const [pkgName, details] of state.entries()) {
      try {
        await updatePackageVersion(details.pkg.dir, details.newVersion);
        await appendToChangelog(pkgName, details.pkg.dir, details.newVersion, details.pkg.manifest.version, details.changelogCommits ?? details.commits);
        releasedLog[pkgName] = details.newVersion;

        const dependents = getDependents(pkgName, allPackages);
        for (const dep of dependents) {
          if (state.has(dep.manifest.name)) {
            await updateConsumerDependencies(dep.dir, pkgName, details.newVersion);
          }
        }
      } catch (e) {
        writingSpinner.stop(t().execute.writingError);
        console.error(e);
        return;
      }
    }

    await logRelease(releasedLog);
    writingSpinner.stop(t().execute.writingDone);
    await saveCheckpoint("committing", state);
  }

  const commitSpinner = p.spinner();
  commitSpinner.start(t().execute.committing);

  const pkgsArray = Array.from(state.keys());
  const commitMsg = `chore(release): [${pkgsArray.join(", ")}]`;

  const filesToCommit = Array.from(state.values()).flatMap(d => [
    path.join(d.pkg.dir, "package.json"),
    path.join(d.pkg.dir, "CHANGELOG.md"),
  ]);

  await createReleaseCommit(filesToCommit, commitMsg);

  const createdTags: string[] = [];
  try {
    for (const [pkgName, details] of state.entries()) {
      if (details.tagMessage) {
        const tagName = config.tagName === "version-only"
          ? details.newVersion
          : `${pkgName}@${details.newVersion}`;
        await createAnnotatedTag(tagName, details.tagMessage);
        createdTags.push(tagName);
      }
    }
  } catch (e: any) {
    commitSpinner.stop(t().execute.tagsSpinnerError);
    p.log.error(t().execute.tagsError(e.message));
    p.log.warn(t().execute.reverting);
    for (const tag of createdTags) {
      try { await deleteLocalTag(tag); } catch { /* ignorar */ }
    }
    try { await resetLastCommit(); } catch { /* ignorar */ }
    p.log.error(t().execute.revertedGit);
    return;
  }

  commitSpinner.stop(t().execute.commitDone);
  await clearCheckpoint();

  // Reorder: cherry-pick the lifted commits back on top of the release commit
  if (dedupedLift.length > 0) {
    const liftSpinner = p.spinner();
    liftSpinner.start(t().execute.reorderLifting);
    try {
      for (const hash of dedupedLift) {
        await git.raw(["cherry-pick", hash]);
      }
      liftSpinner.stop(t().execute.reorderDone);
    } catch (e: any) {
      await git.raw(["cherry-pick", "--abort"]).catch(() => {});
      liftSpinner.stop(t().execute.reorderFailed(e.message));
      // Roll back: restore original HEAD (trailing commits + no release commit)
      if (origHead) {
        await git.raw(["reset", "--hard", origHead]);
        for (const tag of createdTags) {
          try { await deleteLocalTag(tag); } catch { /* ignore */ }
        }
      }
      return;
    }
  }

  // Only offer to push if at least one tag was actually created (#25)
  let doPush = false;
  if (createdTags.length > 0) {
    doPush = push;
    if (!push) {
      const shouldPush = await p.confirm({
        message: t().execute.pushQuestion,
        initialValue: true,
      });
      doPush = !p.isCancel(shouldPush) && shouldPush;
    }

    if (doPush) {
      const pushSpinner = p.spinner();
      pushSpinner.start(t().execute.pushing);
      try {
        await pushRelease();
        pushSpinner.stop(t().execute.pushDone);
      } catch (e: any) {
        pushSpinner.stop(t().execute.pushSpinnerError);
        p.log.error(t().execute.pushError(e.message));
        p.log.warn(t().execute.pushFallback);
      }
    }
  }

  // GitHub Releases
  if (config.github?.createRelease) {
    const token = await resolveGithubToken(config.github.token);
    if (!token) {
      p.log.warn(t().execute.githubNoToken);
    } else {
      const ghInfo = await getGitHubRemoteInfo();
      if (!ghInfo) {
        p.log.warn(t().execute.githubNoRemote);
      } else {
        const ghSpinner = p.spinner();
        ghSpinner.start(t().execute.githubCreating);
        const urls: string[] = [];
        for (const [pkgName, details] of state.entries()) {
          if (!details.tagMessage) continue; // skip packages where user declined tag creation (#25)
          try {
            const tagName = buildTagName(pkgName, details.newVersion, config);
            const isPrerelease = details.githubPrerelease ?? config.github.prerelease ?? false;
            const url = await createGithubRelease({
              token,
              owner: ghInfo.owner,
              repo: ghInfo.repo,
              tagName,
              body: details.tagMessage ?? "",
              prerelease: isPrerelease,
            });
            urls.push(url);
          } catch (e: any) {
            p.log.warn(t().execute.githubFailed(pkgName, e.message));
          }
        }
        ghSpinner.stop(t().execute.githubDone(urls.length));
        for (const url of urls) p.log.info(`  ${url}`);
        // Warn if releases were expected but none created (#17)
        const packagesWithTags = Array.from(state.values()).filter(d => d.tagMessage).length;
        if (packagesWithTags > 0 && urls.length === 0) {
          p.log.warn(t().execute.githubSkippedPrerelease);
        }
      }
    }
  }

  // NPM Publishing
  if (config.npm?.publish) {
    const npmSpinner = p.spinner();
    npmSpinner.start(t().execute.npmPublishing);
    for (const [pkgName, details] of state.entries()) {
      try {
        await publishPackage(details.pkg.dir, config.npm.access ?? "public");
        p.log.info(t().execute.npmPublished(pkgName, details.newVersion));
      } catch (e: any) {
        p.log.warn(t().execute.npmFailed(pkgName, e.message));
      }
    }
    npmSpinner.stop(t().execute.npmDone);
  }

  // Plugins
  if (config.plugins?.length) {
    const pluginResult: ReleaseResult = {
      packages: Array.from(state.entries()).map(([name, d]) => ({
        name,
        previousVersion: d.pkg.manifest.version,
        newVersion: d.newVersion,
        tag: buildTagName(name, d.newVersion, config),
      })),
    };
    await runAfterRelease(config.plugins, pluginResult);
  }

  if (json) {
    const output = {
      success: true,
      packages: Array.from(state.entries()).map(([name, d]) => ({
        name,
        previousVersion: d.pkg.manifest.version,
        newVersion: d.newVersion,
        tag: buildTagName(name, d.newVersion, config),
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  p.outro(color.green(t().execute.done));
}
