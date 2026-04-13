import * as p from "@clack/prompts";
import color from "picocolors";
import { hasUncommittedChanges, deleteLocalTag, resetLastCommit, git } from "../../../git/index.js";
import { t } from "../../../i18n/index.js";
import { loadCheckpoint, clearCheckpoint, type ReleaseState } from "../../../core/checkpoint.js";
import { getWorkspacePackages, getDependents } from "../../../core/workspace.js";
import {
  rollbackPackageVersion,
  rollbackConsumerDependencies,
  rollbackChangelog,
} from "../../../core/updater.js";
import type { TagmanConfig } from "../../../config.js";

export type CheckpointResult = {
  state: Map<string, ReleaseState>;
  isRecovered: boolean;
  recoveredStep: "writing" | "committing" | null;
};

export async function handleCheckpoint(config: TagmanConfig): Promise<CheckpointResult | null> {
  if (await hasUncommittedChanges()) {
    const proceed = await p.confirm({
      message: `${color.yellow(t().checkpoint.uncommittedWarning)} ${t().checkpoint.uncommittedQuestion}`,
      initialValue: false,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel(t().checkpoint.cancelled);
      return null;
    }
  }

  let state: Map<string, ReleaseState> = new Map();
  let isRecovered = false;
  let recoveredStep: "writing" | "committing" | null = null;

  const checkpoint = await loadCheckpoint();
  if (checkpoint) {
    const resume = await p.confirm({
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
      const doRollback = await p.confirm({
        message: t().checkpoint.rollbackQuestion,
        initialValue: true,
      });

      if (!p.isCancel(doRollback) && doRollback) {
        const rbSpinner = p.spinner();
        rbSpinner.start(t().checkpoint.rollingBack);

        const currentWorkspace = await getWorkspacePackages(process.cwd(), config);
        const rbState = new Map(checkpoint.state);

        for (const [pkgName, details] of rbState.entries()) {
          try {
            await rollbackPackageVersion(details.pkg.dir, details.pkg.manifest.version);
            await rollbackChangelog(details.pkg.dir, details.newVersion);

            const dependents = getDependents(pkgName, currentWorkspace);
            for (const dep of dependents) {
              if (rbState.has(dep.manifest.name)) {
                await rollbackConsumerDependencies(dep.dir, pkgName, details.pkg.manifest.version);
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
            const pkgsArray = Array.from(rbState.keys());
            const expectedMsg = `chore(release): [${pkgsArray.join(", ")}]`;
            if (log.latest?.message === expectedMsg) {
              await resetLastCommit();
            }
            // Eliminar tags que pudieron haberse creado parcialmente
            for (const [pkgName, details] of rbState.entries()) {
              const tagName = config.tagName === "version-only"
                ? details.newVersion
                : `${pkgName}@${details.newVersion}`;
              try { await deleteLocalTag(tagName); } catch { /* el tag puede no existir */ }
            }
          } catch {
            p.log.warn(t().checkpoint.rollbackGitWarn);
          }
        }

        rbSpinner.stop(t().checkpoint.rollbackDone);
      }

      await clearCheckpoint();
    }
  }

  return { state, isRecovered, recoveredStep };
}
