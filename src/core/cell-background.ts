/**
 * Cell-execution code-cell background highlighting — the pure `core/` layer
 * (`BACKLOG.md` item 17a, Session 111).
 *
 * A STATIC decoration of the executable code cells in a `.qmd`: cells that *can*
 * run, not a running-cell indicator (Run Cell delegates out-of-process, so no
 * "which cell is running" state exists). This module answers the two `vscode`-free
 * questions — which line spans to tint, and what the settings resolve to — while
 * the thin adapter in `features/cell-background.ts` maps the spans onto a real
 * `vscode.TextEditorDecorationType` (the §3.3 guardrail).
 */

import { findAllCells } from "./cells";

/** A 0-based inclusive line span, `[startLine, endLine]`. */
export interface LineRange {
  startLine: number;
  endLine: number;
}

/**
 * The full, fence-inclusive line span of every executable `{lang}` cell, in
 * document order. A view over the shared cell scanner (`findAllCells`) — never a
 * second scanner (Learning #14) — so a ```` ```python ```` block with no braces,
 * a `#|` in prose, etc. are all excluded exactly as the cell model excludes them.
 * The span covers both fence lines (`Cell.startLine`..`Cell.endLine`) so the whole
 * cell block is tinted, matching how the editor reads a cell as one unit.
 */
export function cellBackgroundRanges(text: string): LineRange[] {
  return findAllCells(text).map((cell) => ({
    startLine: cell.startLine,
    endLine: cell.endLine,
  }));
}

/** The resolved cell-background settings the adapter renders from. */
export interface CellBackgroundSettings {
  /** Whether the tint is drawn at all (`quarto.cells.background.enabled`). */
  enabled: boolean;
  /** Background colour in light colour themes (a CSS colour string). */
  light: string;
  /** Background colour in dark / high-contrast colour themes. */
  dark: string;
}

/**
 * Out-of-the-box settings. Highlighting is ON (Posit-parity default), with a
 * deliberately faint translucent tint — a touch of black over light themes, a
 * touch of white over dark ones — so a code cell reads as a distinct block
 * without competing with syntax colours. These EXACT values are mirrored by the
 * `quarto.cells.background.*` defaults in `package.json` (a unit test pins the
 * two together, so a drift in either is caught).
 */
export const DEFAULT_CELL_BACKGROUND: CellBackgroundSettings = {
  enabled: true,
  light: "#0000000F",
  dark: "#FFFFFF14",
};

/**
 * Resolve a (possibly partial) settings object read from configuration into a
 * complete `CellBackgroundSettings`, applying `DEFAULT_CELL_BACKGROUND` for any
 * field left unset. A boolean `enabled` is honoured even when `false` (only
 * `undefined` falls back); a colour that is empty or whitespace-only falls back
 * to its default, and a provided colour is trimmed.
 */
export function resolveCellBackgroundSettings(
  raw: Partial<CellBackgroundSettings>,
): CellBackgroundSettings {
  return {
    enabled: raw.enabled ?? DEFAULT_CELL_BACKGROUND.enabled,
    light: resolveColour(raw.light, DEFAULT_CELL_BACKGROUND.light),
    dark: resolveColour(raw.dark, DEFAULT_CELL_BACKGROUND.dark),
  };
}

function resolveColour(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}
