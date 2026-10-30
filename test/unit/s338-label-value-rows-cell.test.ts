import { describe, expect, it } from "vitest";
import { findLabel, indexLabels } from "../../src/core/refs";

// Session 338, part C of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" (group g02), site (4): `CELL_LABEL_VALUE`, the value of a cell's `#| label:` option.
//
// THE DEFECT. The pattern read the value as `^["']?([\p{L}\p{N}_][\p{L}\p{N}_:.-]*)` under the `u` flag. V8 keeps one entry of its regex backtrack stack per character of a class-star over letters and numbers,
// and the entry doubles once the line holds a character above U+00FF (the subject is then stored with two bytes a character). `indexLabels` threw `RangeError: Maximum call stack size exceeded` from a label whose
// name is 4,194,284 letters long after `fig-` (4,194,288 characters of id), and a thrown RangeError answers NOTHING for the whole document: no label index, so no completion and no go-to-definition
// (`findLabel` reads the same index).
//
// MEASURED at HEAD `fe6aaec` (Session 338, one fresh process per probe, the lower bound verified OK first, `indexLabels` and `findLabel` with no engine hint, "knitr" and "jupyter"): `#| label: fig-` + letters, last OK
// 4,194,283 letters, first throw 4,194,284, for a line that holds one character above U+00FF in the id (`a` x n-1 then U+4E2D) AND for one that holds it after the id (`fig-aaa 中`). A line of characters up to U+00FF
// does NOT throw at any size V8 can hold: 500,000,000 letters (the longest string V8 allows is 536,870,888 characters) read in 11 s. For such a subject V8 compiles the star as a greedy loop that pushes nothing
// per character. So the Latin-1 form of every row below PASSES on the base commit, and is the guard that the cure keeps its answer; the wide form of every row is the one that throws.
//
// Every wide size is about twice the first throw (Learning 775). The answer is what the old pattern gives at a size where it does not throw, stated by hand for 4 letters and function of the run for the long one.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

describe("the clock helper of the Session 338 cell label rows", () => {
  it("timed reports the milliseconds the run took and hands back its result", () => {
    const { result, ms } = timed(() => {
      const until = Date.now() + 60;
      while (Date.now() < until) {
        // spin
      }
      return "done";
    });
    expect(result).toBe("done");
    expect(ms).toBeGreaterThanOrEqual(50);
  });
});

const WIDE_LETTER = "中"; // a CJK letter above U+00FF: one such character puts the whole line on two bytes a character
const FEW = 4;
const MANY = 8_400_000; // twice 4,194,284, the first throw of the pattern (4,194,283 reads; Node 22.23, HEAD fe6aaec)
// Chosen from the cured read: it took about 0.3 to 1 s for the longest row (measured with the cure in place), the old pattern throws and a quadratic reading would take hours.
const LIMIT_MS = 10_000;

type Form = "latin1" | "wide";
/** The letters of the id after the kind prefix: `n` letters, the last of them U+4E2D in the wide form (so the id itself holds the character above U+00FF). */
const runOf = (form: Form, n: number): string => (form === "latin1" ? "a".repeat(n) : "a".repeat(n - 1) + WIDE_LETTER);

type Hint = undefined | "knitr" | "jupyter";
type Entry = [id: string, kind: string, line: number, column: number];

const shown = (entries: Entry[]): unknown[] => entries.map(([id, kind, line, column]) => [id.length <= 40 ? id : `${id.slice(0, 12)}...${id.slice(-6)} (${id.length})`, kind, line, column]);
const same = (got: Entry[], want: Entry[]): boolean => got.length === want.length && got.every((g, i) => g[0] === want[i][0] && g[1] === want[i][1] && g[2] === want[i][2] && g[3] === want[i][3]);

const index = (text: string, hint: Hint): Entry[] => indexLabels(text, hint).map((l) => [l.id, l.kind, l.line, l.column]);
const lookup = (id: string) => (text: string, hint: Hint): Entry[] => {
  const found = findLabel(text, id, hint);
  return found === null ? [] : [[found.id, found.kind, found.line, found.column]];
};

interface Row {
  site: string;
  /** The document, from the letters of the id. */
  build: (run: string) => string;
  read: (text: string, run: string) => Entry[];
  answer: (run: string) => Entry[];
  /** The literal answer for the 4-letter Latin-1 run, stated by hand. */
  short: Entry[];
}

const cell = (lang: string, optionLine: (run: string) => string): ((run: string) => string) => (run) => `Intro.\n\n\`\`\`{${lang}}\n${optionLine(run)}\nplot()\n\`\`\`\n`;
const python = (optionLine: (run: string) => string) => cell("python", optionLine);

describe("Session 338 — a cell's `#| label:` value of millions of letters that a pattern read as a class-star (the BACKLOG item \"Eleven more places that throw RangeError\", site 4)", () => {
  const ROWS: Row[] = [
    {
      site: "indexLabels, no engine hint: a python cell, `#| label: fig-` + n letters",
      build: python((run) => `#| label: fig-${run}`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "indexLabels with the knitr hint: the same cell (the label stays: the cell makes a figure)",
      build: python((run) => `#| label: fig-${run}`),
      read: (text) => index(text, "knitr"),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "indexLabels with the jupyter hint: the same cell",
      build: python((run) => `#| label: fig-${run}`),
      read: (text) => index(text, "jupyter"),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "indexLabels with the knitr hint: an R cell",
      build: cell("r", (run) => `#| label: fig-${run}`),
      read: (text) => index(text, "knitr"),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "indexLabels: a `tbl-` label",
      build: python((run) => `#| label: tbl-${run}`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`tbl-${run}`, "tbl", 3, 10]],
      short: [["tbl-aaaa", "tbl", 3, 10]],
    },
    {
      site: "indexLabels: a double-quoted value (the quote is consumed: the id's column moves one right)",
      build: python((run) => `#| label: "fig-${run}"`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 11]],
      short: [["fig-aaaa", "fig", 3, 11]],
    },
    {
      site: "indexLabels: a single-quoted value",
      build: python((run) => `#| label: 'fig-${run}'`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 11]],
      short: [["fig-aaaa", "fig", 3, 11]],
    },
    {
      site: "indexLabels: the id is the LONGEST identifier prefix, the pattern is not anchored at the end (`$x` stays out)",
      build: python((run) => `#| label: fig-${run}$x`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "indexLabels: a blank and more text after the id (the id stops at the blank)",
      build: python((run) => `#| label: fig-${run} the caption`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "indexLabels: a short label in the NEXT cell is found as well",
      build: (run) => `Intro.\n\n\`\`\`{python}\n#| label: fig-${run}\nplot()\n\`\`\`\n\n\`\`\`{python}\n#| label: fig-ok\nplot()\n\`\`\`\n`,
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10], ["fig-ok", "fig", 8, 10]],
      short: [["fig-aaaa", "fig", 3, 10], ["fig-ok", "fig", 8, 10]],
    },
    {
      site: "findLabel, no engine hint: the long id is found, with its line and column",
      build: python((run) => `#| label: fig-${run}`),
      read: (text, run) => lookup(`fig-${run}`)(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "findLabel with the knitr hint",
      build: python((run) => `#| label: fig-${run}`),
      read: (text, run) => lookup(`fig-${run}`)(text, "knitr"),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "findLabel with the jupyter hint",
      build: python((run) => `#| label: fig-${run}`),
      read: (text, run) => lookup(`fig-${run}`)(text, "jupyter"),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10]],
      short: [["fig-aaaa", "fig", 3, 10]],
    },
    {
      site: "findLabel: the SHORT label of the next cell is found past the long one",
      build: (run) => `Intro.\n\n\`\`\`{python}\n#| label: fig-${run}\nplot()\n\`\`\`\n\n\`\`\`{python}\n#| label: fig-ok\nplot()\n\`\`\`\n`,
      read: (text) => lookup("fig-ok")(text, undefined),
      answer: () => [["fig-ok", "fig", 8, 10]],
      short: [["fig-ok", "fig", 8, 10]],
    },
  ];

  const FORMS: Array<[Form, string]> = [
    ["latin1", "every character up to U+00FF"],
    ["wide", "the id ends in U+4E2D"],
  ];

  it.each(ROWS.flatMap((row) => FORMS.map(([form, what]) => [row.site, form, what, row] as const)))("%s [%s: %s]: is read without throwing, in linear time, and the answer is the stated one with 4 letters and with the long run", (_site, form, _what, row) => {
    expect(row.answer("aaaa")).toEqual(row.short); // the stated short answer is the function of the run at 4 Latin-1 letters
    const shortRun = runOf(form, FEW);
    expect(row.read(row.build(shortRun), shortRun)).toEqual(row.answer(shortRun));
    expect(row.read(row.build("aaaa"), "aaaa")).toEqual(row.short);
    const run = runOf(form, MANY);
    const text = row.build(run);
    expect(text.length).toBeGreaterThan(run.length); // the timed document holds the whole run
    const { result, ms } = timed(() => row.read(text, run));
    const want = row.answer(run);
    expect(shown(result)).toEqual(shown(want));
    expect(same(result, want)).toBe(true);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The character above U+00FF is not in the id at all: it stands after it, in the value (`fig-aaa 中`) or elsewhere in the document line. The first throw is the same, 4,194,284, as measured with the id's own letter.
  it.each([
    ["after the id, in the value", (run: string) => `#| label: fig-${run} ${WIDE_LETTER}`],
    ["in a trailing comment of the line", (run: string) => `#| label: fig-${run} # ${WIDE_LETTER}`],
  ])("a character above U+00FF %s: the long id is read, with the answer of the Latin-1 form", (_where, optionLine) => {
    const build = python(optionLine);
    expect(index(build("aaaa"), undefined)).toEqual([["fig-aaaa", "fig", 3, 10]]);
    const run = "a".repeat(MANY);
    const text = build(run);
    const { result, ms } = timed(() => index(text, undefined));
    expect(shown(result)).toEqual(shown([[`fig-${run}`, "fig", 3, 10]]));
    expect(same(result, [[`fig-${run}`, "fig", 3, 10]])).toBe(true);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("builds a different document for every row", () => {
    const texts = ROWS.map((row) => row.build("aaaa"));
    expect(new Set(texts).size).toBe(8); // the engine-hint and findLabel rows share their documents: 8 documents for 14 rows
  });

  it("keeps the sizes, the limit and the character the Session 338 cell label rows are built on", () => {
    expect([FEW, MANY, LIMIT_MS, WIDE_LETTER.charCodeAt(0)]).toEqual([4, 8_400_000, 10_000, 0x4e2d]);
    expect(MANY).toBeGreaterThanOrEqual(2 * 4_194_284); // twice the first throw (4,194,284 at HEAD fe6aaec; 4,194,283 reads)
    expect(runOf("wide", 5)).toBe("aaaa中");
    expect(runOf("latin1", 5)).toBe("aaaaa");
    expect(ROWS.length).toBe(14);
  });
});
