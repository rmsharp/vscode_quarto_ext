import { describe, expect, it } from "vitest";
import { dashPrefixEnd, jupyterKernelLanguage, readKeyLine } from "../../src/core/qmd/jupyter-kernel";
import { LS, NBSP, PS, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 337 -- the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part (8). The jupyter reader's front matter line `KEY_LINE` read the dash prefix of a line as
// `(?:-[ \t]+)*`, and so did the `replace` that strips the same prefix when the line has no value (`leavesOpen`). V8 keeps one entry of its regex backtrack stack per repetition of a group, so a line of 3,355,428 or
// more `- ` threw `RangeError: Maximum call stack size exceeded` (bisected at `8ebce73`, a fresh process per probe), and the error reached every reader of a document the engine resolver calls jupyter.
// `dashPrefixEnd` and `readKeyLine` are the same two questions read by a loop. The old patterns are kept below, copied from the parent `8ebce73`, as the oracle (Learning 738), beside a reading by definition that uses
// no regular expression and tries every way of cutting a line into prefix, key, gap and rest; the pinned counts come from the old patterns and from a Python port of the definition (no code shared with the
// TypeScript, run with `python3 -I`) and never from the code under test.

// ---- The OLD patterns, copied from the parent `8ebce73` (`KEY_LINE` in `jupyter-kernel.ts`, and the `replace` in `leavesOpen`). ----
const OLD_KEY_LINE = /^[ \t]*(?:-[ \t]+)*(?:"[^"\\]*"|'[^']*'|[A-Za-z0-9_](?:[A-Za-z0-9_. -]*[A-Za-z0-9_.-])?)[ \t]*:(?:[ \t]+(?![ \t])(.*)|)$/;
const OLD_PREFIX = /^[ \t]*(?:-[ \t]+)*/;
type Read = { value: string | undefined } | null;
const oldRead = (line: string): Read => {
  const m = OLD_KEY_LINE.exec(line);
  return m === null ? null : { value: m[1] };
};
const oldStrip = (line: string): string => line.replace(OLD_PREFIX, "");

// ---- A reading of the old patterns by DEFINITION, with no regular expression. A line is a key line when it can be cut into a PREFIX (blanks, then any number of a dash and the blanks behind it), a KEY (double quoted
// without a backslash, single quoted, or plain: a first character of [A-Za-z0-9_] and, after it, characters of [A-Za-z0-9_. -] that end on one of [A-Za-z0-9_.-]), a GAP of blanks, a colon and a REST that is nothing,
// or blanks and then text without a line terminator. Every cut is tried; the value is what comes after the colon's blank run, and every cut that works must agree on it. ----
const WORD = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_");
const isBlank = (c: string | undefined): boolean => c === " " || c === "\t";
const isLineEnd = (c: string): boolean => c === "\n" || c === "\r" || c === LS || c === PS;
function isPrefix(text: string): boolean {
  let at = 0;
  while (isBlank(text[at])) at++;
  while (at < text.length) {
    if (text[at] !== "-") return false;
    at++;
    if (!isBlank(text[at])) return false;
    while (isBlank(text[at])) at++;
  }
  return true;
}
function isKey(text: string): boolean {
  if (text.length >= 2 && text[0] === '"') {
    return text[text.length - 1] === '"' && !text.slice(1, -1).includes('"') && !text.slice(1, -1).includes("\\");
  }
  if (text.length >= 2 && text[0] === "'") {
    return text[text.length - 1] === "'" && !text.slice(1, -1).includes("'");
  }
  if (text.length === 0 || !WORD.has(text[0])) return false;
  if (text.length === 1) return true;
  const last = text[text.length - 1];
  if (!(WORD.has(last) || last === "." || last === "-")) return false;
  for (let i = 1; i < text.length - 1; i++) {
    const c = text[i];
    if (!(WORD.has(c) || c === "." || c === " " || c === "-")) return false;
  }
  return true;
}
function definitionRead(line: string): Read {
  const outcomes = new Set<string>(); // "u" for no value, "v:" + value otherwise
  for (let p = 0; p <= line.length; p++) {
    if (!isPrefix(line.slice(0, p))) continue;
    for (let k = p + 1; k <= line.length; k++) {
      if (!isKey(line.slice(p, k))) continue;
      let c = k;
      while (isBlank(line[c])) c++;
      if (line[c] !== ":") continue;
      const rest = line.slice(c + 1);
      if (rest === "") {
        outcomes.add("u");
      } else if (isBlank(rest[0])) {
        let r = 0;
        while (isBlank(rest[r])) r++;
        const text = rest.slice(r);
        if (![...text].some(isLineEnd)) outcomes.add("v:" + text);
      }
    }
  }
  if (outcomes.size > 1) throw new Error(`more than one reading of ${JSON.stringify(line)}: ${[...outcomes]}`);
  if (outcomes.size === 0) return null;
  const [only] = [...outcomes];
  return { value: only === "u" ? undefined : only.slice(2) };
}
/** The longest prefix of the language `[ \t]*(?:-[ \t]+)*` that `line` starts with. */
function definitionPrefixEnd(line: string): number {
  let best = 0;
  for (let p = 0; p <= line.length; p++) {
    if (isPrefix(line.slice(0, p))) best = p;
  }
  return best;
}

const sameRead = (a: Read, b: Read): boolean => (a === null || b === null ? a === b : a.value === b.value);
const show = (r: Read): string => (r === null ? "no match" : r.value === undefined ? "no value" : JSON.stringify(r.value));

type Count = { compared: number; matched: number; valued: number; prefixChars: number; disagreements: string[] };
/** Compare the two functions with the old patterns (and, when asked, the reading by definition) over `lines`: how many were compared, how many the old pattern matched, how many of those it gave a value (group 1 set), and the characters its prefix strip removed. */
function compareAll(lines: Iterable<string>, byDefinition: boolean): Count {
  const count: Count = { compared: 0, matched: 0, valued: 0, prefixChars: 0, disagreements: [] };
  for (const line of lines) {
    const expected = oldRead(line);
    const expectedEnd = line.length - oldStrip(line).length;
    count.compared++;
    if (expected !== null) {
      count.matched++;
      if (expected.value !== undefined) count.valued++;
    }
    count.prefixChars += expectedEnd;
    const now = readKeyLine(line);
    const nowEnd = dashPrefixEnd(line);
    const def = byDefinition ? definitionRead(line) : expected;
    const defEnd = byDefinition ? definitionPrefixEnd(line) : expectedEnd;
    if ((!sameRead(now, expected) || nowEnd !== expectedEnd || !sameRead(def, expected) || defEnd !== expectedEnd) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: old ${show(expected)} / ${expectedEnd}, now ${show(now)} / ${nowEnd}, by definition ${show(def)} / ${defEnd}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

// k stands for the key class; the others are the grammar's own marks, a no-break space, CR, LF, U+2028, U+2029 and a lone backslash as foils.
const WIDE = ["k", "-", " ", "\t", ":", '"', "'", "\\", "\r"];
const DENSE = ["k", "-", " ", ":", "\t"];
const QUOTES = ['"', "'", "k", ":", " ", "\\", "-"];
const FOILS = ["k", "_", "9", ".", "-", " ", ":", "!", NBSP];
const AFTER_COLON = [" ", "\t", "x", "\r", LS, PS, "\n", ":"];
const AFTER_HEADS = ["k:", "- k:", "k: ", '"k":'];
type Enumeration = { label: string; alphabet: readonly string[]; maxLength: number; heads?: readonly string[]; matched: number; valued: number; prefixChars: number };
const ENUMERATIONS: Enumeration[] = [
  { label: "9 characters (a key character, `-`, a blank, a tab, `:`, both quotes, a backslash, CR), up to 7", alphabet: WIDE, maxLength: 7, matched: 52283, valued: 35908, prefixChars: 1939850 },
  { label: "5 characters dense in key lines (a key character, `-`, a blank, `:`, a tab), up to 9", alphabet: DENSE, maxLength: 9, matched: 246543, valued: 221078, prefixChars: 2613094 },
  { label: "7 characters dense in quoted keys (both quotes, a key character, `:`, a blank, a backslash, `-`), up to 7", alphabet: QUOTES, maxLength: 7, matched: 12812, valued: 8603, prefixChars: 210885 },
  { label: "9 characters at the edges of the key class (a key character, `_`, `9`, `.`, `-`, a blank, `:`, `!`, a no-break space), up to 6", alphabet: FOILS, maxLength: 6, matched: 12270, valued: 6492, prefixChars: 92618 },
  { label: "four heads (`k:`, `- k:`, `k: `, `\"k\":`) and then 8 characters (a blank, a tab, `x`, CR, U+2028, U+2029, LF, `:`), up to 6", alphabet: AFTER_COLON, maxLength: 6, heads: AFTER_HEADS, matched: 13654, valued: 13651, prefixChars: 599186 },
];
function* enumerated(e: Enumeration): Generator<string> {
  for (const head of e.heads ?? [""]) {
    for (const rest of everyString(e.alphabet, e.maxLength)) {
      yield head + rest;
    }
  }
}

// Every UTF-16 code unit at every place of a line that is, or nearly is, a key line, in place of each character and between them.
const HEADS = ["- k: v", " - - k :", '"k" : v', "'k': v", "a-b.1 :\tv", "k:", "k:  "];

// A seeded sample: 0 to 3 prefix pieces, a key (one or two pieces), a gap, a colon (nine times in ten), a blank piece and 0 to 2 pieces of value. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3371;
const LEAD_PIECES = ["", " ", "  ", "\t", "- ", "-\t", "-  ", "-", " - ", "- - ", "--", "-\u00a0"];
const KEY_PIECES = ["k", "key", "a b", "a  b", "a.b", "a-b", "a_1", "9", "_", "k ", "k\t", ".k", "-k", "k.", "k-", '"k"', "'k'", "\"k'", "'k\"", '"a b"', '"a\\"b"', "'a\\'", '""', "''", '"a:b"', "\u00e9", "k!", '"', "'"];
const GAPS = ["", "", " ", "\t", "  ", " \t "];
const BLANK_PIECES = ["", " ", " ", "\t", "  ", " \t", "x", "\r", LS, "\u00a0"];
const VALUE_PIECES = ["", "v", "a b", "[a", '"q', " ", "\t", "\r", LS, PS, "\n", "x\ry", "# c", "{a: b}", ":", "- x", "\u00a0"];
function* seededLines(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  const pick = (pieces: readonly string[]): string => pieces[Math.floor(next() * pieces.length)];
  for (let i = 0; i < count; i++) {
    let line = "";
    const leads = Math.floor(next() * 4);
    for (let part = 0; part < leads; part++) {
      line += pick(LEAD_PIECES);
    }
    line += pick(KEY_PIECES);
    if (next() < 0.25) {
      line += pick(KEY_PIECES);
    }
    line += pick(GAPS);
    if (next() < 0.9) {
      line += ":";
    }
    line += pick(BLANK_PIECES);
    const values = Math.floor(next() * 3);
    for (let part = 0; part < values; part++) {
      line += pick(VALUE_PIECES);
    }
    yield line;
  }
}

// What each line is, stated by hand: [line, the value after the colon (undefined for none), or null for a line that is no key line], and where the dash prefix ends.
const STATED: Array<[string, Read, number]> = [
  ["", null, 0],
  ["k:", { value: undefined }, 0],
  ["k: v", { value: "v" }, 0],
  ["k:  v w ", { value: "v w " }, 0],
  ["k: ", { value: "" }, 0],
  ["k:\t", { value: "" }, 0],
  ["k: \t", { value: "" }, 0],
  ["k:v", null, 0],
  ["k :", { value: undefined }, 0],
  ["k \t: v", { value: "v" }, 0],
  ["k\t : v", { value: "v" }, 0],
  ["k\tm: v", null, 0],
  ["- k: v", { value: "v" }, 2],
  ["-\tk: v", { value: "v" }, 2],
  ["-  k: v", { value: "v" }, 3],
  ["- - k: v", { value: "v" }, 4],
  ["  - - k: v", { value: "v" }, 6],
  ["\t- k:", { value: undefined }, 3],
  ["-k: v", null, 0],
  ["- -k: v", null, 2],
  ["-", null, 0],
  ["- ", null, 2],
  ["- - ", null, 4],
  ["--", null, 0],
  ["- k", null, 2],
  ["  ", null, 2],
  ["a b: v", { value: "v" }, 0],
  ["a  b.c-d: v", { value: "v" }, 0],
  ["a b : v", { value: "v" }, 0],
  ["a- : v", { value: "v" }, 0],
  [" a: v", { value: "v" }, 1],
  ["-a: v", null, 0],
  ["_: v", { value: "v" }, 0],
  ["9: v", { value: "v" }, 0],
  [".a: v", null, 0],
  ["a.: v", { value: "v" }, 0],
  ["a:b: v", null, 0],
  ["a::", null, 0],
  ['"k": v', { value: "v" }, 0],
  ['"k" : v', { value: "v" }, 0],
  ['"a b: c": v', { value: "v" }, 0],
  ['"a\\"b": v', null, 0],
  ['"a\\b": v', null, 0],
  ['"": v', { value: "v" }, 0],
  ['"k: v', null, 0],
  ["'k': v", { value: "v" }, 0],
  ["'a\\'b': v", null, 0],
  ["'a\\': v", { value: "v" }, 0],
  ["'': v", { value: "v" }, 0],
  ["'k: v", null, 0],
  ["- \"k\": v", { value: "v" }, 2],
  ["- 'k':", { value: undefined }, 2],
  ["k: v\r", null, 0],
  ["k: \r", null, 0],
  ["k:\r", null, 0],
  ["k: v" + LS, null, 0],
  ["k: " + PS + "v", null, 0],
  ["k: v\nw", null, 0],
  ["k: x\ry", null, 0],
  ["k:" + NBSP, null, 0],
  ["k:" + NBSP + "v", null, 0],
  ["k: " + NBSP, { value: NBSP }, 0],
  ["k: [a", { value: "[a" }, 0],
  ['k: "a', { value: '"a' }, 0],
  ["k: # c", { value: "# c" }, 0],
  ["k: - x", { value: "- x" }, 0],
  ["k: v:", { value: "v:" }, 0],
  ["-\u00a0k: v", null, 0],
  ["\u00a0k: v", null, 0],
  ["\rk: v", null, 0],
  ["é: v", null, 0],
  ["k!: v", null, 0],
];

describe("Session 337 -- readKeyLine and dashPrefixEnd: the loop reads the line where `KEY_LINE` and `^[ \\t]*(?:-[ \\t]+)*` did", () => {
  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(enumerated(e), true);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: (e.heads?.length ?? 1) * countStrings(e.alphabet.length, e.maxLength), matched: e.matched, valued: e.valued, prefixChars: e.prefixChars });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at every place of seven near-key lines", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnitEdit(HEADS), false);
    expect(disagreements).toEqual([]);
    expect(counts.compared).toBe(countCodeUnitEdits(HEADS));
    expect(counts).toEqual({ compared: 5_963_776, matched: 1_378_546, valued: 1_377_619, prefixChars: 4_522_128 });
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededLines(SEED, SEEDED_COUNT), true);
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, matched: 44_359, valued: 40_260, prefixChars: 588_242 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, read, end]) => [JSON.stringify(line), line, read, end] as const))("%s is, by hand, by the old patterns, by the definition and by the new functions: %j, prefix to %i", (_label, line, read, end) => {
    expect(oldRead(line)).toEqual(read);
    expect(definitionRead(line)).toEqual(read);
    expect(readKeyLine(line)).toEqual(read);
    expect(line.length - oldStrip(line).length).toBe(end);
    expect(definitionPrefixEnd(line)).toBe(end);
    expect(dashPrefixEnd(line)).toBe(end);
  });
});

// The cure itself. Below the old overflow (3,355,428 repetitions of a dash and a blank) the old patterns still read, so the functions are compared with them on runs up to 3,000,000; past it the old patterns THROW
// (the first test below says so on this machine) and the answer is the one the definition gives, stated by hand: the dash run changes nothing about the language.
const UNITS = ["- ", "-\t", "-  "];
const LEADS = ["", "  ", "\t"];
const TAILS = ["k: v", "k:", "k: ", "k:v", "", "!", " ", "- ", "k", '"k": v', "k: \r", "k: [a", "-k: v", "-"];
describe("Session 337 -- a prefix of millions of dashes", () => {
  const SMALL: Array<{ n: number; units: readonly string[]; leads: readonly string[]; tails: readonly string[] }> = [
    { n: 1, units: UNITS, leads: LEADS, tails: TAILS },
    { n: 2, units: UNITS, leads: LEADS, tails: TAILS },
    { n: 100, units: UNITS, leads: LEADS, tails: TAILS },
    { n: 4_096, units: UNITS, leads: LEADS, tails: TAILS },
    { n: 65_536, units: UNITS, leads: LEADS, tails: TAILS },
    { n: 1_000_000, units: ["- "], leads: ["", "  "], tails: TAILS },
    { n: 3_000_000, units: ["- "], leads: [""], tails: ["k: v", "k:", "", "!", "k: [a"] },
  ];
  it.each(SMALL.map((row) => [row.n, row] as const))("%i dashes and blanks, behind every lead and in front of every tail, are read where the old patterns read them", (_n, row) => {
    for (const unit of row.units) {
      const run = unit.repeat(row.n);
      for (const lead of row.leads) {
        for (const tail of row.tails) {
          const line = lead + run + tail;
          const expected = oldRead(line);
          expect(show(readKeyLine(line))).toBe(show(expected));
          expect(dashPrefixEnd(line)).toBe(line.length - oldStrip(line).length);
        }
      }
    }
  }, HEAVY_ROW_MS);

  it("the old pattern throws RangeError on this machine from 3,355,428 repetitions, and the strip pattern from 3,355,430: the sizes below are past it", () => {
    expect(() => OLD_KEY_LINE.test("- ".repeat(6_800_000) + "k: v")).toThrow(RangeError);
    expect(() => OLD_KEY_LINE.test("- ".repeat(6_800_000))).toThrow(RangeError);
    expect(() => oldStrip("  " + "- ".repeat(6_800_000))).toThrow(RangeError);
    expect(OLD_KEY_LINE.test("- ".repeat(3_000_000) + "k: v")).toBe(true);
  }, HEAVY_ROW_MS);

  // What each tail makes of a line that follows the run, by hand. A dash with no blank behind it ends the prefix before itself, so `-k: v` and `-` end it where the run ends.
  const LONG_TAILS: Array<[string, Read]> = [
    ["k: v", { value: "v" }],
    ["k:", { value: undefined }],
    ["k: ", { value: "" }],
    ["k:v", null],
    ["", null],
    ["!", null],
    ["k", null],
    ['"k" : v', { value: "v" }],
    ["'k': [a", { value: "[a" }],
    ["k: \r", null],
    ["k: v" + LS, null],
    ["a b.c-d : x y", { value: "x y" }],
    ["-k: v", null],
    ["-", null],
  ];
  const LONG: Array<{ n: number; units: readonly string[]; leads: readonly string[]; tails: number }> = [
    { n: 3_355_428, units: ["- "], leads: [""], tails: 14 },
    { n: 3_355_428, units: ["- "], leads: ["  ", "\t"], tails: 3 },
    { n: 3_355_428, units: ["-\t", "-  "], leads: [""], tails: 4 },
    { n: 3_400_000, units: ["- "], leads: ["\t"], tails: 5 },
    { n: 6_800_000, units: ["- "], leads: [""], tails: 5 },
    { n: 17_000_000, units: ["- "], leads: [""], tails: 3 },
  ];
  it.each(LONG.map((row) => [`${row.n} x ${JSON.stringify(row.units)} behind ${JSON.stringify(row.leads)}`, row] as const))("%s repetitions are read, whatever follows", (_label, row) => {
    for (const unit of row.units) {
      const run = unit.repeat(row.n);
      for (const lead of row.leads) {
        for (const [tail, read] of LONG_TAILS.slice(0, row.tails)) {
          const line = lead + run + tail;
          expect(readKeyLine(line)).toEqual(read);
          expect(dashPrefixEnd(line)).toBe(lead.length + run.length);
        }
      }
    }
  }, HEAVY_ROW_MS);

  // The functions read a line in one pass whatever its shape. A pattern with a key class that overlaps the blanks, or one that tries the prefix again from each dash, is quadratic on some of these.
  it("a line of 4,000,000 to 20,000,000 characters of any of eleven shapes is read in linear time", () => {
    const started = Date.now();
    const shapes: Array<[string, Read]> = [
      ["- ".repeat(2_000_000) + "k: v", { value: "v" }],
      ["- ".repeat(2_000_000), null],
      [" ".repeat(4_000_000) + "k: v", { value: "v" }],
      ["k" + " ".repeat(4_000_000) + ": v", { value: "v" }],
      ["k" + " ".repeat(4_000_000) + "x: v", { value: "v" }],
      ["k" + " ".repeat(4_000_000) + "\tx: v", null],
      ["k".repeat(20_000_000) + ": v", { value: "v" }],
      ["k".repeat(20_000_000) + "!", null],
      ['"' + "k".repeat(20_000_000), null],
      ["k:" + " ".repeat(20_000_000) + "\r", null],
      ["k: " + "v".repeat(20_000_000), { value: "v".repeat(20_000_000) }],
    ];
    for (const [line, read] of shapes) {
      expect(show(readKeyLine(line))).toBe(show(read));
    }
    expect(dashPrefixEnd("- ".repeat(2_000_000) + "k: v")).toBe(4_000_000);
    expect(Date.now() - started).toBeLessThan(5000);
  }, HEAVY_ROW_MS);

  // The sizes the rows above are built on. The old patterns read up to 3,000,000 repetitions and throw from 3,355,428, so a "small" run past the first or a "long" run below the second would prove less than the rows say.
  it("keeps the sizes and the shapes the long-run rows are built on", () => {
    expect(SMALL.map((row) => row.n)).toEqual([1, 2, 100, 4_096, 65_536, 1_000_000, 3_000_000]);
    expect(Math.max(...SMALL.map((row) => row.n))).toBeLessThan(3_355_428);
    expect(LONG.map((row) => row.n)).toEqual([3_355_428, 3_355_428, 3_355_428, 3_400_000, 6_800_000, 17_000_000]);
    expect(Math.min(...LONG.map((row) => row.n))).toBeGreaterThanOrEqual(3_355_428);
    expect(LONG.map((row) => row.tails)).toEqual([14, 3, 4, 5, 5, 3]);
    expect(LONG.map((row) => row.units.length * row.leads.length)).toEqual([1, 2, 2, 1, 1, 1]);
    expect(LONG_TAILS.length).toBe(14);
  });
});

// The two callers: `seesThrough` refuses a front matter whose unindented line is no key line, and `leavesOpen` asks every line whether its value opens a quote or a flow collection that the line does not close,
// reading the text after the dash prefix of a line that has no value (a sequence item, `key:` with nothing after it) from `dashPrefixEnd`. [front matter lines, the kernel language]: each answer was given by
// `jupyterKernelLanguage` on the parent `8ebce73` (the lines were run through it, not worked out), so a caller that reads a line differently is seen here and not only in the functions.
const CALLERS: Array<[string[], string | null]> = [
  [["jupyter: python3", "x:", "  - [a"], null],
  [["jupyter: python3", "x:", "  - [a]"], "python"],
  [["jupyter: python3", "x:", '  - "a'], null],
  [["jupyter: python3", "x:", '  - "a"'], "python"],
  [["jupyter: python3", "x:", "  - 'a"], null],
  [["jupyter: python3", "x:", "  - - [a"], null],
  [["jupyter: python3", "x:", "\t- [a"], null],
  [["jupyter: python3", "x:", "  -\t{a: b"], null],
  [["jupyter: python3", "x:", "  - a: [b"], null],
  [["jupyter: python3", "x:", "  - a: [b]"], "python"],
  [["jupyter: python3", "x:", "  - a:"], "python"],
  [["jupyter: python3", "x:", "  - a: "], "python"],
  [["jupyter: python3", "x:", "  - a:b"], "python"],
  [["jupyter: python3", "x:", "  - # [a"], "python"],
  [["jupyter: python3", "x:", "  -"], "python"],
  [["jupyter: python3", "x:", "  - "], "python"],
  [["jupyter: python3", "x:", "  -[a"], null],
  [["jupyter: python3", "- k: v"], "python"],
  [["jupyter: python3", "- - k: v"], "python"],
  [["jupyter: python3", "- k: [a"], null],
  [["jupyter: python3", "-k: v"], null],
  [["jupyter: python3", "k : v"], "python"],
  [["jupyter: python3", '"k": v'], "python"],
  [["jupyter: python3", "'k': v"], "python"],
  [["jupyter: python3", "a b.c-d: v"], "python"],
  [["jupyter: python3", "k:v"], null],
  [["jupyter: python3", "k: v\r"], null],
  [["- k: python3"], "python"],
  [["jupyter: python3", "k:  "], "python"],
  [["jupyter: python3", "  k: v"], "python"],
  [["  jupyter: python3"], null],
];
describe("Session 337 -- the callers of readKeyLine and dashPrefixEnd answer what they answered with the patterns", () => {
  it.each(CALLERS.map(([lines, kernel]) => [JSON.stringify(lines), lines, kernel] as const))("%s has the kernel language %j", (_label, lines, kernel) => {
    expect(jupyterKernelLanguage(lines)).toBe(kernel);
  });
});
