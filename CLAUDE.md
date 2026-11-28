# CLAUDE.md — tagman

## Project Overview

**tagman** (`@fethabo/tagman`) is an interactive TypeScript CLI for per-package versioning and git tagging in monorepos (pnpm workspaces). Running `tagman` opens a main menu that offers two flows: `release` (full wizard) and `github-release` (create GitHub Releases from existing tags). The release wizard scans packages for unreleased commits, lets the user cherry-pick commits per package, suggests SemVer bumps from conventional commit types, supports pre-release channels and graduation, generates CHANGELOG entries, updates `package.json` versions, creates a release commit, creates annotated git tags, and optionally publishes to npm/GitHub Releases — with full checkpoint/rollback support for crash recovery. No AI integrations; pure automation.

---

## Commands

```bash
pnpm build      # Compile src/ → dist/ via tsup (ESM output)
pnpm dev        # Run directly via tsx (no build step needed)
pnpm start      # Execute compiled dist via bin/tagman.js
```

```bash
pnpm test       # node:test via tsx (src/*/*.test.ts)
pnpm typecheck  # tsc --noEmit (tsup does not type-check)
```

---

## Architecture Map

```
src/
  index.ts                          CLI entry — Commander program, registers commands,
                                    default action calls showMainMenu()
  config.ts                         Loads tagman.config.json (Zod-validated); exports TagmanConfig
  version.ts                        Exports VERSION string from package.json
  schemas/index.ts                  Zod schemas for PackageJson and PnpmWorkspace
  utils/index.ts                    Low-level I/O: readJson, writeJson, readYaml, writeYaml,
                                    appendToFile, fileExists

  core/
    tag-scheme.ts                   formatTag / tagGlobs / parseTagVersion — single source of
                                    truth for tag names per config.tagName (write AND read)
    workspace.ts                    Monorepo discovery — reads pnpm-workspace.yaml or
                                    package.json#workspaces; returns WorkspacePackage[];
                                    getDependents() finds reverse deps
    commits.ts                      conventional-commits-parser wrapper; suggestBump() derives
                                    patch/minor/major from commit types
                                    (feat → minor, BREAKING CHANGE → major)
    checkpoint.ts                   Persists ReleaseState to .tagman-checkpoint.json;
                                    step values: "writing" | "committing"
    draft.ts                        Persists planned ReleaseState to .tagman-draft.json before
                                    execution begins; hasDraft/loadDraft/saveDraft/clearDraft
    updater.ts                      Writes package.json versions, appends CHANGELOG.md entries,
                                    updates consumer dependency refs; rollback counterparts
    token.ts                        resolveGithubToken() — priority: GITHUB_TOKEN env →
                                    ~/.npmrc → ./.npmrc → config.github.token

  git/index.ts                      simple-git wrapper — getLastTagForPackage (name@version format),
                                    getCommitsForPath (since last tag), createReleaseCommit,
                                    createAnnotatedTag, getLatestRemoteStableVersion,
                                    getRemoteBehindCount

  i18n/
    index.ts                        setLocale(), t() — i18n system, default locale: "es"
    types.ts                        Messages type (all UI strings)
    en.ts                           English messages
    es.ts                           Spanish messages (default)

  integrations/
    github.ts                       Octokit wrapper — createGithubRelease()
    npm.ts                          pnpm publish wrapper

  plugins/
    index.ts                        TagmanPlugin interface (afterRelease? hook), runAfterRelease()

  ui/                               Headless / agent contract (#71)
    mode.ts                         RunMode (interactive, json) set once per command;
                                    HeadlessError (reason, exitCode), ReportedError
    prompts.ts                      Guarded confirm/select/multiselect/text + assertInteractive();
                                    the ONLY way to prompt (enforced by prompts.test.ts)
    gates.ts                        Pure preflight gates: dirty tree, behind remote, checkpoint
    run.ts                          runCommand() — single exit point: exit codes + JSON document
    output.ts                       reserveStdoutForJson()/emitJson() — stdout holds only JSON

  commands/
    menu.ts                         showMainMenu() — presents release / github-release / exit
    github-release.ts               githubReleaseCommand, runGithubReleaseFlow() — creates
                                    GitHub Releases from existing local/remote tags
    wizard/index.ts                 Wizard orchestrator — runs steps sequentially, handles
                                    checkpoint recovery path vs. fresh path
    wizard/commit-multiselect.ts    Custom @clack/core MultiSelectPrompt; keyboard shortcuts:
                                    [a] select all, [n] deselect all, [d] toggle details, [b] back
    wizard/wizard-select.ts         Custom @clack/core SelectPrompt with optional [b] back navigation
    wizard/steps/
      checkpoint.ts                 Step 0: warns on dirty working tree; checks remote sync;
                                    offers resume/rollback for an existing checkpoint
      scan-and-select.ts            Steps 1–4: scan packages → select packages → cherry-pick
                                    commits → choose version bump → cascade dependent packages;
                                    handles graduation, extra-only, pre-release channels,
                                    trailing commit reorder
      tag-messages.ts               Step 5: review/edit auto-generated annotated tag messages
      execute.ts                    Step 6: write files, checkpoint("committing"),
                                    git commit + tags, push, GitHub release, npm publish,
                                    run plugins, clear checkpoint

bin/
  tagman.js                         Shebang entry that imports dist/index.js
```

**Data flow:**
`loadConfig` → `showMainMenu` →
- **[release]** `getWorkspacePackages` → `handleCheckpoint` → `[checkDraft]` → `scanAndSelectPackages` → `[showScanSummary+draftSave]` → `promptTagMessages` → `executeRelease` → `runAfterRelease`
- **[github-release]** `runGithubReleaseFlow`

**Key types:**
- `ReleaseState` (`checkpoint.ts`): `{ pkg, commits, bump, prereleaseChannel?, githubPrerelease?, liftCommits?, newVersion, tagMessage }`
- `WorkspacePackage` (`workspace.ts`): `{ dir, manifest }`
- `TagmanConfig` (`config.ts`): `{ tagName, packagesRoutes?, workspace, annotationMessage?, github?, npm?, plugins?, requireRemoteSync? }`
- `CommitInfo` (`git/index.ts`): `{ hash, date, message, body, author_name, author_email }`
- `ReleaseResult` (`plugins/index.ts`): `{ packages: [{ name, previousVersion, newVersion, tag }] }`

---

## Tech Stack

| Concern | Library |
|---|---|
| CLI framework | `commander` |
| Interactive prompts | `@clack/prompts` + `@clack/core` |
| Git operations | `simple-git` |
| Commit parsing | `conventional-commits-parser` |
| Schema validation | `zod` v4 |
| Version math | `semver` |
| File globbing | `fast-glob` |
| YAML parsing | `yaml` |
| Terminal color | `picocolors` |
| GitHub API | `@octokit/rest` |
| Build | `tsup` (ESM only, `dts: true`) |
| Runtime executor | `tsx` (dev only) |
| Package manager | `pnpm` |

---

## Coding Conventions

### ESM imports — always use `.js` extensions

```typescript
// Correct — NodeNext ESM requires explicit extensions
import { readJson } from "../utils/index.js";
import type { TagmanConfig } from "../config.js";

// Wrong — will fail at runtime
import { readJson } from "../utils/index";
```

### TypeScript

- `strict: true`, target `ES2022`, module `NodeNext`
- Use `import type` for type-only imports
- Use Zod `.passthrough()` on external schemas (e.g. `packageJsonSchema`) to preserve unknown fields when round-tripping JSON
- Prefer `async/await` throughout; no callbacks

### @clack/prompts

Always check `p.isCancel()` immediately after every prompt:

Never call `p.confirm/select/multiselect/text` (or a `@clack/core` `new *Prompt`) directly: use `ui.*` from `src/ui/prompts.ts`, or call `assertInteractive(message)` first in a custom prompt wrapper. In non-interactive mode (`--yes` or no TTY) a guarded prompt throws `HeadlessError("interaction-required", …, 2)` instead of hanging or silently cancelling. `src/ui/prompts.test.ts` fails the build on direct calls.

```typescript
import * as ui from "../../../ui/prompts.js";
const result = await ui.select({ ... });
if (p.isCancel(result)) {
  p.cancel("Operation cancelled.");
  return null;
}
```

Use `p.spinner()` for async operations:

```typescript
const spinner = p.spinner();
spinner.start("Scanning packages...");
// ...async work...
spinner.stop("Done.");
```

Wrap wizard sessions with `p.intro()` / `p.outro()`. Use `p.log.warn()` / `p.log.error()` for feedback.

### i18n

All UI strings must go through `t()` — never hardcode user-visible text:

```typescript
import { t } from "../../i18n/index.js";
p.log.warn(t().wizard.noCommits);
```

Locale is set once at startup via `setLocale("es" | "en")`. Default is `"es"`.

### Cancellation contract

Every wizard step function returns `null` (or `false`) on an **interactive** user cancel. The orchestrator (`wizard/index.ts`) checks for `null` and returns a `cancelled` outcome.

Failures that must reach the exit code are thrown, never returned:
- `HeadlessError(reason, message, exitCode, extra?)` for headless preconditions (`dirty-tree`, `packages-required`, …).
- `ReportedError` when a step already logged and reverted (e.g. tag creation failed).

`runCommand()` (`src/ui/run.ts`) wraps every command action and maps the outcome or error to the exit code (0/1/2) and, under `--json`, to the JSON document.

### Headless rule for new prompts

`--yes` accepts the option the interactive prompt **preselects**. Resolve the prompt before calling it (`if (yes) … else await ui.select(…)`) and reuse the same default the prompt uses (see `defaultBumpFor()` in `core/commits.ts`). Safety gates (dirty tree, behind remote, checkpoint, push, package selection) are the exception: they fail instead of assuming. Put them in `src/ui/gates.ts`.

---

## Key Patterns for Extension

### Adding a new wizard step

1. Create `src/commands/wizard/steps/your-step.ts`
2. Export `async function yourStep(state, config): Promise<ResultType | null>`
3. Return `null` on cancel (following existing pattern)
4. Use `t()` for all user-visible strings; add keys to `src/i18n/types.ts`, `en.ts`, and `es.ts`
5. Import and call it from `src/commands/wizard/index.ts` in sequence
6. If crash-sensitive, call `saveCheckpoint()` before the step runs

### Checkpoint integration

Two phases in `execute.ts`:
- `"writing"` — saved before file writes begin (package.json, CHANGELOG)
- `"committing"` — saved after file writes, before git commit + tags

To add a new crash-sensitive phase:

```typescript
await saveCheckpoint("your-phase", stateMap);
// ... risky work ...
await clearCheckpoint();
```

Add `"your-phase"` to the `Checkpoint["step"]` union in `src/core/checkpoint.ts` and handle it in `steps/checkpoint.ts`.

### Adding a config option

1. Extend `tagmanConfigSchema` in `src/config.ts` (all keys must be declared)
2. Add the field to the `DEFAULTS` constant
3. Thread the config field through where needed via the `config` parameter

### Adding a plugin

Plugins are external JS files that export a default `TagmanPlugin` object. They receive `ReleaseResult` in the `afterRelease` hook. Errors are non-fatal. Configure via `plugins: ["./my-plugin.js"]` in `tagman.config.json`.

---

## Advanced Features

### Commit hyperlinks (OSC 8)
References like `#123` and `owner/repo#123` in commit messages are wrapped with OSC 8 hyperlinks (`\x1b]8;;URL\x1b\\text\x1b]8;;\x1b\\`) when a GitHub remote is detected. Terminals that don't support OSC 8 ignore the escape sequences transparently. Implementation: `linkifyCommitMessage()` in `src/commands/wizard/commit-multiselect.ts`, applied at label-build time in `scan-and-select.ts`.

### Navigation hints
Both `commitMultiSelect` and `wizardSelect` always display a hint bar with `[↑↓]`, `[enter]`, and (when applicable) `[space]`, `[a]`, `[n]`, `[d]`, `[b]` shortcuts. Step 2b displays commit count and last tag in the prompt header.

### Push gate
The push-to-remote question is only shown when at least one tag was actually created. If the user declined all tags, the question is skipped. Same for GitHub Releases — packages without a tag are skipped in the release creation loop.

### Pre-release channels
Supports `premajor`, `preminor`, `prepatch`, `prerelease` bump types with a custom channel (alpha, beta, rc, custom string, or current git branch name). Example output: `1.0.0-rc.1`, `1.0.0-develop.0`.

### Graduation of pre-releases
When a package is on a pre-release version with no new commits, tagman offers to "graduate" it to stable. Uses commits from the last stable tag for CHANGELOG. Checks remote for conflicting stable versions and offers to bump to next patch if needed.

### Extra-only candidates
Packages with no path-specific commits but with repo-wide commits can still be released. Tracked via `isExtraOnly` flag in scan-and-select.

### Back navigation from cascade (step 4)
Step 4 (cascade dependency versioning) uses `wizardSelect` with a `[b]` back option. Pressing back undoes all cascade entries added in the current run (queue removals + `allCandidates` rollback) and re-runs the inner do-while (steps 2+3) for that package. Implemented via an outer `do {} while (goBackFromCascade)` loop wrapping steps 2-4 in `scan-and-select.ts`.

### Trailing commit reorder
If commits exist that are older than the selected range for a package, tagman offers to reorder via git reset + cherry-pick. Only one reorder per release is allowed. All lifted commits must be unpushed. Hashes stored in `ReleaseState.liftCommits`.

### Remote sync check
`handleCheckpoint()` calls `checkRemoteSync(token?)` (in `git/index.ts`), which returns a tri-state `RemoteSyncResult`:
- `{ status: "verified", behind: N }` — remote reached. If `behind > 0`: blocks when `requireRemoteSync: true`, otherwise warns and asks for confirmation. A missing upstream tracking branch is reported as `verified, behind: 0` (nothing to compare).
- `{ status: "unverified", reason }` — remote could not be reached (`timeout` | `auth` | `error` | `no-remote`). Shown as a **non-fatal** warning; the flow continues (never silently treated as "in sync").

**No-hang guarantee:** all network git operations (`checkRemoteSync`, `getLatestRemoteStableVersion`, `pushRelease`) run through the `networkGit()` helper — an ephemeral `simpleGit` instance with `timeout: { block }` and `GIT_TERMINAL_PROMPT=0` + SSH `BatchMode=yes` — so a missing credential or unreachable remote fails fast instead of hanging on an interactive prompt.

**HTTPS token auth:** for HTTPS+GitHub remotes, the sync check uses a token only if already resolved via `resolveGithubToken()` (lazy read-path — never forces a device-flow login). The push step, if it fails for lack of credentials, offers `interactiveGithubLogin()` and retries. Tokens are injected as an ephemeral HTTP auth header via `GIT_CONFIG_*` env vars (`http.extraHeader`), never persisted to `.git/config` or the remote URL, and never surfaced in error messages (they live only in the child process env, not command args).

### Draft saving (issue #24)
After `scanAndSelectPackages` completes, a summary screen shows the planned changes (package → old version → new version, commit count) and offers three options:
- **Continuar / Proceed** — moves to the tag-messages step normally
- **Guardar borrador / Save as draft** — serializes the state map to `.tagman-draft.json` and exits
- **Volver / Go back** — loops back to the scan step

On the next run, if a draft file is detected, the user is offered to resume (skips scan, loads state into tag-messages) or discard it. Draft saving is skipped in `--yes`, `--dry-run`, and `--json` modes. Implementation: `src/core/draft.ts` (save/load/clear/has), integrated in `src/commands/wizard/index.ts`.

---

## Scope Restrictions

- Write only to: `src/`, `bin/`, `.github/`, root-level config files (`package.json`, `tsconfig.json`, `tsup.config.ts`, etc.)
- `node_modules/` is **read-only** — inspect freely, never modify. If a library lacks a needed API, implement the behavior in `src/` using public imports only (see `commit-multiselect.ts` for an example of working around library constraints without patching internals)

**Do not commit these runtime/generated files** (they are gitignored):
- `.tagman-checkpoint.json` — crash recovery state
- `.tagman-draft.json` — saved wizard draft (pre-execution)
- `.tagman-release.log` — release audit log
- `dist/` — build output

---

## CLI Reference

### Global flag
| Flag | Description |
|------|-------------|
| `--lang <lang>` | UI language: `"es"` (default) or `"en"`. Declared only on the root program and applied in a `preAction` hook, so it works before or after the subcommand (`tagman --lang en release` ≡ `tagman release --lang en`) |

### `tagman release`

```bash
tagman release --dry-run                          # Preview changes, no writes
tagman release --packages pkg-a --yes --json      # Headless (agents/CI): zero prompts, JSON on stdout
tagman release --packages pkg-a,pkg-b --bump patch --yes --push  # Headless + push
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Show version/tag preview without executing anything |
| `--json` | stdout holds only the final JSON document; all UI goes to stderr; no screen clear |
| `--packages <names>` | Comma-separated package names (skips package selection prompt). **Required** with `--yes` |
| `--bump <type>` | Global bump type: `patch`, `minor`, or `major` (skips bump prompt). Without it, `--yes` uses `defaultBumpFor()` |
| `--yes` | Non-interactive: accept the preselected option of every prompt (bump, tag + auto message, cascade, graduation conflict → next patch) |
| `--push` | Push commits and tags to remote without asking. With `--yes`, no push unless `--push` |
| `--allow-dirty` | Continue with uncommitted changes without asking (otherwise `--yes` fails with `dirty-tree`) |
| `--allow-behind` | Continue when behind the remote without asking (otherwise `--yes` fails with `behind-remote`; `requireRemoteSync: true` always wins) |

**Headless safety gates** (exit 1, nothing written): no `--packages` (`packages-required`, lists `candidates`), unknown package (`package-not-found`), dirty tree, behind remote, pending checkpoint (`pending-checkpoint`; never auto-resumed or rolled back). A requested package with no commits at all is skipped unless `--bump` forces it.

**Config gate** (exit 1 in every mode, nothing written): `tagName: "version-only"` in a workspace with more than one package fails with `invalid-config` (extra: `packages`), since bare version tags would collide across packages.

**Exit codes:** `0` released / dry run / nothing to release / interactive cancel · `1` error or failed headless precondition · `2` a prompt was reached without interaction (`--yes` or no TTY).

**JSON output shape:**
- success: `{ success: true, dryRun?: true, packages: [{ name, previousVersion, newVersion, tag }] }`
- otherwise: `{ success: false, reason, message, ...extra }`, where `reason` ∈ `no-commits | cancelled | packages-required | package-not-found | dirty-tree | behind-remote | pending-checkpoint | interaction-required | invalid-config | error` (stable, locale-independent) and `message` follows `--lang`

Entry points: `src/commands/wizard/index.ts` (flags, run mode), `src/ui/` (prompts guard, gates, exit codes, JSON), `src/commands/wizard/steps/scan-and-select.ts` (headless package/bump resolution), `src/commands/wizard/steps/execute.ts` (dry-run / push / outcome).

### `tagman github-release`

Creates GitHub Releases from existing annotated tags without touching versions or files. Requires `GITHUB_TOKEN` (or configured token). Token resolution order: `GITHUB_TOKEN` env → `~/.npmrc` → `./.npmrc` → `config.github.token`.

---

## Subagentes

Este repositorio define subagentes en `.claude/agents/` para tareas especializadas.

### Regla de delegación (obligatoria)

Esta regla aplica tanto en plan mode como fuera de plan mode.
Si el usuario menciona un issue de GitHub, se debe invocar primero el subagente correspondiente para obtener el contexto y el prompt de trabajo, incluso cuando el pedido inicial sea "solo armá el plan".

Disparadores de esta regla:
- Mensajes como "resolvé el issue #123", "implementá el issue #123", "trabajemos el issue #123".
- URLs de issue, por ejemplo `https://github.com/<owner>/<repo>/issues/<n>`.
- Referencias indirectas a "el issue de esta branch" o "el issue de este feature".

Flujo esperado:
1. Invocar `issue-prompt-optimizer`.
2. Leer y sintetizar issue + comentarios.
3. Hacer preguntas mínimas si falta contexto crítico.
4. Si el usuario pidió plan mode, devolver primero el plan basado en ese contexto.
5. Recién después, ejecutar la implementación cuando corresponda.

### issue-prompt-optimizer

- Archivo: `.claude/agents/issue-prompt-optimizer.md`
- Propósito: convertir un issue de GitHub en un prompt sintetizado y accionable para implementación.
- Uso recomendado: cuando el usuario comparte un número/URL de issue y quiere comenzar trabajo de desarrollo con contexto claro.
