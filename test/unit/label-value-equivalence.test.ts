import { describe, expect, it } from "vitest";
import { cellLabelValue, narrowLabel } from "../../src/core/refs";
import { countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// Session 338, part C of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" (group g02), sites (4) and (5) of `src/core/refs.ts`: `CELL_LABEL_VALUE`, the value of a cell's `#| label:`
// option, and `NARROW_LABEL`, the id of a brace group that is no attribute block. Both were a class-star or class-plus over letters and numbers under the `u` flag, and V8 keeps one backtrack entry per character of it, twice
// as large once the line holds a character above U+00FF: the pattern threw `RangeError: Maximum call stack size exceeded` from 4,194,284 letters (the cell value) and 4,194,288 (the group id) behind such a character,
// and a thrown RangeError answers NOTHING for the whole document. `cellLabelValue` and `narrowLabel` read the same two grammars with an index loop. They are only sound if they answer exactly what the patterns answered
// on EVERY string, so the two patterns are kept here, verbatim as they stood at HEAD `fe6aaec`, as the oracle (Learning 738), beside a reading of each grammar BY DEFINITION that uses no regular expression at all (a walk
// over the code points with the kinds of the few non-ASCII characters of the alphabets stated, not looked up), so that the agreement is not two spellings of one mistake.

const DEFINED_ID_CHAR_CLASS = String.raw`[\p{L}\p{N}_:.-]`;
const OLD_CELL_LABEL_VALUE = new RegExp(
  String.raw`^["']?(` +
    String.raw`[\p{L}\p{N}_]` +
    DEFINED_ID_CHAR_CLASS +
    String.raw`*)`,
  "u",
);
const OLD_NARROW_LABEL = new RegExp(
  String.raw`^#((?:fig|tbl|eq|lst)-` + DEFINED_ID_CHAR_CLASS + String.raw`+)`,
  "u",
);

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter of two UTF-16 code units
const HIGH_HALF = "\ud835"; // the first half of that letter, alone
const LOW_HALF = "\udc00"; // and the second half: HIGH_HALF followed by LOW_HALF IS the astral letter
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const EMOJI = String.fromCodePoint(0x1f600); // neither a letter nor a number, two code units
const E_ACUTE = String.fromCharCode(0xe9); // a lowercase letter that is no ASCII letter
const CJK_LETTER = String.fromCharCode(0x4e2d); // a letter above U+00FF: one such character puts a line on two bytes a character

type CellAnswer = { id: string; length: number } | null;

/** The kinds of the characters of the alphabets, STATED: letters are the ASCII letters, `é`, the CJK letter and the astral letter; numbers are the ASCII digits, `²` and the Arabic three. */
const isLetter = (c: string): boolean => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === E_ACUTE || c === CJK_LETTER || c === ASTRAL_LETTER;
const isNumber = (c: string): boolean => (c >= "0" && c <= "9") || c === SUPERSCRIPT_TWO || c === ARABIC_THREE;
const isStart = (c: string): boolean => isLetter(c) || isNumber(c) || c === "_";
const isIdentifier = (c: string): boolean => isStart(c) || c === ":" || c === "." || c === "-";

/** The cell value by definition, with NO regular expression: an optional opening quote, taken only when an identifier START follows it; a START; the longest run of identifier characters. A string is read by code point
 * (`Array.from`): a high half followed by a low half is ONE point, as a `u` pattern reads it. */
function cellByDefinition(text: string): CellAnswer {
  const points = Array.from(text);
  const quote = points.length > 1 && (points[0] === '"' || points[0] === "'") && isStart(points[1]) ? 1 : 0;
  if (quote >= points.length || !isStart(points[quote])) return null;
  let end = quote;
  while (end < points.length && isIdentifier(points[end])) end++;
  return { id: points.slice(quote, end).join(""), length: points.slice(0, end).join("").length };
}

/** The group id by definition, with NO regular expression: `#`, one of the four kinds, `-`, then one or more identifier characters; the id is everything after the `#`. */
function narrowByDefinition(text: string): string | null {
  const points = Array.from(text);
  if (points.length === 0 || points[0] !== "#") return null;
  for (const kind of ["fig", "tbl", "eq", "lst"]) {
    const prefix = [...kind, "-"];
    if (prefix.every((c, i) => points[1 + i] === c)) {
      let end = 1 + prefix.length;
      if (end >= points.length || !isIdentifier(points[end])) return null;
      while (end < points.length && isIdentifier(points[end])) end++;
      return points.slice(1, end).join("");
    }
  }
  return null;
}

const sameCell = (answer: CellAnswer, expected: RegExpExecArray | null): boolean =>
  expected === null ? answer === null : answer !== null && expected.index === 0 && answer.id === expected[1] && answer.length === expected[0].length;
const sameNarrow = (answer: string | null, expected: RegExpExecArray | null): boolean => (expected === null ? answer === null : answer === expected[1] && expected.index === 0);

const SEEDED_STRINGS = 100_000;
const SEED = 338;
const NEAR_MISS_LIMIT_MS = 3000; // generous: the loop reads a million letters in tens of milliseconds, a restart from every character or a rescan would take hours
const NEAR_MISS_SIZES = [20_000, 50_000, 1_000_000];
const HUGE_LETTERS = 8_400_000; // twice 4,194,284, the first throw of the cell pattern behind a character above U+00FF (4,194,283 reads; Node 22.23, HEAD fe6aaec); the group pattern's is 4,194,288
const HUGE_LIMIT_MS = 15_000; // the read takes 1.4 s at 8.4 million letters (the review of Session 338 measured 3.5 times under the old 5 s); a quadratic one takes minutes

// The alphabets of the exhaustive rows, named so that one row can pin what is in them. The cell value: A1 the quotes, the identifier classes and the one character no identifier holds (`$`), to six characters;
// A2 the Unicode kinds, with the two HALVES of an astral letter as members of their own, so that the enumeration builds the pair (a letter), a lone half (nothing) and a half beside a BMP character, to six characters.
// The group id: its strings need whole words, so the alphabets are TOKENS, concatenated: N1 the structural pieces and the near misses of the grammar (a missing dash, a capital, another kind), to five tokens;
// N2 the Unicode kinds after a kind prefix, to six tokens.
const CELL_A1 = ['"', "'", "a", "1", "_", ":", ".", "-", "$"];
const CELL_A2 = ['"', "'", "a", "-", E_ACUTE, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE];
const NARROW_N1 = ["#", "fig-", "tbl-", "eq-", "lst-", "fig", "Fig-", "sec-", "a", "-", ".", "$"];
const NARROW_N2 = ["#fig-", "#eq-", "a", "-", E_ACUTE, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE, "."];

/** What the grammar accepts in each enumeration: strings compared, strings accepted, strings whose match took a quote (cell only), and the sum of the lengths of the ids in UTF-16 code units. Counted by
 * `tools/label-value-count/count_label_value.py` (a walk over the code points of each grammar, Python 3's `unicodedata` for the letter and number kinds, no `re`, no TypeScript), so a comparison cannot pass by both
 * sides accepting nothing and the numbers do not come from the code under test. `python3 -I tools/label-value-count/count_label_value.py` prints all of them (about 10 seconds); change its alphabets with these. */
const CELL_COUNTS = {
  a1: { accepted: 243_576, quoted: 44_286, idUnits: 656_082 },
  a2: { accepted: 333_789, quoted: 60_688, idUnits: 754_016 },
  seeded: { accepted: 50_813, quoted: 4_161, idUnits: 175_895 },
};
const NARROW_COUNTS = {
  n1: { accepted: 6_410, idUnits: 69_629 },
  n2: { accepted: 135_554, idUnits: 793_651 },
  seeded: { accepted: 31_404, idUnits: 226_272 },
};
/** The sweep of every code unit below 128 (the ASCII half: which of the other 65,408 are letters and numbers is the Unicode version of the Node running the test, 17.0 on Node 22.23, 13.0 in Python 3.10). */
const ASCII_SWEEP = { cell: { strings: 3_840, accepted: 3_131, quoted: 2_562, idUnits: 13_988 }, narrow: { strings: 8_832, accepted: 2_154, idUnits: 13_669 } };
const CELL_SWEEP_HEADS = ['"fig-a.b', "'x_1", "a", ""];
const NARROW_SWEEP_HEADS = ["#fig-a.b", "#tbl-x_1", "#eq-a", "#lst-_", "#fig-"];

interface CellTotals {
  compared: number;
  accepted: number;
  quoted: number;
  idUnits: number;
  disagreements: string[];
  definitionDisagreements: string[];
}
interface NarrowTotals {
  compared: number;
  accepted: number;
  idUnits: number;
  disagreements: string[];
  definitionDisagreements: string[];
}

/** The cell value, both sides on every string: how many were compared, how many the pattern accepts, how many of those took a quote, the sum of the ids' lengths, and the first few strings on which the function
 * or the reading by definition disagrees with the pattern. */
function compareCell(strings: Iterable<string>, read: (text: string) => CellAnswer = cellLabelValue, byDefinition = true): CellTotals {
  const totals: CellTotals = { compared: 0, accepted: 0, quoted: 0, idUnits: 0, disagreements: [], definitionDisagreements: [] };
  for (const text of strings) {
    const expected = OLD_CELL_LABEL_VALUE.exec(text);
    totals.compared++;
    if (expected !== null) {
      totals.accepted++;
      totals.idUnits += expected[1].length;
      if (expected[0].length !== expected[1].length) totals.quoted++;
    }
    if (!sameCell(read(text), expected) && totals.disagreements.length < 5) totals.disagreements.push(JSON.stringify(text));
    if (byDefinition && !sameCell(cellByDefinition(text), expected) && totals.definitionDisagreements.length < 5) totals.definitionDisagreements.push(JSON.stringify(text));
  }
  return totals;
}

function compareNarrow(strings: Iterable<string>, read: (text: string) => string | null = narrowLabel, byDefinition = true): NarrowTotals {
  const totals: NarrowTotals = { compared: 0, accepted: 0, idUnits: 0, disagreements: [], definitionDisagreements: [] };
  for (const text of strings) {
    const expected = OLD_NARROW_LABEL.exec(text);
    totals.compared++;
    if (expected !== null) {
      totals.accepted++;
      totals.idUnits += expected[1].length;
    }
    if (!sameNarrow(read(text), expected) && totals.disagreements.length < 5) totals.disagreements.push(JSON.stringify(text));
    if (byDefinition && !sameNarrow(narrowByDefinition(text), expected) && totals.definitionDisagreements.length < 5) totals.definitionDisagreements.push(JSON.stringify(text));
  }
  return totals;
}

/** Every string made from one of `heads` by putting one ASCII code unit (0 to 127) at any place of it, or in place of any one of its characters: `everyCodeUnitEdit` of the support module, for the units below 128. */
function* everyAsciiEdit(heads: readonly string[]): Generator<string> {
  for (const head of heads) {
    for (let at = 0; at <= head.length; at++) {
      for (let unit = 0; unit < 128; unit++) {
        const ch = String.fromCharCode(unit);
        yield head.slice(0, at) + ch + head.slice(at);
        if (at < head.length) yield head.slice(0, at) + ch + head.slice(at + 1);
      }
    }
  }
}

function* seededCell(): Generator<string> {
  const random = seededRandom(SEED);
  const pieces = ['"', "'", "a", "B", "1", "_", ":", ".", "-", "$", " ", E_ACUTE, HIGH_HALF, LOW_HALF, ASTRAL_LETTER, SUPERSCRIPT_TWO, ARABIC_THREE, EMOJI, "fig-", "x1"];
  for (let i = 0; i < SEEDED_STRINGS; i++) {
    const count = Math.floor(random() * 13);
    let text = "";
    for (let j = 0; j < count; j++) text += pieces[Math.floor(random() * pieces.length)];
    yield text;
  }
}

function* seededNarrow(): Generator<string> {
  const random = seededRandom(SEED);
  const heads = ["#fig-", "#tbl-", "#eq-", "#lst-", "#sec-", "#fig", "fig-", "#"];
  const pieces = ["a", "b1", "-", ".", "_", ":", "$", " ", E_ACUTE, HIGH_HALF, LOW_HALF, ASTRAL_LETTER, SUPERSCRIPT_TWO, ARABIC_THREE, "}", "fig-"];
  for (let i = 0; i < SEEDED_STRINGS; i++) {
    let text = heads[Math.floor(random() * heads.length)];
    const count = Math.floor(random() * 9);
    for (let j = 0; j < count; j++) text += pieces[Math.floor(random() * pieces.length)];
    yield text;
  }
}

/** Every concatenation of 0..maxLength tokens: `everyString` over a list of tokens, which it treats as characters. */
const everyTokenString = (tokens: readonly string[], maxLength: number): Generator<string> => everyString(tokens, maxLength);

describe("Session 338 — cellLabelValue answers what CELL_LABEL_VALUE's pattern answered", () => {
  it.each<[string, string, string | null, number]>([
    ["an ordinary label", "fig-a", "fig-a", 5],
    ["a double-quoted label: the quote is consumed, the closing one is not part of the match", '"fig-a"', "fig-a", 6],
    ["a single-quoted label", "'fig-a'", "fig-a", 6],
    ["an unterminated opening quote", '"fig-a', "fig-a", 6],
    ["the id is the LONGEST identifier prefix: a dollar ends it", "fig-a$b", "fig-a", 5],
    ["a blank ends it", "fig-a b", "fig-a", 5],
    ["the whole identifier class is in the id", "fig-a.b-c:d_e", "fig-a.b-c:d_e", 13],
    ["a bare kind prefix is an id (the start clause is vestigial: the f satisfies it)", "fig-", "fig-", 4],
    ["an underscore starts an id", "_x", "_x", 2],
    ["a digit starts an id", "1x", "1x", 2],
    ["a quoted underscore", '"_"', "_", 2],
    ["a dot cannot start an id", ".x", null, 0],
    ["a dash cannot start an id", "-x", null, 0],
    ["a colon cannot start an id", ":x", null, 0],
    ["the empty value", "", null, 0],
    ["a lone quote", '"', null, 0],
    ["two quotes", '""', null, 0],
    ["a quote and a dot: the quote is taken only when an id start follows it, and then the whole pattern fails", '"."', null, 0],
    ["a quote and a dash", '"-a"', null, 0],
    ["a quote and a quote and a letter", '""a', null, 0],
    ["a quote and a blank", '" a', null, 0],
    ["a leading blank", " fig-a", null, 0],
    ["a letter then a quote: the quote is not an identifier character", 'a"', "a", 1],
    ["a non-ASCII letter", E_ACUTE, E_ACUTE, 1],
    ["a number that is no digit, then a letter", `${SUPERSCRIPT_TWO}x`, `${SUPERSCRIPT_TWO}x`, 2],
    ["a digit that is not ASCII", ARABIC_THREE, ARABIC_THREE, 1],
    ["an astral letter is ONE character of two code units", ASTRAL_LETTER, ASTRAL_LETTER, 2],
    ["a quoted astral letter and a letter: the match is 1 + 2 + 1 code units", `"${ASTRAL_LETTER}x"`, `${ASTRAL_LETTER}x`, 4],
    ["its two halves side by side are that letter", `${HIGH_HALF}${LOW_HALF}`, ASTRAL_LETTER, 2],
    ["a lone high half is nothing", HIGH_HALF, null, 0],
    ["a lone low half is nothing", LOW_HALF, null, 0],
    ["a quote then a lone half is nothing", `"${HIGH_HALF}`, null, 0],
    ["a letter then a lone half: the id stops before the half", `a${HIGH_HALF}`, "a", 1],
    ["the halves the wrong way round are two lone halves", `${LOW_HALF}${HIGH_HALF}`, null, 0],
    ["an emoji starts no id", `${EMOJI}a`, null, 0],
    ["an emoji ends the id", `a${EMOJI}`, "a", 1],
    ["a line feed ends the id", "a\nb", "a", 1],
    ["a CJK letter above U+00FF", `fig-${CJK_LETTER}`, `fig-${CJK_LETTER}`, 5],
    ["the quote is not part of the id but of the match", `'${CJK_LETTER}'`, CJK_LETTER, 2],
  ])("%s: %j", (_what, value, id, length) => {
    const want: CellAnswer = id === null ? null : { id, length };
    expect(sameCell(want, OLD_CELL_LABEL_VALUE.exec(value))).toBe(true); // the stated answer is the pattern's
    expect(cellByDefinition(value)).toEqual(want);
    expect(cellLabelValue(value)).toEqual(want);
  });

  it.each([
    ["up to six characters over the quotes, a letter, a digit, an underscore, a colon, a dot, a dash and a dollar", CELL_A1, 6, CELL_COUNTS.a1],
    ["up to six characters over the quotes, a letter, a dash, three non-ASCII kinds and the two halves of an astral letter", CELL_A2, 6, CELL_COUNTS.a2],
  ] as const)("agrees with the pattern and with the grammar by definition on every string of %s", (_name, alphabet, maxLength, counts) => {
    const result = compareCell(everyString(alphabet, maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect({ accepted: result.accepted, quoted: result.quoted, idUnits: result.idUnits }).toEqual(counts);
  });

  it("agrees with the pattern and with the grammar by definition on 100,000 seeded values of up to twelve pieces", () => {
    const result = compareCell(seededCell());
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect({ accepted: result.accepted, quoted: result.quoted, idUnits: result.idUnits }).toEqual(CELL_COUNTS.seeded);
  });

  // The alphabets above hold the characters the grammar is most likely to take by mistake; this holds EVERY UTF-16 code unit (a lone surrogate included) at every place of a value, by putting one at each place of a head
  // and in place of each of its characters. The first head has every structural place of the grammar in it: before the opening quote, between the quote and the start, at the start, in the tail and at its end, after a
  // dot, a dash and a letter. The others put a unit around a single-quote value, a bare letter and nothing. The ASCII half of the accepted count IS pinned, from the Python port; the other half is the Unicode version of the
  // Node running the test, so the row says only that a good part of the strings are accepted and a good part refused.
  it("agrees with the pattern on every UTF-16 code unit at every place of four heads", () => {
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(CELL_SWEEP_HEADS)) {
      compared++;
      const expected = OLD_CELL_LABEL_VALUE.exec(text);
      if (expected !== null) accepted++;
      if (!sameCell(cellLabelValue(text), expected) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(CELL_SWEEP_HEADS));
    expect(compared).toBe((17 + 9 + 3 + 1) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 10);
    expect(accepted).toBeLessThan(compared * 0.95);
  });

  it("agrees with the pattern and with the grammar by definition on every ASCII code unit at every place of the four heads, and the count is the Python port's", () => {
    const result = compareCell(everyAsciiEdit(CELL_SWEEP_HEADS));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect({ strings: result.compared, accepted: result.accepted, quoted: result.quoted, idUnits: result.idUnits }).toEqual(ASCII_SWEEP.cell);
  });

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a function that never takes a quote, and one that anchors the id at the end, each disagree with the pattern, and the loop
  // counts what it was asked.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    const noQuote = compareCell(everyString(CELL_A1, 3), (text) => {
      const answer = cellLabelValue(text);
      return text.startsWith('"') || text.startsWith("'") ? null : answer;
    });
    expect(noQuote.compared).toBe(countStrings(CELL_A1.length, 3));
    expect(noQuote.disagreements.length).toBeGreaterThan(0);
    const wholeOrNothing = compareCell(everyString(CELL_A1, 3), (text) => {
      const answer = cellLabelValue(text);
      return answer !== null && answer.length !== text.length ? null : answer;
    });
    expect(wholeOrNothing.disagreements.length).toBeGreaterThan(0);
    expect(noQuote.definitionDisagreements).toEqual([]); // the reading by definition does not depend on the function
  });

  // The pattern THROWS RangeError from 4,194,284 letters behind a character above U+00FF, so the huge rows have no old answer to compare with: the answer is the grammar's. 1,000,000 is under the pattern's limit and both are asked.
  it.each([
    ["ASCII letters", "a"],
    ["a letter above U+00FF", CJK_LETTER],
    ["an astral letter", ASTRAL_LETTER],
  ])("reads a value of 1,000,000 %s as the pattern does, plain, quoted, and with a dollar, a blank and a lone half at its end", (_what, letter) => {
    const run = letter.repeat(1_000_000);
    for (const value of [`fig-${run}`, `"fig-${run}"`, `'${run}`, `fig-${run}$x`, `fig-${run} caption`, `fig-${run}${HIGH_HALF}`, `.${run}`, `"${run}`, `"-${run}`]) {
      expect(sameCell(cellLabelValue(value), OLD_CELL_LABEL_VALUE.exec(value))).toBe(true);
    }
  });

  it("reads a value of 8,400,000 letters (twice the pattern's limit behind a character above U+00FF) inside the limit, to the id the grammar gives", () => {
    const run = CJK_LETTER.repeat(HUGE_LETTERS);
    const values = [`fig-${run}`, `"fig-${run}"`, `fig-${run}$x`, `fig-${run} caption`, `.fig-${run}`];
    const started = performance.now();
    const answers = values.map((value) => cellLabelValue(value));
    const took = performance.now() - started;
    expect(answers.map((a) => (a === null ? null : [a.id === `fig-${run}`, a.length]))).toEqual([[true, 4 + HUGE_LETTERS], [true, 5 + HUGE_LETTERS], [true, 4 + HUGE_LETTERS], [true, 4 + HUGE_LETTERS], null]);
    expect(took).toBeLessThan(HUGE_LIMIT_MS);
  });

  // The pattern was LINEAR on the shapes below, and a loop must stay so: a restart from every character, a rescan of the value for each quote, or a quadratic look back would take seconds at a million characters. 20,000 is in
  // the sizes so that a function which keeps the quadratic way for short values cannot hide below the larger ones. The limit is wide on purpose.
  it.each<[string, (n: number) => string, boolean]>([
    ["a label of ASCII letters", (n) => `fig-${"a".repeat(n)}`, true],
    ["a label of letters above U+00FF", (n) => `fig-${CJK_LETTER.repeat(n)}`, true],
    ["a quoted label", (n) => `"fig-${"a".repeat(n)}"`, true],
    ["letters then a dollar", (n) => `${"a".repeat(n)}$`, true],
    ["a quote and letters then a dollar", (n) => `"${"a".repeat(n)}$`, true],
    ["dashes after a letter", (n) => `a${"-".repeat(n)}`, true],
    ["quotes only", (n) => '"'.repeat(n), false],
    ["dots only", (n) => ".".repeat(n), false],
    ["a quote and dots", (n) => `"${".".repeat(n)}`, false],
    ["astral letters", (n) => ASTRAL_LETTER.repeat(n / 2), true],
  ])("%s: is read in linear time at every near-miss size", (_what, build, accepted) => {
    for (const n of NEAR_MISS_SIZES) {
      const value = build(n);
      const started = performance.now();
      const answer = cellLabelValue(value);
      const took = performance.now() - started;
      expect(sameCell(answer, OLD_CELL_LABEL_VALUE.exec(value))).toBe(true);
      expect(answer !== null).toBe(accepted);
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  });
});

describe("Session 338 — narrowLabel answers what NARROW_LABEL's pattern answered", () => {
  it.each<[string, string, string | null]>([
    ["a figure", "#fig-a", "fig-a"],
    ["a table", "#tbl-a", "tbl-a"],
    ["an equation", "#eq-a", "eq-a"],
    ["a listing", "#lst-a", "lst-a"],
    ["the id is the LONGEST identifier prefix: a blank ends it", "#fig-a b", "fig-a"],
    ["a dollar ends it (the older scan takes the prefix, not the whole)", "#fig-a$", "fig-a"],
    ["the whole identifier class is in the id", "#fig-a.b-c:d_e", "fig-a.b-c:d_e"],
    ["a dash may be the only id character", "#fig--", "fig--"],
    ["a dot may be the only id character", "#fig-.", "fig-."],
    ["a colon may be the only id character", "#fig-:", "fig-:"],
    ["an underscore may be the only id character", "#fig-_", "fig-_"],
    ["a digit may be the only id character", "#lst-1", "lst-1"],
    ["a kind prefix with nothing after its dash", "#fig-", null],
    ["a kind prefix with a blank after its dash", "#fig- a", null],
    ["a kind prefix with a dollar after its dash", "#fig-$a", null],
    ["a kind prefix without its dash", "#fig", null],
    ["a kind prefix with an underscore for its dash", "#fig_a", null],
    ["a capital kind prefix", "#Fig-a", null],
    ["another kind (section labels are the headings')", "#sec-a", null],
    ["a longer word that begins like a kind", "#figg-a", null],
    ["a shorter word", "#fi-a", null],
    ["a word that ends like a kind", "#xfig-a", null],
    ["no hash", "fig-a", null],
    ["a leading blank", " #fig-a", null],
    ["two hashes", "##fig-a", null],
    ["the empty content", "", null],
    ["a hash alone", "#", null],
    ["a non-ASCII letter after the dash", `#fig-${E_ACUTE}`, `fig-${E_ACUTE}`],
    ["an astral letter after the dash", `#eq-${ASTRAL_LETTER}`, `eq-${ASTRAL_LETTER}`],
    ["its two halves side by side are that letter", `#eq-${HIGH_HALF}${LOW_HALF}`, `eq-${ASTRAL_LETTER}`],
    ["a lone high half after the dash", `#fig-${HIGH_HALF}`, null],
    ["a lone low half after the dash", `#fig-${LOW_HALF}`, null],
    ["a letter then a lone half: the id stops before the half", `#fig-a${HIGH_HALF}`, "fig-a"],
    ["a number that is no digit", `#fig-${SUPERSCRIPT_TWO}`, `fig-${SUPERSCRIPT_TWO}`],
    ["a digit that is not ASCII", `#tbl-${ARABIC_THREE}`, `tbl-${ARABIC_THREE}`],
    ["an emoji after the dash", `#fig-${EMOJI}`, null],
    ["an emoji ends the id", `#fig-a${EMOJI}`, "fig-a"],
    ["a line feed ends the id", "#fig-a\nb", "fig-a"],
    ["a CJK letter above U+00FF", `#fig-${CJK_LETTER}`, `fig-${CJK_LETTER}`],
  ])("%s: %j", (_what, content, id) => {
    expect(sameNarrow(id, OLD_NARROW_LABEL.exec(content))).toBe(true); // the stated answer is the pattern's
    expect(narrowByDefinition(content)).toBe(id);
    expect(narrowLabel(content)).toBe(id);
  });

  it.each([
    ["up to five tokens over a hash, the four kinds, a kind without its dash, a capital, another kind, a letter, a dash, a dot and a dollar", NARROW_N1, 5, NARROW_COUNTS.n1],
    ["up to six tokens over two kind prefixes, a letter, a dash, a dot, three non-ASCII kinds and the two halves of an astral letter", NARROW_N2, 6, NARROW_COUNTS.n2],
  ] as const)("agrees with the pattern and with the grammar by definition on every concatenation of %s", (_name, tokens, maxLength, counts) => {
    const result = compareNarrow(everyTokenString(tokens, maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(tokens.length, maxLength)); // every concatenation of 0..maxLength tokens, none skipped
    expect({ accepted: result.accepted, idUnits: result.idUnits }).toEqual(counts);
  });

  it("agrees with the pattern and with the grammar by definition on 100,000 seeded contents of a head and up to eight pieces", () => {
    const result = compareNarrow(seededNarrow());
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect({ accepted: result.accepted, idUnits: result.idUnits }).toEqual(NARROW_COUNTS.seeded);
  });

  // EVERY UTF-16 code unit at every place of five heads: before the hash, between the hash and the kind, inside the kind, at its dash, at the first id character and later ones, and at the end. The ASCII half of the
  // accepted count is pinned from the Python port, the other half is bounded (the Unicode version of the Node running the test).
  it("agrees with the pattern on every UTF-16 code unit at every place of five heads", () => {
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(NARROW_SWEEP_HEADS)) {
      compared++;
      const expected = OLD_NARROW_LABEL.exec(text);
      if (expected !== null) accepted++;
      if (!sameNarrow(narrowLabel(text), expected) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(NARROW_SWEEP_HEADS));
    expect(compared).toBe((17 + 17 + 11 + 13 + 11) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 20);
    expect(accepted).toBeLessThan(compared * 0.9);
  });

  it("agrees with the pattern and with the grammar by definition on every ASCII code unit at every place of the five heads, and the count is the Python port's", () => {
    const result = compareNarrow(everyAsciiEdit(NARROW_SWEEP_HEADS));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect({ strings: result.compared, accepted: result.accepted, idUnits: result.idUnits }).toEqual(ASCII_SWEEP.narrow);
  });

  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    const figuresOnly = compareNarrow(everyTokenString(NARROW_N1, 3), (text) => {
      const answer = narrowLabel(text);
      return answer !== null && !answer.startsWith("fig-") ? null : answer;
    });
    expect(figuresOnly.compared).toBe(countStrings(NARROW_N1.length, 3));
    expect(figuresOnly.disagreements.length).toBeGreaterThan(0);
    const oneCharacter = compareNarrow(everyTokenString(NARROW_N1, 3), (text) => {
      const answer = narrowLabel(text);
      return answer === null ? null : answer.slice(0, answer.indexOf("-") + 2);
    });
    expect(oneCharacter.disagreements.length).toBeGreaterThan(0);
    expect(figuresOnly.definitionDisagreements).toEqual([]); // the reading by definition does not depend on the function
  });

  it.each([
    ["ASCII letters", "a"],
    ["a letter above U+00FF", CJK_LETTER],
    ["an astral letter", ASTRAL_LETTER],
  ])("reads a content of 1,000,000 %s as the pattern does, plain, with a blank, a dollar and a lone half at its end, and refused at the kind prefix", (_what, letter) => {
    const run = letter.repeat(1_000_000);
    for (const content of [`#fig-${run}`, `#tbl-${run} b`, `#eq-${run}$x`, `#lst-${run}${HIGH_HALF}`, `#fig-$${run}`, `#sec-${run}`, `#Fig-${run}`, `#${run}`, `#fig${run}`]) {
      expect(sameNarrow(narrowLabel(content), OLD_NARROW_LABEL.exec(content))).toBe(true);
    }
  });

  it("reads a content of 8,400,000 letters (twice the pattern's limit behind a character above U+00FF) inside the limit, to the id the grammar gives", () => {
    const run = CJK_LETTER.repeat(HUGE_LETTERS);
    const contents = [`#fig-${run}`, `#tbl-${run} b`, `#eq-${run}$x`, `#lst-${run} ${CJK_LETTER}`, `#sec-${run}`];
    const started = performance.now();
    const answers = contents.map((content) => narrowLabel(content));
    const took = performance.now() - started;
    expect(answers.map((a, i) => (a === null ? null : a === `${["fig", "tbl", "eq", "lst"][i]}-${run}`))).toEqual([true, true, true, true, null]);
    expect(took).toBeLessThan(HUGE_LIMIT_MS);
  });

  it.each<[string, (n: number) => string, boolean]>([
    ["a figure id of ASCII letters", (n) => `#fig-${"a".repeat(n)}`, true],
    ["a figure id of letters above U+00FF", (n) => `#fig-${CJK_LETTER.repeat(n)}`, true],
    ["letters then a bang", (n) => `#fig-${"a".repeat(n)}!`, true],
    ["a dollar after the dash, then letters", (n) => `#fig-$${"a".repeat(n)}`, false],
    ["a hash and letters, no kind", (n) => `#${"a".repeat(n)}`, false],
    ["a kind word repeated", (n) => `#${"fig".repeat(n / 3)}`, false],
    ["dashes after the kind prefix", (n) => `#eq-${"-".repeat(n)}`, true],
    ["hashes only", (n) => "#".repeat(n), false],
    ["astral letters", (n) => `#lst-${ASTRAL_LETTER.repeat(n / 2)}`, true],
  ])("%s: is read in linear time at every near-miss size", (_what, build, accepted) => {
    for (const n of NEAR_MISS_SIZES) {
      const content = build(n);
      const started = performance.now();
      const answer = narrowLabel(content);
      const took = performance.now() - started;
      expect(sameNarrow(answer, OLD_NARROW_LABEL.exec(content))).toBe(true);
      expect(answer !== null).toBe(accepted);
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  });
});

describe("the constants of the Session 338 label value equivalence rows", () => {
  // A size of 40 characters, or a limit of 100 s, would pass on the pattern too, and one letter put in an alphabet in place of another moves neither its string count nor its accepted count, so the code points are pinned.
  it("keeps the limits, the sizes, the seed, the alphabets and the counts the rows above are built on", () => {
    expect([NEAR_MISS_LIMIT_MS, NEAR_MISS_SIZES, HUGE_LETTERS, HUGE_LIMIT_MS, SEEDED_STRINGS, SEED]).toEqual([3000, [20_000, 50_000, 1_000_000], 8_400_000, 15_000, 100_000, 338]);
    expect(HUGE_LETTERS).toBeGreaterThanOrEqual(2 * 4_194_288); // twice the larger of the two first throws (4,194,284 cell value, 4,194,288 group id) at HEAD fe6aaec
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.codePointAt(0) as number);
    expect(codes(CELL_A1)).toEqual([0x22, 0x27, 0x61, 0x31, 0x5f, 0x3a, 0x2e, 0x2d, 0x24]);
    expect(codes(CELL_A2)).toEqual([0x22, 0x27, 0x61, 0x2d, 0xe9, 0xd835, 0xdc00, 0xb2, 0x663]);
    expect(NARROW_N1).toEqual(["#", "fig-", "tbl-", "eq-", "lst-", "fig", "Fig-", "sec-", "a", "-", ".", "$"]);
    expect(codes(NARROW_N2)).toEqual([0x23, 0x23, 0x61, 0x2d, 0xe9, 0xd835, 0xdc00, 0xb2, 0x663, 0x2e]);
    expect(NARROW_N2.slice(0, 2)).toEqual(["#fig-", "#eq-"]);
    expect(`${HIGH_HALF}${LOW_HALF}`).toBe(ASTRAL_LETTER); // the two halves ARE the astral letter
    expect(CELL_SWEEP_HEADS).toEqual(['"fig-a.b', "'x_1", "a", ""]);
    expect(NARROW_SWEEP_HEADS).toEqual(["#fig-a.b", "#tbl-x_1", "#eq-a", "#lst-_", "#fig-"]);
    expect(CELL_COUNTS).toEqual({
      a1: { accepted: 243_576, quoted: 44_286, idUnits: 656_082 },
      a2: { accepted: 333_789, quoted: 60_688, idUnits: 754_016 },
      seeded: { accepted: 50_813, quoted: 4_161, idUnits: 175_895 },
    });
    expect(NARROW_COUNTS).toEqual({ n1: { accepted: 6_410, idUnits: 69_629 }, n2: { accepted: 135_554, idUnits: 793_651 }, seeded: { accepted: 31_404, idUnits: 226_272 } });
    expect(ASCII_SWEEP).toEqual({ cell: { strings: 3_840, accepted: 3_131, quoted: 2_562, idUnits: 13_988 }, narrow: { strings: 8_832, accepted: 2_154, idUnits: 13_669 } });
  });
});
