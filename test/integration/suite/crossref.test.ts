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

  it("a reader without `header_attributes` defines no sec- label (Session 216)", async () => {
    // ⚠ THIS IS THE CONSUMER SESSION 215's CHANGE COULD NOT REACH AND THIS ONE CAN.
    // `HEADING_ATTRIBUTE` is the ONLY source of `Heading.id`, which `src/core/refs.ts` turns
    // into the `sec-` cross-reference index. Five of the nine measured readers render the block
    // as ordinary TEXT (`scratchpad/s216/cal`, 63 documents), so before this session a `gfm`
    // document offered a completion for a section identifier the rendered output never defines —
    // a reference that resolves in the editor and dangles in the document.
    //
    // ⚠ Both assertions were pre-checked headlessly against `indexLabels` before this test was
    // written (`scratchpad/s216/pre/precheck216.test.ts`), per S211's gotcha 3.
    const labelsAt = async (content: string) => {
      const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
      await vscode.window.showTextDocument(doc);
      const line = doc.lineCount - 1;
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        doc.uri,
        new vscode.Position(line, doc.lineAt(line).text.length),
        "@",
      );
      return (list?.items ?? []).map(labelText);
    };

    // ABSENT — `gfm` renders `# Methods {#sec-methods}` with the braces as literal text and
    // auto-generates a different identifier, so no `sec-methods` target exists.
    const gfm = await labelsAt(
      ["---", "from: gfm", "---", "", "# Methods {#sec-methods}", "", "See @"].join("\n"),
    );
    assert.ok(
      !gfm.includes("@sec-methods"),
      `gfm defines no sec- label: ${JSON.stringify(gfm)}`,
    );

    // PRESENT — ⚠ THE CONTROL, without which the assertion above passes for a build whose
    // cross-reference index has stopped working altogether. The same bytes, default reader.
    const dflt = await labelsAt(["# Methods {#sec-methods}", "", "See @"].join("\n"));
    assert.ok(
      dflt.includes("@sec-methods"),
      `the default reader still defines it: ${JSON.stringify(dflt)}`,
    );
  });

  it("an escaped backslash makes the attribute block real, so the sec- label exists (Session 217)", async () => {
    // ⚠ THE CONSUMER THE DECODE ALONE CANNOT REACH. This model has no auto-id generation, so
    // `indexLabels` reads only an explicit `Heading.id` — decoding heading TEXT can never move
    // the cross-reference index. The PARITY half can: `# Adv Esc Backslash \\{#sec-advesb}`
    // renders `h1:Adv Esc Backslash \` AND defines `id="sec-advesb"` (rendered firsthand,
    // `scratchpad/s217/pin/p3_twoslash`), and `(?<!\\)` saw one character and refused it.
    //
    // ⚠ Both assertions were pre-checked headlessly against `indexLabels` before this test was
    // written (`scratchpad/s217/pre/precheck217.test.ts`), per S211's gotcha 3.
    const labelsAt = async (content: string) => {
      const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
      await vscode.window.showTextDocument(doc);
      const line = doc.lineCount - 1;
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        doc.uri,
        new vscode.Position(line, doc.lineAt(line).text.length),
        "@",
      );
      return (list?.items ?? []).map(labelText);
    };

    // PRESENT — an EVEN run: the block is real and the target is offered.
    const even = await labelsAt(["# Adv Esc Backslash \\\\{#sec-advesb}", "", "See @"].join("\n"));
    assert.ok(
      even.includes("@sec-advesb"),
      `an escaped backslash leaves a real block: ${JSON.stringify(even)}`,
    );

    // ABSENT — ⚠ THE CONTROL, and it is the same bytes minus ONE backslash. `\{` is an escaped
    // brace, so quarto renders `Adv Esc Backslash {#sec-advesb}` as text and defines no id
    // (`pin/p3_oneslash`). Without this row the assertion above passes for a build that offers
    // the label for both spellings — which is what indexing on the brace alone would do.
    const odd = await labelsAt(["# Adv Esc Backslash \\{#sec-advesb}", "", "See @"].join("\n"));
    assert.ok(
      !odd.includes("@sec-advesb"),
      `an escaped BRACE defines no label: ${JSON.stringify(odd)}`,
    );
  });
});
