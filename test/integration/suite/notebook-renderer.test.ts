import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";
const RENDERER_ID = "quarto-mit.markdown-it-callout";

interface NotebookRendererContribution {
  id: string;
  displayName?: string;
  entrypoint?: { extends?: string; path?: string } | string;
}

function contributedRenderer(): NotebookRendererContribution | undefined {
  const ext = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(ext);
  const renderers: NotebookRendererContribution[] =
    ext.packageJSON.contributes?.notebookRenderer ?? [];
  return renderers.find((r) => r.id === RENDERER_ID);
}

/**
 * BACKLOG item 17d (first slice): the extension contributes a
 * `notebookRenderer` that extends VS Code's built-in `vscode.markdown-it-renderer`
 * so notebook markdown cells render Quarto callouts. The rendering logic runs in
 * the isolated notebook renderer webview and cannot be inspected from the
 * extension host, so this suite verifies what the host CAN see: the manifest
 * contribution is well-formed and accepted, and its entrypoint bundle actually
 * ships. The `md.render()` behaviour is exhaustively covered headlessly in
 * `test/unit/notebook-callout.test.ts`; the on-screen callout box is eyeball-only.
 */
describe("Quarto: notebook markdown-cell callout renderer (item 17d)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
    assert.ok(ext.isActive, "extension should activate without error");
  });

  it("contributes a notebookRenderer extending vscode.markdown-it-renderer", () => {
    const renderer = contributedRenderer();
    assert.ok(renderer, `notebookRenderer ${RENDERER_ID} should be contributed`);
    assert.ok(
      renderer.entrypoint && typeof renderer.entrypoint === "object",
      "the renderer must use the object entrypoint form so it extends a base renderer",
    );
    assert.strictEqual(
      renderer.entrypoint.extends,
      "vscode.markdown-it-renderer",
      "it must extend the built-in markdown-it renderer to apply to markdown cells",
    );
    assert.strictEqual(
      renderer.entrypoint.path,
      "./dist/notebook-renderer.js",
      "the entrypoint path must point at the bundled renderer",
    );
  });

  it("ships the renderer entrypoint bundle its manifest points to", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const renderer = contributedRenderer();
    assert.ok(
      renderer &&
        typeof renderer.entrypoint === "object" &&
        renderer.entrypoint.path,
    );
    const bundlePath = path.join(ext.extensionPath, renderer.entrypoint.path);
    assert.ok(
      fs.existsSync(bundlePath),
      `renderer entrypoint bundle should exist at ${bundlePath} (did esbuild build it?)`,
    );
    assert.ok(
      fs.statSync(bundlePath).size > 0,
      "renderer entrypoint bundle should be non-empty",
    );
  });

  it("exports an activate entry point VS Code can call in the renderer webview", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const bundle = fs.readFileSync(
      path.join(ext.extensionPath, "dist", "notebook-renderer.js"),
      "utf8",
    );
    assert.match(
      bundle,
      /export\s*\{[^}]*\bactivate\b/,
      "the bundled ES module must export activate",
    );
  });
});
