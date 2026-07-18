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
 * both delete loops (BACKLOG:184). This test fails the moment any `.ts` file under
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
