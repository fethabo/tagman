# release-recovery

## ADDED Requirements

### Requirement: El rollback elimina la entrada agregada al CHANGELOG
El rollback de un checkpoint SHALL eliminar del `CHANGELOG.md` de cada paquete la entrada de la versión abortada, localizándola con el mismo formato de header que escribe `appendToChangelog` (`## [<version>](<url>) (<fecha>)`).

#### Scenario: Rollback tras crash en fase writing
- **WHEN** existe un checkpoint en fase "writing" con la versión `1.3.0` ya anexada al CHANGELOG y el usuario elige rollback
- **THEN** la sección `## [1.3.0](...)` desaparece del CHANGELOG y el contenido previo queda intacto

### Requirement: El rollback resetea el commit de release para todos los tipos de release
El rollback SHALL reconocer el commit de release tanto con mensaje `chore(release): [...]` como `chore(pre-release): [...]`, usando el mismo constructor de mensaje que la ejecución. Un release `hotfix` genera mensaje `chore(release):` (es un release en caliente, no un pre-release) y MUST ser reconocido como tal.

#### Scenario: Rollback de un pre-release en fase committing
- **WHEN** un checkpoint en fase "committing" corresponde a un release con bump `prerelease` cuyo commit `chore(pre-release): [pkg]` ya fue creado, y el usuario elige rollback
- **THEN** el commit se resetea (`--mixed`) y los tags creados se eliminan, quedando el repo consistente

### Requirement: El resume en fase committing es idempotente
Reanudar un checkpoint en fase "committing" SHALL poder ejecutarse cualquiera sea el punto exacto del crash: si el commit de release ya existe en HEAD, se omite su creación; si un tag ya existe, se omite su creación y se continúa con los restantes.

#### Scenario: Crash después del commit, antes de los tags
- **WHEN** el crash ocurrió después de `createReleaseCommit` y el usuario reanuda
- **THEN** no se intenta un segundo commit (no falla con "nothing to commit") y se crean los tags pendientes

#### Scenario: Crash a mitad de la creación de tags
- **WHEN** el crash ocurrió con 1 de 3 tags ya creados y el usuario reanuda
- **THEN** el tag existente se omite sin error y se crean los 2 restantes

### Requirement: Los releases con reorder persisten el HEAD original en el checkpoint
Cuando el plan incluye `liftCommits`, el checkpoint SHALL guardar el hash del HEAD previo al `reset --hard`. El rollback SHALL restaurar ese HEAD (recuperando los commits reordenados y descartando lo escrito), y un fallo del cherry-pick durante un resume SHALL revertir también a ese HEAD eliminando los tags creados.

#### Scenario: Rollback de un release con reorder
- **WHEN** el crash ocurrió después del `reset --hard HEAD~N` de un reorder y el usuario elige rollback
- **THEN** el repositorio vuelve exactamente al HEAD original persistido, incluyendo los commits que habían sido removidos

#### Scenario: Cherry-pick falla durante un resume
- **WHEN** el usuario reanuda un checkpoint con `liftCommits` y el cherry-pick final falla
- **THEN** se aborta el cherry-pick, se restaura el HEAD original persistido y se eliminan los tags creados

### Requirement: Compatibilidad con checkpoints previos
Un `.tagman-checkpoint.json` creado por una versión anterior (sin el campo `origHead`) SHALL seguir siendo cargable; en ese caso el rollback y el resume se comportan como hasta ahora para ese campo.

#### Scenario: Checkpoint viejo sin origHead
- **WHEN** se carga un checkpoint sin campo `origHead`
- **THEN** el resume y el rollback proceden sin error, omitiendo la restauración de HEAD original
