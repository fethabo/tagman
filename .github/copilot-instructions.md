# Copilot Instructions — tagman

## Scope of Work

All edits must stay within the project source files. The only directories you may write to are:

- `src/`
- `bin/`
- `.github/`
- Root-level config files (`package.json`, `tsconfig.json`, `tsup.config.ts`, etc.)

## node_modules is Read-Only

**Never modify any file inside `node_modules/`.** This includes:

- Patching prototype methods at the source level
- Editing package source files
- Rewriting `.mjs`, `.cjs`, `.js`, `.d.ts` files inside a dependency

You **may** read and inspect files in `node_modules/` to understand how a library works or what it exports, but all actual changes must be implemented in the project source.

If a library does not expose the API you need, implement the required behavior yourself inside `src/` by using the library's public exported API (imports), not by mutating its internals at runtime (prototype patching, monkey-patching module exports).

## Language & Stack

- TypeScript (ESM, `"type": "module"`)
- Runtime: Node.js
- CLI framework: `@clack/prompts` + `@clack/core` for interactive prompts
- Build: `tsup`
- Package manager: `pnpm`
