import type MarkdownIt from "markdown-it";
import { calloutNotePlugin } from "../core/notebook-callout";

/**
 * The API the built-in `vscode.markdown-it-renderer` exposes to renderers that
 * extend it: a hook that hands our callback the shared markdown-it instance to
 * mutate. Grounded firsthand against the shipped
 * markdown-language-features/notebook-out/index.js, whose `extendMarkdownIt` is
 * `cb => { cb(md) }`.
 */
interface MarkdownItRendererApi {
  extendMarkdownIt(fn: (md: MarkdownIt) => void): void;
}

/** The subset of the notebook renderer's RendererContext this entrypoint uses. */
interface RendererContext {
  getRenderer(id: string): Promise<MarkdownItRendererApi | undefined>;
}

/**
 * Notebook-renderer entrypoint (BACKLOG item 17d, first slice). This module is
 * bundled for the browser (`dist/notebook-renderer.js`) and loaded by VS Code
 * into the notebook renderer webview sandbox (no `vscode`/Node — DOM only),
 * where it calls `activate` with a RendererContext.
 *
 * We fetch the base markdown-it renderer and install the pure Quarto
 * callout-note plugin into its shared markdown-it instance, so a notebook's
 * markdown cells render `::: {.callout-note}` blocks as note admonitions rather
 * than raw `:::` text. The rendering logic itself lives in the vscode-free core
 * (`src/core/notebook-callout.ts`) and is unit-tested headlessly.
 */
export async function activate(ctx: RendererContext): Promise<void> {
  const base = await ctx.getRenderer("vscode.markdown-it-renderer");
  if (!base) {
    throw new Error("Could not load 'vscode.markdown-it-renderer'");
  }
  base.extendMarkdownIt((md) => calloutNotePlugin(md));
}
