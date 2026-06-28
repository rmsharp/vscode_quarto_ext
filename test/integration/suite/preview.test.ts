import * as assert from "node:assert";
import { execSync } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const SAMPLE = path.resolve(ROOT, "test/fixtures/sample.qmd");

/**
 * Count live preview worker processes for our fixture. POSIX-only (this project
 * is darwin); `|| true` turns pgrep's "no match" exit 1 into a clean empty
 * result. This is the faithful no-orphan probe the plan (§6 Phase 4) calls out
 * as otherwise F5-only.
 *
 * IMPORTANT: match `preview.*sample.qmd`, NOT `"quarto preview"`. Quarto's real
 * worker is a deno process whose command line reads `quarto.js preview …` — it
 * does NOT contain the substring "quarto preview", so a `"quarto preview"`
 * probe would count only the bash wrapper and report 0 while the deno worker
 * orphans (a gate-d faithful-verification trap). Both the wrapper and the deno
 * worker contain `preview … sample.qmd`.
 */
function previewProcessCount(): number {
  const out = execSync('pgrep -f "preview.*sample.qmd" || true', {
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

async function openActive(file: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
}

describe("Quarto: Preview command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(() => {
    // Safety net: never leak a preview worker out of a test, even on failure.
    // SIGKILL the deno worker by the same fixture-matching pattern the probe
    // uses (the wrapper-only "quarto preview" pattern would miss the worker).
    execSync('pkill -9 -f "preview.*sample.qmd" || true');
  });

  it("registers the quarto.preview command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.preview"),
      "quarto.preview should be registered after activation",
    );
  });

  it("spawns a preview server and reaps it when the pane closes (no orphan)", async function () {
    this.timeout(90000);
    assert.strictEqual(
      previewProcessCount(),
      0,
      "no preview server should be running before the test",
    );

    await openActive(SAMPLE);
    // The handler resolves once the preview URL is parsed and the webview is
    // shown, so awaiting the command waits for startup (the server stays up).
    await vscode.commands.executeCommand("quarto.preview");

    const alive = await waitFor(() => previewProcessCount() > 0, 30000);
    assert.ok(alive, "a quarto preview server should be running after the command");

    // Closing the pane (and its document) must kill the server — no orphan.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    const reaped = await waitFor(() => previewProcessCount() === 0, 20000);
    assert.ok(
      reaped,
      "the preview server must be killed when the pane closes (no orphan)",
    );
  });

  it("does not orphan a server when invoked twice concurrently (TOCTOU)", async function () {
    this.timeout(90000);
    assert.strictEqual(
      previewProcessCount(),
      0,
      "no preview server should be running before the test",
    );

    await openActive(SAMPLE);
    // Fire twice within one event-loop tick. Both invocations pass the
    // synchronous one-preview guard before either reaches its first await
    // (save/resolveBinary) UNLESS the in-flight slot is reserved synchronously.
    // Without that reservation the second spawn's session overwrites the first
    // in the map, so the first server is tracked by nothing and survives the
    // pane close — a permanent orphan. This asserts the absence of that orphan.
    await Promise.all([
      vscode.commands.executeCommand("quarto.preview"),
      vscode.commands.executeCommand("quarto.preview"),
    ]);
    assert.ok(
      await waitFor(() => previewProcessCount() > 0, 30000),
      "a preview server should be running after the command",
    );

    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    const reaped = await waitFor(() => previewProcessCount() === 0, 20000);
    assert.ok(
      reaped,
      "a second concurrent invocation must not orphan a preview server",
    );
  });
});
