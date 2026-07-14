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
    // The identity mapping's actual job, and the test that fails if anyone "optimizes"
    // the builder to emit only the cell's lines. Non-cell lines are BLANKED, never removed,
    // so vdoc line N is .qmd line N. Here the cell body sits below front matter, and the
    // server must be asked about a document whose line shape matches the .qmd exactly.
    const doc = await openQmd(
      ["---", "title: t", "---", "", "```{python}", "y = 2", "```", ""].join("\n"),
    );

    await tokensFor(doc);

    assert.strictEqual(calls.length, 1);
    const vdoc = await vscode.workspace.openTextDocument(vscode.Uri.parse(calls[0]));
    const vdocLines = vdoc.getText().split("\n");

    // THE invariant: the line COUNT is preserved, so every index still lines up...
    assert.strictEqual(
      vdocLines.length,
      8,
      "the vdoc must have the same line count as the .qmd (identity mapping)",
    );
    // ...and the body line therefore sits on its own .qmd line, verbatim.
    assert.strictEqual(vdocLines[5], "y = 2", "the cell body must sit on ITS OWN .qmd line");

    // The front-matter line is still THERE — blanked, not removed. It is now EMPTY rather
    // than an equal-length run of spaces: `ensureVdoc` canonicalizes whitespace-only lines
    // to "" before writing, so that the vdoc is a function of the CODE alone and a prose
    // keystroke does not mint a new file (plan 🐉8). Nothing addressable moves — no request
    // or result has ever landed on a blanked line, which is what blanking is for — and the
    // count assertion above is what actually pins "not removed".
    assert.strictEqual(vdocLines[1], "", "front matter must be blanked, not removed");
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

/**
 * Slice 2 — the multi-language merge.
 *
 * TWO stand-ins, one per vdoc extension, each with its OWN legend. That is not test
 * scaffolding for its own sake: it is exactly how reality is shaped (Pylance registers for
 * `python` with a 29-type legend; the built-in service registers for `javascript` with a
 * 12-type one), and it is the only arrangement that can catch the mistake that matters —
 * fetching ONE legend and decoding BOTH streams against it.
 *
 * The two legends are INVERTED relative to each other, so that mistake is loud rather than
 * subtle: `variable` is index 1 for python and index 0 for javascript, and `readonly` is
 * bit 1 for python and bit 0 for javascript. Cross-decode a stream and it comes back as a
 * `function`, or as a `declaration` — a wrong answer, not a missing one.
 *
 * Each stand-in emits one token per NON-BLANK line of the document it is handed, which is
 * what a real server effectively does: it only ever sees its own language's cells, because
 * every other line has been blanked to spaces.
 */
const PY_STANDIN_LEGEND = new vscode.SemanticTokensLegend(
  ["function", "variable"], // variable = 1
  ["declaration", "readonly"], // readonly = bit 1
);
const JS_STANDIN_LEGEND = new vscode.SemanticTokensLegend(
  ["variable", "function"], // variable = 0  <- inverted
  ["readonly", "declaration"], // readonly = bit 0  <- inverted
);

/** Emit one `variable`+`readonly` token per non-blank line, in `legend`'s own indices. */
function tokensForNonBlankLines(
  document: vscode.TextDocument,
  variableIndex: number,
  readonlyBit: number,
): vscode.SemanticTokens {
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  document
    .getText()
    .split("\n")
    .forEach((text, line) => {
      if (text.trim() === "") {
        return;
      }
      const char = text.length - text.trimStart().length;
      const deltaLine = line - prevLine;
      data.push(
        deltaLine,
        deltaLine === 0 ? char - prevChar : char,
        text.trim().length,
        variableIndex,
        1 << readonlyBit,
      );
      prevLine = line;
      prevChar = char;
    });
  return new vscode.SemanticTokens(new Uint32Array(data));
}

describe("embedded semantic tokens — multi-language merge (Slice 2)", () => {
  let pyCalls: string[] = [];
  let jsCalls: string[] = [];
  let jsLegendIsUndefined = false;
  let multiDisposables: vscode.Disposable[] = [];

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    pyCalls = [];
    jsCalls = [];
    jsLegendIsUndefined = false;
    multiDisposables.push(
      vscode.languages.registerDocumentSemanticTokensProvider(
        { scheme: "file", pattern: "**/vdoc-mit.*.py" },
        {
          provideDocumentSemanticTokens(document) {
            pyCalls.push(document.uri.toString());
            return tokensForNonBlankLines(document, 1, 1);
          },
        },
        PY_STANDIN_LEGEND,
      ),
      vscode.languages.registerDocumentSemanticTokensProvider(
        { scheme: "file", pattern: "**/vdoc-mit.*.js" },
        {
          provideDocumentSemanticTokens(document) {
            jsCalls.push(document.uri.toString());
            if (jsLegendIsUndefined) {
              return undefined;
            }
            return tokensForNonBlankLines(document, 0, 0);
          },
        },
        JS_STANDIN_LEGEND,
      ),
    );
  });

  afterEach(async () => {
    multiDisposables.forEach((d) => d.dispose());
    multiDisposables = [];
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  /**
   * The fixture that makes the SORT load-bearing. Python's cells straddle the {ojs} cell,
   * so python's stream carries tokens on lines 1 AND 7 while javascript's carries one on
   * line 4. The provider forwards in first-appearance order — python first — so the streams
   * concatenate to lines [1, 7, 4]: not ascending. Merging without sorting does not merely
   * mis-order them; the delta from line 7 back to line 4 is negative and wraps in a
   * Uint32Array to ~4.29 billion.
   */
  const STRADDLED = [
    "```{python}", // 0
    "p1 = 1", // 1  <- python token
    "```", // 2
    "```{ojs}", // 3
    "o = 2", // 4  <- javascript token
    "```", // 5
    "```{python}", // 6
    "p2 = 3", // 7  <- python token
    "```", // 8
    "", // 9
  ].join("\n");

  it("merges {python} and {ojs} into ONE ascending stream, each in its own legend", async () => {
    const doc = await openQmd(STRADDLED);

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "a mixed document must produce tokens");
    assert.strictEqual(pyCalls.length, 1, "python must be forwarded exactly once");
    assert.strictEqual(jsCalls.length, 1, "javascript must be forwarded exactly once");
    assertRoutedThroughVdoc(pyCalls[0], "semantic tokens (python)");
    assertRoutedThroughVdoc(jsCalls[0], "semantic tokens (javascript)");
    assert.notStrictEqual(
      pyCalls[0],
      jsCalls[0],
      "each language must get its OWN vdoc — one shared file would blank the other's cells",
    );

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });

    // Ascending, interleaved, and every token is a `variable`+`readonly` — which it can
    // only be if EACH stream was decoded against ITS OWN legend (they are inverted, so a
    // cross-decode yields `function`/`declaration` instead).
    assert.deepStrictEqual(
      decoded.map((t) => `${t.type}.${t.modifiers.join(".")}@${t.line}:${t.char}`),
      [
        "variable.readonly@1:0", // python
        "variable.readonly@4:0", // javascript — BETWEEN the two python tokens
        "variable.readonly@7:0", // python
      ],
    );
  });

  it("colours an {ojs}-only document — a language Slice 1 could not reach at all", async () => {
    const doc = await openQmd(["# Title", "", "```{ojs}", "o = 1", "```", ""].join("\n"));

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "an {ojs}-only document must produce tokens");
    assert.deepStrictEqual(pyCalls, [], "no python cells: no python vdoc may be written");
    assert.strictEqual(jsCalls.length, 1);

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(decoded, [
      { line: 3, char: 0, length: 5, type: "variable", modifiers: ["readonly"] },
    ]);
  });

  it("keeps the OTHER language's tokens when one server answers with nothing", async () => {
    // Measured, not hypothetical (Session 89 probe): the built-in JS service's LEGEND
    // command returns `undefined` on the first pass while its TOKEN command already
    // answers. So on a mixed document's first debounced pass, one language routinely has
    // no usable stream — and an all-or-nothing merge would leave the whole document
    // uncoloured, intermittently, for reasons the user could never reproduce.
    jsLegendIsUndefined = true;
    const doc = await openQmd(STRADDLED);

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "python's tokens must survive javascript's silence");
    assert.strictEqual(jsCalls.length, 1, "…and javascript must genuinely have been asked");

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(
      decoded.map((t) => `${t.type}@${t.line}:${t.char}`),
      ["variable@1:0", "variable@7:0"],
      "exactly python's two tokens — no gap, no throw, no empty document",
    );
  });

  it("REUSES every language's vdoc when an edit changes only PROSE (plan 🐉8)", async () => {
    // The plan's biggest performance unknown, and the one §7 assigns to this slice.
    //
    // VS Code re-requests tokens on a debounced timer as the user types (300 ms–2 s), for
    // every visible `.qmd`. `buildVirtualContent` is LENGTH-PRESERVING — non-cell lines are
    // blanked to EQUAL-LENGTH space runs, which is exactly what gives the identity mapping —
    // so typing a single character in PROSE changes the blanked run's length, and therefore
    // the vdoc's bytes, even though every line of code is byte-identical. `ensureVdoc`'s
    // reuse branch compares raw bytes, so it can never hit: a fresh file is minted, written,
    // opened and the old one deleted, on every pass. Slice 2 multiplies that by the number
    // of languages in the document.
    //
    // What must be true instead: an edit that changes no CODE reuses every vdoc, writes
    // nothing, and opens no new model.
    const doc = await openQmd(STRADDLED);
    await tokensFor(doc);

    assert.strictEqual(pyCalls.length, 1, "precondition: the first pass forwards python");
    assert.strictEqual(jsCalls.length, 1, "precondition: the first pass forwards javascript");
    const pyFirst = pyCalls[0];
    const jsFirst = jsCalls[0];

    // Append a character to a PROSE line. No code line changes; no line is added or removed.
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((b) => b.insert(new vscode.Position(9, 0), "prose"));

    await tokensFor(doc);

    assert.strictEqual(pyCalls.length, 2, "the second pass must genuinely have forwarded");
    assert.strictEqual(jsCalls.length, 2);
    assert.strictEqual(
      pyCalls[1],
      pyFirst,
      "python's vdoc must be REUSED after a prose-only edit — a new path here means a disk " +
        "write, a new model, and a full re-analysis by the language server, on every keystroke",
    );
    assert.strictEqual(
      jsCalls[1],
      jsFirst,
      "javascript's vdoc must be reused too — the cost is per LANGUAGE, so Slice 2 doubles it",
    );
  });

  it("still mints a fresh vdoc when the edit changes CODE", async () => {
    // The other half of the contract, and the reason this cannot simply cache forever.
    // Rewriting a path that already has an open model invalidates it only ASYNCHRONOUSLY
    // (≈1017 ms, measured in the S86 spike), so a changed cell MUST get a fresh path or the
    // server answers from the previous revision — silently, on every edit, forever (M3).
    const doc = await openQmd(STRADDLED);
    await tokensFor(doc);
    const pyFirst = pyCalls[0];

    // Edit the python cell body.
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((b) => b.insert(new vscode.Position(1, 6), " + 1"));

    await tokensFor(doc);

    assert.strictEqual(pyCalls.length, 2);
    assert.notStrictEqual(
      pyCalls[1],
      pyFirst,
      "a CODE edit must mint a fresh vdoc path — reusing it would serve the stale revision",
    );
  });

  it("forwards ONCE per language, not once per cell", async () => {
    // {ojs} and {js} are two engine tokens for ONE language. Forwarding per cell would ask
    // the JS server twice about the same vdoc and emit every token twice — a duplicate
    // stream, which VS Code must never be handed.
    const doc = await openQmd(
      [
        "```{ojs}", // 0
        "o = 1", // 1
        "```", // 2
        "```{js}", // 3
        "j = 2", // 4
        "```", // 5
        "```{python}", // 6
        "p = 3", // 7
        "```", // 8
        "", // 9
      ].join("\n"),
    );

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "the mixed document must produce tokens");
    assert.strictEqual(jsCalls.length, 1, "{ojs} and {js} are ONE javascript forward");
    assert.strictEqual(pyCalls.length, 1);

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(
      decoded.map((t) => `${t.line}:${t.char}`),
      ["1:0", "4:0", "7:0"],
      "both javascript cells appear ONCE each — the single js vdoc holds both",
    );
  });
});
