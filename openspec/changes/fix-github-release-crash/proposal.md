# fix-github-release-crash

## Why

El issue [#66](https://github.com/fethabo/tagman/issues/66) reporta que el programa termina abruptamente al intentar iniciar sesión en GitHub vía navegador (device flow) desde el flujo "GitHub release desde tag existente". La auditoría encontró dos defectos que lo explican: la ruta que parte del menú principal ejecuta `runGithubReleaseFlow()` sin ningún try/catch (`menu.ts:44`, `index.ts` action por defecto), por lo que cualquier excepción del polling OAuth se convierte en unhandled rejection y Node mata el proceso con stack trace; y `interactiveGithubLogin()` traga los errores devolviendo `null` sin mostrar mensaje alguno (`github.ts:23-25`), con lo cual incluso el fallo "manejado" termina el programa en silencio, sin explicación para el usuario.

## What Changes

- Proteger la ruta del menú principal con manejo de errores equivalente al que ya tiene el subcomando `tagman github-release` (`github-release.ts:196-202`): el error se muestra con `p.log.error` + `p.outro`, el proceso termina de forma controlada.
- Aplicar la misma protección a la acción por defecto de `index.ts` (que invoca `showMainMenu()`), cubriendo también la rama `release` del menú por consistencia.
- `interactiveGithubLogin()` deja de fallar en silencio: al capturar un error del device flow, muestra un mensaje de error localizado (i18n es/en) con la causa antes de devolver `null`.
- Cuando el login falla o el usuario lo rechaza en `runGithubReleaseFlow`, mostrar un mensaje claro de por qué el flujo no puede continuar (falta de token) en lugar de retornar en silencio.
- Nuevas claves i18n en `types.ts`, `es.ts` y `en.ts` para los mensajes agregados.

## Capabilities

### New Capabilities

- `github-release-flow`: comportamiento del flujo de creación de GitHub Releases desde tags existentes, incluyendo la resolución de token, el login interactivo por device flow y el manejo de errores (nunca terminar el proceso sin mensaje; los fallos de login/red se reportan al usuario y el flujo termina de forma controlada).

### Modified Capabilities

<!-- No hay specs existentes en openspec/specs; nada que modificar. -->

## Impact

- `src/commands/menu.ts` — try/catch alrededor de las acciones del menú.
- `src/index.ts` — protección de la acción por defecto.
- `src/integrations/github.ts` — mensaje de error en el catch de `interactiveGithubLogin`.
- `src/commands/github-release.ts` — mensaje explícito al abortar por falta de token.
- `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts` — nuevas claves.
- Sin cambios de API pública ni de configuración; sin breaking changes.
