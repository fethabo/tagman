#!/usr/bin/env node
import { Command } from "commander";
import { wizardCommand } from "./commands/wizard.js";

const program = new Command();

program
  .name("tagman")
  .description("Herramienta CLI interactiva para la gestión de versionado y tagging en monorepos")
  .version("1.0.0");

program.addCommand(wizardCommand, { isDefault: true });

program.parse(process.argv);
