## Context

El prompt de retoma de borrador actualmente usa `wizardSelect` (un `SelectPrompt` estándar de `@clack/core`). `wizardSelect` solo soporta la tecla `[b]` como extra key handler. La tecla `[d]` para alternar detalles existe en `commitMultiselect` (`src/commands/wizard/commit-multiselect.ts`), que es una clase custom que extiende `MultiSelectPrompt`.

El reto es implementar el mismo comportamiento reactivo (`showDetails` toggle → re-render automático) pero en el contexto de un `SelectPrompt` de dos opciones (Retomar / Descartar).

## Goals / Non-Goals

**Goals:**
- Tecla `[d]` alterna la visibilidad del listado de commits por paquete dentro del prompt de retoma
- El contenido del prompt se refresca reactivamente (mismo mecanismo que `commitMultiselect`)
- La barra de hints muestra `[d]` cuando el toggle está disponible
- Sin flicker ni re-apertura del prompt

**Non-Goals:**
- Modificar `wizardSelect` para uso genérico con toggles (innecesario, no hay otros usos identificados)
- Paginación de commits (se muestran todos; los borradores suelen tener pocos commits por paquete)
- Navegación per-package con teclado

## Decisions

### Decisión 1: Custom prompt class vs. hack sobre instancia existente

**Elegido: nueva función `showDraftResumePrompt()` con subclase de `SelectPrompt`**

Razón: `@clack/core` llama a `render()` automáticamente en cada keypress. Subclasificar permite overridear el getter `message` (o inyectar contenido en el frame de render) para incluir la lista de commits reactivamente. Es el mismo patrón que `commitMultiselect` usa con `MultiSelectPrompt`.

Alternativa descartada — loop con re-apertura: Cerrar el prompt al presionar `d`, mostrar un nuevo `p.note()`, reabrir el select. Funciona pero produce flicker visual y rompe la ilusión de continuidad.

Alternativa descartada — tercera opción en el select: Agregar "Ver commits" como opción del select. Funciona pero cambia la UX a un modelo de menú en lugar de un shortcut de teclado, inconsistente con el paso 2.

### Decisión 2: Dónde poner el código

**Elegido: nuevo archivo `src/commands/wizard/draft-resume-prompt.ts`**

Razón: `index.ts` ya es extenso. Separar la clase del prompt (análogo a como `commit-multiselect.ts` separa su lógica) mantiene la cohesión. `index.ts` solo llama a `showDraftResumePrompt(draftData)`.

### Decisión 3: Cómo inyectar el contenido dinámico en SelectPrompt

**Elegido: override del getter `message` en la subclase**

`@clack/core`'s `SelectPrompt` renderiza `this.message` en cada ciclo de render. Overridear el getter en la subclase permite retornar un string dinámico que incluye el resumen de paquetes + commits condicionales. La variable `showDetails` vive en el scope de la instancia.

La barra de hints se incluye como parte del message string o como parte del frame render, a confirmar durante implementación inspeccionando la API real de `SelectPrompt`.

### Decisión 4: Formato de commits en la vista de detalle

Cada commit se muestra como una línea indentada con hash corto y mensaje:
```
  pkg-a: 1.0.0 → 2.0.0  (2 commits)
    abc1234 feat: nueva funcionalidad
    def5678 fix: corrección menor
```
Sigue la convención visual del paso 2 (`label` de cada `CommitOpt`). Los campos disponibles en `CommitInfo` (`hash`, `message`) son suficientes. El `hash` se trunca a 7 caracteres.

## Risks / Trade-offs

- [Riesgo] API interna de `SelectPrompt` puede diferir de lo esperado → Mitigación: inspeccionar `node_modules/@clack/core` durante implementación para confirmar el mecanismo de override antes de escribir la subclase.
- [Trade-off] Código acoplado a internals de `@clack/core`: Si clack actualiza su API interna, el custom prompt puede romperse. Mitigación: igual riesgo que `commitMultiselect` (ya aceptado como patrón del proyecto).
