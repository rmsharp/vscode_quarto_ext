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
  const divAttrs = type === undefined ? parseDivAttrs(params, decode) : null;
  if (
    type === undefined &&
    (divAttrs === null ||
      (divAttrs.id === null &&
        divAttrs.classes.length === 0 &&
        divAttrs.attrs.length === 0))
  ) {
    return false;
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

  state.md.block.tokenize(state, startLine + 1, nextLine);

  const tokenClose = state.push(
    type !== undefined ? "callout_close" : "div_close",
    "div",
    -1,
  );
  tokenClose.markup = markup;
  tokenClose.block = true;

  state.lineMax = oldLineMax;
  state.line = nextLine + (autoClosed ? 1 : 0);

  return true;
}

/** Renderer rule for a `callout_open` token: emit the callout header for its type. */
function renderCalloutOpen(tokens: MarkdownIt.Token[], idx: number): string {
  const type = tokens[idx].info;
  const title = CALLOUT_TITLES[type] ?? type;
  return (
    `<div class="callout callout-${type}">\n` +
    `<div class="callout-header"><div class="callout-title">${title}</div></div>\n` +
    '<div class="callout-body">\n'
  );
}

function renderCalloutClose(): string {
  return "</div>\n</div>\n";
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

/** markdown-it plugin entry point: `md.use(calloutPlugin)`. */
export function calloutPlugin(md: MarkdownIt): void {
  md.block.ruler.before("fence", "callout", calloutRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.callout_open = renderCalloutOpen;
  md.renderer.rules.callout_close = renderCalloutClose;
  md.renderer.rules.div_open = renderDivOpen;
  md.renderer.rules.div_close = renderDivClose;
}
