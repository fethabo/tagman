# fix-windows-publish-and-scan-gaps

## Why

La auditoría encontró un grupo de defectos puntuales, independientes entre sí y de arreglo acotado, que conviene despachar juntos sin bloquear las propuestas grandes: (1) `npm.publish` está roto en Windows — `spawn("pnpm", ...)` sin `shell` da `ENOENT` porque `pnpm` es un shim `.cmd`, así que la publicación falla el 100% de las veces en win32; (2) el chequeo remoto de conflictos al graduar un pre-release no pasa el token ya resuelto (`scan-and-select.ts:556`), por lo que en remotos HTTPS privados el fetch falla en silencio y la advertencia de versión estable en conflicto nunca aparece; (3) un paquete con versión pre-release en el manifest pero sin ningún tag produce el rango inválido `null..HEAD` y una excepción no controlada; (4) los pseudo-commits de cascada generan links markdown rotos `([cascade](cascade))` en CHANGELOG y mensajes de tag; (5) typo en `package.json`: `"module": ".dist/index.mjs"` apunta a una ruta inexistente.

## What Changes

- `publishPackage` invoca pnpm de forma compatible con Windows (shell en win32), manteniendo el comportamiento actual en POSIX.
- `getLatestRemoteStableVersion` recibe el `ghToken` ya resuelto en el scan (mismo patrón que el resto de las operaciones de red autenticadas del commit `d45e397`).
- Guard para `lastTag === null` en el camino de graduación con cero commits seleccionados: se omite el cálculo de lift en lugar de construir `null..HEAD`.
- `formatCommitList` deja de emitir links markdown para commits sin hash real: las entradas de cascada muestran el texto sin link, y los commits sin `baseUrl` muestran el hash corto sin URL inválida.
- Corrección del campo `module` en `package.json` (eliminarlo o apuntarlo a `dist/index.js`).
- Ajuste del falso positivo de `suggestBump`: la detección de breaking change por `!` se limita al header conveniente (`tipo(scope)!:`) en lugar de `includes("!:")` sobre todo el mensaje.

## Capabilities

### New Capabilities

- `release-pipeline-hardening`: correcciones de robustez del pipeline de release — publicación npm multiplataforma, chequeos remotos autenticados en graduación, tolerancia a paquetes sin tags, y formato correcto de changelog/anotaciones para commits sintéticos.

### Modified Capabilities

<!-- No hay specs existentes previas. -->

## Impact

- `src/integrations/npm.ts` — spawn compatible con Windows.
- `src/commands/wizard/steps/scan-and-select.ts` — token en el chequeo de graduación (línea 556) y guard de `lastTag` nulo (línea 273).
- `src/core/updater.ts` — `formatCommitList` (hashLink para cascade / sin baseUrl).
- `src/core/commits.ts` — regex de breaking change en `suggestBump`.
- `package.json` — campo `module`.
- Sin cambios de configuración ni breaking changes.
