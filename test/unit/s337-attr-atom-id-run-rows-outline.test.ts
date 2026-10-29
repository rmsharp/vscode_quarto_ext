import { describe, expect, it } from "vitest";
import { buildOutline, type OutlineSymbol } from "../../src/core/qmd/model";

// Session 337, part 1 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" (group g02): the Outline rows. The first file of the set (`s337-attr-atom-id-run-rows.test.ts`) says what the
// shape is, how its size was bisected (first throw at 3,355,430 repetitions of `#a` at HEAD `8ebce73`, 3,355,429 reads) and why the unit is repeated 6,720,000 times and the limit is 10 s. The providers pass the RESOLVED engine
// to `buildOutline` (`providers/outline.ts`, `workspace-symbols.ts`: Learning 886), so the hinted reads are rows of their own, and a heading with NO closing brace is not an attribute block and never reached the group
// (a control that passes on the parent).

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

const S337_UNIT = "#a";
const S337_FEW = 4;
const S337_MANY = 6_720_000;
const S337_LIMIT_MS = 10_000; // chosen in the first file: a cured row takes about 2 s, the quadratic reading hours

type KnownEngine = "knitr" | "jupyter";
// The whole tree, depth first: the name (its first twelve characters stand for a long one), the first line of the section and the line the editor selects.
const flatten = (symbols: OutlineSymbol[]): Array<[string, number, number]> => symbols.flatMap((s): Array<[string, number, number]> => [[s.name.slice(0, 12), s.startLine, s.selectionLine], ...flatten(s.children)]);
const outline = (text: string, hint?: KnownEngine): Array<[string, number, number]> => flatten(buildOutline(text, hint));

type Row = { site: string; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };

describe("Session 337 — the Outline of a document whose heading holds one attribute token of millions of ids (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 1)", () => {
  const ROWS: Row[] = [
    { site: "buildOutline: an ATX heading's attribute block of n ids", build: (run) => `Outline.\n\n# H11 {${run}}\n\nbody\n`, read: (text) => outline(text), answer: [["H11", 2, 2]] },
    { site: "buildOutline with the knitr hint: an ATX heading's attribute block", build: (run) => `Outline knitr.\n\n# H12 {${run}}\n\nbody\n`, read: (text) => outline(text, "knitr"), answer: [["H12", 2, 2]] },
    { site: "buildOutline with the jupyter hint: an ATX heading's attribute block", build: (run) => `Outline jupyter.\n\n# H13 {${run}}\n\nbody\n`, read: (text) => outline(text, "jupyter"), answer: [["H13", 2, 2]] },
    { site: "buildOutline: a setext heading's attribute block", build: (run) => `H14 {${run}}\n=====\n\nbody\n`, read: (text) => outline(text), answer: [["H14", 0, 0]] },
    { site: "buildOutline with the knitr hint: a setext heading's attribute block", build: (run) => `H15 {${run}}\n-----\n\nbody\n`, read: (text) => outline(text, "knitr"), answer: [["H15", 0, 0]] },
    { site: "buildOutline with the jupyter hint: a heading under a section", build: (run) => `# Top\n\n## H16 {${run}}\n\nbody\n`, read: (text) => outline(text, "jupyter"), answer: [["Top", 0, 0], ["H16", 2, 2]] },
    // CONTROL: no closing brace, so the block is not read and the group is never asked; the parent answers this one.
    { site: "CONTROL buildOutline: n ids and no closing brace (not an attribute block: passes on the parent)", build: (run) => `Open.\n\n# H17 {${run}\n\nbody\n`, read: (text) => outline(text), answer: [["H17 {#a#a#a#", 2, 2]] },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    const short = row.build(S337_UNIT.repeat(S337_FEW));
    expect(row.read(short)).toEqual(row.answer);
    const run = S337_UNIT.repeat(S337_MANY);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(S337_LIMIT_MS);
  }, 120_000);

  it("builds a different text for every row", () => {
    const small = ROWS.map((row) => row.build(S337_UNIT.repeat(S337_FEW)));
    expect(new Set(small).size).toBe(ROWS.length);
  });

  it("keeps the sizes, the limit and the unit the Session 337 Outline rows are built on", () => {
    expect([S337_UNIT, S337_FEW, S337_MANY, S337_LIMIT_MS]).toEqual(["#a", 4, 6_720_000, 10_000]);
    expect(S337_MANY).toBeGreaterThanOrEqual(2 * 3_355_430); // twice the first throw (3,355,430 at 8ebce73; 3,355,429 reads)
    expect(S337_UNIT.length).toBe(2);
    expect(ROWS.length).toBe(7);
  });
});
