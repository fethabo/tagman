# Design — fix-github-release-crash

## Context

`tagman` tiene dos rutas de entrada al flujo de GitHub Releases: el subcomando `tagman github-release` (protegido con try/catch en `github-release.ts:196-202`) y el menú principal (`showMainMenu` en `menu.ts`, invocado por la action por defecto en `index.ts`) que llama `runGithubReleaseFlow()` **sin protección**. Además `interactiveGithubLogin()` (`github.ts`) captura errores del device flow y devuelve `null` sin emitir mensaje, y `runGithubReleaseFlow` retorna en silencio cuando queda sin token. El resultado observado en el issue #66: crash con stack trace o salida muda.

## Goals / Non-Goals

**Goals:**
- Ninguna ruta de entrada puede terminar el proceso con unhandled rejection.
- Todo fallo de login o aborto por falta de token produce un mensaje localizado.

**Non-Goals:**
- Reintentos automáticos del device flow o cambios en la lógica de OAuth.
- Persistencia del token obtenido (se mantiene el diseño "no se guarda").
- Cambios en el flujo del wizard de release más allá de la protección de la ruta del menú.

## Decisions

1. **Proteger en `menu.ts`, no dentro de `runGithubReleaseFlow`.** El flujo ya cumple el contrato de cancelación (retorna al cancelar); lo que falta es el guard del borde de entrada. Se envuelve cada acción del menú en try/catch replicando el patrón del subcomando (`p.log.error(err.message)` + `p.outro(t().wizard.error)`). Alternativa considerada: try/catch global en `index.ts` con `process.on("unhandledRejection")` — descartada por ocultar errores de programación y desviar el patrón existente del codebase (cada comando maneja su borde).
2. **Mensaje de error dentro del catch de `interactiveGithubLogin`.** Se agrega `p.log.error(t().execute.githubDeviceLoginFailed(msg))` antes del `return null`. La causa se extrae de `error.message` (los errores de octokit ya vienen sin datos sensibles; el token todavía no existe en ese punto).
3. **Mensaje de aborto por falta de token en `runGithubReleaseFlow`.** El `if (!token) return;` pasa a loguear `t().githubRelease.abortedNoToken` antes de retornar. Reutilizable también si el usuario responde "No" al prompt.
4. **Claves i18n nuevas**: `execute.githubDeviceLoginFailed(msg)` y `githubRelease.abortedNoToken`, agregadas a `types.ts`, `es.ts` y `en.ts` siguiendo la convención existente.

## Risks / Trade-offs

- [El catch en el menú podría enmascarar bugs de programación] → El mensaje muestra `err.message` igual que el subcomando; para diagnóstico profundo el usuario puede reproducir con el subcomando y `--lang`; el comportamiento queda consistente entre rutas.
- [Errores de octokit con mensajes largos/técnicos en pantalla] → Aceptable: es mejor que el silencio actual; el mensaje se muestra vía `p.log.error` que ya formatea.
