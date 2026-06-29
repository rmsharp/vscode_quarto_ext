/**
 * Pure, `vscode`-free YAML completion-position discriminator for a Quarto `.qmd`
 * document (architecture plan §3.3; Phase 6d plan §5.2).
 *
 * Given the document text and a character offset, `completionContextAt` answers
 * "is the cursor at a completable YAML position, and which kind?" — so the thin
 * adapter (`providers/yaml.ts`) can offer the right suggestions and gate itself
 * to YAML regions (the inverse of the `@` cross-ref/citation providers, which
 * gate to prose — Phase 6d plan §4.3). It returns `null` everywhere else (prose,
 * code, value positions not yet supported), so the provider naturally yields no
 * items outside its region.
 *
 * Slices 6d-1/6d-2 implement `cell-option-key` (the `#|` / `//|` key slot) and
 * `cell-option-value` (the slot after the `:`); slices 6d-4/6d-5 add the
 * front-matter complement — `frontmatter-key` (a top-level `---`-block key) and
 * `frontmatter-value` (the slot after that key's colon).
 */

import { findCellOptionLines, inFrontMatter } from "./qmd/model";

/** Which kind of YAML position the cursor is at. */
export type YamlContextKind =
  | "cell-option-key"
  | "cell-option-value"
  | "frontmatter-key"
  | "frontmatter-value";

/** The cell engine a cell-option line belongs to, approximated from the cell language. */
export type CellEngine = "knitr" | "jupyter" | "ojs";

/** A completable YAML position: what to complete, the partial token, and the replace span. */
export interface YamlCompletionContext {
  /** The kind of completion this position calls for. */
  kind: YamlContextKind;
  /** The mapping path to this position; `[]` at the document/cell-option root. */
  parentPath: string[];
  /** The partial key/value text already typed from the slot start to the cursor (may be `""`). */
  token: string;
  /**
   * The half-open span `[startCol, endCol)` on `line` that accepting a completion
   * replaces — the whole token, not just up to the cursor, so a mid-token accept
   * does not duplicate the trailing suffix (Learning #15b).
   */
  replaceRange: { line: number; startCol: number; endCol: number };
  /** For cell-option positions: the owning cell's engine (approximated from `cell.lang`). */
  engine?: CellEngine;
}

/**
 * The completion context at 0-based character `offset` in `text`, or `null` if
 * the cursor is not at a YAML position these slices complete. A position is
 * completable when the cursor is on a `#|` / `//|` cell-option line — within the
 * key slot (`cell-option-key`) or the value slot after the `:` (`cell-option-value`)
 * — or on a top-level front-matter line, within its key slot (`frontmatter-key`)
 * or value slot (`frontmatter-value`). A prose or code line, an indented/sequence
 * line, or the whitespace gap before a value all yield `null`.
 */
export function completionContextAt(
  text: string,
  offset: number,
): YamlCompletionContext | null {
  const { line, col } = lineColAt(text, offset);
  const lineText = text.split(/\r?\n/)[line] ?? "";

  const optLine = findCellOptionLines(text).find((o) => o.line === line);
  if (optLine === undefined) {
    // Not a `#|` / `//|` cell-option line. The only other completable YAML region
    // is the document's front matter (top-level keys — 6d-4); everywhere else
    // (prose, code) yields null, preserving the inverse-gating contract (§4.3).
    return inFrontMatter(text, line)
      ? frontMatterContextAt(text, line, col)
      : null;
  }
  const key = optLine.keySlot;
  const engine = engineFor(optLine.cellLang);

  // Key context while the cursor is within the key slot (≤ the colon).
  if (key !== null && col >= key.startCol && col <= key.endCol) {
    return {
      kind: "cell-option-key",
      parentPath: [],
      token: lineText.slice(key.startCol, col),
      replaceRange: { line, startCol: key.startCol, endCol: key.endCol },
      engine,
    };
  }

  // Value context while the cursor is within the value slot (after the colon).
  // `parentPath` carries the key being valued (plan §5.2). A cursor in the
  // whitespace gap before the value (col < value.startCol) falls through to null.
  const value = optLine.valueSlot;
  if (key !== null && value !== null && col >= value.startCol && col <= value.endCol) {
    return {
      kind: "cell-option-value",
      parentPath: [lineText.slice(key.startCol, key.endCol)],
      token: lineText.slice(value.startCol, col),
      replaceRange: { line, startCol: value.startCol, endCol: value.endCol },
      engine,
    };
  }
  return null;
}

/**
 * The front-matter KEY or VALUE context at character `col` on line `line` of
 * `text` (already known to be a front-matter content line), or `null` if the
 * cursor is not in a completable slot. A top-level (column-0) mapping completes
 * its key slot (at or before the `:` — `frontmatter-key`, 6d-4) and value slot
 * (after the `:` — `frontmatter-value`, 6d-5), with `parentPath` carrying the key
 * being valued. An INDENTED line falls through to `nestedKeyContextAt` (6d-6),
 * which completes a nested key one level under an allow-listed container. A
 * sequence/comment line, or the whitespace gap before a value, yields `null`.
 */
function frontMatterContextAt(
  text: string,
  line: number,
  col: number,
): YamlCompletionContext | null {
  const lines = text.split(/\r?\n/);
  const lineText = lines[line] ?? "";
  const { keySlot, valueSlot } = topLevelSlots(lineText);
  if (keySlot === null) {
    // Not a top-level mapping line. The only other completable front-matter
    // position is a nested key one level under an allow-listed container (6d-6).
    return nestedKeyContextAt(lines, line, col);
  }
  if (col >= keySlot.startCol && col <= keySlot.endCol) {
    return {
      kind: "frontmatter-key",
      parentPath: [],
      token: lineText.slice(keySlot.startCol, col),
      replaceRange: { line, startCol: keySlot.startCol, endCol: keySlot.endCol },
    };
  }
  if (valueSlot !== null && col >= valueSlot.startCol && col <= valueSlot.endCol) {
    return {
      kind: "frontmatter-value",
      parentPath: [lineText.slice(keySlot.startCol, keySlot.endCol)],
      token: lineText.slice(valueSlot.startCol, col),
      replaceRange: { line, startCol: valueSlot.startCol, endCol: valueSlot.endCol },
    };
  }
  return null;
}

/**
 * The nested front-matter KEY context for an indented line whose enclosing
 * container is one of `NESTED_CONTAINERS` (Slice 6d-6, the "cheap one-level
 * approximation"), or `null`. The detector is deliberately conservative — it
 * offers nested keys ONLY when nesting is unambiguous, and **bails (`null`) on
 * anything else** rather than offer wrong keys (plan §7): the line must be an
 * indented key line (not a `- ` sequence item or a `#` comment); its parent must
 * be a column-0, allow-listed key (one level only — a deeper or non-allow-listed
 * parent yields `null`); and the parent must be a *pure mapping container* (no
 * scalar / block-scalar `|`,`>` / flow `[`,`{` value). Only the key slot completes;
 * a cursor past the colon (a nested value) yields `null` (deferred to a later slice).
 */
function nestedKeyContextAt(
  lines: string[],
  line: number,
  col: number,
): YamlCompletionContext | null {
  const lineText = lines[line] ?? "";
  const indented = /^([ \t]+)(.*)$/.exec(lineText);
  if (indented === null) {
    return null; // a column-0 line is handled by the top-level path, not here
  }
  const indent = indented[1].length;
  const rest = indented[2];
  if (rest.startsWith("-") || rest.startsWith("#")) {
    return null; // a block-sequence item / comment hosts no nested key
  }
  const parent = nearestShallowerLine(lines, line, indent);
  if (parent === null) {
    return null;
  }
  // One level only: the container must be a column-0 mapping key.
  if (/^[ \t]/.test(parent) || parent.startsWith("-") || parent.startsWith("#")) {
    return null;
  }
  const pColon = parent.indexOf(":");
  if (pColon < 0) {
    return null;
  }
  const parentKey = parent.slice(0, pColon).replace(/[ \t]+$/, "");
  if (!NESTED_CONTAINERS.has(parentKey)) {
    return null;
  }
  // The container must be a pure mapping: nothing but an optional comment after
  // the colon. A scalar (`execute: false`), block scalar (`|`/`>`), or flow
  // (`[…]`/`{…}`) value means this is not a one-level mapping we can complete.
  const parentValue = parent.slice(pColon + 1).replace(/^[ \t]+/, "");
  if (parentValue !== "" && !parentValue.startsWith("#")) {
    return null;
  }
  const nlColon = lineText.indexOf(":", indent);
  const keyText = (
    nlColon >= 0 ? lineText.slice(indent, nlColon) : lineText.slice(indent)
  ).replace(/[ \t]+$/, "");
  const keySlot: Slot = { startCol: indent, endCol: indent + keyText.length };
  if (col < keySlot.startCol || col > keySlot.endCol) {
    return null; // the gap before / a value position past the colon — nested values deferred
  }
  return {
    kind: "frontmatter-key",
    parentPath: [parentKey],
    token: lineText.slice(keySlot.startCol, col),
    replaceRange: { line, startCol: keySlot.startCol, endCol: keySlot.endCol },
  };
}

/**
 * The text of the nearest line above `line` whose indentation is strictly less
 * than `indent`, skipping blank and comment lines, or `null` if none — the
 * enclosing-mapping candidate for `nestedKeyContextAt`. Lines at or deeper than
 * `indent` (siblings or deeper structure) are skipped so an intervening deeper
 * block does not hide the real parent.
 */
function nearestShallowerLine(
  lines: string[],
  line: number,
  indent: number,
): string | null {
  for (let i = line - 1; i >= 0; i--) {
    const t = lines[i] ?? "";
    if (t.trim() === "") {
      continue;
    }
    const lead = (/^[ \t]*/.exec(t)?.[0].length) ?? 0;
    if (t.slice(lead).startsWith("#")) {
      continue;
    }
    if (lead < indent) {
      return t;
    }
  }
  return null;
}

/**
 * Front-matter mapping keys whose children are completed one level deep (Slice
 * 6d-6). Limited to `execute` for v1: its child set is well-known and stable, so
 * a curated set is faithful (the live schema assembles it across multiple files —
 * deferred). `format:` (format names) and deeper nesting are later slices.
 */
const NESTED_CONTAINERS = new Set<string>(["execute"]);

type Slot = { startCol: number; endCol: number };

/**
 * The top-level key and value token spans on a front-matter line, or both `null`
 * if the line cannot host a top-level mapping. A top-level key starts at column 0
 * (no indentation) and runs to the first `:` (trailing whitespace before the
 * colon excluded). An indented line is a nested key (deferred to 6d-6); a `- …`
 * line is a block-sequence item; a `# …` line is a YAML comment — none host a
 * top-level key, so all yield `{ null, null }`. The value span (when a `:` is
 * present) starts after the colon with leading whitespace skipped and a trailing
 * unquoted inline comment / whitespace excluded — the same grammar the
 * cell-option `slotsOf` (`core/qmd/model`) applies to a `#|` value.
 */
function topLevelSlots(
  lineText: string,
): { keySlot: Slot | null; valueSlot: Slot | null } {
  if (/^[ \t]/.test(lineText) || lineText.startsWith("-") || lineText.startsWith("#")) {
    return { keySlot: null, valueSlot: null };
  }
  const colon = lineText.indexOf(":");
  const keyText = (colon >= 0 ? lineText.slice(0, colon) : lineText).replace(
    /[ \t]+$/,
    "",
  );
  const keySlot: Slot = { startCol: 0, endCol: keyText.length };
  if (colon < 0) {
    return { keySlot, valueSlot: null };
  }
  const afterColon = colon + 1;
  const region = lineText.slice(afterColon);
  const wsLen = (region.match(/^[ \t]*/) ?? [""])[0].length;
  let valueRaw = region.slice(wsLen);
  // Strip an unquoted trailing YAML inline comment (mirrors `slotsOf`): a `#`
  // begins a comment when at the value start or whitespace-preceded. Quoted
  // scalars are left intact; enum/boolean values never contain `#`, so this only
  // narrows the span for the commented case.
  if (!/^["']/.test(valueRaw)) {
    const c = valueRaw.startsWith("#") ? 0 : valueRaw.search(/\s#/);
    if (c >= 0) {
      valueRaw = valueRaw.slice(0, c);
    }
  }
  const valueText = valueRaw.replace(/\s+$/, "");
  const valueStart = afterColon + wsLen;
  return {
    keySlot,
    valueSlot: { startCol: valueStart, endCol: valueStart + valueText.length },
  };
}

/**
 * The cell engine for a cell language: knitr for `{r}`, jupyter for
 * `{python}`/`{julia}`, ojs for `{ojs}`/`{js}`. An unrecognized language yields
 * `undefined` (engine-agnostic) — a benign over-offer, refined in a later slice.
 */
function engineFor(lang: string): CellEngine | undefined {
  switch (lang.toLowerCase()) {
    case "r":
      return "knitr";
    case "python":
    case "julia":
      return "jupyter";
    case "ojs":
    case "js":
      return "ojs";
    default:
      return undefined;
  }
}

/**
 * The 0-based (line, col) of `offset` in `text`, counting `\n` as the line break
 * (matching `vscode.TextDocument.offsetAt`, which walks the raw buffer). A `\r`
 * before a `\n` belongs to the preceding line, so columns within a `\r\n` line
 * agree with the model's `\r?\n`-split line text for any cursor before the `\r`.
 */
function lineColAt(text: string, offset: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: clamped - lineStart };
}
