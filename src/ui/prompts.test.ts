import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setRunMode, resetRunMode, HeadlessError } from "./mode.js";
import * as ui from "./prompts.js";
import { wizardSelect } from "../commands/wizard/wizard-select.js";
import { commitMultiSelect } from "../commands/wizard/commit-multiselect.js";
import { showScanSummaryPrompt } from "../commands/wizard/scan-summary-prompt.js";
import { showDraftResumePrompt } from "../commands/wizard/draft-resume-prompt.js";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function assertHeadlessRejects(name: string, run: () => Promise<unknown>) {
  await assert.rejects(run, (err: unknown) => {
    assert.ok(err instanceof HeadlessError, `${name}: expected HeadlessError, got ${String(err)}`);
    assert.strictEqual(err.reason, "interaction-required");
    assert.strictEqual(err.exitCode, 2);
    return true;
  });
}

test("prompts in non-interactive mode fail with exit code 2 (#71)", async (t) => {
  setRunMode({ interactive: false, json: false });
  t.after(resetRunMode);

  const cases: [string, () => Promise<unknown>][] = [
    ["confirm",              () => ui.confirm({ message: "Continue?" })],
    ["select",               () => ui.select({ message: "Pick", options: [{ value: "a", label: "A" }] })],
    ["multiselect",          () => ui.multiselect({ message: "Pick", options: [{ value: "a", label: "A" }] })],
    ["text",                 () => ui.text({ message: "Write" })],
    ["wizardSelect",         () => wizardSelect("Pick", [{ value: "a", label: "A" }])],
    ["commitMultiSelect",    () => commitMultiSelect("Commits", [{ value: "abc", label: "abc - fix" }], [])],
    ["showScanSummaryPrompt", () => showScanSummaryPrompt(new Map())],
    ["showDraftResumePrompt", () => showDraftResumePrompt(new Map())],
  ];

  for (const [name, run] of cases) {
    await t.test(name, () => assertHeadlessRejects(name, run));
  }

  await t.test("the error names the question, without ANSI codes", async () => {
    await assert.rejects(
      () => ui.confirm({ message: "\x1b[33mPush\x1b[39m   now?" }),
      (err: HeadlessError) => err.extra?.prompt === "Push now?",
    );
  });
});

/**
 * Architecture guard: every prompt must go through `src/ui/prompts.ts` (or a
 * custom wrapper that calls `assertInteractive`), otherwise a new prompt could
 * silently break headless mode again.
 */
test("no direct clack prompts outside the guarded modules", () => {
  const ALLOWED = new Set(
    [
      "ui/prompts.ts",
      "commands/wizard/wizard-select.ts",
      "commands/wizard/commit-multiselect.ts",
      "commands/wizard/scan-summary-prompt.ts",
      "commands/wizard/draft-resume-prompt.ts",
    ].map((f) => path.join(SRC, f)),
  );
  const DIRECT_CALL = /\bp\.(confirm|select|multiselect|text|password|selectKey|groupMultiselect|autocomplete|autocompleteMultiselect|path)\(/;
  const CORE_PROMPT = /\bnew\s+\w*Prompt\s*[<(]/;

  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!full.endsWith(".ts") || full.endsWith(".test.ts") || ALLOWED.has(full)) continue;
      fs.readFileSync(full, "utf-8").split("\n").forEach((line, i) => {
        const code = line.trimStart();
        if (code.startsWith("//") || code.startsWith("*")) return;
        if (DIRECT_CALL.test(line) || CORE_PROMPT.test(line)) {
          offenders.push(`${path.relative(SRC, full)}:${i + 1}: ${code}`);
        }
      });
    }
  };
  walk(SRC);

  assert.deepStrictEqual(offenders, [], `Use src/ui/prompts.ts instead of calling clack directly:\n${offenders.join("\n")}`);
});
