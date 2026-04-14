# tagman — Roadmap

This document tracks the technical direction of tagman. Completed phases are kept here for historical reference; active development targets the upcoming objectives.

---

## Completed

### Phase 1 — Compatibility & Scope (Core)
- [x] **Multi-workspace support** — npm, yarn, bun, and any custom layout via `packagesRoutes`
- [x] **Single-package mode** — works in standard repos without a monorepo structure
- [x] **Plugin architecture** — custom post-release logic via `afterRelease` hook in ESM plugin files

### Phase 2 — Automation & Ecosystem
- [x] **NPM publishing** — native `pnpm publish` integration per package after tagging
- [x] **GitHub Releases** — automatic creation via the GitHub REST API after push
- [x] **CHANGELOG.md generator** — persistent change history file alongside tag metadata

### Phase 3 — User Experience & i18n
- [x] **Multi-language support** — full i18n system; all CLI messages translated
- [x] **Hot-swappable language** — `--lang en|es` flag switches language at runtime
- [x] **UI refinement** — wizard back-navigation, extra-directory commit selection, inline commit detail toggle (`d` key)

### Phase 4 — Agentic Optimization
- [x] **JSON mode (`--json`)** — structured output for AI agents and scripts
- [x] **Headless mode** — fully non-interactive via `--packages`, `--bump`, `--yes`, `--push`
- [x] **Dry-run simulation (`--dry-run`)** — preview all changes without touching the filesystem or Git

---

## Upcoming

### Phase 5 — Main Menu, Decoupled Flows & Pre-release

- [x] **Main menu** — `tagman` without arguments shows an interactive menu instead of launching the release wizard directly
- [x] **GitHub release from existing tag** — dedicated flow (`tagman github-release`) to publish an already-created local tag to GitHub Releases, without needing new commits
- [x] **Fix no-commits dead end** — when no packages have pending commits, the release flow offers the GitHub release option instead of exiting
- [x] **GitHub token from `.npmrc`** — token resolved automatically from env var or `~/.npmrc`; no need to store it in `tagman.config.json`
- [x] **Back navigation in tag message flows** — Ctrl+C on any text input (append / custom message) now goes back to the action selector instead of cancelling the wizard
- [x] **Pre-release versioning** — first-class support for `alpha`, `beta`, `rc`, and custom channel versions via an interactive sub-flow; auto-detects current pre-release state; auto-marks GitHub Releases as pre-release

### Phase 6 — Advanced Release Management *(ideas, not committed)*

- [ ] **Interactive tag browser** — browse, filter, and manage all existing tags from the CLI
- [ ] **Draft GitHub releases** — option to create GitHub Releases in draft state for review before publishing
- [ ] **Monorepo release groups** — define release groups in config to always version a set of packages together
- [ ] **Release notes editor** — rich pre-release notes editing with template support
