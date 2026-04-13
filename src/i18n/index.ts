import type { Messages } from "./types.js";
import { es } from "./es.js";
import { en } from "./en.js";

export type Locale = "es" | "en";

const locales: Record<Locale, Messages> = { es, en };
let current: Locale = "es";

export function setLocale(locale: Locale): void {
  current = locale;
}

export function t(): Messages {
  return locales[current];
}
