import { describe, expect, it } from "vitest";
import { blankQuotedStrings } from "../../src/core/qmd/model";
import { LS, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part (7). `knitrHeaderOptions` judges each UNNAMED argument of a knitr chunk header (a label, a number, a string, a
// call) after blanking its strings, with the global replace `segment.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')` (`model.ts`, near line 8805), and V8 keeps one entry of its regex backtrack stack per repetition
// of a group: a string of 8,388,574 or more characters (or `\a` pairs: one repetition a pair) threw `RangeError: Maximum call stack size exceeded` (bisected at `8ebce73`, a fresh process per probe, the lower bound
// 8,388,573 verified to read), and the error reached every reader of the document that was handed the knitr engine. `blankQuotedStrings` is the same replacement read by a loop over the UTF-16 code units. The old
// pattern is kept below, copied from the parent `8ebce73`, as the oracle (Learning 738), beside a reading by definition that uses no regex; the pinned counts come from the old pattern, from a Python port of it and
// of the definition (`tools/knitr-string-mask-count/count_masked.py`, run with `python3 -I`, no code shared with the TypeScript) and never from the code under test.

// ---- The OLD pattern and its use, copied from the parent `8ebce73`. ----
const OLD_STRING_MASK = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
const oldMask = (text: string): string => text.replace(OLD_STRING_MASK, '""');
/** How many strings the old pattern blanks in `text`, and how many characters they hold (the same matches, read through a replacer). */
function oldBlanked(text: string): { blanked: number; characters: number } {
  let blanked = 0;
  let characters = 0;
  text.replace(OLD_STRING_MASK, (whole) => {
    blanked++;
    characters += whole.length;
    return '""';
  });
  return { blanked, characters };
}

// ---- A reading of the old pattern by DEFINITION, with no regular expression. A string is a quote, then items, then the SAME quote; an item is a character that is neither that quote nor a backslash, or a backslash and
// one character that is no line terminator (`.` does not match a line feed, a carriage return, U+2028 or U+2029). The ends a string at `start` can have are found by walking the positions the items can reach (the
// language is unambiguous: a closing quote is no item, so there is one end at most). The scan blanks the string that starts at the first quote it meets, goes on after it, and skips a quote that opens none. ----
const LINE_TERMINATORS: ReadonlySet<string> = new Set(["\n", "\r", LS, PS]);
function stringEnds(text: string, start: number): number[] {
  const quote = text[start];
  const reached = new Set<number>([start + 1]);
  const ends: number[] = [];
  for (let at = start + 1; at < text.length; at++) {
    if (!reached.has(at)) {
      continue;
    }
    const c = text[at];
    if (c === quote) {
      ends.push(at + 1);
    } else if (c === "\\") {
      if (at + 1 < text.length && !LINE_TERMINATORS.has(text[at + 1])) {
        reached.add(at + 2);
      }
    } else {
      reached.add(at + 1);
    }
  }
  return ends;
}
function definitionMask(text: string): string {
  let out = "";
  let at = 0;
  while (at < text.length) {
    if (text[at] === '"' || text[at] === "'") {
      const ends = stringEnds(text, at);
      if (ends.length > 1) {
        throw new Error(`the language is ambiguous at ${at} of ${JSON.stringify(text)}`);
      }
      if (ends.length === 1) {
        out += '""';
        at = ends[0];
        continue;
      }
    }
    out += text[at];
    at++;
  }
  return out;
}

type Count = { compared: number; changed: number; blanked: number; characters: number; disagreements: string[] };
/** Compare the new function with the old pattern and the reading by definition over `texts`: how many were compared, in how many the old pattern blanked a string, how many strings it blanked and how many characters those held. */
function compareAll(texts: Iterable<string>): Count {
  const count: Count = { compared: 0, changed: 0, blanked: 0, characters: 0, disagreements: [] };
  for (const text of texts) {
    const expected = oldMask(text);
    const { blanked, characters } = oldBlanked(text);
    count.compared++;
    if (blanked > 0) {
      count.changed++;
    }
    count.blanked += blanked;
    count.characters += characters;
    const now = blankQuotedStrings(text);
    const byDefinition = definitionMask(text);
    if ((now !== expected || byDefinition !== expected) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(text)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}, by definition ${JSON.stringify(byDefinition)}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

// The two alphabets: twelve characters up to length 5 (both quotes, the backslash, a letter, a blank, a comma, a paren, `=` and the four line terminators LF, CR, U+2028 and U+2029, each of which a backslash cannot
// take), and five up to length 9 (both quotes, the backslash, a letter and U+2028) that reach the long tangles of quotes and backslashes, a failed read among them.
const WIDE = ['"', "'", "\\", "a", " ", ",", "(", "=", LS, "\n", "\r", PS];
const NARROW = ['"', "'", "\\", "a", LS];
const ENUMERATIONS: Array<{ label: string; alphabet: readonly string[]; maxLength: number; changed: number; blanked: number; characters: number }> = [
  { label: "12 characters (both quotes, a backslash, a letter, a blank, `,`, `(`, `=`, LS, LF, CR, PS), up to 5", alphabet: WIDE, maxLength: 5, changed: 28_650, blanked: 28_868, characters: 83_344 },
  { label: "5 characters (both quotes, a backslash, a letter, U+2028), up to 9", alphabet: NARROW, maxLength: 9, changed: 1_812_084, blanked: 2_316_962, characters: 8_235_364 },
];

// The sweep: every UTF-16 code unit at every structural position of a string token, for both quotes: before the string, as the whole body, inside, right after a backslash (with and without more body), right after an
// escaped character, right after an escaped backslash, at the end of an unterminated string, right after the closer, between two strings, before plain text, inside the other quote, before a backslash-quote outside any
// string, right after a backslash outside any string, and after the trailing backslash of an unterminated string (Learning 887).
function sweepTemplates(): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const [q, o] of [['"', "'"], ["'", '"']] as const) {
    pairs.push(
      ["", q + "ab" + q],
      [q, q],
      [q + "a", "b" + q],
      [q + "a\\", q],
      [q + "a\\", "b" + q],
      [q + "a\\b", q],
      [q + "a\\\\", q],
      [q + "a", ""],
      [q + "a" + q, ""],
      [q + "a" + q, q + "b" + q],
      [q + "a" + q, "b"],
      [q + "a" + o, o + q],
      ["", "\\" + q + "a" + q],
      ["\\", q + "a" + q],
      [q + "\\", ""],
    );
  }
  return pairs;
}
function* everyCodeUnit(): Generator<string> {
  for (const [before, after] of sweepTemplates()) {
    for (let code = 0; code < 0x10000; code++) {
      yield before + String.fromCharCode(code) + after;
    }
  }
}
const SWEEP_COUNTS = { compared: 1_966_080, changed: 1_703_916, blanked: 1_834_988, characters: 7_733_118 };

// A seeded sample of longer texts: 0 to 12 pieces, each repeated one to three times. The seed is written beside the counts it produces (Learning 791). These counts come from the old pattern alone.
const SEEDED_COUNT = 300_000;
const SEED = 3370;
const PIECES = ['"', "'", "\\", "a", " ", ",", LS, "\n", "\r", '\\"', "\\'", '"ab"', "'cd'", "\\\\", '"a\\"', "'b\\'", "(", "="];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = "";
    const parts = Math.floor(next() * 13);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield text;
  }
}

// What each text blanks to, stated by hand.
const STATED: Array<[string, string]> = [
  ["", ""],
  ["abc", "abc"],
  ['"x"', '""'],
  ["'x'", '""'],
  ['""', '""'],
  ["''", '""'],
  ['"x" \'y\'', '"" ""'],
  ['"x"y"z"', '""y""'],
  ["\"a'b\"", '""'],
  ["'a\"b'", '""'],
  ['"a\\"b"', '""'],
  ["'a\\'b'", '""'],
  ['"a\\\\"', '""'],
  ['"a\\\\"b"', '""b"'],
  ['"abc', '"abc'],
  ["'abc", "'abc"],
  ["\"abc'def'ghi", '"abc""ghi'],
  ["'abc\"def\"ghi", "'abc\"\"ghi"],
  ['"', '"'],
  ["'", "'"],
  ['"\\', '"\\'],
  ['"a\\"', '"a\\"'],
  ['\\"a"', '\\""'],
  ["\\'a'", '\\""'],
  ['a"b"c', 'a""c'],
  ['"""', '"""'],
  ['""""', '""""'],
  // a backslash before a line terminator is no escape: the string that holds it does not close, the scan goes on at the next character, and the quote after it pairs with the next one
  ['"a\\' + LS + '"', '"a\\' + LS + '"'],
  ['"a\\' + LS + 'b" "c"', '"a\\' + LS + 'b""c"'],
  ['"a\\\n"', '"a\\\n"'],
  ['"a\\\r"', '"a\\\r"'],
  ['"a\\' + PS + '"', '"a\\' + PS + '"'],
  // a line terminator itself is an ordinary character of the string
  ['"a\nb"', '""'],
  ['"a\rb"', '""'],
  ['"a' + LS + 'b"', '""'],
  ['"a' + PS + 'b"', '""'],
  // what a header holds: a bare string, a call, a comma, a bracket and an equals sign are all inside the string
  ['"a, (b) = c"', '""'],
  ['c("a", \'b\')', 'c("", "")'],
  ["fig.cap=\"a b\"", 'fig.cap=""'],
];

describe("Session 337 — blankQuotedStrings: the loop blanks the strings where `/\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'/g` did", () => {
  it.each(ENUMERATIONS.map((e) => [`every text of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(everyString(e.alphabet, e.maxLength));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countStrings(e.alphabet.length, e.maxLength), changed: e.changed, blanked: e.blanked, characters: e.characters });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at every structural position of a string token, for both quotes", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnit());
    expect(disagreements).toEqual([]);
    expect(counts).toEqual(SWEEP_COUNTS);
    expect(counts.compared).toBe(sweepTemplates().length * 0x10000);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, changed: 217_591, blanked: 766_918, characters: 3_415_389 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([text, blank]) => [JSON.stringify(text), text, blank] as const))("%s blanks to the stated text by hand, by the old pattern, by the definition and by the new function", (_label, text, blank) => {
    expect(oldMask(text)).toBe(blank);
    expect(definitionMask(text)).toBe(blank);
    expect(blankQuotedStrings(text)).toBe(blank);
  });

  // The cure itself: a string past the old overflow (8,388,574 repetitions) is read. The old pattern is compared only below that, where it still reads.
  const SMALL_RUNS = [1, 2, 3, 100, 4_096, 65_536, 1_000_000, 8_000_000];
  const unitsFor = (quote: string): string[] => ["b", "\\a", "\\" + quote, "\\\\", quote === '"' ? "'" : '"'];
  it.each(SMALL_RUNS)("a string of %i repetitions of five units blanks where the old pattern did, with and without a tail", (n) => {
    for (const quote of ['"', "'"]) {
      for (const unit of unitsFor(quote)) {
        const tails = n > 1_000_000 ? ["", "x"] : ["", "x", " 'y'", '"z', "\\", quote + quote];
        for (const tail of tails) {
          const text = quote + unit.repeat(n) + quote + tail;
          expect(blankQuotedStrings(text)).toBe(oldMask(text));
        }
      }
    }
  }, HEAVY_ROW_MS);

  const LONG_RUNS = [8_388_574, 8_400_000, 16_800_000, 45_000_000];
  it.each(LONG_RUNS)("a string of %i repetitions is blanked, whatever surrounds it", (n) => {
    expect(blankQuotedStrings('"' + "b".repeat(n) + '"')).toBe('""');
    expect(blankQuotedStrings("'" + "b".repeat(n) + "'")).toBe('""');
    expect(blankQuotedStrings('a, "' + "b".repeat(n) + '", c')).toBe('a, "", c');
    expect(blankQuotedStrings('"' + "\\a".repeat(n) + '"')).toBe('""'); // `\a` pairs: one repetition a pair
    expect(blankQuotedStrings("'" + '"'.repeat(n) + "'")).toBe('""'); // the other quote is an ordinary character
    expect(blankQuotedStrings('c("' + "b".repeat(n) + '") x')).toBe('c("") x');
    // a string that never closes blanks nothing and returns the text itself
    const open = '"' + "b".repeat(n);
    expect(blankQuotedStrings(open)).toBe(open);
    expect(blankQuotedStrings(open + "'c'")).toBe(open + '""'); // the scan goes on after the failed read: the later string is blanked
  }, HEAVY_ROW_MS);

  it("a text with no quote is returned as it is", () => {
    const text = "a, b = c(d), e.f";
    expect(blankQuotedStrings(text)).toBe(text);
  });

  it("a million strings are blanked in linear time (the text is 4 million characters)", () => {
    const text = '"a" '.repeat(1_000_000);
    const started = Date.now();
    expect(blankQuotedStrings(text)).toBe('"" '.repeat(1_000_000));
    expect(Date.now() - started).toBeLessThan(3000);
  });

  // The old pattern restarts a failed read at every escaped quote after the opener (a quote met as a token would have closed the string, so each one is the second character of a pair): 100,000 pairs took it 13.7 s,
  // measured at `8ebce73` with a backslash and U+2028 after them. A chunk header cannot hold this text (an open string is declined before the mask, and the opener line holds no line terminator), so it is reached through
  // the function alone; the answer is the old pattern's, no string blanked and the text back, and the read is linear because the place a failed read stopped is kept per quote kind.
  const ESCAPED_QUOTES = 100_000;
  it.each([
    ["a double-quoted string cut off by a backslash and U+2028", '"', '\\"', "\\" + LS + '"'],
    ["a single-quoted string cut off by a backslash and U+2028", "'", "\\'", "\\" + LS + "'"],
    ["a double-quoted string that never closes", '"', '\\"', ""],
    ["a single-quoted string that never closes", "'", "\\'", ""],
  ])("%s, after 100,000 escaped quotes, is read in linear time and nothing is blanked", (_label, quote, pair, tail) => {
    const text = quote + pair.repeat(ESCAPED_QUOTES) + tail;
    expect(text.length).toBeGreaterThan(200_000);
    const started = Date.now();
    expect(blankQuotedStrings(text)).toBe(text);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("compares the old pattern only below its overflow and reads past it", () => {
    expect(Math.max(...SMALL_RUNS)).toBeLessThan(8_388_574);
    expect(Math.min(...LONG_RUNS)).toBeGreaterThanOrEqual(8_388_574);
  });
});
