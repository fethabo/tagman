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
- **Main Menu**: Running `tagman` without arguments presents a menu to choose between creating a release or publishing an existing tag to GitHub Releases.
- **Smart Commit Detection**: Automatically identifies which packages have pending changes since their last `package-name@version` git tag.
- **Interactive Wizard**: A beautiful CLI experience powered by `@clack/prompts`.
- **Granular Selection**: Multi-select the exact commits you want to include in each package's release.
- **Wizard Back Navigation**: Navigate back at any wizard step — from bump selection to commit re-selection, from tag messages to package re-selection, or from commit selection (`b` key) back to the package multiselect — without aborting the operation.
- **Extra-Directory Commits**: Optionally include commits from outside the package's directory in a release (Step 2b). Useful for shared files dynamically imported across modules with no declared interdependency.
- **Commit Detail Toggle**: Press `d` while selecting commits to reveal timestamps and authors inline; press again to hide.
- **Auto-Suggested SemVer**: Evaluates your selected commits using conventional commits rules (`feat`, `fix`, `BREAKING CHANGE`) to suggest whether you need a `patch`, `minor`, or `major` bump.
- **Flexible Bump Options**: Choose `patch`, `minor`, `major`, `none` (tag without changing version), or `custom` (enter any exact SemVer).
- **Cascade Versioning**: Scans your workspace dependency graph. If `Package A` is updated, it offers to automatically bump `App B` that consumes it.
- **Intelligent Checkpointing**: If a release process is interrupted, `tagman` creates a local state checkpoint. You can safely resume your release later, or use the intelligent rollback feature to cleanly revert `package.json` and `CHANGELOG.md` file changes.
- **GitHub Release from Existing Tag**: Publish an already-created local git tag to GitHub Releases without needing new commits — directly from the main menu or via `tagman github-release`.
- **GitHub Releases**: Automatically creates one GitHub Release per package after tagging.
- **NPM Publishing**: Native support for publishing packages directly to the npm registry after tagging.
- **Plugin System**: Extend tagman with custom logic via an `afterRelease` hook.
- **i18n**: Interface available in English and Spanish (`--lang en|es`).

### Quick Start

You can run `tagman` on the fly without installing it globally:

```bash
npx @fethabo/tagman
# or
pnpm dlx @fethabo/tagman
```

Running `tagman` without arguments opens the **main menu** where you can choose:
- **Create release** — the full wizard: scan commits → bump version → create git tag + CHANGELOG
- **GitHub release from existing tag** — publish an already-tagged version to GitHub Releases

To go straight to the release wizard:
```bash
npx @fethabo/tagman release
```

#### Installing as a dev dependency

**pnpm workspace:**
```bash
pnpm add -Dw @fethabo/tagman
pnpm tagman
```

**npm project (including Rush monorepos):**
```bash
npm install --save-dev @fethabo/tagman
npx tagman
```

**yarn:**
```bash
yarn add --dev @fethabo/tagman
yarn tagman
```

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

### Keyboard Shortcuts

These shortcuts are active inside the interactive wizard:

| Key | Context | Action |
|-----|---------|--------|
| `d` | Commit multiselect | Toggle date & author inline detail |
| `b` | Commit multiselect | Go back to package selection |
| `a` | Commit multiselect | Select all commits |
| `n` | Commit multiselect | Deselect all commits |
| `Space` | Any multiselect | Toggle selected item |
| `↑` / `↓` | Any prompt | Navigate options |
| `Enter` | Any prompt | Confirm selection |
| `Ctrl+C` | Anywhere | Cancel and exit |

### Bump Options

When selecting the version increment for a package, tagman offers:

| Option | Description |
|--------|-------------|
| `patch` | `1.0.0 → 1.0.1` — bug fixes and small changes |
| `minor` | `1.0.0 → 1.1.0` — new features, backward-compatible |
| `major` | `1.0.0 → 2.0.0` — breaking changes |
| `pre-release ▸` | Opens a sub-flow to create alpha/beta/rc versions |
| `none` | Keep the current version, create the git tag only (no `package.json` update) |
| `custom` | Enter any exact SemVer version string (e.g. `2.0.0-beta.1`) |

If the current version is already a pre-release (e.g. `2.0.0-alpha.1`), two additional options appear:

| Option | Description |
|--------|-------------|
| `increment counter` | `2.0.0-alpha.1 → 2.0.0-alpha.2` — bump the pre-release counter |
| `graduate to stable` | `2.0.0-alpha.1 → 2.0.0` — remove the pre-release identifier |

tagman auto-suggests the bump type based on the conventional commit types you selected (`feat →` minor, `BREAKING CHANGE →` major, everything else → patch). When the current version is already a pre-release, "increment counter" is auto-suggested.

#### Pre-release sub-flow

When selecting **pre-release ▸**, tagman shows two additional prompts:

1. **Base bump type** — whether the next stable would be a patch, minor or major:
   - `prepatch` → `1.0.0-alpha.0`, `preminor` → `1.1.0-alpha.0`, `premajor` → `2.0.0-alpha.0`
2. **Channel** — `alpha`, `beta`, `rc`, or a custom name

The resulting version preview is shown in each option's label before you confirm. GitHub Releases created from a pre-release version are automatically marked as `prerelease` on GitHub.

### Wizard Back Navigation

The release wizard supports full back-navigation without cancelling:

```
Package selection
      ↕ (b key)
Commit selection (Step 2)
      ↕ (b key in bump screen)
Version bump (Step 3)
      ↕ (back option in tag messages)
Tag message review (Step 5)
      ↕ (back option)
← back to Package selection
```

### CLI Commands & Flags

```bash
# Show the main menu (default when no subcommand is given)
tagman [--lang <lang>]

# Start the release wizard directly
tagman release [options]
  --dry-run            Preview all version/tag changes without writing anything
  --json               Output a structured JSON result to stdout at the end
  --packages <names>   Comma-separated package names to release (skips selection prompt)
  --bump <type>        Global bump type: patch | minor | major (skips bump prompt)
  --yes                Skip all confirmations and auto-accept cascade versioning
  --push               Push commits and tags to remote without asking
  --lang <lang>        Interface language: es | en (default: es)

# Create GitHub releases from existing local tags
tagman github-release [options]
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

**JSON output** (for scripts and AI agents):
```bash
tagman release --packages my-lib --bump minor --yes --json
```

Output shape:
```json
{
  "success": true,
  "packages": [
    {
      "name": "my-lib",
      "previousVersion": "1.2.0",
      "newVersion": "1.3.0",
      "tag": "my-lib@1.3.0"
    }
  ]
}
```

### Use Cases

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

After tagging and pushing, tagman will create one GitHub Release per package and publish each to npm.

### GitHub token

tagman resolves the GitHub token from these sources, in priority order:

1. **`GITHUB_TOKEN` environment variable** — set it in your shell profile or CI environment
2. **`~/.npmrc`** — add `github_token=ghp_yourtoken` to your global npm config
3. **`.npmrc` in the project root** — same format, project-scoped
4. **`config.github.token`** in `tagman.config.json` — not recommended (risk of committing secrets to version control)

**Recommended setup** — add to your global `~/.npmrc`:
```
github_token=ghp_yourtoken
```

Or set the environment variable:
```bash
export GITHUB_TOKEN=ghp_yourtoken
```

The token needs the `repo` scope (or `public_repo` for public repositories) to create releases.

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

### Walkthroughs

#### Walkthrough 1: Standard monorepo release

You have a pnpm monorepo with two packages (`core` and `app`) and want to release `core` after some recent fixes.

```bash
tagman
```

1. The **main menu** appears. Select **Create release**.
2. tagman scans all packages. It finds 3 new commits in `core`.
3. **Step 1** — Package selection: check `core`, press Enter.
4. **Step 2** — Commit selection: all 3 commits are pre-selected. Deselect one with Space. Press `d` to toggle date/author. Press Enter.
5. **Step 3** — Bump: tagman suggests `minor` (you included a `feat:` commit). Accept.
6. tagman detects `app` depends on `core` and offers to cascade. Confirm.
7. **Step 5** — Tag messages: review auto-generated messages. Accept or edit.
8. Confirm execution. tagman writes `package.json`, `CHANGELOG.md`, commits, creates annotated tags.
9. Push to remote when prompted.

---

#### Walkthrough 2: Headless CI release

Your CI pipeline needs to release `my-lib` at patch level, push automatically, and output JSON for downstream steps:

```bash
tagman release --packages my-lib --bump patch --yes --push --json
```

No prompts. Output:
```json
{
  "success": true,
  "packages": [
    { "name": "my-lib", "previousVersion": "2.1.0", "newVersion": "2.1.1", "tag": "my-lib@2.1.1" }
  ]
}
```

---

#### Walkthrough 3: Tag exists, need GitHub release

You created a tag `my-lib@3.0.0` last week but forgot to publish the GitHub Release, or `github.createRelease` wasn't enabled at the time.

```bash
tagman
```

1. Select **GitHub release from existing tag** from the main menu.
2. tagman lists all local tags. Select `my-lib@3.0.0`.
3. tagman reads the tag annotation as the release body.
4. The GitHub Release is created. The URL is printed.

Or directly:
```bash
tagman github-release --lang en
```

---

#### Walkthrough 4: Cascade dependency release

You have `ui-kit` (dependency) and `web-app` (consumer). After releasing `ui-kit@2.0.0`:

1. Run `tagman release`, select `ui-kit`.
2. Pick commits, select `major` bump → new version `2.0.0`.
3. tagman detects `web-app` has `"ui-kit": "^1.x"` in its `package.json`.
4. It asks: *"ui-kit is a dependency of web-app. Do you want to also version web-app?"*
5. Confirm. tagman queues `web-app` for a patch bump (updating the dependency reference).
6. Both packages are committed and tagged in a single release commit.

---

### 🗺️ Roadmap

See [ROADMAP.md](./ROADMAP.md) for completed milestones and upcoming objectives.

---

<a name="español"></a>
## 🇪🇸 Español

## 🤖 Nota sobre el origen del proyecto

***tagman fue concebido y desarrollado principalmente a través de flujos de programación agéntica. Utilicé agentes de IA supervisados para materializar una solución a una necesidad recurrente que encontré en múltiples proyectos y que las herramientas de release convencionales no lograban cubrir de forma satisfactoria. Soy consciente de que los flujos de trabajo varían drásticamente entre equipos y que crear una herramienta universalmente flexible es un desafío monumental. Sin embargo, como parte de mi crecimiento profesional y mi apuesta por el futuro del desarrollo de software, mi objetivo es iterar tagman hasta alcanzar esa flexibilidad***

***PD: Y sí, este readme tambien lo escribió un agente***

**tagman** es una herramienta CLI interactiva construida en TypeScript, centrada en el desarrollador. Te otorga el poder de gestionar el versionado y el etiquetado (tagging) de forma granular dentro de monorepos (pnpm, npm, yarn, bun) y repositorios de paquete único estándar.

A diferencia de las herramientas de *semantic release* completamente automatizadas, **tagman** no ejecuta acciones destructivas ni irreversibles sin tu confirmación explícita. Tienes el control total para elegir qué commits entran en un release, qué dependencias internas actualizar en cascada y qué dirán exactamente tus tags de Git.

### Características
- **Menú Principal**: Ejecutar `tagman` sin argumentos muestra un menú para elegir entre crear un release o publicar un tag existente en GitHub Releases.
- **Detección Inteligente de Commits**: Identifica automáticamente qué paquetes tienen cambios pendientes desde su último tag de git (`nombre-paquete@version`).
- **Wizard Interactivo**: Una experiencia de terminal hermosa y limpia impulsada por `@clack/prompts`.
- **Selección Granular**: Selección múltiple de los commits exactos que deseas incluir en el lanzamiento de cada paquete.
- **Navegación Hacia Atrás en el Wizard**: Volvé a cualquier paso anterior sin abortar la operación — desde la selección de bump a los commits, desde los mensajes de tag a los paquetes, o desde la selección de commits (tecla `b`) al multiselect de paquetes.
- **Commits Fuera del Directorio del Paquete**: Incluí opcionalmente commits de fuera del directorio del paquete (Paso 2b). Útil para archivos compartidos importados dinámicamente por módulos sin interdependencia declarada.
- **Toggle de Detalle de Commits**: Presioná `d` mientras seleccionás commits para ver fecha y autor en línea; presioná de nuevo para ocultar.
- **Sugerencia de SemVer**: Evalúa los commits seleccionados bajo las reglas de *conventional commits* para sugerirte si necesitas un incremento `patch`, `minor` o `major`.
- **Opciones de Bump Flexibles**: Elegí `patch`, `minor`, `major`, `none` (solo tag sin modificar la versión) o `custom` (ingresá cualquier SemVer exacto).
- **Versionado en Cascada**: Escanea el grafo de dependencias de tu workspace. Si el `Paquete A` se actualiza, te ofrece actualizar automáticamente la `App B` que lo consume.
- **Checkpoints Inteligentes (Resiliencia)**: Si un proceso de release se interrumpe, `tagman` crea un punto de guardado local. Puedes retomar tu lanzamiento más tarde o usar la función de *rollback* interactivo para revertir de manera limpia los cambios en los archivos `package.json` y `CHANGELOG.md`.
- **GitHub Release desde Tag Existente**: Publicá un tag local ya creado en GitHub Releases sin necesitar commits nuevos — desde el menú principal o con `tagman github-release`.
- **GitHub Releases**: Crea automáticamente un GitHub Release por paquete tras el push.
- **Publicación en NPM**: Soporte nativo para publicar paquetes en el registro de npm tras el tagging.
- **Sistema de Plugins**: Extendé tagman con lógica personalizada mediante el hook `afterRelease`.
- **i18n**: Interfaz disponible en español e inglés (`--lang es|en`).

### Inicio Rápido

Puedes ejecutar `tagman` al vuelo sin instalarlo globalmente:

```bash
npx @fethabo/tagman
# o bien
pnpm dlx @fethabo/tagman
```

Ejecutar `tagman` sin argumentos abre el **menú principal** donde podés elegir:
- **Crear release** — el wizard completo: escanear commits → incrementar versión → crear tag de git + CHANGELOG
- **GitHub release desde tag existente** — publicar una versión ya tageada en GitHub Releases

Para ir directo al wizard de release:
```bash
npx @fethabo/tagman release
```

#### Instalar como dependencia de desarrollo

**pnpm workspace:**
```bash
pnpm add -Dw @fethabo/tagman
pnpm tagman
```

**npm (incluyendo monorepos con Rush u otras herramientas):**
```bash
npm install --save-dev @fethabo/tagman
npx tagman
```

**yarn:**
```bash
yarn add --dev @fethabo/tagman
yarn tagman
```

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

### Atajos de Teclado

Estos atajos están activos dentro del wizard interactivo:

| Tecla | Contexto | Acción |
|-------|----------|--------|
| `d` | Multiselect de commits | Activar/desactivar detalle de fecha y autor |
| `b` | Multiselect de commits | Volver a la selección de paquetes |
| `a` | Multiselect de commits | Seleccionar todos los commits |
| `n` | Multiselect de commits | Deseleccionar todos los commits |
| `Space` | Cualquier multiselect | Marcar/desmarcar elemento |
| `↑` / `↓` | Cualquier prompt | Navegar opciones |
| `Enter` | Cualquier prompt | Confirmar selección |
| `Ctrl+C` | En cualquier lugar | Cancelar y salir |

### Opciones de Bump

Al seleccionar el incremento de versión para un paquete, tagman ofrece:

| Opción | Descripción |
|--------|-------------|
| `patch` | `1.0.0 → 1.0.1` — correcciones y cambios menores |
| `minor` | `1.0.0 → 1.1.0` — nuevas funcionalidades, compatible hacia atrás |
| `major` | `1.0.0 → 2.0.0` — cambios que rompen compatibilidad |
| `pre-release ▸` | Abre un sub-flujo para crear versiones alpha/beta/rc |
| `none` | Mantiene la versión actual, solo crea el tag de git (no modifica `package.json`) |
| `custom` | Ingresá cualquier versión SemVer exacta (ej: `2.0.0-beta.1`) |

Si la versión actual ya es pre-release (ej: `2.0.0-alpha.1`), aparecen dos opciones adicionales:

| Opción | Descripción |
|--------|-------------|
| `incrementar contador` | `2.0.0-alpha.1 → 2.0.0-alpha.2` — incrementa el contador de pre-release |
| `graduar a estable` | `2.0.0-alpha.1 → 2.0.0` — elimina el identificador de pre-release |

tagman sugiere automáticamente el tipo de bump según los tipos de commits convencionales (`feat →` minor, `BREAKING CHANGE →` major, el resto → patch). Cuando la versión actual ya es pre-release, se sugiere "incrementar contador".

#### Sub-flujo de pre-release

Al seleccionar **pre-release ▸**, tagman muestra dos prompts adicionales:

1. **Tipo de bump base** — si el próximo estable sería patch, minor o major:
   - `prepatch` → `1.0.0-alpha.0`, `preminor` → `1.1.0-alpha.0`, `premajor` → `2.0.0-alpha.0`
2. **Canal** — `alpha`, `beta`, `rc`, o un nombre personalizado

El preview de la versión resultante se muestra en el label de cada opción antes de confirmar. Los GitHub Releases creados a partir de una versión pre-release se marcan automáticamente como `prerelease` en GitHub.

### Navegación Hacia Atrás en el Wizard

El wizard de release soporta navegación hacia atrás completa sin cancelar la operación:

```
Selección de paquetes
      ↕ (tecla b)
Selección de commits (Paso 2)
      ↕ (tecla b en pantalla de bump)
Selección de bump (Paso 3)
      ↕ (opción "volver" en mensajes de tag)
Revisión de mensajes de tag (Paso 5)
      ↕ (opción "volver")
← de vuelta a Selección de paquetes
```

### Comandos y Flags de CLI

```bash
# Mostrar el menú principal (comportamiento por defecto sin subcomando)
tagman [--lang <lang>]

# Iniciar el wizard de release directamente
tagman release [opciones]
  --dry-run            Previsualiza versiones y tags sin escribir nada
  --json               Emite un JSON estructurado al finalizar (útil para scripts y agentes)
  --packages <names>   Paquetes a lanzar separados por coma (omite el prompt de selección)
  --bump <type>        Tipo de bump global: patch | minor | major (omite el prompt de bump)
  --yes                Omite todas las confirmaciones y acepta cascada automáticamente
  --push               Hace push al remoto sin preguntar
  --lang <lang>        Idioma de la interfaz: es | en (default: es)

# Crear GitHub releases desde tags locales existentes
tagman github-release [opciones]
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

**Salida JSON** (para scripts y agentes de IA):
```bash
tagman release --packages my-lib --bump minor --yes --json
```

Formato de salida:
```json
{
  "success": true,
  "packages": [
    {
      "name": "my-lib",
      "previousVersion": "1.2.0",
      "newVersion": "1.3.0",
      "tag": "my-lib@1.3.0"
    }
  ]
}
```

### Casos de Uso

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

Después del tagging y el push, tagman creará un GitHub Release por paquete y publicará cada uno en npm.

### Token de GitHub

tagman resuelve el token de GitHub desde estas fuentes, en orden de prioridad:

1. **Variable de entorno `GITHUB_TOKEN`** — configurala en tu perfil de shell o en el entorno de CI
2. **`~/.npmrc`** — agregá `github_token=ghp_tutoken` al config global de npm
3. **`.npmrc` en la raíz del proyecto** — mismo formato, alcance del proyecto
4. **`config.github.token`** en `tagman.config.json` — no recomendado (riesgo de commitear secretos al repositorio)

**Configuración recomendada** — agregá a tu `~/.npmrc` global:
```
github_token=ghp_tutoken
```

O configurá la variable de entorno:
```bash
export GITHUB_TOKEN=ghp_tutoken
```

El token necesita el scope `repo` (o `public_repo` para repositorios públicos) para crear releases.

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

### Guías Paso a Paso

#### Guía 1: Release estándar en un monorepo

Tenés un monorepo pnpm con dos paquetes (`core` y `app`) y querés lanzar `core` tras algunas correcciones recientes.

```bash
tagman
```

1. Aparece el **menú principal**. Seleccioná **Crear release**.
2. tagman escanea todos los paquetes. Encuentra 3 commits nuevos en `core`.
3. **Paso 1** — Selección de paquetes: marcá `core`, presioná Enter.
4. **Paso 2** — Selección de commits: los 3 commits están preseleccionados. Desmarcá uno con Space. Presioná `d` para ver fecha/autor. Presioná Enter.
5. **Paso 3** — Bump: tagman sugiere `minor` (incluiste un commit `feat:`). Aceptá.
6. tagman detecta que `app` depende de `core` y ofrece el versionado en cascada. Confirmá.
7. **Paso 5** — Mensajes de tag: revisá los mensajes autogenerados. Aceptá o editá.
8. Confirmá la ejecución. tagman escribe `package.json`, `CHANGELOG.md`, hace el commit y crea los tags anotados.
9. Hacé push al remoto cuando se te pregunte.

---

#### Guía 2: Release headless en CI

Tu pipeline de CI necesita lanzar `my-lib` con bump patch, hacer push automáticamente y emitir JSON para pasos posteriores:

```bash
tagman release --packages my-lib --bump patch --yes --push --json
```

Sin prompts. Salida:
```json
{
  "success": true,
  "packages": [
    { "name": "my-lib", "previousVersion": "2.1.0", "newVersion": "2.1.1", "tag": "my-lib@2.1.1" }
  ]
}
```

---

#### Guía 3: El tag existe, falta el GitHub Release

Creaste el tag `my-lib@3.0.0` la semana pasada pero olvidaste publicar el GitHub Release, o `github.createRelease` no estaba habilitado en ese momento.

```bash
tagman
```

1. Seleccioná **GitHub release desde tag existente** en el menú principal.
2. tagman lista todos los tags locales. Seleccioná `my-lib@3.0.0`.
3. tagman lee la anotación del tag como cuerpo del release.
4. Se crea el GitHub Release. Se imprime la URL.

O directamente:
```bash
tagman github-release
```

---

#### Guía 4: Release con versionado en cascada

Tenés `ui-kit` (dependencia) y `web-app` (consumidor). Tras lanzar `ui-kit@2.0.0`:

1. Ejecutá `tagman release`, seleccioná `ui-kit`.
2. Elegí commits, seleccioná bump `major` → nueva versión `2.0.0`.
3. tagman detecta que `web-app` tiene `"ui-kit": "^1.x"` en su `package.json`.
4. Pregunta: *"ui-kit es dependencia de web-app. ¿Deseas versionar también web-app?"*
5. Confirmá. tagman encola `web-app` para un bump patch (actualizando la referencia de dependencia).
6. Ambos paquetes se commitean y taguean en un único commit de release.

---

### 🗺️ Hoja de Ruta (Roadmap)

Ver [ROADMAP.md](./ROADMAP.md) para los hitos completados y los próximos objetivos.
