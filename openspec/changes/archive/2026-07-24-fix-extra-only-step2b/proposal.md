## Why

El issue #26 introdujo los "extra-only candidates" (paquetes sin commits de ruta propios que pueden released gracias a commits globales del repo). Sin embargo, el flujo tiene dos bugs: en modo headless los commits globales son ignorados completamente, y en modo interactivo el paso 2b arranca sin ningún commit pre-seleccionado para paquetes `isExtraOnly`, lo que puede llevar a que el usuario pase por encima del paso sin seleccionar nada, obteniendo una release sin commits asociados. Además, si el commit global que el usuario necesita asociar a un paquete es anterior al último tag de ese paquete, el paquete directamente no aparece en la lista de candidatos y no hay forma de incluirlo.

## What Changes

- **Bug 1 — Headless mode**: En `scan-and-select.ts` línea 170, `if (globalBump !== undefined || yes)` asigna `chosenCommits = pkgInfo.commits`. Para paquetes `isExtraOnly`, `pkgInfo.commits = []`, por lo que `chosenCommits = []` — los `extraCommits` son completamente ignorados. Fix: para `isExtraOnly` en headless, auto-seleccionar todos los `extraCommits`.

- **Bug 2 — Interactive step 2b vacío**: El `commitMultiSelect` de step 2b para paquetes `isExtraOnly` usa `initialValues: []`. El usuario puede presionar Enter sin seleccionar nada y llegar directamente al step 3 (version bump), creyendo que el paso fue omitido. Fix: para `isExtraOnly`, los `extraCommits` se inicializan PRE-SELECCIONADOS (igual que los commits de ruta en el step 2 normal).

- **Gap — Paquetes sin commits detectables**: Si el commit global que el usuario necesita predates el último tag del paquete, `getRepoCommitsSince(lastTag)` no lo retorna y el paquete no aparece en `allCandidates`. No hay forma de incluirlo. Esta mejora queda fuera del scope por ahora (requiere diseño diferente).

## Capabilities

### New Capabilities

- `extra-only-release`: Requisitos corregidos para el flujo de release de paquetes `isExtraOnly` (sin commits de ruta pero con commits globales de repo): selección pre-poblada en step 2b, comportamiento correcto en headless mode.

### Modified Capabilities

_(ninguna — sin cambios en specs existentes)_

## Impact

- `src/commands/wizard/steps/scan-and-select.ts` — líneas 170-171 (headless branch) y línea 303 (initialValues del commitMultiSelect de step 2b)
- Sin cambios en i18n, tipos, ni otros archivos
