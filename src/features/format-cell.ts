/**
 * `Quarto: Format Cell` (BACKLOG item 12, Session 75) — delegates a code cell's
 * body to its embedded language's own installed formatter (e.g. Black/autopep8
 * for Python, `styler` for R), via the SAME per-cell virtual-document forwarding
 * recipe as outline in-cell symbol forwarding (BACKLOG item 11 slice 2):
 * `core/embedded/virtual-doc.ts`'s `buildCellVirtualContent` isolates exactly
 * the cursor's cell (blanking every other line, INCLUDING that cell's own
 * `#|`/`//|` option lines and any sibling same-language cell), so the forwarded
 * formatter can never reflow a directive line or another cell's body — Posit's
 * own headline requirement for this feature falls out of reuse, not new logic.
 *
 * A thin `vscode` adapter (plan §3.3): all region/gating logic is the pure
 * `core/qmd/model` + `core/embedded/virtual-doc` (both already shipped for item
 * 11), and this file is the impure plumbing — the content provider, the
 * `executeFormatDocumentProvider` forward, and the out-of-cell edit filter
 * (mirroring `embedded.ts`'s `filterOutOfCellEdits` defense-in-depth).
 *
 * The vdoc is a real `file:` document on disk (`features/embedded-vdoc.ts`,
 * BACKLOG item 18). It used to route through a custom `quarto-format-cell:`
 * scheme, which no real language server registers for.
 *
 * **This feature's status against a real formatter is UNPROVEN, not proven-broken.**
 * It is architecturally identical to the four forwards that were measured dead on
 * the custom scheme, so it was almost certainly dead too — but no Python formatter
 * extension was installed in the spike host, so even the `file:` control returned 0
 * edits and the experiment could not distinguish "our forward is broken" from "no
 * formatter is installed". Do not claim it either way without re-probing with a real
 * formatter (e.g. `ms-python.black-formatter`) present. What IS proven is that the
 * forward now reaches a real, non-stand-in provider: `test:lsp` exercises it against
 * VS Code's own BUILT-IN JavaScript formatter via an `{ojs}` cell, which needs no
 * extension at all.
 */

import * as vscode from "vscode";
import { buildCellVirtualContent, embeddedCellAt } from "../core/embedded/virtual-doc";
import { disposeVdocs, ensureVdoc } from "./embedded-vdoc";
import { type Cell, findCellAtPosition } from "../core/qmd/model";

/** Register the Format Cell command, tied to the extension lifetime. */
export function registerFormatCellFeature(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("quarto.formatCell", formatCellAtCursor),
    // Vdocs are real files now: a closed document must take its own off disk.
    vscode.workspace.onDidCloseTextDocument((doc) => void disposeVdocs(doc.uri)),
  );
}

/** The active editor's tab settings, defaulted defensively for `FormattingOptions`. */
function formattingOptions(editor: vscode.TextEditor): vscode.FormattingOptions {
  const { tabSize, insertSpaces } = editor.options;
  return {
    tabSize: typeof tabSize === "number" ? tabSize : 4,
    insertSpaces: typeof insertSpaces === "boolean" ? insertSpaces : true,
  };
}

async function formatCellAtCursor(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    return;
  }
  const text = editor.document.getText();
  const position = editor.selection.active;
  const hit = embeddedCellAt(text, position.line);
  if (hit === null) {
    void vscode.window.showInformationMessage(
      "Quarto: place the cursor inside a code cell to format it.",
    );
    return;
  }
  const cell = findCellAtPosition(text, position.line);
  if (cell === null) {
    return; // unreachable: embeddedCellAt already confirmed a cell at this line
  }
  const vdocUri = await ensureVdoc(
    editor.document,
    {
      docUri: editor.document.uri.toString(),
      languageId: hit.languageId,
      ext: hit.ext,
      kind: "cell",
      cellStartLine: cell.startLine,
    },
    buildCellVirtualContent(text, cell),
  );
  if (vdocUri === undefined) {
    return; // nowhere to write the vdoc — no forward, no edit, no error
  }
  const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
    "vscode.executeFormatDocumentProvider",
    vdocUri,
    formattingOptions(editor),
  );
  if (edits === undefined || edits.length === 0) {
    void vscode.window.showInformationMessage(
      `Quarto: no formatter available for "${hit.languageId}" cells (install a formatting extension for ${hit.languageId}).`,
    );
    return;
  }
  const kept = edits.filter((e) => rangeWithinCell(text, e.range, cell));
  if (kept.length === 0) {
    return;
  }
  const wsEdit = new vscode.WorkspaceEdit();
  wsEdit.set(editor.document.uri, kept);
  await vscode.workspace.applyEdit(wsEdit);
}

/**
 * Whether every line of `range` belongs to `cell`'s own **body** — region membership, not
 * coordinate validity. Under `buildCellVirtualContent`'s whole-document blanking, every
 * line outside the body identity-maps to a *valid* `.qmd` offset, so a formatter's edit
 * there is perfectly well-formed and utterly destructive.
 *
 * Two distinct hazards, and the second one bit:
 *
 *  1. A line **outside the cell** (the front matter, prose, a sibling cell). Caught by the
 *     ownership check below.
 *
 *  2. A line **inside the cell but not in its body** — the opening fence, the closing
 *     fence, a `#|` option line. `findCellAtPosition` is INCLUSIVE of a cell's fences, so
 *     an ownership check ALONE happily accepts an edit that lands on ```` ```{python} ````
 *     and deletes it. And a real formatter emits exactly that: the fences are blanked to
 *     whitespace-only lines in the vdoc, and formatters trim trailing whitespace. Observed
 *     end-to-end against VS Code's own JavaScript formatter, before this guard:
 *
 *         BEFORE  ```{ojs}\nx   =   1\n```\n
 *         AFTER   \nx = 1\n\n            <- both fences gone; the cell is no longer a cell
 *
 *     This was latent, not new: until BACKLOG item 18 the forward went to a custom URI
 *     scheme no real formatter registered for, so zero edits ever came back and only a
 *     stand-in (which emitted body-confined edits) ever exercised this path. Repairing the
 *     forward made a document-corruption bug reachable.
 *
 * `embeddedCellAt` is the body-only gate — `null` on fences and on `#|` option lines — and
 * is the same primitive `embedded.ts`'s own edit filter (`rangeInSameLangBody`) already
 * used correctly. This function had reached for `findCellAtPosition` instead.
 */
function rangeWithinCell(text: string, range: vscode.Range, cell: Cell): boolean {
  for (let line = range.start.line; line <= range.end.line; line++) {
    if (embeddedCellAt(text, line) === null) {
      return false; // a fence, a `#|` directive, prose, YAML — never code we may rewrite
    }
    const owner = findCellAtPosition(text, line);
    if (owner === null || owner.startLine !== cell.startLine) {
      return false; // a body line, but of a DIFFERENT cell
    }
  }
  return true;
}
