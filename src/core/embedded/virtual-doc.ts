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
 * replaced by a space-run of EQUAL length, with newlines preserved. Built
 * line-based from the RAW `text` (never `Cell.code`, which is LF-normalized — G4)
 * so it is CRLF-safe. The identity-mapping contract (plan §2.3, the headline
 * tests): `buildVirtualContent(text, L).length === text.length` and the `\n`
 * positions are identical, so a `vscode.Position` passes straight through and
 * results return unchanged.
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
  return lines
    .map((line, i) => (keep.has(i) ? line : " ".repeat(line.length)))
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
 * Collapse every whitespace-only line to an empty one, leaving every other line BYTE-EXACT.
 *
 * The form a virtual document is written to disk in, and the form its reuse is decided by
 * (`features/embedded-vdoc.ts`). It is what keeps semantic tokens off the per-keystroke
 * disk-write path (plan 🐉8).
 *
 * The builders above are LENGTH-PRESERVING: every line that is not the target language's
 * code is blanked to an EQUAL-LENGTH run of spaces, which is precisely what gives the
 * identity coordinate mapping. The cost is that the vdoc's bytes then depend on the length
 * of the user's PROSE — type one character in a paragraph and a blanked run lengthens, so
 * the vdoc differs, so a byte-comparison reuse check can never hit, and a fresh file is
 * minted, written, opened and deleted on every debounced pass, for every language, while
 * the user types. Every line of code was identical each time.
 *
 * Collapsing the blanks removes the dependency: the vdoc becomes a function of the CODE
 * alone. Nothing addressable moves —
 *
 *  - **A line becomes empty; it never disappears.** Line indices, and the newline count,
 *    are preserved exactly, and `vscode.Position` is (line, character), not an offset.
 *  - **Only whitespace-only lines are touched.** A code line keeps its leading indentation
 *    byte-for-byte, which is not cosmetic: trimming it would make Python invalid and move
 *    every token's column. The tests pin an INDENTED line for exactly this reason.
 *  - **No request or result has ever landed on a blanked line** — that is what blanking is
 *    for — and Python, R, Julia and JavaScript all read a whitespace-only line and an empty
 *    one identically (Python ignores a blank line outright: no NEWLINE token, no effect on
 *    the indentation stack).
 */
export function canonicalVdocContent(content: string): string {
  return content
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line))
    .join("\n");
}

/**
 * The virtual document for exactly ONE cell (BACKLOG item 11 slice 2, outline
 * in-cell symbol forwarding, plan §2.1/§2.3). `buildVirtualContent` above keeps
 * EVERY cell of a given language — correct for cursor-position forwarding
 * (completion/hover/definition/signature-help only care about one position),
 * but wrong for document-symbol forwarding: two same-language cells would merge
 * into one indistinguishable symbol list. This isolates `cell`'s own interior
 * body lines (excluding its `#|`/`//|` option lines, which are YAML directives,
 * not language code) and blanks everything else — prose, YAML, fences, and
 * every OTHER cell, even a same-language sibling — so the forwarded symbols can
 * be attributed to `cell` alone. Same identity-mapping contract as
 * `buildVirtualContent` (length- and newline-preserving, built from the RAW
 * text, so it is CRLF-safe).
 */
export function buildCellVirtualContent(text: string, cell: Cell): string {
  const lines = text.split("\n");
  const optionLines = new Set(findCellOptionLines(text).map((o) => o.line));
  const lastBody = cell.startLine + bodyLineCount(cell);
  return lines
    .map((line, i) => {
      const inBody = i > cell.startLine && i <= lastBody && !optionLines.has(i);
      return inBody ? line : " ".repeat(line.length);
    })
    .join("\n");
}
