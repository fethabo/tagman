import { Command } from "commander";
import * as p from "@clack/prompts";
import color from "picocolors";
import { getWorkspacePackages } from "../../core/workspace.js";
import { loadConfig } from "../../config.js";
import { handleCheckpoint } from "./steps/checkpoint.js";
import { scanAndSelectPackages } from "./steps/scan-and-select.js";
import { promptTagMessages } from "./steps/tag-messages.js";
import { executeRelease } from "./steps/execute.js";

export const wizardCommand = new Command("release")
  .description("Start the interactive tagman release wizard")
  .action(async () => {
    console.clear();
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser`);

    try {
      const config = await loadConfig();

      const checkpointResult = await handleCheckpoint(config);
      if (!checkpointResult) return;

      let { state, isRecovered, recoveredStep } = checkpointResult;

      const allPackages = await getWorkspacePackages(process.cwd(), config);
      if (allPackages.length === 0) {
        p.log.warn("No valid packages found in this project.");
        p.outro("Bye!");
        return;
      }

      if (!isRecovered) {
        const newState = await scanAndSelectPackages(allPackages, config);
        if (!newState) return;
        state = newState;

        const ok = await promptTagMessages(state);
        if (!ok) return;
      }

      await executeRelease(state, allPackages, config, isRecovered, recoveredStep);
    } catch (err: any) {
      p.log.error(err.message);
      p.outro("Error occurred.");
    }
  });
