import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const PROJECT_ROOT = path.resolve(ROOT, "test/fixtures/project");
const INDEX_QMD = path.resolve(PROJECT_ROOT, "index.qmd");
const CHAPTER_QMD = path.resolve(PROJECT_ROOT, "chapters/chapter1.qmd");

/**
 * Ask the editor for workspace symbols the same way "Go to Symbol in
 * Workspace" (Ctrl+T / Cmd+T) does. This exercises the real registered
 * WorkspaceSymbolProvider end-to-end against the workspace folder the
 * Extension Development Host was launched with (`test/fixtures/project`,
 * `runTest.ts` `launchArgs`) — real `vscode.workspace.findFiles`, no stub.
 */
async function workspaceSymbolsFor(
  query: string,
): Promise<vscode.SymbolInformation[]> {
  const result = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    "vscode.executeWorkspaceSymbolProvider",
    query,
  );
  return result ?? [];
}

describe("Quarto: Workspace symbol provider (Go to Symbol in Workspace)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  it("finds a heading in index.qmd by a substring query", async () => {
    const symbols = await workspaceSymbolsFor("Index");
    assert.strictEqual(symbols.length, 1, "exactly one match for 'Index'");
    const [symbol] = symbols;
    assert.strictEqual(symbol.name, "Index");
    assert.strictEqual(symbol.kind, vscode.SymbolKind.String);
    assert.strictEqual(symbol.location.uri.fsPath, INDEX_QMD);
    assert.strictEqual(symbol.location.range.start.line, 4);
  });

  it("finds a heading in a NESTED subdirectory file (chapters/chapter1.qmd)", async () => {
    const symbols = await workspaceSymbolsFor("Chapter");
    assert.strictEqual(symbols.length, 1, "exactly one match for 'Chapter'");
    assert.strictEqual(symbols[0].name, "Chapter 1");
    assert.strictEqual(symbols[0].location.uri.fsPath, CHAPTER_QMD);
  });

  it("an empty query aggregates matches across every workspace .qmd file", async () => {
    const symbols = await workspaceSymbolsFor("");
    assert.deepStrictEqual(
      symbols.map((s) => s.name).sort(),
      ["Chapter 1", "Index"],
      "both project files' top-level headings are present",
    );
  });

  it("a query matching nothing returns an empty array, not everything", async () => {
    const symbols = await workspaceSymbolsFor("zzz-nonexistent-symbol");
    assert.deepStrictEqual(symbols, []);
  });

  it("quarto.symbols.renderMode: Go to Symbol in Workspace lists what the Outline lists for a knitr file (Session 310)", async () => {
    // The adapter-level proof that this provider reads the SAME setting as the Outline (`providers/workspace-symbols.ts` reads it per file at the file's own scope). The document is the
    // tracked `ne_front_default` cost row of `test/fixtures/knitr-print-critic/quarto-1.7.33.json` (quarto 1.7.33, both ways): executing lists the last heading only (each printing chunk is
    // an output block, two bare fences), `--no-execute` lists all three. The file is written under the workspace root for this test and removed in `finally`, because the neighbouring
    // tests pin the exact set of project files; the distinctive names keep the query from matching anything else.
    const file = vscode.Uri.file(path.resolve(PROJECT_ROOT, "zz-render-mode-scratch.qmd"));
    const text = [
      "---", 'title: "ne"', "execute:", "  echo: false", "---", "",
      "Intro.", "", "```", "",
      "```{r}", 'print("p0")', "```", "", "# ZzModeH0", "",
      "```{r}", 'print("p1")', "```", "", "# ZzModeH1", "",
      "```{r}", 'print("p2")', "```", "", "# ZzModeH2", "",
    ].join("\n");
    const config = vscode.workspace.getConfiguration("quarto");
    const names = async (): Promise<string[]> => (await workspaceSymbolsFor("ZzMode")).map((s) => s.name).sort();
    // A scratch file a killed host left behind would break the neighbouring tests' exact-set pins, so the next run clears it first (the critic's T21), and the file is removed BEFORE the
    // setting is reset, each in its own `finally`, so a rejected configuration update cannot strand it (the reviewer's H7).
    await vscode.workspace.fs.delete(file, { useTrash: false }).then(undefined, () => undefined);
    await vscode.workspace.fs.writeFile(file, Buffer.from(text, "utf8"));
    try {
      try {
        assert.deepStrictEqual(await names(), ["ZzModeH2"], "the default reads the document as a render that executes");
        await config.update("symbols.renderMode", "no-execute", vscode.ConfigurationTarget.Global);
        assert.deepStrictEqual(await names(), ["ZzModeH0", "ZzModeH1", "ZzModeH2"], "no-execute: all three");
        await config.update("symbols.renderMode", "execute", vscode.ConfigurationTarget.Global);
        assert.deepStrictEqual(await names(), ["ZzModeH2"], "back to execute");
      } finally {
        await vscode.workspace.fs.delete(file, { useTrash: false });
      }
    } finally {
      await config.update("symbols.renderMode", undefined, vscode.ConfigurationTarget.Global);
    }
  });
});
