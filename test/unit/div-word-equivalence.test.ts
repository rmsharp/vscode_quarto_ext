import { describe, expect, it } from "vitest";
import { divBareWord } from "../../src/core/qmd/model";
import { countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// Session 338, part B of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" (group g02, site 3). `legacyDivCalloutTitleSlot` and `legacyDivPanelTabset` each asked whether the
// attribute text of a fenced div's opener is ONE BARE WORD with the whole-string pattern below, and V8 keeps one entry of its regex backtrack stack per character of a class-plus, twice as large once the line holds a
// character above U+00FF: a word of 4,194,288 letters above U+00FF threw `RangeError: Maximum call stack size exceeded`, which reached every reader of the document. `divBareWord` reads the same word with a loop. It is
// only sound if it accepts exactly what the pattern accepted on EVERY string, so the pattern is kept here, verbatim as it stood at HEAD `fe6aaec` (model.ts 4997 and 5071, the same text twice), as the oracle (Learning 738),
// beside a reading of the GRAMMAR by definition that uses no regular expression at all (every code point of a non-empty string is a letter, a number, an underscore or a dash), so that the agreement is not two
// spellings of one mistake.

const OLD_BARE_WORD = /^[\p{L}\p{N}_-]+$/u;

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter of two UTF-16 code units
const HIGH_HALF = "\ud835"; // the first half of that letter, alone
const LOW_HALF = "\udc00"; // and the second half: HIGH_HALF followed by LOW_HALF IS the astral letter
const EMOJI = String.fromCodePoint(0x1f600); // neither a letter nor a number, two code units
const E_ACUTE = String.fromCharCode(0xe9); // a letter below U+0100 that is no ASCII letter
const CJK = String.fromCharCode(0x4e2d); // a letter above U+00FF: a line that holds one is stored with two bytes a character
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const NBSP = String.fromCharCode(0xa0);
const LS = String.fromCharCode(0x2028);

/** The grammar by definition, with NO regular expression: a non-empty string every code point of which is a letter, a number, `_` or `-`. The kinds of the few non-ASCII characters of the alphabets below are stated, not looked up. */
function acceptsByDefinition(word: string): boolean {
  const points = Array.from(word, (c) => c.codePointAt(0) as number); // iteration by code point: a high half followed by a low half is ONE point, as a `u` pattern reads it
  if (points.length === 0) return false;
  const isLetter = (p: number): boolean => (p >= 65 && p <= 90) || (p >= 97 && p <= 122) || p === 0xe9 || p === 0x4e2d || p === 0x1d400;
  const isNumber = (p: number): boolean => (p >= 48 && p <= 57) || p === 0xb2 || p === 0x663;
  return points.every((p) => isLetter(p) || isNumber(p) || p === 95 || p === 45);
}

const NEAR_MISS_LIMIT_MS = 3000;
const NEAR_MISS_SIZES = [20_000, 50_000, 1_000_000];
const HUGE_LETTERS = 8_400_000; // twice 4,194,288, the first throw of the pattern on a line that holds a character above U+00FF (4,194,287 reads, Node 22.23, Session 338)
const HUGE_LIMIT_MS = 5000;
const SEEDED_STRINGS = 100_000;
const SEED = 338;

// The three alphabets of the exhaustive rows, named so that one row can pin what is in them. D1: the member characters (`a`, a digit, `_`, `-`) and the three characters a neighbouring class holds or a word may not
// (`:` and `.`, which the attribute identifier class has and this one has not, and a blank), to seven characters. D2: the Unicode kinds, with the two HALVES of an astral letter as members of their own, so that the
// enumeration builds the pair (a letter), a lone half (nothing) and a half beside a BMP character, and a non-ASCII letter above and below U+0100, two numbers, to six characters. D3: the characters a `$` or a `\s` could
// take for the end of a word (a line feed, U+00A0, U+2028), one letter and the two halves, to seven characters.
const ALPHABET_D1 = ["a", "9", "_", "-", ":", ".", " "];
const ALPHABET_D2 = ["-", "_", ".", E_ACUTE, CJK, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE];
const ALPHABET_D3 = ["a", "\n", NBSP, HIGH_HALF, LOW_HALF, LS];
const ASCII_HEADS = ["ab-c_9", "a", "-", ASTRAL_LETTER];

/** How many strings of each enumeration the grammar accepts. Counted by `tools/div-word-count/count_div_word.py` (a loop over the code points of a list of UTF-16 code units decoded by hand, Python 3's `unicodedata`
 * for the letter and number kinds, no `re`, no TypeScript), so a comparison cannot pass by both sides accepting nothing and the numbers do not come from the code under test. The seeded one is counted the same way from
 * a port of the generator, and the ASCII sweep from a port of `everyAsciiEdit`. `python3 -I tools/div-word-count/count_div_word.py` prints all five (about 4 seconds); change its alphabets with these. */
const ACCEPTED = { d1: 21_844, d2: 63_687, d3: 53, seeded: 15_556, asciiSweep: 1_344 };
const ASCII_SWEEP_STRINGS = 3072;

/** Each ASCII code unit put at every place of each head, and in place of each of its code units: the sweep whose accepted count is the same in every Unicode version, so it is pinned exactly. */
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

/** Both sides on every string: how many were compared, how many the pattern accepts, and the first few strings on which the function or the reading by definition disagrees with it. */
function compareAll(strings: Iterable<string>, accepts: (text: string) => boolean): { compared: number; accepted: number; disagreements: string[]; definitionDisagreements: string[] } {
  let compared = 0;
  let accepted = 0;
  const disagreements: string[] = [];
  const definitionDisagreements: string[] = [];
  for (const text of strings) {
    const expected = OLD_BARE_WORD.test(text);
    compared++;
    if (expected) accepted++;
    if (accepts(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    if (acceptsByDefinition(text) !== expected && definitionDisagreements.length < 5) definitionDisagreements.push(JSON.stringify(text));
  }
  return { compared, accepted, disagreements, definitionDisagreements };
}

describe("Session 338 — divBareWord accepts what the bare-word pattern of the legacy div readers accepted", () => {
  it.each([
    ["a letter", "a", true],
    ["letters", "abc", true],
    ["an upper case letter", "Abc", true],
    ["a digit", "9", true],
    ["letters and digits", "a1b2", true],
    ["a digit first", "1a", true],
    ["an underscore", "_", true],
    ["a dash", "-", true],
    ["dashes", "--", true],
    ["a dash and an underscore between letters", "a-b_c", true],
    ["callout-note", "callout-note", true],
    ["panel-tabset", "panel-tabset", true],
    ["the empty word", "", false],
    ["a colon is no member (the attribute identifier class has one)", ":", false],
    ["a dot is no member (the attribute identifier class has one)", ".", false],
    ["a colon inside a word", "a:b", false],
    ["a dot inside a word", "a.b", false],
    ["a blank inside a word", "a b", false],
    ["a blank first", " a", false],
    ["a blank last", "a ", false],
    ["a hash", "#a", false],
    ["a brace", "{a}", false],
    ["an equals sign", "a=b", false],
    ["a line feed last, and `$` does not stop before one", "a\n", false],
    ["a line feed first", "\na", false],
    ["a carriage return last", "a\r", false],
    ["U+2028 last", `a${LS}`, false],
    ["U+00A0 last", `a${NBSP}`, false],
    ["a byte order mark first", "﻿a", false],
    ["a non-ASCII letter below U+0100", E_ACUTE, true],
    ["a letter above U+00FF", CJK, true],
    ["a letter of two code units", ASTRAL_LETTER, true],
    ["its two halves side by side are that letter", `${HIGH_HALF}${LOW_HALF}`, true],
    ["a lone high half is nothing", HIGH_HALF, false],
    ["a lone low half is nothing", LOW_HALF, false],
    ["the halves the wrong way round are two lone halves", `${LOW_HALF}${HIGH_HALF}`, false],
    ["a high half then an ASCII letter is a lone half", `${HIGH_HALF}a`, false],
    ["a lone half after a letter is nothing", `a${HIGH_HALF}`, false],
    ["a number that is no digit", SUPERSCRIPT_TWO, true],
    ["a digit that is not ASCII", ARABIC_THREE, true],
    ["an emoji is neither a letter nor a number", EMOJI, false],
    ["an emoji ends a word", `a${EMOJI}`, false],
    ["letters of every width side by side", `a${E_ACUTE}${CJK}${ASTRAL_LETTER}`, true],
  ])("%s: %j", (_what, word, accepted) => {
    expect(OLD_BARE_WORD.test(word)).toBe(accepted);
    expect(acceptsByDefinition(word)).toBe(accepted);
    expect(divBareWord(word)).toBe(accepted);
  });

  // Every string up to a length over an alphabet, the accepted and the refused alike.
  it.each([
    ["up to seven characters over a letter, a digit, an underscore, a dash, a colon, a dot and a blank", 7, ALPHABET_D1, ACCEPTED.d1],
    ["up to six characters over a dash, an underscore, a dot, two non-ASCII letters, the two halves of an astral letter and two numbers", 6, ALPHABET_D2, ACCEPTED.d2],
    ["up to seven characters over a letter, a line feed, U+00A0, U+2028 and the two halves of an astral letter", 7, ALPHABET_D3, ACCEPTED.d3],
  ] as const)("agrees with the pattern and with the grammar by definition on every string of %s", (_name, maxLength, alphabet, accepted) => {
    const result = compareAll(everyString(alphabet, maxLength), divBareWord);
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect(result.accepted).toBe(accepted);
  });

  it("agrees with the pattern and with the grammar by definition on 100,000 seeded words of up to twelve pieces", () => {
    const random = seededRandom(SEED);
    const pieces = ["a", "a", "a", "Zz", "9", "09", "_", "-", "-", ":", ".", " ", E_ACUTE, CJK, ASTRAL_LETTER, EMOJI, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE, "\n"];
    const words: string[] = [];
    for (let i = 0; i < SEEDED_STRINGS; i++) {
      const count = Math.floor(random() * 13);
      let word = "";
      for (let j = 0; j < count; j++) word += pieces[Math.floor(random() * pieces.length)];
      words.push(word);
    }
    const result = compareAll(words, divBareWord);
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect(result.accepted).toBe(ACCEPTED.seeded);
  });

  // The alphabets above hold the characters the grammar is most likely to take by mistake; these two sweeps hold EVERY code unit in every place a character can stand in a word, by putting one at each place of a head
  // and in place of each of its characters. The heads: a word of every member kind with the dash and the underscore in the middle, a letter, a dash, and the two-unit astral letter (so that a unit put between its halves
  // splits the pair and a unit put in place of one half makes a lone one). The ASCII sweep is pinned exactly (its count is the same in every Unicode version, and it is recounted by Python); the sweep of every UTF-16
  // code unit is NOT pinned exactly: which code units are letters and numbers is the Unicode version of the Node running the test (17.0 on Node 22.23, 13.0 in Python 3.9), so that row says only that a good part of the
  // strings are accepted and a good part refused.
  it("agrees with the pattern and with the grammar by definition on every ASCII code unit at every place of four heads", () => {
    const result = compareAll(everyAsciiEdit(ASCII_HEADS), divBareWord);
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(ASCII_SWEEP_STRINGS);
    expect(result.accepted).toBe(ACCEPTED.asciiSweep);
  });

  it("agrees with the pattern on every UTF-16 code unit at every place of four heads", () => {
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(ASCII_HEADS)) {
      compared++;
      const expected = OLD_BARE_WORD.test(text);
      if (expected) accepted++;
      if (divBareWord(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(ASCII_HEADS));
    expect(compared).toBe((13 + 3 + 3 + 5) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 10);
    expect(accepted).toBeLessThan(compared * 0.9);
  });

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a function that accepts only letters disagrees with the pattern, and the loop counts what it was asked.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    const result = compareAll(everyString(ALPHABET_D1, 3), (text) => /^[a-z]+$/.test(text));
    expect(result.compared).toBe(countStrings(ALPHABET_D1.length, 3));
    expect(result.disagreements.length).toBeGreaterThan(0);
    expect(result.definitionDisagreements).toEqual([]); // the reading by definition does not depend on the function
  });

  // The pattern THROWS RangeError from 4,194,288 letters above U+00FF (4,194,287 read, bisected at HEAD fe6aaec) and reads 70,000,000 letters up to U+00FF, so the rows past that figure have no old answer to compare
  // with: the answer is the grammar's. A word is accepted whatever its length, and refused by one character that is no member anywhere in it. 1,000,000 is under the pattern's limit and both are asked.
  it("accepts a word of 1,000,000 letters as the pattern does, in every width, and refuses it with a dot, a blank, a line feed, a lone half or an emoji at its end", () => {
    for (const letters of ["a".repeat(1_000_000), "a".repeat(999_999) + CJK, CJK.repeat(1_000_000), ASTRAL_LETTER.repeat(500_000)]) {
      for (const [word, accepted] of [[letters, true], [`${letters}.`, false], [`${letters}:`, false], [`${letters} `, false], [`${letters}\n`, false], [`${letters}${HIGH_HALF}`, false], [`${letters}${EMOJI}`, false], [`${letters}-_9`, true], [`.${letters}`, false]] as const) {
        expect(OLD_BARE_WORD.test(word)).toBe(accepted);
        expect(divBareWord(word)).toBe(accepted);
      }
    }
  });

  it("accepts 8,400,000 letters (twice the pattern's limit) in every width within the time limit, and refuses the same word with a dot, a blank or a lone half", () => {
    const cases: ReadonlyArray<readonly [string, string, boolean]> = [
      ["letters up to U+00FF", "a".repeat(HUGE_LETTERS), true],
      ["letters and one above U+00FF", "a".repeat(HUGE_LETTERS - 1) + CJK, true],
      ["letters above U+00FF", CJK.repeat(HUGE_LETTERS), true],
      ["a non-ASCII letter below U+0100 and letters", `${E_ACUTE}${"a".repeat(HUGE_LETTERS)}`, true],
      ["letters then a dot", `${"a".repeat(HUGE_LETTERS)}.`, false],
      ["letters above U+00FF then a blank", `${CJK.repeat(HUGE_LETTERS)} `, false],
      ["letters above U+00FF then a lone half", `${CJK.repeat(HUGE_LETTERS)}${HIGH_HALF}`, false],
    ];
    for (const [what, word, accepted] of cases) {
      const started = performance.now();
      const answer = divBareWord(word);
      const took = performance.now() - started;
      expect(answer, what).toBe(accepted);
      expect(took, what).toBeLessThan(HUGE_LIMIT_MS);
    }
  });

  // The pattern was LINEAR on the shapes below, and a loop must stay so: a restart from every character, or a rescan of the word for each, would take seconds at a million characters. 20,000 is in the sizes so that
  // a function which keeps the quadratic way for short words cannot hide below the larger ones. The limit is wide on purpose.
  it.each([
    ["letters then a dot", (n: number) => `${"a".repeat(n)}.`, false],
    ["letters then a colon", (n: number) => `${"a".repeat(n)}:`, false],
    ["letters then a blank", (n: number) => `${"a".repeat(n)} `, false],
    ["letters then a line feed", (n: number) => `${"a".repeat(n)}\n`, false],
    ["letters then a lone high half", (n: number) => `${"a".repeat(n)}${HIGH_HALF}`, false],
    ["letters above U+00FF then an emoji", (n: number) => `${CJK.repeat(n)}${EMOJI}`, false],
    ["a blank first", (n: number) => ` ${"a".repeat(n)}`, false],
    ["a dot first, then letters above U+00FF", (n: number) => `.${CJK.repeat(n)}`, false],
    ["letters (accepted)", (n: number) => "a".repeat(n), true],
    ["letters and one above U+00FF (accepted)", (n: number) => "a".repeat(n - 1) + CJK, true],
    ["letters above U+00FF (accepted)", (n: number) => CJK.repeat(n), true],
    ["letters of two code units (accepted)", (n: number) => ASTRAL_LETTER.repeat(n / 2), true],
    ["dashes and underscores (accepted)", (n: number) => "-_".repeat(n / 2), true],
  ])("%s: is read in linear time at every near-miss size", (_what, build, accepted) => {
    for (const n of NEAR_MISS_SIZES) {
      const word = build(n);
      expect(word.length).toBeGreaterThan(n - 4);
      const started = performance.now();
      const answer = divBareWord(word);
      const took = performance.now() - started;
      expect(answer).toBe(accepted);
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  });

  // A size of 40 characters, or a limit of 100 s on the rows above, would pass on the pattern too, and one letter put in an alphabet in place of another moves neither its string count nor its accepted count, so the code points are pinned below.
  it("keeps the limits, the sizes, the seed and the alphabets the rows above are built on", () => {
    expect([NEAR_MISS_LIMIT_MS, NEAR_MISS_SIZES, HUGE_LETTERS, HUGE_LIMIT_MS, SEEDED_STRINGS, SEED]).toEqual([3000, [20_000, 50_000, 1_000_000], 8_400_000, 5000, 100_000, 338]);
    expect(HUGE_LETTERS).toBeGreaterThanOrEqual(2 * 4_194_288); // twice the first throw of the pattern at HEAD fe6aaec, to the nearest hundred thousand
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.codePointAt(0) as number);
    expect(codes(ALPHABET_D1)).toEqual([0x61, 0x39, 0x5f, 0x2d, 0x3a, 0x2e, 0x20]);
    expect(codes(ALPHABET_D2)).toEqual([0x2d, 0x5f, 0x2e, 0xe9, 0x4e2d, 0xd835, 0xdc00, 0xb2, 0x663]);
    expect(codes(ALPHABET_D3)).toEqual([0x61, 0x0a, 0xa0, 0xd835, 0xdc00, 0x2028]);
    expect(ASCII_HEADS.map((h) => h.length)).toEqual([6, 1, 1, 2]);
    expect(`${HIGH_HALF}${LOW_HALF}`).toBe(ASTRAL_LETTER); // the two halves ARE the astral letter
    expect(ACCEPTED).toEqual({ d1: 21_844, d2: 63_687, d3: 53, seeded: 15_556, asciiSweep: 1_344 });
  });
});
