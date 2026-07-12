import * as assert from "node:assert";
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");

/**
 * ACCEPT-path fixture: a knitr *spin* script (`#' ---` … `#' ---`). Deliberately
 * NOT a Jupyter percent script — the knitr engine needs no Jupyter kernel, so
 * this gives the accept path a REAL, successful `quarto preview` round-trip
 * (verified firsthand: "Output created" + "Browse at http://localhost:…").
 *
 * ⚠ Requires R + knitr in the test environment (present on the dev machine;
 * a CI runner must install them). A jupyter-percent script could not do this —
 * without a kernel it fast-fails, so only the gate could be asserted, not a
 * successful preview.
 */
const SPIN = path.resolve(ROOT, "test/fixtures/render-script-spin.R");

/**
 * REJECT-path fixture: ordinary Python with percent CODE cells but no leading
 * markdown/raw cell. It also contains the literal substring `raw]`, which makes
 * it the integration-level twin of the unit DISCRIMINATOR tests: Quarto's OWN
 * (buggy, unanchored) regex calls this a render script and tries to boot a
 * python kernel for it — verified firsthand against 1.7.33. Ours must refuse it.
 */
const NOT_SCRIPT = path.resolve(ROOT, "test/fixtures/not-a-render-script.py");

/** A real .qmd — `quarto.preview`'s territory, not `previewScript`'s. */
const QMD = path.resolve(ROOT, "test/fixtures/sample.qmd");

/**
 * Count processes whose command line matches `pattern`. POSIX-only (darwin);
 * `|| true` turns pgrep's "no match" exit 1 into a clean empty result.
 */
function pgrepCount(pattern: string): number {
  const out = execSync(`pgrep -f ${JSON.stringify(pattern)} || true`, {
    encoding: "utf8",
  });
  return out.split("\n").filter((line) => line.trim().length > 0).length;
}

/**
 * Live preview servers for ANY render-script fixture. Matches `preview.*<name>`
 * (not "quarto preview") because the real worker is a deno process whose command
 * line reads `quarto.js preview … render-script-spin.R` — the literal substring
 * "quarto preview" never appears (the gate-d faithful-verification trap the
 * sibling preview suites document).
 */
function scriptPreviewCount(): number {
  return (
    pgrepCount("preview.*render-script-spin") +
    pgrepCount("preview.*not-a-render-script")
  );
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return predicate();
}

/**
 * Stub `showErrorMessage`, capturing what the gate said, restoring in `finally`.
 * The established stub technique in this suite (new-document/convert-notebook).
 */
async function withErrorCapture<T>(
  captured: string[],
  body: () => Promise<T>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowAny = vscode.window as any;
  const original = windowAny.showErrorMessage;
  windowAny.showErrorMessage = (message: string) => {
    captured.push(message);
    return Promise.resolve(undefined);
  };
  try {
    return await body();
  } finally {
    windowAny.showErrorMessage = original;
  }
}

async function openActive(file: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
}

describe("Quarto: Preview Script command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    // Safety net: never leak a preview worker out of a test, even on failure.
    execSync('pkill -9 -f "preview.*render-script-spin" || true');
    execSync('pkill -9 -f "preview.*not-a-render-script" || true');
  });

  it("registers the quarto.previewScript command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.previewScript"),
      "quarto.previewScript should be registered after activation",
    );
  });

  it("previews a knitr spin script end to end (real server, no orphan)", async function () {
    this.timeout(120000);
    assert.strictEqual(
      scriptPreviewCount(),
      0,
      "no preview server should be running before the test",
    );

    await openActive(SPIN);
    const errors: string[] = [];
    await withErrorCapture(errors, async () => {
      await vscode.commands.executeCommand("quarto.previewScript");
    });

    // The gate passed — no "not a render script" refusal.
    assert.deepStrictEqual(
      errors,
      [],
      "a valid spin script must not be refused by the gate",
    );

    // ...and a REAL preview server actually spawned for it (knitr, no kernel).
    assert.ok(
      await waitFor(() => scriptPreviewCount() > 0, 60000),
      "a quarto preview server should be running for the spin script",
    );

    // Closing the pane must kill the server — no orphan.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    assert.ok(
      await waitFor(() => scriptPreviewCount() === 0, 20000),
      "the preview server must be killed when the pane closes (no orphan)",
    );
  });

  it("refuses ordinary code that Quarto's own buggy regex would accept (no spawn)", async function () {
    this.timeout(30000);

    await openActive(NOT_SCRIPT);
    const errors: string[] = [];
    await withErrorCapture(errors, async () => {
      await vscode.commands.executeCommand("quarto.previewScript");
    });

    // gate-d discriminator: this fixture contains `raw]`, so the CLI's own
    // unanchored regex calls it a render script and boots a python kernel for it
    // (firsthand-verified). Our gate must refuse it — and refuse it by NAME, so
    // this cannot pass by some unrelated error (e.g. "Quarto was not found").
    assert.strictEqual(errors.length, 1, "the gate should show exactly one error");
    assert.match(
      errors[0],
      /render script/i,
      "the refusal must be the render-script gate's own message",
    );

    // Nothing was spawned — the gate short-circuits before openPreview.
    const spawned = await waitFor(() => scriptPreviewCount() > 0, 3000);
    assert.strictEqual(
      spawned,
      false,
      "refusing a non-render-script must not spawn a preview server",
    );
  });

  it("refuses a .qmd — that is quarto.preview's job, not previewScript's", async function () {
    this.timeout(30000);

    await openActive(QMD);
    const errors: string[] = [];
    await withErrorCapture(errors, async () => {
      await vscode.commands.executeCommand("quarto.previewScript");
    });

    assert.strictEqual(errors.length, 1, "the gate should refuse a .qmd");
    assert.match(errors[0], /render script/i);
    assert.strictEqual(
      pgrepCount("preview.*sample.qmd"),
      0,
      "previewScript must not spawn a preview for a .qmd",
    );
  });
});
