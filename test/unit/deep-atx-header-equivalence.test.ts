import { describe, expect, it } from "vitest";
import { DEEP_ATX_HEADER, DEEP_ATX_HEADER_TIGHT } from "../../src/core/qmd/model";
import { LS, NBSP, PS, compare, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, sameMatch, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 335 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (7). `DEEP_ATX_HEADER` and `DEEP_ATX_HEADER_TIGHT` read the run of `#` as the
// counted loop `#{7,}`, and V8 keeps one entry of its regex backtrack stack per repetition of a counted loop: a line of 5,592,382 or more `#` threw `RangeError: Maximum call stack size exceeded` (bisected at
// `c06ee06`), and the error reached every reader of the document. They now read seven `#` and a star of the same character, `#{7}#*`, which is the same language and costs the stack nothing. The two old patterns
// are kept below, copied from the parent `c06ee06` (`src/core/qmd/model.ts`), as the oracle (Learning 738); the pinned counts (how many strings of each enumeration the OLD pattern accepts) come from the old
// patterns and from a Python port of them (`re`, with `.` as every character but LF, CR, U+2028 and U+2029, and `$` as `\Z`) and never from the code under test.

// ---- The OLD patterns, copied from the parent `c06ee06`. ----
const OLD_DEEP_ATX_HEADER = /^[ \t]*(#{7,})(?:[ \t].*)?$/;
const OLD_DEEP_ATX_HEADER_TIGHT = /^[ \t]*(#{7,})(?![.)])/;

const PATTERNS = [
  { name: "DEEP_ATX_HEADER", oldPattern: OLD_DEEP_ATX_HEADER, now: DEEP_ATX_HEADER },
  { name: "DEEP_ATX_HEADER_TIGHT", oldPattern: OLD_DEEP_ATX_HEADER_TIGHT, now: DEEP_ATX_HEADER_TIGHT },
] as const;

// A blank prefix, a run of 0 to 9 `#`, then every tail of up to four characters over the characters that end, extend or break the match: the blanks the tail class takes, `.` and `)` (the fancy-list guard), a
// letter, a CR and the two line separators (`.` stops at all three), a no-break space (not a blank to `[ \t]`) and `#` itself.
const TAIL_ALPHABET = ["#", " ", "\t", "a", ".", ")", "\r", LS, PS, NBSP];
function* structured(): Generator<string> {
  for (const prefix of everyString([" ", "\t"], 4)) {
    for (let hashes = 0; hashes <= 9; hashes++) {
      for (const tail of everyString(TAIL_ALPHABET, 4)) {
        yield prefix + "#".repeat(hashes) + tail;
      }
    }
  }
}
const STRUCTURED_COUNT = 31 * 10 * countStrings(TAIL_ALPHABET.length, 4);

// Every string of up to nine characters over the five that matter, with no prefix at all.
const SMALL_ALPHABET = ["#", " ", "\t", ".", "a"];

// A seeded sample of longer lines: 0 to 12 pieces behind a blank prefix. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3351;
const PIECES = ["#", "#", "#######", "##", " ", "\t", "a", ".", ")", "x y", "\r", LS, PS, NBSP, "# "];
const PREFIXES = ["", " ", "   ", "\t", " \t"];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = PREFIXES[Math.floor(next() * PREFIXES.length)];
    const parts = Math.floor(next() * 13);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 4));
    }
    yield text;
  }
}

describe("Session 335 — DEEP_ATX_HEADER and its tight twin: `#{7}#*` accepts what `#{7,}` did, with the same groups", () => {
  it.each(PATTERNS.map((p) => [p.name, p] as const))("%s: every blank prefix, run of 0 to 9 `#` and tail of up to four characters", (_name, p) => {
    const result = compare(p.oldPattern, p.now, structured());
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(STRUCTURED_COUNT);
    expect(result.accepted).toBe(p.name === "DEEP_ATX_HEADER" ? STRUCTURED_ACCEPTED_DEEP : STRUCTURED_ACCEPTED_TIGHT);
  }, HEAVY_ROW_MS);

  it.each(PATTERNS.map((p) => [p.name, p] as const))("%s: every string of up to nine characters over `# \\t.a`", (_name, p) => {
    const result = compare(p.oldPattern, p.now, everyString(SMALL_ALPHABET, 9));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(SMALL_ALPHABET.length, 9));
    expect(result.accepted).toBe(p.name === "DEEP_ATX_HEADER" ? SMALL_ACCEPTED_DEEP : SMALL_ACCEPTED_TIGHT);
  }, HEAVY_ROW_MS);

  it.each(PATTERNS.map((p) => [p.name, p] as const))(`%s: ${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, (_name, p) => {
    const result = compare(p.oldPattern, p.now, seededTexts(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.accepted).toBe(p.name === "DEEP_ATX_HEADER" ? SEEDED_ACCEPTED_DEEP : SEEDED_ACCEPTED_TIGHT);
  }, HEAVY_ROW_MS);

  // What each line is, stated by hand (group 1 is the whole run, so the width of the run is what a caller could read).
  const STATED: Array<[string, boolean, boolean]> = [
    // line, DEEP_ATX_HEADER, DEEP_ATX_HEADER_TIGHT
    ["#######", true, true],
    ["######", false, false],
    ["########", true, true],
    ["####### text", true, true],
    ["#######\ttext", true, true],
    ["#######text", false, true],
    // Exactly seven `#` and then `.` or `)`: the tight pattern refuses it, and there is no `#` to give back. Eight is one more than the minimum, so the match gives one back and is accepted.
    ["#######.", false, false],
    ["#######)", false, false],
    ["#######.x", false, false],
    ["########.", false, true],
    ["########)", false, true],
    ["   ####### x", true, true],
    ["\t####### x", true, true],
    ["  \t  #######", true, true],
    ["####### text" + LS + "more", false, true],
    ["####### text\rmore", false, true],
    ["#######" + NBSP, false, true],
    ["####### #", true, true],
    ["# ######", false, false],
    ["", false, false],
  ];
  it.each(STATED.map(([line, deep, tight]) => [JSON.stringify(line), line, deep, tight] as const))("%s is stated by hand, by the old patterns and by the new ones", (_label, line, deep, tight) => {
    expect([OLD_DEEP_ATX_HEADER.test(line), DEEP_ATX_HEADER.test(line)]).toEqual([deep, deep]);
    expect([OLD_DEEP_ATX_HEADER_TIGHT.test(line), DEEP_ATX_HEADER_TIGHT.test(line)]).toEqual([tight, tight]);
  });

  // The cure itself: a run past the old overflow (5,592,382 for these two) is read, and group 1 is the whole run. The old patterns are compared only below that, where they still read.
  const SMALL_RUNS = [6, 7, 8, 9, 64, 4_096, 65_536, 1_048_576, 4_194_304];
  const LONG_RUNS = [5_592_382, 5_600_000, 11_200_000, 16_777_216, 45_000_000];
  it.each([...SMALL_RUNS, ...LONG_RUNS])("a run of %i `#` is a deep header and group 1 is the whole run", (n) => {
    const line = "#".repeat(n);
    for (const now of [DEEP_ATX_HEADER, DEEP_ATX_HEADER_TIGHT]) {
      const m = now.exec(line);
      if (n < 7) {
        expect(m).toBeNull();
      } else {
        expect(m).not.toBeNull();
        expect(m![0].length).toBe(n);
        expect(m![1].length).toBe(n);
      }
    }
  });

  it.each(SMALL_RUNS.filter((n) => n >= 7))("a run of %i `#` with a refused tail gives the old answer, group for group", (n) => {
    for (const tail of ["x", ".", ")", "x y", "\r", " .", "#.", "\t#"]) {
      for (const p of PATTERNS) {
        const line = "#".repeat(n) + tail;
        expect(sameMatch(p.now.exec(line), p.oldPattern.exec(line))).toBe(true);
      }
    }
  });

  it.each(LONG_RUNS)("a run of %i `#` with a refused tail is read, and gives the answer the definition gives", (n) => {
    // DEEP: the tail must be a blank and anything, or nothing; `x` ends the match nowhere. TIGHT: `x` is not `.` or `)`, so the whole run matches; a `.` is refused and the match gives one `#` back.
    expect(DEEP_ATX_HEADER.exec("#".repeat(n) + "x")).toBeNull();
    expect(DEEP_ATX_HEADER.exec("#".repeat(n) + ".")).toBeNull();
    expect(DEEP_ATX_HEADER.exec("#".repeat(n) + " tail")![1].length).toBe(n);
    expect(DEEP_ATX_HEADER_TIGHT.exec("#".repeat(n) + "x")![1].length).toBe(n);
    expect(DEEP_ATX_HEADER_TIGHT.exec("#".repeat(n) + ".")![1].length).toBe(n - 1);
    expect(DEEP_ATX_HEADER_TIGHT.exec("#".repeat(n) + ")")![1].length).toBe(n - 1);
  });

  it.each([10_000, 5_000_000])("a run of %i blanks, then seven `#`, then a refused tail, is read in linear time", (n) => {
    const line = `${" ".repeat(n)}#######x`;
    const started = Date.now();
    expect(DEEP_ATX_HEADER.test(line)).toBe(false);
    expect(DEEP_ATX_HEADER_TIGHT.test(line)).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

// The counts the OLD patterns accept over each enumeration, recounted by a Python port of the two patterns and of the seeded generator (see the header): 3,444,410 structured strings, 2,441,406 small ones.
const STRUCTURED_ACCEPTED_DEEP = 92_163;
const STRUCTURED_ACCEPTED_TIGHT = 995_069;
const SMALL_ACCEPTED_DEEP = 29;
const SMALL_ACCEPTED_TIGHT = 39;
const SEEDED_ACCEPTED_DEEP = 8_060;
const SEEDED_ACCEPTED_TIGHT = 35_061;

// The review round of Session 335 (its mutation lens): twelve edits of the two patterns survived every row above. The tail class `[ \t]` taking a form feed, a vertical tab or an ideographic space, the lead class taking a
// form feed, the tight pattern's refused set `[.)]` taking `]`, `:`, `,`, `!` or a full-width stop: the alphabets hold none of those. And a lead capped at 4,096 blanks or a tail capped at 65,536 characters: the long-blank rows asserted
// only the refused answer. Every UTF-16 code unit is put into each head and in place of each of its characters, and the accepted long lines are read.
describe("Session 335 review — the deep ATX header on every code unit and on long blanks", () => {
  const SWEEP_HEADS = ["#######", "####### x", " ####### x", "\t########.", "#######)", "#######.x"];
  it.each(PATTERNS.map((p) => [p.name, p] as const))("%s: every head with one code unit put into it, or in place of one of its characters", (_name, p) => {
    const result = compare(p.oldPattern, p.now, everyCodeUnitEdit(SWEEP_HEADS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countCodeUnitEdits(SWEEP_HEADS));
    expect(result.accepted).toBe(p.name === "DEEP_ATX_HEADER" ? 393_276 : 1_310_786); // recounted by a Python port of the old patterns and of the sweep: 7,340,032 strings
  }, HEAVY_ROW_MS);

  // 4,097 and 5,000 pass a cap of 4,096; 70,000 passes 65,536; 4,300,000 passes 2^22. The old patterns read a plain class here (no group), so they still answer, and they are compared.
  it.each([4_097, 5_000, 70_000, 4_300_000])("%i blanks before the run, and a tail of that many characters, are read as the old patterns read them", (n) => {
    const lines = [
      " ".repeat(n) + "#######",
      "\t".repeat(n) + "####### x",
      "#######" + " ".repeat(n),
      "####### " + "x".repeat(n),
      "####### " + "x".repeat(n) + LS,
      "#######." + "x".repeat(n),
      "#######x" + "x".repeat(n),
      " ".repeat(n) + "######",
    ];
    for (const line of lines) {
      for (const p of PATTERNS) {
        expect(sameMatch(p.now.exec(line), p.oldPattern.exec(line))).toBe(true);
      }
    }
    expect(DEEP_ATX_HEADER.test(lines[0])).toBe(true);
    expect(DEEP_ATX_HEADER.test(lines[3])).toBe(true);
    expect(DEEP_ATX_HEADER.test(lines[4])).toBe(false);
    expect(DEEP_ATX_HEADER_TIGHT.test(lines[5])).toBe(false);
    expect(DEEP_ATX_HEADER_TIGHT.test(lines[6])).toBe(true);
    expect(DEEP_ATX_HEADER_TIGHT.test(lines[7])).toBe(false);
  }, HEAVY_ROW_MS);
});
