import type MarkdownIt from "markdown-it";

/**
 * Pure, `vscode`-free markdown-it plugin (BACKLOG item 17d) that renders Quarto
 * callout fenced divs (`::: {.callout-<type>}` … `:::`) as admonition blocks.
 *
 * A Quarto callout is a Pandoc fenced div (`:::` + an attribute block carrying a
 * class such as `.callout-note` / `.callout-tip` / `.callout-warning` /
 * `.callout-caution` / `.callout-important`) whose body is ordinary markdown.
 * This plugin adds a markdown-it block rule that recognises such a div, tokenises
 * its body as markdown, and wraps it in the callout markup Quarto's HTML output
 * uses. The webview entrypoint (`src/webview/notebook-renderer.ts`) installs it
 * into VS Code's built-in `vscode.markdown-it-renderer` so notebook markdown
 * cells show the callout instead of raw `:::` text.
 *
 * Only the callout types in `CALLOUT_TITLES` are recognised; a fenced div with
 * any other class (a generic `::: {.foo}`, an unknown `.callout-bogus`, or a
 * near-miss like `.callout-notes`) falls through unrendered.
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
};

/**
 * Matches a callout attribute block: a `{…}` block whose class list includes a
 * `.callout-<type>` class, capturing `<type>` in group 1. The `(?![\w-])` guard
 * pins the class to a whole word, so `.callout-note` matches but `.callout-notes`
 * and `.callout-note-2` do not. The block may also carry an id or further
 * classes: `{.callout-note}`, `{.callout-note #warn}`, `{.foo .callout-note}`
 * all match. Membership in `CALLOUT_TITLES` is validated separately, so a
 * captured but unknown type (e.g. `.callout-bogus`) is still rejected.
 */
const CALLOUT_PARAMS = /^\{[^}]*\.callout-([a-z]+)(?![\w-])[^}]*\}$/;

/**
 * The callout type named by an attribute block, or `undefined` if the block is
 * not a known callout.
 */
function calloutType(params: string): string | undefined {
  const match = CALLOUT_PARAMS.exec(params.trim());
  if (!match) return undefined;
  const type = match[1];
  return type in CALLOUT_TITLES ? type : undefined;
}

/**
 * markdown-it block rule: a container for `::: {.callout-<type>}` … `:::`.
 * Modelled on the standard markdown-it fenced-container algorithm (reimplemented,
 * not copied): count the opening `:` run, validate the params as a known callout,
 * scan for a closing fence of at least the same length with only trailing spaces,
 * then tokenise the interior as block markdown between open/close tokens. The
 * matched type is carried on the open token's `info` for the renderer.
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
  if (type === undefined) return false;

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

  const tokenOpen = state.push("callout_open", "div", 1);
  tokenOpen.markup = markup;
  tokenOpen.info = type;
  tokenOpen.block = true;
  tokenOpen.map = [startLine, nextLine];

  state.md.block.tokenize(state, startLine + 1, nextLine);

  const tokenClose = state.push("callout_close", "div", -1);
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

/** markdown-it plugin entry point: `md.use(calloutPlugin)`. */
export function calloutPlugin(md: MarkdownIt): void {
  md.block.ruler.before("fence", "callout", calloutRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.callout_open = renderCalloutOpen;
  md.renderer.rules.callout_close = renderCalloutClose;
}
