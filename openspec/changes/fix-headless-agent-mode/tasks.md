# Tasks

## 1. Tipos y script typecheck (problema 3)

- [x] 1.1 En `src/commands/github-release.ts`, mover las comparaciones `=== SELECT_BACK` (líneas ~103 y ~139) antes de `p.isCancel()` (design D7). Verificar que `npx tsc --noEmit` no reporte errores en ese archivo.
- [x] 1.2 Agregar `"typecheck": "tsc --noEmit"` a `package.json`. Verificar que `pnpm typecheck` termine con código 0; si aparecen errores preexistentes en otros archivos, corregirlos o listarlos en el PR.

## 2. --lang global (problema 2)

- [x] 2.1 Declarar `--lang` solo en el programa raíz de `src/index.ts`, aplicarlo con un hook `preAction` que use `optsWithGlobals()` y quitar la opción y el `setLocale` de `wizardCommand` y `githubReleaseCommand` (design D6). Verificar con `pnpm dev --lang en release --dry-run` y `pnpm dev release --lang en --dry-run`: ambos deben mostrar la UI en inglés.
- [x] 2.2 Verificar que `pnpm dev --lang en github-release` muestra la UI en inglés, que `pnpm dev --lang fr release --dry-run` cae a español y que `pnpm dev --help` lista `--lang`.
- [x] 2.3 Actualizar la sección "Global flag" de la CLI Reference en `CLAUDE.md` y en el README para indicar que `--lang` va antes o después del subcomando. Verificar releyendo la sección.

## 3. Modo de ejecución, prompts con guard y salida

- [x] 3.1 Crear `src/ui/mode.ts` con `RunMode`, `setRunMode()` y `getRunMode()`, y `HeadlessError` (`reason`, `exitCode`, `extra?`) con la unión de `reason` de `specs/json-output` (design D1, D4). Verificar con `pnpm typecheck`.
- [x] 3.2 Crear `src/ui/prompts.ts` con `assertInteractive(promptId)` y re-exports con guard de `confirm`, `select`, `multiselect` y `text` (design D2). Agregar claves i18n para el mensaje de `interaction-required` en `types.ts`, `en.ts` y `es.ts`. Verificar con un test unitario: en modo no interactivo, cada wrapper lanza `HeadlessError` con `exitCode: 2`.
- [x] 3.3 Llamar a `assertInteractive` al inicio de `wizardSelect`, `commitMultiSelect`, `showScanSummaryPrompt` y `showDraftResumePrompt`. Verificar con el mismo test que cada uno lanza en modo no interactivo.
- [x] 3.4 Reemplazar en todo `src/` los usos directos de `p.confirm/select/multiselect/text` por los de `src/ui/prompts.ts`. Verificar con `grep -rnE "p\.(confirm|select|multiselect|text)\(" src` (solo debe aparecer `src/ui/`) y `pnpm typecheck`.
- [x] 3.5 Agregar el test de arquitectura `src/ui/prompts.test.ts` (design D2). Verificar que pasa con `pnpm test` y que falla al agregar temporalmente un `p.confirm(` en un step.
- [x] 3.6 Crear `runCommand(fn)` en `src/ui/` (design D4): emite el JSON de éxito o fallo, aplica `process.exitCode` y traduce errores genéricos a `reason: "error"`. Usarlo en las `action` de `release`, `github-release` y el menú raíz. Verificar con un test unitario que un `HeadlessError("dirty-tree", 1)` produce el documento de fallo y `exitCode` 1, y un `Error` genérico produce `reason: "error"`.
- [x] 3.7 Inicializar `setRunMode({ interactive: !yes && process.stdin.isTTY === true, json })` en cada `action`. Verificar que `pnpm dev release < /dev/null` (sin `--yes`) termina con código 2 y un mensaje claro en lugar de salir en silencio.

## 4. Resoluciones headless de --yes (problema 1)

- [x] 4.1 `checkpoint.ts`: agregar los flags `--allow-dirty` y `--allow-behind` a `wizardCommand` y `WizardOptions`, y resolver con `--yes` el working tree sucio, la rama atrasada (con prioridad de `requireRemoteSync`) y el checkpoint pendiente según la tabla de design D3. Agregar las claves i18n. Verificar con tests unitarios de una función pura de resolución de compuertas que cubra cada escenario de `specs/headless-release` sobre compuertas.
- [x] 4.2 `scan-and-select.ts`: con `--yes`, fallar con `packages-required` (incluyendo `candidates`) cuando falta `--packages`, y con `package-not-found` cuando no hay coincidencias. Verificar ejecutando `pnpm dev release --yes` en este repo: termina con código 1 y lista los candidatos.
- [x] 4.3 Extraer `defaultBumpFor(pkgInfo, suggested)` con el `initialValue` actual del prompt de bump, usarlo tanto en modo interactivo como headless y aplicarlo con `--yes` sin `--bump`. Verificar con tests unitarios: un `feat:` sobre `1.2.3` da `1.3.0`, `2.0.0-rc.1` con commits da `2.0.0-rc.2` y un candidato a graduación da `graduate`.
- [x] 4.4 Conflicto de graduación con el remoto: con `--yes`, subir a la siguiente patch sin preguntar. Verificar revisando el código y con un escenario manual, o con un test si `getLatestRemoteStableVersion` se puede inyectar.
- [x] 4.5 `tag-messages.ts`: con modo no interactivo, retornar `true` dejando el `tagMessage` autogenerado y, si `bump === "graduate"`, usar `buildGraduationMessage`. Quitar el salteo por `dryRun` en `wizard/index.ts` solo si sigue siendo necesario. Verificar con un test unitario que `promptTagMessages` en modo no interactivo no lanza y deja cada `tagMessage` no vacío.
- [x] 4.6 `execute.ts`: con `--yes`, `doPush = push` sin preguntar; retornar el resultado de éxito en lugar de `console.log` y que lo emita `runCommand`. Verificar con `--yes` sin `--push` (no hay push ni pregunta) y con `--yes --push` (push sin pregunta).
- [x] 4.7 `wizard/index.ts`: con `--yes`, "nada para liberar" retorna `no-commits` sin el menú alternativo. Verificar con `pnpm dev release --packages <pkg-sin-cambios> --yes --json`: código 0 y `reason: "no-commits"`.

## 5. Salida --json limpia

- [x] 5.1 Con `--json`, guardar el `write` original de stdout, redirigir `process.stdout.write` a stderr y omitir `console.clear()` (design D5). Emitir el documento final con el `write` guardado. Verificar con `pnpm dev release --packages X --bump patch --yes --dry-run --json 2>/dev/null | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"`: debe terminar sin error.
- [x] 5.2 Confirmar que `pnpm publish` (proceso hijo) y `git` siguen mostrando su salida y que no rompen el JSON. Verificar revisando el `stdio` de `src/integrations/npm.ts` o con una corrida con `npm.publish` habilitado en un repo de prueba.
- [x] 5.3 Documentar en `CLAUDE.md` y en el README la forma del JSON de éxito y de fallo, los valores de `reason` y los códigos de salida 0/1/2. Verificar que los ejemplos coinciden con `specs/json-output`.

## 6. Documentación de --yes

- [x] 6.1 Actualizar la CLI Reference de `CLAUDE.md` y del README con `--allow-dirty`, `--allow-behind`, la regla "`--yes` acepta la opción preseleccionada", las compuertas de seguridad y un ejemplo de invocación para agentes y CI. Verificar que la tabla de flags coincide con `pnpm dev release --help`.

## 7. Verificación de punta a punta

- [x] 7.1 En un monorepo pnpm de prueba, correr `tagman release --packages pkg-a --bump minor --yes --json < /dev/null > out.json`. Verificar: código 0, `out.json` parseable con `success: true`, versión, CHANGELOG, commit y tag creados, y ningún push.
- [x] 7.2 En el mismo repo, verificar los fallos headless: working tree sucio (código 1, `dirty-tree`), checkpoint presente (código 1, `pending-checkpoint`, repo intacto) y sin `--packages` (código 1, `packages-required` con `candidates`).
- [ ] 7.3 Verificar que el flujo interactivo completo (`pnpm dev`, sin flags) sigue igual: prompts de tag, push y bump con sus defaults, y back navigation.
- [x] 7.4 Correr `pnpm typecheck`, `pnpm test` y `pnpm build`. Verificar que los tres terminan en verde.

## Workflow follow-up

- Abrir el PR referenciando `fethabo/tagman#71` para cerrarlo al mergear.
- Mencionar en el CHANGELOG/PR el cambio de comportamiento de `--yes`: ya no pregunta por tag ni push, y falla con un working tree sucio.
- Archivar el change con `/opsx:archive` una vez mergeado.
