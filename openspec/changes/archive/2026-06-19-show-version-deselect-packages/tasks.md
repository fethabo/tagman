## 1. i18n — nuevas claves de UI

- [x] 1.1 Agregar claves en `src/i18n/types.ts`: `scan.removePackages` (label opción), `scan.removePackagesTitle` (mensaje del multiselect de quitar), `scan.removePackagesEmpty` (warning al quedar vacío)
- [x] 1.2 Agregar traducciones en `src/i18n/es.ts` para las tres claves nuevas
- [x] 1.3 Agregar traducciones en `src/i18n/en.ts` para las tres claves nuevas

## 2. Versión en el multiselect de step 1

- [x] 2.1 En `src/commands/wizard/steps/scan-and-select.ts`, modificar el mapeo de opciones del `p.multiselect` (líneas ~146-162) para incluir la versión actual en el `label` de cada opción, siguiendo el formato definido en el spec (`<name> (<version>) — <N> commits` para regulares; `<name> (<version>)` para los demás tipos)

## 3. Deselección de paquetes desde el resumen

- [x] 3.1 En `src/commands/wizard/scan-summary-prompt.ts`, añadir `"remove"` al tipo de retorno de `showScanSummaryPrompt` (`"proceed" | "save" | "back" | "remove" | symbol`)
- [x] 3.2 Agregar la opción `{ value: "remove", label: t().scan.removePackages }` a la lista de opciones del `SelectPrompt` en `showScanSummaryPrompt`
- [x] 3.3 Agregar la tecla de hint `[r]` (o simplemente mostrar la nueva opción en la lista sin shortcut adicional) en la barra de hints del render
- [x] 3.4 En `src/commands/wizard/index.ts`, manejar el valor `"remove"` retornado por `showScanSummaryPrompt`: abrir un `p.multiselect` con los paquetes del state pre-seleccionados, eliminar del state los desmarcados, y si el state queda vacío emitir warning y hacer `continue` (volviendo a scan)
