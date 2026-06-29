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

/** Cell-option VALUE items contributed by the YAML provider (tagged by `detail`). */
function cellValueLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === "Quarto cell option value")
    .map(labelText);
}

/** Open an in-memory `.qmd`-language document (no fixture file needed). */
async function openInMemory(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
  await vscode.window.showTextDocument(doc);
  return doc;
}

/** The string form of a completion item's insertText. */
function insertTextOf(item: vscode.CompletionItem): string {
  const t = item.insertText;
  return typeof t === "string" ? t : (t?.value ?? "");
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

/**
 * Slice 6d-2 — cell-option VALUE completion. The provider offers a known key's
 * curated value enum after the colon, and only there: never at the key slot, in
 * prose, in front matter, or for an unknown key. Environment-independent.
 */
describe("Quarto: YAML cell-option value completion", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes the value enum after a known key (`#| echo: `)", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false" — col 9 is the start of the value slot.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    const labels = cellValueLabels(list);
    for (const expected of ["true", "false", "fenced"]) {
      assert.ok(
        labels.includes(expected),
        `should offer echo value ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("value replace range covers the whole value token", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false": value "false" spans [9,14).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto cell option value",
    );
    assert.ok(item, "at least one value item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 9, "replaces from the value start");
    assert.strictEqual(range.end.character, 14, "replaces through the end of 'false'");
  });

  it("inserts a value as-is when a space already follows the colon", async () => {
    const doc = await openFixture();
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto cell option value" && labelText(i) === "true",
    );
    assert.ok(item, "the 'true' value item");
    assert.strictEqual(insertTextOf(item), "true", "no leading space when one exists");
  });

  it("inserts a leading space when the value abuts the colon (`:` trigger)", async () => {
    // No space after the colon yet — accepting must produce valid `key: value`.
    const doc = await openInMemory("```{python}\n#| eval:\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 8), // right after the colon
      ":",
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto cell option value" && labelText(i) === "true",
    );
    assert.ok(item, `the 'true' value item; got ${JSON.stringify(cellValueLabels(list))}`);
    assert.strictEqual(insertTextOf(item), " true", "leading space added");
  });

  it("offers NO value items at the key slot", async () => {
    const doc = await openFixture();
    // Line 11 col 3 — the key slot, not a value position.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 3),
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items at the key");
  });

  it("offers NO values for an unknown key", async () => {
    const doc = await openInMemory("```{python}\n#| bogus:\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 9), // value position after "bogus:"
      ":",
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no values for an unknown key");
  });

  it("offers NO value items on a prose line with a colon (`:` must not pop)", async () => {
    const doc = await openInMemory("Some prose.\n\nA note: here.\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 8), // after "A note: "
      ":",
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items in prose");
  });

  it("offers NO value items inside a trailing inline comment", async () => {
    const doc = await openInMemory("```{python}\n#| echo: false  # note\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 19), // inside "# note"
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items in the comment");
  });

  it("offers NO value items in YAML front matter", async () => {
    const doc = await openFixture();
    // Line 3 "  enabled: false" — front matter; col 11 is past its colon.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(3, 11),
      ":",
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items in front matter");
  });
});
