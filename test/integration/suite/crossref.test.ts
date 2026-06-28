import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/crossrefs.qmd");
const IN_CELL = path.resolve(ROOT, "test/fixtures/crossrefs-incell.qmd");

async function openFixture(file: string = FIXTURE): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  return doc;
}

/** The range a completion item replaces (handles both the single-Range and insert/replace forms). */
function replaceRange(item: vscode.CompletionItem): vscode.Range | undefined {
  const r = item.range as
    | vscode.Range
    | { inserting: vscode.Range; replacing: vscode.Range }
    | undefined;
  if (!r) {
    return undefined;
  }
  return "replacing" in r ? r.replacing : r;
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

  it("E: completion replace range covers the whole @id token, not just up to the cursor", async () => {
    const doc = await openFixture();
    // Line 8 "See @sec-methods …": cursor right after '@' (col 5); the token
    // '@sec-methods' spans [4,16). Accepting must replace the whole token.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(8, 5),
      "@",
    );
    const item = (list?.items ?? [])[0];
    assert.ok(item, "at least one completion item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 4, "replaces from the '@'");
    assert.strictEqual(
      range.end.character,
      16,
      "replaces through the end of the existing '@sec-methods' token",
    );
  });

  it("F/G: offers no cross-ref completions inside a code cell", async () => {
    const doc = await openFixture(IN_CELL);
    // Line 11 is inside the {python} cell; col 7 is right after an '@'.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 7),
      "@",
    );
    const ours = (list?.items ?? [])
      .map(labelText)
      .filter((l) => l.startsWith("@"));
    assert.deepStrictEqual(ours, [], "no @-labels offered inside a code cell");
  });

  it("F/G: go-to-definition does not fire on an @ref written inside a code cell", async () => {
    const doc = await openFixture(IN_CELL);
    // Line 11 col 23 sits inside '@sec-methods' written in a python comment.
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(11, 23),
    );
    assert.ok(!locs || locs.length === 0, "no definition from inside a cell");
  });

  it("F/G: go-to-definition still works on the same @ref in prose (control)", async () => {
    const doc = await openFixture(IN_CELL);
    // Line 8 col 29 sits inside '@sec-methods' in prose.
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(8, 29),
    );
    assert.ok(locs && locs.length > 0, "prose reference resolves");
    assert.strictEqual(locs[0].range.start.line, 6, "jumps to the heading");
  });
});
