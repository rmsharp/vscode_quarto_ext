/**
 * Pure, `vscode`-free helpers for reasoning about Quarto CLI versions.
 *
 * This module lives in `core/` and MUST NOT import `vscode` (architecture plan
 * §3.3 — "the load-bearing guardrail"). Keeping parsing/analysis pure makes it
 * unit-testable headlessly (no Extension Development Host, no `code` CLI) and
 * portable to an out-of-process language server later (the cheap B→C migration).
 */

/** Minimum Quarto CLI version the extension targets (plan §4: Quarto >= 1.7). */
export const MINIMUM_QUARTO_VERSION = "1.7.0";

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Extract a `major.minor.patch` version from the output of `quarto --version`.
 *
 * `quarto --version` prints just the version on its own line (verified against
 * Quarto 1.7.33: stdout is `1.7.33\n`), but we scan for the first semver token
 * so the parser tolerates extra banner text on other platforms/versions.
 *
 * @returns the matched `"major.minor.patch"` string, or `null` if none found.
 */
export function parseQuartoVersion(stdout: string): string | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(stdout);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

/** Parse a `major.minor.patch` string into a structured {@link SemVer}, or null. */
export function toSemVer(version: string): SemVer | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Is `version` greater than or equal to `minimum`? Both are `major.minor.patch`
 * strings. Unparseable input returns `false`; the caller decides whether an
 * unknown version warrants a warning or a hard block (plan §8: `< 1.7` warns
 * but is allowed).
 */
export function meetsMinimum(
  version: string,
  minimum: string = MINIMUM_QUARTO_VERSION,
): boolean {
  const v = toSemVer(version);
  const m = toSemVer(minimum);
  if (!v || !m) {
    return false;
  }
  if (v.major !== m.major) {
    return v.major > m.major;
  }
  if (v.minor !== m.minor) {
    return v.minor > m.minor;
  }
  return v.patch >= m.patch;
}
