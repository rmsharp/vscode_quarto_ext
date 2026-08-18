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
 * A character that may stand alone anywhere in a cross-reference id — Pandoc's
 * "regchar": a Unicode letter or digit, or `_`.
 *
 * ⚠ **UNICODE ON PURPOSE, AND MEASURED.** `# Cafe {#sec-café}` + `@sec-café` renders
 * `<a href="#sec-café" class="quarto-xref">` (`scratchpad/s220/cal/rt.qmd` R03), and an
 * undefined `@sec-日本` echoes the whole token back as `?@sec-日本` (`cal/cal.qmd` t11).
 */
const REF_ID_REGCHAR = String.raw`[\p{L}\p{N}_]`;
/**
 * Punctuation a cross-reference id may hold **internally** — Pandoc's internal-punctuation
 * set, admitted only when a {@link REF_ID_REGCHAR} follows it.
 *
 * ⚠ **THE FOLLOWER CLAUSE IS THE WHOLE RULE, NOT A REFINEMENT OF IT.** It is what keeps
 * a token from eating trailing sentence punctuation (`@sec-intro.` is `sec-intro`,
 * `cal/cal.qmd` t05/t36) and what breaks a token at a doubled run (`@sec-a..b` is `sec-a`,
 * t12 — one of the two rows that corrected this rule from the shape first predicted for it).
 * Session 220 measured all 12 characters of the set individually rather than porting them:
 * `:` `.` `#` `$` `%` `&` `+` `?` `<` `>` `~` `/` and `-`.
 */
const REF_ID_PUNCT = String.raw`[:.#$%&+?<>~/-]`;
/**
 * A cross-reference *usage* — `@fig-plot`, `@sec-intro`, `@sec-meth:ods`. The negative
 * lookbehind rejects an `@` preceded by a word character (so `user@fig-x.org` is an email,
 * not a reference), and restricting to known kind prefixes leaves bare `@key` citations
 * (Phase 6c) untouched. Group 1 is the id.
 *
 * The id is Pandoc's `citeKey` — a regchar, then any run of (regchar | internal punctuation
 * immediately followed by a regchar) — measured over 55 rendered rows in Session 220 and
 * frozen as predictions before rendering (`scratchpad/s220/PREDICTIONS{,2}.tsv`, 38/40 then
 * 15/15). The kind prefix's own `-` takes the same follower rule, so `@sec-` alone and
 * `@sec-.x` are not references at all.
 *
 * ⚠ **DELIBERATELY NOT THE LOOKBEHIND'S SET.** Pandoc's real precondition is
 * `notAfterString`, not a character class: `_@sec-x` IS a reference, while `café@sec-x`,
 * `日本@sec-x` and `.@sec-x` are NOT, and `-@sec-x` is the suppress-author citation form
 * (all measured, `scratchpad/s220/cal/lb.qmd`). Session 220 left the ASCII class exactly as
 * it found it so no row moves; the divergence is a separate filed item.
 */
const REF_USAGE = new RegExp(
  String.raw`(?<![A-Za-z0-9_])@((?:fig|tbl|sec|eq|lst)-(?=${REF_ID_REGCHAR})` +
    String.raw`(?:${REF_ID_REGCHAR}|${REF_ID_PUNCT}(?=${REF_ID_REGCHAR}))*)`,
  "gu",
);

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

/** {@link REF_ID_REGCHAR} as a testable single-character pattern. */
const REGCHAR = new RegExp(REF_ID_REGCHAR, "u");
/** {@link REF_ID_PUNCT} as a testable single-character pattern. */
const PUNCT = new RegExp(REF_ID_PUNCT, "u");
/** A word character that, immediately before an `@`, marks it as an email — not a reference. */
const WORD_CHAR = /[A-Za-z0-9_]/;

/**
 * Whether the id token continues at `at` on `lineText` — a regchar, or internal
 * punctuation with a regchar immediately after it (the measured Pandoc rule; see
 * {@link REF_ID_PUNCT}). This is what stops a token before trailing sentence
 * punctuation, so the replace range never eats an `@ref`'s closing `.`.
 */
function idContinuesAt(lineText: string, at: number): boolean {
  const ch = lineText[at];
  if (ch === undefined) {
    return false;
  }
  if (REGCHAR.test(ch)) {
    return true;
  }
  const next = lineText[at + 1];
  return PUNCT.test(ch) && next !== undefined && REGCHAR.test(next);
}

/**
 * If 0-based `column` on `lineText` sits at the end of an in-progress `@…`
 * cross-reference (a bare `@`, or `@` followed only by id characters up to the
 * cursor), return where the `@` is and the id typed so far; otherwise `null`.
 * An `@` preceded by a word character is an email address, not a reference.
 * Drives completion (the `start` is where the inserted `@id` replaces from).
 *
 * ⚠ **THE TWO SCANS ANSWER DIFFERENT QUESTIONS AND SESSION 220 MEASURED THEM SEPARATELY.**
 * The BACKWARD scan only has to find the `@`, so it walks any character a token could hold —
 * over-reaching there costs at most a `typed` that filters to no completions. The FORWARD
 * scan sets the REPLACE range, so it applies the full rule: an over-wide `end` would make an
 * accepted completion swallow the sentence's punctuation.
 *
 * ⚠ **BEFORE SESSION 220 THIS SURFACE DID NOT TRUNCATE — IT DIED.** The old scanner walked
 * `[A-Za-z0-9_-]`, so on `@sec-meth:o` the backward walk stopped ON the colon, never reached
 * the `@`, and returned `null`: once an author typed a `:` they were offered nothing at all.
 * Measured on the pre-session build (`scratchpad/s220/pre/probe220.test.ts`); the filed item
 * described only the truncation, and this is the half no id-only comparison can see.
 */
export function crossrefCompletionContext(
  lineText: string,
  column: number,
): RefCompletionContext | null {
  let i = column - 1;
  while (i >= 0 && (REGCHAR.test(lineText[i]) || PUNCT.test(lineText[i]))) {
    i--;
  }
  if (i < 0 || lineText[i] !== "@") {
    return null;
  }
  if (i > 0 && WORD_CHAR.test(lineText[i - 1])) {
    return null;
  }
  // Walk forward over the rest of the token the cursor is sitting inside, so the
  // whole `@id` (not just up to the cursor) can be replaced on accept.
  let end = column;
  while (end < lineText.length && idContinuesAt(lineText, end)) {
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
 * Pandoc's ATTRIBUTE-BLOCK identifier character set — the same one `ATTR_ID_ALL` matches an atom
 * with in `src/core/qmd/model.ts`.
 *
 * ⚠ **DELIBERATELY NOT `ID_CHAR` ABOVE, WHICH IS A DIFFERENT AND NARROWER SET.** That one scans
 * the token under the cursor after an `@` and is `[A-Za-z0-9_-]` — no `:`, no `.`, ASCII only.
 * The two answer different questions (what may a reference token hold as you type it, versus
 * what may a defined identifier hold), and widening the completion scanner to this set would
 * silently change which text an accepted completion replaces.
 */
const ATTR_ID_CHAR = /[\p{L}\p{N}_:.-]/u;

/**
 * The 0-based column where `#<id>` resolves to the start of `<id>` on `line`, or
 * 0 if it cannot be located (defensive — go-to-definition still lands on the line).
 * Uses the LAST occurrence: the `{#id}` attribute block is trailing, so an
 * identical `#id` substring appearing earlier on the line (e.g. inside an inline
 * code span or quoted in the heading text) must not win.
 *
 * ⚠ **BUT ONLY AN OCCURRENCE THAT ENDS AT AN IDENTIFIER BOUNDARY** (Session 219). A bare
 * `lastIndexOf` is exact until two ids on one heading share a prefix, and then it finds the
 * shorter one INSIDE the longer: `# Cal T12 Prefix {#sec-t12 #sec-t12b}` under `commonmark_x`
 * defines `sec-t12`, whose text begins at column 19, and the search matched the `#sec-t12`
 * that opens `#sec-t12b` at 27 — putting go-to-definition in the middle of the other
 * identifier (`scratchpad/s219/id/cmx_t12prefix`).
 *
 * ⚠ The reader matters, and it is the one Session 219 otherwise left alone: the pandoc family
 * defines the LAST id, whose only occurrence is already the last, so this row is reachable
 * ONLY through `commonmark_x` — which takes the FIRST. The id surface cannot see it at all,
 * because the id string is correct in both readers and only its column is wrong.
 *
 * The boundary test keeps the trailing-occurrence rule intact: in
 * `## Use \`#sec-intro\` here {#sec-intro}` the earlier mention is followed by a backtick,
 * which is no identifier character, so both occurrences qualify and the LAST still wins
 * (the Session 8 adversarial row).
 */
function idColumn(text: string, line: number, id: string): number {
  const lineText = text.split(/\r?\n/)[line] ?? "";
  const needle = `#${id}`;
  let at = lineText.lastIndexOf(needle);
  while (at >= 0) {
    const next = lineText[at + needle.length];
    if (next === undefined || !ATTR_ID_CHAR.test(next)) {
      return at + 1;
    }
    if (at === 0) {
      break;
    }
    at = lineText.lastIndexOf(needle, at - 1);
  }
  return 0;
}
