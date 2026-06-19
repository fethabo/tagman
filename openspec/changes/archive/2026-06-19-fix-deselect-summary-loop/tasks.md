## 1. Refactorizar el loop del resumen en wizard/index.ts

- [x] 1.1 En `src/commands/wizard/index.ts`, dentro del bloque `if (!resumeFromDraft)`, envolver la llamada a `showScanSummaryPrompt` en un `while (true)` local con una flag `backToScan = false`
- [x] 1.2 Dentro del summaryLoop, manejar `"remove"` con paquetes restantes: `continue` (re-mostrar resumen sin re-escanear)
- [x] 1.3 Dentro del summaryLoop, manejar `"remove"` con estado vacío: `p.cancel(t().scan.cancelled)` + `return` (cierre limpio, sin re-escanear)
- [x] 1.4 Dentro del summaryLoop, manejar `"back"`: `backToScan = true; break` del summaryLoop; luego `if (backToScan) continue` del loop externo para re-escanear
- [x] 1.5 Eliminar el bloque `if (summaryAction === "remove") { ... continue }` suelto que existía antes del refactor
