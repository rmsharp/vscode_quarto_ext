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
import {
  leadingWsLen,
  mappingColonAt,
  topLevelSlots,
  unquoteKey,
  valueSlotAfterColon,
} from "./yaml-context";

/** One top-level front-matter line that carries a non-empty scalar value. */
export interface FrontMatterValueLine {
  /** 0-based document line. */
  line: number;
  /**
   * The mapping key, with one matching layer of YAML quoting stripped (`"toc"` → `toc`)
   * so it resolves against the schema's bare field names — the same `unquoteKey` rule
   * `findProjectConfigValueLines` applies (S159).
   */
  key: string;
  /** The half-open `[startCol, endCol)` span of the value token on `line`. */
  valueRange: { startCol: number; endCol: number };
  /** The value token exactly as written (possibly quoted; trailing unquoted comment excluded). */
  rawToken: string;
}

/**
 * A top-level front-matter mapping line as the UNFILTERED scan sees it — a superset of
 * `FrontMatterValueLine` that also covers the block-openers the value view drops.
 */
export interface FrontMatterTopLevelLine extends FrontMatterValueLine {
  /**
   * Whether this key opens a BLOCK — i.e. the next content line inside the front matter is
   * indented under it. Only ever true for a line with no scalar value, so it is the
   * mapping/sequence half of "does this key have a value at all"; a blank or comment-only
   * line in between is skipped, because neither is content (S164).
   *
   * Needed because quarto's engine selector tests a top-level key for JS TRUTHINESS
   * (`if (yaml[engine.name])`), and a mapping is truthy while the null of a bare `key:` is
   * not — measured, `jupyter:` + a kernelspec block renders exit 0 where bare `jupyter:`
   * renders exit 1 (`core/document-engine.ts`).
   */
  hasChildren: boolean;
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
  // Strips `hasChildren` rather than widening this shape: several suites assert the emitted
  // objects with `toEqual`, and this enumerator's contract predates the engine work.
  return findFrontMatterTopLevelLines(text)
    .filter((l) => l.rawToken.length > 0)
    .map(({ line, key, valueRange, rawToken }) => ({ line, key, valueRange, rawToken }));
}

/**
 * Every top-level front-matter mapping line, INCLUDING the block-openers
 * `findFrontMatterValueLines` filters out (`format:`, `jupyter:` above a kernelspec, a bare
 * `toc:`). Same scan, same continuation guard, one predicate less — so the two can never
 * disagree about which lines are top-level mappings in the first place.
 *
 * Exists because a key can matter without carrying a scalar: quarto's engine selector tests
 * a top-level `knitr:`/`jupyter:`/`markdown:`/`julia:` key for truthiness, and a mapping is
 * truthy (`core/document-engine.ts`, S164). Value DIAGNOSTICS still want the filtered view —
 * a block-opener has no scalar to validate — which is why that stays the default export.
 */
export function findFrontMatterTopLevelLines(text: string): FrontMatterTopLevelLine[] {
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
  const result: FrontMatterTopLevelLine[] = [];
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
      // Strip a leading node property before the first-char test. The name charset excludes ONLY
      // YAML's flow indicators `,[]{}` (an anchor/tag name cannot contain them — c-flow-indicator)
      // and the trailing whitespace is OPTIONAL, so the strip stops at — and thus SEES — a flow
      // opener that ABUTS the anchor with no space (`&a[one,`, which js-yaml/quarto fold:
      // `keywords: &a[one,` / `df-print: banana]` renders exit 0, so flagging the folded `df-print`
      // would be a cardinal-sin FP). It does NOT exclude quotes `"'` — those ARE legal anchor-name
      // chars, so `&a'b` (a quoted node name with a NULL value, which quarto accepts, exit 0) strips
      // WHOLE and does NOT arm a phantom quote that would swallow a following real key (§9
      // over-suppression lens, S155). The OLD `/^(?:[&!][^\s]*[ \t]+)+/` under-armed the abutting
      // bracket; the S154 cell-option charset `[^\s[\]{}"']` over-excluded quotes (the SAME
      // over-suppression, since corrected on that surface too — S156). All three value enumerators
      // and the cell-option `findCellOptionLines` share this.
      const opener = armToken.replace(/^(?:[&!][^\s,[\]{}]*[ \t]*)+/, "")[0];
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
    result.push({
      line: baseLine + i,
      // UNQUOTED, so the key resolves against the schema's bare field names — the same rule
      // `findProjectConfigValueLines` applies (`unquoteKey`, shared from `yaml-context.ts`).
      // A quoted key is YAML-legal and semantically identical to its bare form, and quarto
      // treats them identically: `"toc": banana` renders exit 1 with `Field "toc" has value
      // banana` exactly as `toc: banana` does (grounded firsthand vs 1.7.33, S159). Keeping
      // the quotes attached resolved against no field, so the diagnostic was silently lost on
      // this surface while `_quarto.yml` flagged it — the surface-parity gap filed S149. The
      // fix only ever ADDS a diagnostic quarto also reports: a key that merely LOOKS quoted
      // (`"toc`, `"toc" x`) has no matching pair, so it is left intact and stays silent, and
      // those documents are structural `YAMLException`s (exit 1) rather than value errors
      // anyway. `valueRange`/`rawToken` are computed from the separator and are unaffected.
      key: unquoteKey(lineText.slice(0, colon).replace(/[ \t]+$/, "")),
      valueRange: { startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      rawToken,
      // Only a line with NO scalar can open a block, so the lookahead is skipped entirely
      // for the common case — and a value-bearing line can never be reported as a parent.
      hasChildren: rawToken.length === 0 && opensBlockAt(contentLines, i),
    });
  }
  return result;
}

/**
 * Whether the front-matter content line at `i` opens a block whose body is a MAPPING or a
 * SEQUENCE — i.e. a genuine container node — before any further content.
 *
 * Blank and comment-only lines are skipped because neither is YAML content: `jupyter:` above
 * nothing but a `# comment` is still the null node, and quarto renders that document exit 1
 * (measured), so counting the comment as a body would claim a container that is not there.
 * Called only for a line whose scalar token is empty, which cannot have armed the
 * quoted/flow continuation guard, so the following lines really are ordinary lines here.
 *
 * ⚠ **Indentation alone is NOT the test, and assuming it was shipped a cardinal-sin false
 * positive** (found by the S164 §9 review). An indented line under a bare `key:` has three
 * shapes, not two: a mapping entry, a sequence item, or the continuation of a multi-line
 * PLAIN SCALAR — and that third one carries the key's actual VALUE, which may be falsy.
 * `knitr:` above an indented `false` is exactly `knitr: false`: measured firsthand, a
 * `{python}` cell with `#| cache: banana` renders **exit 0** there (against the
 * engine-agnostic control `#| echo: banana` at exit 1, proving validation ran, and against
 * an indented `true` at exit 1, proving knitr really is selected in that case). Reporting a
 * container made `documentEngineForScoping` claim knitr and squiggle a document quarto
 * ACCEPTS — and the blank/comment skipping above widened the same hole (both spellings
 * measured exit 0).
 *
 * So the body must LOOK like a container: a mapping entry (a real key/value separator) or a
 * block-sequence item. A scalar body reports `false`, and the engine resolver then declines
 * to select — which returns those documents to the per-cell language approximation they had
 * before, rather than to a wrong answer. That costs a true positive when the folded scalar is
 * TRUTHY (`knitr:` / `  true`, measured exit 1) — the FP-safe direction, and filed.
 */
function opensBlockAt(contentLines: readonly string[], i: number): boolean {
  for (let j = i + 1; j < contentLines.length; j++) {
    const line = contentLines[j];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    if (leadingWsLen(line) === 0) {
      return false; // a new top-level key — the opener's node is null
    }
    // A block-sequence item, or a mapping entry with a real key/value separator. Anything
    // else indented is a plain-scalar continuation: the key's VALUE, not a container.
    return trimmed === "-" || trimmed.startsWith("- ") || mappingColonAt(line) >= 0;
  }
  return false;
}
