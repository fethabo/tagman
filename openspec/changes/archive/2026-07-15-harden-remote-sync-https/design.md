## Context

`getRemoteBehindCount()` (`src/git/index.ts:228`) hace `await git.fetch(["--quiet", "--no-tags"])` dentro de un `try/catch`, invocado desde `handleCheckpoint` (`src/commands/wizard/steps/checkpoint.ts:32-35`) bajo un spinner `p.spinner()`. El cliente se crea con `simpleGit()` sin opciones (`src/git/index.ts:4`), por lo tanto sin timeout.

Dos hechos combinados producen el cuelgue eterno:
1. **`try/catch` no captura cuelgues.** Un `catch` sólo dispara ante una promesa rechazada. Cuando `git fetch` queda esperando input de credenciales (stdin inexistente en el contexto del spinner) o red muda, la promesa nunca se asienta → el spinner gira para siempre.
2. **HTTPS sin credenciales promptea.** Si el remoto es `https://github.com/...` sin credential helper, git emite `Username for 'https://...'`. Confirmado en campo: `GIT_SSH_COMMAND="ssh -v" git fetch` en la máquina afectada pide usuario/contraseña (señal inequívoca de transporte HTTPS, no SSH). Además, GitHub eliminó auth por contraseña en HTTPS (ago-2021): sólo funciona un PAT/OAuth token como password.

Infra existente relevante: `interactiveGithubLogin()` (`src/integrations/github.ts:9`) hace OAuth **device flow** con `scopes: ["repo"]` usando el client ID del `gh` CLI, y `resolveGithubToken()` (`src/core/token.ts:43`) resuelve el token desde `GITHUB_TOKEN`/`~/.npmrc`. El flujo `github-release` ya aplica el patrón "resolver token → si no hay, ofrecer login" (`src/commands/github-release.ts:31-45`). Un token OAuth con scope `repo` **también autentica git sobre HTTPS**, mismo mecanismo que usa `gh`.

## Goals / Non-Goals

**Goals:**
- El wizard nunca queda colgado por un fetch: timeout + git sin prompts interactivos.
- El chequeo de sync degrada con elegancia (aviso no fatal) cuando el remoto no es accesible o falta credencial.
- Soporte de HTTPS de primera clase reutilizando el token de GitHub ya disponible/loginable, inyectado de forma efímera.
- Política asimétrica: lectura (sync) no fuerza login; escritura (push) sí lo ofrece.
- Documentar los requisitos reales de acceso al remoto.

**Non-Goals:**
- Cambiar el default de transporte ni forzar SSH (HTTPS es un setup legítimo).
- Persistir tokens en disco o en `.git/config` (se mantiene la postura de seguridad de `token.ts`).
- Reimplementar credential helpers del sistema; si el usuario ya tiene uno funcionando, no se interfiere.
- Manejar remotos no-GitHub para la inyección de token (el device-flow y el token son específicos de GitHub); para esos, sólo aplica la Capa 1 (timeout + no colgar).
- Forzar login device-flow para el chequeo de sync (desproporcionado para una verificación de lectura).

## Decisions

### Decisión 1: Timeout en el cliente `simpleGit`

**Elegido: `simpleGit({ timeout: { block: 15000 } })`** (valor exacto a confirmar; 10–20s razonable).

`simple-git` mata el proceso git si no produce output durante `block` ms, convirtiendo un cuelgue en una promesa rechazada que el `try/catch` existente sí captura. Es la red de seguridad más barata y ataca la causa raíz genérica (no sólo el caso HTTPS: también red muda, VPN, proxy).

Alternativa descartada — timeout manual con `Promise.race` por llamada: más código, y no mata el proceso git subyacente (queda zombie). El timeout nativo de simple-git sí lo termina.

### Decisión 2: Deshabilitar prompts interactivos de git

**Elegido: `GIT_TERMINAL_PROMPT=0` (y `GIT_SSH_COMMAND` con `BatchMode=yes`/`StrictHostKeyChecking=accept-new` a confirmar) en el entorno de las operaciones de red.**

Con `GIT_TERMINAL_PROMPT=0`, la falta de credenciales HTTPS hace que git **falle al instante** en vez de colgar pidiendo user/pass. Combinado con la Decisión 1, cubre tanto el prompt de credenciales como el de host-key SSH en primera conexión.

A confirmar durante implementación: cómo pasa `simple-git` variables de entorno por-comando (`git.env(...)` afecta la instancia; puede requerir una instancia dedicada o `-c` flags). Ver Decisión 5.

### Decisión 3: Degradación elegante del chequeo de sync

**Elegido: tri-estado explícito en lugar del `number` actual.**

Hoy `getRemoteBehindCount()` devuelve `number` y colapsa "0 commits detrás" con "no pude verificar" (ambos `0`). Se propone distinguir:
- `verified, behind: N` → comportamiento actual (advertir/bloquear si `behind > 0`).
- `unverified` (timeout, sin credenciales, sin remoto) → aviso no fatal ("no se pudo verificar el estado del remoto; continuando") y seguir.

Forma sugerida: `{ status: "verified"; behind: number } | { status: "unverified"; reason: "no-remote" | "timeout" | "auth" | "error" }`. `handleCheckpoint` mapea `unverified` a un `p.log.warn` en vez de tratarlo como sincronizado silenciosamente.

Trade-off: cambia la firma de una función pública del módulo git; hay que actualizar el call site en `checkpoint.ts`. Aceptable — un solo call site.

### Decisión 4: Inyección efímera del token para HTTPS

**Elegido: inyección vía entorno del subproceso (patrón `GIT_ASKPASS`/`credential`), nunca URL rewrite ni `.git/config`.**

Ranking de exposición del token:
```
a) URL https://TOKEN@github…      → persiste en .git/config + visible en ps   ✗
b) git -c http.extraHeader=Basic… → visible en `ps`/args                       ~
c) GIT_ASKPASS = script efímero    → sólo en env del subproceso                 ✓
```
Se elige (c) o equivalente que mantenga el token fuera de args persistentes y de disco, coherente con `token.ts` (que removió el token de `.npmrc` de proyecto y de config "for security reasons"). El token del device-flow es efímero (en memoria), lo que refuerza esta vía. Detalle exacto (`GIT_ASKPASS` con script temporal vs. `credential.helper` efímero vs. `http.extraHeader` con base64) a decidir en implementación según qué expone menos en `ps` y qué soporta simple-git limpiamente.

### Decisión 5: Aislar la configuración de red en una instancia/helper git dedicada

**Elegido: un helper que arme las llamadas de red con el env correcto (timeout ya global; `GIT_TERMINAL_PROMPT=0` + token opcional por invocación).**

Como el token de sync es lazy y el de push puede venir de un login recién hecho, conviene un punto único que construya el `git` con el env adecuado por operación, en vez de mutar la instancia global compartida (que también se usa para operaciones locales como `git.log`, `git.status`). A confirmar la mejor forma con la API de `simple-git` (`.env()` devuelve la instancia; puede necesitarse `simpleGit({ config: [...] })` o instancias efímeras).

### Decisión 6: Política asimétrica lectura vs. escritura

**Elegido:**
- **Sync (lectura)**: token sólo si ya está resuelto (`resolveGithubToken`, sin prompt). Sin token → `unverified: auth` → aviso + continuar. **No** device-flow.
- **Push (escritura)**: si el remoto es HTTPS y el push falla por auth (o se detecta ausencia de credencial de antemano), ofrecer `interactiveGithubLogin()` y reintentar, replicando la UX del flujo `github-release`.

Razón: forzar un browser + código sólo para responder "¿estás detrás?" es fricción injustificada; para push, la auth es intrínsecamente necesaria y el login ya es un patrón aceptado.

### Decisión 7: Detección de transporte del remoto

Reutilizar/extender `getGitHubRemoteInfo()` (`src/git/index.ts:327`) para además exponer si el remoto es HTTPS vs SSH, de modo que la lógica de push decida si aplica el fallback de token (sólo tiene sentido para HTTPS+GitHub).

## Risks / Trade-offs

- [Riesgo] `simple-git` no expone `timeout.block` como se espera o no mata el proceso → Mitigación: verificar en `node_modules/simple-git` y con una prueba de red muda antes de cerrar la Capa 1.
- [Riesgo] La inyección de token vía `GIT_ASKPASS` puede variar entre plataformas (Windows) → Mitigación: cubrir el caso general con `GIT_TERMINAL_PROMPT=0` (que ya evita el cuelgue); el token HTTPS es una mejora sobre esa base, no un reemplazo.
- [Trade-off] Cambiar la firma de `getRemoteBehindCount` toca su call site → aceptable (uno solo).
- [Trade-off] La Capa 3 sólo cubre remotos GitHub por HTTPS; otros remotos HTTPS (GitLab, self-hosted) siguen dependiendo de su credential helper del sistema, pero al menos ya **no cuelgan** (Capa 1). Documentarlo.
- [Riesgo] Token OAuth device-flow con scope `repo` sobre repos de organizaciones con SSO puede requerir autorización adicional → Mitigación: el error de push se muestra claro (no se traga), el usuario puede autorizar y reintentar.
