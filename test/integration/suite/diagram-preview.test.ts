import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** Open an in-memory document with the given language and content. */
async function open(content: string, language: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({ content, language });
  return vscode.window.showTextDocument(doc);
}

/** Every open tab whose input is the diagram-preview webview. */
function diagramPreviewTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap((g) => g.tabs)
    .filter(
      (t) =>
        t.input instanceof vscode.TabInputWebview &&
        /Diagram Preview/.test(t.label),
    );
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return predicate();
}

const MERMAID_DOC = "```{mermaid}\nflowchart LR\n  A --> B\n```\n";

describe("Quarto: Preview Diagram command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the quarto.previewDiagram command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.previewDiagram"),
      "quarto.previewDiagram should be registered after activation",
    );
  });

  it("contributes the Preview Diagram command under the Quarto category", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const commands: { command: string; category?: string }[] =
      ext.packageJSON.contributes?.commands ?? [];
    const cmd = commands.find((c) => c.command === "quarto.previewDiagram");
    assert.ok(cmd, "quarto.previewDiagram should be contributed");
    assert.strictEqual(cmd.category, "Quarto");
  });

  it("opens a diagram-preview webview for a Quarto document", async () => {
    await open(MERMAID_DOC, "quarto");

    await vscode.commands.executeCommand("quarto.previewDiagram");

    assert.ok(
      await waitFor(() => diagramPreviewTabs().length === 1, 5000),
      "a Diagram Preview webview should open for a quarto document",
    );
  });

  it("reuses a single panel when invoked repeatedly", async () => {
    await open(MERMAID_DOC, "quarto");

    await vscode.commands.executeCommand("quarto.previewDiagram");
    await vscode.commands.executeCommand("quarto.previewDiagram");
    await vscode.commands.executeCommand("quarto.previewDiagram");

    assert.ok(await waitFor(() => diagramPreviewTabs().length === 1, 5000));
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(
      diagramPreviewTabs().length,
      1,
      "re-invoking must reuse the one diagram-preview panel, not stack new ones",
    );
  });

  it("editing the tracked document keeps one panel (no stacking; edit->debounce path runs)", async () => {
    const editor = await open("intro prose\n", "quarto");
    await vscode.commands.executeCommand("quarto.previewDiagram");
    assert.ok(await waitFor(() => diagramPreviewTabs().length === 1, 5000));

    // Append a mermaid cell to the tracked doc — exercises the edit->debounce path.
    const edit = new vscode.WorkspaceEdit();
    const lastLine = editor.document.lineCount - 1;
    const end = new vscode.Position(
      lastLine,
      editor.document.lineAt(lastLine).text.length,
    );
    edit.insert(editor.document.uri, end, MERMAID_DOC);
    assert.ok(
      await vscode.workspace.applyEdit(edit),
      "the edit should apply to the tracked document",
    );

    // Wait past the debounce window. This proves the edit -> onDidChangeTextDocument
    // -> debounce -> render path runs without stacking a second panel or crashing;
    // the actual re-rendered webview CONTENT is F5-only residue (no API reads
    // another panel's HTML) and is covered by the pure findDiagramRegions/builder
    // unit tests.
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(
      diagramPreviewTabs().length,
      1,
      "editing the tracked document must reuse the one panel, not stack panels",
    );
  });

  it("does nothing (and does not crash) in a non-Quarto editor", async () => {
    await open(MERMAID_DOC, "markdown");

    await assert.doesNotReject(
      () =>
        Promise.resolve(
          vscode.commands.executeCommand("quarto.previewDiagram"),
        ),
      "previewing a diagram in a non-quarto editor must not crash",
    );
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(
      diagramPreviewTabs().length,
      0,
      "no diagram-preview panel should open for a non-quarto document",
    );
  });
});
