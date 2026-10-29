import { describe, expect, it } from "vitest";
import { IDENTIFIER_RUN, isRun, runClass, runEnd } from "../../src/core/qmd/unicode-run";

// Session 338, the shared helper of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" (group g02). Nine patterns were a class-plus under the `u` flag over letters and
// numbers (`[\p{L}\p{N}_:.-]+` and its three siblings), and V8 keeps one entry of its regex backtrack stack per character of such a run, twice as large once the line holds a character above U+00FF: they throw
// `RangeError: Maximum call stack size exceeded` from 4,194,288 letters above U+00FF (Learning 890). Session 337 wrote the cure for one of them four times over (a sticky pattern per call site); this module is the
// one place the cure is written. `runEnd` reads the run by index: an ASCII character by a table, any other character as one CODE POINT by a sticky `[\p{L}\p{N}]`, which is how the `u` flag read it (a surrogate
// pair is one character, a lone surrogate none). The pattern is kept here as the ORACLE of the class, not of any call site (each site keeps its own old pattern as its oracle).

/** Where a sticky star-pattern over the class stops when it starts at `from`. The oracle of `runEnd`. */
function patternEnd(pattern: RegExp, text: string, from: number): number {
  pattern.lastIndex = from;
  pattern.exec(text);
  return pattern.lastIndex;
}

const ID_PATTERN = /[\p{L}\p{N}_:.-]*/uy;
const WORD_DASH_PATTERN = /[\p{L}\p{N}_-]*/uy;
const NO_DOT_PATTERN = /[\p{L}\p{N}_:-]*/uy;

const WORD_DASH_RUN = runClass("_-");
const NO_DOT_RUN = runClass("_:-");

const ASTRAL_LETTER = String.fromCodePoint(0x1d400); // MATHEMATICAL BOLD CAPITAL A: a letter of two UTF-16 code units
const EMOJI = String.fromCodePoint(0x1f600); // neither a letter nor a number, two code units
const CJK = String.fromCharCode(0x4e2d); // a letter above U+00FF: the line is stored with two bytes a character
const E_ACUTE = String.fromCharCode(0xe9); // a letter below U+0100 that is no ASCII letter
const ARABIC_THREE = String.fromCharCode(0x663); // a decimal digit (Nd) that is no ASCII digit
const SUPERSCRIPT_TWO = String.fromCharCode(0xb2); // a number (No) that is no ASCII digit

describe("Session 338 — runClass", () => {
  it("holds the ASCII letters and digits and the punctuation it is given, and nothing else of the 128", () => {
    const table = runClass("_:.-");
    expect(table).toHaveLength(128);
    const members = Array.from({ length: 128 }, (_, c) => c).filter((c) => table[c] === 1).map((c) => String.fromCharCode(c));
    const expected = [..."-.0123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"];
    expect(members).toEqual(expected);
  });

  it("with no punctuation holds only the letters and digits", () => {
    const table = runClass("");
    expect(Array.from(table).reduce((sum, bit) => sum + bit, 0)).toBe(62);
  });

  it("refuses a punctuation character that is no ASCII character, rather than ignoring it", () => {
    expect(() => runClass(E_ACUTE)).toThrow(RangeError);
    expect(() => runClass("_\u0080")).toThrow(RangeError);
  });

  it("IDENTIFIER_RUN is the table of `[\\p{L}\\p{N}_:.-]`", () => {
    expect([...IDENTIFIER_RUN]).toEqual([...runClass("_:.-")]);
  });
});

describe("Session 338 — runEnd, every code point against the pattern", () => {
  it("reads one character of every code point exactly as the class did (1,112,064 scalar values, three classes)", () => {
    const wrong: string[] = [];
    let compared = 0;
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      const text = String.fromCodePoint(cp);
      compared++;
      if (runEnd(text, 0, IDENTIFIER_RUN) !== patternEnd(ID_PATTERN, text, 0)) wrong.push(`id U+${cp.toString(16)}`);
      if (runEnd(text, 0, WORD_DASH_RUN) !== patternEnd(WORD_DASH_PATTERN, text, 0)) wrong.push(`word-dash U+${cp.toString(16)}`);
      if (runEnd(text, 0, NO_DOT_RUN) !== patternEnd(NO_DOT_PATTERN, text, 0)) wrong.push(`no-dot U+${cp.toString(16)}`);
    }
    expect(compared).toBe(1_112_064);
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it("reads a lone surrogate, high or low, as no character, alone and between two letters", () => {
    for (let unit = 0xd800; unit <= 0xdfff; unit++) {
      const lone = String.fromCharCode(unit);
      const between = "a" + lone + "b";
      expect(runEnd(lone, 0, IDENTIFIER_RUN), `U+${unit.toString(16)} alone`).toBe(0);
      expect(runEnd(between, 0, IDENTIFIER_RUN), `U+${unit.toString(16)} between`).toBe(patternEnd(ID_PATTERN, between, 0));
    }
  });

  it("reads a pair of surrogates as ONE character: a letter is two code units, an emoji ends the run", () => {
    expect(runEnd(ASTRAL_LETTER, 0, IDENTIFIER_RUN)).toBe(2);
    expect(runEnd("a" + ASTRAL_LETTER + "b", 0, IDENTIFIER_RUN)).toBe(4);
    expect(runEnd("a" + EMOJI + "b", 0, IDENTIFIER_RUN)).toBe(1);
    expect(runEnd(ASTRAL_LETTER.charAt(0), 0, IDENTIFIER_RUN)).toBe(0);
    expect(runEnd(ASTRAL_LETTER.charAt(1), 0, IDENTIFIER_RUN)).toBe(0);
  });

  it("agrees with the class on every pair of surrogate halves (1,048,576 pairs)", () => {
    const wrong: string[] = [];
    for (let high = 0xd800; high <= 0xdbff; high++) {
      for (let low = 0xdc00; low <= 0xdfff; low++) {
        const text = String.fromCharCode(high, low);
        if (runEnd(text, 0, IDENTIFIER_RUN) !== patternEnd(ID_PATTERN, text, 0)) wrong.push(`U+${high.toString(16)} U+${low.toString(16)}`);
      }
    }
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  it("agrees with the class on every code unit between two letters and after a dot (65,536 units, two shapes)", () => {
    const wrong: string[] = [];
    for (let unit = 0; unit <= 0xffff; unit++) {
      for (const text of ["a" + String.fromCharCode(unit) + "b", ".-" + String.fromCharCode(unit) + "_"]) {
        if (runEnd(text, 0, IDENTIFIER_RUN) !== patternEnd(ID_PATTERN, text, 0)) wrong.push(`U+${unit.toString(16)} in ${JSON.stringify(text)}`);
        if (runEnd(text, 0, NO_DOT_RUN) !== patternEnd(NO_DOT_PATTERN, text, 0)) wrong.push(`no-dot U+${unit.toString(16)} in ${JSON.stringify(text)}`);
      }
    }
    expect(wrong.slice(0, 5)).toEqual([]);
  });
});

describe("Session 338 — runEnd, answers stated by definition", () => {
  it("stops at the first character the class does not hold, and starts where it is told", () => {
    expect(runEnd("fig-a.b c", 0, IDENTIFIER_RUN)).toBe(7);
    expect(runEnd("#fig-a.b c", 0, IDENTIFIER_RUN)).toBe(0);
    expect(runEnd("#fig-a.b c", 1, IDENTIFIER_RUN)).toBe(8);
    expect(runEnd("fig-a.b", 0, IDENTIFIER_RUN)).toBe(7);
    expect(runEnd("fig-a.b", 7, IDENTIFIER_RUN)).toBe(7);
  });

  it("returns `from` when no character of the class stands there, and when `from` is at or past the end", () => {
    expect(runEnd("a b", 1, IDENTIFIER_RUN)).toBe(1);
    expect(runEnd("", 0, IDENTIFIER_RUN)).toBe(0);
    expect(runEnd("abc", 3, IDENTIFIER_RUN)).toBe(3);
    expect(runEnd("abc", 9, IDENTIFIER_RUN)).toBe(9);
  });

  it("holds the dot in the identifier class and not in the class without it, the colon in neither word-dash", () => {
    expect(runEnd("a.b:c", 0, IDENTIFIER_RUN)).toBe(5);
    expect(runEnd("a.b:c", 0, NO_DOT_RUN)).toBe(1);
    expect(runEnd("a-b:c", 0, WORD_DASH_RUN)).toBe(3);
    expect(runEnd("a_b-c", 0, WORD_DASH_RUN)).toBe(5);
  });

  it("holds non-ASCII letters and numbers, whatever their width, and no other non-ASCII character", () => {
    const stated = `a${E_ACUTE}${ARABIC_THREE}${SUPERSCRIPT_TWO}${CJK}${ASTRAL_LETTER}z`;
    expect(runEnd(stated, 0, IDENTIFIER_RUN)).toBe(stated.length);
    for (const stop of [EMOJI, " ", " ", "×", "—", "　", "́"]) {
      expect(runEnd(`ab${stop}cd`, 0, IDENTIFIER_RUN), `U+${stop.codePointAt(0)!.toString(16)}`).toBe(2);
    }
  });

  it("reads from the middle of a string at every start the way the class does, except a start inside a surrogate pair", () => {
    // A start between the two halves of a pair is no start any call site makes (a run starts after an ASCII delimiter or at the front), and the pattern itself steps BACK to the pair there
    // (a sticky `u` test at a low half reads from the high half, so its `lastIndex` ends below `from`): that case is not part of the contract, and this row does not compare it.
    const text = `a-b.c_${E_ACUTE}${ASTRAL_LETTER}${CJK}:#${EMOJI}9`;
    for (let from = 0; from <= text.length; from++) {
      const insidePair = from > 0 && from < text.length && text.charCodeAt(from - 1) >= 0xd800 && text.charCodeAt(from - 1) <= 0xdbff && text.charCodeAt(from) >= 0xdc00 && text.charCodeAt(from) <= 0xdfff;
      if (insidePair) continue;
      expect(runEnd(text, from, IDENTIFIER_RUN), `from ${from}`).toBe(patternEnd(ID_PATTERN, text, from));
      expect(runEnd(text, from, NO_DOT_RUN), `no-dot from ${from}`).toBe(patternEnd(NO_DOT_PATTERN, text, from));
    }
  });
});

describe("Session 338 — isRun", () => {
  it("is true for one or more characters of the class and nothing else, and false for the empty string", () => {
    expect(isRun("", WORD_DASH_RUN)).toBe(false);
    expect(isRun("callout-note", WORD_DASH_RUN)).toBe(true);
    expect(isRun("callout_note", WORD_DASH_RUN)).toBe(true);
    expect(isRun("callout.note", WORD_DASH_RUN)).toBe(false);
    expect(isRun("callout note", WORD_DASH_RUN)).toBe(false);
    expect(isRun(`${CJK}${ASTRAL_LETTER}-1`, WORD_DASH_RUN)).toBe(true);
    expect(isRun(`a${EMOJI}`, WORD_DASH_RUN)).toBe(false);
    expect(isRun("-", WORD_DASH_RUN)).toBe(true);
  });

  it("agrees with the anchored pattern on every code unit alone and after one letter", () => {
    const anchored = /^[\p{L}\p{N}_-]+$/u;
    for (let unit = 0; unit <= 0xffff; unit++) {
      for (const text of [String.fromCharCode(unit), "a" + String.fromCharCode(unit)]) {
        expect(isRun(text, WORD_DASH_RUN), `U+${unit.toString(16)}`).toBe(anchored.test(text));
      }
    }
  });
});

describe("Session 338 — a line of millions of characters (the pattern threw from 4,194,288 letters above U+00FF)", () => {
  const LIMIT_MS = 3000;

  it("reads a run of 6,000,000 ASCII letters", () => {
    const text = "a".repeat(6_000_000);
    const started = performance.now();
    expect(runEnd(text, 0, IDENTIFIER_RUN)).toBe(text.length);
    expect(performance.now() - started).toBeLessThan(LIMIT_MS);
  });

  it("reads a run of 6,000,000 letters up to U+00FF", () => {
    const text = E_ACUTE.repeat(6_000_000);
    const started = performance.now();
    expect(runEnd(text, 0, IDENTIFIER_RUN)).toBe(text.length);
    expect(performance.now() - started).toBeLessThan(LIMIT_MS);
  });

  it("reads a run of 5,000,000 letters above U+00FF, past the pattern's first throw", () => {
    const text = CJK.repeat(5_000_000);
    const started = performance.now();
    expect(runEnd(text, 0, IDENTIFIER_RUN)).toBe(text.length);
    expect(performance.now() - started).toBeLessThan(LIMIT_MS);
  });

  it("reads a run of 3,000,000 astral letters (6,000,000 code units) and stops at a following space", () => {
    const text = ASTRAL_LETTER.repeat(3_000_000) + " tail";
    const started = performance.now();
    expect(runEnd(text, 0, IDENTIFIER_RUN)).toBe(6_000_000);
    expect(performance.now() - started).toBeLessThan(LIMIT_MS);
  });

  it("isRun answers on the same lines", () => {
    expect(isRun(CJK.repeat(5_000_000), WORD_DASH_RUN)).toBe(true);
    expect(isRun(CJK.repeat(5_000_000) + " ", WORD_DASH_RUN)).toBe(false);
  });
});
