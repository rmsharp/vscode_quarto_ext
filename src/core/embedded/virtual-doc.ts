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
import { cellLanguageId } from "./lang-map";

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
