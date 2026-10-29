import { describe, expect, it } from "vitest";
import { commentFullLine, commentFullLineCol0, commentThenText } from "../../src/core/qmd/model";
import { LS, NBSP, PS, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 336 — the BACKLOG item "Three more single-line shapes found by Session 335's review round", part (1). A line that opens an HTML comment and holds no `-->` was read by
// `^[ \t]*<!--(?:(?!-->)[\s\S])*-->[ \t]*$` (`COMMENT_FULL_LINE`, a line of the body that renders to nothing), by the same pattern at column 0 (`COMMENT_FULL_LINE_COL0`, a comment that ends a block) and,
// through `provableProse`, by `^ {0,3}<!--(?:(?!-->).)*-->[ \t]*[A-Za-z]` (a comment with text after it on the line). V8 keeps one entry of its regex backtrack stack per repetition of a group, so a
// line of 8,388,573 or more characters after the opener threw `RangeError: Maximum call stack size exceeded` (bisected at `aea22f6`, a fresh process per probe), and the error reached every reader of the
// document. The closer is the FIRST `-->` that starts at or after the end of the opener (the tempered body cannot cross one, and the tail after it must be blanks, or for the third a letter), so each
// is one `indexOf` and a short scan: `commentFullLine`, `commentFullLineCol0` and `commentThenText`. The old patterns are kept below, copied from the parent `aea22f6`, as the oracle (Learning 738), beside a reading
// by definition that uses no regex; the pinned counts come from the old patterns and from a Python port of the definition (no code shared with the TypeScript) and never from the code under test.

// ---- The OLD patterns, copied from the parent `aea22f6`. ----
const OLD_FULL = /^[ \t]*<!--(?:(?!-->)[\s\S])*-->[ \t]*$/;
const OLD_COL0 = /^<!--(?:(?!-->)[\s\S])*-->[ \t]*$/;
const OLD_THEN_TEXT = /^ {0,3}<!--(?:(?!-->).)*-->[ \t]*[A-Za-z]/;

// ---- A reading of the old patterns by DEFINITION, with no regular expression. The closer is the first `-->` that starts at or after the end of the opener; ----
function definitionFull(line: string, anyIndent: boolean): boolean {
  let at = 0;
  if (anyIndent) {
    while (line[at] === " " || line[at] === "\t") {
      at++;
    }
  }
  if (line.slice(at, at + 4) !== "<!--") {
    return false;
  }
  let close = -1;
  for (let i = at + 4; i + 3 <= line.length; i++) {
    if (line[i] === "-" && line[i + 1] === "-" && line[i + 2] === ">") {
      close = i;
      break;
    }
  }
  if (close < 0) {
    return false;
  }
  for (let i = close + 3; i < line.length; i++) {
    if (line[i] !== " " && line[i] !== "\t") {
      return false;
    }
  }
  return true;
}
// ... for the third pattern the indent is spaces only and at most three, no character of the body is a line terminator (`.`), and a letter follows the blanks after the closer.
function definitionThenText(line: string): boolean {
  let at = 0;
  while (line[at] === " ") {
    at++;
  }
  if (at > 3 || line.slice(at, at + 4) !== "<!--") {
    return false;
  }
  let close = -1;
  for (let i = at + 4; i + 3 <= line.length; i++) {
    if (line[i] === "-" && line[i + 1] === "-" && line[i + 2] === ">") {
      close = i;
      break;
    }
  }
  if (close < 0) {
    return false;
  }
  for (let i = at + 4; i < close; i++) {
    if (line[i] === "\n" || line[i] === "\r" || line[i] === LS || line[i] === PS) {
      return false;
    }
  }
  let rest = close + 3;
  while (line[rest] === " " || line[rest] === "\t") {
    rest++;
  }
  return rest < line.length && /[A-Za-z]/.test(line[rest]);
}

type Count = { compared: number; full: number; col0: number; thenText: number; disagreements: string[] };
/** Compare the three new functions with the old patterns and the reading by definition over `lines`: how many were compared and how many each OLD pattern accepted. */
function compareAll(lines: Iterable<string>): Count {
  const count: Count = { compared: 0, full: 0, col0: 0, thenText: 0, disagreements: [] };
  for (const line of lines) {
    count.compared++;
    const expected = [OLD_FULL.test(line), OLD_COL0.test(line), OLD_THEN_TEXT.test(line)];
    if (expected[0]) count.full++;
    if (expected[1]) count.col0++;
    if (expected[2]) count.thenText++;
    const now = [commentFullLine(line), commentFullLineCol0(line), commentThenText(line)];
    const byDefinition = [definitionFull(line, true), definitionFull(line, false), definitionThenText(line)];
    if ((now.some((v, i) => v !== expected[i]) || byDefinition.some((v, i) => v !== expected[i])) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

const PIECES = ["<!--", "-->", "--", "->", ">", "-", "<!", " ", "\t", "a", "\r", LS, "\n", NBSP, "<", "!"];
const NARROW = ["<", "!", "-", ">", " ", "a"];
const LINE_ENDS = ["<", "!", "-", ">", "\t", "Z", "\n", PS];
const DENSE = ["<!--", "-->", " ", "\t", "a", "-", ">", "\r"];
const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; full: number; col0: number; thenText: number }> = [
  { label: "16 pieces (an opener, a closer, two dashes, `->`, `>`, `-`, `<!`, a blank, a tab, a letter, CR, U+2028, LF, a no-break space, `<`, `!`), up to 5", alphabet: PIECES, maxLength: 5, full: 7_236, col0: 6_292, thenText: 954 },
  { label: "6 characters (`<`, `!`, `-`, `>`, a blank, a letter), up to 8", alphabet: NARROW, maxLength: 8, full: 9, col0: 8, thenText: 1 },
  { label: "8 characters (`<`, `!`, `-`, `>`, a tab, `Z`, LF, U+2029), up to 7", alphabet: LINE_ENDS, maxLength: 7, full: 1, col0: 1, thenText: 0 },
  { label: "8 pieces dense in accepted lines (an opener, a closer, a blank, a tab, a letter, `-`, `>`, CR), up to 6", alphabet: DENSE, maxLength: 6, full: 6_085, col0: 4_367, thenText: 2_396 },
];

// Every UTF-16 code unit at every place of a line that is, or nearly is, a whole-line comment, in place of each character and between them.
const HEADS = ["<!--a-->", "  <!--a--> \t", "<!--a-->b", " <!-- a --> \tZ", "<!-->-->", "<!--->  "];

// A seeded sample: a lead, an opener, 0 to 5 pieces of body, a closer (four times in five) and 0 to 2 pieces of tail. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3361;
const LEADS = ["", "", "", " ", "  ", "   ", "    ", "\t", " \t"];
const BODY_PIECES = ["a", " ", "-", "--", ">", "->", "<!--", "\r", LS, PS, "x y", "--->", "- >"];
const TAIL_PIECES = ["", "", " ", "\t", "x", "Z", "1", " \tq", "\r", NBSP, LS, "-->", " <!-- b -->", "--"];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = LEADS[Math.floor(next() * LEADS.length)] + "<!--";
    const parts = Math.floor(next() * 6);
    for (let part = 0; part < parts; part++) {
      text += BODY_PIECES[Math.floor(next() * BODY_PIECES.length)].repeat(1 + Math.floor(next() * 2));
    }
    if (next() < 0.8) {
      text += "-->";
    }
    const tails = Math.floor(next() * 3);
    for (let part = 0; part < tails; part++) {
      text += TAIL_PIECES[Math.floor(next() * TAIL_PIECES.length)];
    }
    yield text;
  }
}

// What each line is, stated by hand: [line, a whole-line comment, one at column 0, a comment with text after it].
const STATED: Array<[string, boolean, boolean, boolean]> = [
  ["", false, false, false],
  ["<!-- c -->", true, true, false],
  ["<!-- c -->  \t", true, true, false],
  ["  <!-- c -->  ", true, false, false],
  ["\t<!-- c -->", true, false, false],
  ["<!-- c --> x", false, false, true],
  ["<!-- c -->x", false, false, true],
  ["<!-- c --> \tZ", false, false, true],
  ["<!-- c --> 1", false, false, false],
  ["   <!-- c --> x", false, false, true],
  ["    <!-- c --> x", false, false, false],
  ["<!-- c", false, false, false],
  ["<!--", false, false, false],
  ["<!-->", false, false, false],
  ["<!--->", false, false, false],
  ["<!---->", true, true, false],
  ["<!---->  ", true, true, false],
  ["<!----> x", false, false, true],
  ["<!-- a --> <!-- b -->", false, false, false],
  ["<!-- a -->-->", false, false, false],
  ["<!-- a --->", true, true, false],
  ["<!-- a \r -->", true, true, false],
  ["<!-- a \r --> x", false, false, false],
  ["<!-- a " + LS + " -->", true, true, false],
  ["<!-- a " + LS + " --> x", false, false, false],
  ["<!-- a " + PS + " --> x", false, false, false],
  ["<!-- a -->\r", false, false, false],
  ["<!-- a -->" + NBSP, false, false, false],
  ["<!-- a --> " + NBSP + "x", false, false, false],
  ["<!-- a --\n> -->", true, true, false],
  ["<!-- a -- > -->", true, true, false],
  ["x <!-- c -->", false, false, false],
  ["<!-- c -- >", false, false, false],
  [" <!-- c -->x", false, false, true],
];

describe("Session 336 — commentFullLine, commentFullLineCol0 and commentThenText: the closer is found where `(?:(?!-->)…)*` found it", () => {
  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(everyString(e.alphabet, e.maxLength));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countStrings(e.alphabet.length, e.maxLength), full: e.full, col0: e.col0, thenText: e.thenText });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at every place of six near-comment lines", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnitEdit(HEADS));
    expect(disagreements).toEqual([]);
    expect(counts.compared).toBe(countCodeUnitEdits(HEADS));
    expect(counts).toEqual({ compared: 8_126_464, full: 589_893, col0: 393_248, thenText: 787_210 });
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, full: 91_089, col0: 30_381, thenText: 14_255 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, full, col0, thenText]) => [JSON.stringify(line), line, full, col0, thenText] as const))("%s is, by hand, by the old patterns, by the definition and by the new functions: whole-line %s, at column 0 %s, with text after %s", (_label, line, full, col0, thenText) => {
    expect([OLD_FULL.test(line), OLD_COL0.test(line), OLD_THEN_TEXT.test(line)]).toEqual([full, col0, thenText]);
    expect([definitionFull(line, true), definitionFull(line, false), definitionThenText(line)]).toEqual([full, col0, thenText]);
    expect([commentFullLine(line), commentFullLineCol0(line), commentThenText(line)]).toEqual([full, col0, thenText]);
  });

  // The cure itself: a line past the old overflow (8,388,573 characters after the opener) is read. The old patterns are compared only below that, where they still read.
  const SMALL_RUNS = [1, 2, 100, 4_096, 65_536, 1_000_000, 8_000_000];
  const LONG_RUNS = [8_388_573, 8_400_000, 17_000_000];
  it.each(SMALL_RUNS)("a comment of %i characters ends where the old patterns say, with and without a closer and a tail", (n) => {
    const run = "b".repeat(n);
    for (const open of ["<!--", " <!--", "   <!--", "\t<!--"]) {
      for (const tail of ["", "-->", "--> ", "-->\t", "--> x", "-->x", "-->-->", "--> <!-- b -->", "--", "->", ">", "-->\r", "--> 1"]) {
        const line = open + run + tail;
        expect(commentFullLine(line)).toBe(OLD_FULL.test(line));
        expect(commentFullLineCol0(line)).toBe(OLD_COL0.test(line));
        expect(commentThenText(line)).toBe(OLD_THEN_TEXT.test(line));
      }
    }
  }, HEAVY_ROW_MS);

  it.each(LONG_RUNS)("a comment of %i characters is read, whatever follows", (n) => {
    const run = "b".repeat(n);
    expect(commentFullLine("<!--" + run)).toBe(false);
    expect(commentFullLine("<!--" + run + "-->")).toBe(true);
    expect(commentFullLine("  <!--" + run + "--> \t")).toBe(true);
    expect(commentFullLine("<!--" + run + "--> x")).toBe(false);
    expect(commentFullLine("<!--" + run + "-->-->")).toBe(false);
    expect(commentFullLine("<!--" + run + "--" + run)).toBe(false);
    expect(commentFullLineCol0("<!--" + run + "-->")).toBe(true);
    expect(commentFullLineCol0(" <!--" + run + "-->")).toBe(false);
    expect(commentFullLineCol0("<!--" + run)).toBe(false);
    expect(commentThenText("<!--" + run)).toBe(false);
    expect(commentThenText("<!--" + run + "--> x")).toBe(true);
    expect(commentThenText("   <!--" + run + "-->x")).toBe(true);
    expect(commentThenText("    <!--" + run + "-->x")).toBe(false);
    expect(commentThenText("<!--" + run + "-->")).toBe(false);
    expect(commentThenText("<!--" + run + "\r-->x")).toBe(false);
    expect(commentFullLine("<!--" + run + "\r-->")).toBe(true);
    // the opener repeated, and a closer-less line of blanks: the other shapes of the item (`<!-- ` x 3,400,000 and `<!--` x 4,200,000 are 17 and 16.8 million characters)
    expect(commentFullLine("<!-- ".repeat(Math.ceil(n / 5)))).toBe(false);
    expect(commentFullLine("<!--".repeat(Math.ceil(n / 4)))).toBe(false);
    expect(commentFullLine("<!-- ".repeat(Math.ceil(n / 5)) + "-->")).toBe(true);
  }, HEAVY_ROW_MS);

  it("a line of 45,000,000 characters is read in linear time", () => {
    const run = "b".repeat(45_000_000);
    const started = Date.now();
    expect(commentFullLine("<!--" + run)).toBe(false);
    expect(commentFullLineCol0("<!--" + run + "-->")).toBe(true);
    expect(commentThenText("<!--" + run + "--> x")).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

// The review round of Session 336 (its mutation lens, `tools/mutation-run/mutants/s336-comment-full-line-review.json`): edits that capped the blank run after a closer, the blank gap before the letter of `commentThenText` and
// the indent before an opener at 4,096, 65,536 or 2^20 characters, and edits that looked for a line terminator only in the first or last 4,096, 65,536 or 2^23 characters of a long body, all survived: no row held a blank run
// longer than three characters or a terminator that is neither near the opener nor near the closer of a long body. The old patterns read both at any length (a class star, and a body of one character per repetition), so
// they are compared wherever they still read (below the overflow).
describe("Session 336 review — long runs of blanks and a line terminator in the middle of a long body", () => {
  it.each([4_097, 70_000, 1_100_000])("%i blanks after the closer, before the opener, and between the closer and a letter", (n) => {
    const blanks = " ".repeat(n);
    const tabs = "\t".repeat(n);
    for (const run of [blanks, tabs, blanks + tabs]) {
      for (const [line, full, col0, thenText] of [
        ["<!-- c -->" + run, true, true, false],
        ["<!-- c -->" + run + "x", false, false, true],
        ["<!-- c -->" + run + "1", false, false, false],
        ["<!-- c -->" + run + "\r", false, false, false],
        [run + "<!-- c -->", true, false, false],
        [run + "<!-- c -->" + run, true, false, false],
        ["   <!-- c -->" + run + "z", false, false, true],
      ] as Array<[string, boolean, boolean, boolean]>) {
        expect([commentFullLine(line), commentFullLineCol0(line), commentThenText(line)]).toEqual([full, col0, thenText]);
        expect([OLD_FULL.test(line), OLD_COL0.test(line), OLD_THEN_TEXT.test(line)]).toEqual([full, col0, thenText]);
      }
    }
  }, HEAVY_ROW_MS);

  // A terminator at the start, in the middle and (the earlier rows) just before the closer of a body; 70,000 puts it outside a window of 65,536 from either end, and two halves of 9,000,000 outside a window of 2^23 from either end.
  it.each([70_000, 9_000_000])("a line terminator in a body of two halves of %i characters refuses the comment-then-text, wherever it sits", (n) => {
    const half = "b".repeat(n);
    for (const terminator of ["\r", "\n", LS, PS]) {
      expect(commentThenText("<!--" + terminator + half + half + "--> x")).toBe(false);
      expect(commentThenText("<!--" + half + terminator + half + "--> x")).toBe(false);
      expect(commentThenText("<!--" + half + half + terminator + "--> x")).toBe(false);
      if (n === 70_000) {
        expect(OLD_THEN_TEXT.test("<!--" + half + terminator + half + "--> x")).toBe(false);
      }
    }
    expect(commentThenText("<!--" + half + half + "--> x")).toBe(true);
    expect(commentFullLine("<!--" + half + "\r" + half + "-->")).toBe(true); // the whole-line comment's body may hold a terminator
  }, HEAVY_ROW_MS);
});
