import { describe, expect, it } from "vitest";
import { findCellOptionLines } from "../../src/core/qmd/model";
import { type YamlRegion, createYamlRegionLookup, quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";
import { collectValueSources } from "../../src/core/yaml-value-flags";

// Session 342 -- part (2) of the BACKLOG item "What Session 341's review round found beside the Outline and preview cures". `collectValueSources` (src/core/yaml-value-flags.ts) drops the option lines of a cell whose fence
// sits inside a quarto YAML region, and it asked `inQuartoYamlRegion(regions, line)` once per option line: a pass over every region each time, so regions times option lines. It runs on every debounced value-diagnostics
// pass. `createYamlRegionLookup(regions)` is made once per call and answers what `inQuartoYamlRegion(regions, line)` answers, for every array and every line (the oracle file `yaml-region-lookup-equivalence.test.ts`).
//
// This file holds the ANSWER rows (they pass on the parent's logic and state what `collectValueSources` and the lookup must answer), the CLOCK rows through the public entry `collectValueSources(text)`, the COUNT rows
// (how many region objects one ask reads: a clock-free form of the same claim), and the lookup alone on 50,000 hand-made regions. The old spelling is kept verbatim as the oracle in the equivalence file.
//
// WHAT MUST BE WELL-FORMED TO REACH THE SITE (Learning 903). Both factors of the product: MANY regions (a `---` at column 0 outside any fence opens one, the next `---` closes it; an opener with a blank line on each
// side is a thematic break and opens nothing) AND many option lines (a `#|` line at the head of a cell: a cell with none contributes none). The filter then asks once per option line, and an ask whose line is in no region
// reads every region (`some` finds nothing); an ask whose line is inside the i-th region reads i of them. Measured at the parent (the base of Session 342, before the lookup was cured), one fresh process each, a different exact text per call (the model's scan is
// memoised on the exact text), load 3 to 7: the item's shape (nine lines a pair: `---`, `k: v`, `---`, a blank line, the cell fence, `#| echo: false`, `x = 1`, the closing fence, a blank line) took
// 484 / 1,374 / 4,215 ms at 16,000 / 32,000 / 64,000 pairs (2.8 and 3.1 times per doubling); of the 64,000 pairs' 4.2 s, `quartoYamlRegions` is 63 to 67 ms, `findCellOptionLines` 1,063 to 1,134 ms (both linear) and the
// filter 2.9 to 4.0 s. The same cells with no `---` pairs take 126 / 216 / 431 ms. Regions with NO option line (nothing to ask) take 266 / 512 / 1,062 ms: linear. One region and many option lines: linear (the controls).
//
// WHY A RATIO AND NOT A LIMIT. The linear part (`quartoYamlRegions` plus `findCellOptionLines`) is 18 to 24 microseconds a pair, so the parent is only 1.7 and 2.4 times the cure at 16,000 and 32,000 pairs
// (cure 292 / 569 ms, parent 484 / 1,374 ms) and an absolute limit between them would sit under 1.3 and 1.6 times from each. Each clock row measures, in the same process and the same breath, the linear part on a fresh text of its own shape and then `collectValueSources` on another fresh text: the
// ratio of the second to the first. A machine that is slow all through moves both and cancels (Learning 877); it is NOT load-proof. At 64,000 pairs the parent's ratio is 3.8 to 4.4 and the cure's 0.99 to 1.03; the shape of
// four option lines to a pair at 32,000 pairs and the shape of eight to a pair at 16,000 push the parent's ratio to 5.3 to 6.5 and 4.1 to 4.3 in a bare node process (load 6 to 7; 6.1 and 5.9 in the vitest run that showed these rows RED),
// against the cure's 0.96 to 1.12 and 0.90 to 1.05. At 16,000 and 32,000 pairs of the item's literal shape the parent's ratio is 1.6 to 2.0 and 2.3 to 3.0 against the cure's 0.76 to 1.04: too close to carry a row, so those two sizes of the literal shape are not clock rows and the shapes with more option lines to a pair stand
// for them. The lookup alone (50,000 hand-made regions, no model in the clock) has the margin the end-to-end rows cannot: the parent takes 1.8 to 2.7 s there in a bare node process and 5.5 s under vitest, the cure 2.9 to 4.8 ms (load 6 to 7), against a limit of 250 ms.

/** A pair is `---`, `k: v`, `---`, a blank line, the fence, `k` option lines, `x = 1`, the closing fence, a blank line: 8 + k lines. Pair `i` starts on line `(8 + k) * i`. */
function pairText(pairs: number, optionLines: number): string {
  const options = Array.from({ length: optionLines }, (_, j) => `#| opt-${j}: ${j}\n`).join("");
  return `---\nk: v\n---\n\n\`\`\`{python}\n${options}x = 1\n\`\`\`\n\n`.repeat(pairs);
}

/** `[line, cellStartLine]` of every option line `collectValueSources` keeps. */
const kept = (text: string): Array<[number, number]> => collectValueSources(text).cellLines.map((o) => [o.line, o.cellStartLine]);
/** `[line, cellStartLine]` of every option line the model finds, before the filter. */
const found = (text: string): Array<[number, number]> => findCellOptionLines(text).map((o) => [o.line, o.cellStartLine]);
/** `[startLine, endLine]` of every YAML region. */
const spans = (text: string): Array<[number, number]> => quartoYamlRegions(text).map((r) => [r.startLine, r.endLine]);

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE ANSWERS. Each document is written line by line with its numbers in the comments; the expected places are read off them. Every row also states what the model finds and where the regions are (the premise): a row
// whose cell the model never found, or whose region quarto's state machine never opened, would pass for the wrong reason.

interface Named {
  name: string;
  lines: string[];
  /** The `[startLine, endLine]` of every region. */
  regions: Array<[number, number]>;
  /** Every option line the model finds, before the filter: `[line, cellStartLine]`. */
  found: Array<[number, number]>;
  /** The ones `collectValueSources` keeps. */
  kept: Array<[number, number]>;
}

const NAMED: Named[] = [
  {
    name: "front matter and one cell below it: the region is lines 0 to 2, the fence is on line 4, and its option line is kept",
    lines: [
      "---", // 0
      "title: t", // 1
      "---", // 2
      "", // 3
      "```{python}", // 4
      "#| echo: false", // 5
      "x = 1", // 6
      "```", // 7
    ],
    regions: [[0, 2]],
    found: [[5, 4]],
    kept: [[5, 4]],
  },
  {
    name: "a cell inside a closed mid-document region is dropped, the cells before and after it are kept",
    lines: [
      "```{python}", // 0
      "#| a: 1", // 1
      "x", // 2
      "```", // 3
      "", // 4
      "---", // 5  opens: a blank line above, `k: v` below, so not a thematic break
      "k: v", // 6
      "```{python}", // 7  a fence inside the region
      "#| b: 2", // 8
      "y", // 9
      "```", // 10 closes the fence, not the region
      "---", // 11 closes the region
      "", // 12
      "```{python}", // 13
      "#| c: 3", // 14
      "z", // 15
      "```", // 16
    ],
    regions: [[5, 11]],
    found: [[1, 0], [8, 7], [14, 13]],
    kept: [[1, 0], [14, 13]],
  },
  {
    name: "the last region never closes: it runs to the end of the document and swallows every cell below its opener",
    lines: [
      "```{python}", // 0
      "#| a: 1", // 1
      "x", // 2
      "```", // 3
      "", // 4
      "---", // 5  opens and is never closed
      "k: v", // 6
      "```{python}", // 7
      "#| b: 2", // 8
      "y", // 9
      "```", // 10
      "", // 11
      "```{python}", // 12
      "#| c: 3", // 13
      "z", // 14
      "```", // 15 the last line of the document
    ],
    regions: [[5, 15]],
    found: [[1, 0], [8, 7], [13, 12]],
    kept: [[1, 0]],
  },
  {
    name: "no region at all: every option line is kept",
    lines: [
      "```{python}", // 0
      "#| a: 1", // 1
      "x", // 2
      "```", // 3
      "```{r}", // 4
      "#| b: 2", // 5
      "y", // 6
      "```", // 7
    ],
    regions: [],
    found: [[1, 0], [5, 4]],
    kept: [[1, 0], [5, 4]],
  },
  {
    name: "the fence directly above the opening `---` and the fence directly below the closing `---` are outside the region, the fence directly below the opening one is inside",
    lines: [
      "```{python}", // 0
      "#| a: 1", // 1
      "```", // 2
      "---", // 3  opens (the line above is a fence line, not a blank one)
      "```{r}", // 4  directly below the opener: inside
      "#| b: 2", // 5
      "```", // 6
      "---", // 7  closes
      "```{julia}", // 8  directly below the closer: outside
      "#| c: 3", // 9
      "```", // 10
    ],
    regions: [[3, 7]],
    found: [[1, 0], [5, 4], [9, 8]],
    kept: [[1, 0], [9, 8]],
  },
  {
    name: "two regions that touch (lines 0 to 2 and 3 to 8): a cell in the second is dropped, and the cell after it is kept",
    lines: [
      "---", // 0
      "a: 1", // 1
      "---", // 2
      "---", // 3  opens a second region on the line right after the first closed
      "```{python}", // 4
      "#| b: 2", // 5
      "x", // 6
      "```", // 7
      "---", // 8  closes it
      "", // 9
      "```{python}", // 10
      "#| c: 3", // 11
      "y", // 12
      "```", // 13
    ],
    regions: [[0, 2], [3, 8]],
    found: [[5, 4], [11, 10]],
    kept: [[11, 10]],
  },
  {
    name: "cells before, between and after two regions: the ones in the regions are dropped and the others kept in document order",
    lines: [
      "```{python}", // 0
      "#| a: 1", // 1
      "```", // 2
      "", // 3
      "---", // 4  first region
      "k: v", // 5
      "```{python}", // 6
      "#| b: 2", // 7
      "```", // 8
      "---", // 9
      "", // 10
      "```{python}", // 11 between the regions
      "#| c: 3", // 12
      "```", // 13
      "", // 14
      "---", // 15 second region
      "k: v", // 16
      "```{python}", // 17
      "#| d: 4", // 18
      "```", // 19
      "---", // 20
      "", // 21
      "```{python}", // 22
      "#| e: 5", // 23
      "```", // 24
    ],
    regions: [[4, 9], [15, 20]],
    found: [[1, 0], [7, 6], [12, 11], [18, 17], [23, 22]],
    kept: [[1, 0], [12, 11], [23, 22]],
  },
];

describe("Session 342 -- collectValueSources keeps the option lines of cells outside every YAML region and drops the rest (the answers)", () => {
  it.each(NAMED.map((row) => [row.name, row] as const))("%s", (_name, row) => {
    const text = row.lines.join("\n");
    expect(spans(text)).toEqual(row.regions);
    expect(found(text)).toEqual(row.found);
    expect(kept(text)).toEqual(row.kept);
  });

  it("the unterminated region is the one that runs out of document, and the terminated ones are closed", () => {
    expect(quartoYamlRegions(NAMED[2].lines.join("\n")).map((r) => r.terminated)).toEqual([false]);
    expect(quartoYamlRegions(NAMED[1].lines.join("\n")).map((r) => r.terminated)).toEqual([true]);
  });

  it("the item's shape in small: three pairs of nine lines, every option line outside the regions and kept", () => {
    // pair i starts on line 9i: its region is 9i..9i+2, the fence 9i+4, the option line 9i+5
    const text = pairText(3, 1);
    expect(spans(text)).toEqual([[0, 2], [9, 11], [18, 20]]);
    expect(kept(text)).toEqual([[5, 4], [14, 13], [23, 22]]);
  });

  it("four option lines to a pair, two pairs: the fence is on line 12i + 4 and the option lines on 12i + 5 to 12i + 8", () => {
    const text = pairText(2, 4);
    expect(spans(text)).toEqual([[0, 2], [12, 14]]);
    expect(kept(text)).toEqual([[5, 4], [6, 4], [7, 4], [8, 4], [17, 16], [18, 16], [19, 16], [20, 16]]);
  });

  it("a cell inside each of three regions: none is kept, and the model did find all three", () => {
    // 0 intro | 1 blank | then three units of eight lines from line 2: --- | k: v | fence | #| a | x | fence | --- | blank. (A unit at line 0 would be the front matter, and the model reads no cell inside that.)
    const unit = "---\nk: v\n```{python}\n#| a: 1\nx\n```\n---\n\n";
    const text = `intro\n\n${unit.repeat(3)}`;
    expect(spans(text)).toEqual([[2, 8], [10, 16], [18, 24]]);
    expect(found(text)).toEqual([[5, 4], [13, 12], [21, 20]]);
    expect(kept(text)).toEqual([]);
  });
});

describe("Session 342 -- createYamlRegionLookup answers inQuartoYamlRegion's question for a list of regions (the answers)", () => {
  const region = (startLine: number, endLine: number): YamlRegion => ({ startLine, endLine, terminated: true });
  const asked = (regions: YamlRegion[], lines: number[]): boolean[] => {
    const lookup = createYamlRegionLookup(regions);
    return lines.map((line) => lookup(line));
  };

  it("is inclusive of both ends, false on the lines around and between the regions, and false for no region at all", () => {
    // regions 0..2 and 5..9; lines -1 to 10
    expect(asked([region(0, 2), region(5, 9)], [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([false, true, true, true, false, false, true, true, true, true, true, false]);
    expect(asked([], [-1, 0, 1, 1e9])).toEqual([false, false, false, false]);
  });

  it("a one-line region holds its line only", () => {
    expect(asked([region(4, 4)], [3, 4, 5])).toEqual([false, true, false]);
  });

  it("one lookup answers any number of asks, in any order, the same each time", () => {
    const lookup = createYamlRegionLookup([region(0, 2), region(5, 9)]);
    expect([9, 0, 3, 5, 9, 4, 2, 10, 0].map((line) => lookup(line))).toEqual([true, true, false, true, true, false, true, false, true]);
  });

  it("two lookups made over two arrays do not share anything", () => {
    const a = createYamlRegionLookup([region(0, 2)]);
    const b = createYamlRegionLookup([region(10, 12)]);
    expect([a(1), a(11), b(1), b(11)]).toEqual([true, false, false, true]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK THROUGH THE PUBLIC ENTRY. `timeAgainstBaseline` runs the linear part on one fresh text, then `collectValueSources` on another, each in its own window of the clock, and hands back both. `now` is the
// clock in milliseconds: the rows run it on `performance.now()`, the helper's own rows on a clock that only the stand-ins advance, so that what it reads is exact on any load (Learning 910).

/** What one run measured: the milliseconds of the linear part (`baselineMs`), of `collectValueSources` (`ms`), and what the second one returned. */
interface Timed<T> {
  result: T;
  ms: number;
  baselineMs: number;
}

function timeAgainstBaseline<T>(baseline: () => unknown, run: () => T, now: () => number = () => performance.now()): Timed<T> {
  const t0 = now();
  baseline();
  const t1 = now();
  const result = run();
  const t2 = now();
  return { result, ms: t2 - t1, baselineMs: t1 - t0 };
}

/** The ratio of the second window to the first: a lookup that costs nothing per ask is about 1 (the model's linear scans are the whole cost), the parent's is the number of times the filter outweighs them. */
const costRatio = (run: { ms: number; baselineMs: number }): number => run.ms / run.baselineMs;

/**
 * The one clock criterion of the end-to-end rows, named with its numbers: the second window under `ratioLimit` times the first. `[]` is a run that keeps it. A window that did not tick (0, negative or NaN) keeps nothing:
 * a clock stuck at 0 makes every ratio true.
 */
function clockBreaks(run: { ms: number; baselineMs: number }, ratioLimit: number): string[] {
  if (!(run.ms > 0 && run.baselineMs > 0)) return [`a window of the clock did not tick: ${run.baselineMs} ms for the linear scans, ${run.ms} ms for collectValueSources`];
  return costRatio(run) < ratioLimit ? [] : [`collectValueSources took ${costRatio(run).toFixed(2)} times the model's own linear scans, not under ${ratioLimit} times`];
}

/** A stand-in that spins `ms` milliseconds on the real clock. */
const spinning = (ms: number) => (): number => {
  const started = performance.now();
  while (performance.now() - started < ms) {
    /* spin */
  }
  return ms;
};

describe("the Session 342 clock helpers (the clock rows' own clock is pinned here: Learning 910)", () => {
  it("timeAgainstBaseline reads each window on a clock only the stand-ins advance: the numbers are exact on any load, the order is baseline then run, each runs once", () => {
    let t = 1000;
    const order: string[] = [];
    const run = timeAgainstBaseline(
      () => {
        order.push("baseline");
        t += 40;
      },
      () => {
        order.push("run");
        t += 130;
        return "answer";
      },
      () => t,
    );
    expect(run).toEqual({ result: "answer", ms: 130, baselineMs: 40 });
    expect(order).toEqual(["baseline", "run"]);
  });

  it("timeAgainstBaseline's default clock is real time: a baseline that spins 15 ms and a run that spins 25 ms are read as at least that, each in its own window", () => {
    const run = timeAgainstBaseline(spinning(15), spinning(25));
    expect(run.result).toBe(25);
    expect(run.baselineMs).toBeGreaterThanOrEqual(15 - 1);
    expect(run.ms).toBeGreaterThanOrEqual(25 - 1);
    // the windows do not overlap: the baseline's spin is not in the run's window, so the run's window is not the whole of both
    expect(run.baselineMs + run.ms).toBeGreaterThanOrEqual(40 - 2);
  });

  it("costRatio is the second window over the first: the parent's 4,215 over 1,172 is 3.6, the cure's 1,180 over 1,173 is 1.0, a first window read as 0 is no ratio at all", () => {
    expect(costRatio({ ms: 130, baselineMs: 40 })).toBe(3.25);
    expect(costRatio({ ms: 4215, baselineMs: 1172 })).toBeCloseTo(3.6, 1);
    expect(costRatio({ ms: 1180, baselineMs: 1173 })).toBeCloseTo(1.006, 3);
    expect(costRatio({ ms: 10, baselineMs: 0 })).toBe(Infinity);
  });

  it("clockBreaks refuses the parent's measurements and accepts the cure's, the limit is strict, and a window read as 0, as NaN or as negative keeps nothing, either window", () => {
    expect(clockBreaks({ ms: 4215, baselineMs: 1172 }, 2)).toHaveLength(1); // 64,000 pairs at the parent
    expect(clockBreaks({ ms: 1180, baselineMs: 1173 }, 2)).toEqual([]); // the same at the cure
    expect(clockBreaks({ ms: 199.9, baselineMs: 100 }, 2)).toEqual([]);
    expect(clockBreaks({ ms: 200, baselineMs: 100 }, 2)).toHaveLength(1); // exactly the limit
    expect(clockBreaks({ ms: 10, baselineMs: 0 }, 2)).toHaveLength(1);
    expect(clockBreaks({ ms: NaN, baselineMs: 100 }, 2)).toHaveLength(1);
    expect(clockBreaks({ ms: 100, baselineMs: NaN }, 2)).toHaveLength(1);
    expect(clockBreaks({ ms: 100, baselineMs: -5 }, 2)).toHaveLength(1);
    expect(clockBreaks({ ms: 0, baselineMs: 100 }, 2)).toHaveLength(1); // a run read as 0 is not a fast run
    expect(clockBreaks({ ms: 0, baselineMs: 0 }, 2)).toHaveLength(1);
  });
});

/** The model's own linear scans over one text: what `collectValueSources` has to do anyway. */
const linearScans = (text: string): void => {
  quartoYamlRegions(text);
  findCellOptionLines(text);
};

/** A text no earlier call has seen (the model's scan is memoised on the exact text): the base with a line of prose that carries the tag. */
const fresh = (base: string, tag: string): string => `${base}\nprose ${tag}\n`;

/** The ratio limit of the end-to-end rows: the parent's is 3.8 to 4.4 on the first shape, 5.3 to 6.5 on the second and 4.1 to 4.3 on the third, the cure's 0.90 to 1.12 on all three (measured at load 6 to 7: see the header). */
const RATIO_LIMIT = 2;
const LITERAL_PAIRS = 64_000;
const DENSE_PAIRS = 32_000;
const DENSE_OPTIONS = 4;
const DENSER_PAIRS = 16_000;
const DENSER_OPTIONS = 8;
const CONTROL_PAIRS = 32_000;

/** Run `collectValueSources` over `pairs` pairs of `optionLines` option lines each, against the linear scans, and read the answer back AFTER the clock: how many option lines are kept and where the first, the middle and the last pair's are. */
function runPairs(pairs: number, optionLines: number): { ms: number; baselineMs: number; keptCount: number; sampled: number } {
  const base = pairText(pairs, optionLines);
  const a = fresh(base, "a");
  const b = fresh(base, "b");
  const { result, ms, baselineMs } = timeAgainstBaseline(
    () => linearScans(a),
    () => collectValueSources(b),
  );
  const unit = 8 + optionLines;
  let sampled = 0;
  for (const i of [0, pairs >> 1, pairs - 1]) {
    const places = result.cellLines.slice(i * optionLines, (i + 1) * optionLines).map((o): [number, number] => [o.line, o.cellStartLine]);
    expect(places).toEqual(Array.from({ length: optionLines }, (_, j): [number, number] => [unit * i + 5 + j, unit * i + 4]));
    sampled++;
  }
  return { ms, baselineMs, keptCount: result.cellLines.length, sampled };
}

describe("Session 342 -- collectValueSources over thousands of YAML regions and option lines costs about the model's own linear scans, not their product (the BACKLOG item \"What Session 341's review round found beside the Outline and preview cures\", part 2)", () => {
  it.each([
    [`the item's shape at ${LITERAL_PAIRS.toLocaleString("en-US")} pairs (one option line a pair)`, LITERAL_PAIRS, 1],
    [`${DENSE_PAIRS.toLocaleString("en-US")} pairs of ${DENSE_OPTIONS} option lines`, DENSE_PAIRS, DENSE_OPTIONS],
    [`${DENSER_PAIRS.toLocaleString("en-US")} pairs of ${DENSER_OPTIONS} option lines`, DENSER_PAIRS, DENSER_OPTIONS],
  ] as Array<[string, number, number]>)(`%s: every option line is kept, where it stands, and the call takes under ${RATIO_LIMIT} times the model's linear scans`, (_label, pairs, optionLines) => {
    const run = runPairs(pairs, optionLines);
    expect(run.keptCount).toBe(pairs * optionLines);
    expect(run.sampled).toBe(3);
    expect(run.baselineMs).toBeGreaterThan(0);
    expect(run.ms).toBeGreaterThan(0);
    expect(clockBreaks(run, RATIO_LIMIT).join("; ")).toBe("");
  }, 120_000);

  // CONTROLS: shapes that cost the parent no more than the model's scans. They pass on it, and they say that the fixtures are not what is slow: the product needs BOTH factors.
  it(`CONTROL: ${CONTROL_PAIRS.toLocaleString("en-US")} regions whose cells have no option line (nothing is asked): the call takes about the model's scans, and nothing is kept`, () => {
    const base = "---\nk: v\n---\n\n```{python}\nx = 1\n```\n\n".repeat(CONTROL_PAIRS);
    const a = fresh(base, "a");
    const b = fresh(base, "b");
    const run = timeAgainstBaseline(() => linearScans(a), () => collectValueSources(b));
    expect(spans(b)).toHaveLength(CONTROL_PAIRS);
    expect(run.result.cellLines).toEqual([]);
    expect(clockBreaks(run, RATIO_LIMIT).join("; ")).toBe("");
  }, 120_000);

  it(`CONTROL: ${CONTROL_PAIRS.toLocaleString("en-US")} cells with an option line each below ONE region (the front matter): the call takes about the model's scans, and every option line is kept`, () => {
    const base = "---\nk: v\n---\n\n" + "```{python}\n#| echo: false\nx = 1\n```\n\n".repeat(CONTROL_PAIRS);
    const a = fresh(base, "a");
    const b = fresh(base, "b");
    const run = timeAgainstBaseline(() => linearScans(a), () => collectValueSources(b));
    expect(spans(b)).toEqual([[0, 2]]);
    expect(run.result.cellLines).toHaveLength(CONTROL_PAIRS);
    // cell i: its fence is on line 4 + 5i, its option line on 5 + 5i
    expect([0, CONTROL_PAIRS >> 1, CONTROL_PAIRS - 1].map((i) => [run.result.cellLines[i].line, run.result.cellLines[i].cellStartLine])).toEqual([
      [5, 4],
      [5 + 5 * (CONTROL_PAIRS >> 1), 4 + 5 * (CONTROL_PAIRS >> 1)],
      [5 + 5 * (CONTROL_PAIRS - 1), 4 + 5 * (CONTROL_PAIRS - 1)],
    ]);
    expect(clockBreaks(run, RATIO_LIMIT).join("; ")).toBe("");
  }, 120_000);

  // The rows above fix the sizes and the limit: 200 pairs, or a ratio limit of 100, would pass the parent too. Every size is a named constant, read here, so a changed one fails this row.
  it("keeps the sizes and the limit the clock rows are built on", () => {
    expect([RATIO_LIMIT, LITERAL_PAIRS, DENSE_PAIRS, DENSE_OPTIONS, DENSER_PAIRS, DENSER_OPTIONS, CONTROL_PAIRS]).toEqual([2, 64_000, 32_000, 4, 16_000, 8, 32_000]);
    // the regions and the option lines each shape reaches: pairs, and pairs times option lines
    expect([LITERAL_PAIRS * 1, DENSE_PAIRS * DENSE_OPTIONS, DENSER_PAIRS * DENSER_OPTIONS]).toEqual([64_000, 128_000, 128_000]);
    expect(pairText(2, 1).split("\n")).toHaveLength(2 * 9 + 1);
    expect(pairText(2, DENSE_OPTIONS).split("\n")).toHaveLength(2 * (8 + DENSE_OPTIONS) + 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNT OF REGIONS ONE ASK READS: the same claim without a clock. `watched` wraps the array in a Proxy that counts the reads of its elements; the lookup is made, the count is reset, ONE ask is made and the count is
// read back (Learning 907: the row ends on the event that reads the state back). The parent's ask reads every region on a line in no region, and `some` is the whole of its cost. The bound is two reads for each of the
// levels of a binary search over n regions and one more, which a search that reads the start and the end of each region it visits still keeps.

function watched(regions: YamlRegion[]): { array: readonly YamlRegion[]; reads: () => number; reset: () => void } {
  let reads = 0;
  const array = new Proxy(regions, {
    get(target, key, receiver) {
      if (typeof key === "string" && /^[0-9]+$/.test(key)) reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  return { array, reads: () => reads, reset: () => { reads = 0; } };
}

/** `n` regions on lines `3i` to `3i + 1`, each followed by one line in no region (`3i + 2`). */
function spaced(n: number): YamlRegion[] {
  return Array.from({ length: n }, (_, i) => ({ startLine: 3 * i, endLine: 3 * i + 1, terminated: true }));
}

const readBound = (n: number): number => 2 * (Math.floor(Math.log2(n)) + 1) + 1;

describe("Session 342 -- one ask of the lookup reads about log2(n) regions, not n (the same claim as the clock rows, counted)", () => {
  it("the counting wrapper counts element reads and nothing else: the parent's function reads every element on a line in no region, and one on a line in the first", () => {
    const w = watched(spaced(10));
    createYamlRegionLookup(w.array); // made but not asked
    w.reset();
    // `some` over the Proxy, the way the parent asks
    expect(w.array.some((r) => 2 >= r.startLine && 2 <= r.endLine)).toBe(false);
    expect(w.reads()).toBe(10);
    w.reset();
    expect(w.array.some((r) => 0 >= r.startLine && 0 <= r.endLine)).toBe(true);
    expect(w.reads()).toBe(1);
    expect(w.array.length).toBe(10);
    expect(w.reads()).toBe(1); // `length` is not an element
  });

  it.each([4_096, 65_536])("%s regions: each ask reads at most the bound, and answers as stated", (n) => {
    const w = watched(spaced(n));
    const lookup = createYamlRegionLookup(w.array);
    const bound = readBound(n);
    // [the line, the answer]: before the first region (-1), the first start, a gap line in the middle, a start in the middle, an end in the middle, a gap line at the end, the last start, the last end, and the line past the end
    const mid = n >> 1;
    const asks: Array<[number, boolean]> = [
      [-1, false],
      [0, true],
      [3 * mid + 2, false],
      [3 * mid, true],
      [3 * mid + 1, true],
      [3 * (n - 1) + 2, false],
      [3 * (n - 1), true],
      [3 * (n - 1) + 1, true],
      [3 * n, false],
    ];
    for (const [line, answer] of asks) {
      w.reset();
      expect(lookup(line)).toBe(answer);
      const reads = w.reads(); // read back after the ask
      expect(reads).toBeLessThanOrEqual(bound);
    }
  });

  it("the bound is what the rows say: 27 reads for 4,096 regions and 35 for 65,536 (two for each level, and one more)", () => {
    expect([readBound(4_096), readBound(65_536)]).toEqual([27, 35]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE LOOKUP ALONE, ON THE CLOCK: 50,000 hand-made regions and one ask for each of the 50,000 lines between them (each in no region, the parent's worst case: it reads all 50,000 regions every time, 2.5 billion reads).
// No model is in this clock, so the margin is the one the end-to-end rows cannot have. The lookup is made INSIDE the clock (one that did its work at the first ask, or a quadratic check at the construction, is paid for here).

interface TimedAsks {
  ms: number;
  hits: number;
}

function timeAsks(regions: YamlRegion[], lines: readonly number[], make: (regions: YamlRegion[]) => (line: number) => boolean = createYamlRegionLookup, now: () => number = () => performance.now()): TimedAsks {
  const t0 = now();
  const lookup = make(regions);
  let hits = 0;
  for (const line of lines) if (lookup(line)) hits++;
  return { ms: now() - t0, hits };
}

describe("the Session 342 lookup clock helper (its own clock is pinned here: Learning 910)", () => {
  it("timeAsks reads the construction and every ask on a clock only the stand-in advances: exact on any load, and the hits are counted", () => {
    let t = 500;
    const make = (): ((line: number) => boolean) => {
      t += 20; // the construction
      return (line) => {
        t += 3;
        return line % 2 === 0;
      };
    };
    expect(timeAsks([], [1, 2, 3, 4, 6], make, () => t)).toEqual({ ms: 20 + 5 * 3, hits: 3 });
  });

  it("timeAsks's default clock is real time: a lookup that spins 10 ms to be made and 1 ms to answer, asked 5 times, reads at least 15 ms", () => {
    const spin = (ms: number): void => {
      const started = performance.now();
      while (performance.now() - started < ms) {
        /* spin */
      }
    };
    const run = timeAsks([], [1, 2, 3, 4, 5], () => {
      spin(10);
      return () => {
        spin(1);
        return true;
      };
    });
    expect(run.hits).toBe(5);
    expect(run.ms).toBeGreaterThanOrEqual(15 - 1);
  });
});

const LOOKUP_REGIONS = 50_000;
/** The limit of the lookup row: the cure takes a few milliseconds for 50,000 asks, the parent 2.5 billion reads. */
const LOOKUP_LIMIT_MS = 250;

describe("Session 342 -- 50,000 asks of the lookup over 50,000 regions, each on a line in no region", () => {
  it("answers them all in under a quarter of a second, with the stated answers", () => {
    const regions = spaced(LOOKUP_REGIONS);
    const gaps = Array.from({ length: LOOKUP_REGIONS }, (_, i) => 3 * i + 2);
    const run = timeAsks(regions, gaps);
    expect(run.hits).toBe(0);
    expect(run.ms).toBeGreaterThan(0);
    expect(run.ms).toBeLessThan(LOOKUP_LIMIT_MS);
    // the answers on the first, the middle and the last region, and on the lines around them, read back from a lookup made again
    const lookup = createYamlRegionLookup(regions);
    for (const i of [0, LOOKUP_REGIONS >> 1, LOOKUP_REGIONS - 1]) {
      expect([3 * i - 1, 3 * i, 3 * i + 1, 3 * i + 2].map((line) => lookup(line))).toEqual([false, true, true, false]);
    }
    expect(lookup(3 * LOOKUP_REGIONS)).toBe(false);
    expect(lookup(-1)).toBe(false);
  }, 120_000);

  it("keeps the size and the limit the lookup row is built on", () => {
    expect([LOOKUP_REGIONS, LOOKUP_LIMIT_MS]).toEqual([50_000, 250]);
    expect(spaced(3)).toEqual([
      { startLine: 0, endLine: 1, terminated: true },
      { startLine: 3, endLine: 4, terminated: true },
      { startLine: 6, endLine: 7, terminated: true },
    ]);
  });
});
