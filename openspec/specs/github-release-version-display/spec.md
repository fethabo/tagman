# github-release-version-display

## Purpose

En el flujo `github-release`, el listado de paquetes muestra la versión del tag seleccionado junto al nombre del paquete, reemplazando el texto genérico "ya seleccionado".

## Requirements

### Requirement: Selected version visible in package list
The system SHALL display the version of the selected tag alongside the package name in the main package list of the `github-release` flow, replacing the generic "already selected" text.

The label format for a selected package SHALL be:
`✓ <packageName>  <version>` where `<version>` is the semver portion extracted from the tag name (e.g., `1.2.3` from `pkg-a@1.2.3`; the full tag name for version-only tags).

#### Scenario: Selected package shows version instead of generic text
- **WHEN** a package has an associated tag selected by the user
- **THEN** its label in the package list SHALL display the selected version (e.g., `✓ pkg-a  1.2.3`) rather than a generic "already selected" string

#### Scenario: Unselected package shows no version
- **WHEN** a package has no tag selected yet
- **THEN** its label SHALL show only the package name, with no version or checkmark

#### Scenario: Version-only tag format
- **WHEN** a tag does not contain a `@`-separated package name (version-only `tagName` config)
- **THEN** the full tag name SHALL be used as the version display value
