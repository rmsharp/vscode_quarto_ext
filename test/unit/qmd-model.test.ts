import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOutline,
  findAllCells,
  findBodyLines,
  findCellAtPosition,
  findHeadings,
  hideCellsInOutline,
} from "../../src/core/qmd/model";

describe("findHeadings — basic ATX parsing", () => {
  it("returns no headings for plain prose", () => {
    const text = ["Just prose.", "", "No headings here."].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("finds a single level-1 heading with text and 0-based line", () => {
    const text = ["# Title", "", "prose"].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 1, text: "Title", line: 0 }]);
  });

  it("captures the level from the number of leading hashes (1-6)", () => {
    const text = [
      "# One", // 0
      "## Two", // 1
      "### Three", // 2
      "###### Six", // 3
    ].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "One", line: 0 },
      { level: 2, text: "Two", line: 1 },
      { level: 3, text: "Three", line: 2 },
      { level: 6, text: "Six", line: 3 },
    ]);
  });
});

describe("findHeadings — ATX edge rules (CommonMark)", () => {
  it("refuses 1-3 spaces of leading indentation — quarto is NOT CommonMark here (Session 199)", () => {
    // ⚠ THIS TEST ASSERTED THE OPPOSITE UNTIL SESSION 199, AND IT WAS WRONG FROM THE START:
    // it was written from the CommonMark spec (§4.2 allows up to 3 spaces) rather than from a
    // render. Quarto's pandoc markdown reader gives an ATX heading NO leading-space slack at
    // all. RE-RENDERED on these exact bytes before the flip and read off the raw HTML, not
    // through an extractor (`scratchpad/s199/cm/cm_first3.qmd`):
    //
    //     `   ### Indented three`   ->   <p>### Indented three</p>      LITERAL TEXT
    //     `### No indent first`     ->   <h3>No indent first</h3>       a heading
    //
    // 1, 2 and 3 spaces all render the paragraph, as the whole document and equally with a
    // paragraph above (`cm_first1`, `cm_first2`, `cm_after3`). The indent must EQUAL an open
    // content column — see `atxHeadingMatch`.
    const text = ["   ### Indented three"].join("\n");
    expect(findHeadings(text)).toEqual([]);
    // CONTROL — the same heading at column 0, which quarto DOES render.
    expect(findHeadings(["### No indent first"].join("\n"))).toEqual([
      { level: 3, text: "No indent first", line: 0 },
    ]);
  });

  it("treats 4+ spaces of indentation as code, not a heading", () => {
    const text = ["    # Four spaces is indented code"].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("strips an optional closing sequence of hashes", () => {
    const text = ["## Centered ##", "### Trailing  #######"].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 2, text: "Centered", line: 0 },
      { level: 3, text: "Trailing", line: 1 },
    ]);
  });

  it("keeps a hash that is part of the text (not a space-led closing run)", () => {
    const text = ["# C# language"].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "C# language", line: 0 },
    ]);
  });

  it("requires a space after the hashes (so #hashtag is not a heading)", () => {
    const text = ["#hashtag is prose"].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("does not treat 7+ hashes as a heading (max level is 6)", () => {
    const text = ["####### Too deep"].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });
});

describe("findHeadings — setext headings", () => {
  it("recognizes a single-line paragraph underlined with `=` as a level-1 heading", () => {
    const text = ["Title", "====="].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 1, text: "Title", line: 0 }]);
  });

  it("recognizes a single-line paragraph underlined with `-` as a level-2 heading", () => {
    const text = ["Subtitle", "--------"].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 2, text: "Subtitle", line: 0 }]);
  });

  it("accepts a single `=`/`-` character as a valid underline (any run length)", () => {
    const text = ["One dash", "-"].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 2, text: "One dash", line: 0 }]);
  });

  it("treats a `---` after a blank line as a thematic break, not a setext underline", () => {
    // Confirmed against the real Quarto CLI: a blank line breaks paragraph
    // continuity, so the dashes render as <hr>, not a heading.
    const text = ["Paragraph.", "", "---", "", "More."].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("does not promote a 2+-line paragraph to a setext heading", () => {
    // Confirmed against the real Quarto CLI (`pandoc -f markdown`, the reader
    // .qmd files actually use): unlike gfm/commonmark, a multi-line paragraph
    // followed by an underline stays a plain paragraph with the underline as
    // literal trailing text — it does NOT collapse into one heading.
    const text = ["Line one", "Line two", "========"].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("does not treat a lone underline with no preceding paragraph as a heading", () => {
    const text = ["First paragraph.", "", "====="].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("does not re-interpret the line after an ATX heading as setext content", () => {
    // A deliberate, documented divergence from Pandoc's own surprising
    // behavior here (verified: Pandoc actually swallows "# Heading\n---" into
    // a level-2 heading with a literal "#" — see PROJECT_LEARNINGS.md). This
    // model keeps the already-established, tested ATX heading and leaves the
    // following underline unclassified rather than risk regressing ATX
    // detection for a rare, arguably malformed adjacency.
    const text = ["# ATX Heading", "---", "After."].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 1, text: "ATX Heading", line: 0 }]);
  });

  it("recognizes a setext heading immediately after front matter closes", () => {
    const text = ["---", "title: T", "---", "Heading", "---"].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 2, text: "Heading", line: 3 }]);
  });

  it("ignores a setext-underline-shaped line inside a code fence", () => {
    const text = ["```", "not a heading", "---", "```"].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("strips a trailing {#id} attribute block, keeping the id structurally", () => {
    const text = ["Methods {#sec-methods}", "======="].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "Methods", line: 0, id: "sec-methods" },
    ]);
  });

  it("does not strip a trailing closing-hash-like run (no ATX convention for setext)", () => {
    const text = ["Heading ##", "======="].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 1, text: "Heading ##", line: 0 }]);
  });

  it("STRIPS the marker of a single bullet-list item and promotes it (Session 201)", () => {
    // ⚠ FLIPPED BY SESSION 201, AND THE OLD ASSERTION'S OWN COMMENT IS WHY. It read:
    //
    //   "Confirmed against the real Quarto CLI: `- solo item\n---` renders as
    //    `<li><h2>solo item</h2></li>` — Pandoc strips the "- " marker and nests the heading
    //    INSIDE the list. This model tracks no list context, so emitting a top-level heading
    //    here would be wrong on two counts: the literal "- " marker would leak into the text,
    //    and the heading wouldn't really be a document-level section. Declining (a false
    //    negative) is the safe direction, consistent with this project's established preference."
    //
    // The HTML in that comment is EXACTLY RIGHT — re-rendered on these same bytes through
    // quarto 1.7.33 (`scratchpad/s201/pins`, `p0_dash_solo`), the raw output is
    // `<ul><li><h2 id="solo-item" class="anchored">solo item</h2></li></ul>`. What does not
    // follow is the conclusion. Both stated costs were avoidable: the marker leaks only if the
    // text is passed through unstripped, and "not really a document-level section" is a claim
    // about the OUTLINE's shape that this model does not make anywhere else (it reports headings
    // inside block quotes, fenced divs and callouts without qualification). What was actually
    // shipped for eleven sessions' worth of setext work was a DELETED heading — one quarto
    // renders, in a document with no container at all.
    //
    // The safe-direction argument is the part worth keeping and it points the other way: a
    // heading quarto renders and we do not is exactly the false negative this project's doctrine
    // spends phantoms to avoid.
    const text = ["- solo item", "---"].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 2, text: "solo item", line: 0 }]);
  });

  it("STRIPS `*` and `+` bullet markers too (Session 201)", () => {
    // Re-rendered on these exact bytes: `p1_star_solo` and `p2_plus_solo` both render
    // `<h2>solo item</h2>`, so the marker CHARACTER makes no difference to the strip. (It does
    // make one to the thematic-break exception below — `- - -` and `* * *` are breaks where
    // `+ + +` is not — which is why that is a separate, separately measured rule.)
    expect(findHeadings(["* solo item", "---"].join("\n"))).toEqual([
      { level: 2, text: "solo item", line: 0 },
    ]);
    expect(findHeadings(["+ solo item", "---"].join("\n"))).toEqual([
      { level: 2, text: "solo item", line: 0 },
    ]);
  });

  it("still promotes an ordered-list-marker-shaped line (Pandoc keeps it literal, no nesting)", () => {
    // Confirmed: unlike a bullet marker, "1. first\n---" does NOT nest inside
    // an <ol> — Pandoc keeps "1. first" as literal heading text. No guard
    // needed; the general mechanism already matches this real behavior.
    const text = ["1. first", "---"].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 2, text: "1. first", line: 0 }]);
  });

  it("still promotes a blockquote-marker-shaped line (Pandoc keeps it literal, no nesting)", () => {
    // Confirmed: "> quoted\n---" does NOT nest inside a <blockquote> either —
    // Pandoc keeps "> quoted" as literal heading text.
    const text = ["> quoted", "---"].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 2, text: "> quoted", line: 0 }]);
  });
});

describe("buildOutline — setext headings", () => {
  it("nests a setext heading identically to an equivalent ATX heading", () => {
    const text = ["Title", "=====", "", "prose", "more"].join("\n"); // lastLine = 4
    const outline = buildOutline(text);
    expect(outline).toHaveLength(1);
    expect(outline[0]).toMatchObject({
      kind: "heading",
      name: "Title",
      level: 1,
      startLine: 0,
      endLine: 4,
      selectionLine: 0,
      children: [],
    });
  });

  it("mixes ATX and setext headings in the same nested outline", () => {
    const text = [
      "Title", // 0
      "=====", // 1
      "## ATX Sub", // 2
      "Setext Sub", // 3
      "----------", // 4
    ].join("\n");
    const [title] = buildOutline(text);
    expect(title).toMatchObject({ name: "Title", level: 1, startLine: 0 });
    expect(title.children.map((c) => [c.name, c.level, c.startLine])).toEqual([
      ["ATX Sub", 2, 2],
      ["Setext Sub", 2, 3],
    ]);
  });
});

describe("findHeadings — fence awareness", () => {
  it("ignores a `#` comment inside a {python} executable cell", () => {
    const text = [
      "# Real heading", // 0
      "```{python}", // 1
      "# this is a python comment, not a heading", // 2
      "#| echo: false", // 3  cell option
      "x = 1", // 4
      "```", // 5
      "## After the cell", // 6
    ].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "Real heading", line: 0 },
      { level: 2, text: "After the cell", line: 6 },
    ]);
  });

  it("ignores a `#` inside a plain (non-executable) ```` ``` ```` fence", () => {
    const text = [
      "```", // 0
      "# not a heading — inside a plain code fence", // 1
      "```", // 2
      "# Heading after", // 3
    ].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "Heading after", line: 3 },
    ]);
  });

  it("ignores a `#` inside a ~~~ tilde fence", () => {
    const text = ["~~~", "# inside tilde fence", "~~~"].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("ignores a `#` inside a nested (longer) outer fence", () => {
    const text = [
      "````", // 0 outer fence (4 backticks)
      "```{python}", // 1
      "# still inside the outer fence", // 2
      "```", // 3 cannot close the 4-backtick fence
      "````", // 4 closes the outer fence
      "# Heading after", // 5
    ].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "Heading after", line: 5 },
    ]);
  });
});

describe("findHeadings — YAML front matter", () => {
  it("ignores a `#` comment inside the leading front matter block", () => {
    const text = [
      "---", // 0
      "title: Doc", // 1
      "# a yaml comment, not a heading", // 2
      "---", // 3
      "", // 4
      "# Real heading", // 5
    ].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "Real heading", line: 5 },
    ]);
  });

  it("accepts `...` as the front-matter terminator", () => {
    const text = [
      "---", // 0
      "# yaml comment", // 1
      "...", // 2
      "# Real heading", // 3
    ].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "Real heading", line: 3 },
    ]);
  });

  it("does not treat a `---` that is not at line 0 as front matter", () => {
    const text = [
      "# H1", // 0
      "---", // 1  thematic break, not front matter
      "# H2", // 2
    ].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 1, text: "H1", line: 0 },
      { level: 1, text: "H2", line: 2 },
    ]);
  });
});

describe("findHeadings — Pandoc/Quarto heading attributes (review #8)", () => {
  it("strips a trailing {#sec-id} section identifier but keeps it structurally", () => {
    expect(findHeadings("## Methods {#sec-methods}")).toEqual([
      { level: 2, text: "Methods", line: 0, id: "sec-methods" },
    ]);
  });

  it("strips a {#id .class} attribute block but keeps the id structurally", () => {
    expect(findHeadings("# Introduction {#sec-intro .unnumbered}")).toEqual([
      { level: 1, text: "Introduction", line: 0, id: "sec-intro" },
    ]);
  });

  it("captures a non-cross-ref {#id} structurally (kind-agnostic at the model layer)", () => {
    expect(findHeadings("## Background {#my-background}")).toEqual([
      { level: 2, text: "Background", line: 0, id: "my-background" },
    ]);
  });

  it("strips a class-only {.tabset} attribute block", () => {
    expect(findHeadings("## Results {.tabset}")).toEqual([
      { level: 2, text: "Results", line: 0 },
    ]);
  });

  it("drops a heading that is nothing but an attribute block", () => {
    expect(findHeadings("## {#sec-only}")).toEqual([]);
  });

  it("keeps a brace group that is not a trailing attribute block", () => {
    expect(findHeadings("# Use {braces} mid-title here")).toEqual([
      { level: 1, text: "Use {braces} mid-title here", line: 0 },
    ]);
  });
});

describe("findHeadings — empty closing-hash headings (review #4)", () => {
  it("drops a heading whose content is only a closing hash run", () => {
    expect(findHeadings(["## ##", "### ###", "#### #"].join("\n"))).toEqual([]);
  });

  it("still keeps real text before a closing hash run", () => {
    expect(findHeadings("## Centered ##")).toEqual([
      { level: 2, text: "Centered", line: 0 },
    ]);
  });
});

describe("findBodyLines — content lines outside skip-regions", () => {
  it("excludes front matter, HTML comments, and code-fence lines; keeps prose and headings", () => {
    const text = [
      "---", // 0  front matter open
      "title: T", // 1  front matter
      "---", // 2  front matter close
      "# Heading", // 3  body (heading line)
      "", // 4  body (blank prose)
      "<!--", // 5  comment open
      "hidden", // 6  comment body
      "-->", // 7  comment close
      "prose line", // 8  body
      "```{python}", // 9  fence open (excluded)
      "x = 1", // 10 fence content (excluded)
      "```", // 11 fence close (excluded)
      "after", // 12 body
    ].join("\n");
    expect(findBodyLines(text)).toEqual([
      { line: 3, text: "# Heading" },
      { line: 4, text: "" },
      { line: 8, text: "prose line" },
      { line: 12, text: "after" },
    ]);
  });

  it("keeps a line with real content between two same-line comments (review J)", () => {
    // Only a WHOLE-line comment is excluded; a line that merely starts and ends
    // with comments but has prose between renders that prose, so it stays body.
    const text = "<!-- a --> mid prose <!-- b -->";
    expect(findBodyLines(text)).toEqual([{ line: 0, text }]);
  });

  it("still excludes a genuine whole-line single comment", () => {
    expect(findBodyLines("  <!-- just a comment -->  ")).toEqual([]);
  });
});

describe("buildOutline — nested symbol tree", () => {
  it("returns no symbols for plain prose", () => {
    expect(buildOutline("Just prose.\n\nMore prose.")).toEqual([]);
  });

  it("returns a single root heading whose range spans to end of document", () => {
    const text = ["# Only", "prose", "more"].join("\n"); // lastLine = 2
    const outline = buildOutline(text);
    expect(outline).toHaveLength(1);
    expect(outline[0]).toMatchObject({
      kind: "heading",
      name: "Only",
      level: 1,
      startLine: 0,
      endLine: 2,
      selectionLine: 0,
      children: [],
    });
  });

  it("nests sub-headings under their parent and ends a section at the next same-or-higher heading", () => {
    const text = [
      "# A", // 0
      "## B", // 1
      "## C", // 2
    ].join("\n");
    const [a] = buildOutline(text);
    expect(a).toMatchObject({ name: "A", level: 1, startLine: 0, endLine: 2 });
    expect(a.children.map((c) => [c.name, c.startLine, c.endLine])).toEqual([
      ["B", 1, 1],
      ["C", 2, 2],
    ]);
  });

  it("starts a new top-level section when a heading of equal/higher level follows", () => {
    const text = ["# A", "## B", "# C"].join("\n");
    const roots = buildOutline(text);
    expect(roots.map((r) => r.name)).toEqual(["A", "C"]);
    expect(roots[0].children.map((c) => c.name)).toEqual(["B"]);
  });

  it("nests a heading even when an intermediate level is skipped", () => {
    const text = ["# A", "### C"].join("\n");
    const [a] = buildOutline(text);
    expect(a.children.map((c) => [c.name, c.level])).toEqual([["C", 3]]);
  });

  it("nests a code cell under the nearest preceding heading, as a leaf", () => {
    const text = [
      "# H", // 0
      "```{python}", // 1
      "x = 1", // 2
      "```", // 3
    ].join("\n");
    const [h] = buildOutline(text);
    expect(h.children).toEqual([
      {
        kind: "cell",
        name: "```{python}",
        lang: "python",
        startLine: 1,
        endLine: 3,
        selectionLine: 1,
        children: [],
      },
    ]);
  });

  it("places a cell before any heading at the top level", () => {
    const text = ["```{r}", "y <- 2", "```", "# H"].join("\n");
    const roots = buildOutline(text);
    expect(roots.map((r) => [r.kind, r.name])).toEqual([
      ["cell", "```{r}"],
      ["heading", "H"],
    ]);
  });
});

describe("hideCellsInOutline — the show/hide-cells toggle's pure filter", () => {
  it("removes a top-level cell node, keeping headings", () => {
    const text = ["```{r}", "y <- 2", "```", "# H"].join("\n");
    const roots = hideCellsInOutline(buildOutline(text));
    expect(roots.map((r) => [r.kind, r.name])).toEqual([["heading", "H"]]);
  });

  it("removes a cell nested under a heading, leaving the heading with no children", () => {
    const text = ["# H", "```{python}", "x = 1", "```"].join("\n");
    const [h] = hideCellsInOutline(buildOutline(text));
    expect(h).toMatchObject({ kind: "heading", name: "H", children: [] });
  });

  it("removes cells nested at multiple depths, preserving heading nesting", () => {
    const text = [
      "# A", // 0
      "## B", // 1
      "```{r}", // 2
      "z <- 3", // 3
      "```", // 4
    ].join("\n");
    const [a] = hideCellsInOutline(buildOutline(text));
    expect(a.children).toHaveLength(1);
    expect(a.children[0]).toMatchObject({ name: "B", children: [] });
  });

  it("is a no-op when there are no cell nodes", () => {
    const text = ["# A", "## B", "## C"].join("\n");
    const outline = buildOutline(text);
    expect(hideCellsInOutline(outline)).toEqual(outline);
  });
});

describe("region consistency — cells & headings agree on skip regions", () => {
  // review #1/#2/#5: findAllCells must honor YAML front matter, just like
  // findHeadings, or a fenced example inside a block scalar becomes a phantom
  // cell (wrong outline AND a phantom runnable cell for Phase 5).
  const frontMatterWithFence = [
    "---", // 0
    "title: Doc", // 1
    "description: |", // 2
    "  ```{python}", // 3  inside a YAML block scalar — NOT a cell
    "  not really a cell", // 4
    "  ```", // 5
    "---", // 6
    "# H", // 7
    "```{python}", // 8  a real cell
    "y = 1", // 9
    "```", // 10
  ].join("\n");

  it("findAllCells ignores a fence inside YAML front matter", () => {
    expect(findAllCells(frontMatterWithFence)).toEqual([
      { startLine: 8, endLine: 10, lang: "python", code: "y = 1" },
    ]);
  });

  it("findCellAtPosition returns null for a cursor inside front matter", () => {
    expect(findCellAtPosition(frontMatterWithFence, 4)).toBeNull();
  });

  it("buildOutline emits no phantom cell from front matter", () => {
    const roots = buildOutline(frontMatterWithFence);
    expect(roots.map((r) => [r.kind, r.name])).toEqual([["heading", "H"]]);
    expect(roots[0].children.map((c) => c.name)).toEqual(["```{python}"]);
  });

  // review #1: an HTML comment hides both headings and cells from the render.
  const withComment = [
    "# Real heading", // 0
    "", // 1
    "<!--", // 2
    "## Commented-out section", // 3
    "```{python}", // 4  also commented out — not a cell
    "x = 1", // 5
    "```", // 6
    "-->", // 7
    "", // 8
    "## After the comment", // 9
  ].join("\n");

  it("findHeadings ignores a heading inside an HTML comment block", () => {
    expect(findHeadings(withComment).map((h) => h.text)).toEqual([
      "Real heading",
      "After the comment",
    ]);
  });

  it("findAllCells ignores a fence inside an HTML comment block", () => {
    expect(findAllCells(withComment)).toEqual([]);
  });

  // review #3/#6: a 4-space-indented fence is indented code per CommonMark, not
  // a fence — it must not swallow following headings nor become a cell.
  //
  // ⚠ S178 RE-GROUNDED THE REASON THESE TWO STILL HOLD, AND IT IS NOT THE ONE ABOVE.
  // Measured against quarto 1.7.33, an indented ```` ```{r} ```` fence IS a cell: quarto
  // validates its column-0 options and knitr EXECUTES its body. What saves this fixture is
  // that its fence is never CLOSED — `breakQuartoMd` flushes an unclosed fence's lines as
  // MARKDOWN and builds no code cell, so such a document renders exit 0 and its heading
  // survives into the rendered HTML (both measured). So these pins assert quarto's real
  // behaviour for the shape they test, and the CommonMark rationale in the comment above is
  // the right answer reached by an argument that does not generalise. Do NOT read them as
  // "an indented fence is never a cell" — see the S178 block below, which pins the CLOSED
  // shapes going the other way.
  const indentedFence = [
    "Para.", // 0
    "", // 1
    "    ```{python}", // 2  4 spaces, and never closed → not a cell to quarto either
    "    x = 1", // 3
    "", // 4
    "# A Real Heading", // 5
  ].join("\n");

  it("does not treat a 4-space-indented fence as a fence (heading still found)", () => {
    expect(findHeadings(indentedFence).map((h) => h.text)).toEqual([
      "A Real Heading",
    ]);
  });

  it("does not treat a 4-space-indented ```{python} as an executable cell", () => {
    expect(findAllCells(indentedFence)).toEqual([]);
  });
});

describe("an INDENTED cell fence — quarto's rule, not CommonMark's (Session 178)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("a CLOSED 4-space-indented {r} fence IS a cell, and the closer ends it", () => {
    // Measured vs 1.7.33: quarto validates this cell's column-0 options (exit 1 on a bad
    // value, exit 0 on a good one) and knitr executes its body. `endLine` is the closing
    // fence, so the cell's `code` excludes it — the same shape a column-0 cell produces.
    expect(findAllCells(doc("    ```{r}", "1", "    ```"))).toEqual([
      { startLine: 0, endLine: 2, lang: "r", code: "1" },
    ]);
  });

  it("accepts a TAB and an 8-space indent — quarto's `^\\s*` is unbounded", () => {
    expect(findAllCells(doc("\t```{r}", "1", "\t```")).map((c) => c.lang)).toEqual(["r"]);
    expect(findAllCells(doc("        ```{r}", "1", "        ```")).map((c) => c.lang)).toEqual(["r"]);
  });

  it("does not require the closer's indent to match the opener's", () => {
    // Quarto's `endCodeRegEx` compares only the BACKTICK COUNT. Both directions measured:
    // an 8-space opener closes on a 2-space closer, and a 4-space opener on a column-0 one.
    expect(findAllCells(doc("        ```{r}", "1", "  ```")).map((c) => c.endLine)).toEqual([2]);
    expect(findAllCells(doc("    ```{r}", "1", "```")).map((c) => c.endLine)).toEqual([2]);
  });

  it("CONTROL: an indented PLAIN fence is still not a fence at all", () => {
    // ⚠ LOAD-BEARING. Quarto's plain opener is `^```` — COLUMN 0 — so only the CELL half
    // is widened. If this regressed, an indented plain fence would open a skip region and
    // swallow the heading below it, which is the Learning #14(b) defect returning by
    // another door.
    const text = doc("Para.", "", "    ```", "    text", "    ```", "", "# A Real Heading");
    expect(findAllCells(text)).toEqual([]);
    expect(findHeadings(text).map((h) => h.text)).toEqual(["A Real Heading"]);
  });

  it("CONTROL: an indented plain fence does not SWALLOW a real cell below it", () => {
    // ⚠ ADDED BY THIS SESSION'S ADVERSARIAL PASS, which found the control above passes
    // even when the CELL_INFO gate is removed — that fixture's plain fence has an INDENTED
    // closer, so a mutant looking for a 0–3-space closer finds none and declines for the
    // wrong reason. The killing shape needs a COLUMN-0 fence further down for the mutant to
    // grab: the indented plain fence then opens a region that runs to the real cell's own
    // closer and swallows it whole. Only the corpus row caught this; nothing at the unit
    // level did.
    const text = doc("Para.", "", "    ```", "    text", "    ```", "", "```{r}", "1", "```");
    expect(findAllCells(text)).toEqual([
      { startLine: 6, endLine: 8, lang: "r", code: "1" },
    ]);
  });

  it("CONTROL: an UNTERMINATED indented cell fence opens nothing", () => {
    // ⚠ THE CARDINAL-SIN GUARD, at the scanner level. Quarto builds no cell from an
    // unclosed fence (measured exit 0), so opening one would both flag a document quarto
    // ACCEPTS and swallow every heading below. The heading assertion is the half that a
    // flag-surface test cannot see.
    const text = doc("Para.", "", "    ```{r}", "1", "", "# A Real Heading");
    expect(findAllCells(text)).toEqual([]);
    expect(findHeadings(text).map((h) => h.text)).toEqual(["A Real Heading"]);
  });

  it("a COLUMN-0 unterminated cell opens nothing either (AMENDED Session 179)", () => {
    // ⚠ THIS PIN ASSERTED THE OPPOSITE UNTIL S179, DELIBERATELY. It guarded the
    // runnable-while-typing affordance so that S178 could decline to EXTEND it to indented
    // fences without silently deleting it for column-0 ones. S179 then measured the
    // affordance itself and removed it (operator-ratified): quarto builds no cell from an
    // unclosed fence at ANY indentation, and pandoc renders it as prose, so the column-0
    // and indented cases are now one rule rather than a deliberate asymmetry. What the pin
    // guards now is that the two halves stay unified — see the S179 block below.
    expect(findAllCells(doc("```{r}", "1"))).toEqual([]);
    // CONTROL: closed, it is an ordinary cell — so this cannot pass by breaking detection.
    expect(findAllCells(doc("```{r}", "1", "```")).map((c) => c.lang)).toEqual(["r"]);
  });

  it("accepts EXOTIC whitespace — the indent class is `\\s`, not `[ \\t]`", () => {
    // ⚠ ADDED BY THIS SESSION'S ADVERSARIAL PASS. Narrowing the class to `[ \t]*` — which
    // reads like a harmless tightening — survived all 1637 tests AND the whole corpus.
    // It is not harmless: quarto's own class is `\s`, and a FORM FEED, a VERTICAL TAB and
    // a NO-BREAK SPACE indent each render **exit 1** (measured firsthand), so the narrowing
    // would silently lose three real true positives. NBSP is the one that reaches real
    // documents — it is what pasting indented code out of a rendered web page produces.
    for (const ws of ["\f", "\v", " "]) {
      expect(findAllCells(doc(ws + "```{r}", "1", ws + "```")).map((c) => c.lang)).toEqual(["r"]);
    }
  });

  it("CONTROL: an indented TILDE fence is never a cell, indented or not", () => {
    // Quarto's `startCodeCellRegEx` has no tilde branch, and neither does ours.
    expect(findAllCells(doc("    ~~~{r}", "1", "    ~~~"))).toEqual([]);
  });
});

describe("a fence that is never CLOSED is not a code block at all (Session 179)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  /**
   * Two rules, measured against the installed toolchain rather than transcribed:
   *
   * 1. **Quarto closes a CELL only on an exact-length run.** `breakQuartoMd` tests
   *    `line.match(endCodeRegEx)[1].length === inCode`, where CommonMark allows any run at
   *    least as long. A cell it never closes is flushed as MARKDOWN — and since the opening
   *    fence is never pushed into its line buffer, quarto DELETES it.
   * 2. **Pandoc's `markdown` requires a fence to be closed** or it is not a code block. This
   *    is the dialect quarto renders with (`-f markdown`, not `commonmark`), and it is the
   *    rule CommonMark does NOT share: CommonMark runs an unclosed fence to end of document.
   *
   * Measured with `quarto pandoc -f markdown -t html`, the closed control first:
   *
   * | document                        | pandoc          |
   * |---|---|
   * | `para` / ` ``` ` / `code` / ` ``` ` | `<pre><code>`   |
   * | ` ``` ` / `code`   (unclosed, line 0) | `<p>``` code</p>` |
   * | `para` / `` / ` ``` ` / `code`  | `<p>``` code</p>` |
   *
   * Position is irrelevant — only closure matters. So the same lookahead governs both fence
   * kinds, and only the closer's LENGTH rule differs (plain `>=`, cell `===`).
   */
  it("RED->GREEN: a heading below a 3-tick/4-tick cell fence is still a heading", () => {
    // ⚠ THE REGRESSION THIS SESSION'S OWN FIRST GREEN INTRODUCED. Declining the cell is
    // half the answer: the stray 4-tick line then opened a PLAIN fence which, under the old
    // "unclosed runs to EOF" rule, swallowed every heading below it. Measured end-to-end —
    // `quarto render` emits `<p>#| echo: true 6 * 7 ````</p>` followed by a real `<h1>`, so
    // the block is prose and the heading is genuine.
    const text = doc("intro", "", "```{r}", "#| echo: true", "6 * 7", "````", "", "# Heading Below");
    expect(findAllCells(text)).toEqual([]);
    expect(findHeadings(text).map((h) => h.text)).toEqual(["Heading Below"]);
  });

  /**
   * THE CLOSER INDEX AND `isCloser` MUST NOT DRIFT.
   *
   * `buildCloserIndex` pre-filters lines by exactly the predicate `isCloser` applies, so
   * the two encode the same rule twice — the duplication Learning #14 exists to catch. It
   * is there for a measured reason (every fence now needs the lookahead; without the index
   * a 2000-opener document went 0.7 ms → 162 ms per scan), so it cannot simply be deleted.
   * These pins walk all three axes the key is built from — CHAR, LENGTH, INDENT — so a
   * change to either side that the other does not match is observable here.
   *
   * Every row measured with `quarto pandoc -f markdown -t html`, the dialect quarto renders
   * with. `<pre>` means the fence closed; a paragraph means it never opened.
   */
  it.each([
    // opener, closer, does the fence close?, measured pandoc result
    ["```", "````", true, "3-tick opener, 4-tick closer — CODE BLOCK (plain takes >=)"],
    ["````", "```", false, "4-tick opener, 3-tick closer — PARAGRAPH"],
    ["```", "   ```", true, "closer indented 3 — CODE BLOCK (CommonMark cap is 0-3)"],
    ["```", "    ```", false, "closer indented 4 — PARAGRAPH (past the cap)"],
    ["~~~", "~~~~", true, "tilde opener, longer tilde closer — CODE BLOCK"],
    ["```", "~~~", false, "backtick opener, tilde closer — PARAGRAPH (char must match)"],
  ])("plain fence %s / %s closes: %s", (opener, closer, closes, _why) => {
    // A PLAIN fence is observable through the heading it does or does not swallow. When it
    // closes, `# After` is a heading because the fence ended; when it never closes, the
    // fence does not open at all and `# Swallowed` is an ordinary heading too — so the
    // discriminating assertion is the line the fence would have covered.
    //
    // ⚠ THE BLANK LINE AFTER THE OPENER IS LOAD-BEARING, and this pin was written without
    // it first. Pandoc's `markdown` enables `blank_before_header`, so `# Swallowed` pressed
    // directly against the opener is NOT a heading to pandoc even when the fence does not
    // open (measured: that document yields `After` alone). Our scanner has no such rule, so
    // the version without the blank line would have pinned OUR answer against pandoc's — a
    // separate, pre-existing divergence riding along inside a pin about fences. Filed, not
    // fixed here.
    const text = doc("para", "", opener, "", "# Swallowed", closer, "", "# After");
    const headings = findHeadings(text).map((h) => h.text);
    expect(headings).toEqual(closes ? ["After"] : ["Swallowed", "After"]);
  });

  it("the OUTLINE recovers the sections a malformed fence used to swallow", () => {
    // The second consumer of this change, and the one the filed item never mentioned. The
    // integration suite verifies the DIAGNOSTICS consumer in a real editor; `buildOutline`
    // is pure, so its half needs no Extension Development Host to establish.
    //
    // Before this session a 4-tick opener with a 3-tick closer ran to end of document, so
    // every section below it vanished from the outline, breadcrumbs and sticky scroll —
    // while `quarto render` emitted them as real `<h1>`/`<h2>`. Measured end-to-end.
    const text = doc(
      "# Top",
      "",
      "````{r}",
      "1",
      "```",
      "",
      "## Below One",
      "",
      "prose",
      "",
      "## Below Two",
    );
    expect(buildOutline(text).map((s) => s.name)).toEqual(["Top"]);
    expect(buildOutline(text)[0].children.map((s) => s.name)).toEqual(["Below One", "Below Two"]);
  });

  it("a cell closes at the EXACT run, not at an earlier longer one", () => {
    // ⚠ ADDED BY THIS SESSION'S ADVERSARIAL PASS, AND IT CLOSES A REAL HOLE. Reverting
    // `isCloser`'s cell branch to CommonMark's `>=` survived the entire unit suite AND all
    // 130 corpus documents. The reason is subtle and worth keeping: once `buildCloserIndex`
    // buckets cell closers by EXACT length, the index alone decides whether a cell opens, so
    // the comparison in `isCloser` only decides WHICH line closes an already-open cell. It
    // is discriminating exactly when a longer run sits ABOVE the exact one.
    //
    // Here the first cell must close at line 8, not at the 4-tick line 6 — otherwise the
    // stray ``` on line 8 opens a plain fence that swallows the second cell whole and its
    // bad option goes unreported. Measured: quarto renders this **exit 1**, pointing at the
    // second cell's option, so closing early would be a LOST TRUE POSITIVE.
    const text = doc("```{r}", "1", "````", "2", "```", "", "```{r}", "#| echo: banana", "1", "```");
    expect(findAllCells(text).map((c) => `${c.startLine}..${c.endLine}`)).toEqual(["0..4", "6..9"]);
  });

  it("the same three axes on a CELL fence, where the length rule is EXACT", () => {
    // The cell half of the table above. Quarto's rule is `=== inCode`, so unlike a plain
    // fence a LONGER closer does not close a cell — the divergence this session shipped.
    const cell = (opener: string, closer: string) =>
      findAllCells(doc("para", "", opener + "{r}", "1", closer)).map((c) => c.lang);
    expect(cell("```", "```")).toEqual(["r"]); // exact — a cell
    expect(cell("```", "````")).toEqual([]); // longer — NOT a cell (plain would close)
    expect(cell("````", "```")).toEqual([]); // shorter — not a cell either
    expect(cell("````", "````")).toEqual(["r"]); // exact at a different length
    expect(cell("   ```", "```")).toEqual(["r"]); // indent is unbounded for a CELL closer…
    expect(cell("```", "    ```")).toEqual(["r"]); // …on both sides (S178, quarto's endCodeRegEx)
    expect(cell("~~~", "~~~")).toEqual([]); // tilde is never a cell to quarto
  });
});

describe("an ATX heading cannot interrupt an open paragraph (Session 180)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: a heading pressed against a paragraph line is not a heading", () => {
    // Quarto renders with pandoc's `markdown` dialect, where `blank_before_header` is ON by
    // default: a heading cannot interrupt an OPEN PARAGRAPH. Measured on the real render
    // path (`quarto render --to html`, quarto 1.7.33 / pandoc 3.6.3), not reasoned:
    //
    //   intro / # foo / stuff   ->  <p>intro # foo stuff</p>   — NO heading at all
    //   intro / (blank) / # foo ->  <h1>foo</h1>               — a real heading
    //
    // We reported a heading for both, so the first document put a PHANTOM entry into the
    // outline, breadcrumbs, sticky scroll and workspace symbols.
    expect(findHeadings(doc("intro", "# foo", "stuff")).map((h) => h.text)).toEqual([]);
    expect(findHeadings(doc("intro", "", "# foo", "stuff")).map((h) => h.text)).toEqual(["foo"]);
  });

  /**
   * RED->GREEN: WHICH lines leave a paragraph open.
   *
   * The filed item prescribed "a one-line adjacency test — a heading needs a blank or a
   * region boundary above it". Measured, that rule moves 10 documents toward quarto and 5
   * AWAY from it: a heading below a thematic break, a table row, an indented code block, a
   * link-reference definition or a raw HTML block is REAL, and the naive rule deletes it.
   * On this repo's own 108 markdown/qmd files it deletes `SESSION_NOTES.md`'s
   * "Session 83 Handoff Evaluation" heading outright.
   *
   * So the rule is not adjacency but pandoc's own: a heading may not interrupt an OPEN
   * PARAGRAPH. Every row below is a block-level construct that leaves none open, and every
   * expectation was read off a real `quarto render --to html` (quarto 1.7.33 / pandoc
   * 3.6.3) — never off `quarto pandoc` alone, which is unfaithful for cell fences.
   */
  it.each([
    // A block-level construct leaves NO paragraph open, so `# foo` below it is real.
    ["a thematic break", ["***"]],
    ["a setext underline", ["Title", "==========="]],
    ["a pipe table", ["| a | b |", "|---|---|", "| 1 | 2 |"]],
    ["a grid table (whose border carries NO pipe)", ["+---+---+", "| a | b |", "+===+===+", "| 1 | 2 |", "+---+---+"]],
    ["a fenced-div closer", ["::: {.note}", "body", ":::"]],
    ["a callout closer", ["::: {.callout-note}", "body", ":::"]],
    ["an indented code block", ["    code"]],
    ["a TAB-indented code block", ["\tcode"]],
    ["a link-reference definition", ["[x]: http://e.com"]],
    ["a raw HTML block", ["<div>", "x", "</div>"]],
    ["a raw HTML block closed with up to 3 spaces of indent", ["<div>", "x", "  </div>"]],
    ["a bare `##` — an EMPTY heading to pandoc, which our ATX regex cannot match", ["##"]],
    ["a raw TeX block", ["\\clearpage"]],
    ["a mid-document YAML block ended with `...`", ["---", "subtitle: mid", "..."]],
    ["a closed fenced code block", ["```", "code", "```"]],
    ["a closed cell fence", ["```{r}", "1+1", "```"]],
    ["a whole-line HTML comment", ["<!-- c -->"]],
  ])("a heading below %s IS a heading", (_what, above) => {
    // Containment, not equality: a construct may legitimately contribute a heading of its
    // own (the setext row renders `Title` as well, measured `<h1>Title</h1><h1>foo</h1>`).
    // The property under test is only whether `# foo` survives.
    expect(findHeadings(doc("intro", "", ...above, "# foo", "trailing")).map((h) => h.text))
      .toContain("foo");
  });

  it.each([
    // These leave a paragraph OPEN, so the heading is not a heading at all.
    ["prose — the filed defect itself", ["ordinary prose"]],
    ["a two-line paragraph", ["one", "two"]],
    ["a bullet-list item", ["- item"]],
    ["an ordered-list item", ["1. item"]],
    ["a blockquote line", ["> quote"]],
    ["a lazy blockquote continuation", ["> quote", "lazy"]],
    ["an UNCLOSED fence, which since Session 179 is ordinary prose", ["```"]],
  ])("a heading below %s is NOT a heading", (_what, above) => {
    expect(findHeadings(doc("intro", "", ...above, "# foo", "trailing")).map((h) => h.text))
      .not.toContain("foo");
  });

  /**
   * RED->GREEN: `blank_before_header` is a DEFAULT, not an invariant — and a document can
   * turn it off in its own front matter. This is the one place the whole change could
   * DELETE a heading quarto really renders, which is the direction that must never happen.
   *
   * Every spelling below measured on the real render path with the same body (prose, then
   * a heading pressed against it):
   *
   * | front matter                          | quarto renders |
   * |---|---|
   * | (none)                                | no heading     |
   * | `from: markdown`                      | no heading     |
   * | `from: markdown-blank_before_header`  | **a heading**  |
   * | `from: markdown_strict`               | **a heading**  |
   * | `from: gfm`                           | **a heading**  |
   * | `from: commonmark`                    | **a heading**  |
   * | `format:`/`  html:`/`    from: …`     | **a heading**  |
   *
   * So the bail keys on the PRESENCE of a `from:` key at any indentation, not on resolving
   * the dialect: fail closed. The cost is that `from: markdown` — which really does enable
   * the extension — retains the phantom, the permitted direction. `reader:` is deliberately
   * NOT matched: quarto REJECTS that key outright (exit 1), so it can never render a heading.
   */
  it.each([
    ["from: markdown-blank_before_header", ["from: markdown-blank_before_header"]],
    ["from: markdown_strict", ["from: markdown_strict"]],
    ["from: gfm", ["from: gfm"]],
    ["from: commonmark", ["from: commonmark"]],
    ["a nested per-format from:", ["format:", "  html:", "    from: markdown_strict"]],
  ])("front matter carrying %s keeps a heading pressed against prose", (_what, fm) => {
    const text = doc("---", "title: t", ...fm, "---", "", "Prose opens the paragraph.", "# Heading");
    expect(findHeadings(text).map((h) => h.text)).toEqual(["Heading"]);
  });

  it("…and the control with no from: key still suppresses it", () => {
    const text = doc("---", "title: t", "---", "", "Prose opens the paragraph.", "# Heading");
    expect(findHeadings(text).map((h) => h.text)).toEqual([]);
  });

  it("the OUTLINE loses the phantom section and keeps the real one", () => {
    // TEST-AFTER (labelled) — the user-visible surface the filed item named. `buildOutline`
    // is pure, so this half needs no Extension Development Host.
    //
    // Measured: this document renders ONE body heading, `Real`. Before this session the
    // outline, breadcrumbs, sticky scroll and workspace symbols all carried `Phantom` too,
    // as a sibling section, so every node below it was filed under a heading that does not
    // exist in the rendered document.
    const text = doc(
      "# Real",
      "",
      "Prose that opens a paragraph.",
      "## Phantom",
      "more prose",
      "",
      "## Genuine",
    );
    expect(buildOutline(text).map((s) => s.name)).toEqual(["Real"]);
    expect(buildOutline(text)[0].children.map((s) => s.name)).toEqual(["Genuine"]);
  });

  /**
   * ADDED BY THIS SESSION'S ADVERSARIAL PASS — three mutants that survived everything else.
   *
   * Each is a real hole, not an equivalent mutant: the shipped build is right on all three
   * and nothing could observe it. Each fixture is the document where the two implementations
   * FIRST diverge, measured on the real render path rather than argued.
   */
  it("a DECLINED heading still leaves the paragraph open", () => {
    // Mutant: `paragraphOpen = false` when an ATX line is declined. It survived the whole
    // suite because every other fixture has only ONE heading under its paragraph. Here the
    // declined `# First` would clear the flag and let `## Second` through as a phantom.
    // Measured: this document renders NO heading at all — the paragraph swallows both.
    expect(findHeadings(doc("intro", "# First", "## Second", "trailing")).map((h) => h.text))
      .toEqual([]);
  });

  it("an `=` run that is NOT consumed as a setext underline still closes the paragraph", () => {
    // AMENDED BY SESSION 181, and the amendment is the point. As written this pin asserted
    // `["ATX Below"]` and named the missing `Setext Title` as a PRE-EXISTING false negative
    // it neither caused nor fixed. Session 181 fixed it, so the pin now asserts the full set
    // its own comment already recorded as measured: quarto renders BOTH headings here.
    //
    // ⚠ THE PIN IS NO LONGER AN EFFECTIVE CONTROL FOR THE `=+` PATTERN, and it cannot be made
    // one honestly. Its original mutant was "drop `=+` from CLOSES_PARAGRAPH"; that pattern
    // is reachable only where the underline is NOT consumed as a setext heading, and Session
    // 181 makes it consumed here. Rebuilding the fixture so the run is unconsumed (two body
    // lines above it) does not help either — MEASURED, that document renders NO heading at
    // all, i.e. the `=+` entry's own premise is false in all three positions where it is
    // reachable (at line 0, after a blank, and at `consecutiveBody >= 2`). Asserting our
    // current answer there would lock in a phantom. Left as a measured, filed defect of
    // Session 180's list rather than silently repaired or silently dropped.
    const text = doc("    indented code", "Setext Title", "===========", "# ATX Below");
    expect(findHeadings(text).map((h) => h.text)).toEqual(["Setext Title", "ATX Below"]);
  });

  it("a CLOSED fence directly under prose closes the paragraph", () => {
    // Mutant: drop `paragraphOpen = false` at the fence opener. It survived because every
    // other fence fixture has a BLANK line above the fence, which already cleared the flag —
    // so the assignment at the fence was pure redundancy in all of them.
    //
    // Pandoc's `para` is terminated by a fenced code block (`backtick_code_blocks`), so a
    // fence CAN interrupt an open paragraph where a heading cannot. Measured: `<h1>foo</h1>`
    // renders with and without the blank line, so both must keep the heading.
    expect(findHeadings(doc("intro", "```", "code", "```", "# foo", "trailing")).map((h) => h.text))
      .toEqual(["foo"]);
    expect(findHeadings(doc("intro", "", "```", "code", "```", "# foo", "trailing")).map((h) => h.text))
      .toEqual(["foo"]);
  });

  /**
   * AMENDED BY SESSION 183 — these five were DISCLOSED RESIDUALS and are now FIXED.
   *
   * As written, this pin asserted `["foo"]` for each row: a phantom heading we reported where
   * quarto renders none. Session 183 gated `CLOSES_PARAGRAPH` on `paragraphOpen`, and every
   * one of these shapes is an exempt construct appearing INSIDE prose rather than as its own
   * block — which is exactly what the gate now declines. All five re-measured on the real
   * render path at Session 183 (`quarto render --to html --no-execute`, quarto 1.7.33), each
   * as `intro` / <row> / `# foo` / `trailing`: **all five render NO heading at all**, so the
   * assertion flips from the phantom to the empty set.
   *
   * ⚠ THE OLD JUSTIFICATION FOR KEEPING THEM WAS REFUTED BY MEASUREMENT, and that is worth
   * recording rather than quietly deleting. It read: "tightening any of them costs a measured
   * real heading (`SESSION_NOTES.md`'s own 'Session 83 Handoff Evaluation' is what the
   * precise-table variant deletes)." Rendered at Session 183, the real 14-line window around
   * `SESSION_NOTES.md:3426` emits ONLY `<h2>Session 84 (superseded …)</h2>` — the "Session 83
   * Handoff Evaluation" line is swallowed into the paragraph above it as literal text, because
   * the prose line above contains a `|` inside an inline-code regex and the wide `/\|/` row
   * fired on it. It was a PHANTOM, not a real heading, so nothing was ever traded away.
   */
  it.each([
    ["prose containing a pipe character", "Run `cat f | wc -l` to count."],
    ["prose starting with inline HTML", "<em>hi</em> there prose"],
    ["a footnote definition, which the link-ref pattern also matches", "[^1]: a note"],
    ["an autolink on its own line", "<http://example.com>"],
    ["a 4-space LAZY continuation of an open paragraph", "    still the same paragraph"],
  ])("FIXED (Session 183): no phantom heading below %s", (_what, above) => {
    const text = doc("intro", above, "# foo", "trailing");
    expect(findHeadings(text).map((h) => h.text)).toEqual([]);
  });
});

describe("a setext underline may follow a line that begins a FRESH block (Session 181)", () => {
  it("recognizes a setext heading whose title sits directly below an indented code line", () => {
    // MEASURED firsthand vs quarto 1.7.33 on the REAL `quarto render` path (not
    // `quarto pandoc`): `    indented code` / `Setext Title` / `===` renders
    // `<h1>Setext Title</h1>`. The indented line is an indented CODE BLOCK, so the
    // title below it opens a FRESH paragraph — but `consecutiveBody` counted the
    // code line as prose, so the underline was never inspected at 1 and the real
    // heading was dropped from the outline, breadcrumbs, sticky scroll, workspace
    // symbols and the cross-reference index.
    const text = ["    indented code", "Setext Title", "==="].join("\n");
    expect(findHeadings(text)).toEqual([{ level: 1, text: "Setext Title", line: 1 }]);
  });

  it("still claims the block line ITSELF when the underline sits directly below it", () => {
    // RED 2 — a regression the FIRST implementation of RED 1 introduced, which no test
    // written for RED 1 could see. Resetting the counter AT the block line makes the
    // underline arrive at `consecutiveBody === 0`, so a heading the pre-S181 build got
    // RIGHT is deleted — the one direction that must never happen.
    //
    // Measured firsthand on the real render path: a setext underline OVERRIDES the block
    // interpretation of the line directly above it and claims that line's literal text.
    // `    indented code` / `===` renders `<h1>indented code</h1>`; the whole family
    // behaves the same way (`***`, `___`, `##`, `| a | b |`, `[x]: url`, `\clearpage`).
    //
    // The rule is therefore NOT "a block line resets the counter" but "a block line makes
    // the line BELOW it a fresh paragraph start" — the block line keeps its own claim.
    expect(findHeadings(["    indented code", "==="].join("\n"))).toEqual([
      { level: 1, text: "indented code", line: 0 },
    ]);
    expect(findHeadings(["***", "==="].join("\n"))).toEqual([
      { level: 1, text: "***", line: 0 },
    ]);
  });

  it("declines a title inside an indented code block of 2+ lines", () => {
    // The one exception measured: a LONE indented line under an underline is a setext
    // title, but a run of 2+ is a firm code block and pandoc renders no heading at all.
    // `    code one` / `    code two` / `===` renders nothing; nor does
    // `    code` / `    Setext Title` / `===`.
    expect(findHeadings(["    code one", "    code two", "==="].join("\n"))).toEqual([]);
    expect(findHeadings(["    code", "    Setext Title", "==="].join("\n"))).toEqual([]);
    // ...but the run still makes the NEXT unindented line a fresh paragraph start.
    expect(findHeadings(["    code one", "    code two", "Setext Title", "==="].join("\n")))
      .toEqual([{ level: 1, text: "Setext Title", line: 2 }]);
  });

  /**
   * MUTANT PIN — kills `opensFreshBlock` → `closesParagraph`.
   *
   * `OPENS_FRESH_BLOCK` and `CLOSES_PARAGRAPH` both answer "is this line block-level?", so
   * substituting one for the other is the instinctive simplification and it type-checks,
   * reads cleanly, and is WRONG. The two lists have OPPOSITE safety polarity: a pattern
   * missing from `CLOSES_PARAGRAPH` DELETES an ATX heading, so that list is deliberately
   * permissive; a pattern wrongly present in `OPENS_FRESH_BLOCK` INVENTS a setext heading,
   * so this one is deliberately restrictive.
   *
   * Every row below is a construct `CLOSES_PARAGRAPH` matches and `OPENS_FRESH_BLOCK` must
   * NOT, each measured firsthand on the real `quarto render` path as rendering no heading.
   * Making the substitution turns all seven into phantom headings — in the outline,
   * breadcrumbs, sticky scroll, workspace symbols and the cross-reference index.
   */
  it.each([
    ["a fenced-div / callout fence", ":::"],
    ["a callout fence with attributes", "::: {.callout-note}"],
    ["a grid-table border, which carries no pipe", "+---+---+"],
    ["a bare pipe in ordinary prose", "a | b"],
    ["a footnote definition, which the link-ref pattern also matches", "[^1]: a note"],
    ["an INLINE html tag", "<span>hi</span>"],
    ["a mid-document YAML `...` terminator", "..."],
  ])("does NOT let %s open a fresh block for a setext underline", (_what, above) => {
    expect(findHeadings([above, "Setext Title", "==="].join("\n"))).toEqual([]);
    expect(findHeadings([above, "Setext Title", "---"].join("\n"))).toEqual([]);
  });

  /**
   * The constructs that DO open a fresh block, each measured firsthand as rendering
   * `<h1>Setext Title</h1>`. Written as the document where the rule FIRST diverges from
   * a build without that pattern — a fixture with the underline directly below the
   * construct proves nothing here, because the construct's own line is claimed at
   * `consecutiveBody === 1` whether or not the pattern exists (that is how the adversarial
   * pass found three of these unpinned; see Learning #226).
   */
  it.each([
    ["an indented code block", "    indented code"],
    ["a TAB-indented code block", "\tindented code"],
    ["a thematic break", "***"],
    ["an underscore thematic break", "___"],
    ["a link-reference definition", "[x]: http://example.com"],
    ["a pipe-table row", "| a | b |"],
    ["a bare `##`", "##"],
    ["a raw TeX block", "\\clearpage"],
  ])("lets %s open a fresh block for a setext underline", (_what, above) => {
    expect(findHeadings([above, "Setext Title", "==="].join("\n")))
      .toEqual([{ level: 1, text: "Setext Title", line: 1 }]);
  });

  it("a raw HTML BLOCK opens a fresh block even against an OPEN paragraph", () => {
    // Kills two mutants at once: dropping the `HTML_BLOCK_OPEN` early return, and the one
    // that is easy to write and impossible to see — computing `pendingFreshBlock` AFTER
    // `paragraphOpen` has been reassigned for this line, which silently asks the question
    // about the wrong line. Measured: raw HTML is the ONLY construct that interrupts an
    // open paragraph here; every other one becomes a lazy continuation of it.
    expect(findHeadings(["prose line", "<div>", "Setext Title", "==="].join("\n")))
      .toEqual([{ level: 1, text: "Setext Title", line: 2 }]);
  });

  it("a block construct against an OPEN paragraph is a lazy continuation, not a block", () => {
    // The `paragraphOpen` bail. Measured — `prose` / `    indented` / `Title` / `===`
    // renders NO heading, while the same document without the `prose` line renders
    // `<h1>Title</h1>`. Dropping the bail fabricates a heading on every row here.
    for (const above of ["    indented code", "\tindented", "***", "[x]: http://e.com", "| a | b |", "##", "\\clearpage"]) {
      expect(findHeadings(["prose line", above, "Setext Title", "==="].join("\n"))).toEqual([]);
    }
  });
});

describe("an `=`/`-` run and a thematic break do NOT close a paragraph (Session 182)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: an `=` run that is not consumed as a setext underline keeps the paragraph OPEN", () => {
    // Session 180 put `/^ {0,3}=+[ \t]*$/` in `CLOSES_PARAGRAPH` so that an `=` run NOT
    // consumed as a setext underline would still let an ATX heading below it through. That
    // entry is reachable only at `consecutiveBody !== 1`, and measured on the real render
    // path (`quarto render --to html`, quarto 1.7.33) every such position renders the
    // OPPOSITE — the `=` run is ordinary paragraph text, so the paragraph stays open and
    // the `#` line below is swallowed as continuation:
    //
    //   ===  / # ATX Below                  ->  <p>=== # ATX Below</p>   — NO heading
    //   prose / (blank) / === / # ATX Below ->  <p>prose</p><p>=== # ATX Below</p>
    //   one / two / === / # ATX Below       ->  <p>one two === # ATX Below</p>
    //
    // We reported `ATX Below` for all three, so each was a PHANTOM heading in the outline,
    // breadcrumbs, sticky scroll, workspace symbols and the cross-reference index.
    expect(findHeadings(doc("===", "# ATX Below")).map((h) => h.text)).toEqual([]);
    expect(findHeadings(doc("prose here", "", "===", "# ATX Below")).map((h) => h.text)).toEqual([]);
    expect(findHeadings(doc("line one", "line two", "===", "# ATX Below")).map((h) => h.text)).toEqual([]);
  });

  it("RED->GREEN: but an `=`/`-` run directly below an ATX heading DOES close the block", () => {
    // The regression the obvious fix introduces, and which NOTHING in the suite caught —
    // simply deleting the `=+` entry passes the test above and silently DELETES a heading
    // quarto really renders. Measured:
    //
    //   # Heading Above / === / # ATX Below -> <h1># Heading Above</h1><h1>ATX Below</h1>
    //   # Heading Above / -   / # ATX Below -> <h2># Heading Above</h2><h1>ATX Below</h1>
    //
    // Pandoc consumes the run as a SETEXT UNDERLINE over the `#` line — swallowing it,
    // literal `#` and all, into a setext heading — which closes the block, so the heading
    // below it is real. This model deliberately declines that swallow (see `SETEXT_H1`), so
    // it must recover the closure some other way or lose the second heading outright.
    //
    // The `-` rows are the stronger claim: they were a pre-existing LOST TRUE POSITIVE that
    // no `CLOSES_PARAGRAPH` row ever matched (`-`/`--` are too short for a thematic break).
    for (const run of ["===", "=", "-", "--"]) {
      expect(findHeadings(doc("# Heading Above", run, "# ATX Below")).map((h) => h.text))
        .toContain("ATX Below");
    }
  });

  it("RED->GREEN: a thematic break against an OPEN paragraph is lazy continuation, not a block", () => {
    // Session 180's thematic-break row is right where no paragraph is open and WRONG where
    // one is. Every row of S180's own construct table has a BLANK LINE above the construct,
    // so the whole open-paragraph half of its behaviour was never exercised.
    //
    // Measured — against an open paragraph pandoc renders the run as ordinary text, and the
    // `#` line below it as continuation of that same paragraph:
    //
    //   one / two / *** / # ATX Below -> <p>one two *** # ATX Below</p>  — NO heading
    //   one / two / --- / # ATX Below -> <p>one two — # ATX Below</p>    — an EM DASH:
    //                                     smart punctuation proves it is paragraph TEXT
    //
    // This is the same rule `INDENTED_CODE_LINE` and `opensFreshBlock` already carry: these
    // constructs are block-level only where no paragraph is already open.
    for (const run of ["***", "___", "---", "* * *", "- - -", "_ _ _"]) {
      expect(findHeadings(doc("line one", "line two", run, "# ATX Below")).map((h) => h.text))
        .toEqual([]);
    }
  });

  // ---------------------------------------------------------------------------------
  // The adversarial pass. 17 mutants, 5 survivors, all real — and TWO of them were not
  // missing pins but defects in this session's own first implementation, found only here.
  // Every expectation below is a document where the two implementations FIRST diverge,
  // read off a real `quarto render`.
  // ---------------------------------------------------------------------------------

  it("M9/M10: the ATX-swallow needs a run at COLUMN 0 with nothing after it", () => {
    // MUTANT M9 (widen the run to ` {0,3}`) and M10 (drop the `$` anchor) both survived the
    // suite as first written, and M9 was CORRECT where this session's code was not: the
    // first implementation used ` {0,3}`, copied from `SETEXT_H1`, and invented a heading.
    //
    // Measured — one leading space is the whole difference:
    //   # Heading Above / ===   / # ATX Below -> <h1># Heading Above</h1><h1>ATX Below</h1>
    //   # Heading Above /  ===  / # ATX Below -> <h1>Heading Above</h1><p>=== # ATX Below</p>
    //   # Heading Above / === junk / # ATX…   -> <h1>Heading Above</h1><p>=== junk # ATX…</p>
    expect(findHeadings(doc("# Heading Above", "===", "# ATX Below")).map((h) => h.text))
      .toContain("ATX Below");
    expect(findHeadings(doc("# Heading Above", "===   ", "# ATX Below")).map((h) => h.text))
      .toContain("ATX Below"); // trailing WHITESPACE is still an underline (measured)
    for (const run of [" ===", "   ===", "   -", "=== junk"]) {
      expect(findHeadings(doc("# Heading Above", run, "# ATX Below")).map((h) => h.text))
        .not.toContain("ATX Below");
    }
  });

  it("M13: the ATX-adjacency is LITERAL — a blank line or a region between ends it", () => {
    // MUTANT M13 (never clear the state) survived, and exposed the same bug in this
    // session's own code: the state was cleared at the foot of the loop, which every
    // `continue` path skips, so it leaked across blank lines and whole fenced regions.
    //
    // Measured — the blank line is the whole difference:
    //   # Heading Above / === / # ATX Below            -> <h1>…</h1><h1>ATX Below</h1>
    //   # Heading Above / (blank) / === / # ATX Below  -> <h1>…</h1><p>=== # ATX Below</p>
    expect(findHeadings(doc("# Heading Above", "===", "# ATX Below")).map((h) => h.text))
      .toContain("ATX Below");
    expect(findHeadings(doc("# Heading Above", "", "===", "# ATX Below")).map((h) => h.text))
      .not.toContain("ATX Below");
    expect(findHeadings(doc("# Heading Above", "", "-", "# ATX Below")).map((h) => h.text))
      .not.toContain("ATX Below");
    // …and it must not survive a fenced region either.
    expect(findHeadings(doc("# Heading Above", "", "```", "code", "```", "===", "# ATX Below"))
      .map((h) => h.text)).not.toContain("ATX Below");
    // …nor a run of prose lines.
    expect(findHeadings(doc("# Heading Above", "", "line one", "line two", "===", "# ATX Below"))
      .map((h) => h.text)).not.toContain("ATX Below");
  });

  it("M11/M17: a thematic break is 3+ chars, and `_` is one of the three spellings", () => {
    // MUTANT M11 (loosen `{3,}` to `{2,}`) and M17 (drop the `_` alternative) both survived.
    // They fail in OPPOSITE directions, which is why both are pinned here: M11 would
    // FABRICATE a heading, M17 would DELETE one. Measured, with a closed paragraph above so
    // the break really is a break:
    //   prose / (blank) / *** / # ATX Below -> <p>prose</p><hr><h1>ATX Below</h1>
    //   prose / (blank) / **  / # ATX Below -> <p>prose</p><p>** # ATX Below</p>
    for (const run of ["***", "___", "---", "_ _ _"]) {
      expect(findHeadings(doc("prose", "", run, "# ATX Below")).map((h) => h.text))
        .toEqual(["ATX Below"]);
    }
    for (const run of ["**", "__", "--"]) {
      expect(findHeadings(doc("prose", "", run, "# ATX Below")).map((h) => h.text)).toEqual([]);
    }
  });
});

describe("CLOSES_PARAGRAPH's remaining rows are gated on an OPEN paragraph (Session 183)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: an INDENTED line against an OPEN paragraph is lazy continuation, not code", () => {
    // Session 182 shipped the `!paragraphOpen` gate for the THEMATIC-BREAK row only, and
    // filed the identical defect on the INDENTED-CODE row `/^(?: {4,}|\t)\S/`. Measured on
    // the real render path (`quarto render --to html --no-execute`, quarto 1.7.33): against
    // an OPEN paragraph an indented line is a LAZY CONTINUATION of it, not a code block, so
    // nothing closes and the `#` line below is swallowed as paragraph text —
    //
    //   line one / line two / <TAB>*** / # ATX Below -> <p>line one line two *** # ATX Below</p>
    //   line one / <TAB>code    / # ATX Below        -> <p>line one code # ATX Below</p>
    //
    // while the SAME construct with the paragraph CLOSED really is a code block and the
    // heading below it is real:
    //
    //   line one / (blank) / (4sp)code / # ATX Below -> <p>line one</p><pre>code</pre><h1>ATX Below</h1>
    //
    // `INDENTED_CODE_LINE`'s own docstring already states this rule and `opensFreshBlock`
    // already applies it; this row did not.
    expect(findHeadings(doc("line one", "line two", "\t***", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
    expect(findHeadings(doc("line one", "\tcode", "# ATX Below")).map((h) => h.text)).toEqual([]);
    expect(findHeadings(doc("line one", "line two", "    code", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
    // The control that keeps the gate honest: with the paragraph CLOSED the heading is REAL.
    expect(findHeadings(doc("line one", "", "    code", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
  });

  it("RED->GREEN: the gate does NOT apply inside a BLOCK QUOTE, where the same bytes close", () => {
    // The regression the gate introduces, found by an adversarial pass rather than by my own
    // corpus — both of which held the CONTAINER dimension fixed at top level. Measured:
    //
    //   > quoted one / (4sp)--- / # ATX Below
    //       -> <blockquote><h2 id="quoted-one">quoted one</h2><h1 id="atx-below">ATX Below</h1></blockquote>
    //   > quoted one / # ATX Below            (causal control, construct removed)
    //       -> <blockquote><p>quoted one # ATX Below</p></blockquote>   — NO heading
    //
    // Inside a block quote's LAZY CONTINUATION a 4-space-indented `---` really is a setext
    // underline (it needs exactly one body line above, the same requirement as our own
    // setext rule), and that heading closes the block, so `# ATX Below` is REAL. At top level
    // the identical bytes render one absorbed paragraph and no heading — measured both ways:
    //
    //   line one /    (4sp)--- / # ATX Below        -> <p>…</p>  no heading
    //   > quoted one / > quoted two / (4sp)--- / …  -> no heading (2-line paragraph)
    //
    // This model tracks no block-quote context, so it cannot SEE that setext heading — the
    // pre-`paragraphOpen`-gate build got `ATX Below` right only by accident, because the
    // indented-code row happened to close the paragraph. Suspending the gate inside a quoted
    // paragraph preserves that, at the cost of retaining the quoted context's phantoms. That
    // trade is one-way on purpose: retaining a phantom is permitted, deleting a real heading
    // is not.
    expect(findHeadings(doc("> quoted one", "    ---", "# ATX Below")).map((h) => h.text))
      .toContain("ATX Below");
    // …and the top-level twin must NOT gain a heading, or the guard has leaked out of quotes.
    expect(findHeadings(doc("line one", "    ---", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
  });

  /**
   * TEST-AFTER (labelled) — the SURVIVORS of this session's 13-mutant adversarial pass.
   *
   * Six mutants died against the tests above and Session 180's pins. These seven survived the
   * whole 1726-test suite, and EVERY ONE of them was then measured WRONG against the real
   * renderer — none was more correct than the shipped code (Learning #232 asks that question
   * first; here the answer was no seven times). Each row below is the document where the
   * mutant and the shipped code FIRST disagree, with quarto's measured verdict.
   */
  it("MUTANT PINS: the three hoisted interrupters, and their exact boundaries", () => {
    // M5 (drop RAW_TEX_ENV_OPEN) and M7 (recognise \begin but not \end). A raw TeX
    // ENVIRONMENT interrupts an open paragraph, and the line directly above the heading is
    // the CLOSING \end — so dropping either half deletes this heading.
    //   line one / line two / \begin{center} / text / \end{center} / # ATX Below
    //     -> [h1:ATX Below]   (measured; the prose also loses its <p> wrapper)
    expect(
      findHeadings(doc("line one", "line two", "\\begin{center}", "text", "\\end{center}", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);

    // M8 (widen raw TeX to ANY macro, `/^ {0,3}\\[a-zA-Z]/`). A bare macro is INLINE and does
    // NOT interrupt — widening fabricates a heading. This is the fragment-borrowing hazard of
    // Learning #233: `CLOSES_PARAGRAPH`'s own raw-TeX row IS that wide pattern, and it is
    // correct there (behind the gate) and wrong here (ahead of it).
    //   line one / line two / \clearpage / # ATX Below -> []  (measured)
    expect(findHeadings(doc("line one", "line two", "\\clearpage", "# ATX Below")).map((h) => h.text))
      .toEqual([]);

    // M9 (widen `:::` to `::`). Two colons are not a fence.
    expect(findHeadings(doc("line one", "line two", "::", "# ATX Below")).map((h) => h.text))
      .toEqual([]);

    // M10 (drop the `$` anchor after `...`). `... and more prose` is prose, not a YAML
    // terminator — the anchor is load-bearing, exactly as it is in `SETEXT_UNDERLINE_RUN`.
    expect(findHeadings(doc("line one", "line two", "... and more prose", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
  });

  it("MUTANT PINS: the block-quote marker's indent, and the quotedness flag's LIFETIME", () => {
    // M11 (require column 0, `/^>/`). CommonMark allows a block quote 0-3 spaces of indent,
    // and quarto agrees — so narrowing the marker DELETES this heading.
    //   ` > quoted one` / `    ---` / `# ATX Below` -> [h2:quoted one, h1:ATX Below] (measured)
    expect(findHeadings(doc(" > quoted one", "    ---", "# ATX Below")).map((h) => h.text))
      .toContain("ATX Below");

    // M13 (set quotedness but never clear it). The flag belongs to ONE paragraph; if it leaks,
    // every later paragraph in the document keeps the gate suspended and the phantoms come
    // back. This is the same class as Session 182's own M13 — a state variable whose LIFETIME
    // is wrong rather than whose value is wrong — and neither corpus contained the shape.
    //   > quoted one / (blank) / line one / line two / <TAB>code / # ATX Below -> [] (measured)
    expect(
      findHeadings(doc("> quoted one", "", "line one", "line two", "\tcode", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual([]);
    // …and the flag must genuinely be RECOMPUTED, not merely cleared: a quoted paragraph
    // AFTER a plain one must still suspend the gate (kills the mirror-image mutant).
    expect(
      findHeadings(doc("line one", "", "> quoted one", "    ---", "# ATX Below")).map((h) => h.text),
    ).toContain("ATX Below");
  });
});

describe("CLOSES_PARAGRAPH's patterns are narrowed to the construct (Session 184)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: a <pre>/<script>/<style>/<textarea> block INTERRUPTS an open paragraph", () => {
    // ⚠ A REGRESSION Session 183 SHIPPED, measured here against the pre-Session-183 build.
    // S183 gated `CLOSES_PARAGRAPH` on `paragraphOpen` and hoisted `HTML_BLOCK_OPEN` ahead of
    // that bail — but `HTML_BLOCK_OPEN` carries only CommonMark §4.6 **condition 6**, and
    // `pre`/`script`/`style`/`textarea` are **condition 1**. So a `<pre>` block reached the
    // gated wide row `/^ {0,3}</` instead: its opener closed the paragraph, its BODY line
    // opened a new one, and its CLOSER `</pre>` was then suppressed by the bail — leaving a
    // paragraph open across the heading below. Measured on the real render path
    // (`quarto render --to html --no-execute`, quarto 1.7.33), the heading is REAL:
    //
    //   <pre> / code / </pre> / # ATX Below  ->  <pre>code</pre><h1 id="atx-below">ATX Below</h1>
    //
    // and it is real in EVERY position — including against a genuinely open paragraph, which
    // is what makes the hoisted clause (not the gated list) the correct home:
    //
    //   line one / line two / <script> / var x = 1; / </script> / # ATX Below -> <h1>ATX Below</h1>
    //
    // 20 real headings across the four corpora; the pre-S183 build lost NONE of them.
    for (const tag of ["pre", "script", "style", "textarea"]) {
      expect(
        findHeadings(doc(`<${tag}>`, "body", `</${tag}>`, "# ATX Below")).map((h) => h.text),
      ).toEqual(["ATX Below"]);
      // …against an OPEN paragraph too — quarto emits the heading there as well (measured),
      // which is why these tags belong ahead of the `paragraphOpen` bail and not inside it.
      expect(
        findHeadings(doc("line one", "line two", `<${tag}>`, "body", `</${tag}>`, "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
  });

  it("RESOLVED Session 187 — the `<` row IS narrowable, by NAME rather than by shape", () => {
    // ⚠ THIS TEST WAS "KNOWN RESIDUAL" FOR THREE SESSIONS AND ITS ASSERTIONS ARE NOW INVERTED.
    // Session 184 pinned these five as phantoms retained ON PURPOSE, on the reasoning quoted
    // below — which was correct about the SHAPE and wrong about the conclusion:
    //
    //   "The rule is not a SHAPE, it is pandoc's own tag classification — `<ins>` opens a
    //    block and `<em>` does not, and nothing about the two lines distinguishes them.
    //    Transcribing that table is a separate, measured job; until then the row stays wide."
    //
    // Session 187 did that job. The row is now `HTML_BLOCK_OR_INLINE_OPEN` — pandoc's
    // `blockTags ∪ eitherBlockOrInline`, plus processing instructions and comments — so every
    // line below is correctly prose again and the heading pressed under it is correctly gone.
    //
    // ⚠ ONE HALF OF S184's PREMISE IS ALSO REFUTED: `<ins>` does NOT open a block here.
    // `<ins>x</ins>` and `<em>x</em>` render byte-identically against an open paragraph
    // (measured, quarto 1.7.33). `ins` is in `eitherBlockOrInline`, which is block only where
    // no paragraph is open — which is this context, so `<ins>` IS a control below.
    //
    // Each of these lines is prose to quarto — measured, with no paragraph open:
    //
    //   <span>inline</span> / # ATX Below  -> <p>&lt;span&gt;inline&lt;/span&gt; # ATX Below</p>
    //   <not-a-real-tag     / # ATX Below  -> <p>…</p>          no heading
    //   <http://example.com>/ # ATX Below  -> <p><a …>…</a> …</p>  no heading
    //   <!DOCTYPE html>     / # ATX Below  -> <p>&lt;!DOCTYPE html&gt; …</p>  no heading
    //
    // Session 184's own narrowing — to `<!--`/`<?` alone — scored ZERO headings lost over 476
    // rendered documents and was then measured DELETING twenty real headings, because it threw
    // away the whole tag test rather than replacing it with the right one.
    for (const above of ["<span>inline</span>", "<em>x</em>", "<not-a-real-tag",
                         "<http://example.com>", "<!DOCTYPE html>",
                         "<base>", "<basefont size=\"3\">", "<link>", "<option>",
                         "<my-widget>", "<w:p>"]) {
      expect(
        findHeadings(doc(above, "# ATX Below")).map((h) => h.text),
        `${above} is prose with no paragraph open — the heading below must NOT be emitted`,
      ).toEqual([]);
    }
    // CONTROLS — the recovering direction, all measured to close in THIS context. Losing any
    // of these is the deleting direction, and `eitherBlockOrInline` is exactly what S184's
    // narrowing dropped. `<div` with no `>` stays a control on purpose: pandoc's tag parser
    // spans newlines, so its `>` may be on a later line and it really does open a block —
    // removing the `$` branch was measured deleting that heading.
    for (const above of ["<div>", "<meta charset=\"utf-8\">", "<pre>", "<note>",
                         "<ins>", "<del>", "<svg>", "<button>", "<video>", "<audio>",
                         "<object>", "<embed>", "<noscript>", "<map>", "<progress>",
                         "<area>", "<applet>", "<iframe>", "<source>", "<track>",
                         "</script>", "<?xml version=\"1.0\"?>", "<div"]) {
      expect(
        findHeadings(doc(above, "# ATX Below")).map((h) => h.text),
        `${above} must still leave the paragraph closed`,
      ).toEqual(["ATX Below"]);
    }
    // ⚠ TWO PHANTOMS SURVIVE THE NARROWING, and both are beyond a per-line regex rather than
    // oversights. Pandoc's `htmlTag` guards `all (isName . fst) attr`, so an attribute name
    // that is not a valid XML name makes the whole thing NOT a tag — measured, `<div
    // 1bad="x">` / `# ATX Below` renders no heading and we emit one. Deciding it needs real
    // attribute parsing, and `<div` with no `>` needs the REST OF THE DOCUMENT (the closing
    // angle may be lines below). Both are the retained direction; recorded, not endorsed.
    for (const above of ["<div 1bad=\"x\">", "<div"]) {
      expect(
        findHeadings(doc(above, "# ATX Below")).map((h) => h.text),
      ).toEqual(["ATX Below"]); // ← quarto renders no heading for the first. Retained.
    }
  });

  it("RED->GREEN: a `[^1]:` FOOTNOTE definition is not a link reference and does not close", () => {
    // A footnote definition ABSORBS the line below it as its own body's lazy continuation, so
    // the `#` line never becomes a heading. A link-reference definition is invisible metadata
    // and the heading below it is real. Measured:
    //
    //   [^1]: a footnote body   / # ATX Below -> (no heading at all)
    //   [x]: http://example.com / # ATX Below -> <h1 id="atx-below">ATX Below</h1>
    //
    // ⚠ THE NARROWING IS A LOOKAHEAD FOR A VALID FOOTNOTE LABEL, not a bare `(?!\^)` and not
    // `OPENS_FRESH_BLOCK`'s `\[[^\^\]][^\]]*\]:`. Both shortcuts are MEASURED WRONG here: the
    // borrowed fragment demands a character before the closing bracket, so it rejects `[]:`
    // which really does close; and a bare `(?!\^)` rejects `[^]:`, `[^ 1]:`, `[^a b]:` and
    // `[^^1]:`, none of which pandoc accepts as a footnote label — all four close. Between
    // them the two shortcuts delete five real headings. That is Learning #233 as a number: a
    // fragment lifted from the other list, or from intuition, is unmeasured on THIS
    // predicate's question. The full 17-spelling sweep is pinned below.
    expect(findHeadings(doc("[^1]: a footnote body", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
    expect(findHeadings(doc("[^1]: a footnote body", "    continued", "# ATX Below"))
      .map((h) => h.text)).toEqual([]);
    expect(findHeadings(doc("line one", "", "[^1]: a footnote body", "# ATX Below"))
      .map((h) => h.text)).toEqual([]);
    // The three controls that keep the narrowing honest — each measured to close.
    expect(findHeadings(doc("[x]: http://example.com", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    expect(findHeadings(doc("[]: http://example.com", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    // A caret that is not the FIRST character is an ordinary label, not a footnote.
    expect(findHeadings(doc("[a^b]: http://example.com", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
  });

  it("KNOWN RESIDUAL: the raw-TeX row keeps its phantoms for the same reason", () => {
    // ⚠ PHANTOMS ON PURPOSE, pinned so the decision is on the record. `\textbf{bold}` and
    // `\emph{a} and more prose` are INLINE to pandoc — it wraps them in a paragraph that
    // swallows the `#` line — and we emit a heading below both.
    //
    // Session 184 narrowed this row to a BARE macro alone on its line (`/^ {0,3}\\[a-zA-Z]+[ \t]*$/`),
    // which removes exactly those two and scored ZERO headings lost over 476 documents. An
    // adversarial sweep then measured it DELETING eleven real headings, because a braced macro
    // is not automatically inline — `\vspace{1em}`, `\vspace*{1em}`, `\usepackage{amsmath}`,
    // `\newcommand{\foo}{bar}`, `\setlength{\parindent}{0pt}`, `\definecolor{…}`, `\newpage[2]`,
    // `\newpage{}`, `\clearpage\newpage` and `\vspace2` are all raw BLOCKS on the real render
    // path. Pandoc decides by MACRO NAME, not by whether braces are present, and this scanner
    // has no such table. So the row stays wide and keeps its two phantoms.
    // ⚠ BOTH ASSERTIONS INVERTED BY SESSION 188. The row is no longer wide: pandoc's macro
    // NAME lists are transcribed and measured, `textbf` and `emph` are class C (inline in
    // every context), and quarto renders no heading under either. These were the two phantoms
    // this comment called "the price"; the price has now been paid.
    expect(findHeadings(doc("\\textbf{bold}", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
    expect(findHeadings(doc("\\emph{a} and more prose", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
    // The controls that must survive whatever happens to this row.
    expect(findHeadings(doc("\\clearpage", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("line one", "line two", "\\begin{center}", "text", "\\end{center}",
                       "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("RESOLVED BY SESSION 189: the raw-TeX row's 0-3 space indent was wrong at top level", () => {
    // The mutation pass proposed forbidding the ` {0,3}` indent on the raw-TeX row — it
    // survived the whole suite — and Learning #232's question, is the MUTANT more correct,
    // measured YES at top level. A raw-TeX block must begin at column 0; indent it and pandoc
    // treats it as paragraph text, which swallows the `#` line:
    //
    //   (1sp)\newpage / # ATX Below -> <p>\newpage # ATX Below</p>   NO heading   (we emit one)
    //   (3sp)\clearpage / # ATX Below -> <p>…</p>                     NO heading   (we emit one)
    //
    // It was implemented, and then REJECTED on the document below, which decides it. Inside a
    // LIST ITEM the content column is not the line column: `\clearpage` indented two spaces
    // under `- line one` really is at its block's column 0, quarto really does render the
    // heading, and column-0 matching DELETES it. Measured across 597 rendered documents the
    // narrowing removed 3 phantoms and deleted this 1 real heading.
    //
    // ⚠ **RESOLVED BY SESSION 189, and the resolution is that BOTH readings were right.** The
    // sentence this test used to end on — "a per-line predicate cannot see a containing block's
    // content column" — was true of a per-line predicate and false of this file, which is a
    // SCANNER. `computeRegions` now carries `contentColumns`, so the row is neither ` {0,3}`
    // nor column 0: it is the containing block's own column. The list document below is
    // UNCHANGED and still asserts a heading — it is the control that rejected the column-0
    // form in Session 184 and it still holds. What changed is the line under it.
    expect(
      findHeadings(doc("- line one", "  line two", "", "  \\clearpage", "  # ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // INVERTED — the disclosed top-level phantom is GONE. Quarto renders no heading here and
    // now neither do we (measured, and the assertion is the phantom's own epitaph).
    expect(findHeadings(doc("   \\clearpage", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
    // `RAW_TEX_ENV_OPEN` keeps its own ` {0,3}` and is a DIFFERENT predicate, tested ahead of
    // the paragraph bail; its tolerance is unmeasured on this question and is not touched.
    expect(
      findHeadings(doc("line one", "line two", "  \\begin{center}", "text", "  \\end{center}",
                       "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("KNOWN RESIDUAL: a comment with an UNTERMINATED sibling loses its heading (PRE-EXISTING)", () => {
    // Not this session's, and probed on both prior trees to prove it: a line holding a COMPLETE
    // comment followed by an UNTERMINATED one. Quarto renders `<h1>ATX Below</h1>`; we render
    // nothing, identically on the pre-Session-183 and pre-Session-184 builds.
    //
    // The cause is one level below `CLOSES_PARAGRAPH`: the region scanner asks
    // `COMMENT_CLOSE.test(line)`, which is "does the line contain `-->` ANYWHERE", so the first
    // comment's terminator is read as closing the second one and no skip region opens. The
    // `still -->` line is then scanned as prose and re-opens a paragraph across the heading.
    // Fixing it means tracking the comment delimiter's POSITION — filed in BACKLOG.md.
    expect(findHeadings(doc("<!-- a --><!-- b", "still -->", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
    // …while the ordinary whole-line comment is handled by the skip region and is unaffected.
    expect(findHeadings(doc("<!-- a comment -->", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    expect(findHeadings(doc("<!-- a --><!-- b -->", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
  });

  it("RED->GREEN: the HTML and raw-TeX rows are NOT narrowable by shape — 50 measured headings", () => {
    // ⚠ THE CORRECTION. The first version of this session narrowed the HTML row to
    // `<!--`/`<?` and the raw-TeX row to a BARE macro, and scored ZERO headings lost over 476
    // rendered documents. An adversarial pass then rendered shapes none of those corpora
    // contained, and the narrowings were deleting FIFTY real headings. Both reverts below are
    // measured, and the lesson is in the docstrings: neither row's construct is decided by the
    // SHAPE of the line. Pandoc classifies by TAG and by MACRO NAME, and this scanner has
    // neither table.
    //
    // (a) HTML. `HTML_BLOCK_OPEN` carries CommonMark §4.6, but pandoc's markdown reader is not
    // CommonMark: a great many tags outside that list still open a raw HTML block. Measured,
    // every one of these renders `<h1>ATX Below</h1>` below it:
    for (const tag of ["<meta charset=\"utf-8\">", "<META charset=\"utf-8\">", "<meta>",
                       "<button>go</button>", "<button>", "<svg width='10'></svg>", "<svg>",
                       "<video controls></video>", "<audio></audio>", "<canvas></canvas>",
                       "<object></object>", "<embed src=\"x\">", "<noscript>x</noscript>",
                       "<map name=\"m\"></map>", "<output>x</output>", "<progress></progress>",
                       "<area shape=\"rect\">", "<applet></applet>", "<ins>x</ins>",
                       "<del>x</del>"]) {
      expect(findHeadings(doc(tag, "# ATX Below")).map((h) => h.text))
        .toEqual(["ATX Below"]);
    }
    // (b) Raw TeX. A braced macro is NOT automatically inline: pandoc decides by macro NAME.
    // `\textbf{bold}` is inline and swallows the heading, but every one of these is a raw
    // BLOCK and the heading below it is real (measured):
    for (const macro of ["\\vspace{1em}", "\\vspace*{1em}", "\\usepackage{amsmath}",
                         "\\newcommand{\\foo}{bar}", "\\setlength{\\parindent}{0pt}",
                         "\\definecolor{mycol}{RGB}{0,0,0}", "\\newpage[2]", "\\newpage{}",
                         "\\clearpage\\newpage", "\\clearpage \\newpage", "\\vspace2"]) {
      expect(findHeadings(doc("Intro prose.", "", macro, "# ATX Below")).map((h) => h.text))
        .toEqual(["ATX Below"]);
    }
    // (c) ⚠ INVERTED BY SESSION 188 — the shape that motivated the raw-TeX narrowing is no
    // longer a phantom. The row is narrowed by NAME rather than by shape, which is what this
    // test's own title said was required, and `\textbf{bold}` is class C.
    expect(findHeadings(doc("\\textbf{bold}", "# ATX Below")).map((h) => h.text))
      .toEqual([]);
  });

  it("RED->GREEN: only a VALID footnote label suppresses the link-reference row", () => {
    // The footnote narrowing SURVIVES the correction, because unlike the other two its rule is
    // decided by the line's shape alone and was derived from an exhaustive measured sweep of
    // 17 label spellings. A pandoc footnote label is `^` followed by one or more characters
    // that are neither whitespace nor another `^`. Anything else beginning with `[` is a link
    // reference, closes the paragraph, and must keep its heading — the first version of this
    // session used a bare `(?!\^)` and deleted all four of these.
    for (const label of ["[^]", "[^ 1]", "[^a b]", "[^^1]", "[^1^]", "[^1 ]", "[x]", "[]"]) {
      expect(findHeadings(doc("Intro line.", "", `${label}: http://e.com`, "# ATX Below"))
        .map((h) => h.text)).toEqual(["ATX Below"]);
    }
    // …and every one of these IS a footnote definition, which absorbs the line below it:
    for (const label of ["[^1]", "[^note]", "[^a-b]", "[^1a]", "[^n_1]", "[^A]", "[^a.b]",
                         "[^-]", "[^très]"]) {
      expect(findHeadings(doc("Intro line.", "", `${label}: http://e.com`, "# ATX Below"))
        .map((h) => h.text)).toEqual([]);
    }
  });

  it("test-after (mutation survivors M15/M16/M17): the three decisions nothing else pins", () => {
    // These pin behaviour this session deliberately KEPT. Each mutant survived the suite until
    // now, and each was then measured against the real renderer, where the mutant is WRONG.
    //
    // M15 — the raw-TeX row's trailing-whitespace tolerance is load-bearing, not cosmetic:
    //   `\clearpage ` (trailing space) / # ATX Below -> <h1 id="atx-below">ATX Below</h1>
    // Forbidding it (`/^ {0,3}\\[a-zA-Z]+$/`) deletes that heading.
    expect(findHeadings(doc("\\clearpage ", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    expect(findHeadings(doc("\\clearpage\t", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    //
    // M16 — the pipe row must NOT require a leading pipe, though `OPENS_FRESH_BLOCK` twenty
    // lines away does. Pandoc pipe tables need neither leading nor trailing pipes, so a real
    // table's LAST row can be `c | d`, and the heading under it is real:
    //   a | b / --|-- / c | d / # ATX Below -> <table>…</table><h1>ATX Below</h1>
    // Measured over the four corpora, requiring a leading pipe deletes 4 real headings. The
    // cost of leaving it wide is that a bare `a | b` in prose keeps its phantom — a single
    // pipe-bearing line is a table only if a DELIMITER row follows it, which no per-line
    // predicate can see. That is the trade, and it is the permitted direction.
    expect(findHeadings(doc("a | b", "--|--", "c | d", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    expect(findHeadings(doc("a | b", "--|--", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    //
    // M17 — the grid-border row must keep matching a LONE `+`. The filed item called that a
    // defect ("matches a LONE `+`, which is a bullet marker"); measurement REFUTES it, because
    // an empty bullet marker really is block-level:
    //   `+` / # ATX Below -> <ul><li></li></ul><h1 id="atx-below">ATX Below</h1>
    // Excluding it deletes 6 real headings across the corpora.
    expect(findHeadings(doc("+", "# ATX Below")).map((h) => h.text)).toEqual(["ATX Below"]);
    expect(findHeadings(doc("+ ", "# ATX Below")).map((h) => h.text)).toEqual(["ATX Below"]);
  });
});

describe("an INDENTED HTML block and a LINE BLOCK still close a paragraph (Session 185)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: an INDENTED raw HTML block opener interrupts an open paragraph", () => {
    // ⚠ HALF OF THE REGRESSION Session 183 SHIPPED, measured against the pre-S183 build.
    // S183's `paragraphOpen` bail suppresses every row of `CLOSES_PARAGRAPH` against an open
    // paragraph, and `HTML_BLOCK_OPEN` — the hoisted clause tested BEFORE that bail — capped
    // its indent at CommonMark's ` {0,3}`. So an indented block opener fell through to the
    // gated wide row and the heading below it was DELETED.
    //
    // Measured on the real render path (`quarto render --to html --no-execute`, quarto
    // 1.7.33): pandoc's html-block rule does not look at leading whitespace AT ALL. Every one
    // of these renders `<h1 id="atx-below">ATX Below</h1>` below a two-line open paragraph —
    // 0, 1, 3, 4, 5, 6 and 8 spaces, one tab, two tabs, space+tab and tab+space:
    //
    //   prose one / prose two / (indent)<div> / # ATX Below  ->  <h1>ATX Below</h1>
    //
    // ⚠ AND THE CONTROL BELOW IS WHY THE INDENT IS THE ONLY THING THAT CHANGES. At those same
    // indents an INLINE tag renders no heading whatever, so this widening must not be read as
    // "an indented `<` line is block-level" — the TAG decides, exactly as it does at column 0,
    // and `HTML_BLOCK_OPEN`'s closed tag list is what carries that decision.
    for (const indent of ["    ", "     ", "        ", "\t", "\t\t", " \t", "\t "]) {
      expect(
        findHeadings(doc("prose one", "prose two", `${indent}<div>`, "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    // …and a full block whose body and closer are indented too — the closer is the line the
    // bail used to swallow: `    <pre>` / `    code` / `    </pre>` / `# ATX Below` renders
    // `<pre>code</pre><h1>ATX Below</h1>`.
    expect(
      findHeadings(doc("prose one", "prose two", "\t<pre>", "\tcode", "\t</pre>", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // CONTROL — the inline tags must STILL yield no heading at the same indents (measured:
    // `prose one` / `prose two` / `    <span>` / `# ATX Below` renders one `<p>` and nothing
    // else). Without this assertion the test above passes for a wrong rule.
    for (const indent of ["    ", "\t"]) {
      for (const tag of ["<span>", "<em>", "<not-a-tag"]) {
        expect(
          findHeadings(doc("prose one", "prose two", `${indent}${tag}`, "# ATX Below"))
            .map((h) => h.text),
        ).toEqual([]);
      }
    }
  });

  it("RED->GREEN: a LINE BLOCK's continuation line does not open a paragraph", () => {
    // ⚠ THE OTHER HALF OF S183's REGRESSION. A pandoc line block continues a line by INDENTING
    // the next one, so a continuation looks exactly like prose to a per-line scanner: it opened
    // a paragraph in this model, and S183's bail then suppressed every row on every line after
    // it — including the `| …` line that would have closed the paragraph again. The heading
    // below the block was deleted. Measured on the real render path (quarto 1.7.33):
    //
    //   | line one / (indent)continued / | line three / # ATX Below
    //     ->  <div class="line-block">…</div><h1 id="atx-below">ATX Below</h1>
    //
    // The continuation attaches at EVERY indent — 1, 2, 3, 4 and 8 spaces, and a tab.
    for (const cont of [" ", "  ", "   ", "    ", "        ", "\t"]) {
      expect(
        findHeadings(doc("| line one", `${cont}continued`, "| line three", "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    // …and wherever in the block the continuation sits: after the last line, after a middle
    // line, twice in a row, and deepening. All four render the heading (measured).
    expect(
      findHeadings(doc("| line one", "| line two", "  continued", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("| line one", "  cont a", "  cont b", "| line four", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // CONTROL — an identically-shaped indented line under something that is NOT a line block
    // must STILL suppress the heading. Both of these render one `<p>` and no heading at all
    // (measured), and without these assertions the test above passes for "any indented line
    // is block-level", which would fabricate headings across ordinary prose.
    expect(
      findHeadings(doc("plain one", "  continued", "plain three", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual([]);
    expect(
      findHeadings(doc("a | b", "  continued", "c | d", "# ATX Below")).map((h) => h.text),
    ).toEqual([]);
  });

  it("RED->GREEN: a LINE BLOCK cannot open against an already-OPEN paragraph", () => {
    // A line block does not interrupt a paragraph — measured, and in BOTH spellings: with a
    // continuation and without one, prose above leaves the whole thing paragraph text and the
    // heading below is NOT rendered.
    //
    //   prose one / prose two / | line one / (2sp)continued / | line three / # ATX Below
    //     ->  one <p>, NO heading
    //
    // So the arm may only be set where no paragraph is already open. Without that guard the
    // continuation closes a paragraph quarto keeps open and we FABRICATE the heading — the
    // phantom direction, and the reason this is its own RED rather than part of the rule above.
    expect(
      findHeadings(doc("prose one", "prose two", "| line one", "  continued", "| line three",
                       "# ATX Below")).map((h) => h.text),
    ).toEqual([]);
    // The arm must also die at a BLANK line, which ends the block: `| line one` / (blank) /
    // `  continued` / `# ATX Below` renders a line-block div, then a paragraph that swallows
    // the heading (measured — no heading at all).
    expect(
      findHeadings(doc("| line one", "", "  continued", "# ATX Below")).map((h) => h.text),
    ).toEqual([]);
    // CONTROL — the recovery of the rule above must SURVIVE both guards. The same block with
    // no prose above it, and the same block after a blank line, still release their heading.
    expect(
      findHeadings(doc("| line one", "  continued", "| line three", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("prose one", "prose two", "", "| line one", "  continued", "| line three",
                       "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("RED->GREEN: a pipe TABLE's body row does not arm the line-block rule", () => {
    // A table's body row is spelled exactly like a line-block line, so the rule above arms on
    // it and then reads the row below as a continuation. Measured, that is wrong — the DELIMITER
    // row is what makes the block a table, and a continuation-shaped line under a table is
    // ordinary paragraph text that swallows the heading:
    //
    //   | a | b | / |---|---| / | 1 | 2 | / (2sp)continued / # ATX Below  ->  NO heading
    //
    // ⚠ The guard is safe in the DELETING direction by construction: refusing to arm merely
    // leaves the pre-Session-185 behaviour in place, so an over-eager table detection can only
    // ever forgo a recovery — it can never remove a heading we already emit.
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "| 1 | 2 |", "  continued", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual([]);
    // CONTROL — the SAME shape with no delimiter row is a line block after all, and its
    // heading is real: `| a | b |` / `| 1 | 2 |` / `  continued` / `# ATX Below` renders
    // `<div class="line-block">…</div><h1>ATX Below</h1>` (measured). This is what stops the
    // guard from being written as "any pipe-bearing run suppresses the rule".
    expect(
      findHeadings(doc("| a | b |", "| 1 | 2 |", "  continued", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // CONTROL — and the table's spell must be broken by the blank line that ends it, so a
    // genuine line block BELOW a table still works (measured: `table>div>section>h1`).
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "| 1 | 2 |", "", "| line one", "  continued",
                       "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("RED->GREEN: a line block's opener takes a TAB after the pipe, and nothing else", () => {
    // Exhaustive over the opener spellings, each rendered firsthand. `|` + TAB is a line block
    // exactly as `|` + SPACE is — both render `<div class="line-block">` and release the
    // heading below — so requiring a literal space costs one real heading.
    expect(
      findHeadings(doc("|\tline one", "  continued", "| line three", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // CONTROL — and the widening stops at `[ \t]`. These three are NOT line blocks, and each
    // renders no heading at all (measured), so arming on them would fabricate one:
    //
    //   `|line one`     prose        -> one <p>, no heading
    //   `|`             renders a line-block div, but an indented line below does NOT attach
    //   ` | line one`   the indent disqualifies it (1, 3 and 4 spaces alike)
    for (const opener of ["|line one", "|", " | line one", "   | line one", "    | line one"]) {
      expect(
        findHeadings(doc(opener, "  continued", "| line three", "# ATX Below")).map((h) => h.text),
      ).toEqual([]);
    }
  });

  it("RED->GREEN: a continuation needs LEADING whitespace, not non-blank CONTENT", () => {
    // ⚠ FOUND BY THIS SESSION'S OWN MUTATION PASS, and the mutant was MORE CORRECT than the
    // code (Learning #232). `LINE_BLOCK_CONTINUATION` was first written as `/^[ \t]+\S/` — an
    // unmeasured refinement, reasoning that a continuation "must have content". Pandoc's rule
    // is simply that the line BEGINS with whitespace. The `\S` therefore excluded any line
    // whose only content is whitespace that `BLANK_LINE` (`/^[ \t]*$/`) does not recognise —
    // a form feed, a vertical tab, a non-breaking space — and the block ended early, leaving a
    // paragraph open across the heading. Measured, all four render `<h1>ATX Below</h1>`:
    //
    //   | line one / (2sp)(form feed) / # ATX Below        ->  <div class="line-block">…<h1>
    //   | line one / (2sp)(vertical tab) / # ATX Below     ->  same
    //   | line one / (2sp)(U+00A0) / # ATX Below           ->  same
    //   | line one / (2sp)(form feed) / | line three / # ATX Below  ->  same
    //
    // Three of those four are PRE-EXISTING deletions the pre-Session-183 build loses too; the
    // fourth (the one with a `| line three` below) is one that build gets RIGHT.
    for (const ws of ["\f", "\v", " "]) {
      expect(
        findHeadings(doc("| line one", `  ${ws}`, "# ATX Below")).map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    expect(
      findHeadings(doc("| line one", "  \f", "| line three", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // CONTROL — the widening must not make a whitespace-led line block-level on its OWN
    // account. With no line block armed above it, the identical line still leaves the
    // paragraph open (or never opens a block), and quarto renders NO heading in either
    // (measured). This is what keeps the rule about line blocks rather than about indentation.
    expect(
      findHeadings(doc("plain one", "  \f", "# ATX Below")).map((h) => h.text),
    ).toEqual([]);
    expect(findHeadings(doc("  \f", "# ATX Below")).map((h) => h.text)).toEqual([]);
  });

  it("test-after (mutation survivors): a HYPHEN in a line block, and a TAB continuation", () => {
    // ⚠ WRITTEN AFTER the implementation, and labelled as such — these pin two mutants that
    // survived the suite as it stood. Neither mutant was more correct; both DELETE real
    // headings, and both were adjudicated by rendering the deciding document rather than by
    // argument (Learning #232).
    //
    // SURVIVOR `TABLE_DELIMITER_ROW -> /-/` — matching any line containing a hyphen would
    // disarm the line-block rule on ordinary prose. Nothing in the suite held a hyphen inside
    // a line block, so the over-eager guard looked harmless. All three render the heading:
    expect(
      findHeadings(doc("| line-one", "  continued", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("| line one", "  con-tinued", "| line three", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("| a - b", "  continued", "| c", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
    //
    // SURVIVOR `LINE_BLOCK_CONTINUATION -> /^ +\S/` — dropping the tab looked harmless because
    // a tab-indented continuation ALSO matches `CLOSES_PARAGRAPH`'s indented-code row, which
    // closes the paragraph by another route. What it silently loses is the RE-ARM: the block
    // ends at the tab line, so a SPACE continuation below it is read as prose again and the
    // heading is deleted. The document that separates them mixes the two indents:
    expect(
      findHeadings(doc("| line one", "\tcont a", "  cont b", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("RED->GREEN: a line-block opener with NO CONTENT after the pipe does not arm", () => {
    // ⚠ FOUND BY THE ADVERSARIAL SWEEP — a phantom this session introduced, adjudicated
    // firsthand by re-rendering and by probing the pre-Session-185 build. `|` alone was
    // already known not to take a continuation; the sweep found that `| ` and `|  ` — a pipe
    // followed by whitespace and NOTHING ELSE — behave the same way, and `/^\|[ \t]/` armed on
    // both. Measured, quarto renders no heading in either:
    //
    //   `| ` / (2sp)continued / | line three / # ATX Below   ->  NO heading
    //   `|  ` / (2sp)continued / # ATX Below                 ->  NO heading
    for (const opener of ["| ", "|  ", "|\t"]) {
      expect(
        findHeadings(doc(opener, "  continued", "| line three", "# ATX Below")).map((h) => h.text),
      ).toEqual([]);
    }
    // CONTROL — and the opener must still arm as soon as there IS content after the
    // whitespace, at one space, at several, and after a tab. All three render the heading
    // (measured), so this is a content requirement and NOT a retreat to a single-space rule.
    for (const opener of ["| line one", "|  line one", "|\tline one"]) {
      expect(
        findHeadings(doc(opener, "  continued", "# ATX Below")).map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
  });

  it("RED->GREEN: a GRID table's border is a table rule too, and the rule tolerates odd trailing whitespace", () => {
    // ⚠ TWO MORE PHANTOMS FOUND BY THE ADVERSARIAL SWEEP, both adjudicated by re-rendering.
    // The table guard only recognised the PIPE-table delimiter row, so two documents slipped
    // past it and armed the line-block rule on what is really a table body row:
    //
    //   +---+---+ / | a | b | / +---+---+ / | line one / (2sp)continued / # ATX Below
    //       a GRID table — its rule is `+---+---+`, which the pipe delimiter never matched
    //   | a | b | / |---|---|(form feed) / | 1 | 2 | / (2sp)continued / # ATX Below
    //       a pipe delimiter whose trailing whitespace is a FORM FEED, which `[ \t]*$` rejects
    //
    // Quarto renders NO heading in either.
    expect(
      findHeadings(doc("+---+---+", "| a | b |", "+---+---+", "| line one", "  continued",
                       "# ATX Below")).map((h) => h.text),
    ).toEqual([]);
    expect(
      findHeadings(doc("| a | b |", "|---|---|\f", "| 1 | 2 |", "  continued", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual([]);
    // CONTROL — the guard must still die at the blank line that ends the table, so a genuine
    // line block below a GRID table works. Measured: this one DOES render the heading, and it
    // is the assertion that stops the fix from being "a `+` anywhere suppresses the rule".
    expect(
      findHeadings(doc("+---+---+", "| a | b |", "+---+---+", "", "| line one", "  continued",
                       "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("RED->GREEN: a table's spell is broken by any block boundary, not only by a blank line", () => {
    // ⚠ THE ADVERSARIAL SWEEP'S SHARPEST FINDING about this session's own guard. `inPipeTable`
    // was cleared ONLY on a blank line, so a comment, a fence or a heading between a table and
    // a genuine line block left the guard armed and the heading below was never recovered.
    // These are RESIDUALS rather than regressions — the pre-Session-185 build loses them too —
    // but they are losses this session's own state introduced the possibility of fixing.
    //
    // ⚠ The phantom risk was measured before the flag was cleared more eagerly, and there is
    // none: a comment, a fence and a heading each really do END the table, so the `| …` run
    // below them is a fresh line block. Every document here renders the heading.
    const tail = ["| line one", "  continued", "# ATX Below"];
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "<!-- note -->", ...tail)).map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "<!-- note", "still note -->", ...tail))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "```", "code", "```", ...tail)).map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // …and the same holds when what follows the boundary is a table BODY row rather than a
    // fresh line block — measured, quarto renders the heading in all three.
    const bodyTail = ["| 1 | 2 |", "  continued", "# ATX Below"];
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "<!-- x -->", ...bodyTail)).map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "```", "code", "```", ...bodyTail))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "# Heading", ...bodyTail)).map((h) => h.text),
    ).toEqual(["Heading", "ATX Below"]);
    // CONTROL — a CONTIGUOUS table must still disarm the rule. If the flag is cleared too
    // eagerly this returns the phantom that RED 4 exists to prevent.
    expect(
      findHeadings(doc("| a | b |", "|---|---|", "| 1 | 2 |", "  continued", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual([]);
  });
});

describe("the HTML block-tag rule is pandoc's, and it is CONTEXT-DEPENDENT (Session 187)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN 1: a pandoc block tag OUTSIDE CommonMark §4.6 interrupts an open paragraph", () => {
    // ⚠ FAMILY (a) of Session 183's deletion item — the last one open, heading-DELETING,
    // filed HIGH. `HTML_BLOCK_OPEN` carried CommonMark §4.6 conditions 1+6; pandoc classifies
    // by NAME from its OWN sets (`Text.Pandoc.Readers.HTML.TagCategories`, pandoc 3.6.3 —
    // the build quarto 1.7.33 bundles), and `blockTags` there is
    // `blockHtmlTags ∪ blockDocBookTags ∪ epubTags`. 47 of those names were missing from our
    // list, so every one of them lost the heading below it against an open paragraph.
    //
    // Measured on the real render path, one document per name — each renders
    // `<h1>ATX Below</h1>`, which the CommonMark list deletes:
    //
    //   prose one / prose two / <meta charset="utf-8"> / # ATX Below  ->  <h1>ATX Below</h1>
    //
    // The DocBook names are not decoration: pandoc folds `blockDocBookTags` into the same set
    // precisely so raw DocBook survives a markdown document, so `<note>`, `<warning>` and
    // `<para>` really are block openers on this path.
    for (const tag of [
      "<meta charset=\"utf-8\">", // blockHtmlTags — the exact document family (a) names
      "<canvas>",
      "<output>",
      "<hgroup>",
      "<isindex>",
      "<note>", // blockDocBookTags
      "<warning>",
      "<para>",
      "<programlisting>",
      "<itemizedlist>",
      "<switch>", // epubTags
      "<case>",
    ]) {
      expect(
        findHeadings(doc("prose one", "prose two", tag, "# ATX Below")).map((h) => h.text),
        `${tag} must interrupt an open paragraph`,
      ).toEqual(["ATX Below"]);
    }
    // CONTROL — an inline tag must STILL yield no heading, or this passes for the wrong rule
    // (namely "any `<` line is block-level", which is the row Session 184 measured deleting
    // 20 real headings). Measured: each renders one `<p>` holding all four lines.
    for (const tag of ["<span>", "<em>", "<not-a-real-tag>", "<my-widget>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", tag, "# ATX Below")).map((h) => h.text),
        `${tag} must NOT interrupt an open paragraph`,
      ).toEqual([]);
    }
  });

  it("RED->GREEN 2: against an OPEN paragraph, ONLY pandoc's blockTags interrupt", () => {
    // Two different reasons a tag we carried is wrong here, and they are NOT the same defect:
    //
    // (i)  NOT IN PANDOC'S SETS AT ALL — `base`, `basefont`, `dialog`, `frame`, `legend`,
    //      `link`, `menuitem`, `optgroup`, `option`, `param`. CommonMark §4.6 lists them;
    //      pandoc does not. `<basefont size="3">` is the measured case (CHANGELOG: BACKLOG.md
    //      holds only open work, Session 195 — salvaged there when the S187 record was drained).
    //
    // (ii) IN `eitherBlockOrInline`, WHICH IS NOT `blockTags` — `iframe`, `source`, `track`,
    //      `ins`, `del`, `button`, `svg`, `video`, `audio`, `object`, `embed`, `noscript`,
    //      `map`, `progress`, `area`, `applet`. The set name is the rule: they are block
    //      where a block can start and INLINE where a paragraph is already open. Only their
    //      first-context answer is asserted here; RED->GREEN 5 asserts the other context.
    //
    // ⚠ THIS REFUTES THE FILED ITEM'S CENTRAL CLAIM, and the refutation is measured.
    // The filed item stated "the rule is not a shape: `<ins>x</ins>` opens a block and
    // `<em>x</em>` does not", and lists `<svg>`, `<button>`, `<video>`, `<audio>`,
    // `<object>`, `<embed>`, `<noscript>`, `<map>`, `<progress>`, `<area>`, `<applet>`,
    // `<ins>` and `<del>` as block openers. Rendered on the real path, quarto 1.7.33:
    //
    //   prose one / prose two / <ins>x</ins> / # ATX Below -> <p>… <ins>x</ins> # ATX Below</p>
    //   prose one / prose two / <em>x</em>   / # ATX Below -> <p>… <em>x</em> # ATX Below</p>
    //
    // BYTE-FOR-BYTE THE SAME SHAPE. The item conflated `blockTags` with `eitherBlockOrInline`;
    // of the sixteen names it lists only `meta`, `canvas` and `output` are in `blockTags`, and
    // those three are asserted in RED->GREEN 1 above.
    //
    // (iii) `textarea` and `title` are in `blockTags` and still do NOT open a block here:
    //      both are RCDATA elements, so an unclosed opener swallows the rest of the document
    //      as text and the `# ATX Below` below it never becomes a heading at all. Their
    //      CLOSERS behave differently — see RED->GREEN 3, which is why this cannot be a
    //      single symmetric list.
    for (const tag of [
      "<base>", "<basefont size=\"3\">", "<dialog>", "<frame>", "<legend>",
      "<link>", "<menuitem>", "<optgroup>", "<option>", "<param>",
      "<iframe>", "<source>", "<track>", "<ins>x</ins>", "<del>", "<button>",
      "<svg>", "<video>", "<audio>", "<object>", "<embed>", "<noscript>",
      "<map>", "<progress>", "<area>", "<applet>",
      "<textarea>", "<title>",
    ]) {
      expect(
        findHeadings(doc("prose one", "prose two", tag, "# ATX Below")).map((h) => h.text),
        `${tag} must NOT interrupt an open paragraph`,
      ).toEqual([]);
    }
    // CONTROL — the recovering direction must survive the narrowing. Without this the test
    // above passes for "no `<` line is ever block-level", which deletes 98 tags' worth of
    // real headings.
    for (const tag of ["<div>", "<meta charset=\"utf-8\">", "<pre>", "<note>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", tag, "# ATX Below")).map((h) => h.text),
        `${tag} must still interrupt an open paragraph`,
      ).toEqual(["ATX Below"]);
    }
  });

  it("RED->GREEN 3: the OPENER list and the CLOSER list are NOT the same list", () => {
    // ⚠ THE SINGLE-LIST ASSUMPTION IS UNSAFE IN THE DELETING DIRECTION, and it took a
    // rendered document per spelling to see it. `HTML_BLOCK_OPEN` matches `</?` — one list
    // for both — and three names measure differently by direction:
    //
    //   <textarea>  no heading   |  </textarea>  HEADING   (RCDATA: the unclosed opener
    //   <title>     no heading   |  </title>     HEADING    swallows the rest of the
    //                                                       document as text, so the
    //                                                       heading below never forms)
    // Dropping `textarea`/`title` symmetrically — the obvious reading of "their openers are
    // inline" — DELETES the heading below every `</textarea>` and `</title>`, which is the
    // direction this project never takes. So the closer list is the opener list PLUS those
    // two: 100 names against 98.
    for (const line of ["</textarea>", "</title>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", line, "# ATX Below")).map((h) => h.text),
        `${line} must close an open paragraph even though its opener does not`,
      ).toEqual(["ATX Below"]);
    }
    // CONTROL — the opener side of the same two names, so the asymmetry is pinned from both
    // directions and neither list can silently collapse into the other.
    for (const line of ["<textarea>", "<title>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", line, "# ATX Below")).map((h) => h.text),
      ).toEqual([]);
    }
  });

  it("RED->GREEN 4: a SETEXT underline sees the eitherBlockOrInline class too", () => {
    // `HTML_BLOCK_OPEN` has a THIRD consumer — `opensFreshBlock`, which decides whether the
    // line BELOW a construct starts a fresh paragraph and can therefore be claimed by a setext
    // underline. Class 1 is tested there ahead of the bail; class 2 was tested NOWHERE, so
    // with no paragraph open a setext heading under `<ins>` was simply lost.
    //
    // ⚠ OPPOSITE SAFETY POLARITY — this list ADDS headings (see `OPENS_FRESH_BLOCK`), into the
    // outline, breadcrumbs, sticky scroll, workspace symbols AND the cross-reference index. So
    // it is measured in its own context rather than inferred from the ATX result: one document
    // per name, `<T>` / Title / ===, verdict `h1:Title` EXACTLY. An inline tag also yields a
    // setext heading there, but one whose text is `<em> Title` — a different answer, and
    // scoring it as agreement would have hidden the whole defect.
    for (const tag of ["<ins>", "<del>", "<svg>", "<button>", "<video>", "<audio>",
                       "<object>", "<embed>", "<noscript>", "<map>", "<progress>",
                       "<area>", "<applet>", "<iframe>", "<source>", "<track>"]) {
      expect(
        findHeadings(doc(tag, "Title", "===")).map((h) => h.text),
        `${tag} must make the line below it a fresh paragraph`,
      ).toEqual(["Title"]);
    }
    // CONTROL — an inline tag must NOT, or this passes for "any `<` line opens a block",
    // which is the polarity that fabricates headings. Measured: `<em>` / Title / === renders
    // a setext heading whose text is `<em> Title`, i.e. the paragraph was never interrupted.
    for (const tag of ["<em>", "<span>", "<not-a-real-tag>", "<base>", "<!DOCTYPE html>"]) {
      expect(
        findHeadings(doc(tag, "Title", "===")).map((h) => h.text),
        `${tag} must NOT make the line below it a fresh paragraph`,
      ).toEqual([]);
    }
    // CONTROL — and class 2 must stay INLINE against an OPEN paragraph in this consumer too,
    // which is the whole reason it cannot simply be folded into `HTML_BLOCK_OPEN`.
    expect(findHeadings(doc("prose one", "<ins>", "Title", "===")).map((h) => h.text)).toEqual([]);
  });

  it("RED->GREEN 5: a BALANCED RCDATA element on one line closes; so does a `</?…>` PI closer", () => {
    // ⚠ THREE DELETIONS THIS SESSION INTRODUCED, caught by the two-direction corpus score
    // and NOT by any test written before it. Both are consequences of the narrowing above:
    //
    // (a) `textarea` and `title` were dropped from the OPENER list because their UNCLOSED
    //     openers swallow the document as RCDATA. But `<title>Hello</title>` — opener and
    //     closer on ONE line — swallows nothing: the element is balanced, so the paragraph
    //     really is interrupted and the heading below is REAL. Our regexes anchor at the
    //     start of the line, so neither the opener branch (name not in the list) nor the
    //     closer branch (line does not begin with `</`) matched it.
    //     `<title>Hello</title>` is not a corner case; it is what raw HTML in a document
    //     looks like.
    //
    // (b) `</?xml>` — a processing-instruction CLOSER. The new row grew a `<?` branch for
    //     `<?xml …?>` and had no `</?` branch, so the closer was lost. This one is a
    //     PRE-EXISTING loss in the setext context too, recovered here as a side effect.
    //
    // Measured, all five on the real render path — every one renders `<h1>ATX Below</h1>`.
    for (const line of ["<textarea>x</textarea>", "<title>x</title>", "<title>Hello</title>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", line, "# ATX Below")).map((h) => h.text),
        `${line} is BALANCED, so it interrupts the paragraph`,
      ).toEqual(["ATX Below"]);
      expect(
        findHeadings(doc(line, "# ATX Below")).map((h) => h.text),
        `${line} with no paragraph open`,
      ).toEqual(["ATX Below"]);
    }
    expect(findHeadings(doc("</?xml>", "# ATX Below")).map((h) => h.text)).toEqual(["ATX Below"]);
    // CONTROL — the UNBALANCED opener must still open nothing, or the fix has simply undone
    // RED->GREEN 2 and re-armed the RCDATA swallow.
    for (const line of ["<textarea>", "<title>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", line, "# ATX Below")).map((h) => h.text),
        `${line} unbalanced must still open nothing`,
      ).toEqual([]);
    }
    // CONTROL — a balanced INLINE element on one line must still open nothing.
    for (const line of ["<em>x</em>", "<span>hi</span>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", line, "# ATX Below")).map((h) => h.text),
      ).toEqual([]);
    }
  });

  it("RED->GREEN 6: the TAIL of the line decides too — a tag with trailing text is PROSE", () => {
    // ⚠ EVERY DEFECT THIS SESSION INTRODUCED HAD ONE ROOT CAUSE: the predicates looked only at
    // the HEAD of the line. Found by a ten-lens adversarial sweep whose authors had never seen
    // this session's corpora — 219 documents, all rendered — and NOT by any corpus I designed,
    // because every probe I wrote put the tag ALONE on its line. That axis was invisible to me.
    //
    // Measured, and it is one rule in three disguises. A tag line is a block opener only if,
    // after the tag name, the line either ENDS AT A `>` (trailing whitespace allowed) or
    // contains no `>` at all (pandoc's tag parser spans newlines, so the `>` may be below):
    //
    //   <div>                          block     ends at `>`
    //   <div>x</div>                   block     ends at `>`
    //   <title>Doc</title id="y">      block     ends at `>` — a CLOSER may carry attributes
    //   <div class="x"                 block     no `>` on this line; it is below
    //   <div> trailing text            PROSE     does not end at `>`
    //   </note> and that is deliberate PROSE     ditto
    //   <!-- x --> trailing text       PROSE     ditto
    //
    // The three DELETIONS below are the sharpest: my one-line RCDATA branch demanded the
    // closer be exactly `</title>` with only spaces or tabs before the `>`. Real closers carry
    // attributes, and one probe used a form feed. That was an unmeasured narrowing written
    // into a session whose entire subject is unmeasured narrowings — Session 185 lost four
    // headings to the identical mistake one session ago.
    for (const line of ["<title>Doc</title id=\"y\">", "<textarea rows=2>x</textarea class=\"y\">",
                        "<title>x</title\f>"]) {
      expect(
        findHeadings(doc("prose one", "prose two", line, "# ATX Below")).map((h) => h.text),
        `${line} is a BALANCED pair — the closer's attributes do not stop it closing`,
      ).toEqual(["ATX Below"]);
    }
    // …and the trailing-text phantoms, in both consumers.
    for (const line of ["<note> trailing text", "</note> and that is deliberate.",
                        "<ins> trailing text", "<!-- x --> trailing text"]) {
      expect(
        findHeadings(doc(line, "Title", "===")).map((h) => h.text),
        `${line} must not open a fresh block`,
      ).toEqual([]);
      expect(
        findHeadings(doc("prose one", "prose two", line, "# ATX Below")).map((h) => h.text),
        `${line} must not interrupt an open paragraph`,
      ).toEqual([]);
    }
    // CONTROL — the same tags with NOTHING after the `>` must still work, in both consumers,
    // or the narrowing has simply deleted the whole feature.
    for (const line of ["<note>", "</note>", "<ins>", "<!-- x -->", "<div>", "<div>x</div>",
                        "<title>x</title>", "<div class=\"x\""]) {
      expect(
        findHeadings(doc(line, "# ATX Below")).map((h) => h.text),
        `${line} must still leave the paragraph closed`,
      ).toEqual(["ATX Below"]);
    }
  });

  it("RED->GREEN 7: the eitherBlockOrInline class needs COLUMN ZERO; blockTags does not", () => {
    // ⚠ ANOTHER AXIS NO CORPUS OF MINE VARIED — I measured the indent rule for class 1
    // (Session 185 established pandoc ignores leading whitespace there) and then reused
    // ` {0,3}` for class 2 without measuring it. The sweep rendered an indented `<button>`.
    //
    // Measured, `Intro.` / (blank) / (indent)`<button>` / Title / `===`:
    //   indent 0      -> h1:Title      block
    //   indent 1, 3   -> NO heading    NOT block  ← we said block
    //   indent 4, tab -> h1:Title      block, but via the INDENTED-CODE rule, not the tag
    // …while `<div>` — class 1 — is block at 0, 1, 3, 4 and tab alike.
    //
    // So the two classes genuinely have different indent rules, and the 4-space and tab rows
    // are a confound rather than evidence: they are block because 4+ spaces with no paragraph
    // open is an indented code block, which this file already claims on another row.
    expect(findHeadings(doc("<button>", "Title", "===")).map((h) => h.text)).toEqual(["Title"]);
    for (const indent of [" ", "   "]) {
      expect(
        findHeadings(doc("Intro sentence.", "", `${indent}<button>`, "Title", "===")).map((h) => h.text),
        `an eitherBlockOrInline tag at indent ${indent.length} is NOT block`,
      ).toEqual([]);
    }
    // CONTROL — class 1 must keep its indent tolerance, which Session 185 measured and shipped.
    for (const indent of ["", " ", "   "]) {
      expect(
        findHeadings(doc("Intro sentence.", "", `${indent}<div>`, "Title", "===")).map((h) => h.text),
        `a blockTags tag at indent ${indent.length} IS block`,
      ).toEqual(["Title"]);
    }
  });

  it("KNOWN RESIDUAL: a STRAY `</script>` keeps its phantom, and removing it would DELETE", () => {
    // ⚠ THIS PHANTOM IS RETAINED ON PURPOSE, and the decision is measured in both directions.
    // Pandoc's `isInlineTag` carries the explicit case `TagClose "script" -> True`, so a
    // STRAY `</script>` really is inline and we really do fabricate the heading below it:
    //
    //   prose one / prose two / </script>  / # ATX Below  ->  NO heading, and we emit one
    //
    // The obvious repair — drop `script` from the CLOSER list, which is what the measurement
    // of the stray shape alone says — was implemented, and the EXISTING Session 184 test
    // caught it deleting a real heading:
    //
    //   line one / line two / <script> / var x = 1; / </script> / # ATX Below -> <h1>ATX Below</h1>
    //
    // Both `</script>` lines are byte-identical. What differs is whether a raw block is OPEN
    // above them, which is precisely the state a per-line scanner does not have — the same
    // reason `CLOSER_LINE` is tested before the `paragraphOpen` bail. One rare phantom is the
    // permitted direction; deleting the heading after every real `<script>` block is not.
    expect(
      findHeadings(doc("prose one", "prose two", "</script>", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]); // ← quarto renders NO heading here. Retained, not endorsed.
    // CONTROL — the shape the retention protects, in both positions.
    for (const above of [["line one", "line two"], []]) {
      expect(
        findHeadings(doc(...above, "<script>", "var x = 1;", "</script>", "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
  });
});

describe("the raw-TeX macro rule is pandoc's, and it has THREE classes (Session 188)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: a class-A macro INTERRUPTS an open paragraph; a class-B macro does not", () => {
    // Pandoc's markdown reader has NO raw-TeX guard in `endline` — a newline never ends a
    // paragraph on account of TeX below it. What ends the paragraph is that no INLINE parser
    // consumes the backslash, and the guard that decides it is `inlineCommand'`:
    //
    //     guard $ isInlineCommand name || not (isBlockCommand name)
    //
    // which FAILS only for a name in `blockSet \ inlineSet`. That set is class A, and it is
    // the ONLY class that interrupts an open paragraph. Measured, one rendered document per
    // name, over 736 candidate names in three contexts (4,416 documents):
    for (const macro of ["\\maketitle", "\\usepackage{amsmath}", "\\listoffigures",
                         "\\addcontentsline{toc}{section}{x}", "\\markboth{L}{R}",
                         "\\section{Heading}", "\\par"]) {
      expect(findHeadings(doc("prose one", "prose two", macro, "# ATX Below")).map((h) => h.text))
        .toEqual(["ATX Below"]);
    }
    // CONTROL — class B is block only where NO paragraph is open, so against an OPEN one these
    // are INLINE and the `#` line below them is paragraph text. Five names sit in BOTH of
    // pandoc's lists on purpose (`clearpage hspace newpage pagebreak vspace`), and an UNKNOWN
    // macro behaves the same way. Widening class A to cover them deletes nothing but fabricates
    // a heading under every one of them.
    for (const macro of ["\\clearpage", "\\newpage", "\\vspace{1em}", "\\hspace{1em}",
                         "\\pagebreak", "\\setlength{\\parindent}{0pt}", "\\foobarbazqux"]) {
      expect(findHeadings(doc("prose one", "prose two", macro, "# ATX Below")).map((h) => h.text))
        .toEqual([]);
    }
    // CONTROL — class C is inline in EVERY context.
    for (const macro of ["\\textbf{bold}", "\\emph{x}", "\\noindent", "\\index{x}"]) {
      expect(findHeadings(doc("prose one", "prose two", macro, "# ATX Below")).map((h) => h.text))
        .toEqual([]);
    }
  });

  it("RED->GREEN: a class-C macro is not a block even where NO paragraph is open", () => {
    // The narrowing the filed item asked for, and the DELETING direction. Session 184 already
    // narrowed this row once — to a bare macro alone on its line — scored ZERO headings lost
    // over 476 rendered documents, and was then measured deleting 11 real headings. A clean
    // corpus score is evidence about the corpus (Learning #239), so every name here has a
    // rendered document that decides it.
    //
    // Class C is `inlineSet \ blockSet` (316 names). With no paragraph open these open a
    // PARAGRAPH, which then swallows the `#` line under pandoc's `blank_before_header`:
    for (const macro of ["\\textbf{bold}", "\\emph{x}", "\\noindent", "\\index{x}",
                         "\\textit{x}", "\\footnote{x}", "\\cite{x}", "\\ref{x}"]) {
      expect(findHeadings(doc(macro, "# ATX Below")).map((h) => h.text)).toEqual([]);
    }
    // CONTROL — the eleven spellings the filed item names, EVERY ONE re-rendered this session
    // (Learning #251: an item labelled MEASURED can still be false). All eleven really are raw
    // BLOCKS where no paragraph is open, and narrowing must not touch one of them:
    for (const macro of ["\\vspace{1em}", "\\vspace*{1em}", "\\usepackage{amsmath}",
                         "\\newcommand{\\foo}{bar}", "\\setlength{\\parindent}{0pt}",
                         "\\definecolor{mycol}{RGB}{0,0,0}", "\\newpage[2]", "\\newpage{}",
                         "\\clearpage\\newpage", "\\clearpage \\newpage", "\\vspace2"]) {
      expect(findHeadings(doc(macro, "# ATX Below")).map((h) => h.text)).toEqual(["ATX Below"]);
    }
    // CONTROL — an UNKNOWN macro is class B, not class C. Defaulting the other way would
    // delete a heading under every macro pandoc has never heard of, which is most of them.
    for (const macro of ["\\foobarbazqux", "\\myCustomMacro{a}"]) {
      expect(findHeadings(doc(macro, "# ATX Below")).map((h) => h.text)).toEqual(["ATX Below"]);
    }
  });

  it("test-after (KNOWN RESIDUAL): arity beyond the first argument group is not modelled", () => {
    // The ONE phantom this session's class-A widening introduced, disclosed rather than hidden.
    // `\usepackage` takes exactly one braced argument, so a SECOND group is left over, opens a
    // paragraph, and swallows the heading — quarto renders none. `\maketitle` reaches the same
    // bytes through `treatAsBlock`, whose raw grab takes the group, so there its heading is
    // real. Both measured; the pair is why per-macro arity, not brace-counting, is what would
    // be needed, and that is beyond a per-line predicate.
    expect(
      findHeadings(doc("prose one", "prose two", "\\usepackage{amsmath}{}", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]); // quarto: NO heading — the disclosed phantom
    expect(
      findHeadings(doc("prose one", "prose two", "\\maketitle{}", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]); // quarto: heading — agreement
  });
});

describe("a raw-TeX block starts at the CONTAINING BLOCK's content column (Session 189)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: at top level the column is 0, and inside a list item it is the item's", () => {
    // The filed item's two claims, BOTH re-rendered this session before a line of code was
    // written (Learning #251), and both hold. `\clearpage` is class B — a raw BLOCK only where
    // no paragraph is open — and pandoc's `rawTeXBlock` requires the backslash at the CURRENT
    // parse column, which after a newline is column 0. So at top level 1, 2 and 3 spaces are
    // not a block at all; the macro opens a PARAGRAPH and `blank_before_header` then swallows
    // the `#` line. Three phantoms per macro, measured:
    for (const indent of [" ", "  ", "   "]) {
      expect(findHeadings(doc(indent + "\\clearpage", "# ATX Below")).map((h) => h.text))
        .toEqual([]);
    }
    // CONTROL — column 0 is still a block. This is the whole reason the row exists, and a
    // narrowing that took it would delete a real heading under every raw-TeX block.
    expect(findHeadings(doc("\\clearpage", "# ATX Below")).map((h) => h.text))
      .toEqual(["ATX Below"]);
    // CONTROL — and the column is NOT literally 0: inside a list item pandoc re-parses the
    // item's content DEDENTED, so the item's own content column is that item's column 0.
    // `- ` gives 2. Session 184 implemented the column-0 form WITHOUT this, measured it
    // removing 3 phantoms against 1 REAL HEADING DELETED, and rejected it on that basis —
    // this control is that rejection, kept as an assertion.
    expect(
      findHeadings(doc("- line one", "  line two", "", "  \\clearpage", "  # ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // CONTROL — and it really is the item's column, not "any indent inside a list": 1 and 3
    // are as dead inside the item as they are at top level (measured, both directions).
    for (const indent of [" ", "   "]) {
      expect(
        findHeadings(doc("- line one", "  line two", "", indent + "\\clearpage", indent + "# ATX Below"))
          .map((h) => h.text),
      ).toEqual([]);
    }
  });

  it("test-after: the marker->column table, and every row of it was measured", () => {
    // 2,394 rendered documents — 19 marker spellings × 7 spacings × 2 marker indents × a 0–8
    // indent sweep. The rule is `markerIndent + markerLength + spacesAfter`, and the three
    // corrections below are the entire reason it is a function rather than arithmetic.
    // ⚠ The heading rides at column 0 while the MACRO sweeps, deliberately: pandoc's
    // `rawTeXBlock` ends with `spaces`, which swallows the NEXT line's leading whitespace, so
    // the heading's own indent is measured irrelevant once the macro has made a block. Holding
    // it at 0 isolates the axis under test from `ATX_HEADING`'s own ` {0,3}`, which is a
    // different row with a different (pre-existing, filed) defect — an indented heading at
    // column 4+ is lost whatever this row decides. Every shape below re-rendered in this form.
    const at = (first: string, col: number) =>
      findHeadings(doc(first, "", " ".repeat(col) + "\\clearpage", "# ATX Below")).map((h) => h.text);
    // The plain cases: one space after the marker, and the marker's own length.
    expect(at("- line one", 2)).toEqual(["ATX Below"]);
    expect(at("1. line one", 3)).toEqual(["ATX Below"]);
    expect(at("100. line one", 5)).toEqual(["ATX Below"]);
    // FIVE or more spaces after the marker COLLAPSE to one — the content is a code block
    // inside the item and the item's own column is `marker + 1`. Four spaces is the last that
    // counts, and the pair below is the boundary:
    expect(at("-    line one", 5)).toEqual(["ATX Below"]); // four spaces -> column 5
    expect(at("-     line one", 2)).toEqual(["ATX Below"]); // five spaces -> column 2, not 6
    // ⚠ Column 6 is NOT this row's to refuse and the first draft of this pin asserted that it
    // was — quarto renders the heading here (re-rendered). Six spaces inside a column-2 item
    // is four past that item's own column, which is an INDENTED CODE BLOCK, and a code block
    // is a block: the heading below it is real. It reaches the Outline through
    // `INDENTED_CODE_LINE`, a different row, whatever this one decides.
    expect(at("-     line one", 6)).toEqual(["ATX Below"]);
    // A TAB after the marker expands to the next multiple of 4 COLUMNS, not to a fixed count:
    expect(at("-\tline one", 4)).toEqual(["ATX Below"]);
    expect(at("100.\tline one", 8)).toEqual(["ATX Below"]);
    // A marker ALONE on its line gobbles nothing, so `-` gives column 1 — not CommonMark's 2.
    expect(at("-", 1)).toEqual(["ATX Below"]);
    expect(at("-", 2)).toEqual([]);
    // ⚠ The FANCY list markers CommonMark does not have. A scanner written against CommonMark
    // opens no container for these and DELETES the heading in every one — `iv.` did exactly
    // that in this session's own first draft, and the corpus score caught it.
    expect(at("iv. line one", 4)).toEqual(["ATX Below"]);
    expect(at("a. line one", 3)).toEqual(["ATX Below"]);
    expect(at("(1) line one", 4)).toEqual(["ATX Below"]);
    expect(at("#. line one", 3)).toEqual(["ATX Below"]);
    // A footnote definition and a definition-list definition both give their content exactly
    // 4 columns. ⚠ Measured with a LIVE `See[^1]` reference: an UNREFERENCED footnote is
    // dropped from the rendered output entirely, so a corpus that omits the reference reads
    // "no heading" at every indent and concludes the container does not exist. It does.
    expect(at("[^1]: note one", 4)).toEqual(["ATX Below"]);
    expect(at(":   definition one", 4)).toEqual(["ATX Below"]);
  });

  it("test-after: a BLOCK QUOTE suspends the column rule, because we cannot compute its column", () => {
    // The single largest deletion trap in this change, and it is why `quoteOpen` exists.
    // `> quoted` / `>` / `   \clearpage` / `   # ATX Below` renders the heading INSIDE the
    // <blockquote> at EVERY indent 0–8 — verified against the rendered HTML at three indents,
    // not inferred — because pandoc strips the quote's markers and re-parses what is left.
    // This model carries no block-quote container, so rather than guess a column it keeps the
    // OLD ` {0,3}` width here: phantoms, never deletions.
    for (const indent of ["", " ", "  ", "   "]) {
      expect(
        findHeadings(doc("> quoted one", ">", indent + "\\clearpage", indent + "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    // CONTROL — a TRULY blank line ends the quote (measured), and the column rule resumes, so
    // the same indents are dead again. If this ever starts passing at indent 1–3, `quoteOpen`
    // has stopped being cleared and the top-level phantoms are back.
    for (const indent of [" ", "  ", "   "]) {
      expect(
        findHeadings(doc("> quoted one", "", indent + "\\clearpage", indent + "# ATX Below"))
          .map((h) => h.text),
      ).toEqual([]);
    }
    expect(
      findHeadings(doc("> quoted one", "", "\\clearpage", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("test-after: a container's column survives blank lines and dies at a shallower line", () => {
    // Measured: one, two and three blank lines all keep a `- ` item's column 2 alive…
    for (const blanks of [[""], ["", ""], ["", "", ""]]) {
      expect(
        findHeadings(doc("- line one", ...blanks, "  \\clearpage", "  # ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    // …a paragraph at column 0 closes the item, so column 2 is dead below it…
    expect(
      findHeadings(doc("- line one", "", "top level para", "", "  \\clearpage", "  # ATX Below"))
        .map((h) => h.text),
    ).toEqual([]);
    // …but a LAZY CONTINUATION does not, because a shallow line under an OPEN paragraph is
    // that paragraph's, not a new block. The two documents differ only by a blank line.
    expect(
      findHeadings(doc("- line one", "line two lazy", "", "  \\clearpage", "  # ATX Below"))
        .map((h) => h.text),
    ).toEqual(["ATX Below"]);
    // Every ANCESTOR column stays open, not merely the innermost — measured [0,2,4,6].
    const nested = ["- a", "", "  - b", "", "    - c", "      c two", ""];
    for (const col of [0, 2, 4, 6]) {
      expect(
        findHeadings(doc(...nested, " ".repeat(col) + "\\clearpage", "# ATX Below")).map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    // …and an indent BETWEEN two open columns is dead, so this really is the COLUMNS and not
    // "anything deep enough". Quarto renders nothing at 1, 3 or 5 on these same bytes.
    for (const col of [1, 3]) {
      expect(
        findHeadings(doc(...nested, " ".repeat(col) + "\\clearpage", "# ATX Below")).map((h) => h.text),
      ).toEqual([]);
    }
    // ⚠ This WAS a KNOWN RESIDUAL and Session 193 CLOSED it — RE-RENDERED, not flipped to match
    // the code. Column 5 is a between-columns indent quarto refuses, but 5 ≥ 4 so the old
    // literal-4 indented-code row claimed the line as a code block and closed the paragraph
    // before this row was consulted. `indentedCodeLine` measures from the deepest open column
    // (6 here is above 5, so the base is 4) and the threshold is 8, which 5 does not reach.
    expect(
      findHeadings(doc(...nested, "     \\clearpage", "# ATX Below")).map((h) => h.text),
    ).toEqual([]); // quarto: NO heading (re-rendered — pins/p01)
    // …and the two indents NO pin had ever covered, which is where the code threshold and the
    // raw-TeX columns come apart. 7 is past every open column and still short of code; 10 is
    // 6 + 4 and really IS an indented code block inside the innermost item, so the heading
    // below it is real. Both re-rendered (pins/p05, pins/p06).
    expect(
      findHeadings(doc(...nested, "       \\clearpage", "# ATX Below")).map((h) => h.text),
    ).toEqual([]);
    expect(
      findHeadings(doc(...nested, "          \\clearpage", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("the indented-code row WAS column-blind — Session 189 disclosed it, Session 193 closed it", () => {
    // Kept where Session 189 filed it, as the record of a residual that was disclosed rather
    // than hidden and then fixed. It accounted for 36 of the 41 residual phantoms Session 189's
    // own corpus score left standing across 4,125 documents, and its fix was exactly what the
    // pin predicted: the same `contentColumns` state, applied to one more row. The full
    // threshold sweep lives in the Session 193 describe at the foot of this file; these two
    // documents are the pin's own, re-rendered (pins/p07, pins/p08).
    expect(
      findHeadings(doc("- line one", "  line two", "", "    \\clearpage", "# ATX Below"))
        .map((h) => h.text),
    ).toEqual([]); // quarto: NO heading — 4 spaces is +2 inside a column-2 item
    // CONTROL — at TOP level the same four spaces really ARE indented code, and the heading
    // below really is rendered. The row was never wrong, it was column-blind.
    expect(
      findHeadings(doc("    \\clearpage", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });

  it("test-after (KNOWN RESIDUAL): `A. x` is not a list, and we admit its column anyway", () => {
    // The ONE phantom this session's push rule introduces, disclosed rather than hidden.
    // `A. x` — a single capital with EXACTLY one space — is pandoc's initial-in-a-name rule
    // ("B. Russell") and opens no list, so quarto renders no heading at column 3. Refusing the
    // column would cost a real heading if the rule is ever narrower than measured, and this
    // function is required to fail in the phantom direction, so the column is admitted.
    expect(
      findHeadings(doc("A. line one", "", "   \\clearpage", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]); // quarto: NO heading (re-rendered) — the disclosed phantom
    // CONTROL — with TWO spaces it really is a list, and column 4 is real. The two documents
    // differ by ONE space and quarto answers them oppositely.
    expect(
      findHeadings(doc("A.  line one", "", "    \\clearpage", "# ATX Below")).map((h) => h.text),
    ).toEqual(["ATX Below"]);
  });
});

describe("a class-A raw-TeX macro is INDENT-INSENSITIVE (Session 190)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: class A interrupts an open paragraph at ANY indent, class B at none", () => {
    // The filed item's own three documents, ALL re-rendered against the current build before a
    // line of code was written (Learning #251), and all three hold. Class A interrupts an open
    // paragraph by making pandoc's `inlineCommand'` FAIL —
    //
    //     guard $ isInlineCommand name || not (isBlockCommand name)
    //
    // — and that guard runs at the INLINE level, reached through `inline`'s `'\\'` dispatch on
    // a paragraph's continuation line. There is no `skipNonindentSpaces` on that path and no
    // column rule anywhere near it, so the indent is simply not part of the question. Measured
    // over the whole 0-8 sweep plus three tab spellings: `\maketitle` releases the heading at
    // EVERY one of them.
    for (const indent of ["    ", "     ", "      ", "       ", "        ", "\t", "\t\t", " \t"]) {
      expect(
        findHeadings(doc("This paragraph is still open.", indent + "\\maketitle", "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    // CONTROL — indent 0-3 was already right, and this must not disturb it.
    for (const indent of ["", " ", "  ", "   "]) {
      expect(
        findHeadings(doc("This paragraph is still open.", indent + "\\maketitle", "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    // CONTROL — and it is the control that DECIDES the item, because it separates "the cap is
    // wrong for class A" from "the cap is wrong for this file's raw TeX". Class B against an
    // OPEN paragraph is INLINE at every indent 0-7 (measured, one document each), so widening
    // it here would fabricate a heading rather than recover one. ⚠ The two raw-TeX rows need
    // OPPOSITE indent rules: class B carries the containing block's content column (Session
    // 189), class A carries no cap at all.
    for (const indent of ["", " ", "  ", "   ", "    ", "       "]) {
      expect(
        findHeadings(doc("This paragraph is still open.", indent + "\\clearpage", "# ATX Below"))
          .map((h) => h.text),
      ).toEqual([]);
    }
    // CONTROL — class C is inline in every context, indented or not.
    for (const indent of ["", "    "]) {
      expect(
        findHeadings(doc("This paragraph is still open.", indent + "\\textbf{bold}", "# ATX Below"))
          .map((h) => h.text),
      ).toEqual([]);
    }
    // CONTROL — the ARITY split survives the widening. `\par` is a block and `\par{x}` is not;
    // `\section{x}` is a block and a bare `\section` is nothing at all. All four re-rendered at
    // indent 4 this session, and they answer oppositely in pairs.
    for (const macro of ["\\par", "\\section{x}", "\\usepackage{amsmath}"]) {
      expect(
        findHeadings(doc("This paragraph is still open.", "    " + macro, "# ATX Below"))
          .map((h) => h.text),
      ).toEqual(["ATX Below"]);
    }
    for (const macro of ["\\par{x}", "\\section"]) {
      expect(
        findHeadings(doc("This paragraph is still open.", "    " + macro, "# ATX Below"))
          .map((h) => h.text),
      ).toEqual([]);
    }
    // CONTROL — the TAIL rule survives it too (Learning #252: a per-line predicate anchored at
    // the line's HEAD cannot self-test its tail, so the tail is pinned here explicitly). All
    // three re-rendered at indent 4: prose, a full stop, and a trailing class-C macro each kill
    // the block exactly as they do at column 0.
    for (const tail of [" and more prose", ".", " \\textbf{b}"]) {
      expect(
        findHeadings(doc("This paragraph is still open.", "    \\maketitle" + tail, "# ATX Below"))
          .map((h) => h.text),
      ).toEqual([]);
    }
  });

  it("test-after (KNOWN RESIDUALS): an indented class-A macro inside an UNTRACKED raw region", () => {
    // The three phantoms this session's widening makes reachable, found by a 240-document
    // blind adversarial sweep and disclosed rather than hidden. All three are the SAME defect:
    // a raw region this per-line scanner does not track at all — a multi-line inline code
    // span, an RCDATA element, and a CDATA section — with a class-A macro indented inside it.
    //
    // ⚠ THE CAP WAS MASKING, NOT GUARDING, AND THE CONTROL BELOW IS WHAT ESTABLISHES IT.
    // Each pair is the same document twice, differing only in the macro's indent. The PRE-S190
    // build ALREADY emitted the phantom at column 0 — so ` {0,3}` never modelled these regions;
    // it merely happened to stop the class-A row firing on the indented spelling of a document
    // the scanner was getting wrong anyway. Fixing them means tracking the regions, which is a
    // different capability and a separate filed item (FM #26), not a narrower indent rule.
    const regions: ReadonlyArray<readonly [string, (m: string) => string]> = [
      ["multi-line inline code span", (m) => doc("Para opens a span here `raw", m, "# ATX Below", "` and it closed above.")],
      ["RCDATA <textarea>", (m) => doc("Before.", "", '<textarea rows="4" cols="40">', m, "# ATX Below", "</textarea>")],
      ["CDATA section", (m) => doc("Before.", "", "<![CDATA[", m, "# ATX Below", "]]>")],
    ];
    for (const [, build] of regions) {
      // The residual, at indent 4 and at a tab — quarto renders NO heading in any of these.
      expect(findHeadings(build("    \\maketitle")).map((h) => h.text)).toEqual(["ATX Below"]);
      expect(findHeadings(build("\t\\maketitle")).map((h) => h.text)).toEqual(["ATX Below"]);
      // CONTROL — the identical document at COLUMN 0, which the pre-S190 build got wrong too.
      // If this ever stops reporting the phantom, the region IS being tracked and the two
      // assertions above should be re-measured rather than simply updated.
      expect(findHeadings(build("\\maketitle")).map((h) => h.text)).toEqual(["ATX Below"]);
    }
  });
});

describe("a class-A raw-TeX macro OPENS A FRESH BLOCK, not only closes a paragraph (Session 191)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";

  it("RED->GREEN: a SETEXT heading below a class-A macro is visible at EVERY indent, in BOTH contexts", () => {
    // `opensFreshBlock` tests `HTML_BLOCK_OPEN` AHEAD of its `paragraphOpen` bail but reaches
    // the raw-TeX rows only BEHIND it, via `rawTexMacroLineIsBlock` — which is the class-A∪B
    // row gated on the containing block's content column. So a class-A macro, which interrupts
    // an open paragraph in EVERY context, never set `pendingFreshBlock`, `consecutiveBody`
    // never returned to 1, and the `===` below the macro's successor was never a setext
    // underline. The heading was not mis-levelled or mis-named: it was absent.
    //
    // Re-rendered before a line of code was written (Learning #251) — 108 documents, 3 macro
    // classes × 9 indents × 2 underline spellings × 2 paragraph contexts, every one quarto
    // exit 0. The filed item's own document (`\maketitle` at indent 0 against an open
    // paragraph) reproduced exactly: quarto `h1:ATX Below`, this model nothing at all.
    //
    // ⚠ The setext TITLE and its UNDERLINE are held at column 0 while only the MACRO's indent
    // sweeps (Learning #261). `SETEXT_H1`/`SETEXT_H2` carry their own ` {0,3}` cap, so a corpus
    // that indents both measures neither axis.
    const INDENTS = ["", " ", "  ", "   ", "    ", "     ", "      ", "       ", "        "];
    for (const indent of INDENTS) {
      for (const [ul, level] of [["===", 1], ["---", 2]] as const) {
        // (a) against an OPEN paragraph — the filed item's own document. Measured: quarto
        // renders the heading at every one of the nine indents, in both spellings.
        expect(
          findHeadings(doc("This paragraph is still open.", indent + "\\maketitle", "ATX Below", ul))
            .map((h) => `h${h.level}:${h.text}`),
        ).toEqual([`h${level}:ATX Below`]);
        // (b) with NO paragraph open — a SECOND loss family the filed item does not mention,
        // found by this session's ground corpus. Behind the bail the row demands the containing
        // block's content column (0 at top level), and indents 4-8 were rescued only
        // incidentally by `INDENTED_CODE_LINE`; indents 1-3 fell in the gap between the two and
        // lost the heading. Quarto renders it at all nine.
        expect(
          findHeadings(doc(indent + "\\maketitle", "ATX Below", ul)).map((h) => `h${h.level}:${h.text}`),
        ).toEqual([`h${level}:ATX Below`]);
      }
    }
    // CONTROL — CLASS B, and it is the control that DECIDES the change, exactly as it was for
    // Session 190. Class B is a block only where NO paragraph is open, so against an open one
    // it must open nothing at ANY indent. Widening the hoist to class B fabricates a heading
    // here rather than recovering one. Measured: quarto renders NOTHING in all 18.
    for (const indent of INDENTS) {
      for (const ul of ["===", "---"]) {
        expect(
          findHeadings(doc("This paragraph is still open.", indent + "\\clearpage", "ATX Below", ul)),
        ).toEqual([]);
      }
    }
    // CONTROL — CLASS B with no paragraph open is where the boundary actually sits, and it is
    // asymmetric: quarto renders the heading at indent 0 (a raw block) and at indents 4-8 (an
    // indented CODE block, a different construct entirely) but NOT at 1-3, where the macro is
    // merely the first line of an ordinary paragraph. This must survive unchanged.
    for (const [i, indent] of INDENTS.entries()) {
      for (const [ul, level] of [["===", 1], ["---", 2]] as const) {
        const got = findHeadings(doc(indent + "\\clearpage", "ATX Below", ul))
          .map((h) => `h${h.level}:${h.text}`);
        expect(got).toEqual(i === 0 || i >= 4 ? [`h${level}:ATX Below`] : []);
      }
    }
    // CONTROL — CLASS C is inline in every context. Against an open paragraph it opens nothing
    // at any indent; with none open it opens a block only at 4+, and there it is the indented
    // code rule doing it, not the macro.
    for (const [i, indent] of INDENTS.entries()) {
      for (const [ul, level] of [["===", 1], ["---", 2]] as const) {
        expect(
          findHeadings(doc("This paragraph is still open.", indent + "\\textbf{bold}", "ATX Below", ul)),
        ).toEqual([]);
        const got = findHeadings(doc(indent + "\\textbf{bold}", "ATX Below", ul))
          .map((h) => `h${h.level}:${h.text}`);
        expect(got).toEqual(i >= 4 ? [`h${level}:ATX Below`] : []);
      }
    }
  });

  it("test-after (KNOWN RESIDUALS): three families this hoist makes REACHABLE, none of them new", () => {
    // A blind 240-document adversarial sweep from eight lenses produced TEN new phantoms.
    // NINE are proven PRE-EXISTING by the control that Session 190 established (Learning #263):
    // take the same document, replace THIS session's trigger — the class-A macro — with
    // `<div>`, which `HTML_BLOCK_OPEN` already tested AHEAD of the `paragraphOpen` bail on the
    // PRE build, and the PRE build fabricates the identical heading. The hoist opened a fourth
    // doorway onto defects that were already behind the other three; it did not create them.
    //
    // ⚠ EACH RESIDUAL IS PINNED WITH THAT `<div>` CONTROL BESIDE IT. If a control ever stops
    // fabricating, the underlying row HAS been fixed and the residual above it must be
    // RE-MEASURED against quarto rather than simply updated to match.

    // ── FAMILY 1 — the SETEXT UNDERLINE's own indent, not this session's row at all.
    // ✅ **CLOSED BY SESSION 192, and these assertions were RE-MEASURED against quarto rather
    // than updated to match the code** — which is what the ⚠ above requires when a residual
    // stops reproducing. These eight documents (both triggers × underline columns 0-3) were
    // rendered through the real quarto path on the S192 build: at columns 1, 2 and 3 quarto
    // renders NO heading for EITHER trigger, and at column 0 it renders `h1:Some Title` for
    // both. `setextUnderlineLevel` now tests the underline's indent for EQUALITY against
    // `[0, ...contentColumns]`, so with no container open only column 0 is an underline.
    for (const under of [" ===", "  ===", "   ==="]) {
      expect(
        findHeadings(doc("This paragraph is still open.", "\\maketitle", "Some Title", under))
          .map((h) => h.text),
      ).toEqual([]);
      // CONTROL — the same document with the trigger removed. It tracked the residual while the
      // residual was live and it tracks the fix now: both go to [] together, which is what
      // establishes that the family was never about the class-A macro at all.
      expect(
        findHeadings(doc("This paragraph is still open.", "<div>", "Some Title", under))
          .map((h) => h.text),
      ).toEqual([]);
    }
    // CONTROL — at column 0 the underline is REAL and quarto agrees, so the family above is
    // about the indent and nothing else.
    expect(
      findHeadings(doc("This paragraph is still open.", "\\maketitle", "Some Title", "===")).map(
        (h) => h.text,
      ),
    ).toEqual(["Some Title"]);

    // ── FAMILY 2 — a raw region this per-line scanner does not track, now reachable in the
    // SETEXT spelling as well as Session 190's ATX one. Two region kinds here are NEW to the
    // filed item — a DOUBLE-backtick code span and `<title>` — and were produced by lenses that
    // had never seen this session's corpora. Quarto renders no heading in any of the five.
    const regions: ReadonlyArray<readonly [string, (opener: string) => string]> = [
      ["single-backtick span", (o) => doc("Prose with `an open span", o, "Some Title", "===", "` and now the span is closed.")],
      ["double-backtick span", (o) => doc("Prose with ``a span holding a ` backtick", o, "Some Title", "===", "`` and now the span is closed.")],
      ["CDATA section", (o) => doc("Intro text.", "", "<![CDATA[", o, "Some Title", "===", "]]>", "", "Tail sentence.")],
      ["RCDATA <textarea>", (o) => doc("Intro text.", "", "<textarea>", o, "Some Title", "===", "</textarea>", "", "Tail sentence.")],
      ["RCDATA <title>", (o) => doc("Intro text.", "", "<title>", o, "Some Title", "===", "</title>", "", "Tail sentence.")],
    ];
    for (const [, build] of regions) {
      expect(findHeadings(build("\\maketitle")).map((h) => h.text)).toEqual(["Some Title"]);
      // CONTROL — trigger removed; the PRE build fabricates the identical heading.
      expect(findHeadings(build("<div>")).map((h) => h.text)).toEqual(["Some Title"]);
    }

    // ── FAMILY 3 — the ONE new phantom the trigger-removal control does NOT explain, and it is
    // a TEXT divergence rather than a fabricated heading: quarto renders an `<h1>` here too.
    // `\maketitle` is followed by a line opening with `[`, and pandoc's raw-LaTeX block consumes
    // it as the macro's OPTIONAL BRACKET ARGUMENT across the newline, so quarto's heading text
    // is `: https://example.com` where ours keeps the bracket group. Verified by reading the
    // rendered HTML directly, not inferred from the extractor: quarto emits
    // `<h1>: https://example.com</h1>`. This is the already-filed multi-line-argument family —
    // a raw block spanning two source lines — in a new spelling.
    expect(
      findHeadings(doc("This paragraph is already open.", "\\maketitle", "[Some Title]: https://example.com", "===", "", "Trailing body text."))
        .map((h) => h.text),
    ).toEqual(["[Some Title]: https://example.com"]);
    // CONTROL — with the trigger removed there is no optional-argument grab, and quarto's own
    // heading text becomes the one we produce. So the divergence is the macro's argument
    // parsing, not the setext rule.
    expect(
      findHeadings(doc("This paragraph is already open.", "<div>", "[Some Title]: https://example.com", "===", "", "Trailing body text."))
        .map((h) => h.text),
    ).toEqual(["[Some Title]: https://example.com"]);
  });
});

describe("buildOutline — against the sample.qmd fixture", () => {
  const fixture = readFileSync(
    path.resolve(__dirname, "../fixtures/sample.qmd"),
    "utf8",
  );
  const lastLine = fixture.split(/\r?\n/).length - 1;

  it("produces the heading hierarchy with cells nested under their section", () => {
    const roots = buildOutline(fixture);

    // One top-level heading: "# Heading One" (line 10).
    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      name: "Heading One",
      level: 1,
      startLine: 10,
      endLine: lastLine,
    });

    // Its two level-2 children: "Embedded code cells" (26) and "Done" (78).
    expect(
      roots[0].children.map((c) => [c.name, c.level, c.startLine]),
    ).toEqual([
      ["Embedded code cells", 2, 26],
      ["Done", 2, 78],
    ]);

    // The four executable cells nest under "Embedded code cells"; the plain
    // ```python fence (line 74) is NOT a cell, so it is absent.
    const embedded = roots[0].children[0];
    expect(embedded.endLine).toBe(77); // section ends one line before "## Done"
    expect(embedded.children.map((c) => [c.name, c.startLine, c.endLine])).toEqual(
      [
        ["```{python}", 30, 42],
        ["```{r}", 46, 52],
        ["```{julia}", 56, 62],
        ["```{ojs}", 66, 70],
      ],
    );

    // "## Done" has no cells after it.
    expect(roots[0].children[1].children).toEqual([]);
  });
});

describe("scanRegions memoization contract", () => {
  // The single `scanRegions` pass is memoized on the document text (a semantic-
  // token pass otherwise rescans 2 + 2N times, N = embedded languages — BACKLOG
  // ":118"). The cache is shared, so two invariants must hold: the public region
  // accessors must keep handing out per-call-INDEPENDENT arrays (a caller must
  // not be able to corrupt a later call by mutating what it received — the
  // aliasing hazard a shared cache introduces), and the cache must be keyed
  // correctly (a call with different text must never return a prior text's
  // regions — the staleness hazard). Both are break-revert-proven: a memo that
  // returns the cached array directly turns the aliasing tests red; a memo that
  // ignores the key turns the keying test red.

  const withCells = [
    "# Title", // 0
    "", // 1
    "Some prose.", // 2
    "", // 3
    "```{python}", // 4
    "x = 1", // 5
    "```", // 6
    "", // 7
    "## Section", // 8
    "", // 9
    "```{r}", // 10
    "y <- 2", // 11
    "```", // 12
  ].join("\n");

  it("findAllCells returns an independent array — mutating it cannot corrupt a later call", () => {
    const first = findAllCells(withCells);
    expect(first).toHaveLength(2);
    first.push({ startLine: 999, endLine: 999, lang: "bogus", code: "" });
    first.sort((a, b) => b.startLine - a.startLine);

    const second = findAllCells(withCells);
    expect(second).toHaveLength(2);
    expect(second.map((c) => c.lang)).toEqual(["python", "r"]);
  });

  it("findHeadings returns an independent array — mutating it cannot corrupt a later call", () => {
    const first = findHeadings(withCells);
    expect(first).toHaveLength(2);
    first.length = 0;

    const second = findHeadings(withCells);
    expect(second.map((h) => h.text)).toEqual(["Title", "Section"]);
  });

  it("findBodyLines returns an independent array — mutating it cannot corrupt a later call", () => {
    const first = findBodyLines(withCells);
    const originalLength = first.length;
    expect(originalLength).toBeGreaterThan(0);
    first.length = 0;

    const second = findBodyLines(withCells);
    expect(second).toHaveLength(originalLength);
  });

  it("is keyed on the text — a call with different text never returns a prior text's regions", () => {
    // Prime the cache with a two-cell document, then a zero-cell one, then the
    // first again. A memo that ignored its key would echo the previous answer.
    expect(findAllCells(withCells)).toHaveLength(2);

    const noCells = ["# Just a heading", "", "Only prose, no cells."].join("\n");
    expect(findAllCells(noCells)).toEqual([]);
    expect(findHeadings(noCells)).toEqual([
      { level: 1, text: "Just a heading", line: 0 },
    ]);

    expect(findAllCells(withCells).map((c) => c.lang)).toEqual(["python", "r"]);
  });

  it("is keyed on the FULL text, not a length/prefix proxy — same-length docs with different regions never collide", () => {
    // A weaker key than the full-string `===` (e.g. text.length, a prefix, or an
    // unverified hash) would return a prior document's regions for a DIFFERENT
    // document of the same length. Pin the full-text key: prime a one-cell doc,
    // then query a pure-prose doc padded (trailing spaces keep it prose) to the
    // IDENTICAL length. This stays green under the correct `===` and goes red the
    // moment the key is weakened to a same-length-colliding proxy.
    const oneCell = ["```{python}", "x = 1", "```"].join("\n");
    const proseBase = "definitely no cells";
    const prose = proseBase + " ".repeat(oneCell.length - proseBase.length);
    expect(prose.length).toBe(oneCell.length);

    expect(findAllCells(oneCell)).toHaveLength(1); // prime with the cell doc
    expect(findAllCells(prose)).toEqual([]); // same length — must NOT echo the cell
    expect(findAllCells(oneCell)).toHaveLength(1); // and the cell doc is still correct
  });

  it("hands out a distinct top-level array on each call (the defensive copy), with equal content", () => {
    // The accessors `.slice()`, so two calls return DIFFERENT array objects
    // (`===`-distinct) holding EQUAL content. A memo that returned the cached
    // array by reference would make these the same object — the aliasing hazard
    // the copy prevents. (`toEqual` alone is a tautology for a deterministic fn:
    // it holds under every memo strategy, so identity is what discriminates.)
    expect(findAllCells(withCells)).not.toBe(findAllCells(withCells));
    expect(findAllCells(withCells)).toEqual(findAllCells(withCells));
    expect(findHeadings(withCells)).not.toBe(findHeadings(withCells));
    expect(findBodyLines(withCells)).not.toBe(findBodyLines(withCells));
  });
});

describe("a SETEXT underline is anchored at the containing block's CONTENT COLUMN (Session 192)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: the underline is recognized at column 0 and at every LIVE container column, and nowhere else", () => {
    // `SETEXT_H1`/`SETEXT_H2` carried ` {0,3}`, transcribed from CommonMark 4.3. Pandoc's
    // markdown reader is not CommonMark here: its `setextHeader` parser applies
    // `skipNonindentSpaces` to the TITLE line and then reads the underline run with NO leading
    // -space parser at all, so the underline must begin exactly where the enclosing block's
    // content begins. At the top level that is column 0; inside a container it is that
    // container's content column — and inside NESTED containers it is ANY column in the stack.
    //
    // ⚠ THE FILED ITEM PRESCRIBED THE WRONG FIX, IN THE HEADING-DELETING DIRECTION. It says
    // the underline is "anchored at column 0" and points at `SETEXT_UNDERLINE_RUN` as the
    // model. That is true only for a document with no container, which is all the filed item
    // measured. A 162-document container sweep (9 container kinds × 9 underline indents × 2
    // spellings) plus 17 hand-built environment documents were rendered through the real
    // quarto path BEFORE any code changed (Learning #251), and they refute it: a `- ` item
    // renders the heading at underline column 2, a `1. ` item at 3, a `-   ` item at 4, and
    // three-deep nested bullets render it at 0, 2, 4 AND 6. Anchoring at source column 0 would
    // have deleted every one of those. The rule is `[0, ...contentColumns]` — precisely the
    // machinery Session 189 already built for the raw-TeX row, reused here.
    //
    // Both error directions are in this one test because the change moves both:
    // the ` {0,3}` cap was simultaneously TOO WIDE (columns 1-3 are phantoms everywhere) and
    // TOO NARROW (a container whose content column is 4+ lost its heading entirely).

    // ── (a) NO CONTAINER — the filed item's own claim. Measured: quarto renders the heading
    // at underline column 0 and at NO other column, 0-8, in both spellings.
    for (const [ul, level] of [["===", 1], ["---", 2]] as const) {
      expect(names(doc("Intro sentence.", "", "Some Title", ul, "", "Tail."))).toEqual([
        `h${level}:Some Title`,
      ]);
      for (const indent of [" ", "  ", "   ", "    ", "     ", "      ", "       ", "        "]) {
        expect(names(doc("Intro sentence.", "", "Some Title", indent + ul, "", "Tail."))).toEqual([]);
      }
    }

    // ── (b) INSIDE A CONTAINER — the direction the filed item missed. Each container renders
    // the heading at column 0 and at its own content column, and nowhere between or beyond.
    const containers: ReadonlyArray<readonly [string, readonly string[], number]> = [
      ["bullet, content column 2", ["- item one", ""], 2],
      ["ordered, content column 3", ["1. item one", ""], 3],
      ["wide bullet, content column 4", ["-   item one", ""], 4],
      ["wide ordered, content column 4", ["10. item one", ""], 4],
    ];
    for (const [, opener, col] of containers) {
      for (const [ul, level] of [["===", 1], ["---", 2]] as const) {
        for (let u = 0; u <= 8; u++) {
          const text = doc(
            "Intro sentence.",
            "",
            ...opener,
            " ".repeat(col) + "Some Title",
            " ".repeat(u) + ul,
            "",
            "Tail.",
          );
          // Quarto renders the heading at column 0 and at the content column only.
          expect(names(text)).toEqual(u === 0 || u === col ? [`h${level}:Some Title`] : []);
        }
      }
    }

    // ── (c) NESTED containers expose the STACK, not just the innermost column. Three-deep
    // bullets open columns 2, 4 and 6; quarto renders the heading at 0, 2, 4 and 6 — measured
    // on all four (env e11-e14) — and at 1, 3, 5, 7 and 8 it renders none.
    for (let u = 0; u <= 8; u++) {
      const text = doc(
        "Intro sentence.",
        "",
        "- a",
        "  - b",
        "    - c",
        "",
        "      Some Title",
        " ".repeat(u) + "===",
        "",
        "Tail.",
      );
      expect(names(text)).toEqual([0, 2, 4, 6].includes(u) ? ["h1:Some Title"] : []);
    }

    // ── (d) CONTROL — a container that has CLOSED no longer offers its column. A column-0
    // paragraph closes the list, so the underline at column 2 is a phantom and only column 0
    // still renders (env e03/e04, both measured).
    expect(
      names(doc("Intro.", "", "- item one", "", "Back at top level.", "", "Some Title", "  ===", "", "Tail.")),
    ).toEqual([]);
    expect(
      names(doc("Intro.", "", "- item one", "", "Back at top level.", "", "Some Title", "===", "", "Tail.")),
    ).toEqual(["h1:Some Title"]);

    // ── (e) CONTROL — a TAB is not the content column. `- item` opens column 2, and a
    // tab-indented underline renders NO heading (env e01), where the two-space spelling does
    // (env e02, which also shows trailing whitespace is still fine).
    expect(names(doc("Intro.", "", "- item one", "", "  Some Title", "\t===", "", "Tail."))).toEqual([]);
    expect(names(doc("Intro.", "", "- item one", "", "  Some Title", "  ===   ", "", "Tail."))).toEqual([
      "h1:Some Title",
    ]);

    // ── (f) CONTROL — the TITLE's own indent is irrelevant, so this change must not touch it.
    // Measured over 18 documents (title indent 0-8 × both spellings), every one renders the
    // heading with the underline at column 0. That includes indents 4-8, which look like
    // indented code and are not.
    for (let t = 0; t <= 8; t++) {
      expect(names(doc("Intro sentence.", "", " ".repeat(t) + "Some Title", "===", "", "Tail."))).toEqual([
        "h1:Some Title",
      ]);
    }
  });

  it("test-after (KNOWN RESIDUALS): five families this anchor makes REACHABLE, and which of them are new", () => {
    // A 270-document BLIND adversarial sweep — eight lenses plus a completeness critic, none of
    // which saw the corpora above — scored PRE vs POST against the real quarto render path:
    //
    //   recovered headings   47        drained phantoms   33
    //   NEW LOST              0   <-- the expensive direction for a narrowing, and it is EMPTY
    //   NEW PHANTOM          11
    //
    // The critic earned its place: two of the eleven are its, and both are family 3 reached as
    // PROSE rather than as marker arithmetic — a shape no arithmetic-driven lens produced.
    //
    // ⚠ THE PRE-EXISTENCE CONTROL WAS RUN ON ALL ELEVEN, not on the suspicious ones (Learning
    // #269). This session's trigger is "a NON-ZERO column being an accepted underline column",
    // so the control is the same document with every underline moved to COLUMN 0 — a column
    // BOTH builds accept. Where the pre-build fabricates the identical heading there, the
    // defect is not the column rule; the column rule only opened a door onto it.
    //
    // Seven of the eleven are proven pre-existing that way (families 1-4 below), one is classified
    // into a family proven on its siblings, and THREE are a genuinely new doorway (family 5).
    // ⚠ Family 5's root cause is the `contentColumns` ARITHMETIC, which this change does not
    // modify — the diff touches two regexes, one new function and one call site, and reads the
    // stack without altering how it is built. The raw-TeX row has consumed that same stack
    // since Session 189; whether it already diverges on these shapes is UNMEASURED and filed.

    // ── FAMILY 1 — a container OPENER line used as a setext title keeps its MARKER in the
    // heading text. Quarto strips it. PROVEN PRE-EXISTING: at column 0 the pre-build produces
    // the identical wrong text, so the marker rule, not the column rule, is the defect.
    expect(
      names(doc("Intro for the yankee probe.", "", "Yankee Term", "", ":   Colon Definition Title", "    ---")),
    ).toEqual(["h2::   Colon Definition Title"]);
    // CONTROL — underline at column 0. Quarto renders `h2:Colon Definition Title`; we produce
    // the marker-bearing text on BOTH builds. If this ever stops, the marker rule HAS been
    // fixed and the assertion above must be re-measured against quarto, not updated to match.
    expect(
      names(doc("Intro for the yankee probe.", "", "Yankee Term", "", ":   Colon Definition Title", "---")),
    ).toEqual(["h2::   Colon Definition Title"]);
    // The `~` spelling, same mechanism, same control result.
    expect(
      names(doc("Intro for the zulu probe.", "", "Zulu Term Line", "", "~   Tilde Definition Title", "    ---")),
    ).toEqual(["h2:~   Tilde Definition Title"]);
    //
    // ⚠ THE ONE FINDING OF ELEVEN THAT RESTS ON INFERENCE, AND IT IS LABELLED RATHER THAN
    // COUNTED AS PROVEN (Learning #274). The footnote-definition spelling belongs to this same
    // family by mechanism, but its own column-0 control CANNOT FIRE: at column 0 quarto stops
    // treating the line as a footnote definition and renders `[^2]: Footnote Setext Candidate`
    // itself — agreeing with us — so the control compares two different questions rather than
    // isolating one. A control that cannot fire is not a control that passed. The family is
    // proven by its `:` and `~` siblings above; this document is CLASSIFIED into it.
    expect(
      names(doc("Intro for the xray probe[^2].", "", "[^2]: Footnote Setext Candidate", "    ---")),
    ).toEqual(["h2:[^2]: Footnote Setext Candidate"]);
    expect(
      names(doc("Intro for the xray probe[^2].", "", "[^2]: Footnote Setext Candidate", "---")),
    ).toEqual(["h2:[^2]: Footnote Setext Candidate"]); // quarto AGREES here — the control cannot fire

    // ── FAMILY 2 — an INDENTED CODE line read as a list opener, so its content column enters
    // the stack. Already filed as `INDENTED_CODE_LINE`'s column blindness. PROVEN PRE-EXISTING:
    // the column-0 control fabricates `Chi Code Title` on the pre-build, where quarto renders
    // only `Chi Three Title` — the indented block really is code.
    const chi = (u1: string, u2: string) =>
      doc("Marker depth boundary.", "", "    - looks like an item", "", "      Chi Code Title", u1,
          "", "Divider paragraph.", "", "   - real item at three", "", "     Chi Three Title", u2);
    // ⚠ HALF CLOSED BY SESSION 196, and re-rendered rather than flipped. The code-depth guard
    // in `computeRegions` stops the column-4 marker opening a container at all, so the indented
    // underline no longer finds a column to sit on. Re-rendered this session: quarto emits
    // `h1:Chi Three Title` ALONE on these exact bytes, and this model now emits exactly that.
    expect(names(chi("      ===", "     ==="))).toEqual(["h1:Chi Three Title"]);
    // CONTROL — STILL OPEN, and it is a different mechanism: the underline here is at column 0,
    // which is always in the stack, so no container column is needed to legitimise it. Only the
    // INDENTED-underline half of this family was the container column's doing. Re-rendered:
    // quarto still emits `h1:Chi Three Title` alone, so `Chi Code Title` is still a phantom.
    expect(names(chi("===", "==="))).toEqual(["h1:Chi Code Title", "h1:Chi Three Title"]);

    // ── FAMILY 3 — ordinary PROSE read as an ordered-list marker, which opens a content column
    // that then legitimises an indented underline further down. This is the already-filed
    // "`A. x` — a single capital and EXACTLY one space — is not a list" item, and this session
    // MEASURED THAT THE FILED DESCRIPTION UNDERSTATES ITS OWN RULE: `listItemContentColumn`
    // matches `[a-zA-Z]{1,9}` before a `.` or `)`, so `Mr.` and `xyz.` are markers too. It is
    // the largest of the new-phantom families — four of the eleven.
    //
    // PROVEN PRE-EXISTING BY THE PRE-BUILD'S OWN OUTPUT ON THE FIRST DOCUMENT: it already emits
    // `Upsilon Initial Title` from the `A. Smith` line at column 3. Quarto renders NO heading in
    // any of these three. The change adds spellings at deeper columns; it does not create them.
    expect(
      names(doc("Initials are not lists.", "", "A. Smith wrote it", "", "   Upsilon Initial Title", "   ===",
                "", "Mr. Jones replied", "", "    Upsilon Mister Title", "    ===")),
    ).toEqual(["h1:Upsilon Initial Title", "h1:Upsilon Mister Title"]);
    // The COMPLETENESS CRITIC's two, which all eight lenses missed: the same defect reached as
    // PROSE rather than as marker arithmetic. `Mr.` opens column 4 and `xyz.` opens column 5,
    // and each legitimises the underline of a paragraph further down. Quarto renders neither.
    expect(
      names(doc("Mr. Halloran signed the charter in March.", "", "    Lima Addendum", "    ===",
                "", "The addendum was never countersigned.")),
    ).toEqual(["h1:Lima Addendum"]);
    expect(
      names(doc("xyz. A stray label found in the margin notes.", "", "     Oscar Digest", "     ===",
                "", "Nobody could explain the label.")),
    ).toEqual(["h1:Oscar Digest"]);

    // ── FAMILY 4 — NOT A DEFECT AT ALL, AND THIS ASSERTION IS WHY IT IS STILL HERE.
    // The sweep's tenth "new phantom" was `h1:Fir` against quarto's `h1:Fir Underline`, which
    // reads as a truncation. It was an INSTRUMENT DEFECT IN THE SESSION'S OWN HARNESS: the
    // heading text contains a TAB, the probe wrote tab-separated values, and the scorer read
    // only the first two fields — so `Fir\tUnderline` was silently truncated to `Fir`.
    //
    // ⚠ The unit test is what caught it: the assertion was written from the PROBE's output and
    // failed against the MODEL, which emits the full text. Once the probe escaped tabs and both
    // sides were whitespace-normalised (quarto's extractor already collapsed `\s+`), this
    // document moved from NEW PHANTOM to RECOVERED HEADING — the pre-build emitted nothing
    // here at all. Nine new phantoms, not ten; forty-four recoveries, not forty-three.
    //
    // The residual is only that we keep the literal tab where pandoc renders a space.
    expect(names(doc("Bullet column four with a tab inside the title.", "", "-   item", "",
                     "    Fir\tUnderline", "    ==="))).toEqual(["h1:Fir\tUnderline"]);
    expect(names(doc("Bullet column four with a tab inside the title.", "", "-   item", "",
                     "    Fir\tUnderline", "==="))).toEqual(["h1:Fir\tUnderline"]); // CONTROL

    // ── FAMILY 5 — THE THREE GENUINELY NEW PHANTOMS: a new consumer of the `contentColumns`
    // stack, whose arithmetic this change leaves untouched. Their column-0 controls show NO
    // divergence at all (quarto and both builds agree there), so unlike families 1-4 these
    // are only reachable through a container column.
    //
    // (a) A RAGGED stack: a shallower sibling marker does not pop the deeper column, because
    // the pop is suppressed while a paragraph is open. We keep column 4 live; pandoc does not.
    //
    // ✅ CLOSED BY SESSION 198 — `popsEnclosingContainer` makes a LIST START close the deeper
    // column whether or not a paragraph is open above it, which is the same one condition that
    // stopped a consumed setext underline arming the pop. RE-RENDERED on these exact bytes
    // before the flip (`scratchpad/s198/pins/ragged.qmd`): quarto emits `h1:Eta Plain Title`
    // and nothing else. The live RED->GREEN for this behaviour is in the Session 198 describe
    // at the foot of this file.
    expect(
      names(doc("Ragged stack probe.", "", "  - deep first item", "- shallow next item", "",
                "  Eta Ragged Title", "    ===", "", "- plain item", "", "  Eta Plain Title", "  ===")),
    ).toEqual(["h1:Eta Plain Title"]);
    // CONTROL — at column 0 quarto renders BOTH and so do we: no divergence, which is what
    // makes this one NEW rather than newly-visible.
    expect(
      names(doc("Ragged stack probe.", "", "  - deep first item", "- shallow next item", "",
                "  Eta Ragged Title", "===", "", "- plain item", "", "  Eta Plain Title", "===")),
    ).toEqual(["h1:Eta Ragged Title", "h1:Eta Plain Title"]);

    // (b) A TAB inside the container MARKER, where our content column is arithmetic on the
    // marker's spaces. Quarto renders no heading; we place one at the computed column.
    expect(
      names(doc("Footnote at indent two with a tab.", "", "See[^1] for the note.", "",
                "  [^1]:\tnote body", "", "      Tamarack Underline", "      ===")),
    ).toEqual(["h1:Tamarack Underline"]);
    expect(
      names(doc("Vanilla term", "", "  ~\tdefinition text", "", "      Vanilla Underline", "      ===")),
    ).toEqual(["h1:Vanilla Underline"]);
  });
});

describe("an INDENTED CODE line is measured from the containing block's CONTENT COLUMN (Session 193)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: the code threshold is the containing block's content column + 4, on every consumer of the row", () => {
    // `INDENTED_CODE_LINE` tested a LITERAL four spaces. Pandoc re-parses a container's content
    // DEDENTED, so the indented-code threshold inside a container is four past THAT container's
    // content column — a line merely four from the page edge is ordinary content there.
    //
    // 300 ground documents were rendered through the real `quarto render` path BEFORE any code
    // changed (Learning #251) and the threshold is exactly `contentColumn + 4` in every one:
    // top level 4, a `- ` item 6, a `1. ` item 7, a `-   ` item 8, a footnote/definition 8, and
    // three-deep nested bullets 10. The filed document's own reading is confirmed — quarto
    // renders NO heading and we emitted one — and so is the control that makes it column
    // blindness rather than a wrong row: the identical bytes at top level really ARE code.
    //
    // ⚠ THE FILED ITEM NAMES ONE CONSUMER AND THE ROW HAS THREE, WITH DIFFERENT POLARITIES.
    // `CLOSES_PARAGRAPH` (an ATX heading may follow a code line) is the phantom-REMOVING one it
    // describes; `OPENS_FRESH_BLOCK` (a setext underline may claim the line below) and the
    // indented-code RUN exception in `computeRegions` (the 2nd+ line of a code run can never be
    // a setext title) both move headings the OTHER way. A rule proven on one is unmeasured on
    // the others (Learning #233), so all three are swept here and asserted in this one test.
    // The setext surface's own 392-document sweep gives the SAME threshold, which is the
    // evidence that this is one rule and not three coincidences.
    //
    // ⚠ The filed document uses `\clearpage`, which `rawTexMacroLineIsBlock` ALSO matches — so
    // it cannot distinguish "the indented-code row fired" from "the raw-TeX row fired". `zzz`
    // carries no second block reading and is what the sweeps below use; the filed spelling is
    // kept as its own case.

    // ── (a) THE FILED DOCUMENT. Quarto renders NO heading: four spaces is +2 inside a
    // column-2 item, which is ordinary paragraph content, so `# ATX Below` would interrupt an
    // open paragraph and `blank_before_header` forbids it.
    expect(names(doc("- line one", "  line two", "", "    \\clearpage", "# ATX Below"))).toEqual([]);
    // CONTROL — the identical four spaces at TOP level really are indented code, and the
    // heading below really is rendered. The row was never wrong, it was column-blind.
    expect(names(doc("    \\clearpage", "# ATX Below"))).toEqual(["h1:ATX Below"]);
    // CONTROL — the same macro at the item's OWN content column is a raw-TeX block (Session
    // 189's row), so the heading below it is real. This is what the filed document would have
    // deleted had the threshold been raised without the column.
    expect(names(doc("- line one", "  line two", "", "  \\clearpage", "# ATX Below"))).toEqual([
      "h1:ATX Below",
    ]);

    // ── (b) THE THRESHOLD SWEEP, on the ATX surface (`closesParagraph`). Payload `zzz`, indent
    // 0-12, one row per container. Heading present iff indent >= contentColumn + 4 — measured,
    // cell by cell, on all five.
    const containers: ReadonlyArray<readonly [string, readonly string[], number]> = [
      ["top level", [], 0],
      ["bullet, content column 2", ["- line one", "  line two"], 2],
      ["ordered, content column 3", ["1. line one", "   line two"], 3],
      ["wide bullet, content column 4", ["-   line one", "    line two"], 4],
      ["three-deep nest, content column 6", ["- outer", "  - middle", "    - inner", "      line two"], 6],
    ];
    for (const [, opener, col] of containers) {
      for (let ind = 0; ind <= 12; ind++) {
        const text = doc("Intro sentence.", "", ...opener, "", " ".repeat(ind) + "zzz", "# ATX Below");
        expect(names(text)).toEqual(ind >= col + 4 ? ["h1:ATX Below"] : []);
      }
    }

    // ── (c) THE SAME THRESHOLD ON THE SETEXT SURFACE — the two consumers the filed item never
    // names. The payload line must open a fresh block for `Some Title` below it to be claimed
    // by the underline, and `Some Title` (sitting at the content column) must not itself be
    // read as the 2nd line of a code run. Quarto's answer is the same threshold, measured over
    // 392 documents in both spellings.
    for (const [, opener, col] of containers) {
      for (const [ul, level] of [["===", 1], ["---", 2]] as const) {
        for (let ind = 0; ind <= 12; ind++) {
          const text = doc(
            "Intro sentence.",
            "",
            ...opener,
            "",
            " ".repeat(ind) + "zzz",
            " ".repeat(col) + "Some Title",
            " ".repeat(col) + ul,
            "",
            "Tail sentence.",
          );
          expect(names(text)).toEqual(ind >= col + 4 ? [`h${level}:Some Title`] : []);
        }
      }
    }

    // ── (d) THE RUN EXCEPTION IS THE ONE THAT RECOVERS HEADINGS, and it is worth its own case
    // because its polarity is the opposite of (a)'s. With the payload at a genuine code indent
    // and the title at the container's content column, the pre-fix build read BOTH as code,
    // so the title was "the 2nd line of a run" and could never be a setext title — a real
    // heading quarto renders, deleted. 86 such losses in the 392-document sweep.
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "        zzz", "    Some Title", "    ===", "", "Tail sentence.")),
    ).toEqual(["h1:Some Title"]);
    // CONTROL — at TOP level the identical two-line shape really IS a code run, and quarto
    // renders no heading. The run exception is not removed, it is measured from the column.
    expect(
      names(doc("Intro sentence.", "", "    zzz", "    Some Title", "===", "", "Tail sentence.")),
    ).toEqual([]);
  });

  it("test-after (DISCLOSED RESIDUALS): five families this change leaves standing, each with its control", () => {
    // ⚠ RECORD WHICH KIND OF EVIDENCE EACH RESIDUAL HAS (Learning #274). Family 1 is the only
    // one this session INTRODUCED; families 2-5 are proven pre-existing by running the same
    // probe against the pre-Session-193 build, which answered identically on every document
    // below. "Proven by control" below means a trigger-removal substitution was rendered and
    // scored, not that the shape was argued about.

    // ── FAMILY 1 — CLOSED BY SESSION 194, and RE-RENDERED rather than flipped to match the
    // code. These were Session 193's only two new errors: the stack's pop measured a line's
    // indent as a count of SPACES, so a tab-indented line looked shallower than it is and
    // popped a column that is still open. Here the innermost item's column 6 was popped by a
    // line whose real column is 8, leaving a base of 4 and a threshold of 8 the line then met.
    // Session 194 measures the pop in COLUMNS; the first document below is now `[]`, and that
    // is QUARTO's answer on those exact bytes re-rendered this session, not the new code's.
    // PROVEN BY CONTROL, unchanged: the identical column written in EIGHT SPACES always agreed.
    const nest = ["Intro sentence.", "", "- outer", "  - middle", "    - inner", "      line two", ""];
    expect(names(doc(...nest, "    \tzzz", "# ATX Below"))).toEqual([]); // quarto: NO heading — now agreed
    expect(names(doc(...nest, "        zzz", "# ATX Below"))).toEqual([]); // CONTROL — same column, spaces
    expect(names(doc(...nest, "          zzz", "# ATX Below"))).toEqual(["h1:ATX Below"]); // 6+4, real code

    // ── FAMILY 2 — CLOSED BY SESSION 194, and RE-RENDERED rather than flipped to match the
    // code. A TAB-indented raw-TeX macro at a container's content column was invisible, because
    // `rawTexMacroLineIsBlock` counted SPACES ONLY — 6 losses in the 392-document setext sweep.
    // Session 194 measures that indent in COLUMNS with the same `indentColumn` the container
    // stack now uses, and the document below is quarto's own answer on those exact bytes,
    // re-rendered this session. It was NOT closed for its own sake: correcting the container
    // stack's pop turned this residual into 6 NEW LOST headings, because the old wrong pop had
    // been masking it. See the Session 194 describe below.
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "\t\\clearpage", "    Some Title", "    ===", "", "Tail sentence.")),
    ).toEqual(["h1:Some Title"]); // quarto: h1:Some Title — now agreed
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "    \\clearpage", "    Some Title", "    ===", "", "Tail sentence.")),
    ).toEqual(["h1:Some Title"]); // CONTROL — the spaces spelling is found

    // ── FAMILY 3 — a BLOCK QUOTE suspends the column rule entirely (`quoteOpen` passes `null`),
    // because this model carries no block-quote container. It is the single largest residual
    // family a 240-document blind adversarial sweep found: 11 of its 24 losses. Both directions
    // are reachable and both are pre-existing.
    expect(
      names(doc("> Foxtrot quote opener.", ">", ">     boxed sample text", "> # Foxtrot Quoted Heading",
                "", "Tail sentence.")),
    ).toEqual([]); // quarto: h1:Foxtrot Quoted Heading — 4 past the quote's own content column IS code
    expect(
      names(doc("> Beacon quoted opener line", "    lazy indented continuation", "# Beacon Lazy Heading",
                "", "Tail sentence.")),
    ).toEqual(["h1:Beacon Lazy Heading"]); // quarto: NO heading — a lazy continuation keeps the paragraph open

    // ── FAMILY 4 — a QUARTO FENCED DIV / CALLOUT is a container `contentColumns` never pushes.
    // Session 192's completeness critic NAMED this and could not measure it; this session's
    // blind sweep MEASURED it, so it is promoted from a lead to a finding. Quarto consumes a
    // callout's `##` line as the callout's own title and emits no heading element for it.
    //
    // ⚠ **SESSION 199 CHANGED THIS DOCUMENT'S ANSWER WITHOUT CLOSING THE FAMILY, and the
    // distinction is the whole point of re-rendering rather than re-running.** The title here
    // sits at indent 3, which matches no open content column, so the heading row now declines
    // it and we agree with quarto — for a DIFFERENT REASON than quarto's (quarto consumes the
    // callout title; we simply do not see an indented heading). Move the title to column 0 and
    // the phantom is untouched, because column 0 is always open: measured this session, quarto
    // renders NO heading and this model still emits `h2:Larkspur Callout Title`
    // (`scratchpad/s199/co/co_i0.qmd` and `co_i3.qmd`, both rendered, ours probed firsthand).
    // The column-0 spelling is therefore the one pinned as the live defect, and the filed item
    // STAYS filed.
    expect(
      names(doc("::: {.callout-note}", "   ## Larkspur Callout Title", "Body text follows the title.", ":::")),
    ).toEqual([]); // quarto: NO heading — and since S199 neither do we, at THIS indent
    expect(
      names(doc("::: {.callout-note}", "## Larkspur Callout Title", "Body text follows the title.", ":::")),
    ).toEqual(["h2:Larkspur Callout Title"]); // quarto: NO heading — the LIVE defect, at column 0

    // ── FAMILY 5 — an INDENTED ATX HEADING line below a code block. All 16 phantoms that
    // survive in Session 189's own 656-document container corpus have this one shape, and none
    // of them is this row's: the code line is correctly judged, and it is the heading line's own
    // ` {0,3}` tolerance that then invents the heading. Already filed as `ATX_HEADING`'s cap.
    //
    // ⚠ **CLOSED IN PLACE BY SESSION 199 — this is that filed item, and the indent-1 heading is
    // gone.** Re-rendered on these exact bytes before the flip (`scratchpad/s199/co/co_fam5.qmd`
    // and `co_fam5ctl.qmd`): quarto renders no heading at indent 1 and does render one at
    // column 0, which is now what this model answers in both.
    expect(names(doc("    \\clearpage", " # ATX Below"))).toEqual([]); // quarto: NO heading — agreed since S199
    expect(names(doc("    \\clearpage", "# ATX Below"))).toEqual(["h1:ATX Below"]); // CONTROL — column 0 is real

    // ── FAMILY 6 — A BLANK LINE INSIDE AN INDENTED CODE BLOCK RE-ARMS THE NEXT CODE LINE AS A
    // SETEXT TITLE. Found by this session's completeness pass, PREVIOUSLY UNFILED, and
    // PRE-EXISTING (the pre-build answers identically). A blank line does not end an indented
    // code block for pandoc, but it does reset `consecutiveBody` to 0 here — and the next code
    // line then increments it straight back to the eligible 1, so the run exception never gets
    // to speak. PROVEN BY CONTROL: delete the blank and the run exception fires correctly.
    expect(
      names(doc("Intro.", "", "    zzz", "", "    India Run Title", "===")),
    ).toEqual(["h1:India Run Title"]); // quarto: NO heading — one code block, blank line and all
    expect(
      names(doc("Intro.", "", "    zzz", "    India Run Title", "===")),
    ).toEqual([]); // CONTROL — no blank, so the run exception fires and quarto agrees
    expect(
      names(doc("Intro.", "", "    India Run Title", "===")),
    ).toEqual(["h1:India Run Title"]); // CONTROL — a LONE indented line really IS a setext title
  });
});

describe("a container's content column is closed by a line's COLUMN, not its SPACE COUNT (Session 194)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  // The six containers of the ground sweep, each with the content column it opens.
  const HEAD: Record<string, { head: string[]; inner: number }> = {
    top: { head: ["Intro sentence."], inner: 0 },
    b2: { head: ["Intro sentence.", "", "- outer", "  line two"], inner: 2 },
    o3: { head: ["Intro sentence.", "", "1. outer", "   line two"], inner: 3 },
    b4: { head: ["Intro sentence.", "", "-   outer", "    line two"], inner: 4 },
    n6: {
      head: ["Intro sentence.", "", "- outer", "  - middle", "    - inner", "      line two"],
      inner: 6,
    },
    fn4: {
      head: ["Intro sentence.", "", "See[^1] for the note.", "", "[^1]: note body"],
      inner: 4,
    },
  };
  /** The whitespace prefixes that reach column `c` — spaces, then the tab spellings. */
  const spellings = (c: number): string[] => {
    const out = [" ".repeat(c)];
    if (c >= 4) {
      out.push("\t".repeat(Math.floor(c / 4)) + " ".repeat(c % 4));
      out.push(" \t" + " ".repeat(c - 4));
      if (c >= 8) out.push("\t" + " ".repeat(c - 4));
    }
    return out;
  };
  /** Family A — the INDENTED-CODE reader. The probe line is the code candidate. */
  const codeDoc = (k: string, prefix: string, title: string) =>
    doc(...HEAD[k].head, "", prefix + "zzz", `# ${title}`);
  /** Family B — the SETEXT reader. The title and underline sit AT the innermost column. */
  const setextDoc = (k: string, prefix: string, title: string) => {
    const pad = " ".repeat(HEAD[k].inner);
    return doc(...HEAD[k].head, "", prefix + "zzz", "", pad + title, pad + "===");
  };

  it("RED->GREEN: a TAB-indented line closes the containers its COLUMN closes, in both error directions", () => {
    // The stack in `computeRegions` closed containers by comparing `/^ */.exec(line)[0].length`
    // — a count of SPACES — against the open content columns. Every other column-aware rule in
    // this file expands a tab to the next 4-column stop, so a tab-indented line looked
    // SHALLOWER than it is and popped a container that is still open.
    //
    // ⚠ THE MEASUREMENT IS AN EQUIVALENCE, NOT A THRESHOLD, because a threshold sweep would
    // presuppose the answer. 432 ground documents were rendered through the real `quarto render`
    // path BEFORE any code changed (Learning #251), pairing every tab spelling against the SPACE
    // spelling that reaches the same column — 6 containers x 13 columns x up to 4 spellings x
    // two consumer families. Quarto answered IDENTICALLY in 276 of 276 pairs. Indentation is
    // columns; the tab is never special. (Contrast Session 192, whose filed prescription was
    // REFUTED by exactly this kind of sweep — confirmation is not the default.)
    //
    // ⚠ THE STACK SITS UNDER READERS OF OPPOSITE POLARITY, so both directions are asserted here
    // and the sign of a net count means nothing (Learning #272). Measured PRE: family A (the
    // indented-code reader) 40 PHANTOM / 0 lost; family B (the setext reader) 0 phantom /
    // 111 LOST. Every one of those 151 errors is a tab spelling: the space spellings scored
    // 0/0 in both families, which is what makes this a MEASUREMENT defect and not a rule defect.

    // ── (a) THE FILED DOCUMENT — Session 193's only two new phantoms, and its own control.
    // `    \tzzz` reaches column 8. The innermost item's column is 6, so the code threshold is
    // 10 and this line is ordinary content; `blank_before_header` then forbids the heading.
    // We read the indent as 4, popped the still-open column 6, and measured against a base of
    // 4 — a threshold of 8, which the line meets. Re-rendered this session: quarto emits NO
    // heading, confirming the pin.
    const nest = ["Intro sentence.", "", "- outer", "  - middle", "    - inner", "      line two", ""];
    expect(names(doc(...nest, "    \tzzz", "# ATX Below"))).toEqual([]);
    // CONTROL — the identical column written in EIGHT SPACES already agreed with quarto, which
    // is what proves the defect is the MEASUREMENT and not the code rule above it.
    expect(names(doc(...nest, "        zzz", "# ATX Below"))).toEqual([]);
    // CONTROL — one container deeper still (6 + 4) really IS code, and the heading is real.
    expect(names(doc(...nest, "          zzz", "# ATX Below"))).toEqual(["h1:ATX Below"]);

    // ── (b) THE PHANTOM DIRECTION, at the real Outline model's own answer. Both documents are
    // from the rendered ground corpus, so these are quarto's measured answers, not derivations.
    expect(names(codeDoc("b2", "\t", "Alfa B2 04 Tabmax"))).toEqual([]);
    expect(names(codeDoc("b2", " ".repeat(4), "Alfa B2 04 Sp"))).toEqual([]); // CONTROL
    expect(names(codeDoc("n6", "\t\t", "Alfa N6 08 Tabmax"))).toEqual([]);
    expect(names(codeDoc("n6", " ".repeat(8), "Alfa N6 08 Sp"))).toEqual([]); // CONTROL

    // ── (c) THE LOSS DIRECTION — the EXPENSIVE one, and the larger of the two. A tab-indented
    // line popped a container that is still open, so the setext underline at that container's
    // own content column stopped being an underline and the heading vanished from the outline,
    // breadcrumbs, sticky scroll, workspace symbols and the cross-reference index.
    expect(names(setextDoc("b2", "\t\t", "Bravo B2 08 Tabmax"))).toEqual(["h1:Bravo B2 08 Tabmax"]);
    expect(names(setextDoc("b2", " ".repeat(8), "Bravo B2 08 Sp"))).toEqual(["h1:Bravo B2 08 Sp"]); // CONTROL
    expect(names(setextDoc("o3", "\t", "Bravo O3 04 Tabmax"))).toEqual(["h1:Bravo O3 04 Tabmax"]);
    expect(names(setextDoc("n6", "\t\t\t", "Bravo N6 12 Tabmax"))).toEqual(["h1:Bravo N6 12 Tabmax"]);

    // ── (d) THE EQUIVALENCE ITSELF, swept — the generalisation the 276 rendered pairs support,
    // asserted as a property rather than as a list of cells. For every container and every
    // column, each tab spelling must give the model the SAME answer as the space spelling that
    // reaches the same column. This is the assertion that fails for a tab in ANY position, not
    // only the two positions the filed item happened to name.
    for (const k of Object.keys(HEAD)) {
      for (let c = 0; c <= 12; c++) {
        const [sp, ...tabs] = spellings(c);
        for (const t of tabs) {
          expect(names(codeDoc(k, t, "Sweep Code Title"))).toEqual(
            names(codeDoc(k, sp, "Sweep Code Title")),
          );
          expect(names(setextDoc(k, t, "Sweep Setext Title"))).toEqual(
            names(setextDoc(k, sp, "Sweep Setext Title")),
          );
        }
      }
    }

    // ── (e) THE NO-CONTAINER CONTROL — with no column on the stack there is nothing to pop, so
    // this change must be INERT at top level. Measured: the `top` row scored 0 phantoms and
    // 0 losses on both families before the change as well as after.
    expect(names(codeDoc("top", "\t", "Alfa TOP 04 Tabmax"))).toEqual(["h1:Alfa TOP 04 Tabmax"]);
    expect(names(codeDoc("top", " ".repeat(4), "Alfa TOP 04 Sp"))).toEqual(["h1:Alfa TOP 04 Sp"]);
  });

  it("KNOWN RESIDUAL (test-after, labelled): two families this change does NOT close", () => {
    // ⚠ WRITTEN AFTER THE FACT and labelled as such — these are NOT the TDD behaviour above.
    // Both families were found by a 240-document BLIND adversarial sweep from eight lenses that
    // never saw this session's designed corpus, and both are PROVEN PRE-EXISTING: the
    // pre-Session-194 build answers identically on every document below. Each carries the
    // control that proves the claim, and the KIND of evidence is stated (Learning #274).
    //
    // ⚠ Both are the SAME RULE as the two this session shipped — indentation is COLUMNS — in
    // two more places. They are FILED, NOT FIXED, and the distinction from the raw-TeX row
    // beside them is exact: that row was a REGRESSION this change caused and had to be closed
    // to ship honestly, while these two are pre-existing and closing them would be a second
    // capability (FM #26). The new-error SET on the blind corpus is empty in both directions.

    // ── FAMILY 1 — A SETEXT UNDERLINE WRITTEN WITH A TAB, and it CORRECTS A CONCLUSION
    // RECORDED IN THIS FILE'S OWN SOURCE. `setextUnderlineLevel` captures the underline's
    // indent with ` *` (spaces only), so a tab-prefixed underline matches NOTHING at all.
    // Session 192 justified that with a measurement — `- item` / `  Some Title` / `\t===`
    // renders no heading — and the measurement is correct but the CONCLUSION ("a tab is not
    // the content column") over-generalises from a container whose column is 2: a tab reaches
    // column 4, and 4 is simply not 2. Inside a container whose content column IS 4, the tab
    // lands exactly on it and quarto renders the heading. PROVEN BY CONTROL, both ways.
    //
    // ⚠ CLOSED BY SESSION 197, and RE-RENDERED rather than flipped. These exact bytes went
    // back through the real `quarto render` path before the assertion changed (corpus `pins2`,
    // document q01): quarto emits `h1:Papa Tab Underline`, and this model now emits it too.
    // Session 194's prediction in the paragraph above was confirmed, not merely inherited.
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "    Papa Tab Underline", "\t===")),
    ).toEqual(["h1:Papa Tab Underline"]); // quarto agrees — the LOST heading is recovered
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "    Quebec Space Underline", "    ===")),
    ).toEqual(["h1:Quebec Space Underline"]); // CONTROL — the space spelling of the same column
    // CONTROL — Session 192's OWN document, which still agrees: column 2 container, tab at 4.
    expect(
      names(doc("Intro sentence.", "", "- line one", "  line two", "",
                "  Romeo Column Two", "\t===")),
    ).toEqual([]); // quarto: no heading either — 4 is not 2, and both of us decline
    expect(
      names(doc("Intro sentence.", "", "- line one", "  line two", "",
                "  Sierra Column Two Spaces", "  ===")),
    ).toEqual(["h1:Sierra Column Two Spaces"]); // CONTROL — the space spelling at column 2

    // ── FAMILY 2 — AN ATX HEADING AT ITS CONTAINER'S OWN CONTENT COLUMN IS LOST, because
    // `ATX_HEADING` still carries a literal ` {0,3}` cap of its own. This was already on the
    // board, but as a PHANTOM family (Session 193 attributed all 16 survivors in Session 189's
    // corpus to it); the blind sweep shows it is ALSO the largest LOSS family here, which makes
    // it simultaneously too wide and too narrow — the exact shape that makes both one-directional
    // edits wrong, as Session 192 found for the setext row. PROVEN BY CONTROL.
    //
    // ⚠ **CLOSED IN PLACE BY SESSION 199, and this family's own "too wide AND too narrow"
    // sentence is why that session shipped a column EQUALITY rather than a wider cap.**
    // Re-rendered on these exact bytes before the flip (`scratchpad/s199/ax/pin_s194_fam2.qmd`).
    expect(
      names(doc("Intro.", "", "- Site logistics", "  - Access road status", "",
                "    # Tango Indented ATX", "", "    Body text.")),
    ).toEqual(["h1:Tango Indented ATX"]); // quarto agrees — the inner item's content column is 4
    expect(
      names(doc("Intro.", "", "- Site logistics", "  - Access road status", "",
                "# Uniform Column Zero ATX", "", "Body text.")),
    ).toEqual(["h1:Uniform Column Zero ATX"]); // CONTROL — the same heading at column 0
    expect(
      names(doc("Intro.", "", "-   line one", "    line two", "",
                "    # Victor Four Column ATX", "", "    Body text.")),
    ).toEqual(["h1:Victor Four Column ATX"]); // agreed since S199 — the single-container spelling

    // ── FAMILY 3 — NEW, AND FOUND BY THIS SESSION'S OWN COMPLETENESS PASS rather than by the
    // eight lenses (the delegated critic stalled and the role was run firsthand). It is the
    // SAME spaces-only class again, in two of the three places this session did NOT touch:
    // `listItemContentColumn` and `CONTENT_COLUMN_4_OPEN` both anchor on `^( *)`, so a
    // TAB-INDENTED list marker or footnote definition opens NO tracked column at all. (SIX
    // places in this file measure indentation for the container-column machinery; three now
    // share `indentColumn`, and the third laggard is FAMILY 1 above, the setext underline.)
    // PROVEN BY CONTROL and PRE-EXISTING (the pre-S194 build answers identically).
    //
    // ⚠ CLOSED BY SESSION 197, and it took BOTH halves. Session 196 shipped the marker's own
    // indent and recorded that this document still could not show that fix, because its
    // underline `\t  ===` is tab-spelled and `setextUnderlineLevel` was spaces-only — the last
    // of the six sites. With the underline measured in columns too, the marker opens column 6
    // and the underline is tested AT column 6. RE-RENDERED on these exact bytes before the
    // assertion changed (corpus `pins2`, document q05): quarto emits `h1:Golf Tab Sibling
    // Title`, and so do we. It is the one document that required two sessions' fixes at once.
    expect(
      names(doc("Intro.", "", "- outer", "  - middle", "    line two", "",
                "\t- tab marker sibling", "", "\t  Golf Tab Sibling Title", "\t  ===")),
    ).toEqual(["h1:Golf Tab Sibling Title"]); // quarto agrees — the LOST heading is recovered
    // CONTROL — the same shape written in spaces IS tracked, and the heading is found. (Both
    // sides of this pair are what makes the marker's own indent class the mechanism, rather
    // than anything about the sibling relationship.)
    expect(
      names(doc("Intro.", "", "- outer", "  - middle", "    - inner", "      line two", "",
                "  - sibling at two", "", "    Foxtrot Sibling Title", "    ===")),
    ).toEqual(["h1:Foxtrot Sibling Title"]); // quarto agrees — this one is right

    // ── FAMILY 4 — ⚠ CLOSED BY SESSION 196, and re-rendered rather than flipped. A
    // FOUR-SPACE-indented list marker or footnote definition is INDENTED CODE to pandoc, not a
    // container, and both openers used to admit it and push a column anyway. Session 196's
    // code-depth guard in `computeRegions` declines it, because the condition it reuses is
    // `indentedCodeLine` itself. Re-rendered this session on these exact bytes: quarto emits NO
    // heading, and this model now emits none either.
    //
    // It was closed as a SCOPE AMENDMENT, not as an adjacent tidy-up: a blind 240-document
    // adversarial sweep measured 39 real headings DELETED by the opener change without it,
    // because pushing a column for a code-depth opener lifts the indented-code base and turns
    // the code block below into an open paragraph. Same rule, opposite direction of error.
    expect(
      names(doc("Intro.", "", "    - space indented item", "      line two", "",
                "      Bravo Space Marker Title", "      ===")),
    ).toEqual([]); // quarto: NO heading — the phantom is gone
    expect(
      names(doc("Intro.", "", "\t- tab indented item", "\t  line two", "",
                "\t  Alpha Tab Marker Title", "\t  ===")),
    ).toEqual([]); // CONTROL — the tab spelling is code to BOTH of us, and agrees
  });
});

describe("a raw-TeX block macro's indent is a COLUMN too, so a TAB can reach it (Session 194)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: a TAB-indented macro at the containing block's content column IS a block", () => {
    // ⚠ THIS IS A SCOPE AMENDMENT, AND IT IS HERE BECAUSE THE MEASUREMENT FORCED IT — not
    // because it was adjacent. Session 194 declared `rawTexMacroLineIsBlock`'s tab blindness
    // OUT of scope at claim, as its own capability. Re-scoring Session 193's own corpora after
    // the container-column fix then measured **6 NEW LOST headings** there, all of this shape:
    // the old, WRONG pop happened to clear the stack, which let `indentedCodeLine` fire and
    // produce the right answer for the wrong reason. Correcting the pop removed the accident
    // and exposed the pre-existing blindness underneath as a REGRESSION in the expensive
    // direction. Shipping the container fix alone would have deleted those six headings.
    //
    // Session 189 left this row spaces-only DELIBERATELY, documenting that "a leading tab is
    // left to `INDENTED_CODE_LINE`, exactly as ` {0,3}` did". That reasoning was sound when the
    // indented-code row hard-coded `\t` as "deep enough"; Session 193 replaced that row with
    // real column arithmetic, and the tab has fallen between the two rows ever since. This is
    // the same one rule as the container fix beside it — indentation is COLUMNS — applied to
    // the third and last place in this file that measured it in spaces.
    //
    // All eight documents below were rendered through the real `quarto render` path this
    // session. Re-scored: Session 193's `gnd` corpus 167/12/0 -> 167/0/0 and its `cb` corpus
    // 178/0/6 -> 184/0/0, with the new-error SET empty in both directions on every corpus.

    // ── (a) THE REGRESSION ITSELF — the setext spelling, which is Session 193's own FAMILY 2
    // pin, and the ATX spelling beside it. quarto renders the heading; the container fix alone
    // deleted it.
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "\t\\clearpage", "    Some Title", "    ===", "", "Tail sentence.")),
    ).toEqual(["h1:Some Title"]);
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "\t\\clearpage", "# Tango ATX Below")),
    ).toEqual(["h1:Tango ATX Below"]);
    // CONTROL — the FOUR-SPACE spelling of the same column was always found, on every build.
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "    \\clearpage", "    Some Title", "    ===", "", "Tail sentence.")),
    ).toEqual(["h1:Some Title"]);

    // ── (b) THE COLUMN MUST STILL MATCH — this is not blanket tab acceptance, and t08 is the
    // control that proves it. A `1. ` item's content column is 3; a lone tab reaches 4, which
    // is not 3, so the macro is NOT a block there and quarto renders NO heading.
    expect(
      names(doc("Intro sentence.", "", "1. line one", "   line two", "",
                "\t\\clearpage", "# Yankee Ordered")),
    ).toEqual([]);

    // ── (c) DEEPER NESTS, where the tab lands on an OUTER container's column rather than the
    // innermost one. `\t` reaches 4 (the middle item's column) and `\t  ` reaches 6 (the inner
    // item's); both are open, and quarto renders a heading for both.
    const nest = ["Intro sentence.", "", "- outer", "  - middle", "    - inner", "      line two", ""];
    expect(names(doc(...nest, "\t\\clearpage", "# Whiskey Nested"))).toEqual(["h1:Whiskey Nested"]);
    expect(names(doc(...nest, "\t  \\clearpage", "# Xray Nested Six"))).toEqual(["h1:Xray Nested Six"]);

    // ── (d) TOP LEVEL IS UNCHANGED — with no container open the `null`/`indent <= 3` fail-safe
    // and column 0 both behave exactly as before. Both spellings were found on every build.
    expect(names(doc("Intro sentence.", "", "\t\\clearpage", "# Uniform Top Level"))).toEqual([
      "h1:Uniform Top Level",
    ]);
    expect(names(doc("Intro sentence.", "", "    \\clearpage", "# Victor Top Level Spaces"))).toEqual([
      "h1:Victor Top Level Spaces",
    ]);
  });
});

describe("a container OPENER's own indent is a COLUMN too, so a TAB can open one (Session 196)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: a TAB-indented LIST MARKER opens the container column its own column implies", () => {
    // ⚠ THE UNDERLINE IS SPELLED IN SPACES ON PURPOSE, and that is not cosmetic. Session 194
    // filed this family with a pinned document whose underline was `\t  ===`, and
    // `setextUnderlineLevel` reads `SETEXT_H1 = /^( *)=+[ \t]*$/` — spaces only. That row is a
    // SEPARATE filed item, out of scope here, so a tab-spelled underline would measure THAT
    // rule and not this one: the filed document cannot show this fix at all, and stays red
    // after it. The coupling was surveyed before this session's scope was written and is
    // recorded in its 1B claim.
    //
    // Both documents below were rendered through the real `quarto render` path this session
    // (corpus `gnd`, documents g0293 and g0282). They are a PAIR: the same container, the same
    // column, the same probe — differing only in whether the inner marker's indent is written
    // as one TAB or as four SPACES. Quarto renders the heading for both.
    expect(
      names(doc("Intro sentence.", "", "- outer item", "  outer body", "",
                "\t- inner", "", "      Probe Title", "      ===", "", "Tail sentence.")),
    ).toEqual(["h1:Probe Title"]);
    // CONTROL — the SPACE spelling reaching the same column 4. Found on every build, before
    // and after; it is what makes the marker's own indent SPELLING the mechanism rather than
    // anything about the nesting.
    expect(
      names(doc("Intro sentence.", "", "- outer item", "  outer body", "",
                "    - inner", "", "      Probe Title", "      ===", "", "Tail sentence.")),
    ).toEqual(["h1:Probe Title"]);
  });

  it("RED->GREEN: a TAB-indented FOOTNOTE definition opens its content column too", () => {
    // The `CONTENT_COLUMN_4_OPEN` half. Its PUSH arithmetic was already correct — Session 194
    // made the call site `contentColumns.push(indentWidth + 4)` where `indentWidth` is
    // `indentColumn(line)` — so only the regex's own leading class was blind. That is why this
    // half is a one-character-class change and not arithmetic.
    //
    // ⚠ THE LIVE REFERENCE IS LOAD-BEARING (Learning #253). An UNREFERENCED footnote definition
    // is dropped from quarto's rendered output ENTIRELY, so a corpus without one reads "no
    // heading" for every indent and concludes the container does not exist.
    //
    // Rendered this session: corpus `gnd`, documents g1197 (TAB) and g1186 (SPACE).
    expect(
      names(doc("Intro sentence with a live reference[^n1].", "", "- alpha", "  - bravo",
                "    bravo body", "", "\t[^n1]: note body", "",
                "        Probe Title", "        ===", "", "Tail sentence.")),
    ).toEqual(["h1:Probe Title"]);
    // CONTROL — the SPACE spelling of the same column 4. Found on every build.
    expect(
      names(doc("Intro sentence with a live reference[^n1].", "", "- alpha", "  - bravo",
                "    bravo body", "", "    [^n1]: note body", "",
                "        Probe Title", "        ===", "", "Tail sentence.")),
    ).toEqual(["h1:Probe Title"]);
  });

  it("RED->GREEN: an opener at CODE DEPTH opens no container, so the code block below it survives", () => {
    // ⚠ THIS IS A SCOPE AMENDMENT, AND THE MEASUREMENT FORCED IT. The two behaviours above
    // were declared complete by this session's own 1,265-document ground corpus: NEW LOST = 0,
    // 21 headings recovered, and every one of the 24 new phantoms proven per document to be
    // its SPACE twin's pre-existing error. A BLIND adversarial sweep — 240 documents from
    // eight lenses, none of which saw that corpus — then measured **39 NEW LOST**.
    //
    // The reason is Learning #280 from the other side. The ground corpus reads the column
    // stack through ONE consumer, the setext underline, so it could only ever see this family
    // as a PHANTOM. The blind lenses reached the OTHER consumer, `indentedCodeLine`, where the
    // same family is a LOSS: a TAB-indented opener at top level sits at column 4, which is
    // indented CODE to pandoc. Pushing a column for it RAISES the code base, so the column-8
    // line below stops being code and becomes an open paragraph — and `blank_before_header`
    // then suppresses the ATX heading underneath. A corpus that probes one consumer of a
    // shared structure has not measured the structure.
    //
    // The rule shipped here is the one the ground corpus had ALREADY measured exactly, and it
    // explains every residual list-marker phantom in all five of its contexts: an opener whose
    // OWN column is >= base + 4 is indented code and opens NO container.
    //
    // Rendered through the real `quarto render` path this session (corpus `advflat`, documents
    // l3d01 / l5d01 / l4d01). Each was found on the pre-session build, LOST by this session's
    // own first commit, and is restored here.
    expect(
      names(doc("Lens3 Doc01 lead paragraph.", "", "\t- marker at column four",
                "\t\tsecond line at column eight", "# Lens3 Doc01 Alfa")),
    ).toEqual(["h1:Lens3 Doc01 Alfa"]);
    // the footnote opener at the same depth, which is the other half of the amendment
    expect(
      names(doc("See[^1] for the note.", "", "\t[^1]: note body text", "",
                "        eight column continuation", "# Lens4 Doc01 Alpha")),
    ).toEqual(["h1:Lens4 Doc01 Alpha"]);
    // CONTROL — the SPACE spelling of the same shape. Found on every build, before and after;
    // it is what makes the depth, not the tab, the mechanism.
    expect(
      names(doc("Lens3 lead paragraph.", "", "    - marker at column four",
                "        second line at column eight", "# Space Spelled Alfa")),
    ).toEqual(["h1:Space Spelled Alfa"]);
    // CONTROL — the shipped behaviour is UNTOUCHED by the amendment. The same tab-indented
    // marker one column shallower than code, because a container is open at 2, still opens
    // its column 6 and still finds the heading quarto renders there.
    expect(
      names(doc("Intro sentence.", "", "- outer item", "  outer body", "",
                "\t- inner", "", "      Probe Title", "      ===", "", "Tail sentence.")),
    ).toEqual(["h1:Probe Title"]);
  });

  it("LABELLED TEST-AFTER — the two residual families, both PRE-EXISTING and both pinned", () => {
    // ⚠ NOT TDD. These pin behaviour this session did NOT change and deliberately did not
    // fix: they are a DIFFERENT rule (which column an opener opens) from the two shipped above
    // (how an opener's own indent is MEASURED, and whether a code-depth line is an opener at
    // all). Every document below was rendered through the real `quarto render` path this
    // session, and every assertion states what THIS MODEL does today, with quarto's real answer
    // in the comment beside it. The rule that would close both is stated exactly, because the
    // corpus measured it rather than guessing:
    //
    //   a footnote/definition-list definition's content column is `base + 4`, NOT `its own
    //   indent + 4`, where `base` is the enclosing block's content column AFTER the pop.
    //   Together with the code-depth guard shipped above, this explains ALL TWENTY footnote
    //   rows of the ground corpus EXACTLY — every context, every marker column, both spellings.
    //
    // (The corpus's third residual family, an opener at code depth opening a container anyway,
    // is not here because this session SHIPPED it — see the scope amendment above. It was
    // Session 194's FAMILY 4 and the indented half of Session 193's FAMILY 2, both re-rendered
    // and closed in place.)

    // ── FAMILY B — RULE 2, and it is NEW: not on the board before this session. The same
    // document is wrong in BOTH directions at once, which is why a one-directional edit here
    // would be wrong: we push column 8 (the marker's own indent + 4) where quarto opens 6
    // (the enclosing item's column 2, + 4). So we DELETE the heading quarto renders at 6 and
    // FABRICATE one at 8. This family is the whole of the corpus's residual LOST column.
    expect(
      names(doc("Intro sentence with a live reference[^n1].", "", "- outer item", "  outer body",
                "", "    [^n1]: note body", "",
                "      Probe Title", "      ===", "", "Tail sentence.")),
    ).toEqual([]); // quarto: h1:Probe Title — a LOST heading at the real column 6
    expect(
      names(doc("Intro sentence with a live reference[^n1].", "", "- outer item", "  outer body",
                "", "    [^n1]: note body", "",
                "        Probe Title", "        ===", "", "Tail sentence.")),
    ).toEqual(["h1:Probe Title"]); // quarto: NO heading — the phantom at our wrong column 8

    // ── FAMILY C — a DEFINITION-LIST marker at column 0 inside an open list item closes the
    // item and opens NOTHING; quarto accepts an underline at column 0 only. We open column 4
    // and emit a heading there. Measured, and distinct from FAMILY B: here the definition is
    // not indented at all, so RULE 2's `base + 4` would still give 4 and would NOT close it.
    expect(
      names(doc("Intro sentence.", "", "- outer item", "  outer body", "", ": definition body",
                "", "    Probe Title", "    ===", "", "Tail sentence.")),
    ).toEqual(["h1:Probe Title"]); // quarto: NO heading — a phantom, PRE-EXISTING
    // CONTROL — the same document with the underline at the list's own column 2. Quarto
    // renders no heading there either, and neither do we; the divergence is column 4 alone.
    expect(
      names(doc("Intro sentence.", "", "- outer item", "  outer body", "", ": definition body",
                "", "  Probe Title", "  ===", "", "Tail sentence.")),
    ).toEqual([]); // quarto agrees — no heading
  });
});

describe("a SETEXT UNDERLINE's own indent is a COLUMN too, so a TAB can reach one (Session 197)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: a TAB-indented `=` underline at the block's content column IS an underline", () => {
    // The LAST of the six sites in `model.ts` that measured indentation in a count of SPACES.
    // `SETEXT_H1`/`SETEXT_H2` were `/^( *)=+[ \t]*$/` and `setextUnderlineLevel` compared
    // `m[1].length` against a set of COLUMNS — so a tab-indented run did not match the regex
    // AT ALL (`^( *)` matches empty, then `=+` meets `\t` and fails) and could never be an
    // underline at any column, in any container.
    //
    // Both documents below were rendered through the real `quarto render` path this session
    // BEFORE any code changed (corpus `pins`, documents p05 and p06). They are a PAIR: the
    // same container, the same column, the same probe — differing only in whether the
    // underline's indent is written as one TAB or as four SPACES. `-   ` is a marker plus
    // three spaces, so the item's content column is 4 and a tab reaches exactly it.
    expect(
      names(doc("Intro.", "", "-   line one", "", "    Delta Tab Col Four Title", "\t===")),
    ).toEqual(["h1:Delta Tab Col Four Title"]);
    // CONTROL — the SPACE spelling reaching the same column 4. Found on every build, before
    // and after; it is what makes the underline's own indent SPELLING the mechanism rather
    // than anything about the container.
    expect(
      names(doc("Intro.", "", "-   line one", "", "    Delta Tab Col Four Title", "    ===")),
    ).toEqual(["h1:Delta Tab Col Four Title"]);
  });

  it("RED->GREEN: the `-` underline is the SAME rule, and it needed its own measurement", () => {
    // ⚠ A DASH RUN IS NOT THE SAME PROBE AS AN `=` RUN, which is why this is a second
    // RED->GREEN rather than a free ride on the first. `SETEXT_H2`'s bytes are also the shape
    // of a THEMATIC BREAK, and `SETEXT_H1`'s `=` run carries its own filed `CLOSES_PARAGRAPH`
    // residual — so a corpus built only from `===` would have measured one of the two rows and
    // generalised to both (Learning #285's mechanism, applied to the row rather than to the
    // column stack). Every `=` document in this session's pin corpus therefore has a dash twin,
    // and all twelve were rendered through the real `quarto render` path (corpus `pins2`).
    //
    // Rendered: q07 (TAB, container column 4) → h2, q11 (TAB, the three-deep sibling) → h2.
    // The dash row answers exactly as the `=` row does, in all four positions.
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "    Tango Dash Tab Underline", "\t---")),
    ).toEqual(["h2:Tango Dash Tab Underline"]);
    // CONTROL — the SPACE spelling reaching the same column 4 (rendered: q08). Found on every
    // build, before and after.
    expect(
      names(doc("Intro sentence.", "", "-   line one", "    line two", "",
                "    Uniform Dash Space Underline", "    ---")),
    ).toEqual(["h2:Uniform Dash Space Underline"]);
    // ⚠ THE GUARD, and it is the document Session 192 measured (rendered: q09). The container's
    // content column is 2 and a tab reaches 4, so there is no heading here — for quarto or for
    // us, before this change or after. This is the assertion that would fail if the fix had
    // been "a tab is deep enough" rather than "a tab is worth the columns it spans".
    expect(
      names(doc("Intro sentence.", "", "- line one", "  line two", "",
                "  Victor Dash Column Two", "\t---")),
    ).toEqual([]); // quarto: no heading — 4 is not 2, and both of us decline
  });

  it("LABELLED TEST-AFTER — the residual families, every one PRE-EXISTING and pinned", () => {
    // ⚠ NOT TDD. These pin behaviour this session did NOT change and deliberately did not fix.
    // Every document was rendered through the real `quarto render` path this session, and each
    // was adjudicated by the MECHANICAL SPACE TWIN (Learning #286) rather than by argument:
    // expand every leading tab to the spaces reaching the same column, render both, and ask
    // what the PRE-SESSION build did on the twin. All three phantom families below came back
    // PRE-EXISTING — the pre-session build makes the identical error on the space spelling —
    // so they are a defect this change made REACHABLE through a second spelling, not one it
    // introduced. That is the decision rule this session's 1B claim declared in advance.
    //
    // They were found by the session's OWN completeness pass, not by its designed corpus: the
    // ground sweep varies context x column x spelling x row x tail and holds the TITLE's shape
    // and the absence of a quote/fence/raw block FIXED, so it cannot see any of these
    // (Learning #278 — run the completeness role firsthand).

    // ── FAMILY A — the two KNOWN RESIDUALS that `SETEXT_H1`'s own docstring already lists,
    // now reachable through the tab spelling too. A raw HTML block and a raw TeX line each
    // open a fresh block, so the line below them is a setext title; we then report the block's
    // LITERAL TEXT as the heading, where quarto renders the block and no heading at all.
    expect(
      names(doc("Intro.", "", "-   line one", "", "    <div>", "\t===")),
    ).toEqual(["h1:<div>"]); // quarto: NO heading — pre-existing, the twin errs identically
    expect(
      names(doc("Intro.", "", "-   line one", "", "    \\clearpage", "\t===")),
    ).toEqual(["h1:\\clearpage"]); // quarto: NO heading — pre-existing, same twin verdict

    // ── FAMILY B — CLOSED IN PLACE BY SESSION 201, which replaced the guard's blanket DECLINE
    // with the measured strip. RE-RENDERED on these exact bytes first (`scratchpad/s201/pins`,
    // `p5_s197_famB`): quarto emits `h1:marker title`, so the pin's comment was right about this
    // document. What it was wrong about is the FIX it implied — it read the defect as
    // `BULLET_LIST_MARKER`'s ` {0,3}` cap being too narrow, i.e. as a guard that should have
    // fired here, when in fact the guard should not have existed in this form at any column: at
    // columns 0–3, where it DID fire, it was deleting the same heading outright.
    expect(
      names(doc("Intro.", "", "-   line one", "", "    - marker title", "\t===")),
    ).toEqual(["h1:marker title"]); // quarto agrees exactly — recovered by Session 201

    // ── FAMILY C — CLOSED IN PLACE BY SESSION 200, which made both fence rows
    // container-relative. It was BY-CATCH here and a LOSS rather than a phantom: a fenced code
    // block at a container's content column was not recognised as a fence at all, because
    // `FENCE_OPEN` carried the same literal ` {0,3}` cap, so the title after its closer was
    // never at `consecutiveBody === 1`. RE-RENDERED on these exact bytes before the flip
    // (`scratchpad/s200/pins`): quarto emits `h1:Title After Fence` in the space spelling, the
    // tab spelling and the top-level control alike.
    expect(
      names(doc("Intro.", "", "-   line one", "", "    ```", "    code", "    ```",
                "    Title After Fence", "    ===")),
    ).toEqual(["h1:Title After Fence"]); // quarto agrees exactly — recovered by Session 200
    expect(
      names(doc("Intro.", "", "```", "code", "```", "Title After Fence", "===")),
    ).toEqual(["h1:Title After Fence"]); // CONTROL — the same shape at top level, found on both builds

    // ── FAMILY D — THE LOSS MECHANISM THE BLIND SWEEP FOUND, and the only one of these that
    // costs a real heading. When a run IS consumed as an underline the scanner `continue`s,
    // which sets `paragraphOpen = false` and so ARMS the container pop for the next line. A
    // column-0 line below then closes the list — but pandoc keeps it open, so the underline
    // further down no longer matches any column and its heading is deleted. The document below
    // recovers `Line one here.` and loses `Real Title` at the same time, which is why a net
    // count says nothing here and the SET is what was scored (Learning #272).
    //
    // ⚠ PRE-EXISTING, and that is the mechanical twin's verdict rather than an argument: the
    // same document with every leading tab expanded to the spaces reaching the same column
    // loses `Real Title` on the PRE-SESSION build too. It is the pop-suppression family
    // already on the board, reached through the setext branch instead of through the stack.
    //
    // ✅ CLOSED BY SESSION 198 — the pop's suppression test is the BLANK LINE above, not
    // `paragraphOpen`, so a consumed underline no longer arms it. Both documents were
    // RE-RENDERED on these exact bytes before the flip (`scratchpad/s198/pins/famD_tab.qmd`
    // and `famD_space.qmd`); quarto emits all three headings for each. The live RED->GREEN
    // for this behaviour is in the Session 198 describe at the foot of this file — these two
    // stay here as the family's own record, now agreeing with the renderer.
    expect(
      names(doc("## Ledger", "", "-   Item alpha.", "", "\tLine one here.", "\t---",
                "back at zero, lazily", "", "    Real Title", "    ===")),
    ).toEqual(["h2:Ledger", "h2:Line one here.", "h1:Real Title"]);
    // CONTROL — the SPACE spelling of the same document. It lost the identical heading on the
    // pre-S198 build, which is what made the pop, not the tab, the mechanism.
    expect(
      names(doc("## Ledger", "", "-   Item alpha.", "", "    Line one here.", "    ---",
                "back at zero, lazily", "", "    Real Title", "    ===")),
    ).toEqual(["h2:Ledger", "h2:Line one here.", "h1:Real Title"]);

    // ── FAMILY E — the REALISTIC shape, kept because it is the one a reader will meet: an
    // ASCII table indented under a paragraph whose first word is `Dr.`. `listItemContentColumn`
    // reads `Dr.` as an ordered-list marker and opens content column 4 that pandoc never opens;
    // the table's rule line then sits exactly on it. ⚠ PRE-EXISTING and hand-verified: the
    // all-spaces twin of this document fabricates the identical heading on the PRE-SESSION
    // build, so an author who indents with spaces — the common case — already sees it today.
    expect(
      names(doc("## Station log", "", "Wind was steady from the northwest.",
                "Dr. Vasquez logged the following at station 4.", "",
                "    Station", "\t-------", "    A-14", "", "We repeat next week.")),
    ).toEqual(["h2:Station log", "h2:Station"]); // quarto: h2:Station log only — `Station` is a phantom
  });
});

describe("the container POP's SUPPRESSION CONDITION is a BLANK LINE, not an open paragraph (Session 198)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: a CONSUMED setext underline must not arm the pop for the line below it", () => {
    // Session 197's FAMILY D, re-rendered on these exact bytes before being flipped
    // (`scratchpad/s198/pins/famD_tab.qmd` and `famD_space.qmd`): quarto emits THREE headings
    // and this model emitted two. The setext branch sets `paragraphOpen = false` and
    // `continue`s, which ARMS the `if (!paragraphOpen)` pop; the column-0 line below then
    // closes the item, and the underline at column 4 further down matches no column at all.
    //
    // Pandoc closes a list item at a non-blank line only where that line is a LIST START —
    // any other non-blank line is absorbed lazily, whatever the line above it was. Measured
    // as a 64-document sweep (`scratchpad/s198/pop`): 8 spellings of the line ABOVE x 4 of
    // the column-0 line x 2 body shapes, and the answer separates perfectly on those two
    // facts and on nothing else.
    expect(
      names(doc("## Ledger", "", "-   Item alpha.", "", "\tLine one here.", "\t---",
                "back at zero, lazily", "", "    Real Title", "    ===")),
    ).toEqual(["h2:Ledger", "h2:Line one here.", "h1:Real Title"]);
    // CONTROL — the SPACE spelling of the same document, which quarto answers identically.
    expect(
      names(doc("## Ledger", "", "-   Item alpha.", "", "    Line one here.", "    ---",
                "back at zero, lazily", "", "    Real Title", "    ===")),
    ).toEqual(["h2:Ledger", "h2:Line one here.", "h1:Real Title"]);
  });

  it("RED->GREEN: a shallower LIST START does close the deeper column, blank line or not", () => {
    // The other half of the same condition, and the second separately-filed item it answers
    // (Session 192's RAGGED-STACK pop). Pandoc absorbs a shallow non-blank line lazily —
    // EXCEPT where it is a list start, which always closes the deeper item. Replacing
    // `paragraphOpen` with the blank-line test alone would therefore trade this session's
    // recovered headings for a fresh crop of phantoms: `  - deep first item` opens column 4,
    // `- shallow next item` must close it, and the underline at column 4 below must then
    // match nothing.
    //
    // Re-rendered on these exact bytes before the flip (`scratchpad/s198/pins/ragged.qmd`):
    // quarto emits `h1:Eta Plain Title` and nothing else.
    expect(
      names(doc("Ragged stack probe.", "", "  - deep first item", "- shallow next item", "",
                "  Eta Ragged Title", "    ===", "", "- plain item", "", "  Eta Plain Title", "  ===")),
    ).toEqual(["h1:Eta Plain Title"]);
    // CONTROL — the same document with the underline at column 0, where quarto renders BOTH
    // and so do we, before this change and after (`scratchpad/s198/pins/ragged_ctl.qmd`).
    expect(
      names(doc("Ragged stack probe.", "", "  - deep first item", "- shallow next item", "",
                "  Eta Ragged Title", "===", "", "- plain item", "", "  Eta Plain Title", "===")),
    ).toEqual(["h1:Eta Ragged Title", "h1:Eta Plain Title"]);
  });

  it("RED->GREEN: a list start closes a LIST ITEM container, never a DEFINITION one", () => {
    // ⚠ THIS TEST EXISTS BECAUSE THE TWO HALVES ABOVE, SHIPPED ALONE, DELETE REAL HEADINGS.
    // The designed 203-document sweep scored them at zero new errors in either direction; a
    // 300-document completeness pass aimed at the OTHER TWO readers of `contentColumns` then
    // measured THREE NEW LOSSES, and all three are this shape — a container opened by a
    // footnote or definition-list marker, a shallow LIST START, and a probe at the container's
    // own content column that quarto still honours. Every one was decided against the
    // pre-session build on identical bytes: PRE agreed with quarto, POST did not, so they are
    // CAUSED by this change and are closed here rather than filed (the decision rule this
    // session's 1B claim declared in advance).
    //
    // Measured over 40 documents (`scratchpad/s198/reg`), container KIND x shallow spelling:
    // a footnote or definition container survives a shallow list start in all four spellings,
    // and a list item container survives only prose. The stack therefore has to carry a KIND
    // per column — a column alone cannot answer this.
    expect(
      names(doc("## Ledger", "", "Term here", "", ":   the definition body", "",
                "    Body prose line.", "* shallow star", "", "    Probe Title", "    ===")),
    ).toEqual(["h2:Ledger", "h1:Probe Title"]);
    // CONTROL — the identical shape whose container is a LIST ITEM, which the same list start
    // DOES close. This is the assertion that fails if the fix is "a list start pops nothing".
    expect(
      names(doc("## Ledger", "", "-   Item alpha.", "",
                "    Body prose line.", "* shallow star", "", "    Probe Title", "    ===")),
    ).toEqual(["h2:Ledger"]);
  });

  it("LABELLED TEST-AFTER — the two residual families, both PRE-EXISTING and pinned", () => {
    // ⚠ NOT TDD. These pin behaviour this session did NOT change and deliberately did not fix.
    // Both were adjudicated against the PRE-SESSION build on identical bytes: the pre-build
    // makes the identical error, so they are defects this change neither caused nor cured, and
    // by the decision rule the 1B claim declared in advance they are FILED rather than closed.
    // Every document below was rendered through the real `quarto render` path this session.
    //
    // ⚠ quarto emits an `h2:Footnotes` section for any document carrying a footnote. It is
    // GENERATED — no source line produces it — so this model neither emits it nor should, and
    // it is excluded from the quarto sets quoted below. Counting it as a lost heading is what
    // first made this session's residual figure 135 instead of 78 (Learning #297).

    // ── FAMILY A — a BARE `-` is a one-character dash run, and `SETEXT_H2` promotes the line
    // above it. Pandoc reads the `-` as a list marker with an empty item and promotes nothing.
    // Rendered as `scratchpad/s198/pop3/m_para_dashonly.qmd`.
    expect(
      names(doc("## Ledger", "", "-   Item alpha.", "", "    Body line here.", "-", "",
                "    Probe Title", "    ===")),
    ).toEqual(["h2:Ledger", "h2:Body line here."]); // quarto: h2:Ledger alone
    // CONTROL — the same document whose shallow line is a bullet with CONTENT. Here the dash
    // really is a marker for both of us, and neither promotes the line above.
    expect(
      names(doc("## Ledger", "", "-   Item alpha.", "", "    Body line here.", "- with text", "",
                "    Probe Title", "    ===")),
    ).toEqual(["h2:Ledger"]);

    // ── FAMILY B — a list marker ABSORBED LAZILY into a definition body opens its content
    // column relative to the DOCUMENT, not to that body. Pandoc parses the bullet INSIDE the
    // note, where its content column is 2 relative to a body that starts at 4 — absolute 6, not
    // the absolute 2 this model pushes. Rendered as `scratchpad/s198/nest/n_defonly_dash_2.qmd`.
    expect(
      names(doc("## Ledger", "", "See[^1] for it.", "", "[^1]: the note body", "",
                "    body line.", "- shallow bullet", "", "  Probe Title", "  ===")),
    ).toEqual(["h2:Ledger", "h1:Probe Title"]); // quarto: h2:Ledger alone (plus its Footnotes section)
    // CONTROL — the SAME shape probed at column 6, which is where pandoc really does open the
    // absorbed bullet's content. Quarto renders the heading there and so do we, which is what
    // makes this a column-arithmetic defect rather than a pop defect
    // (`scratchpad/s198/nest/n_defthenlist_dash_6.qmd`).
    expect(
      names(doc("## Ledger", "", "See[^1] for it.", "", "[^1]: the note body", "",
                "    - inner item", "", "      inner body line.", "- shallow bullet", "",
                "      Probe Title", "      ===")),
    ).toEqual(["h2:Ledger", "h1:Probe Title"]);
  });
});

describe("an ATX heading's own indent is a COLUMN EQUALITY, not a ` {0,3}` cap (Session 199)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: an indent that matches NO open content column is not a heading at all", () => {
    // ⚠ THE SURPRISE, AND IT IS WHY THIS ROW WAS WRONG IN BOTH DIRECTIONS: pandoc's markdown
    // reader does NOT give an ATX heading CommonMark's 0-3 space tolerance. Measured over a
    // 121-document grid (`scratchpad/s199/gnd` — 8 container shapes x 11 indents x 2 levels,
    // every one quarto exit 0) and hand-verified against the raw HTML rather than through the
    // extractor: at top level `# Probe Title` renders `<h1>` at column 0 and the literal
    // paragraph `<p># Probe Title</p>` at columns 1, 2 AND 3.
    //
    // The rule that fits all 121 rows is the one `setextUnderlineLevel` already carries — the
    // indent must EQUAL a column in `[0, ...contentColumns]`:
    //
    //   top   (col 0)      heading at 0 only
    //   - x   (col 2)      heading at 0 and 2
    //   1. x  (col 3)      heading at 0 and 3
    //   -   x (col 4)      heading at 0 and 4
    //   nested 2/4         heading at 0, 2 AND 4 — the whole stack, not the innermost
    //   nested 2/4/6       heading at 0, 2, 4 AND 6
    //
    // This half is the NARROWING, and it lands FIRST on purpose: widening the leading class
    // before the column test exists would open a window in which the row over-accepts at every
    // indent, and an over-accepting heading row fabricates sections in the outline.
    expect(names(doc("Intro paragraph.", "", " # Probe Title", "", " Tail body line."))).toEqual([]);
    // CONTROL — the identical document at column 0, where quarto DOES render the heading. It is
    // what makes this a column defect rather than "an indented line is never a heading"
    // (`scratchpad/s199/gnd/top_i01_h1.qmd` and `top_i00_h1.qmd`, both rendered).
    expect(names(doc("Intro paragraph.", "", "# Probe Title", "", "Tail body line."))).toEqual([
      "h1:Probe Title",
    ]);
  });

  it("RED->GREEN: a heading AT its container's content column is a heading, at any depth", () => {
    // The WIDENING half. With the column test in place the leading class can be opened without
    // over-accepting anywhere: ` {0,3}` cannot even SEE column 4, so every heading a container
    // offers past column 3 was unreachable regardless of what the column test decided.
    //
    // Session 194's FAMILY 2, re-rendered on these exact bytes before being flipped
    // (`scratchpad/s199/ax/pin_s194_fam2.qmd`): the inner item's content column is 4 and quarto
    // renders the heading there.
    expect(
      names(doc("Intro.", "", "- Site logistics", "  - Access road status", "",
                "    # Tango Indented ATX", "", "    Body text.")),
    ).toEqual(["h1:Tango Indented ATX"]);
    // CONTROL — the same heading at column 0, which both builds have always agreed on
    // (`pin_s194_ctl.qmd`).
    expect(
      names(doc("Intro.", "", "- Site logistics", "  - Access road status", "",
                "# Uniform Column Zero ATX", "", "Body text.")),
    ).toEqual(["h1:Uniform Column Zero ATX"]);
    // The SINGLE-container spelling of the same column, which S194 pinned beside it
    // (`pin_s194_fam2b.qmd`).
    expect(
      names(doc("Intro.", "", "-   line one", "    line two", "",
                "    # Victor Four Column ATX", "", "    Body text.")),
    ).toEqual(["h1:Victor Four Column ATX"]);
  });

  it("RED->GREEN: a `from:` key SUSPENDS the column rule — gfm and commonmark really are CommonMark", () => {
    // ⚠ FOUND BY THIS SESSION'S COMPLETENESS PASS, AND CAUSED BY THIS SESSION'S OWN CHANGE.
    // The equality above is quarto's DEFAULT-dialect rule. A front-matter `from:` key can
    // select a reader that genuinely has CommonMark's 0-3 tolerance, and then refusing
    // columns 1-3 DELETES a heading quarto renders. Measured over 29 rendered documents
    // (`scratchpad/s199/comp`, five keys x four indents plus a container column and a no-key
    // control), and the split is exact:
    //
    //     from: gfm                            heading at 0, 1, 3 — and at container column 4
    //     from: commonmark                     heading at 0, 1, 3 — and at 4
    //     from: markdown                       heading at 0 and 4 only
    //     from: markdown_strict                heading at 0 and 4 only
    //     from: markdown-blank_before_header   heading at 0 and 4 only
    //     (no key)                             heading at 0 and 4 only
    //
    // The suspension keys on the KEY'S PRESENCE, not on resolving which dialect it names —
    // the same fail-open `FRONTMATTER_FROM_KEY` already documents for the `paragraphOpen`
    // bail, and resolving the dialect would be a different capability. The measured cost is
    // that the three non-CommonMark keys retain a phantom at indents 1-3, which is this
    // project's permitted direction; the alternative is deleting real headings under `gfm`.
    expect(
      names(doc("---", "from: gfm", "---", "", "Intro paragraph.", "", " # Probe Title", "",
                " Tail body line.")),
    ).toEqual(["h1:Probe Title"]);
    // CONTROL — the identical body with NO `from:` key, where quarto renders no heading and
    // the column rule stands (`scratchpad/s199/comp/dia_none_i1.qmd`).
    expect(
      names(doc("Intro paragraph.", "", " # Probe Title", "", " Tail body line.")),
    ).toEqual([]);
    // CONTROL — a `from:` key does NOT disable the container column, which still resolves
    // (`dia_gfm_c4.qmd`, rendered: quarto emits the heading here too).
    expect(
      names(doc("---", "from: gfm", "---", "", "-   item one", "", "    # Probe Title", "",
                "    Tail body line.")),
    ).toEqual(["h1:Probe Title"]);
    // ⚠ THE SUSPENSION IS BOUNDED AT 3, AND THE FIRST DRAFT OF IT WAS NOT — it suspended the
    // rule ENTIRELY, which with the widened leading class accepts EVERY indent and fabricated
    // a heading at column 4 under all five keys. Column 4 with no container is an indented
    // CODE block in every dialect measured, `gfm` and `commonmark` included
    // (`dia_gfm_i4.qmd`, `dia_markdown_i4.qmd` — quarto renders no heading in any of them).
    // So the fallback is CommonMark's own 0-3 tolerance, not "anything".
    expect(
      names(doc("---", "from: gfm", "---", "", "Intro paragraph.", "", "    # Probe Title", "",
                "    Tail body line.")),
    ).toEqual([]);
  });

  it("test-after (DISCLOSED, and the one error this change INTRODUCES): the ATX-SWALLOW's text", () => {
    // ⚠ **THIS IS THE ONE NEW ERROR OVER 189 RENDERED DOCUMENTS, IT IS INTRODUCED RATHER THAN
    // PRE-EXISTING, AND IT IS DISCLOSED HERE RATHER THAN CLOSED.** The mechanical per-error
    // adjudication against the pre-session build on identical bytes
    // (`scratchpad/s199/newerr199.py`) returns INTRODUCED 1, CARRIED 7, FIXED 54, and this is
    // the 1.
    //
    // The underlying divergence is Session 182's already-filed item: pandoc SWALLOWS an ATX
    // line into a setext heading below it, keeping the literal `#` in the text, and this model
    // declines that on purpose — an outline row reading `# Heading Above` is noise. Declining
    // it is a deliberate product choice, so "closing" this would mean reversing S182's
    // decision, which is a different capability (FM #26).
    //
    // What this change actually did, measured across three builds:
    //
    //   indent 0   quarto `h1:# Heading Above`   pre `h1:Heading Above`   ship UNCHANGED
    //   indent 1   quarto `h1:# Indented …`      pre `h1:Indented …`      ship NOW AGREES
    //   column 4   quarto `h1:# Container …`     pre AGREED               ship strips the `#`
    //
    // ⚠ The pre-session build was right at column 4 BY ACCIDENT — ` {0,3}` could not see the
    // heading at all, so the line fell through and the `===` below claimed it as a setext
    // title, literal `#` included. The same accident-shaped result S197 documented for the
    // tab-indented underline. What ships is UNIFORM: the `#` is now stripped at column 0 and
    // at column 4 alike, where before the two columns disagreed with each other. No heading is
    // deleted or fabricated in any row here — both renderers emit exactly one `h1`, and only
    // the TEXT differs.
    expect(
      names(doc("-   item one", "", "    # Container Heading Above", "    ===", "",
                "    Body tail.")),
    ).toEqual(["h1:Container Heading Above"]); // quarto: h1:# Container Heading Above
    // CONTROL — the column-0 spelling, where BOTH builds strip the `#` and always have. It is
    // what makes this a text-divergence family rather than something this change invented
    // (`scratchpad/s199/comp/sw_after_i0.qmd`, rendered).
    expect(
      names(doc("Intro paragraph.", "", "# Heading Above", "===", "", "Body tail.")),
    ).toEqual(["h1:Heading Above"]); // quarto: h1:# Heading Above — pre-existing, identical in both builds
    // CONTROL — indent 1, which this change moved the OTHER way: the ATX row now declines it,
    // the line falls through, and the underline claims it with quarto's own text
    // (`sw_after_i1.qmd`).
    expect(
      names(doc("Intro paragraph.", "", " # Indented Heading Above", "===", "", "Body tail.")),
    ).toEqual(["h1:# Indented Heading Above"]); // quarto agrees exactly — recovered by this change
  });
});

describe("a FENCE's own indent is CONTAINER-RELATIVE, not a ` {0,3}` cap (Session 200)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: a fence at a container's content column IS a fence, so the title below its closer is a heading", () => {
    // Session 197's FAMILY C, closed in place. RE-RENDERED on these exact bytes before being
    // flipped (`scratchpad/s200/pins`): quarto emits `h1:Title After Fence` here, in the space
    // spelling AND the tab spelling, and the pin's comment was right.
    //
    // The fence is never recognised, so its three lines are ordinary paragraph text, the title
    // is line four of a paragraph that opened at the fence, and `consecutiveBody === 1` is
    // never true when the underline arrives. The heading is DELETED.
    expect(
      names(doc("Intro.", "", "-   line one", "", "    ```", "    code", "    ```",
                "    Title After Fence", "    ===")),
    ).toEqual(["h1:Title After Fence"]);
  });

  it("RED->GREEN: an OPEN PARAGRAPH above the opener keeps the old ` {0,3}` width, so this change cannot reach it", () => {
    // ⚠ THE ONE ERROR THIS SESSION'S OWN CHANGE INTRODUCED, found by the completeness pass
    // budgeted in the 1B claim and closed here. `-   item one` / `    paragraph line` /
    // `    ```` ``` ```` renders NO heading: quarto reads the whole item as ONE paragraph and
    // the backtick pair as an INLINE code span — `<li>item one paragraph line <code>qqq
    // code body</code></li>`, read off the raw HTML. A plain fence does not, in general,
    // interrupt an open paragraph.
    //
    // ⚠ THE OBVIOUS FIX — a `paragraphOpen` bail on the whole branch — IS MEASURABLY WRONG,
    // which is why it is not what shipped. At column 0 the fence DOES interrupt (measured:
    // `scratchpad/s200/par`, `par_top_i00` renders `<pre class="qqq">`), and bailing there
    // deletes `h1:Para Direct Title` from a document both builds get right today. Whether a
    // fence interrupts a paragraph is a SEPARATE rule with its own two-directional cost — it
    // is not the indent question, it turns on the fence CHAR (a `~~~` opener at column 0 does
    // NOT interrupt where ```` ``` ```` does), and it is left filed rather than guessed.
    //
    // So what ships is the narrow, honest boundary: while a paragraph is open the fence rows
    // keep the width they had BEFORE this session, and this change simply does not apply. Every
    // error it introduces there disappears; every error already there is carried unchanged.
    expect(
      names(doc("-   item one", "    paragraph line", "    ```", "    code", "    ```",
                "    Para Direct Title", "    ===")),
    ).toEqual([]); // quarto: no heading — one paragraph, the backticks an inline code span
    // CONTROL — the column-0 shape the naive bail would have broken. Both builds find it and
    // so does quarto (`scratchpad/s200/twin`, `twin_i00`, rendered).
    expect(
      names(doc("Intro paragraph.", "```", "code", "```", "Para Direct Title", "===")),
    ).toEqual(["h1:Para Direct Title"]); // quarto: h1:Para Direct Title
    // CONTROL — the same document with a BLANK LINE above the opener, which is what puts the
    // fence back in this session's scope: no paragraph is open, so the container column
    // applies and the title below the closer is recovered.
    expect(
      names(doc("-   item one", "", "    ```", "    code", "    ```",
                "    Para Blank Title", "    ===")),
    ).toEqual(["h1:Para Blank Title"]); // quarto agrees exactly
  });
});

describe("a BULLET MARKER on a setext title is STRIPPED, not a reason to decline (Session 201)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("RED->GREEN: a bullet-marker title at COLUMN 0 is a heading, with the marker stripped", () => {
    // ⚠ THE FILED ITEM WAS HALF THE PICTURE, AND ITS OWN RECOMMENDED FIX POINTS THE WRONG WAY.
    // It described a TEXT divergence at a container's content column — `    - marker title` /
    // `===` reaching the outline as `h1:- marker title` where quarto renders `h1:marker title`
    // — and concluded that `BULLET_LIST_MARKER`'s ` {0,3}` cap should be made
    // container-relative, as Sessions 199 and 200 did for the ATX and fence rows.
    //
    // But this guard does not CORRECT the text; it DECLINES the heading entirely. So widening
    // it would have converted that text divergence into a heading DELETION — and it would have
    // done so on top of a deletion that was already there, unmeasured, since the beginning:
    //
    //   `- marker title` / `===`   →   quarto renders `<h1>marker title</h1>`   we rendered NOTHING
    //
    // Rendered firsthand through the real `quarto render` path, quarto 1.7.33
    // (`scratchpad/s201/cal`, then 198 documents in `scratchpad/s201/gnd`): pandoc strips the
    // marker and nests the heading inside the `<li>`, so a heading DOES exist at every column a
    // bullet can sit at — 36 of 36 heading-bearing ground rows, all three marker characters,
    // six container shapes, both underline levels. The guard's docstring called its decline "a
    // false negative" it "must" take; the false negative was never necessary, because the text
    // it was avoiding is obtainable by stripping the marker (Learning #300 — the docstring said
    // "Confirmed against the real Quarto CLI", and the half it confirmed was the nesting, not
    // the emptiness).
    expect(names(doc("- marker title", "==="))).toEqual(["h1:marker title"]);
  });

  it("RED->GREEN: a title that is ONLY markers has an EMPTY innermost item, so there is no heading", () => {
    // ⚠ THE FIRST ERROR THIS SESSION'S OWN CHANGE INTRODUCED, and it is an error the OLD guard
    // did not have: the blanket decline covered these rows by accident. Stripping alone leaves
    // the last, contentless marker behind and reports it as a heading.
    //
    // Rendered (`scratchpad/s201/tbrk`, `scratchpad/s201/tb2`): all four render NO heading,
    // because the innermost list item has no content and an empty item has no heading text.
    // Returning `""` routes them into `buildHeading`'s existing `null`, so nothing new decides
    // this — the strip just has to stop pretending a bare marker is content.
    expect(names(doc("- -", "==="))).toEqual([]); // quarto: no heading
    expect(names(doc("-   -", "==="))).toEqual([]); // quarto: no heading
    expect(names(doc("- * -", "==="))).toEqual([]); // quarto: no heading — mixed chars, still a list
    expect(names(doc("+ + +", "==="))).toEqual([]); // quarto: no heading — `+` is not a break char
    // CONTROL — the same three-marker shape WITH content is a heading, so this rule must not be
    // "three markers means nothing". `- - x -` keeps the text AFTER the run, `-` included.
    expect(names(doc("- - - x", "==="))).toEqual(["h1:x"]); // quarto: h1:x
    expect(names(doc("- - x -", "==="))).toEqual(["h1:x -"]); // quarto: h1:x -
  });

  it("RED->GREEN: a THEMATIC BREAK spelled with bullet characters keeps its markers LITERALLY", () => {
    // ⚠ THE ONE SHAPE WHERE THE MARKER SURVIVES, and both the old decline and a plain strip get
    // it wrong — in opposite ways. `- - -` is a thematic BREAK, not a list, so pandoc's setext
    // parse claims the line whole and the heading text is the line as written. The old guard
    // declined it (a deleted heading); the strip alone reported `h1:-` (a wrong text).
    //
    // Rendered (`scratchpad/s201/tbrk`, `scratchpad/s201/tb2`) — the family separates on the
    // MARKER CHARACTER and on the COUNT, and both boundaries are measured rather than
    // transcribed from CommonMark §4.1:
    //
    //   `- - -`  `* * *`  `- - - -`  `-  -  -`  →  heading, text LITERAL   3+ of one break char
    //   `+ + +`                                 →  NO heading             `+` is not a break char
    //   `- -`  `-   -`                          →  NO heading             two is not a break
    //   `- * -`                                 →  NO heading             mixed is not a break
    //   `- - - x`                               →  h1:x                   content makes it a LIST
    expect(names(doc("- - -", "==="))).toEqual(["h1:- - -"]); // quarto: h1:- - -
    expect(names(doc("* * *", "==="))).toEqual(["h1:* * *"]); // quarto: h1:* * *
    expect(names(doc("- - - -", "==="))).toEqual(["h1:- - - -"]); // quarto: h1:- - - -
    expect(names(doc("-  -  -", "==="))).toEqual(["h1:-  -  -"]); // quarto: h1:- - - (HTML collapses runs)
    expect(names(doc("- - - ", "==="))).toEqual(["h1:- - -"]); // quarto: h1:- - - — trailing space
    // ⚠ CONTROL — the same break INSIDE a container, which is the row that already agreed before
    // this session and must still agree after it (`scratchpad/s201/tbrk`, `t5_dash3_b4`).
    expect(
      names(doc("Intro.", "", "-   line one", "", "    - - -", "    ===")),
    ).toEqual(["h1:- - -"]); // quarto: h1:- - -
  });

  it("RED->GREEN: at INDENTED-CODE DEPTH the line is not a list item, so the marker SURVIVES", () => {
    // ⚠ THE SECOND ERROR THIS SESSION'S CHANGE INTRODUCED — found by a BLIND adversarial lens
    // (`scratchpad/s201/adv/ws`, `ws_02`), not by any designed corpus of mine, and then measured
    // as a clean boundary over its own 15-document grid (`scratchpad/s201/cd`).
    //
    // A line 4 or more columns past the enclosing block's content column is INDENTED CODE, so
    // pandoc never parses it as a list item and there is no nesting to strip. The `===` below it
    // still makes it a setext heading — of the RAW line, marker included:
    //
    //   top level, underline at 0:   indents 0-3  strip  ·  indents 4,5,6,8  KEEP
    //   inside `-   line one` (c=4), underline at 4:   4-7  strip  ·  8,9,10  KEEP
    //
    // ⚠ THE OLD ` {0,3}` CAP WAS THIS RULE, MIS-MEASURED. It is exactly code depth counted from
    // source column 0 instead of from the container — which is why it was accidentally RIGHT at
    // top level and wrong at every container column. So the cap was never arbitrary; it was a
    // correct rule with a wrong origin, and replacing it with `indentedCodeLine` makes the depth
    // at which a marker stops being a marker the same one definition as the depth at which a
    // container stops being a container (Session 196) and a fence stops being a fence (Session
    // 200). Three rows, one notion of code depth.
    expect(names(doc("    - Ws Delta Probe", "==="))).toEqual(["h1:- Ws Delta Probe"]);
    // the tab spelling of the same column, which is how the blind lens found it
    expect(names(doc(" \t- Ws Charlie Probe", "==="))).toEqual(["h1:- Ws Charlie Probe"]);
    // CONTROL — one column shallower is NOT code depth, so the marker goes
    expect(names(doc("   - cd probe title", "==="))).toEqual(["h1:cd probe title"]);
    // CONTAINER-RELATIVE, both sides of the boundary: c=4, so 7 strips and 8 keeps
    expect(
      names(doc("Intro.", "", "-   line one", "", "       - cd probe title", "    ===")),
    ).toEqual(["h1:cd probe title"]); // quarto: h1:cd probe title
    expect(
      names(doc("Intro.", "", "-   line one", "", "        - cd probe title", "    ===")),
    ).toEqual(["h1:- cd probe title"]); // quarto: h1:- cd probe title
  });

  it("RED->GREEN: the REPEATED strip stops at a marker that is itself at code depth INSIDE its item", () => {
    // ⚠ THE THIRD ERROR THIS SESSION'S CHANGE INTRODUCED, and the second one found by a BLIND
    // lens rather than by any corpus of mine (`scratchpad/s201/adv/cont`, `cont_12`). The
    // repeated strip was a single regex — `(?:[-*+][ \t]+)+` — which has no notion of where the
    // markers SIT, so it ate a second marker that pandoc reads as indented code.
    //
    // CommonMark: a gap WIDER THAN FOUR after a marker puts the item's content in indented code,
    // so the item's content column is one past the marker rather than at the content itself.
    // Measured over a 14-document gap sweep (`scratchpad/s201/gap`), and the threshold is exact:
    //
    //   `-`+1..4 spaces+`- title`   both markers stripped   content column 2..5
    //   `-`+5..7 spaces+`- title`   only the FIRST stripped  content column 2, second marker >= 6
    //
    // So the strip has to walk the markers one at a time, carrying the content column each one
    // opens, and stop at the first marker that is at code depth relative to it. That is the same
    // `columnIsCodeDepth` question asked once per marker instead of once per line.
    expect(names(doc("Intro prose.", "", "-     - gap probe title", "==="))).toEqual([
      "h1:- gap probe title",
    ]); // quarto: h1:- gap probe title — the second marker is code, not a marker
    // CONTROL — one space narrower is the last gap that still nests, so BOTH markers go.
    expect(names(doc("Intro prose.", "", "-    - gap probe title", "==="))).toEqual([
      "h1:gap probe title",
    ]); // quarto: h1:gap probe title
    // CONTROL — the ordinary one-space nesting is unchanged, at any depth.
    expect(names(doc("- - - marker title", "==="))).toEqual(["h1:marker title"]);
  });

  it("LABELLED TEST-AFTER — the disclosed residuals, each PRE-EXISTING and proven so by a MARKER-FREE control", () => {
    // Every divergence below is one this change made REACHABLE through a marker title rather than
    // one it introduced, and that is a rendered result rather than an argument: for each family,
    // the same document with the bullet marker DELETED from the title errs identically on the
    // PRE-SESSION build (`scratchpad/s201/ctl`, `scratchpad/s201/dia2`). Both families are FILED
    // in `BACKLOG.md`. The decision rule was declared in this session's 1B claim before any
    // result was seen: an error CAUSED here is closed here; one merely made reachable is pinned
    // with a rendered control and filed.

    // ── FAMILY A — a LAZY setext underline is not an underline under a CommonMark dialect.
    // `from: gfm` / `from: commonmark` follow CommonMark, where a setext underline may not be a
    // lazy continuation of a list item; pandoc's own `markdown` reader allows it. Measured over
    // the 15-document `scratchpad/s201/dia` grid: under gfm and commonmark the underline must sit
    // at or past the item's content column (2), and at column 0 quarto renders NO heading.
    // ⚠ CLOSED IN PLACE BY SESSION 202, after re-rendering both documents on their own bytes
    // (`scratchpad/s201/dia/d_gfm_u0` and `dia2/n_gfm_lazy`, byte-identical results to the
    // rows S201 recorded). Both now AGREE with quarto: the underline at column 0 is a lazy
    // continuation under a CommonMark-family reader and no heading forms.
    expect(names(doc("---", "from: gfm", "---", "", "- dia probe title", "==="))).toEqual([]);
    // The marker-free twin — no marker anywhere, so S201's change could not reach it, and it
    // is closed by the same dialect rule rather than by anything about markers.
    expect(
      names(doc("---", "from: gfm", "---", "", "Intro.", "", "- outer one", "",
                "  inner title", "===")),
    ).toEqual([]); // quarto: NO heading — now agreeing
    // ⚠ AND THE ROW THAT SHOWS IT IS THE UNDERLINE'S RULE, NOT THE MARKER'S: at the item's own
    // content column the dialect renders the heading and strips the marker, exactly as
    // `markdown` does — so the two dialects differ only in whether a LAZY underline counts.
    expect(
      names(doc("---", "from: gfm", "---", "", "- dia probe title", "  ===")),
    ).toEqual(["h1:dia probe title"]); // quarto agrees exactly

    // ── FAMILY B — an ORDERED marker at the item's content column IS stripped, and we keep it.
    // A text divergence, PRE-EXISTING and unchanged by this session in either direction, and it
    // completes the picture the `ord_*` rows only half-showed: with the underline at column 0 the
    // ordered marker survives into the heading (14 of 14 rows agree, unchanged here), but with
    // the underline at the item's CONTENT column pandoc parses the list and strips it.
    expect(names(doc("1. dia2 ord title", "==="))).toEqual(["h1:1. dia2 ord title"]); // quarto agrees
    expect(names(doc("1. dia2 ord title", "   ==="))).toEqual(["h1:1. dia2 ord title"]);
    // quarto: h1:dia2 ord title — the ordered marker is stripped there. Identical on the
    // pre-session build; this change touches only bullet markers.

    // ── FAMILY C — a region this model does not track hides its content from quarto entirely,
    // and a marker title inside one is now a reachable spelling of an already-filed defect. The
    // `<style>` RCDATA element, an unclosed `<textarea>` and a `\begin{center}` environment each
    // render no heading; we emit one. Found by the blind `adv/reg` lens.
    expect(names(doc("<style>", "- Reg Kilo Probe", "===", "</style>"))).toEqual([
      "h1:Reg Kilo Probe",
    ]); // quarto: NO heading — the element's content is CSS text
    // ⚠ THE MARKER-FREE CONTROL, rendered: the pre-session build fabricates the identical
    // heading, so the defect is the untracked region and not the strip (`ctl/reg_11_nomk`).
    expect(names(doc("<style>", "Reg Kilo Probe", "===", "</style>"))).toEqual([
      "h1:Reg Kilo Probe",
    ]); // quarto: NO heading — pre-build errs identically
    expect(names(doc("\\begin{center}", "", "- Reg Mike Probe", "===", "", "\\end{center}"))).toEqual(
      ["h1:Reg Mike Probe"],
    ); // quarto: NO heading — control `ctl/reg_13_nomk` errs identically on the pre-build
    expect(names(doc("<textarea>", "", "- Reg Oscar Probe", "==="))).toEqual([
      "h1:Reg Oscar Probe",
    ]); // quarto: NO heading — control `ctl/reg_14_nomk` errs identically on the pre-build

    // ── FAMILY D — a fenced div's CLOSER does not pop a container opened INSIDE it, so the stale
    // column survives the div and legitimises an underline below it. Found by the blind `adv/cont`
    // lens (`cont_11`). Quarto closes the list with the div; we keep column 2 alive.
    expect(
      names(doc("::: {.aside}", "- alpha item", ":::", "", "  - Cont Kilo Probe", "  ===")),
    ).toEqual(["h1:Cont Kilo Probe"]); // quarto: NO heading
    // ⚠ THE MARKER-FREE CONTROL, rendered (`ctl2/cont_11_nomk`): the pre-session build fabricates
    // the identical heading, so the defect is the stale column and not the strip.
    expect(
      names(doc("::: {.aside}", "- alpha item", ":::", "", "  Cont Kilo Probe", "  ===")),
    ).toEqual(["h1:Cont Kilo Probe"]); // quarto: NO heading — pre-build errs identically
  });
});

describe("a setext underline's column is DIALECT-DEPENDENT (Session 202)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("under a CommonMark dialect the underline may not be a LAZY continuation", () => {
    // `scratchpad/s202/gnd` — `g_gfm_b2_u00`, re-rendered this session: under `from: gfm` a
    // setext underline at column 0 inside an open list item is a LAZY CONTINUATION line, and
    // CommonMark forbids one there, so quarto renders NO heading. We emit one.
    expect(
      names(doc("---", "from: gfm", "---", "", "- outer one", "", "  probe title", "===")),
    ).toEqual([]);
  });

  it("under a CommonMark dialect the underline keeps CommonMark's own 0-3 tolerance", () => {
    // `scratchpad/s202/gnd` — `g_gfm_b2_u03`. The same dialect that REFUSES the underline
    // below the item's content column ACCEPTS it up to three columns past it, which is
    // CommonMark's own leading-space slack measured from the container rather than from
    // source column 0. The two halves have opposite polarity and are scored separately.
    expect(
      names(doc("---", "from: gfm", "---", "", "- outer one", "", "  probe title", "   ===")),
    ).toEqual(["h1:probe title"]);
  });

  it("the rule keys on the `from:` VALUE, and the family is wider than `gfm`", () => {
    // `scratchpad/s202/dax` — 51 rendered documents, one per `from:` spelling, each read at
    // the three decisive columns. `commonmark`, `commonmark_x`, `commonmark_x+footnotes`,
    // `gfm`, `gfm+footnotes` and `gfm-raw_html` all answer identically to `gfm`, as do the
    // quoted, trailing-space and trailing-comment spellings of the same values.
    expect(
      names(doc("---", "from: commonmark", "---", "", "- outer one", "", "  probe title",
                "===")),
    ).toEqual([]);
  });

  it("the key must be a TOP-LEVEL one — a `from:` in YAML prose is not a reader", () => {
    // Found by a BLIND adversarial lens that had seen none of this session's corpora, and it
    // is the one direction this change must never fail in: `abstract: |` opens a YAML BLOCK
    // SCALAR whose content is ordinary prose, and a sentence that happens to wrap across
    // `from: gfm sources` is not a reader selection. Quarto renders the heading
    // (`scratchpad/s202/adv/dialect/dialect_04`); firing there DELETES it.
    expect(
      names(doc("---", "title: Dialect Four", "abstract: |", "  Figures were taken",
                "  from: gfm sources published last year.", "---", "",
                "-   Dialect Delta Probe", "===")),
    ).toEqual(["h1:Dialect Delta Probe"]);
  });

  it("the underline's OWN line cannot be the container it is measured against", () => {
    // Found by the BLIND `ws` lens (`adv/ws/ws_08`). A lone `-` is BOTH a level-2 underline and
    // a list marker, and the container-maintenance block runs at the top of every iteration —
    // so by the time the setext test reads the stack, the underline has opened a column of its
    // own, and the innermost column is no longer the one containing the title. Quarto renders
    // `h2:Ws Hotel Three`; reading the pushed column DELETES it.
    expect(
      names(doc("---", "from: gfm", "---", "", "Ws Hotel Three", "-")),
    ).toEqual(["h2:Ws Hotel Three"]);
  });

  it("a container CommonMark has no marker for is not the innermost column", () => {
    // Found by the BLIND `nest` lens (`adv/nest/nest_05`). `a. ` is a pandoc fancy-list marker
    // and NOT a CommonMark one, so under `from: gfm` it opens nothing and the innermost column
    // is the footnote's own 4 — where quarto renders `h1:a. Nest Echo Probe`, marker and all.
    // Reading the phantom column 7 that `listItemContentColumn` pushes for it DELETED that
    // heading. ⚠ The phantom column itself is PRE-EXISTING and deliberate (that function is
    // required to fail toward phantoms); what this closes is only this row reading it.
    expect(
      names(doc("---", "from: gfm", "---", "", "See the note[^n1].", "",
                "[^n1]: Note body text", "", "    a. Nest Echo Probe", "    ==================")),
    ).toEqual(["h1:a. Nest Echo Probe"]);
  });

  // ── TEST-AFTER (labelled): regression pins over behaviour the three cycles above already
  // shipped, and the disclosed residuals. Every row is a RENDERED document, not a derivation.
  it("pins the measured grid, the guards and the disclosed residuals", () => {
    // ── THE GUARD THAT MAKES THE `from:` VALUE LOAD-BEARING. Every row here renders a heading
    // at underline column 0 that the CommonMark rule would DELETE, which is why this rule
    // cannot key on the key's presence the way `atxHeadingMatch`'s does (`scratchpad/s202/dax`).
    for (const value of ["markdown", "markdown_strict", "markdown_mmd", "markdown_phpextra",
                         "markdown-blank_before_header", "markdown+emoji"]) {
      expect(
        names(doc("---", `from: ${value}`, "---", "", "- outer one", "", "  probe title", "===")),
      ).toEqual(["h1:probe title"]); // quarto agrees — a real heading the rule must not delete
    }
    // ⚠ `markdown_github` is the row that cannot be guessed: pandoc documents it as a
    // deprecated SYNONYM for `gfm`, and quarto 1.7.33 renders it exactly like `markdown` —
    // verified against the raw HTML (`<h1 id="dax-probe-title">` nested in the `<li>`), not
    // through the extractor. A classifier keyed on "not markdown" would delete this heading.
    expect(
      names(doc("---", "from: markdown_github", "---", "", "- outer one", "", "  probe title",
                "===")),
    ).toEqual(["h1:probe title"]);
    // …and a document with NO front matter at all keeps the default rule.
    expect(names(doc("- outer one", "", "  probe title", "==="))).toEqual(["h1:probe title"]);
    // A `from:` in ORDINARY BODY TEXT must not reach the front-matter test (`comp/body_from`).
    expect(
      names(doc("Intro paragraph.", "", "from: gfm", "", "- outer one", "", "  probe title",
                "   ===")),
    ).toEqual([]); // quarto: no heading — the default reader refuses column 3

    // ── THE CommonMark SET IS THE INNERMOST COLUMN'S TOLERANCE, NOT THE WHOLE STACK.
    // `scratchpad/s202/gnd` `g_gfm_n24_u*`: a 2-deep stack (columns 2 and 4) accepts 4-7 and
    // REFUSES 2, where the default reader accepts 0, 2 and 4. This is the row that separates
    // the shipped rule from the obvious "widen every column by 3" reading.
    const nested = (u: number) =>
      names(doc("---", "from: gfm", "---", "", "- outer one", "  - inner one", "",
                "    probe title", " ".repeat(u) + "==="));
    expect(nested(2)).toEqual([]); // quarto: no heading — column 2 is a lazy continuation
    expect(nested(4)).toEqual(["h1:probe title"]);
    expect(nested(7)).toEqual(["h1:probe title"]);
    expect(nested(8)).toEqual([]); // quarto: no heading — column 8 is indented code
    // ⚠ "Innermost" is measured AFTER the container pop: the same stack with the title at
    // column 2 closes the inner item, and the set becomes that of column 2 (`ax/pop_gfm_*`).
    const popped = (u: number) =>
      names(doc("---", "from: gfm", "---", "", "- alpha one", "  - bravo one", "",
                "  probe title", " ".repeat(u) + "==="));
    expect(popped(2)).toEqual(["h1:probe title"]);
    expect(popped(5)).toEqual(["h1:probe title"]);
    expect(popped(6)).toEqual([]); // quarto: no heading

    // ── THE `-` SPELLING ANSWERS IDENTICALLY — 120 rendered documents (`scratchpad/s202/lvl`),
    // held out of the ground grid because a `-` run at a new column can also be a fresh list
    // item or a thematic break, so that the two levels agreeing is measured rather than assumed.
    expect(
      names(doc("---", "from: gfm", "---", "", "- outer one", "", "  probe title", "---")),
    ).toEqual([]);
    expect(
      names(doc("---", "from: gfm", "---", "", "- outer one", "", "  probe title", "   ---")),
    ).toEqual(["h2:probe title"]);

    // ── A DECLINED RUN DOES NOT VANISH — it falls through to `CLOSES_PARAGRAPH`, which closes
    // the paragraph, so an ATX heading directly below it IS reported. Under a CommonMark reader
    // quarto reports it too, because CommonMark lets an ATX heading interrupt a paragraph
    // (`scratchpad/s202/cp`, 20 CommonMark rows of 20 agreeing).
    expect(
      names(doc("---", "from: gfm", "---", "", "Intro.", "", "- outer one", "", "  probe title",
                "===", "# Below Heading")),
    ).toEqual(["h1:Below Heading"]);

    // ── DISCLOSED RESIDUAL — 6 PHANTOMS THIS CHANGE INTRODUCES, all one family, and the cause
    // is a column that was ALREADY WRONG rather than the rule that now reads it. Under `gfm`
    // and `commonmark` a DEFINITION LIST is not a construct at all, so `:   body` opens no
    // content column and everything four columns in is indented code — but `contentColumns`
    // pushes 4 for it under every dialect. The old set `[0, 4]` was wrong at both of its
    // members; the new set `[4…7]` is wrong at four.
    const defList = (u: number) =>
      names(doc("---", "from: gfm", "---", "", "Term one", "", ":   the definition body", "",
                "    probe title", " ".repeat(u) + "==="));
    expect(defList(4)).toEqual(["h1:probe title"]); // quarto: NO heading — CARRIED from before
    expect(defList(5)).toEqual(["h1:probe title"]); // quarto: NO heading — INTRODUCED here
    expect(defList(7)).toEqual(["h1:probe title"]); // quarto: NO heading — INTRODUCED here
    // ⚠ THE CONTROL THAT PROVES THE COLUMN PRE-EXISTING, reached through a row this session
    // never touches: an ATX heading at the same column, under the same container, renders NO
    // heading in quarto and one here — on the PRE-SESSION build as well (`ctl/defatx_gfm`,
    // `ctl/deftilde_gfm`). So the defect is "which containers exist under which reader", which
    // is the container STACK's question and belongs to three other consumers besides this one.
    expect(
      names(doc("---", "from: gfm", "---", "", "Term one", "", ":   the definition body", "",
                "    # Def Atx Heading")),
    ).toEqual(["h1:Def Atx Heading"]); // quarto: NO heading — identical on the pre-build
    // …and the twin that separates it from "no `:`-shaped opener opens a column": a FOOTNOTE
    // definition's column IS real under gfm, so the same tolerance is correct there and this
    // change RECOVERS two headings (`ax/fn_gfm_u5`, `fn_gfm_u7`).
    expect(
      names(doc("---", "from: gfm", "---", "", "See[^1] for it.", "", "[^1]: the note body", "",
                "    probe title", "     ===")),
    ).toEqual(["h1:probe title"]); // quarto agrees — recovered by this change

    // ── UNCHANGED, and pinned so a future change to the container stack is detectable: a BLOCK
    // QUOTE carries no content column here, so both directions of the already-filed quote item
    // survive under a CommonMark reader too (`comp/quote_gfm`).
    expect(
      names(doc("---", "from: gfm", "---", "", "> Quote intro.", ">", "> quote title", "> ==")),
    ).toEqual([]); // quarto: h1:quote title — CARRIED, the filed block-quote item
  });
});

describe("a setext TITLE may be MULTI-LINE under a CommonMark reader (Session 203)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("under a CommonMark dialect the title is the WHOLE open paragraph, joined", () => {
    // `scratchpad/s203/gnd` — `g_gfm_top_n2`, rendered this session: under `from: gfm` a
    // setext heading's content may span several lines where pandoc's own `markdown` reader
    // admits exactly one, so quarto renders `h1:Gnd Probe Title second wrapped line` and
    // this model reports nothing at all.
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "Gnd Probe Title",
          "second wrapped line",
          "====================",
        ),
      ),
    ).toEqual(["h1:Gnd Probe Title second wrapped line"]);
  });

  it("an INDENTED CODE RUN is not a paragraph, so it is not a title either", () => {
    // `scratchpad/s203/code` — `c_gfm_run2`, rendered this session: quarto renders
    // `<pre><code>` and NO heading. The counter already sits at 2 here for the code-run
    // reason (`insideIndentedCode` suppresses the reset to 1), so admitting the whole open
    // paragraph promotes CODE to a heading — this project's forbidden direction, and one
    // no document in the filed evidence can see.
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "    code alpha",
          "    code bravo",
          "====================",
        ),
      ),
    ).toEqual([]);
  });

  it("a line that INTERRUPTS the paragraph may not be joined into the title", () => {
    // `scratchpad/s203/ilk` — `i_gfm_quote`, rendered this session: under a CommonMark reader a
    // block quote INTERRUPTS an open paragraph, so quarto renders
    // `<p>…</p><blockquote>…</blockquote><p>====</p>` and NO heading at all. Joining across it
    // invents `h1:Ilk Probe Title > interrupting quote`.
    //
    // ⚠ This guard's safety polarity is the INVERSE of `OPENS_FRESH_BLOCK`'s: a kind wrongly
    // treated as an interrupt only DECLINES, which is today's behaviour and a residual, while a
    // kind wrongly treated as a continuation FABRICATES a heading into the outline, the
    // breadcrumbs and the cross-reference index. Deny-by-default, and the two lists must not be
    // unified for exactly that reason (Learning #227's shape, in the opposite direction).
    //
    // ⚠ A BULLET is deliberately NOT the probe here even though it is the most obvious
    // interrupt: `- interrupting item` pushes a container content column, so Session 202's
    // column rule already declines the underline at column 0 and the row cannot go RED. The
    // guard must be driven by a kind that reaches the join.
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "Ilk Probe Title",
          "> interrupting quote",
          "====================",
        ),
      ),
    ).toEqual([]);
  });

  it("a HARD LINE BREAK's trailing backslash is not part of the joined text", () => {
    // `scratchpad/s203/mix` — `m_gfm_hardbs`, rendered this session: a line ending in `\` is a
    // HARD line break, which quarto renders as `<br>` and not as a literal character, so the
    // heading text is `Mix Probe Title second wrapped line`. The pre-session build reported no
    // heading at all here, so this divergence is one THIS change makes reachable — closed here
    // rather than filed (the 1B claim's decision rule).
    //
    // The two-space spelling of the same break needs no rule: each joined line is trimmed
    // before it is joined, so `Mix Probe Title  ` already loses its trailing spaces.
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "Mix Probe Title\\",
          "second wrapped line",
          "====================",
        ),
      ),
    ).toEqual(["h1:Mix Probe Title second wrapped line"]);
  });

  // ⚠ LABELLED TEST-AFTER. Everything below pins behaviour this session MEASURED rather than
  // behaviour it drove: the four cycles above are the RED->GREEN record. Every document here
  // was rendered on ITS OWN BYTES as `scratchpad/s203/pins` (18 documents) before the
  // assertion was written — S202's gotcha 9, after two near-twin pins behaved differently
  // from the grid rows they resembled.
  it("pins the reader keying, the guard's edges and the disclosed residuals", () => {
    // ── FAMILY B — the reader keying is Session 202's allowlist, inherited UNCHANGED.
    // A row this session must not widen: the join is CommonMark-only, and two readers that
    // look like they should get it do not.
    const two = (from: string, ...body: string[]) =>
      names(doc("---", `from: ${from}`, "---", "", ...body, "===================="));
    expect(two("markdown_strict", "Pin Strict Title", "second line")).toEqual([]); // `b_strict`
    expect(two("markdown_github", "Pin Github Title", "second line")).toEqual([]); // `b_github`
    // ⚠ `markdown_github` is pandoc's DEPRECATED SYNONYM for gfm and behaves like `markdown`
    // (Learning #313, measured again here) — a pattern-shaped classifier would join it.
    expect(two("gfm+footnotes", "Pin Ext Title", "second line")) //                  `b_gfm_ext`
      .toEqual(["h1:Pin Ext Title second line"]);
    // A `from:` inside a YAML BLOCK SCALAR is prose, not a reader — Session 202's column-0
    // anchor, still holding with a multi-line title below it (`b_abstract`).
    expect(
      names(
        doc(
          "---",
          'title: "Pin Abstract"',
          "abstract: |",
          "  A survey of documents whose metadata was taken",
          "  from: gfm sources published last year.",
          "---",
          "",
          "Pin Abstract Title",
          "second line",
          "====================",
        ),
      ),
    ).toEqual([]);

    // ── FAMILY C — the guard's measured edges, each a place where the obvious rule is wrong.
    // An ordered item interrupts ONLY at the number 1 (`c_ord1` renders nothing, and the
    // `c_ord2` twin below is quarto's own counter-example — see FAMILY D for why we decline
    // it anyway).
    expect(two("gfm", "Pin Ord One Title", "1. an interrupting item")).toEqual([]);
    // `#x` with no space is NOT an ATX heading under gfm, so it is ordinary title text.
    expect(two("gfm", "Pin Hash Title", "#nospace is not a heading")) //       `c_hash_nospace`
      .toEqual(["h1:Pin Hash Title #nospace is not a heading"]);
    // ⚠ A GFM TABLE DOES NOT INTERRUPT A PARAGRAPH — with its delimiter row and all — which is
    // why `|` is absent from the interrupt list even though `OPENS_FRESH_BLOCK` carries it
    // (`c_table`). Measured, not reasoned: `scratchpad/s203/unc` — `u_gfm_pipe_delim`.
    expect(two("gfm", "Pin Table Title", "| a | b |", "|---|---|")) //                 `c_table`
      .toEqual(["h1:Pin Table Title | a | b | |---|---|"]);
    // At CODE DEPTH nothing interrupts — a bullet four columns in is title text (`c_code_depth`).
    expect(two("gfm", "Pin Depth Title", "    - four spaces is code depth"))
      .toEqual(["h1:Pin Depth Title - four spaces is code depth"]);
    // A fence does interrupt, at any length and either char (`c_fence`).
    expect(two("gfm", "Pin Fence Title", "```")).toEqual([]);

    // ── FAMILY D — the DISCLOSED RESIDUALS, each with the control that proves its provenance.
    // (1) The broad `<` costs a `<span>` the reader would have joined (`d_span`). It is the
    //     deny-by-default rule paying for itself: `<!DOCTYPE`, `<?php` and `<![CDATA[` are all
    //     measured interrupts, and enumerating tags to admit `<span>` puts a FABRICATION one
    //     unlisted spelling away. ⚠ The pre-session build reported nothing here either, so
    //     this residual costs nothing AGAINST THAT BUILD — it is a heading not yet recovered,
    //     not a heading lost.
    expect(two("gfm", "Pin Span Title", "<span>inline</span> tail")).toEqual([]);
    // (2) An ordered marker other than 1, and an EMPTY `1.`, are joined by quarto and declined
    //     here — but NOT by this row's guard. The marker pushes a container content column, so
    //     Session 202's column rule refuses the underline at column 0 before the guard is even
    //     reached. That is the FILED container-stack item, and the CONTROL is that the
    //     pre-session build reports the identical nothing (`c_ord2`, `c_empty_dash_ord`).
    expect(two("gfm", "Pin Ord Title", "2. not a one so may not interrupt")).toEqual([]);
    expect(two("gfm", "Pin Empty Ord Title", "1.")).toEqual([]);
    // (3) `gfm` has no `header_attributes`, so quarto keeps `{#sec-…}` LITERALLY in the text
    //     where we strip it and index the id. ⚠ PROVEN PRE-EXISTING through TWO controls this
    //     session never touches: the SOLO setext title (`d_attr_solo`, one line, identical on
    //     the pre-session build) and the ATX row (`scratchpad/s203/ctl` — `attr_atx`, likewise
    //     identical). Already filed by Session 202; this is a new SHAPE of it, not a new
    //     defect.
    expect(names(doc("---", "from: gfm", "---", "", "Pin Attr Solo {#sec-pin-attr}", "====")))
      .toEqual(["h1:Pin Attr Solo"]); // quarto: `h1:Pin Attr Solo {#sec-pin-attr}`
    expect(two("gfm", "Pin Attr Pair", "second line {#sec-pin-pair}"))
      .toEqual(["h1:Pin Attr Pair second line"]); // quarto keeps the braces — same family
    // (4) A LONE indented line under a CommonMark reader is still reported as a title, and
    //     quarto renders none there (`d_code_run1`). PRE-EXISTING and out of this row's scope:
    //     it is the question of whether indented code can be a title AT ALL, not of how many
    //     lines it may be. The CONTROL is the `markdown` twin (`d_code_run1_md`), which quarto
    //     really does render as `h1:pin code alpha` — so the default reader is right and only
    //     the CommonMark one is wrong.
    expect(names(doc("---", "from: gfm", "---", "", "    pin code alpha", "===="))).toEqual([
      "h1:pin code alpha",
    ]); // quarto: NO heading — pre-build errs identically
    expect(names(doc("---", "from: markdown", "---", "", "    pin code alpha", "===="))).toEqual([
      "h1:pin code alpha",
    ]); // quarto: h1:pin code alpha — the control, and we agree

    // ── FAMILY E — the CONSUMER. A multi-line heading's `line` is the FIRST title line, which
    // is what `buildOutline`'s section spans read (`e_span`, and the outline VIEW was checked
    // rather than only the heading list).
    const outline = buildOutline(
      doc(
        "---",
        "from: gfm",
        "---",
        "",
        "Pin Outline Alpha",
        "second line of alpha",
        "====================",
        "",
        "Body of alpha.",
      ),
    );
    expect(outline).toEqual([
      {
        kind: "heading",
        name: "Pin Outline Alpha second line of alpha",
        level: 1,
        // 4 is the FIRST title line (`Pin Outline Alpha`), NOT the underline and not the
        // second title line — that is what makes the section span start where the heading's
        // text starts, uniformly with an ATX heading. 9 is the document's trailing line.
        startLine: 4,
        endLine: 9,
        selectionLine: 4,
        children: [],
      },
    ]);
  });

  it("a run OPENED by a block construct is not a paragraph, so it may not be joined", () => {
    // `scratchpad/s203/adv/code` — `code_06`, from a BLIND lens, rendered this session: an
    // UNCLOSED fence has no closer, so this scanner declines to open a region for it (Session
    // 179) and the fence line becomes ordinary body — which made it the FIRST line of the run
    // my join then stitched together. Quarto renders ONE heading in that document; the
    // pre-session build reported two and this change reported three.
    //
    // ⚠ The guard walks lines 2..n, so the run's FIRST line was never tested. It cannot simply
    // be tested the same way: a BULLET or ORDERED marker on the first line opens a list item
    // whose content IS a paragraph, and quarto joins those (measured, `scratchpad/s203/first`
    // — `f_gfm_bullet` and `f_gfm_ord1` both render the joined text with the marker stripped).
    // What may not open a joinable run is a construct whose content is not a paragraph at all:
    // a fence, an HTML block, a block quote — and the indented code line already handled above.
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "```text",
          "Cod Foxtrot inside unclosed fence",
          "Cod Foxtrot fake title never closed",
          "===",
        ),
      ),
    ).toEqual([]);
  });

  it("a PANDOC FANCY LIST interrupts too, and only the paren-wrapped ONE does", () => {
    // `scratchpad/s203/adv/interrupt` — `interrupt_11`, from a BLIND lens: under
    // `commonmark_x` a `(1)` item is a list and INTERRUPTS the paragraph, so quarto renders no
    // heading and the join invented one. The 24-document `scratchpad/s203/ext` grid then
    // separated it from its neighbours across three readers, and the answer is narrow:
    //
    //   `(1) x`  interrupts under commonmark_x ONLY — gfm and commonmark join it as text
    //   `(a) x`  `a. x`  `i. x`  `#. x`   join under ALL THREE readers
    //
    // ⚠ So the entry is the paren-wrapped ONE and nothing else — the same "only the number 1"
    // rule the bare `1.` spelling follows, which is CommonMark's, not an accident of pandoc's.
    // The measured COST is a residual in the safe direction: under `gfm` and `commonmark` the
    // same bytes render `h1:Ext Probe Title (1) an ordered item wrapped in parens third line`
    // and this model now declines them (`x_gfm_paren1`, `x_commonmark_paren1`, both rendered).
    // Deny-by-default: one fabrication removed under one reader costs one residual under two.
    expect(
      names(
        doc(
          "---",
          "from: commonmark_x",
          "---",
          "",
          "Nijuuichi Intr Uniform",
          "(1) an ordered item wrapped in parens",
          "Nijuuni Intr Victor",
          "---",
        ),
      ),
    ).toEqual([]);
  });

  it("a FENCED DIV with an attribute interrupts, and a bare `:::` does not", () => {
    // `scratchpad/s203/adv/interrupt` — `interrupt_09`, from the same BLIND lens: under
    // `commonmark_x` a `::: {.plainbox}` opener is a real fenced div and ENDS the paragraph, so
    // quarto's heading is only the line BELOW it. We stitched the div's opener into the title.
    //
    // ⚠ The `scratchpad/s203/ext` grid separates the two spellings, and the split is not the
    // one a reader of the source would guess: `::: {.plainbox}` interrupts under commonmark_x
    // and is ordinary text under gfm and commonmark (`x_cmx_div` vs `x_gfm_div`,
    // `x_commonmark_div`), while a BARE `:::` is ordinary text under ALL THREE, including
    // commonmark_x (`x_cmx_div_bare` renders `h1:Ext Probe Title ::: third line`). Hence the
    // trailing `\S`: three or more colons FOLLOWED BY CONTENT.
    expect(
      names(
        doc(
          "---",
          "from: commonmark_x",
          "---",
          "",
          "Juunana Intr Quebec",
          "::: {.plainbox}",
          "Juuhachi Intr Romeo",
          "---",
          ":::",
        ),
      ),
    ).toEqual([]); // quarto: h1:Juuhachi Intr Romeo — the filed div-container item owns that half
  });

  it("a trailing backslash inside a CODE SPAN is content, not a hard line break", () => {
    // `scratchpad/s203/adv/text` — `text_06`, from a BLIND lens, and confirmed across all three
    // CommonMark readers by `scratchpad/s203/ext` (`x_gfm_codespan`, `x_commonmark_codespan`,
    // `x_cmx_codespan` — every one keeps the backslash). A code span may straddle the line
    // break now that a title can, and inside one a `\` is ordinary content.
    //
    // ⚠ The guard is a HEURISTIC and is labelled one: the strip is skipped when the line holds
    // an ODD number of backticks, i.e. it opened a span it did not close. That is exactly right
    // for the measured shape and knowingly approximate for a span opened with a doubled `` `` ``
    // delimiter. Its failure direction is to KEEP a backslash, which is a text divergence in a
    // rare shape rather than a heading gained or lost.
    expect(
      names(
        doc(
          "---",
          "from: commonmark_x",
          "---",
          "",
          "Txt06a code `alpha\\",
          "beta  gamma` tail",
          "===",
        ),
      ),
      // ⚠ TWO spaces between `beta` and `gamma`, because this model reports the SOURCE
      // text and the source has two. Quarto's rendered HTML collapses them, which is the
      // pre-existing source-vs-rendered gap (Learning #310) and not this row's question --
      // the scorer normalizes whitespace on BOTH sides and prints the verdicts it changed.
    ).toEqual(["h1:Txt06a code `alpha\\ beta  gamma` tail"]);
  });

  it("the run BELOW an HTML block opener is inside the block, not a paragraph under it", () => {
    // `scratchpad/s203/first` — `f_gfm_html`, my own completeness grid: under a CommonMark
    // reader an HTML block runs to the next BLANK line, so `<div>` swallows both title lines
    // and the underline, and quarto renders NO heading. This model treats an HTML-block opener
    // as making the line below it a FRESH paragraph — measured and correct for pandoc's own
    // reader (Session 187: `prose` / `<div>` / `Title` / `===` really does render `<h1>`) and
    // wrong for this one, which is the same two-readers-two-rules shape as the column rule.
    //
    // ⚠ The ROOT CAUSE is PRE-EXISTING and is proven through the ATX row, a consumer this
    // session never touches: `scratchpad/s203/ctl2` — `html_atx_gfm` is `<div>` / `# Ctl Html
    // Heading`, where BOTH builds report `h1:Ctl Html Heading` and quarto renders none. What
    // is closed here is only the NEW fabrication the join adds on top of it; the ATX half is
    // filed, not fixed (Learning #315).
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "<div>",
          "First Html Second",
          "third line",
          "====================",
        ),
      ),
    ).toEqual([]);
  });

  it("a DEFINITION-BODY marker does not open a joinable paragraph in any reader", () => {
    // `scratchpad/s203/ctl2` — `defcol_setext_cmx`, and `scratchpad/s203/first` — `f_gfm_colon`.
    // A `:   body` line pushes a container content column in this model, and that column is the
    // reason the underline four columns in is accepted at all. Quarto renders NO heading for
    // either document, under gfm, commonmark OR commonmark_x.
    //
    // ⚠ THE ROOT CAUSE IS THE COLUMN, NOT THE JOIN, AND IT IS PRE-EXISTING IN EVERY READER —
    // proven through the ATX row, which this session never touches: `ctl2/defcol_atx_gfm`,
    // `_cmx` and `_md` are all `:   Ctl Def One` / `    # Ctl Def Heading`, and BOTH builds
    // report `h1:Ctl Def Heading` where quarto renders none, in all three. That is the filed
    // container-stack item and Session 202 measured that narrowing the stack to hide it is
    // WORSE (it trades phantoms under two readers for a deletion under a third, Learning #315).
    // So the stack is left alone and only the NEW fabrication is closed, here, where it is
    // cheap: a definition body is not a run this row may join.
    expect(
      names(
        doc(
          "---",
          "from: commonmark_x",
          "---",
          "",
          ":   Ctl Def Two",
          "    second def line",
          "    ====================",
        ),
      ),
    ).toEqual([]);
  });
});

describe("a raw HTML BLOCK swallows the headings inside it under a CommonMark reader (Session 204)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("a TYPE 6 opener swallows every heading until the next BLANK line", () => {
    // `scratchpad/s204/gnd` — `g_gfm_div_d1_atx`, rendered this session: under `from: gfm`
    // an HTML block opened by a known block-tag name runs to the next BLANK line, so quarto
    // renders NO heading for `Gnd Inside` and this model reports one. The `Gnd Below` probe
    // is what proves the block ENDS — the change must delete the first and keep the second.
    expect(
      names(
        doc("---", "from: gfm", "---", "", "<div>", "# Gnd Inside", "", "# Gnd Below"),
      ),
    ).toEqual(["h1:Gnd Below"]);
  });
  it("a TYPE 7 opener — any complete tag — swallows where NO paragraph is open", () => {
    // `scratchpad/s204/gnd` — `g_gfm_span_d1_atx`, rendered this session: `<span>` is NOT a
    // type-6 name and is not in pandoc's `blockTags` either, but CommonMark type 7 accepts ANY
    // complete tag on a line by itself. Measured over all 65 names in `scratchpad/s204/name`:
    // in the fresh context EVERY one swallows, including `foo` and `mytag`.
    expect(
      names(
        doc("---", "from: gfm", "---", "", "<span>", "# Gnd Inside", "", "# Gnd Below"),
      ),
    ).toEqual(["h1:Gnd Below"]);
  });
  it("a TYPE 7 opener may NOT interrupt an open paragraph, so the heading below it is REAL", () => {
    // `scratchpad/s204/intr` — `n_gfm_span_para_i0`, rendered this session: with a paragraph
    // open above it, `<span>` is ordinary inline content and the ATX heading below interrupts
    // that paragraph normally, so quarto renders BOTH headings. This model already agreed here
    // before Session 204 — so this is a test the change had to avoid BREAKING, not one it makes
    // pass. ⚠ RED established by MUTATION rather than by writing it first: deleting the
    // `!paragraphOpen` clause from the type-7 test in `computeRegions` turns this into
    // `expected [ 'h1:Intr Below' ] to deeply equal [ 'h1:Intr Inside', 'h1:Intr Below' ]` —
    // a real heading DELETED, which is this row's forbidden direction.
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "open paragraph line",
          "<span>",
          "# Intr Inside",
          "",
          "# Intr Below",
        ),
      ),
    ).toEqual(["h1:Intr Inside", "h1:Intr Below"]);
  });
  it("a TYPE 1 opener runs past BLANK lines — an unclosed `<pre>` swallows to end of document", () => {
    // `scratchpad/s204/gnd` — `g_gfm_pre_blank_atx`, rendered this session: quarto renders NO
    // heading at all, not even the one two blank lines below the opener. A `<pre>` block ends
    // at its OWN closer and a blank line does not touch it, so an unclosed one really does run
    // to the end of the document. This is the single row that refutes "swallow to the blank
    // line" as the whole rule.
    expect(
      names(
        doc("---", "from: gfm", "---", "", "<pre>", "# Gnd Inside", "", "# Gnd Below"),
      ),
    ).toEqual([]);
  });
  it("the SETEXT site is suppressed too — an underline inside the block claims nothing", () => {
    // `scratchpad/s204/gnd` — `g_gfm_div_d1_setext`, rendered this session: quarto renders only
    // `Gnd Below`. Guarding the ATX site alone leaves this half open, and it is not the same
    // half Session 203 closed: `prevOpenedHtmlBlock` stops a MULTI-LINE title being joined
    // across the opener, where this is a single-line title wholly INSIDE the block.
    expect(
      names(
        doc(
          "---",
          "from: gfm",
          "---",
          "",
          "<div>",
          "Gnd Inside",
          "====================",
          "",
          "# Gnd Below",
        ),
      ),
    ).toEqual(["h1:Gnd Below"]);
  });
  // ⚠ LABELLED TEST-AFTER. The two assertions below pin the type-1 END CONDITION, which GREEN 4
  // implemented but RED 4 (an UNCLOSED `<pre>`) did not force. Both bytes are rendered on their
  // own bytes as `scratchpad/s204/pins`, and each clause is proven load-bearing by mutation:
  // deleting the `COMMONMARK_HTML_TYPE1_CLOSE` clear turns the first into
  // `expected [] to deeply equal [ 'h1:End Inside', 'h1:End Below' ]` -- two real headings lost.
  it("the type-1 CLOSER ends the block on its own line, so the heading below it is REAL", () => {
    // `scratchpad/s204/end` — `e_gfm_pre_after`, rendered this session: there is no blank line
    // anywhere in this document, and quarto renders BOTH headings. A blank-line-only end
    // condition would delete them, which is why type 1 is not folded into type 6.
    expect(
      names(
        doc(
          "---", "from: gfm", "---", "",
          "<pre>", "raw code line", "</pre>", "# End Inside", "", "# End Below",
        ),
      ),
    ).toEqual(["h1:End Inside", "h1:End Below"]);
  });

  it("`</pre >` with a space is NOT a closer — the block runs to end of document", () => {
    // `scratchpad/s204/adv/bnd` — `bnd_07`, a BLIND lens document: quarto renders only the
    // heading ABOVE the block. The `>` must follow the tag name immediately, so the closer regex
    // is exact in its spelling even though it is unanchored in its position. `</PRE>` in upper
    // case DOES close (`bnd_08`), which is what the `i` flag carries.
    expect(
      names(
        doc(
          "---", "from: gfm", "---", "",
          "# Bnd Golf Pre Spaced Closer", "", "<pre>", "code here", "</pre >", "",
          "## Bnd Golf After Fake Closer",
        ),
      ),
    ).toEqual(["h1:Bnd Golf Pre Spaced Closer"]);
  });
});

describe("`blank_before_header` survives an explicitly declared reader that has it (Session 205)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);

  it("`from: markdown` keeps the paragraph bail, where any `from:` key used to suspend it", () => {
    // `scratchpad/s205/gnd` — `g_md_prose`, rendered this session. The bail is `dialectOverride`
    // at model.ts:2703, and it keys on the PRESENCE of a `from:` key: Session 180 took that
    // trade knowingly and wrote the cost into `FRONTMATTER_FROM_KEY`'s own docstring. Quarto
    // renders only `Gnd Below` here, and the identical document with NO front matter
    // (`g_nofm_prose`) is already reported correctly — which is what shows the rule is
    // implemented and merely switched off, not missing.
    expect(
      names(
        doc(
          "---", "title: t", "from: markdown", "---", "",
          "Prose opens the paragraph.", "# Gnd Inside", "", "# Gnd Below",
        ),
      ),
    ).toEqual(["h1:Gnd Below"]);
  });
  /**
   * RED->GREEN: the SAME reader value, differently spelled. Every case below rendered this
   * session in `scratchpad/s205/spl` and quarto suppresses the pressed heading in all of them,
   * so each is `from: markdown` and must reach the bail.
   *
   * ⚠ `from:markdown` with NO space is deliberately ABSENT: quarto REJECTS it (exit 1,
   * `s_nospace`), so it has no heading truth to agree with — the same reasoning `reader:` and
   * upper-case `GFM` already get elsewhere in this file.
   */
  it.each([
    ['a double-quoted value', 'from: "markdown"'],
    ["a single-quoted value", "from: 'markdown'"],
    ["a wide gap after the colon", "from:     markdown"],
    ["trailing whitespace", "from: markdown   "],
    ["a trailing YAML comment", "from: markdown  # the default reader"],
    ["a TAB after the colon", "from:\tmarkdown"],
  ])("%s still keeps the paragraph bail", (_what, fromLine) => {
    expect(
      names(
        doc(
          "---", "title: t", fromLine, "---", "",
          "Prose opens the paragraph.", "# Spl Inside", "", "# Spl Below",
        ),
      ),
    ).toEqual(["h1:Spl Below"]);
  });
  /**
   * ⚠ THE GUARD, WRITTEN BEFORE THE WIDENING IT GUARDS (Session 204's gotcha 5). Every value
   * below rendered this session and quarto KEEPS the pressed heading in all of them, so firing
   * on any one of them DELETES a real heading — this rule's forbidden direction.
   *
   * `markdown_strict` is the trap: it is a `markdown`-prefixed name whose reader does NOT have
   * `blank_before_header` (`scratchpad/s205/gnd` `g_mdstrict_prose`, `spl` `s_strict`), so a
   * prefix match on `markdown` — the obvious way to widen for `markdown+emoji` — deletes it.
   * `markdown_mmd`, `markdown_phpextra` and `markdown_github` are three more of the same shape.
   */
  it.each([
    ["markdown_strict", "from: markdown_strict"],
    ["a QUOTED markdown_strict", 'from: "markdown_strict"'],
    ["markdown_mmd", "from: markdown_mmd"],
    ["markdown_phpextra", "from: markdown_phpextra"],
    ["markdown_github", "from: markdown_github"],
    ["markdown-blank_before_header", "from: markdown-blank_before_header"],
    ["the extension turned off LAST", "from: markdown+emoji-blank_before_header"],
    ["the extension turned off FIRST", "from: markdown-blank_before_header+emoji"],
    ["gfm", "from: gfm"],
    ["commonmark_x", "from: commonmark_x"],
  ])("%s does NOT get the bail — quarto renders that heading", (_what, fromLine) => {
    expect(
      names(
        doc(
          "---", "title: t", fromLine, "---", "",
          "Prose opens the paragraph.", "# Spl Inside", "", "# Spl Below",
        ),
      ),
    ).toEqual(["h1:Spl Inside", "h1:Spl Below"]);
  });
  /**
   * RED->GREEN: an EXTENSION LIST on the `markdown` base. `blank_before_header` is a property
   * of the base reader, so `+emoji` or `-raw_html` leaves it on — measured this session over
   * `scratchpad/s205/gnd` (`g_mdemoji_*`, `g_mdnoraw_*`) and `spl` (`s_twoext`, `s_plusminus`),
   * where quarto suppresses the pressed heading in every one.
   *
   * ⚠ The list may contain the extension that turns the rule OFF, at any position, and the guard
   * above already pins both spellings of that — they must stay green through this widening.
   */
  it.each([
    ["one added extension", "from: markdown+emoji"],
    ["one removed extension", "from: markdown-raw_html"],
    ["two added extensions", "from: markdown+emoji+footnotes"],
    ["a removal then an addition", "from: markdown-raw_html+emoji"],
    ["a QUOTED extension list", 'from: "markdown+emoji"'],
  ])("%s still keeps the paragraph bail", (_what, fromLine) => {
    expect(
      names(
        doc(
          "---", "title: t", fromLine, "---", "",
          "Prose opens the paragraph.", "# Spl Inside", "", "# Spl Below",
        ),
      ),
    ).toEqual(["h1:Spl Below"]);
  });
  /**
   * RED->GREEN: `+blank_before_header` bolted onto a base measured WITHOUT it. This is the
   * half that shows the rule belongs to the EXTENSION and not to the reader's name: every base
   * below renders the pressed heading on its own (the guard block pins `markdown_strict`,
   * `markdown_mmd`, `markdown_phpextra` and `markdown_github` doing exactly that), and adding
   * the extension suppresses it — `scratchpad/s205/gnd` `g_strictbbh_*` and `spl` `s_mmdon`,
   * `s_phpon`, `s_ghon`, all rendered this session.
   *
   * ⚠ `gfm+blank_before_header` and `commonmark+blank_before_header` are ABSENT because quarto
   * REJECTS them (exit 1 — all 12 such documents in `gnd`), so the extension's reach outside the
   * pandoc-markdown family has no truth to agree with and must not be guessed at.
   */
  it.each([
    ["markdown_strict", "from: markdown_strict+blank_before_header"],
    ["markdown_mmd", "from: markdown_mmd+blank_before_header"],
    ["markdown_phpextra", "from: markdown_phpextra+blank_before_header"],
    ["markdown_github", "from: markdown_github+blank_before_header"],
  ])("%s+blank_before_header gets the bail its base does not have", (_what, fromLine) => {
    expect(
      names(
        doc(
          "---", "title: t", fromLine, "---", "",
          "Prose opens the paragraph.", "# Spl Inside", "", "# Spl Below",
        ),
      ),
    ).toEqual(["h1:Spl Below"]);
  });
  it("the OUTLINE loses the phantom section under `from: markdown` and keeps the real one", () => {
    // TEST-AFTER (labelled) — the user-visible surface. `buildOutline` is pure, so this half
    // needs no Extension Development Host; the provider path is covered by the integration test.
    // Measured (`scratchpad/s205/gnd` `g_md_prose` and its `nofm` twin): quarto renders ONE body
    // heading here. Before this session the outline, breadcrumbs, sticky scroll and workspace
    // symbols all carried `Phantom` too as a sibling section, so every node below it was filed
    // under a heading that does not exist in the rendered document — and the IDENTICAL document
    // without the `from:` line was already correct, which is the whole shape of the defect.
    const body = ["Prose that opens a paragraph.", "## Phantom", "more prose", "", "## Genuine"];
    const withFrom = doc("---", "title: t", "from: markdown", "---", "", "# Real", "", ...body);
    const withoutFrom = doc("---", "title: t", "---", "", "# Real", "", ...body);
    expect(buildOutline(withFrom).map((s) => s.name)).toEqual(["Real"]);
    expect(buildOutline(withFrom)[0].children.map((s) => s.name)).toEqual(["Genuine"]);
    // the control that makes the assertion above mean something
    expect(buildOutline(withoutFrom).map((s) => s.name)).toEqual(
      buildOutline(withFrom).map((s) => s.name),
    );
  });
  /**
   * RED->GREEN, and this one is a REGRESSION THIS SESSION CAUSED — found by re-measuring the
   * filed item's OWN named documents against the new build, which is the only reason it was seen.
   *
   * `scratchpad/s204/end` `e_md_pi_after`, rendered by Session 204 and re-scored here: quarto
   * renders BOTH headings, because `<?php …` / `?>` is a raw HTML block that ENDS at its closer,
   * so the heading below it is fresh. This model never recognised `?>` — `HTML_BLOCK_OR_INLINE_OPEN`
   * carries a row commented "a processing instruction, opener `<?…` or closer `</?…`", and `</?`
   * is not how a processing instruction closes; the real closer is `?>`, which begins with no `<`
   * and so matched nothing. That gap was INVISIBLE while a `from:` key switched the paragraph bail
   * off: the `?>` line left a paragraph open, the heading below was suppressed by nothing, and the
   * right answer came out for the wrong reason. Restoring the bail exposed it.
   *
   * ⚠ Every OTHER closer in that 24-row corpus was already right and must stay right — `</pre>`,
   * `</script>`, `</style>`, `</textarea>`, `-->`, `]]>` and `<!DOCTYPE …>`. The CDATA row is the
   * sharp control: `<![CDATA[` / `raw data` / `]]>` / heading renders only the heading BELOW, so
   * `]]>` does NOT end a block for this purpose and must not be added alongside `?>`.
   */
  it("a `?>` line ENDS a processing instruction, so the heading below it is fresh", () => {
    expect(
      names(
        doc(
          "---", "from: markdown", "---", "",
          "<?php echo 1;", "?>", "# End Inside", "", "# End Below",
        ),
      ),
    ).toEqual(["h1:End Inside", "h1:End Below"]);
  });

  it("…and `]]>` does NOT — the CDATA control that keeps the row from being widened", () => {
    // `scratchpad/s204/end` `e_md_cdata_after`: quarto renders ONLY `End Below`.
    expect(
      names(
        doc(
          "---", "from: markdown", "---", "",
          "<![CDATA[", "raw data", "]]>", "# End Inside", "", "# End Below",
        ),
      ),
    ).toEqual(["h1:End Below"]);
  });
});

describe("a front-matter `from:` is resolved as YAML, not as one line shape (Session 206)", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const names = (text: string) => findHeadings(text).map((h) => `h${h.level}:${h.text}`);
  /** The `gnd` shape: a BASELINE heading, prose, and a heading PRESSED against it. */
  const pressed = (...fm: string[]) =>
    doc("---", ...fm, "---", "", "# Baseline", "", "Prose opens a paragraph.", "# Pressed");

  it("a QUOTED `from:` key selects the reader, where the plain-key regex cannot see it", () => {
    // MEASURED, `scratchpad/s206/gnd` `g_qkeyd_gfm` / `g_qkeys_gfm`: quarto renders BOTH
    // headings, because `"from": gfm` really does select gfm and CommonMark has no
    // `blank_before_header`. `FRONTMATTER_FROM_KEY` is `/^[ \t]*from[ \t]*:/`, which can never
    // match a line beginning with a quote, so the bail suppressed a heading quarto renders —
    // heading-DELETING, the direction this project does not permit.
    expect(names(pressed('"from": gfm'))).toEqual(["h1:Baseline", "h1:Pressed"]);
    expect(names(pressed("'from': gfm"))).toEqual(["h1:Baseline", "h1:Pressed"]);
  });

  it("a FLOW-MAPPING front matter selects the reader too", () => {
    // MEASURED, `scratchpad/s206/gnd` `g_flow_gfm`: quarto renders BOTH headings for a front
    // matter written as a single YAML flow mapping. The key regex is anchored to the start of
    // the line past whitespace, so a `from:` sitting INSIDE `{…}` was invisible and the bail
    // deleted the pressed heading. ⚠ The `markdown` twin `g_flow_markdown` renders only the
    // baseline, which is what proves quarto is reading the flow mapping rather than ignoring
    // the whole front matter.
    expect(names(pressed('{from: gfm, title: "T"}'))).toEqual(["h1:Baseline", "h1:Pressed"]);
  });

  // ── THE GUARD BLOCK, WRITTEN BEFORE THE VALUE RESOLVER IT GUARDS ──
  // Session 204's gotcha 5, inherited by Session 205 and again here: the guard's test comes
  // FIRST. Every case below PASSES on the pre-resolver build, and each one goes RED the moment
  // a resolver reads a `from:` at any indent instead of at the front matter's own TOP LEVEL.
  //
  // ⚠ The observable is the SETEXT COLUMN row (`commonmarkDialect`), not the paragraph bail,
  // and that is deliberate: on this row resolving a reader wrongly DELETES a heading, where on
  // the bail it only costs a phantom. The guard has to be written where the failure hurts.
  /** The `cmk` shape: a title at a list item's content column, underlined at COLUMN 0. */
  const column0Setext = (...fm: string[]) =>
    doc("---", ...fm, "---", "", "Intro paragraph.", "", "- outer one", "", "  probe title", "===", "", "Tail.");

  it("an `abstract:` block scalar whose PROSE contains `from: gfm` selects nothing", () => {
    // MEASURED, `scratchpad/s206/cmk` `c_abs_only`: quarto renders `h1:probe title`, so the
    // document is NOT commonmark — the sentence merely wraps across the words `from: gfm`.
    // This is the hazard that put the column-0 anchor on `FRONTMATTER_COMMONMARK_FROM` in the
    // first place (Session 202's `dialect_04`), and reading it as a reader DELETES this heading.
    expect(
      names(
        column0Setext(
          'title: "T"',
          "abstract: |",
          "  A long abstract that wraps across",
          "  from: gfm sources published last year.",
        ),
      ),
    ).toEqual(["h1:probe title"]);
  });

  it("…and a REAL top-level `from: gfm` still wins over that prose", () => {
    // MEASURED, `scratchpad/s206/cmk` `c_abs_coll`: quarto renders NO heading. The block
    // scalar's prose says `from: markdown` and the real top-level key says `gfm`; a resolver
    // that takes the FIRST `from:` it sees at any indent reads `markdown` here and reports a
    // heading quarto does not render. The pair is the measurement — neither case alone.
    expect(
      names(
        column0Setext(
          'title: "T"',
          "abstract: |",
          "  A long abstract that wraps across",
          "  from: markdown sources published last year.",
          "from: gfm",
        ),
      ),
    ).toEqual([]);
  });

  it("a nested `params:` / `from:` whose value is a DATE selects nothing", () => {
    // MEASURED, `scratchpad/s206/cmk` `c_params`: quarto renders `h1:probe title`.
    // `from: 2024-01-01` is not a reader, and it is not at the front matter's top level either.
    expect(names(column0Setext('title: "T"', "params:", "  from: 2024-01-01"))).toEqual([
      "h1:probe title",
    ]);
  });

  it("a key that merely STARTS with `from` selects nothing", () => {
    // MEASURED, `scratchpad/s206/cmk` `c_fromage`: quarto renders `h1:probe title`.
    expect(names(column0Setext('title: "T"', "fromage: gfm"))).toEqual(["h1:probe title"]);
  });

  it("the VALUE may sit on the NEXT line as a plain scalar", () => {
    // MEASURED, `scratchpad/s206/gnd` `g_nextline_markdown`: quarto renders ONLY the baseline,
    // because `from:` / `  markdown` really is `from: markdown` and pandoc's markdown HAS
    // `blank_before_header`. Today the KEY fires and the VALUE never resolves, so the bail is
    // switched off and the pressed heading is reported — a phantom.
    expect(names(pressed('title: "T"', "from:", "  markdown"))).toEqual(["h1:Baseline"]);
  });

  it.each([
    ["a FOLDED block scalar, chomped", ">-"],
    ["a FOLDED block scalar", ">"],
    ["a LITERAL block scalar, chomped", "|-"],
  ])("the VALUE may sit in %s", (_what, indicator) => {
    // MEASURED, `scratchpad/s206/gnd` `g_foldm_markdown` / `g_fold_markdown` /
    // `g_litm_markdown`: quarto renders ONLY the baseline for each. A block scalar carrying one
    // short line folds to exactly that line, so `from: >-` / `  markdown` is `from: markdown`.
    // ⚠ The `gfm` twins render BOTH headings, which is what proves the indicator is not simply
    // making quarto ignore the key.
    expect(names(pressed('title: "T"', `from: ${indicator}`, "  markdown"))).toEqual([
      "h1:Baseline",
    ]);
  });

  it.each([[1, " "], [2, "  "]])(
    "a whole mapping indented %i space(s) is still the front matter's TOP level",
    (_n, pad) => {
      // MEASURED, `scratchpad/s206/gnd` `g_indent1_markdown` / `g_indent2_markdown`: quarto
      // renders ONLY the baseline. A uniformly indented mapping is ordinary YAML and its keys
      // are top-level keys; the column-0 anchor alone cannot see them.
      //
      // ⚠ This is NOT "accept any indent", and the guard block above is what says so. A block
      // scalar's content is ALSO indented, and reading it as a key deletes a real heading. The
      // distinguishing fact is document-wide rather than per-line: here EVERY content line is
      // indented, where a block scalar always has its own key sitting at a shallower indent.
      expect(names(pressed(`${pad}title: "T"`, `${pad}from: markdown`))).toEqual(["h1:Baseline"]);
    },
  );

  it("the VALUE may be an ALIAS of an anchor declared on another top-level key", () => {
    // MEASURED, `scratchpad/s206/gnd` `g_alias_markdown`: quarto renders ONLY the baseline, so
    // `preferred-reader: &rdr markdown` / `from: *rdr` really is `from: markdown`. Its `gfm`
    // twin `g_alias_gfm` renders both, which is what proves the alias is being RESOLVED rather
    // than the key ignored.
    expect(
      names(pressed('title: "T"', "preferred-reader: &rdr markdown", "from: *rdr")),
    ).toEqual(["h1:Baseline"]);
  });

  it("…and an alias with NO matching anchor resolves nothing", () => {
    // The guard for the case above, and it passes in BOTH directions: an unresolvable alias
    // must fall through to today's behaviour (the pressed heading is reported) rather than
    // resolve to some default. There is no reader named `*nope`, and inventing one here would
    // feed a flag whose wrong direction deletes a heading.
    //
    // ⚠ **This pin has NO rendered truth and is the one case in this block that cannot have
    // one.** An alias with no anchor is invalid YAML, so quarto REFUSES the document
    // (`scratchpad/s206/pins` `p_noanchor`, exit 1). What is asserted is therefore this
    // scanner's own robustness — that it declines rather than resolves — and not an agreement
    // with a render.
    expect(names(pressed('title: "T"', "from: *nope"))).toEqual(["h1:Baseline", "h1:Pressed"]);
  });

  it("a FLOW mapping's `from:` carries a VALUE as well as a key", () => {
    // MEASURED, `scratchpad/s206/gnd` `g_flow_markdown`: quarto renders ONLY the baseline. The
    // key half of this spelling already suspends the bail; without the VALUE half the document
    // keeps a pressed heading quarto does not render.
    expect(names(pressed('{from: markdown, title: "T"}'))).toEqual(["h1:Baseline"]);
    // …and the value must stop at the flow separator rather than swallowing the rest.
    expect(names(pressed('{title: "T", from: markdown}'))).toEqual(["h1:Baseline"]);
  });

  it("a FLOW mapping selecting gfm suppresses the setext title, where markdown keeps it", () => {
    // MEASURED, `scratchpad/s206/cmk` `k_flow_gfm` renders NO heading and `k_flow_markdown`
    // renders `h1:probe title`. This is the DELETING row, so the pair is asserted together:
    // the first case alone would pass for a build that had stopped reporting the title
    // entirely.
    expect(names(column0Setext('{from: gfm, title: "T"}'))).toEqual([]);
    expect(names(column0Setext('{from: markdown, title: "T"}'))).toEqual(["h1:probe title"]);
  });

  // ── THE REGRESSION THIS SESSION CAUSED, CLOSED HERE ──
  // Widening the KEY predicate fed `dialectOverride`'s OTHER consumer — the ATX heading COLUMN
  // set — for two spellings that had never reached it, and the session's own completeness pass
  // caught it as INTRODUCED 2 (`scratchpad/s206/comp` `p_col_qkey_markdown`, `p_col_flow_markdown`).
  //
  // ⚠ MEASURED, `scratchpad/s206/col` and `scratchpad/s206/col2` — 56 documents, reader x
  // indent 0-3. The 0-3 tolerance belongs to the COMMONMARK FAMILY, not to the presence of a
  // `from:` key: `commonmark`, `commonmark_x` and `gfm` render a heading at all four columns,
  // while `markdown`, `markdown+emoji`, `markdown_strict`, `markdown_mmd`, `markdown_github`,
  // `markdown_phpextra` and no front matter at all render one at column 0 ONLY.
  //
  // ⚠ `markdown_strict` had to be re-measured to learn that. Its first grid row read "no
  // heading at any column", which is an EXTRACTOR artifact and not a rule: strict turns
  // `intraword_underscores` OFF, so the document names in the heading text became `<em>` and
  // the nesting-safe extractor could not see them (`scratchpad/s206/ctl2`, the feature-free
  // control pair — the underscore-free twin renders normally).
  const atColumn3 = (...fm: string[]) =>
    doc("---", ...fm, "---", "", "Intro paragraph.", "", "   # Indented Heading Here", "", "Tail.");

  it("a resolved markdown-family reader takes back CommonMark's 0-3 column tolerance", () => {
    expect(names(atColumn3('"from": markdown'))).toEqual([]);
    expect(names(atColumn3('{from: markdown, title: "T"}'))).toEqual([]);
  });

  it("…and a resolved CommonMark reader keeps it — the control that stops this deleting", () => {
    // Without this the case above would pass for a build that had simply stopped admitting
    // indented headings, which is the deletion this narrowing must not become.
    expect(names(atColumn3('"from": gfm'))).toEqual(["h1:Indented Heading Here"]);
    expect(names(atColumn3('{from: gfm, title: "T"}'))).toEqual(["h1:Indented Heading Here"]);
  });

  it("…and a reader this scanner cannot resolve keeps today's behaviour exactly", () => {
    // A nested per-format `from:` is a separately filed item and is deliberately NOT resolved
    // here. ⚠ **MEASURED, `scratchpad/s206/ctl5`, and the pair is the whole argument:** the
    // `gfm` twin `z_nest_gfm` RENDERS this heading and the `markdown` twin `z_nest_md` renders
    // none. So narrowing on the ABSENCE of a CommonMark resolution would delete a real heading,
    // while narrowing only on a POSITIVE markdown resolution cannot — an unresolved document
    // takes neither branch.
    //
    // ⚠ This case is therefore a PHANTOM that is pinned deliberately, not an agreement:
    // `scratchpad/s206/pins` `p_colnest` renders nothing and this model reports a heading. It
    // is the disclosed cost of the safe direction, and it is the filed per-format item's to
    // close — that item needs NESTED value resolution, which this session does not ship.
    expect(names(atColumn3('title: "T"', "format:", "  html:", "    from: markdown"))).toEqual([
      "h1:Indented Heading Here",
    ]);
  });
});
