import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";
const DIAGNOSTIC_CODE = "quarto-invalid-option-value";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const CELL_OPTIONS = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/cell-options.qmd");
const VALID_CELLS = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-cells.qmd");
const FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/front-matter.qmd");
const VALID_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-front-matter.qmd");
const NESTED_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/nested-front-matter.qmd");
const VALID_NESTED_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-nested-front-matter.qmd");
const NUMERIC_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/numeric-front-matter.qmd");
const VALID_NUMERIC_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-numeric-front-matter.qmd");

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return predicate();
}

async function openActive(file: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  return doc;
}

/** Only THIS feature's diagnostics (not the unknown-key sibling, which shares source "Quarto"). */
function valueDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter((d) => d.code === DIAGNOSTIC_CODE);
}

describe("Quarto: cell-option VALUE diagnostics (.qmd, plan §4.1 Phase 1)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 3 wrong closed-set values, and NOTHING for open/valid values", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000),
      "expected value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      3,
      `expected exactly 3, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // echo: maybe (line 7) — closed boolean, arbitrary string.
    assert.ok(byLine.get(7)?.message.includes("maybe"), "echo: maybe should flag on line 7");
    // code-overflow: banana (line 14) — closed string enum.
    assert.ok(byLine.get(14)?.message.includes("banana"), "code-overflow: banana should flag on line 14");
    // echo: "true" (line 16) — a QUOTED boolean is a string → rejected.
    assert.ok(byLine.get(16), "echo: \"true\" (quoted boolean) should flag on line 16");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("never flags an OPEN set — output (anyOf free arm) or animation-hook (string.completions)", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // output: banana (line 9) and animation-hook: myhook (line 15) both render exit 0 →
    // the cardinal-sin guard must leave them unflagged even with a bogus value.
    assert.ok(!lines.includes(9), "output: banana (open anyOf) must NOT be flagged");
    assert.ok(!lines.includes(15), "animation-hook: myhook (open string.completions) must NOT be flagged");
    // eval: true (line 8) is a valid boolean — also unflagged.
    assert.ok(!lines.includes(8), "eval: true (valid) must NOT be flagged");
  });

  it("targets the VALUE token range, not the whole line (echo: maybe → the `maybe` span)", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 7);
    assert.ok(d);
    // `#| echo: maybe` — `maybe` starts at column 9.
    assert.strictEqual(d.range.start.character, 9, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 14, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose cell-option values are all valid or open", async () => {
    const doc = await openActive(VALID_CELLS);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("re-scans live on edit (debounced) and drops a diagnostic once the value is fixed", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(7).range, "#| echo: false");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 2, 3000),
      "fixing echo: maybe → echo: false should drop the count from 3 to 2 after the debounce",
    );
  });
});

describe("Quarto: top-level front-matter VALUE diagnostics (.qmd, plan §4.2 Phase 2)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 5 wrong top-level values, and NOTHING for open/valid/format/free-string", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000),
      "expected front-matter value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      5,
      `expected exactly 5, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // toc: yes (line 1) — closed boolean, bare non-boolean string.
    assert.ok(byLine.get(1)?.message.includes("yes"), "toc: yes should flag on line 1");
    // number-sections: "false" (line 2) — a QUOTED boolean is a string → rejected.
    assert.ok(byLine.get(2), 'number-sections: "false" (quoted boolean) should flag on line 2');
    // df-print: banana (line 3) — closed string enum, total non-member.
    assert.ok(byLine.get(3)?.message.includes("banana"), "df-print: banana should flag on line 3");
    // cache: banana (line 8) — enum whose members include booleans ([true,false,refresh]); banana is off-list.
    assert.ok(byLine.get(8)?.message.includes("banana"), "cache: banana should flag on line 8");
    // pdf-engine: PDFLATEX (line 9) — closed string enum, WRONG CASE (membership is case-sensitive).
    assert.ok(byLine.get(9)?.message.includes("PDFLATEX"), "pdf-engine: PDFLATEX (wrong case) should flag on line 9");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("never flags an OPEN field (documentclass) or the intentionally-unvalidated top-level `format`", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // documentclass: myclass (line 5) — OPEN string.completions → never flagged.
    assert.ok(!lines.includes(5), "documentclass: myclass (open) must NOT be flagged");
    // format: htlm (line 6) — render-fatal, but intentionally UNVALIDATED (§4.2 dragon:
    // its enum is injected after closedness, so valuesClosed is unset → skipped).
    assert.ok(!lines.includes(6), "format: htlm (intentionally unvalidated) must NOT be flagged");
    // citations-hover: true (line 4) is a valid boolean; title: (line 7) is a free string.
    assert.ok(!lines.includes(4), "citations-hover: true (valid) must NOT be flagged");
    assert.ok(!lines.includes(7), "title: (free string) must NOT be flagged");
  });

  it("targets the VALUE token range, not the whole line (df-print: banana → the `banana` span)", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 3);
    assert.ok(d);
    // `df-print: banana` — `banana` starts at column 10.
    assert.strictEqual(d.range.start.character, 10, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 16, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose front-matter values are all valid or open", async () => {
    const doc = await openActive(VALID_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("re-scans live on edit (debounced) and drops a diagnostic once a value is fixed", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(1).range, "toc: true");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 4, 3000),
      "fixing toc: yes → toc: true should drop the count from 5 to 4 after the debounce",
    );
  });
});

describe("Quarto: NESTED front-matter VALUE diagnostics (.qmd, nested plan §3.4 Phase 3)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 5 wrong nested values (execute + format.html), and NOTHING for open/unknown", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000),
      "expected nested front-matter value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      5,
      `expected exactly 5, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // execute.echo: maybe (line 2) — curated closed boolean+fenced.
    assert.ok(byLine.get(2)?.message.includes("maybe"), "execute.echo: maybe should flag on line 2");
    // execute.eval: banana (line 3) — curated closed boolean.
    assert.ok(byLine.get(3)?.message.includes("banana"), "execute.eval: banana should flag on line 3");
    // format.html.toc: yes (line 8) — reader-derived closed boolean.
    assert.ok(byLine.get(8)?.message.includes("yes"), "format.html.toc: yes should flag on line 8");
    // format.html.number-sections: yes (line 9) — reader-derived closed boolean.
    assert.ok(byLine.get(9)?.message.includes("yes"), "format.html.number-sections: yes should flag on line 9");
    // format.html.df-print: banana (line 10) — reader-derived closed enum non-member.
    assert.ok(byLine.get(10)?.message.includes("banana"), "format.html.df-print: banana should flag on line 10");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("never flags an OPEN nested field (output/daemon/theme) or an UNKNOWN nested key", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // execute.output: banana (line 4) — OPEN anyOf free arm → never flagged.
    assert.ok(!lines.includes(4), "execute.output: banana (open) must NOT be flagged");
    // execute.daemon: 30 (line 5) — OPEN boolean-or-number → never flagged (numeric slice's job).
    assert.ok(!lines.includes(5), "execute.daemon: 30 (open) must NOT be flagged");
    // format.html.theme: banana (line 11) — OPEN free string → never flagged.
    assert.ok(!lines.includes(11), "format.html.theme: banana (open) must NOT be flagged");
    // format.html.notarealoption: yes (line 12) — UNKNOWN key → never flagged.
    assert.ok(!lines.includes(12), "format.html.notarealoption: yes (unknown) must NOT be flagged");
  });

  it("targets the VALUE token range at depth (format.html.toc: yes → the `yes` span)", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 8);
    assert.ok(d);
    // `    toc: yes` — `yes` starts at column 9 (4 indent + "toc: ").
    assert.strictEqual(d.range.start.character, 9, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 12, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose nested values are all valid or open", async () => {
    const doc = await openActive(VALID_NESTED_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("re-scans live on edit (debounced) and drops a nested diagnostic once the value is fixed", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(2).range, "  echo: false");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 4, 3000),
      "fixing execute.echo: maybe → echo: false should drop the count from 5 to 4 after the debounce",
    );
  });
});

describe("Quarto: NUMERIC front-matter VALUE diagnostics (.qmd, numeric plan §4.1 Phase 4)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 4 wrong numeric values (all four surfaces), and NOTHING for valid numbers", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000),
      "expected numeric value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      4,
      `expected exactly 4, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // columns: wide (line 1) — top-level number.
    assert.ok(byLine.get(1)?.message.includes("wide"), "columns: wide should flag on line 1");
    // format.html.fig-dpi: hi (line 6) — per-format number.
    assert.ok(byLine.get(6)?.message.includes("hi"), "format.html.fig-dpi: hi should flag on line 6");
    // execute.daemon: banana (line 9) — nested number-OR-boolean. The message MUST mention
    // "number" (regression-lock the §3.4 arm ordering — daemon also has values:[true,false]
    // + acceptsBoolean, so an appended-late arm would mis-message "expected true or false").
    assert.ok(byLine.get(9)?.message.includes("banana"), "execute.daemon: banana should flag on line 9");
    assert.ok(
      byLine.get(9)?.message.includes("number"),
      `execute.daemon: banana message must mention "number", got: ${byLine.get(9)?.message}`,
    );
    // cell #| layout-ncol: two (line 24) — cell-metadata number.
    assert.ok(byLine.get(24)?.message.includes("two"), "cell #| layout-ncol: two should flag on line 24");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("never flags a valid number, a number-or-boolean's valid form, or a valid boolean", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // fig-width: 6.5 (2) / toc-expand: 3 (3) / format.html.fig-width: 300 (7) /
    // execute.daemon-restart: true (10) / cell #| fig-width: 3 (25) — all VALID.
    for (const [ln, desc] of [
      [2, "fig-width: 6.5 (valid number)"],
      [3, "toc-expand: 3 (number-or-boolean, number form)"],
      [7, "format.html.fig-width: 300 (valid number)"],
      [10, "execute.daemon-restart: true (valid boolean)"],
      [25, "cell #| fig-width: 3 (valid number)"],
    ] as [number, string][]) {
      assert.ok(!lines.includes(ln), `${desc} must NOT be flagged (line ${ln})`);
    }
  });

  it("targets the VALUE token range, not the whole line (columns: wide → the `wide` span)", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 1);
    assert.ok(d);
    // `columns: wide` — `wide` starts at column 9.
    assert.strictEqual(d.range.start.character, 9, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 13, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose numeric values are all valid, exotic, or open (FP battery)", async () => {
    const doc = await openActive(VALID_NUMERIC_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("re-scans live on edit (debounced) and drops a numeric diagnostic once the value is fixed", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(1).range, "columns: 2");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 3, 3000),
      "fixing columns: wide → columns: 2 should drop the count from 4 to 3 after the debounce",
    );
  });
});
