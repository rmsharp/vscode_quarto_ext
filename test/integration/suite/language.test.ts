import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/sample.qmd");

describe("Quarto language registration", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  it("contributes the quarto language for .qmd / .rmd", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    const languages = ext?.packageJSON?.contributes?.languages ?? [];
    const quarto = languages.find((l: { id: string }) => l.id === "quarto");
    assert.ok(quarto, "a 'quarto' language contribution should exist");
    assert.ok(
      quarto.extensions.includes(".qmd"),
      ".qmd should map to the quarto language",
    );
    assert.ok(
      quarto.extensions.includes(".rmd"),
      ".rmd should map to the quarto language",
    );
  });

  it("opens a .qmd fixture as languageId 'quarto'", async () => {
    const doc = await vscode.workspace.openTextDocument(FIXTURE);
    assert.strictEqual(
      doc.languageId,
      "quarto",
      "a .qmd document should resolve to the quarto language",
    );
  });
});

describe("Standalone diagram/typst language registration (BACKLOG item 13(b))", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  const CASES: Array<{ id: string; fixture: string }> = [
    { id: "dot", fixture: "sample.dot" },
    { id: "mermaid", fixture: "sample.mmd" },
    { id: "typst", fixture: "sample.typ" },
  ];

  for (const { id, fixture } of CASES) {
    it(`opens a ${fixture} fixture as languageId '${id}'`, async () => {
      const doc = await vscode.workspace.openTextDocument(
        path.resolve(ROOT, "test/fixtures", fixture),
      );
      assert.strictEqual(
        doc.languageId,
        id,
        `a ${fixture} document should resolve to the ${id} language`,
      );
    });
  }
});
