# cascade-commit-visibility

## Purpose

El pseudo-commit "cascade" de actualización de dependencia siempre es visible y seleccionable en el paso 2 del wizard (issue #58).

## Requirements

### Requirement: Cascade pseudo-commit always shown in step 2
Cuando el usuario acepta versionar en cascada un package dependiente, el pseudo-commit `chore: update dependency <pkg> to <version>` SHALL mostrarse como opción seleccionable en el paso 2 de ese dependiente, sin importar si el dependiente tiene o no commits propios de ruta.

#### Scenario: Dependiente sin commits de ruta propios (caso del issue #58)
- **WHEN** un package dependiente no tiene commits que afecten su directorio (candidato extra-only) y el usuario acepta la cascada
- **THEN** el paso 2 del dependiente se muestra igualmente, con el pseudo-commit "cascade" listado y pre-seleccionado

#### Scenario: Dependiente con commits de ruta propios
- **WHEN** un package dependiente tiene commits propios y el usuario acepta la cascada
- **THEN** el paso 2 muestra el pseudo-commit "cascade" junto a los commits reales (comportamiento existente, sin regresión)

### Requirement: Cascade pseudo-commit included in release output
El pseudo-commit "cascade" seleccionado SHALL incluirse en `chosenCommits`, y por lo tanto en el mensaje del tag y en la entrada de CHANGELOG del dependiente.

#### Scenario: Changelog del dependiente extra-only documenta la cascada
- **WHEN** un dependiente sin commits propios se versiona por cascada y completa el wizard
- **THEN** su entrada de CHANGELOG y su tag annotation contienen la línea `chore: update dependency <pkg> to <version>`

#### Scenario: Modo headless
- **WHEN** se ejecuta con `--yes` (cascada auto-aceptada) y el dependiente no tiene commits propios
- **THEN** el pseudo-commit "cascade" se incluye automáticamente en los commits del dependiente

### Requirement: Back navigation restores candidate state
Si el usuario navega hacia atrás desde el paso de cascada, el estado del candidato dependiente SHALL restaurarse exactamente al previo (incluido su carácter de extra-only) antes de re-ejecutar los pasos 2-3.

#### Scenario: Back desde cascade con dependiente extra-only
- **WHEN** la cascada agregó el pseudo-commit a un candidato extra-only y el usuario presiona back
- **THEN** el pseudo-commit se remueve y el candidato vuelve a comportarse como extra-only en el reintento
