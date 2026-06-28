/**
 * Pure, `vscode`-free builder for the diagram-preview webview's HTML document.
 *
 * Like the rest of `core/`, this module MUST NOT import `vscode` (architecture
 * plan §3.3) and is unit-tested headlessly. It turns a list of detected
 * `DiagramRegion`s (from `core/diagram-regions`) into a self-contained HTML page
 * that draws each Mermaid cell with the vendored, locally-served Mermaid bundle
 * (MIT, `media/mermaid/`).
 *
 * The security-relevant `Content-Security-Policy` lives here so it can be
 * asserted in a unit test: scripts run ONLY by nonce — no `'unsafe-inline'` and
 * (verified) no `'unsafe-eval'`: the vendored bundle is self-contained, performs
 * no runtime `import()` and resolves its global via `self` (never the
 * `Function("return this")` fallback), so the strict CSP holds.
 *
 * Scope (this slice): Mermaid cells are rendered; Graphviz (`{dot}`) cells are
 * detected and shown with their source plus a "not yet rendered" note —
 * rendering `dot` needs a separate WASM renderer (its own slice / CSP profile).
 */

import type { DiagramRegion } from "./diagram-regions";

export interface DiagramPreviewHtmlOptions {
  /** Diagram regions to render, in document order. */
  regions: DiagramRegion[];
  /** Webview URI of the vendored `mermaid.min.js`. */
  mermaidJsUri: string;
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
  const { regions, mermaidJsUri, cspSource, nonce } = options;
  const csp = [
    "default-src 'none'",
    // C4 / architecture-beta diagrams embed icons as inert data:image URIs
    // (SVG <image>); allow them (and same-origin images) without weakening the
    // strict nonce-only script policy — data: images cannot execute.
    `img-src ${cspSource} data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
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
        for (let i = 0; i < REGIONS.length; i++) {
          const r = REGIONS[i];
          const item = document.createElement("section");
          item.className = "diagram-item";
          const label = document.createElement("div");
          label.className = "diagram-line";
          label.textContent = "{" + r.engine + "} line " + (r.startLine + 1);
          item.appendChild(label);
          if (r.engine === "mermaid") {
            const target = document.createElement("div");
            try {
              const { svg } = await mermaid.render("quarto-mmd-" + i, r.code);
              target.innerHTML = svg;
            } catch (e) {
              target.className = "diagram-error";
              target.textContent = String(e);
            }
            item.appendChild(target);
          } else {
            const note = document.createElement("div");
            note.className = "diagram-note";
            note.textContent =
              "Graphviz (dot) preview is not yet rendered — source shown below.";
            const pre = document.createElement("pre");
            pre.className = "diagram-source";
            pre.textContent = r.code;
            item.appendChild(note);
            item.appendChild(pre);
          }
          root.appendChild(item);
        }
      })();
    </script>
  </body>
</html>`;
}
