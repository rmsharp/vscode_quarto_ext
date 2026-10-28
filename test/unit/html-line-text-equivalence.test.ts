import { describe, expect, it } from "vitest";
import { htmlLineHasText } from "../../src/core/qmd/model";
import { BOM, JS_WHITESPACE, LS, NBSP, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 334 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (4).
// `htmlLineHasText` answered "does a raw HTML line leave TEXT behind its tags" by stripping every tag with a global regex, `/<(?:[^>"']|"[^"]*"|'[^']*')*>/g`, and trimming what was left. A `<` that opens no
// tag (no `>` outside the quotes reaches it) stays in the text, so the answer is already TRUE at the first one, and the global regex went on trying every later `<` for nothing: each of a run of n of them
// read to the end of the line, n squared. It is now one left-to-right scan that answers at the first character that is not whitespace and not inside a tag. The old function is kept below, copied from the
// parent `8cbb2d2` (`src/core/qmd/model.ts` before the cure), as the oracle (Learning 738), beside a reading by definition that uses no regex at all; the pinned counts (how many strings of each
// enumeration are TRUE) come from those two and never from the code under test.

// ---- The OLD function, copied from the parent `8cbb2d2`. ----
function oldHtmlLineHasText(line: string): boolean {
  return /^[ \t]*<\/?[A-Za-z]/.test(line) && line.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, "").trim() !== "";
}

// ---- A reading of the old function by DEFINITION, with no regular expression. ----
// A tag at `at` is the shortest run `<`, units, `>` where a unit is one character that is not `>`, `"` or `'`, or a double-quoted or single-quoted string; units are taken greedily and the `>` must follow the last
// one (the regex's star gives units back, but a unit never ends in `>`, so a shorter run can never be followed by one). Tags are stripped left to right; a `<` that opens none stays.
function definitionTagEnd(line: string, at: number): number {
  let position = at + 1;
  for (;;) {
    const c = line[position];
    if (c === ">") {
      return position + 1;
    }
    if (c === undefined) {
      return -1;
    }
    if (c === '"' || c === "'") {
      let close = position + 1;
      while (close < line.length && line[close] !== c) {
        close++;
      }
      if (close >= line.length) {
        return -1;
      }
      position = close + 1;
    } else {
      position++;
    }
  }
}
function isAsciiLetter(c: string | undefined): boolean {
  return c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z"));
}
function definitionHasText(line: string): boolean {
  let start = 0;
  while (line[start] === " " || line[start] === "\t") {
    start++;
  }
  if (line[start] !== "<" || !isAsciiLetter(line[line[start + 1] === "/" ? start + 2 : start + 1])) {
    return false;
  }
  let kept = "";
  for (let i = 0; i < line.length; ) {
    if (line[i] === "<") {
      const end = definitionTagEnd(line, i);
      if (end >= 0) {
        i = end;
        continue;
      }
    }
    kept += line[i];
    i++;
  }
  return Array.from(kept).some((c) => !JS_WHITESPACE.has(c));
}

type Count = { compared: number; hasText: number; disagreements: string[] };
/** Compare the new function with the old one and with the reading by definition over `texts`: how many were compared, how many the OLD function called TRUE, and the first few disagreements of either. */
function compareAll(texts: Iterable<string>): Count {
  let compared = 0;
  let hasText = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldHtmlLineHasText(text);
    compared++;
    if (expected) {
      hasText++;
    }
    const now = htmlLineHasText(text);
    const byDefinition = definitionHasText(text);
    if ((now !== expected || byDefinition !== expected) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
  }
  return { compared, hasText, disagreements };
}

// Every string of up to `maxLength` characters over an alphabet, behind a prefix that passes the guard (`^[ \t]*<\/?[A-Za-z]`) unless the row is about the guard itself.
const NARROW = ["<", ">", '"', "'", " ", "x", "/"];
const WIDE = ["<", ">", '"', " ", "\t", NBSP, LS, PS, "\r", BOM, "x"];
const GUARD = ["<", "/", "a", "A", "1", " ", "\t", ">", '"'];
// Tokens, not characters: whole quoted strings holding a `>` or a `<`, whole tags, a tag name with a space, an equals sign.
const TOKENS = ["<", ">", '"', "'", '"x>y"', "'p>q'", "<b>", "</b>", " ", "z", "<i ", "="];

function* behind(prefix: string, alphabet: readonly string[], maxLength: number): Generator<string> {
  for (const body of everyString(alphabet, maxLength)) {
    yield prefix + body;
  }
}

const ENUMERATIONS: Array<{ label: string; prefix: string; alphabet: readonly string[]; maxLength: number; hasText: number }> = [
  { label: "7 characters behind `<a`, up to 8", prefix: "<a", alphabet: NARROW, maxLength: 8, hasText: 6_512_191 },
  { label: "11 characters behind `<a`, up to 6", prefix: "<a", alphabet: WIDE, maxLength: 6, hasText: 1_692_865 },
  { label: "9 characters with no prefix (the guard), up to 7", prefix: "", alphabet: GUARD, maxLength: 7, hasText: 175_836 },
  { label: "12 tokens behind `<a`, up to 5", prefix: "<a", alphabet: TOKENS, maxLength: 5, hasText: 248_830 },
];

// A seeded sample of longer texts: 0 to 14 pieces, each repeated 1 to 3 times, behind one of five prefixes. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3341;
const PIECES = ["<", "<", ">", '"', "'", " ", "x", "ab", "<b>", "</b>", '"x>y"', "'p>q'", "<i ", "\t", NBSP, "=", "/"];
const PREFIXES = ["<a", "</a", " <b", "\t<c", ""];
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

// Run lengths of `<` around every boundary, behind a tag, with every way the run's tail can keep a `>` out of reach or let one in: quotes that close, quotes that do not, a `>` inside quotes, a bare `>`.
const RUNS = [0, 1, 2, 3, 5, 9, 100];
function* runGrid(): Generator<string> {
  for (const before of ["<p>", "<p>x ", "</p>", " <b>"]) {
    for (const run of RUNS) {
      for (const middle of ["", '"', "'", '"a>b"', "'a>b'", ">", '">', "<>"]) {
        for (const tail of ["", " ", "x", ">", "<", '"']) {
          yield `${before}${"<".repeat(run)}${middle}${tail}`;
        }
      }
    }
  }
}

// What each line is, stated by hand (the tag-only lines are no text; a `<` that opens no tag, a stray `>` and a quote are; the whitespace is the set `trim` removes, and a zero-width space is not in it).
const STATED: Array<[string, boolean]> = [
  ["<p>", false],
  ["<p>x", true],
  ["<p>x</p>", true],
  ["</p>", false],
  ["<br>", false],
  ["<div>text</div>", true],
  ['<div class="a>b">', false],
  ["<div class='a>b'>", false],
  ["<p><", true],
  ["<p>>", true],
  ['<p>"', true],
  ["<p>'", true],
  ["<p>  ", false],
  ["<p><b></b>", false],
  ['<a href="x>y">z', true],
  ['<a href="x>y', true],
  ["<p> <b> ", false],
  ["x<p>", false],
  ["  <p>", false],
  ["\t</p>x", true],
  ["<p" + NBSP, true],
  ["<p>" + NBSP, false],
  ["<p>" + LS, false],
  ["<p>" + BOM, false],
  ["<p>" + String.fromCharCode(0x200b), true],
  ["<1>", false],
  ["< p>", false],
  ["<p", true],
  ["", false],
];

describe("Session 334 — htmlLineHasText: the new scan answers what the old tag-stripping regex did", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(behind(e.prefix, e.alphabet, e.maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.hasText).toBe(e.hasText);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const result = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.hasText).toBe(236_305);
  }, HEAVY_ROW_MS);

  it("a grid of `<` runs, quote tails and stray `>`", () => {
    const result = compareAll(runGrid());
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(4 * RUNS.length * 8 * 6);
    expect(result.hasText).toBe(1_206);
  });

  it.each(STATED.map(([line, expected]) => [JSON.stringify(line), line, expected] as const))("%s is stated as %s by hand, by the old function and by the new one", (_label, line, expected) => {
    expect(oldHtmlLineHasText(line)).toBe(expected);
    expect(definitionHasText(line)).toBe(expected);
    expect(htmlLineHasText(line)).toBe(expected);
  });
});
