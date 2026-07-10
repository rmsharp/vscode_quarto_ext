import * as assert from "node:assert";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// Deliberately no markdown heading in either fixture: VS Code's built-in
// notebook features surface a loaded (even if never made visible, or shown
// then closed) notebook's markdown-cell headings as workspace symbols, and
// vscode.workspace.openNotebookDocument leaves the NotebookDocument
// resident in memory — workbench.action.closeAllEditors closes the tab but
// does not dispose it. A heading-free fixture is immune to that leak
// regardless of cause, keeping this suite isolated from
// workspace-symbols.test.ts.
const SAMPLE_QMD = `---
title: "Convert Fixture"
---

Plain prose, no heading.

\`\`\`{python}
#| eval: false
print("hi")
\`\`\`
`;

const SAMPLE_IPYNB = JSON.stringify(
  {
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: ["Plain prose, no heading.\n", "\n", "More prose."],
      },
    ],
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3",
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  },
  null,
  2,
);

/** Stub `showWarningMessage` to resolve to `value`, restoring the original in `finally`. */
async function withStubbedWarningMessage<T>(
  value: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showWarningMessage;
  windowAny.showWarningMessage = () => Promise.resolve(value);
  try {
    return await fn();
  } finally {
    windowAny.showWarningMessage = original;
  }
}

/**
 * Intercept `vscode.window.showNotebookDocument` rather than letting it
 * actually fire — scoped tightly around the command call itself (mirrors
 * `create-project.test.ts`'s `withInterceptedOpenFolder`), so it never
 * touches the test's own (unrelated) calls to open input fixtures.
 */
async function withInterceptedShowNotebookDocument<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; shownUri: vscode.Uri | undefined }> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showNotebookDocument;
  let shownUri: vscode.Uri | undefined;
  windowAny.showNotebookDocument = (doc: vscode.NotebookDocument) => {
    shownUri = doc.uri;
    return Promise.resolve(undefined);
  };
  try {
    const result = await fn();
    return { result, shownUri };
  } finally {
    windowAny.showNotebookDocument = original;
  }
}

/** Same as above, for `vscode.window.showTextDocument`. */
async function withInterceptedShowTextDocument<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; shownUri: vscode.Uri | undefined }> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showTextDocument;
  let shownUri: vscode.Uri | undefined;
  windowAny.showTextDocument = (doc: vscode.TextDocument) => {
    shownUri = doc.uri;
    return Promise.resolve(undefined);
  };
  try {
    const result = await fn();
    return { result, shownUri };
  } finally {
    windowAny.showTextDocument = original;
  }
}

describe("Quarto: Convert Notebook commands", () => {
  let dir: string;

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-convert-"));
  });

  afterEach(async () => {
    // Close every opened editor so a leftover fixture (e.g. this suite's own
    // "# Hello" .qmd input, opened for real to make it the active document)
    // never leaks into a later suite scanning open/workspace documents.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    rmSync(dir, { recursive: true, force: true });
  });

  it("registers the quarto.convertToIpynb and quarto.convertToQmd commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.convertToIpynb"),
      "quarto.convertToIpynb should be registered after activation",
    );
    assert.ok(
      commands.includes("quarto.convertToQmd"),
      "quarto.convertToQmd should be registered after activation",
    );
  });

  it("converts a real .qmd to .ipynb via the real CLI and opens it as a notebook", async () => {
    const inputPath = path.join(dir, "doc.qmd");
    const outputPath = path.join(dir, "doc.ipynb");
    writeFileSync(inputPath, SAMPLE_QMD);

    const doc = await vscode.workspace.openTextDocument(inputPath);
    await vscode.window.showTextDocument(doc);

    const { shownUri } = await withInterceptedShowNotebookDocument(() =>
      Promise.resolve(vscode.commands.executeCommand("quarto.convertToIpynb")),
    );

    assert.ok(
      existsSync(outputPath),
      "doc.ipynb should have been created by the real CLI",
    );
    assert.strictEqual(
      shownUri?.fsPath,
      outputPath,
      "the converted .ipynb should be opened via showNotebookDocument",
    );
  });

  it("converts a real .ipynb to .qmd via the real CLI and opens it as text", async () => {
    const inputPath = path.join(dir, "doc.ipynb");
    const outputPath = path.join(dir, "doc.qmd");
    writeFileSync(inputPath, SAMPLE_IPYNB);

    const notebook = await vscode.workspace.openNotebookDocument(
      vscode.Uri.file(inputPath),
    );
    await vscode.window.showNotebookDocument(notebook);

    const { shownUri } = await withInterceptedShowTextDocument(() =>
      Promise.resolve(vscode.commands.executeCommand("quarto.convertToQmd")),
    );

    assert.ok(
      existsSync(outputPath),
      "doc.qmd should have been created by the real CLI",
    );
    assert.strictEqual(
      shownUri?.fsPath,
      outputPath,
      "the converted .qmd should be opened via showTextDocument",
    );
  });

  it("modal-confirms and overwrites when the output already exists and the user picks Overwrite", async () => {
    const inputPath = path.join(dir, "doc.qmd");
    const outputPath = path.join(dir, "doc.ipynb");
    writeFileSync(inputPath, SAMPLE_QMD);
    writeFileSync(outputPath, "not a real notebook — should be replaced");

    const doc = await vscode.workspace.openTextDocument(inputPath);
    await vscode.window.showTextDocument(doc);

    await withStubbedWarningMessage("Overwrite", () =>
      withInterceptedShowNotebookDocument(() =>
        Promise.resolve(
          vscode.commands.executeCommand("quarto.convertToIpynb"),
        ),
      ),
    );

    const overwritten = readFileSync(outputPath, "utf8");
    assert.ok(
      overwritten.includes("nbformat"),
      "the pre-existing output should have been replaced by a real converted notebook",
    );
  });

  it("aborts without overwriting when the output already exists and the user cancels", async () => {
    const inputPath = path.join(dir, "doc.qmd");
    const outputPath = path.join(dir, "doc.ipynb");
    const sentinel = "not a real notebook — should survive cancellation";
    writeFileSync(inputPath, SAMPLE_QMD);
    writeFileSync(outputPath, sentinel);

    const doc = await vscode.workspace.openTextDocument(inputPath);
    await vscode.window.showTextDocument(doc);

    const { shownUri } = await withStubbedWarningMessage(undefined, () =>
      withInterceptedShowNotebookDocument(() =>
        Promise.resolve(
          vscode.commands.executeCommand("quarto.convertToIpynb"),
        ),
      ),
    );

    assert.strictEqual(
      readFileSync(outputPath, "utf8"),
      sentinel,
      "the pre-existing output must not be touched when the user cancels",
    );
    assert.strictEqual(
      shownUri,
      undefined,
      "the converted file must not be opened when the user cancels",
    );
  });
});
