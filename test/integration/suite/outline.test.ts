import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { assertRoutedThroughVdoc, VDOC_SELECTOR } from "./vdoc-assert";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const SAMPLE = path.resolve(ROOT, "test/fixtures/sample.qmd");
const SETEXT = path.resolve(ROOT, "test/fixtures/setext.qmd");
const BLANK_BEFORE_HEADER = path.resolve(ROOT, "test/fixtures/blank-before-header.qmd");
const SETEXT_FRESH_BLOCK = path.resolve(ROOT, "test/fixtures/setext-fresh-block.qmd");
const CLOSES_PARAGRAPH_FIXTURE = path.resolve(ROOT, "test/fixtures/closes-paragraph.qmd");
const CLOSES_PARAGRAPH_GATE_FIXTURE = path.resolve(
  ROOT,
  "test/fixtures/closes-paragraph-gate.qmd",
);
const CLOSES_PARAGRAPH_NARROW_FIXTURE = path.resolve(
  ROOT,
  "test/fixtures/closes-paragraph-narrow.qmd",
);
const CLOSES_PARAGRAPH_INDENT_FIXTURE = path.resolve(
  ROOT,
  "test/fixtures/closes-paragraph-indent.qmd",
);

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

/** Detail tag on the stand-in's items, so it can be told apart from any other node. */
const STANDIN_SYMBOL_NAME = "in_cell_fn";

interface SymbolForwardCall {
  /** The vdoc URI the stand-in was invoked on — proves the request routed through it. */
  uri: string;
  /** The vdoc text — proves the content provider served the per-cell-isolated document. */
  text: string;
}

let symbolCalls: SymbolForwardCall[] = [];
/** When true the stand-in still RECORDS the call but returns no symbols (§2.5 degradation case). */
let symbolStandInReturnsNothing = false;
const symbolDisposables: vscode.Disposable[] = [];

/**
 * Register a stand-in DocumentSymbolProvider for the in-cell-symbol-forwarding scheme
 * (mirrors `embedded.test.ts`'s `registerStandIn` for completion): the bare test host
 * has no Python/R/Julia extension, so this substitutes for one and records the
 * URI/text it was invoked on, proving the forward routed THROUGH a per-cell virtual
 * document. Keyed by `{scheme}` so it fires regardless of whether the vdoc's
 * languageId resolves in the bare host.
 */
function registerSymbolStandIn(): void {
  symbolDisposables.push(
    vscode.languages.registerDocumentSymbolProvider(
      VDOC_SELECTOR,
      {
        provideDocumentSymbols(document) {
          symbolCalls.push({ uri: document.uri.toString(), text: document.getText() });
          if (symbolStandInReturnsNothing) {
            return [];
          }
          return [
            new vscode.DocumentSymbol(
              STANDIN_SYMBOL_NAME,
              "",
              vscode.SymbolKind.Function,
              new vscode.Range(0, 0, 0, 1),
              new vscode.Range(0, 0, 0, 1),
            ),
          ];
        },
      },
    ),
  );
}

async function openInMemory(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
  await vscode.window.showTextDocument(doc);
  return doc;
}

async function symbolsForDoc(doc: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
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

  it("hides code-cell nodes when quarto.symbols.showCodeCellsInOutline is false", async () => {
    const config = vscode.workspace.getConfiguration("quarto");
    await config.update(
      "symbols.showCodeCellsInOutline",
      false,
      vscode.ConfigurationTarget.Global,
    );
    try {
      const symbols = await symbolsFor(SAMPLE);

      // Headings are unaffected — only cell nodes are hidden.
      const h1 = symbols[0];
      assert.deepStrictEqual(
        h1.children.map((c) => c.name),
        ["Embedded code cells", "Done"],
      );
      const embedded = h1.children[0];
      assert.strictEqual(
        embedded.children.length,
        0,
        "cell nodes should be hidden when the toggle is off",
      );
    } finally {
      await config.update(
        "symbols.showCodeCellsInOutline",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
    }
  });

  it("quarto.toggleCodeCellsInOutline flips the setting and the outline reflects it immediately", async () => {
    const config = vscode.workspace.getConfiguration("quarto");
    try {
      assert.strictEqual(
        config.get<boolean>("symbols.showCodeCellsInOutline"),
        true,
        "starts at the declared default",
      );

      await vscode.commands.executeCommand("quarto.toggleCodeCellsInOutline");
      assert.strictEqual(
        vscode.workspace
          .getConfiguration("quarto")
          .get<boolean>("symbols.showCodeCellsInOutline"),
        false,
        "first toggle turns the setting off",
      );
      let symbols = await symbolsFor(SAMPLE);
      assert.strictEqual(
        symbols[0].children[0].children.length,
        0,
        "outline reflects the off state immediately, no reopen needed",
      );

      await vscode.commands.executeCommand("quarto.toggleCodeCellsInOutline");
      assert.strictEqual(
        vscode.workspace
          .getConfiguration("quarto")
          .get<boolean>("symbols.showCodeCellsInOutline"),
        true,
        "second toggle turns the setting back on",
      );
      symbols = await symbolsFor(SAMPLE);
      assert.strictEqual(
        symbols[0].children[0].children.length,
        4,
        "outline reflects the on state immediately",
      );
    } finally {
      await config.update(
        "symbols.showCodeCellsInOutline",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
    }
  });

  it("populates the outline for a document mixing setext and ATX headings", async () => {
    const symbols = await symbolsFor(SETEXT);

    // One top-level setext H1: "Setext Title" (line 4, 0-based).
    assert.strictEqual(symbols.length, 1, "one top-level symbol");
    const h1 = symbols[0];
    assert.strictEqual(h1.name, "Setext Title");
    assert.strictEqual(h1.kind, vscode.SymbolKind.String);
    assert.strictEqual(h1.range.start.line, 4);
    assert.strictEqual(h1.selectionRange.start.line, 4);

    // Two level-2 children, one ATX (line 9) and one setext (line 13) —
    // both nest identically through the real, registered provider.
    assert.deepStrictEqual(
      h1.children.map((c) => c.name),
      ["ATX Subsection", "Setext Subsection"],
    );
    assert.strictEqual(h1.children[1].range.start.line, 13);
  });

  it("omits a heading pandoc renders as paragraph text, through the real provider (Session 180)", async () => {
    // THE WIRING EVIDENCE. The unit tests establish the DECISION; this establishes that the
    // registered DocumentSymbolProvider — the one the Outline view, breadcrumbs, sticky
    // scroll and Ctrl+T actually call — carries it.
    //
    // The fixture's premise is MEASURED, not assumed: `quarto render --to html` on these
    // exact bytes emits `Real Section` (h1), `Genuine Section` (h2) and
    // `Below A Thematic Break` (h1), and NO `Phantom Section` — that one is pressed against
    // the line above, so `blank_before_header` makes it paragraph text.
    const symbols = await symbolsFor(BLANK_BEFORE_HEADER);

    assert.deepStrictEqual(
      symbols.map((s) => s.name),
      ["Real Section", "Below A Thematic Break"],
      "the phantom section must not appear as a top-level symbol",
    );

    // `Genuine Section` still nests under `Real Section` — the phantom's disappearance must
    // not take the real sibling below it with it.
    assert.deepStrictEqual(
      symbols[0].children.map((c) => c.name),
      ["Genuine Section"],
    );

    // The thematic-break control. If the rule were written as bare adjacency — the fix the
    // backlog item prescribed — this heading would be deleted too, and it is one quarto
    // really renders.
    assert.strictEqual(symbols[1].children.length, 0);

    // Nothing anywhere in the tree is the phantom.
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    assert.ok(
      !flatten(symbols).includes("Phantom Section"),
      "no phantom heading at any depth of the outline",
    );
  });

  it("shows a setext heading below a block line, through the real provider (Session 181)", async () => {
    // THE WIRING EVIDENCE for the other direction. Session 180 proved a phantom is kept OUT
    // of the real provider; this proves a heading quarto really renders is put back IN.
    //
    // The fixture's premise is MEASURED, not assumed: `quarto render --to html` on these
    // exact bytes emits `Real Section` (h1), `Recovered Setext` (h1), `Genuine Child` (h2)
    // and `Below A Thematic Break` (h1), and NO `Not A Heading` — that underline follows a
    // two-line paragraph, which pandoc's `markdown` never promotes.
    //
    // Against the pre-Session-181 build this same document produced the outline
    //   [{ Real Section -> children: ["Genuine Child"] }]
    // — TWO whole sections missing from the Outline view, breadcrumbs and sticky scroll,
    // with `Genuine Child` nested under the wrong parent.
    const symbols = await symbolsFor(SETEXT_FRESH_BLOCK);

    assert.deepStrictEqual(
      symbols.map((s) => s.name),
      ["Real Section", "Recovered Setext", "Below A Thematic Break"],
      "the setext heading below the indented code block must be a top-level symbol",
    );

    // The recovered heading takes its rightful child with it — before this session
    // `Genuine Child` was nested under `Real Section` because its real parent did not exist.
    assert.deepStrictEqual(symbols[0].children.map((c) => c.name), []);
    assert.deepStrictEqual(symbols[1].children.map((c) => c.name), ["Genuine Child"]);

    // The multi-line-paragraph control: its underline is literal text, not a heading. This is
    // the assertion that fails if the rule is widened to "any block-ish line resets".
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    assert.ok(
      !flatten(symbols).includes("Not A Heading"),
      "a 2+-line paragraph must not promote at any depth of the outline",
    );
  });

  it("keeps an `=` run and an open-paragraph thematic break out, and puts the ATX sibling back (Session 182)", async () => {
    // THE WIRING EVIDENCE for Session 182, through the provider the Outline view, breadcrumbs,
    // sticky scroll and Ctrl+T all really call. This session's change moves the outline in
    // BOTH directions at once, so both are asserted on one document.
    //
    // The fixture's premise is MEASURED, not assumed: `quarto render --to html` on these exact
    // bytes emits `Real Section`, `Below A Thematic Break`, `Recovered Sibling` and
    // `Genuine Child` — and renders `=== # Not A Heading At All` and
    // `… *** # Also Not A Heading` as ordinary PARAGRAPH text, with no heading at all.
    //
    // Against the pre-Session-182 build this same document produced the outline
    //   [Real Section, Not A Heading At All, Also Not A Heading, Below A Thematic Break,
    //    Heading Above -> children: ["Genuine Child"]]
    // — TWO phantom top-level sections, `Recovered Sibling` missing outright, and
    // `Genuine Child` nested under the WRONG parent because its real parent did not exist.
    const symbols = await symbolsFor(CLOSES_PARAGRAPH_FIXTURE);

    assert.deepStrictEqual(
      symbols.map((s) => s.name),
      ["Real Section", "Below A Thematic Break", "Heading Above", "Recovered Sibling"],
      "both phantoms must be gone and the ATX sibling must be back, at top level",
    );

    // The recovered sibling takes its rightful child with it.
    assert.deepStrictEqual(symbols[2].children.map((c) => c.name), []);
    assert.deepStrictEqual(symbols[3].children.map((c) => c.name), ["Genuine Child"]);

    // Neither phantom may reappear at ANY depth.
    const flat = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flat(n.children)]);
    for (const phantom of ["Not A Heading At All", "Also Not A Heading"]) {
      assert.ok(!flat(symbols).includes(phantom), `${phantom} must not appear at any depth`);
    }
    // …and the control the fix must NOT delete: a heading below a break with a CLOSED
    // paragraph above it is real, and is the assertion that fails if the gate is inverted.
    assert.ok(flat(symbols).includes("Below A Thematic Break"));
  });

  it("gating CLOSES_PARAGRAPH on an open paragraph reaches the real Outline provider (Session 183)", async () => {
    // WIRING EVIDENCE, through the provider the Outline view, breadcrumbs, sticky scroll and
    // Ctrl+T actually call. The fixture's premise is MEASURED, not assumed — `quarto render`
    // on these exact bytes emits, in order:
    //   Real Section / Below Indented Code / Below A TeX Environment / (h2 quoted one) /
    //   Below A Quoted Setext / Genuine Child
    // and renders `# Not A Heading At All` as ordinary paragraph text.
    //
    // Against the pre-Session-183 build this document produced FOUR extra top-level sections
    // (`Not A Heading At All` among them), because every row of `CLOSES_PARAGRAPH` fired
    // regardless of whether a paragraph was open.
    const symbols = await symbolsFor(CLOSES_PARAGRAPH_GATE_FIXTURE);
    const flat = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flat(n.children)]);

    // THE FIX: the phantom is gone, at every depth.
    assert.ok(
      !flat(symbols).includes("Not A Heading At All"),
      "an indented line against an OPEN paragraph is lazy continuation, so the `#` line below it is not a heading",
    );

    // THE CONTROLS the gate must NOT delete — each is a real heading quarto renders, and each
    // fails if the corresponding exemption is removed:
    //   Below Indented Code      the paragraph is CLOSED, so the indent really is code
    //   Below A TeX Environment  \begin{...}/\end{...} interrupts an open paragraph
    //   Below A Quoted Setext    inside a block quote the gate is suspended
    for (const real of ["Real Section", "Below Indented Code", "Below A TeX Environment", "Below A Quoted Setext"]) {
      assert.ok(flat(symbols).includes(real), `${real} is a real heading and must survive the gate`);
    }

    // …and the real child still nests under its real parent.
    const parent = symbols.find((s) => s.name === "Below A Quoted Setext");
    assert.ok(parent, "Below A Quoted Setext must be a top-level section");
    assert.deepStrictEqual(parent.children.map((c) => c.name), ["Genuine Child"]);

    // TWO DISCLOSED RESIDUALS, asserted so they are a decision on the record rather than a
    // surprise. (1) We still emit `Below A Div Closer`: a `:::` is exempt from the gate
    // because a real div's closer follows its own body text, and gating it was measured to
    // delete four real headings — so this phantom is the permitted side of that trade.
    assert.ok(
      flat(symbols).includes("Below A Div Closer"),
      "KNOWN RESIDUAL: the closer-line exemption retains this phantom on purpose",
    );
    // (2) We do NOT emit quarto's `quoted one` — a SETEXT heading formed inside a block
    // quote's lazy continuation, which this model cannot see, having no block-quote context.
    // PRE-EXISTING and unchanged by this session.
    assert.ok(
      !flat(symbols).includes("quoted one"),
      "KNOWN RESIDUAL: a setext heading inside a block quote is invisible to this model",
    );
  });

  it("narrowing CLOSES_PARAGRAPH reaches the real Outline provider (Session 184)", async () => {
    // WIRING EVIDENCE, through the provider the Outline view, breadcrumbs, sticky scroll and
    // Ctrl+T actually call. The fixture's premise is MEASURED, not assumed: `quarto render` on
    // these exact bytes emits ELEVEN headings, and renders the `Not A Heading` line and both
    // `Residual Phantom` lines as ordinary paragraph text.
    //
    // The document discriminates the pre-Session-184 build in BOTH directions, which is what
    // makes it evidence rather than decoration. Against that build it shows:
    //   `Not A Heading — Footnote` PRESENT — the phantom this session removes
    //   `Below A Pre Block`         MISSING — the real heading Session 183's gate deleted
    const symbols = await symbolsFor(CLOSES_PARAGRAPH_NARROW_FIXTURE);
    const flat = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flat(n.children)]);
    const names = flat(symbols);

    // THE NARROWING that survived measurement: a `[^1]:` footnote definition absorbs the line
    // below it, so the `#` line is not a heading and must not reach the Outline.
    assert.ok(
      !names.includes("Not A Heading — Footnote"),
      "a footnote definition absorbs the line below it; quarto renders no heading there",
    );

    // THE CONTROLS. Each is a real heading quarto renders, and each fails if the corresponding
    // row is narrowed one character too far — every one was deleted by some candidate this
    // session built and measured before rejecting it:
    //   Below A Pre Block           the heading Session 183 deleted; condition-1 tags now sit
    //                               in the hoisted interrupter
    //   Below A Link Reference      `[x]:` still closes — only a VALID footnote label excludes
    //   Below An Empty Label        `[]:` closes; OPENS_FRESH_BLOCK's borrowed form deletes it
    //   Below A Caret With A Space  `[^ 1]:` is no footnote label; a bare `(?!\^)` deletes it
    //   Below A Meta Tag            outside CommonMark §6 and still a raw HTML block
    //   Below A Braced Macro        `\vspace{1em}` is a raw BLOCK; braces do not mean inline
    //   Below A Lone Plus           a bare `+` is an EMPTY LIST ITEM and really is block-level
    for (const real of [
      "Real Section",
      "Below A Link Reference",
      "Below An Empty Label",
      "Below A Caret With A Space",
      "Below A Pre Block",
      "Below A Div",
      "Below A Meta Tag",
      "Below A Braced Macro",
      "Below A Bare Macro",
      "Below A Lone Plus",
    ]) {
      assert.ok(names.includes(real), `${real} is a real heading and must survive the narrowing`);
    }

    // …and the real child still nests under its real parent, so the TREE is right and not
    // merely the set. A deleted parent silently re-parents its children.
    const parent = symbols.find((s) => s.name === "Below A Lone Plus");
    assert.ok(parent, "Below A Lone Plus must be a top-level section");
    assert.deepStrictEqual(parent.children.map((c) => c.name), ["Genuine Child"]);

    // ⚠ ONE OF THE TWO DISCLOSED RESIDUALS IS GONE (Session 187), and the assertion is
    // inverted rather than deleted so the change of decision stays on the record. Session 184
    // wrote that "pandoc classifies these by TAG and by MACRO NAME, not by the shape of the
    // line, and this model has neither table" — correct, and Session 187 transcribed the TAG
    // table (pandoc 3.6.3 `Text.Pandoc.Readers.HTML.TagCategories`, then measured entry by
    // entry over 2,051 rendered documents). So the inline-TAG phantom is fixed here, at the
    // real provider, and the inline-MACRO one is not: the block-macro list is a different
    // artefact from a different reader and is deliberately out of scope.
    assert.ok(
      !names.includes("Residual Phantom — Inline Tag"),
      "Session 187: `<span>inline</span>` is prose, so this phantom must NO LONGER reach the Outline",
    );
    // ⚠ AND NOW THE SECOND ONE IS GONE (Session 188) — assertion INVERTED, not deleted, so the
    // change of decision stays on the record exactly as S187's did. The block-MACRO list that
    // S184 said this model lacked and S187 left "deliberately out of scope" is now transcribed
    // from `Text.Pandoc.Readers.LaTeX` at pandoc 3.6.3 and MEASURED entry by entry over 5,680
    // rendered documents. `\textbf{bold}` is class C — inline in every context — so quarto
    // renders no heading there and neither does the real provider any more.
    assert.ok(
      !names.includes("Residual Phantom — Inline TeX"),
      "Session 188: `\\textbf{bold}` is prose, so this phantom must NO LONGER reach the Outline",
    );

    // Nothing else at all — the exact set, which no per-name assertion can say.
    assert.deepStrictEqual(names, [
      "Real Section",
      "Below A Link Reference",
      "Below An Empty Label",
      "Below A Caret With A Space",
      "Below A Pre Block",
      "Below A Div",
      "Below A Meta Tag",
      "Below A Braced Macro",
      "Below A Bare Macro",
      "Below A Lone Plus",
      "Genuine Child",
    ]);
  });

  it("an INDENTED HTML block and a LINE BLOCK reach the Outline (Session 185)", async () => {
    // Wiring evidence, not a second unit test: this goes through the REGISTERED
    // DocumentSymbolProvider — the one backing the Outline view, breadcrumbs, sticky scroll
    // and Ctrl+T — so it proves the repair reaches the surface a user actually sees.
    //
    // The fixture's premise is MEASURED, not assumed. `quarto render --to html --no-execute`
    // (quarto 1.7.33) on those exact bytes emits exactly six headings:
    //   Real Section, Below An Indented Div, Below A Tab Indented Pre, Below A Line Block,
    //   Genuine Child, Below A Line Block After A Table
    // Against the pre-Session-185 build the same document produced only THREE — the four
    // indented-HTML and line-block headings were deleted outright.
    //
    // ⚠ Every construct in the fixture is pressed directly against prose on purpose. With a
    // blank line above it the same line is an indented CODE block and the heading below is
    // real for a reason that has nothing to do with this repair — a first draft of this
    // fixture made exactly that mistake, and rendering it is what caught it.
    const symbols = await symbolsFor(CLOSES_PARAGRAPH_INDENT_FIXTURE);
    const flat = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flat(n.children)]);
    const names = flat(symbols);

    // THE REPAIR — four real headings the pre-Session-185 build deleted.
    for (const real of [
      "Below An Indented Div", //          `    <div>` against an open paragraph
      "Below A Tab Indented Pre", //       a tab-indented block, body and closer included
      "Below A Line Block", //             `| line one` / `  continued` / `| line three`
      "Below A Line Block After A Table", // the table's spell broken by the blank line
    ]) {
      assert.ok(names.includes(real), `${real} is a real heading the repair must recover`);
    }

    // THE GUARDS — quarto renders no heading at any of these, and neither may we. Each fails
    // if the corresponding guard is dropped, and each was measured before being asserted.
    for (const phantom of [
      "Not A Heading — Indented Inline Tag", //     the TAG decides, not the indent
      "Not A Heading — Line Block In A Paragraph", // a line block cannot interrupt a paragraph
      "Not A Heading — Under A Table", //           a delimiter row makes it a table
    ]) {
      assert.ok(!names.includes(phantom), `quarto renders no heading at "${phantom}"`);
    }

    // …and the real child still nests under its real parent, so the TREE is right and not
    // merely the set. A deleted parent silently re-parents its children.
    const parent = symbols.find((s) => s.name === "Below A Line Block");
    assert.ok(parent, "Below A Line Block must be a top-level section");
    assert.deepStrictEqual(parent.children.map((c) => c.name), ["Genuine Child"]);

    // ⚠ THIS RESIDUAL IS GONE TOO (Session 187), and again the assertion is inverted rather
    // than deleted. An UNCLOSED `<textarea>` swallows the rest of the document on the real
    // render path, so quarto renders no heading below it — and `textarea` is now off the
    // OPENER list, because it is RCDATA and its unclosed opener opens nothing. Its CLOSER is
    // still a block closer, and a BALANCED `<textarea>x</textarea>` on one line still
    // interrupts a paragraph; dropping those two cases with it was measured deleting three
    // real headings before it shipped.
    //
    // ⚠ The FILED ITEM this residual pointed at is only PARTLY drained: `<pre>`, `<script>`
    // and `<style>` are not RCDATA in the same way and an unclosed one still swallows the
    // document while we emit headings from inside it. That item stays open.
    assert.ok(
      !names.includes("Residual Phantom — Unclosed Textarea"),
      "Session 187: an unclosed <textarea> opens nothing, so this phantom must be gone",
    );

    // Nothing else at all — the exact set, which no per-name assertion can say.
    assert.deepStrictEqual(names, [
      "Real Section",
      "Below An Indented Div",
      "Below A Tab Indented Pre",
      "Below A Line Block",
      "Genuine Child",
      "Below A Line Block After A Table",
    ]);
  });
});

describe("Quarto: in-cell code symbol forwarding (CHANGELOG: outline granularity, in-cell code symbols + show/hide toggle, Sessions 71-73 slice 2)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    symbolCalls = [];
    symbolStandInReturnsNothing = false;
  });

  afterEach(async () => {
    for (const d of symbolDisposables.splice(0)) {
      d.dispose();
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("forwards in-cell python symbols as children of the cell node, through the file: vdoc", async () => {
    registerSymbolStandIn();
    const doc = await openInMemory(["```{python}", "def foo(): pass", "```"].join("\n"));

    const symbols = await symbolsForDoc(doc);

    assert.strictEqual(symbols.length, 1, "one top-level cell node (no headings)");
    const cellNode = symbols[0];
    assert.strictEqual(cellNode.name, "```{python}");
    assert.deepStrictEqual(
      cellNode.children.map((c) => c.name),
      [STANDIN_SYMBOL_NAME],
      "the stand-in's symbol should be forwarded as the cell node's child",
    );
    assert.strictEqual(symbolCalls.length, 1, "the stand-in should be invoked once");
    assertRoutedThroughVdoc(
      symbolCalls[0].uri,
      "in-cell symbols must route through our real file: virtual document",
    );
  });

  it("isolates a same-language sibling cell (per-cell vdoc, not buildVirtualContent's shared-language one)", async () => {
    registerSymbolStandIn();
    const doc = await openInMemory(
      ["```{python}", "import numpy as np", "```", "```{python}", "np.array([1])", "```"].join(
        "\n",
      ),
    );

    await symbolsForDoc(doc);

    assert.strictEqual(symbolCalls.length, 2, "each cell forwards through its own vdoc");

    // Match the calls by CONTENT, never by arrival order. The cells are forwarded
    // concurrently (`Promise.all` in outline.ts), so the order the stand-in is invoked in
    // is not defined. This test used to index symbolCalls[0]/[1] positionally and got away
    // with it only because the old content-provider answered synchronously; once the vdoc
    // became a real file, the disk I/O made the race visible and the test flaked. The
    // PRODUCT was never order-dependent — each cell's children come from its own forward's
    // return value — which is what the real-Pylance suite proves directly.
    const first = symbolCalls.find((c) => c.text.includes("import numpy as np"));
    const second = symbolCalls.find((c) => c.text.includes("np.array([1])"));

    assert.ok(first, "one vdoc must carry the first cell's body");
    assert.ok(second, "one vdoc must carry the second cell's body");
    assert.ok(
      !first.text.includes("np.array([1])"),
      "the first cell's vdoc must blank its same-language sibling, not merge with it",
    );
    assert.ok(
      !second.text.includes("import numpy as np"),
      "the second cell's vdoc must blank its same-language sibling, not merge with it",
    );
    assert.notStrictEqual(
      first.uri,
      second.uri,
      "the two cells must not share a vdoc path — concurrent writes would race",
    );
  });

  it("does not forward (and does not invoke the stand-in) for an unmapped-language cell", async () => {
    registerSymbolStandIn();
    const doc = await openInMemory(["```{bash}", "echo hi", "```"].join("\n"));

    const symbols = await symbolsForDoc(doc);

    assert.deepStrictEqual(symbols[0].children, [], "an unmapped-language cell has no children");
    assert.strictEqual(symbolCalls.length, 0, "the stand-in must not be invoked for {bash}");
  });

  it("degrades to zero children (no throw) when the forwarded provider yields nothing", async () => {
    symbolStandInReturnsNothing = true;
    registerSymbolStandIn();
    const doc = await openInMemory(["```{python}", "x = 1", "```"].join("\n"));

    let symbols: vscode.DocumentSymbol[] = [];
    await assert.doesNotReject(async () => {
      symbols = await symbolsForDoc(doc);
    }, "forwarding into a cell whose provider yields nothing must not throw");

    assert.strictEqual(symbolCalls.length, 1, "the cell must still forward through the vdoc");
    assert.deepStrictEqual(symbols[0].children, [], "an empty upstream result degrades to no children");
  });

  it("mints a fresh vdoc URI when the cell is edited between outline computations (defeats the per-URI symbol cache, plan §2.3)", async () => {
    // Calling executeDocumentSymbolProvider twice with NO intervening document
    // change does NOT re-invoke our provider a second time (VS Code only
    // recomputes the outline on an actual text change — plan §2.3's Fork 1
    // finding: "document text changes (keystrokes)" is the one reliably-observed
    // trigger). So the faithful reproduction of the staleness risk is an EDIT
    // between two computations — the exact scenario Learning #78 found dangerous
    // for the top-level provider, now proven for the new in-cell store too.
    registerSymbolStandIn();
    const doc = await openInMemory(["```{python}", "x = 1", "```"].join("\n"));
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);

    await symbolsForDoc(doc);
    assert.ok(
      symbolCalls[0]?.text.includes("x = 1"),
      "the first forward should see the original body",
    );

    await editor.edit((b) =>
      b.replace(new vscode.Range(1, 0, 1, "x = 1".length), "y = 2"),
    );
    await symbolsForDoc(doc);

    assert.strictEqual(symbolCalls.length, 2, "the edit should trigger a fresh outline computation");
    assert.ok(
      symbolCalls[1].text.includes("y = 2"),
      "the second forward must reflect the edit, not serve a stale virtual document",
    );
    assert.notStrictEqual(
      symbolCalls[0].uri,
      symbolCalls[1].uri,
      "each computation must mint a DIFFERENT vdoc URI, or a real language server's own " +
        "internal per-URI cache would serve stale in-cell symbols after the edit (Learning #78)",
    );
  });

  it("does not invoke the stand-in at all when quarto.symbols.showCodeCellsInOutline is off", async () => {
    registerSymbolStandIn();
    const config = vscode.workspace.getConfiguration("quarto");
    await config.update("symbols.showCodeCellsInOutline", false, vscode.ConfigurationTarget.Global);
    try {
      const doc = await openInMemory(["```{python}", "x = 1", "```"].join("\n"));

      const symbols = await symbolsForDoc(doc);

      assert.strictEqual(symbols.length, 0, "cell nodes are hidden entirely when the toggle is off");
      assert.strictEqual(
        symbolCalls.length,
        0,
        "no forwarding call should be made for a cell that isn't even shown",
      );
    } finally {
      await config.update("symbols.showCodeCellsInOutline", undefined, vscode.ConfigurationTarget.Global);
    }
  });
});
