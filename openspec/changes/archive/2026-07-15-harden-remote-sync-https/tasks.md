## 1. Inspección de API de simple-git

- [x] 1.1 Leer `node_modules/simple-git` para confirmar cómo se configura `timeout: { block }` en el constructor y si mata el proceso git al expirar — simple-git 3.33.0: `timeout.block` mata el proceso (`context.kill`) tras N ms de silencio en stdout/stderr → promesa rechazada con "block timeout reached"
- [x] 1.2 Confirmar cómo pasar variables de entorno por-operación (`git.env()`, instancias efímeras, o `-c` flags) sin contaminar la instancia global usada por operaciones locales — `.env(obj)` REEMPLAZA todo el env del hijo; hay que pasar `{ ...process.env, ... }` y usar instancias efímeras para no contaminar el `git` global
- [x] 1.3 Confirmar el mejor mecanismo de inyección efímera de credenciales HTTPS (`GIT_ASKPASS` / `credential.helper` efímero / `http.extraHeader`) según exposición en `ps` y soporte de simple-git — elegido: `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` (git ≥2.31) → `http.extraHeader` por env, sin exposición en `ps` ni disco

## 2. Capa 1 — No colgar (robustez)

- [x] 2.1 Instanciar `simpleGit({ timeout: { block: 15000 } })` en `src/git/index.ts` (constante `NETWORK_TIMEOUT_MS`, aplicada al `git` global y a `networkGit()`)
- [x] 2.2 Ejecutar operaciones de red con `GIT_TERMINAL_PROMPT=0` + SSH `BatchMode=yes`/`StrictHostKeyChecking=accept-new` (helper `networkGit()`)
- [x] 2.3 Refactor de `getRemoteBehindCount` → `checkRemoteSync()` con tri-estado `RemoteSyncResult` (`verified{behind}` / `unverified{reason}`)
- [x] 2.4 `handleCheckpoint` mapea `unverified` a `p.log.warn` no fatal y continúa; `verified` mantiene el comportamiento previo (advertir/bloquear si `behind > 0`)
- [x] 2.5 `getLatestRemoteStableVersion` usa `networkGit()`; el caller de graduación ya degrada a `null` sin colgar

## 3. Capa 3 — HTTPS con token

- [x] 3.1 `getGitHubRemoteInfo` ahora expone `protocol: "https" | "ssh"` (tipo `GitHubRemoteInfo`)
- [x] 3.2 Helper `tokenAuthEnv()` inyecta el token vía `GIT_CONFIG_COUNT/KEY_0/VALUE_0` → `http.extraHeader`, sin persistir en `.git/config` ni disco
- [x] 3.3 Sync: `checkpoint.ts` resuelve token con `resolveGithubToken()` sólo si el remoto es HTTPS (sin device-flow) y lo pasa a `checkRemoteSync`; sin token → `unverified: auth`
- [x] 3.4 Push: `execute.ts` pushea con `pushRelease(ghToken)`; si falla y es HTTPS+GitHub sin token (y no `--yes`), ofrece `interactiveGithubLogin()` y reintenta
- [x] 3.5 El token vive sólo en el env del subproceso (no en args) → no aparece en mensajes de error de simple-git; nunca se loguea

## 4. i18n — nuevas claves

- [x] 4.1 Claves en `src/i18n/types.ts`: `checkpoint.remoteUnverified(reason)` + `remoteUnverifiedTimeout/Auth/Error`; `execute.pushHttpsLoginPrompt` + `pushRetrying`
- [x] 4.2 Traducciones en `src/i18n/es.ts`
- [x] 4.3 Traducciones en `src/i18n/en.ts`

## 5. Capa 2 — Documentación

- [x] 5.1 `README.md` — nueva sección "Remote access requirements" / "Requisitos de acceso al remoto" (EN + ES): SSH vs HTTPS, token efímero, no-hang, login en push, nota sobre password removida por GitHub
- [x] 5.2 `CLAUDE.md` — sección "Remote sync check" actualizada con el tri-estado, `networkGit()` no-hang, y auth HTTPS por token/login

## 6. Verificación

- [x] 6.1 Reproducir el caso original: harness de scratchpad `test-network-hardening.mjs` (tsx contra `src/git/index.ts`) — fetch HTTPS sin credenciales sobre repo temporal → NO cuelga, `unverified: auth` en ~0.5s
- [x] 6.2 Simular red muda/timeout: mismo harness — remoto HTTPS a IP no ruteable `10.255.255.1` → `unverified: error` en ~3s, sin spinner infinito (y el `block` timeout de 15s lo cubriría igual)
- [x] 6.3 Clon SSH con clave en agente → verificado sobre este mismo repo (remoto SSH real): `checkRemoteSync()` → `{status:"verified",behind:0}` en ~2.6s, sin regresión
- [ ] 6.4 Clon HTTPS con `GITHUB_TOKEN` en env → verificar sync autenticado e informa `behind` (requiere token real del usuario)
- [ ] 6.5 Clon HTTPS sin credencial → push → login device-flow y push OK tras autenticar (requiere flujo interactivo real del usuario)
- [x] 6.6 ESLint N/A — el proyecto no tiene ESLint configurado (sin `.eslintrc*`/`eslint.config.*`/`eslintConfig`); build (`pnpm build`) y `tsc --noEmit` pasan sin errores nuevos

<!-- 6.4–6.5 requieren credenciales reales / flujo interactivo del usuario; 6.1–6.3 verificadas (harness automatizado + remoto SSH real de este repo) -->

