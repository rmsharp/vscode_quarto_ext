import { describe, expect, it } from "vitest";
import { asciiTrim } from "../../src/core/qmd/model";

// Session 314 — `asciiTrim` is the one both-ends trim the model uses for a YAML value (the `from:` proof reader) and for an R chunk-header
// slot (`knitrChunkHeaderLabel`). It was `.replace(/^[ \t]+|[ \t]+$/g, "")`, which is quadratic in a run of spaces INSIDE the text (the
// `[ \t]+$` alternative is retried from every space of the run, and fails at the letter after it): 64,000 spaces took 2.4 s, and a `from:`
// line holding one took 7 s because the proof trims the value three times. The obvious cure, `trim()`, is WRONG here: it also strips a
// no-break space, a line separator and every other Unicode space, which YAML does not trim. The old regex is the oracle: the helper must
// answer what it answered on every string.

const OLD = (value: string): string => value.replace(/^[ \t]+|[ \t]+$/g, "");

// Written with `String.fromCharCode` so no tool between the author and the file can turn an escape into a glyph.
const NBSP = String.fromCharCode(0xa0);
const NEL = String.fromCharCode(0x85);
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const VERTICAL_TAB = String.fromCharCode(0x0b);
const FORM_FEED = String.fromCharCode(0x0c);
const IDEOGRAPHIC_SPACE = String.fromCharCode(0x3000);
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const EM_SPACE = String.fromCharCode(0x2003);

/** Every UTF-16 code unit `trim()` strips: tab, line feed, vertical tab, form feed, carriage return, space, no-break space, U+1680, U+2000 to U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF. */
const TRIM_WHITESPACE: string[] = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, ...Array.from({ length: 11 }, (_, i) => 0x2000 + i), 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff].map((code) => String.fromCharCode(code));

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

describe("asciiTrim answers what /^[ \\t]+|[ \\t]+$/g answered (Session 314)", () => {
  it("the fourth alphabet holds EVERY code unit trim() strips, and nothing else", () => {
    const stripped: string[] = [];
    for (let code = 0; code <= 0xffff; code++) {
      if (String.fromCharCode(code).trim() === "") {
        stripped.push(String.fromCharCode(code));
      }
    }
    expect(TRIM_WHITESPACE).toHaveLength(25);
    expect([...TRIM_WHITESPACE].sort()).toEqual([...stripped].sort());
  });

  // Every string up to `maxLength` characters over the alphabet: 97,656 + 55,987 + 299,593 + 475,255 = 928,491 strings in all.
  it.each([
    ["up to seven characters over blanks, a letter, a no-break space and a line feed", 7, [" ", "\t", "a", NBSP, "\n"]],
    ["up to six characters over blanks, a letter, a carriage return, U+2028 and U+0085", 6, [" ", "\t", "x", "\r", LINE_SEPARATOR, NEL]],
    // Some of the Unicode and ASCII spaces `trim()` strips that the two alphabets above leave out (the fourth row holds ALL of them).
    ["up to six characters over blanks, a letter, a vertical tab, a form feed, U+3000, U+FEFF and U+2003", 6, [" ", "\t", "x", VERTICAL_TAB, FORM_FEED, IDEOGRAPHIC_SPACE, BYTE_ORDER_MARK, EM_SPACE]],
    // Every one of the 25 UTF-16 code units `trim()` strips, and a letter: a helper that also takes ANY of them (U+1680, U+2000 to U+200A, U+2029, U+202F, U+205F included) fails.
    ["up to four characters over the 25 characters trim() strips and a letter", 4, [...TRIM_WHITESPACE, "x"]],
  ] as const)("agrees with the regex on every string of %s", (_name, maxLength, alphabet) => {
    let checked = 0;
    const disagreements: string[] = [];
    for (const s of everyString(alphabet, maxLength)) {
      if (asciiTrim(s) !== OLD(s)) {
        disagreements.push(JSON.stringify(s));
      }
      checked++;
    }
    expect(disagreements.slice(0, 5)).toEqual([]);
    expect(checked).toBe((alphabet.length ** (maxLength + 1) - 1) / (alphabet.length - 1)); // every string of 0..maxLength characters, none skipped
  });

  it.each([
    ["a no-break space at the end", `key${NBSP}`, `key${NBSP}`],
    ["a no-break space at the start", `${NBSP}key`, `${NBSP}key`],
    ["a no-break space behind blanks at the end", `key${NBSP} \t `, `key${NBSP}`],
    ["a no-break space behind blanks at the start", ` \t ${NBSP}key`, `${NBSP}key`],
    ["a line feed at either end", "\nkey \n", "\nkey \n"],
    ["a carriage return at either end", "\rkey \r", "\rkey \r"],
    ["U+2028 at either end", `${LINE_SEPARATOR}key${LINE_SEPARATOR}`, `${LINE_SEPARATOR}key${LINE_SEPARATOR}`],
    ["blanks only", " \t \t", ""],
    ["a single space", " ", ""],
    ["nothing to trim", "key", "key"],
    ["the empty string", "", ""],
    ["interior blanks", " a  b \t", "a  b"],
    ["blanks at both ends", "\t  gfm \t", "gfm"],
  ])("%s: the text it must keep stays, only leading and trailing spaces and tabs go", (_what, input, expected) => {
    expect(asciiTrim(input)).toBe(expected);
  });
});
