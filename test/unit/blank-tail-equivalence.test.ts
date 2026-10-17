import { describe, expect, it } from "vitest";
import { DIV_FENCE } from "../../src/core/qmd/model";
import { BOM, EM_SPACE, IDEOGRAPHIC, LS, NBSP, NEL, PS, compare, countStrings, everyString, seededRandom, slowestExec } from "./support/regex-equivalence";

// Session 319 — the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", parts (5) and (9). A pattern that reads a run of blanks and then `(.*)$` (or `(.+)$`) fails on a line
// holding a CR, U+2028 or U+2029 after the run, because `.` stops there, and the engine used to find that out once per way of splitting the run: it gave the blanks back one at a time and the tail re-read
// what was given back (quadratic: 100,000 blanks then CR took 6 s in one `exec`; `pathological-inputs.test.ts` has the documents). Each site below now ends its run in a lookahead (or, where the tail
// can match a blank-only rest by taking blanks back, asks once up front that the line holds no terminator). The cure is only sound if the new pattern answers what the old one answered on EVERY line, GROUPS
// INCLUDED (the callers read them, and an unset group is not an empty one), so the old spelling is kept here as the oracle (Learning 738). Learning 779: the lookahead idiom is an argument per site, never a copy.

interface Site {
  /** The pattern as Session 318 left it: the oracle. It must hold no copy of the guard. */
  old: RegExp;
  now: RegExp;
  /** Text the new source holds and the old one does not. */
  guard: string;
  /** The characters of the site's own grammar; every alphabet below is built from them. */
  marks: readonly string[];
  /** Beginnings that reach the blank run: each is accepted when followed by a blank run and then a letter. */
  heads: readonly string[];
  /** The blanks the run reads, the commonest first. */
  blanks: readonly string[];
  /** Indents the pattern also accepts in front of a head ("" is always tried). */
  indents: readonly string[];
  /** The longest string of the first enumeration (its alphabet is the marks, a blank, a tab, a CR, U+2028 and a letter). */
  shortLength: number;
}

const SITES: Record<string, Site> = {
  DIV_FENCE: { old: /^[ \t]*:{3,}(?!:)[ \t]*(.*)$/, now: DIV_FENCE, guard: "(?![ \\t])", marks: [":"], heads: [":::", "::::", ":::::"], blanks: [" ", "\t"], indents: [" ", "   ", "    ", "\t"], shortLength: 7 },
};

// How many strings of each comparison the OLD spelling accepts, counted from the old spelling alone: no comparison below can pass by both sides refusing everything, and an edit to the oracle moves the count.
// The three enumerated counts were also taken with Python's `re` (`.` and `$` spelled out), so the oracle's answers do not rest on V8 alone (Learning 780).
const ACCEPTED: Record<string, { short: number; wide: number; exotic: number; seeded: number; grid: number }> = {
  DIV_FENCE: { short: 651, wide: 61, exotic: 115, seeded: 34268, grid: 2400 },
};

const TERMINATORS = ["\r", LS, PS] as const;
const TAILS = ["", "x", "r", "x y", "{r}", "#", "x#", "\r", LS, PS, "x\r", " \r", "x ", "x\r "] as const;
const RUNS = [0, 1, 2, 3, 4, 31, 32, 33, 64, 100] as const;

const shortAlphabet = (site: Site): string[] => [...site.marks, " ", "\t", "\r", LS, "x"];
const wideAlphabet = (site: Site): string[] => [...site.marks, " ", "\t", "\r", "\n", LS, PS, "\f", NBSP, "x"];
const exoticAlphabet = (site: Site): string[] => [...site.marks, " ", "\t", "\v", BOM, IDEOGRAPHIC, EM_SPACE, NEL, "\r", "x"];

function* seededLines(site: Site, seed: number): Generator<string> {
  const random = seededRandom(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  for (let i = 0; i < 100_000; i++) {
    let line = pick(["", "", " ", "  ", "\t", " \t", "   ", "    "]) + pick(site.heads);
    line += pick(["", " ", "  ", "\t", " \t ", "         ", " ".repeat(Math.floor(random() * 40))]);
    line += pick(TAILS);
    if (random() < 0.4) line += pick(["\r", LS, PS, "\r\n", "\n"]);
    if (random() < 0.4) line += pick(["x", " ", "\t", pick(site.marks)]);
    yield line;
  }
}

function* gapGrid(site: Site): Generator<string> {
  for (const indent of ["", ...site.indents]) {
    for (const head of site.heads) {
      for (const run of RUNS) {
        for (const blank of site.blanks) {
          for (const tail of TAILS) {
            yield `${indent}${head}${blank.repeat(run)}${tail}`;
          }
        }
      }
    }
  }
}

/** Lines of `n` characters that the pattern ACCEPTS (or refuses) and that make a backtracking engine re-read a long suffix. */
function nearMissLines(site: Site, n: number): string[] {
  const lines: string[] = [];
  for (const head of site.heads) {
    for (const terminator of ["", ...TERMINATORS]) {
      for (const blank of site.blanks) {
        const run = blank.repeat(n);
        lines.push(
          `${head}${run}${terminator}`,
          `${head}${run}${terminator}x`,
          `${head}${run}x${terminator}x`,
          `${head}${run}x`,
          `${head}${run}x${run}${terminator}`,
          `${head}${run}${terminator}${run}`,
          (head + blank).repeat(Math.floor(n / (head.length + 1))) + terminator,
        );
        for (const indent of site.indents) {
          lines.push(`${indent}${run}${head}${run}${terminator}`);
        }
      }
    }
  }
  return lines;
}

function* longAcceptedLines(site: Site): Generator<string> {
  for (const n of [5_000, 50_000, 200_000]) {
    for (const head of site.heads) {
      for (const blank of site.blanks) {
        for (const tail of ["", "x", "x y", "r".repeat(n)]) {
          yield `${head}${blank.repeat(n)}${tail}`;
        }
        for (const indent of site.indents) {
          yield `${indent}${blank.repeat(n)}${head}${blank}x`;
        }
      }
    }
  }
}

describe("Session 319 — the blank-run patterns answer what their unguarded spellings answered", () => {
  const names = Object.keys(SITES);

  it("pins an accepted count for every site", () => {
    expect(Object.keys(ACCEPTED).sort()).toEqual(names.sort());
  });

  // The oracle is the UNGUARDED spelling. A later "tidy-up" that added the guard to this table would turn every comparison below into the new pattern against itself.
  it.each(names)("the oracle for %s is the spelling without the guard, and the new source holds it", (name) => {
    expect(SITES[name].old.source).not.toContain(SITES[name].guard);
    expect(SITES[name].now.source).toContain(SITES[name].guard);
  });

  it.each(names)("%s agrees, groups included, on every string of the site's marks, a blank, a tab, a CR, U+2028 and a letter, up to its length", (name) => {
    const site = SITES[name];
    const alphabet = shortAlphabet(site);
    const { compared, accepted, disagreements } = compare(site.old, site.now, everyString(alphabet, site.shortLength));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(alphabet.length, site.shortLength));
    expect(accepted).toBe(ACCEPTED[name]?.short);
  }, 300_000);

  it.each(names)("%s agrees, groups included, on every string of up to 5 characters over its marks, all four terminators, a form feed and a no-break space", (name) => {
    const site = SITES[name];
    const alphabet = wideAlphabet(site);
    const { compared, accepted, disagreements } = compare(site.old, site.now, everyString(alphabet, 5));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(alphabet.length, 5));
    expect(accepted).toBe(ACCEPTED[name]?.wide);
  }, 120_000);

  // `\s` is wider than `[ \t]`: a vertical tab, a byte order mark, an ideographic space and an em space are in it, a next-line character (U+0085) is not.
  it.each(names)("%s agrees, groups included, on every string of up to 5 characters over a vertical tab, a byte order mark, an ideographic space, an em space and a next-line character", (name) => {
    const site = SITES[name];
    const alphabet = exoticAlphabet(site);
    const { compared, accepted, disagreements } = compare(site.old, site.now, everyString(alphabet, 5));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(alphabet.length, 5));
    expect(accepted).toBe(ACCEPTED[name]?.exotic);
  }, 120_000);

  it.each(names)("%s agrees, groups included, on 100,000 seeded lines", (name) => {
    const site = SITES[name];
    const { compared, accepted, disagreements } = compare(site.old, site.now, seededLines(site, 319 + names.indexOf(name)));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(100_000);
    expect(accepted).toBe(ACCEPTED[name]?.seeded);
  }, 120_000);

  // A guard that quietly CAPPED a run (`[ \t]{0,4096}`) or a gap would be seen by neither the enumeration nor the sample. Every run length is swept on both sides of the usual caps.
  it.each(names)("%s agrees, groups included, on a grid of indent, run length, blank and tail on both sides of the usual caps", (name) => {
    const site = SITES[name];
    const { compared, accepted, disagreements } = compare(site.old, site.now, gapGrid(site));
    expect(disagreements).toEqual([]);
    expect(compared).toBe((1 + site.indents.length) * site.heads.length * RUNS.length * site.blanks.length * TAILS.length);
    expect(accepted).toBe(ACCEPTED[name]?.grid);
  }, 120_000);

  // The enumeration cannot see cost. The old spelling is quadratic on the near-miss lines (a long run then a terminator, in several shapes), so the answers are compared at 1,000 characters (a few
  // milliseconds for the old spelling) and the NEW pattern is timed on the same shapes at 50,000 (seconds a line for the old one, a millisecond or two for the new): a guard that goes missing, guards the
  // wrong character, or sits after a group that re-reads the tail passes every comparison and fails the clock.
  it.each(names)("%s answers each near-miss line of 1,000 characters like the old spelling, groups included", (name) => {
    const site = SITES[name];
    const lines = nearMissLines(site, 1_000);
    const { compared, accepted, disagreements } = compare(site.old, site.now, lines);
    expect(disagreements).toEqual([]);
    expect(compared).toBe(lines.length);
    expect(accepted).toBeGreaterThan(0);
  }, 120_000);

  it.each(names)("%s refuses or accepts each near-miss line of 50,000 characters in linear time", (name) => {
    const { slowestText, slow } = slowestExec(SITES[name].now, nearMissLines(SITES[name], 50_000), 100);
    expect({ slowestText, slow }).toEqual({ slowestText, slow: false });
  }, 120_000);

  // A CAP on a run (`{0,4096}`: the obvious other cure for a quadratic regex) would answer every line above as before and refuse a line the old spelling accepts. So lines each pattern ACCEPTS are
  // compared here at 5,000, 50,000 and 200,000 characters: the old spelling is linear on a line it accepts, so it stays the oracle. Every line is one it accepts, or both sides could be refusing.
  it.each(names)("%s answers each line it accepts, of 5,000 to 200,000 characters, like the old spelling, groups included", (name) => {
    const site = SITES[name];
    const { compared, accepted, disagreements } = compare(site.old, site.now, longAcceptedLines(site));
    expect(disagreements).toEqual([]);
    expect(compared).toBeGreaterThan(0);
    expect(accepted).toBe(compared);
  }, 120_000);
});
