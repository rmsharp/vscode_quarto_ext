import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  createDebouncedDiagnosticsFeature,
  type ComputeDiagnostics,
  type DebouncedDiagnosticsFeatureSpec,
} from "../../../src/features/debounced-diagnostics";

/**
 * Direct coverage for the shared `createDebouncedDiagnosticsFeature` skeleton
 * (CHANGELOG: createDebouncedDiagnosticsFeature extraction, Session 126) via a SYNTHETIC feature — a stand-in `gate`/`compute`
 * exercised in the real `@vscode/test-electron` host. This gives the extracted
 * machinery its own tests (the two real callers only exercise it indirectly, and
 * the yaml-diagnostics suite documents that it can only smoke-test the
 * generation-guard race and the close/cancel path MANUALLY). The synthetic gate
 * matches only untitled plaintext documents, which the shipped `_quarto.yml`
 * (filename) and `.qmd` (languageId "quarto") features never react to, and every
 * assertion filters by a unique diagnostic `code`, so there is no cross-talk.
 */

const TEST_CODE = "test-debounced";

/** A diagnostic tagged with TEST_CODE so assertions can filter it from any other source. */
function diag(line: number, message: string): vscode.Diagnostic {
  const d = new vscode.Diagnostic(
    new vscode.Range(line, 0, line, 1),
    message,
    vscode.DiagnosticSeverity.Warning,
  );
  d.code = TEST_CODE;
  return d;
}

/** Only diagnostics this suite produced (filtered from every other source on the URI). */
function testDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter((d) => d.code === TEST_CODE);
}

/** The synthetic gate: untitled plaintext only — the shipped features ignore these. */
function syntheticGate(document: vscode.TextDocument): boolean {
  return document.uri.scheme === "untitled" && document.languageId === "plaintext";
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return predicate();
}

async function openUntitled(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({ language: "plaintext", content });
  await vscode.window.showTextDocument(doc);
  return doc;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("Quarto: createDebouncedDiagnosticsFeature (shared skeleton, CHANGELOG: createDebouncedDiagnosticsFeature extraction, Session 126)", () => {
  // The synthetic feature under test, disposed after each test so it never leaks
  // listeners (or a live collection) into the shared Extension Development Host.
  let disposeFeature: (() => void) | undefined;

  /** Register a synthetic feature against a throwaway context; remember how to dispose it. */
  function register(spec: DebouncedDiagnosticsFeatureSpec): void {
    const subscriptions: { dispose(): void }[] = [];
    const context = { subscriptions } as unknown as vscode.ExtensionContext;
    createDebouncedDiagnosticsFeature(spec)(context);
    disposeFeature = () => {
      for (const s of subscriptions.splice(0)) {
        s.dispose();
      }
      disposeFeature = undefined;
    };
  }

  afterEach(async () => {
    disposeFeature?.();
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("writes computed diagnostics on open for a gated document", async () => {
    const compute: ComputeDiagnostics = async () => [diag(0, "hello")];
    register({ collectionName: "test-debounced", gate: syntheticGate, compute });

    const doc = await openUntitled("some text");

    assert.ok(
      await waitFor(() => testDiagnostics(doc.uri).length === 1, 3000),
      "expected exactly 1 diagnostic after the gated document opens",
    );
    assert.strictEqual(testDiagnostics(doc.uri)[0]?.message, "hello");
  });

  it("does NOT write when compute returns null (the superseded/closed sentinel)", async () => {
    const compute: ComputeDiagnostics = async () => null;
    register({ collectionName: "test-debounced", gate: syntheticGate, compute });

    const doc = await openUntitled("some text");
    await new Promise((r) => setTimeout(r, 300));

    assert.strictEqual(testDiagnostics(doc.uri).length, 0, "a null result must write nothing");
  });

  it("ignores a non-gated document (never computes, never writes)", async () => {
    let calls = 0;
    const compute: ComputeDiagnostics = async () => {
      calls += 1;
      return [diag(0, "x")];
    };
    register({ collectionName: "test-debounced", gate: syntheticGate, compute });

    // scheme matches (untitled) but languageId does not (markdown) → gate is false.
    const doc = await vscode.workspace.openTextDocument({ language: "markdown", content: "hi" });
    await vscode.window.showTextDocument(doc);
    await new Promise((r) => setTimeout(r, 300));

    assert.strictEqual(calls, 0, "compute must never run for a non-gated document");
    assert.strictEqual(testDiagnostics(doc.uri).length, 0);
  });

  it("re-scans on edit (debounced) and coalesces rapid edits into one recompute", async () => {
    const seen: string[] = [];
    const compute: ComputeDiagnostics = async (document) => {
      const text = document.getText();
      seen.push(text);
      return text.includes("BAD") ? [diag(0, "bad")] : [];
    };
    register({ collectionName: "test-debounced", gate: syntheticGate, compute });

    const doc = await openUntitled("BAD start");
    assert.ok(
      await waitFor(() => testDiagnostics(doc.uri).length === 1, 3000),
      "BAD content should produce 1 diagnostic on open",
    );

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    const fullRange = (): vscode.Range => new vscode.Range(0, 0, doc.lineCount, 0);
    seen.length = 0;
    // Two rapid edits within one debounce window: the first arms a timer, the
    // second cancels it (cancelPending) and re-arms — so only the FINAL content
    // is recomputed, once.
    await editor.edit((b) => b.replace(fullRange(), "still BAD here"));
    await editor.edit((b) => b.replace(fullRange(), "now clean"));

    assert.ok(
      await waitFor(() => testDiagnostics(doc.uri).length === 0, 3000),
      "editing to clean content should clear the diagnostic after the debounce",
    );
    assert.deepStrictEqual(
      seen,
      ["now clean"],
      `rapid edits should coalesce to one recompute of the final text, got: ${JSON.stringify(seen)}`,
    );
  });

  it("generation guard: a slow refresh resolving after a newer one discards its own result", async () => {
    // The Session-47 concurrency fix. Refresh #1 (gen1) blocks in `compute` on a
    // slow first "schema load"; while it is blocked, an edit fires refresh #2
    // (gen2), which lands "gen2" first. When gen1 finally resumes it must see
    // `!isCurrent()` and return null — never overwriting gen2's newer result.
    let calls = 0;
    const slowFirstLoad = deferred<void>();
    const compute: ComputeDiagnostics = async (_document, { isCurrent }) => {
      calls += 1;
      if (calls === 1) {
        await slowFirstLoad.promise; // gen1: block until released, AFTER gen2 has landed
        return isCurrent() ? [diag(0, "gen1")] : null;
      }
      return [diag(0, "gen2")]; // gen2: resolves immediately
    };
    register({ collectionName: "test-debounced", gate: syntheticGate, compute });

    const doc = await openUntitled("start"); // → gen1, blocked in compute
    await waitFor(() => calls === 1, 3000);

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((b) => b.insert(new vscode.Position(0, 0), "x")); // → gen2 after the debounce

    assert.ok(
      await waitFor(() => testDiagnostics(doc.uri)[0]?.message === "gen2", 3000),
      "gen2 (the newer refresh) should land its result first",
    );

    slowFirstLoad.resolve(); // release gen1; it must now discard itself
    await new Promise((r) => setTimeout(r, 300));

    assert.strictEqual(
      testDiagnostics(doc.uri)[0]?.message,
      "gen2",
      "the stale gen1 result must NOT overwrite the newer gen2 result",
    );
  });

  // ⚠ The onDidClose handler (`cancelPending` + `collection.delete`) is NOT
  // asserted here. Empirically, closing/disposing an untitled document makes VS
  // Code auto-clear its diagnostics across collections, so an "after close, zero
  // diagnostics" assertion is a FALSE GREEN — it passes with or without the
  // handler and proves nothing. This mirrors the real suites' documented gap
  // (`yaml-diagnostics.test.ts`: close-clears / D4 are host-unautomatable, verified
  // by manual smoke testing). The one genuinely testable half — that
  // `cancelPending` cancels a prior pending timer — is covered by the coalescing
  // assertion in "re-scans on edit …" above (the intermediate edit's timer is
  // cancelled, so only the final content is recomputed). The close wiring itself
  // is a verbatim copy of the two shipped features' hard-won lifecycle.

  it("primes already-open gated documents when the feature is registered", async () => {
    // Open the gated document FIRST, then register — the prime loop over
    // workspace.textDocuments must pick it up (not just future onDidOpen events).
    const doc = await openUntitled("prime me");
    const compute: ComputeDiagnostics = async () => [diag(0, "primed")];
    register({ collectionName: "test-debounced", gate: syntheticGate, compute });

    assert.ok(
      await waitFor(() => testDiagnostics(doc.uri).length === 1, 3000),
      "an already-open gated document should be primed on registration",
    );
    assert.strictEqual(testDiagnostics(doc.uri)[0]?.message, "primed");
  });
});
