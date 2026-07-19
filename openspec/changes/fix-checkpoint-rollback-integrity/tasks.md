# Tasks — fix-checkpoint-rollback-integrity

## 1. Fixes de base

- [ ] 1.1 En `src/core/updater.ts`, corregir `rollbackChangelog` para buscar `\n## [${versionToRemove}](` (formato real escrito por `appendToChangelog`)
- [ ] 1.2 Crear `buildReleaseCommitMessage(state: Map<string, ReleaseState>): string` en `src/core/checkpoint.ts`, replicando la lógica de `execute.ts:133-135` (pre-release bumps → `chore(pre-release)`; `hotfix` cuenta como release)
- [ ] 1.3 Reemplazar la construcción inline del mensaje en `src/commands/wizard/steps/execute.ts` por el helper
- [ ] 1.4 Reemplazar el `expectedMsg` hardcodeado del rollback en `src/commands/wizard/steps/checkpoint.ts` por el helper

## 2. Persistencia de origHead

- [ ] 2.1 Agregar campo opcional `origHead?: string` a la interfaz `Checkpoint` y parámetro opcional a `saveCheckpoint`
- [ ] 2.2 En `execute.ts`, pasar `origHead` a `saveCheckpoint("writing", ...)` cuando hay `liftCommits`, y rehidratarlo desde el checkpoint en el camino de recovery para que el rollback del cherry-pick fallido funcione
- [ ] 2.3 En el rollback de `steps/checkpoint.ts`: si el checkpoint tiene `origHead`, tras borrar los tags hacer `git reset --hard <origHead>` en lugar del rollback archivo-por-archivo

## 3. Idempotencia del resume "committing"

- [ ] 3.1 En `execute.ts`, antes de `createReleaseCommit`, verificar si `git log -1` ya tiene el mensaje esperado y saltar el commit en ese caso
- [ ] 3.2 Antes de cada `createAnnotatedTag`, verificar existencia con `git tag -l <tag>` y saltar los ya creados (agregar helper `tagExists` en `src/git/index.ts` si hace falta)

## 4. Verificación

- [ ] 4.1 `pnpm build` sin errores
- [ ] 4.2 Simular crash en "writing" (matar el proceso tras la escritura), elegir rollback y verificar que el CHANGELOG queda sin la entrada nueva
- [ ] 4.3 Release pre-release: simular crash en "committing" con commit creado, elegir rollback y verificar que el commit `chore(pre-release):` se resetea y los tags se borran
- [ ] 4.4 Simular crash entre commit y tags, reanudar y verificar que no falla y crea los tags pendientes
- [ ] 4.5 Release con reorder: simular crash tras el `reset --hard`, elegir rollback y verificar que el HEAD original se restaura con los commits reordenados intactos
