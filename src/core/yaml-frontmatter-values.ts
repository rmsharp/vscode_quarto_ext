/**
 * Pure, `vscode`-free enumerator of TOP-LEVEL front-matter VALUE lines in a
 * `.qmd` (front-matter/cell-option VALUE validation plan §4.2, Phase 2).
 *
 * The Phase-1 sibling `qmd/model.ts:findCellOptionLines` already gives the
 * value-diagnostics feature every `#|` cell-option value; this is its
 * front-matter counterpart. It enumerates each TOP-LEVEL (column-0) mapping
 * scalar inside the document's `---` front matter — `{ line, key, valueRange,
 * rawToken }` — so the feature can resolve the key against `frontMatterKeys([])`
 * and flag a wrong VALUE with the SAME surface-agnostic `isWrongValue` matcher.
 *
 * It mirrors `project-yaml.ts:findProjectConfigKeyLines` (a whole-document
 * forward scan of top-level mapping lines), differing only in that it is bounded
 * by the single front-matter scanner (`findFrontMatter`, Learning #14 — never a
 * second `---` parser) and emits the VALUE slot, not the key slot. NESTED values
 * (`format:`/`execute:` children) are v2 (plan §4.3) — an indented line is
 * skipped. A block-opener (`format:` with no scalar value), a comment/sequence
 * line, and a no-colon line are all skipped: they have no scalar value to check.
 */

import { findFrontMatter, frontMatterContentLines } from "./qmd/model";
import { topLevelSlots } from "./yaml-context";

/** One top-level front-matter line that carries a non-empty scalar value. */
export interface FrontMatterValueLine {
  /** 0-based document line. */
  line: number;
  /** The mapping key (raw text as it appears — quotes, if any, retained). */
  key: string;
  /** The half-open `[startCol, endCol)` span of the value token on `line`. */
  valueRange: { startCol: number; endCol: number };
  /** The value token exactly as written (possibly quoted; trailing unquoted comment excluded). */
  rawToken: string;
}

/**
 * Enumerate every top-level front-matter mapping line in `text` that carries a
 * non-empty scalar value, in document order. Returns `[]` when the document has
 * no front matter.
 *
 * Bounded by the single front-matter scanner: `findFrontMatter` gives the block
 * start (so absolute line numbers are exact) and `frontMatterContentLines` gives
 * the interior content lines (fences excluded) — the same scanner the citation
 * reader and the completion gate use, never a second `---` parser (Learning #14).
 * Each content line is parsed with the shared `topLevelSlots` grammar: an
 * indented (nested — v2), sequence, or comment line yields no key slot and is
 * skipped; a block-opener (`format:` with no scalar value) or a comment-only
 * value yields an empty value token and is skipped (no scalar to validate).
 */
export function findFrontMatterValueLines(text: string): FrontMatterValueLine[] {
  const fm = findFrontMatter(text);
  if (fm === null) {
    return [];
  }
  const contentLines = frontMatterContentLines(text);
  if (contentLines === null) {
    return []; // defensive — unreachable when `fm` is non-null
  }
  // `contentLines[i]` is the interior line at absolute document line
  // `fm.startLine + 1 + i` (the fences are excluded from both).
  const baseLine = fm.startLine + 1;
  const result: FrontMatterValueLine[] = [];
  for (let i = 0; i < contentLines.length; i++) {
    const lineText = contentLines[i];
    const { keySlot, valueSlot } = topLevelSlots(lineText);
    if (keySlot === null || valueSlot === null) {
      continue; // not a top-level mapping line, or no colon → no value to check
    }
    const rawToken = lineText.slice(valueSlot.startCol, valueSlot.endCol);
    if (rawToken.length === 0) {
      continue; // block-opener / comment-only value → no scalar to validate
    }
    result.push({
      line: baseLine + i,
      key: lineText.slice(keySlot.startCol, keySlot.endCol),
      valueRange: { startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      rawToken,
    });
  }
  return result;
}
