import * as p from "@clack/prompts";
import { MultiSelectPrompt, wrapTextWithPrefix } from "@clack/core";
import color from "picocolors";

export type CommitOpt = { value: string; label: string };

export const COMMIT_BACK = Symbol('commitSelectBack');

/**
 * Interactive multiselect for commits.
 * "Select All" and "Deselect All" update the selection in real-time without
 * reopening the prompt — achieved by subscribing a cursor event handler on the
 * MultiSelectPrompt instance after construction (fires after the built-in
 * toggleValue handler, then corrects this.value for the two control items).
 *
 * If goBackLabel is provided, a "Go back" control is prepended. Pressing Space
 * on it immediately submits the prompt and the function returns COMMIT_BACK.
 */
export async function commitMultiSelect(
  message: string,
  options: CommitOpt[],
  initialValues: string[],
  goBackLabel?: string,
): Promise<string[] | symbol | typeof COMMIT_BACK> {
  const SELECT_ALL   = '__tagman_select_all__';
  const DESELECT_ALL = '__tagman_deselect_all__';
  const GO_BACK      = '__tagman_go_back__';
  const commitValues = options.map(o => o.value);
  const CONTROLS     = [SELECT_ALL, DESELECT_ALL, GO_BACK];

  const controlItems: CommitOpt[] = [];
  if (goBackLabel) {
    controlItems.push({ value: GO_BACK, label: `${color.magenta('←')} ${goBackLabel}` });
  }
  controlItems.push(
    { value: SELECT_ALL,   label: `${color.green('◆')} Select All`   },
    { value: DESELECT_ALL, label: `${color.yellow('◇')} Deselect All` },
  );

  const allOptions: CommitOpt[] = [...controlItems, ...options];

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
      if ((value ?? []).includes(GO_BACK)) return; // go-back bypasses validation
      const real = (value ?? []).filter(v => !CONTROLS.includes(v));
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
  // control items so they never appear in the final selection.
  (prompt as any).on('cursor', (action: string) => {
    if (action !== 'space') return;
    const cursor: number = (prompt as any).cursor;
    const current = allOptions[cursor]?.value;
    if (current === GO_BACK) {
      // Immediately submit the prompt with the go-back sentinel value.
      (prompt as any).value = [GO_BACK];
      (prompt as any).state = 'submit';
      (prompt as any).close();
    } else if (current === SELECT_ALL) {
      (prompt as any).value = commitValues.slice();
    } else if (current === DESELECT_ALL) {
      (prompt as any).value = [];
    } else {
      (prompt as any).value = ((prompt as any).value ?? []).filter(
        (v: string) => !CONTROLS.includes(v)
      );
    }
  });

  const result = await (prompt as any).prompt();
  if (Array.isArray(result) && result.includes(GO_BACK)) return COMMIT_BACK;
  if (p.isCancel(result)) return result;
  return (result as string[]).filter(v => !CONTROLS.includes(v));
}
