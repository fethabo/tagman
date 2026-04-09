import * as p from "@clack/prompts";
import color from "picocolors";
import { hasUncommittedChanges } from "../../../git/index.js";
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
      message: `${color.yellow("Advertencia:")} Tienes cambios locales sin commitear. ¿Deseas continuar de todas formas?`,
      initialValue: false,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel("Operación cancelada.");
      return null;
    }
  }

  let state: Map<string, ReleaseState> = new Map();
  let isRecovered = false;
  let recoveredStep: "writing" | "committing" | null = null;

  const checkpoint = await loadCheckpoint();
  if (checkpoint) {
    const resume = await p.confirm({
      message: `Se encontró un lanzamiento interrumpido en la fase "${checkpoint.step}". ¿Deseas retomarlo?`,
      initialValue: true,
    });

    if (p.isCancel(resume)) {
      p.cancel("Operación cancelada.");
      return null;
    }

    if (resume) {
      state = new Map(checkpoint.state);
      isRecovered = true;
      recoveredStep = checkpoint.step;
    } else {
      const doRollback = await p.confirm({
        message: "¿Deseas revertir los cambios locales en package.json y CHANGELOG.md que tagman alcanzó a hacer?",
        initialValue: true,
      });

      if (!p.isCancel(doRollback) && doRollback) {
        const rbSpinner = p.spinner();
        rbSpinner.start("Revirtiendo archivos al estado pre-release...");

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

        rbSpinner.stop("Rollback completado. Archivos revertidos adecuadamente.");
      }

      await clearCheckpoint();
    }
  }

  return { state, isRecovered, recoveredStep };
}
