import { describe, expect, it } from "vitest";
import { attributeKeyValue } from "../../src/core/qmd/model";
import { JS_WHITESPACE, LS, NBSP, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 336 — the BACKLOG item "Three more single-line shapes found by Session 335's review round", part (2). One token of a heading, fence, div, image or span attribute block, `key=value`, was tested with
// `^[A-Za-z][^\s}#\\=]*=(?:"[^"]*"|'[^']*'|(?:\\ |[^\s}])*)$` (`ATTR_KEY_VALUE`), and the bare value's `(?:\\ |[^\s}])*` is a group per character: V8 keeps one entry of its regex backtrack stack per repetition, so
// a bare value of 8,388,573 characters (or that many `\ ` pairs, one repetition each) threw `RangeError: Maximum call stack size exceeded` (bisected at `aea22f6`, a fresh process per probe), and the error reached
// every reader of the document. `attributeKeyValue` is the same question read by a loop. The old pattern is kept below, copied from the parent `aea22f6`, as the oracle (Learning 738), beside a reading by definition
// that uses no regex; the pinned counts come from the old pattern and from a Python port of the definition (with `\s` spelled out as ECMAScript's set, which Python's is not) and never from the code under test.

// ---- The OLD pattern, copied from the parent `aea22f6`. ----
const OLD_KEY_VALUE = /^[A-Za-z][^\s}#\\=]*=(?:"[^"]*"|'[^']*'|(?:\\ |[^\s}])*)$/;

// ---- A reading of the old pattern by DEFINITION, with no regular expression. A letter, then a key up to the first white space (as the specification lists it), `}`, `#`, `\` or `=`, which must be `=`; then a value that
// is either quoted (the same quote at both ends and none between, anything inside) or bare (no `}`, and white space only as a space that follows a backslash, which is then a pair). ----
const LETTER = /[A-Za-z]/;
function definition(token: string): boolean {
  if (token.length === 0 || !LETTER.test(token[0])) {
    return false;
  }
  let at = 1;
  while (at < token.length && !JS_WHITESPACE.has(token[at]) && !"}#\\=".includes(token[at])) {
    at++;
  }
  if (token[at] !== "=") {
    return false;
  }
  const value = token.slice(at + 1);
  for (const quote of ['"', "'"]) {
    if (value.length >= 2 && value[0] === quote && value[value.length - 1] === quote && !value.slice(1, -1).includes(quote)) {
      return true;
    }
  }
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "}") {
      return false;
    }
    if (JS_WHITESPACE.has(value[i]) && !(value[i] === " " && i > 0 && value[i - 1] === "\\")) {
      return false;
    }
  }
  return true;
}

type Count = { compared: number; accepted: number; disagreements: string[] };
/** Compare the new function with the old pattern and the reading by definition over `tokens`: how many were compared and how many the old pattern accepted. */
function compareAll(tokens: Iterable<string>): Count {
  const count: Count = { compared: 0, accepted: 0, disagreements: [] };
  for (const token of tokens) {
    count.compared++;
    const expected = OLD_KEY_VALUE.test(token);
    if (expected) {
      count.accepted++;
    }
    const now = attributeKeyValue(token);
    const byDefinition = definition(token);
    if ((now !== expected || byDefinition !== expected) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(token)}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

const PIECES = ["a", "=", '"', "'", "\\", " ", "}", "#", "\t", NBSP, "1", "b"];
const CHARS = ["a", "=", '"', "\\", " ", "}", "'"];
const VALUE_CHARS = ["b", '"', "'", "\\", " ", "}", "#", "="];
const ENUMERATIONS: Array<{ label: string; prefix: string; alphabet: readonly string[]; maxLength: number; accepted: number }> = [
  { label: "12 pieces (a letter, `=`, both quotes, a backslash, a blank, `}`, `#`, a tab, a no-break space, a digit, a letter), up to 6", prefix: "", alphabet: PIECES, maxLength: 6, accepted: 23_382 },
  { label: "7 characters (a letter, `=`, a double quote, a backslash, a blank, `}`, a single quote), up to 7", prefix: "", alphabet: CHARS, maxLength: 7, accepted: 10_700 },
  { label: "`a=` and 8 characters (a letter, both quotes, a backslash, a blank, `}`, `#`, `=`), up to 7", prefix: "a=", alphabet: VALUE_CHARS, maxLength: 7, accepted: 422_664 },
];

// Every UTF-16 code unit at every place of seven tokens that are, or nearly are, a `key=value` pair: in the key, at the `=`, in a bare value, in a quoted one, after a backslash.
const HEADS = ["a=b", "ab=cd", 'a="b c"', "a='b'", "a=b\\ c", "a=\\ ", "a="];

// A seeded sample: a key (valid or not), `=` (nine times in ten) and 0 to 5 pieces of value, quoted three times in ten (the closing quote missing one time in five). The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3362;
const KEYS = ["a", "key", "k1", "Z", "1k", "k#", "k\\", "k ", "k}", "k-e_y", "x.y", ""];
const VALUE_PIECES = ["b", " ", "\\", "\\ ", '"', "'", "}", "#", "=", "x y", NBSP, LS, "\t", "\n", "\r", "bb"];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = KEYS[Math.floor(next() * KEYS.length)] + (next() < 0.9 ? "=" : "");
    const quoted = next() < 0.3;
    const quote = next() < 0.5 ? '"' : "'";
    let value = "";
    const parts = Math.floor(next() * 6);
    for (let part = 0; part < parts; part++) {
      value += VALUE_PIECES[Math.floor(next() * VALUE_PIECES.length)].repeat(1 + Math.floor(next() * 2));
    }
    text += quoted ? quote + value + (next() < 0.8 ? quote : "") : value;
    yield text;
  }
}

// What each token is, stated by hand: [token, accepted].
const STATED: Array<[string, boolean]> = [
  ["a=b", true],
  ["a=", true],
  ["a=b c", false],
  ["a=b\\ c", true],
  ["a=\\ ", true],
  ["a=\\  ", false],
  ["a=\\\tb", false],
  ["a=\\", true],
  ["a=\\\\ b", true],
  ['a="b c"', true],
  ["a='b c'", true],
  ['a=""', true],
  ["a=''", true],
  ['a="b', true],
  ['a=b"', true],
  ['a="b"c"', true],
  ['a="b c', false],
  ["a='b c", false],
  ['a="', true],
  ['a="b' + NBSP + '"', true],
  ['a="\n"', true],
  ["a=b}", false],
  ["a=}", false],
  ['a="b}"', true],
  ["a={", true],
  ["a=#", true],
  ["a==b", true],
  ["a=b=c", true],
  ["ab=c#d", true],
  ["1a=b", false],
  ["=b", false],
  ["a", false],
  ["", false],
  ["a b=c", false],
  ["a#=b", false],
  ["a\\=b", false],
  ["a}=b", false],
  ["a" + NBSP + "=b", false],
  ["a=b\nc", false],
  ["a=b\tc", false],
  ["a=b" + NBSP, false],
  ["a=b" + LS, false],
  ['a=b "c"', false],
  ["a=\\ b\\ c\\ ", true],
];

describe("Session 336 — attributeKeyValue: the loop accepts a `key=value` token where `^[A-Za-z][^\\s}#\\\\=]*=(?:\"[^\"]*\"|'[^']*'|(?:\\\\ |[^\\s}])*)$` did", () => {
  it.each(ENUMERATIONS.map((e) => [`every token of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll((function* () {
      for (const s of everyString(e.alphabet, e.maxLength)) {
        yield e.prefix + s;
      }
    })());
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: countStrings(e.alphabet.length, e.maxLength), accepted: e.accepted });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at every place of seven near-pair tokens", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnitEdit(HEADS));
    expect(disagreements).toEqual([]);
    expect(counts.compared).toBe(countCodeUnitEdits(HEADS));
    expect(counts).toEqual({ compared: 4_653_056, accepted: 2_752_398 });
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded tokens (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, accepted: 63_157 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([token, accepted]) => [JSON.stringify(token), token, accepted] as const))("%s is accepted: %s, by hand, by the old pattern, by the definition and by the new function", (_label, token, accepted) => {
    expect(OLD_KEY_VALUE.test(token)).toBe(accepted);
    expect(definition(token)).toBe(accepted);
    expect(attributeKeyValue(token)).toBe(accepted);
  });

  // The cure itself: a value past the old overflow (8,388,573 repetitions) is read. The old pattern is compared only below that, where it still reads.
  const SMALL_RUNS = [1, 2, 100, 4_096, 65_536, 1_000_000, 8_000_000];
  const LONG_RUNS = [8_388_573, 8_400_000, 17_000_000];
  it.each(SMALL_RUNS)("a value of %i units (characters, or the pair `\\ `, or a quote) is accepted where the old pattern accepted it, with and without a tail", (n) => {
    for (const unit of ["b", "\\ ", "\\", '"', "#"]) {
      for (const tail of ["", "}", " ", "\t", "x", "\\ ", "\\", '"', "'", "=", " b", "\\ b", "\\\\ "]) {
        for (const head of ["a=", "a='", 'a="', "a= ", "a=b"]) {
          const token = head + unit.repeat(n) + tail;
          expect(attributeKeyValue(token)).toBe(OLD_KEY_VALUE.test(token));
        }
      }
    }
  }, HEAVY_ROW_MS);

  it.each(LONG_RUNS)("a value of %i characters is read, whatever follows", (n) => {
    const run = "b".repeat(n);
    expect(attributeKeyValue("a=" + run)).toBe(true);
    expect(attributeKeyValue("a=" + run + "}")).toBe(false);
    expect(attributeKeyValue("a=" + run + " ")).toBe(false);
    expect(attributeKeyValue("a=" + run + "\\ ")).toBe(true);
    expect(attributeKeyValue("a=" + run + "\\  ")).toBe(false);
    expect(attributeKeyValue("a=" + run + " b")).toBe(false);
    expect(attributeKeyValue("a=" + run + "\\ " + run)).toBe(true);
    expect(attributeKeyValue("a=" + run + NBSP)).toBe(false);
    expect(attributeKeyValue("a=" + run + "\\" + NBSP)).toBe(false);
    expect(attributeKeyValue('a="' + run + '"')).toBe(true);
    expect(attributeKeyValue('a="' + run + " " + run + '"')).toBe(true);
    expect(attributeKeyValue('a="' + run)).toBe(true);
    expect(attributeKeyValue('a="' + run + " " + run)).toBe(false);
    expect(attributeKeyValue('a="' + run + '"' + run + '"')).toBe(true);
    expect(attributeKeyValue("a='" + run + "'")).toBe(true);
    expect(attributeKeyValue("a=" + run + "=" + run)).toBe(true);
    expect(attributeKeyValue("a" + run + "=b")).toBe(true);
    expect(attributeKeyValue("a" + run + " =b")).toBe(false);
    expect(attributeKeyValue("a" + run)).toBe(false);
  }, HEAVY_ROW_MS);

  it.each(LONG_RUNS.map((n) => Math.ceil(n / 2) + 1))("%i escaped blanks `\\ ` in a row are read (one repetition a pair)", (n) => {
    const pairs = "\\ ".repeat(n);
    expect(attributeKeyValue("a=" + pairs)).toBe(true);
    expect(attributeKeyValue("a=" + pairs + "}")).toBe(false);
    expect(attributeKeyValue("a=" + pairs + " ")).toBe(false);
    expect(attributeKeyValue("a=" + pairs + "x")).toBe(true);
    expect(attributeKeyValue("a= " + pairs)).toBe(false);
    expect(attributeKeyValue('a="' + pairs + '"')).toBe(true);
    expect(attributeKeyValue("a=" + pairs.replace(/\\/g, ""))).toBe(false);
  }, HEAVY_ROW_MS);

  it("a value of 45,000,000 characters is read in linear time", () => {
    const run = "b".repeat(45_000_000);
    const pairs = "\\ ".repeat(22_500_000);
    const started = Date.now();
    expect(attributeKeyValue("a=" + run)).toBe(true);
    expect(attributeKeyValue("a=" + pairs)).toBe(true);
    expect(attributeKeyValue('a="' + run + '"')).toBe(true);
    expect(attributeKeyValue("a=" + run + "}")).toBe(false);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
