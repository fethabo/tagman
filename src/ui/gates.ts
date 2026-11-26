/**
 * Pre-release safety gates (#71, design D3). `--yes` accepts the preselected
 * option of ordinary prompts, but these gates are never accepted implicitly:
 * without a human they fail unless an explicit flag allows them.
 *
 * Pure so the decision table is unit-tested independently of git.
 */
export type GateAction = "continue" | "ask" | "fail";

export type GateContext = {
  interactive: boolean;
  allowDirty: boolean;
  allowBehind: boolean;
  requireRemoteSync: boolean;
};

/** Uncommitted local changes. */
export function dirtyTreeGate(ctx: GateContext): GateAction {
  if (ctx.allowDirty) return "continue";
  return ctx.interactive ? "ask" : "fail";
}

/** Branch verified to be behind its remote (an unverified remote never reaches this gate). */
export function behindRemoteGate(ctx: GateContext): GateAction {
  if (ctx.requireRemoteSync) return "fail";
  if (ctx.allowBehind) return "continue";
  return ctx.interactive ? "ask" : "fail";
}

/** A checkpoint from an interrupted release: resuming or rolling back is never automatic. */
export function pendingCheckpointGate(ctx: Pick<GateContext, "interactive">): GateAction {
  return ctx.interactive ? "ask" : "fail";
}
