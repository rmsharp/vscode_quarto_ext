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

import { findFrontMatter, frontMatterContentLines, scanFlow } from "./qmd/model";
import { isMappingSeparator, topLevelSlots } from "./yaml-context";

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
  // State of an unclosed multi-line value that spans following lines. While inside one, a
  // column-0 continuation line is NOT a new top-level mapping and must be skipped — else a
  // continuation like `toc: yes,` inside `mymeta: {\n…\n}`, OR `columns: wide"` inside a
  // multi-line quoted `title: "…"`, is misread as a top-level mapping and flagged, a
  // cardinal-sin false positive on a doc quarto renders exit 0. TWO forms, tracked together by
  // the shared quote-aware `scanFlow` (`yaml-context.ts`) — the SAME scanner the nested
  // enumerator uses:
  //   • `flowDepth` — an unclosed FLOW collection `{…}` / `[…]` (adversarial review, S125);
  //   • `openQuote` — an unterminated single/double-QUOTED scalar whose continuation folds
  //     into the value even at COLUMN 0 (adversarial review, S130 — a quote holds no `{}[]`
  //     brackets, so the previous quote-naive counter missed it entirely, and the numeric
  //     branch made the latent FP live for ~35 numeric top-level keys).
  // Block scalars (`|`/`>`) still need no tracking: their content is indented, so
  // `topLevelSlots` already skips it. Over-skipping when ambiguous is the safe FN direction.
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
    const { keySlot, valueSlot } = topLevelSlots(lineText);
    if (keySlot === null || valueSlot === null) {
      continue; // not a top-level mapping line, or no colon → no value to check
    }
    if (!isMappingSeparator(lineText, lineText.indexOf(":"))) {
      // The colon does not separate a key from a value, so this line hosts no mapping
      // value: on `toc:: true` YAML's key is `toc:` (quarto accepts it on this OPEN key
      // set and renders exit 0) and on `toc:banana` the whole line is a plain scalar.
      // Emitting either would let the matcher flag a line quarto accepts, or a line whose
      // key we misread — the cardinal-sin FP this guard removes (plan §2.8/P2).
      //
      // Applied HERE rather than inside `topLevelSlots` because that grammar is shared
      // with COMPLETION, which must keep offering values on a `key:value` line — it is a
      // user mid-typing, and the provider repairs it by prepending a space (S148).
      //
      // ⚠ Re-find the colon rather than reusing `keySlot.endCol`: the key span has its
      // trailing blanks trimmed, so on `toc : banana` it ends at 3 while the colon is at 4
      // — asking about index 3 reads the colon ITSELF as the following character and
      // wrongly skips a real mapping quarto validates (`toc : true` exit 0, `toc : banana`
      // exit 1, both firsthand-verified). A value slot exists here, so the colon is present.
      continue;
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
    // Arm the continuation-skip if THIS value opens an unclosed flow collection OR an
    // unterminated quoted scalar — scanned over the WHOLE token (a quote cannot be detected
    // by a first-char `[`/`{` test), matching the nested enumerator's arming.
    const s = scanFlow(rawToken, 0, null);
    if (s.depth > 0) {
      flowDepth = s.depth;
    }
    if (s.quote !== null) {
      openQuote = s.quote;
    }
  }
  return result;
}
