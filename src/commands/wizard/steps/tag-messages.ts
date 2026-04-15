import * as p from "@clack/prompts";
import color from "picocolors";
import type { ReleaseState } from "../../../core/checkpoint.js";
import { wizardSelect, SELECT_BACK } from "../wizard-select.js";
import { t } from "../../../i18n/index.js";

export async function promptTagMessages(
  state: Map<string, ReleaseState>
): Promise<boolean | "back"> {
  for (const [pkgName, details] of state.entries()) {
    const createTag = await p.confirm({
      message: t().tagMessages.createTagQuestion(color.cyan(pkgName), color.green(details.newVersion)),
      initialValue: true,
    });

    if (p.isCancel(createTag)) {
      p.cancel(t().tagMessages.cancelled);
      return false;
    }

    if (createTag) {
      p.note(details.tagMessage, `${t().tagMessages.autoGenLabel} ${pkgName}`);

      let redoAction = false;
      do {
        redoAction = false;

        const msgAction = await wizardSelect(
          t().tagMessages.actionSelect,
          [
            { value: "auto",   label: t().tagMessages.useAuto },
            { value: "append", label: t().tagMessages.appendText },
            { value: "custom", label: t().tagMessages.writeCustom },
          ],
          undefined,
          t().tagMessages.goBack,
        );

        if (msgAction === SELECT_BACK) return "back";

        if (p.isCancel(msgAction)) {
          p.cancel(t().tagMessages.cancelled);
          return false;
        }

        if (msgAction === "auto") {
          state.get(pkgName)!.tagMessage = details.tagMessage;
        } else if (msgAction === "append") {
          const appendedMsg = await p.text({
            message: `${t().tagMessages.appendInput}  ${color.dim(t().tagMessages.cancelToBack)}`,
          });
          if (p.isCancel(appendedMsg)) {
            redoAction = true;
            continue;
          }

          const position = await wizardSelect(
            t().tagMessages.insertPosition,
            [
              { value: "before", label: t().tagMessages.insertBefore },
              { value: "after",  label: t().tagMessages.insertAfter },
            ],
            undefined,
            t().tagMessages.goBackToAction,
          );

          if (position === SELECT_BACK) {
            redoAction = true;
            continue;
          }

          if (p.isCancel(position)) {
            p.cancel(t().tagMessages.cancelled);
            return false;
          }

          if (position === "before") {
            state.get(pkgName)!.tagMessage = details.tagMessage.replace("\n\n", `\n\n${appendedMsg as string}\n\n`);
          } else {
            state.get(pkgName)!.tagMessage = details.tagMessage + "\n\n" + (appendedMsg as string);
          }
        } else if (msgAction === "custom") {
          const customMsg = await p.text({
            message: `${t().tagMessages.customInput}  ${color.dim(t().tagMessages.cancelToBack)}`,
          });
          if (p.isCancel(customMsg)) {
            redoAction = true;
            continue;
          }
          state.get(pkgName)!.tagMessage = customMsg as string;
        }
      } while (redoAction);
    } else {
      state.get(pkgName)!.tagMessage = ""; // Empty string implies no tag
    }
  }

  return true;
}
