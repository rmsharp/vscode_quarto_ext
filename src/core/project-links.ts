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
 * The value-token span on a `key: value` mapping line or a `- value` block-
 * sequence item, or `null` when the line is neither. Reuses the ONE existing
 * value-token grammar in this codebase — `yaml-context.ts`'s `valueSlotAfterColon`
 * (leading-ws skip, quote-aware, trailing-comment trim) — for both shapes, since
 * a `:` and a `- ` marker are both single-char delimiters the value follows
 * (plan §2.5; S79 gotcha #4: reuse the grammar, never re-derive a divergent one).
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
    return valueSlotAfterColon(raw, indent); // dash position as the value delimiter
  }
  const colon = content.indexOf(":");
  if (colon < 0) {
    return null; // not a mapping line
  }
  return valueSlotAfterColon(raw, indent + colon);
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
