import { describe, expect, it } from "vitest";
import { pipeDelimiterRow, tableRuleRow } from "../../src/core/qmd/model";
import { LS, NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 335 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (4). `PIPE_DELIMITER_ROW` and `TABLE_RULE_ROW` read a pipe table's delimiter row
// as a group per cell, `(?:[ \t]*\|[ \t]*:?-+:?)*`, and V8 keeps one entry of its regex backtrack stack per repetition of a group: a row of 1,525,300 or more cells `|-` threw `RangeError: Maximum call stack
// size exceeded` (bisected at `c06ee06`), and the error reached every reader of the document. `pipeDelimiterRow` and `tableRuleRow` read the same line with a loop. The two patterns are kept below, copied from
// the parent `c06ee06` (`src/core/qmd/model.ts`), as the oracle (Learning 738); `blank-tail-equivalence.test.ts` holds their two older spellings. The pinned counts (how many strings of each enumeration the
// OLD patterns accept) come from the old patterns and from a Python port of them (with `\s` spelled out as ECMAScript's set, which Python's is not) and never from the code under test.

// ---- The OLD patterns, copied from the parent `c06ee06`. ----
const OLD_PIPE_DELIMITER_ROW = /^ {0,3}\|?[ \t]*:?-+:?(?:[ \t]*\|[ \t]*:?-+:?)*(?:[ \t]*\|)?[ \t]*$/;
const OLD_TABLE_RULE_ROW = /^ {0,3}(?:\|?[ \t]*:?-+:?(?:[ \t]*\|[ \t]*:?-+:?)*(?:[ \t]*\|)?|\+(?:[-+=: ]*[-+=:])?)\s*$/;

type Count = { compared: number; rule: number; pipe: number; disagreements: string[] };
/** Compare the new functions with the old patterns over `lines`: how many were compared, how many each OLD pattern accepted, and the first few disagreements. */
function compareAll(lines: Iterable<string>): Count {
  const count: Count = { compared: 0, rule: 0, pipe: 0, disagreements: [] };
  for (const line of lines) {
    count.compared++;
    const rule = OLD_TABLE_RULE_ROW.test(line);
    const pipe = OLD_PIPE_DELIMITER_ROW.test(line);
    if (rule) {
      count.rule++;
    }
    if (pipe) {
      count.pipe++;
    }
    if ((tableRuleRow(line) !== rule || pipeDelimiterRow(line) !== pipe) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: rule old ${rule} now ${tableRuleRow(line)}, pipe old ${pipe} now ${pipeDelimiterRow(line)}`);
    }
  }
  return count;
}

const PIPE_ALPHABET = ["|", "-", ":", " ", "\t"];
const WIDE_ALPHABET = ["|", "-", ":", " ", "+", "=", "a", NBSP, "\r"];
// Structured pipe rows: a blank prefix, up to four cells, pipes and blanks, then a tail that ends or breaks the row (the vertical tab and the separators are `\s` and not `[ \t]`).
const PREFIXES = Array.from(everyString([" ", "\t"], 5)); // 63
const CELL_TOKENS = ["-", ":-", "-:", ":-:", "|", " ", "\t", "--"];
const PIPE_TAILS = ["", " ", "\t", "\v", NBSP, "\r", LS, "x", "|", ":"];
function* structuredPipe(): Generator<string> {
  for (const prefix of PREFIXES) {
    for (const body of everyString(CELL_TOKENS, 4)) {
      for (const tail of PIPE_TAILS) {
        yield prefix + body + tail;
      }
    }
  }
}
// Structured grid rows: 0 to 4 spaces or a tab (a tab is no indent here), `+`, a run of the grid characters and spaces, then a tail.
const GRID_PREFIXES = ["", " ", "  ", "   ", "    ", "\t", " \t"];
const GRID_TAILS = ["", " ", "\t", "\v", NBSP, "x", "|"];
function* structuredGrid(): Generator<string> {
  for (const prefix of GRID_PREFIXES) {
    for (const run of everyString(["-", "+", "=", ":", " "], 6)) {
      for (const tail of GRID_TAILS) {
        yield `${prefix}+${run}${tail}`;
      }
    }
  }
}

// A seeded sample of longer lines: a blank prefix, then 0 to 14 pieces. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3355;
const PIECES = ["|", "-", ":", "+", "=", " ", "\t", "--", "|-", "-|", ":-:", "a", "x", "\r", LS, NBSP, "\v", "||", "+-", "---"];
const SEEDED_PREFIXES = ["", " ", "   ", "    ", "\t"];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = SEEDED_PREFIXES[Math.floor(next() * SEEDED_PREFIXES.length)];
    const parts = Math.floor(next() * 15);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield text;
  }
}

// What each line is, stated by hand: [line, TABLE_RULE_ROW, PIPE_DELIMITER_ROW].
const STATED: Array<[string, boolean, boolean]> = [
  ["---", true, true],
  ["-", true, true],
  ["|---|---|", true, true],
  ["|---|---", true, true],
  ["---|---", true, true],
  ["--- | ---", true, true],
  ["|:--|--:|:-:|", true, true],
  [":-:", true, true],
  ["::", false, false],
  [":", false, false],
  ["-:-", false, false],
  ["|", false, false],
  ["||", false, false],
  ["|-||-|", false, false],
  ["|--| |--|", false, false],
  ["|- -|", false, false],
  ["--- ---", false, false],
  ["   |---|", true, true],
  ["    |---|", false, false],
  ["\t|---|", false, false],
  ["    ---", true, true],
  ["\t---", true, true],
  ["  \t---|", true, true],
  ["|---|   ", true, true],
  ["|---|\t", true, true],
  ["|---|\v", true, false],
  ["|---|" + NBSP, true, false],
  ["|---|" + LS, true, false],
  ["|---|\r", true, false],
  ["|---| x", false, false],
  ["|---|:", false, false],
  ["|---|-|", true, true],
  ["|\v---|", false, false],
  ["+", true, false],
  ["+---+---+", true, false],
  ["+===+===+", true, false],
  ["+:--+--:+", true, false],
  ["+ - +", true, false],
  ["+ -", true, false],
  ["+ ", true, false],
  ["+  ", true, false],
  ["+ x", false, false],
  ["+-x", false, false],
  ["+-+-+  ", true, false],
  ["+-+-+\v", true, false],
  ["+-+-+x", false, false],
  ["   +---+", true, false],
  ["    +---+", false, false],
  ["\t+---+", false, false],
  ["", false, false],
  ["   ", false, false],
];

describe("Session 335 — tableRuleRow and pipeDelimiterRow: the loops accept what the two patterns did", () => {
  const ENUMERATIONS: Array<{ label: string; lines: () => Iterable<string>; compared: number; rule: number; pipe: number }> = [
    { label: "up to 10 characters over `|-: \\t`", lines: () => everyString(PIPE_ALPHABET, 10), compared: countStrings(PIPE_ALPHABET.length, 10), rule: 599_024, pipe: 599_024 },
    { label: "up to 7 characters over `|-: +=a`, a no-break space and CR", lines: () => everyString(WIDE_ALPHABET, 7), compared: countStrings(WIDE_ALPHABET.length, 7), rule: 59_662, pipe: 2_712 },
    { label: "pipe rows: 63 blank prefixes, up to 4 of 8 cell tokens and 10 tails", lines: structuredPipe, compared: 63 * countStrings(CELL_TOKENS.length, 4) * PIPE_TAILS.length, rule: 565_508, pipe: 284_328 },
    { label: "grid rows: 7 prefixes, `+`, a run of up to 6 of `-+=: ` and 7 tails", lines: structuredGrid, compared: GRID_PREFIXES.length * countStrings(5, 6) * GRID_TAILS.length, rule: 390_620, pipe: 0 },
  ];

  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(e.lines());
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: e.compared, rule: e.rule, pipe: e.pipe });
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, rule: 13_859, pipe: 8_362 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, rule, pipe]) => [JSON.stringify(line), line, rule, pipe] as const))("%s is stated by hand, by the old patterns and by the new functions", (_label, line, rule, pipe) => {
    expect([OLD_TABLE_RULE_ROW.test(line), OLD_PIPE_DELIMITER_ROW.test(line)]).toEqual([rule, pipe]);
    expect([tableRuleRow(line), pipeDelimiterRow(line)]).toEqual([rule, pipe]);
  });

  // The cure itself: a row past the old overflow (1,525,300 cells) is read. The old patterns are compared only below that, where they still read.
  const SMALL_ROWS = [1, 2, 3, 100, 4_096, 65_536, 1_000_000, 1_500_000];
  const LONG_ROWS = [1_525_300, 1_600_000, 3_100_000, 6_000_000];
  // [unit, closing, whether a `:` after the closing is an alignment colon (it is only after a dash)].
  const UNITS: Array<[string, string, boolean]> = [["|-", "|", false], ["-|", "", false], ["|:-:", "|", false], ["- | ", "-", true]];
  it.each(SMALL_ROWS)("a row of %i cells, each shape, with and without a refused tail, gives the old answer", (n) => {
    for (const [unit, closing] of UNITS) {
      for (const tail of ["", "x", " x", "|", "\v", ":", " "]) {
        const line = unit.repeat(n) + closing + tail;
        expect([tableRuleRow(line), pipeDelimiterRow(line)]).toEqual([OLD_TABLE_RULE_ROW.test(line), OLD_PIPE_DELIMITER_ROW.test(line)]);
      }
    }
  }, HEAVY_ROW_MS);

  it.each(LONG_ROWS)("a row of %i cells is read, and the tail decides", (n) => {
    for (const [unit, closing, colonAfterDash] of UNITS) {
      const row = unit.repeat(n) + closing;
      expect([tableRuleRow(row), pipeDelimiterRow(row)]).toEqual([true, true]);
      expect([tableRuleRow(`${row}  `), pipeDelimiterRow(`${row}  `)]).toEqual([true, true]);
      expect([tableRuleRow(`${row}\v`), pipeDelimiterRow(`${row}\v`)]).toEqual([true, false]);
      expect([tableRuleRow(`${row}x`), pipeDelimiterRow(`${row}x`)]).toEqual([false, false]);
      expect([tableRuleRow(`${row}:`), pipeDelimiterRow(`${row}:`)]).toEqual([colonAfterDash, colonAfterDash]);
    }
    // The grid body: `+` and a run of `-` with spaces inside, ending in a character that is not a space.
    const grid = `+${"- ".repeat(n)}-`;
    expect([tableRuleRow(grid), pipeDelimiterRow(grid)]).toEqual([true, false]);
    expect(tableRuleRow(`${grid}x`)).toBe(false);
    expect(tableRuleRow(`+${"-".repeat(n)}  `)).toBe(true);
    expect(tableRuleRow(`+${"-+".repeat(n)}\v`)).toBe(true);
  }, HEAVY_ROW_MS);

  it("a row of 6,000,000 cells, and a run of 3,000,000 blanks inside it, are read in linear time", () => {
    const row = "|-".repeat(6_000_000) + "|";
    const blanky = `|-${" ".repeat(3_000_000)}|-`;
    const started = Date.now();
    expect(pipeDelimiterRow(row)).toBe(true);
    expect(tableRuleRow(row)).toBe(true);
    expect(pipeDelimiterRow(blanky)).toBe(true);
    expect(pipeDelimiterRow(`${blanky}x`)).toBe(false);
    expect(tableRuleRow(`+${" ".repeat(3_000_000)}x`)).toBe(false);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
