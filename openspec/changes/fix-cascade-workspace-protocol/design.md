# Design

## Context

- `updateConsumerDependencies(consumerDir, depName, newVersion)` en `src/core/updater.ts` lee el `package.json` del consumidor, pisa la referencia en `dependencies`, `devDependencies` y `peerDependencies` con `^<newVersion>` y siempre reescribe el archivo.
- `rollbackConsumerDependencies` llama a la misma función con la versión anterior de la dependencia, así que hoy el rollback tampoco restaura el valor original.
- `execute.ts` solo actualiza consumidores que también están en el plan (`state.has(dep.manifest.name)`). Por eso el `ReleaseState` del consumidor, persistido en el checkpoint, ya contiene su `pkg.manifest` **previo a la release**, con las referencias originales.
- `pnpm test` corre `node:test` vía `tsx` sobre `src/**/*.test.ts`; hay un solo test (`commits.test.ts`).

## Goals / Non-Goals

**Goals:**
- Una función pura que decide la nueva referencia a partir de la actual, testeable sin tocar disco.
- Rollback que restaura el valor exacto sin agregar campos al checkpoint.

**Non-Goals:**
- Opción de config (`cascade.ignore`, `preserveWorkspaceProtocol`). Preservar `workspace:` es siempre correcto, así que no hace falta un flag. `cascade.ignore` queda para otro cambio.
- Cambiar la pregunta de cascada ni el pseudo-commit `chore: update dependency …`: el consumidor se sigue versionando aunque su referencia no cambie.
- Soportar `catalog:` (actualizar `pnpm-workspace.yaml`) u `optionalDependencies`.
- Avisar en pantalla cuando se omite una referencia no soportada.

## Decisions

### 1. Helper puro `rewriteDependencyRange(current, newVersion): string | null`
Devuelve la nueva referencia, o `null` si no hay que tocarla. Reglas, en orden:

| Referencia actual | Resultado |
|---|---|
| `workspace:*`, `workspace:^`, `workspace:~` | `null` |
| `workspace:` + `^`/`~`/vacío + semver válido | `workspace:<op><newVersion>` |
| `^`/`~`/vacío + semver válido | `<op><newVersion>` |
| cualquier otra cosa | `null` |

La detección usa una regex `^(workspace:)?([~^]?)(.+)$` más `semver.valid()` sobre la parte de versión. Así `>=1.0.0`, `1.x`, `*`, `latest`, `npm:…`, `file:…`, `catalog:` caen en `null` sin enumerarlos.

*Alternativa descartada:* no tocar `workspace:^1.2.3` si `newVersion` ya satisface el rango (lo sugirió el análisis del issue). Agrega un caso distinto al de las referencias simples sin un beneficio claro; actualizar siempre mantiene las referencias explícitas alineadas con la versión real, igual que el resto de las formas.

### 2. Escribir solo si algo cambió
`updateConsumerDependencies` recorre los tres campos, aplica el helper y llama a `writeJson` solo si al menos un valor cambió. Así un consumidor con solo `workspace:*` queda byte a byte igual (requerimiento de la spec), y no reformatea manifiestos innecesariamente.

### 3. Rollback desde el manifiesto guardado en el checkpoint
Reemplazar `rollbackConsumerDependencies(consumerDir, depName, oldVersion)` por `restoreConsumerDependencies(consumerDir, depName, originalManifest)`, que copia el valor original de cada campo donde existía. En `steps/checkpoint.ts` el manifiesto original sale de `rbState.get(dep.manifest.name).pkg.manifest`, que siempre existe porque solo se tocan consumidores del plan.

*Alternativa descartada:* agregar al checkpoint un mapa de referencias originales. Duplica datos que el checkpoint ya tiene y obliga a manejar checkpoints viejos sin ese campo. Con esta decisión los checkpoints existentes funcionan tal cual.

*Alternativa descartada:* `git checkout HEAD -- package.json`. Pisa cualquier cambio local no relacionado y depende de en qué paso quedó el commit.

## Risks / Trade-offs

- [Un repo usaba la reescritura a `^` como comportamiento deseado] → Ahora conserva el operador que ya tenía; es lo que el propio comentario `// can be improved` pretendía. Se documenta en el CHANGELOG.
- [El consumidor fue editado a mano entre el crash y el rollback] → El rollback restaura el valor previo a la release en esa referencia puntual, igual que hoy pisa con `^oldVersion`; no empeora.
- [Una referencia `catalog:` queda desalineada respecto de la nueva versión] → Fuera de alcance; el catálogo lo gestiona el usuario en `pnpm-workspace.yaml`.
