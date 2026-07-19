import { describe, expect, it } from "vitest";
import MarkdownIt from "markdown-it";
import { calloutPlugin } from "../../src/core/notebook-callout";

/**
 * `calloutPlugin` is a pure, `vscode`-free markdown-it plugin (BACKLOG item 17d)
 * that teaches markdown-it to render a Quarto `::: {.callout-<type>}` fenced div
 * (note/tip/warning/caution/important) as an admonition `<div>`. The webview
 * entrypoint (`src/webview/notebook-renderer.ts`) hands it to VS Code's built-in
 * `vscode.markdown-it-renderer` via `extendMarkdownIt(md => md.use(calloutPlugin))`,
 * so notebook markdown cells render Quarto callouts instead of raw `:::` text.
 *
 * The plugin runs webview-side, so its rendering logic is unit-tested here
 * headlessly by constructing a markdown-it instance the same way VS Code does.
 */
function render(src: string): string {
  return new MarkdownIt().use(calloutPlugin).render(src);
}

describe("calloutPlugin", () => {
  it("wraps a ::: {.callout-note} block in a callout-note div and renders its body", () => {
    const html = render("::: {.callout-note}\nHello.\n:::\n");
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain("<p>Hello.</p>");
  });

  it("renders the callout body as markdown (inner **bold** becomes <strong>)", () => {
    const html = render("::: {.callout-note}\nSome **bold** text.\n:::\n");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("labels the callout with the default title 'Note'", () => {
    const html = render("::: {.callout-note}\nBody.\n:::\n");
    expect(html).toContain('class="callout-title">Note<');
  });

  it("renders ::: {.callout-tip} as a tip callout labelled 'Tip'", () => {
    const html = render("::: {.callout-tip}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-tip"');
    expect(html).toContain('class="callout-title">Tip<');
    expect(html).toContain("<p>Body.</p>");
  });

  it("renders ::: {.callout-warning} as a warning callout labelled 'Warning'", () => {
    const html = render("::: {.callout-warning}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-warning"');
    expect(html).toContain('class="callout-title">Warning<');
    expect(html).toContain("<p>Body.</p>");
  });

  it("renders ::: {.callout-caution} as a caution callout labelled 'Caution'", () => {
    const html = render("::: {.callout-caution}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-caution"');
    expect(html).toContain('class="callout-title">Caution<');
    expect(html).toContain("<p>Body.</p>");
  });

  it("renders ::: {.callout-important} as an important callout labelled 'Important'", () => {
    const html = render("::: {.callout-important}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-important"');
    expect(html).toContain('class="callout-title">Important<');
    expect(html).toContain("<p>Body.</p>");
  });

  it('renders a generic fenced div ::: {.foo} as <div class="foo"> with its body', () => {
    const html = render("::: {.foo}\nBody.\n:::\n");
    expect(html).toContain('<div class="foo">');
    expect(html).toContain("<p>Body.</p>");
    expect(html).not.toContain(":::"); // fully rendered, not raw `:::` text
    expect(html).not.toContain('class="callout'); // a generic div is not an admonition
  });

  it('renders an unknown callout type ::: {.callout-bogus} as a plain <div class="callout-bogus"> (not an admonition)', () => {
    // Grounded against `quarto render`: an unknown `.callout-*` class is just a
    // Pandoc div; only the closed set of KNOWN types becomes an admonition.
    const html = render("::: {.callout-bogus}\nBody.\n:::\n");
    expect(html).toContain('<div class="callout-bogus">');
    expect(html).not.toContain('class="callout callout-'); // NOT the admonition wrapper
    expect(html).not.toContain("callout-title"); // no callout header/title
  });

  it('renders id + multiple classes: ::: {#myid .bar .baz} -> <div id="myid" class="bar baz">', () => {
    // Grounded against `quarto render`: id first, classes space-joined.
    const html = render("::: {#myid .bar .baz}\nBody.\n:::\n");
    expect(html).toContain('<div id="myid" class="bar baz">');
    expect(html).toContain("<p>Body.</p>");
  });

  it('renders an id-only fenced div ::: {#solo} as <div id="solo">', () => {
    const html = render("::: {#solo}\nBody.\n:::\n");
    expect(html).toContain('<div id="solo">');
    expect(html).toContain("<p>Body.</p>");
  });

  it("first known callout class wins: {.callout-note .callout-bogus} renders as a note", () => {
    // A valid callout class must not be masked by a later unknown .callout-* class.
    const html = render("::: {.callout-note .callout-bogus}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('class="callout-title">Note<');
  });

  it("first known callout class wins deterministically: {.callout-note .callout-tip} is a note", () => {
    const html = render("::: {.callout-note .callout-tip}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-note"');
    expect(html).not.toContain("callout-tip");
  });

  it("leaves an empty attribute block ::: {} unrendered (no id or class)", () => {
    const html = render("::: {}\nBody.\n:::\n");
    expect(html).not.toContain("<div");
    expect(html).toContain(":::"); // falls through as raw text
  });

  it("leaves a key=value-only div ::: {data-x=\"y\"} unrendered (key=val deferred)", () => {
    // key=value attributes are out of scope this slice; with no id/class the div
    // is not recognised and falls through, rather than rendering an empty <div>.
    const html = render('::: {data-x="y"}\nBody.\n:::\n');
    expect(html).not.toContain("<div");
    expect(html).toContain(":::");
  });

  it("callout still wins when a generic class precedes a callout class: {.foo .callout-note}", () => {
    // The generic-div branch must never steal a div that is a known callout.
    const html = render("::: {.foo .callout-note}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('class="callout-title">Note<');
    expect(html).not.toContain('<div class="foo">'); // not rendered as a generic div
  });

  it("renders a generic div's body as markdown (inner **bold** becomes <strong>)", () => {
    const html = render("::: {.foo}\nSome **bold** text.\n:::\n");
    expect(html).toContain('<div class="foo">');
    expect(html).toContain("<strong>bold</strong>");
  });

  it("does not absorb content after the closing fence into a generic div", () => {
    const html = render("::: {.foo}\nInside.\n:::\n\nOutside.\n");
    const closeIdx = html.indexOf("</div>");
    const outsideIdx = html.indexOf("Outside.");
    expect(closeIdx).toBeGreaterThan(-1);
    expect(outsideIdx).toBeGreaterThan(closeIdx);
  });

  it("renders two generic divs in one cell as two separate blocks", () => {
    const html = render("::: {.a}\nFirst.\n:::\n\n::: {.b}\nSecond.\n:::\n");
    expect(html).toContain('<div class="a">');
    expect(html).toContain('<div class="b">');
    expect(html).toContain("First.");
    expect(html).toContain("Second.");
  });

  it("auto-closes an unterminated callout at the end of the cell", () => {
    const html = render("::: {.callout-note}\nNo closing fence.\n");
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain("No closing fence.");
  });

  it("does not absorb content after the closing fence into the callout body", () => {
    const html = render("::: {.callout-note}\nInside.\n:::\n\nOutside.\n");
    const closeIdx = html.indexOf("</div>\n</div>");
    const outsideIdx = html.indexOf("Outside.");
    expect(closeIdx).toBeGreaterThan(-1);
    expect(outsideIdx).toBeGreaterThan(closeIdx);
  });

  it("matches a note callout that also carries an id or extra classes", () => {
    const html = render("::: {#nb .callout-note .extra}\nBody.\n:::\n");
    expect(html).toContain('class="callout callout-note"');
  });

  it("does not match a class that merely starts with callout-note (e.g. .callout-notes)", () => {
    const html = render("::: {.callout-notes}\nBody.\n:::\n");
    expect(html).not.toContain('class="callout callout-note"');
  });

  it("renders two different callout types in one cell as distinct blocks", () => {
    const html = render(
      "::: {.callout-note}\nFirst.\n:::\n\n::: {.callout-warning}\nSecond.\n:::\n",
    );
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('class="callout callout-warning"');
    expect(html).toContain('class="callout-title">Note<');
    expect(html).toContain('class="callout-title">Warning<');
    expect(html).toContain("First.");
    expect(html).toContain("Second.");
  });

  it("renders two callouts in one cell as two separate blocks", () => {
    const html = render(
      "::: {.callout-note}\nFirst.\n:::\n\n::: {.callout-note}\nSecond.\n:::\n",
    );
    const matches = html.match(/class="callout callout-note"/g) ?? [];
    expect(matches).toHaveLength(2);
    expect(html).toContain("First.");
    expect(html).toContain("Second.");
  });
});
