#!/usr/bin/env node
import { Command } from "commander";
import * as p from "@clack/prompts";
import color from "picocolors";
import { wizardCommand } from "./commands/wizard.js";
import { githubReleaseCommand } from "./commands/github-release.js";
import { showMainMenu } from "./commands/menu.js";
import { setLocale, type Locale } from "./i18n/index.js";
import { VERSION } from "./version.js";
import { setRunMode } from "./ui/mode.js";
import { runCommand } from "./ui/run.js";

const program = new Command();

program
  .name("tagman")
  .description("Herramienta CLI interactiva para la gestión de versionado y tagging en monorepos")
  .version(VERSION)
  // Global option: declared only here so it works before or after the
  // subcommand name (`tagman --lang en release` and `tagman release --lang en`).
  .option("--lang <lang>", "Interface language: es | en", "es")
  .hook("preAction", (_thisCommand, actionCommand) => {
    const { lang } = actionCommand.optsWithGlobals<{ lang?: string }>();
    if (lang && ["es", "en"].includes(lang)) {
      setLocale(lang as Locale);
    }
  })
  .action(async () => {
    setRunMode({ interactive: process.stdin.isTTY === true, json: false });
    console.clear();
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser ${color.dim("v" + VERSION)}`);

    await runCommand(() => showMainMenu());
  });

// Pre-built subcommands don't inherit help settings; show the global --lang in their help too
for (const cmd of [wizardCommand, githubReleaseCommand]) {
  cmd.configureHelp({ showGlobalOptions: true });
  program.addCommand(cmd);
}

program.parse(process.argv);
