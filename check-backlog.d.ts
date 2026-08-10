/**
 * Types for `check-backlog.js`, the `BACKLOG.md` hygiene gate
 * (CHANGELOG: BACKLOG.md holds only open work, Session 195).
 *
 * The gate is plain CommonJS at the repo root, beside `check-package.js`, so it
 * runs with no build step. This declaration exists only so the unit suite can
 * import it under `tsconfig.unit.json`'s `noImplicitAny`; `.vscodeignore`
 * excludes every TypeScript file, so it never ships.
 *
 * ⚠ Do not write a glob or regex containing a star-slash inside a block comment
 * here — it terminates the comment and breaks the build. Session 194 hit the
 * same edge with a regex literal; this file hit it with an ignore glob.
 */

/** A completed-work record found in the file: its 1-based line and its lead. */
export interface CompletedRecord {
  line: number;
  lead: string;
}

/**
 * Every block whose own LEAD announces the work is over — see the module
 * docstring for why the lead, and not the block, is what gets read.
 */
export function findCompletedRecords(markdown: string): CompletedRecord[];
