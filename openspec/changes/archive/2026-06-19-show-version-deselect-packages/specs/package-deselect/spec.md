## ADDED Requirements

### Requirement: Deselect packages from summary without restarting
The system SHALL provide an interactive mechanism in the scan summary screen (`showScanSummaryPrompt`) for the user to remove one or more packages from the planned release, without requiring a full restart of `scanAndSelectPackages`.

#### Scenario: Deselect option appears in summary
- **WHEN** the scan summary prompt is displayed with at least one package in the state
- **THEN** a "Quitar paquete(s)" / "Remove package(s)" option SHALL appear alongside Proceed, Save draft, and Go back

#### Scenario: Package removal via multiselect
- **WHEN** the user selects the deselect option
- **THEN** the system SHALL present a `p.multiselect` with all packages currently in the state, each pre-checked, showing `<name>: <oldVersion> → <newVersion>` as the label
- **AND** the user SHALL be able to uncheck one or more packages to remove them from the release
- **AND** upon confirmation, the unchecked packages SHALL be deleted from the state Map
- **AND** the summary prompt SHALL re-render with the updated state

#### Scenario: Cancelling the deselect multiselect
- **WHEN** the user opens the deselect multiselect and then presses Ctrl+C
- **THEN** the state SHALL remain unchanged and the summary prompt SHALL remain active

#### Scenario: All packages removed
- **WHEN** the user removes all packages from the state via deselect
- **THEN** the system SHALL emit a warning indicating the release list is now empty
- **AND** the system SHALL return `"back"` from the summary prompt so the wizard re-enters `scanAndSelectPackages`

#### Scenario: Deselect skipped in headless / dry-run modes
- **WHEN** the wizard runs with `--yes` or in `--dry-run` mode (summary prompt is bypassed)
- **THEN** the deselect mechanism SHALL not be invoked
