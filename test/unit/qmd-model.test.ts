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
  it("allows up to 3 spaces of leading indentation", () => {
    const text = ["   ### Indented three"].join("\n");
    expect(findHeadings(text)).toEqual([
      { level: 3, text: "Indented three", line: 0 },
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

  it("declines to promote a single bullet-list item into a heading", () => {
    // Confirmed against the real Quarto CLI: `- solo item\n---` renders as
    // `<li><h2>solo item</h2></li>` — Pandoc strips the "- " marker and nests
    // the heading INSIDE the list. This model tracks no list context, so
    // emitting a top-level heading here would be wrong on two counts: the
    // literal "- " marker would leak into the text, and the heading wouldn't
    // really be a document-level section. Declining (a false negative) is the
    // safe direction, consistent with this project's established preference.
    const text = ["- solo item", "---"].join("\n");
    expect(findHeadings(text)).toEqual([]);
  });

  it("declines for `*` and `+` bullet markers too", () => {
    expect(findHeadings(["* solo item", "---"].join("\n"))).toEqual([]);
    expect(findHeadings(["+ solo item", "---"].join("\n"))).toEqual([]);
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

  it("CONTROL: an UNTERMINATED indented cell fence opens nothing", () => {
    // ⚠ THE CARDINAL-SIN GUARD, at the scanner level. Quarto builds no cell from an
    // unclosed fence (measured exit 0), so opening one would both flag a document quarto
    // ACCEPTS and swallow every heading below. The heading assertion is the half that a
    // flag-surface test cannot see.
    const text = doc("Para.", "", "    ```{r}", "1", "", "# A Real Heading");
    expect(findAllCells(text)).toEqual([]);
    expect(findHeadings(text).map((h) => h.text)).toEqual(["A Real Heading"]);
  });

  it("CONTROL: a COLUMN-0 unterminated cell is still emitted, unchanged by S178", () => {
    // The runnable-while-typing affordance, and a divergence from quarto that predates this
    // session (filed separately). Without this pin, the guard above would also pass if the
    // affordance had been removed outright rather than merely not extended.
    expect(findAllCells(doc("```{r}", "1")).map((c) => c.lang)).toEqual(["r"]);
  });

  it("CONTROL: an indented TILDE fence is never a cell, indented or not", () => {
    // Quarto's `startCodeCellRegEx` has no tilde branch, and neither does ours.
    expect(findAllCells(doc("    ~~~{r}", "1", "    ~~~"))).toEqual([]);
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
