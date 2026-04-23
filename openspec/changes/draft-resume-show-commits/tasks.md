## 1. Inspección de API de @clack/core

- [x] 1.1 Leer `node_modules/@clack/core/dist/index.js` (o `.ts` si está disponible) para confirmar cómo `SelectPrompt` expone `message` y el ciclo de render, y decidir el punto exacto de override

## 2. i18n — nuevas claves

- [x] 2.1 Agregar en `src/i18n/types.ts` las claves `detailsShow: string` y `detailsHide: string` al namespace `draft`
- [x] 2.2 Agregar las traducciones en `src/i18n/es.ts`: `detailsShow: "ver commits"`, `detailsHide: "ocultar commits"`
- [x] 2.3 Agregar las traducciones en `src/i18n/en.ts`: `detailsShow: "show commits"`, `detailsHide: "hide commits"`

## 3. Implementación del prompt custom

- [x] 3.1 Crear `src/commands/wizard/draft-resume-prompt.ts` con la función `showDraftResumePrompt(draftState: Map<string, ReleaseState>): Promise<"resume" | "discard" | symbol>`
- [x] 3.2 Dentro de la función, implementar la subclase de `SelectPrompt` (o usar el patrón de instancia + override) con `showDetails = false`
- [x] 3.3 Agregar el key handler `(prompt as any).on('key', ...)` que alterna `showDetails` al presionar `'d'` y dispara un re-render
- [x] 3.4 Implementar el builder de contenido: líneas de resumen por paquete (`nombre: vOld → vNew`) con commits indentados (`    <hash7> <mensaje>`) cuando `showDetails = true`
- [x] 3.5 Agregar el hint `[d] <t().draft.detailsShow|detailsHide>` a la barra de hints del prompt (junto a `[↑↓]` y `[enter]`)
- [x] 3.6 Manejar el caso de paquetes con `commits.length === 0` (no mostrar líneas de commit para ellos)

## 4. Integración en el wizard

- [x] 4.1 En `src/commands/wizard/index.ts`, reemplazar la llamada a `wizardSelect` del bloque de retoma de borrador (líneas ~58–66) por `showDraftResumePrompt(draftData.state)`
- [x] 4.2 Asegurarse que el retorno de `showDraftResumePrompt` se mapea correctamente a las ramas `resume` / `discard` / cancel existentes

## 5. Verificación manual

- [ ] 5.1 Crear un borrador con 2+ paquetes (ejecutar `pnpm dev`, seleccionar paquetes y commits, guardar borrador)
- [ ] 5.2 Ejecutar `pnpm dev` de nuevo y verificar que el prompt de retoma muestra los paquetes sin commits por defecto
- [ ] 5.3 Presionar `d` y verificar que aparecen los commits de cada paquete con hash truncado y mensaje
- [ ] 5.4 Presionar `d` nuevamente y verificar que los commits se ocultan
- [ ] 5.5 Verificar que "Retomar" y "Descartar" funcionan correctamente con ambos estados del toggle
- [ ] 5.6 Verificar que el hint `[d]` cambia entre "ver commits" y "ocultar commits"

<!-- Tareas 5.1–5.6 requieren verificación manual interactiva -->
