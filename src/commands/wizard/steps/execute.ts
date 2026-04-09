import path from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
  updatePackageVersion,
  updateConsumerDependencies,
  appendToChangelog,
  logRelease,
} from "../../../core/updater.js";
import { createReleaseCommit, createAnnotatedTag, deleteLocalTag, resetLastCommit, pushRelease } from "../../../git/index.js";
import { saveCheckpoint, clearCheckpoint, type ReleaseState } from "../../../core/checkpoint.js";
import { getDependents, type WorkspacePackage } from "../../../core/workspace.js";
import type { TagmanConfig } from "../../../config.js";

export type ExecuteOptions = {
  dryRun?: boolean;
  json?: boolean;
  push?: boolean;
  yes?: boolean;
};

function buildTagName(pkgName: string, newVersion: string, config: TagmanConfig): string {
  return config.tagName === "version-only" ? newVersion : `${pkgName}@${newVersion}`;
}

function previewRelease(state: Map<string, ReleaseState>, config: TagmanConfig): void {
  p.log.info("--- DRY RUN: cambios que se aplicarían ---");
  for (const [pkgName, details] of state.entries()) {
    const tagName = buildTagName(pkgName, details.newVersion, config);
    p.log.info(`  ${pkgName}: ${details.pkg.manifest.version} → ${details.newVersion}  (tag: ${tagName})`);
  }
  p.outro("Dry run completado. No se realizaron cambios.");
}

export async function executeRelease(
  state: Map<string, ReleaseState>,
  allPackages: WorkspacePackage[],
  config: TagmanConfig,
  isRecovered: boolean,
  recoveredStep: "writing" | "committing" | null,
  options: ExecuteOptions = {}
): Promise<void> {
  const { dryRun = false, json = false, push = false, yes = false } = options;

  if (dryRun) {
    previewRelease(state, config);
    return;
  }

  if (!isRecovered) {
    if (!yes) {
      const execute = await p.confirm({
        message: "Todo listo. ¿Proceder con la escritura, commits y tags?",
        initialValue: false,
      });

      if (p.isCancel(execute) || !execute) {
        p.cancel("Revertido por el usuario.");
        return;
      }
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

  const createdTags: string[] = [];
  try {
    for (const [pkgName, details] of state.entries()) {
      if (details.tagMessage) {
        const tagName = config.tagName === "version-only"
          ? details.newVersion
          : `${pkgName}@${details.newVersion}`;
        await createAnnotatedTag(tagName, details.tagMessage);
        createdTags.push(tagName);
      }
    }
  } catch (e: any) {
    commitSpinner.stop("Error al crear tags.");
    p.log.error(`Falló la creación de tags: ${e.message}`);
    p.log.warn("Revirtiendo commit y tags ya creados...");
    for (const t of createdTags) {
      try { await deleteLocalTag(t); } catch { /* ignorar */ }
    }
    try { await resetLastCommit(); } catch { /* ignorar */ }
    p.log.error("Se revirtieron los cambios de git. Los archivos quedan modificados en disco.");
    return;
  }

  commitSpinner.stop("Git configurado.");
  await clearCheckpoint();

  let doPush = push;
  if (!push) {
    const shouldPush = await p.confirm({
      message: "¿Subir commits y tags al remoto ahora?",
      initialValue: true,
    });
    doPush = !p.isCancel(shouldPush) && shouldPush;
  }

  if (doPush) {
    const pushSpinner = p.spinner();
    pushSpinner.start("Subiendo al remoto...");
    try {
      await pushRelease();
      pushSpinner.stop("Push completado.");
    } catch (e: any) {
      pushSpinner.stop("Error al hacer push.");
      p.log.error(`git push falló: ${e.message}`);
      p.log.warn("Podés hacerlo manualmente: git push --follow-tags");
    }
  }

  if (json) {
    const output = {
      success: true,
      packages: Array.from(state.entries()).map(([name, d]) => ({
        name,
        previousVersion: d.pkg.manifest.version,
        newVersion: d.newVersion,
        tag: buildTagName(name, d.newVersion, config),
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  p.outro(`${color.green("¡Lanzamiento completado!")} Versiones generadas correctamente.`);
}
