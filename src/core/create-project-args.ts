/**
 * Pure, `vscode`-free argv builder for `quarto create-project` (plan
 * `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §3). Sibling of
 * `render-args.ts`'s `buildRenderProjectArgs` (plan §8's "sibling, not
 * generalize" precedent) — lives in `core/` and MUST NOT import `vscode`
 * (architecture plan §3.3).
 *
 * Deliberately targets the legacy, hidden `quarto create-project` alias, not
 * the modern `quarto create project` path — the legacy alias never prompts
 * (plan §0 Finding 2), so it is safe to spawn from a non-TTY child process
 * with no interactive-terminal-detection ambiguity.
 */

export type ProjectType = "default" | "website" | "book" | "manuscript";

/**
 * Build the argv for `quarto create-project <targetDir> --type <type>
 * --title <title>`. `targetDir` is passed through verbatim — the caller is
 * responsible for resolving it to an absolute path (mirrors
 * `render-project.ts`'s D1 discipline of always passing the resolved path
 * explicitly, never relying on cwd). `title` is passed as a single argv
 * element; `child_process.spawn` with an argv array bypasses shell parsing
 * entirely, so a title containing spaces needs no manual quoting.
 */
export function buildCreateProjectArgs(
  targetDir: string,
  type: ProjectType,
  title: string,
): string[] {
  return ["create-project", targetDir, "--type", type, "--title", title];
}
