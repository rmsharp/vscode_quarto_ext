import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { assertRoutedThroughVdoc, VDOC_SELECTOR } from "./vdoc-assert";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const SAMPLE = path.resolve(ROOT, "test/fixtures/sample.qmd");
const SETEXT = path.resolve(ROOT, "test/fixtures/setext.qmd");

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
