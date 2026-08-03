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
