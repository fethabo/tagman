## Why

En monorepos con muchos paquetes, el listado plano de tags en `github-release` se vuelve inmanejable: mostrar decenas de tags mezclados sin contexto de a qué paquete pertenecen obliga al usuario a leerlos uno a uno. El problema fue reportado en issue #64 y aclarado en los comentarios: la solución correcta es agrupar por paquete y navegar jerárquicamente, no solo reordenar por fecha.

## What Changes

- El flujo de `github-release` reemplaza el `p.multiselect` plano por un selector de dos pasos: primero elegir el paquete, luego elegir la versión dentro de ese paquete.
- Los tags se agrupan por nombre de paquete (todo lo que precede al `@` en el formato `package-name@x.y.z`).
- Dentro de cada grupo, los tags se ordenan por fecha de creación descendente (más reciente primero), en lugar de por versión semántica.
- Cada opción de tag muestra la fecha/hora de creación y el autor del tag junto al nombre de versión.
- El usuario puede seleccionar tags de múltiples paquetes iterando el selector de paquetes hasta confirmar.
- La función `listAllTags` en `git/index.ts` se extiende para devolver metadatos (fecha, tagger) junto al nombre del tag.

## Capabilities

### New Capabilities

- `github-release-tag-picker`: Selector jerárquico de tags para `github-release`: navegación paquete → versión con metadatos de fecha y autor.

### Modified Capabilities

<!-- No hay specs existentes que cambien de requisitos. -->

## Impact

- `src/commands/github-release.ts`: lógica de selección completamente reemplazada.
- `src/git/index.ts`: nueva función o extensión de `listAllTags` para retornar `{ name, date, tagger }[]`.
- `src/i18n/types.ts`, `en.ts`, `es.ts`: nuevas claves para los prompts del selector jerárquico.
- Sin cambios en `integrations/github.ts` ni en el paso de creación de releases.
