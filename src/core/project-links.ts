/**
 * Pure, `vscode`-free scanner for candidate file-path VALUE tokens in a bare
 * `_quarto.yml`/`_quarto.yaml` document (item 14 plan §2.5/§5.1).
 *
 * `_quarto.yml` is a bare YAML file — no `---` fences — so `qmd/model.ts`'s
 * fence-anchored scanning does not apply. `findPathValueCandidates` walks every
 * line and, for each `key: value` scalar or `- value` block-sequence item at ANY
 * indentation depth (whole-document scope, plan §0), emits the value token's
 * on-screen span and its unquoted text. The caller (a `DocumentLinkProvider`
 * adapter) decides which of these actually resolve to a real file/directory —
 * existence-checking is the entire safety mechanism (plan §2.1), so this pure
 * layer makes no filesystem or schema query at all.
 */

import { leadingWsLen, valueSlotAfterColon } from "./yaml-context";

/** One candidate VALUE token that MIGHT be a file path (plan §5.1). */
export interface PathValueCandidate {
  line: number;
  /** The value token's on-screen half-open span `[startCol, endCol)`. */
  valueRange: { startCol: number; endCol: number };
  /** The token text with one matching layer of surrounding quotes stripped. */
  token: string;
}

/** YAML boolean literals — never a path, cheaply excluded up front (plan §9 Q5). */
const YAML_BOOLEANS = new Set(["true", "false"]);

/**
 * The value-position context at `(line, col)` in a bare `_quarto.yml` document,
 * or `null` when the cursor is not in a completable value slot — a key position,
 * a comment, or a non-mapping/non-sequence line (plan §5.1/§2.6, Slice 2).
 *
 * `token` is the value-so-far (the value-token text up to the cursor); the caller
 * (a `CompletionItemProvider` adapter) splits it at the last `/` to pick the
 * directory to list. `replaceRange` spans the whole value token on the line — the
 * same "replacing" convention `providers/yaml.ts` uses — so accepting an item
 * overwrites the existing value rather than duplicating a suffix.
 */
export interface ProjectLinkValueContext {
  token: string;
  replaceRange: { line: number; startCol: number; endCol: number };
}

/**
 * Detect whether the cursor at `(line, col)` sits in a value slot and, if so,
 * return the value-so-far token and the value token's on-screen span. Only the
 * cursor's own line is inspected (no whole-document walk — plan §2.6). Reuses the
 * same value-token grammar as `findPathValueCandidates` (`mappingColonIndex` +
 * `valueSlotAfterColon`) so the two never disagree on where a value begins.
 */
export function valueContextAt(
  text: string,
  line: number,
  col: number,
): ProjectLinkValueContext | null {
  const lines = text.split(/\r?\n/);
  if (line < 0 || line >= lines.length) {
    return null;
  }
  const raw = lines[line];
  const indent = leadingWsLen(raw);
  const content = raw.slice(indent);
  if (content === "" || content.startsWith("#")) {
    return null; // blank / comment line — no value slot
  }
  let colonAbs: number;
  if (content.startsWith("-")) {
    // A block-sequence item needs `- ` (dash + whitespace); `-x`/`-` have no value.
    if (content.length < 2 || !/\s/.test(content[1])) {
      return null;
    }
    // A `- key: value` inline mapping (the navbar/sidebar `- href:` / book
    // `- part:` shape) completes the mapping's VALUE; a bare `- value` scalar uses
    // the dash itself as the value delimiter (mirrors `valueSpanOf`, §2.5/§2.6).
    const wsAfterDash = /^\s*/.exec(content.slice(1))?.[0].length ?? 0;
    const rest = content.slice(1 + wsAfterDash);
    const mc = mappingColonIndex(rest);
    colonAbs = mc >= 0 ? indent + 1 + wsAfterDash + mc : indent;
  } else {
    const mc = mappingColonIndex(content);
    if (mc < 0) {
      return null; // not a mapping line
    }
    colonAbs = indent + mc;
  }
  if (col <= colonAbs) {
    return null; // cursor at or before the delimiter — a key position, not a value slot
  }
  const slot = valueSlotAfterColon(raw, colonAbs);
  const startCol = col < slot.startCol ? col : slot.startCol;
  const endCol = Math.max(slot.endCol, col);
  return { token: raw.slice(startCol, col), replaceRange: { line, startCol, endCol } };
}

/**
 * Enumerate every candidate scalar / sequence-item value in `text`. Skips
 * blank/comment lines, pure-mapping container lines (`key:` with an empty value),
 * and boolean-literal tokens. Numbers are NOT excluded — a numbered file like
 * `1.qmd` in a `chapters:` list is plausible (plan §9 Q5). Pure and `vscode`-free.
 */
export function findPathValueCandidates(text: string): PathValueCandidate[] {
  const candidates: PathValueCandidate[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const indent = leadingWsLen(raw);
    const content = raw.slice(indent);
    if (content === "" || content.startsWith("#")) {
      continue; // blank / comment line
    }
    const slot = valueSpanOf(raw, content, indent);
    if (slot === null || slot.endCol <= slot.startCol) {
      continue; // not a value-bearing line, or an empty-value container line
    }
    const token = unquote(raw.slice(slot.startCol, slot.endCol));
    if (token === "" || YAML_BOOLEANS.has(token.toLowerCase())) {
      continue;
    }
    candidates.push({
      line: i,
      valueRange: { startCol: slot.startCol, endCol: slot.endCol },
      token,
    });
  }
  return candidates;
}

/**
 * The value-token span on a `key: value` mapping line, a `- value` block-
 * sequence scalar, or a `- key: value` inline-mapping sequence item (the
 * dominant navbar/sidebar `- href:`/book `- part:` shape), or `null` when the
 * line is none of these. Reuses the ONE existing value-token grammar in this
 * codebase — `yaml-context.ts`'s `valueSlotAfterColon` (leading-ws skip,
 * quote-aware, trailing-comment trim) — anchored at the mapping colon (§2.5;
 * S79 gotcha #4: reuse the grammar, never re-derive a divergent one).
 */
function valueSpanOf(
  raw: string,
  content: string,
  indent: number,
): { startCol: number; endCol: number } | null {
  if (content.startsWith("-")) {
    // A block-sequence item needs `- ` (dash + whitespace); `-x` is a scalar and
    // a lone `-` is an empty item — neither is a linkable value here.
    if (content.length < 2 || !/\s/.test(content[1])) {
      return null;
    }
    // The item may be a bare scalar (`- data/raw.csv`) or an inline mapping
    // (`- href: page.qmd`). If a mapping colon follows the marker, the value is
    // that mapping's value; otherwise the whole post-marker scalar is the value.
    const wsAfterDash = /^\s*/.exec(content.slice(1))?.[0].length ?? 0;
    const rest = content.slice(1 + wsAfterDash);
    const mc = mappingColonIndex(rest);
    if (mc >= 0) {
      return valueSlotAfterColon(raw, indent + 1 + wsAfterDash + mc);
    }
    return valueSlotAfterColon(raw, indent); // dash position as the value delimiter
  }
  const mc = mappingColonIndex(content);
  if (mc < 0) {
    return null; // not a mapping line (a plain scalar, or `key:value` with no space)
  }
  return valueSlotAfterColon(raw, indent + mc);
}

/**
 * The index of the first colon in `s` that acts as a YAML block-mapping key
 * separator — a `:` immediately followed by whitespace or end-of-string — or
 * `-1` if none. A colon followed by a non-space (e.g. inside `http://…` or a
 * `key:value`-no-space plain scalar) is NOT a mapping separator, so this avoids
 * the naive `indexOf(":")` mis-parse (a scalar with an embedded colon, or a
 * colon inside a simple quoted key like `"a:b":`).
 */
function mappingColonIndex(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ":" && (i + 1 === s.length || /\s/.test(s[i + 1]))) {
      return i;
    }
  }
  return -1;
}

/** Strip one matching layer of surrounding YAML quotes (`"x"` / `'x'`). */
function unquote(token: string): string {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return token.slice(1, -1);
    }
  }
  return token;
}
