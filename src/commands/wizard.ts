import { Command } from "commander";
import * as p from "@clack/prompts";
import path from "node:path";
import color from "picocolors";
import { getWorkspacePackages, WorkspacePackage, getDependents } from "../core/workspace.js";
import { getCommitsForPath, getLastTagForPackage, createReleaseCommit, createAnnotatedTag, hasUncommittedChanges } from "../git/index.js";
import { suggestBump } from "../core/commits.js";
import { updatePackageVersion, updateConsumerDependencies, appendToChangelog, logRelease, rollbackPackageVersion, rollbackConsumerDependencies, rollbackChangelog, getRepositoryBaseUrl, formatCommitList } from "../core/updater.js";
import { loadCheckpoint, saveCheckpoint, clearCheckpoint, ReleaseState } from "../core/checkpoint.js";
import semver from "semver";

export const wizardCommand = new Command("release")
  .description("Start the interactive tagman release wizard")
  .action(async () => {
    console.clear();
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser`);

    try {
      if (await hasUncommittedChanges()) {
        const proceed = await p.confirm({
          message: `${color.yellow("Advertencia:")} Tienes cambios locales sin commitear. ¿Deseas continuar de todas formas?`,
          initialValue: false,
        });
        if (p.isCancel(proceed) || !proceed) {
          p.cancel("Operación cancelada.");
          return;
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
          return;
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
             
             const currentWorkspace = await getWorkspacePackages();
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
                } catch (e) {
                  // Ignore exact errors as files could be locally modified
                }
             }
             rbSpinner.stop("Rollback completado. Archivos revertidos adecuadamente.");
          }
          await clearCheckpoint();
        }
      }

      const allPackages = await getWorkspacePackages();
      if (allPackages.length === 0) {
        p.log.warn("No valid packages found in this project.");
        p.outro("Bye!");
        return;
      }

      if (!isRecovered) {
        const packagesWithCommits: { pkg: WorkspacePackage, commits: import("../git/index.js").CommitInfo[], lastTag: string | null }[] = [];

        const spinner = p.spinner();
        spinner.start("Scanning packages for new commits...");

      for (const pkg of allPackages) {
        const lastTag = await getLastTagForPackage(pkg.manifest.name);
        const commits = await getCommitsForPath(pkg.dir, lastTag);
        if (commits.length > 0) {
          packagesWithCommits.push({ pkg, commits, lastTag });
        }
      }

      spinner.stop(`Scanned ${allPackages.length} packages. Found ${packagesWithCommits.length} with pending changes.`);

      if (packagesWithCommits.length === 0) {
        p.outro("No new commits found in any package. Nothing to release.");
        return;
      }

      // Step 1: Select packages
      const selectedPkgNames = await p.multiselect({
        message: "Step 1: Select packages to release",
        options: packagesWithCommits.map(p => ({
          value: p.pkg.manifest.name,
          label: `${p.pkg.manifest.name} (${p.commits.length} commits)`
        })),
        required: true,
      });

      if (p.isCancel(selectedPkgNames)) {
        p.cancel("Operation cancelled.");
        return;
      }

      // For processing queue
      const queue = [...selectedPkgNames as string[]];

      // Process each package in the queue
      const processed = new Set<string>();

      while (queue.length > 0) {
        const pkgName = queue.shift()!;
        if (processed.has(pkgName)) continue;
        processed.add(pkgName);

        const pkgInfo = packagesWithCommits.find(p => p.pkg.manifest.name === pkgName);
        if (!pkgInfo) continue; // For cascaded packages without their own changes, we might need a different handling

        // Step 2: Commits Selection
        const selectedCommitHashes = await p.multiselect({
          message: `Step 2: Commits for ${color.cyan(pkgName)}`,
          options: pkgInfo.commits.map(c => ({
            value: c.hash,
            label: `${c.hash.substring(0, 7)} - ${c.message}`
          })),
          initialValues: pkgInfo.commits.map(c => c.hash), // Select all by default
          required: true,
        });

        if (p.isCancel(selectedCommitHashes)) {
           p.cancel("Operation cancelled.");
           return;
        }

        const chosenCommits = pkgInfo.commits.filter(c => (selectedCommitHashes as string[]).includes(c.hash));
        
        // Step 3: Version Bump
        const suggested = suggestBump(chosenCommits.map(c => c.message));
        
        const bump = await p.select({
          message: `Step 3: Version increment for ${color.cyan(pkgName)} (Current: ${pkgInfo.pkg.manifest.version})`,
          options: [
            { value: "patch", label: `Patch (${semver.inc(pkgInfo.pkg.manifest.version, "patch")})`, hint: suggested === "patch" ? "suggested" : undefined },
            { value: "minor", label: `Minor (${semver.inc(pkgInfo.pkg.manifest.version, "minor")})`, hint: suggested === "minor" ? "suggested" : undefined },
            { value: "major", label: `Major (${semver.inc(pkgInfo.pkg.manifest.version, "major")})`, hint: suggested === "major" ? "suggested" : undefined },
            { value: "none", label: `No incrementar (solo Git Tag: ${pkgInfo.pkg.manifest.version})` },
            { value: "custom", label: `Definir una versión específica...` }
          ],
          initialValue: suggested,
        });

        if (p.isCancel(bump)) {
          p.cancel("Operation cancelled.");
          return;
        }

        let newVersion: string;
        if (bump === "none") {
           newVersion = pkgInfo.pkg.manifest.version;
        } else if (bump === "custom") {
           const customV = await p.text({
             message: `Escribe la nueva versión exacta (SemVer) para ${pkgName}:`,
             validate: (val) => {
               if (!semver.valid(val)) return "Error: debe ser una versión SemVer válida (ej: 1.2.3)";
             }
           });
           if (p.isCancel(customV)) {
             p.cancel("Operation cancelled.");
             return;
           }
           newVersion = semver.clean(customV as string)!;
        } else {
           newVersion = semver.inc(pkgInfo.pkg.manifest.version, bump as semver.ReleaseType)!;
        }

        // Step 4: Cascade analysis
        const dependents = getDependents(pkgName, allPackages);
        if (dependents.length > 0) {
          for (const dep of dependents) {
             const cascade = await p.confirm({
                message: `Aviso: ${color.cyan(pkgName)} es dependencia de ${color.yellow(dep.manifest.name)}. ¿Deseas versionar también ${color.yellow(dep.manifest.name)} para actualizar su referencia?`,
                initialValue: true,
             });
             
             if (p.isCancel(cascade)) {
                p.cancel("Operation cancelled.");
                return;
             }

             if (cascade) {
                // Determine if dep already in queue or state.
                if (!processed.has(dep.manifest.name) && !queue.includes(dep.manifest.name)) {
                  queue.push(dep.manifest.name);
                 
                  // Ensure pkgInfo has it even if no commits natively
                  if (!packagesWithCommits.find(p => p.pkg.manifest.name === dep.manifest.name)) {
                     packagesWithCommits.push({
                        pkg: dep,
                        commits: [{ hash: "cascade", message: `chore: update dependency ${pkgName} to ${newVersion}`, body: "", author_name: "tagman" }],
                        lastTag: null
                     });
                  } else {
                     // Add the chore message to its commits
                     const existing = packagesWithCommits.find(p => p.pkg.manifest.name === dep.manifest.name)!;
                     existing.commits.unshift({ hash: "cascade", message: `chore: update dependency ${pkgName} to ${newVersion}`, body: "", author_name: "tagman" });
                  }
                }
             }
          }
        }

        // Generate default tag message
        const baseUrl = await getRepositoryBaseUrl();
        const { items } = formatCommitList(chosenCommits, baseUrl);
        
        let defaultTagMsg = `Release ${pkgName}@${newVersion}\n\n` + items.join("\n");

        state.set(pkgName, {
           pkg: pkgInfo.pkg,
           commits: chosenCommits,
           bump: bump as "patch" | "minor" | "major" | "none" | "custom",
           newVersion,
           tagMessage: defaultTagMsg
        });
      }

      // Step 5: Tags and Changelog Message
      for (const [pkgName, details] of state.entries()) {
         const createTag = await p.confirm({
            message: `¿Crear tag de Git para ${color.cyan(pkgName)}@${color.green(details.newVersion)}?`,
            initialValue: true,
         });

         if (p.isCancel(createTag)) {
           p.cancel("Operation cancelled.");
           return;
         }

         if (createTag) {
           p.note(details.tagMessage, `Mensaje autogenerado para ${pkgName}`);
           
           const msgAction = await p.select({
              message: "¿Qué mensaje deseas usar para el tag?",
              options: [
                 { value: "auto", label: "Usar el mensaje autogenerado" },
                 { value: "append", label: "Agregar texto adicional al autogenerado" },
                 { value: "custom", label: "Escribir un mensaje completamente nuevo" }
              ]
           });

           if (p.isCancel(msgAction)) {
              p.cancel("Operation cancelled.");
              return;
           }

           if (msgAction === "auto") {
              state.get(pkgName)!.tagMessage = details.tagMessage;
           } else if (msgAction === "append") {
              const appendedMsg = await p.text({ message: "Texto adicional:" });
              if (p.isCancel(appendedMsg)) {
                 p.cancel("Operation cancelled.");
                 return;
              }
              
              const position = await p.select({
                 message: "¿Dónde deseas insertar este texto?",
                 options: [
                    { value: "before", label: "Antes del listado de commits" },
                    { value: "after", label: "Al final del mensaje" }
                 ]
              });

              if (p.isCancel(position)) {
                 p.cancel("Operation cancelled.");
                 return;
              }

              if (position === "before") {
                 state.get(pkgName)!.tagMessage = details.tagMessage.replace("\n\n", `\n\n${appendedMsg as string}\n\n`);
              } else {
                 state.get(pkgName)!.tagMessage = details.tagMessage + "\n\n" + (appendedMsg as string);
              }
           } else if (msgAction === "custom") {
              const customMsg = await p.text({ message: "Nuevo mensaje para el tag:" });
              if (p.isCancel(customMsg)) {
                 p.cancel("Operation cancelled.");
                 return;
              }
              state.get(pkgName)!.tagMessage = customMsg as string;
           }
         } else {
           state.get(pkgName)!.tagMessage = ""; // Empty string implies no tag
         }
      }
      }

      // Execution Phase Confirm
      if (!isRecovered) {
        const execute = await p.confirm({
           message: "Todo listo. ¿Proceder con la escritura, commits y tags?",
           initialValue: false, // Control is key!
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

           // Update consumers dependencies
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

      // Prepare release commit
      const pkgsArray = Array.from(state.keys());
      const commitMsg = `chore(release): [${pkgsArray.join(", ")}]`;
      
      // Select files to commit: all package.json and CHANGELOG.md in state dirs
      const filesToCommit = Array.from(state.values()).flatMap(d => [
         path.join(d.pkg.dir, "package.json"),
         path.join(d.pkg.dir, "CHANGELOG.md")
      ]);
      
      await createReleaseCommit(filesToCommit, commitMsg);

      for (const [pkgName, details] of state.entries()) {
         if (details.tagMessage) {
            const tagName = `${pkgName}@${details.newVersion}`;
            await createAnnotatedTag(tagName, details.tagMessage);
         }
      }

      commitSpinner.stop("Git configurado.");
      await clearCheckpoint();

      p.outro(`${color.green("¡Lanzamiento completado!")} Versiones generadas correctamente.`);

    } catch (err: any) {
      p.log.error(err.message);
      p.outro("Error occurred.");
    }
  });
