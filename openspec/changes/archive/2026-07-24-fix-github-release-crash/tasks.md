# Tasks — fix-github-release-crash

## 1. i18n

- [x] 1.1 Agregar claves a `src/i18n/types.ts`: `execute.githubDeviceLoginFailed(msg: string)` y `githubRelease.abortedNoToken`
- [x] 1.2 Agregar traducciones en `src/i18n/es.ts` y `src/i18n/en.ts`

## 2. Manejo de errores

- [x] 2.1 En `src/integrations/github.ts`, dentro del catch de `interactiveGithubLogin`, mostrar `p.log.error(t().execute.githubDeviceLoginFailed(...))` antes de devolver `null`
- [x] 2.2 En `src/commands/github-release.ts`, loguear `t().githubRelease.abortedNoToken` antes del `return` cuando no hay token (login rechazado o fallido)
- [x] 2.3 En `src/commands/menu.ts`, envolver las acciones `release` y `github` en try/catch con `p.log.error(err.message)` + `p.outro(t().wizard.error)` (mismo patrón que el subcomando `github-release`)
- [x] 2.4 En `src/index.ts`, proteger la action por defecto (`showMainMenu()`) con el mismo try/catch de borde

## 3. Verificación

- [x] 3.1 `pnpm build` sin errores
- [x] 3.2 Reproducir el escenario del issue #66: sin `GITHUB_TOKEN` ni token en `.npmrc`, entrar por el menú a "GitHub release", aceptar el login y simular fallo de red (desconectar) — verificar mensaje de error localizado y salida controlada sin stack trace *(verificado con el CLI real manejado por stdin y `fetch` global roto vía preload: error localizado + aborto + outro, stderr vacío)*
- [x] 3.3 Verificar que rechazar el login muestra el mensaje de aborto por falta de token *(verificado con el CLI real: "No se puede continuar sin un token de GitHub..." + salida controlada)*
