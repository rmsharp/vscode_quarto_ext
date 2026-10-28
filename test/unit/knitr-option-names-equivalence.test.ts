import { describe, expect, it } from "vitest";
import { findHeadings, knitrOptionNames } from "../../src/core/qmd/model";
import { NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 334 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (6).
// `knitrCodeMasksPrinters` reads the NAMES assigned in the argument list of an `options(` call (anything but a number-format option masks a printing call). It listed them with the unanchored global pattern
// `/([A-Za-z.][\w.]*)[ \t]*=/g`, which tries every letter of a run of name characters as a start and reads each to the end of the run looking for an `=`: a run of n letters cost n squared. It is now
// `knitrOptionNames`, which finds each MAXIMAL run of `[\w.]` once (a start inside a run can only succeed where the run's own first letter or dot would, so the lookbehind keeps a start from following a name
// character) that is followed by blanks and an `=`, and answers the run without its leading digits and underscores (a name starts with a letter or a dot; the old pattern's leftmost start in a run is its first such character). The OLD pattern is kept here, copied from the parent `50fa22b`
// (`src/core/qmd/model.ts` before the cure), as the oracle (Learning 738), beside a reading by definition that uses no regex at all; the function returns the LIST of names, so the comparison is on every
// name and its order and not on whether one was found. The pinned counts (how many names the enumeration yields in all) come from those two and never from the code under test.

// ---- The OLD pattern, copied from the parent `50fa22b`. ----
function oldNames(args: string): string[] {
  return [...args.matchAll(/([A-Za-z.][\w.]*)[ \t]*=/g)].map((match) => match[1]);
}

// ---- A reading of the old pattern by DEFINITION, with no regular expression. ----
// Scan left to right. At a start that is a letter or a dot, take the longest run of name characters (letters, digits, underscore, dot) and try each length from the longest down to one: a name is the run so
// cut when blanks (spaces and tabs only) and an `=` follow it. A name is reported and the scan resumes after its `=`; no length works and the scan moves on one character.
const isLetterOrDot = (c: string | undefined): boolean => c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === ".");
const isNameCharacter = (c: string | undefined): boolean => isLetterOrDot(c) || (c !== undefined && ((c >= "0" && c <= "9") || c === "_"));
function definitionNames(args: string): string[] {
  const names: string[] = [];
  let at = 0;
  while (at < args.length) {
    let found = false;
    if (isLetterOrDot(args[at])) {
      let longest = at;
      while (isNameCharacter(args[longest])) {
        longest++;
      }
      for (let end = longest; end > at && !found; end--) {
        let after = end;
        while (args[after] === " " || args[after] === "\t") {
          after++;
        }
        if (args[after] === "=") {
          names.push(args.slice(at, end));
          at = after + 1;
          found = true;
        }
      }
    }
    if (!found) {
      at++;
    }
  }
  return names;
}

type Count = { compared: number; names: number; disagreements: string[] };
/** Compare the new function with the old pattern (and, where `byDefinition`, with the reading by definition) over `texts`: how many were compared, how many names the OLD pattern found in all, and the first few disagreements. */
function compareAll(texts: Iterable<string>, byDefinition = false): Count {
  let compared = 0;
  let names = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldNames(text);
    compared++;
    names += expected.length;
    const now = knitrOptionNames(text);
    const defined = byDefinition ? definitionNames(text) : expected;
    if ((JSON.stringify(now) !== JSON.stringify(expected) || JSON.stringify(defined) !== JSON.stringify(expected)) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}${byDefinition ? `, by definition ${JSON.stringify(defined)}` : ""}`);
    }
  }
  return { compared, names, disagreements };
}

// The characters the pattern reads (a letter, a digit, an underscore, a dot, a space, `=`), and for the wide alphabet a tab and the neighbours a name character could be confused with: a capital letter, a hyphen, a
// no-break space (whitespace to `\s`, not to `[ \t]`), a newline, a comma.
const NARROW = ["a", "1", "_", ".", " ", "="];
const WIDE = ["a", "Z", "1", "_", ".", " ", "\t", "=", NBSP, "-", "\n", ","];
// Tokens, not characters: the real option names, a digit-led and an underscore-led name, a dotted name, `==`, a call's comma, a number.
const TOKENS = ["digits", "scipen", "x", "9x", "_a", "a.b", "=", " = ", "==", ", ", " ", "1", ".", "..."];
const SMALL_DEFINITION = ["a", "1", ".", " ", "="];
const MIXED_DEFINITION = ["a", "1", "_", ".", " ", "\t", "=", NBSP];

const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; names: number; byDefinition: boolean }> = [
  { label: "6 characters, up to 9", alphabet: NARROW, maxLength: 9, names: 8_586_452, byDefinition: false },
  { label: "12 characters, up to 6", alphabet: WIDE, maxLength: 6, names: 440_667, byDefinition: false },
  { label: "14 tokens, up to 5", alphabet: TOKENS, maxLength: 5, names: 310_032, byDefinition: false },
  { label: "5 characters, up to 9, also by definition", alphabet: SMALL_DEFINITION, maxLength: 9, names: 2_212_532, byDefinition: true },
  { label: "8 characters, up to 6, also by definition", alphabet: MIXED_DEFINITION, maxLength: 6, names: 69_794, byDefinition: true },
];

// A seeded sample of longer texts: 0 to 14 pieces, each repeated 1 to 3 times. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3343;
const PIECES = ["a", "ab", "1", "9x", "_", "_a", ".", "a.b", " ", "\t", "=", "==", ", ", "digits", "scipen = 3", NBSP, "(", ")", "-"];
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

// Run lengths of a name character around every boundary, behind an allowed assignment or none, then a tail: the run is where the old pattern tried every start.
const RUNS = [0, 1, 2, 3, 5, 9, 100];
const SHORT_RUNS = [0, 1, 2, 3, 5];
function* runGrid(runs: readonly number[]): Generator<string> {
  for (const before of ["", "digits = 3, ", "x=1,", "9"]) {
    for (const unit of ["a", ".", "1", "_", "a1", "1a"]) {
      for (const run of runs) {
        for (const tail of ["", "=", " =", "\t=", " x", "=a", NBSP + "="]) {
          yield `${before}${unit.repeat(run)}${tail}`;
        }
      }
    }
  }
}

// What each argument list yields, stated by hand: a name is a letter or dot followed by name characters, cut where blanks and an `=` follow; digits and underscores may not start one.
const STATED: Array<[string, string[]]> = [
  ["digits = 3", ["digits"]],
  ["digits=3, scipen=10", ["digits", "scipen"]],
  ["1x = 2", ["x"]],
  ["_a = 1", ["a"]],
  ["9 = 1", []],
  ["__ = 1", []],
  ["a.b=1", ["a.b"]],
  [".5 = 1", [".5"]],
  ["a == b", ["a"]],
  ["a = b = c", ["a", "b"]],
  ["x\t= 1", ["x"]],
  ["x" + NBSP + "= 1", []],
  ["max.print = 5", ["max.print"]],
  ["aaaa", []],
  ["", []],
  ["x =", ["x"]],
  ["=", []],
  ["a=b=c=", ["a", "b", "c"]],
  ["width = 80, stringsAsFactors = FALSE", ["width", "stringsAsFactors"]],
  ["_1_a.b9 = 2", ["a.b9"]],
];

describe("Session 334 — knitrOptionNames: the new scan lists what the old pattern matched", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(everyString(e.alphabet, e.maxLength), e.byDefinition);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.names).toBe(e.names);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.names).toBe(307_332);
  }, HEAVY_ROW_MS);

  // The reading by definition tries every cut of every start, so it meets the short runs only; every run meets the old pattern.
  it("a grid of name-character runs, with assignments before and tails after", () => {
    const result = compareAll(runGrid(RUNS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(4 * 6 * RUNS.length * 7);
    expect(result.names).toBe(972);
  });

  it("the short part of that grid, also by definition", () => {
    const result = compareAll(runGrid(SHORT_RUNS), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(4 * 6 * SHORT_RUNS.length * 7);
    expect(result.names).toBe(676);
  });

  it.each(STATED.map(([args, expected]) => [JSON.stringify(args), args, expected] as const))("%s is stated as %j by hand, by the old pattern, by definition and by the new function", (_label, args, expected) => {
    expect(oldNames(args)).toEqual(expected);
    expect(definitionNames(args)).toEqual(expected);
    expect(knitrOptionNames(args)).toEqual(expected);
  });
});

// The call site: `knitrCodeMasksPrinters` asks whether ANY name assigned in an `options(` call is not a number-format option, and a chunk that may mask a printing call is not taken to print. The effect is on the stray-fence
// geometry (Session 309): a silenced chunk that certainly prints swallows every heading between a stray bare fence above it and itself, a chunk that may mask does not. The first four lists below set number formats only;
// every other list sets one or more names that are not, which a call site that asked for EVERY name, or for an allowed one, or read a name's first character, would get wrong.
describe("Session 334 — knitrCodeMasksPrinters reads the names of an options( call through knitrOptionNames", () => {
  const outline = (code: string[]): string[] => {
    const text = ["---", "title: t", "---", "", "```{r setup0, include=FALSE}", "x <- 1", "```", "", "# Top", "", "```", "", "## Between", "", "```{r, echo=FALSE}", ...code, "```", "", "## After", ""].join("\n");
    return findHeadings(text, "knitr").map((heading) => heading.text);
  };
  const PRINTS = ["Top", "After"]; // the chunk certainly prints: "Between" sits between the stray fence and it and is swallowed
  const MAYBE = ["Top", "Between", "After"]; // the chunk may mask a printing call: nothing is swallowed
  const ROWS: Array<[string, string[], string[]]> = [
    ["no options call", ["summary(x)"], PRINTS],
    ["digits only", ["options(digits = 3)", "summary(x)"], PRINTS],
    ["digits and width", ["options(digits = 3, width = 80)", "summary(x)"], PRINTS],
    ["digits and stringsAsFactors", ["options(digits = 3, stringsAsFactors = FALSE)", "summary(x)"], PRINTS],
    ["digits and a name that is all digits (it names nothing)", ["options(digits = 3, 9 = 1)", "summary(x)"], PRINTS],
    ["an allowed name first, another second", ["options(digits = 3, foo = 1)", "summary(x)"], MAYBE],
    ["another name first, an allowed one second", ["options(foo = 1, digits = 3)", "summary(x)"], MAYBE],
    ["another name only", ["options(foo = 1)", "summary(x)"], MAYBE],
    ["a digit-led name after an allowed one", ["options(digits = 3, 1x = 1)", "summary(x)"], MAYBE],
    ["an underscore-led name after an allowed one", ["options(digits = 3, _a = 1)", "summary(x)"], MAYBE],
    ["a dot-led name after an allowed one", ["options(digits = 3, .b = 1)", "summary(x)"], MAYBE],
    ["a dotted name after an allowed one", ["options(digits = 3, a.b = 1)", "summary(x)"], MAYBE],
    ["a tab before the equals sign", ["options(digits = 3, foo\t= 1)", "summary(x)"], MAYBE],
    ["a one-letter name after an allowed one", ["options(digits = 3, w = 1)", "summary(x)"], MAYBE],
  ];
  it.each(ROWS.map(([label, code, expected]) => [label, code, expected] as const))("%s", (_label, code, expected) => {
    expect(outline([...code])).toEqual(expected);
  });
});

// The review round of Session 334 (mutation lens, `wf_4c0e316d-989`): the enumerations stop at 9 characters and the seeded sample at about 45, so a cap on a run, on the blanks before the `=` or on the number of names, and a
// character no alphabet holds (`$`, an accented letter, an arrow), left the pins unchanged. The answers below are stated by hand and asked of the old pattern too (linear on every shape here).
describe("Session 334 review — knitrOptionNames on long runs and on characters no alphabet holds", () => {
  const LONG: Array<[string, string, string[]]> = [
    ["5,000 digits and an equals sign name nothing", "1".repeat(5_000) + "=1", []],
    ["1,100,000 digits and an equals sign name nothing", "1".repeat(1_100_000) + "=1", []],
    ["a name of 70,000 letters", "a".repeat(70_000) + "=1", ["a".repeat(70_000)]],
    ["a name of 1,100,000 letters", "a".repeat(1_100_000) + "=1", ["a".repeat(1_100_000)]],
    ["a name and 200 blanks before its equals sign", "a" + " ".repeat(200) + "=1", ["a"]],
    ["a name and 70,000 tabs before its equals sign", "a" + "\t".repeat(70_000) + "=1", ["a"]],
    ["5,000 underscores and digits, then a name", "_1".repeat(2_500) + "x = 1", ["x"]],
    ["a `$` is no name character: the name starts after it", "x$y = 1", ["y"]],
    ["a leading `$`", "$a = 1", ["a"]],
    ["an accented letter is no name character", "éa = 1", ["a"]],
    ["an arrow is no assignment here", "a<-1", []],
  ];
  it.each(LONG.map(([label, args, expected]) => [label, args, expected] as const))("%s", (_label, args, expected) => {
    expect(oldNames(args)).toEqual(expected);
    expect(knitrOptionNames(args)).toEqual(expected);
  });

  // 300,000 names in one argument list, all listed.
  it("300,000 assignments are 300,000 names", () => {
    const args = "a=1,".repeat(300_000);
    expect(oldNames(args).length).toBe(300_000);
    expect(knitrOptionNames(args).length).toBe(300_000);
  });
});

// The clock rows of the pure function. A cure-shaped regression that keeps every answer is invisible to the equivalence rows above, so these rows read the cost: a name followed by a long run of blanks (or tabs) must not be
// read once per blank (a lookahead spelled `[ \t]*[ \t]*=` does exactly that, and so did the parent from every letter), and a long list must not be copied once per name (`names = [...names, name]`, or a `concat`).
describe("Session 334 review — knitrOptionNames reads a blank run and a long list in linear time", () => {
  const LIMIT_MS = 1000;
  const SIZE = 60_000;
  it.each([["blanks", " "], ["tabs", "\t"]] as const)("%s after a name that is followed by no equals sign: `a` x 60,000, 60,000 %s and a letter, no names", (_label, gap) => {
    const args = "a".repeat(SIZE) + gap.repeat(SIZE) + "x";
    const started = performance.now();
    const names = knitrOptionNames(args);
    const ms = performance.now() - started;
    expect(names).toEqual([]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, HEAVY_ROW_MS);

  it("60,000 assignments in one argument list are listed in linear time", () => {
    const args = "a=1,".repeat(SIZE);
    const started = performance.now();
    const names = knitrOptionNames(args);
    const ms = performance.now() - started;
    expect(names.length).toBe(SIZE);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, HEAVY_ROW_MS);

  // Without `at = close` after an `options(` call, the scan for the NEXT call restarts inside the one just read: n copies of `options(` followed by one `)` give the same answer and cost n squared (Session 309's line; the
  // 40,000 UNCLOSED calls of `knitr-prints.test.ts` return at the first, so they never reach it). 10,000 take 3.7 s without it and 12 ms with it.
  it("a chunk of 10,000 `options(` and one `)` is read in linear time", () => {
    const text = "```{r}\n" + "options(".repeat(10_000) + ")\n```\n\n# Z\n";
    const started = performance.now();
    const headings = findHeadings(text, "knitr").map((heading) => heading.text);
    const ms = performance.now() - started;
    expect(headings).toEqual(["Z"]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, HEAVY_ROW_MS);

  it("keeps the sizes and the limit the clock rows above are built on", () => {
    expect([SIZE, LIMIT_MS]).toEqual([60_000, 1000]);
  });
});

// The call site again, on the shapes the first table does not hold (the review round): the number formats `scipen` and `OutDec`, a name that is not one (`warn`), a call that does not close on its line, a name after the first `)`,
// a call written another way (`options (`, `x.options(`, `myoptions(`), an empty last argument, and 33 blanks before the `(`. Every answer is what the PARENT gave for the same chunk, checked in the review round.
describe("Session 334 review — knitrCodeMasksPrinters on options( calls the first table does not hold", () => {
  const outline = (code: string[]): string[] => {
    const text = ["---", "title: t", "---", "", "```{r setup0, include=FALSE}", "x <- 1", "```", "", "# Top", "", "```", "", "## Between", "", "```{r, echo=FALSE}", ...code, "```", "", "## After", ""].join("\n");
    return findHeadings(text, "knitr").map((heading) => heading.text);
  };
  const PRINTS = ["Top", "After"];
  const MAYBE = ["Top", "Between", "After"];
  const ROWS: Array<[string, string[], string[]]> = [
    ["scipen is a number format", ["options(scipen = 3)", "summary(x)"], PRINTS],
    ["OutDec is a number format", ['options(OutDec = ",")', "summary(x)"], PRINTS],
    ["warn is not a number format", ["options(warn = 1)", "summary(x)"], MAYBE],
    ["a call that does not close on its line", ["options(digits = 3", "summary(x)"], MAYBE],
    ["a call that closes on a later line", ["options(digits = 3,", "        foo = 1)", "summary(x)"], MAYBE],
    ["a name after the first closing paren, in a later call", ["options(digits = 3); summary(x, a = 1)"], PRINTS],
    ["another call with a name after the first closing paren", ["options(digits = 3); foo(a = 1)", "summary(x)"], PRINTS],
    ["a blank before the (", ["options (foo = 1)", "summary(x)"], MAYBE],
    ["a dot before options is another function", ["x.options(foo = 1)", "summary(x)"], PRINTS],
    ["a name before options is another function", ["myoptions(foo = 1)", "summary(x)"], PRINTS],
    ["an empty last argument", ["options(digits = 3, foo=)", "summary(x)"], MAYBE],
    ["33 blanks before the (", ["options" + " ".repeat(32) + "(foo = 1)", "summary(x)"], MAYBE],
  ];
  it.each(ROWS.map(([label, code, expected]) => [label, code, expected] as const))("%s", (_label, code, expected) => {
    expect(outline([...code])).toEqual(expected);
  });
});
