// A run of identifier-like characters read by index, for the sites that were a class-plus under the `u` flag over letters and numbers (Session 338).
//
// ⚠ **WHY A LOOP AND NOT `[\p{L}\p{N}_:.-]+`.** V8 keeps one entry of its regex backtrack stack per character of a class-plus too, and twice as large once the line holds a character above
// U+00FF (the subject is stored with two bytes a character): the pattern throws `RangeError: Maximum call stack size exceeded` from 4,194,288 letters above U+00FF, Cyrillic, CJK and astral alike,
// and a thrown `RangeError` answers NOTHING for the whole document (Learnings 889, 890). The run is read here by UTF-16 code unit, with no stack.
//
// ⚠ **A CHARACTER ABOVE ASCII IS READ AS ONE CODE POINT, AS THE `u` FLAG READ IT.** A high surrogate followed by a low one is ONE character (`𝐀`, a letter) and a surrogate on its own is neither a
// letter nor a number: one sticky `[\p{L}\p{N}]` test at the index reads either. The ASCII characters go through a table of 128 entries (the letters, the digits and the punctuation a class adds), which
// is what keeps the loop at tens of nanoseconds a character on the long lines the cure exists for.
//
// ⚠ **EVERY CLASS HERE HOLDS ALL LETTERS AND NUMBERS, ASCII OR NOT, AND SOME ASCII PUNCTUATION.** A class that does not (a letter-only start, a negated class) is not this module's: write it as its own
// loop. Each call site keeps its OLD pattern as the oracle of its own cure (Learning 738); `test/unit/unicode-run.test.ts` keeps the class itself against the pattern, over every code point.

/** The ASCII members of a class: a table of 128 entries, 1 for a member. Built by {@link runClass}. */
export type RunClass = Uint8Array;

const NON_ASCII_LETTER_OR_NUMBER = /[\p{L}\p{N}]/uy;

/** The class of every letter and number plus the ASCII punctuation in `punctuation`: `runClass("_:.-")` is `[\p{L}\p{N}_:.-]`. A punctuation character that is no ASCII character is refused. */
export function runClass(punctuation: string): RunClass {
  const table = new Uint8Array(128);
  for (let c = 48; c <= 57; c++) {
    table[c] = 1;
  }
  for (let c = 65; c <= 90; c++) {
    table[c] = 1;
  }
  for (let c = 97; c <= 122; c++) {
    table[c] = 1;
  }
  for (let i = 0; i < punctuation.length; i++) {
    const c = punctuation.charCodeAt(i);
    if (c >= 128) {
      throw new RangeError(`runClass: U+${c.toString(16).padStart(4, "0")} is not an ASCII character`);
    }
    table[c] = 1;
  }
  return table;
}

/** `[\p{L}\p{N}_:.-]`: the characters of a cross-reference identifier and of a heading, image, span or div attribute identifier (Pandoc's). */
export const IDENTIFIER_RUN: RunClass = runClass("_:.-");

/**
 * Where the run of members that starts at `from` ends: the index of the first character that is none, or the length of `text`; `from` itself when no member stands there (and when `from` is at or
 * past the end). What a sticky `[...]*` pattern over the class leaves in `lastIndex`.
 */
export function runEnd(text: string, from: number, members: RunClass): number {
  const length = text.length;
  let at = from;
  while (at < length) {
    const c = text.charCodeAt(at);
    if (c < 128) {
      if (members[c] === 0) {
        break;
      }
      at++;
      continue;
    }
    NON_ASCII_LETTER_OR_NUMBER.lastIndex = at;
    if (!NON_ASCII_LETTER_OR_NUMBER.test(text)) {
      break;
    }
    at = NON_ASCII_LETTER_OR_NUMBER.lastIndex;
  }
  return at;
}

/** Whether `text` is one or more members and nothing else: `/^[...]+$/u` over the class. */
export function isRun(text: string, members: RunClass): boolean {
  return text.length > 0 && runEnd(text, 0, members) === text.length;
}
