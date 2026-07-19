import type MarkdownIt from "markdown-it";

/**
 * Pure, `vscode`-free markdown-it plugin (BACKLOG item 17d) that renders Quarto
 * Pandoc fenced divs (`::: {…}` … `:::`) in notebook markdown cells.
 *
 * A Pandoc fenced div is `:::` followed by an attribute block (`{…}`) whose body
 * is ordinary markdown. The single block rule this plugin adds handles two cases:
 *
 *  - **Callout** — a class in `CALLOUT_TITLES` (`.callout-note` / `.callout-tip` /
 *    `.callout-warning` / `.callout-caution` / `.callout-important`) is wrapped in
 *    the admonition markup Quarto's HTML output uses (a titled callout block).
 *  - **Generic div** — any other fenced div carrying an id and/or class(es)
 *    (`::: {.foo}`, `::: {#id .a .b}`, an unknown `.callout-bogus`) renders as a
 *    plain `<div id=… class=…>` around its markdown body, matching what
 *    `quarto render` emits for a non-callout div (only the closed set of known
 *    types becomes an admonition; everything else is just a div).
 *
 * A div with neither a known callout class nor any generic id/class (`::: {}`, a
 * `key=value`-only block) falls through unrendered. `key=value` attributes and
 * bare-word shorthand (`::: foo`) are out of scope (deferred follow-on).
 *
 * The webview entrypoint (`src/webview/notebook-renderer.ts`) installs this into
 * VS Code's built-in `vscode.markdown-it-renderer` so notebook markdown cells
 * show the rendered blocks instead of raw `:::` text.
 */

const MARKER = 0x3a; // ":"
const MIN_MARKERS = 3;

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
 * The id and class(es) named by a Pandoc attribute block, or `undefined` when
 * the block carries neither, or `null` when `params` is not a single `{…}`
 * attribute block at all.
 *
 * Only `#id` and `.class` tokens are read. Each is matched at the block start or
 * after whitespace, so a `.` or `#` inside a `key="value"` value (`x="a.b"`) is
 * not misread as a class/id. `key=value` attributes and bare-word shorthand
 * (`::: foo`) are out of scope (deferred follow-on) and ignored. When several
 * ids are present the first wins.
 */
function parseDivAttrs(params: string): { id: string | null; classes: string[] } | null {
  const trimmed = params.trim();
  if (!ATTR_BLOCK.test(trimmed)) return null;
  const inner = trimmed.slice(1, -1);
  const classes: string[] = [];
  let id: string | null = null;
  const tokenPattern = /(?:^|\s)([.#])([\w-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(inner)) !== null) {
    if (match[1] === ".") classes.push(match[2]);
    else if (id === null) id = match[2];
  }
  return { id, classes };
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
  const divAttrs = type === undefined ? parseDivAttrs(params) : null;
  if (
    type === undefined &&
    (divAttrs === null ||
      (divAttrs.id === null && divAttrs.classes.length === 0))
  ) {
    return false;
  }

  // Validation-only phase (e.g. paragraph-termination lookahead): a real callout
  // opens here, so report a match without emitting tokens.
  if (silent) return true;

  // Locate the closing fence line (or auto-close at the end of the block).
  let nextLine = startLine;
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
    if (state.src.charCodeAt(lineStart) !== MARKER) continue;
    if (state.sCount[nextLine] - state.blkIndent >= 4) continue; // indented code

    let closePos = state.skipChars(lineStart, MARKER);
    if (closePos - lineStart < markerCount) continue; // shorter than the opener
    closePos = state.skipSpaces(closePos);
    if (closePos < lineMax) continue; // trailing content → not a closing fence

    autoClosed = true;
    break;
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
    // id first, then class — matches Pandoc/Quarto's attribute order.
    if (divAttrs.id !== null) tokenOpen.attrSet("id", divAttrs.id);
    if (divAttrs.classes.length > 0) {
      tokenOpen.attrSet("class", divAttrs.classes.join(" "));
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
