## Context

The graduation flow collects two sets of commits:
- **cycle commits** (`pkgInfo.commits`): path-specific commits since the last stable tag — the full history of the pre-release cycle.
- **extra commits** (`pkgInfo.extraCommits`): repo-wide commits not touching the package path, optionally selected by the user.

Both sets end up in `ReleaseState.changelogCommits` for CHANGELOG generation, but `ReleaseState.commits` is set only to the extra commits chosen by the user. `buildGraduationMessage` and `extractPreReleaseChangelog` in `tag-messages.ts` consume `details.commits` and `details.newVersion` respectively — missing the cycle commits and using the wrong version key when a version conflict bumped the target.

## Goals / Non-Goals

**Goals:**
- Graduation tag annotation includes the full pre-release cycle history.
- "Include changelog" option in the tag-messages step finds existing CHANGELOG entries even when the final version was bumped due to a remote conflict.

**Non-Goals:**
- Changes to `ReleaseState` data shape.
- Changes to CHANGELOG file generation (already correct via `changelogCommits`).
- Handling any graduation scenario beyond version-conflict bumps.

## Decisions

**Decision 1 — Use `changelogCommits` in `buildGraduationMessage`**

`details.changelogCommits` is the union already built for CHANGELOG purposes. Reusing it in `buildGraduationMessage` keeps the two outputs (CHANGELOG entry and tag annotation) consistent without duplicating logic.

Alternative considered: re-fetch cycle commits inside `buildGraduationMessage`. Rejected — adds a git call at display time and diverges from what was already computed during scan.

**Decision 2 — Derive the changelog lookup key from `details.pkg.manifest.version`**

The pre-release source version (`pkg.manifest.version`, e.g. `"1.3.1-channel.0"`) carries the original stable target (`1.3.1`) regardless of any post-scan version bump. `semver.parse()` extracts `.major.minor.patch` cleanly.

Alternative considered: store `graduationOriginalTarget` as a new field in `ReleaseState`. Rejected — it can be derived on demand; adding a field widens the contract unnecessarily.

## Risks / Trade-offs

- [If `changelogCommits` is somehow undefined on a non-graduation release] → mitigated by the `?? details.commits` fallback; behavior for non-graduation releases is unchanged.
- [If `pkg.manifest.version` is not a valid semver prerelease at tag-messages time] → `semver.parse` returns null; fallback to `details.newVersion` preserves current behavior.

## Migration Plan

Two line-level changes to `src/commands/wizard/steps/tag-messages.ts`. No data migrations, no config changes, no breaking changes. Rollback = revert the two lines.
