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
  // Every string up to `maxLength` characters over the alphabet: 97,656 + 55,987 + 299,593 = 453,236 strings in all.
  it.each([
    ["up to seven characters over blanks, a letter, a no-break space and a line feed", 7, [" ", "\t", "a", "\u00a0", "\n"]],
    ["up to six characters over blanks, a letter, a carriage return, U+2028 and U+0085", 6, [" ", "\t", "x", "\r", "\u2028", "\u0085"]],
    // The Unicode and ASCII spaces `trimEnd()` strips that the two alphabets above leave out: a helper that also takes any of them survives those.
    ["up to six characters over blanks, a letter, a vertical tab, a form feed, U+3000, U+FEFF and U+2003", 6, [" ", "\t", "x", "\u000b", "\u000c", "\u3000", "\ufeff", "\u2003"]],
  ] as const)("agrees with the regex on every string of %s", (_name, maxLength, alphabet) => {
    let checked = 0;
    const disagreements: string[] = [];
    for (const s of everyString(alphabet, maxLength)) {
      if (trimEndBlanks(s) !== OLD(s)) {
        disagreements.push(JSON.stringify(s));
      }
      checked++;
    }
    expect(disagreements.slice(0, 5)).toEqual([]);
    expect(checked).toBe((alphabet.length ** (maxLength + 1) - 1) / (alphabet.length - 1)); // every string of 0..maxLength characters, none skipped
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
