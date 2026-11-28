import { Command } from "commander";
import * as p from "@clack/prompts";
import * as ui from "../../ui/prompts.js";
import color from "picocolors";
import { getWorkspacePackages, type WorkspacePackage } from "../../core/workspace.js";
import { loadConfig, type TagmanConfig } from "../../config.js";
import { handleCheckpoint } from "./steps/checkpoint.js";
import { scanAndSelectPackages } from "./steps/scan-and-select.js";
import { promptTagMessages } from "./steps/tag-messages.js";
import { executeRelease } from "./steps/execute.js";
import { runGithubReleaseFlow } from "../github-release.js";
import { hasDraft, loadDraft, saveDraft, clearDraft, type DraftContext } from "../../core/draft.js";
import { getHeadHash, getCurrentBranch } from "../../git/index.js";
import type { ReleaseState } from "../../core/checkpoint.js";
import { showDraftResumePrompt } from "./draft-resume-prompt.js";
import { showScanSummaryPrompt } from "./scan-summary-prompt.js";
import { t } from "../../i18n/index.js";
import { VERSION } from "../../version.js";
import { getRunMode, setRunMode, HeadlessError } from "../../ui/mode.js";
import { tagSchemeGate } from "../../ui/gates.js";
import { reserveStdoutForJson } from "../../ui/output.js";
import { runCommand, type ReleaseOutcome } from "../../ui/run.js";

export type WizardOptions = {
  dryRun: boolean;
  json: boolean;
  packages?: string;
  bump?: "patch" | "minor" | "major";
  push: boolean;
  yes: boolean;
  allowDirty?: boolean;
  allowBehind?: boolean;
};

/**
 * Validate a saved draft against the current repo state, classifying changes by
 * the severity of their consequence: blockers make resume unsafe (destructive
 * reorder against a moved HEAD, or a stale base version that invalidates the
 * computed bump), warnings are executable-but-noteworthy (HEAD advanced without
 * a reorder, different branch). Drafts without a validity context (saved by an
 * older version) are unverifiable: warned, and blocked only if they carry a
 * reorder. Pure function — no side effects.
 */
export function validateDraft(
  draft: { state: Map<string, ReleaseState>; context?: DraftContext },
  pkgs: WorkspacePackage[],
  currentHead: string,
  currentBranch: string,
): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const hasLift = Array.from(draft.state.values()).some(
    (s) => Array.isArray(s.liftCommits) && s.liftCommits.length > 0,
  );

  if (!draft.context) {
    warnings.push(t().draft.warnUnverifiable);
    if (hasLift) blockers.push(t().draft.blockedReorderStale);
    return { blockers, warnings };
  }

  const headMoved = draft.context.head !== currentHead;

  // Destructive: a planned reorder runs `git reset --hard HEAD~N`; a moved HEAD
  // would delete the wrong commits.
  if (hasLift && headMoved) {
    blockers.push(t().draft.blockedReorderStale);
  }

  // Base version drift invalidates the computed bump for that package.
  const currentVersionByName = new Map(pkgs.map((pkg) => [pkg.manifest.name, pkg.manifest.version]));
  for (const [name, savedVersion] of Object.entries(draft.context.versions)) {
    const current = currentVersionByName.get(name);
    if (current !== undefined && current !== savedVersion) {
      blockers.push(t().draft.blockedVersionChanged(name));
    }
  }

  // Non-blocking: HEAD advanced without a reorder in the plan.
  if (headMoved && !hasLift) {
    warnings.push(t().draft.warnNewCommits);
  }

  // Non-blocking: saved on a different branch.
  if (draft.context.branch !== currentBranch) {
    warnings.push(t().draft.warnBranchDiff(draft.context.branch, currentBranch));
  }

  return { blockers, warnings };
}

/**
 * Core wizard flow — can be called directly from the main menu or from the
 * `tagman release` sub-command.  Accepts pre-loaded config and packages so the
 * caller can avoid loading them a second time when coming from the menu.
 *
 * Returns the outcome instead of printing it; errors propagate to the caller's
 * `runCommand`, which maps them to an exit code (#71).
 */
export async function runWizardFlow(
  options: WizardOptions,
  config?: TagmanConfig,
  allPackages?: WorkspacePackage[],
): Promise<ReleaseOutcome> {
  const cancelled = (): ReleaseOutcome => ({ success: false, reason: "cancelled", message: t().scan.cancelled });
  const { interactive } = getRunMode();

  const cfg = config ?? await loadConfig();
  const pkgs = allPackages ?? await getWorkspacePackages(process.cwd(), cfg);

  // Before the checkpoint step: a rollback under this config would delete the
  // wrong tags too (#74).
  if (tagSchemeGate({ tagName: cfg.tagName, packageCount: pkgs.length }) === "fail") {
    throw new HeadlessError("invalid-config", t().headless.versionOnlyMonorepo(pkgs.length), 1, { packages: pkgs.length });
  }

  const checkpointResult = await handleCheckpoint(cfg, {
    allowDirty: options.allowDirty ?? false,
    allowBehind: options.allowBehind ?? false,
  });
  if (!checkpointResult) return cancelled();

  let { state, isRecovered, recoveredStep } = checkpointResult;

  if (pkgs.length === 0) {
    p.log.warn(t().wizard.noPackages);
    p.outro(t().wizard.bye);
    return { success: false, reason: "no-commits", message: t().wizard.noPackages };
  }

  const execOptions = {
    dryRun: options.dryRun,
    json: options.json,
    push: options.push,
    yes: options.yes,
  };

  if (isRecovered) {
    const recovered = await executeRelease(state, pkgs, cfg, isRecovered, recoveredStep, execOptions);
    return recovered === "back" ? cancelled() : recovered;
  }

  // Check for a saved draft and offer to resume it (interactive only)
  let resumeFromDraft = false;
  if (interactive && !options.dryRun && !options.json && await hasDraft()) {
    const draftData = await loadDraft();
    if (draftData) {
      const dateStr = new Date(draftData.savedAt).toLocaleString();
      p.log.info(t().draft.found(dateStr));
      const [currentHead, currentBranch] = await Promise.all([getHeadHash(), getCurrentBranch()]);
      const validation = validateDraft(draftData, pkgs, currentHead, currentBranch);
      const draftAction = await showDraftResumePrompt(draftData.state, validation);
      if (p.isCancel(draftAction)) {
        p.cancel(t().scan.cancelled);
        return cancelled();
      }
      if (draftAction === "resume") {
        state = draftData.state;
        await clearDraft();
        resumeFromDraft = true;
      } else {
        await clearDraft();
      }
    }
  }

  while (true) {
    if (!resumeFromDraft) {
      const newState = await scanAndSelectPackages(pkgs, cfg, {
        packages: options.packages,
        bump: options.bump,
        yes: options.yes,
      });

      if (newState === null) return cancelled();

      if (newState === "no-commits") {
        // Headless: nothing to release is a normal outcome, not a menu (#71)
        if (!interactive) {
          p.log.info(t().headless.noCommits);
          p.outro(t().wizard.bye);
          return { success: false, reason: "no-commits", message: t().headless.noCommits };
        }

        const next = await ui.select({
          message: t().scan.nothingToReleaseMenu,
          options: [
            { value: "github", label: t().menu.githubRelease, hint: t().menu.githubReleaseHint },
            { value: "exit", label: t().menu.exit },
          ],
        });

        if (p.isCancel(next) || next === "exit") {
          p.outro(t().wizard.bye);
        } else if (next === "github") {
          await runGithubReleaseFlow(cfg);
          p.outro(t().wizard.bye);
        }
        return { success: false, reason: "no-commits", message: t().headless.noCommits };
      }

      if (newState === "back") continue;
      state = newState;

      // Post-scan summary with draft-save option (interactive mode only)
      if (!options.dryRun && interactive) {
        let backToScan = false;
        while (true) {
          const summaryAction = await showScanSummaryPrompt(state!);

          if (p.isCancel(summaryAction)) {
            p.cancel(t().scan.cancelled);
            return cancelled();
          }
          if (summaryAction === "save") {
            const [head, branch] = await Promise.all([getHeadHash(), getCurrentBranch()]);
            await saveDraft(state!, { head, branch });
            p.outro(t().draft.saved);
            return cancelled();
          }
          if (summaryAction === "remove") {
            const currentNames = Array.from(state!.keys());
            const toKeep = await ui.multiselect({
              message: t().scan.removePackagesTitle,
              options: currentNames.map(name => {
                const d = state!.get(name)!;
                return {
                  value: name,
                  label: `${name}: ${d.pkg.manifest.version} → ${d.newVersion}`,
                };
              }),
              initialValues: currentNames,
            });
            if (!p.isCancel(toKeep)) {
              const keepSet = new Set(toKeep as string[]);
              for (const name of currentNames) {
                if (!keepSet.has(name)) state!.delete(name);
              }
              if (state!.size === 0) {
                p.cancel(t().scan.cancelled);
                return cancelled();
              }
            }
            continue; // re-show summary with updated state
          }
          if (summaryAction === "back") {
            backToScan = true;
            break;
          }
          // "proceed" → break and fall through to inner loop
          break;
        }
        if (backToScan) continue;
      }
    }
    resumeFromDraft = false;

    // Snapshot scan-generated tag messages; restored before each re-entry into tag-messages
    const origTagMessages = new Map(
      Array.from(state!.entries()).map(([n, d]) => [n, d.tagMessage])
    );

    // Inner loop: tag-messages ↔ execute confirm (back navigates between them)
    let backToScan = false;
    while (true) {
      if (!options.dryRun) {
        for (const [name, msg] of origTagMessages) {
          state!.get(name)!.tagMessage = msg;
        }
        const tagResult = await promptTagMessages(state!, cfg);
        if (tagResult === false) return cancelled();
        if (tagResult === "back") { backToScan = true; break; }

        const hasTags = Array.from(state!.values()).some(d => d.tagMessage);
        if (!hasTags) {
          p.log.warn(t().tagMessages.noTagsWarning);
          continue;
        }

        const hasNoTags = Array.from(state!.values()).some(d => !d.tagMessage);
        if (hasNoTags) {
          const lines = Array.from(state!.entries())
            .map(([name, d]) => d.tagMessage
              ? `  ✓ ${name}@${d.newVersion}  · ${t().tagMessages.tagSummaryCreate}`
              : `  ✗ ${name}@${d.newVersion}  · ${t().tagMessages.tagSummarySkip}`)
            .join("\n");
          p.note(lines, t().tagMessages.tagSummaryTitle);
        }
      }

      const execResult = await executeRelease(state!, pkgs, cfg, isRecovered, recoveredStep, execOptions);
      if (execResult === "back") continue;
      return execResult;
    }

    if (backToScan) continue;
    return cancelled();
  }
}

export const wizardCommand = new Command("release")
  .description("Start the interactive tagman release wizard")
  .option("--dry-run", "Preview changes without executing", false)
  .option("--json", "Print only a JSON result to stdout (UI goes to stderr)", false)
  .option("--packages <names>", "Comma-separated package names to release (skips package selection prompt)")
  .option("--bump <type>", "Global bump type for all packages: patch | minor | major (skips bump prompt)")
  .option("--push", "Push commits and tags to remote without asking", false)
  .option("--yes", "Non-interactive: accept the default of every prompt (requires --packages)", false)
  .option("--allow-dirty", "With --yes: release even with uncommitted local changes", false)
  .option("--allow-behind", "With --yes: release even if the branch is behind the remote", false)
  .action(async (options: WizardOptions) => {
    setRunMode({ interactive: !options.yes && process.stdin.isTTY === true, json: options.json });
    if (options.json) {
      reserveStdoutForJson();
    } else {
      console.clear();
    }
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser ${color.dim("v" + VERSION)}`);

    await runCommand(() => runWizardFlow(options));
  });
