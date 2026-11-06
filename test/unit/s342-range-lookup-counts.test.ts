import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cell } from "../../src/core/qmd/model";

// Session 342, part (3): what the range lookup READS from the model, counted. The clock rows of `s342-range-lookup-rows.test.ts` say that the lookup is fast, and a spelling that re-reads the cells or the option lines
// on every ask is only slow on a large document; these rows say what it must not do on any: how often it asks the model for the cells (`findAllCells`: once per lookup, when first asked), for the option lines
// (`findCellOptionLines`: once, and only when an ask first reaches a body line of a mapped cell), for the cell holding a line (`findCellAtPosition`: never, the lookup searches the cells it already holds), and how
// often it reads a cell's code (the line count of the body is a `split` of it: once per cell, however many lines are asked about it).
//
// The model's module is replaced by spies that call through (the pattern of `nested-values-index-call.test.ts`), so this file has to stand alone. `findAllCells` hands back cells whose `code` is a getter that counts.
const model = vi.hoisted(() => ({ codeReads: new Map<number, number>() }));
vi.mock("../../src/core/qmd/model", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/core/qmd/model")>();
  return {
    ...real,
    findAllCells: vi.fn((text: string): Cell[] =>
      real.findAllCells(text).map((cell) => {
        const counted = { startLine: cell.startLine, endLine: cell.endLine, lang: cell.lang } as Cell;
        Object.defineProperty(counted, "code", {
          enumerable: true,
          get: () => {
            model.codeReads.set(cell.startLine, (model.codeReads.get(cell.startLine) ?? 0) + 1);
            return cell.code;
          },
        });
        return counted;
      }),
    ),
    findCellOptionLines: vi.fn(real.findCellOptionLines),
    findCellAtPosition: vi.fn(real.findCellAtPosition),
  };
});
import * as qmd from "../../src/core/qmd/model";
import { createRangeLookup, embeddedCellAt } from "../../src/core/embedded/virtual-doc";

const scans = (): number => vi.mocked(qmd.findAllCells).mock.calls.length;
const optionReads = (): number => vi.mocked(qmd.findCellOptionLines).mock.calls.length;
const owners = (): number => vi.mocked(qmd.findCellAtPosition).mock.calls.length;
const codeReadsOf = (startLine: number): number => model.codeReads.get(startLine) ?? 0;

const DOC = [
  "---", // 0
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Intro prose.", // 4
  "```{python}", // 5   cell A: lines 5 to 10, body lines 7 to 9 (6 is its option line)
  "#| echo: false", // 6
  "import os", // 7
  "  ", // 8
  "x = 1", // 9
  "```", // 10
  "", // 11
  "```{python}", // 12  cell B: lines 12 to 14, body line 13
  "y = 2", // 13
  "```", // 14
  "```{bash}", // 15  cell C: lines 15 to 17, an engine the project does not map
  "echo hi", // 16
  "```", // 17
].join("\n");

describe("Session 342 -- what the range lookup reads from the model", () => {
  beforeEach(() => {
    vi.mocked(qmd.findAllCells).mockClear();
    vi.mocked(qmd.findCellOptionLines).mockClear();
    vi.mocked(qmd.findCellAtPosition).mockClear();
    model.codeReads.clear();
  });

  it("the counter can count: the parent's embeddedCellAt asks the model which cell holds the line and for the option lines, once each per call", () => {
    for (let k = 0; k < 4; k++) embeddedCellAt(DOC, 7);
    expect(owners()).toBe(4);
    expect(optionReads()).toBe(4);
    qmd.findAllCells(DOC); // the spy on the scan counts a call made through the module's export
    expect(scans()).toBe(1);
  });

  it("reads nothing at construction", () => {
    createRangeLookup(DOC);
    expect([scans(), optionReads(), owners()]).toEqual([0, 0, 0]);
    expect(model.codeReads.size).toBe(0);
  });

  it("many asks of all three kinds about body lines read the cells once and the option lines once, and never ask the model which cell holds a line", () => {
    const [cellA] = qmd.findAllCells(DOC); // the test's own call, cleared below
    vi.mocked(qmd.findAllCells).mockClear();
    model.codeReads.clear();
    const lookup = createRangeLookup(DOC);
    for (let k = 0; k < 50; k++) {
      expect(lookup.rangeInLanguageBody(7, 9, "python")).toBe(true);
      expect(lookup.rangeInCellBody(7, 9, cellA)).toBe(true);
      expect(lookup.hitAt(8)?.languageId).toBe("python");
    }
    // the row ends on the event that reads the state back (Learning 907)
    expect([scans(), optionReads(), owners()]).toEqual([1, 1, 0]);
  });

  it("the cells and the option lines are read once for the whole lookup", () => {
    const lookup = createRangeLookup(DOC);
    for (let k = 0; k < 50; k++) {
      lookup.rangeInLanguageBody(7, 9, "python");
      lookup.rangeInLanguageBody(13, 13, "python");
    }
    expect([scans(), optionReads(), owners()]).toEqual([1, 1, 0]);
  });

  it("a cell's code is read once however many lines of it are asked about (the line count of a body is a split of its code)", () => {
    const lookup = createRangeLookup(DOC);
    lookup.hitAt(7);
    const once = codeReadsOf(5);
    expect(once).toBeGreaterThan(0); // the cell is read, to count its body lines
    for (let k = 0; k < 40; k++) {
      lookup.hitAt(7);
      lookup.hitAt(8);
      lookup.hitAt(9);
      lookup.rangeInLanguageBody(7, 9, "python");
    }
    expect(codeReadsOf(5)).toBe(once);
    expect(codeReadsOf(12)).toBe(0); // the cell nobody asked about is not looked at
    lookup.hitAt(13);
    expect(codeReadsOf(12)).toBeGreaterThan(0);
    expect(codeReadsOf(5)).toBe(once);
  });

  it("asks that only touch a fence, prose, the front matter or a line past the end never read the option lines", () => {
    const lookup = createRangeLookup(DOC);
    for (const line of [0, 1, 2, 3, 4, 5, 10, 11, 12, 14, 18, 99, -1]) {
      expect(lookup.hitAt(line)).toBeNull();
      expect(lookup.rangeInLanguageBody(line, line, "python")).toBe(false);
    }
    expect([scans(), optionReads(), owners()]).toEqual([1, 0, 0]);
  });

  it("an ask into an unmapped engine's body reads neither the option lines nor that cell's code", () => {
    const lookup = createRangeLookup(DOC);
    expect(lookup.hitAt(16)).toBeNull();
    expect(lookup.rangeInLanguageBody(16, 16, "python")).toBe(false);
    expect([scans(), optionReads(), owners()]).toEqual([1, 0, 0]);
    expect(codeReadsOf(15)).toBe(0);
  });

  it("the option lines are read when an ask first reaches a body line, and then not again", () => {
    const lookup = createRangeLookup(DOC);
    lookup.hitAt(4); // prose
    expect(optionReads()).toBe(0);
    lookup.hitAt(6); // the option line itself is a line of the body span of a mapped cell: this ask reads the set, and answers null
    expect(optionReads()).toBe(1);
    lookup.hitAt(7);
    lookup.rangeInLanguageBody(7, 9, "python");
    expect(optionReads()).toBe(1);
  });

  it("a text with no cell is read once and asks for nothing else, however many lines are asked", () => {
    const lookup = createRangeLookup("just prose\n\n# Heading\n");
    for (let line = -1; line < 8; line++) expect(lookup.hitAt(line)).toBeNull();
    expect(lookup.rangeInCellBody(0, 3, { startLine: 0, endLine: 2, lang: "python", code: "" })).toBe(false);
    expect([scans(), optionReads(), owners()]).toEqual([1, 0, 0]);
  });

  it("two lookups over one text do not share what they read: each reads the cells once", () => {
    const first = createRangeLookup(DOC);
    const second = createRangeLookup(DOC);
    first.hitAt(7);
    const once = codeReadsOf(5);
    second.hitAt(7);
    first.hitAt(8);
    second.hitAt(8);
    expect([scans(), optionReads()]).toEqual([2, 2]);
    expect(codeReadsOf(5)).toBe(2 * once);
  });
});
