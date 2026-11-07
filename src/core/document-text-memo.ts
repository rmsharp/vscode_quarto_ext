/**
 * A document's text, built once a version, vscode-free (BACKLOG: "What Session 342's review round found beside the typing-path cures", the document-text memo).
 *
 * `TextDocument.getText()` joins the whole buffer's lines into a new string on every call. Three adapters called it on the typing path: `updateCellContext`
 * (`features/execution.ts`) on EVERY selection event, even when the document did not change since the last one; `cellBackgroundRangesFor`
 * (`features/cell-background.ts`) for every visible Quarto editor on every refresh; `isPreviewableRenderScript` (`features/preview.ts`) for a `.py`, `.jl` or `.r`
 * active document on every keystroke. Session 344 took the third off the text altogether (see below). A fresh join costs 0.2 / 1.1 / 6.2 ms at 500 / 2,000 / 8,000 25-line cells where the very same string object costs
 * 0.001 / 0.001 / 0.005 ms (the lead's p2b probe, `lines.join` standing in for `getText`); and the scan cache compares texts with `===`, which is O(n) for two equal
 * but distinct strings and O(1) for one string object.
 *
 * ⚠ WHAT IT DID NOT CURE, and what did (SIB-08): every keystroke is a NEW version, so the memo gave the per-keystroke call of `isPreviewableRenderScript` NO gain (worker D
 * measured 0.944 against 0.942 ms at 54,000 lines). The cure was not to build the text: since Session 344 `isPreviewableRenderScript` hands the document to
 * `isRenderScriptDocument` (`core/render-script`), which reads only the lines its answer needs, and `preview.ts` no longer asks this memo for anything. The adopters that
 * gain are the four completion providers (one request asks them all at one version) and the two that read the same version again (`updateCellContext` on a move of the cursor,
 * `cellBackgroundRangesFor` on a refresh with no edit).
 *
 * The memo returns the SAME string while a document's version is unchanged, and reads `getText()` again when it moves:
 *  - THE KEY is the `TextDocument` OBJECT (held through a `WeakRef`) and its version, never its URI and a version. A document closed, edited on disk and reopened starts again at version 1,
 *    and a URI key would serve the text it had before it was closed; the reopened document is a new object.
 *  - THE BOUND is two entries, least recently used out: the active document and one more (a split editor, the other visible `.qmd`). A new version of a document REPLACES its entry; an
 *    older version is not kept.
 *  - NO STRONG REFERENCE TO A DOCUMENT: an entry holds the `WeakRef`, the version and the text. The strings are held strongly (two buffers' worth at most, until the entry is replaced
 *    or the memo is asked again after its document is gone, which drops the entry); the documents never are, so a memo cannot keep a closed document alive.
 *  - A THUNK THAT THROWS stores nothing and the error propagates.
 *  - THE READ IS LAZY: `textOf` takes the read as a function and calls it only on a miss. A caller guards the question BEFORE it asks (`isInCodeCell` reads the text only for a
 *    Quarto document), and the guard stays the caller's: the memo never makes a read the caller would not have made (Learning 920).
 */

/** What the memo needs to know about a document: its version, which VS Code raises on every change of its text (an edit, an undo, a revert, a change of line endings). */
export interface VersionedDocument {
  readonly version: number;
}

export interface DocumentTextMemo {
  /** The text of `document` as it is now: `getText()` of it, called as the memo sees fit. */
  textOf(document: VersionedDocument, getText: () => string): string;
}

/** How many documents' texts the memo keeps. */
export const DOCUMENT_TEXT_MEMO_ENTRIES = 2;

interface Entry {
  readonly document: WeakRef<VersionedDocument>;
  readonly version: number;
  readonly text: string;
}

export function createDocumentTextMemo(): DocumentTextMemo {
  /** Least recently used first. */
  const entries: Entry[] = [];
  const indexOf = (document: VersionedDocument): number => entries.findIndex((entry) => entry.document.deref() === document);
  return {
    textOf(document, getText) {
      // An entry whose document has been collected can never be asked for again: drop it, text included.
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].document.deref() === undefined) {
          entries.splice(i, 1);
        }
      }
      const version = document.version;
      const at = indexOf(document);
      if (at !== -1 && entries[at].version === version) {
        const [hit] = entries.splice(at, 1);
        entries.push(hit);
        return hit.text;
      }
      const text = getText();
      const stale = indexOf(document);
      if (stale !== -1) {
        entries.splice(stale, 1);
      }
      entries.push({ document: new WeakRef(document), version, text });
      while (entries.length > DOCUMENT_TEXT_MEMO_ENTRIES) {
        entries.shift();
      }
      return text;
    },
  };
}
