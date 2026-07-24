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
import { cellLanguageId, type EmbeddedLang } from "./lang-map";

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
  const lines = text.split("\n");
  const optionLines = new Set(findCellOptionLines(text).map((o) => o.line));
  const lastBody = cell.startLine + bodyLineCount(cell);
  const inBody = (i: number): boolean =>
    i > cell.startLine && i <= lastBody && !optionLines.has(i);
  // Candidate G (plan §4.1): the per-cell vdoc leaks the same workspace-mode phantom
  // diagnostics (plan §3.1), so it takes the same file-level `# type: ignore` mute. Line 0 is
  // never a body line here either — `inBody` requires `i > cell.startLine` and `cell.startLine`
  // is a fence line ≥ 0 — so the write is coordinate-safe. Gated to a python cell (a `#` is a
  // JS syntax error) with NON-WHITESPACE body content (nothing to mute in an all-blank cell).
  const injectMute =
    cellLanguageId(cell.lang)?.languageId === "python" &&
    lines.some((line, i) => inBody(i) && line.trim() !== "");
  return lines
    .map((line, i) => (i === 0 && injectMute ? TYPE_IGNORE_DIRECTIVE : inBody(i) ? line : ""))
    .join("\n");
}
