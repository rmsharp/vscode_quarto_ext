import * as assert from "node:assert";
import * as vscode from "vscode";
import { assertRoutedThroughVdoc, VDOC_SELECTOR } from "./vdoc-assert";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** Scheme Format Cell's per-cell virtual documents route through (plan: this session). */

interface FormatCall {
  /** The URI the stand-in was invoked on — proves the request routed through the vdoc. */
  uri: string;
  /** The vdoc's resolved languageId. */
  languageId: string;
  /** The vdoc text at invocation time — proves fresh content, not a stale cache. */
  text: string;
}

let calls: FormatCall[] = [];
/** When true, the stand-in still RECORDS the call but returns no edits — the
 * "no formatter behavior" case is covered separately by NOT registering the
 * stand-in at all; this models an installed formatter that has nothing to do. */
let standInReturnsNothing = false;
/** When true, the stand-in also attaches an edit whose range lands OUTSIDE the
 * target cell (in the front matter) — the out-of-cell defense-in-depth case. */
let standInOutOfCellEdit = false;
const disposables: vscode.Disposable[] = [];

/**
 * Register a stand-in `DocumentFormattingEditProvider` for the format-cell
 * scheme: the bare test host has no Python formatter, so this substitutes for
 * one and records the URI/languageId/text it was invoked on (mirroring
 * `embedded.test.ts`'s `registerStandIn` pattern).
 */
function registerStandIn(): void {
  disposables.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      VDOC_SELECTOR,
      {
        provideDocumentFormattingEdits(document) {
          calls.push({
            uri: document.uri.toString(),
            languageId: document.languageId,
            text: document.getText(),
          });
          if (standInReturnsNothing) {
            return [];
          }
          const edits = [
            vscode.TextEdit.replace(new vscode.Range(8, 0, 8, 3), "x = 1"),
            vscode.TextEdit.replace(new vscode.Range(9, 0, 9, 3), "y = 2"),
          ];
          if (standInOutOfCellEdit) {
            // "title: Demo" is 11 chars — a valid range in the blanked vdoc,
            // but it must never land in the real document's front matter.
            edits.push(vscode.TextEdit.replace(new vscode.Range(1, 0, 1, 11), "HACKED"));
          }
          return edits;
        },
      },
    ),
  );
}

async function openInMemory(content: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({
    language: "quarto",
    content,
  });
  return vscode.window.showTextDocument(doc);
}

function moveCursor(editor: vscode.TextEditor, line: number, character: number): void {
  const pos = new vscode.Position(line, character);
  editor.selection = new vscode.Selection(pos, pos);
}

// A document with front matter, prose, a `#|` option line, and an unformatted
// {python} cell body (no spaces around `=`).
const DOC = [
  "---", // 0
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Some prose.", // 4
  "", // 5
  "```{python}", // 6  opening fence
  "#| echo: false", // 7  cell-option line
  "x=1", // 8  python body — cursor here
  "y=2", // 9  python body
  "```", // 10 closing fence
].join("\n");

const UNMAPPED_DOC = ["```{bash}", "echo hi", "```"].join("\n");

describe("Quarto: Format Cell (quarto.formatCell)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    calls = [];
    standInReturnsNothing = false;
    standInOutOfCellEdit = false;
  });

  afterEach(async () => {
    for (const d of disposables.splice(0)) {
      d.dispose();
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the quarto.formatCell command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("quarto.formatCell"), "quarto.formatCell should be registered");
  });

  it("formats a {python} cell body through the virtual document, applying edits to the real document", async () => {
    registerStandIn();
    const editor = await openInMemory(DOC);
    moveCursor(editor, 8, 1);

    await vscode.commands.executeCommand("quarto.formatCell");

    assert.strictEqual(calls.length, 1, "the stand-in should be invoked once");
    assertRoutedThroughVdoc(
      calls[0].uri,
      "Format Cell must route through our real file: virtual document",
    );
    assert.strictEqual(calls[0].languageId, "python");
    const text = editor.document.getText();
    assert.ok(text.includes("x = 1"), "the formatter's edit should be applied to the real document");
    assert.ok(text.includes("y = 2"), "the formatter's edit should be applied to the real document");
    assert.ok(
      text.includes("#| echo: false"),
      "the cell-option directive line must never be reflowed by the formatter",
    );
  });

  it("does nothing (and does not crash) on a prose line", async () => {
    registerStandIn();
    const editor = await openInMemory(DOC);
    moveCursor(editor, 4, 2);

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.formatCell")),
      "formatting on a prose line must not crash",
    );
    assert.strictEqual(calls.length, 0, "the stand-in must not be invoked outside a cell");
    assert.strictEqual(editor.document.getText(), DOC, "the document must be unchanged");
  });

  it("does nothing on an unmapped-language cell (e.g. {bash})", async () => {
    registerStandIn();
    const editor = await openInMemory(UNMAPPED_DOC);
    moveCursor(editor, 1, 2);

    await vscode.commands.executeCommand("quarto.formatCell");

    assert.strictEqual(calls.length, 0, "no forwarding for an unmapped-language cell");
    assert.strictEqual(editor.document.getText(), UNMAPPED_DOC);
  });

  it("does nothing (and does not crash) when no formatter is registered for the cell's language", async () => {
    // No stand-in registered this time — models "no extension installed".
    const editor = await openInMemory(DOC);
    moveCursor(editor, 8, 1);

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.formatCell")),
      "formatting with no registered formatter must not crash",
    );
    assert.strictEqual(editor.document.getText(), DOC, "the document must be unchanged");
  });

  it("filters out an edit outside the target cell's body (defense-in-depth)", async () => {
    registerStandIn();
    standInOutOfCellEdit = true;
    const editor = await openInMemory(DOC);
    moveCursor(editor, 8, 1);

    await vscode.commands.executeCommand("quarto.formatCell");

    assert.ok(
      !editor.document.getText().includes("HACKED"),
      "an edit whose range lands outside the target cell must never be applied",
    );
  });

  it("sees the LATEST cell content on a second format call after an intervening edit (no staleness)", async () => {
    registerStandIn();
    const editor = await openInMemory(DOC);
    moveCursor(editor, 8, 1);

    await vscode.commands.executeCommand("quarto.formatCell");
    assert.strictEqual(calls.length, 1);

    await editor.edit((b) => {
      b.replace(new vscode.Range(9, 0, 9, 3), "y=99");
    });
    moveCursor(editor, 9, 1);
    await vscode.commands.executeCommand("quarto.formatCell");

    assert.strictEqual(calls.length, 2, "the stand-in should be invoked again after a real edit");
    assert.ok(
      calls[1].text.includes("y=99"),
      "the second forward must see the EDITED content, not a stale cached vdoc",
    );
  });

  it("does not crash when there is no active editor", async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.formatCell")),
      "formatting with no active editor must not crash",
    );
  });

  it("does nothing in a non-quarto editor", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: "x=1",
    });
    const editor = await vscode.window.showTextDocument(doc);

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.formatCell")),
      "formatting in a non-quarto editor must not crash",
    );
    assert.strictEqual(editor.document.getText(), "x=1");
  });

  it("contributes the Format Cell keybinding scoped to quarto code cells", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const keybindings: { command: string; when?: string; key?: string; mac?: string }[] =
      ext.packageJSON.contributes?.keybindings ?? [];
    const binding = keybindings.find((k) => k.command === "quarto.formatCell");
    assert.ok(binding, "quarto.formatCell should contribute a keybinding");
    assert.strictEqual(
      binding.when,
      "editorTextFocus && editorLangId == quarto && quarto.inCodeCell",
      "the keybinding must be restricted to quarto AND inside a code cell",
    );
  });
});
