import { describe, expect, it } from "vitest";
import { indexLabels } from "../../src/core/refs";

describe("Session 305 — a code cell defines no `sec-` or `eq-` label", () => {
  // Rendered, quarto 1.7.33, one cell per document under knitr, Jupyter and the markdown engine (`scratchpad/s305/grid1`, g040-g065):
  // `#| label: sec-x` and `#| label: eq-x` print `?@sec-x` / `?@eq-x` in EVERY cell language (r, python, mermaid, dot, ojs) under
  // EVERY engine, 26 rows of 26. A section is owned by a heading and an equation by display math; a cell has neither. The index used
  // to answer "defined" for a label of any kind on a cell, so the completion list and go-to-definition offered a target quarto never makes.
  const ids = (text: string): string[] => indexLabels(text).map((l) => l.id);

  it("a python cell's `#| label: sec-x` defines nothing", () => {
    expect(ids(["```{python}", "#| label: sec-x", "x = 1", "```"].join("\n"))).toEqual([]);
  });

  it("…and so does `eq-x`", () => {
    expect(ids(["```{python}", "#| label: eq-x", "x = 1", "```"].join("\n"))).toEqual([]);
  });

  // The comment character is the cell language's own (`%%|` mermaid, `//|` dot and ojs): the guard is about the KIND, so it must hold for
  // every language the scanner reads, and the document engine (what `resolveDocumentEngine` answered) must not change it.
  type Engine = NonNullable<Parameters<typeof indexLabels>[1]> | undefined;
  const LANGS: ReadonlyArray<readonly [string, string]> = [
    ["r", "#|"],
    ["python", "#|"],
    ["mermaid", "%%|"],
    ["dot", "//|"],
    ["ojs", "//|"],
  ];
  const ENGINES: readonly Engine[] = [undefined, "knitr", "jupyter", "markdown"];
  const cellOf = (lang: string, comment: string, id: string, caption: string | null, ...body: string[]): string =>
    ["```{" + lang + "}", `${comment} label: ${id}`, ...(caption === null ? [] : [`${comment} ${caption}`]), ...body, "```"].join("\n");

  describe.each(["sec", "eq"] as const)("`%s-x` on a cell, in every language under every engine (g040-g065)", (kind) => {
    it.each(LANGS.flatMap(([lang, comment]) => ENGINES.map((engine) => [lang, comment, engine] as const)))(
      "{%s} (%s), engine %s",
      (lang, comment, engine) => {
        expect(indexLabels(cellOf(lang, comment, `${kind}-x`, null, "1 + 1"), engine)).toEqual([]);
      },
    );
  });

  describe("a cell whose OWN code writes the id as an anchor defines it at run time (hunt output, langs, interactions)", () => {
    // Rendered: the label is no definition, the printed `{#sec-x}` / `{#eq-x}` is. The index cannot run the code, so it keeps the label when
    // the cell's own text spells the id as an anchor (the same reading `writtenElsewhere` gives a figure or table label).
    it("an R cell printing a heading with the same id (lo11, lo14, li12)", () => {
      expect(ids(["```{r}", "#| label: sec-x", "#| output: asis", 'cat("## Title {#sec-x}\\n")', "```"].join("\n"))).toEqual(["sec-x"]);
    });

    it("…and so does ANOTHER cell's code: the label cell need not be the one that prints it (grid2 h10)", () => {
      const text = ["```{r}", "#| label: eq-x", "x <- 1", "```", "", "```{r}", "#| output: asis", 'cat("$$ y = x $$ {#eq-x}\\n")', "```"].join("\n");
      expect(ids(text)).toEqual(["eq-x"]);
    });
  });

  describe("only a brace anchor is read, and only for what quarto defines from it", () => {
    // Rendered, quarto 1.7.33: a raw HTML `id=` printed by the cell defines NOTHING for a section or an equation, on a heading or on a
    // div (`<h2 id="sec-x">` lo18, h13; a plain `<div id>` lo13; `<div id="eq-x">` h12: four documents of four), where a brace anchor defines
    // both. A raw `id=` still counts for a FIGURE or TABLE label (Session 304, hunt3 anchor-ids), so only this exemption ignores it.
    it.each([
      ["sec-x", '<h2 id="sec-x">T</h2>', "lo18, h13"],
      ["eq-x", '<div id="eq-x">x</div>', "h12"],
    ])("a cell printing a raw HTML id for %s keeps no label (%s)", (id, html) => {
      expect(ids(["```{r}", `#| label: ${id}`, "#| output: asis", `cat('${html}\\n')`, "```"].join("\n"))).toEqual([]);
    });
  });

  describe("what the exemption does and does not keep (hunt langs, output, interactions; grid2)", () => {
    const sec = (label: string, ...code: string[]): string => ["```{python}", `#| label: ${label}`, "#| output: asis", ...code, "```"].join("\n");

    it.each([
      ['{python} print: heading', "sec-x", 'print("## Title {#sec-x}")', "lg19, li14"],
      ['{python} print: equation', "eq-x", 'print("$$ y = x $$ {#eq-x}")', "lo45"],
      ['{python} display(Markdown(...)): equation', "eq-x", 'display(Markdown("$$ y = x $$ {#eq-x}"))', "lg28, li15, lo42, lo53"],
      ['{python} Markdown(...): heading', "sec-x", 'Markdown("## Title {#sec-x}")', "lo46"],
    ])("a cell that writes its own id keeps the label: %s (%s)", (_name, id, code) => {
      expect(ids(sec(id, code))).toEqual([id]);
    });

    it("an {asis} cell whose content IS the heading keeps its label (lg21)", () => {
      expect(ids(["```{asis}", "#| label: sec-x", "## Self defined heading {#sec-x}", "Text under the heading.", "```"].join("\n"))).toEqual(["sec-x"]);
    });

    it("a {bash} cell printing the equation keeps its label (lg20)", () => {
      expect(ids(["```{bash}", "#| label: eq-x", "#| output: asis", "printf '$$ x = 1 $$ {#eq-x}\\n'", "```"].join("\n"))).toEqual(["eq-x"]);
    });

    it("a DIFFERENT id written in the code does not keep the label (h01a, h02a, h03a: quarto prints ?@eq-a, defines only eq-b)", () => {
      expect(ids(sec("eq-a", 'print("$$ y = x $$ {#eq-b}")'))).toEqual([]);
      expect(ids(sec("sec-a", 'print("## T {#sec-b}")'))).toEqual([]);
    });

    it("an anchor in the PROSE is not read: the equation is the definition, at its own line (h14)", () => {
      const text = ["$$ y = x $$ {#eq-x}", "", "```{r}", "#| label: eq-x", "x <- 1", "```"].join("\n");
      expect(indexLabels(text)).toEqual([{ id: "eq-x", kind: "eq", line: 0, column: 14 }]);
    });

    it("…and the same holds when the cell comes FIRST: the label never moves the definition onto the cell", () => {
      const text = ["```{r}", "#| label: eq-x", "x <- 1", "```", "", "$$ y = x $$ {#eq-x}"].join("\n");
      expect(indexLabels(text)).toEqual([{ id: "eq-x", kind: "eq", line: 5, column: 14 }]);
    });

    describe("RESIDUALS, each measured: the exemption reads TEXT, and the text is not always what runs", () => {
      it("an anchor only in a code COMMENT keeps a phantom label, as before (h04, h05: quarto prints ?@eq-x)", () => {
        expect(ids(["```{r}", "#| label: eq-x", "# {#eq-x} only a comment", "x <- 1", "```"].join("\n"))).toEqual(["eq-x"]);
      });

      it("…and so does code that never runs or prints no markdown (h06-h09, h15)", () => {
        expect(ids(["```{r}", "#| label: eq-x", "#| eval: false", "#| output: asis", 'cat("$$ y = x $$ {#eq-x}\\n")', "```"].join("\n"))).toEqual(["eq-x"]);
        expect(ids(["```{r}", "#| label: eq-x", 'cat("$$ y = x $$ {#eq-x}\\n")', "```"].join("\n"))).toEqual(["eq-x"]);
      });

      it("LOST: an id the code builds from pieces is defined by quarto and has no anchor in the text (h11)", () => {
        expect(ids(["```{r}", "#| label: eq-x", "#| output: asis", 'cat("$$ y = x $$ {#eq-", "x}\\n", sep = "")', "```"].join("\n"))).toEqual([]);
      });

      it("LOST: a heading whose TEXT is the id has the auto id quarto resolves, which this model never generates (li18; the label used to hide it)", () => {
        expect(ids(["# sec-x", "", "```{r}", "#| label: sec-x", "x <- 1", "```"].join("\n"))).toEqual([]);
      });
    });
  });

  describe("the kinds a cell DOES define stay defined (g001-g026, g029, g032, g033, g036, g039)", () => {
    // Controls for the guard: it is a list of two kinds, not a rule about cells. A figure and a table keep their label in every language and
    // engine, and a listing keeps it where quarto defines it (a python cell under Jupyter or markdown, every handler cell).
    it.each(LANGS.flatMap(([lang, comment]) => ENGINES.map((engine) => [lang, comment, engine] as const)))("fig-x and tbl-x on a {%s} cell (%s), engine %s", (lang, comment, engine) => {
      expect(indexLabels(cellOf(lang, comment, "fig-x", 'fig-cap: "C"', "plot(1)"), engine).map((l) => l.id)).toEqual(["fig-x"]);
      expect(indexLabels(cellOf(lang, comment, "tbl-x", 'tbl-cap: "C"', "plot(1)"), engine).map((l) => l.id)).toEqual(["tbl-x"]);
    });

    it.each([
      ["python", "#|", "jupyter"],
      ["python", "#|", "markdown"],
      ["mermaid", "%%|", "knitr"],
      ["mermaid", "%%|", "jupyter"],
      ["dot", "//|", "knitr"],
      ["ojs", "//|", "jupyter"],
    ] as const)("lst-x on a {%s} cell is defined under %s (g032, g033, g030, g035)", (lang, comment, engine) => {
      expect(indexLabels(cellOf(lang, comment, "lst-x", 'lst-cap: "C"', "x = 1"), engine).map((l) => l.id)).toEqual(["lst-x"]);
    });

    it("RESIDUAL: lst-x on a knitr cell is still indexed although quarto leaves it undefined there (g027, g028): the answer depends on the engine, so it is not removed here", () => {
      expect(indexLabels(cellOf("r", "#|", "lst-x", 'lst-cap: "C"', "x <- 1"), "knitr").map((l) => l.id)).toEqual(["lst-x"]);
    });
  });
});
