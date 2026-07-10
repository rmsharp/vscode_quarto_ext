/**
 * Pure, `vscode`-free argv builder for `quarto convert` (plan
 * `docs/planning/2026-07-10-notebook-conversion-plan.md` §4) — lives in
 * `core/` and MUST NOT import `vscode` (architecture guardrail §3.3).
 */

import * as path from "node:path";

export type ConvertDirection = "toIpynb" | "toQmd";

/** Infers direction from the input's extension; `null` if neither .qmd nor .ipynb. */
export function inferConvertDirection(inputPath: string): ConvertDirection | null {
  if (inputPath.endsWith(".qmd")) {
    return "toIpynb";
  }
  if (inputPath.endsWith(".ipynb")) {
    return "toQmd";
  }
  return null;
}

/**
 * Derives the output path Quarto's own default naming would produce (same
 * directory, same basename, swapped extension) — computed by us, then passed
 * explicitly via `--output` rather than relying on the CLI's own implicit
 * default.
 */
export function deriveConvertOutputPath(
  inputPath: string,
  direction: ConvertDirection,
): string {
  const targetExt = direction === "toIpynb" ? ".ipynb" : ".qmd";
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  return path.join(dir, base + targetExt);
}

/** Builds the argv for `quarto convert <inputPath> --output <outputPath>`. */
export function buildConvertArgs(
  inputPath: string,
  outputPath: string,
): string[] {
  return ["convert", inputPath, "--output", outputPath];
}
