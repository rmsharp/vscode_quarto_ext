import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const RUN_CELLS = path.resolve(ROOT, "test/fixtures/run-cells.qmd");
const RUN_MIXED = path.resolve(ROOT, "test/fixtures/run-cells-mixed.qmd");

// The delegate command Jupyter would register. It is NOT present in the clean
// test host, so we can register a stand-in to faithfully observe dispatch
// (find cell -> select code -> invoke delegate) without the real extension.
const JUPYTER_CMD = "jupyter.execSelectionInteractive";

interface DelegateCall {
  selectionEmpty: boolean;
  startLine: number;
  /** The exact text selected when the delegate fired (faithfully pins cellCodeRange). */
  text: string;
}

let calls: DelegateCall[] = [];
const disposables: vscode.Disposable[] = [];

/** Register a stand-in delegate that records each invocation's editor selection. */
function registerStandInDelegate(): void {
  disposables.push(
    vscode.commands.registerCommand(JUPYTER_CMD, () => {
      const ed = vscode.window.activeTextEditor;
      calls.push({
        selectionEmpty: ed ? ed.selection.isEmpty : true,
        startLine: ed ? ed.selection.start.line : -1,
        text: ed ? ed.document.getText(ed.selection) : "",
      });
    }),
  );
}

async function openAt(file: string, line: number): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(doc);
  const pos = new vscode.Position(line, 0);
  editor.selection = new vscode.Selection(pos, pos);
  return editor;
}

describe("Quarto: Run Cell family", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    calls = [];
  });

  afterEach(async () => {
    for (const d of disposables.splice(0)) {
      d.dispose();
    }
    // Discard any in-memory edits (insertCell) so fixtures stay pristine on disk.
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the whole run-cell command family", async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      "quarto.runCell",
      "quarto.runCellAndAdvance",
      "quarto.runCellsAbove",
      "quarto.runAllCells",
      "quarto.insertCell",
    ]) {
      assert.ok(commands.includes(id), `${id} should be registered`);
    }
  });

  it("dispatches the cell at the cursor to the delegate, selecting its code", async () => {
    registerStandInDelegate();
    await openAt(RUN_CELLS, 7); // inside cell 1 (a = 1)

    await vscode.commands.executeCommand("quarto.runCell");

    assert.strictEqual(calls.length, 1, "the delegate should run exactly once");
    assert.strictEqual(
      calls[0].selectionEmpty,
      false,
      "the cell's code should be selected before delegating",
    );
    assert.strictEqual(
      calls[0].startLine,
      7,
      "the selection should start at the cell's first code line",
    );
  });

  it("does not throw and does not dispatch when the cursor is not in a cell", async () => {
    registerStandInDelegate();
    await openAt(RUN_CELLS, 4); // prose, not a cell

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.runCell")),
      "running with no cell at the cursor must not crash",
    );
    assert.strictEqual(calls.length, 0, "no delegate should be invoked in prose");
  });

  it("degrades gracefully (no crash) when no delegate is installed", async () => {
    // No stand-in registered: the clean host has no Jupyter, so pickDelegate
    // returns null and the command must show a message, not crash.
    await openAt(RUN_CELLS, 7); // inside a python cell

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.runCell")),
      "missing a delegate must degrade gracefully",
    );
    assert.strictEqual(calls.length, 0, "no delegate was registered to invoke");
  });

  it("runs every cell for Run All Cells", async () => {
    registerStandInDelegate();
    await openAt(RUN_CELLS, 0);

    await vscode.commands.executeCommand("quarto.runAllCells");

    assert.strictEqual(calls.length, 2, "both python cells should be dispatched");
  });

  it("runs only the cells above the cursor for Run Cells Above", async () => {
    registerStandInDelegate();
    await openAt(RUN_CELLS, 13); // inside cell 2; cell 1 is above

    await vscode.commands.executeCommand("quarto.runCellsAbove");

    assert.strictEqual(calls.length, 1, "only the one cell above should run");
    assert.strictEqual(calls[0].startLine, 7, "that cell is cell 1 (a = 1)");
  });

  it("runs the cell and moves the cursor into the next cell on Advance", async () => {
    registerStandInDelegate();
    const editor = await openAt(RUN_CELLS, 7); // cell 1

    await vscode.commands.executeCommand("quarto.runCellAndAdvance");

    assert.strictEqual(calls.length, 1, "the current cell should run");
    assert.strictEqual(
      editor.selection.active.line,
      13,
      "the cursor should advance into cell 2's body",
    );
  });

  it("inserts a new empty cell after the current one", async () => {
    const editor = await openAt(RUN_CELLS, 7); // cell 1

    await vscode.commands.executeCommand("quarto.insertCell");

    // The document gains a third python cell.
    const fences = editor.document
      .getText()
      .split("\n")
      .filter((l) => l.trim() === "```{python}").length;
    assert.strictEqual(fences, 3, "a third {python} cell should be inserted");
  });

  it("faithfully selects a multi-line cell body (no fences) before delegating", async () => {
    registerStandInDelegate();
    await openAt(RUN_MIXED, 6); // inside the 3-line python cell (cell 1)

    await vscode.commands.executeCommand("quarto.runCell");

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(
      calls[0].text,
      "x = 1\ny = 2\nz = x + y",
      "the whole cell body must be selected, no more, no less",
    );
  });

  it("Run All runs every runnable cell and skips (does not abort on) ones with no delegate", async () => {
    // Only the python stand-in is registered. The fixture is python / r / empty
    // python / python. Run All must run BOTH python code cells (skipping the r
    // cell and the empty one), not abort at the first cell it cannot run.
    registerStandInDelegate();
    await openAt(RUN_MIXED, 0);

    await vscode.commands.executeCommand("quarto.runAllCells");

    assert.strictEqual(calls.length, 2, "both python code cells should run");
    assert.deepStrictEqual(
      calls.map((c) => c.text),
      ["x = 1\ny = 2\nz = x + y", "w = 9"],
      "the r cell and the empty cell are skipped, the python cells run",
    );
  });

  it("Run Cell and Advance moves past an empty cell even though nothing ran", async () => {
    registerStandInDelegate();
    const editor = await openAt(RUN_MIXED, 14); // the empty python cell (cell 3)

    await vscode.commands.executeCommand("quarto.runCellAndAdvance");

    assert.strictEqual(calls.length, 0, "an empty cell has no code to run");
    assert.strictEqual(
      editor.selection.active.line,
      18,
      "the cursor should still advance into the next cell's body",
    );
  });

  it("does not crash or dispatch in a non-Quarto editor", async () => {
    registerStandInDelegate();
    const doc = await vscode.workspace.openTextDocument({
      content: "# just markdown\n\n```{python}\nx = 1\n```\n",
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.runCell")),
      "running in a non-quarto editor must not crash",
    );
    assert.strictEqual(calls.length, 0, "no dispatch outside a quarto document");
  });

  it("does not crash when there is no active editor", async () => {
    registerStandInDelegate();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    await assert.doesNotReject(
      () => Promise.resolve(vscode.commands.executeCommand("quarto.runCell")),
      "running with no active editor must not crash",
    );
    assert.strictEqual(calls.length, 0);
  });

  it("activates when a .qmd is opened (onLanguage:quarto) so keybindings work without a prior command", () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    const events: string[] = ext.packageJSON.activationEvents ?? [];
    assert.ok(
      events.includes("onLanguage:quarto"),
      "onLanguage:quarto is required so the cell context key syncs on open",
    );
  });
});
