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
 * Known limitation (intentional v1 scope): only ATX headings (`#`..`######`) are
 * recognized. Setext headings (a line underlined with `===` or `---`) are not —
 * disambiguating a setext `---` from a thematic break and the front-matter fence
 * needs its own pass; tracked in the backlog.
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
 * cross-references), so it is stripped from the outline display name here.
 */
const ATX_ATTRIBUTE = /(?:^|[ \t]+)\{[^}]*\}[ \t]*$/;
/**
 * The `#identifier` inside a Pandoc attribute block. Pandoc separates id, classes
 * (`.x`), and key=val pairs by whitespace, so the id runs from `#` to the next
 * whitespace or closing brace: `{#sec-intro .unnumbered}` → `sec-intro`.
 */
const ATTR_ID = /#([^\s}]+)/;
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
 * with a trailing comment is left as body (the content half is real).
 */
const COMMENT_FULL_LINE = /^[ \t]*<!--.*-->[ \t]*$/;
/**
 * A brace info string for an *executable* cell: `{` then a language identifier
 * (a letter-led token), optionally followed by knitr-style options, then `}`.
 * Requiring a letter immediately after `{` excludes `{{python}}` (the display
 * form) and `{.python}` (a Pandoc class) — both non-executable.
 */
const CELL_INFO = /^\{([A-Za-z][A-Za-z0-9_-]*)[^}]*\}$/;

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

/** The parsed structural regions of a document. */
interface Regions {
  headings: Heading[];
  cells: Cell[];
  bodyLines: BodyLine[];
}

/**
 * Walk the document once, classifying each line by region so that heading and
 * cell detection AGREE on what to skip: YAML front matter (a leading
 * `---`…`---`/`...`), block HTML comments (`<!-- … -->`, which Pandoc does not
 * render), and code fences. This single pass is the model's source of truth;
 * `findHeadings`, `findAllCells`, and `buildOutline` are thin views over it.
 *
 * Cell rules (CommonMark + Quarto): a fence opened with N of a char closes on a
 * line of ≥N of that char with no info string. Only a backtick fence whose info
 * string is a brace-wrapped language (```` ```{python} ````) is an executable
 * cell — this excludes plain ```` ```python ````, the ```` ```{{python}} ````
 * display form, ```` ```{.python} ```` Pandoc class blocks, and any `{lang}`
 * fence nested inside an outer (longer or tilde) fence.
 */
function scanRegions(text: string): Regions {
  const lines = text.split(/\r?\n/);
  const headings: Heading[] = [];
  const cells: Cell[] = [];
  const bodyLines: BodyLine[] = [];
  let inFrontmatter = false;
  let inComment = false;
  let open: OpenCellFence | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // YAML front matter — only a `---` on the very first line opens it.
    if (i === 0 && FRONTMATTER_OPEN.test(line)) {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (FRONTMATTER_CLOSE.test(line)) {
        inFrontmatter = false;
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
      continue;
    }
    if (COMMENT_OPEN.test(line) && !COMMENT_CLOSE.test(line)) {
      inComment = true;
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
    }
  }

  // CommonMark: an unclosed fence runs to end of document — its last line IS
  // body. Keep such a cell runnable (e.g. while still being typed).
  if (open !== null && open.isCell) {
    cells.push(makeCell(open, lines.length - 1, lines, false));
  }

  return { headings, cells, bodyLines };
}

/** Find every ATX heading in `text`, in document order. */
export function findHeadings(text: string): Heading[] {
  return scanRegions(text).headings;
}

/** Find every executable `{lang}` code cell in `text`, in document order. */
export function findAllCells(text: string): Cell[] {
  return scanRegions(text).cells;
}

/**
 * Every live content line — prose and heading lines that are outside YAML front
 * matter, block HTML comments, and code fences. The cross-ref layer scans these
 * for inline `{#fig-…}`/`{#tbl-…}` attribute blocks without re-deriving the
 * skip-regions (the shared-scanner guarantee — see Learning #14).
 */
export function findBodyLines(text: string): BodyLine[] {
  return scanRegions(text).bodyLines;
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
 * Build a `Heading` from a matched ATX line, or `null` if nothing displayable
 * remains. The display text drops a trailing Pandoc attribute block and any ATX
 * closing-hash run, so `## Methods {#sec-methods}` → "Methods" and an all-hash
 * `## ##` → dropped.
 */
function parseHeadingLine(m: RegExpExecArray, line: number): Heading | null {
  const attribute = ATX_ATTRIBUTE.exec(m[2]);
  const id = attribute ? ATTR_ID.exec(attribute[0])?.[1] : undefined;
  const text = m[2]
    .replace(ATX_ATTRIBUTE, "")
    .replace(ATX_CLOSING, "")
    .trim();
  if (!text) {
    return null;
  }
  return id
    ? { level: m[1].length, text, line, id }
    : { level: m[1].length, text, line };
}
