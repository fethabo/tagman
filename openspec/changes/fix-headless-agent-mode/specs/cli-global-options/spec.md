# Spec Delta

## Purpose

Define las opciones del CLI que aplican a cualquier comando de tagman, con independencia de si se escriben antes o después del nombre del subcomando.

## ADDED Requirements

### Requirement: --lang aplica a cualquier subcomando y en cualquier posición
`--lang <es|en>` SHALL fijar el idioma de la UI tanto si se pasa antes del subcomando (`tagman --lang en release`) como después (`tagman release --lang en`), y también sin subcomando (menú principal). Si no se pasa, el idioma por defecto SHALL ser `es`.

#### Scenario: Antes del subcomando
- **WHEN** se ejecuta `tagman --lang en release --dry-run`
- **THEN** la UI se muestra en inglés

#### Scenario: Después del subcomando
- **WHEN** se ejecuta `tagman release --lang en --dry-run`
- **THEN** la UI se muestra en inglés

#### Scenario: github-release
- **WHEN** se ejecuta `tagman --lang en github-release`
- **THEN** la UI se muestra en inglés

#### Scenario: Valor inválido
- **WHEN** se ejecuta `tagman --lang fr release`
- **THEN** la UI se muestra en español (default)

### Requirement: --lang figura como opción global en la ayuda
`tagman --help` SHALL listar `--lang` como opción del programa. La ayuda de cada subcomando SHALL indicar que la opción global está disponible.

#### Scenario: Ayuda del programa
- **WHEN** se ejecuta `tagman --help`
- **THEN** la salida incluye `--lang <lang>`
