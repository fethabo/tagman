import * as p from "@clack/prompts";
import { getRunMode, HeadlessError, type FailureReason } from "./mode.js";
import { emitJson } from "./output.js";
import { t } from "../i18n/index.js";

export type ReleasedPackage = {
  name: string;
  previousVersion: string;
  newVersion: string;
  tag: string;
};

/** What a release flow returns when it ends without throwing. */
export type ReleaseOutcome =
  | { success: true; dryRun?: boolean; packages: ReleasedPackage[] }
  | { success: false; reason: Extract<FailureReason, "no-commits" | "cancelled">; message: string };

/**
 * Single exit point of every command action (#71, design D4): turns the flow's
 * outcome or error into the process exit code and, under `--json`, into the
 * one JSON document written to stdout.
 *
 * Exit codes: 0 = released / nothing to release / interactive cancel,
 * 1 = error or failed headless precondition, 2 = interaction was required.
 * Uses `process.exitCode` (not `process.exit()`) so pending output flushes.
 */
export async function runCommand(flow: () => Promise<ReleaseOutcome | void>): Promise<void> {
  const { json } = getRunMode();
  try {
    const outcome = await flow();
    if (json && outcome) emitJson(outcome);
  } catch (err: unknown) {
    const reason: FailureReason = err instanceof HeadlessError ? err.reason : "error";
    const exitCode = err instanceof HeadlessError ? err.exitCode : 1;
    const message = err instanceof Error ? err.message : String(err);
    const extra = err instanceof HeadlessError ? err.extra : undefined;

    if (!(err as { alreadyReported?: boolean })?.alreadyReported) {
      p.log.error(message);
    }
    p.outro(t().wizard.error);

    if (json) emitJson({ success: false, reason, message, ...extra });
    process.exitCode = exitCode;
  }
}
