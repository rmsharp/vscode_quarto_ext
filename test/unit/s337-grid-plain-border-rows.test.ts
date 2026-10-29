import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { buildOutline, findAllCells, findHeadings, type OutlineSymbol } from "../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../src/core/refs";

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

// Session 337, part 2 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" (found by Session 336's review round). The top border of a grid table was read by
// `GRID_PLAIN_BORDER = /^\+(?:-+\+)+[ \t]*$/` (`tableOrLineBlockEndsAt`, `qmd/model.ts`, tested twice), a GROUP per `-+` cell, and V8 keeps one entry of its regex backtrack stack per repetition of a group:
// a border line of 3,355,430 cells of `-+` THROWS `RangeError: Maximum call stack size exceeded`, and the error reaches every reader of the document. The question is asked when a line sits directly
// under a grid table (an indent-4 cell opener, a `***` or `---` line), so a heading or a blank line below the table never reaches it. Bisected at HEAD `8ebce73` (Session 337, one fresh process per
// probe, 26 entry and hint pairs, `Intro.`, a blank line, the border, `| a |`, `+---+` and the line below): 3,355,429 cells read (the lower bound checked OK), 3,355,430 throw; a border that
// ends in `x` (it is no border) throws from 3,355,431. Every size below is TWICE the first throw (Learning 775), so a size just under the limit cannot pass.
describe("Session 337, part 2: a grid table's top border of millions of `-+` cells is read without a RangeError", () => {
  const FEW = 4;
  const MANY = 6_800_000;
  const UNIT = "-+";
  // 4 s: with the cure each read of a 13.6-million-character document takes 0.41 to 0.61 s (a fresh process per probe at the cure commit: 7 entries and hints on 5 shapes; the rest is the scan of the document, which was always linear), so 4 s is 6.5 times the slowest
  // and still tells a linear reading from a quadratic one (a quadratic one takes minutes on 6.8 million cells).
  const LIMIT_MS = 4000;

  const flatten = (symbols: OutlineSymbol[]): string[] => symbols.flatMap((s) => [`${s.kind}:${s.name.slice(0, 12)}`, ...flatten(s.children)]);
  const headings = (hint?: "knitr" | "jupyter" | "markdown") => (text: string): string[] => findHeadings(text, hint).map((h) => h.text.slice(0, 8));
  const outline = (hint?: "knitr" | "jupyter" | "markdown") => (text: string): string[] => flatten(buildOutline(text, hint));
  const labelLines = (hint?: "knitr" | "jupyter") => (text: string): Array<[string, number]> => indexLabels(text, hint).map((l) => [l.id, l.line]);

  // the line below the table, the text after it, and the table rows between the border and it
  const CELL = "    ```{r}\n    1\n    ```\n";
  const CELL_WITH_HEADING = "    ```{r}\n## In\n    ```\n";
  const TAIL = "\n# H\n\n![x](y){#fig-a}\n";
  const doc = (id: string, run: string, below: string, tail: string, top = "+"): string => `Intro ${id}.\n\n${top}${run}\n| a |\n+---+\n${below}${tail}`;
  const withCell = (id: string) => (run: string): string => doc(id, run, CELL, TAIL);
  const withDash = (id: string) => (run: string): string => doc(id, run, "---\n", TAIL);
  const withHeadingCell = (id: string) => (run: string): string => doc(id, run, CELL_WITH_HEADING, "");
  const withStar = (id: string) => (run: string): string => doc(id, run, `***\n${CELL_WITH_HEADING}`, "");
  const nearMiss = (id: string) => (run: string): string => `Intro ${id}.\n\n+${run}x\n| a |\n+---+\n${CELL_WITH_HEADING}`;
  const afterLineBlock = (id: string) => (run: string): string => `Intro ${id}.\n\n| lb\n+${run}\n| a |\n+---+\n${CELL_WITH_HEADING}`;
  const loneBorder = (id: string) => (run: string): string => `Intro ${id}.\n\n+${run}\n${CELL_WITH_HEADING}`;
  const loneBorderStar = (id: string) => (run: string): string => `Intro ${id}.\n\n+${run}\n***\n${CELL_WITH_HEADING}`;
  const closingBorder = (id: string) => (run: string): string => `Intro ${id}.\n\n+---+\n| a |\n+${run}\n${CELL_WITH_HEADING}`;

  type Row = { site: string; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };
  const ROWS: Row[] = [
    // The cell opener directly under the table (the item's shape), read through every scan-based entry with the hints the providers pass.
    { site: "findHeadings, no hint: an indent-4 cell opener under the table", build: withCell("a1"), read: headings(), answer: ["H"] },
    { site: "findHeadings, knitr", build: withCell("a2"), read: headings("knitr"), answer: ["H"] },
    { site: "findHeadings, jupyter", build: withCell("a3"), read: headings("jupyter"), answer: ["H"] },
    { site: "buildOutline, no hint", build: withCell("a4"), read: outline(), answer: ["cell:```{r}", "heading:H"] },
    { site: "buildOutline, knitr", build: withCell("a5"), read: outline("knitr"), answer: ["cell:```{r}", "heading:H"] },
    { site: "buildOutline, jupyter", build: withCell("a6"), read: outline("jupyter"), answer: ["heading:H"] },
    { site: "findAllCells", build: withCell("a7"), read: (text) => findAllCells(text).map((c) => [c.startLine, c.endLine, c.lang]), answer: [[5, 7, "r"]] },
    { site: "indexLabels, no hint", build: withCell("a8"), read: labelLines(), answer: [["fig-a", 11]] },
    { site: "indexLabels, knitr", build: withCell("a9"), read: labelLines("knitr"), answer: [["fig-a", 11]] },
    { site: "indexLabels, jupyter", build: withCell("a10"), read: labelLines("jupyter"), answer: [["fig-a", 11]] },
    { site: "findLabel, no hint", build: withCell("a11"), read: (text) => findLabel(text, "fig-a")?.line ?? null, answer: 11 },
    { site: "findLabel, knitr", build: withCell("a12"), read: (text) => findLabel(text, "fig-a", "knitr")?.line ?? null, answer: 11 },
    { site: "resolveDocumentEngine", build: (run) => `---\nengine: knitr\n---\n\n${withCell("a13")(run)}`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },

    // A `---` line directly under the table.
    { site: "findHeadings, no hint: a `---` line under the table", build: withDash("b1"), read: headings(), answer: ["+---+", "H"] },
    { site: "findHeadings, knitr: a `---` line", build: withDash("b2"), read: headings("knitr"), answer: ["+---+", "H"] },
    { site: "buildOutline, jupyter: a `---` line", build: withDash("b3"), read: outline("jupyter"), answer: ["heading:+---+", "heading:H"] },
    { site: "findAllCells: a `---` line", build: withDash("b4"), read: (text) => findAllCells(text).length, answer: 0 },
    { site: "indexLabels, knitr: a `---` line", build: withDash("b5"), read: labelLines("knitr"), answer: [["fig-a", 9]] },
    { site: "resolveDocumentEngine: a `---` line", build: (run) => `---\nengine: knitr\n---\n\n${withDash("b6")(run)}`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },

    // The verdict itself: where the table ends, an indent-4 opener under it is not an executable cell for the markdown engine or for a jupyter kernel that is not R, and the `## In` inside it is a heading.
    { site: "findHeadings, markdown: the heading inside the opener under the table", build: withHeadingCell("c1"), read: headings("markdown"), answer: ["In"] },
    { site: "findHeadings, jupyter: the heading inside the opener under the table", build: withHeadingCell("c2"), read: headings("jupyter"), answer: ["In"] },
    { site: "buildOutline, markdown: the heading inside the opener", build: withHeadingCell("c3"), read: outline("markdown"), answer: ["heading:In"] },
    { site: "findHeadings, markdown: a `***` line under the table", build: withStar("c4"), read: headings("markdown"), answer: ["In"] },
    { site: "findHeadings, jupyter: a `***` line under the table", build: withStar("c5"), read: headings("jupyter"), answer: ["In"] },
    { site: "buildOutline, jupyter: a `***` line under the table", build: withStar("c6"), read: outline("jupyter"), answer: ["heading:In"] },

    // The same question asked of other first lines: a border that ends in `x` (no border) and a line block above the border.
    { site: "findHeadings, markdown: a border that ends in `x`", build: nearMiss("d1"), read: headings("markdown"), answer: [] },
    { site: "findHeadings, jupyter: a border that ends in `x`", build: nearMiss("d2"), read: headings("jupyter"), answer: [] },
    { site: "findHeadings, markdown: a line block above the border", build: afterLineBlock("d3"), read: headings("markdown"), answer: ["In"] },
    { site: "findHeadings, no hint: a line block above the border", build: afterLineBlock("d4"), read: headings(), answer: [] },
    // The border is the ONLY line of its run (the loop that looks for the first border does not run, and the second test of the pattern reads it).
    { site: "findHeadings, markdown: a lone border directly above the opener", build: loneBorder("f1"), read: headings("markdown"), answer: [] },
    { site: "findHeadings, jupyter: a lone border directly above the opener", build: loneBorder("f2"), read: headings("jupyter"), answer: [] },
    { site: "findHeadings, markdown: a lone border directly above a `***` line", build: loneBorderStar("f3"), read: headings("markdown"), answer: [] },
    { site: "buildOutline, jupyter: a lone border directly above the opener", build: loneBorder("f4"), read: outline("jupyter"), answer: ["cell:```{r}"] },
    // CONTROL (passes on the parent too): the loop stops at the first border, so a long CLOSING border is never read by the pattern.
    { site: "control: a long closing border is not read by the pattern", build: closingBorder("e1"), read: headings("markdown"), answer: ["In"] },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, quickly, and the answer is the stated one with 4 cells and with the long run", (_site, row) => {
    const short = row.build(UNIT.repeat(FEW));
    expect(row.read(short)).toEqual(row.answer);
    const run = UNIT.repeat(MANY);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const small = ROWS.map((row) => row.build(UNIT.repeat(FEW)));
    expect(new Set(small).size).toBe(ROWS.length);
  });

  // The parent THROWS from 3,355,430 cells, so no limit passes it there; a run below that, or a unit that is not the throwing one, would pass on it, and a limit of minutes would pass a quadratic cure.
  it("keeps the sizes, the limit and the unit the Session 337 part 2 rows are built on", () => {
    expect([FEW, MANY, UNIT, LIMIT_MS, ROWS.length]).toEqual([4, 6_800_000, "-+", 4000, 34]);
    expect(MANY).toBeGreaterThanOrEqual(2 * 3_355_430);
  });
});
