# tagman 🏷️

> *You are tagman, transform commits on multipackages monorepo to descriptive and normalize tags on your github repo.*

[English](#english) | [Español](#español)

---

<a name="english"></a>
## 🇬🇧 English

**tagman** is an interactive, developer-first CLI tool built in TypeScript. It empowers you to granularly manage versioning and tagging within monorepos (currently heavily optimized for `pnpm` workspaces). 

Unlike fully automated semantic release tools, **tagman** doesn't execute destructive or irreversible actions without your explicit confirmation. You have the ultimate control to pick which commits go into a release, which internal dependencies to cascade, and exactly what your Git tags will say.

### Features
- **Smart Commit Detection**: Automatically identifies which packages have pending changes since their last `package-name@version` git tag.
- **Interactive Wizard**: A beautiful CLI experience powered by `@clack/prompts`.
- **Granular Selection**: Multi-select the exact commits you want to include in each package's release.
- **Auto-Suggested SemVer**: Evaluates your selected commits using conventional commits rules (`feat`, `fix`, `BREAKING CHANGE`) to suggest whether you need a `patch`, `minor`, or `major` bump.
- **Cascade Versioning**: Scans your workspace dependency graph. If `Package A` is updated, it offers to automatically bump `App B` that consumes it.
- **Intelligent Checkpointing**: If a release process is interrupted, `tagman` creates a local state checkpoint. You can safely resume your release later, or use the intelligent rollback feature to cleanly revert `package.json` and `CHANGELOG.md` file changes.

### Usage

Run `tagman` directly in the root of your workspace:

```bash
# Using simple execution (if linked)
tagman release

# Using npx / pnpm dlx
npx tagman release
```

Follow the on-screen steps to select packages, apply bumps, verify cascade dependencies, and generate your annotated Git tags.

### Roadmap 🗺️
- [ ] **Cross-Workspace Support**: Expand compatibility to `npm`, `yarn`, and `bun` workspaces.
- [x] **Single Package Support**: Allow running `tagman` in standard, non-monorepo repositories.
- [ ] **NPM Publishing**: Native support to push the bumped packages directly to the npm registry.
- [ ] **GitHub Releases**: Automatically draft and publish comprehensive GitHub Releases using the generated Git tags.

---

<a name="español"></a>
## 🇪🇸 Español

**tagman** es una herramienta CLI interactiva construida en TypeScript, centrada en el desarrollador. Te otorga el poder de gestionar el versionado y el etiquetado (tagging) de forma granular dentro de monorepos (actualmente optimizado para workspaces de `pnpm`).

A diferencia de las herramientas de *semantic release* completamente automatizadas, **tagman** no ejecuta acciones destructivas ni irreversibles sin tu confirmación explícita. Tienes el control total para elegir qué commits entran en un release, qué dependencias internas actualizar en cascada y qué dirán exactamente tus tags de Git.

### Características
- **Detección Inteligente de Commits**: Identifica automáticamente qué paquetes tienen cambios pendientes desde su último tag de git (`nombre-paquete@version`).
- **Wizard Interactivo**: Una experiencia de terminal hermosa y limpia impulsada por `@clack/prompts`.
- **Selección Granular**: Selección múltiple de los commits exactos que deseas incluir en el lanzamiento de cada paquete.
- **Sugerencia de SemVer**: Evalúa los commits seleccionados bajo las reglas de *conventional commits* para sugerirte si necesitas un incremento `patch`, `minor` o `major`.
- **Versionado en Cascada**: Escanea el grafo de dependencias de tu workspace. Si el `Paquete A` se actualiza, te ofrece actualizar automáticamente la `App B` que lo consume.
- **Checkpoints Inteligentes (Resiliencia)**: Si un proceso de release se interrumpe, `tagman` crea un punto de guardado local. Puedes retomar tu lanzamiento más tarde o usar la función de *rollback* interactivo para revertir de manera limpia los cambios en los archivos `package.json` y `CHANGELOG.md`.

### Uso

Ejecuta `tagman` directamente en la raíz de tu workspace:

```bash
# Ejecución directa (si está linkeado globalmente)
tagman release

# Usando npx / pnpm dlx
npx tagman release
```

Sigue los pasos en pantalla para seleccionar los paquetes, aplicar los incrementos de versión, verificar las dependencias en cascada y generar tus tags anotados de Git.

### Hoja de Ruta (Roadmap) 🗺️
- [ ] **Soporte multi-workspace**: Extender la compatibilidad a workspaces de `npm`, `yarn` y `bun`.
- [x] **Soporte para Single Package**: Permitir la ejecución de `tagman` en repositorios estándar que no sean monorepos.
- [ ] **Publicaciones en NPM**: Soporte nativo para publicar directamente los paquetes en el registro de npm.
- [ ] **GitHub Releases**: Automatizar la creación y publicación de GitHub Releases utilizando la información de los tags generados.
