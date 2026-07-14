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
 * Whether `text` has anything for `languageId`'s server to look at — i.e. at least one
 * NON-BLANK body line that `buildVirtualContent` would keep.
 *
 * The cheap gate in front of the expensive builder. Its contract is an equivalence, not
 * an approximation:
 *
 *   `hasCellOfLanguage(text, L)` ⟺ `buildVirtualContent(text, L).trim() !== ""`
 *
 * and the unit tests assert exactly that property on every case, so the two cannot drift.
 * It exists because the semantic-tokens provider runs on a debounced timer for every
 * visible `.qmd` — including the great majority that contain no code cells at all — and
 * `buildVirtualContent` rebuilds a full-length copy of the document before its caller can
 * discover there was nothing in it (≈29 ms per pass on a 4.4 MB prose-only document, on
 * the extension host's single thread).
 *
 * Note it is deliberately NOT "does a cell of this language exist": an empty cell, or one
 * holding only `#|` option lines, builds an all-whitespace vdoc. There is nothing to ask a
 * server about, and minting a vdoc for it would write a file and start a language server
 * for nothing.
 */
export function hasCellOfLanguage(text: string, languageId: string): boolean {
  const lines = text.split("\n");
  const optionLines = new Set(findCellOptionLines(text).map((o) => o.line));
  for (const cell of findAllCells(text)) {
    const el = cellLanguageId(cell.lang);
    if (el === null || el.languageId !== languageId) {
      continue;
    }
    const lastBody = cell.startLine + bodyLineCount(cell);
    for (let i = cell.startLine + 1; i <= lastBody; i++) {
      if (!optionLines.has(i) && lines[i].trim() !== "") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Every forwarding target in `text` that has something for a server to look at — deduped
 * by languageId, in first-appearance order (plan §6.5).
 *
 * This is the multi-language gate the semantic-tokens provider opens each pass with, and
 * it subsumes the single-language `hasCellOfLanguage`. Its contract is the same
 * equivalence, generalized — a language is returned IFF its virtual document is non-empty:
 *
 *   `embeddedLanguagesIn(text)` ⟺ every `L` with `buildVirtualContent(text, L).trim() !== ""`
 *
 * and the unit tests assert exactly that property on every case, so the cheap gate and the
 * expensive builder it guards cannot drift.
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
