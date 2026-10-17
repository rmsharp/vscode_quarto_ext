import { describe, expect, it } from "vitest";
import { parseOutputPath } from "../../src/core/render-args";
import { LS, NBSP, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 320 — the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (4), `parseOutputPath`. The path quarto prints after `Output created:` was read with a lazy
// `(.+?)[ \t]*$`, which re-reads the rest of a blank run at every character it takes (quadratic: 2.1 s for 32,000 blanks inside one line, 21 s for 100,000; `pathological-inputs.test.ts` has the document
// row). The rewrite reads the line once and strips the trailing blanks itself, so the cure is only sound if it returns what the old function returned for EVERY output, the odd answers included
// (a line that is only blanks after the colon answers its last blank). The old function is kept here, verbatim, as the oracle (Learning 738).
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
function oldParseOutputPath(output: string): string | null {
  const clean = output.replace(ANSI_PATTERN, "");
  const re = /Output created:[ \t]*(.+?)[ \t]*$/gm;
  let match: RegExpExecArray | null;
  let last: string | null = null;
  while ((match = re.exec(clean)) !== null) {
    last = match[1];
  }
  return last;
}

const PREFIX = "Output created:";
const CLOCK_LIMIT_MS = 100;
const NEAR_MISS_CHARACTERS = 50_000;
const SEEDED_OUTPUTS = 100_000;

/** The pieces of an output, so that a sequence holds the prefix as ONE token (a character alphabet cannot spell it within a length an enumeration reaches). */
const TOKENS_A = [PREFIX, " ", "\t", "x", "\r", "\n", LS, "Output", "\x1b[1m"] as const;
const TOKENS_B = [PREFIX, " ", "x", "\t", PS, "\f", NBSP, "\x1b[0m", "\r\n"] as const;

/** How many sequences of each enumeration the OLD function answers (not null), counted from the old function alone, so a comparison cannot pass by both sides answering nothing (the two enumerated counts were also taken with Python's `re`, `.` and `$` spelled out). */
const ANSWERED = { a: 167_190, b: 197_610, seeded: 41_371 };

function compareOutputs(outputs: Iterable<string>): { compared: number; answered: number; disagreements: string[] } {
  let compared = 0;
  let answered = 0;
  const disagreements: string[] = [];
  for (const output of outputs) {
    const expected = oldParseOutputPath(output);
    compared++;
    if (expected !== null) answered++;
    if (parseOutputPath(output) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(output));
  }
  return { compared, answered, disagreements };
}

describe("Session 320 — parseOutputPath answers what the lazy pattern answered", () => {
  it.each([
    ["a path", "Output created: out.html", "out.html"],
    ["a path with ANSI colour around it", "\x1b[1mOutput created: out.html\x1b[22m", "out.html"],
    ["the last of several lines", "Output created: a.html\nOutput created: b.pdf\n", "b.pdf"],
    ["a path with a blank inside it", "Output created: my report.html", "my report.html"],
    ["trailing blanks are dropped", "Output created: out.html \t ", "out.html"],
    ["leading blanks are dropped", "Output created:\t  out.html", "out.html"],
    ["no blank after the colon", "Output created:out.html", "out.html"],
    ["a CRLF line end", "Output created: out.html\r\nDone\r\n", "out.html"],
    ["a lone CR ends the line", "Output created: out.html\rmore", "out.html"],
    ["U+2028 ends the line", `Output created: out.html${LS}more`, "out.html"],
    ["the prefix twice on a line is one match that holds the second", "Output created: Output created: x", "Output created: x"],
    // The oddities of the lazy pattern: `.+?` needs a character, so a line that is only blanks after the colon gives one back, and an empty one gives nothing.
    ["only blanks after the colon: the last blank", "Output created:   ", " "],
    ["only blanks after the colon: a tab is the last blank", "Output created: \t", "\t"],
    ["nothing after the colon", "Output created:", null],
    ["nothing after the colon, then another line", "Output created:\nOutput created: ok", "ok"],
    ["nothing after the colon on the last line keeps the earlier answer", "Output created: ok\nOutput created:", "ok"],
    ["no marker", "Render complete.", null],
  ])("%s", (_name, output, expected) => {
    expect(oldParseOutputPath(output)).toBe(expected);
    expect(parseOutputPath(output)).toBe(expected);
  });

  // The answer of the old function on a line that holds a long run is checked at 1,000 characters (a millisecond for it); the new function is TIMED on the same shapes at 50,000 (the old one takes seconds a line there).
  const nearMiss = (n: number): string[] => {
    const blanks = " ".repeat(n);
    return [
      `${PREFIX} a${blanks}b`,
      `${PREFIX}${blanks}`,
      `${PREFIX} a${blanks}`,
      `${PREFIX}${blanks}x`,
      `${PREFIX} a${blanks}\rb`,
      `${PREFIX} a${blanks}${LS}b`,
      `${PREFIX} a${"\t".repeat(n)}b`,
      `${PREFIX} a${blanks}b${blanks}`,
      `${PREFIX} a${blanks}b${blanks}c`,
      `${PREFIX}${blanks}a${blanks}`,
      `${PREFIX}${PREFIX}${blanks}x`,
      `${PREFIX} ${"a ".repeat(Math.floor(n / 2))}b`,
      // A run that exists only AFTER the colour escapes are stripped: the text holds no visible run (a research agent found 5.4 / 21.3 / 85.3 ms at 8,000 / 16,000 / 32,000 on the old pattern).
      `${PREFIX} a${" \x1b[0m".repeat(Math.floor(n / 5))}b`,
      `${PREFIX} a b\n`.repeat(Math.floor(n / 15)),
      `${PREFIX}\n`.repeat(Math.floor(n / 16)),
      PREFIX.repeat(Math.floor(n / 15)),
      `${PREFIX} ${"x".repeat(n)}`,
      `${"x".repeat(n)}${PREFIX} a${blanks}b`,
      `\x1b[1m${PREFIX} a${blanks}b\x1b[22m`,
      `${"\x1b[".repeat(Math.floor(n / 2))}${PREFIX} a`,
      `\x1b[${"1;".repeat(Math.floor(n / 2))}${PREFIX} a`,
    ];
  };

  it("answers each near-miss output of 1,000 characters like the lazy pattern", () => {
    const outputs = nearMiss(1_000);
    const { compared, answered, disagreements } = compareOutputs(outputs);
    expect(disagreements).toEqual([]);
    expect(compared).toBe(outputs.length);
    expect(answered).toBeGreaterThan(10);
  });

  it("reads each near-miss output of 50,000 characters in linear time", () => {
    let slowest = 0;
    let slowestText = "";
    for (const output of nearMiss(NEAR_MISS_CHARACTERS)) {
      const started = performance.now();
      parseOutputPath(output);
      const took = performance.now() - started;
      if (took > slowest) {
        slowest = took;
        slowestText = JSON.stringify(output.slice(0, 24));
      }
    }
    expect({ slowestText, slow: slowest >= CLOCK_LIMIT_MS }).toEqual({ slowestText, slow: false });
  }, 120_000);

  it("agrees on every sequence of up to 6 of the prefix, a blank, a tab, a letter, a CR, a LF, U+2028, a word and an ANSI colour", () => {
    const { compared, answered, disagreements } = compareOutputs(everyString(TOKENS_A, 6));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(TOKENS_A.length, 6));
    expect(answered).toBe(ANSWERED.a);
  }, 120_000);

  it("agrees on every sequence of up to 6 of the prefix, a blank, a letter, a tab, U+2029, a form feed, a no-break space, an ANSI reset and a CRLF", () => {
    const { compared, answered, disagreements } = compareOutputs(everyString(TOKENS_B, 6));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(TOKENS_B.length, 6));
    expect(answered).toBe(ANSWERED.b);
  }, 120_000);

  it("agrees on 100,000 seeded outputs of up to 14 pieces", () => {
    const random = seededRandom(320);
    const pieces = [PREFIX, `${PREFIX} `, "out.html", "my file.html", " ", "  ", "\t", "\n", "\r\n", "\r", LS, PS, "x y", "x", "\x1b[1m", "\x1b[22m", "Output", ":", "created:"];
    const outputs: string[] = [];
    for (let i = 0; i < SEEDED_OUTPUTS; i++) {
      let output = "";
      for (let k = Math.floor(random() * 15); k > 0; k--) output += pieces[Math.floor(random() * pieces.length)];
      outputs.push(output);
    }
    const { compared, answered, disagreements } = compareOutputs(outputs);
    expect(disagreements).toEqual([]);
    expect(compared).toBe(SEEDED_OUTPUTS);
    expect(answered).toBe(ANSWERED.seeded);
    // The sample must hold every kind of line end, or it could pass without ever ending a line the way the pattern's `$` does.
    expect(["\n", "\r", LS, PS].map((terminator) => outputs.some((output) => output.includes(terminator)))).toEqual([true, true, true, true]);
  }, 120_000);

  // A row run at a smaller size, or allowed a longer time, would pass on the parent too.
  it("keeps the sizes, the clock limit and the pieces its rows are built on", () => {
    expect([NEAR_MISS_CHARACTERS, CLOCK_LIMIT_MS, SEEDED_OUTPUTS]).toEqual([50_000, 100, 100_000]);
    expect([...TOKENS_A]).toEqual([PREFIX, " ", "\t", "x", "\r", "\n", LS, "Output", "\x1b[1m"]);
    expect([...TOKENS_B]).toEqual([PREFIX, " ", "x", "\t", PS, "\f", NBSP, "\x1b[0m", "\r\n"]);
  });
});
