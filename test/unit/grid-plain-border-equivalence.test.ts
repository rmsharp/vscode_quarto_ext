import { describe, expect, it } from "vitest";
import { gridPlainBorder } from "../../src/core/qmd/model";
import { LS, NBSP, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part (2). The top border of a grid table was read by
// `/^\+(?:-+\+)+[ \t]*$/` (`GRID_PLAIN_BORDER`, tested twice in `tableOrLineBlockEndsAt`), a GROUP per `-+` cell, and V8 keeps one entry of its regex backtrack stack per repetition of a group: a border of
// 3,355,430 or more cells threw `RangeError: Maximum call stack size exceeded` (bisected at `8ebce73`, a fresh process per probe), and the error reached every reader of the document. The line is a plus
// sign, one or more cells (a run of dashes and then a plus sign) and blanks to the end, so `gridPlainBorder` reads it by code unit with a loop. The old pattern is kept below, copied from the parent `8ebce73`, as
// the oracle (Learning 738), beside a reading by definition that uses no regex; the pinned counts of the enumerations and the sweep come from a Python 3 port of the definition that shares no code with the
// TypeScript (run with `python3 -I`; it also checks the definition against the old pattern ported to `re.fullmatch`), and the seeded count comes from the old pattern, never from the code under test.

// ---- The OLD pattern, copied from the parent `8ebce73`. ----
const OLD_GRID_PLAIN_BORDER = /^\+(?:-+\+)+[ \t]*$/;

// ---- A reading of the old pattern by DEFINITION, with no regular expression: a plus sign, then a body that is, once the blanks at the end are taken off, made of dashes and plus signs only, begins with a dash,
// ends with a plus sign and has no two plus signs side by side (so it is one or more runs of dashes, each closed by one plus sign). ----
function definitionBorder(line: string): boolean {
  if (line[0] !== "+") {
    return false;
  }
  let end = line.length;
  while (end > 1 && (line[end - 1] === " " || line[end - 1] === "\t")) {
    end--;
  }
  const body = line.slice(1, end);
  if (body.length === 0 || body[0] !== "-" || body[body.length - 1] !== "+") {
    return false;
  }
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "-" && body[i] !== "+") {
      return false;
    }
    if (body[i] === "+" && body[i + 1] === "+") {
      return false;
    }
  }
  return true;
}

type Count = { compared: number; accepted: number; disagreements: string[] };
/** Compare the new function with the old pattern and the reading by definition over `lines`: how many were compared, how many the old pattern accepted. */
function compareAll(lines: Iterable<string>): Count {
  const count: Count = { compared: 0, accepted: 0, disagreements: [] };
  for (const line of lines) {
    const expected = OLD_GRID_PLAIN_BORDER.test(line);
    count.compared++;
    if (expected) {
      count.accepted++;
    }
    if ((gridPlainBorder(line) !== expected || definitionBorder(line) !== expected) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: old ${expected}, now ${gridPlainBorder(line)}, by definition ${definitionBorder(line)}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

const TINY = ["+", "-"];
const BLANKS = ["+", "-", " ", "\t"];
const WIDE = ["+", "-", " ", "\t", "=", "x", "\n", NBSP];
const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; accepted: number }> = [
  { label: "2 characters (`+`, `-`), up to 20", alphabet: TINY, maxLength: 20, accepted: 6_764 },
  { label: "4 characters (`+`, `-`, a space, a tab), up to 11", alphabet: BLANKS, maxLength: 11, accepted: 1_672 },
  { label: "8 characters (`+`, `-`, blanks, `=`, a letter, a newline, a no-break space), up to 7", alphabet: WIDE, maxLength: 7, accepted: 74 },
];

// Every UTF-16 code unit put into, or in place of a character of, a border (the head, the middle, the tail and right after each separator) and into the near misses one edit away from a border.
const HEADS = ["+-+", "+--+-+ ", "+-+\t", "+-+-+", "+-", "+", "-+", "+ -+", "+--+x"];

// A seeded sample of longer lines: 0 to 12 pieces. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3371;
const PIECES = ["+", "-", "--", "+-", "-+", "+-+", " ", "\t", "=", ":", "x", "|", "\r", NBSP, LS, "+--+", "---"];
function* seededLines(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let line = "";
    const parts = Math.floor(next() * 13);
    for (let part = 0; part < parts; part++) {
      line += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield line;
  }
}

// What each line is, stated by hand: whether it is a plain top border.
const STATED: Array<[string, boolean]> = [
  ["+-+", true],
  ["+--+", true],
  ["+-+-+", true],
  ["+---+---+", true],
  ["+-+ ", true],
  ["+-+\t", true],
  ["+-+ \t ", true],
  ["+-+-+-+-+-+-+-+", true],
  ["+" + "-".repeat(1000) + "+", true],
  ["", false],
  ["+", false],
  ["++", false],
  ["+-", false],
  ["-+", false],
  ["-", false],
  ["+ -+", false],
  ["+-+ x", false],
  ["+-+x", false],
  ["+-++", false],
  ["+-+-", false],
  ["+=+", false],
  ["+:-+", false],
  ["+-:+", false],
  ["+==+", false],
  [" +-+", false],
  ["+-+\n", false],
  ["+-+\r", false],
  ["+-+" + NBSP, false],
  ["+-+" + LS, false],
  ["+-+\f", false],
  ["+- -+", false],
  ["+-+|", false],
  ["| +-+", false],
  ["+-+ +-+", false],
  ["+" + "-".repeat(1000), false],
];

describe("Session 337 — gridPlainBorder: the loop reads a plain top border where `^\\+(?:-+\\+)+[ \\t]*$` did", () => {
  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(everyString(e.alphabet, e.maxLength));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countStrings(e.alphabet.length, e.maxLength), accepted: e.accepted });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit put into, and put in place of a character of, each border and near miss", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnitEdit(HEADS));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countCodeUnitEdits(HEADS), accepted: 54 });
    expect(countCodeUnitEdits(HEADS)).toBe(4_915_200);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededLines(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, accepted: 1_408 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, answer]) => [JSON.stringify(line.length > 40 ? line.slice(0, 20) + "..." + line.slice(-5) : line), line, answer] as const))("%s is a plain border: %s by hand, by the old pattern, by the definition and by the new function", (_label, line, answer) => {
    expect(OLD_GRID_PLAIN_BORDER.test(line)).toBe(answer);
    expect(definitionBorder(line)).toBe(answer);
    expect(gridPlainBorder(line)).toBe(answer);
  });

  // The cure itself: a border past the old overflow (3,355,430 cells) is read. The old pattern is compared only below that, where it still reads.
  const SMALL_RUNS = [1, 2, 3, 100, 4_096, 65_536, 1_000_000, 3_000_000];
  const LONG_RUNS = [3_355_430, 3_400_000, 6_800_000, 12_000_000];
  const TAILS = ["", " ", "\t", " \t ", "x", "+", "-", "-+", "+-", " x", "=", "\n", NBSP];
  const DEFINITION_RUN = 6_800_000;
  const LINEAR_RUN = 20_000_000;
  const LINEAR_LIMIT_MS = 3000;
  const DASH_RUNS = [1_000, 100_000, 1_000_000];
  it.each(SMALL_RUNS)("a border of %i cells `-+` ends where the old pattern did, with and without a tail", (n) => {
    const run = "-+".repeat(n);
    for (const tail of n > 65_536 ? ["", " ", "x", "-"] : TAILS) {
      const line = "+" + run + tail;
      expect(gridPlainBorder(line)).toBe(OLD_GRID_PLAIN_BORDER.test(line));
      if (n <= 65_536) {
        expect(gridPlainBorder(line)).toBe(definitionBorder(line));
      }
    }
    // a doubled plus sign or a blank inside the border, near the front and near the back
    for (const broken of ["+" + "-+".repeat(n).replace("-+", "++"), "+" + run.slice(0, -2) + " -+", "+" + run + "+", "+" + "-".repeat(n) + "+", "+" + "-".repeat(n)]) {
      expect(gridPlainBorder(broken)).toBe(OLD_GRID_PLAIN_BORDER.test(broken));
    }
  }, HEAVY_ROW_MS);

  it.each(LONG_RUNS)("a border of %i cells `-+` is a plain border, whatever blanks follow, and is not one with any other tail", (n) => {
    const run = "-+".repeat(n);
    expect(gridPlainBorder("+" + run)).toBe(true);
    expect(gridPlainBorder("+" + run + " ")).toBe(true);
    expect(gridPlainBorder("+" + run + " \t  ")).toBe(true);
    expect(gridPlainBorder("+" + run + "x")).toBe(false);
    expect(gridPlainBorder("+" + run + "-")).toBe(false);
    expect(gridPlainBorder("+" + run + "+")).toBe(false);
    expect(gridPlainBorder("+" + run + " x")).toBe(false);
    expect(gridPlainBorder(run)).toBe(false); // no leading plus sign
    expect(gridPlainBorder(" +" + run)).toBe(false);
    expect(gridPlainBorder("+" + "+" + run)).toBe(false);
    expect(gridPlainBorder("+" + run + "\n")).toBe(false);
    expect(gridPlainBorder("+" + run + NBSP)).toBe(false);
    expect(gridPlainBorder("+-+ " + run.slice(0, 40) + "+")).toBe(false);
  }, HEAVY_ROW_MS);

  it("a border of 6,800,000 cells agrees with the reading by definition, whole and with each kind of break", () => {
    const n = DEFINITION_RUN;
    const run = "-+".repeat(n);
    for (const line of ["+" + run, "+" + run + "x", "+" + run + "  ", "+" + run + "-", "+" + run.slice(0, n) + "+" + run.slice(n), "+" + run.slice(0, n) + " " + run.slice(n)]) {
      expect(gridPlainBorder(line)).toBe(definitionBorder(line));
    }
  }, HEAVY_ROW_MS);

  // One read of the border is timed: 20,000,000 cells (40 million characters) take 0.12 s as a flat string and 0.3 s as the rope the concatenation builds, so the limit is 10 times the slower (the first version timed two reads of 45,000,000 cells, 1.7 s against 3 s, and
  // failed once under load); 20,000,000 is above 16,777,216 (2^24) cells, which a cap of that size would refuse.
  it("a border of 20,000,000 cells (40 million characters) is read in linear time", () => {
    const line = "+" + "-+".repeat(LINEAR_RUN);
    const started = Date.now();
    expect(gridPlainBorder(line)).toBe(true);
    expect(Date.now() - started).toBeLessThan(LINEAR_LIMIT_MS);
    expect(gridPlainBorder(line + "x")).toBe(false);
  }, HEAVY_ROW_MS);

  it("a long run of dashes in one cell, and a long run of pluses, answer as the old pattern does", () => {
    for (const n of DASH_RUNS) {
      for (const line of ["+" + "-".repeat(n) + "+", "+" + "-".repeat(n) + "+x", "+" + "-".repeat(n) + "x", "+" + "+".repeat(n), "+" + "-".repeat(n) + "+".repeat(n), "+" + "-+".repeat(n) + " ".repeat(n), "+" + "-+".repeat(n) + " ".repeat(n) + "x"]) {
        expect(gridPlainBorder(line)).toBe(OLD_GRID_PLAIN_BORDER.test(line));
      }
    }
  }, HEAVY_ROW_MS);

  // The parent THROWS from 3,355,430 cells, so the old pattern is compared only below that and the cells above it are checked against the definition and by hand; a list that lost its large entries, or a limit of
  // minutes, would pass a function that caps or restarts its loop.
  it("keeps the sizes and the limit the long-run rows are built on", () => {
    expect(SMALL_RUNS).toEqual([1, 2, 3, 100, 4_096, 65_536, 1_000_000, 3_000_000]);
    expect(Math.max(...SMALL_RUNS)).toBeLessThan(3_355_430);
    expect(LONG_RUNS).toEqual([3_355_430, 3_400_000, 6_800_000, 12_000_000]);
    expect([DEFINITION_RUN, LINEAR_RUN, LINEAR_LIMIT_MS, DASH_RUNS]).toEqual([6_800_000, 20_000_000, 3000, [1_000, 100_000, 1_000_000]]);
    expect([SEEDED_COUNT, SEED, HEAVY_ROW_MS]).toEqual([300_000, 3371, 120_000]);
  });
});
