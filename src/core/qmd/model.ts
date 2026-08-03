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
 * A single-line ATX heading (CommonMark §4.2): up to 3 spaces of indentation,
 * then 1–6 `#`, then at least one space/tab, then the text. Requiring the space
 * after the hashes is what rejects `#hashtag`; capping at 6 rejects `#######`.
 */
const ATX_HEADING = /^ {0,3}(#{1,6})[ \t]+(.+)$/;
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
 * A setext heading underline (CommonMark §4.3): up to 3 spaces of indentation,
 * then one or more of a SINGLE char (no spaces between, unlike a thematic break),
 * then optional trailing whitespace. `=` underlines a level-1 heading; `-`
 * underlines level-2. Recognized only when it immediately follows exactly one
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
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/;
/** A setext level-2 underline — see `SETEXT_H1`. */
const SETEXT_H2 = /^ {0,3}-+[ \t]*$/;
/** A line with no non-whitespace content. */
const BLANK_LINE = /^[ \t]*$/;
/**
 * A bullet-list item marker (`-`/`*`/`+` then a space/tab) at the start of a
 * line. Confirmed against the real Quarto CLI: a lone bullet-list item
 * immediately followed by a setext underline does NOT become a top-level
 * heading — Pandoc strips the marker and nests the heading INSIDE the `<li>`.
 * This model tracks no list context, so it must decline (a false negative)
 * rather than emit a wrong top-level heading whose text includes the literal
 * marker. An ordered-list marker (`1.`) or a block quote (`>`) does NOT
 * trigger this — Pandoc keeps those literal with no nesting, so the general
 * mechanism already matches real behavior for them, unguarded.
 */
const BULLET_LIST_MARKER = /^ {0,3}[-*+][ \t]/;
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
  /^(?: {4,}|\t)\S/, //                                      an indented code block, spaces OR tab
  /^ {0,3}\[(?!\^[^\s^\]]+\]:)[^\]]*\]:/, //                 a link reference — NOT a `[^1]:` footnote
  /^ {0,3}</, //                                             a raw HTML block — see the note below
  /^ {0,3}#{1,6}[ \t]*$/, //                                 a bare `##` — an EMPTY heading to pandoc
  /^ {0,3}\\[a-zA-Z]/, //                                    a raw TeX block — see the note below
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
 * A setext underline run that pandoc will swallow the ATX line above into — `=`s or `-`s
 * alone on a line, any length, at **column 0**, for the ATX-adjacency rule in
 * `closesParagraph` below.
 *
 * ⚠ **Deliberately NARROWER than `SETEXT_H1`/`SETEXT_H2`, which allow 0-3 spaces of indent.**
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
 *   `|line one`      NOT a line block — prose; the heading below is a phantom
 *   `|`              NOT one either: it renders a line-block div, but a following indented
 *                    line does NOT attach to it, so treating it as an opener invents a heading
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
const LINE_BLOCK_LINE = /^\|[ \t]/;
const LINE_BLOCK_CONTINUATION = /^[ \t]+/;
/**
 * A pipe table's DELIMITER row — the line that turns a run of `| … |` rows into a table
 * rather than a line block (Session 185).
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
 */
const TABLE_DELIMITER_ROW = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
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
): boolean {
  if (lineBlockAbove && LINE_BLOCK_CONTINUATION.test(line)) {
    return true;
  }
  if (prevWasAtxHeading && SETEXT_UNDERLINE_RUN.test(line)) {
    return true;
  }
  if (HTML_BLOCK_OPEN.test(line) || RAW_TEX_ENV_OPEN.test(line) || CLOSER_LINE.test(line)) {
    return true;
  }
  if (paragraphOpen && !paragraphQuoted) {
    return false;
  }
  return THEMATIC_BREAK.test(line) || CLOSES_PARAGRAPH.some((re) => re.test(line));
}
/**
 * An indented code block (CommonMark §4.4) — 4+ spaces or a tab, then content.
 * Only ever a code block where no paragraph is already open; against an open
 * paragraph the same bytes are a LAZY CONTINUATION of it (measured).
 */
const INDENTED_CODE_LINE = /^(?: {4,}|\t)\S/;
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
 */
const OPENS_FRESH_BLOCK: readonly RegExp[] = [
  INDENTED_CODE_LINE, //                                     an indented code block, spaces OR tab
  /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/, //  a thematic break
  /^ {0,3}\[[^\^\]][^\]]*\]:/, //                            a link-reference definition — NOT `[^1]:`
  /^ {0,3}\|/, //                                            a pipe-table ROW; a bare `a | b` is prose
  /^ {0,3}#{1,6}[ \t]*$/, //                                 a bare `##` — an EMPTY heading to pandoc
  /^ {0,3}\\[a-zA-Z]/, //                                    a raw TeX block (`\clearpage`, `\newpage`)
];
/**
 * A raw HTML BLOCK opener — the one construct measured to interrupt an OPEN paragraph,
 * so it is tested before the `paragraphOpen` bail. `prose` / `<div>` / `Title` / `===`
 * renders `<h1>Title</h1>`, where every other construct in this file renders nothing.
 *
 * The tag list is CommonMark §4.6 conditions **1 and 6**, and is deliberately CLOSED: an
 * INLINE tag does not open a block, so `<span>hi</span>` / `Title` / `===` renders no heading
 * at all (measured). `CLOSES_PARAGRAPH`'s bare `/^ {0,3}</` would match both and fabricate one.
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
const HTML_BLOCK_OPEN =
  /^[ \t]*<\/?(?:pre|script|style|textarea|address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t/>]|$)/i;
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
 * the identical document without the `prose` line renders `<h1>Title</h1>`. Raw HTML is
 * the single measured exception and is tested before the bail.
 */
function opensFreshBlock(line: string, paragraphOpen: boolean): boolean {
  if (HTML_BLOCK_OPEN.test(line)) {
    return true;
  }
  if (paragraphOpen) {
    return false;
  }
  return OPENS_FRESH_BLOCK.some((re) => re.test(line));
}
/**
 * A fence opener: up to 3 spaces of indentation (CommonMark §4.5 — 4+ spaces is
 * indented code, not a fence), then ≥3 of ONE fence char (backtick or tilde),
 * then anything. Capturing the char lets the scanner require the closer to use
 * the same char, so a backtick run can't close a tilde block and vice versa.
 * The 0–3 cap matches the ATX heading rule so the two never disagree on what
 * counts as indented code. Shared with cell detection below.
 */
const FENCE_OPEN = /^ {0,3}(([`~])\2{2,})(.*)$/;
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
/** A closing fence: 0–3 spaces, ≥3 of one fence char only, optional trailing space. */
const FENCE_CLOSE = /^ {0,3}(([`~])\2{2,})[ \t]*$/;
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
  // the line-block rule for the table's remaining body rows — see `TABLE_DELIMITER_ROW`.
  // ⚠ Unlike `lineBlockOpen` this one is STICKY across the table's body rows, so it cannot be
  // cleared at the top of the loop; it is cleared on the BLANK LINE that ends the table
  // instead. Measured, and required in both directions: without the clear, a genuine line
  // block BELOW a table never arms (`| a | b |` / `|---|---|` / `| 1 | 2 |` / (blank) /
  // `| line one` / `  continued` / `# ATX Below` renders the heading and we would lose it).
  let inPipeTable = false;
  // A front-matter `from:` disables the paragraph rule for the whole document — see
  // `FRONTMATTER_FROM_KEY`. Without this the change DELETES headings quarto renders.
  let dialectOverride = false;
  // Whether the line ABOVE began a fresh block, making this line a paragraph start
  // (Session 181). Deliberately a one-line deferral rather than a reset — see the loop.
  // It needs no clearing at the region-boundary resets below: those set `consecutiveBody`
  // to 0, where both branches of the deferral produce 1 for the next body line anyway.
  let pendingFreshBlock = false;
  // Whether the line above was an indented code line, so a run of 2+ can be told from a
  // lone indented line. Same reasoning as above for why the resets need not clear it.
  let prevIndentedCode = false;

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
    // A whole-line single-line comment renders to nothing — skip it entirely.
    if (COMMENT_FULL_LINE.test(line)) {
      consecutiveBody = 0;
      paragraphOpen = false;
      continue;
    }
    if (COMMENT_OPEN.test(line) && !COMMENT_CLOSE.test(line)) {
      inComment = true;
      consecutiveBody = 0;
      paragraphOpen = false;
      continue;
    }

    // A fence opener (captures cell metadata so the closer can emit the cell).
    // When CommonMark's 0–3-space rule declines, quarto's unbounded CELL opener gets a
    // second look — but ONLY when the info string really is a cell, so a plain fence
    // keeps the CommonMark cap (Session 178).
    const plainFence = FENCE_OPEN.exec(line);
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
      continue;
    }

    // A setext underline (`===`/`---`-only line) immediately following exactly
    // one fresh paragraph line converts THAT line into a heading — see
    // `SETEXT_H1`'s docstring for the disambiguation rule.
    if (consecutiveBody === 1 && (SETEXT_H1.test(line) || SETEXT_H2.test(line))) {
      const prev = bodyLines[bodyLines.length - 1];
      if (!BULLET_LIST_MARKER.test(prev.text)) {
        const heading = parseSetextHeadingLine(SETEXT_H1.test(line) ? 1 : 2, prev.text, prev.line);
        if (heading) {
          headings.push(heading);
        }
      }
      bodyLines.push({ line: i, text: line });
      consecutiveBody = 0;
      paragraphOpen = false;
      continue;
    }

    // A live content line (prose or a heading) — outside every skip-region.
    bodyLines.push({ line: i, text: line });

    // An ATX heading — but only where no paragraph is open above it.
    const m = paragraphOpen && !dialectOverride ? null : ATX_HEADING.exec(line);
    if (m) {
      const heading = parseHeadingLine(m, i);
      if (heading) {
        headings.push(heading);
      }
      consecutiveBody = 0;
      paragraphOpen = false;
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
      const indented = INDENTED_CODE_LINE.test(line);
      const insideIndentedCode = indented && prevIndentedCode;
      consecutiveBody = pendingFreshBlock && !insideIndentedCode ? 1 : consecutiveBody + 1;
      // Read `paragraphOpen` for the line ABOVE before overwriting it for this one —
      // whether these bytes open a block or merely continue a paragraph depends on it.
      pendingFreshBlock = opensFreshBlock(line, paragraphOpen);
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
      );
      // A line block stays open across its own continuations, so the arm re-arms on one; but
      // it can only be OPENED where no paragraph already is. Measured: a line block does not
      // interrupt a paragraph, with or without a continuation, so arming against an open one
      // would close a paragraph quarto keeps open and fabricate the heading below it.
      if (TABLE_DELIMITER_ROW.test(line)) {
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
  const m = (open.isCell ? CELL_FENCE_CLOSE : FENCE_CLOSE).exec(line);
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
    if (FENCE_CLOSE.test(lines[i])) {
      for (let n = 3; n <= len; n++) {
        push(`p|${char}|${n}`, i);
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
  const bucket = index.get(`${open.isCell ? "c" : "p"}|${open.char}|${open.len}`);
  if (bucket === undefined) {
    return false;
  }
  // First entry ≥ `from`, by binary search — the buckets are built in ascending order.
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
