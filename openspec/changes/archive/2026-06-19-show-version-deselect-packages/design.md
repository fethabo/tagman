## Context

El wizard de release ejecuta un flujo secuencial por paquete: step 1 (multiselect de paquetes) → step 2 (commits) → step 3 (bump) → step 4 (cascade) para cada paquete, luego `showScanSummaryPrompt` con las opciones "Continuar / Guardar borrador / Volver".

**Problemas actuales:**
1. En el `p.multiselect` del step 1, el label de cada paquete es `nombre (N commits)` sin versión actual. El usuario no sabe qué versión está eligiendo para bumpar.
2. Una vez que el usuario terminó de configurar todos los paquetes (steps 2-4), si quiere quitar un paquete que incluyó por error, la única salida es "Volver" — que re-ejecuta todo `scanAndSelectPackages` desde cero.

**Estado del `showScanSummaryPrompt`:** ya muestra `nombre: viejaVersion → nuevaVersion (N commits)`. La versión nueva *sí* aparece en el resumen. Lo que falta es (a) versión en el step 1 y (b) poder quitar paquetes desde el resumen sin reiniciar.

## Goals / Non-Goals

**Goals:**
- Mostrar la versión actual de cada paquete en el step 1 (`p.multiselect`) para que el usuario seleccione con contexto.
- Permitir quitar uno o más paquetes del release desde `showScanSummaryPrompt` sin volver al step 1.
- Mantener total retrocompatibilidad con los modos headless (`--yes`, `--packages`, `--bump`).

**Non-Goals:**
- Editar el bump de un paquete ya configurado desde el resumen (eso requeriría re-navegar pasos 2-4).
- Reordenar paquetes en la lista.
- Modificar el flujo de checkpoint/draft por este cambio.

## Decisions

### D1: Dónde mostrar la versión en step 1

**Decisión:** agregar la versión actual al `label` de cada opción en el `p.multiselect`, entre paréntesis después del nombre.

**Formato:**
- Regular: `package-a (1.2.3) — 5 commits`
- Graduación: `package-a (1.0.0-rc.2)` + hint existente de graduation
- Extra-only: `package-a (1.2.3)` + hint existente de extra-only
- No-commits: `package-a (1.2.3)` + hint existente

**Alternativa descartada:** poner la versión en el `hint`. Los hints ya se usan para estado (graduation, extra-only), y apilarlos visualmente es confuso.

### D2: Mecanismo de deselección en el resumen

**Decisión:** agregar una cuarta opción "Quitar paquete(s)" en `showScanSummaryPrompt`. Al elegirla, se muestra un `p.multiselect` con todos los paquetes actuales pre-seleccionados; el usuario desmarca los que quiere quitar. Tras confirmar, se eliminan del `state` Map y se vuelve al resumen.

**Alternativa descartada:** navegación basada en cursor sobre cada fila del resumen (al estilo vim). Complejo de implementar con `@clack/core`, propenso a bugs de render, y difícil de descubrir por el usuario.

**Caso edge — estado vacío:** si el usuario quita todos los paquetes, se emite un `p.log.warn` y se retorna `"back"` para que el wizard reinicie `scanAndSelectPackages`.

**Interacción con cascade:** los paquetes en `state` son independientes entre sí (cascade ya fue resuelto en steps 2-4). Quitar un paquete del state simplemente lo excluye del release; no se deshacen sus efectos en cascade (eso corresponde al nivel de lógica de negocio, que el usuario debe entender).

### D3: Strings de i18n

Todos los nuevos textos pasan por `t()`. Se añaden claves nuevas en `en.ts` y `es.ts`; no se modifican claves existentes.

## Risks / Trade-offs

- [Label más largo en step 1] → Podría truncarse en terminales angostas. Mitigación: `clack` ya maneja wrapping; la versión semver suele ser corta (`1.2.3`).
- [Quitar un paquete que era dependencia cascade de otro que SÍ se mantiene] → el release del dependiente seguirá incluyendo el pseudo-commit de cascade (`chore: update dependency …`), pero sin el bump del paquete removido. El usuario es responsable de esa coherencia. Mitigación: en el `p.log.warn` de "quitar paquetes" se puede mencionar brevemente este riesgo si hay dependencias en el state. (No implementado en v1 por complejidad.)
