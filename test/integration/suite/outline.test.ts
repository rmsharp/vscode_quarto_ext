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
    // exact bytes emits `Real Section` (h1), `Recovered Setext` (h1), `Genuine Child` (h2),
    // `Below A Thematic Break` (h1) and — since Session 192 extended this fixture —
    // `Setext In A List (Session 192)` (h2) and `Recovered In A List` (h2), and NO
    // `Not A Heading`: that underline follows a two-line paragraph, which pandoc's
    // `markdown` never promotes. RE-RENDERED at Session 192, not carried over; the two new
    // headings are h2s and so nest below, which is why this test's TOP-LEVEL set is unchanged.
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

  it("anchors a setext underline at the containing block's content column, through the real provider (Session 192)", async () => {
    // THE WIRING EVIDENCE for Session 192, on the provider the Outline view, breadcrumbs,
    // sticky scroll and Ctrl+T all really call. The change moves the outline in BOTH
    // directions at once, so one document carries a control for each.
    //
    // The fixture's premise is MEASURED, not assumed — these exact bytes were re-rendered
    // through `quarto render --to html` this session, and quarto emits SIX headings:
    // `Real Section`, `Recovered Setext`, `Genuine Child`, `Below A Thematic Break`,
    // `Setext In A List (Session 192)` and `Recovered In A List` — and NO `Phantom Underline`.
    //
    // Against the pre-Session-192 build this same document produced, at the same provider:
    //   … `Setext In A List (Session 192)`, `Phantom Underline` (h1)
    // — the real `Recovered In A List` MISSING outright and a phantom top-level section in
    // its place. Both are measured, not argued: the pre-build's answer was read off the same
    // probe as the post-build's.
    const symbols = await symbolsFor(SETEXT_FRESH_BLOCK);
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const all = flatten(symbols);

    // PRESENT control — a setext underline at the list's own content column (4) IS an
    // underline. The pre-Session-192 ` {0,3}` cap could not reach column 4 at all, so this
    // heading was DELETED from the outline. This is the recovering direction.
    assert.ok(
      all.includes("Recovered In A List"),
      "a setext underline at the container's content column must reach the real provider",
    );

    // ABSENT control — a setext underline at column 3 with NO container open is NOT an
    // underline, and quarto renders no heading for it. The pre-Session-192 build emitted one.
    // This is the phantom-removing direction, and it is the assertion that fails if anyone
    // restores the ` {0,3}` cap.
    assert.ok(
      !all.includes("Phantom Underline"),
      "an underline at a column no open block starts at must not invent a section",
    );

    // The EXACT set, so a regression in either direction fails rather than only a widening.
    // Session 197 extended this fixture again and RE-RENDERED it; quarto emits all SIXTEEN on
    // these exact bytes, and emits NO heading for `Phantom Below A Tab`, `Phantom At Code
    // Depth` or `Tab Underline Past The Column`.
    //
    // ⚠ THIS IS THE ASSERTION A SESSION EXTENDING THE FIXTURE MUST FIND, and finding it by
    // running the suite costs a full screen-taking Extension Development Host run. Session 196
    // hit the OTHER exact-set pin (the top-level list at the top of this file) and recorded
    // "add `##`, not `#`" as the countermeasure; Session 197 followed that and hit THIS one
    // anyway, because any heading at any level extends the FLATTENED list. The countermeasure
    // that actually works is `grep -n "assert.deepStrictEqual" test/integration/suite/*.ts`
    // before touching a fixture, not a rule about heading levels.
    assert.deepStrictEqual(all, [
      "Real Section",
      "Recovered Setext",
      "Genuine Child",
      "Below A Thematic Break",
      "Setext In A List (Session 192)",
      "Recovered In A List",
      "Indented Code In A List (Session 193)",
      "Code Column In A List",
      "Content Column And Tabs (Session 194)",
      "Tab Macro In A List",
      "Tab Column Kept Open",
      "Container Opener Columns (Session 196)",
      "Tab Opened Column",
      "Code Depth Kept The Block",
      "Setext Underline Tabs (Session 197)",
      "Tab Underline At The Column",
    ]);
  });

  it("keeps a container open across a lazy line, and closes it at a list start, through the real provider (Session 198)", async () => {
    // THE WIRING EVIDENCE for Session 198, on the provider the Outline view, breadcrumbs,
    // sticky scroll and Ctrl+T all really call. The change moves the outline in BOTH
    // directions, so there is one document for each and the ABSENT case is asserted as
    // explicitly as the PRESENT one.
    //
    // ⚠ THIS TEST DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd`.
    // Sessions 196 and 197 each lost a full screen-taking Extension Development Host run by
    // extending that fixture and tripping an exact-set `assert.deepStrictEqual` over it — S196
    // the top-level list, S197 the FLATTENED list one comment above this file's line 375.
    // `openInMemory` gives this session's two documents their own scope, so no exact-set pin
    // can be extended by them at all. The grep that finds those pins is
    // `grep -n "assert.deepStrictEqual" test/integration/suite/*.ts`; it was run before this
    // test was written, not after it failed.
    //
    // Both documents were rendered through the real `quarto render --to html` path this
    // session (`scratchpad/s198/pins/famD_tab.qmd` and `ragged.qmd`) and the premises are
    // measured, not assumed: quarto emits `Ledger`, `Line one here.` AND `Real Title` for the
    // first, and `Eta Plain Title` ALONE for the second.
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);

    // PRESENT — a consumed setext underline must not arm the container pop. Against the
    // pre-Session-198 build this document produced `Ledger` and `Line one here.` only, with
    // `Real Title` deleted outright: the column-0 line below the underline closed a list
    // pandoc keeps open, so the underline at column 4 matched no column at all.
    const recovered = await openInMemory(
      ["## Ledger", "", "-   Item alpha.", "", "\tLine one here.", "\t---",
       "back at zero, lazily", "", "    Real Title", "    ==="].join("\n"),
    );
    const recoveredNames = flatten(await symbolsForDoc(recovered));
    assert.ok(
      recoveredNames.includes("Real Title"),
      `a consumed underline must not close the item below it: ${recoveredNames.join(", ")}`,
    );
    assert.ok(
      recoveredNames.includes("Line one here."),
      `the underline itself must still make its own heading: ${recoveredNames.join(", ")}`,
    );

    // ABSENT — the same one condition in the other direction. A shallower LIST START does
    // close the deeper column, so the underline at column 4 below it must match nothing. The
    // pre-Session-198 build emitted `Eta Ragged Title` here, a phantom section quarto does not
    // render; a fix that simply stopped popping would leave it in place.
    const drained = await openInMemory(
      ["Ragged stack probe.", "", "  - deep first item", "- shallow next item", "",
       "  Eta Ragged Title", "    ===", "", "- plain item", "", "  Eta Plain Title", "  ==="].join("\n"),
    );
    const drainedNames = flatten(await symbolsForDoc(drained));
    assert.ok(
      !drainedNames.includes("Eta Ragged Title"),
      `a shallower list marker must close the deeper column: ${drainedNames.join(", ")}`,
    );
    assert.ok(
      drainedNames.includes("Eta Plain Title"),
      `the control heading must survive the same edit: ${drainedNames.join(", ")}`,
    );
  });

  it("reads an ATX heading's indent as a COLUMN EQUALITY, through the real provider (Session 199)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — same reason as
    // the Session 198 test above, and the `grep -n "assert.deepStrictEqual"
    // test/integration/suite/*.ts` that finds the exact-set pins was run BEFORE this was
    // written. `openInMemory` keeps these documents out of every such pin's scope.
    //
    // Both documents were rendered through the real `quarto render --to html` path this
    // session and the premises are measured, not assumed: quarto emits `Tango Indented ATX`
    // for the first (`scratchpad/s199/ax/pin_s194_fam2.qmd`) and NO heading at all for the
    // second (`scratchpad/s199/gnd/top_i01_h1.qmd`, whose raw HTML is the literal paragraph
    // `<p># Probe Title</p>`).
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);

    // PRESENT — a heading AT its container's content column. The pre-Session-199 build lost
    // this outright: ` {0,3}` cannot see column 4, so the inner item's own heading was never a
    // heading at all. This was Session 194's filed FAMILY 2.
    const recovered = await openInMemory(
      ["Intro.", "", "- Site logistics", "  - Access road status", "",
       "    # Tango Indented ATX", "", "    Body text."].join("\n"),
    );
    const recoveredNames = flatten(await symbolsForDoc(recovered));
    assert.ok(
      recoveredNames.includes("Tango Indented ATX"),
      `a heading at the inner item's column 4 must reach the outline: ${recoveredNames.join(", ")}`,
    );

    // ABSENT — the same one rule in the other direction, and the half no cap could express.
    // An indent matching NO open column is not a heading: quarto renders `<p># Probe Title</p>`
    // here, and the pre-Session-199 build emitted a phantom `Probe Title` section because
    // CommonMark's 0-3 tolerance accepted column 1. A fix that merely widened the cap would
    // leave this in place.
    const drained = await openInMemory(
      ["Intro paragraph.", "", " # Probe Title", "", " Tail body line."].join("\n"),
    );
    const drainedNames = flatten(await symbolsForDoc(drained));
    assert.ok(
      !drainedNames.includes("Probe Title"),
      `an indent matching no open column is not a heading: ${drainedNames.join(", ")}`,
    );
    // CONTROL — the identical body at column 0, which must still be a heading. Without it the
    // assertion above passes for a build that has stopped finding headings altogether.
    const control = await openInMemory(
      ["Intro paragraph.", "", "# Probe Title", "", "Tail body line."].join("\n"),
    );
    const controlNames = flatten(await symbolsForDoc(control));
    assert.ok(
      controlNames.includes("Probe Title"),
      `the column-0 control must still be a heading: ${controlNames.join(", ")}`,
    );
  });

  it("reads a FENCE's indent as CONTAINER-RELATIVE, through the real provider (Session 200)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the third
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and
    // 197 a full screen-taking run each. `grep -n "assert.deepStrictEqual"
    // test/integration/suite/*.ts` was run BEFORE this was written and finds no such pin in
    // this file; `openInMemory` keeps these documents out of every one elsewhere.
    //
    // All three documents were rendered through the real `quarto render --to html` path this
    // session and every premise below is MEASURED, not assumed:
    //   `scratchpad/s200/pins/s197_famC_loss.qmd`  -> quarto emits `h1:Title After Fence`
    //   `scratchpad/s200/hdg/b4_i04_inside.qmd`    -> quarto emits NO heading
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);

    // PRESENT — the LOSS direction, and the shape the BACKLOG item was filed on. The
    // pre-Session-200 build lost this outright: `FENCE_OPEN`'s ` {0,3}` cap could not reach
    // column 4, so the fence was never a fence, the title below its closer was line four of
    // one long paragraph, and the underline had nothing at `consecutiveBody === 1` to promote.
    const recovered = await openInMemory(
      ["Intro.", "", "-   line one", "", "    ```", "    code", "    ```",
       "    Title After Fence", "    ==="].join("\n"),
    );
    const recoveredNames = flatten(await symbolsForDoc(recovered));
    assert.ok(
      recoveredNames.includes("Title After Fence"),
      `a title below a fence at the item's column 4 must reach the outline: ${recoveredNames.join(", ")}`,
    );

    // ABSENT — the PHANTOM direction, which the filed item did not name and this session's
    // corpus measured. With the fence recognised, everything between the runs is literal code;
    // the pre-Session-200 build read those lines as ordinary markdown and, since Session 199
    // accepts a heading AT a container's content column, emitted a `Inside Probe` section
    // quarto does not render. A fix that only widened the loss direction leaves this in place.
    const drained = await openInMemory(
      ["-   item one", "", "    ```", "", "    # Inside Probe", "", "    ```"].join("\n"),
    );
    const drainedNames = flatten(await symbolsForDoc(drained));
    assert.ok(
      !drainedNames.includes("Inside Probe"),
      `a heading inside a recognised fence must not reach the outline: ${drainedNames.join(", ")}`,
    );
    // CONTROL — the same probe text as a real heading at column 0. Without it the assertion
    // above passes for a build that has stopped finding headings altogether.
    const control = await openInMemory(
      ["-   item one", "", "# Inside Probe", "", "Tail body line."].join("\n"),
    );
    const controlNames = flatten(await symbolsForDoc(control));
    assert.ok(
      controlNames.includes("Inside Probe"),
      `the column-0 control must still be a heading: ${controlNames.join(", ")}`,
    );
  });

  it("STRIPS a bullet marker from a setext title rather than declining it, through the real provider (Session 201)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the fourth
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and 197
    // a full screen-taking run each. `grep -n "assert.deepStrictEqual"
    // test/integration/suite/*.ts` was run BEFORE this was written and finds no such pin in this
    // file; `openInMemory` keeps these documents out of every one elsewhere.
    //
    // Every premise below was rendered through the real `quarto render --to html` path this
    // session, quarto 1.7.33:
    //   `scratchpad/s201/pins/p0_dash_solo.qmd` -> `<ul><li><h2 id="solo-item">solo item</h2></li></ul>`
    //   `scratchpad/s201/cd/t_top_i04_u0.qmd`   -> `<h1>- cd probe title</h1>`, marker KEPT
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);

    // PRESENT — the direction the filed BACKLOG item never named. It described a text divergence
    // at a container's content column and proposed widening the ` {0,3}` guard; at columns 0-3,
    // where that guard DID fire, the heading was being deleted outright. This document has no
    // container at all and the pre-Session-201 build produced NOTHING for it.
    const recovered = await openInMemory(["- solo item", "---", "", "Tail body line."].join("\n"));
    const recoveredNames = flatten(await symbolsForDoc(recovered));
    assert.ok(
      recoveredNames.includes("solo item"),
      `a bullet-marker setext title must reach the outline with its marker stripped: ${recoveredNames.join(", ")}`,
    );
    // ...and the marker must not survive INTO the name, which is the half the item did file.
    assert.ok(
      !recoveredNames.includes("- solo item"),
      `the marker must not survive into the outline name: ${recoveredNames.join(", ")}`,
    );

    // ABSENT — the boundary a BLIND adversarial lens found after this session's own designed
    // corpora had scored clean on it. At indented-code depth pandoc never parses the line as a
    // list item, so the marker belongs to the heading text and stripping it is wrong. Without
    // this row the change would have shipped a text divergence at every column past code depth.
    const deep = await openInMemory(["    - cd probe title", "===", "", "Tail body line."].join("\n"));
    const deepNames = flatten(await symbolsForDoc(deep));
    assert.ok(
      deepNames.includes("- cd probe title"),
      `at code depth the marker must SURVIVE into the name: ${deepNames.join(", ")}`,
    );

    // CONTROL — a marker-free setext heading. Without it the two assertions above would both
    // pass for a build that had stopped finding setext headings altogether.
    const control = await openInMemory(["plain probe title", "===", "", "Tail body line."].join("\n"));
    const controlNames = flatten(await symbolsForDoc(control));
    assert.ok(
      controlNames.includes("plain probe title"),
      `the marker-free control must still be a heading: ${controlNames.join(", ")}`,
    );
  });

  it("reads a setext underline's column per the document's `from:` DIALECT, through the real provider (Session 202)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the fifth
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and 197
    // a full screen-taking run each. `grep -n "assert.deepStrictEqual"
    // test/integration/suite/*.ts` was run BEFORE this was written and finds no such pin in this
    // file; `openInMemory` keeps these documents out of every one elsewhere.
    //
    // Every premise below was rendered through the real `quarto render --to html` path this
    // session, quarto 1.7.33 (`scratchpad/s202/gnd`, 264 documents, and `dax`, 51):
    //   `g_gfm_b2_u00`      -> NO heading (the underline is a LAZY continuation)
    //   `g_gfm_b2_u03`      -> `<h1>gnd probe title</h1>` at the tolerance column
    //   `g_markdown_b2_u00` -> `<h1>gnd probe title</h1>` — the guard that makes the VALUE matter
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = (u: number) =>
      ["- outer one", "", "  dialect probe title", " ".repeat(u) + "===", "", "Tail body line."];

    // ABSENT — the phantom half. Under a CommonMark-family reader an underline at column 0
    // inside an open list item continues the item's paragraph, and quarto renders no heading.
    const lazy = await openInMemory(["---", "from: gfm", "---", "", ...body(0)].join("\n"));
    const lazyNames = flatten(await symbolsForDoc(lazy));
    assert.ok(
      !lazyNames.includes("dialect probe title"),
      `a lazy underline must not reach the outline under gfm: ${lazyNames.join(", ")}`,
    );

    // PRESENT — the recovery half, in the SAME dialect and one column further out, so the two
    // assertions cannot both be satisfied by a build that has simply stopped finding setext
    // headings under a `from:` key.
    const tolerated = await openInMemory(["---", "from: gfm", "---", "", ...body(3)].join("\n"));
    const toleratedNames = flatten(await symbolsForDoc(tolerated));
    assert.ok(
      toleratedNames.includes("dialect probe title"),
      `the 0-3 tolerance must reach the outline under gfm: ${toleratedNames.join(", ")}`,
    );

    // GUARD — the same bytes under `from: markdown`, where quarto DOES render the heading at
    // column 0. This is the row that makes the rule key on the `from:` VALUE rather than on the
    // key's presence: firing here would delete a real heading.
    const dflt = await openInMemory(["---", "from: markdown", "---", "", ...body(0)].join("\n"));
    const dfltNames = flatten(await symbolsForDoc(dflt));
    assert.ok(
      dfltNames.includes("dialect probe title"),
      `the default reader must keep its column-0 heading: ${dfltNames.join(", ")}`,
    );
  });

  it("measures the indented-code threshold from the container's content column, through the real provider (Session 193)", async () => {
    // THE WIRING EVIDENCE for Session 193, on the provider the Outline view, breadcrumbs,
    // sticky scroll and Ctrl+T all really call. Like Session 192's, this change moves the
    // outline in BOTH directions, so one fixture carries a control for each.
    //
    // The fixture's premise is MEASURED, not assumed — these exact bytes were re-rendered
    // through `quarto render --to html` this session and quarto emits EIGHT headings,
    // including `Code Column In A List` and NOT `Phantom Below Indented Text`.
    //
    // Against the pre-Session-193 build, the same probe over the same bytes produced a set
    // that DIFFERED IN BOTH DIRECTIONS: `Code Column In A List` was missing outright, and
    // `Phantom Below Indented Text` was present in its place. Both are measured, not argued.
    const symbols = await symbolsFor(SETEXT_FRESH_BLOCK);
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const all = flatten(symbols);

    // PRESENT control — inside a `-   ` item (content column 4) a line at column 8 really IS
    // an indented code block, so the line below it starts a fresh paragraph and its underline
    // promotes it. Before this session BOTH lines were read as code, which made the title
    // "the second line of a code run" and deleted the heading from the outline entirely.
    assert.ok(
      all.includes("Code Column In A List"),
      "a title at the container's content column, under a genuine code block, must reach the real provider",
    );

    // ABSENT control — inside a `- ` item (content column 2) a line at column 4 is only two
    // columns past the item's content, which is ordinary paragraph text. The heading below it
    // would interrupt that open paragraph, and `blank_before_header` forbids it. The
    // pre-Session-193 build read the four spaces as code and invented a top-level section.
    // This is the assertion that fails if anyone restores the literal-4 test.
    assert.ok(
      !all.includes("Phantom Below Indented Text"),
      "four spaces inside a column-2 item is not code, and must not invent a section",
    );
  });

  it("measures a line's indentation in COLUMNS, so a TAB reaches the container it reaches (Session 194)", async () => {
    // THE WIRING EVIDENCE for Session 194, on the provider the Outline view, breadcrumbs,
    // sticky scroll, Ctrl+T and the cross-reference index all really call.
    //
    // The container stack closed containers by comparing a COUNT OF SPACES against the open
    // content columns, while every other column-aware rule in the model expands a tab to the
    // next 4-column stop. A tab-indented line therefore looked shallower than it is and popped
    // a container that was still open — and because the stack sits under readers of OPPOSITE
    // polarity, that single defect both INVENTED and DELETED headings.
    //
    // The fixture's premise is MEASURED, not assumed: `quarto render --to html` on these exact
    // bytes emits ELEVEN headings, including `Tab Macro In A List` and `Tab Column Kept Open`
    // and NOT `Phantom Below A Tab`. Against the pre-Session-194 build the same probe over the
    // same bytes produced TEN, differing in BOTH directions — the two present controls below
    // were missing outright, and the absent control was present in their place.
    const symbols = await symbolsFor(SETEXT_FRESH_BLOCK);
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const all = flatten(symbols);

    // PRESENT control 1 — a TAB-indented `\clearpage` sits at column 4, which is exactly the
    // `-   ` item's content column, so pandoc reads it as a raw-TeX BLOCK and the title below
    // it starts a fresh paragraph. This is the assertion that fails if the raw-TeX row is
    // returned to counting spaces; it is also the REGRESSION the container fix would have
    // shipped on its own, so it guards the pair rather than either half.
    assert.ok(
      all.includes("Tab Macro In A List"),
      "a tab-indented macro at the container's content column must reach the real provider",
    );

    // PRESENT control 2 — the LOSS direction of the container stack itself. Two tabs reach
    // column 8, which is deeper than the innermost item's content column 6, so the item stays
    // OPEN and the setext underline at column 6 below still promotes its title. The pre-S194
    // build read the two tabs as column 0, popped all three containers, and the underline then
    // matched no open column at all — the heading vanished from the outline entirely.
    assert.ok(
      all.includes("Tab Column Kept Open"),
      "a tab-indented line deeper than the container must not close it, through the real provider",
    );

    // ABSENT control — the PHANTOM direction, and the exact shape Session 193 filed as its own
    // only two new errors. Four spaces then a tab reaches column 8; the innermost item's
    // content column is 6, so the code threshold there is 10 and this line is ordinary content.
    // `blank_before_header` then forbids the heading below it. The pre-S194 build popped
    // column 6, measured against a base of 4, and invented a top-level section.
    assert.ok(
      !all.includes("Phantom Below A Tab"),
      "a line short of the container's code threshold must not invent a section",
    );
  });

  it("opens a container for a TAB-indented marker, and none for one at code depth (Session 196)", async () => {
    // THE WIRING EVIDENCE for Session 196, on the provider the Outline view, breadcrumbs,
    // sticky scroll, Ctrl+T and the cross-reference index all really call.
    //
    // `listItemContentColumn` and `CONTENT_COLUMN_4_OPEN` measured their own leading indent as
    // a COUNT OF SPACES, so a TAB-indented list marker or footnote definition opened NO tracked
    // container at all — the last two of the six sites in the model that measured indentation.
    // Correcting them alone then DELETED headings through the other consumer of the same stack,
    // which is why the code-depth guard ships with them; both directions are asserted here.
    //
    // The fixture's premise is MEASURED, not assumed: `quarto render --to html` on these exact
    // bytes emits FOURTEEN headings, including `Tab Opened Column` and `Code Depth Kept The
    // Block` and NOT `Phantom At Code Depth`. Against the pre-Session-196 build the same probe
    // over the same bytes produced fourteen too — but a DIFFERENT fourteen, differing in BOTH
    // directions: `Tab Opened Column` was missing outright and `Phantom At Code Depth` stood in
    // its place. A count alone could not have told the two builds apart; the SET can.
    const symbols = await symbolsFor(SETEXT_FRESH_BLOCK);
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const all = flatten(symbols);

    // PRESENT control 1 — the RECOVERY the session shipped. Inside a `- ` item (content column
    // 2) a TAB reaches column 4, which is two columns past the item's content and so is not
    // code; the marker there opens content column 6, and the setext underline at column 6 below
    // promotes its title. The pre-S196 build matched no marker at all on a tab-indented line,
    // pushed nothing, and the underline then sat at a column no open block started at.
    assert.ok(
      all.includes("Tab Opened Column"),
      "a tab-indented list marker must open its container column, through the real provider",
    );

    // PRESENT control 2 — the SCOPE AMENDMENT, and the assertion that fails if the code-depth
    // guard is removed. At top level a lone TAB reaches column 4, which IS indented code, so
    // the marker is literal code text and opens nothing; the column-8 line below it stays code,
    // and an ATX heading may follow a code block. Without the guard the opener pushed column 6,
    // which lifted the code base, turned the code block into an open paragraph, and
    // `blank_before_header` then deleted this heading — 39 of them across the blind corpus.
    assert.ok(
      all.includes("Code Depth Kept The Block"),
      "an ATX heading below a code block whose opener is at code depth must survive",
    );

    // ABSENT control — the PHANTOM direction, and the family this session closed rather than
    // filed. A four-space marker at top level is indented code to pandoc, not a container, so
    // the underline below it sits at a column nothing opened. Both this and the tab spelling of
    // it were phantoms before; the guard removes both at once, which is what makes the two
    // spellings equivalent rather than merely both wrong.
    assert.ok(
      !all.includes("Phantom At Code Depth"),
      "a marker at code depth must not open a container the underline can stand on",
    );
  });

  it("tests a TAB-indented setext underline at the COLUMN it reaches (Session 197)", async () => {
    // THE WIRING EVIDENCE for Session 197, on the provider the Outline view, breadcrumbs,
    // sticky scroll, Ctrl+T and the cross-reference index all really call.
    //
    // `SETEXT_H1`/`SETEXT_H2` were `/^( *)=+[ \t]*$/` and `setextUnderlineLevel` compared
    // `m[1].length` — a COUNT OF SPACES — against a set of COLUMNS. A tab-indented run
    // therefore did not match the regex at all and could never be an underline at any column,
    // in any container: the last of the six sites in the model that measured indentation in
    // characters. Both regexes now take `[ \t]*` and the column comes from `indentColumn`.
    //
    // The fixture's premise is MEASURED, not assumed: `quarto render --to html` on these exact
    // bytes emits SIXTEEN headings, including `Tab Underline At The Column` and NOT `Tab
    // Underline Past The Column`. Against the pre-Session-197 build the same probe over the
    // same bytes produced FIFTEEN — the recovered heading missing outright, with no
    // compensating phantom, so this row moves the outline in one direction only.
    const symbols = await symbolsFor(SETEXT_FRESH_BLOCK);
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const all = flatten(symbols);

    // PRESENT control — the RECOVERY. Inside a `-   ` item the content column is 4, and a TAB
    // reaches exactly 4, so the underline begins where the enclosing block's content begins and
    // pandoc promotes the title above it. The pre-S197 build could not match a tab-prefixed
    // underline at all, so this heading was absent from the outline entirely.
    assert.ok(
      all.includes("Tab Underline At The Column"),
      "a tab-indented underline at the container's content column must reach the real provider",
    );

    // ABSENT control — and it is the document Session 192 measured when it wrote "a TAB is not
    // the content column" in the model's own source. Inside a `- ` item the content column is
    // 2 and a tab reaches 4, so there is no underline here — for quarto or for us, before this
    // change or after. This is the assertion that fails if the fix is ever mistaken for "a tab
    // is deep enough" rather than "a tab is worth the columns it spans".
    assert.ok(
      !all.includes("Tab Underline Past The Column"),
      "a tab reaching past the container's content column must not promote a title",
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
    // these exact bytes emits FOURTEEN headings, and renders all three `Not A Heading` lines
    // and both `Residual Phantom` lines as ordinary paragraph text.
    //
    // ⚠ The count in this sentence read "ELEVEN" until Session 190 re-rendered the fixture.
    // It was written when the fixture had eleven and was not updated when Session 189 added a
    // twelfth; Session 190 added the thirteenth and Session 191 the fourteenth, each
    // re-rendering the fixture rather than trusting the sentence. The exact-set assertion at
    // the foot of this test is what actually pins it — this sentence is prose and drifted
    // silently once already.
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
      // Below An Indented Macro At Its Item Column — Session 189, and the sharpest control in
      // this list: `\clearpage` two spaces under `- a list item` sits at the ITEM's content
      // column, which pandoc treats as that sub-document's column 0. Quarto renders the
      // heading (re-rendered on these exact bytes). Session 184 built the literal-column-0
      // rule, measured it deleting THIS heading, and rejected the change on it.
      "Below An Indented Macro At Its Item Column",
      // Below An Indented Class A Macro — Session 190, and the one control in this list whose
      // row was WIDENED rather than narrowed. `\maketitle` four spaces under an open paragraph
      // interrupts it at the INLINE level, where no column rule exists, so quarto renders the
      // heading (re-rendered on these exact bytes). The ` {0,3}` cap this row used to carry
      // deleted it, along with 437 others across a 774-document class x indent sweep.
      "Below An Indented Class A Macro",
      // Setext Below A Class A Macro — Session 191, and it is a strictly STRONGER control than
      // the one above it. An ATX heading below the macro needs only the paragraph CLOSED;
      // a SETEXT heading additionally needs the line below the macro to START A FRESH
      // PARAGRAPH, which is `opensFreshBlock`'s question and was answered wrongly. That
      // function tested the HTML opener ahead of its `paragraphOpen` bail but reached the
      // raw-TeX rows only behind it, so this heading was not mis-levelled — it was absent.
      // 216 of them on Session 190's own container corpus, 424 on this session's.
      "Setext Below A Class A Macro",
    ]) {
      assert.ok(names.includes(real), `${real} is a real heading and must survive the narrowing`);
    }

    // ⚠ THE CONTROL THAT DECIDES SESSION 190's WIDENING, and it points the other way. Class B
    // at the SAME indent, under an equally open paragraph, is INLINE — quarto renders no
    // heading. If this name ever appears, the widening has been carried across to the class-B
    // row, which restores the 1,043 phantoms Session 189 removed. The two raw-TeX rows need
    // OPPOSITE indent rules and the word "indent" hides it.
    assert.ok(
      !names.includes("Not A Heading — Indented Class B Macro"),
      "Session 190: class B is inline against an open paragraph at EVERY indent, so this must NOT reach the Outline",
    );

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
    // ⚠ AND THE THIRD DISCLOSED PHANTOM IS GONE (Session 189) — the one S184 filed as
    // "the raw-TeX row's ` {0,3}` indent is WRONG at top level". At top level the containing
    // block's content column is 0, so `   \clearpage` is ordinary paragraph text and the `#`
    // line below it is that paragraph's continuation. Re-rendered on these exact bytes: quarto
    // emits twelve headings and this name is not among them.
    assert.ok(
      !names.includes("Not A Heading — Indented Macro At Top Level"),
      "Session 189: an indented macro at TOP level is prose, so this phantom must NOT reach the Outline",
    );

    // ⚠ THE CONTROL THAT DECIDES SESSION 191's HOIST, and like Session 190's it points the
    // other way. Class B in the SAME position, under an equally open paragraph: the paragraph
    // simply runs on, pandoc's setext rule claims exactly ONE line, and quarto renders no
    // heading. If this name ever appears, the hoist has been carried across to the class-B row
    // — which sits behind the bail precisely because class B is a block only where NO
    // paragraph is open. Re-rendered on these exact bytes: quarto emits fourteen headings and
    // this name is not among them.
    assert.ok(
      !names.includes("Not A Heading — Setext Below A Class B Macro"),
      "Session 191: class B does not open a fresh block against an open paragraph, so this must NOT reach the Outline",
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
      "Below An Indented Macro At Its Item Column",
      "Below An Indented Class A Macro",
      "Setext Below A Class A Macro",
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

  it("joins a MULTI-LINE setext title per the document's `from:` DIALECT, through the real provider (Session 203)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the sixth
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and
    // 197 a full screen-taking run each. `grep -c "assert.deepStrictEqual"
    // test/integration/suite/*.ts` was run BEFORE this was written; `openInMemory` keeps these
    // documents out of every exact-set pin in this file and in every other suite file.
    //
    // Every premise below was rendered through the real `quarto render --to html` path this
    // session, quarto 1.7.33 (`scratchpad/s203/gnd`, 45 documents, and `scratchpad/s203/ilk`, 64):
    //   `g_gfm_top_n2`      -> `<h1>Gnd Probe Title second wrapped line</h1>` — the JOIN
    //   `g_markdown_top_n2` -> NO heading — the same bytes, one reader away
    //   `i_gfm_quote`       -> NO heading — a block quote INTERRUPTS the paragraph
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = (second: string) => [
      "Gnd Probe Title",
      second,
      "====================",
      "",
      "Tail body line.",
    ];

    // PRESENT — the recovery half. Under a CommonMark-family reader the title is the WHOLE open
    // paragraph, joined with single spaces, and it must reach the outline as ONE symbol.
    const joined = await openInMemory(
      ["---", "from: gfm", "---", "", ...body("second wrapped line")].join("\n"),
    );
    const joinedNames = flatten(await symbolsForDoc(joined));
    assert.ok(
      joinedNames.includes("Gnd Probe Title second wrapped line"),
      `the joined title must reach the outline whole under gfm: ${joinedNames.join(", ")}`,
    );

    // ABSENT — the guard, in the SAME dialect. A block quote interrupts the paragraph, so
    // quarto renders no heading and stitching across it would invent one.
    const interrupted = await openInMemory(
      ["---", "from: gfm", "---", "", ...body("> interrupting quote")].join("\n"),
    );
    const interruptedNames = flatten(await symbolsForDoc(interrupted));
    assert.ok(
      !interruptedNames.some((n) => n.startsWith("Gnd Probe Title")),
      `no title may be stitched across an interrupt: ${interruptedNames.join(", ")}`,
    );

    // THE DIALECT GUARD — the identical bytes under the DEFAULT reader, which admits exactly one
    // title line and therefore no heading at all here. Without this the first two assertions
    // would both pass for a build that had simply started joining every paragraph it met.
    const defaultReader = await openInMemory(
      ["---", "from: markdown", "---", "", ...body("second wrapped line")].join("\n"),
    );
    const defaultNames = flatten(await symbolsForDoc(defaultReader));
    assert.ok(
      !defaultNames.some((n) => n.startsWith("Gnd Probe Title")),
      `the default reader must still admit exactly one title line: ${defaultNames.join(", ")}`,
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
  it("reports no heading inside a raw HTML BLOCK, per the document's `from:` DIALECT (Session 204)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the SEVENTH
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and 197
    // a full screen-taking run each. `grep -c "assert.deepStrictEqual"
    // test/integration/suite/*.ts` was run BEFORE this was written (outline.test.ts: 29), and
    // `openInMemory` keeps these documents out of every exact-set pin in this file and in every
    // other suite file. This test adds no exact-set pin of its own.
    //
    // Both premises were rendered through the real `quarto render --to html` path this session,
    // quarto 1.7.33 (`scratchpad/s204/gnd`, 180 documents):
    //   `g_gfm_div_d1_atx` -> `<h1>Gnd Below</h1>` ONLY — the block swallows `Gnd Inside`
    //   `g_md_div_d1_atx`  -> BOTH headings — the identical bytes, one reader away
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = ["<div>", "# Gnd Inside", "", "# Gnd Below"];

    const commonmark = await openInMemory(
      ["---", "from: gfm", "---", "", ...body].join("\n"),
    );
    const cmNames = flatten(await symbolsForDoc(commonmark));

    // ABSENT — the heading INSIDE the block. Under a CommonMark-family reader the block runs to
    // the next blank line and quarto renders no heading for it at all.
    assert.ok(
      !cmNames.includes("Gnd Inside"),
      `a heading inside a CommonMark HTML block must not reach the outline: ${cmNames.join(", ")}`,
    );
    // PRESENT — the heading BELOW the blank line that ENDS the block. Without this the first
    // assertion would pass for a build that had simply stopped reporting headings after a
    // `<div>` for the rest of the document.
    assert.ok(
      cmNames.includes("Gnd Below"),
      `the heading after the block's blank line must survive: ${cmNames.join(", ")}`,
    );

    // THE DIALECT GUARD — the identical bytes under the DEFAULT reader, which parses markdown
    // inside such a block (`markdown_in_html_blocks` / `native_divs`) and really does render the
    // heading. Without this, both assertions above would still pass for a build that had started
    // swallowing every `<div>` it met, in every dialect.
    const defaultReader = await openInMemory(
      ["---", "from: markdown", "---", "", ...body].join("\n"),
    );
    const mdNames = flatten(await symbolsForDoc(defaultReader));
    assert.ok(
      mdNames.includes("Gnd Inside") && mdNames.includes("Gnd Below"),
      `the default reader must keep BOTH headings: ${mdNames.join(", ")}`,
    );
  });
  it("keeps `blank_before_header` under an explicitly declared `from: markdown` (Session 205)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the EIGHTH
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and 197
    // a full screen-taking run each. The exact-set grep ran BEFORE this was written:
    // `grep -c "assert.deepStrictEqual" test/integration/suite/outline.test.ts` = 30 raw, but the
    // real CALL count is 21 (the rest are comment text citing the grep by name — Session 204's
    // gotcha 7, which is why the two numbers are recorded separately). `openInMemory` keeps these
    // documents out of every exact-set pin here and in every other suite file, and this test adds
    // no exact-set pin of its own.
    //
    // All three premises were rendered through the real `quarto render --to html` path this
    // session, quarto 1.7.33 (`scratchpad/s205/gnd`, 120 documents; `pins`, 26):
    //   `g_md_prose`    -> `<h1>Gnd Below</h1>` ONLY — `blank_before_header` is ON for `markdown`
    //   `g_nofm_prose`  -> the same, with no front matter at all — already correct before this
    //   `g_gfm_prose`   -> BOTH headings — CommonMark lets an ATX heading interrupt a paragraph
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = ["Prose opens the paragraph.", "# Gnd Inside", "", "# Gnd Below"];

    const declared = await openInMemory(
      ["---", "title: t", "from: markdown", "---", "", ...body].join("\n"),
    );
    const mdNames = flatten(await symbolsForDoc(declared));

    // ABSENT — the heading pressed against the paragraph. The reader named here really does have
    // `blank_before_header`, so quarto renders no heading for it; the `from:` key had been
    // switching that rule off for the whole document.
    assert.ok(
      !mdNames.includes("Gnd Inside"),
      `a heading pressed against prose under \`from: markdown\` must not reach the outline: ${mdNames.join(", ")}`,
    );
    // PRESENT — the heading after the blank line. Without this the first assertion would pass for
    // a build that had simply stopped reporting headings after any paragraph.
    assert.ok(
      mdNames.includes("Gnd Below"),
      `the heading after the blank line must survive: ${mdNames.join(", ")}`,
    );

    // THE DIALECT GUARD — the identical bytes under a CommonMark-family reader, where an ATX
    // heading MAY interrupt a paragraph and quarto really does render it. Without this, both
    // assertions above would still pass for a build that had started suppressing every pressed
    // heading in every dialect — which is precisely the deletion this change had to avoid.
    const commonmark = await openInMemory(
      ["---", "title: t", "from: gfm", "---", "", ...body].join("\n"),
    );
    const cmNames = flatten(await symbolsForDoc(commonmark));
    assert.ok(
      cmNames.includes("Gnd Inside") && cmNames.includes("Gnd Below"),
      `a CommonMark reader must keep BOTH headings: ${cmNames.join(", ")}`,
    );
  });
  it("resolves a `from:` written as YAML rather than as one line shape (Session 206)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the NINTH
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and 197
    // a full screen-taking run each. The exact-set grep ran BEFORE this was written:
    // `grep -c "assert.deepStrictEqual" test/integration/suite/outline.test.ts` = 31 raw, but the
    // real CALL count is 21 (the rest are comment text citing the grep by name — Session 204's
    // gotcha 7, which is why the two numbers are recorded separately). `openInMemory` keeps these
    // documents out of every exact-set pin here and in every other suite file, and this test adds
    // no exact-set pin of its own.
    //
    // All three premises were rendered through the real `quarto render --to html` path this
    // session, quarto 1.7.33 (`scratchpad/s206/gnd`, 32 documents; `pins`, 24):
    //   `g_qkeyd_gfm`      -> BOTH headings — a QUOTED key really does select gfm
    //   `g_nextline_markdown` -> the BASELINE only — a next-line scalar really is `from: markdown`
    //   `g_plain_gfm`      -> BOTH headings — the control spelling, unchanged by this session
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = ["", "# Baseline", "", "Prose opens a paragraph.", "# Pressed"];

    // PRESENT — a QUOTED key. The key regex then in force could never match a line beginning
    // with a quote, so the paragraph bail DELETED this heading: the user-visible outline was
    // missing a
    // section the rendered document has.
    const quoted = await openInMemory(['---', '"from": gfm', 'title: t', '---', ...body].join("\n"));
    const quotedNames = flatten(await symbolsForDoc(quoted));
    assert.ok(
      quotedNames.includes("Pressed") && quotedNames.includes("Baseline"),
      `a quoted \`"from": gfm\` must select gfm and keep BOTH headings: ${quotedNames.join(", ")}`,
    );

    // ABSENT — the value on the NEXT line. Without this the case above would pass for a build
    // that had simply stopped applying the bail at all, which is the opposite defect.
    const nextLine = await openInMemory(
      ["---", "title: t", "from:", "  markdown", "---", ...body].join("\n"),
    );
    const nextNames = flatten(await symbolsForDoc(nextLine));
    assert.ok(
      !nextNames.includes("Pressed") && nextNames.includes("Baseline"),
      `a next-line \`from: markdown\` must keep the bail and drop only the pressed heading: ${nextNames.join(", ")}`,
    );

    // THE UNRESOLVED GUARD — a nested per-format `from:` this scanner deliberately does NOT
    // resolve. Measured (`scratchpad/s206/ctl5` `z_nest_gfm`): quarto honours it, so a build that
    // narrowed on the ABSENCE of a resolution would delete the heading it renders. Without this
    // assertion both cases above would pass for exactly that build.
    const nested = await openInMemory(
      ["---", "title: t", "format:", "  html:", "    from: gfm", "---", ...body].join("\n"),
    );
    const nestedNames = flatten(await symbolsForDoc(nested));
    assert.ok(
      nestedNames.includes("Pressed") && nestedNames.includes("Baseline"),
      `an unresolved nested \`from:\` must keep today's behaviour: ${nestedNames.join(", ")}`,
    );
  });
  it("resolves a `from:` by its YAML PATH on the user-visible outline (Session 207)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the TENTH
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and 197
    // a full screen-taking run each. The exact-set grep ran BEFORE this was written:
    // `grep -c "assert.deepStrictEqual" test/integration/suite/outline.test.ts` = 32 raw, but the
    // real CALL count is 21 (the rest are comment text citing the grep by name — Session 204's
    // gotcha 7). `openInMemory` keeps these documents out of every exact-set pin here and in
    // every other suite file, and this test adds no exact-set pin of its own.
    //
    // All three premises were rendered through the real `quarto render --to html` path this
    // session, quarto 1.7.33 (`scratchpad/s207/cal`, 33 documents):
    //   `c_fmhg_topm_bail` -> BOTH headings — the nested `gfm` OUTRANKS the top-level `markdown`
    //   `c_parg_bail`      -> the BASELINE only — `params:`/`from:` is not a reader selection
    //   `c_topg_bail`      -> BOTH headings — the control spelling, unchanged by this session
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = ["", "# Baseline", "", "Prose opens a paragraph.", "# Pressed"];

    // PRESENT — PRECEDENCE, and this one was heading-DELETING before this session. The document
    // declares `from: markdown` at the top level and `from: gfm` under `format:`/`html:`, and
    // quarto honours the NESTED one. This model resolved only the top level, applied markdown's
    // paragraph bail, and dropped a section the rendered document has.
    const precedence = await openInMemory(
      ["---", "from: markdown", "format:", "  html:", "    from: gfm", "---", ...body].join("\n"),
    );
    const precedenceNames = flatten(await symbolsForDoc(precedence));
    assert.ok(
      precedenceNames.includes("Pressed") && precedenceNames.includes("Baseline"),
      `a nested \`from: gfm\` must outrank a top-level \`from: markdown\` and keep BOTH headings: ${precedenceNames.join(", ")}`,
    );

    // ABSENT — a `params:` / `from:` is a report parameter, not a reader. Before this session the
    // any-indent key fired on it, switched the paragraph bail off for the whole document, and
    // INVENTED a section the rendered document does not have.
    const params = await openInMemory(
      ["---", "title: t", "params:", "  from: gfm", "---", ...body].join("\n"),
    );
    const paramsNames = flatten(await symbolsForDoc(params));
    assert.ok(
      !paramsNames.includes("Pressed") && paramsNames.includes("Baseline"),
      `a \`params:\`/\`from:\` must not select a reader, so only the baseline survives: ${paramsNames.join(", ")}`,
    );

    // THE GUARD — a plain top-level `from: gfm`. Without this the ABSENT case above would pass
    // for a build that had simply stopped reading front matter altogether, which is precisely
    // the deletion this session's narrowing had to avoid.
    const topLevel = await openInMemory(["---", "from: gfm", "title: t", "---", ...body].join("\n"));
    const topNames = flatten(await symbolsForDoc(topLevel));
    assert.ok(
      topNames.includes("Pressed") && topNames.includes("Baseline"),
      `a top-level \`from: gfm\` must still select gfm and keep BOTH headings: ${topNames.join(", ")}`,
    );
  });
  it("resolves a per-format `from:` written in FLOW style on the user-visible outline (Session 208)", async () => {
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the ELEVENTH
    // consecutive session to avoid the exact-set fixture coupling that cost Sessions 196 and 197
    // a full screen-taking run each. The exact-set grep ran BEFORE this was written:
    // `grep -c "assert.deepStrictEqual" test/integration/suite/outline.test.ts` = 33 raw, but the
    // real CALL count is 21 (the rest are comment text citing the grep by name — Session 204's
    // gotcha 7). `openInMemory` keeps these documents out of every exact-set pin.
    //
    // All four premises were rendered through the real `quarto render --to html` path this
    // session, quarto 1.7.33 (`scratchpad/s208/cal` and `cal3`):
    //   `c_f1hg_bail`        -> BOTH headings — a FLOW per-format `from: gfm` selects the reader
    //   `r_par_then_top_bail`-> BOTH headings — `params:` does not select, the top level does
    //   `r_par_only_bail`    -> the BASELINE only — `params:` alone selects nothing
    //   `c_topg_bail`        -> BOTH headings — the control spelling, unchanged by this session
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = ["", "# Baseline", "", "Prose opens a paragraph.", "# Pressed"];

    // PRESENT — the filed defect itself, and it was heading-DELETING. `format: {html: {from: gfm}}`
    // is honoured by quarto; this model walked block mappings only, saw nothing, kept the default
    // reader, applied markdown's paragraph bail and dropped a section the rendered document has.
    const flow = await openInMemory(
      ["---", "title: t", "format: {html: {from: gfm}}", "---", ...body].join("\n"),
    );
    const flowNames = flatten(await symbolsForDoc(flow));
    assert.ok(
      flowNames.includes("Pressed") && flowNames.includes("Baseline"),
      `a flow per-format \`from: gfm\` must select gfm and keep BOTH headings: ${flowNames.join(", ")}`,
    );

    // PRESENT — the PATH half, inside a whole-flow front matter. The first `from:` on the line
    // sits under `params:` and does not select; the top-level one does. The flat pattern this
    // session replaced took the first and dropped a section.
    const path2 = await openInMemory(
      ["---", "{title: t, params: {from: markdown}, from: gfm}", "---", ...body].join("\n"),
    );
    const pathNames = flatten(await symbolsForDoc(path2));
    assert.ok(
      pathNames.includes("Pressed") && pathNames.includes("Baseline"),
      `a flow \`from:\` must be read by PATH, keeping BOTH headings: ${pathNames.join(", ")}`,
    );

    // ABSENT — the other direction of the same narrowing. `params:` alone declares no reader, and
    // the flat pattern read its `from: gfm` and INVENTED a section the rendered document lacks.
    const paramsOnly = await openInMemory(
      ["---", "{title: t, params: {from: gfm}}", "---", ...body].join("\n"),
    );
    const paramsNames = flatten(await symbolsForDoc(paramsOnly));
    assert.ok(
      !paramsNames.includes("Pressed") && paramsNames.includes("Baseline"),
      `a flow \`params:\`/\`from:\` must select nothing, so only the baseline survives: ${paramsNames.join(", ")}`,
    );

    // THE GUARD — a plain top-level `from: gfm`. Without it the ABSENT case would pass for a
    // build that had stopped reading front matter altogether, which is the deletion this
    // session's narrowing of the flow arm had to avoid.
    const topLevel = await openInMemory(["---", "from: gfm", "title: t", "---", ...body].join("\n"));
    const topNames = flatten(await symbolsForDoc(topLevel));
    assert.ok(
      topNames.includes("Pressed") && topNames.includes("Baseline"),
      `a top-level \`from: gfm\` must still select gfm and keep BOTH headings: ${topNames.join(", ")}`,
    );
  });
  it("gives a container a content column only when the READER has that container (Session 209)", async () => {
    // THE WIRING EVIDENCE for Session 209, on the provider the Outline view, breadcrumbs,
    // sticky scroll, Ctrl+T and the cross-reference index all really call.
    //
    // ⚠ DELIBERATELY DOES NOT TOUCH `test/fixtures/setext-fresh-block.qmd` — the same reason as
    // the four tests above. That fixture is asserted by six other tests as an exact set, and
    // Sessions 196 and 197 each lost a full integration run to editing it. Everything here goes
    // through `openInMemory`, so the fixture's byte content and its exact-set assertions are
    // untouched. The grep ran BEFORE this test was written: 7 raw mentions, 6 real uses,
    // unchanged by this addition.
    //
    // Every premise below is MEASURED through the real `quarto render` path this session
    // (quarto 1.7.33, `scratchpad/s209/cal` and `cal2`), not assumed.
    const flatten = (nodes: vscode.DocumentSymbol[]): string[] =>
      nodes.flatMap((n) => [n.name, ...flatten(n.children)]);
    const body = ["Term one", "", ":   the definition body", "", "    # Probe Section", "", "Tail."];
    const fnBody = ["See[^1] for it.", "", "[^1]: the note body", "", "    # Probe Section", "", "Tail."];
    const namesFor = async (...lines: string[]) =>
      flatten(await symbolsForDoc(await openInMemory(lines.join("\n"))));

    // ABSENT — `gfm` has NO definition lists, so `:   the definition body` opens nothing and the
    // line four columns in is indented code. `scratchpad/s209/cal/defterm_gfm_atx` renders no
    // heading; before this session the outline carried a section that does not exist.
    const gfmDef = await namesFor("---", "from: gfm", "---", "", ...body);
    assert.ok(
      !gfmDef.includes("Probe Section"),
      `gfm has no definition lists, so no section may reach the outline: ${gfmDef.join(", ")}`,
    );

    // ABSENT — the other construct. Plain `commonmark` is the one measured base with NEITHER,
    // so a REFERENCED footnote definition opens nothing either (`cal/fnref_cm_atx`).
    const cmFn = await namesFor("---", "from: commonmark", "---", "", ...fnBody);
    assert.ok(
      !cmFn.includes("Probe Section"),
      `commonmark has no footnotes, so no section may reach the outline: ${cmFn.join(", ")}`,
    );

    // PRESENT — the guard, and the whole safety argument for a narrowing. `markdown` HAS
    // definition lists (`cal/defterm_md_atx` renders the heading), so the section must survive.
    // Without this assertion the two above would pass for a build that had stopped opening
    // definition containers at all, which would DELETE real sections.
    const mdDef = await namesFor("---", "from: markdown", "---", "", ...body);
    assert.ok(
      mdDef.includes("Probe Section"),
      `markdown HAS definition lists, so the section must survive: ${mdDef.join(", ")}`,
    );

    // PRESENT — ⚠ THE EXTENSION OUTRANKS THE BASE. `gfm+definition_lists` renders the heading
    // (`cal2/ext_gfmplusdef_def`), so a predicate keyed on the base name alone would DELETE this
    // one. This is the assertion that separates the shipped rule from the obvious wrong one.
    const gfmPlus = await namesFor("---", "from: gfm+definition_lists", "---", "", ...body);
    assert.ok(
      gfmPlus.includes("Probe Section"),
      `an extension turning definition lists ON must be honoured: ${gfmPlus.join(", ")}`,
    );
  });
});
