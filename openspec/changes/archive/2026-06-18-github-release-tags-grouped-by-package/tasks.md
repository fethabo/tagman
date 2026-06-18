## 1. Git layer — metadatos de tags

- [x] 1.1 Agregar `TagInfo` type en `src/git/index.ts`: `{ name: string; date: string; tagger: string }`
- [x] 1.2 Implementar `listTagsWithMeta(): Promise<TagInfo[]>` usando `git tag -l --sort=-creatordate --format=...` para obtener nombre, fecha y tagger en una sola llamada
- [x] 1.3 Exportar `listTagsWithMeta` desde `src/git/index.ts`

## 2. Agrupación de tags por paquete

- [x] 2.1 Implementar función helper `groupTagsByPackage(tags: TagInfo[]): Map<string, TagInfo[]>` en `github-release.ts` que parsea `<name>@<version>` y agrupa los tags (no-match → clave `"(otros)"`)

## 3. Selector jerárquico en `github-release.ts`

- [x] 3.1 Reemplazar la llamada a `listAllTags()` por `listTagsWithMeta()` en `runGithubReleaseFlow()`
- [x] 3.2 Implementar loop iterativo: selector de paquete con `wizardSelect` (incluye opción "Listo" deshabilitada si no hay tags seleccionados aún)
- [x] 3.3 Al elegir un paquete: mostrar selector de versión con `wizardSelect` incluyendo opción `[b] volver`; cada opción muestra versión + fecha + tagger
- [x] 3.4 Acumular tags seleccionados; marcar visualmente en el selector de paquete los que ya tienen tag elegido (e.g. `✓ package-name`)
- [x] 3.5 Al elegir "Listo": continuar con el array de tags acumulado (debe tener al menos 1)

## 4. i18n

- [x] 4.1 Agregar claves en `src/i18n/types.ts`: `selectPackage`, `selectTagVersion`, `doneSelectingTags`, `noTagsSelectedYet`, `alreadySelected`
- [x] 4.2 Agregar strings en `src/i18n/es.ts`
- [x] 4.3 Agregar strings en `src/i18n/en.ts`

## 5. Verificación

- [x] 5.1 Compilar con `pnpm build` y verificar que no hay errores de TypeScript
- [ ] 5.2 Ejecutar `pnpm dev github-release` en un repo con múltiples paquetes y verificar el flujo completo
