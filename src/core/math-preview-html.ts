/**
 * Pure, `vscode`-free builder for the math-preview webview's HTML document.
 *
 * Like the rest of `core/`, this module MUST NOT import `vscode` (architecture
 * plan §3.3) and is unit-tested headlessly. It turns a list of detected
 * `MathRegion`s (from `core/math-regions`) into a self-contained HTML page that
 * renders each region with the vendored, locally-served KaTeX assets (MIT).
 *
 * The security-relevant `Content-Security-Policy` lives here so it can be
 * asserted in a unit test: scripts run ONLY by nonce (no `'unsafe-inline'` for
 * JS), and styles + fonts are restricted to the webview's own resource origin
 * (plus inline styles, which KaTeX's rendered output requires).
 */

import type { MathRegion } from "./math-regions";

export interface MathPreviewHtmlOptions {
  /** Math regions to render, in document order. */
  regions: MathRegion[];
  /** Webview URI of the vendored `katex.min.css`. */
  katexCssUri: string;
  /** Webview URI of the vendored `katex.min.js`. */
  katexJsUri: string;
  /** `webview.cspSource` — the origin the webview may load local resources from. */
  cspSource: string;
  /** A per-render random nonce authorizing the page's two script tags. */
  nonce: string;
}

/** Escape a string for safe interpolation into a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build the webview HTML that renders `regions` with KaTeX, or an empty-state
 * message when there is no math to show.
 */
export function buildMathPreviewHtml(options: MathPreviewHtmlOptions): string {
  const { regions, katexCssUri, katexJsUri, cspSource, nonce } = options;
  const csp = [
    "default-src 'none'",
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  const head = `  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <link rel="stylesheet" href="${escapeAttr(katexCssUri)}" />
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        padding: 0.5rem 1rem;
      }
      .math-item {
        padding: 0.4rem 0;
        border-bottom: 1px solid var(--vscode-panel-border, transparent);
      }
      .math-line {
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 0.8em;
        opacity: 0.6;
        margin-bottom: 0.2rem;
      }
      .math-error {
        color: var(--vscode-errorForeground, #f48771);
        font-family: var(--vscode-editor-font-family, monospace);
        white-space: pre-wrap;
      }
      .empty { opacity: 0.7; font-style: italic; }
    </style>
  </head>`;

  if (regions.length === 0) {
    return `<!DOCTYPE html>
<html lang="en">
${head}
  <body>
    <p class="empty">No math found in this document.</p>
  </body>
</html>`;
  }

  // Embed the regions as JSON for the render script. Escaping `<` (to its
  // Unicode escape) is what stops a `</script>` inside math content from
  // prematurely closing the script element.
  const json = JSON.stringify(regions).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
${head}
  <body>
    <div id="math-root"></div>
    <script nonce="${nonce}" src="${escapeAttr(katexJsUri)}"></script>
    <script nonce="${nonce}">
      const REGIONS = ${json};
      const root = document.getElementById("math-root");
      for (const r of REGIONS) {
        const item = document.createElement("section");
        item.className = "math-item";
        const label = document.createElement("div");
        label.className = "math-line";
        label.textContent =
          (r.type === "display" ? "$$" : "$") + " line " + (r.startLine + 1);
        const body = document.createElement("div");
        try {
          katex.render(r.content, body, {
            displayMode: r.type === "display",
            throwOnError: false,
          });
        } catch (e) {
          body.className = "math-error";
          body.textContent = String(e);
        }
        item.appendChild(label);
        item.appendChild(body);
        root.appendChild(item);
      }
    </script>
  </body>
</html>`;
}
