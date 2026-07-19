# fix-checkpoint-rollback-integrity

## Why

El soporte de checkpoint/rollback es la promesa central de tagman ante crashes, pero la auditoría encontró cuatro agujeros que lo dejan a medio funcionar: (1) `rollbackChangelog` busca un formato de header (`## [X] - `) que `appendToChangelog` nunca escribe (escribe `## [X](url) (fecha)`), por lo que el rollback jamás limpia el CHANGELOG; (2) el rollback del commit espera el mensaje `chore(release): [...]` pero los releases pre-release generan `chore(pre-release): [...]`, dejando el commit sin resetear mientras los tags sí se borran; (3) reanudar un checkpoint en fase "committing" re-ejecuta `createReleaseCommit` — si el crash fue después del commit, el `git commit` sin cambios staged falla y el resume queda en loop de error; (4) cuando hubo reorder (`liftCommits`), el `reset --hard HEAD~N` corre antes de guardar el checkpoint, pero ni el rollback ni el resume conocen el HEAD original: el rollback pierde los commits reordenados y un cherry-pick fallido durante recovery no tiene vuelta atrás.

## What Changes

- `rollbackChangelog` pasa a buscar el header con el formato real que escribe `appendToChangelog` (`\n## [<version>](`), eliminando la entrada agregada.
- El mensaje del commit de release se construye en un helper compartido (`buildReleaseCommitMessage(state)`) usado tanto por `execute.ts` como por el rollback de `steps/checkpoint.ts`, de modo que releases y pre-releases se resetean por igual. (Los `hotfix` usan deliberadamente `chore(release):` — son releases en caliente, no pre-releases; el helper preserva ese comportamiento.)
- El resume en fase "committing" se vuelve idempotente: antes de commitear se verifica si el commit de release ya existe en HEAD (por mensaje) y se salta; antes de crear cada tag se verifica si ya existe y se salta.
- El `Checkpoint` persiste `origHead` cuando el release incluye `liftCommits`: el rollback restaura el HEAD original (recuperando los commits reordenados), y un cherry-pick fallido durante recovery también puede revertir.

## Capabilities

### New Capabilities

- `release-recovery`: comportamiento de checkpoint, resume y rollback de un release interrumpido — qué se persiste, cómo se reanuda de forma idempotente y qué garantiza el rollback (package.json, CHANGELOG, commit, tags y commits reordenados).

### Modified Capabilities

<!-- No hay specs existentes previas para este flujo. -->

## Impact

- `src/core/updater.ts` — fix del formato en `rollbackChangelog`.
- `src/core/checkpoint.ts` — campo opcional `origHead` en `Checkpoint`; firma de `saveCheckpoint` extendida (retrocompatible con checkpoints viejos sin el campo).
- `src/commands/wizard/steps/execute.ts` — helper de mensaje de commit, idempotencia del resume, persistencia de `origHead`.
- `src/commands/wizard/steps/checkpoint.ts` — rollback usa el helper de mensaje y restaura `origHead` si existe.
- `src/git/index.ts` — helper para consultar si un tag existe / mensaje del último commit (si no se reutiliza `git.log`).
- Sin breaking changes: los archivos `.tagman-checkpoint.json` previos siguen siendo válidos (campo nuevo opcional).
