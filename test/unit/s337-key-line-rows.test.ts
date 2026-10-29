import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { jupyterKernelLanguage } from "../../src/core/qmd/jupyter-kernel";
import { buildOutline, findHeadings, type OutlineSymbol } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";

// Session 337, part 8 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" -- the jupyter reader's `KEY_LINE`, `(?:-[ \t]+)*`.
//
// The class of Sessions 335 and 336: V8 keeps one entry of its regex backtrack stack per repetition of a quantified GROUP, so a pattern that reads a front matter line as dashes and blanks in a group throws
// `RangeError: Maximum call stack size exceeded` once ONE line is long enough, and the RangeError answers NOTHING for the whole document. Here the group is `-[ \t]+` (a dash and its blanks), in `KEY_LINE`
// (`src/core/qmd/jupyter-kernel.ts`, read by `seesThrough` for every unindented line and by `leavesOpen` for every line) and in the `replace` that strips the same prefix when `KEY_LINE` finds no value.
//
// Measured at HEAD `8ebce73` (Session 337, Node 22.23.3, one fresh process per probe, `findHeadings(text, "jupyter")` on a `jupyter: python3` document; the lower bound was run and was OK before each bisect):
//  - a key line, indented or not, behind the dashes: 3,355,427 repetitions of `- ` read, 3,355,428 THROW (the item says 3,355,427 throws, one high); the unit `-\t` and the unit `-  ` the same;
//  - a line of dashes with no key, indented or not: 3,355,429 read, 3,355,430 throw; a key whose colon ends the line, indented: 3,355,428 read, 3,355,429 throw;
//  - the `replace` pattern alone: 3,355,429 read, 3,355,430 throw.
// Every size below is twice the lowest of them, rounded up (Learning 775): 6,800,000 repetitions is 13.6 million characters on one line, a pasted or minified blob.
//
// WHAT THROWS, by entry and hint (7,000,000 repetitions): `findHeadings` and `buildOutline` WITH THE JUPYTER HINT, which is what the providers pass for a document the resolver calls jupyter
// (`buildOutline(text, resolveDocumentEngine(fileName, text), mode)`, Learning 886); `jupyterKernelLanguage` handed the front matter lines. Nothing else: not `findHeadings` or `buildOutline` with the knitr,
// markdown or ambiguous hint or with none, not `indexLabels`/`findLabel` with any hint, not `findAllCells`, not `resolveDocumentEngine` (which answers "jupyter").
//
// THE ANSWER is the one the parent gives at a size it can read (3,000,000 repetitions, every layout: the same as with 4 units), because the language of a line does not depend on how many dashes it holds. What tells
// an ACCEPTED line from a refused one is the kernel: a line `seesThrough` accepts makes the kernel `python`, and an indent-4 `{bash}` opener below a blank line is then indented code (the heading in it is listed);
// a refused line makes the kernel unknown and that heading is swallowed by the opener (Session 294). So a cure that refuses a line the pattern accepted, or accepts one it refused, changes these answers.

const FEW = 4;
/**
 * 6 s, chosen from the cured reads of these texts (13.6 million characters, a fresh process each, machine load about 10): `findHeadings` 0.24 to 0.37 s, the Outline 0.30 s and once 1.08 s (the worst of a dozen), the same document
 * read with no hint 0.19 to 0.25 s. A limit is at least five times the worst, and a reading of this line that is quadratic in its length takes minutes, so it still tells the two apart.
 */
const LIMIT_MS = 6000;
const MANY = 6_800_000;

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

/** The document below the front matter: a heading, a python cell, and an indent-4 `{bash}` opener below a blank line whose heading is listed only when the kernel is known to be python. */
const tail = (heading: string): string =>
  `\n\n# ${heading}\n\n\`\`\`{python}\n1 + 1\n\`\`\`\n\nprose\n\n    \`\`\`{bash}\n## In\nx = 1\n\`\`\`\n\n## After\n\ntail\n`;
const front = (heading: string, ...lines: string[]): string => `---\n${lines.join("\n")}\n---${tail(heading)}`;
const flat = (symbols: readonly OutlineSymbol[]): string[] => symbols.flatMap((s) => [s.name, ...flat(s.children)]);

const headings = (text: string): string[] => findHeadings(text, "jupyter").map((h) => h.text);
const outline = (text: string): string[] => flat(buildOutline(text, "jupyter"));
const chain = (text: string): string[] => flat(buildOutline(text, resolveDocumentEngine("a.qmd", text)));
const kernel = (text: string): string | null => jupyterKernelLanguage(text.split("\n"));

/** What a known python kernel lists, and what an unknown kernel lists (the `{bash}` opener swallows `## In`). */
const known = (heading: string): string[] => [heading, "In", "After"];
const unknown = (heading: string): string[] => [heading, "After"];
const knownOutline = (heading: string): string[] => [heading, "```{python}", "In", "After"];
const unknownOutline = (heading: string): string[] => [heading, "```{python}", "```{bash}", "After"];

type Row = { site: string; unit: string; many: number; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };

const ROWS: Row[] = [
  // findHeadings with the jupyter hint: where the line stands, and what it holds after the dashes.
  { site: "findHeadings: an unindented key line, `- ` x n and then `k: v` (seesThrough's KEY_LINE.test)", unit: "- ", many: MANY, build: (run) => front("H", "jupyter: python3", `${run}k: v`), read: headings, answer: known("H") },
  { site: "findHeadings: an indented key line (leavesOpen's KEY_LINE.exec)", unit: "- ", many: MANY, build: (run) => front("H", "jupyter: python3", "k: v", `  ${run}k: v`), read: headings, answer: known("H") },
  { site: "findHeadings: an unindented line of dashes and no key (refused: the kernel is unknown)", unit: "- ", many: MANY, build: (run) => front("H", "jupyter: python3", run), read: headings, answer: unknown("H") },
  { site: "findHeadings: an indented line of dashes and no key (leavesOpen's prefix strip)", unit: "- ", many: MANY, build: (run) => front("H", "jupyter: python3", "k: v", `  ${run}`), read: headings, answer: known("H") },
  { site: "findHeadings: an indented key whose colon ends the line (group 1 unset, the strip runs)", unit: "- ", many: MANY, build: (run) => front("H", "jupyter: python3", "k: v", `  ${run}k:`), read: headings, answer: known("H") },
  { site: "findHeadings: an indented key whose value opens a flow collection (the kernel is unknown)", unit: "- ", many: MANY, build: (run) => front("H", "jupyter: python3", "k: v", `  ${run}k: [a`), read: headings, answer: unknown("H") },
  { site: "findHeadings: the unit is a dash and a TAB", unit: "-\t", many: MANY, build: (run) => front("H", "jupyter: python3", `${run}k: v`), read: headings, answer: known("H") },
  { site: "findHeadings: the unit is a dash and two blanks, indented, no key", unit: "-  ", many: MANY, build: (run) => front("H", "jupyter: python3", "k: v", `  ${run}`), read: headings, answer: known("H") },

  // buildOutline with the jupyter hint: the Outline, with its cell entries.
  { site: "buildOutline(jupyter): an unindented key line", unit: "- ", many: MANY, build: (run) => front("O", "jupyter: python3", `${run}k: v`), read: outline, answer: knownOutline("O") },
  { site: "buildOutline(jupyter): an indented key line", unit: "- ", many: MANY, build: (run) => front("O", "jupyter: python3", "k: v", `  ${run}k: v`), read: outline, answer: knownOutline("O") },
  { site: "buildOutline(jupyter): an unindented line of dashes and no key", unit: "- ", many: MANY, build: (run) => front("O", "jupyter: python3", run), read: outline, answer: unknownOutline("O") },
  { site: "buildOutline(jupyter): an indented line of dashes and no key", unit: "- ", many: MANY, build: (run) => front("O", "jupyter: python3", "k: v", `  ${run}`), read: outline, answer: knownOutline("O") },
  { site: "buildOutline(jupyter): an indented key whose colon ends the line", unit: "- ", many: MANY, build: (run) => front("O", "jupyter: python3", "k: v", `  ${run}k:`), read: outline, answer: knownOutline("O") },
  { site: "buildOutline(jupyter): an indented key whose value opens a flow collection", unit: "- ", many: MANY, build: (run) => front("O", "jupyter: python3", "k: v", `  ${run}k: [a`), read: outline, answer: unknownOutline("O") },

  // The provider chain: buildOutline(text, resolveDocumentEngine(fileName, text)), for the three ways a document comes to be jupyter.
  { site: "the Outline the provider builds: `jupyter: python3`, an unindented key line", unit: "- ", many: MANY, build: (run) => front("P", "jupyter: python3", `${run}k: v`), read: chain, answer: knownOutline("P") },
  { site: "the Outline the provider builds: `engine: jupyter`, an unindented key line", unit: "- ", many: MANY, build: (run) => front("P", "engine: jupyter", `${run}k: v`), read: chain, answer: knownOutline("P") },
  { site: "the Outline the provider builds: no engine key, a python cell makes the document jupyter", unit: "- ", many: MANY, build: (run) => front("P", "title: T", `${run}k: v`), read: chain, answer: knownOutline("P") },
  { site: "the Outline the provider builds: a refused line of dashes", unit: "- ", many: MANY, build: (run) => front("P", "jupyter: python3", run), read: chain, answer: unknownOutline("P") },

  // jupyterKernelLanguage, handed the front matter lines as the model hands them.
  { site: "jupyterKernelLanguage: an unindented key line", unit: "- ", many: MANY, build: (run) => `jupyter: python3\n${run}k: v`, read: kernel, answer: "python" },
  { site: "jupyterKernelLanguage: an indented key line", unit: "- ", many: MANY, build: (run) => `jupyter: python3\nk: v\n  ${run}k: v`, read: kernel, answer: "python" },
  { site: "jupyterKernelLanguage: an unindented line of dashes and no key", unit: "- ", many: MANY, build: (run) => `jupyter: python3\n${run}`, read: kernel, answer: null },
  { site: "jupyterKernelLanguage: an indented line of dashes and no key", unit: "- ", many: MANY, build: (run) => `jupyter: python3\nk: v\n  ${run}`, read: kernel, answer: "python" },
  { site: "jupyterKernelLanguage: an indented key whose colon ends the line", unit: "- ", many: MANY, build: (run) => `jupyter: python3\nk: v\n  ${run}k:`, read: kernel, answer: "python" },
  { site: "jupyterKernelLanguage: an indented key whose value opens a flow collection", unit: "- ", many: MANY, build: (run) => `jupyter: python3\nk: v\n  ${run}k: [a`, read: kernel, answer: null },
];

describe("Session 337 -- a front matter line of millions of dashes that the jupyter reader's KEY_LINE read as a group (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 8)", () => {
  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    const short = row.build(row.unit.repeat(FEW));
    expect(row.read(short)).toEqual(row.answer);
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The shape reaches the pattern only through the jupyter hint (the rows above), and these reads are GREEN on the parent: they pin where the shape does NOT throw, so a later change that moves the reach is seen.
  it("control (GREEN on the parent): the same line read with no hint, with the knitr hint and through the label index does not throw, and answers what a reader that never asks the kernel answers", () => {
    const text = front("M", "jupyter: python3", `${"- ".repeat(MANY)}k: v`);
    const { result, ms } = timed(() => ({
      none: findHeadings(text).map((h) => h.text),
      knitr: findHeadings(text, "knitr").map((h) => h.text),
      labels: indexLabels(text, "jupyter").length,
    }));
    expect(result).toEqual({ none: unknown("M"), knitr: unknown("M"), labels: 0 });
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("control (GREEN on the parent): the resolver calls the long-line documents jupyter, the engine the providers hand to the Outline", () => {
    for (const lines of [["jupyter: python3"], ["engine: jupyter"], ["title: T"]]) {
      expect(resolveDocumentEngine("a.qmd", front("R", ...lines, `${"- ".repeat(MANY)}k: v`))).toBe("jupyter");
    }
  }, 120_000);

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const small = ROWS.map((row) => row.build(row.unit.repeat(FEW)));
    expect(new Set(small).size).toBe(ROWS.length);
  });

  // The parent THROWS from 3,355,428 repetitions, so no limit passes it there; a run below that, or a unit that is not the throwing one, would pass on it, and a limit of minutes would pass a quadratic cure.
  it("keeps the sizes, the limit and the units the Session 337 rows are built on", () => {
    expect([FEW, LIMIT_MS, MANY]).toEqual([4, 6000, 6_800_000]);
    expect(MANY).toBeGreaterThanOrEqual(2 * 3_355_428);
    expect(ROWS.length).toBe(24);
    expect(ROWS.map((row) => `${JSON.stringify(row.unit)}x${row.many}`)).toEqual([
      ...Array.from({ length: 6 }, () => '"- "x6800000'),
      '"-\\t"x6800000', '"-  "x6800000',
      ...Array.from({ length: 16 }, () => '"- "x6800000'),
    ]);
  });
});
