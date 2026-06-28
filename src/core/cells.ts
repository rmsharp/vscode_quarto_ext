/**
 * Pure, `vscode`-free detection of Quarto executable code cells.
 *
 * This module lives in `core/` and MUST NOT import `vscode` (architecture plan
 * §3.3 — "the load-bearing guardrail"). The bulk of run-cell correctness is the
 * cell-boundary logic here, so it is unit-tested headlessly.
 *
 * A Quarto executable cell is a backtick-fenced block whose info string is a
 * brace-wrapped language identifier — ```` ```{python} ````. The scanner is a
 * single linear pass that tracks fence open/close (CommonMark: a fence opened
 * with N backticks is closed by a line of ≥N backticks with no info string), so
 * it correctly excludes:
 *   - a plain ```` ```python ```` fence (no braces — highlighting only),
 *   - the ```` ```{{python}} ```` display form (literal, non-executable),
 *   - a ```` ```{.python} ```` Pandoc class block (attribute, non-executable),
 *   - any ```` ```{lang} ```` that is itself *inside* an outer fence (a nested
 *     example, not a real cell).
 */

export interface Cell {
  /** 0-based line index of the opening fence (e.g. ```` ```{python} ````). */
  startLine: number;
  /** 0-based line index of the closing fence (or the last line for an unterminated cell). */
  endLine: number;
  /** The cell engine/language from the brace info string, e.g. `"python"`. */
  lang: string;
  /** The cell body (lines between the fences), joined with `\n`; `""` if empty. */
  code: string;
}

/** A backtick fence opener: leading indent, ≥3 backticks, then the info string. */
const FENCE_OPEN = /^[ \t]*(`{3,})(.*)$/;
/**
 * A brace info string for an *executable* cell: `{` then a language identifier
 * (a letter-led token), optionally followed by knitr-style options, then `}`.
 * Requiring a letter immediately after `{` is what excludes `{{python}}` (the
 * display form) and `{.python}` (a Pandoc class) — both non-executable.
 */
const CELL_INFO = /^\{([A-Za-z][A-Za-z0-9_-]*)[^}]*\}$/;
/** A closing fence: leading indent, only backticks, optional trailing space. */
const FENCE_CLOSE = /^[ \t]*(`{3,})[ \t]*$/;

interface OpenFence {
  readonly len: number;
  readonly isCell: boolean;
  readonly lang: string;
  readonly startLine: number;
}

/** Find every executable `{lang}` code cell in `text`, in document order. */
export function findAllCells(text: string): Cell[] {
  const lines = text.split(/\r?\n/);
  const cells: Cell[] = [];
  let open: OpenFence | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      const m = FENCE_OPEN.exec(line);
      if (m) {
        const info = CELL_INFO.exec(m[2].trim());
        open = {
          len: m[1].length,
          isCell: info !== null,
          lang: info ? info[1] : "",
          startLine: i,
        };
      }
    } else if (isCloser(line, open.len)) {
      if (open.isCell) {
        cells.push({
          startLine: open.startLine,
          endLine: i,
          lang: open.lang,
          code: lines.slice(open.startLine + 1, i).join("\n"),
        });
      }
      open = null;
    }
  }

  // CommonMark: an unclosed fence runs to the end of the document. Keep such a
  // cell runnable (e.g. while the author is still typing it).
  if (open !== null && open.isCell) {
    cells.push({
      startLine: open.startLine,
      endLine: lines.length - 1,
      lang: open.lang,
      code: lines.slice(open.startLine + 1).join("\n"),
    });
  }

  return cells;
}

/**
 * The cell containing 0-based `line`, or `null` if `line` is not inside any
 * cell. The fence lines themselves count as inside the cell (so running with the
 * cursor on the ```` ```{python} ```` line works), i.e. the test is inclusive of
 * `[startLine, endLine]`.
 */
export function findCellAtPosition(text: string, line: number): Cell | null {
  for (const cell of findAllCells(text)) {
    if (line >= cell.startLine && line <= cell.endLine) {
      return cell;
    }
  }
  return null;
}

function isCloser(line: string, openLen: number): boolean {
  const m = FENCE_CLOSE.exec(line);
  return m !== null && m[1].length >= openLen;
}
