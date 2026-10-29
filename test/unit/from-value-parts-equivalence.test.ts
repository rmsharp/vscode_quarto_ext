import { describe, expect, it } from "vitest";
import { fromExtensionState, fromIsMarkdownBase, fromIsMarkdownVariant, fromReaderBase, fromValueParts } from "../../src/core/qmd/model";
import { LS, PS, countCodeUnitEdits, everyCodeUnitEdit, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 335 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (5). Three patterns read the extension list of a front matter `from:`, `(?:[+-][a-zA-Z_]+)*`,
// a group per token, and V8 keeps one entry of its regex backtrack stack per repetition of a group: a list of 3,355,428 or more tokens threw `RangeError: Maximum call stack size exceeded` (bisected at `c06ee06`), and
// the error reached every reader of the document. `fromValueParts` reads the same line with a loop and the three questions are asked of its answer. The three old patterns and the old `fromExtensionState` are kept
// below, copied from the parent `c06ee06` (`src/core/qmd/model.ts`), as the oracle (Learning 738); the pinned counts (how many lines of each enumeration the OLD patterns match) come from the old patterns and from a
// Python port of them and never from the code under test.

// ---- The OLD patterns and the OLD function, copied from the parent `c06ee06`. ----
const OLD_MARKDOWN_BASE_FROM = /^from[ \t]*:[ \t]*(["']?)markdown(?:[+-][a-zA-Z_]+)*\1[ \t]*(?:#.*)?$/;
const OLD_MARKDOWN_VARIANT_FROM = /^from[ \t]*:[ \t]*(["']?)markdown(?:_strict|_mmd|_phpextra|_github)(?:[+-][a-zA-Z_]+)*\1[ \t]*(?:#.*)?$/;
const OLD_FROM_READER_VALUE = /^from[ \t]*:[ \t]*(["']?)([a-zA-Z][a-zA-Z0-9_]*)((?:[+-][a-zA-Z_]+)*)\1[ \t]*(?:#.*)?$/;
function oldFromReaderBase(line: string): string | null {
  const m = OLD_FROM_READER_VALUE.exec(line);
  return m === null ? null : m[2];
}
function oldFromExtensionState(line: string, extension: string): boolean | null {
  const m = OLD_FROM_READER_VALUE.exec(line);
  if (m === null) {
    return null;
  }
  let state: boolean | null = null;
  for (const token of m[3].match(/[+-][a-zA-Z_]+/g) ?? []) {
    if (token.slice(1) === extension) {
      state = token[0] === "+";
    }
  }
  return state;
}

const EXTENSIONS_ASKED = ["blank_before_header", "line_blocks", "a", "_", "Z", ""];

type Count = { compared: number; reader: number; base: number; variant: number; onBlankBeforeHeader: number; offBlankBeforeHeader: number; disagreements: string[] };
/** Compare the new reading with the old patterns over `lines`: how many were compared, how many each OLD pattern matched, and the first few disagreements. */
function compareAll(lines: Iterable<string>, extensions: readonly string[] = EXTENSIONS_ASKED): Count {
  const count: Count = { compared: 0, reader: 0, base: 0, variant: 0, onBlankBeforeHeader: 0, offBlankBeforeHeader: 0, disagreements: [] };
  const note = (line: string, what: string): void => {
    if (count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: ${what}`);
    }
  };
  for (const line of lines) {
    count.compared++;
    const old = OLD_FROM_READER_VALUE.exec(line);
    const parts = fromValueParts(line);
    if (old !== null) {
      count.reader++;
    }
    if ((old === null) !== (parts === null)) {
      note(line, `old ${old === null ? "refuses" : "matches"}, now ${parts === null ? "refuses" : "matches"}`);
    } else if (old !== null && parts !== null && (parts.quote !== old[1] || parts.base !== old[2] || line.slice(parts.extensionStart, parts.extensionEnd) !== old[3])) {
      note(line, `parts ${JSON.stringify([parts.quote, parts.base, line.slice(parts.extensionStart, parts.extensionEnd)])}, old ${JSON.stringify([old[1], old[2], old[3]])}`);
    }
    const oldBase = OLD_MARKDOWN_BASE_FROM.test(line);
    const oldVariant = OLD_MARKDOWN_VARIANT_FROM.test(line);
    if (oldBase) {
      count.base++;
    }
    if (oldVariant) {
      count.variant++;
    }
    if (fromIsMarkdownBase(line) !== oldBase) {
      note(line, `markdown base: old ${oldBase}`);
    }
    if (fromIsMarkdownVariant(line) !== oldVariant) {
      note(line, `markdown variant: old ${oldVariant}`);
    }
    if (fromReaderBase(line) !== oldFromReaderBase(line)) {
      note(line, `reader base: old ${oldFromReaderBase(line)}, now ${fromReaderBase(line)}`);
    }
    for (const extension of extensions) {
      const expected = oldFromExtensionState(line, extension);
      if (fromExtensionState(line, extension) !== expected) {
        note(line, `extension ${JSON.stringify(extension)}: old ${expected}`);
      }
      if (extension === "blank_before_header") {
        if (expected === true) {
          count.onBlankBeforeHeader++;
        } else if (expected === false) {
          count.offBlankBeforeHeader++;
        }
      }
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

// ---- The enumerations. ----
const HEADS = ["from:", "from :", "from\t: ", "from:\t", "from:   ", "from", "fromm:", "From:", " from:", "from;"];
const QUOTES: Array<[string, string]> = [["", ""], ['"', '"'], ["'", "'"], ['"', ""], ["", '"'], ["'", '"'], ['"', "'"], ["'", ""], ["", "'"]];
const BASES = ["markdown", "markdown_mmd", "markdown_strict", "markdown_phpextra", "markdown_github", "markdown_x", "markdown2", "gfm", "commonmark_x", "a", "A9_", "9a", "_a", ""];
const TAILS = ["", " ", "\t", "  # c", "#c", " #", "# c\r", "#" + LS, "# c" + PS, " x", "!", '"', "'", "\n"];
const EXTENSION_TOKENS = ["+a", "-b", "+_", "-Z", "+", "-", "+1", "a", "_", "+line_blocks", "-line_blocks", "+blank_before_header", "-blank_before_header"];
function listsOfUpTo(tokens: number): string[] {
  let level = [""];
  const all = [""];
  for (let n = 1; n <= tokens; n++) {
    level = level.flatMap((prefix) => EXTENSION_TOKENS.map((token) => prefix + token));
    all.push(...level);
  }
  return all;
}
const LISTS_ONE = listsOfUpTo(1); // 14
const LISTS_THREE = listsOfUpTo(3); // 2,380

function* product(heads: readonly string[], quotes: ReadonlyArray<[string, string]>, bases: readonly string[], lists: readonly string[], tails: readonly string[]): Generator<string> {
  for (const head of heads) {
    for (const [open, close] of quotes) {
      for (const base of bases) {
        for (const list of lists) {
          for (const tail of tails) {
            yield `${head}${open}${base}${list}${close}${tail}`;
          }
        }
      }
    }
  }
}

// A seeded sample of longer lines: a head, then 0 to 10 pieces. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3353;
const PIECES = ["from: ", "from:", '"', "'", "markdown", "markdown_mmd", "gfm", "+blank_before_header", "-blank_before_header", "+line_blocks", "+", "-", "_", "a", "Z", "1", " ", "\t", "#", "# c", "\r", LS, "x"];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = next() < 0.7 ? "from: " : "from:";
    const parts = Math.floor(next() * 11);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 2));
    }
    yield text;
  }
}

// What each line is, stated by hand: [line, base or null, extension list or null, markdown base, markdown variant].
const STATED: Array<[string, string | null, string | null, boolean, boolean]> = [
  ["from: markdown", "markdown", "", true, false],
  ["from:markdown", "markdown", "", true, false],
  ["from : markdown+emoji-smart", "markdown", "+emoji-smart", true, false],
  ['from: "markdown+emoji"', "markdown", "+emoji", true, false],
  ["from: 'markdown'", "markdown", "", true, false],
  ['from: "markdown', null, null, false, false],
  ['from: markdown"', null, null, false, false],
  ["from: markdown_mmd+blank_before_header", "markdown_mmd", "+blank_before_header", false, true],
  ["from: markdown_strict", "markdown_strict", "", false, true],
  ["from: markdown_github # c", "markdown_github", "", false, true],
  ["from: markdown_x", "markdown_x", "", false, false],
  ["from: markdown2", "markdown2", "", false, false],
  ["from: markdown+a1", null, null, false, false],
  ["from: markdown+", null, null, false, false],
  ["from: markdown+-a", null, null, false, false],
  ["from: markdown++a", null, null, false, false],
  ["from: markdown +a", null, null, false, false],
  ["from: markdown#c", "markdown", "", true, false],
  ["from: markdown # c", "markdown", "", true, false],
  ["from: markdown # c\r", null, null, false, false],
  ["from: markdown # c" + LS, null, null, false, false],
  ["from: markdown\n", null, null, false, false],
  ["from: gfm", "gfm", "", false, false],
  ["from: 9a", null, null, false, false],
  ["from: ", null, null, false, false],
  ["from:", null, null, false, false],
  ["fromm: markdown", null, null, false, false],
  [" from: markdown", null, null, false, false],
  ["from", null, null, false, false],
  // Heads the enumeration does not build (the mutation run of Session 335 found them): any fourth character, several blanks on both sides of the colon, a line feed inside a comment.
  ["froX: markdown", null, null, false, false],
  ["fro: markdown", null, null, false, false],
  ["from  : markdown", "markdown", "", true, false],
  ["from \t :markdown", "markdown", "", true, false],
  ["from:  \t markdown", "markdown", "", true, false],
  ["from: markdown # c\n", null, null, false, false],
  ["from: markdown # c\nx", null, null, false, false],
  ["from: markdown   \t  # c", "markdown", "", true, false],
];

describe("Session 335 — fromValueParts: the loop reads a front matter `from:` line as the three old patterns did", () => {
  const ENUMERATIONS: Array<{ label: string; lines: () => Generator<string>; counts: Omit<Count, "disagreements"> }> = [
    {
      label: "10 heads x 9 quote pairs x 14 bases x 14 one-token lists x 14 tails",
      lines: () => product(HEADS, QUOTES, BASES, LISTS_ONE, TAILS),
      counts: { compared: 246_960, reader: 12_205, base: 900, variant: 3_600, onBlankBeforeHeader: 1_100, offBlankBeforeHeader: 1_100 },
    },
    {
      label: "2 heads x 9 quote pairs x 4 bases x every list of up to 3 tokens (2,380) x 6 tails",
      lines: () => product(["from: ", "from:"], QUOTES, ["markdown", "markdown_mmd", "gfm", "a"], LISTS_THREE, ["", " ", "#c", "!", '"', "'"]),
      counts: { compared: 1_028_160, reader: 105_160, base: 21_230, variant: 21_230, onBlankBeforeHeader: 20_856, offBlankBeforeHeader: 20_856 },
    },
  ];

  it.each(ENUMERATIONS.map((e) => [e.label, e] as const))("every line of %s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(e.lines());
    expect(disagreements).toEqual([]);
    expect(counts).toEqual(e.counts);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, reader: 24_860, base: 1_339, variant: 1_326, onBlankBeforeHeader: 1_405, offBlankBeforeHeader: 1_356 });
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, base, list, isBase, isVariant]) => [JSON.stringify(line), line, base, list, isBase, isVariant] as const))("%s is stated by hand, by the old patterns and by the new reading", (_label, line, base, list, isBase, isVariant) => {
    const old = OLD_FROM_READER_VALUE.exec(line);
    expect(old === null ? null : [old[2], old[3]]).toEqual(base === null ? null : [base, list]);
    expect([OLD_MARKDOWN_BASE_FROM.test(line), OLD_MARKDOWN_VARIANT_FROM.test(line)]).toEqual([isBase, isVariant]);
    const parts = fromValueParts(line);
    expect(parts === null ? null : [parts.base, line.slice(parts.extensionStart, parts.extensionEnd)]).toEqual(base === null ? null : [base, list]);
    expect([fromIsMarkdownBase(line), fromIsMarkdownVariant(line)]).toEqual([isBase, isVariant]);
  });

  it("the last token wins, in both directions, and an extension that is not in the list is left alone", () => {
    expect(fromExtensionState("from: markdown+a-a", "a")).toBe(false);
    expect(fromExtensionState("from: markdown-a+a", "a")).toBe(true);
    expect(fromExtensionState("from: markdown-blank_before_header+emoji+blank_before_header", "blank_before_header")).toBe(true);
    expect(fromExtensionState("from: markdown+emoji", "blank_before_header")).toBeNull();
    expect(fromExtensionState("from: markdown+blank_before_header_x", "blank_before_header")).toBeNull();
    expect(fromExtensionState("from: markdown+xblank_before_header", "blank_before_header")).toBeNull();
    expect(fromExtensionState("from: markdown+a", "")).toBeNull();
    expect(fromExtensionState("from: markdown+a!", "a")).toBeNull();
    expect(fromExtensionState("not a from line", "a")).toBeNull();
  });

  it("an extension name is looked for only in the list: not in the key, the base or the quote", () => {
    expect(fromExtensionState("from: markdown+a", "rom: markdown")).toBeNull();
    expect(fromExtensionState("from: markdown+a", "from: markdown")).toBeNull();
    expect(fromExtensionState("from: markdown+a", "markdown")).toBeNull();
    expect(fromExtensionState('from: "markdown+a"', "a")).toBe(true);
    expect(fromExtensionState("from: markdown+a", "a")).toBe(true);
  });

  // The kept answer is also what keeps a scan linear: one scan asks about the same line from some thirty places, and a value of 13.6 million characters read that often costs seconds (124 ms a read, 28 reads,
  // 3.5 s in the Outline of Session 335's first build). The same line asked 30 times must cost one read.
  it("the same 13.6 million character line asked about 30 times is read once", () => {
    const line = `from: markdown${"+_".repeat(6_800_000)}`;
    const started = Date.now();
    for (let i = 0; i < 10; i++) {
      expect(fromIsMarkdownBase(line)).toBe(true);
      expect(fromIsMarkdownVariant(line)).toBe(false);
      expect(fromReaderBase(line)).toBe("markdown");
    }
    expect(Date.now() - started).toBeLessThan(1000);
  });

  // The last answer is kept, and a kept answer must not outlive its line: interleave other lines, ask for the same text as a different string object, and ask again.
  it("a kept answer is never served for another line", () => {
    const lines = ["from: gfm", "from: markdown+a", "from: gfm", "from: markdown_mmd-b", "from: markdown_mmd-b", "from: markdown_mmd-c", "not from", "from: markdown+a"];
    for (const line of lines) {
      expect(fromReaderBase(line)).toBe(oldFromReaderBase(line));
      expect(fromExtensionState(line, "a")).toBe(oldFromExtensionState(line, "a"));
      expect(fromIsMarkdownBase(line)).toBe(OLD_MARKDOWN_BASE_FROM.test(line));
    }
    const first = fromValueParts("from: markdown+a");
    const copy = fromValueParts(["from: ", "markdown", "+a"].join(""));
    expect(copy).toEqual(first);
    expect(fromValueParts("from: markdown_mmd+a")).not.toEqual(first);
    expect(fromValueParts("from: markdown+a")).toEqual(first);
  });

  // The cure itself: a list past the old overflow (3,355,428 tokens of `+_`) is read, and the list is the whole run. The old patterns are compared only below that, where they still read.
  const SMALL_LISTS = [1, 2, 3, 100, 4_096, 65_536, 1_000_000, 3_000_000];
  const LONG_LISTS = [3_355_428, 3_400_000, 6_800_000, 22_000_000];
  it.each(SMALL_LISTS)("a list of %i tokens of `+_` and of `-Z` gives the old answer", (n) => {
    for (const unit of ["+_", "-Z"]) {
      for (const [head, tail] of [["from: markdown", ""], ["from: markdown_mmd", "  # why"], ['from: "markdown', '"'], ["from: markdown", "!"]]) {
        const line = head + unit.repeat(n) + tail;
        const old = OLD_FROM_READER_VALUE.exec(line);
        const parts = fromValueParts(line);
        expect(parts === null).toBe(old === null);
        if (old !== null && parts !== null) {
          expect([parts.quote, parts.base, parts.extensionEnd - parts.extensionStart]).toEqual([old[1], old[2], old[3].length]);
        }
        expect(fromIsMarkdownBase(line)).toBe(OLD_MARKDOWN_BASE_FROM.test(line));
        expect(fromIsMarkdownVariant(line)).toBe(OLD_MARKDOWN_VARIANT_FROM.test(line));
      }
    }
  }, HEAVY_ROW_MS);

  it.each(LONG_LISTS)("a list of %i tokens of `+_` is read: the base, the whole list, the closing quote, the comment and the last token", (n) => {
    const list = "+_".repeat(n);
    const parts = fromValueParts(`from: "markdown${list}"  # why`);
    expect(parts).not.toBeNull();
    expect([parts!.quote, parts!.base, parts!.extensionEnd - parts!.extensionStart]).toEqual(['"', "markdown", 2 * n]);
    expect(fromValueParts(`from: markdown${list}!`)).toBeNull();
    expect(fromValueParts(`from: markdown${list}# c\r`)).toBeNull();
    expect(fromValueParts(`from: markdown${list}+`)).toBeNull();
    expect(fromIsMarkdownBase(`from: markdown${list}`)).toBe(true);
    expect(fromIsMarkdownVariant(`from: markdown_mmd${list}`)).toBe(true);
    expect(fromExtensionState(`from: markdown${list}-blank_before_header`, "blank_before_header")).toBe(false);
    expect(fromExtensionState(`from: markdown+blank_before_header${list}`, "blank_before_header")).toBe(true);
    expect(fromExtensionState(`from: markdown${list}`, "blank_before_header")).toBeNull();
  }, HEAVY_ROW_MS);

  it("a list of 22,000,000 tokens is read in linear time (the line is 44 million characters)", () => {
    const line = `from: markdown${"+_".repeat(22_000_000)}`;
    const started = Date.now();
    expect(fromValueParts(line)).not.toBeNull();
    expect(fromExtensionState(line, "x")).toBeNull();
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

// The review round of Session 335 (its mutation lens): twenty edits of the reader survived every row above, because the alphabets of the heads, the bases, the tokens and the tails hold no form feed, vertical tab, no-break
// space or next-line character, no `[`, `@` or backtick next to the letter ranges, no `z` and no lower case in a base. A blank class widened by one character, a letter class widened or narrowed by one, a comment that ends at a
// character the old `.` takes, a slash inside a base, a base compared without its case: each changes the Outline of a document whose `from:` the line is. Every UTF-16 code unit is put into each head and in place of each of
// its characters. The memo is pinned the same way: its key was only the line's length and its last 4,096 characters in one edit, and a null answer was not kept in another.
describe("Session 335 review — fromValueParts on every code unit, and the memo's key and its null answer", () => {
  const SWEEP_HEADS = ["from: markdown+az", "from:\t'markdown_mmd-AZ' #c", "from : gfm\t"];
  it("every head with one code unit put into it, or in place of one of its characters, is read as the old patterns read it", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnitEdit(SWEEP_HEADS), ["blank_before_header", "a", "z"]);
    expect(disagreements).toEqual([]);
    // Recounted by a Python port of the three old patterns and of the sweep (7,274,496 lines). No head holds `blank_before_header`, so the extension counters stay at nothing: the extension states are compared, line for line.
    expect(counts).toEqual({ compared: countCodeUnitEdits(SWEEP_HEADS), reader: 200_619, base: 303, variant: 196_902, onBlankBeforeHeader: 0, offBlankBeforeHeader: 0 });
  }, HEAVY_ROW_MS);

  const REVIEW_STATED: Array<[string, string | null, boolean, boolean]> = [
    // line, base or null, markdown base, markdown variant
    ["from: MARKDOWN", "MARKDOWN", false, false],
    ["from: Markdown+a", "Markdown", false, false],
    ["from: markdown_MMD", "markdown_MMD", false, false],
    ["from: markdown/x", null, false, false],
    ["from: markdown+zebra", "markdown", true, false],
    ["from: markdown+Zebra-yak_Z", "markdown", true, false],
    ["from: markdown+a[b", null, false, false],
    ["from: markdown+a@b", null, false, false],
    ["from: markdown+a`b", null, false, false],
    ["from: markdown+a{b", null, false, false],
    ["from:\fmarkdown", null, false, false],
    ["from:\vmarkdown", null, false, false],
    ["from:" + String.fromCharCode(0xa0) + "markdown", null, false, false],
    ["from\f: markdown", null, false, false],
    ["from: markdown\f", null, false, false],
    ["from: markdown # c\fd", "markdown", true, false],
    ["from: markdown # c\vd", "markdown", true, false],
    ["from: markdown # c" + String.fromCharCode(0x85) + "d", "markdown", true, false],
    ["from: markdown # c" + String.fromCharCode(0xa0) + "d", "markdown", true, false],
    ["from: markdown # c" + String.fromCharCode(0x2027) + "d", "markdown", true, false],
    ["from: markdown # c" + String.fromCharCode(0x202a) + "d", "markdown", true, false],
    ["from: markdown # c\0d", "markdown", true, false],
  ];
  it.each(REVIEW_STATED.map(([line, base, isBase, isVariant]) => [JSON.stringify(line), line, base, isBase, isVariant] as const))("%s is stated by hand, by the old patterns and by the new reading", (_label, line, base, isBase, isVariant) => {
    expect(oldFromReaderBase(line)).toBe(base);
    expect([OLD_MARKDOWN_BASE_FROM.test(line), OLD_MARKDOWN_VARIANT_FROM.test(line)]).toEqual([isBase, isVariant]);
    expect(fromReaderBase(line)).toBe(base);
    expect([fromIsMarkdownBase(line), fromIsMarkdownVariant(line)]).toEqual([isBase, isVariant]);
  });

  it("two lines of the same length with the same last 4,096 characters are two answers", () => {
    const tail = "+_".repeat(3000);
    const a = `from: markdown${tail}`;
    const b = `from: gfm_____${tail}`;
    expect(a.length).toBe(b.length);
    expect(a.slice(-4096)).toBe(b.slice(-4096));
    for (const line of [a, b, a, b]) {
      expect(fromReaderBase(line)).toBe(oldFromReaderBase(line));
      expect(fromIsMarkdownBase(line)).toBe(OLD_MARKDOWN_BASE_FROM.test(line));
    }
    expect([fromReaderBase(a), fromReaderBase(b)]).toEqual(["markdown", "gfm_____"]);
  });

  // A line that is no reader value (a character that ends the list) is the line a scan asks about from thirty places, as much as any other; its answer, null, is kept as well. The clock is a ratio, so a loaded
  // machine cannot fake it: the first read of a 4-million-character line costs some milliseconds, the next thirty ask nothing more.
  it("a line that is no reader value is read once, however often it is asked about", () => {
    const line = `from: markdown${"+_".repeat(2_000_001)}!`;
    const firstStarted = performance.now();
    expect(fromValueParts(line)).toBeNull();
    const first = performance.now() - firstStarted;
    const restStarted = performance.now();
    for (let i = 0; i < 10; i++) {
      expect(fromReaderBase(line)).toBeNull();
      expect(fromIsMarkdownBase(line)).toBe(false);
      expect(fromExtensionState(line, "blank_before_header")).toBeNull();
    }
    const rest = performance.now() - restStarted;
    expect(rest).toBeLessThan(first * 5 + 50);
  });
});
