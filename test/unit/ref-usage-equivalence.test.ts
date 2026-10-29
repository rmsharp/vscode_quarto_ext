import { describe, expect, it } from "vitest";
import { refIdAt, refUsageEnd } from "../../src/core/refs";
import { countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part (6). A cross-reference USAGE (`@fig-plot`, `@sec-meth:ods`) was found by `REF_USAGE`, whose id was read as
// `(?:REGCHAR|PUNCT(?=REGCHAR))*`, and V8 keeps one entry of its regex backtrack stack per repetition of a group: a token of 8,388,573 or more repetitions (`@fig-` and as many letters; `.a` pairs count twice) threw
// `RangeError: Maximum call stack size exceeded` in `refIdAt` (bisected at `8ebce73`, a fresh process per probe), which the hover and the go-to-definition token reader call with the line under the cursor.
// `refUsageEnd` reads the same language by UTF-16 code unit: it answers where the usage whose `@` is at an index ends, and `refIdAt` asks it at each `@` of the line in turn. The old pattern is kept below, copied from the
// parent `8ebce73` together with the body of the old `refIdAt`, as the oracle (Learning 738), beside a reading by definition that uses no regular expression for the shape of a usage; the pinned counts come from the old
// pattern and from a Python port of the definition (no code shared with the TypeScript, `tools/ref-usage-count/count_ref_usage.py`) and never from the code under test.

// ---- The OLD pattern and the OLD `refIdAt`, copied from the parent `8ebce73` (`refs.ts`, the constants at 301 to 331 and the function at 707). ----
const OLD_REF_ID_REGCHAR = String.raw`[\p{L}\p{N}_]`;
const OLD_REF_ID_PUNCT = String.raw`[:.#$%&+?<>~/-]`;
const OLD_REF_USAGE = new RegExp(
  String.raw`(?<![A-Za-z0-9_])@((?:fig|tbl|sec|eq|lst)-(?=${OLD_REF_ID_REGCHAR})` +
    String.raw`(?:${OLD_REF_ID_REGCHAR}|${OLD_REF_ID_PUNCT}(?=${OLD_REF_ID_REGCHAR}))*)`,
  "gu",
);
function oldRefIdAt(lineText: string, column: number): string | null {
  OLD_REF_USAGE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OLD_REF_USAGE.exec(lineText)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (column >= start && column <= end) {
      return m[1];
    }
  }
  return null;
}
/** Where the old pattern's match that starts AT `at` ends (exclusive), or -1: a search that starts at `at` finds its match at `at` or not at all. */
function oldUsageEnd(lineText: string, at: number): number {
  OLD_REF_USAGE.lastIndex = at;
  const m = OLD_REF_USAGE.exec(lineText);
  return m !== null && m.index === at ? at + m[0].length : -1;
}
/** Every match of the old pattern on the line, left to right, as [start, end]. */
function oldUsages(lineText: string): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  OLD_REF_USAGE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OLD_REF_USAGE.exec(lineText)) !== null) {
    found.push([m.index, m.index + m[0].length]);
  }
  return found;
}

// ---- A reading of the old pattern by DEFINITION. A usage is an `@` that no ASCII letter, digit or `_` comes right before, then one of the five kinds and its `-`, then an id; the id is the longest run of code points,
// counted from the first, in which every code point is a regchar (a Unicode letter or number, or `_`) or an internal-punctuation mark with a regchar right after it, and whose first is a regchar. The shape of the id is
// stated here by a flag per code point and a count of the leading flagged ones, not by a scan; whether a code point is a letter or a number is the one question no API but a `\p{..}` test answers, so that is asked of a
// single code point at a time and for the ASCII range it is spelled out. ----
const KINDS = ["fig-", "tbl-", "sec-", "eq-", "lst-"];
const PUNCT = ":.#$%&+?<>~/-";
const LETTER_OR_NUMBER = /^[\p{L}\p{N}]$/u;
function isAsciiWord(unit: number): boolean {
  return (unit >= 48 && unit <= 57) || (unit >= 65 && unit <= 90) || unit === 95 || (unit >= 97 && unit <= 122);
}
function isRegchar(codePoint: number): boolean {
  return codePoint < 128 ? isAsciiWord(codePoint) : LETTER_OR_NUMBER.test(String.fromCodePoint(codePoint));
}
function definitionUsageEnd(line: string, at: number): number {
  if (line[at] !== "@" || (at > 0 && isAsciiWord(line.charCodeAt(at - 1)))) {
    return -1;
  }
  const kinds = KINDS.filter((kind) => line.startsWith(kind, at + 1));
  if (kinds.length !== 1) {
    return -1; // the five kinds begin with five different letters, so at most one can follow the `@`
  }
  const points: Array<{ codePoint: number; offset: number }> = [];
  for (let i = at + 1 + kinds[0].length; i < line.length; ) {
    const codePoint = line.codePointAt(i) as number;
    points.push({ codePoint, offset: i });
    i += codePoint > 0xffff ? 2 : 1;
  }
  if (points.length === 0 || !isRegchar(points[0].codePoint)) {
    return -1;
  }
  const inId = points.map((p, k) => isRegchar(p.codePoint) || (PUNCT.includes(String.fromCodePoint(p.codePoint)) && k + 1 < points.length && isRegchar(points[k + 1].codePoint)));
  let kept = 0;
  while (kept < points.length && inId[kept]) {
    kept++;
  }
  return kept === points.length ? line.length : points[kept].offset;
}
function definitionRefIdAt(line: string, column: number): string | null {
  for (let at = line.indexOf("@"); at >= 0; at = line.indexOf("@", at + 1)) {
    const end = definitionUsageEnd(line, at);
    if (end >= 0 && column >= at && column <= end) {
      return line.slice(at + 1, end);
    }
  }
  return null;
}

/** The two functions under test, passed to the checkers so that a loop which cannot fail is shown to fail once (the last row of the file). */
type Reader = { usageEnd: (line: string, at: number) => number; idAt: (line: string, column: number) => string | null };
const NOW: Reader = { usageEnd: refUsageEnd, idAt: refIdAt };
type Tally = { strings: number; usages: number; answered: number; disagreements: string[] };
const newTally = (): Tally => ({ strings: 0, usages: 0, answered: 0, disagreements: [] });
const report = (tally: Tally, text: string, what: string): void => {
  if (tally.disagreements.length < 5) {
    tally.disagreements.push(`${JSON.stringify(text)}: ${what}`);
  }
};
/** Compare the new functions with the old pattern and the reading by definition on one line: the end of the usage at every `@`, and the id under the cursor at every column from 0 to one past the end. */
function checkLine(line: string, tally: Tally, reader: Reader = NOW): void {
  tally.strings++;
  const old = oldUsages(line);
  tally.usages += old.length;
  for (let at = line.indexOf("@"); at >= 0; at = line.indexOf("@", at + 1)) {
    const expected = old.find(([start]) => start === at)?.[1] ?? -1;
    const now = reader.usageEnd(line, at);
    const byDefinition = definitionUsageEnd(line, at);
    if (now !== expected || byDefinition !== expected) {
      report(tally, line, `usage at ${at}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
  }
  for (let column = 0; column <= line.length + 1; column++) {
    const expected = oldRefIdAt(line, column);
    if (expected !== null) tally.answered++;
    const now = reader.idAt(line, column);
    const byDefinition = definitionRefIdAt(line, column);
    if (now !== expected || byDefinition !== expected) {
      report(tally, line, `column ${column}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}, by definition ${JSON.stringify(byDefinition)}`);
    }
  }
}
/** The boundary columns only (each `@`, the last character of its usage, the end, one past, and the two ends of the line), against the old pattern alone (the enumerations hold the reading by definition to it): for the sweep, which puts 65,536 characters in each place and reads too many lines for every column. */
function checkLineAtBoundaries(line: string, tally: Tally, reader: Reader = NOW): void {
  tally.strings++;
  const old = oldUsages(line);
  tally.usages += old.length;
  const columns = new Set<number>([0, line.length, line.length + 1]);
  for (let at = line.indexOf("@"); at >= 0; at = line.indexOf("@", at + 1)) {
    const expected = old.find(([start]) => start === at)?.[1] ?? -1;
    const now = reader.usageEnd(line, at);
    if (now !== expected) {
      report(tally, line, `usage at ${at}: old ${expected}, now ${now}`);
    }
    columns.add(at - 1).add(at).add(at + 1);
    if (expected >= 0) columns.add(expected - 1).add(expected).add(expected + 1);
  }
  for (const column of columns) {
    const expected = oldRefIdAt(line, column);
    if (expected !== null) tally.answered++;
    const now = reader.idAt(line, column);
    if (now !== expected) {
      report(tally, line, `column ${column}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}`);
    }
  }
}
function checkAll(lines: Iterable<string>, check: (line: string, tally: Tally) => void): Tally {
  const tally = newTally();
  for (const line of lines) {
    check(line, tally);
    if (tally.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return tally;
}

// Tokens of more than one character make each string reach further: `@fig-` is one symbol, so six symbols hold a usage and its follower. The characters are the ones the pattern is most likely to take by mistake,
// and every one has the same category under every Unicode version a Node (17) or a Python (13) knows: `é`, `日` and `𝐀` (a letter of two code units) are letters, `٣` and `²` are numbers, a lone surrogate, an
// emoji and a combining mark are neither.
const ASTRAL_LETTER = "\u{1d400}";
const HIGH = "\ud835";
const LOW = "\udc00";
const EMOJI = "\u{1f600}";
const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; usages: number; answered: number }> = [
  { label: "7 symbols (`@`, `fig-`, `eq-`, a letter, `.`, `-`, a blank), up to 7", alphabet: ["@", "fig-", "eq-", "a", ".", "-", " "], maxLength: 7, usages: 72_030, answered: 643_713 },
  { label: "8 symbols (`@sec-`, a letter, `_`, `:`, `#`, `.`, `é`, a blank), up to 6", alphabet: ["@sec-", "a", "_", ":", "#", ".", "\u00e9", " "], maxLength: 6, usages: 54_669, answered: 419_256 },
  { label: "11 symbols (`@tbl-`, an astral letter, a high and a low surrogate alone, an emoji, a digit, a letter, a dot, a combining mark, a blank), up to 5", alphabet: ["@tbl-", "a", ASTRAL_LETTER, HIGH, LOW, EMOJI, "\u0663", "\u65e5", ".", "\u0301", " "], maxLength: 5, usages: 21_659, answered: 167_718 },
  { label: "8 symbols (`@`, `fig-`, `tbl-`, `lst-`, `a`, `_`, `é`, a blank), up to 6", alphabet: ["@", "fig-", "tbl-", "lst-", "a", "_", "\u00e9", " "], maxLength: 6, usages: 33_102, answered: 346_032 },
];

// Heads for the code-unit sweep: every UTF-16 code unit put at every place of each (inserted, and in place of the character there). The first reaches the lookbehind (a unit before the `@`), each letter of a kind, the
// dash, the first id character, a separator and the last; the second a blank before the `@`, a two-letter kind and a trailing `_`.
const HEADS = ["@fig-a.b", " @eq-a:b_"];

// A seeded sample of longer lines: 0 to 14 pieces. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 100_000;
const SEED = 3370;
const PIECES = ["@", "@fig-", "@sec-", "@eq-", "@tbl-", "@lst-", "a", "b1", "_", ".", ":", "-", "..", "/", "#", " ", ",", "(", ")", "\u00e9", "\u65e5", ASTRAL_LETTER, HIGH, LOW, EMOJI, "\u0663", "x@", "fig-", "\u0301", "a.b", "@fig-a.b", "-@sec-x", "%", "&", "$"];
function* seededLines(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let line = "";
    const parts = Math.floor(next() * 15);
    for (let part = 0; part < parts; part++) {
      line += PIECES[Math.floor(next() * PIECES.length)];
    }
    yield line;
  }
}

/** Every ASCII character at every place of each head (inserted, and in place of the character there): `everyCodeUnitEdit` restricted to the first 128 units, whose counts a Python port can recount exactly. */
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

// What each line is, stated by hand: the id under the cursor at a column.
const STATED: Array<[string, number, string | null]> = [
  ["@fig-a", 0, "fig-a"],
  ["@fig-a", 6, "fig-a"], // one past the last character still counts
  ["@fig-a", 7, null],
  ["@fig-a", -1, null],
  ["@fig-a", Number.NaN, null],
  ["", 0, null],
  ["@", 0, null],
  ["see @fig-a.", 3, null], // before the `@`
  ["see @fig-a.", 4, "fig-a"],
  ["see @fig-a.", 10, "fig-a"], // on the full stop that is no part of the id
  ["see @fig-a.", 11, null],
  ["user@fig-x.org", 5, null], // an email address, not a reference
  ["_@fig-a", 1, null],
  ["9@fig-a", 1, null],
  ["Z@fig-a", 1, null],
  ["\u00e9@fig-a", 1, "fig-a"], // the lookbehind is the ASCII class only
  ["\u65e5@fig-a", 1, "fig-a"],
  ["-@fig-a", 1, "fig-a"],
  [".@fig-a", 1, "fig-a"],
  ["@fig-", 1, null], // no id follows
  ["@fig-.a", 1, null], // the follower rule on the kind's own dash
  ["@fig--a", 1, null],
  ["@fig-a..b", 1, "fig-a"], // a doubled run breaks the token
  ["@fig-a.b", 1, "fig-a.b"],
  ["@fig-a.b.", 1, "fig-a.b"],
  ["@fig-a-", 1, "fig-a"],
  ["@fig-a_", 1, "fig-a_"],
  ["@fig-a:b", 1, "fig-a:b"],
  ["@fig-a::b", 1, "fig-a"],
  ["@sec-\u00e9\u65e5", 2, "sec-\u00e9\u65e5"],
  ["@fig-a@fig-b", 6, "fig-a"], // the second `@` follows a letter: an email shape, not a usage
  ["@fig-a@fig-b", 8, null],
  ["@fig-a @fig-b", 6, "fig-a"], // the first usage ends where the blank is, and wins the shared column
  ["@fig-a @fig-b", 7, "fig-b"],
  ["@fig-a @fig-b", 13, "fig-b"],
  ["@Fig-a", 1, null], // the kinds are lower case
  ["@figs-a", 1, null],
  ["@fi-a", 1, null],
  ["@fig_a", 1, null],
  ["@eq-a", 1, "eq-a"],
  ["@lst-a", 1, "lst-a"],
  ["@tbl-a", 1, "tbl-a"],
  ["@sec-a", 1, "sec-a"],
  ["@cor-a", 1, null],
  [`@fig-${ASTRAL_LETTER}b`, 1, `fig-${ASTRAL_LETTER}b`],
  [`@fig-a${ASTRAL_LETTER}`, 8, `fig-a${ASTRAL_LETTER}`], // the end is two code units on
  [`@fig-${HIGH}`, 1, null],
  [`@fig-a${HIGH}`, 1, "fig-a"],
  [`@fig-a${LOW}`, 1, "fig-a"],
  [`@fig-a${EMOJI}`, 1, "fig-a"],
  ["@fig-a\u0663", 1, "fig-a\u0663"], // an Arabic-Indic digit is a number
  ["@fig-a\u00b2", 1, "fig-a\u00b2"], // so is a superscript two
  ["@fig-a\u0301", 1, "fig-a"], // a combining mark is neither a letter nor a number
  ["@fig-a,b", 1, "fig-a"],
  ["@fig-a^b", 1, "fig-a"],
  ["@fig-a b", 1, "fig-a"],
  ["@fig-a)b", 1, "fig-a"],
  ["@fig-a\nb", 1, "fig-a"],
  ["@fig-a\tb", 1, "fig-a"],
  ["@fig-a@", 1, "fig-a"],
  ["@@fig-a", 2, "fig-a"], // an `@` before the `@` is no letter, digit or `_`
  ["a @fig-a", 2, "fig-a"],
  ["(@fig-a)", 1, "fig-a"],
  ["[@fig-a]", 1, "fig-a"],
  ["@fig-a]", 1, "fig-a"],
];

describe("Session 337 — refUsageEnd and refIdAt: the loop finds a cross-reference usage where `REF_USAGE` found it", () => {
  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = checkAll(everyString(e.alphabet, e.maxLength), checkLine);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ strings: countStrings(e.alphabet.length, e.maxLength), usages: e.usages, answered: e.answered });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at every place of two near-usage lines", () => {
    const { disagreements, ...counts } = checkAll(everyCodeUnitEdit(HEADS), checkLineAtBoundaries);
    expect(disagreements).toEqual([]);
    expect(counts.strings).toBe(countCodeUnitEdits(HEADS));
    expect(counts.strings).toBe(36 * 0x10000);
    expect(counts.usages).toBeGreaterThan(1_000_000); // which units are letters and numbers is the Unicode version of the Node running the test, so this half is not pinned exactly
  }, HEAVY_ROW_MS);

  // The first 128 units of that sweep, whose class does not depend on a Unicode version: counted exactly, by the Python port as well.
  it("the ASCII half of that sweep: 4,608 lines, counted by the Python port", () => {
    const { disagreements, ...counts } = checkAll(everyAsciiEdit(HEADS), checkLineAtBoundaries);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ strings: 4_608, usages: 2_122, answered: 8_488 });
  });

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = checkAll(seededLines(SEED, SEEDED_COUNT), checkLine);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ strings: SEEDED_COUNT, usages: 58_054, answered: 487_966 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, column, id]) => [`${JSON.stringify(line)} at column ${column}`, id, line, column] as const))("%s answers %j by hand, by the old pattern, by the definition and by refIdAt", (_label, id, line, column) => {
    expect(oldRefIdAt(line, column)).toBe(id);
    expect(definitionRefIdAt(line, column)).toBe(id);
    expect(refIdAt(line, column)).toBe(id);
  });

  // The usage end alone, stated by hand: where the usage whose `@` is at an index ends, or -1 when none starts there (the index is no `@`, is out of range, or the `@` is an email's or has no kind).
  it.each<[string, number, number]>([
    ["@fig-a", 0, 6],
    ["@fig-a.", 0, 6],
    ["@fig-a.b", 0, 8],
    ["@fig-a..b", 0, 6],
    ["x @fig-a.b y", 2, 10],
    ["@fig-a", 1, -1], // not an `@`
    ["@fig-a", -1, -1],
    ["@fig-a", 6, -1],
    ["@fig-a", 100, -1],
    ["", 0, -1],
    ["x@fig-a", 1, -1],
    ["@fig-", 0, -1],
    ["@fig-.", 0, -1],
    ["@fig-a@fig-b", 6, -1],
    [`@fig-a${ASTRAL_LETTER}`, 0, 8],
    [`@fig-a${HIGH}`, 0, 6],
  ])("the usage at %j index %i ends at %i", (line, at, end) => {
    expect(oldUsageEnd(line, at)).toBe(end);
    expect(definitionUsageEnd(line, at)).toBe(end);
    expect(refUsageEnd(line, at)).toBe(end);
  });

  // Every internal-punctuation mark on its own: it joins two regchars, ends the id before a non-regchar, and a doubled mark breaks it.
  it.each(PUNCT.split(""))("the punctuation mark %j joins two letters, and stops before a blank, the end of the line and a second mark", (mark) => {
    const lines = [`@fig-a${mark}b`, `@fig-a${mark} b`, `@fig-a${mark}`, `@fig-a${mark}${mark}b`, `@fig-a${mark}\u00e9`, `@fig-a${mark}${ASTRAL_LETTER}`, `@fig-a${mark}${HIGH}`];
    const ends = lines.map((line) => refUsageEnd(line, 0));
    expect(ends).toEqual(lines.map((line) => oldUsageEnd(line, 0)));
    expect(ends).toEqual(lines.map((line) => definitionUsageEnd(line, 0)));
    expect(ends.slice(0, 1)).toEqual([8]);
    expect(ends.slice(1, 4)).toEqual([6, 6, 6]);
  });

  // The cure itself: a token past the old overflow (8,388,573 repetitions of the group) is read. The old pattern is compared only below that, where it still reads.
  // The old pattern's first throw depends on how the line is stored, not only on its length (bisected at `8ebce73`, a fresh process per probe, the lower bound verified first): 8,388,573 letters on a line
  // of characters up to U+00FF, but 4,194,287 on a line with any character above it (an emoji, `日`, an astral letter), and for the pairs `.a` 4,194,286 against 2,796,191. The runs below stay under the lower figures.
  const SMALL_RUNS = [1, 2, 3, 100, 4_096, 65_536, 1_000_000];
  it.each(SMALL_RUNS)("a token of %i repetitions of a letter, of `.a`, of `:a` and of an astral letter ends where the old pattern did, with and without a tail", (n) => {
    const units: Array<[string, string]> = [["@fig-", "a"], ["@fig-a", ".a"], ["@sec-a", ":a"], ["@fig-", ASTRAL_LETTER]];
    // a long line costs the old pattern 25 ms a read, so the big sizes get fewer tails and columns
    const tails = n > 100_000 ? ["", "..", `.${HIGH}`] : ["", ".", "..", " x", "-", "@fig-b", " @fig-b", `.${HIGH}`];
    for (const [head, run] of units.map(([h, u]) => [h, u.repeat(n)] as const)) {
      for (const tail of tails) {
        const line = head + run + tail;
        const bodyEnd = line.length - tail.length;
        expect(refUsageEnd(line, 0)).toBe(oldUsageEnd(line, 0));
        for (const column of n > 100_000 ? [2, bodyEnd] : [0, 1, 2, head.length + 1, bodyEnd, bodyEnd + 1, line.length, line.length + 1]) {
          expect(refIdAt(line, column)).toBe(oldRefIdAt(line, column));
        }
      }
    }
  }, HEAVY_ROW_MS);

  // The last sizes the old pattern reads: on a line of characters up to U+00FF 8,388,572 letters and 4,194,285 pairs `.a` behind a letter; on a line with a character above it (here the tail `\ufffd`) 4,194,286 and 2,796,190.
  it.each<[string, string, string, number, string]>([
    ["one-byte line, letters", "@fig-", "a", 8_388_572, ""],
    ["one-byte line, pairs", "@fig-a", ".a", 4_194_285, ""],
    ["two-byte line, letters", "@fig-", "a", 4_194_286, "\ufffd"],
    ["two-byte line, pairs", "@fig-a", ".a", 2_796_190, "\ufffd"],
  ])("the longest token the old pattern still reads, %s, ends where it says", (_label, head, unit, n, tail) => {
    const line = head + unit.repeat(n) + tail;
    const bodyEnd = line.length - tail.length;
    expect(oldUsageEnd(line, 0)).toBe(bodyEnd);
    expect(refUsageEnd(line, 0)).toBe(bodyEnd);
    for (const column of [2, bodyEnd, bodyEnd + 1]) {
      expect(refIdAt(line, column)).toBe(oldRefIdAt(line, column));
    }
  }, HEAVY_ROW_MS);

  const LONG_RUNS = [8_388_573, 16_800_000];
  it.each(LONG_RUNS)("a token of %i repetitions is one usage that ends after the last of them, whatever follows", (n) => {
    const letters = "a".repeat(n);
    const line = `@fig-${letters}`;
    expect(refUsageEnd(line, 0)).toBe(line.length);
    expect(refIdAt(line, 2)?.length).toBe(n + 4);
    expect(refIdAt(line, 2) === `fig-${letters}`).toBe(true);
    expect(refIdAt(line, line.length)?.length).toBe(n + 4);
    expect(refIdAt(line, line.length + 1)).toBeNull();
    expect(refUsageEnd(`${line}.`, 0)).toBe(line.length); // the full stop has no letter after it
    expect(refUsageEnd(`${line}.b`, 0)).toBe(line.length + 2);
    expect(refUsageEnd(`${line}..b`, 0)).toBe(line.length);
    expect(refUsageEnd(`${line} @fig-b`, 0)).toBe(line.length);
    expect(refIdAt(`${line} @fig-b`, line.length + 5)).toBe("fig-b");
    expect(refUsageEnd(`x${line}`, 1)).toBe(-1); // an email shape never reads the run
    expect(refUsageEnd(`@fig-.${letters}`, 0)).toBe(-1);
    expect(refUsageEnd(`@fig-${ASTRAL_LETTER.repeat(Math.floor(n / 2))}`, 0)).toBe(5 + 2 * Math.floor(n / 2));
  }, HEAVY_ROW_MS);

  it.each([4_194_286, 8_400_000])("a token of %i pairs `.a` ends after the last pair, and a doubled mark at the end stops it", (n) => {
    const line = `@fig-a${".a".repeat(n)}`;
    expect(refUsageEnd(line, 0)).toBe(line.length);
    expect(refIdAt(line, 3)?.length).toBe(5 + 2 * n);
    expect(refUsageEnd(`${line}.`, 0)).toBe(line.length);
    expect(refUsageEnd(`${line}..`, 0)).toBe(line.length);
    expect(refUsageEnd(`@fig-a${":a".repeat(n)}::`, 0)).toBe(6 + 2 * n);
  }, HEAVY_ROW_MS);

  it("a token of 45,000,000 letters (a line of 45 million characters) is read in linear time", () => {
    const line = `@fig-${"a".repeat(45_000_000)}`;
    const started = Date.now();
    expect(refUsageEnd(line, 0)).toBe(line.length);
    expect(refIdAt(line, 10)?.length).toBe(line.length - 1);
    expect(Date.now() - started).toBeLessThan(3000);
  }, HEAVY_ROW_MS);

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a reader that never finds a usage disagrees with the old pattern, one that is the old pattern does not, and the loop
  // counts what it was given.
  it("reports a disagreement against a wrong reader, none against the old pattern, and counts every line it was given", () => {
    const never: Reader = { usageEnd: () => -1, idAt: () => null };
    const old: Reader = { usageEnd: oldUsageEnd, idAt: oldRefIdAt };
    const wrong = checkAll(everyString(["@", "fig-", "a"], 3), (line, tally) => checkLine(line, tally, never));
    expect(wrong.strings).toBeLessThan(countStrings(3, 3)); // it stops at five disagreements
    expect(wrong.disagreements.length).toBe(5);
    const right = checkAll(everyString(["@", "fig-", "a"], 3), (line, tally) => checkLine(line, tally, old));
    expect(right.disagreements).toEqual([]);
    expect(right.strings).toBe(countStrings(3, 3));
    const boundaries = checkAll(everyString(["@", "fig-", "a"], 3), (line, tally) => checkLineAtBoundaries(line, tally, old));
    expect(boundaries.disagreements).toEqual([]);
    expect(boundaries.strings).toBe(countStrings(3, 3));
  });
});
