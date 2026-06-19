# package-selection-version-display

## Purpose

El multiselect de paso 1 del wizard de release muestra la versión actual de cada paquete junto a su nombre, para que el usuario pueda tomar decisiones informadas antes de configurar los bumps de versión.

## Requirements

### Requirement: Version visible in package multiselect
The system SHALL display the current version of each package alongside its name in the step-1 multiselect prompt, so the user can make an informed selection before configuring version bumps.

The label format SHALL be:
- Regular package: `<name> (<currentVersion>) — <N> commits`
- Graduation candidate: `<name> (<currentVersion>)` (hint carries graduation context)
- Extra-only candidate: `<name> (<currentVersion>)` (hint carries extra-only context)
- No-commits candidate: `<name> (<currentVersion>)` (hint carries no-commits context)

#### Scenario: Regular package label includes version and commit count
- **WHEN** the step-1 multiselect renders a package that has unreleased path commits
- **THEN** the option label SHALL contain both the current semver version and the commit count in the format `<name> (<version>) — <N> commits`

#### Scenario: Graduation candidate label includes version
- **WHEN** the step-1 multiselect renders a graduation candidate (prerelease with no new commits)
- **THEN** the option label SHALL include the current prerelease version, e.g. `pkg-a (1.0.0-rc.2)`, with the graduation hint shown separately

#### Scenario: Extra-only candidate label includes version
- **WHEN** the step-1 multiselect renders an extra-only candidate
- **THEN** the option label SHALL include the current version alongside the package name

#### Scenario: No-commits candidate label includes version
- **WHEN** the step-1 multiselect renders a no-commits candidate
- **THEN** the option label SHALL include the current version alongside the package name

#### Scenario: Headless mode unaffected
- **WHEN** the `--packages` flag is used (headless mode skips the multiselect)
- **THEN** the version display change SHALL have no effect on program behavior
