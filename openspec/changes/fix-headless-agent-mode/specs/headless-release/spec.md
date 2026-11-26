# Spec Delta

## Purpose

Define cómo se comporta `tagman release` cuando ningún humano puede responder prompts (flag `--yes`, CI o un agente sin TTY). Cubre qué decisiones se toman solas, qué compuertas de seguridad fallan en lugar de asumir, y qué códigos de salida permiten distinguir cada resultado.

## ADDED Requirements

### Requirement: --yes completa un release sin prompts
Con `--yes` y `--packages`, `tagman release` SHALL completar el release sin mostrar ningún prompt (bump, commits, cascada, tags, mensajes, confirmación ni push), haya TTY o no.

#### Scenario: Release headless de un paquete
- **WHEN** se ejecuta `tagman release --packages pkg-a --bump minor --yes` con stdin cerrado y `pkg-a` tiene commits nuevos
- **THEN** se actualiza la versión de `pkg-a`, se agrega la entrada al CHANGELOG, se crea el commit de release y el tag anotado, y el proceso termina con código 0

#### Scenario: Release headless en una terminal real
- **WHEN** se ejecuta el mismo comando en una terminal interactiva
- **THEN** no se muestra ningún prompt y el resultado es el mismo

### Requirement: --yes acepta la opción preseleccionada
Para cada decisión que no es una compuerta de seguridad, `--yes` SHALL tomar la misma opción que el prompt interactivo muestra preseleccionada.

#### Scenario: Crear tag con mensaje autogenerado
- **WHEN** se corre un release con `--yes`
- **THEN** se crea el tag de cada paquete y su mensaje es el autogenerado durante el scan

#### Scenario: Graduación usa el mensaje de graduación
- **WHEN** con `--yes` se libera un paquete en pre-release sin commits nuevos y se resuelve como graduación
- **THEN** el mensaje del tag es el mensaje de graduación autogenerado

#### Scenario: Conflicto de graduación con el remoto
- **WHEN** con `--yes` la versión estable de una graduación ya existe en el remoto
- **THEN** la nueva versión sube a la siguiente patch de la última estable remota, sin preguntar

### Requirement: Bump por defecto sin --bump
Con `--yes` y sin `--bump`, cada paquete SHALL recibir el bump preseleccionado del prompt de bump:
- para un paquete estable, el sugerido por sus commits convencionales;
- para un pre-release con commits nuevos, el incremento de pre-release o hotfix en su canal actual;
- para un candidato a graduación, la graduación.

#### Scenario: Bump sugerido por commits
- **WHEN** `pkg-a` está en `1.2.3`, tiene un commit `feat:` y se corre `--packages pkg-a --yes` sin `--bump`
- **THEN** la nueva versión es `1.3.0`

#### Scenario: Pre-release continúa su canal
- **WHEN** `pkg-a` está en `2.0.0-rc.1`, tiene commits nuevos y se corre sin `--bump`
- **THEN** la nueva versión es `2.0.0-rc.2`

### Requirement: El push requiere --push
En modo `--yes`, tagman MUST NOT preguntar si subir los cambios al remoto. SHALL hacer push solo si se pasó `--push`.

#### Scenario: --yes sin --push
- **WHEN** se completa un release con `--yes` y sin `--push`
- **THEN** no se hace push ni se pregunta, y el proceso termina con código 0

#### Scenario: --yes con --push
- **WHEN** se completa un release con `--yes --push`
- **THEN** se suben el commit y los tags sin preguntar

### Requirement: --packages es obligatorio en modo --yes
Con `--yes` y sin `--packages`, tagman SHALL terminar con código 1 sin escribir nada. El mensaje SHALL listar los paquetes candidatos.

#### Scenario: Falta --packages
- **WHEN** se ejecuta `tagman release --yes` y hay candidatos `pkg-a` y `pkg-b`
- **THEN** el proceso termina con código 1, el mensaje menciona `pkg-a` y `pkg-b`, y no se modifica ningún archivo

#### Scenario: Paquete inexistente
- **WHEN** `--packages` no coincide con ningún candidato
- **THEN** el proceso termina con código 1 y no se modifica ningún archivo

### Requirement: Paquetes sin commits se omiten sin --bump
Con `--yes` y sin `--bump`, un paquete pedido en `--packages` que no tiene ningún commit (ni propio ni del repo) desde su último tag SHALL omitirse con una advertencia. Si todos los pedidos se omiten, el resultado SHALL ser "nada para liberar". Con un `--bump` explícito, el paquete SHALL liberarse igual.

#### Scenario: Paquete sin cambios
- **WHEN** `pkg-a` no tiene commits desde su último tag y se corre `--packages pkg-a --yes`
- **THEN** no se libera nada y el proceso termina con código 0 como "nada para liberar"

#### Scenario: Forzado con --bump
- **WHEN** se corre `--packages pkg-a --bump patch --yes` sobre el mismo paquete
- **THEN** se libera `pkg-a` con la siguiente patch

### Requirement: Working tree sucio bloquea el modo --yes
Con `--yes` y cambios sin commitear, tagman SHALL terminar con código 1 antes de escribir nada, salvo que se pase `--allow-dirty`.

#### Scenario: Working tree sucio
- **WHEN** hay cambios sin commitear y se corre con `--yes`
- **THEN** el proceso termina con código 1 e indica que se puede forzar con `--allow-dirty`

#### Scenario: Forzado con --allow-dirty
- **WHEN** hay cambios sin commitear y se corre con `--yes --allow-dirty`
- **THEN** el flujo continúa sin preguntar

### Requirement: Rama atrasada bloquea el modo --yes
Con `--yes` y la rama verificada como atrasada respecto del remoto, tagman SHALL terminar con código 1, salvo que se pase `--allow-behind`. Con `requireRemoteSync: true` SHALL fallar aunque se pase `--allow-behind`. Si no se pudo verificar el remoto, el flujo SHALL seguir con una advertencia.

#### Scenario: Rama atrasada
- **WHEN** la rama está 3 commits detrás del remoto y se corre con `--yes`
- **THEN** el proceso termina con código 1 e indica que se puede forzar con `--allow-behind`

#### Scenario: requireRemoteSync tiene prioridad
- **WHEN** `requireRemoteSync` es `true`, la rama está atrasada y se pasa `--allow-behind`
- **THEN** el proceso termina con código 1

#### Scenario: Remoto no verificable
- **WHEN** no se puede contactar al remoto y se corre con `--yes`
- **THEN** se muestra una advertencia y el release continúa

### Requirement: Checkpoint pendiente bloquea el modo --yes
Si existe un checkpoint de un release interrumpido y se corre con `--yes`, tagman SHALL terminar con código 1 sin retomarlo ni revertirlo. El mensaje SHALL indicar que se resuelve ejecutando tagman en modo interactivo.

#### Scenario: Checkpoint presente
- **WHEN** existe `.tagman-checkpoint.json` y se corre con `--yes`
- **THEN** el proceso termina con código 1 y el checkpoint y el repositorio quedan intactos

### Requirement: Nada para liberar no es un error
Si en modo `--yes` no hay ningún candidato para liberar, tagman SHALL terminar con código 0 sin mostrar el menú alternativo.

#### Scenario: Sin commits nuevos
- **WHEN** ningún paquete tiene commits ni graduaciones pendientes y se corre con `--yes`
- **THEN** el proceso termina con código 0 sin prompts

### Requirement: Un prompt sin interacción posible falla de forma explícita
Si se alcanza un prompt en modo no interactivo (`--yes`, o stdin sin TTY), tagman MUST NOT esperar ni salir en silencio. SHALL terminar con código 2 y un mensaje que identifique la decisión pendiente.

#### Scenario: Sin TTY y sin --yes
- **WHEN** se ejecuta `tagman release` con stdin cerrado y sin `--yes`
- **THEN** el proceso termina con código 2 e indica que se necesita interacción o los flags headless

#### Scenario: Ningún archivo queda a medio escribir
- **WHEN** el prompt que falla está antes de la fase de escritura
- **THEN** no se modifica ningún archivo ni se crea un checkpoint

### Requirement: Los errores terminan con código distinto de cero
Cualquier error no controlado durante `tagman release` o `tagman github-release` SHALL terminar el proceso con código 1. Cancelar un prompt en modo interactivo (Ctrl+C) conserva su comportamiento actual.

#### Scenario: Error durante la ejecución
- **WHEN** falla la creación del commit de release
- **THEN** se muestra el error y el proceso termina con código 1

### Requirement: --dry-run no cambia
`--dry-run` combinado con `--yes` SHALL seguir mostrando la vista previa sin escribir nada y sin prompts, y SHALL terminar con código 0.

#### Scenario: Dry run headless
- **WHEN** se ejecuta `tagman release --packages pkg-a --bump patch --yes --dry-run`
- **THEN** se muestra la vista previa, no se modifica nada y el proceso termina con código 0
