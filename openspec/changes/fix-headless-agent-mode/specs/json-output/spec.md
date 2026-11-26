# Spec Delta

## Purpose

Define el contrato de la salida legible por máquina de `tagman release --json`, para que scripts, pipelines y agentes puedan parsear el resultado de forma confiable, tanto si el release termina bien como si falla.

## ADDED Requirements

### Requirement: stdout contiene solo el documento JSON
Con `--json`, todo lo que tagman escribe en stdout SHALL ser exactamente un documento JSON válido, emitido al terminar. La UI (intro, logs, spinners, notas, prompts) SHALL ir a stderr, y la pantalla MUST NOT limpiarse.

#### Scenario: stdout parseable
- **WHEN** se ejecuta `tagman release --packages pkg-a --bump patch --yes --json > out.json`
- **THEN** `out.json` contiene un único documento JSON válido y nada más

#### Scenario: La UI sigue visible
- **WHEN** se ejecuta el mismo comando en una terminal
- **THEN** los mensajes de progreso aparecen por stderr

### Requirement: Documento de éxito
Si el release se completa, el documento SHALL tener la forma `{ "success": true, "packages": [{ "name", "previousVersion", "newVersion", "tag" }] }`. Con `--dry-run` SHALL incluir además `"dryRun": true`.

#### Scenario: Release exitoso
- **WHEN** se libera `pkg-a` de `1.0.0` a `1.1.0` con `--json`
- **THEN** stdout contiene `success: true` y una entrada con `name: "pkg-a"`, `previousVersion: "1.0.0"` y `newVersion: "1.1.0"`, y su `tag`

#### Scenario: Dry run
- **WHEN** se corre `--dry-run --json`
- **THEN** el documento tiene `success: true`, `dryRun: true` y los paquetes con la versión que tendrían

### Requirement: Documento de fallo
Si el release no se completa, el documento SHALL tener la forma `{ "success": false, "reason": <código>, "message": <texto> }`. Los valores de `reason` son:
- `no-commits`
- `cancelled` (cancelación interactiva; código de salida 0)
- `packages-required`
- `package-not-found`
- `dirty-tree`
- `behind-remote`
- `pending-checkpoint`
- `interaction-required`
- `error`

#### Scenario: Nada para liberar
- **WHEN** no hay candidatos y se corre con `--yes --json`
- **THEN** stdout contiene `{ "success": false, "reason": "no-commits", ... }` y el código de salida es 0

#### Scenario: Faltan paquetes
- **WHEN** se corre `--yes --json` sin `--packages`
- **THEN** `reason` es `packages-required`, el documento incluye `candidates` con los nombres de los paquetes candidatos, y el código de salida es 1

#### Scenario: Prompt sin interacción
- **WHEN** se alcanza un prompt en modo no interactivo con `--json`
- **THEN** `reason` es `interaction-required` y el código de salida es 2

#### Scenario: Error inesperado
- **WHEN** ocurre un error no controlado con `--json`
- **THEN** `reason` es `error`, `message` contiene la descripción y el código de salida es 1

### Requirement: Los mensajes de fallo respetan el idioma
El campo `message` SHALL estar en el idioma seleccionado con `--lang`. Los valores de `reason` SHALL ser siempre los mismos identificadores estables, en cualquier idioma.

#### Scenario: Inglés
- **WHEN** se corre con `--lang en --json` y falla por working tree sucio
- **THEN** `reason` es `dirty-tree` y `message` está en inglés
