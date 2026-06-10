# Proposal — fix-scan-and-wizard-issues

Resuelve los issues #56, #57, #58 y #62 del repositorio.

## Why

Cuatro bugs reportados degradan la confiabilidad y la UX del wizard de release:

1. **#62 (crítico) — El escaneo re-lista commits ya publicados.** `getLastTagForPackage()` (`src/git/index.ts:24`) ordena los tags con `git tag --sort=-v:refname`. El version-sort de git **no entiende sufijos de pre-release** (sin `versionsort.suffix` configurado, `pkg@1.2.0-beta.3` ordena *por encima* de `pkg@1.2.0`). Verificado empíricamente: con los tags `pkg@1.1.0`, `pkg@1.2.0` y `pkg@1.2.0-beta.3`, git devuelve `pkg@1.2.0-beta.3` primero. Resultado: tras graduar una pre-release a estable ("se tageó en la rama, se promovió a prod"), el siguiente escaneo toma como baseline el tag pre-release viejo, y `beta..HEAD` re-lista todos los commits ya incluidos en el changelog del estable — con los mismos hashes, exactamente lo que muestran los screenshots del issue. La eliminación de ramas era una pista falsa; el patrón real es "existe un tag pre-release junto a un tag estable igual o mayor para el mismo package".

2. **#58 — Dependientes en cascada sin commits propios pierden el pseudo-commit "cascade".** Cuando un dependiente que era candidato *extra-only* recibe el pseudo-commit `cascade` (`scan-and-select.ts:628`), el paso 2 de selección de commits se saltea porque `isExtraOnly` es true (`scan-and-select.ts:232`): el commit cascade nunca se muestra, y además no se incluye en `chosenCommits` (que solo junta `selectedPathCommits + chosenExtraCommits`), por lo que el changelog/tag del dependiente no documenta la actualización de dependencia.

3. **#57 — Las referencias `#num` en el comentario del tag no apuntan a `/issues`.** `formatCommitList()` (`src/core/updater.ts:132`) deja `#123` como texto plano confiando en el autolink de GitHub, pero ese autolink no aplica en anotaciones de tag ni en archivos markdown (CHANGELOG.md): la referencia queda muerta.

4. **#56 — El paso 3a sugiere que el canal será "alpha".** Las labels de prepatch/preminor/premajor (`scan-and-select.ts:449-451`) calculan la versión de ejemplo con `semver.inc(currentVersion, ..., "alpha")` hardcodeado, dando a entender que se usará el canal "alpha" cuando en realidad el canal se elige en el paso 3b.

## What Changes

- **Fix #62 (parte 1)**: `getLastTagForPackage()`, `getLastStableTagForPackage()` y `getLatestRemoteStableVersion()` dejan de confiar en el orden de `--sort=-v:refname` y ordenan/seleccionan por **semver real en JS** (`semver.rcompare` sobre la versión extraída del tag, descartando tags cuya versión no parsea).
- **Fix #62 (parte 2, post-validación en repo real)**: el escaneo deja de usar un rango `lastTag..HEAD` y pasa a **exclusión multi-tag**: un commit es candidato solo si no es alcanzable desde ningún tag `name@*` del package (`git log HEAD ^tag1 ^tag2 … -- path`). Esto cubre canales de pre-release paralelos en ramas distintas, donde ningún baseline de tag único es correcto (ver D1b en design.md).
- **Fix #58**: un candidato `isExtraOnly` que recibe el pseudo-commit `cascade` deja de tratarse como extra-only (el flag se limpia al insertar el commit), de modo que el paso 2 siempre se muestra con la opción "cascade" seleccionable, igual que en dependientes con commits propios.
- **Fix #57**: `formatCommitList()` convierte las referencias a issues en links markdown completos cuando hay `baseUrl`: `#123` → `[#123](baseUrl/issues/123)` y `owner/repo#456` → `[owner/repo#456](https://github.com/owner/repo/issues/456)`. Aplica tanto al mensaje del tag como al CHANGELOG (ambos consumen `formatCommitList`). Sin `baseUrl`, la referencia queda como texto plano (se elimina el fallback roto `([#123](#123))`).
- **Fix #56**: las labels del paso 3a muestran un placeholder de canal (ej.: `1.3.0-{channel}.0`) en lugar de una versión calculada con "alpha", y el prompt indica que el canal se elige en el paso siguiente.

## Capabilities

### New Capabilities

- `semver-tag-baseline`: resolución del último tag de un package por orden semver real (no orden de git), garantizando que el escaneo de commits parta del tag de mayor versión y no re-liste commits ya publicados.
- `cascade-commit-visibility`: el pseudo-commit "cascade" de dependientes siempre es visible y seleccionable en el paso 2, incluso para packages sin commits propios de ruta.
- `issue-ref-links`: las referencias a issues en mensajes de tag y CHANGELOG se emiten como links markdown completos al issue tracker del repo.
- `prerelease-channel-placeholder`: el paso 3a comunica el tipo de bump pre-release con un placeholder de canal genérico, sin sugerir un canal concreto.

### Modified Capabilities

_(ninguna — `openspec/specs/` no tiene specs existentes; `extra-only-release` del change `fix-extra-only-step2b` no cambia sus requisitos, aunque el fix de #58 toca el mismo flujo)_

## Impact

- `src/git/index.ts` — `getLastTagForPackage`, `getLastStableTagForPackage`, `getLatestRemoteStableVersion` (helper común de ordenamiento semver de tags).
- `src/commands/wizard/steps/scan-and-select.ts` — paso 3a (labels líneas 449-451), inserción cascade (líneas 616-630).
- `src/core/updater.ts` — `formatCommitList()` (transformación de referencias, líneas 130-134).
- `src/i18n/types.ts`, `src/i18n/es.ts`, `src/i18n/en.ts` — ajuste de strings del paso 3a si el placeholder requiere nueva key/hint.
- Sin cambios de configuración ni breaking changes; el formato `name@version` de tags se mantiene.
