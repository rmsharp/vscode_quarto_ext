import { describe, expect, it } from "vitest";
import { cellLanguageId } from "../../src/core/embedded/lang-map";
import { type Cell, findAllCells, findCellAtPosition, findCellOptionLines } from "../../src/core/qmd/model";
import { type EmbeddedHit, createRangeLookup } from "../../src/core/embedded/virtual-doc";
import { LS, NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take a few seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 342 -- the BACKLOG item "What Session 341's review round found beside the Outline and preview cures", part (3). The completion edit filter (`filterOutOfCellEdits`, `src/providers/embedded.ts`) and the
// formatter edit check (`rangeWithinCell`, `src/features/format-cell.ts`) asked `embeddedCellAt(text, line)` (and the second `findCellAtPosition(text, line)`) once per LINE of every range, each a scan of every cell and
// every cell's option lines. `createRangeLookup(text)` is made once per call: `hitAt(line)` must answer what `embeddedCellAt(text, line)` answers, and `rangeInLanguageBody` / `rangeInCellBody` what the two adapters' loops
// answered over it, for EVERY number: a fraction, `NaN`, an infinity, `-0`, a negative and a value past the end of the text (Learning 914).
//
// The OLD spelling is kept here, copied VERBATIM from the parent `10e6b9c` (`embeddedCellAt` in `src/core/embedded/virtual-doc.ts`, `rangeInSameLangBody` in `src/providers/embedded.ts`, `rangeWithinCell` in
// `src/features/format-cell.ts`, the last two with the `vscode.Range` they took replaced by the two numbers they read from it), as the oracle (Learning 738): `embeddedCellAt` in the source is not an oracle for itself
// once a later change respells it on top of the lookup.
//
// The counts pinned below (how many documents, cells, lines asked, hits, ranges asked and kept the enumerations reach) come from the Python recount `tools/range-lookup-count/count_ranges.py`, which shares no code with
// this file and reads each document by the definition of a fence, and never from the code under test.

// ---- The OLD spelling, copied VERBATIM from the parent `10e6b9c`. ----
function bodyLineCount(cell: Cell): number {
  return cell.code === "" ? 0 : cell.code.split("\n").length;
}

function oldEmbeddedCellAt(text: string, line: number): EmbeddedHit | null {
  const cell = findCellAtPosition(text, line);
  if (cell === null) {
    return null;
  }
  const el = cellLanguageId(cell.lang);
  if (el === null) {
    return null;
  }
  const firstBody = cell.startLine + 1;
  const lastBody = cell.startLine + bodyLineCount(cell);
  if (line < firstBody || line > lastBody) {
    return null; // a fence line, not body
  }
  if (findCellOptionLines(text).some((o) => o.line === line)) {
    return null; // a `#|` / `//|` option line — belongs to YAML
  }
  return { lang: cell.lang, languageId: el.languageId, ext: el.ext };
}

function oldRangeInSameLangBody(text: string, start: number, end: number, languageId: string): boolean {
  for (let line = start; line <= end; line++) {
    const hit = oldEmbeddedCellAt(text, line);
    if (hit === null || hit.languageId !== languageId) {
      return false;
    }
  }
  return true;
}

function oldRangeWithinCell(text: string, start: number, end: number, cell: Cell): boolean {
  for (let line = start; line <= end; line++) {
    if (oldEmbeddedCellAt(text, line) === null) {
      return false; // a fence, a `#|` directive, prose, YAML — never code we may rewrite
    }
    const owner = findCellAtPosition(text, line);
    if (owner === null || owner.startLine !== cell.startLine) {
      return false; // a body line, but of a DIFFERENT cell
    }
  }
  return true;
}

describe("Session 342 -- the old spelling is what the parent had, and the oracle can fail", () => {
  const text = "p\n```{python}\n#| echo: false\nx = 1\n```\n```{r}\ny\n```\n";
  // 0 p | 1 fence py | 2 option | 3 `x = 1` | 4 fence | 5 fence r | 6 `y` | 7 fence | 8 (empty)

  it("the verbatim copy of embeddedCellAt keeps a body line, drops the fences and the option line, and names the language", () => {
    expect(oldEmbeddedCellAt(text, 3)).toEqual({ lang: "python", languageId: "python", ext: "py" });
    expect(oldEmbeddedCellAt(text, 6)).toEqual({ lang: "r", languageId: "r", ext: "r" });
    for (const line of [0, 1, 2, 4, 5, 7, 8, 9, -1]) expect(oldEmbeddedCellAt(text, line)).toBeNull();
  });

  it("the verbatim copies of the two loops answer the stated ranges", () => {
    const [python, r] = findAllCells(text);
    expect(oldRangeInSameLangBody(text, 3, 3, "python")).toBe(true);
    expect(oldRangeInSameLangBody(text, 3, 4, "python")).toBe(false);
    expect(oldRangeInSameLangBody(text, 6, 6, "python")).toBe(false);
    expect(oldRangeWithinCell(text, 3, 3, python)).toBe(true);
    expect(oldRangeWithinCell(text, 3, 3, r)).toBe(false);
    expect(oldRangeWithinCell(text, 6, 6, r)).toBe(true);
  });

  it("the old spelling's answer moves with the text, the language, the cell and the range (so a comparison with it can fail)", () => {
    const [python] = findAllCells(text);
    expect(oldRangeInSameLangBody(text, 3, 3, "python")).not.toBe(oldRangeInSameLangBody(text, 3, 3, "r"));
    expect(oldRangeInSameLangBody(text, 3, 3, "python")).not.toBe(oldRangeInSameLangBody(text.replace("x = 1", "#| x"), 3, 3, "python")); // 3 is an option line now
    expect(oldRangeWithinCell(text, 3, 3, python)).not.toBe(oldRangeWithinCell(text, 3, 3, { ...python, startLine: 5 }));
    expect(oldRangeInSameLangBody(text, 3, 3, "python")).not.toBe(oldRangeInSameLangBody(text, 3, 4, "python"));
  });
});

// ---- What the two are compared on. ----

/** The languages the ranges are asked about: two the alphabets use and one they never do (so the answer is `true` only for a range with no line). */
const LANGS = ["python", "r", "javascript"] as const;

/** A hit as the comparison reads it: all three fields, or `null`. */
const shape = (hit: EmbeddedHit | null): unknown => (hit === null ? null : [hit.lang, hit.languageId, hit.ext]);

/**
 * The numbers asked besides the whole lines. Half a line off every whole line (`L + 0.5` for L from -1 to the last line), then the values a count can never be: `NaN`, the infinities, `-0`, a hair above and below a whole line
 * (the largest double below 1 and the smallest above 0), the smallest and largest doubles, `2^53` and a value far past the end of any text.
 */
function oddNumbers(total: number): number[] {
  const halves = Array.from({ length: total + 2 }, (_, k) => k - 1 + 0.5);
  return [...halves, NaN, Infinity, -Infinity, -0, 1 - 2 ** -53, Number.MIN_VALUE, -Number.MIN_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, 2 ** 53, -(2 ** 53), 1e300, total - 1e-9, total + 1e-9, 0.25, 0.75];
}

interface Tally {
  docs: number;
  cells: number;
  /** Whole-number lines asked of `hitAt` (from -1 to two past the last line, the oracle's answer counted when it is a hit). */
  lineAsks: number;
  hits: number;
  /** Numbers that are not whole lines asked of `hitAt`, and how many of those the oracle answers with a hit. */
  oddAsks: number;
  oddHits: number;
  /** The whole-number ranges asked (start and end each from -1 to one past the last line, start above end included), and for each language how many the oracle keeps. */
  pairs: number;
  kept: Record<(typeof LANGS)[number], number>;
  /** The same ranges asked of every cell the model finds, and how many the oracle keeps. */
  cellAsks: number;
  cellKept: number;
  /** Ranges with a bound that is not a whole line, asked of the three language checks and every cell, and how many the oracle keeps. */
  oddRangeAsks: number;
  oddRangeKept: number;
  disagreements: string[];
}

const newTally = (): Tally => ({ docs: 0, cells: 0, lineAsks: 0, hits: 0, oddAsks: 0, oddHits: 0, pairs: 0, kept: { python: 0, r: 0, javascript: 0 }, cellAsks: 0, cellKept: 0, oddRangeAsks: 0, oddRangeKept: 0, disagreements: [] });

interface Options {
  /** Ask the whole-number ranges (every start against every end from -1 to one past the last line). */
  ranges?: boolean;
  /** Ask a few ranges with bounds that are not whole lines. */
  oddRanges?: boolean;
  /** A few cells the model never found, asked of `rangeInCellBody`. */
  handMade?: readonly Cell[];
}

/** One range asked of all three language checks and of every cell in `cells`: the lookup against the old spelling. Returns how many questions it asked and how many the oracle keeps. */
function compareRange(text: string, lookup: ReturnType<typeof createRangeLookup>, start: number, end: number, cells: readonly Cell[], note: (what: string) => void): { asked: number; kept: number } {
  let asked = 0;
  let kept = 0;
  for (const lang of LANGS) {
    asked++;
    const expected = oldRangeInSameLangBody(text, start, end, lang);
    if (expected) kept++;
    if (lookup.rangeInLanguageBody(start, end, lang) !== expected) note(`rangeInLanguageBody(${start}, ${end}, ${lang})`);
  }
  for (const cell of cells) {
    asked++;
    const expected = oldRangeWithinCell(text, start, end, cell);
    if (expected) kept++;
    if (lookup.rangeInCellBody(start, end, cell) !== expected) note(`rangeInCellBody(${start}, ${end}, the cell ${JSON.stringify(cell)})`);
  }
  return { asked, kept };
}

/** Compare the lookup with the old spelling over one document. */
function compareDocument(text: string, tally: Tally, options: Options = {}): void {
  tally.docs++;
  const lookup = createRangeLookup(text);
  const note = (what: string): void => {
    if (tally.disagreements.length < 5) tally.disagreements.push(`${JSON.stringify(text)}: ${what}`);
  };
  const total = text.split("\n").length;
  // The order the lookup relies on: the model's cells come in document order and never overlap (each starts below the line the one before it ends on).
  const found = findAllCells(text);
  for (let k = 1; k < found.length; k++) {
    if (found[k].startLine <= found[k - 1].endLine) note(`the cells at ${found[k - 1].startLine} and ${found[k].startLine} overlap or are out of order`);
  }
  tally.cells += found.length;
  // hitAt, on every whole line from -1 to two past the last
  for (let line = -1; line <= total + 1; line++) {
    tally.lineAsks++;
    const expected = oldEmbeddedCellAt(text, line);
    if (expected !== null) tally.hits++;
    if (JSON.stringify(shape(lookup.hitAt(line))) !== JSON.stringify(shape(expected))) note(`hitAt(${line})`);
  }
  // hitAt, on the numbers that are not whole lines
  const odd = oddNumbers(total);
  for (const line of odd) {
    tally.oddAsks++;
    const expected = oldEmbeddedCellAt(text, line);
    if (expected !== null) tally.oddHits++;
    if (JSON.stringify(shape(lookup.hitAt(line))) !== JSON.stringify(shape(expected))) note(`hitAt(${line})`);
  }
  const hand = options.handMade ?? [];
  if (options.ranges === true) {
    for (let start = -1; start <= total + 1; start++) {
      for (let end = -1; end <= total + 1; end++) {
        tally.pairs++;
        for (const lang of LANGS) {
          const expected = oldRangeInSameLangBody(text, start, end, lang);
          if (expected) tally.kept[lang]++;
          if (lookup.rangeInLanguageBody(start, end, lang) !== expected) note(`rangeInLanguageBody(${start}, ${end}, ${lang})`);
        }
        for (const cell of found) {
          tally.cellAsks++;
          const expected = oldRangeWithinCell(text, start, end, cell);
          if (expected) tally.cellKept++;
          if (lookup.rangeInCellBody(start, end, cell) !== expected) note(`rangeInCellBody(${start}, ${end}, the cell at ${cell.startLine})`);
        }
      }
    }
  }
  if (options.oddRanges === true) {
    // each odd number as start against a few whole ends, as end against a few whole starts, and against itself
    const wholes = [-1, 0, 1, 2, total - 1, total, total + 1];
    for (const o of odd) {
      for (const [start, end] of [...wholes.flatMap((w): Array<[number, number]> => [[o, w], [w, o]]), [o, o] as [number, number]]) {
        const { asked, kept } = compareRange(text, lookup, start, end, [...found, ...hand], note);
        tally.oddRangeAsks += asked;
        tally.oddRangeKept += kept;
      }
    }
  }
  for (const cell of hand) {
    for (const [start, end] of [[0, total], [-1, 1], [cell.startLine, cell.endLine], [cell.startLine + 1, cell.endLine - 1], [cell.startLine + 1, cell.startLine + 1]]) {
      const expected = oldRangeWithinCell(text, start, end, cell);
      if (lookup.rangeInCellBody(start, end, cell) !== expected) note(`rangeInCellBody(${start}, ${end}, the hand-made cell ${JSON.stringify(cell)})`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// NAMED ROWS. Each states the ANSWER by hand from the lines in the comments, then that the lookup and the oracle both give it.

const DOC = [
  "---", // 0
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Intro prose.", // 4
  "```{python}", // 5   cell A: lines 5 to 10, body lines 7 to 9 (6 is its option line)
  "#| echo: false", // 6
  "import os", // 7
  "  ", // 8
  "x = 1", // 9
  "```", // 10
  "", // 11
  "```{python}", // 12  cell B: lines 12 to 14, body line 13
  "y = 2", // 13
  "```", // 14
  "```{r}", // 15  cell C: lines 15 to 17, body line 16
  "z <- 3", // 16
  "```", // 17
  "```{bash}", // 18  cell D: lines 18 to 20, an engine the project does not map
  "echo hi", // 19
  "```", // 20
].join("\n");

/** A fractional or non-finite number can be a line to the old spelling: a body span is `firstBody <= line <= lastBody`, and the option lines are whole numbers, so `6.5` is not one. */
describe("Session 342 -- numbers that are not whole lines: the lookup answers what the old spelling answers, stated by hand", () => {
  const lookup = createRangeLookup(DOC);
  const [cellA, cellB] = findAllCells(DOC);

  // [label, line, the answer]: the span of cell A's body is [6, 9] and 6 is an option line; B's is [13, 13]; C's is [16, 16]
  const HIT_ROWS: Array<[string, number, string | null]> = [
    ["7.5 is inside the body span of A", 7.5, "python"],
    ["8.999 too", 8.999, "python"],
    ["6.5 is in the span, and it is not the option line 6 (a whole number), so it is a hit", 6.5, "python"],
    ["6 is the option line", 6, null],
    ["9.5 is past A's last body line", 9.5, null],
    ["5.5 is above the first body line", 5.5, null],
    ["10 is the closing fence", 10, null],
    ["13 is B's body", 13, "python"],
    ["13.5 is past B's last body line", 13.5, null],
    ["12.5 is above B's first body line, below... B's span is [13, 13]", 12.5, null],
    ["16 is C's body", 16, "r"],
    ["19 is an unmapped engine's body", 19, null],
    ["NaN is no line", NaN, null],
    ["+Infinity is past every line", Infinity, null],
    ["-Infinity is before every line", -Infinity, null],
    ["-0 is line 0, front matter", -0, null],
    ["-0.5 is above the text", -0.5, null],
    ["2^53 is past the text", 2 ** 53, null],
    ["-1e300", -1e300, null],
    ["the largest double", Number.MAX_VALUE, null],
    ["the smallest positive double", Number.MIN_VALUE, null],
    ["a hair below B's body line 13", 13 - 1e-9, null],
    ["a hair above it", 13 + 1e-9, null],
  ];
  it.each(HIT_ROWS.map((row) => [row[0], row] as const))("hitAt: %s", (_label, row) => {
    const [, line, language] = row;
    expect(lookup.hitAt(line)?.languageId ?? null).toBe(language);
    expect(oldEmbeddedCellAt(DOC, line)?.languageId ?? null).toBe(language);
  });

  // [label, start, end, python's answer, A's answer]
  const RANGE_ROWS: Array<[string, number, number, boolean, boolean]> = [
    ["7.5 to 8.5: both inside A's body", 7.5, 8.5, true, true],
    ["7.5 to 9.5: the third line asked, 9.5, is past A's body", 7.5, 9.5, false, false],
    ["6.5 to 8: 6.5, 7.5 are body, 8.5 is past the end of the range", 6.5, 8, true, true],
    ["NaN start: no line", NaN, 5, true, true],
    ["NaN end: no line", 5, NaN, true, true],
    ["both NaN", NaN, NaN, true, true],
    ["-Infinity start: the first line asked is before every line", -Infinity, 5, false, false],
    ["+Infinity end from the middle of A's body: the line past A's last", 7, Infinity, false, false],
    ["+Infinity start and end: one line, +Infinity", Infinity, Infinity, false, false],
    ["+Infinity start, -Infinity end: no line", Infinity, -Infinity, true, true],
    ["-Infinity both: one line, -Infinity", -Infinity, -Infinity, false, false],
    ["-0 to -0: line 0 is front matter", -0, -0, false, false],
    ["2^53 to 2^53: one line, past the text (the increment is lost at 2^53, and still one line is asked)", 2 ** 53, 2 ** 53, false, false],
    ["the largest double: one line, past the text", Number.MAX_VALUE, Number.MAX_VALUE, false, false],
    ["7 to 6: start above end, no line", 7, 6, true, true],
    ["a range beyond the text", 30, 40, false, false],
    ["a range of body lines of two cells", 9, 13, false, false],
  ];
  it.each(RANGE_ROWS.map((row) => [row[0], row] as const))("rangeInLanguageBody and rangeInCellBody: %s", (_label, row) => {
    const [, start, end, inPython, inCellA] = row;
    expect(lookup.rangeInLanguageBody(start, end, "python")).toBe(inPython);
    expect(oldRangeInSameLangBody(DOC, start, end, "python")).toBe(inPython);
    expect(lookup.rangeInCellBody(start, end, cellA)).toBe(inCellA);
    expect(oldRangeWithinCell(DOC, start, end, cellA)).toBe(inCellA);
  });

  it("a range in B asked of cell A is refused, and of cell B kept", () => {
    expect(lookup.rangeInCellBody(13, 13, cellA)).toBe(false);
    expect(lookup.rangeInCellBody(13, 13, cellB)).toBe(true);
    expect(oldRangeWithinCell(DOC, 13, 13, cellA)).toBe(false);
    expect(oldRangeWithinCell(DOC, 13, 13, cellB)).toBe(true);
  });

  it("the cell is known by its start line alone: a hand-made cell with A's start line owns A's body, and one with a start line no cell has owns nothing (NaN never equals itself)", () => {
    const ghost: Cell = { startLine: 5, endLine: 99, lang: "r", code: "" };
    expect(lookup.rangeInCellBody(7, 9, ghost)).toBe(true);
    expect(oldRangeWithinCell(DOC, 7, 9, ghost)).toBe(true);
    for (const startLine of [6, 5.5, -1, NaN, Infinity]) {
      const stranger: Cell = { startLine, endLine: 99, lang: "python", code: "x" };
      expect(lookup.rangeInCellBody(7, 9, stranger)).toBe(false);
      expect(oldRangeWithinCell(DOC, 7, 9, stranger)).toBe(false);
    }
  });

  it("the language names are compared as they are: a case difference, an engine token and the empty string are not the language", () => {
    for (const language of ["Python", "PYTHON", "py", "", "constructor", "__proto__"]) {
      expect(lookup.rangeInLanguageBody(7, 9, language)).toBe(false);
      expect(oldRangeInSameLangBody(DOC, 7, 9, language)).toBe(false);
    }
    expect(lookup.rangeInLanguageBody(7, 6, "")).toBe(true); // no line: nothing to compare
  });
});

describe("Session 342 -- cells the engine map reaches by an own property only, and engines the project does not map", () => {
  it("an engine named like an Object.prototype property is no mapped engine: its cell has no hit and no range in it", () => {
    const text = "```{constructor}\nx\n```\n```{toString}\ny\n```\n```{__proto__}\nz\n```\n";
    const lookup = createRangeLookup(text);
    for (let line = -1; line <= 12; line++) {
      expect(lookup.hitAt(line)).toBeNull();
      expect(oldEmbeddedCellAt(text, line)).toBeNull();
    }
    for (const cell of findAllCells(text)) {
      expect(lookup.rangeInCellBody(cell.startLine + 1, cell.startLine + 1, cell)).toBe(false);
    }
  });

  it("ojs and js cells are javascript: one language, two engine tokens", () => {
    const text = "```{ojs}\na\n```\n```{js}\nb\n```\n";
    const lookup = createRangeLookup(text);
    expect(lookup.hitAt(1)).toEqual({ lang: "ojs", languageId: "javascript", ext: "js" });
    expect(lookup.hitAt(4)).toEqual({ lang: "js", languageId: "javascript", ext: "js" });
    expect(lookup.rangeInLanguageBody(1, 1, "javascript")).toBe(true);
    expect(lookup.rangeInLanguageBody(1, 4, "javascript")).toBe(false); // the fences between
    expect(oldRangeInSameLangBody(text, 1, 4, "javascript")).toBe(false);
  });

  it("a body of one blank line is no body (the documented edge): the old spelling gives it no body line, and so does the lookup", () => {
    const text = "```{python}\n\n```\n```{python}\nx\n```\n";
    const lookup = createRangeLookup(text);
    expect(lookup.hitAt(1)).toBeNull();
    expect(oldEmbeddedCellAt(text, 1)).toBeNull();
    expect(lookup.hitAt(4)).not.toBeNull();
    expect(lookup.rangeInLanguageBody(1, 1, "python")).toBe(false);
  });

  it("a `#|` line under code is code, and a `//|` line in a python cell is code", () => {
    const text = "```{python}\n#| echo: false\nx = 1\n#| not: option\n//| also code\n```\n";
    const lookup = createRangeLookup(text);
    expect([1, 2, 3, 4].map((line) => lookup.hitAt(line)?.languageId ?? null)).toEqual([null, "python", "python", "python"]);
    expect([1, 2, 3, 4].map((line) => oldEmbeddedCellAt(text, line)?.languageId ?? null)).toEqual([null, "python", "python", "python"]);
  });

  it("an ojs cell's `//|` option block is blanked and its `#|` line is code", () => {
    const text = "```{ojs}\n//| echo: false\n#| code\n```\n";
    const lookup = createRangeLookup(text);
    expect([1, 2].map((line) => lookup.hitAt(line)?.languageId ?? null)).toEqual([null, "javascript"]);
  });

  it("a lone CR and a U+2028 inside a line are not line breaks: the numbers are the model's", () => {
    const text = `a\rb\n\`\`\`{python}\nx\ry = 1\n\`\`\`\nu${LS}v\n\`\`\`{r}\n${NBSP}\n\`\`\`\n`;
    const lookup = createRangeLookup(text);
    const asked = Array.from({ length: 12 }, (_, k) => k - 1);
    expect(asked.map((line) => shape(lookup.hitAt(line)))).toEqual(asked.map((line) => shape(oldEmbeddedCellAt(text, line))));
    expect(lookup.hitAt(2)?.languageId).toBe("python");
    expect(lookup.hitAt(6)?.languageId).toBe("r");
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE DIFFERENTIAL. Every document is read by the old spelling and the lookup; a disagreement is recorded as a string and the row asserts that there are none.

const document = (word: string, lines: Record<string, string>): string => [...word].map((s) => lines[s]).join("\n");

const LINES_1: Record<string, string> = {
  a: "```{python}",
  b: "```{r}",
  c: "```{bash}",
  d: "```",
  e: "#| echo: false",
  f: "x = 1",
  g: "",
  h: "  ",
  i: "prose",
  j: "# Heading",
};
const LINES_2: Record<string, string> = { a: "```{python}", b: "```{r}", d: "```", e: "#| echo: false", f: "x = 1", g: "" };

const counts = (tally: Tally): Record<string, number> => ({
  docs: tally.docs,
  cells: tally.cells,
  lineAsks: tally.lineAsks,
  hits: tally.hits,
});

const rangeCounts = (tally: Tally): Record<string, number> => ({
  ...counts(tally),
  pairs: tally.pairs,
  python: tally.kept.python,
  r: tally.kept.r,
  javascript: tally.kept.javascript,
  cellAsks: tally.cellAsks,
  cellKept: tally.cellKept,
});

describe("Session 342 -- every document over a line alphabet (the lookup against the old spelling)", () => {
  // H1 and H2 ask `hitAt` on every line of every document; R1 and R2 ask every range of the smaller ones.
  const H1_LENGTH = 5;
  const H2_LENGTH = 7;
  const R1_LENGTH = 4;
  const R2_LENGTH = 5;

  it("the sizes: H1 reaches 111,111 documents of 0 to 5 lines over ten lines; H2 335,923 of 0 to 7 over six; R1 11,111 of 0 to 4 over ten; R2 9,331 of 0 to 5 over six", () => {
    expect(Object.keys(LINES_1)).toHaveLength(10);
    expect(Object.keys(LINES_2)).toHaveLength(6);
    expect(countStrings(10, H1_LENGTH)).toBe(111_111);
    expect(countStrings(6, H2_LENGTH)).toBe(335_923);
    expect(countStrings(10, R1_LENGTH)).toBe(11_111);
    expect(countStrings(6, R2_LENGTH)).toBe(9_331);
  });

  it("H1: hitAt agrees with the old spelling on every line of every document, and reaches the counts of the Python recount", () => {
    const tally = newTally();
    for (const word of everyString(Object.keys(LINES_1), H1_LENGTH)) {
      compareDocument(document(word, LINES_1), tally);
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/range-lookup-count/count_ranges.py H1`.
    expect(counts(tally)).toEqual({ docs: 111_111, cells: 19_728, lineAsks: 876_544, hits: 12_398 });
  }, HEAVY_ROW_MS);

  it("H2: hitAt agrees on every line of every document over six lines up to seven lines long, and reaches the counts of the Python recount", () => {
    const tally = newTally();
    for (const word of everyString(Object.keys(LINES_2), H2_LENGTH)) {
      compareDocument(document(word, LINES_2), tally);
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/range-lookup-count/count_ranges.py H2`.
    expect(counts(tally)).toEqual({ docs: 335_923, cells: 148_398, lineAsks: 3_292_048, hits: 197_296 });
  }, HEAVY_ROW_MS);

  it("R1: both range checks agree on every range (every start against every end from -1 to one past the last line) of every document of 0 to 4 lines over ten, for three languages and every cell", () => {
    const tally = newTally();
    for (const word of everyString(Object.keys(LINES_1), R1_LENGTH)) {
      compareDocument(document(word, LINES_1), tally, { ranges: true });
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/range-lookup-count/count_ranges.py R1`.
    expect(rangeCounts(tally)).toEqual({ docs: 11_111, cells: 1_353, lineAsks: 76_544, hits: 542, pairs: 528_676, python: 226_409, r: 226_409, javascript: 226_066, cellAsks: 65_250, cellKept: 28_616 });
  }, HEAVY_ROW_MS);

  it("R2: both range checks agree on every range of every document of 0 to 5 lines over six", () => {
    const tally = newTally();
    for (const word of everyString(Object.keys(LINES_2), R2_LENGTH)) {
      compareDocument(document(word, LINES_2), tally, { ranges: true });
    }
    expect(tally.disagreements).toEqual([]);
    // Recounted by `tools/range-lookup-count/count_ranges.py R2`.
    expect(rangeCounts(tally)).toEqual({ docs: 9_331, cells: 2_574, lineAsks: 72_784, hits: 2_024, pairs: 569_956, python: 250_118, r: 250_118, javascript: 248_586, cellAsks: 159_794, cellKept: 72_832 });
  }, HEAVY_ROW_MS);
});

describe("Session 342 -- ranges with bounds that are not whole lines, on every document of 0 to 3 lines over ten and of 4 and 5 lines over six", () => {
  it("R3: both range checks agree with the old spelling on every pairing of an odd number with a whole line (fractions, NaN, infinities, -0, hairs, the largest and smallest doubles), and on four hand-made cells", () => {
    const tally = newTally();
    const handMade: Cell[] = [
      { startLine: 0, endLine: 4, lang: "python", code: "a\nb\nc" },
      { startLine: 0.5, endLine: 4, lang: "r", code: "a" },
      { startLine: NaN, endLine: 4, lang: "python", code: "a" },
      { startLine: -1, endLine: 4, lang: "python", code: "a\nb" },
    ];
    for (const word of everyString(Object.keys(LINES_1), 3)) {
      compareDocument(document(word, LINES_1), tally, { oddRanges: true, handMade });
    }
    for (const word of everyString(Object.keys(LINES_2), 5)) {
      if (word.length === 4 || word.length === 5) compareDocument(document(word, LINES_2), tally, { oddRanges: true, handMade });
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.docs).toBe(1_111 + 1_296 + 7_776);
    // floors, not pinned counts: the odd numbers are a list in this file, and the Python recount reads whole lines only
    expect(tally.oddRangeAsks).toBeGreaterThan(1_000_000);
    expect(tally.oddRangeKept).toBeGreaterThan(30_000);
    expect(tally.oddHits).toBeGreaterThan(500);
  }, HEAVY_ROW_MS);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE SEEDED DIFFERENTIAL: larger documents drawn from a wider pool than the enumerations reach (every engine the project maps and some it does not, `//|` and `%%|` lines, a `#|` block scalar, tilde and four-backtick
// fences, indented and quoted and listed fences, front matter, comments, a lone CR, a U+2028, a no-break space), with LF and CRLF line ends mixed within one document, a few hand-made cells per document, and a
// sample of ranges besides: some inside a cell's own lines (where the answer is often `true`), some with a bound that is not a whole line.

describe("Session 342 -- a seeded differential on larger documents", () => {
  const SEED = 342;
  const SEEDED_COUNT = 6_000;
  const POOL: string[] = [
    "```{python}", "```{python}", "```{python}", "```{r}", "```{r}", "```{ojs}", "```{js}", "```{julia}", "```{bash}", "```{mermaid}", "```{python}", "```{r, echo=FALSE}",
    "```", "```", "```", "```", "````", "~~~", "~~~{python}", "  ```{python}", "  ```", "> ```{python}", "- ```{python}", "```python", "```{{python}}",
    "#| echo: false", "#| echo: false", "#| fig-cap: |", "#|   more text", "//| echo: false", "%%| x: 1", "#|", "# | spaced",
    "x = 1", "x = 1", "y <- 2", "  indented", "def f():", "    return 1", "1 + 1",
    "", "", "  ", "\t", " ",
    "prose", "prose again", "# Heading", "## Sub {#sec-a}", "---", "title: x", "<!--", "-->", "$$",
    "a\rb", `u${LS}v`, `${LS}`, NBSP, "\r",
  ];
  const EOLS = ["\n", "\n", "\n", "\r\n"];
  const ENGINES = ["python", "r", "ojs", "js", "julia", "bash", "", "constructor"];
  const CODES = ["", "a", "a\nb\nc", "\n", "   ", "x = 1\n#| echo: false"];

  it(`agrees with the old spelling on ${SEEDED_COUNT.toLocaleString("en-US")} documents (a body of 1 to 40 lines, and a 3-line front matter before it in 30% of them), on six hand-made cells of each, and on 24 sampled ranges`, () => {
    const random = seededRandom(SEED);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const tally = newTally();
    let multiLineKept = 0;
    let withCells = 0;
    for (let n = 0; n < SEEDED_COUNT; n++) {
      const lines: string[] = [];
      if (random() < 0.3) lines.push("---", "title: t", "---");
      const length = 1 + Math.floor(random() * 40);
      for (let k = 0; k < length; k++) lines.push(pick(POOL));
      let text = "";
      for (let k = 0; k < lines.length; k++) text += lines[k] + (k < lines.length - 1 ? pick(EOLS) : "");
      const total = text.split("\n").length;
      const handMade: Cell[] = [];
      for (let k = 0; k < 4; k++) {
        const startLine = Math.floor(random() * (total + 6)) - 2;
        const code = pick(CODES);
        handMade.push({ startLine, endLine: startLine + 1 + code.split("\n").length, lang: pick(ENGINES), code });
      }
      for (let k = 0; k < 2; k++) {
        const startLine = Math.floor(random() * (total + 6)) - 2 + pick([-0.75, -0.5, 0.25, 0.5, 0.75, 1e-9]);
        const code = pick(CODES);
        handMade.push({ startLine, endLine: startLine + 1 + code.split("\n").length, lang: pick(ENGINES), code });
      }
      compareDocument(text, tally, { handMade });
      // the sample of ranges: each asked of the three languages, of the first cells the model found and of two hand-made ones
      const lookup = createRangeLookup(text);
      const found = findAllCells(text);
      if (found.length > 0) withCells++;
      const note = (what: string): void => {
        if (tally.disagreements.length < 5) tally.disagreements.push(`${JSON.stringify(text)}: ${what}`);
      };
      const odd = oddNumbers(total);
      const ranges: Array<[number, number]> = [];
      for (let k = 0; k < 8; k++) {
        const start = Math.floor(random() * (total + 5)) - 2;
        ranges.push([start, start + Math.floor(random() * 6)]); // a short range anywhere
      }
      for (let k = 0; k < 8 && found.length > 0; k++) {
        const cell = pick(found);
        const first = cell.startLine + 1 + Math.floor(random() * 4);
        ranges.push([first, first + Math.floor(random() * 5)]); // a range in a cell's own lines, where the answer is often `true`
      }
      for (let k = 0; k < 8; k++) ranges.push([pick(odd), pick(random() < 0.5 ? odd : [0, 1, 2, total - 1, total])]);
      const cells = [...found.slice(0, 4), handMade[0], handMade[4]];
      for (const [start, end] of ranges) {
        const { asked, kept } = compareRange(text, lookup, start, end, cells, note);
        tally.oddRangeAsks += asked;
        tally.oddRangeKept += kept;
        if (Number.isInteger(start) && Number.isInteger(end) && end > start && oldRangeInSameLangBody(text, start, end, "python")) multiLineKept++;
      }
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.docs).toBe(SEEDED_COUNT);
    // The draw must reach the shapes it is for: floors, not pinned counts (the generator is Mulberry32 over a pool, not a definition a second program is asked to reproduce).
    expect(withCells).toBeGreaterThan(SEEDED_COUNT / 4);
    expect(tally.cells).toBeGreaterThan(4_000);
    expect(tally.hits).toBeGreaterThan(5_000);
    expect(tally.oddHits).toBeGreaterThan(5_000);
    expect(tally.oddRangeAsks).toBeGreaterThan(500_000);
    expect(tally.oddRangeKept).toBeGreaterThan(5_000);
    expect(multiLineKept).toBeGreaterThan(300);
  }, HEAVY_ROW_MS);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A LARGE DOCUMENT. The cure answers from a binary search over the cells and a per-cell cache, which a document of a few cells never makes interesting: 250 cells of mixed shapes (python, r, ojs, an unmapped
// engine, a cell with no body, a cell of one blank line, a cell with one to three option lines, bodies of 0 to 25 lines, prose and headings between), 1,500 lines or more, every line asked of `hitAt`, and for every cell
// the ranges that matter to the two adapters: its whole body, the body and the closing fence, the body from the fence, one line, two lines across its end into the next cell.

describe("Session 342 -- a large document of mixed cells", () => {
  it("hitAt agrees on every line, and both range checks on the ranges around every cell", () => {
    const random = seededRandom(3420);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const lines: string[] = ["---", "title: big", "---", ""];
    for (let i = 0; i < 250; i++) {
      lines.push(...pick([["# H"], ["## S", ""], ["prose", "more prose"], [""]]));
      const engine = pick(["python", "python", "r", "ojs", "bash", "julia"]);
      lines.push("```{" + engine + "}");
      const shapeOfBody = pick(["plain", "plain", "plain", "empty", "blank", "options"]);
      if (shapeOfBody === "options") {
        for (let k = 0; k < 1 + Math.floor(random() * 3); k++) lines.push(engine === "ojs" ? "//| echo: false" : "#| echo: false");
      }
      if (shapeOfBody === "blank") lines.push("");
      if (shapeOfBody === "plain" || shapeOfBody === "options") {
        for (let k = 0; k < Math.floor(random() * 26); k++) lines.push(pick(["x = 1", "y <- 2", "  ", "", "#| late: not an option", "f()"]));
      }
      lines.push("```");
    }
    const text = lines.join("\n");
    const total = lines.length;
    expect(total).toBeGreaterThan(1500);
    const lookup = createRangeLookup(text);
    const cells = findAllCells(text);
    expect(cells).toHaveLength(250);
    const disagreements: string[] = [];
    const note = (what: string): void => {
      if (disagreements.length < 5) disagreements.push(what);
    };
    let hits = 0;
    for (let line = -1; line <= total + 1; line++) {
      const expected = oldEmbeddedCellAt(text, line);
      if (expected !== null) hits++;
      if (JSON.stringify(shape(lookup.hitAt(line))) !== JSON.stringify(shape(expected))) note(`hitAt(${line})`);
    }
    let kept = 0;
    let multi = 0;
    for (let k = 0; k < cells.length; k++) {
      const cell = cells[k];
      const body = bodyLineCount(cell);
      const first = cell.startLine + 1;
      const last = cell.startLine + body;
      const near = [cell, ...(k + 1 < cells.length ? [cells[k + 1]] : [])];
      const ranges: Array<[number, number]> = [
        [first, last], [first, last + 1], [first - 1, last], [first + 1, last], [first, first], [last, last], [last, last + 1], [last, (cells[k + 1]?.startLine ?? last + 1) + 1], [cell.startLine, cell.endLine], [first, first + 1],
      ];
      for (const [start, end] of ranges) {
        const { kept: keptHere } = compareRange(text, lookup, start, end, near, note);
        kept += keptHere;
        if (end > start && oldRangeInSameLangBody(text, start, end, "python")) multi++;
      }
    }
    expect(disagreements).toEqual([]);
    // The draw reaches the shapes it is for: floors.
    expect(hits).toBeGreaterThan(400);
    expect(kept).toBeGreaterThan(300);
    expect(multi).toBeGreaterThan(20);
  }, HEAVY_ROW_MS);
});
