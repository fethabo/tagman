# remote-access-resilience

## Purpose

Garantiza que las operaciones git de red iniciadas por tagman nunca cuelguen indefinidamente y que el chequeo de sincronización con el remoto degrade de forma elegante, distinguiendo explícitamente entre un remoto "verificado" y uno "no verificado" en lugar de bloquear o asumir silenciosamente que el repositorio está sincronizado.

## Requirements

### Requirement: El acceso al remoto nunca cuelga indefinidamente
Toda operación git de red iniciada por tagman (fetch de sincronización, fetch de tags, push) SHALL tener un timeout efectivo y SHALL correr con los prompts interactivos de git deshabilitados, de modo que una falta de credenciales, un host desconocido o una red inalcanzable produzcan un fallo acotado en el tiempo en lugar de un spinner infinito.

#### Scenario: Fetch sobre HTTPS sin credenciales no cuelga
- **WHEN** el remoto está configurado por HTTPS y no hay credenciales disponibles (ni credential helper ni token)
- **THEN** la operación de red falla de forma inmediata (git no espera input de usuario/contraseña) y el flujo continúa sin quedar cargando

#### Scenario: Red inalcanzable expira por timeout
- **WHEN** el remoto es inalcanzable y la operación no produce output
- **THEN** el proceso git se termina al alcanzar el timeout configurado y la operación se resuelve como fallida, sin spinner infinito

#### Scenario: Primera conexión SSH a un host desconocido no cuelga
- **WHEN** el remoto es SSH y el host no está en `known_hosts`
- **THEN** la operación no queda esperando la confirmación interactiva de host-key; falla o continúa de forma acotada

### Requirement: Degradación elegante del chequeo de sincronización
El chequeo de sincronización con el remoto SHALL distinguir entre "verificado" y "no verificado", y SHALL tratar el estado "no verificado" como una advertencia no fatal que permite continuar el flujo, en lugar de bloquear o de asumir silenciosamente que el repositorio está sincronizado.

#### Scenario: Remoto verificado y al día
- **WHEN** el fetch de sincronización tiene éxito y la rama local no está detrás del upstream
- **THEN** el flujo continúa normalmente sin advertencias

#### Scenario: Remoto verificado y detrás
- **WHEN** el fetch de sincronización tiene éxito y la rama local está `N` commits detrás del upstream
- **THEN** se aplica el comportamiento de sincronización existente (bloquear si `requireRemoteSync`, o advertir y pedir confirmación en caso contrario)

#### Scenario: Remoto no verificable
- **WHEN** el fetch de sincronización falla por timeout, falta de credenciales, ausencia de remoto o error de red
- **THEN** se muestra una advertencia no fatal indicando que no se pudo verificar el estado del remoto y el flujo continúa (tratando el estado como no bloqueante)

#### Scenario: No se confunde "no verificado" con "sincronizado"
- **WHEN** el fetch de sincronización no se pudo completar
- **THEN** tagman NO reporta el repositorio como sincronizado de forma silenciosa; la condición de "no verificado" es explícita para el usuario
