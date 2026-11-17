# Tasks

## 1. Reescritura de referencias

- [ ] 1.1 Agregar y exportar `rewriteDependencyRange(current, newVersion): string | null` en `src/core/updater.ts` según la tabla de design.md (decisión 1); verificar con `pnpm build` sin errores de tipos.
- [ ] 1.2 Crear `src/core/updater.test.ts` (`node:test`) con un caso por cada escenario de los requerimientos de reescritura de la spec: `workspace:*`, `workspace:^`, `workspace:~`, `workspace:^1.2.3`, `workspace:~1.2.3`, `workspace:1.2.3`, `^`, `~`, exacta, pre-release, `catalog:`, `npm:`, `file:`, `>=1.0.0 <2.0.0`, `1.x`, `*`, `latest`; verificar con `pnpm test` en verde.
- [ ] 1.3 Reescribir `updateConsumerDependencies` para usar el helper en `dependencies`, `devDependencies` y `peerDependencies` y llamar a `writeJson` solo si algún valor cambió; verificar con un test que use un directorio temporal: un consumidor con solo `workspace:*` queda byte a byte igual y uno con `~1.2.3` pasa a `~<nueva>`.

## 2. Rollback exacto

- [ ] 2.1 Reemplazar `rollbackConsumerDependencies` por `restoreConsumerDependencies(consumerDir, depName, originalManifest)` en `src/core/updater.ts`, que copia el valor original de cada campo donde existía; verificar con un test en directorio temporal: tras escribir `^1.3.0` sobre un original `^1.0.0`, el restore deja `^1.0.0`, y `workspace:*` sigue igual.
- [ ] 2.2 En `src/commands/wizard/steps/checkpoint.ts`, pasar `rbState.get(dep.manifest.name)!.pkg.manifest` al restore; verificar con `pnpm build` y revisando que no queden usos de `rollbackConsumerDependencies` (`grep -r rollbackConsumerDependencies src` vacío).

## 3. Verificación de punta a punta

- [ ] 3.1 En un monorepo pnpm 10 de prueba con dos paquetes privados enlazados por `workspace:*` y uno con `~x.y.z`, correr `pnpm dev release --packages <a>,<b> --bump patch --yes`; verificar que el commit de release no toca las referencias `workspace:*`, que la `~` conserva su operador y que `pnpm install` termina sin `ERR_PNPM_FETCH_404`.
- [ ] 3.2 En el mismo repo, interrumpir una release tras la fase `writing` (dejar el `.tagman-checkpoint.json`), elegir rollback al relanzar y verificar con `git diff` que los `package.json` vuelven exactamente a su estado previo.
- [ ] 3.3 Agregar entrada en `CHANGELOG.md` de la próxima release mencionando el fix de #70 y que el operador original de las referencias ahora se conserva; verificar que la entrada existe.

## Workflow follow-up

- Archivar el change con `/opsx:archive` una vez mergeado.
- Cerrar el issue #70 referenciándolo desde el PR.
