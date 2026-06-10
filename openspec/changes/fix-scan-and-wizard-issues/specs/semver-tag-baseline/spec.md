# semver-tag-baseline

Resolución del último tag de un package por orden semver real, para que el escaneo de commits nunca re-liste commits ya publicados (issue #62).

## ADDED Requirements

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

### Requirement: Scan baseline excludes already-released commits
El escaneo de commits de un package SHALL usar como baseline el tag semver-mayor, de modo que los commits alcanzables desde ese tag no aparezcan como candidatos a release.

#### Scenario: Escaneo tras graduación de pre-release (caso del issue #62)
- **WHEN** un package fue tageado `pkg@1.2.0-beta.3` en una rama, luego graduado a `pkg@1.2.0` (cuyo changelog incluyó los commits de la beta), y se ejecuta un nuevo escaneo
- **THEN** los commits ya incluidos en el changelog de `1.2.0` NO aparecen en la lista del paso 2; solo aparecen commits posteriores al tag `pkg@1.2.0`
