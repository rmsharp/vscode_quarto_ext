import { describe, expect, it } from "vitest";
import { cellLanguageId } from "../../src/core/embedded/lang-map";
import { type Cell, findAllCells, findCellAtPosition, findCellOptionLines } from "../../src/core/qmd/model";
import { TYPE_IGNORE_DIRECTIVE, buildCellVirtualContent, createCellVdocBuilder } from "../../src/core/embedded/virtual-doc";
import { LS, NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take a few seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 341 -- the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (2). The Outline provider asked, for EVERY code cell of a document, `findCellAtPosition(text, startLine)` and
// `buildCellVirtualContent(text, cell)`; each build split the whole text, recomputed every cell's option lines and mapped over every line (cells times document). `createCellVdocBuilder(text)` is made once per
// `provideDocumentSymbols` call: `cellAt(line)` must answer what `findCellAtPosition(text, line)` answers, for EVERY line, and `build(cell)` must be byte for byte the old `buildCellVirtualContent(text, cell)`.
//
// `findCellAtPosition` is unchanged in `src/core/qmd/model.ts` and is the oracle for `cellAt` as it stands. The OLD `buildCellVirtualContent` is kept here, copied VERBATIM from the parent `c20f0e8`
// (`src/core/embedded/virtual-doc.ts` before the cure), as the oracle for `build` (Learning 738): the function in the source is respelled on top of the builder, so it could not stand as its own oracle.
//
// The counts pinned below (how many documents, cells, mapped cells, python cells, mute lines, kept lines and `cellAt` questions the enumerations reach) come from the Python recount
// `tools/cell-vdoc-count/count_cells.py`, which shares no code with this file and reads each document by the definition of a fence, and never from the code under test.

// ---- The OLD spelling, copied VERBATIM from the parent `c20f0e8`. ----
function bodyLineCount(cell: Cell): number {
  return cell.code === "" ? 0 : cell.code.split("\n").length;
}

function oldBuildCellVirtualContent(text: string, cell: Cell): string {
  const lines = text.split("\n");
  const optionLines = new Set(findCellOptionLines(text).map((o) => o.line));
  const lastBody = cell.startLine + bodyLineCount(cell);
  const inBody = (i: number): boolean =>
    i > cell.startLine && i <= lastBody && !optionLines.has(i);
  // Candidate G (plan §4.1): the per-cell vdoc leaks the same workspace-mode phantom
  // diagnostics (plan §3.1), so it takes the same file-level `# type: ignore` mute. Line 0 is
  // never a body line here either — `inBody` requires `i > cell.startLine` and `cell.startLine`
  // is a fence line ≥ 0 — so the write is coordinate-safe. Gated to a python cell (a `#` is a
  // JS syntax error) with NON-WHITESPACE body content (nothing to mute in an all-blank cell).
  const injectMute =
    cellLanguageId(cell.lang)?.languageId === "python" &&
    lines.some((line, i) => inBody(i) && line.trim() !== "");
  return lines
    .map((line, i) => (i === 0 && injectMute ? TYPE_IGNORE_DIRECTIVE : inBody(i) ? line : ""))
    .join("\n");
}

// ---- What the two are compared on. ----

const nl = (k: number): string => "\n".repeat(k);
const D = TYPE_IGNORE_DIRECTIVE;

/** The vdoc of every cell the model finds in `text`, from the builder. */
function builtVdocs(text: string): string[] {
  const builder = createCellVdocBuilder(text);
  return findAllCells(text).map((cell) => builder.build(cell));
}

/** The same, from the OLD spelling. */
function oldVdocs(text: string): string[] {
  return findAllCells(text).map((cell) => oldBuildCellVirtualContent(text, cell));
}

/** `cellAt` and `findCellAtPosition` on every line from -1 to two past the end: the cell each answers, as `[startLine, endLine, lang, code]` or `null`. */
function cellAtEverywhere(text: string): { builder: unknown[]; model: unknown[] } {
  const builder = createCellVdocBuilder(text);
  const total = text.split("\n").length;
  const shape = (cell: Cell | null): unknown => (cell === null ? null : [cell.startLine, cell.endLine, cell.lang, cell.code]);
  const asked = Array.from({ length: total + 3 }, (_, k) => k - 1);
  return { builder: asked.map((line) => shape(builder.cellAt(line))), model: asked.map((line) => shape(findCellAtPosition(text, line))) };
}

describe("Session 341 -- the old spelling is what the parent had, and the oracle can fail", () => {
  it("the verbatim copy keeps the body line, mutes line 0 and empties the rest on a one-cell document", () => {
    const text = "p\n```{python}\nx = 1\n```\n";
    const [cell] = findAllCells(text);
    expect(oldBuildCellVirtualContent(text, cell)).toBe(`${D}\n\nx = 1\n\n`);
  });

  it("the old spelling's answer moves with the cell's language, code and start line (so a comparison with it can fail)", () => {
    const text = "p\n```{python}\nx = 1\n```\n";
    const [cell] = findAllCells(text);
    const same = oldBuildCellVirtualContent(text, cell);
    expect(oldBuildCellVirtualContent(text, { ...cell, lang: "r" })).not.toBe(same); // no mute
    expect(oldBuildCellVirtualContent(text, { ...cell, code: "" })).not.toBe(same); // no kept line
    expect(oldBuildCellVirtualContent(text, { ...cell, startLine: cell.startLine + 1 })).not.toBe(same); // a body one line down
    expect(oldBuildCellVirtualContent(text, { ...cell })).toBe(same);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// NAMED ROWS. Each states the ANSWER (the exact vdoc of every cell, by hand from the lines in the comments), then that the builder, `buildCellVirtualContent` and the oracle all give it, that the line count is the
// text's, and that `cellAt` answers what `findCellAtPosition` answers on every line.

type Named = { name: string; text: string; expected: string[] };

const NAMED: Named[] = [
  {
    name: "kept body lines verbatim, a whitespace-only body line included; line 0 is prose, so the mute lands on it",
    // 0 p | 1 fence | 2 `x = 1` | 3 `  ` | 4 `y = 2` | 5 fence | 6 (empty, after the last newline)
    text: "p\n```{python}\nx = 1\n  \ny = 2\n```\n",
    expected: [`${D}\n\nx = 1\n  \ny = 2\n\n`],
  },
  {
    name: "a cell starting at line 0: the mute sits on the fence line, the body right under it",
    text: "```{python}\nx = 1\n```",
    expected: [`${D}\nx = 1\n`],
  },
  {
    name: "`#|` option lines are blanked, and only the LEADING block counts: a `#|` line under code is kept",
    // 0 fence | 1 `#| echo: false` | 2 `#| eval: true` | 3 `x = 1` | 4 `#| not: option` | 5 fence | 6 (empty)
    text: "```{python}\n#| echo: false\n#| eval: true\nx = 1\n#| not: option\n```\n",
    expected: [`${D}\n\n\nx = 1\n#| not: option\n\n`],
  },
  {
    name: "`//|` option lines of an ojs cell are blanked, and one under code is kept",
    // 0 fence | 1 `//| echo: false` | 2 `1 + 1` | 3 `//| later` | 4 fence
    text: "```{ojs}\n//| echo: false\n1 + 1\n//| later\n```",
    expected: ["\n\n1 + 1\n//| later\n"],
  },
  {
    name: "a `//|` line in a python cell and a `#|` line in an ojs cell are CODE and are kept (the comment character is the cell language's)",
    // cell 0: 0 fence | 1 `//| x` | 2 `y = 1` | 3 fence | cell 1: 4 fence | 5 `#| x` | 6 `1` | 7 fence
    text: "```{python}\n//| x\ny = 1\n```\n```{ojs}\n#| x\n1\n```",
    expected: [`${D}\n//| x\ny = 1${nl(5)}`, `${nl(5)}#| x\n1\n`],
  },
  {
    name: "fences, prose, front matter and every other cell are emptied, a same-language sibling included",
    // 0 --- | 1 title | 2 --- | 3 (empty) | 4 prose | 5 fence py | 6 `a = 1` | 7 fence | 8 fence py | 9 `b = 2` | 10 fence | 11 fence r | 12 `c <- 3` | 13 fence | 14 (empty)
    text: "---\ntitle: t\n---\n\nprose\n```{python}\na = 1\n```\n```{python}\nb = 2\n```\n```{r}\nc <- 3\n```\n",
    expected: [`${D}${nl(6)}a = 1${nl(8)}`, `${D}${nl(9)}b = 2${nl(5)}`, `${nl(12)}c <- 3${nl(2)}`],
  },
  {
    name: "a CRLF document: a kept line keeps its CR, a blanked line is empty, and the model's line numbers index the LF split",
    // 0 `p\r` | 1 fence | 2 `x = 1\r` | 3 `  \r` | 4 fence | 5 (empty)
    text: "p\r\n```{python}\r\nx = 1\r\n  \r\n```\r\n",
    expected: [`${D}\n\nx = 1\r\n  \r\n\n`],
  },
  {
    name: "a CRLF option line is blanked, and the body under it is kept with its CR",
    // 0 fence | 1 option | 2 `x = 1\r` | 3 fence | 4 (empty)
    text: "```{python}\r\n#| echo: false\r\nx = 1\r\n```\r\n",
    expected: [`${D}\n\nx = 1\r\n\n`],
  },
  {
    name: "an all-blank python cell gets no mute, and its blank body lines are kept as they are",
    // 0 fence | 1 (empty) | 2 `  ` | 3 fence | 4 (empty)
    text: "```{python}\n\n  \n```\n",
    expected: ["\n\n  \n\n"],
  },
  {
    name: "a python cell of option lines only gets no mute",
    text: "```{python}\n#| echo: false\n```\n",
    expected: ["\n\n\n"],
  },
  {
    name: "an r, a js, an ojs, a julia and an unmapped-engine cell get no mute, and keep their body",
    // five cells of three lines (fence, body, fence), then the empty last line: the body of cell k is on line 3k + 1, of 16
    text: "```{r}\nx\n```\n```{js}\nx\n```\n```{ojs}\nx\n```\n```{julia}\nx\n```\n```{bash}\nx\n```\n",
    expected: [`${nl(1)}x${nl(14)}`, `${nl(4)}x${nl(11)}`, `${nl(7)}x${nl(8)}`, `${nl(10)}x${nl(5)}`, `${nl(13)}x${nl(2)}`],
  },
  // The model DROPS a cell opener that nothing closes ("a fence opens only if it is closed below", `computeRegions`: quarto deletes such a fence and the rest is markdown), so no unterminated cell ever reaches a build: the brief
  // that asked for a row on one found the model answers `[]` for all three of these. The shape a cell would have if it did reach one is built by hand in the row of the hand-made cells below.
  {
    name: "an unterminated cell opener is no cell: the model drops it, so there is nothing to build and cellAt answers null on every line",
    text: "p\n```{python}\nx = 1\ny = 2",
    expected: [],
  },
  {
    name: "an unterminated cell opener, its body ending at the newline at the end of the text: no cell",
    text: "```{python}\nx\n",
    expected: [],
  },
  {
    name: "an unterminated cell opener with nothing under it: no cell",
    text: "p\n```{python}",
    expected: [],
  },
  {
    name: "an empty cell",
    text: "```{python}\n```\n",
    expected: ["\n\n"],
  },
  {
    name: "a body of one blank line (`code === \"\"`, the documented edge): nothing is kept, the line count is the text's",
    // 0 fence | 1 (empty) | 2 fence | 3 (empty)
    text: "```{python}\n\n```\n",
    expected: ["\n\n\n"],
  },
  {
    name: "a body of one blank line, a second cell after it: the second cell's body is kept",
    // 0 fence | 1 (empty) | 2 fence | 3 fence | 4 `x` | 5 fence | 6 (empty)
    text: "```{python}\n\n```\n```{python}\nx\n```\n",
    expected: ["\n\n\n\n\n\n", `${D}${nl(4)}x${nl(2)}`],
  },
  {
    name: "two adjacent cells: each vdoc holds its own body only, and the second one's mute replaces the first cell's blanked fence line",
    // 0 fence | 1 `x = 1` | 2 fence | 3 fence | 4 `y = 2` | 5 fence | 6 (empty)
    text: "```{python}\nx = 1\n```\n```{python}\ny = 2\n```\n",
    expected: [`${D}\nx = 1${nl(5)}`, `${D}${nl(4)}y = 2${nl(2)}`],
  },
  {
    name: "a document with no cell: nothing to build, and cellAt answers null on every line",
    text: "just prose\n\n# Heading\n",
    expected: [],
  },
  {
    name: "a lone CR inside a line is not a line break: the cell starts on line 1 and its body line keeps the CR",
    // 0 `a\rb` | 1 fence | 2 `x\ry = 1` | 3 fence | 4 (empty)
    text: "a\rb\n```{python}\nx\ry = 1\n```\n",
    expected: [`${D}\n\nx\ry = 1\n\n`],
  },
  {
    name: "a U+2028 inside a line is not a line break either",
    text: `a${LS}b\n\`\`\`{python}\nx${LS}y = 1\n\`\`\`\n`,
    expected: [`${D}\n\nx${LS}y = 1\n\n`],
  },
  {
    name: "a body line that is only a U+2028 is whitespace for the mute and is still kept: no mute",
    text: `\`\`\`{python}\n${LS}\n\`\`\`\n`,
    expected: [`\n${LS}\n\n`],
  },
  {
    name: "a body line written `\\n\\r\\n` is a CRLF line end to the model, so a blank body line: the one-blank-line edge again, nothing is kept (the LF split sees a line of `\\r`)",
    text: "```{python}\n\r\n```\n",
    expected: ["\n\n\n"],
  },
  {
    name: "a body line that is only a no-break space is whitespace for the mute: no mute",
    text: `\`\`\`{python}\n${NBSP}\n\`\`\`\n`,
    expected: [`\n${NBSP}\n\n`],
  },
];

describe("Session 341 -- the named rows: the builder, buildCellVirtualContent and the old spelling give the stated vdoc for every cell", () => {
  it.each(NAMED.map((row) => [row.name, row] as const))("%s", (_name, row) => {
    expect(builtVdocs(row.text)).toEqual(row.expected);
    expect(oldVdocs(row.text)).toEqual(row.expected);
    expect(findAllCells(row.text).map((cell) => buildCellVirtualContent(row.text, cell))).toEqual(row.expected);
    for (const vdoc of builtVdocs(row.text)) {
      expect(vdoc.split("\n")).toHaveLength(row.text.split("\n").length);
    }
    const asked = cellAtEverywhere(row.text);
    expect(asked.builder).toEqual(asked.model);
  });

  it("the cells the named rows are about are the cells the rows state (the model finds as many as the rows give vdocs for)", () => {
    for (const row of NAMED) {
      expect(findAllCells(row.text)).toHaveLength(row.expected.length);
    }
  });

  it("cellAt names the cell on its fence lines and body lines, and null on the prose around it and past the end", () => {
    const text = "p\n```{python}\nx\n```\nq\n";
    const builder = createCellVdocBuilder(text);
    expect([-1, 0, 1, 2, 3, 4, 5, 6, 99].map((line) => builder.cellAt(line)?.startLine ?? null)).toEqual([null, null, 1, 1, 1, null, null, null, null]);
  });

  it("cellAt answers a line that is not an integer, NaN and infinity as the scan does: the cell whose span holds it, else null", () => {
    const text = "p\n```{python}\nx\n```\nq\n```{r}\ny\n```\n";
    const builder = createCellVdocBuilder(text);
    const starts = (line: number, from: { cellAt(l: number): Cell | null }): number | null => from.cellAt(line)?.startLine ?? null;
    const scan = { cellAt: (line: number): Cell | null => findCellAtPosition(text, line) };
    // 0 p | 1 fence | 2 x | 3 fence | 4 q | 5 fence | 6 y | 7 fence | 8 (empty): the cells span [1, 3] and [5, 7]
    const lines = [NaN, 0.5, 0.999, 1, 1.5, 3, 3.5, 4.5, 5, 6.5, 7.25, 8, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, -0];
    expect(lines.map((line) => starts(line, builder))).toEqual(lines.map((line) => starts(line, scan)));
    // and the scan's own answers are the ones the row is about
    expect(lines.map((line) => starts(line, scan))).toEqual([null, null, null, 1, 1, 1, null, null, 5, 5, null, null, null, null, null, null]);
  });

  it("a builder is reusable: the cells built in any order, twice over, give the same vdocs", () => {
    const text = "p\n```{python}\nx\n```\n```{r}\ny\n```\n```{python}\nz\n```\n";
    const builder = createCellVdocBuilder(text);
    const cells = findAllCells(text);
    const first = cells.map((cell) => builder.build(cell));
    const reversed = [...cells].reverse().map((cell) => builder.build(cell)).reverse();
    const again = cells.map((cell) => builder.build(cell));
    expect(reversed).toEqual(first);
    expect(again).toEqual(first);
    expect(first).toEqual(oldVdocs(text));
    expect(new Set(first).size).toBe(3);
  });

  it("a hand-made cell the model never found is built as the old spelling builds it: past the end, before the start, with a body of its own", () => {
    const text = "just prose\n\n# Heading\n";
    const builder = createCellVdocBuilder(text);
    const inside: Cell = { startLine: 1, endLine: 3, lang: "python", code: "a\nb" };
    expect(builder.build(inside)).toBe(`${D}\n\n# Heading\n`);
    // 0 `just prose` | 1 (empty) | 2 `# Heading` | 3 (empty). A cell above line 0 reads line 0 as its body; for a python cell with content the mute writes over it; a cell below the text, or with no code, holds nothing.
    const stated: Array<[string, Cell, string]> = [
      ["starts at -1, r: line 0 is its body and is kept", { ...inside, startLine: -1, lang: "r" }, "just prose\n\n\n"],
      ["starts at -1, python: the mute writes over line 0", { ...inside, startLine: -1 }, `${D}\n\n\n`],
      ["starts at -2, r: its two lines of code reach line 0 only", { ...inside, startLine: -2, lang: "r" }, "just prose\n\n\n"],
      ["starts at -2, python", { ...inside, startLine: -2 }, `${D}\n\n\n`],
      ["starts on the last line: nothing below it", { ...inside, startLine: 3 }, "\n\n\n"],
      ["starts far below the text", { ...inside, startLine: 9 }, "\n\n\n"],
      ["no code", { ...inside, code: "" }, "\n\n\n"],
      ["one line of code", { ...inside, code: "a".repeat(50) }, `${D}\n\n# Heading\n`],
      ["an r cell: no mute", { ...inside, lang: "r" }, "\n\n# Heading\n"],
      ["no engine: no mute", { ...inside, lang: "" }, "\n\n# Heading\n"],
    ];
    for (const [, cell, expected] of stated) {
      expect(builder.build(cell)).toBe(expected);
      expect(builder.build(cell)).toBe(oldBuildCellVirtualContent(text, cell));
    }
  });

  it("a hand-made cell shaped like an unterminated cell (its end line the last line, the closing fence missing) is built from its start line and its code alone", () => {
    const text = "p\n```{python}\nx = 1\ny = 2";
    const builder = createCellVdocBuilder(text);
    const unterminated: Cell = { startLine: 1, endLine: 3, lang: "python", code: "x = 1\ny = 2" };
    expect(builder.build(unterminated)).toBe(`${D}\n\nx = 1\ny = 2`);
    expect(builder.build(unterminated)).toBe(oldBuildCellVirtualContent(text, unterminated));
    expect(builder.cellAt(2)).toBeNull();
  });

  it("two builders over two texts do not share anything: building from the first after the second was made still answers the first", () => {
    const first = "p\n```{python}\nx = 1\n```\n";
    const second = "```{r}\nz\n```\n\nq\n\nr\n";
    const a = createCellVdocBuilder(first);
    const b = createCellVdocBuilder(second);
    expect(b.build(b.cellAt(0)!)).toBe(`\nz${nl(6)}`);
    expect(a.build(a.cellAt(1)!)).toBe(`${D}\n\nx = 1\n\n`);
    expect(b.build(b.cellAt(1)!)).toBe(`\nz${nl(6)}`);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE DIFFERENTIAL. Every document is read by the old spelling and the builder; a disagreement is recorded as a string and the row asserts that there are none.

interface Tally {
  docs: number;
  cells: number;
  /** Cells whose engine maps to a forwarding target (a build is only ever asked for these: `cellLanguageId` is non-null, Learning 903). */
  mapped: number;
  python: number;
  /** Builds whose old vdoc starts with the mute. */
  mutes: number;
  /** Non-empty lines the old vdoc holds besides the mute: the kept body lines (a whitespace-only one is non-empty; a blank one is not). */
  keptLines: number;
  cellAtChecks: number;
  disagreements: string[];
}

const newTally = (): Tally => ({ docs: 0, cells: 0, mapped: 0, python: 0, mutes: 0, keptLines: 0, cellAtChecks: 0, disagreements: [] });

/** Compare the builder with the old spelling and `findCellAtPosition` over one document: every real cell, every line, and the given hand-made cells. */
function compareDocument(text: string, tally: Tally, handMade: readonly Cell[] = []): void {
  tally.docs++;
  const builder = createCellVdocBuilder(text);
  const note = (what: string): void => {
    if (tally.disagreements.length < 5) tally.disagreements.push(`${JSON.stringify(text)}: ${what}`);
  };
  // The order `cellAt` relies on: the model's cells come in document order and never overlap (each starts below the line the one before it ends on).
  const found = findAllCells(text);
  for (let k = 1; k < found.length; k++) {
    if (found[k].startLine <= found[k - 1].endLine) note(`the cells at ${found[k - 1].startLine} and ${found[k].startLine} overlap or are out of order`);
  }
  for (const cell of found) {
    const old = oldBuildCellVirtualContent(text, cell);
    tally.cells++;
    const el = cellLanguageId(cell.lang);
    if (el !== null) tally.mapped++;
    if (el?.languageId === "python") tally.python++;
    const muted = old.startsWith(`${D}\n`);
    if (muted) tally.mutes++;
    for (const line of old.split("\n")) if (line !== "") tally.keptLines++;
    if (muted) tally.keptLines--;
    if (builder.build(cell) !== old) note(`build of the cell at ${cell.startLine}`);
    if (buildCellVirtualContent(text, cell) !== old) note(`buildCellVirtualContent of the cell at ${cell.startLine}`);
  }
  for (const cell of handMade) {
    if (builder.build(cell) !== oldBuildCellVirtualContent(text, cell)) note(`build of the hand-made cell ${JSON.stringify(cell)}`);
  }
  const total = text.split("\n").length;
  for (let line = -1; line <= total + 1; line++) {
    tally.cellAtChecks++;
    const expected = findCellAtPosition(text, line);
    const got = builder.cellAt(line);
    const same = expected === null ? got === null : got !== null && got.startLine === expected.startLine && got.endLine === expected.endLine && got.lang === expected.lang && got.code === expected.code;
    if (!same) note(`cellAt(${line})`);
  }
}

describe("Session 341 -- every document over a line alphabet (the builder against the old spelling and findCellAtPosition)", () => {
  // E1. The lines of the alphabet: three kinds of fence that OPEN something, the fence that closes it, an option line, code, a blank line, a whitespace-only line, prose, a heading.
  const LINES_1: Record<string, string> = {
    a: "```{python}",
    b: "```{r}",
    c: "```{bash}",
    d: "```",
    e: "#| echo: false",
    f: "x = 1",
    g: "",
    h: "  ",
    i: "prose",
    j: "# Heading",
  };
  const MAX_LENGTH_1 = 5;
  // E2. Six lines and longer documents (up to seven lines), LF only: the interplay of several cells, a leading option block and blank lines.
  const LINES_2: Record<string, string> = { a: "```{python}", b: "```{r}", d: "```", e: "#| echo: false", f: "x = 1", g: "" };
  const MAX_LENGTH_2 = 7;

  const document = (word: string, lines: Record<string, string>, eol: string): string => [...word].map((s) => lines[s]).join(eol);

  const counts = (tally: Tally): Record<string, number> => ({
    docs: tally.docs,
    cells: tally.cells,
    mapped: tally.mapped,
    python: tally.python,
    mutes: tally.mutes,
    keptLines: tally.keptLines,
    cellAtChecks: tally.cellAtChecks,
  });

  it("the sizes: E1 reaches 111,111 documents of 0 to 5 lines over ten lines, twice (LF and CRLF); E2 reaches 335,923 of 0 to 7 lines over six", () => {
    expect(Object.keys(LINES_1)).toHaveLength(10);
    expect(Object.keys(LINES_2)).toHaveLength(6);
    expect(countStrings(10, MAX_LENGTH_1)).toBe(111_111);
    expect(countStrings(6, MAX_LENGTH_2)).toBe(335_923);
  });

  it("E1: agrees with the old spelling and with findCellAtPosition on every document, with LF and with CRLF line ends, and reaches the counts of the Python recount", () => {
    const tally = newTally();
    for (const word of everyString(Object.keys(LINES_1), MAX_LENGTH_1)) {
      compareDocument(document(word, LINES_1, "\n"), tally);
      compareDocument(document(word, LINES_1, "\r\n"), tally);
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/cell-vdoc-count/count_cells.py E1`.
    expect(counts(tally)).toEqual({ docs: 222_222, cells: 39_456, mapped: 26_304, python: 13_152, mutes: 6_548, keptLines: 35_547, cellAtChecks: 1_753_088 });
  }, HEAVY_ROW_MS);

  it("E2: agrees on every document over six lines up to seven lines long, and reaches the counts of the Python recount", () => {
    const tally = newTally();
    for (const word of everyString(Object.keys(LINES_2), MAX_LENGTH_2)) {
      compareDocument(document(word, LINES_2, "\n"), tally);
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/cell-vdoc-count/count_cells.py E2`.
    expect(counts(tally)).toEqual({ docs: 335_923, cells: 148_398, mapped: 148_398, python: 74_199, mutes: 41_031, keptLines: 159_006, cellAtChecks: 3_292_048 });
  }, HEAVY_ROW_MS);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE SEEDED DIFFERENTIAL: larger documents drawn from a wider pool than the enumerations reach (every engine the project maps and some it does not, `//|` and `%%|` lines, a `#|` block scalar, tilde and four-backtick
// fences, indented and quoted and listed fences, front matter, comments, a lone CR, a U+2028, a no-break space), with LF and CRLF line ends mixed within one document, and a few hand-made cells per document.

describe("Session 341 -- a seeded differential on larger documents", () => {
  const SEED = 341;
  const SEEDED_COUNT = 30_000;
  const POOL: string[] = [
    "```{python}", "```{python}", "```{python}", "```{r}", "```{r}", "```{ojs}", "```{js}", "```{julia}", "```{bash}", "```{mermaid}", "```{python}", "```{r, echo=FALSE}",
    "```", "```", "```", "```", "````", "~~~", "~~~{python}", "  ```{python}", "  ```", "> ```{python}", "- ```{python}", "```python", "```{{python}}",
    "#| echo: false", "#| echo: false", "#| fig-cap: |", "#|   more text", "//| echo: false", "%%| x: 1", "#|", "# | spaced",
    "x = 1", "x = 1", "y <- 2", "  indented", "def f():", "    return 1", "1 + 1",
    "", "", "  ", "\t", " ",
    "prose", "prose again", "# Heading", "## Sub {#sec-a}", "---", "title: x", "<!--", "-->", "$$",
    "a\rb", `u${LS}v`, `${LS}`, NBSP, "\r",
  ];
  const EOLS = ["\n", "\n", "\n", "\r\n"];
  const ENGINES = ["python", "r", "ojs", "js", "julia", "bash", ""];
  const CODES = ["", "a", "a\nb\nc", "\n", "   ", "x = 1\n#| echo: false"];

  it(`agrees with the old spelling and with findCellAtPosition on ${SEEDED_COUNT.toLocaleString("en-US")} documents of 1 to 40 lines, and on four hand-made cells of each`, () => {
    const random = seededRandom(SEED);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const tally = newTally();
    for (let n = 0; n < SEEDED_COUNT; n++) {
      const lines: string[] = [];
      if (random() < 0.3) lines.push("---", "title: t", "---");
      const length = 1 + Math.floor(random() * 40);
      for (let k = 0; k < length; k++) lines.push(pick(POOL));
      let text = "";
      for (let k = 0; k < lines.length; k++) text += lines[k] + (k < lines.length - 1 ? pick(EOLS) : "");
      const total = text.split("\n").length;
      const handMade: Cell[] = [];
      for (let k = 0; k < 4; k++) {
        const startLine = Math.floor(random() * (total + 6)) - 2;
        const code = pick(CODES);
        handMade.push({ startLine, endLine: startLine + 1 + code.split("\n").length, lang: pick(ENGINES), code });
      }
      compareDocument(text, tally, handMade);
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.docs).toBe(SEEDED_COUNT);
    // The draw must reach the shapes it is for: floors, not pinned counts (the generator is Mulberry32 over a pool, not a definition a second program is asked to reproduce).
    expect(tally.cells).toBeGreaterThan(10_000);
    expect(tally.mutes).toBeGreaterThan(2_000);
    expect(tally.mapped).toBeGreaterThan(tally.python);
  }, HEAVY_ROW_MS);
});
