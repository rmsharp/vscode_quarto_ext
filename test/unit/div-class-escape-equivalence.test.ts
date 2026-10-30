import { describe, expect, it } from "vitest";
import { classValueMayHoldEscape, findHeadings } from "../../src/core/qmd/model";
import { LS, NBSP, PS, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 339, part (10) of the BACKLOG item "Three more quadratic single-line shapes" (group g02). `divSpecReading` declines to read a fenced div's opener from pandoc's tokens when a `class=` value holds a backslash
// or an ampersand (such a value is not decoded, so its words may not be the classes quarto reads), and it asked with `/class=[^}]*[\\&]/.test(tail)`. The pattern is true iff there are positions p and q with `class=`
// at p, q at least p + 6, a backslash or an ampersand at q, and no `}` in between: `[^}]*` cannot cross a `}` and matches every other character, a carriage return, U+2028, U+2029 and a `{` among them. Unanchored,
// it restarts at every `class=` and reads on to the next `}` or the end of the line, so a line that repeats `class=` and holds no escape costs n squared (the rows are `s339-div-class-rows.test.ts`).
// `classValueMayHoldEscape` is one left-to-right pass: a flag says "a `class=` has ended in the brace-free stretch behind this character", a `}` clears it, and the first backslash or ampersand met while it is set answers true.
// The OLD pattern is kept here, copied from the parent `4d1944c` (`src/core/qmd/model.ts` before the cure), as the oracle (Learning 738), beside a reading of the old pattern by DEFINITION that uses no regular
// expression and tries every pair (p, q) literally. The pinned counts (how many strings of each enumeration the pattern accepts) come from the oracle and never from the code under test.

// ---- The OLD pattern, copied verbatim from the parent `4d1944c`. ----
const OLD_CLASS_ESCAPE = /class=[^}]*[\\&]/;
const oldAnswer = (tail: string): boolean => OLD_CLASS_ESCAPE.test(tail);

// ---- A reading of the old pattern by DEFINITION, with no regular expression. ----
// Some p holds `class=` (tail.startsWith), some q at or after p + 6 holds a backslash or an ampersand, and tail.slice(p + 6, q) holds no `}`. Every pair is tried, so it is cubic and meets short strings only.
function definitionAnswer(tail: string): boolean {
  for (let p = 0; p + 6 <= tail.length; p++) {
    if (!tail.startsWith("class=", p)) {
      continue;
    }
    for (let q = p + 6; q < tail.length; q++) {
      if ((tail[q] === "\\" || tail[q] === "&") && !tail.slice(p + 6, q).includes("}")) {
        return true;
      }
    }
  }
  return false;
}

type Count = { compared: number; accepted: number; disagreements: string[] };
/** Compare the new function with the old pattern (and, where `byDefinition`, with the reading by definition) over `texts`: how many were compared, how many the OLD pattern accepted, and the first few disagreements. */
function compareAll(texts: Iterable<string>, byDefinition = false): Count {
  let compared = 0;
  let accepted = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldAnswer(text);
    compared++;
    if (expected) {
      accepted++;
    }
    const now = classValueMayHoldEscape(text);
    const defined = byDefinition ? definitionAnswer(text) : expected;
    if ((now !== expected || defined !== expected) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${expected}, now ${now}${byDefinition ? `, by definition ${defined}` : ""}`);
    }
  }
  return { compared, accepted, disagreements };
}

const ABOVE_FF = "Ā";
const ASTRAL = "\u{1D400}";
const LONE_HIGH = "\ud800";
const LONE_LOW = "\udc00";

// Tokens: the one that matters, the two characters that end it, the character that stops a scan, the blanks and terminators `[^}]` matches, and one character of each width and kind above U+00FF.
const TOKENS = ["class=", "}", "{", "\\", "&", " ", "a", "\r", LS, ABOVE_FF, ASTRAL, LONE_HIGH];
// Near misses of the token and the characters that start and stop things.
const NEAR = ["class=", "class", "lass=", "=", "}", "&", "\\", "c"];
// Characters: after one `class=`, every string over the letters of the token and the three characters that matter; and the same in front of `class=&`.
const CHARS = ["}", "&", "\\", "c", "l", "a", "s", "=", " "];

function* behind(prefix: string, alphabet: readonly string[], maxLength: number): Generator<string> {
  for (const body of everyString(alphabet, maxLength)) {
    yield prefix + body;
  }
}
function* before(suffix: string, alphabet: readonly string[], maxLength: number): Generator<string> {
  for (const body of everyString(alphabet, maxLength)) {
    yield body + suffix;
  }
}

const ENUMERATIONS: Array<{ label: string; texts: () => Iterable<string>; size: number; accepted: number; byDefinition: boolean }> = [
  { label: "12 tokens, up to 6", texts: () => everyString(TOKENS, 6), size: countStrings(TOKENS.length, 6), accepted: 425558, byDefinition: false },
  { label: "8 near-miss tokens, up to 7", texts: () => everyString(NEAR, 7), size: countStrings(NEAR.length, 7), accepted: 802222, byDefinition: false },
  { label: "`class=` and 9 characters, up to 7", texts: () => behind("class=", CHARS, 7), size: countStrings(CHARS.length, 7), accepted: 3363278, byDefinition: false },
  { label: "9 characters, up to 7, in front of `class=&`", texts: () => before("class=&", CHARS, 7), size: countStrings(CHARS.length, 7), accepted: 5380840, byDefinition: false },
  { label: "4 tokens, up to 8, also by definition", texts: () => everyString(["class=", "}", "&", "a"], 8), size: countStrings(4, 8), accepted: 39881, byDefinition: true },
];

describe("Session 339 — classValueMayHoldEscape: the new function answers what the old escape pattern answered", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(e.texts(), e.byDefinition);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(e.size);
    expect(result.accepted).toBe(e.accepted);
  }, HEAVY_ROW_MS);
});

// A seeded sample of longer texts: 0 to 14 pieces, each repeated 1 to 3 times. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3391;
const PIECES = ["class=", "class=", "class=", "}", "{", "\\", "&", " ", "a", "ab", "\r", LS, PS, NBSP, ABOVE_FF, ASTRAL, LONE_HIGH, LONE_LOW, "=", "class", "lass=", "c", "x=y", "\n"];
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

// Runs of a unit of 1 to 1,000 repeats around every boundary, behind one of six leads and in front of one of ten endings: the run is where the old pattern restarted at every `class=`.
const RUNS = [0, 1, 2, 3, 5, 9, 100, 1000];
const SHORT_RUNS = [0, 1, 2, 3, 5];
const LEADS = ["", "}", "{", "a", "&", "\\"];
const UNITS = ["class=", "class=a ", "class=}", "}class=", "class=class", "lass=", "clas"];
const ENDS = ["", "&", "\\", "}&", "&}", "\r&", LS + "\\", ABOVE_FF + "&", "}class=&", "class=}&"];
function* runGrid(runs: readonly number[]): Generator<string> {
  for (const lead of LEADS) {
    for (const unit of UNITS) {
      for (const run of runs) {
        for (const end of ENDS) {
          yield lead + unit.repeat(run) + end;
        }
      }
    }
  }
}
const gridSize = (runs: readonly number[]): number => LEADS.length * UNITS.length * runs.length * ENDS.length;

// The heads of the code-unit sweep: every UTF-16 code unit put at every place of the head, or in place of each of its characters (a character class no alphabet reached: a `}`, `&` or `\` spelt another way, a letter
// of `class=` that is almost one).
const SWEEPS: Array<{ label: string; heads: readonly string[]; accepted: number; byDefinition: boolean }> = [
  { label: "`class=&`, also by definition", heads: ["class=&"], accepted: 196617, byDefinition: true },
  { label: "`}class=a`", heads: ["}class=a"], accepted: 6, byDefinition: false },
  { label: "`class=a}&`", heads: ["class=a}&"], accepted: 65541, byDefinition: false },
];

describe("Session 339 — classValueMayHoldEscape: seeded texts, runs and every code unit", () => {
  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.accepted).toBe(48_860);
  }, HEAVY_ROW_MS);

  it("a grid of runs of the token, its near misses and a `}`, behind six leads and in front of ten endings", () => {
    const result = compareAll(runGrid(RUNS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(gridSize(RUNS));
    expect(result.accepted).toBe(1_344);
  }, HEAVY_ROW_MS);

  // The reading by definition is cubic, so it meets the short runs only; every run meets the old pattern.
  it("the short part of that grid, also by definition", () => {
    const result = compareAll(runGrid(SHORT_RUNS), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(gridSize(SHORT_RUNS));
    expect(result.accepted).toBe(786);
  }, HEAVY_ROW_MS);

  it.each(SWEEPS.map((sweep) => [`every UTF-16 code unit at every place of ${sweep.label}`, sweep] as const))("%s", (_label, sweep) => {
    const result = compareAll(everyCodeUnitEdit(sweep.heads), sweep.byDefinition);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countCodeUnitEdits(sweep.heads));
    expect(result.accepted).toBe(sweep.accepted);
  }, HEAVY_ROW_MS);
});

// What each tail is, stated by hand: a `class=` must have ended, a backslash or an ampersand must follow it, and nothing between them may be a `}` (any other character, a `{`, a carriage return or a line separator
// among them, is part of the value). An escape BEFORE the `class=`, a `}` between, another case of the key, a space in the key and no escape at all are not.
const STATED: Array<[string, boolean]> = [
  ["", false],
  ["class=", false],
  ["class=&", true],
  ["class=\\", true],
  ["class=a&", true],
  ["class=a\\b", true],
  ["&class=", false],
  ["\\class=", false],
  ["&class=a", false],
  ["class&=", false],
  ["class =&", false],
  ["Class=&", false],
  ["CLASS=&", false],
  ["lass=&", false],
  ["class=}&", false],
  ["class=a}b&", false],
  ["class=}class=&", true],
  ["}class=&", true],
  ["class=class=&", true],
  ["class=&}", true],
  ["class={&", true],
  ["class=\r&", true],
  ["class=" + LS + "&", true],
  ["class=" + PS + "\\", true],
  ["class=" + NBSP + "&", true],
  ["class=" + ABOVE_FF + "&", true],
  ["class=" + ASTRAL + "\\", true],
  ["class=" + LONE_HIGH + "&", true],
  ["class=" + LONE_LOW + "\\", true],
  ["x class=a y\\", true],
  ['{class="a&b"}', true],
  ['{class="callout-note" k="}&"}', false],
  ['{class="callout-note" k="{&"}', true],
  ['{title="a&b" class="x"}', false],
  ['{.callout-note class="x" title="a&b"}', true],
  ["{class=x}&", false],
  ["{class=x}class=y&", true],
  ["class=a}}}}}}b&class=c", false],
  ["class=}&}&}&class=&", true],
];

describe("Session 339 — classValueMayHoldEscape: stated by hand", () => {
  it.each(STATED.map(([tail, expected]) => [JSON.stringify(tail), tail, expected] as const))("%s is %s by hand, by the old pattern, by definition and by the new function", (_label, tail, expected) => {
    expect(oldAnswer(tail)).toBe(expected);
    expect(definitionAnswer(tail)).toBe(expected);
    expect(classValueMayHoldEscape(tail)).toBe(expected);
  });
});

// The call site: `divSpecReading` asks the function, and the answer decides whether the opener is read from pandoc's tokens (the key `class=` is read: the div is a callout, or a tabset, and `## T` is its title bar or a
// tab) or by the regex reader (which looks for `.callout-note` and does not read the key: `## T` is a heading). Every answer was taken from the PARENT `4d1944c`; the rows would change if the function answered otherwise.
const HIDDEN = ["H"];
const LISTED = ["T", "H"];
const OPENERS: Array<[string, string[]]> = [
  ['::: {class="callout-note"}', HIDDEN],
  ['::: {class="callout-note a&b"}', LISTED],
  ['::: {class="callout-note a\\\\b"}', LISTED],
  ['::: {data-x="a&b" class="callout-note"}', HIDDEN],
  ['::: {class="callout-note" data-x="a&b"}', LISTED],
  ['::: {class="callout-note" data-x="}&"}', HIDDEN],
  ['::: {class="callout-note" data-x="{&"}', LISTED],
  ['::: {class="callout-note" data-x="' + LS + '&"}', LISTED],
  ['::: {class="callout-note" id="a&b"}', LISTED],
  ['::: {class="callout-note&"}', LISTED],
  ['::: {class="a&b callout-note"}', LISTED],
  ["::: {class=callout-note data-x=a\\b}", LISTED],
  ["::: {class='callout-note' data-x='" + ABOVE_FF + "&'}", LISTED],
  // A dotted class AND an escape in the value of `class=`: the reader declines and the regex reader finds the dotted class, so the heading is consumed all the same (a fallback that answered false would list it).
  ['::: {.callout-note class="x" data-x="a&b"}', HIDDEN],
  ['::: {.panel-tabset class="x" data-x="a&b"}', HIDDEN],
  ['::: {class="panel-tabset" data-x="&"}', LISTED],
  ['::: {data-x="&" class="panel-tabset"}', HIDDEN],
  ['::: {class="panel-tabset" data-x="}&"}', HIDDEN],
];
describe("Session 339 — the call site: an opener whose class value holds an escape is read by the regex reader", () => {
  it.each(OPENERS.map(([opener, expected]) => [JSON.stringify(opener), opener, expected] as const))("%s", (_label, opener, expected) => {
    const text = `${opener}\n\n## T\n\nbody\n:::\n\n# H\n`;
    expect(findHeadings(text).map((h) => h.text)).toEqual(expected);
  });
});

// The cure on a line of 10,000,000 characters: no stack (the old pattern is not asked, it would take hours), a linear scan. A run of 1,700,000 `class=` is 10,200,000 characters.
describe("Session 339 — classValueMayHoldEscape on lines of 10,000,000 characters", () => {
  const LIMIT_MS = 1000;
  const clock = <T,>(run: () => T): { result: T; ms: number } => {
    const started = performance.now();
    const result = run();
    return { result, ms: performance.now() - started };
  };
  const RUN = "class=".repeat(1_700_000);
  const BIG = 10_000_000;
  it.each([
    ["1,700,000 `class=` and nothing else", RUN, false],
    ["1,700,000 `class=` and an ampersand", RUN + "&", true],
    ["1,700,000 `class=` and a backslash", RUN + "\\", true],
    ["1,700,000 `class=`, a `}` and an ampersand", RUN + "}&", false],
    ["a character above U+00FF, 1,700,000 `class=` and an ampersand", ABOVE_FF + RUN + "&", true],
    ["a character above U+00FF, 1,700,000 `class=` and nothing else", ABOVE_FF + RUN, false],
    ["an astral pair, 1,700,000 `class=`, a `}` and an ampersand", ASTRAL + RUN + "}&", false],
    ["10,000,000 ampersands, no `class=`", "&".repeat(BIG), false],
    ["10,000,000 `}`", "}".repeat(BIG), false],
    ["`class=`, 10,000,000 letters and an ampersand", "class=" + "a".repeat(BIG) + "&", true],
    ["`class=`, 10,000,000 letters, a `}` and an ampersand", "class=" + "a".repeat(BIG) + "}&", false],
    ["an ampersand, then 10,000,000 letters and `class=`", "&" + "a".repeat(BIG) + "class=", false],
    ["`}class=` x 1,700,000 and an ampersand", "}class=".repeat(1_700_000) + "&", true],
    ["`class=}` x 1,700,000 and an ampersand", "class=}".repeat(1_700_000) + "&", false],
  ] as Array<[string, string, boolean]>)("%s", (_label, tail, expected) => {
    const { result, ms } = clock(() => classValueMayHoldEscape(tail));
    expect(result).toBe(expected);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, HEAVY_ROW_MS);

  // The old pattern can fail the clock: it takes over a second on the shape the rows of `s339-div-class-rows.test.ts` use (`k="` + 24,000 `class=` + `"}`), where the new function takes about a millisecond.
  const OLD_RUN = 24_000;
  const OLD_FLOOR_MS = 1000;
  it("the clock row can fail: the old pattern takes over a second on `k=\"` + 24,000 `class=` + `\"}`", () => {
    const tail = `{k="${"class=".repeat(OLD_RUN)}"}`;
    const { result, ms } = clock(() => OLD_CLASS_ESCAPE.test(tail));
    expect(result).toBe(false);
    expect(ms).toBeGreaterThan(OLD_FLOOR_MS);
  }, HEAVY_ROW_MS);
  it("keeps the sizes, the limit and the floor the clock rows above are built on", () => {
    expect([LIMIT_MS, BIG, RUN.length, OLD_RUN, OLD_FLOOR_MS]).toEqual([1000, 10_000_000, 10_200_000, 24_000, 1000]);
  });
});
