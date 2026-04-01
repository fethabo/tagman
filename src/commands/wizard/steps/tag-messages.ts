import * as p from "@clack/prompts";
import color from "picocolors";
import type { ReleaseState } from "../../../core/checkpoint.js";

export async function promptTagMessages(
  state: Map<string, ReleaseState>
): Promise<boolean> {
  for (const [pkgName, details] of state.entries()) {
    const createTag = await p.confirm({
      message: `¿Crear tag de Git para ${color.cyan(pkgName)}@${color.green(details.newVersion)}?`,
      initialValue: true,
    });

    if (p.isCancel(createTag)) {
      p.cancel("Operation cancelled.");
      return false;
    }

    if (createTag) {
      p.note(details.tagMessage, `Mensaje autogenerado para ${pkgName}`);

      const msgAction = await p.select({
        message: "¿Qué mensaje deseas usar para el tag?",
        options: [
          { value: "auto",   label: "Usar el mensaje autogenerado" },
          { value: "append", label: "Agregar texto adicional al autogenerado" },
          { value: "custom", label: "Escribir un mensaje completamente nuevo" },
        ],
      });

      if (p.isCancel(msgAction)) {
        p.cancel("Operation cancelled.");
        return false;
      }

      if (msgAction === "auto") {
        state.get(pkgName)!.tagMessage = details.tagMessage;
      } else if (msgAction === "append") {
        const appendedMsg = await p.text({ message: "Texto adicional:" });
        if (p.isCancel(appendedMsg)) {
          p.cancel("Operation cancelled.");
          return false;
        }

        const position = await p.select({
          message: "¿Dónde deseas insertar este texto?",
          options: [
            { value: "before", label: "Antes del listado de commits" },
            { value: "after",  label: "Al final del mensaje" },
          ],
        });

        if (p.isCancel(position)) {
          p.cancel("Operation cancelled.");
          return false;
        }

        if (position === "before") {
          state.get(pkgName)!.tagMessage = details.tagMessage.replace("\n\n", `\n\n${appendedMsg as string}\n\n`);
        } else {
          state.get(pkgName)!.tagMessage = details.tagMessage + "\n\n" + (appendedMsg as string);
        }
      } else if (msgAction === "custom") {
        const customMsg = await p.text({ message: "Nuevo mensaje para el tag:" });
        if (p.isCancel(customMsg)) {
          p.cancel("Operation cancelled.");
          return false;
        }
        state.get(pkgName)!.tagMessage = customMsg as string;
      }
    } else {
      state.get(pkgName)!.tagMessage = ""; // Empty string implies no tag
    }
  }

  return true;
}
