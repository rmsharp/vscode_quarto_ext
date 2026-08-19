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
  it("an escape inside the block defines no sec- label (Session 218)", async () => {
    // ⚠ THE CONSUMER THIS ITEM EXISTS FOR. `HEADING_ATTRIBUTE` is the ONLY source of
    // `Heading.id`, and it said only WHERE a block would be — so `{#sec-meth\:ods}`, which
    // quarto renders as ordinary TEXT while defining NO id at all (`scratchpad/s218/cal`,
    // `*_p13idesc`, with `*_p14idcolon` as the agreeing control), was stripped here and entered
    // in the cross-reference index. The editor offered a completion for a section identifier the
    // rendered document never defines: a reference that resolves here and dangles there. It was
    // the only open item that FABRICATED one.
    //
    // ⚠ Both assertions were pre-checked headlessly against `indexLabels` before this test was
    // written (`scratchpad/s218/pre/precheck218.test.ts`), per S211's gotcha 3.
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

    // ABSENT — the fabricated target. `\:` is an escaped colon, `\` is not an identifier
    // character, and the block is therefore not a block.
    const esc = await labelsAt(["# Methods {#sec-meth\\:ods}", "", "See @"].join("\n"));
    assert.ok(
      !esc.some((l) => l.includes("sec-meth")),
      `an escape defines no sec- label: ${JSON.stringify(esc)}`,
    );

    // PRESENT — ⚠ THE CONTROL, and it is the same bytes minus ONE backslash. A colon IS an
    // ordinary identifier character, so this block is valid and the target really exists
    // (`cal/*_p14idcolon` renders with `id="sec-p14:x"`). Without this row the assertion above
    // passes for a build whose cross-reference index has stopped working altogether.
    const plain = await labelsAt(["# Methods {#sec-meth:ods}", "", "See @"].join("\n"));
    assert.ok(
      plain.includes("@sec-meth:ods"),
      `the same id without the escape is defined: ${JSON.stringify(plain)}`,
    );
  });
  it("⚠ WHICH id a multi-id block defines is a READER SPLIT, on the completion surface (Session 219)", async () => {
    // The consumer the unit tests cannot reach: `indexLabels` feeds the cross-reference
    // COMPLETION, so a wrong id is a suggestion the author accepts and a link that resolves to
    // nothing in the rendered document.
    //
    // ⚠ All four assertions were pre-checked headlessly against `indexLabels` before this test
    // was written (`scratchpad/s219/pre/precheck219.test.ts`, 6 green), per S211's gotcha 3.
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

    // PRESENT / ABSENT — the pandoc default defines the LAST id (`id/none_t02sp2` renders
    // id="sec-t02b"), and this model offered the first.
    const last = await labelsAt(["# Methods {#sec-first #sec-last}", "", "See @"].join("\n"));
    assert.ok(
      last.includes("@sec-last") && !last.some((l) => l.includes("sec-first")),
      `the pandoc default defines the LAST id: ${JSON.stringify(last)}`,
    );

    // ⚠ THE SAME BYTES, THE OTHER READER — the row without which one rule looks sufficient.
    // `commonmark_x` defines the FIRST (`id/cmx_t02sp2`).
    const first = await labelsAt(
      ["---", "from: commonmark_x", "---", "", "# Methods {#sec-first #sec-last}", "", "See @"].join("\n"),
    );
    assert.ok(
      first.includes("@sec-first") && !first.some((l) => l.includes("sec-last")),
      `commonmark_x defines the FIRST id: ${JSON.stringify(first)}`,
    );

    // ABSENT — a `sec-` id that LOSES to a non-`sec-` one. Quarto defines `intro` here, so the
    // document has no cross-reference target on that heading at all, and this model offered
    // `sec-gone` — a fabricated target (`id/*_t17sec1`).
    const gone = await labelsAt(["# Methods {#sec-gone #intro}", "", "See @"].join("\n"));
    assert.ok(
      !gone.some((l) => l.includes("sec-gone")),
      `a sec- id that loses to a non-sec one defines no target: ${JSON.stringify(gone)}`,
    );

    // ABSENT — ⚠ the regression this session's own adversarial pass caught. A `#` inside a
    // key=VALUE is not an identifier (`adv/*_x01kvhash`), and scanning the raw block took it.
    const kv = await labelsAt(["# Methods {#sec-real key=#sec-fake}", "", "See @"].join("\n"));
    assert.ok(
      kv.includes("@sec-real") && !kv.some((l) => l.includes("sec-fake")),
      `a # inside a key=value is not a target: ${JSON.stringify(kv)}`,
    );
  });

  it("⚠ go-to-definition when one id is a PREFIX of the other (Session 219)", async () => {
    // The SECOND consumer, and the one the completion surface cannot see: the id string is
    // correct under both readers here and only its COLUMN is wrong, so a test that reads
    // completion labels passes while go-to-definition puts the cursor inside the other
    // identifier. Pre-checked headlessly (`precheck219.test.ts`, `findLabel`).
    const defAt = async (content: string, line: number, character: number) => {
      const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
      await vscode.window.showTextDocument(doc);
      const locs = await vscode.commands.executeCommand<vscode.Location[]>(
        "vscode.executeDefinitionProvider",
        doc.uri,
        new vscode.Position(line, character),
      );
      return locs?.[0];
    };

    // `commonmark_x` defines the FIRST id, `sec-t12`, whose text begins at column 19.
    // `lastIndexOf('#sec-t12')` found the one that OPENS `#sec-t12b` at 27.
    const cmx = [
      "---",
      "from: commonmark_x",
      "---",
      "",
      "# Cal T12 Prefix {#sec-t12 #sec-t12b}",
      "",
      "See @sec-t12 here.",
    ].join("\n");
    const at = await defAt(cmx, 6, 8);
    assert.ok(at, "a reference to the first id resolves");
    assert.deepStrictEqual(
      { line: at!.range.start.line, character: at!.range.start.character },
      { line: 4, character: 19 },
      "go-to-definition lands on the id it names, not inside the other one",
    );

    // The control on the same shape under the pandoc default, where the id taken is the second
    // and 28 is the only occurrence — right by construction rather than by care.
    const md = ["# Cal T12 Prefix {#sec-t12 #sec-t12b}", "", "See @sec-t12b here."].join("\n");
    const atMd = await defAt(md, 2, 8);
    assert.ok(atMd, "the control reference resolves");
    assert.deepStrictEqual(
      { line: atMd!.range.start.line, character: atMd!.range.start.character },
      { line: 0, character: 28 },
      "the pandoc control lands on the last id",
    );
  });

  it("S220: go-to-definition resolves a reference to an id holding a ':'", async () => {
    // ⚠ THE FILED DEFECT AT THE SURFACE AN AUTHOR MEETS IT ON. `# Methods {#sec-meth:ods}` is
    // indexed correctly and quarto renders `@sec-meth:ods` as a resolved cross-reference
    // (scratchpad/s220/cal/rt.qmd R01), but the use-side scanner truncated the token at the
    // colon, so `findLabel` was handed `sec-meth` and returned null — no navigation at all.
    // Pre-checked headlessly (`scratchpad/s220/pre/precheck220.test.ts`).
    const content = ["# Methods {#sec-meth:ods}", "", "See @sec-meth:ods here."].join("\n");
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    await vscode.window.showTextDocument(doc);
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(2, 8),
    );
    const at = locs?.[0];
    assert.ok(at, "a reference to an id containing ':' resolves");
    assert.deepStrictEqual(
      { line: at!.range.start.line, character: at!.range.start.character },
      { line: 0, character: 12 },
      "go-to-definition lands on the id text in the heading's attribute block",
    );
  });

  it("S220: completion still fires once a ':' has been typed, and replaces the whole token", async () => {
    // ⚠ THE SURFACE THAT DID NOT TRUNCATE BUT DIED. The old scanner walked [A-Za-z0-9_-], so
    // the backward walk stopped ON the colon, never reached the '@', and the provider was
    // handed a null context — the author was offered nothing at all after typing a ':'.
    const content = ["# Methods {#sec-meth:ods}", "", "See @sec-meth:o"].join("\n");
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    await vscode.window.showTextDocument(doc);
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 15),
      "@",
    );
    const items = list?.items ?? [];
    assert.ok(
      items.map(labelText).includes("@sec-meth:ods"),
      `completion should still offer @sec-meth:ods after a ':'; got ${JSON.stringify(items.map(labelText))}`,
    );
    // And the replace range must span the whole `@sec-meth:o` token, or accepting duplicates
    // the part already typed.
    const item = items.find((i) => labelText(i) === "@sec-meth:ods");
    const range = replaceRange(item!);
    assert.ok(range, "the completion item carries a replace range");
    assert.deepStrictEqual(
      {
        start: range!.start.character,
        end: range!.end.character,
      },
      { start: 4, end: 15 },
      "the replace range covers the '@' through the end of the typed token",
    );
  });

  it("S221: go-to-definition resolves a reference to a dotted inline label", async () => {
    // ⚠ THE HALF SESSION 220 LEFT BEHIND. That session taught `refIdAt` to READ `@fig-a.b`;
    // the definition side still mined `[A-Za-z0-9_-]`, so the label was indexed as `fig-a`
    // and the reference resolved to nothing. Quarto renders id="fig-a.b" for this exact
    // document and resolves the reference to it (scratchpad/s221/cal/attr.qmd t01,
    // resolve.qmd E01).
    //              ![p](p.png){#fig-a.b}
    //              0123456789012345678901   — the id text starts at column 13
    const content = ["![p](p.png){#fig-a.b}", "", "See @fig-a.b"].join("\n");
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    await vscode.window.showTextDocument(doc);
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(2, 8),
    );
    const at = locs?.[0];
    assert.ok(at, "a reference to a dotted inline id resolves");
    assert.deepStrictEqual(
      { line: at!.range.start.line, character: at!.range.start.character },
      { line: 0, character: 13 },
      "go-to-definition lands on the id text inside the attribute block",
    );
  });

  it("S221: completion offers a dotted CELL label under the name quarto defines", async () => {
    // The second definition source, and a different grammar reaching the same rule: quarto
    // writes the YAML label verbatim into a pandoc attribute block, so `#| label: fig-c.d`
    // defines `fig-c.d` (scratchpad/s221/cal/cell.qmd c01, cell3.qmd 9/9). This model used
    // to offer `@fig-c`, a target no document defines.
    const content = [
      "```{r}",
      "#| label: fig-c.d",
      "plot(1)",
      "```",
      "",
      "See @fig-c",
    ].join("\n");
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    await vscode.window.showTextDocument(doc);
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(5, 10),
      "@",
    );
    const items = list?.items ?? [];
    assert.ok(
      items.map(labelText).includes("@fig-c.d"),
      `completion should offer @fig-c.d; got ${JSON.stringify(items.map(labelText))}`,
    );
  });
  it("S222: go-to-definition reaches an id that is NOT first in its attribute block", async () => {
    // The lost-TP half of Session 222. `![p](p.png){.cls #fig-a.x}` renders id="fig-a.x" and
    // `@fig-a.x` resolves to it (scratchpad/s221/adv/adv.qmd a03, re-rendered as
    // scratchpad/s222/cal/cal.qmd g03). The old scan looked for the literal two characters
    // `{#`, so a class atom in front of the id made the whole label invisible.
    const content = ["![p](p.png){.cls #fig-a.x}", "", "See @fig-a.x"].join("\n");
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    await vscode.window.showTextDocument(doc);
    const locs = await vscode.commands.executeCommand<vscode.Location[]>(
      "vscode.executeDefinitionProvider",
      doc.uri,
      new vscode.Position(2, 8),
    );
    const at = locs?.[0];
    assert.ok(at, "a reference to an id behind a class atom resolves");
    assert.deepStrictEqual(
      { line: at!.range.start.line, character: at!.range.start.character },
      { line: 0, character: 18 },
      "go-to-definition lands on the id text, not on the start of the block",
    );
  });

  it("S222: completion no longer offers a label from a brace group quarto refuses", async () => {
    // The phantom half. `{#fig-a$b}` renders its braces as literal text and defines NO id
    // (scratchpad/s221/cal/attr.qmd t09, s222 cal.qmd v02), yet the unvalidated scan offered
    // `@fig-a` — a target the document does not contain. The agreeing control on the same
    // document is a well-formed block, which must still be offered.
    const content = [
      "![p](p.png){#fig-a$b}",
      "",
      "![q](q.png){#fig-ok.x}",
      "",
      "See @",
    ].join("\n");
    const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
    await vscode.window.showTextDocument(doc);
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(4, 5),
      "@",
    );
    const offered = (list?.items ?? []).map(labelText);
    assert.ok(
      offered.includes("@fig-ok.x"),
      `the valid block must still be offered; got ${JSON.stringify(offered)}`,
    );
    assert.ok(
      !offered.includes("@fig-a"),
      `a refused block must offer nothing; got ${JSON.stringify(offered)}`,
    );
  });
});
