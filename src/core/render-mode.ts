/**
 * Which `quarto render` the Outline reads a knitr document for (Session 310).
 *
 * Pure and `vscode`-free (architecture plan §3.3). A knitr document's Outline depends on what the
 * render DOES: when it executes, a setup chunk's `knitr::opts_chunk$set(echo = FALSE)` hides the
 * chunks below it and a chunk that prints emits an output block (two bare code fences); under
 * `quarto render --no-execute` nothing runs, so neither happens. The two renders list different
 * headings for the same document, so the Outline has to be told which one it is predicting.
 * `execute` is the default and is what the model always read before this existed.
 */
export type RenderMode = "execute" | "no-execute";

/** Every mode, in the order the setting lists them. */
export const RENDER_MODES: readonly RenderMode[] = ["execute", "no-execute"];

/** The reading every caller got before the mode existed, and the one an unset or invalid setting falls back to. */
export const DEFAULT_RENDER_MODE: RenderMode = "execute";
