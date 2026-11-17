# Proposal

## Why

Al versionar en cascada, tagman reescribe toda referencia de dependencia interna a `^<nuevaVersion>`, incluidas las que usan el protocolo `workspace:` (issue #70). En pnpm 10 (`linkWorkspacePackages: false` por defecto) esa reescritura hace que `pnpm install` busque el paquete en el registry y falle con `ERR_PNPM_FETCH_404` para paquetes privados. Ya rompió un repo real (11 referencias en 6 `package.json`), así que el release deja el monorepo sin poder instalarse.

## What Changes

- Las referencias `workspace:*`, `workspace:^` y `workspace:~` dejan de tocarse durante la cascada: pnpm las resuelve solo al publicar.
- Las referencias `workspace:` con versión explícita (`workspace:^1.2.3`, `workspace:~1.2.3`, `workspace:1.2.3`) conservan el protocolo y el operador; solo se actualiza la versión.
- Las referencias semver simples conservan su operador (`^`, `~` o exacto) en lugar de forzar `^`.
- Cualquier otra forma (`catalog:`, `npm:`, `file:`, `link:`, URLs git, rangos como `>=1.0.0` o `1.x`, `*`, dist-tags) se deja intacta.
- Un `package.json` consumidor solo se reescribe si alguna referencia cambió.
- El rollback desde checkpoint restaura el valor exacto que tenía cada referencia antes de la release, en vez de dejar `^<versionAnterior>`.

## Capabilities

### New Capabilities

- `cascade-dependency-references`: cómo se actualizan (o se preservan) las referencias de dependencias internas en los `package.json` consumidores cuando un paquete del workspace cambia de versión, tanto al escribir el release como al revertirlo.

### Modified Capabilities

(ninguna)

## Impact

- `src/core/updater.ts`: `updateConsumerDependencies` y `rollbackConsumerDependencies`.
- Llamadores sin cambios de firma: `src/commands/wizard/steps/execute.ts` (fase `writing`) y `src/commands/wizard/steps/checkpoint.ts` (rollback).
- Nuevo test unitario en `src/core/` (runner `node:test` vía `pnpm test`).
- Sin cambios de config, CLI ni dependencias. Los repos que hoy dependen del rewrite a `^x.y.z` verán ahora preservado su operador original; no es un cambio de API.
