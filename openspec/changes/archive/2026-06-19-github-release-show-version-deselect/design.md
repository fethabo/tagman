## Context

`runGithubReleaseFlow()` en `src/commands/github-release.ts` implementa un loop interactivo:
1. Lista todos los paquetes con tags locales agrupados por nombre.
2. El usuario elige un paquete (`wizardSelect`).
3. Elige una versión/tag para ese paquete (`wizardSelect`).
4. Repite hasta presionar "Finalizar".
5. Crea los GitHub Releases para todos los tags seleccionados.

Estado actual problemático:
- La label de un paquete ya seleccionado es `✓ pkg  (Ya seleccionado)` — sin versión.
- La versión elegida está disponible en `selectedByPackage.get(pkg)` (formato `pkg@1.2.3`); solo hay que extraer la parte después de `@`.
- No existe forma de eliminar un paquete de la selección sin Ctrl+C.

## Goals / Non-Goals

**Goals:**
- Mostrar la versión del tag elegido junto al nombre del paquete en el listado principal.
- Permitir quitar un paquete seleccionado desde el selector de versión del mismo paquete.

**Non-Goals:**
- Cambiar la lógica de creación de releases ni el formato de tags.
- Agregar una pantalla de resumen separada (el loop ya actúa como resumen vivo).
- Soporte multi-tag por paquete (una selección por paquete, comportamiento actual conservado).

## Decisions

### D1: Dónde mostrar la versión seleccionada

**Decisión:** reemplazar el texto `(Ya seleccionado)` en el label del paquete por la versión del tag elegido.

**Formato:** `✓ pkg-a  1.2.3` (la versión extraída del tag `pkg-a@1.2.3`).
Para tags en formato `version-only` (sin nombre de paquete), el tag completo es la versión, se muestra tal cual.

**Alternativa descartada:** mostrar el tag completo (`pkg-a@1.2.3`). Es redundante con el nombre del paquete en el label; la versión sola (`1.2.3`) es más legible.

### D2: Mecanismo de deselección

**Decisión:** cuando el usuario entra al selector de versión de un paquete que **ya tiene** un tag seleccionado, agregar una opción especial `"__deselect__"` al principio de la lista de versiones, con label `t().githubRelease.deselectTag`. Si la elige, se elimina el paquete de `selectedByPackage` y su tag de `selectedTags`, y el loop principal vuelve a iterar (el paquete aparece sin checkmark).

**Alternativa descartada:** agregar una opción global "Quitar paquete" en el listado principal. Requiere un paso extra de selección y mezcla la acción de quitar con la de elegir. La opción en el selector de versión es más directa: el usuario ya está en contexto de ese paquete.

**Alternativa descartada:** interceptar la re-selección del mismo tag como "toggle" (seleccionar lo que ya estaba = deseleccionar). Ambiguo y no descubrible.

### D3: Claves i18n

Nueva clave `githubRelease.deselectTag` para el label de la opción de quitar. La descripción de versión seleccionada reutiliza el texto `dim` inline (no necesita clave nueva).

## Risks / Trade-offs

- [Label más corto sin "Ya seleccionado"] → Usuarios que no conocen el checkmark verde podrían no entender que ya hay una selección. Mitigación: el checkmark verde sigue siendo el indicador primario; la versión lo complementa.
- [Opción de deselect solo aparece al re-entrar al paquete] → No hay un botón global de "limpiar todo". Mitigación: el flujo es por paquete, es coherente con el diseño actual.
