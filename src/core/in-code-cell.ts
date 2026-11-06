/**
 * The value of the `quarto.inCodeCell` context key, vscode-free (the Session 342 review round, mutation lens M-02).
 *
 * The key gates five keybindings (`ctrl+enter`, `shift+enter`, `ctrl+shift+enter`, `ctrl+alt+c`, `ctrl+k ctrl+f`, in `package.json`): they bind only while the cursor is in a code cell, and
 * fall through to the editor's own behaviour elsewhere. `updateCellContext` (`features/execution.ts`) used to hold the whole question inline, in a file that imports `vscode`, so nothing could
 * read the VALUE it set; it now asks this function, which a unit test reaches (`test/unit/in-code-cell.test.ts`), and `test/unit/s342-typing-wiring-pin.test.ts` pins what the adapter hands it.
 */

import { findCellAtPosition } from "./cells";

/**
 * Whether the cursor line `line` (0-based, as VS Code numbers lines) of a document of language `languageId` and text `text` is inside an executable code cell: the document is a `quarto` one, and
 * the line is within `[startLine, endLine]` of a cell, the fence lines and the `#|` option lines included.
 *
 * `text` may be a function that returns it. It is called only for a `quarto` document, once: the old inline code read `editor.document.getText()` only after the language id matched, and the key is
 * re-evaluated for the active editor of EVERY language (a cursor move in a `.ts` file asks too), so a caller that holds a document hands `() => document.getText()` and a text the key does not
 * need is not built.
 */
export function isInCodeCell(languageId: string, text: string | (() => string), line: number): boolean {
  return languageId === "quarto" && findCellAtPosition(typeof text === "function" ? text() : text, line) !== null;
}
