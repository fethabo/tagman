![tagman banner](tagman.png)

# tagman 🏷️

> *You are tagman, transform commits on multipackages monorepo to descriptive and normalize tags on your github repo.*



[English](#english) | [Español](#español)

---

<a name="english"></a>
## 🇬🇧 English

## 🤖 A Note on Project Origins

***tagman was conceived and developed primarily through agentic programming flows. I leveraged supervised AI agents to materialize a solution to a recurring need I encountered across multiple projects—one that conventional release tools failed to address satisfactorily. I'm aware that workflows vary drastically between teams and that creating a universally flexible tool is a monumental challenge. However, as part of my professional growth and my commitment to the future of software development, my goal is to iterate on tagman until it achieves that flexibility.***

***P.S.: And yes, this readme was also written by an agent.***

**tagman** is an interactive, developer-first CLI tool built in TypeScript. It empowers you to granularly manage versioning and tagging within monorepos (currently heavily optimized for `pnpm` workspaces). 

Unlike fully automated semantic release tools, **tagman** doesn't execute destructive or irreversible actions without your explicit confirmation. You have the ultimate control to pick which commits go into a release, which internal dependencies to cascade, and exactly what your Git tags will say.

### Features
- **Smart Commit Detection**: Automatically identifies which packages have pending changes since their last `package-name@version` git tag.
- **Interactive Wizard**: A beautiful CLI experience powered by `@clack/prompts`.
- **Granular Selection**: Multi-select the exact commits you want to include in each package's release.
- **Auto-Suggested SemVer**: Evaluates your selected commits using conventional commits rules (`feat`, `fix`, `BREAKING CHANGE`) to suggest whether you need a `patch`, `minor`, or `major` bump.
- **Cascade Versioning**: Scans your workspace dependency graph. If `Package A` is updated, it offers to automatically bump `App B` that consumes it.
- **Intelligent Checkpointing**: If a release process is interrupted, `tagman` creates a local state checkpoint. You can safely resume your release later, or use the intelligent rollback feature to cleanly revert `package.json` and `CHANGELOG.md` file changes.

### Quick Start

You can run `tagman` on the fly without installing it globally:

```bash
npx @fethabo/tagman release
# or
pnpm dlx @fethabo/tagman release
```

Alternatively, you can add it as a development dependency to your workspace root:

```bash
pnpm add -Dw @fethabo/tagman

# Then run it via your package manager
pnpm tagman release
```

Follow the on-screen steps to select packages, apply bumps, verify cascade dependencies, and generate your annotated Git tags.

Once the wizard completes, tagman will offer to push your commits and tags to the remote repository automatically.

### CLI Flags

```bash
tagman release [options]

  --dry-run            Preview all version/tag changes without writing anything
  --json               Output a structured JSON result to stdout at the end
  --packages <names>   Comma-separated package names to release (skips selection prompt)
  --bump <type>        Global bump type: patch | minor | major (skips bump prompt)
  --yes                Skip all confirmations and auto-accept cascade versioning
  --push               Push commits and tags to remote without asking
```

**Fully headless** (zero prompts):
```bash
tagman release --packages my-lib,my-app --bump patch --yes --push
```

**Preview only:**
```bash
tagman release --dry-run
```

### 🗺️ Roadmap
This project is constantly evolving. The following milestones mark the technical direction of tagman:

#### 📦 Phase 1: Compatibility & Scope (Core)
[ ] Multi-workspace Support: Extend current pnpm compatibility to npm, yarn, and bun environments.

[x] Single Package Mode: Enable execution in standard repositories without monorepo structures.

[ ] Plugin Architecture: Allow custom versioning logic for different workflows.

#### 🚀 Phase 2: Automation & Ecosystem
[ ] NPM Publishing: Native support for publishing packages directly to the npm registry after tagging.

[ ] GitHub Releases: Automate the creation of releases on GitHub using the official API and tag information.

[x] CHANGELOG.md Generator: Option to persist change history in a physical file in addition to tag metadata.

#### 🌍 Phase 3: User Experience & i18n
[ ] Multi-language Support: Implement an internationalization (i18n) system for CLI messages.

[ ] Hot-swappable Language: Allow language switching at runtime via flags (e.g., tagman --lang en).

[ ] UI Refinement: Optimize @clack/prompts interactive interfaces for better readability.

#### 🤖 Phase 4: Agentic Optimization (AI-Ready)
[x] JSON Mode (--json): Structured data output so an AI agent can process command results without text parsing.

[x] Headless Mode: Non-interactive execution via `--packages`, `--bump`, `--yes`, and `--push` flags to facilitate automation in scripts and agentic flows.

[x] Simulation (--dry-run): Preview all changes (tags, versions) without executing real actions on the filesystem or Git.

---

<a name="español"></a>
## 🇪🇸 Español

## 🤖 Nota sobre el origen del proyecto

***tagman fue concebido y desarrollado principalmente a través de flujos de programación agéntica. Utilicé agentes de IA supervisados para materializar una solución a una necesidad recurrente que encontré en múltiples proyectos y que las herramientas de release convencionales no lograban cubrir de forma satisfactoria. Soy consciente de que los flujos de trabajo varían drásticamente entre equipos y que crear una herramienta universalmente flexible es un desafío monumental. Sin embargo, como parte de mi crecimiento profesional y mi apuesta por el futuro del desarrollo de software, mi objetivo es iterar tagman hasta alcanzar esa flexibilidad***

***PD: Y sí, este readme tambien lo escribió un agente***

**tagman** es una herramienta CLI interactiva construida en TypeScript, centrada en el desarrollador. Te otorga el poder de gestionar el versionado y el etiquetado (tagging) de forma granular dentro de monorepos (actualmente optimizado para workspaces de `pnpm`).

A diferencia de las herramientas de *semantic release* completamente automatizadas, **tagman** no ejecuta acciones destructivas ni irreversibles sin tu confirmación explícita. Tienes el control total para elegir qué commits entran en un release, qué dependencias internas actualizar en cascada y qué dirán exactamente tus tags de Git.

### Características
- **Detección Inteligente de Commits**: Identifica automáticamente qué paquetes tienen cambios pendientes desde su último tag de git (`nombre-paquete@version`).
- **Wizard Interactivo**: Una experiencia de terminal hermosa y limpia impulsada por `@clack/prompts`.
- **Selección Granular**: Selección múltiple de los commits exactos que deseas incluir en el lanzamiento de cada paquete.
- **Sugerencia de SemVer**: Evalúa los commits seleccionados bajo las reglas de *conventional commits* para sugerirte si necesitas un incremento `patch`, `minor` o `major`.
- **Versionado en Cascada**: Escanea el grafo de dependencias de tu workspace. Si el `Paquete A` se actualiza, te ofrece actualizar automáticamente la `App B` que lo consume.
- **Checkpoints Inteligentes (Resiliencia)**: Si un proceso de release se interrumpe, `tagman` crea un punto de guardado local. Puedes retomar tu lanzamiento más tarde o usar la función de *rollback* interactivo para revertir de manera limpia los cambios en los archivos `package.json` y `CHANGELOG.md`.

### Inicio Rápido

Puedes ejecutar `tagman` al vuelo sin instalarlo globalmente:

```bash
npx @fethabo/tagman release
# o bien
pnpm dlx @fethabo/tagman release
```

Alternativamente, puedes agregarlo como dependencia de desarrollo en la raíz de tu workspace:

```bash
pnpm add -Dw @fethabo/tagman

# Luego ejecútalo a través de tu gestor de paquetes
pnpm tagman release
```

Sigue los pasos en pantalla para seleccionar los paquetes, aplicar los incrementos de versión, verificar las dependencias en cascada y generar tus tags anotados de Git.

Una vez que el wizard termine, tagman ofrecerá hacer *push* de tus commits y tags al repositorio remoto automáticamente.

### Flags de CLI

```bash
tagman release [opciones]

  --dry-run            Previsualiza versiones y tags sin escribir nada
  --json               Emite un JSON estructurado al finalizar (útil para scripts y agentes)
  --packages <names>   Paquetes a lanzar separados por coma (omite el prompt de selección)
  --bump <type>        Tipo de bump global: patch | minor | major (omite el prompt de bump)
  --yes                Omite todas las confirmaciones y acepta cascada automáticamente
  --push               Hace push al remoto sin preguntar
```

**Modo completamente headless** (sin ningún prompt):
```bash
tagman release --packages my-lib,my-app --bump patch --yes --push
```

**Solo previsualizar:**
```bash
tagman release --dry-run
```

### 🗺️ Hoja de Ruta (Roadmap)
Este proyecto está en constante evolución. Los siguientes hitos marcan la dirección técnica de tagman:

#### 📦 Fase 1: Compatibilidad y Alcance (Core)
[ ] Soporte multi-workspace: Extender la compatibilidad actual de pnpm a entornos de npm, yarn y bun.

[x] Modo Single Package: Permitir la ejecución en repositorios estándar que no utilicen estructuras de monorepo.

[ ] Arquitectura de Plugins: Permitir lógica de versionado personalizada para diferentes flujos de trabajo.

#### 🚀 Fase 2: Automatización y Ecosistema
[ ] Publicación en NPM: Soporte nativo para publicar paquetes directamente en el registro de npm tras el tagging.

[ ] GitHub Releases: Automatizar la creación de lanzamientos en GitHub utilizando la API oficial y la información de los tags.

[x] Generador de CHANGELOG.md: Opción para persistir el historial de cambios en un archivo físico además de en los metadatos del tag.

#### 🌍 Fase 3: Experiencia de Usuario e i18n
[ ] Soporte Multiidioma: Implementar un sistema de internacionalización (i18n) para los mensajes del CLI.

[ ] Hot-swapping de Idioma: Permitir el cambio de idioma en tiempo de ejecución mediante flags (ej. tagman --lang en).

[ ] Refinamiento de UI: Optimizar las interfaces interactivas de @clack/prompts para una mejor legibilidad.

#### 🤖 Fase 4: Optimización Agéntica (IA-Ready)
[x] Modo JSON (--json): Salida de datos estructurada para que un agente de IA pueda procesar el resultado del comando sin parsing de texto.

[x] Modo Headless: Ejecución no interactiva mediante los flags `--packages`, `--bump`, `--yes` y `--push` para facilitar la automatización en scripts y flujos agénticos.

[x] Simulación (--dry-run): Previsualizar todos los cambios (tags, versiones) sin ejecutar acciones reales en el sistema de archivos o Git.

