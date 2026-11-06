/**
 * Where a character offset falls in a document, and the text of that line: the first thing `completionContextAt`
 * (`core/yaml-context.ts`) asks on every completion request, before it knows whether the cursor is in YAML at all.
 *
 * Lines are counted by `\n` alone, matching `vscode.TextDocument.offsetAt`, which walks the raw buffer; a lone `\r` is no
 * line break, and a `\r` before a `\n` belongs to the break, so the line's text is what `text.split(/\r?\n/)` makes of it.
 * The offset is any `number`: clamped into the document, and a `NaN` is the start of line 0 with a column of `NaN`.
 */

/** The 0-based line and column of an offset, and the text of the line (without its line break). */
export interface CursorLine {
  line: number;
  col: number;
  lineText: string;
}

export function cursorLineAt(text: string, offset: number): CursorLine {
  const { line, col } = lineColAt(text, offset);
  return { line, col, lineText: text.split(/\r?\n/)[line] ?? "" };
}

/**
 * The 0-based (line, col) of `offset` in `text`, counting `\n` as the line break
 * (matching `vscode.TextDocument.offsetAt`, which walks the raw buffer). A `\r`
 * before a `\n` belongs to the preceding line, so columns within a `\r\n` line
 * agree with the model's `\r?\n`-split line text for any cursor before the `\r`.
 */
function lineColAt(text: string, offset: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: clamped - lineStart };
}
