import { describe, expect, it } from "vitest";
import { isRSymbolChain } from "../../src/core/qmd/model";
import { countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part 5. A knitr chunk header label that is a bare token in any slot but the first is R CODE, and the
// reader accepts it only when every part after the first is a symbol or a canonical integer, joined by `-` or `:`: `R_SYMBOL_CHAIN`, whose `(?:[-:](?:name|number))*` is a quantified group. V8 keeps one entry of its
// regex backtrack stack per repetition of a group, so a token of 3,355,430 or more `-a` parts (8,388,573 or more integer parts) threw `RangeError: Maximum call stack size exceeded` (bisected at `8ebce73`, Node
// 22.23.3, a fresh process per probe), and the error reached the label index. `isRSymbolChain` reads the same language by an index loop. The old pattern is kept below, copied from the parent `8ebce73`, as the
// oracle (Learning 738), beside a reading by definition that splits the token at its separators and uses no regular expression for the structure; the pinned counts come from the old pattern and from a Python
// port of the definition (`tools/r-symbol-chain-count/count_accepted.py`, no code shared with the TypeScript), never from the code under test.

// ---- The OLD pattern, copied from the parent `8ebce73`. ----
const OLD_R_SYMBOL_CHAIN = /^\p{L}[\p{L}\p{N}_.]*(?:[-:](?:\p{L}[\p{L}\p{N}_.]*|(?:0|[1-9][0-9]{0,3})))*$/u;
const oldAccepts = (token: string): boolean => OLD_R_SYMBOL_CHAIN.test(token);

// ---- A reading of the old pattern by DEFINITION. The separators `-` and `:` are not name characters, so a token splits at them into pieces without any choice to make: the first piece must be a name (a letter,
// then letters, numbers, `_` and `.`) and every later piece a name or a canonical integer (`0`, or one to four ASCII digits that do not start with `0`). The kind of a character (letter, number, neither) is
// the one thing a program cannot restate: it comes from the caller, from a table written by hand for the characters of an alphabet, or from the Unicode property for a sweep of every code unit. ----
type Kind = "letter" | "number" | "other";
type Classify = (character: string) => Kind;
function definitionAccepts(token: string, classify: Classify): boolean {
  const pieces: string[][] = [[]];
  for (const character of token) {
    if (character === "-" || character === ":") {
      pieces.push([]);
    } else {
      pieces[pieces.length - 1].push(character);
    }
  }
  const isName = (piece: string[]): boolean =>
    piece.length > 0 && classify(piece[0]) === "letter" && piece.slice(1).every((c) => classify(c) !== "other" || c === "_" || c === ".");
  const isInteger = (piece: string[]): boolean =>
    (piece.length === 1 && piece[0] === "0") || (piece.length >= 1 && piece.length <= 4 && "123456789".includes(piece[0]) && piece.every((c) => "0123456789".includes(c)));
  return isName(pieces[0]) && pieces.slice(1).every((piece) => isName(piece) || isInteger(piece));
}

const KIND_CACHE = new Map<string, Kind>();
/** The Unicode general category, as the old pattern's `\p{L}` and `\p{N}` read it (a lone surrogate is neither). */
function propertyKind(character: string): Kind {
  let kind = KIND_CACHE.get(character);
  if (kind === undefined) {
    kind = /^\p{L}$/u.test(character) ? "letter" : /^\p{N}$/u.test(character) ? "number" : "other";
    if (character.length === 1) {
      KIND_CACHE.set(character, kind);
    }
  }
  return kind;
}

// The alphabets are written with characters whose category has never changed, and their kinds are stated here by hand.
const E_ACUTE = "é";
const BOLD_A = "\u{1d400}";
const ARABIC_THREE = "٣";
const SUPERSCRIPT_TWO = "²";
const STATED_KIND = new Map<string, Kind>([
  ["a", "letter"], [E_ACUTE, "letter"], [BOLD_A, "letter"],
  ["0", "number"], ["1", "number"], ["5", "number"], [ARABIC_THREE, "number"], [SUPERSCRIPT_TWO, "number"],
  ["-", "other"], [":", "other"], ["_", "other"], [".", "other"], ["$", "other"], [" ", "other"],
]);
const statedKind: Classify = (character) => {
  const kind = STATED_KIND.get(character);
  if (kind === undefined) {
    throw new Error(`no stated kind for ${JSON.stringify(character)}`);
  }
  return kind;
};

type Count = { compared: number; accepted: number; codePoints: number; disagreements: string[] };
/** Compare the new function with the old pattern and the reading by definition over `tokens`: how many were compared, how many the old pattern accepted, how many code points those held in all. */
function compareAll(tokens: Iterable<string>, classify: Classify, now: (token: string) => boolean = isRSymbolChain): Count {
  const count: Count = { compared: 0, accepted: 0, codePoints: 0, disagreements: [] };
  for (const token of tokens) {
    const expected = oldAccepts(token);
    count.compared++;
    if (expected) {
      count.accepted++;
      count.codePoints += Array.from(token).length;
    }
    if ((now(token) !== expected || definitionAccepts(token, classify) !== expected) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(token)}: old ${expected}, now ${now(token)}, by definition ${definitionAccepts(token, classify)}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; accepted: number; codePoints: number }> = [
  {
    label: "14 characters (a letter, an accented one, an astral one, the digits 0 1 5, an Arabic-Indic digit, a superscript two, `-`, `:`, `_`, `.`, `$`, a blank), up to 5",
    alphabet: ["a", E_ACUTE, BOLD_A, "0", "1", "5", ARABIC_THREE, SUPERSCRIPT_TWO, "-", ":", "_", ".", "$", " "], maxLength: 5, accepted: 42_045, codePoints: 205_875,
  },
  { label: "5 characters (`a`, `0`, `1`, `-`, `:`), up to 8", alphabet: ["a", "0", "1", "-", ":"], maxLength: 8, accepted: 17_710, codePoints: 135_534 },
  { label: "7 characters (`a`, `-`, `:`, `0`, `1`, `_`, `.`), up to 7", alphabet: ["a", "-", ":", "0", "1", "_", "."], maxLength: 7, accepted: 34_277, codePoints: 232_270 },
];

// Where a code unit can sit in a token: at the head of the first name (and alone), inside it and after it, at the head of a later part (a name, an integer), inside a later name, after an integer's digits (a fourth digit,
// a fifth), and after each separator. The same twenty positions are counted for the ASCII slice in the Python port.
const POSITIONS: Array<[string, (c: string) => string]> = [
  ["c", (c) => c],
  ["c + a", (c) => c + "a"],
  ["a + c", (c) => "a" + c],
  ["a + c + b", (c) => "a" + c + "b"],
  ["a + c + -a", (c) => "a" + c + "-a"],
  ["a- + c", (c) => "a-" + c],
  ["a- + c + b", (c) => "a-" + c + "b"],
  ["a-b + c + d", (c) => "a-b" + c + "d"],
  ["a-b + c", (c) => "a-b" + c],
  ["a-1 + c", (c) => "a-1" + c],
  ["a-1 + c + b", (c) => "a-1" + c + "b"],
  ["a: + c", (c) => "a:" + c],
  ["a: + c + 1", (c) => "a:" + c + "1"],
  ["a-0 + c", (c) => "a-0" + c],
  ["a-12 + c", (c) => "a-12" + c],
  ["a-123 + c + 5", (c) => "a-123" + c + "5"],
  ["a-1234 + c", (c) => "a-1234" + c],
  ["a-b- + c", (c) => "a-b-" + c],
  ["c + -a", (c) => c + "-a"],
  ["a + c + -1", (c) => "a" + c + "-1"],
];
// How many of the 128 ASCII code units make the token a chain at each position, from the Python port. The rest of the sweep depends on the Unicode version (Node 22.23 has 17.0, Python 3.10 has 13.0), so it is
// compared and bounded, not counted.
const ASCII_ACCEPTED = [52, 52, 64, 66, 64, 62, 52, 66, 64, 10, 2, 62, 61, 0, 10, 2, 0, 62, 52, 64];

function* everyCodeUnitAt(build: (c: string) => string): Generator<string> {
  for (let code = 0; code < 0x10000; code++) {
    yield build(String.fromCharCode(code));
  }
}
function* everyAstralAt(build: (c: string) => string, step: number): Generator<string> {
  for (let code = 0x10000; code <= 0x10ffff; code += step) {
    yield build(String.fromCodePoint(code));
  }
}

// A seeded sample of longer tokens: 0 to 12 pieces. The seed is written beside the counts it produces (Learning 791); the Python port reproduces the generator.
const SEEDED_COUNT = 300_000;
const SEED = 3370;
const PIECES = [
  "a", "ab", "a1", "a.b", "a_b", E_ACUTE, BOLD_A, "-", ":", "-", ":", "0", "1", "12", "123", "1234", "12345", "01", "_", ".", " ", "$",
  ARABIC_THREE, SUPERSCRIPT_TWO, "-a", ":b", "-1", "-0", ":10", "--", "-a-b",
];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = "";
    const parts = Math.floor(next() * 13);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield text;
  }
}
const SEEDED_ACCEPTED = { accepted: 19_259, codePoints: 258_497 };

// What each token is, stated by hand.
const STATED: Array<[string, boolean]> = [
  ["", false],
  ["a", true],
  ["A", true],
  ["a1", true],
  ["a.", true],
  ["a_", true],
  ["a.b_c1", true],
  ["1", false],
  ["_a", false],
  [".a", false],
  ["-", false],
  [":", false],
  ["a-b", true],
  ["a:b", true],
  ["a-b:c-d", true],
  ["a-", false],
  ["a:", false],
  ["-a", false],
  [":a", false],
  ["a--b", false],
  ["a-:b", false],
  ["a::b", false],
  ["a-0", true],
  ["a-1", true],
  ["a-9", true],
  ["a-10", true],
  ["a-1234", true],
  ["a-9999", true],
  ["a-12345", false],
  ["a-00", false],
  ["a-01", false],
  ["a-0123", false],
  ["a-1a", false],
  ["a-1.5", false],
  ["a-1e3", false],
  ["a-1_", false],
  ["a-1-b", true],
  ["a-1:2-3", true],
  ["a-1-", false],
  ["a-b1", true],
  ["a-b.1", true],
  ["a-b-1-c-0", true],
  ["a-12345-b", false],
  ["a0", true],
  ["a-0b", false],
  ["a b", false],
  ["a ", false],
  [" a", false],
  ["a\n", false],
  ["a\t", false],
  ["a$", false],
  ["a-$", false],
  ["a/b", false],
  ["a+b", false],
  [`${E_ACUTE}`, true],
  [`${E_ACUTE}-${E_ACUTE}`, true],
  [`a${ARABIC_THREE}`, true],
  [`a-${ARABIC_THREE}`, false],
  [`${ARABIC_THREE}a`, false],
  [`a${SUPERSCRIPT_TWO}`, true],
  [`a-1${ARABIC_THREE}`, false],
  [BOLD_A, true],
  [`${BOLD_A}-${BOLD_A}`, true],
  [`a-${BOLD_A}b`, true],
  [`a-b${BOLD_A}`, true],
  ["\ud835", false],
  ["\udc00", false],
  ["a\ud835", false],
  ["a\udc00", false],
  ["a-\ud835", false],
  ["a-\ud835a", false],
  ["a𝐀", true],
  ["a\udc00\ud835", false],
  [" ", false],
  ["a ", false],
  ["á", false],
  ["a-b́", false],
  ["́a", false],
];

describe("Session 337 — isRSymbolChain: the loop reads the language `^\\p{L}[\\p{L}\\p{N}_.]*(?:[-:](?:\\p{L}[\\p{L}\\p{N}_.]*|(?:0|[1-9][0-9]{0,3})))*$` did", () => {
  it("the hand-stated kinds of the alphabets are the Unicode properties", () => {
    for (const [character, kind] of STATED_KIND) {
      expect(propertyKind(character)).toBe(kind);
    }
  });

  it.each(ENUMERATIONS.map((e) => [`every token of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(everyString(e.alphabet, e.maxLength), statedKind);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countStrings(e.alphabet.length, e.maxLength), accepted: e.accepted, codePoints: e.codePoints });
  }, HEAVY_ROW_MS);

  it.each(POSITIONS.map(([name, build], index) => [name, build, index] as const))("every UTF-16 code unit at the position %s", (_name, build, index) => {
    const { disagreements, accepted, compared } = compareAll(everyCodeUnitAt(build), propertyKind);
    expect(disagreements).toEqual([]);
    expect(compared).toBe(0x10000);
    // the ASCII slice is counted by the Python port; the rest is bounded by the old pattern's own count (it follows the Unicode version of the machine) and must be reached at all where letters are accepted
    let ascii = 0;
    for (let code = 0; code < 128; code++) {
      if (oldAccepts(build(String.fromCharCode(code)))) ascii++;
    }
    expect(ascii).toBe(ASCII_ACCEPTED[index]);
    if (ASCII_ACCEPTED[index] >= 52) {
      expect(accepted).toBeGreaterThan(ASCII_ACCEPTED[index] + 40_000);
    }
  }, HEAVY_ROW_MS);

  // Every supplementary code point (a surrogate pair) at the positions a letter or a digit can sit; the reading by definition looks at every sixteenth (it is the slow one).
  it.each([
    ["c", (c: string) => c],
    ["a + c", (c: string) => "a" + c],
    ["a + c + b", (c: string) => "a" + c + "b"],
    ["a- + c", (c: string) => "a-" + c],
    ["a-b + c + -1", (c: string) => "a-b" + c + "-1"],
  ] as const)("every supplementary code point at the position %s", (_name, build) => {
    let accepted = 0;
    let compared = 0;
    const disagreements: string[] = [];
    for (const token of everyAstralAt(build, 1)) {
      const expected = oldAccepts(token);
      compared++;
      if (expected) accepted++;
      if (isRSymbolChain(token) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(token));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(0x100000);
    expect(accepted).toBeGreaterThan(60_000); // the astral letters of Unicode 13 (CJK extensions B to G alone are 65,000): a sweep that never reached a letter proves nothing
    const sampled = compareAll(everyAstralAt(build, 16), propertyKind);
    expect(sampled.disagreements).toEqual([]);
    expect(sampled.compared).toBe(0x10000);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded tokens (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT), propertyKind);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, ...SEEDED_ACCEPTED });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([token, accepted]) => [JSON.stringify(token), token, accepted] as const))("%s is %s by hand, by the old pattern, by the definition and by the new function", (_label, token, accepted) => {
    expect(oldAccepts(token)).toBe(accepted);
    expect(definitionAccepts(token, propertyKind)).toBe(accepted);
    expect(isRSymbolChain(token)).toBe(accepted);
  });

  // The controls of the comparisons above (Learning 881): readers that are wrong in one way each must be told apart by the same enumerations and sweeps, or an agreement proves nothing.
  describe("controls: a reader that is wrong in one way is caught", () => {
    const BROKEN: Array<[string, (token: string) => boolean]> = [
      ["letters are ASCII only", (token) => /^[A-Za-z][A-Za-z0-9_.]*(?:[-:](?:[A-Za-z][A-Za-z0-9_.]*|(?:0|[1-9][0-9]{0,3})))*$/.test(token)],
      ["an integer may have any number of digits", (token) => /^\p{L}[\p{L}\p{N}_.]*(?:[-:](?:\p{L}[\p{L}\p{N}_.]*|(?:0|[1-9][0-9]*)))*$/u.test(token)],
      ["an integer may start with a zero", (token) => /^\p{L}[\p{L}\p{N}_.]*(?:[-:](?:\p{L}[\p{L}\p{N}_.]*|[0-9]{1,4}))*$/u.test(token)],
      ["a name may not hold a number", (token) => /^\p{L}[\p{L}_.]*(?:[-:](?:\p{L}[\p{L}_.]*|(?:0|[1-9][0-9]{0,3})))*$/u.test(token)],
      ["a name may not hold a dot", (token) => /^\p{L}[\p{L}\p{N}_]*(?:[-:](?:\p{L}[\p{L}\p{N}_]*|(?:0|[1-9][0-9]{0,3})))*$/u.test(token)],
      ["a part may be empty", (token) => /^\p{L}[\p{L}\p{N}_.]*(?:[-:](?:\p{L}[\p{L}\p{N}_.]*|(?:0|[1-9][0-9]{0,3})|))*$/u.test(token)],
      ["a colon is no separator", (token) => /^\p{L}[\p{L}\p{N}_.]*(?:[-](?:\p{L}[\p{L}\p{N}_.]*|(?:0|[1-9][0-9]{0,3})))*$/u.test(token)],
    ];
    it.each(BROKEN)("%s", (_label, broken) => {
      const caught = compareAll(everyString(ENUMERATIONS[2].alphabet, 5), statedKind, broken).disagreements.length;
      const wide = compareAll(everyString(ENUMERATIONS[0].alphabet, 4), statedKind, broken).disagreements.length;
      const sweep = POSITIONS.some(([, build]) => compareAll(everyCodeUnitAt(build), propertyKind, broken).disagreements.length > 0);
      expect(caught + wide + (sweep ? 1 : 0)).toBeGreaterThan(0);
    }, HEAVY_ROW_MS);
  });

  // The cure itself: a token past the old overflow (3,355,430 `-a` parts, 8,388,573 integer parts) is read. The old pattern is compared only below that, where it still reads.
  const SMALL_RUNS = [1, 2, 3, 100, 4_096, 65_536, 1_000_000];
  const UNITS = ["-a", ":a", "-ab", "-a1", "-a.", "-1", "-0", "-12", ":9999", `-${E_ACUTE}`, `:${BOLD_A}`];
  const TAILS = ["", "-b", "-0", "-1234", "-01", "-12345", "-", ":", "$", " x", ".5", "-a.", `-${ARABIC_THREE}`, "\ud835"];
  it.each(SMALL_RUNS)("a token of %i parts ends where the old pattern did, with every tail", (n) => {
    for (const unit of UNITS) {
      for (const tail of TAILS) {
        const token = "a" + unit.repeat(n) + tail;
        expect(isRSymbolChain(token)).toBe(oldAccepts(token));
      }
    }
  }, HEAVY_ROW_MS);

  it("a token of 3,000,000 parts, just under the old overflow of a name unit, is read as the old pattern reads it", () => {
    for (const unit of ["-a", ":a", `-${E_ACUTE}`, "-1"]) {
      for (const tail of ["", "-01", "-12345"]) {
        const token = "a" + unit.repeat(3_000_000) + tail;
        expect(isRSymbolChain(token)).toBe(oldAccepts(token));
      }
    }
  }, HEAVY_ROW_MS);

  const LONG_NAME_RUNS = [3_355_429, 3_355_430, 4_200_000, 6_720_000];
  const LONG_NUMBER_RUNS = [8_388_572, 8_388_573, 16_800_000];
  it.each(LONG_NAME_RUNS)("a token of %i name parts is a chain, and a bad tail still refuses it", (n) => {
    for (const unit of ["-a", ":a", "-ab"]) {
      const run = "a" + unit.repeat(n);
      expect(isRSymbolChain(run)).toBe(true);
      expect(isRSymbolChain(run + "-0")).toBe(true);
      expect(isRSymbolChain(run + "-1234")).toBe(true);
      expect(isRSymbolChain(run + "-01")).toBe(false);
      expect(isRSymbolChain(run + "-12345")).toBe(false);
      expect(isRSymbolChain(run + "-")).toBe(false);
      expect(isRSymbolChain(run + "$")).toBe(false);
      expect(isRSymbolChain("1" + run)).toBe(false);
      expect(isRSymbolChain(run.slice(1))).toBe(false); // the head `a` is gone: a separator cannot start a token
    }
  }, HEAVY_ROW_MS);

  const AFTER_FIVE: Record<string, boolean> = { "-1": true, "-0": false, "-12": true, ":9999": false };
  it.each(LONG_NUMBER_RUNS)("a token of %i integer parts is a chain, and a bad tail still refuses it", (n) => {
    for (const unit of ["-1", "-0", "-12", ":9999"]) {
      const run = "a" + unit.repeat(n);
      expect(isRSymbolChain(run)).toBe(true);
      expect(isRSymbolChain(run + "-b")).toBe(true);
      expect(isRSymbolChain(run + "-01")).toBe(false);
      expect(isRSymbolChain(run + "-12345")).toBe(false);
      expect(isRSymbolChain(run + "5")).toBe(AFTER_FIVE[unit]); // the last integer grows by a digit: `-05` and `:99995` are refused, `-15` and `-125` are read
    }
  }, HEAVY_ROW_MS);

  // The old pattern's CLASS star `[\p{L}\p{N}_.]*` throws too, under the `u` flag, on a name of 4,194,288 or more astral letters (bisected at `8ebce73`, a fresh process per probe, a name of n copies of U+1D400); a name of
  // any number of BMP letters reads. The chunk header never reaches `isRSymbolChain` with such a name: the pattern that splits its arguments and the one that finds `label=` overflow first (filed as a residual).
  it("a name of millions of non-ASCII letters, BMP and astral, is read in linear time", () => {
    const started = Date.now();
    expect(isRSymbolChain(E_ACUTE.repeat(6_000_000))).toBe(true);
    expect(isRSymbolChain("a-" + E_ACUTE.repeat(6_000_000) + "-1")).toBe(true);
    expect(isRSymbolChain(BOLD_A.repeat(4_300_000))).toBe(true);
    expect(isRSymbolChain("a-" + BOLD_A.repeat(4_300_000) + "-1")).toBe(true);
    expect(isRSymbolChain(BOLD_A.repeat(4_300_000) + "$")).toBe(false);
    expect(Date.now() - started).toBeLessThan(10_000);
  }, HEAVY_ROW_MS);

  it("a token of 45,000,000 parts is read in linear time (the token is 90 million characters)", () => {
    const token = "a" + "-a".repeat(45_000_000);
    const started = Date.now();
    expect(isRSymbolChain(token)).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
