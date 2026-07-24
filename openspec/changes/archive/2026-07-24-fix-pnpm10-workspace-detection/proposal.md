## Why

pnpm 10 convirtió `pnpm-workspace.yaml` en el archivo de configuración general de pnpm (`allowBuilds`, `onlyBuiltDependencies`, `catalog`, y la mayoría de las claves que antes vivían en `.npmrc`), por lo que un `pnpm-workspace.yaml` **sin** la clave `packages` es perfectamente legítimo — y pnpm lo crea por su cuenta cuando necesita una decisión de aprobación de builds. `pnpmWorkspaceSchema` exige `packages` como array obligatorio, así que en cualquier repo single-package con un yaml solo-settings el flujo `tagman release` muere con un `ZodError` crudo antes de escanear nada. El propio repositorio de tagman está en ese estado hoy (pnpm 10.28.2, yaml commiteado en `f3b07e6`), y el error que ve el usuario es un volcado JSON de issues seguido de un genérico "Ocurrió un error." que nunca menciona el archivo culpable.

## What Changes

- **Detección de workspace tolerante a pnpm 10**: `packages` pasa a ser opcional en `pnpmWorkspaceSchema`. Cuando `pnpm-workspace.yaml` existe pero no declara `packages` (o lo declara vacío), `getWorkspacePackages` degrada al mismo camino single-package que ya usa la rama "yaml ausente" (leer el `package.json` de la raíz) en lugar de lanzar.
- **Aviso de workspace no declarado**: ese fallback emite un aviso al usuario indicando que el yaml no declara `packages` y que se está tratando el repo como paquete único, para que un typo en la clave no derive en un release single-package silencioso.
- **`pnpmWorkspaceSchema` con `.passthrough()`**: deja de descartar todas las claves de settings de pnpm al parsear, alineándose con `packageJsonSchema` y eliminando el riesgo latente de pérdida de datos si alguna vez se reescribe el archivo.
- **Atribución de archivo en errores de schema**: nuevo helper compartido que formatea un `ZodError` como texto legible con la ruta del archivo y la lista de campos inválidos (`campo: mensaje`), en lugar del `ZodError.message` JSON de Zod v4. Se aplica en todos los sitios que parsean con schema: la lectura de `pnpm-workspace.yaml`, la del `package.json` por paquete (que hoy además loguea en inglés fuera del sistema `t()`), y `loadConfig`.
- **Sin cambios de comportamiento** para repos con `packages` declarado, `packagesRoutes` configurado, o workspaces npm/yarn/bun.

## Capabilities

### New Capabilities
- `workspace-detection`: cómo tagman descubre los paquetes del monorepo a partir de `packagesRoutes`, `pnpm-workspace.yaml` o el `package.json` de la raíz, incluyendo el degradado a single-package y los avisos asociados.
- `schema-error-reporting`: cómo se presentan al usuario los fallos de validación de schema al leer archivos del proyecto, con atribución de archivo y campos, traducidos vía `t()`.

### Modified Capabilities
<!-- Ninguna: full-workspace-listing cubre el listado del paso 1 del wizard, no el descubrimiento del workspace. Los requisitos existentes no cambian. -->

## Impact

**Código afectado:**
- `src/schemas/index.ts` — `pnpmWorkspaceSchema`: `packages` opcional + `.passthrough()`
- `src/core/workspace.ts` — rama pnpm (`:59`) con fallback y aviso; extracción del camino single-package hoy duplicado en `:46-57`; reemplazo del `console.warn` en inglés de `:27`
- `src/utils/index.ts` — helper de formateo de errores de schema (o módulo nuevo si conviene aislarlo)
- `src/config.ts` — `loadConfig` (`:50`) pasa a usar el helper en vez de `result.error.message`
- `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts` — claves nuevas para el aviso de workspace no declarado y para el encabezado del error de schema

**Superficie de usuario:** `tagman release` (vía `src/commands/wizard/index.ts:104`) y el chequeo de rollback de checkpoint (`src/commands/wizard/steps/checkpoint.ts:119`), ambos consumidores de `getWorkspacePackages`.

**Alcance del bug:** afecta a cualquier usuario del CLI publicado con pnpm 10 y un repo single-package cuyo `pnpm-workspace.yaml` contenga solo settings — un crash duro, no una degradación. El `pnpm-workspace.yaml` de este repo queda además como caso de prueba real.

**Dependencias:** ninguna nueva. No hay runner de tests configurado en el proyecto, así que la verificación es manual sobre los escenarios de los specs.
