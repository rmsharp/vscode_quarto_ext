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

  it('keeps the LAST id when several are present: ::: {#a #b} -> <div id="b"> (matches Pandoc)', () => {
    const html = render("::: {#a #b}\nBody.\n:::\n");
    expect(html).toContain('<div id="b">');
    expect(html).not.toContain('id="a"');
  });

  it('keeps an interior dot in a class name: ::: {.a.b} -> <div class="a.b"> (matches Pandoc)', () => {
    const html = render("::: {.a.b}\nBody.\n:::\n");
    expect(html).toContain('<div class="a.b">');
  });

  it('keeps an interior dot in an id: ::: {#id.class} -> <div id="id.class">', () => {
    const html = render("::: {#id.class}\nBody.\n:::\n");
    expect(html).toContain('<div id="id.class">');
  });

  it("leaves an empty attribute block ::: {} unrendered (no id or class)", () => {
    const html = render("::: {}\nBody.\n:::\n");
    expect(html).not.toContain("<div");
    expect(html).toContain(":::"); // falls through as raw text
  });

  it('emits a key=value-only div ::: {data-x="y"} as <div data-x="y"> (already data- prefixed → verbatim)', () => {
    // Grounded vs quarto render. Was deferred (unrendered); now key=value is
    // emitted. `data-x` already carries the `data-` prefix, so it passes through.
    const html = render('::: {data-x="y"}\nBody.\n:::\n');
    expect(html).toContain('<div data-x="y">');
    expect(html).not.toContain(":::");
  });

  it('emits a known HTML5 attr verbatim (no data-): ::: {style="padding: .5em"} -> <div style="padding: .5em">', () => {
    // Grounded vs quarto render: `style` is a known HTML5 attribute, emitted as
    // written; the `.5em` inside the value is a value, never a class.
    const html = render('::: {style="padding: .5em"}\nBody.\n:::\n');
    expect(html).toContain('<div style="padding: .5em">');
    expect(html).not.toContain("class="); // no phantom `.5em` class
  });

  it('keeps a # inside a value as a value, not an id: ::: {data-target="go #home"} -> <div data-target="go #home">', () => {
    const html = render('::: {data-target="go #home"}\nBody.\n:::\n');
    expect(html).toContain('<div data-target="go #home">');
    expect(html).not.toContain('id="'); // the `#home` is value text, not an id
  });

  it('emits a real class AND a known attr with a dotted value: ::: {.box title="a .b"} -> <div class="box" title="a .b">', () => {
    // Grounded vs quarto render: the `.box` class and the `title` attribute both
    // survive; the `.b` inside the value is value text, not a second class.
    const html = render('::: {.box title="a .b"}\nBody.\n:::\n');
    expect(html).toContain('<div class="box" title="a .b">');
    expect(html).not.toContain("box b"); // `.b` did NOT become a class
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

  // --- Bare-word shorthand (::: foo) — grounded firsthand vs quarto pandoc 3.6.3 ---

  it('renders bare-word shorthand ::: foo as <div class="foo"> (no braces)', () => {
    // Grounded vs quarto render: `::: foo` ≡ `::: {.foo}` → <div class="foo">.
    const html = render("::: foo\nBody.\n:::\n");
    expect(html).toContain('<div class="foo">');
    expect(html).toContain("<p>Body.</p>");
    expect(html).not.toContain(":::"); // fully rendered, not raw text
  });

  // --- key=value attribute emission — grounded firsthand vs quarto pandoc 3.6.3.
  // Pandoc data-prefixes an UNKNOWN attribute name (`key` → `data-key`); order is
  // id, then all classes, then other attributes in source order. ---

  it('emits an unknown key=value as a data- attribute: ::: {.box key=val} -> <div class="box" data-key="val">', () => {
    const html = render("::: {.box key=val}\nBody.\n:::\n");
    expect(html).toContain('<div class="box" data-key="val">');
    expect(html).toContain("<p>Body.</p>");
  });

  it('renders a key=value-only div ::: {data-x="y"} (no id/class) as <div data-x="y">', () => {
    const html = render('::: {data-x="y"}\nBody.\n:::\n');
    expect(html).toContain('<div data-x="y">');
    expect(html).toContain("<p>Body.</p>");
  });

  it('emits a known HTML5 attribute verbatim, not data- prefixed: ::: {.x style="color:red"}', () => {
    const html = render('::: {.x style="color:red"}\nBody.\n:::\n');
    expect(html).toContain('<div class="x" style="color:red">');
    expect(html).not.toContain("data-style");
  });

  it('passes an aria-* attribute through verbatim: ::: {.x aria-label="hi"}', () => {
    const html = render('::: {.x aria-label="hi"}\nBody.\n:::\n');
    expect(html).toContain('<div class="x" aria-label="hi">');
    expect(html).not.toContain("data-aria");
  });

  it('passes a namespaced (colon) attribute through verbatim: ::: {.x xml:lang="en"}', () => {
    const html = render('::: {.x xml:lang="en"}\nBody.\n:::\n');
    expect(html).toContain('<div class="x" xml:lang="en">');
  });

  it('data- prefixes an unknown name case-sensitively: ::: {.x Foo=Bar} -> data-Foo', () => {
    const html = render("::: {.x Foo=Bar}\nBody.\n:::\n");
    expect(html).toContain('<div class="x" data-Foo="Bar">');
  });

  it("accepts an unquoted value: ::: {width=50%} -> <div width=\"50%\">", () => {
    // `width` is a known attr; `50%` is an unquoted value.
    const html = render("::: {width=50%}\nBody.\n:::\n");
    expect(html).toContain('<div width="50%">');
  });

  it("orders attributes id, then classes, then others in source order", () => {
    // Grounded vs quarto render: {#id .cls key=v style="s" data-z="1"} ->
    // <div id="id" class="cls" data-key="v" style="s" data-z="1">.
    const html = render(
      '::: {#id .cls key=v style="s" data-z="1"}\nBody.\n:::\n',
    );
    expect(html).toContain(
      '<div id="id" class="cls" data-key="v" style="s" data-z="1">',
    );
  });

  it("groups classes first even when a class follows an attribute: ::: {style=\"x\" .late}", () => {
    const html = render('::: {style="x" .late}\nBody.\n:::\n');
    expect(html).toContain('<div class="late" style="x">');
  });

  // --- Pandoc attribute-list semantics: class=/id= merge into the class list /
  // id; duplicate classes and duplicate attributes collapse. Grounded firsthand. ---

  it('treats class= as a class, not a data- attr: ::: {class=v} -> <div class="v">', () => {
    const html = render("::: {class=v}\nBody.\n:::\n");
    expect(html).toContain('<div class="v">');
    expect(html).not.toContain("data-class");
  });

  it('treats id= as the id, not a data- attr: ::: {id=v} -> <div id="v">', () => {
    const html = render("::: {id=v}\nBody.\n:::\n");
    expect(html).toContain('<div id="v">');
    expect(html).not.toContain("data-id");
  });

  it('splits a class= value on whitespace and appends to .class: ::: {.a class="b c"} -> <div class="a b c">', () => {
    const html = render('::: {.a class="b c"}\nBody.\n:::\n');
    expect(html).toContain('<div class="a b c">');
  });

  it('lets a later id= win over an earlier #id: ::: {#x id=y} -> <div id="y">', () => {
    const html = render("::: {#x id=y}\nBody.\n:::\n");
    expect(html).toContain('<div id="y">');
    expect(html).not.toContain('id="x"');
  });

  it('deduplicates repeated classes: ::: {.a .b .a} -> <div class="a b">', () => {
    const html = render("::: {.a .b .a}\nBody.\n:::\n");
    expect(html).toContain('<div class="a b">');
  });

  it('deduplicates a class across .class and class=: ::: {.a class="a b"} -> <div class="a b">', () => {
    const html = render('::: {.a class="a b"}\nBody.\n:::\n');
    expect(html).toContain('<div class="a b">');
  });

  it('keeps the FIRST of a duplicate attribute name: ::: {data-x=1 data-x=2} -> <div data-x="1">', () => {
    const html = render("::: {data-x=1 data-x=2}\nBody.\n:::\n");
    expect(html).toContain('<div data-x="1">');
    expect(html).not.toContain('data-x="2"');
  });

  // --- Quoted-value fidelity: backslash escapes and a `}` inside a quoted value.
  // Grounded firsthand vs quarto pandoc 3.6.3. ---

  it('unescapes \\" and \\\\ inside a double-quoted value', () => {
    // ::: {.a key="he said \"hi\""} -> <div class="a" data-key="he said &quot;hi&quot;">
    const html = render(
      '::: {.a key="he said \\"hi\\""}\nBody.\n:::\n',
    );
    expect(html).toContain(
      '<div class="a" data-key="he said &quot;hi&quot;">',
    );
  });

  it('keeps a non-escape backslash literal: ::: {key="a\\nb"} -> data-key="a\\nb"', () => {
    const html = render('::: {key="a\\nb"}\nBody.\n:::\n');
    expect(html).toContain('<div data-key="a\\nb">');
  });

  it('allows a } inside a quoted value: ::: {key="a}b"} -> <div data-key="a}b">', () => {
    const html = render('::: {key="a}b"}\nBody.\n:::\n');
    expect(html).toContain('<div data-key="a}b">');
  });

  // --- Invalid-block guards + no-space marker. Grounded firsthand: a brace block
  // with a bare word or a bad key is not a valid div and falls through. ---

  it("leaves a bare word inside braces unrendered: ::: {.box checked}", () => {
    // `checked` is neither #id, .class, nor key=value → the block is invalid.
    const html = render("::: {.box checked}\nBody.\n:::\n");
    expect(html).not.toContain("<div");
    expect(html).toContain(":::");
  });

  it("leaves a digit-leading key unrendered: ::: {1abc=v}", () => {
    // A key must start with a letter or `_`; `1abc` is invalid → block invalid.
    const html = render("::: {1abc=v}\nBody.\n:::\n");
    expect(html).not.toContain("<div");
    expect(html).toContain(":::");
  });

  it("leaves a multi-word bare shorthand unrendered: ::: foo bar", () => {
    const html = render("::: foo bar\nBody.\n:::\n");
    expect(html).not.toContain("<div");
    expect(html).toContain(":::");
  });

  it('accepts a bare word with no space after the marker: :::foo -> <div class="foo">', () => {
    const html = render(":::foo\nBody.\n:::\n");
    expect(html).toContain('<div class="foo">');
    expect(html).toContain("<p>Body.</p>");
  });

  // --- Adversarial-panel fixes (grounded firsthand vs quarto pandoc 3.6.3) ---

  it("passes window/clipboard event handlers through verbatim (not data-): oncopy, onpaste, onstorage, …", () => {
    // These 21 handlers are in pandoc 3.6.3's HTML5 attribute set; the plugin's
    // first derivation missed them (incomplete candidate list).
    for (const h of [
      "oncopy",
      "onpaste",
      "onstorage",
      "onhashchange",
      "onbeforeunload",
      "onauxclick",
    ]) {
      const html = render(`::: {.b ${h}=v}\nX\n:::\n`);
      expect(html).toContain(`<div class="b" ${h}="v">`);
      expect(html).not.toContain(`data-${h}`);
    }
  });

  it('unescapes a backslash before ASCII punctuation in a value: ::: {.cell pattern="\\.csv$"} -> pattern=".csv$"', () => {
    // Grounded vs quarto render: pandoc drops the backslash before ASCII
    // punctuation (\. -> .), matching markdown-it unescapeAll.
    const html = render('::: {.cell pattern="\\.csv$"}\nX\n:::\n');
    expect(html).toContain('<div class="cell" pattern=".csv$">');
  });

  it('keeps a backslash before a letter or digit: ::: {key="a\\1b"} -> data-key="a\\1b"', () => {
    const html = render('::: {key="a\\1b"}\nX\n:::\n');
    expect(html).toContain('<div data-key="a\\1b">');
  });

  it('decodes a character reference in a value (no double-escape): ::: {.b title="A &amp; B"}', () => {
    // Grounded vs quarto render: pandoc decodes `&amp;` to `&` then the HTML
    // writer re-escapes it to `&amp;` — a single entity, not `&amp;amp;`.
    const html = render('::: {.b title="A &amp; B"}\nX\n:::\n');
    expect(html).toContain('<div class="b" title="A &amp; B">');
    expect(html).not.toContain("&amp;amp;");
  });

  it('decodes a named/numeric reference in a value: ::: {.b title="&copy;&#65;"} -> ©A', () => {
    const html = render('::: {.b title="&copy;&#65;"}\nX\n:::\n');
    expect(html).toContain('<div class="b" title="©A">');
  });

  it("does not treat a malformed {…}-glued-to-trailing block as a bare word class: ::: {.callout-note}x", () => {
    // A complete {…} block with glued trailing content is neither a valid attr
    // block nor a bare word → pandoc renders no div; the plugin must not invent
    // a class literally named "{.callout-note}x".
    const html = render("::: {.callout-note}x\nBODY\n:::\n");
    expect(html).not.toContain("<div");
    expect(html).toContain(":::");
  });

  it("leaves a leading-underscore key unrendered: ::: {.b _key=v}", () => {
    // Grounded vs quarto render: an attribute key must start with a LETTER;
    // a leading underscore is invalid → the whole block is not a div.
    const html = render("::: {.b _key=v}\nBODY\n:::\n");
    expect(html).not.toContain("<div");
    expect(html).toContain(":::");
  });

  it("still accepts an interior underscore in a key: ::: {.b k_y=v} -> data-k_y", () => {
    const html = render("::: {.b k_y=v}\nBODY\n:::\n");
    expect(html).toContain('<div class="b" data-k_y="v">');
  });
});
