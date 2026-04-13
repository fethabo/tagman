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

**tagman** is an interactive, developer-first CLI tool built in TypeScript. It empowers you to granularly manage versioning and tagging within monorepos (pnpm, npm, yarn, bun) and standard single-package repositories.

Unlike fully automated semantic release tools, **tagman** doesn't execute destructive or irreversible actions without your explicit confirmation. You have the ultimate control to pick which commits go into a release, which internal dependencies to cascade, and exactly what your Git tags will say.

### Features
- **Smart Commit Detection**: Automatically identifies which packages have pending changes since their last `package-name@version` git tag.
- **Interactive Wizard**: A beautiful CLI experience powered by `@clack/prompts`.
- **Granular Selection**: Multi-select the exact commits you want to include in each package's release.
- **Auto-Suggested SemVer**: Evaluates your selected commits using conventional commits rules (`feat`, `fix`, `BREAKING CHANGE`) to suggest whether you need a `patch`, `minor`, or `major` bump.
- **Cascade Versioning**: Scans your workspace dependency graph. If `Package A` is updated, it offers to automatically bump `App B` that consumes it.
- **Intelligent Checkpointing**: If a release process is interrupted, `tagman` creates a local state checkpoint. You can safely resume your release later, or use the intelligent rollback feature to cleanly revert `package.json` and `CHANGELOG.md` file changes.
- **GitHub Releases**: Automatically creates one GitHub Release per package after tagging.
- **NPM Publishing**: Native support for publishing packages directly to the npm registry after tagging.
- **Plugin System**: Extend tagman with custom logic via an `afterRelease` hook.
- **i18n**: Interface available in English and Spanish (`--lang en|es`).

### Quick Start

You can run `tagman` on the fly without installing it globally:

```bash
npx @fethabo/tagman release
# or
pnpm dlx @fethabo/tagman release
```

#### Installing as a dev dependency

**pnpm workspace:**
```bash
pnpm add -Dw @fethabo/tagman
pnpm tagman release
```

**npm project (including Rush monorepos):**
```bash
npm install --save-dev @fethabo/tagman
npx tagman release
```

**yarn:**
```bash
yarn add --dev @fethabo/tagman
yarn tagman release
```

Follow the on-screen steps to select packages, apply bumps, verify cascade dependencies, and generate your annotated Git tags.

Once the wizard completes, tagman will offer to push your commits and tags to the remote repository automatically.

### Configuration

tagman reads an optional `tagman.config.json` file from your project root. Without it, defaults apply (pnpm workspace, full tag names).

```json
{
  "tagName": "full",
  "workspace": "pnpm",
  "packagesRoutes": [],
  "annotationMessage": "",
  "github": {
    "createRelease": false,
    "token": "",
    "prerelease": false
  },
  "npm": {
    "publish": false,
    "access": "public"
  },
  "plugins": []
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `tagName` | `"full" \| "version-only"` | `"full"` | `"full"` produces `pkg@1.0.0`; `"version-only"` produces `1.0.0` |
| `workspace` | `"pnpm" \| "npm" \| "yarn" \| "bun"` | `"pnpm"` | Package manager used to detect workspace packages |
| `packagesRoutes` | `string[]` | — | Explicit glob patterns to find packages. **Overrides workspace auto-detection.** |
| `annotationMessage` | `string` | — | Prefix text added to every generated tag annotation |
| `github.createRelease` | `boolean` | `false` | Create a GitHub Release per package after push |
| `github.token` | `string` | — | GitHub token. Falls back to `GITHUB_TOKEN` env var |
| `github.prerelease` | `boolean` | `false` | Mark GitHub Releases as pre-release |
| `npm.publish` | `boolean` | `false` | Run `pnpm publish` for each package after tagging |
| `npm.access` | `"public" \| "restricted"` | `"public"` | npm publish access level |
| `plugins` | `string[]` | — | Paths to ESM plugin files (relative to project root) |

#### Use case: pnpm workspace (standard)

No config needed. tagman reads `pnpm-workspace.yaml` automatically:

```bash
tagman release
```

#### Use case: npm / Rush monorepo with custom package directories

For projects that use npm, Rush, or any non-standard structure, use `packagesRoutes` to point tagman at your packages:

```json
{
  "workspace": "npm",
  "packagesRoutes": ["modulos/*"],
  "tagName": "full"
}
```

`packagesRoutes` accepts any [fast-glob](https://github.com/mrmlnc/fast-glob) pattern and takes priority over all workspace auto-detection. This makes tagman compatible with any monorepo layout, regardless of the package manager.

```bash
npm install --save-dev @fethabo/tagman
npx tagman release
```

#### Use case: GitHub Releases + NPM publish

```json
{
  "packagesRoutes": ["packages/*"],
  "github": {
    "createRelease": true,
    "prerelease": false
  },
  "npm": {
    "publish": true,
    "access": "public"
  }
}
```

Set `GITHUB_TOKEN` in your environment (or in `github.token`). After tagging and pushing, tagman will create one GitHub Release per package and publish each to npm.

#### Use case: Plugin (custom post-release logic)

Create a plugin file at your project root:

```js
// my-release-plugin.js
export default {
  async afterRelease(result) {
    for (const pkg of result.packages) {
      console.log(`Released ${pkg.name} ${pkg.previousVersion} → ${pkg.newVersion}`);
    }
  }
}
```

Register it in config:

```json
{
  "plugins": ["./my-release-plugin.js"]
}
```

### CLI Flags

```bash
tagman release [options]

  --dry-run            Preview all version/tag changes without writing anything
  --json               Output a structured JSON result to stdout at the end
  --packages <names>   Comma-separated package names to release (skips selection prompt)
  --bump <type>        Global bump type: patch | minor | major (skips bump prompt)
  --yes                Skip all confirmations and auto-accept cascade versioning
  --push               Push commits and tags to remote without asking
  --lang <lang>        Interface language: es | en (default: es)
```

**Fully headless** (zero prompts):
```bash
tagman release --packages my-lib,my-app --bump patch --yes --push
```

**Preview only:**
```bash
tagman release --dry-run
```

**English interface:**
```bash
tagman release --lang en
```

### 🗺️ Roadmap
This project is constantly evolving. The following milestones mark the technical direction of tagman:

#### 📦 Phase 1: Compatibility & Scope (Core)
[x] Multi-workspace Support: Extended compatibility to npm, yarn, bun, and any custom directory layout via `packagesRoutes`.

[x] Single Package Mode: Execution in standard repositories without monorepo structures.

[x] Plugin Architecture: Custom post-release logic via `afterRelease` hook in ESM plugin files.

#### 🚀 Phase 2: Automation & Ecosystem
[x] NPM Publishing: Native support for publishing packages directly to the npm registry after tagging.

[x] GitHub Releases: Automated creation of one GitHub Release per package using the official API.

[x] CHANGELOG.md Generator: Persists change history in a physical file in addition to tag metadata.

#### 🌍 Phase 3: User Experience & i18n
[x] Multi-language Support: Internationalization (i18n) system for all CLI messages.

[x] Hot-swappable Language: Language switching at runtime via `--lang en|es` flag.

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

**tagman** es una herramienta CLI interactiva construida en TypeScript, centrada en el desarrollador. Te otorga el poder de gestionar el versionado y el etiquetado (tagging) de forma granular dentro de monorepos (pnpm, npm, yarn, bun) y repositorios de paquete único estándar.

A diferencia de las herramientas de *semantic release* completamente automatizadas, **tagman** no ejecuta acciones destructivas ni irreversibles sin tu confirmación explícita. Tienes el control total para elegir qué commits entran en un release, qué dependencias internas actualizar en cascada y qué dirán exactamente tus tags de Git.

### Características
- **Detección Inteligente de Commits**: Identifica automáticamente qué paquetes tienen cambios pendientes desde su último tag de git (`nombre-paquete@version`).
- **Wizard Interactivo**: Una experiencia de terminal hermosa y limpia impulsada por `@clack/prompts`.
- **Selección Granular**: Selección múltiple de los commits exactos que deseas incluir en el lanzamiento de cada paquete.
- **Sugerencia de SemVer**: Evalúa los commits seleccionados bajo las reglas de *conventional commits* para sugerirte si necesitas un incremento `patch`, `minor` o `major`.
- **Versionado en Cascada**: Escanea el grafo de dependencias de tu workspace. Si el `Paquete A` se actualiza, te ofrece actualizar automáticamente la `App B` que lo consume.
- **Checkpoints Inteligentes (Resiliencia)**: Si un proceso de release se interrumpe, `tagman` crea un punto de guardado local. Puedes retomar tu lanzamiento más tarde o usar la función de *rollback* interactivo para revertir de manera limpia los cambios en los archivos `package.json` y `CHANGELOG.md`.
- **GitHub Releases**: Crea automáticamente un GitHub Release por paquete tras el push.
- **Publicación en NPM**: Soporte nativo para publicar paquetes en el registro de npm tras el tagging.
- **Sistema de Plugins**: Extendé tagman con lógica personalizada mediante el hook `afterRelease`.
- **i18n**: Interfaz disponible en español e inglés (`--lang es|en`).

### Inicio Rápido

Puedes ejecutar `tagman` al vuelo sin instalarlo globalmente:

```bash
npx @fethabo/tagman release
# o bien
pnpm dlx @fethabo/tagman release
```

#### Instalar como dependencia de desarrollo

**pnpm workspace:**
```bash
pnpm add -Dw @fethabo/tagman
pnpm tagman release
```

**npm (incluyendo monorepos con Rush u otras herramientas):**
```bash
npm install --save-dev @fethabo/tagman
npx tagman release
```

**yarn:**
```bash
yarn add --dev @fethabo/tagman
yarn tagman release
```

Sigue los pasos en pantalla para seleccionar los paquetes, aplicar los incrementos de versión, verificar las dependencias en cascada y generar tus tags anotados de Git.

Una vez que el wizard termine, tagman ofrecerá hacer *push* de tus commits y tags al repositorio remoto automáticamente.

### Configuración

tagman lee un archivo opcional `tagman.config.json` en la raíz de tu proyecto. Sin él, se aplican los valores por defecto (workspace pnpm, tags con nombre completo).

```json
{
  "tagName": "full",
  "workspace": "pnpm",
  "packagesRoutes": [],
  "annotationMessage": "",
  "github": {
    "createRelease": false,
    "token": "",
    "prerelease": false
  },
  "npm": {
    "publish": false,
    "access": "public"
  },
  "plugins": []
}
```

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `tagName` | `"full" \| "version-only"` | `"full"` | `"full"` produce `paquete@1.0.0`; `"version-only"` produce `1.0.0` |
| `workspace` | `"pnpm" \| "npm" \| "yarn" \| "bun"` | `"pnpm"` | Gestor de paquetes utilizado para detectar los paquetes del workspace |
| `packagesRoutes` | `string[]` | — | Patrones glob para encontrar paquetes. **Tiene prioridad sobre la detección automática de workspace.** |
| `annotationMessage` | `string` | — | Texto prefijo agregado a la anotación de cada tag generado |
| `github.createRelease` | `boolean` | `false` | Crear un GitHub Release por paquete luego del push |
| `github.token` | `string` | — | Token de GitHub. Si no se especifica, usa la variable de entorno `GITHUB_TOKEN` |
| `github.prerelease` | `boolean` | `false` | Marcar los GitHub Releases como pre-release |
| `npm.publish` | `boolean` | `false` | Ejecutar `pnpm publish` para cada paquete tras el tagging |
| `npm.access` | `"public" \| "restricted"` | `"public"` | Nivel de acceso en la publicación de npm |
| `plugins` | `string[]` | — | Rutas a archivos de plugin ESM (relativas a la raíz del proyecto) |

#### Caso de uso: pnpm workspace (estándar)

Sin configuración necesaria. tagman lee `pnpm-workspace.yaml` automáticamente:

```bash
tagman release
```

#### Caso de uso: monorepo npm / Rush con directorios personalizados

Para proyectos que usan npm, Rush u otras herramientas con estructuras no estándar, usa `packagesRoutes` para indicarle a tagman dónde están los paquetes:

```json
{
  "workspace": "npm",
  "packagesRoutes": ["modulos/*"],
  "tagName": "full"
}
```

`packagesRoutes` acepta cualquier patrón de [fast-glob](https://github.com/mrmlnc/fast-glob) y tiene prioridad sobre toda detección automática de workspace. Esto hace que tagman sea compatible con cualquier estructura de monorepo, independientemente del gestor de paquetes.

```bash
npm install --save-dev @fethabo/tagman
npx tagman release
```

#### Caso de uso: GitHub Releases + publicación en npm

```json
{
  "packagesRoutes": ["packages/*"],
  "github": {
    "createRelease": true,
    "prerelease": false
  },
  "npm": {
    "publish": true,
    "access": "public"
  }
}
```

Configurá `GITHUB_TOKEN` en tu entorno (o en `github.token`). Después del tagging y el push, tagman creará un GitHub Release por paquete y publicará cada uno en npm.

#### Caso de uso: Plugin (lógica post-release personalizada)

Creá un archivo de plugin en la raíz de tu proyecto:

```js
// mi-plugin-release.js
export default {
  async afterRelease(result) {
    for (const pkg of result.packages) {
      console.log(`Lanzado ${pkg.name} ${pkg.previousVersion} → ${pkg.newVersion}`);
    }
  }
}
```

Registralo en la config:

```json
{
  "plugins": ["./mi-plugin-release.js"]
}
```

### Flags de CLI

```bash
tagman release [opciones]

  --dry-run            Previsualiza versiones y tags sin escribir nada
  --json               Emite un JSON estructurado al finalizar (útil para scripts y agentes)
  --packages <names>   Paquetes a lanzar separados por coma (omite el prompt de selección)
  --bump <type>        Tipo de bump global: patch | minor | major (omite el prompt de bump)
  --yes                Omite todas las confirmaciones y acepta cascada automáticamente
  --push               Hace push al remoto sin preguntar
  --lang <lang>        Idioma de la interfaz: es | en (default: es)
```

**Modo completamente headless** (sin ningún prompt):
```bash
tagman release --packages my-lib,my-app --bump patch --yes --push
```

**Solo previsualizar:**
```bash
tagman release --dry-run
```

**Interfaz en inglés:**
```bash
tagman release --lang en
```

### 🗺️ Hoja de Ruta (Roadmap)
Este proyecto está en constante evolución. Los siguientes hitos marcan la dirección técnica de tagman:

#### 📦 Fase 1: Compatibilidad y Alcance (Core)
[x] Soporte multi-workspace: Compatibilidad extendida a npm, yarn, bun, y cualquier estructura de directorios personalizada mediante `packagesRoutes`.

[x] Modo Single Package: Ejecución en repositorios estándar que no utilicen estructuras de monorepo.

[x] Arquitectura de Plugins: Lógica post-release personalizada mediante el hook `afterRelease` en archivos de plugin ESM.

#### 🚀 Fase 2: Automatización y Ecosistema
[x] Publicación en NPM: Soporte nativo para publicar paquetes directamente en el registro de npm tras el tagging.

[x] GitHub Releases: Creación automática de un GitHub Release por paquete utilizando la API oficial.

[x] Generador de CHANGELOG.md: Persiste el historial de cambios en un archivo físico además de en los metadatos del tag.

#### 🌍 Fase 3: Experiencia de Usuario e i18n
[x] Soporte Multiidioma: Sistema de internacionalización (i18n) para todos los mensajes del CLI.

[x] Hot-swapping de Idioma: Cambio de idioma en tiempo de ejecución mediante el flag `--lang en|es`.

[ ] Refinamiento de UI: Optimizar las interfaces interactivas de @clack/prompts para una mejor legibilidad.

#### 🤖 Fase 4: Optimización Agéntica (IA-Ready)
[x] Modo JSON (--json): Salida de datos estructurada para que un agente de IA pueda procesar el resultado del comando sin parsing de texto.

[x] Modo Headless: Ejecución no interactiva mediante los flags `--packages`, `--bump`, `--yes` y `--push` para facilitar la automatización en scripts y flujos agénticos.

[x] Simulación (--dry-run): Previsualizar todos los cambios (tags, versiones) sin ejecutar acciones reales en el sistema de archivos o Git.
