import { describe, expect, it } from "vitest";
import { buildPreviewHtml } from "../../src/core/preview-html";

describe("buildPreviewHtml", () => {
  it("embeds the preview URL as an iframe src", () => {
    const html = buildPreviewHtml({ url: "http://localhost:3958/" });
    expect(html).toContain('<iframe');
    expect(html).toContain('src="http://localhost:3958/"');
  });

  it("locks the CSP to default-src 'none' and frames only the preview origin", () => {
    const html = buildPreviewHtml({ url: "http://localhost:3958/" });
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("default-src 'none'");
    // frame-src must allow the server's ORIGIN (scheme+host+port), not just the
    // full URL — otherwise the iframe is blocked.
    expect(html).toMatch(/frame-src[^;]*http:\/\/localhost:3958/);
  });

  it("escapes the URL so it cannot break out of the src attribute", () => {
    const html = buildPreviewHtml({
      url: 'http://localhost:3958/"><script>alert(1)</script>',
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain('"><script>');
  });
});
