import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { appendCitations, type Citation, parseCitations } from "../../src/core/citations";

// Session 338, part E of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" -- site (8), the array spread in `loadCitations` (`src/providers/citation.ts`):
// `all.push(...parseCitations(content))`.
//
// NOT A REGEX: a call with a spread argument puts one stack slot per element on the call stack, so a bibliography with more entries than the stack holds throws `RangeError: Maximum call stack size exceeded`. The
// `try` around it has an EMPTY `catch` (a missing or unreadable bibliography must not break completion), so the throw is swallowed and the whole file adds NO citation to the completion: `@` offers nothing.
//
// Measured at HEAD `fe6aaec` (Session 338, Node 22.23.3, one fresh process per probe, the lower bound run and OK before each bisect), driving the real adapter `CitationCompletionProvider.provideCompletionItems` with `vscode`
// stubbed and one bibliography of N entries named in the front matter (scratchpad only, never committed): the completion lists all N citekeys up to 106,319 entries and answers `undefined` (nothing) from 106,320, in BibTeX
// and in CSL-JSON alike. The bare spread `all.push(...parseCitations(content))` outside the adapter threw from 110,428 entries in both formats (the adapter's own frames cost a few thousand). The BACKLOG item says 125,770
// (125,768 in CSL-JSON): that figure came from another process and the first throw moves with the stack the process starts with, so the size below is 250,000 entries, about twice the first throw (Learning 775): 2.35 times the one measured in the adapter and 1.99 times the BACKLOG's.
//
// THE ADAPTER IS NOT UNIT-TESTABLE (it imports `vscode`), so the accumulation lives in `core/citations.ts` as `appendCitations` and the rows below drive THAT with the real parser, the way the adapter's loop does: the
// parsed list of each file appended to one list, in the order the front matter names the files. The ONE line these rows cannot run is the call in the adapter; `test/integration/suite/citation.test.ts` (`npm run test:integration`,
// which takes over the screen and was not run) is the only run of it. The last describe reads the adapter's SOURCE for that line, which is a wiring gate and not a run.

const COUNT = 250_000;
const SHORT = 3;
/** The first throw measured on the base through the real adapter (last OK 106,319): the guard row at the end keeps COUNT about twice of it (Learning 775). */
const FIRST_THROW = 106_320;
/** 3 s for the append alone: the cure appends 135,000 citations in 1.4 ms (a scratch probe, fresh process), and a list copied for every element (a `concat` in a loop) took 12,271 ms at that size, so an append that is quadratic still fails this limit at 250,000. */
const LIMIT_MS = 3000;
const ROW_TIMEOUT_MS = 40_000;

const bibtex = (count: number, from = 0): string => {
  const parts: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    parts[i] = `@article{k${from + i},\n  title = {Title ${from + i}},\n  author = {Doe, Jane},\n  year = {${2000 + ((from + i) % 25)}}\n}`;
  }
  return parts.join("\n");
};

const cslJson = (count: number, from = 0): string => {
  const items: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    items[i] = `{"id":"k${from + i}","title":"Title ${from + i}","author":[{"family":"Doe","given":"Jane"}],"issued":{"date-parts":[[${2000 + ((from + i) % 25)}]]}}`;
  }
  return `[${items.join(",")}]`;
};

/** The answer the parser gives for entry `n` of either format: the same citation for the same number. */
const expectedCitation = (n: number): Citation => ({ key: `k${n}`, title: `Title ${n}`, author: "Doe, Jane", year: String(2000 + (n % 25)) });

/** The adapter's loop over the files the front matter names: parse each, append, in order. */
const accumulate = (contents: string[]): { all: Citation[]; ms: number } => {
  const all: Citation[] = [];
  let ms = 0;
  for (const content of contents) {
    const parsed = parseCitations(content);
    const started = Date.now();
    appendCitations(all, parsed);
    ms += Date.now() - started;
  }
  return { all, ms };
};

/** Every disagreement (the first few) between `all` and the citations numbered `0 .. count - 1`, in order. */
function disagreements(all: Citation[], count: number): string[] {
  const bad: string[] = [];
  const note = (message: string): void => {
    if (bad.length < 5) bad.push(message);
  };
  if (all.length !== count) note(`length ${all.length}, expected ${count}`);
  for (let i = 0; i < count && i < all.length; i++) {
    const c = all[i];
    const e = expectedCitation(i);
    if (c.key !== e.key || c.title !== e.title || c.author !== e.author || c.year !== e.year) note(`citation ${i}: ${JSON.stringify(c)}`);
  }
  return bad;
}

describe("Session 338 -- the helpers of these rows read a SHORT bibliography the way the long rows expect (so a wrong expectation fails here first)", () => {
  it.each([
    ["BibTeX", bibtex],
    ["CSL-JSON", cslJson],
  ])("%s: a short bibliography gives the citations the long rows expect", (_label, build) => {
    expect(disagreements(accumulate([build(SHORT)]).all, SHORT)).toEqual([]);
  });
});

describe("Session 338 -- a bibliography of more than a hundred thousand entries must still be offered by the citation completion (the BACKLOG item \"Eleven more places that throw RangeError\", part E, site 8)", () => {
  it("BibTeX, 250,000 entries in one file: every citation is accumulated, in file order", () => {
    const { all, ms } = accumulate([bibtex(COUNT)]);
    expect(disagreements(all, COUNT)).toEqual([]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  it("CSL-JSON, 250,000 entries in one file: every citation is accumulated, in file order", () => {
    const { all, ms } = accumulate([cslJson(COUNT)]);
    expect(disagreements(all, COUNT)).toEqual([]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  it("two files, a BibTeX of 130,000 then a CSL-JSON of 120,000: 250,000 citations, the first file's first (the order the front matter names them)", () => {
    const { all } = accumulate([bibtex(130_000), cslJson(120_000, 130_000)]);
    expect(disagreements(all, COUNT)).toEqual([]);
  }, ROW_TIMEOUT_MS);

  it("a small file after a long one: the long one's citations stay where they were", () => {
    const { all } = accumulate([bibtex(COUNT), cslJson(2, COUNT)]);
    expect(disagreements(all, COUNT + 2)).toEqual([]);
  }, ROW_TIMEOUT_MS);
});

describe("Session 338 -- the adapter routes the accumulation through the core function (a wiring gate: it reads the SOURCE of src/providers/citation.ts, it does not run it)", () => {
  // Comments are stripped first: the adapter's docstring may name the old spelling to say it is forbidden.
  const code = readFileSync(path.join(__dirname, "../../src/providers/citation.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("loadCitations appends each file's citations with appendCitations(all, parseCitations(content))", () => {
    expect(code).toContain("appendCitations(all, parseCitations(content))");
  });

  it("appendCitations is imported from the core module", () => {
    expect(code).toMatch(/import\s*\{[^}]*\bappendCitations\b[^}]*\}\s*from\s*"\.\.\/core\/citations"/);
  });

  it("no call in the adapter has a spread argument (a list that grows with a file must never be spread into a call)", () => {
    expect(code).not.toMatch(/\(\s*\.\.\./);
    expect(code).not.toMatch(/,\s*\.\.\.\w/);
  });
});

describe("Session 338 -- the size of these rows", () => {
  it("is about twice the first throw measured on the base, so the spread would have thrown", () => {
    expect(COUNT).toBeGreaterThanOrEqual(2 * FIRST_THROW);
    expect(COUNT).toBeLessThan(3 * FIRST_THROW);
  });
});
