import { Command } from "commander";
import * as p from "@clack/prompts";
import { MultiSelectPrompt, wrapTextWithPrefix } from "@clack/core";
import path from "node:path";
import color from "picocolors";
import { getWorkspacePackages, WorkspacePackage, getDependents } from "../core/workspace.js";
import { getCommitsForPath, getLastTagForPackage, createReleaseCommit, createAnnotatedTag, hasUncommittedChanges } from "../git/index.js";
import { suggestBump } from "../core/commits.js";
import { updatePackageVersion, updateConsumerDependencies, appendToChangelog, logRelease, rollbackPackageVersion, rollbackConsumerDependencies, rollbackChangelog, getRepositoryBaseUrl, formatCommitList } from "../core/updater.js";
import { loadCheckpoint, saveCheckpoint, clearCheckpoint, ReleaseState } from "../core/checkpoint.js";
import { loadConfig } from "../config.js";
import { initI18n, t } from "../i18n/index.js";
import semver from "semver";

type CommitOpt = { value: string; label: string };

/**
 * Interactive multiselect for commits.
 * "Select All" and "Deselect All" update the selection in real-time without
 * reopening the prompt — achieved by subscribing a cursor event handler on the
 * MultiSelectPrompt instance after construction (fires after the built-in
 * toggleValue handler, then corrects this.value for the two control items).
 */
async function commitMultiSelect(
  message: string,
  options: CommitOpt[],
  initialValues: string[]
): Promise<string[] | symbol> {
  const SELECT_ALL = '__tagman_select_all__';
  const DESELECT_ALL = '__tagman_deselect_all__';
  const commitValues = options.map(o => o.value);

  const allOptions: CommitOpt[] = [
    { value: SELECT_ALL,   label: `${color.green('◆')} ${t("selectAll")}`   },
    { value: DESELECT_ALL, label: `${color.yellow('◇')} ${t("deselectAll")}` },
    ...options,
  ];

  const styleOpt = (opt: CommitOpt, isActive: boolean, val: string[]) => {
    const label = opt.label;
    const selected = val.includes(opt.value);
    if (isActive && selected) return `${color.green(p.S_CHECKBOX_SELECTED)} ${label}`;
    if (selected)             return `${color.dim(p.S_CHECKBOX_SELECTED)} ${color.dim(label)}`;
    if (isActive)             return `${color.cyan(p.S_CHECKBOX_ACTIVE)} ${label}`;
    return                        `${color.dim(p.S_CHECKBOX_INACTIVE)} ${color.dim(label)}`;
  };

  const prompt = new MultiSelectPrompt<CommitOpt>({
    options: allOptions,
    initialValues,
    validate(value) {
      const real = (value ?? []).filter(v => v !== SELECT_ALL && v !== DESELECT_ALL);
      if (real.length === 0) return t("selectAtLeastOneCommit");
    },
    render() {
      const val: string[]  = (this as any).value ?? [];
      const cursor: number = (this as any).cursor;
      const bar    = `${color.cyan(p.S_BAR)}  `;
      const msgLine = wrapTextWithPrefix(
        process.stdout,
        message,
        `${p.symbolBar(this.state)}  `,
        `${p.symbol(this.state)}  `
      );
      const header   = `${color.gray(p.S_BAR)}  ${msgLine}\n`;
      const style    = (opt: CommitOpt, active: boolean) => styleOpt(opt, active, val);
      const rowCount = header.split('\n').length;

      switch (this.state) {
        case 'submit': {
          const chosen = allOptions
            .filter(o => val.includes(o.value))
            .map(o => color.dim(o.label))
            .join(color.dim(', ')) || color.dim('none');
          return `${header}${color.gray(p.S_BAR)}  ${chosen}\n`;
        }
        case 'cancel':
          return `${header}${color.gray(p.S_BAR)}\n`;
        case 'error': {
          const eBar  = `${color.yellow(p.S_BAR)}  `;
          const items = p.limitOptions({ cursor, options: allOptions, columnPadding: eBar.length, rowPadding: rowCount + 3, style });
          return `${header}${eBar}${items.join(`\n${eBar}`)}\n${color.yellow(p.S_BAR_END)}  ${color.yellow(this.error)}\n`;
        }
        default: {
          const items = p.limitOptions({ cursor, options: allOptions, columnPadding: bar.length, rowPadding: rowCount + 2, style });
          return `${header}${bar}${items.join(`\n${bar}`)}\n${color.cyan(p.S_BAR_END)}\n`;
        }
      }
    },
  });

  // Add our cursor event listener AFTER construction so it fires after the
  // built-in handler (which calls toggleValue). We then correct this.value for
  // the two control items so they never appear in the final selection.
  (prompt as any).on('cursor', (action: string) => {
    if (action !== 'space') return;
    const cursor: number = (prompt as any).cursor;
    const current = allOptions[cursor]?.value;
    if (current === SELECT_ALL) {
      (prompt as any).value = commitValues.slice();
    } else if (current === DESELECT_ALL) {
      (prompt as any).value = [];
    } else {
      (prompt as any).value = ((prompt as any).value ?? []).filter(
        (v: string) => v !== SELECT_ALL && v !== DESELECT_ALL
      );
    }
  });

  const result = await (prompt as any).prompt();
  if (p.isCancel(result)) return result;
  return (result as string[]).filter(v => v !== SELECT_ALL && v !== DESELECT_ALL);
}

export const wizardCommand = new Command("release")
  .description("Start the interactive tagman release wizard")
  .action(async () => {
    console.clear();
    p.intro(`${color.bgCyan(color.black(" tagman "))} Releaser`);

    try {
      const config = await loadConfig();
      initI18n(config.language);

      if (await hasUncommittedChanges()) {
        const proceed = await p.confirm({
          message: t("uncommittedWarning"),
          initialValue: false,
        });
        if (p.isCancel(proceed) || !proceed) {
          p.cancel(t("operationCancelled"));
          return;
        }
      }

      let state: Map<string, ReleaseState> = new Map();
      let isRecovered = false;
      let recoveredStep: "writing" | "committing" | null = null;

      const checkpoint = await loadCheckpoint();
      if (checkpoint) {
        const resume = await p.confirm({
          message: t("checkpointFound", { step: checkpoint.step }),
          initialValue: true,
        });

        if (p.isCancel(resume)) {
          p.cancel(t("operationCancelled"));
          return;
        }

        if (resume) {
          state = new Map(checkpoint.state);
          isRecovered = true;
          recoveredStep = checkpoint.step;
        } else {
          const doRollback = await p.confirm({
             message: t("checkpointRollbackPrompt"),
             initialValue: true,
          });

          if (!p.isCancel(doRollback) && doRollback) {
             const rbSpinner = p.spinner();
             rbSpinner.start(t("checkpointRollingBack"));
             
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
                } catch (e) {
                  // Ignore exact errors as files could be locally modified
                }
             }
             rbSpinner.stop(t("checkpointRollbackDone"));
          }
          await clearCheckpoint();
        }
      }

      const allPackages = await getWorkspacePackages(process.cwd(), config);
      if (allPackages.length === 0) {
        p.log.warn(t("noValidPackages"));
        p.outro(t("bye"));
        return;
      }

      if (!isRecovered) {
        const packagesWithCommits: { pkg: WorkspacePackage, commits: import("../git/index.js").CommitInfo[], lastTag: string | null }[] = [];

        const spinner = p.spinner();
        spinner.start(t("scanningPackages"));

      for (const pkg of allPackages) {
        const lastTag = await getLastTagForPackage(pkg.manifest.name);
        const commits = await getCommitsForPath(pkg.dir, lastTag);
        if (commits.length > 0) {
          packagesWithCommits.push({ pkg, commits, lastTag });
        }
      }

      spinner.stop(t("scannedPackages", { total: String(allPackages.length), found: String(packagesWithCommits.length) }));

      if (packagesWithCommits.length === 0) {
        p.outro(t("noNewCommits"));
        return;
      }

      // Step 1: Select packages
      const selectedPkgNames = await p.multiselect({
        message: t("step1Message"),
        options: packagesWithCommits.map(p => ({
          value: p.pkg.manifest.name,
          label: t("step1PkgLabel", { name: p.pkg.manifest.name, count: String(p.commits.length) })
        })),
        required: true,
      });

      if (p.isCancel(selectedPkgNames)) {
        p.cancel(t("operationCancelled"));
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
        const selectedCommitHashes = await commitMultiSelect(
          t("step2Message", { pkgName: color.cyan(pkgName) }),
          pkgInfo.commits.map(c => ({ value: c.hash, label: `${c.hash.substring(0, 7)} - ${c.message}` })),
          pkgInfo.commits.map(c => c.hash)
        );

        if (p.isCancel(selectedCommitHashes)) {
          p.cancel(t("operationCancelled"));
          return;
        }

        const chosenCommits = pkgInfo.commits.filter(c => (selectedCommitHashes as string[]).includes(c.hash));
        
        // Step 3: Version Bump
        const suggested = suggestBump(chosenCommits.map(c => c.message));
        
        const bump = await p.select({
          message: t("step3Message", { pkgName: color.cyan(pkgName), version: pkgInfo.pkg.manifest.version }),
          options: [
            { value: "patch", label: `Patch (${semver.inc(pkgInfo.pkg.manifest.version, "patch")})`, hint: suggested === "patch" ? t("bumpSuggested") : undefined },
            { value: "minor", label: `Minor (${semver.inc(pkgInfo.pkg.manifest.version, "minor")})`, hint: suggested === "minor" ? t("bumpSuggested") : undefined },
            { value: "major", label: `Major (${semver.inc(pkgInfo.pkg.manifest.version, "major")})`, hint: suggested === "major" ? t("bumpSuggested") : undefined },
            { value: "none", label: t("bumpNone", { version: pkgInfo.pkg.manifest.version }) },
            { value: "custom", label: t("bumpCustom") }
          ],
          initialValue: suggested,
        });

        if (p.isCancel(bump)) {
          p.cancel(t("operationCancelled"));
          return;
        }

        let newVersion: string;
        if (bump === "none") {
           newVersion = pkgInfo.pkg.manifest.version;
        } else if (bump === "custom") {
           const customV = await p.text({
             message: t("customVersionPrompt", { pkgName }),
             validate: (val) => {
               if (!semver.valid(val)) return t("customVersionError");
             }
           });
           if (p.isCancel(customV)) {
             p.cancel(t("operationCancelled"));
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
                message: t("cascadePrompt", { pkgName: color.cyan(pkgName), depName: color.yellow(dep.manifest.name) }),
                initialValue: true,
             });
             
             if (p.isCancel(cascade)) {
                p.cancel(t("operationCancelled"));
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

        const baseUrl = await getRepositoryBaseUrl();
        const { items } = formatCommitList(chosenCommits, baseUrl);

        const tagHeader = config.tagName === "version-only"
          ? newVersion
          : `${pkgName}@${newVersion}`;

        const annotationPrefix = config.annotationMessage
          ? `${config.annotationMessage}\n\n`
          : "";

        let defaultTagMsg = `Release ${tagHeader}\n\n${annotationPrefix}` + items.join("\n");

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
            message: t("createTagPrompt", { pkgName: color.cyan(pkgName), version: color.green(details.newVersion) }),
            initialValue: true,
         });

         if (p.isCancel(createTag)) {
           p.cancel(t("operationCancelled"));
           return;
         }

         if (createTag) {
           p.note(details.tagMessage, t("autoGeneratedMsg", { pkgName }));
           
           const msgAction = await p.select({
              message: t("tagMessagePrompt"),
              options: [
                 { value: "auto", label: t("tagMsgAuto") },
                 { value: "append", label: t("tagMsgAppend") },
                 { value: "custom", label: t("tagMsgCustom") }
              ]
           });

           if (p.isCancel(msgAction)) {
              p.cancel(t("operationCancelled"));
              return;
           }

           if (msgAction === "auto") {
              state.get(pkgName)!.tagMessage = details.tagMessage;
           } else if (msgAction === "append") {
              const appendedMsg = await p.text({ message: t("appendTextPrompt") });
              if (p.isCancel(appendedMsg)) {
                 p.cancel(t("operationCancelled"));
                 return;
              }
              
              const position = await p.select({
                 message: t("insertPositionPrompt"),
                 options: [
                    { value: "before", label: t("insertBefore") },
                    { value: "after", label: t("insertAfter") }
                 ]
              });

              if (p.isCancel(position)) {
                 p.cancel(t("operationCancelled"));
                 return;
              }

              if (position === "before") {
                 state.get(pkgName)!.tagMessage = details.tagMessage.replace("\n\n", `\n\n${appendedMsg as string}\n\n`);
              } else {
                 state.get(pkgName)!.tagMessage = details.tagMessage + "\n\n" + (appendedMsg as string);
              }
           } else if (msgAction === "custom") {
              const customMsg = await p.text({ message: t("customTagMsgPrompt") });
              if (p.isCancel(customMsg)) {
                 p.cancel(t("operationCancelled"));
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
           message: t("confirmExecute"),
           initialValue: false, // Control is key!
        });

        if (p.isCancel(execute) || !execute) {
           p.cancel(t("cancelledByUser"));
           return;
        }
        await saveCheckpoint("writing", state);
      }

      if (!isRecovered || recoveredStep === "writing") {
         const writingSpinner = p.spinner();
         writingSpinner.start(t("writing"));

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
           writingSpinner.stop(t("writeError"));
           console.error(e);
           return;
        }
      }

         await logRelease(releasedLog);
         
         writingSpinner.stop(t("writeDone"));
         await saveCheckpoint("committing", state);
      }

      const commitSpinner = p.spinner();
      commitSpinner.start(t("creatingGit"));

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
            const tagName = config.tagName === "version-only"
              ? details.newVersion
              : `${pkgName}@${details.newVersion}`;
            await createAnnotatedTag(tagName, details.tagMessage);
         }
      }

      commitSpinner.stop(t("gitDone"));
      await clearCheckpoint();

      p.outro(color.green(t("releaseDone")));

    } catch (err: any) {
      p.log.error(err.message);
      p.outro(t("errorOccurred"));
    }
  });
