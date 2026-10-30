import { describe, expect, it } from "vitest";
import { attributeIds, commonmarkAttributeAtom } from "../../src/core/qmd/model";
import { countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// Session 338, part A of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (group g02). Two class patterns under the `u` flag read the ids of an attribute token:
// `ATTR_ID_ALL` found every `#` and the identifier characters after it (`token.matchAll(...)` in `headingAttributeId`), and, under `from: commonmark_x`, `ATTR_ATOM_COMMONMARK` judged the whole token
// (`headingAttributeId` and `headingAttributesValid`). V8 keeps one entry of its regex backtrack stack per character of a class-plus, twice as large once the token holds a character above U+00FF, so an id of
// 4,194,288 letters above U+00FF (4,194,287 read; Node 22.23, HEAD `fe6aaec`, `# T {#` + letters + `}`) threw `RangeError: Maximum call stack size exceeded` and the RangeError answered NOTHING for the whole document.
// `attributeIds` and `commonmarkAttributeAtom` read the same languages by UTF-16 code unit. They are only sound if they answer exactly what the patterns answered on EVERY string, so both patterns are kept below,
// verbatim as they stood at HEAD `fe6aaec`, as the oracle (Learning 738), beside a reading of each language BY DEFINITION that uses no regular expression, so that the agreement is not two spellings of one mistake.

// ---- The OLD patterns, copied from HEAD `fe6aaec` (`src/core/qmd/model.ts`, lines 438 and 859). ----
const OLD_ATTR_ID_ALL = /#([\p{L}\p{N}_:.-]+)/gu;
const OLD_ATTR_ATOM_COMMONMARK = /^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u;
/** What `headingAttributeId` did with the pattern: the first group of every match, left to right. `matchAll` works on a copy, so the shared pattern keeps its `lastIndex`. */
const oldIds = (token: string): string[] => Array.from(token.matchAll(OLD_ATTR_ID_ALL), (m) => m[1]);

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter of two UTF-16 code units
const HIGH_HALF = "\ud835"; // the first half of that letter, alone
const LOW_HALF = "\udc00"; // and the second half: HIGH_HALF followed by LOW_HALF IS the astral letter
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const EMOJI = String.fromCodePoint(0x1f600); // neither a letter nor a number, two code units
const E_ACUTE = String.fromCharCode(0xe9); // a lowercase letter that is no ASCII letter
const CJK = String.fromCharCode(0x4e2d); // a letter above U+00FF, one code unit

// ---- The two languages BY DEFINITION, with no regular expression. A token is read as a list of code points (a high half followed by a low half is ONE point, as a `u` pattern reads it). The kinds of the few
// non-ASCII characters of the alphabets below are stated, not looked up. ----
const isLetter = (p: number): boolean => (p >= 65 && p <= 90) || (p >= 97 && p <= 122) || p === 0xe9 || p === 0x4e2d || p === 0x1d400;
const isNumber = (p: number): boolean => (p >= 48 && p <= 57) || p === 0xb2 || p === 0x663;
/** A letter, a number, `_`, `:`, `.` or `-`: a character of an identifier (Pandoc's). */
const isIdentifier = (p: number): boolean => isLetter(p) || isNumber(p) || p === 95 || p === 58 || p === 46 || p === 45;
/** The same without the dot: a character of a class under `commonmark_x`. */
const isClassCharacter = (p: number): boolean => isIdentifier(p) && p !== 46;
const pointsOf = (token: string): number[] => Array.from(token, (c) => c.codePointAt(0) as number);

/** The ids of a token by definition: every MAXIMAL run of identifier characters whose first character has a `#` right before it (a `#` is no identifier character, so a run never swallows the next one). */
function idsByDefinition(token: string): string[] {
  const points = pointsOf(token);
  const ids: string[] = [];
  let i = 0;
  while (i < points.length) {
    if (!isIdentifier(points[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < points.length && isIdentifier(points[j])) j++;
    if (i > 0 && points[i - 1] === 35) ids.push(String.fromCodePoint(...points.slice(i, j)));
    i = j;
  }
  return ids;
}
/** The commonmark atom by definition: `#` and one or more identifier characters, or `.` and one or more identifier characters that are no dot; and nothing else. */
function atomByDefinition(token: string): boolean {
  const points = pointsOf(token);
  if (points.length < 2) return false;
  if (points[0] === 35) return points.slice(1).every(isIdentifier);
  if (points[0] === 46) return points.slice(1).every(isClassCharacter);
  return false;
}

const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

/** The alphabets of the exhaustive rows, named so that a row can pin what is in them. D1: the structural `#`, a letter, the three punctuation members of an identifier (`_`, `:`, `-`) and the dot, which only an
 * identifier holds, and the one character no atom holds (`!`), to seven characters. D2: the Unicode kinds, with the two HALVES of an astral letter as members of their own (so that the enumeration builds the pair,
 * a lone half and a half beside a BMP character), a non-ASCII letter, two numbers and an emoji, to six characters. D3: the structure of repeated hashes, one letter, a dash and the two halves, to eight characters. */
const ALPHABET_D1 = ["#", "a", "_", ":", ".", "-", "!"];
const ALPHABET_D2 = ["#", ".", "-", E_ACUTE, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE, EMOJI];
const ALPHABET_D3 = ["#", "a", "-", HIGH_HALF, LOW_HALF];
const D1_LENGTH = 7;
const D2_LENGTH = 6;
const D3_LENGTH = 8;

/** What each enumeration holds: how many strings, how many of them hold at least one id, how many ids there are in all, and how many strings the commonmark atom accepts. Counted by
 * `tools/attr-id-count/count_attr_id.py` (a maximal-run reading of the ids and a first-character reading of the atom, over a list of UTF-16 code units decoded by hand, Python 3's `unicodedata` for the letter and
 * number kinds, no `re`, no TypeScript), so a comparison cannot pass by both sides finding nothing and the numbers do not come from the code under test. The seeded one is counted the same way from a port of the
 * generator. `python3 -I tools/attr-id-count/count_attr_id.py` prints all of them (about 13 seconds); change its alphabets with these. */
type Counts = { strings: number; withIds: number; ids: number; atoms: number };
const COUNTS: Record<"d1" | "d2" | "d3" | "seeded" | "sweepAsciiIds" | "sweepAsciiAtoms", Counts> = {
  d1: { strings: 960800, withIds: 481880, ids: 571905, atoms: 24990 },
  d2: { strings: 597871, withIds: 170087, ids: 183093, atoms: 6197 },
  d3: { strings: 488281, withIds: 239549, ids: 286133, atoms: 695 },
  seeded: { strings: 100000, withIds: 77644, ids: 202465, atoms: 6135 },
  sweepAsciiIds: { strings: 2944, withIds: 2376, ids: 3545, atoms: 132 },
  sweepAsciiAtoms: { strings: 4096, withIds: 1493, ids: 1500, atoms: 1577 },
};

type Compared = Counts & { idDisagreements: string[]; idDefinitionDisagreements: string[]; atomDisagreements: string[]; atomDefinitionDisagreements: string[] };
/** Both functions and both readings by definition against both old patterns, on every string: the counts of the OLD patterns' answers, and the first few strings on which anything disagrees. */
function compareAll(strings: Iterable<string>, ids: (token: string) => string[] = attributeIds, atom: (token: string) => boolean = commonmarkAttributeAtom): Compared {
  const result: Compared = { strings: 0, withIds: 0, ids: 0, atoms: 0, idDisagreements: [], idDefinitionDisagreements: [], atomDisagreements: [], atomDefinitionDisagreements: [] };
  for (const text of strings) {
    const expectedIds = oldIds(text);
    const expectedAtom = OLD_ATTR_ATOM_COMMONMARK.test(text);
    result.strings++;
    if (expectedIds.length > 0) result.withIds++;
    result.ids += expectedIds.length;
    if (expectedAtom) result.atoms++;
    if (!sameIds(ids(text), expectedIds) && result.idDisagreements.length < 5) result.idDisagreements.push(JSON.stringify(text));
    if (!sameIds(idsByDefinition(text), expectedIds) && result.idDefinitionDisagreements.length < 5) result.idDefinitionDisagreements.push(JSON.stringify(text));
    if (atom(text) !== expectedAtom && result.atomDisagreements.length < 5) result.atomDisagreements.push(JSON.stringify(text));
    if (atomByDefinition(text) !== expectedAtom && result.atomDefinitionDisagreements.length < 5) result.atomDefinitionDisagreements.push(JSON.stringify(text));
  }
  return result;
}
const noDisagreements = (r: Compared): void => {
  expect(r.idDisagreements).toEqual([]);
  expect(r.idDefinitionDisagreements).toEqual([]);
  expect(r.atomDisagreements).toEqual([]);
  expect(r.atomDefinitionDisagreements).toEqual([]);
};
const countsOf = (r: Compared): Counts => ({ strings: r.strings, withIds: r.withIds, ids: r.ids, atoms: r.atoms });

const SEEDED_STRINGS = 100_000;
const SEED = 338;
const SEEDED_PIECES = ["#a", "#a", "#b1", "#", `#${E_ACUTE}`, "#", "-", ".", ".a", "!", "a", "_", ":", HIGH_HALF, LOW_HALF, ASTRAL_LETTER, `#${ASTRAL_LETTER}`, `.${ASTRAL_LETTER}`, CJK, `#${CJK}`];
/** The heads of the sweep of every UTF-16 code unit: the ids at the `#`, in the middle and at the end of an id, between two ids and before the first; the atom at its first character, in and at the end of a class and of an id. */
const SWEEP_ID_HEADS = ["#ab#cd", "a#b", "#"];
const SWEEP_ATOM_HEADS = [".a-b_c", "#a.b:c", "#", "."];

const NEAR_MISS_LIMIT_MS = 3000; // a restart from every character, or a rescan of the token for every hash, would take minutes at a million characters; never loosened to pass
const LONG_RUN = 5_000_000; // past the pattern's first throw on a token with a character above U+00FF (4,194,288 letters): the pattern has no answer here, the definition's is stated
const MILLION = 1_000_000;

describe("Session 338 — attributeIds reads what ATTR_ID_ALL found", () => {
  it.each([
    ["no hash, no id", "abc", []],
    ["the empty token", "", []],
    ["a hash alone", "#", []],
    ["one id", "#a", ["a"]],
    ["two ids", "#a#b", ["a", "b"]],
    ["an id after a word", "x#a", ["a"]],
    ["a hash with nothing after it, then an id", "##a", ["a"]],
    ["a hash with nothing after it ends the token", "#a#", ["a"]],
    ["three hashes", "###", []],
    ["an id holds letters, digits, underscore, colon, dot and dash", "#a1_b:c.d-e", ["a1_b:c.d-e"]],
    ["an id may start with a dot", "#.a", [".a"]],
    ["an id may be one dash", "#-", ["-"]],
    ["a character no id holds ends it", "#a!b", ["a"]],
    ["...and the next id starts after it", "#a!#b", ["a", "b"]],
    ["a bang right after the hash makes no id", "#!a", []],
    ["a letter that is no ASCII letter", `#caf${E_ACUTE}`, [`caf${E_ACUTE}`]],
    ["a letter above U+00FF", `#a${CJK}`, [`a${CJK}`]],
    ["an astral letter is ONE character of the id", `#${ASTRAL_LETTER}`, [ASTRAL_LETTER]],
    ["its two halves side by side are that letter", `#${HIGH_HALF}${LOW_HALF}`, [`${HIGH_HALF}${LOW_HALF}`]],
    ["a lone high half is nothing", `#${HIGH_HALF}`, []],
    ["a lone low half is nothing", `#${LOW_HALF}`, []],
    ["the halves the wrong way round are two lone halves", `#${LOW_HALF}${HIGH_HALF}`, []],
    ["a high half after the id ends it", `#a${HIGH_HALF}`, ["a"]],
    ["a high half then an ASCII letter: the half ends the id, nothing starts", `#a${HIGH_HALF}b`, ["a"]],
    ["a number that is no ASCII digit", `#${SUPERSCRIPT_TWO}${ARABIC_THREE}`, [`${SUPERSCRIPT_TWO}${ARABIC_THREE}`]],
    ["an emoji is no identifier character", `#${EMOJI}`, []],
    ["an emoji ends an id", `#a${EMOJI}b`, ["a"]],
    ["a hash after an emoji starts an id", `${EMOJI}#b`, ["b"]],
    ["a blank ends an id", "#a b", ["a"]],
    ["a line feed ends an id", "#a\n#b", ["a", "b"]],
    ["U+2028 ends an id", "#a #b", ["a", "b"]],
    ["an equals sign ends an id", "#a=b", ["a"]],
    ["a quote ends an id", '#a"b', ["a"]],
  ] as const)("%s: %j", (_what, token, expected) => {
    expect(oldIds(token)).toEqual(expected);
    expect(idsByDefinition(token)).toEqual(expected);
    expect(attributeIds(token)).toEqual(expected);
  });
});

describe("Session 338 — commonmarkAttributeAtom accepts what ATTR_ATOM_COMMONMARK accepted", () => {
  it.each([
    ["an id", "#a", true],
    ["an id of one digit", "#1", true],
    ["an id of one dash", "#-", true],
    ["an id of one dot", "#.", true],
    ["an id of one colon", "#:", true],
    ["an id of one underscore", "#_", true],
    ["an id holds letters, digits, underscore, colon, dot and dash", "#a1_b:c.d-e", true],
    ["an id holds a dot, so what follows looks like a class and is not one", "#a.b", true],
    ["a class", ".a", true],
    ["a class may start with a digit (the pandoc reader's refuses it)", ".1", true],
    ["a class may start with a dash", ".-", true],
    ["a class may start with a colon", ".:", true],
    ["a class may start with an underscore", "._", true],
    ["a class holds letters, digits, underscore, colon and dash", ".a1_b:c-e", true],
    ["a class holds NO dot", ".a.b", false],
    ["a class of one dot is no class", "..", false],
    ["a class may not start with a dot", ".a.", false],
    ["the empty token", "", false],
    ["a hash alone", "#", false],
    ["a dot alone", ".", false],
    ["a dash is no atom here", "-", false],
    ["a word is no atom", "a", false],
    ["two ids: a hash is no identifier character", "#a#b", false],
    ["an id then a hash", "#a#", false],
    ["a class then an id", ".a#b", false],
    ["a dash before the id", "-#a", false],
    ["a bang ends the atom's reach", "#a!", false],
    ["a bang makes a class no class", ".a!", false],
    ["a blank is in no atom", "#a b", false],
    ["a line feed is in no atom, and `$` does not stop before one", "#a\n", false],
    ["a line feed first is in no atom", "\n#a", false],
    ["an equals sign is in no atom", "#a=b", false],
    ["Unicode letters make an id", `#sec-caf${E_ACUTE}`, true],
    ["Unicode letters make a class", `.${E_ACUTE}`, true],
    ["a letter above U+00FF makes an id", `#${CJK}`, true],
    ["a letter of two code units makes a class", `.${ASTRAL_LETTER}`, true],
    ["a letter of two code units makes an id", `#${ASTRAL_LETTER}`, true],
    ["its two halves side by side are that letter", `.${HIGH_HALF}${LOW_HALF}`, true],
    ["a lone high half is nothing", `#${HIGH_HALF}`, false],
    ["a lone low half is nothing", `.${LOW_HALF}`, false],
    ["a lone half after a letter is nothing", `#a${HIGH_HALF}`, false],
    ["the halves the wrong way round are two lone halves", `#${LOW_HALF}${HIGH_HALF}`, false],
    ["a number that is no digit makes an id", `#${SUPERSCRIPT_TWO}`, true],
    ["a number that is no digit may start a class", `.${SUPERSCRIPT_TWO}`, true],
    ["a digit that is not ASCII may start a class", `.${ARABIC_THREE}`, true],
    ["an emoji is in no atom", `#${EMOJI}`, false],
    ["an emoji ends a class's reach", `.a${EMOJI}`, false],
    ["U+2028 is in no atom", "#a ", false],
  ] as const)("%s: %j", (_what, token, expected) => {
    expect(OLD_ATTR_ATOM_COMMONMARK.test(token)).toBe(expected);
    expect(atomByDefinition(token)).toBe(expected);
    expect(commonmarkAttributeAtom(token)).toBe(expected);
  });
});

describe("Session 338 — both functions against both old patterns and the definitions", () => {
  // Every string up to a length over an alphabet, the answered and the refused alike.
  it.each([
    ["up to seven characters over a hash, a letter, an underscore, a colon, a dot, a dash and a bang", D1_LENGTH, ALPHABET_D1, COUNTS.d1],
    ["up to six characters over a hash, a dot, a dash, a non-ASCII letter, the two halves of an astral letter, two numbers and an emoji", D2_LENGTH, ALPHABET_D2, COUNTS.d2],
    ["up to eight characters over a hash, a letter, a dash and the two halves of an astral letter", D3_LENGTH, ALPHABET_D3, COUNTS.d3],
  ] as const)("agrees on every string of %s", (_name, maxLength, alphabet, counts) => {
    const result = compareAll(everyString(alphabet, maxLength));
    noDisagreements(result);
    expect(result.strings).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect(countsOf(result)).toEqual(counts);
  }, 120_000);

  it("agrees on 100,000 seeded tokens of up to twelve pieces", () => {
    const random = seededRandom(SEED);
    const tokens: string[] = [];
    for (let i = 0; i < SEEDED_STRINGS; i++) {
      const count = Math.floor(random() * 13);
      let token = "";
      for (let j = 0; j < count; j++) token += SEEDED_PIECES[Math.floor(random() * SEEDED_PIECES.length)];
      tokens.push(token);
    }
    const result = compareAll(tokens);
    noDisagreements(result);
    expect(countsOf(result)).toEqual(COUNTS.seeded);
  });

  // The alphabets above hold the characters the grammar is most likely to take by mistake; this holds EVERY UTF-16 code unit (a lone surrogate included) in every place a character can stand, by putting one at each
  // place of a head and in place of each of its characters. The ids' heads put one before and after the `#`, in the middle and at the end of an id, between two ids and at the end of the token; the atom's put
  // one at the first character, in and at the end of a class and of an id. The accepted count is NOT pinned over all 65,536 units (which code units are letters and numbers is the Unicode version of the Node running
  // the test: 17.0 on Node 22.23, 13.0 in Python 3.9), so the row says only that a good part of the strings are answered and a good part refused; the ASCII half is pinned below.
  it("agrees with the pattern on every UTF-16 code unit at every place of the heads of an id", () => {
    const disagreements: string[] = [];
    let compared = 0;
    let withIds = 0;
    for (const text of everyCodeUnitEdit(SWEEP_ID_HEADS)) {
      compared++;
      const expected = oldIds(text);
      if (expected.length > 0) withIds++;
      if (!sameIds(attributeIds(text), expected) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(SWEEP_ID_HEADS));
    expect(compared).toBe((13 + 7 + 3) * 0x10000);
    expect(withIds).toBeGreaterThan(compared / 10);
    expect(withIds).toBeLessThan(compared * 0.9);
  }, 120_000);

  it("agrees with the pattern on every UTF-16 code unit at every place of the heads of an atom", () => {
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(SWEEP_ATOM_HEADS)) {
      compared++;
      const expected = OLD_ATTR_ATOM_COMMONMARK.test(text);
      if (expected) accepted++;
      if (commonmarkAttributeAtom(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(SWEEP_ATOM_HEADS));
    expect(compared).toBe((13 + 13 + 3 + 3) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 100); // the accepted share is small: every head but the lone `#` and `.` has one rejected character in it (and the class holds no dot)
    expect(accepted).toBeLessThan(compared * 0.9);
  }, 120_000);

  // The ASCII half of the same sweep, pinned exactly (the 128 ASCII code units are the same in every Unicode version): every one inserted at each index of a head and put in place of each of its characters.
  function* asciiEdits(heads: readonly string[]): Generator<string> {
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
  it.each([
    ["the heads of an id", SWEEP_ID_HEADS, COUNTS.sweepAsciiIds],
    ["the heads of an atom", SWEEP_ATOM_HEADS, COUNTS.sweepAsciiAtoms],
  ] as const)("agrees with the pattern and the definitions on every ASCII code unit at every place of %s, and the counts are the pinned ones", (_name, heads, counts) => {
    const result = compareAll(asciiEdits(heads));
    noDisagreements(result);
    expect(result.strings).toBe(heads.reduce((sum, head) => sum + (2 * head.length + 1) * 128, 0));
    expect(countsOf(result)).toEqual(counts);
  });

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a function that finds no id and an atom check that refuses everything disagree with the patterns, and the loop counts
  // what it was asked.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    const result = compareAll(everyString(ALPHABET_D1, 3), () => [], () => false);
    expect(result.strings).toBe(countStrings(ALPHABET_D1.length, 3));
    expect(result.idDisagreements.length).toBeGreaterThan(0);
    expect(result.atomDisagreements.length).toBeGreaterThan(0);
    expect(result.idDefinitionDisagreements).toEqual([]); // the readings by definition do not depend on the function
    expect(result.atomDefinitionDisagreements).toEqual([]);
  });
});

describe("Session 338 — long tokens, past the pattern's first throw", () => {
  const timed = <T>(run: () => T): { result: T; ms: number } => {
    const started = performance.now();
    const result = run();
    return { result, ms: performance.now() - started };
  };

  // 1,000,000 ids is under every limit of the pattern and both are asked; the other shapes make the loop do the same work a restart or a rescan would repeat.
  it.each([
    ["a million ids of one letter", "#a".repeat(MILLION), MILLION, "a"],
    ["a million hashes: no id", "#".repeat(MILLION), 0, ""],
    ["a million hash-and-bang pairs: no id", "#!".repeat(MILLION / 2), 0, ""],
    ["a million ids each ending in a bang", "#a!".repeat(MILLION / 3), Math.floor(MILLION / 3), "a"],
    ["a million ids of a letter above U+00FF", `#${CJK}`.repeat(MILLION), MILLION, CJK],
    ["a million ids of an astral letter", `#${ASTRAL_LETTER}`.repeat(MILLION), MILLION, ASTRAL_LETTER],
  ] as const)("%s: the same ids as the pattern, inside the limit", (_what, token, count, only) => {
    const expected = oldIds(token);
    expect(expected.length).toBe(count);
    const { result, ms } = timed(() => attributeIds(token));
    expect(result.length).toBe(count);
    expect(result.every((id) => id === only)).toBe(true);
    expect(ms).toBeLessThan(NEAR_MISS_LIMIT_MS);
  });

  it("reads one id of 1,000,001 letters with one letter above U+00FF at its end as the pattern does", () => {
    const run = `${"a".repeat(MILLION)}${CJK}`;
    const token = `#${run}`;
    expect(oldIds(token)).toEqual([run]);
    const { result, ms } = timed(() => attributeIds(token));
    expect(result).toEqual([run]);
    expect(ms).toBeLessThan(NEAR_MISS_LIMIT_MS);
  });

  // The pattern THROWS from 4,194,288 letters above U+00FF, so these rows have no old answer to compare with: the answer is the definition's. One run is one id, whatever its length; a hash in the middle splits it.
  it.each([
    ["5,000,000 letters of U+4E2D", CJK],
    ["5,000,000 astral letters", ASTRAL_LETTER],
    ["5,000,000 letters of which the last is U+4E2D", "a"],
  ] as const)("reads one id of %s as one id", (_what, unit) => {
    const run = unit === "a" ? `${"a".repeat(LONG_RUN - 1)}${CJK}` : unit.repeat(LONG_RUN);
    const token = `#${run}`;
    const { result, ms } = timed(() => attributeIds(token));
    expect(result.length).toBe(1);
    expect(result[0] === run).toBe(true);
    expect(ms).toBeLessThan(NEAR_MISS_LIMIT_MS);
    const split = `#${run}#b#${run}`;
    const { result: three, ms: splitMs } = timed(() => attributeIds(split));
    expect(three.length).toBe(3);
    expect(three[0] === run && three[1] === "b" && three[2] === run).toBe(true);
    expect(splitMs).toBeLessThan(NEAR_MISS_LIMIT_MS);
  });

  // The atom: a run past the pattern's first throw is accepted when every character is a member, refused when one at the END is not (the pattern read the whole run before it said so), and a dot inside a class
  // refuses it at once. 20,000 is in the sizes so that a function which keeps a quadratic way for short tokens cannot hide below the larger ones.
  it.each([
    ["an id of letters", (n: number) => `#${"a".repeat(n)}`, true],
    ["an id of letters above U+00FF", (n: number) => `#${CJK.repeat(n)}`, true],
    ["an id of astral letters", (n: number) => `#${ASTRAL_LETTER.repeat(n)}`, true],
    ["an id whose tail holds dots", (n: number) => `#${"a.".repeat(n / 2)}`, true],
    ["a class of dashes", (n: number) => `.${"-".repeat(n)}`, true],
    ["a class of letters above U+00FF", (n: number) => `.${CJK.repeat(n)}`, true],
    ["an id then a bang", (n: number) => `#${"a".repeat(n)}!`, false],
    ["an id of letters above U+00FF then a bang", (n: number) => `#${CJK.repeat(n)}!`, false],
    ["a class then a dot at its end", (n: number) => `.${"a".repeat(n)}.`, false],
    ["a class of letters above U+00FF then a dot at its end", (n: number) => `.${CJK.repeat(n)}.`, false],
    ["a class with a dot in the middle", (n: number) => `.${"a".repeat(n)}.${"a".repeat(n)}`, false],
    ["ids: a hash at the end", (n: number) => `#${"a".repeat(n)}#`, false],
    ["a bang first", (n: number) => `!${"a".repeat(n)}`, false],
  ])("%s: the atom is answered inside the limit at 20,000, 1,000,000 and 5,000,000 characters", (_what, build, accepted) => {
    for (const n of [20_000, MILLION, LONG_RUN]) {
      const token = build(n);
      if (n < 4_000_000) expect(OLD_ATTR_ATOM_COMMONMARK.test(token)).toBe(accepted); // under the pattern's first throw both are asked
      const { result, ms } = timed(() => commonmarkAttributeAtom(token));
      expect(result).toBe(accepted);
      expect(ms).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  });

  // A size of 40 characters, or a limit of 100 s on the rows above, would pass on the pattern too, and one letter put in an alphabet in place of another moves neither its string count nor its counts, so the code points
  // and the constants are pinned.
  it("keeps the limits, the sizes, the seed, the lengths and the alphabets the rows above are built on", () => {
    expect([NEAR_MISS_LIMIT_MS, LONG_RUN, MILLION, SEEDED_STRINGS, SEED, D1_LENGTH, D2_LENGTH, D3_LENGTH]).toEqual([3000, 5_000_000, 1_000_000, 100_000, 338, 7, 6, 8]);
    expect(LONG_RUN).toBeGreaterThan(4_194_288); // past the first throw of the pattern on a token with a character above U+00FF (4,194,288 letters; 4,194,287 read; Node 22.23, HEAD fe6aaec)
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.codePointAt(0) as number);
    expect(codes(ALPHABET_D1)).toEqual([0x23, 0x61, 0x5f, 0x3a, 0x2e, 0x2d, 0x21]);
    expect(codes(ALPHABET_D2)).toEqual([0x23, 0x2e, 0x2d, 0xe9, 0xd835, 0xdc00, 0xb2, 0x663, 0x1f600]);
    expect(codes(ALPHABET_D3)).toEqual([0x23, 0x61, 0x2d, 0xd835, 0xdc00]);
    expect(SEEDED_PIECES.length).toBe(20);
    expect(SWEEP_ID_HEADS).toEqual(["#ab#cd", "a#b", "#"]);
    expect(SWEEP_ATOM_HEADS).toEqual([".a-b_c", "#a.b:c", "#", "."]);
    expect(`${HIGH_HALF}${LOW_HALF}`).toBe(ASTRAL_LETTER); // the two halves ARE the astral letter
    expect(COUNTS).toEqual(PINNED_COUNTS);
  });
});

/** The counts the Python port printed, written a second time so that a change to `COUNTS` alone is caught. */
const PINNED_COUNTS = {
  d1: { strings: 960800, withIds: 481880, ids: 571905, atoms: 24990 },
  d2: { strings: 597871, withIds: 170087, ids: 183093, atoms: 6197 },
  d3: { strings: 488281, withIds: 239549, ids: 286133, atoms: 695 },
  seeded: { strings: 100000, withIds: 77644, ids: 202465, atoms: 6135 },
  sweepAsciiIds: { strings: 2944, withIds: 2376, ids: 3545, atoms: 132 },
  sweepAsciiAtoms: { strings: 4096, withIds: 1493, ids: 1500, atoms: 1577 },
};
