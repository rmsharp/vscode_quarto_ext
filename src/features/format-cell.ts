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
 * Unlike `outline.ts`'s `InCellSymbolStore`, this store reuses a STABLE vdoc URI
 * per (document, language) and overwrites its content on every command
 * invocation — the same pattern `embedded.ts`'s completion/hover/definition/
 * signature-help forwarding already uses successfully. `executeDocumentSymbol
 * Provider`'s internal per-URI RESULT cache (Learning #77/78) was a quirk
 * specific to that one command; this feature is invoked once per explicit user
 * action (never continuously) and always refreshes the vdoc's content
 * immediately before forwarding — an integration test proves a real edit
 * between two invocations is seen fresh (no staleness), consistent with
 * Learning #81 (an ACTUAL text edit, not a bare repeated call, is what
 * triggers correct re-invocation).
 */

import * as vscode from "vscode";
import { buildCellVirtualContent, embeddedCellAt } from "../core/embedded/virtual-doc";
import { type Cell, findCellAtPosition } from "../core/qmd/model";

/**
 * The scheme Format Cell's per-cell virtual documents live under — distinct
 * from `embedded.ts`'s `quarto-embedded` and `outline.ts`'s
 * `quarto-outline-symbols` (a `registerTextDocumentContentProvider` call
 * allows at most one provider per scheme).
 */
const SCHEME = "quarto-format-cell";

/** Register the Format Cell command, tied to the extension lifetime. */
export function registerFormatCellFeature(context: vscode.ExtensionContext): void {
  const store = new FormatCellVirtualDocStore();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, store),
    vscode.commands.registerCommand("quarto.formatCell", () => formatCellAtCursor(store)),
    // The virtual-doc Map must not grow unbounded: drop a document's vdocs when
    // it closes (mirrors `embedded.ts`'s `VirtualDocStore`).
    vscode.workspace.onDidCloseTextDocument((doc) => store.evict(doc.uri)),
  );
}

/**
 * Per-(document, language) virtual-document store — the same shape as
 * `embedded.ts`'s `VirtualDocStore` (stable URI, content overwritten per
 * request). See the module docstring for why this file does not need
 * `outline.ts`'s version-stamped-URI store.
 */
class FormatCellVirtualDocStore implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  private readonly owners = new Map<string, Set<string>>();

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    return this.contents.get(uri.toString());
  }

  /** Store `content` as the `ext` virtual doc for `docUri` and return its vdoc URI. */
  set(docUri: vscode.Uri, ext: string, languageId: string, content: string): vscode.Uri {
    const vdocUri = vscode.Uri.from({
      scheme: SCHEME,
      authority: languageId,
      path: `/${encodeURIComponent(docUri.toString(true))}.${ext}`,
    });
    const key = vdocUri.toString();
    this.contents.set(key, content); // rebuild-per-request (edit-sync)
    const owner = docUri.toString();
    const keys = this.owners.get(owner) ?? new Set<string>();
    keys.add(key);
    this.owners.set(owner, keys);
    return vdocUri;
  }

  /** Drop every virtual doc owned by `docUri` (called when the document closes). */
  evict(docUri: vscode.Uri): void {
    const owner = docUri.toString();
    const keys = this.owners.get(owner);
    if (keys === undefined) {
      return;
    }
    for (const key of keys) {
      this.contents.delete(key);
    }
    this.owners.delete(owner);
  }
}

/** The active editor's tab settings, defaulted defensively for `FormattingOptions`. */
function formattingOptions(editor: vscode.TextEditor): vscode.FormattingOptions {
  const { tabSize, insertSpaces } = editor.options;
  return {
    tabSize: typeof tabSize === "number" ? tabSize : 4,
    insertSpaces: typeof insertSpaces === "boolean" ? insertSpaces : true,
  };
}

async function formatCellAtCursor(store: FormatCellVirtualDocStore): Promise<void> {
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
  const content = buildCellVirtualContent(text, cell);
  const vdocUri = store.set(editor.document.uri, hit.ext, hit.languageId, content);
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
 * Whether every line of `range` belongs to `cell`'s own body — region
 * membership, not coordinate validity, mirroring `embedded.ts`'s
 * `filterOutOfCellEdits`/`rangeInSameLangBody`. Under `buildCellVirtualContent`'s
 * whole-document blanking, a line outside `cell` identity-maps to a *valid*
 * `.qmd` offset (e.g. the front matter), so a misbehaving formatter's edit
 * there must never be applied to the real document.
 */
function rangeWithinCell(text: string, range: vscode.Range, cell: Cell): boolean {
  for (let line = range.start.line; line <= range.end.line; line++) {
    const owner = findCellAtPosition(text, line);
    if (owner === null || owner.startLine !== cell.startLine) {
      return false;
    }
  }
  return true;
}
