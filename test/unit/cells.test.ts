import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findAllCells, findCellAtPosition } from "../../src/core/cells";

describe("findAllCells", () => {
  it("returns no cells for plain prose", () => {
    const text = ["# Heading", "", "Just prose, no code.", ""].join("\n");
    expect(findAllCells(text)).toEqual([]);
  });

  it("finds a single {python} cell with its boundaries, lang, and code", () => {
    const text = [
      "Intro prose.", // 0
      "", // 1
      "```{python}", // 2  opening fence
      "x = 1", // 3
      "print(x)", // 4
      "```", // 5  closing fence
      "", // 6
      "Outro prose.", // 7
    ].join("\n");
    expect(findAllCells(text)).toEqual([
      { startLine: 2, endLine: 5, lang: "python", code: "x = 1\nprint(x)" },
    ]);
  });

  it("does NOT treat a plain ```python fence as an executable cell", () => {
    const text = ["```python", "x = 1  # display only, no braces", "```"].join(
      "\n",
    );
    expect(findAllCells(text)).toEqual([]);
  });

  it("does NOT treat the {{python}} display form as a cell", () => {
    // `{{lang}}` is how a literal (non-executable) cell is shown in Quarto docs.
    const text = ["```{{python}}", "this is shown literally", "```"].join("\n");
    expect(findAllCells(text)).toEqual([]);
  });

  it("does NOT treat a {.python} Pandoc class block as a cell", () => {
    // A leading-dot brace info is a Pandoc class attribute, not an engine.
    const text = ["```{.python}", "x = 1", "```"].join("\n");
    expect(findAllCells(text)).toEqual([]);
  });

  it("finds multiple cells of different languages in document order", () => {
    const text = [
      "```{python}", // 0
      "a = 1", // 1
      "```", // 2
      "", // 3
      "```{r}", // 4
      "b <- 2", // 5
      "```", // 6
    ].join("\n");
    const cells = findAllCells(text);
    expect(cells.map((c) => c.lang)).toEqual(["python", "r"]);
    expect(cells.map((c) => [c.startLine, c.endLine])).toEqual([
      [0, 2],
      [4, 6],
    ]);
  });

  it("ignores a {lang} fence nested inside an outer (longer) fence", () => {
    // A 4-backtick block that *shows* a python cell — the inner ```{python} is
    // content of the outer fence, not an executable cell.
    const text = [
      "````", // 0 outer fence opens (4 backticks)
      "```{python}", // 1 looks like a cell, but is inside the outer fence
      "x = 1", // 2
      "```", // 3 only 3 backticks — cannot close the 4-backtick fence
      "````", // 4 closes the outer fence
      "After.", // 5
    ].join("\n");
    expect(findAllCells(text)).toEqual([]);
  });

  it("reads the language from a knitr-style {r, echo=FALSE} info string", () => {
    const text = ["```{r, echo=FALSE}", "plot(1)", "```"].join("\n");
    expect(findAllCells(text)).toEqual([
      { startLine: 0, endLine: 2, lang: "r", code: "plot(1)" },
    ]);
  });

  it("treats an unterminated cell as running to the end of the document", () => {
    // A user mid-typing: the opening fence has no matching close yet.
    const text = ["Intro.", "```{python}", "x = 1", "y = 2"].join("\n");
    expect(findAllCells(text)).toEqual([
      { startLine: 1, endLine: 3, lang: "python", code: "x = 1\ny = 2" },
    ]);
  });
});

describe("findCellAtPosition", () => {
  // 0: prose
  // 1: ```{python}
  // 2: x = 1
  // 3: ```
  // 4: prose
  const text = ["prose", "```{python}", "x = 1", "```", "after"].join("\n");

  it("returns the cell when the cursor is on a body line", () => {
    expect(findCellAtPosition(text, 2)).toEqual({
      startLine: 1,
      endLine: 3,
      lang: "python",
      code: "x = 1",
    });
  });

  it("returns the cell when the cursor is on the opening fence line", () => {
    expect(findCellAtPosition(text, 1)?.lang).toBe("python");
  });

  it("returns the cell when the cursor is on the closing fence line", () => {
    expect(findCellAtPosition(text, 3)?.lang).toBe("python");
  });

  it("returns null when the cursor is in prose before the cell", () => {
    expect(findCellAtPosition(text, 0)).toBeNull();
  });

  it("returns null when the cursor is in prose after the cell", () => {
    expect(findCellAtPosition(text, 4)).toBeNull();
  });
});

describe("against the sample.qmd fixture", () => {
  const fixture = readFileSync(
    path.resolve(__dirname, "../fixtures/sample.qmd"),
    "utf8",
  );

  it("finds exactly the four executable cells and skips the plain fence", () => {
    // The fixture has {python}/{r}/{julia}/{ojs} cells AND a plain ```python
    // fence (the discriminator). Only the four braced cells are executable.
    const cells = findAllCells(fixture);
    expect(cells.map((c) => c.lang)).toEqual(["python", "r", "julia", "ojs"]);
  });

  it("captures the python cell's body verbatim (including #| options)", () => {
    const py = findAllCells(fixture).find((c) => c.lang === "python");
    expect(py?.code).toContain("#| eval: false");
    expect(py?.code).toContain("import math");
    expect(py?.code).toContain("print(area(2.0))");
    expect(py?.code).not.toContain("```");
  });
});
