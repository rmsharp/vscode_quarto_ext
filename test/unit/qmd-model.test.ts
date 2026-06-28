import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOutline,
  findAllCells,
  findBodyLines,
  findCellAtPosition,
  findHeadings,
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
  const indentedFence = [
    "Para.", // 0
    "", // 1
    "    ```{python}", // 2  4 spaces → indented code, NOT a fence
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
