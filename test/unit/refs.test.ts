import { describe, expect, it } from "vitest";
import {
  crossrefCompletionContext,
  findLabel,
  indexLabels,
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
    expect(crossrefCompletionContext("See @", 5)).toEqual({ start: 4, typed: "" });
  });

  it("returns the partial text typed after @fig-", () => {
    expect(crossrefCompletionContext("See @fig-pl", 11)).toEqual({
      start: 4,
      typed: "fig-pl",
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
