import { describe, expect, it } from "vitest";
import { findLabel, indexLabels } from "../../src/core/refs";

// Session 337, part 1 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" (group g02): the label rows. The first file of the set (`s337-attr-atom-id-run-rows.test.ts`) says what the shape
// is, how its size was bisected (first throw at 3,355,430 repetitions of `#a` at HEAD `8ebce73`, 3,355,429 reads) and why the unit is repeated 6,720,000 times and the limit is 10 s. The label index (`indexLabels`) and the
// one label lookup (`findLabel`, which the cross-reference definition calls) read every heading's attribute block for a `sec-` id, and the providers pass the resolved engine (`providers/crossref.ts`: Learning 886), so the
// knitr and jupyter reads are rows of their own. The rows put one `sec-` id AFTER the run so that the answer says which id won: for a pandoc-family reader the LAST id of the block is the heading's (Session 219), and the
// column of that id moves with the length of the run (`findLabel`'s answer is a function of the run).

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
const labels = (text: string, hint?: KnownEngine): Array<[string, number]> => indexLabels(text, hint).map((l) => [l.id, l.line]);
const lookup = (text: string, id: string, hint?: KnownEngine): Array<[string, string, number, number]> => {
  const found = findLabel(text, id, hint);
  return found === null ? [] : [[found.id, found.kind, found.line, found.column]];
};

type Row = { site: string; build: (run: string) => string; read: (text: string) => unknown; answer: (run: string) => unknown };

describe("Session 337 — the label index of a document whose heading holds one attribute token of millions of ids (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 1)", () => {
  const ROWS: Row[] = [
    { site: "indexLabels: n ids then a `sec-` id in an ATX heading's attribute block", build: (run) => `Labels.\n\n# H21 {${run}#sec-a}\n\nbody\n`, read: (text) => labels(text), answer: () => [["sec-a", 2]] },
    { site: "indexLabels with the knitr hint: n ids then a `sec-` id", build: (run) => `Labels knitr.\n\n# H22 {${run}#sec-b}\n\nbody\n`, read: (text) => labels(text, "knitr"), answer: () => [["sec-b", 2]] },
    { site: "indexLabels with the jupyter hint: n ids then a `sec-` id", build: (run) => `Labels jupyter.\n\n# H23 {${run}#sec-c}\n\nbody\n`, read: (text) => labels(text, "jupyter"), answer: () => [["sec-c", 2]] },
    { site: "indexLabels: n ids then a `sec-` id in a setext heading's attribute block", build: (run) => `H24 {${run}#sec-d}\n=====\n\nbody\n`, read: (text) => labels(text), answer: () => [["sec-d", 0]] },
    // The last id wins, whatever its kind: the id of the run is `a`, which is no `sec-` target.
    { site: "indexLabels: n ids and no `sec-` id define no label", build: (run) => `No label.\n\n# H25 {${run}}\n\nbody\n`, read: (text) => labels(text), answer: () => [] },
    { site: "indexLabels: n ids then a `sec-` id then a bang is no attribute block, so no label", build: (run) => `Refused.\n\n# H26 {${run}#sec-e!}\n\nbody\n`, read: (text) => labels(text), answer: () => [] },
    // `findLabel` answers the column of the id's text: the heading is `# H27 {` (7 characters), then the run, then `#`, so the id begins 8 characters + the run after the line start.
    { site: "findLabel: n ids then a `sec-` id (the column moves with the run)", build: (run) => `Lookup.\n\n# H27 {${run}#sec-f}\n\nbody\n`, read: (text) => lookup(text, "sec-f"), answer: (run) => [["sec-f", "sec", 2, 7 + run.length + 1]] },
    { site: "findLabel with the knitr hint: n ids then a `sec-` id", build: (run) => `Lookup knitr.\n\n# H28 {${run}#sec-g}\n\nbody\n`, read: (text) => lookup(text, "sec-g", "knitr"), answer: (run) => [["sec-g", "sec", 2, 7 + run.length + 1]] },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    const shortRun = S337_UNIT.repeat(S337_FEW);
    expect(row.read(row.build(shortRun))).toEqual(row.answer(shortRun));
    const run = S337_UNIT.repeat(S337_MANY);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(run));
    expect(ms).toBeLessThan(S337_LIMIT_MS);
  }, 120_000);

  it("builds a different text for every row", () => {
    const small = ROWS.map((row) => row.build(S337_UNIT.repeat(S337_FEW)));
    expect(new Set(small).size).toBe(ROWS.length);
  });

  it("keeps the sizes, the limit and the unit the Session 337 label rows are built on", () => {
    expect([S337_UNIT, S337_FEW, S337_MANY, S337_LIMIT_MS]).toEqual(["#a", 4, 6_720_000, 10_000]);
    expect(S337_MANY).toBeGreaterThanOrEqual(2 * 3_355_430); // twice the first throw (3,355,430 at 8ebce73; 3,355,429 reads)
    expect(S337_UNIT.length).toBe(2);
    expect(ROWS.length).toBe(8);
  });
});
