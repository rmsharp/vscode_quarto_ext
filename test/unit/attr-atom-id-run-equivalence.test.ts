import { describe, expect, it } from "vitest";
import { attributeAtomRun } from "../../src/core/qmd/model";
import { countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// Session 337, part 1 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" (group g02). `ATTR_ATOM_RUN` judged one token of an attribute block (a heading, a fence info string,
// an image, a span, a div) as dashes, at most one class and then ids, and read the ids as the quantified group `(?:#[\p{L}\p{N}_:.-]+)*`: V8 keeps one backtrack entry per repetition, so a token of 3,355,430 ids
// (`#a` x 3,355,430, 6.7 million characters) threw `RangeError: Maximum call stack size exceeded` and the RangeError reached every reader of the document. `attributeAtomRun` reads the same token with a loop. It is only
// sound if it accepts exactly what the pattern accepted on EVERY string, so the pattern is kept here, verbatim as it stood at HEAD `8ebce73`, as the oracle (Learning 738), beside a reading of the GRAMMAR by definition that
// uses no regular expression at all (a memoised parse of the three atoms, the shape Session 324's original alternation had), so that the agreement is not two spellings of one mistake.

const OLD_ATTR_ATOM_RUN = /^(?!$)-*(?:\.\p{L}[\p{L}\p{N}_:.-]*)?(?:#[\p{L}\p{N}_:.-]+)*$/u;

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter of two UTF-16 code units
const HIGH_HALF = "\ud835"; // the first half of that letter, alone
const LOW_HALF = "\udc00"; // and the second half: HIGH_HALF followed by LOW_HALF IS the astral letter
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const EMOJI = String.fromCodePoint(0x1f600); // neither a letter nor a number, two code units
const E_ACUTE = String.fromCharCode(0xe9); // a lowercase letter that is no ASCII letter

/** The grammar by definition, with NO regular expression: one or more ATOMS, an atom being `-`, or `#` and one or more identifier characters, or `.` and a letter and any identifier characters (the identifier characters
 * being letters, numbers, `_`, `:`, `.` and `-`), found by a parse that tries every way to cut the token into atoms. The kinds of the few non-ASCII characters of the alphabets below are stated, not looked up. */
function acceptsByDefinition(token: string): boolean {
  const points = Array.from(token, (c) => c.codePointAt(0) as number); // iteration by code point: a high half followed by a low half is ONE point, as a `u` pattern reads it
  const n = points.length;
  if (n === 0) return false;
  const isLetter = (p: number): boolean => (p >= 65 && p <= 90) || (p >= 97 && p <= 122) || p === 0xe9 || p === 0x1d400;
  const isNumber = (p: number): boolean => (p >= 48 && p <= 57) || p === 0xb2 || p === 0x663;
  const isIdentifier = (p: number): boolean => isLetter(p) || isNumber(p) || p === 95 || p === 58 || p === 46 || p === 45;
  const reach = new Array<boolean>(n + 1).fill(false);
  reach[0] = true;
  for (let i = 0; i < n; i++) {
    if (!reach[i]) continue;
    if (points[i] === 45) reach[i + 1] = true;
    if (points[i] === 35) {
      for (let j = i + 1; j < n && isIdentifier(points[j]); j++) reach[j + 1] = true;
    }
    if (points[i] === 46 && i + 1 < n && isLetter(points[i + 1])) {
      reach[i + 2] = true;
      for (let j = i + 2; j < n && isIdentifier(points[j]); j++) reach[j + 1] = true;
    }
  }
  return reach[n];
}

const NEAR_MISS_LIMIT_MS = 100;
const NEAR_MISS_SIZES = [20_000, 50_000, 1_000_000];
const HUGE_IDS = 7_000_000; // twice 3,355,430, the first throw of the pattern's id group (3,355,429 reads; Node 22.23, Session 337)
const HUGE_LIMIT_MS = 2000;
const SEEDED_STRINGS = 100_000;
const SEED = 337;

// The three alphabets of the exhaustive rows, named so that one row can pin what is in them. D1: the structural characters, the one identifier character that is no letter and may not start a class (`1`), and the
// character no atom holds (`!`), to eight characters. D2: the Unicode kinds, with the two HALVES of an astral letter as members of their own, so that the enumeration builds the pair (a letter), a lone half (nothing) and a half
// beside a BMP character, and a non-ASCII letter, two numbers, to six characters. D3: the structural characters, one letter and the two halves, to seven characters.
const ALPHABET_D1 = ["#", "a", "1", "-", ".", "!"];
const ALPHABET_D2 = ["-", "#", ".", E_ACUTE, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE];
const ALPHABET_D3 = ["-", "#", ".", "a", HIGH_HALF, LOW_HALF];

/** How many strings of each enumeration the grammar accepts. Counted by `tools/attr-atom-count/count_id_run.py` (a memoised parse of the three atoms over a list of UTF-16 code units decoded by hand, Python 3's
 * `unicodedata` for the letter and number kinds, no `re`, no TypeScript), so a comparison cannot pass by both sides accepting nothing and the numbers do not come from the code under test. The seeded one is counted the same way
 * from a port of the generator. `python3 -I tools/attr-atom-count/count_id_run.py` prints all four (about 15 seconds); change its alphabets with these. */
const ACCEPTED = { d1: 86_023, d2: 10_206, d3: 6_769, seeded: 19_719 };

/** Both sides on every string: how many were compared, how many the pattern accepts, and the first few strings on which the function or the reading by definition disagrees with it. */
function compareAll(strings: Iterable<string>, accepts: (text: string) => boolean): { compared: number; accepted: number; disagreements: string[]; definitionDisagreements: string[] } {
  let compared = 0;
  let accepted = 0;
  const disagreements: string[] = [];
  const definitionDisagreements: string[] = [];
  for (const text of strings) {
    const expected = OLD_ATTR_ATOM_RUN.test(text);
    compared++;
    if (expected) accepted++;
    if (accepts(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    if (acceptsByDefinition(text) !== expected && definitionDisagreements.length < 5) definitionDisagreements.push(JSON.stringify(text));
  }
  return { compared, accepted, disagreements, definitionDisagreements };
}

describe("Session 337 — attributeAtomRun accepts what ATTR_ATOM_RUN's pattern accepted", () => {
  it.each([
    ["a dash is an atom", "-", true],
    ["dashes concatenate", "--", true],
    ["an id", "#a", true],
    ["ids concatenate", "#a#b", true],
    ["many ids", "#a#a#a#a#a#a#a#a", true],
    ["a class", ".A", true],
    ["a dot is an identifier character: one class", ".A.B", true],
    ["a class tail holds letters, digits, underscore, colon, dot and dash", ".a1_b:c.d-e", true],
    ["a dash, then a class", "-.A", true],
    ["a dash may end a class tail", ".A-", true],
    ["a dash, then an id", "-#a", true],
    ["dashes, a class, ids", "--.Ab#c#d", true],
    ["a class, then an id", ".A#a", true],
    ["an id whose tail looks like a class", "#a.A", true],
    ["an id then a dash", "#a-", true],
    ["a mix of all three", "--.Ab#c.d-#e-", true],
    ["an id may start with a digit", "#1", true],
    ["an id of one underscore", "#_", true],
    ["an id of one colon", "#:", true],
    ["an id of one dot", "#.", true],
    ["an id of one dash", "#-", true],
    ["the empty token", "", false],
    ["a dot alone", ".", false],
    ["a hash alone", "#", false],
    ["a character no atom holds", "!", false],
    ["a dash then a character no atom holds", "-!", false],
    ["an id then a character no atom holds", "#a!", false],
    ["many ids then a character no atom holds", "#a#a#a#a!", false],
    ["a class then a character no atom holds", ".A!", false],
    ["a class must start with a letter, not a digit", ".1", false],
    ["a class must start with a letter, not a dash", ".-", false],
    ["a class must start with a letter, not a colon", ".:", false],
    ["a class must start with a letter, not an underscore", "._", false],
    ["a class then a hash with nothing after it", ".A#", false],
    ["an id then a hash with nothing after it", "#a#", false],
    ["many ids then a hash with nothing after it", "#a#a#a#", false],
    ["two hashes in a row", "##", false],
    ["two hashes in a row between ids", "#a##b", false],
    ["two hashes in a row at the end", "#a##", false],
    ["a bare word is no atom", "A", false],
    ["a letter before a class", "a.A", false],
    ["a letter before an id", "a#b", false],
    ["a dash then a letter", "-A", false],
    ["an id's tail holds dots and letters, so what follows an id looks like a class and is not one", "#a.A.B", true],
    ["a dash then a dot alone", "-.", false],
    ["a dash then a dot and a digit", "-.1", false],
    ["an equals sign is in no atom", "#a=b", false],
    ["a backslash is in no atom", "#a\\:x", false],
    ["a bang ends the id (Session 218's `{#sec-x24!}`)", "#sec-x24!", false],
    ["a brace is in no atom (Session 218's `{#sec-x09{b}`)", "#sec-x09{b", false],
    ["a blank is in no atom", "#a b", false],
    ["a line feed is in no atom, and `$` does not stop before one", "#a\n", false],
    ["a line feed first is in no atom", "\n#a", false],
    ["Unicode letters make an id (Session 218's `{#sec-café}`)", `#sec-caf${E_ACUTE}`, true],
    ["Unicode letters make a class", `.${E_ACUTE}`, true],
    ["a letter of two code units makes a class", `.${ASTRAL_LETTER}`, true],
    ["a letter of two code units makes an id", `#${ASTRAL_LETTER}`, true],
    ["a letter of two code units is a class tail character", `.A${ASTRAL_LETTER}`, true],
    ["its two halves side by side are that letter", `#${HIGH_HALF}${LOW_HALF}`, true],
    ["a lone high half is nothing", `#${HIGH_HALF}`, false],
    ["a lone low half is nothing", `#${LOW_HALF}`, false],
    ["the halves the wrong way round are two lone halves", `#${LOW_HALF}${HIGH_HALF}`, false],
    ["a high half then an ASCII letter is a lone half", `#${HIGH_HALF}a`, false],
    ["a lone half after an id is nothing", `#a${HIGH_HALF}`, false],
    ["a lone half cannot start a class", `.${HIGH_HALF}`, false],
    ["a number that is no digit is a class tail", `.A${SUPERSCRIPT_TWO}`, true],
    ["a number that is no digit makes an id", `#${SUPERSCRIPT_TWO}`, true],
    ["a number that is no digit cannot start a class", `.${SUPERSCRIPT_TWO}`, false],
    ["a digit that is not ASCII makes an id", `#${ARABIC_THREE}`, true],
    ["a digit that is not ASCII cannot start a class", `.${ARABIC_THREE}`, false],
    ["an emoji is in no atom", `#${EMOJI}`, false],
    ["an emoji ends a class tail's reach", `.A${EMOJI}`, false],
    ["U+2028 is in no atom", "#a ", false],
    ["a byte order mark is in no atom", "#a﻿", false],
  ])("%s: %j", (_what, token, accepted) => {
    expect(OLD_ATTR_ATOM_RUN.test(token)).toBe(accepted);
    expect(acceptsByDefinition(token)).toBe(accepted);
    expect(attributeAtomRun(token)).toBe(accepted);
  });

  // Every string up to a length over an alphabet, the accepted and the refused alike.
  it.each([
    ["up to eight characters over a hash, a letter, a digit, a dash, a dot and a bang", 8, ALPHABET_D1, ACCEPTED.d1],
    ["up to six characters over a dash, a hash, a dot, a non-ASCII letter, the two halves of an astral letter and two numbers", 6, ALPHABET_D2, ACCEPTED.d2],
    ["up to seven characters over a dash, a hash, a dot, a letter and the two halves of an astral letter", 7, ALPHABET_D3, ACCEPTED.d3],
  ] as const)("agrees with the pattern and with the grammar by definition on every string of %s", (_name, maxLength, alphabet, accepted) => {
    const result = compareAll(everyString(alphabet, maxLength), attributeAtomRun);
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect(result.accepted).toBe(accepted);
  });

  it("agrees with the pattern and with the grammar by definition on 100,000 seeded tokens of up to twelve pieces", () => {
    const random = seededRandom(SEED);
    const pieces = ["#a", "#a", "#a", "#b1", "#", `#${E_ACUTE}`, "-", "-", ".A", ".", "!", "a", "_", ":", ".1", HIGH_HALF, LOW_HALF, ASTRAL_LETTER, `#${ASTRAL_LETTER}`, `.${ASTRAL_LETTER}`];
    const tokens: string[] = [];
    for (let i = 0; i < SEEDED_STRINGS; i++) {
      const count = Math.floor(random() * 13);
      let token = "";
      for (let j = 0; j < count; j++) token += pieces[Math.floor(random() * pieces.length)];
      tokens.push(token);
    }
    const result = compareAll(tokens, attributeAtomRun);
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect(result.accepted).toBe(ACCEPTED.seeded);
  });

  // The alphabets above hold the characters the grammar is most likely to take by mistake; this holds EVERY UTF-16 code unit (a lone surrogate included) in every place a character can stand in a token, by putting
  // one at each place of a head and in place of each of its characters. The first head has every structural position of the grammar in it: before and after the dashes, at the dot, as the class's letter, in and at the end of
  // the class tail, at each of the two hashes, as the first, a middle and the last character of an id, and right after each separator. The others put a code unit around a dash and a hash, around two ids, and around a bare
  // class. The accepted count is NOT pinned exactly: which code units are letters and numbers is the Unicode version of the Node running the test (17.0 on Node 22.23, 13.0 in Python 3.9), so the row says only that a
  // good part of the strings are accepted and a good part refused.
  it("agrees with the pattern on every UTF-16 code unit at every place of five heads", () => {
    const heads = ["--.Ab.c-#de_#f1", "-#a#b", "#a", ".Ab", "-"];
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(heads)) {
      compared++;
      const expected = OLD_ATTR_ATOM_RUN.test(text);
      if (expected) accepted++;
      if (attributeAtomRun(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(heads));
    expect(compared).toBe((31 + 11 + 5 + 7 + 3) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 10);
    expect(accepted).toBeLessThan(compared / 2);
  });

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a function that accepts only dashes disagrees with the pattern, and the loop counts what it was asked.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    const result = compareAll(everyString(ALPHABET_D1, 3), (text) => /^-+$/.test(text));
    expect(result.compared).toBe(countStrings(ALPHABET_D1.length, 3));
    expect(result.disagreements.length).toBeGreaterThan(0);
    expect(result.definitionDisagreements).toEqual([]); // the reading by definition does not depend on the function
  });

  // The pattern THROWS RangeError from 3,355,430 ids of `#a` (about 8,390,000 ids of a one-character group; this id is two characters), so the long rows below have no old answer to compare with: the answer is the grammar's.
  // A run of ids is one or more atoms, so it is accepted; one character that is no atom at its end, or a hash with nothing after it, or two hashes anywhere, refuses it. 1,000,000 is under the pattern's limit and both are asked.
  it("accepts a run of 1,000,000 ids as the pattern does, and refuses it with a bang, a lone hash or two hashes at its end", () => {
    const ids = "#a".repeat(1_000_000);
    for (const [token, accepted] of [[ids, true], [`${ids}!`, false], [`${ids}#`, false], [`${ids}##a`, false], [`${ids}#a-`, true], [`.A${ids}`, true], [`--.Ab${ids}`, true], [`!${ids}`, false]] as const) {
      expect(OLD_ATTR_ATOM_RUN.test(token)).toBe(accepted);
      expect(attributeAtomRun(token)).toBe(accepted);
    }
  });

  it("accepts 7,000,000 ids (twice the pattern's limit) in under two seconds, and refuses the same run with a bang, a lone hash or two hashes", () => {
    const ids = "#a".repeat(HUGE_IDS);
    const started = performance.now();
    const answers = [ids, `${ids}!`, `${ids}#`, `${ids}##a`, `${ids}#a-`, `--.Ab${ids}`].map((token) => attributeAtomRun(token));
    const took = performance.now() - started;
    expect(answers).toEqual([true, false, false, false, true, true]);
    expect(took).toBeLessThan(HUGE_LIMIT_MS);
  });

  // The pattern was LINEAR on the shapes below (Session 324 cured the exponential and quadratic ones), and a loop must stay so: a restart from every id, a rescan of the token for each hash, or a quadratic
  // look back would take seconds at a million characters. 20,000 is in the sizes so that a function which keeps the quadratic way for short tokens cannot hide below the larger ones. The limit is wide on purpose.
  it.each([
    ["ids then a bang", (n: number) => `${"#a".repeat(n / 2)}!`, false],
    ["ids then a lone hash", (n: number) => `${"#a".repeat(n / 2)}#`, false],
    ["ids then two hashes", (n: number) => `${"#a".repeat(n / 2)}##a`, false],
    ["ids, each ending in a dash, then a bang", (n: number) => `${"#a-".repeat(n / 3)}!`, false],
    ["ids, each holding a dot and a letter, then a bang", (n: number) => `${"#a.A".repeat(n / 4)}!`, false],
    ["an id of letters then a bang", (n: number) => `#${"a".repeat(n)}!`, false],
    ["dashes then a bang", (n: number) => `${"-".repeat(n)}!`, false],
    ["a bang first", (n: number) => `!${"#a".repeat(n / 2)}`, false],
    ["ids (accepted)", (n: number) => "#a".repeat(n / 2), true],
    ["an id of letters (accepted)", (n: number) => `#${"a".repeat(n)}`, true],
    ["a class, dashes (accepted)", (n: number) => `.A${"-".repeat(n)}`, true],
    ["dashes, a class, ids (accepted)", (n: number) => `--.Ab${"#a".repeat(n / 2)}`, true],
  ])("%s: is read in linear time at every near-miss size", (_what, build, accepted) => {
    for (const n of NEAR_MISS_SIZES) {
      const token = build(n);
      expect(token.length).toBeGreaterThan(n - 4); // a shape built from a three-character unit is a character or two short of n
      const started = performance.now();
      const answer = attributeAtomRun(token);
      const took = performance.now() - started;
      expect(answer).toBe(accepted);
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  });

  // A size of 40 characters, or a limit of 100 s on the rows above, would pass on the pattern too, and one letter put in an alphabet in place of another moves neither its string count nor its accepted count, so the code points are pinned below.
  it("keeps the limits, the sizes, the seed and the alphabets the rows above are built on", () => {
    expect([NEAR_MISS_LIMIT_MS, NEAR_MISS_SIZES, HUGE_IDS, HUGE_LIMIT_MS, SEEDED_STRINGS, SEED]).toEqual([100, [20_000, 50_000, 1_000_000], 7_000_000, 2000, 100_000, 337]);
    expect(HUGE_IDS).toBeGreaterThanOrEqual(2 * 3_355_430); // twice the first throw of the pattern's id group at HEAD 8ebce73
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.codePointAt(0) as number);
    expect(codes(ALPHABET_D1)).toEqual([0x23, 0x61, 0x31, 0x2d, 0x2e, 0x21]);
    expect(codes(ALPHABET_D2)).toEqual([0x2d, 0x23, 0x2e, 0xe9, 0xd835, 0xdc00, 0xb2, 0x663]);
    expect(codes(ALPHABET_D3)).toEqual([0x2d, 0x23, 0x2e, 0x61, 0xd835, 0xdc00]);
    expect(`${HIGH_HALF}${LOW_HALF}`).toBe(ASTRAL_LETTER); // the two halves ARE the astral letter
    expect(ACCEPTED).toEqual({ d1: 86_023, d2: 10_206, d3: 6_769, seeded: 19_719 });
  });
});
