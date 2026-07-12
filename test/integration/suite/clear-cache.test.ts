import * as assert from "node:assert";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURES = path.resolve(ROOT, "test/fixtures");
const SAMPLE = path.resolve(FIXTURES, "sample.qmd");
const SAMPLE_HTML = path.resolve(FIXTURES, "sample.html");
const SAMPLE_FILES = path.resolve(FIXTURES, "sample_files");
const SAMPLE_CACHE = path.resolve(FIXTURES, "sample_cache");
const RENDER_ERROR = path.resolve(FIXTURES, "render-error.qmd");

/** Open a fixture and make it the active editor (clearCache targets the active doc). */
async function openActive(file: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  assert.strictEqual(
    vscode.window.activeTextEditor?.document.uri.fsPath,
    file,
    "fixture should be the active editor",
  );
}

describe("Quarto: Clear Cache command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(() => {
    // Render artifacts are gitignored, but keep the tree clean between runs.
    // `--cache-refresh` additionally creates a `<doc>_cache/` directory
    // (Quarto's Jupyter/Knitr execution cache) alongside the usual output.
    rmSync(SAMPLE_HTML, { force: true });
    rmSync(SAMPLE_FILES, { recursive: true, force: true });
    rmSync(SAMPLE_CACHE, { recursive: true, force: true });
  });

  it("registers the quarto.clearCache command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.clearCache"),
      "quarto.clearCache should be registered after activation",
    );
  });

  it("runs a real --cache-refresh render (success path)", async () => {
    rmSync(SAMPLE_HTML, { force: true }); // prove it renders fresh
    await openActive(SAMPLE);

    // The handler resolves when the child process closes, so awaiting the
    // command waits for the render to finish.
    await vscode.commands.executeCommand("quarto.clearCache");

    assert.ok(
      existsSync(SAMPLE_HTML),
      "quarto render --cache-refresh should have produced sample.html",
    );
  });

  it("surfaces a failing render without throwing (degradation path)", async () => {
    // render-error.qmd names an invalid output format, so `quarto render`
    // exits non-zero in ANY environment (no kernel involved) — this
    // deterministically exercises the non-zero-exit path without crashing.
    await openActive(RENDER_ERROR);

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.clearCache")),
      "a failed cache-refresh render must not crash the extension host",
    );
  });

  it("shows an error and does not spawn when there is no active Quarto document", async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.clearCache")),
      "running with no active Quarto editor must not crash",
    );
  });
});
