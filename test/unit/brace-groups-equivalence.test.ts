import { describe, expect, it } from "vitest";
import { braceGroups, type BraceGroup } from "../../src/core/qmd/model";
import { countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 326 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (3), and the `{` half of part (6) of the item "What is still quadratic or deep enough to overflow
// after Session 311". `braceGroups` read on from each `{` to its closer and, where none came, to the END of the line, so a line of N unclosed `{` was N reads of the same tail. It now reads the first `{` straight on and, when that
// finds no closer, fills in the closer of every later `{` in one pass from the end of the line over three quote states (outside, inside a `"`, inside a `'`). That is only sound if the answer is the SAME on EVERY line, so the old
// function is kept below, copied from the parent `7210ef6` (Session 325's source, before the cure) by a script, renamed `oldBraceGroups` (the body is the parent's, character for character), as the oracle (Learning 738).

// ---- The OLD function, copied from the parent `7210ef6` by a script; only the name changed and the `export` was dropped. ----
function oldBraceGroups(lineText: string): BraceGroup[] {
  const groups: BraceGroup[] = [];
  let i = 0;
  while (i < lineText.length) {
    if (lineText[i] !== "{") {
      i++;
      continue;
    }
    let quote: string | null = null;
    let j = i + 1;
    for (; j < lineText.length; j++) {
      const ch = lineText[j];
      if (quote !== null) {
        if (ch === quote) {
          quote = null;
        }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === "}") {
        break;
      }
    }
    if (j >= lineText.length) {
      i++;
      continue;
    }
    groups.push({ start: i, end: j, content: lineText.slice(i + 1, j) });
    i = j + 1;
  }
  return groups;
}

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

const GROUP_KEYS = (groups: BraceGroup[]): string => groups.map((group) => `${group.start}:${group.end}:${group.content}`).join("|");

/**
 * Whether a LATER `{` closes after an EARLIER one found no closer: the strings on which the new function builds its table AND reads from it. Taken from the OLD answer alone, so it does not depend on the code under test.
 * A `{` that opens no group, with a group that starts after it and is not inside a group before it.
 */
function laterGroupAfterAnUnclosedBrace(text: string): boolean {
  const groups = oldBraceGroups(text);
  const starts = new Set(groups.map((group) => group.start));
  let coveredUntil = -1;
  let unclosedSeen = false;
  for (let i = 0; i < text.length; i++) {
    if (i <= coveredUntil) {
      continue;
    }
    if (starts.has(i)) {
      if (unclosedSeen) {
        return true;
      }
      coveredUntil = groups.find((group) => group.start === i)!.end;
    } else if (text[i] === "{") {
      unclosedSeen = true;
    }
  }
  return false;
}

/**
 * Both functions on every string: how many were compared, on how many the OLD one finds a group, on how many the table is built and read, and the first few disagreements.
 * `candidate` is the function under test; the self-test below hands it a wrong one to show that the comparator can report a disagreement.
 */
function compareGroups(strings: Iterable<string>, candidate: (text: string) => BraceGroup[] = braceGroups): { compared: number; grouped: number; tableRead: number; disagreements: string[] } {
  let compared = 0;
  let grouped = 0;
  let tableRead = 0;
  const disagreements: string[] = [];
  for (const text of strings) {
    const expected = oldBraceGroups(text);
    compared++;
    if (expected.length > 0) {
      grouped++;
      if (laterGroupAfterAnUnclosedBrace(text)) {
        tableRead++;
      }
    }
    if (GROUP_KEYS(candidate(text)) !== GROUP_KEYS(expected) && disagreements.length < 5) {
      disagreements.push(JSON.stringify(text));
    }
  }
  return { compared, grouped, tableRead, disagreements };
}

// The alphabets are the characters the read reacts to: `{` (opens a read), `}` (closes it outside a quote), the two quote marks (open and close a quote, and each is plain text inside the other) and a neutral letter.
const ALPHABET_FIVE = ["{", "}", '"', "'", "a"];
const ALPHABET_FOUR = ["{", "}", '"', "'"];
const SEEDED_STRINGS = 300_000;
/** The characters the read must IGNORE as well (a backslash, a backtick, brackets, a space, an accented letter, an astral one): a rule that reacts to one of them in one of the two encodings only is invisible over the two alphabets above. */
const ALPHABET_WIDE = ["{", "{", "}", '"', "'", "\\", "`", ")", "(", "[", "]", " ", "a", "é", "\u{1F600}"];
const WIDE_STRINGS = 200_000;
/** The heavy rows take 3 to 4 s warm: vitest's default of 5 s would let a loaded machine, or a mutant that is merely slow, fail them by the clock instead of by an answer. */
const HEAVY_ROW_MS = 30_000;
/** How many strings of each set the OLD function finds a group on, and on how many of those a later `{` closes after an earlier one found no closer (the new function builds its table and reads it), so a comparison cannot pass by both finding nothing. */
const COUNTS = { five: { grouped: 962_036, tableRead: 152_288 }, four: { grouped: 3_437_937, tableRead: 820_688 }, seeded: { grouped: 200_847, tableRead: 78_763 }, runs: { grouped: 14_664, tableRead: 7_488 }, wide: { grouped: 56_591, tableRead: 14_576 } };

describe("Session 326 — braceGroups answers what the function that reread the line for each unclosed brace answered", () => {
  it.each([
    ["nothing", "", []],
    ["a lone opener", "{", []],
    ["a lone closer", "}", []],
    ["an empty group", "{}", [[0, 1, ""]]],
    ["a group is closed by the FIRST closer, so a second opener inside it is content", "{{}", [[0, 2, "{"]]],
    ["two openers and no closer", "{{", []],
    ["a quote hides the only closer", '{"}', []],
    ["a quoted closer is content, and the unquoted one after it closes", '{"}"}', [[0, 4, '"}"']]],
    ["an opener inside a quote that hides the closer: the SECOND opener reads from outside the quote", '{"{}', [[2, 3, ""]]],
    ["the same with a single quote", "{'{}", [[2, 3, ""]]],
    ["a single quote inside a double quote is plain, so the closer is still hidden for the first and found by the third", `{"'{}`, [[3, 4, ""]]],
    ["two openers hidden by one quote, then a third that closes", '{{"}{}', [[4, 5, ""]]],
    ["two groups side by side", "{a}{b}", [[0, 2, "a"], [3, 5, "b"]]],
    ["a group then an opener with no closer", "{a}{", [[0, 2, "a"]]],
    ["a group, an opener a quote hides, then a group found past it", '{a}{"}{b}', [[0, 2, "a"], [6, 8, "b"]]],
    ["a read that is inside a quote when a group would close: the table answers from the right state", `{'a"}'}{"}"}`, [[0, 6, `'a"}'`], [7, 11, '"}"']]],
    ["an image attribute block with a quoted closer", '![Cap](a.png){#fig-w12 key="a}b"}', [[13, 32, '#fig-w12 key="a}b"']]],
    ["an unterminated attribute block", "![Cap](a.png){#fig-v11", []],
  ] as Array<[string, string, Array<[number, number, string]>]>)("%s", (_title, text, groups) => {
    const expected = groups.map(([start, end, content]) => `${start}:${end}:${content}`).join("|");
    expect(GROUP_KEYS(oldBraceGroups(text))).toBe(expected);
    expect(GROUP_KEYS(braceGroups(text))).toBe(expected);
  });

  it("answers a group found past index 65,535 after a read of 70,000 characters that a quote hid", () => {
    const text = `{${"a".repeat(70_000)}"{}`;
    expect(GROUP_KEYS(oldBraceGroups(text))).toBe("70002:70003:");
    expect(GROUP_KEYS(braceGroups(text))).toBe("70002:70003:");
  });

  it("answers the same on every string of up to 9 characters over `{`, `}`, both quotes and a letter", () => {
    const result = compareGroups(everyString(ALPHABET_FIVE, 9));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(5, 9));
    expect({ grouped: result.grouped, tableRead: result.tableRead }).toEqual(COUNTS.five);
  }, HEAVY_ROW_MS);

  it("answers the same on every string of up to 11 characters over `{`, `}` and both quotes", () => {
    const result = compareGroups(everyString(ALPHABET_FOUR, 11));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(4, 11));
    expect({ grouped: result.grouped, tableRead: result.tableRead }).toEqual(COUNTS.four);
  }, HEAVY_ROW_MS);

  it("answers the same on runs of openers split by one quote mark and a closer in every place (a, b and c openers)", () => {
    const strings: string[] = [];
    for (const middle of ["", '"', "'", '"\'', "'\"", '""', "''"]) {
      for (let a = 0; a <= 12; a++) {
        for (let b = 0; b <= 12; b++) {
          for (let c = 0; c <= 12; c++) {
            for (const closer of ["", "}"]) {
              strings.push(`${"{".repeat(a)}${middle}${"{".repeat(b)}${closer}${"{".repeat(c)}`);
            }
          }
        }
      }
    }
    const result = compareGroups(strings);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(strings.length);
    expect({ grouped: result.grouped, tableRead: result.tableRead }).toEqual(COUNTS.runs);
  });

  it("answers the same on 300,000 seeded strings of up to 400 characters under five weightings", () => {
    const random = seededRandom(326);
    const weightings = [
      ["{", "{", "{", "}", '"', "'", "a"],
      ["{", '"', '"', "'", "}", "a", "a"],
      ["{", "{", "}", "}", '"', "'", "{", "a", "a", "a"],
      ["{", "a", "a", "a", "a", "a", "a", '"', "'", "}"],
      ["{", "{", "{", "{", "{", "{", '"', "'"],
    ];
    const strings = (function* (): Generator<string> {
      for (let n = 0; n < SEEDED_STRINGS; n++) {
        const alphabet = weightings[n % weightings.length];
        const length = Math.floor(random() * random() * 400);
        let text = "";
        for (let k = 0; k < length; k++) {
          text += alphabet[Math.floor(random() * alphabet.length)];
        }
        yield text;
      }
    })();
    const result = compareGroups(strings);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect({ grouped: result.grouped, tableRead: result.tableRead }).toEqual(COUNTS.seeded);
  }, HEAVY_ROW_MS);

  // Far from the start of the line. The 100,000-opener guard of pathological-inputs.test.ts sees neither where a group starts nor how far a read reaches, so a cap on the first read (1,024, 4,096 or 65,536 characters) or a 16-bit table
  // (a cap on its length, a masked index, a pass that starts at column 131,071, a 16-bit element) is a second "cure" that every row above passes. These two put a closer 70,000 and 200,000 characters after its opener, and a
  // lookup 70,000 and 200,000 columns into the table.
  it.each([70_000, 200_000])("closes a group whose closer is %i characters after its opener (the first read has no reach limit)", (far) => {
    const text = `{${"a".repeat(far)}}`;
    expect(braceGroups(text)).toEqual([{ start: 0, end: far + 1, content: "a".repeat(far) }]);
  });

  it.each([70_000, 200_000])("looks up the closer of a `{` that is %i columns into the table (no 16-bit index, no cap on the table or on the pass)", (far) => {
    const text = `{{"${"a".repeat(far)}{}`;
    expect(braceGroups(text)).toEqual([{ start: far + 3, end: far + 4, content: "" }]);
  });

  // The characters the read must ignore. A backslash does not escape a closer, a backtick is not a quote and a parenthesis does not close: these are the answers of the parent, stated.
  it.each([
    ["a backtick is plain text, so the first closer closes", "{`}`}", [[0, 2, "`"]]],
    ["a backslash does not escape the closer", "{\\}", [[0, 2, "\\"]]],
    ["a closing parenthesis is plain text on the table path", '{"{a)}', [[2, 5, "a)"]]],
    ["a square bracket is plain text on the table path", '{"{a]}', [[2, 5, "a]"]]],
  ] as Array<[string, string, Array<[number, number, string]>]>)("%s", (_title, text, groups) => {
    const expected = groups.map(([start, end, content]) => `${start}:${end}:${content}`).join("|");
    expect(GROUP_KEYS(oldBraceGroups(text))).toBe(expected);
    expect(GROUP_KEYS(braceGroups(text))).toBe(expected);
  });

  it("answers the same on 200,000 seeded strings over an alphabet that holds characters the read must ignore", () => {
    const random = seededRandom(3260);
    const strings = (function* (): Generator<string> {
      for (let n = 0; n < WIDE_STRINGS; n++) {
        const length = Math.floor(random() * random() * 60);
        let text = "";
        for (let k = 0; k < length; k++) {
          text += ALPHABET_WIDE[Math.floor(random() * ALPHABET_WIDE.length)];
        }
        yield text;
      }
    })();
    const result = compareGroups(strings);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(WIDE_STRINGS);
    expect({ grouped: result.grouped, tableRead: result.tableRead }).toEqual(COUNTS.wide);
  }, HEAVY_ROW_MS);

  // A comparison that cannot report a disagreement is no comparison: `expect(result.disagreements).toEqual([])` passes just as well if `compareGroups` never fills the list.
  it("reports a disagreement against a wrong function, and counts every string it was given", () => {
    // A scan to the first `}` that ignores both quote marks: the function a quote-blind cure would be.
    const quoteBlind = (text: string): BraceGroup[] => {
      const groups: BraceGroup[] = [];
      let i = 0;
      while (i < text.length) {
        const j = text[i] === "{" ? text.indexOf("}", i + 1) : -1;
        if (j === -1) {
          i++;
          continue;
        }
        groups.push({ start: i, end: j, content: text.slice(i + 1, j) });
        i = j + 1;
      }
      return groups;
    };
    const result = compareGroups(everyString(ALPHABET_FOUR, 5), quoteBlind);
    expect(result.compared).toBe(countStrings(4, 5));
    expect(result.disagreements).toHaveLength(5);
    expect(result.disagreements.every((text) => /["']/.test(JSON.parse(text) as string))).toBe(true);
    expect(compareGroups(everyString(ALPHABET_FOUR, 5)).disagreements).toEqual([]);
  });

  // A clock row that cannot fail is no row (blank-tail-equivalence.test.ts): the OLD function must say "slow" on the very lines the Session 326 clock rows of pathological-inputs.test.ts time. 16,000 units take it
  // 0.5 to 1.2 s (warm, load 5), the new function 1 to 3 ms.
  it.each([
    [16_000, "{"],
    [16_000, '{"'],
    [16_000, "{'"],
  ] as Array<[number, string]>)("the clock rows can fail: the old function reads %i x %s far more slowly than the new one", (many, unit) => {
    const text = unit.repeat(many);
    const slow = timed(() => oldBraceGroups(text));
    const fast = timed(() => braceGroups(text));
    expect(slow.result).toEqual([]);
    expect(fast.result).toEqual([]);
    expect(slow.ms).toBeGreaterThan(fast.ms * 20 + 50);
  }, HEAVY_ROW_MS);
});
