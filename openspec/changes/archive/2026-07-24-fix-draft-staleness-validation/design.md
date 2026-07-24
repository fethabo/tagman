# Design — fix-draft-staleness-validation

## Context

El draft serializa el `Map<string, ReleaseState>` planificado y se reanuda saltando directamente a tag-messages (`wizard/index.ts:51-72`). El plan referencia estado del repo que puede haber cambiado: versiones base de manifest (determinan `newVersion` y el compare-link del CHANGELOG), commits elegidos y — lo más delicado — `liftCommits`, que en `execute.ts:91-93` dispara `git reset --hard HEAD~N` con N = cantidad de commits lifted, asumiendo que HEAD es el mismo de cuando se planificó.

## Goals / Non-Goals

**Goals:**
- Ningún draft obsoleto puede disparar operaciones destructivas (`reset --hard`) ni escribir versiones calculadas sobre bases que ya cambiaron.
- El usuario entiende qué cambió desde que guardó el borrador antes de decidir.

**Non-Goals:**
- "Rebasar" automáticamente un draft obsoleto (recalcular bumps/commits contra el nuevo HEAD) — el camino para eso es descartar y re-escanear, que ya es barato.
- Validar drafts contra el remoto (el chequeo de sync remoto existente ya corre antes en el flujo).
- Cambiar el mecanismo de guardado/borrado del draft.

## Decisions

1. **Validación por severidad de la consecuencia, no binaria.** Bloquear solo lo que produce resultados incorrectos o destructivos (reorder con HEAD movido; versión base cambiada). Advertir lo demás (HEAD avanzado sin reorder, rama distinta): son planes aún ejecutables cuyo único costo es que los commits nuevos no participan. Alternativa considerada: invalidar el draft ante cualquier cambio de HEAD — descartada por castigar el caso de uso principal del draft ("lo sigo mañana", con algún commit intermedio inocuo).
2. **Contexto de vigencia dentro de `DraftFile`** (`context: { head: string; branch: string; versions: Record<string, string> }`), capturado en `saveDraft` con datos que ya están disponibles en el flujo (branch y manifests) más un `rev-parse HEAD`. Campo opcional en el tipo para tolerar drafts viejos.
3. **La validación vive en `wizard/index.ts`, antes de `showDraftResumePrompt`,** como función pura `validateDraft(draft, pkgs, currentHead, currentBranch) → { blockers: string[], warnings: string[] }`. El prompt recibe el resultado y: con blockers, solo muestra "descartar" (más el detalle); sin blockers, muestra warnings como líneas informativas sobre las opciones actuales. Alternativa: validar dentro de `loadDraft` — descartada, `core/draft.ts` quedaría acoplado a git y a workspace.
4. **Drafts sin `context`**: no adivinar. Se marcan "no verificables" (warning genérico); si traen `liftCommits` se bloquean, porque el riesgo destructivo no es verificable. Es el único caso donde un draft que hoy se reanuda pasará a bloquearse — aceptado deliberadamente por seguridad.

## Risks / Trade-offs

- [Fricción nueva: drafts que hoy "funcionan" pasan a advertir o bloquearse] → El mensaje siempre explica el porqué y descartar + re-escanear toma segundos; el costo de la alternativa (release incorrecto o commits perdidos) es muy superior.
- [`versions` compara solo paquetes del plan] → Suficiente: los paquetes fuera del plan no son tocados por la ejecución; los dependientes en cascada ya están dentro del plan.
- [HEAD igual no garantiza working tree igual] → El chequeo de working tree sucio ya existe al inicio del wizard (`handleCheckpoint`); no se duplica aquí.
