import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findCellOptionLines, findHeadings } from "../../src/core/qmd/model";
import { quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";

// Session 313 — the option tail of a code-cell header, `( *[ ,].*)?`, became `([ ,].*)?` in four literals (a long run of spaces made the ` *` quadratic:
// `pathological-inputs.test.ts` holds the clock rows). The two spellings accept the same strings, and these rows pin WHAT EACH LITERAL DECIDES so a wrong
// spelling (a tail that needs a second character, a lost comma, a lost space, a tab, form feed or no-break space that starts the tail) fails here and not only
// in a scratch comparison.
//
// Every expected value below is the PARENT build's answer (the commit before Session 313's change), read through the same entries; the old and new
// literals were also compared on 430 million (string, literal) pairs over every capture group. One header, `{r` + TAIL, is judged by each of the four literals:
//   - START_CODE_CELL (`quarto-yaml-regions.ts`): an INDENTED cell fence swallows a `---` pair (no YAML region); a header it refuses does not.
//   - CELL_INFO (`qmd/model.ts`): the fence is a cell, so its `#|` line is a cell option line.
//   - KNITR_CHUNK_INFO (`qmd/model.ts`) is called from two places. The PARAGRAPH GATE is the one these rows pin: a `{zzz9` header (no cell: it has a digit)
//     that knitr claims opens its fence even directly below a paragraph, and one it refuses is paragraph text, so the heading under it is real. The other
//     call, in the silent-chunk rule (Session 275: the stray bare fence ABOVE a silent chunk stays unclosed), only ever sees a header `KNITR_CHUNK_BEGIN` took
//     first, and BEGIN's tail is a subset of INFO's, so that call is redundant: deleting it changes no answer, and the "stray fence" rows below pin BEGIN's
//     tail (already linear before this change) and the rule's answers, not INFO.
//   - languagesInMarkdown (`document-engine.ts`): a `{python...}` header counts as a language, so the document runs on jupyter.
// A line terminator (CR, U+2028, U+2029) as the tail's first character, or inside it, cannot reach CELL_INFO or KNITR_CHUNK_INFO at all: their input comes
// from `(.*)$` (and BEGIN's `.*`), which never holds one, so at those two literals such a row pins the fence recogniser in front of them. At START_CODE_CELL
// and languagesInMarkdown it pins the literal (a `.` that crossed a line terminator would change the row).

// [tail after the language (closing brace included), YAML regions left by the indented cell, cell option lines, headings of the stray-fence knitr document,
//  headings of the paragraph-gate knitr document, engine]
type Row = readonly [
  tail: string,
  regions: number,
  cellOptionLines: number,
  strayFenceHeadings: readonly string[],
  paragraphGateHeadings: readonly string[],
  engine: string,
];
const ROWS: readonly Row[] = [
  ["}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [", echo=FALSE}", 0, 1, ["Under Test", "After Chunk"], ["After"], "jupyter"],
  [" echo=FALSE}", 0, 1, ["Under Test", "After Chunk"], ["After"], "jupyter"],
  [",echo=FALSE}", 0, 1, ["Under Test", "After Chunk"], ["After"], "jupyter"],
  ["  ,  echo=FALSE}", 0, 1, ["Under Test", "After Chunk"], ["After"], "jupyter"],
  [" demo, echo=FALSE}", 0, 1, ["Under Test", "After Chunk"], ["After"], "jupyter"],
  ["\techo=FALSE}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [".x, echo=FALSE}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [";echo=FALSE}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", echo=FALSE} x", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", echo=FALSE}}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  ["\u00a0, echo=FALSE}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", echo=FALSE}\u00a0", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [", echo=FALSE}  ", 0, 1, ["Under Test", "After Chunk"], ["After"], "jupyter"],
  [",}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [" }", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  ["  }", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [".x}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [";}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\t}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\u00a0}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", a}}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [", a} x", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", a} x}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [" a b}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  ["} x", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [",", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", a", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [" x", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", {a}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [",\t}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [" , }", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  ["\r}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\u2028}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [",a\r}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["x}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  ["9}", 1, 0, ["After Chunk"], ["After"], "jupyter"],
  ["=}", 0, 1, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\f}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\u000b}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\u0085}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\ufeff}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\u2029}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  ["\u3000}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", a\u2028b}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", a\u2029b}", 1, 0, ["After Chunk"], ["Inside", "After"], "markdown"],
  [", a\u0085b}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [", a\u000bb}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [", a\ufeffb}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
  [", a\fb}", 0, 1, ["After Chunk"], ["After"], "jupyter"],
];

const header = (language: string, tail: string): string => "```{" + language + tail;
// Row titles spell every control and non-ASCII character as \uXXXX, so two rows never print alike (a no-break space and a form feed look like a space).
const escaped = (text: string): string =>
  JSON.stringify(text).replace(/[^\x20-\x7e]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const named = (rows: readonly Row[]): [string, Row][] => rows.map((row) => [escaped(row[0]), row]);

describe("the option tail of a code-cell header (Session 313): what each of the four literals decides", () => {
  it.each(named(ROWS))("START_CODE_CELL, an indented %s header", (_name, [tail, regions]) => {
    const text = ["  " + header("r", tail), "---", "a: 1", "---", "  ```"].join("\n");
    expect(quartoYamlRegions(text)).toHaveLength(regions);
  });

  it.each(named(ROWS))("CELL_INFO, a %s header: its `#|` line is a cell option line or not", (_name, [tail, , cellOptionLines]) => {
    const text = [header("r", tail), "#| echo: false", "x", "```"].join("\n");
    expect(findCellOptionLines(text)).toHaveLength(cellOptionLines);
  });

  it.each(named(ROWS))("KNITR_CHUNK_BEGIN and the silent-chunk rule, a %s chunk header below a stray fence", (_name, [tail, , , strayFenceHeadings]) => {
    const text = ["prose", "", "```", "", "## Under Test", "", header("r", tail), "plot(pressure)", "```", "", "## After Chunk", "", "tail", ""].join("\n");
    expect(findHeadings(text, "knitr").map((h) => h.text)).toEqual(strayFenceHeadings);
  });

  it.each(named(ROWS))("KNITR_CHUNK_INFO (the paragraph gate), a %s `{zzz9` header below a paragraph", (_name, [tail, , , , paragraphGateHeadings]) => {
    const text = ["Intro text", " " + header("zzz9", tail), "", "# Inside", "", " ```", "", "# After"].join("\n");
    expect(findHeadings(text, "knitr").map((h) => h.text)).toEqual(paragraphGateHeadings);
    // The controls: a document whose engine is not knitr never claims the chunk, so the same lines read as paragraph text for every tail and every other engine.
    for (const engine of [undefined, "jupyter", "markdown", "julia"] as const) {
      expect(findHeadings(text, engine).map((h) => h.text)).toEqual(["Inside", "After"]);
    }
  });

  it.each(named(ROWS))("languagesInMarkdown, a %s `{python` header: the engine", (_name, [tail, , , , , engine]) => {
    expect(resolveDocumentEngine("a.qmd", [header("python", tail), "```"].join("\n"))).toBe(engine);
  });
});
