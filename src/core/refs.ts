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
 *   4. Attribute blocks on PLAIN fenced code block openers — ```` ```{#lst-x .python} ````
 *      (model {@link findCodeFenceOpeners}). A fence opener is a region BOUNDARY, so it is
 *      not a body line and Source 3 never sees it.
 */

import type { AttributeBlockReader, BraceGroup } from "./qmd/model";
import {
  attributeBlockId,
  braceGroups,
  attributeBlockReader,
  findAllCells,
  findBodyLines,
  findCodeFenceOpeners,
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
 * A character a DEFINED cross-reference identifier may hold — Pandoc's attribute-block
 * identifier set: a Unicode letter or digit, `_`, `:`, `.` or `-`.
 *
 * ⚠ **THE DEFINITION SIDE IS A FLAT CLASS AND THE USE SIDE IS NOT, SO NEITHER RULE MAY BE
 * PORTED TO THE OTHER.** {@link REF_USAGE} is Pandoc's `citeKey`, where internal punctuation
 * counts only when a regchar follows it; this set has **no follower rule and no position
 * clause** — an admitted character may open, sit inside, or end the id. Measured over 36
 * rendered rows in Session 221 with predictions frozen first (`scratchpad/s221/cal/attr.qmd`,
 * 36/36): `{#fig-t26a..b}` is ONE id named `fig-t26a..b` (t26), and `{#fig-.t30b}`,
 * `{#fig--t31b}`, `{#fig-:t32b}`, `{#fig-日t35b}`, `{#fig-t40a.}`, `{#fig-t41a:}` and
 * `{#fig-t42a-}` all define exactly what they spell.
 *
 * ⚠ **AND EVERYTHING OUTSIDE IT FAILS THE BLOCK OUTRIGHT RATHER THAN TRUNCATING IT.**
 * `$ % + ? / ~ < > & * ! , ; | ' =` and a space each leave a token Pandoc's attribute parser
 * cannot place, so the braces are rendered as literal text and NO id is defined at all —
 * `fig-t09a$b}` appears verbatim in the rendered output. A `#` is not in the set either: it
 * splits the block into two id atoms, and the pandoc family takes the LAST, so
 * `{#fig-t08a#b}` defines `b` and no `fig-` target exists (t08, and Session 219's measured
 * last-wins rule).
 *
 * This is the same set `ATTR_ID_ALL` matches an atom with in `src/core/qmd/model.ts`, where
 * Session 218 measured it for HEADING attribute blocks. Session 221 re-measured it here for
 * images, divs and display equations rather than porting it, because "what may a heading's
 * identifier hold" and "what may an image's identifier hold" are two questions that happen to
 * share an answer (Learning #377).
 */
const DEFINED_ID_CHAR_CLASS = String.raw`[\p{L}\p{N}_:.-]`;
/**
 * A Quarto cell-option line declaring a label: `#| label: fig-plot` (or `//|`
 * for ojs/js cells), with an optional surrounding YAML quote. Group 1 is the id;
 * because the pattern is anchored at `^`, its column is
 * `match[0].length - id.length`.
 *
 * ⚠ **THIS IS THE SAME CLASS AS THE ATTRIBUTE-BLOCK PATH BECAUSE THE TWO WERE MEASURED TO ASK
 * ONE QUESTION — NOT BECAUSE ONE WAS PORTED TO THE OTHER.** (Session 222 split Source 3 into
 * a validated {@link isAttributeBlock} path, whose ids come from `ATTR_ID_ALL` in
 * `core/qmd/model.ts`, and the older {@link NARROW_LABEL} scan for the productions quarto owns
 * itself; the identifier SET is the same across all three, which is what this note is about.) The obvious model, and the one Session
 * 221 froze as its prediction, is that the label is the YAML scalar verbatim. That scored
 * **11 of 24** (`scratchpad/s221/cal/cell.qmd`). What actually happens is that quarto's engine
 * writes the label **verbatim into a Pandoc attribute block**, and Pandoc then accepts or
 * rejects it: `::: {#tbl-c09a$b .cell tbl-cap='Cap c09'}` appears as LITERAL TEXT in the
 * rendered HTML, next to quarto's own warning *"The following string was found in the
 * document: :::"*. So Source 2 inherits Source 3's grammar, and the discriminating round
 * confirmed it 9/9 (`cell3.qmd`).
 *
 * ⚠ **QUOTING IS YAML SYNTAX AND DOES NOT PROTECT AN INVALID ID.** The `["']?` strips the
 * opening quote and the class excludes quotes, so `"fig-a.b"` yields `fig-a.b` — but
 * `"tbl-d01a$b"` reaches the attribute block unquoted and defines NOTHING (`cell3.qmd` d01),
 * so a quote is not a licence to widen the class.
 *
 * ⚠ Two things happen before Pandoc, and neither changes the class: a `#` makes the engine
 * drop the label entirely (`#| label: tbl-c07a#b` emits `{.cell …}` with no id at all), and a
 * TRAILING `:` is a hard render error — `YAMLException: bad indentation of a mapping entry`.
 *
 * ⚠ **THE LEADING `[\p{L}\p{N}_]` IS VESTIGIAL HERE AND IS KEPT ONLY BECAUSE REMOVING IT WOULD
 * BE AN UNMEASURED CHANGE.** Unlike {@link NARROW_LABEL}, whose kind prefix sits OUTSIDE the
 * capture, this group starts at the prefix itself — so the `f` of `fig-` always satisfies the
 * clause and only the tail ever decided anything. That asymmetry is why the pre-session defect
 * differed in kind between the two sources: here a punctuation-first name yielded the bare
 * `fig-`, a kind prefix with an empty name, rather than being refused outright.
 */
const CELL_LABEL_OPTION = new RegExp(
  String.raw`^\s*(?:#|//)\|\s*label:\s*["']?(` +
    String.raw`[\p{L}\p{N}_]` +
    DEFINED_ID_CHAR_CLASS +
    String.raw`*)`,
  "u",
);
/**
 * A cross-ref id at the very start of a brace group's content — `{#fig-plot …}`. Group 1 is
 * the id; its column is the group's `start + 2` (past the `{#`). `sec-` is excluded on
 * purpose: section labels are owned by headings (Source 1), so a stray inline `{#sec-…}` is
 * not double-counted.
 *
 * ⚠ **THIS IS THE OLDER, UNVALIDATED SCAN, AND IT IS KEPT FOR THE GROUPS THAT ARE NOT PANDOC
 * ATTRIBUTE BLOCKS — WHICH IS A MEASURED CATEGORY, NOT A FALLBACK OF CONVENIENCE.** Session
 * 222 rendered the two productions quarto owns itself and neither is Pandoc's `Attr` parser:
 *
 *   **display math.** `$$ y = x $$ {#eq-m01}` defines `eq-m01`, but `{#eq-m02 .cls}`,
 *   `{#eq-m04a #eq-m04b}`, `{#eq-m05 key=v}`, `{ #eq-n02}` and even `{#eq-n01 }` all render
 *   their braces as LITERAL TEXT — anything beyond the bare id fails. And the id is taken
 *   VERBATIM: `{#eq-m06$x}` renders `id="eq-m06$x"`, a `$` the attribute parser categorically
 *   refuses (`scratchpad/s222/cal/math.qmd`, `n.qmd`).
 *
 *   **table captions.** `: Cap {#tbl-g12}` and `: Cap {#tbl-n06 .cls}` both define, a LEADING
 *   class does not (`{.cls #tbl-n07}`), and an invalid character is SANITISED rather than
 *   refused — `{#tbl-n05$x}` renders `id="tbl-n05x"` (`cal.qmd` g12, `n.qmd` n05–n07).
 *
 * Three productions, three grammars. Running the attribute-block rule over them would delete
 * `eq-` and `tbl-` targets that quarto really defines, which is the dangerous direction, so
 * they keep the scan they had. The rows where this scan and quarto still disagree are pinned
 * in `test/unit/refs.test.ts` and filed rather than fixed.
 *
 * ⚠ **THE NAME IS ONE FLAT RUN OF {@link DEFINED_ID_CHAR_CLASS}, NOT A FIRST-CHARACTER CLAUSE
 * PLUS A TAIL.** The two-clause spelling this replaced (`[A-Za-z0-9_][A-Za-z0-9_-]*`) refused
 * `{#fig-.t30b}` and `{#fig--t31b}` outright, both of which quarto defines
 * (`scratchpad/s221/cal/attr.qmd` t30/t31) — so widening only the tail would have left half
 * the defect in place.
 */
const NARROW_LABEL = new RegExp(
  String.raw`^#((?:fig|tbl|eq|lst)-` + DEFINED_ID_CHAR_CLASS + String.raw`+)`,
  "u",
);

/**
 * Whether `group` is the Pandoc ATTRIBUTE BLOCK of the element it sits on, rather than a brace
 * group that merely appears on the line.
 *
 * ⚠ **THE RULE IS ADJACENCY, AND TWO RENDERED ROWS REFUTE EVERY SIMPLER ONE.** "The first
 * group on the line wins" and "the first VALID group wins" both explain the whole calibration
 * corpus, and both are wrong: `x {#fig-w01a} ![Cap](a.png){#fig-w01b}` defines `fig-w01b` and
 * renders `{#fig-w01a}` as text, and `![A](a.png){#fig-w02a} and ![B](b.png){#fig-w02b}`
 * defines BOTH (`scratchpad/s222/cal/disc.qmd` w01/w02).
 *
 * The two admitting geometries were each measured:
 *
 *   **inline** — the group opens IMMEDIATELY after the `)` of an image or link, or the `]` of
 *   a bracketed span. One space breaks it (`![Cap](a.png) {#fig-g02}` defines nothing, g02) and
 *   so does any other character (`![Cap](a.png)x{#fig-g15}`, g15). A `)` that closes no link
 *   carries nothing (`(plain paren){#fig-w03}`, w03). Text AFTER the group does not unattach it
 *   (`{#fig-g14}extra` and `{#fig-p07}.` both define, g14/p07).
 *
 *   **fenced div** — the line opens a div and the group is ALL that follows it. `::: {#fig-g08}`
 *   and `:::{#fig-g09}` both define; `::: {#fig-p05a}{#fig-p05b}` defines NOTHING, so the
 *   trailing-content clause is measured rather than tidy (g08/g09/p05).
 *
 * ⚠ **AN INVALID ADJACENT GROUP DOES NOT HAND THE ELEMENT TO THE NEXT ONE.**
 * `![Cap](a.png){bareword}{#fig-w04}` defines nothing at all (w04) — the image takes the
 * adjacent group, fails to parse it, and the second group is then ordinary text. That is why
 * an attribute block is CONSUMED here whether or not it yields an id.
 *
 * ⚠ **DISPLAY MATH AND TABLE CAPTIONS ARE DELIBERATELY NOT LISTED, BECAUSE THEY ARE NOT THIS
 * PRODUCTION.** See {@link NARROW_LABEL}'s docstring for what they are and why they keep the
 * older scan.
 */
function isAttributeBlock(lineText: string, group: BraceGroup): boolean {
  const before = lineText[group.start - 1];
  if (before === ")" || before === "]") {
    return true;
  }
  return (
    /^\s*:{3,}\s*$/.test(lineText.slice(0, group.start)) &&
    /^\s*$/.test(lineText.slice(group.end + 1))
  );
}
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
  // ⚠ Resolved ONCE per document, from the same front-matter `from:` the heading path uses.
  // Which atom of a multi-id block wins is a READER question (Session 219, re-measured for
  // inline blocks and divs in Session 222 — `scratchpad/s222/cal/cmx.qmd`).
  const reader = attributeBlockReader(text);
  for (const { line, text: rawText } of findBodyLines(text)) {
    if (headingLines.has(line)) {
      continue;
    }
    // Mask inline code spans (length-preserving) so a `{#fig-…}` shown literally
    // in backticks is not indexed; column offsets stay valid.
    const lineText = maskInlineCode(rawText);
    for (const group of braceGroups(lineText)) {
      // ⚠ **AN ATTRIBUTE BLOCK IS CONSUMED WHETHER OR NOT IT YIELDS AN ID.** A group the
      // element owns but Pandoc refuses must NOT fall through to the narrow scan — that
      // fall-through is exactly the phantom this deliverable removes (`{#fig-a$b}` etc.),
      // and `disc.qmd` w04 shows quarto agrees: an invalid adjacent group does not hand the
      // element on to the next group.
      if (isAttributeBlock(lineText, group)) {
        const id = attributeBlockId(group.content, reader);
        const kind = id === undefined ? null : kindOf(id);
        // `sec-` is Source 1's, even when a block on an image really defines one
        // (`p.qmd` p04 renders id="sec-p04"); indexing it here would double-count.
        if (id !== undefined && kind !== null && kind !== "sec") {
          labels.push({ id, kind, line, column: idColumnIn(lineText, group, id) });
        }
        continue;
      }
      // ⚠ **THE UNVALIDATED FALLBACK DOES NOT APPLY ON A LINE THAT BEGINS WITH A FENCE RUN.**
      // Such a line is here at all only because the region scanner REFUSED it as a fence
      // opener (Session 224) — or because it never closed — and quarto renders it as literal
      // text, defining nothing: ```` ```{#lst-d10 .python} extra ```` is one inline code span
      // (`s223/cal/disc.qmd` d10) and ```` ```{#lst-b09 .cls} x ```` renders its braces
      // verbatim (`s224/b/b09`). Without this clause every fence this session newly refuses
      // mints a phantom, which is the defect it exists to remove seen from the other side.
      //
      // ⚠ **ONLY the fallback is withheld, never the line.** A refused fence line is ordinary
      // prose, so a REAL element on it still defines through the branch above — measured:
      // ```` ```{#lst-h01 bad .x} ![Cap](a.png){#fig-h01} ```` renders the image and
      // `id="fig-h01"` with it (`scratchpad/s224/h/h01`).
      //
      // ⚠ Tested against the RAW line, not the masked one. `maskInlineCode` rewrites a
      // three-backtick run into `` ` `` plus two spaces, so the masked text no longer starts
      // with a fence run at all and the clause silently never fires — measured on this very
      // row before the fix.
      if (FENCE_RUN.test(rawText)) {
        continue;
      }
      const m = NARROW_LABEL.exec(group.content);
      if (m === null) {
        continue;
      }
      const kind = kindOf(m[1]);
      if (kind !== null) {
        labels.push({ id: m[1], kind, line, column: group.start + 2 });
      }
    }
  }

  // Source 4 — attribute blocks on PLAIN fenced code block openers,
  // ```` ```{#lst-x .python} ````. The opener is a region boundary rather than a body line, so
  // Source 3 never reaches it; see `fenceAttributeId` for the two-stage grammar, which is
  // quarto's own and not `Attr`'s.
  for (const fence of findCodeFenceOpeners(text)) {
    // ⚠ The opener text is RAW so its columns stay real; the PARSE starts past the block-quote
    // marker and the column is shifted back by the same offset (Session 225).
    const found = fenceAttributeId(
      fence.text.slice(fence.contentStart),
      reader,
      fence.contentStart === 0,
    );
    if (found === undefined) {
      continue;
    }
    const kind = kindOf(found.id);
    // `sec-` is Source 1's. Quarto really defines it here — ```` ```{#sec-r10 .python} ````
    // renders `id="sec-r10"` (`r.qmd` r10) — but section labels are owned by headings, which
    // is the same boundary Source 3 draws. Pinned at `refs.test.ts` H11.
    if (kind !== null && kind !== "sec") {
      labels.push({
        id: found.id,
        kind,
        line: fence.line,
        column: found.column + fence.contentStart,
      });
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
 * Whether the completion REPLACE RANGE should extend over `at` — {@link idContinuesAt}, plus a
 * `-` unconditionally.
 *
 * ⚠ **`end` IS NOT A PARSE CLAIM, AND THIS IS THE ONE PLACE THE TWO QUESTIONS DIVERGE.** It
 * answers *what has the author typed as part of this token*, so that accepting a completion
 * replaces all of it; {@link refIdAt} answers *what does Pandoc consume*, and stays exactly
 * faithful (`@sec-x-` really is the token `sec-x` — `cal/cal.qmd` t07). Only `-` is treated
 * permissively, because it is the one punctuation character every cross-ref id already
 * contains — the kind prefix guarantees at least one — so an author who has just typed a
 * hyphen is still composing the id, while a `.` or `:` at the end of a token is far more
 * likely to be the sentence's punctuation.
 *
 * ⚠ The invariant this buys is mechanical and was checked over 321,236,210 columns: the
 * replace range NEVER shrinks against the pre-session build, so no accepted completion can
 * strand a character the old scanner would have replaced. Session 220 shipped that defect
 * twice — once for the kind prefix's hyphen, once for a name's — and found both only by
 * sweeping `end` rather than by testing the id.
 */
function replaceRangeContinuesAt(lineText: string, at: number): boolean {
  return lineText[at] === "-" || idContinuesAt(lineText, at);
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
  //
  // ⚠ **A `-` IS ALWAYS COVERED** — see {@link replaceRangeContinuesAt}. `@sec-` is what an
  // author types to summon the list, and the follower rule alone stops before that hyphen
  // (nothing follows it yet), so accepting `@sec-intro` would leave `@sec-intro-` behind.
  // That is the mid-token-accept duplication `core/citations.ts` records.
  let end = column;
  while (end < lineText.length && replaceRangeContinuesAt(lineText, end)) {
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
 * {@link DEFINED_ID_CHAR_CLASS} as a testable single-character pattern — the boundary test
 * `idColumn` uses to decide whether an `#id` occurrence ends where the identifier ends.
 *
 * ⚠ **DELIBERATELY NOT THE USE-SIDE RULE, WHICH IS A DIFFERENT QUESTION.** {@link REF_USAGE}
 * asks what a reference TOKEN may consume as the author types it; this asks what a DEFINED
 * identifier may hold. Session 220 measured the first and Session 221 the second, separately,
 * and they disagree — the use side has a follower clause and this side does not.
 */
const ATTR_ID_CHAR = new RegExp(DEFINED_ID_CHAR_CLASS, "u");

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
  return lastIdStart(lineText, id, lineText.length, 0) ?? 0;
}

/**
 * Where the `#<id>` occurrence that ENDS at an identifier boundary starts on `lineText`,
 * searching backwards from `searchFrom` and refusing to look before `floor`; `null` if there
 * is none. The trailing-occurrence rule and the boundary test are {@link idColumn}'s, and
 * both are Session 219's — see that docstring for the two rendered rows behind them.
 */
function lastIdStart(
  lineText: string,
  id: string,
  searchFrom: number,
  floor: number,
): number | null {
  const needle = `#${id}`;
  let at = lineText.lastIndexOf(needle, searchFrom);
  while (at >= floor) {
    const next = lineText[at + needle.length];
    if (next === undefined || !ATTR_ID_CHAR.test(next)) {
      return at + 1;
    }
    if (at === 0) {
      break;
    }
    at = lineText.lastIndexOf(needle, at - 1);
  }
  return null;
}

/**
 * The 0-based column where the identifier text of `id` begins INSIDE `group`.
 *
 * ⚠ **THE SEARCH IS BOUNDED BY THE GROUP, WHICH IS THE WHOLE REASON IT IS NOT
 * {@link idColumn}.** An attribute block's id is now selected from the block's ATOMS rather
 * than found by scanning the line, so the same `#id` text may well appear earlier on the line
 * outside the block — in a previous element's block on a line carrying two of them
 * (`disc.qmd` w02), or in prose the reader sees as text (`w01`). Searching the whole line
 * would send go-to-definition to the wrong one. Falls back to just past the `{` — defensive,
 * so navigation still lands on the right line.
 */
function idColumnIn(lineText: string, group: BraceGroup, id: string): number {
  return lastIdStart(lineText, id, group.end, group.start) ?? group.start + 1;
}

/** A fenced code block opener's leading run — indentation, the fence characters, and the gap. */
const FENCE_RUN = /^[ \t]*(?:`{3,}|~{3,})[ \t]*/;

/**
 * The cross-reference id a PLAIN fenced code block's opener line defines, or `undefined`.
 *
 * ⚠ **THIS IS A FOURTH PRODUCTION AND IT HAS A STAGE PANDOC DOES NOT — DO NOT DERIVE IT FROM
 * `Attr`.** Measured over 51 rendered rows across six rounds in Session 223
 * (`scratchpad/s223/cal/`, quarto 1.7.33, predictions frozen and hashed before each round):
 *
 *   **Stage 1 — quarto's own, and it is the whole reason a port would be wrong.** An info
 *   string that BEGINS with `{` and contains neither `.` nor `=` is intercepted: the entire
 *   info string, braces included, becomes a literal CLASS and **no id is defined at all**.
 *   ```` ```{#lst-s03} ```` renders `<pre class="{#lst-s03}">` (`sv.qmd` s03) — while bare
 *   pandoc defines `id="lst-s03"` from the same bytes, under `markdown` AND `commonmark_x`,
 *   and none of eight pandoc reader flavours reproduces quarto's split. Confirmed at AST level:
 *   `quarto render --to native` shows `CodeBlock ( "" , [ "{#lst-s03}" ] , [] )`.
 *
 *   ⚠ The gate is LEXICAL rather than a validity test — `{#lst-t01.b}` is released by a `.`
 *   that is part of the IDENTIFIER and defines `lst-t01.b` with no class at all (`t.qmd` t01),
 *   and 23 rows holding `: , _ - é $ ! * / + ; % | ( ) ~`, a space, a bare word or a second
 *   `#id` atom are all intercepted (`t.qmd`, `u.qmd` 10/10).
 *
 *   **Stage 2 — pandoc's `Attr`, which {@link attributeBlockId} already carries measured.** A
 *   released info string is parsed as `[word] {attrs}`; a FAILED parse means the fence is not a
 *   fence at all (`{#lst-q05$x .python}` renders as an inline code span, `q.qmd` q05).
 *
 * ⚠ **THE GATE APPLIES ONLY TO A BRACE-LED INFO STRING.** ```` ```python {#lst-d09} ```` and
 * ```` ```.python {#lst-r07} ```` both define although their braces hold neither `.` nor `=`
 * (`disc.qmd` d09, `r.qmd` r07) — the leading word is itself the non-identifier token.
 *
 * ⚠ **STAGE 1 IS QUARTO'S AND QUARTO'S IS LINE-ANCHORED, SO IT DOES NOT REACH INSIDE A BLOCK
 * QUOTE (Session 225).** ```` > ```{#lst-e01} ```` renders `<pre id="lst-e01">` — a REAL id —
 * where the identical bytes at top level render `<pre class="{#lst-s03}">` and define none
 * (`scratchpad/s225/e/e01` against Session 223's `sv.qmd` s03). `quartoIntercepts` is that
 * difference, and it is the caller's to know because only the region scanner sees the marker.
 */
function fenceAttributeId(
  lineText: string,
  reader: AttributeBlockReader,
  quartoIntercepts: boolean,
): { id: string; column: number } | undefined {
  const run = FENCE_RUN.exec(lineText);
  if (run === null) {
    return undefined;
  }
  const info = lineText.slice(run[0].length).trimEnd();
  if (quartoIntercepts && info.startsWith("{") && !/[.=]/.test(info)) {
    return undefined;
  }
  // ⚠ **THE BLOCK MUST END THE INFO STRING, AND THAT IS A MEASURED REFUSAL RATHER THAN
  // TIDINESS.** ```` ```{#lst-d10 .python} extra ```` is not a fenced code block at all —
  // pandoc's info-string parse fails and the backticks are read as an INLINE CODE SPAN, so the
  // rendered document holds `<p><code>{#lst-d10 .python} extra x = 10</code></p>` and defines
  // nothing (`disc.qmd` d10). Our region scanner does open a region on that line, which is a
  // separate and much wider question, so the refusal is made here where the id is minted.
  //
  // ⚠ **AND IT IS THE LAST GROUP, NOT THE FIRST — MEASURED UNDER BOTH READERS.**
  // ```` ```{#lst-z07a}{#lst-z07b .python} ```` defines `lst-z07b` and renders the FIRST group
  // as a literal class (`adv.qmd` z07); the `commonmark_x` twin agrees (`adv2.qmd` y01) and a
  // separating space changes nothing (`adv3.qmd` y02). An earlier group is an info-string
  // WORD rather than part of the block, which is why the reader split that picks an atom
  // INSIDE a block never arises between blocks.
  const groups = braceGroups(lineText);
  const group = groups[groups.length - 1];
  if (group === undefined || group.end !== lineText.trimEnd().length - 1) {
    return undefined;
  }
  // ⚠ **AND AT MOST ONE INFO-STRING WORD MAY PRECEDE IT.** Pandoc's info string is
  // `[word] {attrs}`, so ```` ```{#lst-y03a .cls}{#lst-y03b} ````, whose prefix is TWO words,
  // is not a fenced code block at all — it renders as an inline code span and defines nothing
  // (`adv3.qmd` y03). One word is measured three ways and all three define: a language
  // (`python {#lst-d09}`), a class-looking word (`.python {#lst-r07}`) and an earlier brace
  // group (`{#lst-z07a}{#lst-z07b .python}`).
  if (lineText.slice(run[0].length, group.start).trim().split(/\s+/).filter(Boolean).length > 1) {
    return undefined;
  }
  const id = attributeBlockId(group.content, reader);
  return id === undefined ? undefined : { id, column: idColumnIn(lineText, group, id) };
}
