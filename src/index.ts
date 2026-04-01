#!/usr/bin/env node
import { Command } from "commander";
import { wizardCommand } from "./commands/wizard.js";
import { loadConfig } from "./config.js";
import { initI18n, t } from "./i18n/index.js";

const config = await loadConfig();
initI18n(config.language);

const program = new Command();

program
  .name("tagman")
  .description(t("cmdDescription"))
  .version("1.0.0");

program.addCommand(wizardCommand, { isDefault: true });

program.parse(process.argv);
