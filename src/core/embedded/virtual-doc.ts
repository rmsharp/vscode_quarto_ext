/**
 * Pure, `vscode`-free heart of Phase 6e embedded-cell completion (plan §5,
 * gaps G2/G4). This module MUST NOT import `vscode` (architecture §3.3) and is
 * unit-tested headlessly. Two views over the shared region model
 * (`core/qmd/model`) — never a second scanner (Learning #14):
 *
 *  - `embeddedCellAt` — the cursor gate: is `line` an interior code-BODY line of
 *    an executable cell whose engine maps to a forwarding target?
 *  - `buildVirtualContent` — the per-language virtual document: keep that
 *    language's cell bodies verbatim, blank everything else to equal-length
 *    space runs (identity offset mapping, plan §2.3).
 */

import {
  type Cell,
  findAllCells,
  findCellAtPosition,
  findCellOptionLines,
} from "../qmd/model";
import type { RenderMode } from "../render-mode";
import { cellLanguageId, type EmbeddedLang } from "./lang-map";

/** What the caller knows about the document's execution engine (`undefined`: nothing), as the model reads it: the type of the second parameter of `findAllCells`. */
type EngineHint = Parameters<typeof findAllCells>[1];

/**
 * The file-level mute injected on a python vdoc's line 0 (candidate G, plan §4.1). Under
 * Pylance's non-default `python.analysis.diagnosticMode: "workspace"`, opening a background
 * vdoc model injects it into Pyright's TRACKED set (`didOpen`, `service.ts`) — bypassing the
 * default dot-directory exclude and independent of the file's location — so it gets diagnosed
 * even though the user never opened it, flooding the Problems panel with phantom errors on
 * the vdoc paths under `.quarto/vdoc-mit/` (e.g. `"df" is not defined` from a per-cell vdoc
 * that blanks the sibling cell that defined `df`). A first-line file-level `# type: ignore`
 * mutes every diagnostic in the file (PEP 484 / Pyright) while leaving completion, hover, and
 * imports untouched (it filters diagnostic OUTPUT only). It is python-only because `#` is a JS
 * SYNTAX error — never inject it into a `{ojs}`/`{js}` vdoc.
 */
export const TYPE_IGNORE_DIRECTIVE = "# type: ignore";

/** What 6e found at the cursor: the forwardable cell's engine + its routing target. */
export interface EmbeddedHit {
  /** The cell engine token, e.g. `"python"`. */
  lang: string;
  /** The VS Code languageId to forward to, e.g. `"python"`. */
  languageId: string;
  /** The virtual-doc file extension (no dot), e.g. `"py"`. */
  ext: string;
}

/**
 * The number of body lines in a cell. `Cell.code` is the LF-joined body, so an
 * empty body (`""`) is zero lines. (A cell whose body is exactly one blank line
 * is indistinguishable from an empty cell in this representation — an accepted v1
 * edge: blanking vs keeping a blank line is a no-op, and forwarding on a truly
 * blank line yields nothing useful.)
 */
function bodyLineCount(cell: Cell): number {
  return cell.code === "" ? 0 : cell.code.split("\n").length;
}

/**
 * The forwarding hit for 0-based `line`, or `null` when `line` is not an interior
 * code-body line of a mapped-language executable cell. Returns `null` on the
 * opening/closing fence lines (`findCellAtPosition` is INCLUSIVE of them — R2),
 * on `#|`/`//|` cell-option lines (they belong to the YAML provider — R4), on
 * prose, front matter, comments, and on cells whose engine is unmapped
 * (`cellLanguageId === null`). The exact disjoint complement of the YAML and `@`
 * provider regions (plan §4.3).
 */
export function embeddedCellAt(text: string, line: number): EmbeddedHit | null {
  const cell = findCellAtPosition(text, line);
  if (cell === null) {
    return null;
  }
  const el = cellLanguageId(cell.lang);
  if (el === null) {
    return null;
  }
  const firstBody = cell.startLine + 1;
  const lastBody = cell.startLine + bodyLineCount(cell);
  if (line < firstBody || line > lastBody) {
    return null; // a fence line, not body
  }
  if (findCellOptionLines(text).some((o) => o.line === line)) {
    return null; // a `#|` / `//|` option line — belongs to YAML
  }
  return { lang: cell.lang, languageId: el.languageId, ext: el.ext };
}

/**
 * The questions the two edit checks ask of a text, line by line (Session 342, part (3) of the BACKLOG item "What Session 341's review round found beside the
 * Outline and preview cures"). Both adapters hold a list of edits from a language server and keep an edit only when every line of its range is body of the right
 * cell: the completion list's `additionalTextEdits` (`providers/embedded.ts`, body of a cell of the completion's language) and a formatter's edits
 * (`features/format-cell.ts`, body of the cursor's own cell). Each used to ask `embeddedCellAt(text, line)` once per LINE of every range, and that is a scan of
 * every cell plus every cell's option lines: cells times lines asked. ONE lookup is made per call (a completion list, a format request), asks about plain NUMBERS (no
 * `vscode.Range`, so a unit test reaches it), and is prepared when first asked.
 *
 * Every answer is the old one for EVERY number, a fraction, `NaN`, an infinity, `-0`, a negative and a value past the end of the text included:
 * `hitAt(line)` is `embeddedCellAt(text, line)` and the two range checks are the loops the adapters wrote over it.
 */
export interface RangeLookup {
  /** `embeddedCellAt(text, line)`: the forwarding hit for `line`, or `null` unless it is an interior body line of a mapped-language cell. */
  hitAt(line: number): EmbeddedHit | null;
  /**
   * Whether every line `start, start + 1, ...` up to `end` is an interior body line of a cell whose `languageId` is `languageId`. A range with `start > end` (or a `NaN` bound) has no line, and so is
   * in the body.
   */
  rangeInLanguageBody(start: number, end: number, languageId: string): boolean;
  /**
   * Whether every line `start, start + 1, ...` up to `end` is an interior body line of `cell` itself: a line that is a fence, a `#|` option line, prose, front matter or the body of a DIFFERENT cell
   * (`cell` is the one starting at `cell.startLine`) breaks it. A range with `start > end` (or a `NaN` bound) has no line, and so is in the body.
   *
   * Region membership, not coordinate validity (this was `rangeWithinCell` of `features/format-cell.ts`). Under `buildCellVirtualContent`'s whole-document blanking, every line outside the body
   * identity-maps to a *valid* `.qmd` offset, so a formatter's edit there is perfectly well-formed and utterly destructive. Two distinct hazards, and the second one bit:
   *
   *  1. A line **outside the cell** (the front matter, prose, a sibling cell): the ownership check.
   *  2. A line **inside the cell but not in its body** (the opening fence, the closing fence, a `#|` option line). `findCellAtPosition` is INCLUSIVE of a cell's fences, so an ownership check ALONE
   *     accepts an edit that lands on ```` ```{python} ```` and deletes it. A real formatter emits exactly that: the fences are blanked to whitespace-only lines in the vdoc, and formatters trim
   *     trailing whitespace. Observed end-to-end against VS Code's own JavaScript formatter: `` ```{ojs}\nx   =   1\n``` `` became `\nx = 1\n\n`, both fences gone, the cell no longer a cell. It was latent until
   *     the forward reached a real language server (CHANGELOG: embedded-language forwarding did not reach real language servers, Session 87), which made a document-corruption bug reachable.
   *
   * So the body gate is `hitAt` (`null` on fences and on `#|` option lines), the primitive the completion edit filter already used, and the ownership check comes after it.
   */
  rangeInCellBody(start: number, end: number, cell: Cell): boolean;
}

/** A cell whose engine maps to a forwarding target, with what a question about one of its lines needs: its first and last body line (the very `startLine + 1` and `startLine + bodyLineCount` of `embeddedCellAt`). */
interface MappedCell {
  cell: Cell;
  el: EmbeddedLang;
  firstBody: number;
  lastBody: number;
}

/**
 * What is read from the text, and when. Nothing at construction. The first question reads the model's cells (the scan the adapters' own gate has already paid for, so it is a cache hit there) and binary-searches
 * them, as the Session 341 builder does: the model's cells come in document order and never overlap, so the only cell that can hold a line is the last one that starts at or above it. Each cell is looked at once
 * (its language, and the line count of its code, which is a `split` of the whole body and is therefore NOT repeated for every line asked about it). The set of option lines is read when a question first gets
 * as far as a body line of a mapped cell: a completion list whose edits all sit on a fence, in prose or at line 0 never pays for it, because the old spelling asked for them last, too.
 *
 * Each question costs a binary search over the cells and a set lookup: the number of cells no longer multiplies the number of lines asked.
 */
export function createRangeLookup(text: string): RangeLookup {
  let cells: readonly Cell[] | undefined;
  let options: ReadonlySet<number> | undefined;
  const mapped: Array<MappedCell | null | undefined> = [];
  /** The cell of which `line` is an interior body line, or `null`: the old `embeddedCellAt` without the object it builds. */
  const bodyCellOf = (line: number): MappedCell | null => {
    cells ??= findAllCells(text);
    const at = cellIndexAt(cells, line);
    if (at < 0) {
      return null;
    }
    let found = mapped[at];
    if (found === undefined) {
      const cell = cells[at];
      const el = cellLanguageId(cell.lang);
      found = el === null ? null : { cell, el, firstBody: cell.startLine + 1, lastBody: cell.startLine + bodyLineCount(cell) };
      mapped[at] = found;
    }
    if (found === null || line < found.firstBody || line > found.lastBody) {
      return null; // an unmapped engine, or a fence line: not body
    }
    options ??= optionLineSet(text);
    return options.has(line) ? null : found; // a `#|` / `//|` option line belongs to YAML
  };
  return {
    hitAt: (line) => {
      const found = bodyCellOf(line);
      return found === null ? null : { lang: found.cell.lang, languageId: found.el.languageId, ext: found.el.ext };
    },
    rangeInLanguageBody: (start, end, languageId) => {
      for (let line = start; line <= end; line++) {
        const found = bodyCellOf(line);
        if (found === null || found.el.languageId !== languageId) {
          return false;
        }
      }
      return true;
    },
    rangeInCellBody: (start, end, cell) => {
      for (let line = start; line <= end; line++) {
        const found = bodyCellOf(line);
        if (found === null) {
          return false; // a fence, a `#|` directive, prose, YAML: never code we may rewrite
        }
        if (found.cell.startLine !== cell.startLine) {
          return false; // a body line, but of a DIFFERENT cell
        }
      }
      return true;
    },
  };
}

/**
 * The virtual document for ONE `languageId`: every interior body line of a cell
 * whose `cellLanguageId(...).languageId === languageId` is kept VERBATIM; every
 * other line (prose, YAML, fences, `#|` option lines, other-language cells) is
 * EMPTIED, with the newline kept. Built line-based from the RAW `text` (never
 * `Cell.code`, which is LF-normalized — G4) so it is CRLF-safe.
 *
 * The identity-mapping contract (plan §2.3) is a LINE contract, because
 * `vscode.Position` is (line, character) and never an offset: the line COUNT is
 * preserved, every kept line sits at its own `.qmd` index with its columns intact,
 * so a position passes straight through and results return unchanged.
 *
 * Blanking to EMPTY rather than to an equal-length space run is what makes the vdoc a
 * function of the CODE alone (plan 🐉8): a prose keystroke used to lengthen a blanked
 * run, change the vdoc's bytes, and so mint/write/open a fresh file for EVERY language
 * on every debounced pass, while every line of code stayed identical. Note the blanking
 * must happen HERE and not downstream, because only this function knows which lines are
 * body lines — a whitespace-only line INSIDE a cell body is code the user can put a
 * cursor on, and it is kept verbatim.
 */
export function buildVirtualContent(text: string, languageId: string): string {
  const lines = text.split("\n");
  const optionLines = new Set(findCellOptionLines(text).map((o) => o.line));
  const keep = new Set<number>();
  for (const cell of findAllCells(text)) {
    const el = cellLanguageId(cell.lang);
    if (el === null || el.languageId !== languageId) {
      continue;
    }
    const lastBody = cell.startLine + bodyLineCount(cell);
    for (let i = cell.startLine + 1; i <= lastBody; i++) {
      if (!optionLines.has(i)) {
        keep.add(i);
      }
    }
  }
  // Candidate G (plan §4.1): mute Pylance's workspace-mode phantom diagnostics on this
  // background vdoc model with a file-level `# type: ignore` on the already-blanked line 0.
  // Coordinate-safe: line 0 is never a code body line (a body line needs a fence above it),
  // so this shifts nothing and the identity mapping is untouched — `!keep.has(0)` makes that
  // structural fact a load-bearing guard. Gated to `python` (a `#` would corrupt a JS vdoc)
  // AND to NON-WHITESPACE python body content — the same condition `embeddedLanguagesIn`
  // uses (`:159`), NOT `keep.size > 0` — so the pinned invariant
  // `embeddedLanguagesIn(text) ⟺ buildVirtualContent(text, L).trim() !== ""` still holds:
  // an all-blank-body python cell must stay an all-whitespace (effectively empty) vdoc.
  const injectMute =
    languageId === "python" &&
    !keep.has(0) &&
    [...keep].some((i) => lines[i].trim() !== "");
  return lines
    .map((line, i) => (i === 0 && injectMute ? TYPE_IGNORE_DIRECTIVE : keep.has(i) ? line : ""))
    .join("\n");
}

/**
 * Every forwarding target in `text` that has something for a server to look at — deduped
 * by languageId, in first-appearance order (plan §6.5).
 *
 * The cheap gate the semantic-tokens provider opens every pass with, and its language
 * selection in one scan. It replaced a single-language `hasCellOfLanguage`, whose only
 * caller was the `SLICE_1_LANGUAGE = "python"` gate this generalizes; the contract is that
 * one's equivalence, widened from a single L to all of them — a language is returned IFF
 * its virtual document has something in it:
 *
 *   `embeddedLanguagesIn(text)` ⟺ every `L` with `buildVirtualContent(text, L).trim() !== ""`
 *
 * and the unit tests assert exactly that property on every case, so the cheap gate and the
 * expensive builder it guards cannot drift.
 *
 * It runs on a debounced timer for every visible `.qmd`, including the great majority that
 * hold no code cells at all, which is why it must answer from the cell scan alone:
 * `buildVirtualContent` rebuilds a full-length copy of the document (≈29 ms per pass on a
 * 4.4 MB prose-only document, on the extension host's single thread) — and now once PER
 * LANGUAGE, so the gate matters more than it did with one.
 *
 * It is deliberately NOT "does a cell of this language exist": an empty cell, one holding
 * only `#|` option lines, or one whose body is all blank lines, builds an all-whitespace
 * vdoc. There is nothing to ask a server about, and minting a vdoc for it would write a
 * copy of the user's source to disk and start a language server on it for nothing.
 *
 * Two details that are easy to get wrong, and that the tests pin:
 *
 *  - **Dedupe on the languageId, never the engine.** `{ojs}` and `{js}` are two engine
 *    tokens for ONE language; forwarding both would ask the JS server twice and emit every
 *    javascript token twice — a duplicate-token stream, which is precisely what VS Code
 *    must never be handed.
 *  - **Return the resolved target, not just the name.** `ensureVdoc`'s `VdocKey` requires
 *    `ext`, and there is no languageId → ext reverse map (`cellLanguageId` is keyed by the
 *    ENGINE token). A bare `string[]` — which is what plan §6.5 specifies — cannot mint a
 *    vdoc; the plan predates the shipped key.
 */
export function embeddedLanguagesIn(text: string): EmbeddedLang[] {
  const lines = text.split("\n");
  const optionLines = new Set(findCellOptionLines(text).map((o) => o.line));
  const seen = new Map<string, EmbeddedLang>();
  for (const cell of findAllCells(text)) {
    const el = cellLanguageId(cell.lang);
    if (el === null || seen.has(el.languageId)) {
      continue;
    }
    const lastBody = cell.startLine + bodyLineCount(cell);
    for (let i = cell.startLine + 1; i <= lastBody; i++) {
      if (!optionLines.has(i) && lines[i].trim() !== "") {
        seen.set(el.languageId, { languageId: el.languageId, ext: el.ext });
        break;
      }
    }
  }
  return [...seen.values()];
}

/**
 * The virtual document for exactly ONE cell (CHANGELOG: outline granularity, in-cell code symbols + show/hide toggle, Sessions 71-73 slice 2, outline
 * in-cell symbol forwarding, plan §2.1/§2.3). `buildVirtualContent` above keeps
 * EVERY cell of a given language — correct for cursor-position forwarding
 * (completion/hover/definition/signature-help only care about one position),
 * but wrong for document-symbol forwarding: two same-language cells would merge
 * into one indistinguishable symbol list. This isolates `cell`'s own interior
 * body lines (excluding its `#|`/`//|` option lines, which are YAML directives,
 * not language code) and empties everything else — prose, YAML, fences, and
 * every OTHER cell, even a same-language sibling — so the forwarded symbols can
 * be attributed to `cell` alone. Same identity-mapping contract as
 * `buildVirtualContent` (LINE-preserving; body lines kept verbatim, including a
 * whitespace-only one; built from the RAW text, so it is CRLF-safe).
 */
export function buildCellVirtualContent(text: string, cell: Cell): string {
  return createCellVdocBuilder(text).build(cell);
}

/**
 * The per-cell virtual documents of ONE text, and the cell lookup the Outline provider needs to ask for them
 * (Session 341, part (2) of the BACKLOG item "Slow shapes and residuals found by Session 339's review round").
 * `cellAt(line)` answers exactly what `findCellAtPosition(text, line)` answers and `build(cell)` exactly what
 * the old `buildCellVirtualContent(text, cell)` answered, byte for byte, for EVERY `Cell` whose `startLine` is a number (a whole line, a
 * fraction, `NaN`, an infinity, one above or below the text) and whose `code` is a string; the provider makes ONE per
 * `provideDocumentSymbols` call and asks it once per code cell. (`endLine` is read by neither spelling. A `Cell` that breaks the type, with a
 * `startLine` that is not a number or a `code` that is not a string, is not pinned by any row.)
 *
 * Why a builder and not the two functions: the Outline forwards EVERY code cell, and each call of the old pair
 * redid the work of the whole text (a scan of every cell to find the one at a line; a split of the text; every
 * cell's option lines again; a callback over every line; for a python cell a whole-document `some` for the mute),
 * so the cost was cells times document (4.6 s at 2,000 six-line cells, measured at the parent). What is done ONCE
 * per text here: the split, the option lines, the cells. What is done once per cell: its own body lines, and
 * the blank runs between them written as `"\n".repeat(k)` (a block copy, not a callback per line).
 *
 * The identity-mapping contract needs each vdoc to be the text's full line count, so every build is at least as
 * long as the document: that part is inherent. The per-text work is not, and the preparation is lazy, so a
 * document with no code cell (which never asks) pays for none of it.
 */
export interface CellVdocBuilder {
  /** The cell holding 0-based `line` (its fence lines included), or `null`: `findCellAtPosition(text, line)`. */
  cellAt(line: number): Cell | null;
  /** The vdoc of `cell`: the full line count of the text, `cell`'s own body lines kept verbatim, everything else empty, the python mute on line 0. */
  build(cell: Cell): string;
}

/** What is read from the text ONCE: its LF-split lines (a CR stays on its line, the model supplies the line numbers), every cell's option lines, and the model's cells. */
interface CellVdocState {
  lines: string[];
  options: ReadonlySet<number>;
  cells: readonly Cell[];
}

/**
 * `findCellAtPosition`'s answer without a scan of every cell: the model's cells come in document order and never overlap (each ends at its
 * own closing fence, and the next opens below it), so the only cell that can hold `line` is the last one that STARTS at or above it. The
 * cell-line differential of `cell-vdoc-builder-equivalence.test.ts` asserts that order on every document it reads, and asks every line.
 * A `line` that is not a whole number is asked the same question as a whole one, `startLine <= line <= endLine`, and gets the same answer as the scan: the cell whose span holds
 * it (`cellAt(1.5)` is the cell spanning lines 1 to 3, as is `cellAt(3)`), and `null` when no span does (`0.5`, `3.5`, `-0.5`). `NaN` is in no span, so it answers `null`, and so do
 * `Infinity` and `-Infinity` (past every end, before every start).
 */
function cellAtLine(cells: readonly Cell[], line: number): Cell | null {
  const at = cellIndexAt(cells, line);
  return at >= 0 ? cells[at] : null;
}

/** The index of the cell `cellAtLine` answers, or -1 when there is none: the search itself, shared with the range lookup, which wants the index (a per-cell cache is keyed by it) and not the cell. */
function cellIndexAt(cells: readonly Cell[], line: number): number {
  let low = 0;
  let high = cells.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (cells[middle].startLine <= line) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found >= 0 && line <= cells[found].endLine ? found : -1;
}

/** The lines the model reads as `#|` / `//|` cell options, as a set: what every vdoc blanks, and what a body line must not be. */
function optionLineSet(text: string): ReadonlySet<number> {
  return new Set(findCellOptionLines(text).map((o) => o.line));
}

/**
 * One cell's vdoc from the prepared text. Candidate G (plan §4.1): the per-cell vdoc leaks the same workspace-mode phantom diagnostics (plan §3.1),
 * so it takes the same file-level `# type: ignore` mute on line 0. Line 0 is never a body line of a cell the model found — a body line needs a fence
 * above it — so the write is coordinate-safe (for a hand-made cell that starts above line 0 the mute still wins, as it always did). Gated to a
 * python cell (a `#` is a JS syntax error) with NON-WHITESPACE body content (nothing to mute in an all-blank cell).
 *
 * The body lines are the ones after the fence, up to `bodyLineCount` of them, that are not option lines: the INTEGER line numbers `i` with `i > startLine`
 * and `i <= startLine + bodyLineCount`, which is how the old spelling read them. The loop's `i` is a whole number, so `first` is `floor(startLine) + 1` (the loop must
 * START on a whole line) and `last` needs no floor (`i <= last` for a whole `i` is `i <= floor(last)`); `last` is the very sum the old spelling compared with, so a rounding in it
 * is the old rounding (`1.9999999999999998 + 2` is 4). A `startLine` that is a fraction, `NaN`, an infinity or a value no text reaches therefore gets the old answer too
 * (for `NaN` no `i` satisfies the rule, and neither bound lets the loop run). The result is those lines at their own
 * indices with `"\n"` runs between them: element `k` of the `n` lines joined by `"\n"` is the line itself if kept and `""` otherwise, so a kept
 * line at index `i` after `at` lines already written is preceded by `i - at + 1` newlines (one fewer when nothing is written yet).
 */
function buildCellVdoc({ lines, options }: CellVdocState, cell: Cell): string {
  const first = Math.max(Math.floor(cell.startLine) + 1, 0);
  const last = Math.min(cell.startLine + bodyLineCount(cell), lines.length - 1);
  const kept: number[] = [];
  let content = false;
  for (let i = first; i <= last; i++) {
    if (options.has(i)) {
      continue;
    }
    kept.push(i);
    if (!content && lines[i].trim() !== "") {
      content = true;
    }
  }
  const mute = content && cellLanguageId(cell.lang)?.languageId === "python";
  const parts: string[] = [];
  let at = 0; // how many lines `parts` holds
  if (mute) {
    parts.push(TYPE_IGNORE_DIRECTIVE);
    at = 1;
  }
  for (const i of kept) {
    if (i < at) {
      continue; // line 0 under the mute
    }
    parts.push("\n".repeat(at === 0 ? i : i - at + 1), lines[i]);
    at = i + 1;
  }
  const rest = lines.length - at;
  if (rest > 0) {
    parts.push("\n".repeat(at === 0 ? rest - 1 : rest));
  }
  return parts.join("");
}

export function createCellVdocBuilder(text: string, _engine?: EngineHint, _mode?: RenderMode): CellVdocBuilder {
  let state: CellVdocState | undefined;
  const read = (): CellVdocState => {
    if (state === undefined) {
      state = {
        lines: text.split("\n"),
        options: optionLineSet(text),
        cells: findAllCells(text),
      };
    }
    return state;
  };
  return {
    cellAt: (line) => cellAtLine(read().cells, line),
    build: (cell) => buildCellVdoc(read(), cell),
  };
}
