import { describe, expect, it } from "vitest";
import MarkdownIt from "markdown-it";
import { calloutPlugin, calloutStyles } from "../../src/core/notebook-callout";

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

  // --- Nested fenced divs (depth tracking; grounded firsthand vs quarto pandoc 3.6.3) ---

  it("pairs same-length nested divs correctly, keeping trailing content inside the outer div", () => {
    // The reported HIGH bug: the closing-fence scan had no depth tracking, so the
    // outer div grabbed the INNER div's closer and closed early — ejecting AFTER
    // outside the outer div and folding the real outer closer into a literal <p>.
    // Pandoc pairs the fences: outer wraps inner AND the trailing AFTER paragraph.
    const html = render(
      "::: {.outer}\n::: {.inner}\nZ\n:::\nAFTER\n:::\n",
    );
    expect(html).toContain('<div class="outer">');
    expect(html).toContain('<div class="inner">');
    expect(html).toContain("<p>Z</p>");
    expect(html).toContain("<p>AFTER</p>");
    // No fence leaks as literal text, and AFTER sits before the outer's own
    // closing </div> (i.e. inside the outer div).
    expect(html).not.toContain(":::");
    expect(html.trimEnd().endsWith("</div>")).toBe(true);
    expect(html.indexOf("AFTER")).toBeLessThan(html.lastIndexOf("</div>"));
  });

  it("pairs same-length nested bare-word divs (::: outer / ::: inner)", () => {
    const html = render("::: outer\n::: inner\nZ\n:::\nAFTER\n:::\n");
    expect(html).toContain('<div class="outer">');
    expect(html).toContain('<div class="inner">');
    expect(html).toContain("<p>AFTER</p>");
    expect(html).not.toContain(":::");
    expect(html.indexOf("AFTER")).toBeLessThan(html.lastIndexOf("</div>"));
  });

  it("closes a longer-fenced div (::::) on a shorter closing fence (:::), matching pandoc", () => {
    // The closer's colon count is independent of the opener's — grounded vs
    // pandoc 3.6.3. (Before the depth-tracking fix, the scan required the closer
    // to be at least as long as the opener, so a :::: div stayed open forever.)
    const html = render(":::: {.x}\nZ\n:::\n");
    expect(html).toContain('<div class="x">');
    expect(html).toContain("<p>Z</p>");
    expect(html).not.toContain(":::");
    expect(html.trimEnd().endsWith("</div>")).toBe(true);
  });

  it("pairs mixed-length nesting (outer ::::, inner :::), keeping trailing content inside", () => {
    const html = render(
      ":::: {.outer}\n::: {.inner}\nZ\n:::\nAFTER\n::::\n",
    );
    expect(html).toContain('<div class="outer">');
    expect(html).toContain('<div class="inner">');
    expect(html).toContain("<p>AFTER</p>");
    expect(html).not.toContain(":::");
    expect(html.indexOf("AFTER")).toBeLessThan(html.lastIndexOf("</div>"));
  });

  it("keeps a nested callout inside a generic outer div (.callout-note in .panel-tabset), trailing content still inside", () => {
    // The real-world case from the bug report: a callout nested in a panel-tabset.
    const html = render(
      "::: {.panel-tabset}\n::: {.callout-note}\nBody\n:::\nAFTER\n:::\n",
    );
    expect(html).toContain('<div class="panel-tabset">');
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("<p>AFTER</p>");
    expect(html).not.toContain(":::");
    expect(html.trimEnd().endsWith("</div>")).toBe(true);
    expect(html.indexOf("AFTER")).toBeLessThan(html.lastIndexOf("</div>"));
  });

  it("keeps trailing content inside an outer CALLOUT when a generic div is nested in it", () => {
    const html = render(
      "::: {.callout-note}\n::: {.inner}\nBody\n:::\nAFTER\n:::\n",
    );
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('<div class="inner">');
    expect(html).toContain("<p>AFTER</p>");
    expect(html).not.toContain(":::");
    expect(html.indexOf("AFTER")).toBeLessThan(html.lastIndexOf("</div>"));
  });

  it("pairs three levels of same-length nesting", () => {
    const html = render(
      "::: {.a}\n::: {.b}\n::: {.c}\nZ\n:::\n:::\n:::\n",
    );
    expect(html).toContain('<div class="a">');
    expect(html).toContain('<div class="b">');
    expect(html).toContain('<div class="c">');
    expect(html).toContain("<p>Z</p>");
    expect(html).not.toContain(":::");
    expect((html.match(/<div/g) ?? []).length).toBe(3);
    expect((html.match(/<\/div>/g) ?? []).length).toBe(3);
  });

  it("does not count a fence-like non-opener (::: foo bar) as a nested div, so the first bare ::: closes the outer", () => {
    // `::: foo bar` is neither a valid opener (multi-word bare spec) nor a bare
    // closer → it is body text and must NOT push depth. If it did, the outer div
    // would swallow everything after. Grounded vs pandoc: the outer closes at the
    // first bare :::, and AFTER falls OUTSIDE it.
    const html = render(
      "::: {.outer}\n::: foo bar\nZ\n:::\nAFTER\n:::\n",
    );
    expect(html).toContain('<div class="outer">');
    expect(html).not.toContain('class="foo"'); // never became a div
    const openIdx = html.indexOf('<div class="outer">');
    const closeIdx = html.indexOf("</div>", openIdx); // the outer's own close
    expect(html.indexOf("::: foo bar")).toBeLessThan(closeIdx); // body text, inside
    expect(html.indexOf("AFTER")).toBeGreaterThan(closeIdx); // outside the outer div
  });

  it("does not treat a ::: line inside a ~~~ fenced code block as a div fence", () => {
    // The depth scan must skip fenced code, or a :::-looking OPENER inside the
    // code block is mis-counted as a nested opener and consumes the div's real
    // closer. Grounded vs pandoc 3.6.3: the code is literal, the div closes at
    // its own :::, and AFTER stays outside.
    const html = render("::: {.outer}\n~~~\n::: {.x}\n~~~\n:::\nAFTER\n");
    expect(html).toContain('<div class="outer">');
    expect(html).toContain("<pre><code>::: {.x}"); // literal code, not a div
    expect(html).not.toContain('class="x"'); // never opened as a div
    expect(html).not.toContain("<p>:::"); // no leaked closing fence
    expect(html.indexOf("AFTER")).toBeGreaterThan(html.indexOf("</div>")); // outside
  });

  it("does not treat a ::: line inside a ``` fenced code block as a div fence", () => {
    const html = render("::: {.outer}\n```\n::: {.x}\n```\n:::\nAFTER\n");
    expect(html).toContain('<div class="outer">');
    expect(html).toContain("<pre><code>::: {.x}");
    expect(html).not.toContain('class="x"');
    expect(html).not.toContain("<p>:::");
    expect(html.indexOf("AFTER")).toBeGreaterThan(html.indexOf("</div>"));
  });

  it("keeps a bare ::: inside a code block literal (does not close the div early)", () => {
    // Grounded vs pandoc 3.6.3: the div closes at the ::: AFTER the code block,
    // not at the bare ::: inside it, so the code block is not split.
    const html = render("::: {.outer}\n~~~\n:::\n~~~\n:::\n");
    expect(html).toContain('<div class="outer">');
    expect(html).toContain("<pre><code>:::");
    expect(html.trimEnd().endsWith("</div>")).toBe(true); // div closes last
    // exactly one <pre><code> — the code block was not split into two
    expect((html.match(/<pre>/g) ?? []).length).toBe(1);
  });

  it("does not absorb an independent sibling div after a div containing example ::: code", () => {
    const html = render(
      "::: {.outer}\n~~~\n::: {.inner}\n~~~\n:::\n\n::: {.sib}\ny\n:::\n",
    );
    expect(html).toContain('<div class="outer">');
    expect(html).toContain('<div class="sib">');
    expect(html).not.toContain('class="inner"'); // literal code, not a div
    // .sib is a sibling of .outer, not nested inside it
    const outerClose = html.indexOf("</div>");
    expect(html.indexOf('<div class="sib">')).toBeGreaterThan(outerClose);
  });

  describe("custom callout titles (17d follow-on D)", () => {
    it("uses a title= attribute as the callout's displayed title", () => {
      const html = render('::: {.callout-note title="Custom Title"}\nBody.\n:::\n');
      expect(html).toContain('class="callout-title">Custom Title<');
      expect(html).toContain('class="callout callout-note"'); // still a note callout
      expect(html).toContain("<p>Body.</p>");
    });

    it("extracts a leading ## heading as the title and removes it from the body", () => {
      const html = render(
        "::: {.callout-note}\n## My Heading Title\nBody text.\n:::\n",
      );
      expect(html).toContain('class="callout-title">My Heading Title<');
      expect(html).toContain("<p>Body text.</p>");
      expect(html).not.toContain("<h2"); // heading became the title, not left in body
    });

    it("renders inline markdown in an extracted heading title", () => {
      const html = render(
        "::: {.callout-note}\n## A **bold** word\nBody.\n:::\n",
      );
      expect(html).toContain(
        'class="callout-title">A <strong>bold</strong> word<',
      );
    });

    it("renders inline markdown in a title= attribute", () => {
      const html = render(
        '::: {.callout-note title="a **b** c"}\nBody.\n:::\n',
      );
      expect(html).toContain('class="callout-title">a <strong>b</strong> c<');
    });

    it("lets title= win over a leading heading, keeping the heading in the body", () => {
      const html = render(
        '::: {.callout-tip title="Attr Title"}\n## Heading Title\nBody.\n:::\n',
      );
      expect(html).toContain('class="callout-title">Attr Title<');
      expect(html).toContain("<h2>Heading Title</h2>"); // heading stays in the body
      expect(html).toContain("<p>Body.</p>");
    });

    it("falls back to the default title for an empty title=\"\"", () => {
      const html = render('::: {.callout-note title=""}\nBody.\n:::\n');
      expect(html).toContain('class="callout-title">Note<');
    });

    it("still extracts a leading heading when title= is empty", () => {
      const html = render(
        '::: {.callout-note title=""}\n## Heading Here\nBody.\n:::\n',
      );
      expect(html).toContain('class="callout-title">Heading Here<');
      expect(html).not.toContain("<h2");
    });

    it("extracts a leading setext heading as the title", () => {
      const html = render(
        "::: {.callout-note}\nUnderlined Title\n========\nBody.\n:::\n",
      );
      expect(html).toContain('class="callout-title">Underlined Title<');
      expect(html).not.toContain("<h1");
    });

    it("extracts a leading heading of any level (### -> title)", () => {
      const html = render("::: {.callout-note}\n### Deep\nBody.\n:::\n");
      expect(html).toContain('class="callout-title">Deep<');
      expect(html).not.toContain("<h3");
    });

    it("does not extract a heading that is not the first block", () => {
      const html = render(
        "::: {.callout-note}\nIntro para.\n\n## Later Heading\nBody.\n:::\n",
      );
      expect(html).toContain('class="callout-title">Note<'); // default title kept
      expect(html).toContain("<h2>Later Heading</h2>"); // heading stays in the body
    });

    it("extracts a leading heading even with a blank line before it", () => {
      const html = render("::: {.callout-note}\n\n## After Blank\nBody.\n:::\n");
      expect(html).toContain('class="callout-title">After Blank<');
      expect(html).not.toContain("<h2");
    });

    it("extracts only the FIRST heading; later headings stay in the body", () => {
      const html = render(
        "::: {.callout-note}\n## First H\n## Second H\nBody.\n:::\n",
      );
      expect(html).toContain('class="callout-title">First H<');
      expect(html).toContain("<h2>Second H</h2>");
    });

    it("renders a heading-only callout with an extracted title and empty body", () => {
      const html = render("::: {.callout-note}\n## Just A Title\n:::\n");
      expect(html).toContain('class="callout-title">Just A Title<');
      expect(html).not.toContain("<h2");
      expect(html).not.toContain("<p>"); // no body content
    });

    it("HTML-escapes & and < in a title= value", () => {
      const html = render('::: {.callout-note title="A & B < C"}\nx\n:::\n');
      expect(html).toContain('class="callout-title">A &amp; B &lt; C<');
    });

    it("does not treat a generic (non-callout) div's title= as a display title", () => {
      // A generic div's title= is a plain HTML attribute (S116), not a callout
      // title; the callout-title logic must not touch the generic-div path.
      const html = render('::: {.foo title="x"}\n## H\nBody.\n:::\n');
      expect(html).toContain('<div class="foo" title="x">');
      expect(html).toContain("<h2>H</h2>"); // heading NOT extracted for a generic div
      expect(html).not.toContain("callout-title");
    });

    it("falls back to the default title for an empty leading heading, still removed from body", () => {
      // quarto strips the empty heading from the body but titles the callout with
      // the default type name — matching the title="" fallback (adversarial panel).
      const html = render("::: {.callout-note}\n##\nBody.\n:::\n");
      expect(html).toContain('class="callout-title">Note<'); // default, not blank
      expect(html).not.toContain("<h2"); // empty heading still removed from the body
      expect(html).toContain("<p>Body.</p>");
    });
  });

  describe("collapsible callouts (17d follow-on E)", () => {
    it('renders a collapse="true" callout as a collapsed <details> with a <summary> header', () => {
      // Grounded vs quarto render 1.7.33: collapse="true" makes the callout
      // collapsible and starts it collapsed. This renderer is JS-free, so the
      // faithful static equivalent is a <details> (closed) whose <summary> is the
      // callout header/title.
      const html = render('::: {.callout-note collapse="true"}\nBody.\n:::\n');
      expect(html).toContain('<details class="callout callout-note">');
      expect(html).toContain('<summary class="callout-header">');
      expect(html).toContain('class="callout-title">Note<');
      expect(html).toContain("<p>Body.</p>");
      expect(html).toContain("</details>");
      expect(html).not.toContain('<div class="callout callout-note">'); // not the plain div form
    });

    it('renders a collapse="false" callout as an expanded (open) collapsible <details>', () => {
      // Grounded vs quarto render: collapse="false" is still collapsible but
      // starts EXPANDED — distinct from a callout with no collapse attribute,
      // which is not collapsible at all. The JS-free equivalent is `<details open>`.
      const html = render('::: {.callout-note collapse="false"}\nBody.\n:::\n');
      expect(html).toContain('<details class="callout callout-note" open>');
      expect(html).toContain('<summary class="callout-header">');
      expect(html).toContain("<p>Body.</p>");
      expect(html).toContain("</details>");
    });

    it("treats an unquoted collapse=true as collapsed", () => {
      const html = render("::: {.callout-note collapse=true}\nBody.\n:::\n");
      expect(html).toContain('<details class="callout callout-note">'); // closed, no open
      expect(html).not.toContain(" open>");
    });

    it('treats a case-variant collapse="TRUE" as expanded (value match is case-sensitive)', () => {
      // quarto only recognises the exact lowercase `true`; TRUE/True start expanded.
      const html = render('::: {.callout-note collapse="TRUE"}\nBody.\n:::\n');
      expect(html).toContain('<details class="callout callout-note" open>');
    });

    it('treats a non-boolean collapse="maybe" as expanded but still collapsible', () => {
      const html = render('::: {.callout-note collapse="maybe"}\nBody.\n:::\n');
      expect(html).toContain('<details class="callout callout-note" open>');
    });

    it('treats an empty collapse="" as expanded but still collapsible', () => {
      const html = render('::: {.callout-note collapse=""}\nBody.\n:::\n');
      expect(html).toContain('<details class="callout callout-note" open>');
    });

    it("leaves a callout with no collapse attribute as a non-collapsible <div>", () => {
      const html = render("::: {.callout-note}\nBody.\n:::\n");
      expect(html).toContain('<div class="callout callout-note">');
      expect(html).not.toContain("<details");
      expect(html).not.toContain("<summary");
    });

    it("closes a collapsible callout with </details>, not a second </div>", () => {
      const html = render('::: {.callout-note collapse="true"}\nBody.\n:::\n');
      expect(html).toContain("</div>\n</details>\n");
      expect(html).not.toContain("</div>\n</div>\n"); // the plain-callout close form
    });

    it("uses an extracted leading heading as the <summary> title of a collapsed callout", () => {
      // collapse composes with heading-title extraction: the heading becomes the
      // summary title and is removed from the body (grounded vs quarto render).
      const html = render(
        '::: {.callout-note collapse="true"}\n## My Title\nBody.\n:::\n',
      );
      expect(html).toContain('<details class="callout callout-note">');
      expect(html).toContain('class="callout-title">My Title<');
      expect(html).not.toContain("<h2");
      expect(html).toContain("<p>Body.</p>");
    });

    it("uses a title= attribute as the <summary> title of a collapsible callout", () => {
      const html = render(
        '::: {.callout-tip collapse="false" title="Attr Title"}\nBody.\n:::\n',
      );
      expect(html).toContain('<details class="callout callout-tip" open>');
      expect(html).toContain('class="callout-title">Attr Title<');
    });

    it("renders body markdown inside a collapsible callout", () => {
      const html = render(
        '::: {.callout-note collapse="true"}\nSome **bold** text.\n:::\n',
      );
      expect(html).toContain("<strong>bold</strong>");
    });

    it("carries the callout type into a collapsible callout's class and title", () => {
      const html = render('::: {.callout-warning collapse="true"}\nBody.\n:::\n');
      expect(html).toContain('<details class="callout callout-warning">');
      expect(html).toContain('class="callout-title">Warning<');
    });

    it("does not turn a generic (non-callout) div's collapse= into a <details>", () => {
      // collapse is a callout-only control; on a generic div it stays a plain
      // data- attribute, byte-matching quarto render (<div class="foo" data-collapse="true">).
      const html = render('::: {.foo collapse="true"}\nGeneric.\n:::\n');
      expect(html).toContain('<div class="foo" data-collapse="true">');
      expect(html).not.toContain("<details");
      expect(html).not.toContain("<summary");
    });

    it("does not treat a literal data-collapse= attribute as the collapse control", () => {
      // quarto distinguishes the SOURCE `collapse=` control from a `data-collapse=`
      // passthrough attribute: grounded firsthand, quarto renders data-collapse as a
      // NON-collapsible callout (no data-bs-toggle / callout-collapse). Collapse
      // detection keys on the source name `collapse`, not the pandoc-normalized
      // `data-collapse` that htmlAttrName gives a real collapse= (adversarial panel).
      const html = render('::: {.callout-note data-collapse="true"}\nBody.\n:::\n');
      expect(html).toContain('<div class="callout callout-note">'); // non-collapsible
      expect(html).not.toContain("<details");
      expect(html).not.toContain("<summary");
    });
  });
});

/**
 * BACKLOG item 17d follow-on (B): CSS box styling. `calloutStyles()` returns the
 * CSS that the webview entrypoint (`src/webview/notebook-renderer.ts`) injects as a
 * `<style>` so the structural callout markup (`.callout .callout-<type>` /
 * `.callout-header` / `.callout-title` / `.callout-body`, both the `<div>` and the
 * `<details>` collapsible forms) renders as a coloured admonition box with a
 * per-type accent + icon. The palette + icons are grounded FIRSTHAND against
 * `quarto render` 1.7.33 (bootstrap theme): note #0d6efd/info-circle,
 * tip #198754/lightbulb, warning #ffc107/exclamation-triangle,
 * caution #fd7e14/cone-striped, important #dc3545/exclamation-circle. The CSS
 * targets OUR class structure (not quarto's Bootstrap DOM); the header tint is a
 * theme-adaptive translucent accent (a disclosed divergence from quarto's fixed
 * light tint, so it reads in both light and dark VS Code themes). The rendered box
 * itself is eyeball-only (no webview DOM read-back); this suite is the faithful
 * automated verification of the CSS-generation logic.
 */
describe("callout box styles (17d follow-on B)", () => {
  it("emits a base .callout box rule with rounded corners", () => {
    expect(calloutStyles()).toMatch(/\.callout\s*\{[^}]*border-radius/);
  });

  it("gives .callout-note the grounded quarto accent (#0d6efd border + translucent header tint)", () => {
    const css = calloutStyles();
    // Accent left border = quarto's bootstrap note colour, grounded firsthand.
    expect(css).toMatch(/\.callout-note\b[^{}]*\{[^}]*border-left-color:\s*#0d6efd/);
    // Header tint is that accent as a low-alpha rgba (theme-adaptive: reads in
    // light AND dark VS Code themes, a disclosed divergence from quarto's fixed
    // light tint). #0d6efd -> rgb(13, 110, 253).
    expect(css).toMatch(
      /\.callout-note\b[^{}]*\.callout-header\s*\{[^}]*background-color:\s*rgba\(13,\s*110,\s*253,/,
    );
  });

  it("prepends the grounded per-type icon (info-circle) before the note title", () => {
    const css = calloutStyles();
    // The icon is the grounded quarto/Bootstrap-Icons SVG, embedded as a data URI
    // background-image on .callout-title::before (single-quoted url(); the SVG uses
    // rgb() fills so there is no `#` to url-encode).
    expect(css).toMatch(
      /\.callout-note\s+\.callout-title::before\s*\{[^}]*background-image:\s*url\('data:image\/svg\+xml,<svg[^']*bi-info-circle/,
    );
  });

  // --- regression-lock coverage (all grounded firsthand vs quarto render 1.7.33) ---

  // [type, accent hex, "r, g, b" of the accent, the Bootstrap-Icons class name]
  const GROUNDED: ReadonlyArray<[string, string, string, string]> = [
    ["note", "#0d6efd", "13, 110, 253", "bi-info-circle"],
    ["tip", "#198754", "25, 135, 84", "bi-lightbulb"],
    ["warning", "#ffc107", "255, 193, 7", "bi-exclamation-triangle"],
    ["caution", "#fd7e14", "253, 126, 20", "bi-cone-striped"],
    ["important", "#dc3545", "220, 53, 69", "bi-exclamation-circle"],
  ];

  it.each(GROUNDED)(
    "gives .callout-%s its grounded accent border, translucent tint, and icon",
    (type, accent, rgb, iconClass) => {
      const css = calloutStyles();
      expect(css).toMatch(
        new RegExp(`\\.callout-${type} \\{[^}]*border-left-color: ${accent.replace("#", "\\#")};`),
      );
      expect(css).toMatch(
        new RegExp(
          `\\.callout-${type} > \\.callout-header \\{[^}]*background-color: rgba\\(${rgb}, 0\\.1\\);`,
        ),
      );
      expect(css).toMatch(
        new RegExp(
          `\\.callout-${type} \\.callout-title::before \\{[^}]*background-image: url\\('data:image/svg\\+xml,<svg[^']*${iconClass}`,
        ),
      );
    },
  );

  it("emits the base box border, margin, and body/header padding", () => {
    const css = calloutStyles();
    expect(css).toMatch(/\.callout\s*\{[^}]*border:\s*1px solid/);
    expect(css).toMatch(/\.callout\s*\{[^}]*margin:/);
    expect(css).toMatch(/\.callout-header\s*\{[^}]*padding:/);
    expect(css).toMatch(/\.callout-body\s*\{[^}]*padding:/);
  });

  it("makes a collapsible summary.callout-header show a pointer cursor", () => {
    // The <details>/<summary> collapse form reuses .callout-header; the summary
    // must read as clickable (and keeps the native disclosure marker).
    expect(calloutStyles()).toMatch(/summary\.callout-header\s*\{[^}]*cursor:\s*pointer/);
  });

  it("scaffolds the icon as an inline-block ::before box even before per-type images", () => {
    expect(calloutStyles()).toMatch(
      /\.callout-title::before\s*\{[^}]*content:\s*"";[^}]*display:\s*inline-block/,
    );
  });

  it("styles exactly the five known callout types — no more, no less", () => {
    const css = calloutStyles();
    for (const type of ["note", "tip", "warning", "caution", "important"]) {
      expect(css).toContain(`.callout-${type} {`);
    }
    // An unknown `.callout-*` renders as a plain div (not an admonition), so it
    // must never receive a box rule.
    expect(css).not.toContain(".callout-bogus");
    // Guard the count directly: five accent rules, one per type.
    expect(css.match(/border-left-color:/g)).toHaveLength(5);
  });

  it("keeps every icon data URI free of a raw # (which would truncate the url())", () => {
    // The SVGs use rgb() fills precisely so no `#` appears inside url('data:...'),
    // which a CSS parser would treat as a fragment and break the icon.
    expect(calloutStyles()).not.toMatch(/url\('data:image\/svg\+xml,[^']*#/);
  });
});
