# github-release-flow Specification

## Purpose
TBD - created by archiving change fix-github-release-crash. Update Purpose after archive.
## Requirements
### Requirement: El flujo de GitHub Release nunca termina el proceso sin mensaje
Toda ruta de entrada al flujo de GitHub Release (menú principal y subcomando `tagman github-release`) SHALL capturar cualquier excepción no controlada, mostrar el error mediante la UI de clack (`p.log.error` + `p.outro`) y terminar de forma controlada. El proceso MUST NOT morir con un stack trace de unhandled rejection.

#### Scenario: Excepción durante el flujo iniciado desde el menú principal
- **WHEN** el usuario entra por el menú principal a "GitHub release desde tag existente" y ocurre una excepción no controlada (por ejemplo, un error de red durante el polling OAuth)
- **THEN** el programa muestra el mensaje de error localizado y un outro de despedida, y termina sin stack trace

#### Scenario: Excepción durante el flujo release iniciado desde el menú principal
- **WHEN** el usuario entra por el menú principal a "Crear release" y ocurre una excepción no controlada fuera del try/catch interno del wizard
- **THEN** el programa muestra el mensaje de error localizado y termina de forma controlada

### Requirement: El fallo del login interactivo se reporta al usuario
`interactiveGithubLogin()` SHALL mostrar un mensaje de error localizado (con la causa del fallo) cuando el device flow de OAuth falla, antes de devolver `null`. El fallo MUST NOT ser silencioso.

#### Scenario: Error de red durante el device flow
- **WHEN** el polling del device flow lanza un error (red caída, rate limit, timeout)
- **THEN** se muestra un `p.log.error` con el mensaje de la causa y la función devuelve `null`

### Requirement: Abortar por falta de token es explícito
Cuando el flujo de GitHub Release no puede continuar por falta de token (el usuario rechazó el login o el login falló), el flujo SHALL informar con un mensaje localizado que se cancela por falta de token antes de retornar.

#### Scenario: Usuario rechaza el login interactivo
- **WHEN** no hay token resuelto y el usuario responde "No" al prompt de login por navegador
- **THEN** se muestra un mensaje indicando que el flujo no puede continuar sin token y el flujo termina de forma controlada

#### Scenario: Login interactivo devuelve null
- **WHEN** no hay token resuelto, el usuario acepta el login y `interactiveGithubLogin()` devuelve `null`
- **THEN** además del error del login, se muestra el mensaje de cancelación por falta de token y el flujo termina de forma controlada

