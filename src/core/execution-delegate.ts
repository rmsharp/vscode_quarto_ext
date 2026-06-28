/**
 * Pure, `vscode`-free logic for choosing which installed extension command to
 * delegate cell execution to.
 *
 * Run-cell does not execute code itself — it hands the cell to the user's
 * language extension (Jupyter for Python, the R extension, the Julia extension).
 * Those command IDs are EXTERNAL CONTRACTS that can change (plan §6 Phase 5
 * dragon), so they are pinned here in one place and feature-detected at runtime
 * by the adapter. Keeping the selection logic pure makes it unit-testable
 * without a VS Code host (§3.3 guardrail; faithful per Learning #9).
 */

/**
 * Choose the delegate command for `lang` from those `available` in the host, in
 * preference order, or `null` when no candidate is registered (the caller then
 * shows a graceful "install the … extension" message instead of crashing).
 */
export function pickDelegate(
  lang: string,
  available: readonly string[],
): string | null {
  for (const candidate of delegateCommandsFor(lang)) {
    if (available.includes(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * The text of a fresh, empty executable cell for `lang` (defaulting to python),
 * with a blank body line for the cursor. Used by the `Insert Cell` command.
 */
export function buildCellSnippet(lang: string): string {
  const engine = lang.trim() || "python";
  return "```{" + engine + "}\n\n```\n";
}

/** Candidate delegate command IDs for a cell language, in preference order. */
export function delegateCommandsFor(lang: string): string[] {
  switch (lang.trim().toLowerCase()) {
    case "python":
      return ["jupyter.execSelectionInteractive"];
    case "r":
      return ["r.runSelection"];
    case "julia":
      return ["language-julia.executeCodeBlockOrSelection"];
    default:
      return [];
  }
}
