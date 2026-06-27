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
