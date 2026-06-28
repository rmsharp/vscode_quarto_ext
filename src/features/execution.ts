/**
 * `Quarto: Run Cell` family (plan §6 Phase 5).
 *
 * Thin `vscode` adapter that finds the code cell at the cursor (pure
 * `core/cells`), then DELEGATES execution to the user's language extension —
 * Jupyter for Python, the R/Julia extensions — by selecting the cell's code and
 * invoking that extension's command (resolved by `core/execution-delegate`).
 * When no delegate is installed it degrades gracefully (a clear message, never a
 * crash — plan §9). Unlike render/preview it does NOT shell out to the Quarto
 * CLI and owns no long-lived process, so the Phase-4 lifecycle concerns do not
 * recur. It also does NOT save the document: delegation runs the IN-EDITOR cell
 * text (the user's unsaved buffer), which is what "run this cell" should mean.
 *
 * All non-`vscode` logic (cell detection, delegate selection, cell snippet)
 * lives in `core/` so it stays unit-testable headlessly (§3.3 guardrail). This
 * module is verified by `@vscode/test-electron`
 * (test/integration/suite/execution.test.ts), which registers a stand-in
 * delegate to faithfully observe dispatch without the real extension.
 */

import * as vscode from "vscode";
import { type Cell, findAllCells, findCellAtPosition } from "../core/cells";
import {
  buildCellSnippet,
  delegateCommandsFor,
  pickDelegate,
} from "../core/execution-delegate";

/** Context key gating the cell keybindings, true only when the cursor is in a cell. */
const IN_CELL_CONTEXT = "quarto.inCodeCell";

export function registerExecutionFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("quarto.runCell", () =>
      runCellAtCursor(false),
    ),
    vscode.commands.registerCommand("quarto.runCellAndAdvance", () =>
      runCellAtCursor(true),
    ),
    vscode.commands.registerCommand("quarto.runCellsAbove", runCellsAbove),
    vscode.commands.registerCommand("quarto.runAllCells", runAllCells),
    vscode.commands.registerCommand("quarto.insertCell", insertCell),
    // Keep the `quarto.inCodeCell` context key in sync so ctrl/shift+enter only
    // bind inside a cell (and fall through to normal newline editing elsewhere).
    vscode.window.onDidChangeTextEditorSelection((e) =>
      updateCellContext(e.textEditor),
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) =>
      updateCellContext(editor),
    ),
  );
  updateCellContext(vscode.window.activeTextEditor);
}

/** The active editor iff it is a Quarto document, else a message + null. */
function activeQuartoEditor(): vscode.TextEditor | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto (.qmd) document to run cells.",
    );
    return null;
  }
  return editor;
}

async function runCellAtCursor(advance: boolean): Promise<void> {
  const editor = activeQuartoEditor();
  if (!editor) {
    return;
  }
  const text = editor.document.getText();
  const cell = findCellAtPosition(text, editor.selection.active.line);
  if (!cell) {
    void vscode.window.showInformationMessage(
      "Quarto: place the cursor inside a code cell to run it.",
    );
    return;
  }
  const ranAny = await runCells(editor, [cell]);
  if (ranAny && advance) {
    advanceToNextCell(editor, text, cell);
  }
}

async function runCellsAbove(): Promise<void> {
  const editor = activeQuartoEditor();
  if (!editor) {
    return;
  }
  const line = editor.selection.active.line;
  const above = findAllCells(editor.document.getText()).filter(
    (c) => c.endLine < line,
  );
  if (above.length === 0) {
    void vscode.window.showInformationMessage(
      "Quarto: there are no code cells above the cursor.",
    );
    return;
  }
  await runCells(editor, above);
}

async function runAllCells(): Promise<void> {
  const editor = activeQuartoEditor();
  if (!editor) {
    return;
  }
  const cells = findAllCells(editor.document.getText());
  if (cells.length === 0) {
    void vscode.window.showInformationMessage(
      "Quarto: this document has no code cells.",
    );
    return;
  }
  await runCells(editor, cells);
}

/**
 * Select and delegate each cell in order. Stops at the first cell whose language
 * has no installed delegate (showing a graceful message). Returns whether at
 * least one cell was actually dispatched.
 */
async function runCells(
  editor: vscode.TextEditor,
  cells: readonly Cell[],
): Promise<boolean> {
  const available = await vscode.commands.getCommands(true);
  let ranAny = false;
  for (const cell of cells) {
    const delegate = pickDelegate(cell.lang, available);
    if (!delegate) {
      showNoDelegate(cell.lang);
      return ranAny;
    }
    const range = cellCodeRange(cell);
    if (!range) {
      continue; // empty cell — nothing to run
    }
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range);
    await vscode.commands.executeCommand(delegate);
    ranAny = true;
  }
  return ranAny;
}

/** The editor range covering a cell's code body, or null when the cell is empty. */
function cellCodeRange(cell: Cell): vscode.Range | null {
  if (cell.code.length === 0) {
    return null;
  }
  const codeLines = cell.code.split("\n");
  const firstLine = cell.startLine + 1;
  const lastLine = firstLine + codeLines.length - 1;
  const lastCol = codeLines[codeLines.length - 1].length;
  return new vscode.Range(firstLine, 0, lastLine, lastCol);
}

/** Move the cursor into the body of the next cell after `cell`, if any. */
function advanceToNextCell(
  editor: vscode.TextEditor,
  text: string,
  cell: Cell,
): void {
  const next = findAllCells(text).find((c) => c.startLine > cell.startLine);
  if (!next) {
    return;
  }
  const pos = new vscode.Position(next.startLine + 1, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos));
}

async function insertCell(): Promise<void> {
  const editor = activeQuartoEditor();
  if (!editor) {
    return;
  }
  const text = editor.document.getText();
  const cell = findCellAtPosition(text, editor.selection.active.line);
  const lang = cell ? cell.lang : "python";
  // Insert below the current cell's closing fence, or below the cursor line.
  const insertLine = cell ? cell.endLine + 1 : editor.selection.active.line + 1;
  const snippet = `\n${buildCellSnippet(lang)}`;
  const ok = await editor.edit((b) => {
    b.insert(new vscode.Position(insertLine, 0), snippet);
  });
  if (ok) {
    // Cursor onto the blank body line (after the leading "\n" and the fence line).
    const pos = new vscode.Position(insertLine + 2, 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos));
  }
}

function showNoDelegate(lang: string): void {
  const hasKnown = delegateCommandsFor(lang).length > 0;
  const message = hasKnown
    ? `Quarto: no extension is installed to run ${lang} cells. ` +
      `Install the Python/Jupyter (or R/Julia) extension.`
    : `Quarto: running ${lang} cells is not supported (no known execution extension).`;
  void vscode.window.showWarningMessage(message);
}

function updateCellContext(editor: vscode.TextEditor | undefined): void {
  const inCell =
    editor !== undefined &&
    editor.document.languageId === "quarto" &&
    findCellAtPosition(
      editor.document.getText(),
      editor.selection.active.line,
    ) !== null;
  void vscode.commands.executeCommand("setContext", IN_CELL_CONTEXT, inCell);
}
