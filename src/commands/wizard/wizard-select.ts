import { SelectPrompt, wrapTextWithPrefix } from "@clack/core";
import * as p from "@clack/prompts";
import color from "picocolors";

export type SelectOpt<T> = { value: T; label: string; hint?: string };

export const SELECT_BACK = Symbol('selectBack');

const BACK_SENTINEL = '__tagman_back__';

/**
 * Interactive select with an optional [b] go-back keyboard shortcut.
 *
 * The list contains only real options. The go-back control is a keyboard
 * shortcut shown in a hint line at the bottom:
 *
 *   b  — go back (only when backLabel is provided)
 *
 * Parameters:
 *   backLabel — when set, enables the [b] shortcut and shows it in the hint line
 */
export async function wizardSelect<T>(
  message: string,
  options: SelectOpt<T>[],
  initialValue?: T,
  backLabel?: string,
): Promise<T | symbol | typeof SELECT_BACK> {
  const prompt = new SelectPrompt<SelectOpt<T>>({
    options,
    initialValue,
    render() {
      const cursor: number = (this as any).cursor;
      const bar    = `${color.cyan(p.S_BAR)}  `;
      const msgLine = wrapTextWithPrefix(
        process.stdout,
        message,
        `${p.symbolBar(this.state)}  `,
        `${p.symbol(this.state)}  `,
      );
      const header   = `${color.gray(p.S_BAR)}  ${msgLine}\n`;
      const rowCount = header.split('\n').length;

      const style = (opt: SelectOpt<T>, active: boolean) => {
        const txt = opt.hint
          ? `${opt.label}  ${color.dim(`(${opt.hint})`)}`
          : opt.label;
        if (active) return `${color.green(p.S_RADIO_ACTIVE)} ${txt}`;
        return `${color.dim(p.S_RADIO_INACTIVE)} ${color.dim(txt)}`;
      };

      switch (this.state) {
        case 'submit': {
          const val = (this as any).value;
          if (val === BACK_SENTINEL) return `${header}${color.gray(p.S_BAR)}\n`;
          const chosen = options[cursor];
          return `${header}${color.gray(p.S_BAR)}  ${color.dim(chosen?.label ?? '')}\n`;
        }
        case 'cancel':
          return `${header}${color.gray(p.S_BAR)}\n`;
        default: {
          const items = p.limitOptions({ cursor, options, columnPadding: bar.length, rowPadding: rowCount + 3, style });
          const hint     = backLabel !== undefined
            ? `${color.dim('[b]')} ${color.dim(backLabel)}`
            : '';
          const hintLine = hint ? `\n${bar}${hint}` : '';
          return `${header}${bar}${items.join(`\n${bar}`)}\n${bar}${hintLine}\n${color.cyan(p.S_BAR_END)}\n`;
        }
      }
    },
  });

  (prompt as any).on('key', (char: string) => {
    if (char === 'b' && backLabel !== undefined) {
      (prompt as any).value = BACK_SENTINEL;
      (prompt as any).state = 'submit';
      (prompt as any).close();
    }
  });

  const result = await (prompt as any).prompt();
  if (result === BACK_SENTINEL) return SELECT_BACK;
  if (p.isCancel(result)) return result as symbol;
  return result as T;
}
