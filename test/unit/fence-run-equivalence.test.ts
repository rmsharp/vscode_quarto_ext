import { describe, expect, it } from "vitest";
import { DIV_FENCE, FENCE_OPEN, INDENTED_CELL_FENCE_OPEN } from "../../src/core/qmd/model";

// Session 318 — the BACKLOG item "What is still quadratic or deep enough to overflow after Session 311", part (7). `FENCE_OPEN`, `INDENTED_CELL_FENCE_OPEN` and `DIV_FENCE` read a run of fence
// characters and then `(.*)$`, and `.` stops at a CR, U+2028 and U+2029: a line that holds one after the run can never match, and the engine used to find that out once per way of splitting the run
// (quadratic: 100,000 backticks then CR took 12 s; `pathological-inputs.test.ts` has the documents). Each run now ends in a lookahead, `(?!`)`, `(?!~)` or `(?!:)`, so a shorter run is refused at
// once. The cure is only sound if the new pattern answers what the old one answered on EVERY line, GROUPS INCLUDED (the callers read the run, the character and the info string), so the old
// spelling is kept here as the oracle (Learning 738).

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const NBSP = String.fromCharCode(0xa0);

const OLD: Record<string, RegExp> = {
  FENCE_OPEN: /^[ \t]*((?=([`~]))(?:`{3,}|~{3,}))(.*)$/,
  INDENTED_CELL_FENCE_OPEN: /^\s*((?=(`))`{3,})(.*)$/,
  DIV_FENCE: /^[ \t]*:{3,}[ \t]*(.*)$/,
};

const NEW: Record<string, RegExp> = { FENCE_OPEN, INDENTED_CELL_FENCE_OPEN, DIV_FENCE };

/** The two answers are the same match: both refuse, or both match at the same index with the same whole match and the same groups (an unset group included). */
function sameMatch(a: RegExpExecArray | null, b: RegExpExecArray | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.index !== b.index || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/** Every string of 0..maxLength characters over `alphabet`, shortest first, without holding a level in memory. */
function* everyString(alphabet: readonly string[], maxLength: number): Generator<string> {
  yield "";
  for (let length = 1; length <= maxLength; length++) {
    const digits = new Array<number>(length).fill(0);
    for (;;) {
      let text = "";
      for (let i = 0; i < length; i++) {
        text += alphabet[digits[i]];
      }
      yield text;
      let place = length - 1;
      while (place >= 0 && digits[place] === alphabet.length - 1) {
        digits[place] = 0;
        place--;
      }
      if (place < 0) {
        break;
      }
      digits[place]++;
    }
  }
}

/** Compare the two spellings of one pattern over `lines`; returns how many were compared and how many the OLD spelling matched, and the first few disagreements. */
function compare(name: string, lines: Iterable<string>): { compared: number; accepted: number; disagreements: string[] } {
  let compared = 0;
  let accepted = 0;
  const disagreements: string[] = [];
  for (const text of lines) {
    const expected = OLD[name].exec(text);
    compared++;
    if (expected !== null) accepted++;
    if (!sameMatch(NEW[name].exec(text), expected) && disagreements.length < 5) {
      disagreements.push(JSON.stringify(text));
    }
  }
  return { compared, accepted, disagreements };
}

describe("Session 318 — the fence-run patterns answer what their unguarded spellings answered", () => {
  it("compares the same three names in both tables", () => {
    expect(Object.keys(NEW).sort()).toEqual(Object.keys(OLD).sort());
  });

  // The three fence characters, a blank, a tab, a CR, a line separator and a letter: eight characters, strings of up to seven. Seven reach a two-blank indent, a run of three, a terminator and a letter,
  // which is the shortest string that tells a guard that stops at the longest run from one that does not.
  const SHORT = ["`", "~", ":", " ", "\t", "\r", LS, "x"];
  // How many of the strings each OLD pattern accepts, counted from the old spelling alone (and checked against a brute-force reading of the definition: blanks, a run of three or more of one
  // character, and a rest with no terminator): the comparison below cannot pass by both sides refusing everything.
  const ACCEPTED_SHORT: Record<string, number> = { FENCE_OPEN: 4634, INDENTED_CELL_FENCE_OPEN: 3983, DIV_FENCE: 2317 };

  it.each(Object.keys(OLD))("%s agrees, groups included, on every string of up to 7 characters over a backtick, a tilde, a colon, a blank, a tab, a CR, U+2028 and a letter", (name) => {
    const { compared, accepted, disagreements } = compare(name, everyString(SHORT, 7));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(2_396_745);
    expect(accepted).toBe(ACCEPTED_SHORT[name]);
  }, 300_000);

  // The other terminators and the two blanks only `\s` knows (a form feed, a no-break space), five characters over eleven.
  const WIDE = ["`", "~", ":", " ", "\t", "\r", "\n", LS, PS, "\f", NBSP];
  const ACCEPTED_WIDE: Record<string, number> = { FENCE_OPEN: 154, INDENTED_CELL_FENCE_OPEN: 185, DIV_FENCE: 77 };

  it.each(Object.keys(OLD))("%s agrees, groups included, on every string of up to 5 characters over all four terminators, a form feed and a no-break space", (name) => {
    const { compared, accepted, disagreements } = compare(name, everyString(WIDE, 5));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(177_156);
    expect(accepted).toBe(ACCEPTED_WIDE[name]);
  }, 120_000);

  // Seven characters hold neither a long info string nor a run past the usual caps, so a seeded sample stands beside the enumeration: an indent, a run of 0 to 7 of one fence character, a gap, an info
  // string, then maybe a terminator and a tail. The generator is Mulberry32, so a failure replays.
  const SEEDED: string[] = (() => {
    let state = 318;
    const random = (): number => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const lines: string[] = [];
    for (let i = 0; i < 100_000; i++) {
      const fence = pick(["`", "~", ":"]);
      let line = pick(["", "", " ", "  ", "   ", "    ", "\t", " \t", "\r", NBSP]) + fence.repeat(Math.floor(random() * 8));
      if (random() < 0.5) line += pick([" ", "\t", "  ", " \t "]);
      if (random() < 0.5) line += pick(["r", "{r}", "{python}", "x y", "{.callout-note}", fence, fence.repeat(3), "`", "~", ":"]);
      if (random() < 0.4) line += pick(["\r", LS, PS, "\r\n", "\n"]);
      if (random() < 0.4) line += pick(["x", " ", fence, "\t"]);
      lines.push(line);
    }
    return lines;
  })();
  const ACCEPTED_SEEDED: Record<string, number> = { FENCE_OPEN: 20_773, INDENTED_CELL_FENCE_OPEN: 12_954, DIV_FENCE: 10_518 }; // counted from the OLD spellings

  it.each(Object.keys(OLD))("%s agrees, groups included, on 100,000 seeded lines", (name) => {
    const { accepted, disagreements } = compare(name, SEEDED);
    expect(disagreements).toEqual([]);
    expect(accepted).toBe(ACCEPTED_SEEDED[name]);
  }, 120_000);

  // The enumeration cannot see cost. The old spelling is quadratic on exactly the lines it refuses, so the answers are compared at 1,000 characters (a few milliseconds for the old spelling) and the NEW
  // pattern is timed on the same shapes at 50,000 (about 3 s for the old one, well under 1 ms for the new): a lookahead that goes missing, guards the wrong character, or sits after a group that
  // re-reads the tail passes every comparison and fails the clock.
  const OTHER: Record<string, string> = { "`": "~", "~": "`", ":": "`" };
  type Shape = { what: string; build: (n: number, unit: string, term: string, blank: string) => string; blankTail?: boolean };
  const SHAPES: Shape[] = [
    { what: "one long run", build: (n, u, t) => u.repeat(n) + t },
    { what: "one long run and a letter after the terminator", build: (n, u, t) => `${u.repeat(n)}${t}x` },
    { what: "one long run and an info string", build: (n, u, t) => `${u.repeat(n)}r${t}` },
    { what: "a short indent and a long run", build: (n, u, t, b) => b.repeat(2) + u.repeat(n) + t },
    { what: "a long indent and a long run", build: (n, u, t, b) => b.repeat(n) + u.repeat(n) + t },
    { what: "a long run, then a long run of another fence character", build: (n, u, t) => u.repeat(n) + OTHER[u].repeat(n) + t },
    { what: "a long run, a blank, then another long run", build: (n, u, t, b) => u.repeat(n) + b + u.repeat(n) + t },
    { what: "many short runs", build: (n, u, t, b) => (u.repeat(3) + b).repeat(Math.floor(n / 4)) + t },
    { what: "a long run and a long blank run", build: (n, u, t, b) => u.repeat(n) + b.repeat(n) + t, blankTail: true },
    { what: "a long blank run alone", build: (n, _unit, t, b) => b.repeat(n) + t },
    { what: "a long run of terminators and then a fence", build: (n, u, t) => t.repeat(n) + u.repeat(3) + "x" },
  ];
  const UNITS: Record<string, string[]> = { FENCE_OPEN: ["`", "~"], INDENTED_CELL_FENCE_OPEN: ["`"], DIV_FENCE: [":"] };
  // `^\s*` also reads a CR and a line separator as part of its indent; the other two leading classes are `[ \t]*`.
  const BLANKS: Record<string, string[]> = { FENCE_OPEN: [" ", "\t"], INDENTED_CELL_FENCE_OPEN: [" ", "\t", "\r", LS], DIV_FENCE: [" ", "\t"] };
  const NEAR_MISS_LENGTH = 50_000;
  const SMALL_LENGTH = 1_000;

  function nearMissLines(name: string, n: number): { text: string; blankTail: boolean }[] {
    const lines: { text: string; blankTail: boolean }[] = [];
    for (const unit of UNITS[name]) {
      for (const term of ["", "\r", LS, PS]) {
        for (const blank of BLANKS[name]) {
          for (const shape of SHAPES) {
            lines.push({ text: shape.build(n, unit, term, blank), blankTail: shape.blankTail === true });
          }
        }
      }
    }
    return lines;
  }

  it.each(Object.keys(OLD))("%s answers each near-miss line of 1,000 characters like the old spelling, groups included", (name) => {
    const { compared, accepted, disagreements } = compare(name, nearMissLines(name, SMALL_LENGTH).map((line) => line.text));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(UNITS[name].length * 4 * BLANKS[name].length * SHAPES.length);
    expect(accepted).toBeGreaterThan(0);
  }, 120_000);

  it.each(Object.keys(OLD))("%s refuses or accepts each near-miss line of 50,000 characters in linear time", (name) => {
    let slowest = 0;
    let slowestText = "";
    for (const { text, blankTail } of nearMissLines(name, NEAR_MISS_LENGTH)) {
      if (name === "DIV_FENCE" && blankTail) {
        continue; // `:::`, a long blank run and a terminator: quadratic in `[ \t]*(.*)$`, which is part (5) of the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028"
      }
      const started = performance.now();
      NEW[name].exec(text);
      const took = performance.now() - started;
      if (took > slowest) {
        slowest = took;
        slowestText = JSON.stringify(text.slice(0, 12));
      }
      if (slowest >= 100) {
        break; // a quadratic spelling takes seconds a line: stop at the first one rather than time the rest
      }
    }
    expect({ slowestText, slow: slowest >= 100 }).toEqual({ slowestText, slow: false });
  }, 120_000);

  // A guard that quietly CAPPED a run (`{3,40}`) or a gap would be seen by neither the enumeration nor the sample. Every run and gap length is swept here on both sides of the usual caps
  // (1, 3, 8, 31/32/33, 41, 64, 100), for each indent, fence character, kind of blank and tail.
  const RUNS = [0, 1, 2, 3, 4, 5, 31, 32, 33, 64, 100];
  const GAPS = [0, 1, 3, 8, 31, 32, 41, 100];
  const TAILS = ["", "x", "r", "{r}", " {r}", "\r", LS, PS, "x\r", " \r", "`", "~", ":", "``", "~~~", ":::"];
  function* gapGrid(name: string): Generator<string> {
    for (const indent of ["", " ", "   ", "    ", "\t", " \t"]) {
      for (const unit of UNITS[name]) {
        for (const run of RUNS) {
          for (const gap of GAPS) {
            for (const blank of [" ", "\t"]) {
              for (const tail of TAILS) {
                yield `${indent}${unit.repeat(run)}${blank.repeat(gap)}${tail}`;
              }
            }
          }
        }
      }
    }
  }
  const ACCEPTED_GRID: Record<string, number> = { FENCE_OPEN: 17_160, INDENTED_CELL_FENCE_OPEN: 8_484, DIV_FENCE: 8_580 }; // counted from the OLD spellings and checked by brute force

  it.each(Object.keys(OLD))("%s agrees, groups included, on a grid of run and gap lengths on both sides of the usual caps", (name) => {
    const { compared, accepted, disagreements } = compare(name, gapGrid(name));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(6 * UNITS[name].length * RUNS.length * GAPS.length * 2 * TAILS.length);
    expect(accepted).toBe(ACCEPTED_GRID[name]);
  }, 120_000);
});
