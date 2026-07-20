import type MarkdownIt from "markdown-it";

/**
 * Pure, `vscode`-free markdown-it plugin (BACKLOG item 17d) that renders Quarto
 * Pandoc fenced divs (`::: {…}` … `:::`) in notebook markdown cells.
 *
 * A Pandoc fenced div is `:::` followed by an attribute spec — either a `{…}`
 * attribute block or a bare word (`::: foo` ≡ `::: {.foo}`) — whose body is
 * ordinary markdown. The single block rule this plugin adds handles two cases:
 *
 *  - **Callout** — a class in `CALLOUT_TITLES` (`.callout-note` / `.callout-tip` /
 *    `.callout-warning` / `.callout-caution` / `.callout-important`) is wrapped in
 *    the admonition markup Quarto's HTML output uses (a titled callout block).
 *  - **Generic div** — any other fenced div carrying an id, class(es), and/or
 *    `key=value` attributes (`::: {.foo}`, `::: {#id .a .b}`, `::: {.box k=v}`,
 *    `::: foo`, an unknown `.callout-bogus`) renders as a plain
 *    `<div id=… class=… …>` around its markdown body, matching what
 *    `quarto render` emits for a non-callout div (only the closed set of known
 *    types becomes an admonition; everything else is just a div).
 *
 * `key=value` attributes are emitted with Pandoc's HTML5 `data-` rule (see
 * `htmlAttrName`); `class=`/`id=` merge into the class list / id. A div with no
 * id, class, or attribute (`::: {}`), or a malformed attribute block (`::: {.box
 * checked}`, a digit-leading key), falls through unrendered. Behaviour is
 * grounded firsthand against the quarto-bundled pandoc 3.6.3.
 *
 * The webview entrypoint (`src/webview/notebook-renderer.ts`) installs this into
 * VS Code's built-in `vscode.markdown-it-renderer` so notebook markdown cells
 * show the rendered blocks instead of raw `:::` text.
 */

const MARKER = 0x3a; // ":"
const MIN_MARKERS = 3;
const BACKTICK = 0x60; // "`"
const TILDE = 0x7e; // "~"

/**
 * The Quarto callout types this renderer recognises, each mapped to its default
 * display title. This map is the single source of truth — the block rule matches
 * a `.callout-<type>` class only when `<type>` is a key here, and the renderer
 * reads its title from here.
 */
const CALLOUT_TITLES: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  caution: "Caution",
  important: "Important",
};

/** A single Pandoc attribute block: `{ … }` with no interior `}`. */
const ATTR_BLOCK = /^\{[^}]*\}$/;

/**
 * The callout type named by an attribute block, or `undefined` if the block is
 * not a known callout.
 *
 * The block must be a single `{…}` attribute block; it may carry an id or
 * further classes (`{.callout-tip}`, `{.callout-note #warn}`,
 * `{.foo .callout-warning}`). Each `.callout-<type>` class is matched with a
 * `(?![\w-])` whole-word guard, so `.callout-note` matches but `.callout-notes`
 * and `.callout-note-2` do not. When the block lists more than one
 * `.callout-*` class, the FIRST one that is a known type wins — deterministic,
 * and a valid callout class is not masked by a later unknown one. Membership in
 * `CALLOUT_TITLES` closes the set, so a lone unknown type (e.g. `.callout-bogus`)
 * is rejected.
 */
function calloutType(params: string): string | undefined {
  const trimmed = params.trim();
  if (!ATTR_BLOCK.test(trimmed)) return undefined;
  // Fresh regex per call — the `g` flag carries `lastIndex` state that must not
  // leak across invocations.
  const classPattern = /\.callout-([a-z]+)(?![\w-])/g;
  let match: RegExpExecArray | null;
  while ((match = classPattern.exec(trimmed)) !== null) {
    if (match[1] in CALLOUT_TITLES) return match[1];
  }
  return undefined;
}

/**
 * Attribute names Pandoc's HTML5 writer emits verbatim, i.e. WITHOUT the `data-`
 * prefix it adds to unknown names. Derived FIRSTHAND from the quarto-bundled
 * pandoc 3.6.3 (what `quarto render` runs) by probing every candidate name and
 * observing which pass through — not transcribed from memory, which was wrong
 * about several (`onshow`/`onsort`/`inlist`/`popover`/`inert`/… are prefixed in
 * 3.6.3). These 214 names were re-derived against a comprehensive candidate list
 * (all HTML global/element attributes + every event-handler family + RDFa) after
 * an adversarial pass found a first, narrower probe had missed 21 window/clipboard
 * event handlers (`oncopy`, `onpaste`, `onstorage`, …). `class` and `id` are
 * intentionally absent: they never reach this path because `class=`/`id=` are
 * consumed into the class list / id in `buildDivAttrs`.
 */
const KNOWN_HTML5_ATTRS = new Set<string>([
  "abbr", "about", "accept", "accept-charset", "accesskey", "action", "allow", "allowfullscreen",
  "allowpaymentrequest", "allowusermedia", "alt", "as", "async", "autocapitalize", "autocomplete", "autofocus",
  "autoplay", "charset", "checked", "cite", "color", "cols", "colspan", "content",
  "contenteditable", "controls", "coords", "crossorigin", "data", "datatype", "datetime", "decoding",
  "default", "defer", "dir", "dirname", "disabled", "download", "draggable", "enctype",
  "enterkeyhint", "for", "form", "formaction", "formenctype", "formmethod", "formnovalidate", "formtarget",
  "headers", "height", "hidden", "high", "href", "hreflang", "http-equiv", "imagesizes",
  "imagesrcset", "inputmode", "integrity", "is", "ismap", "itemid", "itemprop", "itemref",
  "itemscope", "itemtype", "kind", "lang", "list", "loading", "loop", "low",
  "manifest", "max", "maxlength", "media", "method", "min", "minlength", "multiple",
  "muted", "name", "nomodule", "nonce", "novalidate", "onabort", "onafterprint", "onauxclick",
  "onbeforeprint", "onbeforeunload", "onblur", "oncancel", "oncanplay", "oncanplaythrough", "onchange", "onclick",
  "onclose", "oncontextmenu", "oncopy", "oncuechange", "oncut", "ondblclick", "ondrag", "ondragend",
  "ondragenter", "ondragexit", "ondragleave", "ondragover", "ondragstart", "ondrop", "ondurationchange", "onemptied",
  "onended", "onerror", "onfocus", "onhashchange", "oninput", "oninvalid", "onkeydown", "onkeypress",
  "onkeyup", "onlanguagechange", "onload", "onloadeddata", "onloadedmetadata", "onloadend", "onloadstart", "onmessage",
  "onmessageerror", "onmousedown", "onmouseenter", "onmouseleave", "onmousemove", "onmouseout", "onmouseover", "onmouseup",
  "onoffline", "ononline", "onpagehide", "onpageshow", "onpaste", "onpause", "onplay", "onplaying",
  "onpopstate", "onprogress", "onratechange", "onrejectionhandled", "onreset", "onresize", "onscroll", "onsecuritypolicyviolation",
  "onseeked", "onseeking", "onselect", "onstalled", "onstorage", "onsubmit", "onsuspend", "ontimeupdate",
  "ontoggle", "onunhandledrejection", "onunload", "onvolumechange", "onwaiting", "onwheel", "open", "optimum",
  "pattern", "ping", "placeholder", "playsinline", "poster", "prefix", "preload", "property",
  "readonly", "referrerpolicy", "rel", "required", "resource", "rev", "reversed", "role",
  "rows", "rowspan", "sandbox", "scope", "selected", "shape", "size", "sizes",
  "slot", "span", "spellcheck", "src", "srcdoc", "srclang", "srcset", "start",
  "step", "style", "tabindex", "target", "title", "translate", "type", "typemustmatch",
  "typeof", "usemap", "value", "vocab", "width", "wrap",
]);

/**
 * Pandoc's HTML5 attribute-name rule: a known HTML5/RDFa name — or one already
 * carrying a `data-`/`aria-` prefix or a namespace `:` (`xml:lang`) — is emitted
 * as written; every other name is prefixed with `data-` (`key` → `data-key`,
 * `Foo` → `data-Foo`; the check is case-sensitive, matching pandoc).
 */
function htmlAttrName(key: string): string {
  if (
    key.startsWith("data-") ||
    key.startsWith("aria-") ||
    key.includes(":") ||
    KNOWN_HTML5_ATTRS.has(key)
  ) {
    return key;
  }
  return "data-" + key;
}

/** A single token inside a `{…}` attribute block. */
type DivToken =
  | { kind: "id"; value: string }
  | { kind: "class"; value: string }
  | { kind: "kv"; key: string; value: string };

/** `#id` / `.class` name chars — word chars plus interior dots and hyphens. */
const NAME_CHAR = /[\w.-]/;
/** A `key` in `key=value` starts with a letter (pandoc rejects a leading digit
 * or underscore)… */
const KEY_START = /[A-Za-z]/;
/** …then continues with word chars, dots, colons, and hyphens (`data-x`, `xml:lang`). */
const KEY_CHAR = /[\w.:-]/;

/**
 * Tokenise the inside of a Pandoc `{…}` attribute block into ordered `#id`,
 * `.class`, and `key=value` tokens, or `null` if the block is not well-formed.
 *
 * Reimplements Pandoc's attribute grammar (not copied): whitespace-separated
 * tokens; a value may be bare (`key=val`), double- or single-quoted (`key="a b"`,
 * `key='v'`) with the quotes allowing interior spaces. A stray bare word with no
 * `#`/`.`/`=` (`{.box checked}`), a `#`/`.` with no name, a key starting with a
 * digit (`{1abc=v}`), or an unterminated quote makes the whole block invalid →
 * `null`, so the caller leaves it unrendered (pandoc instead reinterprets a few
 * of these as a literal-brace class; matching that degenerate reinterpretation is
 * out of scope — an unrenderable div is the safe outcome).
 */
function tokenizeDivAttrs(
  inner: string,
  decode: (raw: string) => string,
): DivToken[] | null {
  const tokens: DivToken[] = [];
  let i = 0;
  const n = inner.length;
  while (i < n) {
    while (i < n && /\s/.test(inner[i])) i++;
    if (i >= n) break;
    const c = inner[i];
    if (c === "#" || c === ".") {
      i++;
      const start = i;
      while (i < n && NAME_CHAR.test(inner[i])) i++;
      if (i === start) return null; // `#`/`.` with no name
      const value = inner.slice(start, i);
      tokens.push(c === "#" ? { kind: "id", value } : { kind: "class", value });
      continue;
    }
    if (!KEY_START.test(c)) return null; // bare word / bad key start → invalid block
    const keyStart = i;
    i++;
    while (i < n && KEY_CHAR.test(inner[i])) i++;
    const key = inner.slice(keyStart, i);
    if (i >= n || inner[i] !== "=") return null; // bare word (no `=`) → invalid block
    i++; // consume `=`
    let value: string;
    const quote = inner[i];
    if (quote === '"' || quote === "'") {
      i++;
      const valueStart = i;
      // Advance to the closing quote, stepping over an escaped char so a `\"`
      // (or `\'`) is not mistaken for the closer; the raw slice is decoded below.
      while (i < n && inner[i] !== quote) {
        i += inner[i] === "\\" && i + 1 < n ? 2 : 1;
      }
      if (i >= n) return null; // unterminated quote → invalid block
      value = decode(inner.slice(valueStart, i));
      i++; // consume closing quote
    } else {
      const valueStart = i;
      while (i < n && !/\s/.test(inner[i]) && inner[i] !== "}") i++;
      value = decode(inner.slice(valueStart, i)); // may be empty: `key=` → `key=""`
    }
    // `decode` applies pandoc's litChar rule: unescape `\` before ASCII
    // punctuation and resolve HTML character references (`&amp;` → `&`, `&#65;`
    // → `A`). markdown-it's renderAttrs then re-escapes for output, so a single
    // `&amp;` round-trips instead of double-encoding to `&amp;amp;`.
    tokens.push({ kind: "kv", key, value });
  }
  return tokens;
}

/**
 * The id, class(es), and other attributes named by a Pandoc attribute block, or
 * `null` when `params` is not a valid div-attribute spec.
 *
 * Handles both forms `quarto render` accepts: a bare-word shorthand `::: foo`
 * (≡ `::: {.foo}`, a single non-brace whitespace-free word → one class), and a
 * `{…}` attribute block carrying any mix of `#id`, `.class`, and `key=value`
 * attributes. `key=value` attributes are EMITTED (see `htmlAttrName` for the
 * `data-` prefix rule), replacing the earlier strip-and-ignore. Matching
 * Pandoc/Quarto: several ids resolve to the last; id/class names may contain
 * interior dots/hyphens; attribute order is id, then all classes, then the other
 * attributes in source order.
 */
function parseDivAttrs(
  params: string,
  decode: (raw: string) => string,
): { id: string | null; classes: string[]; attrs: [string, string][] } | null {
  const trimmed = params.trim();
  // A `{…}` attribute block. The gate is start-`{`/end-`}` (not `^\{[^}]*\}$`) so
  // that a `}` inside a quoted value is allowed; the tokenizer validates the rest.
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const tokens = tokenizeDivAttrs(trimmed.slice(1, -1), decode);
    return tokens === null ? null : buildDivAttrs(tokens);
  }
  // Bare-word shorthand: `::: foo` ≡ `::: {.foo}` → a single non-brace,
  // whitespace-free word becomes a class (grounded vs quarto render). A block
  // with whitespace (`::: foo bar`) or one that STARTS with `{` but is not a
  // well-formed block (`::: {.a}x`, an unclosed `{`) is not a valid div — it must
  // NOT become a class literally named `{.a}x`.
  if (trimmed !== "" && !trimmed.startsWith("{") && !/\s/.test(trimmed)) {
    return { id: null, classes: [trimmed], attrs: [] };
  }
  return null;
}

/**
 * The raw value of a callout's `collapse` attribute — its SOURCE key, before
 * Pandoc's `data-` normalisation — or `undefined` if the block has no `collapse=`.
 *
 * Keyed on the source name `collapse`, NOT the normalised `data-collapse` that
 * `htmlAttrName` produces, so a literal `data-collapse=` an author might copy from
 * quarto's own emitted HTML stays an inert passthrough attribute rather than being
 * mistaken for the collapse control — matching quarto render, which treats
 * `data-collapse` as a plain attribute on a non-collapsible callout. (Both
 * `collapse=` and a literal `data-collapse=` normalise to the same
 * `data-collapse` attribute name, so keying on the normalised name cannot tell
 * them apart.) The last `collapse=` wins, matching Pandoc's repeated-key rule.
 */
function calloutCollapse(
  params: string,
  decode: (raw: string) => string,
): string | undefined {
  const trimmed = params.trim();
  if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) return undefined;
  const tokens = tokenizeDivAttrs(trimmed.slice(1, -1), decode);
  if (tokens === null) return undefined;
  let value: string | undefined;
  for (const token of tokens) {
    if (token.kind === "kv" && token.key === "collapse") value = token.value;
  }
  return value;
}

/**
 * Fold ordered `{…}` tokens into `{ id, classes, attrs }`, applying Pandoc's
 * attribute-list semantics: `class=`/`id=` merge into the class list / id, the
 * last id (by any form) wins, duplicate classes collapse, a duplicate attribute
 * name keeps the first, and `key=value` names get the `data-` rule of
 * `htmlAttrName`. Attribute order is id, then all classes, then the rest in
 * source order (applied by the caller when it emits the token attributes).
 */
function buildDivAttrs(
  tokens: DivToken[],
): { id: string | null; classes: string[]; attrs: [string, string][] } {
  let id: string | null = null;
  const classes: string[] = [];
  const classSeen = new Set<string>();
  const attrs: [string, string][] = [];
  const attrSeen = new Set<string>();
  const addClass = (cls: string): void => {
    if (cls !== "" && !classSeen.has(cls)) {
      classSeen.add(cls); // duplicate classes collapse, matching Pandoc
      classes.push(cls);
    }
  };
  for (const token of tokens) {
    if (token.kind === "id") {
      id = token.value; // several ids → the last wins, matching Pandoc/Quarto
    } else if (token.kind === "class") {
      addClass(token.value);
    } else if (token.key === "class") {
      // `class="a b"` merges into the class list, whitespace-split, like Pandoc.
      for (const cls of token.value.split(/\s+/)) addClass(cls);
    } else if (token.key === "id") {
      id = token.value; // `id=` sets the id; the last id (by any form) wins
    } else {
      const name = htmlAttrName(token.key);
      if (!attrSeen.has(name)) {
        attrSeen.add(name); // a duplicate attribute name keeps the FIRST, like Pandoc
        attrs.push([name, token.value]);
      }
    }
  }
  return { id, classes, attrs };
}

/**
 * Whether a fence line's params open a nested div by this plugin's own rules — a
 * known callout class, or a generic div carrying an id, class, or attribute. The
 * closing-fence scan uses this to track nesting depth so a nested div's closer is
 * not mistaken for the outer div's, matching how pandoc pairs fences. A fence-like
 * line that is neither a valid opener nor a bare closer (e.g. `::: foo bar`, an
 * unclosed `::: {bad`) opens nothing and is ordinary body content.
 */
function isDivOpener(params: string, decode: (raw: string) => string): boolean {
  if (calloutType(params) !== undefined) return true;
  const attrs = parseDivAttrs(params, decode);
  return (
    attrs !== null &&
    (attrs.id !== null || attrs.classes.length > 0 || attrs.attrs.length > 0)
  );
}

/**
 * markdown-it block rule: a container for a Pandoc fenced div `::: {…}` … `:::`.
 * Modelled on the standard markdown-it fenced-container algorithm (reimplemented,
 * not copied): count the opening `:` run, classify the params as a known callout
 * or a generic id/class-bearing div (else bail), scan for a closing fence of at
 * least the same length with only trailing spaces, then tokenise the interior as
 * block markdown between open/close tokens. A callout carries its type on the
 * open token's `info`; a generic div carries its id/class as token attributes.
 */
function calloutRule(
  state: MarkdownIt.StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];

  if (state.src.charCodeAt(pos) !== MARKER) return false;

  const markerStart = pos;
  pos = state.skipChars(pos, MARKER);
  const markerCount = pos - markerStart;
  if (markerCount < MIN_MARKERS) return false;

  const markup = state.src.slice(markerStart, pos);
  const params = state.src.slice(pos, max);
  const type = calloutType(params);
  // A non-callout Pandoc fenced div (`::: {.className}`) renders as a plain
  // `<div>` carrying its class(es); known callout classes take the admonition
  // path (`type !== undefined`) instead. A div with neither a known callout
  // class nor any generic class falls through unrendered.
  // Decode attribute values with the host markdown-it's `unescapeAll` (backslash
  // escapes + HTML character references), reproducing pandoc's litChar rule. The
  // same decoder classifies nested openers in the closing-fence scan below.
  const decode = (raw: string): string => state.md.utils.unescapeAll(raw);
  const attrs = parseDivAttrs(params, decode);
  const divAttrs = type === undefined ? attrs : null;
  if (
    type === undefined &&
    (divAttrs === null ||
      (divAttrs.id === null &&
        divAttrs.classes.length === 0 &&
        divAttrs.attrs.length === 0))
  ) {
    return false;
  }

  // For a callout, a non-empty `title=` attribute overrides the default type
  // title (an empty `title=""` falls back to the default, matching Quarto). A
  // `## Heading` first line is the other title source, handled after the body is
  // tokenised (below), and only when there is no `title=` — the attribute wins.
  let calloutTitle: string | undefined;
  if (type !== undefined && attrs) {
    const titleAttr = attrs.attrs.find(([name]) => name === "title");
    if (titleAttr && titleAttr[1] !== "") calloutTitle = titleAttr[1];
  }

  // A `collapse` attribute makes a callout collapsible, rendered as a `<details>`
  // (this renderer is JS-free, unlike quarto's Bootstrap collapse markup).
  // Grounded vs quarto render 1.7.33: ANY collapse value is collapsible, and it
  // starts collapsed only when the value is exactly `true` (case-sensitive —
  // `TRUE`/`True`/`false`/`maybe`/`` all start expanded), else expanded (`open`).
  // The control is keyed on the SOURCE attribute name `collapse` (see
  // `calloutCollapse`), not the normalised `data-collapse`, so a literal
  // `data-collapse=` stays an inert passthrough. As a callout control attribute it
  // is consumed here and never emitted onto the div.
  let collapse: "closed" | "open" | undefined;
  if (type !== undefined) {
    const collapseValue = calloutCollapse(params, decode);
    if (collapseValue !== undefined) {
      collapse = collapseValue === "true" ? "closed" : "open";
    }
  }

  // Validation-only phase (e.g. paragraph-termination lookahead): a real callout
  // opens here, so report a match without emitting tokens.
  if (silent) return true;

  // Locate THIS div's own closing fence (or auto-close at the end of the block),
  // tracking nesting depth so a nested div's closer is not mistaken for ours —
  // the fix for same-length nested divs (`::: {.outer}` … `::: {.inner}` …).
  // A fence line (a run of at least MIN_MARKERS colons at the line start, not
  // indented code) is a CLOSER when only whitespace follows the colons, else a
  // nested OPENER when its params open a div (`isDivOpener`); any other
  // fence-like line is ordinary body content. The closer's colon count is
  // independent of the opener's, matching pandoc (a `::::` div closes on `:::`).
  //
  // A `:::`-looking line INSIDE a fenced code block (``` / ~~~) is literal code,
  // not a div fence, so the scan tracks code-fence state and skips those lines —
  // mirroring how the recursive tokenizer parses them (without this, a `::: {.x}`
  // shown as example code would be counted as a nested opener and swallow the
  // div's real closer).
  let nextLine = startLine;
  let depth = 0;
  let codeFence: { char: number; len: number } | null = null;
  let autoClosed = false;
  for (;;) {
    nextLine++;
    if (nextLine >= endLine) break; // unterminated → auto-close at block end

    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineMax = state.eMarks[nextLine];

    if (lineStart < lineMax && state.sCount[nextLine] < state.blkIndent) {
      // A less-indented non-blank line terminates the container.
      break;
    }

    const firstChar = state.src.charCodeAt(lineStart);
    const indented = state.sCount[nextLine] - state.blkIndent >= 4;
    if (codeFence !== null) {
      // Inside a fenced code block: only its own closing fence (same marker char,
      // at least as long, trailing spaces only, not indented as code) ends it;
      // every other line — `:::` included — is literal code.
      if (firstChar === codeFence.char && !indented) {
        const runEnd = state.skipChars(lineStart, codeFence.char);
        if (
          runEnd - lineStart >= codeFence.len &&
          state.skipSpaces(runEnd) >= lineMax
        ) {
          codeFence = null;
        }
      }
      continue;
    }
    if ((firstChar === BACKTICK || firstChar === TILDE) && !indented) {
      // A code-fence opener: at least 3 of ` or ~; a backtick opener's info
      // string may not contain a backtick (markdown-it's fence rule).
      const runEnd = state.skipChars(lineStart, firstChar);
      if (
        runEnd - lineStart >= 3 &&
        !(firstChar === BACKTICK && state.src.slice(runEnd, lineMax).includes("`"))
      ) {
        codeFence = { char: firstChar, len: runEnd - lineStart };
        continue;
      }
    }

    if (firstChar !== MARKER) continue;
    if (indented) continue; // indented code

    const fenceEnd = state.skipChars(lineStart, MARKER);
    if (fenceEnd - lineStart < MIN_MARKERS) continue; // fewer than 3 colons → not a fence

    if (state.skipSpaces(fenceEnd) >= lineMax) {
      // Only whitespace after the colons → a closing fence.
      if (depth > 0) {
        depth--; // closes a nested div, not this one
        continue;
      }
      autoClosed = true;
      break;
    }

    // Colons followed by content: a nested div opener increases depth; any other
    // fence-like line (`::: foo bar`) opens nothing and is body content.
    if (isDivOpener(state.src.slice(fenceEnd, lineMax), decode)) depth++;
  }

  // Pin the container's extent so inner block tokenisation cannot run past the
  // closing fence (the load-bearing guarantee — restored below).
  const oldLineMax = state.lineMax;
  state.lineMax = nextLine;

  const tokenOpen = state.push(
    type !== undefined ? "callout_open" : "div_open",
    "div",
    1,
  );
  tokenOpen.markup = markup;
  tokenOpen.block = true;
  tokenOpen.map = [startLine, nextLine];
  if (type !== undefined) {
    tokenOpen.info = type;
    if (calloutTitle !== undefined) tokenOpen.meta = { title: calloutTitle };
  } else if (divAttrs) {
    // Pandoc/Quarto attribute order: id, then all classes, then the other
    // attributes in source order.
    if (divAttrs.id !== null) tokenOpen.attrSet("id", divAttrs.id);
    if (divAttrs.classes.length > 0) {
      tokenOpen.attrSet("class", divAttrs.classes.join(" "));
    }
    for (const [name, value] of divAttrs.attrs) {
      tokenOpen.attrPush([name, value]);
    }
  }

  const bodyStart = state.tokens.length;
  state.md.block.tokenize(state, startLine + 1, nextLine);

  // A callout with no `title=` takes its title from a leading heading (any level,
  // ATX or setext), which is then removed from the body — matching quarto render.
  // markdown-it tokenised the heading as heading_open + inline + heading_close; the
  // inline token's raw content is the title source. A leading paragraph (or any
  // non-heading first block) leaves the default title and the body untouched.
  if (type !== undefined && calloutTitle === undefined) {
    const headingOpen = state.tokens[bodyStart];
    if (headingOpen !== undefined && headingOpen.type === "heading_open") {
      // An empty heading (`##`) is still removed from the body but falls back to
      // the default type title, matching quarto and the empty `title=""` guard.
      const headingTitle = state.tokens[bodyStart + 1].content;
      if (headingTitle !== "") tokenOpen.meta = { title: headingTitle };
      state.tokens.splice(bodyStart, 3); // heading_open + inline + heading_close
    }
  }

  // Carry the collapse state on both tokens (merging with any title meta) so the
  // open renderer emits `<details>`/`<summary>` and the close renderer matches it
  // with `</details>` instead of `</div>`.
  if (collapse !== undefined) {
    (tokenOpen.meta ??= {}).collapse = collapse;
  }

  const tokenClose = state.push(
    type !== undefined ? "callout_close" : "div_close",
    "div",
    -1,
  );
  tokenClose.markup = markup;
  tokenClose.block = true;
  if (collapse !== undefined) {
    (tokenClose.meta ??= {}).collapse = collapse;
  }

  state.lineMax = oldLineMax;
  state.line = nextLine + (autoClosed ? 1 : 0);

  return true;
}

/**
 * Renderer rule for a `callout_open` token: emit the callout header. When the
 * block rule found a custom title (`token.meta.title` — a `title=` attribute or an
 * extracted leading heading), it is used instead of the default type title. The
 * custom title is rendered as inline markdown (`**b**` → `<strong>b</strong>`),
 * matching quarto render; `renderInline` also HTML-escapes `&`/`<`/`>`.
 */
function renderCalloutOpen(
  md: MarkdownIt,
  tokens: MarkdownIt.Token[],
  idx: number,
  env: unknown,
): string {
  const token = tokens[idx];
  const type = token.info;
  const customTitle = token.meta?.title as string | undefined;
  const title =
    customTitle !== undefined
      ? md.renderInline(customTitle, env)
      : (CALLOUT_TITLES[type] ?? type);
  // A collapsible callout (a `collapse` attribute) renders as a `<details>` whose
  // `<summary>` is the clickable header; a plain callout stays a `<div>`.
  const collapse = token.meta?.collapse as "closed" | "open" | undefined;
  if (collapse !== undefined) {
    const openAttr = collapse === "open" ? " open" : "";
    return (
      `<details class="callout callout-${type}"${openAttr}>\n` +
      `<summary class="callout-header"><div class="callout-title">${title}</div></summary>\n` +
      '<div class="callout-body">\n'
    );
  }
  return (
    `<div class="callout callout-${type}">\n` +
    `<div class="callout-header"><div class="callout-title">${title}</div></div>\n` +
    '<div class="callout-body">\n'
  );
}

function renderCalloutClose(tokens: MarkdownIt.Token[], idx: number): string {
  const collapse = tokens[idx].meta?.collapse as "closed" | "open" | undefined;
  return collapse !== undefined ? "</div>\n</details>\n" : "</div>\n</div>\n";
}

/**
 * Renderer rule for a `div_open` token: emit the opening `<div>` with its id and
 * class attributes. `renderAttrs` HTML-escapes attribute names and values.
 */
function renderDivOpen(
  tokens: MarkdownIt.Token[],
  idx: number,
  _options: MarkdownIt.Options,
  _env: unknown,
  self: MarkdownIt.Renderer,
): string {
  return `<div${self.renderAttrs(tokens[idx])}>\n`;
}

function renderDivClose(): string {
  return "</div>\n";
}

/**
 * The CSS the notebook renderer webview injects (as a `<style>`, via
 * `src/webview/notebook-renderer.ts`) so the structural callout markup renders as
 * a coloured admonition box. It targets OUR class structure — `.callout`
 * (`<div>` or `<details>`) → `.callout-header` (`<div>` or `<summary>`) →
 * `.callout-title`, plus `.callout-body` — NOT quarto's Bootstrap DOM, so it is
 * a visual/semantic equivalent (the same posture the `<details>` collapse slice
 * took), not a byte match. Only the base, type-independent box rules are here;
 * per-type accents/tints/icons are appended by `calloutStyles`.
 */
/**
 * Per-type accent colour, grounded FIRSTHAND against `quarto render` 1.7.33's
 * bootstrap theme (`div.callout-<type>.callout` `border-left-color`): note the
 * bootstrap primary blue, tip success green, warning amber, caution orange,
 * important danger red. The header tint is derived from this accent as a
 * low-alpha rgba (theme-adaptive), and the same accent keys the icon (added
 * alongside in `CALLOUT_STYLE`).
 */
const CALLOUT_ACCENT: Record<string, string> = {
  note: "#0d6efd",
  tip: "#198754",
  warning: "#ffc107",
  caution: "#fd7e14",
  important: "#dc3545",
};

/**
 * Per-type callout icon, grounded FIRSTHAND from `quarto render` 1.7.33's
 * `div.callout-<type>.callout-titled .callout-icon::before` background image.
 * These are Bootstrap Icons (MIT, see NOTICE) with quarto's own per-type fill;
 * they use `rgb()` fills (no `#`) so they embed in a single-quoted `url()` with
 * no URL-encoding — the exact form quarto ships and that Chromium (the notebook
 * webview engine) renders. note=info-circle, tip=lightbulb,
 * warning=exclamation-triangle, caution=cone-striped, important=exclamation-circle.
 */
const CALLOUT_ICON: Record<string, string> = {
  note: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="fill: rgb(11.7, 99, 227.7)" class="bi bi-info-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>`,
  tip: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="fill: rgb(22.5, 121.5, 75.6)" class="bi bi-lightbulb" viewBox="0 0 16 16"><path d="M2 6a6 6 0 1 1 10.174 4.31c-.203.196-.359.4-.453.619l-.762 1.769A.5.5 0 0 1 10.5 13a.5.5 0 0 1 0 1 .5.5 0 0 1 0 1l-.224.447a1 1 0 0 1-.894.553H6.618a1 1 0 0 1-.894-.553L5.5 15a.5.5 0 0 1 0-1 .5.5 0 0 1 0-1 .5.5 0 0 1-.46-.302l-.761-1.77a1.964 1.964 0 0 0-.453-.618A5.984 5.984 0 0 1 2 6zm6-5a5 5 0 0 0-3.479 8.592c.263.254.514.564.676.941L5.83 12h4.342l.632-1.467c.162-.377.413-.687.676-.941A5 5 0 0 0 8 1z"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="fill: rgb(229.5, 173.7, 6.3)" class="bi bi-exclamation-triangle" viewBox="0 0 16 16"><path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z"/><path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z"/></svg>`,
  caution: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="fill: rgb(227.7, 113.4, 18)" class="bi bi-cone-striped" viewBox="0 0 16 16"><path d="M9.97 4.88l.953 3.811C10.158 8.878 9.14 9 8 9c-1.14 0-2.159-.122-2.923-.309L6.03 4.88C6.635 4.957 7.3 5 8 5s1.365-.043 1.97-.12zm-.245-.978L8.97.88C8.718-.13 7.282-.13 7.03.88L6.274 3.9C6.8 3.965 7.382 4 8 4c.618 0 1.2-.036 1.725-.098zm4.396 8.613a.5.5 0 0 1 .037.96l-6 2a.5.5 0 0 1-.316 0l-6-2a.5.5 0 0 1 .037-.96l2.391-.598.565-2.257c.862.212 1.964.339 3.165.339s2.303-.127 3.165-.339l.565 2.257 2.391.598z"/></svg>`,
  important: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" style="fill: rgb(198, 47.7, 62.1)" class="bi bi-exclamation-circle" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/></svg>`,
};

/** Parse a `#rrggbb` hex colour into its `r, g, b` decimal components. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** The per-type accent + header-tint CSS rules for one known callout type. */
function calloutTypeStyles(type: string): string {
  const accent = CALLOUT_ACCENT[type];
  const { r, g, b } = hexToRgb(accent);
  return [
    `.callout-${type} {`,
    `  border-left-color: ${accent};`,
    "}",
    `.callout-${type} > .callout-header {`,
    `  background-color: rgba(${r}, ${g}, ${b}, 0.1);`,
    "}",
    `.callout-${type} .callout-title::before {`,
    `  background-image: url('data:image/svg+xml,${CALLOUT_ICON[type]}');`,
    "}",
  ].join("\n");
}

const CALLOUT_BASE_STYLES = [
  ".callout {",
  "  border: 1px solid rgba(128, 128, 128, 0.35);",
  "  border-left-width: 4px;",
  "  border-radius: 4px;",
  "  margin: 1em 0;",
  "  overflow: hidden;",
  "}",
  ".callout-header {",
  "  padding: 0.4em 0.75em;",
  "  font-weight: 600;",
  "}",
  // The collapsible form emits `<summary class="callout-header">`; keep the native
  // disclosure marker (the JS-free, honest collapse affordance) but signal clicks.
  "summary.callout-header {",
  "  cursor: pointer;",
  "}",
  ".callout-title::before {",
  '  content: "";',
  "  display: inline-block;",
  "  width: 1em;",
  "  height: 1em;",
  "  margin-right: 0.4em;",
  "  vertical-align: -0.15em;",
  "  background-repeat: no-repeat;",
  "  background-position: center;",
  "  background-size: contain;",
  "}",
  ".callout-body {",
  "  padding: 0.5em 0.75em;",
  "}",
].join("\n");

/**
 * Assemble the callout box stylesheet: the base box rules followed by the
 * per-type accent, header tint, and icon. Pure (no DOM); the webview entrypoint
 * injects the result. The rendered box is eyeball-only (no webview DOM
 * read-back); this generator is what the unit suite verifies.
 */
export function calloutStyles(): string {
  // Iterate the render-side type set (`CALLOUT_TITLES`) so styles cover exactly
  // the types that render as admonitions — no more, no less.
  const perType = Object.keys(CALLOUT_TITLES).map(calloutTypeStyles);
  return [CALLOUT_BASE_STYLES, ...perType].join("\n");
}

/** markdown-it plugin entry point: `md.use(calloutPlugin)`. */
export function calloutPlugin(md: MarkdownIt): void {
  md.block.ruler.before("fence", "callout", calloutRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.callout_open = (tokens, idx, _options, env) =>
    renderCalloutOpen(md, tokens, idx, env);
  md.renderer.rules.callout_close = renderCalloutClose;
  md.renderer.rules.div_open = renderDivOpen;
  md.renderer.rules.div_close = renderDivClose;
}
