# Design

## Context

La motivación está en proposal.md ("Why") y los requisitos en `specs/`. Este documento parte del estado actual del código:

- **Prompts dispersos.** Hay unos 30 puntos de interacción repartidos en `checkpoint.ts`, `scan-and-select.ts`, `tag-messages.ts`, `execute.ts`, `wizard/index.ts` y `github-release.ts`. Algunos llaman directamente a `p.confirm/select/multiselect/text` y otros pasan por los wrappers propios (`wizardSelect`, `commitMultiSelect`, `showScanSummaryPrompt`, `showDraftResumePrompt`). Solo algunos consultan `yes`. `promptTagMessages` no lo recibe.
- **Cancelación indistinguible.** Con stdin cerrado, clack resuelve el prompt como cancel. El patrón `if (p.isCancel(x)) { p.cancel(); return null; }` convierte eso en una salida normal, y nada fija `process.exitCode`. El `catch` del orquestador también traga el error con código 0.
- **Todo va a stdout.** La UI de clack 1.1 escribe en `process.stdout` por defecto (`output = process.stdout`, resuelto en cada llamada) y llama a `output.write(...)`. El JSON de `--json` también sale por `console.log`.
- **`--lang` duplicado.** Está declarado en el programa raíz y en cada subcomando con default `"es"`. La `action` del raíz no corre cuando hay subcomando.
- **Error de tipos.** `wizardSelect` retorna `T | symbol | typeof SELECT_BACK`. Después de `p.isCancel()`, TypeScript descarta todos los `symbol` y considera imposible la comparación con `SELECT_BACK`.
- **Tests disponibles.** Ya existe un runner (`pnpm test` → `tsx --test src/**/*.test.ts`), que permite agregar tests unitarios.

## Goals / Non-Goals

**Goals:**
- Una única fuente de verdad que defina si se puede interactuar, consultada por todos los prompts.
- Que agregar un prompt nuevo sin manejo headless falle en los tests, no en producción.
- Un solo punto de salida del proceso que traduzca resultados a código de salida y documento JSON.

**Non-Goals:**
- Flags `--resume` / `--rollback` para checkpoints. Con `--yes`, un checkpoint pendiente falla y se resuelve en modo interactivo.
- Modo headless para `tagman github-release`. Solo hereda la red de seguridad (código 2) y los códigos de salida.
- Agregar `tsc --noEmit` a CI. Se deja el script `typecheck` listo y cablearlo queda para otro cambio.
- Cambiar el comportamiento de Ctrl+C en modo interactivo.

## Decisions

### D1. Modo de ejecución como estado de proceso (`src/ui/mode.ts`)

Se agrega un módulo con estado, inicializado una vez en la `action` de cada comando:

```
RunMode = { interactive: boolean; json: boolean }
interactive = !yes && process.stdin.isTTY === true
```

Los steps lo consultan con `getRunMode()` en lugar de recibir `yes` por parámetro en cada firma.

- **Por qué:** pasar `yes` a cada función es justamente lo que se olvidó con `promptTagMessages`. Un estado de proceso es aceptable porque tagman ejecuta un solo flujo por proceso, igual que ya hace con el locale (`setLocale`).
- **Alternativa descartada:** agregar `yes` a la firma de cada step. Es explícito, pero deja el mismo agujero cuando aparezca un step nuevo.

Los steps existentes que ya reciben `yes` (scan, execute) pueden seguir recibiéndolo. Lo importante es que la red de D2 no dependa de eso.

### D2. Prompts con guard en un módulo propio (`src/ui/prompts.ts`)

`confirm`, `select`, `multiselect` y `text` se re-exportan con guard. Al inicio de cada uno se llama a `assertInteractive(promptId)`, que en modo no interactivo lanza `HeadlessError({ reason: "interaction-required", exitCode: 2, message })`.

- `wizardSelect`, `commitMultiSelect` y los prompts de resumen y borrador llaman a `assertInteractive` al principio.
- **Test de arquitectura** (`src/ui/prompts.test.ts`): recorre `src/**/*.ts` y falla si encuentra `p.confirm(`, `p.select(`, `p.multiselect(` o `p.text(`, o un `new *Prompt(` de `@clack/core`, fuera de `src/ui/` y de los wrappers autorizados. Así el problema no vuelve a aparecer en silencio.
- **Por qué no un monkey-patch de `@clack/prompts`:** los imports ESM son de solo lectura y CLAUDE.md prohíbe tocar `node_modules`. Re-exportar es explícito y tipado.
- **`promptId`:** una clave estable (p. ej. `"tag-create"`, `"push"`) que el mensaje de error incluye, para que quien lea el log sepa qué flag falta.

### D3. Resoluciones headless explícitas antes de cada prompt

D2 es la red de seguridad. Además, cada prompt conocido resuelve `--yes` antes de llegar al guard:

| Punto | Con `--yes` |
|---|---|
| Working tree sucio (`checkpoint.ts`) | `--allow-dirty` → continuar; si no → `HeadlessError("dirty-tree", 1)` |
| Rama atrasada | `requireRemoteSync` → error, como hoy; `--allow-behind` → continuar con warning; si no → `HeadlessError("behind-remote", 1)` |
| Checkpoint pendiente | `HeadlessError("pending-checkpoint", 1)` |
| Selección de paquetes | sin `--packages` → `HeadlessError("packages-required", 1, { candidates })`; sin coincidencias → `"package-not-found"` |
| Bump | `globalBump` si existe; si no, el `initialValue` que hoy recibe `wizardSelect` en el prompt de bump. Se extrae a una función pura `defaultBumpFor(pkgInfo, suggested)` para que interactivo y headless no diverjan y se pueda testear |
| Conflicto de graduación | `upgrade = true` (el `initialValue` actual) |
| Tags (`tag-messages.ts`) | `promptTagMessages` retorna enseguida y deja `details.tagMessage` como lo generó el scan; si `bump === "graduate"`, usa `buildGraduationMessage` |
| Push | `doPush = push`, sin preguntar |
| "Nada para liberar" (`wizard/index.ts`) | sin menú; resultado `no-commits` con código 0 |

**Por qué el principio "opción preseleccionada":** mantiene una sola definición del comportamiento por defecto. Si alguien cambia el default interactivo, el headless lo sigue. Las compuertas de seguridad son la excepción documentada.

### D4. Resultado tipado y un único punto de salida

Hoy los steps retornan `null` o `false` en cualquier fallo. Se agrega `HeadlessError` (clase con `reason`, `exitCode` y `extra?`), que se lanza solo en modo no interactivo. El contrato de cancelación interactiva de CLAUDE.md no cambia: en modo interactivo los steps siguen retornando `null`.

La `action` de cada comando envuelve el flujo en `runCommand(fn)`, que:

- en éxito, si `json`, emite el documento de éxito (el que hoy arma `execute.ts`, que pasa a retornarlo en lugar de imprimirlo);
- ante un `HeadlessError`, muestra `p.log.error(message)` y, si `json`, emite `{ success:false, reason, message, ...extra }`; luego fija `process.exitCode = exitCode`;
- ante cualquier otro error, hace lo mismo con `reason: "error"` y `exitCode: 1`;
- usa `process.exitCode` en lugar de `process.exit()`, para que terminen de escribirse stdout y los spinners.

`no-commits` no es un error: el flujo lo retorna como resultado y `runCommand` emite `{ success:false, reason:"no-commits" }` con código 0. Lo mismo pasa con una cancelación interactiva (`reason: "cancelled"`), para que `--json` siempre emita un documento.

**Agregado durante la implementación:** `execute.ts` tenía tres caminos de fallo que logueaban, revertían y hacían `return` con código 0: fallo de escritura, fallo de tags y fallo del cherry-pick del reorder. Ahora lanzan `ReportedError`, y `runCommand` fija el código 1 sin volver a loguear.

### D5. stdout reservado para JSON

Con `--json`, al inicio de la `action`:

```
const writeJson = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);
```

Toda la UI (clack, `console.log` de terceros, los `render()` propios que usan `process.stdout`) termina en stderr, y `runCommand` emite el JSON con `writeJson`. Con `--json` no se ejecuta `console.clear()`.

- **Por qué:** clack 1.1 acepta `output` por llamada, pero habría que pasarlo en unos 100 call sites y en los wrappers propios. Además, cualquier log nuevo lo rompería. Redirigir en un solo punto cubre todo y se puede testear.
- **Alternativa descartada:** suprimir la UI por completo con `--json`. Se pierde el diagnóstico en CI, y los agentes leen stderr de todos modos.
- **Riesgo:** el spinner consulta `isTTY` de su `output` (stdout). Si stdout está redirigido a un archivo, el spinner no anima aunque stderr sea una TTY. Es aceptable: imprime mensajes estáticos.

### D6. `--lang` global con `preAction`

`--lang` se declara solo en el `program` raíz. Un hook `program.hook("preAction", (_, actionCmd) => setLocale(actionCmd.optsWithGlobals().lang))` lo aplica antes de cualquier `action`. Se quita la opción de `wizardCommand` y `githubReleaseCommand`.

`tagman release --lang en` sigue funcionando: con la opción solo en el raíz, Commander la acepta después del subcomando porque es global. Hay que verificar que el subcomando no la rechace como desconocida. Si la rechaza, se usa `.enablePositionalOptions(false)` o se mantiene la opción en el subcomando sin default y se resuelve con `optsWithGlobals()`, priorizando la del subcomando.

### D7. Narrowing de `SELECT_BACK`

En `github-release.ts`, se compara con `SELECT_BACK` **antes** de `p.isCancel()`. Es el orden que ya usan `scan-and-select.ts` y `tag-messages.ts`. No se cambia el tipo de retorno de `wizardSelect`: el orden correcto alcanza y es consistente con el resto. Se agrega `"typecheck": "tsc --noEmit"` a `package.json`.

## Risks / Trade-offs

- **[Riesgo] Un prompt con resolución explícita mal implementada se adelanta al guard y toma una decisión indebida.** → Cada resolución de D3 tiene un escenario en `specs/headless-release`. Los valores por defecto se extraen a funciones puras con tests unitarios (`defaultBumpFor`, resolución de compuertas).
- **[Riesgo] El test de arquitectura da falsos positivos** (p. ej. un comentario que menciona `p.confirm(`). → Ignorar líneas de comentario y mantener una lista blanca explícita de archivos.
- **[Trade-off] Estado global de modo.** → Es el mismo patrón que `setLocale`. Se resetea en tests con `setRunMode()`.
- **[Riesgo] Cambio visible para quien hoy usa `--yes` en una terminal y contesta a mano el tag o el push.** → Se documenta en el CHANGELOG como cambio de comportamiento. Ese uso contradecía la documentación existente.
- **[Riesgo] Redirigir `process.stdout.write` afecta a librerías que esperan stdout real** (p. ej. `pnpm publish` como proceso hijo). → Los procesos hijo usan sus propios descriptores, no el `write` parcheado. Por eso `pnpm publish`, que heredaba el fd 1 (`stdio: "inherit"`), sí habría corrompido el JSON. Con `--json` ahora su stdout va al fd 2. `simple-git` captura la salida y no se ve afectado.
- **[Trade-off] Graduación automática.** Con `--yes`, un pre-release sin commits nuevos pedido en `--packages` se gradúa a estable, porque es la opción preseleccionada. Es coherente con la regla, pero es la decisión con más impacto que toma el modo headless.

## Migration Plan

No hay migración de datos ni de config. Se publica como minor, porque agrega flags y contrato JSON y corrige un comportamiento documentado. El CHANGELOG indica que `--yes` ya no pregunta por tag ni push y que ahora falla con un working tree sucio.
