# Proposal

## Why

Con `"tagName": "version-only"` tagman crea bien los tags (`0.11.0`), pero toda la lectura sigue buscando `<paquete>@*` (issue #74). Resultado: no encuentra el release anterior, el CHANGELOG repite commits ya publicados y el link de comparación apunta a tags que no existen. La opción es inutilizable hoy para lo que existe: repos de un solo paquete.

## What Changes

- El esquema de tags (nombre al escribir, patrón y parseo al leer) pasa a depender de `config.tagName` en un único lugar, y lo usan tanto la escritura como la lectura.
- Con `version-only`, la resolución del último tag (general, estable y estable remoto) y el escaneo de commits sin liberar usan tags de versión sueltos (`X.Y.Z`), ignorando tags que no sean semver válido (p. ej. `2fa-setup`) para que nunca oculten commits.
- Con `version-only` en un repo de un paquete, la lectura reconoce además los tags `<paquete>@X.Y.Z` previos, para que un repo que pasó de `full` a `version-only` no re-liste todo su historial. La escritura sigue el config.
- El link de comparación del CHANGELOG es `X...Y` con `version-only` y `<paquete>@X...<paquete>@Y` con `full`.
- **BREAKING** (solo para configs ya inválidas en la práctica): `version-only` en un workspace con más de un paquete se rechaza con un error (`reason: "invalid-config"`, exit 1) antes del escaneo. Hoy esa combinación hace que dos paquetes con la misma versión compartan un tag sin aviso.
- Con `full` no cambia ningún comportamiento observable.

## Capabilities

### New Capabilities
- `tag-naming-scheme`: cómo se nombran, reconocen y comparan los tags de release según `tagName`, y qué combinaciones de config/workspace son válidas.

### Modified Capabilities
- `semver-tag-baseline`: la resolución del último tag y la exclusión multi-tag del escaneo dejan de estar atadas literalmente a `name@*` y pasan a usar los tags del paquete según el esquema configurado.

## Impact

- `src/git/index.ts`: búsquedas de tags (`getTagsSortedBySemver` y sus 3 consumidores, `getUnreleasedCommitsForPath`, `getUnreleasedRepoCommits`) reciben el esquema.
- `src/core/updater.ts`: `appendToChangelog` arma el link de comparación según el esquema.
- `src/commands/wizard/steps/{execute,checkpoint,scan-and-select}.ts`: los ternarios duplicados del nombre de tag se reemplazan por el helper; `scan-and-select.ts` pasa el esquema a las búsquedas.
- `src/commands/wizard/index.ts`: validación `version-only` + multi-paquete tras descubrir el workspace.
- `src/ui/mode.ts`: nuevo `FailureReason` `invalid-config`.
- i18n (`types.ts`, `en.ts`, `es.ts`): mensaje del error de config.
- `CLAUDE.md`: lista de `reason` del JSON.
- Sin dependencias nuevas.
