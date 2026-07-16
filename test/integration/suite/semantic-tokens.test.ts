import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  decodeTokens,
  OUR_LEGEND,
} from "../../../src/core/embedded/semantic-tokens";
import { VDOC_DIR_SEGMENTS } from "../../../src/core/embedded/vdoc-path";
import { TYPE_IGNORE_DIRECTIVE } from "../../../src/core/embedded/virtual-doc";
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

    // The front-matter line is still THERE — blanked, not removed. It is EMPTY rather than an
    // equal-length run of spaces: `buildVirtualContent` blanks non-code lines to "", so the
    // vdoc is a function of the CODE alone and a prose keystroke does not mint a new file
    // (plan 🐉8). The count assertion above is what actually pins "not removed"; the blanking
    // happens in the BUILDER, which is the only thing that knows which lines are body lines
    // (a whitespace-only line inside a cell is code, and is kept verbatim).
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

/**
 * A SECOND python provider's legend, for the BACKLOG:125 DOCUMENT-axis provider-divergence pin
 * below (the RANGE-axis pins at the end of this file stage the same shape with their own pair) —
 * inverted against `PY_STANDIN_LEGEND` at exactly the two indices that stand-in emits, so a
 * stream decoded against the WRONG one of the two comes back with different NAMES rather than
 * with nothing. Index 1 is `function` here and `variable` there; bit 1 is `declaration` here and
 * `readonly` there. Both names are in `OUR_LEGEND`, so a cross-decode is not dropped — it paints,
 * wrongly, which is the whole point of the item.
 */
const RIVAL_PY_STANDIN_LEGEND = new vscode.SemanticTokensLegend(
  ["variable", "function"],
  ["readonly", "declaration"],
);

/**
 * Emit one `variable`+`readonly` token per non-blank CODE line, in `legend`'s own indices —
 * skipping the file-level `# type: ignore` mute that `buildVirtualContent` injects on a python
 * vdoc's line 0 (Session 93, the diagnosticMode:"workspace" phantom-diagnostic fix). A real
 * semantic-token server emits NO token for that comment — pinned firsthand against Pylance in
 * `test/lsp/suite/real-lsp.test.ts` ("the line-0 `# type: ignore` mute must emit NO semantic
 * token") — so a stand-in that emitted one there would model a server that does not exist, and,
 * because vdoc line N IS .qmd line N with no coordinate remap (`providers/semantic-tokens.ts`),
 * would spuriously colour the cell's fence at .qmd line 0. Omitting this skip is exactly what
 * turned the 4 "multi-language merge (Slice 2)" cases red once S93 landed — a stand-in artefact,
 * NOT a VS Code version drift (fails identically on 1.128.1 and 1.129.0; BACKLOG:119 / Session 96).
 */
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
      if (text.trim() === "" || text.trim() === TYPE_IGNORE_DIRECTIVE) {
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
  /** When true the PYTHON stand-in throws — a server erroring, restarting, or shutting down. */
  let pyThrows = false;
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
    pyThrows = false;
    multiDisposables.push(
      vscode.languages.registerDocumentSemanticTokensProvider(
        { scheme: "file", pattern: "**/vdoc-mit.*.py" },
        {
          provideDocumentSemanticTokens(document) {
            pyCalls.push(document.uri.toString());
            if (pyThrows) {
              // A real server that errors, restarts, or shuts down REJECTS the request —
              // and `executeCommand` surfaces that as a rejection, not an `undefined`.
              throw new Error("simulated language-server failure");
            }
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

  /** A python-only fixture: one code line, so exactly one token, at .qmd line 1. */
  const PY_ONLY = ["```{python}", "p1 = 1", "```", ""].join("\n");

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
    //
    // NOTE on faithfulness (adversarial review, Session 89): this flag makes javascript's
    // TOKENS command return nothing, which is the EASY half. The half that actually happens —
    // a real token stream paired with an UNDEFINED legend — cannot be staged through
    // `registerDocumentSemanticTokensProvider`, because the legend comes from the
    // registration itself and is always defined. That guard is therefore pinned where it can
    // be: in the pure core, which now treats a legendless stream as empty rather than
    // dereferencing it (`semantic-tokens.test.ts`, "a stream with no usable legend degrades").
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

  it("keeps the OTHER language's tokens when one server THROWS", async () => {
    // The throw-sibling of the "answers with nothing" case above, and the CROSS-LANGUAGE
    // counterpart of Slice 1's "degrades to no tokens … when the language server ERRORS":
    // that one proves a lone throwing server yields `undefined` (never an exception); this
    // one proves the throw is isolated PER LANGUAGE — a throwing python must not take a
    // healthy javascript's tokens down with it. `streamFor`'s try/catch turns each forward's
    // rejection into an `undefined` BEFORE the `Promise.all` in `provideDocumentSemanticTokens`
    // sees it, so the merge simply proceeds with whatever streams did arrive
    // (`src/providers/semantic-tokens.ts`). Until now the suite only ever made a stand-in
    // throw when it was the ONLY language, so "a failing server takes nothing with it" was
    // asserted, not pinned (BACKLOG:123, Session 89 adversarial review).
    pyThrows = true;
    const doc = await openQmd(STRADDLED);

    // Must RESOLVE, not reject: python's throw must not propagate out of the provider.
    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "javascript's tokens must survive python's failure");
    assert.strictEqual(pyCalls.length, 1, "…and python must genuinely have been asked (it threw)");
    assert.strictEqual(jsCalls.length, 1, "…and javascript must genuinely have been asked");

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(
      decoded.map((t) => `${t.type}.${t.modifiers.join(".")}@${t.line}:${t.char}`),
      ["variable.readonly@4:0"],
      "exactly javascript's ONE token, decoded against ITS legend — no python token, no throw, no empty document",
    );
  });

  it("PINS a VS Code platform defect: the legend and the stream can come from DIFFERENT providers", async () => {
    // ⚠ THIS TEST ASSERTS A WRONG ANSWER ON PURPOSE. It is a tripwire, not a specification:
    // the expectation below is what VS Code 1.129.0 actually does, and it is a DEFECT we cannot
    // fix from an extension (BACKLOG:125, filed by the Session 88 Slice-1 review; mechanism
    // re-grounded and premise proven firsthand here, Session 99).
    //
    // 🔑 THE MECHANISM, verbatim from the shipped 1.129.0 workbench bundle. Both commands read
    // the SAME registry and the SAME top group — `orderedGroups(model)[0]`, which holds every
    // provider that TIED on selector score — but they index into it by DIFFERENT rules:
    //
    //   legend: `let n=rdn(i,t); return n ? n[0].getLegend() : …`
    //           `function rdn(s,o){let e=s.orderedGroups(o);return e.length>0?e[0]:null}`
    //             -> group[0][0]'s legend, taken BLIND: that provider is never even called.
    //   tokens: `mki` -> `function ndn(s,o){…return e.length>0?e[0]:[]}`, then
    //           `for(let a of r){if(a.error)throw a.error;if(a.tokens)return a}`
    //             -> the FIRST member of group[0] that actually ANSWERS.
    //
    // So they agree if and only if group[0][0] answers. THE PRECONDITION IS A TOP PROVIDER THAT
    // DECLINES — that single fact is the whole bug, and the item as filed omitted it (it framed
    // this as each command resolving "independently", which is wrong: the resolution is shared,
    // deterministic and stable — `register` stamps `_time:this._clock++` and
    // `_compareByScoreAndTime` sorts score desc -> non-builtin -> `_time` DESC, so the
    // LAST-registered of a tie owns the legend, identically on every call).
    //
    // 🔑 WHY THERE IS NO FIX, AND NO GUARD (all read out of the same bundle, Session 99). The
    // answering provider's identity never crosses the RPC boundary: the command destructures it
    // as `let{provider:r,tokens:a}=n` and uses `r` ONLY for `r.releaseDocumentSemanticTokens(…)`,
    // putting `cki({id:0,type:"full",data:a.data})` on the wire. `SemanticTokens` is
    // `{resultId,data}` — no legend, no provider (`@types/vscode`). Registration carries no
    // extension id, providers cannot be counted (Learning #105), and `exclusive` is proposed-API
    // -gated. So we cannot pair atomically, and we cannot even DETECT that this happened.
    // The tempting alternative — the RANGE pair, whose legend command genuinely re-runs the
    // selection and returns `a.provider.getLegend()` when passed a range — is a REGRESSION in
    // this codebase's shape: it reads a SEPARATE registry, the fallback runs doc->range and never
    // range->doc, so it would silently drop every full-only server (the #99/#107/#108 trap: the
    // obvious fix makes things worse).
    //
    // 🔑 IF THIS TEST FAILS, DO NOT ASSUME A FIX. The pinned outcome rests on TWO independent
    // legs, and only the first is the defect — the second is merely how this fixture stages it:
    //   (1) does the legend command still take `orderedGroups(model)[0][0]` BLIND — or has the
    //       range path's re-run been ported into `_provideDocumentSemanticTokensLegend`?
    //   (2) does `_compareByScoreAndTime` still sort `_time` DESC — i.e. is the LAST-registered
    //       rival still `group[0][0]`?
    // Only (1) changing means THIS axis is fixed: then delete this pin and assert
    // `variable.readonly@1:0`. If (2) changed alone the defect is fully INTACT and only the
    // staging is stale — register the rival FIRST and it recurs identically. The two cases are
    // OBSERVATIONALLY IDENTICAL here: same failure output, and the premise assertions below hold
    // in both, because `mki` maps over EVERY member of group[0] (`Promise.all(n.map(…))`) — so
    // each provider is called exactly once either way, whatever the order. Re-derive both legs
    // against the then-current bundle; this comment's own diagnosis is no exception (#99/#107/#108).
    //
    // 🔑 AND EVEN THEN our fetch would NOT be sound: a SECOND divergence path survives in the
    // RANGE registry — and it is the one our {ojs}/{js} cells actually traverse. The built-in TS
    // extension registers ONLY `registerDocumentRangeSemanticTokensProvider` (1.129.0: zero
    // `registerDocumentSemanticTokensProvider` occurrences), so `javascript` has NO document
    // provider, `hki(i,t)` is false for a `.js` vdoc (`lang-map.ts` maps ojs/js -> javascript/.js),
    // and BOTH commands fall through:
    //   legend: `n?n[0].getLegend():executeCommand("_provideDocumentRangeSemanticTokensLegend",e)`
    //           — note NO range is passed, so that command warns ("might be out-of-sync with
    //           provideDocumentRangeSemanticTokens unless a range argument is passed in") and
    //           returns `r[0].getLegend()` BLIND once the top group holds >1. It is correct at
    //           exactly one: `if(r.length===1)return r[0].getLegend()`.
    //   tokens: `if(!hki(i,t))return executeCommand("_provideDocumentRangeSemanticTokens",e,
    //           t.getFullModelRange())` -> `ZNt` -> the first provider that ANSWERS.
    // Same tie-group precondition (that path also reads `orderedGroups(o)[0]`), so it is no more
    // reachable in provider-count terms — but BROADER in kind: `ZNt` swallows per-provider errors
    // (`catch(c){Fs(c),a=null}`), so a top range provider that THROWS diverges too, where the doc
    // path's `mki` does `if(a.error)throw a.error` and degrades to `undefined` via our try/catch.
    // That axis is now PINNED TOO, in its own describe at the end of this file ("RANGE-registry
    // provider divergence (BACKLOG:125 axis b)", Session 100) — including the THROW leg, which
    // this document axis does not have. It needed a separate describe because the Slice-2 js
    // stand-in above is a DOCUMENT provider, which makes `hki` true and hides the range path.
    //
    // Harm, stated honestly: this mis-COLOURS, it never mis-POSITIONS (coordinates are
    // legend-independent) and it cannot crash us (`decodeTokens` drops an out-of-range index;
    // `encodeTokens` drops a name outside OUR_LEGEND). It bites only when the wrong legend maps
    // the index to a name that IS in OUR_LEGEND — which is exactly what is staged below.
    const rivalCalls: string[] = [];
    multiDisposables.push(
      vscode.languages.registerDocumentSemanticTokensProvider(
        { scheme: "file", pattern: "**/vdoc-mit.*.py" }, // the SAME selector as the answering
        {                                                // stand-in => the same score => ONE group
          provideDocumentSemanticTokens(document) {
            rivalCalls.push(document.uri.toString());
            return undefined; // declines — it has no answer for this document
          },
        },
        RIVAL_PY_STANDIN_LEGEND,
      ),
    );

    const doc = await openQmd(PY_ONLY);

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "a python document must produce tokens");
    // Both premises, asserted rather than assumed (Learning #105): the rival is genuinely in the
    // group and genuinely consulted, and it genuinely produced NOTHING — so every token below
    // provably came from the OTHER provider's stream.
    assert.strictEqual(rivalCalls.length, 1, "the declining rival must genuinely have been asked");
    assert.strictEqual(pyCalls.length, 1, "…and the ANSWERING provider must genuinely have been asked");

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(
      decoded.map((t) => `${t.type}.${t.modifiers.join(".")}@${t.line}:${t.char}`),
      ["function.declaration@1:0"],
      "THE DEFECT, pinned: the stream provably came from the ANSWERING provider (the rival " +
        "returned nothing), which meant `variable`+`readonly` — but VS Code handed us the " +
        "RIVAL's legend, so index 1 resolved to `function` and bit 1 to `declaration`. Both " +
        "names are in OUR_LEGEND, so the token is not dropped: it paints the wrong colour. " +
        "If this assertion fails, see the tripwire note above — VS Code may have fixed it.",
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

  it("keeps INDENTED code verbatim in the vdoc, at its real column", async () => {
    // The canonicalization must collapse whitespace-only lines and NOTHING else. Trimming
    // every line instead left the entire unit + integration suite green — every fixture in
    // it sits at column 0 — while it would make `def f():` / `    return 1` an
    // IndentationError to Python and move every token's column leftwards.
    //
    // The stand-in reports each token at its line's first non-space column, so an indented
    // body line is the discriminating input: it must come back at column 4, and the vdoc on
    // disk must still hold the indentation.
    const doc = await openQmd(
      [
        "# Title", // 0
        "", // 1
        "```{python}", // 2
        "def f():", // 3
        "    return 1", // 4  <- INDENTED
        "```", // 5
        "", // 6
      ].join("\n"),
    );

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined);
    assert.strictEqual(pyCalls.length, 1);

    const vdocLines = (
      await vscode.workspace.openTextDocument(vscode.Uri.parse(pyCalls[0]))
    )
      .getText()
      .split("\n");
    assert.strictEqual(
      vdocLines[4],
      "    return 1",
      "the indented body line must reach the server byte-for-byte — trimming it would make " +
        "the vdoc invalid Python",
    );

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(
      decoded.map((t) => `${t.line}:${t.char}`),
      ["3:0", "4:4"],
      "the token on the indented line must land at column 4, not column 0",
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

/**
 * The (b) RANGE-registry axis of BACKLOG:125 — the divergence path our {ojs}/{js} cells
 * ACTUALLY traverse in production, which every test above this line misses.
 *
 * ## Why this needs its own describe, and why that is the whole finding
 *
 * The Slice-2 suite registers its javascript stand-in with
 * `registerDocumentSemanticTokensProvider`. That single choice puts a DOCUMENT provider in
 * the registry for a `.js` vdoc — so `hki` is true and the doc path is taken. Production has
 * no such provider: the built-in TypeScript extension registers ONLY
 * `registerDocumentRangeSemanticTokensProvider` (1.129.0: zero `registerDocumentSemantic-
 * TokensProvider` occurrences in `extensions/typescript-language-features/dist/extension.js`),
 * and nothing else serves javascript. So every {ojs}/{js} cell a real user writes falls
 * through to the RANGE registry, and the suite above has never once exercised that branch.
 *
 *   `function hki(s,o){return s.has(o)}`  <- "does the DOC registry have a provider for this model?"
 *   tokens: `if(!hki(i,t))return …executeCommand("_provideDocumentRangeSemanticTokens",e,t.getFullModelRange())`
 *   legend: `let n=rdn(i,t);return n?n[0].getLegend():…executeCommand("_provideDocumentRangeSemanticTokensLegend",e)`
 *
 * This describe therefore registers NO document provider for the `.js` vdoc — that absence is
 * load-bearing, not an oversight. Add one and these tests silently stop testing the range path.
 * (PROJECT_LEARNINGS #109: grounding a defect on the path your TEST takes is not grounding it
 * on the path your CODE takes.)
 *
 * ## The mechanism, verbatim from the shipped 1.129.0 workbench bundle
 *
 * The two commands read the SAME range registry and the SAME top tie-group —
 * `Ago(n,i)` -> `orderedGroups(o)[0]` — but index into it by DIFFERENT rules:
 *
 *   legend: `if(r.length===0)return;`
 *           `if(r.length===1)return r[0].getLegend();`                       <- correct at exactly one
 *           `if(!t||!q.isIRange(t))return console.warn("provideDocumentRangeSemanticTokensLegend`
 *           ` might be out-of-sync with provideDocumentRangeSemanticTokens unless a range`
 *           ` argument is passed in"),r[0].getLegend();`                     <- BLIND. we land HERE
 *           `let a=await ZNt(n,i,q.lift(t),ye.None);if(a)return a.provider.getLegend()` <- correct, but
 *                                                                              only WITH a range
 *   tokens: `ZNt` -> `for(let r of n)if(r.tokens)return r`                   <- the FIRST that ANSWERS
 *
 * The doc legend command's fall-through passes ONLY the uri — no range — so VS Code takes its
 * own self-warned blind branch. It has the CORRECT implementation one line below and cannot
 * reach it. Divergence therefore needs exactly what the doc axis needs: a top provider that does
 * not answer while a tied one does. (Our two commands provably read the SAME registry snapshot —
 * see "the two-read race", considered and refuted, below.)
 *
 * ## Why these two pins cover EVERY language, not just javascript
 *
 * The {ojs}/{js} framing above is the motivating instance, NOT the coverage argument — reaching
 * for it would repeat #109 one level up ({r}/{julia} servers are unmeasured here, so "which branch
 * does an {r} cell take?" is exactly as unanswered today as the {ojs} question was yesterday). What
 * actually licenses coverage is STRUCTURAL: the two registry predicates are the same predicate.
 *   `has(o){return this.all(o).length>0}`
 *   `all(o){…this._updateScores(o,!1);…for(let t of this._entries)t._score>0&&e.push(t.provider);…}`
 *   `_orderedForEach(o,e,t){this._updateScores(o,e);for(let i of this._entries)i._score>0&&t(i)}`
 * Both filter `_score>0` over the same `_entries`, so `hki(i,t)` <=> `rdn(i,t)!==null`, and per
 * snapshot BOTH commands always select the SAME registry:
 *   doc registry non-empty          -> both take the DOCUMENT path  -> the S99 pin above
 *   doc empty, range non-empty      -> both take the RANGE path     -> the two pins below
 *   both empty                      -> both undefined -> we degrade -> "no server serves…" test
 * That trichotomy is exhaustive over ALL inputs, so whichever registry a user's python / R / Julia
 * / javascript server happens to register in, it lands on an axis that is already pinned. (Nor is
 * there a cross-registry split: when the doc registry is non-empty but every provider DECLINES,
 * `mki` returns `r[0]` with `tokens:null` and the command hits `if(!a||!PZe(a))return` — it yields
 * `undefined`, it does NOT fall through to range.)
 *
 * ## Why this axis is BROADER than the document axis: the THROW leg
 *
 * The range path's per-provider error handling has no error CHANNEL at all —
 *   `async function ZNt(s,o,e,t){let i=Ago(s,o),n=await Promise.all(i.map(async r=>{let a;`
 *   `try{a=await r.provideDocumentRangeSemanticTokens(o,e,t)}catch(c){Fs(c),a=null}`
 *   `return(!a||!PZe(a))&&(a=null),new uki(r,a)}));for(let r of n)if(r.tokens)return r;…}`
 *   `var uki=class{constructor(o,e){this.provider=o;this.tokens=e}}`   <- (provider, tokens). NO error.
 * — where the document path's `mki` builds `new dki(a,c,l)` (provider, tokens, ERROR) and then
 * `for(let a of r){if(a.error)throw a.error;if(a.tokens)return a}`. So a THROWING top provider
 * REJECTS the doc command (our try/catch degrades it to `undefined` — the cell keeps its
 * TextMate colour, which is the correct degradation), but on the RANGE path it is swallowed and
 * a tied provider's stream is returned under the THROWER's legend. A throw is a wrong COLOUR
 * here and a safe no-op there. That leg is pinned below and has no document-axis counterpart.
 *
 * ## Reachability, stated honestly
 *
 * Both legs need TWO javascript range providers TIED on selector score. `CU` caps every match
 * at 10 by ASSIGNMENT, not addition (`if(c)if(c===o.scheme)p=10;…if(a){…p=10;…}`), so our
 * `{scheme:"file",pattern:"**\/vdoc-mit.*.js"}` and the TS extension's javascript selector both
 * score 10 and share one group — a real second JS semantic-token extension would too. With the
 * stock single provider the group holds one and `if(r.length===1)` returns the right legend, so
 * a default install is SAFE. Harm is bounded exactly as on the doc axis: it mis-COLOURS, never
 * mis-POSITIONS, and cannot crash us.
 *
 * And the ordering WITHIN that group is fully determined, which is what makes the production case
 * sharp rather than racy. The ext-host stamps every registered selector with its extension's
 * builtin-ness — `{…,isBuiltin:r?.isBuiltin}` — and `_compareByScoreAndTime` sorts
 * `score desc -> non-builtin BEFORE builtin -> _time DESC` (`Bot(s)` is `!!s.isBuiltin`). Note
 * builtin-ness only ORDERS within a group; `orderedGroups` still groups by equal `_score`. So a
 * third-party JS extension always outranks the BUILT-IN TS service and owns the blind legend: if
 * it declines (or throws) while the built-in answers, the user sees the third-party's legend over
 * the built-in's stream. That is the real-world shape of this bug, and it is deterministic.
 *
 * ## The two-read race — CONSIDERED AND REFUTED (do not re-file it)
 *
 * A tempting third precondition, raised and killed during this session's review; it is recorded
 * here so nobody re-derives it. The TRUE half: our fetch does not take one registry snapshot.
 * `streamFor` issues the legend and tokens commands as two independent `executeCommand`s, and each
 * re-reads the registry (`all()` and `_orderedForEach()` both call `_updateScores` per invocation —
 * there is no shared snapshot OBJECT). It looks like a registry mutation between the two reads
 * would diverge them with no decline, no throw and no tie group.
 *
 * It cannot, because there is no window to mutate in. "No shared snapshot" is not "an observable
 * interleaving" — the latter needs an await between the two reads, and there is none:
 *   - the ext-host chain to the RPC send is fully SYNCHRONOUS (`_doExecuteCommand` ->
 *     `_executeContributedCommand` -> the ApiCommand handler -> `$executeCommand`), so
 *     `Promise.all([legendCmd(), tokensCmd()])` queues BOTH messages in ONE tick, in order;
 *   - on the main thread `$executeCommand` -> `CommandService.executeCommand` reaches the
 *     synchronous `_tryExecuteCommand` (no shipped extension declares
 *     `onCommand:_provideDocument*SemanticTokens*`, so there is no activation await);
 *   - each handler completes its `Ago`/`rdn` read BEFORE its first await — the legend command on
 *     the blind branch never awaits at all;
 *   - the channel is FIFO, and a provider registration is itself an ext-host message, so it lands
 *     before BOTH commands or after BOTH — never between them.
 * MEASURED, not merely argued (Session 100, real EDH): with a positive control proving the probe
 * can see it — `await legendCmd(); registerB(); await tokensCmd()` diverges, B called — our actual
 * `Promise.all` shape with B registered at every earliest moment (same tick, `queueMicrotask`,
 * `setTimeout(0)`, `setImmediate`) gave `bCalls=0` every time: B was not in the registry when the
 * TOKENS command read it. So S99's "deterministic and stable, not racy" holds for our fetch, and
 * the sequential `await; register; await` recipe would pin an artifact of the TEST's call shape,
 * not a property of `streamFor`.
 *
 * ⚠ And do NOT cite `providers/semantic-tokens.ts`'s S89 retry note ("the LEGEND command returns
 * `undefined` while the TOKEN command already answers") as evidence for it, as this comment's own
 * first draft did. That note is PROSE, not a measurement artifact (#107: an inherited diagnosis is
 * a hypothesis) — and on the range path the mechanics point the OTHER way: with one range provider
 * registered but the server not yet ready, the legend is DEFINED (`if(r.length===1)return
 * r[0].getLegend()` never calls the provider) while the TOKENS command is UNDEFINED (`ZNt` ->
 * `tokens:null`). Its operative conclusion — one language routinely has no usable stream on the
 * first pass, so degrade per-language — holds either way; only its command attribution is suspect.
 *
 * The honest residual: a provider registered from a DIFFERENT ext host (remote / web-worker) does
 * not share this channel's ordering. Same harm, same non-fix, unmeasured — not worth a guard.
 *
 * ## No fix, and no guard — same proof as the doc axis
 *
 * The answering provider's identity never crosses the RPC boundary, so we can neither pair
 * atomically nor DETECT that this happened. Switching production to the range pair is a
 * REGRESSION: the fallback runs doc->range and never range->doc, so it would silently drop
 * every full-only server (Pylance). The race has the same non-fix for the same reason. See
 * BACKLOG:125 for the full argument.
 */
describe("embedded semantic tokens — RANGE-registry provider divergence (BACKLOG:125 axis b)", () => {
  /** The ANSWERING range provider's legend: `variable` = 0, `readonly` = bit 0. */
  const JS_RANGE_LEGEND = new vscode.SemanticTokensLegend(
    ["variable", "function"],
    ["readonly", "declaration"],
  );
  /**
   * The RIVAL range provider's legend — inverted against `JS_RANGE_LEGEND` at exactly the two
   * indices the answerer emits, so a stream decoded against the WRONG one comes back with
   * different NAMES rather than with nothing. Both names are in `OUR_LEGEND`, so a cross-decode
   * is not dropped: it paints, wrongly.
   */
  const RIVAL_JS_RANGE_LEGEND = new vscode.SemanticTokensLegend(
    ["function", "variable"],
    ["declaration", "readonly"],
  );

  /** An {ojs}-only fixture: one code line, so exactly one token, at .qmd line 1. */
  const OJS_ONLY = ["```{ojs}", "o = 1", "```", ""].join("\n");

  let answerCalls: string[] = [];
  let rivalCalls: string[] = [];
  /** When true the RIVAL throws instead of declining — the leg the doc axis does not have. */
  let rivalThrows = false;
  let rangeDisposables: vscode.Disposable[] = [];

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    answerCalls = [];
    rivalCalls = [];
    rivalThrows = false;
    // Registration ORDER is load-bearing. `register` stamps `_time:this._clock++` and
    // `_compareByScoreAndTime` sorts score desc -> non-builtin -> `_time` DESC, so between these
    // two (same selector => same score, both non-builtin) the LAST-registered is `group[0][0]` —
    // the one whose legend is taken blind. The rival must therefore register LAST.
    //
    // The built-in TS extension's range provider is in this tie-group too (it activates on the
    // .js vdoc and its javascript selector also scores 10), and `ZNt` will call it. It cannot
    // disturb the staging: the ext-host stamps `isBuiltin` onto every registered selector, and
    // non-builtin sorts ahead of builtin, so it can never be `group[0][0]` and never precedes our
    // answerer in the first-that-answers walk. It is invisible to these tests, not excluded.
    rangeDisposables.push(
      vscode.languages.registerDocumentRangeSemanticTokensProvider(
        { scheme: "file", pattern: "**/vdoc-mit.*.js" },
        {
          provideDocumentRangeSemanticTokens(document) {
            answerCalls.push(document.uri.toString());
            return tokensForNonBlankLines(document, 0, 0);
          },
        },
        JS_RANGE_LEGEND,
      ),
      vscode.languages.registerDocumentRangeSemanticTokensProvider(
        { scheme: "file", pattern: "**/vdoc-mit.*.js" }, // the SAME selector => the same score
        {                                                // => ONE group with the answerer
          provideDocumentRangeSemanticTokens(document) {
            rivalCalls.push(document.uri.toString());
            if (rivalThrows) {
              throw new Error("simulated range-provider failure");
            }
            return undefined; // declines — it has no answer for this document
          },
        },
        RIVAL_JS_RANGE_LEGEND,
      ),
    );
  });

  afterEach(async () => {
    rangeDisposables.forEach((d) => d.dispose());
    rangeDisposables = [];
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("PINS the RANGE axis: a DECLINING top provider yields a foreign legend", async () => {
    // ⚠ ASSERTS A WRONG ANSWER ON PURPOSE — a tripwire, not a specification. See the block
    // comment above for the verbatim mechanism and the proof that no fix is constructible.
    //
    // 🔑 IF THIS FAILS, DO NOT ASSUME A FIX. The outcome rests on TWO independent legs, and only
    // the first is the defect — the second is merely how this fixture stages it:
    //   (1) does the range legend command still take `r[0].getLegend()` BLIND when it is handed
    //       no range and the top group holds >1 — or has VS Code started passing a range down
    //       from `_provideDocumentSemanticTokensLegend` (it already has the correct code one
    //       line below its own warning)?
    //   (2) does `_compareByScoreAndTime` still sort `_time` DESC — i.e. is the LAST-registered
    //       rival still `group[0][0]`?
    // Only (1) changing means this axis is FIXED: then delete this pin and assert
    // `variable.readonly@1:0` (the RED this pin was inverted from). If (2) changed alone the
    // defect is fully INTACT and only the staging is stale — register the rival FIRST and it
    // recurs identically.
    //
    // 🔑 THE CALL COUNTS TELL THE TWO LEGS APART. `ZNt` invokes EVERY member of the group
    // (`Promise.all(i.map(…))`), and today only the TOKENS command reaches it, so each provider is
    // asked exactly ONCE. If VS Code fixes leg (1) by passing a range down, the LEGEND command
    // runs `ZNt` too and every provider is asked TWICE — so the premise assertions below (`=== 1`)
    // fire BEFORE the decode assertion, and their messages would misdirect you. Read a `2` as
    // "leg (1) was fixed", not as a broken fixture. (The same is true of the document axis's pin:
    // its leg-(1) fix — porting `mki`'s re-run into `_provideDocumentSemanticTokensLegend` — must
    // also ASK providers to learn who answers, so it doubles that pin's counts too. Its comment
    // says the legs are "observationally identical"; that is the one claim there to distrust.)
    // Re-derive both legs against the then-current bundle; this comment's own diagnosis is no
    // exception (Learnings #107/#108/#109).
    //
    // The pin is also break-revert-proven to DISCRIMINATE (Session 100): swap the two
    // registrations so the ANSWERER registers last — making it `group[0][0]` — and both pins in
    // this describe return `variable.readonly@1:0`, the correct colour. The defect tracks exactly
    // which provider sits at `group[0][0]`, which is the mechanism claimed above.
    const doc = await openQmd(OJS_ONLY);

    const tokens = await tokensFor(doc);

    assert.ok(tokens !== undefined, "an {ojs} document must produce tokens");
    // Both premises, asserted rather than assumed (Learning #105): the rival is genuinely in
    // the group and genuinely consulted, and it genuinely produced NOTHING — so every token
    // below provably came from the OTHER provider's stream.
    assert.strictEqual(rivalCalls.length, 1, "the declining rival must genuinely have been asked");
    assert.strictEqual(answerCalls.length, 1, "…and the ANSWERING provider must genuinely have been asked");

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(
      decoded.map((t) => `${t.type}.${t.modifiers.join(".")}@${t.line}:${t.char}`),
      ["function.declaration@1:0"],
      "THE DEFECT, pinned on the axis {ojs} cells actually traverse: the stream provably came " +
        "from the ANSWERING provider (the rival returned nothing), which meant `variable`+" +
        "`readonly` — but VS Code handed us the RIVAL's legend, so index 0 resolved to " +
        "`function` and bit 0 to `declaration`. Both names are in OUR_LEGEND, so the token is " +
        "not dropped: it paints the wrong colour.",
    );
  });

  it("PINS the RANGE axis: a THROWING top provider diverges where the DOCUMENT path degrades safely", async () => {
    // ⚠ ASSERTS A WRONG ANSWER ON PURPOSE. This is the leg the document axis does NOT have, and
    // it is why BACKLOG:125's range axis is broader in KIND, not merely in reachability.
    //
    // Read this against its Slice-1 sibling, "degrades to no tokens — never throws — when the
    // language server ERRORS": there, a throwing DOCUMENT provider makes `mki` rethrow
    // (`new dki(a,c,l)` carries the error; `for(let a of r){if(a.error)throw a.error;…}`), the
    // command rejects, our `streamFor` try/catch returns `undefined`, and the cell keeps its
    // TextMate colouring — the correct degradation this whole feature promises.
    //
    // On the RANGE path the identical failure is SILENTLY SWALLOWED: `catch(c){Fs(c),a=null}`,
    // and `uki` has no error field to carry it (`constructor(o,e){this.provider=o;this.tokens=e}`),
    // so the loop `for(let r of n)if(r.tokens)return r` simply walks past the thrower to a tied
    // provider — while the legend command, which never calls anyone, still hands back the
    // THROWER's legend. A server that crashes therefore does strictly MORE harm here than on the
    // document path: a wrong colour instead of a safe no-op.
    rivalThrows = true;
    const doc = await openQmd(OJS_ONLY);

    const tokens = await tokensFor(doc);

    // NOT `undefined`: unlike the document path, the throw does not degrade — it is swallowed
    // and a stream comes back anyway.
    assert.ok(tokens !== undefined, "the range path does not degrade on a throw — it answers");
    assert.strictEqual(rivalCalls.length, 1, "the throwing rival must genuinely have been asked");
    assert.strictEqual(answerCalls.length, 1, "…and the ANSWERING provider must genuinely have been asked");

    const decoded = decodeTokens({ data: tokens.data, legend: OUR_LEGEND });
    assert.deepStrictEqual(
      decoded.map((t) => `${t.type}.${t.modifiers.join(".")}@${t.line}:${t.char}`),
      ["function.declaration@1:0"],
      "THE DEFECT, throw leg: the rival THREW, so `ZNt` swallowed it and returned the tied " +
        "provider's stream — decoded against the THROWER's legend. The document path would have " +
        "rejected here and left the cell its TextMate colour; the range path paints it wrong.",
    );
  });
});
