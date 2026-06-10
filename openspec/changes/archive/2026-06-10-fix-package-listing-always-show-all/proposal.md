## Why

Tras el fix del issue #62 (1.4.3), dos paquetes con versiones estables tagueadas (`0.1.7` y `0.1.0`) dejaron de aparecer en el paso 1 del wizard. La causa es que `getUnreleasedRepoCommits` — que usa exclusión multi-tag — se aplicó también a `extraOnlyCandidates`, siendo demasiado restrictivo: paquetes cuyo último tag estable cubre toda la historia del repo quedan con 0 repo commits y desaparecen. Además, se identifica un requisito más amplio: el usuario debe poder seleccionar cualquier paquete del workspace para bumpearlo, aunque no tenga commits propios ni de otros paquetes.

## What Changes

- **Fix regresión `extraOnlyCandidates`**: restaurar `getRepoCommitsSince(lastTag)` (con el `lastTag` correcto por semver) en lugar de `getUnreleasedRepoCommits` para detectar candidatos extraOnly. La exclusión multi-tag queda reservada exclusivamente para `packagesWithCommits` (donde fue diseñada para el fix de #62).
- **Todos los paquetes siempre visibles**: los paquetes del workspace que no caen en ninguna categoría (sin commits propios, sin commits de repo desde su último tag) se agregan como categoría `noCommitsCandidates`, mostrándose en el multiselect con un hint que indica "sin cambios detectados".
- **Selección libre**: el usuario puede seleccionar cualquier paquete de `noCommitsCandidates`; el wizard procede normalmente (bump de versión sin commits en el CHANGELOG de ese paquete).

## Capabilities

### New Capabilities
- `full-workspace-listing`: todos los paquetes del workspace deben aparecer en el paso 1 del wizard, agrupados por categoría. Los paquetes sin actividad detectada aparecen con indicación "sin cambios" pero son seleccionables.

### Modified Capabilities
- `semver-tag-baseline`: el requisito "Scan excludes commits reachable from any package tag" aplica solo al escaneo de commits de ruta (`packagesWithCommits`), NO a la detección de candidatos extraOnly ni al conteo de repo commits para ese branch.

## Impact

- `src/commands/wizard/steps/scan-and-select.ts`: lógica de clasificación de candidatos (extraOnly branch) y nueva categoría noCommits.
- `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts`: nuevo string de hint para paquetes sin commits.
- Sin cambios en `src/git/index.ts` (solo se cambia qué función se llama).
- Sin cambios en el contrato de `ReleaseState`, `PackageInfo` ni en pasos posteriores del wizard.
