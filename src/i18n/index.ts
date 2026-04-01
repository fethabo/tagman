import { en, type TranslationKey } from "./locales/en.js";
import { es } from "./locales/es.js";

export type { TranslationKey };
export type Locale = "en" | "es";

const locales: Record<Locale, Record<TranslationKey, string>> = { en, es };

let currentLocale: Locale = "en";

/**
 * Initialise the i18n module with the desired locale.
 * Must be called once after the config is loaded.
 */
export function initI18n(locale: Locale): void {
  currentLocale = locale;
}

/**
 * Returns the translation for `key` in the current locale,
 * falling back to English when the key is not found.
 *
 * Dynamic values are substituted using `{varName}` placeholders.
 *
 * @example
 *   t("scannedPackages", { total: "5", found: "2" })
 */
export function t(key: TranslationKey, vars?: Record<string, string>): string {
  const translations = locales[currentLocale] ?? locales.en;
  let str: string = translations[key] ?? (locales.en[key] as string) ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }

  return str;
}
