import { describe, expect, it } from "vitest";
import { blockQuoteMarkerRunEnd } from "../../src/core/qmd/model";
import { LS, NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 335 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (8). `blockQuotePrefix` read the run of block-quote markers with `BLOCK_QUOTE_MARKERS`,
// `/^(?:>[ ]?)+/`, and V8 keeps one entry of its regex backtrack stack per repetition of a group: a line of 8,388,781 or more `>` threw `RangeError: Maximum call stack size exceeded` (bisected at `c06ee06`), and the
// error reached every reader of the document. No flat spelling accepts the same strings, so `blockQuoteMarkerRunEnd` is a loop. The old pattern is kept below, copied from the parent `c06ee06`, as the oracle (Learning
// 738), beside a reading by definition that uses no regex; the pinned counts (how many strings of each enumeration the OLD pattern matches) come from the old pattern and from a Python port of it and never from the code
// under test.

// ---- The OLD pattern, copied from the parent `c06ee06`. ----
const OLD_BLOCK_QUOTE_MARKERS = /^(?:>[ ]?)+/;
const oldRunLength = (text: string): number => OLD_BLOCK_QUOTE_MARKERS.exec(text)?.[0].length ?? 0;

// ---- A reading of the old pattern by DEFINITION, with no regular expression: a marker is a `>` and at most one space directly after it, and the run is as many markers as follow one another from the start. ----
function definitionRunLength(text: string): number {
  let end = 0;
  for (;;) {
    if (text[end] !== ">") {
      return end;
    }
    end += text[end + 1] === " " ? 2 : 1;
  }
}

type Count = { compared: number; matched: number; disagreements: string[] };
/** Compare the new function with the old pattern and with the reading by definition over `texts`, at start 0 and behind a blank prefix. */
function compareAll(texts: Iterable<string>): Count {
  let compared = 0;
  let matched = 0;
  const disagreements: string[] = [];
  const note = (message: string): void => {
    if (disagreements.length < 5) {
      disagreements.push(message);
    }
  };
  for (const text of texts) {
    const expected = oldRunLength(text);
    compared++;
    if (expected > 0) {
      matched++;
    }
    const now = blockQuoteMarkerRunEnd(text, 0);
    const byDefinition = definitionRunLength(text);
    if (now !== expected || byDefinition !== expected) {
      note(`${JSON.stringify(text)}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
    // The caller strips the indent and asks from there: the same text behind blanks must end the same distance on.
    for (const indent of ["  ", "\t"]) {
      const behind = blockQuoteMarkerRunEnd(indent + text, indent.length);
      if (behind !== indent.length + expected) {
        note(`${JSON.stringify(indent + text)} from ${indent.length}: expected ${indent.length + expected}, got ${behind}`);
      }
    }
  }
  return { compared, matched, disagreements };
}

const SMALL = [">", " ", "a"];
const WIDE = [">", " ", "\t", "a", NBSP, LS];
const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; matched: number }> = [
  { label: "3 characters (`> a`), up to 14", alphabet: SMALL, maxLength: 14, matched: 2_391_484 },
  { label: "6 characters (`>`, blank, tab, letter, no-break space, U+2028), up to 8", alphabet: WIDE, maxLength: 8, matched: 335_923 },
];

// A seeded sample of longer lines: 0 to 14 pieces, each repeated 1 to 3 times. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3352;
const PIECES = [">", ">", ">", " ", " ", "> ", ">>", "\t", "a", "x y", NBSP, LS, ">>>"];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = "";
    const parts = Math.floor(next() * 15);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield text;
  }
}

// What each text is, stated by hand: the end of the run, counted from the start of the text.
const STATED: Array<[string, number]> = [
  ["", 0],
  [">", 1],
  ["> ", 2],
  [">  ", 2],
  [">>", 2],
  ["> >", 3],
  ["> > ", 4],
  [">  >", 2],
  [">>  >", 3],
  ["> >  x", 4],
  [">\t", 1],
  ["> x", 2],
  [">x", 1],
  ["a>", 0],
  [" >", 0],
  ["\t>", 0],
  [NBSP + ">", 0],
  [">" + NBSP, 1],
  ["> " + NBSP, 2],
  [">" + LS, 1],
  ["> # H", 2],
  [">>> # H", 4],
];

describe("Session 335 — blockQuoteMarkerRunEnd: the loop ends the marker run where `^(?:>[ ]?)+` did", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(everyString(e.alphabet, e.maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.matched).toBe(e.matched);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.matched).toBe(129_545);
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([text, end]) => [JSON.stringify(text), text, end] as const))("%s ends its marker run at %i by hand, by the old pattern, by the definition and by the new function", (_label, text, end) => {
    expect(oldRunLength(text)).toBe(end);
    expect(definitionRunLength(text)).toBe(end);
    expect(blockQuoteMarkerRunEnd(text, 0)).toBe(end);
  });

  it("starts where it is told: the same markers behind other text, at every start", () => {
    const text = "ab > >  > x";
    const ends = Array.from({ length: text.length + 1 }, (_, start) => blockQuoteMarkerRunEnd(text, start));
    // At 3 the run is `> > ` and ends at 7 (the second blank after it is not part of it), at 5 it is `> ` and ends at 7 too, at 8 it is `> ` and ends at 10; everywhere else it is empty and ends where it starts.
    expect(ends).toEqual([0, 1, 2, 7, 4, 7, 6, 7, 10, 9, 10, 11]);
    expect(ends).toEqual(Array.from({ length: text.length + 1 }, (_, start) => start + oldRunLength(text.slice(start))));
    expect(blockQuoteMarkerRunEnd(text, text.length)).toBe(text.length);
    expect(blockQuoteMarkerRunEnd("", 0)).toBe(0);
  });

  // The cure itself: a run past the old overflow (8,388,781 for `>`) is read, and the whole run is the marker run. The old pattern is compared only below that, where it still reads.
  const SMALL_RUNS = [1, 2, 3, 100, 4_096, 65_536, 1_048_576, 4_194_304];
  const LONG_RUNS = [8_388_781, 9_000_000, 16_777_216, 45_000_000];
  it.each(SMALL_RUNS)("a run of %i `>` and of %i `> ` pairs ends the same as the old pattern", (n) => {
    expect(blockQuoteMarkerRunEnd(">".repeat(n), 0)).toBe(oldRunLength(">".repeat(n)));
    expect(blockQuoteMarkerRunEnd("> ".repeat(n), 0)).toBe(oldRunLength("> ".repeat(n)));
    expect(blockQuoteMarkerRunEnd(">".repeat(n) + "  x", 0)).toBe(oldRunLength(">".repeat(n) + "  x"));
  });

  it.each(LONG_RUNS)("a run of %i `>` is read, and so are that many `> ` pairs, and a tail of two blanks takes one", (n) => {
    expect(blockQuoteMarkerRunEnd(">".repeat(n), 0)).toBe(n);
    expect(blockQuoteMarkerRunEnd("> ".repeat(n), 0)).toBe(2 * n);
    expect(blockQuoteMarkerRunEnd(">".repeat(n) + "  x", 0)).toBe(n + 1);
    expect(blockQuoteMarkerRunEnd(" ".repeat(n) + ">".repeat(n), n)).toBe(2 * n);
  });

  it("a run of 45,000,000 `>` is read in linear time", () => {
    const text = ">".repeat(45_000_000);
    const started = Date.now();
    expect(blockQuoteMarkerRunEnd(text, 0)).toBe(45_000_000);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
