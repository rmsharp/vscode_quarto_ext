/**
 * Pure, `vscode`-free builder for the preview webview's HTML document.
 *
 * Like the rest of `core/`, this module MUST NOT import `vscode` (architecture
 * plan §3.3). The webview is a thin host: a single full-bleed `<iframe>` that
 * points at the local `quarto preview` server. The security-relevant part — the
 * `Content-Security-Policy` that scopes what the webview may frame — lives here
 * so it can be unit-tested headlessly.
 */

export interface PreviewHtmlOptions {
  /** The (already port-mapped) URL of the local preview server to embed. */
  url: string;
}

/**
 * Build the webview HTML that embeds `url` in a sandboxed full-bleed iframe.
 */
/** Escape a string for safe interpolation into a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildPreviewHtml(options: PreviewHtmlOptions): string {
  const { url } = options;
  const origin = new URL(url).origin;
  const src = escapeAttr(url);
  const csp = [
    "default-src 'none'",
    `frame-src ${origin}`,
    "style-src 'unsafe-inline'",
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en" style="height:100%">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; }
      iframe { border: 0; width: 100%; height: 100%; display: block; }
    </style>
  </head>
  <body>
    <iframe
      src="${src}"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    ></iframe>
  </body>
</html>`;
}
