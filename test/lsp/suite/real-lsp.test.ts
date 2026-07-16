import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  decodeTokens,
  OUR_LEGEND,
} from "../../../src/core/embedded/semantic-tokens";

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

  it("resolves go-to-definition inside a {python} cell, and maps it back to the .qmd", async () => {
    // The forward with the MOST post-processing: remapDefinitions swaps the vdoc URI on the
    // result back to the .qmd. A locally-defined symbol exercises that remap end to end
    // against a real server (the stand-in can only approximate the shape Pylance returns).
    const doc = await writeDoc(
      "definition.qmd",
      ["```{python}", "def my_func():", "    return 1", "", "x = my_func()", "```", ""].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    const defs = await vscode.commands.executeCommand<
      (vscode.Location | vscode.LocationLink)[]
    >("vscode.executeDefinitionProvider", doc.uri, new vscode.Position(4, 8)); // on `my_func` use

    const locations = (defs ?? []).map((d) =>
      "targetUri" in d ? d.targetUri : (d as vscode.Location).uri,
    );
    assert.ok(locations.length > 0, "real Pylance must resolve the definition of a local symbol");
    assert.ok(
      locations.every((u) => u.toString() === doc.uri.toString()),
      `a definition inside the cell must be remapped back to the .qmd, not left pointing at the ` +
        `vdoc; got [${locations.map((u) => u.scheme + ":" + (u.fsPath.split("/").pop() ?? "")).join(", ")}]`,
    );
  });

  it("resolves signature help inside a {python} cell", async () => {
    const doc = await writeDoc(
      "signature.qmd",
      ["```{python}", "def greet(name, greeting):", "    return greeting", "", "greet(", "```", ""].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    const help = await vscode.commands.executeCommand<vscode.SignatureHelp>(
      "vscode.executeSignatureHelpProvider",
      doc.uri,
      new vscode.Position(4, 6), // just after `greet(`
      "(",
    );

    assert.ok(
      help !== undefined && help.signatures.length > 0,
      "real Pylance must return signature help for a local function call inside a {python} cell",
    );
    assert.ok(
      help.signatures[0].label.includes("name"),
      `the signature must describe the real parameters; got "${help?.signatures[0]?.label}"`,
    );
  });

  it("does NOT flood the Problems panel with diagnostics on phantom vdoc files (default diagnosticMode)", async () => {
    // Adversarial-review HIGH (completeness critic): the per-cell outline vdoc blanks every
    // OTHER cell, so a cell that references a name defined in a sibling cell (df from cell 1,
    // used in cell 2) becomes an undefined-name in its isolated vdoc. If Pylance published
    // diagnostics for these background-opened files, the Problems panel would fill with
    // "df is not defined" pointing at .quarto/vdoc-mit/ paths the user cannot navigate to —
    // and this project deliberately does NOT forward embedded diagnostics.
    //
    // This is the exact scenario, driven through the real outline forward, then EVERY URI in
    // the global diagnostics set is inspected for one of our vdocs. Session 86's spike found
    // zero under the default diagnosticMode (openFilesOnly: a background-opened, never-shown
    // file is not "open" for diagnostics); this pins that empirically and permanently.
    //
    // This asserts the DEFAULT (openFilesOnly) posture — a blanket "zero diagnostics", which is
    // true there because background-opened vdocs are not diagnosed at all. Under
    // `QMD_LSP_DIAGMODE=workspace` that blanket claim is neither true nor this test's job (the
    // workspace-mode sibling below owns that mode, asserting the item's phantom classes are
    // muted while tolerating the syntax residual `# type: ignore` cannot touch), so no-op here.
    if (process.env.QMD_LSP_DIAGMODE === "workspace") {
      return;
    }
    const doc = await writeDoc(
      "cross-cell.qmd",
      [
        "```{python}",
        "import pandas as pd",
        "df = pd.DataFrame()",
        "```",
        "",
        "```{python}",
        "df.head()", // references df from the FIRST cell — undefined in an isolated vdoc
        "undefined_name_xyz + 1", // an outright undefined name, to be sure
        "```",
        "",
      ].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    // Drive the per-cell outline forward (this is what opens the isolated cell vdocs).
    await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    );
    // Give Pylance a generous window to publish anything it is going to publish.
    await new Promise((r) => setTimeout(r, 5000));

    const vdocDiagnostics = vscode.languages
      .getDiagnostics()
      .filter(([uri]) => /vdoc-mit\./.test(uri.fsPath))
      .map(([uri, diags]) => `${uri.fsPath}: ${diags.map((d) => d.message).join("; ")}`);

    assert.deepStrictEqual(
      vdocDiagnostics,
      [],
      `no diagnostics may be attributed to our vdoc files (default diagnosticMode). Found:\n` +
        vdocDiagnostics.join("\n"),
    );
  });

  it("MUTES phantom vdoc diagnostics under diagnosticMode:workspace via the line-0 `# type: ignore` (candidate G)", async () => {
    // The workspace-mode counterpart of the default-mode pin above, and the runtime proof of
    // candidate G (BACKLOG "Polish/deferred" HIGH; plan §6 L2, S92/S93). Under
    // `python.analysis.diagnosticMode: "workspace"` Pyright diagnoses a vdoc on its TRACKED
    // membership — injected at didOpen (`service.ts`), location-independent — even though the
    // client never opened it. So WITHOUT the fix this exact fixture floods the Problems panel
    // with phantom errors on `.quarto/vdoc-mit/*.py` paths (S92 §3.1 reproduced 5: an
    // unresolved `pandas` import; `"df" is not defined` ×2 from the isolated per-cell vdocs
    // that blank the sibling that defined `df`; `"undefined_name_xyz" is not defined` ×2).
    // Candidate G injects a file-level `# type: ignore` on the vdoc's already-blanked line 0,
    // muting every file diagnostic while leaving completion/hover/imports intact.
    //
    // DISCRIMINATING POWER REQUIRES `QMD_LSP_DIAGMODE=workspace`. Under the default
    // openFilesOnly mode there is no leak to mute (proven by the sibling above), so the
    // diagnostics assertion is a genuine RED→GREEN gate for the fix only when the whole suite
    // is launched under workspace mode. The completion and no-line-0-token assertions below are
    // meaningful in BOTH modes.
    //
    // SCOPE — what the mute does and does NOT suppress (verified in-session, S93). A file-level
    // `# type: ignore` mutes Pyright's *type/name/import* diagnostics (PEP 484), which is the
    // exact class this item is about — `"df" is not defined` (cross-cell blanking), `"…" is not
    // defined`, `Import "pandas" could not be resolved`. It does NOT suppress *parse/syntax*
    // errors, which are a different category Pyright emits before type-checking runs. So this
    // asserts on the ITEM's phantom classes, not a blanket zero: a blanket `=== []` over the
    // GLOBAL vdoc-diagnostics set is polluted by sibling tests whose fixtures are deliberately
    // syntactically incomplete (`os.` in the completion test, `greet(` in signature help), whose
    // syntax errors the mute cannot and does not touch. That syntax residual is transient
    // (mid-typing) and is a documented limitation of candidate G — see the BACKLOG note.
    const mode = process.env.QMD_LSP_DIAGMODE ?? "openFilesOnly";
    // The phantom-diagnostic signature this item is about — the classes `# type: ignore` mutes.
    const PHANTOM = /is not defined|could not be resolved/;
    const doc = await writeDoc(
      "workspace-mute.qmd",
      [
        "```{python}", // 0
        "import os", // 1
        "import pandas as pd", // 2  unresolved import → a diagnostic without the mute
        "df = pd.DataFrame()", // 3
        "```", // 4
        "", // 5
        "```{python}", // 6
        "df.head()", // 7  df defined in cell 1 → "not defined" in the ISOLATED per-cell vdoc
        "undefined_name_xyz + 1", // 8  an outright undefined name
        "os.getcwd()", // 9  a stdlib call, for a reliable completion control
        "```", // 10
        "", // 11
      ].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    // Drive BOTH forwards that open background vdocs: the per-cell outline forward (isolated
    // per-cell vdocs) AND the whole-language semantic-tokens forward. Both leak under workspace
    // mode without the mute; both must be muted by it.
    await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    );
    await vscode.commands.executeCommand<vscode.SemanticTokens>(
      "vscode.provideDocumentSemanticTokens",
      doc.uri,
    );

    // A POSITIVE liveness control instead of a blind fixed wait (S93 review, completeness
    // critic): poll until Pylance has actually PUBLISHED a diagnostic on the workspace's
    // `control.py` (a real, open `.py` whose `os.` dangling dot is a syntax error). Only once
    // diagnostics are demonstrably flowing does an EMPTY vdoc-diagnostic set mean "muted" rather
    // than "not yet published" — that is the false-green a fixed sleep leaves open. control.py is
    // an OPEN file (not a background vdoc), so it is diagnosed in BOTH modes, making this control
    // mode-independent. The completion control below is a second, per-vdoc liveness proof: Pylance
    // answering `os.getcwd` on the WHOLE-LANGUAGE vdoc means that vdoc (which carries the primary
    // `undefined_name_xyz` phantom) was processed, so a leak would have surfaced.
    const controlUri = uriIn("control.py");
    let diagnosticsFlowing = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (vscode.languages.getDiagnostics(controlUri).length > 0) {
        diagnosticsFlowing = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(
      diagnosticsFlowing,
      "CONTROL FAILED: Pylance never published a diagnostic on control.py, so an empty vdoc set " +
        "cannot be read as 'muted' rather than 'not yet published' — this run proves nothing.",
    );
    // A short settle so any vdoc diagnostics that WOULD publish have landed alongside the control's.
    await new Promise((r) => setTimeout(r, 1500));

    // Every diagnostic message attributed to any of our vdoc files, flattened one-per-line.
    const vdocDiagnostics = vscode.languages
      .getDiagnostics()
      .filter(([uri]) => /vdoc-mit\./.test(uri.fsPath))
      .flatMap(([uri, diags]) => diags.map((d) => `${path.basename(uri.fsPath)}: ${d.message}`));
    // Logged so the syntax residual the mute cannot touch is visible in the run, not hidden.
    console.log(`  [workspace-mute mode=${mode}] vdoc diagnostics after the mute:`);
    for (const line of vdocDiagnostics) {
      console.log(`    ${line}`);
    }
    // (the fix) NONE of the item's phantom type/name/import diagnostics survive on any vdoc.
    const phantomLeaks = vdocDiagnostics.filter((line) => PHANTOM.test(line));
    assert.deepStrictEqual(
      phantomLeaks,
      [],
      `candidate G must mute every phantom type/name/import diagnostic on our vdocs (mode=${mode}). ` +
        `Leaked:\n${phantomLeaks.join("\n")}`,
    );

    // (control) the mute filters diagnostic OUTPUT only — completion still works. `os.` (stdlib)
    // is resolvable regardless of whether pandas is installed in the harness interpreter.
    const items = await completionsAt(doc, 9, 3); // `os.` in the second cell
    assert.ok(
      items.includes("getcwd"),
      `completion must survive the mute — it filters diagnostics, not IntelliSense. ` +
        `Got ${items.length} items, "getcwd" ${items.includes("getcwd") ? "present" : "ABSENT"}.`,
    );

    // (version-drift pin, plan §4.3) the injected `# type: ignore` on .qmd line 0 must itself
    // emit NO semantic token. Today real Pylance emits none for the comment line; a future
    // Pylance that tokenizes it would surface a spurious token on .qmd line 0. Pin it so that
    // regression is caught by the gate, not shipped.
    const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
      "vscode.provideDocumentSemanticTokens",
      doc.uri,
    );
    assert.ok(
      tokens && tokens.data.length > 0,
      "real Pylance must serve some semantic tokens on the {python} cells, else the line-0 pin is vacuous",
    );
    const lineZeroTokens = decodeTokens({ data: tokens.data, legend: OUR_LEGEND }).filter(
      (t) => t.line === 0,
    );
    assert.deepStrictEqual(
      lineZeroTokens,
      [],
      "the line-0 `# type: ignore` mute must emit NO semantic token (else it colours .qmd line 0)",
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

  it("SEMANTIC TOKENS: colours a {python} cell from real Pylance, at real .qmd coordinates", async () => {
    // BACKLOG item 16, Slice 1 — the feature this whole two-session arc exists for, and
    // the ONLY test that can prove it. Semantic tokens were impossible on the old custom
    // scheme for EVERY language (not even VS Code's built-in TS/JS served them), so a
    // stand-in cannot distinguish "we forward correctly" from "no server was ever asked".
    //
    // The CONTROL is the same Python as a plain `.py`. If Pylance serves no tokens THERE,
    // nothing can be concluded here.
    // The `class C` / `__init__` / `self` / `True` lines are NOT decoration. Without them this
    // fixture contains only names D4 CARRIES, so the "the ten stay dropped" assertion below
    // would pass vacuously — an assertion that cannot fail is worth nothing (Learning #98:
    // zero hits in the fixtures means UNTESTED, not safe). These four lines make real Pylance
    // emit `magicFunction` (__init__), `selfParameter` (self) and `builtinConstant` (True) —
    // the exact names D4 decided NOT to carry — so the assertion genuinely discriminates.
    const body = [
      "import os",
      "",
      "CONSTANT = 42",
      "",
      "def main(w):",
      "    return os.getcwd()",
      "",
      "class C:",
      "    def __init__(self):",
      "        self.flag = True",
    ];

    const control = await writeDoc("tokens-control.py", `${body.join("\n")}\n`);
    await vscode.window.showTextDocument(control, { preview: false });

    let controlTokens: vscode.SemanticTokens | undefined;
    let controlLegend: vscode.SemanticTokensLegend | undefined;
    for (let attempt = 0; attempt < 60; attempt++) {
      controlLegend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        "vscode.provideDocumentSemanticTokensLegend",
        control.uri,
      );
      controlTokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens",
        control.uri,
      );
      if (controlTokens !== undefined && controlTokens.data.length > 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(
      controlTokens && controlTokens.data.length > 0 && controlLegend,
      "CONTROL FAILED: real Pylance served no semantic tokens on a plain .py, so nothing " +
        "can be concluded about our forwarding from this run.",
    );
    const controlCount = controlTokens.data.length / 5;
    console.log(
      `  [control] real Pylance served ${controlCount} semantic tokens on a plain .py ` +
        `(legend: ${controlLegend.tokenTypes.length} types, ${controlLegend.tokenModifiers.length} modifiers)`,
    );

    // The same code, now as a {python} cell. Two prose lines first, so a wrong coordinate
    // mapping cannot accidentally look right.
    const doc = await writeDoc(
      "tokens.qmd",
      ["# Title", "", "```{python}", ...body, "```", ""].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    let tokens: vscode.SemanticTokens | undefined;
    for (let attempt = 0; attempt < 30; attempt++) {
      tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens",
        doc.uri,
      );
      if (tokens !== undefined && tokens.data.length > 0) {
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    assert.ok(
      tokens && tokens.data.length > 0,
      `real Pylance must serve semantic tokens INSIDE a {python} cell. Got none, while ` +
        `the control returned ${controlCount} on the same code in a plain .py — so Pylance ` +
        `is alive and the forward is broken.`,
    );

    // Decode in OUR legend — which is what the provider emits, and is a different index
    // space from Pylance's. Getting readable names out of it is itself proof the remap ran.
    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });

    // The cell body starts on .qmd line 3 (`# Title`, blank, fence, then `import os`).
    // Every token must land inside the body — never on the fence, the prose, or line 0.
    const BODY_FIRST = 3;
    const BODY_LAST = BODY_FIRST + body.length - 1;
    const stray = decoded.filter((t) => t.line < BODY_FIRST || t.line > BODY_LAST);
    assert.deepStrictEqual(
      stray,
      [],
      `every token must land on a cell BODY line (${BODY_FIRST}–${BODY_LAST}); the identity ` +
        `mapping is what guarantees that, and a stray token means it is broken`,
    );

    // Spot-check real content at real coordinates: `CONSTANT` is on .qmd line 5, column 0.
    const constant = decoded.find((t) => t.line === BODY_FIRST + 2 && t.char === 0);
    assert.ok(
      constant,
      `expected a token for CONSTANT at .qmd line ${BODY_FIRST + 2}, col 0; got ` +
        decoded.map((t) => `${t.type}@${t.line}:${t.char}`).join(", "),
    );
    assert.strictEqual(constant.type, "variable", "CONSTANT must come back as a variable");
    assert.ok(
      constant.modifiers.includes("readonly"),
      `CONSTANT must carry the READONLY modifier remapped into our legend's bit order. ` +
        `Pylance sets readonly at bit 7; our legend has it at bit 2, and bit 7 is ` +
        `\`modification\` — so a naive bitset copy would report [${constant.modifiers.join(", ")}] ` +
        `and silently tell the theme a constant is being mutated.`,
    );

    // ── Slice 3 / D4 — THE DONE GATE ────────────────────────────────────────────────────
    //
    // `os` must now come back as a `module` token. This is the entire user-visible win of
    // D4, and it is the one assertion no stand-in and no unit test can make for us: `module`
    // is a name only a REAL Pylance emits, and until this slice our legend dropped it on the
    // floor. It appears twice in the fixture — the `import os` on the first body line, and
    // the `os.getcwd()` on the last — so we can also prove it is not a one-off.
    //
    // If this fails while the control is green, the legend change did not reach the wire.
    const modules = decoded.filter((t) => t.type === "module");
    assert.ok(
      modules.length >= 2,
      `real Pylance types \`os\` as \`module\`, and D4 carries that name. Expected it on the ` +
        `\`import os\` line and again in \`os.getcwd()\`; got ${modules.length}. Decoded: ` +
        decoded.map((t) => `${t.type}@${t.line}:${t.char}`).join(", "),
    );
    const importedOs = decoded.find((t) => t.line === BODY_FIRST && t.char === 7);
    assert.ok(importedOs, "expected a token for `os` at the import, .qmd line 3 col 7");
    assert.strictEqual(
      importedOs.type,
      "module",
      "`os` must survive as `module` — the foreign name D4 decided to CARRY, because " +
        "MagicPython gives a module name no TextMate scope at all and so the semantic layer " +
        "has something to add and nothing to destroy",
    );
    console.log(
      `  [D4] ${modules.length} \`module\` tokens survived into our legend: ` +
        modules.map((t) => `${t.type}@${t.line}:${t.char}`).join(", "),
    );

    // And the names D4 decided NOT to carry must still be absent — carrying them would strand
    // each token on a superType default that is measurably WRONG in the real default theme.
    const mustNotCarry = ["selfParameter", "magicFunction", "builtinConstant", "parenthesis"];
    const leaked = decoded.filter((t) => mustNotCarry.includes(t.type));
    assert.deepStrictEqual(
      leaked.map((t) => t.type),
      [],
      "the ten foreign names Pylance styles ITSELF must stay dropped — TextMate already " +
        "colours them correctly, and overriding it can only make them worse",
    );

    // Report the post-D4 numbers with real data.
    const dropped = controlCount - decoded.length;
    console.log(
      `  [tokens] forwarded ${decoded.length} of Pylance's ${controlCount} tokens ` +
        `(${dropped} deliberately dropped — the names Pylance styles itself, D4/Slice 3)`,
    );
    console.log(
      `  [tokens] ${decoded.map((t) => `${t.type}${t.modifiers.length ? "." + t.modifiers.join(".") : ""}@${t.line}:${t.char}`).join("  ")}`,
    );
  });

  it("SEMANTIC TOKENS: carries `typeHintComment` (matches .py) but NOT `builtin` (already matches .py) — BACKLOG:127", async () => {
    // The modifier-axis DONE gate, and the only test that can settle it: it takes a REAL server
    // to prove BOTH halves of BACKLOG:127's resolution — that Pylance actually EMITS
    // `typeHintComment` (so carrying it is not a dead `intrinsic`-style entry, Learning #100), and
    // that our `.qmd` now PRESERVES it; and, on the refuted half, that `print`/`__name__` still
    // come back BARE (we did NOT carry `builtin`, because a real `.py` shows them bare too).
    //
    // The fixture MUST contain a legacy `# type: T` comment — that is the only place Pylance
    // emits `typeHintComment`. Two forms, so a single-token fluke cannot pass it.
    const body = [
      "from typing import List",
      "",
      "def greet(name):",
      "    print(name)",            // print  -> function + builtin  (must round-trip BARE)
      "",
      "the_mod = __name__",         // __name__ -> variable + builtin (must round-trip BARE)
      "xs = []  # type: List[int]", // List/int here -> class + typeHintComment (must SURVIVE)
      "n = 0  # type: int",
    ];

    // CONTROL: decode a plain `.py` against PYLANCE's OWN legend, to prove `typeHintComment` is
    // genuinely on the wire from a real server (the rule the `intrinsic` bug taught).
    const control = await writeDoc("modifier-control.py", `${body.join("\n")}\n`);
    await vscode.window.showTextDocument(control, { preview: false });
    let pyLegend: vscode.SemanticTokensLegend | undefined;
    let pyTokens: vscode.SemanticTokens | undefined;
    for (let attempt = 0; attempt < 60; attempt++) {
      pyLegend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
        "vscode.provideDocumentSemanticTokensLegend", control.uri);
      pyTokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens", control.uri);
      if (pyTokens && pyTokens.data.length > 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(
      pyTokens && pyTokens.data.length > 0 && pyLegend,
      "CONTROL FAILED: real Pylance served no semantic tokens on a plain .py — nothing can be concluded.",
    );
    const rawPy = decodeTokens({
      data: pyTokens.data,
      legend: { tokenTypes: pyLegend.tokenTypes, tokenModifiers: pyLegend.tokenModifiers },
    });
    const pyTypeHint = rawPy.filter((t) => t.modifiers.includes("typeHintComment"));
    assert.ok(
      pyTypeHint.length >= 2,
      `real Pylance must EMIT \`typeHintComment\` inside the two \`# type:\` comments (that is the ` +
        `only thing that makes carrying the modifier legitimate rather than a dead legend entry). ` +
        `Got ${pyTypeHint.length}. Raw: ${rawPy.map((t) => `${t.type}.${t.modifiers.join(".")}`).join(" ")}`,
    );

    // The same code as a {python} cell — decode OUR provider's output against OUR legend.
    const doc = await writeDoc("modifier.qmd", ["```{python}", ...body, "```", ""].join("\n"));
    await vscode.window.showTextDocument(doc, { preview: false });
    let tokens: vscode.SemanticTokens | undefined;
    for (let attempt = 0; attempt < 30; attempt++) {
      tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens", doc.uri);
      if (tokens && tokens.data.length > 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(tokens && tokens.data.length > 0, "real Pylance must serve tokens inside the {python} cell");
    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    console.log(`  [modifier] ${decoded.map((t) =>
      `${t.type}${t.modifiers.length ? "." + t.modifiers.join(".") : ""}@${t.line}:${t.char}`).join("  ")}`);

    // (1) THE FIX: `typeHintComment` SURVIVES our re-encode — the comment interior is a comment.
    const carried = decoded.filter((t) => t.modifiers.includes("typeHintComment"));
    assert.ok(
      carried.length >= 2,
      `our provider must PRESERVE \`typeHintComment\` on the \`# type:\` comment tokens (BACKLOG:127 (a)); ` +
        `got ${carried.length}. Decoded: ${decoded.map((t) => `${t.type}.${t.modifiers.join(".")}`).join(" ")}`,
    );

    // (2) THE REFUTATION (BACKLOG:127 (b)): `builtin` is genuinely on the wire, but we deliberately
    // CLEAR it — because a real `.py` shows print/__name__ bare too (Pylance ships no
    // function.builtin/variable.builtin scope rule), so carrying `builtin` would DIVERGE from the
    // `.py`. The honest proof is a PAIR: (a) real Pylance EMITS builtin (symmetric with the
    // typeHintComment emission proof above — else "we drop it" is vacuous), and (b) our legend
    // cannot even express it, so the re-encode clears it. A filter on our OWN output for "builtin"
    // would be tautological (decodeTokens resolves names only against OUR_LEGEND), so it is not the
    // proof — the control decode is.
    const pyBuiltin = rawPy.filter((t) => t.modifiers.includes("builtin"));
    assert.ok(
      pyBuiltin.length >= 2,
      `real Pylance must EMIT \`builtin\` on print/__name__ — else "we deliberately drop it" proves ` +
        `nothing. Got ${pyBuiltin.length}. Raw: ${rawPy.map((t) => `${t.type}.${t.modifiers.join(".")}`).join(" ")}`,
    );
    assert.ok(
      !OUR_LEGEND.tokenModifiers.includes("builtin"),
      "our legend must NOT carry `builtin` (the refuted half of BACKLOG:127) — so the re-encode " +
        "clears every builtin bit and print/__name__ come back bare, matching a real .py",
    );
  });

  it("SEMANTIC TOKENS: merges REAL Pylance and the REAL built-in JS service into one stream", async () => {
    // BACKLOG item 16, Slice 2's DONE gate, and the only test that can prove it: two
    // GENUINELY DIFFERENT language servers, each with its own legend, answering about one
    // `.qmd` — merged into the single ascending stream VS Code accepts.
    //
    // The fixture straddles deliberately. Python's cells sit ABOVE and BELOW the {ojs} cell,
    // and the provider forwards in first-appearance order (python first), so the streams
    // concatenate to lines [3, 11, 12, 7] — NOT ascending. The merge's sort is therefore
    // load-bearing against real data, not just against fixtures: without it the delta from
    // line 12 back to line 7 is negative and wraps in a Uint32Array to ~4.29 billion.
    const PY_CONST = 3;
    const JS_LINE = 7;
    const PY_DEF = 11;
    const doc = await writeDoc(
      "merged.qmd",
      [
        "# Title", // 0
        "", // 1
        "```{python}", // 2
        "CONSTANT = 42", // 3   <- python
        "```", // 4
        "", // 5
        "```{ojs}", // 6
        "const GREETING = 'hi';", // 7   <- javascript, BETWEEN the two python cells
        "```", // 8
        "", // 9
        "```{python}", // 10
        "def main():", // 11  <- python
        "    return CONSTANT", // 12  <- python
        "```", // 13
        "", // 14
      ].join("\n"),
    );
    await vscode.window.showTextDocument(doc, { preview: false });

    // Poll until BOTH languages have landed. This is not just harness patience: the JS
    // service's LEGEND command returns `undefined` on its first call while its TOKEN command
    // already answers (measured this session), so the first pass legitimately carries python
    // only. That the document is correctly coloured anyway — and then self-heals to include
    // javascript — IS the "degrades per language" contract, observed rather than asserted.
    let decoded: ReturnType<typeof decodeTokens> = [];
    for (let attempt = 0; attempt < 60; attempt++) {
      const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
        "vscode.provideDocumentSemanticTokens",
        doc.uri,
      );
      if (tokens !== undefined && tokens.data.length > 0) {
        decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
        if (decoded.some((t) => t.line === JS_LINE) && decoded.some((t) => t.line === PY_CONST)) {
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    const py = decoded.filter((t) => t.line !== JS_LINE);
    const js = decoded.filter((t) => t.line === JS_LINE);
    console.log(
      `  [merge] ${decoded.length} tokens: ${py.length} from real Pylance, ${js.length} from the ` +
        `real built-in TS/JS service`,
    );
    console.log(
      `  [merge] ${decoded.map((t) => `${t.type}${t.modifiers.length ? "." + t.modifiers.join(".") : ""}@${t.line}:${t.char}`).join("  ")}`,
    );

    assert.ok(py.length > 0, "real Pylance must contribute tokens to the merged stream");
    assert.ok(
      js.length > 0,
      `the real built-in JS service must contribute tokens for the {ojs} cell (line ${JS_LINE}). ` +
        `Got only python's. Slice 1 could reach neither; this is the whole point of Slice 2.`,
    );

    // THE invariant VS Code requires of any semantic-token stream, and the one the merge
    // exists to guarantee: strictly ascending (line, char). Two servers' streams interleave
    // arbitrarily, so this is exactly what a missing sort would break.
    for (let i = 1; i < decoded.length; i++) {
      const prev = decoded[i - 1];
      const cur = decoded[i];
      assert.ok(
        cur.line > prev.line || (cur.line === prev.line && cur.char >= prev.char),
        `the merged stream must be ascending; token ${i} (${cur.type}@${cur.line}:${cur.char}) ` +
          `follows ${prev.type}@${prev.line}:${prev.char}`,
      );
    }

    // Every token must land on a cell BODY line — never a fence, the prose, or the title.
    const BODY_LINES = new Set([PY_CONST, JS_LINE, PY_DEF, 12]);
    const stray = decoded.filter((t) => !BODY_LINES.has(t.line));
    assert.deepStrictEqual(
      stray.map((t) => `${t.type}@${t.line}:${t.char}`),
      [],
      "the identity mapping must land every token inside a cell body",
    );

    // And the bitset remap, proven from BOTH servers at once — the two disagree about
    // `readonly` in DIFFERENT ways (Pylance bit 7, the JS service bit 3; ours is bit 2), so
    // a naive index copy would report the Python constant as `modification` and the JS one
    // as `static`. Both must arrive as `readonly`.
    const pyConst = decoded.find((t) => t.line === PY_CONST && t.char === 0);
    assert.ok(pyConst, "CONSTANT must be tokenized by Pylance");
    assert.ok(
      pyConst.modifiers.includes("readonly"),
      `CONSTANT must carry readonly remapped out of PYLANCE's bit 7; got [${pyConst.modifiers.join(", ")}]`,
    );
    const jsConst = decoded.find((t) => t.line === JS_LINE && t.char === 6); // `GREETING`
    assert.ok(jsConst, "GREETING must be tokenized by the built-in JS service");
    assert.ok(
      jsConst.modifiers.includes("readonly"),
      `GREETING must carry readonly remapped out of the JS SERVICE's bit 3 — a different bit ` +
        `from Pylance's, decoded against a different legend; got [${jsConst.modifiers.join(", ")}]`,
    );
    assert.ok(
      !jsConst.modifiers.includes("static"),
      `a naive index copy would make the JS service's readonly (bit 3) our 'static' (bit 3); ` +
        `got [${jsConst.modifiers.join(", ")}]`,
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
