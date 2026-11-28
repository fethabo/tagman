import * as p from "@clack/prompts";
import * as ui from "../../../ui/prompts.js";
import color from "picocolors";
import { hasUncommittedChanges, deleteLocalTag, resetLastCommit, checkRemoteSync, getGitHubRemoteInfo, git } from "../../../git/index.js";
import { resolveGithubToken } from "../../../core/token.js";
import { t } from "../../../i18n/index.js";
import { loadCheckpoint, clearCheckpoint, buildReleaseCommitMessage, type ReleaseState } from "../../../core/checkpoint.js";
import { getWorkspacePackages, getDependents } from "../../../core/workspace.js";
import {
  rollbackPackageVersion,
  restoreConsumerDependencies,
  rollbackChangelog,
} from "../../../core/updater.js";
import type { TagmanConfig } from "../../../config.js";
import { formatTag } from "../../../core/tag-scheme.js";
import { getRunMode, HeadlessError } from "../../../ui/mode.js";
import { dirtyTreeGate, behindRemoteGate, pendingCheckpointGate, type GateContext } from "../../../ui/gates.js";

export type PreflightOptions = {
  /** --allow-dirty: continue with uncommitted local changes without asking. */
  allowDirty?: boolean;
  /** --allow-behind: continue when the branch is behind its remote without asking. */
  allowBehind?: boolean;
};

export type CheckpointResult = {
  state: Map<string, ReleaseState>;
  isRecovered: boolean;
  recoveredStep: "writing" | "committing" | null;
};

export async function handleCheckpoint(
  config: TagmanConfig,
  preflight: PreflightOptions = {},
): Promise<CheckpointResult | null> {
  const gateCtx: GateContext = {
    interactive: getRunMode().interactive,
    allowDirty: preflight.allowDirty ?? false,
    allowBehind: preflight.allowBehind ?? false,
    requireRemoteSync: config.requireRemoteSync ?? false,
  };

  // Headless: an interrupted release is checked first — its partial writes make
  // the tree dirty, and "dirty-tree" would hide the real cause (#71).
  const pending = await loadCheckpoint();
  if (pending && pendingCheckpointGate(gateCtx) === "fail") {
    throw new HeadlessError("pending-checkpoint", t().headless.pendingCheckpoint(pending.step), 1, { step: pending.step });
  }

  if (await hasUncommittedChanges()) {
    const action = dirtyTreeGate(gateCtx);
    if (action === "fail") throw new HeadlessError("dirty-tree", t().headless.dirtyTree, 1);
    if (action === "continue") {
      p.log.warn(t().headless.dirtyAllowed);
    } else {
      const proceed = await ui.confirm({
        message: `${color.yellow(t().checkpoint.uncommittedWarning)} ${t().checkpoint.uncommittedQuestion}`,
        initialValue: false,
      });
      if (p.isCancel(proceed) || !proceed) {
        p.cancel(t().checkpoint.cancelled);
        return null;
      }
    }
  }

  // Lazy read-path auth: only resolve a token (no interactive login) when the
  // remote is HTTPS+GitHub, so the sync check can authenticate without hanging
  // and without forcing a device-flow login just for a read-only verification.
  const ghInfo = await getGitHubRemoteInfo();
  const syncToken = ghInfo?.protocol === "https"
    ? await resolveGithubToken(config.github?.token)
    : null;

  const syncSpinner = p.spinner();
  syncSpinner.start(t().checkpoint.fetchingRemote);
  const sync = await checkRemoteSync(syncToken);
  syncSpinner.stop("");

  if (sync.status === "unverified") {
    const reasonMap: Record<typeof sync.reason, string> = {
      "no-remote": t().checkpoint.remoteUnverifiedError,
      timeout: t().checkpoint.remoteUnverifiedTimeout,
      auth: t().checkpoint.remoteUnverifiedAuth,
      error: t().checkpoint.remoteUnverifiedError,
    };
    p.log.warn(t().checkpoint.remoteUnverified(reasonMap[sync.reason]));
  } else if (sync.behind > 0) {
    const action = behindRemoteGate(gateCtx);
    if (action === "fail" && !gateCtx.interactive) {
      const message = config.requireRemoteSync
        ? `${t().checkpoint.behindRemote(sync.behind)} ${t().checkpoint.behindBlocked}`
        : t().headless.behindRemote(sync.behind);
      throw new HeadlessError("behind-remote", message, 1, { behind: sync.behind });
    }
    if (action === "fail") {
      p.log.error(t().checkpoint.behindRemote(sync.behind));
      p.cancel(t().checkpoint.behindBlocked);
      return null;
    }
    if (action === "continue") {
      p.log.warn(t().headless.behindAllowed(sync.behind));
    } else {
      const proceed = await ui.confirm({
        message: `${color.yellow(t().checkpoint.behindRemote(sync.behind))} ${t().checkpoint.behindQuestion}`,
        initialValue: false,
      });
      if (p.isCancel(proceed) || !proceed) {
        p.cancel(t().checkpoint.cancelled);
        return null;
      }
    }
  }

  let state: Map<string, ReleaseState> = new Map();
  let isRecovered = false;
  let recoveredStep: "writing" | "committing" | null = null;

  const checkpoint = pending;
  if (checkpoint) {
    const resume = await ui.confirm({
      message: t().checkpoint.interruptedRelease(checkpoint.step),
      initialValue: true,
    });

    if (p.isCancel(resume)) {
      p.cancel(t().checkpoint.cancelled);
      return null;
    }

    if (resume) {
      state = new Map(checkpoint.state);
      isRecovered = true;
      recoveredStep = checkpoint.step;
    } else {
      const doRollback = await ui.confirm({
        message: t().checkpoint.rollbackQuestion,
        initialValue: true,
      });

      if (!p.isCancel(doRollback) && doRollback) {
        const rbSpinner = p.spinner();
        rbSpinner.start(t().checkpoint.rollingBack);

        const rbState = new Map(checkpoint.state);

        if (checkpoint.origHead) {
          // Reorder release: the `reset --hard HEAD~N` already ran, so a
          // file-by-file rollback would lose the reordered commits. Delete any
          // partially-created tags, then hard-reset to the original HEAD — this
          // restores the reordered commits and discards all writes in one step.
          for (const [pkgName, details] of rbState.entries()) {
            const tagName = formatTag(pkgName, details.newVersion, config.tagName);
            try { await deleteLocalTag(tagName); } catch { /* el tag puede no existir */ }
          }
          try {
            await git.raw(["reset", "--hard", checkpoint.origHead]);
          } catch {
            p.log.warn(t().checkpoint.rollbackGitWarn);
          }
        } else {
          const currentWorkspace = await getWorkspacePackages(process.cwd(), config);

          for (const [pkgName, details] of rbState.entries()) {
            try {
              await rollbackPackageVersion(details.pkg.dir, details.pkg.manifest.version);
              await rollbackChangelog(details.pkg.dir, details.newVersion);

              const dependents = getDependents(pkgName, currentWorkspace);
              for (const dep of dependents) {
                const consumerState = rbState.get(dep.manifest.name);
                if (consumerState) {
                  await restoreConsumerDependencies(dep.dir, pkgName, consumerState.pkg.manifest);
                }
              }
            } catch {
              // Ignore errors as files could be locally modified
            }
          }

          // Si el checkpoint es "committing", el commit de git pudo haberse creado
          if (checkpoint.step === "committing") {
            try {
              // Verificar que el último commit sea el de tagman antes de resetearlo
              const log = await git.log(["-1"]);
              const expectedMsg = buildReleaseCommitMessage(rbState);
              if (log.latest?.message === expectedMsg) {
                await resetLastCommit();
              }
              // Eliminar tags que pudieron haberse creado parcialmente
              for (const [pkgName, details] of rbState.entries()) {
                const tagName = formatTag(pkgName, details.newVersion, config.tagName);
                try { await deleteLocalTag(tagName); } catch { /* el tag puede no existir */ }
              }
            } catch {
              p.log.warn(t().checkpoint.rollbackGitWarn);
            }
          }
        }

        rbSpinner.stop(t().checkpoint.rollbackDone);
      }

      await clearCheckpoint();
    }
  }

  return { state, isRecovered, recoveredStep };
}
