## ADDED Requirements

### Requirement: Graduation tag annotation includes cycle commits
When building the auto-generated graduation tag message, the system SHALL include all commits from `ReleaseState.changelogCommits` (the full pre-release cycle history plus any user-selected extra commits). If `changelogCommits` is absent, it SHALL fall back to `ReleaseState.commits`.

#### Scenario: User selects no extra commits during graduation
- **WHEN** a package is graduated with no extra commits selected
- **THEN** the graduation tag annotation body SHALL contain the cycle commits (path-specific commits since last stable tag)

#### Scenario: User selects extra commits during graduation
- **WHEN** a package is graduated with one or more extra commits selected
- **THEN** the graduation tag annotation body SHALL contain both the extra commits and the cycle commits

#### Scenario: Graduation with version conflict bump
- **WHEN** the intended graduation version is already taken remotely and the wizard bumps to the next patch
- **THEN** the graduation tag annotation body SHALL still contain the full pre-release cycle commits

### Requirement: Changelog lookup uses original graduation base version
When the user chooses "include changelog" in the graduation tag-messages step, the system SHALL look up pre-release CHANGELOG entries using the stable base derived from `ReleaseState.pkg.manifest.version` (e.g. `"1.3.1-channel.0"` → `"1.3.1"`), not from `ReleaseState.newVersion`.

#### Scenario: Version not bumped (no conflict)
- **WHEN** the graduation target version equals the stable base of the pre-release source
- **THEN** the changelog lookup SHALL find entries for `x.y.z-channel.*` where `x.y.z` matches the graduation target

#### Scenario: Version bumped due to remote conflict
- **WHEN** the graduation target is bumped (e.g. `1.3.1` → `1.3.2`) because the intended version exists remotely
- **THEN** the changelog lookup SHALL find entries for `1.3.1-channel.*` (the original stable base), not `1.3.2-channel.*`

#### Scenario: No matching CHANGELOG entries
- **WHEN** no pre-release entries exist in the CHANGELOG for the original stable base
- **THEN** the system SHALL show the existing "changelog empty" warning and return to the action selector
