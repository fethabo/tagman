## MODIFIED Requirements

### Requirement: Scan excludes commits reachable from any package tag
El escaneo de commits de **ruta** de un package SHALL listar únicamente commits que NO sean alcanzables desde ningún tag `name@*` existente del package (exclusión multi-tag). Esta exclusión multi-tag aplica ÚNICAMENTE a la detección de `packagesWithCommits` (función `getUnreleasedCommitsForPath`). La recolección de repo commits para `extraOnlyCandidates` SHALL usar `getRepoCommitsSince(lastTag)` con el tag más reciente por semver correcto, no la exclusión multi-tag. La recolección de commits de ciclo para graduación (desde el último tag estable) queda exenta: agrega deliberadamente commits ya incluidos en pre-releases del ciclo.

#### Scenario: Escaneo tras graduación de pre-release (caso original del issue #62)
- **WHEN** un package fue tageado `pkg@1.2.0-beta.3` en una rama, luego graduado a `pkg@1.2.0` (cuyo changelog incluyó los commits de la beta), y se ejecuta un nuevo escaneo
- **THEN** los commits ya incluidos en el changelog de `1.2.0` NO aparecen en la lista del paso 2; solo aparecen commits posteriores al tag `pkg@1.2.0`

#### Scenario: Canales de pre-release paralelos en ramas distintas (reapertura del issue #62)
- **WHEN** existen tags `pkg@1.1.0-canal-a.0` … `pkg@1.1.0-canal-a.4` creados en la rama `canal-a`, y un tag estable `pkg@1.1.0` creado desde otra rama (semver-mayor pero sin los commits de `canal-a` en su historia), y se escanea desde la rama `canal-a`
- **THEN** los commits ya releaseados bajo los tags `canal-a.N` NO aparecen en el paso 2, aunque no sean alcanzables desde `pkg@1.1.0`; solo aparecen los commits que no están en ningún tag del package

#### Scenario: Package nunca releaseado
- **WHEN** un package no tiene ningún tag `name@*`
- **THEN** el escaneo lista todos los commits que afectan su directorio (comportamiento previo sin baseline)

#### Scenario: ExtraOnly con paquete graduado y actividad posterior en el repo
- **WHEN** un package tiene tags `pkg@0.1.6-beta.1` y `pkg@0.1.7`, sin commits propios nuevos, pero hay commits de otros paquetes después de `pkg@0.1.7`
- **THEN** el package aparece como `extraOnlyCandidate` porque `getRepoCommitsSince("pkg@0.1.7")` devuelve commits (no se aplica exclusión multi-tag en este branch)
