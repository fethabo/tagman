## Why

La opción "Quitar paquete(s)" introducida en `show-version-deselect-packages` tiene un bug de flujo de control: el `continue` que finaliza el handler de `"remove"` pertenece al `while (true)` externo del wizard, que re-ejecuta `scanAndSelectPackages` desde cero — incluyendo el re-escaneo de commits y la re-selección de commits por paquete. El usuario espera que tras quitar paquetes el flujo continúe desde el resumen (con los paquetes restantes), nunca que vuelva al paso 1.

## What Changes

- El prompt de resumen post-scan (`showScanSummaryPrompt`) pasa a estar dentro de su propio loop interno en `wizard/index.ts`.
- `"remove"` con paquetes restantes → el loop interno re-muestra el resumen actualizado.
- `"remove"` con estado vacío → salida limpia (cancel + return), sin re-escanear.
- `"back"` sigue rompiendo al loop externo (re-escanear), igual que antes.
- `"proceed"` y `"save"` conservan su comportamiento actual.

## Capabilities

### New Capabilities

<!-- Ninguna capacidad nueva; solo corrección de comportamiento. -->

### Modified Capabilities

- `package-deselect`: El flujo tras deseleccionar paquetes nunca debe volver al step 1 de selección de commits. Si quedan paquetes, re-muestra el resumen; si no quedan, cierra limpiamente.

## Impact

- `src/commands/wizard/index.ts` — único archivo a modificar: reemplazar el bloque `if (summaryAction === "remove") { ... continue }` por un loop interno alrededor de `showScanSummaryPrompt`.
- Sin cambios en i18n, prompts ni otros archivos.
