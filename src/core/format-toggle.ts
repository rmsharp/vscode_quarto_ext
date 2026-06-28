/**
 * Pure, `vscode`-free logic for the formatting-toggle commands (plan §6 Phase 7
 * authoring aids): wrap/unwrap a selection — or the word at a bare cursor — in a
 * markdown emphasis marker (`**` bold, `*` italic, `` ` `` code).
 *
 * This module lives in `core/` and MUST NOT import `vscode` (architecture plan
 * §3.3 — "the load-bearing guardrail"). It works purely on a text string and
 * character offsets so it is unit-tested headlessly; the `features/formatting`
 * adapter translates between `vscode` positions and these offsets.
 */

export interface ToggleEdit {
  /** Replace the half-open range [start, end) of the original text. */
  start: number;
  end: number;
  /** The replacement string for that range. */
  replacement: string;
  /** Resulting selection, as offsets into the POST-edit text. */
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Compute the edit that toggles `marker` around the given selection.
 *
 * @param text   the full document text
 * @param selStart selection start offset (inclusive)
 * @param selEnd   selection end offset (exclusive); equal to selStart for a bare cursor
 * @param marker the emphasis marker: `**`, `*`, or `` ` ``
 */
export function toggleFormat(
  text: string,
  selStart: number,
  selEnd: number,
  marker: string,
): ToggleEdit {
  const m = marker.length;

  // A bare cursor (empty selection) expands to the word it sits within, so
  // toggling with nothing selected formats the whole word. When the cursor is
  // not adjacent to a word, the selection stays empty and we insert the markers.
  let s = selStart;
  let e = selEnd;
  if (s === e) {
    let ws = s;
    let we = s;
    while (ws > 0 && isWordChar(text[ws - 1])) {
      ws--;
    }
    while (we < text.length && isWordChar(text[we])) {
      we++;
    }
    if (ws < we) {
      s = ws;
      e = we;
    }
  }

  const content = text.slice(s, e);

  // Unwrap: the marker sits immediately OUTSIDE the selection (the usual case
  // when re-toggling text that was just wrapped, leaving the inner text selected).
  // The `!== marker[0]` guards disambiguate `*` (italic) from `**` (bold): a `*`
  // adjacent to another `*` is part of a `**` run, not a lone italic marker, so
  // toggling italic over bold WRAPS (-> bold+italic) instead of corrupting it.
  // The inner-neighbour checks (`text[s]` / `text[e - 1]`) close the same gap on
  // the INWARD side: on an empty selection the two candidate markers are mutually
  // adjacent (e.g. a bare cursor inside a literal `**`), so without this an italic
  // toggle would strip the `**` run — silently deleting the user's characters.
  if (
    text.slice(s - m, s) === marker &&
    text[s - m - 1] !== marker[0] &&
    text[s] !== marker[0] &&
    text.slice(e, e + m) === marker &&
    text[e + m] !== marker[0] &&
    text[e - 1] !== marker[0]
  ) {
    return {
      start: s - m,
      end: e + m,
      replacement: content,
      selectionStart: s - m,
      selectionEnd: s - m + content.length,
    };
  }

  // Unwrap: the selection itself INCLUDES the markers on both ends. The
  // `!== marker[0]` guards apply the same `*`-vs-`**` disambiguation as above:
  // a selected `**bar**` is bold, not italic-wrapped, so italic toggling wraps it.
  if (
    content.length >= 2 * m &&
    content.startsWith(marker) &&
    content[m] !== marker[0] &&
    content.endsWith(marker) &&
    content[content.length - m - 1] !== marker[0]
  ) {
    const inner = content.slice(m, content.length - m);
    return {
      start: s,
      end: e,
      replacement: inner,
      selectionStart: s,
      selectionEnd: s + inner.length,
    };
  }

  // Wrap: surround the selection and re-select the inner content. When the
  // selection is empty (cursor not in a word), this inserts the bare markers and
  // collapses the cursor between them.
  return {
    start: s,
    end: e,
    replacement: marker + content + marker,
    selectionStart: s + m,
    selectionEnd: s + m + content.length,
  };
}

/**
 * Word characters for cursor-to-word expansion: any Unicode letter or number,
 * plus underscore. Unicode-aware (`\p{L}`/`\p{N}`) so accented and non-Latin
 * prose words (`café`, `naïve`, …) expand whole rather than splitting at the
 * first non-ASCII letter, matching the editor's own word notion.
 */
function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}_]/u.test(ch);
}
