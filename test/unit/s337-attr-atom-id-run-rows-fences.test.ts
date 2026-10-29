import { describe, expect, it } from "vitest";
import { findAllCells, findHeadings } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";

// Session 337, part 1 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" (group g02): the fence info strings. The first file of the set (`s337-attr-atom-id-run-rows.test.ts`) says what
// the shape is, how its size was bisected (first throw at 3,355,430 repetitions of `#a` at HEAD `8ebce73`, 3,355,429 reads) and why the unit is repeated 6,720,000 times and the limit is 10 s.
// ⚠ THE ITEM SAID "A FENCE INFO STRING DOES NOT" THROW, AND THAT IS WRONG FOR THE FENCES THAT ARE NOT CELLS (measured at HEAD, Session 337, in one fresh process per probe). A backtick fence whose info string is a brace tag
// (```` ```{...} ````, ```` ``` {...} ````) is a code cell header and never reaches the attribute grammar; a TILDE fence (`~~~ {...}`, `~~~{...}`) and a backtick fence with a word before the block (```` ```python {...} ````) is
// judged as an attribute block by `fenceInfoOpensBlock` (a pandoc-family reader), and THROWS in findHeadings, buildOutline, findAllCells, indexLabels, findLabel and resolveDocumentEngine alike (the 3,355,430 bound is the same).
// The rows read the fence three ways: the label it defines (`lst-`), the headings below it (a `# ` line INSIDE the fence is code, so it must not stand) and the cells below it.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

const S337_UNIT = "#a";
const S337_FEW = 4;
const S337_MANY = 6_720_000;
const S337_LIMIT_MS = 10_000; // chosen in the first file: a cured row takes 2.8 to 3 s here, the quadratic reading hours

const headings = (text: string): Array<[string, string | undefined, number]> => findHeadings(text).map((h) => [h.text.slice(0, 12), h.id, h.line]);
const cells = (text: string): Array<[string, number]> => findAllCells(text).map((c) => [c.lang, c.startLine]);
const labels = (text: string): Array<[string, number]> => indexLabels(text).map((l) => [l.id, l.line]);

type Row = { site: string; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };

describe("Session 337 — a tilde fence and a word-prefixed backtick fence whose info string holds one attribute token of millions of ids (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 1)", () => {
  const ROWS: Row[] = [
    { site: "indexLabels: a tilde fence's attribute block of n ids then a `lst-` id", build: (run) => `~~~ {${run}#lst-a}\ncode\n~~~\n`, read: labels, answer: [["lst-a", 0]] },
    { site: "findHeadings: a tilde fence's attribute block of n ids (a heading line inside is code, the one below stands)", build: (run) => `~~~ {${run}}\n# Inside\n~~~\n\n# H33\n`, read: headings, answer: [["H33", undefined, 4]] },
    { site: "findAllCells: a tilde fence's attribute block of n ids above an R cell", build: (run) => `~~~{${run}}\ncode\n~~~\n\n\`\`\`{r}\n1\n\`\`\`\n`, read: cells, answer: [["r", 4]] },
    { site: "indexLabels: a backtick fence with a word before the attribute block of n ids then a `lst-` id", build: (run) => `\`\`\`python {${run}#lst-b}\ncode\n\`\`\`\n`, read: labels, answer: [["lst-b", 0]] },
    { site: "findHeadings: a backtick fence with a word before the attribute block of n ids (a heading line inside is code)", build: (run) => `\`\`\`python {${run}}\n# Inside\n\`\`\`\n\n# H35\n`, read: headings, answer: [["H35", undefined, 4]] },
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

  it("keeps the sizes, the limit and the unit the Session 337 fence rows are built on", () => {
    expect([S337_UNIT, S337_FEW, S337_MANY, S337_LIMIT_MS]).toEqual(["#a", 4, 6_720_000, 10_000]);
    expect(S337_MANY).toBeGreaterThanOrEqual(2 * 3_355_430); // twice the first throw (3,355,430 at 8ebce73; 3,355,429 reads)
    expect(S337_UNIT.length).toBe(2);
    expect(ROWS.length).toBe(5);
  });
});
