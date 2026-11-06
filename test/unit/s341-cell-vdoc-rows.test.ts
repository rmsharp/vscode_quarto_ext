import { describe, expect, it } from "vitest";
import { type Cell, findAllCells, findCellAtPosition } from "../../src/core/qmd/model";
import {
  type CellVdocBuilder,
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
// cells at load 3.7; the same with `{r}` cells 4,501 ms at 2,000 at load 4.1; 12-line cells (fence, option line, nine body lines, fence) 4,125 ms at 1,600 (22,401 lines) at load 5.3. The cost is cells times
// document: every build splits the whole text, reads every cell's option lines again and maps over every line.
//
// THE LONG DOCUMENT changed in the review round (Session 341, TD-5 / TD-9). It was 60 cells in 1,980,301 lines (3,604 ms at the parent, ratio 70.5, below `RATIO`, so it had no ratio and only the clock guarded it, and
// the file peaked at 1.03 GB resident, the model's own tables over two million lines). The parent's cost is the cells times the lines, so 120 cells in 990,001 lines cost it the same (3.69 to 3.74 s) with half the text, and
// 120 cells push its ratio (133 to 138) above a limit the cure's (1.9 to 2.1) is far under: `LONG_RATIO` below.
//
// Measured again at the seam commit `00f85d4` (the parent's logic behind the builder), the four shapes as they now are, one fresh process each, load 8 to 25: 4.35 to 4.37 s on 2,000 six-line python cells (the loop against
// its first call 833 to 855), 4.24 to 4.32 s on the r cells (779 to 794), 3.90 to 3.92 s on the 12-line cells (816 to 843), 3.69 to 3.74 s on the long document (133 to 138). The cure on the same four: 9.7 to 10.8 / 9.7 to 10.1 /
// 11.2 to 11.5 / 27.4 to 28.5 ms, the ratio 2.1 to 2.7 on the first three and 1.9 to 2.1 on the long one.
//
// The limit is one second. It is not raised to make a row pass: the parent is 3.7 to 4.4 times over it on every row, and the limit and the ratio each fail it alone (`K05` of `s341-cell-vdoc.json` is the limit raised, with the
// consequence recorded there). The ratio is the loop against its first call, which no load moves (Learning 877). Every row states its ANSWER before the clock: the number of builds, the total length of the strings, and the exact
// non-empty lines of three sampled cells (the first, the middle, the last), read back after the loop.
//
// The clock itself is pinned by the helper rows below (`timeLoop` and `loopRatio` have rows of their own): a clock stuck at 0 made every row of this file pass on the parent's logic until the review round (C02 / TD-1).

/** What one run of the adapter's loop measured: the builder it made, the whole loop's milliseconds, the milliseconds up to the end of the first build, and how many builds it did and how many characters they held. */
interface TimedLoop {
  builder: CellVdocBuilder;
  ms: number;
  firstMs: number;
  builds: number;
  chars: number;
}

/**
 * The adapter's loop with the clock on it: `make` builds the builder INSIDE the clock (a builder that read the text when it was made would pay for it here), then, for every start line, `cellAt` and `build`.
 * `now` is the clock in milliseconds: the rows run it on `performance.now()`, and the helper's own rows on a clock that only the fake builder advances, so that what it reads is exact on any load.
 */
function timeLoop(make: () => CellVdocBuilder, starts: readonly number[], now: () => number = () => performance.now()): TimedLoop {
  let firstMs = 0;
  let builds = 0;
  let chars = 0;
  let sink = 0;
  const started = now();
  const builder = make();
  for (const start of starts) {
    const cell = builder.cellAt(start);
    if (cell === null) continue;
    const vdoc = builder.build(cell);
    chars += vdoc.length;
    sink ^= vdoc.charCodeAt(vdoc.length >> 1); // reads the middle of the string: a string built by concatenation is really laid out here
    builds++;
    if (builds === 1) firstMs = now() - started;
  }
  const ms = now() - started;
  expect(typeof sink).toBe("number");
  return { builder, ms, firstMs, builds, chars };
}

/** The whole loop against its first call: a builder that pays for the document once makes every later cell cheap (a ratio near 2 to 3), the parent pays the same for each (a ratio near the number of cells or above). */
const loopRatio = (run: { ms: number; firstMs: number }): number => run.ms / run.firstMs;

/** The last tenth of a run of calls costs about what the first tenth did: at most 4x, and a 100 ms floor keeps a garbage-collection pause from deciding it (the helper part 3 uses). */
const lastTenthWithin = (firstMs: number, lastMs: number): boolean => lastMs < 4 * firstMs + 100;

/** A fake builder: it spins `construct` ms in its construction and `ask` / `build` ms in each call, on the real clock, and answers a cell on every line. */
function spinningBuilder(construct: number, ask: number, build: number): () => CellVdocBuilder {
  const spin = (ms: number): void => {
    const started = performance.now();
    while (performance.now() - started < ms) {
      /* spin */
    }
  };
  return () => {
    spin(construct);
    return {
      cellAt: (line: number): Cell | null => {
        spin(ask);
        return { startLine: line, endLine: line + 2, lang: "python", code: "x" };
      },
      build: (): string => {
        spin(build);
        return "vdoc";
      },
    };
  };
}

describe("the Session 341 clock helpers (the clock rows' own clock is pinned here: Session 341 review, C02 / TD-1)", () => {
  it("timeLoop reads the builder's construction, the first call and every call after it, on a clock only the fake builder advances: the numbers are exact on any load", () => {
    let t = 1000;
    const make = (): CellVdocBuilder => {
      t += 20; // the construction
      return {
        cellAt: (line) => {
          t += 3;
          return { startLine: line, endLine: line + 2, lang: "python", code: "x" };
        },
        build: () => {
          t += 7;
          return "vdoc";
        },
      };
    };
    const run = timeLoop(make, [0, 10, 20, 30], () => t);
    expect(run.builds).toBe(4);
    expect(run.chars).toBe(16);
    expect(run.firstMs).toBe(20 + 3 + 7);
    expect(run.ms).toBe(20 + 4 * (3 + 7));
  });

  it("timeLoop counts a build only for a cell found, and the first call is the first BUILD: a start line with no cell costs its lookup and no build", () => {
    let t = 0;
    const make = (): CellVdocBuilder => ({
      cellAt: (line) => {
        t += 1;
        return line === 10 ? null : { startLine: line, endLine: line + 2, lang: "python", code: "x" };
      },
      build: () => {
        t += 100;
        return "vd";
      },
    });
    const run = timeLoop(make, [10, 20, 10, 30], () => t);
    expect(run.builds).toBe(2);
    expect(run.chars).toBe(4);
    expect(run.firstMs).toBe(2 + 100); // the lookup that found nothing, then the lookup and the build of the first cell found
    expect(run.ms).toBe(4 + 2 * 100); // four lookups, two builds
  });

  it("timeLoop's default clock is real time: a builder that spins 20 ms in its construction and 20 ms per build is read as at least that, and the first call is not the total", () => {
    const run = timeLoop(spinningBuilder(20, 0, 20), [0, 1, 2]);
    expect(run.builds).toBe(3);
    expect(run.ms).toBeGreaterThanOrEqual(20 + 3 * 20 - 1);
    expect(run.firstMs).toBeGreaterThanOrEqual(20 + 20 - 1);
    // the two builds after the first take 40 ms whatever the load, so the total exceeds the first call by that much (a first call read as the total, or as 0 or as 1e9, cannot)
    expect(run.ms - run.firstMs).toBeGreaterThanOrEqual(40 - 1);
  });

  it("loopRatio is the whole loop over its first call: 4,619 ms over 5.5 is 840, a builder that pays once is about 2", () => {
    expect(loopRatio({ ms: 100, firstMs: 4 })).toBe(25);
    expect(loopRatio({ ms: 4619, firstMs: 5.5 })).toBeCloseTo(839.8, 1);
    expect(loopRatio({ ms: 28, firstMs: 14 })).toBe(2);
    expect(loopRatio({ ms: 4, firstMs: 100 })).toBe(0.04);
    expect(loopRatio({ ms: 10, firstMs: 0 })).toBe(Infinity); // a first call read as 0 is no ratio at all, and fails every limit
  });

  it("lastTenthWithin accepts up to four times the first tenth plus 100 ms, and refuses what a pass over every cell costs at the bottom of the document (739 against 42 ms)", () => {
    expect(lastTenthWithin(10, 139.9)).toBe(true);
    expect(lastTenthWithin(10, 140)).toBe(false);
    expect(lastTenthWithin(0, 99.9)).toBe(true);
    expect(lastTenthWithin(0, 100)).toBe(false);
    expect(lastTenthWithin(41.5, 739)).toBe(false);
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
/** The ratio limit: the whole loop against its first call. The parent's ratio on the three shapes with many cells is 779 to 855, the cure's 2.1 to 2.7. */
const RATIO = 100;
/**
 * The ratio limit of the long document, which has few cells: the parent pays the same for each of its 120 cells, so its ratio is bounded by about the number of cells (133 to 138 measured), below `RATIO`. The cure's is 1.9 to 2.1:
 * 20 sits 6.5x under the parent and 10x over the cure.
 */
const LONG_RATIO = 20;
/** The sizes of the clock rows. Named once so that the sizes row below reads the very values the rows run on. */
const SIX_CELLS = 2000;
const TWELVE_CELLS = 1600;
const LONG_CELLS = 120;
const LONG_GAP = 8_245;
const CONTROL_CELLS = 250;
/** The one-cell control sits in a document of the same 990,001 lines as the long shape. */
const CONTROL_GAP = LONG_CELLS * (5 + LONG_GAP) - 5;

/** Which of the two clock criteria a run breaks, each named with its numbers: the whole loop under `LIMIT_MS`, and the loop against its first call under `ratioLimit`. `[]` is a run that keeps both. */
function clockBreaks(run: { ms: number; firstMs: number }, ratioLimit: number): string[] {
  const broken: string[] = [];
  if (!(run.ms < LIMIT_MS)) broken.push(`the loop took ${run.ms.toFixed(1)} ms, not under ${LIMIT_MS} ms`);
  if (!(loopRatio(run) < ratioLimit)) broken.push(`the loop took ${loopRatio(run).toFixed(1)} times its first call, not under ${ratioLimit} times`);
  return broken;
}

describe("the Session 341 clock criteria (clockBreaks), fed the numbers the parent and the cure were measured at", () => {
  it("the parent's measurements break both criteria on every shape, the cure's break neither", () => {
    expect(clockBreaks({ ms: 4619, firstMs: 5.5 }, RATIO)).toHaveLength(2); // 2,000 six-line python cells at the parent
    expect(clockBreaks({ ms: 3920, firstMs: 4.6 }, RATIO)).toHaveLength(2); // 1,600 twelve-line cells at the parent
    expect(clockBreaks({ ms: 3690, firstMs: 27.6 }, LONG_RATIO)).toHaveLength(2); // the long document at the parent
    expect(clockBreaks({ ms: 9.9, firstMs: 4.7 }, RATIO)).toEqual([]); // the same six-line cells at the cure
    expect(clockBreaks({ ms: 28.2, firstMs: 13.7 }, LONG_RATIO)).toEqual([]); // the long document at the cure
  });

  it("each criterion fails alone: a slow run with a slow first call breaks the limit only, a fast run that pays the same for every call breaks the ratio only", () => {
    expect(clockBreaks({ ms: 4600, firstMs: 4000 }, RATIO)).toEqual(["the loop took 4600.0 ms, not under 1000 ms"]);
    expect(clockBreaks({ ms: 900, firstMs: 5 }, RATIO)).toEqual(["the loop took 180.0 times its first call, not under 100 times"]);
  });

  it("both limits are strict, and a first call read as 0 or a loop read as NaN keeps neither", () => {
    expect(clockBreaks({ ms: 999.9, firstMs: 100 }, RATIO)).toEqual([]);
    expect(clockBreaks({ ms: 1000, firstMs: 100 }, RATIO)).toHaveLength(1);
    expect(clockBreaks({ ms: 500, firstMs: 5.01 }, RATIO)).toEqual([]); // 99.8 times
    expect(clockBreaks({ ms: 500, firstMs: 5 }, RATIO)).toHaveLength(1); // exactly 100 times
    expect(clockBreaks({ ms: 10, firstMs: 0 }, RATIO)).toHaveLength(1);
    expect(clockBreaks({ ms: NaN, firstMs: 5 }, RATIO)).toHaveLength(2);
  });
});

/** Run the adapter's loop over `shape`, the clock on it, and read the answer back. The model's scan is warmed first: it is the model's cost, the same for the parent and the cure, and `buildOutline` has paid it before the adapter's loop starts. */
function runAdapterLoop(shape: Shape): { ms: number; firstMs: number; builds: number; chars: number; checked: number } {
  const starts = findAllCells(shape.text).map((c) => c.startLine);
  expect(starts).toHaveLength(shape.cells);
  expect(starts[0]).toBe(shape.startLineOf(0));
  expect(starts[shape.cells - 1]).toBe(shape.startLineOf(shape.cells - 1));
  const { builder, ms, firstMs, builds, chars } = timeLoop(() => createCellVdocBuilder(shape.text), starts);
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

/** The four clock rows: a shape and the ratio its loop must keep to its first call. Named once so that the sizes row below reads the ratios the rows run on. */
const CLOCK_ROWS: Array<{ label: string; make: () => Shape; ratioLimit: number }> = [
  { label: "2,000 six-line python cells (the shape the item measured)", make: () => sixLineShape(SIX_CELLS, "python"), ratioLimit: RATIO },
  { label: "2,000 six-line r cells (no mute, no whole-document `some`)", make: () => sixLineShape(SIX_CELLS, "r"), ratioLimit: RATIO },
  { label: "1,600 twelve-line python cells", make: () => twelveLineShape(TWELVE_CELLS, "python"), ratioLimit: RATIO },
  { label: "120 python cells in a document of 990,001 lines (few cells, a very long document)", make: () => longShape(LONG_CELLS, LONG_GAP), ratioLimit: LONG_RATIO },
];

describe("Session 341 -- the Outline's per-cell virtual documents cost cells times document (the BACKLOG item \"Slow shapes and residuals found by Session 339's review round\", part 2)", () => {
  it.each(CLOCK_ROWS.map((row) => [row.label, row] as const))("%s: one builder, a lookup and a build per cell, in under one second and within its ratio of the first call, with the stated answers", (_label, row) => {
    const shape = row.make();
    const run = runAdapterLoop(shape);
    expect(run.builds).toBe(shape.cells);
    expect(run.chars).toBe(expectedChars(shape));
    expect(run.checked).toBe(3);
    // The limit, and a ratio no load of the machine moves (Learning 877): the whole loop against its first call. A builder that pays for the document once makes every later cell cheap; the parent pays the same for each.
    expect(clockBreaks(run, row.ratioLimit)).toEqual([]);
  }, 120_000);

  // CONTROLS: shapes that cost the parent little. They pass on it, and they say that the fixtures are not what is slow.
  it.each([
    ["CONTROL: 250 six-line python cells", () => sixLineShape(CONTROL_CELLS, "python")],
    ["CONTROL: ONE python cell in a document of 990,001 lines (one build over the whole document is the inherent cost)", () => longShape(1, CONTROL_GAP)],
  ] as Array<[string, () => Shape]>)("%s: stays under one second, with the stated answers", (_label, make) => {
    const shape = make();
    const run = runAdapterLoop(shape);
    expect(run.builds).toBe(shape.cells);
    expect(run.chars).toBe(expectedChars(shape));
    expect(run.ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The rows above fix the sizes and the limit: 200 cells, or a limit of 100 s, would pass the parent too. Every size is a named constant, read here, so a changed one fails this row.
  it("keeps the sizes and the limit the clock rows are built on", () => {
    expect([LIMIT_MS, RATIO, LONG_RATIO, SIX_CELLS, TWELVE_CELLS, LONG_CELLS, LONG_GAP, CONTROL_CELLS, CONTROL_GAP]).toEqual([1000, 100, 20, 2000, 1600, 120, 8245, 250, 989_995]);
    expect([sixLineShape(SIX_CELLS, "python").lines, twelveLineShape(TWELVE_CELLS, "python").lines, longShape(LONG_CELLS, LONG_GAP).lines, longShape(1, CONTROL_GAP).lines]).toEqual([14_001, 22_401, 990_001, 990_001]);
    expect(CLOCK_ROWS.map((row) => row.ratioLimit)).toEqual([100, 100, 100, 20]);
  });
});
