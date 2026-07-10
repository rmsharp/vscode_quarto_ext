import { describe, expect, it } from "vitest";
import type { DiagramRegion } from "../../src/core/diagram-regions";
import { buildDiagramPreviewHtml } from "../../src/core/diagram-preview-html";

const BASE = {
  mermaidJsUri: "https://cdn.example/mermaid.min.js",
  vizJsUri: "https://cdn.example/viz-global.js",
  cspSource: "vscode-webview://abc",
  nonce: "n0nce123",
};

const mermaid = (code: string): DiagramRegion => ({
  engine: "mermaid",
  code,
  startLine: 0,
  endLine: 0,
});

const dot = (code: string): DiagramRegion => ({
  engine: "dot",
  code,
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

describe("buildDiagramPreviewHtml", () => {
  it("locks down the CSP: scripts EXACTLY nonce-only (no unsafe-inline/eval)", () => {
    const html = buildDiagramPreviewHtml({
      ...BASE,
      regions: [mermaid("flowchart LR\n A-->B")],
    });
    const csp = cspDirectives(html);
    expect(csp["default-src"]).toBe("'none'");
    // Exact equality, not toContain: appending 'unsafe-inline'/'*' to script-src
    // would re-enable script XSS yet still satisfy a substring check — assert
    // the directive is exactly the nonce plus the one narrow WASM exception
    // Graphviz rendering needs, and nothing more (gate d). 'wasm-unsafe-eval'
    // gates ONLY WebAssembly.instantiate/compile (CSP Level 3) — it does not
    // permit JS eval()/new Function(), unlike the broader 'unsafe-eval'.
    expect(csp["script-src"]).toBe("'nonce-n0nce123' 'wasm-unsafe-eval'");
    expect(csp["script-src"]).not.toMatch(/unsafe-inline|\*/);
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    // Mermaid injects inline <style>/element styles, restricted to the webview
    // origin; it uses system font names so font-src is the origin only.
    expect(csp["style-src"]).toBe("vscode-webview://abc 'unsafe-inline'");
    expect(csp["font-src"]).toBe("vscode-webview://abc");
    // C4 / architecture-beta diagrams embed their icons as inert
    // data:image/png;base64 URIs (applied via SVG <image>); without an img-src
    // these fall through to default-src 'none' and the icons silently break.
    // data: images cannot execute, so this is a safe, minimal broadening.
    expect(csp["img-src"]).toBe("vscode-webview://abc data:");
  });

  // Coverage / regression locks on the same pure builder (CSP above is the
  // genuine RED→GREEN driver). Visual rendering is F5-only residue.
  it("loads the Mermaid bundle with the nonce", () => {
    const html = buildDiagramPreviewHtml({ ...BASE, regions: [mermaid("A-->B")] });
    expect(html).toContain(
      '<script nonce="n0nce123" src="https://cdn.example/mermaid.min.js"',
    );
  });

  it("loads the vendored Graphviz (viz-global.js) bundle with the nonce", () => {
    const html = buildDiagramPreviewHtml({ ...BASE, regions: [dot("digraph {}")] });
    expect(html).toContain(
      '<script nonce="n0nce123" src="https://cdn.example/viz-global.js"',
    );
  });

  it("embeds the regions as data the render script consumes", () => {
    const regions: DiagramRegion[] = [
      mermaid("flowchart LR\n A-->B"),
      { engine: "dot", code: "digraph {}", startLine: 5, endLine: 7 },
    ];
    const html = buildDiagramPreviewHtml({ ...BASE, regions });
    expect(html).toContain('"engine":"mermaid"');
    expect(html).toContain('"engine":"dot"');
    expect(html).toContain('"code":"flowchart LR\\n A-->B"');
  });

  it("escapes < in embedded source so it cannot break out of the script", () => {
    const html = buildDiagramPreviewHtml({
      ...BASE,
      regions: [mermaid("a </script> b")],
    });
    expect(html).not.toContain("</script> b");
    expect(html).toContain("\\u003c/script>");
  });

  it("shows an empty-state message when there are no diagrams", () => {
    const html = buildDiagramPreviewHtml({ ...BASE, regions: [] });
    expect(html).toMatch(/no diagrams/i);
  });

  it("emits both the mermaid-render and dot-render code paths in the template", () => {
    // The per-engine branch (mermaid -> mermaid.render; dot -> Viz renderString)
    // runs CLIENT-SIDE in the webview, so a build-time test can only confirm
    // both code paths are present — which engine actually draws for a given
    // region is F5-only residue. This is NOT a mermaid-vs-dot discrimination
    // assertion.
    const html = buildDiagramPreviewHtml({
      ...BASE,
      regions: [mermaid("A-->B"), dot("digraph {}")],
    });
    expect(html).toContain("mermaid.render");
    expect(html).toContain("vizInstance.renderString");
    expect(html).not.toMatch(/not yet rendered/);
  });

  it("only instantiates the Graphviz WASM module lazily, when a dot region is present", () => {
    // Unlike mermaid.initialize() (cheap, always called), WASM instantiation
    // has real cost — a Mermaid-only document should not pay it (plan §2.2).
    // Build-time proof: the guard expression is present in the template.
    const html = buildDiagramPreviewHtml({ ...BASE, regions: [mermaid("A-->B")] });
    expect(html).toContain('r.engine === "dot"');
    expect(html).toContain("await Viz.instance()");
  });
});
