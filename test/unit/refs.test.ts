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

  it("C2 (REVERSED by Session 221): a trailing dot is part of the id quarto defines", () => {
    // ⚠ THIS ASSERTION USED TO READ `fig-plot`, on the stated rationale that the id should
    // "stop at trailing punctuation so it matches @ref usage". That premise is measured
    // FALSE: quarto defines `fig-plot.`, dot included (`scratchpad/s221/cal/cell.qmd` c17,
    // and `attr.qmd` t40 for the inline spelling). The id and the reference token are two
    // different grammars — Session 220 measured the second, Session 221 the first — and
    // making one agree with the other by truncation invented a target quarto never defines.
    //
    // ⚠ AND THE DEFINED ID IS UNREACHABLE, WHICH IS THE HONEST OUTCOME RATHER THAN A GAP:
    // `@fig-plot.` consumes only `fig-plot`, so quarto itself reports "Unable to resolve
    // crossref" and echoes `?@fig-plot` (`resolve.qmd` E03). Before this change the model
    // resolved `@fig-plot` to this label — navigation to a target that does not exist.
    const text = ["```{python}", "#| label: fig-plot.", "x=1", "```"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-plot.", kind: "fig", line: 1, column: 10 },
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
// ⚠ AND AT THE TIME THESE ROWS WERE WRITTEN Source 3 WAS AN UNVALIDATED SCAN, not a parsed
// block: headings gated on `headingAttributesValid` before any id was mined, while Source 3
// scanned any prose line for `{#`. So widening its class also widened what a MALFORMED brace
// group contributed, which is why half these rows are about text that must keep defining
// nothing. ⚠ Session 222 closed that gap for the groups that ARE attribute blocks — see the
// reversed C1/A1/A2 pins below — and the rows here are the ones it left standing.
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

// ---------------------------------------------------------------------------
// Session 221 — the DEFINITION side reaches the id quarto actually defines.
//
// Measured over 69 rows rendered through the real `quarto render` path (quarto 1.7.33),
// with predictions frozen and hashed before each render: `scratchpad/s221/cal/attr.qmd`
// 36/36, `cell.qmd` 11/24 (the hypothesis this REFUTED — see CALIBRATION.md), and the
// discriminating round `cell3.qmd` + `cell2.qmd` 9/9.
// ---------------------------------------------------------------------------
describe("Session 221 — an inline {#…} label reaches pandoc's whole identifier", () => {
  it("indexes a dotted inline id under the name quarto defines", () => {
    // `![Cap A](a.png){#fig-a.b}` renders `id="fig-a.b"` and `@fig-a.b` resolves to it
    // (scratchpad/s221/cal/attr.qmd t01, resolve.qmd E01). This model indexed `fig-a`.
    //              ![p](p.png){#fig-a.b}
    //              0123456789012345678901
    expect(indexLabels("![p](p.png){#fig-a.b}")).toEqual([
      { id: "fig-a.b", kind: "fig", line: 0, column: 13 },
    ]);
  });

  it("indexes an id whose first character after the prefix is punctuation", () => {
    // The name is a FLAT run, not a first-character class plus a tail: `{#fig-.t30b}` and
    // `{#fig--t31b}` both render `id="…"` exactly as spelled (attr.qmd t30/t31), and the
    // two-clause spelling refused them outright rather than truncating them.
    //              ![p](p.png){#fig-.x}
    //              01234567890123456789
    expect(indexLabels("![p](p.png){#fig-.x}")).toEqual([
      { id: "fig-.x", kind: "fig", line: 0, column: 13 },
    ]);
    expect(indexLabels("![p](p.png){#fig--y}").map((l) => l.id)).toEqual([
      "fig--y",
    ]);
  });

  // The rows below are PINS, not RED->GREEN cycles: they passed on first run, because the
  // rule is general. They are here so a later narrowing cannot delete them silently.

  it("C1-pin: doubled punctuation is ONE id, unlike the use side", () => {
    // ⚠ THIS IS THE ROW THAT SEPARATES THE TWO RULES. `{#fig-a..b}` defines `fig-a..b`
    // (attr.qmd t26) while `@sec-a..b` consumes only `sec-a` (S220's cal.qmd t12): the
    // definition side has no follower clause. Porting either rule to the other is wrong.
    expect(indexLabels("![p](p.png){#fig-a..b}").map((l) => l.id)).toEqual([
      "fig-a..b",
    ]);
  });

  it("C1-pin: trailing punctuation stays in a DEFINED id", () => {
    // attr.qmd t40/t41/t42. ⚠ `fig-a.` is a target NO reference can reach — `@fig-a.`
    // consumes `fig-a` and quarto itself reports "Unable to resolve crossref @fig-e03a"
    // (resolve.qmd E03). Indexing it is still right: the index records definitions, and the
    // truncated `fig-a` this used to record was a target quarto never defined.
    expect(indexLabels("![p](p.png){#fig-a.}").map((l) => l.id)).toEqual([
      "fig-a.",
    ]);
    expect(indexLabels("![p](p.png){#fig-a:}").map((l) => l.id)).toEqual([
      "fig-a:",
    ]);
  });

  it("C1-pin: the class is Unicode letters, not ASCII", () => {
    expect(indexLabels("![p](p.png){#fig-日本b}").map((l) => l.id)).toEqual([
      "fig-日本b",
    ]);
  });

  it("C1-pin: a block quarto REFUSES defines nothing — CLOSED by Session 222", () => {
    // ⚠ **PIN REVERSED against the measurement**, and it is the phantom half of Session 222's
    // deliverable. Session 221 recorded these three as residuals of an UNVALIDATED scan: a
    // character outside the identifier class truncated the id here where it makes quarto
    // define nothing at all. Validating the group closes all three, and each fails for its
    // own measured reason:
    //
    //   `{#fig-a$b}`  the `$` leaves a token no atom form matches   (attr.qmd t09, s222 v02)
    //   `{#fig-a b}`  the bare `b` is neither an atom run nor k=v   (attr.qmd t25, s222 v03)
    //   `{#fig-a#b}`  a VALID block whose LAST atom is `b`, which
    //                 carries no cross-ref kind prefix, so quarto
    //                 defines `b` and no `fig-` target exists       (attr.qmd t08, S219)
    //
    // ⚠ The third is the one that shows validation alone is not the whole rule: that block
    // parses fine, and it yields no label only because the atom the pandoc family selects is
    // not a cross-reference id.
    for (const line of [
      "![p](p.png){#fig-a$b}",
      "![p](p.png){#fig-a b}",
      "![p](p.png){#fig-a#b}",
    ]) {
      expect(indexLabels(line)).toEqual([]);
    }
  });
});

describe("Session 221 — a #| label: cell option reaches the same identifier", () => {
  it("indexes a dotted cell label under the name quarto defines", () => {
    // ⚠ SOURCE 2 IS SOURCE 3 IN A YAML COSTUME, AND THAT IS MEASURED RATHER THAN ASSUMED.
    // The frozen hypothesis — "the label is the YAML scalar verbatim" — scored 11/24
    // (`scratchpad/s221/cal/cell.qmd`). The engine writes the label VERBATIM INTO A PANDOC
    // ATTRIBUTE BLOCK, and it is pandoc that accepts or rejects it: `::: {#tbl-c09a$b .cell
    // tbl-cap='Cap c09'}` appears as LITERAL TEXT in the rendered output, alongside quarto's
    // own "The following string was found in the document: :::" warning. So the two sources
    // share one class because they were measured to ask one question, not because one was
    // ported to the other (Learning #377).
    const text = ["```{r}", "#| label: fig-c.d", "x", "```"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-c.d", kind: "fig", line: 1, column: 10 },
    ]);
  });

  // The rows below are PINS, not RED->GREEN cycles: each passed on first run.

  it("C2-pin: a punctuation-first name no longer indexes the bare kind prefix", () => {
    // ⚠ WRITTEN AS A CYCLE AND DEMOTED TO A PIN WHEN ITS RED CAME UP GREEN, WHICH IS WHY IT
    // IS WORTH KEEPING. Source 3's first-character clause sat AFTER the kind prefix, so it
    // refused `{#fig-.x}` outright; this one sits at the START OF THE WHOLE ID, where the
    // prefix's own `f` always satisfies it, so the clause is vestigial here and only the tail
    // ever mattered. The pre-session defect was therefore different in kind — measured
    // against `scratchpad/s221/presrc`, `#| label: fig-.d` indexed **`fig-`** and
    // `#| label: fig-日本b` indexed **`fig-`** too: a kind prefix with an EMPTY NAME, a
    // target no document can define. `{#fig-.d}` renders id="fig-.d" (cell3.qmd d04).
    const text = ["```{r}", "#| label: fig-.d", "x", "```"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-.d", kind: "fig", line: 1, column: 10 },
    ]);
  });

  it("C2-pin: the class is Unicode letters here too", () => {
    const text = ["```{r}", "#| label: fig-日本b", "x", "```"].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual(["fig-日本b"]);
  });

  it("C2-pin: doubled punctuation is ONE id on this source as well", () => {
    const text = ["```{r}", "#| label: fig-a..b", "x", "```"].join("\n");
    expect(indexLabels(text).map((l) => l.id)).toEqual(["fig-a..b"]);
  });

  it("C2-pin: DISCLOSED RESIDUAL — quoting does not license a wider id", () => {
    // ⚠ `#| label: "fig-a$b"` reaches the attribute block UNQUOTED and defines NOTHING
    // (`cell3.qmd` d01 — the `:::` is rendered as literal text). This model truncates to
    // `fig-a` instead, at column 11 past the opening quote. PRE-EXISTING and unchanged:
    // both builds return `fig-a` (`scratchpad/s221/presrc`). Same unvalidated-scan cause as
    // the Source 3 residual above; filed, not fixed.
    const text = ["```{r}", '#| label: "fig-a$b"', "x", "```"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-a", kind: "fig", line: 1, column: 11 },
    ]);
  });
});

describe("Session 221 adversarial pins — measured rows this model still gets wrong", () => {
  // The adversarial corpus (`scratchpad/s221/adv/adv.qmd`, 9 rows rendered through quarto
  // 1.7.33) was aimed at THIS IMPLEMENTATION's hypotheses rather than at quarto's behaviour,
  // and scored 2/9 -> 6/9 with INTRODUCED 0. The three rows below are the ones still wrong.
  // All three are PRE-EXISTING, established against `scratchpad/s221/presrc`.

  it("A1: an id that is not FIRST in its block IS indexed — CLOSED by Session 222", () => {
    // ⚠ **PIN REVERSED against the measurement**, and it is the lost-TP half of Session 222's
    // deliverable — the only LOST-TP row of Session 221's nine adversarial rows.
    // `![Cap](a.png){.cls #fig-a03.x}` renders id="fig-a03.x" and `@fig-a03.x` resolves to it
    // (`s221/adv/adv.qmd` a03; re-rendered this session as `cal.qmd` g03, with `s05`
    // `{.cls #fig-s05 .cls2}` and `s07` `{#nots07 #fig-s07}` as two more). Quarto does not
    // care where the `#` atom sits, because the block is TOKENISED rather than scanned.
    //
    // ⚠ **DISCLOSURE — THIS ROW WENT GREEN WITHOUT A CYCLE OF ITS OWN, AND THAT IS RECORDED
    // RATHER THAN DRESSED UP.** It was to be Session 222's third RED→GREEN cycle. The second
    // cycle's own third row, `{#fig-a#b}`, is a VALID block whose last atom carries no kind
    // prefix, so nothing but atom SELECTION can make it yield no label — and once the block's
    // atoms are read instead of its first two characters, position-independence is not a
    // further clause but the absence of one. Demoted to a pin, as Session 221 demoted a RED
    // that came up green.
    expect(indexLabels("![p](p.png){.cls #fig-a03.x}")).toEqual([
      { id: "fig-a03.x", kind: "fig", line: 0, column: 18 },
    ]);
  });

  it("A2: an UNCLOSED brace group defines nothing — CLOSED by Session 222", () => {
    // ⚠ **PIN REVERSED against the measurement.** `![Cap](a.png){#fig-a06.x` with no `}`
    // defines nothing in quarto (adv.qmd a06, and re-rendered this session as `cal.qmd` v11,
    // whose braces appear verbatim in the output). With no closing brace there is no group at
    // all, so nothing can attach and the `{` is ordinary text — Session 222's M4, rendered.
    expect(indexLabels("![p](p.png){#fig-a06.x")).toEqual([]);
  });

  it("A3: a SECOND adjacent block is indexed although only the first is the block", () => {
    // `![Cap](a.png){#fig-a05.x}{#fig-a05b.y}` defines only `fig-a05.x` (adv.qmd a05); the
    // trailing group is literal text. Both are indexed here.
    expect(
      indexLabels("![p](p.png){#fig-a05.x}{#fig-a05b.y}").map((l) => l.id),
    ).toEqual(["fig-a05.x", "fig-a05b.y"]);
  });

  it("A4: a div and a display equation DO reach the wide id", () => {
    // The two rows that prove the fix is not image-only (adv.qmd a01/a02).
    expect(indexLabels("::: {#fig-a01.x}").map((l) => l.id)).toEqual([
      "fig-a01.x",
    ]);
    expect(indexLabels("$$ y = x $$ {#eq-a02.x}").map((l) => l.id)).toEqual([
      "eq-a02.x",
    ]);
  });
});

describe("Session 222 — the reader split reaches Source 3", () => {
  it("C3: under commonmark_x the FIRST atom of a block wins, not the last", () => {
    // ⚠ **THIS ROW IS A REGRESSION THIS SESSION INTRODUCED AND ITS OWN SWEEP CAUGHT.** The
    // pre-change scan took the first `{#…}` on the line, which is accidentally the right
    // answer for `commonmark_x`; taking the block's LAST atom is right for the pandoc family
    // and wrong here, so the fix for one reader broke the other.
    //
    // Measured (`scratchpad/s222/cal/cmx.qmd`, rendered with `from: commonmark_x`):
    // `![Cap x01](a.png){#fig-x01a #fig-x01b}` renders id="fig-x01a", and the div spelling
    // `::: {#fig-x03a #fig-x03b}` renders id="fig-x03a" — the same split Session 219
    // measured on headings, holding for inline blocks and divs too.
    const doc = [
      "---",
      "title: T",
      "format:",
      "  html:",
      "    from: commonmark_x",
      "---",
      "",
      "![Cap](a.png){#fig-x01a #fig-x01b}",
      "",
      "::: {#fig-x03a #fig-x03b}",
      "body",
      ":::",
    ].join("\n");
    expect(indexLabels(doc).map((l) => l.id)).toEqual(["fig-x01a", "fig-x03a"]);
  });
});

describe("Session 222 GUARD — shapes that must NOT move when the scan becomes block-aware", () => {
  // ⚠ Written and confirmed GREEN **before** the implementation (S204's gotcha 5, inherited a
  // nineteenth time). This deliverable points mostly in the DELETION direction — a scan that
  // starts refusing brace groups removes completion offers as well as phantoms — so the guard
  // is per shape-that-must-keep-defining and per source-that-must-not-move, not per bug fixed.
  // Every row's value here is the value the PRE-change build produced
  // (`scratchpad/s222/guardprobe.test.ts`).

  it("G1: Source 1 — a heading's sec- id is untouched", () => {
    expect(indexLabels("## Methods {#sec-methods}")).toEqual([
      { id: "sec-methods", kind: "sec", line: 0, column: 13 },
    ]);
  });

  it("G2: Source 2 — a cell-option label is untouched", () => {
    const text = ["```{r}", "#| label: fig-cell", "plot(1)", "```"].join("\n");
    expect(indexLabels(text)).toEqual([
      { id: "fig-cell", kind: "fig", line: 1, column: 10 },
    ]);
  });

  it("G3: display math keeps its id, with and without the space", () => {
    // ⚠ Quarto's `eq-` cross-reference is NOT the pandoc attribute parser — measured this
    // session, `scratchpad/s222/cal/math.qmd`. Both spellings define (m01/m08).
    expect(indexLabels("$$ y = x $$ {#eq-m}")).toEqual([
      { id: "eq-m", kind: "eq", line: 0, column: 14 },
    ]);
    expect(indexLabels("$$ y = x $${#eq-mn}")).toEqual([
      { id: "eq-mn", kind: "eq", line: 0, column: 13 },
    ]);
  });

  it("G4: a table caption keeps its id, bare and with a trailing class", () => {
    // Both define in quarto (`cal.qmd` g12, `n.qmd` n06).
    const bare = ["| a |", "|---|", "| 1 |", "", ": Cap {#tbl-c}"].join("\n");
    expect(indexLabels(bare)).toEqual([
      { id: "tbl-c", kind: "tbl", line: 4, column: 8 },
    ]);
    const cls = ["| a |", "|---|", "| 1 |", "", ": Cap {#tbl-cc .cls}"].join("\n");
    expect(indexLabels(cls)).toEqual([
      { id: "tbl-cc", kind: "tbl", line: 4, column: 8 },
    ]);
  });

  it("G5: ⚠ REVERSED BY SESSION 223 — a fenced code block's {#lst-…} IS now indexed", () => {
    // ⚠ **This pin asserted the DEFECT, deliberately and with its own witness**, and Session
    // 223 is the session that closes it. As written by Session 222 it read "a fenced code
    // block's {#lst-…} is not indexed — pre-existing, out of scope" and expected `[]`, noting
    // that quarto DOES define it (`scratchpad/s222/cal/p.qmd` p06 renders id="lst-p06") while
    // the fence line is a region boundary Source 3 never sees. Source 4 now sees it.
    //
    // The pin is kept rather than deleted because its ROW is still the right row — it is the
    // shape the whole deliverable turns on — and because a reversed pin is the honest record
    // that the value changed on purpose (Session 221's precedent, the reversed cell-label pin
    // in "cell label value robustness (review C)").
    expect(indexLabels("```{#lst-l .python}\nx = 1\n```")).toEqual([
      { id: "lst-l", kind: "lst", line: 0, column: 5 },
    ]);
  });

  it("G6: a fenced div keeps its id, with and without the space", () => {
    expect(indexLabels("::: {#fig-d}\nbody\n:::")).toEqual([
      { id: "fig-d", kind: "fig", line: 0, column: 6 },
    ]);
    expect(indexLabels(":::{#fig-dn}\nbody\n:::")).toEqual([
      { id: "fig-dn", kind: "fig", line: 0, column: 5 },
    ]);
  });

  it("G7: an image block with a quoted key=value keeps its id", () => {
    expect(indexLabels('![Cap](a.png){#fig-ik .cls key="v.w"}')).toEqual([
      { id: "fig-ik", kind: "fig", line: 0, column: 15 },
    ]);
  });

  it("G8: a {#fig-…} inside an inline code span still defines nothing", () => {
    expect(indexLabels("Use `{#fig-cs}` here")).toEqual([]);
  });

  it("G9: TWO images on one line both keep their ids", () => {
    // ⚠ Measured (`disc.qmd` w02): quarto defines BOTH. This is the row that refutes any
    // "first brace group on the line wins" rule, so it is guarded rather than assumed.
    expect(
      indexLabels("![A](a.png){#fig-x} and ![B](b.png){#fig-y}").map((l) => l.id),
    ).toEqual(["fig-x", "fig-y"]);
  });

  it("G10: an inline {#sec-…} stays excluded — sections are owned by headings", () => {
    expect(indexLabels("::: {#sec-aside}")).toEqual([]);
  });

  it("G11: an indented image keeps its column arithmetic", () => {
    expect(indexLabels("    ![Cap](a.png){#fig-ind}")).toEqual([
      { id: "fig-ind", kind: "fig", line: 0, column: 19 },
    ]);
  });

  it("G12: document order and first-definition-wins are unchanged", () => {
    const text = [
      "![B](b.png){#fig-b}",
      "![A](a.png){#fig-a}",
      "![B again](b2.png){#fig-b}",
    ].join("\n");
    expect(indexLabels(text).map((l) => `${l.id}@${l.line}`)).toEqual([
      "fig-b@0",
      "fig-a@1",
    ]);
  });

  it("G13: SCOPE PIN — the second of two adjacent blocks stays indexed", () => {
    // ⚠ A separate filed backlog item (S221's #3), deliberately NOT in this session's
    // deliverable. Quarto defines only `fig-a05.x`. Pinned so the block-aware scan is seen
    // to leave it exactly where it was rather than closing it as a bonus (FM #17/#26).
    expect(
      indexLabels("![p](p.png){#fig-a05.x}{#fig-a05b.y}").map((l) => l.id),
    ).toEqual(["fig-a05.x", "fig-a05b.y"]);
  });
});

describe("Session 222 adversarial pins — rows aimed at THIS session's own rule", () => {
  // The adversarial corpus (`scratchpad/s222/adv/adv.qmd`, 9 rows + 3 follow-ups in
  // `adv2.qmd`, rendered through quarto 1.7.33) was written against the GEOMETRY this session
  // introduced rather than against quarto. It scored 7/9 -> 7/9: FIXED 0, INTRODUCED 0, and
  // the same two rows wrong before and after — both phantoms, both pre-existing.

  it("Z1: the adjacency test computes the right `)`, on three shapes designed to fool it", () => {
    // A link TITLE before the closer, an image nested inside a link, and a `)` inside the URL
    // itself. All three define in quarto (adv.qmd z01/z02/z07) and all three are found here.
    expect(indexLabels('![Cap](a.png "A title"){#fig-z01}').map((l) => l.id)).toEqual([
      "fig-z01",
    ]);
    expect(
      indexLabels("[![Cap](a.png)](https://example.com){#fig-z02}").map((l) => l.id),
    ).toEqual(["fig-z02"]);
    expect(indexLabels("[Cap](a(b).png){#fig-z07}").map((l) => l.id)).toEqual([
      "fig-z07",
    ]);
  });

  it("Z2: a div opener with FOUR colons, and one with trailing spaces, both keep their id", () => {
    // `:{3,}` and the `\s*$` tail are both measured (adv.qmd z03/z08), not defensive slack.
    expect(indexLabels(":::: {#fig-z03}\nbody\n::::").map((l) => l.id)).toEqual([
      "fig-z03",
    ]);
    expect(indexLabels("::: {#fig-z08}   \nbody\n:::").map((l) => l.id)).toEqual([
      "fig-z08",
    ]);
  });

  it("Z3: an ESCAPED closing brace inside a value does not end the group", () => {
    // ⚠ This row was written expecting a MISS — the group scanner is quote-aware but not
    // escape-aware, so it ends the group at the `\}`. It passes anyway, because the truncated
    // content `#fig-z06 key=a\` is still a valid token pair (`ATTR_KEY_VALUE`'s bare value
    // admits a backslash). Quarto defines `fig-z06` (adv.qmd z06) and so does this. Pinned
    // BECAUSE it is right for a reason the rule does not state: a value whose escaped brace is
    // followed by something that breaks the token would diverge, and no rendered row covers
    // that yet.
    expect(indexLabels("![Cap](a.png){#fig-z06 key=a\\}b}").map((l) => l.id)).toEqual([
      "fig-z06",
    ]);
  });

  it("Z4: DISCLOSED RESIDUAL — a top-level INDENTED div opener is a phantom", () => {
    // ⚠ **AND THE FIX IS MEASURED TO BE WORSE, WHICH IS WHY THIS IS PINNED RATHER THAN
    // CLOSED.** `  ::: {#fig-z11}` and `   ::: {#fig-z12}` at top level render their braces
    // as literal text and define nothing (`adv.qmd` z04, `adv2.qmd` z11/z12), so the leading
    // `\s*` in `isAttributeBlock` over-fires. But an indented div INSIDE A LIST ITEM does
    // define — `- item` / blank / `  ::: {#fig-z10}` renders id="fig-z10" (`adv2.qmd` z10) —
    // and that is an everyday quarto shape. The distinguishing fact is the enclosing block,
    // which this per-line scanner cannot see, so the honest choice is an approximation with a
    // DECLARED failure direction: over-fire into the phantom direction (a spurious completion
    // offer) rather than under-fire into the lost-TP direction (a real target that navigation
    // cannot reach). PRE-EXISTING and unchanged — both builds return `fig-z11`.
    expect(indexLabels("  ::: {#fig-z11}\nbody\n:::").map((l) => l.id)).toEqual([
      "fig-z11",
    ]);
    expect(indexLabels("- item\n\n  ::: {#fig-z10}\n  body\n  :::").map((l) => l.id)).toEqual([
      "fig-z10",
    ]);
  });

  it("Z5: DISCLOSED RESIDUAL — a `]` that closes no span still reads as adjacency", () => {
    // `plain z05]{#fig-z05}` defines nothing in quarto (adv.qmd z05) — there is no bracketed
    // span, so the braces are text. `isAttributeBlock` tests only the character before the
    // group, so it treats the `]` as a span's closer. The same shape one production over is
    // `(plain paren){#fig-w03}` (`cal/disc.qmd` w03). Closing either needs real bracket/link
    // matching, which is a different deliverable. PRE-EXISTING and unchanged in effect — both
    // builds index it, the pre-change build through the unvalidated scan instead.
    expect(indexLabels("plain z05]{#fig-z05}").map((l) => l.id)).toEqual(["fig-z05"]);
    expect(indexLabels("(plain paren){#fig-w03}").map((l) => l.id)).toEqual(["fig-w03"]);
  });
});

// ── Session 223 GUARD ────────────────────────────────────────────────────────
// Written and confirmed GREEN **before** the implementation (S204's gotcha 5, inherited a
// TWENTIETH time). This deliverable is a WIDENING — a fourth definition source starts
// contributing labels — which is the INVERSE polarity of Session 222's, so the guard is per
// source-that-must-not-move and per shape-that-must-NOT-start-defining. Every expected value
// below is the value the pre-change build produced, re-run at the moment of writing.

describe("Session 223 GUARD — shapes that must NOT move when fence openers join the index", () => {
  it("H1: Source 1 — a heading's sec- id is untouched", () => {
    expect(indexLabels("## Methods {#sec-methods}")).toEqual([
      { id: "sec-methods", kind: "sec", line: 0, column: 13 },
    ]);
  });

  it("H2: Source 2 — a cell-option label is untouched", () => {
    const text = ["```{r}", "#| label: fig-cell", "plot(1)", "```"].join("\n");
    expect(indexLabels(text)).toEqual([{ id: "fig-cell", kind: "fig", line: 1, column: 10 }]);
  });

  it("H3: Source 3 — an image's attribute block is untouched", () => {
    expect(indexLabels('![Cap](a.png){#fig-i .cls key="v.w"}')).toEqual([
      { id: "fig-i", kind: "fig", line: 0, column: 15 },
    ]);
  });

  it("H4: Source 3 — display math and a table caption are untouched", () => {
    expect(indexLabels("$$ y = x $$ {#eq-m}")).toEqual([
      { id: "eq-m", kind: "eq", line: 0, column: 14 },
    ]);
    const cap = ["| a |", "|---|", "| 1 |", "", ": Cap {#tbl-c}"].join("\n");
    expect(indexLabels(cap)).toEqual([{ id: "tbl-c", kind: "tbl", line: 4, column: 8 }]);
  });

  it("H5: Source 3 — a fenced div is untouched", () => {
    expect(indexLabels("::: {#fig-d}\nbody\n:::")).toEqual([
      { id: "fig-d", kind: "fig", line: 0, column: 6 },
    ]);
  });

  it("H6: an info string quarto INTERCEPTS must never define", () => {
    // ⚠ The stage-1 gate, and it is quarto's rather than pandoc's: a brace-LED info string
    // holding neither `.` nor `=` renders `<pre class="{#lst-h06}">` — the braces become a
    // literal CLASS and no id exists (rendered, `scratchpad/s223/cal/sv.qmd` s03 and 22 more
    // rows across `t.qmd`/`u.qmd`). Bare pandoc defines `id="lst-h06"` from the same bytes,
    // so this row is exactly where porting pandoc's grammar would mint a phantom.
    expect(indexLabels("```{#lst-h06}\nx = 1\n```")).toEqual([]);
    expect(indexLabels("```{#lst-h06a #lst-h06b}\nx = 1\n```")).toEqual([]);
    expect(indexLabels("```{#lst-h06:x}\nx = 1\n```")).toEqual([]);
  });

  it("H7: a CELL fence carrying an id in its info string must never define", () => {
    // ⚠ Measured: ```{python #lst-h07} and ```{r #lst-h07r} render with quarto's own cb1/cb2
    // ids and the `#lst-…` is DROPPED (`scratchpad/s223/cal/q8b.qmd`). Source 2's cell-option
    // path owns cells; this source is for PLAIN fences only.
    expect(indexLabels("```{python #lst-h07}\nx = 1\n```")).toEqual([]);
    expect(indexLabels("```{r #lst-h07r}\nx <- 1\n```")).toEqual([]);
  });

  it("H8: SCOPE PIN — an UNTERMINATED fence line is a PHANTOM this session does not close", () => {
    // ⚠ Not a guard row: this one was RED when the guard block was written, which is how the
    // phantom was found. A fence opens only if it is closed below (Session 179's measured
    // rule), so this line is ordinary BODY text — and quarto renders it as exactly that,
    // braces included: `<p>```{#lst-q07 .python} x = 7</p>`, defining nothing
    // (`scratchpad/s223/cal/q7.qmd`).
    //
    // The label nevertheless appears, and it comes from SOURCE 3, not from this session's
    // source: the character before the group is a backtick, so `isAttributeBlock` is false and
    // the unvalidated `NARROW_LABEL` scan mints it. That is precisely the already-filed item
    // "a `{#fig-…}` group with nothing in front of it to carry attributes is still indexed"
    // (BACKLOG, filed by Session 222) seen on a fence line, so closing it here would be a
    // SECOND deliverable. PRE-EXISTING and deliberately unchanged — Source 4 never sees this
    // line, because it is not a fence opener.
    expect(indexLabels("```{#lst-h08 .python}\nx = 1\n")).toEqual([
      { id: "lst-h08", kind: "lst", line: 0, column: 5 },
    ]);
  });

  it("H9: a fence line inside a WIDER fence, or inside an HTML comment, must never define", () => {
    // Both render inert (`q.qmd` q12/q13) and both are already region-scanner facts.
    const nested = ["`````", "```{#lst-h09 .python}", "x = 1", "```", "`````"].join("\n");
    expect(indexLabels(nested)).toEqual([]);
    const commented = ["<!--", "```{#lst-h09c .python}", "x = 1", "```", "-->"].join("\n");
    expect(indexLabels(commented)).toEqual([]);
  });

  it("H10: an attribute block in a code block's BODY must never define", () => {
    expect(indexLabels("```{.python}\n![Cap](a.png){#fig-h10}\n```")).toEqual([]);
  });

  it("H11: SCOPE PIN — a sec- id on a fence stays Source 1's, so it is not indexed", () => {
    // ⚠ Quarto really DEFINES it: ```{#sec-h11 .python} renders id="sec-h11" (rendered,
    // `scratchpad/s223/cal/r.qmd` r10). It is excluded for the same reason Source 3 excludes
    // it — section labels are owned by headings — and the row is pinned rather than silently
    // absorbed. ⚠ Note the resolve column does NOT argue this: `@sec-r10` renders `?@sec-r10`,
    // and so does `@fig-r11`, whose kind this source DOES index.
    expect(indexLabels("```{#sec-h11 .python}\nx = 1\n```")).toEqual([]);
  });

  it("H12: SCOPE PIN — a top-level INDENTED fence is a PHANTOM this session does not close", () => {
    // ⚠ The other row that was RED when the guard was written, and the same mechanism as H8.
    // A 4-space-indented fence at top level is CommonMark indented code, not a fence: quarto
    // renders the fence line verbatim inside a `<pre>` (`scratchpad/s223/cal/sv.qmd` s12) and
    // defines nothing. The line is therefore body text, and Source 3's unvalidated scan mints
    // the label. PRE-EXISTING, same filed item as H8, deliberately unchanged.
    expect(indexLabels("    ```{#lst-h12 .python}\n    x = 1\n    ```")).toEqual([
      { id: "lst-h12", kind: "lst", line: 0, column: 9 },
    ]);
  });
});

describe("indexLabels — Source 4: cross-ref ids on PLAIN fenced code block openers", () => {
  it("indexes an lst- id from a fence attribute block, pointing at the id", () => {
    //                  0123456789...
    //                  ```{#lst-c1 .python}
    expect(indexLabels("```{#lst-c1 .python}\nx = 1\n```")).toEqual([
      { id: "lst-c1", kind: "lst", line: 0, column: 5 },
    ]);
  });

  it("refuses a block that does not END the info string", () => {
    // ⚠ Measured: ```` ```{#lst-d10 .python} extra ```` is not a fenced code block AT ALL —
    // pandoc's parse of the info string fails, so the backticks are read as an inline code
    // span and the rendered document holds `<p><code>{#lst-d10 .python} extra x = 10</code>`
    // with no id anywhere (`scratchpad/s223/cal/disc.qmd` d10). Our region scanner does open a
    // region here, which is a separate and wider question, so the refusal belongs to this
    // production: an attribute block that does not end the info string is not the block.
    expect(indexLabels("```{#lst-d10 .python} extra\nx = 10\n```")).toEqual([]);
  });

  it("takes the LAST brace group when the info string carries two", () => {
    // ⚠ Measured, and it is the SAME answer under both readers, which is why this is one rule
    // rather than a reader split: ```` ```{#lst-z07a}{#lst-z07b .python} ```` defines
    // `lst-z07b` and renders the first group as a literal CLASS
    // (`<pre class="sourceCode python {#lst-z07a} …">`, `scratchpad/s223/adv/adv.qmd` z07),
    // and the `commonmark_x` twin does the same (`adv2.qmd` y01 → `lst-y01b`). A separating
    // SPACE changes nothing (`adv3.qmd` y02 → `lst-y02b`). The earlier group is not part of
    // the attribute block at all — it is an info-string word — so the reader split that
    // decides which ATOM wins inside a block never arises between blocks.
    //                  0         1         2
    //                  0123456789012345678901234567890
    //                  ```{#lst-z07a}{#lst-z07b .python}
    expect(indexLabels("```{#lst-z07a}{#lst-z07b .python}\nx = 7\n```")).toEqual([
      { id: "lst-z07b", kind: "lst", line: 0, column: 16 },
    ]);
  });

  it("refuses a block preceded by MORE than one info-string word", () => {
    // ⚠ The row that bounds the rule one line above, and it was found by the adversarial pass
    // rather than designed: ```` ```{#lst-y03a .cls}{#lst-y03b} ```` is not a fenced code
    // block at all — pandoc's info-string parse fails and the whole thing renders as an
    // inline code span, `<p><code>{#lst-y03a .cls}{#lst-y03b} x = 3</code></p>`
    // (`scratchpad/s223/adv/adv3.qmd` y03) — because the text before the block is TWO words.
    // One word is fine and is measured three ways (`python {#lst-d09}`, `.python {#lst-r07}`,
    // `{#lst-z07a}{#lst-z07b .python}`); two is not.
    expect(indexLabels("```{#lst-y03a .cls}{#lst-y03b}\nx = 3\n```")).toEqual([]);
  });
});

describe("Session 223 PINS — Source 4 behaviours that came free, declared rather than cycled", () => {
  // ⚠ Every row here was measured against a real `quarto render` (quarto 1.7.33,
  // `scratchpad/s223/cal/` and `adv/`) and every one was ALREADY GREEN when first written:
  // they fall out of the two layers rather than being separate clauses, so they are declared
  // PINS, not RED->GREEN cycles (Session 221's convention for a red that comes up green).

  it("P1: ⚠ the READER SPLIT reaches this production, so it is carried rather than declared", () => {
    // `{#lst-x3a #lst-x3b .python}` defines the LAST atom under the pandoc family and the
    // FIRST under commonmark_x (rendered: `scratchpad/s223/cal/rd_md.qmd`, `rd_cmx.qmd`) —
    // the split Session 219 measured on headings and Session 222 on inline blocks. Session
    // 222 shipped a regression by declaring this one rather than implementing it; here it
    // comes free, because `attributeBlockId` takes the reader.
    const pandoc = "```{#lst-x3a #lst-x3b .python}\nx\n```";
    expect(indexLabels(pandoc)).toEqual([
      { id: "lst-x3b", kind: "lst", line: 0, column: 14 },
    ]);
    const cmx = [
      "---", "title: T", "format:", "  html:", "    from: commonmark_x", "---", "",
      "```{#lst-x3a #lst-x3b .python}", "x", "```",
    ].join("\n");
    expect(indexLabels(cmx)).toEqual([
      { id: "lst-x3a", kind: "lst", line: 7, column: 5 },
    ]);
  });

  it("P2: the fence CHARACTER and its length are irrelevant", () => {
    // `~~~{#lst-s08 .python}` and a four-backtick fence both define (`sv.qmd` s08,
    // `disc.qmd` d11) — this reuses the region scanner's fence geometry rather than
    // re-deriving it.
    expect(indexLabels("~~~{#lst-t .python}\nx\n~~~")).toEqual([
      { id: "lst-t", kind: "lst", line: 0, column: 5 },
    ]);
    expect(indexLabels("````{#lst-f .python}\nx\n````")).toEqual([
      { id: "lst-f", kind: "lst", line: 0, column: 6 },
    ]);
  });

  it("P3: a fence inside a blockquote, a list item or a div defines, and the column follows", () => {
    // Rendered: `q.qmd` q09 (blockquote), `sv.qmd` s09 and `adv.qmd` z11 (list item),
    // `adv.qmd` z03 (inside a fenced div).
    expect(indexLabels("> ```{#lst-bq .python}\n> x\n> ```")).toEqual([
      { id: "lst-bq", kind: "lst", line: 0, column: 7 },
    ]);
    expect(indexLabels("- item\n\n  ```{#lst-li .python}\n  x\n  ```")).toEqual([
      { id: "lst-li", kind: "lst", line: 2, column: 7 },
    ]);
    expect(indexLabels("::: {.panel}\n\n```{#lst-dv .python}\nx\n```\n\n:::")).toEqual([
      { id: "lst-dv", kind: "lst", line: 2, column: 5 },
    ]);
  });

  it("P4: the id need not come first in the block", () => {
    // `{.python #lst-s02}` defines (`sv.qmd` s02) — this production is not the narrow
    // display-math one, where anything beyond a bare id renders as text.
    expect(indexLabels("```{.python #lst-pi}\nx\n```")).toEqual([
      { id: "lst-pi", kind: "lst", line: 0, column: 13 },
    ]);
  });

  it("P5: a NON-brace-led info string escapes quarto's stage-1 gate", () => {
    // ```` ```python {#lst-d09} ```` and ```` ```.python {#lst-r07} ```` both define although
    // their braces hold neither `.` nor `=` (`disc.qmd` d09, `r.qmd` r07): the gate applies
    // only when the info string BEGINS with `{`.
    expect(indexLabels("```python {#lst-wl}\nx\n```")).toEqual([
      { id: "lst-wl", kind: "lst", line: 0, column: 12 },
    ]);
    expect(indexLabels("```.python {#lst-dw}\nx\n```")).toEqual([
      { id: "lst-dw", kind: "lst", line: 0, column: 13 },
    ]);
  });

  it("P6: ⚠ the stage-1 gate is LEXICAL — a `.` inside the IDENTIFIER releases it", () => {
    // `{#lst-t01.b}` defines `lst-t01.b` with no class at all (`t.qmd` t01), while
    // `{#lst-t02:b}` — the same shape with a colon — is intercepted and defines nothing
    // (t02). So the gate cannot be restated as "the block must carry a class or a key".
    expect(indexLabels("```{#lst-di.b}\nx\n```")).toEqual([
      { id: "lst-di.b", kind: "lst", line: 0, column: 5 },
    ]);
    expect(indexLabels("```{#lst-di:b}\nx\n```")).toEqual([]);
  });

  it("P7: the group scan is quote-aware, and a `$` fails the whole block", () => {
    // `{#lst-q06 .python key="a}b"}` defines (`q.qmd` q06): the `}` inside the quoted value
    // is content. `{#lst-q05$x .python}` defines nothing — the fence is not even a fence
    // there (q05), the failure shape being an inline code span.
    expect(indexLabels('```{#lst-qb .python key="a}b"}\nx\n```')).toEqual([
      { id: "lst-qb", kind: "lst", line: 0, column: 5 },
    ]);
    expect(indexLabels("```{#lst-do$x .python}\nx\n```")).toEqual([]);
  });

  it("P8: the identifier set is the measured one — `.`, `:`, `-` and Unicode all define", () => {
    // Rendered: `q.qmd` q01/q02/q03/q04. The class is `DEFINED_ID_CHAR_CLASS`, shared with
    // Sources 2 and 3 because all three were measured to ask one question, not ported.
    expect(indexLabels("```{#lst-c:x .python}\nx\n```").map((l) => l.id)).toEqual(["lst-c:x"]);
    expect(indexLabels("```{#lst-ué .python}\nx\n```").map((l) => l.id)).toEqual(["lst-ué"]);
  });

  it("P9: fig-, tbl- and eq- ids on a fence are indexed too", () => {
    // Quarto defines them (`sv.qmd` s06, `r.qmd` r11) and the index records DEFINITIONS
    // rather than reachability — `@fig-r11` does NOT resolve, and neither does `@lst-s01`
    // without an `lst-cap`, which is exactly the precedent Sessions 221 and 222 set with
    // `fig-plot.`. Only `sec-` is excluded, and that is Source 1's ownership (H11).
    expect(indexLabels("```{#fig-fk .python}\nx\n```")).toEqual([
      { id: "fig-fk", kind: "fig", line: 0, column: 5 },
    ]);
    expect(indexLabels("```{#eq-ek .python}\nx\n```")).toEqual([
      { id: "eq-ek", kind: "eq", line: 0, column: 5 },
    ]);
  });

  it("P10: a bare key=value releases the gate, and lst-cap is irrelevant to the id", () => {
    // `{#lst-d02 key=v}` defines with no class present at all (`disc.qmd` d02), and
    // `{#lst-d14 lst-cap="Cap d14"}` defines the same id it would without the caption (d14).
    // ⚠ The caption is what makes the block a RESOLVABLE listing cross-reference — `@lst-s01`
    // renders `?@lst-s01` while `@lst-r12` renders `Listing 1` — and it changes nothing here.
    expect(indexLabels("```{#lst-kv key=v}\nx\n```")).toEqual([
      { id: "lst-kv", kind: "lst", line: 0, column: 5 },
    ]);
    expect(indexLabels('```{#lst-kv .python lst-cap="C"}\nx\n```')).toEqual([
      { id: "lst-kv", kind: "lst", line: 0, column: 5 },
    ]);
  });
});
