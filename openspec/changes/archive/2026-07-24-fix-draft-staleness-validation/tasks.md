# Tasks — fix-draft-staleness-validation

## 1. Persistencia del contexto

- [x] 1.1 En `src/core/draft.ts`, extender `DraftFile` con `context?: { head: string; branch: string; versions: Record<string, string> }` y capturarlo en `saveDraft`
- [x] 1.2 Agregar helper `getHeadHash()` en `src/git/index.ts` (rev-parse HEAD) si no existe
- [x] 1.3 Pasar los datos necesarios (branch, manifests) al llamado de `saveDraft` en `src/commands/wizard/index.ts`

## 2. Validación al reanudar

- [x] 2.1 Implementar `validateDraft(draft, pkgs, currentHead, currentBranch)` que devuelva `{ blockers, warnings }` según las reglas: liftCommits+HEAD movido → blocker; versión de manifest cambiada → blocker; HEAD movido sin lift / rama distinta → warning; sin `context` → warning genérico (blocker si hay liftCommits)
- [x] 2.2 Invocar la validación en `wizard/index.ts` antes de `showDraftResumePrompt` y mostrar blockers/warnings vía i18n
- [x] 2.3 Adaptar `draft-resume-prompt.ts`: con blockers, ofrecer solo "descartar" (mostrando el motivo); sin blockers, mostrar warnings como nota

## 3. i18n

- [x] 3.1 Agregar claves a `types.ts`, `es.ts`, `en.ts`: bloqueo por reorder obsoleto, bloqueo por versión cambiada (con nombre de paquete), advertencia de commits nuevos, advertencia de rama distinta, advertencia de draft no verificable

## 4. Verificación

- [x] 4.1 `pnpm build` sin errores
- [x] 4.2 Guardar un draft, hacer un commit nuevo, reabrir el wizard: debe advertir (sin bloquear) y permitir ambas opciones *(verificado a nivel lógica: `validateDraft` con HEAD movido sin lift → 0 blockers, warning "commits nuevos")*
- [x] 4.3 Guardar un draft con reorder (liftCommits), hacer un commit nuevo, reabrir: debe bloquear el resume y solo ofrecer descartar *(verificado: HEAD movido + liftCommits → blocker; el prompt restringe a `[discard]` cuando `blockers.length > 0`)*
- [x] 4.4 Guardar un draft, cambiar a mano la versión de un manifest del plan, reabrir: debe bloquear indicando el paquete *(verificado: manifest 1.2.0→1.3.0 vs draft → blocker que nombra el paquete)*
- [x] 4.5 Draft viejo (borrar el campo `context` a mano): debe advertir "no verificable" y cargar igual *(verificado: sin `context` → warning "no verificable", carga sin blocker; con liftCommits → blocker por precaución)*
