/**
 * Pure, `vscode`-free enumerator of NESTED front-matter VALUE lines in a `.qmd`
 * (nested value-validation plan §3.3, Phase 3 / v2).
 *
 * The sibling `yaml-frontmatter-values.ts:findFrontMatterValueLines` enumerates
 * TOP-LEVEL (column-0) front-matter scalars; this is its indented counterpart. It
 * enumerates each INDENTED mapping scalar under an allow-listed container
 * (`execute:` → `["execute"]`, `format:\n  <fmt>:` → `["format", <fmt>]`, and one
 * object level deeper) — `{ line, parentPath, key, valueRange, rawToken }` — so the
 * value-diagnostics feature can resolve the key against `frontMatterKeys(parentPath)`
 * and flag a wrong VALUE with the SAME surface-agnostic `isWrongValue` matcher.
 *
 * Two design choices carry the safety story (plan §7):
 *   1. The container path is computed by REUSING the tested `nestedParentPath`
 *      ancestor walk (exported from `yaml-context.ts`) per line, not a hand-rolled
 *      path stack — so the `format`-rooted-only rule and the block-scalar bail (a
 *      `key: |` container makes `mappingContainerKey` return null) come for free.
 *   2. Multi-line values that span lines are tracked with the shared QUOTE-AWARE,
 *      node-property-aware scanner (`scanFlow`, `yaml-context.ts`) that follows BOTH an
 *      unclosed flow collection (`{…}`/`[…]`) AND an unterminated quoted scalar
 *      (`key: "text…`). BOTH enumerators (this nested one and the top-level
 *      `findFrontMatterValueLines`) use the same scanner: a multi-line quoted scalar folds
 *      its continuation into the value even at COLUMN 0, so a continuation line misread as a
 *      mapping is a live cardinal-sin false positive at EITHER level, never a safe false
 *      negative (plan §7.1's three firsthand-rendered flow shapes: same-indent continuation,
 *      anchored opener `foo: &a { … }`, quoted brace `a: "}"`; PLUS the adversarial reviews'
 *      CONFIRMED multi-line-quoted-scalar FPs — nested `title: "…\n echo: x"` (S128) and
 *      top-level `title: "…\n columns: wide"` (S130) — that a flow-only guard missed).
 *
 * `parentPath` EXCLUDES this line's own key (the `nestedParentPath` FUNCTION
 * convention), unlike the completion CONTEXT's `parentPath` which appends it — so
 * resolution is `frontMatterKeys(parentPath).find(name === key)`, NOT `.slice(0,-1)`
 * (plan §3.3 footgun, §11 dragon 2).
 */

import { findFrontMatter, frontMatterContentLines, scanFlow } from "./qmd/model";
import {
  mappingColonAt,
  leadingWsLen,
  nestedParentPath,
  valueSlotAfterColon,
} from "./yaml-context";

/** One nested (indented) front-matter line that carries a non-empty scalar value. */
export interface NestedFrontMatterValueLine {
  /** 0-based document line. */
  line: number;
  /**
   * The CONTAINER path from the document root, EXCLUDING this line's own key —
   * `["execute"]`, `["format", <fmt>]`, `["format", <fmt>, <opt>]`, … Resolve with
   * `frontMatterKeys(parentPath).find(name === key)` (NOT `.slice(0,-1)`).
   */
  parentPath: string[];
  /** The nested mapping key (raw text as it appears — quotes, if any, retained). */
  key: string;
  /** The half-open `[startCol, endCol)` span of the value token on `line`. */
  valueRange: { startCol: number; endCol: number };
  /** The value token exactly as written (possibly quoted; trailing unquoted comment excluded). */
  rawToken: string;
}

/**
 * Enumerate every NESTED (indented) front-matter mapping line in `text` that
 * carries a non-empty scalar value, in document order. Returns `[]` when the
 * document has no front matter.
 */
export function findNestedFrontMatterValueLines(
  text: string,
): NestedFrontMatterValueLine[] {
  const fm = findFrontMatter(text);
  if (fm === null) {
    return [];
  }
  const contentLines = frontMatterContentLines(text);
  if (contentLines === null) {
    return []; // defensive — unreachable when `fm` is non-null
  }
  // `contentLines[i]` is the interior line at absolute document line
  // `fm.startLine + 1 + i` (the fences are excluded from both). Passing
  // `contentLines` (not the whole document) to `nestedParentPath` is correct: the
  // walk only climbs UPWARD to a column-0 container and returns the container path,
  // never a line number — and every container (`execute:` / `format:` / `<fmt>:`)
  // lives inside this block, so the front-matter-bounded array finds the same
  // ancestors the absolute-line completion path would (Learning #14 — one scanner).
  const baseLine = fm.startLine + 1;
  const result: NestedFrontMatterValueLine[] = [];
  // State of an unclosed multi-line value that spans following lines. TWO forms, both of
  // which make a following line — even at the SAME indent as its key — a continuation, NOT
  // a new nested mapping, so it must be skipped (else its `closed-sibling: text` reads as a
  // real value and is flagged while quarto folds the whole span into ONE value it accepts —
  // a cardinal-sin false positive at depth, where there is NO column-0 backstop):
  //   • `flowDepth` — an unclosed FLOW collection `{…}` / `[…]` (plan §7.1, three
  //     firsthand-rendered exit-0 shapes: same-indent continuation, anchored opener
  //     `foo: &a { … }`, quoted brace `a: "}"`);
  //   • `openQuote` — an unterminated single/double-QUOTED scalar `key: "text…` whose
  //     closing quote is on a later line (the adversarial review's CONFIRMED CRITICAL FP —
  //     a quote-only counter misses it because an open quote contains no `{}[]` brackets).
  // `scanFlow` tracks BOTH together (a flow collection may contain a line-spanning quoted
  // string, and a quote suppresses bracket counting). Over-skipping when ambiguous (a stray
  // brace/quote in a plain scalar) is the safe false-negative direction.
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

    // ── ARM THE CONTINUATION GUARD FIRST, INDEPENDENT OF EMISSION SCOPE ──
    // Mirrors the `_quarto.yml` value enumerator (`project-yaml.ts:findProjectConfigValueLines`)
    // and the top-level `.qmd` sibling. A multi-line quoted/flow value can be OPENED on a line
    // this NESTED pass does not emit — a COLUMN-0 line (skipped as the top-level pass's job), a
    // block-sequence item, a line under an unresolved container, a no-colon line — and it folds
    // the following lines into itself even at depth, where there is NO column-0 backstop. Arming
    // only from EMITTED lines (the OLD behavior) left those folds unguarded, so a nested
    // mapping-looking continuation was read as a real mapping and flagged on a document quarto
    // renders exit 0 — a cardinal-sin false positive (Defect B, grounded firsthand vs quarto
    // 1.7.33, S153: `title: "My great\nexecute:\n  echo: banana\nend"` folds echo into title's
    // string and there is no execute block at all). The arm token is the value after the
    // separator when there is one, else the line's own content past a leading `- ` (a
    // block-sequence mapping `- text: "Home` opens a quoted scalar that folds later lines in).
    const colon = mappingColonAt(lineText, indent);
    const valueSlot = colon < 0 ? null : valueSlotAfterColon(lineText, colon);
    const rawToken = valueSlot === null ? "" : lineText.slice(valueSlot.startCol, valueSlot.endCol);
    const armToken =
      valueSlot === null ? lineText.slice(indent).replace(/^-[ \t]*/, "").trimEnd() : rawToken;
    // Arm only for a token whose FIRST character (past a stripped leading node property
    // `&anchor `/`!tag `) opens a quoted/flow scalar — deliberately NOT a `scanFlow` over the
    // WHOLE token. The whole-token scan arms a phantom quote from an inner apostrophe in a plain
    // scalar (`toc-title: Don't skip` → a `'` that swallows the following nested keys, silently
    // disabling their validation — Defect A). Stripping the node property BEFORE the first-char
    // test keeps an anchored/tagged flow opener `foo: &a { …` arming (its brackets are then
    // counted by the whole-token scan), which is the case the OLD whole-token form existed for.
    if (armToken.length > 0) {
      // Strip a leading node property before the first-char test. The name charset excludes ONLY
      // YAML's flow indicators `,[]{}` (an anchor/tag name cannot contain them — c-flow-indicator)
      // and the trailing whitespace is OPTIONAL, so the strip stops at — and thus SEES — a flow
      // opener that ABUTS the anchor with no space (`&a[one,`, which js-yaml/quarto fold: a nested
      // `fig-cap: &a[one,` / `number-sections: banana]` renders exit 0, so flagging the folded
      // `number-sections` would be a cardinal-sin FP). It does NOT exclude quotes `"'` — those ARE
      // legal anchor-name chars, so `&a'b` (a quoted node name with a NULL value, which quarto
      // accepts, exit 0) strips WHOLE and does NOT arm a phantom quote that would swallow a following
      // real key (§9 over-suppression lens, S155). The OLD `/^(?:[&!][^\s]*[ \t]+)+/` under-armed the
      // abutting bracket; the S154 cell-option charset `[^\s[\]{}"']` over-excluded quotes (the SAME
      // over-suppression, still latent on that surface — filed). All three value enumerators share this.
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

    // ── EMISSION (indented, resolvable nested mappings only) ──
    if (indent === 0) {
      continue; // a column-0 line is the top-level enumerator's job, not here
    }
    const rest = lineText.slice(indent);
    if (rest.startsWith("-")) {
      continue; // a block-sequence item hosts no nested mapping value of its own
    }
    // The CONTAINER path (excluding this line's key) via the SAME tested ancestor walk
    // completion uses. `null` ⇒ skip: an unresolvable structure, a non-`format` column-0
    // root, OR a block-scalar/flow intermediate container (`mappingContainerKey` → null
    // on a `key: |` / `key: v` line) — which is what protects block-scalar content (§7.2).
    const parentPath = nestedParentPath(contentLines, i, indent);
    if (parentPath === null) {
      continue;
    }
    if (colon < 0 || valueSlot === null) {
      // No key/value separator anywhere on the line, so it hosts no mapping value:
      // `echo:banana` is a plain scalar, which quarto REJECTS (exit 1) — a safe false negative,
      // the same rule the other two enumerators apply (plan §2.8/P2). The arm token above was
      // still computed from the whole line, so a no-colon line that opens a quoted scalar (a
      // sequence item) has already armed the guard; only the EMISSION is skipped here.
      continue;
    }
    const key = lineText.slice(indent, colon).replace(/[ \t]+$/, "");
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
