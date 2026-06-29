import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/yaml-completion.qmd");

async function openFixture(): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(FIXTURE);
  await vscode.window.showTextDocument(doc);
  return doc;
}

function labelText(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

/** Items contributed by the Quarto YAML cell-option provider (tagged by `detail`). */
function cellOptionLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === "Quarto cell option")
    .map(labelText);
}

/** The range a completion item replaces (single-Range or insert/replace form). */
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

/**
 * Exercise the real registered YAML completion provider exactly as the editor
 * does, and verify the inverted provider-gating contract (plan §4.3): cell-option
 * keys complete on a `#|` line but never in prose, code, or front matter, and the
 * `@` providers still work in prose (no cross-pollution). Environment-independent
 * — no Quarto CLI / Jupyter needed (Learnings #3/#9/#14).
 */
describe("Quarto: YAML cell-option key completion", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes cell-option keys on a #| line in a {python} cell", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false" — cursor at col 3 (start of the key slot).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 3),
    );
    const labels = cellOptionLabels(list);
    for (const expected of ["echo", "eval", "output", "warning", "label", "fig-cap"]) {
      assert.ok(
        labels.includes(expected),
        `should offer cell option ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("replace range covers the whole key token on a mid-token cursor", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false": cursor at col 5 (inside "ec|ho"); key spans [3,7).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 5),
    );
    const item = (list?.items ?? []).find((i) => i.detail === "Quarto cell option");
    assert.ok(item, "at least one cell-option item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 3, "replaces from the key start");
    assert.strictEqual(range.end.character, 7, "replaces through the end of 'echo'");
  });

  it("offers NO cell-option keys on a prose line", async () => {
    const doc = await openFixture();
    // Line 8 "Some prose mentioning @sec-intro here." — col 4 is plain prose.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(8, 4),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no YAML items in prose");
  });

  it("offers NO cell-option keys on a code line inside the cell", async () => {
    const doc = await openFixture();
    // Line 12 "x = 1" — a code line, not a #| option line.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(12, 3),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no YAML items on code");
  });

  it("offers NO cell-option keys at a value position (past the colon)", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false" — col 9 is in the value 'false' (Slice 6d-2).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no key items at a value");
  });

  it("offers NO cell-option keys in YAML front matter", async () => {
    const doc = await openFixture();
    // Line 1 'title: …' — front matter, not a cell-option line.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 0),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no YAML items in front matter");
  });

  it("does not break @ cross-ref completion in prose (no cross-pollution)", async () => {
    const doc = await openFixture();
    // Line 8 col 23 — right after the '@' of '@sec-intro'.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(8, 23),
      "@",
    );
    const labels = (list?.items ?? []).map(labelText);
    assert.ok(
      labels.includes("@sec-intro"),
      `@ completion still works in prose; got ${JSON.stringify(labels)}`,
    );
  });
});
