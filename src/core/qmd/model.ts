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

// ⚠ **The ONLY import in this module, added in Session 211, and the direction was verified
// rather than inherited.** `quarto-yaml-regions.ts` has no imports of its own and does not
// import this file, so there is no cycle. (Session 206 found `yaml-context.ts` unusable for
// exactly this purpose because it imports FROM here; that constraint does not apply to this
// module, and the import graph was re-checked before relying on it.) The `vscode`-free
// guardrail of architecture plan §3.3 is unaffected — the imported module is `core/` too.
import { quartoYamlRegions } from "./quarto-yaml-regions";

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
 * The same row for a reader that has `space_in_atx_header` **OFF**, where the separator between
 * the hashes and the text is optional and `#Heading` is a real heading (Session 212).
 *
 * ⚠ **`(?!#)` is the whole reason this is a second constant rather than a `[ \t]*` edit to the
 * one above, and it is a heading-INVENTING trap the cheap fix walks straight into.** With the
 * separator merely optional, `#######Cal Tight Seven` matches: `#{1,6}` takes six of the seven
 * hashes and the text group takes `#Cal Tight Seven`, so the model reports `h6:#Cal Tight Seven`
 * for a document quarto renders NO heading for. Today the seventh hash is what refuses the
 * match — `[ \t]+` cannot match it — and making the separator optional removes that refusal.
 * Measured on all four accepting spellings, not derived from one document:
 * `scratchpad/s212/cal3` — `o1_lvl7_strict`, `o1_lvl7_mmd`, `o1_lvl7_php`, `o1_lvl7_mdoff`,
 * plus `cal/c3_lvl7_strict` and its `markdown` twin.
 *
 * The two capture groups are identical to `ATX_HEADING`'s, so `parseHeadingLine` reads this
 * match unchanged, and `(.+)` still refuses a bare hash run with no text (`cal/c4_bare_strict`).
 */
const ATX_HEADING_TIGHT = /^[ \t]*(#{1,6})(?!#)[ \t]*(.+)$/;
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
 * An optional closing sequence **as CommonMark §4.2 defines it** — a run of `#` at end of line,
 * preceded by whitespace OR by the start of the (already separator-stripped) text. Anchoring to
 * `^` as well lets an all-hash heading body (`## ##`) collapse to empty so it is dropped.
 *
 * ⚠ **This is now the CommonMark-dialect spelling only, and the sentence that used to follow —
 * that a `#` which is part of a word (`C#`) is preserved — was MEASURED FALSE for the pandoc
 * markdown family** (Session 215; the docstring's own claim is what `BACKLOG` filed). See
 * `ATX_CLOSING_PANDOC` below for the six readers that do not require the space, and
 * `atxClosingRun` for the gate between them.
 */
const ATX_CLOSING = /(?:^|[ \t]+)#+[ \t]*$/;
/**
 * The same closing sequence for the pandoc `markdown*` family, which does **not** require a space
 * before it: `# Cal Learning C#` renders `<h1>Cal Learning C</h1>` (Session 215).
 *
 * ⚠ **The reader split is MEASURED over nine readers, one matched set each, and it is 6–3 —
 * the backlog entry said "under EVERY reader".** `scratchpad/s215/cal`, 45 documents:
 *
 *   STRIP UNSPACED   no `from:` at all · `markdown` · `markdown_strict` · `markdown_mmd`
 *                    `markdown_phpextra` · `markdown_github`
 *   DO NOT           `gfm` · `commonmark` · `commonmark_x`
 *
 * That set is exactly `FRONTMATTER_COMMONMARK_FROM`, so `commonmarkDialect` is the gate by
 * measurement rather than by convenience. ⚠ The `a_*_spaced` / `a_*_runsp` control column is what
 * makes this a SPLIT rather than "CommonMark strips nothing": all nine readers strip the run when
 * a space precedes it, so the right-hand column is applying CommonMark §4.2's *"must be preceded
 * by a space"*, not lacking the convention. ⚠ **`markdown_github` strips and `gfm` does not**,
 * though pandoc documents the former as a deprecated synonym for the latter — a table reasoned
 * from the base name puts that row on the wrong side (Learnings #348 / #352, a fourth time).
 *
 * ⚠ **The lookbehind counts BACKSLASH PARITY; it is not `(?<!\\)`, and the difference is
 * measured** (Session 217). An escape needs an ODD run of backslashes before it, so a construct
 * is real exactly when an EVEN run (including none) precedes it — `(?<=(?:^|[^\\])(?:\\\\)*)`.
 * `# Cal Echo Esc\#` renders `<h1>Cal Echo Esc#</h1>` (the hash is escaped, no closing run) while
 * `# Adv Double Esc\\#` renders `<h1>Adv Double Esc\</h1>` — the `\\` is an escaped backslash, so
 * the `#` after it IS a closing run. `(?<!\\)` sees one character and gets the second row wrong;
 * the full ladder is `scratchpad/s217/cal4`'s `d_*_run0`–`run3`, three readers.
 *
 * ⚠ The surviving backslashes stay in the text — this constant only decides WHERE the run is.
 * `decodeHeadingEscapes` then halves them, which is why `d_md_run2` ends as one backslash.
 */
const ATX_CLOSING_PANDOC = /(?<=(?:^|[^\\])(?:\\\\)*)#+[ \t]*$/;
/**
 * The closing-sequence spelling this document's reader uses, or `null` where the construct does
 * not exist at all. Setext headings pass `null`: quarto keeps a trailing hash run there under
 * BOTH spellings (`cal2/b_setext` → `h1:Cal Romeo Set#`, `b_setextsp` → `h1:Cal Sierra Set #`),
 * which is what `parseSetextHeadingLine` has always produced.
 */
function atxClosingRun(commonmarkDialect: boolean): RegExp {
  return commonmarkDialect ? ATX_CLOSING : ATX_CLOSING_PANDOC;
}
/**
 * A trailing Pandoc/Quarto heading attribute block — `{#sec-id .class key=val}`.
 * Quarto renders the heading text without it (and the `#sec-` id drives Phase 6b
 * cross-references), so it is stripped from the outline display name here. Shared
 * by ATX and setext headings — Pandoc accepts a trailing attribute block on both.
 *
 * ⚠ **The block needs NO whitespace before it, and requiring it was the filed defect**
 * (Session 216). `# Cal Alpha Tight{#sec-alpha-ti}` renders
 * `<section id="sec-alpha-ti"><h1>Cal Alpha Tight</h1>` — read firsthand from the HTML, not
 * through an extractor — while this model reported the whole literal and indexed no id at all.
 * The old `(?:^|[ \t]+)` is the same one-line shape Session 215 removed from `ATX_CLOSING` one
 * constant over.
 *
 * ⚠ **The lookbehind counts BACKSLASH PARITY; it is not `(?<!\\)`** (Session 217, and see
 * `ATX_CLOSING_PANDOC` for the same change one constant over). `# Cal Esc \{#sec-esc}` renders
 * `<h1>Cal Esc {#sec-esc}</h1>` — `\{` is an escaped brace, so there is no block at all — while
 * `# Adv Esc Backslash \\{#sec-advesb}` renders `<h1>Adv Esc Backslash \</h1>` **and defines
 * `id="sec-advesb"`**, because `\\` is an escaped backslash and the block after it is real.
 * `(?<!\\)` refuses both, which loses that id.
 *
 * ⚠ **THIS IS THE ONLY WAY THIS SESSION'S RULE REACHES `src/core/refs.ts`.** Decoding heading TEXT
 * cannot move the cross-reference index — the model has no auto-id generation, so `indexLabels`
 * reads only an explicit `Heading.id`. The parity half can, and it moves it in the RECOVERING
 * direction: an id quarto defines and this model used to miss. Ladder: `scratchpad/s217/cal4`
 * `d_*_attr0`–`attr3`, three readers, plus `pin/p3_twoslash`.
 *
 * ⚠ **Whether the block is HONOURED is a separate question, and it is `headerAttributesDialect`'s**
 * — see `fromHonoursHeaderAttributes`. This constant only says where a block would be.
 *
 * ⚠ Three measured boundaries this deliberately does NOT match, each with a rendered witness in
 * `scratchpad/s216/cal2`: a block with text after it (`b_after`, quarto keeps the braces), a
 * NESTED brace group (`b_nested`, likewise — `[^}]*` cannot cross a `}`, which is correct here
 * rather than lucky), and a closing hash run AFTER the block (`b_attrrun`, where the `#` is the
 * closing sequence and the braces are ordinary text). Only the LAST block on a line is a block:
 * `# Cal Two {#a}{#b}` renders `Cal Two {#a}` (`b_two_md`).
 */
const HEADING_ATTRIBUTE = /(?<=(?:^|[^\\])(?:\\\\)*)\{[^}]*\}[ \t]*$/;
/**
 * Every `#identifier` ATOM in a heading attribute block, in source order (Session 219).
 *
 * ⚠ **THE CHARACTER SET IS SESSION 218's, DELIBERATELY AND NOT INCIDENTALLY.** This replaces an
 * `ATTR_ID` whose class was `[^\s}]+` — "anything but whitespace or a closing brace" — which is
 * the same over-wide shape Session 218 removed from the validity predicate one commit earlier,
 * and it failed the same way: it swallowed the second `#` of `{#sec-t05a#sec-t05b}` and indexed
 * the literal `sec-t05a#sec-t05b`, a cross-reference target no reader defines, on a document
 * whose heading text was stripped correctly. Pandoc's identifier is Unicode letters, digits,
 * `-`, `_`, `:` and `.`, so the atoms break at `#` and NOT at `.` — which is why
 * `{#sec-q10.cls}` is one id named `sec-q10.cls` (`scratchpad/s218/cal2/*_q10idcls`) and
 * `{#sec-t14a.x #sec-t14b}` is two (`scratchpad/s219/id/*_t14dot`).
 *
 * Both dialects share this set; they differ only in WHICH of the atoms wins — see
 * `headingAttributeId`.
 */
const ATTR_ID_ALL = /#([\p{L}\p{N}_:.-]+)/gu;
/**
 * WHICH id a block carrying more than one of them defines, **per reader** (Session 219).
 *
 * ⚠ **THIS IS A MEASURED READER SPLIT, AND THE MODEL TOOK THE FIRST ID FOR EVERY READER.** Over
 * 100 documents rendered through the real quarto path (`scratchpad/s219/id`, quarto 1.7.33), the
 * pandoc three — no `from:`, `markdown`, `markdown_phpextra` — define the **LAST** `#` in the
 * block, and `commonmark_x` defines the **FIRST**:
 *
 *   `# Cal T02 Sp2 {#sec-t02a #sec-t02b}`  → `id="sec-t02b"` · `commonmark_x` `id="sec-t02a"`
 *   `# Cal T03 Sp3 {#sec-t03a #sec-t03b #sec-t03c}` → `sec-t03c` · `commonmark_x` `sec-t03a`
 *
 * ⚠ **THREE IDS ARE WHAT MAKE THIS RULE FALSIFIABLE.** "The last wins" and "the second wins" are
 * the same claim at two ids and different claims at three, so `t03`/`t04` (three and four ids, in
 * both spellings) are the rows the rule is written against — not the two-id shape it was filed
 * for.
 *
 * ⚠ **AND THE DIRECTION IS BOTH WAYS AT ONCE, WHICH IS WHY IT IS SCORED ON `indexLabels` RATHER
 * THAN ON THE ID STRING.** `src/core/refs.ts` keeps only ids with a `sec-` prefix, so a block
 * whose ids differ in KIND moves a cross-reference target in or out of existence:
 * `{#intro #sec-t16}` really defines `sec-t16` and this model indexed NOTHING, while
 * `{#sec-t17 #intro}` really defines `intro` — no `sec-` target at all — and this model indexed
 * `sec-t17`, a fabricated one of exactly the class Session 218 exists to have removed.
 *
 * ⚠ Callers pass the block only after `headingAttributesValid` has accepted it, which is load-
 * bearing rather than tidy: `commonmark_x` rejects atom CONCATENATION outright, so `{#a#b}` is
 * ordinary text for that reader and must yield no id at all — not its first one.
 */
function headingAttributeId(
  content: string,
  commonmarkDialect: boolean,
  pandocEscapes: boolean,
): string | undefined {
  // ⚠ **THE IDS COME FROM THE TOKENS, NOT FROM THE RAW BLOCK — AND SCANNING THE RAW BLOCK IS A
  // REGRESSION THIS SESSION SHIPPED FOR TWO COMMITS AND ITS OWN ADVERSARIAL PASS CAUGHT.**
  // `ATTR_KEY_VALUE`'s bare value is `[^\s}]*`, which ADMITS `#`, so `{#sec-x01 key=#sec-fake}`
  // is a VALID block whose real id is `sec-x01` — and a `matchAll` over the block text takes
  // `sec-fake`, a cross-reference target no document defines. Measured over the pandoc three in
  // four spellings (bare, double-quoted, quoted-with-spaces, single-quoted):
  // `scratchpad/s219/adv/*_x01kvhash` through `*_x04single`. ⚠ The PRE-session build was right
  // on all twelve rows by accident, because it took the FIRST `#…` and in these shapes the
  // first one IS the id — so this was a true regression, not an inherited defect.
  //
  // Reusing Session 218's tokenizer is what makes a key=value contribute no ids at all, and it
  // is the same rule that already decided the block was valid: same split, same quote handling,
  // same escaped-space branch.
  const atoms = commonmarkDialect ? ATTR_ATOM_COMMONMARK : ATTR_ATOM_RUN;
  const found: string[] = [];
  for (const token of headingAttributeTokens(content, pandocEscapes)) {
    if (!atoms.test(token)) {
      continue;
    }
    for (const m of token.matchAll(ATTR_ID_ALL)) {
      found.push(m[1]);
    }
  }
  if (found.length === 0) {
    return undefined;
  }
  return commonmarkDialect ? found[0] : found[found.length - 1];
}
/**
 * A `{ … }` group on a line, located so its geometry can be tested.
 *
 * ⚠ Lives HERE rather than in `src/core/refs.ts`, where Session 222 wrote it, because
 * Session 224 needs the SAME group scan inside `computeRegions` — a fence opener's info
 * string is judged by the identical grammar. Re-deriving it there would be a second scanner
 * over the same bytes (Learning #14); moving it down the existing dependency edge is the
 * shape that keeps one grammar. `refs.ts` imports it back.
 */
export interface BraceGroup {
  /** 0-based column of the `{`. */
  start: number;
  /** 0-based column of the matching `}`. */
  end: number;
  /** The text between the braces. */
  content: string;
}

/**
 * Every CLOSED brace group on `lineText`, left to right and non-overlapping.
 *
 * ⚠ **A `{` WITH NO `}` AFTER IT YIELDS NO GROUP AT ALL** — measured: `![Cap](a.png){#fig-v11`
 * renders its brace verbatim and defines nothing (`scratchpad/s222/cal/cal.qmd` v11, and
 * `s221/adv/adv.qmd` a06). Nothing can attach to an unterminated group.
 *
 * ⚠ **AND THE CLOSER IS FOUND QUOTE-AWARE, WHICH ONE RENDERED ROW REQUIRES.**
 * `![Cap](a.png){#fig-w12 key="a}b"}` defines `fig-w12` (`disc.qmd` w12): the `}` inside the
 * quoted value is content, not the end of the group. A naive scan to the first `}` reads the
 * block as `#fig-w12 key="a`, judges it invalid, and drops an id quarto really defines. This
 * is the same quote awareness `headingAttributeTokens` carries, for the same reason, and it is
 * the other side of the still-open heading item where `[^}]*` loses to that byte.
 */
export function braceGroups(lineText: string): BraceGroup[] {
  const groups: BraceGroup[] = [];
  let i = 0;
  while (i < lineText.length) {
    if (lineText[i] !== "{") {
      i++;
      continue;
    }
    let quote: string | null = null;
    let j = i + 1;
    for (; j < lineText.length; j++) {
      const ch = lineText[j];
      if (quote !== null) {
        if (ch === quote) {
          quote = null;
        }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === "}") {
        break;
      }
    }
    if (j >= lineText.length) {
      i++;
      continue;
    }
    groups.push({ start: i, end: j, content: lineText.slice(i + 1, j) });
    i = j + 1;
  }
  return groups;
}

/**
 * The identifier a Pandoc attribute block whose content is `content` defines, for the
 * **pandoc-family** readers — or `undefined` when the content is not a well-formed attribute
 * block, or is one that carries no identifier.
 *
 * Exported for `src/core/refs.ts`, whose Source 3 asks this question about the blocks on
 * IMAGES, LINKS, BRACKETED SPANS and FENCED DIVS rather than on headings.
 *
 * ⚠ **THE SHARED GRAMMAR IS ESTABLISHED BY RENDERING, NOT BY PORTING** (Learning #377). Every
 * clause of `headingAttributesValid` / `headingAttributeId` that could have differed for an
 * inline element was re-measured in Session 222 against the real quarto path
 * (`scratchpad/s222/cal/`, quarto 1.7.33), and each gave the heading answer:
 *
 *   `{#fig-v01 bareword}` → no id, braces literal   a bare word is neither atom-run nor k=v
 *   `{#fig-v02$x}`        → no id, braces literal   `$` is outside the identifier set
 *   `{#fig-v07 .1cls}`    → no id, braces literal   a CLASS must begin with a letter
 *   `{#fig-v09 =bad}`     → no id, braces literal   a key must begin with a letter
 *   `{#fig-v04 key=v}`    → `fig-v04`               bare key=value
 *   `{#fig-v05 key="a b"}`→ `fig-v05`               a QUOTED value holding a space is one token
 *   `{#fig-q02 key='a b'}`→ `fig-q02`               and a SINGLE-quoted one likewise
 *   `{#fig-q01 key=a\ b}` → `fig-q01`               an ESCAPED space joins the token
 *   `{#fig-v06 -}`        → `fig-v06`               the `-` atom
 *   `{#fig-q08café}`      → `fig-q08café`           the letters are Unicode
 *   `{#fig-w12 key="a}b"}`→ `fig-w12`               a `}` inside a quoted value stays inside
 *
 * ⚠ **AND SO IS THE SELECTION RULE, WHICH IS WHY THIS TAKES THE LAST ATOM.**
 * `![Cap](a.png){#fig-s01a #fig-s01b}` renders `id="fig-s01b"` and the three-atom row
 * `{#fig-s02a #fig-s02b #fig-s02c}` renders `id="fig-s02c"` — three atoms being what makes
 * "the last wins" falsifiable against "the second wins" (Session 219's own argument, re-run
 * here for a different element). A `#` inside a `key=value` still contributes no id at all
 * (`{#fig-s04 key=#fig-s04fake}` → `fig-s04`).
 *
 * ⚠ **THE READER SPLIT IS CARRIED HERE RATHER THAN DECLARED AWAY, BECAUSE IGNORING IT WOULD
 * HAVE SHIPPED A FRESH REGRESSION.** The split Session 219 measured on headings holds for
 * inline blocks too — rendered with `from: commonmark_x`,
 * `![Cap](a.png){#fig-x01a #fig-x01b}` defines the FIRST id and `::: {#fig-x03a #fig-x03b}`
 * likewise (`scratchpad/s222/cal/cmx.qmd`). Session 222 first shipped the pandoc-family rule
 * alone and its own 46,530-document sweep caught the consequence: the OLD scan took the first
 * `{#…}` on the line, which is accidentally correct for that reader, so a last-atom rule made
 * a working document worse. Hence {@link AttributeBlockReader}.
 */
export function attributeBlockId(
  content: string,
  reader: AttributeBlockReader,
): string | undefined {
  return headingAttributesValid(content, reader.commonmarkDialect, reader.pandocEscapes)
    ? headingAttributeId(content, reader.commonmarkDialect, reader.pandocEscapes)
    : undefined;
}

/** The two reader flags an attribute block's parse depends on. */
export interface AttributeBlockReader {
  /** Whether the document's `from:` names a reader of the CommonMark family. */
  commonmarkDialect: boolean;
  /** Whether `\<space>` joins a token rather than ending it — see `headingAttributeTokens`. */
  pandocEscapes: boolean;
}

/**
 * Resolve {@link AttributeBlockReader} for a whole document, from its front-matter `from:`.
 *
 * ⚠ **BOTH FLAGS COME FROM THE SAME `fromValueLine` AS THE HEADING PATH's, AND THAT IS THE
 * POINT.** This is the identical pair `buildHeading` is handed, resolved the identical way, so
 * an attribute block on an image cannot be judged by a different reader than one on a heading
 * in the same document.
 */
export function attributeBlockReader(text: string): AttributeBlockReader {
  const fromValueLine = frontMatterFromValueLine(text.split(/\r?\n/));
  return {
    commonmarkDialect:
      fromValueLine !== null && FRONTMATTER_COMMONMARK_FROM.test(fromValueLine),
    pandocEscapes: fromEscapesAllSymbols(fromValueLine),
  };
}
/**
 * One whitespace-separated token of a heading attribute block, as a `KEY=VALUE` pair.
 *
 * ⚠ **The key must start with a LETTER and there may be NO SPACE around the `=`** — measured,
 * not assumed: `{1key=v}` (`scratchpad/s218/cal3/*_r09keydigit`), `{=val}` (`cal/*_p17nokey`)
 * and `{key = val}` (`cal/*_p23kvsp`) are all rendered as ordinary TEXT by every reader that
 * honours attributes at all, because each leaves a bare word the attribute parser cannot place.
 *
 * ⚠ The bare-value alternative deliberately admits a QUOTE (`{key=v"al}` → `cal2/*_q18quote1`,
 * stripped by the pandoc three) and may be EMPTY (`{key=}` → `cal/*_p16kvempty`, likewise).
 * Both are `commonmark_x` divergences — see `headingAttributesValid`.
 */
const ATTR_KEY_VALUE = /^[A-Za-z][^\s}#\\=]*=(?:"[^"]*"|'[^']*'|(?:\\ |[^\s}])*)$/;
/**
 * One whitespace-separated token as a run of one or more `#id` / `.class` / `-` ATOMS.
 *
 * ⚠ **The atoms CONCATENATE without whitespace, and that is measured rather than tidy.**
 * `{#sec-p20a#sec-p20b}` and `{--}` are both stripped by the pandoc family (`cal/*_p20idtwo`,
 * `cal2/*_q04dash2`), so a rule of "one atom per token" would keep braces quarto removes.
 *
 * ⚠ **A `.` is an ordinary IDENTIFIER character; the atoms break at `#`, not at `.`.** This was
 * the sharpest of the three predictions Session 218 got wrong before rendering `cal3`: `{#a.}`
 * is stripped (`cal3/*_r14iddot`) and `{#sec-q10.cls}` defines the id `sec-q10.cls`, not
 * `sec-q10` (`cal2/*_q10idcls`) — so `{.c1.c2}` is ONE class named `c1.c2`, not two.
 *
 * ⚠ **A CLASS must begin with a letter and an ID need not** — `{.1cls}` is kept and `{#1num}` is
 * stripped (`cal2/*_q13clsdigit`, `*_q12iddigit`). ⚠ And `\` and `=` are in neither: they are
 * what makes `{#sec-p13\:x}` and `{#a=b}` invalid, which is the whole cross-reference half of
 * this rule (`cal/*_p13idesc`, `cal3/*_r08ideq`).
 *
 * ⚠ **THE CHARACTER SET IS PANDOC'S — letters, digits, `-`, `_`, `:` and `.` — AND WRITING IT AS
 * "anything but whitespace" IS THIS ITEM'S OWN DEFECT ONE LEVEL DEEPER.** `{#sec-x24!}` renders
 * as ordinary text and defines NO id (`scratchpad/s218/adv/*_x24bang`), and `{#sec-x09{b}`
 * likewise (`*_x09nestopen`); an over-wide set strips both and enters `sec-x24!` and `sec-x09{b`
 * in the cross-reference index — the fabricated-label failure this session exists to remove.
 * ⚠ The letters are UNICODE letters, not `[A-Za-z]`: `{#sec-café}` is stripped (`*_x11uniid`)
 * and so is `{.クラス}` (`*_x12unicls`), which the first draft of this rule kept — a regression
 * its own adversarial pass caught.
 */
const ATTR_ATOM_RUN = /^(?:-|#[\p{L}\p{N}_:.-]+|\.\p{L}[\p{L}\p{N}_:.-]*)+$/u;
/**
 * `commonmark_x`'s spelling of the two token forms above — **ONE atom per token, no `-`, and a
 * class that may start with anything but may not contain a `.`** (Session 218).
 *
 * ⚠ **This is a MEASURED reader split and not a tightness dial.** `commonmark_x` is the only
 * CommonMark-family reader that honours a heading attribute block at all (S216's 4–5 table), and
 * it takes it from pandoc's `attributes` extension rather than the pandoc family's
 * `header_attributes`. Eleven of the 68 shapes in `scratchpad/s218/cal`+`cal2` are stripped by
 * the pandoc three and kept here — `{-}`, `{}`, `{ }`, `{key=}`, `{#a#b}`, `{key='a b'}`,
 * `{--}`, `{ - }`, `{#sec-q07 -}`, `{.c1.c2}`, `{key=v"al}` — and **one goes the other way**:
 * `{.1cls}` is kept by the pandoc three and stripped here (`cal2/*_q13clsdigit`). That single
 * row is why a shared predicate with a "stricter" flag cannot express this.
 *
 * ⚠ `{-}` alone would justify the split: it is pandoc's documented shorthand for `.unnumbered`
 * and a shape quarto authors write constantly, so a predicate tuned to the pandoc family deletes
 * the braces from every `{-}` heading in a `commonmark_x` document.
 */
const ATTR_ATOM_COMMONMARK = /^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u;
/**
 * `commonmark_x`'s `KEY=VALUE`: no single-quoted value, and a bare value that may hold neither
 * quote and may not be EMPTY (Session 218). `{key=}` and `{key='a b'}` and `{key=v"al}` are all
 * stripped by the pandoc three and rendered as text here (`scratchpad/s218/cal/*_p16kvempty`,
 * `cal2/*_q03single`, `cal2/*_q18quote1`), while `{key=va\l}` and `{key=""}` are stripped by
 * both (`cal2/*_q14kvesc`, `cal3/*_r16qempty`).
 */
const ATTR_KEY_VALUE_COMMONMARK = /^[A-Za-z][^\s}#\\=]*=(?:"[^"]*"|[^\s}"']+)$/;
/**
 * A heading attribute block's content split into whitespace-separated tokens, **respecting
 * quotes** (Session 218).
 *
 * ⚠ **THE QUOTE AWARENESS IS THE POINT, AND TWO RENDERED DOCUMENTS ARE THE WHOLE REASON FOR IT.**
 * `{key="val"}` holds no space, so a naive `split(/\s+/)` handles it by accident; `{key="a b"}`
 * does, and quarto strips it under all four honouring readers (`scratchpad/s218/cal2/*_q01kvsp`).
 * A naive split sees `key="a` and `b"`, judges the block invalid, and stops stripping a block the
 * reader really strips — taking the `sec-q02` id of `cal2/*_q02mixsp` out of the cross-reference
 * index with it. Same role as Session 217's two non-ASCII probes: the corpus exists to make a
 * wrong design visible, and here it did.
 *
 * ⚠ A quote is honoured wherever it appears, not only after `=`, and an UNTERMINATED one simply
 * runs to the end of the block. `{key=v"al}` is stripped by the pandoc three, and it stays one
 * token either way — `ATTR_KEY_VALUE`'s bare-value alternative accepts the quote as content.
 */
function headingAttributeTokens(content: string, escapedSpaceJoins: boolean): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: string | null = null;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (quote !== null) {
      token += ch;
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    // ⚠ **AN ESCAPED SPACE DOES NOT END A TOKEN — BUT ONLY FOR THE READERS THAT ESCAPE ONE.**
    // `{key=a\ b}` is the ONE shape in 68 where the pandoc three disagree with each other, and
    // Session 217's escapable set is why: `\<space>` is a NON-BREAKING SPACE under Set A (no
    // `from:`, `markdown`) so the pair sits inside the value and quarto strips the block, while
    // `markdown_phpextra` reads a literal backslash and an ordinary space, which leaves a bare
    // `b` and no block at all (`scratchpad/s218/cal3/*_r22escsp`, four readers). This rule and
    // that one are coupled through exactly this line.
    if (escapedSpaceJoins && ch === "\\" && content[i + 1] === " ") {
      token += "\\ ";
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      token += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (token !== "") {
        tokens.push(token);
        token = "";
      }
      continue;
    }
    token += ch;
  }
  if (token !== "") {
    tokens.push(token);
  }
  return tokens;
}
/**
 * Whether `content` — the text BETWEEN a heading's trailing braces — really is a Pandoc
 * attribute block, rather than prose that merely ends in braces (Session 218).
 *
 * ⚠ **THE OVER-FIRE IS TWO-DIRECTIONAL AND ONE DIRECTION FABRICATES A CROSS-REFERENCE TARGET.**
 * `# Cal Alpha Prose {alpha beta}` renders `<h1>Cal Alpha Prose {alpha beta}</h1>` under every
 * reader that honours attributes — bare words are not attributes, so the braces are ordinary
 * text — and stripping them DELETES text the reader really sees. Sharper: `# Cal Id Esc
 * {#sec-a\:x}` renders the braces as text and defines **no id at all**, because `\` is not an
 * identifier character, while stripping it enters `sec-a\:x` in the `src/core/refs.ts` index —
 * a `sec-` label the rendered document never defines (`scratchpad/s218/cal/*_p13idesc`, with
 * `*_p14idcolon` — the same id without the backslash — as the agreeing control).
 *
 * ⚠ **Rejecting is the RISKIER direction and the predicate is written to reject only what is
 * measured.** `HEADING_ATTRIBUTE` is the only source of `Heading.id`, so a block wrongly called
 * invalid deletes a `sec-` target the user has a working cross-reference to today; a block
 * wrongly called valid merely reproduces the pre-Session-218 answer. Every rejection below
 * therefore stands on a rendered row.
 *
 * ⚠ **An EMPTY block is valid for the pandoc family and invalid for `commonmark_x`** — `{}` and
 * `{ }` are stripped by the pandoc three and rendered as text by `commonmark_x`
 * (`cal/*_p09empty`, `*_p10space`). That is why the token count is tested rather than only the
 * tokens.
 */
function headingAttributesValid(
  content: string,
  commonmarkDialect: boolean,
  pandocEscapes: boolean,
): boolean {
  const tokens = headingAttributeTokens(content, pandocEscapes);
  if (commonmarkDialect) {
    return (
      tokens.length > 0 &&
      tokens.every((t) => ATTR_ATOM_COMMONMARK.test(t) || ATTR_KEY_VALUE_COMMONMARK.test(t))
    );
  }
  return tokens.every((t) => ATTR_ATOM_RUN.test(t) || ATTR_KEY_VALUE.test(t));
}
/**
 * The characters a backslash may escape under **CommonMark 6.1** — the 32 ASCII punctuation
 * characters, and nothing else (Session 217).
 *
 * ⚠ **Measured, not transcribed from the spec.** `scratchpad/s217/cal2` renders all 32 against
 * `gfm`, one document each, and all 32 are escapable; `cal3` renders `\±` and `\€` against every
 * reader and the CommonMark family leaves BOTH literal, which is the boundary that makes this
 * "ASCII punctuation" rather than "punctuation".
 */
const ESCAPABLE_ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
/**
 * Markdown.pl's original escapable set — **plus `>`**, which is the one character the
 * documented set does not contain and the render says is escapable anyway (Session 217).
 *
 * ⚠ **16 characters, measured over the full 32 in `scratchpad/s217/cal2`** against BOTH
 * `markdown_strict` and `markdown_phpextra`, which return byte-identical sets. The other 16 stay
 * literal, and decoding them would DELETE a character those two readers really render — the
 * direction that costs text rather than adding it.
 */
const ESCAPABLE_LEGACY = /[!#()*+\-.>[\\\]_`{}]/;
/**
 * The characters a backslash may escape under pandoc's **`all_symbols_escapable`** — any
 * PUNCTUATION or SYMBOL, the non-ASCII ranges included (Session 217).
 *
 * ⚠ **This is a strict superset of `ESCAPABLE_ASCII_PUNCTUATION`, and the two are separated by
 * exactly two rendered documents.** `markdown` and `gfm` agree on ALL 32 ASCII punctuation
 * characters (`scratchpad/s217/cal2`, one document each), so three or thirty-two agreeing rows
 * would have justified merging them into one set. `cal3` renders `\±` and `\€` against every
 * one of the nine readers: `markdown`, `markdown_mmd`, `markdown_github` and the default reader
 * consume the backslash, and the CommonMark family does not. Those two probes exist only to make
 * a wrong merge visible, and they are the reason this file carries two sets instead of one.
 */
const ESCAPABLE_ALL_SYMBOLS = /[\p{P}\p{S}]/u;
/**
 * `text` with each backslash escape resolved the way this document's reader resolves it, or
 * `text` unchanged when it holds no backslash at all (Session 217).
 *
 * ⚠ **A LEFT-TO-RIGHT SCAN, WHICH IS WHAT MAKES PARITY FALL OUT FOR FREE.** `\\\\` is consumed as
 * one complete escape, so the character after it starts a fresh escape — which is exactly why
 * `# Cal Par2 Attr \\\\{#sec-par2}` renders `Cal Par2 Attr \` WITH the id and
 * `# Cal Par3 Attr \\\\\\{#sec-par3}` renders the braces literally (`scratchpad/s217/cal4`, the
 * `d_*` ladder, 0–3 backslashes × two constructs × three readers). A per-character rule cannot
 * express that; two lookbehinds in this file tried and both were wrong from two backslashes up.
 *
 * ⚠ **A backslash before a LETTER is never an escape** — CommonMark 6.1's "backslashes before
 * other characters are treated as literal backslashes", and pandoc agrees for every reader in
 * `cal/a_*_letter` but two. The obvious `\\\\(.)` -> `$1` gets this wrong on all nine readers at
 * once, which is why the escapable set is a membership test and not a wildcard.
 */
function decodeHeadingEscapes(text: string, escapable: RegExp, pandocEscapes: boolean): string {
  if (!text.includes("\\")) {
    return text;
  }
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = i + 1 < text.length ? text[i + 1] : null;
    if (next !== null && escapable.test(next)) {
      out += next;
      i++;
      continue;
    }
    // ⚠ TWO SET-A SPECIAL CASES THAT ARE NOT MEMBERS OF ANY ESCAPABLE SET, because a space is
    // not punctuation and end-of-text is not a character at all. Both measured across all nine
    // readers (`scratchpad/s217/cal4/e_*`): under pandoc `\<space>` is a NON-BREAKING SPACE and
    // a TRAILING `\` is a hard line break, while Sets B and C render both literally.
    //
    // ⚠ Neither is visible in any predecessor extractor column — all of them collapse
    // whitespace, so `a b`, `a\u00a0b` and `a\nb` read identically. That is why this session's
    // harness scores raw bytes, and why a naive `\\(.)` -> `$1` decode would have SCORED GREEN
    // on the nbsp row while producing an ordinary space.
    if (pandocEscapes && next === " ") {
      out += "\u00a0";
      i++;
      continue;
    }
    if (pandocEscapes && next === null) {
      // The hard break has nowhere to break to inside a heading, so quarto drops the backslash
      // and `trim()` below takes the space that preceded it (`e_md_hardbrk` renders
      // `Cal Hb Trailing`). ⚠ An EVEN run never reaches here: `\\` is consumed as one complete
      // escape above, which is why `# Cal Hb Even \\` keeps one literal backslash.
      continue;
    }
    out += c;
  }
  return out;
}
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
 * `frontMatterSelectsReader` documents for the `paragraphOpen` bail — so the measured
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
  tight = false,
): RegExpExecArray | null {
  const m = (tight ? ATX_HEADING_TIGHT : ATX_HEADING).exec(line);
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
  // ⚠ …and its REAL closer, `?>`, which the row above cannot reach: a processing instruction
  // does not close with `</?`, it closes with `?>`, and that begins with no `<` at all
  // (Session 205). `<?php echo 1;` / `?>` / `# End Inside` renders BOTH headings under
  // `from: markdown` — the block ENDS at the closer, so the heading below it is fresh —
  // and without this row the `?>` line is ordinary body that leaves a paragraph open.
  // ⚠ The gap was INVISIBLE until Session 205 restored the paragraph bail under an explicitly
  // declared reader: before that a `from:` key switched the bail off, the suppressed heading was
  // reported anyway, and the right answer came out for the wrong reason (`scratchpad/s204/end`
  // `e_md_pi_after`, re-scored against the new build).
  // ⚠ ALONE ON ITS LINE, and that is the measured boundary, not tidiness: `]]>` closes a CDATA
  // section the same way and must NOT be added beside it — `<![CDATA[` / `raw data` / `]]>` /
  // heading renders only the heading BELOW (`e_md_cdata_after`), so pandoc does not end that
  // block at its closer. Two closers, two answers; this list gets only the measured one.
  "|^ {0,3}\\?>[ \\t]*$" +
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
 * The two halves of `CONTENT_COLUMN_4_OPEN`, SPLIT because the readers differ per construct
 * (Session 209). The union above is retained and still tested — it is the right question
 * wherever the reader is not in play — but the container push now asks the two separately.
 *
 * ⚠ **They are independent, and that is measured rather than assumed.**
 * `scratchpad/s209/cal2` `ext_mdminusfn_def` renders the definition-list probe while
 * `ext_mdminusfn_fn` does not, on one reader (`markdown-footnotes`). One flag cannot express
 * that, so there are two predicates below rather than one "has containers" test.
 */
const FOOTNOTE_DEFINITION_OPEN = /^[ \t]*\[\^[^\]\s]+\]:/;
const DEFINITION_LIST_BODY_OPEN = /^[ \t]*[:~](?![:~])[ \t]/;
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
 * ⚠ **`FRONTMATTER_FROM_KEY` — the any-indent `from:` key regex — LIVED HERE AND IS GONE
 * (Session 207).** It was `/^[ \t]*(["']?)from\1[ \t]*:/`, and its docstring disclosed the
 * depth-blindness as deliberate: *"a `from: markdown` nested under `format:`/`  html:` … and an
 * `abstract: |` block scalar whose prose merely begins `from: …` both keep the phantom."*
 * Both of those sentences are now false, so the regex could not stay — whether a `from:`
 * selects the reader is a question about its YAML PATH, and no line regex can carry one.
 * See `frontMatterSelectsReader` below, which is the replacement and holds the measurement.
 *
 * The facts that regex's docstring recorded and that remain true are kept here, because each
 * is a rendered result no later session should have to re-measure:
 *
 * `blank_before_header` is a pandoc DEFAULT, not an invariant: a document that selects a
 * different reader dialect really does render a heading pressed against prose. Measured on
 * the real render path — `markdown-blank_before_header`, `markdown_strict`, `gfm` and
 * `commonmark` each render the heading, while plain `markdown` and no key at all do not.
 *
 * `reader:` is deliberately not a spelling of this key — quarto REJECTS it outright (exit 1),
 * so no such document ever renders a heading to agree with.
 *
 * ⚠ **The key may be QUOTED, and Session 206 measured that quarto honours it.** YAML permits a
 * quoted key anywhere a plain one is allowed, so `"from": gfm` and `'from': gfm` really do
 * select gfm — `scratchpad/s206/gnd` `g_qkeyd_gfm` / `g_qkeys_gfm` render the pressed heading.
 * `TOP_LEVEL_FROM_KEY` below carries the quote capture that expresses it.
 */
/**
 * The line that OPENS a YAML **flow mapping** — `{from: gfm, title: "T"}`.
 *
 * A whole front matter may legally be one flow mapping, and quarto reads the `from:` in it:
 * `scratchpad/s206/gnd` `g_flow_gfm` renders the pressed heading and `g_flow_markdown` does
 * not, which is what proves the mapping is being READ rather than ignored. `TOP_LEVEL_FROM_KEY`
 * is anchored to the start of the key, so a key sitting after `{` or `,` is invisible to it.
 *
 * ⚠ **TOMBSTONE — Session 208 removed the two patterns that used to sit beside this one**,
 * `FRONTMATTER_FLOW_FROM_KEY` (`/[{,][ \t]*(["']?)from\1[ \t]*:/`) and `FLOW_FROM_ENTRY` (the
 * same with `([^,}]*)` capturing the value). Their measurement above is still true and is kept
 * here; what was false was the assumption underneath them — that a `from:` ANYWHERE inside a
 * flow mapping is the document's reader declaration. Both were flat, so both took the FIRST
 * `from:` on the line regardless of its PATH, and `scratchpad/s208/cal3` renders them wrong in
 * BOTH directions on six of eight rows: `{title: t, params: {from: markdown}, from: gfm}`
 * renders as gfm (they read markdown — a DELETED heading) and `{title: t, params: {from: gfm}}`
 * renders as the default (they read gfm — an INVENTED one). ⚠ **Do not reintroduce a flat flow
 * pattern.** `flowPathValue` below answers the same question by walking the path, which is what
 * the measurement says decides it.
 */
const FRONTMATTER_FLOW_OPEN = /^[ \t]*\{/;
/**
 * A front-matter `from:` whose VALUE names a reader of the **CommonMark family** (Session 202).
 *
 * ⚠ **This is a different question from `frontMatterSelectsReader` below and must stay one,
 * because the two rows fail in OPPOSITE directions.** That one keys on the key's POSITION and
 * never resolves the value: for the ATX row the cost of firing on a document that is not
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
 * ⚠ **ANCHORED AT THE FRONT MATTER'S OWN TOP LEVEL — never at an arbitrary indent. Found by a
 * BLIND adversarial lens that had seen none of Session 202's corpora,
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
 * regex. ⚠ **SESSION 207 CLOSED THIS, and the paragraph above is now history rather than a
 * live trade:** `perFormatBlock` resolves `format:`/`html:`/`from:` as a real path and
 * `frontMatterSelectsReader` refuses `params:`, so the value predicate is reached for the
 * former and not for the latter. What it needed was a path, not a parser.
 *
 * ⚠ A `from:` in a PROJECT file (`_quarto.yml`) is invisible here, exactly as it is to
 * `frontMatterSelectsReader`: this scanner sees one document's bytes. Such a document keeps the
 * default-dialect rule, which is the non-deleting direction.
 */
const FRONTMATTER_COMMONMARK_FROM =
  /^from[ \t]*:[ \t]*["']?(?:commonmark(?:_x)?|gfm)(?![a-zA-Z0-9_])/;
/**
 * A front-matter `from:` whose base reader is **exactly `markdown`**, with any extension list —
 * the one base measured to carry `blank_before_header` by DEFAULT (Session 205).
 *
 * ⚠ **`markdown` and nothing that merely starts with it.** The extension list is `[+-]name`
 * repeated, so `markdown_strict` cannot match: `_strict` is neither an extension nor a
 * terminator. That is not a stylistic choice — `markdown_strict`, `markdown_mmd`,
 * `markdown_phpextra` and `markdown_github` are each MEASURED to render a heading pressed
 * against prose (`scratchpad/s205/gnd` `g_mdstrict_prose`, `g_mdmmd_prose`, `g_mdphp_prose`,
 * `g_mdgh_prose`), so a prefix match DELETES four readers' worth of real headings. Pandoc
 * documents `markdown_github` as a deprecated synonym for `gfm` and it behaves like neither
 * `gfm` nor `markdown` on this row — a classifier reasoning from the NAME gets it wrong.
 *
 * The quote is captured and back-referenced so `"markdown"` and `'markdown'` resolve while a
 * half-quoted `"markdown` does not; a trailing YAML comment is consumed. `from:markdown` with
 * no space is absent because quarto REJECTS it (exit 1, `spl` `s_nospace`), so it has no
 * heading truth — the same reasoning `reader:` and upper-case `GFM` get elsewhere in this file.
 */
const FRONTMATTER_MARKDOWN_BASE_FROM =
  /^from[ \t]*:[ \t]*(["']?)markdown(?:[+-][a-zA-Z_]+)*\1[ \t]*(?:#.*)?$/;
/**
 * The same, for the four `markdown_*` bases measured WITHOUT `blank_before_header`. Matched
 * only so `+blank_before_header` can be honoured on them (Session 205) — on its own this
 * predicate must never fire the bail.
 */
const FRONTMATTER_MARKDOWN_VARIANT_FROM =
  /^from[ \t]*:[ \t]*(["']?)markdown(?:_strict|_mmd|_phpextra|_github)(?:[+-][a-zA-Z_]+)*\1[ \t]*(?:#.*)?$/;
/**
 * A `from:` whose extension list turns `blank_before_header` ON, and one that turns it OFF.
 *
 * ⚠ **The extension outranks the base, in BOTH directions, and both directions are measured.**
 * `markdown+emoji-blank_before_header` renders the pressed heading (`spl` `s_offlast`) and so
 * does `markdown-blank_before_header+emoji` (`s_offfirst`), so position in the list is
 * irrelevant; and `markdown_strict+blank_before_header` SUPPRESSES it (`gnd` `g_strictbbh_*`)
 * on a base that renders it unadorned. A rule keyed on the base name alone is wrong four ways.
 *
 * ⚠ These two scan the whole VALUE rather than parsing the list, which is why each is paired
 * with a base predicate above: alone, `+blank_before_header` would fire on `gfm`, where quarto
 * REFUSES to render at all (exit 1, all 12 such documents in `gnd`) and there is no truth.
 */
const FRONTMATTER_FROM_ENABLES_BLANK_BEFORE_HEADER =
  /^from[ \t]*:.*\+blank_before_header(?![a-zA-Z0-9_])/;
const FRONTMATTER_FROM_DISABLES_BLANK_BEFORE_HEADER =
  /^from[ \t]*:.*-blank_before_header(?![a-zA-Z0-9_])/;
/**
 * Whether this front-matter line declares a reader that keeps pandoc's `blank_before_header`,
 * so an ATX heading pressed against an open paragraph is not a heading (Session 205).
 *
 * ⚠ **The safety polarity is the INVERSE of Session 204's.** That session's change deleted
 * headings, so its opener set had to be narrow. This one RESTORES a suppression that the mere
 * presence of a `from:` key had been switching off, so returning `true` for a reader that does
 * NOT have the extension DELETES a real heading. Hence exact measured bases only, and every
 * unmeasured spelling falls through to today's behaviour — a phantom, this project's permitted
 * direction.
 */
function fromKeepsBlankBeforeHeader(line: string): boolean {
  if (FRONTMATTER_FROM_DISABLES_BLANK_BEFORE_HEADER.test(line)) {
    return false;
  }
  if (FRONTMATTER_MARKDOWN_BASE_FROM.test(line)) {
    return true;
  }
  return (
    FRONTMATTER_MARKDOWN_VARIANT_FROM.test(line) &&
    FRONTMATTER_FROM_ENABLES_BLANK_BEFORE_HEADER.test(line)
  );
}
/**
 * The five bases MEASURED to render a trailing `{…}` on a heading as ORDINARY TEXT, because they
 * do not carry pandoc's `header_attributes` (Session 216). `scratchpad/s216/cal`, 63 documents,
 * nine readers × seven shapes, every reader with its own plain control:
 *
 *   HONOURS THE BLOCK   no `from:` at all · `markdown` · `markdown_phpextra` · `commonmark_x`
 *   RENDERS IT LITERAL  `markdown_strict` · `markdown_mmd` · `markdown_github` · `gfm`
 *                       · `commonmark`
 *
 * ⚠ **A 4–5 split, and it is NOT `FRONTMATTER_COMMONMARK_FROM` — reusing that flag would have
 * been precisely, not approximately, wrong.** That predicate matches `commonmark`, `commonmark_x`
 * and `gfm`, and on THIS question `commonmark_x` sits with `markdown` while the other two do
 * not. Sessions 214 and 215 each measured a 6–3 split that WAS that flag; a third session
 * assuming the pattern repeats gets four readers wrong in the deleting direction.
 *
 * ⚠ **`markdown_github` behaves like `gfm` here — the OPPOSITE of the trap that caught Sessions
 * 214 and 215.** Both of those found it on the far side from `gfm` and both recorded "a table
 * reasoned from the base name puts that row on the wrong side". On this extension the base name
 * is right and the remembered LEARNING is what misleads. Render the row; do not recall it.
 *
 * ⚠ `commonmark` may not swallow `commonmark_x`, hence the trailing boundary — the one-character
 * difference between the two is the whole 4–5 split.
 */
const FRONTMATTER_HEADER_ATTRIBUTES_OFF_FROM =
  /^from[ \t]*:[ \t]*["']?(?:markdown_(?:strict|mmd|github)|gfm|commonmark)(?![a-zA-Z0-9_])/;
/**
 * The `header_attributes` lever in a `from:` extension list, with the sign captured so the LAST
 * occurrence can decide. Two spellings control one behaviour: the pandoc markdown family names it
 * `header_attributes`, the commonmark/gfm family `attributes` — both MEASURED
 * (`scratchpad/s216/cal3`, 24 documents, eight extension spellings, all quarto exit 0).
 *
 * ⚠ **`[+-]` immediately before the name is what keeps `attributes` from matching INSIDE
 * `header_attributes`.** Without that anchor, `markdown-header_attributes` reads as an enabling
 * `attributes` token and the rule inverts.
 */
const FRONTMATTER_FROM_HEADER_ATTRIBUTES_TOKEN = /([+-])(?:header_)?attributes(?![a-zA-Z0-9_])/g;
/**
 * The two readers measured to escape only **Markdown.pl's 16 characters** rather than the full
 * ASCII punctuation range — see `ESCAPABLE_LEGACY` (Session 217).
 *
 * ⚠ **`markdown_phpextra` sits here and `markdown_mmd` does NOT, and I predicted the opposite.**
 * `scratchpad/s217/cal`, nine readers × seven probes with a plain control each: the count (7-2)
 * was right and the MEMBERSHIP was wrong on two of nine. A predicate written from the prediction
 * would have decoded 16 characters `markdown_phpextra` renders literally, and kept 16 that
 * `markdown_mmd` consumes — wrong in both directions at once.
 *
 * ⚠ `markdown` may not swallow `markdown_strict`/`markdown_phpextra`, hence the trailing
 * boundary; and `markdown_github` is deliberately ABSENT — it is on `markdown`'s side here, the
 * fifth consecutive session that reader splits from the name it is documented as a synonym for.
 */
const READER_ESCAPES_ALL_SYMBOLS: ReadonlySet<string> = new Set([
  "markdown",
  "markdown_mmd",
  "markdown_github",
]);
/**
 * Whether the resolved `from:` names a reader carrying pandoc's `all_symbols_escapable`, so a
 * backslash escapes any punctuation OR symbol rather than a fixed ASCII list (Session 217).
 *
 * ⚠ **Consulted only for readers OUTSIDE the CommonMark family** — `commonmarkDialect` answers
 * those, and quarto REFUSES `gfm+all_symbols_escapable` outright (exit 1,
 * `scratchpad/s217/cal5/k3_gfm_on`), so the extension cannot reach them anyway.
 *
 * ⚠ **`markdown_phpextra` is absent and `markdown_mmd` is present, and I predicted the
 * opposite.** `scratchpad/s217/cal`, nine readers × seven probes each with its own plain control:
 * the 7-2 COUNT was right and the MEMBERSHIP was wrong on two of nine. A predicate written from
 * the prediction would have decoded 16 characters `markdown_phpextra` renders literally — the
 * text-DELETING direction — and kept 16 that `markdown_mmd` consumes.
 *
 * ⚠ `markdown_github` is here, on `markdown`'s side, for the FIFTH consecutive session in which
 * this reader does not follow the name pandoc documents it as a synonym for.
 *
 * ⚠ **The default is TRUE**, so it takes `fromValueLine` itself rather than the `!== null &&`
 * idiom most flags in this file use: a document with no `from:` at all is the default reader,
 * which `cal/a_none_*` measures as Set A.
 */
function fromEscapesAllSymbols(line: string | null): boolean {
  if (line === null) {
    return true;
  }
  // LAST occurrence wins, via the shared `fromExtensionState` — re-measured for THIS extension
  // in both orders rather than inherited: `markdown-all_symbols_escapable+all_symbols_escapable`
  // escapes a non-ASCII symbol (`cal5/k5_md_offon`) and
  // `markdown+all_symbols_escapable-all_symbols_escapable` does not (`k6_md_onoff`).
  // ⚠ A DISABLED reader falls through to the BASE-NAME answer below, which for every pandoc base
  // is Set C — measured on the four characters that separate Set C from Set B (`cal6`), not
  // assumed from the base's own default.
  const state = fromExtensionState(line, "all_symbols_escapable");
  if (state !== null) {
    return state;
  }
  const base = fromReaderBase(line);
  return base === null ? true : READER_ESCAPES_ALL_SYMBOLS.has(base);
}
/**
 * The escapable set this document's reader uses — the three-way resolution measured in
 * `scratchpad/s217/cal`, `cal2` and `cal3` (Session 217). Mirrors `atxClosingRun`'s shape one
 * question over: a per-reader choice between constants, resolved at the call site where both
 * flags are live.
 */
function headingEscapable(commonmarkDialect: boolean, allSymbolsEscapable: boolean): RegExp {
  return commonmarkDialect
    ? ESCAPABLE_ASCII_PUNCTUATION
    : allSymbolsEscapable
      ? ESCAPABLE_ALL_SYMBOLS
      : ESCAPABLE_LEGACY;
}
/**
 * Whether the resolved `from:` line names a reader that honours a trailing heading ATTRIBUTE
 * block, so `# Methods {#sec-methods}` is a heading named "Methods" carrying the id `sec-methods`
 * rather than a heading whose text literally ends in braces (Session 216).
 *
 * ⚠ **The extension OUTRANKS the base, in both directions, and LAST WINS — all four measured**
 * (`cal3`): `markdown-header_attributes` renders the braces literally on a base that strips,
 * `markdown_strict+header_attributes` strips on a base that does not, and the two duplicate-token
 * spellings disagree with each other in the way only a last-wins rule explains —
 * `markdown-header_attributes+header_attributes` STRIPS while
 * `markdown+header_attributes-header_attributes` does NOT.
 *
 * ⚠ **The last-wins scan is deliberate rather than copied.** `fromKeepsBlankBeforeHeader` above
 * takes the FIRST disabling token it sees, which `BACKLOG.md` still carries as an open defect
 * found by a blind lens. Copying its shape would have shipped that same bug one constant over, so
 * this walks the whole value and keeps the final sign.
 *
 * ⚠ **The safety polarity: this is keyed on a POSITIVE resolution of a reader measured to render
 * the block LITERALLY, never on the absence of one.** Returning `false` for a reader that does
 * honour the block would keep braces in a title the reader never sees AND drop a real `sec-`
 * cross-reference target. Every unmeasured spelling — an unresolvable `from:`, a project-level
 * `_quarto.yml`, a reader outside these nine — therefore falls through to today's behaviour.
 */
function fromHonoursHeaderAttributes(line: string | null): boolean {
  if (line === null) {
    return true;
  }
  let last: string | null = null;
  FRONTMATTER_FROM_HEADER_ATTRIBUTES_TOKEN.lastIndex = 0;
  for (
    let m = FRONTMATTER_FROM_HEADER_ATTRIBUTES_TOKEN.exec(line);
    m !== null;
    m = FRONTMATTER_FROM_HEADER_ATTRIBUTES_TOKEN.exec(line)
  ) {
    last = m[1];
  }
  if (last !== null) {
    return last === "+";
  }
  return !FRONTMATTER_HEADER_ATTRIBUTES_OFF_FROM.test(line);
}
/**
 * Whether the resolved `from:` line names a reader of the **pandoc markdown family**, every
 * member of which is MEASURED to give an ATX heading NO column tolerance at all (Session 206).
 *
 * ⚠ **This is the third question a resolved `from:` answers, and it is not either of the other
 * two.** `fromKeepsBlankBeforeHeader` asks about one EXTENSION and splits this same family down
 * the middle; this asks about the BASE, and every base below behaves alike. Measured over the 56
 * documents of `scratchpad/s206/col` and `scratchpad/s206/col2` (reader × indent 0-3):
 * `commonmark`, `commonmark_x` and `gfm` render a heading at columns 0, 1, 2 and 3, while
 * `markdown`, `markdown+emoji`, `markdown_strict`, `markdown_mmd`, `markdown_github`,
 * `markdown_phpextra` — and no front matter at all — render one at column 0 ONLY.
 *
 * ⚠ **Keyed on a POSITIVE resolution, never on the absence of one, and that is what keeps it
 * from deleting.** The column set it narrows is otherwise relaxed by the mere PRESENCE of a
 * `from:` key, including keys this scanner cannot resolve (a nested per-format `from:`, which
 * quarto really does honour — `scratchpad/s206/cmk` `c_nested`). Narrowing on "not resolved to
 * CommonMark" would delete the heading those documents render; narrowing on "resolved to a
 * measured markdown base" cannot, because an unresolved document takes neither branch.
 *
 * ⚠ `markdown_strict` is in the list on a RE-MEASUREMENT. Its first grid row read "no heading at
 * any column", which is an extractor artifact rather than a rule: strict turns
 * `intraword_underscores` off, so the underscore-bearing document names in the heading text
 * became `<em>` and the nesting-safe extractor could not match them. `scratchpad/s206/ctl2` is
 * the feature-free control pair that showed it — the underscore-free twin renders normally.
 */
function fromIsMarkdownFamily(line: string): boolean {
  return FRONTMATTER_MARKDOWN_BASE_FROM.test(line) || FRONTMATTER_MARKDOWN_VARIANT_FROM.test(line);
}
/**
 * A resolved `from:` split into its BASE reader name and its EXTENSION list (Session 209).
 *
 * The predicates above each answer their question with a pair of whole-value regexes. This row
 * needs the two parts separately, because the same extension name has to be read against
 * several bases and two DIFFERENT extensions have to be read against the same base — see
 * `fromHasDefinitionLists` and `fromHasFootnotes`, which are independent of each other.
 */
const FRONTMATTER_FROM_READER_VALUE =
  /^from[ \t]*:[ \t]*(["']?)([a-zA-Z][a-zA-Z0-9_]*)((?:[+-][a-zA-Z_]+)*)\1[ \t]*(?:#.*)?$/;
/** The base reader name of a resolved `from:`, or null if the value is not a reader name. */
function fromReaderBase(line: string): string | null {
  const m = FRONTMATTER_FROM_READER_VALUE.exec(line);
  return m === null ? null : m[2];
}
/**
 * Whether `extension` is turned ON (`true`), OFF (`false`) or left alone (`null`) by the
 * extension list of a resolved `from:`.
 *
 * ⚠ **LAST occurrence wins.** `BACKLOG: the extension list is LAST-WINS` measured that on the
 * sibling `blank_before_header` row — `markdown-blank_before_header+blank_before_header` takes
 * the second token — and this session re-measured it for `definition_lists` in both orders
 * (`scratchpad/s209/adv` `x_deflast`, `x_deffirst`). It costs nothing to honour here and a
 * first-wins loop would be wrong on a value quarto accepts.
 */
function fromExtensionState(line: string, extension: string): boolean | null {
  const m = FRONTMATTER_FROM_READER_VALUE.exec(line);
  if (m === null) {
    return null;
  }
  let state: boolean | null = null;
  for (const token of m[3].match(/[+-][a-zA-Z_]+/g) ?? []) {
    if (token.slice(1) === extension) {
      state = token[0] === "+";
    }
  }
  return state;
}
/**
 * The eight reader BASES whose container constructs this project has measured, and which of
 * them carry each construct (Session 209, `scratchpad/s209/cal` and `cal2`, quarto 1.7.33).
 *
 * ⚠ **A CLASSIFIER MAY NOT REASON FROM THE NAME, and two rows below are why.**
 * `markdown_github` and `markdown_strict` are both spelled `markdown_*`: the first has
 * footnotes and NO definition lists, the second has neither. `gfm` and `commonmark` are both
 * CommonMark-family: the first has footnotes, the second does not. Any grouping coarser than
 * the base name itself gets at least one of these four backwards, and two of the four are the
 * heading-DELETING direction.
 *
 *     reader              definition lists   footnotes
 *     markdown  (= no `from:` key at all)    YES   YES
 *     gfm                        no                YES
 *     commonmark                 no                no
 *     commonmark_x              YES                YES
 *     markdown_strict            no                no
 *     markdown_mmd              YES                YES
 *     markdown_phpextra         YES                YES
 *     markdown_github            no                YES
 *
 * `ctl/k_key` against `ctl/k_nokey` is the feature-free control pair proving `from: markdown`
 * and no key at all are the same reader on this question, in both directions.
 */
const MEASURED_READER_BASES: ReadonlySet<string> = new Set([
  "markdown",
  "gfm",
  "commonmark",
  "commonmark_x",
  "markdown_strict",
  "markdown_mmd",
  "markdown_phpextra",
  "markdown_github",
]);
const READER_HAS_DEFINITION_LISTS: ReadonlySet<string> = new Set([
  "markdown",
  "commonmark_x",
  "markdown_mmd",
  "markdown_phpextra",
]);
const READER_HAS_FOOTNOTES: ReadonlySet<string> = new Set([
  "markdown",
  "gfm",
  "commonmark_x",
  "markdown_mmd",
  "markdown_phpextra",
  "markdown_github",
]);
/**
 * Whether the reader this document declares HAS the construct, so a line spelling it really
 * opens a container (Session 209).
 *
 * ⚠ **The polarity is the one Session 206 paid for: keyed on a POSITIVE resolution, never on
 * the absence of one.** Returning `false` REMOVES a content column, which lowers the code base
 * so the container's own content becomes INDENTED CODE and its heading is DELETED. So an
 * unresolvable value and an unmeasured base both return `true` — today's unconditional push,
 * which costs a phantom, this project's permitted direction. Only the eight measured bases can
 * reach the narrowing branch.
 *
 * ⚠ **The EXTENSION is read before the base and OUTRANKS it, in BOTH directions.** Measured
 * on both constructs and on bases that answer either way (`scratchpad/s209/cal2`):
 * `gfm+definition_lists` renders the probe and `markdown-definition_lists` does not;
 * `commonmark+footnotes` renders it and `gfm-footnotes` does not. A predicate keyed on the base
 * name alone is wrong four ways, and two of those four DELETE.
 */
function fromHasConstruct(
  line: string,
  extension: string,
  bases: ReadonlySet<string>,
): boolean {
  const base = fromReaderBase(line);
  if (base === null || !MEASURED_READER_BASES.has(base)) {
    return true;
  }
  const state = fromExtensionState(line, extension);
  return state !== null ? state : bases.has(base);
}
/** Whether the declared reader has definition lists, so `:   x` / `~   x` opens a container. */
function fromHasDefinitionLists(line: string): boolean {
  return fromHasConstruct(line, "definition_lists", READER_HAS_DEFINITION_LISTS);
}
/** Whether the declared reader has footnotes, so `[^1]: x` opens a container. */
function fromHasFootnotes(line: string): boolean {
  return fromHasConstruct(line, "footnotes", READER_HAS_FOOTNOTES);
}
/**
 * The bases that keep pandoc's `space_in_atx_header`, so `#Heading` with NO separator is NOT a
 * heading there (Session 212). Measured one document per reader, each carrying its own spaced
 * control heading — `scratchpad/s212/cal` `a_none`, `a_md`, `a_gfm`, `a_cm`, `a_cmx`, `a_gh`
 * (all refuse the tight hash) against `a_strict`, `a_mmd`, `a_php` (all render it).
 *
 * ⚠ **THE BACKLOG ITEM NAMED THREE READERS AND THERE ARE FOUR — and a fourth `markdown_*`
 * reader answers the OPPOSITE way.** `markdown_phpextra` accepts the tight hash and no session
 * had measured it (confirmed on a second shape, `cal2/k1_lvl2_php`); `markdown_github` is
 * spelled like the three that accept and REFUSES (second shape, `cal2/k2_lvl2_gh`). This is
 * Session 209's trap in a new place: a classifier may not reason from the name.
 *
 * ⚠ **The extension is INVALID on every CommonMark base — quarto REFUSES the document, exit 1**
 * (`cal/b2_cmx_off`, `b7_gfm_off`, `b8_cm_off`). Those documents have no heading truth, so they
 * are deliberately NOT special-cased here: a document that never renders has no answer to be
 * wrong about. Recorded so the silence is not read as an oversight.
 */
const READER_HAS_SPACE_IN_ATX_HEADER: ReadonlySet<string> = new Set([
  "markdown",
  "gfm",
  "commonmark",
  "commonmark_x",
  "markdown_github",
]);
/**
 * Whether the declared reader requires a space between the hashes and the text.
 *
 * ⚠ **The fail-safe direction is `true`, which is today's behaviour**, and `fromHasConstruct`
 * already has exactly that polarity: an unresolvable value and an unmeasured base both return
 * `true`, so the separator stays required and nothing is invented. Only the eight measured bases
 * can reach the widening branch (Learning #327 — key a widening on what you proved).
 *
 * ⚠ **The EXTENSION outranks the base in BOTH directions and the LAST occurrence wins**, measured
 * here rather than inherited: `markdown-space_in_atx_header` accepts (`cal/b1_md_off`) and
 * `markdown_github-space_in_atx_header` accepts (`cal2/j1_gh_off`), while
 * `markdown_strict/_mmd/_phpextra+space_in_atx_header` all refuse (`cal/b3_strict_on`,
 * `b4_mmd_on`, `cal2/j2_php_on`). Both orders of a repeated token were rendered:
 * `-space…+space…` refuses (`cal/b5_md_offon`) and `+space…-space…` accepts (`cal/b6_md_onoff`).
 */
function fromRequiresSpaceInAtxHeader(line: string): boolean {
  return fromHasConstruct(line, "space_in_atx_header", READER_HAS_SPACE_IN_ATX_HEADER);
}
/**
 * The bases on which `yaml_metadata_block` is a REAL extension, so a mid-document YAML block can
 * be CONSUMED as metadata and render nothing at all (Session 213, `scratchpad/s213/cal`).
 *
 * ⚠ **This is NOT the `fromHasConstruct` shape, and the row that says so is `cal/a12_gfm_ymbon`.**
 * Every other per-reader predicate in this file reads the extension FIRST and lets it outrank the
 * base unconditionally, because that is how the constructs those predicates model behave. Here the
 * extension is **inert on a CommonMark base**: `gfm+yaml_metadata_block` (`cal/a12`),
 * `commonmark_x+yaml_metadata_block` (`cal2/c5_ext`) and `commonmark+yaml_metadata_block`
 * (`cal3/f_cm_ymbon`) all still RENDER the block as a setext heading, while the identical
 * `+yaml_metadata_block` turns consumption ON for `markdown_strict` (`cal2/c4_ext`),
 * `markdown_mmd` (`cal2/c6_ext`), `markdown_phpextra` (`cal3/f_php_ymbon`) and `markdown_github`
 * (`cal3/f_gh_ymbon`). Calling `fromHasConstruct` here would suppress three headings quarto
 * renders — the DELETING direction — so this set gates the extension rather than the reverse.
 */
const READER_CAN_CONSUME_METADATA_BLOCK: ReadonlySet<string> = new Set([
  "markdown",
  "markdown_strict",
  "markdown_mmd",
  "markdown_phpextra",
  "markdown_github",
]);
/**
 * Whether the resolved reader CONSUMES a mid-document YAML metadata block, so quarto renders
 * nothing for it (Session 213). `null` means the document declares no `from:` this scanner can
 * resolve, which includes the commonest case of all — no `from:` key at all.
 *
 * ⚠ **The fail-safe direction is `false`, and it is the opposite of every sibling predicate's.**
 * Those model heading-DELETING rules, where "report it anyway" is safe. This one is
 * heading-FABRICATING: returning `true` wrongly REMOVES a section a reader really sees, and its
 * `sec-` id with it. So an unresolvable value and an unmeasured base both return `false` — today's
 * answer, which costs a phantom, this project's permitted direction.
 *
 * ⚠ **`null` is the ONE input that returns `true`**, because it is measured rather than assumed:
 * `cal/a01_nofm` and `cal2/d9_nofm_note` carry no `from:` key and quarto consumes the block in
 * both, matching `from: markdown` exactly (`cal/a02_md`). `cal/b01_nofm_ctl` is the feature-free
 * control that renders under the same absent key.
 *
 * ⚠ **The value is the RESOLVED one, including a mid-document block's own `from:`** — the caller
 * passes `frontMatterFromValueLine`, which routes through `governingMetadataContent` (Session
 * 211). Measured in both directions: `cal2/d7_selects_gfm` has a block whose `from: gfm` selects a
 * reader that does NOT consume, so the block renders ITSELF; `cal2/d8_selects_md` has one whose
 * `from: markdown` does consume, so it disappears.
 *
 * ⚠ **`-yaml_metadata_block` returns `false` even though quarto still renders no heading there**,
 * and that is deliberate. With the extension off, plain `markdown` parses the block as a MULTILINE
 * TABLE — read firsthand out of `cal/a10_md_ymboff`'s HTML — so the right answer is reached by a
 * mechanism this rule does not model. `cal2/c3_ext` proves that mechanism switches off: with
 * `multiline_tables` and `simple_tables` also removed, the heading RENDERS. Suppressing on the
 * base name alone would be right at `a10` for the wrong reason and wrong at `c3`. Three rows carry
 * a phantom for this (`a10`, `cal2/c1_ext`, `cal3/f_md_onoff`); all three are disclosed.
 */
function fromConsumesMetadataBlock(line: string | null): boolean {
  if (line === null) {
    return true;
  }
  const base = fromReaderBase(line);
  if (base === null || !READER_CAN_CONSUME_METADATA_BLOCK.has(base)) {
    return false;
  }
  // LAST occurrence wins, as `fromExtensionState` documents — re-measured for this extension in
  // both orders: `markdown-yaml_metadata_block+yaml_metadata_block` consumes (`cal3/f_md_offon`)
  // and `markdown+yaml_metadata_block-yaml_metadata_block` does not (`cal3/f_md_onoff`).
  const state = fromExtensionState(line, "yaml_metadata_block");
  // Only `markdown` carries the extension by DEFAULT; the other four bases in the set above need
  // it written on (`cal/a06`–`a09` all render the block, `cal2/c4`/`c6` and `cal3/f_php`/`f_gh`
  // all consume it once `+yaml_metadata_block` is added).
  return state !== null ? state : base === "markdown";
}
/**
 * Whether recognising `line` as a TIGHT ATX heading would make this model's answer WORSE than
 * reporting nothing — in which case the tight form is declined and today's answer is reproduced
 * byte for byte (Session 212).
 *
 * ⚠ **This keeps the change PURELY ADDITIVE at the cost of measured rows, which is Session 210's
 * Headline 4 applied to a different rule.** Each shape below is a document quarto renders WITH a
 * heading, so declining leaves the row wrong — but ACCEPTING would report a heading whose TEXT is
 * wrong, turning one error into two. Every shape is a SEPARATE, pre-existing defect proven by its
 * SPACED twin, which diverges today with no help from this change:
 *
 *   `next` is a SETEXT UNDERLINE — the underline outranks the ATX heading and keeps the literal
 *        `#` in its text: `#Cal Tight Underlined` / `===` renders `h1:#Cal Tight Underlined`
 *        (`cal/e1_setext_strict`), which the pre-session build already produces by the accident
 *        that its ATX row cannot match. Pre-existing on the spaced twin under `markdown` itself
 *        (`cal2/f1_setext_sp_md`, `f2`, `f4`). ⚠ The column test is what BOUNDS it: a `   ===`
 *        at column 3 is not an underline here and quarto renders the ATX heading
 *        (`cal3/m3_indent_underline`), so keying on this model's own underline predicate is
 *        what keeps the decline from over-firing. It is deliberately NOT gated on
 *        `consecutiveBody`: with prose above, this model's setext cannot fire and quarto still
 *        renders `h1:#Cal Tight Underlined` (`cal3/m1_prose_setext_strict`), so accepting there
 *        would be wrong a second way.
 * ⚠ **THE OTHER TWO CLAUSES ARE GONE, AND BOTH REMOVALS ARE FIXES MEASURED PER SHAPE RATHER THAN
 * A TIDY-UP** (Session 217). Each existed only because this model's TEXT was wrong in a way that
 * is no longer wrong, so declining had stopped buying anything and was costing rendered rows:
 *
 *   a trailing ATTRIBUTE BLOCK — declined because the strip was unconditional. Session 216 made
 *        it per-reader, which left this clause reachable for exactly ONE reader:
 *        `markdown_phpextra`, the only one with BOTH a tight ATX row (`space_in_atx_header` off)
 *        and attribute honouring. There it was pure loss — `scratchpad/s217/pin/p5_tightattr_php`
 *        renders `h1:Cal Tight Attr` **and defines `id="sec-tightattr"`**, and `p6_tightattrsp_php`
 *        likewise, so removing the clause recovers the cross-reference target too. For
 *        `markdown_strict` and `markdown_mmd` the clause could not fire at all after S216, since
 *        those readers do not honour the block (`p5_tightattr_{strict,mmd}` keep the braces and
 *        are unchanged).
 *   an ESCAPED trailing HASH RUN — declined because accepting reported `Cal Tight Esc\#` where
 *        quarto renders `Cal Tight Esc#`: "one error becoming two" (Learning #348), correct
 *        reasoning for a model that processed no escapes. `decodeHeadingEscapes` makes the
 *        accepted text byte-exact, so the decline became pure loss on all three tight readers
 *        (`pin/p4_tightesc_{strict,mmd,php}`).
 *
 * ⚠ **The removal is what made the parity widening SAFE, and the order matters.** Making
 * `HEADING_ATTRIBUTE` even-parity newly matches `#Cal Tg2 Attr \\{#sec-tg2}`, which under
 * `markdown_phpextra` would have made this function DECLINE a heading quarto renders — a
 * heading-DELETING regression, and the identical shape that cost Session 216 three commits on
 * this very function. It was found here BEFORE the widening landed, by rendering the call site's
 * own 18-document corpus (`scratchpad/s217/tight`) rather than by trusting a green suite: all
 * 2052 unit tests passed while that row was deleted.
 */
/**
 * Whether the line BELOW an ATX heading is a setext underline that SWALLOWS it — in which case
 * the ATX row must decline and the setext row below claims the very same line (Session 214).
 *
 * `# Cal Alpha Above` / `===` renders **`<h1># Cal Alpha Above</h1>`**: pandoc tries its setext
 * parser first, so the underline claims the ATX line, the UNDERLINE's spelling sets the level
 * (`=` → 1, `-` → 2, so `###### x` / `---` is an **h2**), and the literal `#` survives into the
 * heading's TEXT. Session 182 measured this at column 0 and DECLINED it; Session 199 measured it
 * inside a container and deferred it in `SETEXT_UNDERLINE_RUN`'s own docstring — *"reversing
 * S182's choice is a separate capability"*. This is that capability.
 *
 * ⚠ **THE WHOLE DELIVERABLE IS THE DECLINE. Nothing downstream needed changing, and that is a
 * measured fact rather than a happy accident.** `parseSetextHeadingLine` passes
 * `stripClosingHash: false`, so `buildHeading` already strips a trailing attribute block
 * (`cal2/e_attr` → `h1:# Cal Attr Above`) and already KEEPS a trailing hash run verbatim
 * (`e_close` → `h1:# Cal Close Above ##`) — both exactly what quarto does here. The proof that
 * the setext path needs no help is that it is **already right** on the geometries where the ATX
 * row happens to decline on its own: `cal2/c_atx1`–`c_atx3` (the `#` line indented 1–3, refused
 * by Session 199's column equality) and `cal2/e_bare` (`#` alone, which `ATX_HEADING` cannot
 * match) all agree with quarto on the PRE-session build.
 *
 * ⚠ **`commonmarkDialect` is the gate, and it is a MEASURED six-three split rather than a reused
 * shape.** One matched pair per reader, `scratchpad/s214/cal`, plus a second shape each in
 * `cal2/h_*`:
 *
 *   SWALLOW    no `from:` at all · `markdown` · `markdown_strict` · `markdown_mmd`
 *              `markdown_phpextra` · `markdown_github`
 *   DO NOT     `gfm` · `commonmark` · `commonmark_x`
 *
 * That is precisely `FRONTMATTER_COMMONMARK_FROM`, and the mechanism is CommonMark §4.3: a
 * setext underline must follow a **paragraph**, and an ATX heading is not one. The `a_*_prose`
 * control renders a setext heading under all nine readers, so the CommonMark rows are refusing
 * *this geometry*, not lacking setext. ⚠ **`markdown_github` swallows** even though pandoc
 * documents it as a deprecated synonym for `gfm` — reasoning from the base name gets that row
 * backwards, which is Learning #348 / #352 in a third place.
 *
 * ⚠ **The column set is the underline's own, and it is `[0, ...contentColumns]` — the same array
 * the setext row reads.** Measured on 13 documents (`cal2/b_*`): top level swallows at column 0
 * and refuses 1–4 (Session 199's "even ONE leading space" confirmed, and swept past 3 so a rule
 * that stops there cannot look correct); inside `- item` (content column 2) the set is {0, 2};
 * inside `-   item` (column 4) it is {0, 4}. The ATX line's OWN indent is not part of the rule.
 *
 * ⚠ **The hazard is DELETION, and it is bounded by a corpus rather than by argument.** This row
 * declines and *relies* on the setext row firing on the next line — two rows with two
 * preconditions, and where both decline a heading quarto renders is lost outright.
 * `scratchpad/s214/cal3` puts 18 constructs above the ATX line, each with a matched
 * no-underline control; the four that render no heading at all (an open paragraph or an open
 * fence) report nothing before and after, and the thirteen that swallow are all recovered.
 *
 * ⚠ **`bodyRunLength` is what keeps that hazard from being a live deletion, and it was added
 * because the ADVERSARIAL pass found one — no designed document produced it.** The caller
 * passes the value `consecutiveBody` is ABOUT to take on this line, and the swallow is declined
 * unless that value is 1, which is precisely the setext row's own title-line precondition. In
 * `scratchpad/s214/adv/x1_div` the pair sits directly against a `:::` opener, where the counter
 * reaches 2 and the setext row never fires: declining the ATX there DELETED the heading instead
 * of retexting it.
 *
 * ⚠ **That gap is PRE-EXISTING and is deliberately NOT fixed here.** The same document with an
 * ORDINARY PROSE title reports nothing on the pre-session build too (`div_prose`, isolated in
 * `scratchpad/s214/probe.test.ts`), so the setext row's refusal to claim a title pressed against
 * a `:::` opener is a defect of its own with its own polarity — filed, not inherited. What this
 * gate does is refuse to make it REACHABLE: reporting the un-swallowed `h1:Adv Div Head` is
 * wrong in its TEXT, and reporting nothing loses the section from the outline entirely.
 *
 * ⚠ **The consequence is that this change is PURELY ADDITIVE by construction** (Session 210's
 * Headline 4 applied again): every row it moves goes from an ATX heading with stripped text to a
 * setext heading with quarto's exact text, and no row it touches can go to nothing.
 */
function setextUnderlineSwallowsAtx(
  next: string | undefined,
  columns: readonly number[],
  commonmarkDialect: boolean,
  bodyRunLength: number,
): boolean {
  return (
    !commonmarkDialect &&
    bodyRunLength === 1 &&
    next !== undefined &&
    setextUnderlineLevel(next, columns) !== null
  );
}
function tightAtxWouldWorsen(
  next: string | undefined,
  columns: readonly number[],
): boolean {
  return next !== undefined && setextUnderlineLevel(next, columns) !== null;
}
/** A raw block-level HTML opener, capturing the tag NAME so its closer can be matched. */
const RAW_HTML_BLOCK_OPEN_TAG = new RegExp(
  "^[ \\t]*<(" + PANDOC_BLOCK_OPEN_TAGS + ")(?=[ \\t/>]|$)",
  "i",
);
/**
 * The line indexes lying inside a **CLOSED** raw block-level HTML element, which a reader with
 * `markdown_in_html_blocks` OFF renders VERBATIM (Session 212).
 *
 * ⚠ **This exists to close a regression THIS session caused, found by its own adversarial pass
 * (`scratchpad/s212/adv/x18_html`) and not by any designed document.** Recognising the tight
 * hash inside `<div>` / `#Adv Tight In Div` / `</div>` reports a heading quarto does not render.
 * The row's SPACED twin already emits the identical phantom on the pre-session build
 * (`ctl/y1_div_spaced`), so the underlying defect is the already-filed `markdown_in_html_blocks`
 * item — but the tight row went from RIGHT to WRONG, which the declines above never do, so it
 * had to be closed rather than disclosed.
 *
 * ⚠ **CLOSED is the whole rule, and a BLANK LINE DOES NOT END THE BLOCK.** Measured over the 8
 * documents of `scratchpad/s212/ctl2`, which is what makes this narrow instead of a blanket
 * "never fire near a `<`":
 *
 *     z1_div_tight       `<div>` / `#T` / `</div>`            no heading — literal
 *     z2_div_prose       prose between them changes nothing   no heading — literal
 *     z3_div_blank       a BLANK line between them either     no heading — literal
 *     z5_pre_tight       `<pre>` behaves identically          no heading — literal
 *     z4_after_closer    below `</div>`                       RENDERS
 *     z6_span_tight      `<span>` is INLINE, never a block    RENDERS
 *     z7_comment_closed  a closed one-line comment            RENDERS
 *     z8_div_unclosed    an UNCLOSED `<div>`                  RENDERS — never becomes literal
 *
 * ⚠ **Read ONLY by the tight-hash gate**, deliberately: `commonmarkHtmlBlock` answers the same
 * shape of question for the CommonMark readers with a different end condition (a blank line DOES
 * end a type-6 block there), and the two must not be merged — this project has measured that
 * family disagreeing four times. Over-firing here costs a lost true positive, which is the
 * permitted direction; under-firing is a phantom.
 */
function closedRawHtmlBlockLines(lines: readonly string[]): ReadonlySet<number> {
  const inside = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const open = RAW_HTML_BLOCK_OPEN_TAG.exec(lines[i]);
    if (open === null) {
      continue;
    }
    const closer = new RegExp("^[ \\t]*</" + open[1] + "(?=[ \\t/>]|$)", "i");
    for (let j = i + 1; j < lines.length; j++) {
      if (closer.test(lines[j])) {
        for (let k = i + 1; k <= j; k++) {
          inside.add(k);
        }
        i = j;
        break;
      }
    }
  }
  return inside;
}
/** A front-matter line that is blank or holds nothing but a comment — never YAML content. */
const FRONTMATTER_NOT_CONTENT = /^[ \t]*(?:#.*)?$/;
/**
 * A `from:` key at the front matter's own TOP LEVEL, key and separator only, so the VALUE is
 * whatever follows the match. The quote is captured and back-referenced, so `"from":` and
 * `'from':` resolve while a half-quoted `"from:` does not.
 *
 * ⚠ **Anchored at column 0, and that anchor is load-bearing rather than conservative.** An
 * `abstract: |` block scalar's content is ordinary prose that may wrap across the words
 * `from: gfm …`, and reading it as a reader DELETES a real heading — `scratchpad/s206/cmk`
 * `c_abs_only` renders `h1:probe title`, and its collision twin `c_abs_coll` (the same prose
 * beside a real top-level `from: gfm`) renders none. YAML requires a block scalar's content to
 * be indented past its key, so column 0 makes that hazard unreachable by construction.
 */
const TOP_LEVEL_FROM_KEY = /^(["']?)from\1[ \t]*:/;
/**
 * A YAML **block scalar** header — `|` or `>` with an optional chomping/indentation indicator
 * and an optional trailing comment. Such a value is not on this line at all: it is the indented
 * block below, and a reader name is short enough that the block is one line, which both `|` and
 * `>` fold to that line unchanged.
 */
const BLOCK_SCALAR_INDICATOR = /^[ \t]*[|>][+-]?[0-9]?[ \t]*(?:#.*)?$/;
/**
 * The front matter's TOP-LEVEL `from:` declaration, rewritten as the single canonical LINE
 * `from: <value>` so the MEASURED value predicates above can classify it unchanged (Session 206).
 *
 * ⚠ **This exists because a YAML value has many spellings and a line regex has one.** Every
 * spelling below is quarto-honoured, measured on the real render path over two independent
 * observables — `scratchpad/s206/gnd` (the `blank_before_header` bail) and `scratchpad/s206/cmk`
 * (the setext COLUMN row) — with a `gfm` row and a `markdown` row for each, because it is the
 * two rows DISAGREEING that proves quarto read the spelling rather than ignored the front matter.
 *
 * ⚠ **Returning `null` is always today's behaviour, so every unhandled shape falls through to a
 * phantom.** That is the required direction: both flags this feeds DELETE a heading when they
 * fire wrongly (`FRONTMATTER_COMMONMARK_FROM` at setext underline column 0,
 * `fromKeepsBlankBeforeHeader` at a pressed ATX heading). Where the value cannot be resolved
 * with confidence, resolve nothing.
 *
 * ⚠ **For a plain top-level `from:` the returned line is BYTE-IDENTICAL to the source line**,
 * which is what keeps Sessions 202's and 205's allowlists from moving: the value text is passed
 * through verbatim — quotes, trailing comment, extension list and all — and only the KEY is
 * canonicalised. A synthesised line is produced only for a spelling that had no line to match.
 */
function frontMatterFromValueLine(lines: readonly string[]): string | null {
  // ⚠ The GOVERNING block, not the front matter — Session 211. The KEY half above resolves
  // against the same content, and the two must never disagree about WHICH block they read.
  const content = governingMetadataContent(lines);
  return content === null ? null : contentFromValueLine(content);
}
/**
 * The VALUE half of the question above, asked of one block's CONTENT rather than of a document.
 *
 * Split out in Session 211 as the exact counterpart of `contentSelectsReader`, so the governing
 * walk can ask BOTH halves of a candidate block. Behaviour is unchanged — this is the original
 * body, reached with the same content as before for any document with no mid-document block.
 */
function contentFromValueLine(content: readonly string[]): string | null {
  const top = topLevelIndent(content);
  if (top === null) {
    return null;
  }
  // ⚠ **THE PER-FORMAT DECLARATION OUTRANKS THE TOP-LEVEL ONE, and that is MEASURED in both
  // directions and in both file orders** (Session 207). `scratchpad/s207/cal` `c_fmhg_topm`
  // (nested `gfm` beside a top-level `markdown`) renders as gfm and `c_fmhm_topg` renders as
  // markdown; `scratchpad/s207/cal2` `q_topm_fmhg` and `q_topg_fmhm` write the top-level key
  // FIRST and render the same way. Those last two are why the rule is "the nested one wins"
  // rather than "the first one wins" — `cal` alone cannot tell those apart, because in both of
  // its collision rows the nested key happens to come first.
  // ⚠ The FLOW spelling of that same per-format path outranks the top level exactly as the
  // block spelling does, and is measured in both directions and both file orders too —
  // `scratchpad/s208/cal` `c_f1hg_topm` / `c_f1hm_topg` put the nested key first and
  // `c_topm_f1hg` / `c_topg_f1hm` put the top-level one first (Session 208).
  // ⚠ An EMPTY value resolves nothing HERE while it still counts as a declaration for the KEY
  // half — `flowPathValue`'s polarity note. The two flags this feeds delete a heading when they
  // fire wrongly, so an unreadable value must reach neither.
  const flowNested = flowPerFormatFromValue(content, top);
  if (flowNested !== null && flowNested !== "") {
    return `from: ${flowNested}`;
  }
  const nested = perFormatBlock(content, top);
  if (nested !== null) {
    const value = mappingFromValueLine(nested.block, nested.indent, false);
    if (value !== null) {
      return value;
    }
  }
  return mappingFromValueLine(content, top, true);
}
/**
 * The `from:` declaration made by the mapping whose own keys sit at `indent`, rewritten as the
 * canonical line `from: <value>`, or `null` when that mapping declares none — or declares one
 * this scanner will not resolve with confidence.
 *
 * `topLevelForms` admits the two spellings measured only at the front matter's own top level:
 * a whole front matter written as one FLOW mapping, and a value that is a YAML ALIAS (whose
 * anchor `topLevelAnchor` looks for at the top level alone). Neither is measured nested, so
 * neither is resolved there — and refusing is always today's behaviour.
 */
function mappingFromValueLine(
  block: readonly string[],
  indent: number,
  topLevelForms: boolean,
): string | null {
  for (let i = 0; i < block.length; i++) {
    if (leadingWhitespace(block[i]) !== indent || FRONTMATTER_NOT_CONTENT.test(block[i])) {
      continue;
    }
    const key = TOP_LEVEL_FROM_KEY.exec(block[i].slice(indent));
    if (key === null) {
      // A whole front matter may be one FLOW mapping, whose `from:` sits after a `{` or `,`
      // rather than at the line's start — `scratchpad/s206/gnd` `g_flow_markdown` suppresses
      // the pressed heading and `g_flow_gfm` renders it. The value ends at the next separator.
      // ⚠ Resolved BY PATH, not by the first `from:` on the line (Session 208). The flat
      // pattern this replaced was wrong in BOTH directions on six of eight measured rows —
      // `scratchpad/s208/cal3`: `{title: t, params: {from: markdown}, from: gfm}` renders as
      // gfm (it read markdown, DELETING a heading) and `{title: t, params: {from: gfm}}`
      // renders as the default (it read gfm, INVENTING one). `params:` inside a flow mapping
      // is the same non-selecting path it is in a block one.
      if (topLevelForms && FRONTMATTER_FLOW_OPEN.test(block[i])) {
        const region = flowRegion(block, i, indent);
        const flow = region === null ? null : flowPathValue(region, ["from"]);
        if (flow !== null && flow !== "") {
          return `from: ${flow}`;
        }
      }
      continue;
    }
    const value = block[i].slice(indent + key[0].length);
    const alias = YAML_ALIAS_VALUE.exec(value);
    if (alias !== null) {
      const anchored = topLevelForms ? topLevelAnchor(block, indent, alias[1]) : null;
      return anchored === null ? null : `from: ${anchored}`;
    }
    if (!FRONTMATTER_NOT_CONTENT.test(value) && !BLOCK_SCALAR_INDICATOR.test(value)) {
      return `from:${value}`;
    }
    // An EMPTY value, or a BLOCK SCALAR indicator: either way YAML puts the scalar on the
    // following line, indented past the key. `scratchpad/s206/gnd` `g_nextline_markdown`,
    // `g_foldm_markdown`, `g_fold_markdown` and `g_litm_markdown` all render only their
    // baseline, so each is `from: markdown`. A one-line block scalar folds to that one line,
    // which is the only shape a reader name can take. ⚠ Measured NESTED too, and it behaves
    // identically: `scratchpad/s207/cal2` `q_nextline_*` renders as gfm.
    const next = nextContentLine(block, i + 1);
    if (next !== null && leadingWhitespace(next) > indent) {
      return `from: ${next.trim()}`;
    }
    return null;
  }
  return null;
}
/**
 * A value that is nothing but a YAML **alias** — `*name`, optionally with a trailing comment.
 * The name charset excludes YAML's flow indicators, which an anchor name may not contain.
 */
const YAML_ALIAS_VALUE = /^[ \t]*\*([^\s,[\]{}]+)[ \t]*(?:#.*)?$/;
/**
 * The value carried by the top-level key that declares the anchor `&name`, or `null` when no
 * top-level key declares it.
 *
 * ⚠ **Top-level only, and that is a fail-closed choice rather than a claim about YAML.** An
 * anchor may legally be declared at any depth; resolving one this scanner cannot see with
 * confidence would feed a flag whose wrong direction DELETES a heading, so an unresolvable alias
 * returns `null` and the document keeps today's behaviour. Measured for the top-level shape:
 * `scratchpad/s206/gnd` `g_alias_markdown` suppresses the pressed heading and `g_alias_gfm`
 * renders it.
 */
function topLevelAnchor(content: readonly string[], top: number, name: string): string | null {
  for (const line of content) {
    if (leadingWhitespace(line) !== top) {
      continue;
    }
    const m = TOP_LEVEL_ANCHOR_DECL.exec(line.slice(top));
    if (m !== null && m[2] === name) {
      return m[3].trim();
    }
  }
  return null;
}
/** A top-level `key: &anchor value` declaration — the key, the anchor name, and the value. */
const TOP_LEVEL_ANCHOR_DECL = /^(["']?)[^:]*\1[ \t]*:[ \t]*&([^\s,[\]{}]+)[ \t]+(.*)$/;
/** How many leading space/tab characters `line` carries. */
function leadingWhitespace(line: string): number {
  return (/^[ \t]*/.exec(line) as RegExpExecArray)[0].length;
}
/**
 * The indent of the front matter's own TOP LEVEL — the SHALLOWEST content line in the block, or
 * `null` when the block holds no content at all.
 *
 * ⚠ **This is what makes a uniformly indented mapping reachable WITHOUT making a block scalar's
 * interior reachable, and the two really are distinguishable.** YAML requires a block scalar's
 * content to be indented past its own key, so that key is always a shallower content line and
 * the minimum can never land inside the scalar. `scratchpad/s206/gnd` `g_indent1_markdown` and
 * `g_indent2_markdown` (every line indented — top level is 1 and 2) suppress the pressed heading
 * where `scratchpad/s206/cmk` `c_abs_only` (an `abstract: |` at column 0 whose prose wraps across
 * `from: gfm …`) renders its heading and must keep it.
 */
function topLevelIndent(content: readonly string[]): number | null {
  let min: number | null = null;
  for (const line of content) {
    if (FRONTMATTER_NOT_CONTENT.test(line)) {
      continue;
    }
    const n = leadingWhitespace(line);
    if (min === null || n < min) {
      min = n;
    }
  }
  return min;
}
/** The next line holding YAML content, or `null` at the end of the block. */
function nextContentLine(content: readonly string[], from: number): string | null {
  for (let j = from; j < content.length; j++) {
    if (!FRONTMATTER_NOT_CONTENT.test(content[j])) {
      return content[j];
    }
  }
  return null;
}
/**
 * The 0-based index of the line on which the document's front matter OPENS, or `null` when it
 * opens none. **The single opener predicate** — the scanner's region view and
 * `frontMatterContent` below both ask it, so the two cannot disagree about what counts as front
 * matter (Learning #14, which the two sites had drifted from: each carried its own `---` test).
 *
 * ⚠ **Quarto has TWO mechanisms here and they are not the same rule** (Session 210, measured
 * over 51 rendered documents — `scratchpad/s210/CALIBRATION.md`):
 *
 *   line 0        quarto's own front-matter reader. An unterminated block or a `...` terminator
 *                 makes quarto REFUSE the document outright (`cal4` `c4_unterm0_*`, `c4_dots0_*`,
 *                 both exit 1 with no HTML).
 *   after a blank pandoc's `yaml_metadata_block`, which is what a leading blank line falls
 *                 through to. Here `...` DOES terminate (`cal4` `c4_dotslead_*`, exit 0) and an
 *                 unterminated block is NOT metadata at all — it renders as ordinary body.
 *
 * ⚠ **The leading run may be any length and any whitespace.** One, two, three blanks; one space;
 * three spaces; FOUR spaces; a TAB; ten blanks — all measured to render identically to the
 * no-leading-blank baseline, metadata honoured and `from:` selecting the reader (`cal`,
 * `c2_many_*`). The ` {0,3}` cap that governs nearly every other block rule in this file does
 * NOT apply, which is exactly where the instinctive fix would have been wrong.
 *
 * ⚠ **The two clauses below are scoped to `i > 0` ON PURPOSE, so this change is purely
 * ADDITIVE.** A document whose line 0 is `---` is classified byte-identically to before; only a
 * document that has no front matter today can gain one. The failure mode of getting this wrong is
 * catastrophic — an unterminated block runs to end of document, so opening one wrongly deletes
 * EVERY heading below it — and additive is the only shape that cannot regress an existing
 * document. It also keeps `inFrontMatter` (which gates YAML completion) true while a user is
 * still typing `---` / *(blank)* with no closing fence yet; a uniform clause would switch
 * completion off mid-keystroke.
 *
 * ⚠ **A blank line immediately below the opener means it is NOT front matter** — measured in
 * three spellings (empty `c2_hrgap`, spaces `c3_leadws`, tab `c3_tabafter`). A YAML COMMENT there
 * is content and still opens (`c3_comafter`), and a blank line LATER in the block is fine
 * (`c3_midgap`, `c3_leadmid`), so the test is blankness of one specific line, never "is it a key".
 * The measured residual at line 0 is filed in `BACKLOG.md`, with its completion cost.
 */
function frontMatterOpenIndex(lines: readonly string[]): number | null {
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") {
    i++;
  }
  if (i >= lines.length || !FRONTMATTER_OPEN.test(lines[i])) {
    return null;
  }
  if (i === 0) {
    return 0;
  }
  // Below here the opener sits after a run of blank lines, so pandoc's rules apply.
  if (i + 1 >= lines.length || lines[i + 1].trim() === "") {
    return null;
  }
  for (let j = i + 1; j < lines.length; j++) {
    if (FRONTMATTER_CLOSE.test(lines[j])) {
      return i;
    }
  }
  return null;
}
/**
 * The front matter's own CONTENT lines — everything between the opening `---` and its
 * terminator — or `null` when the document opens no front matter at all.
 */
function frontMatterContent(lines: readonly string[]): string[] | null {
  const open = frontMatterOpenIndex(lines);
  if (open === null) {
    return null;
  }
  const content: string[] = [];
  for (let i = open + 1; i < lines.length; i++) {
    if (FRONTMATTER_CLOSE.test(lines[i])) {
      break;
    }
    content.push(lines[i]);
  }
  return content;
}
/** YAML's document-end marker alone on a line — a terminator the `---` delimiter grammar omits. */
const YAML_DOCUMENT_END = /^\.\.\.[ \t]*$/;
/**
 * A backtick fence opener at ANY indent, which disqualifies a mid-document metadata block from
 * resolving a reader (Session 211).
 *
 * ⚠ This is a KNOWN GAP between quarto and its port, not a rule of its own. `breakQuartoMd`
 * tracks a code fence inside an open YAML region — `quarto-yaml-regions.ts` records that in its
 * own comment — but the ported `START_CODE` is anchored at column 0, so the indented fence a
 * `code: |` block scalar holds is invisible to it and the port then CLOSES the region at a `---`
 * quarto never treats as a delimiter. `scratchpad/s211/cal4` `s3_fence_in_blk_gfm` is that
 * document: quarto renders no headings at all, and reading the block invents one. Refusing is
 * today's answer, which costs a phantom rather than a heading. Its control `s3_fence_in_blk_none`
 * is unaffected either way, so the fence is the variable and not the shape.
 */
const FENCE_ANYWHERE_IN_BLOCK = /^\s*(?:```|~~~)/;
/**
 * Whether an HTML comment is still OPEN at 0-based `line` — a mid-document metadata block
 * inside one resolves nothing (Session 211).
 *
 * ⚠ Found by this session's ADVERSARIAL pass, and it is the one finding the designed corpora
 * structurally could not produce: not one of them wraps a block in anything.
 * `scratchpad/s211/adv` `a8_html_comment` puts `---` / `from: gfm` / `---` inside `<!--` …
 * `-->`; quarto does not honour it, and reading it INVENTED the pressed heading. Quarto's ported
 * region grammar tracks CODE FENCES and knows nothing about comments.
 *
 * ⚠ Refusing is strictly safe here in a way a narrowing usually is not. This session's change
 * only ever ADDS resolutions — a document with no mid-document block is untouched — so refusing
 * more can only withdraw a resolution this session just added. It cannot take away an answer the
 * pre-session build gave, which is why this is a closed regression rather than a filed residual.
 *
 * Deliberately a LOCAL token count rather than a call into the comment-region machinery: that
 * machinery has its own measured defects, still open in `BACKLOG.md` (an unterminated `<!--` is
 * run to end of document where quarto's default reader ends it at the next blank line). Borrowing
 * a rule that is known wrong to fix a phantom would trade one defect for another. The control
 * `a8_html_comment_ctl`, and the CLOSED-comment-above row pinned in the tests, are what keep this
 * from degenerating into "any document containing a comment".
 */
function insideHtmlComment(lines: readonly string[], line: number): boolean {
  let open = false;
  for (let i = 0; i < line && i < lines.length; i++) {
    for (let at = 0; at < lines[i].length; ) {
      const next = open ? lines[i].indexOf("-->", at) : lines[i].indexOf("<!--", at);
      if (next < 0) {
        break;
      }
      at = next + (open ? 3 : 4);
      open = !open;
    }
  }
  return open;
}
/**
 * The CONTENT lines of every YAML metadata block BELOW the document's opening block, in
 * document order — the blocks quarto measurably merges into the document's metadata.
 *
 * ⚠ **A mid-document block really does select the reader** (Session 211, 67 rendered documents
 * — `scratchpad/s211/CALIBRATION.md`). `cal/c01_mid_gfm` renders the pressed heading that only a
 * CommonMark-family reader keeps, and its matched control `c01_mid_none` — the same geometry
 * carrying `note: x` — does not, so the difference is the `from:` and not the shape. Quarto
 * reads every region for metadata and then hands pandoc the WHOLE document, which is why the
 * same three lines can be metadata AND render as a setext heading (`c01_mid_gfm` shows both).
 * That setext half is a separate, already-filed item (Session 204's `yaml_12`) and is untouched.
 *
 * ⚠ **The region grammar is quarto's own**, ported verbatim in `quarto-yaml-regions.ts`, and
 * this session's rows are an independent confirmation of it: a block inside a code fence does
 * not select (`c07_fence_gfm`, `cal4/s1_infence_gfm`, `s2_incell_gfm`), a blank-surrounded `---`
 * is a thematic break rather than an opener (`c09_hrgap_gfm`), and — the asymmetry no earlier
 * session had exercised — that exemption applies only where a region would OPEN, so a
 * blank-surrounded `---` still CLOSES one (`cal3/r4_hr_close_only` selects, `r4_hr_open_only`
 * does not). The opener is three dashes at column 0: `----` (`c11_fourdash_gfm`), three spaces
 * (`c10_indent_gfm`), `> ---` (`cal2/q5_in_quote`) and a list indent (`q5_in_list`) all refuse.
 *
 * ⚠ **TERMINATION is required, and it is where the ported grammar and quarto DISAGREE in both
 * directions.** The port lets an unclosed region run to end of document and would read it —
 * measured, an unterminated block does NOT select (`c06_unterm_gfm`, `cal2/q2_unterm_swallow`,
 * — ⚠ NOT `q5_open_at_eof`, which selects nothing for a different reason: its trailing `---`
 * has a blank line both above and below, so the HR exemption means no region opens at all) and
 * does not swallow the document either (`c13_unterm_plain` still renders
 * every heading below the dangling `---`). And the port accepts only `---` as a closer, where
 * YAML's `...` document-end marker also terminates and the block DOES select (`c08_dots_gfm`,
 * `cal3/r5_dots_then_body`). Refusing an unterminated block is also the safe direction: a
 * refusal is today's answer, which costs a phantom, never a heading.
 *
 * ⚠ **The filter is the document's FIRST CONTENT LINE, not the front matter's position, and
 * that is what makes this change purely ADDITIVE.** A block that OPENS the document keeps
 * exactly today's classification whatever `frontMatterOpenIndex` makes of it. The row that
 * forced this is `cal5/t1_blankafter_gfm` (`---` / *(blank)* / `from: gfm` / `---` at line 0):
 * quarto does NOT honour it, `frontMatterOpenIndex` returns `null` for it, and quarto's region
 * grammar DOES return it as a terminated region — so a "below the front matter" filter would
 * newly read it and INVENT a heading. Keying on the first content line excludes it, and
 * excludes the leading-blank spelling Session 210 already handles (`t2_leadblank_gfm`), while
 * still admitting a document with no front matter at all (`cal3/r1_nofm_mid_gfm`).
 */
function midDocumentMetadataBlocks(lines: readonly string[]): string[][] {
  return midDocumentMetadataRegions(lines).map((block) => block.content);
}
/**
 * The same enumeration, with each block's SOURCE SPAN retained (Session 213).
 *
 * Split out rather than copied because the two consumers ask different questions of the SAME set
 * and a second walk would drift from this one: `midDocumentMetadataBlocks` above reads the
 * CONTENT to resolve the reader, and `consumedMetadataBlockLines` below reads the SPAN to
 * suppress the lines. Every filter documented on `midDocumentMetadataBlocks` applies to both and
 * is unchanged; behaviour for its existing consumers is identical.
 *
 * ⚠ A block whose body carries a `...` document-end marker returns NO span. Its content ends at
 * the marker while the region ends at the `---`, and what quarto renders for the lines BETWEEN
 * the two is unmeasured — so the span is withheld rather than guessed. `cal2/e8_dots_md` is the
 * nearest rendered row and it is an unterminated region, already excluded, with no phantom to
 * lose. Withholding is today's answer.
 */
interface MetadataBlock {
  readonly content: string[];
  /** The opening `---`, 0-based. */
  readonly startLine: number;
  /** The closing `---`, 0-based and INCLUSIVE, or `null` where no span may be claimed. */
  readonly endLine: number | null;
}
function midDocumentMetadataRegions(lines: readonly string[]): MetadataBlock[] {
  const firstContent = lines.findIndex((line) => line.trim() !== "");
  if (firstContent < 0) {
    return [];
  }
  const blocks: MetadataBlock[] = [];
  for (const region of quartoYamlRegions(lines.join("\n"))) {
    if (region.startLine <= firstContent || insideHtmlComment(lines, region.startLine)) {
      continue;
    }
    const body = lines.slice(
      region.startLine + 1,
      region.terminated ? region.endLine : lines.length,
    );
    const end = body.findIndex((line) => YAML_DOCUMENT_END.test(line));
    const content = end >= 0 ? body.slice(0, end) : region.terminated ? body : null;
    // A block holding a fence opener is one where the ported region grammar is measured NOT to
    // mirror quarto — see `FENCE_ANYWHERE_IN_BLOCK`. Resolving nothing from it is today's answer.
    if (content !== null && !content.some((line) => FENCE_ANYWHERE_IN_BLOCK.test(line))) {
      blocks.push({
        content,
        startLine: region.startLine,
        endLine: region.terminated && end < 0 ? region.endLine : null,
      });
    }
  }
  return blocks;
}
/**
 * The lines a CONSUMING reader swallows whole — every line of every mid-document metadata block
 * pandoc parses as `yaml_metadata_block`, opener through closer inclusive (Session 213).
 *
 * ⚠ **THE OPENER'S PRECONDITION IS THE WHOLE DIFFICULTY, AND IT IS WHY THIS IS NOT SIMPLY
 * `midDocumentMetadataBlocks`.** `BACKLOG.md`'s entry for this item says that function "already
 * enumerates exactly the blocks in question". It does not, and `scratchpad/s213/cal3/h3_above_md`
 * is the document that refutes it: under plain `markdown` — the consuming reader — a `---` sitting
 * directly beneath a `## heading` line with no blank between renders BOTH `h2:## Cal Above Atx`
 * AND `h2:note: alpha`. **No block is consumed there at all.**
 *
 * Two different rules run over the same bytes. Quarto reads YAML REGIONS for metadata
 * (`breakQuartoMd`, ported in `quarto-yaml-regions.ts`, which the enumeration above walks) and
 * then hands PANDOC the whole document. The consumption modelled here is pandoc's, and pandoc
 * requires the opening `---` to START A BLOCK; where it does not, pandoc claims it as a SETEXT
 * UNDERLINE for the line above instead — which is exactly why that heading comes back carrying
 * its literal hashes.
 *
 * `scratchpad/s213/cal4` varies only the line directly above the opener, under both readers:
 *
 *     line above the opener        consumed?   row
 *     a blank line                   YES       i_blank_md
 *     a whitespace-only line         YES       j_wsblank_md
 *     nothing (first content)        YES       i_top_md
 *     a closed code fence            YES       i_fenceclose_md      ⚠ DECLINED — see below
 *     a closed raw HTML block        YES       i_htmlclose_md       ⚠ DECLINED — see below
 *     a paragraph line               no        i_para_md
 *     an ATX heading                 no        i_atx_md
 *     a list item                    no        i_listitem_md
 *     a block-quote line             no        i_quoteline_md
 *     a thematic break `***`         no        i_hr_md
 *
 * **Every `no` row is a heading quarto renders and a suppression keyed on the region grammar
 * would DELETE.** So the test is the BLANK LINE, which is a deliberate UNDER-approximation of
 * pandoc's "starts a block": the two closed-construct rows are declined and carry their phantom,
 * because widening to them is a claim about container state this row does not need to make.
 *
 * ⚠ Also declined: an opener sitting directly on the CLOSER of a preceding consumed block
 * (`cal3/g_twounder_md`, where quarto consumes both and this suppresses only the first). One
 * rendered witness is not enough to widen a rule whose failure mode is deletion — the lesson
 * `h3_above_md` had just finished teaching.
 *
 * ⚠ The blank-above test is ALSO what protects this repository's own documents. 53 of the 115
 * tracked markdown-family files carry a blank-preceded `---` below their first content line — the
 * section separator this project writes everywhere — and NONE is a candidate span, because each
 * is followed by a blank line and quarto's region grammar exempts it as a thematic break
 * (`cal2/e7_hrgap_md`). Measured over the corpus before the rule was written, and re-proven by
 * the byte-identical repo control after it.
 */
function consumedMetadataBlockLines(lines: readonly string[]): ReadonlySet<number> {
  const consumed = new Set<number>();
  for (const block of midDocumentMetadataRegions(lines)) {
    if (block.endLine === null || !BLANK_LINE.test(lines[block.startLine - 1] ?? "")) {
      continue;
    }
    for (let i = block.startLine; i <= block.endLine; i++) {
      consumed.add(i);
    }
  }
  return consumed;
}
/**
 * The metadata block that GOVERNS this document's reader — the content the two `from:`
 * resolvers below read, in place of the front matter alone.
 *
 * ⚠ **The LAST block whose `from:` SELECTS wins — NOT the last block**, and the two differ on a
 * document that renders. `BACKLOG.md` and Session 210's handoff both say "the later one wins";
 * read literally that deletes a heading. `cal2/q1_gfm_then_nofrom` declares `from: gfm` in one
 * block and then opens a LATER block carrying no `from:` at all, and quarto still renders the
 * pressed heading (its control `q1_gfm_then_nofrom_ctl` does not). Quarto MERGES metadata; a
 * later block that says nothing about the reader does not silence an earlier one.
 *
 * ⚠ The same holds for a later `from:` at a REFUSED path: `cal3/r7_gfm_then_params` puts
 * `params:`/`from: markdown` after a top-level `from: gfm` and the gfm still governs. So the
 * walk tests each candidate with the SELECTION predicate rather than for the presence of the
 * three letters — which is also why an EMPTY `from:` DOES win (`cal2/q4_gfm_then_empty`, pressed
 * heading absent): it is a declaration, and `contentSelectsReader` is the half that says so.
 *
 * Falling through to `frontMatterContent` is today's answer exactly, so a document with no
 * mid-document metadata block is classified byte-identically to before this session.
 */
function governingMetadataContent(lines: readonly string[]): string[] | null {
  const blocks = midDocumentMetadataBlocks(lines);
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (!contentSelectsReader(blocks[i])) {
      continue;
    }
    // ⚠ **A block that DECLARES a reader governs even when its value reads as nothing, and it
    // does NOT fall back to an earlier block** — the regression this session caused and closed.
    // An empty `from:` satisfies the KEY half, so the block governs; its VALUE resolves to
    // nothing, and an unresolved value makes the paragraph bail fail OPEN, which INVENTED the
    // pressed heading on `cal2/q4_gfm_then_empty` and `ctl2/v1_empty_only` (quarto renders
    // neither). Returning an empty block says "a reader was declared and it reads as nothing",
    // which is what quarto does: it reverts to the DEFAULT, never to the previous declaration.
    //
    // ⚠ Deliberately NOT the same answer as at line 0, where the identical bytes are REFUSED by
    // quarto outright (`ctl/u1_empty_from_byte0`, exit 1). Front matter at line 0 is VALIDATED;
    // a mid-document block is merged. Scoping this to the mid-document walk leaves the line-0
    // fail-open Session 207 measured exactly as it was.
    return contentFromValueLine(blocks[i]) === null ? [] : blocks[i];
  }
  return frontMatterContent(lines);
}
/**
 * The lines nested UNDER the key at `block[from - 1]`, whose own indent is `parentIndent` —
 * every following line indented past the parent, up to the first content line that is not.
 *
 * Blank and comment lines are carried through rather than ending the block, because YAML
 * permits either inside a mapping; `topLevelIndent` skips them when it measures the child
 * level, so carrying them cannot move that measurement.
 */
function subBlock(block: readonly string[], from: number, parentIndent: number): string[] {
  const out: string[] = [];
  for (let i = from; i < block.length; i++) {
    if (FRONTMATTER_NOT_CONTENT.test(block[i])) {
      out.push(block[i]);
      continue;
    }
    if (leadingWhitespace(block[i]) <= parentIndent) {
      break;
    }
    out.push(block[i]);
  }
  return out;
}
/** A `format:` key, and the ONE per-format key whose `from:` this scanner resolves. */
const FORMAT_KEY = /^(["']?)format\1[ \t]*:/;
const HTML_FORMAT_KEY = /^(["']?)html\1[ \t]*:/;
/**
 * The mapping written under `format:` / `html:` — its own lines and the indent its keys sit
 * at — or `null` when the front matter has no such path.
 *
 * ⚠ **`html:` and no other format key, and that is a MEASURED fail-safe rather than an
 * oversight.** A per-format `from:` belongs to the format being RENDERED:
 * `scratchpad/s207/cal2` `q_pdfg` declares `format:`/`  pdf:`/`    from: gfm` and renders as
 * MARKDOWN when html is the active format, and the two-format rows settle it in both
 * directions — `q_htmlm_pdfg` (html says markdown, pdf says gfm) renders as markdown and
 * `q_htmlg_pdfm` renders as gfm. So the html block's `from:` is the one that applies here.
 *
 * ⚠ **What that corpus does NOT measure is a document whose only format is pdf**, because
 * `render207.sh` passes `--to html` and so forces html active. Resolving a non-html format's
 * reader could therefore delete a heading; REFUSING one keeps today's behaviour, which is a
 * phantom. The refusal is the direction that cannot delete, and the residual is filed.
 *
 * ⚠ Keyed on relative DEPTH rather than on a column: `q_i4` writes the same path with 4-space
 * steps and renders identically, and `q_late` puts another key above the `from:` and renders
 * identically too.
 */
function perFormatBlock(
  content: readonly string[],
  top: number,
): { block: readonly string[]; indent: number } | null {
  for (let i = 0; i < content.length; i++) {
    if (leadingWhitespace(content[i]) !== top || FRONTMATTER_NOT_CONTENT.test(content[i])) {
      continue;
    }
    if (!FORMAT_KEY.test(content[i].slice(top))) {
      continue;
    }
    const formats = subBlock(content, i + 1, top);
    const formatIndent = topLevelIndent(formats);
    if (formatIndent === null) {
      continue;
    }
    for (let j = 0; j < formats.length; j++) {
      if (leadingWhitespace(formats[j]) !== formatIndent || FRONTMATTER_NOT_CONTENT.test(formats[j])) {
        continue;
      }
      if (!HTML_FORMAT_KEY.test(formats[j].slice(formatIndent))) {
        continue;
      }
      const inner = subBlock(formats, j + 1, formatIndent);
      const innerIndent = topLevelIndent(inner);
      if (innerIndent !== null) {
        return { block: inner, indent: innerIndent };
      }
    }
  }
  return null;
}
/** One key/value entry of a YAML FLOW mapping, at that mapping's OWN level. */
interface FlowEntry {
  key: string;
  value: string;
}
/**
 * The entries written by the FLOW mapping that opens at the first `{` in `text` — its OWN
 * entries and no nested one — or `null` when `text` opens no flow mapping, or opens one that
 * never balances.
 *
 * Quote- and depth-aware in the same discipline as `scanFlow` above: a `\`-escaped character
 * inside a double-quoted scalar and a `''` inside a single-quoted one are consumed, so a
 * quoted brace never miscounts and an embedded quote never closes a scalar early. Entries
 * split on a `,` at depth 1 and each entry's key ends at its FIRST `:` at depth 1, so a
 * nested mapping's own `key: value` pairs are stepped over whole rather than parsed.
 *
 * ⚠ **Returning `null` is always today's behaviour**, so every shape this does not handle —
 * an unbalanced mapping, a flow SEQUENCE, an unrecognised spelling — falls through to the
 * behaviour that shipped before Session 208.
 */
function flowEntries(text: string): FlowEntry[] | null {
  const open = text.indexOf("{");
  if (open < 0) {
    return null;
  }
  const out: FlowEntry[] = [];
  let depth = 1;
  let quote: '"' | "'" | null = null;
  let start = open + 1;
  let colon = -1;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    if (colon < 0) {
      // An entry with no `:` at this level — a set entry or a sequence element. It declares
      // no value, so it can never be a `from:` declaration; recorded with an empty value so
      // the entry list stays positionally honest.
      if (raw.trim() !== "") {
        out.push({ key: unquoteFlowKey(raw), value: "" });
      }
      return;
    }
    out.push({
      key: unquoteFlowKey(text.slice(start, colon)),
      value: text.slice(colon + 1, end).trim(),
    });
  };
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote === '"') {
      if (ch === "\\") {
        i++;
      } else if (ch === '"') {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      if (ch === "'") {
        if (text[i + 1] === "'") {
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[") {
      depth++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        push(i);
        return out;
      }
      continue;
    }
    if (depth !== 1) {
      continue;
    }
    if (ch === ":" && colon < 0) {
      colon = i;
    } else if (ch === ",") {
      push(i);
      start = i + 1;
      colon = -1;
    }
  }
  return null; // never balanced — resolve nothing
}
/** A flow mapping's key with its surrounding whitespace and its matching quotes removed. */
function unquoteFlowKey(raw: string): string {
  const t = raw.trim();
  const q = t[0];
  return (q === '"' || q === "'") && t.length > 1 && t[t.length - 1] === q ? t.slice(1, -1) : t;
}
/**
 * The raw value text the FLOW mapping `text` writes for `key` at its OWN level, or `null`.
 *
 * ⚠ **The FIRST occurrence wins, and duplicates are UNMEASURED.** YAML forbids a duplicate key
 * in a mapping and quarto rejects the document outright for one, so no rendered pair could be
 * built to settle it; first-wins is recorded as the bound rather than claimed as the rule.
 */
function flowValue(text: string, key: string): string | null {
  const entries = flowEntries(text);
  if (entries === null) {
    return null;
  }
  for (const e of entries) {
    if (e.key === key) {
      return e.value;
    }
  }
  return null;
}
/**
 * The text of the flow collection opening in `block[from]` at `offset`, JOINED across the
 * following lines until its brackets balance — or `null` when it opens none, or never
 * balances before the block ends.
 *
 * ⚠ **A flow mapping may SPAN LINES, and quarto honours one that does.** Measured,
 * `scratchpad/s208/cal2`: `format: {` / `  html: {from: gfm}` / `}` and
 * `format: {html: {` / `  from: gfm` / `}}` both render as CommonMark, and their `markdown`
 * twin renders as markdown. A per-LINE walk misses the second outright — no block arm can
 * reach a `from:` whose parent key ended the line before — and misses it in the DELETING
 * direction. Lines are joined with a space, which YAML flow context treats as the line break
 * it replaces.
 */
function flowRegion(block: readonly string[], from: number, offset: number): string | null {
  let text = block[from].slice(offset);
  if (!text.includes("{")) {
    return null;
  }
  for (let i = from; i < block.length; i++) {
    if (flowEntries(text) !== null) {
      return text;
    }
    if (i + 1 < block.length) {
      text += ` ${block[i + 1]}`;
    }
  }
  return flowEntries(text) === null ? null : text;
}
/**
 * The scalar written at `path` inside the flow mapping `text`, or `null` when the path does
 * not resolve — because a step is absent, or because a step's value is a plain scalar rather
 * than the mapping the next step needs.
 *
 * ⚠ **An EXACT path, and that is MEASURED rather than conservative.** `scratchpad/s208/cal2`
 * renders `format: {html: {execute: {from: gfm}}}`, `format: {docx: {html: {from: gfm}}}` and
 * `website: {html: {from: gfm}}` each EXACTLY as its no-`from:` twin does — quarto honours none
 * of them. So "a `from:` somewhere inside the flow" is the wrong rule and would delete headings
 * on all three; only the path decides.
 *
 * ⚠ **`null` means the path is ABSENT; `""` means it is PRESENT with an empty value**, and the
 * two callers must not be collapsed. The KEY question (`frontMatterSelectsReader`) deletes a
 * heading when it answers "no" wrongly, so it accepts a present-but-empty declaration; the
 * VALUE question fails the other way — `FRONTMATTER_COMMONMARK_FROM` deletes when it fires
 * wrongly — so it resolves nothing from an empty value. That asymmetry is Session 207's, kept.
 */
function flowPathValue(text: string, path: readonly string[]): string | null {
  let cursor = text;
  for (const step of path) {
    const next = flowValue(cursor, step);
    if (next === null) {
      return null;
    }
    cursor = next;
  }
  return cursor;
}
/**
 * The `from:` value declared by a per-format block written in FLOW style, or `null`.
 *
 * ⚠ **The obvious implementation — the flat `FLOW_FROM_ENTRY` pattern, which takes the first
 * `from:` after a `{` or `,` on the line — is WRONG ON HALF THE MEASURED ROWS.** It is right on
 * the witness document (`scratchpad/s207/adv/fmt` `fmt_11`) only because html is written first
 * there. `scratchpad/s208/cal` writes both format ORDERS against both reader DIRECTIONS:
 * `{docx: {from: markdown}, html: {from: gfm}}` renders as gfm and
 * `{docx: {from: gfm}, html: {from: markdown}}` renders as markdown, so it is HTML's `from:`
 * that decides and the flat pattern reads two of those four rows backwards.
 *
 * ⚠ `html:` and no other format key — Session 207's MEASURED fail-safe, re-confirmed in flow:
 * `cal` `c_f1pg_*` (`format: {pdf: {from: gfm}}`) renders as the default.
 */
function flowPerFormatFromValue(content: readonly string[], top: number): string | null {
  const raw = flowPerFormatFromRaw(content, top);
  return raw === null ? null : dereferenceFlowScalar(raw, content, top);
}
/**
 * A flow scalar with a YAML ALIAS resolved against the front matter's top-level anchors, or
 * `null` when the alias names no anchor this scanner can see.
 *
 * ⚠ **A REGRESSION THIS SESSION CAUSED, and the direction is INVENTING.** Resolving the PATH
 * but leaving `*rdr` as the value made the value unreadable, and an unreadable value relaxes
 * the heading column set by design (`frontMatterSelectsReader`'s fail-open, which exists
 * because the KEY question deletes when it answers "no" wrongly). So a document whose anchor
 * names a pandoc markdown reader gained a heading quarto does not render: measured,
 * `scratchpad/s208/adv2` `b01_alias_md` renders the BASELINE ONLY and `b02_alias_gfm` renders
 * BOTH. The PRE-session build was accidentally right on the first, because it resolved nothing
 * at all — which is why only an adversarial probe could see it.
 */
function dereferenceFlowScalar(
  raw: string,
  content: readonly string[],
  top: number,
): string | null {
  const alias = YAML_ALIAS_VALUE.exec(raw);
  return alias === null ? raw : topLevelAnchor(content, top, alias[1]);
}
/** The raw `from:` scalar at the per-format path, before any alias is dereferenced. */
function flowPerFormatFromRaw(content: readonly string[], top: number): string | null {
  for (let i = 0; i < content.length; i++) {
    if (leadingWhitespace(content[i]) !== top || FRONTMATTER_NOT_CONTENT.test(content[i])) {
      continue;
    }
    const rest = content[i].slice(top);
    const key = FORMAT_KEY.exec(rest);
    if (key === null) {
      // (C) a WHOLE front matter written as one flow mapping may carry the per-format path
      // inside it — `{title: t, from: markdown, format: {html: {from: gfm}}}` renders as gfm
      // (`scratchpad/s208/cal2` `q_wfm_topm_hg_*`), so the nested declaration outranks the
      // top-level one here exactly as it does in every other spelling.
      if (FRONTMATTER_FLOW_OPEN.test(rest)) {
        const whole = flowRegion(content, i, top);
        const nested = whole === null ? null : flowPathValue(whole, ["format", "html", "from"]);
        if (nested !== null) {
          return nested;
        }
      }
      continue;
    }
    // (A) the whole `format:` value is written flow — `format: {html: {from: gfm}}`.
    const region = flowRegion(content, i, top + key[0].length);
    const whole = region === null ? null : flowPathValue(region, ["html", "from"]);
    if (whole !== null) {
      return whole;
    }
    // (B) a BLOCK `format:` whose `html:` VALUE alone is flow — `format:` / `  html: {from: …}`.
    // Measured to render identically (`scratchpad/s208/cal` `c_f2hg_*` against `c_f2hm_*`), so
    // the two are one capability: a walk that handled only (A) would leave (B) deleting.
    const formats = subBlock(content, i + 1, top);
    const formatIndent = topLevelIndent(formats);
    if (formatIndent === null) {
      continue;
    }
    for (let j = 0; j < formats.length; j++) {
      if (leadingWhitespace(formats[j]) !== formatIndent || FRONTMATTER_NOT_CONTENT.test(formats[j])) {
        continue;
      }
      const htmlKey = HTML_FORMAT_KEY.exec(formats[j].slice(formatIndent));
      if (htmlKey === null) {
        continue;
      }
      const inner = flowRegion(formats, j, formatIndent + htmlKey[0].length);
      const value = inner === null ? null : flowPathValue(inner, ["from"]);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}
/**
 * The index of the `from:` key written by the mapping whose keys sit at `indent`, or `-1`.
 *
 * ⚠ **An EQUALITY on the indent, never a minimum.** That is what separates a mapping's own
 * key from anything nested under a sibling key — including a block scalar's prose, which YAML
 * requires to be indented PAST its own key and which therefore can never satisfy this.
 */
function mappingFromKeyIndex(block: readonly string[], indent: number): number {
  for (let i = 0; i < block.length; i++) {
    if (leadingWhitespace(block[i]) !== indent || FRONTMATTER_NOT_CONTENT.test(block[i])) {
      continue;
    }
    if (TOP_LEVEL_FROM_KEY.test(block[i].slice(indent))) {
      return i;
    }
  }
  return -1;
}
/**
 * Whether the front matter declares a `from:` at a position that really SELECTS the reader.
 *
 * ⚠ **This NARROWS `FRONTMATTER_FROM_KEY`, and the polarity is the exact inverse of the three
 * sessions that widened it.** That regex matches at ANY indent, so an `abstract: |` block
 * scalar whose prose wraps across the words `from: gfm …` selects a reader — measured as a
 * phantom by SEVEN independent blind documents across Sessions 205 and 206. But a key that
 * stops firing where quarto DID select re-engages the paragraph bail (`model.ts`, the ATX
 * `paragraphOpen` branch) *and* collapses the heading column set to `[0]`, and **both of those
 * DELETE a real heading**. So this returns `true` for every position measured to select and
 * refuses only positions measured NOT to:
 *
 *   selects      the front matter's own TOP LEVEL — `scratchpad/s207/cal` `c_topg_*`
 *                a top-level FLOW mapping — S206's `g_flow_gfm`
 *                `format:` / `html:` / `from:` — `cal` `c_fmhg_*`, three observables
 *   refuses      `params:` / `from:`         — `cal` `c_parg_*`
 *                `website:` / `from:`        — `cal2` `q_web_*`
 *                `execute:` / `from:`        — `cal2` `q_exec_*`
 *                an `abstract: |` block scalar's prose — `cal` `c_absg_*`
 *
 * Every refusal above is a rendered pair, never an argument: the document renders exactly as
 * its no-`from:` twin does.
 */
function frontMatterSelectsReader(lines: readonly string[]): boolean {
  const content = governingMetadataContent(lines);
  return content !== null && contentSelectsReader(content);
}
/**
 * The KEY half of the question above, asked of one block's CONTENT rather than of a document.
 *
 * Split out in Session 211 so `governingMetadataContent` can ask it of each candidate block:
 * the walk must pick the last block that SELECTS, and "selects" is precisely this predicate,
 * not the presence of a `from:` anywhere in the text. Behaviour is unchanged — this is the
 * original body, and the only caller that existed before passes it the same content as before.
 */
function contentSelectsReader(content: readonly string[]): boolean {
  const top = topLevelIndent(content);
  if (top === null) {
    return false;
  }
  if (mappingFromKeyIndex(content, top) >= 0) {
    return true;
  }
  for (let i = 0; i < content.length; i++) {
    if (leadingWhitespace(content[i]) !== top || !FRONTMATTER_FLOW_OPEN.test(content[i])) {
      continue;
    }
    // ⚠ BY PATH (Session 208), for the same measured reason the value half is: a `from:`
    // nested under `params:` inside a flow mapping does not select, and reading it INVENTS a
    // heading (`scratchpad/s208/cal3` `r_par_only_*`). An EMPTY value still counts as a
    // declaration here and not in the value half — see `flowPathValue`'s polarity note.
    const region = flowRegion(content, i, top);
    if (region !== null && flowPathValue(region, ["from"]) !== null) {
      return true;
    }
  }
  if (flowPerFormatFromValue(content, top) !== null) {
    return true;
  }
  const nested = perFormatBlock(content, top);
  return nested !== null && mappingFromKeyIndex(nested.block, nested.indent) >= 0;
}
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
/**
 * A raw-TeX environment delimiter, capturing which half it is and the environment NAME
 * (Session 226) — the two facts `RAW_TEX_ENV_OPEN` throws away.
 */
const RAW_TEX_ENV_DELIM = /^ {0,3}\\(begin|end)\{([^}]*)\}/;
/**
 * The LAST line on which each environment name is closed by an `\end{name}` (Session 226).
 *
 * ⚠ **What decides a `\begin{}` sits BELOW it, which is why this is an index and not a
 * predicate.** Pandoc's raw-TeX block parser consumes a WHOLE environment or nothing, so a
 * `\begin{center}` with its matching `\end{center}` below really does interrupt an open
 * paragraph (`scratchpad/s226/r3/h02`, a rendered heading) while the identical line with no
 * `\end` below it is inline text and interrupts nothing (`r1/t_texenv`, `r3/h13`, `r3/h14`,
 * all rendering no heading).
 *
 * ⚠ **Scanned with an UNANCHORED match, deliberately.** A quoted `> \end{center}` must count
 * for the quoted `> \begin{center}` above it (`r2/q_g11`), and the strip is applied per line
 * inside the walk rather than here. The failure direction of over-matching — an `\end{name}`
 * that is really inside a code block, say — is to treat the `\begin` as a real opener, which
 * is this model's answer before this session; it can forgo a recovery, never delete a heading.
 */
function lastRawTexEnvEnd(lines: readonly string[]): ReadonlyMap<string, number> {
  const last = new Map<string, number>();
  // ⚠ **EVERY delimiter on the line, not the first** — a deletion this session introduced and
  // then measured away. Reading one per line made `\\begin{a}` / `body text` /
  // `\\end{b}\\end{a}` / `# H j01` find no `\\end{a}`, call the `\\begin` unmatched, and leave a
  // paragraph open across a heading quarto really renders (`scratchpad/s226/r4/j01`).
  // Under-matching this index DELETES; over-matching only forgoes a recovery.
  const scan = /\\end\{([^}]*)\}/g;
  for (let i = 0; i < lines.length; i++) {
    scan.lastIndex = 0;
    for (let m = scan.exec(lines[i]); m !== null; m = scan.exec(lines[i])) {
      last.set(m[1], i);
    }
  }
  return last;
}
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
 * A fenced-div / callout fence line, split into its colon run and whatever follows it
 * (Session 226). `null` when the line is not one at all.
 *
 * ⚠ **The tail is what separates an OPENER from a CLOSER, and `CLOSER_LINE` cannot see it** —
 * that pattern is unanchored at its end, so `::: {.note}` and a bare `:::` match it alike and
 * are treated as the same thing. Measured over `scratchpad/s226/r2`, every spelling with a
 * non-blank tail is an opener: `::: {.note}` (`g01`), the bare-word class `::: callout-note`
 * (`g02`), four colons (`g03`), an id-only block `::: {#fig-g05}` (`g05`) and the no-space
 * `:::{.note}` (`g06`). A colon run followed by nothing but whitespace is a closer, and its
 * run may be LONGER than the opener's (`g07`: a `::::` closes a `:::`).
 */
/**
 * A LIST ITEM's own marker, so a div fence sharing its line can still be seen (Session 226).
 *
 * ⚠ **18 of the 39 headings this session's 47,125-document sweep caught it deleting were
 * this one shape.** `DIV_FENCE` is anchored at `^ {0,3}`, so `- ::: mydiv` never matched, the
 * div never opened, and the `:::` below it therefore closed nothing — leaving a paragraph open
 * across a heading quarto really renders (`scratchpad/s183/R3-fenceddiv-refute/run5/R01_ul_open`
 * and its ordered-list and indented-closer twins). This is the same anchoring gap
 * `BLOCK_QUOTE_PREFIX` carries, which Session 225 filed rather than closed.
 */
const LIST_MARKER_PREFIX = /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+/;
const DIV_FENCE = /^ {0,3}:{3,}[ \t]*(.*)$/;
/**
 * A mid-document YAML metadata block's `...` terminator, on its own line (Session 226). The
 * same spelling `CLOSER_LINE` and `CLOSES_PARAGRAPH` each carry, named here because the caller
 * asks a different question of it — not "is this a terminator?" but "is there a block for it
 * to terminate?" See `computeRegions`, where reaching the test is itself the answer.
 */
const YAML_BLOCK_TERMINATOR = /^ {0,3}\.\.\.[ \t]*$/;
/**
 * A mid-document YAML metadata block's OPENING `---` line (Session 226) — three or more
 * dashes and nothing else.
 *
 * ⚠ **Deliberately not `THEMATIC_BREAK` and not `SETEXT_UNDERLINE_RUN`, though the same bytes
 * satisfy all three.** This one is asked only "could a `...` below have a block to terminate?",
 * and it never changes what `closesParagraph` answers for the `---` line itself, which stays a
 * thematic break exactly as before.
 */
const YAML_BLOCK_OPENER = /^ {0,3}-{3,}[ \t]*$/;
/**
 * Everything on `line` up to the start of its colon run, so the run's own COLUMN can be
 * measured (Session 227). `[^:]*` cannot cross a colon, so this stops at the FIRST one — the
 * start of the run in every spelling `DIV_FENCE` accepts, including the one behind a
 * `LIST_MARKER_PREFIX`, whose marker carries no colon.
 */
const COLON_RUN_START = /^([^:]*):{3,}/;
/**
 * Whether `line` is a div fence and, if so, whether it opens or closes, and at WHICH COLUMN
 * its colon run begins — see `DIV_FENCE`.
 *
 * ⚠ **The column is what decides whether this is a fence at all, and the caller applies it**
 * (Session 227), because only the caller knows the enclosing block's content column. The
 * column is measured from the run's start rather than from `indentColumn`, so the
 * `- ::: mydiv` spelling reports the column the colons really sit at (2) rather than the
 * line's own indent (0).
 */
function divFenceRole(line: string): {
  role: "open" | "close";
  viaListMarker: boolean;
  column: number;
} | null {
  const own = DIV_FENCE.exec(line);
  const m = own ?? DIV_FENCE.exec(line.replace(LIST_MARKER_PREFIX, ""));
  if (m === null) {
    return null;
  }
  const before = COLON_RUN_START.exec(line);
  return {
    role: m[1].trim() === "" ? "close" : "open",
    viaListMarker: own === null,
    column: before === null ? indentColumn(line) : columnAtOffset(line, before[1].length),
  };
}
/**
 * A block-quote marker, for `paragraphQuoted` — see `closesParagraph`.
 */
const BLOCK_QUOTE_MARKER = /^ {0,3}>/;
/**
 * A BLOCK QUOTE's whole marker run, whose match length is the offset at which the quote's own
 * content begins — the strip `computeRegions` applies before classifying the line (Session 225).
 *
 * Quarto strips a quote's markers and re-parses what is left, so every construct inside a quote
 * is real: `> # Heading s01` renders `<blockquote><h1 id="heading-s01">` (`scratchpad/s225/cal`).
 * This model had no block-quote context anywhere, so `FENCE_OPEN` (anchored at `^[ \t]*`) and
 * `findHeadings` alike declined every `> `-prefixed line.
 *
 * ⚠ **`>[ ]?` — ONE SPACE, AND A TAB IS NOT IT.** `>\t# H c10` renders `<p># H c10</p>`, no
 * heading (`c/c10`): the tab is left in the content, which then starts at column 4 rather than
 * 0. Writing the optional space as `[ \t]?` would fabricate that heading.
 *
 * ⚠ **The marker run itself may not begin past column 3** — `    > # H b02` is an indented code
 * block at top level and the `>` is literal (`b/b02`).
 *
 * ⚠ **The strip does NOT relax the column rules on what it uncovers.** The quote's content base
 * is column 0 EXACTLY, the same absolute equality quarto applies at top level: `>  # H b10` and
 * `>   # H b11` render NO heading, and `>` + five spaces is indented code inside the quote
 * (`b/b01`). That falls out for free — a stripped line carries no marker, so `quoteOpen` stays
 * false and `atxHeadingMatch` sees the ordinary `[0, ...contentColumns]`.
 */
const BLOCK_QUOTE_PREFIX = /^ {0,3}(?:>[ ]?)+/;
/**
 * The offset at which a block quote's own content begins on `line`, or `null` when the line
 * carries no marker run at all. See `BLOCK_QUOTE_PREFIX`.
 */
function blockQuoteContentStart(line: string): number | null {
  const m = BLOCK_QUOTE_PREFIX.exec(line);
  return m === null ? null : m[0].length;
}
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
  unmatchedConstruct: boolean,
): boolean {
  if (lineBlockAbove && LINE_BLOCK_CONTINUATION.test(line)) {
    return true;
  }
  if (prevWasAtxHeading && SETEXT_UNDERLINE_RUN.test(line)) {
    return true;
  }
  // ⚠ **A CLOSER THAT CLOSES NOTHING IS NOT A CLOSER — IT IS ORDINARY PARAGRAPH TEXT**
  // (Session 226). The rows below sit ahead of the `paragraphOpen` bail because a closer
  // follows its own construct's content, so to a per-line scanner it always looks like it sits
  // against an open paragraph. That is right for a closer that really closes something and
  // wrong for one that does not, and nothing on the LINE separates the two — the caller
  // decides it from the block state it maintains. `false` rather than a fall-through, because
  // an unmatched fence does not merely fail to close a paragraph: with none open it STARTS
  // one, and `paragraphOpen = !closesParagraph(…)` is what expresses that. Rendered:
  // `<p>para one para two ::: # H t_div3</p>` and `<p>::: # H g14</p>`, one paragraph each.
  if (unmatchedConstruct) {
    return false;
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
 * The COLUMN at character offset `offset` of `line` (Session 227) — the same tab arithmetic
 * `indentColumn` applies, but continuing past the first non-whitespace character instead of
 * stopping there. `divFenceRole` needs it because a `- ::: mydiv` fence's colon run starts
 * after a marker, not after an indent, and only a column can be compared against the
 * container stack.
 */
function columnAtOffset(line: string, offset: number): number {
  let col = 0;
  for (let k = 0; k < offset && k < line.length; k++) {
    col += line[k] === "\t" ? 4 - (col % 4) : 1;
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
 * ⚠ **The closer test is unanchored — it matches anywhere on the line — but the TAG SPELLING is
 * exact, and both halves are measured.** Unanchored is the safe direction: a closer seen where
 * there is none ends the block early and leaves a phantom, this project's permitted direction,
 * where a closer MISSED deletes every heading to the end of the document. The spelling, though,
 * is not a judgement call — two blind-lens documents pin it (`scratchpad/s204/adv/bnd`):
 *
 *   `</pre >` — a space before the `>` — does NOT close. Quarto runs the block to end of
 *   document and renders no heading below it (`bnd_07`), so the `>` must be immediate.
 *   `</PRE>` in upper case DOES close (`bnd_08`), which is what the `i` flag is for.
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
/**
 * Pandoc's RAW ATTRIBUTE block — `{=FORMAT}`, the whole content and nothing else.
 *
 * ⚠ Deliberately permissive in the format name: the failure direction here is asymmetric, since
 * calling a fence a fence is the pre-session answer while refusing one exposes code as prose.
 * Measured accepted: `html`, `latex`, `html-x`, `html5`, `HTML`. Measured refused: a second
 * token (`{=html .cls}`), a space after the `=` (`{= html}`) and an empty name (`{=}`).
 */
const RAW_ATTRIBUTE = /^=[^\s{}]+$/;
/**
 * Whether a PLAIN fence opener's info string really opens a code block.
 *
 * ⚠ **WHEN THE INFO STRING DOES NOT PARSE, QUARTO DOES NOT FALL BACK TO A PLAIN CODE BLOCK —
 * THE FENCE IS NOT A FENCE.** Its opener renders as ordinary text and its contents are live
 * prose. Measured over 54 rendered rows across five rounds in Session 224
 * (`scratchpad/s224/`, quarto 1.7.33, predictions frozen and hashed before each round):
 * ```` ```python extra ```` renders `<p>```python extra</p>` with the `# Heading` below it a
 * REAL `<h1>` (`b/b01`), and quarto's own crossref filter proves the contents are live by
 * warning `Unable to resolve crossref @fig-s03` about a use inside such a block (`cal/sv.qmd`).
 *
 * ⚠ **THE REFUSAL IS A PANDOC-FAMILY RULE AND IGNORING THE READER WOULD DELETE COMMONMARK
 * REGIONS WHOLESALE.** Under `from: commonmark_x` the info string is arbitrary text, so ALL
 * NINE otherwise-refused rows build a code block (`c/`, 9/9) — CommonMark takes the first word
 * as a class and keeps going. That is why this returns early rather than sharing one grammar.
 *
 * ⚠ **A BLANK LINE INSIDE THE BLOCK IS WHY THIS IS WORTH FIXING.** With no blank line a
 * rejected block collapses into ONE inline code span whose content is literal, so hiding it is
 * accidentally right (`cal/sv.qmd` s02, s06). A code span cannot cross a blank line, so with
 * one the backticks are literal text and everything below is live (s03, s07, s08, s09).
 */
function fenceInfoOpensBlock(
  infoString: string,
  commonmarkDialect: boolean,
  pandocEscapes: boolean,
  quartoIntercepts: boolean,
): boolean {
  if (commonmarkDialect) {
    return true;
  }
  const info = infoString.trim();
  if (info === "") {
    return true;
  }
  // ⚠ **NO ATTRIBUTE BLOCK ENDING THE INFO STRING MEANS THE WHOLE STRING MUST BE ONE BARE
  // WORD, AND IT MUST HOLD NO `{` AT ALL.** Pandoc's info string is `[word] [{attrs}]`, so two
  // bare words leave a token it cannot place: ```` ```python extra ```` (`b/b01`) and
  // ```` ```python .cls ```` (`b/b11`) are both refused, where the one-word ```` ```python ````
  // (`d/d07`) and ```` ``` python ```` build a block. ⚠ And an UNCLOSED brace is refused even
  // when it is the only word — ```` ```{#lst-d03 ```` and ```` ```{bad.x ```` render as text
  // (`d/d03`, `d/d01`), so the brace test is not subsumed by the word count.
  const groups = braceGroups(info);
  const block = groups[groups.length - 1];
  if (block === undefined || block.end !== info.length - 1) {
    // ⚠ **NO ATTRIBUTE BLOCK ENDS THE INFO STRING, SO THE WHOLE STRING MUST BE ONE BARE WORD
    // HOLDING NO `{` AT ALL.** Two bare words leave a token pandoc cannot place —
    // ```` ```python extra ```` (`b/b01`) and ```` ```python .cls ```` (`b/b11`) are refused
    // where the one-word ```` ```python ```` (`d/d07`) builds a block. ⚠ And an UNCLOSED brace
    // is refused even as the only word: ```` ```{#lst-d03 ```` and ```` ```{bad.x ```` render
    // as text (`d/d03`, `d/d01`), so the brace test is not subsumed by the word count. A block
    // that does not END the string is this same case — ```` ```{#lst-b09 .cls} x ```` (`b/b09`).
    //
    // ⚠ **AND A LONE `}` REFUSES TOO, WHICH THIS SESSION'S OWN ADVERSARIAL PASS FOUND RATHER
    // THAN ANY DESIGNED ROW.** The clause tested for `{` alone because every refused row so far
    // carried one; ```` ```}bad ```` carries only the closer and quarto renders it as text
    // (`adv/z05`). Either brace disqualifies the bare word.
    return !/[{}]/.test(info) && info.split(/\s+/).length === 1;
  }
  // ⚠ **AT MOST ONE INFO-STRING WORD MAY PRECEDE THE BLOCK.** Pandoc's info string is
  // `[word] {attrs}`, so ```` ```{#lst-d05 .cls}{#lst-d05b} ````, whose prefix is TWO
  // whitespace words, is refused (`d/d05`) where the one-word prefix of
  // ```` ```{#lst-d06a}{#lst-d06b .cls} ```` is not (`d/d06`).
  if (info.slice(0, block.start).trim().split(/\s+/).filter(Boolean).length > 1) {
    return false;
  }
  // ⚠ **QUARTO'S OWN STAGE 1, WHICH IS NOT PANDOC'S AND IS WHY THIS IS NOT A PORT.** A
  // BRACE-LED info string containing neither `.` nor `=` is intercepted whole and becomes a
  // literal CLASS: ```` ```{#lst-b14} ```` renders `<pre class="{#lst-b14}">` and defines no id
  // (`b/b14`, and Session 223's `fenceAttributeId`, which carries the same gate for the id).
  // It is still a FENCE, so a predicate built on attribute validity alone deletes this region.
  //
  // ⚠ **AND IT IS LINE-ANCHORED, SO IT DOES NOT REACH INSIDE A BLOCK QUOTE (Session 225).**
  // The same bytes rendered both ways: ```` ```{#lst-g04 bad} ```` at top level is
  // `<pre class="{#lst-g04 bad}">` and hides its contents (`g/g04`), while the `> `-prefixed
  // twin renders `<p>```{#lst-g03 bad}</p>` with a REAL `<h1>` between the backticks (`g/g03`).
  // Inside a quote the info string faces pandoc's `Attr` parser alone.
  if (quartoIntercepts && block.start === 0 && !/[.=]/.test(info)) {
    return true;
  }
  // ⚠ **A RAW ATTRIBUTE BLOCK IS A FENCE AND IS NOT A VALID `Attr`** — ```` ```{=html} ````
  // and ```` ```{=latex} ```` are everyday shapes whose lone `=format` token the attribute
  // parser refuses outright, so without this clause they would stop opening a region
  // (`d/d11`, `d/d12`, plus `e/e02` `{=html-x}`, `e/e05` `{=html5}` and `e/e07` `{=HTML}`).
  // ⚠ It is the WHOLE content or nothing: `{=html .cls}`, `{= html}`, `{=}` and
  // `{#lst-e08 =html}` are all refused (`e/e01`, `e/e03`, `e/e04`, `e/e08`).
  if (RAW_ATTRIBUTE.test(block.content.trim())) {
    return true;
  }
  return headingAttributesValid(block.content, commonmarkDialect, pandocEscapes);
}
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
   * Whether this fence OPENED inside a block quote (Session 225) — which decides whether a
   * `>`-prefixed line inside the region is stripped before the closer test. A `>`-prefixed
   * fence run closes nothing at top level, where it is ordinary literal content (`d/d02`).
   */
  readonly quoted: boolean;
  /**
   * The offset at which this opener's own content begins — see `CodeFenceOpener.contentStart`.
   * Carried here because the opener is EMITTED at the closer, by which time the strip that
   * computed it is many lines behind.
   */
  readonly contentStart: number;
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

/**
 * The opening fence line of a PLAIN fenced code block — one whose info string is not an
 * executable-cell language, and which really does open a region (a fence with no closer below
 * opens nothing, Session 179).
 *
 * ⚠ **EMITTED BECAUSE THE LINE IS A REGION BOUNDARY AND SO REACHES NO OTHER CONSUMER.**
 * `findBodyLines` never yields a fence opener and `findAllCells` covers only cell fences, so
 * before this the line was invisible to every downstream scanner — which is why a cross-ref id
 * quarto really defines on a code block (```` ```{#lst-x .python} ```` renders `id="lst-x"`)
 * could not be indexed at all. `core/refs.ts` consumes this; re-scanning the raw document for
 * fences there would be a second scanner (Learning #14).
 */
export interface CodeFenceOpener {
  /** 0-based line index of the opening fence. */
  line: number;
  /** The raw opener line — indentation, fence run and info string included. */
  text: string;
  /**
   * The offset within `text` at which a BLOCK QUOTE's own content begins — `0` for every fence
   * outside a quote (Session 225). `text` stays RAW so the column a consumer resolves from it
   * remains a real document column; a consumer that PARSES the info string slices from here.
   *
   * ⚠ It is also the flag for quarto's line-anchored intercepts, which do NOT fire inside a
   * quote: rendered, ```` > ```{#lst-e01} ```` defines a real `id="lst-e01"` (`e/e01`) where
   * the top-level twin renders `<pre class="{#lst-s03}">` and defines nothing at all.
   */
  contentStart: number;
}

/** A document line that is live content — outside front matter, comments, and code fences. */
export interface BodyLine {
  /** 0-based line index. */
  line: number;
  /** The raw line text. */
  text: string;
  /**
   * The offset within `text` at which a BLOCK QUOTE's own content begins — `0` for every line
   * outside a quote (Session 225).
   *
   * ⚠ `text` stays RAW deliberately: every consumer that resolves a COLUMN from it — the
   * cross-reference index's go-to-definition ranges above all — would be off by the marker's
   * width against a pre-stripped string. A consumer that reads the line as MARKDOWN rather
   * than as coordinates slices from here instead.
   */
  contentStart: number;
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
  codeFenceOpeners: CodeFenceOpener[];
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
  const quoteEnds = blockQuoteEndIndex(lines);
  const headings: Heading[] = [];
  const cells: Cell[] = [];
  const bodyLines: BodyLine[] = [];
  const codeFenceOpeners: CodeFenceOpener[] = [];
  // Closing fence lines a REFUSED opener above has already swallowed into an inline code span,
  // so they may not open a region themselves — see `consumedCloserLine` (Session 224).
  const consumedFenceClosers = new Set<number>();
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
  // ⚠ **WHICH CONTAINER THE OPEN LINE BLOCK LIVES IN (Session 226).** A line block takes a
  // continuation only from its OWN container: rendered, `> | line one` / `  continued` /
  // `# H` renders NO heading, because the unmarked line lazily continues the QUOTE's paragraph
  // rather than the line block (`scratchpad/s226/r1/lz1`), while the MARKED twin `>   continued`
  // renders it (`lz2`). The marker is the whole difference, and `LINE_BLOCK_CONTINUATION` — a
  // bare leading-whitespace test — cannot see it.
  let lineBlockQuoted: boolean = false;
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
  // The line on which front matter opens, or `null` for a document that opens none — the SAME
  // predicate `frontMatterContent` asks (Session 210), so the region view and the `from:`
  // resolvers cannot disagree about which lines are front matter. Hoisted out of the loop
  // because it is a property of the whole document, not of the line being scanned.
  const frontMatterOpensAt = frontMatterOpenIndex(lines);
  // A front-matter `from:` disables the paragraph rule for the whole document — see
  // `frontMatterSelectsReader`. Without this the change DELETES headings quarto renders.
  // ⚠ Resolved ONCE from the whole front-matter block (Session 207), because whether a `from:`
  // selects the reader is a question about its YAML PATH and no single line carries one. The
  // hoist is behaviour-preserving for the same reason Session 206's was: every consumer of
  // this flag sits BELOW the front matter, which the loop `continue`s straight through.
  const dialectOverride = frontMatterSelectsReader(lines);
  // Whether the front-matter `from:` names a reader of the CommonMark FAMILY — see
  // `FRONTMATTER_COMMONMARK_FROM`. Deliberately a SECOND flag beside `dialectOverride`
  // rather than a refinement of it: that one keys on the KEY's presence and is read by the
  // ATX row at two sites, where its fail-open direction is a measured phantom. Here the
  // fail-open direction is a DELETION, so the two cannot share a flag.
  // ⚠ Both VALUE flags are resolved ONCE from the whole front-matter block rather than line by
  // line (Session 206), because a YAML value is not always on its key's line: it may sit on the
  // next line, inside a block scalar, behind an alias, or in a flow mapping. Hoisting is
  // behaviour-preserving — every consumer of these flags sits BELOW the front matter, which the
  // loop `continue`s straight through — and for a plain top-level `from:` the line the resolver
  // hands over is byte-identical to the source line, so neither allowlist can move.
  const fromValueLine = frontMatterFromValueLine(lines);
  let commonmarkDialect = fromValueLine !== null && FRONTMATTER_COMMONMARK_FROM.test(fromValueLine);
  // Whether the front-matter `from:` names a reader that KEEPS `blank_before_header` — see
  // `fromKeepsBlankBeforeHeader`. A THIRD flag beside the two above, read by the
  // ATX paragraph bail alone: `dialectOverride`'s other consumer (the heading COLUMN set) asks
  // a different question and must not move with this one.
  let blankBeforeHeaderDialect = fromValueLine !== null && fromKeepsBlankBeforeHeader(fromValueLine);
  // Whether the resolved reader is of the pandoc MARKDOWN family, which gives an ATX heading no
  // column tolerance — see `fromIsMarkdownFamily`. A FOURTH flag rather than a refinement of
  // `dialectOverride`, for the same reason the two above are: it answers its own question, and
  // it is read at ONE site (the heading column set) where the other three are not.
  const markdownFamilyDialect = fromValueLine !== null && fromIsMarkdownFamily(fromValueLine);
  // Whether the resolved reader honours a trailing heading ATTRIBUTE block — see
  // `fromHonoursHeaderAttributes` (Session 216). A SEVENTH flag rather than a refinement of any
  // of the six around it, for the reason each of those gives: it answers its own question, about
  // its own extension, and it is read at ONE site (`buildHeading`, shared by the ATX and setext
  // paths). ⚠ It takes `fromValueLine` ITSELF rather than a `!== null &&` guard, because its
  // default is TRUE: a document with no `from:` at all honours the block, so "unresolved" and
  // "resolved to a keeping reader" are opposite answers here and cannot share the idiom above.
  const headerAttributesDialect = fromHonoursHeaderAttributes(fromValueLine);
  // Whether the resolved reader escapes only Markdown.pl's 16 characters rather than the full
  // ASCII punctuation range — see `FRONTMATTER_LEGACY_ESCAPES_FROM` (Session 217). An EIGHTH
  // flag rather than a refinement of any of the seven around it, for the reason each of those
  // gives: it answers its own question, and it is read at ONE site (`buildHeading`, shared by
  // the ATX and setext paths).
  // Whether the resolved reader carries pandoc's escape rules — see `fromEscapesAllSymbols`.
  // Read TWICE and for two different questions: it picks the escapable SET below, and it gates
  // the two special cases (`\<space>` -> U+00A0, trailing `\` -> hard break) that belong to no
  // set at all.
  const pandocEscapes = fromEscapesAllSymbols(fromValueLine);
  const escapableSet = headingEscapable(commonmarkDialect, pandocEscapes);
  // Whether the resolved reader has `space_in_atx_header` OFF, so `#Heading` with no separator
  // IS a heading — see `fromRequiresSpaceInAtxHeader` (Session 212). A SIXTH flag rather than a
  // refinement of any of the five above, for the reason each of those gives: it answers its own
  // question, about a THIRD extension, and it is read at ONE site (the ATX row's own regex).
  //
  // ⚠ `markdown_strict` sits on the OPPOSITE side of this rule and of `blankBeforeHeaderDialect`
  // — it drops `blank_before_header` AND drops `space_in_atx_header` — which is exactly why the
  // two cannot share a predicate. `cal/d3_prose_strict` needs both right at once: a tight hash
  // pressed against prose renders a heading there and under no other measured reader.
  const tightAtxDialect = fromValueLine !== null && !fromRequiresSpaceInAtxHeader(fromValueLine);
  // The lines a CLOSED raw HTML block renders VERBATIM — see `closedRawHtmlBlockLines`. Computed
  // only where it can be read, because it is a whole-document pre-pass and every other reader
  // leaves the tight row switched off anyway.
  const literalHtmlLines = tightAtxDialect ? closedRawHtmlBlockLines(lines) : null;
  // The lines of every mid-document YAML metadata block the resolved reader CONSUMES, which
  // quarto renders NOTHING for — see `consumedMetadataBlockLines` (Session 213). A SEVENTH flag,
  // and like the six above it answers its own question and is read at ONE site (the skip at the
  // head of the loop).
  //
  // ⚠ Its polarity is the INVERSE of every flag above it. Those model heading-DELETING rules, so
  // their fail-safe answer is the one that reports a heading anyway. This one is
  // heading-FABRICATING: firing wrongly REMOVES a section a reader really sees, so
  // `fromConsumesMetadataBlock` answers `false` for anything it has not measured, and the
  // whole-document pre-pass runs only when that answer is `true`.
  const consumedMetadataLines = fromConsumesMetadataBlock(fromValueLine)
    ? consumedMetadataBlockLines(lines)
    : null;
  // Whether a line spelling a footnote definition or a definition-list body really OPENS a
  // container here — see `fromHasDefinitionLists` / `fromHasFootnotes` for the measured
  // per-reader table, and `CONTENT_COLUMN_4_OPEN` for the two spellings it splits (Session 209).
  //
  // ⚠ A FIFTH flag, and like the four above it answers its own question and is read at ONE site
  // (the container push). It is a PREDICATE rather than a boolean because the two constructs are
  // measured independent of each other — `markdown-footnotes` has definition lists and no
  // footnotes — so the answer depends on the LINE as well as on the reader.
  //
  // ⚠ `fromValueLine === null` means the document declares no reader this scanner can resolve,
  // which includes the commonest case of all: no `from:` key at all. That is pandoc's own
  // `markdown`, which HAS both constructs, so it takes the unconditional push — the same answer
  // the pre-Session-209 build gave every document, and the non-deleting direction.
  const definitionContainerOpens = (line: string): boolean => {
    if (fromValueLine === null) {
      return CONTENT_COLUMN_4_OPEN.test(line);
    }
    if (FOOTNOTE_DEFINITION_OPEN.test(line)) {
      return fromHasFootnotes(fromValueLine);
    }
    return DEFINITION_LIST_BODY_OPEN.test(line) && fromHasDefinitionLists(fromValueLine);
  };
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
  // ⚠ **THE BLOCK STATE A PER-LINE SCANNER OTHERWISE LACKS (Session 226)** — how many fenced
  // divs are open at this line. It is what separates a `:::` that really closes one from a
  // `:::` that closes nothing and is therefore ordinary paragraph text; see `divFenceRole` and
  // `closesParagraph`'s `unmatchedConstruct`. Maintained only on body lines, so a `:::` inside
  // a fenced CODE block never counts (`scratchpad/s226/r3/h09`, rendered).
  let divDepth = 0;
  // Whether a mid-document YAML metadata block is open at this line — the same block state,
  // for the `...` terminator. See `YAML_BLOCK_OPENER`.
  let metadataBlockOpen = false;
  // How many raw-TeX environments are open at this line — the same block state again, for the
  // `\end{}` delimiter. See `lastRawTexEnvEnd` for the half that decides a `\begin{}`.
  // ⚠ **A STACK OF NAMES, NOT A DEPTH COUNTER.** A counter cannot tell a real closer from a
  // lookalike: an `\end{center}` sitting inside a `verbatim` block consumed the depth, so the
  // real `\end{verbatim}` below it found nothing open and deleted the heading beneath it
  // (`scratchpad/s188/adv/L05/L05-11-verbatim-fake-end-inside`, one of 39 deletions the
  // 47,125-document sweep caught). Pandoc closes the innermost environment of the SAME name.
  const rawTexEnvStack: string[] = [];
  const rawTexEnvEnds = lastRawTexEnvEnd(lines);
  let quoteOpen = false;
  // Whether a BLOCK QUOTE is open on this line — the state the marker strip at the top of the
  // loop maintains (Session 225). Distinct from `quoteOpen`, which is the pre-session fail-safe
  // for an UNMARKED line below a quote and keeps its own meaning untouched.
  // The OUTER document's container stack while a quote is open, restored when it closes
  // (Session 225).
  //
  // ⚠ **CLEARING INSTEAD OF SAVING DELETED FOUR FAMILIES OF REAL HEADINGS, and the corpus
  // sweep is what found them.** A quote may sit INSIDE a list item — `- item one` / `  > quoted`
  // / `  # ATX Below` — and the item's content column is still the coordinate system every line
  // BELOW the quote is written in. Quarto renders all four (`h/s189_life_l0155`,
  // `h/s199_ax_quote_inlist`, `h/s198_adv_a0067`, `h/s198_pop2_f1_setext_quote`), and clearing
  // the stack turned an indented setext title into indented code and an indented ATX into no
  // heading at all.
  let outerColumns: { columns: number[]; kinds: ("list" | "definition")[]; commonmark: boolean[] } | null =
    null;
  let inQuote = false;
  // ⚠ **AND THE PRE-SESSION FLAG IS CLEARED ONLY BY A LINE THE STRIP DID NOT REACH.** Every
  // region-boundary path below writes `quoteOpen = stripQuote` rather than `false` (Session
  // 225), because a MARKED blank line does not end a quote (`d/d01`) — and the old literal
  // `false` deleted Session 189's heading the moment `>` began stripping to `""` and taking
  // the blank branch.

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // ⚠ **THE BLOCK-QUOTE STRIP (Session 225).** Quarto strips a quote's markers and re-parses
    // what is left, so everything below this point classifies the quote's CONTENT rather than
    // the marker line. See `BLOCK_QUOTE_PREFIX` for the marker grammar and for why the strip
    // deliberately does not relax the column rules on what it uncovers.
    //
    // ⚠ **A BLOCK QUOTE MAY NOT INTERRUPT AN OPEN PARAGRAPH, and that gate is the whole reason
    // this is not a blanket strip.** Rendered: `para c08` / `> # H c08` is ONE paragraph,
    // `<p>para c08 &gt; # H c08</p>` (`c/c08`). Stripping there fabricates a heading quarto
    // does not render — the forbidden direction. Once the quote IS open the gate no longer
    // applies: `paragraphOpen` then describes a paragraph INSIDE the quote, which its own
    // marked lines continue (`c/c01`, `c/c09`).
    //
    // ⚠ **AN UNMARKED BLANK LINE ENDS THE QUOTE; AN UNMARKED NON-BLANK LINE DOES NOT.** Pandoc
    // takes lazy continuation for more than paragraphs — an unmarked closing fence really does
    // close a fence opened inside the quote (`b/b05`) and an unmarked content line joins it
    // (`c/c03`) — while a real blank line ends the quote and leaves that fence unclosed
    // (`c/c04`).
    // ⚠ **INSIDE AN OPEN FENCE THE STRIP FOLLOWS THE FENCE, NOT THE LINE** — a `>`-prefixed
    // fence run closes NOTHING at top level, where it is literal content (`d/d02`), while a
    // fence opened INSIDE a quote is closed by its own marked closer. This session's own guard
    // (G6) went red on the blanket spelling within the minute.
    const quoteContentStart = blockQuoteContentStart(raw);
    // ⚠ The explicit annotations on this constant and the two below are load-bearing, not
    // style — the same TS7022 round trip `lineBlockAbove` documents. `quoteOpen` is assigned
    // `stripQuote` on every region-boundary path and read back here through
    // `quoteColumnsUnknown`, which tsc reports as circular inference unless one end is
    // annotated.
    const stripQuote: boolean =
      quoteContentStart !== null && !inFrontmatter && i !== frontMatterOpensAt && !inComment
        ? open !== null
          ? open.quoted
          : inQuote || !paragraphOpen
        : false;
    if (stripQuote) {
      // Entering a quote from outside it abandons the OUTER document's container columns: the
      // quote's content base is its own column 0, and an outer list's column describes a
      // coordinate system the stripped line is no longer written in.
      if (!inQuote) {
        outerColumns = {
          columns: [...contentColumns],
          kinds: [...columnKinds],
          commonmark: [...columnIsCommonmark],
        };
        contentColumns.length = 0;
        columnKinds.length = 0;
        columnIsCommonmark.length = 0;
      }
      inQuote = true;
    } else if (quoteContentStart === null && BLANK_LINE.test(raw)) {
      if (inQuote && outerColumns !== null) {
        contentColumns.length = 0;
        contentColumns.push(...outerColumns.columns);
        columnKinds.length = 0;
        columnKinds.push(...outerColumns.kinds);
        columnIsCommonmark.length = 0;
        columnIsCommonmark.push(...outerColumns.commonmark);
      }
      outerColumns = null;
      inQuote = false;
    }
    const line: string = stripQuote ? raw.slice(quoteContentStart as number) : raw;
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

    // YAML front matter. Record the span as it opens (provisionally unterminated, ending at
    // EOF) and refine `endLine`/`terminated` when the terminator is seen.
    // ⚠ The opener is no longer "line 0" but whatever `frontMatterOpenIndex` measured — a
    // leading run of blank or whitespace-only lines does not hide the block from quarto
    // (Session 210). `startLine` is that line rather than a hard 0, so the span the outline,
    // the citation reader and the completion gate all read stays exact.
    if (i === frontMatterOpensAt) {
      inFrontmatter = true;
      frontMatter = { startLine: i, endLine: lines.length - 1, terminated: false };
      continue;
    }
    if (inFrontmatter) {
      // ⚠ NEITHER the key flag NOR the two value flags are set here — all of them are resolved
      // once from the whole block above. A YAML value need not sit on its key's line (Session
      // 206), and whether a key selects the reader at all is a question about its PATH, which
      // no single line carries (Session 207).
      if (FRONTMATTER_CLOSE.test(line)) {
        inFrontmatter = false;
        // ⚠ `startLine` is the measured opener, NOT a hard 0 — this branch REBUILDS the span
        // rather than refining it, so a literal here silently discards the opener the branch
        // above recorded and reports a block that starts on a line the document does not open
        // one on (Session 210; caught by `front-matter.test.ts`'s span assertion).
        frontMatter = { startLine: frontMatterOpensAt ?? 0, endLine: i, terminated: true };
      }
      continue;
    }

    // Inside a code fence, only the matching closer matters — a `#`, `-->`, or
    // nested fence here is literal. Emit the cell when the fence closes.
    if (open !== null) {
      if (isCloser(line, open)) {
        if (open.isCell) {
          cells.push(makeCell(open, i, lines, true));
        } else {
          // ⚠ Recorded HERE, at the closer, rather than at the opener — symmetric with the
          // cell emit one line up, and for the same reason: a region is only real once it is
          // closed. The opener line itself is never a body line, so this is the only place a
          // consumer can learn the line exists.
          codeFenceOpeners.push({
            line: open.startLine,
            text: lines[open.startLine],
            contentStart: open.contentStart,
          });
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
    // A line inside a mid-document YAML metadata block the resolved reader CONSUMES — quarto
    // renders nothing for it, so nothing here may reach any heading row (Session 213).
    //
    // ⚠ Placed BELOW the open-fence and open-comment branches on purpose: a fence or comment
    // already open outranks this, which keeps the enumeration's own exclusions (a block bearing a
    // fence, a block inside a comment) from having to be re-litigated here.
    //
    // ⚠ A `continue` rather than a heading-row gate, because a consumed block renders NOTHING —
    // not the setext heading it would otherwise produce, and not an ATX line inside it either.
    // `cal3/g_atxkey_md` is the row that settles it: `---` / `# Cal Inside Comment` /
    // `note: alpha` / `---` reports BOTH an `h1` and an `h2` on the pre-session build, and quarto
    // renders neither. Skipping the lines outright is also what pandoc does with them, and the
    // block's own opener is preceded by a blank line by construction, so no container state
    // carried past it can be disturbed.
    if (consumedMetadataLines?.has(i) === true) {
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
        } else if (definitionContainerOpens(line)) {
          // A footnote definition and a definition-list definition both give their content
          // exactly 4 columns past their own indent — measured, and independent of label length.
          //
          // ⚠ **The +4 is now MEASURED rather than asserted, and it survived (Session 209).**
          // The comment above used to claim independence of label length on the strength of two
          // documents. `scratchpad/s209/cal2/col_*` renders six spellings — `:   x`, `: x`,
          // `:     x`, `:\tx`, `[^1]:` and `[^averylonglabelhere]:` — against probe columns
          // 2, 4 and 6. All six open column 4 exactly and none opens 2 or 6, so spacing after
          // the marker and label length are both irrelevant and this arithmetic is untouched.
          contentColumns.push(indentWidth + 4);
          columnKinds.push("definition");
          // ⚠ BOTH spellings count as CommonMark here, and that used to be KNOWN WRONG for the
          // definition-list half under `gfm`/`commonmark`. It is now right by construction:
          // `definitionContainerOpens` refuses the `:`/`~` spelling under exactly the readers
          // that have no definition lists, so a definition column can only exist where the
          // declared reader really carries the construct.
          columnIsCommonmark.push(true);
        }
      }
      // ⚠ **THE FAIL-SAFE READS THE RAW LINE, NOT THE STRIPPED ONE (Session 225).** `quoteOpen`
      // exists for the lines the strip does NOT reach — an UNMARKED line below a quote, where
      // pandoc has stripped markers this scanner cannot see. Reading the stripped line here
      // silently retires it, and Session 189's row (`> quoted one` / `>` / `   \clearpage` /
      // `   # ATX Below`, a heading quarto renders at EVERY indent 0-8) goes with it.
      if (BLOCK_QUOTE_MARKER.test(raw)) {
        quoteOpen = true;
      }
    }

    // A whole-line single-line comment renders to nothing — skip it entirely.
    if (COMMENT_FULL_LINE.test(line)) {
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = stripQuote;
      continue;
    }
    if (COMMENT_OPEN.test(line) && !COMMENT_CLOSE.test(line)) {
      inComment = true;
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = stripQuote;
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
    if (fence && !consumedFenceClosers.has(i)) {
      const char = fence[2];
      // ⚠ **QUARTO'S CELL EXTRACTION IS LINE-ANCHORED TOO, SO A CELL SHAPE INSIDE A QUOTE IS
      // NOT A CELL (Session 225).** Rendered: ```` > ```{ojs} ```` is `<p><code>{ojs} x = 1</code></p>`
      // — an inline code span, the shape of a REFUSED fence — where the identical top-level
      // document is a real executable cell (`d/d09` against `d/d10`). Withholding the cell match
      // is what lets the refusal below reach these rows at all: with `info` non-null the fence is
      // never asked whether pandoc accepts it, and pandoc does not.
      const info = char === "`" && !stripQuote ? CELL_INFO.exec(fence[3].trim()) : null;
      const candidate: OpenCellFence = {
        char,
        quoted: stripQuote,
        contentStart: stripQuote ? (quoteContentStart as number) : 0,
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
      // ⚠ A CELL is never asked — quarto's engine owns `{r, echo=FALSE}`, whose bytes the
      // attribute parser would refuse outright. `CELL_INFO` has already decided that above.
      const refused =
        info === null &&
        !fenceInfoOpensBlock(fence[3], commonmarkDialect, pandocEscapes, !stripQuote);
      // ⚠ **A REFUSED OPENER'S CLOSER MAY HAVE BEEN CONSUMED, AND FAILING TO RECORD THAT
      // BREAKS THE BLOCK BELOW.** With no blank line between them the two fence lines are read
      // as ONE INLINE CODE SPAN, so the closer is swallowed and cannot open anything; with a
      // blank line the span cannot form, the backticks are literal text, and the closer really
      // does become an OPENER for the block beneath. Measured both ways: `scratchpad/s224/g/g01`
      // keeps `lst-g01b` while `g02` loses `lst-g02b`, and the rendered `s223/cal/disc.html`
      // keeps `id="lst-d11"` immediately after the refused `d10`.
      //
      // ⚠ The REFUSAL ITSELF is unconditional — it is only the closer's fate that turns on the
      // blank line. Gating the opener instead restores four phantom headings that quarto does
      // not render (`scratchpad/s224/f/`, the Session 183 rows): with no blank line the refused
      // lines continue the PARAGRAPH, so the ATX below them is declined by `blank_before_header`
      // exactly as quarto declines it.
      if (refused) {
        const consumed = consumedCloserLine(lines, i + 1, candidate);
        if (consumed >= 0) {
          consumedFenceClosers.add(consumed);
        }
      }
      if (
        !refused &&
        hasCloserBelow(closerIndex, i + 1, candidate, stripQuote ? quoteEnds[i] : undefined)
      ) {
        open = candidate;
        consecutiveBody = 0;
        paragraphOpen = false;
        inPipeTable = false;
        quoteOpen = stripQuote;
        continue;
      }
      // Otherwise the line is ordinary body — the pre-S178 behaviour, unchanged.
    }

    // A blank line breaks paragraph continuity — a setext underline cannot
    // follow one (it becomes a thematic break instead, confirmed against the
    // real Quarto CLI). Still recorded as body, matching existing behavior.
    if (BLANK_LINE.test(line)) {
      bodyLines.push({ line: i, text: raw, contentStart: stripQuote ? (quoteContentStart as number) : 0 });
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = stripQuote;
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
    // ⚠ **THE SETEXT PATH IS DECLINED ON A STRIPPED LINE, AND THAT IS A BOUND ON THIS
    // DELIVERABLE RATHER THAN A RULE (Session 225).** Quarto really does underline inside a
    // quote — `> quoted f02` / `> ---` renders `<blockquote><h2>quoted f02</h2></blockquote>`
    // (`f/f02`) — but the SAME bytes are also a mid-document metadata block, and quarto consumes
    // a quoted one exactly as it consumes a top-level one: `> ---` / `> from: gfm` / `> ---`
    // renders an EMPTY `<blockquote>` (`f/f03`). The pre-pass that models that consumption
    // (`consumedMetadataBlockLines`, and the region walk under it) reads RAW lines and has no
    // block-quote context, so accepting the underline here mints an `h2:from: gfm` quarto does
    // not render — measured, on Session 211's own `cal2/q5_in_quote` row. Declining costs the
    // quoted setext heading this model already did not report; it introduces nothing. Filed.
    // ⚠ **AND NOT WHEN THE TITLE SITS PART-WAY INTO A QUOTE (Session 225), which is where the
    // two rendered rows part company.** `> quoted f01` / `---` — the title is the quote's FIRST
    // line — renders `<h2>&gt; quoted f01</h2>` at top level, marker and all, and an inherited
    // test pins it (`f/f01`). `> Comp quote intro.` / `>` / `> comp quote title` / `  ===`
    // renders NO heading, and this model reported one whose text still carried the `> `
    // (`s202/comp/quote_lazy_gfm`, found by the mover sweep). The lazy half of a quoted setext
    // heading is the same container question the bound above names; declining the part-way case
    // returns the pre-session answer there and leaves the first-line case untouched.
    const setextTitle = titleLineCount >= 1 ? bodyLines[bodyLines.length - titleLineCount] : undefined;
    const setextTitleQuoted =
      setextTitle !== undefined &&
      setextTitle.contentStart > 0 &&
      blockQuoteContentStart(lines[setextTitle.line - 1] ?? "") !== null;
    const setextLevel =
      titleLineCount >= 1 && commonmarkHtmlBlock === null && !stripQuote && !setextTitleQuoted
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
          // ⚠ **THE TITLE IS STRIPPED ONLY WHEN THE UNDERLINE ITSELF IS QUOTED (Session 225),
          // and an inherited test refuted the simpler spelling within the minute.** Rendered:
          // `> quoted f02` / `> ---` nests, `<blockquote><h2>quoted f02</h2></blockquote>`,
          // while `> quoted f01` / `---` — the SAME title line under an UNMARKED underline —
          // renders `<h2>&gt; quoted f01</h2>` at top level, marker and all, because no quote
          // ever forms (`f/f01`, `f/f02`).
          setextTitleText(stripQuote ? prev.text.slice(prev.contentStart) : prev.text, [
            0,
            ...contentColumns,
          ]),
          ...titleLines.slice(1).map((l) => (stripQuote ? l.text.slice(l.contentStart) : l.text)),
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
        headerAttributesDialect,
        escapableSet,
        pandocEscapes,
        commonmarkDialect,
      );
      if (heading) {
        headings.push(heading);
      }
      bodyLines.push({ line: i, text: raw, contentStart: stripQuote ? (quoteContentStart as number) : 0 });
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = stripQuote;
      continue;
    }

    // A live content line (prose or a heading) — outside every skip-region.
    bodyLines.push({ line: i, text: raw, contentStart: stripQuote ? (quoteContentStart as number) : 0 });

    // The columns a raw-TeX block or an indented code block may start at on THIS line: the
    // document root's own 0 plus every open container's. `null` while a block quote may be
    // open — see `quoteOpen`.
    //
    // ⚠ Hoisted above the ATX row by Session 214 so the setext-swallow gate and the body-run
    // counter below share ONE definition of "this line is the second or later line of an
    // indented code run" rather than each carrying its own copy. Nothing between here and the
    // else branch mutates `quoteOpen`, `contentColumns` or `prevIndentedCode` on the path that
    // reads them: the `if (m)` branch that assigns `quoteOpen` is the branch where the else
    // never runs.
    // ⚠ **THE SUSPENSION IS FOR THE LINES THE STRIP DOES NOT REACH (Session 225).** `quoteOpen`
    // means "a quote may be open above this line, and pandoc re-parses its content at a column
    // this scanner cannot compute". On a line the strip DID reach that column is known exactly —
    // it is 0 — and suspending there fabricates headings quarto does not render (`b/b10`,
    // `b/b11`, `b/b01`, `c/c10`; this session's own guard rows G2, G3 and G5 went red on the
    // spelling that left the suspension in place).
    const quoteColumnsUnknown: boolean = quoteOpen && !stripQuote;
    const rawTexColumns: readonly number[] | null = quoteColumnsUnknown
      ? null
      : [0, ...contentColumns];
    const indented = indentedCodeLine(line, rawTexColumns);
    const insideIndentedCode = indented && prevIndentedCode;

    // An ATX heading — but only where no paragraph is open above it, and never inside a raw
    // HTML block under a CommonMark reader, where the block swallows it (Session 204).
    const m =
      commonmarkHtmlBlock !== null ||
      setextUnderlineSwallowsAtx(
        lines[i + 1],
        [0, ...contentColumns],
        commonmarkDialect,
        pendingFreshBlock && !insideIndentedCode ? 1 : consecutiveBody + 1,
      ) ||
      (paragraphOpen && (!dialectOverride || blankBeforeHeaderDialect))
        ? null
        : atxHeadingMatch(
            line,
            // A block quote suspends the rule entirely; an UNRESOLVED `from:` key relaxes it to
            // CommonMark's own tolerance. Both still offer every open container column.
            // ⚠ A `from:` this scanner RESOLVED to the pandoc markdown family takes that
            // tolerance back (Session 206): the 0-3 window belongs to the CommonMark readers,
            // and the relaxation is keyed on the key's mere presence only because the value was
            // unreadable before. Measured, `scratchpad/s206/col` + `col2`, 56 documents.
            quoteColumnsUnknown
              ? null
              : dialectOverride && !markdownFamilyDialect
                ? [...COMMONMARK_HEADING_COLUMNS, ...contentColumns]
                : [0, ...contentColumns],
            tightAtxDialect &&
              literalHtmlLines?.has(i) !== true &&
              !tightAtxWouldWorsen(lines[i + 1], [0, ...contentColumns]),
          );
    if (m) {
      const heading = parseHeadingLine(
        m,
        i,
        commonmarkDialect,
        headerAttributesDialect,
        escapableSet,
        pandocEscapes,
      );
      if (heading) {
        headings.push(heading);
      }
      consecutiveBody = 0;
      paragraphOpen = false;
      inPipeTable = false;
      quoteOpen = stripQuote;
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
      // `rawTexColumns`, `indented` and `insideIndentedCode` are computed ABOVE the ATX row
      // (Session 214) so the setext-swallow gate reads the same counter arithmetic this line
      // does — see `setextUnderlineSwallowsAtx`.
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
      // ⚠ **AND NOT FROM A LINE THE BLOCK-QUOTE STRIP REACHED (Session 225).** The block would
      // outlive the quote that contains it, and quarto's does not: rendered under `from: gfm`,
      // `> <div>` / `# Cnt Golf One` / `# Cnt Golf Two` renders BOTH headings
      // (`h/s204_adv_cnt_cnt_07`, this session's corpus sweep). Modelling a quote-scoped HTML
      // block is a container question of its own; declining to open one costs a phantom heading
      // inside a quoted raw block, never a deletion, and is filed.
      if (commonmarkDialect && commonmarkHtmlBlock === null && !stripQuote) {
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
        // ⚠ RAW, for the same reason `quoteOpen` is (Session 225) — this flag suspends the
        // `CLOSES_PARAGRAPH` gate for a paragraph that began inside a quote, and the lines it
        // then serves are UNMARKED ones the strip never sees.
        paragraphQuoted = BLOCK_QUOTE_MARKER.test(raw);
      }
      // `paragraphOpen` is read for the line ABOVE before being overwritten for this one.
      // Annotated for the same TS7022 reason as `lineBlockAbove` above — this snapshot feeds
      // the `lineBlockOpen` assignment, which `closesParagraph` reads back on the next line.
      // ⚠ **READ AGAINST THE LINE ABOVE'S `paragraphOpen`, AND THAT IS THE WHOLE OPENER RULE**
      // (Session 226). A div fence may open a div only where no paragraph is already open —
      // rendered, `para one` / `::: {.note}` / `body text` / `:::` / `# H h01` renders NO
      // heading, because the opener cannot interrupt the paragraph and so its `:::` below
      // closes nothing (`r3/h01`), while the same document with a blank line after `para one`
      // renders the heading (`r3/h04`). `paragraphOpen` is still the line ABOVE's here; it is
      // overwritten immediately below.
      const divFence = divFenceRole(line);
      const divRole = divFence?.role ?? null;
      // ⚠ **A CLOSER MUST SIT AT ITS CONTAINER'S OWN CONTENT COLUMN, AND ` {0,3}` IS NOT THAT**
      // (Session 227). Rendered, `::: {.note}` / `body text` / `  :::` is ONE paragraph —
      // `<p>body text ::: # H k03</p>` — because pandoc's `divFenceEnd` reads the colon run
      // with no leading-space parser at all, so the run must begin exactly where the enclosing
      // block's content does. The set is `[0, ...contentColumns]`, the same array the setext
      // underline and the ATX heading are measured against, because a shallow line is absorbed
      // LAZILY into the open paragraph of the container above it and appended RAW: `- item` /
      // `  ::: {.note}` / `  body text` / `:::` closes at column 0 (`r1/k17`), and a
      // three-deep `    :::` closes at the OUTER item's column 2 (`r2/m02`). Column 1 belongs
      // to no container and closes nothing at either depth (`r1/k18`, `r2/m11`).
      const divFenceColumns = [0, ...contentColumns];
      const divAtColumn: boolean =
        divFence !== null && divFenceColumns.includes(divFence.column);
      // ⚠ **A LIST MARKER BEGINS A FRESH BLOCK, so an opener behind one interrupts nothing.**
      // The last 2 of the sweep's 39 deletions: `- item a` / `- ::: mydiv` / `  line one` /
      // `:::` / `# ATX Below` leaves a paragraph open at the marker line, and declining the
      // opener there left the `:::` below closing nothing (`R10_ul_2items_open`, and the
      // nested `R11_ul_nested_open`). Both render the heading.
      const divOpenerInterrupts: boolean = paragraphOpen && divFence?.viaListMarker !== true;
      // ⚠ **"A `...` THAT REACHES HERE TERMINATES NOTHING" IS REFUTED, AND THE GUARD CAUGHT IT
      // WITHIN THE MINUTE.** `consumedMetadataLines` does skip a block it recognises — but it
      // reads RAW lines, so a QUOTED block is invisible to it (`r2/q_g09`, a rendered heading
      // that rule deleted), and it recognises only a blank-preceded span under a reader that
      // consumes one, so Session 180's own `intro` / `---` / `subtitle: mid` / `...` / `# foo`
      // row reaches here too and really does render its heading. So the terminator needs the
      // same block state the div fence needs, not an inference from where it was tested.
      const yamlOpens = YAML_BLOCK_OPENER.test(line);
      const yamlTerminates = YAML_BLOCK_TERMINATOR.test(line);
      const texEnv = RAW_TEX_ENV_DELIM.exec(line);
      // A `\begin{}` is a real opener only when its own `\end{}` appears BELOW it; an `\end{}`
      // is a real closer only when one is open. Everything else in this family is inline text.
      // ⚠ **A ONE-LINE ENVIRONMENT IS COMPLETE WHERE IT STANDS** — `>= i`, not `> i`. Asking for
      // the matching delimiter STRICTLY below deleted 19 of the 39 headings this session's
      // 47,125-document sweep caught: `\begin{center}x\end{center}` / `# ATX Below` found no
      // `\end{center}` at all and left a paragraph open across a heading quarto renders
      // (`scratchpad/s183/R8-rawtex-refute/docs/B__env_oneline__at_start`). Such a line opens
      // and closes at once, so it must NOT move the stack either — see below.
      const texEnvSelfContained: boolean =
        texEnv !== null &&
        texEnv[1] === "begin" &&
        new RegExp("\\\\end\\{" + texEnv[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\}").test(
          line.slice(texEnv[0].length),
        );
      // ⚠ **EVERY `\end{}` ON THE LINE, MATCHED LIFO** — the same lesson `lastRawTexEnvEnd`
      // learned, now on the matching side, and the C6 test is what caught it: `\begin{a}` /
      // `body text` / `\end{b}\end{a}` really does close `a`, so reading only the delimiter
      // that STARTS the line calls it unmatched and deletes the heading below.
      let texEndPops = 0;
      if (texEnv !== null && texEnv[1] === "end") {
        const probe = [...rawTexEnvStack];
        const scan = /\\end\{([^}]*)\}/g;
        for (let m = scan.exec(line); m !== null; m = scan.exec(line)) {
          if (probe[probe.length - 1] === m[1]) {
            probe.pop();
            texEndPops++;
          }
        }
      }
      const texEnvMatched: boolean =
        texEnv === null
          ? false
          : texEnv[1] === "begin"
            ? (rawTexEnvEnds.get(texEnv[2]) ?? -1) >= i
            : texEndPops > 0;
      const unmatchedConstruct: boolean =
        divRole === "close"
          ? !divAtColumn || divDepth === 0
          : divRole === "open"
            ? divOpenerInterrupts
            : texEnv !== null
              ? !texEnvMatched
              : yamlTerminates && !metadataBlockOpen;
      if (divRole === "close" && divAtColumn && divDepth > 0) {
        divDepth--;
      } else if (divRole === "open" && !divOpenerInterrupts) {
        divDepth++;
      }
      // ⚠ **ARMING THIS FLAG CHANGES NO ANSWER BY ITSELF, WHICH IS WHY IT IS SAFE ON A LINE AS
      // OVERLOADED AS `---`.** A `-{3,}` line is already a thematic break to `closesParagraph`
      // and stays one; all this records is that a metadata block MIGHT be open, so a later
      // `...` is judged matched rather than unmatched. Against an OPEN paragraph a `---` opens
      // nothing — rendered, `para one` / `para two` / `---` / `# H` is ONE paragraph with the
      // dashes as an EM DASH (`r1/t_tbreak`), and `para one` / `---` / `key: v` / `...` / `# H`
      // renders the setext `<h2>para one</h2>` and no `H` at all (`r3/h03`).
      if (metadataBlockOpen && (yamlOpens || yamlTerminates)) {
        metadataBlockOpen = false;
      } else if (yamlOpens && !paragraphOpen) {
        metadataBlockOpen = true;
      }
      if (texEnvMatched && !texEnvSelfContained) {
        if (texEnv![1] === "begin") {
          rawTexEnvStack.push(texEnv![2]);
        } else {
          for (let k = 0; k < texEndPops; k++) {
            rawTexEnvStack.pop();
          }
        }
      }
      const wasParagraphOpen: boolean = paragraphOpen;
      paragraphOpen = !closesParagraph(
        line,
        paragraphOpen,
        prevLineWasAtxHeading,
        // ⚠ **THE SUSPENSION IS FOR A LINE THE STRIP DID NOT REACH (Session 225)** — the same
        // boundary `quoteColumnsUnknown` draws, and the corpus sweep is what found it. S183's
        // suspension exists because a closer inside a quote was invisible; on a MARKED line it
        // no longer is, and leaving it on made three families of quoted block openers close a
        // paragraph pandoc keeps open, fabricating the heading on the UNMARKED line below.
        // Rendered, all three render no heading at all, quoted AND at top level:
        // `> quoted one` / `> \clearpage`, `> quoted one` / `>     code`, and
        // `> line one` / `> line two` / `> ##`, each followed by `# ATX Below` (`i/i04`,
        // `i/i07`, `i/i08`, with their top-level twins `i/j01`-`i/j03`).
        paragraphQuoted && !stripQuote,
        // ⚠ **A LINE BLOCK TAKES A CONTINUATION ONLY FROM ITS OWN CONTAINER (Session 226)** —
        // see `lineBlockQuoted`. An UNMARKED line below a quoted line block is pandoc's LAZY
        // continuation of the quote's paragraph, so it closes nothing and the ATX below it is
        // not a heading (`r1/lz1`); the MARKED twin closes the block and its ATX is real
        // (`r1/lz2`). This reverses Session 225's R2 residual pin.
        lineBlockAbove && lineBlockQuoted === stripQuote,
        rawTexColumns,
        unmatchedConstruct,
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
        ((lineBlockAbove && lineBlockQuoted === stripQuote && LINE_BLOCK_CONTINUATION.test(line)) ||
          (!wasParagraphOpen && LINE_BLOCK_LINE.test(line)));
      if (lineBlockOpen) {
        lineBlockQuoted = stripQuote;
      }
    }
  }

  // CommonMark: an unclosed fence runs to end of document — its last line IS
  // body. Keep such a cell runnable (e.g. while still being typed).
  if (open !== null && open.isCell) {
    cells.push(makeCell(open, lines.length - 1, lines, false));
  }

  return { headings, cells, bodyLines, codeFenceOpeners, frontMatter };
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
 * Every PLAIN fenced code block opener in `text`, in document order — see
 * {@link CodeFenceOpener} for why this is exposed at all.
 */
export function findCodeFenceOpeners(text: string): CodeFenceOpener[] {
  return scanRegions(text).codeFenceOpeners.slice();
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
  // ⚠ **QUOTED CLOSERS GET THEIR OWN NAMESPACE, AND THAT SEPARATION IS THE WHOLE POINT
  // (Session 225).** A `>`-prefixed fence run closes NOTHING at top level — rendered, the whole
  // of `> ``` ` stays inside the code block it sits in (`d/d02`) — so these keys may only be
  // reached by an opener that is itself inside a quote. Folding them into `p|` would close
  // every top-level fence early. The LAZY closer needs no key of its own: an UNMARKED closing
  // fence really does close a fence opened inside a quote (`b/b05`), and it is already in `p|`.
  for (let i = 0; i < lines.length; i++) {
    const contentStart = blockQuoteContentStart(lines[i]);
    if (contentStart === null) {
      continue;
    }
    const content = lines[i].slice(contentStart);
    const m = FENCE_CLOSE.exec(content);
    if (m === null) {
      continue;
    }
    const col = indentColumn(content);
    for (let n = 3; n <= m[1].length; n++) {
      push(`q|${m[2]}|${n}|${col}`, i);
    }
  }
  return index;
}

/**
 * For each line, the index of the first line at or below it that ENDS a block quote — an
 * UNMARKED blank line — or `lines.length` when none does (Session 225).
 *
 * ⚠ A fence opened inside a quote may only be closed while the quote is still open. Rendered:
 * `> ``` ` / `> a c04` / (blank) / ``` ` leaves the fence UNCLOSED and renders it as literal
 * text (`c/c04`), where the same document without the blank line closes it lazily (`b/b05`).
 * Without this bound the lazy-closer lookup reaches a run belonging to an entirely different
 * block further down the document.
 */
function blockQuoteEndIndex(lines: readonly string[]): number[] {
  const ends = new Array<number>(lines.length);
  let end = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (blockQuoteContentStart(lines[i]) === null && BLANK_LINE.test(lines[i])) {
      end = i;
    }
    ends[i] = end;
  }
  return ends;
}

/**
 * The line that closes `open` when NO blank line comes first, or `-1` — the fence line a
 * refused opener has already swallowed into an INLINE CODE SPAN, which therefore may not open
 * a region of its own (Session 224).
 *
 * ⚠ **Scanned rather than indexed, and the bound is why that is safe.** It runs only for an
 * opener whose info string was already refused AND which `hasCloserBelow` has already said is
 * closed, and it stops at the FIRST blank line or that closer, whichever comes first — so it
 * never walks to end of document the way the pre-Session-179 closer search did.
 */
function consumedCloserLine(
  lines: readonly string[],
  from: number,
  open: OpenCellFence,
): number {
  for (let k = from; k < lines.length; k++) {
    if (lines[k].trim() === "") {
      return -1;
    }
    if (isCloser(lines[k], open)) {
      return k;
    }
  }
  return -1;
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
function hasCloserBelow(
  index: Map<string, number[]>,
  from: number,
  open: OpenCellFence,
  until = Number.MAX_SAFE_INTEGER,
): boolean {
  if (open.isCell) {
    return bucketReaches(index.get(`c|${open.char}|${open.len}`), from, until);
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
    if (bucketReaches(index.get(`p|${open.char}|${open.len}|${col}`), from, until)) {
      return true;
    }
    // A fence opened INSIDE a quote is also closed by a MARKED closer, whose run sits past the
    // marker and so carries its own column (Session 225).
    if (open.quoted && bucketReaches(index.get(`q|${open.char}|${open.len}|${col}`), from, until)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether `bucket` holds a line at or below `from` and BELOW `until` — binary search; buckets
 * are ascending. `until` is exclusive and defaults to unbounded; it carries the block-quote
 * end for a quoted opener (see `blockQuoteEndIndex`).
 */
function bucketReaches(bucket: number[] | undefined, from: number, until: number): boolean {
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
  return lo < bucket.length && bucket[lo] < until;
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
 * Build a `Heading` from a raw heading-text line, or `null` if nothing displayable remains.
 * Strips a trailing Pandoc attribute block (shared by ATX and setext) and then, when `closing`
 * is non-null, that reader's closing-hash run.
 *
 * `closing` is `null` for setext, which has no such convention: a literal trailing `#` run in
 * setext text is kept verbatim under BOTH spellings (`s215/cal2/b_setext` → `h1:Cal Romeo Set#`,
 * `b_setextsp` → `h1:Cal Sierra Set #`, and Session 214's `s214/cal2/e_close` independently).
 * For ATX it is `atxClosingRun`'s per-reader choice — a boolean until Session 215, when the
 * closing sequence turned out to be spelled differently by the two reader families.
 *
 * ⚠ **`honoursAttributes` gates the block for BOTH paths, and the setext path is why it is a
 * parameter of THIS function rather than of `parseHeadingLine`** (Session 216). Five of the nine
 * measured readers render a trailing `{…}` as ordinary text, and they do so on setext headings
 * too — `cal/a_gfm_setext` renders `<h1>Cal Golf Set {#sec-gfm-st}</h1>`. That is the inverse of
 * Session 215's closing run, where the setext path was already right and had to be held still;
 * here it was wrong for five readers, and a pre-existing unit pin recorded the wrong answer in
 * its own comment for three sessions.
 *
 * ⚠ **When the reader does not honour the block, NEITHER the text NOR the id may move.** Keeping
 * the id while leaving the braces in the text would put a `sec-` target in the cross-reference
 * index (`src/core/refs.ts`) that the rendered document never defines — a reference that resolves
 * here and dangles there.
 */
function buildHeading(
  level: number,
  rawText: string,
  line: number,
  closing: RegExp | null,
  honoursAttributes: boolean,
  escapable: RegExp,
  pandocEscapes: boolean,
  commonmarkDialect: boolean,
): Heading | null {
  const brace = honoursAttributes ? HEADING_ATTRIBUTE.exec(rawText) : null;
  // ⚠ **A brace group at the end of a heading is not an attribute block just because it is
  // there** (Session 218). `HEADING_ATTRIBUTE` says only WHERE a block would be; whether the
  // content IS one is `headingAttributesValid`'s question, and getting it wrong deletes either
  // text the reader sees or a `sec-` target the document defines. The content is read RAW, before
  // `decodeHeadingEscapes` — a predicate run on decoded text would see `{#sec-a:x}` where the
  // source says `{#sec-a\:x}`, judge it valid, and strip exactly the block quarto keeps.
  const attribute =
    brace &&
    headingAttributesValid(
      brace[0].replace(/^\{/, "").replace(/\}[ \t]*$/, ""),
      commonmarkDialect,
      pandocEscapes,
    )
      ? brace
      : null;
  const id = attribute
    ? headingAttributeId(
        attribute[0].replace(/^\{/, "").replace(/\}[ \t]*$/, ""),
        commonmarkDialect,
        pandocEscapes,
      )
    : undefined;
  let text = attribute ? rawText.replace(HEADING_ATTRIBUTE, "") : rawText;
  if (closing !== null) {
    text = text.replace(closing, "");
  }
  // ⚠ **AFTER both strips, and the order is a measured constraint rather than a preference**
  // (Session 217). Decoding first turns `\{#sec-esc}` into `{#sec-esc}`, which the attribute
  // rule would then strip — deleting text quarto renders as ordinary braces and inventing a
  // `sec-` cross-reference target the document never defines (`scratchpad/s217/cal4/d_md_attr1`,
  // where quarto renders `Cal Par1 Attr {#sec-par1}` and defines NO id). Both strips therefore
  // read the RAW text, and the decode runs on what survives them.
  text = decodeHeadingEscapes(text, escapable, pandocEscapes);
  text = text.trim();
  if (!text) {
    return null;
  }
  return id ? { level, text, line, id } : { level, text, line };
}

/**
 * Build a `Heading` from a matched ATX line, or `null` if nothing displayable remains. The
 * display text drops a trailing Pandoc attribute block and this reader's ATX closing-hash run,
 * so `## Methods {#sec-methods}` → "Methods" and an all-hash `## ##` → dropped.
 *
 * ⚠ `commonmarkDialect` decides WHICH closing-hash spelling applies — the run needs a space
 * before it under `gfm`/`commonmark`/`commonmark_x` and does not under the pandoc `markdown*`
 * family. See `ATX_CLOSING_PANDOC` for the nine-reader table.
 *
 * ⚠ **`honoursAttributes` is a SEPARATE reader question and the two answers do not line up** —
 * `commonmark_x` is a CommonMark dialect that DOES honour the attribute block, while
 * `markdown_github` is a pandoc-family reader that does not. See
 * `FRONTMATTER_HEADER_ATTRIBUTES_OFF_FROM` for the 4–5 table; passing one flag for both
 * questions gets four readers wrong.
 */
function parseHeadingLine(
  m: RegExpExecArray,
  line: number,
  commonmarkDialect: boolean,
  honoursAttributes: boolean,
  escapable: RegExp,
  pandocEscapes: boolean,
): Heading | null {
  return buildHeading(
    m[1].length,
    m[2],
    line,
    atxClosingRun(commonmarkDialect),
    honoursAttributes,
    escapable,
    pandocEscapes,
    commonmarkDialect,
  );
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
  honoursAttributes: boolean,
  escapable: RegExp,
  pandocEscapes: boolean,
  commonmarkDialect: boolean,
): Heading | null {
  return buildHeading(
    level,
    rawText,
    line,
    null,
    honoursAttributes,
    escapable,
    pandocEscapes,
    commonmarkDialect,
  );
}
