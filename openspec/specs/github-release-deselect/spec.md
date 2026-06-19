# github-release-deselect

## Purpose

En el flujo `github-release`, permite al usuario quitar un paquete ya seleccionado de la lista de releases sin abortar el flujo; la opción de quitar aparece en el selector de versión cuando el paquete ya tiene un tag elegido.

## Requirements

### Requirement: Deselect a package from within the version picker
The system SHALL allow the user to remove a previously selected package from the release list by presenting a deselect option at the top of the version picker when the package already has a tag chosen.

#### Scenario: Deselect option appears for already-selected packages
- **WHEN** the user navigates into the version picker for a package that already has a tag selected
- **THEN** a "Quitar de la selección" / "Remove from selection" option SHALL appear as the first item in the version list

#### Scenario: Deselect option absent for unselected packages
- **WHEN** the user navigates into the version picker for a package with no tag selected yet
- **THEN** the deselect option SHALL NOT appear; only the version list is shown

#### Scenario: Selecting the deselect option removes the package
- **WHEN** the user chooses the deselect option in the version picker
- **THEN** the package's tag SHALL be removed from the internal selection
- **AND** the package SHALL appear without a checkmark or version in the main package list on the next render
- **AND** the "Finalizar" option's label SHALL reflect the reduced count of selected tags

#### Scenario: Cancelling the version picker leaves selection unchanged
- **WHEN** the user opens the version picker (with or without deselect option) and presses Ctrl+C
- **THEN** the current selection SHALL remain unchanged and the flow SHALL exit gracefully
