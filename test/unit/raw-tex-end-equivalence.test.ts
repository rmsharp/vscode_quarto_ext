import { describe, expect, it } from "vitest";
import { findHeadings, rawTexEndNames } from "../../src/core/qmd/model";
import { LS, NBSP, PS, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 339 — the BACKLOG item "Three more quadratic single-line shapes", part (9). The names of the `\end{name}` delimiters on one line were read by `/\\end\{([^}]*)\}/g` at two sites (`lastRawTexEnvEnd`, which
// records the last line of every name, and the LIFO probe inside `computeRegions`, which pops the names a line closes); a line of `\end{` repeated with no `}` restarted the scan at every `\end{` and read each
// time to the end of the line, n squared. `rawTexEndNames` reads the same names with `indexOf`. The pattern's matches, in order: the leftmost `\end{` starts one; `[^}]*` takes everything up to the FIRST `}` after
// that `{`, so the name may hold CR, U+2028, U+2029, a no-break space, a `{`, a backslash or a nested `\end{` (in `\end{\end{a}` the name is `\end{a`); the next search starts AFTER that `}`; and an `\end{` with no `}`
// anywhere after it ends the scan, because every later `\end{` needs a `}` after a later place. The OLD pattern is kept here, copied from the parent `4d1944c` (`src/core/qmd/model.ts` before the cure), as the oracle
// (Learning 738), beside a reading by definition that uses no regex at all and goes on after a miss; the function returns the NAMES in order, so the comparison is on the whole list and not only on whether the
// pattern matched. The pinned counts (how many strings of each enumeration hold at least one delimiter, and how many delimiters they hold in all) come from those two and never from the code under test.

// ---- The OLD pattern, copied from the parent `4d1944c`. ----
const OLD_END_DELIMITER = /\\end\{([^}]*)\}/g;
function oldNames(line: string): string[] {
  const names: string[] = [];
  OLD_END_DELIMITER.lastIndex = 0;
  for (let m = OLD_END_DELIMITER.exec(line); m !== null; m = OLD_END_DELIMITER.exec(line)) {
    names.push(m[1]);
  }
  return names;
}

// ---- A reading of the old pattern by DEFINITION, with no regular expression. ----
// From the left: at each place, if the five characters are `\end{`, look for the first `}` after them; if there is one, the characters between are a name and the search goes on after the `}`; if there is none, this
// place fails and the search goes on at the NEXT place (what a pattern does), which is why this reading is quadratic and the function is not.
function definitionNames(line: string): string[] {
  const names: string[] = [];
  let at = 0;
  while (at + 5 <= line.length) {
    if (line.slice(at, at + 5) === "\\end{") {
      let close = at + 5;
      while (close < line.length && line[close] !== "}") {
        close++;
      }
      if (close < line.length) {
        names.push(line.slice(at + 5, close));
        at = close + 1;
        continue;
      }
    }
    at++;
  }
  return names;
}

const sameNames = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((name, i) => name === b[i]);

type Count = { compared: number; matched: number; names: number; disagreements: string[] };
/** Compare the new function with the old pattern and with the reading by definition over `texts`: how many were compared, how many the OLD pattern found a delimiter in, how many delimiters it found in all, and the first few disagreements. */
function compareAll(texts: Iterable<string>, byDefinition = true): Count {
  let compared = 0;
  let matched = 0;
  let names = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldNames(text);
    compared++;
    if (expected.length > 0) {
      matched++;
      names += expected.length;
    }
    const now = rawTexEndNames(text);
    const defined = byDefinition ? definitionNames(text) : expected;
    if ((!sameNames(now, expected) || !sameNames(defined, expected)) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}${byDefinition ? `, by definition ${JSON.stringify(defined)}` : ""}`);
    }
  }
  return { compared, matched, names, disagreements };
}

const END = "\\end{";
const ASTRAL = String.fromCodePoint(0x1f600);
const HIGH = String.fromCharCode(0xd83d);
const LOW = String.fromCharCode(0xde00);
const WIDE_CHAR = String.fromCharCode(0x100);

// The five characters of the opener, a closing brace, a letter; then the same with the near-misses a name or an opener can hold.
const CHARS = ["\\", "e", "n", "d", "{", "}"];
// Tokens, not characters: the whole opener, a brace, a letter, a lone backslash, a carriage return.
const TOKENS = [END, "}", "a", "\\", "{", "\r"];
// The characters that matter to a name (a CR, both other line terminators, a no-break space, a character above U+00FF, an astral pair, each lone surrogate) and the broken openers.
const WIDE = [END, "}", "a", "\r", LS, PS, NBSP, WIDE_CHAR, ASTRAL, HIGH, LOW, "\\"];
const NEAR_MISSES = [END, "}", "end{", "\\end", "\\en", "{"];

const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; matched: number; names: number }> = [
  { label: "6 characters, up to 9", alphabet: CHARS, maxLength: 9, matched: 2_040, names: 2_040 },
  { label: "6 tokens (the opener among them), up to 8", alphabet: TOKENS, maxLength: 8, matched: 770_422, names: 828_061 },
  { label: "12 wide tokens, up to 6", alphabet: WIDE, maxLength: 6, matched: 263_499, names: 265_439 },
  { label: "6 near-miss tokens, up to 8", alphabet: NEAR_MISSES, maxLength: 8, matched: 844_093, names: 911_701 },
];

// A seeded sample of longer lines: 0 to 14 pieces, each repeated 1 to 3 times. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 1_000_000;
const SEED = 3391;
const PIECES = [END, END, "}", "}", "a", "ab", "\\", "{", "\r", LS, PS, NBSP, WIDE_CHAR, ASTRAL, HIGH, LOW, "end{", "\\end{a}", "}}", " ", "x}"];
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

// Run lengths of the opener around every boundary, behind a prefix and before a tail: the run is where the old pattern read to the end of the line from each opener, and the tail decides whether any of them is closed.
const RUNS = [0, 1, 2, 3, 5, 9, 100, 1000, 3000];
function* runGrid(runs: readonly number[]): Generator<string> {
  for (const before of ["", "\\end{a}", "a", "\r", "}"]) {
    for (const unit of [END, END + WIDE_CHAR, "\\end{}", "\\end"]) {
      for (const run of runs) {
        for (const tail of ["", "}", "a}", "\\end{a}", "x", "}}", "\\end{", LS + "}"]) {
          yield `${before}${unit.repeat(run)}${tail}`;
        }
      }
    }
  }
}

// What each line holds, stated by hand: every `\end{` that has a `}` after it takes the characters up to that first `}` as its name, and the search goes on after the brace.
const STATED: Array<[string, string[]]> = [
  ["", []],
  ["\\end{a}", ["a"]],
  ["\\end{a}\\end{b}", ["a", "b"]],
  ["\\end{a}\\end{a}", ["a", "a"]],
  ["x\\end{a}y\\end{b}z", ["a", "b"]],
  ["\\end{", []],
  ["\\end{a", []],
  ["\\end{a}\\end{", ["a"]],
  ["\\end{a}\\end{b", ["a"]],
  ["\\end{}", [""]],
  ["\\end{\\end{a}", ["\\end{a"]],
  ["\\end{\\end{", []],
  ["\\end{\\end{}", ["\\end{"]],
  ["\\end{a\r}", ["a\r"]],
  ["\\end{" + LS + "}", [LS]],
  ["\\end{" + PS + "}", [PS]],
  ["\\end{" + NBSP + "}", [NBSP]],
  ["\\end{a{b}", ["a{b"]],
  ["\\end{a\\b}", ["a\\b"]],
  ["\\end{" + WIDE_CHAR + "}", [WIDE_CHAR]],
  ["\\end{" + ASTRAL + "}", [ASTRAL]],
  ["\\end{" + HIGH + "}", [HIGH]],
  ["\\end{" + LOW + "}", [LOW]],
  ["\\end{a}}", ["a"]],
  ["}\\end{a}", ["a"]],
  ["\\end{a}\\end{b}\\end{", ["a", "b"]],
  ["\\ end{a}", []],
  ["\\end {a}", []],
  ["\\END{a}", []],
  ["\\End{a}", []],
  ["end{a}", []],
  ["\\begin{a}", []],
  ["\\begin{a}\\end{a}", ["a"]],
  ["{a}", []],
  ["\\end", []],
  ["\\end}", []],
  ["a\\end{b}c\\end{d}e\\end{f", ["b", "d"]],
];

describe("Session 339 — rawTexEndNames: the new function answers what the old `\\end{name}` pattern matched", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(everyString(e.alphabet, e.maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.matched).toBe(e.matched);
    expect(result.names).toBe(e.names);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.matched).toBe(437_643);
    expect(result.names).toBe(923_698);
  }, HEAVY_ROW_MS);

  // The reading by definition goes on after every miss, so it meets the shorter runs only; every run meets the old pattern.
  it("a grid of opener runs, prefixes and tails (old pattern)", () => {
    const result = compareAll(runGrid(RUNS), false);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(5 * 4 * RUNS.length * 8);
    expect(result.matched).toBe(912);
    expect(result.names).toBe(165_588);
  });

  it("the shorter part of that grid, also by definition", () => {
    const result = compareAll(runGrid(RUNS.slice(0, 6)), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(5 * 4 * 6 * 8);
    expect(result.matched).toBe(588);
    expect(result.names).toBe(1_312);
  });

  // Every UTF-16 code unit, put at every place of a head and in place of each of its characters: no alphabet reaches the 65,536 of them, and a name may hold any of them but `}`.
  const HEADS = ["\\end{a}", END, "\\end{\\end{a}"];
  it("every code unit at every place of three heads", () => {
    const result = compareAll(everyCodeUnitEdit(HEADS), false);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countCodeUnitEdits(HEADS));
    expect(result.matched).toBe(1_900_554);
    expect(result.names).toBe(1_900_555);
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, expected]) => [JSON.stringify(line), line, expected] as const))("%s is stated as %j by hand, by the old pattern, by definition and by the new function", (_label, line, expected) => {
    expect(oldNames(line)).toEqual(expected);
    expect(definitionNames(line)).toEqual(expected);
    expect(rawTexEndNames(line)).toEqual(expected);
  });
});

// The function on lines the oracle cannot take (the old pattern needs seconds for 40,000 openers and does not finish on 2,000,000), and the clock: a linear reader takes milliseconds here.
describe("Session 339 — rawTexEndNames on long lines", () => {
  const LIMIT_MS = 1000;
  const OLD_RUN = 30_000;
  const OLD_FLOOR_MS = 1000;
  const clock = <T,>(run: () => T): { result: T; ms: number } => {
    const started = performance.now();
    const result = run();
    return { result, ms: performance.now() - started };
  };

  it.each([
    ["2,000,000 openers (10,000,000 characters) with no brace", END.repeat(2_000_000), []],
    ["1,000,000 two-byte openers (6,000,000 characters) with no brace", (END + WIDE_CHAR).repeat(1_000_000), []],
    ["a line that holds one complete delimiter and then 2,000,000 openers", "\\end{a}" + END.repeat(2_000_000), ["a"]],
    ["2,000,000 openers and one brace at the very end: one name, all the rest", END.repeat(2_000_000) + "}", [END.repeat(1_999_999)]],
    ["1,000,000 complete delimiters", "\\end{a}".repeat(1_000_000), new Array<string>(1_000_000).fill("a")],
    ["1,600,000 empty delimiters", "\\end{}".repeat(1_600_000), new Array<string>(1_600_000).fill("")],
    ["a name of 10,000,000 letters", "\\end{" + "a".repeat(10_000_000) + "}", ["a".repeat(10_000_000)]],
  ] as Array<[string, string, string[]]>)("%s is read in linear time and without throwing", (_label, line, expected) => {
    const { result, ms } = clock(() => rawTexEndNames(line));
    expect(result).toEqual(expected);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it("the clock row can fail: the old pattern takes over a second on 30,000 openers", () => {
    const line = END.repeat(OLD_RUN);
    const { result, ms } = clock(() => oldNames(line));
    expect(result).toEqual([]);
    expect(ms).toBeGreaterThan(OLD_FLOOR_MS);
  });

  // A run of 3,000 openers, a limit of 100 s or a floor of 1 ms would pass on the parent too (the old pattern takes about 10 ms on 3,000).
  it("keeps the sizes, the limit and the floor the clock rows above are built on", () => {
    expect([LIMIT_MS, OLD_RUN, OLD_FLOOR_MS]).toEqual([1000, 30_000, 1000]);
  });
});

// The two call sites, on documents the older rows of `qmd-model.test.ts` do not hold. Every answer is what the PARENT (`4d1944c`) gave for the same document, checked in Session 339: these rows PASS on the parent and
// pin the wiring, which the unit-level rows above cannot see. A `\begin{}` is a real opener only when an `\end{}` of its name is on the same line or below; an `\end{}` closes only what is open, innermost first.
describe("Session 339 — the two rawTexEndNames call sites on documents the older rows did not hold", () => {
  const texts = (text: string): string[] => findHeadings(text).map((heading) => heading.text);
  it.each([
    // lastRawTexEnvEnd: every name on the line counts, not the first, wherever it sits on the line.
    ["the closer is the second name of a line that starts with another environment's `\\end{}`", "para\n\\begin{a}\nbody\n\\end{b}\\end{a}\n# H\n", ["H"]],
    ["the closer is the third name of a line that does not start with an `\\end{}`", "para\n\\begin{a}\nbody\ntext \\end{b} \\end{c} \\end{a}\n\n# H\n", ["H"]],
    ["`\\end{b\\end{a}` is ONE delimiter, named `b\\end{a`, so `a` is never closed", "para\n\\begin{a}\n\\end{b\\end{a}\n# H\n", []],
    ["the nested opener takes the name `\\end{a`, so `a` is never closed", "para\n\\begin{a}\nbody\n\\end{\\end{a}\n# H\n", []],
    ["a name with a carriage return in it is another name", "para\n\\begin{a}\nbody\n\\end{a\r}\n# H\n", []],
    ["a name with a no-break space is another name", "para\n\\begin{a}\nbody\n\\end{a" + NBSP + "}\n# H\n", []],
    ["a name with a line separator is another name", "para\n\\begin{a}\nbody\n\\end{a" + LS + "}\n# H\n", []],
    ["the closer sits in a line below, after an unterminated opener", "para\n\\begin{a}\nbody\n\\end{\n\\end{a}\n# H\n", ["H"]],
    // The probe: LIFO over the names of the line, from the first.
    ["two names on the line close two open environments, innermost first", "para\n\\begin{a}\n\\begin{b}\nbody\n\\end{b}\\end{a}\n# H\n", ["H"]],
    ["two names on the line in the wrong order close only the second", "para\n\\begin{a}\n\\begin{b}\nbody\n\\end{a}\\end{b}\n# H\n", ["H"]],
    ["a name that is not open pops nothing, the next one pops", "para\n\\begin{a}\nbody\n\\end{b}\\end{a}\n# H\n", ["H"]],
    ["the same name twice on the line pops one environment, the second finds none", "para\n\\begin{a}\nbody\n\\end{a}\\end{a}\n# H\n", ["H"]],
    ["an unterminated opener after the closer changes nothing", "para\n\\begin{a}\nbody\n\\end{a}\\end{\n# H\n", ["H"]],
    ["an unterminated opener on the line BELOW the closer is paragraph text, which hides the ATX line under it", "para\n\\begin{a}\nbody\n\\end{a}\n\\end{a\n# H\n", []],
  ] as Array<[string, string, string[]]>)("%s", (_label, text, expected) => {
    expect(texts(text)).toEqual(expected);
  });
});
