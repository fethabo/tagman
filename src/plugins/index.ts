import path from "node:path";

export interface ReleaseResult {
  packages: Array<{
    name: string;
    previousVersion: string;
    newVersion: string;
    tag: string;
  }>;
}

export interface TagmanPlugin {
  afterRelease?: (result: ReleaseResult) => Promise<void>;
}

export async function runAfterRelease(pluginPaths: string[], result: ReleaseResult): Promise<void> {
  for (const pluginPath of pluginPaths) {
    try {
      const resolved = path.resolve(process.cwd(), pluginPath);
      const mod = await import(resolved);
      const plugin: TagmanPlugin = mod.default ?? mod;
      if (typeof plugin.afterRelease === "function") {
        await plugin.afterRelease(result);
      }
    } catch (e: any) {
      console.warn(`[tagman] Plugin ${pluginPath} afterRelease falló: ${e.message}`);
    }
  }
}
