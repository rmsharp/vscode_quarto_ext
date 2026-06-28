/**
 * Pure, `vscode`-free cross-reference index for a Quarto `.qmd` document
 * (architecture plan §3.3, Phase 6b).
 *
 * A Quarto cross-reference is `@<kind>-<name>` (e.g. `@fig-plot`, `@sec-intro`).
 * This module finds where each such label is *defined* — so the adapter
 * (`providers/crossref.ts`) can offer completions on `@` and resolve
 * go-to-definition from a `@ref` to its label. It builds its index entirely on
 * top of the shared region model (`core/qmd/model`); it never re-scans the
 * document's skip-regions itself (the single-scanner rule — Learning #14).
 *
 * Labels come from three structural sources:
 *   1. `sec-` ids on ATX headings — `## Methods {#sec-methods}` (model `Heading.id`).
 *   2. `#| label: fig-…` cell options inside `{python}`/`{r}` cells (model cells).
 *   3. Inline `{#fig-…}`/`{#tbl-…}`/`{#eq-…}`/`{#lst-…}` attribute blocks on
 *      images, divs, and display equations in prose (model body lines).
 */

import {
  findAllCells,
  findBodyLines,
  findHeadings,
  maskInlineCode,
} from "./qmd/model";

/** The cross-reference kinds Quarto recognizes that this index supports. */
export type RefKind = "fig" | "tbl" | "sec" | "eq" | "lst";

/** Where an in-progress `@…` cross-reference begins, and what has been typed so far. */
export interface RefCompletionContext {
  /** 0-based column of the `@` that starts the reference being typed. */
  start: number;
  /** The id text typed between the `@` and the cursor (may be `""`). */
  typed: string;
  /**
   * 0-based column just past the end of the id token (id characters continue
   * past the cursor when editing mid-token). The provider replaces `[start, end)`
   * so accepting a completion does not duplicate a trailing suffix.
   */
  end: number;
}

/** A cross-reference label definition found in the document. */
export interface RefLabel {
  /** The full label id, e.g. `"fig-plot"`, `"sec-methods"`. */
  id: string;
  /** The cross-reference kind, derived from the id's prefix. */
  kind: RefKind;
  /** 0-based line where the label is defined. */
  line: number;
  /** 0-based column where the id text begins (for precise go-to-definition). */
  column: number;
}

/** A label id begins with a recognized cross-ref kind prefix, then `-`, then a name. */
const KIND_PREFIX = /^(fig|tbl|sec|eq|lst)-/;
/**
 * A Quarto cell-option line declaring a label: `#| label: fig-plot` (or `//|`
 * for ojs/js cells), with an optional surrounding YAML quote. Group 1 is the id,
 * matched with the same character class as inline labels so it stops at quotes
 * and trailing punctuation (an over-greedy `\S+` kept a stray `.` in the id, or
 * dropped a quoted value whole). Because the pattern is anchored at `^`, the id's
 * column is `match[0].length - id.length`.
 */
const CELL_LABEL_OPTION =
  /^\s*(?:#|\/\/)\|\s*label:\s*["']?([A-Za-z0-9_][A-Za-z0-9_-]*)/;
/**
 * An inline Pandoc attribute block declaring a cross-ref id on an image, div, or
 * display equation: `…){#fig-plot}`, `::: {#tbl-x}`, `$$ … $$ {#eq-y}`. Group 1
 * is the id; its column is `match.index + 2` (past the `{#`). `sec-` is excluded
 * on purpose — section labels are owned by headings (Source 1), so a stray
 * inline `{#sec-…}` is not double-counted.
 */
const INLINE_LABEL = /\{#((?:fig|tbl|eq|lst)-[A-Za-z0-9_][A-Za-z0-9_-]*)/g;
/**
 * A cross-reference *usage* — `@fig-plot`, `@sec-intro`. The negative lookbehind
 * rejects an `@` preceded by a word character (so `user@fig-x.org` is an email,
 * not a reference — the Pandoc rule), and restricting to known kind prefixes
 * leaves bare `@key` citations (Phase 6c) untouched. Group 1 is the id.
 */
const REF_USAGE = /(?<![A-Za-z0-9_])@((?:fig|tbl|sec|eq|lst)-[A-Za-z0-9_-]+)/g;

/** The cross-ref kind of an id, or `null` if its prefix is not a cross-ref kind. */
function kindOf(id: string): RefKind | null {
  const m = KIND_PREFIX.exec(id);
  return m ? (m[1] as RefKind) : null;
}

/**
 * Index every cross-reference label defined in `text`, in document order. Where
 * the same id is defined more than once, only the first definition is kept.
 */
export function indexLabels(text: string): RefLabel[] {
  const labels: RefLabel[] = [];
  const headingLines = new Set<number>();

  // Source 1 — `sec-` ids on headings. (Headings only ever define sections.)
  for (const heading of findHeadings(text)) {
    headingLines.add(heading.line);
    if (!heading.id || kindOf(heading.id) !== "sec") {
      continue;
    }
    labels.push({
      id: heading.id,
      kind: "sec",
      line: heading.line,
      column: idColumn(text, heading.line, heading.id),
    });
  }

  // Source 2 — `#| label: <id>` options inside executable code cells.
  for (const cell of findAllCells(text)) {
    const bodyLines = cell.code.length === 0 ? [] : cell.code.split("\n");
    bodyLines.forEach((lineText, j) => {
      const m = CELL_LABEL_OPTION.exec(lineText);
      if (!m) {
        return;
      }
      const value = m[1];
      const kind = kindOf(value);
      if (kind === null) {
        return;
      }
      labels.push({
        id: value,
        kind,
        line: cell.startLine + 1 + j,
        column: m[0].length - value.length,
      });
    });
  }

  // Source 3 — inline `{#fig-…}`/`{#tbl-…}`/`{#eq-…}`/`{#lst-…}` attribute
  // blocks on prose body lines (images, divs, display equations). Heading lines
  // are body lines too, but a non-sec id on a heading is not a figure/table —
  // headings contribute labels only through Source 1, so skip them here.
  for (const { line, text: rawText } of findBodyLines(text)) {
    if (headingLines.has(line)) {
      continue;
    }
    // Mask inline code spans (length-preserving) so a `{#fig-…}` shown literally
    // in backticks is not indexed; column offsets stay valid.
    const lineText = maskInlineCode(rawText);
    INLINE_LABEL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE_LABEL.exec(lineText)) !== null) {
      const id = m[1];
      const kind = kindOf(id);
      if (kind !== null) {
        labels.push({ id, kind, line, column: m.index + 2 });
      }
    }
  }

  // The three sources are collected in source order; present them in document
  // order and keep only the first definition of any repeated id.
  labels.sort((a, b) => a.line - b.line || a.column - b.column);
  return dedupeById(labels);
}

/** The label defined with `id` in `text`, or `null` if none. Drives go-to-definition. */
export function findLabel(text: string, id: string): RefLabel | null {
  return indexLabels(text).find((label) => label.id === id) ?? null;
}

/**
 * Whether 0-based `line` is a prose or heading line — where cross-references
 * apply. False inside code cells, YAML front matter, and HTML comments, where an
 * `@` is a decorator/macro/email and a `{#…}` is literal. Gates the providers so
 * completion does not pop and go-to-definition does not fire in non-prose regions.
 */
export function isReferenceableLine(text: string, line: number): boolean {
  return findBodyLines(text).some((body) => body.line === line);
}

/**
 * The cross-reference id of the `@ref` token at 0-based `column` on `lineText`,
 * or `null` if the cursor is not within one. The cursor counts as inside the
 * token from its `@` through one past its last character (so it resolves whether
 * you click the start, middle, or end). Drives go-to-definition.
 */
export function refIdAt(lineText: string, column: number): string | null {
  REF_USAGE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_USAGE.exec(lineText)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (column >= start && column <= end) {
      return m[1];
    }
  }
  return null;
}

/** A single character that may appear in a cross-ref id (after the `@`). */
const ID_CHAR = /[A-Za-z0-9_-]/;
/** A word character that, immediately before an `@`, marks it as an email — not a reference. */
const WORD_CHAR = /[A-Za-z0-9_]/;

/**
 * If 0-based `column` on `lineText` sits at the end of an in-progress `@…`
 * cross-reference (a bare `@`, or `@` followed only by id characters up to the
 * cursor), return where the `@` is and the id typed so far; otherwise `null`.
 * An `@` preceded by a word character is an email address, not a reference.
 * Drives completion (the `start` is where the inserted `@id` replaces from).
 */
export function crossrefCompletionContext(
  lineText: string,
  column: number,
): RefCompletionContext | null {
  let i = column - 1;
  while (i >= 0 && ID_CHAR.test(lineText[i])) {
    i--;
  }
  if (i < 0 || lineText[i] !== "@") {
    return null;
  }
  if (i > 0 && WORD_CHAR.test(lineText[i - 1])) {
    return null;
  }
  // Walk forward over any id characters the cursor is sitting inside, so the
  // whole `@id` token (not just up to the cursor) can be replaced on accept.
  let end = column;
  while (end < lineText.length && ID_CHAR.test(lineText[end])) {
    end++;
  }
  return { start: i, typed: lineText.slice(i + 1, column), end };
}

/** Keep only the first `RefLabel` for each id, preserving order. */
function dedupeById(labels: RefLabel[]): RefLabel[] {
  const seen = new Set<string>();
  return labels.filter((label) => {
    if (seen.has(label.id)) {
      return false;
    }
    seen.add(label.id);
    return true;
  });
}

/**
 * The 0-based column where `#<id>` resolves to the start of `<id>` on `line`, or
 * 0 if it cannot be located (defensive — go-to-definition still lands on the line).
 * Uses the LAST occurrence: the `{#id}` attribute block is trailing, so an
 * identical `#id` substring appearing earlier on the line (e.g. inside an inline
 * code span or quoted in the heading text) must not win.
 */
function idColumn(text: string, line: number, id: string): number {
  const lineText = text.split(/\r?\n/)[line] ?? "";
  const hashIndex = lineText.lastIndexOf(`#${id}`);
  return hashIndex >= 0 ? hashIndex + 1 : 0;
}
