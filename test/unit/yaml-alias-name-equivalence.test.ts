import { describe, expect, it } from "vitest";
import { yamlAliasName } from "../../src/core/qmd/model";
import { JS_WHITESPACE, LS, NBSP, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 334 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (7).
// `YAML_ALIAS_VALUE`, `/^[ \t]*\*([^\s,[\]{}]+)[ \t]*(?:#.*)?$/`, reads a front-matter value that is nothing but an alias (`*name`, then blanks, then an optional comment). A `#` is a name character AND the
// start of a comment, so a name holding a run of `#` gave each of them back in turn as the comment's start, and each `.*` read on to a line terminator that `$` then refused: `*` + n `#` + a CR and a
// letter cost n squared. Every part of the pattern excludes a line terminator (`[ \t]`, `[^\s...]`, `#` and `.`), and `$` without the `m` flag is the end of the text, so a value that HOLDS one can never match.
// `yamlAliasName` refuses such a value first and runs the pattern on the rest, where the pattern is linear (the first `#` among the characters it gives back ends the match). The item's own cure was a second
// pattern for the terminator case, and the lookahead idiom of the fence runs (a negative lookahead for the name class after the name) is NOT equivalent here: `*a#b,` is the name `a` and a comment to the old
// pattern and no alias to that spelling (checked Session 334; the item's count of 74,160 differing strings out of 6,725,601 is its agent's, not re-counted). The OLD pattern is kept here, copied from the
// parent `ae72f74` (`src/core/qmd/model.ts` before the cure), as the oracle (Learning 738), beside a reading by definition that uses no regex at all; the function returns the NAME (or null), so the comparison
// is on the captured group and not only on whether the pattern matched. The pinned counts (how many strings of each enumeration the pattern matches) come from those two and never from the code under test.

// ---- The OLD pattern, copied from the parent `ae72f74`. ----
const OLD_YAML_ALIAS_VALUE = /^[ \t]*\*([^\s,[\]{}]+)[ \t]*(?:#.*)?$/;
function oldName(value: string): string | null {
  const alias = OLD_YAML_ALIAS_VALUE.exec(value);
  return alias === null ? null : alias[1];
}

// ---- A reading of the old pattern by DEFINITION, with no regular expression. ----
// Blanks (spaces and tabs), a `*`, a name of at least one character that is not whitespace and not one of `,` `[` `]` `{` `}`, blanks again, then either the end of the text or a `#` followed by characters
// none of which is a line terminator (what `.` excludes: LF, CR, U+2028, U+2029). The name is the LONGEST one for which the rest fits (the pattern's `+` is greedy and gives back one character at a time).
const LINE_TERMINATORS = new Set(["\n", "\r", LS, PS]);
function definitionName(value: string): string | null {
  const n = value.length;
  let at = 0;
  while (value[at] === " " || value[at] === "\t") {
    at++;
  }
  if (value[at] !== "*") {
    return null;
  }
  const start = at + 1;
  let longest = start;
  while (longest < n && !JS_WHITESPACE.has(value[longest]) && !",[]{}".includes(value[longest])) {
    longest++;
  }
  for (let end = longest; end > start; end--) {
    let after = end;
    while (value[after] === " " || value[after] === "\t") {
      after++;
    }
    if (after === n) {
      return value.slice(start, end);
    }
    if (value[after] === "#" && Array.from(value.slice(after + 1)).every((c) => !LINE_TERMINATORS.has(c))) {
      return value.slice(start, end);
    }
  }
  return null;
}

type Count = { compared: number; matched: number; disagreements: string[] };
/** Compare the new function with the old pattern (and, where `byDefinition`, with the reading by definition) over `texts`: how many were compared, how many the OLD pattern matched, and the first few disagreements. */
function compareAll(texts: Iterable<string>, byDefinition = false): Count {
  let compared = 0;
  let matched = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldName(text);
    compared++;
    if (expected !== null) {
      matched++;
    }
    const now = yamlAliasName(text);
    const defined = byDefinition ? definitionName(text) : expected;
    if ((now !== expected || defined !== expected) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}${byDefinition ? `, by definition ${JSON.stringify(defined)}` : ""}`);
    }
  }
  return { compared, matched, disagreements };
}

// The characters the pattern reads (`*`, `#`, a letter, a space, a tab, `,`, a carriage return), and for the wide alphabet every other line terminator, a no-break space (whitespace to `\s`, not to `[ \t]`), the
// brackets and braces the name excludes, a form feed.
const NARROW = ["*", "#", "a", " ", "\t", "\r", ","];
const AFTER_STAR = ["#", "a", " ", "\t", "\r", ",", LS];
const WIDE = ["#", "a", " ", "\t", "\r", "\n", LS, PS, NBSP, "[", "]", "{", "}", ","];
// Tokens, not characters: a name with a `#` inside, a comment, a flow indicator, every terminator, a form feed.
const TOKENS = ["*", "#", "a", "ab", " ", "\t", "\r", LS, "x#", "#y", ",", "{}", "*a", "# c", "\f"];
const SMALL_DEFINITION = ["*", "#", "a", " ", "\r"];

function* behind(prefix: string, alphabet: readonly string[], maxLength: number): Generator<string> {
  for (const body of everyString(alphabet, maxLength)) {
    yield prefix + body;
  }
}

const ENUMERATIONS: Array<{ label: string; prefix: string; alphabet: readonly string[]; maxLength: number; matched: number; byDefinition: boolean }> = [
  { label: "7 characters, up to 8", prefix: "", alphabet: NARROW, maxLength: 8, matched: 100_452, byDefinition: false },
  { label: "7 characters behind `*`, up to 8", prefix: "*", alphabet: AFTER_STAR, maxLength: 8, matched: 82_048, byDefinition: false },
  { label: "14 characters behind ` *`, up to 5", prefix: " *", alphabet: WIDE, maxLength: 5, matched: 3_186, byDefinition: false },
  { label: "15 tokens, up to 5", prefix: "", alphabet: TOKENS, maxLength: 5, matched: 31_415, byDefinition: false },
  { label: "5 characters, up to 8, also by definition", prefix: "", alphabet: SMALL_DEFINITION, maxLength: 8, matched: 15_243, byDefinition: true },
];

// A seeded sample of longer texts: 0 to 14 pieces, each repeated 1 to 3 times, behind one of four prefixes. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3344;
const PIECES = ["#", "#", "a", "ab", "a#", " ", "\t", "\r", LS, PS, "\n", ",", "{", "[", NBSP, "# c", "\f", "x#y", "*"];
const PREFIXES = ["*", " *", "\t*", ""];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = PREFIXES[Math.floor(next() * PREFIXES.length)];
    const parts = Math.floor(next() * 15);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield text;
  }
}

// Run lengths of a name unit around every boundary, behind `*`, then every terminator and every tail: the run is where the old pattern gave each character back in turn.
const RUNS = [0, 1, 2, 3, 5, 9, 100];
const SHORT_RUNS = [0, 1, 2, 3, 5];
function* runGrid(runs: readonly number[]): Generator<string> {
  for (const before of ["*", " *", "*a"]) {
    for (const unit of ["#", "a#", "#a", "a", "# "]) {
      for (const run of runs) {
        for (const terminator of ["", "\r", LS, PS, "\n"]) {
          for (const tail of ["", "x", " x", "#c", ",", " "]) {
            yield `${before}${unit.repeat(run)}${terminator}${tail}`;
          }
        }
      }
    }
  }
}

// What each value is, stated by hand: a name, its blanks and an optional comment; a `#` inside the name is part of it unless something after it forces the comment; a flow indicator, a second word, a bare star
// and any line terminator are not an alias.
const STATED: Array<[string, string | null]> = [
  ["*a", "a"],
  ["*a # c", "a"],
  ["*a#c", "a#c"],
  [" *a ", "a"],
  ["\t*a\t", "a"],
  ["*a\r", null],
  ["*a" + LS, null],
  ["*a" + PS, null],
  ["*a,", null],
  ["*a #", "a"],
  ["*#", "#"],
  ["* a", null],
  ["*", null],
  ["", null],
  ["a", null],
  ["*a b", null],
  ["*a#b c", "a"],
  ["*a#b\rc", null],
  ["*a # c\r", null],
  ["*a # c" + LS + "d", null],
  ["*a{", null],
  ["*a]", null],
  ["*" + NBSP + "a", null],
  ["*a" + NBSP, null],
  ["*#####", "#####"],
  ["*#####\rx", null],
  ["*a#" + "\r" + "x", null],
];

describe("Session 334 — yamlAliasName: the new function answers what the old alias pattern captured", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(behind(e.prefix, e.alphabet, e.maxLength), e.byDefinition);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.matched).toBe(e.matched);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.matched).toBe(20_875);
  }, HEAVY_ROW_MS);

  // The reading by definition tries every length of the name, so it meets the short runs only; every run meets the old pattern.
  it("a grid of name-unit runs, terminators and tails", () => {
    const result = compareAll(runGrid(RUNS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(3 * 5 * RUNS.length * 5 * 6);
    expect(result.matched).toBe(530);
  });

  it("the short part of that grid, also by definition", () => {
    const result = compareAll(runGrid(SHORT_RUNS), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(3 * 5 * SHORT_RUNS.length * 5 * 6);
    expect(result.matched).toBe(362);
  });

  it.each(STATED.map(([value, expected]) => [JSON.stringify(value), value, expected] as const))("%s is stated as %j by hand, by the old pattern, by definition and by the new function", (_label, value, expected) => {
    expect(oldName(value)).toBe(expected);
    expect(definitionName(value)).toBe(expected);
    expect(yamlAliasName(value)).toBe(expected);
  });
});
