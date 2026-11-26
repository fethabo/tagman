/**
 * Process-wide run mode (#71). tagman runs a single flow per process, so —like
 * the locale— the mode is set once at the start of each command action and read
 * wherever a decision depends on it, instead of threading `yes` through every
 * step signature (which is how `promptTagMessages` ended up ignoring `--yes`).
 */
export type RunMode = {
  /** false under `--yes` or when stdin is not a TTY: any prompt is an error. */
  interactive: boolean;
  /** `--json`: stdout is reserved for the final JSON document. */
  json: boolean;
};

let mode: RunMode | null = null;

export function setRunMode(next: Partial<RunMode>): void {
  mode = { ...getRunMode(), ...next };
}

export function getRunMode(): RunMode {
  // Safe default when no command initialised it: interactive only with a TTY.
  return mode ?? { interactive: process.stdin.isTTY === true, json: false };
}

/** Reset to the lazy default (tests only). */
export function resetRunMode(): void {
  mode = null;
}

/**
 * A failure inside the release whose details were already shown to the user
 * (e.g. the writing or tagging step logged its error and reverted). Thrown so
 * the process exits non-zero instead of returning as if it had succeeded.
 */
export class ReportedError extends Error {
  readonly alreadyReported = true;
  constructor(message: string) {
    super(message);
    this.name = "ReportedError";
  }
}

/** Stable, locale-independent identifiers for a release that did not complete. */
export type FailureReason =
  | "no-commits"
  | "cancelled"
  | "packages-required"
  | "package-not-found"
  | "dirty-tree"
  | "behind-remote"
  | "pending-checkpoint"
  | "interaction-required"
  | "error";

/**
 * Raised when a flow cannot continue without a human. Thrown only in
 * non-interactive mode; the interactive cancellation contract (return null)
 * is unchanged. `runCommand` turns it into an exit code and, under `--json`,
 * a `{ success: false, reason, message, ...extra }` document.
 */
export class HeadlessError extends Error {
  constructor(
    public readonly reason: FailureReason,
    message: string,
    public readonly exitCode: number = 1,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HeadlessError";
  }
}
