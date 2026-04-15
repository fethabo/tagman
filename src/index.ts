#!/usr/bin/env node
import { Command } from "commander";
import * as p from "@clack/prompts";
import color from "picocolors";
import { wizardCommand } from "./commands/wizard.js";
import { githubReleaseCommand } from "./commands/github-release.js";
import { showMainMenu } from "./commands/menu.js";
import { setLocale, type Locale } from "./i18n/index.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("tagman")
  .description("Herramienta CLI interactiva para la gestión de versionado y tagging en monorepos")
  .version(VERSION)
  .option("--lang <lang>", "Interface language: es | en", "es")
  .action(async (options: { lang: string }) => {
    if (["es", "en"].includes(options.lang)) {
      setLocale(options.lang as Locale);
    }

    console.clear();
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser ${color.dim("v" + VERSION)}`);

    await showMainMenu();
  });

program.addCommand(wizardCommand);
program.addCommand(githubReleaseCommand);

program.parse(process.argv);
