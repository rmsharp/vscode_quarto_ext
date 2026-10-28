import { describe, expect, it } from "vitest";
import { linkAttributesHaveJunk } from "../../src/core/qmd/model";
import { IDEOGRAPHIC, JS_WHITESPACE, LS, NBSP, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 334 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (5).
// `linkDefinitionAt` refuses a link-reference definition whose link ATTRIBUTES have junk after them (`[a]: /u {#id} x`): it asked `/^\S+[ \t]*\{[^}]*\}[ \t]*\S/` of the text after `[a]:`. When that text
// is itself a long run of `{` (a URL of braces) the greedy `\S+` takes the whole run and gives it back one `{` at a time, and each `{` read on to the end of the text looking for a `}`: n squared. It is now
// `linkAttributesHaveJunk`, which finds the first `{` that can open the block (inside the leading run of non-blanks, at index 1 or later, or right after the blanks that follow the run), the first `}` after
// it, and the character after that `}` and its blanks. The first such `{` decides the answer for every later one: a later `{` before the `}` shares the `}`, and one after it would need the `}` to be
// followed by blanks and then more of the run, which is a non-blank right after the `}`. That claim is what the enumerations below test. The old pattern is kept here, copied from the parent `855e0e0`
// (`src/core/qmd/model.ts` before the cure), as the oracle (Learning 738), beside a reading by definition that tries every split of the text and uses no regex; the pinned counts (how many strings
// of each enumeration are TRUE) come from those two and never from the code under test.

// ---- The OLD pattern, copied from the parent `855e0e0`. ----
const OLD_LINK_ATTRIBUTE_JUNK = /^\S+[ \t]*\{[^}]*\}[ \t]*\S/;

// ---- A reading of the old pattern by DEFINITION, with no regular expression: every split of the text into `\S+`, blanks, `{`, a run with no `}`, `}`, blanks and one non-whitespace character. ----
function definitionJunk(rest: string): boolean {
  const n = rest.length;
  const nonSpace = (i: number): boolean => i < n && !JS_WHITESPACE.has(rest[i]);
  const blank = (i: number): boolean => rest[i] === " " || rest[i] === "\t";
  const run = (from: number, to: number, holds: (i: number) => boolean): boolean => {
    for (let i = from; i < to; i++) {
      if (!holds(i)) {
        return false;
      }
    }
    return true;
  };
  for (let m = 1; m <= n; m++) {
    for (let k = m; k < n; k++) {
      for (let j = k + 1; j < n; j++) {
        for (let e = j + 1; e < n; e++) {
          if (run(0, m, nonSpace) && run(m, k, blank) && rest[k] === "{" && run(k + 1, j, (i) => rest[i] !== "}") && rest[j] === "}" && run(j + 1, e, blank) && nonSpace(e)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

type Count = { compared: number; junk: number; disagreements: string[] };
/** Compare the new function with the old pattern (and, where `byDefinition`, with the reading by definition) over `texts`: how many were compared, how many the OLD pattern called TRUE, and the first few disagreements. */
function compareAll(texts: Iterable<string>, byDefinition = false): Count {
  let compared = 0;
  let junk = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = OLD_LINK_ATTRIBUTE_JUNK.test(text);
    compared++;
    if (expected) {
      junk++;
    }
    const now = linkAttributesHaveJunk(text);
    const defined = byDefinition ? definitionJunk(text) : expected;
    if ((now !== expected || defined !== expected) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${expected}, now ${now}${byDefinition ? `, by definition ${defined}` : ""}`);
    }
  }
  return { compared, junk, disagreements };
}

// The characters the pattern reads (`{`, `}`, a space and a tab), a letter, and for the wide alphabet the characters a nearby pattern could confuse with a blank: a no-break space (whitespace to `\S`, not to `[ \t]`),
// a line separator, a carriage return, a form feed.
const NARROW = ["{", "}", "x", " ", "\t"];
const WIDE = ["{", "}", "x", " ", "\t", NBSP, LS, "\r", "\f"];
// Tokens, not characters: doubled braces, a whole attribute block, a URL, the title quotes and a bracket that the caller's other tests read.
const TOKENS = ["{", "}", "{{", "}}", "x", "xy", " ", "\t", "{x}", "{#a}", NBSP, "[", '"', "'", "/u"];
const SMALL_DEFINITION = ["{", "}", "x", " "];
const MIXED_DEFINITION = ["{", "}", "x", " ", "\t", NBSP];

const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; junk: number; byDefinition: boolean }> = [
  { label: "5 characters, up to 10", alphabet: NARROW, maxLength: 10, junk: 2_537_703, byDefinition: false },
  { label: "9 characters, up to 7", alphabet: WIDE, maxLength: 7, junk: 41_598, byDefinition: false },
  { label: "15 tokens, up to 5", alphabet: TOKENS, maxLength: 5, junk: 224_326, byDefinition: false },
  { label: "4 characters, up to 7, also by definition", alphabet: SMALL_DEFINITION, maxLength: 7, junk: 4_626, byDefinition: true },
  { label: "6 characters, up to 5, also by definition", alphabet: MIXED_DEFINITION, maxLength: 5, junk: 162, byDefinition: true },
];

// A seeded sample of longer texts: 0 to 14 pieces, each repeated 1 to 3 times. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3342;
const PIECES = ["{", "{", "}", "}", "x", "xy", " ", "\t", "{#id}", "/u", "{a}", NBSP, "[", "\n", "\r", IDEOGRAPHIC, PS];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = "";
    const parts = Math.floor(next() * 15);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield text;
  }
}

// Run lengths of `{` around every boundary, behind a URL or none, with a closer and a tail after it: the run is where the old pattern gave one `{` back at a time.
const RUNS = [0, 1, 2, 3, 5, 9, 100];
const SHORT_RUNS = [0, 1, 2, 3, 5];
function* runGrid(runs: readonly number[]): Generator<string> {
  for (const before of ["", "x", "/u ", " ", "x "]) {
    for (const run of runs) {
      for (const middle of ["", "a", "}", "a}", "}}"]) {
        for (const blanks of ["", " ", "\t ", NBSP]) {
          for (const tail of ["", "y", "{", "}"]) {
            yield `${before}${"{".repeat(run)}${middle}${blanks}${tail}`;
          }
        }
      }
    }
  }
}

// What each text is, stated by hand: a link attribute block that something follows is junk; one that ends the text, a bare brace pair, a `}` with no `{` before it, and a block behind whitespace-only text are not.
const STATED: Array<[string, boolean]> = [
  ["/u {#id} x", true],
  ["/u {#id}", false],
  ["/u {#id}x", true],
  ["/u{#id} x", true],
  ["/u {#id}  ", false],
  ["{#id} x", false],
  ["x {", false],
  ["x {a", false],
  ["x {}y", true],
  ["x{}", false],
  ["x { } y", true],
  ["x {a}" + NBSP + "y", false],
  ["x {a}\t y", true],
  ["x {a} {b}", true],
  ["x {a}\f{b}c", false],
  ["x {a}\f{b}c ", false],
  [" x{a}b", false],
  ["a{b}c", true],
  ["a{b", false],
  ["a}b{c}d", true],
  ["{{{{", false],
  ["x{{{{", false],
  ["x{{{{}y", true],
  ["", false],
  ["x", false],
];

describe("Session 334 — linkAttributesHaveJunk: the new scan answers what the old pattern matched", () => {
  it("JS_WHITESPACE is exactly the set `\\s` matches, over all 65,536 code units", () => {
    const differing: number[] = [];
    for (let unit = 0; unit <= 0xffff; unit++) {
      const c = String.fromCharCode(unit);
      if (/\s/.test(c) !== JS_WHITESPACE.has(c)) {
        differing.push(unit);
      }
    }
    expect(differing).toEqual([]);
  });

  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(everyString(e.alphabet, e.maxLength), e.byDefinition);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.junk).toBe(e.junk);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.junk).toBe(62_595);
  }, HEAVY_ROW_MS);

  // The reading by definition tries every split (the fifth power of the length), so only the runs of up to 5 `{` meet it; every run meets the old pattern.
  it("a grid of `{` runs, closers, blanks and tails", () => {
    const result = compareAll(runGrid(RUNS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(5 * RUNS.length * 5 * 4 * 4);
    expect(result.junk).toBe(782);
  });

  it("the short part of that grid, also by definition", () => {
    const result = compareAll(runGrid(SHORT_RUNS), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(5 * SHORT_RUNS.length * 5 * 4 * 4);
    expect(result.junk).toBe(510);
  });

  it.each(STATED.map(([text, expected]) => [JSON.stringify(text), text, expected] as const))("%s is stated as %s by hand, by the old pattern, by definition and by the new function", (_label, text, expected) => {
    expect(OLD_LINK_ATTRIBUTE_JUNK.test(text)).toBe(expected);
    expect(definitionJunk(text)).toBe(expected);
    expect(linkAttributesHaveJunk(text)).toBe(expected);
  });
});

// The review round of Session 334 (mutation lens, `wf_4c0e316d-989`): the enumerations stop at 10 characters and the seeded sample at about 45, so a cap on the search for a `{`, a `}` or the end of the leading run, and a
// whitespace character no alphabet holds, left the pins unchanged. These rows hold LONG texts and every whitespace character, the answer stated by hand and asked of the old pattern too (which is linear on every shape here:
// the greedy `\S+` gives back only the few characters after the block).
describe("Session 334 review — linkAttributesHaveJunk on long texts and on every whitespace character", () => {
  const LONG: Array<[string, string, boolean]> = [
    ["a `{` after 5,000 letters", "x".repeat(5_000) + "{a}x", true],
    ["a `{` after 1,100,000 letters", "x".repeat(1_100_000) + "{a}x", true],
    ["a `}` 70,000 characters after the `{`", "x{" + "a".repeat(70_000) + "}y", true],
    ["a `}` 1,100,000 characters after the `{`", "x{" + "a".repeat(1_100_000) + "}y", true],
    ["5,000 blanks between the URL and the `{`", "/u" + " ".repeat(5_000) + "{a}x", true],
    ["5,000 blanks between the `}` and the junk", "/u {a}" + " ".repeat(5_000) + "x", true],
    ["5,000 blanks after the `}` and nothing else", "/u {a}" + " ".repeat(5_000), false],
    ["a URL of 5,000 letters, a blank, a word and a block after the word", "x".repeat(5_000) + " y {a}x", false],
    ["a URL of 5,000 letters, a blank and a block with junk", "x".repeat(5_000) + " {a}x", true],
    ["a `{` after 70,000 tabs behind the URL", "/u" + "\t".repeat(70_000) + "{a}x", true],
  ];
  it.each(LONG.map(([label, text, expected]) => [label, text, expected] as const))("%s", (_label, text, expected) => {
    expect(OLD_LINK_ATTRIBUTE_JUNK.test(text)).toBe(expected);
    expect(linkAttributesHaveJunk(text)).toBe(expected);
  });

  // Only a space and a tab are blanks to the pattern's `[ \t]`; any other whitespace character ends the leading run of non-blanks and the block is not found after it, and is no junk after the `}` (`\S` refuses it).
  it.each([...JS_WHITESPACE].filter((c) => c !== " " && c !== "\t").map((c) => [`U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`, c] as const))("%s ends the run, and is neither a blank before the `{` nor junk after the `}`", (_label, c) => {
    for (const text of ["/u" + c + "{#id} x", "/u {#id}" + c + "x", "/u {#id}" + c]) {
      expect(OLD_LINK_ATTRIBUTE_JUNK.test(text)).toBe(false);
      expect(linkAttributesHaveJunk(text)).toBe(false);
    }
  });
});
