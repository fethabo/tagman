## 1. Fix ExtraOnly detection (regresión #65)

- [x] 1.1 En `src/commands/wizard/steps/scan-and-select.ts`, branch `else` (extraOnlyCandidates): reemplazar `getUnreleasedRepoCommits(pkg.manifest.name)` por `getRepoCommitsSince(lastTag)`
- [x] 1.2 Agregar `getRepoCommitsSince` al import de `../../../git/index.js` en `scan-and-select.ts`

## 2. Agregar categoría noCommitsCandidates

- [x] 2.1 En `src/commands/wizard/steps/scan-and-select.ts`, agregar la lista `noCommitsCandidates: PackageInfo[]` junto a las otras
- [x] 2.2 Al final del loop de escaneo (después del `else`), agregar un `else` final que pushea todos los paquetes restantes a `noCommitsCandidates` con `commits: [], extraCommits: [], lastTag, isExtraOnly: true, isNoCommits: true`
- [x] 2.3 Agregar `isNoCommits?: boolean` a la interfaz `PackageInfo` en `scan-and-select.ts`
- [x] 2.4 Incluir `noCommitsCandidates` al armar `allCandidates` (al final, después de `extraOnlyCandidates`)
- [x] 2.5 Actualizar la condición de retorno `"no-commits"`: solo retornar cuando `allCandidates` sigue vacío (con la nueva categoría, nunca debería estarlo si hay paquetes en el workspace)

## 3. UI: hint diferenciado para paquetes sin cambios

- [x] 3.1 Agregar clave `noCommitsHint` a la interfaz `Messages` en `src/i18n/types.ts` (dentro de `scan`)
- [x] 3.2 Agregar traducción española en `src/i18n/es.ts`: `noCommitsHint: "sin cambios detectados"`
- [x] 3.3 Agregar traducción inglesa en `src/i18n/en.ts`: `noCommitsHint: "no changes detected"`
- [x] 3.4 En el multiselect de `scan-and-select.ts`, agregar condición para `info.isNoCommits` que muestre `t().scan.noCommitsHint` como hint

## 4. Verificación

- [ ] 4.1 Ejecutar `pnpm build` y confirmar compilación sin errores
- [ ] 4.2 Verificar manualmente que en un repo con paquetes sin commits todos aparecen en el listado
- [ ] 4.3 Verificar que seleccionar un paquete `noCommits` avanza directamente al paso de tipo de bump
- [ ] 4.4 Verificar que paquetes con historial de pre-release graduado aparecen como `extraOnly` cuando hay actividad posterior en el repo (regresión #65 corregida)
- [ ] 4.5 Ejecutar `npx eslint src/commands/wizard/steps/scan-and-select.ts src/i18n/types.ts src/i18n/es.ts src/i18n/en.ts` y corregir cualquier error
