import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const SAMPLE = path.resolve(ROOT, "test/fixtures/sample.qmd");

/**
 * Ask the editor for the document symbols the same way the Outline view and
 * breadcrumbs do. This exercises the real registered DocumentSymbolProvider
 * end-to-end and is environment-independent (no Quarto CLI / Jupyter needed).
 */
async function symbolsFor(file: string): Promise<vscode.DocumentSymbol[]> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  const result = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    doc.uri,
  );
  return result ?? [];
}

describe("Quarto: Document outline (symbols)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("populates the outline for sample.qmd with headings and cells", async () => {
    const symbols = await symbolsFor(SAMPLE);

    // One top-level heading: "# Heading One" (line 10, 0-based).
    assert.strictEqual(symbols.length, 1, "one top-level symbol");
    const h1 = symbols[0];
    assert.strictEqual(h1.name, "Heading One");
    assert.strictEqual(h1.kind, vscode.SymbolKind.String);
    assert.strictEqual(h1.range.start.line, 10);
    assert.strictEqual(h1.selectionRange.start.line, 10);

    // Two level-2 children: "Embedded code cells" (26) and "Done" (78).
    assert.deepStrictEqual(
      h1.children.map((c) => c.name),
      ["Embedded code cells", "Done"],
    );

    // The four executable cells nest under "Embedded code cells"; the plain
    // ```python fence (line 74) is NOT a cell and must be absent.
    const embedded = h1.children[0];
    assert.deepStrictEqual(
      embedded.children.map((c) => c.name),
      ["```{python}", "```{r}", "```{julia}", "```{ojs}"],
    );
    assert.strictEqual(
      embedded.children[0].kind,
      vscode.SymbolKind.Function,
      "cells use a distinct symbol kind from headings",
    );
    assert.strictEqual(embedded.children[0].range.start.line, 30);

    // "## Done" has no cells after it.
    assert.strictEqual(h1.children[1].children.length, 0);
  });
});
