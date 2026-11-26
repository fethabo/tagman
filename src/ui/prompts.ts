import * as p from "@clack/prompts";
import type { ConfirmOptions, MultiSelectOptions, SelectOptions, TextOptions } from "@clack/prompts";
import { stripVTControlCharacters } from "node:util";
import { getRunMode, HeadlessError } from "./mode.js";
import { t } from "../i18n/index.js";

/**
 * Single gate every prompt goes through (#71). In non-interactive mode
 * (`--yes` or stdin without a TTY) reaching a prompt is a bug in the headless
 * resolution of that step, so instead of letting clack resolve it as "cancel"
 * (which used to end the process silently with exit 0) it fails loudly with
 * exit code 2 and names the question that needed an answer.
 *
 * Prompts must not call clack directly outside `src/ui/` and the custom
 * prompt wrappers; `prompts.test.ts` enforces it.
 */
export function assertInteractive(message: string): void {
  if (getRunMode().interactive) return;
  const prompt = stripVTControlCharacters(message).replace(/\s+/g, " ").trim();
  throw new HeadlessError("interaction-required", t().headless.interactionRequired(prompt), 2, { prompt });
}

export async function confirm(opts: ConfirmOptions): Promise<boolean | symbol> {
  assertInteractive(opts.message);
  return p.confirm(opts);
}

export async function select<Value>(opts: SelectOptions<Value>): Promise<Value | symbol> {
  assertInteractive(opts.message);
  return p.select(opts);
}

export async function multiselect<Value>(opts: MultiSelectOptions<Value>): Promise<Value[] | symbol> {
  assertInteractive(opts.message);
  return p.multiselect(opts);
}

export async function text(opts: TextOptions): Promise<string | symbol> {
  assertInteractive(opts.message);
  return p.text(opts);
}
