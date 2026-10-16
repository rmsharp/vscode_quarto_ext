import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findCellOptionLines, findHeadings } from "../../src/core/qmd/model";
import { quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";

// Session 316 — pins for the NON-TAIL parts of the code-cell header regexes and call sites: START_CODE_CELL (`qmd/quarto-yaml-regions.ts`), the `fenceLanguage` regex inside
// `languagesInMarkdown` (`document-engine.ts`), and, in `qmd/model.ts`, INDENTED_CELL_FENCE_OPEN, the two `.trim()` calls on the indented-cell path and the knitr chunk claim
// (KNITR_CHUNK_INFO, `knitrClaims`). `cell-header-option-tail.test.ts` pins the option TAIL `([ ,].*)?`; nothing pinned the rest.
//
// Every row kills at least one MUTANT: a small edit to the source, applied alone by `tools/mutation-run/run.py` (read its README), with the mutant's id at the front of the title.
//   S01 S02 S03 L04 L07 C12 C13 K05 K10 K13 K14  the eleven edits of the BACKLOG item this drained ("The NON-TAIL parts of the four code-cell header literals ..."): Session 313's test
//                                                critic found that its suite let them live (four re-run on the final tree, seven measured by the reviewer and not re-run).
//                                                `tools/mutation-run/mutants/b90-cell-header.json`.
//   N01 ... N12                                  neighbours: the same literal part spelled another way (`[ \t]*` for `\s*`, `trimStart()` for `trim()`, an end anchor lost).
//                                                `tools/mutation-run/mutants/b90-neighbours.json`. Only N01b, N02, N04, N05, N06, N11 and N12 have a row of their own; N01 is killed
//                                                by the form feed and no-break space of S01, N03 by the tab of S03, N07 and N08 by C12, N09 and N10 by C13.
//   A-S* A-L* B-S* B-L* E01 L06 X* Y* W* Z* V* G*  the review round: 123 further edits invented by two adversarial reviewers, plus two from the claims audit and L06 from Session 313's
//                                                critic. 85 are killed by rows here (`b90-review.json`), 25 are killed only by OLDER test files (`b90-older-suite.json`, run with the
//                                                whole suite) and 16 are argued EQUIVALENT and survive on purpose (`b90-equivalent.json`, the argument in each `why`).
// A row can kill several mutants (S01, S03 and N12 are tables, and C12 and C13 use tab blanks, because one member of a class does not pin the class). K00 is a control with no
// mutant of the lists above: it fails when the `engine === "knitr"` term of `knitrClaims` goes or CELL_INFO's language class admits a digit (G2 and G5 of `b90-review.json`).
// The sampler bounds, never proves: a mutant nobody thought of can still live, and the runner cannot tell an edit that changes nothing from one no test sees.
//
// Every expected value is the answer of the tree these rows were written against (no source changed in the session), read through the same public entries the neighbouring rows
// use. A row was shown to PASS on that tree and to FAIL under its mutant. Run the lists with the command in `tools/mutation-run/README.md` (it passes `--tests`).
//
// Two shapes recur and are not obvious:
//   - `quartoYamlRegions`: a line START_CODE_CELL accepts opens a cell, and a `---` pair under an open cell is NOT a YAML region; a line it refuses leaves the pair as one
//     region. At column 0 the PLAIN fence recogniser (`^```) opens a fence of its own for the same line and swallows the pair just the same, so a row that must reach
//     START_CODE_CELL alone is either INDENTED (S03) or has no third backtick (S02).
//   - `findHeadings(text, "knitr")` with a paragraph line above the fence: a header knitr claims opens its fence even directly below a paragraph (its body is swallowed), and one
//     it refuses is paragraph text, so the heading under it is real. `{zzz9}` has a digit, so it is never a cell to this model and only the knitr claim can decide.

const regions = (text: string): string[] => quartoYamlRegions(text).map((r) => `${r.startLine}-${r.endLine}${r.terminated ? "T" : "U"}`);
const headings = (text: string, engine?: Parameters<typeof findHeadings>[1]): string[] => findHeadings(text, engine).map((h) => h.text);
const cellOptionLines = (text: string): Array<[number, number, string]> => findCellOptionLines(text).map((o) => [o.line, o.cellStartLine, o.cellLang]);

describe("START_CODE_CELL, the cell opener of the YAML-region scanner (Session 316)", () => {
  it.each<[string, string]>([
    ["a TAB (U+0009)", "\t"],
    ["a FORM FEED (U+000C)", "\f"],
    ["a NO-BREAK SPACE (U+00A0)", "\u00a0"],
  ])("S01 a cell fence indented by %s opens a cell, so the `---` pair below it is not a YAML region", (_name, indent) => {
    // The leading run is `\s*`, not spaces: a tab is the ASCII whitespace that is not a space, and the other two are whitespace that `[ \t]*` would also refuse.
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

  it("N01b a FOUR-space indent (CommonMark's indented code) still opens a cell", () => {
    expect(regions("    ```{r}\n---\n---")).toEqual([]);
  });

  it("N02 the fence run is three OR MORE backticks: an indented four-backtick cell opens too", () => {
    // Indented: at column 0 the plain recogniser opens a fence for four backticks as well.
    expect(regions("  ````{r}\n---\n---")).toEqual([]);
  });

  // The review round: the class, the gap, the bounds of the run and of the indent, the line anchors. Each row is one document and one answer.
  it.each<[string, string]>([
    ["A-S08 an upper-case language, R", "  ```{R}"],
    ["A-S09 the end of the upper-case range, Z", "  ```{Z}"],
    ["A-S10 the end of the lower-case range, z", "  ```{z}"],
    ["A-S14 a LEADING =, as in {=html}", "  ```{=html}"],
    ["A-S06 two blanks before the brace", "  ```  {r}"],
    ["A-S04 a five-backtick run", "  `````{r}"],
    ["B-S03 a nine-backtick run", "  `````````{r}"],
    ["B-S01 an eight-space indent", "        ```{r}"],
    ["B-S02 a language of more than two characters", "  ```{python}"],
  ])("%s opens a cell, so the `---` pair below it is not a YAML region", (_name, opener) => {
    expect(regions(`${opener}\n---\n---`)).toEqual([]);
  });

  it.each<[string, string]>([
    ["A-S01 text before the fence on its line", "text ```{r}"],
    ["A-S17 a block-quote marker before the fence", "> ```{r}"],
    ["A-S07 no opening brace", "  ```r}"],
    ["A-S11 an underscore in the language", "  ```{r_}"],
    ["A-S12 a [ after the language", "  ```{r[}"],
    ["A-S13 a ? after the language", "  ```{r?}"],
    ["A-S13 an @ after the language", "  ```{r@}"],
    ["A-S16 an empty language", "  ```{}"],
    ["A-S16 a blank before the language", "  ```{ r}"],
    ["A-S18 a U+2028 LINE SEPARATOR after the brace", "  ```{r}\u2028x"],
  ])("%s is not a cell, so the `---` pair below it IS a YAML region", (_name, opener) => {
    expect(regions(`${opener}\n---\n---`)).toEqual(["1-2T"]);
  });

  // The captured run is what the closer must match (`inCode = cellMatch[1].length`): a row that never closes the cell cannot see it.
  it.each<[string, string, string[]]>([
    ["A-S26 a three-backtick closer closes a three-backtick cell", "  ```{r}\n```", ["2-3T"]],
    ["A-S25 a four-backtick closer closes a four-backtick cell", "  ````{r}\n````", ["2-3T"]],
    ["A-S03 a THREE-backtick line does not close a FOUR-backtick cell", "  ````{r}\n```", []],
    ["A-S02 backticks inside the header do not count toward the run", "```{r,a=`x`}\n```", ["2-3T"]],
  ])("%s", (_name, head, expected) => {
    expect(regions(`${head}\n---\n---`)).toEqual(expected);
  });

  it("A-S19 the recogniser keeps no state between lines or between calls (a shared regex with a g flag would)", () => {
    expect(regions("---\n  ```{r}\n---\n  ```{r}\n---\n---")).toEqual(["0-2T"]);
    expect(regions("  ```{r}")).toEqual([]);
    expect(regions("  ```{r}\n---\n---")).toEqual([]);
  });
});

describe("languagesInMarkdown, seen through the engine resolver (Session 316)", () => {
  // No front matter, no include shortcode and a `.qmd` name, so the languages alone decide: none gives markdown, `r` knitr, `ojs`, `mermaid` and `dot` markdown, anything else jupyter.
  // A row about what precedes the fence needs the fence on line 2 or later: the resolver trims leading whitespace from the document first.
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

  it("N06 an upper-case R is folded to r: {R} is knitr", () => {
    expect(engineOf("```{R}\n")).toBe("knitr");
  });

  it.each<[string, string, string]>([
    ["A-L01 text before the fence on its line", "intro ```{python}\nmore\n", "markdown"],
    ["A-L09 two blanks before the brace", "intro\n```  {python}\n", "jupyter"],
    ["A-L10 a TAB before the brace", "intro\n```\t{python}\n", "jupyter"],
    ["A-L11 a six-backtick run", "intro\n``````{python}\n", "jupyter"],
    ["A-L12 no opening brace", "intro\n```python}\n", "markdown"],
    ["A-L13 the end of the lower-case range, z", "```{z}\n", "jupyter"],
    ["A-L14 the end of the upper-case range, Z", "```{Z}\n", "jupyter"],
    ["B-L01 a language of nine characters", "```{abcdefghi}\n", "jupyter"],
    ["A-L16 a language may start with a digit", "```{9lives}\n", "jupyter"],
    ["A-L17 a hyphen is not a language character", "```{my-lang}\n", "markdown"],
    ["L06 a NEWLINE between the fence run and the brace still counts (quarto's regex is context-free and `\\s` crosses lines)", "intro\n```\n{python}\n", "jupyter"],
    ["L06 a blank line between the fence run and the brace still counts", "intro\n```\n\n{python}\n", "jupyter"],
    ["L06 a FORM FEED between the fence run and the brace counts", "intro\n```\f{python}\n", "jupyter"],
    ["A-L19 an empty language is no language", "```{}\n", "markdown"],
    ["A-L19 a blank before the language is no language", "``` { python}\n", "markdown"],
    ["A-L31 languages keep first-appearance order: r, julia, r is knitr", "```{r}\n```{julia}\n```{r}\n", "knitr"],
    ["A-L35 every letter of {MERMAID} is folded, so it is the handler language", "```{MERMAID}\n", "markdown"],
    ["A-L35 every letter of {OJS} is folded, so it is the handler language", "```{OJS}\n", "markdown"],
  ])("%s", (_name, text, expected) => {
    expect(engineOf(text)).toBe(expected);
  });
});

describe("INDENTED_CELL_FENCE_OPEN, the indented cell opener of qmd/model.ts (Session 316 review round)", () => {
  // Not named by the BACKLOG item, but it is the literal the fence rewrites of the slow-input sweep touch, so its non-tail parts are pinned here.
  it("Y05 an indented FOUR-backtick cell is a cell (the run is three or more)", () => {
    const doc = "    ````{r}\n#| echo: false\n\n## In\n\n    ````\n\n## Out\n";
    expect(cellOptionLines(doc)).toEqual([[1, 0, "r"]]);
    expect(headings(doc)).toEqual(["Out"]);
  });

  it("Y07 a fence that does not start the line is no cell (the start anchor)", () => {
    const doc = "text ```{r}\n#| echo: false\n\n## In\n\n```\n\n## Out\n";
    expect(cellOptionLines(doc)).toEqual([]);
    expect(headings(doc)).toEqual(["In", "Out"]);
  });

  it("Y08 a U+2028 LINE SEPARATOR after the brace is no cell (the end anchor)", () => {
    const doc = "    ```{r}\u2028\n#| echo: false\n\n## In\n\n```\n\n## Out\n";
    expect(cellOptionLines(doc)).toEqual([]);
    expect(headings(doc)).toEqual(["In", "Out"]);
  });

  it("Y11 an indented TILDE fence is not a cell: only backticks open one", () => {
    expect(headings("    ~~~{a=b}\n\n# Inside\n\n~~~\n\n# After")).toEqual(["Inside", "After"]);
  });

  it("Y06 a TWO-backtick run is no cell opener either (jupyter hint)", () => {
    expect(headings("``{python}\n# Inside\n```\n\n# After\n", "jupyter")).toEqual(["After"]);
  });
});

describe("the two .trim() calls on the indented-cell path of qmd/model.ts (Session 316)", () => {
  // An INDENTED cell fence (four spaces or more) is a cell to quarto although CommonMark calls it indented code. INDENTED_CELL_FENCE_OPEN's capture group 3 holds everything after
  // the backticks, so the info string of "    ```<TAB>{r}<TAB>" is "<TAB>{r}<TAB>": a blank before the brace and a blank after it, which only `.trim()` removes before CELL_INFO
  // (`^\{...\}$`) judges it. The two calls sit at two different places and are reached by two different documents (a paragraph above the fence decides which). Only ASCII blanks are
  // pinned: JS `trim()` also strips a no-break space, which the BEGIN comment in model.ts says knitr does not treat as blank (a decision, filed in the BACKLOG).
  it("C12 an indented cell fence with blanks around the braces is a cell: indentedCellFenceAt judges the TRIMMED info string", () => {
    // A paragraph line above keeps a paragraph open, so the free case of indentedCellFenceFor answers false and only indentedCellFenceAt decides. The `#|` line is a cell option
    // line when the fence is a cell, and the cell swallows `## In`; the blank line above `## In` lets it be a heading if the fence were refused. (The C12 mutant also fails C13's row,
    // whose fence depends on the same trim; the C13 mutant fails only C13's.)
    const doc = "text\n    ```\t{r}\t\n#| echo: false\n\n## In\n\n```\n\n## Out\n";
    expect(cellOptionLines(doc)).toEqual([[2, 1, "r"]]);
    expect(headings(doc)).toEqual(["Out"]);
  });

  it("C13 the free-case language read of the same fence does not throw: indentedCellFenceFor reads the TRIMMED info string", () => {
    // Line 0 is the document start, so the free case answers true and the language is read out of the info string. Untrimmed, CELL_INFO.exec finds nothing and the read throws a
    // TypeError out of every entry. With no engine hint `r` is the cell and swallows `## In`; under `markdown` it is narrowed away and `## In` is a heading.
    const doc = "    ```\t{r}\t\n#| echo: false\n\n## In\n\n```\n\n## Out\n";
    expect(cellOptionLines(doc)).toEqual([[1, 0, "r"]]);
    expect(headings(doc)).toEqual(["Out"]);
    expect(headings(doc, "markdown")).toEqual(["In", "Out"]);
  });

  it("V02 a block-quoted cell shape is not a cell: the quote withhold at the info site", () => {
    // The opener and the body are in the quote and the closer is not, so the closer is a column-0 fence of its own and `# Inside` is a heading only if the opener was refused.
    expect(headings("> q\n> ```{R}\n>\n> # Inside\n>\n```\n\n# After")).toEqual(["Inside", "After"]);
  });
});

describe("the knitr chunk claim of qmd/model.ts, seen at the paragraph gate (Session 316)", () => {
  // A paragraph line, a fence whose header is `{zzz9}` (a digit: never a cell to this model), a heading inside it, the closer, a heading after. Claimed, the fence opens and
  // swallows "# Inside"; refused, the opener is paragraph text and "# Inside" is a real heading. `open` is the opener line and `close` the closer line.
  const gate = (open: string, close = " ```"): string => ["Intro text", open, "", "# Inside", "", close, "", "# After"].join("\n");

  it("K00 (a control, no mutant of its own) a plain {zzz9} header below a paragraph IS claimed by knitr, so its fence swallows the heading inside it", () => {
    expect(headings(gate(" ```{zzz9}"), "knitr")).toEqual(["After"]);
    expect(headings(gate(" ```{zzz9}"), "jupyter")).toEqual(["Inside", "After"]); // only a knitr document claims it
  });

  it("K05 a header with text BEFORE the brace is not a chunk: the start anchor of KNITR_CHUNK_INFO", () => {
    expect(headings(gate(" ```x{zzz9}"), "knitr")).toEqual(["Inside", "After"]);
  });

  it("K10 a blank BEFORE the brace is trimmed too, so knitr still claims the chunk", () => {
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

  it("E01 a LAZY line under a quoted paragraph: the opener is not quoted but its paragraph is, and knitr still claims it (stripQuote, not quoteOpen)", () => {
    // The header needs an option tail pandoc would refuse, or the claim and the refusal agree. Session 316's first record called this swap EQUIVALENT after 2,520 documents; two
    // reviewers found this one, in which `quoteOpen` is true on the lazy line and `stripQuote` is false.
    const lazy = ["> q", "```{zzz9, echo=FALSE}", "", "# Inside", "", "```", "", "# After"].join("\n");
    expect(headings(lazy, "knitr")).toEqual(["After"]);
    expect(headings(lazy, "jupyter")).toEqual(["Inside", "After"]); // only knitr claims it
  });

  it("W07 a FOUR-backtick chunk is claimed too (the run is three or more)", () => {
    expect(headings(gate(" ````{zzz9}", " ````"), "knitr")).toEqual(["After"]);
  });

  it("W06 a chunk fence inside a list item is claimed too", () => {
    const listed = ["- item", "```{zzz9, a=1}", "", "# Inside", "", "```", "", "# After"].join("\n");
    expect(headings(listed, "knitr")).toEqual(["After"]);
    expect(headings(listed, "jupyter")).toEqual(["Inside", "After"]);
  });

  it("W04 the AMBIGUOUS engine hint does not claim a chunk: only a document known to run knitr does", () => {
    expect(headings(gate(" ```{zzz9}"), "ambiguous")).toEqual(["Inside", "After"]);
  });

  it("Z04 an upper-case letter after the first is a chunk-header character", () => {
    expect(headings(gate(" ```{zZz9}"), "knitr")).toEqual(["After"]);
  });
});
