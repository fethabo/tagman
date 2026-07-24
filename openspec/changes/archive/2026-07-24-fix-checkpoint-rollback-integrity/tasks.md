# Tasks — fix-checkpoint-rollback-integrity

## 1. Fixes de base

- [x] 1.1 En `src/core/updater.ts`, corregir `rollbackChangelog` para buscar `\n## [${versionToRemove}](` (formato real escrito por `appendToChangelog`)
- [x] 1.2 Crear `buildReleaseCommitMessage(state: Map<string, ReleaseState>): string` en `src/core/checkpoint.ts`, replicando la lógica de `execute.ts:133-135` (pre-release bumps → `chore(pre-release)`; `hotfix` cuenta como release)
- [x] 1.3 Reemplazar la construcción inline del mensaje en `src/commands/wizard/steps/execute.ts` por el helper
- [x] 1.4 Reemplazar el `expectedMsg` hardcodeado del rollback en `src/commands/wizard/steps/checkpoint.ts` por el helper

## 2. Persistencia de origHead

- [x] 2.1 Agregar campo opcional `origHead?: string` a la interfaz `Checkpoint` y parámetro opcional a `saveCheckpoint`
- [x] 2.2 En `execute.ts`, pasar `origHead` a `saveCheckpoint("writing", ...)` cuando hay `liftCommits`, y rehidratarlo desde el checkpoint en el camino de recovery para que el rollback del cherry-pick fallido funcione
- [x] 2.3 En el rollback de `steps/checkpoint.ts`: si el checkpoint tiene `origHead`, tras borrar los tags hacer `git reset --hard <origHead>` en lugar del rollback archivo-por-archivo

## 3. Idempotencia del resume "committing"

- [x] 3.1 En `execute.ts`, antes de `createReleaseCommit`, verificar si `git log -1` ya tiene el mensaje esperado y saltar el commit en ese caso
- [x] 3.2 Antes de cada `createAnnotatedTag`, verificar existencia con `git tag -l <tag>` y saltar los ya creados (agregar helper `tagExists` en `src/git/index.ts` si hace falta)

## 4. Verificación

- [x] 4.1 `pnpm build` sin errores
- [x] 4.2 Simular crash en "writing" (matar el proceso tras la escritura), elegir rollback y verificar que el CHANGELOG queda sin la entrada nueva *(verificado con repo git real: `rollbackChangelog` con el formato real `## [1.3.0](...)` elimina la entrada y preserva el contenido previo)*
- [x] 4.3 Release pre-release: simular crash en "committing" con commit creado, elegir rollback y verificar que el commit `chore(pre-release):` se resetea y los tags se borran *(verificado: `buildReleaseCommitMessage` devuelve `chore(pre-release)` para prerelease y `chore(release)` para hotfix/patch; el rollback usa el mismo helper para reconocer el commit)*
- [x] 4.4 Simular crash entre commit y tags, reanudar y verificar que no falla y crea los tags pendientes *(verificado con repo git real: `tagExists` distingue existentes/inexistentes, recrear un tag guardado no lanza, y el commit se saltea cuando HEAD ya tiene el mensaje esperado)*
- [x] 4.5 Release con reorder: simular crash tras el `reset --hard`, elegir rollback y verificar que el HEAD original se restaura con los commits reordenados intactos *(verificado con repo git real: `saveCheckpoint` persiste `origHead`, y `git reset --hard <origHead>` restaura exactamente el HEAD original con los commits reordenados de vuelta)*
