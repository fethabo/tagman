# prerelease-channel-placeholder

El paso 3a del wizard comunica el tipo de bump pre-release con un placeholder de canal genérico, sin sugerir un canal concreto (issue #56).

## ADDED Requirements

### Requirement: Step 3a labels use channel placeholder
Las opciones `prepatch`, `preminor` y `premajor` del paso 3a SHALL mostrar la versión de ejemplo con el placeholder `{channel}` en lugar de un canal concreto. Ninguna label del paso 3a SHALL contener el literal "alpha" como canal de ejemplo.

#### Scenario: Labels con placeholder
- **WHEN** el package está en versión `1.2.3` y el usuario entra al paso 3a (nueva pre-release)
- **THEN** las opciones muestran versiones de ejemplo `1.2.4-{channel}.0`, `1.3.0-{channel}.0` y `2.0.0-{channel}.0`

#### Scenario: Versión actual ya es pre-release alpha
- **WHEN** el package está en versión `1.2.3-alpha.4` y el usuario entra al paso 3a
- **THEN** las versiones de ejemplo usan `{channel}` correctamente (ej. `1.2.4-{channel}.0`) sin sustituciones accidentales sobre el "alpha" de la versión actual

### Requirement: Step 3a indicates channel is chosen next
El prompt del paso 3a SHALL indicar al usuario (vía hint/mensaje localizado en es/en) que el canal de pre-release se selecciona en el paso siguiente (3b).

#### Scenario: Hint visible en ambos idiomas
- **WHEN** el usuario llega al paso 3a con locale `es` o `en`
- **THEN** se muestra un texto localizado indicando que el canal se elegirá en el siguiente paso

### Requirement: Bump semantics unchanged
El valor seleccionado en el paso 3a (`prepatch` | `preminor` | `premajor`) y el cálculo posterior de la versión con el canal real del paso 3b SHALL permanecer sin cambios.

#### Scenario: Flujo completo de pre-release
- **WHEN** el usuario elige `preminor` en 3a y canal `rc` en 3b sobre la versión `1.2.3`
- **THEN** la nueva versión calculada es `1.3.0-rc.0`, igual que antes del cambio
