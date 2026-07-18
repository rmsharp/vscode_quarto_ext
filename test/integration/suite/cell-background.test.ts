import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  cellBackgroundRangesFor,
  refreshCellBackgroundDecorationsForTesting,
  registerCellBackgroundFeature,
} from "../../../src/features/cell-background";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
// A fixture with two `{python}` cells: fences on 0-based lines 6-8 and 12-14.
const RUN_CELLS = path.resolve(ROOT, "test/fixtures/run-cells.qmd");

/** The two whole-line cell spans expected for run-cells.qmd (column 0, isWholeLine). */
const EXPECTED = [new vscode.Range(6, 0, 8, 0), new vscode.Range(12, 0, 14, 0)];

function rangesEqual(actual: vscode.Range[], expected: vscode.Range[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((range, i) => range.isEqual(expected[i]))
  );
}

/**
 * Item 17a — cell-execution code-cell background highlighting (Session 111).
 *
 * The `vscode` adapter, exercised against real documents and configuration. VS
 * Code exposes no way to read applied decorations back, so these tests verify the
 * two things that ARE observable — the document→ranges bridge (incl. the enabled
 * / languageId gating) and that the decorator's apply path hands the right ranges
 * to real editors. The rendered tint itself is confirmed by a runtime smoke test.
 *
 * The running extension loads the esbuild bundle (dist/extension.js) while these
 * tests import the tsc-compiled copy (out/src) — separate module instances. So the
 * apply-path test registers a decorator in THIS instance rather than observing the
 * one activate() wired; that activate() wiring is runtime-verified, not asserted
 * here (as with resetDeactivation, extension.ts).
 */
describe("Quarto: cell-execution background highlighting", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("maps each executable cell of an open .qmd to a whole-line range", async () => {
    const doc = await vscode.workspace.openTextDocument(RUN_CELLS);
    await vscode.window.showTextDocument(doc);

    assert.ok(
      rangesEqual(cellBackgroundRangesFor(doc), EXPECTED),
      "both python cells should map to their fence-inclusive whole-line spans",
    );
  });

  it("tints nothing in a non-Quarto document", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "plaintext",
      content: ["```{python}", "a = 1", "```"].join("\n"),
    });
    await vscode.window.showTextDocument(doc);

    assert.strictEqual(
      cellBackgroundRangesFor(doc).length,
      0,
      "cell highlighting is scoped to the quarto languageId",
    );
  });

  it("tints nothing when quarto.cells.background.enabled is off", async () => {
    const config = vscode.workspace.getConfiguration("quarto");
    await config.update(
      "cells.background.enabled",
      false,
      vscode.ConfigurationTarget.Global,
    );
    try {
      const doc = await vscode.workspace.openTextDocument(RUN_CELLS);
      await vscode.window.showTextDocument(doc);

      assert.strictEqual(
        cellBackgroundRangesFor(doc).length,
        0,
        "the enabled toggle gates the tint off entirely",
      );
    } finally {
      await config.update(
        "cells.background.enabled",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
    }
  });

  it("hands each visible .qmd editor its cell spans through the decorator apply path", async () => {
    const doc = await vscode.workspace.openTextDocument(RUN_CELLS);
    await vscode.window.showTextDocument(doc);

    // Register a decorator in THIS module instance (see the file header: the running
    // extension uses the bundle, so its singleton is unreachable from here). This
    // exercises the real apply path end-to-end against VS Code — create the
    // decoration type, iterate the visible editors, call setDecorations — and
    // returns the ranges handed to setDecorations per editor URI.
    const context = {
      subscriptions: [] as vscode.Disposable[],
    } as unknown as vscode.ExtensionContext;
    registerCellBackgroundFeature(context);
    try {
      const applied = refreshCellBackgroundDecorationsForTesting();
      const forDoc = applied.get(doc.uri.toString());

      assert.ok(forDoc, "the shown .qmd editor should have decorations applied");
      assert.ok(
        rangesEqual(forDoc, EXPECTED),
        "the decorator should apply exactly the two cell spans",
      );
    } finally {
      for (const disposable of context.subscriptions) {
        disposable.dispose();
      }
    }
  });
});
