import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findCellOptionLines, findHeadings } from "../../src/core/qmd/model";
import { quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";

// Session 316 — pins for the NON-TAIL parts of the four code-cell header literals (BACKLOG, since drained: "The NON-TAIL parts of the four code-cell header literals are pinned by
// no unit test"). `cell-header-option-tail.test.ts` pins the option TAIL `([ ,].*)?`; nothing pinned the rest: the leading run, the backtick count, the language class, the
// two `.trim()` calls on the indented-cell path, the start anchor of `KNITR_CHUNK_INFO` and the three terms of `knitrClaims`. Session 313's test critic found eleven edits
// of these that survived the whole suite. Each B90 row below (S, L, C and K ids) kills one of them: the edit is a mutant in `tools/mutation-run/mutants/b90-cell-header.json`
// (run `python3 tools/mutation-run/run.py tools/mutation-run/mutants/b90-cell-header.json`), and the id at the front of each title (S01, C12, ...) is that mutant's.
//
// The N-rows pin NEIGHBOURS of those edits (the same literal part spelled another way: `[ \t]*` for `\s*`, `trimStart()` for `trim()`, an end anchor lost), found by the probe agents and
// listed in `tools/mutation-run/mutants/b90-neighbours.json`; S01, S03, C12 and C13 kill some of them too (a form feed, a tab gap, a blank on either side), which is why those rows are tables.
// The same file records the two neighbours judged EQUIVALENT (E01, E02): they survive on purpose, with the argument beside them.
//
// Every expected value is the answer of the tree these rows were written against (no source changed in the session), read through the same public entries
// the neighbouring rows use. A row was shown to PASS on that tree and to FAIL under its mutant, and the run is repeated, mutant by mutant, by the runner above.
//
// Two shapes recur and are not obvious:
//   - `quartoYamlRegions`: a line START_CODE_CELL accepts opens a cell, and a `---` pair under an open cell is NOT a YAML region; a line it refuses leaves the pair as one
//     region. At column 0 the PLAIN fence recogniser (`^```) opens a fence of its own for the same line and swallows the pair just the same, so a row that must reach
//     START_CODE_CELL alone is either INDENTED (S03) or has no third backtick (S02).
//   - `findHeadings(text, "knitr")` with a paragraph line above the fence: a header knitr claims opens its fence even directly below a paragraph (its body is swallowed), and one
//     it refuses is paragraph text, so the heading under it is real. `{zzz9}` has a digit, so it is never a cell to this model and only the knitr claim can decide.

const regions = (text: string): string[] => quartoYamlRegions(text).map((r) => `${r.startLine}-${r.endLine}${r.terminated ? "T" : "U"}`);
const headings = (text: string, engine?: "markdown" | "jupyter" | "knitr"): string[] => findHeadings(text, engine).map((h) => h.text);

describe("START_CODE_CELL, the cell opener of the YAML-region scanner (Session 316)", () => {
  it.each<[string, string]>([
    ["a TAB (U+0009)", "\t"],
    ["a FORM FEED (U+000C)", "\f"],
    ["a NO-BREAK SPACE (U+00A0)", "\u00a0"],
  ])("S01 a cell fence indented by %s opens a cell, so the `---` pair below it is not a YAML region", (_name, indent) => {
    // The leading run is `\s*`, not spaces: a tab is the real-world case, the other two are whitespace that `[ \t]*` would also refuse.
    // A space-indented or column-0 fence cannot tell `\s*` from ` *`.
    expect(regions(`${indent}\`\`\`{r}\n---\n---`)).toEqual([]);
  });

  it("S02 a TWO-backtick `{r}` line is not a cell, so the `---` pair below it IS a YAML region", () => {
    // The fence run is three or more backticks. The plain recogniser needs three as well, so for two nothing opens a fence and the pair is a region.
    expect(regions("``{r}\n---\n---")).toEqual(["1-2T"]);
  });

  it.each<[string, string]>([
    ["a space", " "],
    ["a TAB (U+0009)", "\t"],
  ])("S03 an indented fence run, %s, then the brace opens a cell, so the `---` pair below it is not a YAML region", (_name, gap) => {
    // `\s*` between the run and the brace. INDENTED on purpose: at column 0 the plain fence opens for "``` {r}" and swallows the pair anyway.
    expect(regions(`  \`\`\`${gap}{r}\n---\n---`)).toEqual([]);
  });

  it("N01b the indent has no cap: four spaces (CommonMark's indented code) still open a cell", () => {
    expect(regions("    ```{r}\n---\n---")).toEqual([]);
  });

  it("N02 the fence run is three OR MORE backticks: an indented four-backtick cell opens too", () => {
    // Indented: at column 0 the plain recogniser opens a fence for four backticks as well.
    expect(regions("  ````{r}\n---\n---")).toEqual([]);
  });
});

describe("languagesInMarkdown, seen through the engine resolver (Session 316)", () => {
  // No front matter, no include shortcode and a `.qmd` name, so the languages alone decide: none gives markdown, `r` knitr, anything else jupyter.
  const engineOf = (text: string): string | undefined => resolveDocumentEngine("doc.qmd", text);

  it("L04 a two-backtick {python} header is not a fence, so it counts no language and the engine stays markdown", () => {
    expect(engineOf("``{python}\n")).toBe("markdown");
  });

  it("L07 an underscore is a language character, so a {my_lang} header counts as a language and the engine is jupyter", () => {
    expect(engineOf("```{my_lang}\n")).toBe("jupyter");
  });

  it("N04 the fence run is three OR MORE backticks: a four-backtick {python} header counts", () => {
    expect(engineOf("````{python}\n")).toBe("jupyter");
  });

  it("N05 a digit is a language character: {python3} counts as a language", () => {
    expect(engineOf("```{python3}\n")).toBe("jupyter");
  });

  it("N06 upper case is a language character, and the language is folded to lower case: {R} is knitr", () => {
    expect(engineOf("```{R}\n")).toBe("knitr");
  });
});

describe("the two .trim() calls on the indented-cell path of qmd/model.ts (Session 316)", () => {
  // An INDENTED cell fence (four spaces or more) is a cell to quarto although CommonMark calls it indented code. FENCE_OPEN's capture group 3 holds everything after the
  // backticks, so the info string of "    ```<TAB>{r}<TAB>" is "<TAB>{r}<TAB>": a blank before the brace and a blank after it, which only `.trim()` removes before CELL_INFO (`^\{...\}$`) judges it.
  // The two calls sit at two different places and are reached by two different documents (a paragraph above the fence decides which).
  const cellOptionLines = (text: string): Array<[number, number, string]> => findCellOptionLines(text).map((o) => [o.line, o.cellStartLine, o.cellLang]);

  it("C12 an indented cell fence with blanks around the braces is a cell: indentedCellFenceAt judges the TRIMMED info string", () => {
    // A paragraph line above keeps a paragraph open, so the free case of indentedCellFenceFor is NOT asked and only indentedCellFenceAt decides. The `#|` line is a cell option
    // line when the fence is a cell, and the cell swallows `## In`; the blank line above `## In` lets it be a heading if the fence were refused.
    const doc = "text\n    ```\t{r}\t\n#| echo: false\n\n## In\n\n```\n\n## Out\n";
    expect(cellOptionLines(doc)).toEqual([[2, 1, "r"]]);
    expect(headings(doc)).toEqual(["Out"]);
  });

  it("C13 the free-case language read of the same fence does not throw: indentedCellFenceFor reads the TRIMMED info string", () => {
    // Line 0 is the document start, so the free case IS asked and the language is read out of the info string. Untrimmed, CELL_INFO.exec finds nothing and the read throws a
    // TypeError out of every entry. Where `r` is the cell (no engine hint, knitr) the cell swallows `## In`; under `markdown` it is narrowed away and `## In` is a heading.
    const doc = "    ```\t{r}\t\n#| echo: false\n\n## In\n\n```\n\n## Out\n";
    expect(cellOptionLines(doc)).toEqual([[1, 0, "r"]]);
    expect(headings(doc)).toEqual(["Out"]);
    expect(headings(doc, "markdown")).toEqual(["In", "Out"]);
  });
});

describe("the knitr chunk claim of qmd/model.ts, seen at the paragraph gate (Session 316)", () => {
  // A paragraph line, a fence whose header is `{zzz9}` (a digit: never a cell to this model), a heading inside it, the closer, a heading after. Claimed, the fence opens and
  // swallows "# Inside"; refused, the opener is paragraph text and "# Inside" is a real heading. `INFO` is what follows the backticks on the opener line.
  const gate = (open: string, close = " ```"): string => ["Intro text", open, "", "# Inside", "", close, "", "# After"].join("\n");

  it("K00 control: a plain {zzz9} header below a paragraph IS claimed by knitr, so its fence swallows the heading inside it", () => {
    expect(headings(gate(" ```{zzz9}"), "knitr")).toEqual(["After"]);
    expect(headings(gate(" ```{zzz9}"), "jupyter")).toEqual(["Inside", "After"]); // only a knitr document claims it
  });

  it("K05 a header with text BEFORE the brace is not a chunk: the start anchor of KNITR_CHUNK_INFO", () => {
    expect(headings(gate(" ```x{zzz9}"), "knitr")).toEqual(["Inside", "After"]);
  });

  it("K10 a blank between the fence and the brace is trimmed at BOTH ends, so knitr still claims the chunk", () => {
    // fence[3] is " {zzz9}": trimEnd alone would leave the leading blank and `^\{` would refuse it.
    expect(headings(gate(" ``` {zzz9}"), "knitr")).toEqual(["After"]);
  });

  it("K13 a TILDE fence is never a knitr chunk (knitr's chunk.begin is backtick-only)", () => {
    expect(headings(gate(" ~~~{zzz9}", " ~~~"), "knitr")).toEqual(["Inside", "After"]);
  });

  it("K14 a BLOCK-QUOTED fence is never claimed (whether knitr claims a quoted chunk is unmeasured: declining is the safe direction)", () => {
    // Every line of the paragraph, the opener, the body and the closer is in the quote; the blank line then ends it.
    const quoted = ["> Intro text", "> ```{zzz9}", "> ", "> # Inside", "> ", "> ```", "", "# After"].join("\n");
    expect(headings(quoted, "knitr")).toEqual(["Inside", "After"]);
  });

  it("N11 text AFTER the closing brace is not a chunk header: the end anchor of KNITR_CHUNK_INFO", () => {
    expect(headings(gate(" ```{zzz9} x"), "knitr")).toEqual(["Inside", "After"]);
  });

  it.each<[string, string]>([
    ["a space", " "],
    ["a TAB (U+0009)", "\t"],
  ])("N12 %s AFTER the closing brace is trimmed too, so knitr still claims the chunk", (_name, blank) => {
    // The mirror of K10: trimStart alone would leave the trailing blank and `\}$` would refuse it.
    expect(headings(gate(` \`\`\`{zzz9}${blank}`), "knitr")).toEqual(["After"]);
  });
});
