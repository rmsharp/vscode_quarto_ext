import * as assert from "node:assert";
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/preview-format.qmd");
const NOFORMAT = path.resolve(ROOT, "test/fixtures/preview-format-noformat.qmd");

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
 * Count live preview processes for the multi-format fixture. Matches
 * `preview.*preview-format.qmd` (NOT "quarto preview") because the real worker
 * is a deno process whose command line reads `quarto.js preview … preview-
 * format.qmd` — the `"quarto preview"` substring never appears (the same gate-d
 * faithful-verification trap the plain-preview suite documents).
 */
function previewProcessCount(): number {
  return pgrepCount("preview.*preview-format.qmd");
}

/**
 * True if a preview server for the multi-format fixture is running with the
 * given `--to <format>`. The `quarto preview` wrapper's command line reads
 * `… preview-format.qmd --no-browser --to <format>`, so the fixture path
 * precedes the format — this pins the alive server to a SPECIFIC format, the
 * discriminator the restart test needs (html reaped, docx alive).
 */
function formatServerAlive(format: string): boolean {
  return pgrepCount(`preview-format.qmd.*to ${format}`) > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
 * Stub `showQuickPick` to capture the items it was offered and resolve to
 * `choice`, restoring the original in `finally`. Capturing the items is the
 * gate-d discriminator: it proves `parseDeclaredFormats` actually drove the
 * picker, rather than a hardcoded list.
 */
async function withQuickPick<T>(
  choice: string,
  captured: string[],
  body: () => Promise<T>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowAny = vscode.window as any;
  const original = windowAny.showQuickPick;
  windowAny.showQuickPick = (items: readonly string[]) => {
    captured.splice(0, captured.length, ...items);
    return Promise.resolve(choice);
  };
  try {
    return await body();
  } finally {
    windowAny.showQuickPick = original;
  }
}

async function openActive(file: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
}

describe("Quarto: Preview Format command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(() => {
    // Safety net: never leak a preview worker out of a test, even on failure.
    // Broad enough to reap BOTH fixtures (preview-format.qmd and
    // preview-format-noformat.qmd).
    execSync('pkill -9 -f "preview.*preview-format" || true');
  });

  it("registers the quarto.previewFormat command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.previewFormat"),
      "quarto.previewFormat should be registered after activation",
    );
  });

  it("offers the document's declared formats and previews the chosen one (no orphan)", async function () {
    this.timeout(90000);
    assert.strictEqual(
      previewProcessCount(),
      0,
      "no preview server should be running before the test",
    );

    await openActive(FIXTURE);
    const captured: string[] = [];
    await withQuickPick("html", captured, async () => {
      await vscode.commands.executeCommand("quarto.previewFormat");
    });

    // gate-d: the picker was populated from the fixture's OWN declared formats,
    // proving parseDeclaredFormats fed the QuickPick.
    assert.deepStrictEqual(
      captured,
      ["html", "docx"],
      "the QuickPick should offer the document's declared formats in order",
    );

    // The chosen format was actually previewed — a real server spawned.
    const alive = await waitFor(() => previewProcessCount() > 0, 30000);
    assert.ok(
      alive,
      "a quarto preview server should be running after the format is chosen",
    );

    // Closing the pane must kill the server — no orphan.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    const reaped = await waitFor(() => previewProcessCount() === 0, 20000);
    assert.ok(
      reaped,
      "the preview server must be killed when the pane closes (no orphan)",
    );
  });

  it("restarts the preview in the new format when a different format is chosen (no orphan, old server reaped)", async function () {
    this.timeout(120000);
    assert.strictEqual(previewProcessCount(), 0, "clean before the test");

    await openActive(FIXTURE);

    // Preview html first.
    await withQuickPick("html", [], async () => {
      await vscode.commands.executeCommand("quarto.previewFormat");
    });
    assert.ok(
      await waitFor(() => formatServerAlive("html"), 30000),
      "an html preview server should be running after the first choice",
    );

    // Now pick docx — a DIFFERENT format. This must tear the html preview down
    // and start a docx one (the slice's marquee restart behavior).
    await withQuickPick("docx", [], async () => {
      await vscode.commands.executeCommand("quarto.previewFormat");
    });
    assert.ok(
      await waitFor(() => formatServerAlive("docx"), 30000),
      "a docx preview server should be running after switching format",
    );
    // The html server must be reaped by the restart — never orphaned alongside.
    assert.ok(
      await waitFor(() => !formatServerAlive("html"), 20000),
      "the html preview server must be reaped when the format switches",
    );

    // Stabilize past the SIGTERM→SIGKILL escalation window: the dying html
    // child's `close` handler must NOT dispose the new docx session (S82 review
    // finding #2 — the session-identity guard). Without the guard, docx is
    // torn down here and this assertion fails.
    await sleep(4000);
    assert.ok(
      formatServerAlive("docx"),
      "the docx preview must survive the old html server's exit (no stale-child teardown)",
    );
    assert.ok(!formatServerAlive("html"), "no html server should remain");

    // Closing the pane reaps the (single) live server — no orphan.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    assert.ok(
      await waitFor(() => previewProcessCount() === 0, 20000),
      "closing the pane must reap the preview (no orphan after a restart)",
    );
  });

  it("falls back to html for a document that declares no format", async function () {
    this.timeout(90000);
    assert.strictEqual(
      pgrepCount("preview.*preview-format-noformat.qmd"),
      0,
      "no no-format preview server should be running before the test",
    );

    await openActive(NOFORMAT);
    const captured: string[] = [];
    await withQuickPick("html", captured, async () => {
      await vscode.commands.executeCommand("quarto.previewFormat");
    });

    // The picker was offered the implicit default, not an empty list — this is
    // the adapter's `declared.length ? declared : ["html"]` fallback, and it is
    // ALSO the gate-d discriminator that pins parseDeclaredFormats to the picker
    // (a hardcoded ["html","docx"] would show here instead — S82 review #4/#5).
    assert.deepStrictEqual(
      captured,
      ["html"],
      "a no-format document must offer only Quarto's implicit default (html)",
    );

    const alive = await waitFor(
      () => pgrepCount("preview.*preview-format-noformat.qmd") > 0,
      30000,
    );
    assert.ok(alive, "the fallback html format should actually preview");

    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    assert.ok(
      await waitFor(
        () => pgrepCount("preview.*preview-format-noformat.qmd") === 0,
        20000,
      ),
      "the fallback preview server must be reaped (no orphan)",
    );
  });

  it("does nothing when the format QuickPick is dismissed", async function () {
    this.timeout(30000);
    await openActive(FIXTURE);
    const captured: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const windowAny = vscode.window as any;
    const original = windowAny.showQuickPick;
    windowAny.showQuickPick = (items: readonly string[]) => {
      captured.splice(0, captured.length, ...items);
      return Promise.resolve(undefined); // user pressed Escape
    };
    try {
      await vscode.commands.executeCommand("quarto.previewFormat");
    } finally {
      windowAny.showQuickPick = original;
    }

    assert.deepStrictEqual(captured, ["html", "docx"]);
    // No selection → no preview server.
    const spawned = await waitFor(() => previewProcessCount() > 0, 3000);
    assert.strictEqual(
      spawned,
      false,
      "dismissing the QuickPick must not spawn a preview server",
    );
  });
});
