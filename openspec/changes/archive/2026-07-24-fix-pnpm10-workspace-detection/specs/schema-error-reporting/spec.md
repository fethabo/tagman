## ADDED Requirements

### Requirement: Los errores de validación de schema identifican el archivo
Cuando la validación de un archivo del proyecto contra un schema Zod falla, el mensaje presentado al usuario SHALL incluir la ruta del archivo que falló. SHALL NOT presentarse el `ZodError.message` crudo (el volcado JSON del array de issues de Zod v4) como texto de cara al usuario.

#### Scenario: Fallo de schema en pnpm-workspace.yaml nombra el archivo
- **WHEN** `pnpm-workspace.yaml` declara `packages` con un tipo inválido, por ejemplo `packages: "packages/*"` en lugar de un array
- **THEN** el mensaje mostrado incluye la ruta `pnpm-workspace.yaml` y no contiene un volcado JSON de issues

#### Scenario: El mensaje no contiene JSON crudo
- **WHEN** cualquier lectura con schema falla la validación
- **THEN** el texto presentado no incluye llaves ni corchetes de un array JSON serializado de issues de Zod

### Requirement: Formato legible de campos inválidos
El formateo de un fallo de schema SHALL listar cada campo inválido como una línea `<ruta-del-campo>: <mensaje>`, usando la ruta del issue de Zod unida por puntos, y `(raíz)` cuando el issue no tiene ruta. Cuando hay múltiples issues, todos SHALL listarse.

#### Scenario: Campo faltante se lista con su nombre
- **WHEN** un archivo falla la validación por un campo `packages` con tipo inválido
- **THEN** el mensaje incluye una línea que empieza con `packages:` seguida del mensaje del issue

#### Scenario: Issue sin ruta se atribuye a la raíz
- **WHEN** el issue de Zod tiene un `path` vacío, por ejemplo porque el archivo contiene un valor de tipo incorrecto en el nivel superior
- **THEN** el campo se presenta como `(raíz)` en lugar de una cadena vacía

#### Scenario: Múltiples issues se listan todos
- **WHEN** un archivo falla la validación con dos o más issues
- **THEN** el mensaje incluye una línea por cada issue

### Requirement: Los mensajes de error de schema están traducidos
El encabezado del mensaje de error de schema SHALL provenir del sistema `t()` y SHALL existir en los locales `es` y `en`. Ningún sitio que reporte un fallo de validación de schema SHALL emitir texto de cara al usuario codificado en un idioma fijo.

#### Scenario: Encabezado en el locale activo
- **WHEN** el locale activo es `en` y falla la validación de un archivo
- **THEN** el encabezado del mensaje se muestra en inglés

#### Scenario: Aviso de package.json ilegible está traducido
- **WHEN** el `package.json` de un paquete del workspace no puede parsearse o validarse durante el descubrimiento
- **THEN** el aviso emitido usa `t()` e incluye la ruta del archivo, en lugar del texto fijo en inglés que existía antes de este cambio

### Requirement: Cobertura de todos los sitios de lectura con schema
Todos los puntos donde tagman valida un archivo del proyecto contra un schema SHALL usar el formateo compartido de errores: la lectura de `pnpm-workspace.yaml`, la lectura del `package.json` de cada paquete durante el descubrimiento del workspace, y la carga de `tagman.config.json`.

#### Scenario: loadConfig usa el formateo compartido
- **WHEN** `tagman.config.json` contiene una clave inválida y `loadConfig` cae al camino de defaults
- **THEN** el aviso emitido usa el formateo compartido con la ruta del archivo y la lista de campos, en lugar de `result.error.message`

#### Scenario: package.json inválido no aborta el descubrimiento
- **WHEN** un paquete del workspace tiene un `package.json` que falla la validación de schema
- **THEN** se emite el aviso formateado con la ruta de ese archivo, ese paquete se omite, y el descubrimiento continúa con los paquetes restantes

### Requirement: Ningún ZodError se escapa como JSON al usuario
El descubrimiento del workspace SHALL NOT propagar un `ZodError` sin formatear hasta el manejador de errores genérico del wizard. Cuando la validación de un archivo falla de forma irrecuperable, el error propagado SHALL llevar el mensaje ya formateado con archivo y campos.

#### Scenario: El wizard no imprime un volcado de issues seguido del error genérico
- **WHEN** la validación de un archivo leído durante el descubrimiento del workspace falla de forma irrecuperable dentro del flujo de release
- **THEN** el usuario ve el mensaje formateado que identifica el archivo y los campos, y no un array JSON de issues precediendo al mensaje de error genérico
