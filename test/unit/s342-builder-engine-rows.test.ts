import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Cell, buildOutline, findAllCells, findCellAtPosition, findCellOptionLines, type OutlineSymbol } from "../../src/core/qmd/model";
import { TYPE_IGNORE_DIRECTIVE, createCellVdocBuilder, createRangeLookup, embeddedCellAt } from "../../src/core/embedded/virtual-doc";
import { cellLanguageId } from "../../src/core/embedded/lang-map";
import type { RenderMode } from "../../src/core/render-mode";
import { seededRandom } from "./support/regex-equivalence";

// What `createCellVdocBuilder` ASKS of the model is counted (the describe "what createCellVdocBuilder asks of the model" below), so the model's exports `findAllCells` and `findCellOptionLines` are replaced by
// wrappers that call through and, while `asked.on` is set, write down the arguments of each call (the pattern of `s342-range-lookup-counts.test.ts`). Every other row of this file reads the real answers: the
// wrappers change nothing they return, and `asked.on` is off outside that one describe. The model's own calls (`buildOutline` scanning, `findCellOptionLines` reading `findAllCells`) are inside its module
// and are not seen by the wrappers: only the calls the builder makes through the module's exports are.
const asked = vi.hoisted(() => ({ on: false, cells: [] as unknown[][], options: [] as unknown[][] }));
vi.mock("../../src/core/qmd/model", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/core/qmd/model")>();
  return {
    ...real,
    findAllCells: (...args: Parameters<typeof real.findAllCells>) => {
      if (asked.on) asked.cells.push(args);
      return real.findAllCells(...args);
    },
    findCellOptionLines: (...args: Parameters<typeof real.findCellOptionLines>) => {
      if (asked.on) asked.options.push(args);
      return real.findCellOptionLines(...args);
    },
  };
});

// Session 342 -- the BACKLOG item "What Session 341's review round found beside the Outline and preview cures", part (5). `createCellVdocBuilder(text)` read its cells with the engine-BLIND `findAllCells(text)`, but the Outline
// provider has just built its symbols with `buildOutline(text, engine, mode)`, whose scan is cached under (text, engine, mode). For any document whose engine is not `undefined` the builder's preparation was a SECOND full scan
// (about 13 ms at 2,000 cells, 52 ms at 8,000, on every Outline pass), and the two scans can disagree about the cells: the builder is asked for `cellAt(symbol.startLine)` for the symbols of the engine-AWARE list. Where they
// differ the cell comes back null (nothing forwarded) or is ANOTHER cell, so the symbols of the wrong cell's body are attributed to this one (the BACKLOG item "R6 residuals", sub-bullet (g)).
//
// `createCellVdocBuilder(text, engine, mode)` reads its cells and its option lines from the very scan `buildOutline(text, engine, mode)` made. This file holds the ANSWER rows: the engine-blind answers are unchanged when the engine
// is omitted, and when it is given every cell symbol the Outline reports is a cell the builder finds, the very object of the Outline's scan, built into a vdoc that holds this cell's own body and nothing else.

/** What the caller knows about the document's engine: the strings the model reads (`undefined`: it does not know). */
type Engine = "knitr" | "jupyter" | "markdown" | "julia" | "ambiguous" | undefined;

const flatten = (symbols: OutlineSymbol[]): OutlineSymbol[] => symbols.flatMap((s) => (s.kind === "cell" ? [s] : flatten(s.children)));
const cellSymbols = (text: string, engine: Engine, mode?: RenderMode): OutlineSymbol[] => flatten(buildOutline(text, engine, mode));
const span = (cell: { startLine: number; endLine: number; lang?: string }): string => `${cell.lang ?? ""}[${cell.startLine}-${cell.endLine}]`;
const D = TYPE_IGNORE_DIRECTIVE;
const nl = (k: number): string => "\n".repeat(k);

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE DOCUMENTS. Each is read through its own line numbers. The lists in the comments are what the engine-blind scan and the engine-aware scan make of it (`findAllCells(text)` and the cell symbols of
// `buildOutline(text, engine, mode)`): they disagree on every one of these, and the disagreement is the point.

/** A stray bare fence above a hidden chunk (R6, Session 275, rendered: knitr consumes the chunk's closer, so the stray fence is never closed and the heading below it is real). */
const stray = (chunk: string): string => ["prose", "", "```", "", "## Heading Under Test", "", ...chunk.split("\n"), "", "## Heading After Chunk", "", "tail prose", ""].join("\n");

/** knitr: blind [] (the stray fence pairs with the chunk's closer); aware r[6-8]. */
const STRAY_R = stray("```{r demo, echo=FALSE}\nplot(pressure)\n```");
/** knitr: blind []; aware python[6-9]; line 7 is an option line. */
const STRAY_PY = stray("```{python}\n#| echo: false\nx = 1\n```");
/** knitr: blind []; aware python[5-6] (a chunk with no code emits no fence). */
const STRAY_EMPTY = ["---", "title: t", "---", "", "```", "```{python}", "```"].join("\n");
/** jupyter: blind python[0-2] (the closer at column 0 closes an opener at any indent); aware r[1-2] (a kernel cell closes only on its own indent, so the indent-3 opener is dropped). */
const INDENT_JUPYTER = "   ```{python}\n```{r}\n```\n```{ojs}";
/** markdown: blind python[4-6] python[10-13]; aware python[4-6] (an indented non-handler `{python}` line is no cell there). */
const INDENT_MARKDOWN = ["---", "engine: markdown", "---", "", "```{python}", "1 + 1", "```", "", "prose", "", "    ```{python}", "## In", "x = 1", "    ```", "", "## After", ""].join("\n");
/** knitr, a setup chunk that silences the chunks below it only when the document EXECUTES (Session 310). Executing: blind r[4-6] r[19-21]; aware r[4-6] r[14-15] r[19-21]. Under --no-execute: aware r[4-6] only. */
const SETUP_CALL = [
  "---", "title: t", "---", "", "```{r setup, include=FALSE}", "knitr::opts_chunk$set(echo = F)", "```", "", "# Top", "", "```", "", "## Between", "", "```{r}", "```", "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", "",
].join("\n");

/** knitr, the same shape with a `#| eval: false` line in the empty chunk. Executing: blind r[4-6] r[20-22]; aware r[4-6] r[14-16] r[20-22], and line 15 is the option line of the chunk the blind scan never saw. Under --no-execute: aware r[4-6] only. */
const SETUP_OPTION = [
  "---", "title: t", "---", "", "```{r setup, include=FALSE}", "knitr::opts_chunk$set(echo = F)", "```", "", "# Top", "", "```", "", "## Between", "", "```{r}", "#| eval: false", "```", "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", "",
].join("\n");

/**
 * jupyter, an INDENTED python opener whose cell holds a `#|` line at column 0: blind python[0-3] (line 1 is its option line, and line 2 is a body line of it); aware r[2-3] (a kernel cell closes only on its own indent, so
 * the indent-3 opener is dropped, and with it the cell the `#|` line was an option of: no option line at all). Lines: 0 opener | 1 `#| echo: false` | 2 `{r}` opener | 3 closer | 4 `{ojs}` opener, never closed.
 */
const JUPYTER_OPTION = "   ```{python}\n#| echo: false\n```{r}\n```\n```{ojs}";
/**
 * engine markdown, an indent-4 python opener whose cell holds a `#|` line at column 0, and a cell at column 0 below it: blind python[4-7] python[9-11], option line 5; aware python[9-11], no option line (an indented
 * non-handler cell is no cell there). Lines: 0-2 front matter | 3 | 4 opener | 5 `#| echo: false` | 6 `x = 1` | 7 indent-4 closer | 8 | 9 opener | 10 `y = 2` | 11 closer | 12.
 */
const MARKDOWN_OPTION = ["---", "engine: markdown", "---", "", "    ```{python}", "#| echo: false", "x = 1", "    ```", "", "```{python}", "y = 2", "```", ""].join("\n");
/**
 * jupyter, a python cell at COLUMN 0 whose body holds an indented line shaped like a closer: blind python[4-6] (the any-indent scan closes at line 6, so the cell is a truncated copy of itself); aware python[4-10] (a
 * kernel cell closes only on its own indent, here none). The opener is the SAME and the extent differs, so the two vdocs of this cell share the key `cellStartLine` 4 and hold different text.
 * Lines: 0-2 front matter | 3 | 4 opener | 5 `s = '''` | 6 two spaces and a fence | 7 `'''` | 8 `def after():` | 9 `    pass` | 10 closer.
 */
const CLOSER_JUPYTER = ["---", "jupyter: python3", "---", "", "```{python}", "s = '''", "  ```", "'''", "def after():", "    pass", "```"].join("\n");

interface Named {
  name: string;
  text: string;
  engine: Engine;
  mode?: RenderMode;
  blind: string;
  aware: string;
}

const NAMED: Named[] = [
  { name: "a stray fence above a silent r chunk", text: STRAY_R, engine: "knitr", blind: "", aware: "r[6-8]" },
  { name: "a stray fence above a silent python chunk with a #| line", text: STRAY_PY, engine: "knitr", blind: "", aware: "python[6-9]" },
  { name: "a stray fence above a python chunk with no code", text: STRAY_EMPTY, engine: "knitr", blind: "", aware: "python[5-6]" },
  { name: "an indent-3 python opener under jupyter, an r cell below it", text: INDENT_JUPYTER, engine: "jupyter", blind: "python[0-2]", aware: "r[1-2]" },
  { name: "an indent-4 python cell under engine markdown", text: INDENT_MARKDOWN, engine: "markdown", blind: "python[4-6] python[10-13]", aware: "python[4-6]" },
  { name: "a setup chunk, executing", text: SETUP_CALL, engine: "knitr", mode: "execute", blind: "r[4-6] r[19-21]", aware: "r[4-6] r[14-15] r[19-21]" },
  { name: "the same setup chunk, --no-execute", text: SETUP_CALL, engine: "knitr", mode: "no-execute", blind: "r[4-6] r[19-21]", aware: "r[4-6]" },
  { name: "a setup chunk and a chunk with a #| line, executing", text: SETUP_OPTION, engine: "knitr", mode: "execute", blind: "r[4-6] r[20-22]", aware: "r[4-6] r[14-16] r[20-22]" },
  { name: "the same two chunks, --no-execute", text: SETUP_OPTION, engine: "knitr", mode: "no-execute", blind: "r[4-6] r[20-22]", aware: "r[4-6]" },
  { name: "an indent-3 python opener with a #| line under jupyter, an r cell below it", text: JUPYTER_OPTION, engine: "jupyter", blind: "python[0-3]", aware: "r[2-3]" },
  { name: "an indent-4 python opener with a #| line under engine markdown, a python cell below it", text: MARKDOWN_OPTION, engine: "markdown", blind: "python[4-7] python[9-11]", aware: "python[9-11]" },
  { name: "a column-0 python cell under jupyter with an indented closer-shaped line in its body", text: CLOSER_JUPYTER, engine: "jupyter", blind: "python[4-6]", aware: "python[4-10]" },
];

describe("the documents are what the rows below say they are (the Session 342 premise: the two scans disagree on each of them)", () => {
  it.each(NAMED.map((row) => [row.name, row] as const))("%s: the blind list and the Outline's list are the stated ones", (_name, row) => {
    expect(findAllCells(row.text).map(span).join(" ")).toBe(row.blind);
    expect(cellSymbols(row.text, row.engine, row.mode).map(span).join(" ")).toBe(row.aware);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE MODEL. `findAllCells` and `findCellOptionLines` take an optional engine and mode, last: omitted is today's engine-blind answer, byte for byte (every other suite of the model is the oracle for that), given is the very
// list `buildOutline(text, engine, mode)` reports.

describe("Session 342 -- findAllCells and findCellOptionLines read the scan the Outline reads when they are given its engine and mode", () => {
  it("omitted, or undefined, the engine-blind list: the stray fence pairs with the chunk's closer and no cell is found", () => {
    expect(findAllCells(STRAY_R)).toEqual([]);
    expect(findAllCells(STRAY_R, undefined)).toEqual([]);
    expect(findAllCells(STRAY_R, undefined, "execute")).toEqual([]);
  });

  it("given knitr, the list the Outline reports: the silent chunk is a cell", () => {
    expect(findAllCells(STRAY_R, "knitr")).toEqual([{ startLine: 6, endLine: 8, lang: "r", code: "plot(pressure)" }]);
    expect(findAllCells(STRAY_PY, "knitr")).toEqual([{ startLine: 6, endLine: 9, lang: "python", code: "#| echo: false\nx = 1" }]);
  });

  it.each(NAMED.map((row) => [row.name, row] as const))("%s: given its engine and mode the list is the Outline's", (_name, row) => {
    expect(findAllCells(row.text, row.engine, row.mode).map(span).join(" ")).toBe(row.aware);
  });

  it("the mode is read: the same text and engine, two modes, two lists, and omitted is executing", () => {
    expect(findAllCells(SETUP_CALL, "knitr", "execute").map(span).join(" ")).toBe("r[4-6] r[14-15] r[19-21]");
    expect(findAllCells(SETUP_CALL, "knitr", "no-execute").map(span).join(" ")).toBe("r[4-6]");
    expect(findAllCells(SETUP_CALL, "knitr").map(span).join(" ")).toBe("r[4-6] r[14-15] r[19-21]");
  });

  it("the option lines follow the list: none in the blind scan of the stray fence, the chunk's #| line in the aware one", () => {
    expect(findCellOptionLines(STRAY_PY)).toEqual([]);
    expect(findCellOptionLines(STRAY_PY, undefined, "execute")).toEqual([]);
    expect(findCellOptionLines(STRAY_PY, "knitr").map((o) => o.line)).toEqual([7]);
    expect(findCellOptionLines(STRAY_PY, "knitr", "no-execute").map((o) => o.line)).toEqual([7]);
  });

  it("the option lines follow the mode too: the #| line of a chunk that exists only when the document executes", () => {
    expect(findCellOptionLines(SETUP_OPTION, "knitr", "execute").map((o) => o.line)).toEqual([15]);
    expect(findCellOptionLines(SETUP_OPTION, "knitr").map((o) => o.line)).toEqual([15]);
    expect(findCellOptionLines(SETUP_OPTION, "knitr", "no-execute")).toEqual([]);
    expect(findCellOptionLines(SETUP_OPTION)).toEqual([]);
  });

  it("the option lines of an indented opener: its #| line is an option line of the cell the blind scan finds, and of no cell to the scan of the engine that drops that cell", () => {
    const lines = (text: string, engine?: Engine): number[] => findCellOptionLines(text, engine).map((o) => o.line);
    // JUPYTER_OPTION: the #| line is line 1
    expect(lines(JUPYTER_OPTION)).toEqual([1]);
    expect(lines(JUPYTER_OPTION, undefined)).toEqual([1]);
    for (const engine of ["ambiguous", "julia", "knitr", "markdown"] as const) expect(lines(JUPYTER_OPTION, engine)).toEqual([1]);
    expect(lines(JUPYTER_OPTION, "jupyter")).toEqual([]);
    // MARKDOWN_OPTION: the #| line is line 5
    expect(lines(MARKDOWN_OPTION)).toEqual([5]);
    expect(lines(MARKDOWN_OPTION, undefined)).toEqual([5]);
    for (const engine of ["ambiguous", "julia", "knitr", "jupyter"] as const) expect(lines(MARKDOWN_OPTION, engine)).toEqual([5]);
    expect(lines(MARKDOWN_OPTION, "markdown")).toEqual([]);
  });

  it("the option line carries the cell it belongs to: the indented opener's start line", () => {
    expect(findCellOptionLines(JUPYTER_OPTION)).toEqual([expect.objectContaining({ line: 1, cellStartLine: 0 })]);
    expect(findCellOptionLines(MARKDOWN_OPTION)).toEqual([expect.objectContaining({ line: 5, cellStartLine: 4 })]);
  });

  it("an engine that changes nothing (ambiguous, julia, undefined) reads the blind list", () => {
    for (const row of NAMED) {
      for (const engine of ["ambiguous", "julia", undefined] as const) {
        expect(findAllCells(row.text, engine).map(span)).toEqual(findAllCells(row.text).map(span));
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE BUILDER, with its engine omitted: unchanged. These rows pass on the parent (the builder ignored what it was not given) and say what the optional parameters must not move.

describe("Session 342 -- createCellVdocBuilder with no engine and no mode answers what it always answered", () => {
  it.each(NAMED.map((row) => [row.name, row] as const))("%s: every line is asked, and the cell found is the blind scan's", (_name, row) => {
    const blind = createCellVdocBuilder(row.text);
    const explicit = createCellVdocBuilder(row.text, undefined, undefined);
    const total = row.text.split("\n").length;
    for (let line = -1; line <= total + 1; line++) {
      const expected = findAllCells(row.text).find((c) => c.startLine <= line && line <= c.endLine) ?? null;
      expect(blind.cellAt(line)).toEqual(expected);
      expect(explicit.cellAt(line)).toEqual(expected);
    }
  });

  it("the blind builder gives the python cell its lines on the jupyter document: the vdoc the Outline used to forward for the r symbol", () => {
    const blind = createCellVdocBuilder(INDENT_JUPYTER);
    const cell = blind.cellAt(1);
    expect(cell).toEqual({ startLine: 0, endLine: 2, lang: "python", code: "```{r}" });
    expect(blind.build(cell as Cell)).toBe(`${D}\n\`\`\`{r}${nl(2)}`);
  });

  it("an engine given for a document the two scans read alike changes no answer", () => {
    const text = "p\n```{python}\n#| echo: false\nx = 1\n```\n```{r}\ny\n```\n";
    for (const engine of ["knitr", "jupyter", "markdown", "julia", "ambiguous"] as const) {
      const blind = createCellVdocBuilder(text);
      const given = createCellVdocBuilder(text, engine, "execute");
      for (const cell of findAllCells(text)) {
        expect(given.cellAt(cell.startLine)).toEqual(blind.cellAt(cell.startLine));
        expect(given.build(cell)).toBe(blind.build(cell));
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE OPTION LINES OF THE ENGINE-BLIND CONSUMERS. `embeddedCellAt`, the range lookup and the blind builder never pass an engine, so they read the blind list and the blind option lines: a `#|` line at column 0 under an
// INDENTED opener is an option line there (it belongs to YAML and is never forwarded as code), and it is that only because `findCellOptionLines` defaults to the blind list. A default of `jupyter` or `markdown`
// would drop the indented opener's cell from the option lines and leave its `#|` line a line of code.

describe("Session 342 -- the engine-blind consumers keep the #| line of an indented opener an option line, and the aware builder drops the cell that holds it", () => {
  const PYTHON = { lang: "python", languageId: "python", ext: "py" };

  it("jupyter document, embeddedCellAt and the range lookup: the #| line is not forwarded as code; the line below it is a body line of the cell the blind scan finds", () => {
    // 0 indent-3 python opener | 1 `#| echo: false` | 2 `{r}` opener | 3 closer | 4 `{ojs}` opener. The blind scan reads line 2 as python code: the parent's answer, kept.
    const lookup = createRangeLookup(JUPYTER_OPTION);
    expect(embeddedCellAt(JUPYTER_OPTION, 1)).toBeNull();
    expect(lookup.hitAt(1)).toBeNull();
    expect(embeddedCellAt(JUPYTER_OPTION, 2)).toEqual(PYTHON);
    expect(lookup.hitAt(2)).toEqual(PYTHON);
    expect(lookup.rangeInLanguageBody(1, 1, "python")).toBe(false);
    expect(lookup.rangeInLanguageBody(1, 2, "python")).toBe(false);
    expect(lookup.rangeInLanguageBody(2, 2, "python")).toBe(true);
    const [cell] = findAllCells(JUPYTER_OPTION);
    expect(lookup.rangeInCellBody(1, 2, cell)).toBe(false);
    expect(lookup.rangeInCellBody(2, 2, cell)).toBe(true);
  });

  it("markdown document, embeddedCellAt and the range lookup: the #| line of the indent-4 cell is not forwarded, the line below it is", () => {
    // 4 indent-4 opener | 5 `#| echo: false` | 6 `x = 1` | 7 indent-4 closer | 9 opener | 10 `y = 2` | 11 closer
    const lookup = createRangeLookup(MARKDOWN_OPTION);
    for (const line of [4, 5, 7, 8, 9, 11]) {
      expect(embeddedCellAt(MARKDOWN_OPTION, line)).toBeNull();
      expect(lookup.hitAt(line)).toBeNull();
    }
    for (const line of [6, 10]) {
      expect(embeddedCellAt(MARKDOWN_OPTION, line)).toEqual(PYTHON);
      expect(lookup.hitAt(line)).toEqual(PYTHON);
    }
    const [indented] = findAllCells(MARKDOWN_OPTION);
    expect(lookup.rangeInCellBody(5, 6, indented)).toBe(false);
    expect(lookup.rangeInCellBody(6, 6, indented)).toBe(true);
  });

  it("the blind builder blanks the #| line of the indented opener's cell: the vdoc keeps the line below it and the python mute", () => {
    const jupyter = createCellVdocBuilder(JUPYTER_OPTION);
    const jupyterCell = jupyter.cellAt(1) as Cell;
    expect(jupyterCell).toEqual({ startLine: 0, endLine: 3, lang: "python", code: "#| echo: false\n```{r}" });
    expect(jupyter.build(jupyterCell)).toBe(`${D}${nl(2)}\`\`\`{r}${nl(2)}`); // 5 lines: the mute, the emptied #| line, the `{r}` line kept, two empty
    const markdown = createCellVdocBuilder(MARKDOWN_OPTION);
    const markdownCell = markdown.cellAt(5) as Cell;
    expect(markdownCell).toEqual({ startLine: 4, endLine: 7, lang: "python", code: "#| echo: false\nx = 1" });
    expect(markdown.build(markdownCell)).toBe(`${D}${nl(6)}x = 1${nl(6)}`); // 13 lines: `x = 1` is line 6
  });

  it("the builder given jupyter: the indented python cell and its #| line are not in the Outline's list, so the line is in no cell and the r cell is the only one", () => {
    const aware = createCellVdocBuilder(JUPYTER_OPTION, "jupyter");
    expect(aware.cellAt(0)).toBeNull();
    expect(aware.cellAt(1)).toBeNull();
    expect(aware.cellAt(2)).toEqual({ startLine: 2, endLine: 3, lang: "r", code: "" });
    expect(aware.build(aware.cellAt(2) as Cell)).toBe(nl(4));
  });

  it("the builder given markdown: the indent-4 cell and its #| line are not in the Outline's list; the cell at column 0 is, built with its own body only", () => {
    const aware = createCellVdocBuilder(MARKDOWN_OPTION, "markdown");
    for (const line of [4, 5, 6, 7]) expect(aware.cellAt(line)).toBeNull();
    const cell = aware.cellAt(10) as Cell;
    expect(cell).toEqual({ startLine: 9, endLine: 11, lang: "python", code: "y = 2" });
    expect(aware.build(cell)).toBe(`${D}${nl(10)}y = 2${nl(2)}`); // 13 lines: `y = 2` is line 10
    // the blind builder holds the indent-4 cell too, whose vdoc is the line `x = 1` and nothing of the cell at column 0
    expect(createCellVdocBuilder(MARKDOWN_OPTION).build(findAllCells(MARKDOWN_OPTION)[0])).not.toBe(aware.build(cell));
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE THIRD CLASS. A cell at column 0 under jupyter whose body holds an indented line shaped like a closer: the OPENER is the same in the two lists and the EXTENT differs, so the blind lookup answered a truncated
// copy of the Outline's own cell, under the same `cellStartLine` key as the aware one (the key `outline.ts` files a vdoc under), and the symbols after the fake closer were lost.

describe("Session 342 -- a column-0 python cell under jupyter with an indented closer-shaped line in its body: the same opener, a longer extent, one key and two vdocs", () => {
  it("the blind builder finds the cell cut at the indented line; the builder given jupyter finds it whole", () => {
    // 4 opener | 5 `s = '''` | 6 two spaces and a fence | 7 `'''` | 8 `def after():` | 9 `    pass` | 10 closer
    const blind = createCellVdocBuilder(CLOSER_JUPYTER);
    const aware = createCellVdocBuilder(CLOSER_JUPYTER, "jupyter");
    expect(blind.cellAt(5)).toEqual({ startLine: 4, endLine: 6, lang: "python", code: "s = '''" });
    expect(aware.cellAt(5)).toEqual({ startLine: 4, endLine: 10, lang: "python", code: "s = '''\n  ```\n'''\ndef after():\n    pass" });
    expect(blind.cellAt(8)).toBeNull(); // a symbol of `def after()` is looked up here, and the blind list holds no cell
    expect(aware.cellAt(8)?.startLine).toBe(4);
  });

  it("the two vdocs share the cell's start line and hold different text: the blind one has lost `def after()`", () => {
    const blind = createCellVdocBuilder(CLOSER_JUPYTER);
    const aware = createCellVdocBuilder(CLOSER_JUPYTER, "jupyter");
    const blindCell = blind.cellAt(5) as Cell;
    const awareCell = aware.cellAt(5) as Cell;
    expect(blindCell.startLine).toBe(awareCell.startLine);
    expect(blindCell.endLine).not.toBe(awareCell.endLine);
    // 11 lines; the mute on line 0; the body lines 5 to 9 (the kept lines of the aware cell), only line 5 for the blind one
    expect(blind.build(blindCell)).toBe(`${D}${nl(5)}s = '''${nl(5)}`);
    expect(aware.build(awareCell)).toBe(`${D}${nl(5)}s = '''\n  \`\`\`\n'''\ndef after():\n    pass${nl(1)}`);
    expect(aware.build(awareCell)).toContain("def after():");
    expect(blind.build(blindCell)).not.toContain("def after():");
  });

  it("the Outline reports the whole cell: its symbol and the builder given jupyter agree on the extent", () => {
    const [symbol] = cellSymbols(CLOSER_JUPYTER, "jupyter");
    expect([symbol.startLine, symbol.endLine]).toEqual([4, 10]);
    expect(createCellVdocBuilder(CLOSER_JUPYTER, "jupyter").cellAt(symbol.startLine)).toMatchObject({ startLine: 4, endLine: 10 });
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE BUILDER, given the engine. The cell symbols of `buildOutline(text, engine, mode)` are looked up by their start line, and each must be found, as the same cell, in the scan the Outline made.

describe("Session 342 -- createCellVdocBuilder given the engine and mode finds every cell the Outline reports", () => {
  it("a stray fence above a silent r chunk: the chunk is a cell, its body and fences are in it, the stray fence and the heading are not", () => {
    const builder = createCellVdocBuilder(STRAY_R, "knitr", "execute");
    for (const line of [6, 7, 8]) expect(builder.cellAt(line)).toEqual({ startLine: 6, endLine: 8, lang: "r", code: "plot(pressure)" });
    for (const line of [0, 2, 4, 5, 9, 10, 13, 14]) expect(builder.cellAt(line)).toBeNull();
    // 14 lines; the body line is line 7; an r cell takes no mute
    expect(builder.build(builder.cellAt(6) as Cell)).toBe(`${nl(7)}plot(pressure)${nl(6)}`);
  });

  it("a stray fence above a silent python chunk: the vdoc blanks the chunk's #| line (an option line of the SAME scan), keeps its body and takes the mute", () => {
    const builder = createCellVdocBuilder(STRAY_PY, "knitr");
    const cell = builder.cellAt(7) as Cell;
    expect(cell).toEqual({ startLine: 6, endLine: 9, lang: "python", code: "#| echo: false\nx = 1" });
    // 15 lines: the mute on line 0, the option line (7) empty, `x = 1` on line 8
    expect(builder.build(cell)).toBe(`${D}${nl(8)}x = 1${nl(6)}`);
    expect(builder.build(cell).split("\n")).toHaveLength(STRAY_PY.split("\n").length);
  });

  it("a stray fence above a python chunk with no code", () => {
    const builder = createCellVdocBuilder(STRAY_EMPTY, "knitr", "execute");
    expect(builder.cellAt(5)).toEqual({ startLine: 5, endLine: 6, lang: "python", code: "" });
    expect(builder.cellAt(4)).toBeNull();
    expect(builder.build(builder.cellAt(6) as Cell)).toBe(nl(6));
  });

  it("under jupyter the indent-3 opener is dropped: the r cell is the cell at line 1, and its vdoc holds none of the python cell's lines", () => {
    const aware = createCellVdocBuilder(INDENT_JUPYTER, "jupyter");
    expect(aware.cellAt(1)).toEqual({ startLine: 1, endLine: 2, lang: "r", code: "" });
    expect(aware.cellAt(0)).toBeNull();
    expect(aware.cellAt(3)).toBeNull();
    expect(aware.build(aware.cellAt(1) as Cell)).toBe(nl(3)); // an r cell with no code: four empty lines
  });

  it("under engine markdown the indent-4 python line is no cell, and the cell above it is", () => {
    const aware = createCellVdocBuilder(INDENT_MARKDOWN, "markdown");
    for (const line of [10, 11, 12, 13]) expect(aware.cellAt(line)).toBeNull();
    expect(aware.cellAt(5)).toEqual({ startLine: 4, endLine: 6, lang: "python", code: "1 + 1" });
  });

  it("the mode is read: executing, the empty chunk and the last chunk are cells; under --no-execute the stray fence swallows them", () => {
    const executing = createCellVdocBuilder(SETUP_CALL, "knitr", "execute");
    const noExecute = createCellVdocBuilder(SETUP_CALL, "knitr", "no-execute");
    const omitted = createCellVdocBuilder(SETUP_CALL, "knitr");
    expect([4, 14, 19].map((line) => executing.cellAt(line)?.startLine ?? null)).toEqual([4, 14, 19]);
    expect([4, 14, 19].map((line) => noExecute.cellAt(line)?.startLine ?? null)).toEqual([4, null, null]);
    expect([4, 14, 19].map((line) => omitted.cellAt(line)?.startLine ?? null)).toEqual([4, 14, 19]);
  });

  it("the option lines of the chunk only the aware scan sees are blanked in its vdoc, and are code in the blind scan's", () => {
    const aware = createCellVdocBuilder(SETUP_OPTION, "knitr", "execute");
    const cell = aware.cellAt(15) as Cell;
    expect(cell).toEqual({ startLine: 14, endLine: 16, lang: "r", code: "#| eval: false" });
    expect(aware.build(cell)).toBe(nl(SETUP_OPTION.split("\n").length - 1)); // an r cell whose only line is an option line: 26 empty lines
    // the blind builder has no such cell, and a hand-made copy of it is built with line 15 kept as code, because the blind scan does not know it is an option line
    const blind = createCellVdocBuilder(SETUP_OPTION);
    expect(blind.cellAt(15)).toBeNull();
    expect(blind.build(cell)).toBe(`${nl(15)}#| eval: false${nl(10)}`);
  });

  it("a mode with no knitr in it is no mode: --no-execute for jupyter reads the executing list", () => {
    const given = createCellVdocBuilder(INDENT_JUPYTER, "jupyter", "no-execute");
    expect(given.cellAt(1)).toEqual({ startLine: 1, endLine: 2, lang: "r", code: "" });
  });

  it("the cell the builder finds is the very object of the Outline's scan, not a copy of an equal one from a second scan", () => {
    const outline = cellSymbols(INDENT_MARKDOWN, "markdown");
    expect(outline.map(span)).toEqual(["python[4-6]"]);
    const scanned = findAllCells(INDENT_MARKDOWN, "markdown");
    const aware = createCellVdocBuilder(INDENT_MARKDOWN, "markdown").cellAt(4);
    expect(aware).toBe(scanned[0]);
    // and the control: the blind scan holds an equal cell of its own, a different object, so an identity test can tell the two apart
    const blindCell = createCellVdocBuilder(INDENT_MARKDOWN).cellAt(4);
    expect(blindCell).toEqual(aware);
    expect(blindCell).not.toBe(aware);
    expect(blindCell).toBe(findAllCells(INDENT_MARKDOWN)[0]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CALLS. The rows above say what the builder ANSWERS; these say what it ASKS the model, because a spelling that asks more (a second scan under another cache key, an engine-blind read beside the aware one) answers
// the same and costs a scan: the preparation after `buildOutline(text, engine, mode)` is a cache hit only when the builder asks for exactly the (text, engine, mode) the Outline scanned, and once. Counted, so the
// rows pin the CALLS and not a time. (The extra engine-blind read is a real scan only when the engine-blind list of the text is not already cached: `resolveDocumentEngine` reads the same text engine-blind
// first, so for a text with no leading whitespace it is a hit there. Whether it costs is the cache's business; that it is asked at all is the builder's.)

describe("Session 342 -- what createCellVdocBuilder asks of the model", () => {
  const TEXT = STRAY_PY;
  const ENGINES: Engine[] = [undefined, "ambiguous", "knitr", "jupyter", "markdown", "julia"];
  const MODES: Array<RenderMode | undefined> = [undefined, "execute", "no-execute"];
  const COMBOS: Array<[engine: Engine, mode: RenderMode | undefined]> = ENGINES.flatMap((engine) => MODES.map((mode): [Engine, RenderMode | undefined] => [engine, mode]));
  const label = (engine: Engine, mode: RenderMode | undefined): string => `${engine ?? "no engine"} / ${mode ?? "no mode"}`;
  /** What the builder is expected to have asked, once each: the text, the engine and the mode exactly as it was given them (an omitted one is `undefined`, passed on as such). */
  const once = (engine: Engine, mode: RenderMode | undefined): { cells: unknown[][]; options: unknown[][] } => ({ cells: [[TEXT, engine, mode]], options: [[TEXT, engine, mode]] });
  const seen = (): { cells: unknown[][]; options: unknown[][] } => ({ cells: asked.cells.slice(), options: asked.options.slice() });

  beforeEach(() => {
    asked.cells.length = 0;
    asked.options.length = 0;
    asked.on = true;
  });
  afterEach(() => {
    asked.on = false;
  });

  it("the counter can count: a call through the model's export is written down with its arguments, and the omitted ones are not there", () => {
    findAllCells(TEXT);
    findAllCells(TEXT, "knitr", "no-execute");
    findCellOptionLines(TEXT, "jupyter");
    expect(asked.cells).toEqual([[TEXT], [TEXT, "knitr", "no-execute"]]);
    expect(asked.cells[0]).toHaveLength(1);
    expect(asked.options).toEqual([[TEXT, "jupyter"]]);
  });

  it.each(COMBOS.map(([engine, mode]) => [label(engine, mode), engine, mode] as const))("%s: nothing is asked of the model when the builder is made", (_label, engine, mode) => {
    createCellVdocBuilder(TEXT, engine, mode);
    expect(seen()).toEqual({ cells: [], options: [] });
  });

  it.each(COMBOS.map(([engine, mode]) => [label(engine, mode), engine, mode] as const))("%s: the first cellAt asks once for the cells and once for the option lines, with the text, the engine and the mode it was given", (_label, engine, mode) => {
    cellSymbols(TEXT, engine, mode ?? "execute"); // the Outline's own pass first, as the provider makes it
    asked.cells.length = 0;
    asked.options.length = 0;
    const builder = createCellVdocBuilder(TEXT, engine, mode);
    builder.cellAt(7);
    expect(seen()).toStrictEqual(once(engine, mode));
  });

  it.each(COMBOS.map(([engine, mode]) => [label(engine, mode), engine, mode] as const))("%s: build as the first ask is the same one call each, and nothing after it asks again", (_label, engine, mode) => {
    const builder = createCellVdocBuilder(TEXT, engine, mode);
    const cell: Cell = { startLine: 6, endLine: 9, lang: "python", code: "#| echo: false\nx = 1" }; // hand-made: the first ask is a build, not a cellAt
    builder.build(cell);
    expect(seen()).toStrictEqual(once(engine, mode));
    for (let round = 0; round < 3; round++) {
      for (let line = -1; line <= TEXT.split("\n").length + 1; line++) {
        const found = builder.cellAt(line);
        if (found !== null) builder.build(found);
      }
      builder.build(cell);
    }
    expect(seen()).toStrictEqual(once(engine, mode));
  });

  it("two builders over one text ask separately, once each: nothing is shared between them", () => {
    const first = createCellVdocBuilder(TEXT, "knitr", "execute");
    const second = createCellVdocBuilder(TEXT, "knitr", "execute");
    first.cellAt(7);
    second.cellAt(7);
    first.cellAt(8);
    second.cellAt(8);
    expect(seen()).toStrictEqual({ cells: [[TEXT, "knitr", "execute"], [TEXT, "knitr", "execute"]], options: [[TEXT, "knitr", "execute"], [TEXT, "knitr", "execute"]] });
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CONSISTENCY, over a seeded corpus under every engine and both modes. What the change buys: for EVERY cell symbol `buildOutline(text, engine, mode)` reports, `cellAt(symbol.startLine)` is that very cell, the cell is
// the object the Outline's scan holds, and when its language is mapped the vdoc holds only lines strictly inside the symbol's own span (the fences are never in it, and no other cell's lines are).

describe("Session 342 -- over a seeded corpus, every cell symbol of the Outline is a cell of the builder given the same engine and mode", () => {
  const SEED = 342;
  const COUNT = 3000;
  const POOL: string[] = [
    "```", "```", "```", "~~~", "````",
    "```{r}", "```{r, echo=FALSE}", "```{r demo, echo=FALSE}", "```{r, include=FALSE}", "```{python}", "```{python}", "```{julia}", "```{ojs}", "```{bash}", "```{r, echo=TRUE}",
    "#| echo: false", "#| echo: false", "x <- 1", "plot(pressure)", "x = 1", "print(1)",
    "    ```{python}", "    ```", "  ```{r}", "  ```", "- ```{r}", "> ```{r}", "    ```{r}", "   ```{python}",
    "# Heading", "## Section", "prose", "", "", "",
  ];
  // Blocks of the shape the knitr half of the change is for: a stray bare fence above a hidden chunk (R and python), above an empty chunk, and above a pair of chunks of which one is loud.
  const KNITR_BLOCKS: string[][] = [
    ["", "```", "", "## Under", "", "```{r demo, echo=FALSE}", "plot(pressure)", "```", "", "## After", ""],
    ["", "```", "", "## Under", "", "```{python}", "#| echo: false", "x = 1", "```", "", "## After", ""],
    ["", "```", "```{python}", "```", ""],
    ["", "```", "", "```{r, include=FALSE}", "x <- 1", "```", "", "```{r, echo=TRUE}", "y <- 2", "```", ""],
  ];
  const FRONT: string[][] = [
    [], [], ["---", "title: t", "---", ""], ["---", "title: t", "execute:", "  echo: false", "---", ""], ["---", "title: t", "engine: knitr", "---", ""], ["---", "title: t", "engine: markdown", "---", ""],
    ["---", "title: t", "jupyter: python3", "---", ""], ["---", "title: t", "jupyter: julia-1.9", "---", ""], ["---", "title: t", "knitr: true", "---", ""],
  ];
  const COMBOS: Array<[Engine, RenderMode]> = [
    [undefined, "execute"], ["ambiguous", "execute"], ["knitr", "execute"], ["knitr", "no-execute"], ["jupyter", "execute"], ["markdown", "execute"], ["julia", "execute"],
  ];

  it(`the symbols of ${COUNT.toLocaleString("en-US")} documents under ${COMBOS.length} engine and mode pairs are found as the same cell, the object of the Outline's scan, and their vdoc keeps only lines inside them`, () => {
    const random = seededRandom(SEED);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const failures: string[] = [];
    let docs = 0;
    let symbols = 0;
    let mapped = 0;
    let differing = 0;
    let lostByBlind = 0;
    const lostIn = new Map<string, number>();
    for (let n = 0; n < COUNT; n++) {
      const lines = [...pick(FRONT)];
      const length = 2 + Math.floor(random() * 14);
      for (let k = 0; k < length; k++) lines.push(pick(POOL));
      if (random() < 0.3) lines.splice(Math.floor(random() * (lines.length + 1)), 0, ...pick(KNITR_BLOCKS));
      const text = lines.join("\n");
      docs++;
      const blindSpans = findAllCells(text).map(span).join(" ");
      let docDiffers = false;
      for (const [engine, mode] of COMBOS) {
        const outline = cellSymbols(text, engine, mode);
        if (outline.map(span).join(" ") !== blindSpans) docDiffers = true;
        const scanned = findAllCells(text, engine, mode);
        const builder = createCellVdocBuilder(text, engine, mode);
        for (const symbol of outline) {
          symbols++;
          // the control: how often the engine-blind lookup of the parent would NOT have found this symbol's cell (none, or another cell)
          const blindCell = findCellAtPosition(text, symbol.startLine);
          if (blindCell === null || blindCell.startLine !== symbol.startLine || blindCell.endLine !== symbol.endLine || blindCell.lang !== symbol.lang) {
            lostByBlind++;
            lostIn.set(`${engine}/${mode}`, (lostIn.get(`${engine}/${mode}`) ?? 0) + 1);
          }
          const cell = builder.cellAt(symbol.startLine);
          const where = `${JSON.stringify(text)} under ${engine ?? "no engine"}/${mode}, the symbol ${span(symbol)}`;
          if (cell === null) {
            if (failures.length < 5) failures.push(`${where}: cellAt is null`);
            continue;
          }
          if (cell.startLine !== symbol.startLine || cell.endLine !== symbol.endLine || cell.lang !== symbol.lang) {
            if (failures.length < 5) failures.push(`${where}: cellAt is ${span(cell)}`);
            continue;
          }
          if (cell !== scanned.find((c) => c.startLine === symbol.startLine)) {
            if (failures.length < 5) failures.push(`${where}: the cell is not the object of the Outline's scan`);
            continue;
          }
          if (cellLanguageId(cell.lang) === null) continue;
          mapped++;
          const vdoc = builder.build(cell).split("\n");
          for (let i = 1; i < vdoc.length; i++) {
            if (vdoc[i] !== "" && !(symbol.startLine < i && i < symbol.endLine)) {
              if (failures.length < 5) failures.push(`${where}: the vdoc holds line ${i}, outside the cell`);
              break;
            }
          }
        }
      }
      if (docDiffers) differing++;
    }
    expect(failures).toEqual([]);
    expect(docs).toBe(COUNT);
    // The draw must reach the shapes it is for: floors, not pinned counts (the generator is Mulberry32 over a pool, not a definition a second program is asked to reproduce).
    expect(symbols).toBeGreaterThan(10_000);
    expect(mapped).toBeGreaterThan(9_000);
    expect(differing).toBeGreaterThan(300);
    expect(lostByBlind).toBeGreaterThan(100); // symbols the blind lookup would have lost: the corpus holds the shapes the change is for
    // and it holds them for each engine that has any: the pairs for which the blind lookup loses symbols (the others, ambiguous and julia and no engine, read the blind list)
    expect(Object.fromEntries([...lostIn.entries()].map(([pair, lost]) => [pair, lost > 10]))).toEqual({ "knitr/execute": true, "knitr/no-execute": true, "jupyter/execute": true, "markdown/execute": true });
  }, 120_000);
});
