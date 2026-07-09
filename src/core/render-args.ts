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

/** Matches a single SGR ANSI escape (e.g. `\x1b[31m`), which Quarto emits. */
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/**
 * Extract the output path from a successful `quarto render` run.
 *
 * Quarto prints `Output created: <path>` (verified live against 1.7.33 — note
 * it is written to STDERR, and the path is relative to the input file's
 * directory). This tolerates surrounding ANSI color escapes and returns the
 * LAST match, since a multi-format render prints one line per format and the
 * caller most likely wants the final artifact.
 *
 * @returns the reported path (verbatim, possibly relative), or `null` if the
 *   success marker is absent.
 */
export function parseOutputPath(output: string): string | null {
  const clean = output.replace(ANSI_PATTERN, "");
  const re = /Output created:[ \t]*(.+?)[ \t]*$/gm;
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = re.exec(clean)) !== null) {
    last = match[1];
  }
  return last;
}
