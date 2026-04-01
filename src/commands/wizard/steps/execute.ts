import path from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
  updatePackageVersion,
  updateConsumerDependencies,
  appendToChangelog,
  logRelease,
} from "../../../core/updater.js";
import { createReleaseCommit, createAnnotatedTag } from "../../../git/index.js";
import { saveCheckpoint, clearCheckpoint, type ReleaseState } from "../../../core/checkpoint.js";
import { getDependents, type WorkspacePackage } from "../../../core/workspace.js";
import type { TagmanConfig } from "../../../config.js";

export async function executeRelease(
  state: Map<string, ReleaseState>,
  allPackages: WorkspacePackage[],
  config: TagmanConfig,
  isRecovered: boolean,
  recoveredStep: "writing" | "committing" | null
): Promise<void> {
  if (!isRecovered) {
    const execute = await p.confirm({
      message: "Todo listo. ¿Proceder con la escritura, commits y tags?",
      initialValue: false,
    });

    if (p.isCancel(execute) || !execute) {
      p.cancel("Revertido por el usuario.");
      return;
    }
    await saveCheckpoint("writing", state);
  }

  if (!isRecovered || recoveredStep === "writing") {
    const writingSpinner = p.spinner();
    writingSpinner.start("Escribiendo cambios...");

    const releasedLog: Record<string, string> = {};

    for (const [pkgName, details] of state.entries()) {
      try {
        await updatePackageVersion(details.pkg.dir, details.newVersion);
        await appendToChangelog(pkgName, details.pkg.dir, details.newVersion, details.pkg.manifest.version, details.commits);
        releasedLog[pkgName] = details.newVersion;

        const dependents = getDependents(pkgName, allPackages);
        for (const dep of dependents) {
          if (state.has(dep.manifest.name)) {
            await updateConsumerDependencies(dep.dir, pkgName, details.newVersion);
          }
        }
      } catch (e) {
        writingSpinner.stop("Error actualizando archivos.");
        console.error(e);
        return;
      }
    }

    await logRelease(releasedLog);
    writingSpinner.stop("Archivos actualizados.");
    await saveCheckpoint("committing", state);
  }

  const commitSpinner = p.spinner();
  commitSpinner.start("Creando git commit & tags...");

  const pkgsArray = Array.from(state.keys());
  const commitMsg = `chore(release): [${pkgsArray.join(", ")}]`;

  const filesToCommit = Array.from(state.values()).flatMap(d => [
    path.join(d.pkg.dir, "package.json"),
    path.join(d.pkg.dir, "CHANGELOG.md"),
  ]);

  await createReleaseCommit(filesToCommit, commitMsg);

  for (const [pkgName, details] of state.entries()) {
    if (details.tagMessage) {
      const tagName = config.tagName === "version-only"
        ? details.newVersion
        : `${pkgName}@${details.newVersion}`;
      await createAnnotatedTag(tagName, details.tagMessage);
    }
  }

  commitSpinner.stop("Git configurado.");
  await clearCheckpoint();

  p.outro(`${color.green("¡Lanzamiento completado!")} Versiones generadas correctamente.`);
}
