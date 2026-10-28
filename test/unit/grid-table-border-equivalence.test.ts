import { describe, expect, it } from "vitest";
import { GRID_TABLE_BORDER } from "../../src/core/qmd/model";
import { compare, countStrings, everyString, IDEOGRAPHIC, LS, NBSP, PS, seededRandom, slowestExec } from "./support/regex-equivalence";

// Session 333 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (1). `GRID_TABLE_BORDER` was
// `/^\+[-+=:]*[-=:][-+=:]*[ \t]*$/`: two stars around one required class, so a run of n class characters followed by a blank and one more class character cost n squared. It is now
// `/^\+(?=[-+=:]*[-=:])[-+=:]*[ \t]*$/` (a lookahead that asks once whether the run holds a `-`, `=` or `:`, then one star, then the blanks). The two classes of the tail (`[-+=:]` and `[ \t]`) share no
// character, so after the lookahead the rest has one way to match. This file keeps the OLD spelling as the oracle (Learning 738) and checks the two against each other on every enumeration below; a
// reading by definition that uses no regular expression is checked against both on the stated rows, on the 137,257-string and on the 111,111-string enumerations (the counts below were recomputed by a Python port of that definition, `python3 -I`, not by this code).

const OLD_GRID_TABLE_BORDER = /^\+[-+=:]*[-=:][-+=:]*[ \t]*$/;

/** The definition, in words: a plus, then class characters (`-`, `+`, `=`, `:`) holding at least one of `-`, `=`, `:`, then blanks (space or tab), and nothing else. */
function borderByDefinition(text: string): boolean {
  if (!text.startsWith("+")) {
    return false;
  }
  let end = text.length;
  while (end > 1 && (text[end - 1] === " " || text[end - 1] === "\t")) {
    end--;
  }
  let hasRequired = false;
  for (let i = 1; i < end; i++) {
    const c = text[i];
    if (c !== "-" && c !== "+" && c !== "=" && c !== ":") {
      return false;
    }
    if (c !== "+") {
      hasRequired = true;
    }
  }
  return hasRequired;
}

const ALPHABET = ["+", "-", "=", ":", " ", "\t", "x"];
// Three more characters that a respelling could take into a class by mistake (Session 333 review): `|` (a table cell bar), a form feed and a no-break space.
const WIDER_ALPHABET = [...ALPHABET, "|", "\f", NBSP];

describe("Session 333 — GRID_TABLE_BORDER against its old spelling", () => {
  const STATED: Array<[string, boolean]> = [
    ["+-", true], ["+=", true], ["+:", true], ["++-", true], ["+-+", true], ["+---+---+", true], ["+===+===+", true], ["+:--+--:+", true],
    ["+- ", true], ["+-\t", true], ["+-  \t ", true], ["+++-", true], ["+ ", false], ["+", false], ["", false], ["++", false], ["+++", false],
    ["+ -", false], ["+- -", false], ["+---+ ---+", false], ["+-\t-", false], ["+ - + - +", false], ["+x", false], ["+-x", false], ["+x-", false],
    [" +-", false], ["x+-", false], ["-+-", false], ["+-\n", false], ["+-\r", false],
    // Characters outside the two classes that a widened class would take (Session 333 review): a bar in the run, and a form feed, a vertical tab, a no-break space, an ideographic space, a line and a paragraph separator as a blank.
    ["+-|-", false], ["+-|", false], ["+|", false], ["+-\f", false], ["+-\v", false], [`+-${NBSP}`, false], [`+-${IDEOGRAPHIC}`, false], [`+-${LS}`, false], [`+-${PS}`, false],
    ["+\f-", false], [`+${NBSP}-`, false],
  ];

  it.each(STATED)("answers %j with %s", (text, expected) => {
    expect(OLD_GRID_TABLE_BORDER.test(text)).toBe(expected);
    expect(GRID_TABLE_BORDER.test(text)).toBe(expected);
    expect(borderByDefinition(text)).toBe(expected);
  });

  it("agrees on every string of up to 7 characters after a plus over 7 characters (960,800 strings, 42,933 accepted)", () => {
    const result = compare(OLD_GRID_TABLE_BORDER, GRID_TABLE_BORDER, (function* () {
      for (const rest of everyString(ALPHABET, 7)) {
        yield `+${rest}`;
      }
    })());
    expect(result.compared).toBe(countStrings(ALPHABET.length, 7));
    expect(result.compared).toBe(960_800);
    expect(result.accepted).toBe(42_933);
    expect(result.disagreements).toEqual([]);
  }, 120_000);

  it("agrees on every string of up to 5 characters over the 7, whatever it starts with (19,608 strings, 594 accepted)", () => {
    const result = compare(OLD_GRID_TABLE_BORDER, GRID_TABLE_BORDER, everyString(ALPHABET, 5));
    expect(result).toEqual({ compared: 19_608, accepted: 594, disagreements: [] });
  }, 120_000);

  it("agrees on every string of up to 9 characters after a plus over `-=: x` (2,441,406 strings, 44,271 accepted)", () => {
    const result = compare(OLD_GRID_TABLE_BORDER, GRID_TABLE_BORDER, (function* () {
      for (const rest of everyString(["-", "=", ":", " ", "x"], 9)) {
        yield `+${rest}`;
      }
    })());
    expect(result).toEqual({ compared: 2_441_406, accepted: 44_271, disagreements: [] });
  }, 120_000);

  it("agrees on every string of up to 10 characters after a plus over `-+ x` (1,398,101 strings, 4,017 accepted)", () => {
    const result = compare(OLD_GRID_TABLE_BORDER, GRID_TABLE_BORDER, (function* () {
      for (const rest of everyString(["-", "+", " ", "x"], 10)) {
        yield `+${rest}`;
      }
    })());
    expect(result).toEqual({ compared: 1_398_101, accepted: 4_017, disagreements: [] });
  }, 120_000);

  it("agrees with the definition, for both spellings, on every string of up to 6 characters after a plus over the 7 (continuing the first enumeration)", () => {
    let compared = 0;
    const disagreements: string[] = [];
    for (const rest of everyString(ALPHABET, 6)) {
      const text = `+${rest}`;
      compared++;
      if ((borderByDefinition(text) !== GRID_TABLE_BORDER.test(text) || borderByDefinition(text) !== OLD_GRID_TABLE_BORDER.test(text)) && disagreements.length < 5) {
        disagreements.push(JSON.stringify(text));
      }
    }
    expect({ compared, disagreements }).toEqual({ compared: 137_257, disagreements: [] });
  }, 120_000);

  it("agrees with the definition, for both spellings, on every string of up to 5 characters after a plus over the 7 and `|`, a form feed and a no-break space (111,111 strings, 2,547 accepted)", () => {
    let compared = 0;
    let accepted = 0;
    const disagreements: string[] = [];
    for (const rest of everyString(WIDER_ALPHABET, 5)) {
      const text = `+${rest}`;
      const byDefinition = borderByDefinition(text);
      compared++;
      if (byDefinition) {
        accepted++;
      }
      if ((byDefinition !== GRID_TABLE_BORDER.test(text) || byDefinition !== OLD_GRID_TABLE_BORDER.test(text)) && disagreements.length < 5) {
        disagreements.push(JSON.stringify(text));
      }
    }
    expect({ compared, accepted, disagreements }).toEqual({ compared: 111_111, accepted: 2_547, disagreements: [] });
  }, 120_000);

  it("agrees on 300,000 seeded strings of up to 64 characters, most of them border-shaped", () => {
    const random = seededRandom(333);
    const pool = ["-", "-", "-", "-", "+", "=", ":", " ", " ", "\t", "x"];
    const lines = (function* () {
      for (let i = 0; i < 300_000; i++) {
        const length = Math.floor(random() * 65);
        let text = random() < 0.9 ? "+" : "";
        for (let k = 0; k < length; k++) {
          text += pool[Math.floor(random() * pool.length)];
        }
        yield text;
      }
    })();
    const result = compare(OLD_GRID_TABLE_BORDER, GRID_TABLE_BORDER, lines);
    expect(result.compared).toBe(300_000);
    expect(result.accepted).toBeGreaterThan(1_000);
    expect(result.disagreements).toEqual([]);
  }, 120_000);

  it("agrees on a grid of runs: a plus, a dash run, a blank run, another run and a tail", () => {
    const sizes = [0, 1, 2, 3, 10, 100, 1000];
    const tails = ["", "-", "x", "+", " ", " -", "=", ":"];
    const lines: string[] = [];
    for (const a of sizes) {
      for (const b of sizes) {
        for (const c of sizes) {
          for (const tail of tails) {
            lines.push(`+${"-".repeat(a)}${" ".repeat(b)}${"=".repeat(c)}${tail}`);
            lines.push(`+${"+".repeat(a)}${"\t".repeat(b)}${":".repeat(c)}${tail}`);
          }
        }
      }
    }
    const result = compare(OLD_GRID_TABLE_BORDER, GRID_TABLE_BORDER, lines);
    expect(result.compared).toBe(7 * 7 * 7 * 8 * 2);
    expect(result.accepted).toBeGreaterThan(100);
    expect(result.disagreements).toEqual([]);
  }, 120_000);

  // A comparator that never saw a difference would pass every row above, so it is shown two wrong cures (Learning 850).
  it("the comparison sees a cure that drops the lookahead and a cure that asks only the first character", () => {
    const lines = [...everyString(ALPHABET, 4)].map((rest) => `+${rest}`);
    const noLookahead = /^\+[-+=:]*[ \t]*$/;
    const firstOnly = /^\+(?=[-=:])[-+=:]*[ \t]*$/;
    expect(compare(OLD_GRID_TABLE_BORDER, noLookahead, lines).disagreements.length).toBeGreaterThan(0);
    expect(compare(OLD_GRID_TABLE_BORDER, firstOnly, lines).disagreements.length).toBeGreaterThan(0);
    expect(compare(OLD_GRID_TABLE_BORDER, GRID_TABLE_BORDER, lines).disagreements).toEqual([]);
  });

  it("matches the whole line and nothing but the whole line: index 0, no groups", () => {
    for (const text of ["+-", "+---+", "+=== ", "+-\t"]) {
      const match = GRID_TABLE_BORDER.exec(text);
      expect(match).not.toBeNull();
      expect(match?.index).toBe(0);
      expect(match?.[0]).toBe(text);
      expect(match).toHaveLength(1);
    }
  });

  // The shapes are tried at 20,000 characters first and at a million after, because the pattern is one synchronous call: the old spelling takes 1,507 ms on 20,000 (four times per doubling, so about an hour on a
  // million, extrapolated and not run), a runner cannot interrupt it, and a spelling that restores a quadratic would otherwise hang the suite on the first million-character line (the runner killed an unanchored
  // mutant of this pattern only at its 600 s limit). `slowestExec` stops at the first line past 100 ms, so such a spelling fails on a 20,000-character line in about a second.
  it("reads a line of 20,000 and then of a million characters in time proportional to its length, and answers on them", () => {
    const shapes = (size: number): string[] => [
      `+${"-".repeat(size)} -`,
      `+${"=".repeat(size)} -`,
      `+${":".repeat(size)} -`,
      `+${"-+".repeat(size / 2)} -`,
      `+${"-".repeat(size)} +`,
      `+${"-".repeat(size)}  x`,
      `+${"+".repeat(size)} -`,
      `+-${" ".repeat(size)}-`,
      `+${"-".repeat(size)}${"\t".repeat(10)}-`,
    ];
    // The same pattern accepts a border of any length, so a repetition cap (`{0,30000}`) or a blank class that stops short would pass every row above; these are timed too (a quadratic spelling that is slow on an accepted line stops at 20,000).
    const accepted = (size: number): string[] => [
      `+${"-".repeat(size)}`,
      `+-${" ".repeat(size)}`,
      `+${"+".repeat(size)}-`,
      `+${"=".repeat(size)}+`,
      `+${"-".repeat(size)}${"\t".repeat(10)}`,
    ];
    const lines = [...shapes(20_000), ...accepted(20_000), ...shapes(1_000_000), ...accepted(1_000_000)];
    const { slow, slowestText } = slowestExec(GRID_TABLE_BORDER, lines, 100);
    expect(slow, `slowest line starts ${slowestText}`).toBe(false);
    expect(shapes(1_000_000).map((text) => GRID_TABLE_BORDER.test(text))).toEqual(shapes(1_000_000).map(() => false));
    expect(accepted(1_000_000).map((text) => GRID_TABLE_BORDER.test(text))).toEqual(accepted(1_000_000).map(() => true));
  }, 120_000);
});
