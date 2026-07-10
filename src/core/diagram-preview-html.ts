/**
 * Pure, `vscode`-free builder for the diagram-preview webview's HTML document.
 *
 * Like the rest of `core/`, this module MUST NOT import `vscode` (architecture
 * plan §3.3) and is unit-tested headlessly. It turns a list of detected
 * `DiagramRegion`s (from `core/diagram-regions`) into a self-contained HTML page
 * that draws each Mermaid cell with the vendored, locally-served Mermaid bundle
 * (MIT, `media/mermaid/`) and each Graphviz (`{dot}`) cell with the vendored
 * `@viz-js/viz` WASM bundle (`media/graphviz/`; its compiled contents include
 * EPL-2.0 Graphviz core — see `NOTICE`).
 *
 * The security-relevant `Content-Security-Policy` lives here so it can be
 * asserted in a unit test: scripts run ONLY by nonce, plus the narrow
 * `'wasm-unsafe-eval'` exception the Graphviz WASM module needs — no
 * `'unsafe-inline'` and (verified) no broader `'unsafe-eval'`: both vendored
 * bundles are self-contained and perform no runtime `import()`.
 */

import type { DiagramRegion } from "./diagram-regions";

export interface DiagramPreviewHtmlOptions {
  /** Diagram regions to render, in document order. */
  regions: DiagramRegion[];
  /** Webview URI of the vendored `mermaid.min.js`. */
  mermaidJsUri: string;
  /** Webview URI of the vendored Graphviz `viz-global.js`. */
  vizJsUri: string;
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
 * Build the webview HTML that renders `regions` with Mermaid, or an empty-state
 * message when there is no diagram to show.
 */
export function buildDiagramPreviewHtml(
  options: DiagramPreviewHtmlOptions,
): string {
  const { regions, mermaidJsUri, vizJsUri, cspSource, nonce } = options;
  const csp = [
    "default-src 'none'",
    // C4 / architecture-beta diagrams embed icons as inert data:image URIs
    // (SVG <image>); allow them (and same-origin images) without weakening the
    // strict nonce-only script policy — data: images cannot execute.
    `img-src ${cspSource} data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource}`,
    // 'wasm-unsafe-eval' gates WebAssembly.instantiate/compile (CSP Level 3),
    // needed for the vendored Graphviz WASM renderer — distinct from and much
    // narrower than 'unsafe-eval', which is NOT added (permits no JS eval()).
    `script-src 'nonce-${nonce}' 'wasm-unsafe-eval'`,
  ].join("; ");

  const head = `  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <style>
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        padding: 0.5rem 1rem;
      }
      .diagram-item {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--vscode-panel-border, transparent);
      }
      .diagram-line {
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 0.8em;
        opacity: 0.6;
        margin-bottom: 0.3rem;
      }
      .diagram-error {
        color: var(--vscode-errorForeground, #f48771);
        font-family: var(--vscode-editor-font-family, monospace);
        white-space: pre-wrap;
      }
      .diagram-note { font-style: italic; opacity: 0.7; margin-bottom: 0.3rem; }
      .diagram-source {
        font-family: var(--vscode-editor-font-family, monospace);
        white-space: pre-wrap;
        background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.1));
        padding: 0.4rem 0.6rem;
        border-radius: 3px;
      }
      .empty { opacity: 0.7; font-style: italic; }
      svg { max-width: 100%; height: auto; }
    </style>
  </head>`;

  if (regions.length === 0) {
    return `<!DOCTYPE html>
<html lang="en">
${head}
  <body>
    <p class="empty">No diagrams found in this document.</p>
  </body>
</html>`;
  }

  // Embed the regions as JSON for the render script. Escaping `<` (to its
  // Unicode escape) is what stops a `</script>` inside diagram source from
  // prematurely closing the script element.
  const json = JSON.stringify(regions).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
${head}
  <body>
    <div id="diagram-root"></div>
    <script nonce="${nonce}" src="${escapeAttr(mermaidJsUri)}"></script>
    <script nonce="${nonce}" src="${escapeAttr(vizJsUri)}"></script>
    <script nonce="${nonce}">
      const REGIONS = ${json};
      const root = document.getElementById("diagram-root");
      const dark =
        document.body.classList.contains("vscode-dark") ||
        document.body.classList.contains("vscode-high-contrast");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: dark ? "dark" : "default",
      });
      (async () => {
        // WASM instantiation has real cost (unlike mermaid.initialize()), so
        // only pay it when at least one dot region actually needs it.
        const vizInstance = REGIONS.some((r) => r.engine === "dot")
          ? await Viz.instance()
          : null;
        for (let i = 0; i < REGIONS.length; i++) {
          const r = REGIONS[i];
          const item = document.createElement("section");
          item.className = "diagram-item";
          const label = document.createElement("div");
          label.className = "diagram-line";
          label.textContent = "{" + r.engine + "} line " + (r.startLine + 1);
          item.appendChild(label);
          const target = document.createElement("div");
          if (r.engine === "mermaid") {
            try {
              const { svg } = await mermaid.render("quarto-mmd-" + i, r.code);
              target.innerHTML = svg;
            } catch (e) {
              target.className = "diagram-error";
              target.textContent = String(e);
            }
          } else if (r.engine === "dot") {
            try {
              target.innerHTML = vizInstance.renderString(r.code, {
                format: "svg",
              });
            } catch (e) {
              target.className = "diagram-error";
              target.textContent = String(e);
            }
          }
          item.appendChild(target);
          root.appendChild(item);
        }
      })();
    </script>
  </body>
</html>`;
}
