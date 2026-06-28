/**
 * Pure, `vscode`-free region model for a Quarto `.qmd` document.
 *
 * This module lives in `core/` and MUST NOT import `vscode` (architecture plan
 * §3.3 — "the load-bearing guardrail"). It is the single source of truth for
 * parsing a `.qmd` into its structural regions — YAML front matter, ATX
 * headings, and executable code cells — and is unit-tested headlessly. Phase 6a
 * consumes it for the document outline; Phases 6b–6e (cross-refs, citations)
 * build their indexes on top of the same parse.
 */

/** An ATX (`#`..`######`) markdown heading outside any code fence / front matter. */
export interface Heading {
  /** Heading level, 1–6 (number of leading `#`). */
  level: number;
  /** Heading text with the `#` markers and any closing `#` sequence stripped. */
  text: string;
  /** 0-based line index of the heading. */
  line: number;
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
/** An optional closing sequence: spaces, then a run of `#`, to end of line. */
const ATX_CLOSING = /[ \t]+#+[ \t]*$/;
/**
 * A fence opener: leading indent, then ≥3 of ONE fence char (backtick or
 * tilde), then anything. Capturing the char lets the scanner require the closer
 * to use the same char (CommonMark), so a backtick run can't close a tilde
 * block and vice versa. Shared with cell detection below.
 */
const FENCE_OPEN = /^[ \t]*(([`~])\2{2,})(.*)$/;
/** A closing fence: leading indent, ≥3 of one fence char only, optional trailing space. */
const FENCE_CLOSE = /^[ \t]*(([`~])\2{2,})[ \t]*$/;
/** The `---` line that opens a YAML front-matter block — only valid at line 0. */
const FRONTMATTER_OPEN = /^---[ \t]*$/;
/** A YAML front-matter terminator: `---` or `...` (YAML's document-end marker). */
const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;
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

/** Find every ATX heading in `text`, in document order. */
export function findHeadings(text: string): Heading[] {
  const lines = text.split(/\r?\n/);
  const headings: Heading[] = [];
  let open: OpenFence | null = null;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && FRONTMATTER_OPEN.test(line)) {
      // A leading `---` opens YAML front matter (Quarto requires it at the very
      // start). Its `#` lines are YAML comments, never headings.
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (FRONTMATTER_CLOSE.test(line)) {
        inFrontmatter = false;
      }
      continue;
    }
    if (open !== null) {
      // Inside a code fence: nothing here is a heading. CommonMark closes a
      // fence with ≥N of the SAME char and no info string.
      if (isCloser(line, open)) {
        open = null;
      }
      continue;
    }
    const fence = FENCE_OPEN.exec(line);
    if (fence) {
      open = { char: fence[2], len: fence[1].length };
      continue;
    }
    const m = ATX_HEADING.exec(line);
    if (m) {
      const heading = parseHeadingLine(m, i);
      if (heading) {
        headings.push(heading);
      }
    }
  }
  return headings;
}

/** True if `line` closes the given open fence (same char, length ≥ opener). */
function isCloser(line: string, open: OpenFence): boolean {
  const m = FENCE_CLOSE.exec(line);
  return m !== null && m[2] === open.char && m[1].length >= open.len;
}

/**
 * Find every executable `{lang}` code cell in `text`, in document order. A
 * single linear pass tracks fence open/close (CommonMark: a fence opened with N
 * of a char is closed by a line of ≥N of that char with no info string), so it
 * correctly excludes plain ```` ```python ```` fences, the ```` ```{{python}} ````
 * display form, ```` ```{.python} ```` Pandoc class blocks, and any `{lang}`
 * fence nested inside an outer (longer or tilde) fence.
 */
export function findAllCells(text: string): Cell[] {
  const lines = text.split(/\r?\n/);
  const cells: Cell[] = [];
  let open: OpenCellFence | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open === null) {
      const m = FENCE_OPEN.exec(line);
      if (m) {
        const char = m[2];
        // Only backtick fences are executable cells; tilde fences are literal.
        const info = char === "`" ? CELL_INFO.exec(m[3].trim()) : null;
        open = {
          char,
          len: m[1].length,
          isCell: info !== null,
          lang: info ? info[1] : "",
          startLine: i,
        };
      }
    } else if (isCloser(line, open)) {
      if (open.isCell) {
        // The closing fence (line `i`) is not part of the body.
        cells.push({
          startLine: open.startLine,
          endLine: i,
          lang: open.lang,
          code: lines.slice(open.startLine + 1, i).join("\n"),
        });
      }
      open = null;
    }
  }

  // CommonMark: an unclosed fence runs to the end of the document — its last
  // line IS body. Keep such a cell runnable (e.g. while still being typed).
  if (open !== null && open.isCell) {
    cells.push({
      startLine: open.startLine,
      endLine: lines.length - 1,
      lang: open.lang,
      code: lines.slice(open.startLine + 1).join("\n"),
    });
  }

  return cells;
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
  const headings = findHeadings(text);
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
    ...findAllCells(text).map((c) => ({
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

/** Build a `Heading` from a matched ATX line, or `null` if the text is empty. */
function parseHeadingLine(m: RegExpExecArray, line: number): Heading | null {
  const text = m[2].replace(ATX_CLOSING, "").trim();
  return text ? { level: m[1].length, text, line } : null;
}
