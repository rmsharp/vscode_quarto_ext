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
 * A fence opener: up to 3 spaces of indentation (CommonMark §4.5 — 4+ spaces is
 * indented code, not a fence), then ≥3 of ONE fence char (backtick or tilde),
 * then anything. Capturing the char lets the scanner require the closer to use
 * the same char, so a backtick run can't close a tilde block and vice versa.
 * The 0–3 cap matches the ATX heading rule so the two never disagree on what
 * counts as indented code. Shared with cell detection below.
 */
const FENCE_OPEN = /^ {0,3}(([`~])\2{2,})(.*)$/;
/** A closing fence: 0–3 spaces, ≥3 of one fence char only, optional trailing space. */
const FENCE_CLOSE = /^ {0,3}(([`~])\2{2,})[ \t]*$/;
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
 * A brace info string for an *executable* cell: `{` then a language identifier
 * (a letter-led token), optionally followed by knitr-style options, then `}`.
 * Requiring a letter immediately after `{` excludes `{{python}}` (the display
 * form) and `{.python}` (a Pandoc class) — both non-executable.
 */
const CELL_INFO = /^\{([A-Za-z][A-Za-z0-9_-]*)[^}]*\}$/;
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
  /** The owning cell's engine/language, e.g. `"python"`, `"r"`, `"ojs"`. */
  cellLang: string;
  /** The comment-option prefix actually used on the line. */
  prefix: "#|" | "//|";
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
  const headings: Heading[] = [];
  const cells: Cell[] = [];
  const bodyLines: BodyLine[] = [];
  let frontMatter: FrontMatterSpan | null = null;
  let inFrontmatter = false;
  let inComment = false;
  let open: OpenCellFence | null = null;
  // Count of consecutive fresh, non-blank body lines immediately above the
  // current line, reset to 0 on any region boundary (front matter, comment,
  // fence, blank line) or heading (ATX or setext). A setext underline is only
  // recognized when this is exactly 1 — see `SETEXT_H1`'s docstring.
  let consecutiveBody = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // YAML front matter — only a `---` on the very first line opens it. Record
    // the span as it opens (provisionally unterminated, ending at EOF) and refine
    // `endLine`/`terminated` when the terminator is seen.
    if (i === 0 && FRONTMATTER_OPEN.test(line)) {
      inFrontmatter = true;
      frontMatter = { startLine: 0, endLine: lines.length - 1, terminated: false };
      continue;
    }
    if (inFrontmatter) {
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
      continue;
    }
    if (COMMENT_OPEN.test(line) && !COMMENT_CLOSE.test(line)) {
      inComment = true;
      consecutiveBody = 0;
      continue;
    }

    // A fence opener (captures cell metadata so the closer can emit the cell).
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      const char = fence[2];
      const info = char === "`" ? CELL_INFO.exec(fence[3].trim()) : null;
      open = {
        char,
        len: fence[1].length,
        isCell: info !== null,
        lang: info ? info[1] : "",
        startLine: i,
      };
      consecutiveBody = 0;
      continue;
    }

    // A blank line breaks paragraph continuity — a setext underline cannot
    // follow one (it becomes a thematic break instead, confirmed against the
    // real Quarto CLI). Still recorded as body, matching existing behavior.
    if (BLANK_LINE.test(line)) {
      bodyLines.push({ line: i, text: line });
      consecutiveBody = 0;
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
      continue;
    }

    // A live content line (prose or a heading) — outside every skip-region.
    bodyLines.push({ line: i, text: line });

    // An ATX heading.
    const m = ATX_HEADING.exec(line);
    if (m) {
      const heading = parseHeadingLine(m, i);
      if (heading) {
        headings.push(heading);
      }
      consecutiveBody = 0;
    } else {
      consecutiveBody++;
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
 * A cell-option line, matching Quarto's own directive pattern `^#\s*\| ?` (and
 * `^//\s*\| ?` for ojs/js): the comment char (`#` or `//`) at COLUMN 0 — no
 * leading indentation, since Quarto treats an indented `#|` as ordinary code —
 * then optional whitespace, the pipe, an optional gap, and the option
 * `key[: value]`. Group 1 is the comment char, 2 the whitespace between it and
 * the pipe, 3 the gap before the key, 4 the remainder. Anchored at `^` so column
 * math is exact.
 */
const CELL_OPTION_PREFIX = /^(#|\/\/)([ \t]*)\|([ \t]*)(.*)$/;

/**
 * Every `#|` / `//|` cell-option line inside an executable cell, in document
 * order. A view over the shared scanner (`findAllCells`) — never a second scanner
 * (Learning #14): only interior lines of executable `{lang}` cells are examined,
 * so a `#|` in prose, in a non-executable ```` ```python ```` block, or on a
 * fence line is never reported. The owning cell supplies the absolute line and
 * engine.
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
    bodyLines.forEach((lineText, j) => {
      const m = CELL_OPTION_PREFIX.exec(lineText);
      if (m === null) {
        flowDepth = 0; // a code line ends any multi-line option value
        openQuote = null;
        return;
      }
      if (flowDepth > 0 || openQuote !== null) {
        // A continuation of a multi-line quoted/flow value on a prior `#|` line — skip it.
        const s = scanFlow(m[4], flowDepth, openQuote);
        flowDepth = Math.max(0, s.depth);
        openQuote = s.quote;
        return;
      }
      // keyStart = comment chars + inter-pipe ws + the `|` + the gap before the key.
      const keyStart = m[1].length + m[2].length + 1 + m[3].length;
      const { keySlot, valueSlot } = slotsOf(m[4], keyStart);
      result.push({
        line: cell.startLine + 1 + j,
        cellLang: cell.lang,
        prefix: m[1] === "#" ? "#|" : "//|",
        keySlot,
        valueSlot,
      });
      // Arm the continuation-skip only if THIS option's VALUE actually OPENS an unclosed
      // quoted scalar / flow collection, decided by the value token's FIRST character past a
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
      const armColon = m[4].indexOf(":");
      const armToken =
        armColon < 0
          ? m[4].replace(/^-[ \t]*/, "").trimEnd()
          : m[4].slice(armColon + 1).replace(/^[ \t]+/, "").trimEnd();
      // Strip a leading node property before the first-char test. The name charset excludes
      // flow indicators/quotes (`[]{}"'`), so the strip stops at — and thus SEES — an opener
      // that ABUTS the anchor/tag with no space (`&a[one,`, which js-yaml/quarto accept and
      // fold: fig-cap takes a list, so it renders exit 0 — flagging its folded continuation
      // would be a cardinal-sin FP the whole-token arm avoided; §9 branch-interaction lens,
      // S154). The trailing ws is optional so both `&a [one,` and `&a[one,` strip to `[one,`.
      const opener = armToken.replace(/^(?:[&!][^\s[\]{}"']*[ \t]*)+/, "")[0];
      if (opener === '"' || opener === "'" || opener === "[" || opener === "{") {
        const s = scanFlow(armToken, 0, null);
        flowDepth = s.depth > 0 ? s.depth : 0;
        openQuote = s.quote;
      }
    });
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
 * over-skip). Node properties (`&anchor`/`*alias`/`!tag`) contain no brackets, so they
 * contribute 0 automatically; scanning the WHOLE token is therefore node-property-aware.
 * Over-skipping when ambiguous (a stray brace/quote in a plain scalar) is the safe
 * false-negative direction. Quote-AWARE — deliberately NOT a naive bracket-only counter.
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

/** True if `line` closes the given open fence (same char, length ≥ opener). */
function isCloser(line: string, open: OpenFence): boolean {
  const m = FENCE_CLOSE.exec(line);
  return m !== null && m[2] === open.char && m[1].length >= open.len;
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
