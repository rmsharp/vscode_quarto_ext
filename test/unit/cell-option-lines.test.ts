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
        valueSlot: { startCol: 9, endCol: 14 }, // "false"
      },
    ]);
  });

  it("detects the `//|` prefix in an {ojs} cell", () => {
    const text = ["```{ojs}", "//| echo: true", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "ojs",
        prefix: "//|",
        keySlot: { startCol: 4, endCol: 8 },
        valueSlot: { startCol: 10, endCol: 14 }, // "true"
      },
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
      {
        line: 1,
        cellLang: "r",
        prefix: "#|",
        keySlot: { startCol: 3, endCol: 5 },
        valueSlot: null, // no colon yet → no value slot
      },
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

  // These embed a REAL ```{python} fence INSIDE the skip region: only the shared
  // scanner's front-matter / comment skipping stops it from opening a cell. If
  // that skipping regressed, findAllCells would open the cell and the `#|` line
  // would be detected — so these go RED, faithfully exercising the Learning #14
  // agreement (a fenceless fixture would pass for the trivial "no cell" reason).
  it("ignores a {python} cell nested in YAML front matter (skip-region agreement)", () => {
    const text = ["---", "```{python}", "#| echo: false", "```", "title: t", "---", "prose"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("ignores a {python} cell nested in an HTML comment (skip-region agreement)", () => {
    const text = ["<!--", "```{python}", "#| echo: false", "```", "-->", "prose"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does not report the fence lines themselves", () => {
    const text = ["```{python}", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });
});

describe("findCellOptionLines — value slot (6d-2)", () => {
  it("spans the value token after `key: ` (`#| echo: false`)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 14 }); // "false"
  });

  it("reports an empty value slot after a colon + space (`#| echo: `)", () => {
    const text = ["```{python}", "#| echo: ", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 9 });
  });

  it("reports an empty value slot right after the colon (`#| echo:`)", () => {
    const text = ["```{python}", "#| echo:", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 8, endCol: 8 });
  });

  it("is null when the line has no colon yet (`#| ec`)", () => {
    const text = ["```{r}", "#| ec", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toBeNull();
  });

  it("skips multiple spaces after the colon (`#| echo:   true`)", () => {
    const text = ["```{python}", "#| echo:   true", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 11, endCol: 15 }); // "true"
  });

  it("excludes trailing whitespace from the value span (`#| echo: false  `)", () => {
    const text = ["```{python}", "#| echo: false  ", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 14 }); // "false", no trailing ws
  });

  it("is null for a block-sequence item line (`#|   - a`)", () => {
    const text = ["```{python}", "#| fig-cap:", "#|   - a", "```"].join("\n");
    const opts = findCellOptionLines(text);
    expect(opts[1].keySlot).toBeNull();
    expect(opts[1].valueSlot).toBeNull();
  });

  it("excludes a trailing YAML inline comment from the value span", () => {
    const text = ["```{python}", "#| echo: false  # turn off", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 14 }); // "false", not the comment
  });

  it("treats a comment-only value as empty (`#| echo:  # x`)", () => {
    const text = ["```{python}", "#| echo:  # x", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 10, endCol: 10 }); // empty value before the comment
  });

  it("keeps a quoted value intact (does not split on a `#` inside quotes)", () => {
    const text = ["```{python}", '#| label: "a # b"', "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 10, endCol: 17 }); // the whole "a # b" scalar
  });
});

describe("findCellOptionLines — Quarto-faithful prefix matching", () => {
  // Quarto's directive pattern is `^#\s*\| ?` (anchored at col 0; whitespace
  // allowed between the comment char and the pipe). Match it exactly.
  it("does NOT detect an INDENTED `#|` line (Quarto treats it as code)", () => {
    const text = ["```{python}", "  #| echo: false", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does NOT detect an indented `//|` line", () => {
    const text = ["```{ojs}", "  //| echo: true", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("DETECTS `# |` with a space between the comment char and the pipe", () => {
    const text = ["```{r}", "# | echo: false", "x <- 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "r",
        prefix: "#|",
        keySlot: { startCol: 4, endCol: 8 },
        valueSlot: { startCol: 10, endCol: 15 }, // "false"
      },
    ]);
  });

  it("DETECTS `#  |` with extra space (and normalizes the prefix)", () => {
    const text = ["```{python}", "#  | echo: false", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.prefix).toBe("#|");
    expect(opt.keySlot).toEqual({ startCol: 5, endCol: 9 }); // "echo" after "#  | "
  });
});

describe("findCellOptionLines — multi-line QUOTED / flow values (adversarial review, S130)", () => {
  // Quarto folds every `#|` line of a cell into ONE YAML block, so a multi-line
  // quoted scalar's continuation `#|` line is INSIDE the value, not a new option.
  // Emitting it would let value-diagnostics flag e.g. `#| fig-height: wide"` (a
  // numeric cell option) on a doc quarto renders exit 0 — a cardinal-sin FP the
  // numeric slice made live for fig-width/fig-height/layout-ncol.
  it("does NOT emit a `#|` continuation line inside a multi-line DOUBLE-quoted value", () => {
    const text = [
      "```{r}",
      '#| fig-cap: "a caption that wraps',
      '#| fig-height: wide"',
      "1 + 1",
      "```",
    ].join("\n");
    // Only the fig-cap line (line 1) is a real option; line 2 is its continuation.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("resumes option detection on the `#|` line AFTER the closing quote", () => {
    const text = [
      "```{r}",
      '#| fig-cap: "a',
      '#| b"',
      "#| echo: false",
      "1 + 1",
      "```",
    ].join("\n");
    // fig-cap (1) opens, line 2 (`b"`) closes it, echo (3) is a real option again.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });

  it("does NOT emit a `#|` continuation line inside a multi-line FLOW collection", () => {
    const text = [
      "```{r}",
      "#| fig-subcap: [one,",
      "#| fig-height: 3]",
      "1 + 1",
      "```",
    ].join("\n");
    // fig-subcap opens `[`; the `#| fig-height: 3]` line is its continuation.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("still emits a normal option after a single-line quoted value (no over-suppression)", () => {
    const text = ["```{r}", '#| fig-cap: "a short caption"', "#| fig-width: 3", "1 + 1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });
});

describe("findCellOptionLines — arming discipline parity: the phantom-quote FN (Defect A, S154)", () => {
  // The continuation guard arms only when a value ACTUALLY opens a multi-line quoted
  // scalar / flow collection — decided by the value token's FIRST character (past a
  // stripped node property), NOT by a scanFlow over the whole `key: value`. An inner
  // apostrophe / quote / bracket in a PLAIN scalar is literal YAML text and must not
  // arm a phantom quote that swallows the following real option — the mirror of the
  // fix S153 shipped for the two `.qmd` front-matter value enumerators (the third and
  // last site of the phantom-quote defect class; PROJECT_LEARNINGS #166). Grounded
  // firsthand vs quarto render 1.7.33: `#| fig-cap: Don't do this` renders exit 0, while
  // the swallowed `#| echo: banana` renders exit 1 ("must instead be `true` or `false`").
  it("does NOT let an inner APOSTROPHE in a plain value swallow the following option", () => {
    const text = ["```{python}", "#| fig-cap: Don't do this", "#| echo: banana", "1+1", "```"].join("\n");
    // Both are real options; the apostrophe in fig-cap is literal, not a quote opener.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("does NOT let an inner DOUBLE-QUOTE in a plain value swallow the following option", () => {
    // The other half of the defect class: an inner `"` in a plain scalar is literal too.
    // Before the S154 fix the whole-token scan armed a phantom `"` and swallowed line 2.
    const text = ["```{python}", '#| fig-cap: he said "hi', "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("STILL arms a genuine SINGLE-quoted multi-line value (narrowing did not disable `'` openers)", () => {
    // Preserved behavior: a value that genuinely OPENS with `'` still folds its
    // continuation, so `#| b'` (line 2) is skipped and `#| echo` (line 3) resumes.
    const text = ["```{r}", "#| fig-cap: 'a", "#| b'", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });

  it("STILL arms an ANCHORED flow opener — the node-property strip is load-bearing", () => {
    // `&a ` is stripped BEFORE the first-char test, so the `[` is seen as the opener and
    // the flow arms; without the strip the opener would be `&` and line 2 would leak.
    const text = ["```{r}", "#| fig-subcap: &a [one,", "#| fig-height: 3]", "#| echo: false", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });
});
