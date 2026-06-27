import * as assert from "node:assert";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "vscode-quarto-ext.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURES = path.resolve(ROOT, "test/fixtures");
const SAMPLE = path.resolve(FIXTURES, "sample.qmd");
const SAMPLE_HTML = path.resolve(FIXTURES, "sample.html");
const SAMPLE_FILES = path.resolve(FIXTURES, "sample_files");
const RENDER_ERROR = path.resolve(FIXTURES, "render-error.qmd");

/** Open a fixture and make it the active editor (render targets the active doc). */
async function openActive(file: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  assert.strictEqual(
    vscode.window.activeTextEditor?.document.uri.fsPath,
    file,
    "fixture should be the active editor",
  );
}

describe("Quarto: Render command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(() => {
    // Render artifacts are gitignored, but keep the tree clean between runs.
    rmSync(SAMPLE_HTML, { force: true });
    rmSync(SAMPLE_FILES, { recursive: true, force: true });
  });

  it("registers the quarto.render command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.render"),
      "quarto.render should be registered after activation",
    );
  });

  it("renders a prose/eval:false doc to HTML (success path)", async () => {
    rmSync(SAMPLE_HTML, { force: true }); // prove the render creates it fresh
    await openActive(SAMPLE);

    // The handler resolves when the child process closes, so awaiting the
    // command waits for the render to finish.
    await vscode.commands.executeCommand("quarto.render");

    assert.ok(
      existsSync(SAMPLE_HTML),
      "quarto render should have produced sample.html",
    );
  });

  it("surfaces a failing render without throwing (degradation path)", async () => {
    // render-error.qmd names an invalid output format, so `quarto render` exits
    // non-zero in ANY environment (no kernel involved). This deterministically
    // exercises the non-zero-exit path: the command must resolve (the error is
    // shown verbatim in the Output channel), not reject/crash the extension
    // host. (The real missing-Jupyter case is env-dependent — the test host has
    // Jupyter — so it is verified live via the CLI; see needs-jupyter.qmd.)
    await openActive(RENDER_ERROR);

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.render")),
      "a failed render must not crash the extension host",
    );
  });
});
