# Spec Delta

## MODIFIED Requirements

### Requirement: Last tag resolution by semver order
`getLastTagForPackage(name)` SHALL devolver el tag del package (según el esquema de `tagName`: `name@<version>` con `full`, `<version>` o `name@<version>` con `version-only`) cuya `<version>` sea la mayor según comparación semver (`semver.rcompare`), sin depender del orden de `git tag --sort=-v:refname`. Los tags cuya porción de versión no sea semver válido SHALL ser descartados.

#### Scenario: Pre-release tag junto a tag estable graduado
- **WHEN** existen los tags `pkg@1.2.0-beta.3` y `pkg@1.2.0` para el package `pkg`
- **THEN** `getLastTagForPackage("pkg")` devuelve `pkg@1.2.0` (el estable, semver-mayor), no `pkg@1.2.0-beta.3`

#### Scenario: Pre-release más nueva que el último estable
- **WHEN** existen los tags `pkg@1.2.0` y `pkg@1.3.0-rc.1`
- **THEN** `getLastTagForPackage("pkg")` devuelve `pkg@1.3.0-rc.1` (semver `1.3.0-rc.1 > 1.2.0`)

#### Scenario: Tag con versión no-semver
- **WHEN** existen los tags `pkg@latest` y `pkg@1.0.0`
- **THEN** `getLastTagForPackage("pkg")` devuelve `pkg@1.0.0` e ignora `pkg@latest`

#### Scenario: Orden semver con version-only
- **WHEN** existen los tags `1.2.0-beta.3`, `1.2.0` y `1.10.0` con `tagName: "version-only"`
- **THEN** el último tag del package es `1.10.0`

### Requirement: Scan excludes commits reachable from any package tag
El escaneo de commits de **ruta** de un package SHALL listar únicamente commits que NO sean alcanzables desde ningún tag existente del package según el esquema de `tagName` (exclusión multi-tag; con `version-only` incluye los tags de versión sueltos y los `name@*` heredados, y nunca tags no-semver). Esta exclusión multi-tag aplica ÚNICAMENTE a la detección de `packagesWithCommits` (función `getUnreleasedCommitsForPath`). La recolección de repo commits para `extraOnlyCandidates` SHALL usar `getRepoCommitsSince(lastTag)` con el tag más reciente por semver correcto, no la exclusión multi-tag. La recolección de commits de ciclo para graduación (desde el último tag estable) queda exenta: agrega deliberadamente commits ya incluidos en pre-releases del ciclo.

#### Scenario: Escaneo tras graduación de pre-release (caso original del issue #62)
- **WHEN** un package fue tageado `pkg@1.2.0-beta.3` en una rama, luego graduado a `pkg@1.2.0` (cuyo changelog incluyó los commits de la beta), y se ejecuta un nuevo escaneo
- **THEN** los commits ya incluidos en el changelog de `1.2.0` NO aparecen en la lista del paso 2; solo aparecen commits posteriores al tag `pkg@1.2.0`

#### Scenario: Canales de pre-release paralelos en ramas distintas (reapertura del issue #62)
- **WHEN** existen tags `pkg@1.1.0-canal-a.0` … `pkg@1.1.0-canal-a.4` creados en la rama `canal-a`, y un tag estable `pkg@1.1.0` creado desde otra rama (semver-mayor pero sin los commits de `canal-a` en su historia), y se escanea desde la rama `canal-a`
- **THEN** los commits ya releaseados bajo los tags `canal-a.N` NO aparecen en el paso 2, aunque no sean alcanzables desde `pkg@1.1.0`; solo aparecen los commits que no están en ningún tag del package

#### Scenario: Package nunca releaseado
- **WHEN** un package no tiene ningún tag según el esquema configurado
- **THEN** el escaneo lista todos los commits que afectan su directorio (comportamiento previo sin baseline)

#### Scenario: ExtraOnly con paquete graduado y actividad posterior en el repo
- **WHEN** un package tiene tags `pkg@0.1.6-beta.1` y `pkg@0.1.7`, sin commits propios nuevos, pero hay commits de otros paquetes después de `pkg@0.1.7`
- **THEN** el package aparece como `extraOnlyCandidate` porque `getRepoCommitsSince("pkg@0.1.7")` devuelve commits (no se aplica exclusión multi-tag en este branch)

#### Scenario: Segundo release con version-only (issue #74)
- **WHEN** existe el tag `0.11.0`, `tagName` es `"version-only"` y se agrega un commit en el paquete
- **THEN** el paso 2 lista solo ese commit, no los liberados en `0.11.0`
