import { describe, expect, it } from "vitest";
import { findHeadings, isCloser, makeConsumedCloserLine, type CloserShape } from "../../src/core/qmd/model";
import { BOM, EM_SPACE, IDEOGRAPHIC, LS, NBSP, NEL, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

const HEAVY_ROW_MS = 120_000;
const SEEDED_HISTORIES = 300_000;
// What each row compared, `[questions, answers that found a closer]`. The first number is arithmetic (the sum over the documents of the questions each asks: for the first set and six lines, 10 x the sum of 7^n x (n + 2) = 10,751,810); both numbers were re-derived by a Python port of the old function, of `isCloser`, of the documents, of the
// histories each row asks (enumerated one by one, not multiplied) and of the seeded generator (`tools/consumed-closer-count/count.py`), which shares no code with this file. A row that reached fewer questions, or a different alphabet, fails here. A KIND of the full space that no seeded line tells from its neighbour is NOT pinned by a count (the
// Session 328 review changed `[0, 3, 6]` to `[0, 3, 7]` and a run length of 5 to 6 in `ALL_KINDS` with no failure): the fields of a kind are pinned by the rows that name them ("each field of a kind separates two kinds" below).
const COUNTS = {
  singlesA: [10_751_810, 3_580_150] as [number, number],
  singlesB: [1_336_700, 73_694] as [number, number],
  pairsA3: [1_885_200, 405_760] as [number, number],
  pairsB3: [9_123_200, 435_720] as [number, number],
  sweepsA: [4_019_670, 1_210_782] as [number, number],
  sweepsB: [4_010_100, 221_082] as [number, number],
  seeded: [1_350_257, 60_085] as [number, number],
  triplesA3: [1_386_240, 300_204] as [number, number],
  triplesB2: [286_440, 10_680] as [number, number],
};

// Session 328 — part (3) of the BACKLOG item "What is still quadratic or deep enough to overflow after Session 311". A refused fence opener asks `consumedCloserLine` for the closer it has swallowed, and the scan walked every non-blank line below the opener
// to a blank line or a closer, so N refused openers in one run with no blank line between them were N(N + 1)/2 tests of `isCloser` between them. `makeConsumedCloserLine(lines)` now keeps, per kind of opener, the span of its last scan and answers an opener that starts inside the span
// from it. That is only sound if the answer is the SAME for EVERY document, every kind of opener and every ORDER of questions (the answer of the reader depends on what it was asked before, which no function of one question can show), so the function it replaced is kept below,
// copied from the parent `fdd1f66` (the tree before the cure) as the oracle (Learning 738). `isCloser` is the model's own and is shared, not copied: this file proves the walk, and `isCloser` has not changed (its only edits are `export` and a narrower type for its parameter).

// ---- The OLD function, copied from the parent `fdd1f66` (`src/core/qmd/model.ts` lines 14091 to 14105); the one change is the type of `open` (`OpenCellFence` narrowed to the `CloserShape` it reads). ----
function oldConsumedCloserLine(lines: readonly string[], from: number, open: CloserShape): number {
  for (let k = from; k < lines.length; k++) {
    if (lines[k].trim() === "") {
      return -1;
    }
    if (isCloser(lines[k], open)) {
      return k;
    }
  }
  return -1;
}

const kind = (isCell: boolean, char: string, len: number, indent: string | null, columns: readonly number[]): CloserShape => ({ isCell, char, len, indent, columns });

// Ten kinds that differ from the first in ONE field each (or two, for a cell), for the exhaustive rows: the character, the length, the container columns, the cell indent (a `null` that does not require an indent, "" that requires none, two spaces), and the cell rule (exact length, any indent).
const KINDS: CloserShape[] = [
  kind(false, "`", 3, null, [0]),
  kind(false, "~", 3, null, [0]),
  kind(false, "`", 4, null, [0]),
  kind(false, "`", 3, null, [0, 4]),
  kind(false, "`", 3, "", [0]),
  kind(false, "`", 3, "  ", [0]),
  kind(true, "`", 3, null, [0]),
  kind(true, "`", 4, null, [0]),
  kind(true, "~", 3, null, [0]),
  kind(true, "`", 3, "  ", [0]),
];

// The full space the seeded rows draw from: 2 x 2 x 3 x 4 x 4 = 192 kinds.
const ALL_KINDS: CloserShape[] = [];
for (const isCell of [false, true]) {
  for (const char of ["`", "~"]) {
    for (const len of [3, 4, 5]) {
      for (const indent of [null, "", "  ", "\t"]) {
        for (const columns of [[0], [0, 2], [0, 4], [0, 3, 6]]) {
          ALL_KINDS.push(kind(isCell, char, len, indent, columns));
        }
      }
    }
  }
}

// The lines the exhaustive rows build documents from, one letter each. The first set holds the closers (three and four of each character, at indent 0, 2 and 4), a blank line and a word; the second holds the blanks the scan must stop at (a tab, a no-break space, a form feed, U+2028, a byte order mark, an ideographic space:
// every one of them is a blank to `trim()`; the whole class is stated, one row each, below) and the closers only a CELL accepts (a form feed or a no-break space before or after the run: `\s`, where a plain fence takes `[ \t]`).
const LINES_A: Record<string, string> = { a: "", b: "```", c: "````", d: "~~~", e: "  ```", f: "    ```", g: "word" };
const LINES_B: Record<string, string> = { a: "", b: NBSP, c: "\f", d: LS, e: BOM, f: IDEOGRAPHIC, g: "```", h: `\f\`\`\``, i: `\`\`\`${NBSP}`, j: "\t```", k: "```x", l: "> ```" };
const documentOf = (codes: string, lines: Record<string, string>): string[] => [...codes].map((code) => lines[code]);

type Tally = { compared: number; found: number; disagreements: string[] };
const newTally = (): Tally => ({ compared: 0, found: 0, disagreements: [] });
type Reader = (from: number, open: CloserShape) => number;
type MakeReader = (lines: readonly string[]) => Reader;

/** Ask `reader` (a fresh one per history) the questions in `history` and compare each answer with the old function's; the first disagreement of a history is kept (as the document and the questions asked up to it). */
function checkHistory(lines: readonly string[], kinds: readonly CloserShape[], history: ReadonlyArray<readonly [number, number]>, tally: Tally, make: MakeReader = makeConsumedCloserLine): void {
  const reader = make(lines);
  for (let step = 0; step < history.length; step++) {
    const [from, which] = history[step];
    const expected = oldConsumedCloserLine(lines, from, kinds[which]);
    const got = reader(from, kinds[which]);
    tally.compared++;
    if (expected >= 0) {
      tally.found++;
    }
    if (got !== expected) {
      if (tally.disagreements.length < 5) {
        tally.disagreements.push(JSON.stringify({ lines, asked: history.slice(0, step + 1), expected, got }));
      }
      return;
    }
  }
}

/** Every document of up to `maxLines` lines over `lines`' letters, shortest first. */
function* everyDocument(lines: Record<string, string>, maxLines: number): Generator<string[]> {
  for (const codes of everyString(Object.keys(lines), maxLines)) {
    yield documentOf(codes, lines);
  }
}

function compareSingles(documents: Iterable<string[]>, kinds: readonly CloserShape[], make?: MakeReader): Tally {
  const tally = newTally();
  for (const lines of documents) {
    for (let from = 0; from <= lines.length + 1; from++) {
      for (let which = 0; which < kinds.length; which++) {
        checkHistory(lines, kinds, [[from, which]], tally, make);
      }
    }
  }
  return tally;
}

/** Every pair of questions: the second is answered by a reader that has been asked the first (a hit on the first's span, a miss beyond or before it, another kind). */
function comparePairs(documents: Iterable<string[]>, kinds: readonly CloserShape[], make?: MakeReader): Tally {
  const tally = newTally();
  for (const lines of documents) {
    const questions: Array<readonly [number, number]> = [];
    for (let from = 0; from <= lines.length + 1; from++) {
      for (let which = 0; which < kinds.length; which++) {
        questions.push([from, which]);
      }
    }
    for (const first of questions) {
      for (const second of questions) {
        checkHistory(lines, kinds, [first, second], tally, make);
      }
    }
  }
  return tally;
}

/** Every ordered triple of questions of ONE kind (low, high, middle among them): a span replaced, a span kept, a question in the gap between two spans. Pairs, per-kind sweeps and a uniform draw never ask three questions of a kind in the order low, high, middle. */
function compareTriples(documents: Iterable<string[]>, kinds: readonly CloserShape[], make?: MakeReader): Tally {
  const tally = newTally();
  for (const lines of documents) {
    for (let which = 0; which < kinds.length; which++) {
      for (let a = 0; a <= lines.length + 1; a++) {
        for (let b = 0; b <= lines.length + 1; b++) {
          for (let c = 0; c <= lines.length + 1; c++) {
            checkHistory(lines, kinds, [[a, which], [b, which], [c, which]], tally, make);
          }
        }
      }
    }
  }
  return tally;
}

/** The orders a scan can ask in: every kind's positions ascending (the way `computeRegions` asks), descending, and all kinds interleaved at each position. One reader serves a whole sweep. */
function compareSweeps(documents: Iterable<string[]>, kinds: readonly CloserShape[], make?: MakeReader): Tally {
  const tally = newTally();
  for (const lines of documents) {
    const positions = Array.from({ length: lines.length + 2 }, (_, from) => from);
    const ascending: Array<readonly [number, number]> = [];
    const descending: Array<readonly [number, number]> = [];
    const interleaved: Array<readonly [number, number]> = [];
    for (let which = 0; which < kinds.length; which++) {
      for (const from of positions) {
        ascending.push([from, which]);
      }
      for (const from of [...positions].reverse()) {
        descending.push([from, which]);
      }
    }
    for (const from of positions) {
      for (let which = 0; which < kinds.length; which++) {
        interleaved.push([from, which]);
      }
    }
    checkHistory(lines, kinds, ascending, tally, make);
    checkHistory(lines, kinds, descending, tally, make);
    checkHistory(lines, kinds, interleaved, tally, make);
  }
  return tally;
}

/** The count of what a row compared, as `[compared, found]`, for the pin that says the row looked at what it was written to look at. */
const countsOf = (tally: Tally): [number, number] => [tally.compared, tally.found];

describe("consumedCloserLine: one reader per document answers as the old function did, whatever it was asked before", () => {
  it("has the stated kinds and letters", () => {
    expect([KINDS.length, ALL_KINDS.length]).toEqual([10, 192]);
    expect(new Set(KINDS.map((k) => JSON.stringify(k))).size).toBe(10);
    expect(new Set(ALL_KINDS.map((k) => JSON.stringify(k))).size).toBe(192);
    expect([Object.keys(LINES_A).length, Object.keys(LINES_B).length]).toEqual([7, 12]);
    // The count pins cannot tell one blank line from another (both stop the scan: swapping the no-break space of the second set for an empty line moves no count), so the letters are stated.
    expect(Object.values(LINES_A)).toEqual(["", "```", "````", "~~~", "  ```", "    ```", "word"]);
    expect(Object.values(LINES_B)).toEqual(["", NBSP, "\f", LS, BOM, IDEOGRAPHIC, "```", "\f```", `\`\`\`${NBSP}`, "\t```", "```x", "> ```"]);
    expect([countStrings(7, 4), countStrings(12, 3)]).toEqual([2_801, 1_885]);
  });

  it("answers the same to a single question on every document of up to six lines over the first set, for the ten kinds", () => {
    const tally = compareSingles(everyDocument(LINES_A, 6), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.singlesA);
  }, HEAVY_ROW_MS);

  it("answers the same to a single question on every document of up to four lines over the second set, for the ten kinds", () => {
    const tally = compareSingles(everyDocument(LINES_B, 4), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.singlesB);
  }, HEAVY_ROW_MS);

  it("answers the same to every PAIR of questions on every document of up to three lines over the first set (a hit on the first's span, a miss beyond or before it, another kind)", () => {
    const tally = comparePairs(everyDocument(LINES_A, 3), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.pairsA3);
  }, HEAVY_ROW_MS);

  it("answers the same to every pair of questions on every document of up to three lines over the second set", () => {
    const tally = comparePairs(everyDocument(LINES_B, 3), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.pairsB3);
  }, HEAVY_ROW_MS);

  it("answers the same to every ordered TRIPLE of questions of one kind on every document of up to three lines over the first set (a span replaced, kept, a question in the gap between two spans)", () => {
    const tally = compareTriples(everyDocument(LINES_A, 3), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.triplesA3);
  }, HEAVY_ROW_MS);

  it("answers the same to every ordered triple of questions of one kind on every document of up to two lines over the second set", () => {
    const tally = compareTriples(everyDocument(LINES_B, 2), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.triplesB2);
  }, HEAVY_ROW_MS);

  it("answers the same to a whole sweep (every kind ascending, descending, interleaved) on every document of up to five lines over the first set", () => {
    const tally = compareSweeps(everyDocument(LINES_A, 5), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.sweepsA);
  }, HEAVY_ROW_MS);

  it("answers the same to a whole sweep on every document of up to four lines over the second set", () => {
    const tally = compareSweeps(everyDocument(LINES_B, 4), KINDS);
    expect(tally.disagreements).toEqual([]);
    expect(countsOf(tally)).toEqual(COUNTS.sweepsB);
  }, HEAVY_ROW_MS);

  it("answers the same to 300,000 seeded histories of 1 to 8 questions on seeded documents of up to 39 lines, over all 192 kinds", () => {
    const random = seededRandom(328);
    const pool = [LINES_A, LINES_B].map((set) => Object.values(set));
    const tally = newTally();
    for (let n = 0; n < SEEDED_HISTORIES; n++) {
      const letters = pool[n % pool.length];
      // Blank lines are rare, so most runs are long and most histories land inside a span.
      const lines: string[] = [];
      const count = Math.floor(random() * random() * 40);
      for (let k = 0; k < count; k++) {
        const pick = letters[Math.floor(random() * letters.length)];
        lines.push(pick.trim() === "" && random() < 0.7 ? "```text i" : pick);
      }
      const history: Array<readonly [number, number]> = [];
      const length = 1 + Math.floor(random() * 8);
      let from = Math.floor(random() * (count + 2));
      for (let step = 0; step < length; step++) {
        // Mostly ascending, with a jump back now and then (a reader asked out of order must still be right).
        from = random() < 0.2 ? Math.floor(random() * (count + 2)) : Math.min(count + 1, from + Math.floor(random() * 4));
        history.push([from, Math.floor(random() * ALL_KINDS.length)]);
      }
      checkHistory(lines, ALL_KINDS, history, tally);
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.compared).toBeGreaterThan(SEEDED_HISTORIES);
    expect(countsOf(tally)).toEqual(COUNTS.seeded);
  }, HEAVY_ROW_MS);
});

// The answers of the old function, stated. Each is checked against the old function AND the new reader, so a wrong statement fails here and a wrong function fails there.
describe("consumedCloserLine: stated answers", () => {
  const PLAIN = KINDS[0];
  const CELL = KINDS[6];
  const rows: Array<[string, string[], number, CloserShape, number]> = [
    ["finds the first closer below the opener", ["x", "```text i", "word", "```", "word", "```"], 2, PLAIN, 3],
    ["finds a closer on the line asked about", ["```"], 0, PLAIN, 0],
    ["stops at a blank line before a closer", ["word", "", "```"], 0, PLAIN, -1],
    ["stops at a line of tabs", ["word", "\t", "```"], 0, PLAIN, -1],
    ["stops at a line of no-break spaces", ["word", NBSP, "```"], 0, PLAIN, -1],
    ["stops at a line of form feeds", ["word", "\f\f", "```"], 0, PLAIN, -1],
    ["stops at U+2028, a byte order mark and an ideographic space (all blanks to trim)", ["word", LS, BOM, IDEOGRAPHIC, "```"], 0, PLAIN, -1],
    ["asked on a blank line, finds nothing though a closer follows", ["", "```"], 0, PLAIN, -1],
    ["finds nothing in a run with no closer", ["word", "```text i", "```text i"], 0, PLAIN, -1],
    ["finds nothing past the end", ["```"], 1, PLAIN, -1],
    ["finds nothing far past the end", ["```"], 50, PLAIN, -1],
    ["a plain fence is closed by a longer run", ["word", "````"], 0, PLAIN, 1],
    ["a plain fence of four is not closed by three", ["word", "```", "````"], 0, KINDS[2], 2],
    ["a cell is closed by the exact length only", ["word", "````", "```"], 0, CELL, 2],
    ["the other character does not close it", ["word", "~~~", "```"], 0, PLAIN, 2],
    ["a tilde fence is closed by a tilde run", ["word", "```", "~~~"], 0, KINDS[1], 2],
    ["a closer at indent four is code to a plain fence in the top container", ["word", "    ```", "```"], 0, PLAIN, 2],
    ["a closer at indent four is a closer where the container is at column four", ["word", "    ```"], 0, KINDS[3], 1],
    ["a cell takes a closer at any indent", ["word", "    ```"], 0, CELL, 1],
    ["a cell takes a form feed before the run, a plain fence does not", ["word", "\f```", "```"], 0, PLAIN, 2],
    ["a cell takes a form feed before the run", ["word", "\f```", "```"], 0, CELL, 1],
    ["a cell takes a no-break space after the run", ["word", `\`\`\`${NBSP}`], 0, CELL, 1],
    ["an indent-pinned cell closes on that indent only", ["word", "```", "  ```"], 0, KINDS[9], 2],
    ["a plain fence pinned to no indent closes at column zero only", ["word", "  ```", "```"], 0, KINDS[4], 2],
    ["a quote marker before the run is not a closer", ["word", "> ```", "```x", "``` x"], 0, PLAIN, -1],
    ["trailing blanks after the run are allowed", ["word", "```  \t"], 0, PLAIN, 1],
  ];

  it.each(rows)("%s", (_title, lines, from, open, expected) => {
    expect(oldConsumedCloserLine(lines, from, open)).toBe(expected);
    expect(makeConsumedCloserLine(lines)(from, open)).toBe(expected);
  });

  // The blank test is `trim() === ""`: the classes it separates, one row each (Learning 831). `trim()` strips every WhiteSpace and LineTerminator code point, so a vertical tab, a carriage return, U+1680, the spaces of U+2000 to U+200A (all eleven, one row each: a hand-made class missing U+2005 survived the first rows), U+202F, U+205F and the paragraph separator are
  // blanks as much as a space is, and U+0085, a zero-width space, the Mongolian vowel separator, a word joiner and a NUL are NOT: a hand-made set of blanks that leaves one out (or takes one in) answers differently on the line that follows.
  const BLANKS: Array<[string, string]> = [
    ["a space", " "], ["a tab", "\t"], ["a vertical tab", "\v"], ["a form feed", "\f"], ["a carriage return", "\r"], ["a no-break space", NBSP], ["U+1680", String.fromCharCode(0x1680)],
    ...Array.from({ length: 11 }, (_, k): [string, string] => [`U+${(0x2000 + k).toString(16).toUpperCase()}`, String.fromCharCode(0x2000 + k)]),
    ["U+2028", LS], ["U+2029", PS], ["a narrow no-break space", String.fromCharCode(0x202f)], ["a medium mathematical space", String.fromCharCode(0x205f)],
    ["an ideographic space", IDEOGRAPHIC], ["a byte order mark", BOM], ["three of them", " \t\u00a0"],
  ];
  it("states every one of the eleven spaces of U+2000 to U+200A and the em space is one of them", () => {
    expect(BLANKS.filter(([title]) => /^U\+200[0-9A]$/.test(title)).map(([, text]) => text.charCodeAt(0))).toEqual(Array.from({ length: 11 }, (_, k) => 0x2000 + k));
    expect(BLANKS.some(([, text]) => text === EM_SPACE)).toBe(true);
  });
  const NOT_BLANKS: Array<[string, string]> = [
    ["U+0085", NEL], ["a zero-width space", String.fromCharCode(0x200b)], ["a Mongolian vowel separator", String.fromCharCode(0x180e)], ["a word joiner", String.fromCharCode(0x2060)], ["a NUL", "\0"], ["a soft hyphen", String.fromCharCode(0xad)],
  ];
  it.each(BLANKS)("a line of %s is blank to the scan: it stops there, though a closer follows", (_title, blank) => {
    const lines = ["word", blank, "```"];
    expect(oldConsumedCloserLine(lines, 0, KINDS[0])).toBe(-1);
    expect(makeConsumedCloserLine(lines)(0, KINDS[0])).toBe(-1);
    expect(makeConsumedCloserLine(lines)(1, KINDS[0])).toBe(-1); // asked on the blank line itself
  });

  it.each(NOT_BLANKS)("a line of %s is not blank to the scan: it goes on to the closer below", (_title, text) => {
    const lines = ["word", text, "```"];
    expect(oldConsumedCloserLine(lines, 0, KINDS[0])).toBe(2);
    expect(makeConsumedCloserLine(lines)(0, KINDS[0])).toBe(2);
  });

  // What the reader keeps, stated by what it answers when the lines it was shown are no longer the lines. A document's lines do not change; a test may change them, and the answer then shows whether the reader read them again. This is a way to SEE the span, not a rule the model relies on.
  it("answers a later opener inside the first scan's span from the first scan, and scans afresh outside it", () => {
    const lines = ["word", "word", "word", "```", "word"];
    const read = makeConsumedCloserLine(lines);
    expect(read(0, KINDS[0])).toBe(3);
    lines[3] = "word"; // the closer is gone; the reader has not read this line again
    expect(read(1, KINDS[0])).toBe(3); // inside [0, 3]
    expect(read(3, KINDS[0])).toBe(3); // the end of the span
    expect(read(4, KINDS[0])).toBe(-1); // beyond it: scanned afresh, and the closer is gone
    expect(read(0, KINDS[0])).toBe(-1); // before the span now kept [4, 5]: scanned afresh
  });

  it("answers a later opener inside a scan that found nothing from that scan, to the line that stopped it", () => {
    const lines = ["word", "word", "", "```", "```"];
    const read = makeConsumedCloserLine(lines);
    expect(read(0, KINDS[0])).toBe(-1); // stopped at the blank line, index 2
    lines[2] = "```"; // no longer blank
    expect(read(1, KINDS[0])).toBe(-1); // inside [0, 2]
    expect(read(2, KINDS[0])).toBe(-1); // the stopping line itself
    expect(read(3, KINDS[0])).toBe(3); // beyond it: scanned afresh
  });

  it("keeps one span per kind: a scan of one kind does not replace another's", () => {
    const lines = ["word", "word", "~~~", "```", "word"];
    const read = makeConsumedCloserLine(lines);
    expect(read(0, KINDS[0])).toBe(3);
    expect(read(0, KINDS[1])).toBe(2);
    lines[2] = "word";
    lines[3] = "word";
    expect(read(1, KINDS[0])).toBe(3); // still the first kind's span
    expect(read(1, KINDS[1])).toBe(2);
  });

  it("tells kinds apart by every field of the opener", () => {
    const lines = ["word", "    ```", "````", "```", "~~~", "  ```"];
    const answers = KINDS.map((open) => makeConsumedCloserLine(lines)(0, open));
    expect(answers).toEqual(KINDS.map((open) => oldConsumedCloserLine(lines, 0, open)));
    // One reader asked all ten: no kind may take another's span.
    const shared = makeConsumedCloserLine(lines);
    expect(KINDS.map((open) => shared(0, open))).toEqual(answers);
    expect(KINDS.map((open) => shared(1, open))).toEqual(KINDS.map((open) => oldConsumedCloserLine(lines, 1, open)));
    expect(new Set(answers).size).toBeGreaterThan(3);
  });

  // `null` and "" are two indents, and the key of a kind must not make them one (a key joined from the fields could read a `null` as the string "null" or as an empty one).
  it("tells an opener with no indent to match from one that must match an empty indent", () => {
    const lines = ["word", "  ```", "```"];
    const shared = makeConsumedCloserLine(lines);
    expect(shared(0, KINDS[0])).toBe(1);
    expect(shared(0, KINDS[4])).toBe(2);
    expect(shared(0, kind(false, "`", 3, "null", [0]))).toBe(-1);
    expect(shared(0, KINDS[0])).toBe(1);
  });
});

// The wiring in `computeRegions`: `consumedCloserLine(i + 1, candidate)` asks for the closer BELOW the refused opener, in the kind the opener has. Asked from the opener's own line, a bare fence refused under a paragraph (it is closer-shaped itself) is its own closer: the real closer is
// then NOT swallowed, and the heading after it is shown where the parent hides it. These are the answers of the parent `fdd1f66`, which the cure shares (checked on each document), and NOT measured against `quarto render`. The first four were found by shrinking the documents on which a mutant that
// asks from `i` differs from the cure (64 of 600,000 random documents of up to ten lines): that mutant shows the heading (`H`, `H`, `T`) on the first three. The next six are the Session 328 review's: each is a document on which forcing ONE argument of the call changes the headings, the
// argument being the container columns (W02: `[0]`), the run length (W03: 3), the cell indent (W05: an empty one), whether the opener is a cell (W06) and a run length held in a byte or capped (M05: 259 backticks, M06: 7 and 6).
describe("consumedCloserLine: the call in computeRegions asks below the opener, in the opener's own kind", () => {
  const headings = (lines: string[]): unknown => findHeadings(`${lines.join("\n")}\n`).map((heading) => [heading.level, heading.text, heading.line]);
  const ticks = (count: number): string => "`".repeat(count);
  it.each([
    ["a paragraph, a bare tilde fence, a list item, two more", ["x", "~~~", "- a", "~~~", "~~~", "# H"], []],
    ["the same with the first fence indented", ["p", "  ~~~", "- a", "~~~", "~~~", "# H"], []],
    ["the same with a longer last fence and a level-two heading", ["p", "~~~", "- a", "~~~", "~~~~", "## T"], []],
    ["a blank line before the heading frees it", ["x", "~~~", "- a", "~~~", "~~~", "", "# H"], [[1, "H", 6]]],
    ["W02: columns of the opener (a list item): a closer at indent five is not code to it", ["  - b", "", "     ```text i", "     ```", "```", "```", "# H"], [[1, "H", 6]]],
    ["W03: the run length of the opener: three backticks do not close four", ["````text i", "```", "  ```", "## T"], [[2, "T", 3]]],
    ["W05: the indent of the opener is none (null), not an empty one to match: an indented closer closes", ["> ```text i", "  ```", "      ```", "  # H", "````"], [[1, "H", 3]]],
    ["W06: the opener is not a cell: a longer closer closes it", ["  ```text i", "````", "````", "# H"], []],
    ["M05: an opener of 259 backticks is not one of 3", [`${ticks(259)}text i`, "```text i", "```", "", "# H", "", "```"], [[1, "H", 4]]],
    ["M06: openers of 7 and 6 backticks are not one kind", [`${ticks(7)}text i`, `${ticks(6)}text i`, ticks(6), "", "# H", "", ticks(6)], [[1, "H", 4]]],
  ] as Array<[string, string[], unknown]>)("%s", (_title, lines, expected) => {
    expect(headings(lines)).toEqual(expected);
  });
});

// Each field of a kind has to separate two kinds, and the exhaustive rows cannot show it: their documents have indents 0, 2 and 4 only, columns `[0]` and `[0, 4]`, and runs of 3 to 5, so a key that merges `[0, 2]` with `[0, 4]`, joins the digits of `[0, 12]` and `[0, 1, 2]` into one
// string, keeps only the last column, holds a run length in a byte or caps it, or keys an indent by its length, answers every one of those documents alike (the Session 328 review: M01 to M07 all survived). Each row is a document whose old answers differ for the two kinds; ONE reader is asked both, in both orders.
describe("consumedCloserLine: each field of a kind separates two kinds", () => {
  const rows: Array<[string, string[], CloserShape, CloserShape]> = [
    ["columns [0, 2] against [0, 4] (a closer at indent six: code to one, not to the other)", ["w", "      ```"], kind(false, "`", 3, null, [0, 2]), kind(false, "`", 3, null, [0, 4])],
    ["columns [0, 12] against [0, 1, 2] (indent four; the digits join to the same string)", ["w", "    ```"], kind(false, "`", 3, null, [0, 12]), kind(false, "`", 3, null, [0, 1, 2])],
    ["columns [0, 6] against [0, 3, 6] (indent four; the same last column)", ["w", "    ```"], kind(false, "`", 3, null, [0, 6]), kind(false, "`", 3, null, [0, 3, 6])],
    ["columns [0, 4] against [0, 3, 6] (indent eight; both are nested)", ["w", "        ```"], kind(false, "`", 3, null, [0, 4]), kind(false, "`", 3, null, [0, 3, 6])],
    ["run length 259 against 3 (a byte holds both as 3)", ["w", "```"], kind(false, "`", 259, null, [0]), kind(false, "`", 3, null, [0])],
    ["run length 7 against 6 (a cap at 5 holds both as 5)", ["w", "``````"], kind(false, "`", 7, null, [0]), kind(false, "`", 6, null, [0])],
    ["cell run length 6 against 5 (a cell closes on the exact length)", ["w", "`````"], kind(true, "`", 6, null, [0]), kind(true, "`", 5, null, [0])],
    ["cell indent a tab against one space (the same length)", ["w", " ```"], kind(true, "`", 3, "\t", [0]), kind(true, "`", 3, " ", [0])],
    ["plain indent a tab against one space (the same length)", ["w", " ```"], kind(false, "`", 3, "\t", [0]), kind(false, "`", 3, " ", [0])],
    ["no indent against an empty one (null against \"\")", ["w", "  ```"], kind(false, "`", 3, null, [0]), kind(false, "`", 3, "", [0])],
    ["a cell against a plain fence (a longer run closes the plain one only)", ["w", "````"], kind(true, "`", 3, null, [0]), kind(false, "`", 3, null, [0])],
    ["a tilde against a backtick", ["w", "~~~"], kind(false, "~", 3, null, [0]), kind(false, "`", 3, null, [0])],
  ];

  it.each(rows)("%s", (_title, lines, a, b) => {
    const expectedA = oldConsumedCloserLine(lines, 0, a);
    const expectedB = oldConsumedCloserLine(lines, 0, b);
    expect(expectedA).not.toBe(expectedB); // the document tells the two kinds apart
    const ab = makeConsumedCloserLine(lines);
    expect([ab(0, a), ab(0, b), ab(1, a), ab(1, b)]).toEqual([expectedA, expectedB, oldConsumedCloserLine(lines, 1, a), oldConsumedCloserLine(lines, 1, b)]);
    const ba = makeConsumedCloserLine(lines);
    expect([ba(0, b), ba(0, a), ba(1, b), ba(1, a)]).toEqual([expectedB, expectedA, oldConsumedCloserLine(lines, 1, b), oldConsumedCloserLine(lines, 1, a)]);
  });
});

// The cost, pinned as lines READ, which does not move with the load. A counted array gives `lines[k]` reads to the function without changing what it sees.
//
// The pins are RELATIVE (the Session 328 review): what a whole sequence of questions costs is compared with what the FIRST question of each scan costs on a fresh reader, so they say "no line is read again", not "two reads a line". The first draft pinned `2 * (n - 1)`, and an edit that
// reads `lines[k]` once into a local, or tests the closer before the blank line, reddened them with the same answers. `LINEAR` is the second guard, a bound with room (no line read more than six times), and `scanReads` must be more than nothing, so a counter that counts nothing cannot pass.
function counted(lines: readonly string[]): { lines: readonly string[]; reads: () => number } {
  let reads = 0;
  const proxy = new Proxy(lines as string[], {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) {
        reads++;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return { lines: proxy, reads: () => reads };
}

/** Ask the way `computeRegions` does: the line below each line of `openers`, ascending, in the kind that line has. */
function askAll(lines: readonly string[], openers: ReadonlyArray<readonly [number, CloserShape]>, make: MakeReader): number[] {
  const read = make(lines);
  return openers.map(([at, open]) => read(at + 1, open));
}
const oldMaker: MakeReader = (lines) => (from, open) => oldConsumedCloserLine(lines, from, open);

/** The reads of ONE scan: the first question of a fresh reader, for the opener on line `at`. */
function scanReads(lines: readonly string[], at: number, open: CloserShape): number {
  const counting = counted(lines);
  makeConsumedCloserLine(counting.lines)(at + 1, open);
  return counting.reads();
}
const LINEAR = (lines: number): number => 6 * lines;

describe("consumedCloserLine: the cost, as lines read", () => {
  const PLAIN = KINDS[0];
  const openersOf = (lines: readonly string[], text: string, open: CloserShape = PLAIN): Array<readonly [number, CloserShape]> => lines.flatMap((line, at) => (line === text ? [[at, open] as const] : []));

  it("counts the old function's reads: n(n-1) for n refused openers in one run with no closer (two reads a line)", () => {
    const n = 100;
    const lines = Array.from({ length: n }, () => "```text i");
    const old = counted(lines);
    askAll(old.lines, openersOf(lines, "```text i"), oldMaker);
    // The opener at index k scans lines k+1 .. n-1: n - 1 - k lines, and each line is read twice (`trim()`, then `isCloser`). Sum over k = 0..n-1 is n(n-1)/2 lines, n(n-1) reads.
    expect(old.reads()).toBe(n * (n - 1));
  });

  it.each([100, 1_000, 3_000])("reads a run of %i refused openers once, not once per opener", (n) => {
    const lines = Array.from({ length: n }, () => "```text i");
    const openers = openersOf(lines, "```text i");
    const fresh = counted(lines);
    expect(askAll(fresh.lines, openers, makeConsumedCloserLine)).toEqual(askAll(lines, openers, oldMaker));
    const oneScan = scanReads(lines, 0, PLAIN);
    expect(oneScan).toBeGreaterThanOrEqual(n - 1); // the scan does read the run
    expect(fresh.reads()).toBe(oneScan); // and every other opener reads nothing
    expect(fresh.reads()).toBeLessThanOrEqual(LINEAR(n));
  });

  it("reads a run with a closer at its end once: the first opener walks to the closer, the rest take its answer", () => {
    const n = 1_000;
    const lines = [...Array.from({ length: n }, () => "```text i"), "```"];
    const openers = openersOf(lines, "```text i");
    const fresh = counted(lines);
    expect(askAll(fresh.lines, openers, makeConsumedCloserLine)).toEqual(new Array<number>(n).fill(n));
    expect(fresh.reads()).toBe(scanReads(lines, 0, PLAIN));
    expect(fresh.reads()).toBeGreaterThanOrEqual(n);
    expect(fresh.reads()).toBeLessThanOrEqual(LINEAR(n));
  });

  it("reads a run once per kind when the kinds are interleaved: three kinds, three reads of the run", () => {
    const n = 999;
    const kinds = [PLAIN, KINDS[1], KINDS[2]];
    const lines = Array.from({ length: n }, (_, k) => ["```text i", "~~~r", "````text i"][k % 3]);
    const openers = lines.map((_, at) => [at, kinds[at % 3]] as const);
    const fresh = counted(lines);
    expect(askAll(fresh.lines, openers, makeConsumedCloserLine)).toEqual(askAll(lines, openers, oldMaker));
    // Each kind's first question is at the first line of that kind (0, 1, 2); the rest take their kind's span.
    expect(fresh.reads()).toBe(scanReads(lines, 0, kinds[0]) + scanReads(lines, 1, kinds[1]) + scanReads(lines, 2, kinds[2]));
    expect(fresh.reads()).toBeLessThanOrEqual(LINEAR(3 * n));
  });

  // A cap on the kinds kept (the review's M15: at most eight, then cleared) answers right and reads each kind's run again once nine kinds take turns.
  it("reads a run once per kind when nine kinds are interleaved (no cap on the kinds kept)", () => {
    const n = 1_800;
    const kinds = KINDS.slice(0, 9);
    const lines = Array.from({ length: n }, () => "```text i");
    const openers = lines.map((_, at) => [at, kinds[at % 9]] as const);
    const fresh = counted(lines);
    expect(askAll(fresh.lines, openers, makeConsumedCloserLine)).toEqual(askAll(lines, openers, oldMaker));
    expect(fresh.reads()).toBe(kinds.reduce((sum, open, j) => sum + scanReads(lines, j, open), 0));
    expect(fresh.reads()).toBeLessThanOrEqual(LINEAR(9 * n));
  });

  it("reads each run between blank lines once: the span of one run is not the next run's", () => {
    const runs = 200;
    const per = 50;
    const lines: string[] = [];
    for (let r = 0; r < runs; r++) {
      lines.push(...Array.from({ length: per }, () => "```text i"), r % 2 === 0 ? "```" : "word", "");
    }
    const openers = openersOf(lines, "```text i");
    const fresh = counted(lines);
    expect(askAll(fresh.lines, openers, makeConsumedCloserLine)).toEqual(askAll(lines, openers, oldMaker));
    // One scan per run, for the first opener of the run (every run holds `per` openers, a closer or a word, and a blank line).
    let expected = 0;
    for (let r = 0; r < runs; r++) {
      expected += scanReads(lines, r * (per + 2), PLAIN);
    }
    expect(fresh.reads()).toBe(expected);
    expect(fresh.reads()).toBeLessThanOrEqual(LINEAR(lines.length));
  });

  // The ends of a span. A boundary read as one line too few or too many gives the same ANSWER (the scan it triggers finds what the span already held, or the span reaches a line it should not) in most places, so these count the reads: after the first scan, nothing is read.
  it("answers a question asked again, and a question on the closer's own line, without reading a line", () => {
    const lines = ["word", "word", "```", "word"];
    const counting = counted(lines);
    const read = makeConsumedCloserLine(counting.lines);
    expect(read(1, PLAIN)).toBe(2);
    const afterFirst = counting.reads();
    expect(afterFirst).toBeGreaterThan(0);
    expect(read(1, PLAIN)).toBe(2); // the same question again
    expect(read(2, PLAIN)).toBe(2); // the closer's own line is the end of the span
    expect(counting.reads()).toBe(afterFirst);
  });

  it("answers a question on the blank line that stopped a scan, and one at the end of the text that a scan ran to, without reading a line", () => {
    const stopped = counted(["word", "word", "", "```"]);
    const readStopped = makeConsumedCloserLine(stopped.lines);
    expect(readStopped(0, PLAIN)).toBe(-1);
    const afterStop = stopped.reads();
    expect(afterStop).toBeGreaterThan(0);
    expect(readStopped(0, PLAIN)).toBe(-1);
    expect(readStopped(2, PLAIN)).toBe(-1); // the blank line itself is the end of the span
    expect(stopped.reads()).toBe(afterStop);

    const ran = counted(["word", "word"]);
    const readRan = makeConsumedCloserLine(ran.lines);
    expect(readRan(0, PLAIN)).toBe(-1);
    const afterRun = ran.reads();
    expect(afterRun).toBeGreaterThan(0);
    expect(readRan(1, PLAIN)).toBe(-1);
    expect(readRan(2, PLAIN)).toBe(-1); // lines.length is the end of the span
    expect(ran.reads()).toBe(afterRun);
  });

  // A scan of ONE line is a span too (the review's M10: a scan that read a single line was not kept, so the same question asked again read it again).
  it("keeps a scan of a single line: the same question asked 1,000 times reads that line once", () => {
    const lines = ["word", "```", "word"];
    const counting = counted(lines);
    const read = makeConsumedCloserLine(counting.lines);
    expect(read(1, PLAIN)).toBe(1);
    const afterFirst = counting.reads();
    for (let k = 0; k < 1_000; k++) {
      expect(read(1, PLAIN)).toBe(1);
    }
    expect(counting.reads()).toBe(afterFirst);
  });

  // A span is not narrowed by the questions it answers (the review's M12: a hit narrowed the span to the question, so a question back toward the start of the span read the run again).
  it("keeps the whole span through questions that jump about inside it", () => {
    const n = 1_000;
    const lines = Array.from({ length: n }, () => "```text i");
    const counting = counted(lines);
    const read = makeConsumedCloserLine(counting.lines);
    expect(read(1, PLAIN)).toBe(-1);
    const afterFirst = counting.reads();
    for (const from of [500, 2, 700, 3, 900, 4, 800, 1, 999, 2, 1_000]) {
      expect(read(from, PLAIN)).toBe(-1);
    }
    expect(counting.reads()).toBe(afterFirst);
  });

  // The key is the five fields, not the opener (the review's M08 and M09: the key was the object itself, or the whole opener with its line number; both gave the same partition on the unit rows, whose openers are one shared object, and only the 16,000-opener clock rows killed them).
  it("shares a span between openers that are different objects with the same five fields and other fields besides", () => {
    const n = 1_000;
    const lines = Array.from({ length: n }, () => "```text i");
    const extras = (at: number): object => ({ startLine: at, quoted: false, lang: "", contentStart: 0, boundColumn: null });
    const openers: Array<readonly [number, CloserShape]> = lines.map((_, at) => [at, { ...PLAIN, columns: [...PLAIN.columns], ...extras(at) }] as const);
    const fresh = counted(lines);
    expect(askAll(fresh.lines, openers, makeConsumedCloserLine)).toEqual(new Array<number>(n).fill(-1));
    expect(fresh.reads()).toBe(scanReads(lines, 0, PLAIN));
  });

  it("scans afresh when asked beyond the closer it found, and the new scan starts where it was asked", () => {
    const n = 500;
    const lines = [...Array.from({ length: n }, () => "```text i"), "```", ...Array.from({ length: n }, () => "```text i"), "```"];
    const openers = openersOf(lines, "```text i");
    const fresh = counted(lines);
    const got = askAll(fresh.lines, openers, makeConsumedCloserLine);
    expect(got).toEqual(askAll(lines, openers, oldMaker));
    // Two scans, for the first opener of each run; the question at the end of the first run (the line of its closer) is inside the first span.
    expect(fresh.reads()).toBe(scanReads(lines, 0, PLAIN) + scanReads(lines, n + 1, PLAIN));
  });
});

// A position kept in 16 bits, or a span ended at 2^20, answers right on every row above, whose documents are a few thousand lines at most.
describe("consumedCloserLine: the reach of the span", () => {
  const PLAIN = KINDS[0];
  it.each([70_000, 1_100_000])("reads a run of %i refused openers once, and finds the closer on the line below the last", (n) => {
    const lines = [...Array.from({ length: n }, () => "```text i"), "```", "word", ""];
    const counting = counted(lines);
    const read = makeConsumedCloserLine(counting.lines);
    // The first opener reads lines 1 .. n (the closer is line n); every other opener and the closer's own line take the span's answer; the word below the closer is outside the span and is scanned afresh.
    expect(read(1, PLAIN)).toBe(n);
    const oneScan = counting.reads();
    expect(oneScan).toBeGreaterThanOrEqual(n);
    expect(oneScan).toBeLessThanOrEqual(LINEAR(n));
    expect(read(n / 2, PLAIN)).toBe(n);
    expect(read(n, PLAIN)).toBe(n); // the closer's own line is the end of the span
    expect(counting.reads()).toBe(oneScan);
    expect(read(n + 1, PLAIN)).toBe(-1); // past it: scanned afresh (a word, then the blank line)
    const afterTail = counting.reads();
    expect(afterTail).toBe(oneScan + scanReads(lines, n, PLAIN));
    expect(read(n + 1, PLAIN)).toBe(-1); // and kept
    expect(counting.reads()).toBe(afterTail);
  });
});

// A comparison that cannot report a disagreement is no comparison: `expect(tally.disagreements).toEqual([])` passes just as well if the helpers never fill the list. These readers are wrong in one way each; every one must be reported by the pair row and by the sweep row.
describe("consumedCloserLine: the comparison can fail", () => {
  /** A copy of the reader with one defect. `which` picks it. */
  function defective(which: "sameKind" | "noEnd" | "noStart" | "pastCloser" | "stopsEarly" | "ignoresBlank"): MakeReader {
    return (lines) => {
      const last = new Map<string, { from: number; found: number; end: number }>();
      return (from, open) => {
        const key = which === "sameKind" ? "" : JSON.stringify([open.isCell, open.char, open.len, open.indent, open.columns]);
        const known = last.get(key);
        if (known !== undefined) {
          const afterStart = which === "noStart" || known.from <= from;
          const endBound = which === "pastCloser" && known.found >= 0 ? known.end + 1 : known.end;
          const beforeEnd = which === "noEnd" || from <= endBound;
          if (afterStart && beforeEnd) {
            return known.found;
          }
        }
        let k = from;
        let found = -1;
        for (; k < lines.length; k++) {
          if (which !== "ignoresBlank" && lines[k].trim() === "") {
            break;
          }
          if (isCloser(lines[k], open)) {
            found = k;
            break;
          }
          if (which === "stopsEarly" && k - from >= 1) {
            break; // gives up after two lines
          }
        }
        last.set(key, { from, found, end: k });
        return found;
      };
    };
  }

  it.each(["sameKind", "noEnd", "noStart", "pastCloser", "stopsEarly", "ignoresBlank"] as const)("reports the reader that %s", (which) => {
    const pairs = comparePairs(everyDocument(LINES_A, 3), KINDS, defective(which));
    // A history ends at its first disagreement, so a wrong reader is asked at most as many questions as the full row: exactly as many when it can only be wrong at the SECOND question of a pair (a reader that has been asked nothing has nothing to serve from), fewer when its scan is wrong at the first.
    expect(pairs.compared).toBeGreaterThan(0);
    expect(pairs.compared).toBeLessThanOrEqual(COUNTS.pairsA3[0]);
    expect(pairs.disagreements.length).toBeGreaterThan(0);
    expect(JSON.parse(pairs.disagreements[0])).toHaveProperty("asked");
  });

  it("the sweep row reports every reader that is wrong about the span or the kind", () => {
    for (const which of ["sameKind", "noEnd", "noStart", "pastCloser"] as const) {
      expect(compareSweeps(everyDocument(LINES_A, 4), KINDS, defective(which)).disagreements.length).toBeGreaterThan(0);
    }
  });
});

// A clock row that cannot fail is no row (blank-tail-equivalence.test.ts): the OLD function must say "slow" on the very shape the Session 328 clock rows of pathological-inputs.test.ts time, asked the way `computeRegions` asks.
describe("consumedCloserLine: the clock rows can fail", () => {
  const timed = <T>(run: () => T): { result: T; ms: number } => {
    const started = performance.now();
    const result = run();
    return { result, ms: performance.now() - started };
  };

  it("the old function takes far longer than the reader on 4,000 refused openers in one run (about 0.24 s against about 1 ms, warm, the review at load near 90; 0.4 s against under 5 ms at load 3 to 6)", () => {
    const lines = Array.from({ length: 4_000 }, () => "```text i");
    const openers = lines.map((_, at) => [at, KINDS[0]] as const);
    const slow = timed(() => askAll(lines, openers, oldMaker));
    const fastest = Math.min(...[1, 2, 3].map(() => timed(() => askAll(lines, openers, makeConsumedCloserLine)).ms)); // a pause in one of three runs must not fail the row
    expect(slow.result).toEqual(askAll(lines, openers, makeConsumedCloserLine));
    expect(slow.ms).toBeGreaterThan(fastest * 20 + 50);
  }, HEAVY_ROW_MS);
});
