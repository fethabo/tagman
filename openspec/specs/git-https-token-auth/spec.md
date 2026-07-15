# git-https-token-auth

## Purpose

Permite a tagman autenticar operaciones git sobre HTTPS reutilizando el token de GitHub ya empleado para crear GitHub Releases, inyectándolo de forma efímera y sin persistirlo, y aplicando una política de autenticación asimétrica entre operaciones de lectura (fetch) y de escritura (push).

## Requirements

### Requirement: Autenticación de git HTTPS reutilizando el token de GitHub
Cuando el remoto está configurado por HTTPS sobre GitHub, tagman SHALL poder autenticar operaciones git usando el token de GitHub obtenido por `resolveGithubToken()` o por el login interactivo device-flow (`interactiveGithubLogin()`), el mismo mecanismo ya usado para crear GitHub Releases.

#### Scenario: Token de entorno usado para autenticar
- **WHEN** el remoto es HTTPS+GitHub y existe un token resuelto desde `GITHUB_TOKEN` o `~/.npmrc`
- **THEN** la operación git HTTPS se autentica con ese token sin pedir credenciales al usuario

### Requirement: Inyección efímera del token
El token usado para autenticar git HTTPS SHALL inyectarse de forma efímera en el subproceso git y NO SHALL persistirse en `.git/config`, en la URL del remoto, ni en ningún archivo en disco.

#### Scenario: El token no se persiste
- **WHEN** tagman autentica una operación git HTTPS con un token
- **THEN** tras la operación, `.git/config` y la URL del remoto no contienen el token

#### Scenario: El token no se expone en mensajes
- **WHEN** una operación git autenticada por token falla y se muestra un error al usuario
- **THEN** el mensaje de error no contiene el valor del token

### Requirement: Política de autenticación asimétrica lectura/escritura
tagman SHALL aplicar el token a operaciones de lectura (fetch de sincronización) sólo si ya está disponible sin interacción, y SHALL ofrecer el login interactivo únicamente para operaciones de escritura (push) que lo requieran.

#### Scenario: Lectura no fuerza login
- **WHEN** se ejecuta el chequeo de sincronización, el remoto es HTTPS y no hay token disponible sin interacción
- **THEN** tagman NO inicia un login device-flow; el chequeo degrada a "no verificado" y el flujo continúa

#### Scenario: Escritura ofrece login
- **WHEN** el usuario elige pushear, el remoto es HTTPS+GitHub y no hay credencial disponible (o el push falla por autenticación)
- **THEN** tagman ofrece el login interactivo device-flow y, tras autenticar, reintenta el push con el token

#### Scenario: Remoto no-GitHub no dispara login
- **WHEN** el remoto es HTTPS pero no es GitHub
- **THEN** tagman no intenta el login device-flow ni la inyección de token; delega en el credential helper del sistema y, si no hay, degrada sin colgar (Capa 1)
