import { describe, expect, it } from "vitest";
import { commonmarkParagraphInterrupt, ParagraphInterruptScan } from "../../src/core/qmd/model";
import { seededRandom } from "./support/regex-equivalence";

// Session 332 — the former BACKLOG item (closed, CHANGELOG: Session 334) "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (9). Under a `from: gfm`, `commonmark` or `commonmark_x` reader the title of a
// setext underline is the whole open paragraph, unless a line of it BELOW ITS FIRST interrupts the paragraph, so `computeRegions` asked, for every line it read, `bodyLines.slice(-wholeParagraph).slice(1).some((l) =>
// commonmarkParagraphInterrupt(l.text, [0, ...columns]))`: two copies of the paragraph so far and a fresh `[0, ...columns]` array for each line tested (`pathological-inputs.test.ts` has the document rows). The question is now
// `ParagraphInterruptScan.interruptedAfterFirst`, the same question without the copies, and it is asked only where the line can underline. The old expression is kept here as the oracle (Learning 738; the columns it spread from `columnStack.columns()` are a parameter, and the list of rows is the one `interruptListMatches` the scan shares: the wiring file's documents pin the list itself): the new
// scan must answer what it answered for every list of lines, every paragraph length and every set of open container columns, asked cold (a fresh scan for each question) and warm (one scan kept across a growing list).
const oldTitleScan = (bodyLines: Array<{ text: string }>, wholeParagraph: number, columns: readonly number[]): boolean =>
  wholeParagraph > 1 &&
  bodyLines
    .slice(-wholeParagraph)
    .slice(1)
    .some((l) => commonmarkParagraphInterrupt(l.text, [0, ...columns]));

const line = (text: string): { text: string } => ({ text });

// Every kind of line the interrupt list tells apart, and the columns that make an indented one code (an interrupter at four columns past the container's content column is indented code and interrupts nothing).
// The reduced alphabet is what the exhaustive rows enumerate; the full one is what the seeded rows draw from.
const REDUCED_LINES = ["x", "#x", "    four spaces", "# H", "<span>a</span>", "- b", "    - b", "      - b", "---", ""];
const FULL_LINES = [
  ...REDUCED_LINES,
  "plain words here", "  two-space indent", "2. two", "-", "|a|b|", "\ttab text", "1.x", "1. ", ":::", "   ",
  "###### H", "```", "~~~~", "> q", ">", "***", "- - -", "___", "* b", "+ b", "1. one", "1) one", "(1) one", "::: {.a}", "<?php", "<!--", "[^1]: n",
  "  - b", "   - b", "\t- b", "\t\t- b", "     - b",
];
const COLUMN_SETS: ReadonlyArray<readonly number[]> = [[], [2], [4], [2, 4], [3], [2, 6], [5], [0, 2]];

const EXHAUSTIVE_LENGTH = 4;
const SEEDED_DOCUMENTS = 100_000;
const SEEDED_LENGTH = 30;
const LINEAR_LINES = 200_000;
const LINEAR_LIMIT_MS = 500;

/**
 * How many comparisons the OLD spelling answers `true` for: a comparison cannot pass by both answering `false` everywhere. The exhaustive pair (790,120 comparisons, 422,640 answered `true`) is counted again by a
 * separate script that reads the code-depth rule and a hand classification of the ten lines against this model's interrupt list, not the project's code (`tools/paragraph-interrupt-count/count_answered.py`; the list is broader than
 * CommonMark's, whose HTML rows are narrower than this model's `<`); the seeded one is counted from the old spelling here alone.
 */
const ANSWERED = { exhaustive: 422_640, compared: 790_120, seeded: 73_153 };

type Tally = { compared: number; answered: number; disagreements: string[] };

type TitleScan = (lines: Array<{ text: string }>, wholeParagraph: number, columns: readonly number[]) => boolean;

// A COLD question: a scan that has read nothing yet, which is the old expression's own situation (it kept nothing between lines).
const coldScan: TitleScan = (lines, wholeParagraph, columns) => new ParagraphInterruptScan().interruptedAfterFirst(lines, wholeParagraph, columns);

function compareOne(lines: Array<{ text: string }>, wholeParagraph: number, columns: readonly number[], tally: Tally, reference: TitleScan = oldTitleScan, candidate: TitleScan = coldScan): void {
  const want = reference(lines, wholeParagraph, columns);
  const got = candidate(lines, wholeParagraph, columns);
  tally.compared += 1;
  if (want) tally.answered += 1;
  if (want !== got && tally.disagreements.length < 5) {
    tally.disagreements.push(`${JSON.stringify(lines.map((l) => l.text))} w=${wholeParagraph} columns=${JSON.stringify(columns)}: old ${want}, new ${got}`);
  }
}

/** Every list of up to `maxLength` lines over `alphabet`, as arrays of line objects (a fresh array each, so a function that mutated its input would be seen by the next comparison). */
function* everyList(alphabet: readonly string[], maxLength: number): Generator<Array<{ text: string }>> {
  let layer: string[][] = [[]];
  yield [];
  for (let length = 1; length <= maxLength; length++) {
    const next: string[][] = [];
    for (const prefix of layer) {
      for (const text of alphabet) next.push([...prefix, text]);
    }
    for (const texts of next) yield texts.map(line);
    layer = next;
  }
}

describe("Session 332 — the paragraph-interrupt scan without the copies", () => {
  it("answers the old expression for every list of up to four lines, every paragraph length from -1 to the list's length + 3, and every set of columns", () => {
    const tally: Tally = { compared: 0, answered: 0, disagreements: [] };
    let lists = 0;
    for (const lines of everyList(REDUCED_LINES, EXHAUSTIVE_LENGTH)) {
      lists += 1;
      for (let wholeParagraph = -1; wholeParagraph <= lines.length + 3; wholeParagraph++) {
        for (const columns of COLUMN_SETS) compareOne(lines, wholeParagraph, columns, tally);
      }
    }
    expect(tally.disagreements).toEqual([]);
    expect({ lists, compared: tally.compared, answered: tally.answered }).toEqual({ lists: 11_111, compared: ANSWERED.compared, answered: ANSWERED.exhaustive });
  });

  it("answers the old expression for 100,000 seeded lists of up to 30 lines over the full alphabet", () => {
    const random = seededRandom(332);
    const tally: Tally = { compared: 0, answered: 0, disagreements: [] };
    for (let n = 0; n < SEEDED_DOCUMENTS; n++) {
      const length = Math.floor(random() * (SEEDED_LENGTH + 1));
      const lines = Array.from({ length }, () => line(FULL_LINES[Math.floor(random() * FULL_LINES.length)]));
      const wholeParagraph = Math.floor(random() * (length + 5)) - 1;
      const columns = COLUMN_SETS[Math.floor(random() * COLUMN_SETS.length)];
      compareOne(lines, wholeParagraph, columns, tally);
    }
    expect(tally.disagreements).toEqual([]);
    expect({ compared: tally.compared, answered: tally.answered }).toEqual({ compared: SEEDED_DOCUMENTS, answered: ANSWERED.seeded });
  });

  // The comparison itself can fail: a function that starts one line early (it tests the paragraph's FIRST line, which a title may begin on), one line late, or that ignores the columns is reported by the exhaustive rows.
  it("reports a function that tests the first line, skips the second, or ignores the columns (the comparator can fail)", () => {
    const early = (lines: Array<{ text: string }>, w: number, columns: readonly number[]): boolean => w > 1 && lines.slice(-w).some((l) => commonmarkParagraphInterrupt(l.text, [0, ...columns]));
    const late = (lines: Array<{ text: string }>, w: number, columns: readonly number[]): boolean => w > 1 && lines.slice(-w).slice(2).some((l) => commonmarkParagraphInterrupt(l.text, [0, ...columns]));
    const blind: TitleScan = (lines, w) => w > 1 && lines.slice(-w).slice(1).some((l) => commonmarkParagraphInterrupt(l.text, [0]));
    for (const [name, candidate] of [["early", early], ["late", late], ["blind", blind]] as Array<[string, TitleScan]>) {
      const tally: Tally = { compared: 0, answered: 0, disagreements: [] };
      for (const lines of everyList(REDUCED_LINES, 3)) {
        for (let wholeParagraph = -1; wholeParagraph <= lines.length + 3; wholeParagraph++) {
          for (const columns of COLUMN_SETS) compareOne(lines, wholeParagraph, columns, tally, oldTitleScan, candidate);
        }
      }
      expect({ name, reported: tally.disagreements.length > 0 }).toEqual({ name, reported: true });
    }
  });

  // Stated by hand, so that a wrong old expression and a wrong new function cannot agree on a wrong answer: the window is the paragraph's lines below its FIRST.
  it("states the window: the lines of the paragraph below its first, and the whole list when the count is larger", () => {
    const interrupter = line("# H");
    const plain = line("x");
    expect(coldScan([interrupter, plain, plain], 3, [])).toBe(false);
    expect(coldScan([plain, interrupter, plain], 3, [])).toBe(true);
    expect(coldScan([plain, plain, interrupter], 3, [])).toBe(true);
    expect(coldScan([plain, plain, interrupter], 2, [])).toBe(true);
    expect(coldScan([interrupter, plain, plain], 2, [])).toBe(false);
    // The paragraph is longer than the lines kept: the whole list, whose first line is still not tested.
    expect(coldScan([interrupter, plain], 9, [])).toBe(false);
    expect(coldScan([plain, interrupter], 9, [])).toBe(true);
    // A count of 0 or 1 is no paragraph that has a line below its first (`slice(-0)` would be the whole list: the guard comes first).
    expect(coldScan([plain, interrupter], 1, [])).toBe(false);
    expect(coldScan([plain, interrupter], 0, [])).toBe(false);
    expect(coldScan([plain, interrupter], -3, [])).toBe(false);
    expect(coldScan([], 5, [])).toBe(false);
    // An interrupter at four columns past the container's content column is indented code and interrupts nothing: the columns decide it.
    const indentedBullet = line("      - b");
    expect(coldScan([plain, indentedBullet], 2, [])).toBe(false);
    expect(coldScan([plain, indentedBullet], 2, [2])).toBe(false);
    expect(coldScan([plain, indentedBullet], 2, [4])).toBe(true);
  });

  it("does not change the lines it is given or the columns", () => {
    const lines = [line("x"), line("# H"), line("y")];
    const before = JSON.stringify(lines);
    const columns = [2, 4];
    coldScan(lines, 3, columns);
    expect(JSON.stringify(lines)).toBe(before);
    expect(columns).toEqual([2, 4]);
  });

  // Every distinct indent is kept, however many: the review round's mutation lens capped the set at 4 and at 16 and no row noticed. Bullets at 5 and at 17 distinct indents, all code under no open column, ahead of ONE line that
  // interrupts: with a cap the interrupter is dropped and the answer is no. And a long paragraph is read to its end: a cap of 4,096 lines per question (or 100,000) misses an interrupter further down.
  it("keeps every distinct indent, however many: 5 and 17 code-depth bullets ahead of one interrupter", () => {
    for (const count of [5, 17]) {
      const bullets = Array.from({ length: count }, (_, k) => " ".repeat(4 + k) + "- b");
      expect(coldScan(["x", ...bullets, "<span>a</span>"].map(line), count + 2, [])).toBe(true);
      expect(coldScan(["x", ...bullets].map(line), count + 1, [])).toBe(false);
      // Under an open column at 3 the first bullet (indent 4) is no longer code.
      expect(coldScan(["x", ...bullets].map(line), count + 1, [3])).toBe(true);
    }
  });

  // An indent is kept as it is, at any size: a cap of 16 on it, or its remainder modulo 32, gave the right answer for every column set the alphabets use (the second review round's mutation lens). A bullet 20 columns in is an interrupter
  // under an open column at 17 (code starts four past it) and code under none; 40 columns in, under 37. The odd columns matter: the columns of a plain nested list are even, and a capped indent lands on one of them.
  it("keeps an indent as it is, at any size: a bullet 20 and 40 columns in is an interrupter under an open column of 17 and of 37", () => {
    const bulletAt = (indent: number): Array<{ text: string }> => ["x", " ".repeat(indent) + "- b"].map(line);
    expect(coldScan(bulletAt(20), 2, [17])).toBe(true);
    expect(coldScan(bulletAt(20), 2, [])).toBe(false);
    expect(coldScan(bulletAt(40), 2, [37])).toBe(true);
    expect(coldScan(bulletAt(40), 2, [])).toBe(false);
    // And the column must be the right one: under 8 or 36 these are still code.
    expect(coldScan(bulletAt(40), 2, [8])).toBe(false);
    expect(coldScan(bulletAt(20), 2, [16])).toBe(false);
  });

  it("reads a long paragraph to its end: an interrupter 5,000 and 100,500 lines down is found", () => {
    const longParagraph = (count: number, at: number | null): Array<{ text: string }> => Array.from({ length: count }, (_, k) => line(k === at ? "<span>a</span>" : "x"));
    expect(coldScan(longParagraph(5_002, 5_001), 5_002, [])).toBe(true);
    expect(coldScan(longParagraph(110_000, 100_500), 110_000, [])).toBe(true);
    expect(coldScan(longParagraph(110_000, null), 110_000, [])).toBe(false);
  });

  // The cost of a COLD question: one pass over the lines below the first and no copy of the paragraph. This row guards the class against a quadratic reading; it does not separate it from the old expression, which is also linear for a
  // single cold question (about 40 ms against 30 ms for 200,000 lines): the rows that separate them are the 200,000 questions about a growing paragraph, below, and the document rows of pathological-inputs.test.ts.
  it("reads a paragraph of 200,000 lines with nothing in it that interrupts in linear time, and reads each line below the first once and no line above it", () => {
    const lines = Array.from({ length: LINEAR_LINES }, () => line("x"));
    const started = Date.now();
    expect(coldScan(lines, LINEAR_LINES, [2, 4])).toBe(false);
    expect(Date.now() - started).toBeLessThan(LINEAR_LIMIT_MS);

    const reads: number[] = [];
    const watched = Array.from({ length: 10 }, (_, k) => ({
      get text(): string {
        reads.push(k);
        return k === 4 ? "# H" : "x";
      },
    }));
    // No early exit: what a scan keeps is the indents of the lines that match the list, not an answer, so a question reads every line below the first (the answer is still true: the line at 4 matches at indent 0).
    expect(coldScan(watched, 10, [])).toBe(true);
    expect(reads).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    reads.length = 0;
    // A count of 6 is the last six lines, 4 to 9, and the interrupter at 4 is the FIRST of them: not read, and the answer is false.
    expect(coldScan(watched, 6, [])).toBe(false);
    expect(reads).toEqual([5, 6, 7, 8, 9]);
    reads.length = 0;
    expect(coldScan(watched.slice(5), 5, [])).toBe(false);
    expect(reads).toEqual([6, 7, 8, 9]);
  });

  it("keeps the alphabets, the lengths and the column sets the rows are built on", () => {
    expect(REDUCED_LINES).toEqual(["x", "#x", "    four spaces", "# H", "<span>a</span>", "- b", "    - b", "      - b", "---", ""]);
    expect(FULL_LINES.length).toBe(42);
    expect(new Set(FULL_LINES).size).toBe(FULL_LINES.length);
    expect(REDUCED_LINES.every((text) => FULL_LINES.includes(text))).toBe(true);
    expect(COLUMN_SETS).toEqual([[], [2], [4], [2, 4], [3], [2, 6], [5], [0, 2]]);
    expect([EXHAUSTIVE_LENGTH, SEEDED_DOCUMENTS, SEEDED_LENGTH, LINEAR_LINES, LINEAR_LIMIT_MS]).toEqual([4, 100_000, 30, 200_000, 500]);
    // The interrupters among the full alphabet are the ones the list means, and the plain ones are not: the answers above are not both false everywhere. At top level four columns of indent is code, so the indented bullets
    // interrupt nothing there; each open container column moves where code starts, which is why the columns are part of the question.
    const interruptsAt = (columns: readonly number[]): string[] => FULL_LINES.filter((text) => commonmarkParagraphInterrupt(text, columns));
    expect(interruptsAt([0])).toEqual([
      "# H", "<span>a</span>", "- b", "---", "###### H", "```", "~~~~", "> q", ">", "***", "- - -", "___", "* b", "+ b", "1. one", "1) one", "(1) one", "::: {.a}", "<?php", "<!--", "[^1]: n", "  - b", "   - b",
    ]);
    expect(interruptsAt([0, 2, 6]).filter((text) => !interruptsAt([0]).includes(text))).toEqual(["    - b", "      - b", "\t- b", "\t\t- b", "     - b"]);
  });
});

// The gate left one shape quadratic: an interrupter far down the paragraph, then many lines that can underline and cannot claim it. Each of them asked the question again, and the answer was read from the whole paragraph every
// time. `ParagraphInterruptScan` keeps what it has read of the paragraph so far, so a paragraph that grows one line at a time costs one test per line. What it keeps is NOT an answer but the indents of the lines that match the
// interrupt list (an answer depends on the open container columns, which change between two questions of one paragraph: a first version that kept the answer under one columns array restarted at every change, and the review round
// timed it at 3.3x and 3.7x per doubling on a three-line unit), so it can answer again under any columns without reading a line twice. The lines it is handed only GROW (`bodyLines` in `computeRegions` is appended to and never edited), and
// every answer must still be the old expression's.
const WARM_EXHAUSTIVE_LENGTH = 4;
const WARM_SEEDED_SEQUENCES = 20_000;
const WARM_SEEDED_LENGTH = 30;
/** As `ANSWERED`: the exhaustive pair (3,023,320 comparisons, 904,840 answered `true`) is counted again by `tools/paragraph-interrupt-count/count_answered.py`; the seeded pair (301,130 comparisons, 208,944 answered `true`) is counted from the old spelling here alone. */
const WARM_ANSWERED = { compared: 3_023_320, exhaustive: 904_840, seededCompared: 301_130, seeded: 208_944 };

describe("Session 332 — the paragraph-interrupt scan that keeps what it has read", () => {
  it("answers the old expression after every line of every list of up to four lines, for every count and every set of columns, through ONE scan kept across the list", () => {
    const tally: Tally = { compared: 0, answered: 0, disagreements: [] };
    const warm = (scan: ParagraphInterruptScan): TitleScan => (lines, w, columns) => scan.interruptedAfterFirst(lines, w, columns);
    for (const finished of everyList(REDUCED_LINES, WARM_EXHAUSTIVE_LENGTH)) {
      const scan = new ParagraphInterruptScan();
      const lines: Array<{ text: string }> = [];
      for (let upTo = 0; upTo <= finished.length; upTo++) {
        if (upTo > 0) lines.push(finished[upTo - 1]);
        for (let wholeParagraph = -1; wholeParagraph <= lines.length + 3; wholeParagraph++) {
          for (const columns of COLUMN_SETS) compareOne(lines, wholeParagraph, columns, tally, oldTitleScan, warm(scan));
        }
      }
    }
    expect(tally.disagreements).toEqual([]);
    expect({ compared: tally.compared, answered: tally.answered }).toEqual({ compared: WARM_ANSWERED.compared, answered: WARM_ANSWERED.exhaustive });
  });

  it("answers the old expression for 20,000 seeded paragraphs that grow one line at a time (counts that grow, counts that restart, the columns kept, switched, and copied)", () => {
    const random = seededRandom(3320);
    const tally: Tally = { compared: 0, answered: 0, disagreements: [] };
    const scan = new ParagraphInterruptScan();
    for (let n = 0; n < WARM_SEEDED_SEQUENCES; n++) {
      const lines: Array<{ text: string }> = [];
      const length = Math.floor(random() * (WARM_SEEDED_LENGTH + 1));
      let columns = COLUMN_SETS[Math.floor(random() * COLUMN_SETS.length)];
      let wholeParagraph = 0;
      for (let k = 0; k < length; k++) {
        lines.push(line(FULL_LINES[Math.floor(random() * FULL_LINES.length)]));
        const move = random();
        wholeParagraph = move < 0.7 ? wholeParagraph + 1 : move < 0.8 ? 1 : move < 0.9 ? 2 : Math.floor(random() * (lines.length + 4)) - 1;
        const switched = random();
        if (switched < 0.1) columns = COLUMN_SETS[Math.floor(random() * COLUMN_SETS.length)];
        else if (switched < 0.15) columns = [...columns];
        // One scan for ALL the sequences: a new array is a new paragraph to it, and it must say so.
        compareOne(lines, wholeParagraph, columns, tally, oldTitleScan, (a, w, c) => scan.interruptedAfterFirst(a, w, c));
      }
    }
    expect(tally.disagreements).toEqual([]);
    expect({ compared: tally.compared, answered: tally.answered }).toEqual({ compared: WARM_ANSWERED.seededCompared, answered: WARM_ANSWERED.seeded });
  });

  // What it reads is pinned, not only what it answers: each line records its own index when its text is read.
  const watchedLine = (index: number, text: string, reads: number[]): { text: string } => ({
    get text(): string {
      reads.push(index);
      return text;
    },
  });
  const take = (reads: number[]): number[] => reads.splice(0, reads.length);
  const none: number[] = [];

  it("reads each line of a growing paragraph once, whether or not an interrupter has been found", () => {
    const reads: number[] = [];
    const lines = ["x", "x", "x"].map((text, k) => watchedLine(k, text, reads));
    const scan = new ParagraphInterruptScan();
    expect(scan.interruptedAfterFirst(lines, 3, none)).toBe(false);
    expect(take(reads)).toEqual([1, 2]);
    lines.push(watchedLine(3, "x", reads));
    expect(scan.interruptedAfterFirst(lines, 4, none)).toBe(false);
    expect(take(reads)).toEqual([3]);
    lines.push(watchedLine(4, "# H", reads));
    expect(scan.interruptedAfterFirst(lines, 5, none)).toBe(true);
    expect(take(reads)).toEqual([4]);
    // Found, and still each new line is read once: what is kept is the indent of a line that matches, not the answer (the answer depends on the columns).
    lines.push(watchedLine(5, "x", reads));
    expect(scan.interruptedAfterFirst(lines, 6, none)).toBe(true);
    expect(take(reads)).toEqual([5]);
    expect(scan.interruptedAfterFirst(lines, 6, none)).toBe(true);
    expect(take(reads)).toEqual([]);
  });

  it("starts again when the paragraph starts somewhere else, and a count of 1 or less leaves what it has read alone", () => {
    const reads: number[] = [];
    const lines = ["x", "x", "# H", "x", "x"].map((text, k) => watchedLine(k, text, reads));
    const scan = new ParagraphInterruptScan();
    expect(scan.interruptedAfterFirst(lines, 5, none)).toBe(true);
    expect(take(reads)).toEqual([1, 2, 3, 4]);
    // The paragraph is now the last two lines: a different start, so it reads again from its second line.
    expect(scan.interruptedAfterFirst(lines, 2, none)).toBe(false);
    expect(take(reads)).toEqual([4]);
    expect(scan.interruptedAfterFirst(lines, 1, none)).toBe(false);
    expect(scan.interruptedAfterFirst(lines, 0, none)).toBe(false);
    expect(take(reads)).toEqual([]);
    expect(scan.interruptedAfterFirst(lines, 2, none)).toBe(false);
    expect(take(reads)).toEqual([]);
  });

  it("does not read again when the columns change, and answers under the columns it is given: a bullet six columns in is code under no open column and a bullet under a container at 4", () => {
    const reads: number[] = [];
    const lines = ["x", "x", "      - b"].map((text, k) => watchedLine(k, text, reads));
    const scan = new ParagraphInterruptScan();
    const four = [4];
    expect(scan.interruptedAfterFirst(lines, 3, none)).toBe(false);
    expect(take(reads)).toEqual([1, 2]);
    expect(scan.interruptedAfterFirst(lines, 3, four)).toBe(true);
    expect(scan.interruptedAfterFirst(lines, 3, [...four])).toBe(true);
    expect(scan.interruptedAfterFirst(lines, 3, [2])).toBe(false);
    expect(scan.interruptedAfterFirst(lines, 3, [2, 4])).toBe(true);
    expect(scan.interruptedAfterFirst(lines, 3, none)).toBe(false);
    expect(scan.interruptedAfterFirst(lines, 3, [3])).toBe(true);
    expect(take(reads)).toEqual([]);
  });

  it("answers by the indents of the lines that match the list: any indent under four is an interrupter whatever the columns, and a line that matches nothing is none", () => {
    const scan = (texts: string[], columns: readonly number[]): boolean =>
      new ParagraphInterruptScan().interruptedAfterFirst(texts.map(line), texts.length, columns);
    for (const columns of [[], [2], [4], [2, 4, 6, 8, 12]]) {
      expect(scan(["x", "# H"], columns)).toBe(true);
      expect(scan(["x", "   - b"], columns)).toBe(true);
      expect(scan(["x", "plain", "more"], columns)).toBe(false);
      expect(scan(["x", "    four spaces", "      plain"], columns)).toBe(false);
    }
    // Indent 4 is code under no column and a bullet under a column at 1 to 4 (code starts four columns past the deepest open column not past the line); indent 12 is a bullet only under a column of 9 to 12.
    expect(scan(["x", "    - b"], [])).toBe(false);
    expect(scan(["x", "    - b"], [2])).toBe(true);
    expect(scan(["x", "            - b"], [4])).toBe(false);
    expect(scan(["x", "            - b"], [4, 8])).toBe(false);
    expect(scan(["x", "            - b"], [4, 9])).toBe(true);
    // Two matching lines at different indents: the answer is "yes" when either is not code.
    expect(scan(["x", "    - b", "        - b"], [])).toBe(false);
    expect(scan(["x", "    - b", "        - b"], [2])).toBe(true);
    expect(scan(["x", "    - b", "        - b"], [6])).toBe(true);
  });

  it("starts again for another list of lines, and when the list it has read from has become shorter", () => {
    const reads: number[] = [];
    const first = ["x", "x", "x", "x"].map((text, k) => watchedLine(k, text, reads));
    const second = ["x", "x", "x", "x"].map((text, k) => watchedLine(k, text, reads));
    const scan = new ParagraphInterruptScan();
    expect(scan.interruptedAfterFirst(first, 4, none)).toBe(false);
    expect(take(reads)).toEqual([1, 2, 3]);
    expect(scan.interruptedAfterFirst(second, 4, none)).toBe(false);
    expect(take(reads)).toEqual([1, 2, 3]);
    expect(scan.interruptedAfterFirst(second, 4, none)).toBe(false);
    expect(take(reads)).toEqual([]);
    second.pop();
    expect(scan.interruptedAfterFirst(second, 3, none)).toBe(false);
    expect(take(reads)).toEqual([1, 2]);
  });

  it("does not change the lines it is given or the columns", () => {
    const lines = [line("x"), line("# H"), line("y")];
    const before = JSON.stringify(lines);
    const columns = [2, 4];
    new ParagraphInterruptScan().interruptedAfterFirst(lines, 3, columns);
    expect(JSON.stringify(lines)).toBe(before);
    expect(columns).toEqual([2, 4]);
  });

  // The shapes the first versions left quadratic, asked through ONE scan kept across the lines. The clock is read INSIDE the loop, because a synchronous loop that has gone quadratic cannot be interrupted by the test runner: a regression
  // must FAIL in about a second and not hang the suite for an hour (the review round measured 12,000 of 200,000 questions in 10 s under a key that never matched).
  const askGrowing = (columnsFor: (question: number) => readonly number[], interrupterAt: number): { falses: number; trues: number; ms: number; stoppedAt: number | null } => {
    const scan = new ParagraphInterruptScan();
    const lines: Array<{ text: string }> = [];
    const started = Date.now();
    let falses = 0;
    let trues = 0;
    for (let k = 0; k < LINEAR_LINES; k++) {
      lines.push(line(k === interrupterAt ? "<span>a</span>" : "x"));
      if (scan.interruptedAfterFirst(lines, lines.length, columnsFor(k))) trues += 1;
      else falses += 1;
      if (k % 1_000 === 999 && Date.now() - started > LINEAR_LIMIT_MS) return { falses, trues, ms: Date.now() - started, stoppedAt: k };
    }
    return { falses, trues, ms: Date.now() - started, stoppedAt: null };
  };

  it("answers 200,000 questions about a paragraph that grows by a line each time in linear time, with an interrupter in the middle", () => {
    // ONE array of columns, as `ColumnStack.columns()` hands out until a column enters or leaves.
    const columns = [2, 4];
    const result = askGrowing(() => columns, LINEAR_LINES / 2);
    expect(result).toMatchObject({ falses: LINEAR_LINES / 2, trues: LINEAR_LINES / 2, stoppedAt: null });
    expect(result.ms).toBeLessThan(LINEAR_LIMIT_MS);
  });

  it("answers them in linear time when the columns are a different array, with other content, for every question (the set of open columns changes between two questions of one paragraph)", () => {
    const result = askGrowing((question) => (question % 2 === 0 ? [2, 4] : [3]), LINEAR_LINES / 2);
    expect(result).toMatchObject({ falses: LINEAR_LINES / 2, trues: LINEAR_LINES / 2, stoppedAt: null });
    expect(result.ms).toBeLessThan(LINEAR_LIMIT_MS);
  });

  it("answers them in linear time when every question gets a fresh copy of the same columns", () => {
    const result = askGrowing(() => [2, 4], LINEAR_LINES / 2);
    expect(result).toMatchObject({ falses: LINEAR_LINES / 2, trues: LINEAR_LINES / 2, stoppedAt: null });
    expect(result.ms).toBeLessThan(LINEAR_LIMIT_MS);
  });

  // A paragraph whose interrupter-looking lines are all code under the columns asked about: the indents kept are few however many such lines there are.
  it("answers 200,000 questions about a paragraph of code-depth bullets in linear time", () => {
    const scan = new ParagraphInterruptScan();
    const lines: Array<{ text: string }> = [];
    const columns: number[] = [];
    const started = Date.now();
    let trues = 0;
    for (let k = 0; k < LINEAR_LINES; k++) {
      lines.push(line(k === 0 ? "x" : "    - b"));
      if (scan.interruptedAfterFirst(lines, lines.length, columns)) trues += 1;
      if (k % 1_000 === 999 && Date.now() - started > LINEAR_LIMIT_MS) break;
    }
    expect({ trues, ms: Date.now() - started < LINEAR_LIMIT_MS }).toEqual({ trues: 0, ms: true });
  });
});
