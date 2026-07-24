# Design — fix-checkpoint-rollback-integrity

## Context

El flujo de ejecución (`execute.ts`) guarda checkpoints en dos fases ("writing" antes de escribir archivos, "committing" antes del commit+tags) y `steps/checkpoint.ts` ofrece resume/rollback al detectar uno. Cuatro defectos independientes rompen las garantías: formato de header desalineado en `rollbackChangelog`, mensaje de commit esperado hardcodeado sin la variante `pre-release`, resume no idempotente en "committing", y pérdida del HEAD original en releases con reorder (`liftCommits`).

## Goals / Non-Goals

**Goals:**
- Rollback deja package.json, CHANGELOG, commit, tags y branch en el estado previo al release, para todo tipo de bump.
- Resume tolera crashes en cualquier punto de la fase "committing".

**Non-Goals:**
- Validación de vigencia de drafts (`.tagman-draft.json`) — cubierta por la propuesta `fix-draft-staleness-validation`.
- Cambiar el modelo de dos fases ni el formato general del checkpoint (solo se agrega un campo opcional).
- Rollback transaccional de operaciones remotas (push, GitHub Releases, npm) — fuera de alcance, como hasta ahora.

## Decisions

1. **`rollbackChangelog` busca `\n## [<version>](`** (con paréntesis de apertura del link), que es exactamente el prefijo que produce `appendToChangelog` (`## [${newVersion}](${compareLinkUrl}) (${date})`). Se mantiene `lastIndexOf` + truncado: las entradas se anexan al final, así que truncar desde el header es correcto. Alternativa considerada: regex tolerante a ambos formatos — innecesario, el único escritor es tagman.
2. **Helper compartido `buildReleaseCommitMessage(state): string`** en `src/core/checkpoint.ts` (o módulo core neutro), que replica la lógica actual de `execute.ts:133-135` (set de bumps pre-release → `chore(pre-release)`, resto → `chore(release)`; `hotfix` NO es pre-release por decisión de producto: es un arreglo en caliente que se publica como release). `execute.ts` y el rollback lo consumen; se elimina la duplicación que causó el bug.
3. **Idempotencia del resume por inspección de estado git, no por sub-fases nuevas.** Antes de `createReleaseCommit`: si `git log -1` tiene exactamente el mensaje esperado, saltar el commit. Antes de cada `createAnnotatedTag`: si `git tag -l <tag>` lo devuelve, saltar. Alternativa considerada: granularizar el checkpoint con más fases ("tagging", "tagged:<n>") — descartada por complejidad; la inspección de git es la fuente de verdad real y no requiere migrar el formato.
4. **`origHead` se persiste a nivel `Checkpoint`** (no por paquete): el reorder es único por release (invariante existente: "solo un reorder por release"). `saveCheckpoint(step, state, origHead?)` lo escribe; los checkpoints viejos sin el campo se cargan igual (campo opcional). En rollback: si `checkpoint.origHead` existe, tras borrar tags se hace `git reset --hard <origHead>` (restaura commits reordenados y descarta escrituras) en lugar del rollback archivo-por-archivo. En resume: `origHead` se rehidrata para que el manejo de fallo del cherry-pick (`execute.ts:181`) funcione igual que en una corrida fresca.
5. **`reset --hard` solo cuando hubo reorder.** No se generaliza la captura de `origHead` a todo release: un `reset --hard` universal destruiría cambios sin commitear del usuario (el wizard permite continuar con working tree sucio tras confirmación). El rollback archivo-por-archivo sigue siendo el camino para releases sin reorder.

## Risks / Trade-offs

- [Detección del commit por mensaje exacto puede fallar si el usuario amendeó el commit] → Caso marginal; el fallback es el comportamiento actual (intento de commit) y el error resultante es visible y no destructivo.
- [`reset --hard origHead` descarta cambios del working tree hechos después del crash] → Se ejecuta solo en rollback explícito confirmado por el usuario y solo para releases con reorder, donde ya había un `reset --hard` en juego; se documenta en el mensaje de confirmación del rollback.
- [Truncar CHANGELOG desde `lastIndexOf` borra todo lo posterior al header] → Correcto por construcción (tagman anexa al final); si el usuario editó a mano después del crash, el rollback es igual de destructivo que hoy pero al menos elimina la entrada correcta.
