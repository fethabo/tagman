import * as p from "@clack/prompts";
import { MultiSelectPrompt, wrapTextWithPrefix } from "@clack/core";
import color from "picocolors";

export type CommitOpt = { value: string; label: string };

/**
 * Interactive multiselect for commits.
 * "Select All" and "Deselect All" update the selection in real-time without
 * reopening the prompt — achieved by subscribing a cursor event handler on the
 * MultiSelectPrompt instance after construction (fires after the built-in
 * toggleValue handler, then corrects this.value for the two control items).
 */
export async function commitMultiSelect(
  message: string,
  options: CommitOpt[],
  initialValues: string[]
): Promise<string[] | symbol> {
  const SELECT_ALL = '__tagman_select_all__';
  const DESELECT_ALL = '__tagman_deselect_all__';
  const commitValues = options.map(o => o.value);

  const allOptions: CommitOpt[] = [
    { value: SELECT_ALL,   label: `${color.green('◆')} Select All`   },
    { value: DESELECT_ALL, label: `${color.yellow('◇')} Deselect All` },
    ...options,
  ];

  const styleOpt = (opt: CommitOpt, isActive: boolean, val: string[]) => {
    const label = opt.label;
    const selected = val.includes(opt.value);
    if (isActive && selected) return `${color.green(p.S_CHECKBOX_SELECTED)} ${label}`;
    if (selected)             return `${color.dim(p.S_CHECKBOX_SELECTED)} ${color.dim(label)}`;
    if (isActive)             return `${color.cyan(p.S_CHECKBOX_ACTIVE)} ${label}`;
    return                        `${color.dim(p.S_CHECKBOX_INACTIVE)} ${color.dim(label)}`;
  };

  const prompt = new MultiSelectPrompt<CommitOpt>({
    options: allOptions,
    initialValues,
    validate(value) {
      const real = (value ?? []).filter(v => v !== SELECT_ALL && v !== DESELECT_ALL);
      if (real.length === 0) return 'Select at least one commit.';
    },
    render() {
      const val: string[]  = (this as any).value ?? [];
      const cursor: number = (this as any).cursor;
      const bar    = `${color.cyan(p.S_BAR)}  `;
      const msgLine = wrapTextWithPrefix(
        process.stdout,
        message,
        `${p.symbolBar(this.state)}  `,
        `${p.symbol(this.state)}  `
      );
      const header   = `${color.gray(p.S_BAR)}  ${msgLine}\n`;
      const style    = (opt: CommitOpt, active: boolean) => styleOpt(opt, active, val);
      const rowCount = header.split('\n').length;

      switch (this.state) {
        case 'submit': {
          const chosen = allOptions
            .filter(o => val.includes(o.value))
            .map(o => color.dim(o.label))
            .join(color.dim(', ')) || color.dim('none');
          return `${header}${color.gray(p.S_BAR)}  ${chosen}\n`;
        }
        case 'cancel':
          return `${header}${color.gray(p.S_BAR)}\n`;
        case 'error': {
          const eBar  = `${color.yellow(p.S_BAR)}  `;
          const items = p.limitOptions({ cursor, options: allOptions, columnPadding: eBar.length, rowPadding: rowCount + 3, style });
          return `${header}${eBar}${items.join(`\n${eBar}`)}\n${color.yellow(p.S_BAR_END)}  ${color.yellow(this.error)}\n`;
        }
        default: {
          const items = p.limitOptions({ cursor, options: allOptions, columnPadding: bar.length, rowPadding: rowCount + 2, style });
          return `${header}${bar}${items.join(`\n${bar}`)}\n${color.cyan(p.S_BAR_END)}\n`;
        }
      }
    },
  });

  // Add our cursor event listener AFTER construction so it fires after the
  // built-in handler (which calls toggleValue). We then correct this.value for
  // the two control items so they never appear in the final selection.
  (prompt as any).on('cursor', (action: string) => {
    if (action !== 'space') return;
    const cursor: number = (prompt as any).cursor;
    const current = allOptions[cursor]?.value;
    if (current === SELECT_ALL) {
      (prompt as any).value = commitValues.slice();
    } else if (current === DESELECT_ALL) {
      (prompt as any).value = [];
    } else {
      (prompt as any).value = ((prompt as any).value ?? []).filter(
        (v: string) => v !== SELECT_ALL && v !== DESELECT_ALL
      );
    }
  });

  const result = await (prompt as any).prompt();
  if (p.isCancel(result)) return result;
  return (result as string[]).filter(v => v !== SELECT_ALL && v !== DESELECT_ALL);
}
