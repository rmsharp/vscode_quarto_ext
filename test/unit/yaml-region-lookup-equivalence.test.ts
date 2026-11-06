import { describe, expect, it } from "vitest";
import { type YamlRegion, createYamlRegionLookup, inQuartoYamlRegion, quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";
import { countStrings, seededRandom } from "./support/regex-equivalence";

// The enumerations take a few seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 342 -- part (2) of the BACKLOG item "What Session 341's review round found beside the Outline and preview cures". `collectValueSources` asked `inQuartoYamlRegion(regions, line)` once per cell option line, and that is a
// pass over every region (regions times option lines). `createYamlRegionLookup(regions)` is made once per call and must answer, for EVERY array of regions and EVERY line, what `inQuartoYamlRegion(regions, line)` answers:
// `regions.some((r) => line >= r.startLine && line <= r.endLine)`. The function in the source is unchanged (it is the oracle the lookup falls back to), and the OLD spelling is kept here VERBATIM as the oracle (Learning 738),
// so that a change to the source function cannot move the oracle with it: the enumerations below compare the lookup with this copy and the source function with this copy.
//
// The lookup answers by a binary search over the region starts WHEN the array is ordered (each region has start <= end, and each starts strictly after the one before it ends), a property it checks once when it is made, and
// by the oracle's own pass over every region when it is not. The arrays here are not only what `quartoYamlRegions` returns: unsorted, overlapping, nested, with a start after its end, duplicated, with fractional, NaN,
// infinite and negative-zero bounds, and a line that is fractional, NaN, infinite or negative zero. The array must not change while the lookup is in use (the parameter is `readonly YamlRegion[]`): no row here changes one.
//
// The counts pinned below (how many arrays, questions and answers "inside" the enumerations reach, and how many of E1's arrays are ordered by the definition above) come from the Python recount
// `tools/yaml-region-count/count_regions.py`, which shares no code with this file, and never from the code under test.

// ---- The OLD spelling, copied VERBATIM from the source `inQuartoYamlRegion` before the lookup was cured. ----
function oldInQuartoYamlRegion(regions: readonly YamlRegion[], line: number): boolean {
  return regions.some((r) => line >= r.startLine && line <= r.endLine);
}

/** A number as it reads: `-0` and `NaN` are told apart from `0` and from each other's neighbours. */
const show = (x: number): string => (Object.is(x, -0) ? "-0" : String(x));
const showRegions = (regions: readonly YamlRegion[]): string => `[${regions.map((r) => `${show(r.startLine)}..${show(r.endLine)}`).join(", ")}]`;
const region = (startLine: number, endLine: number): YamlRegion => ({ startLine, endLine, terminated: true });

/** An ordered array by DEFINITION: every region has start <= end, every region after the first starts strictly after the previous one ends. A NaN fails both. */
function orderedByDefinition(regions: readonly YamlRegion[]): boolean {
  for (let i = 0; i < regions.length; i++) {
    if (!(regions[i].startLine <= regions[i].endLine)) return false;
    if (i > 0 && !(regions[i - 1].endLine < regions[i].startLine)) return false;
  }
  return true;
}

type Lookup = (regions: readonly YamlRegion[]) => (line: number) => boolean;

interface Tally {
  arrays: number;
  asks: number;
  /** Questions the oracle answered "inside". */
  inside: number;
  orderedArrays: number;
  orderedAsks: number;
  orderedInside: number;
  disagreements: string[];
}

const newTally = (): Tally => ({ arrays: 0, asks: 0, inside: 0, orderedArrays: 0, orderedAsks: 0, orderedInside: 0, disagreements: [] });

/**
 * Ask every line of `lines` of the lookup made over `regions`, and of the old spelling, and of the source function: a disagreement is recorded as a string (the first few only) and the row asserts there are none.
 * The lookup is made ONCE and asked all the lines, which is how `collectValueSources` uses it.
 */
function compareArray(regions: readonly YamlRegion[], lines: Iterable<number>, tally: Tally, make: Lookup = createYamlRegionLookup): void {
  const lookup = make(regions);
  const ordered = orderedByDefinition(regions);
  tally.arrays++;
  if (ordered) tally.orderedArrays++;
  for (const line of lines) {
    const expected = oldInQuartoYamlRegion(regions, line);
    tally.asks++;
    if (ordered) tally.orderedAsks++;
    if (expected) {
      tally.inside++;
      if (ordered) tally.orderedInside++;
    }
    const got = lookup(line);
    if (got !== expected && tally.disagreements.length < 5) tally.disagreements.push(`${showRegions(regions)} line ${show(line)}: lookup ${got}, old spelling ${expected}`);
    const source = inQuartoYamlRegion(regions, line);
    if (source !== expected && tally.disagreements.length < 5) tally.disagreements.push(`${showRegions(regions)} line ${show(line)}: source function ${source}, old spelling ${expected}`);
  }
}

describe("Session 342 -- the old spelling is what the source had, and the oracle can fail", () => {
  it("the verbatim copy is inclusive of both ends and holds a one-line region", () => {
    expect([-1, 0, 1, 2, 3].map((line) => oldInQuartoYamlRegion([region(0, 2)], line))).toEqual([false, true, true, true, false]);
    expect([3, 4, 5].map((line) => oldInQuartoYamlRegion([region(4, 4)], line))).toEqual([false, true, false]);
    expect(oldInQuartoYamlRegion([], 0)).toBe(false);
  });

  it("the copy's answer moves with the bounds and with the line (so a comparison with it can fail)", () => {
    const base = oldInQuartoYamlRegion([region(0, 2)], 1);
    expect(base).toBe(true);
    expect(oldInQuartoYamlRegion([region(2, 4)], 1)).toBe(false); // start moved up
    expect(oldInQuartoYamlRegion([region(-4, -2)], 1)).toBe(false); // both moved down
    expect(oldInQuartoYamlRegion([region(0, 0)], 1)).toBe(false); // end moved down
    expect(oldInQuartoYamlRegion([region(0, 2)], 3)).toBe(false); // line moved
  });

  it("three deliberately wrong lookups each disagree with it on the named rows below and on every array of up to two regions over the pools (the comparison can fail)", () => {
    // (1) a binary search over the starts with NO ordering check; (2) the last region only; (3) the first region only.
    const noCheck: Lookup = (regions) => (line) => {
      let low = 0;
      let high = regions.length - 1;
      let found = -1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (regions[middle].startLine <= line) {
          found = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      return found !== -1 && line <= regions[found].endLine;
    };
    const lastOnly: Lookup = (regions) => (line) => regions.length > 0 && line >= regions[regions.length - 1].startLine && line <= regions[regions.length - 1].endLine;
    const firstOnly: Lookup = (regions) => (line) => regions.length > 0 && line >= regions[0].startLine && line <= regions[0].endLine;
    for (const wrong of [noCheck, lastOnly, firstOnly]) {
      const tally = newTally();
      for (const row of NAMED) compareArray(row.regions.map(([s, e]) => region(s, e)), row.lines, tally, wrong);
      for (const regions of everyArray(2)) compareArray(regions, E1_LINES, tally, wrong);
      expect(tally.disagreements.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// NAMED ROWS. Each states the ANSWER for each line, by hand from the definition (`line >= start && line <= end` for some region), then that the lookup, the old spelling and the source function all give it, in the order
// given and in the reverse order, and again on a second ask of the same lookup.

interface NamedRow {
  name: string;
  regions: Array<[number, number]>;
  lines: number[];
  /** The answer for each line, in the order of `lines`. */
  expected: boolean[];
}

const T = true;
const F = false;

const NAMED: NamedRow[] = [
  { name: "no region: false for every line, NaN and the infinities included", regions: [], lines: [-Infinity, -1, 0, 0.5, NaN, Infinity], expected: [F, F, F, F, F, F] },
  { name: "ordered 0..2 and 5..9: both ends are inside, the gap is not", regions: [[0, 2], [5, 9]], lines: [-1, 0, 1, 2, 3, 4, 5, 9, 10], expected: [F, T, T, T, F, F, T, T, F] },
  { name: "regions that touch at a line (0..2 and 2..4): the shared line is inside, and so is everything between", regions: [[0, 2], [2, 4]], lines: [-1, 0, 2, 3, 4, 5], expected: [F, T, T, T, T, F] },
  { name: "adjacent regions with no line between (0..2 and 3..5): a line between the two whole numbers is in neither", regions: [[0, 2], [3, 5]], lines: [2, 2.5, 3], expected: [T, F, T] },
  { name: "unsorted: 5..9 before 0..2", regions: [[5, 9], [0, 2]], lines: [1, 3, 7, 10], expected: [T, F, T, F] },
  { name: "overlapping: 0..5 and 3..8", regions: [[0, 5], [3, 8]], lines: [-1, 0, 4, 5, 6, 8, 9], expected: [F, T, T, T, T, T, F] },
  { name: "nested, the outer first: 0..10 then 3..4 (a line past the inner one is still in the outer)", regions: [[0, 10], [3, 4]], lines: [-1, 0, 3.5, 6, 10, 11], expected: [F, T, T, T, T, F] },
  { name: "nested, the inner first: 3..4 then 0..10", regions: [[3, 4], [0, 10]], lines: [-1, 0, 3.5, 6, 10, 11], expected: [F, T, T, T, T, F] },
  { name: "a start after its end holds nothing, between valid regions: 0..1, 5..2, 8..9", regions: [[0, 1], [5, 2], [8, 9]], lines: [0, 1, 2, 3, 4, 5, 8.5, 9], expected: [T, T, F, F, F, F, T, T] },
  { name: "a start after its end that puts the starts out of order: 0..1, 10..3, 5..20 (the last region holds 7, and the middle one holds nothing)", regions: [[0, 1], [10, 3], [5, 20]], lines: [1.5, 4, 7, 25], expected: [F, F, T, F] },
  { name: "the same region twice: 2..4, 2..4", regions: [[2, 4], [2, 4]], lines: [1, 2, 3, 4, 5], expected: [F, T, T, T, F] },
  { name: "the same start, two ends: 2..4 then 2..6", regions: [[2, 4], [2, 6]], lines: [1, 2, 5, 6, 7], expected: [F, T, T, T, F] },
  { name: "the same start, two ends: 2..6 then 2..4", regions: [[2, 6], [2, 4]], lines: [1, 2, 5, 6, 7], expected: [F, T, T, T, F] },
  { name: "the same end, two starts: 1..6 and 3..6", regions: [[1, 6], [3, 6]], lines: [0, 1, 2, 3, 6, 7], expected: [F, T, T, T, T, F] },
  { name: "a one-line region", regions: [[4, 4]], lines: [3, 4, 5, 4.5], expected: [F, T, F, F] },
  { name: "fractional bounds 0.5..2.5, and a line one step below 0.5", regions: [[0.5, 2.5]], lines: [0.25, 0.4999999999999999, 0.5, 1, 2.5, 2.75], expected: [F, F, T, T, T, F] },
  { name: "a NaN bound never matches: NaN..5, 0..NaN and NaN..NaN hold nothing, whatever the line", regions: [[NaN, 5], [0, NaN], [NaN, NaN]], lines: [0, 3, 5, NaN, Infinity, -Infinity], expected: [F, F, F, F, F, F] },
  { name: "a NaN region among valid ones does not hide them: 0..2, NaN..NaN, 5..9", regions: [[0, 2], [NaN, NaN], [5, 9]], lines: [1, 3, 6, 10, NaN], expected: [T, F, T, F, F] },
  { name: "a NaN region first: NaN..NaN, 0..2", regions: [[NaN, NaN], [0, 2]], lines: [1, 3], expected: [T, F] },
  { name: "a NaN region last: 0..2, NaN..NaN", regions: [[0, 2], [NaN, NaN]], lines: [1, 3], expected: [T, F] },
  { name: "infinite bounds: -Infinity..3 and 5..Infinity hold the infinities themselves and the huge numbers, not the gap", regions: [[-Infinity, 3], [5, Infinity]], lines: [-Infinity, -1e300, 3, 4, 5, 1e300, Infinity], expected: [T, T, T, F, T, T, T] },
  { name: "the whole line: -Infinity..Infinity holds every number but NaN", regions: [[-Infinity, Infinity]], lines: [-Infinity, 0, Infinity, NaN], expected: [T, T, T, F] },
  { name: "an infinite end, then a region that starts inside it: 0..Infinity, 5..9", regions: [[0, Infinity], [5, 9]], lines: [-1, 7, 100, Infinity], expected: [F, T, T, T] },
  { name: "negative zero as a start: -0..2 holds 0 and -0, not the numbers below", regions: [[-0, 2]], lines: [-0, 0, -1, -1e-300], expected: [T, T, F, F] },
  { name: "negative zero as an end: 0..-0 holds 0 and -0 (0 <= -0 is true), not the numbers around", regions: [[0, -0]], lines: [0, -0, 1e-300, -1e-300], expected: [T, T, F, F] },
  { name: "-0..-0 then 0..0: both hold zero, neither holds 1", regions: [[-0, -0], [0, 0]], lines: [0, -0, 1], expected: [T, T, F] },
  { name: "a fractional or special line against whole regions 0..2 and 5..9", regions: [[0, 2], [5, 9]], lines: [0.5, 2.5, 4.99, 5.01, 9.5, NaN, Infinity, -Infinity, -0], expected: [T, F, F, T, F, F, F, F, T] },
  { name: "one ulp each side of the ends of 1..2", regions: [[1, 2]], lines: [0.9999999999999999, 1, 2, 2.0000000000000004], expected: [F, T, T, F] },
];

/** Every array of 0..`maxLength` regions, each one of the pairs of the bound pool (`PAIRS`, defined below with E1; a function declaration is hoisted for the row above it). */
function* everyArray(maxLength: number): Generator<YamlRegion[]> {
  yield [];
  for (let length = 1; length <= maxLength; length++) {
    const digits = new Array<number>(length).fill(0);
    for (;;) {
      yield digits.map((d) => PAIRS[d]);
      let place = length - 1;
      while (place >= 0 && digits[place] === PAIRS.length - 1) {
        digits[place] = 0;
        place--;
      }
      if (place < 0) break;
      digits[place]++;
    }
  }
}

/** The pool of bounds (nine: both infinities, a negative number, both zeros, a fraction, two whole numbers and NaN), the pairs of it (81), and the pool of lines (thirteen). */
const BOUNDS = [-Infinity, -1, -0, 0, 0.5, 1, 2, NaN, Infinity];
const E1_LINES = [-Infinity, -1, -0.5, -0, 0, 0.25, 0.5, 1, 1.5, 2, 3, NaN, Infinity];
const PAIRS: YamlRegion[] = BOUNDS.flatMap((s) => BOUNDS.map((e) => region(s, e)));

describe("Session 342 -- the named arrays: the lookup, the old spelling and the source function give the stated answer for each line", () => {
  it.each(NAMED.map((row) => [row.name, row] as const))("%s", (_name, row) => {
    const regions = row.regions.map(([s, e]) => region(s, e));
    expect(row.lines).toHaveLength(row.expected.length);
    const lookup = createYamlRegionLookup(regions);
    expect(row.lines.map((line) => oldInQuartoYamlRegion(regions, line))).toEqual(row.expected);
    expect(row.lines.map((line) => inQuartoYamlRegion(regions, line))).toEqual(row.expected);
    expect(row.lines.map((line) => lookup(line))).toEqual(row.expected);
    // the reverse order, and a second ask of the same lookup
    expect([...row.lines].reverse().map((line) => lookup(line))).toEqual([...row.expected].reverse());
    expect(row.lines.map((line) => lookup(line))).toEqual(row.expected);
  });

  it("the named rows reach the shapes they are named for: ordered, unsorted, overlapping, nested, degenerate, duplicated, NaN, infinite and negative-zero arrays, as the definition reads them", () => {
    const ordered = NAMED.filter((row) => orderedByDefinition(row.regions.map(([s, e]) => region(s, e)))).length;
    expect([NAMED.length, ordered]).toEqual([28, 11]);
    expect(NAMED.some((row) => row.regions.some(([s, e]) => Number.isNaN(s) || Number.isNaN(e)))).toBe(true);
    expect(NAMED.some((row) => row.regions.some(([s, e]) => s > e))).toBe(true);
    expect(NAMED.some((row) => row.regions.some(([s, e]) => Object.is(s, -0) || Object.is(e, -0)))).toBe(true);
    expect(NAMED.some((row) => row.regions.some(([s, e]) => !Number.isFinite(s) || !Number.isFinite(e)))).toBe(true);
  });

  it("an empty array is answered false at every line", () => {
    const lookup = createYamlRegionLookup([]);
    expect([-Infinity, -1, -0, 0, 1e9, NaN, Infinity].map((line) => lookup(line))).toEqual([F, F, F, F, F, F, F]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE DIFFERENTIAL. Every array is read by the lookup, the old spelling and the source function; a disagreement is recorded as a string and the row asserts that there are none.

const counts = (tally: Tally): Record<string, number> => ({ arrays: tally.arrays, asks: tally.asks, inside: tally.inside });

describe("Session 342 -- every array over a pool of bounds (the lookup against the old spelling and the source function)", () => {
  it("E1: the sizes -- 81 pairs of 9 bounds give 538,084 arrays of 0 to 3 regions, and 13 lines are asked of each", () => {
    expect(BOUNDS).toHaveLength(9);
    expect(PAIRS).toHaveLength(81);
    expect(E1_LINES).toHaveLength(13);
    expect(countStrings(81, 3)).toBe(538_084);
    expect(countStrings(81, 3) * 13).toBe(6_995_092);
  });

  it("E1: agrees on every array of 0 to 3 regions over the pairs, unsorted, overlapping, nested, with a start after its end, duplicated, NaN, infinite and negative-zero included, and reaches the counts of the Python recount", () => {
    const tally = newTally();
    for (const regions of everyArray(3)) compareArray(regions, E1_LINES, tally);
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/yaml-region-count/count_regions.py E1`.
    expect({ ...counts(tally), orderedArrays: tally.orderedArrays, orderedAsks: tally.orderedAsks, orderedInside: tally.orderedInside }).toEqual({
      arrays: 538_084,
      asks: 6_995_092,
      inside: 2_839_313,
      orderedArrays: 674,
      orderedAsks: 8_762,
      orderedInside: 4_208,
    });
  }, HEAVY_ROW_MS);

  /** Every half line from `first` to `last`, both included. */
  function* halfLines(first: number, last: number): Generator<number> {
    for (let k = first * 2; k <= last * 2; k++) yield k / 2;
  }

  /** Every ordered array of 0 to 5 regions built by a gap (1, 2 or 3 lines after the previous end, the first from line -1) and a width (0, 1 or 2) for each: 9 shapes a region. */
  function* gapArrays(maxLength: number): Generator<{ regions: YamlRegion[]; last: number }> {
    const SHAPES: Array<[number, number]> = [];
    for (const gap of [1, 2, 3]) for (const width of [0, 1, 2]) SHAPES.push([gap, width]);
    yield { regions: [], last: -1 };
    for (let length = 1; length <= maxLength; length++) {
      const digits = new Array<number>(length).fill(0);
      for (;;) {
        const regions: YamlRegion[] = [];
        let current = -1;
        for (const d of digits) {
          const start = current + SHAPES[d][0];
          const end = start + SHAPES[d][1];
          regions.push(region(start, end));
          current = end;
        }
        yield { regions, last: current };
        let place = length - 1;
        while (place >= 0 && digits[place] === SHAPES.length - 1) {
          digits[place] = 0;
          place--;
        }
        if (place < 0) break;
        digits[place]++;
      }
    }
  }

  it("E2: agrees on every ordered array of 0 to 5 regions by gap and width, at every half line from -1 to one past the last end, and reaches the counts of the Python recount", () => {
    const tally = newTally();
    for (const { regions, last } of gapArrays(5)) {
      expect(orderedByDefinition(regions)).toBe(true);
      compareArray(regions, halfLines(-1, last + 1), tally);
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/yaml-region-count/count_regions.py E2`.
    expect(counts(tally)).toEqual({ arrays: 66_430, asks: 2_142_372, inside: 971_541 });
    expect(tally.orderedArrays).toBe(66_430);
  }, HEAVY_ROW_MS);

  it("E3: agrees on the arrays of m regions 3i..3i+1 for m = 0 to 300, at every half line from -1 to 3m + 1, and reaches the counts of the Python recount", () => {
    const tally = newTally();
    for (let m = 0; m <= 300; m++) {
      const regions = Array.from({ length: m }, (_, i) => region(3 * i, 3 * i + 1));
      compareArray(regions, halfLines(-1, 3 * m + 1), tally);
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/yaml-region-count/count_regions.py E3`.
    expect(counts(tally)).toEqual({ arrays: 301, asks: 272_405, inside: 135_450 });
  }, HEAVY_ROW_MS);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// WHAT `quartoYamlRegions` RETURNS. The arrays the one caller hands the lookup are the output of `quartoYamlRegions`: the lookup must answer them as the old spelling does, and must answer them by the binary search (an
// ordered array), which one ask's reads show without a clock: a Proxy counts the element reads of each ask, and at most 2 * (floor(log2 n) + 1) + 1 are read on an array of n regions.

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

const readBound = (n: number): number => 2 * (Math.floor(Math.log2(n)) + 1) + 1;

describe("Session 342 -- the regions of a document: the lookup answers them as the old spelling does, by a binary search", () => {
  const SEED = 342;
  const DOCS = 20_000;
  const WITH_REGIONS_FLOOR = 8_000;
  const WITH_THREE_FLOOR = 1_500;
  const UNTERMINATED_FLOOR = 1_000;
  const TOUCHING_FLOOR = 500;
  const INSIDE_FLOOR = 100_000;
  const BIG_DOCS = 3_000;
  const LONG_FLOOR = 1_000;
  const ASKED_FLOOR = 500_000;
  // Lines that open or close a region (a `---` at column 0, with trailing space, with a fourth dash, indented), fences that hide one, blank lines, and text.
  const POOL = [
    "---", "---", "---", "---", "--- ", "----", "  ---", "",
    "", "", "k: v", "prose", "prose again", "# Heading", "```{python}", "```{python}",
    "```", "```", "```{r}", "~~~", "````", "<!--", "-->", "#| echo: false",
  ];

  /** The seeded documents of `minLength` to `minLength + spread - 1` lines: the regions `quartoYamlRegions` finds in each, and the lines to ask (-1 to two past the end). */
  function* documents(count: number, minLength: number, spread: number): Generator<{ regions: YamlRegion[]; lines: number[] }> {
    const random = seededRandom(SEED);
    for (let n = 0; n < count; n++) {
      const length = minLength + Math.floor(random() * spread);
      const text = Array.from({ length }, () => POOL[Math.floor(random() * POOL.length)]).join("\n");
      const total = text.split("\n").length;
      yield { regions: quartoYamlRegions(text), lines: Array.from({ length: total + 3 }, (_, k) => k - 1) };
    }
  }

  it(`${DOCS.toLocaleString("en-US")} seeded documents of 0 to 60 lines: every line from -1 to two past the end is answered as the old spelling answers it, and quartoYamlRegions returns an ordered array every time`, () => {
    const tally = newTally();
    let withRegions = 0;
    let withThree = 0;
    let most = 0;
    let unterminated = 0;
    let touching = 0;
    for (const { regions, lines } of documents(DOCS, 0, 61)) {
      if (regions.length >= 1) withRegions++;
      if (regions.length >= 3) withThree++;
      most = Math.max(most, regions.length);
      if (regions.some((r) => !r.terminated)) unterminated++;
      for (let i = 1; i < regions.length; i++) if (regions[i].startLine === regions[i - 1].endLine + 1) touching++;
      compareArray(regions, lines, tally);
      if (!orderedByDefinition(regions)) tally.disagreements.push(`quartoYamlRegions returned an array that is not ordered: ${showRegions(regions)}`);
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.arrays).toBe(DOCS);
    // The draw must reach the shapes it is for: floors, not pinned counts (the generator is Mulberry32 over a pool, not a definition a second program is asked to reproduce).
    expect(withRegions).toBeGreaterThan(WITH_REGIONS_FLOOR);
    expect(withThree).toBeGreaterThan(WITH_THREE_FLOOR);
    expect(most).toBeGreaterThanOrEqual(6);
    expect(unterminated).toBeGreaterThan(UNTERMINATED_FLOOR);
    expect(touching).toBeGreaterThan(TOUCHING_FLOOR);
    expect(tally.inside).toBeGreaterThan(INSIDE_FLOOR);
  }, HEAVY_ROW_MS);

  it(`${BIG_DOCS.toLocaleString("en-US")} seeded documents of 150 to 599 lines: an array of 16 regions or more is answered by at most the bound of reads on every line (the binary search, not a pass over the regions), and by the old spelling's answer`, () => {
    const problems: string[] = [];
    let long = 0;
    let most = 0;
    let asked = 0;
    for (const { regions, lines } of documents(BIG_DOCS, 150, 450)) {
      most = Math.max(most, regions.length);
      if (regions.length < 16) continue;
      long++;
      const w = watched(regions);
      const lookup = createYamlRegionLookup(w.array);
      for (const line of lines) {
        w.reset();
        const got = lookup(line);
        const reads = w.reads(); // read back after the ask
        asked++;
        if (reads > readBound(regions.length) && problems.length < 5) problems.push(`${regions.length} regions, line ${line}: ${reads} reads, not at most ${readBound(regions.length)}`);
        if (got !== oldInQuartoYamlRegion(regions, line) && problems.length < 5) problems.push(`${regions.length} regions, line ${line}: the lookup says ${got}`);
      }
    }
    expect(problems).toEqual([]);
    // The draw must reach the shapes it is for: floors (the longest array of regions drawn, and how many documents have 16 or more).
    expect(long).toBeGreaterThan(LONG_FLOOR);
    expect(most).toBeGreaterThanOrEqual(40);
    expect(asked).toBeGreaterThan(ASKED_FLOOR);
  }, HEAVY_ROW_MS);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE SEEDED DIFFERENTIAL ON HAND-MADE ARRAYS: longer arrays than the enumerations reach (0 to 40 regions), ordered ones and ordered ones with ONE defect (two swapped, one duplicated, a start after its end, a NaN bound,
// an infinite bound, a region pulled back over its neighbour, a region stretched over its neighbour, a negative-zero bound, a fractional bound), and wild ones. Each array is asked the lines at and around every bound
// (the bound, half a line either side, one ulp either side, one line either side) and the special lines (NaN, both infinities, -0, a fraction), in a shuffled order, and then once more in the order given.

describe("Session 342 -- a seeded differential on hand-made arrays", () => {
  const SEED = 3421;
  const COUNT = 30_000;

  /** The double just above (`up`) or below `x`, by scaling: a hair, which the comparison tells from `x` itself for every finite non-zero `x` the generator draws. */
  const hair = (x: number, up: boolean): number => (x === 0 ? (up ? Number.MIN_VALUE : -Number.MIN_VALUE) : x * (up === x > 0 ? 1 + 2 ** -52 : 1 - 2 ** -52));

  type Draw = { regions: YamlRegion[]; defect: string };

  function ordered(random: () => number, n: number): YamlRegion[] {
    const regions: YamlRegion[] = [];
    let current = -2 + Math.floor(random() * 3);
    for (let i = 0; i < n; i++) {
      const start = current + 1 + Math.floor(random() * 4);
      const end = start + Math.floor(random() * 4);
      regions.push(region(start, end));
      current = end;
    }
    return regions;
  }

  const DEFECTS = ["swap", "duplicate", "start-after-end", "nan-start", "nan-end", "infinite-end", "infinite-start", "overlap-back", "stretch-over", "negative-zero", "fraction", "touch"] as const;

  function draw(random: () => number): Draw {
    const n = Math.floor(random() * 41);
    const kind = random();
    if (kind < 0.35) return { regions: ordered(random, n), defect: "none" };
    if (kind < 0.85) {
      const regions = ordered(random, Math.max(n, 2));
      const defect = DEFECTS[Math.floor(random() * DEFECTS.length)];
      const i = Math.floor(random() * regions.length);
      const j = Math.min(regions.length - 1, i + 1);
      const r = regions[i];
      switch (defect) {
        case "swap":
          [regions[i], regions[j]] = [regions[j], regions[i]];
          break;
        case "duplicate":
          regions.splice(i, 0, r);
          break;
        case "start-after-end":
          regions[i] = region(r.endLine + 1 + Math.floor(random() * 3), r.endLine);
          break;
        case "nan-start":
          regions[i] = region(NaN, r.endLine);
          break;
        case "nan-end":
          regions[i] = region(r.startLine, NaN);
          break;
        case "infinite-end":
          regions[i] = region(r.startLine, Infinity);
          break;
        case "infinite-start":
          regions[i] = region(-Infinity, r.endLine);
          break;
        case "overlap-back":
          regions[i] = region(i > 0 ? regions[i - 1].endLine - Math.floor(random() * 2) : r.startLine - 1, r.endLine);
          break;
        case "stretch-over":
          regions[i] = region(r.startLine, r.endLine + 1 + Math.floor(random() * 8));
          break;
        case "negative-zero":
          regions[i] = random() < 0.5 ? region(-0, Math.max(0, r.endLine)) : region(Math.min(0, r.startLine), -0);
          break;
        case "fraction":
          regions[i] = region(r.startLine + 0.5, r.endLine + 0.25);
          break;
        case "touch":
          regions[i] = region(r.startLine, r.endLine);
          if (i + 1 < regions.length) regions[i + 1] = region(r.endLine, regions[i + 1].endLine < r.endLine ? r.endLine : regions[i + 1].endLine);
          break;
      }
      return { regions, defect };
    }
    const bounds = [-Infinity, -3, -1, -0, 0, 0.5, 1, 2, 3, 4.5, 7, 12, 20, 40, 60, NaN, Infinity];
    const wild = Array.from({ length: n }, () => region(bounds[Math.floor(random() * bounds.length)], bounds[Math.floor(random() * bounds.length)]));
    return { regions: wild, defect: "wild" };
  }

  function linesFor(random: () => number, regions: readonly YamlRegion[]): number[] {
    const lines: number[] = [NaN, Infinity, -Infinity, -0, 0, 0.5, -0.5];
    for (const r of regions) {
      for (const b of [r.startLine, r.endLine]) {
        if (!Number.isFinite(b)) continue;
        lines.push(b, b - 0.5, b + 0.5, b - 1, b + 1, hair(b, true), hair(b, false));
      }
    }
    for (let i = lines.length - 1; i > 0; i--) {
      const k = Math.floor(random() * (i + 1));
      [lines[i], lines[k]] = [lines[k], lines[i]];
    }
    return lines;
  }

  /** The seeded arrays, each with the lines to ask of it (shuffled). */
  function* arrays(): Generator<{ regions: YamlRegion[]; defect: string; lines: number[] }> {
    const random = seededRandom(SEED);
    for (let k = 0; k < COUNT; k++) {
      const { regions, defect } = draw(random);
      yield { regions, defect, lines: linesFor(random, regions) };
    }
  }

  it(`agrees with the old spelling and the source function on ${COUNT.toLocaleString("en-US")} arrays (ordered, ordered with one defect, wild), each asked in a shuffled order and again in the reverse order`, () => {
    const tally = newTally();
    const defects = new Map<string, number>();
    let longOrdered = 0;
    let longest = 0;
    for (const { regions, defect, lines } of arrays()) {
      defects.set(defect, (defects.get(defect) ?? 0) + 1);
      longest = Math.max(longest, regions.length);
      if (regions.length >= 8 && orderedByDefinition(regions)) longOrdered++;
      compareArray(regions, lines, tally);
      compareArray(regions, [...lines].reverse(), tally); // on a fresh lookup, in the opposite order
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.arrays).toBe(2 * COUNT);
    // The draw must reach the shapes it is for: floors, not pinned counts (the generator is Mulberry32 over a pool, not a definition a second program is asked to reproduce).
    expect([...defects.keys()].sort()).toEqual([...DEFECTS, "none", "wild"].sort());
    for (const defect of DEFECTS) expect(defects.get(defect) ?? 0).toBeGreaterThan(500);
    expect(defects.get("none") ?? 0).toBeGreaterThan(8_000);
    expect(defects.get("wild") ?? 0).toBeGreaterThan(3_000);
    expect(longOrdered).toBeGreaterThan(4_000);
    expect(longest).toBeGreaterThanOrEqual(40);
    expect(tally.orderedArrays).toBeGreaterThan(15_000);
    expect(tally.inside).toBeGreaterThan(500_000);
  }, HEAVY_ROW_MS);

  it(`the same ${COUNT.toLocaleString("en-US")} arrays: an ordered array of 8 regions or more is answered by at most the bound of reads on every line (the binary search, not a pass over the regions)`, () => {
    const problems: string[] = [];
    let arraysChecked = 0;
    let asked = 0;
    for (const { regions, lines } of arrays()) {
      if (regions.length < 8 || !orderedByDefinition(regions)) continue;
      arraysChecked++;
      const w = watched([...regions]);
      const lookup = createYamlRegionLookup(w.array);
      for (const line of lines) {
        w.reset();
        lookup(line);
        const reads = w.reads(); // read back after the ask
        asked++;
        if (reads > readBound(regions.length) && problems.length < 5) problems.push(`${showRegions(regions)} line ${show(line)}: ${reads} reads on an ordered array of ${regions.length}`);
      }
    }
    expect(problems).toEqual([]);
    expect(arraysChecked).toBeGreaterThan(4_000);
    expect(asked).toBeGreaterThan(500_000);
  }, HEAVY_ROW_MS);
});
