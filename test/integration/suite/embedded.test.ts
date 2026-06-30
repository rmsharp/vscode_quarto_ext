import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** Scheme our embedded provider routes virtual documents through (plan §5). */
const SCHEME = "quarto-embedded";
/** Detail tag on the stand-in's items, so we can pick them out of a merged list. */
const STANDIN_DETAIL = "embedded-stand-in";

interface ForwardCall {
  /** The URI the stand-in was invoked on — proves the request went through the vdoc. */
  uri: string;
  /** The vdoc's resolved languageId — proves §9 Q8 (python resolves in the bare host). */
  languageId: string;
  /** The vdoc text — proves the content provider served the blanked document. */
  text: string;
}

let calls: ForwardCall[] = [];
/** When set, the stand-in attaches these as `additionalTextEdits` (the auto-import hazard). */
let standInExtraEdits: vscode.TextEdit[] | undefined;
/**
 * When true, the stand-in still RECORDS the call (proving the forward routed
 * through the vdoc) but returns NO items — modelling a language provider that
 * yields nothing (the §2.5 degradation case: extension absent, or installed with
 * no suggestion — indistinguishable to the adapter, §9 Q6).
 */
let standInReturnsNothing = false;
const disposables: vscode.Disposable[] = [];

/** Hover stand-in state (6e-3), kept separate from the completion stand-in's. */
let hoverCalls: ForwardCall[] = [];
const hoverDisposables: vscode.Disposable[] = [];
/** Marker text the stand-in hover returns, so we can pick it out of a merged hover. */
const HOVER_MARKER = "EMBEDDED_HOVER_PY";

/**
 * Register a stand-in completion provider for the embedded scheme (Learning #13b):
 * the bare test host has no Python extension, so this faithfully substitutes for it
 * and records the URI/languageId/text it was invoked on, proving the forward routed
 * THROUGH the vdoc rather than hitting the quarto doc directly. Keyed by `{scheme}`
 * so it fires regardless of whether the vdoc's languageId resolves (§9 Q8).
 */
function registerStandIn(): void {
  disposables.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: SCHEME },
      {
        provideCompletionItems(document) {
          calls.push({
            uri: document.uri.toString(),
            languageId: document.languageId,
            text: document.getText(),
          });
          if (standInReturnsNothing) {
            return [];
          }
          const item = new vscode.CompletionItem(
            "FWD_PY",
            vscode.CompletionItemKind.Field,
          );
          item.detail = STANDIN_DETAIL;
          if (standInExtraEdits) {
            item.additionalTextEdits = standInExtraEdits;
          }
          return [item];
        },
      },
    ),
  );
}

function labelText(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

/** Items the embedded forward surfaced (the stand-in's, tagged by detail). */
function embeddedLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === STANDIN_DETAIL)
    .map(labelText);
}

/** YAML cell-option key items (the other `{language:"quarto"}` provider). */
function cellOptionLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === "Quarto cell option")
    .map(labelText);
}

async function openInMemory(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({
    language: "quarto",
    content,
  });
  await vscode.window.showTextDocument(doc);
  return doc;
}

async function complete(
  doc: vscode.TextDocument,
  line: number,
  character: number,
  trigger?: string,
): Promise<vscode.CompletionList | undefined> {
  return vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    doc.uri,
    new vscode.Position(line, character),
    trigger,
  );
}

// A document with front matter, prose, a `#|` option line, and a {python} cell.
const DOC = [
  "---", // 0
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Some prose.", // 4
  "", // 5
  "```{python}", // 6  opening fence
  "#| echo: false", // 7  cell-option line
  "import pandas as pd", // 8  python body
  "pd.", // 9  python body — cursor here
  "```", // 10 closing fence
].join("\n");

describe("Quarto: embedded-cell completion forwarding (6e-1, python)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    calls = [];
    standInExtraEdits = undefined;
    standInReturnsNothing = false;
  });

  afterEach(async () => {
    for (const d of disposables.splice(0)) {
      d.dispose();
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("forwards completion inside a {python} cell body through the virtual document", async () => {
    registerStandIn();
    const doc = await openInMemory(DOC);

    const list = await complete(doc, 9, 3, ".");

    assert.deepStrictEqual(
      embeddedLabels(list),
      ["FWD_PY"],
      "the embedded (stand-in) completion should appear in the cell body",
    );
    assert.strictEqual(calls.length, 1, "the stand-in should be invoked once");
    assert.strictEqual(
      vscode.Uri.parse(calls[0].uri).scheme,
      SCHEME,
      "the request must route through the quarto-embedded virtual document, not the .qmd directly",
    );
    assert.strictEqual(
      calls[0].languageId,
      "python",
      "the .py virtual document must resolve to languageId python in the bare host (§9 Q8)",
    );
    // The vdoc keeps the python body and blanks the prose/front matter.
    assert.ok(
      calls[0].text.includes("import pandas as pd"),
      "the vdoc should keep the python body verbatim",
    );
    assert.ok(
      !calls[0].text.includes("title: Demo"),
      "the vdoc should blank the YAML front matter",
    );
  });

  it("does not forward (no embedded items) on a prose line", async () => {
    registerStandIn();
    const doc = await openInMemory(DOC);

    const list = await complete(doc, 4, 5);

    assert.deepStrictEqual(embeddedLabels(list), [], "no embedded items in prose");
    assert.strictEqual(calls.length, 0, "the stand-in must not be invoked in prose");
  });

  it("does not forward on a `#|` cell-option line, but YAML completion still does (both-directions gating)", async () => {
    registerStandIn();
    const doc = await openInMemory(DOC);

    const list = await complete(doc, 7, 3); // inside the `echo` key on the `#|` line

    assert.deepStrictEqual(
      embeddedLabels(list),
      [],
      "no embedded items on a `#|` option line — that region belongs to YAML",
    );
    assert.ok(
      cellOptionLabels(list).length > 0,
      "the YAML cell-option provider must still fire on the `#|` line (no cross-pollution)",
    );
  });

  it("does not forward on the opening fence line", async () => {
    registerStandIn();
    const doc = await openInMemory(DOC);

    const list = await complete(doc, 6, 0);

    assert.deepStrictEqual(embeddedLabels(list), [], "no embedded items on a fence line");
    assert.strictEqual(calls.length, 0);
  });

  it("forwards completion inside an {r} cell body through the virtual document (6e-2)", async () => {
    registerStandIn();
    const doc = await openInMemory(
      ["```{r}", "y <- 2", "y.", "```"].join("\n"),
    );

    const list = await complete(doc, 2, 2, ".");

    assert.deepStrictEqual(
      embeddedLabels(list),
      ["FWD_PY"],
      "the {r} cell body should now forward to the embedded stand-in",
    );
    assert.strictEqual(calls.length, 1, "the stand-in should be invoked once for the r cell");
    assert.strictEqual(
      vscode.Uri.parse(calls[0].uri).scheme,
      SCHEME,
      "the r request must route through the quarto-embedded virtual document",
    );
    // The .r vdoc's languageId may NOT resolve in the bare host (no built-in r
    // language-basics — §9 Q8 / Learning #35b); the scheme-keyed stand-in fires
    // regardless. We assert the forward routed through the vdoc, not languageId.
    assert.ok(
      calls[0].text.includes("y <- 2"),
      "the vdoc should keep the r body verbatim",
    );
  });

  it("forwards inside an {ojs} cell, resolving the .js vdoc to languageId javascript (token ≠ languageId)", async () => {
    registerStandIn();
    const doc = await openInMemory(["```{ojs}", "x = 1", "x.", "```"].join("\n"));

    const list = await complete(doc, 2, 2, ".");

    assert.deepStrictEqual(embeddedLabels(list), ["FWD_PY"], "the {ojs} cell forwards");
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(
      vscode.Uri.parse(calls[0].uri).scheme,
      SCHEME,
      "the ojs request routes through the virtual document",
    );
    assert.strictEqual(
      calls[0].languageId,
      "javascript",
      "the .js virtual document must resolve to languageId javascript (ojs→javascript, the 6e-2 dragon)",
    );
    assert.ok(
      calls[0].text.includes("x = 1"),
      "the vdoc keeps the ojs body verbatim",
    );
  });

  it("forwards inside a {julia} cell and degrades to no items when the provider yields nothing (no throw)", async () => {
    // The scheme-keyed stand-in RECORDS the call — so this test FAILS if {julia}
    // were unmapped/ungated (calls would be empty) — but returns NO items, modelling
    // the §2.5 degradation case (no Julia extension installed, or installed with no
    // suggestion; the adapter cannot tell them apart, §9 Q6). The forward must yield
    // no items and must not throw.
    standInReturnsNothing = true;
    registerStandIn();
    const doc = await openInMemory(
      ["```{julia}", "j = 1", "j.", "```"].join("\n"),
    );

    let list: vscode.CompletionList | undefined;
    await assert.doesNotReject(async () => {
      list = await complete(doc, 2, 2, ".");
    }, "forwarding into a cell whose provider yields nothing must not throw");

    assert.strictEqual(
      calls.length,
      1,
      "the {julia} cell must forward through the vdoc (proves julia is mapped + gated)",
    );
    assert.strictEqual(
      vscode.Uri.parse(calls[0].uri).scheme,
      SCHEME,
      "the julia request routes through the quarto-embedded virtual document",
    );
    assert.deepStrictEqual(
      embeddedLabels(list),
      [],
      "an empty upstream result degrades to no items",
    );
  });

  it("drops out-of-cell auto-import edits but keeps in-cell ones (front-matter corruption guard, both directions)", async () => {
    registerStandIn();
    // The embedded server returns two secondary edits: an auto-import anchored at
    // the module top (identity-maps to .qmd line 0 = the front matter — MUST be
    // dropped) and an in-cell edit on a python body line (line 8 — MUST be kept).
    standInExtraEdits = [
      new vscode.TextEdit(new vscode.Range(0, 0, 0, 0), "import os\n"),
      new vscode.TextEdit(new vscode.Range(8, 0, 8, 0), "import sys\n"),
    ];
    const doc = await openInMemory(DOC);

    const list = await complete(doc, 9, 3, ".");

    const item = (list?.items ?? []).find((i) => i.detail === STANDIN_DETAIL);
    assert.ok(item, "the completion itself should still be offered");
    const edits = item.additionalTextEdits ?? [];
    assert.strictEqual(
      edits.length,
      1,
      "the front-matter edit is dropped; the in-cell edit is kept",
    );
    assert.strictEqual(
      edits[0].range.start.line,
      8,
      "the surviving edit is the in-cell (python body) one, not the front-matter one",
    );
  });

  it("reflects an edit to the cell on the next completion (rebuild-per-request, no stale virtual document)", async () => {
    registerStandIn();
    const doc = await openInMemory(
      ["```{python}", "import pandas as pd", "pd.", "```"].join("\n"),
    );
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);

    await complete(doc, 2, 3, ".");
    assert.ok(
      calls.at(-1)?.text.includes("import pandas as pd"),
      "the first forward should see the original body",
    );

    // Edit the cell body, then complete again on the SAME document (same vdoc URI).
    await editor.edit((b) =>
      b.replace(new vscode.Range(1, 0, 1, "import pandas as pd".length), "import numpy as np"),
    );
    await complete(doc, 2, 3, ".");

    assert.ok(
      calls.at(-1)?.text.includes("import numpy as np"),
      "the second forward must reflect the edit (not serve a stale virtual document)",
    );
    assert.ok(
      !calls.at(-1)?.text.includes("import pandas as pd"),
      "the stale body must not persist in the virtual document",
    );
  });
});

/**
 * Register a stand-in HOVER provider for the embedded scheme (Learning #13b): the
 * bare test host has no Python extension, so this substitutes for it and records the
 * URI/languageId/text it was invoked on, proving the hover forward routed THROUGH the
 * vdoc. Returns a hover with a known marker + a range, so the test can assert the
 * identity-mapped range is returned unchanged. Keyed by `{scheme}` so it fires
 * regardless of whether the vdoc's languageId resolves (§9 Q8).
 */
function registerHoverStandIn(): void {
  hoverDisposables.push(
    vscode.languages.registerHoverProvider(
      { scheme: SCHEME },
      {
        provideHover(document, position) {
          hoverCalls.push({
            uri: document.uri.toString(),
            languageId: document.languageId,
            text: document.getText(),
          });
          return new vscode.Hover(
            new vscode.MarkdownString(HOVER_MARKER),
            new vscode.Range(position.line, 0, position.line, 3),
          );
        },
      },
    ),
  );
}

/** The plain text of every hover content (MarkdownString | MarkedString). */
function hoverTexts(hovers: vscode.Hover[] | undefined): string[] {
  const out: string[] = [];
  for (const h of hovers ?? []) {
    for (const c of h.contents) {
      out.push(typeof c === "string" ? c : c.value);
    }
  }
  return out;
}

async function hover(
  doc: vscode.TextDocument,
  line: number,
  character: number,
): Promise<vscode.Hover[] | undefined> {
  return vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    doc.uri,
    new vscode.Position(line, character),
  );
}

describe("Quarto: embedded-cell hover forwarding (6e-3)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    hoverCalls = [];
  });

  afterEach(async () => {
    for (const d of hoverDisposables.splice(0)) {
      d.dispose();
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("forwards hover inside a {python} cell body through the virtual document", async () => {
    registerHoverStandIn();
    const doc = await openInMemory(DOC);

    const hovers = await hover(doc, 8, 2); // on `import` in the python body

    assert.ok(
      hoverTexts(hovers).some((t) => t.includes(HOVER_MARKER)),
      "the embedded (stand-in) hover should appear in the cell body",
    );
    assert.strictEqual(
      hoverCalls.length,
      1,
      "the stand-in hover should be invoked once",
    );
    assert.strictEqual(
      vscode.Uri.parse(hoverCalls[0].uri).scheme,
      SCHEME,
      "the hover request must route through the quarto-embedded virtual document, not the .qmd directly",
    );
    assert.strictEqual(
      hoverCalls[0].languageId,
      "python",
      "the .py virtual document must resolve to languageId python in the bare host (§9 Q8)",
    );
    assert.ok(
      hoverCalls[0].text.includes("import pandas as pd"),
      "the vdoc should keep the python body verbatim",
    );
    assert.ok(
      !hoverCalls[0].text.includes("title: Demo"),
      "the vdoc should blank the YAML front matter",
    );
  });
});
