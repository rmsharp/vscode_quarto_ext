import type MarkdownIt from "markdown-it";
import { calloutPlugin, calloutStyles } from "../core/notebook-callout";

/**
 * The minimal `document` surface {@link injectCalloutStyles} needs. Declared
 * locally (not via the DOM lib) so the Node extension's type-check stays free of
 * browser globals — this module is the only one bundled for the browser webview.
 */
interface StyleHost {
  getElementById(id: string): unknown;
  createElement(tag: "style"): { id: string; textContent: string | null };
  head: { appendChild(node: unknown): void } | null;
  documentElement: { appendChild(node: unknown): void };
}

declare const document: StyleHost | undefined;

/** The id of the injected `<style>`, used to make injection idempotent. */
const CALLOUT_STYLE_ELEMENT_ID = "quarto-mit-callout-styles";

/**
 * Inject the callout box stylesheet (BACKLOG item 17d follow-on B) once into the
 * notebook renderer webview, so the structural callout markup renders as a
 * coloured admonition box. Idempotent (a second call is a no-op) and DOM-only:
 * the rendered box has no extension-host read-back, so it is eyeball-only — this
 * helper's logic is unit-tested against a fake document.
 */
export function injectCalloutStyles(doc: StyleHost): void {
  if (doc.getElementById(CALLOUT_STYLE_ELEMENT_ID)) return; // already injected
  const style = doc.createElement("style");
  style.id = CALLOUT_STYLE_ELEMENT_ID;
  style.textContent = calloutStyles();
  (doc.head ?? doc.documentElement).appendChild(style);
}

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
 * We fetch the base markdown-it renderer and install the pure Quarto callout
 * plugin into its shared markdown-it instance, so a notebook's markdown cells
 * render `::: {.callout-<type>}` blocks as admonitions rather than raw `:::`
 * text. The rendering logic itself lives in the vscode-free core
 * (`src/core/notebook-callout.ts`) and is unit-tested headlessly.
 */
export async function activate(ctx: RendererContext): Promise<void> {
  if (typeof document !== "undefined") {
    injectCalloutStyles(document);
  }
  const base = await ctx.getRenderer("vscode.markdown-it-renderer");
  if (!base) {
    throw new Error("Could not load 'vscode.markdown-it-renderer'");
  }
  base.extendMarkdownIt((md) => calloutPlugin(md));
}
