# Design — fix-scan-and-wizard-issues

## Context

Cuatro bugs independientes (issues #56, #57, #58, #62) en el wizard de release. Comparten archivos pero no lógica, por lo que se diseñan como cuatro fixes aislados dentro de un mismo change. El de mayor impacto es #62: el baseline de escaneo de commits se calcula con un orden de tags incorrecto y produce re-listado de commits ya publicados.

Estado actual relevante:

- `src/git/index.ts` — `getLastTagForPackage` (línea 24), `getLastStableTagForPackage` (línea 39) y `getLatestRemoteStableVersion` (línea 57) ejecutan `git tag -l "name@*" --sort=-v:refname` y toman la primera línea (o la primera estable). El version-sort de git, sin `versionsort.suffix` configurado, ordena `1.2.0-beta.3` **después** (= mayor) que `1.2.0`. Verificado empíricamente en un repo de prueba: `pkg@1.2.0-beta.3` aparece primero en el listado descendente.
- `src/commands/wizard/steps/scan-and-select.ts` — paso 4 (cascade, líneas 584-633) inserta un pseudo-commit `{ hash: "cascade", ... }` en `existing.commits`, pero si la entrada existente es `isExtraOnly`, el paso 2 de selección de commits de ruta se saltea (`if (!pkgInfo.isExtraOnly)`, línea 232) y `chosenCommits = [...selectedPathCommits, ...chosenExtraCommits]` nunca incluye el cascade.
- `src/core/updater.ts` — `formatCommitList` (línea 119) procesa referencias `#123` con un replace que las deja como texto plano cuando hay `baseUrl` (línea 132-134), asumiendo autolink de GitHub que no existe en anotaciones de tag ni en archivos `.md`. El fallback sin `baseUrl` genera `([#123](#123))`, un link roto.
- `scan-and-select.ts` líneas 449-451 — labels del paso 3a calculadas con `semver.inc(currentVersion, <tipo>, "alpha")`, mostrando "alpha" como si fuera el canal definitivo.

## Goals / Non-Goals

**Goals:**

- El escaneo de commits parte siempre del tag de **mayor versión semver** del package, independiente del orden de git (#62).
- El pseudo-commit "cascade" es siempre visible y seleccionable en el paso 2 para cualquier tipo de candidato (#58).
- Las referencias a issues en tag messages y CHANGELOG son links markdown completos y clickeables (#57).
- El paso 3a comunica el tipo de bump sin sugerir un canal concreto (#56).

**Non-Goals:**

- No se cubre el escenario de hashes reescritos por rebase-merge/squash-merge de PRs (los screenshots de #62 muestran el mismo hash, lo que confirma que la causa es el orden de tags, no la reescritura). Si reaparece con hashes distintos, será un issue aparte (posible solución futura: filtrado por patch-id con `git log --cherry-pick`).
- No se cambia el orden de la lista de tags en el flujo `github-release` (`listAllTags` sin patrón): es presentación de un multiselect donde el usuario elige manualmente.
- No se soportan issue trackers no-GitHub en los links (#57): se construye `${baseUrl}/issues/${num}`, válido para GitHub. GitLab usa `/-/issues/`; queda fuera de scope (el resto del codebase ya asume GitHub: OSC 8 links, Octokit, `getGitHubRemoteInfo`).
- No se configura `versionsort.suffix` en el repo del usuario (sería tocar config global ajena y no es portable).

## Decisions

### D1 (#62) — Ordenar tags por semver en JS, no en git

Nuevo helper privado en `src/git/index.ts`:

```typescript
/** Lists tags matching `name@*` sorted by semver descending (highest first). */
async function getTagsSortedBySemver(packageName: string): Promise<string[]> {
  const raw = await git.raw(["tag", "-l", `${packageName}@*`]);
  return raw
    .split("\n")
    .filter(Boolean)
    .map(tag => ({ tag, version: tag.slice(packageName.length + 1) }))
    .filter(({ version }) => semver.valid(version) !== null)
    .sort((a, b) => semver.rcompare(a.version, b.version))
    .map(({ tag }) => tag);
}
```

`getLastTagForPackage` devuelve el primer elemento; `getLastStableTagForPackage` y `getLatestRemoteStableVersion` devuelven el primero con `semver.prerelease(version) === null`. Se elimina `--sort=-v:refname` de las tres.

- **Por qué no `versionsort.suffix`**: requiere configuración de git en la máquina/repo del usuario; no es portable ni controlable desde tagman.
- **Por qué no excluir commits alcanzables desde todos los tags** (`git log HEAD --not <tags...>`): resolvería también ordenamientos exóticos, pero cambia la semántica del rango (el changelog de graduación usa deliberadamente `lastStableTag..HEAD`) y es más invasivo. La causa raíz es el orden; se corrige el orden.
- **Filtrado de tags no-semver**: un tag tipo `pkg@latest` rompería `semver.rcompare`; se descarta con `semver.valid`. Hoy `--sort=-v:refname` los devuelve mezclados, así que esto además endurece el comportamiento actual.
- Nota: el matching `name@*` de packages cuyos nombres son prefijo de otros (`pkg` vs `pkg-utils`) no cambia: `pkg-utils@1.0.0` produce version `utils@1.0.0` → inválido → descartado, comportamiento incluso más correcto que el actual.

### D2 (#58) — Limpiar `isExtraOnly` al insertar el pseudo-commit cascade

En el paso 4 (`scan-and-select.ts`, rama `existing` del cascade, línea 627-630), además del `unshift` del pseudo-commit:

```typescript
existing.commits.unshift({ hash: "cascade", ... });
existing.isExtraOnly = false;   // ahora tiene un commit de ruta → paso 2 normal
cascadeModifiedEntry.push(dep.manifest.name);
```

Con el flag limpio, el paso 2 (`!pkgInfo.isExtraOnly`) muestra el `commitMultiSelect` con el cascade seleccionable, y el paso 2b sigue ofreciendo los `extraCommits`. El rollback de "back desde cascade" (líneas 646-651) debe restaurar `isExtraOnly = true` cuando al quitar el commit cascade el array `commits` queda vacío, para no corromper el reintento.

- **Caso graduación**: si el dependiente es candidato de graduación (`isGraduation`), el paso 2 usa `extraCommits`, no `commits`; el pseudo-commit se inserta en `extraCommits` en ese caso. Mismo rollback.
- **Headless (`--yes` / `--bump`)**: `chosenCommits = pkgInfo.isExtraOnly ? extraCommits : commits` (línea 201-202); con el flag limpio el cascade entra por `commits`. Sin cambio adicional.
- **Alternativa descartada** — mostrar el cascade en el paso 2b (extra commits): rompería la semántica de "extra = commits del repo fuera del path" y el pseudo-commit quedaría mezclado con commits reales de git.

### D3 (#57) — Links markdown completos para referencias a issues

En `formatCommitList`, reemplazar el bloque de líneas 130-134 por una transformación con dos formas:

1. Cross-repo `owner/repo#123` (regex `\b([\w.-]+)\/([\w.-]+)#(\d+)\b`) → `[owner/repo#123](https://github.com/owner/repo/issues/123)`.
2. Same-repo `#123` (los `#\d+` restantes) → `[#123](${baseUrl}/issues/123)` cuando hay `baseUrl`; sin `baseUrl`, queda `#123` plano (se elimina el fallback roto `([#123](#123))`).

El orden importa: primero cross-repo, después same-repo, para no capturar el `#123` de `owner/repo#123` dos veces. La misma lógica de patrones ya existe en `linkifyCommitMessage` (`commit-multiselect.ts`) para OSC 8 — se mantienen separadas porque el formato de salida difiere (escape de terminal vs markdown), pero los regex se alinean.

- **Alcance**: `formatCommitList` alimenta tanto `defaultTagMsg` (anotación de tag, luego body del GitHub Release vía `getTagAnnotation`) como `appendToChangelog`. Ambos destinos renderizan markdown (Releases UI y archivos `.md`), donde el link explícito funciona y el `#123` plano no.
- **GitHub Releases re-render**: GitHub muestra los links markdown como tales; no hay doble-linkificación porque el autolink no procesa el interior de un link existente.

### D4 (#56) — Placeholder `{channel}` en labels del paso 3a

Calcular la versión de ejemplo con el canal literal `"channel"` y sustituirlo por el placeholder visible:

```typescript
const preview = (type: "prepatch" | "preminor" | "premajor") =>
  semver.inc(currentVersion, type, "channel")!.replace("-channel.", "-{channel}.");
// → "1.3.0-{channel}.0"
```

Se usa `"channel"` como canal de cálculo (no `"alpha"`) para que el `replace` sea inequívoco incluso si `currentVersion` ya contiene "alpha" en su pre-release. Las funciones i18n `t().scan.prepatch/preminor/premajor(version)` no cambian de firma. Se agrega una key i18n nueva (`scan.channelNextStepHint`) usada como hint del prompt del paso 3a para indicar "el canal se elige en el siguiente paso" (es/en + tipo en `types.ts`).

## Risks / Trade-offs

- [D1] Repos con muchísimos tags: el sort pasa de git a JS → costo O(n log n) sobre cientos/miles de strings, despreciable frente al `git log` posterior. → Sin mitigación necesaria.
- [D1] Cambio de baseline silencioso: packages que hoy escaneaban desde un tag pre-release pasarán a escanear desde el estable más alto; la primera ejecución tras el fix mostrará *menos* commits que antes. → Es exactamente el comportamiento correcto esperado por el usuario (#62); se documenta en el changelog del propio tagman.
- [D2] Mutar `isExtraOnly` en una entrada compartida de `candidateMap`/`allCandidates`: el rollback de back-navigation debe dejar el estado idéntico al previo. → Mitigación: restaurar el flag en el mismo bloque de rollback existente (líneas 636-652), simétrico al `unshift`.
- [D3] `baseUrl` proviene de `package.json#repository` (`getRepositoryBaseUrl`), que puede no ser GitHub → el path `/issues/` podría ser incorrecto en otros forges. → Aceptado como non-goal; comportamiento previo (texto plano) tampoco linkeaba.
- [D4] El string `{channel}` no es una versión semver válida y no debe usarse en ningún cálculo posterior. → Solo se usa en labels de UI; el valor (`prepatch`/`preminor`/`premajor`) sigue siendo el mismo.

## Migration Plan

Sin migración: no cambian formatos persistidos (tags `name@version`, checkpoint, draft, config). Los cuatro fixes son retro-compatibles y se despliegan en una release patch/minor de tagman. Rollback = revertir el commit.

## Open Questions

- Ninguna bloqueante. Si durante la implementación se detecta que `getLatestRemoteStableVersion` necesita además el fetch de tags con `--force` (tags movidos en remoto), se trata como issue aparte.
