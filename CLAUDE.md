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

No test runner is configured. There are no test files.

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
    workspace.ts                    Monorepo discovery — reads pnpm-workspace.yaml or
                                    package.json#workspaces; returns WorkspacePackage[];
                                    getDependents() finds reverse deps
    commits.ts                      conventional-commits-parser wrapper; suggestBump() derives
                                    patch/minor/major from commit types
                                    (feat → minor, BREAKING CHANGE → major)
    checkpoint.ts                   Persists ReleaseState to .tagman-checkpoint.json;
                                    step values: "writing" | "committing"
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
- **[release]** `getWorkspacePackages` → `handleCheckpoint` → `scanAndSelectPackages` → `promptTagMessages` → `executeRelease` → `runAfterRelease`
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

```typescript
const result = await p.select({ ... });
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

Every wizard step function returns `null` (or `false`) on user cancel or unrecoverable error. The orchestrator (`wizard/index.ts`) checks for `null` and exits early — never throws past a step boundary.

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
`handleCheckpoint()` calls `getRemoteBehindCount()`. If `requireRemoteSync: true` in config, blocks the release. Otherwise shows a warning and asks for confirmation.

---

## Scope Restrictions

- Write only to: `src/`, `bin/`, `.github/`, root-level config files (`package.json`, `tsconfig.json`, `tsup.config.ts`, etc.)
- `node_modules/` is **read-only** — inspect freely, never modify. If a library lacks a needed API, implement the behavior in `src/` using public imports only (see `commit-multiselect.ts` for an example of working around library constraints without patching internals)

**Do not commit these runtime/generated files** (they are gitignored):
- `.tagman-checkpoint.json` — crash recovery state
- `.tagman-release.log` — release audit log
- `dist/` — build output

---

## CLI Reference

### Global flag
| Flag | Description |
|------|-------------|
| `--lang <lang>` | UI language: `"es"` (default) or `"en"` |

### `tagman release`

```bash
tagman release --dry-run                          # Preview changes, no writes
tagman release --json                             # Output JSON result to stdout
tagman release --packages pkg-a,pkg-b --bump patch --yes  # Fully headless
tagman release --push                             # Auto-push after release
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Show version/tag preview without executing anything |
| `--json` | Print structured JSON result at end instead of UI message |
| `--packages <names>` | Comma-separated package names (skips package selection prompt) |
| `--bump <type>` | Global bump type: `patch`, `minor`, or `major` (skips bump prompt) |
| `--yes` | Skip all confirmations and auto-accept cascade versioning |
| `--push` | Push commits and tags to remote without asking |

**Fully headless** (zero prompts): combine `--packages`, `--bump`, and `--yes`.
**JSON output shape:** `{ success: true, packages: [{ name, previousVersion, newVersion, tag }] }`

Entry points: `src/commands/wizard/index.ts` (flags), `src/commands/wizard/steps/scan-and-select.ts` (headless branch), `src/commands/wizard/steps/execute.ts` (dry-run / json / push).

### `tagman github-release`

Creates GitHub Releases from existing annotated tags without touching versions or files. Requires `GITHUB_TOKEN` (or configured token). Token resolution order: `GITHUB_TOKEN` env → `~/.npmrc` → `./.npmrc` → `config.github.token`.
