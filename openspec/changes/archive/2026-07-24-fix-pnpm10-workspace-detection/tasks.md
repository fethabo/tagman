## 1. Claves i18n

- [x] 1.1 Agregar a `src/i18n/types.ts` una sección `workspace` con `undeclaredPackages: (filePath: string) => string` e `invalidPackageJson: (filePath: string) => string`
- [x] 1.2 Agregar a `src/i18n/types.ts` una sección `schemaError` con `header: (filePath: string) => string`
- [x] 1.3 Implementar las tres claves en `src/i18n/es.ts` (locale por defecto)
- [x] 1.4 Implementar las tres claves en `src/i18n/en.ts`

## 2. Helper de formateo de errores de schema

- [x] 2.1 Crear `src/utils/schema-error.ts` que exporte `formatSchemaError(filePath: string, error: ZodError): string`, importando `t()` desde `../i18n/index.js` y el tipo `ZodError` desde `zod` con `import type`
- [x] 2.2 Implementar el cuerpo: encabezado `t().schemaError.header(filePath)` y una línea por issue con `<issue.path unido por "."> : <issue.message>`, usando `(raíz)` cuando `issue.path` está vacío
      - Desvío: `(raíz)` es texto de cara al usuario, así que se agregó la clave i18n `schemaError.rootField` (`(raíz)` / `(root)`) en vez de hardcodearlo
- [x] 2.3 Verificar que `src/utils/index.ts` NO re-exporte este módulo, para no arrastrar `i18n` al barrel de I/O

## 3. Schema de pnpm-workspace.yaml

- [x] 3.1 En `src/schemas/index.ts`, cambiar `pnpmWorkspaceSchema` a `packages: z.array(z.string()).optional()` y agregar `.passthrough()`
- [x] 3.2 Verificar que el tipo `PnpmWorkspace` inferido sigue compilando en sus consumidores (`pnpm build`)

## 4. Detección de workspace

- [x] 4.1 En `src/core/workspace.ts`, extraer el bloque de resolución del paquete de la raíz (hoy en `:46-57`) a un helper interno `resolveRootPackage(rootDir)` que devuelva `WorkspacePackage[]` o lance el error accionable existente
- [x] 4.2 Reemplazar la rama "yaml ausente" para que llame a `resolveRootPackage(rootDir)`, preservando el mensaje de error actual cuando tampoco hay `package.json`
- [x] 4.3 Cambiar la lectura del yaml (`:59`) a `safeParse`; si falla, lanzar `new Error(formatSchemaError(workspaceYamlPath, result.error))`
      - Añadido: un yaml vacío parsea a `null`, así que se normaliza a `{}` (`?? {}`) para que degrade como solo-settings en vez de fallar la validación
- [x] 4.4 Cuando el parseo tiene éxito pero `packages` es `undefined` o un array vacío, emitir `p.log.warn(t().workspace.undeclaredPackages(workspaceYamlPath))` y devolver `resolveRootPackage(rootDir)`
- [x] 4.5 Reemplazar el `catch` mudo con `console.warn` en inglés de `resolvePackagesFromGlobs` (`:23-28`) por `safeParse` del `packageJsonSchema` + `p.log.warn(formatSchemaError(pkgJsonPath, error))`, conservando el salto de ese paquete
- [x] 4.6 Mantener un `try/catch` alrededor de la lectura del `package.json` por paquete para errores que no son de schema (fallo de `JSON.parse` o de I/O), emitiendo `p.log.warn(t().workspace.invalidPackageJson(pkgJsonPath))`
- [x] 4.7 Agregar el import de `@clack/prompts` en `src/core/workspace.ts` siguiendo el estilo de `src/config.ts` (`import * as p from "@clack/prompts"`)

## 5. Formateo en loadConfig

- [x] 5.1 En `src/config.ts:50`, reemplazar `result.error.message` por `formatSchemaError(configPath, result.error)` en el `p.log.warn` de config inválida

## 6. Verificación

- [x] 6.1 Correr `pnpm build` y confirmar que compila sin errores de TypeScript
      - `pnpm build` OK. `npx tsc --noEmit` reporta 2 errores preexistentes en `src/commands/github-release.ts:103,139` (comparación string vs `unique symbol`), archivo no tocado por este cambio y sin modificar en git. Ningún archivo de este cambio tiene errores.
- [x] 6.2 Correr `npx eslint` sobre los archivos modificados si el proyecto tiene ESLint configurado; si no lo tiene, omitir y anotarlo
      - Omitido: el proyecto no tiene ESLint configurado (sin `.eslintrc*`, sin `eslint.config.*`, sin `eslintConfig` en `package.json`)
- [x] 6.3 Verificar el caso principal en este repo: `pnpm dev release` ya no lanza `ZodError`, muestra el aviso de workspace no declarado y lista `@fethabo/tagman` como único paquete
      - Verificado invocando `getWorkspacePackages` sobre este repo: aviso emitido + `@fethabo/tagman@1.4.6` resuelto como paquete único, sin `ZodError`
- [x] 6.4 Verificar con un fixture temporal fuera del repo: monorepo con `packages: ["packages/*"]` sigue resolviendo todos los paquetes y NO emite el aviso
- [x] 6.5 Verificar con un fixture temporal: `packages: []` degrada al paquete de la raíz y emite el aviso
- [x] 6.6 Verificar con un fixture temporal: `packages: "packages/*"` (string en vez de array) produce un mensaje que nombra `pnpm-workspace.yaml` y lista `packages:` como campo inválido, sin volcado JSON
- [x] 6.7 Verificar con un fixture temporal: yaml solo-settings sin `package.json` en la raíz produce el error accionable de "no se encontró workspace ni package.json válido"
      - Nota: el aviso de degradado se emite antes del error, porque el degradado se intenta y recién ahí falla. Es informativo (explica por qué se buscó un `package.json` en la raíz), no engañoso.
- [x] 6.8 Verificar con un fixture temporal: un paquete del workspace con `package.json` inválido se omite con aviso traducido y el descubrimiento continúa con los demás
      - Cubiertos los dos sub-casos: schema inválido (`formatSchemaError` con `name` y `version`) y JSON malformado (`workspace.invalidPackageJson`)
- [x] 6.9 Verificar que `tagman.config.json` con `packagesRoutes` sigue teniendo precedencia y no emite el aviso de workspace no declarado
- [x] 6.10 Verificar que un `tagman.config.json` inválido produce el aviso con ruta de archivo y campos, y que el flujo continúa con los defaults
      - También cubrió el escenario `(raíz)` del spec: `Unrecognized key: "unknownKey"` tiene `path` vacío
- [x] 6.11 Verificar el mensaje en locale `en` con `--lang en` para al menos el aviso de workspace no declarado y el encabezado de error de schema

## 7. Cobertura extra descubierta durante la verificación

- [x] 7.1 Normalizar un `pnpm-workspace.yaml` vacío (que el parser YAML devuelve como `null`) a `{}`, para que degrade como solo-settings en vez de fallar la validación de schema
- [x] 7.2 Aplicar `formatSchemaError` también al fallo de schema del `package.json` de la raíz en `resolveRootPackage`, que reportaba en inglés fijo y violaba el requisito de "ningún sitio de fallo de schema con texto en idioma fijo"
- [x] 7.3 Verificar ambos caminos del `package.json` de la raíz: schema inválido nombra archivo y campo; JSON malformado conserva el error de parseo preexistente
