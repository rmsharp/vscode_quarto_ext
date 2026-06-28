import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "vscode-quarto-ext.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/crossrefs.qmd");

async function openFixture(): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(FIXTURE);
  await vscode.window.showTextDocument(doc);
  return doc;
}

function labelText(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

/**
 * These exercise the real registered cross-ref providers exactly as the editor
 * does (completion popup, Go to Definition) and are environment-independent — no
 * Quarto CLI / Jupyter needed (Learnings #3/#9/#14).
 */
describe("Quarto: Cross-reference completion + definition", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes every defined cross-ref label after @", async () => {
    const doc = await openFixture();
    // Line 8 "See @sec-methods …" — cursor right after the first '@' (col 5).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(8, 5),
      "@",
    );
    const labels = (list?.items ?? []).map(labelText);
    for (const expected of [
      "@sec-intro",
      "@sec-methods",
      "@fig-plot",
      "@fig-diagram",
      "@eq-einstein",
      "@tbl-data",
    ]) {
      assert.ok(
        labels.includes(expected),
        `completion should offer ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("offers no cross-ref completions outside a @ context", async () => {
    const doc = await openFixture();
    // Line 12 "Some prose referencing @tbl-data." — col 4 is plain prose.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(12, 4),
      undefined,
    );
    const ours = (list?.items ?? [])
      .map(labelText)
      .filter((l) => l.startsWith("@"));
    assert.deepStrictEqual(ours, [], "no @-labels outside a reference context");
  });

  it("resolves go-to-definition from @sec-methods to its heading", async () => {
    const doc = await openFixture();
    // Line 8, col 8 sits inside '@sec-methods'.
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(8, 8),
    );
    assert.ok(locs && locs.length > 0, "a definition should be returned");
    assert.strictEqual(
      locs[0].range.start.line,
      10,
      "should jump to the '## Methods {#sec-methods}' line",
    );
  });

  it("resolves go-to-definition from @fig-plot to its cell label", async () => {
    const doc = await openFixture();
    // Line 8 '@fig-plot' begins at col 21; col 24 is inside it.
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(8, 24),
    );
    assert.ok(locs && locs.length > 0, "a definition should be returned");
    assert.strictEqual(
      locs[0].range.start.line,
      15,
      "should jump to the '#| label: fig-plot' line",
    );
  });

  it("returns no definition for a non-reference position", async () => {
    const doc = await openFixture();
    // Line 8, col 0 is the 'S' of 'See' — not a reference.
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(8, 0),
    );
    assert.ok(!locs || locs.length === 0, "no definition off a reference");
  });
});
