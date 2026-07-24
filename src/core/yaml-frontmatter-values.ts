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
import { leadingWsLen, mappingColonAt, topLevelSlots, valueSlotAfterColon } from "./yaml-context";

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
    const trimmed = lineText.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue; // blank / comment — hosts no value to arm or emit
    }

    // ── ARM THE CONTINUATION GUARD FIRST, INDEPENDENT OF EMISSION SCOPE ──
    // Mirrors the `_quarto.yml` value enumerator (`project-yaml.ts:findProjectConfigValueLines`,
    // arming block). Every scalar-bearing line can open a multi-line quoted/flow value that
    // folds the following lines into itself, whether or not THIS enumerator goes on to emit it:
    // the top-level pass skips indented lines, block-sequence items, and no-colon lines, and a
    // value opened on any of those folds a later COLUMN-0 mapping-looking line into itself. If
    // the guard is armed only for EMITTED lines (the OLD behavior), those folds are unguarded
    // and the folded continuation is read as a real mapping and flagged on a document quarto
    // renders exit 0 — a cardinal-sin false positive (Defect B, grounded firsthand vs quarto
    // 1.7.33, S153; `format:\n  html:\n    css: "styles\ndf-print: banana\nmore"` folds
    // df-print into css and there is no top-level df-print key). The arm token is the value
    // after the separator when there is one, else the line's own content past a leading `- `
    // (a block-sequence item `- "intro.qmd` has no colon yet opens a quoted scalar).
    const colon = mappingColonAt(lineText);
    const valueSlot = colon < 0 ? null : valueSlotAfterColon(lineText, colon);
    const rawToken = valueSlot === null ? "" : lineText.slice(valueSlot.startCol, valueSlot.endCol);
    const indent = leadingWsLen(lineText);
    const armToken =
      valueSlot === null ? lineText.slice(indent).replace(/^-[ \t]*/, "").trimEnd() : rawToken;
    // Arm only for a token that actually OPENS a quoted/flow scalar, decided by its FIRST
    // character past any leading node property (`&anchor `/`!tag `). Deliberately NOT a
    // `scanFlow` over the WHOLE token: that scan treats an inner quote/bracket in a plain
    // scalar as an opener and arms a phantom quote — `title: Don't Panic` (quarto exit 0) armed
    // a `'` whose continuation guard then swallowed EVERY following line, silently disabling
    // validation of every key below it (Defect A / the phantom-quote FN, S153). In a YAML plain
    // scalar an inner quote/bracket is literal text, so narrowing is simply more correct — an
    // anchored/tagged opener `foo: &a { … ` still arms because the node property is stripped
    // BEFORE the first-character test (its brackets are then counted by the whole-token scan).
    if (armToken.length > 0) {
      const opener = armToken.replace(/^(?:[&!][^\s]*[ \t]+)+/, "")[0];
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

    // ── EMISSION (top-level column-0 mappings only) ──
    const { keySlot } = topLevelSlots(lineText);
    if (keySlot === null) {
      continue; // an indented / sequence / comment line — not a top-level mapping
    }
    // `colon` (above) is the first colon that is a real YAML key/value SEPARATOR, NOT
    // `topLevelSlots`' value slot (which is built from the raw first colon because COMPLETION
    // repairs `key:value` by prepending a space). For DIAGNOSTICS a line with no separator is
    // simply not a mapping here — `toc:banana` is a plain scalar quarto REJECTS (exit 1), a safe
    // FN — and on `a:b: banana` the key is re-derived from the separator (`a:b`), matching the
    // arm token above.
    if (colon < 0 || valueSlot === null) {
      continue; // no key/value separator — not a mapping here (a safe false negative)
    }
    if (rawToken.length === 0) {
      continue; // block-opener / comment-only value → no scalar to validate
    }
    result.push({
      line: baseLine + i,
      key: lineText.slice(0, colon).replace(/[ \t]+$/, ""),
      valueRange: { startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      rawToken,
    });
  }
  return result;
}
