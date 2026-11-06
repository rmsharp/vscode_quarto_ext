/**
 * A document's text, built once a version, vscode-free (BACKLOG: "What Session 342's review round found beside the typing-path cures", the document-text memo).
 *
 * `TextDocument.getText()` joins the whole buffer's lines into a new string on every call. Three adapters called it on the typing path: `updateCellContext`
 * (`features/execution.ts`) on EVERY selection event, even when the document did not change since the last one; `cellBackgroundRangesFor`
 * (`features/cell-background.ts`) for every visible Quarto editor on every refresh; `isPreviewableRenderScript` (`features/preview.ts`) for a `.py`, `.jl` or `.r`
 * active document on every keystroke. A fresh join costs 0.2 / 1.1 / 6.2 ms at 500 / 2,000 / 8,000 twenty-seven-line cells where the very same string object costs
 * 0.001 / 0.001 / 0.005 ms (the lead's p2b probe, `lines.join` standing in for `getText`); and the scan cache compares texts with `===`, which is O(n) for two equal
 * but distinct strings and O(1) for one string object.
 *
 * THIS COMMIT IS THE SEAM: the memo reads the text on every call, as the adapters did, so the adapters can be moved onto it with nothing observable changing; the rows
 * that count the reads are written against this, then the memo is added.
 */

/** What the memo needs to know about a document: its version, which VS Code raises on every change of its text (an edit, an undo, a revert, a change of line endings). */
export interface VersionedDocument {
  readonly version: number;
}

export interface DocumentTextMemo {
  /** The text of `document` as it is now: `getText()` of it, called as the memo sees fit. */
  textOf(document: VersionedDocument, getText: () => string): string;
}

export function createDocumentTextMemo(): DocumentTextMemo {
  return {
    textOf(_document, getText) {
      return getText();
    },
  };
}
