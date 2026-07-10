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
});
