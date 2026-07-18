/**
 * `Quarto: New Quarto Notebook` (BACKLOG item 17e) — create a new Quarto
 * `.ipynb` notebook, the notebook sibling of the item-17c create-document
 * family. Discoverable in the command palette and File▸New File….
 *
 * Thin `vscode` adapter: prompt for an optional title, build the pure
 * `{ languageId, value }` cell descriptors via `core/new-notebook.ts`, map them
 * to `vscode.NotebookCellData` code cells, and open an in-memory (untitled,
 * unsaved) `jupyter-notebook` — no disk write. Mirrors VS Code's own
 * `ipynb.newUntitledIpynb`: `NotebookData.metadata` is seeded with
 * `{ cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }` so the notebook
 * carries a valid nbformat header when the user later saves it.
 *
 * The starter is deliberately heading-free (a raw front-matter cell + an empty
 * code cell, no markdown cell) so the resident notebook cannot leak
 * markdown-heading workspace symbols
 * (see `test/integration/suite/convert-notebook.test.ts:13-21`).
 */

import * as vscode from "vscode";
import { buildNewNotebookCells } from "../core/new-notebook";

/** nbformat 4.5 header, matching VS Code's own `ipynb.newUntitledIpynb`. */
const NEW_NOTEBOOK_METADATA = {
  cells: [],
  metadata: {},
  nbformat: 4,
  nbformat_minor: 5,
};

export function registerNewNotebookFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("quarto.newNotebook", () =>
      newQuartoNotebook(),
    ),
  );
}

/**
 * A cancelled (`undefined`) or empty/whitespace prompt is treated identically
 * — proceed with the builder's own "Untitled" fallback, never abort (there is
 * nothing destructive to cancel out of).
 */
async function newQuartoNotebook(): Promise<void> {
  const answer = await vscode.window.showInputBox({
    prompt: "Notebook title",
    placeHolder: "Untitled",
  });
  const data = new vscode.NotebookData(
    buildNewNotebookCells(answer ?? "").map(
      (cell) =>
        new vscode.NotebookCellData(
          vscode.NotebookCellKind.Code,
          cell.value,
          cell.languageId,
        ),
    ),
  );
  data.metadata = NEW_NOTEBOOK_METADATA;
  const notebook = await vscode.workspace.openNotebookDocument(
    "jupyter-notebook",
    data,
  );
  await vscode.window.showNotebookDocument(notebook);
}
