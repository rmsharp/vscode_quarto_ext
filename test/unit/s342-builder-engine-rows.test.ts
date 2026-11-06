import { describe, expect, it } from "vitest";
import { type Cell, buildOutline, findAllCells, findCellAtPosition, findCellOptionLines, type OutlineSymbol } from "../../src/core/qmd/model";
import { TYPE_IGNORE_DIRECTIVE, createCellVdocBuilder } from "../../src/core/embedded/virtual-doc";
import { cellLanguageId } from "../../src/core/embedded/lang-map";
import type { RenderMode } from "../../src/core/render-mode";
import { seededRandom } from "./support/regex-equivalence";

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
