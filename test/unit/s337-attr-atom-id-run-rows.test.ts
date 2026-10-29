import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findAllCells, findHeadings } from "../../src/core/qmd/model";

// Session 337, part 1 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones, found by Session 336's own probes and its review round, none of them in its diff" (group g02).
// The class of Sessions 317, 335 and 336: V8 keeps one entry of its regex backtrack stack per repetition of a quantified GROUP, so `ATTR_ATOM_RUN`'s id group `(?:#[\p{L}\p{N}_:.-]+)*` throws
// `RangeError: Maximum call stack size exceeded` once ONE attribute token holds enough ids, and the RangeError reaches every reader of the document and answers NOTHING for it.
// The first throw was bisected at HEAD `8ebce73` (Session 337, one fresh process per probe, `findHeadings`, `# T {` + `#a` x N + `}`): N = 3,355,430 repetitions of the two-character unit `#a` throws, N = 3,355,429
// reads (about 1 s); 4 and 2,000,000 read too. The rows below are twice that (6,720,000, Learning 775), so a size just under the limit cannot pass, and every one of them asks the entry with the arguments the providers pass
// (Learning 886: the resolved engine goes to `buildOutline` and `indexLabels`). A line this long is a pasted blob. This file holds the heading, cell and engine readers; the Outline, the label index, the inline hosts and the
// fence info strings are in its four siblings (`s337-attr-atom-id-run-rows-*.test.ts`), each under the 25 s a test file may take (vitest's worker RPC window is about 60 s and a whole-suite run is slower).
//
// The ANSWER of a row is what the OLD pattern gives, not what the new function chooses: the token `#a#a...#a` is one run of ids, a valid attribute block, and the LAST id wins for a pandoc-family reader, so the heading's id
// is `a` at 4 units and at 6.72 million (each row's short run is asserted first, on the parent too); a token ending in `!` or in a lone `#` is refused, so the braces stay in the heading text and there is no id.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

const S337_UNIT = "#a";
const S337_FEW = 4;
const S337_MANY = 6_720_000;
// 10 s, the ceiling of these rows. Cured, a row takes 1.9 to 2.1 s (measured at 6,710,860 units with four workers loading the machine: the heading attribute tokenizer builds a token a character at a time and
// the collector takes 54% of it, `attributeAtomRun` itself 0.2 s), so 10 s is five times the cost; the three rows that refuse a token take 0.9 s. A quadratic reading of a 13-million-character line takes hours, so the limit still
// tells the two apart. It is never loosened to pass: a row that flakes under load is run alone first.
const S337_LIMIT_MS = 10_000;

type KnownEngine = "knitr" | "jupyter";
const headings = (text: string, hint?: KnownEngine): Array<[string, string | undefined, number]> => findHeadings(text, hint).map((h) => [h.text.slice(0, 12), h.id, h.line]);
const cells = (text: string): Array<[string, number]> => findAllCells(text).map((c) => [c.lang, c.startLine]);

type Row = { site: string; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };

describe("Session 337 — one attribute token of millions of ids (`#a` repeated) that `ATTR_ATOM_RUN`'s id group read as a quantified group (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 1)", () => {
  const ROWS: Row[] = [
    // The heading readers. `findHeadings` is what the Outline, the cell scan, the label index and the engine resolver all ask first; the knitr and jupyter hints reach the engine-gated paths of the same scan.
    { site: "findHeadings: an ATX heading's attribute block of n ids", build: (run) => `Intro.\n\n# H01 {${run}}\n\nbody\n`, read: (text) => headings(text), answer: [["H01", "a", 2]] },
    { site: "findHeadings with the knitr hint: an ATX heading's attribute block", build: (run) => `Knitr.\n\n# H02 {${run}}\n\nbody\n`, read: (text) => headings(text, "knitr"), answer: [["H02", "a", 2]] },
    { site: "findHeadings with the jupyter hint: an ATX heading's attribute block", build: (run) => `Jupyter.\n\n# H03 {${run}}\n\nbody\n`, read: (text) => headings(text, "jupyter"), answer: [["H03", "a", 2]] },
    { site: "findHeadings: a setext heading's attribute block", build: (run) => `H04 {${run}}\n=====\n\nbody\n`, read: (text) => headings(text), answer: [["H04", "a", 0]] },
    // A dash run and ONE class may stand before the ids (the Session 324 grammar): the same group, reached after the optional parts.
    { site: "findHeadings: two dashes, a class, then n ids", build: (run) => `Dashes.\n\n# H05 {--.Ab${run}}\n\nbody\n`, read: (text) => headings(text), answer: [["H05", "a", 2]] },
    // A token the group cannot finish is REFUSED, and the old pattern had to try it before saying so: the braces stay in the heading text and there is no id.
    { site: "findHeadings: n ids then a bang is no attribute block (the braces stay in the text)", build: (run) => `Bang.\n\n# H06 {${run}!}\n\nbody\n`, read: (text) => headings(text), answer: [["H06 {#a#a#a#", undefined, 2]] },
    { site: "findHeadings: n ids then a lone hash is no attribute block", build: (run) => `Hash.\n\n# H07 {${run}#}\n\nbody\n`, read: (text) => headings(text), answer: [["H07 {#a#a#a#", undefined, 2]] },
    // `findAllCells` reads the headings to place its cells; the engine resolver reads the whole document for the cells that name an engine.
    { site: "findAllCells: an attribute block of n ids above a code cell", build: (run) => `Cells.\n\n# H08 {${run}}\n\n\`\`\`{r}\n1\n\`\`\`\n`, read: cells, answer: [["r", 4]] },
    { site: "resolveDocumentEngine: an attribute block of n ids under a declared engine", build: (run) => `---\nengine: knitr\n---\n\n# H09 {${run}}\n`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },
    { site: "resolveDocumentEngine: an attribute block of n ids above an R cell that names the engine", build: (run) => `# H10 {${run}}\n\n\`\`\`{r}\n1\n\`\`\`\n`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },
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
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const small = ROWS.map((row) => row.build(S337_UNIT.repeat(S337_FEW)));
    expect(new Set(small).size).toBe(ROWS.length);
  });

  // The parent THROWS from 3,355,430 units, so no limit passes it there; a run below that, or a unit that is not the throwing one, would pass on it, and a limit of minutes would pass a quadratic cure.
  it("keeps the sizes, the limit and the unit the Session 337 rows are built on", () => {
    expect([S337_UNIT, S337_FEW, S337_MANY, S337_LIMIT_MS]).toEqual(["#a", 4, 6_720_000, 10_000]);
    expect(S337_MANY).toBeGreaterThanOrEqual(2 * 3_355_430); // twice the first throw (3,355,430 at 8ebce73; 3,355,429 reads)
    expect(S337_UNIT.length).toBe(2); // a group that takes two characters: the first throw is 3.36 million, not 8.39 million
    expect(ROWS.length).toBe(10);
  });
});
