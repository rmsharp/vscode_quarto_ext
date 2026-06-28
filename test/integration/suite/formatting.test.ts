import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** Open an in-memory Quarto document with the given content. */
async function openQuarto(content: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "quarto",
  });
  return vscode.window.showTextDocument(doc);
}

/** Set the editor selection by character offsets into the document. */
function select(editor: vscode.TextEditor, start: number, end: number): void {
  const doc = editor.document;
  editor.selection = new vscode.Selection(
    doc.positionAt(start),
    doc.positionAt(end),
  );
}

/** The text currently selected in the editor. */
function selectedText(editor: vscode.TextEditor): string {
  return editor.document.getText(editor.selection);
}

describe("Quarto: formatting toggles", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    // Discard in-memory edits so nothing persists between tests.
    await vscode.commands.executeCommand(
      "workbench.action.revertAndCloseActiveEditor",
    );
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the toggle command family", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      "quarto.toggleBold",
      "quarto.toggleItalic",
      "quarto.toggleCode",
    ]) {
      assert.ok(commands.includes(id), `${id} should be registered`);
    }
  });

  it("wraps the selection in ** and re-selects the inner text (faithful offset mapping)", async () => {
    const editor = await openQuarto("foo bar baz");
    select(editor, 4, 7); // "bar"

    await vscode.commands.executeCommand("quarto.toggleBold");

    assert.strictEqual(editor.document.getText(), "foo **bar** baz");
    assert.strictEqual(
      selectedText(editor),
      "bar",
      "the inner text should stay selected so a re-toggle unwraps it",
    );
  });

  it("round-trips: a second Toggle Bold unwraps through the real editor", async () => {
    const editor = await openQuarto("foo bar baz");
    select(editor, 4, 7);

    await vscode.commands.executeCommand("quarto.toggleBold");
    await vscode.commands.executeCommand("quarto.toggleBold");

    assert.strictEqual(editor.document.getText(), "foo bar baz");
    assert.strictEqual(selectedText(editor), "bar");
  });

  it("Toggle Italic uses a single *", async () => {
    const editor = await openQuarto("foo bar baz");
    select(editor, 4, 7);

    await vscode.commands.executeCommand("quarto.toggleItalic");

    assert.strictEqual(editor.document.getText(), "foo *bar* baz");
  });

  it("Toggle Code uses a backtick", async () => {
    const editor = await openQuarto("foo bar baz");
    select(editor, 4, 7);

    await vscode.commands.executeCommand("quarto.toggleCode");

    assert.strictEqual(editor.document.getText(), "foo `bar` baz");
  });

  it("wraps the word at a bare cursor (no selection)", async () => {
    const editor = await openQuarto("foo bar baz");
    select(editor, 5, 5); // cursor inside "bar"

    await vscode.commands.executeCommand("quarto.toggleBold");

    assert.strictEqual(editor.document.getText(), "foo **bar** baz");
    assert.strictEqual(selectedText(editor), "bar");
  });

  it("does nothing (and does not crash) in a non-Quarto editor", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "foo bar baz",
      language: "markdown",
    });
    const editor = await vscode.window.showTextDocument(doc);
    select(editor, 4, 7);

    await assert.doesNotReject(
      () =>
        Promise.resolve(vscode.commands.executeCommand("quarto.toggleBold")),
      "toggling in a non-quarto editor must not crash",
    );
    assert.strictEqual(
      editor.document.getText(),
      "foo bar baz",
      "a non-quarto document must be left unchanged",
    );
  });

  it("does not crash when there is no active editor", async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    await assert.doesNotReject(
      () =>
        Promise.resolve(vscode.commands.executeCommand("quarto.toggleBold")),
      "toggling with no active editor must not crash",
    );
  });

  it("contributes the bold/italic keybindings scoped to Quarto", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const keybindings: { command: string; when?: string }[] =
      ext.packageJSON.contributes?.keybindings ?? [];
    for (const command of ["quarto.toggleBold", "quarto.toggleItalic"]) {
      const binding = keybindings.find((k) => k.command === command);
      assert.ok(binding, `${command} should contribute a keybinding`);
      assert.ok(
        binding.when?.includes("editorLangId == quarto"),
        `${command} keybinding must be scoped to quarto`,
      );
    }
  });
});
