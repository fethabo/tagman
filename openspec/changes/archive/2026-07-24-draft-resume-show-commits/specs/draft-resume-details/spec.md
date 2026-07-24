## ADDED Requirements

### Requirement: Toggle de commits en el prompt de retoma de borrador
El prompt de retoma de borrador SHALL soportar la tecla `d` para alternar la visibilidad del listado de commits de cada paquete incluido en el borrador. El estado inicial del toggle SHALL ser "oculto" (`showDetails = false`).

#### Scenario: Toggle inicial oculto
- **WHEN** el usuario abre el prompt de retoma de borrador
- **THEN** el prompt muestra solo las líneas de resumen por paquete (`nombre: vOld → vNew  (N commits)`) sin los mensajes individuales de commits

#### Scenario: Toggle muestra commits al presionar 'd'
- **WHEN** el usuario presiona la tecla `d` con el prompt de retoma visible
- **THEN** el prompt refresca su contenido mostrando bajo cada paquete sus commits en el formato `  <hash7> <mensaje>`, uno por línea

#### Scenario: Toggle oculta commits al presionar 'd' nuevamente
- **WHEN** los commits ya están visibles y el usuario presiona `d` de nuevo
- **THEN** el prompt refresca su contenido volviendo a mostrar solo las líneas de resumen sin commits

#### Scenario: El toggle no afecta las opciones de acción
- **WHEN** el usuario alterna la visibilidad de commits con `d`
- **THEN** las opciones "Retomar borrador" y "Descartar y empezar de nuevo" siguen visibles y funcionales

### Requirement: Hint de tecla 'd' en el prompt de retoma
El prompt de retoma de borrador SHALL mostrar en su barra de hints la tecla `[d]` con una etiqueta que indique la acción de ver/ocultar commits, de modo consistente con el resto de hints del wizard.

#### Scenario: Hint visible cuando commits están ocultos
- **WHEN** `showDetails = false`
- **THEN** la barra de hints incluye `[d] ver commits`

#### Scenario: Hint visible cuando commits están visibles
- **WHEN** `showDetails = true`
- **THEN** la barra de hints incluye `[d] ocultar commits`

### Requirement: Formato de commits en la vista de detalle
Cuando el toggle está activo, cada paquete en el prompt SHALL mostrar sus commits con hash truncado a 7 caracteres y el mensaje del commit, indentados bajo la línea de resumen del paquete.

#### Scenario: Formato de línea de commit
- **WHEN** `showDetails = true` y el paquete tiene commits seleccionados
- **THEN** cada commit se muestra como `    <7-char-hash> <commit-message>` en una línea separada bajo el resumen del paquete

#### Scenario: Paquetes con cero commits (extra-only)
- **WHEN** `showDetails = true` y un paquete en el borrador tiene `commits.length === 0`
- **THEN** no se muestran líneas de commit para ese paquete (solo la línea de resumen)
