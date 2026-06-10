# full-workspace-listing

## Purpose

Todos los paquetes del workspace aparecen en el paso 1 del wizard, incluso aquellos sin commits detectables, para que el usuario pueda versionarlos manualmente cuando lo necesite.

## Requirements

### Requirement: All workspace packages appear in step 1
El wizard SHALL incluir en el multiselect del paso 1 todos los paquetes del workspace, sin excepción. Los paquetes que no tienen commits de ruta propios, ni commits globales del repo desde su último tag, SHALL aparecer como categoría `noCommitsCandidates` con un hint que indica la ausencia de cambios detectados.

#### Scenario: Paquete sin ningún commit detectable aparece en el listado
- **WHEN** un paquete tiene su versión tagueada y no hay commits nuevos ni en su path ni en el resto del repo desde ese tag
- **THEN** el paquete aparece en el multiselect del paso 1 con el hint de "sin cambios detectados" y puede ser seleccionado por el usuario

#### Scenario: Paquete noCommits es seleccionable y procesa correctamente
- **WHEN** el usuario selecciona un paquete `noCommitsCandidates` en el paso 1
- **THEN** el wizard avanza directamente al paso de selección de tipo de bump (sin paso de selección de commits) y permite publicar una nueva versión sin entradas en el CHANGELOG

#### Scenario: Paquete noCommits aparece al final del listado
- **WHEN** el multiselect del paso 1 incluye paquetes de múltiples categorías
- **THEN** los paquetes `noCommitsCandidates` se presentan después de `packagesWithCommits`, `graduationCandidates` y `extraOnlyCandidates`

### Requirement: ExtraOnly detection uses single-tag baseline
La detección de `extraOnlyCandidates` SHALL usar `getRepoCommitsSince(lastTag)` (donde `lastTag` es el tag más reciente por semver correcto del paquete) en lugar de `getUnreleasedRepoCommits`. Esto garantiza que paquetes con historial de pre-release graduados a estable sigan apareciendo cuando hay actividad en el repo desde su tag estable.

#### Scenario: Paquete graduado de pre-release aparece como extraOnly si hay actividad en el repo
- **WHEN** un paquete tiene tags `pkg@0.1.6-beta.1` y `pkg@0.1.7` (estable graduado), sin commits nuevos en su path, pero sí hay commits de otros paquetes después de `pkg@0.1.7`
- **THEN** el paquete aparece en el listado como `extraOnlyCandidate`

#### Scenario: Paquete graduado sin actividad posterior aparece como noCommits
- **WHEN** un paquete tiene tags `pkg@0.1.6-beta.1` y `pkg@0.1.7`, sin commits nuevos en su path ni en el resto del repo después de `pkg@0.1.7`
- **THEN** el paquete aparece en el listado como `noCommitsCandidate` (no como extraOnly)
