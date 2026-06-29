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
 * `cell-option-value` (the slot after the `:`). The front-matter kinds are
 * reserved for later slices.
 */

import { findCellOptionLines, inFrontMatter } from "./qmd/model";

/** Which kind of YAML position the cursor is at (only `cell-option-key` is live in 6d-1). */
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
 * completable when the cursor is on a `#|` / `//|` cell-option line, within
 * either the key slot (after the prefix, at or before the `:` — `cell-option-key`)
 * or the value slot (after the `:` — `cell-option-value`). A prose or code line,
 * a sequence-item line, or the whitespace gap before a value all yield `null`.
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
      ? frontMatterKeyContextAt(lineText, line, col)
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
 * The front-matter top-level KEY context at column `col` on `lineText` (already
 * known to be a front-matter content line), or `null` if the cursor is not in a
 * top-level key slot. Only column-0 keys are completed in 6d-4; a cursor past the
 * `:` is a value position (deferred to 6d-5), so it falls through to `null`.
 */
function frontMatterKeyContextAt(
  lineText: string,
  line: number,
  col: number,
): YamlCompletionContext | null {
  const slot = topLevelKeySlot(lineText);
  if (slot === null || col < slot.startCol || col > slot.endCol) {
    return null;
  }
  return {
    kind: "frontmatter-key",
    parentPath: [],
    token: lineText.slice(slot.startCol, col),
    replaceRange: { line, startCol: slot.startCol, endCol: slot.endCol },
  };
}

/**
 * The top-level key token span on a front-matter line, or `null` if the line
 * cannot host a top-level key. A top-level key starts at column 0 (no
 * indentation) and runs to the first `:` (trailing whitespace before the colon
 * excluded). An indented line is a nested key (deferred to 6d-6); a `- …` line is
 * a block-sequence item; a `# …` line is a YAML comment — none host a top-level
 * key, so all yield `null`.
 */
function topLevelKeySlot(
  lineText: string,
): { startCol: number; endCol: number } | null {
  if (/^[ \t]/.test(lineText) || lineText.startsWith("-") || lineText.startsWith("#")) {
    return null;
  }
  const colon = lineText.indexOf(":");
  const keyText = (colon >= 0 ? lineText.slice(0, colon) : lineText).replace(
    /[ \t]+$/,
    "",
  );
  return { startCol: 0, endCol: keyText.length };
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
