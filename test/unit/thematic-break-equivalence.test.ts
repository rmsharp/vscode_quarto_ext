import { describe, expect, it } from "vitest";
import { BULLET_THEMATIC_BREAK, DASH_COLUMN_LINE, DASH_ONLY_LINE, THEMATIC_BREAK, THEMATIC_BREAK_ANY_INDENT } from "../../src/core/qmd/model";

// Session 317 — the BACKLOG item "What is still quadratic or deep enough to overflow after Session 311", part (8). Five patterns read a run of `-`, `*` or `_` (or of dashes
// and blanks) as a QUANTIFIED GROUP, `(-[ \t]*){3,}` or `(?:[ \t]+-+)+`, and V8 keeps one entry of its regex backtrack stack per repetition of a group: a line of about two million
// characters overflowed it and `test` threw `RangeError`, from `scanRegions`, so every reader of the document answered nothing (`pathological-inputs.test.ts` has the documents).
// Each is now spelled as literal markers and a one-class tail, which V8 runs without a stack entry per character. The cure is only sound if the new pattern answers what the old one
// answered on EVERY line, so the old group spelling is kept here as the oracle (Learning 738). Every caller reads the answer with `.test`, so the answer compared is the boolean.

const OLD: Record<string, RegExp> = {
  THEMATIC_BREAK: /^ {0,3}((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/,
  THEMATIC_BREAK_ANY_INDENT: /^[ \t]*((\*[ \t]*){3,}|(-[ \t]*){3,}|(_[ \t]*){3,})$/,
  BULLET_THEMATIC_BREAK: /^[ \t]*(?:-[ \t]*){3,}$|^[ \t]*(?:\*[ \t]*){3,}$/,
  DASH_COLUMN_LINE: /^ {0,3}-+(?:[ \t]+-+)+[ \t]*$|^ {1,3}-+[ \t]*$/,
  DASH_ONLY_LINE: /^ {0,3}-+(?:[ \t]+-+)*[ \t]*$/,
};

const NEW: Record<string, RegExp> = { THEMATIC_BREAK, THEMATIC_BREAK_ANY_INDENT, BULLET_THEMATIC_BREAK, DASH_COLUMN_LINE, DASH_ONLY_LINE };

/** Every string of 0..maxLength characters over `alphabet`, shortest first. */
function* everyString(alphabet: readonly string[], maxLength: number): Generator<string> {
  let level: string[] = [""];
  yield "";
  for (let length = 1; length <= maxLength; length++) {
    const next: string[] = [];
    for (const prefix of level) {
      for (const ch of alphabet) {
        next.push(prefix + ch);
      }
    }
    level = next;
    yield* level;
  }
}

describe("Session 317 — the thematic-break and dash-rule patterns answer what their group spellings answered", () => {
  it("compares the same five names in both tables", () => {
    expect(Object.keys(NEW).sort()).toEqual(Object.keys(OLD).sort());
  });

  // The three markers, a blank, a tab, a newline (a `$` that must stay an end-of-input anchor) and a letter that is none of them. Seven characters reach a three-space indent, three
  // markers and a fourth space, which is the shortest string that tells ` {0,3}` from `[ \t]*`.
  const ALPHABET = ["*", "-", "_", " ", "\t", "\n", "x"];

  // How many of the 960,800 strings each OLD pattern accepts, counted from the old group spelling alone: the comparison below cannot pass by both sides refusing everything.
  const ACCEPTED: Record<string, number> = { THEMATIC_BREAK: 2598, THEMATIC_BREAK_ANY_INDENT: 3699, BULLET_THEMATIC_BREAK: 2466, DASH_COLUMN_LINE: 1371, DASH_ONLY_LINE: 1618 };

  it.each(Object.keys(OLD))("%s agrees on every string of up to 7 characters over `* - _`, a blank, a tab, a newline and a letter", (name) => {
    const oldPattern = OLD[name];
    const newPattern = NEW[name];
    let compared = 0;
    let accepted = 0;
    const disagreements: string[] = [];
    for (const text of everyString(ALPHABET, 7)) {
      const expected = oldPattern.test(text);
      compared++;
      if (expected) accepted++;
      if (newPattern.test(text) !== expected && disagreements.length < 5) {
        disagreements.push(JSON.stringify(text));
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(960_800);
    expect(accepted).toBe(ACCEPTED[name]);
  }, 120_000);

  // Seven characters hold a three-space indent and four markers but not a long mixed line, so a seeded sample of lines up to 50 characters stands beside the enumeration: half are
  // built only from one marker and blanks (so most are accepted), the rest carry one or two foreign characters at random places. The generator is Mulberry32, so a failure replays.
  const LONG_LINES: string[] = (() => {
    let state = 317;
    const random = (): number => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
    const lines: string[] = [];
    for (let i = 0; i < 100_000; i++) {
      const marker = pick(["*", "-", "_"]);
      const characters: string[] = Array.from({ length: Math.floor(random() * 50) }, () => (random() < 0.6 ? marker : pick([" ", " ", "\t"])));
      if (random() < 0.5) {
        for (let foreign = 1 + Math.floor(random() * 2); foreign > 0 && characters.length > 0; foreign--) {
          characters[Math.floor(random() * characters.length)] = pick(["*", "-", "_", "x", "\n", " "]);
        }
      }
      lines.push(pick(["", "", " ", "  ", "   ", "    ", "\t", " \t"]) + characters.join(""));
    }
    return lines;
  })();

  it.each(Object.keys(OLD))("%s agrees on 100,000 seeded lines of up to 50 characters", (name) => {
    const disagreements: string[] = [];
    let accepted = 0;
    for (const text of LONG_LINES) {
      const expected = OLD[name].test(text);
      if (expected) accepted++;
      if (NEW[name].test(text) !== expected && disagreements.length < 5) {
        disagreements.push(JSON.stringify(text));
      }
    }
    expect(disagreements).toEqual([]);
    expect(accepted).toBeGreaterThan(5000); // a comparison where both sides refuse every line would pass; this makes sure each pattern accepts a real share of the sample
  }, 120_000);
});
