## Context

El comando `github-release` actualmente llama a `listAllTags()` (sin filtro) y presenta todos los tags en un `p.multiselect` plano ordenados por versión semántica descendente. En monorepos con N paquetes esto produce N×M opciones en una sola lista, sin contexto de paquete, sin metadatos de fecha y sin agrupación.

El formato de tag para paquetes es `<package-name>@<semver>` (e.g. `my-lib@1.2.0`). Los tags que no siguen ese formato (legacy o tags manuales) deben igualmente aparecer, agrupados bajo una categoría "otros".

## Goals / Non-Goals

**Goals:**
- Selector de dos pasos: primero elegir paquete, luego elegir tag/versión de ese paquete.
- Ordenar tags dentro de cada paquete por fecha de creación descendente.
- Mostrar para cada tag: versión, fecha y autor (tagger name).
- Permitir seleccionar tags de múltiples paquetes en un mismo flujo iterativo.
- Obtener los metadatos de tags con un único comando git eficiente.

**Non-Goals:**
- Paginación de tags (se asume que la cantidad de versiones por paquete es manejable).
- Cambios en el paso de creación de releases en GitHub (esa lógica no cambia).
- Soporte para tags que no son del estilo `name@version` como entidades de primer orden; se agrupan como "otros" sin comportamiento especial.

## Decisions

### D1: Obtención de metadatos con `git tag --format`

**Decisión:** Agregar `listTagsWithMeta()` en `git/index.ts` que retorna `TagInfo[]` (`{ name, date, tagger }`). Usa `git tag -l --sort=-creatordate --format=%(refname:short)%09%(creatordate:short)%09%(taggername)` en lugar de múltiples llamadas por tag.

**Alternativa descartada:** Llamar a `git cat-file` por cada tag para obtener metadatos — O(N) llamadas git vs una sola. Descartado por rendimiento.

**Alternativa descartada:** Usar la API de GitHub para leer metadatos de releases — requiere red y token, innecesario ya que los datos están en el repo local.

### D2: Flujo iterativo paquete → versión con re-selección

**Decisión:** Implementar un loop en `runGithubReleaseFlow()`:
1. `wizardSelect` para elegir paquete (opciones: los paquetes con tags + "Listo / Done" al final).
2. Al elegir un paquete: `wizardSelect` para elegir el tag de esa versión (opciones incluyen "← Volver").
3. El tag seleccionado se acumula en un array. Se vuelve al paso 1.
4. Al elegir "Listo": se procede con los tags acumulados.

**Alternativa descartada:** MultiSelect de dos niveles — `@clack/core` no tiene componente nativo para eso, implementarlo requiere más código que el loop simple.

**Alternativa descartada:** Agrupar visualmente en un solo multiselect con headers — `p.multiselect` estándar no soporta grupos no seleccionables; habría que usar `commit-multiselect` custom, más complejidad.

### D3: Agrupación de tags por paquete

**Decisión:** Parsear el nombre del tag con regex `^(.+)@(\d.*)$` para separar `packageName` y `version`. Tags que no matcheen se colocan bajo la clave `"(otros)"`. La agrupación ocurre en memoria después de llamar a `listTagsWithMeta()`.

### D4: Reutilizar `wizardSelect` existente

**Decisión:** Usar `wizardSelect` de `src/commands/wizard/wizard-select.ts` con la opción `[b] back` en el paso 2 (selección de versión). No se crea un nuevo componente de prompt.

## Risks / Trade-offs

- [Riesgo: tags sin formato `name@version`] → se agrupan bajo `"(otros)"` sin parseo de versión; el label muestra el nombre completo del tag. Aceptable para el caso de uso.
- [Riesgo: repos con cientos de tags por paquete] → el selector de versión mostrará todas las versiones; sin paginación. Mitigation: el ordenado por fecha reciente pone las relevantes primero.
- [Trade-off: loop iterativo vs multiselect de múltiples paquetes] → el loop permite seleccionar exactamente una versión por paquete por iteración, lo que es consistente con el caso de uso "crear releases de una nueva versión". Si el usuario quiere seleccionar múltiples versiones del mismo paquete, debe iterar.

## Migration Plan

Cambio no-breaking: el comando `github-release` cambia su UI pero no su contrato de entrada/salida. No hay archivos de estado ni config que migrar.
