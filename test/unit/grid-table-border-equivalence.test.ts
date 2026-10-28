import { describe, expect, it } from "vitest";
import { GRID_TABLE_BORDER } from "../../src/core/qmd/model";
import { compare, countStrings, everyString, seededRandom, slowestExec } from "./support/regex-equivalence";

// Session 333 — the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (1). `GRID_TABLE_BORDER` was
// `/^\+[-+=:]*[-=:][-+=:]*[ \t]*$/`: two stars around one required class, so a run of n class characters followed by a blank and one more class character cost n squared. It is now
// `/^\+(?=[-+=:]*[-=:])[-+=:]*[ \t]*$/` (a lookahead that asks once whether the run holds a `-`, `=` or `:`, then one star, then the blanks). The two classes of the tail (`[-+=:]` and `[ \t]`) share no
// character, so after the lookahead the rest has one way to match. This file keeps the OLD spelling as the oracle (Learning 738) and checks the two against each other, and both against a
// reading by definition that uses no regular expression (the counts below were recomputed by a Python port of that definition, `python3 -I`, not by this code).

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

describe("Session 333 — GRID_TABLE_BORDER against its old spelling", () => {
  const STATED: Array<[string, boolean]> = [
    ["+-", true], ["+=", true], ["+:", true], ["++-", true], ["+-+", true], ["+---+---+", true], ["+===+===+", true], ["+:--+--:+", true],
    ["+- ", true], ["+-\t", true], ["+-  \t ", true], ["+ ", false], ["+", false], ["", false], ["++", false], ["+++", false],
    ["+ -", false], ["+- -", false], ["+---+ ---+", false], ["+-\t-", false], ["+ - + - +", false], ["+x", false], ["+-x", false], ["+x-", false],
    [" +-", false], ["x+-", false], ["-+-", false], ["+-\n", false], ["+-\r", false],
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

  it("agrees with the definition on every string of up to 6 characters after a plus over the 7 (continuing the first enumeration)", () => {
    let compared = 0;
    const disagreements: string[] = [];
    for (const rest of everyString(ALPHABET, 6)) {
      const text = `+${rest}`;
      compared++;
      if (borderByDefinition(text) !== GRID_TABLE_BORDER.test(text) && disagreements.length < 5) {
        disagreements.push(JSON.stringify(text));
      }
    }
    expect({ compared, disagreements }).toEqual({ compared: 137_257, disagreements: [] });
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

  // Each line is a million characters or so. The old spelling's slope (four times per doubling, 1,507 ms at 20,000) puts one of them at about an hour (extrapolated, not run); the pattern is linear.
  // The limit is 100 ms for a line, far above the linear figure.
  it("reads a line of a million characters in time proportional to its length", () => {
    const million = 1_000_000;
    const lines = [
      `+${"-".repeat(million)} -`,
      `+${"=".repeat(million)} -`,
      `+${":".repeat(million)} -`,
      `+${"-+".repeat(million / 2)} -`,
      `+${"-".repeat(million)} +`,
      `+${"-".repeat(million)}  x`,
      `+${"+".repeat(million)} -`,
      `+-${" ".repeat(million)}-`,
      `+${"-".repeat(million)}${"\t".repeat(10)}-`,
    ];
    const { slow, slowestText } = slowestExec(GRID_TABLE_BORDER, lines, 100);
    expect(slow, `slowest line starts ${slowestText}`).toBe(false);
  }, 120_000);
});
