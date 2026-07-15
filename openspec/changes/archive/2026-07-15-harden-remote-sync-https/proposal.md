## Why

En el paso de "Verificando cambios remotos..." (`handleCheckpoint` → `getRemoteBehindCount`) el wizard puede quedarse **eternamente cargando**. La causa: `git.fetch()` corre como subproceso sin timeout y con permiso de promptear credenciales. En una clonación por **HTTPS sin credenciales configuradas**, git queda esperando `Username/Password` en un stdin que no existe (el fetch corre dentro de un spinner de `@clack`), la promesa nunca se asienta y el `try/catch` de `getRemoteBehindCount` nunca dispara (un cuelgue no es un error). El usuario ve un spinner infinito sin explicación.

Esto revela tres carencias:
1. **Robustez**: tagman jamás debería colgarse por un fetch; debe fallar con timeout y mostrar el error.
2. **Documentación**: no está documentado qué acceso al remoto necesita el flujo ni que HTTPS es soportado.
3. **Feature**: tagman ya tiene login OAuth device-flow (`interactiveGithubLogin`, scope `repo`) usado en el flujo de releases, pero **no** lo aplica al transporte git. Ese token sirve para autenticar git sobre HTTPS. Aplicarlo cierra el caso de HTTPS sin credenciales de forma nativa, reutilizando infraestructura ya probada en producción.

## What Changes

**Capa 1 — No colgar (robustez):**
- El cliente `simpleGit` se instancia con `timeout: { block: <N>ms }` para matar procesos git colgados.
- Las operaciones de red (`getRemoteBehindCount`, `getLatestRemoteStableVersion`) corren con `GIT_TERMINAL_PROMPT=0` para que falten-credenciales falle al instante en vez de colgar.
- El chequeo de sync degrada con elegancia: si el fetch falla/expira, se muestra un aviso claro (no un error fatal) y el flujo continúa tratando el estado como "no verificado" (0 commits detrás), sin bloquear.

**Capa 2 — Documentar:**
- README/CLAUDE documentan que el chequeo remoto necesita acceso de lectura al remoto, que funciona con SSH (clave en agente) o HTTPS (credential helper / PAT / login de tagman), y que si no hay credenciales el chequeo se saltea sin colgar.

**Capa 3 — HTTPS con token (feature):**
- El transporte git por HTTPS puede autenticarse con el token resuelto por `resolveGithubToken()` / `interactiveGithubLogin()`, inyectado de forma **efímera** (sin persistir en `.git/config`).
- **Política por operación**:
  - **Sync (lectura, opcional)**: si ya hay token disponible (env/`~/.npmrc`), se inyecta en el fetch; si no lo hay, **no** se fuerza login — se saltea con aviso. No molestar al usuario con un device-flow sólo para una verificación.
  - **Push (escritura)**: si el remoto es HTTPS y falta credencial, se ofrece el login interactivo (igual que el flujo de releases) antes de pushear.

## Capabilities

### New Capabilities

- `remote-access-resilience`: El acceso al remoto (fetch de sincronización y push) SHALL ser resiliente a cuelgues (timeout + sin prompts interactivos de git) y SHALL degradar con elegancia cuando no hay credenciales, en vez de bloquear el flujo.
- `git-https-token-auth`: tagman SHALL poder autenticar operaciones git sobre HTTPS reutilizando el token de GitHub (resuelto o vía login device-flow), inyectado de forma efímera, con una política de "lazy en lectura / login en escritura".

### Modified Capabilities

_(ninguna — sin cambios en contratos de specs existentes)_

## Impact

- `src/git/index.ts` — instanciación de `simpleGit` con `timeout`; `getRemoteBehindCount` y `getLatestRemoteStableVersion` con `GIT_TERMINAL_PROMPT=0` y (opcional) inyección de token; helper de detección de remoto HTTPS; `pushRelease` con fallback de auth.
- `src/commands/wizard/steps/checkpoint.ts` — manejo del resultado del chequeo de sync (verificado / no verificado / error) con aviso no fatal.
- `src/commands/wizard/steps/execute.ts` — punto de push: ofrecer login interactivo si el remoto es HTTPS y no hay credencial.
- `src/core/token.ts` — reutilización de `resolveGithubToken` para transporte git (posible helper compartido con `interactiveGithubLogin`).
- `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts` — nuevas claves para avisos de "remoto no verificado", "fetch expirado", y prompt de login para push HTTPS.
- `README.md` / `CLAUDE.md` — documentación de requisitos de acceso al remoto.
