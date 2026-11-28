# Design

## Context

Motivación en `proposal.md`. Estado actual relevante:

- El nombre del tag se arma en 5 lugares con el mismo ternario (`execute.ts` `buildTagName` y l.170, `checkpoint.ts` l.152 y l.193, `scan-and-select.ts` l.739). La lectura no consulta `tagName` en ningún lado: `getTagsSortedBySemver` hace `git tag -l "<pkg>@*"` y corta `pkg.length + 1` caracteres; `getUnreleasedCommitsForPath` y `getUnreleasedRepoCommits` llaman a `listAllTags("<pkg>@*")` y pasan cada tag como `^tag` **sin filtrar por semver**.
- `appendToChangelog` arma el link con `${pkgName}@` fijo.
- `src/git/index.ts` crea la instancia `git` al importar el módulo, atada al `cwd` de ese momento. No hay tests de integración con git; `pnpm test` corre `tsx --test src/**/*.test.ts` y el runner de `node:test` aísla cada archivo en su propio proceso.
- Todas las llamadas a las funciones de búsqueda viven en `scanAndSelectPackages`, que ya recibe `config`.

## Goals / Non-Goals

**Goals:**
- Una sola fuente de verdad para nombre, patrón y parseo de tags, usada al escribir y al leer.
- Que un tag no-semver nunca afecte el escaneo, en ningún esquema.
- Cubrir `version-only` con un test que ejercite git real.

**Non-Goals:**
- Prefijo `v` (`v1.0.0`): tagman nunca lo crea.
- Corregir que el link de comparación use `manifest.version` como versión anterior en vez del último tag real (problema previo, independiente de #74). Consecuencia aceptada: el primer release tras migrar de `full` a `version-only` genera `0.11.0...0.12.0` aunque el tag anterior sea `pkg@0.11.0`.
- Agrupar tags de versión sueltos en `github-release` (hoy caen en el bucket `"(otros)"`). Funciona; se deja para otro cambio.

## Decisions

### D1. Módulo puro `src/core/tag-scheme.ts`
Tres funciones sin I/O, todas con `tagName: TagmanConfig["tagName"]` como argumento:
- `formatTag(pkg, version, tagName)` → `"0.12.0"` | `"pkg@0.12.0"`.
- `tagGlobs(pkg, tagName)` → `["pkg@*"]` con `full`; `["[0-9]*", "pkg@*"]` con `version-only`.
- `parseTagVersion(tag, pkg, tagName)` → versión semver válida o `null`. Con `full` acepta solo `pkg@<semver>`; con `version-only` acepta `<semver>` y `pkg@<semver>`.

**Por qué en `core/` y no en `git/`:** lo usan `updater.ts` y los steps del wizard, que no deberían depender de git para formatear un string, y siendo puro se testea sin repo.
**Alternativa descartada:** un objeto `TagScheme` con métodos construido desde el config. Agrega una capa sin beneficio para tres funciones.

### D2. Las búsquedas reciben `tagName` como parámetro obligatorio
`getLastTagForPackage`, `getLastStableTagForPackage`, `getLatestRemoteStableVersion`, `getUnreleasedCommitsForPath` y `getUnreleasedRepoCommits` agregan `tagName` como parámetro **requerido** (sin default), para que `tsc` marque cualquier llamada que no lo pase.
**Alternativa descartada:** estado global como `RunMode`. El modo es una propiedad del proceso; el esquema de tags es config, y ya está en scope en el único caller (`scanAndSelectPackages`).

### D3. Un único listado filtrado alimenta todas las búsquedas
Un helper interno `listPackageTags(pkg, tagName)` corre `git tag -l <glob1> <glob2>` (git acepta varios patrones), descarta lo que `parseTagVersion` rechace y devuelve `{ tag, version }[]` ordenado por `semver.rcompare`. `getTagsSortedBySemver` se reemplaza por este helper, y las dos funciones `getUnreleased*` lo usan en lugar de `listAllTags`. Así el filtro semver que hoy solo protege la resolución del último tag protege también la exclusión `^tag` (escenario `2fa-setup`). Los consumidores usan `version` del resultado en vez de cortar el string.

### D4. Lectura de tags heredados solo con `version-only`
Con `version-only`, `tagGlobs` incluye `pkg@*` para que un repo migrado desde `full` conserve su baseline. Con `full` **no** se leen tags sueltos: en un monorepo un `1.0.0` suelto no pertenece a ningún paquete en particular. Si coexisten `pkg@0.11.0` y `0.11.0`, ambos entran en la exclusión (inocuo) y el orden entre iguales es indistinto.

### D5. Validación `version-only` + multi-paquete en `wizard/index.ts`
Justo después de resolver `pkgs` (l.118) y **antes** de `handleCheckpoint`, ya que un rollback en esa config también borraría tags equivocados. Si `cfg.tagName === "version-only" && pkgs.length > 1`, lanza `HeadlessError("invalid-config", t().headless.versionOnlyMonorepo(pkgs.length), 1, { packages: pkgs.length })` **en ambos modos**: es un error de config, no una decisión del usuario, y `runCommand` ya lo traduce a exit 1 y al JSON. Se agrega `"invalid-config"` a `FailureReason` y se ajusta el comentario de `HeadlessError`, que hoy dice "Thrown only in non-interactive mode".
**Alternativas descartadas:** validar en `config.ts` (no conoce el workspace); solo advertir (deja la colisión silenciosa de `execute.ts:174`); validar por paquetes seleccionados en lugar del workspace (el escaneo de B seguiría tomando los tags de A como propios).

### D6. Link de comparación con nombres ya formateados
`appendToChangelog` recibe `tagName` y arma ambos extremos con `formatTag`. Los 5 ternarios del wizard se reemplazan por `formatTag`; `buildTagName` de `execute.ts` desaparece o pasa a delegar en él.

### D7. Tests en dos niveles
- `src/core/tag-scheme.test.ts`: unitarios de las tres funciones, incluidos `2fa-setup`, `v1.0.0`, `pkg@latest` y la mezcla de esquemas.
- `src/git/tag-lookup.test.ts`: crea un repo temporal con `git init`, hace `process.chdir` y recién entonces `await import("./index.js")`, para que la instancia `git` quede atada al repo. Arma `0.11.0`, un commit nuevo y un `2fa-setup`, y verifica último tag, commits sin liberar y el caso migrado (`pkg@0.11.0`). Restaura el `cwd` y borra el directorio en `after`.

## Risks / Trade-offs

- [El test de integración depende de que `node:test` aísle cada archivo en un proceso] → El `import()` dinámico va después del `chdir` dentro del mismo archivo. Si el aislamiento cambiara, el test fallaría de forma visible (último tag inesperado), no pasaría en falso.
- [`[0-9]*` lista cualquier tag que empiece con dígito] → Lo absorbe el filtro de D3. El costo es listar algunos tags extra, despreciable.
- [Cambian las firmas de 5 funciones exportadas de `git/index.ts`] → Son internas al CLI (el paquete no las expone como API). `tsc --noEmit` detecta los callers.
- [Un usuario con un monorepo y `version-only` hoy "funcionando" pasa a recibir un error] → Esa config ya produce tags compartidos y escaneos incorrectos; el mensaje indica cambiar a `"full"`.

## Migration Plan

No requiere migración de datos. Un repo `version-only` existente sigue funcionando y deja de re-listar commits; uno que venía de `full` conserva su baseline gracias a D4. Rollback: revertir el commit.

El change `fix-headless-agent-mode` (sin archivar) define la lista de `reason` en su spec `headless-release`. Este cambio agrega `invalid-config` a esa lista en su propia capability; conviene archivar `fix-headless-agent-mode` primero para que las specs principales queden consistentes.
