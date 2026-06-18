## 1. Fix graduation tag annotation (Bug #1)

- [x] 1.1 In `src/commands/wizard/steps/tag-messages.ts`, change `buildGraduationMessage` to use `details.changelogCommits ?? details.commits` instead of `details.commits` (line 17)
- [x] 1.2 Verify that a graduation with no extra commits selected produces a non-empty tag annotation containing the cycle commits

## 2. Fix changelog lookup version key (Bug #2)

- [x] 2.1 In `src/commands/wizard/steps/tag-messages.ts`, before calling `extractPreReleaseChangelog`, derive the stable base from `details.pkg.manifest.version` using `semver.parse()` (e.g. `"1.3.1-channel.0"` → `"1.3.1"`), falling back to `details.newVersion` if parse returns null
- [x] 2.2 Pass the derived stable base to `extractPreReleaseChangelog` instead of `details.newVersion`
- [x] 2.3 Verify that the "include changelog" option finds `1.3.1-channel.*` entries when the final version was bumped to `1.3.2`

## 3. Build verification

- [x] 3.1 Run `pnpm build` and confirm no TypeScript errors
