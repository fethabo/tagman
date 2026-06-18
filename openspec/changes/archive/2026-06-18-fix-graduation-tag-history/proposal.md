## Why

When graduating a pre-release channel (e.g. `1.3.1-channel.0 → 1.3.1`), if the intended stable version is already taken remotely and the wizard bumps to the next patch (`1.3.2`), the tag annotation ends up empty and the "include changelog" option in the tag-messages step finds no entries. The cycle history is silently lost.

## What Changes

- `buildGraduationMessage` in `tag-messages.ts` will use `details.changelogCommits ?? details.commits` instead of `details.commits`, so cycle commits (path-specific commits since last stable tag) are included in the graduation tag annotation.
- `extractPreReleaseChangelog` in `tag-messages.ts` will derive the stable base version from `details.pkg.manifest.version` (the pre-release source) rather than `details.newVersion`, so CHANGELOG entries for `1.3.1-channel.x` are found even when the final version was bumped to `1.3.2`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `graduation-tag-history`: graduation tag annotation and changelog lookup must use the full pre-release cycle history and the original intended stable version as lookup key, regardless of version-conflict bumps.

## Impact

- `src/commands/wizard/steps/tag-messages.ts`: two targeted line-level changes.
- No changes to `ReleaseState` shape, no new fields, no schema migrations.
- No impact on non-graduation releases.
