import { describe, expect, it } from "vitest";
import { findCellOptionLines } from "../../src/core/qmd/model";

describe("findCellOptionLines — detection inside executable cells", () => {
  it("finds a single `#|` option line in a {python} cell", () => {
    const text = [
      "```{python}", // 0  opening fence
      "#| echo: false", // 1  option line
      "x = 1", // 2  code
      "```", // 3  closing fence
    ].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "python",
        prefix: "#|",
        keySlot: { startCol: 3, endCol: 7 }, // "echo"
      },
    ]);
  });

  it("detects the `//|` prefix in an {ojs} cell", () => {
    const text = ["```{ojs}", "//| echo: true", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      { line: 1, cellLang: "ojs", prefix: "//|", keySlot: { startCol: 4, endCol: 8 } },
    ]);
  });

  it("reports an empty keySlot for a bare prefix line `#| ` (key not yet typed)", () => {
    const text = ["```{python}", "#| ", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.keySlot).toEqual({ startCol: 3, endCol: 3 });
  });

  it("covers the whole partially-typed key (`#| ec`)", () => {
    const text = ["```{r}", "#| ec", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      { line: 1, cellLang: "r", prefix: "#|", keySlot: { startCol: 3, endCol: 5 } },
    ]);
  });

  it("excludes trailing whitespace before the colon (`#| key : v`)", () => {
    const text = ["```{python}", "#| echo : false", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.keySlot).toEqual({ startCol: 3, endCol: 7 }); // "echo", not "echo "
  });

  it("returns null keySlot for a block-sequence item line (`#|   - x`)", () => {
    const text = ["```{python}", "#| fig-cap:", "#|   - a", "```"].join("\n");
    const opts = findCellOptionLines(text);
    expect(opts).toHaveLength(2);
    expect(opts[0].keySlot).toEqual({ startCol: 3, endCol: 10 }); // "fig-cap"
    expect(opts[1].keySlot).toBeNull(); // the `- a` sequence item
  });

  it("finds multiple option lines and ignores interleaved code", () => {
    const text = [
      "```{python}", // 0
      "#| echo: false", // 1
      "#| label: fig-a", // 2
      "import numpy", // 3 (code, not an option)
      "#| eval: true", // 4 — not contiguous, but still a #| line
      "```", // 5
    ].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2, 4]);
  });
});

describe("findCellOptionLines — does NOT detect outside executable cells", () => {
  it("ignores a `#|`-shaped line in prose", () => {
    expect(findCellOptionLines("Some prose\n#| echo: false\nmore")).toEqual([]);
  });

  it("ignores a `#|` line in a non-executable ```python block (no braces)", () => {
    const text = ["```python", "#| echo: false", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("ignores `#|`-shaped lines in YAML front matter (skip-region agreement)", () => {
    const text = ["---", "#| echo: false", "title: t", "---", "prose"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("ignores a `#|`-shaped line inside an HTML comment (skip-region agreement)", () => {
    const text = ["<!--", "#| echo: false", "-->", "prose"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does not report the fence lines themselves", () => {
    const text = ["```{python}", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });
});
