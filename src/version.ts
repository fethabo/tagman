import { readFile } from 'node:fs/promises';

const pkgPath = new URL('../package.json', import.meta.url);
const pkgContent = await readFile(pkgPath, 'utf-8');
const { version } = JSON.parse(pkgContent);

export const VERSION = version;