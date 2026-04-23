## Why

Al retomar un borrador, el usuario ve cuántos commits tiene cada paquete pero no sus mensajes, lo que obliga a reconstruir mentalmente qué se planeó. Agregar la tecla 'd' para alternar la vista de commits aplica la misma UX ya consolidada en el paso 2 del wizard.

## What Changes

- El prompt de "Retomar / Descartar" borrador soporta la tecla `[d]` para alternar la visibilidad del listado de commits por paquete.
- Cuando `showDetails = true`, bajo cada línea de resumen (`pkg: v1 → v2  (N commits)`) aparecen los mensajes de los commits seleccionados.
- La barra de hints del prompt incluye `[d] ver commits`.
- Se agregan claves i18n para el hint y el label de commits.

## Capabilities

### New Capabilities

- `draft-resume-details`: Prompt de retoma de borrador con toggle interactivo de detalles de commits (tecla `d`), implementado como clase custom que extiende `SelectPrompt` de `@clack/core`, siguiendo el patrón de `commitMultiselect`.

### Modified Capabilities

_(ninguna — sin cambios en contratos de specs existentes)_

## Impact

- `src/commands/wizard/index.ts` — reemplaza la llamada a `wizardSelect` en el bloque de draft por el nuevo prompt custom
- `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts` — nuevas claves en el namespace `draft` para el hint del toggle y el label de commits
