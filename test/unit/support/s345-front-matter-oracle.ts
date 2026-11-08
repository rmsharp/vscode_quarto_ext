// Session 345 part P3 -- the OLD spellings, kept as the oracle for the front-matter reads (Learning 738's pattern).
//
// What is here is copied BY A PROGRAM from the parent commit acbc51f0d196622c7b4a686711bda448cb2b137e (`git show` of src/core/qmd/model.ts, src/core/yaml-frontmatter-values.ts and
// src/core/yaml-frontmatter-nested-values.ts): every code line is the parent's own, byte for byte. Dropped: whole-line comments. Renamed: each function gets an `old` prefix, and the
// two callees the enumerators had (`findFrontMatter`, `frontMatterContentLines`) are the `old` ones below. The one thing that is NOT copied from a function is the SPAN: the parent
// read it from `scanRegions(text).frontMatter`, which is built inside `computeRegions`' loop by the state machine written out as `oldFrontMatterSpan` -- the five lines of that loop
// that touch `frontMatter` and `inFrontMatter`, in the parent's order, with the rest of the loop (it never writes either) left out. That is a HAND TRANSCRIPTION, and that the elision is
// exact is not claimed by this comment: it is pinned in the repository by `PARENT_SCAN_DOCUMENTS` at the foot of this file (hand-written documents whose span and scan views are literals
// frozen from a build of the parent; the rows are in s345-front-matter-reads.test.ts), and, once Session 345 gave the readers the scan's entry to read, by the row that asks the scan's
// own span of every document of the oracle's corpora and compares it with this function's. (Until then the same text asked of a build of the parent agreed on every case drawn, in a probe
// that is not kept.)
import { nodePropertyEnd, scanFlow, trimEndBlanks } from "../../../src/core/qmd/model";
import { documentEngineForScoping, type DocumentEngine } from "../../../src/core/document-engine";
import type { FrontMatterTopLevelLine } from "../../../src/core/yaml-frontmatter-values";
import type { NestedFrontMatterValueLine } from "../../../src/core/yaml-frontmatter-nested-values";
import {
  indexLineIndents,
  type LineIndentIndex,
  mappingColonAt,
  leadingWsLen,
  nestedParentPath,
  topLevelSlots,
  unquoteKey,
  valueSlotAfterColon,
} from "../../../src/core/yaml-context";

const FRONTMATTER_OPEN = /^---[ \t]*$/;
const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;

interface FrontMatterSpan {
  startLine: number;
  endLine: number;
  terminated: boolean;
}

export function oldFrontMatterOpenIndex(lines: readonly string[]): number | null {
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") {
    i++;
  }
  if (i >= lines.length || !FRONTMATTER_OPEN.test(lines[i])) {
    return null;
  }
  if (i === 0) {
    return 0;
  }
  if (i + 1 >= lines.length || lines[i + 1].trim() === "") {
    return null;
  }
  for (let j = i + 1; j < lines.length; j++) {
    if (FRONTMATTER_CLOSE.test(lines[j])) {
      return i;
    }
  }
  return null;
}

/** The parent's span: `scanRegions(text).frontMatter` -- the front-matter lines of `computeRegions`' loop, in the parent's order, over the parent's `text.split(/\r?\n/)`. */
export function oldFrontMatterSpan(text: string): FrontMatterSpan | null {
  const lines = text.split(/\r?\n/);
  const frontMatterOpensAt = oldFrontMatterOpenIndex(lines);
  let frontMatter: FrontMatterSpan | null = null;
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === frontMatterOpensAt) {
      inFrontmatter = true;
      frontMatter = { startLine: i, endLine: lines.length - 1, terminated: false };
      continue;
    }
    if (inFrontmatter) {
      if (FRONTMATTER_CLOSE.test(line)) {
        inFrontmatter = false;
        frontMatter = { startLine: frontMatterOpensAt ?? 0, endLine: i, terminated: true };
      }
      continue;
    }
  }
  return frontMatter;
}

export function oldFindFrontMatter(
  text: string,
): { startLine: number; endLine: number } | null {
  const fm = oldFrontMatterSpan(text);
  return fm === null ? null : { startLine: fm.startLine, endLine: fm.endLine };
}

export function oldInFrontMatter(text: string, line: number): boolean {
  const fm = oldFrontMatterSpan(text);
  if (fm === null || line <= fm.startLine) {
    return false;
  }
  return fm.terminated ? line < fm.endLine : line <= fm.endLine;
}

export function oldFrontMatterContentLines(text: string): string[] | null {
  const fm = oldFrontMatterSpan(text);
  if (fm === null) {
    return null;
  }
  const lines = text.split(/\r?\n/);
  const end = fm.terminated ? fm.endLine : fm.endLine + 1;
  return lines.slice(fm.startLine + 1, end);
}

function oldOpensBlockAt(contentLines: readonly string[], i: number): boolean {
  for (let j = i + 1; j < contentLines.length; j++) {
    const line = contentLines[j];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    if (leadingWsLen(line) === 0) {
      return false; // a new top-level key — the opener's node is null
    }
    return trimmed === "-" || trimmed.startsWith("- ") || mappingColonAt(line) >= 0;
  }
  return false;
}

export function oldFindFrontMatterTopLevelLines(text: string): FrontMatterTopLevelLine[] {
  const fm = oldFindFrontMatter(text);
  if (fm === null) {
    return [];
  }
  const contentLines = oldFrontMatterContentLines(text);
  if (contentLines === null) {
    return []; // defensive — unreachable when `fm` is non-null
  }
  const baseLine = fm.startLine + 1;
  const result: FrontMatterTopLevelLine[] = [];
  let flowDepth = 0;
  let openQuote: '"' | "'" | null = null;
  for (let i = 0; i < contentLines.length; i++) {
    const lineText = contentLines[i];
    if (flowDepth > 0 || openQuote !== null) {
      const s = scanFlow(lineText, flowDepth, openQuote);
      flowDepth = Math.max(0, s.depth);
      openQuote = s.quote;
      continue; // inside a multi-line flow/quoted value — skip continuation lines
    }
    const trimmed = lineText.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue; // blank / comment — hosts no value to arm or emit
    }

    const colon = mappingColonAt(lineText);
    const valueSlot = colon < 0 ? null : valueSlotAfterColon(lineText, colon);
    const rawToken = valueSlot === null ? "" : lineText.slice(valueSlot.startCol, valueSlot.endCol);
    const indent = leadingWsLen(lineText);
    const armToken =
      valueSlot === null ? lineText.slice(indent).replace(/^-[ \t]*/, "").trimEnd() : rawToken;
    if (armToken.length > 0) {
      const opener = armToken[nodePropertyEnd(armToken)];
      if (opener === '"' || opener === "'" || opener === "[" || opener === "{") {
        const s = scanFlow(armToken, 0, null);
        if (s.depth > 0) {
          flowDepth = s.depth;
        }
        if (s.quote !== null) {
          openQuote = s.quote;
        }
      }
    }

    const { keySlot } = topLevelSlots(lineText);
    if (keySlot === null) {
      continue; // an indented / sequence / comment line — not a top-level mapping
    }
    if (colon < 0 || valueSlot === null) {
      continue; // no key/value separator — not a mapping here (a safe false negative)
    }
    result.push({
      line: baseLine + i,
      key: unquoteKey(trimEndBlanks(lineText.slice(0, colon))),
      valueRange: { startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      rawToken,
      hasChildren: rawToken.length === 0 && oldOpensBlockAt(contentLines, i),
    });
  }
  return result;
}

export function oldFindNestedFrontMatterValueLines(
  text: string,
): NestedFrontMatterValueLine[] {
  const fm = oldFindFrontMatter(text);
  if (fm === null) {
    return [];
  }
  const contentLines = oldFrontMatterContentLines(text);
  if (contentLines === null) {
    return []; // defensive — unreachable when `fm` is non-null
  }
  const baseLine = fm.startLine + 1;
  let indents: LineIndentIndex | undefined;
  const result: NestedFrontMatterValueLine[] = [];
  let flowDepth = 0;
  let openQuote: '"' | "'" | null = null;
  for (let i = 0; i < contentLines.length; i++) {
    const lineText = contentLines[i];
    if (flowDepth > 0 || openQuote !== null) {
      const s = scanFlow(lineText, flowDepth, openQuote);
      flowDepth = Math.max(0, s.depth);
      openQuote = s.quote;
      continue; // inside a multi-line flow/quoted value — skip continuation lines
    }
    const trimmed = lineText.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue; // blank / comment — hosts no value to arm or emit
    }
    const indent = leadingWsLen(lineText);

    const colon = mappingColonAt(lineText, indent);
    const valueSlot = colon < 0 ? null : valueSlotAfterColon(lineText, colon);
    const rawToken = valueSlot === null ? "" : lineText.slice(valueSlot.startCol, valueSlot.endCol);
    const armToken =
      valueSlot === null ? lineText.slice(indent).replace(/^-[ \t]*/, "").trimEnd() : rawToken;
    if (armToken.length > 0) {
      const opener = armToken[nodePropertyEnd(armToken)];
      if (opener === '"' || opener === "'" || opener === "[" || opener === "{") {
        const s = scanFlow(armToken, 0, null);
        if (s.depth > 0) {
          flowDepth = s.depth;
        }
        if (s.quote !== null) {
          openQuote = s.quote;
        }
      }
    }

    if (indent === 0) {
      continue; // a column-0 line is the top-level enumerator's job, not here
    }
    const rest = lineText.slice(indent);
    if (rest.startsWith("-")) {
      continue; // a block-sequence item hosts no nested mapping value of its own
    }
    if (indents === undefined) {
      indents = indexLineIndents(contentLines);
    }
    const parentPath = nestedParentPath(contentLines, i, indent, indents);
    if (parentPath === null) {
      continue;
    }
    if (colon < 0 || valueSlot === null) {
      continue;
    }
    const key = unquoteKey(trimEndBlanks(lineText.slice(indent, colon)));
    if (key.length === 0) {
      continue; // `: value` with no key — malformed, nothing to resolve
    }
    if (rawToken.length === 0) {
      continue; // block-opener (`html:` / `theme:`) or still-typing → no scalar to validate
    }
    result.push({
      line: baseLine + i,
      parentPath,
      key,
      valueRange: { startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      rawToken,
    });
  }
  return result;
}

/** The parent's `resolveDocumentEngine`, with the parent's three readers. */
export function oldResolveDocumentEngine(fileName: string, text: string): DocumentEngine | "ambiguous" | undefined {
  const engineText = text.trimStart();
  return documentEngineForScoping(
    fileName,
    oldFindFrontMatterTopLevelLines(engineText),
    oldFindNestedFrontMatterValueLines(engineText),
    oldFrontMatterContentLines(engineText),
    engineText,
  );
}

// ---- THE PARENT'S SCAN VIEWS, FROZEN (Session 345 F1) ----
// What `oldFrontMatterSpan` above is checked against IN THE REPOSITORY. It is a hand transcription of the five lines of `computeRegions`' loop that touch the front matter, so what makes it the
// parent's span is not its being a copy but these rows: each document below was written by hand, put to a BUILD OF THE PARENT (commit acbc51f, before any Session 345 change; the script that froze
// them is not in the repository), and the answers it gave are written out as literals. They are three views of the scan (`findHeadings`, `findAllCells`, `findBodyLines`) and what the parent's readers said of
// the span (`findFrontMatter`, and whether `inFrontMatter` holds at the block's last line, which is so for a block with no terminator).
//
// The documents put the boundaries of a front matter at every place the scan uses them: 0, 1, 2 and 3 leading blank or whitespace-only lines before the opener; an interior that holds a
// heading-shaped comment, a cell fence and a comment opener; a `...` terminator; a block with no terminator; an empty block; a blank line under the opener; the terminator on the last line; the
// first line after the terminator (a heading, a cell); a `---` below prose, which opens nothing; two blocks; CRLF endings.
export interface ParentScanDocument {
  name: string;
  /** The lines of the document, joined by `terminator`. */
  lines: string[];
  /** The line terminator the lines are joined with; a line feed when it is left out. */
  terminator?: string;
  /** `[startLine, endLine, whether inFrontMatter holds at endLine]`, or `null` when the document opens no front matter. */
  span: [number, number, boolean] | null;
  /** `[line, level, text]` of each heading. */
  headings: Array<[number, number, string]>;
  /** `[startLine, endLine, lang]` of each cell. */
  cells: Array<[number, number, string]>;
  /** The line of each body line. */
  body: number[];
}

export const PARENT_SCAN_DOCUMENTS: ParentScanDocument[] = [
  {
    name: "0 blank, terminated by ---",
    lines: ["---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [0, 6, false],
    headings: [[7, 1, "After"]],
    cells: [[9, 11, "python"]],
    body: [7, 8, 12, 13, 14],
  },
  {
    name: "0 blank, terminated by ...",
    lines: ["---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "...", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [0, 6, false],
    headings: [[7, 1, "After"]],
    cells: [[9, 11, "python"]],
    body: [7, 8, 12, 13, 14],
  },
  {
    name: "0 blank, never terminated",
    lines: ["---", "title: T", "# Not a heading", "```{python}", "x = 1"],
    span: [0, 4, true],
    headings: [],
    cells: [],
    body: [],
  },
  {
    name: "0 blank, an empty block",
    lines: ["---", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [0, 1, false],
    headings: [[2, 1, "After"]],
    cells: [[4, 6, "python"]],
    body: [2, 3, 7, 8, 9],
  },
  {
    name: "0 blank, a blank line under the opener",
    lines: ["---", "", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [0, 3, false],
    headings: [[4, 1, "After"]],
    cells: [[6, 8, "python"]],
    body: [4, 5, 9, 10, 11],
  },
  {
    name: "0 blank, prose above a --- that opens nothing",
    lines: ["Prose first.", "---", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: null,
    headings: [[0, 2, "Prose first."], [2, 2, "title: T"], [4, 1, "After"]],
    cells: [[6, 8, "python"]],
    body: [0, 1, 2, 3, 4, 5, 9, 10, 11],
  },
  {
    name: "0 blank, the terminator is the last line",
    lines: ["---", "title: T", "---"],
    span: [0, 2, false],
    headings: [],
    cells: [],
    body: [],
  },
  {
    name: "0 blank, a cell is the first line after the terminator",
    lines: ["---", "title: T", "---", "```{python}", "z = 3", "```", "# Next"],
    span: [0, 2, false],
    headings: [[6, 1, "Next"]],
    cells: [[3, 5, "python"]],
    body: [6],
  },
  {
    name: "1 blank, terminated by ---",
    lines: ["", "---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [1, 7, false],
    headings: [[8, 1, "After"]],
    cells: [[10, 12, "python"]],
    body: [0, 8, 9, 13, 14, 15],
  },
  {
    name: "1 blank, terminated by ...",
    lines: ["", "---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "...", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [1, 7, false],
    headings: [[8, 1, "After"]],
    cells: [[10, 12, "python"]],
    body: [0, 8, 9, 13, 14, 15],
  },
  {
    name: "1 blank, never terminated",
    lines: ["", "---", "title: T", "# Not a heading", "```{python}", "x = 1"],
    span: null,
    headings: [],
    cells: [],
    body: [0, 1, 2, 3, 4, 5],
  },
  {
    name: "1 blank, an empty block",
    lines: ["", "---", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [1, 2, false],
    headings: [[3, 1, "After"]],
    cells: [[5, 7, "python"]],
    body: [0, 3, 4, 8, 9, 10],
  },
  {
    name: "1 blank, a blank line under the opener",
    lines: ["", "---", "", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: null,
    headings: [[3, 2, "title: T"], [5, 1, "After"]],
    cells: [[7, 9, "python"]],
    body: [0, 1, 2, 3, 4, 5, 6, 10, 11, 12],
  },
  {
    name: "1 blank, prose above a --- that opens nothing",
    lines: ["", "Prose first.", "---", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: null,
    headings: [[1, 2, "Prose first."], [3, 2, "title: T"], [5, 1, "After"]],
    cells: [[7, 9, "python"]],
    body: [0, 1, 2, 3, 4, 5, 6, 10, 11, 12],
  },
  {
    name: "1 blank, the terminator is the last line",
    lines: ["", "---", "title: T", "---"],
    span: [1, 3, false],
    headings: [],
    cells: [],
    body: [0],
  },
  {
    name: "1 blank, a cell is the first line after the terminator",
    lines: ["", "---", "title: T", "---", "```{python}", "z = 3", "```", "# Next"],
    span: [1, 3, false],
    headings: [[7, 1, "Next"]],
    cells: [[4, 6, "python"]],
    body: [0, 7],
  },
  {
    name: "2 blank, terminated by ---",
    lines: ["", "  ", "---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [2, 8, false],
    headings: [[9, 1, "After"]],
    cells: [[11, 13, "python"]],
    body: [0, 1, 9, 10, 14, 15, 16],
  },
  {
    name: "2 blank, terminated by ...",
    lines: ["", "  ", "---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "...", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [2, 8, false],
    headings: [[9, 1, "After"]],
    cells: [[11, 13, "python"]],
    body: [0, 1, 9, 10, 14, 15, 16],
  },
  {
    name: "2 blank, never terminated",
    lines: ["", "  ", "---", "title: T", "# Not a heading", "```{python}", "x = 1"],
    span: null,
    headings: [],
    cells: [],
    body: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    name: "2 blank, an empty block",
    lines: ["", "  ", "---", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [2, 3, false],
    headings: [[4, 1, "After"]],
    cells: [[6, 8, "python"]],
    body: [0, 1, 4, 5, 9, 10, 11],
  },
  {
    name: "2 blank, a blank line under the opener",
    lines: ["", "  ", "---", "", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: null,
    headings: [[4, 2, "title: T"], [6, 1, "After"]],
    cells: [[8, 10, "python"]],
    body: [0, 1, 2, 3, 4, 5, 6, 7, 11, 12, 13],
  },
  {
    name: "2 blank, prose above a --- that opens nothing",
    lines: ["", "  ", "Prose first.", "---", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: null,
    headings: [[2, 2, "Prose first."], [4, 2, "title: T"], [6, 1, "After"]],
    cells: [[8, 10, "python"]],
    body: [0, 1, 2, 3, 4, 5, 6, 7, 11, 12, 13],
  },
  {
    name: "2 blank, the terminator is the last line",
    lines: ["", "  ", "---", "title: T", "---"],
    span: [2, 4, false],
    headings: [],
    cells: [],
    body: [0, 1],
  },
  {
    name: "2 blank, a cell is the first line after the terminator",
    lines: ["", "  ", "---", "title: T", "---", "```{python}", "z = 3", "```", "# Next"],
    span: [2, 4, false],
    headings: [[8, 1, "Next"]],
    cells: [[5, 7, "python"]],
    body: [0, 1, 8],
  },
  {
    name: "3 blank, terminated by ---",
    lines: ["", "\t", " ", "---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [3, 9, false],
    headings: [[10, 1, "After"]],
    cells: [[12, 14, "python"]],
    body: [0, 1, 2, 10, 11, 15, 16, 17],
  },
  {
    name: "3 blank, terminated by ...",
    lines: ["", "\t", " ", "---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "...", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [3, 9, false],
    headings: [[10, 1, "After"]],
    cells: [[12, 14, "python"]],
    body: [0, 1, 2, 10, 11, 15, 16, 17],
  },
  {
    name: "3 blank, never terminated",
    lines: ["", "\t", " ", "---", "title: T", "# Not a heading", "```{python}", "x = 1"],
    span: null,
    headings: [],
    cells: [],
    body: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    name: "3 blank, an empty block",
    lines: ["", "\t", " ", "---", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: [3, 4, false],
    headings: [[5, 1, "After"]],
    cells: [[7, 9, "python"]],
    body: [0, 1, 2, 5, 6, 10, 11, 12],
  },
  {
    name: "3 blank, a blank line under the opener",
    lines: ["", "\t", " ", "---", "", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: null,
    headings: [[5, 2, "title: T"], [7, 1, "After"]],
    cells: [[9, 11, "python"]],
    body: [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14],
  },
  {
    name: "3 blank, prose above a --- that opens nothing",
    lines: ["", "\t", " ", "Prose first.", "---", "title: T", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    span: null,
    headings: [[3, 2, "Prose first."], [5, 2, "title: T"], [7, 1, "After"]],
    cells: [[9, 11, "python"]],
    body: [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14],
  },
  {
    name: "3 blank, the terminator is the last line",
    lines: ["", "\t", " ", "---", "title: T", "---"],
    span: [3, 5, false],
    headings: [],
    cells: [],
    body: [0, 1, 2],
  },
  {
    name: "3 blank, a cell is the first line after the terminator",
    lines: ["", "\t", " ", "---", "title: T", "---", "```{python}", "z = 3", "```", "# Next"],
    span: [3, 5, false],
    headings: [[9, 1, "Next"]],
    cells: [[6, 8, "python"]],
    body: [0, 1, 2, 9],
  },
  {
    name: "1 blank, two blocks",
    lines: ["", "---", "a: b", "---", "", "Prose.", "", "---", "c: d", "---", "# Tail"],
    span: [1, 3, false],
    headings: [[8, 2, "c: d"], [10, 1, "Tail"]],
    cells: [],
    body: [0, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    name: "2 blank, two blocks",
    lines: ["", "  ", "---", "a: b", "...", "# Right after", "---", "c: d", "---", "# Tail"],
    span: [2, 4, false],
    headings: [[5, 2, "# Right after"], [7, 2, "c: d"], [9, 1, "Tail"]],
    cells: [],
    body: [0, 1, 5, 6, 7, 8, 9],
  },
  {
    name: "0 blank, two blocks",
    lines: ["---", "a: b", "---", "", "Prose.", "", "---", "c: d", "---", "# Tail"],
    span: [0, 2, false],
    headings: [[7, 2, "c: d"], [9, 1, "Tail"]],
    cells: [],
    body: [3, 4, 5, 6, 7, 8, 9],
  },
  {
    name: "3 blank, the opener is also the last line",
    lines: ["", "", "", "---"],
    span: null,
    headings: [],
    cells: [],
    body: [0, 1, 2, 3],
  },
  {
    name: "0 blank, the opener is the whole document",
    lines: ["---"],
    span: [0, 0, false],
    headings: [],
    cells: [],
    body: [],
  },
  {
    name: "1 blank, terminated by --- with CRLF line endings",
    lines: ["", "---", "title: T", "# Not a heading", "```{python}", "x = 1", "<!--", "---", "# After", "", "```{python}", "y = 2", "```", "Prose.", "-->", "# Last"],
    terminator: "\r\n",
    span: [1, 7, false],
    headings: [[8, 1, "After"]],
    cells: [[10, 12, "python"]],
    body: [0, 8, 9, 13, 14, 15],
  },
  {
    name: "0 blank, never terminated, blank lines and a heading-shaped line at the end",
    lines: ["---", "title: T", "", "# Not a heading", "", ""],
    span: [0, 5, true],
    headings: [],
    cells: [],
    body: [],
  },
  {
    name: "0 blank, never terminated, one line",
    lines: ["---", "k: v"],
    span: [0, 1, true],
    headings: [],
    cells: [],
    body: [],
  },
  {
    name: "0 blank, never terminated, CRLF line endings",
    lines: ["---", "title: T", "# Not a heading", "```{python}", "x = 1"],
    terminator: "\r\n",
    span: [0, 4, true],
    headings: [],
    cells: [],
    body: [],
  },
  {
    name: "0 blank, a terminator with trailing blanks",
    lines: ["---", "title: T", "---  ", "# After", "", "Prose."],
    span: [0, 2, false],
    headings: [[3, 1, "After"]],
    cells: [],
    body: [3, 4, 5],
  },
  {
    name: "2 blank, an opener with trailing blanks",
    lines: ["", "", "---\t", "title: T", "---", "# After", "", "Prose."],
    span: [2, 4, false],
    headings: [[5, 1, "After"]],
    cells: [],
    body: [0, 1, 5, 6, 7],
  },
  {
    name: "1 blank, the first interior line is itself a fence line of dashes",
    lines: ["", "---", "----", "title: T", "---", "# After"],
    span: [1, 4, false],
    headings: [[5, 1, "After"]],
    cells: [],
    body: [0, 5],
  },
];
