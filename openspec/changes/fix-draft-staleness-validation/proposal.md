# fix-draft-staleness-validation

## Why

Un borrador (`.tagman-draft.json`, issue #24) captura el plan completo de un release — versiones base, commits elegidos, `liftCommits` — pero al reanudarlo (`wizard/index.ts`) no se valida nada contra el estado actual del repo. Si la rama avanzó o las versiones cambiaron desde que se guardó, el plan queda obsoleto y su ejecución produce resultados incorrectos; el caso más grave es destructivo: un draft con `liftCommits` ejecuta `git reset --hard HEAD~N` contando N desde el HEAD actual, con lo cual borra los N commits más recientes (que ya no son los del plan) y luego cherry-pickea hashes viejos — pérdida de trabajo real.

## What Changes

- Al guardar un draft se persiste el contexto de vigencia: hash de HEAD, rama actual y versión de manifest de cada paquete del plan.
- Al detectar un draft, antes de ofrecer reanudar se valida contra el repo actual:
  - **Bloqueante**: si el draft tiene `liftCommits` y HEAD cambió, no se permite reanudar (solo descartar) — el reorder planificado ya no es aplicable.
  - **Bloqueante**: si la versión actual de algún paquete difiere de la registrada en el draft, no se permite reanudar (el bump calculado ya no es válido).
  - **Advertencia**: si HEAD avanzó (sin liftCommits) o la rama es otra, se muestra el detalle y el usuario decide continuar o descartar.
- El prompt de resume muestra el resultado de la validación (qué cambió desde que se guardó).
- Drafts viejos sin el contexto de vigencia se tratan como no verificables: advertencia genérica + bloqueo solo si contienen `liftCommits`.

## Capabilities

### New Capabilities

- `draft-resume-safety`: garantías de vigencia al reanudar un borrador de release — qué contexto se persiste al guardar, qué condiciones bloquean la reanudación y cuáles solo advierten.

### Modified Capabilities

<!-- No hay specs existentes previas para este flujo. -->

## Impact

- `src/core/draft.ts` — `DraftFile` gana `context: { head, branch, versions }`; `saveDraft` lo captura; `loadDraft` lo expone.
- `src/commands/wizard/index.ts` — validación previa al prompt de resume; flujo de bloqueo/advertencia.
- `src/commands/wizard/draft-resume-prompt.ts` — muestra el resultado de la validación; deshabilita "resume" cuando está bloqueado.
- `src/git/index.ts` — helper para obtener el hash de HEAD (si no existe).
- `src/i18n/types.ts`, `es.ts`, `en.ts` — claves nuevas para advertencias y bloqueos.
- Retrocompatible: drafts existentes sin `context` siguen cargando (modo "no verificable").
