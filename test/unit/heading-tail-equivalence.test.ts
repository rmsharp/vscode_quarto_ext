import { describe, expect, it } from "vitest";
import { atxClosingPandocStart, headingAttributeStart } from "../../src/core/qmd/model";
import { LS, NBSP, countStrings, everyString, seededRandom, slowestExec } from "./support/regex-equivalence";

// Session 330 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", parts (2) and (3).
// `buildHeading` cut a heading's closing-hash run (the pandoc `markdown*` readers) and its trailing attribute block by two regexes, `ATX_CLOSING_PANDOC` and `HEADING_ATTRIBUTE`, each opening with a
// backslash-parity lookbehind and each failing only at the end of the line. They are now `atxClosingPandocStart` and `headingAttributeStart`, which scan back from the end and answer the INDEX the
// regex matched at (-1 for none). That is only sound if the answer is the SAME on EVERY text, so the two regexes are kept below, copied character for character from the parent `c0647be`
// (`src/core/qmd/model.ts` before `72f4762`), as the oracle (Learning 738). Both matches run to the END of the text (`$`), so the cut `text.slice(0, index)` is what `text.replace(regex, "")` did;
// `oldIndex` checks that for every string it is asked about.
// The pinned counts (how many strings of each enumeration the OLD regex matched) must not come from the code under test: `tools/heading-tail-count/count_matched.py` derives them from the
// definition of the two patterns, with no regular expression for the match itself.

// ---- The OLD patterns, copied from the parent `c0647be` by a script. ----
const OLD_ATX_CLOSING_PANDOC = /(?<=(?:^|[^\\])(?:\\\\)*)#+[ \t]*$/;
const OLD_HEADING_ATTRIBUTE = /(?<=(?:^|[^\\])(?:\\\\)*)\{[^}]*\}[ \t]*$/;

/** Where the old pattern matches in `text`, or -1; throws if the match stops short of the end of the text, which the cut in `buildHeading` relies on. */
function oldIndex(pattern: RegExp, text: string): number {
  const match = pattern.exec(text);
  if (match === null) {
    return -1;
  }
  if (match[0].length !== text.length - match.index) {
    throw new Error(`the old pattern's match stops short of the end of ${JSON.stringify(text)}`);
  }
  return match.index;
}

type Site = { name: string; old: RegExp; now: (text: string) => number };
const CLOSING: Site = { name: "ATX_CLOSING_PANDOC", old: OLD_ATX_CLOSING_PANDOC, now: atxClosingPandocStart };
const ATTRIBUTE: Site = { name: "HEADING_ATTRIBUTE", old: OLD_HEADING_ATTRIBUTE, now: headingAttributeStart };

/** Compare a site's old pattern with its new function over `texts`: how many were compared, how many the OLD pattern matched, and the first few disagreements. */
function compareSite(site: Site, texts: Iterable<string>): { compared: number; matched: number; disagreements: string[] } {
  let compared = 0;
  let matched = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldIndex(site.old, text);
    compared++;
    if (expected !== -1) {
      matched++;
    }
    const now = site.now(text);
    if (now !== expected && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${expected}, now ${now}`);
    }
  }
  return { compared, matched, disagreements };
}

// Every string of up to `maxLength` characters over an alphabet. The alphabets hold the characters each pattern reads (`#`, `{`, `}`, the backslash, a space and a tab), a letter, and for the wide ones the
// characters a nearby pattern could confuse with them: a carriage return, a no-break space, a line separator (`[ \t]` takes a space and a tab only, and `$` only the end of the text).
const NARROW_CLOSING = ["#", "\\", " ", "\t", "a"];
const WIDE_CLOSING = ["#", "\\", " ", "\t", "\r", NBSP, LS, "a"];
const NARROW_ATTRIBUTE = ["{", "}", "\\", " ", "\t", "a"];
const WIDE_ATTRIBUTE = ["{", "}", "\\", " ", "\r", NBSP, "#", LS];
// Tokens, not characters: runs of backslashes of every length up to three (parity), doubled braces, an escaped brace, a whole attribute block, a hash with a blank either side, a surrogate pair.
const TOKENS_CLOSING = ["#", "##", "\\", "\\\\", "\\\\\\", " ", "a", "\\#", "# ", " #", "\t", "\u{1F600}"];
const TOKENS_ATTRIBUTE = ["{", "}", "{{", "}}", "\\", "\\\\", "\\\\\\", " ", "a", "\\{", "{#sec-a}", "\t", "#", "\u{1F600}"];

const ENUMERATIONS: Array<{ site: Site; label: string; alphabet: readonly string[]; maxLength: number; matched: number }> = [
  { site: CLOSING, label: "5 characters, up to 10", alphabet: NARROW_CLOSING, maxLength: 10, matched: 3_390_387 },
  { site: CLOSING, label: "8 characters, up to 7", alphabet: WIDE_CLOSING, maxLength: 7, matched: 355_045 },
  { site: CLOSING, label: "12 tokens, up to 6", alphabet: TOKENS_CLOSING, maxLength: 6, matched: 1_252_818 },
  { site: ATTRIBUTE, label: "6 characters, up to 9", alphabet: NARROW_ATTRIBUTE, maxLength: 9, matched: 1_292_184 },
  { site: ATTRIBUTE, label: "8 characters, up to 7", alphabet: WIDE_ATTRIBUTE, maxLength: 7, matched: 126_454 },
  { site: ATTRIBUTE, label: "14 tokens, up to 6", alphabet: TOKENS_ATTRIBUTE, maxLength: 6, matched: 850_965 },
];

// A seeded sample of longer texts: 0 to 12 pieces, each repeated 1 to 3 times. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 300_000;
const SEEDED = [
  { site: CLOSING, seed: 3301, pieces: ["#", "#", "\\", "\\", " ", "\t", "a", "ab", "# ", "\\\\", "#a"], matched: 86_589 },
  { site: ATTRIBUTE, seed: 3302, pieces: ["{", "{", "}", "\\", "\\", " ", "\t", "a", "ab", "{#sec-a}", "\\\\", "{a}", "#"], matched: 51_171 },
];
function* seededTexts(seed: number, pieces: readonly string[], count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const parts = Math.floor(next() * 13);
    let text = "";
    for (let part = 0; part < parts; part++) {
      text += pieces[Math.floor(next() * pieces.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield text;
  }
}

// Run lengths around every parity and every boundary, and the long ones: a run of backslashes before a run of `#` or `{`, with blanks, closing braces and a tail after.
const RUNS = [0, 1, 2, 3, 4, 5, 8, 9, 100, 101];
function* closingGrid(): Generator<string> {
  for (const before of ["", "a", "#", "a#", " "]) {
    for (const backslashes of RUNS) {
      for (const hashes of RUNS) {
        for (const blanks of [0, 1, 3]) {
          for (const tail of ["", "b", "#", "\\"]) {
            yield `${before}${"\\".repeat(backslashes)}${"#".repeat(hashes)}${" ".repeat(blanks)}${tail}`;
          }
        }
      }
    }
  }
}
function* attributeGrid(): Generator<string> {
  for (const before of ["", "a", "}", "a}"]) {
    for (const backslashes of RUNS) {
      for (const braces of RUNS) {
        for (const closers of [0, 1, 2]) {
          for (const blanks of [0, 1, 3]) {
            for (const tail of ["", "y"]) {
              yield `${before}${"\\".repeat(backslashes)}${"{".repeat(braces)}x${"}".repeat(closers)}${" ".repeat(blanks)}${tail}`;
            }
          }
        }
      }
    }
  }
}
const GRIDS = [
  { site: CLOSING, texts: closingGrid, compared: 5 * 10 * 10 * 3 * 4, matched: 2_756 },
  { site: ATTRIBUTE, texts: attributeGrid, compared: 4 * 10 * 10 * 3 * 3 * 2, matched: 1_020 },
];

describe("Session 330 — the heading's closing-hash run and attribute block: the new functions answer what the old regexes matched", () => {
  it.each(ENUMERATIONS.map((e) => [`${e.site.name}, every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareSite(e.site, everyString(e.alphabet, e.maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.matched).toBe(e.matched);
  });

  it.each(SEEDED.map((s) => [`${s.site.name}, ${SEEDED_COUNT.toLocaleString("en-US")} seeded texts (seed ${s.seed})`, s] as const))("%s", (_label, s) => {
    const result = compareSite(s.site, seededTexts(s.seed, s.pieces, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.matched).toBe(s.matched);
  });

  it.each(GRIDS.map((g) => [`${g.site.name}, the run-length grid`, g] as const))("%s", (_label, g) => {
    const result = compareSite(g.site, g.texts());
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(g.compared);
    expect(result.matched).toBe(g.matched);
  });

  // Answers stated by hand from the two definitions (not read off the oracle), each checked against BOTH the old pattern and the new function.
  const CLOSING_ANSWERS: Array<[string, number]> = [
    ["", -1], ["#", 0], ["a #", 2], ["a#", 1], ["a#b", -1], ["#a", -1], ["a ##  ", 2], ["a #\t", 2], ["# #", 2], ["a # b #", 6],
    ["\\#", -1], // an escaped hash is no closing run
    ["\\##", 2], // the first hash is escaped, the second one closes
    ["\\\\#", 2], // an escaped backslash does not escape the hash
    ["\\\\\\#", -1], ["\\\\\\##", 4], ["a \\#", -1], ["a \\##", 4], ["a \\\\#", 4],
    ["a#\r", -1], ["a#" + NBSP, -1], ["a#" + LS, -1], // only a space and a tab are blanks, and `$` is the end of the text
  ];
  const ATTRIBUTE_ANSWERS: Array<[string, number]> = [
    ["", -1], ["{", -1], ["}", -1], ["{}", 0], ["{x}", 0], ["a {x}", 2], ["a {x} ", 2], ["a {x}\t", 2], ["a {x}b", -1], ["a {x}{y}", 5], ["{a}{b}", 3], ["a {x}}", -1], [" {x} ", 1],
    ["a \\{x}", -1], // an escaped brace opens nothing
    ["a \\\\{x}", 4], // an escaped backslash does not escape the brace
    ["a {{x}", 2], ["a \\{{x}", 4], ["{{}", 0], ["\\{{}", 2], ["a }{x}", 3], ["x\\\\\\{y}", -1], ["x\\\\\\\\{y}", 5],
    ["a {x}\r", -1], ["a {x}" + NBSP, -1],
  ];
  it.each([
    [CLOSING.name, CLOSING, CLOSING_ANSWERS],
    [ATTRIBUTE.name, ATTRIBUTE, ATTRIBUTE_ANSWERS],
  ] as const)("%s: the stated answers hold for the old pattern and the new function", (_name, site, answers) => {
    expect(answers.map(([text]) => oldIndex(site.old, text))).toEqual(answers.map(([, index]) => index));
    expect(answers.map(([text]) => site.now(text))).toEqual(answers.map(([, index]) => index));
  });

  // The comparison can fail: the single-character lookbehind `(?<!\\)` (the shortcut an agent proposed for part (2); it changes `a\##`) disagrees with the old pattern, and the old pattern agrees with itself.
  it("a comparison that is not exact reports it, and an exact one reports nothing", () => {
    const closing = compareSite({ ...CLOSING, now: (text) => text.search(/(?<!\\)#+[ \t]*$/) }, everyString(NARROW_CLOSING, 6));
    expect(closing.disagreements.length).toBe(5);
    const attribute = compareSite({ ...ATTRIBUTE, now: (text) => text.search(/(?<!\\)\{[^}]*\}[ \t]*$/) }, everyString(NARROW_ATTRIBUTE, 6));
    expect(attribute.disagreements.length).toBe(5);
    for (const site of [CLOSING, ATTRIBUTE]) {
      expect(compareSite({ ...site, now: (text) => oldIndex(site.old, text) }, everyString(["#", "{", "}", "\\", " "], 7)).disagreements).toEqual([]);
    }
  });

  // Long ACCEPTED lines, where the old pattern is fast too: the whole run is read and the answers agree.
  const ACCEPTED_LINES: Array<[string, Site, string[]]> = [
    [CLOSING.name, CLOSING, ["#", "a #", `a ${"#".repeat(200_000)}`, `a \\${"#".repeat(200_000)}`, "#".repeat(200_000), `a${"#".repeat(100_000)}${" ".repeat(100_000)}`, `a #${"\t".repeat(200_000)}`]],
    [ATTRIBUTE.name, ATTRIBUTE, [`a {${"x".repeat(200_000)}}`, `a {${"x".repeat(100_000)}}${" ".repeat(100_000)}`, `a ${"\\{".repeat(100_000)}{x}`, `${"}".repeat(100_000)}{x}`, `a ${"{".repeat(200_000)}}`]],
  ];
  it.each(ACCEPTED_LINES)("%s: accepted lines of up to 200,000 characters are cut at the same index", (_name, site, lines) => {
    const result = compareSite(site, lines);
    expect(result.disagreements).toEqual([]);
    expect(result.matched).toBe(lines.length); // every one of them is accepted
  });

  // The near-miss lines: the OLD pattern is slow on each (at `oldSize`, 250 to 500 ms against a 100 ms limit, so a clock row built on the shape can fail on the parent), the NEW function reads a million characters of it at once.
  const NEAR_MISS: Array<{ site: Site; label: string; oldSize: number; build: (n: number) => string }> = [
    { site: CLOSING, label: "a run of `#` inside the text", oldSize: 12_000, build: (n) => `a ${"#".repeat(n)}b` },
    { site: CLOSING, label: "a run of backslashes", oldSize: 36_000, build: (n) => "\\".repeat(n) },
    { site: CLOSING, label: "a run of backslashes and a `#` inside the text", oldSize: 36_000, build: (n) => `${"\\".repeat(n)}#b` },
    { site: ATTRIBUTE, label: "a run of `{` with no `}`", oldSize: 28_000, build: (n) => `a ${"{".repeat(n)}` },
    { site: ATTRIBUTE, label: "a run of `{`, a `}` and text", oldSize: 28_000, build: (n) => `a ${"{".repeat(n)}} b` },
    { site: ATTRIBUTE, label: "a run of backslashes", oldSize: 36_000, build: (n) => "\\".repeat(n) },
  ];
  it.each(NEAR_MISS.map((row) => [`${row.site.name}, ${row.label}`, row] as const))("%s: the old pattern is slow on it", (_label, row) => {
    expect(slowestExec(row.site.old, [row.build(row.oldSize)], 100).slow).toBe(true);
  });
  it.each(NEAR_MISS.map((row) => [`${row.site.name}, ${row.label}`, row] as const))("%s: the new function reads 1,000,000 characters of it in linear time", (_label, row) => {
    const text = row.build(1_000_000);
    const started = Date.now();
    const index = row.site.now(text);
    const ms = Date.now() - started;
    expect(index).toBe(-1); // none of the shapes holds a closing run or a block
    expect(ms).toBeLessThan(200);
  });

  // The sentinel for this file's own constants: an oracle that drifted, or sizes and counts that shrank, would pass on the parent too.
  it("keeps the old patterns, the sizes and the seeds the Session 330 rows are built on", () => {
    expect(OLD_ATX_CLOSING_PANDOC.source).toBe(String.raw`(?<=(?:^|[^\\])(?:\\\\)*)#+[ \t]*$`);
    expect(OLD_HEADING_ATTRIBUTE.source).toBe(String.raw`(?<=(?:^|[^\\])(?:\\\\)*)\{[^}]*\}[ \t]*$`);
    expect([OLD_ATX_CLOSING_PANDOC.flags, OLD_HEADING_ATTRIBUTE.flags]).toEqual(["", ""]);
    expect([SEEDED_COUNT, SEEDED.map((s) => s.seed), RUNS]).toEqual([300_000, [3301, 3302], [0, 1, 2, 3, 4, 5, 8, 9, 100, 101]]);
    expect(NEAR_MISS.map((row) => row.oldSize)).toEqual([12_000, 36_000, 36_000, 28_000, 28_000, 36_000]);
    expect(ENUMERATIONS.map((e) => `${e.site.name}:${e.alphabet.length}:${e.maxLength}`)).toEqual([
      "ATX_CLOSING_PANDOC:5:10", "ATX_CLOSING_PANDOC:8:7", "ATX_CLOSING_PANDOC:12:6",
      "HEADING_ATTRIBUTE:6:9", "HEADING_ATTRIBUTE:8:7", "HEADING_ATTRIBUTE:14:6",
    ]);
  });
});
