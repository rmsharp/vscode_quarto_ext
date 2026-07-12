import * as assert from "node:assert";
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/preview-format.qmd");

/**
 * Count live preview worker processes for our fixture. POSIX-only (darwin);
 * `|| true` turns pgrep's "no match" exit 1 into a clean empty result. Matches
 * `preview.*preview-format.qmd` (NOT "quarto preview") because the real worker
 * is a deno process whose command line reads `quarto.js preview … --to html …
 * preview-format.qmd` — the `"quarto preview"` substring never appears (the same
 * gate-d faithful-verification trap the plain-preview suite documents).
 */
function previewProcessCount(): number {
  const out = execSync('pgrep -f "preview.*preview-format.qmd" || true', {
    encoding: "utf8",
  });
  return out.split("\n").filter((line) => line.trim().length > 0).length;
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
    execSync('pkill -9 -f "preview.*preview-format.qmd" || true');
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
