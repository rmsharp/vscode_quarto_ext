import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "vscode-quarto-ext.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/citations.qmd");

async function openFixture(): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(FIXTURE);
  await vscode.window.showTextDocument(doc);
  return doc;
}

/** A position just past the first '@' on a given 0-based line (the completion site). */
function afterAt(doc: vscode.TextDocument, line: number): vscode.Position {
  const at = doc.lineAt(line).text.indexOf("@");
  assert.ok(at >= 0, `line ${line} should contain an '@'`);
  return new vscode.Position(line, at + 1);
}

function labelText(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

/** The range a completion item replaces (handles the single-Range and insert/replace forms). */
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

/** The 0-based line index containing `needle`, or -1. */
function lineWith(doc: vscode.TextDocument, needle: string): number {
  for (let i = 0; i < doc.lineCount; i++) {
    if (doc.lineAt(i).text.includes(needle)) {
      return i;
    }
  }
  return -1;
}

async function completionsAt(
  doc: vscode.TextDocument,
  pos: vscode.Position,
): Promise<vscode.CompletionItem[]> {
  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    doc.uri,
    pos,
    "@",
  );
  return list?.items ?? [];
}

/**
 * Exercises the real registered citation completion provider exactly as the
 * editor does, over a fixture `.qmd` + `refs.bib` on disk. Environment-
 * independent — no Quarto CLI / Jupyter needed (Learnings #3/#9/#14/#15).
 */
describe("Quarto: Citation completion", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes citekeys from the bibliography after @", async () => {
    const doc = await openFixture();
    const labels = (await completionsAt(doc, afterAt(doc, 9))).map(labelText);
    for (const expected of ["@knuth1984", "@lamport1994"]) {
      assert.ok(
        labels.includes(expected),
        `completion should offer ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("attaches title detail to a citekey item", async () => {
    const doc = await openFixture();
    const items = await completionsAt(doc, afterAt(doc, 9));
    const knuth = items.find((i) => labelText(i) === "@knuth1984");
    assert.ok(knuth, "the @knuth1984 item should be present");
    assert.strictEqual(knuth.detail, "Literate Programming");
  });

  it("coexists with cross-ref completion (both fire on @)", async () => {
    const doc = await openFixture();
    const labels = (await completionsAt(doc, afterAt(doc, 9))).map(labelText);
    assert.ok(labels.includes("@knuth1984"), "a citation is offered");
    assert.ok(
      labels.includes("@sec-intro"),
      `the cross-ref is also offered; got ${JSON.stringify(labels)}`,
    );
  });

  it("offers no citekeys inside a code cell", async () => {
    const doc = await openFixture();
    // Line 13 ('# see @knuth1984') is inside the {python} cell.
    const labels = (await completionsAt(doc, afterAt(doc, 13))).map(labelText);
    const ours = labels.filter((l) => l === "@knuth1984" || l === "@lamport1994");
    assert.deepStrictEqual(ours, [], "no citekeys offered inside a code cell");
  });

  it("C: completes a colon citekey and replaces the whole token (no suffix dup)", async () => {
    const doc = await openFixture();
    const line = lineWith(doc, "@Knuth:1984");
    assert.ok(line >= 0, "fixture should contain an @Knuth:1984 reference");
    const at = doc.lineAt(line).text.indexOf("@");
    // Cursor mid-token, right after '@Knu'.
    const list = await completionsAt(doc, new vscode.Position(line, at + 4));
    const item = list.find((i) => labelText(i) === "@Knuth:1984");
    assert.ok(item, `colon citekey should be offered; got ${JSON.stringify(list.map(labelText))}`);
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, at, "replaces from the '@'");
    assert.strictEqual(
      range.end.character,
      at + "@Knuth:1984".length,
      "replace range spans the whole colon token (no ':1984' duplication on accept)",
    );
  });
});
