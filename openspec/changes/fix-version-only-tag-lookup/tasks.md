# Tasks

## 1. Esquema de tags puro

- [x] 1.1 Crear `src/core/tag-scheme.ts` con `formatTag`, `tagGlobs` y `parseTagVersion` según design D1/D4; verificar con `pnpm typecheck`
- [x] 1.2 Crear `src/core/tag-scheme.test.ts` cubriendo ambos esquemas, `2fa-setup`, `v1.0.0`, `pkg@latest` y la mezcla `pkg@0.11.0` + `0.12.0` bajo `version-only`; verificar que `pnpm test` pasa

## 2. Búsquedas de git según el esquema

- [x] 2.1 En `src/git/index.ts`, reemplazar `getTagsSortedBySemver` por `listPackageTags(pkg, tagName)` (varios globs en un `git tag -l`, filtrado por `parseTagVersion`, orden `semver.rcompare`) según D3; verificar con `pnpm typecheck`
- [x] 2.2 Agregar `tagName` como parámetro requerido a `getLastTagForPackage`, `getLastStableTagForPackage` y `getLatestRemoteStableVersion`, usando la `version` parseada en vez de `slice`; verificar con `pnpm typecheck` (debe marcar los callers en `scan-and-select.ts`)
- [x] 2.3 Hacer que `getUnreleasedCommitsForPath` y `getUnreleasedRepoCommits` reciban `tagName` y excluyan solo los tags de `listPackageTags`; verificar con `pnpm typecheck`
- [x] 2.4 Pasar `config.tagName` en las 6 llamadas de `scanAndSelectPackages`; verificar que `pnpm typecheck` queda limpio
- [x] 2.5 Crear `src/git/tag-lookup.test.ts` (repo temporal, `chdir` + `import()` dinámico, según D7) que verifique: último tag `0.11.0` con `2fa-setup` presente, solo el commit nuevo como sin liberar, el commit de `2fa-setup` sí listado, baseline conservado con `pkg@0.11.0` heredado y regresión `full` con `pkg@1.2.0-beta.3` + `pkg@1.2.0`; verificar que `pnpm test` pasa

## 3. Nombres de tag y link del CHANGELOG

- [x] 3.1 Reemplazar `buildTagName` y los ternarios de `execute.ts` (l.170), `checkpoint.ts` (l.152, l.193) y `scan-and-select.ts` (l.739) por `formatTag`; verificar con `pnpm typecheck` y que `rg 'tagName === "version-only"' src` solo aparece en `tag-scheme.ts`
- [x] 3.2 Hacer que `appendToChangelog` reciba `tagName` y arme el link con `formatTag`; actualizar la llamada en `execute.ts`; verificar con `pnpm typecheck`
- [x] 3.3 Agregar a `src/core/updater.test.ts` casos del link `X...Y` (`version-only`) y `pkg@X...pkg@Y` (`full`); verificar que `pnpm test` pasa

## 4. Rechazo de version-only en monorepo

- [x] 4.1 Agregar `"invalid-config"` a `FailureReason` en `src/ui/mode.ts` y ajustar el comentario de `HeadlessError` (ya no es exclusivo de modo no interactivo); verificar con `pnpm typecheck`
- [x] 4.2 Agregar la clave `headless.versionOnlyMonorepo(count)` en `src/i18n/types.ts`, `en.ts` y `es.ts`, indicando cambiar `tagName` a `"full"`; verificar con `pnpm typecheck`
- [x] 4.3 En `src/commands/wizard/index.ts`, tras resolver `pkgs` y antes de `handleCheckpoint`, lanzar `HeadlessError("invalid-config", …, 1, { packages })` si `version-only` y `pkgs.length > 1`, según D5; verificar con `pnpm typecheck`
- [x] 4.4 Extraer la condición a una función pura en `src/ui/gates.ts` y testearla en `gates.test.ts` (1 paquete pasa, 2 paquetes falla con `full` permitido); verificar que `pnpm test` pasa
- [x] 4.5 Agregar `invalid-config` a la lista de `reason` del JSON y la regla de `version-only` en `CLAUDE.md` (CLI Reference); verificar leyendo la sección

## 5. Verificación integrada

- [x] 5.1 Correr `pnpm typecheck`, `pnpm test` y `pnpm build`; los tres deben terminar sin errores
- [x] 5.2 Prueba manual en un repo temporal de un paquete con `tagName: "version-only"`: dos releases con `tagman release --packages <pkg> --bump minor --yes`; verificar que la entrada `0.12.0` del CHANGELOG lista solo el commit nuevo y el link es `0.11.0...0.12.0`
- [x] 5.3 Prueba manual en un workspace de dos paquetes con `version-only`: `tagman release --packages a --yes --json`; verificar exit 1 y `reason: "invalid-config"` sin archivos modificados

## Workflow follow-up

- Archivar `fix-headless-agent-mode` antes que este change, para que la lista de `reason` quede consistente en las specs principales.
- Cerrar el issue #74 al mergear el PR.
