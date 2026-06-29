/**
 * Pure, `vscode`-free parser for `quarto --paths` output (architecture plan
 * §3.3; Phase 6d plan §2.4).
 *
 * `quarto --paths` prints two lines — the bin directory then the share
 * directory — and exits 0 (verified live against 1.7.33). But it is
 * UNDOCUMENTED (absent from `quarto --help`), so it is treated like the
 * `Browse at` / `Output created` stderr markers (Learnings #4/#8/#11): a
 * fragile, live-captured signal, not an API contract. This parser is therefore
 * defensive — it locates the share directory by shape rather than by line
 * position — and the impure spawn lives in the adapter (`quarto/cli.ts`).
 */

/** A path whose final segment is `share` (optionally with a trailing separator). */
const SHARE_DIR = /(^|[/\\])share[/\\]?$/;

/**
 * The Quarto share directory from `quarto --paths` stdout, or `null` if none can
 * be found. Prefers the last line whose final path segment is `share` (tolerating
 * reordering, extra lines, CRLF, and surrounding whitespace from a future format
 * change); falls back to the last non-empty line so a shape change still yields a
 * best guess (the subsequent schema read then fails and the reader degrades to
 * the curated fallback — Phase 6d plan §2.5).
 */
export function parseSharePath(stdout: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return null;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SHARE_DIR.test(lines[i])) {
      return lines[i];
    }
  }
  return lines[lines.length - 1];
}
