import * as p from "@clack/prompts";
import { MultiSelectPrompt, wrapTextWithPrefix } from "@clack/core";
import color from "picocolors";
import { t } from "../../i18n/index.js";

export type CommitOpt = { value: string; label: string; details?: string };

export const COMMIT_BACK = Symbol('commitSelectBack');

/**
 * Interactive multiselect for commits.
 *
 * Virtual controls at the top of the list:
 *   ◆ Select All   — selects all real commits
 *   ◇ Deselect All — clears the selection
 *
 * Keyboard shortcuts shown in a hint line below the list:
 *   d         — toggle date & author display per commit (reads CommitOpt.details)
 *   ← (left)  — go back to package selection (only when goBackLabel is provided)
 *
 * Parameters:
 *   goBackLabel  — when set, enables the ← shortcut and shows it in the hint line
 *   allowEmpty   — when true, skips the "select at least one" validation (for optional extras)
 */
export async function commitMultiSelect(
  message: string,
  options: CommitOpt[],
  initialValues: string[],
  goBackLabel?: string,
  allowEmpty?: boolean,
): Promise<string[] | symbol | typeof COMMIT_BACK> {
  const SELECT_ALL   = '__tagman_select_all__';
  const DESELECT_ALL = '__tagman_deselect_all__';
  const GO_BACK      = '__tagman_go_back__';
  const commitValues = options.map(o => o.value);
  const CONTROLS     = [SELECT_ALL, DESELECT_ALL];

  const allOptions: CommitOpt[] = [
    { value: SELECT_ALL,   label: `${color.green('◆')} Select All`   },
    { value: DESELECT_ALL, label: `${color.yellow('◇')} Deselect All` },
    ...options,
  ];

  let showDetails = false;

  const styleOpt = (opt: CommitOpt, isActive: boolean, val: string[]) => {
    const baseLabel = opt.label;
    const label = showDetails && opt.details
      ? `${baseLabel}  ${color.dim(opt.details)}`
      : baseLabel;
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
      if (allowEmpty) return;
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
            .filter(o => val.includes(o.value) && !CONTROLS.includes(o.value))
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
          const hintParts: string[] = [
            `${color.dim('[d]')} ${color.dim(showDetails ? t().scan.hideDetails : t().scan.showDetails)}`,
          ];
          if (goBackLabel !== undefined) {
            hintParts.push(`${color.dim('[←]')} ${color.dim(t().scan.goBackToPackages)}`);
          }
          const hint = hintParts.join(`  ${color.dim('·')}  `);
          const items = p.limitOptions({ cursor, options: allOptions, columnPadding: bar.length, rowPadding: rowCount + 3, style });
          return `${header}${bar}${items.join(`\n${bar}`)}\n${bar}${hint}\n${color.cyan(p.S_BAR_END)}\n`;
        }
      }
    },
  });

  // Cursor event: handle SELECT_ALL / DESELECT_ALL after the built-in toggleValue.
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
        (v: string) => !CONTROLS.includes(v)
      );
    }
  });

  // Key event: handle d (toggle details) and ← (go back).
  (prompt as any).on('key', (char: string, key: { name?: string }) => {
    if (char === 'd') {
      showDetails = !showDetails;
      // render() re-runs automatically as part of the keypress cycle
      return;
    }
    if (key?.name === 'left' && goBackLabel !== undefined) {
      (prompt as any).value = [GO_BACK];
      (prompt as any).state = 'submit';
      (prompt as any).close();
    }
  });

  const result = await (prompt as any).prompt();
  if (Array.isArray(result) && result.includes(GO_BACK)) return COMMIT_BACK;
  if (p.isCancel(result)) return result;
  return (result as string[]).filter(v => !CONTROLS.includes(v));
}
