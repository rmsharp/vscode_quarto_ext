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

describe("buildMathPreviewHtml", () => {
  it("locks down the CSP: no default sources, scripts only by nonce", () => {
    const html = buildMathPreviewHtml({ ...BASE, regions: [inline("x")] });
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-n0nce123'");
    // KaTeX needs its stylesheet + the woff2 fonts it references.
    expect(html).toContain("style-src vscode-webview://abc 'unsafe-inline'");
    expect(html).toContain("font-src vscode-webview://abc");
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
