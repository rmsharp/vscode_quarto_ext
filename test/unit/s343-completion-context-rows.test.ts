import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cursorLineAt } from "../../src/core/cursor-line";
import { findCellOptionLines } from "../../src/core/qmd/model";
import { completionContextAt } from "../../src/core/yaml-context";
import { clockBreaks as ratioBreaks, ratioOfWindows, type Windows } from "./support/ratio-windows";
import { everyString, seededRandom } from "./support/regex-equivalence";

// Session 343 -- part (3) of the BACKLOG item "What Session 342's review round found beside the typing-path cures", SIB-02. `completionContextAt(text, offset, documentEngine)` (src/core/yaml-context.ts) is the first thing the YAML
// completion provider asks on EVERY completion request, before it knows whether the cursor is in YAML at all. It counted the line of the offset (a walk over the text up to the offset), then took that line's text with
// `text.split(/\r?\n/)[line]`: a split of the WHOLE document for one line, on a prose line too, where the answer is `null`. Measured at the parent, a fresh process each, a warm scan, a prose line in the second half of the
// document, load 4 to 15, 500 / 2,000 / 8,000 cells of 27 lines: the split alone 0.29 / 1.2 / 5 to 7 ms, `findCellOptionLines` (flat-mapped over every cell on every call: cured by the memo of the first commit of this part) 1.0 / 2.7 / 11.7 ms,
// the whole call 2.8 / 5.1 / 27 ms.
//
// `cursorLineAt(text, offset)` (src/core/cursor-line.ts) answers the line, the column and the line's text from the walk alone: the text of the line is read between the line breaks that surround the offset, never from a split.
//
// This file holds the ANSWER rows (they pass on the old spelling, which is kept verbatim as `oldCursorLine` and compared with `cursorLineAt` on named cases, on EVERY string of up to six characters over { a | # CR LF space } with
// every integer offset and the other values a number can hold, and on 20,000 seeded documents), the WHOLE-FUNCTION rows (a digest of `completionContextAt` over every offset of three documents, taken from the parent's code, and the same
// document read with LF and with CRLF), the COUNT rows (how many times the document's own text is split during one warm call: a clock-free form of the claim) and the CLOCK rows.
//
// THE CLOCK ROWS. Each is a RATIO against a baseline measured in the same process (Learning 919), one split of the whole text, which is the work the cure removes: the ratio of a warm `completionContextAt` call on a prose line
// (and on a `#|` line) near the top of a 2,000-cell document to one `text.split(/\r?\n/)` of that document, read round after round, the median round deciding (`test/unit/support/ratio-windows.ts`; the helper's own rows are in
// `s343-cell-option-lines-rows.test.ts`: Learning 910). Measured at load 4 to 9 in vitest: at the seam (the old spelling behind `cursorLineAt`, after the memo of the option lines) the ratio is about 1.0 to 1.1 (a split and the
// scan of the 4,000 option lines for the line), at the cure about 0.04 to 0.06; the limit is 0.3, 3 times under the seam's figure and 5 times over the cure's.
//
// ⚠ SHAPES TOO CLOSE TO CARRY A CLOCK, so they are answer and count rows only. A cursor in the MIDDLE or at the END of the document: the cure still walks the text up to the offset (about 0.3 ms at 2,000 cells for the
// whole text, an eighth to a quarter of a split), so the cure's ratio is 0.15 to 0.3 against the seam's 1.6 to 2.0, a margin under 2 times from the limit that would separate them. A document of 500 cells or fewer: a split is
// 0.3 ms, a quarter of a millisecond is inside the timer's noise under load. A cursor in the FRONT MATTER: `frontMatterContextAt` makes its own split for the ancestor walk of a nested key, which this cure leaves alone.

/** The OLD spelling, verbatim: the walk of `lineColAt` and a split of the whole text for one line. */
function oldCursorLine(text: string, offset: number): { line: number; col: number; lineText: string } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  const col = clamped - lineStart;
  return { line, col, lineText: text.split(/\r?\n/)[line] ?? "" };
}

/** The two answers are the same: the same line, the same column (a `NaN` and a `-0` are what they are: `Object.is`), the same text. */
const sameCursorLine = (a: { line: number; col: number; lineText: string }, b: { line: number; col: number; lineText: string }): boolean =>
  Object.is(a.line, b.line) && Object.is(a.col, b.col) && a.lineText === b.lineText;

const CR = "\r";
const LF = "\n";

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE NAMED CASES. The expected line, column and text are written by hand from the line-break rule (`\n` counts; a `\r` before a `\n` is part of the break and not of the text; a lone `\r` is text), not read off the oracle.

interface Named {
  name: string;
  text: string;
  offset: number;
  line: number;
  col: number;
  lineText: string;
}

const NAMED: Named[] = [
  { name: "LF: the second line, one character in", text: "ab\ncd\nef", offset: 4, line: 1, col: 1, lineText: "cd" },
  { name: "LF: the last line, which no break ends", text: "ab\ncd\nef", offset: 8, line: 2, col: 2, lineText: "ef" },
  { name: "LF: an offset on the break itself is the end of its own line", text: "ab\ncd\nef", offset: 2, line: 0, col: 2, lineText: "ab" },
  { name: "LF: an offset just past the break is the start of the next line", text: "ab\ncd\nef", offset: 3, line: 1, col: 0, lineText: "cd" },
  { name: "CRLF: the second line, one character in (the CR is no part of the text)", text: "ab\r\ncd\r\nef", offset: 5, line: 1, col: 1, lineText: "cd" },
  { name: "CRLF: an offset on the CR is column 2 of a line whose text is two characters", text: "ab\r\ncd\r\nef", offset: 2, line: 0, col: 2, lineText: "ab" },
  { name: "CRLF: an offset between the CR and the LF is column 3 of the same line", text: "ab\r\ncd\r\nef", offset: 3, line: 0, col: 3, lineText: "ab" },
  { name: "CRLF: the last line", text: "ab\r\ncd\r\nef", offset: 10, line: 2, col: 2, lineText: "ef" },
  { name: "lone CR: a CR is text, and the line goes on past it", text: "ab\rcd\nef", offset: 4, line: 0, col: 4, lineText: "ab\rcd" },
  { name: "lone CR: the next line after it", text: "ab\rcd\nef", offset: 7, line: 1, col: 1, lineText: "ef" },
  { name: "two CRs before an LF: the first is text, the second belongs to the break", text: "a\r\r\nb", offset: 1, line: 0, col: 1, lineText: "a\r" },
  { name: "a CR at the very end of the text, no LF after it: it is text", text: "a\r", offset: 2, line: 0, col: 2, lineText: "a\r" },
  { name: "a text that ends with a newline: the empty line after it", text: "ab\n", offset: 3, line: 1, col: 0, lineText: "" },
  { name: "a text that ends with a CRLF: the empty line after it", text: "ab\r\n", offset: 4, line: 1, col: 0, lineText: "" },
  { name: "a text that ends with a newline, an offset before it", text: "ab\n", offset: 2, line: 0, col: 2, lineText: "ab" },
  { name: "only line breaks: the empty second line", text: "\n\n", offset: 1, line: 1, col: 0, lineText: "" },
  { name: "only line breaks: the empty third line", text: "\n\n", offset: 2, line: 2, col: 0, lineText: "" },
  { name: "only CRLFs: the empty second line", text: "\r\n\r\n", offset: 2, line: 1, col: 0, lineText: "" },
  { name: "an empty text, offset 0", text: "", offset: 0, line: 0, col: 0, lineText: "" },
  { name: "an empty text, an offset past the end", text: "", offset: 5, line: 0, col: 0, lineText: "" },
  { name: "an empty text, an offset below 0", text: "", offset: -3, line: 0, col: 0, lineText: "" },
  { name: "an offset below 0 is the start of the first line", text: "ab\ncd", offset: -7, line: 0, col: 0, lineText: "ab" },
  { name: "an offset past the end is the end of the last line", text: "ab\ncd", offset: 99, line: 1, col: 2, lineText: "cd" },
  { name: "NaN is the start of line 0 with a column of NaN, and the text of line 0", text: "ab\ncd", offset: NaN, line: 0, col: NaN, lineText: "ab" },
  { name: "+Infinity is the end of the last line", text: "ab\ncd", offset: Infinity, line: 1, col: 2, lineText: "cd" },
  { name: "-Infinity is the start of the first line", text: "ab\ncd", offset: -Infinity, line: 0, col: 0, lineText: "ab" },
  { name: "-0 is the start of the first line, with a column of 0", text: "ab\ncd", offset: -0, line: 0, col: 0, lineText: "ab" },
  { name: "a fraction before a break: the first line, a fractional column", text: "ab\ncd", offset: 1.5, line: 0, col: 1.5, lineText: "ab" },
  { name: "a fraction past a break (the break at index 2 is below 2.5): the second line, a column of -0.5", text: "ab\ncd", offset: 2.5, line: 1, col: -0.5, lineText: "cd" },
  { name: "a fraction past the end is the end", text: "ab\ncd", offset: 5.5, line: 1, col: 2, lineText: "cd" },
  { name: "2^53 is past the end", text: "ab\ncd", offset: 2 ** 53, line: 1, col: 2, lineText: "cd" },
  { name: "-(2^53) is the start", text: "ab\ncd", offset: -(2 ** 53), line: 0, col: 0, lineText: "ab" },
];

describe("Session 343 -- cursorLineAt answers what the old walk and split answered: the named cases", () => {
  it.each(NAMED.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const expected = { line: c.line, col: c.col, lineText: c.lineText };
    expect(sameCursorLine(oldCursorLine(c.text, c.offset), expected), "the oracle agrees with the hand-written answer").toBe(true);
    const got = cursorLineAt(c.text, c.offset);
    expect(got, JSON.stringify(c)).toEqual(expected);
    expect(sameCursorLine(got, expected), JSON.stringify(c)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE ENUMERATION AND THE SEEDED DOCUMENTS. Every string of up to six characters over the six that matter (a letter, the two a option line starts with, both line-break characters, a blank), every integer offset from one
// below the start to one past the end, and the values a number can hold that are no integer in range: NaN, both infinities, -0, a fraction at each end and between, 2^53.

const ALPHABET = ["a", "|", "#", CR, LF, " "];
const MAX_LENGTH = 6;

/** The offsets asked of a text of `length` characters: every integer from -1 to length + 1, and the awkward numbers. */
function offsetsFor(length: number): number[] {
  const offsets: number[] = [];
  for (let i = -1; i <= length + 1; i++) offsets.push(i);
  offsets.push(NaN, Infinity, -Infinity, -0, 0.5, length - 0.5, length + 0.5, length / 2 + 0.25, 2 ** 53, -(2 ** 53), Number.MIN_VALUE, -Number.MIN_VALUE);
  return offsets;
}

describe("Session 343 -- cursorLineAt answers what the old walk and split answered: every string, every offset", () => {
  it(`every string of up to ${MAX_LENGTH} characters over { a | # CR LF space } (55,987 of them) with every integer offset from -1 to one past the end and the awkward numbers`, () => {
    let strings = 0;
    let compared = 0;
    const disagreements: string[] = [];
    for (const text of everyString(ALPHABET, MAX_LENGTH)) {
      strings++;
      for (const offset of offsetsFor(text.length)) {
        compared++;
        const got = cursorLineAt(text, offset);
        if (!sameCursorLine(got, oldCursorLine(text, offset)) && disagreements.length < 5) disagreements.push(JSON.stringify({ text, offset, got }));
      }
    }
    expect(disagreements).toEqual([]);
    expect(strings).toBe(55_987);
    expect(compared).toBeGreaterThan(55_987 * 12);
  });

  it("20,000 seeded documents of up to 400 characters built from line breaks of every kind, fence and option lines, blanks and prose, each asked at random offsets of every kind", () => {
    const PIECES = [CR, LF, CR + LF, CR + LF, LF, LF, " ", "a", "ab", "prose line", "|", "#", "#| echo: false", "```{python}", "```", "---", "title: t", "\t", "é", " ", "\u{1F600}"];
    const rand = seededRandom(343_002);
    let compared = 0;
    let withCr = 0;
    let withLoneCr = 0;
    const disagreements: string[] = [];
    for (let d = 0; d < 20_000; d++) {
      let text = "";
      for (const target = Math.floor(rand() * 400); text.length < target; ) text += PIECES[Math.floor(rand() * PIECES.length)];
      if (text.includes(CR)) withCr++;
      if (/\r(?!\n)/.test(text)) withLoneCr++;
      const asks: number[] = [Math.floor(rand() * (text.length + 3)) - 1, Math.floor(rand() * (text.length + 1)), text.length, 0, Math.floor(rand() * 10_000) - 5000, Math.floor(rand() * (text.length + 1)) + 0.5];
      if (rand() < 0.25) asks.push(NaN, Infinity, -Infinity, -0);
      for (const offset of asks) {
        compared++;
        const got = cursorLineAt(text, offset);
        if (!sameCursorLine(got, oldCursorLine(text, offset)) && disagreements.length < 5) disagreements.push(JSON.stringify({ text, offset, got }));
      }
    }
    expect(disagreements).toEqual([]);
    // the draw reached the shapes: a CR in most documents, a lone CR in many, and more than 120,000 asks
    expect(withCr).toBeGreaterThan(10_000);
    expect(withLoneCr).toBeGreaterThan(5000);
    expect(compared).toBeGreaterThan(120_000);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE WHOLE FUNCTION. `completionContextAt` through its public entry. The digests were taken from the parent's code (the base of Session 343, the walk and the split inside, the option lines flat-mapped on every call) over
// every offset of each document and the awkward ones, the engine thunk answering `jupyter`; they pass at the seam and must pass at the cure. The documents hold front-matter keys and values, a nested front-matter key, a prose
// line, four cells with option lines of `#`, `//` and a bare `#|` line, and (D2) the same with CRLF and (D3) lone CRs inside lines.

const D1 = [
  "---", "title: t", "format:", "  html:", "    toc: true", "    theme: ", "execute:", "  echo: false", "---", "", "Prose with @fig-a here.", "", "```{python}", "#| echo: false", "#| fig-cap: \"a cap\"", "#| label", "x = 1", "```", "",
  "```{ojs}", "//| echo: true", "y = 2", "```", "", "```{r}", "#|", "z <- 3", "```", "",
].join(LF);
const D2 = D1.split(LF).join(CR + LF);
const D3 = ["---\rtitle: t\rformat: html", "---", "", "```{python}", "#| echo:\r false", "#| eval: true\r", "x = 1\r", "```", "last\rline"].join(LF);

/** One digest of a document: the context at every offset from -1 to one past the end and at NaN and both infinities, how many were not null and of which kind. */
function digestOf(text: string): { digest: string; offsets: number; nonNull: number; kinds: Record<string, number> } {
  const offsets = [-1, ...Array.from({ length: text.length + 2 }, (_, i) => i), NaN, Infinity, -Infinity];
  const hash = createHash("sha1");
  const kinds: Record<string, number> = {};
  let nonNull = 0;
  for (const offset of offsets) {
    const context = completionContextAt(text, offset, () => "jupyter");
    hash.update(`${offset}=${JSON.stringify(context)};`);
    if (context !== null) {
      nonNull++;
      kinds[context.kind] = (kinds[context.kind] ?? 0) + 1;
    }
  }
  return { digest: hash.digest("hex"), offsets: offsets.length, nonNull, kinds };
}

describe("Session 343 -- completionContextAt answers at every offset what the parent answered", () => {
  it("D1, LF: 237 offsets, 102 of them completable (41 front-matter keys, 17 front-matter values, 25 option keys, 19 option values), the digest of the parent", () => {
    expect(digestOf(D1)).toEqual({
      digest: "ca10336dca694e47035f27ca9593536f8da02b78",
      offsets: 237,
      nonNull: 102,
      kinds: { "frontmatter-key": 41, "frontmatter-value": 17, "cell-option-key": 25, "cell-option-value": 19 },
    });
  });

  it("D2, the same document with CRLF: 265 offsets, the same 102 completable, the digest of the parent", () => {
    expect(digestOf(D2)).toEqual({
      digest: "78eede00b7da0cf9f481cae61de1ab165e2b7112",
      offsets: 265,
      nonNull: 102,
      kinds: { "frontmatter-key": 41, "frontmatter-value": 17, "cell-option-key": 25, "cell-option-value": 19 },
    });
  });

  it("D3, lone CRs inside lines (they are text): 100 offsets, 10 completable (5 option keys, 5 option values), the digest of the parent", () => {
    expect(digestOf(D3)).toEqual({
      digest: "8996783447f572c0d4a6f7502650663d87714335",
      offsets: 100,
      nonNull: 10,
      kinds: { "cell-option-key": 5, "cell-option-value": 5 },
    });
  });

  it("a document read with CRLF answers what the same document read with LF answers, at the offset that is the same place (the line, the token and the range do not move)", () => {
    const lfOffsetToCrlf = (offset: number): number => offset + (D1.slice(0, offset).split(LF).length - 1);
    let compared = 0;
    for (let offset = 0; offset <= D1.length; offset++) {
      const lf = completionContextAt(D1, offset, () => "jupyter");
      const crlf = completionContextAt(D2, lfOffsetToCrlf(offset), () => "jupyter");
      expect(crlf, `offset ${offset}`).toEqual(lf);
      compared++;
    }
    expect(compared).toBe(D1.length + 1);
  });

  it("a prose line is null and a `#|` line is the key or the value, whatever the line breaks of the document", () => {
    const prose = D1.indexOf("Prose with") + 5;
    const option = D1.indexOf("#| echo: false") + "#| echo".length; // the end of the key
    for (const doc of [D1, D2]) {
      const shift = doc === D1 ? 0 : D1.slice(0, prose).split(LF).length - 1;
      expect(completionContextAt(doc, prose + shift, () => undefined)).toBeNull();
      const optionShift = doc === D1 ? 0 : D1.slice(0, option).split(LF).length - 1;
      const context = completionContextAt(doc, option + optionShift, () => undefined);
      expect(context?.kind).toBe("cell-option-key");
      expect(context?.token).toBe("echo");
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNT. How many times the document's own text is split while one warm `completionContextAt` call runs: the old spelling split it once for the line, on a prose line too. A split of ANOTHER string (a slice, a line) is not
// counted, so this sees the whole-document split and nothing smaller.

/** How many times `String.prototype.split` is called with `target` itself as its receiver while `run` runs. */
function countSplitsOf(target: string, run: () => void): number {
  const original = String.prototype.split;
  let count = 0;
  String.prototype.split = function (this: string, ...args: unknown[]): string[] {
    if (typeof this === "string" && this === target) count++;
    return (original as (...a: unknown[]) => string[]).apply(this, args);
  } as typeof String.prototype.split;
  try {
    run();
  } finally {
    String.prototype.split = original;
  }
  return count;
}

/** A document of `cells` cells of 27 lines: a heading, prose with a reference, and a python cell of two option lines and 16 code lines (the shape of the timing probes of Session 343). */
function documentOf(cells: number): string {
  const out: string[] = ["---", "title: t", "format: html", "---", ""];
  for (let i = 0; i < cells; i++) {
    out.push(`## Section ${i}`, "", `Prose with @fig-${i} reference and more words here.`, "", "```{python}", `#| label: fig-${i}`, "#| echo: false");
    for (let j = 0; j < 16; j++) out.push(`x${j} = ${j} + ${i}`);
    out.push("```", "");
  }
  return out.join(LF);
}

describe("Session 343 -- a warm completionContextAt call splits the document no time at all", () => {
  const text = documentOf(60);
  const prose = text.indexOf("Prose with @fig-30") + 5;
  const keyEnd = text.indexOf("#| label: fig-30") + "#| label".length;
  const valueEnd = text.indexOf("#| label: fig-30") + "#| label: fig-30".length;
  /** The scan and the option lines of `text`, made: a scan splits the text itself, and is not what is being counted. Every row calls it first, for the cache holds two scans and the rows before it have used it. */
  const warm = (): void => void findCellOptionLines(text);

  it("the counter counts a split of the text and not a split of another string", () => {
    expect(countSplitsOf(text, () => void text.split(/\r?\n/))).toBe(1);
    expect(countSplitsOf(text, () => void text.split(/\r?\n/).length)).toBe(1);
    expect(countSplitsOf(text, () => void "other text".split("t"))).toBe(0);
    expect(countSplitsOf(text, () => void text.slice(1).split("\n"))).toBe(0);
    expect(countSplitsOf(text, () => void 0)).toBe(0);
  });

  it("a prose line (the answer is null): no split of the text", () => {
    warm();
    let answer: unknown = "unset";
    expect(countSplitsOf(text, () => void (answer = completionContextAt(text, prose, () => undefined)))).toBe(0);
    expect(answer).toBeNull();
  });

  it("the key slot of an option line: no split of the text, and the key context", () => {
    warm();
    const answer: { value: ReturnType<typeof completionContextAt> } = { value: null };
    expect(countSplitsOf(text, () => void (answer.value = completionContextAt(text, keyEnd, () => undefined)))).toBe(0);
    expect(answer.value?.kind).toBe("cell-option-key");
    expect(answer.value?.token).toBe("label");
  });

  it("the value slot of an option line: no split of the text, and the value context", () => {
    warm();
    const answer: { value: ReturnType<typeof completionContextAt> } = { value: null };
    expect(countSplitsOf(text, () => void (answer.value = completionContextAt(text, valueEnd, () => undefined)))).toBe(0);
    expect(answer.value?.kind).toBe("cell-option-value");
    expect(answer.value?.token).toBe("fig-30");
  });

  it("the whole of the cursor line's work, cursorLineAt alone: no split of the text", () => {
    warm();
    expect(countSplitsOf(text, () => void cursorLineAt(text, prose))).toBe(0);
    expect(countSplitsOf(text, () => void cursorLineAt(text, text.length))).toBe(0);
    expect(countSplitsOf(text, () => void cursorLineAt(text, NaN))).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK ROWS, through the public entry, as a ratio of one whole-text split (see the header for the figures and for the shapes too close to carry one).

const CELLS = 2000;
const RATIO_LIMIT = 0.3;
const clockBreaks = (run: Windows): string[] => ratioBreaks(run, RATIO_LIMIT, "a warm completionContextAt call over one split of the whole text");

describe(`Session 343 -- a warm completionContextAt call near the top of a ${CELLS.toLocaleString("en-US")}-cell document costs a fraction of one split of its text (load 4 to 15)`, () => {
  const text = documentOf(CELLS);
  const prose = text.indexOf("Prose with") + 5;
  const option = text.indexOf("#| label: fig-0") + "#| label".length;

  it(`a prose line (line 7): the answer is null, and a call costs under ${RATIO_LIMIT} of a split`, () => {
    expect(completionContextAt(text, prose, () => undefined)).toBeNull(); // the scan and the option lines are warm after this call
    const run = ratioOfWindows(() => void completionContextAt(text, prose, () => undefined), 20, () => void text.split(/\r?\n/), 20, 7);
    expect(clockBreaks(run), JSON.stringify(run)).toEqual([]);
  });

  it(`a #| line (line 11): the key context, and a call costs under ${RATIO_LIMIT} of a split`, () => {
    expect(completionContextAt(text, option, () => undefined)?.kind).toBe("cell-option-key");
    const run = ratioOfWindows(() => void completionContextAt(text, option, () => undefined), 20, () => void text.split(/\r?\n/), 20, 7);
    expect(clockBreaks(run), JSON.stringify(run)).toEqual([]);
  });
});
