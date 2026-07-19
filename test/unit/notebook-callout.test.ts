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

  it("leaves a generic fenced div ::: {.foo} unrendered", () => {
    const html = render("::: {.foo}\nBody.\n:::\n");
    expect(html).not.toContain('class="callout');
  });

  it("leaves an unknown callout type ::: {.callout-bogus} unrendered (closed set)", () => {
    const html = render("::: {.callout-bogus}\nBody.\n:::\n");
    expect(html).not.toContain('class="callout');
    expect(html).toContain(":::"); // falls through as raw text, not silently dropped
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
