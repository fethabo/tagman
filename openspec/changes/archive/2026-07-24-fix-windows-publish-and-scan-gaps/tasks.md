# Tasks — fix-windows-publish-and-scan-gaps

## 1. Fixes

- [x] 1.1 `src/integrations/npm.ts`: agregar `shell: process.platform === "win32"` a las opciones de `spawn`
- [x] 1.2 `src/commands/wizard/steps/scan-and-select.ts:556`: pasar `ghToken` a `getLatestRemoteStableVersion(pkgName, ghToken)`
- [x] 1.3 `src/commands/wizard/steps/scan-and-select.ts:273`: guard para `pkgInfo.lastTag === null` — omitir el cálculo de lift (sin reorder) y continuar con la pregunta de graduación
- [x] 1.4 `src/core/updater.ts` (`formatCommitList`): cascade sin sufijo de hash; sin `baseUrl`, hash corto como texto plano sin link
- [x] 1.5 `src/core/commits.ts` (`suggestBump`): reemplazar `includes("!:")` por regex de header conveniente `/^[a-zA-Z]+(\([^)]*\))?!:/`
- [x] 1.6 `package.json`: eliminar el campo `module` (typo `.dist/index.mjs`)

## 2. Verificación

- [x] 2.1 `pnpm build` sin errores
- [x] 2.2 En Windows, correr un release de prueba con `npm.publish: true` contra un registry de prueba (o verificar que el spawn arranca y falla por auth, no por ENOENT) *(verificado por inspección: `shell: process.platform === "win32"` — en win32 usa shell para resolver el shim `.cmd`; en POSIX `shell:false` como antes. No ejecutable en Linux.)*
- [x] 2.3 Graduar un pre-release en un repo HTTPS privado con token disponible y verificar que el conflicto remoto se detecta *(verificado por inspección: `getLatestRemoteStableVersion(pkgName, ghToken)` recibe el token ya resuelto en el scan; la firma ya aceptaba `token?` y lo inyecta vía `networkGit`. No hay remoto HTTPS privado disponible acá.)*
- [x] 2.4 Repo de prueba: paquete con versión `x.y.z-beta.0` en manifest sin tags → deseleccionar todos los commits → no debe lanzar excepción *(verificado: `git log null..HEAD` falla con exit 128; el guard `if (pkgInfo.lastTag !== null)` evita construir el rango inválido y continúa a la pregunta de graduación sin reorder)*
- [x] 2.5 Release con cascada: verificar que el CHANGELOG del dependiente no contiene `([cascade](cascade))` *(verificado con `formatCommitList` real: cascade sin sufijo de hash; sin `baseUrl` el hash corto se muestra como `(abc1234)` sin link markdown)*
- [x] 2.6 Verificar sugerencias de bump: mensaje con `!:` incidental → patch; `feat(api)!: ...` → major *(verificado con `suggestBump` real: `fix: ... "!:" ...` → patch, `feat(api)!:`/`feat!:` → major, `feat:` → minor, `BREAKING CHANGE` en body → major)*
