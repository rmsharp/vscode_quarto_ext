import { describe, expect, it } from "vitest";
import type { MathRegion } from "../../src/core/math-regions";
import { buildMathPreviewHtml } from "../../src/core/math-preview-html";

const BASE = {
  katexCssUri: "https://cdn.example/katex.min.css",
  katexJsUri: "https://cdn.example/katex.min.js",
  cspSource: "vscode-webview://abc",
  nonce: "n0nce123",
};

const inline = (content: string): MathRegion => ({
  type: "inline",
  content,
  startLine: 0,
  endLine: 0,
});

/** Parse the CSP meta's directives into `{ name: value }` (value sans name). */
function cspDirectives(html: string): Record<string, string> {
  const m = html.match(
    /http-equiv="Content-Security-Policy" content="([^"]*)"/,
  );
  if (!m) {
    throw new Error("no CSP meta found");
  }
  return Object.fromEntries(
    m[1].split(";").map((d) => {
      const [name, ...rest] = d.trim().split(/\s+/);
      return [name, rest.join(" ")];
    }),
  );
}

describe("buildMathPreviewHtml", () => {
  it("locks down the CSP: scripts EXACTLY nonce-only (no unsafe-inline)", () => {
    const html = buildMathPreviewHtml({ ...BASE, regions: [inline("x")] });
    const csp = cspDirectives(html);
    expect(csp["default-src"]).toBe("'none'");
    // Exact equality, not toContain: appending 'unsafe-inline' or '*' to
    // script-src would re-enable inline-script XSS yet still satisfy a substring
    // check — assert the directive is the nonce and nothing more (gate d).
    expect(csp["script-src"]).toBe("'nonce-n0nce123'");
    expect(csp["script-src"]).not.toMatch(/unsafe-inline|\*/);
    // KaTeX needs its stylesheet (inline element styles included) + woff2 fonts,
    // both restricted to the webview's own resource origin.
    expect(csp["style-src"]).toBe("vscode-webview://abc 'unsafe-inline'");
    expect(csp["font-src"]).toBe("vscode-webview://abc");
  });

  it("links the KaTeX stylesheet and loads the script with the nonce", () => {
    const html = buildMathPreviewHtml({ ...BASE, regions: [inline("x")] });
    expect(html).toContain(
      '<link rel="stylesheet" href="https://cdn.example/katex.min.css"',
    );
    expect(html).toContain(
      '<script nonce="n0nce123" src="https://cdn.example/katex.min.js"',
    );
  });

  it("embeds the regions as data the render script consumes", () => {
    const regions: MathRegion[] = [
      inline("a+b"),
      { type: "display", content: "\\int x", startLine: 2, endLine: 4 },
    ];
    const html = buildMathPreviewHtml({ ...BASE, regions });
    expect(html).toContain('"content":"a+b"');
    expect(html).toContain('"type":"display"');
    expect(html).toContain('"content":"\\\\int x"');
  });

  it("escapes < in embedded content so it cannot break out of the script", () => {
    const html = buildMathPreviewHtml({ ...BASE, regions: [inline("a </script> b")] });
    expect(html).not.toContain("</script> b");
    expect(html).toContain("\\u003c/script>");
  });

  it("shows an empty-state message when there is no math", () => {
    const html = buildMathPreviewHtml({ ...BASE, regions: [] });
    expect(html).toMatch(/no math/i);
  });
});
