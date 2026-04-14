import { Command } from "commander";
import * as p from "@clack/prompts";
import color from "picocolors";
import { getWorkspacePackages } from "../../core/workspace.js";
import { loadConfig } from "../../config.js";
import { handleCheckpoint } from "./steps/checkpoint.js";
import { scanAndSelectPackages } from "./steps/scan-and-select.js";
import { promptTagMessages } from "./steps/tag-messages.js";
import { executeRelease } from "./steps/execute.js";
import { setLocale, t, type Locale } from "../../i18n/index.js";

export type WizardOptions = {
  dryRun: boolean;
  json: boolean;
  packages?: string;
  bump?: "patch" | "minor" | "major";
  push: boolean;
  yes: boolean;
};

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
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser`);

    try {
      const config = await loadConfig();

      const checkpointResult = await handleCheckpoint(config);
      if (!checkpointResult) return;

      let { state, isRecovered, recoveredStep } = checkpointResult;

      const allPackages = await getWorkspacePackages(process.cwd(), config);
      if (allPackages.length === 0) {
        p.log.warn(t().wizard.noPackages);
        p.outro(t().wizard.bye);
        return;
      }

      if (!isRecovered) {
        while (true) {
          const newState = await scanAndSelectPackages(allPackages, config, {
            packages: options.packages,
            bump: options.bump,
            yes: options.yes,
          });
          if (newState === null) return;
          if (newState === "back") continue;
          state = newState;

          if (!options.dryRun) {
            const tagResult = await promptTagMessages(state);
            if (tagResult === false) return;
            if (tagResult === "back") continue;
          }

          break;
        }
      }

      await executeRelease(state, allPackages, config, isRecovered, recoveredStep, {
        dryRun: options.dryRun,
        json: options.json,
        push: options.push,
        yes: options.yes,
      });
    } catch (err: any) {
      p.log.error(err.message);
      p.outro(t().wizard.error);
    }
  });
