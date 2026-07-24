# Design — fix-windows-publish-and-scan-gaps

## Context

Cinco defectos independientes de bajo riesgo, detectados en la auditoría, agrupados para no fragmentar en micro-changes. Ninguno cambia contratos entre módulos; cada uno es local a su archivo.

## Goals / Non-Goals

**Goals:**
- Publicación npm operativa en Windows.
- Chequeos de red del scan consistentes con el modelo de auth por token existente.
- Sin excepciones no controladas por rangos git inválidos; sin markdown roto en salidas.

**Non-Goals:**
- Rediseñar `publishPackage` (streams, output estructurado) — se conserva `stdio: "inherit"`.
- El modo `tagName: "version-only"` (baseline de escaneo roto) — requiere decisión de diseño propia; queda para otra propuesta.
- Filtro de merges del issue #63 — mejora funcional aparte.

## Decisions

1. **Windows spawn: `shell: process.platform === "win32"`** en las opciones de `spawn`, manteniendo el binario `pnpm`. Alternativas: resolver `pnpm.cmd` a mano (frágil ante instalaciones via corepack/scoop) o depender de `cross-spawn` (dependencia nueva para un solo call site). Los argumentos actuales son constantes controladas (`--access=public|restricted`), sin riesgo de quoting.
2. **Token de graduación: pasar el `ghToken` ya resuelto en `scanAndSelectPackages`** (línea 65) al llamado de `getLatestRemoteStableVersion` (línea 556). Cero lógica nueva: la firma ya acepta `token?`, es el mismo patrón aplicado en `d45e397` a `checkRemoteSync` y `pushRelease`.
3. **Guard de `lastTag` nulo:** si `pkgInfo.lastTag === null` en el bloque de cero-commits-sobre-pre-release, se omite el cálculo de `computedLiftCommits` (queda `[]`, sin reorder posible) y se continúa directo a la pregunta de graduación. No se intenta un baseline alternativo: sin tag no hay rango que reordenar.
4. **`formatCommitList`:** el fallback `([${shortHash}](${c.hash}))` se reemplaza por texto plano: cascade → sin sufijo de hash; sin `baseUrl` → `(${shortHash})`. GitHub autolinkea hashes cortos cuando hay repo, que es el caso con `baseUrl` (sin cambios ahí).
5. **`suggestBump`:** reemplazar `commitMsg.includes("!:")` por un test sobre el header: `/^[a-zA-Z]+(\([^)]*\))?!:/`. Se conserva la detección por notas del parser y por texto `BREAKING CHANGE`.
6. **`package.json`:** eliminar el campo `module` (typo `.dist/index.mjs`); el paquete es ESM puro con `main`/`bin` correctos y tsup no genera `.mjs`.

## Risks / Trade-offs

- [`shell: true` en win32 introduce interpretación de shell] → Args constantes y controlados; sin input del usuario en la línea de comandos.
- [Quitar `module` podría afectar bundlers que lo lean] → Apuntaba a un archivo inexistente: cualquier consumidor que lo leyera ya estaba roto; `main` cubre el caso.
- [El cambio de `suggestBump` puede alterar sugerencias existentes] → Solo elimina falsos positivos; los formatos convencionales legítimos (`feat!:`, `feat(scope)!:`) siguen detectándose.
