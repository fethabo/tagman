## Context

Los paquetes `isExtraOnly` (`src/commands/wizard/steps/scan-and-select.ts`) son paquetes con cero commits de ruta propios (`commits: []`) pero con commits globales de repo (`extraCommits: [...]`). Fueron implementados para issue #26 y permiten hacer una release de un paquete "sin cambios propios" incluyendo commits de repo que el usuario quiere asociar.

**Estado actual con bugs:**

**Bug 1 (headless)** — Línea 170:
```typescript
if (globalBump !== undefined || yes) {
  chosenCommits = pkgInfo.commits; // Para isExtraOnly: siempre []
}
```
Para paquetes `isExtraOnly`, `pkgInfo.commits = []` siempre. Este shortcut ignora `extraCommits`. En headless mode, el resultado es una release con `chosenCommits = []`: sin CHANGELOG entries y sin commits en el tag message.

**Bug 2 (interactive step 2b)** — Línea 303:
```typescript
[],  // initialValues — vacío para todos los paquetes
```
Para paquetes `isExtraOnly`, el step 2b (extra commits) arranca sin ningún commit seleccionado. El usuario que presiona Enter sin seleccionar queda con `chosenCommits = []`. Dado que el paquete apareció en el wizard SOLO porque tiene `extraCommits`, el comportamiento esperado es que esos commits estén pre-seleccionados (el usuario puede deseleccionar los que no quiere, pero el default es "incluir todo").

Para paquetes con commits de ruta propios (`isExtraOnly = false`), step 2b sigue siendo opt-in (vacío), porque el usuario ya seleccionó sus commits principales en step 2.

## Goals / Non-Goals

**Goals:**
- Fix headless mode: para `isExtraOnly`, `chosenCommits` debe ser `pkgInfo.extraCommits` (o un subconjunto en modo interactivo)
- Fix interactive step 2b: para `isExtraOnly`, `initialValues` del commitMultiSelect debe ser todos los hashes de `extraCommits` (pre-seleccionado)
- No romper el comportamiento de paquetes no-`isExtraOnly`

**Non-Goals:**
- Permitir seleccionar commits anteriores al último tag (gap identificado en el proposal, out of scope)
- Cambiar el flujo de graduation candidates
- Cambiar step 2 (path commits) — solo afectamos el shortcut headless y el step 2b

## Decisions

### Decisión 1: Headless — ¿auto-seleccionar todos los extraCommits o mostrar error?

**Elegido: auto-seleccionar todos los `extraCommits`**

Para paquetes `isExtraOnly`, el usuario eligió incluirlos en la release (via `--packages`). La intención es incluir los commits globales. Auto-seleccionarlos es la extensión natural del comportamiento headless.

Alternativa descartada — error: Obligar al usuario a NO usar `isExtraOnly` en headless mode sería demasiado restrictivo.

### Decisión 2: Interactive — ¿pre-seleccionar todos o vacío?

**Elegido: pre-seleccionar todos los `extraCommits` para `isExtraOnly`**

Para paquetes `isExtraOnly`, todos sus commits son extra-commits (no hay commits propios). El usuario que seleccionó el paquete en step 1 quiere incluirlo en la release; el default debe ser "todos los commits relacionados incluidos." El usuario puede deseleccionar los que no quiere.

Para paquetes con path commits (`isExtraOnly = false`), step 2b sigue siendo opt-in (initialValues vacío) porque los commits extra son adicionales al conjunto ya seleccionado en step 2.

### Decisión 3: Minimal diff

Los dos bugs se corrigen con exactamente dos cambios de una línea en `scan-and-select.ts`:
1. Línea ~170-173: agregar rama para `isExtraOnly` antes del shortcut headless
2. Línea ~303: cambiar `initialValues` para que use `pkgInfo.isExtraOnly ? pkgInfo.extraCommits.map(c => c.hash) : []`

## Risks / Trade-offs

- [Trade-off] Pre-seleccionar todos los extraCommits para `isExtraOnly` podría incluir commits de otros paquetes que el usuario no quiere. Mitigación: el usuario puede deseleccionarlos en step 2b. El commit count en el hint de step 1 (que actualmente no muestra el count para `isExtraOnly`) podría hacerse más explícito.
- [Riesgo] En headless mode con `isExtraOnly`, la release puede incluir commits de otros paquetes. Esto es intencional — el usuario optó por incluirlos.
