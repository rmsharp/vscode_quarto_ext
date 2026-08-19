import { describe, expect, it } from "vitest";
import {
  crossrefCompletionContext,
  findLabel,
  indexLabels,
  isReferenceableLine,
  refIdAt,
} from "../../src/core/refs";

describe("indexLabels — section labels from heading {#sec-…}", () => {
  it("indexes a sec- label from a heading attribute, pointing at the id", () => {
    //              0123456789012 3 4
    //              ## Methods {#sec-methods}
    expect(indexLabels("## Methods {#sec-methods}")).toEqual([
      { id: "sec-methods", kind: "sec", line: 0, column: 13 },
    ]);
  });

  it("ignores a heading whose id has no cross-ref prefix", () => {
    expect(indexLabels("## Background {#my-background}")).toEqual([]);
  });

  it("ignores a heading with no attribute id", () => {
    expect(indexLabels("# Plain heading")).toEqual([]);
  });
});

describe("indexLabels — figure/table labels from cell options", () => {
  it("indexes a fig- label from a #| label: cell option, pointing at the value", () => {
    const text = [
      "```{python}", // 0
      "#| label: fig-plot", // 1  value 'fig-plot' starts at col 10
      "import x", // 2
      "```", // 3
    ].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-plot", kind: "fig", line: 1, column: 10 },
    ]);
  });

  it("indexes a //| label: cell option (ojs/js comment marker)", () => {
    const text = ["```{ojs}", "//| label: fig-chart", "data = []", "```"].join(
      "\n",
    );
    expect(indexLabels(text)).toEqual([
      { id: "fig-chart", kind: "fig", line: 1, column: 11 },
    ]);
  });

  it("ignores a cell label that is not a cross-reference (e.g. #| label: setup)", () => {
    const text = ["```{python}", "#| label: setup", "x = 1", "```"].join("\n");
    expect(indexLabels(text)).toEqual([]);
  });
});

describe("indexLabels — inline labels on images/divs/equations", () => {
  it("indexes a fig- label from an image attribute block", () => {
    //              ![A diagram](diagram.png){#fig-diagram}
    //              id starts at column 27
    expect(indexLabels("![A diagram](diagram.png){#fig-diagram}")).toEqual([
      { id: "fig-diagram", kind: "fig", line: 0, column: 27 },
    ]);
  });

  it("indexes an eq- label from a display-equation attribute block", () => {
    const text = ["$$", "E = mc^2", "$$ {#eq-einstein}"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "eq-einstein", kind: "eq", line: 2, column: 5 },
    ]);
  });

  it("indexes a tbl- label from a table-caption attribute block", () => {
    expect(indexLabels(": My caption {#tbl-data}")).toEqual([
      { id: "tbl-data", kind: "tbl", line: 0, column: 15 },
    ]);
  });

  it("does NOT index an inline {#sec-…} (section labels come from headings)", () => {
    expect(indexLabels("::: {#sec-aside}")).toEqual([]);
  });
});

describe("indexLabels — document order and de-duplication", () => {
  it("returns labels in document order across all three sources", () => {
    const text = [
      "![](z){#fig-top}", // 0  inline
      "", // 1
      "## Methods {#sec-mid}", // 2  heading
      "", // 3
      "```{python}", // 4
      "#| label: tbl-low", // 5  cell
      "```", // 6
    ].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual([
      "fig-top",
      "sec-mid",
      "tbl-low",
    ]);
  });

  it("keeps only the first definition when an id is defined twice", () => {
    const text = ["![](a){#fig-dup}", "![](b){#fig-dup}"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-dup", kind: "fig", line: 0, column: 8 },
    ]);
  });
});

describe("indexLabels — respects the shared skip-regions (Learning #14)", () => {
  it("ignores label-like text in front matter, comments, and plain fences", () => {
    const text = [
      "---", // 0
      "subtitle: '![](x){#fig-frontmatter}'", // 1  front matter — not a label
      "---", // 2
      "<!-- ![](c){#fig-comment} -->", // 3  single-line comment — not a label
      "<!--", // 4  block comment open
      "![](b){#fig-block}", // 5  inside block comment — not a label
      "-->", // 6  block comment close
      "```", // 7  plain (non-cell) fence open
      "![](f){#fig-fenced}", // 8  fenced content — not a label
      "```", // 9  fence close
      "![](z){#fig-real}", // 10 real prose — IS a label (id at col 8)
    ].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-real", kind: "fig", line: 10, column: 8 },
    ]);
  });
});

describe("indexLabels — a PHANTOM heading is not a cross-reference target (Session 180)", () => {
  // TEST-AFTER (labelled): this passes as a consequence of the `blank_before_header` rule
  // in `core/qmd/model`, not from code written for it. It is here because `core/refs` is the
  // SECOND consumer of `findHeadings`, and the filed item described only the outline.
  //
  // Measured end to end on the real render path — the whole document renders as
  //   <p>Prose that opens the paragraph. ## Methods {#sec-methods}</p>
  //   <p>The analysis is described in <strong>?@sec-methods</strong>.</p>
  // `?@sec-methods` is quarto's UNRESOLVED-reference marker: the link is broken in the
  // rendered document. Before this session we indexed `sec-methods` as a real target, so
  // completion offered it and go-to-definition resolved it — pointing the author at a
  // heading that does not exist.
  it("drops the {#sec-} target of a heading pressed against a paragraph", () => {
    const text = [
      "---", // 0
      "title: t", // 1
      "---", // 2
      "", // 3
      "Prose that opens the paragraph.", // 4
      "## Methods {#sec-methods}", // 5  NOT a heading to pandoc — so not a target either
      "", // 6
      "The analysis is described in @sec-methods.", // 7
    ].join("\n");
    expect(indexLabels(text)).toEqual([]);
    expect(findLabel(text, "sec-methods")).toBeNull();
  });

  it("…and keeps it when a blank line makes the heading real", () => {
    const text = [
      "---", // 0
      "title: t", // 1
      "---", // 2
      "", // 3
      "Prose that opens the paragraph.", // 4
      "", // 5  the one byte that makes the heading real
      "## Methods {#sec-methods}", // 6
    ].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "sec-methods", kind: "sec", line: 6, column: 13 },
    ]);
  });
});

describe("indexLabels — a RECOVERED setext heading IS a cross-reference target (Session 181)", () => {
  // TEST-AFTER (labelled): this passes as a consequence of the fresh-block rule in
  // `core/qmd/model`, not from code written for it. `core/refs` is the SECOND consumer of
  // `findHeadings`; Session 180 established that covering it is the bar, and here the
  // defect ran the other way — we were MISSING a target quarto really resolves.
  //
  // Measured end to end on the real render path: the first document renders
  // `<h1>Methods Section</h1>` and `@sec-methods` becomes a real `href="#sec-methods"`
  // link, while the control (an open paragraph above the title) renders neither the
  // heading nor the link. Our index now agrees with quarto in BOTH directions.
  it("indexes the {#sec-} target of a setext heading below an indented code line", () => {
    const text = [
      "---", // 0
      "title: t", // 1
      "---", // 2
      "", // 3
      "    indented code", // 4  a block line — the title below it starts a fresh paragraph
      "Methods Section {#sec-methods}", // 5
      "===============", // 6
      "", // 7
      "See @sec-methods for details.", // 8
    ].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "sec-methods", kind: "sec", line: 5, column: 18 },
    ]);
    expect(findLabel(text, "sec-methods")).not.toBeNull();
  });

  it("…and still drops it when an open paragraph makes the heading unreal", () => {
    const text = [
      "---", // 0
      "title: t", // 1
      "---", // 2
      "", // 3
      "intro paragraph", // 4  leaves a paragraph OPEN — the title is a continuation of it
      "Methods Section {#sec-methods}", // 5
      "===============", // 6
    ].join("\n");
    expect(indexLabels(text)).toEqual([]);
    expect(findLabel(text, "sec-methods")).toBeNull();
  });
});

describe("indexLabels — the CLOSES_PARAGRAPH repair reaches the crossref index too (Session 182)", () => {
  // TEST-AFTER (labelled): both pass as a consequence of the `closesParagraph` change in
  // `core/qmd/model`, not from code written for them. `core/refs` is the SECOND consumer of
  // `findHeadings`, and this session's change moves it in BOTH directions — so both are
  // pinned, each measured end to end on the real render path against the RENDERED LINK,
  // never merely against our own answer.

  it("drops the {#sec-} target invented by the thematic-break row (the phantom direction)", () => {
    // Measured — the whole document renders as ONE paragraph:
    //   <p>line one line two *** # Phantom {#sec-phantom}</p>
    //   <p>See ?@sec-phantom for details.</p>
    // `?@sec-phantom` is quarto's UNRESOLVED-reference marker. Before this session the
    // thematic break closed the paragraph, so `# Phantom` was a heading, so `sec-phantom`
    // was a crossref target: completion offered it and go-to-definition resolved it, for a
    // link quarto had already rendered broken.
    const text = [
      "line one", // 0
      "line two", // 1  a paragraph is now OPEN
      "***", // 2  against an open paragraph this is lazy continuation, NOT a break
      "# Phantom {#sec-phantom}", // 3  therefore not a heading, therefore not a target
      "",
      "See @sec-phantom for details.",
    ].join("\n");
    expect(indexLabels(text)).toEqual([]);
    expect(findLabel(text, "sec-phantom")).toBeNull();
  });

  it("indexes the {#sec-} target the ATX-adjacency rule recovers (the lost-target direction)", () => {
    // The other direction, and a PRE-EXISTING lost target: nothing in `CLOSES_PARAGRAPH`
    // ever matched a bare `-`, so the heading below it was dropped and its id with it.
    // Measured — quarto renders `<h1>Real Target</h1>` and `@sec-real` becomes a RESOLVED
    // link rendering as `Section 1`, while we offered no target at all.
    const text = [
      "# Heading Above", // 0
      "-", // 1  pandoc swallows line 0 into a setext h2, which CLOSES the block
      "# Real Target {#sec-real}", // 2  so this is a real heading, and a real target
      "",
      "See @sec-real for details.",
    ].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "sec-real", kind: "sec", line: 2, column: 16 },
    ]);
    expect(findLabel(text, "sec-real")).not.toBeNull();
  });
});

describe("refIdAt — the cross-ref id under the cursor", () => {
  it("returns the id when the cursor is inside a @ref token", () => {
    //              See @fig-plot for details
    //                  4   8 (the '-')
    expect(refIdAt("See @fig-plot for details", 8)).toBe("fig-plot");
  });

  it("returns the id when the cursor sits on the @", () => {
    expect(refIdAt("See @sec-intro.", 4)).toBe("sec-intro");
  });

  it("returns the id when the cursor sits at the end of the token", () => {
    expect(refIdAt("@eq-x", 5)).toBe("eq-x");
  });

  it("returns null when the cursor is not on a cross-ref", () => {
    expect(refIdAt("just prose here", 5)).toBeNull();
  });

  it("does not treat an email-like @ as a cross-ref", () => {
    expect(refIdAt("contact user@fig-x.org now", 14)).toBeNull();
  });

  it("returns null for a bare @key citation (not a cross-ref prefix)", () => {
    expect(refIdAt("see @smith2020 here", 8)).toBeNull();
  });
});

describe("crossrefCompletionContext — detecting an in-progress @ref", () => {
  it("returns the @ position and empty typed right after a bare @", () => {
    expect(crossrefCompletionContext("See @", 5)).toEqual({
      start: 4,
      typed: "",
      end: 5,
    });
  });

  it("returns the partial text typed after @fig-", () => {
    expect(crossrefCompletionContext("See @fig-pl", 11)).toEqual({
      start: 4,
      typed: "fig-pl",
      end: 11,
    });
  });

  it("E: reports the token end past the cursor so the whole @id can be replaced", () => {
    // Cursor right after the '@' (col 5) but 'fig-plot' already follows; end is
    // the column after the existing token, before the trailing '.'.
    expect(crossrefCompletionContext("See @fig-plot.", 5)).toEqual({
      start: 4,
      typed: "",
      end: 13,
    });
  });

  it("returns null when there is no @ before the cursor", () => {
    expect(crossrefCompletionContext("See fig", 7)).toBeNull();
  });

  it("returns null for an email-like @ (preceded by a word char)", () => {
    expect(crossrefCompletionContext("user@", 5)).toBeNull();
  });

  it("returns null when whitespace separates the @ from the cursor", () => {
    expect(crossrefCompletionContext("@ fig", 5)).toBeNull();
  });
});

describe("findLabel — locate a label definition by id", () => {
  it("returns the matching label definition", () => {
    const text = ["## Methods {#sec-m}", "![](a){#fig-a}"].join("\n");
    expect(findLabel(text, "fig-a")).toEqual({
      id: "fig-a",
      kind: "fig",
      line: 1,
      column: 8,
    });
  });

  it("returns null for an unknown id", () => {
    expect(findLabel("## Methods {#sec-m}", "fig-nope")).toBeNull();
  });
});

describe("indexLabels — review fixes (adversarial, Session 8)", () => {
  it("A: heading id column points at the trailing {#sec-id}, not an earlier mention", () => {
    // The id text also appears in an inline code span earlier on the line.
    const text = "## Use `#sec-intro` here {#sec-intro}";
    expect(indexLabels(text)).toEqual([
      { id: "sec-intro", kind: "sec", line: 0, column: 27 },
    ]);
  });
});

describe("indexLabels — cell label value robustness (review C)", () => {
  it("C1: indexes a YAML-quoted cell label value", () => {
    const text = ['```{python}', '#| label: "fig-quoted"', "x=1", "```"].join(
      "\n",
    );
    expect(indexLabels(text)).toEqual([
      { id: "fig-quoted", kind: "fig", line: 1, column: 11 },
    ]);
  });

  it("C2: stops the id at trailing punctuation so it matches @ref usage", () => {
    const text = ["```{python}", "#| label: fig-plot.", "x=1", "```"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-plot", kind: "fig", line: 1, column: 10 },
    ]);
  });
});

describe("indexLabels — headings define only sections (review I)", () => {
  it("I: does NOT index a non-sec id carried on a heading line", () => {
    // A heading with a {#fig-…} id is not a figure; @fig-overview won't resolve
    // in a real Quarto render, so it must not be indexed.
    expect(indexLabels("## Figures {#fig-overview}")).toEqual([]);
  });

  it("I: still indexes a real inline fig on a non-heading prose line", () => {
    const text = ["## Figures {#sec-figs}", "![p](p.png){#fig-real}"].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual(["sec-figs", "fig-real"]);
  });
});

describe("indexLabels — inline code spans are not labels (review H)", () => {
  it("H: ignores a {#fig-…} inside an inline backtick code span", () => {
    expect(indexLabels("Add `{#fig-myplot}` after the image.")).toEqual([]);
  });

  it("H: still indexes a real label outside the code span on the same line", () => {
    const text = "Syntax `{#fig-demo}`: ![p](p.png){#fig-real}";
    expect(indexLabels(text).map((l) => l.id)).toEqual(["fig-real"]);
  });
});

describe("isReferenceableLine — cross-refs apply only to prose/heading lines (review F/G)", () => {
  it("is true for prose and heading lines, false inside cells / front matter / comments", () => {
    const text = [
      "---", // 0 front matter
      "title: T", // 1 front matter
      "---", // 2
      "# Heading {#sec-x}", // 3 heading — referenceable
      "prose @sec-x", // 4 prose — referenceable
      "```{python}", // 5 cell fence
      "x = 1  # @sec-x", // 6 cell body — not
      "```", // 7
      "<!-- @sec-x -->", // 8 whole-line comment — not
    ].join("\n");
    expect(isReferenceableLine(text, 3)).toBe(true);
    expect(isReferenceableLine(text, 4)).toBe(true);
    expect(isReferenceableLine(text, 1)).toBe(false);
    expect(isReferenceableLine(text, 6)).toBe(false);
    expect(isReferenceableLine(text, 8)).toBe(false);
  });
});

describe("indexLabels — gating CLOSES_PARAGRAPH reaches the crossref index too (Session 183)", () => {
  // TEST-AFTER (labelled): both pass as a consequence of the `closesParagraph` gate in
  // `core/qmd/model`, not from code written for them. `core/refs` is the SECOND consumer of
  // `findHeadings` (Session 180), and this session's change moves it in BOTH directions, so
  // both are pinned — each measured end to end on the real render path against the RENDERED
  // LINK, never merely against our own answer.

  it("drops the {#sec-} target invented by the indented-code row (the phantom direction)", () => {
    // Measured — the whole document renders as ONE paragraph, and the reference is BROKEN:
    //   <p>line one line two code # Phantom {#sec-phantom}</p>
    //   <p>See <strong>?@sec-phantom</strong> for details.</p>
    // `?@sec-phantom` is quarto's UNRESOLVED-reference marker. Before this session an
    // indented line against an OPEN paragraph closed it, so `# Phantom` was a heading, so
    // `sec-phantom` was a crossref target: completion offered it and go-to-definition
    // resolved it, for a link quarto had already rendered broken.
    const text = [
      "line one", //                0
      "line two", //                1  a paragraph is now OPEN
      "\tcode", //                  2  against an open paragraph this is LAZY CONTINUATION
      "# Phantom {#sec-phantom}", // 3  therefore not a heading, therefore not a target
      "",
      "See @sec-phantom for details.",
    ].join("\n");
    expect(indexLabels(text)).toEqual([]);
    expect(findLabel(text, "sec-phantom")).toBeNull();
  });

  it("keeps the {#sec-} target below a raw TeX ENVIRONMENT (the real-target direction)", () => {
    // The direction the gate must NOT break, and the reason `RAW_TEX_ENV_OPEN` is hoisted
    // ahead of the `paragraphOpen` bail. Measured — quarto really closes the paragraph here
    // and the reference RESOLVES:
    //   <section id="sec-real"><h1>Real Target</h1>
    //   <p>See <a href="#sec-real" class="quarto-xref">Section&nbsp;1</a> for details.</p>
    // A blanket gate would have deleted this heading and with it a WORKING crossref target —
    // turning a link quarto resolves into one our index cannot find.
    const text = [
      "line one",
      "line two", //                    a paragraph is OPEN …
      "\\begin{center}", //             … and a raw TeX ENVIRONMENT still interrupts it
      "text",
      "\\end{center}", //               the closing delimiter sits directly above the heading
      "# Real Target {#sec-real}",
      "",
      "See @sec-real for details.",
    ].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual(["sec-real"]);
    expect(findLabel(text, "sec-real")).not.toBeNull();
  });
});

describe("indexLabels — narrowing CLOSES_PARAGRAPH reaches the crossref index too (Session 184)", () => {
  // TEST-AFTER (labelled): these pass as a consequence of the narrowing in `core/qmd/model`,
  // not from code written for them. `core/refs` is the SECOND consumer of `findHeadings`, and
  // this session moves it in BOTH directions, so both are pinned — each measured end to end on
  // the real render path against the RENDERED LINK, never merely against our own answer.
  // `?@sec-…` is quarto's UNRESOLVED-reference marker; `href="#sec-…"` is a working link.

  it("RECOVERS the {#sec-} target below a <pre> block (the real-target direction)", () => {
    // Measured — quarto renders the heading and the reference RESOLVES:
    //   <pre>code</pre><section id="sec-real"><h1>Real</h1>
    //   <p>See <a href="#sec-real" class="quarto-xref">Section&nbsp;1</a> for details.</p>
    // Session 183's gate had deleted this heading, so the crossref target vanished with it:
    // completion stopped offering `sec-real` and go-to-definition stopped resolving it, for a
    // link quarto renders perfectly well. That is the cost of a lost heading, made concrete.
    const text = [
      "<pre>",
      "code",
      "</pre>", //                     the CLOSING delimiter sits directly above the heading
      "# Real {#sec-real}",
      "",
      "See @sec-real for details.",
    ].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual(["sec-real"]);
    expect(findLabel(text, "sec-real")).not.toBeNull();
  });

  it("drops the {#sec-} target invented by the footnote row (the phantom direction)", () => {
    // Measured end to end: quarto renders NO heading here and the reference comes out as
    // `?@sec-fn`, its unresolved-reference marker. Before this session `sec-fn` was a crossref
    // target we offered — completion suggested it and go-to-definition resolved it — for a link
    // quarto had already rendered broken.
    const text = [
      "[^1]: a footnote body", // a FOOTNOTE definition, which absorbs the line below it
      "# Phantom {#sec-fn}",
      "",
      "See @sec-fn for details.",
    ].join("\n");
    expect(indexLabels(text)).toEqual([]);
    expect(findLabel(text, "sec-fn")).toBeNull();
  });

  it("the `<span>` phantom crossref target is GONE (Session 187); the raw-TeX one REMAINS", () => {
    // ⚠ TEST-AFTER (labelled) for the first half, and the assertion is INVERTED from what
    // Session 184 pinned. `core/refs` is the SECOND consumer of `findHeadings`, so replacing
    // CommonMark's tag list with pandoc's reaches the crossref index too — and it moves it in
    // the good direction here: `<span>inline</span>` is prose to quarto, so the heading below
    // it is not a heading and `sec-span` was never a real target. Quarto rendered that link as
    // `?@sec-span`, its unresolved marker.
    expect(
      indexLabels(["<span>inline</span>", "# Phantom {#sec-span}", "", "See @sec-span."].join("\n"))
        .map((l) => l.id),
    ).toEqual([]);
    // …and the RAW-TeX row's phantom target is GONE TOO (Session 188). ⚠ ASSERTION INVERTED —
    // Session 184 pinned `["sec-tex"]` and Session 187 kept it, both stating in the same breath
    // that it was a phantom awaiting pandoc's block-MACRO list. That list is now transcribed and
    // measured, `textbf` is class C (inline in every context), and the target was never real.
    // Verified END TO END against the RENDERED LINK, not inferred: quarto logs
    //   WARNING (main.lua) Unable to resolve crossref @sec-tex
    // and emits `<p> # Phantom {#sec-tex}</p>` plus `See <strong>?@sec-tex</strong>.` — the
    // heading is a paragraph and the reference is quarto's unresolved marker.
    expect(
      indexLabels(["\\textbf{bold}", "# Phantom {#sec-tex}", "", "See @sec-tex."].join("\n"))
        .map((l) => l.id),
    ).toEqual([]);
    // CONTROL — a REAL raw-TeX target must still be indexed, in class B and in the macro-def
    // shape that exposed a corpus defect this session (`\newcommand` measured class C only
    // because a one-argument probe is malformed for a two-argument macro). Both RESOLVED on
    // the real render path (`href="#sec-…"`, no warning).
    for (const [above, id] of [
      ["\\clearpage", "sec-clear"],
      ["\\newcommand{\\foo}{bar}", "sec-newcmd"],
    ] as const) {
      expect(
        indexLabels([above, `# Real {#${id}}`, "", `See @${id}.`].join("\n")).map((l) => l.id),
      ).toEqual([id]);
    }
    // CONTROL — a REAL target below a real block opener must still be indexed, in both the
    // `blockTags` and the `eitherBlockOrInline` classes. Losing these is the deleting
    // direction and it would break go-to-definition on a link that works.
    for (const [above, id] of [
      ["<div>", "sec-div"],
      ["<meta charset=\"utf-8\">", "sec-meta"],
      ["<ins>", "sec-ins"],
    ] as const) {
      expect(
        indexLabels([above, `# Real {#${id}}`, "", `See @${id}.`].join("\n")).map((l) => l.id),
      ).toEqual([id]);
    }
  });
});

describe("indexLabels — the indented-HTML and line-block repairs reach the crossref index (Session 185)", () => {
  // TEST-AFTER (labelled): these pass as a consequence of the repair in `core/qmd/model`, not
  // from code written for them. `core/refs` is the SECOND consumer of `findHeadings`, and this
  // session moves it in BOTH directions, so both are pinned — each measured end to end on the
  // real render path against the RENDERED LINK, never merely against our own answer.
  // `?@sec-…` is quarto's UNRESOLVED-reference marker; `href="#sec-…"` is a working link.

  it("RECOVERS the {#sec-} targets below an INDENTED HTML block and a LINE BLOCK", () => {
    // Measured — quarto renders both headings and both references RESOLVE:
    //   prose one / prose two / (4sp)<div> / # Real {#sec-html}   ->  href="#sec-html"
    //   | line one / (2sp)continued / | line three / # Real {#sec-lb}  ->  href="#sec-lb"
    // Session 183's gate deleted both headings, so each crossref target vanished with it:
    // completion stopped offering the id and go-to-definition stopped resolving it, for links
    // quarto renders perfectly well. That is the cost of a deleted heading, made concrete.
    const html = [
      "prose one",
      "prose two",
      "    <div>", //                  indented past CommonMark's 3-space cap
      "# Real {#sec-html}",
      "",
      "See @sec-html for details.",
    ].join("\n");
    expect(indexLabels(html).map((l) => l.id)).toEqual(["sec-html"]);
    expect(findLabel(html, "sec-html")).not.toBeNull();

    const lineBlock = [
      "| line one",
      "  continued", //                the continuation that used to open a paragraph
      "| line three",
      "# Real {#sec-lb}",
      "",
      "See @sec-lb for details.",
    ].join("\n");
    expect(indexLabels(lineBlock).map((l) => l.id)).toEqual(["sec-lb"]);
    expect(findLabel(lineBlock, "sec-lb")).not.toBeNull();
  });

  it("does NOT invent a {#sec-} target where the line block cannot open (the phantom direction)", () => {
    // The two guards, measured end to end. Quarto renders NO heading in either document and
    // both references come out as `?@sec-…`, its unresolved marker — so offering these ids
    // would be offering a crossref target for a link quarto has already rendered broken.
    //
    //   a line block against an OPEN paragraph does not open at all      -> ?@sec-ph
    //   a continuation-shaped line under a pipe TABLE is paragraph text  -> ?@sec-tbl
    const inParagraph = [
      "prose one",
      "prose two",
      "| line one",
      "  continued",
      "# Phantom {#sec-ph}",
      "",
      "See @sec-ph for details.",
    ].join("\n");
    expect(indexLabels(inParagraph)).toEqual([]);
    expect(findLabel(inParagraph, "sec-ph")).toBeNull();

    const underTable = [
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "  continued",
      "# Phantom {#sec-tbl}",
      "",
      "See @sec-tbl for details.",
    ].join("\n");
    expect(indexLabels(underTable)).toEqual([]);
    expect(findLabel(underTable, "sec-tbl")).toBeNull();
  });
});

describe("a label's column when one id is a PREFIX of another on the same heading (Session 219)", () => {
  it("⚠ `commonmark_x` takes the FIRST id, and `lastIndexOf` finds it inside the SECOND", () => {
    // `idColumn` resolves a label's position with `lastIndexOf('#' + id)`, which is exact until
    // two ids share a prefix. `# Cal T12 Prefix {#sec-t12 #sec-t12b}` renders under
    // `commonmark_x` with id="sec-t12" (measured, `scratchpad/s219/id.quarto.tsv`) — the id text
    // begins at column 19 — but `#sec-t12` also occurs at 27 as the opening of `#sec-t12b`, so
    // the search lands there and go-to-definition puts the cursor in the middle of the OTHER
    // identifier.
    //
    // ⚠ The pandoc three are right here by construction rather than by care: they define the
    // LAST id, `sec-t12b`, whose only occurrence IS the last one. So this row is reachable only
    // through the reader whose id rule Session 219 left alone — which is why it needs its own
    // assertion and could not be caught by the id surface.
    //             0         1         2         3
    //             0123456789012345678901234567890123456
    const line = "# Cal T12 Prefix {#sec-t12 #sec-t12b}";
    const cmx = ["---", "from: commonmark_x", "---", "", line].join("\n");
    expect(indexLabels(cmx)).toEqual([{ id: "sec-t12", kind: "sec", line: 4, column: 19 }]);

    // The control that makes the assertion above mean something: same bytes, pandoc reader,
    // where the id taken is the second one and 28 is correct.
    const md = ["---", "from: markdown", "---", "", line].join("\n");
    expect(indexLabels(md)).toEqual([{ id: "sec-t12b", kind: "sec", line: 4, column: 28 }]);
  });
});

// ── Session 220 GUARD ────────────────────────────────────────────────────────
// Written and run GREEN **before** the use-side identifier rule was widened.
//
// ⚠ S204's gotcha 5, inherited a SEVENTEENTH time and on this change's own polarity:
// Session 220 WIDENS the token a `@ref` may consume, so the inherited guard shapes from a
// SUBSTITUTION (S219) or a NARROWING (S218) do not cover it. A widening fails by growing a
// token past where quarto stops — into trailing sentence punctuation, or into prose — so the
// guard is per SHAPE THAT MUST NOT GROW and per NON-REFERENCE THAT MUST NOT BECOME ONE.
describe("Session 220 GUARD — shapes a widened use-side id rule must NOT move", () => {
  it("G1: a trailing '.' after a plain id is sentence punctuation, not part of the id", () => {
    expect(refIdAt("See @sec-intro.", 4)).toBe("sec-intro");
  });

  it("G2: the completion replace range stops BEFORE a trailing '.'", () => {
    expect(crossrefCompletionContext("See @fig-plot.", 5)).toEqual({
      start: 4,
      typed: "",
      end: 13,
    });
  });

  it("G3: an email-shaped @ is not a reference", () => {
    expect(refIdAt("contact user@fig-x.org now", 14)).toBeNull();
    expect(crossrefCompletionContext("user@", 5)).toBeNull();
  });

  it("G4: a bare @key citation has no cross-ref kind prefix and stays out", () => {
    expect(refIdAt("see @smith2020 here", 8)).toBeNull();
  });

  it("G5: a plain ASCII id is unchanged on the definition surface", () => {
    expect(refIdAt("See @fig-plot for details", 8)).toBe("fig-plot");
    expect(refIdAt("@eq-x", 5)).toBe("eq-x");
    expect(refIdAt("just prose here", 5)).toBeNull();
  });

  it("G6: a plain ASCII id is unchanged on the completion surface", () => {
    expect(crossrefCompletionContext("See @", 5)).toEqual({ start: 4, typed: "", end: 5 });
    expect(crossrefCompletionContext("See @fig-pl", 11)).toEqual({
      start: 4,
      typed: "fig-pl",
      end: 11,
    });
    expect(crossrefCompletionContext("See fig", 7)).toBeNull();
    expect(crossrefCompletionContext("@ fig", 5)).toBeNull();
  });

  it("G7: whitespace still ends a token on both surfaces", () => {
    expect(refIdAt("See @sec-a b", 6)).toBe("sec-a");
    expect(crossrefCompletionContext("See @sec-a b", 10)).toEqual({
      start: 4,
      typed: "sec-a",
      end: 10,
    });
  });

  it("G8: the indexing surface is not this session's — a heading id is untouched", () => {
    const md = "# Methods {#sec-meth:ods}";
    expect(indexLabels(md)).toEqual([
      { id: "sec-meth:ods", kind: "sec", line: 0, column: 12 },
    ]);
  });
});

// ── Session 220 — the use-side identifier rule ───────────────────────────────
// Pandoc's `citeKey`, measured over 55 rendered rows (quarto 1.7.33), recorded in
// `scratchpad/s220/PREDICTIONS.tsv` (38/40) and `PREDICTIONS2.tsv` (15/15, written to
// discriminate the follower clause from its neighbours):
//
//     regchar = [\p{L}\p{N}_]      punct = [:.#$%&+?<>~/-]
//     token   = regchar ( regchar | punct FOLLOWED-BY regchar )*
describe("Session 220 — a reference reaches an id holding ':', '.' or a non-ASCII letter", () => {
  it("C1a: a ':' inside an id is part of the reference token", () => {
    // `# Methods {#sec-meth:ods}` + `@sec-meth:ods` renders
    // <a href="#sec-meth:ods" class="quarto-xref">Section 1</a> (scratchpad/s220/cal/rt.qmd R01).
    expect(refIdAt("See @sec-meth:ods here", 8)).toBe("sec-meth:ods");
  });

  // ⚠ PINS, NOT CYCLES. The rule above is general, so these passed on their first run after
  // C1 rather than driving a RED->GREEN of their own. They are declared as pins so the count
  // of cycles this session claims stays honest (S219's convention).
  it("C1-pin: a '.' inside an id is part of the token, and a TRAILING one is not", () => {
    expect(refIdAt("See @sec-a.b here", 8)).toBe("sec-a.b"); // cal/rt.qmd R02 resolves
    expect(refIdAt("End @sec-a.b.", 8)).toBe("sec-a.b"); // cal/cal.qmd t05/t36
  });

  it("C1-pin: a non-ASCII letter is part of the token", () => {
    expect(refIdAt("See @sec-café here", 8)).toBe("sec-café"); // rt.qmd R03 resolves
    expect(refIdAt("See @sec-日本 here", 8)).toBe("sec-日本"); // cal.qmd t11
  });

  it("C1-pin: a doubled punctuation run ENDS the token", () => {
    // ⚠ One of the two rows that corrected this rule from the shape first predicted for it:
    // punctuation is admitted only when a regchar follows, so `..` breaks at the first dot.
    expect(refIdAt("See @sec-a..b here", 8)).toBe("sec-a"); // cal.qmd t12
    expect(refIdAt("See @sec-x::y here", 8)).toBe("sec-x"); // cal2 u04
    expect(refIdAt("See @sec-x-.y here", 8)).toBe("sec-x"); // cal2 u06
  });

  it("C1-pin: '_' is a regchar, so it may both follow punctuation and end a token", () => {
    // ⚠ The other corrected row, and the one cal2 was written to make decisive.
    expect(refIdAt("See @sec-x_ here", 8)).toBe("sec-x_"); // cal.qmd t21
    expect(refIdAt("See @sec-x._y here", 8)).toBe("sec-x._y"); // cal2 u02
  });

  it("C1-pin: a false navigation is removed — quarto resolves @fig-plain.org to NOTHING", () => {
    // ⚠ THE OPPOSITE DIRECTION FROM THE FILED DEFECT, and it was live: the narrow rule
    // returned `fig-plain`, which findLabel RESOLVED, so go-to-definition jumped to a label
    // quarto does not reach from this reference at all (cal/rt.qmd R09 renders ?@fig-plain.org).
    expect(refIdAt("R09 @fig-plain.org R09e.", 8)).toBe("fig-plain.org");
    const doc = "![Cap B](b.png){#fig-plain}\n\nR09 @fig-plain.org R09e.";
    expect(findLabel(doc, refIdAt("R09 @fig-plain.org R09e.", 8) as string)).toBeNull();
  });

  it("C1-pin: characters outside the measured set still end the token", () => {
    expect(refIdAt("See @sec-x,y here", 8)).toBe("sec-x"); // cal.qmd t22
    expect(refIdAt("See @sec-x^y here", 8)).toBe("sec-x"); // cal2 u07
    expect(refIdAt("See @sec-x{y here", 8)).toBe("sec-x"); // cal2 u08
  });

  it("C2a: completion still fires once a ':' has been typed", () => {
    // ⚠ MEASURED ON THE PRE-SESSION BUILD BEFORE ANY CODE: this surface does not TRUNCATE,
    // it DIES. The backward scan stopped ON the ':' and never reached the '@', so
    // crossrefCompletionContext returned null and the author was offered nothing at all
    // (scratchpad/s220/pre/probe220.test.ts). The filed item did not carry this.
    expect(crossrefCompletionContext("See @sec-meth:o", 15)).toEqual({
      start: 4,
      typed: "sec-meth:o",
      end: 15,
    });
  });

  it("C2-pin: the replace range covers a ':' id past the cursor, but not a trailing '.'", () => {
    // The mid-token accept: cursor right after the '@', a ':' id already following. `end`
    // must span the WHOLE token or accepting duplicates the suffix — the failure
    // `core/citations.ts` records for the flat-class spelling of this same rule.
    expect(crossrefCompletionContext("See @sec-meth:ods.", 5)).toEqual({
      start: 4,
      typed: "",
      end: 17,
    });
  });

  it("C2-pin: completion fires on a non-ASCII id, which also used to return null", () => {
    expect(crossrefCompletionContext("See @sec-café", 13)).toEqual({
      start: 4,
      typed: "sec-café",
      end: 13,
    });
  });

  it("C3a: the kind prefix's own '-' is structural, so the replace range covers it", () => {
    // ⚠ A REGRESSION THIS SESSION SHIPPED IN C2 AND ITS OWN SWEEP CAUGHT, in the exact class
    // `core/citations.ts` names: "duplicating the suffix on a mid-token accept". `@sec-` is
    // what an author types to summon the list. With the cursor right after the '@', C2's
    // forward scan stopped BEFORE the hyphen — treating it as internal punctuation with no
    // regchar after it — so accepting `@sec-intro` produced `@sec-intro-`.
    //
    // The prefix's '-' is part of a FIXED prefix, not internal punctuation of the name, and
    // quarto agrees the two are different things: `@sec-` alone is not a reference at all
    // (scratchpad/s220/cal/cal2.qmd a12) and `@sec-.x` is not one either (a13).
    expect(crossrefCompletionContext("See @sec-", 5)).toEqual({
      start: 4,
      typed: "",
      end: 9,
    });
  });

  it("C4a: a trailing '-' after a NAME character is covered by the replace range too", () => {
    // ⚠ THE SAME DEFECT AS C3a AT A DIFFERENT POSITION, found by sweeping 321,236,210 columns
    // and adjudicating the 34 rows where the replace range still SHRANK. C3a covered the kind
    // prefix's hyphen; this is a hyphen the author typed while composing the NAME (`@sec-my-`
    // on the way to `@sec-my-topic`), and with the cursor moved back into the token, accepting
    // `@sec-x` left the stray `-` behind exactly as before.
    //
    // ⚠ `end` IS NOT A PARSE CLAIM — it is "what has the author typed as part of this token",
    // which is a different question from "what does pandoc consume" (this session's decision
    // rule 2). `refIdAt` stays exactly faithful: quarto's token for `@sec-x-` IS `sec-x`
    // (scratchpad/s220/cal/cal.qmd t07), and the C1 pins assert that. Only the REPLACE RANGE
    // is permissive, and only for `-` — the one punctuation character every cross-ref id
    // already contains, so an author typing it is always still composing the id.
    //
    // The invariant this buys is checkable and was verified over the whole sweep: the replace
    // range NEVER shrinks against the pre-session build, so no accepted completion can leave
    // a character behind that the old one would have replaced.
    //              See @sec-x-
    //              01234567890
    expect(crossrefCompletionContext("See @sec-x-", 5)).toEqual({
      start: 4,
      typed: "",
      end: 11,
    });
  });

  it("C2-pin: DISCLOSED BOUND — an astral letter reaches definition but not completion", () => {
    // ⚠ A MEASURED RESIDUAL, DECLARED RATHER THAN FIXED. `refIdAt` is regex-based with the
    // `u` flag, so it matches a surrogate pair as one letter and agrees with quarto, which
    // consumes the whole token (scratchpad/s220/adv.qmd a01/a02). The completion scanner
    // walks UTF-16 CODE UNITS, and a lone surrogate is not \p{L}, so the backward walk stops
    // inside the pair and returns null.
    //
    // ⚠ NOT A REGRESSION — the pre-session build returned null here too (for the different
    // reason that the character was not in its ASCII class), confirmed against `presrc`. It
    // is pinned because this session made the two surfaces disagree where they used to fail
    // together, and because VS Code columns are UTF-16 offsets, so the honest fix is
    // surrogate-pair-aware scanning rather than a wider class.
    expect(refIdAt("See @sec-\u{1D400}x here", 8)).toBe("sec-\u{1D400}x");
    expect(crossrefCompletionContext("See @sec-\u{1D400}x", 15)).toBeNull();
  });

  it("C2-pin: a doubled punctuation run bounds the replace range", () => {
    // The forward scan applies the follower clause, so `end` stops where quarto's token
    // does (cal.qmd t12) rather than running to the end of the line.
    //              See @sec-a..b
    //              0123456789012   — cursor at 10 is just past the 'a'
    expect(crossrefCompletionContext("See @sec-a..b", 10)).toEqual({
      start: 4,
      typed: "sec-a",
      end: 10,
    });
  });
});

// ---------------------------------------------------------------------------
// Session 221 GUARD — written and run GREEN BEFORE the definition-side widening.
//
// ⚠ THE POLARITY IS A WIDENING, so the guard is per shape-that-must-not-GROW and per
// non-label-that-must-not-BECOME one. A widening fails by growing an id past where pandoc's
// attribute parser stops, or by admitting a brace group that defines nothing at all — and
// neither failure is visible in a test that only checks the ids we mean to add.
//
// ⚠ AND `INLINE_LABEL` IS AN UNVALIDATED SCAN, not a parsed block: headings gate on
// `headingAttributesValid` before any id is mined, while Source 3 scans any prose line for
// `{#`. So widening its class also widens what a MALFORMED brace group contributes, which is
// why half these rows are about text that must keep defining nothing.
//
// ⚠ THE COLUMN IS COMPUTED, NOT SEARCHED, on both of these paths (`m[0].length - value.length`
// for Source 2, `m.index + 2` for Source 3), so every row asserts the column too — the field
// that is not the one being changed is where Sessions 219 and 220 each found their regression.
// ---------------------------------------------------------------------------
describe("Session 221 GUARD — shapes a widened definition-side id rule must NOT move", () => {
  it("G1: a plain inline label is unchanged, id and column", () => {
    //              ![p](p.png){#fig-plot}
    //              0123456789012345678901
    expect(indexLabels("![p](p.png){#fig-plot}")).toEqual([
      { id: "fig-plot", kind: "fig", line: 0, column: 13 },
    ]);
  });

  it("G2: a class atom after the id is NOT swallowed into it", () => {
    // A space is not an identifier character, so the id stops before `.cls`.
    expect(indexLabels("![p](p.png){#fig-plot .cls}").map((l) => l.id)).toEqual([
      "fig-plot",
    ]);
  });

  it("G3: two adjacent blocks stay two labels, not one", () => {
    expect(indexLabels("![p](p.png){#fig-a}{#fig-b}").map((l) => l.id)).toEqual([
      "fig-a",
      "fig-b",
    ]);
  });

  it("G4: a `{#fig-…}` inside an inline code span still defines nothing", () => {
    expect(indexLabels("Write `{#fig-myplot}` after the image.")).toEqual([]);
  });

  it("G5: a non-cross-ref kind prefix still defines nothing", () => {
    expect(indexLabels("![p](p.png){#note-a.b}")).toEqual([]);
  });

  it("G6: a bare `{#` with no kind prefix still defines nothing", () => {
    expect(indexLabels("![p](p.png){#a.b}")).toEqual([]);
  });

  it("G7: a non-sec id carried on a HEADING line is still not a label", () => {
    // Headings contribute through Source 1 only; Source 3 must keep skipping them.
    expect(indexLabels("## Figures {#fig-overview}")).toEqual([]);
  });

  it("G8: a heading's own sec- id is untouched by this change", () => {
    //              ## Methods {#sec-m.x}
    //              0123456789012 3456789
    expect(indexLabels("## Methods {#sec-m.x}")).toEqual([
      { id: "sec-m.x", kind: "sec", line: 0, column: 13 },
    ]);
  });

  it("G9: a quoted cell label still stops at the closing quote", () => {
    const text = ['```{r}', '#| label: "fig-quoted"', "x", "```"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-quoted", kind: "fig", line: 1, column: 11 },
    ]);
  });

  it("G10: a cell label's trailing YAML comment is not part of the id", () => {
    // ` #` opens a YAML comment; a space is not an identifier character either way.
    const text = ["```{r}", "#| label: fig-plot # note", "x", "```"].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual(["fig-plot"]);
  });

  it("G11: the `//|` cell-option spelling still indexes, at the same column", () => {
    const text = ["```{ojs}", "//| label: fig-chart", "d = []", "```"].join(
      "\n",
    );
    expect(indexLabels(text)).toEqual([
      { id: "fig-chart", kind: "fig", line: 1, column: 11 },
    ]);
  });

  it("G12: a repeated id is still deduped to its first definition", () => {
    const text = ["![](a){#fig-dup}", "![](b){#fig-dup}"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-dup", kind: "fig", line: 0, column: 8 },
    ]);
  });

  it("G13: labels in non-prose regions still define nothing", () => {
    const text = [
      "---",
      "subtitle: '![](x){#fig-frontmatter}'",
      "---",
      "<!-- ![](c){#fig-comment} -->",
      "![](z){#fig-real}",
    ].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual(["fig-real"]);
  });
});
