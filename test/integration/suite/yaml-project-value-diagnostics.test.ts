import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";
const CODE = "quarto-invalid-project-value";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const INVALID = path.resolve(ROOT, "test/fixtures/yaml-project-value/invalid/_quarto.yml");
const VALID = path.resolve(ROOT, "test/fixtures/yaml-project-value/valid/_quarto.yml");
const QMD_FIXTURE = path.resolve(ROOT, "test/fixtures/sample.qmd");

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

/** ONLY this feature's diagnostics on `uri` (filtered by its own code, so the
 * co-active unknown-KEY feature's `Quarto`-source entries never leak in). */
function valueDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter((d) => d.code === CODE);
}

describe("Quarto: _quarto.yml project:/website:/book: VALUE diagnostics", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 5 wrong CLOSED values across project:/website:/book:, each at its value span", async () => {
    const doc = await openActive(INVALID);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000),
      "expected value diagnostics to appear within 5s of opening",
    );
    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      5,
      `expected exactly 5, got: ${diags.map((d) => d.message).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // (0-indexed lines) 2 execute-dir, 5 draft-mode, 6 repo-actions, 9 downloads, 10 sharing
    assert.ok(byLine.get(2)?.message.includes("execute-dir"), "project.execute-dir on line 2");
    assert.ok(byLine.get(5)?.message.includes("draft-mode"), "website.draft-mode on line 5");
    assert.ok(byLine.get(6)?.message.includes("repo-actions"), "website.repo-actions on line 6");
    assert.ok(byLine.get(9)?.message.includes("downloads"), "book.downloads on line 9");
    assert.ok(byLine.get(10)?.message.includes("sharing"), "book.sharing on line 10");

    // Value spans (half-open) match the enumerator's exact ranges.
    assert.deepStrictEqual(
      [byLine.get(2)?.range.start.character, byLine.get(2)?.range.end.character],
      [15, 21],
      "execute-dir value `banana` spans cols 15..21",
    );
    assert.deepStrictEqual(
      [byLine.get(5)?.range.start.character, byLine.get(5)?.range.end.character],
      [14, 20],
      "draft-mode value `hidden` spans cols 14..20",
    );

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, CODE);
    }
  });

  it("does NOT flag project.type: whatever — string:{completions} is schema-OPEN; `banana` there fails DOWNSTREAM, not the schema layer (the cardinal-sin trap, plan §2.2)", async () => {
    const doc = await openActive(INVALID);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));
    // `project.type: whatever` is on line 1; a resolver that wrongly curated
    // project.type closed would flag it — that would be a value quarto's SCHEMA
    // layer accepts (`Unsupported project type` is a projectType() error, not
    // readAndValidateYamlFromFile), the exact false positive this feature forbids.
    assert.ok(
      valueDiagnostics(doc.uri).every((d) => d.range.start.line !== 1),
      "project.type (line 1) must never be flagged — it is schema-open",
    );
  });

  it("produces ZERO value diagnostics for a valid _quarto.yml (valid enums/booleans, open strings, flow sequences, and a multi-line quoted value with an embedded mapping-looking line)", async () => {
    // Ordered AFTER the flag test above so this feature's SchemaSource cache is warm
    // (the first _quarto.yml event spawns `quarto --paths` + parses the ~680KB schema).
    // The FP battery: valid closed values (draft-mode: gone, sharing: twitter, type:
    // book), booleans (reader-mode/back-to-top-navigation), an open string title, flow
    // sequences (repo-actions/downloads → matcher skips leading `[`), and a multi-line
    // QUOTED title whose folded `draft-mode: not-a-real-value here` line MUST NOT be
    // flagged (the scanFlow continuation guard — the load-bearing FP, plan §2.3/§7.3).
    const doc = await openActive(VALID);
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("re-scans live on edit (debounced) and drops a diagnostic once its value is fixed", async () => {
    const doc = await openActive(INVALID);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(5).range, "  draft-mode: gone"); // hidden -> a valid member
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 4, 3000),
      "fixing website.draft-mode should drop the value-diagnostic count from 5 to 4 after the debounce",
    );
  });

  it("never produces a value diagnostic on a .qmd document — the filename gate structurally excludes it", async () => {
    const doc = await openActive(QMD_FIXTURE);
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0);
  });
});
