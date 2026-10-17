/**
 * Pure, `vscode`-free helpers for constructing a `quarto render` invocation and
 * interpreting its output.
 *
 * This module lives in `core/` and MUST NOT import `vscode` (architecture plan
 * §3.3 — "the load-bearing guardrail"). Phase 3's dragon note (§6) is explicit:
 * "Keep the arg-construction logic a pure function in `core/` so it's
 * unit-tested without spawning a process." The output-path parser lives here
 * for the same reason — it has real logic (ANSI stripping, relative paths) that
 * deserves headless unit coverage.
 */

export interface RenderOptions {
  /** Output format, passed as `--to <format>` (e.g. "html", "pdf"). */
  to?: string;
}

/**
 * Build the argv for `quarto render <file> [--to <format>]`.
 *
 * The file is passed through unchanged (the caller supplies an absolute path);
 * an empty/whitespace `to` is omitted so Quarto uses the document's own
 * `format:`.
 */
export function buildRenderArgs(
  file: string,
  opts: RenderOptions = {},
): string[] {
  const args = ["render", file];
  const to = opts.to?.trim();
  if (to) {
    args.push("--to", to);
  }
  return args;
}

/**
 * Build the argv for `quarto render <projectRoot>` — a whole-project render.
 * The root is passed as an explicit positional argument (NEVER bare
 * `quarto render` relying on cwd alone — a bare invocation from a project
 * SUBdirectory silently renders only that subdirectory's files, not the
 * whole project, confirmed empirically against Quarto 1.7.33; see
 * docs/planning/2026-07-09-project-level-render-plan.md §0/§7 D2). Kept as a
 * sibling of `buildRenderArgs`, not a generalization of it (plan §8).
 */
export function buildRenderProjectArgs(projectRoot: string): string[] {
  return ["render", projectRoot];
}

/**
 * Build the argv for `quarto render <file> --cache-refresh` — the documented
 * way to force-refresh a document's Jupyter/Knitr execution cache (confirmed
 * against the installed Quarto CLI's own `render --help` and quarto.org's
 * code-execution docs; there is no CLI flag to purge the cache WITHOUT also
 * rendering).
 */
export function buildCacheRefreshArgs(file: string): string[] {
  return ["render", file, "--cache-refresh"];
}

/** Matches a single SGR ANSI escape (e.g. `\x1b[31m`), which Quarto emits. */
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/**
 * The marker, the blanks after it, and the rest of the line (up to a `\n`, `\r`, U+2028 or
 * U+2029, which is where `.` and a multiline `$` stop). Nothing here can backtrack: the path's
 * trailing blanks are cut by `parseOutputPath` itself.
 */
const OUTPUT_CREATED_LINE = /Output created:([ \t]*)([^\n\r\u2028\u2029]*)/g;

/**
 * Extract the output path from a successful `quarto render` run.
 *
 * Quarto prints `Output created: <path>` (verified live against 1.7.33 — note
 * it is written to STDERR, and the path is relative to the input file's
 * directory). This tolerates surrounding ANSI color escapes and returns the
 * LAST match, since a multi-format render prints one line per format and the
 * caller most likely wants the final artifact.
 *
 * The line is read once and its trailing blanks are cut by a scan. The lazy `(.+?)[ \t]*$` this
 * replaces re-read the rest of a blank run at every character it took, so a line with n blanks
 * inside the path cost n squared (21 s for 100,000), and the output holds whatever the
 * document's own code printed. It answers what that pattern answered, including the odd case:
 * a line that is only blanks after the colon gives back its last blank, and an empty one
 * matches nothing.
 *
 * @returns the reported path (verbatim, possibly relative), or `null` if the
 *   success marker is absent.
 */
export function parseOutputPath(output: string): string | null {
  const clean = output.replace(ANSI_PATTERN, "");
  let last: string | null = null;
  for (const [, blanks, rest] of clean.matchAll(OUTPUT_CREATED_LINE)) {
    if (rest !== "") {
      let end = rest.length;
      while (rest[end - 1] === " " || rest[end - 1] === "\t") {
        end--;
      }
      last = rest.slice(0, end);
    } else if (blanks !== "") {
      last = blanks[blanks.length - 1];
    }
  }
  return last;
}
