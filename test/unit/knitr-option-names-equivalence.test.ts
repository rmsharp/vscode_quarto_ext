import { describe, expect, it } from "vitest";
import { knitrOptionNames } from "../../src/core/qmd/model";
import { NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 334 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (6).
// `knitrCodeMasksPrinters` reads the NAMES assigned in the argument list of an `options(` call (anything but a number-format option masks a printing call). It listed them with the unanchored global pattern
// `/([A-Za-z.][\w.]*)[ \t]*=/g`, which tries every letter of a run of name characters as a start and reads each to the end of the run looking for an `=`: a run of n letters cost n squared. It is now
// `knitrOptionNames`, which finds each MAXIMAL run of `[\w.]` once (a start may not follow a name character) that is followed by blanks and an `=`, and answers the run without its leading digits and
// underscores (a name starts with a letter or a dot; the old pattern's leftmost start in a run is its first such character). The OLD pattern is kept here, copied from the parent `50fa22b`
// (`src/core/qmd/model.ts` before the cure), as the oracle (Learning 738), beside a reading by definition that uses no regex at all; the function returns the LIST of names, so the comparison is on every
// name and its order and not on whether one was found. The pinned counts (how many names the enumeration yields in all) come from those two and never from the code under test.

// ---- The OLD pattern, copied from the parent `50fa22b`. ----
function oldNames(args: string): string[] {
  return [...args.matchAll(/([A-Za-z.][\w.]*)[ \t]*=/g)].map((match) => match[1]);
}

// ---- A reading of the old pattern by DEFINITION, with no regular expression. ----
// Scan left to right. At a start that is a letter or a dot, take the longest run of name characters (letters, digits, underscore, dot) and try each length from the longest down to one: a name is the run so
// cut when blanks (spaces and tabs only) and an `=` follow it. A name is reported and the scan resumes after its `=`; no length works and the scan moves on one character.
const isLetterOrDot = (c: string | undefined): boolean => c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === ".");
const isNameCharacter = (c: string | undefined): boolean => isLetterOrDot(c) || (c !== undefined && ((c >= "0" && c <= "9") || c === "_"));
function definitionNames(args: string): string[] {
  const names: string[] = [];
  let at = 0;
  while (at < args.length) {
    let found = false;
    if (isLetterOrDot(args[at])) {
      let longest = at;
      while (isNameCharacter(args[longest])) {
        longest++;
      }
      for (let end = longest; end > at && !found; end--) {
        let after = end;
        while (args[after] === " " || args[after] === "\t") {
          after++;
        }
        if (args[after] === "=") {
          names.push(args.slice(at, end));
          at = after + 1;
          found = true;
        }
      }
    }
    if (!found) {
      at++;
    }
  }
  return names;
}

type Count = { compared: number; names: number; disagreements: string[] };
/** Compare the new function with the old pattern (and, where `byDefinition`, with the reading by definition) over `texts`: how many were compared, how many names the OLD pattern found in all, and the first few disagreements. */
function compareAll(texts: Iterable<string>, byDefinition = false): Count {
  let compared = 0;
  let names = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldNames(text);
    compared++;
    names += expected.length;
    const now = knitrOptionNames(text);
    const defined = byDefinition ? definitionNames(text) : expected;
    if ((JSON.stringify(now) !== JSON.stringify(expected) || JSON.stringify(defined) !== JSON.stringify(expected)) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}${byDefinition ? `, by definition ${JSON.stringify(defined)}` : ""}`);
    }
  }
  return { compared, names, disagreements };
}

// The characters the pattern reads (a letter, a digit, an underscore, a dot, a space and a tab, `=`), and for the wide alphabet the neighbours a name character could be confused with: a capital letter, a hyphen, a
// no-break space (whitespace to `\s`, not to `[ \t]`), a newline, a comma.
const NARROW = ["a", "1", "_", ".", " ", "="];
const WIDE = ["a", "Z", "1", "_", ".", " ", "\t", "=", NBSP, "-", "\n", ","];
// Tokens, not characters: the real option names, a digit-led and an underscore-led name, a dotted name, `==`, a call's comma, a number.
const TOKENS = ["digits", "scipen", "x", "9x", "_a", "a.b", "=", " = ", "==", ", ", " ", "1", ".", "..."];
const SMALL_DEFINITION = ["a", "1", ".", " ", "="];
const MIXED_DEFINITION = ["a", "1", "_", ".", " ", "\t", "=", NBSP];

const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; names: number; byDefinition: boolean }> = [
  { label: "6 characters, up to 9", alphabet: NARROW, maxLength: 9, names: 8_586_452, byDefinition: false },
  { label: "12 characters, up to 6", alphabet: WIDE, maxLength: 6, names: 440_667, byDefinition: false },
  { label: "14 tokens, up to 5", alphabet: TOKENS, maxLength: 5, names: 310_032, byDefinition: false },
  { label: "5 characters, up to 9, also by definition", alphabet: SMALL_DEFINITION, maxLength: 9, names: 2_212_532, byDefinition: true },
  { label: "8 characters, up to 6, also by definition", alphabet: MIXED_DEFINITION, maxLength: 6, names: 69_794, byDefinition: true },
];

// A seeded sample of longer texts: 0 to 14 pieces, each repeated 1 to 3 times. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3343;
const PIECES = ["a", "ab", "1", "9x", "_", "_a", ".", "a.b", " ", "\t", "=", "==", ", ", "digits", "scipen = 3", NBSP, "(", ")", "-"];
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

// Run lengths of a name character around every boundary, behind an allowed assignment or none, then a tail: the run is where the old pattern tried every start.
const RUNS = [0, 1, 2, 3, 5, 9, 100];
const SHORT_RUNS = [0, 1, 2, 3, 5];
function* runGrid(runs: readonly number[]): Generator<string> {
  for (const before of ["", "digits = 3, ", "x=1,", "9"]) {
    for (const unit of ["a", ".", "1", "_", "a1", "1a"]) {
      for (const run of runs) {
        for (const tail of ["", "=", " =", "\t=", " x", "=a", NBSP + "="]) {
          yield `${before}${unit.repeat(run)}${tail}`;
        }
      }
    }
  }
}

// What each argument list yields, stated by hand: a name is a letter or dot followed by name characters, cut where blanks and an `=` follow; digits and underscores may not start one.
const STATED: Array<[string, string[]]> = [
  ["digits = 3", ["digits"]],
  ["digits=3, scipen=10", ["digits", "scipen"]],
  ["1x = 2", ["x"]],
  ["_a = 1", ["a"]],
  ["9 = 1", []],
  ["__ = 1", []],
  ["a.b=1", ["a.b"]],
  [".5 = 1", [".5"]],
  ["a == b", ["a"]],
  ["a = b = c", ["a", "b"]],
  ["x\t= 1", ["x"]],
  ["x" + NBSP + "= 1", []],
  ["max.print = 5", ["max.print"]],
  ["aaaa", []],
  ["", []],
  ["x =", ["x"]],
  ["=", []],
  ["a=b=c=", ["a", "b", "c"]],
  ["width = 80, stringsAsFactors = FALSE", ["width", "stringsAsFactors"]],
  ["_1_a.b9 = 2", ["a.b9"]],
];

describe("Session 334 — knitrOptionNames: the new scan lists what the old pattern matched", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(everyString(e.alphabet, e.maxLength), e.byDefinition);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.names).toBe(e.names);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.names).toBe(307_332);
  }, HEAVY_ROW_MS);

  // The reading by definition tries every cut of every start, so it meets the short runs only; every run meets the old pattern.
  it("a grid of name-character runs, with assignments before and tails after", () => {
    const result = compareAll(runGrid(RUNS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(4 * 6 * RUNS.length * 7);
    expect(result.names).toBe(972);
  });

  it("the short part of that grid, also by definition", () => {
    const result = compareAll(runGrid(SHORT_RUNS), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(4 * 6 * SHORT_RUNS.length * 7);
    expect(result.names).toBe(676);
  });

  it.each(STATED.map(([args, expected]) => [JSON.stringify(args), args, expected] as const))("%s is stated as %j by hand, by the old pattern, by definition and by the new function", (_label, args, expected) => {
    expect(oldNames(args)).toEqual(expected);
    expect(definitionNames(args)).toEqual(expected);
    expect(knitrOptionNames(args)).toEqual(expected);
  });
});
