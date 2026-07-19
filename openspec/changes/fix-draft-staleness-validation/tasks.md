# Tasks — fix-draft-staleness-validation

## 1. Persistencia del contexto

- [ ] 1.1 En `src/core/draft.ts`, extender `DraftFile` con `context?: { head: string; branch: string; versions: Record<string, string> }` y capturarlo en `saveDraft`
- [ ] 1.2 Agregar helper `getHeadHash()` en `src/git/index.ts` (rev-parse HEAD) si no existe
- [ ] 1.3 Pasar los datos necesarios (branch, manifests) al llamado de `saveDraft` en `src/commands/wizard/index.ts`

## 2. Validación al reanudar

- [ ] 2.1 Implementar `validateDraft(draft, pkgs, currentHead, currentBranch)` que devuelva `{ blockers, warnings }` según las reglas: liftCommits+HEAD movido → blocker; versión de manifest cambiada → blocker; HEAD movido sin lift / rama distinta → warning; sin `context` → warning genérico (blocker si hay liftCommits)
- [ ] 2.2 Invocar la validación en `wizard/index.ts` antes de `showDraftResumePrompt` y mostrar blockers/warnings vía i18n
- [ ] 2.3 Adaptar `draft-resume-prompt.ts`: con blockers, ofrecer solo "descartar" (mostrando el motivo); sin blockers, mostrar warnings como nota

## 3. i18n

- [ ] 3.1 Agregar claves a `types.ts`, `es.ts`, `en.ts`: bloqueo por reorder obsoleto, bloqueo por versión cambiada (con nombre de paquete), advertencia de commits nuevos, advertencia de rama distinta, advertencia de draft no verificable

## 4. Verificación

- [ ] 4.1 `pnpm build` sin errores
- [ ] 4.2 Guardar un draft, hacer un commit nuevo, reabrir el wizard: debe advertir (sin bloquear) y permitir ambas opciones
- [ ] 4.3 Guardar un draft con reorder (liftCommits), hacer un commit nuevo, reabrir: debe bloquear el resume y solo ofrecer descartar
- [ ] 4.4 Guardar un draft, cambiar a mano la versión de un manifest del plan, reabrir: debe bloquear indicando el paquete
- [ ] 4.5 Draft viejo (borrar el campo `context` a mano): debe advertir "no verificable" y cargar igual
