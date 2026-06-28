import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** Open an in-memory document with the given language and content. */
async function open(content: string, language: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({ content, language });
  return vscode.window.showTextDocument(doc);
}

/** Every open tab whose input is the math-preview webview. */
function mathPreviewTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap((g) => g.tabs)
    .filter(
      (t) =>
        t.input instanceof vscode.TabInputWebview &&
        /Math Preview/.test(t.label),
    );
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return predicate();
}

describe("Quarto: Preview Math command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the quarto.previewMath command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.previewMath"),
      "quarto.previewMath should be registered after activation",
    );
  });

  it("contributes the Preview Math command under the Quarto category", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const commands: { command: string; category?: string }[] =
      ext.packageJSON.contributes?.commands ?? [];
    const cmd = commands.find((c) => c.command === "quarto.previewMath");
    assert.ok(cmd, "quarto.previewMath should be contributed");
    assert.strictEqual(cmd.category, "Quarto");
  });

  it("opens a math-preview webview for a Quarto document", async () => {
    await open("Euler: $e^{i\\pi}+1=0$ is famous.", "quarto");

    await vscode.commands.executeCommand("quarto.previewMath");

    assert.ok(
      await waitFor(() => mathPreviewTabs().length === 1, 5000),
      "a Math Preview webview should open for a quarto document",
    );
  });

  it("reuses a single panel when invoked repeatedly", async () => {
    await open("$a$ and $$b$$", "quarto");

    await vscode.commands.executeCommand("quarto.previewMath");
    await vscode.commands.executeCommand("quarto.previewMath");
    await vscode.commands.executeCommand("quarto.previewMath");

    assert.ok(await waitFor(() => mathPreviewTabs().length === 1, 5000));
    // Give any stray second panel a chance to appear, then re-assert.
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(
      mathPreviewTabs().length,
      1,
      "re-invoking must reuse the one math-preview panel, not stack new ones",
    );
  });

  it("does nothing (and does not crash) in a non-Quarto editor", async () => {
    await open("$x$ in markdown", "markdown");

    await assert.doesNotReject(
      () =>
        Promise.resolve(
          vscode.commands.executeCommand("quarto.previewMath"),
        ),
      "previewing math in a non-quarto editor must not crash",
    );
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(
      mathPreviewTabs().length,
      0,
      "no math-preview panel should open for a non-quarto document",
    );
  });
});
