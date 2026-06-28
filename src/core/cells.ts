/**
 * Quarto executable-cell detection.
 *
 * As of Phase 6a the implementation lives in `core/qmd/model.ts` — the single
 * source of truth for the `.qmd` region model (front matter, headings, cells),
 * where heading and cell detection share one fence-tracking scanner. This module
 * re-exports the cell API so existing callers (`features/execution.ts`) and the
 * Phase 5 unit tests keep working unchanged.
 */

export { type Cell, findAllCells, findCellAtPosition } from "./qmd/model";
