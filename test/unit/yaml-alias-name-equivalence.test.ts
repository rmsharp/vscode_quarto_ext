import { describe, expect, it } from "vitest";
import { findHeadings, yamlAliasName } from "../../src/core/qmd/model";
import { JS_WHITESPACE, LS, NBSP, NEL, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

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
// (the vertical tab, the form feed and U+0085 are the whitespace and the near-terminators that `.` DOES match: a guard that took one of them for a terminator would refuse `*a #` + that character, an alias with a comment)
const WIDE = ["#", "a", " ", "\t", "\r", "\n", LS, PS, NBSP, "[", "]", "{", "}", ",", "\v", "\f", NEL];
// Tokens, not characters: a name with a `#` inside, a comment, a flow indicator, a carriage return, a line separator, a form feed.
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
  { label: "17 characters behind ` *`, up to 5", prefix: " *", alphabet: WIDE, maxLength: 5, matched: 10_323, byDefinition: false },
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
  ["*a #\v", "a"],
  ["*a #\f", "a"],
  ["*a #" + NEL, "a"],
  ["*a #" + NBSP, "a"],
  ["*a\v", null],
  ["*a" + NEL, "a" + NEL],
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

  // `yamlAliasName` is also asked directly, where a value can hold a line feed, which no line of a document does; the old pattern is slow on each of the four terminators (the document rows of
  // `pathological-inputs.test.ts` cover the other three through `findHeadings`), and the last row shows the clock can fail: the old pattern takes seconds on the same text.
  const CLOCK_RUN = 72_000;
  const CLOCK_LIMIT_MS = 1000;
  const OLD_RUN = 56_000;
  const OLD_FLOOR_MS = 1000;
  it.each([["a carriage return", "\r"], ["a line feed", "\n"], ["a line separator", LS], ["a paragraph separator", PS]] as const)("`*` + 72,000 `#` + %s + a letter is refused in linear time", (_label, terminator) => {
    const value = `*${"#".repeat(CLOCK_RUN)}${terminator}x`;
    const started = performance.now();
    const name = yamlAliasName(value);
    const ms = performance.now() - started;
    expect(name).toBeNull();
    expect(ms).toBeLessThan(CLOCK_LIMIT_MS);
  });

  it("the clock row can fail: the old pattern takes over a second on `*` + 56,000 `#` + a line feed + a letter", () => {
    const value = `*${"#".repeat(OLD_RUN)}\nx`;
    const started = performance.now();
    expect(OLD_YAML_ALIAS_VALUE.exec(value)).toBeNull();
    expect(performance.now() - started).toBeGreaterThan(OLD_FLOOR_MS);
  });

  // A run of 7,200 characters, a limit of 100 s or a floor of 1 ms would pass on the parent too (the old pattern takes about 30 ms on 7,200).
  it("keeps the sizes, the limit and the floor the clock rows above are built on", () => {
    expect([CLOCK_RUN, CLOCK_LIMIT_MS, OLD_RUN, OLD_FLOOR_MS]).toEqual([72_000, 1000, 56_000, 1000]);
  });

  it.each(STATED.map(([value, expected]) => [JSON.stringify(value), value, expected] as const))("%s is stated as %j by hand, by the old pattern, by definition and by the new function", (_label, value, expected) => {
    expect(oldName(value)).toBe(expected);
    expect(definitionName(value)).toBe(expected);
    expect(yamlAliasName(value)).toBe(expected);
  });
});

// The review round of Session 334 (mutation lens, `wf_4c0e316d-989`): the rows above end every value in a letter and stop at about 45 characters, so a guard that looks at part of the value (all but the last character, the
// first or last 4,096 or 2^20), a cap on the name or the blanks, a whitespace character no alphabet holds, and a second sigil (`&a` is an anchor, `!a` a tag) left the pins unchanged.
describe("Session 334 review — yamlAliasName on long values, on every whitespace character and on the other sigils", () => {
  const LIMIT_MS = 1000;
  const clock = <T,>(run: () => T): { result: T; ms: number } => {
    const started = performance.now();
    const result = run();
    return { result, ms: performance.now() - started };
  };

  // The guard must see the terminator wherever it is: last, with a long tail behind it, or beyond the first megabyte. (A guard on the value without its last character, on the first or last 4,096 characters, or on the
  // first 2^20, returns the quadratic of the parent on one of these and keeps every answer.)
  it.each([["a carriage return", "\r"], ["a line feed", "\n"], ["a line separator", LS], ["a paragraph separator", PS]] as const)("the terminator %s last, or followed by 5,000 letters, is refused in linear time", (_label, t) => {
    const last = clock(() => yamlAliasName("*" + "#".repeat(72_000) + t));
    expect(last.result).toBeNull();
    expect(last.ms).toBeLessThan(LIMIT_MS);
    const tail = clock(() => yamlAliasName("*" + "#".repeat(72_000) + t + "x".repeat(5_000)));
    expect(tail.result).toBeNull();
    expect(tail.ms).toBeLessThan(LIMIT_MS);
  });
  it("a carriage return after 1,100,000 characters is refused in linear time, and so is one before 1,100,000 more", () => {
    const far = clock(() => yamlAliasName("*" + "#".repeat(3_000) + "a".repeat(1_100_000) + "\r"));
    expect(far.result).toBeNull();
    expect(far.ms).toBeLessThan(LIMIT_MS);
    const before = clock(() => yamlAliasName("*" + "#".repeat(60_000) + "\r" + "x".repeat(1_100_000)));
    expect(before.result).toBeNull();
    expect(before.ms).toBeLessThan(LIMIT_MS);
  });

  const LONG: Array<[string, string, string | null]> = [
    ["a name of 70,000 letters", "*" + "a".repeat(70_000), "a".repeat(70_000)],
    ["a name of 1,100,000 letters", "*" + "a".repeat(1_100_000), "a".repeat(1_100_000)],
    ["5,000 blanks after the name", "*a" + " ".repeat(5_000), "a"],
    ["5,000 blanks before the star", " ".repeat(5_000) + "*a", "a"],
    ["5,000 tabs before the star and 5,000 after the name", "\t".repeat(5_000) + "*a" + "\t".repeat(5_000), "a"],
    ["a `$` in the name", "*a$b", "a$b"],
    ["`!`, `&` and `*` in the name", "*a!&*", "a!&*"],
    ["an anchor is no alias", "&a", null],
    ["a tag is no alias", "!a", null],
  ];
  it.each(LONG.map(([label, value, expected]) => [label, value, expected] as const))("%s", (_label, value, expected) => {
    expect(oldName(value)).toBe(expected);
    expect(yamlAliasName(value)).toBe(expected);
  });

  // Only a space and a tab are blanks to `[ \t]`; any other whitespace character ends the name and is neither a blank after it nor the start of a comment.
  it.each([...JS_WHITESPACE].filter((c) => c !== " " && c !== "\t").map((c) => [`U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`, c] as const))("%s ends the name and is no blank: `*a` + it + `b` is no alias", (_label, c) => {
    expect(oldName("*a" + c + "b")).toBeNull();
    expect(yamlAliasName("*a" + c + "b")).toBeNull();
  });
  // The same by name for the characters a fixed alphabet is most likely to leave out; each is whitespace to `\s`, so it ends a name that has been read and cannot start one.
  it.each([["a no-break space", NBSP], ["a byte order mark", String.fromCharCode(0xfeff)], ["an ideographic space", String.fromCharCode(0x3000)], ["U+1680", String.fromCharCode(0x1680)], ["U+202F", String.fromCharCode(0x202f)], ["U+205F", String.fromCharCode(0x205f)], ["U+2003", String.fromCharCode(0x2003)]] as const)("%s ends a name that has been read", (_label, c) => {
    expect(oldName("*a" + c)).toBeNull();
    expect(yamlAliasName("*a" + c)).toBeNull();
    expect(oldName("*" + c + "a")).toBeNull();
    expect(yamlAliasName("*" + c + "a")).toBeNull();
  });
});

// The two call sites (`mappingFromValueLine` for a block `from:`, `dereferenceFlowScalar` for a flow mapping), on documents the Session 206 and 208 rows of `qmd-model.test.ts` do not hold. Every answer is what the PARENT
// (`ae72f74`) gave for the same document, checked in Session 334's review round: an alias followed or led by a no-break space is no alias, a name of 5,000 characters resolves at both sites, and an alias at a nested key
// resolves against an anchor that is nested too.
describe("Session 334 review — the two yamlAliasName call sites on values the older rows did not hold", () => {
  const body = "\n# Top\n\n#Pressed\n\n## Last\n";
  const texts = (lines: string[]): string[] => findHeadings("---\n" + lines.join("\n") + "\n---\n" + body).map((heading) => heading.text);
  const x5000 = "x".repeat(5000);
  it.each([
    ["a block alias followed by a no-break space is no alias", ["rdr: &rdr markdown_strict", "from: *rdr" + NBSP], ["Top", "Last"]],
    ["a block alias led by a no-break space is no alias", ["rdr: &rdr markdown_strict", "from:" + NBSP + "*rdr"], ["Top", "Last"]],
    ["an alias whose name is 5,000 characters long resolves (block)", ["a" + x5000 + ": &" + x5000 + " markdown_strict", "from: *" + x5000], ["Top", "Pressed", "Last"]],
    ["an alias whose name is 5,000 characters long resolves (flow)", ["a: &" + x5000 + " markdown_strict", "format: {html: {from: *" + x5000 + "}}"], ["Top", "Pressed", "Last"]],
    ["a nested anchor is not resolved for a nested alias", ["format:", "  html:", "    other: &o markdown_strict", "    from: *o"], ["Top", "Last"]],
  ] as Array<[string, string[], string[]]>)("%s", (_label, lines, expected) => {
    expect(texts(lines)).toEqual(expected);
  });
});
