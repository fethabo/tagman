## ADDED Requirements

### Requirement: Tags grouped by package with metadata
The system SHALL group all local git tags by their package name when displaying them for GitHub Release creation. Tags following the `<name>@<version>` format SHALL be grouped under their package name. Tags not following that format SHALL be grouped under a special `"(otros)"` group. Each tag option SHALL display its version, creation date (YYYY-MM-DD), and the tagger name.

#### Scenario: Tags shown grouped by package
- **WHEN** the user runs `github-release` and tags exist in the repo
- **THEN** the system presents a list of package names (not individual tags) as the first selection step

#### Scenario: Tags sorted by date within a package group
- **WHEN** the user selects a package in step 1
- **THEN** the system shows the tags for that package sorted by creation date descending (newest first)

#### Scenario: Tag option shows metadata
- **WHEN** the tag list for a package is displayed
- **THEN** each option shows: version string, creation date, and tagger name

#### Scenario: Tags not matching name@version format
- **WHEN** one or more tags do not follow the `<name>@<version>` pattern
- **THEN** they are grouped under a `"(otros)"` entry in the package selector

### Requirement: Two-step hierarchical tag selection
The system SHALL implement a two-step iterative selection flow: (1) choose a package, (2) choose a tag version within that package. The user SHALL be able to select tags from multiple packages by repeating the loop. The package selector SHALL include a "Done / Listo" option to finalize the selection.

#### Scenario: User selects tags from multiple packages
- **WHEN** the user selects a tag from package A
- **THEN** the system returns to the package selector so the user can select another package or finish

#### Scenario: User finishes selection
- **WHEN** the user chooses the "Done" option in the package selector
- **THEN** the system proceeds to create GitHub Releases for all accumulated tags

#### Scenario: User goes back from version selector
- **WHEN** the user presses [b] back in the version selector for a package
- **THEN** the system returns to the package selector without adding any tag to the selection

#### Scenario: User cancels the flow
- **WHEN** the user presses Escape or Ctrl+C at any step
- **THEN** the system cancels the operation and exits without creating any releases

### Requirement: Already-selected packages are marked in the package list
The system SHALL visually indicate in the package selector which packages already have a tag selected, so the user knows which ones they've already processed.

#### Scenario: Package with selected tag is marked
- **WHEN** the user has already selected a tag for package A and returns to the package selector
- **THEN** package A appears with a visual indicator (e.g. checkmark or note) showing it is already selected

### Requirement: Minimum one tag required before proceeding
The system SHALL require at least one tag to be selected before allowing the user to choose "Done / Listo". If no tags have been selected yet, the "Done" option SHALL either be absent or display a warning.

#### Scenario: Done option unavailable with empty selection
- **WHEN** the user has not yet selected any tags
- **THEN** the "Done / Listo" option is either hidden or triggers a warning message instead of proceeding
