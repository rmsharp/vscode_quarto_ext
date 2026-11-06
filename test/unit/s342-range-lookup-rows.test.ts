import { describe, expect, it } from "vitest";
import { type Cell, findAllCells } from "../../src/core/qmd/model";
import { type RangeLookup, createRangeLookup } from "../../src/core/embedded/virtual-doc";

// Session 342 -- the BACKLOG item "What Session 341's review round found beside the Outline and preview cures", part (3). Two adapters keep an edit from a language server only when every line of its range is body of
// the right cell: the completion list's `additionalTextEdits` (`filterOutOfCellEdits` in `src/providers/embedded.ts`: body of a cell of the completion's language) and a formatter's edits (`rangeWithinCell` in
// `src/features/format-cell.ts`: body of the cursor's own cell). Each asked `embeddedCellAt(text, line)` (and the second `findCellAtPosition(text, line)`) once per LINE of every range, and each of those is a scan of every
// cell plus every cell's option lines. `createRangeLookup(text)` is made once per call and answers the same questions over plain NUMBERS, so a unit test reaches what a vscode adapter hid.
//
// This file holds the ANSWER rows (they pass on the seam, where the old per-line logic is inside the lookup, and state what the lookup must answer) and the CLOCK rows (they are the reason for the change). The old
// spelling is kept verbatim as the oracle in `range-lookup-equivalence.test.ts`.

/** The line numbers are in the comments: the document is read through its own numbers, so a row names the line it means. */
const DOC = [
  "---", // 0
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Intro prose.", // 4
  "```{python}", // 5   cell A: lines 5 to 10
  "#| echo: false", // 6   its option line
  "import os", // 7
  "  ", // 8   a whitespace-only body line
  "x = 1", // 9
  "```", // 10
  "", // 11
  "```{python}", // 12  cell B: lines 12 to 14
  "y = 2", // 13
  "```", // 14
  "```{r}", // 15  cell C: lines 15 to 17
  "z <- 3", // 16
  "```", // 17
  "```{bash}", // 18  cell D: lines 18 to 20, an engine the project does not map
  "echo hi", // 19
  "```", // 20
].join("\n");

const A = 5;
const B = 12;
const C = 15;

function cellStartingAt(text: string, startLine: number): Cell {
  const cell = findAllCells(text).find((c) => c.startLine === startLine);
  expect(cell).toBeDefined();
  return cell as Cell;
}

describe("createRangeLookup -- the answers (Session 342)", () => {
  const lookup = createRangeLookup(DOC);

  it("hitAt names the language of a body line, a whitespace-only one too", () => {
    expect(lookup.hitAt(7)).toEqual({ lang: "python", languageId: "python", ext: "py" });
    expect(lookup.hitAt(8)).toEqual({ lang: "python", languageId: "python", ext: "py" });
    expect(lookup.hitAt(9)).toEqual({ lang: "python", languageId: "python", ext: "py" });
    expect(lookup.hitAt(13)).toEqual({ lang: "python", languageId: "python", ext: "py" });
    expect(lookup.hitAt(16)).toEqual({ lang: "r", languageId: "r", ext: "r" });
  });

  it("hitAt is null on a fence line, a `#|` option line, prose, front matter, an unmapped engine's body and a line past the end", () => {
    const nothing = [5, 10, 12, 14, 15, 17, 18, 20, 6, 4, 11, 0, 1, 2, 3, 19, 21, 99, -1];
    expect(nothing.map((line) => lookup.hitAt(line))).toEqual(nothing.map(() => null));
  });

  it("rangeInLanguageBody: one line and many, inside one cell", () => {
    expect(lookup.rangeInLanguageBody(7, 7, "python")).toBe(true);
    expect(lookup.rangeInLanguageBody(7, 9, "python")).toBe(true);
    expect(lookup.rangeInLanguageBody(13, 13, "python")).toBe(true);
    expect(lookup.rangeInLanguageBody(16, 16, "r")).toBe(true);
  });

  it("rangeInLanguageBody: a line that is not body breaks the range wherever it stands in it", () => {
    expect(lookup.rangeInLanguageBody(5, 5, "python")).toBe(false); // the opening fence
    expect(lookup.rangeInLanguageBody(6, 6, "python")).toBe(false); // the option line
    expect(lookup.rangeInLanguageBody(6, 9, "python")).toBe(false); // the option line first
    expect(lookup.rangeInLanguageBody(7, 10, "python")).toBe(false); // the closing fence last
    expect(lookup.rangeInLanguageBody(9, 13, "python")).toBe(false); // one cell into the next: the fences between
    expect(lookup.rangeInLanguageBody(0, 0, "python")).toBe(false); // front matter
    expect(lookup.rangeInLanguageBody(4, 4, "python")).toBe(false); // prose
  });

  it("rangeInLanguageBody: a cell of a different language, an unmapped engine and lines past the end are not the language's body", () => {
    expect(lookup.rangeInLanguageBody(13, 13, "r")).toBe(false);
    expect(lookup.rangeInLanguageBody(16, 16, "python")).toBe(false);
    expect(lookup.rangeInLanguageBody(19, 19, "bash")).toBe(false);
    expect(lookup.rangeInLanguageBody(19, 19, "python")).toBe(false);
    expect(lookup.rangeInLanguageBody(21, 25, "python")).toBe(false);
  });

  it("rangeInLanguageBody: a range with start above end has no line to refuse, so it is in the body whatever it points at", () => {
    expect(lookup.rangeInLanguageBody(7, 6, "python")).toBe(true);
    expect(lookup.rangeInLanguageBody(10, 5, "python")).toBe(true);
    expect(lookup.rangeInLanguageBody(0, -1, "r")).toBe(true);
    expect(lookup.rangeInLanguageBody(99, 3, "python")).toBe(true);
  });

  it("rangeInCellBody: the lines of the cell's own body, one and many", () => {
    const cellA = cellStartingAt(DOC, A);
    expect(lookup.rangeInCellBody(7, 7, cellA)).toBe(true);
    expect(lookup.rangeInCellBody(7, 9, cellA)).toBe(true);
    expect(lookup.rangeInCellBody(13, 13, cellStartingAt(DOC, B))).toBe(true);
    expect(lookup.rangeInCellBody(16, 16, cellStartingAt(DOC, C))).toBe(true);
  });

  it("rangeInCellBody: the body of a DIFFERENT cell, even one of the same language, is not the cell's", () => {
    const cellA = cellStartingAt(DOC, A);
    expect(lookup.rangeInCellBody(13, 13, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(16, 16, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(7, 7, cellStartingAt(DOC, B))).toBe(false);
  });

  it("rangeInCellBody: a range that starts in one cell and ends in another is refused, and so is one that touches a fence, an option line, prose or front matter", () => {
    const cellA = cellStartingAt(DOC, A);
    const cellB = cellStartingAt(DOC, B);
    expect(lookup.rangeInCellBody(9, 13, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(9, 13, cellB)).toBe(false);
    expect(lookup.rangeInCellBody(5, 5, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(6, 6, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(6, 9, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(7, 10, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(4, 4, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(0, 0, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(19, 19, cellStartingAt(DOC, 18))).toBe(false); // an unmapped engine's cell is nobody's body
    expect(lookup.rangeInCellBody(21, 25, cellA)).toBe(false);
  });

  it("rangeInCellBody: start above end has no line, so it is in the body", () => {
    const cellA = cellStartingAt(DOC, A);
    expect(lookup.rangeInCellBody(7, 6, cellA)).toBe(true);
    expect(lookup.rangeInCellBody(16, 4, cellA)).toBe(true);
  });

  it("a lookup is reusable and does not remember a question: the same asks twice, in any order, give the same answers", () => {
    const fresh = createRangeLookup(DOC);
    const asks: Array<(l: RangeLookup) => boolean> = [
      (l) => l.rangeInLanguageBody(7, 9, "python"),
      (l) => l.rangeInLanguageBody(9, 13, "python"),
      (l) => l.rangeInCellBody(13, 13, cellStartingAt(DOC, A)),
      (l) => l.rangeInCellBody(13, 13, cellStartingAt(DOC, B)),
      (l) => l.hitAt(16) !== null,
      (l) => l.hitAt(6) !== null,
    ];
    const first = asks.map((ask) => ask(fresh));
    const reversed = [...asks].reverse().map((ask) => ask(fresh)).reverse();
    expect(first).toEqual([true, false, false, true, true, false]);
    expect(reversed).toEqual(first);
  });

  it("two lookups over two texts share nothing", () => {
    const other = createRangeLookup("```{r}\nz\n```\n");
    expect(other.hitAt(1)).toEqual({ lang: "r", languageId: "r", ext: "r" });
    expect(lookup.hitAt(1)).toBeNull();
    expect(lookup.hitAt(7)).not.toBeNull();
    expect(other.hitAt(7)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK (Session 342). The two loops the adapters run, on ONE lookup made for the call:
//
//   completion: for every edit of every item of the list, `rangeInLanguageBody(start, end, "python")`;
//   format:     for every edit the formatter returned, `rangeInCellBody(start, end, cell)`.
//
// The shape is the one the item measured: a four-line header, then cells of `# H<i>`, a blank line, a `` ```{python} `` fence, `#| echo: false`, EIGHTEEN body lines, the closing fence and a blank line (24 lines a cell).
//
// Measured at the seam (the parent's per-line logic inside the lookup; one fresh process per timing, Node, `embeddedCellAt` on ONE body line of the middle cell with the model's scan warm, load 2.9 to 3.3): 0.58 / 2.32 /
// 9.48 ms at 500 / 2,000 / 8,000 cells (linear in the cells, paid per LINE of every range), and 11.2 / 44.1 / 181.5 ms for the 18 body lines of one cell; the item's own 500-line edit loop (`embeddedCellAt` and
// `findCellAtPosition` per line) 938 ms at 2,000 cells. The model's scan is warmed first in every row: it is the model's cost, the same for every spelling, and both adapters have paid it before the lookup is made (the
// gate `embeddedCellAt(text, position.line)` runs first in each).
//
// A row's clock is TWO criteria. The loop under one second (`LIMIT_MS`: the parent breaks it only on the largest document, so it is a net and not the reason), and the loop against its FIRST ask in the same process
// (`RATIO`): a lookup that pays for the text once makes every later ask cheap, so the loop costs about what the first ask did, while the parent pays about the same for every ask and the loop is that many times the first.
// A machine that is slow all through moves both and cancels (Learning 877). The first ask includes making the lookup, so a lookup that read the text when it was made would not hide its cost from the ratio either.

/** What one run of an adapter's loop measured: the lookup it made, the whole loop's milliseconds, the milliseconds up to the end of the first ask, and each ask's answer. */
interface TimedAsks {
  lookup: RangeLookup;
  ms: number;
  firstMs: number;
  answers: boolean[];
}

/**
 * The adapter's loop with the clock on it: `make` makes the lookup INSIDE the clock, then every ask in turn. `now` is the clock in milliseconds: the rows run it on `performance.now()`, and the helper's own rows on a
 * clock that only the fake lookup advances, so that what it reads is exact on any load.
 */
function timeAsks(make: () => RangeLookup, asks: ReadonlyArray<(lookup: RangeLookup) => boolean>, now: () => number = () => performance.now()): TimedAsks {
  const answers: boolean[] = [];
  let firstMs = 0;
  const started = now();
  const lookup = make();
  for (const ask of asks) {
    answers.push(ask(lookup));
    if (answers.length === 1) firstMs = now() - started;
  }
  const ms = now() - started;
  return { lookup, ms, firstMs, answers };
}

/** The whole loop against its first ask: a lookup that pays once makes every later ask cheap (a ratio near 1), the parent pays the same for each (a ratio near the number of lines asked, or above). */
const asksRatio = (run: { ms: number; firstMs: number }): number => run.ms / run.firstMs;

/** A fake lookup: it spins `construct` ms in its construction and `ask` ms in each of its three questions, on the real clock, and answers `true` to every range. */
function spinningLookup(construct: number, ask: number): () => RangeLookup {
  const spin = (ms: number): void => {
    const started = performance.now();
    while (performance.now() - started < ms) {
      /* spin */
    }
  };
  return () => {
    spin(construct);
    return {
      hitAt: () => {
        spin(ask);
        return null;
      },
      rangeInLanguageBody: () => {
        spin(ask);
        return true;
      },
      rangeInCellBody: () => {
        spin(ask);
        return true;
      },
    };
  };
}

describe("the Session 342 clock helpers (the clock rows' own clock is pinned here: Learning 910)", () => {
  it("timeAsks reads the lookup's construction, the first ask and every ask after it, on a clock only the fake lookup advances: the numbers are exact on any load", () => {
    let t = 1000;
    const make = (): RangeLookup => {
      t += 20; // the construction
      return {
        hitAt: () => null,
        rangeInLanguageBody: () => {
          t += 3;
          return true;
        },
        rangeInCellBody: () => {
          t += 7;
          return false;
        },
      };
    };
    const asks = [(l: RangeLookup) => l.rangeInLanguageBody(0, 0, "python"), (l: RangeLookup) => l.rangeInCellBody(0, 0, { startLine: 0, endLine: 2, lang: "python", code: "" }), (l: RangeLookup) => l.rangeInLanguageBody(1, 1, "python")];
    const run = timeAsks(make, asks, () => t);
    expect(run.answers).toEqual([true, false, true]);
    expect(run.firstMs).toBe(20 + 3);
    expect(run.ms).toBe(20 + 3 + 7 + 3);
  });

  it("timeAsks with no ask costs the construction and reads no first ask", () => {
    let t = 0;
    const run = timeAsks(() => {
      t += 5;
      return spinningLookup(0, 0)();
    }, [], () => t);
    expect(run.answers).toEqual([]);
    expect(run.ms).toBe(5);
    expect(run.firstMs).toBe(0);
  });

  it("timeAsks's default clock is real time: a lookup that spins 20 ms in its construction and 20 ms per ask is read as at least that, and the first ask is not the total", () => {
    const ask = (l: RangeLookup): boolean => l.rangeInLanguageBody(0, 0, "python");
    const run = timeAsks(spinningLookup(20, 20), [ask, ask, ask]);
    expect(run.answers).toEqual([true, true, true]);
    expect(run.ms).toBeGreaterThanOrEqual(20 + 3 * 20 - 1);
    expect(run.firstMs).toBeGreaterThanOrEqual(20 + 20 - 1);
    // the two asks after the first take 40 ms whatever the load, so the total exceeds the first ask by that much (a first ask read as the total, or as 0 or as 1e9, cannot)
    expect(run.ms - run.firstMs).toBeGreaterThanOrEqual(40 - 1);
  });

  it("asksRatio is the whole loop over its first ask: 2,800 ms over 9.4 is 298, a lookup that pays once is about 1", () => {
    expect(asksRatio({ ms: 100, firstMs: 4 })).toBe(25);
    expect(asksRatio({ ms: 2800, firstMs: 9.4 })).toBeCloseTo(297.9, 1);
    expect(asksRatio({ ms: 3, firstMs: 3 })).toBe(1);
    expect(asksRatio({ ms: 4, firstMs: 100 })).toBe(0.04);
    expect(asksRatio({ ms: 10, firstMs: 0 })).toBe(Infinity); // a first ask read as 0 is no ratio at all, and fails every limit
  });
});

const LIMIT_MS = 1000;
/** The ratio limit: the whole loop against its first ask. The parent's is the number of lines asked (300 asks, or a 200-line range after a one-line one: about 200 to 400), the cure's about 1 to 2. */
const RATIO = 30;

/**
 * Which of the clock criteria a run breaks, each named with its numbers. `[]` is a run that keeps all of them. The first two say that the clock ran at all: a clock stuck at 0 (or a total read as 0, or below the first ask)
 * would pass the other two, and a row that cannot fail is not a row (Learning 910).
 */
function clockBreaks(run: { ms: number; firstMs: number }): string[] {
  const broken: string[] = [];
  if (!(run.firstMs > 0)) broken.push(`the first ask read ${run.firstMs} ms: the clock did not run`);
  if (!(run.ms >= run.firstMs)) broken.push(`the loop read ${run.ms} ms, less than its first ask (${run.firstMs} ms)`);
  if (!(run.ms < LIMIT_MS)) broken.push(`the loop took ${run.ms.toFixed(1)} ms, not under ${LIMIT_MS} ms`);
  if (!(asksRatio(run) < RATIO)) broken.push(`the loop took ${asksRatio(run).toFixed(1)} times its first ask, not under ${RATIO} times`);
  return broken;
}

describe("the Session 342 clock criteria (clockBreaks), fed the numbers the parent and the cure were measured at", () => {
  it("the parent's measurements break the ratio on every shape, and the limit on the largest; the cure's break neither", () => {
    expect(clockBreaks({ ms: 177, firstMs: 0.6 })).toHaveLength(1); // 300 edits at 500 cells at the parent: the ratio only
    expect(clockBreaks({ ms: 696, firstMs: 2.3 })).toHaveLength(1); // 300 edits at 2,000 cells
    expect(clockBreaks({ ms: 2850, firstMs: 9.5 })).toHaveLength(2); // 300 edits at 8,000 cells: the limit and the ratio
    expect(clockBreaks({ ms: 2.9, firstMs: 2.2 })).toEqual([]); // the same at the cure
  });

  it("each criterion fails alone: a slow run with a slow first ask breaks the limit only, a fast run that pays the same for every ask breaks the ratio only", () => {
    expect(clockBreaks({ ms: 2000, firstMs: 1500 })).toEqual(["the loop took 2000.0 ms, not under 1000 ms"]);
    expect(clockBreaks({ ms: 300, firstMs: 5 })).toEqual(["the loop took 60.0 times its first ask, not under 30 times"]);
  });

  it("both limits are strict", () => {
    expect(clockBreaks({ ms: 999.9, firstMs: 100 })).toEqual([]);
    expect(clockBreaks({ ms: 1000, firstMs: 100 })).toHaveLength(1);
    expect(clockBreaks({ ms: 149, firstMs: 5 })).toEqual([]); // 29.8 times
    expect(clockBreaks({ ms: 150, firstMs: 5 })).toHaveLength(1); // exactly 30 times
  });

  it("a clock that did not run keeps nothing: a first ask or a total read as 0, a total below the first ask, NaN", () => {
    expect(clockBreaks({ ms: 0, firstMs: 0 }).join("\n")).toContain("the clock did not run");
    expect(clockBreaks({ ms: 5, firstMs: 0 }).join("\n")).toContain("the clock did not run");
    expect(clockBreaks({ ms: 0, firstMs: 3 }).join("\n")).toContain("less than its first ask");
    expect(clockBreaks({ ms: NaN, firstMs: 5 }).length).toBeGreaterThanOrEqual(1);
    expect(clockBreaks({ ms: 5, firstMs: NaN }).length).toBeGreaterThanOrEqual(1);
  });
});

// ---- The documents ----

const FENCE = "```";
const BODY_LINES = 18;
const CELL_LINES = 24; // `# H<i>`, a blank line, the fence, the option line, 18 body lines, the fence, a blank line
const HEADER_LINES = 4; // `---`, `title: t`, `---`, a blank line

/** One document of `n` cells of the shape above, with a WIDE cell (`wide` body lines) after the cell `n >> 1`, and what the construction knows about it: every cell's start line, and the wide cell's. */
interface Shape {
  label: string;
  text: string;
  /** The start line (the fence line) of each of the `n` plain cells, in order. */
  starts: number[];
  /** The start line (the fence line) of the wide cell, and how many body lines it has. */
  wideStart: number;
  wide: number;
}

function shapeOf(n: number, wide: number): Shape {
  const out: string[] = ["---", "title: t", "---", ""];
  const starts: number[] = [];
  let wideStart = -1;
  const push = (...lines: string[]): void => {
    out.push(...lines);
  };
  const body = Array.from({ length: BODY_LINES }, (_, k) => `v${k} = ${k}`);
  const widebody = Array.from({ length: wide }, (_, k) => `w${k} = ${k}`);
  for (let i = 0; i < n; i++) {
    push(`# H${i}`, "");
    starts.push(out.length);
    push(`${FENCE}{python}`, "#| echo: false", ...body, FENCE, "");
    if (i === (n >> 1) - 1) {
      push("# Wide", "");
      wideStart = out.length;
      push(`${FENCE}{python}`, "#| echo: false", ...widebody, FENCE, "");
    }
  }
  return { label: `${n} twenty-line python cells and one of ${wide} body lines`, text: out.join("\n"), starts, wideStart, wide };
}

/** The line count the construction promises: the header, `n` plain cells, and the wide cell with its heading, fence, option line, body, closing fence and blank line. */
const linesOf = (n: number, wide: number): number => HEADER_LINES + n * CELL_LINES + (n >= 2 ? 2 + 2 + wide + 2 : 0);

// ---- The two loops ----

const EDITS = 300;
/** Every tenth edit runs from the last body line of its cell onto the closing fence, and is refused. */
const REFUSED_EVERY = 10;
const WIDE_LINES = 200;

/** The completion loop: `EDITS` edits, edit `k` in the plain cell `floor(k * n / EDITS)`, on its body line `k % 18`; every tenth runs from the last body line onto the closing fence. */
function completionAsks(shape: Shape): { asks: Array<(l: RangeLookup) => boolean>; expected: boolean[] } {
  const n = shape.starts.length;
  const asks: Array<(l: RangeLookup) => boolean> = [];
  const expected: boolean[] = [];
  for (let k = 0; k < EDITS; k++) {
    const fence = shape.starts[Math.floor((k * n) / EDITS)];
    const refused = k % REFUSED_EVERY === REFUSED_EVERY - 1;
    const first = refused ? fence + 1 + BODY_LINES : fence + 2 + (k % BODY_LINES);
    const last = refused ? first + 1 : first;
    asks.push((l) => l.rangeInLanguageBody(first, last, "python"));
    expected.push(!refused);
  }
  return { asks, expected };
}

/** The format loop: a one-line edit on the wide cell's first body line, then one edit over all its body lines. Both are in the cell's body. */
function formatAsks(shape: Shape): { asks: Array<(l: RangeLookup) => boolean>; expected: boolean[] } {
  const cell = findAllCells(shape.text).find((c) => c.startLine === shape.wideStart) as Cell;
  expect(cell.endLine).toBe(shape.wideStart + 2 + shape.wide);
  const firstBody = shape.wideStart + 2;
  const lastBody = shape.wideStart + 1 + shape.wide;
  return {
    asks: [(l) => l.rangeInCellBody(firstBody, firstBody, cell), (l) => l.rangeInCellBody(firstBody, lastBody, cell)],
    expected: [true, true],
  };
}

/** The sizes of the clock rows. Named once so that the sizes row below reads the very values the rows run on. */
const SIZES = [500, 2000, 8000];
const CONTROL_CELLS = 50;

const LOOPS: Array<{ name: string; make: (shape: Shape) => { asks: Array<(l: RangeLookup) => boolean>; expected: boolean[] } }> = [
  { name: "completion: 300 edits of a completion list, one in each of 300 cells in turn", make: completionAsks },
  { name: "format: a one-line edit and then one over the whole body of a 200-line cell", make: formatAsks },
];

/** Run a loop over `shape`, the clock on it. The model's scan is warmed first: it is the model's cost, the same for every spelling, and both adapters have paid it before they make the lookup. */
function runLoop(shape: Shape, loop: (typeof LOOPS)[number]): TimedAsks & { expected: boolean[] } {
  const found = findAllCells(shape.text); // warms the scan
  expect(found).toHaveLength(shape.starts.length + 1);
  expect(found.map((c) => c.startLine)).toContain(shape.wideStart);
  const { asks, expected } = loop.make(shape);
  const run = timeAsks(() => createRangeLookup(shape.text), asks);
  return { ...run, expected };
}

describe("Session 342 -- the completion edit filter and the formatter edit check cost cells times lines (the BACKLOG item \"What Session 341's review round found beside the Outline and preview cures\", part 3)", () => {
  for (const loop of LOOPS) {
    it.each(SIZES.map((n) => [n] as const))(`${loop.name}, over %i cells: in under one second and within its ratio of the first ask, with the stated answers`, (n) => {
      const shape = shapeOf(n, WIDE_LINES);
      expect(shape.text.split("\n")).toHaveLength(linesOf(n, WIDE_LINES));
      const run = runLoop(shape, loop);
      // The answers, before the clock: every ask is answered as the construction says (every tenth completion edit refused, every format edit kept).
      expect(run.answers).toEqual(run.expected);
      expect(clockBreaks(run)).toEqual([]);
    }, 120_000);
  }

  // CONTROLS: a shape that costs the parent little. It passes on it, and says that the fixtures are not what is slow.
  it.each(LOOPS.map((loop) => [loop.name, loop] as const))("CONTROL: %s, over 50 cells: stays under one second, with the stated answers", (_name, loop) => {
    const shape = shapeOf(CONTROL_CELLS, WIDE_LINES);
    const run = runLoop(shape, loop);
    expect(run.answers).toEqual(run.expected);
    expect(run.ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The rows above fix the sizes and the limits: 20 cells, or a limit of 100 s, would pass the parent too. Every size is a named constant, read here, so a changed one fails this row.
  it("keeps the sizes and the limits the clock rows are built on", () => {
    expect([LIMIT_MS, RATIO, EDITS, REFUSED_EVERY, WIDE_LINES, CONTROL_CELLS, BODY_LINES, CELL_LINES, HEADER_LINES]).toEqual([1000, 30, 300, 10, 200, 50, 18, 24, 4]);
    expect(SIZES).toEqual([500, 2000, 8000]);
    expect(SIZES.map((n) => linesOf(n, WIDE_LINES))).toEqual([12_210, 48_210, 192_210]);
    expect(shapeOf(2, 3).text.split("\n")).toHaveLength(linesOf(2, 3));
    expect(shapeOf(5, 7).text.split("\n")).toHaveLength(linesOf(5, 7));
  });
});
