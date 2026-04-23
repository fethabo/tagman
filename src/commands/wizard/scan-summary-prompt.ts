import { SelectPrompt, wrapTextWithPrefix } from "@clack/core";
import * as p from "@clack/prompts";
import color from "picocolors";
import { t } from "../../i18n/index.js";
import type { ReleaseState } from "../../core/checkpoint.js";

export async function showScanSummaryPrompt(
  state: Map<string, ReleaseState>,
): Promise<"proceed" | "save" | "back" | symbol> {
  let showDetails = false;

  const options = [
    { value: "proceed" as const, label: t().draft.proceed },
    { value: "save"    as const, label: t().draft.save    },
    { value: "back"    as const, label: t().draft.goBack  },
  ];

  const prompt = new SelectPrompt<{ value: "proceed" | "save" | "back"; label: string }>({
    options,
    initialValue: "proceed",
    render() {
      const cursor: number = (this as any).cursor;
      const bar  = `${color.cyan(p.S_BAR)}  `;
      const gBar = `${color.gray(p.S_BAR)}  `;

      const summaryLines = Array.from(state.entries())
        .map(([name, d]) => {
          const base = `${gBar}${name}: ${d.pkg.manifest.version} → ${d.newVersion}  (${d.commits.length} commit(s))`;
          if (!showDetails || d.commits.length === 0) return base;
          const commitLines = d.commits
            .map(c => `${gBar}  ${c.hash.slice(0, 7)} ${c.message}`)
            .join("\n");
          return `${base}\n${commitLines}`;
        })
        .join("\n");

      const msgLine = wrapTextWithPrefix(
        process.stdout,
        t().draft.actionQuestion,
        `${p.symbolBar(this.state)}  `,
        `${p.symbol(this.state)}  `,
      );
      const header = `${color.gray(p.S_BAR)}\n${gBar}${color.bold(t().draft.summaryTitle)}\n${summaryLines}\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  ${msgLine}\n`;
      const rowCount = header.split("\n").length;

      const style = (opt: { value: string; label: string }, active: boolean) => {
        if (active) return `${color.green(p.S_RADIO_ACTIVE)} ${opt.label}`;
        return `${color.dim(p.S_RADIO_INACTIVE)} ${color.dim(opt.label)}`;
      };

      switch (this.state) {
        case "submit": {
          const val = (this as any).value;
          const chosen = options.find(o => o.value === val);
          return `${header}${color.gray(p.S_BAR)}  ${color.dim(chosen?.label ?? "")}\n`;
        }
        case "cancel":
          return `${header}${color.gray(p.S_BAR)}\n`;
        default: {
          const items = p.limitOptions({ cursor, options, columnPadding: bar.length, rowPadding: rowCount + 3, style });
          const sep = `  ${color.dim("·")}  `;
          const detailsHint = showDetails ? t().draft.detailsHide : t().draft.detailsShow;
          const hintLine = [
            `${color.dim("[↑↓]")} ${color.dim(t().scan.navUpDown)}`,
            `${color.dim("[enter]")} ${color.dim(t().scan.navConfirm)}`,
            `${color.dim("[d]")} ${color.dim(detailsHint)}`,
          ].join(sep);
          return `${header}${bar}${items.join(`\n${bar}`)}\n${bar}${hintLine}\n${color.cyan(p.S_BAR_END)}\n`;
        }
      }
    },
  });

  (prompt as any).on("key", (char: string) => {
    if (char === "d") {
      showDetails = !showDetails;
    }
  });

  const result = await (prompt as any).prompt();
  if (p.isCancel(result)) return result as symbol;
  return result as "proceed" | "save" | "back";
}
