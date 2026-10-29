import { describe, expect, it } from "vitest";
import { PANDOC_BLOCK_MACROS_ANY, PANDOC_BLOCK_MACROS_ARG, PANDOC_BLOCK_MACROS_BARE, PANDOC_INLINE_MACROS, rawTexBlockMacroLine } from "../../src/core/qmd/model";
import { NBSP, countCodeUnitEdits, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 335 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (9). `RAW_TEX_BLOCK_MACRO` read a block macro's argument groups and every further macro
// on its line as a group, and V8 keeps one entry of its regex backtrack stack per repetition of a group: ` \pdfstringdef[]` and 2,097,143 `\x` threw `RangeError: Maximum call stack size exceeded` (bisected at
// `c06ee06`; the `[]` groups at 3,355,429 and the `{}` groups at 8,388,572), and the error reached every reader of the document. `rawTexBlockMacroLine` reads the same line with a loop. The pattern is rebuilt
// below, copied from the parent `c06ee06` (`src/core/qmd/model.ts`) from the name lists the source exports (data, unchanged by this session) and the parent's own composition, as the oracle (Learning 738); the pinned
// counts (how many lines of each enumeration the OLD pattern accepts) come from that pattern and from a Python port that reads the lists from the source, and never from the code under test.

// ---- The OLD pattern, copied from the parent `c06ee06`. ----
const MACRO_NAME_END = "(?![a-zA-Z])";
const MACRO_ARG_GROUP = "(?:\\[[^\\]]*\\]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})";
const NON_INLINE_MACRO = "\\\\(?!(?:" + PANDOC_INLINE_MACROS + ")" + MACRO_NAME_END + ")[a-zA-Z]+" + MACRO_ARG_GROUP + "*";
const MACRO_LINE_TAIL = "(?:[ \\t]*" + NON_INLINE_MACRO + ")*[ \\t]*$";
const OLD_RAW_TEX_BLOCK_MACRO = new RegExp(
  "^[ \\t]*\\\\(?:" + PANDOC_BLOCK_MACROS_ANY + ")" + MACRO_NAME_END +
    MACRO_ARG_GROUP + "*" + MACRO_LINE_TAIL +
  "|^[ \\t]*\\\\(?:" + PANDOC_BLOCK_MACROS_ARG + ")" + MACRO_NAME_END +
    MACRO_ARG_GROUP + "+" + MACRO_LINE_TAIL +
  "|^[ \\t]*\\\\(?:" + PANDOC_BLOCK_MACROS_BARE + ")" + MACRO_NAME_END + MACRO_LINE_TAIL,
);

type Count = { compared: number; block: number; disagreements: string[] };
/** Compare the new function with the old pattern over `lines`: how many were compared, how many the OLD pattern accepted, and the first few disagreements. */
function compareAll(lines: Iterable<string>): Count {
  const count: Count = { compared: 0, block: 0, disagreements: [] };
  for (const line of lines) {
    count.compared++;
    const expected = OLD_RAW_TEX_BLOCK_MACRO.test(line);
    if (expected) {
      count.block++;
    }
    if (rawTexBlockMacroLine(line) !== expected && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: old ${expected}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

const nameList = (list: string): string[] => list.replace(/\\\*/g, "*").split("|");
const ANY_NAMES = nameList(PANDOC_BLOCK_MACROS_ANY);
const ARG_NAMES = nameList(PANDOC_BLOCK_MACROS_ARG);
const BARE_NAMES = nameList(PANDOC_BLOCK_MACROS_BARE);
const INLINE_NAMES = nameList(PANDOC_INLINE_MACROS);

// Tokens, not characters: a macro of each kind (any arguments, at least one, none, inline, inline with a star, unknown and so not class C), the brackets, whole groups, blanks and the characters that end a name.
const TOKENS = ["\\usepackage", "\\section", "\\section*", "\\par", "\\textbf", "\\x", "[", "]", "{", "}", "{}", "[x]", "{a{b}c}", " ", "\t", "*", "a", "\\"];
const MAX_TOKENS = 5;

// Every name of every list, and the names a letter off, a letter short, with a star it has no twin for, behind four prefixes and followed by arguments, tails and breakers.
const PREFIXES = ["", " ", "\t", "   ", " \t "];
const SUFFIXES = [
  "", " ", "\t", "{}", "{x}", "[x]", "[", "{", "{a{b}c}", "{a{b{c}}}", "{}{}", "[]{}", "{}[]", "{} ", "\\x", " \\x", "\\x{a}", "\\textbf{b}", " \\textbf", "\\maketitle", "\\par", "\\par{x}",
  "*", "*{x}", "x", "1", "\\", "\\1", "\\x*", "\\foreignquote*{a}", "\\citep*", " x", "{x} y", "\r", "\v", NBSP, "{x}\\x", "}", "]", "{x}}", "[x]]", "\\x[",
];
const NEAR_NAMES = Array.from(new Set([...ANY_NAMES, ...ARG_NAMES, ...BARE_NAMES, ...INLINE_NAMES].flatMap((n) => [n, `${n}x`, n.length > 1 ? n.slice(0, -1) : n, n.endsWith("*") ? n : `${n}*`])));
function* byName(): Generator<string> {
  for (const prefix of PREFIXES) {
    for (const name of NEAR_NAMES) {
      for (const suffix of SUFFIXES) {
        yield `${prefix}\\${name}${suffix}`;
      }
    }
  }
}

// A seeded sample of longer lines: a prefix and 0 to 12 pieces. The seed is written beside the count it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEED = 3356;
const PIECES = ["\\usepackage", "\\section", "\\section*", "\\par", "\\textbf", "\\x", "\\newpage", "\\include", "\\title", "[", "]", "{", "}", "{x}", "[y]", "{a{b}c}", " ", "\t", "*", "a", "\\", NBSP, "\r"];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = PREFIXES[Math.floor(next() * PREFIXES.length)];
    const parts = Math.floor(next() * 13);
    for (let part = 0; part < parts; part++) {
      text += PIECES[Math.floor(next() * PIECES.length)];
    }
    yield text;
  }
}

// What each line is, stated by hand (from the docstrings of the three classes): block, or not.
const STATED: Array<[string, boolean]> = [
  ["\\maketitle", true],
  ["\\maketitle{}", true],
  ["  \\maketitle", true],
  ["\\maketitle \\textbf{b}", false],
  ["\\maketitle prose", false],
  ["\\maketitle\\newpage", true],
  ["\\maketitle \\newpage", true],
  ["\\maketitle \\newpage \\vspace{1em}", true],
  ["\\usepackage{amsmath}", true],
  ["\\usepackage{amsmath}{}", true],
  ["\\usepackage[utf8]{inputenc}", true],
  ["\\usepackage{a{b}c}", true],
  ["\\usepackage{a{b{c}}}", false],
  ["\\usepackage{a", false],
  ["\\usepackage[a", false],
  ["\\usepackage[a]]", false],
  ["\\section{x}", true],
  ["\\section", false],
  ["\\section[x]", true],
  ["\\section*{x}", true],
  ["\\section*", false],
  ["\\section* {x}", false],
  ["\\sectionx{x}", false],
  ["\\subsection{x}", true],
  ["\\subsection*{x}", true],
  ["\\par", true],
  ["\\par{x}", false],
  ["\\par \\par", true],
  ["\\par\\textbf{x}", false],
  ["\\pfbreak*", true],
  ["\\pfbreak", true],
  ["\\pfbreak**", false],
  ["\\raggedright", true],
  ["\\raggedrightx", false],
  ["\\textbf{x}", false],
  ["\\clearpage", false],
  ["\\newpage", false],
  ["\\", false],
  ["\\1", false],
  ["x \\maketitle", false],
  ["", false],
  ["   ", false],
  [" \t\\pdfstringdef[]\\x\\x  ", true],
  [" \t\\pdfstringdef[]\\x\\x  y", false],
];

describe("Session 335 — rawTexBlockMacroLine: the loop accepts the lines RAW_TEX_BLOCK_MACRO did", () => {
  const ENUMERATIONS: Array<{ label: string; lines: () => Iterable<string>; compared: number; block: number }> = [
    { label: "up to 5 of 18 tokens (a macro of each kind, brackets, whole groups, blanks, a star, a backslash)", lines: () => everyString(TOKENS, MAX_TOKENS), compared: 2_000_719, block: 29_606 },
    { label: "every name of the three lists and the inline list, and the names a letter off, a letter short and starred, behind 5 prefixes and 42 suffixes", lines: byName, compared: 5 * NEAR_NAMES.length * SUFFIXES.length, block: 4_240 },
  ];

  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(e.lines());
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: e.compared, block: e.block });
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, block: 8_125 });
  }, HEAVY_ROW_MS);

  it("the lists are what the scan assumes: plain names with an optional star, no name in two block lists, every starred inline name with a plain twin", () => {
    for (const name of [...ANY_NAMES, ...ARG_NAMES, ...BARE_NAMES, ...INLINE_NAMES]) {
      expect(name).toMatch(/^[A-Za-z]+\*?$/);
    }
    expect(new Set([...ANY_NAMES, ...ARG_NAMES, ...BARE_NAMES]).size).toBe(ANY_NAMES.length + ARG_NAMES.length + BARE_NAMES.length);
    expect([ANY_NAMES.length, ARG_NAMES.length, BARE_NAMES.length, INLINE_NAMES.length]).toEqual([20, 46, 7, 294]);
    // The title's last clause, asserted (the review of Session 335 found it was only claimed, and that the mutation entries I03 and I04 lean on it): a starred inline name has its plain twin in the list, 13 of them.
    const starred = INLINE_NAMES.filter((name) => name.endsWith("*"));
    expect(starred.length).toBe(13);
    expect(starred.filter((name) => !INLINE_NAMES.includes(name.slice(0, -1)))).toEqual([]);
    // Two more facts of the data that the mutation entries RV12 and RV14 lean on: no name of the any-arguments list is starred, and none has a starred twin in another block list.
    expect(ANY_NAMES.filter((name) => name.endsWith("*"))).toEqual([]);
    expect(ANY_NAMES.filter((name) => [...ARG_NAMES, ...BARE_NAMES].includes(`${name}*`))).toEqual([]);
  });

  it.each(STATED.map(([line, block]) => [JSON.stringify(line), line, block] as const))("%s is stated by hand, by the old pattern and by the new function", (_label, line, block) => {
    expect(OLD_RAW_TEX_BLOCK_MACRO.test(line)).toBe(block);
    expect(rawTexBlockMacroLine(line)).toBe(block);
  });

  // The cure itself: a tail of 2,097,143 macros, 3,355,429 `[]` groups and 8,388,572 `{}` groups is read. The old pattern is compared only below those, where it still reads.
  const SMALL = [1, 2, 3, 100, 4_096, 65_536, 1_000_000];
  const LONG = [2_097_143, 4_200_000, 10_000_000];
  const SHAPES: Array<[string, (n: number) => string]> = [
    ["a tail of `\\x`", (n) => ` \t\\pdfstringdef[]${"\\x".repeat(n)}  `],
    ["a tail of `\\x{a}`", (n) => `\\maketitle${"\\x{a}".repeat(n)}`],
    ["a tail of ` \\x`", (n) => `\\par${" \\x".repeat(n)}`],
    ["`[]` groups", (n) => `\\pdfstringdef${"[]".repeat(n)}  `],
    ["`{}` groups", (n) => `\\section${"{}".repeat(n)}`],
    ["`{a{b}c}` groups", (n) => `\\usepackage${"{a{b}c}".repeat(n)}`],
  ];
  const TAILS = ["", " ", "x", " prose", "\\textbf", "{", "[", "}", "\\x[", "\\x{a{b{c}}}"];
  it.each(SMALL)("%i units of each shape, with each refused or accepted tail, give the old answer", (n) => {
    for (const [, build] of SHAPES) {
      for (const tail of TAILS) {
        const line = build(n) + tail;
        expect(rawTexBlockMacroLine(line)).toBe(OLD_RAW_TEX_BLOCK_MACRO.test(line));
      }
    }
  }, HEAVY_ROW_MS);

  it.each(LONG)("%i units of each shape are read, and the tail decides", (n) => {
    for (const [, build] of SHAPES) {
      const line = build(n);
      expect(rawTexBlockMacroLine(line)).toBe(true);
      expect(rawTexBlockMacroLine(`${line} prose`)).toBe(false);
      expect(rawTexBlockMacroLine(`${line}\\textbf{b}`)).toBe(false);
      expect(rawTexBlockMacroLine(`${line}{`)).toBe(false);
      expect(rawTexBlockMacroLine(`${line}\\x`)).toBe(true);
      expect(rawTexBlockMacroLine(`${line}\\newpage \\vspace{1em}  `)).toBe(true);
    }
  }, HEAVY_ROW_MS);

  it("a block macro whose argument is millions of characters long is read in linear time, closed or not", () => {
    const long = "a".repeat(50_000_000);
    const started = Date.now();
    expect(rawTexBlockMacroLine(`\\usepackage{${long}}`)).toBe(true);
    expect(rawTexBlockMacroLine(`\\usepackage{${long}`)).toBe(false);
    expect(rawTexBlockMacroLine(`\\usepackage[${long}]`)).toBe(true);
    expect(rawTexBlockMacroLine(`\\usepackage[${long}`)).toBe(false);
    expect(rawTexBlockMacroLine(`\\usepackage{${long}{${long}}${long}}`)).toBe(true);
    expect(rawTexBlockMacroLine(`\\usepackage{${long}{${long}{x}}}`)).toBe(false);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("a tail of 10,000,000 macros is read in linear time, and so is one that ends in prose", () => {
    const tail = "\\x".repeat(10_000_000);
    const started = Date.now();
    expect(rawTexBlockMacroLine(` \t\\pdfstringdef[]${tail}`)).toBe(true);
    expect(rawTexBlockMacroLine(` \t\\pdfstringdef[]${tail} prose`)).toBe(false);
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

// The review round of Session 335 (its mutation lens): nine edits of `rawTexBlockMacroLine` and its helpers survived every row above. The alphabets hold no `@` or `_` in a macro name, no upper case, no form feed before a
// line and no name or lead longer than a few characters, so a tail name that took an at sign or an underscore, a name looked up in lower case, a lead capped at 4,096 blanks, a name capped at 4,096 or 2^22 letters, and a
// form feed taken for a blank each changed an answer that no row asked about. Every UTF-16 code unit is put into each head and in place of each of its characters, and the long lead and the long name are compared with the old
// pattern (its name and blank classes are plain, so it still answers at every size).
describe("Session 335 review — rawTexBlockMacroLine on every code unit and on long names", () => {
  const SWEEP_HEADS = ["\\par \\ab", "\\par\\a{x}", " \\par", "\\section*{x}", "\\par \\ab[x]", "\\par \\cite*"];
  it("every head with one code unit put into it, or in place of one of its characters, is accepted or refused as the old pattern did", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnitEdit(SWEEP_HEADS));
    expect(disagreements).toEqual([]);
    // Recounted by a Python port of the old pattern (it reads the name lists from the source) and of the sweep: 7,733,248 lines.
    expect(counts).toEqual({ compared: countCodeUnitEdits(SWEEP_HEADS), block: 590_580 });
  }, HEAVY_ROW_MS);

  const REVIEW_STATED: Array<[string, boolean]> = [
    ["\\maketitle \\new@page", false],
    ["\\maketitle \\new_page", false],
    ["\\par \\a_b", false],
    ["\\maketitle \\MakeTextLowercase{x}", false],
    ["\\maketitle \\TextBf{x}", true],
    ["\\maketitle \\textbf{x}", false],
    ["\\maketitle \\CITE", true],
    ["\\maketitle \\Cite", false],
    ["\\maketitle \\cite", false],
    ["\f\\maketitle", false],
    ["\v\\maketitle", false],
    [NBSP + "\\maketitle", false],
  ];
  it.each(REVIEW_STATED.map(([line, block]) => [JSON.stringify(line), line, block] as const))("%s is stated by hand, by the old pattern and by the new function", (_label, line, block) => {
    expect(OLD_RAW_TEX_BLOCK_MACRO.test(line)).toBe(block);
    expect(rawTexBlockMacroLine(line)).toBe(block);
  });

  // The name lists are data, and the old pattern is built from the same exported strings as the function's sets, so deleting a name from a set is seen only by a line that asks about that name. The head names are all
  // asked (`byName`). A TAIL name is asked about by four names only (`\\x`, `\\textbf`, `\\citep*`, `\\foreignquote*`), so a set that lost its first or its last inline name (RV17, RV18) answered the same on every row.
  it("every inline name, plain, starred and with arguments, breaks a block line when it follows the macro", () => {
    const lines: string[] = [];
    for (const name of INLINE_NAMES) {
      for (const head of ["\\maketitle", "\\par", "\\usepackage{a}"]) {
        lines.push(`${head} \\${name}`, `${head} \\${name}{x}`, `${head}\\${name}[y]`);
      }
    }
    expect(lines.length).toBe(INLINE_NAMES.length * 9);
    for (const line of lines) {
      expect(OLD_RAW_TEX_BLOCK_MACRO.test(line)).toBe(false);
    }
    expect(lines.filter((line) => rawTexBlockMacroLine(line))).toEqual([]);
    // The same names with a letter after them are other names, and the line is a block again.
    expect(INLINE_NAMES.filter((name) => !rawTexBlockMacroLine(`\\maketitle \\${name.replace(/\*$/, "")}Zq`))).toEqual([]);
  });

  it.each([4_097, 5_000, 70_000, 4_300_000])("%i blanks before a macro, and a macro name of that many letters, are read as the old pattern read them", (n) => {
    const lines = [
      " ".repeat(n) + "\\maketitle",
      "\t".repeat(n) + "\\maketitle \\x",
      "\\maketitle \\" + "x".repeat(n),
      "\\maketitle \\" + "x".repeat(n) + "{a}",
      "\\maketitle \\" + "x".repeat(n) + "1",
      "\\maketitle" + "x".repeat(n),
      "\\" + "x".repeat(n),
      " ".repeat(n) + "\\maketitle prose",
    ];
    for (const line of lines) {
      expect(rawTexBlockMacroLine(line)).toBe(OLD_RAW_TEX_BLOCK_MACRO.test(line));
    }
    expect(lines.map((line) => rawTexBlockMacroLine(line))).toEqual([true, true, true, true, false, false, false, false]);
  }, HEAVY_ROW_MS);
});
