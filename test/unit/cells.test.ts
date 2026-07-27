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

  it("ignores a {lang} fence nested inside a ~~~ (tilde) literal block", () => {
    // `~~~` is a CommonMark fenced block used in Quarto docs to show a backtick
    // code cell *literally* — its contents are not executable.
    const text = [
      "~~~", // 0 outer tilde fence opens
      "```{python}", // 1 literal content, not a real cell
      "x = 1", // 2
      "```", // 3 a backtick run cannot close a tilde fence
      "~~~", // 4 closes the tilde fence
      "After.", // 5
    ].join("\n");
    expect(findAllCells(text)).toEqual([]);
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

/**
 * Session 172 — the fence-token grammar is quarto's, transcribed.
 *
 * `CELL_INFO` is now `/^\{([A-Za-z][=A-Za-z]*)( *[ ,].*)?\}$/`, whose class and tail come
 * from `breakQuartoMd`'s own recognizer in the installed 1.7.33:
 * `^\s*(```+)\s*\{([=A-Za-z]+)( *[ ,].*)?\}\s*$`. A token that fails it is not a cell to
 * quarto AT ALL — no code cell is built, no options are partitioned, nothing is validated.
 *
 * Each pin names the exit code measured firsthand with `quarto render --no-execute`. The
 * `{r}` control in the first pin is what makes the rest discriminating: without it, a build
 * that had simply stopped reporting cells entirely would pass every negative assertion here.
 */
describe("findAllCells — quarto's fence-token grammar (Session 172)", () => {
  const cellOf = (token: string) =>
    findAllCells(["```" + token, "1", "```"].join("\n"));

  it("still reports the plain {r} control — the negatives below are not a dead scanner", () => {
    expect(cellOf("{r}")).toEqual([{ startLine: 0, endLine: 2, lang: "r", code: "1" }]);
  });

  // ---- too PERMISSIVE before: each of these renders quarto exit 0 ----------
  it("does not treat a DIGIT-bearing token as a cell ({python3}, {fortran95}, {d3})", () => {
    // Measured: {python3}/{fortran95}/{d3} + a bad option all render exit 0, while the
    // digit-free {fortran} renders exit 1. quarto's class is [=A-Za-z]+ — no digits.
    expect(cellOf("{python3}")).toEqual([]);
    expect(cellOf("{fortran95}")).toEqual([]);
    expect(cellOf("{d3}")).toEqual([]);
    expect(cellOf("{fortran}")).toHaveLength(1); // the discriminating control
  });

  it("does not treat a DOTTED token as a cell, and no longer truncates it to {r}", () => {
    // The oracle's standing cardinal FP. Before, group 1 captured `r` and the `[^}]*` tail
    // ate `.foo`, so every consumer saw an ordinary {r} cell. Measured exit 0.
    expect(cellOf("{r.foo}")).toEqual([]);
  });

  it("does not treat a HYPHEN or UNDERSCORE token as a cell", () => {
    // Measured exit 0 for both. Neither spelling is named by any filed item — they were
    // admitted by the old class `[A-Za-z0-9_-]*` and found by sweeping the class itself.
    expect(cellOf("{r-foo}")).toEqual([]);
    expect(cellOf("{r_foo}")).toEqual([]);
  });

  it("does not truncate a NON-ASCII letter onto a real language — {ré} was an {r} cell", () => {
    // The sharpest of the truncations: `[A-Za-z][A-Za-z0-9_-]*` captured `r` and `[^}]*` ate
    // `é`, so a single accent typo produced a cell indistinguishable from a real {r} to every
    // consumer at once — an R virtual document, Ctrl+Enter execution, knitr diagnostic scope.
    // Measured exit 0: quarto builds no cell.
    expect(cellOf("{ré}")).toEqual([]);
    expect(cellOf("{café}")).toEqual([]);
  });

  it("does not treat a TAB-separated info string as a cell", () => {
    // quarto's option tail is `( *[ ,].*)?` — the separator must be a SPACE or a COMMA, never
    // a tab. Measured exit 0. The old `[^}]*` tail accepted it and captured `r`.
    expect(cellOf("{r\techo=FALSE}")).toEqual([]);
    expect(cellOf("{r\t}")).toEqual([]);
  });

  it("does not treat an '=' token followed by a DIGIT as a cell", () => {
    // `[=A-Za-z]+` admits `=` but still refuses digits, and the tail cannot start with one.
    // Measured exit 0 for both, against exit 1 for their digit-free twins below.
    expect(cellOf("{r=1}")).toEqual([]);
    expect(cellOf("{mermaid=x1}")).toEqual([]);
  });

  // ---- too RESTRICTIVE before: each of these renders quarto exit 1 ---------
  it("captures the language quarto captures for a glued '=' token — `mermaid=x`, not `mermaid`", () => {
    // Measured exit 1: it IS a cell, and its language is `mermaid=x`, which is not in
    // quarto's handler list, so it takes the ordinary cell schema. We used to capture
    // `mermaid`, match the handler guard, and suppress the diagnostic — a lost true positive.
    expect(cellOf("{mermaid=x}")).toEqual([
      { startLine: 0, endLine: 2, lang: "mermaid=x", code: "1" },
    ]);
    expect(cellOf("{r=}")[0].lang).toBe("r=");
    // …and the bare handler token is untouched, so the handler exemption still applies.
    expect(cellOf("{mermaid}")[0].lang).toBe("mermaid");
  });

  it("accepts a legitimate knitr header whose option value contains a '}'", () => {
    // The direction a "tighten the regex" framing misses. `[^}]*` cannot span the `}` inside
    // the quoted value, so this well-formed chunk header was NOT a cell to us while quarto
    // validates it (measured exit 1) — a lost true positive on ordinary knitr input.
    expect(cellOf('{r, fig.cap="}"}')).toEqual([
      { startLine: 0, endLine: 2, lang: "r", code: "1" },
    ]);
    expect(cellOf("{r,}}")[0].lang).toBe("r");
  });

  // ---- FP GUARD: the letter-led rule is deliberate, not an oversight -------
  it("FP GUARD: an '='-LED raw block is still not a cell, though quarto says it is", () => {
    // ⚠ LOAD-BEARING. quarto's `[=A-Za-z]+` accepts a leading `=`, and this session measured
    // that quarto really does validate raw blocks: `{=html}` + `#| echo: banana` renders
    // exit 1, and `#| cache: banana` in a KNITR document renders exit 1 too — so a raw block
    // takes the document engine's schema like any other cell.
    //
    // We deliberately keep the leading `[A-Za-z]`. Adopting the `=`-led branch would WIDEN
    // what we squiggle onto a whole new block class — the cardinal-sin direction — and would
    // hand `cell.lang === "=html"` to the outline, the virtual-document language map,
    // run-cell and the crossref index. That is the separately filed raw-block item's work.
    // If you are here because you were "completing" this grammar: do that item, not this line.
    expect(cellOf("{=html}")).toEqual([]);
    expect(cellOf("{=latex}")).toEqual([]);
    expect(cellOf("{=}")).toEqual([]);
  });

  it("leaves the shapes both grammars already agreed on unchanged", () => {
    // Regression guards. Each renders the exit code the pre-S172 build already matched, so a
    // change that moved them would be a regression this commit introduced, not a fix.
    expect(cellOf("{r, echo=FALSE}")[0].lang).toBe("r"); // exit 1 — knitr options survive
    expect(cellOf("{r echo=FALSE}")[0].lang).toBe("r"); // exit 1
    expect(cellOf("{R}")[0].lang).toBe("R"); // exit 1 — case preserved, as quarto does
    expect(cellOf("{ojs}")[0].lang).toBe("ojs"); // exit 1
    expect(cellOf("{123}")).toEqual([]); // exit 0
    expect(cellOf("{}")).toEqual([]); // exit 0
    expect(cellOf("{.python}")).toEqual([]); // exit 0 — Pandoc class
    expect(cellOf("{{python}}")).toEqual([]); // exit 0 — display form
  });
});
