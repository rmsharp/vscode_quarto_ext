/**
 * Pure, `vscode`-free detector for LaTeX math regions in a Quarto `.qmd`.
 *
 * Like the rest of `core/`, this module MUST NOT import `vscode` (architecture
 * plan §3.3 guardrail) and is unit-tested headlessly. It is the source of truth
 * for the math-preview feature (plan §6 Phase 7): it locates inline `$…$` and
 * display `$$…$$` math so the webview adapter can render each region with KaTeX.
 *
 * Math is only recognized in body prose. The set of body lines comes from the
 * shared `scanRegions` model (`core/qmd/model`), so a `$` inside YAML front
 * matter, an HTML comment, or a code cell is never mistaken for math — and there
 * is no second line-classifier to drift out of agreement with it (Learning #14).
 */

import { type BodyLine, findBodyLines } from "./qmd/model";

/** A located LaTeX math region. Line indices are 0-based. */
export interface MathRegion {
  /** `inline` for `$…$` (single line), `display` for `$$…$$` (may span lines). */
  type: "inline" | "display";
  /** The LaTeX between the delimiters (delimiters excluded). */
  content: string;
  /** 0-based line of the opening delimiter. */
  startLine: number;
  /** 0-based line of the closing delimiter. */
  endLine: number;
}

/** Find every inline `$…$` and display `$$…$$` math region, in document order. */
export function findMathRegions(text: string): MathRegion[] {
  const out: MathRegion[] = [];
  // Scan each maximal run of consecutive body lines on its own. Joining only
  // consecutive lines keeps the synthetic `\n` offsets aligned with real line
  // numbers, and a skip-region (front matter / comment / fence) between two runs
  // is a hard boundary — display math cannot span it.
  for (const run of contiguousRuns(findBodyLines(text))) {
    const s = run.map((b) => b.text).join("\n");
    scan(s, run[0].line, out);
  }
  return out;
}

/** Split body lines into maximal runs of consecutive 0-based line numbers. */
function contiguousRuns(body: BodyLine[]): BodyLine[][] {
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
 * Scan `s` (whose first line is document line `baseLine`) for math regions,
 * appending each to `out`. A `$$` always opens display math (it wins over
 * inline); a lone `$` opens inline math that closes at the next `$` on the line.
 */
function scan(s: string, baseLine: number, out: MathRegion[]): void {
  const charLine = buildCharLine(s, baseLine);
  let p = 0;
  while (p < s.length) {
    if (s[p] === "$" && !isEscaped(s, p)) {
      if (s[p + 1] === "$") {
        const q = findDisplayClose(s, p + 2);
        if (q === -1) {
          break; // unterminated display — the rest is inside open math
        }
        out.push({
          type: "display",
          content: s.slice(p + 2, q),
          startLine: charLine[p],
          endLine: charLine[q],
        });
        p = q + 2;
        continue;
      }
      // Inline opener: the character to its right must be a non-space.
      if (p + 1 < s.length && !isSpace(s[p + 1])) {
        const q = findInlineClose(s, p + 1, charLine[p], charLine);
        if (q !== -1) {
          out.push({
            type: "inline",
            content: s.slice(p + 1, q),
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
function findDisplayClose(s: string, from: number): number {
  for (let k = from; k < s.length - 1; k++) {
    if (s[k] === "$" && s[k + 1] === "$" && !isEscaped(s, k)) {
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
function findInlineClose(
  s: string,
  from: number,
  openLine: number,
  charLine: number[],
): number {
  for (let k = from; k < s.length; k++) {
    if (charLine[k] !== openLine) {
      return -1; // inline math does not span lines
    }
    if (s[k] !== "$" || isEscaped(s, k)) {
      continue;
    }
    const precededByNonSpace = k > from && !isSpace(s[k - 1]);
    const followedByDigit = k + 1 < s.length && isDigit(s[k + 1]);
    if (precededByNonSpace && !followedByDigit) {
      return k;
    }
  }
  return -1;
}

/** True if the character at `i` is preceded by an odd run of backslashes. */
function isEscaped(s: string, i: number): boolean {
  let n = 0;
  for (let k = i - 1; k >= 0 && s[k] === "\\"; k--) {
    n++;
  }
  return n % 2 === 1;
}

function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/** Map each character index of `s` to its 0-based document line number. */
function buildCharLine(s: string, baseLine: number): number[] {
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
