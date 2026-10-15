import { describe, expect, it } from "vitest";
import { maskInlineCode } from "../../src/core/qmd/model";

// `maskInlineCode` reads inline code spans in one pass over the runs of backticks (Session 311). The rule it implements is the regex
// below, which it replaced because that regex is quadratic in a run of backticks with nothing to close it (300,000 backticks: 52 s).
// The regex is the ORACLE: it is not CommonMark's "next run of exactly N" (it closes at the first N in a row, inside a longer run too),
// and the scan must answer exactly what the regex answered, on every line, because the label index and the math detector have been
// reading the regex's answer for hundreds of sessions.
const LEGACY = /(`+)(?:(?!\1)[\s\S])*?\1/g;
const legacy = (line: string): string => line.replace(LEGACY, (span) => " ".repeat(span.length));

/** Every string over `alphabet` of length 1 to `maxLength`, plus the empty one. */
function* allStrings(alphabet: readonly string[], maxLength: number): Generator<string> {
  yield "";
  let layer = [""];
  for (let length = 1; length <= maxLength; length++) {
    const next: string[] = [];
    for (const prefix of layer) {
      for (const ch of alphabet) {
        const s = prefix + ch;
        next.push(s);
        yield s;
      }
    }
    layer = next;
  }
}

describe("maskInlineCode answers what the regex it replaced answered (Session 311)", () => {
  it("on every line of up to 18 characters made of backticks and one other character", () => {
    let checked = 0;
    for (const line of allStrings(["`", "a"], 18)) {
      const got = maskInlineCode(line);
      if (got !== legacy(line)) {
        expect(got).toBe(legacy(line)); // reports the first line that differs
      }
      checked++;
    }
    expect(checked).toBe(2 ** 19 - 1);
  });

  it("on every line of up to 9 characters over a backtick, a letter, a space and a newline", () => {
    let checked = 0;
    for (const line of allStrings(["`", "a", " ", "\n"], 9)) {
      const got = maskInlineCode(line);
      if (got !== legacy(line)) {
        expect(got).toBe(legacy(line));
      }
      checked++;
    }
    expect(checked).toBe((4 ** 10 - 1) / 3);
  });

  it("on 30,000 random lines of up to 80 characters whose backticks come in runs of 1 to 9 (a deterministic generator)", () => {
    let seed = 20261015;
    const next = (n: number): number => {
      // mulberry32: well spread in its low bits, which a plain LCG is not
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
    for (let c = 0; c < 30000; c++) {
      let line = "";
      const pieces = 1 + next(14);
      for (let i = 0; i < pieces; i++) {
        line += next(3) === 0 ? "text ".repeat(1 + next(3)) : "`".repeat(1 + next(9));
      }
      const got = maskInlineCode(line);
      if (got !== legacy(line)) {
        expect(got).toBe(legacy(line));
      }
    }
  });

  it("keeps the length of every line it masks, and leaves a line with no backtick alone", () => {
    expect(maskInlineCode("plain text, no code")).toBe("plain text, no code");
    expect(maskInlineCode("a `{#fig-x}` b")).toBe("a            b");
    expect(maskInlineCode("a `` ` `` b `c` d")).toHaveLength("a `` ` `` b `c` d".length);
  });
});
