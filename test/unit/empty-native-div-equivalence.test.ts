import { describe, expect, it } from "vitest";
import { emptyNativeDivLine } from "../../src/core/qmd/model";
import {
  ATTR_PIECES, DENSE_PIECES, OLD_EMPTY_NATIVE_DIV, SWEEP_HEADS, TAG_PIECES, compareEmptyNativeDiv, definitionEmptyNativeDiv, framedLines, seededLines,
} from "./support/empty-native-div-oracle";
import { NBSP, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part (4). `endsHtmlBlock` asked whether a line is an EMPTY NATIVE DIV, `<div ...></div>` opened and closed on one
// line, with `^[ \t]*<div\b(?:[^>"']|"[^"]*"|'[^']*')*>[ \t]*<\/div>[ \t]*$` (flag `i`), a group per character of the attribute block. V8 keeps one entry of its regex backtrack stack per repetition of a group, so a line of
// 8,388,570 or more repetitions of `a` after `<div ` threw `RangeError: Maximum call stack size exceeded` (bisected at `8ebce73`, a fresh process per probe, 8,388,569 read), and the error reached every reader of the
// document. `emptyNativeDivLine` is the same question read by a loop over UTF-16 code units. The old pattern is kept in `support/empty-native-div-oracle.ts`, copied from the parent `8ebce73`, as the oracle (Learning 738),
// beside a reading by definition that uses no regex; the pinned counts come from the old pattern and from a Python port of the definition (`python3 -I`, no code shared with the TypeScript) and never from the code under test.

type Enumeration = { label: string; alphabet: readonly string[]; maxLength: number; accepted: number };
const ENUMERATIONS: Enumeration[] = [
  { label: "8 pieces dense in accepted lines (an opener, a closer, `>`, a blank, a tab, a letter, both quotes), up to 6", alphabet: DENSE_PIECES, maxLength: 6, accepted: 756 },
  { label: "10 pieces of the tag (`<`, the name in two cases, `>`, `</`, `/`, both quotes, a blank, a letter), up to 6", alphabet: TAG_PIECES, maxLength: 6, accepted: 4 },
  { label: "7 pieces (`<`, the name, `>`, `</`, a double quote, a blank, a letter), up to 8", alphabet: ATTR_PIECES, maxLength: 8, accepted: 38 },
];
const FRAMED = { compared: 2_985_920, accepted: 60_975 };
const SWEEP = { compared: 14_745_600, accepted: 2_883_064 };
const SEEDED_COUNT = 300_000;
const SEED = 3371;
const SEEDED = { compared: SEEDED_COUNT, accepted: 26_598 };

// What each line is, stated by hand: [line, an empty native div].
const STATED: Array<[string, boolean]> = [
  ["<div></div>", true],
  ["<div ></div>", true],
  ["<div a></div>", true],
  ["  <div></div>  ", true],
  ["\t<div></div>\t", true],
  ["    <div></div>", true],
  ["<DIV></DIV>", true],
  ["<Div></dIv>", true],
  ["<div>x</div>", false],
  ["<div></div>x", false],
  ["<div></div", false],
  ["<div></div >", false],
  ["</div>", false],
  ["<divx></div>", false],
  ["<div_></div>", false],
  ["<div1></div>", false],
  ["<div-></div>", true],
  ["<divé></div>", true], // `\b` is ASCII: a letter with an accent is no word character after `div`
  ["<div" + NBSP + "></div>", true],
  ["<div/></div>", true],
  ["<div>  </div>", true],
  ["<div>\t</div>\t", true],
  ["<div></div>\n", false],
  ["<div></div>\r", false],
  ["<div></div>" + NBSP, false],
  [NBSP + "<div></div>", false],
  ["<div>\n</div>", false],
  ["<div\n></div>", true],
  ['<div a="b>c"></div>', true],
  ["<div a='b>c'></div>", true],
  ['<div a="b></div>', false],
  ["<div a=\"b' c='d\"></div>", true],
  ['<div a="b"c="d"></div>', true],
  ['<div a="\n"></div>', true],
  ["<div a=''></div>", true],
  ['<div a=""></div>', true],
  ['<div a=">"></div>', true],
  ["<div a='\"'></div>", true],
  ["<div a=\"'\"></div>", true],
  ["<div a=\"'></div>", false],
  ["<div a='\"></div>", false],
  ["<div></div></div>", false],
  ["<div><div></div>", false],
  ["<div>", false],
  ["", false],
  ["<", false],
  ["<d", false],
  ["<div", false],
  ["<div ", false],
  ["<div>x", false],
  ["<dİv></div>", false],
  ["<div></dİv>", false],
  ["<ſiv></div>", false],
  ["< div></div>", false],
  ["<div></ div>", false],
];

describe("Session 337 — emptyNativeDivLine: the attribute block ends where `(?:[^>\"']|\"[^\"]*\"|'[^']*')*>` ended it", () => {
  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareEmptyNativeDiv(everyString(e.alphabet, e.maxLength), emptyNativeDivLine);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countStrings(e.alphabet.length, e.maxLength), accepted: e.accepted });
  }, HEAVY_ROW_MS);

  it("every lead, name, body of up to five characters and tail of the framed empty div", () => {
    const { disagreements, ...counts } = compareEmptyNativeDiv(framedLines(), emptyNativeDivLine);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual(FRAMED);
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at every place of seven near-div lines", () => {
    const { disagreements, ...counts } = compareEmptyNativeDiv(everyCodeUnitEdit(SWEEP_HEADS), emptyNativeDivLine);
    expect(disagreements).toEqual([]);
    expect(counts.compared).toBe(countCodeUnitEdits(SWEEP_HEADS));
    expect(counts).toEqual(SWEEP);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareEmptyNativeDiv(seededLines(SEED, SEEDED_COUNT), emptyNativeDivLine);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual(SEEDED);
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, empty]) => [JSON.stringify(line), line, empty] as const))("%s is, by hand, by the old pattern, by the definition and by the new function: an empty native div %s", (_label, line, empty) => {
    expect(OLD_EMPTY_NATIVE_DIV.test(line)).toBe(empty);
    expect(definitionEmptyNativeDiv(line)).toBe(empty);
    expect(emptyNativeDivLine(line)).toBe(empty);
  });

  // The cure itself: a line past the old overflow is read. The old pattern is compared only below that, where it still reads. A run is a number of REPETITIONS OF A UNIT (Learning 885): the unit `a` throws the
  // old pattern from 8,388,570 repetitions, ` a` from 4,194,285 and `a="b" ` (four steps of the group, heavier on the stack) from 1,525,195.
  const UNITS: Array<{ unit: string; below: number[]; past: number[] }> = [
    { unit: "a", below: [0, 1, 2, 100, 4_096, 65_536, 1_000_000, 4_000_000], past: [8_388_570, 8_400_000, 17_000_000] },
    { unit: " a", below: [1, 2, 100, 65_536, 1_000_000, 2_000_000], past: [4_194_285, 4_200_000, 8_500_000] },
    { unit: 'a="b" ', below: [1, 2, 100, 65_536, 700_000], past: [1_525_195, 1_600_000, 3_100_000] },
    { unit: "a='b' ", below: [1, 2, 100, 65_536, 700_000], past: [1_525_195, 1_600_000, 3_100_000] },
  ];
  // [what follows the run, an empty native div]
  const PLAIN_TAILS: Array<[string, boolean]> = [
    ["></div>", true],
    [">  </div>\t", true],
    ["></DIV>", true],
    ["></div>x", false],
    ["></div", false],
    [">", false],
    ["", false],
    ["> </div></div>", false],
  ];
  const OPENINGS = ["<div ", "   <div ", "\t <DIV "];
  /** Every opening and tail with the run bare, and the run inside a quoted value (double or single) that closes, or never does: [line, an empty native div]. */
  function* linesAround(run: string): Generator<[string, boolean]> {
    for (const open of OPENINGS) {
      for (const [tail, empty] of PLAIN_TAILS) {
        yield [open + run + tail, empty];
      }
      yield [open + 'q="' + run + '" t="a>b" u=\'c>d\'></div>', true];
      yield [open + 'q="' + run + '"></div>', true];
      yield [open + "q='" + run + "'></div>", true];
      yield [open + 'q="' + run + "></div>", false];
      yield [open + "q='" + run + "></div>", false];
    }
  }

  it.each(UNITS.flatMap((u) => u.below.map((n) => [u.unit, n] as const)))("a tag of %j x %i is read as the old pattern (and, up to 100,000 repetitions, the definition) reads it, with every tail", (unit, n) => {
    const run = unit.repeat(n);
    for (const [line, empty] of linesAround(run)) {
      expect(OLD_EMPTY_NATIVE_DIV.test(line)).toBe(empty);
      expect(emptyNativeDivLine(line)).toBe(empty);
      if (n <= 100_000) {
        expect(definitionEmptyNativeDiv(line)).toBe(empty);
      }
    }
  }, HEAVY_ROW_MS);

  it.each(UNITS.flatMap((u) => u.past.map((n) => [u.unit, n] as const)))("a tag of %j x %i, past the old overflow, is read: the answer is the one the tail gives", (unit, n) => {
    const run = unit.repeat(n);
    for (const [line, empty] of linesAround(run)) {
      expect(emptyNativeDivLine(line)).toBe(empty);
    }
    // by definition too, on the plain closer and the closer with text after it
    expect(definitionEmptyNativeDiv("<div " + run + "></div>")).toBe(true);
    expect(definitionEmptyNativeDiv("<div " + run + "></div>x")).toBe(false);
  }, HEAVY_ROW_MS);

  it("a line of 45,000,000 characters is read in linear time", () => {
    const run = "a".repeat(45_000_000);
    const started = Date.now();
    expect(emptyNativeDivLine("<div " + run + "></div>")).toBe(true);
    expect(emptyNativeDivLine("<div " + run + "></div>x")).toBe(false);
    expect(emptyNativeDivLine("<div " + run)).toBe(false);
    expect(Date.now() - started).toBeLessThan(3000);
  }, HEAVY_ROW_MS);
});
