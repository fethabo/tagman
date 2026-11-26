# Proposal

## Why

Según la documentación, `tagman release --packages X --bump Y --yes` corre sin ningún prompt (issue #71). En la práctica todavía pregunta por el tag, por su mensaje y por el push. Sin TTY (CI o un agente), clack interpreta el stdin cerrado como "cancelar" y tagman termina **con código 0 sin aplicar nada**. Un agente no tiene cómo distinguir eso de un release exitoso. Además, `--json` mezcla la UI de clack con el JSON en stdout, así que no se puede parsear. Por estas dos cosas, hoy ningún agente ni pipeline puede usar tagman de forma confiable.

El mismo issue reporta dos defectos menores, que se resuelven en este change:
- `tagman --lang en release` ignora el idioma.
- `tsc --noEmit` falla en `github-release.ts`.

## What Changes

- **`--yes` es headless de verdad.** Cada prompt que hoy aparece con `--yes` pasa a tener una resolución explícita:
  - Por defecto, `--yes` acepta la opción que el prompt interactivo preselecciona: bump sugerido, crear el tag con el mensaje autogenerado (de graduación cuando corresponde) y subir a la siguiente patch ante un conflicto de graduación con el remoto.
  - Hay compuertas de seguridad que **no** se aceptan solas:
    - **Push:** solo ocurre con `--push`; nunca se pregunta.
    - **Working tree sucio:** falla, salvo que se pase `--allow-dirty` (flag nuevo).
    - **Rama atrasada respecto del remoto:** falla, salvo que se pase `--allow-behind` (flag nuevo). Si `requireRemoteSync: true`, falla igual aunque se pase el flag.
    - **Checkpoint pendiente:** falla y avisa que hay que resolverlo en modo interactivo.
    - **Sin `--packages`:** falla y lista los candidatos.
  - Sin `--bump`, se usa el bump sugerido por los commits convencionales, o el default de pre-release o graduación según el estado del paquete.
  - "Nada para liberar" termina con código 0 y, con `--json`, emite `reason: "no-commits"`.
- **Red de seguridad para prompts.** Si un prompt se invoca en modo no interactivo (`--yes` o stdin sin TTY), tagman termina con código **2** y un mensaje que nombra el prompt, en lugar de salir en silencio. Todos los prompts pasan por un módulo común, y un test impide llamar a clack directamente desde otro lugar.
- **Códigos de salida.**
  - `0`: release exitoso o nada para liberar.
  - `1`: error o fallo de una precondición headless.
  - `2`: se necesitaba interacción y no había.
  - La cancelación interactiva (Ctrl+C) no cambia.
- **`--json` produce stdout limpio.** Con `--json`, stdout contiene solo el documento JSON final y toda la UI va a stderr. Los errores también emiten JSON: `{ success: false, reason, message }`. No se limpia la pantalla.
- **`--lang` es global.** `--lang` se declara solo en el programa raíz y aplica a cualquier subcomando, tanto antes como después del nombre del subcomando.
- **Tipos.** `tsc --noEmit` pasa sin errores. Se agrega un script `typecheck`. Cablearlo a CI queda fuera de alcance.

## Capabilities

### New Capabilities

- `headless-release`: comportamiento de `tagman release` sin interacción humana. Cubre cómo `--yes` resuelve cada decisión, qué compuertas de seguridad fallan en lugar de asumir, qué pasa si un prompt se alcanza sin TTY, y los códigos de salida del proceso.
- `json-output`: contrato de la salida legible por máquina de `--json`. Cubre la pureza de stdout, la forma del documento de éxito y de fallo, y los valores de `reason`.
- `cli-global-options`: opciones que aplican a todo el CLI con independencia de su posición respecto del subcomando (hoy, `--lang`).

### Modified Capabilities

(ninguna)

## Impact

- `src/index.ts`, `src/commands/wizard/index.ts`, `src/commands/github-release.ts`: `--lang` global, flags `--allow-dirty` / `--allow-behind`, modo JSON, códigos de salida.
- `src/commands/wizard/steps/checkpoint.ts`, `scan-and-select.ts`, `tag-messages.ts`, `execute.ts`: resoluciones con `--yes`.
- Módulo nuevo de prompts con guard (`src/ui/`), que también usan `wizard-select.ts`, `commit-multiselect.ts` y los prompts de resumen y borrador.
- `src/i18n/{types,en,es}.ts`: mensajes nuevos para las fallas headless.
- `package.json`: script `typecheck`.
- `CLAUDE.md` / README: actualizar la referencia del CLI (flags nuevos, códigos de salida, contrato JSON).
- **Comportamiento visible:**
  - Quien hoy corre `--yes` en una terminal y contesta a mano el prompt de tag o de push ya no ve esas preguntas: el tag se crea solo y el push requiere `--push`.
  - `--yes` con un working tree sucio ahora falla en vez de preguntar.
  - Ninguno de los dos cambia la API de configuración.
