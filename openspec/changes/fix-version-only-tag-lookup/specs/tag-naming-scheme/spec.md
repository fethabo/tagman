# Spec Delta

## Purpose

Define cómo tagman nombra, reconoce y compara los tags de release según la opción `tagName` (`full` o `version-only`), de modo que lo que se escribe y lo que se lee usen siempre el mismo esquema (issue #74).

## ADDED Requirements

### Requirement: Tag name follows the configured scheme
Todo tag de release que tagman cree, borre en un rollback o muestre como nombre de tag SHALL llamarse `<paquete>@<versión>` con `tagName: "full"` y `<versión>` con `tagName: "version-only"`.

#### Scenario: Tag con full
- **WHEN** se libera `pkg` en `1.4.0` con `tagName: "full"`
- **THEN** el tag creado es `pkg@1.4.0`

#### Scenario: Tag con version-only
- **WHEN** se libera el único paquete del repo en `0.12.0` con `tagName: "version-only"`
- **THEN** el tag creado es `0.12.0`

#### Scenario: Rollback borra el tag del esquema configurado
- **WHEN** un checkpoint de `0.12.0` se revierte con `tagName: "version-only"`
- **THEN** el rollback borra el tag local `0.12.0`, no `pkg@0.12.0`

### Requirement: Version-only tag recognition
Con `tagName: "version-only"`, un tag SHALL reconocerse como tag de release del paquete si su nombre completo es una versión semver válida sin prefijo. Los tags cuyo nombre no sea semver válido SHALL ignorarse en toda búsqueda de release, incluida la exclusión de commits ya liberados.

#### Scenario: Tag ajeno que empieza con dígito
- **WHEN** existen los tags `0.11.0` y `2fa-setup`, y `2fa-setup` apunta a un commit posterior a `0.11.0` que no fue liberado
- **THEN** el último tag es `0.11.0` y el commit de `2fa-setup` aparece como sin liberar

#### Scenario: Prefijo v no se reconoce
- **WHEN** existe solo el tag `v1.0.0` con `tagName: "version-only"`
- **THEN** el paquete se trata como nunca liberado

### Requirement: Version-only reads legacy full-scheme tags
Con `tagName: "version-only"`, las búsquedas de release SHALL reconocer además los tags `<paquete>@<versión>` del paquete, para que un repo que cambió de `full` a `version-only` conserve su historial. La versión de esos tags SHALL compararse junto con la de los tags sueltos por orden semver.

#### Scenario: Primer release tras migrar de full
- **WHEN** existe el tag `pkg@0.11.0`, el config cambia a `version-only` y se agrega un commit
- **THEN** el escaneo lista solo el commit nuevo, y el tag creado es `0.12.0`

#### Scenario: Esquemas mezclados
- **WHEN** existen los tags `pkg@0.11.0` y `0.12.0` con `tagName: "version-only"`
- **THEN** el último tag es `0.12.0`

### Requirement: Changelog compare link follows the scheme
El link de comparación del encabezado de cada entrada del CHANGELOG SHALL usar los nombres de tag del esquema configurado para la versión anterior y la nueva.

#### Scenario: Link con version-only
- **WHEN** se libera `0.12.0` desde `0.11.0` con `tagName: "version-only"` y remoto GitHub `owner/repo`
- **THEN** el encabezado enlaza a `https://github.com/owner/repo/compare/0.11.0...0.12.0`

#### Scenario: Link con full sin cambios
- **WHEN** se libera `pkg` en `1.4.0` desde `1.3.0` con `tagName: "full"`
- **THEN** el encabezado enlaza a `.../compare/pkg@1.3.0...pkg@1.4.0`

#### Scenario: CHANGELOG del segundo release
- **WHEN** existe el tag `0.11.0`, se agrega un commit y se libera `0.12.0` con `tagName: "version-only"`
- **THEN** la entrada `0.12.0` del CHANGELOG lista solo los commits posteriores a `0.11.0`

### Requirement: Version-only requires a single-package workspace
`tagman release` SHALL fallar antes del escaneo, sin escribir nada, cuando `tagName` es `"version-only"` y el workspace tiene más de un paquete. La falla SHALL salir con código 1 y, con `--json`, emitir `{ success: false, reason: "invalid-config", message, packages }`, donde `packages` es la cantidad de paquetes del workspace. Aplica en modo interactivo y headless.

#### Scenario: Monorepo con version-only en headless
- **WHEN** se ejecuta `tagman release --packages a --yes --json` en un workspace con los paquetes `a` y `b` y `tagName: "version-only"`
- **THEN** el proceso sale con código 1, stdout contiene `{ "success": false, "reason": "invalid-config", ..., "packages": 2 }` y no se crea ningún archivo, commit ni tag

#### Scenario: Monorepo con version-only en interactivo
- **WHEN** se ejecuta `tagman release` en una terminal en un workspace de dos paquetes con `tagName: "version-only"`
- **THEN** se muestra el error de configuración, no aparece ningún prompt y el proceso sale con código 1

#### Scenario: Un solo paquete con version-only
- **WHEN** el workspace tiene un único paquete y `tagName: "version-only"`
- **THEN** el release continúa normalmente
