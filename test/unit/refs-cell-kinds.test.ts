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
