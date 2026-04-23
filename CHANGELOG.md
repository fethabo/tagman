
## [1.0.0] - 2026-03-19
- 7241691 Merge branch 'main' of github.com:fethabo/tagman
- d30792c feat: implementado tagman base funcionando con pnpm workspaces
- 51cf949 Initial commit

## [1.0.1] - 2026-03-19
- 9d34c08 Agregado soporte para monopackage en pnpm. fix: arreglado custom version en seleccion de version. agregado only tag.

## [1.0.2] - 2026-03-19
- 73ec789 Actualizada informacion de package para NPM
- d9f0ebe agregado datos de repositorio de git en package
- 919b801 Actualizada info de package.json para publicar en npm. Actualizado readme
- d129948 update gitignore
- 18e92c2 update gitignore

## [1.0.3] (2026-03-20)

* **fix:** cambiado formato tambien en wizard. [@fethabo] ([65aa654])
* **fix:** corregido formato de comentario de tags [@fethabo] ([9c7995d])

[1.0.3]: https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.0.2...@fethabo/tagman@1.0.3
[65aa654]: https://github.com/fethabo/tagman/commit/65aa6546f1bf22f8b9932c228ea5632c15c72c13
[@fethabo]: https://github.com/fethabo
[9c7995d]: https://github.com/fethabo/tagman/commit/9c7995d0fc0cb026ea25a10ef500538a16e88f59

## [1.0.4](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.0.3...@fethabo/tagman@1.0.4) (2026-03-20)

* **fix:** quitadas refrencias, colocado href inline [@fethabo](https://github.com/fethabo) ([4aca4d1](https://github.com/fethabo/tagman/commit/4aca4d11dffd3194193e237c20329d7675b2aeec))
* **chore:** removidos archivos logs de seguimiento, update gitignore [@fethabo](https://github.com/fethabo) ([d9f4f82](https://github.com/fethabo/tagman/commit/d9f4f82ec06dad07838598e6cde5af4c2f236db9))

## [1.1.0](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.0.4...@fethabo/tagman@1.1.0) (2026-03-25)

* **doc:**update roadmap [@fethabo](https://github.com/fethabo) ([8813530](https://github.com/fethabo/tagman/commit/881353077cb7dbcd0d1226f953c5dad9c605464c))
* **fix:** corregidos select/deselect. ref ([#2](https://github.com/fethabo/tagman/issues/2)). actualizado readme [@fethabo](https://github.com/fethabo) ([1815902](https://github.com/fethabo/tagman/commit/1815902cc97f51bfc1c69603de38328ac1be0b42))
* **refactor:** use required:true and remove redundant empty-check per review [@copilot-swe-agent[bot]](https://github.com/copilot-swe-agent[bot]) ([3359b63](https://github.com/fethabo/tagman/commit/3359b6344108295752980cf4dd58c5e218941b3f))
* **feat:** add Select All / Deselect All to step 2 commit selector [@copilot-swe-agent[bot]](https://github.com/copilot-swe-agent[bot]) ([8ce0136](https://github.com/fethabo/tagman/commit/8ce013635b4cf41a35a5e967a6047bd8b999e508))

## [1.2.0](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.1.0...@fethabo/tagman@1.2.0) (2026-04-09)

* **fix:** agregada dependencia de @clack/core @fethabo 8d2bfa0
* **feat:** implementar P0 bugfixes y Phase 4 agentic optimization @fethabo a320024
* **refactor:** se separa wizard en multiples archivos. closes #5 @fethabo c261bee
* **feat:** agregado soporte para archivo de configuracion. ref #1 @fethabo aa4554c

## [1.2.1](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.2.0...@fethabo/tagman@1.2.1) (2026-04-13)

* **feat:** implement GitHub releases, NPM publishing, plugin system, and i18n @fethabo e36cbe2

## [1.2.2](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.2.1...@fethabo/tagman@1.2.2) (2026-04-14)

* **fix:** agregado go back a packages @fethabo 6be6ed5
* **fix:** agregado faltante de un go back en el wizard. closes #8 @fethabo 66e8449
* update readme @fethabo 4f3c6b8
* Agregada dependencia faltante en el lock file @fethabo 0ec8b02

## [1.3.0-alpha.0](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.2.2...@fethabo/tagman@1.3.0-alpha.0) (2026-04-14)

* fix comments @fethabo 5d98812
* **feat:** agregado menu inicial, fix: corregido back en steps de wizard @fethabo 3c8b23f
* **refactor:** cambiadas opciones de menu por comandos para navegacion y visualizacion de info de commits. agregada posibilidad de seleccionar commits externos al package selecionado (cross-package-commits refs #7) @fethabo cbd3772

## [1.3.0-alpha.1](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0-alpha.0...@fethabo/tagman@1.3.0-alpha.1) (2026-04-14)

* **feat:** agregado soporte para prereleases. fix: corregido backs en algunos steps. update texts @fethabo 0470fab

## [1.3.0-alpha.2](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0-alpha.1...@fethabo/tagman@1.3.0-alpha.2) (2026-04-14)

* **fix:** corregido texto del menu @fethabo a7ee300

## [1.3.0-alpha.3](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0-alpha.2...@fethabo/tagman@1.3.0-alpha.3) (2026-04-15)

* agregado get de nombre de branch por defecto para los prereleases @fethabo 210c2c3

## [1.3.0-alpha.4](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0-alpha.3...@fethabo/tagman@1.3.0-alpha.4) (2026-04-15)

* **docs:** update readme @fethabo 18d440c
* **feat:** agregada verificacion de cambios remota. feat: agregada vinculación del tag directamente con el ultimo commit seleccionado. De esta forma pueden realizarse tags sobre commits viejos, garantizando que el snapshot de código de ese tag sea el codigo del último commit seleccionado (cronológicamente) @fethabo c3810e1

## [1.3.0-alpha.5](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0-alpha.4...@fethabo/tagman@1.3.0-alpha.5) (2026-04-15)

* **feat:** agregada posibilidad de manejar tags cuando no hay commits disponibles @fethabo fbf6db3

## [1.3.0-alpha.6](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0-alpha.5...@fethabo/tagman@1.3.0-alpha.6) (2026-04-15)

* **fix:** corregidos errores que impedian el build @fethabo 3218893
* **docs:** update readme @fethabo 92a9791
* **feat:** agregada graduacion de prerelease-tag en flujo de seleccion de commits si no se selecciona ninguno. En este caso se taguea la misma version de codigo del tag, cambiando el tag e insertando el commit de tag junto al anterior. @fethabo 30b8d2a

## [1.3.0](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0-alpha.6...@fethabo/tagman@1.3.0) (2026-04-15)

* **chore(release):** [@fethabo/tagman] @fethabo 06a0739
* **fix:** corregidos errores que impedian el build @fethabo 3218893
* **docs:** update readme @fethabo 92a9791
* **feat:** agregada graduacion de prerelease-tag en flujo de seleccion de commits si no se selecciona ninguno. En este caso se taguea la misma version de codigo del tag, cambiando el tag e insertando el commit de tag junto al anterior. @fethabo 30b8d2a
* **chore(release):** [@fethabo/tagman] @fethabo 2f4dc13
* **feat:** agregada posibilidad de manejar tags cuando no hay commits disponibles @fethabo fbf6db3
* **chore(release):** [@fethabo/tagman] @fethabo 9d73151
* **docs:** update readme @fethabo 18d440c
* **feat:** agregada verificacion de cambios remota. feat: agregada vinculación del tag directamente con el ultimo commit seleccionado. De esta forma pueden realizarse tags sobre commits viejos, garantizando que el snapshot de código de ese tag sea el codigo del último commit seleccionado (cronológicamente) @fethabo c3810e1
* **chore(release):** [@fethabo/tagman] @fethabo 75c0b75
* agregado get de nombre de branch por defecto para los prereleases @fethabo 210c2c3
* **chore(release):** [@fethabo/tagman] @fethabo d51b054
* **fix:** corregido texto del menu @fethabo a7ee300
* **chore(release):** [@fethabo/tagman] @fethabo 3e46d27
* **feat:** agregado soporte para prereleases. fix: corregido backs en algunos steps. update texts @fethabo 0470fab
* **chore(release):** [@fethabo/tagman] @fethabo ee8acc5
* fix comments @fethabo 5d98812
* **feat:** agregado menu inicial, fix: corregido back en steps de wizard @fethabo 3c8b23f
* **refactor:** cambiadas opciones de menu por comandos para navegacion y visualizacion de info de commits. agregada posibilidad de seleccionar commits externos al package selecionado (cross-package-commits refs #7) @fethabo cbd3772

## [1.3.1](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.0...@fethabo/tagman@1.3.1) (2026-04-15)

* **  feat:** mejoras y correcciones de issues #9 al #14 574a628

## [1.3.2](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.1...@fethabo/tagman@1.3.2) (2026-04-20)

* **fix:** agregada verificacion de tags remotos al graduar a estable un canal. closes #16 a09d6f1
* **docs:** update readme b3b5a15

## [1.3.3](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.2...@fethabo/tagman@1.3.3) (2026-04-20)

* **fix:** agregado back en step 2b 083ed1b

## [1.3.4](https://github.com/fethabo/tagman/compare/@fethabo/tagman@1.3.3...@fethabo/tagman@1.3.4) (2026-04-23)

* **fix:** agregado detalle de commits en resumen de borrador. ref #27 49ddbe7
* **fix:** agregada info del borrador cargado. closes #27 cbf2c7a
* **feat:** guardado de borrador post-scan y cierre de issues #24 #25 #26 18759c7
* ** fix:** restore auto-generated tag messages on back navigation; block tagless proceed 9b77a0c
* **feat:** resolución de issues #17, #19, #20, #21, #22, #23, #25 a10e18d
