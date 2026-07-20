import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";
const DIAGNOSTIC_CODE = "quarto-invalid-option-value";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const CELL_OPTIONS = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/cell-options.qmd");
const VALID_CELLS = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-cells.qmd");

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
