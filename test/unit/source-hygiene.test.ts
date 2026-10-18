import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Repo-hygiene guard, not a behaviour test.
 *
 * A raw NUL byte (`0x00`) in a text source makes both git and grep treat the
 * whole file as BINARY: `git diff` renders it `Bin <a> -> <b> bytes, 0 insertions`
 * (so every change to it is invisible to review) and `grep -rn` silently SKIPS it
 * (exiting 0, reading exactly like "no match"). That defeats this project's
 * MANDATORY grep-based evidence inventory: `src/core/embedded/vdoc-path.ts` — the
 * file that owns the delete-loop ownership grammar (`TEMP_DIR_RE`,
 * `isOurVdocFileName`, `VDOC_DIR_SEGMENTS`) — was unsearchable for exactly this
 * reason, so a `grep -rn` inventory over `src/` was silently blind to the guards on
 * both delete loops (CHANGELOG: vdoc-path NUL-separator source hygiene, Session 105). This test fails the moment any `.ts` file under
 * `src/` reintroduces a raw NUL, so a separator or docstring can never again smuggle
 * one in undetected.
 */
const SRC_DIR = fileURLToPath(new URL("../../src", import.meta.url));

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("source hygiene: no TypeScript source may contain a raw NUL byte", () => {
  it("scans src/**/*.ts and finds none (so git/grep never read a source file as binary)", () => {
    const offenders: string[] = [];
    for (const file of tsFilesUnder(SRC_DIR)) {
      const firstNul = readFileSync(file).indexOf(0);
      if (firstNul !== -1) {
        offenders.push(`${file.slice(SRC_DIR.length + 1)} (first NUL at byte ${firstNul})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Session 320. U+2028 and U+2029 are LINE TERMINATORS to a regular-expression literal, so a raw one inside a pattern is a syntax error, and inside a comment it splits a line that tools count
 * differently. The editing tools write the character in place of the escape: Session 319's `hash-comment.ts` held two (fixed in the next commit, `280cc912`) and Session 320's `render-args.ts` held
 * two the moment its pattern was edited (Learning 786, twice). The escape (a backslash and `u2028`) is the only spelling `src/` may use; a string in a TEST may hold the raw character legally, so this
 * scans `src/` only.
 */
const rawSeparatorLines = (text: string): number[] =>
  text.split("\n").flatMap((line, index) => (line.includes(String.fromCharCode(0x2028)) || line.includes(String.fromCharCode(0x2029)) ? [index + 1] : []));

describe("source hygiene: no TypeScript source may contain a raw line or paragraph separator", () => {
  // A gate nothing tests passes when its scan is broken (a different code point, one half of the pair, a subdirectory only): the scan is a function and is tried on strings, and the directory walk
  // must reach the source tree it is meant to cover (82 files today).
  it("the scan finds a raw U+2028 or U+2029 and passes plain text, and the walk reaches the source tree", () => {
    expect(rawSeparatorLines(`a\n${String.fromCharCode(0x2028)}\nb`)).toEqual([2]);
    expect(rawSeparatorLines(`a${String.fromCharCode(0x2029)}`)).toEqual([1]);
    expect(rawSeparatorLines("plain\ntext\n")).toEqual([]);
    expect(tsFilesUnder(SRC_DIR).length).toBeGreaterThan(60);
  });

  it("scans src/**/*.ts and finds none (write the escape; the editing tools turn it into the character)", () => {
    const offenders: string[] = [];
    for (const file of tsFilesUnder(SRC_DIR)) {
      for (const line of rawSeparatorLines(readFileSync(file, "utf8"))) {
        offenders.push(`${file.slice(SRC_DIR.length + 1)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
