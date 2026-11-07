import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { TYPING_DEBOUNCE_MS } from "../../../src/core/typing-debounce";
import { type ContextCall, lastValueFor, withContextCapture } from "./context-capture";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const RUN_CELLS = path.resolve(ROOT, "test/fixtures/run-cells.qmd");

const KEY = "quarto.inCodeCell";

/**
 * Written in Session 343 and NOT RUN there (`npm run test:integration` takes over the screen and the session was not
 * given the go-ahead): it is type-checked by `npm run compile-tests` and nothing more. Run it before trusting it.
 *
 * `quarto.inCodeCell` is what the five chords that run a cell consult (ctrl+enter, shift+enter, ctrl+shift+enter,
 * ctrl+alt+c, ctrl+k ctrl+f). Since Session 342 an edit's evaluation of it waits for a pause (`TYPING_DEBOUNCE_MS`) or
 * at most `TYPING_MAX_WAIT_MS`, and the only test of the wiring that does so is the syntax-tree pin, which reads the
 * source and runs nothing. This row types into a real document in a real host and reads the value the extension
 * pushes (the same way `preview-script.test.ts` reads `quartoRenderScriptActive`: VS Code offers no way to read a
 * context key back, so the `setContext` call is the observation point).
 */

/** Wait `ms` real milliseconds. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll until `predicate` holds or `timeoutMs` passes; true if it held. */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await sleep(25);
  }
  return predicate();
}

describe("quarto.inCodeCell after typing", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    // Discard the in-memory edit so the fixture stays pristine on disk.
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("is true once the pause has passed after text is typed into a python cell and the cursor is in it, and false after a cursor move to prose that follows no edit", async function () {
    this.timeout(30000);
    const doc = await vscode.workspace.openTextDocument(RUN_CELLS);
    const editor = await vscode.window.showTextDocument(doc);
    const lines = doc.getText().split("\n");
    const proseLine = lines.findIndex((line) => line.startsWith("Intro prose"));
    const cellLine = lines.findIndex((line) => line === "a = 1");
    assert.ok(proseLine >= 0 && cellLine > proseLine, "precondition: the fixture has prose, then a python cell holding `a = 1`");

    // ⚠ The extension sends a context key only when its value CHANGES (Session 343, `core/context-key-setter`) and the capture sees only what is sent,
    // so the key is SETTLED at false BEFORE the capture starts (the cursor in prose, then a pause longer than the typing pause), and the moves below are
    // the transitions false -> true -> false that the capture can observe. Which value the key had when the document opened (the host may restore a cursor
    // inside a cell) no longer matters.
    const inProse = new vscode.Position(proseLine, 0);
    editor.selection = new vscode.Selection(inProse, inProse);
    await sleep(TYPING_DEBOUNCE_MS * 3);

    const captured: ContextCall[] = [];
    await withContextCapture(captured, async () => {

      // Type into the cell through the editor, then put the cursor in it: an edit not yet evaluated, so the selection
      // event that follows it is debounced with it.
      const typed = await editor.edit((builder) => builder.insert(new vscode.Position(cellLine, lines[cellLine].length), " + 1"));
      assert.ok(typed, "the edit must apply");
      const inCell = new vscode.Position(cellLine, 2);
      editor.selection = new vscode.Selection(inCell, inCell);

      // The pause has passed (polled, so a slow host cannot flake it; the maximum wait is not driven here, `s343-max-wait.test.ts` does that):
      // the evaluation has run on the document as it is now.
      assert.ok(
        await waitFor(() => lastValueFor(captured, KEY) === true, 5000),
        `${KEY} must be true once the pause has passed after typing in a python cell with the cursor in it (setContext calls seen: ${JSON.stringify(captured)})`,
      );

      // Now a cursor move that follows no edit since the last evaluation: it evaluates at once.
      editor.selection = new vscode.Selection(inProse, inProse);
      assert.ok(
        await waitFor(() => lastValueFor(captured, KEY) === false, 5000),
        `${KEY} must be false after the cursor moves out of the cell into prose (setContext calls seen: ${JSON.stringify(captured)})`,
      );
    });
  });
});
