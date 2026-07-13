import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/**
 * The tests that could have caught BACKLOG item 18, and the only tests that can catch it
 * again. Every one of them runs against **real Pylance**, not a stand-in.
 *
 * Each assertion is paired with a CONTROL on a plain `.py` file in the same run. Without
 * the control, a zero result is unattributable — "our forward is broken" and "Pylance
 * never started" look identical. With it, they are distinguishable, and that is the
 * difference between evidence and a guess.
 */

/** The scratch workspace the harness created (`runTest.ts`). */
function workspaceDir(): string {
  const dir = process.env.QMD_LSP_WORKSPACE;
  assert.ok(dir, "QMD_LSP_WORKSPACE must be set by the harness");
  return dir;
}

function uriIn(...segments: string[]): vscode.Uri {
  return vscode.Uri.file(path.join(workspaceDir(), ...segments));
}

async function writeDoc(name: string, content: string): Promise<vscode.TextDocument> {
  const uri = uriIn(name);
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
  return vscode.workspace.openTextDocument(uri);
}

async function completionsAt(
  doc: vscode.TextDocument,
  line: number,
  character: number,
): Promise<string[]> {
  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    doc.uri,
    new vscode.Position(line, character),
    ".",
  );
  return (list?.items ?? []).map((i) =>
    typeof i.label === "string" ? i.label : i.label.label,
  );
}

/**
 * Wait for a real language server to be ready. Pylance starts asynchronously and indexes
 * the interpreter's stdlib before it can answer anything, so the first request after
 * launch legitimately returns nothing. Polling until a KNOWN-GOOD control answers is what
 * separates "not ready yet" from "broken" — a fixed sleep would do neither reliably.
 */
async function waitForPylance(): Promise<string[]> {
  const control = await vscode.workspace.openTextDocument(uriIn("control.py"));
  await vscode.window.showTextDocument(control, { preview: false });
  for (let attempt = 0; attempt < 60; attempt++) {
    const items = await completionsAt(control, 1, 3); // `os.` -> members of os
    if (items.includes("getcwd")) {
      return items;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return [];
}

describe("REAL Pylance: the forwards that were silently dead (BACKLOG item 18)", function () {
  let controlItems: string[] = [];

  before(async function () {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();

    controlItems = await waitForPylance();
    // If the control fails, every assertion below is meaningless. Say so, loudly, rather
    // than letting the suite "pass" or fail for a reason that is not the code under test.
    assert.ok(
      controlItems.includes("getcwd"),
      "CONTROL FAILED: real Pylance did not complete `os.` on a plain .py file, so it is " +
        "not running and NOTHING in this suite can be concluded. This is a harness " +
        "problem, not a product failure — check the Python interpreter and Pylance.",
    );
    console.log(
      `  [control] real Pylance is alive: ${controlItems.length} completions on a plain .py`,
    );
  });

  it("completes inside a {python} cell — the headline defect", async () => {
    // BEFORE this slice: 0 items. Pylance registers its providers for `file:`/`untitled:`
    // only, so our `quarto-embedded:` vdoc reached no provider at all.
    const doc = await writeDoc(
      "completion.qmd",
      ["---", "title: t", "---", "", "```{python}", "import os", "os.", "```", ""].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    const items = await completionsAt(doc, 6, 3); // `os.` inside the cell

    assert.ok(
      items.includes("getcwd"),
      `real Pylance must complete inside a {python} cell. Got ${items.length} items. ` +
        `The control returned ${controlItems.length} on a plain .py in this same run, so ` +
        `Pylance IS alive — a zero here means the forward is broken.`,
    );
  });

  it("hovers inside a {python} cell", async () => {
    const doc = await writeDoc(
      "hover.qmd",
      ["```{python}", "import os", "os.getcwd", "```", ""].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      new vscode.Position(2, 5),
    );

    assert.ok(
      hovers !== undefined && hovers.length > 0,
      "real Pylance must return a hover inside a {python} cell (was 0 before this slice)",
    );
  });

  it("reports in-cell symbols from a {python} cell to the Outline", async () => {
    // Proven broken before this slice: file: -> 2 symbols, our scheme -> 0.
    const doc = await writeDoc(
      "symbols.qmd",
      ["```{python}", "def alpha():", "    pass", "```", ""].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    );

    const cell = (symbols ?? []).find((s) => s.name.includes("python"));
    assert.ok(cell, "the outline must contain the {python} cell node");
    assert.ok(
      cell.children.some((c) => c.name === "alpha"),
      `real Pylance must report the cell's own symbols as the cell node's children; got ` +
        `[${cell.children.map((c) => c.name).join(", ")}]`,
    );
  });

  it("attributes symbols to the RIGHT cell when two {python} cells are forwarded concurrently", async () => {
    // 🐉4, against a real server rather than a stand-in: every cell is forwarded
    // concurrently, so a vdoc key without a cell discriminator would let the two writes
    // race and each cell would show the other's symbols — plausible, and wrong.
    const doc = await writeDoc(
      "two-cells.qmd",
      [
        "```{python}",
        "def alpha():",
        "    pass",
        "```",
        "",
        "```{python}",
        "def beta():",
        "    pass",
        "```",
        "",
      ].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    );
    const cells = (symbols ?? []).filter((s) => s.name.includes("python"));

    assert.strictEqual(cells.length, 2, "both cells must appear in the outline");
    assert.deepStrictEqual(
      cells[0].children.map((c) => c.name),
      ["alpha"],
      "the first cell must show ONLY its own symbol",
    );
    assert.deepStrictEqual(
      cells[1].children.map((c) => c.name),
      ["beta"],
      "the second cell must show ONLY its own symbol — not the first cell's",
    );
  });

  it("sees an edit immediately, with no stale window (the M3 race)", async () => {
    // M3: rewriting a file that already has an open model invalidates it only
    // ASYNCHRONOUSLY — measured at ≈1017 ms. A design that reused the vdoc path would
    // answer from the PREVIOUS revision here, silently, on every edit forever.
    const doc = await writeDoc(
      "edit.qmd",
      ["```{python}", "def before_edit():", "    pass", "```", ""].join("\n"),
    );
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    const first = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    );
    assert.ok(
      (first ?? [])[0]?.children.some((c) => c.name === "before_edit"),
      "precondition: the pre-edit symbol is reported",
    );

    await editor.edit((b) => {
      b.replace(new vscode.Range(1, 0, 1, 18), "def after_edit():");
    });

    const second = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    );
    const names = (second ?? [])[0]?.children.map((c) => c.name) ?? [];
    assert.ok(
      names.includes("after_edit"),
      `the symbol must reflect the edit immediately; got [${names.join(", ")}] — a stale ` +
        `"before_edit" here is the M3 race, and it would be invisible in production`,
    );
  });

  it("still forwards {ojs} to the built-in JS service, with FULL semantics (no regression)", async () => {
    // {ojs} is the one thing that worked BEFORE this slice — VS Code's built-in TS/JS
    // provider happens to be scheme-agnostic for completion, so it answered even on our
    // custom scheme (52 items, measured in the S86 spike). It is therefore the migration's
    // one regression risk, and the operator made it an explicit gate.
    //
    // The CONTROL is the same code as a plain `.js` file. Comparing against it — rather
    // than against a hardcoded expectation — is what makes this a no-regression test
    // rather than a test of TypeScript's own behaviour.
    //
    // On `const`: TypeScript cannot type a BARE assignment (`x = "hello"`) in a .js file
    // and returns a single word-based item — for a plain .js at the workspace root exactly
    // as much as for our vdoc (both measured). That is a property of TypeScript, not of
    // our forwarding, and it was equally true before this slice. Idiomatic OJS does use
    // bare assignments, so in practice OJS cells get syntactic completion only; that is
    // unchanged, and is not what this test is about.
    const body = 'const x = "hello";';
    const control = await writeDoc("ojs-control.js", `${body}\nx.\n`);
    await vscode.window.showTextDocument(control, { preview: false });

    // POLL the control, do not query it once. VS Code's TS/JS service starts lazily — the
    // first .js file opened in the host is what wakes it — so a single query races its
    // startup and returns only a word-based suggestion. Exactly the same discipline as
    // `waitForPylance`, and the control is what surfaced the omission rather than letting
    // it read as an {ojs} regression.
    let controlItems: string[] = [];
    for (let attempt = 0; attempt < 60; attempt++) {
      controlItems = await completionsAt(control, 1, 2);
      if (controlItems.includes("charAt")) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(
      controlItems.includes("charAt"),
      "CONTROL FAILED: the built-in JS service did not complete a plain .js file, so " +
        "nothing can be concluded about {ojs} forwarding from this run.",
    );

    const doc = await writeDoc(
      "ojs.qmd",
      ["```{ojs}", body, "x.", "```", ""].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    const items = await completionsAt(doc, 2, 2);

    assert.ok(
      items.includes("charAt"),
      `{ojs} must still complete through the built-in JS service on a file: vdoc; got ` +
        `${items.length} items while the control got ${controlItems.length}`,
    );
    assert.strictEqual(
      items.length,
      controlItems.length,
      "{ojs} forwarding must lose NOTHING relative to the same code in a plain .js file",
    );
    console.log(
      `  [ojs] forwarded ${items.length} semantic completions (control: ${controlItems.length})`,
    );
  });

  it("formats an {ojs} cell through the built-in JS formatter (Format Cell reaches a REAL provider)", async () => {
    // Format Cell's status against a real PYTHON formatter is UNPROVEN — none is installed
    // here, so even a `file:` control would return 0 edits and prove nothing (this is
    // recorded honestly in the plan and BACKLOG rather than claimed either way).
    //
    // But VS Code's built-in JavaScript formatter needs no extension at all, so it CAN
    // prove the thing that actually matters: that the Format Cell forward now reaches a
    // real, non-stand-in provider on our file: vdoc.
    const doc = await writeDoc(
      "format.qmd",
      ["```{ojs}", "x   =   1", "```", ""].join("\n"),
    );
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    editor.selection = new vscode.Selection(1, 2, 1, 2); // inside the cell body

    await vscode.commands.executeCommand("quarto.formatCell");

    const text = editor.document.getText();
    assert.ok(
      text.includes("x = 1"),
      `the built-in JS formatter's edit must reach the real document; got:\n${text}`,
    );
    assert.ok(
      text.includes("```{ojs}"),
      "the fence must survive — the formatter must only ever touch the cell body",
    );
  });
});
