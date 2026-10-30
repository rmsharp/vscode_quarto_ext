import { describe, expect, it } from "vitest";
import { knitrHeaderAssignment } from "../../src/core/qmd/model";
import { compare, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, sameMatch, seededRandom } from "./support/regex-equivalence";

// The enumerations and the code-unit sweep take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 338, part D of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", site (6), place (b). `knitrChunkHeaderLabel` judged every argument of a knitr chunk header
// (`label=fig-x`, `echo = FALSE`, `"label" = 'x'`) with one pattern under the `u` flag whose name, quoted name, value and three blank runs are class-stars, and V8 keeps one entry of its regex backtrack stack per
// character of a class-star under `u`, twice as large once the line holds a character above U+00FF (the line is then a two-byte string): the pattern threw `RangeError: Maximum call stack size exceeded` from
// 4,194,287 letters of a name and from 8,388,557 to 8,388,570 characters of a value, a quoted name or a blank run (bisected at HEAD `fe6aaec`, Session 338, Node 22.23.3, one fresh process per probe). The
// error reached every reader of the header (`indexLabels`, `findLabel`, the Outline of a document that calls `read_chunk`). `knitrHeaderAssignment` reads the same language by index and answers the same groups.
// The old pattern is kept below, copied from the parent `fe6aaec`, as the oracle (Learning 738), beside a reading of the grammar BY DEFINITION that uses no regular expression (it lists every way to cut the string
// into the parts of the pattern and requires exactly one), so that the agreement is not two spellings of one mistake. The pinned counts come from a Python port of that definition
// (`tools/chunk-label-count/count_assignment.py`, no code shared with the TypeScript), never from the code under test.

// ---- The OLD pattern, copied from the parent `fe6aaec` (`qmd/model.ts`, `knitrChunkHeaderLabel`). The callers read groups 1, 2, 4 and 5. ----
const OLD_ASSIGNMENT = /^([ \t]*(?:([\p{L}.][\p{L}\p{N}._]*)|(["'])([^"'\\]*)\3)[ \t]*=(?!=)[ \t]*)([^ \t](?:[\s\S]*[^ \t])?)?[ \t]*$/u;

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter of two UTF-16 code units
const HIGH_HALF = "\ud835"; // the first half of that letter, alone
const LOW_HALF = "\udc00"; // and the second half: HIGH_HALF followed by LOW_HALF IS the astral letter
const E_ACUTE = String.fromCharCode(0xe9); // a lowercase letter that is no ASCII letter
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const NBSP = String.fromCharCode(0xa0); // no blank to this grammar (a space or a tab is)
const CJK = String.fromCharCode(0x4e2d); // a letter above U+00FF

type Groups = Array<string | undefined>;

/** The groups of a match, in the order of the pattern: the whole text, then groups 1 to 5 (an unset group is `undefined`). */
function groupsOf(match: RegExpExecArray | null): Groups | null {
  return match === null ? null : Array.from(match);
}

/**
 * The grammar by definition, with NO regular expression: the parts are leading blanks, a NAME (a letter or `.`, then letters, numbers, `.` and `_`; or a quote, anything but a quote or a backslash, and the same
 * quote), blanks, `=` with no `=` right after it, blanks, an optional VALUE that starts and ends with a non-blank and holds anything between, and blanks to the end. A blank is a space or a tab. Every way to cut
 * the string is listed (the code points are Array.from's, so a high half followed by a low one is ONE point and a lone half is one point that is neither a letter nor a number) and the string is refused unless
 * there is one; it throws if there are two, which the grammar does not allow once the blanks after `=` go to the prefix when there is no value (the greedy blank run of the pattern). The kinds of the few non-ASCII
 * characters of the alphabets below are stated, not looked up.
 */
function assignmentByDefinition(text: string): Groups | null {
  const p = Array.from(text, (c) => c.codePointAt(0) as number);
  const n = p.length;
  const slice = (a: number, b: number): string => p.slice(a, b).map((c) => String.fromCodePoint(c)).join("");
  const isLetter = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 0xe9 || c === 0x1d400 || c === 0x4e2d;
  const isNumber = (c: number): boolean => (c >= 48 && c <= 57) || c === 0xb2 || c === 0x663;
  const isBlank = (c: number): boolean => c === 32 || c === 9;
  const isQuote = (c: number): boolean => c === 34 || c === 39;
  const allBlank = (from: number): boolean => p.slice(from).every(isBlank);
  const found: Groups[] = [];
  for (let a = 0; a <= n; a++) {
    if (a > 0 && !isBlank(p[a - 1])) break; // the leading blanks are p[0..a)
    const names: Array<{ end: number; bare?: string; quote?: string; quoted?: string }> = [];
    if (a < n && (isLetter(p[a]) || p[a] === 46)) {
      for (let b = a + 1; b <= n; b++) {
        if (b > a + 1 && !(isLetter(p[b - 1]) || isNumber(p[b - 1]) || p[b - 1] === 46 || p[b - 1] === 95)) break;
        names.push({ end: b, bare: slice(a, b) });
      }
    }
    if (a < n && isQuote(p[a])) {
      for (let c = a + 1; c < n; c++) {
        if (c > a + 1 && (isQuote(p[c - 1]) || p[c - 1] === 92)) break;
        if (p[c] === p[a]) names.push({ end: c + 1, quote: slice(a, a + 1), quoted: slice(a + 1, c) });
      }
    }
    for (const name of names) {
      for (let d = name.end; d <= n; d++) {
        if (d > name.end && !isBlank(p[d - 1])) break; // the blanks before the equals sign are p[end..d)
        if (!(d < n && p[d] === 61) || (d + 1 < n && p[d + 1] === 61)) continue;
        for (let e = d + 1; e <= n; e++) {
          if (e > d + 1 && !isBlank(p[e - 1])) break; // the blanks after it are p[d+1..e)
          if (e === n) found.push([slice(0, n), slice(0, e), name.bare, name.quote, name.quoted, undefined]);
          if (e < n && !isBlank(p[e])) {
            for (let f = e + 1; f <= n; f++) {
              if (!isBlank(p[f - 1]) && allBlank(f)) found.push([slice(0, n), slice(0, e), name.bare, name.quote, name.quoted, slice(e, f)]);
            }
          }
        }
      }
    }
  }
  if (new Set(found.map((groups) => JSON.stringify(groups))).size > 1) {
    throw new Error(`the grammar is ambiguous on ${JSON.stringify(text)}`);
  }
  return found.length === 0 ? null : found[0];
}

/** The cure's answer in the same shape: `knitrHeaderAssignment` returns the groups at the pattern's indices (an array with `index` 0). */
const newMatch = (text: string): RegExpExecArray | null => knitrHeaderAssignment(text) as unknown as RegExpExecArray | null;

const U = undefined;
/** The groups the old pattern gives, stated by hand: [text, prefix, bare name, quote, quoted name, value]. */
const STATED: Array<[string, string, Groups | null]> = [
  ["a name, an equals sign and a value", "a=b", ["a=b", "a=", "a", U, U, "b"]],
  ["a label", "label=fig-x", ["label=fig-x", "label=", "label", U, U, "fig-x"]],
  ["blanks all around are dropped from the value and kept in the prefix", "  label  =  fig-x  ", ["  label  =  fig-x  ", "  label  =  ", "label", U, U, "fig-x"]],
  ["a tab is a blank", "label\t=\tfig-x\t", ["label\t=\tfig-x\t", "label\t=\t", "label", U, U, "fig-x"]],
  ["a quoted value keeps its quotes", 'label="fig-x"', ['label="fig-x"', "label=", "label", U, U, '"fig-x"']],
  ["a quoted name", '"label"=x', ['"label"=x', '"label"=', U, '"', "label", "x"]],
  ["a single-quoted name holds blanks", "'a b'=1", ["'a b'=1", "'a b'=", U, "'", "a b", "1"]],
  ["an empty quoted name", '""=1', ['""=1', '""=', U, '"', "", "1"]],
  ["no value", "a=", ["a=", "a=", "a", U, U, U]],
  ["blanks and no value: the prefix takes them all", "a=   ", ["a=   ", "a=   ", "a", U, U, U]],
  ["blanks inside a value stay", "a=x y", ["a=x y", "a=", "a", U, U, "x y"]],
  ["trailing blanks leave the value, inner ones stay", "a=x   y   ", ["a=x   y   ", "a=", "a", U, U, "x   y"]],
  ["a single character value", "a=x ", ["a=x ", "a=", "a", U, U, "x"]],
  ["a name may start with a dot", ".x=1", [".x=1", ".x=", ".x", U, U, "1"]],
  ["a name holds letters, numbers, dots and underscores", "a.b_1=2", ["a.b_1=2", "a.b_1=", "a.b_1", U, U, "2"]],
  ["a name may not start with a digit", "1a=2", null],
  ["a name may not start with an underscore", "_a=2", null],
  ["a name holds no dash", "a-b=1", null],
  ["a letter above ASCII starts a name", `${E_ACUTE}=1`, [`${E_ACUTE}=1`, `${E_ACUTE}=`, E_ACUTE, U, U, "1"]],
  ["a letter of two code units starts a name", `${ASTRAL_LETTER}=1`, [`${ASTRAL_LETTER}=1`, `${ASTRAL_LETTER}=`, ASTRAL_LETTER, U, U, "1"]],
  ["its two halves side by side are that letter", `${HIGH_HALF}${LOW_HALF}=1`, [`${ASTRAL_LETTER}=1`, `${ASTRAL_LETTER}=`, ASTRAL_LETTER, U, U, "1"]],
  ["a number that is no digit cannot start a name", `${SUPERSCRIPT_TWO}=1`, null],
  ["a number that is no digit goes on a name", `a${SUPERSCRIPT_TWO}${ARABIC_THREE}=1`, [`a${SUPERSCRIPT_TWO}${ARABIC_THREE}=1`, `a${SUPERSCRIPT_TWO}${ARABIC_THREE}=`, `a${SUPERSCRIPT_TWO}${ARABIC_THREE}`, U, U, "1"]],
  ["a lone high half is no letter", `${HIGH_HALF}=1`, null],
  ["a lone high half in a name stops it", `a${HIGH_HALF}=1`, null],
  ["a lone low half is no letter", `${LOW_HALF}=1`, null],
  ["a lone half is a value character", `a=${HIGH_HALF}`, [`a=${HIGH_HALF}`, "a=", "a", U, U, HIGH_HALF]],
  ["two equals signs are no assignment", "a==b", null],
  ["an equals sign right after a blank run's equals sign", "a= =b", ["a= =b", "a= ", "a", U, U, "=b"]],
  ["three equals signs", "a===", null],
  ["an equals sign inside a value", "a=b=c", ["a=b=c", "a=", "a", U, U, "b=c"]],
  ["no name", '="x"', null],
  ["an unclosed quote", '"a=1', null],
  ["text between a closing quote and the equals sign", '"a"b=1', null],
  ["a backslash in a quoted name", '"a\\b"=1', null],
  ["the other quote in a quoted name", "\"a'b\"=1", null],
  ["a quote that closes with the other quote", "\"a'=1", null],
  ["a name and nothing else", "a", null],
  ["the empty text", "", null],
  ["blanks only", "   ", null],
  ["an equals sign only", "=", null],
  ["a line feed is a value character", "a=\n", ["a=\n", "a=", "a", U, U, "\n"]],
  ["a line feed ends a value without being a blank", "a=x\n", ["a=x\n", "a=", "a", U, U, "x\n"]],
  ["a no-break space is no blank in a value", `a=${NBSP}`, [`a=${NBSP}`, "a=", "a", U, U, NBSP]],
  ["a no-break space after the value stays in it", `a=x${NBSP}`, [`a=x${NBSP}`, "a=", "a", U, U, `x${NBSP}`]],
  ["a no-break space before the equals sign is no blank", `a${NBSP}=1`, null],
  ["a no-break space before the name is no blank", `${NBSP}a=1`, null],
  ["a name followed by blanks and a word", "ab cd=1", null],
  ["a value of an option that holds a string with an equals sign", 'x="a=b"', ['x="a=b"', "x=", "x", U, U, '"a=b"']],
  ["a letter above U+00FF", `${CJK}=1`, [`${CJK}=1`, `${CJK}=`, CJK, U, U, "1"]],
];

/** How many strings of each enumeration the grammar accepts, how many of those have a quoted name (group 3 set) and how many have a value (group 5 set). Counted by `tools/chunk-label-count/count_assignment.py`
 * (every cut of the string into the parts of the pattern, over a list of UTF-16 code units decoded by hand, Python 3's `unicodedata` for the letter and number kinds, no `re`, no TypeScript), so a comparison
 * cannot pass by both sides accepting nothing and the numbers do not come from the code under test. The seeded one is counted the same way from a port of the generator. `python3 -I
 * tools/chunk-label-count/count_assignment.py` prints all five (about 4 seconds); change its alphabets with these. */
const COUNTS = {
  e1: { accepted: 59_904, quoted: 0, valued: 53_496 },
  e2: { accepted: 7_923, quoted: 2_502, valued: 6_600 },
  e3: { accepted: 22_156, quoted: 0, valued: 20_200 },
  e4: { accepted: 33_468, quoted: 0, valued: 32_704 },
  seeded: { accepted: 2_394, quoted: 581, valued: 2_105 },
};

// The four alphabets of the exhaustive rows. E1: the characters of a bare name and the structure (a letter, a digit, a dot, an underscore, an equals sign, a blank), to seven characters. E2: the quotes and the
// backslash beside a letter, an equals sign, a space and a tab, to six. E3: the Unicode kinds, with the two HALVES of an astral letter as members of their own so that the enumeration builds the pair (a letter), a lone
// half (nothing) and a half beside a BMP character, to six. E4: the equals sign beside the characters that look like blanks or line ends but are not (a no-break space, a line feed), to seven.
const ALPHABET_E1 = ["a", "1", ".", "_", "=", " "];
const ALPHABET_E2 = ['"', "'", "\\", "a", "=", " ", "\t"];
const ALPHABET_E3 = ["a", E_ACUTE, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, "1", "=", " "];
const ALPHABET_E4 = ["a", "=", " ", NBSP, "\n", "."];
const SEEDED_STRINGS = 100_000;
const SEED = 338;
const SEEDED_PIECES = ["a", "label", "x.y", "1", " ", "  ", "\t", "=", "=", "==", '"', "'", "\\", E_ACUTE, ASTRAL_LETTER, HIGH_HALF, LOW_HALF, SUPERSCRIPT_TWO, ARABIC_THREE, "-", "_", "$", "\n", '"x"', "'y'", "fig-a", NBSP];

/** Both sides on every string: how many were compared, how many the pattern accepts, how many of those have a quoted name and a value, and the first few strings on which the function or the reading by definition
 * disagrees with the pattern (every group compared, an unset one included). */
function compareAll(strings: Iterable<string>): { compared: number; accepted: number; quoted: number; valued: number; disagreements: string[]; definitionDisagreements: string[] } {
  let compared = 0;
  let accepted = 0;
  let quoted = 0;
  let valued = 0;
  const disagreements: string[] = [];
  const definitionDisagreements: string[] = [];
  for (const text of strings) {
    const expected = OLD_ASSIGNMENT.exec(text);
    compared++;
    if (expected !== null) {
      accepted++;
      if (expected[3] !== undefined) quoted++;
      if (expected[5] !== undefined) valued++;
    }
    if (!sameMatch(newMatch(text), expected) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    if (JSON.stringify(assignmentByDefinition(text)) !== JSON.stringify(groupsOf(expected)) && definitionDisagreements.length < 5) definitionDisagreements.push(JSON.stringify(text));
  }
  return { compared, accepted, quoted, valued, disagreements, definitionDisagreements };
}

describe("Session 338 — the oracle, the grammar by definition and the stated groups agree (these rows are green on the parent)", () => {
  it.each(STATED)("%s: %j", (_what, text, groups) => {
    expect(groupsOf(OLD_ASSIGNMENT.exec(text))).toEqual(groups);
    expect(assignmentByDefinition(text)).toEqual(groups);
  });
});

describe("Session 338 — knitrHeaderAssignment answers the groups the argument pattern of knitrChunkHeaderLabel answered", () => {
  it.each(STATED)("%s: %j", (_what, text, groups) => {
    const match = knitrHeaderAssignment(text);
    expect(match === null ? null : Array.from(match)).toEqual(groups);
    if (match !== null) {
      expect(match.index).toBe(0);
      expect(match.length).toBe(6);
    }
    expect(sameMatch(newMatch(text), OLD_ASSIGNMENT.exec(text))).toBe(true);
  });

  // Every string up to a length over an alphabet, the accepted and the refused alike.
  it.each([
    ["up to seven characters over a letter, a digit, a dot, an underscore, an equals sign and a space", 7, ALPHABET_E1, COUNTS.e1],
    ["up to six characters over the quotes, a backslash, a letter, an equals sign, a space and a tab", 6, ALPHABET_E2, COUNTS.e2],
    ["up to six characters over a letter, a non-ASCII letter, the two halves of an astral letter, a number that is no digit, a digit, an equals sign and a space", 6, ALPHABET_E3, COUNTS.e3],
    ["up to seven characters over a letter, an equals sign, a space, a no-break space, a line feed and a dot", 7, ALPHABET_E4, COUNTS.e4],
  ] as const)("agrees with the pattern (every group) and with the grammar by definition on every string of %s", (_name, maxLength, alphabet, counts) => {
    const result = compareAll(everyString(alphabet, maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect({ accepted: result.accepted, quoted: result.quoted, valued: result.valued }).toEqual(counts);
  }, HEAVY_ROW_MS);

  it("agrees with the pattern and with the grammar by definition on 100,000 seeded headers of up to twelve pieces", () => {
    const random = seededRandom(SEED);
    const headers: string[] = [];
    for (let i = 0; i < SEEDED_STRINGS; i++) {
      const count = Math.floor(random() * 13);
      let header = "";
      for (let j = 0; j < count; j++) header += SEEDED_PIECES[Math.floor(random() * SEEDED_PIECES.length)];
      headers.push(header);
    }
    const result = compareAll(headers);
    expect(result.disagreements).toEqual([]);
    expect(result.definitionDisagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect({ accepted: result.accepted, quoted: result.quoted, valued: result.valued }).toEqual(COUNTS.seeded);
  }, HEAVY_ROW_MS);

  // The alphabets above hold the characters the grammar is most likely to take by mistake; this holds EVERY UTF-16 code unit (a lone surrogate included) in every place a character can stand in a header, by putting
  // one at each place of a head and in place of each of its characters. The first head has every structural position of the grammar in it: before and after the leading blanks, as the first, a middle and the last
  // character of a bare name, around the blanks and the equals sign, as the first, a middle and the last character of the value, and in the trailing blanks. The second is a quoted name, the others the shortest
  // heads. The accepted count is NOT pinned exactly: which code units are letters is the Unicode version of the Node running the test (17.0 on Node 22.23, 13.0 in Python 3.9), so the row says only that a good part
  // of the strings are accepted and a good part refused.
  it("agrees with the pattern on every UTF-16 code unit at every place of five heads", () => {
    const heads = ["  a.1 =  x y  ", ' "ab" =x ', "a=b", "a=", "=a"];
    const disagreements: string[] = [];
    let compared = 0;
    let accepted = 0;
    for (const text of everyCodeUnitEdit(heads)) {
      compared++;
      const expected = OLD_ASSIGNMENT.exec(text);
      if (expected !== null) accepted++;
      if (!sameMatch(newMatch(text), expected) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countCodeUnitEdits(heads));
    expect(compared).toBe((29 + 19 + 7 + 5 + 5) * 0x10000);
    expect(accepted).toBeGreaterThan(compared / 10);
    expect(accepted).toBeLessThan(compared * 0.9);
  }, HEAVY_ROW_MS);

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a function that accepts only a name, an equals sign and one letter disagrees with the pattern, and the loop counts what it was asked.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    const result = compare(OLD_ASSIGNMENT, /^(a=)(a)$/, everyString(ALPHABET_E1, 3));
    expect(result.compared).toBe(countStrings(ALPHABET_E1.length, 3));
    expect(result.disagreements.length).toBeGreaterThan(0);
    expect(compareAll(["a=b"]).definitionDisagreements).toEqual([]); // the reading by definition does not depend on the function
  });
});

// The pattern THROWS RangeError from 4,194,287 letters of a name and from 8,388,557 to 8,388,570 characters of the other parts on a two-byte line (and none at all on a one-byte one, which reads 60,000,000 characters),
// so the long rows beyond those figures have no old answer to compare with: the answer is the grammar's, built into each row. The rows at a million characters are under the limit of both, and both are asked.
const MILLION = 1_000_000;
const NAME_BEYOND = 8_500_000; // over twice 4,194,287
const OTHER_BEYOND = 17_000_000; // over twice 8,388,570
const BEYOND_LIMIT_MS = 3000;
const NEAR_MISS_LIMIT_MS = 3000;
const NEAR_MISS_SIZES = [20_000, 50_000, 1_000_000];

describe("Session 338 — knitrHeaderAssignment on long headers", () => {
  it.each([
    ["a name of a million letters", "a".repeat(MILLION) + "=b"],
    ["a name of a million letters, a letter above U+00FF at its end", "a".repeat(MILLION) + CJK + "=b"],
    ["a value of a million characters", "a=" + "b".repeat(MILLION)],
    ["a quoted name of a million characters", '"' + "a".repeat(MILLION) + '"=1'],
    ["a million blanks before the equals sign", "a" + " ".repeat(MILLION) + "=b"],
    ["a million blanks after the equals sign", "a=" + " ".repeat(MILLION) + "b"],
    ["a million blanks after the value", "a=b" + " ".repeat(MILLION)],
    ["a million blanks and no value", "a=" + " ".repeat(MILLION)],
    ["a million blanks inside the value", "a=b" + " ".repeat(MILLION) + "c"],
    ["a value of half a million words", "a=" + "x ".repeat(500_000)],
    ["a million characters and no equals sign", "a".repeat(MILLION)],
    ["a quoted name of a million characters and no closing quote", '"' + "a".repeat(MILLION)],
    ["a million equals signs", "a" + "=".repeat(MILLION)],
  ])("%s: gives the groups the pattern gives", (_what, text) => {
    expect(sameMatch(newMatch(text), OLD_ASSIGNMENT.exec(text))).toBe(true);
  }, HEAVY_ROW_MS);

  // Beyond the figures the groups are stated: the whole text, a prefix up to the equals sign and the blanks after it, the name, and the value. Lengths and ends are compared, not printed.
  it("reads a name of 8,500,000 letters and a letter above U+00FF at its end, a quoted name, a value and blank runs of 17,000,000 characters in under three seconds each, with the groups stated", () => {
    const rows: Array<[string, string, (groups: Groups) => void]> = [
      ["a name", "a".repeat(NAME_BEYOND) + CJK + "=v", (g) => {
        expect(g[1]).toBe("a".repeat(NAME_BEYOND) + CJK + "=");
        expect(g[2]!.length).toBe(NAME_BEYOND + 1);
        expect([g[3], g[4], g[5]]).toEqual([U, U, "v"]);
      }],
      ["a value", "x=" + "b".repeat(OTHER_BEYOND) + CJK, (g) => {
        expect([g[1], g[2], g[3], g[4]]).toEqual(["x=", "x", U, U]);
        expect(g[5]!.length).toBe(OTHER_BEYOND + 1);
        expect(g[5]!.endsWith("b" + CJK)).toBe(true);
      }],
      ["a quoted name", '"' + "a".repeat(OTHER_BEYOND) + CJK + '"=1', (g) => {
        expect(g[1]!.length).toBe(OTHER_BEYOND + 4);
        expect([g[2], g[3]]).toEqual([U, '"']);
        expect(g[4]!.length).toBe(OTHER_BEYOND + 1);
        expect(g[5]).toBe("1");
      }],
      ["blanks before the equals sign", "label" + " ".repeat(OTHER_BEYOND) + "=fig-x, x=" + CJK, (g) => {
        expect(g[1]!.length).toBe(5 + OTHER_BEYOND + 1);
        expect([g[2], g[5]]).toEqual(["label", "fig-x, x=" + CJK]);
      }],
      ["blanks after the equals sign", "label=" + " ".repeat(OTHER_BEYOND) + "fig-x" + CJK, (g) => {
        expect(g[1]!.length).toBe(6 + OTHER_BEYOND);
        expect([g[2], g[5]]).toEqual(["label", "fig-x" + CJK]);
      }],
      ["blanks after the value", "label=fig-x" + CJK + " ".repeat(OTHER_BEYOND), (g) => {
        expect([g[1], g[2], g[5]]).toEqual(["label=", "label", "fig-x" + CJK]);
      }],
    ];
    for (const [what, text, check] of rows) {
      const started = performance.now();
      const match = newMatch(text);
      const took = performance.now() - started;
      expect(match, what).not.toBeNull();
      expect(match![0] === text, what).toBe(true);
      check(Array.from(match!));
      expect(took, what).toBeLessThan(BEYOND_LIMIT_MS);
    }
  }, HEAVY_ROW_MS);

  // The pattern was LINEAR on the shapes below, and a loop must stay so: a rescan of the header for each blank, or a quadratic look back, would take seconds at a million characters. 20,000 is in the sizes so
  // that a function which keeps a quadratic way for short headers cannot hide below the larger ones. The limit is wide on purpose.
  it.each([
    ["a name and no equals sign", (n: number) => "a".repeat(n)],
    ["a name and blanks", (n: number) => "a" + " ".repeat(n)],
    ["a name, blanks and a word", (n: number) => "a" + " ".repeat(n) + "b"],
    ["a quoted name and no closing quote", (n: number) => '"' + "a".repeat(n)],
    ["a quoted name and a backslash at its end", (n: number) => '"' + "a".repeat(n) + "\\"],
    ["a closed quoted name and blanks", (n: number) => '"a"' + " ".repeat(n)],
    ["a name and equals signs", (n: number) => "a" + "=".repeat(n)],
    ["a name, an equals sign and blanks", (n: number) => "a=" + " ".repeat(n)],
    ["a value and blanks", (n: number) => "a=x" + " ".repeat(n)],
    ["a value of words", (n: number) => "a=" + "x ".repeat(n / 2)],
    ["a value of blanks between two words", (n: number) => "a=x" + " ".repeat(n) + "y"],
    ["a value of tabs and spaces", (n: number) => "a=x" + " \t".repeat(n / 2) + "y "],
    ["a name of dots", (n: number) => "." + ".".repeat(n) + "=1"],
    ["blanks first", (n: number) => " ".repeat(n) + "a=1"],
    ["blanks only", (n: number) => " ".repeat(n)],
  ])("%s: is read in linear time at every near-miss size", (_what, build) => {
    for (const n of NEAR_MISS_SIZES) {
      const text = build(n);
      expect(text.length).toBeGreaterThan(n - 4);
      const started = performance.now();
      const match = newMatch(text);
      const took = performance.now() - started;
      if (n === 20_000) {
        expect(sameMatch(match, OLD_ASSIGNMENT.exec(text))).toBe(true);
      }
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  }, HEAVY_ROW_MS);

  // A size of 40 characters, or a limit of 100 s on the rows above, would pass on the pattern too, and one letter put in an alphabet in place of another moves neither its string count nor its accepted count, so the code points are pinned below.
  it("keeps the limits, the sizes, the seed and the alphabets the rows above are built on", () => {
    expect([MILLION, NAME_BEYOND, OTHER_BEYOND, BEYOND_LIMIT_MS, NEAR_MISS_LIMIT_MS, NEAR_MISS_SIZES, SEEDED_STRINGS, SEED]).toEqual([1_000_000, 8_500_000, 17_000_000, 3000, 3000, [20_000, 50_000, 1_000_000], 100_000, 338]);
    expect(NAME_BEYOND).toBeGreaterThanOrEqual(2 * 4_194_287); // twice the first throw of the name star at HEAD fe6aaec
    expect(OTHER_BEYOND).toBeGreaterThanOrEqual(2 * 8_388_570); // twice the first throw of the quoted name, the latest of the others
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.codePointAt(0) as number);
    expect(codes(ALPHABET_E1)).toEqual([0x61, 0x31, 0x2e, 0x5f, 0x3d, 0x20]);
    expect(codes(ALPHABET_E2)).toEqual([0x22, 0x27, 0x5c, 0x61, 0x3d, 0x20, 0x09]);
    expect(codes(ALPHABET_E3)).toEqual([0x61, 0xe9, 0xd835, 0xdc00, 0xb2, 0x31, 0x3d, 0x20]);
    expect(codes(ALPHABET_E4)).toEqual([0x61, 0x3d, 0x20, 0xa0, 0x0a, 0x2e]);
    expect(`${HIGH_HALF}${LOW_HALF}`).toBe(ASTRAL_LETTER); // the two halves ARE the astral letter
    expect(SEEDED_PIECES.length).toBe(27);
    expect(COUNTS).toEqual({
      e1: { accepted: 59_904, quoted: 0, valued: 53_496 },
      e2: { accepted: 7_923, quoted: 2_502, valued: 6_600 },
      e3: { accepted: 22_156, quoted: 0, valued: 20_200 },
      e4: { accepted: 33_468, quoted: 0, valued: 32_704 },
      seeded: { accepted: 2_394, quoted: 581, valued: 2_105 },
    });
  });
});
