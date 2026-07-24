## Context

`getWorkspacePackages` (`src/core/workspace.ts:35`) resuelve los paquetes por precedencia: `config.packagesRoutes` → `pnpm-workspace.yaml` (workspace `pnpm`) → campo `workspaces` del `package.json` de la raíz (`npm`/`yarn`/`bun`). Cada rama sabe degradar a "repo de un solo paquete en la raíz" cuando no encuentra una declaración de workspace — **excepto** la rama en que `pnpm-workspace.yaml` existe: ahí `pnpmWorkspaceSchema.parse` (`src/schemas/index.ts:15`) exige `packages` como array obligatorio y lanza.

```
getWorkspacePackages(rootDir, config)
  │
  ├─ config.packagesRoutes no vacío ──▶ glob de esas rutas                 ✅
  │        │no
  ├─ workspace === "pnpm"
  │        │
  │        ├─ yaml ausente ──▶ package.json de la raíz → single-package    ✅
  │        │
  │        └─ yaml presente ──▶ pnpmWorkspaceSchema.parse(yaml)
  │                                 ├─ tiene packages ──▶ glob             ✅
  │                                 └─ solo-settings ──▶ 💥 ZodError       ← el hueco
  │
  └─ npm/yarn/bun ──▶ package.json raíz; sin workspaces → single-package   ✅
```

pnpm 10 (10.28.2 instalado aquí) convirtió ese yaml en el archivo de configuración general de pnpm, así que un yaml solo-settings es legítimo y frecuente. El `ZodError` sube sin formatear hasta el `catch` de `runWizardFlow` (`src/commands/wizard/index.ts:96`), donde se imprime `ZodError.message` — que en Zod v4 es el array de issues serializado en JSON — seguido del genérico `t().wizard.error`. Reproducido en este repo: el mensaje nunca menciona `pnpm-workspace.yaml`.

Restricciones del proyecto que condicionan el diseño:
- No hay runner de tests configurado ni archivos de test → la verificación es manual sobre los escenarios de los specs.
- Todo texto de cara al usuario debe pasar por `t()` con claves en `types.ts`, `es.ts` y `en.ts`.
- `src/utils/index.ts` es I/O de bajo nivel y hoy no importa `i18n`; conviene no ensuciar ese barrel.
- Precedente existente: `src/config.ts` ya emite UI (`p.log.error` / `p.log.warn`) desde un módulo no-UI, así que emitir avisos fuera de `commands/` no rompe ninguna convención.

## Goals / Non-Goals

**Goals:**
- Que `tagman release` funcione en un repo single-package con `pnpm-workspace.yaml` solo-settings, sin crash.
- Que un `packages` mal tipeado o mal escrito no derive en un release single-package silencioso: se avisa.
- Que cualquier fallo de validación de schema diga **qué archivo** y **qué campos**, en el idioma activo.
- No cambiar el comportamiento de los repos que hoy funcionan (workspace declarado, `packagesRoutes`, npm/yarn/bun).

**Non-Goals:**
- No se implementa soporte de `catalog`/`catalogs` de pnpm ni resolución de dependencias por catálogo. Solo se dejan de descartar esas claves al parsear.
- No se toca `writeYaml` (hoy sin call sites) ni se introduce round-trip de `pnpm-workspace.yaml`.
- No se suprime la salida de `p.log` en modo `--json`. El flujo ya emite avisos por stdout en ese modo (por ejemplo `wizard.noPackages` en `index.ts:106`); es una condición preexistente y arreglarla es un cambio aparte.
- No se decide el destino del `pnpm-workspace.yaml` commiteado en este repo (su valor `esbuild: set this to true or false` es un placeholder sin responder). Es una decisión de repo, no de código.

## Decisions

### 1. `packages` opcional + `.passthrough()` en `pnpmWorkspaceSchema`

`packages: z.array(z.string()).optional()` y `.passthrough()`, alineando el schema con `packageJsonSchema`.

*Por qué:* refleja la semántica real de pnpm 10, donde `packages` es opcional. El `.passthrough()` es correctitud preventiva: hoy el parseo devuelve un objeto que contiene **solo** `packages`, descartando todas las claves de settings; nada las reescribe todavía, pero es un tripwire para quien conecte `writeYaml`.

*Alternativa considerada:* validar con un schema laxo (`z.record(z.unknown())`) y extraer `packages` a mano. Rechazada: pierde la validación de tipo de `packages` — un `packages: "packages/*"` (string en vez de array) pasaría silenciosamente y luego fallaría de forma más confusa en el globbing.

### 2. Un único camino "resolver el paquete de la raíz", reutilizado

Extraer el bloque de `workspace.ts:46-57` a un helper interno (p. ej. `resolveRootPackage(rootDir)`) que devuelve `WorkspacePackage[]` o lanza el error accionable de siempre, y llamarlo desde ambos casos: yaml ausente y yaml sin `packages`.

*Por qué:* los dos casos son el mismo hecho ("no hay workspace declarado"), y el spec exige que el sub-caso "yaml solo-settings sin `package.json` en la raíz" produzca el mismo error accionable. Duplicar el bloque garantizaría que las dos ramas divergan con el tiempo.

*Nota:* `packages: []` entra por el mismo camino. Hoy un array vacío devuelve `[]` y el wizard muestra `noPackages`; con este cambio devuelve el paquete de la raíz. Es un cambio de comportamiento deliberado, capturado como escenario en el spec: un array vacío tampoco declara workspace.

### 3. El aviso se emite desde `workspace.ts` con `p.log.warn`, sin cambiar la firma

*Por qué:* mantiene `getWorkspacePackages(rootDir, config)` estable para sus dos consumidores (`wizard/index.ts:104` y `steps/checkpoint.ts:119`) y sigue el precedente de `config.ts`.

*Alternativa considerada:* devolver un array de diagnósticos para que el llamador los renderice — arquitectónicamente más limpio (core sin UI), pero obliga a cambiar la firma y a duplicar el render en los dos call sites, para un solo aviso.

*Trade-off aceptado:* en una corrida con rollback de checkpoint, `checkpoint.ts:119` descubre el workspace antes de `index.ts:104`, así que el aviso aparece dos veces. Se acepta sin flag de deduplicación: solo ocurre en el camino de rollback y repetirlo ahí es informativo, no engañoso. Un flag de módulo "ya avisé" agregaría estado global por un beneficio cosmético.

### 4. Helper de formateo en un módulo propio: `src/utils/schema-error.ts`

Firma sugerida: `formatSchemaError(filePath: string, error: ZodError): string`. Devuelve el encabezado traducido con la ruta del archivo, y debajo una línea por issue con `<path unido por puntos>: <message>`, usando `(raíz)` cuando `issue.path` está vacío.

*Por qué un módulo aparte y no `utils/index.ts`:* el helper necesita `t()`, y `utils/index.ts` es el barrel de I/O de bajo nivel que hoy no depende de `i18n`. Un módulo separado, importado directamente y **no** re-exportado desde el barrel, evita arrastrar `i18n` a todos los consumidores de `readJson`/`readYaml`. No hay riesgo de ciclo: `i18n/` no importa nada de `utils/`.

*Por qué devuelve `string` y no emite:* los tres call sites lo necesitan de forma distinta — `workspace.ts` lo usa en un `p.log.warn` (package.json por paquete, no fatal) y en el `message` de un `Error` que se lanza (yaml inválido, fatal); `config.ts` lo usa en un `p.log.warn` antes de caer a defaults. Devolver texto deja la decisión de severidad en el call site.

### 5. Los tres call sites pasan a `safeParse`

- `workspace.ts:59` (yaml): `safeParse`; si falla, lanzar `new Error(formatSchemaError(workspaceYamlPath, error))`. Así el `catch` del wizard imprime un mensaje que nombra el archivo en lugar de un volcado JSON, cumpliendo el requisito de "ningún `ZodError` se escapa como JSON".
- `workspace.ts:24-28` (package.json por paquete): reemplazar el `catch` mudo con `console.warn` en inglés por `safeParse` + `p.log.warn(formatSchemaError(...))`, manteniendo el `continue` — un paquete inválido se omite, el descubrimiento sigue. Se conserva un `try/catch` alrededor porque `readJson` también puede fallar por `JSON.parse` o por I/O, que no son `ZodError`.
- `config.ts:50`: cambiar `result.error.message` por `formatSchemaError(configPath, result.error)`. Ya usa `safeParse`, solo cambia el formateo.

### 6. Claves i18n nuevas

Agregar a `types.ts`, `es.ts` y `en.ts`. Propuesta de forma:
- `workspace.undeclaredPackages(filePath: string): string` — el aviso de degradado a paquete único.
- `workspace.invalidPackageJson(filePath: string): string` — reemplazo del `console.warn` en inglés.
- `schemaError.header(filePath: string): string` — encabezado del formateo compartido.

Agrupar las dos primeras bajo una sección `workspace` nueva mantiene la convención de agrupación por dominio que ya usa `Messages`.

## Risks / Trade-offs

- **Un `packages` mal escrito ahora produce un release single-package en vez de un crash** → mitigado por el aviso obligatorio (decisión 3), que nombra el archivo y explica la degradación. El crash previo era ruidoso pero no accionable; el aviso es accionable y no bloquea a quien sí tiene un repo single-package legítimo.
- **`packages: []` cambia de comportamiento** (antes `noPackages`, ahora paquete de la raíz) → mitigado por el mismo aviso y capturado explícitamente como escenario en el spec, para que el cambio quede documentado y no se lea como regresión.
- **Doble aviso en corridas con rollback** → aceptado conscientemente (decisión 3); no afecta correctitud.
- **`.passthrough()` deja pasar claves con typo en el yaml** (p. ej. `packagess:`) sin quejarse → intrínseco a `.passthrough()`, y es exactamente el caso que el aviso de workspace no declarado está diseñado para hacer visible.
- **Sin tests automatizados** → la verificación queda manual. Los escenarios de ambos specs están escritos para ser ejecutables a mano; el `pnpm-workspace.yaml` de este repo cubre el caso principal sin setup adicional. Los casos que requieren fixture (monorepo con `packages` declarado, `packages: []`, yaml con tipo inválido, `package.json` inválido) se verifican con directorios temporales fuera del repo.
- **Salida de `p.log` en modo `--json`** → declarado fuera de alcance (Non-Goals); el aviso nuevo no empeora una situación que ya existe con `wizard.noPackages` y otros.

## Migration Plan

No hay migración de datos ni breaking changes. El cambio es puramente aditivo en tolerancia: todo repo que funciona hoy sigue funcionando igual, y repos que hoy crashean empiezan a funcionar.

Rollback: revertir el commit. No hay estado persistido ni formato de archivo nuevo que quede atrás.

Workaround disponible mientras el fix no esté publicado — un `tagman.config.json` con `{ "packagesRoutes": ["."] }` toma la rama de máxima precedencia y nunca lee el yaml (verificado: `fg(".", { onlyDirectories: true, absolute: true })` resuelve exactamente el directorio raíz).

## Open Questions

- ¿Conviene que el aviso de workspace no declarado mencione el workaround de `packagesRoutes`, o alcanza con explicar la degradación? Inclinación: solo explicar la degradación, para no sugerir configuración que la mayoría no necesita.
- ¿Vale extender el mismo formateo al `catch` genérico de `runWizardFlow` (`index.ts:96`), detectando `ZodError` como red de seguridad para cualquier sitio futuro? Queda fuera del alcance elegido, pero es el complemento natural si aparecen más lecturas con schema.
