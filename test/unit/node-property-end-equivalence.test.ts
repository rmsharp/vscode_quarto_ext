import { describe, expect, it } from "vitest";
import { nodePropertyEnd } from "../../src/core/qmd/model";
import { LS, NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 335 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (6). The text after the node properties (`&anchor`, `!tag`) of a YAML value was
// found with `armToken.replace(/^(?:[&!][^\s,[\]{}]*[ \t]*)+/, "")` at four sites (the cell option reader in `qmd/model.ts`, the two front matter enumerators, the project file reader), and V8 keeps one entry of its
// regex backtrack stack per repetition of a group: a value of 2,097,144 or more properties threw `RangeError: Maximum call stack size exceeded` (bisected at `c06ee06`), and the error reached every reader of the
// document. `nodePropertyEnd` is the same question read by a loop. The old pattern is kept below, copied from the parent `c06ee06`, as the oracle (Learning 738), beside a reading by definition that uses no regex;
// the pinned counts come from the old pattern and from a Python port of it (with `\s` spelled out as ECMAScript's set, which Python's is not) and never from the code under test.

// ---- The OLD pattern, copied from the parent `c06ee06`. ----
const OLD_NODE_PROPERTIES = /^(?:[&!][^\s,[\]{}]*[ \t]*)+/;
const oldEnd = (token: string): number => OLD_NODE_PROPERTIES.exec(token)?.[0].length ?? 0;
const oldStrip = (token: string): string => token.replace(OLD_NODE_PROPERTIES, "");

// ---- A reading of the old pattern by DEFINITION, with no regular expression: a property is `&` or `!`, a name up to the first stop (white space as the specification lists it, or one of `,[]{}`) and the blanks after
// it; the properties are as many as follow one another from the start. ----
const SPACE = new Set<number>([9, 10, 11, 12, 13, 32, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff, ...Array.from({ length: 11 }, (_, i) => 0x2000 + i)]);
const STOPS = new Set<number>([44, 91, 93, 123, 125]);
function definitionEnd(token: string): number {
  let at = 0;
  while (token[at] === "&" || token[at] === "!") {
    at++;
    while (at < token.length && !SPACE.has(token.charCodeAt(at)) && !STOPS.has(token.charCodeAt(at))) {
      at++;
    }
    while (token[at] === " " || token[at] === "\t") {
      at++;
    }
  }
  return at;
}

type Count = { compared: number; stripped: number; charactersStripped: number; disagreements: string[] };
/** Compare the new function with the old pattern and the reading by definition over `tokens`: how many were compared, in how many the old pattern stripped something, how many characters it stripped in all. */
function compareAll(tokens: Iterable<string>): Count {
  const count: Count = { compared: 0, stripped: 0, charactersStripped: 0, disagreements: [] };
  for (const token of tokens) {
    const expected = oldEnd(token);
    count.compared++;
    if (expected > 0) {
      count.stripped++;
      count.charactersStripped += expected;
    }
    const now = nodePropertyEnd(token);
    const byDefinition = definitionEnd(token);
    if ((now !== expected || byDefinition !== expected || token.slice(now) !== oldStrip(token)) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(token)}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

const WIDE = ["&", "!", "a", " ", "\t", ",", "[", "]", "{", "}", "'", '"', NBSP, "\r", LS, "x"];
const NARROW = ["&", "!", "a", " ", "[", "\t"];
const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; stripped: number; charactersStripped: number }> = [
  { label: "16 characters (`&`, `!`, a name, blanks, the four brackets, quotes, a no-break space, CR, U+2028), up to 5", alphabet: WIDE, maxLength: 5, stripped: 139_810, charactersStripped: 258_594 },
  { label: "6 characters (`&`, `!`, a name, a blank, `[`, a tab), up to 8", alphabet: NARROW, maxLength: 8, stripped: 671_846, charactersStripped: 2_653_992 },
];

// Every UTF-16 code unit in the four places a character can sit: at the start (where it must be `&` or `!`), as the first character of a name, inside one, and right after one (where it is a stop or a name character).
function* everyCodeUnit(): Generator<string> {
  for (let code = 0; code < 0x10000; code++) {
    const c = String.fromCharCode(code);
    yield c + "&a";
    yield "&" + c + "b";
    yield "&a" + c + "&b";
    yield "&a " + c + "b";
    yield "!t\t" + c + "&u";
  }
}

// A seeded sample of longer tokens: 0 to 12 pieces. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3354;
const PIECES = ["&a", "!t", "&", "!", " ", "\t", "[", "{", "]", "}", ",", "'", '"', "x", "y z", NBSP, LS, "\r", "&a'b", "*a", "a&b", "!!", "&&"];
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

// What each token is, stated by hand: the end of its node properties.
const STATED: Array<[string, number]> = [
  ["", 0],
  ["x", 0],
  ["&", 1],
  ["&a", 2],
  ["&a ", 3],
  ["&a b", 3],
  ["&a &b c", 6],
  ["&a\tb", 3],
  ["&a[one,", 2],
  ["&a {one:", 3],
  ["&a{x", 2],
  ["&a,b", 2],
  ["&a]", 2],
  ["&a}", 2],
  ["&a'b", 4],
  ["&a'b'", 5],
  ['&a"b', 4],
  ["!t", 2],
  ["!!t", 3],
  ["&&a", 3],
  ["&a&b", 4],
  ["&a !b[x", 5],
  ["& a", 2],
  ["&  a", 3],
  ["&a" + NBSP + "b", 2],
  ["&a" + LS + "b", 2],
  ["&a\rb", 2],
  ["&a\vb", 2],
  [" &a", 0],
  ["*a", 0],
  ["[&a]", 0],
  ["&a #c", 3],
];

describe("Session 335 — nodePropertyEnd: the loop finds the end of the node properties where `^(?:[&!][^\\s,[\\]{}]*[ \\t]*)+` did", () => {
  it.each(ENUMERATIONS.map((e) => [`every token of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(everyString(e.alphabet, e.maxLength));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countStrings(e.alphabet.length, e.maxLength), stripped: e.stripped, charactersStripped: e.charactersStripped });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at the start, at the head of a name, inside one, after one and after a blank", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnit());
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: 5 * 0x10000, stripped: 262_146, charactersStripped: 917_386 });
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded tokens (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, stripped: 84_023, charactersStripped: 681_603 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([token, end]) => [JSON.stringify(token), token, end] as const))("%s ends its node properties at %i by hand, by the old pattern, by the definition and by the new function", (_label, token, end) => {
    expect(oldEnd(token)).toBe(end);
    expect(definitionEnd(token)).toBe(end);
    expect(nodePropertyEnd(token)).toBe(end);
    expect(token.slice(nodePropertyEnd(token))).toBe(oldStrip(token));
  });

  // The cure itself: a value past the old overflow (2,097,144 properties) is read. The old pattern is compared only below that, where it still reads.
  const SMALL_RUNS = [1, 2, 3, 100, 4_096, 65_536, 1_000_000, 2_000_000];
  const LONG_RUNS = [2_097_144, 2_100_000, 4_200_000, 45_000_000];
  it.each(SMALL_RUNS)("a value of %i properties `&a ` and of `!t ` ends where the old pattern did, with and without a tail", (n) => {
    for (const unit of ["&a ", "!t "]) {
      for (const tail of ["", "x", "[one,", "{", "'", "&", "  y"]) {
        const token = unit.repeat(n) + tail;
        expect(nodePropertyEnd(token)).toBe(oldEnd(token));
      }
    }
  }, HEAVY_ROW_MS);

  it.each(LONG_RUNS)("a value of %i properties ends after the last one, whatever follows", (n) => {
    expect(nodePropertyEnd("&a ".repeat(n))).toBe(3 * n);
    expect(nodePropertyEnd("!t ".repeat(n) + "x")).toBe(3 * n);
    expect(nodePropertyEnd("&a ".repeat(n) + "[one,")).toBe(3 * n);
    expect(nodePropertyEnd("&a ".repeat(n) + "'b")).toBe(3 * n);
    expect(nodePropertyEnd("&a".repeat(n))).toBe(2 * n); // no blank between them: one property whose name holds every `&`
    expect(nodePropertyEnd("x" + "&a ".repeat(n))).toBe(0);
    expect(nodePropertyEnd("&a ".repeat(n) + "!")).toBe(3 * n + 1);
  }, HEAVY_ROW_MS);

  it("a value of 45,000,000 properties is read in linear time (the token is 135 million characters)", () => {
    const token = "&a ".repeat(45_000_000);
    const started = Date.now();
    expect(nodePropertyEnd(token)).toBe(token.length);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

// The review round of Session 335 (its mutation lens): a property followed by more than 4,096 blanks and then a flow opener survived every row above (the cell option reader then sees the opener, `&a` and 5,000 blanks
// and `[one,`, and the option's continuation line is not an option line of its own). The old pattern reads a plain class there, so it still answers at every size and is compared.
describe("Session 335 review — a property followed by a long run of blanks", () => {
  it.each([4_097, 5_000, 70_000, 4_300_000])("%i blanks after a property end where the old pattern did, whatever follows", (n) => {
    for (const blank of [" ", "\t"]) {
      for (const tail of ["", "[x", "{", "'a", "x", "&b", "!t " + blank.repeat(3) + "y", "," + blank]) {
        const token = "&a" + blank.repeat(n) + tail;
        expect(nodePropertyEnd(token)).toBe(oldEnd(token));
        expect(nodePropertyEnd(token)).toBe(definitionEnd(token));
      }
    }
    expect(nodePropertyEnd("&a" + " ".repeat(n) + "[x")).toBe(2 + n);
    expect(nodePropertyEnd("!t" + " ".repeat(n) + "&b" + " ".repeat(n) + "{")).toBe(2 + n + 2 + n);
  });
});
