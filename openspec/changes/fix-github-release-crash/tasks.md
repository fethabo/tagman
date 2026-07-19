# Tasks — fix-github-release-crash

## 1. i18n

- [ ] 1.1 Agregar claves a `src/i18n/types.ts`: `execute.githubDeviceLoginFailed(msg: string)` y `githubRelease.abortedNoToken`
- [ ] 1.2 Agregar traducciones en `src/i18n/es.ts` y `src/i18n/en.ts`

## 2. Manejo de errores

- [ ] 2.1 En `src/integrations/github.ts`, dentro del catch de `interactiveGithubLogin`, mostrar `p.log.error(t().execute.githubDeviceLoginFailed(...))` antes de devolver `null`
- [ ] 2.2 En `src/commands/github-release.ts`, loguear `t().githubRelease.abortedNoToken` antes del `return` cuando no hay token (login rechazado o fallido)
- [ ] 2.3 En `src/commands/menu.ts`, envolver las acciones `release` y `github` en try/catch con `p.log.error(err.message)` + `p.outro(t().wizard.error)` (mismo patrón que el subcomando `github-release`)
- [ ] 2.4 En `src/index.ts`, proteger la action por defecto (`showMainMenu()`) con el mismo try/catch de borde

## 3. Verificación

- [ ] 3.1 `pnpm build` sin errores
- [ ] 3.2 Reproducir el escenario del issue #66: sin `GITHUB_TOKEN` ni token en `.npmrc`, entrar por el menú a "GitHub release", aceptar el login y simular fallo de red (desconectar) — verificar mensaje de error localizado y salida controlada sin stack trace
- [ ] 3.3 Verificar que rechazar el login muestra el mensaje de aborto por falta de token
