# Tasks — fix-scan-and-wizard-issues

## 1. Fix #62 — Baseline de escaneo por semver (`semver-tag-baseline`)

- [x] 1.1 Agregar helper `getTagsSortedBySemver(packageName)` en `src/git/index.ts`: lista `git tag -l "name@*"` sin sort de git, extrae la versión (`tag.slice(name.length + 1)`), descarta no-semver (`semver.valid`), ordena con `semver.rcompare`
- [x] 1.2 Reescribir `getLastTagForPackage` para devolver el primer tag del helper (o `null`)
- [x] 1.3 Reescribir `getLastStableTagForPackage` y `getLatestRemoteStableVersion` para iterar el orden del helper y devolver el primer tag/versión estable (`semver.prerelease === null`)
- [x] 1.4 Verificado: repo de prueba confirma el orden roto de git (`pkg@latest` > `pkg@1.2.0-beta.3` > `pkg@1.2.0`); el helper nuevo descarta `latest`, ordena `1.2.0` primero por `semver.rcompare`, y `pkg@1.2.0..HEAD` excluye los commits de la beta por topología

## 2. Fix #58 — Visibilidad del pseudo-commit cascade (`cascade-commit-visibility`)

- [x] 2.1 En `scan-and-select.ts` (rama `existing` del paso 4, ~línea 627): al hacer `unshift` del pseudo-commit cascade, limpiar `existing.isExtraOnly = false`; si la entrada es `isGraduation`, insertar el pseudo-commit en `extraCommits` en lugar de `commits`
- [x] 2.2 Extender el rollback de back-navigation (~líneas 636-652) para restaurar `isExtraOnly = true` cuando al filtrar el commit `cascade` el array `commits` queda vacío, y filtrar también `extraCommits` en entradas de graduación
- [x] 2.3 Verificado por traza de código: con `isExtraOnly = false`, el paso 2 recibe `options = [cascade]` con `initialValues = commits.map(c => c.hash)` (pre-seleccionado); `chosenCommits` lo incluye; en `--yes` entra por la rama `commits`
- [x] 2.4 Verificado por traza de código: el rollback filtra `cascade` de `commits`/`extraCommits` y restaura `isExtraOnly = true` cuando quedan commits vacíos con extras disponibles (firma exacta de un candidato extra-only)

## 3. Fix #57 — Links a issues en tag y changelog (`issue-ref-links`)

- [x] 3.1 En `formatCommitList` (`src/core/updater.ts:130-134`): transformar primero `owner/repo#num` → `[owner/repo#num](https://github.com/owner/repo/issues/num)`, luego los `#num` restantes → `[#num](${baseUrl}/issues/num)`; sin `baseUrl`, dejar texto plano y eliminar el fallback `([#num](#num))`
- [x] 3.2 Verificado por traza de regex: `(#62)` → `([#62](baseUrl/issues/62))`; cross-repo no es re-procesado por el pase same-repo (el `#` queda precedido por word char y la URL no contiene `#`); sin `baseUrl` queda texto plano

## 4. Fix #56 — Placeholder de canal en paso 3a (`prerelease-channel-placeholder`)

- [x] 4.1 En `scan-and-select.ts:449-451`: calcular las versiones de ejemplo con canal literal `"channel"` y reemplazar `-channel.` por `-{channel}.` (helper local `preview(type)`); eliminar el `"alpha"` hardcodeado
- [x] 4.2 Agregar key i18n `scan.channelNextStepHint` en `src/i18n/types.ts`, `es.ts` y `en.ts` ("el canal se elige en el siguiente paso") y mostrarla como hint en el prompt del paso 3a
- [x] 4.3 Verificado: `semver.inc("1.2.3-alpha.4","prepatch","channel")` = `1.2.4-channel.0` → `1.2.4-{channel}.0`; solo se sustituye el canal inyectado (replace literal `-channel.`), nunca el pre-release de la versión actual; values y cálculo 3a→3b intactos

## 5. Fix #62 parte 2 — Exclusión multi-tag (reapertura tras validación en repo real)

- [x] 5.1 Agregar `getUnreleasedCommitsForPath(path, packageName)` y `getUnreleasedRepoCommits(packageName)` en `src/git/index.ts`: `git log HEAD ^tag1 ^tag2 … [-- path]` excluyendo todos los tags `name@*`
- [x] 5.2 Reemplazar en el loop de escaneo de `scan-and-select.ts`: `getCommitsForPath(dir, lastTag)` → `getUnreleasedCommitsForPath`, `getRepoCommitsSince(lastTag)` → `getUnreleasedRepoCommits` (3 sitios); la recolección de ciclo de graduación conserva `getCommitsForPath(dir, lastStableTag)`
- [x] 5.3 Verificado por el usuario en el repo real (delta, rama `implementar-tramite-de-registro-remuco`): el escaneo de `transporte` ya no lista los commits releaseados en los tags `remuco.0–.4` ni en `1.1.0`

## 6. Cierre

- [x] 6.1 Correr `pnpm build` sin errores de TypeScript (ejecutado por el usuario; re-ejecutar tras la parte 2 del fix #62)
- [x] 6.2 N/A — el proyecto no tiene ESLint configurado (sin `eslint.config.*` ni `eslintConfig` en package.json)
- [x] 6.3 Verificado por build estricto + revisión de integración: firmas públicas de `git/index.ts` sin cambios, `channelNextStepHint` tipado en `Messages`/es/en, `previewVersion` tipa contra `semver.ReleaseType`; flujos checkpoint/draft/execute no afectados (sandbox impidió el smoke test interactivo)
