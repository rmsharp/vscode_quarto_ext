import { describe, expect, it } from "vitest";
import { isRSymbolChain, readChunkLabelToken } from "../../src/core/qmd/model";
import { headerLabelKind } from "../../src/core/refs";
import { countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations and the code-unit sweeps take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 338, part D of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", site (6), places (a) and (c). Two class-pluses under the `u` flag judged the label of a knitr
// chunk header: the first-slot test of `readChunkLabelToken` (`/^[\p{L}\p{N}_:.-]+$/u`) and `HEADER_LABEL_ID` in `refs.ts` (`^(fig|tbl)-` and the same class, `+$`, under `u`). V8 keeps one entry of its regex
// backtrack stack per character of a class-plus under `u`, twice as large once the line holds a character above U+00FF (the line is then a two-byte string): the first throws `RangeError: Maximum call stack size
// exceeded` from 4,194,284 letters after `fig-` and the second from 4,194,288 (bisected at HEAD `fe6aaec`, Session 338, Node 22.23.3, one fresh process per probe, through `indexLabels(text, "knitr")`, the lower
// bound verified OK first). `readChunkLabelToken` (now exported) and `headerLabelKind` read the same languages by index. The old patterns are kept below, copied from the parent `fe6aaec`, as the oracles
// (Learning 738), beside readings of the grammar BY DEFINITION that use no regular expression; the pinned counts come from a Python port of the definitions (`tools/chunk-label-count/count_token.py`, no code shared
// with the TypeScript), never from the code under test.

// ---- The OLD patterns and the OLD `readChunkLabelToken`, copied from the parent `fe6aaec` (`qmd/model.ts` 9100 and `refs.ts` 201; `HEADER_LABEL_ID` was built from `DEFINED_ID_CHAR_CLASS`, `[\p{L}\p{N}_:.-]`). ----
const OLD_FIRST_SLOT = /^[\p{L}\p{N}_:.-]+$/u;
const OLD_HEADER_LABEL_ID = new RegExp(String.raw`^(fig|tbl)-` + String.raw`[\p{L}\p{N}_:.-]` + String.raw`+$`, "u");
type Token = { value: string; offset: number } | null;
function oldReadChunkLabelToken(text: string, firstSlot: boolean): Token {
  const quoted = /^(["'])([^"'\\]*)\1$/.exec(text);
  if (quoted !== null) {
    return { value: quoted[2], offset: 1 };
  }
  const written = firstSlot ? OLD_FIRST_SLOT.test(text) : isRSymbolChain(text);
  return written ? { value: text, offset: 0 } : null;
}
const oldKind = (value: string): string | null => OLD_HEADER_LABEL_ID.exec(value)?.[1] ?? null;

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter of two UTF-16 code units
const HIGH_HALF = "\ud835"; // the first half of that letter, alone
const LOW_HALF = "\udc00"; // and the second half: HIGH_HALF followed by LOW_HALF IS the astral letter
const E_ACUTE = String.fromCharCode(0xe9); // a lowercase letter that is no ASCII letter
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const CJK = String.fromCharCode(0x4e2d); // a letter above U+00FF

// ---- The grammars BY DEFINITION, with NO regular expression. The kinds of the few non-ASCII characters of the alphabets below are stated, not looked up. ----
const isLetter = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 0xe9 || c === 0x1d400 || c === 0x4e2d;
const isNumber = (c: number): boolean => (c >= 48 && c <= 57) || c === 0xb2 || c === 0x663;
const isIdentifier = (c: number): boolean => isLetter(c) || isNumber(c) || c === 95 || c === 58 || c === 46 || c === 45;
const pointsOf = (text: string): number[] => Array.from(text, (c) => c.codePointAt(0) as number); // by code point: a high half followed by a low one is ONE point, a lone half one point that is no letter

/** A text of two or more characters that starts with a quote, ends with the same quote and holds no quote and no backslash between is the string it spells; else one or more identifier characters is the text written. */
function firstSlotByDefinition(text: string): Token {
  const p = pointsOf(text);
  if (p.length >= 2 && (p[0] === 34 || p[0] === 39) && p[p.length - 1] === p[0] && p.slice(1, -1).every((c) => c !== 34 && c !== 39 && c !== 92)) {
    return { value: p.slice(1, -1).map((c) => String.fromCodePoint(c)).join(""), offset: 1 };
  }
  return p.length >= 1 && p.every(isIdentifier) ? { value: text, offset: 0 } : null;
}
/** `fig-` or `tbl-` and then one or more identifier characters, nothing else. */
function kindByDefinition(text: string): string | null {
  const p = pointsOf(text);
  for (const [kind, prefix] of [["fig", [102, 105, 103, 45]], ["tbl", [116, 98, 108, 45]]] as const) {
    if (p.length >= 5 && prefix.every((c, i) => p[i] === c) && p.slice(4).every(isIdentifier)) {
      return kind;
    }
  }
  return null;
}

/** How many strings of each enumeration the grammars accept, split by what they answer. Counted by `tools/chunk-label-count/count_token.py` (a list of UTF-16 code units decoded by hand, Python 3's `unicodedata`
 * for the letter and number kinds, no `re`, no TypeScript), so a comparison cannot pass by both sides accepting nothing and the numbers do not come from the code under test. The seeded ones are counted the same way
 * from a port of the generator. `python3 -I tools/chunk-label-count/count_token.py` prints all seven (about 4 seconds); change its alphabets with these. */
const COUNTS = {
  t1: { quoted: 0, plain: 55_986 },
  t2: { quoted: 242, plain: 1_092 },
  t3: { quoted: 0, plain: 23_408 },
  k1: { fig: 5_491, tbl: 5_491 },
  k2: { fig: 72, tbl: 72 },
  seededFirst: { quoted: 208, plain: 14_539 },
  seededHeader: { fig: 1_454, tbl: 1_504 },
};

// The alphabets of the exhaustive rows. T1: the characters of the class and the structure around it (a letter, a digit, an underscore, a colon, a dot, a dash, a space, a dollar), to six characters. T2: the quotes and the
// backslash beside a letter, a dash and a colon, to six. T3: the Unicode kinds, with the two HALVES of an astral letter as members of their own so that the enumeration builds the pair (a letter), a lone half (nothing)
// and a half beside a BMP character, to six. K1: the pieces of a header label (the two kinds with their dash, the kinds without it, a dash, a letter, a colon, a dollar, a non-ASCII letter and the two halves), to five
// pieces. K2: the letters of both kinds one at a time, to six characters.
const ALPHABET_T1 = ["a", "1", "_", ":", ".", "-", " ", "$"];
const ALPHABET_T2 = ['"', "'", "\\", "a", "-", ":"];
const ALPHABET_T3 = ["a", E_ACUTE, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE, "-", "$"];
const ALPHABET_K1 = ["fig-", "tbl-", "fig", "tbl", "-", "a", ":", "$", E_ACUTE, HIGH_HALF, LOW_HALF];
const ALPHABET_K2 = ["f", "t", "i", "b", "g", "l", "-", "a"];
const SEEDED_STRINGS = 100_000;
const SEED_FIRST = 338;
const SEED_HEADER = 3381;
const SEEDED_FIRST_PIECES = ["a", "fig-x", "1", "_", ":", ".", "-", " ", '"', "'", "\\", "$", E_ACUTE, ASTRAL_LETTER, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE, "a:b", "tbl-"];
const SEEDED_HEADER_PIECES = ["fig-", "tbl-", "fig", "tbl", "-", "a", "x1", ":", ".", "_", "$", " ", E_ACUTE, ASTRAL_LETTER, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO];

/** Both sides on every string, for the first slot: how many were compared, how many of each answer the pattern gives, and the first few strings on which the function or the reading by definition disagrees with it. */
function compareFirstSlot(strings: Iterable<string>): { compared: number; quoted: number; plain: number; disagreements: string[]; definitionDisagreements: string[] } {
  let compared = 0;
  let quoted = 0;
  let plain = 0;
  const disagreements: string[] = [];
  const definitionDisagreements: string[] = [];
  for (const text of strings) {
    const expected = oldReadChunkLabelToken(text, true);
    compared++;
    if (expected !== null) {
      if (expected.offset === 1) quoted++;
      else plain++;
    }
    if (JSON.stringify(readChunkLabelToken(text, true)) !== JSON.stringify(expected) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    if (JSON.stringify(firstSlotByDefinition(text)) !== JSON.stringify(expected) && definitionDisagreements.length < 5) definitionDisagreements.push(JSON.stringify(text));
  }
  return { compared, quoted, plain, disagreements, definitionDisagreements };
}
/** The same for the kind of a header label. */
function compareKind(strings: Iterable<string>): { compared: number; fig: number; tbl: number; disagreements: string[]; definitionDisagreements: string[] } {
  let compared = 0;
  let fig = 0;
  let tbl = 0;
  const disagreements: string[] = [];
  const definitionDisagreements: string[] = [];
  for (const text of strings) {
    const expected = oldKind(text);
    compared++;
    if (expected === "fig") fig++;
    if (expected === "tbl") tbl++;
    if (headerLabelKind(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    if (kindByDefinition(text) !== expected && definitionDisagreements.length < 5) definitionDisagreements.push(JSON.stringify(text));
  }
  return { compared, fig, tbl, disagreements, definitionDisagreements };
}
const seededStrings = (pieces: readonly string[], seed: number): string[] => {
  const random = seededRandom(seed);
  const strings: string[] = [];
  for (let i = 0; i < SEEDED_STRINGS; i++) {
    const count = Math.floor(random() * 13);
    let text = "";
    for (let j = 0; j < count; j++) text += pieces[Math.floor(random() * pieces.length)];
    strings.push(text);
  }
  return strings;
};

const FIRST_SLOT_ROWS: Array<[string, string, Token]> = [
  ["a letter", "a", { value: "a", offset: 0 }],
  ["a label", "fig-x", { value: "fig-x", offset: 0 }],
  ["a colon, an underscore, a dot, a dash and digits are of the class", "fig-a:b_c.d-1", { value: "fig-a:b_c.d-1", offset: 0 }],
  ["a digit may start a token", "1a", { value: "1a", offset: 0 }],
  ["a dash may start a token", "-", { value: "-", offset: 0 }],
  ["a letter above ASCII", `fig-${E_ACUTE}`, { value: `fig-${E_ACUTE}`, offset: 0 }],
  ["a letter of two code units", `fig-${ASTRAL_LETTER}`, { value: `fig-${ASTRAL_LETTER}`, offset: 0 }],
  ["its two halves side by side are that letter", `fig-${HIGH_HALF}${LOW_HALF}`, { value: `fig-${ASTRAL_LETTER}`, offset: 0 }],
  ["a number that is no digit", `fig-${SUPERSCRIPT_TWO}${ARABIC_THREE}`, { value: `fig-${SUPERSCRIPT_TWO}${ARABIC_THREE}`, offset: 0 }],
  ["a letter above U+00FF", `fig-${CJK}`, { value: `fig-${CJK}`, offset: 0 }],
  ["a double-quoted string is the text written inside", '"fig-x"', { value: "fig-x", offset: 1 }],
  ["a single-quoted string", "'fig-x'", { value: "fig-x", offset: 1 }],
  ["a quoted string may hold blanks and a dollar", '"a b$"', { value: "a b$", offset: 1 }],
  ["an empty quoted string", '""', { value: "", offset: 1 }],
  ["the empty text", "", null],
  ["a lone quote", '"', null],
  ["a quote closed by the other quote", "\"a'", null],
  ["a quoted string with a backslash", '"a\\b"', null],
  ["a quoted string with the other quote inside", "\"a'b\"", null],
  ["a space is no identifier character", "fig-a b", null],
  ["a dollar is no identifier character", "fig-a$", null],
  ["a dollar first", "$fig-a", null],
  ["a lone high half", `fig-${HIGH_HALF}`, null],
  ["a lone low half", `fig-${LOW_HALF}`, null],
  ["the halves the wrong way round", `fig-${LOW_HALF}${HIGH_HALF}`, null],
  ["a line feed", "fig-a\n", null],
  ["a quote in the middle of an unquoted token", 'fig-"a', null],
];
const KIND_ROWS: Array<[string, string, string | null]> = [
  ["a figure", "fig-x", "fig"],
  ["a table", "tbl-x", "tbl"],
  ["a figure with a colon, an underscore, a dot and a dash", "fig-a:b_c.d-e", "fig"],
  ["a letter above ASCII", `fig-${E_ACUTE}`, "fig"],
  ["a letter of two code units", `tbl-${ASTRAL_LETTER}`, "tbl"],
  ["its two halves side by side are that letter", `tbl-${HIGH_HALF}${LOW_HALF}`, "tbl"],
  ["a number that is no digit", `fig-${SUPERSCRIPT_TWO}${ARABIC_THREE}`, "fig"],
  ["a letter above U+00FF", `fig-${CJK}`, "fig"],
  ["the dash alone after the kind", "fig--", "fig"],
  ["the kind and a dash and nothing", "fig-", null],
  ["a table kind and a dash and nothing", "tbl-", null],
  ["the kind without a dash", "figx", null],
  ["another kind", "eq-x", null],
  ["a section", "sec-x", null],
  ["the kind not first", "a-fig-x", null],
  ["upper case", "FIG-x", null],
  ["a capital first letter", "Fig-x", null],
  ["a dollar at the end", "fig-a$", null],
  ["a space inside", "fig-a b", null],
  ["a lone high half", `fig-${HIGH_HALF}`, null],
  ["a lone low half", `fig-${LOW_HALF}`, null],
  ["the halves the wrong way round", `fig-${LOW_HALF}${HIGH_HALF}`, null],
  ["a line feed at the end: `$` does not stop before one", "fig-a\n", null],
  ["a line feed first", "\nfig-a", null],
  ["the empty text", "", null],
  ["a kind in the middle", "fig-fig-x", "fig"],
];

describe("Session 338 — the oracles, the grammars by definition and the stated answers agree (these rows are green on the parent)", () => {
  it.each(FIRST_SLOT_ROWS)("%s: %j in the first slot", (_what, text, expected) => {
    expect(oldReadChunkLabelToken(text, true)).toEqual(expected);
    expect(firstSlotByDefinition(text)).toEqual(expected);
  });
  it.each(KIND_ROWS)("%s: %j", (_what, text, kind) => {
    expect(oldKind(text)).toBe(kind);
    expect(kindByDefinition(text)).toBe(kind);
  });
});

describe("Session 338 — readChunkLabelToken answers what the first-slot test and the quoted test of the parent answered", () => {
  it.each(FIRST_SLOT_ROWS)("%s: %j in the first slot", (_what, text, expected) => {
    expect(readChunkLabelToken(text, true)).toEqual(expected);
  });

  it("reads a token that is not in the first slot as the symbol-chain reader does, and a quoted string alike", () => {
    for (const text of ["fig-a", "fig-a:b", "a-b-c", '"fig-x"', "'x'", "", "1a", "a b", "a-01", "a-12345", `a-${CJK}`]) {
      expect(readChunkLabelToken(text, false)).toEqual(oldReadChunkLabelToken(text, false));
    }
    expect(readChunkLabelToken("fig-a:b", false)).toEqual({ value: "fig-a:b", offset: 0 });
  });

  // Every string up to a length over an alphabet, the accepted and the refused alike.
  it.each([
    ["up to six characters over a letter, a digit, an underscore, a colon, a dot, a dash, a space and a dollar", 6, ALPHABET_T1, COUNTS.t1],
    ["up to six characters over the quotes, a backslash, a letter, a dash and a colon", 6, ALPHABET_T2, COUNTS.t2],
    ["up to six characters over a letter, a non-ASCII letter, the two halves of an astral letter, two numbers that are no digit, a dash and a dollar", 6, ALPHABET_T3, COUNTS.t3],
  ] as const)("agrees with the first-slot test and the quoted test, and with the grammar by definition, on every string of %s", (_name, maxLength, alphabet, counts) => {
    const result = compareFirstSlot(everyString(alphabet, maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect({ quoted: result.quoted, plain: result.plain }).toEqual(counts);
    // outside the first slot the answer is the symbol-chain reader's and the quoted test's: the same on all of them
    for (const text of everyString(alphabet, 4)) {
      expect(readChunkLabelToken(text, false)).toEqual(oldReadChunkLabelToken(text, false));
    }
  }, HEAVY_ROW_MS);

  it("agrees with the first-slot test and the quoted test on 100,000 seeded tokens of up to twelve pieces", () => {
    const result = compareFirstSlot(seededStrings(SEEDED_FIRST_PIECES, SEED_FIRST));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect({ quoted: result.quoted, plain: result.plain }).toEqual(COUNTS.seededFirst);
  }, HEAVY_ROW_MS);

  // The alphabets above hold the characters the class is most likely to take by mistake; this holds EVERY UTF-16 code unit (a lone surrogate included) in every place a character can stand in a token, by putting one
  // at each place of a head and in place of each of its characters: before, in the middle of and after a label, around the dash, and in a quoted string. The accepted count is NOT pinned exactly: which code units are
  // letters and numbers is the Unicode version of the Node running the test (17.0 on Node 22.23, 13.0 in Python 3.9), so the row says only that a good part of the strings are accepted and a good part refused.
  it("agrees with the first-slot test and the quoted test on every UTF-16 code unit at every place of three heads", () => {
    const heads = ["fig-a1", '"ab"', "a:b.c_d-e"];
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(heads)) {
      compared++;
      const expected = oldReadChunkLabelToken(text, true);
      if (expected !== null) accepted++;
      if (JSON.stringify(readChunkLabelToken(text, true)) !== JSON.stringify(expected) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(heads));
    expect(compared).toBe((13 + 9 + 19) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 10);
    expect(accepted).toBeLessThan(compared * 0.9);
  }, HEAVY_ROW_MS);
});

describe("Session 338 — headerLabelKind answers what HEADER_LABEL_ID answered", () => {
  it.each(KIND_ROWS)("%s: %j", (_what, text, kind) => {
    expect(headerLabelKind(text)).toBe(kind);
  });

  it.each([
    ["up to five pieces over the two kinds with and without their dash, a dash, a letter, a colon, a dollar, a non-ASCII letter and the two halves of an astral letter", 5, ALPHABET_K1, COUNTS.k1],
    ["up to six characters over the letters of both kinds, a dash and a letter", 6, ALPHABET_K2, COUNTS.k2],
  ] as const)("agrees with the pattern and with the grammar by definition on every string of %s", (_name, maxLength, alphabet, counts) => {
    const result = compareKind(everyString(alphabet, maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength));
    expect({ fig: result.fig, tbl: result.tbl }).toEqual(counts);
  }, HEAVY_ROW_MS);

  it("agrees with the pattern and with the grammar by definition on 100,000 seeded labels of up to twelve pieces", () => {
    const result = compareKind(seededStrings(SEEDED_HEADER_PIECES, SEED_HEADER));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect({ fig: result.fig, tbl: result.tbl }).toEqual(COUNTS.seededHeader);
  }, HEAVY_ROW_MS);

  it("agrees with the pattern on every UTF-16 code unit at every place of three heads", () => {
    const heads = ["fig-a1", "tbl-x_y", "fig-"];
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(heads)) {
      compared++;
      const expected = oldKind(text);
      if (expected !== null) accepted++;
      if (headerLabelKind(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(heads));
    expect(compared).toBe((13 + 15 + 9) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 10);
    expect(accepted).toBeLessThan(compared * 0.9);
  }, HEAVY_ROW_MS);

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a function that answers `fig` for everything disagrees with the pattern, and the loop counts what it was asked.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    let compared = 0;
    let disagreements = 0;
    for (const text of everyString(ALPHABET_K2, 4)) {
      compared++;
      if (oldKind(text) !== "fig") disagreements++;
    }
    expect(compared).toBe(countStrings(ALPHABET_K2.length, 4));
    expect(disagreements).toBeGreaterThan(0);
  });
});

// The patterns THROW RangeError from 4,194,284 and 4,194,288 characters after `fig-` on a two-byte line (and none at all on a one-byte one, which reads 60,000,000), so the long rows beyond those figures have no old
// answer to compare with: the answer is the grammar's, built into each row. The rows at a million characters are under the limit of both, and both are asked.
const MILLION = 1_000_000;
const BEYOND = 8_500_000; // over twice 4,194,288
const BEYOND_LIMIT_MS = 3000;
const NEAR_MISS_LIMIT_MS = 3000;
const NEAR_MISS_SIZES = [20_000, 50_000, 1_000_000];

describe("Session 338 — the label readers on long tokens", () => {
  it.each([
    ["a label of a million letters", "fig-" + "a".repeat(MILLION)],
    ["a label of a million letters and a letter above U+00FF at its end", "fig-" + "a".repeat(MILLION) + CJK],
    ["a label of a million letters and a dollar", "fig-" + "a".repeat(MILLION) + "$"],
    ["a quoted label of a million letters", '"fig-' + "a".repeat(MILLION) + '"'],
    ["a quoted label with a backslash at its end", '"fig-' + "a".repeat(MILLION) + '\\"'],
    ["a quoted label that is never closed", '"fig-' + "a".repeat(MILLION)],
    ["a million dashes", "-".repeat(MILLION)],
    ["a table label of half a million astral letters", "tbl-" + ASTRAL_LETTER.repeat(500_000)],
  ])("%s: gives the answers the old readers give", (_what, text) => {
    expect(readChunkLabelToken(text, true)).toEqual(oldReadChunkLabelToken(text, true));
    expect(headerLabelKind(text)).toBe(oldKind(text));
  }, HEAVY_ROW_MS);

  // Beyond the figures the answers are stated. The value of a long answer is compared, not printed.
  it("reads labels of 8,500,000 letters and a letter above U+00FF at the end, quoted or not, in under three seconds each, with the answers stated", () => {
    const label = "fig-" + "a".repeat(BEYOND) + CJK;
    const rows: Array<[string, () => unknown, (answer: unknown) => void]> = [
      ["a first-slot label", () => readChunkLabelToken(label, true), (answer) => {
        const token = answer as { value: string; offset: number };
        expect(token.offset).toBe(0);
        expect(token.value === label).toBe(true);
      }],
      ["a quoted label", () => readChunkLabelToken('"' + label + '"', true), (answer) => {
        const token = answer as { value: string; offset: number };
        expect(token.offset).toBe(1);
        expect(token.value === label).toBe(true);
      }],
      ["a label that ends in a dollar", () => readChunkLabelToken(label + "$", true), (answer) => expect(answer).toBeNull()],
      ["the kind of a figure label", () => headerLabelKind(label), (answer) => expect(answer).toBe("fig")],
      ["the kind of a table label", () => headerLabelKind("tbl-" + "a".repeat(BEYOND) + CJK), (answer) => expect(answer).toBe("tbl")],
      ["the kind of a label that ends in a dollar", () => headerLabelKind(label + "$"), (answer) => expect(answer).toBeNull()],
    ];
    for (const [what, run, check] of rows) {
      const started = performance.now();
      const answer = run();
      const took = performance.now() - started;
      check(answer);
      expect(took, what).toBeLessThan(BEYOND_LIMIT_MS);
    }
  }, HEAVY_ROW_MS);

  // The patterns were LINEAR on the shapes below, and a loop must stay so: a restart from every character, or a rescan of the token, would take seconds at a million characters. 20,000 is in the sizes so that a
  // function which keeps a quadratic way for short tokens cannot hide below the larger ones. The limit is wide on purpose.
  it.each([
    ["a label then a dollar", (n: number) => "fig-" + "a".repeat(n) + "$"],
    ["a dollar first", (n: number) => "$" + "fig-a".repeat(n / 5)],
    ["a label of dashes", (n: number) => "fig-" + "-".repeat(n)],
    ["a quoted label never closed", (n: number) => '"fig-' + "a".repeat(n)],
    ["a quoted label then a quote and a letter", (n: number) => '"fig-' + "a".repeat(n) + '"a'],
    ["repeated kinds", (n: number) => "fig-".repeat(n / 4)],
    ["a kind and a dash only", () => "fig-"],
    ["a label of astral letters", (n: number) => "tbl-" + ASTRAL_LETTER.repeat(n / 2)],
    ["a label ending in a lone half", (n: number) => "fig-" + "a".repeat(n) + HIGH_HALF],
  ])("%s: is read in linear time at every near-miss size", (_what, build) => {
    for (const n of NEAR_MISS_SIZES) {
      const text = build(n);
      const started = performance.now();
      const token = readChunkLabelToken(text, true);
      const kind = headerLabelKind(text);
      const took = performance.now() - started;
      if (n === 20_000) {
        expect(token).toEqual(oldReadChunkLabelToken(text, true));
        expect(kind).toBe(oldKind(text));
      }
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  }, HEAVY_ROW_MS);

  // A size of 40 characters, or a limit of 100 s on the rows above, would pass on the patterns too, and one letter put in an alphabet in place of another moves neither its string count nor its accepted count, so
  // the code points are pinned below.
  it("keeps the limits, the sizes, the seeds and the alphabets the rows above are built on", () => {
    expect([MILLION, BEYOND, BEYOND_LIMIT_MS, NEAR_MISS_LIMIT_MS, NEAR_MISS_SIZES, SEEDED_STRINGS, SEED_FIRST, SEED_HEADER]).toEqual([1_000_000, 8_500_000, 3000, 3000, [20_000, 50_000, 1_000_000], 100_000, 338, 3381]);
    expect(BEYOND).toBeGreaterThanOrEqual(2 * 4_194_288); // twice the first throw of HEADER_LABEL_ID at HEAD fe6aaec, the later of the two
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.codePointAt(0) as number);
    expect(codes(ALPHABET_T1)).toEqual([0x61, 0x31, 0x5f, 0x3a, 0x2e, 0x2d, 0x20, 0x24]);
    expect(codes(ALPHABET_T2)).toEqual([0x22, 0x27, 0x5c, 0x61, 0x2d, 0x3a]);
    expect(codes(ALPHABET_T3)).toEqual([0x61, 0xe9, 0xd835, 0xdc00, 0xb2, 0x663, 0x2d, 0x24]);
    expect(ALPHABET_K1).toEqual(["fig-", "tbl-", "fig", "tbl", "-", "a", ":", "$", E_ACUTE, HIGH_HALF, LOW_HALF]);
    expect(codes(ALPHABET_K2)).toEqual([0x66, 0x74, 0x69, 0x62, 0x67, 0x6c, 0x2d, 0x61]);
    expect(`${HIGH_HALF}${LOW_HALF}`).toBe(ASTRAL_LETTER); // the two halves ARE the astral letter
    expect([SEEDED_FIRST_PIECES.length, SEEDED_HEADER_PIECES.length]).toEqual([20, 17]);
    expect(COUNTS).toEqual({
      t1: { quoted: 0, plain: 55_986 },
      t2: { quoted: 242, plain: 1_092 },
      t3: { quoted: 0, plain: 23_408 },
      k1: { fig: 5_491, tbl: 5_491 },
      k2: { fig: 72, tbl: 72 },
      seededFirst: { quoted: 208, plain: 14_539 },
      seededHeader: { fig: 1_454, tbl: 1_504 },
    });
  });
});
