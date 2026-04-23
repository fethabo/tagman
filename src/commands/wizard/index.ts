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
import { hasDraft, loadDraft, saveDraft, clearDraft } from "../../core/draft.js";
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
          const draftAction = await showDraftResumePrompt(draftData.state);
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
            const summaryAction = await showScanSummaryPrompt(state);

            if (p.isCancel(summaryAction)) {
              p.cancel(t().scan.cancelled);
              return;
            }
            if (summaryAction === "save") {
              await saveDraft(state);
              p.outro(t().draft.saved);
              return;
            }
            if (summaryAction === "back") continue;
            // "proceed" → fall through to inner loop
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
            const tagResult = await promptTagMessages(state!);
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
