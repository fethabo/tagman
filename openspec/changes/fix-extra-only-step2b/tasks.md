## 1. Fix headless mode para isExtraOnly

- [x] 1.1 En `src/commands/wizard/steps/scan-and-select.ts` línea ~170, agregar una rama específica para paquetes `isExtraOnly` antes del shortcut `if (globalBump !== undefined || yes)`: cuando `isExtraOnly = true` y se está en headless mode, asignar `chosenCommits = pkgInfo.extraCommits` en lugar de `pkgInfo.commits`

## 2. Fix step 2b initialValues para isExtraOnly

- [x] 2.1 En `src/commands/wizard/steps/scan-and-select.ts` línea ~303, cambiar `initialValues` del `commitMultiSelect` de step 2b: usar `pkgInfo.isExtraOnly ? pkgInfo.extraCommits.map(c => c.hash) : []` para que paquetes `isExtraOnly` arranquen con todos los commits pre-seleccionados

## 3. Verificación

- [x] 3.1 Verificar compilación TypeScript sin errores (`npx tsc --noEmit`)
- [ ] 3.2 Verificar fix 1: en modo headless (`pnpm dev release --packages <extraOnlyPkg> --bump patch --yes`), confirmar que la release incluye los commits globales en el CHANGELOG y tag message
- [ ] 3.3 Verificar fix 2: en modo interactivo, seleccionar un paquete `isExtraOnly` y confirmar que step 2b muestra los commits extra pre-seleccionados
- [ ] 3.4 Verificar no-regresión: paquetes con commits de ruta propios siguen mostrando step 2b con `initialValues` vacío
