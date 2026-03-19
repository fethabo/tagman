import fs from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";
import { packageJsonSchema, pnpmWorkspaceSchema, PackageJson, PnpmWorkspace } from "../schemas/index.js";

export async function readJson<T>(filePath: string, schema?: { parse: (val: unknown) => T }): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(content);
  return schema ? schema.parse(parsed) : parsed;
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function readYaml<T>(filePath: string, schema?: { parse: (val: unknown) => T }): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = yaml.parse(content);
  return schema ? schema.parse(parsed) : parsed;
}

export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, yaml.stringify(data), "utf-8");
}

export async function appendToFile(filePath: string, content: string): Promise<void> {
  await fs.appendFile(filePath, content, "utf-8");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
