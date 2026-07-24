import { Command } from "commander";
import * as p from "@clack/prompts";
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
import { setLocale, t, type Locale } from "../../i18n/index.js";
import { VERSION } from "../../version.js";

export type WizardOptions = {
  dryRun: boolean;
  json: boolean;
  packages?: string;
  bump?: "patch" | "minor" | "major";
  push: boolean;
  yes: boolean;
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
 */
export async function runWizardFlow(
  options: WizardOptions,
  config?: TagmanConfig,
  allPackages?: WorkspacePackage[],
): Promise<void> {
  try {
    const cfg = config ?? await loadConfig();

    const checkpointResult = await handleCheckpoint(cfg);
    if (!checkpointResult) return;

    let { state, isRecovered, recoveredStep } = checkpointResult;

    const pkgs = allPackages ?? await getWorkspacePackages(process.cwd(), cfg);
    if (pkgs.length === 0) {
      p.log.warn(t().wizard.noPackages);
      p.outro(t().wizard.bye);
      return;
    }

    if (!isRecovered) {
      // Check for a saved draft and offer to resume it
      let resumeFromDraft = false;
      if (!options.yes && !options.dryRun && !options.json && await hasDraft()) {
        const draftData = await loadDraft();
        if (draftData) {
          const dateStr = new Date(draftData.savedAt).toLocaleString();
          p.log.info(t().draft.found(dateStr));
          const [currentHead, currentBranch] = await Promise.all([getHeadHash(), getCurrentBranch()]);
          const validation = validateDraft(draftData, pkgs, currentHead, currentBranch);
          const draftAction = await showDraftResumePrompt(draftData.state, validation);
          if (p.isCancel(draftAction)) {
            p.cancel(t().scan.cancelled);
            return;
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

          if (newState === null) return;

          if (newState === "no-commits") {
            const next = await p.select({
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
            return;
          }

          if (newState === "back") continue;
          state = newState;

          // Post-scan summary with draft-save option (interactive mode only)
          if (!options.dryRun && !options.yes) {
            let backToScan = false;
            while (true) {
              const summaryAction = await showScanSummaryPrompt(state!);

              if (p.isCancel(summaryAction)) {
                p.cancel(t().scan.cancelled);
                return;
              }
              if (summaryAction === "save") {
                const [head, branch] = await Promise.all([getHeadHash(), getCurrentBranch()]);
                await saveDraft(state!, { head, branch });
                p.outro(t().draft.saved);
                return;
              }
              if (summaryAction === "remove") {
                const currentNames = Array.from(state!.keys());
                const toKeep = await p.multiselect({
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
                    return;
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
            if (tagResult === false) return;
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

          const execResult = await executeRelease(state!, pkgs, cfg, isRecovered, recoveredStep, {
            dryRun: options.dryRun,
            json: options.json,
            push: options.push,
            yes: options.yes,
          });
          if (execResult === "back") continue;
          return;
        }

        if (backToScan) continue;
        break;
      }
    }

    if (isRecovered) {
      await executeRelease(state, pkgs, cfg, isRecovered, recoveredStep, {
        dryRun: options.dryRun,
        json: options.json,
        push: options.push,
        yes: options.yes,
      });
    }
  } catch (err: any) {
    p.log.error(err.message);
    p.outro(t().wizard.error);
  }
}

export const wizardCommand = new Command("release")
  .description("Start the interactive tagman release wizard")
  .option("--dry-run", "Preview changes without executing", false)
  .option("--json", "Output structured JSON at the end instead of a UI message", false)
  .option("--packages <names>", "Comma-separated package names to release (skips package selection prompt)")
  .option("--bump <type>", "Global bump type for all packages: patch | minor | major (skips bump prompt)")
  .option("--push", "Push commits and tags to remote without asking", false)
  .option("--yes", "Skip all confirmations (assume yes)", false)
  .option("--lang <lang>", "Interface language: es | en", "es")
  .action(async (options: WizardOptions & { lang: string }) => {
    if (["es", "en"].includes(options.lang)) {
      setLocale(options.lang as Locale);
    }

    console.clear();
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser ${color.dim("v" + VERSION)}`);

    await runWizardFlow(options);
  });
