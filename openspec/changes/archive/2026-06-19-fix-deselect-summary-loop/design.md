## Context

En `src/commands/wizard/index.ts`, el flujo post-scan tiene esta estructura:

```
while (true) {                          ← loop EXTERNO (re-ejecuta scanAndSelectPackages)
  if (!resumeFromDraft) {
    newState = await scanAndSelectPackages(...)
    ...
    summaryAction = await showScanSummaryPrompt(state)
    if (summaryAction === "remove") {
      // quitar paquetes
      if (state.size === 0) { ... }
      continue;   ← BUG: este continue salta al EXTERNO → re-escanea
    }
    if (summaryAction === "back") continue;
  }
  // inner loop: tag-messages ↔ execute
}
```

El `continue` dentro del handler de `"remove"` salta al loop externo, re-ejecutando el scan y la selección de commits aunque haya paquetes restantes en el state.

## Goals / Non-Goals

**Goals:**
- Hacer que `"remove"` con paquetes restantes re-muestre el resumen sin re-escanear.
- Hacer que `"remove"` con estado vacío cierre limpiamente (p.cancel + return).
- Conservar el comportamiento de `"back"` (re-escanear) y `"proceed"`/`"save"` (continuar).

**Non-Goals:**
- Cambiar la UI del resumen, i18n ni otros componentes.
- Modificar `showScanSummaryPrompt`.

## Decisions

### D1: Loop interno alrededor del resumen

**Decisión:** envolver `showScanSummaryPrompt` en un `while (true)` local (`summaryLoop`) dentro del bloque `if (!resumeFromDraft)`. Las acciones se resuelven así:

| Acción | Comportamiento |
|--------|---------------|
| `"proceed"` | `break` del summaryLoop → continúa al inner loop (tag-messages) |
| `"save"` | guarda draft + return (igual que antes) |
| `"remove"` con paquetes restantes | `continue` dentro del summaryLoop → re-muestra resumen |
| `"remove"` con estado vacío | `p.cancel()` + `return` (cierre limpio, sin re-escanear) |
| `"back"` | `break` del summaryLoop + flag `backToScan = true` → `continue` del loop externo |
| cancel (Ctrl+C) | `p.cancel()` + return (igual que antes) |

**Alternativa descartada:** `goto`-style con un label externo. TypeScript no tiene `break <label>` equivalente a un continue externo directamente; el flag `backToScan` es más legible.

## Risks / Trade-offs

- Cambio de comportamiento cuando el estado queda vacío: antes re-escaneaba, ahora cierra. Es el comportamiento correcto según el requerimiento, pero es un cambio observable.
