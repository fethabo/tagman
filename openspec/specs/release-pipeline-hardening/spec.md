# release-pipeline-hardening Specification

## Purpose
TBD - created by archiving change fix-windows-publish-and-scan-gaps. Update Purpose after archive.
## Requirements
### Requirement: La publicación npm funciona en Windows
`publishPackage` SHALL ejecutar `pnpm publish` correctamente en win32 (donde `pnpm` es un shim `.cmd`) y en POSIX, propagando el código de salida como hasta ahora.

#### Scenario: Publicación en Windows
- **WHEN** un release con `npm.publish: true` corre en Windows con pnpm instalado
- **THEN** `pnpm publish --access=<access> --no-git-checks` se ejecuta en el directorio del paquete y no falla con `ENOENT`

### Requirement: El chequeo remoto de graduación usa el token resuelto
Al graduar un pre-release, la consulta de la última versión estable remota SHALL usar el token de GitHub ya resuelto durante el scan (cuando existe), igual que las demás operaciones de red autenticadas.

#### Scenario: Graduación contra remoto HTTPS privado
- **WHEN** el usuario gradúa un pre-release en un repo con remoto HTTPS privado y hay token disponible (env/.npmrc)
- **THEN** el fetch de tags remotos se autentica con ese token y el conflicto con una versión estable ya publicada se detecta y advierte

### Requirement: Paquetes sin tags no rompen el camino de graduación
El flujo de "cero commits seleccionados sobre un pre-release" SHALL tolerar `lastTag === null` (paquete con versión pre-release en el manifest pero sin tags), omitiendo el cálculo de commits a reordenar en lugar de construir un rango git inválido.

#### Scenario: Manifest pre-release sin ningún tag previo
- **WHEN** un paquete tiene versión `1.0.0-beta.0` en su manifest, no existe ningún tag `pkg@*` y el usuario deselecciona todos los commits
- **THEN** el wizard continúa (ofrece graduar sin reorder) sin lanzar una excepción por el rango `null..HEAD`

### Requirement: Los commits sintéticos no generan links rotos
`formatCommitList` MUST NOT emitir links markdown cuya URL no sea válida: las entradas de cascada (hash sintético `cascade`) muestran su texto sin link de hash, y cuando no hay `baseUrl` el hash corto se muestra como texto plano.

#### Scenario: Entrada de cascada en el CHANGELOG
- **WHEN** un paquete se libera por cascada de dependencias y su entrada se escribe al CHANGELOG
- **THEN** la línea muestra el mensaje `chore: update dependency ...` sin `([cascade](cascade))`

#### Scenario: Repo sin URL de repositorio configurada
- **WHEN** el `package.json` raíz no tiene campo `repository`
- **THEN** las líneas de commit muestran el hash corto sin link markdown a una URL inválida

### Requirement: La detección de breaking change por `!` se limita al header conveniente
`suggestBump` SHALL marcar `major` por `!` solo cuando el header cumple el formato conveniente `tipo(scope)!: ...` o `tipo!: ...`, y no ante cualquier aparición de `!:` en el mensaje.

#### Scenario: Mensaje con "!:" incidental
- **WHEN** los commits incluyen `fix: escape sequence handling for "!:" tokens` y ningún breaking change real
- **THEN** el bump sugerido es `patch`, no `major`

#### Scenario: Breaking change convencional
- **WHEN** los commits incluyen `feat(api)!: remove legacy endpoint`
- **THEN** el bump sugerido es `major`

