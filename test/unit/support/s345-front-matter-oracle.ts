// Session 345 part P3 -- the OLD spellings, kept as the oracle for the front-matter reads (Learning 738's pattern).
//
// What is here is copied BY A PROGRAM from the parent commit acbc51f0d196622c7b4a686711bda448cb2b137e (`git show` of src/core/qmd/model.ts, src/core/yaml-frontmatter-values.ts and
// src/core/yaml-frontmatter-nested-values.ts): every code line is the parent's own, byte for byte. Dropped: whole-line comments. Renamed: each function gets an `old` prefix, and the
// two callees the enumerators had (`findFrontMatter`, `frontMatterContentLines`) are the `old` ones below. The one thing that is NOT copied from a function is the SPAN: the parent
// read it from `scanRegions(text).frontMatter`, which is built inside `computeRegions`' loop by the state machine written out as `oldFrontMatterSpan` -- the five lines of that loop
// that touch `frontMatter` and `inFrontmatter`, in the parent's order, with the rest of the loop (it never writes either) left out. That the elision is exact was checked against the
// parent's own scanner, not assumed: the same text asked of a build of the parent (`findFrontMatter` of the parent bundle) and of `oldFrontMatterSpan` agreed on every case drawn.
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
