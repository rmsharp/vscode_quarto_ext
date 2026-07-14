import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  decodeTokens,
  OUR_LEGEND,
} from "../../../src/core/embedded/semantic-tokens";
import { VDOC_DIR_SEGMENTS } from "../../../src/core/embedded/vdoc-path";
import { assertRoutedThroughVdoc, VDOC_SELECTOR } from "./vdoc-assert";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/**
 * Semantic-token forwarding for embedded cells (BACKLOG item 16, Slice 1).
 *
 * The stand-in below is registered on `VDOC_SELECTOR` — our vdoc files, NOT a custom
 * scheme (see `vdoc-assert.ts`: that key is what hid item 18). And no stand-in can prove
 * a REAL server serves tokens on our vdocs; that is `npm run test:lsp`'s job, where this
 * feature is checked against real Pylance.
 *
 * What a stand-in CAN prove, and what a real server cannot easily: that we translate
 * legends correctly. Its legend is deliberately in a DIFFERENT index order from ours, so
 * an implementation that passed indices or modifier bitsets straight through would return
 * the wrong token types here — loudly — instead of quietly mis-colouring in production.
 */
const STANDIN_LEGEND = new vscode.SemanticTokensLegend(
  ["function", "variable"], // `variable` is index 1 here; index 8 in ours
  ["declaration", "readonly"], // `readonly` is bit 1 here; bit 2 in ours
);

/** Every vdoc the stand-in was asked about — proof the forward routed through one. */
let calls: string[] = [];
/** When true the stand-in answers with nothing (the "no language extension" case). */
let standInReturnsNothing = false;
/** When true the stand-in THROWS — a server that is erroring, restarting, or shutting down. */
let standInThrows = false;
let disposables: vscode.Disposable[] = [];

function registerStandIn(): void {
  disposables.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      VDOC_SELECTOR,
      {
        provideDocumentSemanticTokens(document) {
          calls.push(document.uri.toString());
          if (standInThrows) {
            throw new Error("simulated language-server failure");
          }
          if (standInReturnsNothing) {
            return undefined;
          }
          // One token on the line the {python} cell body occupies: `x` at column 0,
          // length 1, type `variable`, modifier `readonly` — all in STANDIN_LEGEND's
          // indices, which do not match ours.
          const data = new Uint32Array([1, 0, 1, 1, 0b10]);
          return new vscode.SemanticTokens(data);
        },
      },
      STANDIN_LEGEND,
    ),
  );
}

async function openQmd(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({
    language: "quarto",
    content,
  });
  await vscode.window.showTextDocument(doc);
  return doc;
}

async function tokensFor(
  doc: vscode.TextDocument,
): Promise<vscode.SemanticTokens | undefined> {
  return vscode.commands.executeCommand<vscode.SemanticTokens>(
    "vscode.provideDocumentSemanticTokens",
    doc.uri,
  );
}

describe("embedded semantic tokens", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    calls = [];
    standInReturnsNothing = false;
    standInThrows = false;
    registerStandIn();
  });

  afterEach(async () => {
    disposables.forEach((d) => d.dispose());
    disposables = [];
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("forwards a {python} cell's tokens through the vdoc, remapped into OUR legend", async () => {
    const doc = await openQmd(["```{python}", "x = 1", "```", ""].join("\n"));

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "the quarto document must produce semantic tokens");
    assert.strictEqual(calls.length, 1, "exactly one vdoc must have been queried");
    assertRoutedThroughVdoc(calls[0], "semantic tokens");

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(decoded, [
      // Line 1 is the cell BODY line in the .qmd — the identity mapping means no
      // coordinate remap is needed, and this is what proves it.
      { line: 1, char: 0, length: 1, type: "variable", modifiers: ["readonly"] },
    ]);
  });

  it("maps tokens to the RIGHT .qmd lines when the cell is preceded by prose", async () => {
    // The identity mapping's actual job. The stand-in always reports its token on line 1
    // OF THE VDOC — and because non-cell lines are blanked to equal-length space runs
    // rather than removed, vdoc line 1 IS .qmd line 1. Here line 1 is front matter, so
    // the cell body sits lower and the stand-in must be asked about a document whose
    // shape matches the .qmd exactly. This is the test that would fail if anyone
    // "optimized" buildVirtualContent to emit only the cell's lines.
    const doc = await openQmd(
      ["---", "title: t", "---", "", "```{python}", "y = 2", "```", ""].join("\n"),
    );

    await tokensFor(doc);

    assert.strictEqual(calls.length, 1);
    const vdoc = await vscode.workspace.openTextDocument(vscode.Uri.parse(calls[0]));
    const vdocLines = vdoc.getText().split("\n");
    assert.strictEqual(
      vdocLines.length,
      8,
      "the vdoc must have the same line count as the .qmd (identity mapping)",
    );
    assert.strictEqual(vdocLines[5], "y = 2", "the cell body must sit on ITS OWN .qmd line");
    assert.strictEqual(vdocLines[1], "        ", "front matter must be blanked, not removed");
  });

  it("returns nothing — and writes NO vdoc — for a .qmd with no {python} cells", async () => {
    // Prose and a non-forwarding cell. There is nothing to ask a Python server about, so
    // we must not write a file, must not open a model, and must not wake a language
    // server on every keystroke of a document that has no Python in it at all.
    const doc = await openQmd(
      ["# Heading", "", "Some prose.", "", "```{bash}", "echo hi", "```", ""].join("\n"),
    );

    const tokens = await tokensFor(doc);

    assert.strictEqual(tokens, undefined, "no python cells means no tokens");
    assert.deepStrictEqual(calls, [], "no vdoc may be created or queried");
  });

  it("writes its vdoc into <workspaceRoot>/.quarto/vdoc-mit/ for an ON-DISK .qmd", async () => {
    // Every other test here opens an UNTITLED document, which has no workspace folder and
    // therefore routes through the `mkdtemp` OS-temp fallback. That left the branch that
    // actually matters — the one that creates a directory and writes a copy of the user's
    // source INSIDE THEIR REPOSITORY — covered by nothing. The plan warned about exactly
    // this ("the whole suite must move to real on-disk fixtures"), and the adversarial
    // review found it had not been heeded.
    //
    // The fixture is created and destroyed inside this test: the workspace folder is a
    // real Quarto project (`project: type: default`), so a stray `.qmd` holding a python
    // cell would be picked up by `quarto render` in the render-project suite and fail it
    // for want of a Jupyter kernel.
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "the integration host must have a workspace folder open");
    const fixture = vscode.Uri.joinPath(folder.uri, "semantic-tokens-fixture.qmd");
    await vscode.workspace.fs.writeFile(
      fixture,
      new TextEncoder().encode(["```{python}", "x = 1", "```", ""].join("\n")),
    );

    try {
      const doc = await vscode.workspace.openTextDocument(fixture);
      await vscode.window.showTextDocument(doc);

      const tokens = await tokensFor(doc);

      assert.ok(tokens !== undefined, "an on-disk .qmd must produce tokens too");
      assert.strictEqual(calls.length, 1);

      // The point of the test: the vdoc lives under the workspace root, not in OS temp.
      const vdocPath = vscode.Uri.parse(calls[0]).fsPath;
      const expectedDir = vscode.Uri.joinPath(folder.uri, ...VDOC_DIR_SEGMENTS).fsPath;
      assert.strictEqual(
        path.dirname(vdocPath),
        expectedDir,
        `the vdoc for an on-disk .qmd must be written under the workspace root, not the ` +
          `untitled/no-folder OS-temp fallback; got ${vdocPath}`,
      );
      // And the `.gitignore` that keeps it out of the user's `git status` must be there.
      const gitignore = vscode.Uri.joinPath(
        folder.uri,
        ...VDOC_DIR_SEGMENTS,
        ".gitignore",
      );
      const body = await vscode.workspace.fs.readFile(gitignore);
      assert.strictEqual(new TextDecoder().decode(body).trim(), "*");
    } finally {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await vscode.workspace.fs.delete(fixture, { useTrash: false });
    }
  });

  it("degrades to no tokens — never throws — when the language server ERRORS", async () => {
    // Adversarial review, HIGH. The two forwards are `executeCommand`s, and those REJECT
    // (they do not merely resolve to `undefined`) when the server errors, is restarting, or
    // is shutting down. An unhandled rejection propagates out of the provider and breaks
    // this feature's one non-negotiable contract: the worst a failing server may ever do to
    // a `.qmd` is leave it with its TextMate colouring.
    standInThrows = true;
    const doc = await openQmd(["```{python}", "x = 1", "```", ""].join("\n"));

    // Must RESOLVE, not reject. If the provider throws, this line is where it surfaces.
    const tokens = await tokensFor(doc);

    assert.strictEqual(tokens, undefined, "a failing server must yield no tokens");
    assert.strictEqual(calls.length, 1, "…and the forward must genuinely have been made");
  });

  it("returns nothing, and does not throw, when no server serves the embedded language", async () => {
    // The graceful-degradation contract (plan §9.3): a user with no Python extension gets
    // TextMate colouring, exactly as today. `undefined` from the forward must surface as
    // `undefined` from us — never an exception, which would break colouring for the whole
    // document, and never a partial/garbage token set.
    standInReturnsNothing = true;
    const doc = await openQmd(["```{python}", "x = 1", "```", ""].join("\n"));

    const tokens = await tokensFor(doc);

    assert.strictEqual(tokens, undefined, "no server answer must yield no tokens");
    assert.strictEqual(calls.length, 1, "…but the forward must still have been attempted");
  });
});
