## 1. i18n — nueva clave de UI

- [x] 1.1 Agregar clave `githubRelease.deselectTag` en `src/i18n/types.ts`
- [x] 1.2 Agregar traducción en `src/i18n/es.ts`: `"Quitar de la selección"`
- [x] 1.3 Agregar traducción en `src/i18n/en.ts`: `"Remove from selection"`

## 2. Versión visible en el listado de paquetes

- [x] 2.1 En `src/commands/github-release.ts`, en el mapeo de `packageOptions` (función `runGithubReleaseFlow`, dentro del `while (true)`): cuando `selectedByPackage.has(pkg)`, extraer la versión del tag seleccionado (`selectedByPackage.get(pkg)`) usando la misma regex `NAME_VERSION_RE` o un split por `@`, y construir el label como `` `${color.green("✓")} ${pkg}  ${color.dim(version)}` `` en lugar del texto genérico "Ya seleccionado"

## 3. Opción de deselección en el selector de versión

- [x] 3.1 En `src/commands/github-release.ts`, definir la constante `DESELECT_SENTINEL = "__deselect__"` junto a `DONE_SENTINEL`
- [x] 3.2 Al construir `versionOptions` para `wizardSelect`, si `selectedByPackage.has(chosenPkg)`, anteponer una opción `{ value: DESELECT_SENTINEL, label: t().githubRelease.deselectTag }` al inicio de la lista
- [x] 3.3 Tras el `wizardSelect` de versión, manejar `versionResult === DESELECT_SENTINEL`: eliminar el tag correspondiente de `selectedTags` (splice por índice) y hacer `delete` / `selectedByPackage.delete(chosenPkg)`, luego `continue` para volver al loop principal sin ejecutar el bloque de asignación de tag
