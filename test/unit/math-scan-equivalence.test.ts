import { describe, expect, it } from "vitest";
import { findMathRegions, scanMathRegions, type MathRegion } from "../../src/core/math-regions";
import { findBodyLines, maskInlineCode, type BodyLine } from "../../src/core/qmd/model";
import { BOM, LS, NBSP, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 327 — the `$` half of part (6) of the BACKLOG item "What is still quadratic or deep enough to overflow after Session 311". `scan` found the closer of every inline opener by reading on from it to the end of the line, so a line of N
// unclosed `$` was N reads of the same tail. It now keeps the first closer-shaped `$` at or after the last opener and asks again only once that `$` is behind the next opener. That is only sound if the answer is the SAME on EVERY text, so the
// functions it replaced are kept below, copied from the parent `72d4a9c` (Session 326's source, before the cure) by a script, renamed with a prefix `old` (every body is the parent's, character for character; the one `export` of `findMathRegions` is dropped), as the oracle (Learning 738).

// ---- The OLD functions, copied from the parent `72d4a9c` by a script; only the names changed (a prefix `old`). ----
/** Find every inline `$…$` and display `$$…$$` math region, in document order. */
function oldFindMathRegions(text: string): MathRegion[] {
  const out: MathRegion[] = [];
  // Scan each maximal run of consecutive body lines on its own. Joining only
  // consecutive lines keeps the synthetic `\n` offsets aligned with real line
  // numbers, and a skip-region (front matter / comment / fence) between two runs
  // is a hard boundary — display math cannot span it.
  for (const run of oldContiguousRuns(findBodyLines(text))) {
    const source = run.map((b) => b.text).join("\n");
    // Detect delimiters on a copy with inline code spans masked out (a `$x$`
    // shown inside `` `…` `` is literal code, not math). Masking is
    // length-preserving, so offsets into `masked` index `source` 1:1 — region
    // content is sliced from `source` to preserve any real backticks in math.
    const masked = run.map((b) => maskInlineCode(b.text)).join("\n");
    oldScan(masked, source, run[0].line, out);
  }
  return out;
}

/** Split body lines into maximal runs of consecutive 0-based line numbers. */
function oldContiguousRuns(body: BodyLine[]): BodyLine[][] {
  const runs: BodyLine[][] = [];
  for (const b of body) {
    const last = runs[runs.length - 1];
    if (last && b.line === last[last.length - 1].line + 1) {
      last.push(b);
    } else {
      runs.push([b]);
    }
  }
  return runs;
}

/**
 * Scan `detect` (whose first line is document line `baseLine`) for math regions,
 * appending each to `out`. `detect` has inline code spans masked; `source` is
 * the unmasked text the same length, from which region content is sliced. A
 * `$$` always opens display math (it wins over inline); a lone `$` opens inline
 * math that closes at the next `$` on the line.
 */
function oldScan(
  detect: string,
  source: string,
  baseLine: number,
  out: MathRegion[],
): void {
  const s = detect;
  const charLine = oldBuildCharLine(s, baseLine);
  let p = 0;
  while (p < s.length) {
    if (s[p] === "$" && !oldIsEscaped(s, p)) {
      if (s[p + 1] === "$") {
        const q = oldFindDisplayClose(s, p + 2);
        if (q === -1) {
          break; // unterminated display — the rest is inside open math
        }
        out.push({
          type: "display",
          content: source.slice(p + 2, q),
          startLine: charLine[p],
          endLine: charLine[q],
        });
        p = q + 2;
        continue;
      }
      // Inline opener: the character to its right must be a non-space.
      if (p + 1 < s.length && !oldIsSpace(s[p + 1])) {
        const q = oldFindInlineClose(s, p + 1, charLine[p], charLine);
        if (q !== -1) {
          out.push({
            type: "inline",
            content: source.slice(p + 1, q),
            startLine: charLine[p],
            endLine: charLine[p],
          });
          p = q + 1;
          continue;
        }
      }
    }
    p++;
  }
}

/**
 * Index of the first `$` of the next (unescaped) `$$`, scanning from `from`;
 * -1 if none.
 */
function oldFindDisplayClose(s: string, from: number): number {
  for (let k = from; k < s.length - 1; k++) {
    if (s[k] === "$" && s[k + 1] === "$" && !oldIsEscaped(s, k)) {
      return k;
    }
  }
  return -1;
}

/**
 * Index of the closing `$` of an inline region opened just before `from`, or
 * -1. Following Pandoc's `tex_math_dollars`, the closer must (a) be on the same
 * line (`openLine`) as the opener, (b) not be backslash-escaped, (c) have a
 * non-space immediately to its left, and (d) not be immediately followed by a
 * digit (so `$20 and $30` is not math).
 */
function oldFindInlineClose(
  s: string,
  from: number,
  openLine: number,
  charLine: number[],
): number {
  for (let k = from; k < s.length; k++) {
    if (charLine[k] !== openLine) {
      return -1; // inline math does not span lines
    }
    if (s[k] !== "$" || oldIsEscaped(s, k)) {
      continue;
    }
    const precededByNonSpace = k > from && !oldIsSpace(s[k - 1]);
    const followedByDigit = k + 1 < s.length && oldIsDigit(s[k + 1]);
    if (precededByNonSpace && !followedByDigit) {
      return k;
    }
  }
  return -1;
}

/** True if the character at `i` is preceded by an odd run of backslashes. */
function oldIsEscaped(s: string, i: number): boolean {
  let n = 0;
  for (let k = i - 1; k >= 0 && s[k] === "\\"; k--) {
    n++;
  }
  return n % 2 === 1;
}

function oldIsSpace(ch: string): boolean {
  return /\s/.test(ch);
}

function oldIsDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/** Map each character index of `s` to its 0-based document line number. */
function oldBuildCharLine(s: string, baseLine: number): number[] {
  const charLine = new Array<number>(s.length + 1);
  let line = baseLine;
  for (let k = 0; k < s.length; k++) {
    charLine[k] = line;
    if (s[k] === "\n") {
      line++;
    }
  }
  charLine[s.length] = line;
  return charLine;
}
// ---- end of the copy ----

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

/** The document line the first line of a scanned text is on: not 0, so a region's lines that ignore it are a disagreement. */
const BASE_LINE = 7;
const REGION_KEYS = (regions: MathRegion[]): string => regions.map((region) => `${region.type}:${region.startLine}:${region.endLine}:${region.content}`).join("|");
/** The text the regions' content is read from: as long as the text the delimiters are found in and different wherever that holds an `a`, so a content read from the wrong one is a disagreement. */
const sourceOf = (text: string): string => text.replace(/a/g, "b");

function oldRegions(text: string): MathRegion[] {
  const out: MathRegion[] = [];
  oldScan(text, sourceOf(text), BASE_LINE, out);
  return out;
}

function newRegions(text: string): MathRegion[] {
  const out: MathRegion[] = [];
  scanMathRegions(text, sourceOf(text), BASE_LINE, out);
  return out;
}

/** The first `$` at or after `from` that is closer-shaped, by this test's own statement of the rule (the old helpers, never the code under test); -1 if none. */
function firstCloserShaped(text: string, from: number): number {
  for (let k = Math.max(from, 1); k < text.length; k++) {
    if (text[k] === "$" && !oldIsEscaped(text, k) && !oldIsSpace(text[k - 1]) && !(k + 1 < text.length && oldIsDigit(text[k + 1]))) {
      return k;
    }
  }
  return -1;
}

/**
 * What the OLD walk did at each inline opener, taken from the old helpers alone (so it does not depend on the code under test): how many closer searches it made, how many of those came AFTER a search that found no closer on its line
 * (the new function answers them from the position it kept), and how many failed searches had a closer-shaped `$` on a LATER line (the position it kept is not on the opener's line).
 */
function traceSearches(text: string): { searches: number; afterFailure: number; closerOnLaterLine: number } {
  const charLine = oldBuildCharLine(text, BASE_LINE);
  let searches = 0;
  let afterFailure = 0;
  let closerOnLaterLine = 0;
  let failed = false;
  let p = 0;
  while (p < text.length) {
    if (text[p] === "$" && !oldIsEscaped(text, p)) {
      if (text[p + 1] === "$") {
        const q = oldFindDisplayClose(text, p + 2);
        if (q === -1) {
          break;
        }
        p = q + 2;
        continue;
      }
      if (p + 1 < text.length && !oldIsSpace(text[p + 1])) {
        const q = oldFindInlineClose(text, p + 1, charLine[p], charLine);
        searches++;
        if (failed) {
          afterFailure++;
        }
        if (q === -1) {
          failed = true;
          if (firstCloserShaped(text, p + 1) !== -1) {
            closerOnLaterLine++;
          }
        } else {
          p = q + 1;
          continue;
        }
      }
    }
    p++;
  }
  return { searches, afterFailure, closerOnLaterLine };
}

type Tally = { compared: number; inline: number; display: number; afterFailure: number; closerOnLaterLine: number };

/**
 * Both functions on every string: how many were compared, on how many the OLD one finds an inline region and a display region, on how many a closer search follows a failed one and on how many a failed search had its closer on a later line,
 * and the first few disagreements. `candidate` is the function under test; the self-test below hands it a wrong one to show that the comparator can report a disagreement.
 */
function compareScans(strings: Iterable<string>, candidate: (text: string) => MathRegion[] = newRegions): Tally & { disagreements: string[] } {
  const tally: Tally = { compared: 0, inline: 0, display: 0, afterFailure: 0, closerOnLaterLine: 0 };
  const disagreements: string[] = [];
  for (const text of strings) {
    const expected = oldRegions(text);
    tally.compared++;
    if (expected.some((region) => region.type === "inline")) {
      tally.inline++;
    }
    if (expected.some((region) => region.type === "display")) {
      tally.display++;
    }
    const trace = traceSearches(text);
    if (trace.afterFailure > 0) {
      tally.afterFailure++;
    }
    if (trace.closerOnLaterLine > 0) {
      tally.closerOnLaterLine++;
    }
    if (REGION_KEYS(candidate(text)) !== REGION_KEYS(expected) && disagreements.length < 5) {
      disagreements.push(JSON.stringify(text));
    }
  }
  return { ...tally, disagreements };
}

// The alphabets are the characters the scan reacts to: `$` (opens and closes), a backslash (escapes), a blank (refuses an opener's right and a closer's left), a digit (refuses a closer's right), a line break (ends a line, and is a blank) and a neutral letter.
const ALPHABET_SIX = ["$", "a", " ", "\\", "1", "\n"];
const ALPHABET_FIVE = ["$", "a", " ", "\\", "1"];
const ALPHABET_FOUR = ["$", "a", " ", "\n"];
// Characters beyond the ones the alphabets above hold, named by code point so that no editor or tool rewrites them: blanks \s holds and a hand-made set leaves out, and digits that are not 0 to 9.
const IDEOGRAPHIC_SPACE = String.fromCodePoint(0x3000);
const EM_SPACE = String.fromCodePoint(0x2003);
const ARABIC_INDIC_THREE = String.fromCodePoint(0x663);
const FULLWIDTH_ZERO = String.fromCodePoint(0xff10);
const SEEDED_STRINGS = 300_000;
const SEEDED_DOCUMENTS = 20_000;
/** The heavy rows take seconds warm: vitest's default of 5 s would let a loaded machine, or a mutant that is merely slow, fail them by the clock instead of by an answer. */
const HEAVY_ROW_MS = 120_000;
/** Per set: how many strings the OLD function finds an inline region on, a display region on, how many hold a closer search after an EARLIER failed one (the new function answers it from the position it kept, or searches again because that position is behind the opener), and how many hold a failed search whose closer is on a later line, so a comparison cannot pass by both finding nothing. */
const COUNTS = {
  six: "inline 145760, display 13249, after a failed search 52525, closer on a later line 24049",
  five: "inline 414730, display 38350, after a failed search 106088, closer on a later line 0",
  four: "inline 735751, display 408498, after a failed search 160731, closer on a later line 258940",
  grid: "inline 6598, display 0, after a failed search 9120, closer on a later line 4550",
  seeded: "inline 190661, display 150811, after a failed search 75888, closer on a later line 81474",
};
const countsOf = (result: Tally): string => `inline ${result.inline}, display ${result.display}, after a failed search ${result.afterFailure}, closer on a later line ${result.closerOnLaterLine}`;
/** How many of the 20,000 seeded documents hold a region (the OLD pipeline's answer), so a comparison cannot pass by both finding nothing. The old pipeline calls the live `findBodyLines` and `maskInlineCode`, so a change to what the model counts as a body line moves this number: re-count it with the old pipeline, never to match the new one. */
const DOCUMENT_REGIONS = 13721;

describe("Session 327 — the math scan answers what the function that reread the line for each unclosed `$` answered", () => {
  it.each([
    ["nothing", "", []],
    ["a lone opener", "$", []],
    ["an opener with nothing to its right", "a $", []],
    ["a plain inline region", "$a$", [["inline", "a", 0, 0]]],
    ["a closer that follows a blank closes nothing", "$a $", []],
    ["a closer followed by a digit closes nothing", "$a$1", []],
    ["an escaped closer closes nothing", "$a\\$", []],
    ["an escaped opener opens nothing", "\\$a$", []],
    ["the first opener takes the first closer, even one that belongs to a later pair", "$a $b$", [["inline", "a $b", 0, 0]]],
    ["a closer on the next line closes nothing", "$a\nb$", []],
    ["a region on the next line is found after a refused opener", "$a\n$b$", [["inline", "b", 1, 1]]],
    ["a double dollar after an unclosed opener closes it at the second `$`", "$a $$ b", [["inline", "a $", 0, 0]]],
    ["display math wins over inline", "$$a$$", [["display", "a", 0, 0]]],
    ["an unterminated display ends the scan", "$$a $b$", []],
    ["a display region, then two openers that never close", "$$a$$ $b $c", [["display", "a", 0, 0]]],
    ["a refused opener, a skipped line and a region two lines on", "$a $a\nx\n$b$", [["inline", "b", 2, 2]]],
  ] as Array<[string, string, Array<[string, string, number, number]>]>)("%s", (_title, text, regions) => {
    const expected = regions.map(([type, content, startLine, endLine]) => ({ type, content, startLine, endLine }));
    expect(oldFindMathRegions(text)).toEqual(expected);
    expect(findMathRegions(text)).toEqual(expected);
  });

  it("answers the same on every string of up to 8 characters over `$`, a letter, a blank, a backslash, a digit and a line break", () => {
    const result = compareScans(everyString(ALPHABET_SIX, 8));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(6, 8));
    expect(countsOf(result)).toEqual(COUNTS.six);
  }, HEAVY_ROW_MS);

  it("answers the same on every string of up to 9 characters over `$`, a letter, a blank, a backslash and a digit", () => {
    const result = compareScans(everyString(ALPHABET_FIVE, 9));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(5, 9));
    expect(countsOf(result)).toEqual(COUNTS.five);
  }, HEAVY_ROW_MS);

  it("answers the same on every string of up to 11 characters over `$`, a letter, a blank and a line break", () => {
    const result = compareScans(everyString(ALPHABET_FOUR, 11));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(4, 11));
    expect(countsOf(result)).toEqual(COUNTS.four);
  }, HEAVY_ROW_MS);

  it("answers the same on runs of unclosed openers, a middle and a closer-shaped tail in every place (a and c openers)", () => {
    const strings: string[] = [];
    for (const middle of ["", "\n", "b", "b\n", "\\", "1", " ", "\n\n"]) {
      for (const tail of ["", "$", "b$", "b$1", "$1", "\\$", " $", "b\\$", "$$", "b$$", "\nb$", "\n$b$"]) {
        for (let a = 0; a <= 10; a++) {
          for (let c = 0; c <= 10; c++) {
            strings.push(`${"$a ".repeat(a)}${middle}${tail}${"$a ".repeat(c)}`);
          }
        }
      }
    }
    const result = compareScans(strings);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(strings.length);
    expect(countsOf(result)).toEqual(COUNTS.grid);
  });

  it("answers the same on 300,000 seeded strings of up to 300 characters under five weightings, the last over characters the scan must ignore", () => {
    const random = seededRandom(327);
    const weightings = [
      ["$", "$", "$", "a", "a", " ", "1", "\\", "\n"],
      ["$", "a", " ", "\n"],
      ["$", "a", "a", "a", "a", "a", "1", "\\"],
      ["$", "$", "\\", "a", " "],
      ["$", "$", "$", "a", "b", " ", "\t", "\n", "\\", "1", "9", "`", "é", NBSP, LS, BOM, String.fromCodePoint(0x1f600), "(", ")"],
    ];
    const strings = (function* (): Generator<string> {
      for (let n = 0; n < SEEDED_STRINGS; n++) {
        const alphabet = weightings[n % weightings.length];
        const length = Math.floor(random() * random() * 300);
        let text = "";
        for (let k = 0; k < length; k++) {
          text += alphabet[Math.floor(random() * alphabet.length)];
        }
        yield text;
      }
    })();
    const result = compareScans(strings);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect(countsOf(result)).toEqual(COUNTS.seeded);
  }, HEAVY_ROW_MS);

  it("answers the same through the whole pipeline on 20,000 seeded documents (front matter, comments, cells, code spans, blank lines)", () => {
    const random = seededRandom(3270);
    const pool = [
      "$a$", "$$", "text $x $", "$a ", "```{python}", "x = '$a $a'", "```", "---", "title: $x", "<!-- $x$ -->", "", "`$x$` y", "\\$a\\$", "$ a", "$$ e $$", "$20 and $30", "- $a$", "> $a $b$", "$a $a $a", "$b$ then $c", "# Head $m$",
    ];
    let withRegions = 0;
    const disagreements: string[] = [];
    for (let n = 0; n < SEEDED_DOCUMENTS; n++) {
      const lines: string[] = [];
      const count = Math.floor(random() * 14);
      for (let k = 0; k < count; k++) {
        lines.push(pool[Math.floor(random() * pool.length)]);
      }
      const text = lines.join("\n");
      const expected = oldFindMathRegions(text);
      if (expected.length > 0) {
        withRegions++;
      }
      if (REGION_KEYS(findMathRegions(text)) !== REGION_KEYS(expected) && disagreements.length < 5) {
        disagreements.push(JSON.stringify(text));
      }
    }
    expect(disagreements).toEqual([]);
    expect(withRegions).toBe(DOCUMENT_REGIONS);
  }, HEAVY_ROW_MS);

  // Far from the start of the text. The guard rows of pathological-inputs.test.ts fail a cap on the search too (mutants L01 to L03 of s327-math-scan.json: caps of 1,024 and 4,096 characters fail the 21,334-opener guard, a cap of 65,536 fails the 70,000-character guard), so these are a second line
  // of defence for a cap or a window. A kept position held in 16 bits loops for ever and is recorded in the mutant list as ending on its timeout. These put a closer 70,000 and 200,000 characters after its opener, and an opener run, with its closer on
  // the next line, 70,000 and 200,000 characters into the text.
  it.each([70_000, 200_000])("closes a region whose closer is %i characters after its opener (the search has no reach limit)", (far) => {
    const text = `$a${"x".repeat(far)}b$`;
    expect(newRegions(text)).toEqual([{ type: "inline", content: `b${"x".repeat(far)}b`, startLine: BASE_LINE, endLine: BASE_LINE }]);
    expect(findMathRegions(text)).toEqual([{ type: "inline", content: `a${"x".repeat(far)}b`, startLine: 0, endLine: 0 }]);
  });

  it.each([70_000, 200_000])("finds a region on the next line when the unclosed openers before it begin %i characters into the text (the position kept is not held in 16 bits)", (far) => {
    const text = `${"x".repeat(far)}$a $a $a\n$b$`;
    expect(findMathRegions(text)).toEqual([{ type: "inline", content: "b", startLine: 1, endLine: 1 }]);
    expect(oldFindMathRegions(text)).toEqual([{ type: "inline", content: "b", startLine: 1, endLine: 1 }]);
  });

  // The characters the scan must treat as plain. A tab, a no-break space, U+2028 and a byte order mark are blanks to the `\s` test, a backtick, a bracket and an accented letter are not: these are the answers of the parent, stated.
  it.each([
    ["a tab to the right of an opener refuses it", "$\ta$", []],
    ["a no-break space to the right of an opener refuses it", `$${NBSP}a$`, []],
    ["U+2028 to the left of a closer refuses it", `$a${LS}$`, []],
    ["a byte order mark to the left of a closer refuses it", `$a${BOM}$`, []],
    ["a backtick to the left of a closer allows it", "$a`$", [["inline", "a`", 0, 0]]],
    ["an accented letter to the left of a closer allows it", "$aé$", [["inline", "aé", 0, 0]]],
    ["a digit to the left of a closer allows it", "$a1$", [["inline", "a1", 0, 0]]],
    ["a letter to the right of a closer allows it", "$a$b", [["inline", "a", 0, 0]]],
    // The edges of "a digit": 0 and 9 refuse a closer, the characters just outside the range (a slash before 0, a colon after 9) do not.
    ["a 0 to the right of a closer refuses it", "$a$0", []],
    ["a 9 to the right of a closer refuses it", "$a$9", []],
    ["a slash (one before 0) to the right of a closer allows it", "$a$/", [["inline", "a", 0, 0]]],
    ["a colon (one after 9) to the right of a closer allows it", "$a$:", [["inline", "a", 0, 0]]],
    // Session 327 review: the alphabets above hold a tab, a no-break space, U+2028 and a byte order mark but no carriage return, no other blank of \s and no digit but 0 to 9, so a blank test that is a hand-made set, one that leaves out a carriage return, and a digit
    // test that is any Unicode digit all passed. A carriage return is a blank, the ideographic and em spaces are blanks, and only 0 to 9 are digits.
    ["a carriage return to the right of an opener refuses it", "$\ra$", []],
    ["a carriage return to the left of a closer refuses it", "$a\r$", []],
    ["an ideographic space to the right of an opener refuses it", `$${IDEOGRAPHIC_SPACE}a$`, []],
    ["an em space to the left of a closer refuses it", `$a${EM_SPACE}$`, []],
    ["an Arabic-Indic digit to the right of a closer allows it", `$a$${ARABIC_INDIC_THREE}`, [["inline", "a", 0, 0]]],
    ["a fullwidth digit to the right of a closer allows it", `$a$${FULLWIDTH_ZERO}`, [["inline", "a", 0, 0]]],
  ] as Array<[string, string, Array<[string, string, number, number]>]>)("%s", (_title, text, regions) => {
    const expected = regions.map(([type, content, startLine, endLine]) => ({ type, content, startLine, endLine }));
    expect(oldFindMathRegions(text)).toEqual(expected);
    expect(findMathRegions(text)).toEqual(expected);
  });

  // The line of a region is read from a table with an entry for every character. A table of one or two bytes an entry reads line 300 as 44 and line 70,000 as 4,464; no other row asks for a region past line 255. The display region ends one line on.
  it.each([300, 70_000])("reports the line of a region that starts %i lines into the text (the line table holds a whole number an entry)", (lines) => {
    const inline = `${"x\n".repeat(lines)}$a$`;
    const display = `${"x\n".repeat(lines)}$$a\nb$$`;
    expect(findMathRegions(inline)).toEqual([{ type: "inline", content: "a", startLine: lines, endLine: lines }]);
    expect(oldFindMathRegions(inline)).toEqual([{ type: "inline", content: "a", startLine: lines, endLine: lines }]);
    expect(findMathRegions(display)).toEqual([{ type: "display", content: "a\nb", startLine: lines, endLine: lines + 1 }]);
    expect(oldFindMathRegions(display)).toEqual([{ type: "display", content: "a\nb", startLine: lines, endLine: lines + 1 }]);
  });

  // A run of backslashes escapes the `$` after it when it is ODD. The rows of pathological-inputs.test.ts have a run of 3 or of 64,000 (even); a test that reads only the last 64 or 1,024 backslashes gives the same answer on both and a wrong one on 65, 1,025
  // or 64,001. The parity is stated, not read off either function; the run is in front of an opener, of a closer and of the end of a display region.
  it.each([63, 64, 65, 66, 1_025, 1_026, 64_001])("reads the whole run of %i backslashes in front of a dollar (an odd run escapes it, an even run does not)", (n) => {
    const slashes = "\\".repeat(n);
    const even = n % 2 === 0;
    const cases: Array<[string, unknown]> = [
      [`${slashes}$a$`, even ? [{ type: "inline", content: "a", startLine: 0, endLine: 0 }] : []],
      [`$a${slashes}$`, even ? [{ type: "inline", content: `a${slashes}`, startLine: 0, endLine: 0 }] : []],
      [`$$${slashes}$$`, even ? [{ type: "display", content: slashes, startLine: 0, endLine: 0 }] : []],
    ];
    for (const [text, expected] of cases) {
      expect(findMathRegions(text)).toEqual(expected);
      expect(oldFindMathRegions(text)).toEqual(expected);
    }
  });

  // A comparison that cannot report a disagreement is no comparison: `expect(result.disagreements).toEqual([])` passes just as well if `compareScans` never fills the list.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    // A scan that closes an opener at the first closer-shaped `$` even on a LATER line: the function a cursor that forgot the line would be.
    const lineBlind = (text: string): MathRegion[] => {
      const out: MathRegion[] = [];
      const source = sourceOf(text);
      const charLine = oldBuildCharLine(text, BASE_LINE);
      let p = 0;
      while (p < text.length) {
        if (text[p] === "$" && !oldIsEscaped(text, p)) {
          if (text[p + 1] === "$") {
            const q = oldFindDisplayClose(text, p + 2);
            if (q === -1) {
              break;
            }
            out.push({ type: "display", content: source.slice(p + 2, q), startLine: charLine[p], endLine: charLine[q] });
            p = q + 2;
            continue;
          }
          if (p + 1 < text.length && !oldIsSpace(text[p + 1])) {
            const q = firstCloserShaped(text, p + 1);
            if (q !== -1) {
              out.push({ type: "inline", content: source.slice(p + 1, q), startLine: charLine[p], endLine: charLine[q] });
              p = q + 1;
              continue;
            }
          }
        }
        p++;
      }
      return out;
    };
    const result = compareScans(everyString(ALPHABET_FOUR, 6), lineBlind);
    expect(result.compared).toBe(countStrings(4, 6));
    expect(result.disagreements).toHaveLength(5);
    expect(result.disagreements.every((text) => (JSON.parse(text) as string).includes("\n"))).toBe(true);
    expect(compareScans(everyString(ALPHABET_FOUR, 6)).disagreements).toEqual([]);
  });

  // A clock row that cannot fail is no row (blank-tail-equivalence.test.ts): the OLD function must say "slow" on the very shapes the Session 327 clock rows of pathological-inputs.test.ts time. Each of these takes it 0.3 to 0.9 s
  // (warm, load 3 to 6), the new function 1 to 5 ms.
  it.each([
    [5_334, "$a "],
    [3_200, "$a$1 "],
    [4_000, "$a \\$ "],
  ] as Array<[number, string]>)("the clock rows can fail: the old function reads %i x %s far more slowly than the new one", (many, unit) => {
    const text = unit.repeat(many);
    const slow = timed(() => oldRegions(text));
    const fast = timed(() => newRegions(text));
    const fastest = Math.min(fast.ms, timed(() => newRegions(text)).ms, timed(() => newRegions(text)).ms); // a pause that lands in one of the three runs must not fail the row
    expect(slow.result).toEqual([]);
    expect(fast.result).toEqual([]);
    expect(slow.ms).toBeGreaterThan(fastest * 20 + 50);
  }, HEAVY_ROW_MS);
});
