/**
 * The text of a document, built once a version (BACKLOG: "What Session 342's review round found beside the typing-path cures", the document-text memo).
 *
 * ONE memo for the module, so the three features that read a whole document on the typing path share its entries: the cursor-move key (`features/execution.ts`), the
 * cell tint (`features/cell-background.ts`) and the render-script predicate (`features/preview.ts`). The memo is keyed by the `TextDocument` OBJECT and its version
 * (`core/document-text-memo`), so this module reads nothing else of the host and imports `vscode` for a type only: it loads without the host.
 * `test/unit/s343-adapter-wiring-pin.test.ts` pins that from the syntax tree.
 */

import type * as vscode from "vscode";
import { createDocumentTextMemo } from "../core/document-text-memo";

const memo = createDocumentTextMemo();

/** The text of `document` as it is now: `document.getText()` on the first ask of a version, the same string while the version stays. */
export function documentText(document: vscode.TextDocument): string {
  return memo.textOf(document, () => document.getText());
}
