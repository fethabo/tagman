# semver-tag-baseline

## Purpose

Resolución del último tag de un package por orden semver real, para que el escaneo de commits nunca re-liste commits ya publicados (issue #62).

## Requirements

### Requirement: Last tag resolution by semver order
`getLastTagForPackage(name)` SHALL devolver el tag `name@<version>` cuya `<version>` sea la mayor según comparación semver (`semver.rcompare`), sin depender del orden de `git tag --sort=-v:refname`. Los tags cuya porción de versión no sea semver válido SHALL ser descartados.

#### Scenario: Pre-release tag junto a tag estable graduado
- **WHEN** existen los tags `pkg@1.2.0-beta.3` y `pkg@1.2.0` para el package `pkg`
- **THEN** `getLastTagForPackage("pkg")` devuelve `pkg@1.2.0` (el estable, semver-mayor), no `pkg@1.2.0-beta.3`

#### Scenario: Pre-release más nueva que el último estable
- **WHEN** existen los tags `pkg@1.2.0` y `pkg@1.3.0-rc.1`
- **THEN** `getLastTagForPackage("pkg")` devuelve `pkg@1.3.0-rc.1` (semver `1.3.0-rc.1 > 1.2.0`)

#### Scenario: Tag con versión no-semver
- **WHEN** existen los tags `pkg@latest` y `pkg@1.0.0`
- **THEN** `getLastTagForPackage("pkg")` devuelve `pkg@1.0.0` e ignora `pkg@latest`

### Requirement: Stable tag resolution by semver order
`getLastStableTagForPackage(name)` y `getLatestRemoteStableVersion(name)` SHALL seleccionar la versión estable (sin componente pre-release) **mayor por semver**, iterando los tags en orden semver descendente.

#### Scenario: Estables fuera de orden lexicográfico
- **WHEN** existen los tags `pkg@1.9.0`, `pkg@1.10.0` y `pkg@1.10.0-rc.2`
- **THEN** `getLastStableTagForPackage("pkg")` devuelve `pkg@1.10.0`

### Requirement: Scan excludes commits reachable from any package tag
El escaneo de commits de un package SHALL listar únicamente commits que NO sean alcanzables desde ningún tag `name@*` existente del package (exclusión multi-tag), en lugar de usar un rango desde un único tag baseline. La recolección de commits de ciclo para graduación (desde el último tag estable) queda exenta: agrega deliberadamente commits ya incluidos en pre-releases del ciclo.

#### Scenario: Escaneo tras graduación de pre-release (caso original del issue #62)
- **WHEN** un package fue tageado `pkg@1.2.0-beta.3` en una rama, luego graduado a `pkg@1.2.0` (cuyo changelog incluyó los commits de la beta), y se ejecuta un nuevo escaneo
- **THEN** los commits ya incluidos en el changelog de `1.2.0` NO aparecen en la lista del paso 2; solo aparecen commits posteriores al tag `pkg@1.2.0`

#### Scenario: Canales de pre-release paralelos en ramas distintas (reapertura del issue #62)
- **WHEN** existen tags `pkg@1.1.0-canal-a.0` … `pkg@1.1.0-canal-a.4` creados en la rama `canal-a`, y un tag estable `pkg@1.1.0` creado desde otra rama (semver-mayor pero sin los commits de `canal-a` en su historia), y se escanea desde la rama `canal-a`
- **THEN** los commits ya releaseados bajo los tags `canal-a.N` NO aparecen en el paso 2, aunque no sean alcanzables desde `pkg@1.1.0`; solo aparecen los commits que no están en ningún tag del package

#### Scenario: Package nunca releaseado
- **WHEN** un package no tiene ningún tag `name@*`
- **THEN** el escaneo lista todos los commits que afectan su directorio (comportamiento previo sin baseline)
