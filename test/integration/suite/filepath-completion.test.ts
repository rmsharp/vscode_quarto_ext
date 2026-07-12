import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE_DIR = path.resolve(ROOT, "test/fixtures/filepath-completion");
const QUARTO_YML = path.resolve(FIXTURE_DIR, "_quarto.yml");

/** Our filepath completion items at `pos` in the fixture `_quarto.yml`. Filtering
 *  to File/Folder kind isolates ours — no other provider uses those kinds (plan
 *  §4.2 G4), so a stray word/snippet suggestion can never skew the result. */
async function fileCompletionsAt(
  pos: vscode.Position,
): Promise<vscode.CompletionItem[]> {
  const uri = vscode.Uri.file(QUARTO_YML);
  await vscode.workspace.openTextDocument(uri);
  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    uri,
    pos,
  );
  return (list?.items ?? []).filter(
    (i) =>
      i.kind === vscode.CompletionItemKind.File ||
      i.kind === vscode.CompletionItemKind.Folder,
  );
}

function labelText(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

describe("Quarto: _quarto.yml filepath completion", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("offers real project files/folders after `key: ` (base-dir listing)", async () => {
    // `bibliography: refs.bib` is line 2; the value starts at col 14.
    const items = await fileCompletionsAt(new vscode.Position(2, 14));
    const labels = items.map(labelText);
    assert.ok(labels.includes("refs.bib"), `expected refs.bib, got ${labels.join(",")}`);
    assert.ok(labels.includes("intro.qmd"), `expected intro.qmd, got ${labels.join(",")}`);
    assert.ok(
      labels.includes("chapters/"),
      `expected the chapters/ folder, got ${labels.join(",")}`,
    );
  });

  it("marks a directory entry with the Folder kind and a trailing `/`", async () => {
    const items = await fileCompletionsAt(new vscode.Position(2, 14));
    const chapters = items.find((i) => labelText(i).startsWith("chapters"));
    assert.ok(chapters, "expected a chapters entry in the base-dir listing");
    assert.strictEqual(labelText(chapters), "chapters/");
    assert.strictEqual(chapters.kind, vscode.CompletionItemKind.Folder);
  });

  it("re-scopes the listing into a subdirectory after typing `sub/`", async () => {
    // `  - chapters/part1.qmd` is line 4; cursor just past `chapters/` (col 13).
    const items = await fileCompletionsAt(new vscode.Position(4, 13));
    const labels = items.map(labelText).sort();
    assert.deepStrictEqual(
      labels,
      ["part1.qmd", "part2.qmd"],
      `expected only chapters/'s own entries, got ${labels.join(",")}`,
    );
  });

  it("fires after a `- ` sequence marker as well (base-dir listing)", async () => {
    // `  - chapters/part1.qmd` is line 4; cursor right after `- ` (col 4).
    const items = await fileCompletionsAt(new vscode.Position(4, 4));
    const labels = items.map(labelText);
    assert.ok(
      labels.includes("chapters/"),
      `expected chapters/ after the sequence marker, got ${labels.join(",")}`,
    );
    assert.ok(labels.includes("intro.qmd"), `expected intro.qmd, got ${labels.join(",")}`);
  });

  it("does NOT fire in a KEY position (gate-d discriminator)", async () => {
    // Cursor inside the `bibliography` key (line 2, col 5) — a key slot, not a value.
    const items = await fileCompletionsAt(new vscode.Position(2, 5));
    assert.deepStrictEqual(
      items.map(labelText),
      [],
      "completion must not fire in a key position",
    );
  });
});
