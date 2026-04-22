import * as p from "@clack/prompts";
import color from "picocolors";
import type { ReleaseState } from "../../../core/checkpoint.js";
import { wizardSelect, SELECT_BACK } from "../wizard-select.js";
import { t } from "../../../i18n/index.js";

export async function promptTagMessages(
  state: Map<string, ReleaseState>
): Promise<boolean | "back"> {
  // Capture originals before any mutation so back-navigation can restore them
  const originalTagMessages = new Map<string, string>(
    Array.from(state.entries()).map(([name, d]) => [name, d.tagMessage])
  );
  const entries = Array.from(state.entries());
  let i = 0;

  while (i < entries.length) {
    const [pkgName] = entries[i];
    const details = state.get(pkgName)!;

    // Always reset to original when (re-)entering this package's step
    details.tagMessage = originalTagMessages.get(pkgName)!;

    let goToPrevious = false;
    let backToTagQ = false;

    do {
      backToTagQ = false;

      const createTagResult = await wizardSelect(
        t().tagMessages.createTagQuestion(color.cyan(pkgName), color.green(details.newVersion)),
        [
          { value: "yes", label: t().tagMessages.createTagYes },
          { value: "no",  label: t().tagMessages.createTagNo },
        ],
        "yes",
        i === 0 ? t().tagMessages.goBack : t().tagMessages.goBackToPrevious,
      );

      if (createTagResult === SELECT_BACK) {
        if (i === 0) return "back";
        // Restore the previous package to its original tagMessage and go back to it
        const prevName = entries[i - 1][0];
        state.get(prevName)!.tagMessage = originalTagMessages.get(prevName)!;
        i--;
        goToPrevious = true;
        break;
      }

      if (p.isCancel(createTagResult)) {
        p.cancel(t().tagMessages.cancelled);
        return false;
      }

      if (createTagResult === "yes") {
        const originalMsg = originalTagMessages.get(pkgName)!;
        p.note(originalMsg, `${t().tagMessages.autoGenLabel} ${pkgName}`);

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

          if (msgAction === SELECT_BACK) {
            // Go back to the "create tag?" question for this same package
            backToTagQ = true;
            break;
          }

          if (p.isCancel(msgAction)) {
            p.cancel(t().tagMessages.cancelled);
            return false;
          }

          if (msgAction === "auto") {
            details.tagMessage = originalMsg;
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
              details.tagMessage = originalMsg.replace("\n\n", `\n\n${appendedMsg as string}\n\n`);
            } else {
              details.tagMessage = originalMsg + "\n\n" + (appendedMsg as string);
            }
          } else if (msgAction === "custom") {
            const customMsg = await p.text({
              message: `${t().tagMessages.customInput}  ${color.dim(t().tagMessages.cancelToBack)}`,
            });
            if (p.isCancel(customMsg)) {
              redoAction = true;
              continue;
            }
            details.tagMessage = customMsg as string;
          }
        } while (redoAction);
      } else {
        details.tagMessage = "";
      }

    } while (backToTagQ);

    if (goToPrevious) continue; // outer while re-runs with decremented i, no increment
    i++;
  }

  return true;
}
