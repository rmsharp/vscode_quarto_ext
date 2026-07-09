import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

function labelText(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

async function openQuartoDoc(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "quarto",
  });
  await vscode.window.showTextDocument(doc);
  return doc;
}

/**
 * These exercise the REAL contributed snippets exactly as the editor's own
 * suggest widget does (`vscode.executeCompletionItemProvider` surfaces VS
 * Code's built-in configuration-based snippet provider alongside any
 * language-server completions), not just the manifest-shape check in
 * test/unit/snippets.test.ts.
 */
describe("Quarto: contributed snippets", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("offers the qpy snippet by prefix in a quarto document", async () => {
    const doc = await openQuartoDoc("qpy");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(0, 3),
    );
    const labels = (list?.items ?? []).map(labelText);
    assert.ok(
      labels.includes("qpy"),
      `completion should offer the qpy snippet; got ${JSON.stringify(labels)}`,
    );
  });

  it("does NOT offer a quarto snippet in a plain markdown document (language-scoped)", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "qpy",
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(0, 3),
    );
    const labels = (list?.items ?? []).map(labelText);
    assert.ok(
      !labels.includes("qpy"),
      `qpy is a quarto-scoped snippet and should not leak into markdown; got ${JSON.stringify(labels)}`,
    );
  });
});
