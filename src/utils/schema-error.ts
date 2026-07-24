import type { ZodError } from "zod";
import { t } from "../i18n/index.js";

/**
 * Formats a Zod validation failure as readable text attributed to a file.
 *
 * Zod v4's `ZodError.message` is the JSON-serialized issue array, which is
 * unreadable for a CLI user and never names the offending file. This produces a
 * translated header plus one `field: message` line per issue instead.
 */
export function formatSchemaError(filePath: string, error: ZodError): string {
  const lines = error.issues.map(issue => {
    const field = issue.path.length > 0 ? issue.path.join(".") : t().schemaError.rootField;
    return `  ${field}: ${issue.message}`;
  });
  return [t().schemaError.header(filePath), ...lines].join("\n");
}
