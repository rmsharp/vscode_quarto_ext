import { describe, expect, it } from "vitest";
import { ATTR_ATOM_RUN } from "../../src/core/qmd/model";
import { compare, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 324 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (1). `ATTR_ATOM_RUN` judges one token of a heading, fence, image, span or div attribute block
// as a run of `-`, `#id` and `.class` atoms. It was an alternation of the three atoms under a `+`, and an id's tail and a class's tail both hold `.` and `-`, so `.A.A.A` was one class or three and a token
// whose LAST character is wrong was tried under every split before it was refused (exponential in the classes: 30 of them, a 68-byte line, took 7.4 s warm; quadratic in a run of dashes after an id or a class: 100,000 took
// 12 s; `pathological-inputs.test.ts` has the document rows). The cure is the same language spelled as its plain shape: dashes, at most ONE class, then ids. It is only sound if the new pattern accepts exactly what the
// old one accepted on EVERY string, so the old spelling is kept here, verbatim, as the oracle (Learning 738).
const OLD_ATTR_ATOM_RUN = /^(?:-|#[\p{L}\p{N}_:.-]+|\.\p{L}[\p{L}\p{N}_:.-]*)+$/u;

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter that takes two UTF-16 code units
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const EMOJI = String.fromCodePoint(0x1f600); // neither a letter nor a number, two code units
const E_ACUTE = String.fromCharCode(0xe9); // a lowercase letter that is no ASCII letter

const SEEDED_STRINGS = 100_000;
const NEAR_MISS_LIMIT_MS = 100;
const NEAR_MISS_SIZES = [20_000, 50_000, 1_000_000];

// The three alphabets of the exhaustive rows, named so that one row can pin what is in them (a character put in place of another never moves the string count, and moves the accepted count unless the two play the same part in the grammar, as one letter for another does).
// A: the structural characters and one of each kind of identifier character (a digit, `_`, `:`) and one character no atom holds (`!`). B: the three that make a run ambiguous (a dot, a letter, a dash), the hash that ends an id and the bang that refuses a token, to nine characters.
// C: the Unicode kinds (a lowercase letter, a letter and a non-letter of two code units, a number that is no digit, a digit that is not ASCII).
const ALPHABET_A = ["-", "#", ".", "A", "1", "_", ":", "!"];
const ALPHABET_B = [".", "A", "-", "#", "!"];
const ALPHABET_C = ["-", "#", ".", E_ACUTE, ASTRAL_LETTER, SUPERSCRIPT_TWO, ARABIC_THREE, EMOJI];

/** How many strings of each enumeration the OLD spelling accepts. Counted by a recogniser that uses no regular expression (a memoised parse of the three atoms over every start position, Python 3's `unicodedata` for the
 * letter and number kinds), so a comparison cannot pass by both patterns accepting nothing, and the numbers do not come from the code under test. The seeded one is counted the same way from a port of the generator. */
const ACCEPTED = { a: 18_983, b: 68_741, c: 21_694, seeded: 25_927 };

describe("Session 324 — ATTR_ATOM_RUN accepts what the alternation of atoms accepted", () => {
  it.each([
    ["a dash is an atom", "-", true],
    ["dashes concatenate", "--", true],
    ["an id", "#a", true],
    ["ids concatenate", "#a#b", true],
    ["a class", ".A", true],
    ["a dot is an identifier character: one class", ".A.B", true],
    ["a class tail holds letters, digits, underscore, colon, dot and dash", ".a1_b:c.d-e", true],
    ["a dash, then a class", "-.A", true],
    ["a dash may end a class tail", ".A-", true],
    ["a dash, then an id", "-#a", true],
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
    ["a class then a character no atom holds", ".A!", false],
    ["a class must start with a letter, not a digit", ".1", false],
    ["a class must start with a letter, not a dash", ".-", false],
    ["a class must start with a letter, not a colon", ".:", false],
    ["a class must start with a letter, not an underscore", "._", false],
    ["a class then a hash with nothing after it", ".A#", false],
    ["an id then a hash with nothing after it", "#a#", false],
    ["two hashes in a row", "##", false],
    ["two hashes in a row between ids", "#a##b", false],
    ["a bare word is no atom", "A", false],
    ["a letter before a class", "a.A", false],
    ["a dash then a letter", "-A", false],
    ["a dash then a dot alone", "-.", false],
    ["a dash then a dot and a digit", "-.1", false],
    ["an equals sign is in no atom", "#a=b", false],
    ["a backslash is in no atom", "#a\\:x", false],
    ["a bang ends the id (Session 218's `{#sec-x24!}`)", "#sec-x24!", false],
    ["a brace is in no atom (Session 218's `{#sec-x09{b}`)", "#sec-x09{b", false],
    ["a blank is in no atom", "#a b", false],
    ["a line feed is in no atom, and `$` does not stop before one", "#a\n", false],
    ["Unicode letters make an id (Session 218's `{#sec-café}`)", `#sec-caf${E_ACUTE}`, true],
    ["Unicode letters make a class", `.${E_ACUTE}`, true],
    ["a letter of two code units makes a class", `.${ASTRAL_LETTER}`, true],
    ["a number that is no digit is a class tail", `.A${SUPERSCRIPT_TWO}`, true],
    ["a number that is no digit makes an id", `#${SUPERSCRIPT_TWO}`, true],
    ["a number that is no digit cannot start a class", `.${SUPERSCRIPT_TWO}`, false],
    ["a digit that is not ASCII makes an id", `#${ARABIC_THREE}`, true],
    ["a digit that is not ASCII cannot start a class", `.${ARABIC_THREE}`, false],
    ["an emoji is in no atom", `#${EMOJI}`, false],
    ["an emoji ends a class tail's reach", `.A${EMOJI}`, false],
    ["U+2028 is in no atom", "#a ", false],
  ])("%s: %j", (_what, token, accepted) => {
    expect(OLD_ATTR_ATOM_RUN.test(token)).toBe(accepted);
    expect(ATTR_ATOM_RUN.test(token)).toBe(accepted);
  });

  // Every string up to a length over an alphabet, the accepted and the refused alike: the refused ones are the ones the alternation tried under every split.
  it.each([
    ["up to six characters over the structural characters, a digit, an underscore, a colon and a bang", 6, ALPHABET_A, ACCEPTED.a],
    ["up to nine characters over a dot, a letter, a dash, a hash and a bang", 9, ALPHABET_B, ACCEPTED.b],
    ["up to six characters over a dash, a hash, a dot, two letters, two numbers and an emoji", 6, ALPHABET_C, ACCEPTED.c],
  ] as const)("agrees with the alternation on every string of %s", (_name, maxLength, alphabet, accepted) => {
    const result = compare(OLD_ATTR_ATOM_RUN, ATTR_ATOM_RUN, everyString(alphabet, maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect(result.accepted).toBe(accepted);
  });

  it("agrees with the alternation on 100,000 seeded tokens of up to twelve pieces", () => {
    const random = seededRandom(324);
    const pieces = ["-", "-", "#a", "#1", ".A", ".A", `.${E_ACUTE}`, ".", "#", "!", "A", "_", ":", ASTRAL_LETTER, ".1", "x"];
    const tokens: string[] = [];
    for (let i = 0; i < SEEDED_STRINGS; i++) {
      const count = Math.floor(random() * 13);
      let token = "";
      for (let j = 0; j < count; j++) token += pieces[Math.floor(random() * pieces.length)];
      tokens.push(token);
    }
    const result = compare(OLD_ATTR_ATOM_RUN, ATTR_ATOM_RUN, tokens);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect(result.accepted).toBe(ACCEPTED.seeded);
  });

  // The alphabets above hold the characters the pattern is most likely to take by mistake; this holds every other UTF-16 code unit (a lone surrogate included), in the places a character can stand: alone, as the
  // first character of an id, as the first of a class, after a class's letter, after an id's first character, and after a dash. 6 x 65,536 texts. The accepted count is NOT pinned exactly: which code units are letters and
  // numbers is the Unicode version of the Node running the test (198,143 under Unicode 17, 197,855 by Python's Unicode 13), so the row says only that about half of the texts are accepted.
  it("agrees with the alternation on every UTF-16 code unit alone and in five places", () => {
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (let code = 0; code <= 0xffff; code++) {
      const c = String.fromCharCode(code);
      for (const text of [c, `#${c}`, `.${c}`, `.A${c}`, `#a${c}`, `-${c}`]) {
        compared++;
        const expected = OLD_ATTR_ATOM_RUN.test(text);
        if (expected) accepted++;
        if (ATTR_ATOM_RUN.test(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(6 * 0x10000);
    expect(accepted).toBeGreaterThan(190_000);
  });

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a pattern that accepts only dashes disagrees with the alternation, and the loop counts what it was asked.
  it("reports a disagreement against a wrong pattern, and counts every string it was given", () => {
    const result = compare(OLD_ATTR_ATOM_RUN, /^-+$/u, everyString(ALPHABET_A, 3));
    expect(result.compared).toBe(countStrings(ALPHABET_A.length, 3));
    expect(result.disagreements.length).toBeGreaterThan(0);
  });

  // The old alternation is EXPONENTIAL on the rows that repeat a class, or an id that holds one (classes then a bang, an id then classes, a dash after each class, ids that each hold a class, classes then a hash,
  // an id then classes then a second id and a bang), QUADRATIC on an id or a class then dashes, and linear on dashes alone, ids alone and the accepted rows, so each answer is stated, not taken from it. The limit is wide on purpose (a linear pass takes milliseconds even at a million characters); 20,000 is in the sizes so that a pattern which keeps the old way for short tokens
  // cannot hide below the larger ones.
  it.each([
    ["classes then a bang", (n: number) => `${".A".repeat(n / 2)}!`, false],
    ["an id, classes, then a bang", (n: number) => `#a${".A".repeat(n / 2)}!`, false],
    ["classes, each followed by a dash, then a bang", (n: number) => `${".A-".repeat(n / 3)}!`, false],
    ["an id, dashes, then a bang", (n: number) => `#a${"-".repeat(n)}!`, false],
    ["a class, dashes, then a bang", (n: number) => `.A${"-".repeat(n)}!`, false],
    ["dashes then a bang", (n: number) => `${"-".repeat(n)}!`, false],
    ["ids then a bang", (n: number) => `${"#a".repeat(n / 2)}!`, false],
    ["ids that each hold a class, then a bang", (n: number) => `${"#a.A".repeat(n / 4)}!`, false],
    // An id's tail already holds each of these, so an optional trailing piece on the id loop (`-?`, `\.?`, a digit, `[_:]?`) is the same language and splits every id two ways again: only a row whose ids END in that character sees it.
    ["ids that each end in a dash, then a bang", (n: number) => `${"#a-".repeat(n / 3)}!`, false],
    ["ids that each end in a dot, then a bang", (n: number) => `${"#a.".repeat(n / 3)}!`, false],
    ["ids that each end in a digit, then a bang", (n: number) => `${"#a1".repeat(n / 3)}!`, false],
    ["ids that each end in an underscore, then a bang", (n: number) => `${"#a_".repeat(n / 3)}!`, false],
    ["ids that each end in a colon, then a bang", (n: number) => `${"#a:".repeat(n / 3)}!`, false],
    ["classes then a hash with nothing after it", (n: number) => `${".A".repeat(n / 2)}#`, false],
    ["an id, classes, a second id, then a bang", (n: number) => `#a${".A".repeat(n / 2)}#b!`, false],
    ["classes (accepted)", (n: number) => ".A".repeat(n / 2), true],
    ["classes then an id (accepted)", (n: number) => `${".A".repeat(n / 2)}#a`, true],
    ["an id of letters (accepted)", (n: number) => `#${"a".repeat(n)}`, true],
    ["dashes (accepted)", (n: number) => "-".repeat(n), true],
    ["ids (accepted)", (n: number) => "#a".repeat(n / 2), true],
    ["a class, dashes (accepted)", (n: number) => `.A${"-".repeat(n)}`, true],
  ])("%s: is read in linear time at every near-miss size", (_what, build, accepted) => {
    for (const n of NEAR_MISS_SIZES) {
      const token = build(n);
      expect(token.length).toBeGreaterThan(n - 4); // a shape built from a three-character unit is a character or two short of n
      const started = performance.now();
      const answer = ATTR_ATOM_RUN.test(token);
      const took = performance.now() - started;
      expect(answer).toBe(accepted);
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  });

  // The old alternation kept a stack entry per dash and threw RangeError from about 9,000,000 dashes (it answered 8,000,000: Node 22.23, Session 324). `-*` is a character-class loop and keeps none, so this answers. A spelling that costs a stack entry
  // a dash (a capture or a lookahead in the group: the same language, answered up to 1,000,000 dashes) fails here and nowhere else; a group of the bare dash is not caught, V8 loops it without a stack entry.
  it("accepts a token of 9,000,000 dashes, which the old alternation could not (RangeError)", () => {
    expect(ATTR_ATOM_RUN.test("-".repeat(9_000_000))).toBe(true);
  });

  // A size of 40 characters, or a limit of 100 s on the two dash rows, would pass on the old alternation too, and one letter put in an alphabet in place of another moves neither its string count nor its accepted count, so the code points are pinned below.
  it("keeps the limit, the sizes and the alphabets the rows above are built on", () => {
    expect([NEAR_MISS_LIMIT_MS, NEAR_MISS_SIZES, SEEDED_STRINGS]).toEqual([100, [20_000, 50_000, 1_000_000], 100_000]);
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.codePointAt(0) as number);
    expect(codes(ALPHABET_A)).toEqual([0x2d, 0x23, 0x2e, 0x41, 0x31, 0x5f, 0x3a, 0x21]);
    expect(codes(ALPHABET_B)).toEqual([0x2e, 0x41, 0x2d, 0x23, 0x21]);
    expect(codes(ALPHABET_C)).toEqual([0x2d, 0x23, 0x2e, 0xe9, 0x1d400, 0xb2, 0x663, 0x1f600]);
  });
});
