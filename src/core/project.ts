/**
 * Pure, `vscode`-free project-root discovery (plan
 * `docs/planning/2026-07-09-project-level-render-plan.md` §5.1).
 *
 * This module lives in `core/` and MUST NOT import `vscode` (`CLAUDE.md` §3.3).
 */

import * as path from "node:path";

/**
 * Walk up from `startDir` looking for a Quarto project marker (`_quarto.yml`
 * or `_quarto.yaml`). Stops at (and checks) `boundaryDir` inclusive; pass
 * `null` to walk unbounded to the filesystem root (only correct when there is
 * no owning workspace folder to respect — plan §2.2).
 *
 * `exists` is injected so this stays a pure, headlessly-unit-testable
 * function — the real filesystem check lives in the adapter (`features/`).
 */
export function findProjectRoot(
  startDir: string,
  boundaryDir: string | null,
  exists: (path: string) => boolean,
): string | null {
  let current = path.normalize(startDir);
  const boundary = boundaryDir !== null ? path.normalize(boundaryDir) : null;

  for (;;) {
    if (
      exists(path.join(current, "_quarto.yml")) ||
      exists(path.join(current, "_quarto.yaml"))
    ) {
      return current;
    }
    if (boundary !== null && current === boundary) {
      return null;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
