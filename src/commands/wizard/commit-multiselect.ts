import * as p from "@clack/prompts";
import { MultiSelectPrompt, wrapTextWithPrefix } from "@clack/core";
import color from "picocolors";
import { t } from "../../i18n/index.js";

export type CommitOpt = { value: string; label: string; details?: string };

export const COMMIT_BACK = Symbol('commitSelectBack');

/**
 * Interactive multiselect for commits.
 *
 * The list contains only real commits. All controls are keyboard shortcuts
 * shown in a hint line at the bottom:
 *
 *   a         — select all commits
 *   n         — deselect all commits (none)
 *   d         — toggle date & author inline (reads CommitOpt.details)
 *   b         — go back to package selection (only when goBackLabel is provided)
 *
 * Parameters:
 *   goBackLabel  — when set, enables the [b] shortcut and shows it in the hint line
 *   allowEmpty   — when true, skips the "select at least one" validation (for optional extras)
 */
export async function commitMultiSelect(
  message: string,
  options: CommitOpt[],
  initialValues: string[],
  goBackLabel?: string,
  allowEmpty?: boolean,
): Promise<string[] | symbol | typeof COMMIT_BACK> {
  const GO_BACK      = '__tagman_go_back__';
  const commitValues = options.map(o => o.value);
  const allOptions   = [...options];

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
      if (!value || value.length === 0) return 'Select at least one commit.';
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
          const hintParts: string[] = [
            `${color.dim('[a]')} ${color.dim(t().scan.selectAll)}`,
            `${color.dim('[n]')} ${color.dim(t().scan.deselectAll)}`,
            `${color.dim('[d]')} ${color.dim(showDetails ? t().scan.hideDetails : t().scan.showDetails)}`,
          ];
          if (goBackLabel !== undefined) {
            hintParts.push(`${color.dim('[b]')} ${color.dim(t().scan.goBackToPackages)}`);
          }
          const hint = hintParts.join(`  ${color.dim('·')}  `);
          const items = p.limitOptions({ cursor, options: allOptions, columnPadding: bar.length, rowPadding: rowCount + 3, style });
          return `${header}${bar}${items.join(`\n${bar}`)}\n${bar}${hint}\n${color.cyan(p.S_BAR_END)}\n`;
        }
      }
    },
  });

  // Key event: all shortcuts handled here.
  (prompt as any).on('key', (char: string, key: { name?: string }) => {
    if (char === 'a') {
      (prompt as any).value = commitValues.slice();
      return;
    }
    if (char === 'n') {
      (prompt as any).value = [];
      return;
    }
    if (char === 'd') {
      showDetails = !showDetails;
      return;
    }
    if (char === 'b' && goBackLabel !== undefined) {
      (prompt as any).value = [GO_BACK];
      (prompt as any).state = 'submit';
      (prompt as any).close();
    }
  });

  const result = await (prompt as any).prompt();
  if (Array.isArray(result) && result.includes(GO_BACK)) return COMMIT_BACK;
  if (p.isCancel(result)) return result;
  return result as string[];
}
