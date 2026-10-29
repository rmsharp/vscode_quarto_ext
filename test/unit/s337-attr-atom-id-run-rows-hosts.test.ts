import { describe, expect, it } from "vitest";
import { indexLabels } from "../../src/core/refs";

// Session 337, part 1 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" (group g02): the inline hosts. The first file of the set (`s337-attr-atom-id-run-rows.test.ts`) says what the
// shape is, how its size was bisected (first throw at 3,355,430 repetitions of `#a` at HEAD `8ebce73`, 3,355,429 reads) and why the unit is repeated 6,720,000 times and the limit is 10 s. A fenced div, an image and a
// bracketed span carry an attribute block of their own, and `indexLabels` (Source 3, `attributeBlockId`) judges it with the same `ATTR_ATOM_RUN`: it is the ONLY entry that throws for them (the heading, cell and engine
// readers do not look at those blocks: measured at HEAD, Session 337), and `findLabel` shares its index. The run is followed by a `fig-` id so that the answer says which id won (the last, for a pandoc-family reader).
// The providers pass the resolved engine to `indexLabels` (Learning 886), so a div with the knitr hint and an image with the jupyter hint are rows too.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

const S337_UNIT = "#a";
const S337_FEW = 4;
const S337_MANY = 6_720_000;
const S337_LIMIT_MS = 10_000; // chosen in the first file: a cured row takes 2 to 3.4 s (the div is the slowest), the quadratic reading hours

type KnownEngine = "knitr" | "jupyter";
const labels = (text: string, hint?: KnownEngine): Array<[string, number]> => indexLabels(text, hint).map((l) => [l.id, l.line]);

type Row = { site: string; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };

describe("Session 337 — the label index of a fenced div, an image and a span whose attribute block holds one token of millions of ids (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 1)", () => {
  const ROWS: Row[] = [
    { site: "indexLabels: a fenced div's attribute block of n ids then a `fig-` id", build: (run) => `::: {${run}#fig-d}\n![x](y.png)\n:::\n`, read: (text) => labels(text), answer: [["fig-d", 0]] },
    { site: "indexLabels: an image's attribute block of n ids then a `fig-` id", build: (run) => `![x](y){${run}#fig-i}\n`, read: (text) => labels(text), answer: [["fig-i", 0]] },
    { site: "indexLabels: a bracketed span's attribute block of n ids then a `fig-` id", build: (run) => `[x]{${run}#fig-s}\n`, read: (text) => labels(text), answer: [["fig-s", 0]] },
    { site: "indexLabels with the knitr hint: a fenced div's attribute block", build: (run) => `Knitr div.\n\n::: {${run}#fig-k}\n![x](y.png)\n:::\n`, read: (text) => labels(text, "knitr"), answer: [["fig-k", 2]] },
    { site: "indexLabels with the jupyter hint: an image's attribute block", build: (run) => `Jupyter image.\n\n![x](y){${run}#fig-j}\n`, read: (text) => labels(text, "jupyter"), answer: [["fig-j", 2]] },
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

  it("keeps the sizes, the limit and the unit the Session 337 inline host rows are built on", () => {
    expect([S337_UNIT, S337_FEW, S337_MANY, S337_LIMIT_MS]).toEqual(["#a", 4, 6_720_000, 10_000]);
    expect(S337_MANY).toBeGreaterThanOrEqual(2 * 3_355_430); // twice the first throw (3,355,430 at 8ebce73; 3,355,429 reads)
    expect(S337_UNIT.length).toBe(2);
    expect(ROWS.length).toBe(5);
  });
});
