# draft-resume-safety

## Purpose

Garantiza que un borrador de release (`.tagman-draft.json`) solo se reanude cuando el plan sigue siendo válido: qué contexto de vigencia se persiste al guardarlo, qué condiciones bloquean la reanudación (versiones cambiadas, reorder obsoleto) y cuáles solo advierten al usuario dejándolo decidir.

## Requirements

### Requirement: El draft persiste su contexto de vigencia
`saveDraft` SHALL guardar junto al plan el hash de HEAD, el nombre de la rama actual y la versión de manifest de cada paquete incluido en el plan al momento de guardar.

#### Scenario: Guardado de un draft
- **WHEN** el usuario elige "Guardar borrador" en el resumen post-scan
- **THEN** `.tagman-draft.json` contiene `context.head`, `context.branch` y `context.versions` con un entry por paquete del plan

### Requirement: Un draft con liftCommits no se reanuda si HEAD cambió
Si el draft contiene `liftCommits` y el HEAD actual difiere del persistido, la reanudación SHALL estar bloqueada: la opción resume no está disponible y solo se puede descartar el draft. El sistema MUST NOT ejecutar `reset --hard` basado en un plan de reorder obsoleto.

#### Scenario: Draft con reorder y rama avanzada
- **WHEN** existe un draft con `liftCommits`, se hicieron commits nuevos después de guardarlo y el usuario inicia el wizard
- **THEN** se informa que el borrador quedó obsoleto por el reorder planificado y solo se ofrece descartarlo

### Requirement: Un draft con versiones desactualizadas no se reanuda
Si la versión actual de manifest de algún paquete del plan difiere de la registrada en el draft, la reanudación SHALL estar bloqueada, indicando qué paquete cambió.

#### Scenario: Paquete liberado por otra vía después de guardar el draft
- **WHEN** un draft registra `pkg-a` en `1.2.0 → 1.3.0` pero el manifest actual de `pkg-a` es `1.3.0`
- **THEN** el resume se bloquea mostrando que `pkg-a` cambió de versión desde que se guardó el borrador

### Requirement: Cambios no bloqueantes generan advertencia
Si HEAD avanzó (sin `liftCommits` en el plan) o la rama actual difiere de la persistida, el sistema SHALL mostrar una advertencia describiendo el cambio y permitir que el usuario decida reanudar o descartar.

#### Scenario: Commits nuevos desde el guardado, sin reorder
- **WHEN** existe un draft sin `liftCommits` y HEAD cambió desde que se guardó
- **THEN** se advierte que hay commits nuevos que no forman parte del plan y el usuario puede reanudar igualmente o descartar

#### Scenario: Draft guardado en otra rama
- **WHEN** el draft se guardó en la rama `develop` y el wizard corre en `main`
- **THEN** se advierte la diferencia de rama antes de ofrecer reanudar

### Requirement: Compatibilidad con drafts sin contexto
Un draft creado por una versión anterior (sin `context`) SHALL seguir cargando: se muestra una advertencia de que su vigencia no puede verificarse, y si contiene `liftCommits` la reanudación queda bloqueada por precaución.

#### Scenario: Draft viejo sin contexto y sin reorder
- **WHEN** se carga un draft sin campo `context` y sin `liftCommits`
- **THEN** se advierte que no se puede verificar su vigencia y el usuario decide

#### Scenario: Draft viejo sin contexto con reorder
- **WHEN** se carga un draft sin campo `context` que contiene `liftCommits`
- **THEN** el resume se bloquea y solo se ofrece descartar
