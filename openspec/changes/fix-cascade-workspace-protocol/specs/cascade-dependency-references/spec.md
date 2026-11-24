# Spec Delta

## Purpose

Define cómo tagman actualiza o preserva las referencias a dependencias internas en los `package.json` consumidores cuando versiona paquetes del workspace en cascada, y cómo las restaura al hacer rollback.

## ADDED Requirements

### Requirement: Preservar referencias workspace sin versión
Cuando un paquete consumidor referencia una dependencia interna con `workspace:*`, `workspace:^` o `workspace:~`, tagman SHALL dejar esa referencia sin modificar al versionar la dependencia, en `dependencies`, `devDependencies` y `peerDependencies`.

#### Scenario: workspace:* en dependencies
- **WHEN** `@repo/app` declara `"@repo/ui": "workspace:*"` y `@repo/ui` se libera como `1.0.2` junto con `@repo/app`
- **THEN** el `package.json` de `@repo/app` sigue declarando `"@repo/ui": "workspace:*"`

#### Scenario: workspace:^ en peerDependencies
- **WHEN** `@repo/ui` declara `"@repo/shared-logic": "workspace:^"` en `peerDependencies` y `@repo/shared-logic` se libera en la misma release
- **THEN** la referencia sigue siendo `workspace:^`

#### Scenario: pnpm install sigue funcionando
- **WHEN** se completa una release en cascada sobre un monorepo pnpm cuyos paquetes privados usan `workspace:*`
- **THEN** el commit de release no modifica esas referencias y `pnpm install` no intenta resolverlas contra el registry

### Requirement: Actualizar referencias workspace con versión explícita
Cuando la referencia es `workspace:` seguido de una versión con operador opcional (`^`, `~` o ninguno), tagman SHALL conservar el protocolo y el operador y reemplazar solo la versión por la nueva.

#### Scenario: workspace con caret
- **WHEN** la referencia es `workspace:^1.2.3` y la dependencia pasa a `1.3.0`
- **THEN** la referencia queda `workspace:^1.3.0`

#### Scenario: workspace exacto
- **WHEN** la referencia es `workspace:1.2.3` y la dependencia pasa a `1.2.4`
- **THEN** la referencia queda `workspace:1.2.4`

### Requirement: Conservar el operador en referencias semver simples
Cuando la referencia es una versión semver con operador `^`, `~` o sin operador, tagman SHALL conservar ese operador y reemplazar solo la versión.

#### Scenario: tilde
- **WHEN** la referencia es `~1.2.3` y la dependencia pasa a `1.2.4`
- **THEN** la referencia queda `~1.2.4`

#### Scenario: exacta
- **WHEN** la referencia es `1.2.3` y la dependencia pasa a `2.0.0`
- **THEN** la referencia queda `2.0.0`

#### Scenario: versión pre-release
- **WHEN** la referencia es `^1.0.0` y la dependencia pasa a `1.1.0-rc.0`
- **THEN** la referencia queda `^1.1.0-rc.0`

### Requirement: No tocar referencias de otras formas
Para cualquier referencia que no encaje en las formas anteriores (por ejemplo `catalog:`, `npm:`, `file:`, `link:`, URLs git, rangos compuestos, `*` o dist-tags), tagman SHALL dejarla sin modificar.

#### Scenario: catalog
- **WHEN** la referencia es `catalog:` y la dependencia se libera en cascada
- **THEN** la referencia sigue siendo `catalog:`

#### Scenario: rango compuesto
- **WHEN** la referencia es `>=1.0.0 <2.0.0`
- **THEN** la referencia no cambia

### Requirement: No reescribir manifiestos sin cambios
Si ninguna referencia de un `package.json` consumidor cambia, tagman SHALL dejar el archivo sin reescribir, preservando su contenido y formato.

#### Scenario: solo referencias workspace:*
- **WHEN** todas las referencias del consumidor a paquetes liberados son `workspace:*`
- **THEN** el archivo `package.json` del consumidor queda byte a byte igual tras la fase de escritura de dependencias

### Requirement: Rollback exacto de referencias
Al revertir una release interrumpida desde checkpoint, tagman SHALL restaurar cada referencia de dependencia interna del consumidor al valor exacto que tenía antes de la release, en cada campo donde aparecía.

#### Scenario: rollback de workspace:*
- **WHEN** se revierte un checkpoint de una release cuyo consumidor declaraba `workspace:*`
- **THEN** la referencia sigue siendo `workspace:*` y no se convierte a `^<versionAnterior>`

#### Scenario: rango original más bajo que la versión anterior
- **WHEN** el consumidor declaraba `^1.0.0`, la dependencia pasó de `1.2.3` a `1.3.0` (escribiendo `^1.3.0`) y luego se revierte el checkpoint
- **THEN** la referencia vuelve a `^1.0.0`, no a `^1.2.3`

#### Scenario: checkpoint de una versión anterior de tagman
- **WHEN** se revierte un `.tagman-checkpoint.json` escrito antes de este cambio
- **THEN** el rollback se completa sin error y restaura las referencias a su valor original
