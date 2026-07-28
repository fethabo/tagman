# workspace-detection Specification

## Purpose
TBD - created by archiving change fix-pnpm10-workspace-detection. Update Purpose after archive.
## Requirements
### Requirement: `packages` es opcional en pnpm-workspace.yaml
El schema de `pnpm-workspace.yaml` SHALL declarar `packages` como campo opcional y SHALL preservar las claves desconocidas (`.passthrough()`). Un `pnpm-workspace.yaml` que contiene únicamente claves de configuración de pnpm (`allowBuilds`, `onlyBuiltDependencies`, `catalog`, `catalogs`, u otras) MUST parsearse sin error.

#### Scenario: Yaml solo-settings parsea sin error
- **WHEN** `pnpm-workspace.yaml` contiene solo `allowBuilds:` y ninguna clave `packages`
- **THEN** el parseo del archivo tiene éxito y no se lanza ningún `ZodError`

#### Scenario: Claves de configuración de pnpm sobreviven al parseo
- **WHEN** `pnpm-workspace.yaml` contiene `packages` junto a `onlyBuiltDependencies` y `catalog`
- **THEN** el objeto resultante conserva `onlyBuiltDependencies` y `catalog` además de `packages`

### Requirement: Degradado a paquete único cuando el workspace no está declarado
Cuando el workspace configurado es `pnpm` y `pnpm-workspace.yaml` existe pero no declara `packages`, o lo declara como array vacío, `getWorkspacePackages` SHALL resolver el repositorio como paquete único leyendo el `package.json` de la raíz — el mismo comportamiento que ya aplica cuando `pnpm-workspace.yaml` no existe. SHALL NOT lanzar una excepción en este caso.

#### Scenario: Repo single-package con yaml solo-settings resuelve un paquete
- **WHEN** el workspace es `pnpm`, existe `pnpm-workspace.yaml` sin clave `packages`, y hay un `package.json` válido en la raíz
- **THEN** `getWorkspacePackages` devuelve exactamente un `WorkspacePackage` cuyo `dir` es la raíz del repositorio y cuyo `manifest` es el `package.json` de la raíz

#### Scenario: `packages` vacío también degrada a paquete único
- **WHEN** `pnpm-workspace.yaml` declara `packages: []` y hay un `package.json` válido en la raíz
- **THEN** `getWorkspacePackages` devuelve el paquete de la raíz en lugar de una lista vacía

#### Scenario: Yaml solo-settings sin package.json en la raíz falla con mensaje claro
- **WHEN** existe `pnpm-workspace.yaml` sin clave `packages` y no hay `package.json` en la raíz
- **THEN** se lanza el mismo error accionable que en el caso de yaml ausente sin `package.json`, indicando que no se encontró workspace ni `package.json` válido

### Requirement: Aviso cuando el workspace no está declarado
Al degradar a paquete único por ausencia de `packages` en un `pnpm-workspace.yaml` existente, tagman SHALL emitir un aviso al usuario que indique que el archivo no declara `packages` y que el repositorio se está tratando como paquete único. El texto SHALL provenir del sistema `t()`. El aviso SHALL NOT interrumpir el flujo ni requerir confirmación.

#### Scenario: El usuario ve el aviso antes del escaneo
- **WHEN** el flujo de release degrada a paquete único por un `pnpm-workspace.yaml` sin `packages`
- **THEN** se muestra el aviso traducido y el wizard continúa hacia el paso de escaneo sin pedir confirmación

#### Scenario: No hay aviso cuando el yaml declara packages
- **WHEN** `pnpm-workspace.yaml` declara `packages` con al menos un glob que resuelve paquetes
- **THEN** no se emite ningún aviso de workspace no declarado

#### Scenario: No hay aviso cuando el yaml no existe
- **WHEN** no existe `pnpm-workspace.yaml` y se resuelve el paquete de la raíz
- **THEN** no se emite el aviso de workspace no declarado, porque no hay archivo que contradiga la resolución

### Requirement: Precedencia de resolución sin cambios
La precedencia existente para descubrir paquetes SHALL permanecer intacta: `config.packagesRoutes` no vacío tiene prioridad máxima; luego, para workspace `pnpm`, `pnpm-workspace.yaml`; y para `npm`/`yarn`/`bun`, el campo `workspaces` del `package.json` de la raíz. Ninguna de estas rutas cambia de comportamiento.

#### Scenario: packagesRoutes gana sobre un yaml solo-settings
- **WHEN** `tagman.config.json` define `packagesRoutes` con al menos una entrada y existe un `pnpm-workspace.yaml` sin `packages`
- **THEN** los paquetes se resuelven desde `packagesRoutes`, el yaml no se lee y no se emite el aviso de workspace no declarado

#### Scenario: Workspace pnpm declarado sigue funcionando igual
- **WHEN** `pnpm-workspace.yaml` declara `packages: ["packages/*"]` en un monorepo con varios paquetes
- **THEN** `getWorkspacePackages` devuelve todos los paquetes que resuelven esos globs, igual que antes de este cambio

