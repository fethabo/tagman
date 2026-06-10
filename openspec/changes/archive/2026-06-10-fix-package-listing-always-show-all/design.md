## Context

El wizard de tagman clasifica los paquetes del workspace en tres categorías antes de mostrar el multiselect del paso 1:

- **packagesWithCommits**: tienen commits de ruta sin publicar (detectados con `getUnreleasedCommitsForPath`)
- **graduationCandidates**: versión pre-release, sin commits nuevos → se les ofrece graduación
- **extraOnlyCandidates**: sin commits de ruta propios, pero hay commits globales del repo desde su último tag

Los paquetes que no caen en ninguna categoría son descartados silenciosamente. Esto causó dos bugs:
1. **Regresión #65**: `extraOnlyCandidates` usa `getUnreleasedRepoCommits` (exclusión multi-tag), que es demasiado restrictivo para paquetes graduados — los oculta aunque haya actividad en el repo.
2. **Requisito omitido**: si no hay actividad en NINGÚN paquete desde el último tag de un paquete X, X desaparece aunque el usuario quiera bumpearlo manualmente.

## Goals / Non-Goals

**Goals:**
- Todo paquete del workspace debe aparecer en el paso 1 del wizard, sin excepción.
- Los paquetes sin actividad detectable se muestran con una indicación visual que lo aclara y son seleccionables libremente.
- La corrección del bug #62 (exclusión multi-tag para commits de ruta) NO se revierte.

**Non-Goals:**
- No cambiar el comportamiento de `packagesWithCommits` ni `graduationCandidates`.
- No modificar pasos del wizard posteriores al paso 1 (commit selection, bump, execute).
- No agregar modo de filtro por categoría.

## Decisions

### Decisión 1: Restaurar `getRepoCommitsSince(lastTag)` para extraOnlyCandidates

**Alternativa A (elegida)**: usar `getRepoCommitsSince(lastTag)` con el `lastTag` correcto (por semver) para determinar si un paquete es extraOnly.

**Alternativa B descartada**: usar `getUnreleasedRepoCommits` (multi-tag) como en 1.4.3. Es semánticamente correcta para el problema de #62 pero excesivamente restrictiva para el caso extraOnly, donde no importa si esos repo commits ya están "cubiertos" por un tag — importa si hay actividad reciente que motive un bump.

**Rationale**: la corrección de #62 es necesaria en `packagesWithCommits` (donde commits incorrectos llenan el multiselect). Para `extraOnlyCandidates`, la pregunta es distinta: "¿tiene sentido ofrecerle un bump a este paquete dado que hubo actividad en el repo?". Eso se responde mejor con "hay commits globales desde mi último tag estable", no con "hay commits globales que ningún tag mío cubre".

### Decisión 2: Cuarta categoría `noCommitsCandidates` en lugar de "mostrar todos siempre"

**Alternativa A (elegida)**: agregar una cuarta lista `noCommitsCandidates` con los paquetes restantes (los que no caen en las tres categorías actuales). Se comportan como `extraOnly` (saltan el paso de selección de commits) pero con `extraCommits = []` y un hint específico.

**Alternativa B descartada**: hacer que `extraOnlyCandidates` siempre incluya todos los paquetes restantes con `repoCommits = []`. Mezclaría dos semánticas distintas y requeriría condicionalmente cambiar el hint según si hay o no repo commits, ensuciando la lógica.

**Rationale**: mantener categorías separadas preserva la intención de cada branch del código y facilita agregar comportamientos distintos por categoría en el futuro (e.g., ocultar `noCommitsCandidates` con un flag `--only-changes`).

### Decisión 3: Reutilizar `isExtraOnly: true` para `noCommitsCandidates`

Para que los pasos posteriores del wizard (step 2 commit multiselect, step 2b extra commits) manejen correctamente los paquetes sin commits, `noCommitsCandidates` se agrega con `isExtraOnly: true` y un nuevo flag `isNoCommits: true`. El `isExtraOnly` ya contiene la lógica correcta para saltar la selección de commits; `isNoCommits` solo se usa para el hint diferenciado en el multiselect.

**Alternativa descartada**: agregar lógica específica `isNoCommits` en todos los puntos donde se inspecciona `isExtraOnly`. Duplicaría condiciones sin beneficio real.

## Risks / Trade-offs

- **[Riesgo] Un paquete `noCommits` seleccionado produce un CHANGELOG vacío** → Mitigación: ya ocurre con paquetes extraOnly sin commits seleccionados; el wizard maneja este caso correctamente (bump sin entradas de changelog). No se requiere cambio adicional.
- **[Trade-off] Se muestran siempre N paquetes en el multiselect**, donde N puede ser grande en monorepos con muchos paquetes sin actividad. → Aceptable: el usuario tiene control total con el multiselect; los paquetes `noCommits` aparecen al final con hint diferenciador.

## Open Questions

- ¿Debería existir un flag `--only-changes` para filtrar `noCommitsCandidates` en modo headless? Por ahora no se implementa; se puede añadir en un issue separado.
