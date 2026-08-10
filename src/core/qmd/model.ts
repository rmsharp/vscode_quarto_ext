/**
 * Pure, `vscode`-free region model for a Quarto `.qmd` document.
 *
 * This module lives in `core/` and MUST NOT import `vscode` (architecture plan
 * §3.3 — "the load-bearing guardrail"). It is the single source of truth for
 * parsing a `.qmd` into its structural regions — YAML front matter, ATX
 * headings, and executable code cells — and is unit-tested headlessly. Phase 6a
 * consumes it for the document outline; Phases 6b–6e (cross-refs, citations)
 * build their indexes on top of the same parse.
 *
 * Known limitations (intentional v1 scope; tracked in the backlog):
 *  - ATX (`#`..`######`) and setext (`===`/`---`-underlined) headings are both
 *    recognized, but the setext scanner tracks no list/blockquote context, so a
 *    setext heading nested inside a list item or blockquote (Pandoc supports
 *    this) is not detected — the underline is left as an ordinary, unclassified
 *    body line (a false negative, the safe direction; mirrors the accepted
 *    indented-code-block gap below, which has the same root cause).
 *  - CommonMark §4.4 *indented* code blocks (a line indented ≥4 spaces after a
 *    blank line) are NOT modelled as a skip-region, so `findBodyLines` emits
 *    them and the cross-ref index (`core/refs`) may pick up a `{#fig-…}` shown
 *    inside one as a phantom label. A faithful fix must avoid false-skipping
 *    4-space list-item continuation content (the model tracks no list context),
 *    so it needs its own list-aware TDD pass. Fenced code (```/~~~) IS skipped.
 *  - Pandoc's `blank_before_header` IS implemented (an ATX heading may not
 *    interrupt an open paragraph — see `CLOSES_PARAGRAPH`), but the predicate
 *    that decides whether a line leaves a paragraph open is a deliberately
 *    PERMISSIVE per-line test, not real block-level state. So a line that only
 *    LOOKS block-level inside prose — a pipe in a sentence, a leading `<`, a
 *    footnote definition, a 4-space lazy continuation — still yields a phantom
 *    heading. Each is a retained pre-existing false positive (the safe
 *    direction) and each is pinned as a KNOWN RESIDUAL in
 *    `test/unit/qmd-model.test.ts`; tightening any of them costs a heading
 *    quarto really renders.
 */

/** An ATX (`#`..`######`) markdown heading outside any code fence / front matter. */
export interface Heading {
  /** Heading level, 1–6 (number of leading `#`). */
  level: number;
  /** Heading text with the `#` markers and any closing `#` sequence stripped. */
  text: string;
  /** 0-based line index of the heading. */
  line: number;
  /**
   * The explicit identifier from a trailing Pandoc attribute block
   * (`## Methods {#sec-methods}` → `"sec-methods"`), or `undefined` if the
   * heading has none. Captured structurally (kind-agnostic) so the cross-ref
   * layer (`core/refs.ts`) can consume `sec-` section labels without re-parsing.
   */
  id?: string;
}

/**
 * A Quarto executable code cell — a backtick-fenced block whose info string is a
 * brace-wrapped language identifier, ```` ```{python} ````.
 */
export interface Cell {
  /** 0-based line index of the opening fence. */
  startLine: number;
  /** 0-based line index of the closing fence (or the last line if unterminated). */
  endLine: number;
  /** The cell engine/language from the brace info string, e.g. `"python"`. */
  lang: string;
  /** The cell body (lines between the fences), joined with `\n`; `""` if empty. */
  code: string;
}

/**
 * A node in the document outline tree — a heading or a code cell. Line indices
 * are 0-based. `startLine`..`endLine` is the node's full span (a heading covers
 * its whole section, including descendants); `selectionLine` is the single line
 * to highlight when the symbol is selected (the heading line or opening fence).
 * The adapter (`providers/outline.ts`) translates these to `vscode.DocumentSymbol`.
 */
export interface OutlineSymbol {
  kind: "heading" | "cell";
  /** Display name: the heading text, or the cell fence, e.g. ```` ```{python} ````. */
  name: string;
  /** Heading level 1–6 (headings only). */
  level?: number;
  /** Cell language, e.g. `"python"` (cells only). */
  lang?: string;
  startLine: number;
  endLine: number;
  selectionLine: number;
  children: OutlineSymbol[];
}

/**
 * A single-line ATX heading: leading whitespace of EITHER KIND, then 1–6 `#`, then at
 * least one space/tab, then the text. Requiring the space after the hashes is what rejects
 * `#hashtag`; capping at 6 rejects `#######`.
 *
 * ⚠ **The leading class is NOT a heading rule and this regex does not decide the indent —
 * `atxHeadingMatch` below does, against the enclosing block's content column.** Until
 * Session 199 the class was CommonMark §4.2's ` {0,3}`, which was wrong in both directions at
 * once: it accepted columns 1–3, which quarto renders as literal paragraph text, and it could
 * not reach column 4 at all, where a container offers a real heading. The two capture groups
 * are unchanged and `parseHeadingLine` still reads them — `m[1].length` counts `#`, not
 * whitespace, so it is not the character-counting bug Sessions 194–197 removed from six other
 * sites.
 */
const ATX_HEADING = /^[ \t]*(#{1,6})[ \t]+(.+)$/;
/**
 * The columns a CommonMark-dialect document accepts an ATX heading at — §4.2's own 0-3
 * tolerance, which quarto's DEFAULT dialect does not have (see `atxHeadingMatch`). Used
 * only under a front-matter `from:` key, where the reader may genuinely be CommonMark.
 * ⚠ It is a bounded SET, not a suspension: column 4 is an indented code block under every
 * dialect measured, `gfm` and `commonmark` included.
 */
const COMMONMARK_HEADING_COLUMNS: readonly number[] = [0, 1, 2, 3];
/**
 * CommonMark's own leading-space slack, as OFFSETS from an enclosing block's content column
 * rather than as absolute columns (Session 202). Deliberately a separate constant from
 * `COMMONMARK_HEADING_COLUMNS` above even though the four numbers coincide: that one is an
 * absolute column SET the ATX row spreads into its own, this one is added to a column, and
 * folding them together would make one row's edit silently move the other's rule.
 *
 * ⚠ At `column + 4` the line is an INDENTED CODE block under every dialect measured, so this
 * tolerance and "any column shallower than code depth" describe the same set here — CommonMark
 * §4.3's 0-3 slack and §4.4's 4-column code rule are complements by construction. Written as
 * the slack because that is what pandoc's `commonmark` reader implements.
 */
const COMMONMARK_INDENT_OFFSETS: readonly number[] = [0, 1, 2, 3];
/**
 * A list marker CommonMark itself has: a bullet, or a DECIMAL ordinal followed by `.` or `)`
 * (Session 202). Deliberately much narrower than `listItemContentColumn`'s own marker class,
 * which also accepts letter runs (`a.`, `iv)`, and `Mr.` with it), `#.`, and the
 * parenthesised-both-sides form — pandoc's `fancy_lists`, which the CommonMark readers lack.
 *
 * ⚠ **Read ONLY to decide which stack column the setext row measures its tolerance from — it
 * does not change what `contentColumns` holds.** That stack is required to fail toward
 * phantoms (see `listItemContentColumn`), and two other rows read it; narrowing it here would
 * move all three for a fact only this one uses. Found by a blind lens: under `from: gfm` a
 * footnote body containing `    a. Nest Echo Probe` / `    ===` renders `h1:a. Nest Echo
 * Probe` — the marker is literal text there — and measuring the tolerance from the phantom
 * column `a. ` pushes DELETED it (`scratchpad/s202/adv/nest/nest_05`).
 */
const COMMONMARK_LIST_MARKER = /^[ \t]*(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/;
/**
 * An optional closing sequence: a run of `#` at end of line, preceded by
 * whitespace OR the start of the (already separator-stripped) text. Anchoring to
 * `^` as well lets an all-hash heading body (`## ##`) collapse to empty so it is
 * dropped, while a `#` that is part of a word (`C#`) is preserved.
 */
const ATX_CLOSING = /(?:^|[ \t]+)#+[ \t]*$/;
/**
 * A trailing Pandoc/Quarto heading attribute block — `{#sec-id .class key=val}`.
 * Quarto renders the heading text without it (and the `#sec-` id drives Phase 6b
 * cross-references), so it is stripped from the outline display name here. Shared
 * by ATX and setext headings — Pandoc accepts a trailing attribute block on both.
 */
const HEADING_ATTRIBUTE = /(?:^|[ \t]+)\{[^}]*\}[ \t]*$/;
/**
 * The `#identifier` inside a Pandoc attribute block. Pandoc separates id, classes
 * (`.x`), and key=val pairs by whitespace, so the id runs from `#` to the next
 * whitespace or closing brace: `{#sec-intro .unnumbered}` → `sec-intro`.
 */
const ATTR_ID = /#([^\s}]+)/;
/**
 * The ATX heading match on `line`, or null if these bytes are not a heading HERE
 * (Session 199). `columns` is `[0, ...contentColumns]` — column 0 plus every column in the
 * open container stack, the same array `setextUnderlineLevel` reads.
 *
 * ⚠ **The indent is an EQUALITY against the enclosing block's content column, NOT
 * CommonMark's 0-3 tolerance** — and the tolerance was wrong in BOTH directions at once,
 * which is why this is neither a widening nor a narrowing of it. Pandoc's markdown reader
 * does not give an ATX heading the leading-space slack CommonMark does. Measured over a
 * 121-document grid (8 container shapes × 11 indents × 2 levels, all quarto exit 0) and
 * hand-verified against the raw HTML rather than through the extractor:
 *
 *   - top level             heading at column 0 only; 1, 2 and 3 render the LITERAL
 *                           `<p># Probe Title</p>`, which the ` {0,3}` cap read as a heading
 *   - `- item`   (col 2)    heading at 0 and 2
 *   - `1. item`  (col 3)    heading at 0 and 3
 *   - `-   item` (col 4)    heading at 0 and 4 — the cap could not reach column 4 at all
 *   - `- a` / `  - b`       heading at 0, 2 AND 4 — the whole stack, not the innermost
 *   - `- a` / `  - b` / `    - c`   heading at 0, 2, 4 and 6
 *   - a footnote or definition body, and both levels `#`/`##`, answer identically
 *
 * At `column + 4` the line is an indented CODE block in every context, so the sweep past
 * `c + 3` is what separates this rule from a tolerance: a corpus that stops at `c + 3`
 * cannot tell a correct rule from one that never refuses.
 *
 * ⚠ **The tab is the column, not the character count** — `indentColumn` is the one shared
 * definition (quarto's tab stop is 4), so inside `-   item` a TAB-indented heading lands
 * exactly on content column 4 and IS a heading, while the same tab inside `- item` (column 2)
 * overshoots and is not. Both measured; this is the sixth site on that definition.
 *
 * ⚠ **`null` columns SUSPEND the rule and return the bare match. There are TWO reasons the
 * caller passes null, they were found by different means, and neither was in the first
 * draft.**
 *
 * The SECOND is a `from:` FRONT-MATTER KEY (`dialectOverride`), and it is the one this rule
 * could not have been derived without: the equality above is quarto's DEFAULT-dialect
 * behaviour, and `gfm` and `commonmark` genuinely DO have CommonMark's 0-3 tolerance.
 * Measured over 29 rendered documents — `gfm` and `commonmark` render the heading at columns
 * 0, 1 and 3, while `markdown`, `markdown_strict`, `markdown-blank_before_header` and no key
 * at all render it at 0 only. Applying the equality under those two keys DELETES real
 * headings, which is how this session's completeness pass found it. The suspension keys on
 * the key's PRESENCE rather than on resolving the dialect — the same fail-open
 * `FRONTMATTER_FROM_KEY` already documents for the `paragraphOpen` bail — so the measured
 * cost is a phantom at columns 1-3 under the three non-CommonMark keys, this project's
 * permitted direction. A container column still resolves normally under a `from:` key
 * (measured), because column 0 is not the only column in the set.
 *
 * The FIRST is the block-quote fail-safe, and it is here because the first draft of this
 * function argued its way out of it and a Session 189 pin refuted the argument within the
 * minute. That draft reasoned: a `> # x`
 * line cannot match `ATX_HEADING` at all, and the only way these bytes are seen inside a
 * quote is as a lazy continuation, where `paragraphOpen` is true and the call site has
 * already bailed. The reasoning is sound and the conclusion is false — a BLOCK inside the
 * quote (`> quoted` / `>` / `   \clearpage` / `   # ATX Below`) clears `paragraphOpen`
 * without clearing `quoteOpen`, so the row IS reached with a column stack that describes the
 * document rather than the quote. Session 189 measured that document rendering the heading at
 * EVERY indent 0-8, because pandoc strips the quote's markers and re-parses what is left.
 * Applying an absolute column equality there DELETES it. So while a quote may be open this
 * row keeps the old ` {0,3}` width, exactly as `rawTexMacroLineIsBlock` and `indentedCodeLine`
 * do: phantoms, never deletions.
 *
 * A container that has CLOSED no longer offers its column, and that falls out of
 * `contentColumns` maintenance rather than being special-cased here — the same property
 * `setextUnderlineLevel` documents.
 */
function atxHeadingMatch(
  line: string,
  columns: readonly number[] | null,
): RegExpExecArray | null {
  const m = ATX_HEADING.exec(line);
  if (m === null || columns === null) {
    return m;
  }
  return columns.includes(indentColumn(line)) ? m : null;
}
/**
 * A setext heading underline: leading whitespace of EITHER KIND — its COLUMN is what the
 * test in `setextUnderlineLevel` below reads, taken from `indentColumn` rather than from a
 * capture group here (Session 197; the capture existed only to be counted, and counting
 * characters is the bug) — then one or more of a SINGLE char (no spaces between,
 * unlike a thematic break), then optional trailing whitespace. `=` underlines a level-1
 * heading; `-` underlines level-2. Recognized only when it immediately follows exactly one
 * fresh, non-blank paragraph line (`consecutiveBody === 1` in the scanner below)
 * — empirically confirmed against Quarto's own installed CLI (`pandoc -f
 * markdown`, not `gfm`/`commonmark`) that a 2+-line paragraph does NOT promote to
 * a setext heading; it stays a plain paragraph with the underline as literal
 * trailing text. This also means a setext heading can never claim the line right
 * after an ATX heading (the ATX line resets the counter to 0, matching Quarto's
 * `.qmd` reader's actual single-line-only rule, not the surprising ATX-swallowing
 * behavior a plain `---`-adjacency edge case can otherwise produce in Pandoc).
 *
 * Session 181 added the second way that counter reaches 1: the line above may also be the
 * first line AFTER a block construct (`OPENS_FRESH_BLOCK`), not only the first line after a
 * blank. KNOWN RESIDUALS, each measured firsthand and each PRE-EXISTING — this session
 * neither caused nor closed them, and each costs something real to fix:
 *
 *   - A raw HTML block directly under an underline is claimed as a heading with its literal
 *     tag as the text (`<div>` / `===` → we report `<div>`, quarto renders no heading).
 *   - A raw TeX line likewise keeps its literal text (`\clearpage` / `===` → we report
 *     `\clearpage`, quarto renders an EMPTY heading because it renders the TeX).
 *   - A bare `##` under an underline renders an EMPTY `<h2></h2>` in quarto; we emit no
 *     empty-titled heading at all, which is deliberate — an empty outline row is noise.
 *   - An `=` run that is NOT consumed as an underline is treated by `CLOSES_PARAGRAPH` as
 *     closing the paragraph, so an ATX heading below it is reported; measured, pandoc keeps
 *     the paragraph open in all three positions where that entry is reachable, so the
 *     heading is a phantom. That entry is Session 180's and is filed, not fixed here.
 */
const SETEXT_H1 = /^[ \t]*=+[ \t]*$/;
/** A setext level-2 underline — see `SETEXT_H1`. */
const SETEXT_H2 = /^[ \t]*-+[ \t]*$/;
/**
 * The level of the setext underline on `line`, or null if it is not one HERE (Session 192).
 *
 * ⚠ **The underline's indent is not a 0-3 tolerance — it is an EQUALITY against the enclosing
 * block's content column**, and `columns` is `[0, ...contentColumns]`: column 0 plus every
 * column in the open container stack. Pandoc's `setextHeader` applies `skipNonindentSpaces`
 * to the TITLE line and then reads the underline run with no leading-space parser at all, so
 * the run must begin exactly where the enclosing block's content begins.
 *
 * ⚠ **…UNDER QUARTO'S DEFAULT READER. Under a CommonMark-family `from:` the rule is the
 * opposite SHAPE, and the call site builds a different set for it (Session 202).** This
 * function is unchanged — it still asks only "is the underline's column in this set?" — but
 * which set it is handed now depends on the document's reader:
 *
 *   default (`markdown`, and no key at all)   `[0, ...contentColumns]` — an EQUALITY against
 *                                             column 0 or ANY open container column
 *   CommonMark (`gfm`, `commonmark`, …)       `[c … c+3]` where `c` is the INNERMOST open
 *                                             content column — a TOLERANCE, and column 0 is
 *                                             NOT in it unless it IS the innermost
 *
 * Measured over the 264-document grid `scratchpad/s202/gnd` (4 dialects × 6 container shapes ×
 * 11 underline columns, all quarto exit 0) plus the 120-document `lvl` grid that repeats it for
 * the `-` spelling and answers identically. ⚠ **Every divergence in both grids was a
 * CommonMark-dialect row** — the default-dialect half of the equality above is exactly right,
 * 192 rows of 192 — and the shipped build agrees on 384 of 384.
 *
 *   top level     (c=0)     default `[0]`         CommonMark `[0,1,2,3]`
 *   `- item`      (c=2)     default `[0,2]`       CommonMark `[2,3,4,5]`
 *   `1. item`     (c=3)     default `[0,3]`       CommonMark `[3,4,5,6]`
 *   `-   item`    (c=4)     default `[0,4]`       CommonMark `[4,5,6,7]`
 *   `- a`/`  - b` (c=2,4)   default `[0,2,4]`     CommonMark `[4,5,6,7]` — NOT the whole stack
 *   3-deep        (c=2,4,6) default `[0,2,4,6]`   CommonMark `[6,7,8,9]`
 *
 * The mechanism is CommonMark's own rule that a setext underline may not be a LAZY
 * CONTINUATION line: a run shallower than the innermost open container continues the item's
 * paragraph instead of underlining it. That is why the CommonMark set REFUSES columns the
 * default set accepts (column 0, and every OUTER column of a nested stack) while ACCEPTING
 * three the default set refuses. ⚠ **The two halves have OPPOSITE polarity — one removes
 * phantoms, one recovers headings — and were scored separately** (Learning #272).
 *
 * ⚠ **"Innermost" is measured AFTER the container pop, not from the title's own line.**
 * `scratchpad/s202/ax` `pop_gfm_*`: a 2-deep stack whose title sits at column 2 closes the
 * inner item, and quarto then accepts `[2,3,4,5]` rather than the inner `[4,7]`. The
 * `contentColumns` maintenance at the top of the scan already produces exactly that, so this
 * needed no special case — but it is an axis the ground grid holds fixed, so it was measured
 * rather than argued.
 *
 * Both former `{0,3}` regexes were simultaneously TOO WIDE and TOO NARROW, which is why this
 * is an equality and not a widened or narrowed cap. Measured over 162 container documents
 * (9 kinds × 9 underline indents × 2 spellings) and 17 environment documents:
 *
 *   - top level             heading at column 0 only; 1-8 render NO heading (the filed item)
 *   - `- item`   (col 2)    heading at 0 and 2 — column 3 was a phantom we emitted
 *   - `1. item`  (col 3)    heading at 0 and 3
 *   - `-   item` (col 4)    heading at 0 and 4 — column 4 was a heading we DELETED
 *   - `- a` / `  - b` / `    - c`   heading at 0, 2, 4 AND 6 — the whole stack, not the innermost
 *
 * ⚠ **Anchoring at source column 0 — which the filed item prescribed, pointing at
 * `SETEXT_UNDERLINE_RUN` as the model — deletes every container heading above.** That
 * anchor is right for `SETEXT_UNDERLINE_RUN` because pandoc's ATX-swallow really is
 * column-0-only (measured separately, Session 182); it is wrong here.
 *
 * ⚠ **A TAB IS THE CONTENT COLUMN WHENEVER IT REACHES ONE (Session 197), and this note used to
 * say the opposite.** Session 192 wrote "a tab is not the content column", citing `- item` /
 * `  Some Title` / `\t===`, which renders no heading. The measurement was right and the rule
 * inferred from it was not: that container's content column is **2** and a tab reaches **4**, so
 * the document shows only that 4 ≠ 2 — the one axis that would vary the claim was never varied
 * (Learning #282). Re-rendered this session at a container whose column IS 4 (`-   item`), the
 * tab lands exactly on it and quarto renders the heading, which this model then lost. So the
 * indent class is `[ \t]*` and the column comes from `indentColumn`, the same one definition the
 * pop, `indentedCodeLine`, `rawTexMacroLineIsBlock`, `listItemContentColumn` and
 * `CONTENT_COLUMN_4_OPEN` read — the last of the six sites to stop counting characters.
 *
 * ⚠ And the cited document's OWN control does not hold either: re-rendered, `- item` /
 * `  Some Title` / `  ===` renders no heading in the SPACE spelling too, because `  Some Title`
 * is a lazy continuation of `- item` and a 2-line paragraph never promotes. The note's "where
 * the two-space spelling does" needed a blank line to be true. State a document's parameters
 * beside a ⚠ note, and render its control as well as its subject.
 *
 * A container that has CLOSED no longer offers its column, and that falls out of
 * `contentColumns` maintenance rather than being special-cased here: a column-0 paragraph
 * pops the list, so the underline at column 2 below it is correctly not an underline.
 */
function setextUnderlineLevel(line: string, columns: readonly number[]): 1 | 2 | null {
  if (SETEXT_H1.test(line)) {
    return columns.includes(indentColumn(line)) ? 1 : null;
  }
  if (SETEXT_H2.test(line)) {
    return columns.includes(indentColumn(line)) ? 2 : null;
  }
  return null;
}
/** A line with no non-whitespace content. */
const BLANK_LINE = /^[ \t]*$/;
/**
 * A bullet-list item marker (`-`/`*`/`+` then a space/tab) at the start of a
 * line — the TRIGGER for `setextTitleText`, and deliberately NOT a column rule.
 *
 * ⚠ **The leading class is `[ \t]*`, and this row carries no indent rule at all — which is a
 * THIRD answer, not either of the two adjacent rows' (Session 201).** Session 199 measured an
 * ATX heading's indent as an EQUALITY against the enclosing block's content column; Session 200
 * measured a fence's as a TOLERANCE relative to the same column. Both had to pick a column rule
 * because both rows decide *whether a construct is recognised*. This row decides nothing of the
 * kind: by the time it is consulted, `setextUnderlineLevel` has already ruled on the underline's
 * own column, and a title line 4+ columns past the enclosing content column is INDENTED CODE, so
 * no heading forms there whatever this row says. What is left is a pure TEXT transform, and a
 * text transform has no column to be right or wrong about. Measured over 198 ground documents
 * (`scratchpad/s201/gnd` — 6 container shapes x 11 indents x 3 marker characters): in every one
 * of the 36 rows where quarto emits a heading it emits the marker-stripped text, and in every row
 * where it emits nothing the reason is the underline's column or code depth, never the marker.
 *
 * ⚠ **The previous ` {0,3}` was not merely too narrow — the DECLINE it gated was wrong at every
 * column, and had been since this model's first commit.** Its docstring said Pandoc "strips the
 * marker and nests the heading INSIDE the `<li>`" and concluded that this model "must decline (a
 * false negative) rather than emit a wrong top-level heading whose text includes the literal
 * marker". The first half is correct; the conclusion does not follow, because the heading Pandoc
 * nests is a real heading with obtainable text. Rendered: `- marker title` / `===` renders
 * `<h1>marker title</h1>`, so the decline DELETED it (Learning #300 — the docstring's
 * "Confirmed against the real Quarto CLI" confirmed the nesting, never the emptiness).
 */
/** The three bullet-list marker characters, shared by the trigger above and `setextTitleText`. */
const BULLET_CHARS = "-*+";
const BULLET_LIST_MARKER = /^[ \t]*[-*+][ \t]/;
/**
 * What is left when the run above consumed every marker but the LAST, which carries no content —
 * `- -`, `-   -`, `- * -`, `+ + +`. The innermost list item is EMPTY, and an empty item yields no
 * heading text: all four render NO heading (measured, `scratchpad/s201/tbrk` and `tb2`).
 * Returning `""` for them routes into `buildHeading`'s existing "nothing displayable remains"
 * `null`, so this adds no new decision — it stops the strip pretending a bare marker is content.
 *
 * ⚠ These four are rows the OLD blanket decline covered BY ACCIDENT, and the strip alone broke
 * all four. They are the first error this session's change introduced and they are closed here,
 * not filed: the decision rule is *would this defect exist if my change did not ship*, and it
 * would not.
 *
 * ⚠ A BARE `-` with no trailing whitespace never reaches here — it fails `BULLET_LIST_MARKER`, so
 * `-` / `===` still reports `h1:-` where quarto reports nothing. That is a SEPARATE pre-existing
 * phantom on a row this guard has never covered, and it is left FILED rather than fixed as
 * by-catch.
 */
const BARE_BULLET_TAIL = /^[-*+][ \t]*$/;
/**
 * A THEMATIC BREAK spelled with a bullet character — the one shape where the marker SURVIVES into
 * the heading text, which is why the strip has to know about it.
 *
 * Three or more of the SAME character, `-` or `*`, whitespace permitted between and around them
 * and nothing else on the line. Such a line is a thematic break rather than a list, so pandoc's
 * setext parse claims it whole and the heading text is the line LITERALLY. Measured
 * (`scratchpad/s201/tbrk`, `scratchpad/s201/tb2`), and BOTH boundaries matter:
 *
 *   `- - -`   `* * *`   `- - - -`   `-  -  -`   →  heading, text literal
 *   `- - - x`                                   →  `h1:x` — content makes it a LIST after all
 *   `+ + +`                                     →  NO heading
 *   `- -`   `-   -`   `- * -`                   →  NO heading
 *
 * ⚠ `+` is excluded on purpose and the exclusion is MEASURED, not transcribed: it is a bullet
 * character but not one of CommonMark's thematic-break characters, so `+ + +` falls through to
 * `BARE_BULLET_TAIL` and renders nothing. `- - -` and `+ + +` differ by one character and quarto
 * answers them oppositely — which is the same lesson as Session 200's fence-char finding, in a
 * different row: a family that looks uniform in the source is not necessarily uniform in pandoc.
 *
 * ⚠ This row is deliberately NOT a general thematic-break recogniser and must not be reused as
 * one. It is reached only for a line that already matched `BULLET_LIST_MARKER`, so the `_` break
 * spelling and the run-together `---` / `***` spellings never come here — and `---` reaching here
 * would be actively wrong, since that IS this model's setext underline.
 */
const BULLET_THEMATIC_BREAK = /^[ \t]*(?:-[ \t]*){3,}$|^[ \t]*(?:\*[ \t]*){3,}$/;
/**
 * The DISPLAY TEXT of a setext title line, once Pandoc's list nesting has been accounted for.
 *
 * Replaces a blanket decline (see `BULLET_LIST_MARKER`) with the measured answer, so a bullet
 * marker on a title line costs neither the heading nor a wrong text. Everything that is not a
 * bullet marker line is returned untouched — an ordered marker, a block-quote marker, ordinary
 * prose — which is what quarto does with them (14 of 14 ordered-marker rows agree unchanged,
 * `scratchpad/s201/ax`, `ord_*`).
 *
 * ⚠ **`columns` is what makes this container-relative, and it is the ONLY column question this
 * row asks: is the title line INDENTED CODE?** At code depth pandoc never parses the line as a
 * list item, so there is no nesting to strip and the marker belongs to the heading's text —
 * measured as a clean boundary over 15 documents (`scratchpad/s201/cd`): at top level indents
 * 0–3 strip and 4+ keep; inside a `-   item` (content column 4) indents 4–7 strip and 8+ keep.
 * The condition is `indentedCodeLine`, REUSED rather than re-derived, so the depth at which a
 * marker stops being a marker cannot drift from the depth at which a container stops being a
 * container (Session 196) or a fence stops being a fence (Session 200).
 *
 * ⚠ **This is what the old ` {0,3}` cap was actually approximating** — code depth counted from
 * source column 0 instead of from the enclosing block — which is why it was accidentally RIGHT at
 * top level and wrong at every container column. The cap was a correct rule with a wrong origin.
 * It was found by a BLIND adversarial lens (`adv/ws`, `ws_02`) after this session's own designed
 * corpora had scored clean on it, which is the fifth session running that a designed corpus was
 * not enough (Learning #298).
 */
function setextTitleText(rawText: string, columns: readonly number[] | null): string {
  if (!BULLET_LIST_MARKER.test(rawText) || BULLET_THEMATIC_BREAK.test(rawText)) {
    return rawText;
  }
  // ⚠ ONE MARKER AT A TIME, carrying the content column each one opens — NOT a single
  // `(?:[-*+][ \t]+)+` run. A regex run has no notion of where the markers SIT, and a marker can
  // be at code depth INSIDE the item its predecessor opened: measured over `scratchpad/s201/gap`,
  // `-` + 1..4 spaces + `- title` strips BOTH markers while `-` + 5..7 spaces + `- title` strips
  // only the FIRST, because a gap wider than four puts the item's content in indented code.
  let cut: number | null = null; // index just past the last marker actually stripped
  let index = 0;
  let column = 0;
  let base: readonly number[] | null = columns;
  for (;;) {
    // the indent before this marker, measured in COLUMNS (tab stop 4 — see `indentColumn`)
    let at = index;
    let atColumn = column;
    while (at < rawText.length && (rawText[at] === " " || rawText[at] === "\t")) {
      atColumn = rawText[at] === "\t" ? atColumn + 4 - (atColumn % 4) : atColumn + 1;
      at += 1;
    }
    if (at >= rawText.length || !BULLET_CHARS.includes(rawText[at])) {
      break; // whitespace only, or the next thing is not a bullet character
    }
    if (columnIsCodeDepth(atColumn, base)) {
      break; // this marker is INDENTED CODE, so it is not a marker at all — keep it verbatim
    }
    // the gap after the marker, and the column its content therefore starts at
    let after = at + 1;
    let contentColumn = atColumn + 1;
    while (after < rawText.length && (rawText[after] === " " || rawText[after] === "\t")) {
      contentColumn = rawText[after] === "\t" ? contentColumn + 4 - (contentColumn % 4) : contentColumn + 1;
      after += 1;
    }
    if (after === at + 1) {
      break; // no whitespace after it — `-text` is not a marker (and `-` alone is the filed item)
    }
    // CommonMark: a gap wider than FOUR is indented code, and then the item's content column is
    // one past the marker rather than at the content. This is the whole of `cont_12`.
    base = [contentColumn - (atColumn + 1) > 4 ? atColumn + 2 : contentColumn];
    cut = after;
    index = after;
    column = contentColumn;
  }
  if (cut === null) {
    return rawText;
  }
  const stripped = rawText.slice(cut);
  return BARE_BULLET_TAIL.test(stripped) ? "" : stripped;
}
/**
 * A balanced RCDATA element written entirely on ONE line — `<title>Hello</title>`.
 *
 * ⚠ **This exists because dropping `textarea`/`title` from the opener list DELETED three real
 * headings (Session 187), and only the two-direction corpus score found them.** Their UNCLOSED
 * openers open nothing, because both are RCDATA: everything after them is text until the
 * closer, so an unterminated one swallows the rest of the document and the heading below never
 * forms. A BALANCED pair on one line swallows nothing — the element ends where it began, the
 * paragraph really is interrupted, and the heading below is real (measured, in both contexts).
 * The backreference is what distinguishes the two, and it is the only thing that can: the
 * opener bytes are identical.
 */
/**
 * The TAIL of a tag line, and it is half the rule (Session 187).
 *
 * A line whose HEAD is a block tag is a block opener only if, after the tag name, the line
 * either ENDS AT A `>` (trailing whitespace allowed) or contains NO `>` at all. Measured:
 *
 *   `<div>` / `<div>x</div>` / `<title>Doc</title id="y">`   block — the line ends at a `>`
 *   `<div class="x"`                                          block — the `>` is on a line below
 *   `<div> trailing text` / `</note> and so on`               PROSE — it ends at neither
 *
 * ⚠ **Every defect this session introduced came from omitting this**, and no corpus of mine
 * could have found it: every probe I wrote put the tag ALONE on its line, so the axis was
 * invisible. A ten-lens adversarial sweep, written by agents that had never seen those
 * corpora, rendered 219 documents and produced three DELETIONS and eight phantoms, all of
 * them here (Learning #239 — a clean corpus score is evidence about the corpus).
 */
const TAG_LINE_TAIL = "(?:[^>]*|.*>[ \\t]*)$";
/**
 * A balanced RCDATA element written entirely on ONE line — `<title>Hello</title>`.
 *
 * ⚠ **The CLOSER may carry attributes, and demanding it not was measured DELETING three real
 * headings.** `</title id="y">` and `</textarea class="y">` are closers pandoc accepts, and one
 * sweep probe wrote `</title\f>` with a form feed. The first draft of this pattern ended
 * `</\\1[ \\t]*>`, which is an unmeasured narrowing of exactly the kind Session 185 lost four
 * headings to one session earlier.
 */
const RCDATA_ONE_LINE_SRC = "<(textarea|title)\\b[^>]*>.*</\\1\\b[^>]*>[ \\t]*$";
/**
 * PANDOC's own HTML tag classification, transcribed from
 * `Text.Pandoc.Readers.HTML.TagCategories` at **pandoc 3.6.3** — the build quarto 1.7.33
 * bundles (`quarto pandoc --version`) — and then MEASURED entry by entry on the real
 * `quarto render` path, one document per name per context. The transcription is the
 * hypothesis; the 2,051 rendered documents are the authority.
 *
 * ⚠ **THE SET NAMES ARE THE RULE, and that is why there are two of them.**
 *
 *   `blockTags` (= `blockHtmlTags ∪ blockDocBookTags ∪ epubTags`) — block in EVERY context,
 *       whether or not a paragraph is already open.  `PANDOC_BLOCK_OPEN_TAGS` (98 names).
 *   `eitherBlockOrInline` — block ONLY where no paragraph is open.  Against an OPEN
 *       paragraph these are INLINE and interrupt nothing.  `PANDOC_EITHER_TAGS` (16 names).
 *
 * Measured, six shapes across four contexts: against an open paragraph 98 openers and 100
 * closers interrupt; with no paragraph open, 115 and 117.  The difference is exactly
 * `eitherBlockOrInline` (+ processing instructions, which behave the same way).
 *
 * ⚠ **`<ins>x</ins>` AND `<em>x</em>` RENDER BYTE-IDENTICALLY against an open paragraph.**
 * `BACKLOG.md` asserted the opposite, and listed `svg`, `button`, `video`, `audio`, `object`,
 * `embed`, `noscript`, `map`, `progress`, `area`, `applet`, `ins` and `del` as block openers
 * on the strength of it.  Every one of those is in `eitherBlockOrInline`, not `blockTags`;
 * the item conflated the two sets.  Of the sixteen names it named, only `meta`, `canvas` and
 * `output` are in `blockTags` — and those three ARE now recovered (see `HTML_BLOCK_OPEN`).
 *
 * ⚠ **DO NOT MERGE THESE TWO CONSTANTS.** Folding `eitherBlockOrInline` into
 * `HTML_BLOCK_OPEN` puts it ahead of the `paragraphOpen` bail and fabricates a heading below
 * every `<ins>`, `<svg>` and `<button>` that sits inside a paragraph.  Folding it the other
 * way — dropping it from the post-bail row — deletes the heading below every one that does
 * not.  The split IS the measurement.
 */
const PANDOC_BLOCK_OPEN_TAGS = "informalequation|programlistingco|informalexample|informalfigure|programlisting|classsynopsis|informaltable|literallayout|segmentedlist|funcsynopsis|itemizedlist|variablelist|calloutlist|cmdsynopsis|mediaobject|orderedlist|bibliolist|blockquote|figcaption|formalpara|screenshot|simplelist|glosslist|important|procedure|colgroup|epigraph|equation|fieldset|frameset|noframes|qandaset|screenco|synopsis|address|article|caption|caution|default|details|example|isindex|section|sidebar|simpara|summary|warning|canvas|center|figure|footer|header|hgroup|msgset|output|screen|script|switch|aside|style|table|tbody|tfoot|thead|body|case|form|head|html|main|menu|meta|note|para|task|col|dir|div|nav|pre|tip|dd|dl|dt|hr|li|ol|td|th|tr|ul|p|h[1-6]";
const PANDOC_BLOCK_CLOSE_TAGS = "informalequation|programlistingco|informalexample|informalfigure|programlisting|classsynopsis|informaltable|literallayout|segmentedlist|funcsynopsis|itemizedlist|variablelist|calloutlist|cmdsynopsis|mediaobject|orderedlist|bibliolist|blockquote|figcaption|formalpara|screenshot|simplelist|glosslist|important|procedure|colgroup|epigraph|equation|fieldset|frameset|noframes|qandaset|screenco|synopsis|textarea|address|article|caption|caution|default|details|example|isindex|section|sidebar|simpara|summary|warning|canvas|center|figure|footer|header|hgroup|msgset|output|screen|script|switch|aside|style|table|tbody|tfoot|thead|title|body|case|form|head|html|main|menu|meta|note|para|task|col|dir|div|nav|pre|tip|dd|dl|dt|hr|li|ol|td|th|tr|ul|p|h[1-6]";
const PANDOC_EITHER_TAGS =
  "applet|area|audio|button|del|embed|iframe|ins|map|noscript|object|progress|source|svg|track|video";
/**
 * A raw HTML line that closes a paragraph ONLY where none is open — pandoc's `blockTags`
 * ∪ `eitherBlockOrInline`, plus a processing instruction and a comment, both of which are
 * measured to behave the same way (`<?xml …?>` and `<!-- c -->` each leave the paragraph
 * closed here and each are INLINE against an open one).
 *
 * ⚠ **This replaces the bare `/^ {0,3}</` row, and the narrowing is the DELETING direction.**
 * Session 184 narrowed the same row to `<!--`/`<?`, scored ZERO headings lost over 476
 * rendered documents, and an adversarial sweep then measured it deleting 20 real headings —
 * because it removed the tag test instead of replacing it.  The replacement here is a NAME
 * set measured over 191 tag names in this exact context, plus 26 non-tag spellings.
 *
 * ⚠ **The indent stays ` {0,3}`, unlike `HTML_BLOCK_OPEN`'s `[ \t]*`.** That is not an
 * oversight: this row is only ever reached with NO paragraph open, and 4+ spaces there is an
 * indented code block, which the row above already claims.  Widening it would be an
 * unmeasured change to a second axis.
 *
 * ⚠ **The trailing `$` branch is KEPT, and removing it was measured deleting a heading.**
 * `BACKLOG.md` files `<div` with no `>` as a phantom our `(?:[ \t/>]|$)` admits.  It is one
 * only when the document contains no `>` at all afterwards: pandoc's `htmlTag` consumes
 * `manyTill anyChar endAngle`, which SPANS NEWLINES, so `<div` / `class="x">` / `# ATX Below`
 * really does open a block and really does render the heading.  A per-line regex cannot tell
 * the two apart, so the rare phantom is retained over the ordinary deletion.
 */
const HTML_BLOCK_OR_INLINE_OPEN = new RegExp(
  // Class 1 — `blockTags`, which tolerates 0-3 spaces exactly as `HTML_BLOCK_OPEN` does.
  "^ {0,3}<(?:" + PANDOC_BLOCK_OPEN_TAGS + ")(?=[ \\t/>]|$)" + TAG_LINE_TAIL +
  "|^ {0,3}</(?:" + PANDOC_BLOCK_CLOSE_TAGS + ")(?=[ \\t/>]|$)" + TAG_LINE_TAIL +
  "|^ {0,3}" + RCDATA_ONE_LINE_SRC +
  // ⚠ Class 2 — `eitherBlockOrInline` — needs COLUMN ZERO, and that is measured, not tidied.
  // `Intro.` / (blank) / (indent)`<button>` / Title / `===` renders the heading at indent 0
  // and NOT at indent 1 or 3, while `<div>` renders it at 0, 1 and 3 alike. The 4-space and
  // tab rows DO render it, but via the indented-code rule on another row, not via the tag —
  // scoring them as agreement is what hid this.
  "|^</?(?:" + PANDOC_EITHER_TAGS + ")(?=[ \\t/>]|$)" + TAG_LINE_TAIL +
  // A processing instruction, opener `<?…` or closer `</?…`.
  "|^ {0,3}</?\\?" + TAG_LINE_TAIL +
  // A COMPLETE HTML comment. An unterminated one is measured NOT to be a block.
  "|^ {0,3}<!--.*-->[ \\t]*$",
  "i",
);
/**
 * Pandoc's raw-TeX macro classification — the NAME lists, and the three classes they form.
 *
 * ⚠ **PANDOC CLASSIFIES RAW TeX BY MACRO NAME, AND THE RULE IS CONTEXT-DEPENDENT — exactly
 * as it is for HTML tags (Session 187), and for the same reason: one list cannot express it.**
 * Transcribed from `Text.Pandoc.Readers.LaTeX` at **pandoc 3.6.3** (the build quarto 1.7.33
 * bundles, `quarto pandoc --version`) and then MEASURED entry by entry — 736 candidate names
 * in three contexts, 4,416 documents rendered through the real `quarto render` path.
 *
 * TWO gates decide it, and NEITHER is the one the filed item assumed:
 *
 *   1. `endline` in the markdown reader carries **no raw-TeX guard at all**. A newline never
 *      ends a paragraph on account of TeX below it. What ends the paragraph is that no INLINE
 *      parser consumes the backslash — `inline` dispatches `'\\' -> math <|> escapedNewline
 *      <|> escapedChar <|> rawLaTeXInline'`, and `symbol`, the last resort, refuses a
 *      backslash where `rawTeXBlock` would match.
 *   2. So an open paragraph is interrupted **iff `inlineCommand'` FAILS**, and its guard is
 *      `isInlineCommand name || not (isBlockCommand name)` — false only for a name in
 *      `blockSet \ inlineSet`, where `blockSet = keys(blockCommands) ∪ treatAsBlock` and
 *      `inlineSet = keys(inlineCommands) ∪ treatAsInline`.
 *
 * The measurement collapsed all 736 names into just SIX behaviours, which are these classes:
 *
 *   **A — block in EVERY context** (`blockSet \ inlineSet`), the only class that interrupts an
 *     open paragraph. It splits three ways by ARITY, and the split is measured, not reasoned:
 *       `…_ANY`  (20) block bare or with arguments — `\maketitle`, `\usepackage{amsmath}`
 *       `…_ARG`  (46) block ONLY with an argument — `\section{x}` is a block, a bare
 *                     `\section` is nothing at all, because the map's own parser needs the
 *                     argument, fails without it, and the token falls through to the inline path
 *       `…_BARE` (7)  block ONLY without one — `\par` is a block and `\par{x}` is NOT: the
 *                     parser consumes `\par` and the leftover `{x}` opens a paragraph that
 *                     then swallows the heading below it
 *   **B — block only where NO paragraph is already open.** `blockSet ∩ inlineSet` — the five
 *     names `clearpage hspace newpage pagebreak vspace`, which pandoc puts in BOTH lists on
 *     purpose — plus every UNKNOWN macro. This class is why the project's own record appeared
 *     to contradict itself: `RAW_TEX_ENV_OPEN`'s docstring measured these in the PARAGRAPH
 *     context (inline) and `BACKLOG.md` measured the same names in the FRESH context (block).
 *     Both were right. It needs no list — it is the default.
 *   **C — inline in EVERY context** (`inlineSet \ blockSet`, 316 names). `\textbf{bold}`,
 *     `\emph{x}`, `\noindent`, `\index{x}`. This is the list the wide row was missing, and
 *     matching it is the phantom the filed item was about.
 *
 * ⚠ **THE TAIL OF THE LINE IS PART OF THE RULE, and it was measured, not assumed** (Learning
 * #252 — a per-line predicate anchored at the line's HEAD cannot self-test its tail, so this
 * axis was probed separately: 8 macros × 12 tails × 2 contexts). A macro line is a block only
 * when what follows the macro and its arguments is whitespace, or FURTHER NON-INLINE MACROS.
 * Every one of these kills it, in every class (measured):
 *
 *     \clearpage and more prose      \clearpage.        \clearpage % a comment
 *     \maketitle \textbf{b}          ← a trailing class-C macro kills it too
 *
 * …while `\clearpage\newpage` and `\clearpage \newpage` really are blocks, which is why the
 * tail admits a run of non-inline macros rather than demanding end-of-line.
 *
 * ⚠ **KNOWN RESIDUAL, disclosed rather than hidden: arity beyond the first argument group is
 * not modelled.** `\usepackage{amsmath}{}` is measured NOT a block (its parser takes exactly
 * one group, and the leftover `{}` opens a paragraph) while `\maketitle{}` IS one. Encoding
 * per-macro arity is beyond a per-line predicate; the residual is a phantom on a shape no real
 * document writes, which is the permitted direction.
 */
const PANDOC_BLOCK_MACROS_ANY =
  "bibliographystyle|addcontentsline|addtocontents|listoffigures|addtocounter|listoftables|" +
  "makeglossary|pdfstringdef|usepackage|makeindex|maketitle|markright|hyperdef|markboth|" +
  "markleft|pdfannot|include|special|subfile|ignore";
const PANDOC_BLOCK_MACROS_ARG =
  "setdefaultlanguage|lstinputlisting|setmainlanguage|addbibresource|lowertitleback|" +
  "subsubsection\\*|uppertitleback|framesubtitle|subparagraph\\*|subsubsection|bibliography|" +
  "frontispiece|subparagraph|theoremstyle|fancybreak\\*|plainbreak\\*|subsection\\*|blockquote|" +
  "centerline|dedication|extratitle|fancybreak|frametitle|paragraph\\*|plainbreak|publishers|" +
  "subsection|paragraph|signature|titlehead|chapter\\*|section\\*|subtitle|address|caption|" +
  "chapter|closing|opening|section|subject|author|part\\*|title|write|date|part";
const PANDOC_BLOCK_MACROS_BARE =
  "raggedright|pfbreak\\*|pfbreak|hrule|strut|item|par";
const PANDOC_INLINE_MACROS =
  "textogonekcentered|MakeTextLowercase|MakeTextUppercase|textquotedblright|textquotedblleft|" +
  "foreignlanguage|includegraphics|textasciicircum|textsuperscript|listfigurename|" +
  "lstlistingname|texorpdfstring|textasciitilde|textquoteright|Footcitetexts|GLSdescplural|" +
  "Glsdescplural|MakeLowercase|MakeUppercase|addabbrvspace|documentclass|footcitetexts|" +
  "foreignquote\\*|glsdescplural|listtablename|mkbibbrackets|textbackslash|textquoteleft|" +
  "textsubscript|Footcitetext|abstractname|contentsname|footcitetext|foreignquote|glossaryname|" +
  "graphicspath|hyphenquote\\*|Citeyearpar|adddotspace|chaptername|citeyearpar|hyphenquote|" +
  "mkbibitalic|mkbibparens|passthrough|prefacename|seealsoname|textcircled|textgreater|" +
  "titleformat|togglefalse|Parencite\\*|Parencites|Supercites|citeauthor|ensuremath|figurename|" +
  "headtoname|ifstrequal|includesvg|mintinline|mkbibquote|nhttfamily|parencite\\*|parencites|" +
  "supercites|textnormal|toggletrue|Autocite\\*|Autocites|Footcites|Parencite|Smartcite|" +
  "Supercite|Textcites|autocite\\*|autocites|backslash|bibstring|copyright|footcites|hyperlink|" +
  "indexname|lowercase|lstinline|mkbibbold|mkbibemph|newtoggle|nohyphens|nolinkurl|parencite|" +
  "proofname|smartcite|supercite|tablename|textcites|textcolor|underline|uppercase|Acrshort|" +
  "Autocite|Citeyear|Footcite|Textcite|acrshort|autocite|bfseries|citealp\\*|citealt\\*|" +
  "citetext|citeyear|colonhyp|colorbox|enclname|endinput|enquote\\*|footcite|footnote|hyperref|" +
  "iftoggle|lettrine|noindent|numrange|pagename|partname|qtyrange|textcite|textless|textnhtt|" +
  "Acrfull|Acrlong|GLSdesc|Glsdesc|SIrange|acrfull|acrlong|autocap|autoref|bibname|citealp|" +
  "citealt|enquote|faCheck|faClose|glsdesc|itshape|numlist|qtylist|refname|scshape|seename|" +
  "slshape|SIlist|adddot|ccname|citeal|citep\\*|citet\\*|dothyp|global|hyphen|newtie|nocite|" +
  "pounds|textbf|textit|textmd|textrm|textsc|textsf|textsl|texttt|textup|thanks|Cite\\*|Cites|" +
  "Glspl|LaTeX|alert|begin|bshyp|cite\\*|citep|cites|citet|eqref|fshyp|glspl|ifdim|index|label|" +
  "ldots|mdots|newif|slash|today|uline|vdots|Acfp|Aclp|Acsp|Cite|Cref|Verb|acfp|aclp|acsp|cite|" +
  "cref|dots|edef|emph|euro|gdef|hbox|href|mbox|sout|unit|vbox|verb|vref|xdef|Acf|Acl|Acp|Acs|" +
  "Gls|TeX|acf|acl|acp|acs|and|ang|bar|def|end|gls|hyp|let|num|qed|qty|ref|sep|sim|url|AA|AE|Ac|" +
  "OE|RN|Rn|SI|aa|ac|ae|bf|em|hl|it|lq|oe|ps|rm|rq|si|sl|ss|st|tt|ul|G|H|L|O|P|S|U|b|c|d|f|h|i|" +
  "j|k|l|o|r|t|u|v";
/** A control-sequence NAME ends at the first non-letter: `\vspace2` is `vspace` then `2`. */
const MACRO_NAME_END = "(?![a-zA-Z])";
/** One argument group, optional (`[…]`) or braced (`{…}`), tolerating one level of nesting
 *  so `\newcommand{\foo}{a{b}c}` is still recognised as consuming its arguments. */
const MACRO_ARG_GROUP = "(?:\\[[^\\]]*\\]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})";
/** A macro that is NOT class C — the only thing (besides whitespace) allowed to follow a
 *  block macro on its line without turning the line into prose. */
const NON_INLINE_MACRO =
  "\\\\(?!(?:" + PANDOC_INLINE_MACROS + ")" + MACRO_NAME_END + ")[a-zA-Z]+" + MACRO_ARG_GROUP + "*";
/** What may follow a block macro's own arguments: a run of non-inline macros, then only
 *  whitespace to end of line. Measured — see the tail note above. */
const MACRO_LINE_TAIL = "(?:[ \\t]*" + NON_INLINE_MACRO + ")*[ \\t]*$";
/**
 * Class A — a raw-TeX macro that opens a block in EVERY context, so it is tested AHEAD of the
 * `paragraphOpen` bail beside `RAW_TEX_ENV_OPEN`. This is the heading-RECOVERING direction:
 * before it, `prose` / `prose` / `\maketitle` / `# ATX Below` lost its heading outright.
 *
 * ⚠ **THE LEADING-WHITESPACE CLASS IS `[ \t]*` AND CARRIES NO CAP, WHICH IS THE OPPOSITE OF
 * THE CLASS-B ROW BELOW — the word "indent" names two rules that fail in opposite directions
 * (Session 190).** Class A never reaches pandoc's `rawTeXBlock` at all on the path that
 * matters here. It interrupts an open paragraph by making `inlineCommand'` FAIL —
 *
 *     guard $ isInlineCommand name || not (isBlockCommand name)
 *
 * — and that guard runs at the INLINE level, reached through `inline`'s `'\\'` dispatch on a
 * paragraph's continuation line, where the leading whitespace has already been consumed as
 * inter-word space. There is no `skipNonindentSpaces` on that path and no column rule anywhere
 * near it, so **the indent is not part of the question**. `^ {0,3}` therefore did not model
 * CommonMark's indented-code rule; it simply lost the class-A test on indented lines, and
 * Session 183's `paragraphOpen` bail then DELETED the heading below every one of them.
 *
 * Measured over the full 0-8 indent sweep in both contexts: `\maketitle` releases the heading
 * at EVERY indent and at one tab, two tabs and space+tab, while `\clearpage` — class B, the
 * control that decides it — releases it at NONE of them, at any indent. Widening class B the
 * same way restores the 1,043 phantoms Session 189 removed; capping class A deletes a real
 * heading under every indented `\maketitle`.
 *
 * ⚠ **The NAME is still the whole rule, and widening the indent did not weaken it.** The tail
 * rule, the arity split (`\par` block / `\par{x}` not; `\section{x}` block / bare `\section`
 * not) and the class-C exclusion all still decide the line — each re-measured AT INDENT 4 in
 * its own right rather than inherited from column 0. This is the same repair, for the same
 * reason, that `HTML_BLOCK_OPEN`'s indent class already carries (Session 185).
 */
const RAW_TEX_BLOCK_MACRO = new RegExp(
  "^[ \\t]*\\\\(?:" + PANDOC_BLOCK_MACROS_ANY + ")" + MACRO_NAME_END +
    MACRO_ARG_GROUP + "*" + MACRO_LINE_TAIL +
  "|^[ \\t]*\\\\(?:" + PANDOC_BLOCK_MACROS_ARG + ")" + MACRO_NAME_END +
    MACRO_ARG_GROUP + "+" + MACRO_LINE_TAIL +
  "|^[ \\t]*\\\\(?:" + PANDOC_BLOCK_MACROS_BARE + ")" + MACRO_NAME_END + MACRO_LINE_TAIL,
);
/**
 * A raw-TeX macro line that is block where NO paragraph is open — classes A and B, i.e.
 * everything EXCEPT class C. Used by `CLOSES_PARAGRAPH` and `OPENS_FRESH_BLOCK`, both of
 * which sit BEHIND the `paragraphOpen` bail.
 *
 * ⚠ **Narrowing this row is the heading-DELETING direction, and Session 184 already got it
 * wrong once.** It narrowed the row to a BARE macro alone on its line, scored ZERO headings
 * lost over 476 rendered documents, and was then measured deleting ELEVEN real headings —
 * `\vspace{1em}`, `\usepackage{amsmath}`, `\newcommand{…}`, `\setlength{…}`,
 * `\definecolor{…}`, `\newpage[2]`, `\newpage{}`, `\clearpage\newpage`, `\vspace2` and
 * the starred forms are all raw BLOCKS despite carrying braces. A clean corpus score is
 * evidence about the corpus, not about the rule (Learning #239). All eleven were RE-RENDERED
 * this session and all eleven still hold, so they are pinned as controls on the narrowing.
 *
 * The rule is not about braces at all: it is the NAME, and the default matters more than the
 * list. An UNKNOWN macro is class B — a BLOCK here — so the exclusion is expressed as a
 * negative lookahead over class C rather than an allowlist of block names. Defaulting the
 * other way would delete the heading under every macro pandoc has never heard of, which is
 * most of the macros anyone writes.
 */
const RAW_TEX_BLOCK_OR_MACRO_LINE = new RegExp(
  "^([ \\t]*)\\\\(?!(?:" + PANDOC_INLINE_MACROS + ")" + MACRO_NAME_END + ")[a-zA-Z]",
);
/**
 * Whether a raw-TeX macro line is a BLOCK at this point in the document — the row above,
 * plus the INDENT question the row cannot answer alone (Session 189).
 *
 * ⚠ **`^ {0,3}` was wrong in BOTH directions, and the two are not symmetric.** Pandoc's
 * `rawTeXBlock` begins `lookAhead $ try $ char '\\' >> letter` with no `skipNonindentSpaces`
 * before it, so the backslash must sit at the CURRENT PARSE COLUMN. At top level that column
 * is 0 and ` \clearpage` is ordinary paragraph text — three phantom headings per macro,
 * measured. But inside a list item pandoc re-parses the item's content DEDENTED, so the
 * item's content column IS that sub-document's column 0, and demanding a literal 0 DELETES
 * the heading under every raw-TeX block anyone indents inside a list.
 *
 * Session 184 built exactly the literal-0 form, measured it at 3 phantoms removed against
 * **1 real heading deleted**, and rejected it. This is that rejection, repaired: the column
 * is not a constant, it is the containing block's, so the scanner has to carry it.
 *
 * `columns` is `null` where the containing block's column cannot be known — see
 * `contentColumns` in `computeRegions`. Null keeps the OLD ` {0,3}` width, which is the
 * fail-safe direction: an indent we wrongly admit costs a pre-existing phantom, an indent we
 * wrongly refuse costs a real heading.
 *
 * ⚠ **The indent is a COLUMN, and a TAB reaches one (Session 194).** Session 189 wrote this row
 * spaces-only on purpose — "a leading tab is left to `INDENTED_CODE_LINE`, exactly as ` {0,3}`
 * did" — and that was sound while the indented-code row hard-coded `\t` as "deep enough".
 * Session 193 replaced that row with real column arithmetic, and from then on a tab-indented
 * macro fell between the two rows and was invisible to both. It stayed hidden only because the
 * container stack's own pop was ALSO spaces-only: the wrong pop cleared the stack, which let
 * the indented-code row fire and give the right answer for the wrong reason. Session 194 fixed
 * the pop and re-scored Session 193's corpora, which measured the accident's removal as **6
 * lost headings** — so this row and that one are one rule, and are now measured by one
 * function. Re-scored after: `gnd` 167/12/0 -> 167/0/0, `cb` 178/0/6 -> 184/0/0.
 *
 * ⚠ The column must still MATCH — this is not blanket tab acceptance. A `1. ` item's content
 * column is 3 and a lone tab reaches 4, so the macro is NOT a block there, and quarto renders
 * no heading (measured).
 */
function rawTexMacroLineIsBlock(line: string, columns: readonly number[] | null): boolean {
  const m = RAW_TEX_BLOCK_OR_MACRO_LINE.exec(line);
  if (m === null) {
    return false;
  }
  const indent = indentColumn(line);
  return columns === null ? indent <= 3 : columns.includes(indent);
}
/**
 * The content column a LIST ITEM opened by `line` gives its content, or `null` if the line
 * opens no list item (Session 189). Measured exhaustively — 2,394 rendered documents over 19
 * marker spellings × 7 spacings × 2 marker indents × a 0–8 indent sweep:
 *
 *     content column = markerIndent + markerLength + spacesAfterMarker
 *
 * with two corrections that are the whole reason this is a function and not arithmetic at
 * the call site:
 *
 *   - **five or more spaces after the marker collapse to one.** `-     x` gives column 2,
 *     not 6 — the content is a code block inside the item, and the item's own column is
 *     `marker + 1`. Four spaces is the last that counts: `-    x` really is column 5.
 *   - **a TAB after the marker expands to the next multiple of 4 COLUMNS**, not to a fixed
 *     number of spaces. `-\tx` is column 4 and `10.\tx` is column 4, but `100.\tx` is 8.
 *
 * ⚠ **This function is deliberately WIDER than pandoc, and the asymmetry is load-bearing.**
 * A column pushed that pandoc does not open merely re-admits an indent that was already
 * admitted before this session — a pre-existing phantom. A column NOT pushed that pandoc DOES
 * open deletes a real heading. So every marker shape pandoc has is here, including the fancy
 * lists CommonMark lacks (`a.` `A)` `i.` `iv.` `#.` `(1)` `(a)`) — a scanner written against
 * CommonMark would open no container for those and delete the heading in every one.
 *
 * The one measured spelling that is NOT a list is kept anyway for the same reason: `A. x`,
 * a single capital with EXACTLY one space, is pandoc's initial-in-a-name rule ("B. Russell")
 * and opens nothing. Admitting its column costs a phantom; refusing it would cost a heading
 * if the rule is ever narrower than measured.
 */
function listItemContentColumn(line: string): number | null {
  // ⚠ The letter run is `{1,9}`, not a single letter, and a single letter is what the first
  // draft had. It cost a real heading in the corpus score: `iv.` is a ROMAN NUMERAL — a list
  // marker pandoc accepts and a one-letter pattern does not — so no column was pushed and the
  // heading under `   \clearpage` at its column 3 was DELETED. Accepting a whole letter run
  // also accepts `Mr. Smith`, which is not a list; that costs a phantom at one indent and is
  // the direction this function is required to fail in.
  // ⚠ The MARKER'S OWN INDENT is a COLUMN, not a count of spaces (Session 196). The class was
  // `( *)`, so a TAB-indented marker matched nothing at all and opened NO container — while the
  // arithmetic AFTER the marker had measured columns since Session 189. See `indentColumn`: a
  // tab advances to the next 4-column stop, so `\t- inner` inside a `- outer` item is a marker
  // at column 4 whose content column is 6, exactly as `    - inner` is (measured — a paired
  // TAB/SPACE equivalence over the real `quarto render` path).
  const m = /^([ \t]*)([-+*]|\(?(?:\d{1,9}|[a-zA-Z]{1,9}|#)[.)])([ \t]|$)/.exec(line);
  if (m === null) {
    return null;
  }
  // Two different measures of the same point, and they are NOT interchangeable: `after` is a
  // SLICE, so it needs the marker's end as a character OFFSET, while every column returned
  // below is arithmetic on the marker's end as a COLUMN. They coincide only while the indent
  // is spaces-only, which is exactly the assumption this change removes.
  const markerEndOffset = m[1].length + m[2].length;
  const markerEndColumn = indentColumn(line) + m[2].length;
  const after = line.slice(markerEndOffset);
  if (after.startsWith("\t")) {
    return markerEndColumn + 4 - (markerEndColumn % 4);
  }
  const spaces = /^ */.exec(after)![0].length;
  return markerEndColumn + (spaces === 0 || spaces >= 5 ? (after === "" ? 0 : 1) : spaces);
}
/**
 * Whether `line` CLOSES the containers deeper than its own indent even though the line above
 * it is not blank (Session 198). Pandoc absorbs a shallow non-blank line into the enclosing
 * item LAZILY — whatever it says — with exactly one exception: a LIST START always closes the
 * deeper item. This is that exception, and it is the second half of the container pop's
 * suppression test in `computeRegions`.
 *
 * ⚠ **This is deliberately NARROWER than `listItemContentColumn`, and the asymmetry is the
 * REVERSE of that function's.** There, a column pushed that pandoc does not open costs a
 * pre-existing phantom while one not pushed DELETES a heading — so that function accepts
 * `Dr.` and `Mr.` on purpose. Here the polarity is inverted: a container POPPED that pandoc
 * keeps open deletes a heading (it is the very defect this session repairs), while one not
 * popped costs a phantom. Reusing `listItemContentColumn` would therefore import its
 * deliberate over-acceptance into the direction that cannot afford it — measured, and not
 * argued: `Dr. Vasquez logged it.` at column 0 leaves the enclosing item OPEN in quarto, so
 * popping on it would delete the heading below.
 *
 * ⚠ **The whole set was measured, because a rule assembled from the six spellings that
 * happened to be in the first corpus is a rule with an untested tail.** 24 spellings x 2
 * shapes of the line above x 2 container geometries, rendered through the real `quarto
 * render` path (`scratchpad/s198/pop3`, `pop4`). Eighteen close and six do not:
 *
 *     CLOSES      -  *  +  -\t  -(bare)  1.  1)  10.  100.  a.  a)  A)  i.  iv.  IV.  #.
 *                 (1)  (a)
 *     KEEPS OPEN  A.  Dr.  Mr.  Elephants.  -item  (prose)
 *
 * The two rules behind that split are pandoc's own. A multi-letter run is a marker only where
 * it is a ROMAN NUMERAL (`iv.`, `IV.` close; `Dr.`, `Mr.` do not). And a marker delimited by a
 * PERIOD whose number is a single capital is pandoc's initial-in-a-name rule — `A. item text`
 * needs two spaces to be a list, so with one it is not one; the same letter delimited by a
 * PAREN has no such ambiguity and `A) item text` closes.
 *
 * ⚠ The first corpus scored SIX of these wrong, and the reason is worth keeping: its probe was
 * a setext heading at column 4 and `10. `, `iv. `, `IV. `, `(1) `, `(a) ` and `-\t` all open
 * their OWN content column 4, so the probe rendered from the NEW container and was read as the
 * old one surviving. A probe that cannot tell its hypothesis from the alternative has measured
 * nothing (Learning #289). The geometry above it uses columns 2/4/6 and probes at 6, which no
 * column-0 marker can reach.
 */
function popsEnclosingContainer(line: string): boolean {
  const m = /^[ \t]*(?:([-+*])|\(?(\d{1,9}|#|[a-zA-Z]{1,9})([.)]))(?:[ \t]|$)/.exec(line);
  if (m === null) {
    return false;
  }
  if (m[1] !== undefined) {
    return true; // a bullet is a marker in every spelling measured, including a bare `-`
  }
  const num = m[2];
  const delim = m[3];
  if (num === "#" || /^\d+$/.test(num)) {
    return true; // a decimal or an example-list marker, at any width
  }
  if (delim === ")") {
    return num.length === 1; // `a)` and `A)` close; a multi-letter run in parens is not a marker
  }
  if (num.length === 1) {
    return num >= "a" && num <= "z"; // `a.` closes; `A.` is an initial in a name
  }
  return /^[ivxlcdm]+$/.test(num) || /^[IVXLCDM]+$/.test(num);
}
/**
 * A FOOTNOTE definition or a DEFINITION-LIST definition, both of which give their content a
 * content column of exactly **4** past the marker's own indent — measured, and independent of
 * the label's length (`[^1]:` and `[^averylonglabel]:` both give 4).
 *
 * ⚠ The footnote row was very nearly measured wrong, and the way it failed is worth keeping:
 * an UNREFERENCED footnote definition is dropped from the rendered output ENTIRELY, so a
 * corpus that never cites its own footnote reads "no heading" for every indent and concludes
 * the container does not exist. It does. The corpus rows behind this line all carry a live
 * `See[^1]` reference (Learning #253 — validate the instrument before scoring with it).
 *
 * `:::` is excluded because a fenced div gives its content column 0, not 4 (measured).
 *
 * ⚠ **The leading class is `[ \t]*`, and the capture group is gone (Session 196).** It was
 * `( *)`, so a TAB-indented definition matched nothing and opened no container at all — while
 * the call site had computed `indentColumn(line) + 4` since Session 194. The capture was never
 * read: the +4 is measured from the line's COLUMN, which the call site takes from
 * `indentColumn`, not from the length of this match. Measured as a TAB/SPACE pair over the real
 * `quarto render` path — inside a two-deep nest, `\t[^n1]:` and `    [^n1]:` both give 8.
 */
const CONTENT_COLUMN_4_OPEN = /^[ \t]*(?:\[\^[^\]\s]+\]:|[:~](?![:~])[ \t])/;
/**
 * Body lines that do NOT leave a paragraph open, so an ATX heading may follow one
 * directly (Session 180). Pandoc's `blank_before_header` — on by default in the
 * `markdown` dialect quarto renders with — forbids a heading only where it would
 * interrupt an OPEN PARAGRAPH; a block-level construct leaves none open.
 *
 * ⚠ **This list is deliberately PERMISSIVE, and that asymmetry is load-bearing.**
 * A line this list misses is treated as prose, and the heading below it is DROPPED
 * — deleting a heading quarto really renders, which is the direction that must never
 * happen. A line it matches too eagerly merely retains a pre-existing phantom. So
 * when in doubt, add the pattern: the cost is a residual, not a regression.
 *
 * ⚠ **The asymmetry is not a licence to add anything — Session 182 removed a row from here.**
 * A pattern belongs only if the construct really does leave no paragraph open. Session 180's
 * `/^ {0,3}=+[ \t]*$/` did not: an `=` run that is NOT consumed as a setext underline is
 * ordinary paragraph TEXT, in every position where that entry was reachable (measured — 30
 * phantom headings). "When in doubt, add it" applies to constructs you have not measured,
 * not to ones you have measured to be paragraph content.
 *
 * ⚠ **A row must match the CONSTRUCT, not merely a byte the construct happens to contain
 * (Session 184).** Session 183 fixed *when* these rows apply; three of them still matched
 * things that were not the construct at all, and each narrowing below is scored on its own
 * against the real render path in BOTH directions — because narrowing is the DELETING
 * direction and a row that is one character too narrow drops a real heading. Two narrowings
 * that look obvious are MEASURED WRONG and are deliberately absent:
 *
 *   - the pipe row cannot require a LEADING pipe (`OPENS_FRESH_BLOCK`'s form). Pandoc pipe
 *     tables need neither leading nor trailing pipes, so a table's last row can be `c | d`;
 *     requiring one deletes 4 real headings. A single pipe-bearing line is a table only if a
 *     DELIMITER row follows, which no per-line predicate can see — so the row stays wide and
 *     its phantoms are the price of having no table state.
 *   - the grid-border row must keep matching a LONE `+`. A bare `+` is an EMPTY LIST ITEM,
 *     which really is block-level: `+` / `# ATX Below` renders `<ul>` then `<h1>ATX Below</h1>`
 *     (measured). Excluding it — the "obvious" reading of a bullet marker as a defect —
 *     deletes 6 real headings.
 *   - the raw-HTML row cannot be narrowed to a TAG LIST, and the raw-TeX row cannot be
 *     narrowed to a BARE MACRO. Session 184 shipped both narrowings, scored ZERO headings
 *     lost over 476 rendered documents, and an adversarial sweep then measured them deleting
 *     THIRTY-ONE real headings on shapes no corpus held: `<meta>`, `<svg>`, `<button>`,
 *     `<video>`, `<audio>`, `<canvas>`, `<object>`, `<embed>`, `<noscript>`, `<map>`,
 *     `<output>`, `<progress>`, `<area>`, `<applet>`, `<ins>`, `<del>` all open raw HTML
 *     blocks while sitting outside CommonMark §4.6; `\vspace{1em}`, `\usepackage{…}`,
 *     `\newcommand{…}`, `\setlength{…}`, `\definecolor{…}`, `\newpage[2]`, `\newpage{}`
 *     and `\clearpage\newpage` are all raw BLOCKS despite carrying braces. Pandoc classifies
 *     both by NAME — `<ins>` opens a block and `<em>` does not; `\vspace` is a block and
 *     `\textbf` is not — and nothing in the SHAPE of the line distinguishes them. Both rows
 *     therefore stay wide, keeping their `<span>` / `\textbf{}` phantoms, until someone
 *     transcribes those tables and measures them.
 *
 * The ONE narrowing that survived is the link-reference row, because its rule really is
 * decided by the line's shape and was derived from an exhaustive sweep of 17 label spellings:
 * a pandoc footnote label is `^` followed by one or more characters that are neither
 * whitespace nor another `^`.
 *
 *   footnote (absorbs the line below) `[^1]` `[^note]` `[^a-b]` `[^1a]` `[^n_1]` `[^A]` `[^a.b]` `[^-]` `[^très]`
 *   link reference (closes)           `[^]` `[^ 1]` `[^a b]` `[^^1]` `[^1^]` `[^1 ]` `[x]` `[]`
 *
 * A bare `(?!\^)` rejects the whole second row and deletes four real headings;
 * `OPENS_FRESH_BLOCK`'s `\[[^\^\]][^\]]*\]:` additionally rejects `[]:` and deletes a fifth
 * (Learning #233 — a fragment borrowed from the other list is unmeasured on THIS predicate's
 * question, whatever it proved on its own).
 */
const CLOSES_PARAGRAPH: readonly RegExp[] = [
  /\|/, //                                                   a pipe-table row, anywhere on the line
  /^ {0,3}\+[-+=: ]*$/, //                                   a grid-table border, which carries NO pipe
  /^ {0,3}:{3,}/, //                                         a fenced-div / callout fence
  /^ {0,3}\[(?!\^[^\s^\]]+\]:)[^\]]*\]:/, //                 a link reference — NOT a `[^1]:` footnote
  HTML_BLOCK_OR_INLINE_OPEN, //                              a raw HTML block — see the note below
  /^ {0,3}#{1,6}[ \t]*$/, //                                 a bare `##` — an EMPTY heading to pandoc
  // ⚠ Neither the raw-TeX macro row NOR the indented-code row is here — each needs the
  // containing block's content column, which no RegExp in an array can see. `closesParagraph`
  // tests them via `rawTexMacroLineIsBlock` (Session 189) and `indentedCodeLine` (Session 193)
  // instead. The indented-code row's literal was `/^(?: {4,}|\t)\S/` and sat right here.
  /^ {0,3}\.\.\.[ \t]*$/, //                                 a mid-document YAML block's `...` terminator
];
/**
 * A front-matter `from:` key, at ANY indentation so a per-format
 * `format:`/`  html:`/`    from: …` is caught too.
 *
 * `blank_before_header` is a pandoc DEFAULT, not an invariant: a document that selects a
 * different reader dialect really does render a heading pressed against prose. Measured on
 * the real render path — `markdown-blank_before_header`, `markdown_strict`, `gfm` and
 * `commonmark` each render the heading, while plain `markdown` and no key at all do not.
 *
 * The bail keys on the key's PRESENCE, not on resolving the dialect, so it fails CLOSED:
 * the cost is that `from: markdown` retains the phantom, which is the permitted direction.
 * `reader:` is deliberately absent — quarto REJECTS that key outright (exit 1), so no such
 * document ever renders a heading.
 */
const FRONTMATTER_FROM_KEY = /^[ \t]*from[ \t]*:/;
/**
 * A front-matter `from:` whose VALUE names a reader of the **CommonMark family** (Session 202).
 *
 * ⚠ **This is a different question from `FRONTMATTER_FROM_KEY` above and must stay one, because
 * the two rows fail in OPPOSITE directions.** That row keys on the key's PRESENCE and never
 * resolves the value, deliberately: for the ATX row the cost of firing on a document that is not
 * CommonMark is a phantom, which this project permits. The setext row's own dialect rule DELETES
 * the heading at underline column 0, so firing it on a `markdown` document costs a real heading —
 * measured, `scratchpad/s202/gnd` `g_markdown_b2_u00` renders `h1:gnd probe title` where
 * `g_gfm_b2_u00` renders nothing. Sharing one flag between the two rows would have been a
 * one-line change that silently moved both.
 *
 * ⚠ **An ALLOWLIST of measured base names, matched case-sensitively — never a pattern.** Not
 * firing leaves today's behaviour (a phantom at column 0, a loss at the tolerance columns);
 * firing wrongly deletes a heading. So an unmeasured spelling must fall through. Measured over
 * the 51 rendered documents of `scratchpad/s202/dax`, three decisive underline columns each:
 *
 *   CommonMark family   `commonmark`, `commonmark_x`, `commonmark_x+footnotes`, `gfm`,
 *                       `gfm+footnotes`, `gfm-raw_html`, and the `"gfm"` / `'gfm'` /
 *                       `gfm   ` / `gfm  # comment` spellings of the same values
 *   pandoc markdown     `markdown`, `markdown+emoji`, `markdown_strict`, `markdown_mmd`,
 *                       `markdown_phpextra`, `markdown-blank_before_header`
 *
 * ⚠ **`markdown_github` is in the SECOND list**, which is the one row that cannot be guessed:
 * pandoc documents it as a deprecated synonym for `gfm`, and quarto 1.7.33 renders it exactly
 * like `markdown` — verified against the raw HTML (`<h1 id="dax-probe-title">` nested in the
 * `<li>` at underline column 0), not through the extractor. A classifier keyed on "contains
 * github" or "is not markdown" would have deleted that heading.
 *
 * ⚠ `GFM` in upper case is absent because quarto REFUSES to render such a document (exit 1),
 * so it has no heading truth to agree with — the same reasoning `reader:` gets above.
 *
 * ⚠ **ANCHORED AT COLUMN 0 — a TOP-LEVEL key only, where `FRONTMATTER_FROM_KEY` above accepts
 * any indent. Found by a BLIND adversarial lens that had seen none of this session's corpora,
 * and it is the one direction this rule must never fail in.** `abstract: |` opens a YAML BLOCK
 * SCALAR whose content is ordinary prose, so a sentence wrapping across `from: gfm sources
 * published last year.` is not a reader selection — and firing on it DELETED the heading quarto
 * renders (`scratchpad/s202/adv/dialect/dialect_04`). A nested `transfer:` / `params:` key does
 * the same. Column 0 makes every block scalar unreachable by construction: YAML requires a
 * block scalar's content to be indented past its key.
 *
 * ⚠ **The cost of that anchor is measured and is a PHANTOM, which is why it is the right trade:**
 * a per-format `format:` / `html:` / `from: gfm` really does select the reader
 * (`adv/dialect/dialect_01` renders no heading, so gfm is genuinely in effect), and this rule
 * now misses it and keeps the default set — an underline at column 0 we report and quarto does
 * not. Telling that apart from `params:` / `from: 2024-01-01` needs a YAML parser, not a line
 * regex. ⚠ Note `FRONTMATTER_FROM_KEY` has the SAME depth-blindness and keeps it deliberately:
 * its consequence is a phantom either way, so the anchor buys it nothing.
 *
 * ⚠ A `from:` in a PROJECT file (`_quarto.yml`) is invisible here, exactly as it is to
 * `FRONTMATTER_FROM_KEY`: this scanner sees one document's bytes. Such a document keeps the
 * default-dialect rule, which is the non-deleting direction.
 */
const FRONTMATTER_COMMONMARK_FROM =
  /^from[ \t]*:[ \t]*["']?(?:commonmark(?:_x)?|gfm)(?![a-zA-Z0-9_])/;
/**
 * A setext underline run that pandoc will swallow the ATX line above into — `=`s or `-`s
 * alone on a line, any length, at **column 0**, for the ATX-adjacency rule in
 * `closesParagraph` below.
 *
 * ⚠ **Deliberately UNCONDITIONAL at column 0, where `setextUnderlineLevel` accepts the
 * containing block's content column too.** Until Session 192 the contrast was with a ` {0,3}`
 * cap, and this docstring said so; the setext rows are now an EQUALITY against
 * `[0, ...contentColumns]`, so the two are no longer wide-versus-narrow but different
 * questions. This one asks where pandoc's ATX-SWALLOW fires, and that is column 0 only for
 * THIS row's purpose — the block closure below it.
 *
 * ⚠ **Session 199 measured the swallow INSIDE a container, which this note previously said
 * nothing was claimed about, and it DOES fire there**: inside `-   item one`, the document
 * `    # Container Heading Above` / `    ===` renders `<h1># Container Heading Above</h1>`,
 * literal `#` and all. That is the same divergence Session 182 filed at column 0 (we strip
 * the `#` on purpose), now known to have a container spelling too. This row is deliberately
 * NOT widened for it: the fix is a decision about the swallow's TEXT, not about where this
 * row fires, and reversing S182's choice is a separate capability.
 * The swallow is measured to need zero indent: `# Heading Above` / `===` renders
 * `<h1># Heading Above</h1>` and makes the heading below it real, while the same document
 * with even ONE leading space renders `<h1>Heading Above</h1>` plus a plain paragraph, and
 * the heading below is not a heading at all. Widening this to ` {0,3}` invents that heading.
 * Trailing whitespace is fine (measured); trailing anything else is not — `=== junk` is not
 * an underline, so the `$` anchor is load-bearing too.
 */
const SETEXT_UNDERLINE_RUN = /^(?:=+|-+)[ \t]*$/;
/**
 * A thematic break (CommonMark §4.1) — 3+ of `*`, `-` or `_`, optionally space-separated.
 *
 * ⚠ **Held OUT of `CLOSES_PARAGRAPH` on purpose (Session 182): it closes a paragraph only
 * where none is open.** Against an OPEN paragraph these same bytes are a LAZY CONTINUATION
 * of it — `one` / `two` / `***` / `# ATX Below` renders one `<p>` containing all four lines
 * and NO heading, and the `---` spelling proves it outright by rendering as an em dash,
 * which only happens to paragraph TEXT (measured; 34 phantom headings before the gate).
 *
 * This is the identical rule `INDENTED_CODE_LINE` documents and `opensFreshBlock` already
 * applies. It is stated here rather than folded into either because `CLOSES_PARAGRAPH`'s
 * remaining rows are UNMEASURED against an open paragraph — gating the whole list would be
 * the heading-deleting direction on nine rows nobody has scored.
 */
const THEMATIC_BREAK = /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/;
/**
 * A raw TeX ENVIRONMENT delimiter — `\begin{…}` / `\end{…}`.
 *
 * ⚠ **Deliberately narrower than `CLOSES_PARAGRAPH`'s `/^ {0,3}\\[a-zA-Z]/` row**, because
 * only the environment form interrupts an open paragraph. Measured on the real render path:
 * `line one` / `line two` / `\begin{center}` / `text` / `\end{center}` / `# ATX Below` emits
 * a real `<h1>ATX Below</h1>` and the prose loses its `<p>` wrapper, while the same document
 * using a bare macro — `\clearpage` — renders `<p>line one line two # ATX Below</p>`, one
 * paragraph with no heading at all. A bare macro is inline; an environment opens a block.
 */
const RAW_TEX_ENV_OPEN = /^ {0,3}\\(?:begin|end)\{[^}]*\}/;
/**
 * A line that can be a construct's CLOSING delimiter — a fenced-div/callout `:::` or a
 * mid-document YAML block's `...`.
 *
 * ⚠ **These must be tested BEFORE the `paragraphOpen` bail, and that is not a refinement.**
 * A closer follows its own construct's CONTENT — a div's `:::` sits under the div's body
 * text, a YAML block's `...` under its last key — so to a per-line scanner with no block
 * nesting a closer ALWAYS looks like it sits against an open paragraph. Quarto knows it is
 * inside the construct and closes it; this model cannot. Gating them was measured to DELETE
 * five real headings (a closed `::: {.note}` div, a closed callout, and a `---`/`...` YAML
 * block each render the heading below their closer). Leaving them ungated retains their
 * open-paragraph phantoms instead, which is the permitted direction.
 */
const CLOSER_LINE = /^ {0,3}(?::{3,}|\.\.\.[ \t]*$)/;
/**
 * A block-quote marker, for `paragraphQuoted` — see `closesParagraph`.
 */
const BLOCK_QUOTE_MARKER = /^ {0,3}>/;
/**
 * A pandoc LINE BLOCK's own line, and the CONTINUATION of one (Session 185).
 *
 * A line block continues a line by indenting the next one, so its continuation is
 * indistinguishable from prose to a per-line scanner — and being read as prose is what
 * deleted the heading below every such block once Session 183 gated `CLOSES_PARAGRAPH` on an
 * open paragraph: the continuation opened a paragraph, and the bail then suppressed every
 * row on every line after it, including the `| …` line that would have closed it again.
 *
 * ⚠ **The opener is measured, not assumed, and each rejection below costs or saves a real
 * heading.** On the real render path (quarto 1.7.33) a line block is a pipe followed by a
 * SPACE OR TAB at **column 0** — and only there:
 *
 *   `| line one`     line block  ->  the heading below the block is REAL
 *   `|\tline one`    line block  ->  real (so the class is `[ \t]`, not a literal space)
 *   `|  line one`    line block  ->  real (so the class REPEATS)
 *   `|line one`      NOT a line block — prose; the heading below is a phantom
 *   `|`              NOT one either: it renders a line-block div, but a following indented
 *                    line does NOT attach to it, so treating it as an opener invents a heading
 *   `| ` / `|  `     NOT one, for the same reason — a pipe followed by whitespace and NOTHING
 *                    ELSE takes no continuation, which is why the `\S` is required and why
 *                    Session 185's adversarial sweep found this as a phantom it had introduced
 *   ` | line one`    NOT one — the indent disqualifies it, at 1, 3 and 4 spaces alike
 *
 * The CONTINUATION, by contrast, attaches at any indent whatever — 1, 2, 3, 4 and 8 spaces
 * and a tab all render identically — and its rule is only that the line BEGINS with
 * whitespace. ⚠ **It deliberately does NOT require non-blank content, and that `\S` was a
 * measured mistake, not a missing refinement** (found by Session 185's own mutation pass,
 * where the mutant proved more correct than the code — Learning #232). Requiring content
 * excluded any line whose only content is whitespace `BLANK_LINE` does not recognise — a form
 * feed, a vertical tab, a non-breaking space — which ended the block early and left a
 * paragraph open across the heading below. All four such documents render the heading.
 * A genuinely blank line still ends the block: `BLANK_LINE` is tested earlier in the loop and
 * `continue`s, so this pattern is never reached for one.
 */
const LINE_BLOCK_LINE = /^\|[ \t]+\S/;
const LINE_BLOCK_CONTINUATION = /^[ \t]+/;
/**
 * A table's RULE row — the line that turns a run of `| … |` rows into a table rather than a
 * line block (Session 185). Two spellings, both measured: a PIPE table's delimiter
 * (`|---|---|`, with optional alignment colons and optional outer pipes) and a GRID table's
 * border (`+---+---+`, also `+===+===+`).
 *
 * ⚠ **This exists only to DISARM `LINE_BLOCK_LINE`, and that asymmetry is what makes it
 * safe.** A table's body row is spelled exactly like a line-block line, so without this the
 * rule arms on `| 1 | 2 |` and reads the row below as a continuation — measured wrong:
 *
 *   `| a | b |` / `|---|---|` / `| 1 | 2 |` / `  continued` / `# ATX Below`  ->  NO heading
 *   `| a | b |` /               `| 1 | 2 |` / `  continued` / `# ATX Below`  ->  the heading
 *
 * Only the delimiter row separates those two documents, and no per-line predicate can see it
 * without state — hence the flag. Because disarming merely restores the pre-Session-185
 * behaviour, an over-eager match here can only ever forgo a RECOVERY; it can never delete a
 * heading. That is the opposite polarity to `CLOSES_PARAGRAPH`, and it is why this pattern is
 * allowed to be approximate where those rows may not be.
 *
 * ⚠ **Both spellings, and `\s*$` rather than `[ \t]*$`, were added because Session 185's own
 * adversarial sweep produced the documents that need them** — a GRID table whose rule this
 * never matched, and a pipe delimiter whose trailing whitespace is a FORM FEED. Each armed the
 * line-block rule on a table body row and invented the heading below it.
 */
const TABLE_RULE_ROW =
  /^ {0,3}(?:\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?|\+[-+=: ]*)\s*$/;
/**
 * Whether `line` ends any open paragraph — see `CLOSES_PARAGRAPH`.
 *
 * `prevWasAtxHeading` recovers a block closure this model would otherwise lose. Pandoc
 * swallows an ATX heading line into a SETEXT heading when a run follows it directly —
 * `# Heading Above` / `===` renders `<h1># Heading Above</h1>`, literal `#` and all
 * (measured). That swallow closes the block, so a heading below the run is REAL. This
 * model deliberately declines the swallow (see `SETEXT_H1`), which left the closure
 * unmodelled: without this clause, `# Heading Above` / `===` / `# ATX Below` loses
 * `ATX Below` outright — a real heading deleted, the direction that must never happen.
 * The `-` half additionally recovers a PRE-EXISTING lost true positive: `-` and `--` are
 * too short for the thematic-break row, so nothing here ever matched them.
 */
function closesParagraph(
  line: string,
  paragraphOpen: boolean,
  prevWasAtxHeading: boolean,
  paragraphQuoted: boolean,
  lineBlockAbove: boolean,
  contentColumns: readonly number[] | null,
): boolean {
  if (lineBlockAbove && LINE_BLOCK_CONTINUATION.test(line)) {
    return true;
  }
  if (prevWasAtxHeading && SETEXT_UNDERLINE_RUN.test(line)) {
    return true;
  }
  if (
    HTML_BLOCK_OPEN.test(line) ||
    RAW_TEX_ENV_OPEN.test(line) ||
    RAW_TEX_BLOCK_MACRO.test(line) ||
    CLOSER_LINE.test(line)
  ) {
    return true;
  }
  if (paragraphOpen && !paragraphQuoted) {
    return false;
  }
  return (
    THEMATIC_BREAK.test(line) ||
    rawTexMacroLineIsBlock(line, contentColumns) ||
    indentedCodeLine(line, contentColumns) ||
    CLOSES_PARAGRAPH.some((re) => re.test(line))
  );
}
/**
 * Whether `line` is an indented code line (CommonMark §4.4) at this point in the document —
 * four columns past the CONTAINING BLOCK's content column, not four past the page edge
 * (Session 193).
 *
 * Only ever a code block where no paragraph is already open; against an open paragraph the
 * same bytes are a LAZY CONTINUATION of it (measured). Both callers that ask the block
 * question sit behind their own `paragraphOpen` bail; the third caller — the code-RUN
 * exception in `computeRegions` — deliberately does not, and is discussed there.
 *
 * ⚠ **The row tested a LITERAL four spaces, and that is only right at the top level.** Pandoc
 * re-parses a container's content DEDENTED, so the container's content column is that
 * sub-document's column 0 and the code threshold moves with it. Measured over 300 ground
 * documents rendered through the real `quarto render` path, the threshold is exactly
 * `contentColumn + 4` in every container measured: top level 4, a `- ` item 6, a `1. ` item 7,
 * a `-   ` item 8, a footnote or definition-list definition 8, three-deep nested bullets 10.
 * `- line one` / `  line two` / (blank) / `    \clearpage` / `# ATX Below` renders NO heading,
 * because four spaces is +2 inside a column-2 item — ordinary paragraph content, which
 * `blank_before_header` then forbids the heading from interrupting.
 *
 * `columns` is `[0, ...contentColumns]` — the same array `rawTexMacroLineIsBlock` reads, and
 * the base is the DEEPEST open column at or above which this line starts. `null` where the
 * containing block's column cannot be known (a block quote may be open), which keeps the base
 * at 0 and therefore the old literal-4 threshold.
 *
 * ⚠ **A TAB IS INDENTATION, MEASURED IN COLUMNS, AND ABSOLUTE.** It advances to the next
 * 4-column stop from the START OF THE LINE, not from the container's column — measured, and
 * the two answers differ: a lone tab inside a column-2 item reaches column 4, short of that
 * item's threshold of 6, and quarto renders no heading there. The old row could not express
 * this at all: `\t` was hard-coded as "deep enough" (wrong inside every container) while
 * `    \t` matched NOTHING, because the `\S` after the space run rejects a tab — a real
 * heading lost at top level, in 9 of this corpus's 18 pre-existing losses.
 */
/**
 * The COLUMN a line's leading whitespace reaches — a tab advancing to the next 4-column stop,
 * absolutely, from the start of the line (Session 194).
 *
 * ⚠ **This is the one definition of "how deep is this line", and it is shared on purpose.**
 * Session 193 gave `indentedCodeLine` this arithmetic and left the container stack in
 * `computeRegions` measuring a leading-SPACE run only. The two then disagreed about every
 * tab-indented line, and the disagreement was not academic: the stack popped a container that
 * was still open, and BOTH readers of that stack went wrong, in OPPOSITE directions. Measured
 * over 432 ground documents rendered through the real `quarto render` path: the indented-code
 * reader gained 40 phantom headings and the setext reader LOST 111 real ones — 151 errors, and
 * every single one of them a tab spelling, with the space spellings scoring 0/0 in both.
 *
 * The rule itself is an EQUIVALENCE, and it was measured as one rather than assumed: for every
 * container (none, `- `, `1. `, `-   `, a three-deep nest, a footnote/definition) and every
 * column 0-12, each tab spelling was paired against the SPACE spelling that reaches the same
 * column. Quarto answered identically in **276 of 276** pairs. A tab is worth the columns it
 * spans and nothing else; it is never "shallow" and never "deep enough".
 *
 * ⚠ The stop is 4, not 8, and it is measured from the START OF THE LINE rather than from the
 * containing block's column — both differ from the answers a terminal or an editor would give.
 */
function indentColumn(line: string): number {
  let col = 0;
  for (const ch of line) {
    if (ch === " ") {
      col += 1;
    } else if (ch === "\t") {
      col += 4 - (col % 4);
    } else {
      break;
    }
  }
  return col;
}
/**
 * Whether `col` is four or more columns past the content column of the innermost open block
 * that could still contain it — i.e. whether a line at that column is INDENTED CODE.
 *
 * Extracted from `indentedCodeLine` by Session 200 so the fence rows can ask the question of
 * a bare COLUMN rather than of a line: `buildCloserIndex` has to enumerate the columns a
 * closer would be accepted at, and there is no line to hand it. One definition, so the
 * "where does code start" rule cannot drift between the row that reads it off a line and the
 * row that enumerates it (Learning #14).
 *
 * `base` is the DEEPEST open column not exceeding `col`, so the accepted region is the UNION
 * of `[c, c+3]` over the open stack rather than the single span `[0, max+3]`. The two differ
 * only when consecutive open columns are more than four apart — a `- ` with four spaces after
 * it opens content at column 5, leaving a hole at column 4 — and `scratchpad/s200/ax`'s `gap`
 * rows measure that hole as REJECTED. ⚠ Those rows do not by themselves refute the `[0,
 * max+3]` reading, because the container pops before the shallow line is read and both
 * readings then agree; they are recorded as consistent-with, not as a discriminator.
 */
function columnIsCodeDepth(col: number, columns: readonly number[] | null): boolean {
  let base = 0;
  if (columns !== null) {
    for (const c of columns) {
      if (c <= col && c > base) {
        base = c;
      }
    }
  }
  return col >= base + 4;
}
function indentedCodeLine(line: string, columns: readonly number[] | null): boolean {
  if (BLANK_LINE.test(line)) {
    return false; // whitespace only — the old row's `\S` requirement, kept
  }
  return columnIsCodeDepth(indentColumn(line), columns);
}
/**
 * Lines that begin a FRESH BLOCK, so the line *below* them starts a new paragraph
 * and may therefore be claimed by a setext underline (Session 181).
 *
 * ⚠ **THIS LIST HAS THE OPPOSITE SAFETY POLARITY TO `CLOSES_PARAGRAPH`, AND THE TWO
 * MUST NEVER BE UNIFIED.** They look interchangeable — both answer "is this line
 * block-level?" — and reusing `closesParagraph` here is the instinctive one-line fix.
 * Measured against the real renderer, it manufactures **24 phantom setext headings**:
 * `:::`, a grid-table border, a bare `a | b` in prose, a footnote definition, an
 * inline `<span>`, `...` and a `===` run each leave pandoc's paragraph OPEN, so the
 * line below them is continuation text and no heading is rendered at all.
 *
 * The polarity is inverted because this list ADDS headings where `CLOSES_PARAGRAPH`
 * REMOVES them. A pattern missing from here only retains a pre-existing lost true
 * positive — we stay silent, which is safe. A pattern wrongly present here INVENTS a
 * heading quarto does not render, into the outline, breadcrumbs, sticky scroll,
 * workspace symbols **and the cross-reference index**. So when in doubt, leave it out:
 * the cost is a residual, not a fabrication. Every entry below was measured firsthand
 * on the real `quarto render` path, both as `===` (h1) and `---` (h2).
 *
 * ⚠ **`HTML_BLOCK_OR_INLINE_OPEN` is here and `HTML_BLOCK_OPEN` is NOT, and the split is the
 * whole point (Session 187).** Class 1 is tested in `opensFreshBlock` AHEAD of the
 * `paragraphOpen` bail, because it opens a block whether or not a paragraph is open. Class 2
 * — pandoc's `eitherBlockOrInline` — belongs HERE, behind the bail: with no paragraph open
 * `<ins>` / `Title` / `===` renders `<h1>Title</h1>`, and with one open the same three lines
 * render a single paragraph whose setext text is `<ins> Title`, which is not `Title` and must
 * not be scored as agreement. Measured one document per name, in both underline spellings:
 * all 16 names yield exactly `h1:Title` for `===` and `h2:Title` for `---`, while `<em>` and
 * `<span>` yield neither. Before this row, a setext heading under any of the 16 was simply
 * lost — a true positive nothing in this file was looking for.
 */
const OPENS_FRESH_BLOCK: readonly RegExp[] = [
  /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/, //  a thematic break
  /^ {0,3}\[[^\^\]][^\]]*\]:/, //                            a link-reference definition — NOT `[^1]:`
  /^ {0,3}\|/, //                                            a pipe-table ROW; a bare `a | b` is prose
  /^ {0,3}#{1,6}[ \t]*$/, //                                 a bare `##` — an EMPTY heading to pandoc
  // ⚠ Neither the raw-TeX macro row nor the indented-code row is here either — same reason,
  // and `opensFreshBlock` tests them via `rawTexMacroLineIsBlock` and `indentedCodeLine` with
  // the SAME columns. Each is measured in THIS context in its own right (Learning #233): the
  // polarity here ADDS setext headings, so a narrowing proven on `CLOSES_PARAGRAPH`'s question
  // is unmeasured on this one. The indented-code sweep was run separately for exactly that
  // reason and returned the SAME threshold, `contentColumn + 4` (Session 193, 392 documents).
  HTML_BLOCK_OR_INLINE_OPEN, //                              pandoc's eitherBlockOrInline class
];
/**
 * A raw HTML BLOCK opener — the one construct measured to interrupt an OPEN paragraph,
 * so it is tested before the `paragraphOpen` bail. `prose` / `<div>` / `Title` / `===`
 * renders `<h1>Title</h1>`, where every other construct in this file renders nothing.
 *
 * The tag list is **PANDOC's, not CommonMark's (Session 187)**, and is deliberately CLOSED: an
 * INLINE tag does not open a block, so `<span>hi</span>` / `Title` / `===` renders no heading
 * at all (measured). `CLOSES_PARAGRAPH`'s bare `/^ {0,3}</` would match both and fabricate one.
 *
 * ⚠ **PANDOC CLASSIFIES BY TAG NAME, FROM ITS OWN SETS, AND THE RULE IS CONTEXT-DEPENDENT.**
 * `Text.Pandoc.Readers.HTML.TagCategories` (pandoc 3.6.3 — the build quarto 1.7.33 bundles,
 * `quarto pandoc --version`) defines TWO sets, and the set names ARE the rule:
 *
 *   `blockTags` = `blockHtmlTags ∪ blockDocBookTags ∪ epubTags` — block in EVERY context.
 *                 This is the list here. It contains `meta`, `canvas`, `output`, `hgroup` and
 *                 `isindex`, none of which is in CommonMark §4.6, plus ~42 DocBook names
 *                 (`note`, `warning`, `para`, `programlisting`, …) that pandoc folds in on
 *                 purpose so raw DocBook survives a markdown document.
 *   `eitherBlockOrInline` — block ONLY where no paragraph is already open. NOT here; it lives
 *                 in `OPENS_FRESH_BLOCK` and `CLOSES_PARAGRAPH`, both of which sit behind the
 *                 `paragraphOpen` bail. See `PANDOC_EITHER_TAGS`.
 *
 * Measured over 2,051 documents rendered through the real `quarto render` path, six shapes
 * across four contexts (opener/closer × paragraph-open/not, plus the setext question in both):
 * against an OPEN paragraph 98 names interrupt and 100 closers do; with none open, 115 and 117.
 * The two extra sets are exactly `eitherBlockOrInline`. Every name here has a document that
 * decides it.
 *
 * ⚠ **THREE NAMES ARE MEASURED EXCEPTIONS to `blockTags`, and each is here for a reason.**
 *   `!DOCTYPE` / `?xml` — `isBlockTag` admits any name starting `!` or `?`, but `htmlTag`'s own
 *       sanity guard (`isName tagname || isPI tagname`) then REJECTS `!DOCTYPE`, so
 *       `<!DOCTYPE html>` opens nothing in any context (measured). A processing instruction
 *       `<?xml …?>` does open a block, but only where no paragraph is open — so it is class 2.
 *   `textarea` / `title` — in `blockTags`, yet their OPENERS open nothing: both are RCDATA
 *       elements, so an unclosed opener swallows the rest of the document as text and the
 *       heading below never forms. Their CLOSERS are block. Hence two lists, not one.
 *
 * ⚠ **THE OPENER AND CLOSER LISTS DIFFER, and collapsing them is a heading-DELETING bug.**
 * `PANDOC_BLOCK_CLOSE_TAGS` is `PANDOC_BLOCK_OPEN_TAGS` plus `textarea` and `title` (100 vs 98).
 * `script` is retained in BOTH even though a STRAY `</script>` is measured inline (pandoc's
 * `isInlineTag` has the explicit case `TagClose "script" -> True`): dropping it deletes the
 * heading after every REAL `<script>` block, which the Session 184 test caught within minutes.
 * The two `</script>` lines are byte-identical and differ only in whether a raw block is open
 * above them — the state a per-line scanner does not have. The phantom is the permitted
 * direction; see the KNOWN RESIDUAL test.
 *
 * ⚠ **The four condition-1 tags are load-bearing, not tidiness (Session 184).** Carrying only
 * condition 6 left `<pre>`, `<script>`, `<style>` and `<textarea>` to the gated wide row, where
 * Session 183's `paragraphOpen` bail DELETED the heading below every such block: the opener
 * closed the paragraph, the block's BODY line opened a new one, and the CLOSER `</pre>` was
 * then suppressed by the bail. Measured — `<pre>` / `code` / `</pre>` / `# ATX Below` renders
 * `<pre>code</pre><h1>ATX Below</h1>`, and so does the same block pressed against a two-line
 * paragraph. 20 real headings, which the pre-Session-183 build got right.
 *
 * ⚠ **The leading-whitespace class is `[ \t]*`, NOT CommonMark's ` {0,3}` (Session 185), and
 * that is measured rather than tidied.** Pandoc's html-block rule does not look at the
 * indent at all. Against a two-line open paragraph, `<div>` releases the heading below it at
 * 0, 1, 3, 4, 5, 6 and 8 spaces, at one tab, at two tabs, at space+tab and at tab+space —
 * every spelling, identically — while `<span>`, `<em>` and `<not-a-tag` release it at NONE
 * of them. Capping the indent therefore did not model CommonMark's indented-code rule; it
 * simply lost the tag test on indented lines, and S183's bail then deleted the heading below
 * every such block. 51 real headings across a 160-document scored corpus, which the
 * pre-Session-183 build got right.
 *
 * ⚠ **The TAG is still the whole rule, and widening the indent did not weaken it.** The
 * closed tag list above is what separates `    <div>` (a block) from `    <span>` (prose),
 * exactly as it does at column 0. An indented line is NOT block-level for being indented.
 */
const HTML_BLOCK_OPEN = new RegExp(
  // OPENERS — pandoc's `blockTags` minus the measured exceptions above (98 names).
  "^[ \\t]*<(?:" + PANDOC_BLOCK_OPEN_TAGS + ")(?=[ \\t/>]|$)" + TAG_LINE_TAIL +
  // CLOSERS — the same list PLUS `textarea` and `title`; see the docstring.
  "|^[ \\t]*</(?:" + PANDOC_BLOCK_CLOSE_TAGS + ")(?=[ \\t/>]|$)" + TAG_LINE_TAIL +
  // …or a BALANCED one-line RCDATA element, which the name lists cannot express because its
  // opener bytes are identical to the unbalanced form — see `RCDATA_ONE_LINE_SRC`.
  "|^[ \\t]*" + RCDATA_ONE_LINE_SRC,
  "i",
);
/**
 * Whether `line` begins a fresh block, so the line BELOW it starts a new paragraph and
 * may therefore be claimed by a setext underline — see `OPENS_FRESH_BLOCK`.
 *
 * ⚠ **This says nothing about `line` itself.** A setext underline directly below one of
 * these constructs claims THAT construct's own line, overriding the block reading:
 * `    indented code` / `===` renders `<h1>indented code</h1>`, and `***`, `___`, `##`,
 * `| a | b |`, `[x]: url` and `\clearpage` all behave identically (measured). The caller
 * therefore defers this answer to the NEXT line instead of resetting the counter here —
 * resetting at the construct deletes a heading the pre-Session-181 build got right.
 *
 * `paragraphOpen` is load-bearing, not a refinement: against an OPEN paragraph these same
 * bytes are a LAZY CONTINUATION of it, and treating them as a block would fabricate a
 * heading. Measured — `prose` / `    indented` / `Title` / `===` renders NO heading, while
 * the identical document without the `prose` line renders `<h1>Title</h1>`.
 *
 * ⚠ **THERE ARE TWO PRE-BAIL CONSTRUCTS, NOT ONE, AND THE SECOND WAS MISSING FOR EIGHT
 * SESSIONS (Session 191).** Raw HTML was tested here from the start; the class-A raw-TeX
 * macro was not, and it is block in EVERY context for the same reason — `closesParagraph`
 * has carried both above its own bail since Session 188. The row this function DID reach,
 * `rawTexMacroLineIsBlock`, is the class-A∪B row gated on the containing block's content
 * column, and it sits BEHIND the bail. So `This paragraph is still open.` / `\maketitle` /
 * `ATX Below` / `===` rendered `<h1>ATX Below</h1>` and this model produced nothing at all:
 * `pendingFreshBlock` stayed false, `consecutiveBody` never returned to 1, and the `===`
 * was never read as an underline. Measured over 108 documents (3 classes × 9 indents × 2
 * underline spellings × 2 paragraph contexts, all quarto exit 0) — **24 lost headings, in
 * two families**: all 18 class-A-against-an-open-paragraph documents, and the 6 where no
 * paragraph is open and the macro sits at indent 1-3, which fell in the gap between the
 * content-column row (indent 0) and `INDENTED_CODE_LINE` (indent 4+).
 *
 * ⚠ **CLASS B IS THE CONTROL THAT DECIDES THIS, AND WIDENING THE HOIST TO IT FABRICATES
 * HEADINGS.** Class B is a block only where no paragraph is open, so against an open one it
 * must stay behind the bail: measured, `\clearpage` releases the heading at NO indent 0-8 in
 * that context. With no paragraph open its boundary is asymmetric and is preserved by the
 * untouched row below — quarto renders at indent 0 (a raw block) and at 4-8 (an indented
 * CODE block, a different construct), never at 1-3. Class C is inline everywhere.
 */
function opensFreshBlock(
  line: string,
  paragraphOpen: boolean,
  contentColumns: readonly number[] | null,
): boolean {
  if (HTML_BLOCK_OPEN.test(line) || RAW_TEX_BLOCK_MACRO.test(line)) {
    return true;
  }
  if (paragraphOpen) {
    return false;
  }
  return (
    rawTexMacroLineIsBlock(line, contentColumns) ||
    indentedCodeLine(line, contentColumns) ||
    OPENS_FRESH_BLOCK.some((re) => re.test(line))
  );
}
/**
 * The constructs that INTERRUPT an open paragraph under a CommonMark-family reader, for the
 * multi-line setext title in the scanner below (Session 203).
 *
 * ⚠ **THIS LIST HAS THE OPPOSITE SAFETY POLARITY TO `OPENS_FRESH_BLOCK`, WHICH SITS DIRECTLY
 * ABOVE IT, AND THE TWO MUST NOT BE UNIFIED EITHER.** That list ADDS a heading when a pattern
 * is wrongly present, so its rule is "when in doubt, leave it out". This one DECLINES a
 * multi-line title when a pattern is present — which is the pre-Session-203 behaviour, a
 * residual — and JOINS ACROSS A BLOCK when a pattern is missing, fabricating a heading whose
 * text is stitched from two different blocks. So its rule is the exact inverse: **when in
 * doubt, put it in.** Two lists, both answering "is this line block-level?", with opposite
 * defaults; a third row would need its own measurement again (Learning #303).
 *
 * Measured over 128 rendered documents (`scratchpad/s203/ilk` 32 continuation kinds x 2
 * readers, `scratchpad/s203/grd` 22 boundary shapes x 2, `scratchpad/s203/unc` 10 x 2), every
 * one scored on the heading TEXT rather than its presence. The set is CommonMark's own, and
 * four of its edges are counter-intuitive enough to be worth naming:
 *
 *   `1. x` interrupts and `2. x` does NOT   — CommonMark admits only a list starting at 1
 *   `- x` interrupts and a bare `-` does NOT — an EMPTY item may not interrupt (and a lone
 *                                             `-` is this model's own h2 underline anyway)
 *   `# x` interrupts and `#x` does NOT       — `gfm` keeps `space_in_atx_header`
 *   `| a | b |` does NOT interrupt, WITH OR WITHOUT its delimiter row — a GFM table cannot
 *                                             interrupt a paragraph, so `|` is absent here
 *                                             even though `OPENS_FRESH_BLOCK` carries it
 *
 * ⚠ The `<` row is deliberately BROADER than any HTML-block tag list in this file, and that is
 * the deny-by-default rule doing its job: `<!DOCTYPE`, `<?php` and `<![CDATA[` are all measured
 * interrupts, and enumerating CommonMark's seven HTML-block types to admit `<span>` would put a
 * fabrication one unlisted spelling away. The measured cost is two rows — `<span>inline</span>`
 * and a bare `<https://…>` autolink, both of which quarto joins and this model now declines.
 * That is a residual in the safe direction and is disclosed rather than optimised away.
 */
const COMMONMARK_PARAGRAPH_INTERRUPT: readonly RegExp[] = [
  /^[ \t]*#{1,6}([ \t]|$)/, //                             an ATX heading — `#x` is NOT one
  /^[ \t]*(`{3,}|~{3,})/, //                               a fence, either char, any length
  /^[ \t]*>/, //                                           a block quote, space or not
  /^[ \t]*((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/, // a thematic break
  /^[ \t]*[-*+][ \t]+\S/, //                               a NON-EMPTY bullet item
  /^[ \t]*1[.)][ \t]+\S/, //                               a non-empty ordered item, AT 1 ONLY
  /^[ \t]*\(1\)[ \t]+\S/, //                               pandoc's PAREN-WRAPPED one, likewise
  /^[ \t]*:{3,}[ \t]*\S/, //                               a fenced div WITH an attribute
  /^[ \t]*</, //                                           any HTML-ish opener — see above
  /^[ \t]*\[\^[^\]]*\]:/, //                               a footnote definition
];
/**
 * Whether `line` interrupts an open paragraph under a CommonMark-family reader — see
 * `COMMONMARK_PARAGRAPH_INTERRUPT`.
 *
 * ⚠ **At code depth NOTHING interrupts**, because indented code cannot interrupt a paragraph
 * at all: measured as a clean boundary in both directions, at top level and inside a container
 * (`scratchpad/s203/grd` — `bul_i1`/`i2`/`i3`, `atx_i3` and `fence_i3` interrupt where
 * `bul_i4`, `atx_i4`, `fence_i4` and the container's own `cont_code` are joined verbatim). The
 * condition is `indentedCodeLine`, REUSED rather than re-derived, for the same reason
 * `setextTitleText` reuses it (Sessions 196, 200 and 201).
 */
function commonmarkParagraphInterrupt(
  line: string,
  contentColumns: readonly number[] | null,
): boolean {
  if (indentedCodeLine(line, contentColumns)) {
    return false;
  }
  return COMMONMARK_PARAGRAPH_INTERRUPT.some((re) => re.test(line));
}
/**
 * A line that OPENS a block whose content is not a paragraph, for the FIRST line of a body run
 * — the multi-line setext title below may not start on one (Session 203).
 *
 * ⚠ **This is a different question from `COMMONMARK_PARAGRAPH_INTERRUPT` above, and the
 * difference is the whole reason it is a separate list: on the first line a construct OPENS the
 * run rather than interrupting it, and some constructs open a run whose content IS a
 * paragraph.** A BULLET or ORDERED marker is exactly that — `- First Bul One` / `  First Bul
 * Two` / `  ===` renders `h1:First Bul One First Bul Two`, marker stripped, and the ordered
 * spelling answers identically (measured, `scratchpad/s203/first` — `f_gfm_bullet`,
 * `f_gfm_ord1`). Testing the first line with the interrupt list would delete both.
 *
 * A FENCE, an HTML block and a block quote open a run whose content is not a paragraph at all,
 * and all three render NO heading (`f_gfm_fence`, `f_gfm_fence_info`, `f_gfm_html`,
 * `f_gfm_quote`). The indented code line is the fourth member and is tested separately, by
 * `indentedCodeLine`, because it needs the container's content column.
 *
 * ⚠ Found by a BLIND adversarial lens (`scratchpad/s203/adv/code` — `code_06`) after 279 of
 * this session's own designed documents had scored clean on it, which is the seventh session
 * running that a designed corpus was not enough. The path there is worth keeping: an UNCLOSED
 * fence has no closer, so this scanner deliberately declines to open a region for it (Session
 * 179) and the fence line falls through to ordinary body — which is precisely what made it the
 * first line of a run. A construct this file goes out of its way NOT to treat as a block is the
 * one most likely to turn up where a block is not expected.
 *
 * A DEFINITION-BODY marker (`:` + a space) is the fifth member, and it earns its place from
 * the OPPOSITE direction: this model pushes a container content column for one, which is what
 * makes an underline four columns in acceptable at all, and quarto renders no heading there
 * under gfm, commonmark OR commonmark_x. The column is wrong and is the FILED container-stack
 * item — proven pre-existing through the ATX row in every reader (`scratchpad/s203/ctl2` —
 * `defcol_atx_gfm`, `_cmx`, `_md`) and deliberately not narrowed, because Session 202 measured
 * that narrowing WORSE. What is closed here is only the new fabrication the join would add.
 *
 * A THEMATIC BREAK and a LINK-REFERENCE DEFINITION are deliberately absent: both are already in
 * `OPENS_FRESH_BLOCK`, so the run restarts on the line BELOW them and they can never be a run's
 * first line. Measured to confirm rather than assumed (`f_gfm_tbreak`, `f_gfm_linkref` — quarto
 * starts the paragraph below them too, and this model already agrees).
 */
const COMMONMARK_RUN_OPENS_BLOCK = /^[ \t]*(`{3,}|~{3,}|<|>|:[ \t])/;
/**
 * CommonMark §4.6 **type 6** — the tag names that open a raw HTML block running to the next
 * BLANK line, for the heading suppression in the scanner below (Session 204).
 *
 * ⚠ **THIS IS NOT `PANDOC_BLOCK_OPEN_TAGS`, AND SUBSTITUTING THAT LIST DELETES REAL HEADINGS.**
 * The two lists were measured against each other over 130 rendered documents
 * (`scratchpad/s204/name`), and the decisive context is an OPEN PARAGRAPH: with no paragraph
 * open CommonMark type 7 accepts ANY complete tag, so every name swallows and the lists cannot
 * be told apart. Against an open paragraph only type 6 may interrupt. Measured there:
 *
 *   24 of the 25 pandoc-only names tested are NOT type 6 — `para`, `note`, `task`, `screen`,
 *   `synopsis`, `canvas`, `sidebar`, `warning`, `tip`, `example`, `output`, `switch`,
 *   `epigraph`, `procedure`, `simpara`, `programlisting`, `informaltable`, `mediaobject`,
 *   `isindex`, `msgset`, `caution`, `important`, `case`, `default`, `equation`. Each renders
 *   its heading, so a suppression keyed on pandoc's list would DELETE 24 real headings.
 *   (`center` is the ONE that is in both, and it is here.)
 *
 *   15 names CommonMark has and pandoc's `blockTags` lacks DO swallow — `base`, `basefont`,
 *   `dialog`, `frame`, `iframe`, `legend`, `link`, `menuitem`, `optgroup`, `option`, `param`,
 *   `search`, `track`, `title`, `textarea`. Omitting them would only leave a phantom, the
 *   permitted direction, but they are measured and so they are here.
 *
 * ⚠ **The indent is ` {0,3}`, NOT `HTML_BLOCK_OPEN`'s `[ \t]*`, and that inversion is
 * measured.** Session 185 widened `HTML_BLOCK_OPEN` because pandoc's html-block rule does not
 * look at the indent at all. A CommonMark reader has an indented-code rule instead: at 4
 * spaces every opener kind stops being a block and the heading below it RENDERS
 * (`scratchpad/s204/intr` — `n_gfm_div_fresh_i4`, `n_gfm_span_fresh_i4`, `n_gfm_pre_fresh_i4`,
 * `n_gfm_close_fresh_i4`, and the same four with a paragraph open). Reusing the wider class
 * would delete the heading in every one.
 *
 * ⚠ **A CLOSER opens a block too** — `</div>` behaves exactly as `<div>` does
 * (`n_gfm_close_fresh_i0`, `n_gfm_close_para_i0`), which is why the `/?` is here and not a
 * second list.
 */
const COMMONMARK_HTML_TYPE6 =
  "address|article|aside|base|basefont|blockquote|body|caption|center|colgroup|col|dd|details|" +
  "dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frameset|frame|h[1-6]|head|" +
  "header|hr|html|iframe|legend|li|link|main|menuitem|menu|nav|noframes|ol|optgroup|option|" +
  "param|p|search|section|summary|table|tbody|td|tfoot|thead|th|title|tr|track|ul";
const COMMONMARK_HTML_TYPE6_OPEN = new RegExp(
  "^ {0,3}</?(?:" + COMMONMARK_HTML_TYPE6 + ")(?=[ \\t/>]|$)",
  "i",
);
/**
 * CommonMark §4.6 **type 7** — a COMPLETE open or closing tag, of ANY name, alone on its line.
 * It also runs to the next blank line, so it shares type 6's end condition and differs only in
 * what may open it (Session 204).
 *
 * ⚠ **THE NAME IS UNRESTRICTED, AND THAT IS MEASURED RATHER THAN READ OFF THE SPEC.** In the
 * fresh context all 65 names in `scratchpad/s204/name` swallow their heading — including `span`,
 * `em`, `strong`, `button`, `video`, `del`, and the two invented names `foo` and `mytag`. So a
 * tag-NAME list cannot express this row at all; the tag GRAMMAR is the whole rule.
 *
 * ⚠ **AND IT MAY NOT INTERRUPT AN OPEN PARAGRAPH — the guard is load-bearing, not tidiness.**
 * `n_gfm_span_para_i0` and `n_gfm_span_para_i3` render their heading where the `fresh` twins do
 * not: against an open paragraph a type-7 line is ordinary inline content, and the ATX heading
 * below it then interrupts the paragraph normally. This model ALREADY agreed with quarto on
 * both rows before this session, so a type-7 test that ignored `paragraphOpen` would not merely
 * miss an improvement — it would DELETE two real headings that were previously right. That is
 * the whole reason type 6 and type 7 are two constants here and not one.
 *
 * The attribute grammar is CommonMark's own: an unquoted value may not contain whitespace,
 * quotes, `=`, `<`, `>` or a backtick.
 */
const COMMONMARK_HTML_TYPE7_OPEN =
  /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t]*=[ \t]*(?:"[^"]*"|'[^']*'|[^ \t"'=<>`]+))?)*[ \t]*\/?>|<\/[A-Za-z][A-Za-z0-9-]*[ \t]*>)[ \t]*$/;
/**
 * CommonMark §4.6 **type 1** — the four RCDATA-ish tags whose block ends at its OWN closing tag
 * and which a BLANK LINE does not touch (Session 204).
 *
 * ⚠ **THIS IS THE ROW THAT REFUTES "SWALLOW TO THE NEXT BLANK LINE" AS THE WHOLE RULE, IN BOTH
 * DIRECTIONS AT ONCE.** Measured:
 *
 *   `<pre>` / `# Gnd Inside` / (blank) / `# Gnd Below` renders NOTHING — an unclosed type-1
 *   block runs to end of document, so a blank-line end condition would report a heading quarto
 *   does not (`scratchpad/s204/gnd` — `g_gfm_pre_blank_atx`, and `g_gfm_pre_d1/d2`).
 *
 *   `<pre>` / `raw code line` / `</pre>` / `# End Inside` renders the heading, with no blank
 *   line anywhere — so a blank-line end condition would DELETE a real one. All four names
 *   behave identically (`scratchpad/s204/end` — `e_gfm_pre_after`, `e_gfm_script_after`,
 *   `e_gfm_style_after`, `e_gfm_textarea_after`).
 *
 * ⚠ **`textarea` is therefore NOT in the type-6 list above, even though the name corpus shows it
 * swallowing against an open paragraph.** That corpus cannot separate the two types — type 1
 * interrupts a paragraph just as type 6 does — and only the END condition tells them apart.
 * Leaving it in type 6 deletes the heading after `</textarea>`.
 *
 * ⚠ **The closer test is deliberately a bare `indexOf`-style match anywhere on the line, not an
 * anchored tag parse, and the sloppiness is the SAFE direction.** A closer seen where there is
 * none (inside an attribute value, say) ends the block early and leaves a phantom — this
 * project's permitted direction. A closer MISSED keeps the block open and deletes every heading
 * below it, to the end of the document.
 */
const COMMONMARK_HTML_TYPE1_OPEN = /^ {0,3}<(?:pre|script|style|textarea)(?=[ \t/>]|$)/i;
const COMMONMARK_HTML_TYPE1_CLOSE = /<\/(?:pre|script|style|textarea)>/i;
/**
 * A fence opener: leading whitespace of EITHER KIND, then ≥3 of ONE fence char (backtick or
 * tilde), then anything. Capturing the char lets the scanner require the closer to use the
 * same char, so a backtick run can't close a tilde block and vice versa. Shared with cell
 * detection below.
 *
 * ⚠ **The leading class is NOT the fence rule and this regex does not decide the indent —
 * `fenceMatchAt` below does, against the enclosing block's content column.** Until Session
 * 200 the class was CommonMark §4.5's ` {0,3}`, a tolerance measured from SOURCE column 0,
 * which inside a container refused the fence quarto builds there.
 */
const FENCE_OPEN = /^[ \t]*(([`~])\2{2,})(.*)$/;
/**
 * Quarto's OWN cell opener, whose leading whitespace is **unbounded** — `^\s*`, tabs
 * included — where CommonMark's fence rule, and so `FENCE_OPEN` above, caps it at 3
 * spaces. Backticks only, matching both quarto (its `startCodeCellRegEx` has no tilde
 * branch) and `FENCE_OPEN`'s own cell test below.
 *
 * The capture groups are deliberately IDENTICAL in shape and order to `FENCE_OPEN`'s —
 * run, char, rest — so the scanner can substitute one match object for the other.
 *
 * ⚠ This is the CELL opener only. Quarto's PLAIN fence opener is `^```` ``` ````, anchored
 * at column 0, so a non-cell fence is not widened here and keeps CommonMark's 0–3 cap;
 * `computeRegions` reaches this pattern only after `FENCE_OPEN` has declined AND the info
 * string parses as a cell. See `CELL_FENCE_CLOSE` for the matching closer rule.
 */
const INDENTED_CELL_FENCE_OPEN = /^\s*((`)\2{2,})(.*)$/;
/**
 * A closing fence: leading whitespace of either kind, ≥3 of one fence char only, optional
 * trailing space. Its indent is decided by `fenceMatchAt` exactly as the opener's is, and
 * against the SAME column stack — measured, not assumed to match the opener's own column.
 */
const FENCE_CLOSE = /^[ \t]*(([`~])\2{2,})[ \t]*$/;
/**
 * Quarto's `endCodeRegEx` — the same closer with UNBOUNDED leading whitespace. Used only
 * for a fence that opened as a CELL, so a plain fence keeps CommonMark's 0–3 cap exactly
 * as before. Grounded firsthand vs 1.7.33: quarto closes an 8-space-opened cell with a
 * 2-space closer, so the closer's indent need not match the opener's (Session 178).
 *
 * Without this an indented cell would never close and would swallow the rest of the
 * document — which is how this session's FIRST pin went green for the wrong reason.
 */
const CELL_FENCE_CLOSE = /^\s*(([`~])\2{2,})[ \t]*$/;
/**
 * A PLAIN fence match on `line` — opener or closer — or null if these bytes are not a fence
 * HERE (Session 200). `columns` is `[0, ...contentColumns]`, the same array the ATX heading,
 * the setext underline and the raw-TeX row read.
 *
 * ⚠ **The rule is a TOLERANCE relative to the enclosing block's content column, and that is
 * NOT what Session 199 measured one line of markup away.** An ATX heading's indent is an
 * EQUALITY — quarto's pandoc gives it no leading-space slack at all — while a fence keeps
 * CommonMark §4.5's 0-3 slack and merely measures it from the container rather than from
 * source column 0. Two adjacent rows, two different answers; the ATX result was deliberately
 * NOT generalised here (S199's own gotcha 1). Measured over a 96-document grid
 * (`scratchpad/s200/gnd`, 8 container shapes x 12 indents, every one quarto exit 0):
 *
 *   top            (col 0)   fence at 0-3, not 4      `<pre class="qqq">` vs `<pre><code>`
 *   - x            (col 2)   fence at 0-5, not 6
 *   1. x           (col 3)   fence at 0-6, not 7
 *   -   x          (col 4)   fence at 0-7, not 8
 *   - a / ⎵⎵- b    (col 4)   fence at 0-7, not 8
 *   three-deep     (col 6)   fence at 0-9, not 10
 *   footnote body  (col 4)   fence at 0-7, not 8      — and a definition body identically
 *
 * That is exactly the complement of `indentedCodeLine`: a fence is a fence wherever the line
 * is not indented CODE. So the rule is not re-derived here — it reuses the one predicate, and
 * the depth at which a line becomes code and the depth at which a fence stops being a fence
 * can never drift apart. The same reuse the container-opener guard already relies on.
 *
 * ⚠ **The observable had to be the INFO STRING, not `<pre>`.** An unrecognised fence at
 * indent 4+ is an indented code block, which renders `<pre><code>` exactly as a recognised
 * one does and emits no heading either — so neither `<pre>` nor the heading set can tell the
 * two apart. A recognised fence puts its info string in a CLASS; an unrecognised one leaves
 * the literal backticks in the code TEXT.
 *
 * ⚠ **There is deliberately NO `null` SUSPENSION HERE.** The obvious shape — a sentinel that
 * returns the bare match — would now mean "any indent whatsoever", because the regexes above
 * widened to `[ \t]*` in the same commit. That is Session 199's Learning #301 exactly: a
 * `null` fail-safe is relative to its fallback, and it fabricated five headings there when
 * the fallback moved underneath it. Every caller passes a real column set.
 *
 * ⚠ **`\s` vs `[ \t]` is a real distinction on the CELL rows and is left alone.** Session 178
 * measured a FORM FEED, a VERTICAL TAB and a NO-BREAK SPACE each opening a cell, which is why
 * `INDENTED_CELL_FENCE_OPEN` and `CELL_FENCE_CLOSE` keep `\s`. Those rows carry quarto's own
 * indentation-blind cell partitioner and are NOT container-relative; this row governs the
 * PLAIN fence only, and S178's deliberate asymmetry between the two survives unchanged.
 */
function fenceMatchAt(
  re: RegExp,
  line: string,
  columns: readonly number[],
): RegExpExecArray | null {
  const m = re.exec(line);
  return m !== null && !columnIsCodeDepth(indentColumn(line), columns) ? m : null;
}
/** The `---` line that opens a YAML front-matter block — only valid at line 0. */
const FRONTMATTER_OPEN = /^---[ \t]*$/;
/** A YAML front-matter terminator: `---` or `...` (YAML's document-end marker). */
const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;
/** A line that opens a (block-form) HTML comment — Pandoc renders nothing inside. */
const COMMENT_OPEN = /^[ \t]*<!--/;
/** Any line containing an HTML-comment terminator. */
const COMMENT_CLOSE = /-->/;
/**
 * A line that is ENTIRELY a single-line HTML comment (`<!-- … -->`, optional
 * surrounding whitespace). Pandoc renders nothing for it, so it is neither prose
 * nor a heading — excluded from body lines so a `{#fig-…}` inside it is not
 * indexed as a cross-ref (the block-comment case is already handled by the
 * `inComment` state; this closes the single-line gap). A line that mixes content
 * with a trailing comment is left as body (the content half is real). The
 * tempered `(?:(?!-->)…)*` makes the closer the FIRST `-->`, so a line that
 * merely starts and ends with comments but has real prose between them (which
 * Pandoc renders) is NOT treated as a whole-line comment.
 */
const COMMENT_FULL_LINE = /^[ \t]*<!--(?:(?!-->)[\s\S])*-->[ \t]*$/;
/**
 * A brace info string for an *executable* cell: `{` then a language identifier,
 * optionally followed by knitr-style options, then `}`.
 *
 * The language class and the option tail are quarto's own, transcribed from the
 * installed 1.7.33 — `breakQuartoMd`'s cell recognizer, read out of
 * `/Applications/quarto/bin/quarto.js` rather than from a docstring quoting it:
 *
 * ```js
 * const startCodeCellRegEx = new RegExp("^\\s*(```+)\\s*\\{([=A-Za-z]+)( *[ ,].*)?\\}\\s*$");
 * ```
 *
 * The capture is `[=A-Za-z]+` — **letters and `=` only: no digits, no dots, no
 * hyphens, no underscores** — and the tail is `( *[ ,].*)?`, i.e. the options must
 * begin at a SPACE or a COMMA. A token that fails it is not a cell to quarto at all:
 * `breakQuartoMd` builds no code cell, `partitionCellOptionsMapped` never runs, and
 * NOTHING inside is validated.
 *
 * ## Why this is not `[^}]*` any more (Session 172)
 *
 * The previous tail was `[^}]*`, which **truncated** where quarto **rejects** — and it
 * was wrong in BOTH directions. Every row measured firsthand vs 1.7.33 with
 * `quarto render --no-execute`, one bad option at column 0, controls in the suite:
 *
 * | info string | quarto | before | after |
 * |---|---|---|---|
 * | `{python3}` `{python2}` `{fortran95}` `{d3}` | exit 0 — no cell | cell `python3`… | no cell |
 * | `{r.foo}` | exit 0 — no cell | cell `r` | no cell |
 * | `{r-foo}` `{r_foo}` | exit 0 — no cell | cell `r-foo`/`r_foo` | no cell |
 * | `{ré}` | exit 0 — no cell | cell **`r`** | no cell |
 * | `` {r\techo=FALSE} `` (TAB) | exit 0 — no cell | cell `r` | no cell |
 * | `{r=1}` `{mermaid=x1}` | exit 0 — no cell | cell `r`/`mermaid` | no cell |
 * | `{mermaid=x}` `{mermaid=xy}` `{r=}` | exit 1 — cell `mermaid=x` | cell **`mermaid`** | cell `mermaid=x` |
 * | `{r, fig.cap="}"}` `{r,}}` | exit 1 — cell `r` | **no cell** | cell `r` |
 *
 * The last two rows are the ones a "tighten the regex" framing misses. `[^}]*` cannot
 * span a `}` inside a quoted chunk option, so a **legitimate knitr chunk header** was
 * not a cell to us while quarto validates it — a lost true positive, recovered here.
 * And truncation on `{ré}` produced a cell whose language was literally `r`,
 * indistinguishable from a real one to every consumer at once.
 *
 * ## The letter-led rule is deliberately KEPT, and it is a divergence
 *
 * Requiring a letter immediately after `{` still excludes `{{python}}` (the display
 * form) and `{.python}` (a Pandoc class). It ALSO excludes the `=`-led raw blocks
 * `` ```{=html} ``/`` ```{=latex} ``, which quarto's `[=A-Za-z]+` DOES accept — and
 * measurement confirms quarto validates them: `{=html}` + `#| echo: banana` renders
 * **exit 1**, and in a knitr document `#| cache: banana` there renders exit 1 too, so
 * a raw block takes the document engine's schema like any other cell. Adopting that
 * would WIDEN what we squiggle onto a new block class, which is the cardinal-sin
 * direction and its own deliverable — it is the separately filed raw-block item, whose
 * "NOT re-verified" caveat this session discharged. Until then we under-report there,
 * which is the safe direction. **Do not "complete" this by dropping the leading
 * `[A-Za-z]`** without doing that item's consumer work: `cell.lang` would become
 * `"=html"` at the outline, the virtual-document language map, run-cell and refs.
 *
 * ⚠ This is NOT the same grammar as the engine-selection language scan, and the two
 * must not be consolidated: quarto's own `languagesInMarkdown` uses `[a-zA-Z0-9_]+`
 * (digits and underscore IN, `=` OUT) — see `document-engine.ts`. Their disagreement
 * is a faithful reproduction of quarto's, not drift. Unifying them would regress both
 * directions: a `{python3}`-only document would stop resolving jupyter, and a
 * `{=html}`-only one would start.
 */
const CELL_INFO = /^\{([A-Za-z][=A-Za-z]*)( *[ ,].*)?\}$/;
/**
 * An inline code span — a run of N backticks closed by the next run of exactly
 * N (CommonMark §6.3). Its content is rendered literally, so any markup shown
 * inside it (a `{#fig-…}` label, a `$x$` math delimiter) is documentation, not a
 * live construct. Consumers mask it out before scanning a body line.
 */
const INLINE_CODE_SPAN = /(`+)(?:(?!\1)[\s\S])*?\1/g;

/** An open fence the scanner is currently inside. */
interface OpenFence {
  readonly char: string;
  readonly len: number;
}

/** An open fence carrying the metadata needed to emit a cell on close. */
interface OpenCellFence extends OpenFence {
  readonly isCell: boolean;
  readonly lang: string;
  readonly startLine: number;
  /**
   * The column stack in force where this fence OPENED, carried so the closer is judged
   * against the same containers the opener was (Session 200).
   *
   * ⚠ Carrying it is not a convenience — it is the only place the stack is still available.
   * While a fence is open the scanner `continue`s ABOVE the container-maintenance block, so
   * `contentColumns` is frozen for the whole region and is never recomputed for the closer's
   * own line. Measured: quarto accepts a closer at any non-code column of the OPENER's
   * containers and does NOT require it to match the opener's own column — a fence opened at
   * column 7 inside `-   item` closes at 0 through 7 alike, and refuses at 8
   * (`scratchpad/s200/cls`, 72 documents, opener column x closer column).
   */
  readonly columns: readonly number[];
}

/** A document line that is live content — outside front matter, comments, and code fences. */
export interface BodyLine {
  /** 0-based line index. */
  line: number;
  /** The raw line text. */
  text: string;
}

/**
 * A Quarto cell-option line — an interior line of an executable cell that begins
 * with the comment-option prefix `#|` (python/r/julia) or `//|` (ojs/js), e.g.
 * `#| echo: false`. These carry per-cell execution/figure options in YAML and are
 * where the YAML completion provider (Phase 6d) offers option-name suggestions.
 */
export interface CellOptionLine {
  /** 0-based line index of the option line in the whole document. */
  line: number;
  /**
   * 0-based line index of the owning cell's opening FENCE — the identity of the cell
   * this option belongs to, so a consumer can group a flat option list back into cells.
   *
   * Emitted rather than inferred because the alternative is arithmetic on `line` gaps
   * ("two consecutive option lines are the same cell"), which happens to hold today only
   * because a cell's options are its LEADING contiguous run (S160) and two cells are
   * always separated by at least a closing and an opening fence. That is a property of
   * two other rules rather than a stated one, and the enumerator already knows the exact
   * answer — value-diagnostics needs it to honour a PER-CELL `validate-yaml: false`,
   * which disarms exactly one cell and must not leak to the next (grounded firsthand,
   * S163: cell 1 carrying the flag leaves cell 2's `#| echo: banana` at exit 1).
   */
  cellStartLine: number;
  /** The owning cell's engine/language, e.g. `"python"`, `"r"`, `"ojs"`. */
  cellLang: string;
  /**
   * The comment-option prefix actually used on the line — the cell language's comment
   * OPENER followed by the pipe, with any whitespace between them normalized away
   * (`#  | echo: false` reports `#|`). Quarto scopes the opener to the cell language
   * (`kLangCommentChars`), so this is not limited to `#|`/`//|`: a `{sql}` cell reports
   * `--|`, `{matlab}` reports `%|`, `{c}` reports `/*|` (S161). For a block-comment
   * language the closing suffix is NOT part of this field — it is stripped from the
   * option's content and never enters the key/value spans.
   */
  prefix: string;
  /**
   * The 0-based column just past the end of the option's YAML CONTENT — i.e. where the
   * directive's payload stops. For a line-comment language that is the end of the line, so
   * it constrains nothing; for a BLOCK-comment language it excludes the closing delimiter
   * (`/*| echo: banana` + the closer reports the column just past `banana`).
   *
   * `keySlot`/`valueSlot` are already computed from the closer-stripped content and need no
   * adjustment. This bound exists for a consumer that must re-derive spans from the RAW line
   * text — value-diagnostics does, because it resolves the true YAML key/value SEPARATOR
   * rather than the first colon (S159) — and would otherwise slice the closer into the
   * value. That is not cosmetic: it would flag a valid `echo: false` directive in a `{c}`
   * cell, because `false` plus the closer is not in echo's closed value set, on a document
   * quarto renders exit 0 (S161).
   */
  contentEndCol: number;
  /**
   * The span `[startCol, endCol)` of the option *key* token (the text before the
   * `:`), 0-based columns. An empty span (`startCol == endCol`) marks a line with
   * the prefix but no key yet (e.g. `#| `). `null` when the line cannot host a
   * key — a block-sequence item (`- value`) under a key.
   */
  keySlot: { startCol: number; endCol: number } | null;
  /**
   * The span `[startCol, endCol)` of the option *value* token (the text after the
   * `:`, leading whitespace skipped and trailing whitespace excluded), 0-based
   * columns. An empty span marks `key:`/`key: ` with no value typed yet. `null`
   * when the line has no `:` (a key still being typed) or cannot host a value (a
   * block-sequence item). Drives value completion (Slice 6d-2).
   */
  valueSlot: { startCol: number; endCol: number } | null;
}

/**
 * The leading YAML front-matter block, captured in the single scan so every
 * consumer (the region views AND `findFrontMatter`/`inFrontMatter`) agrees on
 * its bounds — there is no second front-matter scanner (Learning #14). `endLine`
 * is the closing terminator line for a terminated block, or the document's last
 * line when the block is unterminated; `terminated` distinguishes the two so the
 * `inFrontMatter` predicate can decide whether the last line is content.
 */
interface FrontMatterSpan {
  startLine: number;
  endLine: number;
  terminated: boolean;
}

/** The parsed structural regions of a document. */
interface Regions {
  headings: Heading[];
  cells: Cell[];
  bodyLines: BodyLine[];
  frontMatter: FrontMatterSpan | null;
}

/**
 * The last `computeRegions` result, memoized on its exact input text. Every
 * public accessor below routes through the single scan, and a single semantic-
 * token pass calls them repeatedly on the *same* document text: `embeddedLanguagesIn`
 * scans twice and `buildVirtualContent` scans twice more per embedded language,
 * so a document with N embedded languages was rescanned 2 + 2N times per debounced
 * pass (CHANGELOG: semantic-token pass rescans the document 2+2N times, Session 95). A single-entry (last-value) cache
 * collapses all same-text calls in a pass to ONE scan while evicting naturally
 * when the text changes — a `Map` keyed on full document text would instead grow
 * unboundedly across edits. Sound because `computeRegions` is a pure function of
 * `text` (no external state, time, or randomness), so equal text ⇒ equal regions;
 * the key comparison is a value comparison (JS `===` on strings).
 */
let regionsCache: { text: string; regions: Regions } | null = null;

/**
 * The parsed regions of `text`, served from the single-entry cache on a repeat
 * call with identical text (see `regionsCache`). The returned `Regions` object,
 * its arrays, AND their `Cell`/`Heading`/`BodyLine` elements are shared across
 * calls and MUST be treated as immutable — the same contract every consumer has
 * always honored (the codebase reads them only; it even types `runCells(cells:
 * readonly Cell[])`). The public array accessors (`findHeadings`/`findAllCells`/
 * `findBodyLines`) additionally `.slice()` so the array *spine* a caller receives
 * is its own (reordering/adding/removing cannot reach the cache); the ELEMENTS in
 * that array are still the shared region objects, so a caller must not mutate an
 * element's fields (`cell.code`, `heading.text`, …) — no consumer does.
 */
function scanRegions(text: string): Regions {
  if (regionsCache !== null && regionsCache.text === text) {
    return regionsCache.regions;
  }
  const regions = computeRegions(text);
  regionsCache = { text, regions };
  return regions;
}

/**
 * Walk the document once, classifying each line by region so that heading and
 * cell detection AGREE on what to skip: YAML front matter (a leading
 * `---`…`---`/`...`), block HTML comments (`<!-- … -->`, which Pandoc does not
 * render), and code fences. This single pass is the model's source of truth;
 * `findHeadings`, `findAllCells`, and `buildOutline` are thin views over it.
 * Reached only through the memoizing `scanRegions` wrapper above.
 *
 * Cell rules (CommonMark + Quarto): a fence opened with N of a char closes on a
 * line of ≥N of that char with no info string. Only a backtick fence whose info
 * string is a brace-wrapped language (```` ```{python} ````) is an executable
 * cell — this excludes plain ```` ```python ````, the ```` ```{{python}} ````
 * display form, ```` ```{.python} ```` Pandoc class blocks, and any `{lang}`
 * fence nested inside an outer (longer or tilde) fence.
 */
function computeRegions(text: string): Regions {
  const lines = text.split(/\r?\n/);
  const closerIndex = buildCloserIndex(lines);
  const headings: Heading[] = [];
  const cells: Cell[] = [];
  const bodyLines: BodyLine[] = [];
  let frontMatter: FrontMatterSpan | null = null;
  let inFrontmatter = false;
  let inComment = false;
  let open: OpenCellFence | null = null;
  // Count of consecutive fresh, non-blank body lines immediately above the
  // current line, reset to 0 on any region boundary (front matter, comment,
  // fence, blank line) or heading (ATX or setext), and — since Session 181 — on a
  // line that begins a fresh block (`OPENS_FRESH_BLOCK`), because the paragraph a
  // setext underline claims starts BELOW such a line, not at it. A setext underline
  // is only recognized when this is exactly 1 — see `SETEXT_H1`'s docstring.
  let consecutiveBody = 0;
  // Whether a PARAGRAPH is open on the line above — pandoc's `blank_before_header`
  // rule, which an ATX heading may not interrupt. Deliberately SEPARATE state from
  // `consecutiveBody`: that counter serves the setext disambiguation and folding it
  // into this one would change which setext underlines are recognized.
  let paragraphOpen = false;
  // Whether the currently-open paragraph began inside a BLOCK QUOTE (Session 183). The
  // `paragraphOpen` gate is suspended there: measured, a 4-space-indented `---` in a quote's
  // lazy continuation IS a setext underline and closes the block, so the heading below it is
  // real — a construct this model cannot see, having no block-quote context. Needs no
  // clearing at the region-boundary resets: those set `paragraphOpen` to false, and the next
  // body line recomputes this before it is read.
  let paragraphQuoted = false;
  // Whether the line ABOVE was an ATX heading (Session 182). Pandoc swallows such a line
  // into a SETEXT heading when a `=`/`-` run follows it DIRECTLY, which closes the block;
  // this model declines that swallow, so it recovers the closure here instead. See
  // `closesParagraph`. ⚠ Unlike `pendingFreshBlock` and `prevIndentedCode`, this one DOES
  // need clearing at every region boundary and blank line — the adjacency is literal, and
  // a blank line between the heading and the run ends it. That is why it is snapshotted
  // and cleared at the TOP of the loop rather than at the foot. Pinned.
  let prevWasAtxHeading = false;
  // Whether the line ABOVE belonged to a pandoc LINE BLOCK, so an indented line below it is
  // that block's continuation rather than the start of a paragraph (Session 185). Like
  // `prevWasAtxHeading` — and unlike `pendingFreshBlock` — it is snapshotted and cleared at
  // the TOP of the loop, which is what ends the block at a blank line, a fence, a comment or
  // a front-matter block: each of those `continue`s without reaching the assignment at the
  // foot. Measured, and required: `| line one` / (blank) / `  continued` / `# ATX Below`
  // renders NO heading, so an arm that survived the blank line would fabricate one.
  // ⚠ The explicit annotation is load-bearing: this flag is snapshotted into `lineBlockAbove`
  // and then re-assigned FROM an expression reading that snapshot, which tsc reports as a
  // circular inference (TS7022) without it.
  let lineBlockOpen: boolean = false;
  // Whether a pipe TABLE's delimiter row has been seen in the current block, which disarms
  // the line-block rule for the table's remaining body rows — see `TABLE_RULE_ROW`.
  // ⚠ Unlike `lineBlockOpen` this one is STICKY across the table's body rows, so it cannot be
  // cleared at the top of the loop. It is cleared instead at EVERY region boundary that
  // already ends a block — a blank line, a whole-line or opening HTML comment, a fence
  // opener, a setext underline and an ATX heading — and clearing it at only the blank line
  // was measured wrong: a comment, a fence or a heading between a table and a genuine line
  // block left the guard armed and the heading below was never recovered (found by Session
  // 185's adversarial sweep). The phantom risk of the broader clear was measured before it
  // was made and there is none — a comment, a fence and a heading each really do END the
  // table, so a `| …` run below one is a fresh line block and quarto renders the heading
  // whether what follows the boundary is a line block or another table body row.
  let inPipeTable = false;
  // A front-matter `from:` disables the paragraph rule for the whole document — see
  // `FRONTMATTER_FROM_KEY`. Without this the change DELETES headings quarto renders.
  let dialectOverride = false;
  // Whether the front-matter `from:` names a reader of the CommonMark FAMILY — see
  // `FRONTMATTER_COMMONMARK_FROM`. Deliberately a SECOND flag beside `dialectOverride`
  // rather than a refinement of it: that one keys on the KEY's presence and is read by the
  // ATX row at two sites, where its fail-open direction is a measured phantom. Here the
  // fail-open direction is a DELETION, so the two cannot share a flag.
  let commonmarkDialect = false;
  // Whether the line ABOVE began a fresh block, making this line a paragraph start
  // (Session 181). Deliberately a one-line deferral rather than a reset — see the loop.
  // It needs no clearing at the region-boundary resets below: those set `consecutiveBody`
  // to 0, where both branches of the deferral produce 1 for the next body line anyway.
  let pendingFreshBlock = false;
  // Whether the line above was an indented code line, so a run of 2+ can be told from a
  // lone indented line. Same reasoning as above for why the resets need not clear it.
  let prevIndentedCode = false;
  // Whether the line above was an HTML-BLOCK opener. Read only by the multi-line setext title
  // below, and only under a CommonMark reader, where such a block runs to the next blank line
  // instead of releasing the line under it as a fresh paragraph (Session 203).
  let prevOpenedHtmlBlock = false;
  // Whether the body run this line belongs to was OPENED by a construct whose content is not a
  // paragraph — an indented code line, a fence, an HTML block or a block quote. Decided by the
  // run's FIRST line and then carried, because such a construct cannot INTERRUPT an open
  // paragraph while it can certainly START a block (Session 203). It bounds the multi-line
  // title below; it needs no clearing at the resets for the same reason as the two above.
  // See `COMMONMARK_RUN_OPENS_BLOCK` for why this is NOT the interrupt list.
  let bodyRunOpensNonParagraph = false;
  // Whether a raw HTML BLOCK is open above this line under a CommonMark-family reader, where
  // such a block swallows every line it covers — so no heading inside one may be reported
  // (Session 204). `null` means no block is open; otherwise it names the END CONDITION, which
  // is what the block's CommonMark TYPE decides and what `prevOpenedHtmlBlock` above (a
  // one-line lookback) cannot express. See `COMMONMARK_HTML_TYPE6_OPEN`.
  let commonmarkHtmlBlock: "blank" | "type1" | null = null;
  // The content column of every CONTAINER open above this line, ascending, EXCLUDING the
  // document root's own 0 which is always available (Session 189). This is the state the
  // raw-TeX row's ` {0,3}` was standing in for: pandoc re-parses a container's content
  // DEDENTED, so the container's content column is that sub-document's column 0, and a raw
  // TeX block must start exactly there. See `rawTexMacroLineIsBlock`.
  //
  // ⚠ **Push liberally, pop conservatively — the two errors are not symmetric.** A column
  // pushed that pandoc does not open merely re-admits an indent this file already admitted
  // before this session (a pre-existing phantom). A column missing that pandoc DOES open
  // deletes a real heading. Every rule below is written to fail in the first direction.
  let contentColumns: number[] = [];
  // How many of those columns were open ABOVE the line being scanned, i.e. before this line
  // opened one of its own (Session 202). Read only by the setext row — see the assignment in
  // the container-maintenance block for why that row cannot use the post-push length.
  let columnsAboveThisLine = 0;
  // Whether each of those columns was opened by a construct the CommonMark readers actually
  // have, index for index with `contentColumns` (Session 202). A THIRD parallel array for the
  // same reason `columnKinds` is a second one: the stack itself is handed to three consumers as
  // a plain `readonly number[]`, and only this session's row asks this question.
  const columnIsCommonmark: boolean[] = [];
  // What OPENED each of those columns, index for index with `contentColumns` (Session 198).
  // Only the container POP reads it, and only in its no-blank branch: a shallow LIST START
  // closes a LIST ITEM container and does NOT close a FOOTNOTE or DEFINITION-LIST one, so a
  // column alone cannot answer the question. Measured over 40 documents through the real
  // `quarto render` path (`scratchpad/s198/reg`) — container kind x four shallow spellings:
  // a definition container survives all four, a list item container survives prose only.
  // ⚠ Kept as a PARALLEL array rather than folding the pair into one object: `contentColumns`
  // is handed to `setextUnderlineLevel`, `indentedCodeLine` and `rawTexMacroLineIsBlock` as a
  // plain `readonly number[]` (twice as `[0, ...contentColumns]`), and changing its element
  // type would touch all three readers for a fact none of them uses.
  const columnKinds: ("list" | "definition")[] = [];
  // Whether a BLOCK QUOTE may still be open, which suspends the column rule entirely — see
  // the assignment at the foot of the loop. Measured, and the single largest deletion trap in
  // this change: `> quoted` / `>` / `   \clearpage` / `   # ATX Below` renders the heading
  // INSIDE the blockquote at EVERY indent 0–8 (verified against the rendered HTML, not
  // inferred), because pandoc strips the quote's markers and re-parses what is left. This
  // model carries no block-quote container, so while one may be open the raw-TeX row keeps
  // its old ` {0,3}` width rather than guess a column — phantoms, never deletions.
  let quoteOpen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // The ATX-adjacency state is consumed by THIS line and by no later one — pandoc
    // swallows the heading only when the run is the line IMMEDIATELY below it. Clearing
    // it here, at the top, is what makes that "immediately" true through every `continue`
    // path below: a blank line, a fence, a comment or a front-matter block between the
    // heading and the run all end the adjacency, and each of those paths `continue`s
    // without reaching the assignment at the foot of the loop. Measured — `# Heading` /
    // (blank) / `===` / `# ATX Below` renders NO heading below, where the same document
    // without the blank renders one.
    const prevLineWasAtxHeading = prevWasAtxHeading;
    prevWasAtxHeading = false;
    // ⚠ The explicit annotation is load-bearing, not style: this snapshot is read by the
    // expression that re-assigns `lineBlockOpen` at the foot of the loop, and tsc reports the
    // round trip as a circular inference (TS7022) unless one end of it is annotated.
    const lineBlockAbove: boolean = lineBlockOpen;
    lineBlockOpen = false;
    // Whether the line ABOVE this one is blank — the container pop's suppression test
    // (Session 198). Read from the raw line rather than carried in a flag on purpose: every
    // `continue` path below would have to maintain such a flag, and the two that skip a whole
    // region (an open fence, a block comment) never reach the pop at all, so a flag would
    // record a line the pop never sees. The first line of a document has nothing above it and
    // no container can be open there, so `true` is the reading that costs nothing.
    const prevLineBlank = i === 0 || BLANK_LINE.test(lines[i - 1]);

    // YAML front matter — only a `---` on the very first line opens it. Record
    // the span as it opens (provisionally unterminated, ending at EOF) and refine
    // `endLine`/`terminated` when the terminator is seen.
    if (i === 0 && FRONTMATTER_OPEN.test(line)) {
      inFrontmatter = true;
      frontMatter = { startLine: 0, endLine: lines.length - 1, terminated: false };
      continue;
    }
    if (inFrontmatter) {
      if (FRONTMATTER_FROM_KEY.test(line)) {
        dialectOverride = true;
      }
      if (FRONTMATTER_COMMONMARK_FROM.test(line)) {
        commonmarkDialect = true;
      }
      if (FRONTMATTER_CLOSE.test(line)) {
        inFrontmatter = false;
        frontMatter = { startLine: 0, endLine: i, terminated: true };
      }
      continue;
    }

    // Inside a code fence, only the matching closer matters — a `#`, `-->`, or
    // nested fence here is literal. Emit the cell when the fence closes.
    if (open !== null) {
      if (isCloser(line, open)) {
        if (open.isCell) {
          cells.push(makeCell(open, i, lines, true));
        }
        open = null;
      }
      continue;
    }

    // Inside a block HTML comment: skip until it terminates.
    if (inComment) {
      if (COMMENT_CLOSE.test(line)) {
        inComment = false;
      }
      continue;
    }
    // ── The containing block's content column (Session 189) ──────────────────────────────
    // Placed here, above every remaining `continue`, so a line that ends a container still
    // closes it on its way past: a heading, a thematic break, a fence opener and an HTML
    // comment were each measured ENDING a list whose column would otherwise have outlived
    // them. Blank lines do nothing — a container survives any number of them (measured: one,
    // two and three blanks all keep a `- ` item's column 2 alive), which is exactly why this
    // sits above the blank-line branch rather than inside the body handling.
    if (!BLANK_LINE.test(line)) {
      // ⚠ The line's indent is measured in COLUMNS, not in a count of SPACES (Session 194).
      // A tab advances to the next 4-column stop, so `\t\t` is column 8 — and the row this
      // replaced, `/^ */`, read it as 0 and closed every container deeper than the page edge.
      // Measured as an EQUIVALENCE over 432 ground documents rendered through the real
      // `quarto render` path: every tab spelling and the SPACE spelling reaching the same
      // column render IDENTICALLY, 276 of 276 pairs, across six containers, columns 0-12 and
      // both consumer families. See `indentColumn`.
      const indentWidth = indentColumn(line);
      // A non-blank line at a SHALLOWER column closes every container deeper than itself —
      // but ONLY where the line ABOVE IT IS BLANK, because a shallow line that directly
      // follows a non-blank one is absorbed LAZILY by the enclosing item and closes nothing.
      // Measured both ways: `- one` / `line two lazy` / (blank) keeps column 2, while
      // `- one` / (blank) / `top level para` / (blank) drops it.
      //
      // ⚠ **THE TEST IS THE BLANK LINE, NOT `paragraphOpen` (Session 198).** `paragraphOpen`
      // was a PROXY for "this line is a lazy continuation" and it is false wherever the line
      // above is non-blank but is not a PARAGRAPH — a consumed setext underline, an ATX
      // heading, a thematic break, a fence, an HTML comment, an indented code line. Each of
      // those armed a pop pandoc does not make. The setext underline is the expensive one and
      // it is why this row changed: that branch sets `paragraphOpen = false` and `continue`s,
      // so a column-0 line below closed a list pandoc keeps OPEN and the underline further
      // down matched no column at all, DELETING its heading. Session 197's blind 222-document
      // adversarial sweep found this by four independent lenses; it was the largest single
      // loss mechanism in it.
      //
      // Measured as a 64-document sweep through the real `quarto render` path
      // (`scratchpad/s198/pop`): 8 spellings of the line ABOVE x 4 spellings of the shallow
      // line x 2 body shapes. The answer separates PERFECTLY on two facts and on nothing
      // else — the line above being blank, and the shallow line being a LIST START. All eight
      // "above" spellings behave identically once the blank is controlled for.
      //
      // ⚠ **A LIST START CLOSES A LIST ITEM AND NOTHING ELSE, and that qualification is not a
      // refinement — without it this row DELETES REAL HEADINGS.** The two facts above, shipped
      // alone, scored zero new errors over the 203-document designed sweep and then lost three
      // headings in a 300-document completeness pass, every one of them this shape: a footnote
      // or definition-list container, a shallow list start, and a probe at the container's own
      // content column that quarto still honours. Pandoc breaks a LIST ITEM's lazy absorption
      // at a sibling marker; a definition body has no siblings and absorbs the marker like any
      // other line. Measured per container kind (`scratchpad/s198/reg`) — a definition
      // container survives all four shallow spellings, a list item survives prose only.
      //
      // The test is over EVERY column being popped, not just the top one: with a definition
      // column below a list column, quarto keeps BOTH across a shallow marker
      // (`scratchpad/s198/nest`, `defthenlist`), so stopping at the first non-list from the top
      // would still delete the deeper heading.
      const deeperColumnsAreAllLists = contentColumns.every(
        (c, idx) => c <= indentWidth || columnKinds[idx] === "list",
      );
      if (prevLineBlank || (deeperColumnsAreAllLists && popsEnclosingContainer(line))) {
        while (contentColumns.length > 0 && contentColumns[contentColumns.length - 1] > indentWidth) {
          contentColumns.pop();
          columnKinds.pop();
          columnIsCommonmark.pop();
        }
      }
      // ⚠ AN OPENER AT CODE DEPTH OPENS NOTHING (Session 196), because it is not an opener at
      // all — a line 4 or more columns past the enclosing block's content column is INDENTED
      // CODE to pandoc, and `- inner` inside a code block is the literal text `- inner`. The
      // condition is exactly `indentedCodeLine`, reused rather than re-derived, so the depth at
      // which a container stops being a container and the depth at which a line becomes code
      // can never drift apart.
      //
      // ⚠ This guard is a SCOPE AMENDMENT, and it is here because the measurement forced it —
      // not because it was adjacent. This session's own 1,265-document ground corpus scored the
      // opener change at NEW LOST = 0, because it reads the column stack through ONE consumer:
      // the setext underline, where this family can only ever show up as a phantom. A BLIND
      // 240-document adversarial sweep then measured 39 NEW LOST through the OTHER consumer,
      // `indentedCodeLine` — a tab-indented opener at top level is at column 4, and pushing a
      // column for it lifts the code base so the code block below it becomes an open paragraph,
      // which deletes the ATX heading underneath. Shipping the opener change alone would have
      // deleted 39 real headings.
      // ⚠ **The columns open ABOVE this line, before this line opens one of its own** — read
      // ONLY by the setext row's CommonMark set (Session 202), and read there because a lone
      // `-` is BOTH a level-2 underline and a list marker. The container block runs at the top
      // of every iteration, so by the time that row asks for the INNERMOST column the underline
      // has already pushed one, and measuring the tolerance from it DELETES the heading quarto
      // renders (`scratchpad/s202/adv/ws/ws_08`, found by a blind lens). The POP above is
      // deliberately still applied — `ax/pop_gfm_*` measures that a title closing an inner item
      // really does move the tolerance out to the surviving column.
      columnsAboveThisLine = contentColumns.length;
      if (!indentedCodeLine(line, contentColumns)) {
        const opened = listItemContentColumn(line);
        if (opened !== null) {
          contentColumns.push(opened);
          columnKinds.push("list");
          columnIsCommonmark.push(COMMONMARK_LIST_MARKER.test(line));
        } else if (CONTENT_COLUMN_4_OPEN.test(line)) {
          // A footnote definition and a definition-list definition both give their content
          // exactly 4 columns past their own indent — measured, and independent of label length.
          contentColumns.push(indentWidth + 4);
          columnKinds.push("definition");
          // ⚠ BOTH spellings count as CommonMark here, and the definition-list half of that is
          // KNOWN WRONG for `gfm`/`commonmark` and RIGHT for `commonmark_x` — which is exactly
          // why it is not narrowed. gfm has footnotes (measured, `ax/fn_gfm_u5`), and
          // `commonmark_x` has definition lists (measured, `ctl/defset_cmx_u4`), so refusing
          // the `:`/`~` spelling would trade this row's 6 disclosed PHANTOMS under two readers
          // for a DELETION under a third. Telling the three apart needs a per-reader construct
          // table, which is the container stack's question and not this row's.
          columnIsCommonmark.push(true);
        }
      }
      if (BLOCK_QUOTE_MARKER.test(line)) {
        quoteOpen = true;
      }
    }

    // A whole-line single-line comment renders to nothing — skip it entirely.
    if (COMMENT_FULL_LINE.test(line)) {
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = false;
      continue;
    }
    if (COMMENT_OPEN.test(line) && !COMMENT_CLOSE.test(line)) {
      inComment = true;
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = false;
      continue;
    }

    // A fence opener (captures cell metadata so the closer can emit the cell).
    // When CommonMark's 0–3-space rule declines, quarto's unbounded CELL opener gets a
    // second look — but ONLY when the info string really is a cell, so a plain fence
    // keeps the CommonMark cap (Session 178).
    // ⚠ AN OPEN PARAGRAPH ABOVE THE OPENER KEEPS THE PRE-SESSION-200 WIDTH, and the narrowness
    // of that is the point: a plain fence does NOT in general interrupt an open paragraph, and
    // what quarto does there is a SEPARATE rule this session did not measure. Rendered:
    // `-   item one` / `    paragraph line` / `    ```` ``` ```` is ONE paragraph whose backtick
    // pair is an INLINE code span, and treating it as a fence fabricates the heading below it.
    //
    // ⚠ The obvious `paragraphOpen` bail on the whole branch is MEASURABLY WRONG — at column 0
    // the fence really does interrupt (`scratchpad/s200/par`, `par_top_i00`), and bailing there
    // DELETES a heading both builds get right. The interrupt rule also turns on the fence CHAR
    // (a `~~~` opener at column 0 does not interrupt where a backtick one does), which is
    // conclusive that it is a different question from this row's indent. So the boundary drawn
    // here is "this session's change does not apply", not a new rule invented to fit the diff.
    //
    // ⚠ `[0]` rather than a `null` SUSPENSION, deliberately (Learning #301). The regexes above
    // widened to `[ \t]*` in the same commit, so a sentinel meaning "return the bare match"
    // would now mean ANY indent whatsoever — the exact fallback drift that fabricated five
    // headings in Session 199. `[0]` is a bounded value that reproduces CommonMark's ` {0,3}`
    // cap exactly through the shared predicate: base 0, so columns 0-3 pass and 4 is code. It
    // covers tabs correctly for free, since one tab already reaches column 4.
    const fenceColumns = paragraphOpen ? [0] : [0, ...contentColumns];
    const plainFence = fenceMatchAt(FENCE_OPEN, line, fenceColumns);
    const fence = plainFence ?? indentedCellFenceAt(line);
    if (fence) {
      const char = fence[2];
      const info = char === "`" ? CELL_INFO.exec(fence[3].trim()) : null;
      const candidate: OpenCellFence = {
        char,
        len: fence[1].length,
        isCell: info !== null,
        lang: info ? info[1] : "",
        startLine: i,
        columns: fenceColumns,
      };
      // A FENCE OPENS ONLY IF IT IS CLOSED BELOW — both kinds, for two different measured
      // reasons that happen to agree (Session 179; Session 178 applied this test to
      // indented cell fences only).
      //
      // For a CELL, `breakQuartoMd` never pushes the opening fence into its line buffer, so
      // a cell it never closes is emitted by the final `flushLineBuffer("markdown", …)`
      // WITHOUT its opener: quarto deletes the fence and the rest of the document is
      // ordinary markdown. Measured vs 1.7.33 — 3-tick/4-tick, 4-tick/3-tick and
      // unterminated all render exit 0 where the 3/3 twin renders exit 1.
      //
      // For a PLAIN fence the rule is pandoc's, not CommonMark's: `-f markdown` (quarto's
      // dialect, and the one this file's setext rules were already grounded against)
      // requires a closing fence, where CommonMark runs an unclosed one to end of document.
      // Measured with `quarto pandoc -f markdown -t html`: an unclosed ``` is `<p>``` …</p>`
      // whether it sits at line 0, after a blank, or mid-paragraph — only closure matters.
      //
      // Declining here is therefore faithful on BOTH surfaces at once: it retires three
      // measured cardinal false positives AND stops the region swallowing the headings
      // below. The uniformity is load-bearing — when only the cell half declined, the
      // leftover mismatched fence opened a PLAIN region instead and swallowed them anyway.
      if (hasCloserBelow(closerIndex, i + 1, candidate)) {
        open = candidate;
        consecutiveBody = 0;
        paragraphOpen = false;
        inPipeTable = false;
        quoteOpen = false;
        continue;
      }
      // Otherwise the line is ordinary body — the pre-S178 behaviour, unchanged.
    }

    // A blank line breaks paragraph continuity — a setext underline cannot
    // follow one (it becomes a thematic break instead, confirmed against the
    // real Quarto CLI). Still recorded as body, matching existing behavior.
    if (BLANK_LINE.test(line)) {
      bodyLines.push({ line: i, text: line });
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = false;
      // A blank line ends a CommonMark type-6 or type-7 raw HTML block — and ONLY those two
      // types, which is why the state names its end condition rather than being a boolean
      // (Session 204).
      if (commonmarkHtmlBlock === "blank") {
        commonmarkHtmlBlock = null;
      }
      continue;
    }

    // A setext underline (`===`/`---`-only line) immediately following exactly
    // one fresh paragraph line converts THAT line into a heading — see
    // `SETEXT_H1`'s docstring for the disambiguation rule, and
    // `setextUnderlineLevel`'s for the column rule that decides whether these bytes
    // are an underline HERE at all. A run at a column no open block starts at is
    // ordinary paragraph text, so it falls through to the body handling below —
    // which is what pandoc does with it (measured: the title and the run render as
    // one `<p>`, so the paragraph stays OPEN across it).
    // Under a CommonMark-family reader the underline may not be a LAZY CONTINUATION of the
    // enclosing block, so a run shallower than the INNERMOST open content column is ordinary
    // paragraph text there — where pandoc's own `markdown` reader accepts the whole stack.
    // See `setextUnderlineLevel` for the 384-document grid, and `FRONTMATTER_COMMONMARK_FROM`
    // for why this cannot reuse `dialectOverride`.
    //
    // ⚠ **A DECLINED run does not simply vanish — it falls through to the body handling, where
    // `CLOSES_PARAGRAPH` treats an `=` run as CLOSING the paragraph, so an ATX heading written
    // directly below it IS reported.** Declining can therefore fabricate a DIFFERENT heading
    // rather than merely lose one, which a corpus with nothing below the underline cannot see.
    // Measured on purpose (`scratchpad/s202/cp`, 30 documents, each with an `atx` probe and a
    // `bare` control): under a CommonMark reader quarto renders that ATX heading at every one
    // of the five sampled columns, because CommonMark lets an ATX heading interrupt a
    // paragraph — so the new decline agrees there, 20 rows of 20. The 3 residual phantoms in
    // that corpus are all `from: markdown` rows, unchanged by this change, and are Session
    // 180's already-filed `CLOSES_PARAGRAPH` entry.
    let innermostColumn = 0;
    for (let c = columnsAboveThisLine - 1; c >= 0; c--) {
      if (columnIsCommonmark[c]) {
        innermostColumn = contentColumns[c];
        break;
      }
    }
    // HOW MANY body lines this underline may claim as its TITLE — 0 meaning "not a title here".
    // Quarto's default reader admits exactly ONE; a CommonMark reader admits the WHOLE open
    // paragraph (Session 203).
    const defaultTitleLineCount = consecutiveBody === 1 ? 1 : 0;
    const wholeParagraph =
      commonmarkDialect && !bodyRunOpensNonParagraph ? consecutiveBody : defaultTitleLineCount;
    // Every line the join would swallow BELOW the first has to be an ordinary continuation:
    // a construct that interrupts the paragraph ends the title above it, and stitching across
    // one fabricates a heading out of two different blocks — see
    // `COMMONMARK_PARAGRAPH_INTERRUPT`, whose default is the inverse of `OPENS_FRESH_BLOCK`'s.
    const titleLineCount =
      wholeParagraph > 1 &&
      bodyLines
        .slice(-wholeParagraph)
        .slice(1)
        .some((l) => commonmarkParagraphInterrupt(l.text, [0, ...contentColumns]))
        ? defaultTitleLineCount
        : wholeParagraph;
    // ⚠ The HTML-block guard is needed at BOTH heading sites, and this is not the half Session
    // 203 closed. `prevOpenedHtmlBlock` stops a MULTI-LINE title being JOINED across an opener;
    // this stops a title that lies wholly INSIDE the block from being claimed at all
    // (`scratchpad/s204/gnd` — `g_gfm_div_d1_setext`, and the `pre` rows, where the block
    // reaches past a blank line).
    const setextLevel =
      titleLineCount >= 1 && commonmarkHtmlBlock === null
        ? setextUnderlineLevel(
            line,
            commonmarkDialect
              ? COMMONMARK_INDENT_OFFSETS.map((o) => innermostColumn + o)
              : [0, ...contentColumns],
          )
        : null;
    if (setextLevel !== null) {
      const titleLines = bodyLines.slice(-titleLineCount);
      const prev = titleLines[0];
      // A bullet marker on the title line is STRIPPED, not a reason to decline the heading
      // (Session 201) — see `setextTitleText`. `buildHeading` already drops a title with nothing
      // displayable left, so a marker-only line still produces no heading.
      //
      // ⚠ The columns handed over are the SAME array the underline test above reads, and the
      // title's OWN marker has already pushed its content column by the time we get here (the
      // container block runs at the top of every iteration). That is harmless for the one
      // question asked of them — a pushed column is strictly DEEPER than the marker's own indent,
      // so it can never make that indent look like code depth — and the `scratchpad/s201/cd`
      // grid confirms both sides of the boundary rather than leaving it to that argument.
      const heading = parseSetextHeadingLine(
        setextLevel,
        [
          setextTitleText(prev.text, [0, ...contentColumns]),
          ...titleLines.slice(1).map((l) => l.text),
        ]
          // A trailing `\` is a HARD LINE BREAK, which quarto renders as `<br>` rather than as
          // a literal character, so it is not part of the heading's text (measured,
          // `scratchpad/s203/mix` — `m_gfm_hardbs`). The two-space spelling of the same break
          // needs no rule of its own: the trim already removes it.
          //
          // ⚠ **On every line BUT THE LAST**, because a break needs a line below it to break
          // onto — and a single-line title is every title the default reader has, so stripping
          // there would change a reader this session does not touch. Measured on all four
          // corners (`scratchpad/s203/hb`, 10 documents): under `gfm` a trailing `\` SURVIVES
          // on a solo title (`b_gfm_solo` → `h1:Solo Hard Title\`) and on the LAST line of a
          // pair (`b_gfm_pair_last`), and is dropped only between two joined lines
          // (`b_gfm_pair`). An ESCAPED `\\` renders as one literal backslash and is not a
          // break, which this single-character strip reproduces exactly (`b_gfm_double_bs`).
          //
          // ⚠ `b_markdown_solo` renders `h1:Solo Hard Title` where we report the backslash —
          // pandoc's own reader drops a trailing `\` on a solo title where `gfm` keeps it. That
          // divergence is PRE-EXISTING and identical on the pre-session build; it belongs to
          // the default reader, which this row does not touch, and is filed rather than fixed.
          .map((t, k, all) => {
            const trimmed = t.trim();
            // ⚠ …and NOT when the line left a CODE SPAN open, where a `\` is ordinary content
            // (measured under all three CommonMark readers, `scratchpad/s203/ext` — the
            // `codespan` row; found by a blind lens, `adv/text` — `text_06`). An ODD number of
            // backticks is a labelled HEURISTIC for "opened a span it did not close": exact for
            // the measured shape, approximate for a doubled `` `` `` delimiter, and its failure
            // direction is to KEEP a backslash — a text divergence in a rare shape rather than
            // a heading gained or lost.
            const opensCodeSpan = (trimmed.match(/`/g)?.length ?? 0) % 2 === 1;
            return k === all.length - 1 || opensCodeSpan
              ? trimmed
              : trimmed.replace(/\\$/, "").trim();
          })
          .join(" "),
        prev.line,
      );
      if (heading) {
        headings.push(heading);
      }
      bodyLines.push({ line: i, text: line });
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = false;
      continue;
    }

    // A live content line (prose or a heading) — outside every skip-region.
    bodyLines.push({ line: i, text: line });

    // An ATX heading — but only where no paragraph is open above it, and never inside a raw
    // HTML block under a CommonMark reader, where the block swallows it (Session 204).
    const m =
      commonmarkHtmlBlock !== null || (paragraphOpen && !dialectOverride)
        ? null
        : atxHeadingMatch(
            line,
            // A block quote suspends the rule entirely; a `from:` key relaxes it to
            // CommonMark's own tolerance. Both still offer every open container column.
            quoteOpen
              ? null
              : dialectOverride
                ? [...COMMONMARK_HEADING_COLUMNS, ...contentColumns]
                : [0, ...contentColumns],
          );
    if (m) {
      const heading = parseHeadingLine(m, i);
      if (heading) {
        headings.push(heading);
      }
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = false;
      prevWasAtxHeading = true;
    } else {
      // A block line makes the line BELOW it a paragraph start; it does NOT reset the
      // counter at itself, because an underline directly below a block line still claims
      // that line (see `opensFreshBlock`). Hence the one-line deferral through
      // `pendingFreshBlock` rather than a reset here.
      //
      // The exception is an indented code RUN: a LONE indented line under an underline is
      // a setext title, but the second and later lines of a run are firmly code and can
      // never be one — `    a` / `    b` / `===` renders no heading (measured), while
      // `    a` / `===` renders `<h1>a</h1>`.
      //
      // ⚠ This is the ONE consumer of `indentedCodeLine` that is NOT behind a `paragraphOpen`
      // bail, and it is the one whose polarity RECOVERS headings (Session 193). Before the
      // column, a title sitting at its container's own content column was read as the second
      // line of a code run whenever the line above it was genuinely code, so it could never be
      // a setext title — `-   line one` / … / `        zzz` / `    Some Title` / `    ===`
      // renders `<h1>Some Title</h1>` and this model produced nothing. 86 such losses in a
      // 392-document sweep. The columns are computed first for that reason.
      //
      // The columns a raw-TeX block or an indented code block may start at on THIS line: the
      // document root's own 0 plus every open container's. `null` while a block quote may be
      // open — see `quoteOpen`.
      const rawTexColumns = quoteOpen ? null : [0, ...contentColumns];
      const indented = indentedCodeLine(line, rawTexColumns);
      const insideIndentedCode = indented && prevIndentedCode;
      consecutiveBody = pendingFreshBlock && !insideIndentedCode ? 1 : consecutiveBody + 1;
      if (consecutiveBody === 1) {
        // The run STARTS here, so this line decides whether it is a paragraph at all — see
        // `bodyRunOpensNonParagraph` and `COMMONMARK_RUN_OPENS_BLOCK`.
        //
        // ⚠ …and so does the line ABOVE it, for the ONE construct that makes the next line a
        // fresh block without being one itself: an HTML-block opener. Under pandoc's own
        // reader `<div>` / `Title` / `===` really does render a heading (Session 187, and that
        // is why `HTML_BLOCK_OPEN` sits ahead of the `paragraphOpen` bail in `opensFreshBlock`
        // above); under a CommonMark reader the block runs to the next BLANK line and swallows
        // all three. Two readers, two rules — the same shape as the column rule, in a third
        // place. Measured: `scratchpad/s203/first` — `f_gfm_html`.
        bodyRunOpensNonParagraph =
          indented || COMMONMARK_RUN_OPENS_BLOCK.test(line) || prevOpenedHtmlBlock;
      }
      // Read `paragraphOpen` for the line ABOVE before overwriting it for this one —
      // whether these bytes open a block or merely continue a paragraph depends on it.
      pendingFreshBlock = opensFreshBlock(line, paragraphOpen, rawTexColumns);
      prevOpenedHtmlBlock = HTML_BLOCK_OPEN.test(line);
      // Does THIS line open a raw HTML block the reader will swallow? Only under a
      // CommonMark-family reader — pandoc's own reader parses markdown inside such a block
      // (`markdown_in_html_blocks` / `native_divs`) and really does render the heading there,
      // measured over the whole `md`/`nofrom` half of `scratchpad/s204/gnd` (Session 204).
      // ⚠ `paragraphOpen` here is still the line ABOVE's — it is overwritten further down — which
      // is exactly the state type 7 needs: a complete tag may open a block only where no
      // paragraph is already open, while a type-6 name interrupts one freely.
      if (commonmarkDialect && commonmarkHtmlBlock === null) {
        // Type 1 is tested FIRST because `<pre>` satisfies type 7's grammar too, and the two
        // disagree about the end condition — which is the only thing that separates them.
        commonmarkHtmlBlock = COMMONMARK_HTML_TYPE1_OPEN.test(line)
          ? "type1"
          : COMMONMARK_HTML_TYPE6_OPEN.test(line) ||
              (!paragraphOpen && COMMONMARK_HTML_TYPE7_OPEN.test(line))
            ? "blank"
            : null;
      }
      // The closer is tested on the OPENING line too, so a one-line `<pre>x</pre>` opens and
      // closes where it stands. The line carrying the closer is INSIDE the block; the line
      // below it is not (measured — `e_gfm_pre_after` renders its heading).
      if (commonmarkHtmlBlock === "type1" && COMMONMARK_HTML_TYPE1_CLOSE.test(line)) {
        commonmarkHtmlBlock = null;
      }
      prevIndentedCode = indented;
      // A paragraph's "quotedness" is decided by the line that STARTS it, so it is computed
      // only when no paragraph is open — see `closesParagraph`. Reading it here, before
      // `paragraphOpen` is overwritten below, is what makes "the line that starts it" true.
      if (!paragraphOpen) {
        paragraphQuoted = BLOCK_QUOTE_MARKER.test(line);
      }
      // `paragraphOpen` is read for the line ABOVE before being overwritten for this one.
      // Annotated for the same TS7022 reason as `lineBlockAbove` above — this snapshot feeds
      // the `lineBlockOpen` assignment, which `closesParagraph` reads back on the next line.
      const wasParagraphOpen: boolean = paragraphOpen;
      paragraphOpen = !closesParagraph(
        line,
        paragraphOpen,
        prevLineWasAtxHeading,
        paragraphQuoted,
        lineBlockAbove,
        rawTexColumns,
      );
      // A line block stays open across its own continuations, so the arm re-arms on one; but
      // it can only be OPENED where no paragraph already is. Measured: a line block does not
      // interrupt a paragraph, with or without a continuation, so arming against an open one
      // would close a paragraph quarto keeps open and fabricate the heading below it.
      if (TABLE_RULE_ROW.test(line)) {
        inPipeTable = true;
      }
      lineBlockOpen =
        !inPipeTable &&
        ((lineBlockAbove && LINE_BLOCK_CONTINUATION.test(line)) ||
          (!wasParagraphOpen && LINE_BLOCK_LINE.test(line)));
    }
  }

  // CommonMark: an unclosed fence runs to end of document — its last line IS
  // body. Keep such a cell runnable (e.g. while still being typed).
  if (open !== null && open.isCell) {
    cells.push(makeCell(open, lines.length - 1, lines, false));
  }

  return { headings, cells, bodyLines, frontMatter };
}

/**
 * Find every ATX heading in `text`, in document order. Returns a fresh array
 * each call (a shallow copy of the memoized scan's headings — see `scanRegions`),
 * so a caller may reorder/add/remove entries without affecting a later call; the
 * `Heading` elements themselves are shared and immutable (do not mutate a field).
 */
export function findHeadings(text: string): Heading[] {
  return scanRegions(text).headings.slice();
}

/**
 * The leading YAML front-matter block's line span — `{ startLine, endLine }`,
 * both 0-based and inclusive of the `---` fence lines — or `null` if the document
 * has no front matter. `endLine` is the closing `---`/`...` terminator line, or
 * the document's last line if the block is unterminated. A view over the single
 * `scanRegions` pass, so it cannot disagree with the heading/cell/body views on
 * what counts as front matter (Learning #14). The YAML completion provider uses
 * `inFrontMatter` (below) to gate front-matter key suggestions; this raw span is
 * exposed for consumers that need the bounds themselves.
 */
export function findFrontMatter(
  text: string,
): { startLine: number; endLine: number } | null {
  const fm = scanRegions(text).frontMatter;
  return fm === null ? null : { startLine: fm.startLine, endLine: fm.endLine };
}

/**
 * True if 0-based `line` is an interior content line of the document's front
 * matter — strictly between the `---` fences (both fence lines excluded). For an
 * unterminated block (no closing fence) the last line counts as content. The
 * YAML completion provider gates front-matter key suggestions on this (Phase 6d
 * plan §4.3), so it deliberately excludes the fence lines, where no key is typed.
 */
export function inFrontMatter(text: string, line: number): boolean {
  const fm = scanRegions(text).frontMatter;
  if (fm === null || line <= fm.startLine) {
    return false;
  }
  return fm.terminated ? line < fm.endLine : line <= fm.endLine;
}

/**
 * The interior content lines of the document's front matter (the `---` fence
 * lines excluded), or `null` if there is no front matter. For an unterminated
 * block the last line is content (there is no closing fence). The citation
 * front-matter reader (`core/frontmatter`) consumes this so the project has a
 * single front-matter scanner (Learning #14), not a second `---` parser.
 */
export function frontMatterContentLines(text: string): string[] | null {
  const fm = scanRegions(text).frontMatter;
  if (fm === null) {
    return null;
  }
  const lines = text.split(/\r?\n/);
  const end = fm.terminated ? fm.endLine : fm.endLine + 1;
  return lines.slice(fm.startLine + 1, end);
}

/**
 * Find every executable `{lang}` code cell in `text`, in document order. Returns
 * a fresh array each call (a shallow copy of the memoized scan's cells — see
 * `scanRegions`), so a caller may reorder/add/remove entries without affecting a
 * later call; the `Cell` elements themselves are shared and immutable (do not
 * mutate a field). `findCellAtPosition`/`findCellOptionLines` return elements
 * from this same shared set, so the same don't-mutate contract applies to them.
 */
export function findAllCells(text: string): Cell[] {
  return scanRegions(text).cells.slice();
}

/**
 * Quarto's OWN language → comment-character table (`kLangCommentChars`), transcribed from the
 * installed 1.7.33 (`share/editor/tools/yaml/web-worker.js`; the identical table also drives
 * `share/filters/modules/constants.lua`). A one-element entry is a line comment; a two-element
 * entry is a BLOCK comment whose closer must also terminate the directive line (see
 * `commentCharsFor`). Facts about another tool's syntax, not expression — the same
 * license-clean basis as the curated schema names (Learning #25).
 *
 * These are the 46 entries of quarto's STATIC literal. Its EFFECTIVE table has 47: at startup
 * quarto overlays the resource `handlers/lang-comment-chars.yml`
 * (`share/editor/tools/yaml/yaml-intelligence-resources.json`), whose only addition is
 * `mermaid: "%%"`. That row is still deliberately NOT copied here, but the REASON changed in
 * S162 and the blocker is gone. `mermaid` and `dot` are quarto's two cell-HANDLER languages
 * (`handlers/languages.yml` is exactly `["mermaid","dot"]`), and quarto validates a handler
 * cell against `handlers/<lang>/schema.yml` instead of the cell-option schema — so no `cell-*`
 * field reaches either, and in a markdown- or jupyter-engine document every cell option we
 * validate renders exit 0 there. (Quarto does enforce mermaid's own `mermaid-format` and
 * `theme` through that handler schema; neither is a member of `cellOptions()`, so neither is
 * reachable from here. A KNITR document additionally runs knitr's own chunk machinery over a
 * handler cell, which is not schema-driven — see `cellOptionScopeFor`'s docstring for the one
 * key that costs us and why the trade is deliberate.) Before S162 that was a live
 * false positive in `{dot}` — whose `//` row IS present, so its options were enumerated and
 * flagged on a document quarto accepts — and adding `mermaid` would have created a second one.
 * S162 fixed it at its real root: `cellOptionScopeFor` returns the `"none"` scope for a handler
 * language (`isCellHandlerLanguage`, `yaml-context.ts`), so nothing in either cell is validated
 * no matter which lines are emitted here. Adding the `mermaid` row is therefore now SAFE for
 * diagnostics; it is left out only because it changes what the enumerator EMITS. For these two
 * languages that means cell-option COMPLETION — the embedded virtual-doc builders bail on an
 * unmapped `cellLanguageId` before consulting option lines, and neither `core/refs.ts` nor
 * `core/cell-background.ts` calls this enumerator at all. A separate deliverable with its own
 * grounding, tracked in BACKLOG.
 *
 * Lookup is CASE-SENSITIVE and unknown languages fall back to `#`, both grounded firsthand
 * vs 1.7.33: `{SQL}` + `--| echo: banana` renders exit 0 while `{SQL}` + `#| echo: banana`
 * renders exit 1, and `{banana}` behaves the same way — quarto does not lowercase the fence
 * token before the lookup, so `{SQL}` is simply an unknown language taking the default.
 *
 * Two rows — `d3` and `fortran95` — are unreachable, in quarto AND now here: quarto's
 * cell-fence recognizer captures the language as `([=A-Za-z]+)`, so a token containing a
 * DIGIT is never a cell at all and its options are never validated (`{fortran}` +
 * `!| echo: banana` renders exit 1, `{fortran95}` renders exit 0).
 *
 * ✅ **CLOSED, Session 172.** This paragraph used to end "Our `CELL_INFO` does admit digits,
 * so such a cell is flagged … likewise filed." It no longer does: `CELL_INFO` is now quarto's
 * grammar, so a digit-bearing token builds no cell and never reaches this table. The two rows
 * stay in the table deliberately — they are dead by quarto's grammar, not by ours, so deleting
 * them would silently re-couple this table to a decision made one regex away. They are also the
 * ONLY two of the 46 rows containing a character outside `[A-Za-z]`; every other row is
 * reachable exactly as before.
 */
const LANG_COMMENT_CHARS: Readonly<Record<string, readonly [string] | readonly [string, string]>> = {
  r: ["#"], python: ["#"], julia: ["#"], scala: ["//"], matlab: ["%"], csharp: ["//"],
  fsharp: ["//"], c: ["/*", "*/"], css: ["/*", "*/"], sas: ["*", ";"], powershell: ["#"],
  bash: ["#"], sql: ["--"], mysql: ["--"], psql: ["--"], lua: ["--"], cpp: ["//"], cc: ["//"],
  stan: ["#"], octave: ["#"], fortran: ["!"], fortran95: ["!"], awk: ["#"], gawk: ["#"],
  stata: ["*"], java: ["//"], groovy: ["//"], sed: ["#"], perl: ["#"], prql: ["#"], ruby: ["#"],
  tikz: ["%"], js: ["//"], d3: ["//"], node: ["//"], sass: ["//"], scss: ["//"], coffee: ["#"],
  go: ["//"], asy: ["//"], haskell: ["--"], dot: ["//"], ojs: ["//"], apl: ["⍝"],
  ocaml: ["(*", "*)"], rust: ["//"],
};

/** The comment delimiters quarto reads cell-option directives with, for one cell language. */
interface CommentChars {
  /** The opener the directive pattern is built from — quarto's `commentChars[0]`. */
  open: string;
  /**
   * The closer a directive line must ALSO end with, for a block-comment language — quarto's
   * `commentChars[1]`, `null` for a line-comment language. Quarto tests
   * `line.trimEnd().endsWith(suffix)` and strips the suffix from the YAML content; a matching
   * line WITHOUT it is not a directive at all and therefore ENDS the option block.
   */
  close: string | null;
}

/**
 * The comment delimiters for cell language `lang`. OWN properties only — `lang` comes
 * straight out of a ```` ```{...} ```` fence and is user input, so a bare index walks the
 * prototype chain (the `cellLanguageId("constructor")` defect, `embedded/lang-map.ts`).
 */
function commentCharsFor(lang: string): CommentChars {
  const entry = Object.prototype.hasOwnProperty.call(LANG_COMMENT_CHARS, lang)
    ? LANG_COMMENT_CHARS[lang]
    : undefined;
  return entry === undefined
    ? { open: "#", close: null }
    : { open: entry[0], close: entry[1] ?? null };
}

/** Escape a literal so it can be embedded in a `RegExp` — quarto's own `escapeRegExp`. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A cell-option line for ONE cell language, matching Quarto's own directive pattern
 * `^<comment>\s*\| ?`: the language's comment opener at COLUMN 0 — no leading indentation,
 * since Quarto treats an indented directive as ordinary code — then optional whitespace, the
 * pipe, an optional gap, and the option `key[: value]`. Group 1 is the comment opener, 2 the
 * whitespace between it and the pipe, 3 the gap before the key, 4 the remainder. Anchored at
 * `^` so column math is exact.
 *
 * The comment char is per-LANGUAGE, not the fixed `#`/`//` pair this used to hard-code:
 * quarto builds the pattern from `kLangCommentChars[lang]`, so both directions were wrong
 * for every other language — `{sql}` + `--| echo: banana` renders exit 1 with a real
 * `Field "echo" has value banana` and we emitted NOTHING (a lost true positive), while
 * `{sql}` + `#| echo: banana` renders exit 0 and we emitted it for value-diagnostics to
 * squiggle (the cardinal sin). Both grounded firsthand vs 1.7.33 across the table's nine
 * distinct openers (S161).
 */
function cellOptionPrefixFor({ open }: CommentChars): RegExp {
  return new RegExp("^(" + escapeRegExp(open) + ")([ \\t]*)\\|([ \\t]*)(.*)$");
}

/**
 * Quarto's OWN directive predicate — `^<comment>\s*\| ?` — and nothing more: a PREFIX test,
 * with `\s` (all whitespace) rather than `[ \t]`, and no end anchor. For a block-comment
 * language the caller must ALSO apply the `close` suffix test (`isCellOptionDirective`).
 *
 * `cellOptionPrefixFor` above is deliberately stricter, because it must also SLICE the line
 * into key and value spans. Two divergences follow from that: its gap is `[ \t]`, so an
 * exotic-but-legal whitespace (NBSP, vertical tab) between the comment char and the pipe is
 * rejected; and it ends `(.*)$`, where `.` excludes U+2028/U+2029, so a line separator
 * anywhere in the content is rejected. Quarto accepts all three (grounded firsthand vs
 * 1.7.33: each renders exit 1 with a real `Field "echo" has value banana` VALUE error).
 *
 * That strictness is harmless for EMISSION — an unparseable directive line is simply not
 * reported, a one-line false negative. It is NOT harmless for TERMINATION: since a
 * non-directive line ends the cell's whole option block, using the strict pattern there
 * would let one exotic character silently discard every real option BELOW it. So the two
 * roles are split — this permissive pattern decides where the block ENDS, and the strict
 * one above decides what gets EMITTED (§9 review, S160; found against that session's own
 * change, adjudicated firsthand).
 */
function cellOptionDirectiveFor({ open }: CommentChars): RegExp {
  return new RegExp("^(?:" + escapeRegExp(open) + ")\\s*\\|");
}

/**
 * Whether quarto reads `lineText` as a cell-option directive — the permissive pattern PLUS,
 * for a block-comment language, the closing suffix quarto requires
 * (`line.trimEnd().endsWith(optionSuffix)`). Grounded firsthand vs 1.7.33: in a `{c}` cell an
 * `echo: banana` directive CLOSED by the block-comment terminator renders exit 1 with a real
 * value error, while the same line left UNCLOSED renders exit 0 — and an unclosed line
 * mid-block ends the block, exactly like any other non-directive line (S161).
 */
function isCellOptionDirective(lineText: string, directive: RegExp, close: string | null): boolean {
  return directive.test(lineText) && (close === null || lineText.trimEnd().endsWith(close));
}

/**
 * The YAML content quarto folds out of a directive line's remainder — `m[4]` for a
 * line-comment language, and for a BLOCK-comment language the same with the closing suffix
 * (and the whitespace on either side of it) removed, mirroring quarto's own
 * `yamlOption.trimEnd().substring(0, len - suffix.length).trimEnd()`. `null` when the
 * language needs a suffix the line does not carry, which makes the line a non-directive.
 *
 * Only ever SHORTENS the remainder from the END, so every column derived from `keyStart`
 * stays exact, and for a line-comment language it is `m[4]` untouched — no behaviour change
 * on the `#`/`//` languages this function did not use to reach.
 */
function directiveContent(remainder: string, close: string | null): string | null {
  if (close === null) {
    return remainder;
  }
  const trimmed = remainder.trimEnd();
  if (!trimmed.endsWith(close)) {
    return null;
  }
  return trimmed.slice(0, trimmed.length - close.length).trimEnd();
}

/**
 * A YAML block-scalar header appearing as a cell-option VALUE: `|` (literal) or `>` (folded),
 * an optional indentation indicator (`1`–`9`) and/or chomping indicator (`+`/`-`) in either
 * order, then only optional whitespace and an optional `#` comment before end of line. A
 * leading `|`/`>` in a YAML value is ALWAYS a block-scalar indicator (never a plain scalar), so
 * the end-of-content anchor only additionally rejects a MALFORMED header (`| foo`), which quarto
 * errors on regardless — a value matching this arms a block-scalar continuation-skip in
 * `findCellOptionLines`, folding its more-indented `#|` continuation lines into the value.
 */
const BLOCK_SCALAR_HEADER = /^[|>](?:[1-9][-+]?|[-+][1-9]?)?[ \t]*(?:#.*)?$/;

/**
 * Every `#|` / `//|` cell-option line inside an executable cell, in document
 * order. A view over the shared scanner (`findAllCells`) — never a second scanner
 * (Learning #14): only interior lines of executable `{lang}` cells are examined,
 * so a `#|` in prose, in a non-executable ```` ```python ```` block, or on a
 * fence line is never reported. The owning cell supplies the absolute line and
 * engine.
 *
 * Only the cell's LEADING option block is reported: quarto reads a cell's directives
 * from the leading contiguous run of `#|` lines and stops at the first body line that
 * is not one, so a `#|` line below that point is an ordinary comment (S160 — see the
 * block-terminating `break` below).
 */
export function findCellOptionLines(text: string): CellOptionLine[] {
  const result: CellOptionLine[] = [];
  for (const cell of findAllCells(text)) {
    const bodyLines = cell.code.length === 0 ? [] : cell.code.split("\n");
    // Track an unclosed multi-line value across the cell's `#|` lines: quarto folds
    // every `#|` line into ONE YAML block, so the continuation of a multi-line quoted
    // scalar / flow collection is INSIDE the prior option's value, NOT a new option.
    // Emitting it would let value-diagnostics flag e.g. `#| fig-height: wide"` inside a
    // multi-line `#| fig-cap: "…"` — a cardinal-sin false positive on a doc quarto renders
    // exit 0 (adversarial review, S130). A non-`#|` (code) line ends the option block.
    let flowDepth = 0;
    let openQuote: '"' | "'" | null = null;
    // An open block scalar (`|`/`>`), tracked by the folded-indent of the KEY that opened it:
    // quarto folds every MORE-indented `#|` line into the block's literal content, so a
    // following mapping-looking line is that literal text, NOT a new option. Emitting it would
    // let value-diagnostics flag e.g. `#| fig-cap: |` / `#|   echo: banana` — a cardinal-sin FP
    // on a doc quarto renders exit 0 (adversarial review, S154/S155; fixed S158). Separate from
    // the quote/flow state above: a value opens EITHER a quote/flow OR a block scalar (disjoint
    // first chars `"'[{` vs `|>`), never both. Null when no block scalar is open.
    let blockScalarIndent: number | null = null;
    // The comment delimiters quarto reads THIS cell's directives with, resolved from its
    // language (S161). Built once per cell rather than per line, and never cached across
    // cells: the table is keyed by a fence token that is user input, so a process-lifetime
    // cache would grow with the distinct tokens a document happens to contain.
    const comment = commentCharsFor(cell.lang);
    const prefixRe = cellOptionPrefixFor(comment);
    const directiveRe = cellOptionDirectiveFor(comment);
    for (let j = 0; j < bodyLines.length; j++) {
      const lineText = bodyLines[j];
      const m = prefixRe.exec(lineText);
      // For a block-comment language the closing suffix is part of the directive: a line
      // lacking it is not a directive at all, so `content` is `null` and the block ends here.
      const content = m === null ? null : directiveContent(m[4], comment.close);
      if (m === null || content === null) {
        if (isCellOptionDirective(lineText, directiveRe, comment.close)) {
          // A line quarto reads as a directive but that the strict prefix pattern cannot
          // slice (an NBSP/vertical-tab gap, or a U+2028 in the content). It is part of
          // quarto's YAML block, so it must NOT end the block — skip the LINE and keep
          // scanning, the same one-line false negative the pre-S160 code had. Terminating
          // here instead would discard every real option below it (§9 review, S160).
          continue;
        }
        // END OF THE CELL'S OPTION BLOCK — not merely a reset of the continuation state.
        // Quarto reads a cell's `#|` directives from the LEADING contiguous run of directive
        // lines and stops at the first body line that is not one; everything below is ordinary
        // code, so a `#|` there is just a comment. Emitting it let value-diagnostics squiggle
        // a document quarto ACCEPTS — the cardinal sin. Grounded firsthand vs quarto 1.7.33
        // (`--no-execute`, 35 documents, S160): `1+1` / `#| echo: banana` renders exit 0, as do
        // the other three terminator shapes — a BLANK line, a whitespace-only line, and a plain
        // `# comment` — each of which likewise renders exit 0 for a following invalid option, on
        // both the `#` (python/r) and `//` (ojs) comment-char families. Testing the DIRECTIVE
        // PATTERN rather than "is this code" is what makes the terminator set exactly quarto's:
        // a bare `#|`, a `#| ` with empty content, a gapless `#|key:`, and a spaced `# | key:`
        // all match, and all were grounded as NON-terminators (quarto still reports their block's
        // value errors, exit 1). Continuation lines of an open quoted/flow/block-scalar value are
        // `#|` lines too, so they never terminate — the guards below still own that folding.
        break;
      }
      // The indentation quarto sees for this `#|` line's folded content: the post-pipe
      // whitespace `m[3]` minus the ONE space quarto's `^#\s*\| ?` directive strips.
      const foldedIndent = m[3].startsWith(" ") ? m[3].length - 1 : m[3].length;
      if (blockScalarIndent !== null) {
        // Inside an open block scalar: a blank `#|` line (always part of the block) and any line
        // MORE indented than the opening key are the block's literal content — skip them. The
        // first non-blank line at or BELOW the opener's indent ENDS the block and is a real
        // option again (fall through). Strictly-greater is quarto-faithful for a RENDERABLE doc: a
        // sibling at the SAME folded-indent renders exit 1, a real option (grounded firsthand,
        // S158). The boundary is the KEY's indent, not YAML's auto-detected CONTENT indent, so a
        // `#|` line mis-indented BETWEEN the key and the content (key < foldedIndent < content) is
        // also skipped — but that band exists ONLY on a doc quarto already rejects with a
        // structural `YAMLException: bad indentation` (exit 1, never a value error), so over-
        // skipping there is the safe false-negative direction, not a lost value TP (§9 over-
        // suppression lens, S158).
        if (content.trim() === "" || foldedIndent > blockScalarIndent) {
          continue;
        }
        blockScalarIndent = null;
      }
      if (flowDepth > 0 || openQuote !== null) {
        // A continuation of a multi-line quoted/flow value on a prior `#|` line — skip it.
        const s = scanFlow(content, flowDepth, openQuote);
        flowDepth = Math.max(0, s.depth);
        openQuote = s.quote;
        continue;
      }
      // keyStart = comment chars + inter-pipe ws + the `|` + the gap before the key.
      const keyStart = m[1].length + m[2].length + 1 + m[3].length;
      const { keySlot, valueSlot } = slotsOf(content, keyStart);
      result.push({
        line: cell.startLine + 1 + j,
        cellStartLine: cell.startLine,
        cellLang: cell.lang,
        prefix: m[1] + "|",
        contentEndCol: keyStart + content.length,
        keySlot,
        valueSlot,
      });
      // Arm the continuation-skip only if THIS option's VALUE actually OPENS an unclosed
      // quoted scalar / flow collection (or a `|`/`>` block scalar — the `else if` below),
      // decided by the value token's FIRST character past a
      // stripped node property (`&anchor `/`!tag `) — mirroring the two `.qmd` front-matter
      // value enumerators (`yaml-frontmatter-values.ts`/`-nested-values.ts`) and the
      // `_quarto.yml` reference (`project-yaml.ts` findProjectConfigValueLines). Deliberately
      // NOT a `scanFlow` over the whole `m[4]`: that scan treats an inner quote/bracket in a
      // PLAIN value as an opener and arms a phantom quote — `#| fig-cap: Don't do this`
      // (quarto exit 0) armed a `'` whose guard then swallowed a following `#| echo: banana`
      // that quarto REJECTS (exit 1), silently dropping its validation (Defect A / the
      // phantom-quote FALSE NEGATIVE, S154; PROJECT_LEARNINGS #166 — the third and last site
      // of this defect class). A value that folds a following `#|` mapping line into itself
      // MUST start with a quote or flow bracket (a plain scalar ends at its line; a
      // continuation must be more-indented), so the first-char gate is COMPLETE and strictly
      // more correct — an anchored/tagged opener `&a { … ` still arms because the node
      // property is stripped BEFORE the first-char test (its brackets are then counted by the
      // scan). `m[4]` is `key: value` (or a `- ` sequence item), so the value is the text
      // after the first colon, else the line content past a leading `- `.
      const armColon = content.indexOf(":");
      const armToken =
        armColon < 0
          ? content.replace(/^-[ \t]*/, "").trimEnd()
          : content.slice(armColon + 1).replace(/^[ \t]+/, "").trimEnd();
      // Strip a leading node property before the first-char test. The name charset excludes
      // ONLY the YAML c-flow-indicators `,[]{}` (the chars an anchor/tag NAME may not contain),
      // so two things hold: (1) the strip stops at — and thus SEES — an opener that ABUTS the
      // anchor/tag with no space (`&a[one,`/`&a{one:`, which js-yaml/quarto accept and fold:
      // fig-cap takes a list, so `#| fig-cap: &a[one,` renders exit 0 — flagging its folded
      // continuation would be a cardinal-sin FP the whole-token arm avoided; §9 branch-
      // interaction lens, S154); and (2) a QUOTE, being a LEGAL anchor-name char, is KEPT in
      // the name and NOT read as an opener — `#| myopt: &a'b` (a node named `a'b`, null value)
      // quarto ACCEPTS (exit 0), so mis-reading `'b` as a quote opener would phantom-fold a
      // following real option and drop its validation (`#| echo: banana` is then the SOLE
      // error quarto reports, exit 1 — a lost TRUE POSITIVE). The earlier `[^\s[\]{}"']` form
      // over-excluded quotes; corrected to the YAML-exact `[^\s,[\]{}]` to match the three
      // front-matter/project VALUE enumerators (S155 §9 over-suppression correction,
      // PROJECT_LEARNINGS #168). The trailing ws is optional so `&a [one,` and `&a[one,` both
      // strip to `[one,`. This is the SINGLE-LINE arm decision. The SIBLING multi-line-
      // continuation path (the `scanFlow(m[4], flowDepth, openQuote)` skip at the top of this
      // loop) carried the SAME anchor-name-quote defect — `scanFlow` read a quote inside a node
      // property NAME as a scalar opener, so `#| myopt: [` / `#| one, &a'b` / `#| ]` armed a
      // phantom `'` that swallowed the following `#| echo: banana` (a lost TP: quarto folds the
      // list, exit 0, and flags only echo, exit 1). That is now fixed AT THE ROOT — `scanFlow`
      // skips node-property names (`&`/`*`/`!`, S157) — which also closes the mirror case where
      // the anchor sits MID-flow on a single line (`#| myopt: [one, &a'b]`: the `]` no longer
      // falls inside a phantom quote). So the first-char strip below and `scanFlow` are now BOTH
      // node-property-aware for quotes, on every path (§9 missed-sites lens, S156; fixed S157).
      const stripped = armToken.replace(/^(?:[&!][^\s,[\]{}]*[ \t]*)+/, "");
      const opener = stripped[0];
      if (opener === '"' || opener === "'" || opener === "[" || opener === "{") {
        const s = scanFlow(armToken, 0, null);
        flowDepth = s.depth > 0 ? s.depth : 0;
        openQuote = s.quote;
      } else if (BLOCK_SCALAR_HEADER.test(stripped)) {
        // The value is a `|`/`>` block-scalar header, so its continuation is the block's
        // more-indented literal content: arm the skip at THIS key's folded-indent (the block
        // ends at the first non-blank `#|` line back at or below that indent). `stripped` has
        // any leading node property removed (`&anchor |`), so an anchored block scalar arms too.
        blockScalarIndent = foldedIndent;
      }
    }
  }
  return result;
}

type Slot = { startCol: number; endCol: number };

/**
 * The key and value token spans in `rest` (the text after the prefix+gap,
 * starting at column `keyStart`). The key runs up to the first `:` (trailing
 * whitespace before the colon excluded); the value is everything after the `:`
 * with leading whitespace skipped and trailing whitespace excluded. Both spans
 * are `null` for a block-sequence item (`- value`); the value span is `null`
 * when there is no `:` yet (a bare key still being typed).
 */
function slotsOf(
  rest: string,
  keyStart: number,
): { keySlot: Slot | null; valueSlot: Slot | null } {
  if (/^-(?:\s|$)/.test(rest)) {
    return { keySlot: null, valueSlot: null };
  }
  const colon = rest.indexOf(":");
  const keyText = (colon >= 0 ? rest.slice(0, colon) : rest).replace(/\s+$/, "");
  const keySlot: Slot = { startCol: keyStart, endCol: keyStart + keyText.length };
  if (colon < 0) {
    return { keySlot, valueSlot: null };
  }
  const afterColon = colon + 1;
  const region = rest.slice(afterColon);
  const wsLen = (region.match(/^[ \t]*/) ?? [""])[0].length;
  let valueRaw = region.slice(wsLen);
  // Strip an unquoted trailing YAML inline comment: a `#` begins a comment when
  // it is at the value start or preceded by whitespace. Quoted scalars are left
  // intact (quote-aware parsing is deferred); enum/boolean values never contain
  // quotes or `#`, so this only narrows the span for the commented case.
  if (!/^["']/.test(valueRaw)) {
    const c = valueRaw.startsWith("#") ? 0 : valueRaw.search(/\s#/);
    if (c >= 0) {
      valueRaw = valueRaw.slice(0, c);
    }
  }
  const valueText = valueRaw.replace(/\s+$/, "");
  const valueStart = keyStart + afterColon + wsLen;
  return {
    keySlot,
    valueSlot: { startCol: valueStart, endCol: valueStart + valueText.length },
  };
}

/** The unclosed-value state after scanning a line: net flow-bracket depth + any open quote. */
export interface FlowState {
  depth: number;
  quote: '"' | "'" | null;
}

/**
 * Advance the multi-line-value state across `s`, starting from `startDepth`/`startQuote`,
 * and return the resulting `{depth, quote}`. Tracks BOTH an unclosed FLOW collection
 * (`{…}`/`[…]`, net-counted) and an unterminated single/double-QUOTED scalar, together —
 * because they nest: a bracket inside a quote is literal (not counted), and a quote opened
 * inside a flow persists across lines. A multi-line quoted scalar folds its continuation
 * line into the value even when that continuation sits at COLUMN 0, so the top-level and
 * nested front-matter value enumerators AND `findCellOptionLines` all use this to skip
 * continuation lines — else a continuation like `columns: wide"` (front matter) or a `#|`
 * line `fig-height: wide"` (cell option) is misread as an independent mapping and flagged,
 * a cardinal-sin false positive on a document quarto renders exit 0 (adversarial reviews
 * S125 flow-shapes / S128 nested quoted-scalar / S130 top-level + cell quoted-scalar).
 *
 * A `\`-escaped char inside a double-quoted scalar and a `''` inside a single-quoted one are
 * consumed, so a quoted bracket never miscounts and an embedded quote never closes early. An
 * unquoted `#` (at the start or whitespace-preceded, OUTSIDE any quote) begins a YAML comment:
 * scanning stops there — biasing toward NOT dropping depth on a `}` hidden in a comment (a safe
 * over-skip). A node property (`&anchor`/`*alias`/`!tag`, outside any quote) is skipped whole: its
 * NAME runs to the next whitespace or c-flow-indicator (`,[]{}`) and may legally contain a QUOTE
 * (a valid `ns-anchor-char`), so scanning it char-by-char would misread that quote as opening a
 * scalar (`&a'b` armed a phantom `'` that swallowed a following `#|` option — a lost true positive,
 * S157). Skipping the name leaves depth unchanged (a name holds no brackets — those terminate it)
 * and prevents the spurious open. Over-skipping when ambiguous (a stray brace/quote in a plain
 * scalar) is the safe false-negative direction. Quote-AWARE — NOT a naive bracket-only counter.
 *
 * Lives here (the lowest-level `qmd/model` module) so `findCellOptionLines` can use it
 * without an import cycle through `yaml-context` (which imports this module).
 */
export function scanFlow(s: string, startDepth: number, startQuote: '"' | "'" | null): FlowState {
  let depth = startDepth;
  let quote = startQuote;
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
    if (ch === "&" || ch === "*" || ch === "!") {
      // A YAML node property (anchor `&`, alias `*`, or tag `!`). Its NAME runs to the
      // next whitespace or c-flow-indicator (`,[]{}`) and may legally contain a QUOTE —
      // a quote is a valid `ns-anchor-char`. Skip the whole name so an embedded quote is
      // NOT misread as opening a quoted scalar (`&a'b` inside a flow armed a phantom `'`
      // that swallowed the following `#|` option — a lost true positive, S157). Brackets
      // terminate the name, so depth counting is unchanged; only the spurious quote-open
      // is prevented. Matches the single-line arm's leading node-property strip charset
      // `[^\s,[\]{}]`, extended here to node properties appearing ANYWHERE in the flow.
      let k = i + 1;
      while (k < s.length && !/[\s,[\]{}]/.test(s[k])) k++;
      i = k - 1; // the loop's own `i++` advances to the terminator (or past the end)
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(s[i - 1]))) {
      break; // an unquoted comment — the rest is not structure
    }
    if (ch === "{" || ch === "[") {
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
    }
  }
  return { depth, quote };
}

/**
 * Every live content line — prose and heading lines that are outside YAML front
 * matter, block HTML comments, and code fences. The cross-ref layer scans these
 * for inline `{#fig-…}`/`{#tbl-…}` attribute blocks without re-deriving the
 * skip-regions (the shared-scanner guarantee — see Learning #14). Returns a fresh
 * array each call (a shallow copy of the memoized scan — see `scanRegions`); the
 * `BodyLine` elements are shared and immutable (do not mutate a field).
 */
export function findBodyLines(text: string): BodyLine[] {
  return scanRegions(text).bodyLines.slice();
}

/**
 * Replace inline code spans in a single line with equal-length runs of spaces,
 * so their literal content is not scanned for live markup. Length-preserving, so
 * character offsets/line lengths are unchanged. Shared by the cross-ref index
 * (`core/refs`) and the math detector (`core/math-regions`) — one implementation
 * so the two cannot drift on what counts as a code span (Learning #14).
 */
export function maskInlineCode(line: string): string {
  return line.replace(INLINE_CODE_SPAN, (span) => " ".repeat(span.length));
}

/**
 * `line` as a fence-opener match when it is an INDENTED executable cell — quarto's own
 * `startCodeCellRegEx` shape, which our CommonMark-capped `FENCE_OPEN` declines. Returns
 * `null` for everything else, including an indented PLAIN fence: quarto's plain opener is
 * column-0, so widening that half would be our invention rather than its behaviour.
 *
 * Grounded firsthand vs quarto 1.7.33 (Session 178): a 4-space-, an 8-space- and a
 * TAB-indented ```` ```{r} ```` whose `#|` option sits at column 0 each render **exit 1**
 * on a bad value and **exit 0** on a good one, so quarto really does build and validate
 * the cell. knitr goes further and EXECUTES it — a fully indented cell body prints its
 * result into the rendered document — so an indented fence is a real cell in every
 * machine-relevant sense, not the "indented code" CommonMark would call it.
 */
function indentedCellFenceAt(line: string): RegExpExecArray | null {
  const m = INDENTED_CELL_FENCE_OPEN.exec(line);
  return m !== null && CELL_INFO.test(m[3].trim()) ? m : null;
}

/**
 * True if `line` closes the given open fence (same char, and the right run LENGTH).
 *
 * A CELL uses quarto's unbounded-indent closer, a plain fence CommonMark's 0–3-space one
 * — the same split as the two openers above, and for the same reason: quarto's cell
 * partitioner is indentation-blind while its plain-fence opener is column-0 (S178).
 *
 * ⚠ THE LENGTH RULE IS ALSO SPLIT, AND THE ASYMMETRY IS DELIBERATE (Session 179).
 * CommonMark §4.5 lets a closing fence be LONGER than its opener; quarto's `breakQuartoMd`
 * requires `match(endCodeRegEx)[1].length === inCode`, EXACT equality. Both are correct for
 * their own question — pandoc renders the document, quarto decides what it validates — so a
 * plain fence keeps `>=` and only a CELL takes the exact rule. "Simplifying" the two back
 * into one comparison reintroduces one of the two measured cardinal false positives.
 */
function isCloser(line: string, open: OpenCellFence): boolean {
  const m = open.isCell
    ? CELL_FENCE_CLOSE.exec(line)
    : fenceMatchAt(FENCE_CLOSE, line, open.columns);
  if (m === null || m[2] !== open.char) {
    return false;
  }
  return open.isCell ? m[1].length === open.len : m[1].length >= open.len;
}

/**
 * Every line that could close SOME fence, bucketed by the exact fence it would close.
 *
 * The key is `isCell|char|len` because `isCloser` answers differently along all three axes:
 * a cell accepts unbounded indentation where a plain fence caps it at 3, and a cell needs
 * an exact run length where a plain fence takes any run at least as long. Each bucket is
 * built in ascending line order, so "is there one at or below `from`?" is a binary search.
 *
 * ⚠ THIS EXISTS FOR A MEASURED REASON, NOT AS TIDINESS. Since Session 179 EVERY fence needs
 * the lookahead, not just the rare indented cell Session 178 added it for. Scanning the
 * remaining lines per opener is quadratic, and on a document of 2000 unclosed openers that
 * measured **0.7 ms → 162 ms per scan** — on the editor's debounced hot path. With the index
 * the same document is back to sub-millisecond. Do not "simplify" this back into a loop.
 */
function buildCloserIndex(lines: readonly string[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  const push = (key: string, line: number) => {
    const bucket = index.get(key);
    if (bucket === undefined) {
      index.set(key, [line]);
    } else {
      bucket.push(line);
    }
  };
  for (let i = 0; i < lines.length; i++) {
    // `CELL_FENCE_CLOSE` is the superset — the same run with unbounded indentation — so one
    // match decides both kinds, and `FENCE_CLOSE` only has to re-test the indentation cap.
    const m = CELL_FENCE_CLOSE.exec(lines[i]);
    if (m === null) {
      continue;
    }
    const char = m[2];
    const len = m[1].length;
    // A cell closes on an EXACT run length, so it lands in exactly one bucket.
    push(`c|${char}|${len}`, i);
    // A plain fence closes on any run at least as long, so this line is a candidate closer
    // for every shorter opener too. Fence runs are ≥3 and openers longer than this line's
    // run can never be closed by it, so the loop is bounded by the run's own length.
    //
    // ⚠ THE PLAIN KEY CARRIES THE CLOSER'S COLUMN (Session 200), because whether a run at
    // that column really closes anything depends on the CONTAINER STACK — state this pre-pass
    // does not have and cannot get: it runs once, before the scan, at `computeRegions`'s top.
    // Keying by column lets `hasCloserBelow` ask the exact question later, when the opener's
    // frozen stack IS known, instead of guessing here.
    //
    // ⚠ The obvious cheaper shape — index every run and let `isCloser` reject the bad columns
    // during the scan — is WRONG IN THE HEADING-DELETING DIRECTION, which is why it was not
    // taken. An over-accepting lookahead opens a fence whose only candidate closers sit at
    // code depth; `isCloser` then never fires, the region runs to end of document, and every
    // heading below it is swallowed. Quarto renders those documents as ordinary paragraphs
    // with their headings intact (measured: `scratchpad/s200/ax`, `unt_b4_i04`).
    if (FENCE_CLOSE.test(lines[i])) {
      const col = indentColumn(lines[i]);
      for (let n = 3; n <= len; n++) {
        push(`p|${char}|${n}|${col}`, i);
      }
    }
  }
  return index;
}

/**
 * Whether any line at or below `from` closes `open` — the lookahead every fence now needs,
 * since neither quarto nor pandoc builds a block from an unclosed one (Session 179; Session
 * 178 applied it to indented cells only).
 *
 * The buckets are pre-filtered by exactly the predicate `isCloser` applies, so the two
 * encode the same rule twice and can drift (Learning #14). What holds them together is the
 * table in `test/unit/qmd-model.test.ts` — "a fence that is never CLOSED is not a code
 * block at all (Session 179)", whose rows walk all three axes of the key (char, length,
 * indent) with every row measured against `quarto pandoc -f markdown`.
 */
function hasCloserBelow(index: Map<string, number[]>, from: number, open: OpenCellFence): boolean {
  if (open.isCell) {
    return bucketReaches(index.get(`c|${open.char}|${open.len}`), from);
  }
  // A plain closer is accepted at every column that is not code depth for the OPENER's frozen
  // stack — the same predicate `fenceMatchAt` applies to the line itself, asked here of bare
  // columns because the pre-pass had no line to hand. Beyond `max + 3` every column is code,
  // so the enumeration terminates at the deepest open container rather than at the document's
  // widest line; the set is the union of `[c, c+3]` over the stack and can have holes in it.
  const deepest = Math.max(...open.columns);
  for (let col = 0; col <= deepest + 3; col++) {
    if (columnIsCodeDepth(col, open.columns)) {
      continue;
    }
    if (bucketReaches(index.get(`p|${open.char}|${open.len}|${col}`), from)) {
      return true;
    }
  }
  return false;
}

/** Whether `bucket` holds a line at or below `from` — binary search; buckets are ascending. */
function bucketReaches(bucket: number[] | undefined, from: number): boolean {
  if (bucket === undefined) {
    return false;
  }
  let lo = 0;
  let hi = bucket.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bucket[mid] < from) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo < bucket.length;
}

/**
 * Build a `Cell` from its open fence. When `terminated`, `endLine` is the
 * closing-fence line (excluded from the body); otherwise the cell is
 * unterminated and `endLine` is the document's last line (which IS body).
 */
function makeCell(
  open: OpenCellFence,
  endLine: number,
  lines: string[],
  terminated: boolean,
): Cell {
  const body = terminated
    ? lines.slice(open.startLine + 1, endLine)
    : lines.slice(open.startLine + 1);
  return { startLine: open.startLine, endLine, lang: open.lang, code: body.join("\n") };
}

/**
 * The cell containing 0-based `line`, or `null` if `line` is not inside any
 * cell. The fence lines themselves count as inside the cell, i.e. the test is
 * inclusive of `[startLine, endLine]`.
 */
export function findCellAtPosition(text: string, line: number): Cell | null {
  for (const cell of findAllCells(text)) {
    if (line >= cell.startLine && line <= cell.endLine) {
      return cell;
    }
  }
  return null;
}

/**
 * Build the document outline: headings nested by level, with code cells as leaf
 * symbols under the nearest preceding heading (or at the top level if they
 * precede the first heading). A heading's range spans its whole section — up to
 * the line before the next heading of equal-or-higher level, or end of document.
 */
export function buildOutline(text: string): OutlineSymbol[] {
  const lastLine = Math.max(0, text.split(/\r?\n/).length - 1);
  const { headings, cells } = scanRegions(text);
  const sectionEnds = headings.map((_, k) => sectionEndOf(headings, k, lastLine));

  // One ordered stream of heading and cell events (they never share a line).
  const events: { line: number; node: OutlineSymbol }[] = [
    ...headings.map((h, k) => ({
      line: h.line,
      node: {
        kind: "heading" as const,
        name: h.text,
        level: h.level,
        startLine: h.line,
        endLine: sectionEnds[k],
        selectionLine: h.line,
        children: [],
      },
    })),
    ...cells.map((c) => ({
      line: c.startLine,
      node: {
        kind: "cell" as const,
        name: `\`\`\`{${c.lang}}`,
        lang: c.lang,
        startLine: c.startLine,
        endLine: c.endLine,
        selectionLine: c.startLine,
        children: [],
      },
    })),
  ].sort((a, b) => a.line - b.line);

  const roots: OutlineSymbol[] = [];
  const stack: OutlineSymbol[] = []; // currently-open headings, deepest last
  for (const { node } of events) {
    if (node.kind === "heading") {
      // Close any open heading at this level or deeper — it cannot contain us.
      while (stack.length > 0 && stack[stack.length - 1].level! >= node.level!) {
        stack.pop();
      }
    }
    const parent = stack[stack.length - 1];
    (parent ? parent.children : roots).push(node);
    if (node.kind === "heading") {
      stack.push(node);
    }
  }
  return roots;
}

/**
 * Recursively drop `cell`-kind nodes from an outline tree, keeping headings
 * and their remaining structure — the pure half of the show/hide-cells
 * toggle. The adapter (`providers/outline.ts`) reads the live `vscode`
 * setting and calls this.
 */
export function hideCellsInOutline(symbols: OutlineSymbol[]): OutlineSymbol[] {
  return symbols
    .filter((s) => s.kind !== "cell")
    .map((s) => ({ ...s, children: hideCellsInOutline(s.children) }));
}

/**
 * The 0-based line where heading `k`'s section ends: one line before the next
 * heading of equal-or-higher level, or the last line of the document if none.
 */
function sectionEndOf(headings: Heading[], k: number, lastLine: number): number {
  for (let j = k + 1; j < headings.length; j++) {
    if (headings[j].level <= headings[k].level) {
      return headings[j].line - 1;
    }
  }
  return lastLine;
}

/**
 * Build a `Heading` from a raw heading-text line, or `null` if nothing
 * displayable remains. Strips a trailing Pandoc attribute block (shared by ATX
 * and setext) and, for ATX only, an optional closing-hash run — setext has no
 * such convention, so a literal trailing `##` in setext text is kept verbatim
 * (confirmed against the real Quarto CLI).
 */
function buildHeading(
  level: number,
  rawText: string,
  line: number,
  stripClosingHash: boolean,
): Heading | null {
  const attribute = HEADING_ATTRIBUTE.exec(rawText);
  const id = attribute ? ATTR_ID.exec(attribute[0])?.[1] : undefined;
  let text = rawText.replace(HEADING_ATTRIBUTE, "");
  if (stripClosingHash) {
    text = text.replace(ATX_CLOSING, "");
  }
  text = text.trim();
  if (!text) {
    return null;
  }
  return id ? { level, text, line, id } : { level, text, line };
}

/**
 * Build a `Heading` from a matched ATX line, or `null` if nothing displayable
 * remains. The display text drops a trailing Pandoc attribute block and any ATX
 * closing-hash run, so `## Methods {#sec-methods}` → "Methods" and an all-hash
 * `## ##` → dropped.
 */
function parseHeadingLine(m: RegExpExecArray, line: number): Heading | null {
  return buildHeading(m[1].length, m[2], line, true);
}

/**
 * Build a `Heading` from a setext content line + its underline's level (1 for
 * `=`, 2 for `-`), or `null` if nothing displayable remains after stripping a
 * trailing Pandoc attribute block. `line` is the CONTENT line's index (where
 * the readable text is), not the underline's — matching how an ATX heading's
 * own line is its displayed line, and keeping `buildOutline`'s section-span
 * math (which reads `Heading.line`) uniform across both heading styles.
 */
function parseSetextHeadingLine(
  level: number,
  rawText: string,
  line: number,
): Heading | null {
  return buildHeading(level, rawText, line, false);
}
