import * as assert from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// A hand-authored .ipynb whose single cell is a Jupyter `raw` cell — the
// deliberately heading-free fixture used to verify, firsthand, that VS Code's
// built-in `jupyter-notebook` serializer maps `cell_type: "raw"` to a
// NotebookCellKind.Code cell with languageId "raw" (the mapping quarto.newNotebook
// relies on for its front-matter cell). No markdown heading, so it cannot leak
// workspace symbols (see convert-notebook.test.ts:13-21).
const RAW_CELL_IPYNB = JSON.stringify(
  {
    cells: [
      {
        cell_type: "raw",
        metadata: {},
        source: ['---\n', 'title: "Raw Fixture"\n', "format: html\n", "---"],
      },
    ],
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
    },
    nbformat: 4,
    nbformat_minor: 5,
  },
  null,
  2,
);

/** Stub `showInputBox` to resolve to `value`, restoring the original in `finally`. */
async function withStubbedInputBox<T>(
  value: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showInputBox;
  windowAny.showInputBox = () => Promise.resolve(value);
  try {
    return await fn();
  } finally {
    windowAny.showInputBox = original;
  }
}

/**
 * Intercept `vscode.window.showNotebookDocument` and capture the notebook it is
 * handed, rather than actually revealing it — scoped tightly around the command
 * call (mirrors convert-notebook.test.ts).
 */
async function withCapturedShowNotebookDocument<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; shown: vscode.NotebookDocument | undefined }> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showNotebookDocument;
  let shown: vscode.NotebookDocument | undefined;
  windowAny.showNotebookDocument = (doc: vscode.NotebookDocument) => {
    shown = doc;
    return Promise.resolve(undefined);
  };
  try {
    const result = await fn();
    return { result, shown };
  } finally {
    windowAny.showNotebookDocument = original;
  }
}

describe("Quarto: New Quarto Notebook (quarto.newNotebook)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("registers the quarto.newNotebook command after activation", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.newNotebook"),
      "quarto.newNotebook should be registered after activation",
    );
  });

  it("creates an in-memory jupyter-notebook: a raw front-matter cell + an empty python starter cell", async () => {
    const { shown } = await withStubbedInputBox("My Notebook", () =>
      withCapturedShowNotebookDocument(() =>
        Promise.resolve(vscode.commands.executeCommand("quarto.newNotebook")),
      ),
    );

    assert.ok(shown, "the new notebook should have been shown");
    assert.strictEqual(
      shown.notebookType,
      "jupyter-notebook",
      "the new notebook should be a jupyter-notebook",
    );

    const cells = shown.getCells();
    assert.strictEqual(cells.length, 2, "expected exactly two cells");

    // Cell 0: the raw YAML front matter (Code cell + languageId "raw" -> saves
    // as cell_type "raw", how Quarto reads a notebook's front matter).
    assert.strictEqual(cells[0].kind, vscode.NotebookCellKind.Code);
    assert.strictEqual(cells[0].document.languageId, "raw");
    assert.strictEqual(
      cells[0].document.getText(),
      '---\ntitle: "My Notebook"\nformat: html\n---',
    );

    // Cell 1: the empty python starter code cell.
    assert.strictEqual(cells[1].kind, vscode.NotebookCellKind.Code);
    assert.strictEqual(cells[1].document.languageId, "python");
    assert.strictEqual(cells[1].document.getText(), "");
  });

  it("falls back to \"Untitled\" when the title prompt is cancelled", async () => {
    const { shown } = await withStubbedInputBox(undefined, () =>
      withCapturedShowNotebookDocument(() =>
        Promise.resolve(vscode.commands.executeCommand("quarto.newNotebook")),
      ),
    );

    assert.ok(shown, "the new notebook should have been shown");
    assert.strictEqual(
      shown.getCells()[0].document.getText(),
      '---\ntitle: "Untitled"\nformat: html\n---',
    );
  });

  it("saves a Code + languageId 'raw' cell as a Jupyter cell_type 'raw' cell (the SAVE direction the front-matter cell relies on)", async () => {
    // The feature's correctness at save time rests on the serialize direction:
    // a NotebookCellData(Code, ..., "raw") must be written as cell_type "raw" so
    // Quarto reads it as front matter. Build the exact cell shape the adapter
    // produces, save a file-backed notebook, and read the emitted JSON.
    const dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-newnb-"));
    try {
      const ipynbPath = path.join(dir, "roundtrip.ipynb");
      writeFileSync(ipynbPath, RAW_CELL_IPYNB); // a minimal valid, file-backed seed
      const notebook = await vscode.workspace.openNotebookDocument(
        vscode.Uri.file(ipynbPath),
      );

      const cells = [
        new vscode.NotebookCellData(
          vscode.NotebookCellKind.Code,
          '---\ntitle: "Roundtrip"\nformat: html\n---',
          "raw",
        ),
        new vscode.NotebookCellData(vscode.NotebookCellKind.Code, "", "python"),
      ];
      const edit = new vscode.WorkspaceEdit();
      edit.set(notebook.uri, [
        vscode.NotebookEdit.replaceCells(
          new vscode.NotebookRange(0, notebook.cellCount),
          cells,
        ),
      ]);
      assert.ok(
        await vscode.workspace.applyEdit(edit),
        "replacing the notebook cells should succeed",
      );
      assert.ok(await notebook.save(), "saving the notebook should succeed");

      const saved = JSON.parse(readFileSync(ipynbPath, "utf8"));
      assert.strictEqual(
        saved.cells[0].cell_type,
        "raw",
        "the front-matter cell must save as a Jupyter raw cell",
      );
      assert.strictEqual(
        saved.cells[1].cell_type,
        "code",
        "the starter cell must save as a Jupyter code cell",
      );
      assert.ok(
        (saved.cells[0].source as string[]).join("").includes('title: "Roundtrip"'),
        "the raw cell must carry the YAML front matter as its source",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the built-in serializer maps a Jupyter raw cell to Code + languageId 'raw' (the mapping the front-matter cell relies on)", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-newnb-"));
    try {
      const ipynbPath = path.join(dir, "raw-fixture.ipynb");
      writeFileSync(ipynbPath, RAW_CELL_IPYNB);

      const notebook = await vscode.workspace.openNotebookDocument(
        vscode.Uri.file(ipynbPath),
      );
      const cell = notebook.getCells()[0];
      assert.strictEqual(
        cell.kind,
        vscode.NotebookCellKind.Code,
        "a raw cell deserializes to a Code cell",
      );
      assert.strictEqual(
        cell.document.languageId,
        "raw",
        "a raw cell deserializes to languageId 'raw'",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
