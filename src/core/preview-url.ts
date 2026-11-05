/**
 * Pure, `vscode`-free parser for the `quarto preview` "Browse at" line.
 *
 * Like `core/render-args`, this module lives in `core/` and MUST NOT import
 * `vscode` (architecture plan §3.3 — "the load-bearing guardrail"). Phase 4's
 * dragon note (§6) is explicit: "the parser is a pure `core/` function … pin a
 * fixture of that output for the unit test".
 */

/**
 * Extract the local preview URL from accumulated `quarto preview` stderr.
 *
 * @param output stderr captured so far (may contain ANSI escapes and partial
 *   lines).
 * @returns the URL (e.g. `http://localhost:3958/`), or `null` if the marker has
 *   not yet appeared as a complete line.
 */
/** Matches a single SGR ANSI escape (e.g. `\x1b[31m`), which Quarto emits. */
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/**
 * Match a *complete* (newline-terminated) `Browse at <url>` line. Requiring the
 * trailing newline is deliberate: stderr is consumed in streamed chunks, and a
 * chunk could split mid-URL — anchoring on `\n` guarantees we never return a
 * truncated URL. `\S+?` is non-greedy but, because `\S` excludes the newline it
 * must reach, it still captures the whole URL up to the trailing whitespace.
 */
const BROWSE_PATTERN = /Browse at[ \t]+(https?:\/\/\S+?)[ \t\r]*\n/;

export function parseBrowseUrl(output: string): string | null {
  const clean = output.replace(ANSI_PATTERN, "");
  const match = BROWSE_PATTERN.exec(clean);
  return match ? match[1] : null;
}

/**
 * A stateful reader of `quarto preview` stderr, fed one chunk at a time as the process writes it.
 *
 * `push` answers null for every chunk until the `Browse at <url>` line is complete, and the URL at the first push
 * after which `parseBrowseUrl` of ALL the text pushed so far would be non-null (the same URL: the leftmost match, so
 * two marker lines in one chunk give the first). What it answers AFTER that first non-null answer is unspecified: the
 * caller stops feeding it.
 */
export interface BrowseUrlScanner {
  push(chunk: string): string | null;
}

/**
 * One scanner per spawned preview. It tests only the NEW text: `parseBrowseUrl` on a whole, growing buffer costs the
 * bytes so far times the chunks, and startup noise before the marker can be megabytes (Session 341, part 3 of the
 * "Slow shapes and residuals found by Session 339's review round" item).
 *
 * Why that is the same answer. `BROWSE_PATTERN` cannot span a newline (`\S` and `[ \t\r]` both exclude it, and the
 * pattern ends on one) and an SGR escape cannot contain one, so stripping the escapes and matching line by line gives
 * what doing both on the whole buffer gives. A match needs its terminating newline, so the text after the last newline
 * can never answer: it is kept RAW (a chunk boundary inside "Browse at", inside the URL, inside an escape or between
 * "\r" and "\n" must not matter) until its newline arrives. A push that completes lines tests exactly those lines,
 * the kept text plus the chunk up to its last newline, once; a push that brings no newline only keeps its chunk, so
 * one enormous line arriving in many chunks is read once, when its newline comes, and never joined or scanned before.
 */
export function createBrowseUrlScanner(): BrowseUrlScanner {
  // The incomplete last line so far (everything after the last newline pushed), as the pieces it arrived in.
  let tail: string[] = [];
  return {
    push(chunk: string): string | null {
      const end = chunk.lastIndexOf("\n") + 1;
      if (end === 0) {
        tail.push(chunk);
        return null;
      }
      const completed = tail.join("") + chunk.slice(0, end);
      tail = end < chunk.length ? [chunk.slice(end)] : [];
      return parseBrowseUrl(completed);
    },
  };
}
