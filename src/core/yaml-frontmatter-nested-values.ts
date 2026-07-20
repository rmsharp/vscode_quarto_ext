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
 *   2. Multi-line FLOW collections at depth are tracked with a QUOTE-AWARE,
 *      node-property-aware net-bracket scanner (`flowScan`) — NOT the top-level
 *      enumerator's quote-naive `netFlowDelta`. At depth there is no column-0
 *      backstop, so a quote-naive under-count is a live false positive, not the safe
 *      false negative it is at the top level (plan §7.1, three firsthand-rendered
 *      exit-0 FP shapes: same-indent continuation, anchored opener `foo: &a { … }`,
 *      quoted brace `a: "}"`).
 *
 * `parentPath` EXCLUDES this line's own key (the `nestedParentPath` FUNCTION
 * convention), unlike the completion CONTEXT's `parentPath` which appends it — so
 * resolution is `frontMatterKeys(parentPath).find(name === key)`, NOT `.slice(0,-1)`
 * (plan §3.3 footgun, §11 dragon 2).
 */

import { findFrontMatter, frontMatterContentLines } from "./qmd/model";
import { leadingWsLen, nestedParentPath, valueSlotAfterColon } from "./yaml-context";

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
  // Depth of an unclosed multi-line FLOW collection (`{…}` / `[…]`). While > 0 we are
  // inside a value that spans lines, so a following line — even at the SAME indent as
  // its container — is a continuation, NOT a new nested mapping, and must be skipped.
  // Unlike the top-level enumerator (`netFlowDelta`), the counter here is QUOTE-AWARE
  // and armed over the WHOLE token (`flowScan`): at depth there is NO column-0 backstop,
  // so a quote-naive under-count would be a live cardinal-sin false positive on a doc
  // quarto accepts, not a safe false negative (plan §7.1, three firsthand-rendered
  // exit-0 shapes: same-indent continuation, anchored opener `foo: &a { … }`, quoted
  // brace `a: "}"`). Over-skipping when ambiguous (a stray brace in a plain scalar arms
  // flow) is the safe direction.
  let flowDepth = 0;
  for (let i = 0; i < contentLines.length; i++) {
    const lineText = contentLines[i];
    if (flowDepth > 0) {
      flowDepth = Math.max(0, flowDepth + flowScan(lineText));
      continue; // inside a multi-line flow value — skip continuation lines
    }
    const indent = leadingWsLen(lineText);
    if (indent === 0) {
      continue; // a column-0 line is the top-level enumerator's job, not here
    }
    const rest = lineText.slice(indent);
    if (rest.startsWith("-") || rest.startsWith("#")) {
      continue; // a block-sequence item / comment hosts no nested mapping value
    }
    // The CONTAINER path (excluding this line's key) via the SAME tested ancestor walk
    // completion uses. `null` ⇒ skip: an unresolvable structure, a non-`format` column-0
    // root, OR a block-scalar/flow intermediate container (`mappingContainerKey` → null
    // on a `key: |` / `key: v` line) — which is what protects block-scalar content (§7.2).
    const parentPath = nestedParentPath(contentLines, i, indent);
    if (parentPath === null) {
      continue;
    }
    // The mapping colon is the FIRST colon at/after the indent (a colon inside the value,
    // e.g. `subtitle: a: b`, stays in the value — mirrors the top-level grammar; a quoted
    // key with an embedded colon is a rare safe false negative, plan §7.9).
    const colon = lineText.indexOf(":", indent);
    if (colon < 0) {
      continue; // no colon → no mapping value to check
    }
    const key = lineText.slice(indent, colon).replace(/[ \t]+$/, "");
    if (key.length === 0) {
      continue; // `: value` with no key — malformed, nothing to resolve
    }
    const valueSlot = valueSlotAfterColon(lineText, colon);
    const rawToken = lineText.slice(valueSlot.startCol, valueSlot.endCol);
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
    // Arm flow tracking if THIS value opens an unclosed flow collection. Evaluated over
    // the WHOLE token (never a first-char `/^[[{]/` test) so an anchored/tagged opener
    // `foo: &a { …` — whose token starts with `&` — still arms (plan §7.1b).
    const delta = flowScan(rawToken);
    if (delta > 0) {
      flowDepth = delta;
    }
  }
  return result;
}

/**
 * Net `{`/`[` opens minus `}`/`]` closes in `s`, counting ONLY characters outside
 * single/double quotes — the QUOTE-AWARE analog of the top-level `netFlowDelta`
 * (plan §3.3 step 2, §7.1). A `\`-escaped char inside a double-quoted scalar and a
 * `''` inside a single-quoted one are consumed, so a quoted brace never miscounts.
 * An unquoted `#` (at the start or whitespace-preceded) begins a YAML comment: the
 * remainder is not flow structure, so counting stops there — which biases toward NOT
 * dropping depth on a `}` hidden in a comment (a safe over-skip). Node properties
 * (`&anchor`/`*alias`/`!tag`) contain no brackets, so they contribute 0 automatically;
 * arming on `flowScan(token) > 0` over the whole token is therefore node-property-aware.
 */
function flowScan(s: string): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote === '"') {
      if (ch === "\\") {
        i++; // consume the escaped character (e.g. `\"`, `\\`)
        continue;
      }
      if (ch === '"') {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        if (s[i + 1] === "'") {
          i++; // `''` is an escaped single quote — stay inside the scalar
          continue;
        }
        quote = null;
      }
      continue;
    }
    // Outside quotes.
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(s[i - 1]))) {
      break; // an unquoted comment — the rest is not flow structure
    }
    if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
    }
  }
  return depth;
}
