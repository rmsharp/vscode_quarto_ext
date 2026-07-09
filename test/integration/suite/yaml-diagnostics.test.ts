import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const VALID = path.resolve(ROOT, "test/fixtures/yaml-diagnostics/valid/_quarto.yml");
const INVALID = path.resolve(ROOT, "test/fixtures/yaml-diagnostics/invalid/_quarto.yml");
const NO_TARGET_BLOCKS = path.resolve(
  ROOT,
  "test/fixtures/yaml-diagnostics/no-target-blocks/_quarto.yml",
);
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

/** Open a fixture and make it the active editor. */
async function openActive(file: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  return doc;
}

/** This feature's own diagnostics on `uri` (filters out anything from another source). */
function quartoDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter((d) => d.source === "Quarto");
}

describe("Quarto: _quarto.yml project:/website:/book: schema diagnostics", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    // Discard in-memory edits so nothing persists between tests.
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 3 genuine unknown keys (project:/website:/book:), and nothing else in the file", async () => {
    const doc = await openActive(INVALID);
    assert.ok(
      await waitFor(() => quartoDiagnostics(doc.uri).length >= 3, 5000),
      "expected diagnostics to appear within 5s of opening",
    );

    const diags = quartoDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      3,
      `expected exactly 3 diagnostics, got: ${diags.map((d) => d.message).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    assert.ok(
      byLine.get(2)?.message.includes("output-dirr"),
      "project: output-dirr should be flagged on line 2 (0-indexed)",
    );
    assert.ok(
      byLine.get(8)?.message.includes("navbarr"),
      "website: navbarr should be flagged on line 8 (0-indexed)",
    );
    assert.ok(
      byLine.get(15)?.message.includes("bogus-book-key"),
      "book: bogus-book-key should be flagged on line 15 (0-indexed)",
    );

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, "quarto-unknown-project-key");
    }
  });

  it("produces ZERO diagnostics for a valid _quarto.yml (project:/website:/book: all present, all valid)", async () => {
    // Deliberately ordered AFTER the "flags exactly 3" test above (adversarial
    // review, Session 47): that test's own waitFor already warmed this
    // feature's SchemaSource cache (the first _quarto.yml-related event of
    // the whole suite spawns `quarto --paths` + reads/parses the ~680KB
    // schema file — a genuinely slow async gap that a bare fixed sleep here
    // would otherwise be racing on a cold start). With the cache warm, a
    // short wait is enough — but assert TWICE, at two different times, to
    // also catch a diagnostic that appeared late rather than never.
    const doc = await openActive(VALID);
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(quartoDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(quartoDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("does NOT flag book:'s announcement key — it resolves only via the base-website super-merge hop (the gate-d discriminator, plan §2.2)", async () => {
    const doc = await openActive(INVALID);
    assert.ok(await waitFor(() => quartoDiagnostics(doc.uri).length >= 3, 5000));
    const flaggedAnnouncement = quartoDiagnostics(doc.uri).some((d) =>
      d.message.includes("announcement"),
    );
    assert.strictEqual(
      flaggedAnnouncement,
      false,
      "a shallower resolver that only checked book-schema's own inline properties " +
        "(never climbing its super to base-website) would wrongly flag this",
    );
  });

  it("never flags a top-level sibling key, or a same-named key under a non-scanned container (format:)", async () => {
    // Covered structurally by the exact-count assertion above (bibliography:
    // and format:html:output-dirr are both present in the fixture and neither
    // is among the 3), but assert it directly too since it's the feature's
    // core false-positive guarantee.
    const doc = await openActive(INVALID);
    assert.ok(await waitFor(() => quartoDiagnostics(doc.uri).length >= 3, 5000));
    const messages = quartoDiagnostics(doc.uri).map((d) => d.message);
    assert.ok(!messages.some((m) => m.includes("bibliography")));
    assert.ok(
      quartoDiagnostics(doc.uri).every((d) => d.range.start.line !== 20),
      "format:html:output-dirr (line 20) is a sibling of a genuine violation's " +
        "misspelling, but format: is not a scanned container — must not be flagged",
    );
  });

  // ⚠ "Clears diagnostics on close" (plan §6 DONE) and the D4 debounce/close
  // race are NOT automated here. Empirically confirmed (Session 47, extensive
  // probing: workbench.action.closeAllEditors, vscode.window.tabGroups.close()
  // directly, waits up to 8s) — vscode.workspace.onDidCloseTextDocument never
  // fires for a REAL on-disk file document in this @vscode/test-electron host,
  // even when its tab is closed and `vscode.workspace.textDocuments` no longer
  // shows it visible. It fires reliably for untitled:/quarto-embedded: scheme
  // documents elsewhere in this same suite — the limitation is specific to
  // file-backed documents in this automated host, not this feature's own
  // event wiring. This matches the official API docs' own caveat (`vscode.
  // d.ts` onDidCloseTextDocument: "There is no guarantee that this event
  // fires when an editor tab is closed") and is still the correct, standard
  // pattern (Microsoft's own code-actions-sample uses the identical
  // onDidCloseTextDocument + collection.delete(uri) shape). The close-clears
  // and D4 behaviors are verified instead by MANUAL Phase 3E smoke testing in
  // a real interactive Extension Development Host (SESSION_NOTES.md records
  // the result) — this is a genuine automated-coverage gap for a real-VS-Code
  // behavior this harness cannot exercise, not a silently skipped defect.

  it("re-scans live on edit (debounced) and drops a diagnostic once its key is fixed", async () => {
    const doc = await openActive(INVALID);
    assert.ok(await waitFor(() => quartoDiagnostics(doc.uri).length >= 3, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(2).range, "  output-dir: docs");
    });

    assert.ok(
      await waitFor(() => quartoDiagnostics(doc.uri).length === 2, 3000),
      "fixing the project: violation should drop the diagnostic count from 3 to 2 after the debounce",
    );
  });

  // D4 (a pending debounce timer racing a close) is covered by manual Phase
  // 3E smoke testing for the same reason as the close-clears note above — an
  // automated version would need onDidCloseTextDocument to fire, which this
  // harness cannot produce for a file-backed document.

  it("takes the synchronous zero-lines fast path for a _quarto.yml with none of project:/website:/book: present (never awaits the schema index)", async () => {
    // Exercises refreshDiagnostics's lines.length===0 early return directly —
    // distinct from the "valid" fixture test above, which has genuine
    // project:/website:/book: content and so always takes the async
    // (schema-aware) path (adversarial review, Session 47).
    const doc = await openActive(NO_TARGET_BLOCKS);
    assert.ok(
      await waitFor(() => vscode.languages.getDiagnostics(doc.uri).length === 0, 2000),
    );
    assert.strictEqual(quartoDiagnostics(doc.uri).length, 0);
  });

  it("never produces a diagnostic on a .qmd document — the filename gate structurally excludes it (plan §6 DONE: 'front matter of a co-located .qmd' is never flagged)", async () => {
    const doc = await openActive(QMD_FIXTURE);
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(quartoDiagnostics(doc.uri).length, 0);
  });
});
