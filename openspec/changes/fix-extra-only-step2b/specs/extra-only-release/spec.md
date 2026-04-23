## ADDED Requirements

### Requirement: Step 2b pre-selecciona commits para paquetes extra-only
Cuando el wizard procesa un paquete `isExtraOnly` (sin commits de ruta propios, con commits globales de repo), el paso de selección de commits extra (step 2b) SHALL inicializar con todos los `extraCommits` pre-seleccionados, de forma que el usuario vea qué commits se incluirán por defecto y pueda deseleccionar los que no quiera.

#### Scenario: Step 2b inicia con todos los commits pre-seleccionados para isExtraOnly
- **WHEN** el wizard procesa un paquete con `isExtraOnly = true` en modo interactivo
- **THEN** el `commitMultiSelect` de step 2b se muestra con todos los `extraCommits` seleccionados por defecto

#### Scenario: Step 2b mantiene opt-in para paquetes con commits de ruta
- **WHEN** el wizard procesa un paquete con `isExtraOnly = false` y commits de ruta seleccionados
- **THEN** el `commitMultiSelect` de step 2b se muestra sin ningún commit pre-seleccionado (igual que antes)

### Requirement: Headless mode incluye extraCommits para paquetes extra-only
Cuando el wizard corre en modo headless (`--yes` o `--bump` definido), los paquetes `isExtraOnly` SHALL incluir todos sus `extraCommits` como `chosenCommits`, en lugar de usar `pkgInfo.commits` (que es siempre vacío para estos paquetes).

#### Scenario: Headless mode usa extraCommits para isExtraOnly
- **WHEN** el wizard corre con `yes = true` (o `globalBump` definido) y procesa un paquete `isExtraOnly`
- **THEN** `chosenCommits` es igual a `pkgInfo.extraCommits` (todos los commits globales del repo desde el último tag)

#### Scenario: Headless mode mantiene comportamiento para paquetes normales
- **WHEN** el wizard corre con `yes = true` y procesa un paquete con `isExtraOnly = false`
- **THEN** `chosenCommits` es igual a `pkgInfo.commits` (igual que antes — sin cambios)

#### Scenario: CHANGELOG refleja commits globales en release headless de isExtraOnly
- **WHEN** se completa una release headless de un paquete `isExtraOnly` con N extraCommits
- **THEN** el CHANGELOG del paquete incluye las N entradas de commits globales seleccionados
