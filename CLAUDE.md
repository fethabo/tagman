# CLAUDE.md — tagman

## Project Overview

**tagman** (`@fethabo/tagman`) is an interactive TypeScript CLI for per-package versioning and git tagging in monorepos (pnpm workspaces). Running `tagman release` launches a wizard that scans packages for unreleased commits, lets the user cherry-pick commits per package, suggests SemVer bumps from conventional commit types, generates CHANGELOG entries, updates `package.json` versions, creates a release commit, and creates annotated git tags — with full checkpoint/rollback support for crash recovery. No AI integrations; pure automation.

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
  index.ts                          CLI entry — Commander program, registers `release` command
  config.ts                         Loads tagman.config.json (Zod-validated); exports TagmanConfig
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

  git/index.ts                      simple-git wrapper — getLastTagForPackage (name@version format),
                                    getCommitsForPath (since last tag), createReleaseCommit,
                                    createAnnotatedTag

  commands/
    wizard/index.ts                 Wizard orchestrator — runs steps sequentially, handles
                                    checkpoint recovery path vs. fresh path
    wizard/commit-multiselect.ts    Custom @clack/core MultiSelectPrompt with Select All /
                                    Deselect All virtual controls
    wizard/steps/
      checkpoint.ts                 Step 0: warns on dirty working tree; offers resume/rollback
                                    for an existing checkpoint
      scan-and-select.ts            Steps 1–4: scan packages → select packages → cherry-pick
                                    commits → choose version bump → cascade dependent packages
      tag-messages.ts               Step 5: review/edit auto-generated annotated tag messages
      execute.ts                    Step 6: write files, checkpoint("committing"),
                                    git commit + tags, clear checkpoint

bin/
  tagman.js                         Shebang entry that imports dist/index.js
```

**Data flow:**
`loadConfig` → `getWorkspacePackages` → `handleCheckpoint` → `scanAndSelectPackages`
→ `promptTagMessages` → `executeRelease`

**Key types:**
- `ReleaseState` (`checkpoint.ts`): `{ pkg, commits, bump, newVersion, tagMessage }`
- `WorkspacePackage` (`workspace.ts`): `{ dir, manifest }`
- `TagmanConfig` (`config.ts`): `{ tagName, packagesRoutes?, workspace, annotationMessage? }`

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

### Cancellation contract

Every wizard step function returns `null` (or `false`) on user cancel or unrecoverable error. The orchestrator (`wizard/index.ts`) checks for `null` and exits early — never throws past a step boundary.

---

## Key Patterns for Extension

### Adding a new wizard step

1. Create `src/commands/wizard/steps/your-step.ts`
2. Export `async function yourStep(state, config): Promise<ResultType | null>`
3. Return `null` on cancel (following existing pattern)
4. Import and call it from `src/commands/wizard/index.ts` in sequence
5. If crash-sensitive, call `saveCheckpoint()` before the step runs

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

---

## Scope Restrictions

- Write only to: `src/`, `bin/`, `.github/`, root-level config files (`package.json`, `tsconfig.json`, `tsup.config.ts`, etc.)
- `node_modules/` is **read-only** — inspect freely, never modify. If a library lacks a needed API, implement the behavior in `src/` using public imports only (see `commit-multiselect.ts` for an example of working around library constraints without patching internals)

**Do not commit these runtime/generated files** (they are gitignored):
- `.tagman-checkpoint.json` — crash recovery state
- `.tagman-release.log` — release audit log
- `dist/` — build output

---

## Phase 4 — Agentic Optimization (Implemented)

All Phase 4 flags are live on the `release` command:

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
