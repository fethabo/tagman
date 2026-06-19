## Why

En el flujo de selección de paquetes del wizard de release, una vez que el usuario elige los paquetes a versionar y los bumps correspondientes, la única manera de corregir una selección errónea (o descartar un paquete que no debería incluirse) es abortar todo con Ctrl+C y comenzar desde cero. Además, la lista de paquetes seleccionados no muestra la versión que fue asignada, lo que obliga al usuario a recordarla mentalmente durante el proceso.

## What Changes

- La pantalla de resumen/confirmación (step 2 / lista de paquetes seleccionados para release) mostrará la nueva versión calculada junto al nombre de cada paquete.
- Se añadirá un mecanismo interactivo para deseleccionar paquetes ya incluidos en el release sin necesidad de abortar el wizard: el usuario podrá volver al listado de selección y quitar un paquete previamente elegido.

## Capabilities

### New Capabilities

- `package-selection-version-display`: Mostrar la versión destino (nueva versión calculada) junto a cada paquete en la lista de paquetes seleccionados durante el wizard de release.
- `package-deselect`: Permitir al usuario quitar un paquete ya seleccionado de la lista de release sin abortar el wizard; el flujo regresa al paso de selección con el estado previo restaurado.

### Modified Capabilities

<!-- No hay specs existentes que cambien en sus requerimientos funcionales -->

## Impact

- `src/commands/wizard/steps/scan-and-select.ts` — lógica principal del flujo de selección y visualización de paquetes; ambas funcionalidades se integran aquí.
- `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/es.ts` — nuevas claves de UI para las etiquetas de versión y la opción de deselección.
- Sin cambios en APIs externas, dependencias ni formatos de checkpoint/draft.
