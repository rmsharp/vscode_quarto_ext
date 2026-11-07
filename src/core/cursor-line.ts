/**
 * Where a character offset falls in a document, and the text of that line: the first thing `completionContextAt`
 * (`core/yaml-context.ts`) asks on every completion request, before it knows whether the cursor is in YAML at all.
 *
 * Lines are counted by `\n` alone, matching `vscode.TextDocument.offsetAt`, which walks the raw buffer; a lone `\r` is no
 * line break, and a `\r` before a `\n` belongs to the break, so the line's text is what `text.split(/\r?\n/)` makes of it.
 * The offset is any `number`: clamped into the document, and a `NaN` is the start of line 0 with a column of `NaN`.
 *
 * ⚠ Session 343: the line's text is read between the two line breaks that surround the offset, NEVER from a split of the
 * whole document (a split of 2,000 cells of 25 lines is 1.2 ms, of 8,000 cells 5 to 7 ms, built for one line and thrown
 * away, on every completion request and on a prose line too, where the answer is `null`). The walk to the offset is one
 * `indexOf` a line, which is the cost that is left: it is linear in the offset, 0.3 ms for the whole of 2,000 cells.
 */

/** The 0-based line and column of an offset, and the text of the line (without its line break). */
export interface CursorLine {
  line: number;
  col: number;
  lineText: string;
}

export function cursorLineAt(text: string, offset: number): CursorLine {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;
  // Every `\n` below the offset is a line break before the cursor. The comparison is written so that a NaN fails it: no break is below a NaN, and the cursor is on line 0.
  let lineBreak = text.indexOf("\n");
  while (lineBreak >= 0 && lineBreak < clamped) {
    line++;
    lineStart = lineBreak + 1;
    lineBreak = text.indexOf("\n", lineStart);
  }
  // `lineBreak` is now the `\n` that ends the cursor's line, or -1 for the last line. A `\r` right before it belongs to the break, but only a `\r` of this line (a CR cannot sit at `lineStart - 1`, that is a `\n`).
  let lineEnd = lineBreak < 0 ? text.length : lineBreak;
  if (lineBreak > lineStart && text.charCodeAt(lineBreak - 1) === 13) lineEnd = lineBreak - 1;
  return { line, col: clamped - lineStart, lineText: text.slice(lineStart, lineEnd) };
}
