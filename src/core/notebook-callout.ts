import type MarkdownIt from "markdown-it";

/**
 * Pure, `vscode`-free markdown-it plugin (BACKLOG item 17d, first slice) that
 * renders a Quarto `::: {.callout-note}` fenced div as a note-admonition block.
 *
 * A Quarto callout is a Pandoc fenced div (`:::` + an attribute block carrying
 * the class `.callout-note`) whose body is ordinary markdown. This plugin adds a
 * markdown-it block rule that recognises such a div, tokenises its body as
 * markdown, and wraps it in the callout markup Quarto's HTML output uses. The
 * webview entrypoint (`src/webview/notebook-renderer.ts`) installs it into VS
 * Code's built-in `vscode.markdown-it-renderer` so notebook markdown cells show
 * the callout instead of raw `:::` text.
 *
 * This first slice handles ONLY `callout-note` — other callout types
 * (tip/warning/caution/important) and generic fenced divs fall through unchanged.
 */

const MARKER = 0x3a; // ":"
const MIN_MARKERS = 3;

/**
 * Matches the attribute block of a note callout: a `{…}` block whose class list
 * includes `.callout-note` exactly (not a prefix of e.g. `.callout-note-2`). The
 * block may also carry an id or further classes: `{.callout-note}`,
 * `{.callout-note #warn}`, `{.foo .callout-note}` all match; `{.callout-tip}`
 * and `{.callout}` do not.
 */
const CALLOUT_NOTE_PARAMS = /^\{[^}]*\.callout-note(?![\w-])[^}]*\}$/;

function isCalloutNoteParams(params: string): boolean {
  return CALLOUT_NOTE_PARAMS.test(params.trim());
}

/**
 * markdown-it block rule: a container for `::: {.callout-note}` … `:::`. Modelled
 * on the standard markdown-it fenced-container algorithm (reimplemented, not
 * copied): count the opening `:` run, validate the params as a note callout,
 * scan for a closing fence of at least the same length with only trailing spaces,
 * then tokenise the interior as block markdown between open/close tokens.
 */
function calloutNoteRule(
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
  if (!isCalloutNoteParams(params)) return false;

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

  const tokenOpen = state.push("callout_note_open", "div", 1);
  tokenOpen.markup = markup;
  tokenOpen.block = true;
  tokenOpen.map = [startLine, nextLine];

  state.md.block.tokenize(state, startLine + 1, nextLine);

  const tokenClose = state.push("callout_note_close", "div", -1);
  tokenClose.markup = markup;
  tokenClose.block = true;

  state.lineMax = oldLineMax;
  state.line = nextLine + (autoClosed ? 1 : 0);

  return true;
}

function renderCalloutNoteOpen(): string {
  return (
    '<div class="callout callout-note">\n' +
    '<div class="callout-header"><div class="callout-title">Note</div></div>\n' +
    '<div class="callout-body">\n'
  );
}

function renderCalloutNoteClose(): string {
  return "</div>\n</div>\n";
}

/** markdown-it plugin entry point: `md.use(calloutNotePlugin)`. */
export function calloutNotePlugin(md: MarkdownIt): void {
  md.block.ruler.before("fence", "callout_note", calloutNoteRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
  md.renderer.rules.callout_note_open = renderCalloutNoteOpen;
  md.renderer.rules.callout_note_close = renderCalloutNoteClose;
}
