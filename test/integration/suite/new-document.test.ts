import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** Stub `showInputBox` to resolve to `value` for the duration of `fn`, restoring the original in `finally`. */
async function withStubbedInputBox<T>(
  value: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showInputBox;
  windowAny.showInputBox = () => Promise.resolve(value);
  try {
    return await fn();
  } finally {
    windowAny.showInputBox = original;
  }
}

describe("Quarto: New Quarto Document command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the quarto.newDocument command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.newDocument"),
      "quarto.newDocument should be registered after activation",
    );
  });

  it("opens a new unsaved quarto-language document with the entered title (showInputBox stubbed, Dragon G2)", async () => {
    await withStubbedInputBox("Integration Test Doc", () =>
      Promise.resolve(vscode.commands.executeCommand("quarto.newDocument")),
    );

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, "a new editor should be active");
    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(editor?.document.isUntitled, true);
    assert.strictEqual(
      editor?.document.getText(),
      '---\ntitle: "Integration Test Doc"\nformat: html\n---\n\n',
    );
  });

  it('falls back to "Untitled" when showInputBox is cancelled (Escape -> undefined)', async () => {
    await withStubbedInputBox(undefined, () =>
      Promise.resolve(vscode.commands.executeCommand("quarto.newDocument")),
    );

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, "a new editor should be active");
    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(
      editor?.document.getText(),
      '---\ntitle: "Untitled"\nformat: html\n---\n\n',
    );
  });
});

/**
 * Item 17c — the create-document-family discoverability presets. Two extra
 * commands share `newDocument`'s untitled-buffer path, differing only in
 * preset format (`quarto.newPresentation` → `revealjs`) or in surfacing
 * (`quarto.fileNewDocument` → the File▸New File… menu, `format: html`).
 */
describe("Quarto: create-document-family preset commands (item 17c)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the quarto.newPresentation and quarto.fileNewDocument commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.newPresentation"),
      "quarto.newPresentation should be registered after activation",
    );
    assert.ok(
      commands.includes("quarto.fileNewDocument"),
      "quarto.fileNewDocument should be registered after activation",
    );
  });

  it("quarto.newPresentation opens a new unsaved quarto document with format: revealjs", async () => {
    await withStubbedInputBox("My Talk", () =>
      Promise.resolve(
        vscode.commands.executeCommand("quarto.newPresentation"),
      ),
    );

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, "a new editor should be active");
    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(editor?.document.isUntitled, true);
    assert.strictEqual(
      editor?.document.getText(),
      '---\ntitle: "My Talk"\nformat: revealjs\n---\n\n',
    );
  });

  it("quarto.fileNewDocument opens a new unsaved quarto document with format: html (same path as newDocument)", async () => {
    await withStubbedInputBox("From File Menu", () =>
      Promise.resolve(
        vscode.commands.executeCommand("quarto.fileNewDocument"),
      ),
    );

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, "a new editor should be active");
    assert.strictEqual(editor?.document.languageId, "quarto");
    assert.strictEqual(editor?.document.isUntitled, true);
    assert.strictEqual(
      editor?.document.getText(),
      '---\ntitle: "From File Menu"\nformat: html\n---\n\n',
    );
  });

  it("contributes quarto.fileNewDocument to the file/newFile menu (File▸New discoverability)", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    const menus = ext.packageJSON?.contributes?.menus ?? {};
    const fileNewFile: { command?: string }[] = menus["file/newFile"] ?? [];
    assert.ok(
      fileNewFile.some((m) => m.command === "quarto.fileNewDocument"),
      "quarto.fileNewDocument should be contributed to the file/newFile menu",
    );
  });
});
