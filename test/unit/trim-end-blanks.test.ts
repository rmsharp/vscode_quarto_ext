import { describe, expect, it } from "vitest";
import { trimEndBlanks } from "../../src/core/qmd/model";

// Session 312 — `trimEndBlanks` is what the eight YAML KEY trims `.replace(/[ \t]+$/, "")` became. That regex is quadratic in a run of
// spaces inside the key (100,000 spaces took 11 s in the engine resolver), and the obvious cure, `trimEnd()`, is WRONG for a key: it also
// strips a no-break space, a line separator and every other Unicode space, while YAML (and the regex) trim an ASCII space or tab only.
// The old regex is the oracle here: the helper must answer what it answered on every string.

const OLD = (value: string): string => value.replace(/[ \t]+$/, "");

/** Every string of 0..maxLength characters over `alphabet`, shortest first. */
function* everyString(alphabet: readonly string[], maxLength: number): Generator<string> {
  let level: string[] = [""];
  yield "";
  for (let length = 1; length <= maxLength; length++) {
    const next: string[] = [];
    for (const prefix of level) {
      for (const ch of alphabet) {
        next.push(prefix + ch);
      }
    }
    level = next;
    yield* level;
  }
}

describe("trimEndBlanks answers what /[ \\t]+$/ answered (Session 312)", () => {
  it.each([
    ["blanks, a letter, a no-break space and a line feed", [" ", "\t", "a", "\u00a0", "\n"]],
    ["blanks, a letter, a carriage return, U+2028 and U+0085", [" ", "\t", "x", "\r", "\u2028", "\u0085"]],
  ] as const)("agrees with the regex on every string of up to seven characters over %s", (_name, alphabet) => {
    let checked = 0;
    for (const s of everyString(alphabet, alphabet.length === 5 ? 7 : 6)) {
      expect(trimEndBlanks(s)).toBe(OLD(s));
      checked++;
    }
    expect(checked).toBeGreaterThan(50000);
  });

  it.each([
    ["a no-break space", "key\u00a0", "key\u00a0"],
    ["a no-break space behind blanks", "key\u00a0 \t ", "key\u00a0"],
    ["a line feed", "key \n", "key \n"],
    ["a carriage return", "key \r", "key \r"],
    ["U+2028", "key\u2028", "key\u2028"],
    ["blanks only", " \t \t", ""],
    ["nothing to trim", "key", "key"],
    ["the empty string", "", ""],
    ["interior blanks", "a  b \t", "a  b"],
  ])("%s: the text it must keep stays, only trailing spaces and tabs go", (_what, input, expected) => {
    expect(trimEndBlanks(input)).toBe(expected);
  });
});
