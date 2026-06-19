## MODIFIED Requirements

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
- **AND** the summary prompt SHALL re-render with the updated state WITHOUT re-running the package scan

#### Scenario: Summary re-shown after partial deselection
- **WHEN** the user removes some but not all packages via the deselect option
- **THEN** the summary prompt SHALL be shown again immediately with the reduced package list
- **AND** the commit-selection step SHALL NOT be re-executed

#### Scenario: All packages removed — clean exit
- **WHEN** the user removes all packages via the deselect option
- **THEN** the system SHALL cancel and exit the wizard cleanly (no re-scan, no re-execution of `scanAndSelectPackages`)

#### Scenario: Cancelling the deselect multiselect
- **WHEN** the user opens the deselect multiselect and then presses Ctrl+C
- **THEN** the state SHALL remain unchanged and the summary prompt SHALL remain active

#### Scenario: Deselect skipped in headless / dry-run modes
- **WHEN** the wizard runs with `--yes` or in `--dry-run` mode (summary prompt is bypassed)
- **THEN** the deselect mechanism SHALL not be invoked
