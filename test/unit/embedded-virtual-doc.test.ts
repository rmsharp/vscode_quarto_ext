import { describe, expect, it } from "vitest";
import { findAllCells } from "../../src/core/qmd/model";
import {
  buildCellVirtualContent,
  buildVirtualContent,
  embeddedCellAt,
  embeddedLanguagesIn,
} from "../../src/core/embedded/virtual-doc";

/** Indices of every `\n` in `s` — the newline-position invariant for identity mapping. */
function newlineIndices(s: string): number[] {
  const idx: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n") {
      idx.push(i);
    }
  }
  return idx;
}

const DOC = [
  "---", // 0  front matter
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Some prose.", // 4
  "", // 5
  "```{python}", // 6  opening fence
  "#| echo: false", // 7  cell-option line
  "import pandas as pd", // 8  python body
  "x = 1", // 9  python body
  "```", // 10 closing fence
  "", // 11
  "More prose.", // 12
].join("\n");

describe("buildVirtualContent — line-preserving per-language blanking", () => {
  it("keeps only {python} body lines verbatim, blanking everything else", () => {
    const v = buildVirtualContent(DOC, "python").split("\n");
    expect(v[8]).toBe("import pandas as pd");
    expect(v[9]).toBe("x = 1");
    // Front matter, prose, fences, and the `#|` option line are blanked to
    // equal-length space runs.
    expect(v[1]).toBe("");
    expect(v[4]).toBe("");
    expect(v[6]).toBe("");
    expect(v[7]).toBe("");
    expect(v[10]).toBe("");
    expect(v[12]).toBe("");
  });

  it("is the identity map: same LINE COUNT, and every kept line at its own index", () => {
    // The invariant that matters is the LINE one, not the byte one. `vscode.Position` is
    // (line, character): a forwarded position round-trips iff its line index is unchanged and
    // its column still exists on that line. Byte-length equality with the .qmd was a STRONGER
    // property than that — and it is exactly what made a prose keystroke rewrite the vdoc for
    // every language, on every debounced pass (plan 🐉8). Non-code lines are now blanked to
    // EMPTY, so the vdoc is a function of the code alone.
    const v = buildVirtualContent(DOC, "python");
    expect(v.split("\n").length).toBe(DOC.split("\n").length);
    expect(newlineIndices(v).length).toBe(newlineIndices(DOC).length);
    expect(v.split("\n")[8]).toBe("import pandas as pd");
    expect(v.split("\n")[9]).toBe("x = 1");
  });

  it("stays line-preserving on a CRLF document, keeping the body line verbatim (with its CR)", () => {
    const crlf = ["```{python}", "x = 1", "```"].join("\r\n");
    const v = buildVirtualContent(crlf, "python");
    expect(v.split("\n").length).toBe(crlf.split("\n").length);
    // The kept body line is verbatim, including its trailing CR — built from the RAW text (G4).
    expect(v.split("\n")[1]).toBe("x = 1\r");
  });

  it("blanks an {r} cell's body in the python virtual document (other-language)", () => {
    const text = [
      "```{r}", // 0
      "y <- 2", // 1  r body — must be blanked in the python vdoc
      "```", // 2
      "```{python}", // 3
      "z = 3", // 4  python body — kept
      "```", // 5
    ].join("\n");
    const v = buildVirtualContent(text, "python").split("\n");
    expect(v[1]).toBe("");
    expect(v[4]).toBe("z = 3");
  });
});

describe("buildVirtualContent — multi-language documents (6e-2)", () => {
  // One cell per mapped language, each body distinct; the {ojs} cell carries a
  // `//|` option line (ojs/js use `//|`, not `#|`).
  const MIXED = [
    "```{python}", // 0
    "p = 1", // 1  python body
    "```", // 2
    "```{r}", // 3
    "r_v <- 2", // 4  r body
    "```", // 5
    "```{julia}", // 6
    "j = 3", // 7  julia body
    "```", // 8
    "```{ojs}", // 9
    "//| echo: false", // 10 ojs option line
    "o = 4", // 11 ojs (javascript) body
    "```", // 12
  ].join("\n");

  it("the python vdoc keeps only python bodies, blanking r/julia/ojs", () => {
    const v = buildVirtualContent(MIXED, "python").split("\n");
    expect(v[1]).toBe("p = 1");
    expect(v[4]).toBe("");
    expect(v[7]).toBe("");
    expect(v[11]).toBe("");
  });

  it("the r vdoc keeps only r bodies, blanking python/julia/ojs", () => {
    const v = buildVirtualContent(MIXED, "r").split("\n");
    expect(v[4]).toBe("r_v <- 2");
    expect(v[1]).toBe("");
    expect(v[7]).toBe("");
    expect(v[11]).toBe("");
  });

  it("the julia vdoc keeps only julia bodies, blanking the rest", () => {
    const v = buildVirtualContent(MIXED, "julia").split("\n");
    expect(v[7]).toBe("j = 3");
    expect(v[1]).toBe("");
    expect(v[4]).toBe("");
  });

  it("the javascript vdoc keeps the {ojs} body and blanks its `//|` option line", () => {
    const v = buildVirtualContent(MIXED, "javascript").split("\n");
    expect(v[11]).toBe("o = 4");
    expect(v[10]).toBe("");
    expect(v[1]).toBe("");
  });

  it("keeps cross-cell same-language state: two {python} cells both survive in one python vdoc", () => {
    const text = [
      "```{python}", // 0
      "import numpy as np", // 1
      "```", // 2
      "Some prose.", // 3
      "```{python}", // 4
      "np.array([1])", // 5  cell 2 — sees cell 1's import in the SAME vdoc
      "```", // 6
    ].join("\n");
    const v = buildVirtualContent(text, "python").split("\n");
    expect(v[1]).toBe("import numpy as np");
    expect(v[5]).toBe("np.array([1])");
    expect(v[3]).toBe("");
  });

  it("is the identity map (LINE COUNT) for every languageId of a mixed doc", () => {
    for (const lang of ["python", "r", "julia", "javascript"]) {
      const v = buildVirtualContent(MIXED, lang);
      expect(v.split("\n").length).toBe(MIXED.split("\n").length);
    }
  });
});

describe("buildVirtualContent — candidate G: `# type: ignore` on line 0 (workspace-mode diagnostics mute)", () => {
  // A python cell and an {ojs} (javascript) cell, each with real body content.
  const PY_AND_OJS = [
    "```{python}", // 0
    "import pandas as pd", // 1 python body
    "```", // 2
    "```{ojs}", // 3
    "o = 4", // 4 ojs (javascript) body
    "```", // 5
  ].join("\n");

  it("injects a file-level `# type: ignore` on line 0 of a python vdoc that has body content", () => {
    // Plan §4.1 (BACKLOG HIGH): under Pylance's non-default `diagnosticMode: "workspace"`
    // the background vdoc model is diagnosed on its TRACKED membership (Pyright injects it
    // at `didOpen`, location-independent), flooding the Problems panel with phantom errors
    // on `.quarto/vdoc-mit/*.py` paths the user cannot navigate to. A file-level
    // `# type: ignore` on line 0 mutes every diagnostic in the file. Line 0 is provably
    // never a code body line (a body line needs a fence above it), so writing it shifts no
    // coordinate — confirmed firsthand: leak `[]`, completion n=273, zero line-0 tokens.
    const v = buildVirtualContent(DOC, "python").split("\n");
    expect(v[0]).toBe("# type: ignore");
  });

  it("does NOT inject into a non-python (javascript) vdoc — `#` is a JS syntax error", () => {
    // Load-bearing correctness, not a nicety (plan §4.3): the mute is python-only. `#` starts a
    // comment in python but is a SYNTAX ERROR in JS/TS, so injecting it into a `{ojs}`/`{js}`
    // vdoc would corrupt the very forward the vdoc exists to serve. The javascript vdoc's line 0
    // must stay blank, exactly as before candidate G.
    const v = buildVirtualContent(PY_AND_OJS, "javascript").split("\n");
    expect(v[0]).toBe("");
    expect(v[4]).toBe("o = 4"); // the {ojs} body is still forwarded verbatim
  });

  it("does NOT inject into an all-whitespace-body python cell — preserves the `embeddedLanguagesIn` invariant", () => {
    // The refinement over the plan's `keep.size > 0` gate. A python cell whose body is only
    // blank/whitespace lines is KEPT in `keep` (a whitespace body line is code the cursor can
    // land on, kept verbatim) — so `keep.size > 0` — but it is NOT a forwarding target:
    // `embeddedLanguagesIn` excludes it (`:159` requires a NON-whitespace body line) and there
    // is nothing for Pyright to diagnose, so nothing to mute. Injecting here would make
    // `buildVirtualContent(text,"python").trim() !== ""` while `embeddedLanguagesIn` reports
    // python absent — breaking the load-bearing `embeddedLanguagesIn ⟺ non-empty` invariant. So
    // the gate is NON-whitespace body content, not `keep.size > 0`.
    const text = ["```{python}", "    ", "```"].join("\n"); // body: one whitespace-only line
    expect(embeddedLanguagesIn(text).map((e) => e.languageId)).not.toContain("python");
    const v = buildVirtualContent(text, "python");
    expect(v.split("\n")[0]).not.toBe("# type: ignore"); // no mute injected
    expect(v.trim()).toBe(""); // the invariant: an effectively-empty vdoc stays empty
  });

  it("shifts no coordinate — the mute overwrites the blank line 0, body lines keep their index/column", () => {
    // Coordinate-safety pin (plan §4.1, §10). DOC's python cell is NOT at line 0 (front matter
    // sits above it), so this shows the directive lands on document line 0 regardless of where
    // the cell is, while every kept body line stays at its exact (index, column) — a forwarded
    // `vscode.Position` round-trips unchanged.
    const v = buildVirtualContent(DOC, "python").split("\n");
    expect(v.length).toBe(DOC.split("\n").length); // no line added or removed
    expect(v[0]).toBe("# type: ignore"); // the mute, on document line 0
    expect(v[8]).toBe("import pandas as pd"); // body line: exact index + column preserved
    expect(v[9]).toBe("x = 1");
  });
});

describe("buildCellVirtualContent — candidate G: `# type: ignore` on line 0 (per-cell vdoc mute)", () => {
  it("injects the `# type: ignore` mute on line 0 of a python cell with body content", () => {
    // The per-cell vdocs (outline in-cell symbols, Format Cell) are opened as background
    // `file:` models too and leak the SAME workspace-mode phantom diagnostics (plan §3.1 —
    // "df is not defined" from a per-cell vdoc that blanks the sibling that defined df). Same
    // file-level mute; line 0 is never a body line (body needs the fence above), so it is
    // coordinate-safe.
    const [cell] = findAllCells(DOC);
    const v = buildCellVirtualContent(DOC, cell).split("\n");
    expect(v[0]).toBe("# type: ignore");
    expect(v[8]).toBe("import pandas as pd"); // the cell's own body, unmoved
  });

  it("does NOT inject into a non-python ({ojs}) cell — `#` is a JS syntax error", () => {
    const text = ["```{ojs}", "o = 4", "```"].join("\n");
    const [cell] = findAllCells(text);
    const v = buildCellVirtualContent(text, cell).split("\n");
    expect(v[0]).toBe("");
    expect(v[1]).toBe("o = 4"); // the cell body still isolated verbatim
  });

  it("does NOT inject into an all-whitespace-body python cell (nothing to mute)", () => {
    const text = ["```{python}", "    ", "```"].join("\n"); // one whitespace-only body line
    const [cell] = findAllCells(text);
    const v = buildCellVirtualContent(text, cell);
    expect(v.split("\n")[0]).not.toBe("# type: ignore");
    expect(v.trim()).toBe(""); // an effectively-empty per-cell vdoc stays empty
  });

  it("when the cell's fence is at line 0, the mute sits IMMEDIATELY above the body (adjacency edge)", () => {
    // Documents the one input where the injected comment is adjacent to the body: a .qmd that
    // opens directly with a code cell (no front matter/prose), so the fence is line 0, the mute
    // overwrites it, and the body is line 1 with no blank between. Coordinate-safety still holds
    // (line 0 is the fence, never a body line), so outline/completion/semantic-token forwards are
    // unaffected. The residual this pins is Format Cell ONLY (S93 review, completeness critic
    // LOW): a Python formatter that inserts a blank line after a leading module comment could emit
    // a body-line-1 edit that `format-cell.ts` `rangeWithinCell` would accept. Unverified — no
    // Python formatter in the harness — and black does NOT do this (a comment attaches to the
    // following statement). Filed in BACKLOG.md; recheck when a real Python formatter is present.
    const text = ["```{python}", "x = 1", "```"].join("\n");
    const [cell] = findAllCells(text);
    const v = buildCellVirtualContent(text, cell).split("\n");
    expect(v[0]).toBe("# type: ignore"); // the mute, on the (blanked) fence line
    expect(v[1]).toBe("x = 1"); // the body, immediately below — at its own index, verbatim
  });
});

describe("buildCellVirtualContent — isolates exactly ONE cell (BACKLOG item 11 slice 2)", () => {
  it("keeps only the target cell's body, blanking a same-language sibling cell", () => {
    const text = [
      "```{python}", // 0
      "import numpy as np", // 1
      "```", // 2
      "Some prose.", // 3
      "```{python}", // 4
      "np.array([1])", // 5  a DIFFERENT python cell — must be blanked
      "```", // 6
    ].join("\n");
    const [first, second] = findAllCells(text);
    const v = buildCellVirtualContent(text, first).split("\n");
    expect(v[1]).toBe("import numpy as np");
    expect(v[5]).toBe("");
    // Sanity: the second cell's own vdoc keeps ITS body and blanks the first's.
    const v2 = buildCellVirtualContent(text, second).split("\n");
    expect(v2[1]).toBe("");
    expect(v2[5]).toBe("np.array([1])");
  });

  it("blanks the cell's own `#|` option line (not passed to the language's symbol parser)", () => {
    const text = ["```{python}", "#| echo: false", "import pandas as pd", "```"].join("\n");
    const [cell] = findAllCells(text);
    const v = buildCellVirtualContent(text, cell).split("\n");
    expect(v[1]).toBe("");
    expect(v[2]).toBe("import pandas as pd");
  });

  it("blanks prose, YAML front matter, and fence lines", () => {
    const text = [
      "---",
      "title: Demo",
      "---",
      "Some prose.",
      "```{python}",
      "x = 1",
      "```",
    ].join("\n");
    const [cell] = findAllCells(text);
    const v = buildCellVirtualContent(text, cell).split("\n");
    expect(v[1]).toBe("");
    expect(v[3]).toBe("");
    expect(v[4]).toBe("");
    expect(v[5]).toBe("x = 1");
    expect(v[6]).toBe("");
  });

  it("is the identity map: same LINE COUNT, and the cell's body at its own index", () => {
    // Line-preserving, not byte-preserving — see buildVirtualContent's identity test for why
    // (`vscode.Position` is (line, character), and byte equality is what caused 🐉8).
    const v = buildCellVirtualContent(DOC, findAllCells(DOC)[0]);
    expect(v.split("\n").length).toBe(DOC.split("\n").length);
    expect(newlineIndices(v).length).toBe(newlineIndices(DOC).length);
    expect(v.split("\n")[8]).toBe("import pandas as pd");
  });

  it("stays line-preserving on a CRLF document, keeping the body line verbatim", () => {
    const crlf = ["```{python}", "x = 1", "```"].join("\r\n");
    const [cell] = findAllCells(crlf);
    const v = buildCellVirtualContent(crlf, cell);
    expect(v.split("\n").length).toBe(crlf.split("\n").length);
    expect(v.split("\n")[1]).toBe("x = 1\r");
  });
});

describe("embeddedCellAt — the cursor body-gate", () => {
  it("returns a python hit on an interior body line", () => {
    expect(embeddedCellAt(DOC, 8)).toEqual({
      lang: "python",
      languageId: "python",
      ext: "py",
    });
  });

  it("returns null on the opening and closing fence lines (inclusive cell)", () => {
    expect(embeddedCellAt(DOC, 6)).toBeNull(); // ```{python}
    expect(embeddedCellAt(DOC, 10)).toBeNull(); // ```
  });

  it("returns null on a `#|` cell-option line (belongs to the YAML provider)", () => {
    expect(embeddedCellAt(DOC, 7)).toBeNull();
  });

  it("returns null on prose, blank, and front-matter lines", () => {
    expect(embeddedCellAt(DOC, 1)).toBeNull(); // front matter
    expect(embeddedCellAt(DOC, 4)).toBeNull(); // prose
    expect(embeddedCellAt(DOC, 11)).toBeNull(); // blank
  });

  it("returns an r hit inside an {r} cell body (mapped in 6e-2)", () => {
    const text = ["```{r}", "y <- 2", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toEqual({
      lang: "r",
      languageId: "r",
      ext: "r",
    });
  });

  it("returns null inside a still-unmapped-engine ({bash}) cell body", () => {
    const text = ["```{bash}", "echo hi", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toBeNull();
  });

  it("returns null inside a non-executable ```python fenced block", () => {
    const text = ["```python", "x = 1", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toBeNull();
  });
});

describe("embeddedLanguagesIn: every forwarding target present in the document", () => {
  it("returns each language present, in FIRST-APPEARANCE order, with its vdoc extension", () => {
    // Order is the document's, not the language map's and not alphabetical — {ojs} is
    // deliberately first here, while `LANGUAGES` lists python first and "javascript" sorts
    // before "python". An implementation that iterates the map, or sorts, fails this.
    //
    // The `ext` is not decoration: `ensureVdoc`'s VdocKey requires it, and there is no
    // languageId -> ext reverse map (cellLanguageId is keyed by ENGINE). Returning the
    // resolved target is what lets the provider mint a vdoc at all.
    const text = [
      "# Title",
      "",
      "```{ojs}",
      "x = 1",
      "```",
      "",
      "```{python}",
      "y = 2",
      "```",
      "",
    ].join("\n");

    expect(embeddedLanguagesIn(text)).toEqual([
      { languageId: "javascript", ext: "js" },
      { languageId: "python", ext: "py" },
    ]);
  });

  // The contract, inherited from `hasCellOfLanguage` (which this subsumes) and generalized
  // to N languages. A language is present IFF its virtual document has something in it:
  //
  //   embeddedLanguagesIn(text) === exactly the L with buildVirtualContent(text, L).trim() !== ""
  //
  // Asserted as a PROPERTY on every case below, not just as values, so the cheap gate and
  // the expensive builder it guards can never drift apart.
  //
  // Candidate G note: the python vdoc's `.trim()` can now be non-empty because of the injected
  // `# type: ignore` mute, not only because of body content — which is EXACTLY why that mute is
  // gated on NON-whitespace body content (the same condition this invariant uses), not on
  // `keep.size > 0`. A python cell whose body is only blank lines has `keep.size > 0` yet is
  // absent from `embeddedLanguagesIn`; muting it would make the RHS true while the LHS is false
  // and break this equivalence. The "…nothing but BLANK lines" case below is that discriminator
  // (it goes RED against a `keep.size > 0` gate), so do not simplify the gate to `keep.size > 0`.
  const EVERY_TARGET = ["python", "r", "julia", "javascript"];
  const agreesWithBuild = (text: string): void => {
    const returned = embeddedLanguagesIn(text).map((e) => e.languageId);
    for (const lang of EVERY_TARGET) {
      expect(returned.includes(lang)).toBe(buildVirtualContent(text, lang).trim() !== "");
    }
  };

  it("orders by the DOCUMENT, not alphabetically — python first, then javascript", () => {
    // The discriminating case, and the one my first test did NOT provide: with {ojs} first
    // the two orderings agree ("javascript" < "python"), so sorting alphabetically passed.
    // Here they disagree, and only first-appearance order survives.
    //
    // Honest scope: this order does not change the COLOURS. The merge sorts every token by
    // (line, char) regardless, so which stream is fetched first is immaterial to the output.
    // What it pins is DETERMINISM — the same document always forwards in the same order —
    // and the documented contract, which was previously asserted by a test that could not
    // actually tell the two apart.
    const text = [
      "```{python}", // 0
      "p = 1", // 1
      "```", // 2
      "", // 3
      "```{ojs}", // 4
      "o = 2", // 5
      "```", // 6
      "", // 7
    ].join("\n");

    expect(embeddedLanguagesIn(text)).toEqual([
      { languageId: "python", ext: "py" },
      { languageId: "javascript", ext: "js" },
    ]);
  });

  it("omits a language whose cell body is nothing but BLANK lines", () => {
    // The case that pins the non-blank content check itself. An EMPTY cell and an
    // OPTIONS-ONLY cell are both rejected for other reasons (zero body lines; every body
    // line is an option line), so neither one exercises `lines[i].trim() !== ""` — deleting
    // that check left the whole suite green, which is how a break-revert battery derived
    // from invariants rather than from the lines I happened to write earns its keep.
    //
    // A body of two blank lines is the smallest input that tells them apart: it HAS body
    // lines, none of them are option lines, and there is still nothing for a server to read.
    const text = ["```{python}", "", "", "```", "", "```{ojs}", "o = 1", "```", ""].join("\n");

    expect(embeddedLanguagesIn(text)).toEqual([{ languageId: "javascript", ext: "js" }]);
    agreesWithBuild(text);
  });

  it("omits a language whose cells are EMPTY or hold only option lines", () => {
    // Nothing to ask a server about: buildVirtualContent blanks option lines, so both of
    // these build an all-whitespace vdoc. Returning the language anyway would write a file
    // to the user's workspace and start a language server on it, for nothing.
    const text = [
      "```{python}", // 0  empty cell
      "```", // 1
      "", // 2
      "```{r}", // 3
      "#| echo: false", // 4  option line only
      "```", // 5
      "", // 6
      "```{ojs}", // 7
      "o = 4", // 8  the ONLY language with real content
      "```", // 9
      "", // 10
    ].join("\n");

    expect(embeddedLanguagesIn(text)).toEqual([{ languageId: "javascript", ext: "js" }]);
    agreesWithBuild(text);
  });

  it("includes a language whose FIRST cell is empty but a LATER cell has content", () => {
    const text = [
      "```{python}", // 0  empty
      "```", // 1
      "", // 2
      "```{python}", // 3
      "y = 2", // 4  content — python IS present
      "```", // 5
      "", // 6
    ].join("\n");

    expect(embeddedLanguagesIn(text)).toEqual([{ languageId: "python", ext: "py" }]);
    agreesWithBuild(text);
  });

  it("returns nothing for a prose-only document, or for an unmapped engine", () => {
    const prose = ["# Title", "", "Just words.", ""].join("\n");
    expect(embeddedLanguagesIn(prose)).toEqual([]);
    agreesWithBuild(prose);

    // `bash` has no forwarding target (cellLanguageId -> null), so it is not a language we
    // can ask anything of — and a non-executable ```python block is not a cell at all.
    const unmapped = ["```{bash}", "ls -la", "```", "", "```python", "x = 1", "```", ""].join("\n");
    expect(embeddedLanguagesIn(unmapped)).toEqual([]);
    agreesWithBuild(unmapped);
  });

  it("dedupes: many cells of the same language collapse to ONE target", () => {
    // The provider mints one vdoc PER TARGET, not per cell — a document with 20 python
    // cells must forward once, not 20 times.
    const text = [
      "```{python}", "a = 1", "```", "",
      "```{python}", "b = 2", "```", "",
      "```{python}", "c = 3", "```", "",
    ].join("\n");

    expect(embeddedLanguagesIn(text)).toEqual([{ languageId: "python", ext: "py" }]);
    agreesWithBuild(text);
  });

  it("maps BOTH javascript engines ({ojs} and {js}) to a single javascript target", () => {
    // Two distinct ENGINE tokens, one languageId. Deduping on the engine instead of the
    // languageId would forward javascript twice, and the merge would emit every JS token
    // twice — a duplicate-token stream, which is exactly what VS Code must never be given.
    const text = [
      "```{ojs}", "o = 1", "```", "",
      "```{js}", "j = 2", "```", "",
    ].join("\n");

    expect(embeddedLanguagesIn(text)).toEqual([{ languageId: "javascript", ext: "js" }]);
    agreesWithBuild(text);
  });
});

describe("the identity mapping holds for a WHITESPACE-ONLY line inside a cell body", () => {
  // The adversarial review's headline (Session 89), and a regression this session INTRODUCED.
  //
  // A blank line inside a code cell is a CODE-BODY line — `embeddedCellAt` returns a hit on it,
  // so completion/hover/definition/signature-help forward the user's position there unchanged.
  // It arises constantly: press Enter inside a Python function and VS Code's auto-indent writes
  // "    " into the buffer and puts the cursor at column 4.
  //
  // The first 🐉8 fix collapsed EVERY whitespace-only line to "" — including that one. Column 4
  // then did not exist in the virtual document, so the forwarded position no longer described
  // where the user was. Semantic tokens never noticed (no token lands on a blank line), which is
  // exactly why every lens pointed at the semantic-token diff missed it.
  const CELL = [
    "```{python}", // 0
    "def f():", // 1
    "    x = 1", // 2
    "    ", // 3  <- whitespace-only BODY line: the cursor sits here after Enter
    "    return x", // 4
    "```", // 5
    "", // 6
  ].join("\n");

  it("keeps a whitespace-only BODY line verbatim, so the cursor's column still exists", () => {
    expect(embeddedCellAt(CELL, 3)).not.toBeNull(); // it IS a forwardable code line

    const vdoc = buildVirtualContent(CELL, "python").split("\n");
    expect(vdoc[3]).toBe("    "); // NOT "" — column 4 must exist for the forwarded position
  });

  it("keeps it in the per-cell vdoc too (outline / Format Cell ride on this one)", () => {
    const [cell] = findAllCells(CELL);
    expect(buildCellVirtualContent(CELL, cell).split("\n")[3]).toBe("    ");
  });

  it("preserves the LINE COUNT and every body line's index — the invariant positions need", () => {
    // vscode.Position is (line, character), never an offset. So what must not move is the LINE
    // INDEX of every code line, and the COLUMN of everything on it. Byte-length equality with the
    // .qmd was a stronger property than that, and it is precisely what made a prose keystroke
    // rewrite the vdoc (🐉8).
    const v = buildVirtualContent(CELL, "python").split("\n");
    expect(v.length).toBe(CELL.split("\n").length);
    expect(v[1]).toBe("def f():");
    expect(v[2]).toBe("    x = 1");
    expect(v[4]).toBe("    return x");
    // The fence's content is gone; line 0 now carries the candidate-G `# type: ignore` mute
    // (python vdoc with body). Line 0 is never a code body line, so this shifts no position —
    // v[1], v[2], v[4] above prove the body lines are still at their own indices.
    expect(v[0]).toBe("# type: ignore");
  });

  it("STILL makes a prose-only edit produce byte-identical content (🐉8 stays fixed)", () => {
    const before = ["# Title", "", "```{python}", "x = 1", "```", ""].join("\n");
    const after = ["# Title with much more prose", "", "```{python}", "x = 1", "```", ""].join("\n");

    expect(buildVirtualContent(after, "python")).toBe(buildVirtualContent(before, "python"));
  });
});
