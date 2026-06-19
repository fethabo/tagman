## Why

En el flujo de `github-release`, el listado de paquetes muestra `✓ pkg (Ya seleccionado)` cuando un tag ya fue elegido, pero no indica cuál versión/tag fue seleccionado. El usuario tiene que recordarlo de memoria. Además, una vez que un paquete está en la selección, no hay manera de quitarlo completamente sin abortar con Ctrl+C y comenzar desde cero — re-seleccionar el mismo paquete solo permite cambiar el tag, no eliminarlo de la lista.

## What Changes

- La etiqueta del paquete en el listado principal mostrará la versión del tag seleccionado en lugar del texto genérico "Ya seleccionado" (e.g., `✓ pkg-a  1.2.3` en lugar de `✓ pkg-a  (Ya seleccionado)`).
- Cuando el usuario navega a un paquete que ya tiene un tag seleccionado, el selector de versión incluirá una opción "Quitar de la selección" al principio de la lista, permitiendo eliminarlo sin reiniciar el flujo.

## Capabilities

### New Capabilities

- `github-release-version-display`: Mostrar la versión del tag seleccionado junto al nombre del paquete en el listado principal de `github-release`.
- `github-release-deselect`: Permitir al usuario quitar un paquete ya seleccionado de la lista de releases sin abortar el flujo; aparece como opción en el selector de versión cuando el paquete ya tiene un tag elegido.

### Modified Capabilities

<!-- No hay specs existentes que cambien en sus requerimientos funcionales -->

## Impact

- `src/commands/github-release.ts` — único archivo de implementación; ambas funcionalidades se integran en el loop principal de `runGithubReleaseFlow()`.
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — nuevas claves para el label de deselección y el hint de versión seleccionada.
- Sin cambios en integrations, git, ni config.
