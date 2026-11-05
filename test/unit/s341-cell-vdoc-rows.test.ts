import { describe, expect, it } from "vitest";
import { findAllCells, findCellAtPosition } from "../../src/core/qmd/model";
import {
  TYPE_IGNORE_DIRECTIVE,
  buildCellVirtualContent,
  createCellVdocBuilder,
} from "../../src/core/embedded/virtual-doc";

// Session 341 -- the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (2). The Outline provider forwards every code cell of a document into its own per-cell
// virtual document (`forwardCellSymbols` in `src/providers/outline.ts`): for each cell it asked `findCellAtPosition(text, cell.startLine)` (a scan of every cell) and `buildCellVirtualContent(text, cell)`
// (a split of the whole text, every cell's option lines recomputed, a callback over every line, and for a python cell a whole-document `some` for the mute). That is cells times document.
// `createCellVdocBuilder(text)` is made once per `provideDocumentSymbols` call and answers `cellAt(line)` (what `findCellAtPosition(text, line)` answers) and `build(cell)` (what
// `buildCellVirtualContent(text, cell)` answers, byte for byte) without redoing the per-text work for each cell.
//
// This file holds the ANSWER rows (they pass on the parent's logic and state what the builder must answer) and the CLOCK rows (they are the reason for the change). The old spelling is kept verbatim as the
// oracle in `cell-vdoc-builder-equivalence.test.ts`.

/** The line numbers are in the comments: the document is read through its own numbers, so a row names the line it means. */
const DOC = [
  "---", // 0
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Intro prose.", // 4
  "```{python}", // 5
  "#| echo: false", // 6
  "import os", // 7
  "  ", // 8  a whitespace-only body line
  "x = 1", // 9
  "```", // 10
  "", // 11
  "```{python}", // 12
  "y = 2", // 13
  "```", // 14
  "```{r}", // 15
  "z <- 3", // 16
  "```", // 17
].join("\n");

describe("createCellVdocBuilder -- the answers (Session 341)", () => {
  it("builds one cell's body lines verbatim, a whitespace-only one too, and empties everything else", () => {
    const builder = createCellVdocBuilder(DOC);
    const first = builder.cellAt(5);
    expect(first).not.toBeNull();
    const lines = builder.build(first!).split("\n");
    expect(lines[0]).toBe(TYPE_IGNORE_DIRECTIVE);
    expect(lines.slice(1, 7)).toEqual(["", "", "", "", "", ""]);
    expect(lines.slice(7, 10)).toEqual(["import os", "  ", "x = 1"]);
    expect(lines.slice(10)).toEqual(["", "", "", "", "", "", "", ""]);
  });

  it("keeps the line count of the text, whatever the cell", () => {
    const builder = createCellVdocBuilder(DOC);
    for (const cell of findAllCells(DOC)) {
      expect(builder.build(cell).split("\n")).toHaveLength(DOC.split("\n").length);
    }
  });

  it("empties a same-language sibling cell: the second python cell's vdoc holds only its own body", () => {
    const builder = createCellVdocBuilder(DOC);
    const second = builder.cellAt(12)!;
    const lines = builder.build(second).split("\n");
    expect(lines[13]).toBe("y = 2");
    expect(lines[7]).toBe("");
    expect(lines[9]).toBe("");
  });

  it("gives no mute to an r cell, and the mute to a python cell", () => {
    const builder = createCellVdocBuilder(DOC);
    expect(builder.build(builder.cellAt(15)!).split("\n")[0]).toBe("");
    expect(builder.build(builder.cellAt(12)!).split("\n")[0]).toBe(TYPE_IGNORE_DIRECTIVE);
  });

  it("answers cellAt as findCellAtPosition does: a fence line is inside the cell, prose and the line past the end are not", () => {
    const builder = createCellVdocBuilder(DOC);
    const total = DOC.split("\n").length;
    for (let line = -1; line <= total + 1; line++) {
      expect(builder.cellAt(line)).toEqual(findCellAtPosition(DOC, line));
    }
    expect(builder.cellAt(5)).not.toBeNull();
    expect(builder.cellAt(10)).not.toBeNull();
    expect(builder.cellAt(11)).toBeNull();
    expect(builder.cellAt(total)).toBeNull();
  });

  it("buildCellVirtualContent still answers what the builder answers", () => {
    const builder = createCellVdocBuilder(DOC);
    for (const cell of findAllCells(DOC)) {
      expect(buildCellVirtualContent(DOC, cell)).toBe(builder.build(cell));
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK (Session 341). The loop the adapter runs: ONE builder per `provideDocumentSymbols` call, and for every cell `cellAt(startLine)` then `build(cell)`.
//
// Measured at the parent `c20f0e8` (Session 341, one fresh process per timing, Node, the loop above through `findCellAtPosition` and `buildCellVirtualContent`, the string of each build hashed so that it is
// really materialised): six-line cells (`` ```{python} ``, a `#|` line, two body lines, the closing fence, a blank line, a prose line; 7 lines a cell) 76 / 292 / 1,155 / 4,619 ms at 250 / 500 / 1,000 / 2,000
// cells at load 3.7; the same with `{r}` cells 4,501 ms at 2,000 at load 4.1; 12-line cells (fence, option line, nine body lines, fence) 4,125 ms at 1,600 (22,401 lines) at load 5.3; 60 cells in a 1,980,301-line
// document 3,708 ms at load 5.2. The cost is cells times document: every build splits the whole text, reads every cell's option lines again and maps over every line.
//
// The limit is one second. It is not raised to make a row pass. The parent takes 3.5 to 4.6 s on the four clock rows (4.6 / 4.5 / 4.1 / 3.5 s at load 3 to 5); the cure takes 10.8 / 11.0 / 12.2 / 49.7 ms at load 8.9 to 7.3
// (one fresh process each, the same four shapes). The loop against its first call, which no load moves: 844 / 825 / 838 on the first three shapes at the parent, 2.1 / 2.1 / 2.4 on the cure; the limit is 100.
// Every row states its ANSWER before the clock: the number of builds, the total length of the strings, and the exact non-empty lines of three sampled cells (the first, the middle, the last), read back after the loop.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
};

describe("the Session 341 clock helper", () => {
  it("timed reports the milliseconds the run took and hands back its result", () => {
    const { result, ms } = timed(() => {
      const started = performance.now();
      while (performance.now() - started < 30) {
        /* spin */
      }
      return "done";
    });
    expect(result).toBe("done");
    expect(ms).toBeGreaterThanOrEqual(25);
  });
});

/** One document made of `cells` blocks, and what a cell's vdoc must hold: the lines it keeps and the line each sits on. */
interface Shape {
  label: string;
  lang: string;
  cells: number;
  text: string;
  /** The line count of the text (`text.split("\n").length`), written from the construction, not read back. */
  lines: number;
  startLineOf: (i: number) => number;
  /** The body lines cell `i` keeps, in order, from the line after its option line. */
  kept: (i: number) => string[];
}

const FENCE = "```";

/** `n` blocks of: the fence, `#| echo: false`, `x = i`, `y = 2`, the closing fence, a blank line, `prose i` (7 lines). */
function sixLineShape(n: number, lang: string): Shape {
  let text = "";
  for (let i = 0; i < n; i++) {
    text += `${FENCE}{${lang}}\n#| echo: false\nx = ${i}\ny = 2\n${FENCE}\n\nprose ${i}\n`;
  }
  return { label: `${n} six-line {${lang}} cells`, lang, cells: n, text, lines: 7 * n + 1, startLineOf: (i) => 7 * i, kept: (i) => [`x = ${i}`, "y = 2"] };
}

/** `n` blocks of: the fence, `#| echo: false`, nine body lines `v0 = i` .. `v8 = i`, the closing fence (12 lines), a blank line, `prose i` (14 lines a block). */
function twelveLineShape(n: number, lang: string): Shape {
  const body = (i: number): string[] => Array.from({ length: 9 }, (_, j) => `v${j} = ${i}`);
  let text = "";
  for (let i = 0; i < n; i++) {
    text += `${FENCE}{${lang}}\n#| echo: false\n${body(i).join("\n")}\n${FENCE}\n\nprose ${i}\n`;
  }
  return { label: `${n} twelve-line {${lang}} cells`, lang, cells: n, text, lines: 14 * n + 1, startLineOf: (i) => 14 * i, kept: body };
}

/** `n` cells (fence, option line, `x = i`, closing fence, a blank line) each followed by `gap` lines of `p`: few cells in a very long document. */
function longShape(n: number, gap: number): Shape {
  const filler = "p\n".repeat(gap);
  let text = "";
  for (let i = 0; i < n; i++) {
    text += `${FENCE}{python}\n#| echo: false\nx = ${i}\n${FENCE}\n\n${filler}`;
  }
  return { label: `${n} python cells in a document of ${(n * (5 + gap) + 1).toLocaleString("en-US")} lines`, lang: "python", cells: n, text, lines: n * (5 + gap) + 1, startLineOf: (i) => i * (5 + gap), kept: (i) => [`x = ${i}`] };
}

/** What `build` must hand back for a cell of `shape`: this many characters (the newlines, the kept lines, and the mute of a python cell). */
function expectedChars(shape: Shape): number {
  const mute = shape.lang === "python" ? TYPE_IGNORE_DIRECTIVE.length : 0;
  let total = 0;
  for (let i = 0; i < shape.cells; i++) {
    total += shape.lines - 1 + mute;
    for (const line of shape.kept(i)) total += line.length;
  }
  return total;
}

/** The (line, text) of every non-empty line of a vdoc, read with a loop so that a two-million-line string is not mapped. */
function nonEmptyLines(vdoc: string): Array<[number, string]> {
  const found: Array<[number, string]> = [];
  let line = 0;
  let from = 0;
  for (;;) {
    const to = vdoc.indexOf("\n", from);
    const end = to === -1 ? vdoc.length : to;
    if (end > from) found.push([line, vdoc.slice(from, end)]);
    if (to === -1) return found;
    line++;
    from = to + 1;
  }
}

const LIMIT_MS = 1000;

/** Run the adapter's loop over `shape`, the clock on it, and read the answer back. The model's scan is warmed first: it is the model's cost, the same for the parent and the cure, and `buildOutline` has paid it before the adapter's loop starts. */
function runAdapterLoop(shape: Shape): { ms: number; firstMs: number; builds: number; chars: number; checked: number } {
  const starts = findAllCells(shape.text).map((c) => c.startLine);
  expect(starts).toHaveLength(shape.cells);
  expect(starts[0]).toBe(shape.startLineOf(0));
  expect(starts[shape.cells - 1]).toBe(shape.startLineOf(shape.cells - 1));
  let firstMs = 0;
  let builds = 0;
  let chars = 0;
  let sink = 0;
  const started = performance.now();
  const builder = createCellVdocBuilder(shape.text);
  for (const start of starts) {
    const cell = builder.cellAt(start);
    if (cell === null) continue;
    const vdoc = builder.build(cell);
    chars += vdoc.length;
    sink ^= vdoc.charCodeAt(vdoc.length >> 1); // reads the middle of the string: a string built by concatenation is really laid out here
    builds++;
    if (builds === 1) firstMs = performance.now() - started;
  }
  const ms = performance.now() - started;
  expect(typeof sink).toBe("number");
  // Read the answer back AFTER the clock, on three cells: the first, the middle, the last.
  const mute = shape.lang === "python";
  let checked = 0;
  for (const i of [0, shape.cells >> 1, shape.cells - 1]) {
    const vdoc = builder.build(builder.cellAt(starts[i])!);
    const start = shape.startLineOf(i);
    expect(nonEmptyLines(vdoc)).toEqual([
      ...(mute ? [[0, TYPE_IGNORE_DIRECTIVE] as [number, string]] : []),
      ...shape.kept(i).map((line, j) => [start + 2 + j, line] as [number, string]),
    ]);
    expect(vdoc.split("\n")).toHaveLength(shape.lines);
    checked++;
  }
  return { ms, firstMs, builds, chars, checked };
}

describe("Session 341 -- the Outline's per-cell virtual documents cost cells times document (the BACKLOG item \"Slow shapes and residuals found by Session 339's review round\", part 2)", () => {
  const RATIO = 100;

  it.each([
    ["2,000 six-line python cells (the shape the item measured)", () => sixLineShape(2000, "python"), true],
    ["2,000 six-line r cells (no mute, no whole-document `some`)", () => sixLineShape(2000, "r"), true],
    ["1,600 twelve-line python cells", () => twelveLineShape(1600, "python"), true],
    ["60 python cells in a document of 1,980,301 lines (few cells, a very long document)", () => longShape(60, 33_000), false],
  ] as Array<[string, () => Shape, boolean]>)("%s: one builder, a lookup and a build per cell, in under one second, with the stated answers", (_label, make, ratio) => {
    const shape = make();
    const run = runAdapterLoop(shape);
    expect(run.builds).toBe(shape.cells);
    expect(run.chars).toBe(expectedChars(shape));
    expect(run.checked).toBe(3);
    expect(run.ms).toBeLessThan(LIMIT_MS);
    // A ratio no load of the machine moves (Learning 877): the whole loop against its first call. A builder that pays for the document once makes every later cell cheap; the parent pays the same for each.
    if (ratio) expect(run.ms).toBeLessThan(RATIO * run.firstMs);
  }, 120_000);

  // CONTROLS: shapes that cost the parent little. They pass on it, and they say that the fixtures are not what is slow.
  it.each([
    ["CONTROL: 250 six-line python cells", () => sixLineShape(250, "python")],
    ["CONTROL: ONE python cell in a document of 1,980,301 lines (one build over the whole document is the inherent cost)", () => longShape(1, 1_980_296)],
  ] as Array<[string, () => Shape]>)("%s: stays under one second, with the stated answers", (_label, make) => {
    const shape = make();
    const run = runAdapterLoop(shape);
    expect(run.builds).toBe(shape.cells);
    expect(run.chars).toBe(expectedChars(shape));
    expect(run.ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The rows above fix the sizes and the limit: 200 cells, or a limit of 100 s, would pass the parent too.
  it("keeps the sizes and the limit the clock rows are built on", () => {
    expect([LIMIT_MS, RATIO, sixLineShape(2000, "python").lines, twelveLineShape(1600, "python").lines, longShape(60, 33_000).lines]).toEqual([1000, 100, 14_001, 22_401, 1_980_301]);
  });
});
