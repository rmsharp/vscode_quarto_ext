import { describe, expect, it, vi } from "vitest";
import { indexLabels } from "../../src/core/refs";
import { indexLabels as oldIndexLabels } from "./support/s345-old-refs";
import { attributeBlockReader, cellOptionLinesOf, cellTargetContext, findAllCells, findCellOptionLines, plainFrontMatter } from "../../src/core/qmd/model";

// Session 345 -- part P2 of the BACKLOG item SIB-01 ("the first completion request after an edit pays a cold whole-document scan"): `indexLabels` stops re-deriving what it already holds.
//
// `indexLabels(text, engine)` is a SECOND whole-document pass after the scan, and it split the text again and again for facts it held: its own `sourceLines`, one split inside `cellTargetContext(text)` (the markdown
// channel lines; knitr and jupyter only, or the first `sec-` / `eq-` cell label of any other engine) and ANOTHER inside the `plainFrontMatter(text)` that call makes, plus the one inside `attributeBlockReader(text)`
// (part P1's, not this part's). It also read the option lines of EVERY cell through `cellOptionLinesOf`, though the scan's cache entry keeps exactly those lines (`findCellOptionLines`, the memo of Session 343) for a cell whose
// fence has no indent. The old spelling of the whole function is kept as the oracle (`support/s345-old-refs.ts`) and `s345-index-labels-equivalence.test.ts` compares it with the live one; THIS file counts.
//
// THE COUNTS, not the clock: a split of the document's own text is counted by the receiver (`countSplitsOf`, the pattern of `s343-completion-context-rows.test.ts`: a split of a slice, a line or any other string is not seen), and the
// calls `refs.ts` makes of the model's `cellOptionLinesOf` are written down by a wrapper that calls through (the pattern of `s342-builder-engine-rows.test.ts`: the model's OWN calls, `findCellOptionLines` reading its cells, are
// inside its module and not seen). Measured at the parent `acbc51f` on a 60-cell document (cells counted below): knitr / jupyter 4 splits a call, 1 of them `attributeBlockReader`'s; every other engine 2, and 4 when a `sec-` cell
// label asks `canWriteAtRunTime` (which builds the whole context for itself). `cellTargetContext(text)` 2, `plainFrontMatter(text)` 1. 60 + 6 `cellOptionLinesOf` calls, one for each cell.
const asked = vi.hoisted(() => ({ on: false, optionLines: 0, optionLineCalls: 0, failMemo: false }));
vi.mock("../../src/core/qmd/model", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/core/qmd/model")>();
  return {
    ...real,
    cellOptionLinesOf: (...args: Parameters<typeof real.cellOptionLinesOf>) => {
      if (asked.on) asked.optionLines++;
      return real.cellOptionLinesOf(...args);
    },
    findCellOptionLines: (...args: Parameters<typeof real.findCellOptionLines>) => {
      if (asked.on) asked.optionLineCalls++;
      if (asked.failMemo) throw new RangeError("the scan's list could not be built");
      return real.findCellOptionLines(...args);
    },
  };
});

const LF = "\n";

/** How many times `String.prototype.split` is called with `target` itself as its receiver while `run` runs. */
function countSplitsOf(target: string, run: () => void): number {
  const original = String.prototype.split;
  let count = 0;
  String.prototype.split = function (this: string, ...args: unknown[]): string[] {
    if (typeof this === "string" && this === target) count++;
    return (original as (...a: unknown[]) => string[]).apply(this, args);
  } as typeof String.prototype.split;
  try {
    run();
  } finally {
    String.prototype.split = original;
  }
  return count;
}

/** How many times `Array.prototype.join` is called on an array of at least as many strings as `text` has lines (a join of ALL the document's lines, not of one cell's) while `run` runs. */
function countWholeJoins(text: string, run: () => void): number {
  const lineCount = text.split(/\r?\n/).length;
  const original = Array.prototype.join;
  let count = 0;
  Array.prototype.join = function (this: unknown[], ...args: unknown[]): string {
    if (this.length >= lineCount) count++;
    return (original as (...a: unknown[]) => string).apply(this, args);
  } as typeof Array.prototype.join;
  try {
    run();
  } finally {
    Array.prototype.join = original;
  }
  return count;
}

/** What `run` asks of the model through its exports: the calls of `cellOptionLinesOf` and of `findCellOptionLines`. */
function askedOf(run: () => void): { cellOptionLinesOf: number; findCellOptionLines: number } {
  asked.optionLines = 0;
  asked.optionLineCalls = 0;
  asked.on = true;
  try {
    run();
  } finally {
    asked.on = false;
  }
  return { cellOptionLinesOf: asked.optionLines, findCellOptionLines: asked.optionLineCalls };
}

/**
 * A document of `cells` python cells, each with a `label:` option and sixteen lines of code. Every `indentedEvery`-th cell sits in a list item (an INDENTED fence), every 5th label is a `sec-` label (no knitr / jupyter
 * target, so it reaches `canWriteAtRunTime` for the engines that have no context yet) and every 4th a `tbl-` label; the rest are `fig-`. The front matter is plain.
 */
function documentOf(cells: number, indentedEvery: number, sec: boolean = true): { text: string; indented: number } {
  const out: string[] = ["---", "title: t", "format: html", "---", ""];
  let indented = 0;
  for (let i = 0; i < cells; i++) {
    const kind = sec && i % 5 === 0 ? "sec" : i % 4 === 0 ? "tbl" : "fig";
    const pad = indentedEvery > 0 && i % indentedEvery === 0 ? "  " : "";
    if (pad !== "") {
      indented++;
      out.push(`## Section ${i}`, "", `- Item with @fig-${i} and more words here.`, "");
    } else {
      out.push(`## Section ${i}`, "", `Prose with @fig-${i} and more words here.`, "");
    }
    out.push(`${pad}\`\`\`{python}`, `${pad}#| label: ${kind}-${i}`, `${pad}#| echo: false`);
    for (let j = 0; j < 16; j++) out.push(`${pad}x${j} = ${j} + ${i}`);
    out.push(`${pad}\`\`\``, "");
  }
  return { text: out.join(LF), indented };
}

/** The scan of `text` made, so that no row counts the scan's own split. */
const warm = (text: string): void => void findAllCells(text);

describe("Session 345 -- the counter counts a split of the text and the model calls it was built for", () => {
  const text = documentOf(3, 0).text;

  it("counts a split of the text and not a split of another string", () => {
    expect(countSplitsOf(text, () => void text.split(/\r?\n/))).toBe(1);
    expect(countSplitsOf(text, () => void text.split(/\r?\n/).length)).toBe(1);
    expect(countSplitsOf(text, () => void "other text".split("t"))).toBe(0);
    expect(countSplitsOf(text, () => void text.slice(1).split("\n"))).toBe(0);
    expect(countSplitsOf(text, () => void 0)).toBe(0);
    expect(countSplitsOf(text, () => void (text.split(LF), text.split(LF)))).toBe(2);
  });

  it("puts String.prototype.split back, whether the work returns or throws", () => {
    const original = String.prototype.split;
    countSplitsOf(text, () => void text.split(LF));
    expect(String.prototype.split).toBe(original);
    expect(() =>
      countSplitsOf(text, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(String.prototype.split).toBe(original);
  });

  it("the join counter counts a join of all the lines and not a join of a few, and puts Array.prototype.join back", () => {
    const original = Array.prototype.join;
    const all = text.split(LF);
    expect(countWholeJoins(text, () => void all.join(LF))).toBe(1);
    expect(countWholeJoins(text, () => void all.slice(0, 3).join(LF))).toBe(0);
    expect(countWholeJoins(text, () => void (all.join(LF), all.join(LF)))).toBe(2);
    expect(() =>
      countWholeJoins(text, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(Array.prototype.join).toBe(original);
  });

  it("the wrapper of the model counts the calls of its two exports, nothing else, and hands the real answer back", () => {
    expect(askedOf(() => void 0)).toEqual({ cellOptionLinesOf: 0, findCellOptionLines: 0 });
    const [cell] = findAllCells(text);
    const made = askedOf(() => void cellOptionLinesOf(cell));
    expect(made).toEqual({ cellOptionLinesOf: 1, findCellOptionLines: 0 });
    expect(askedOf(() => void findCellOptionLines(text))).toEqual({ cellOptionLinesOf: 0, findCellOptionLines: 1 });
    expect(cellOptionLinesOf(cell).map((o) => o.line)).toEqual([10, 11]);
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([10, 11, 35, 36, 60, 61]);
  });
});

describe("Session 345 -- the model's own text-taking functions split the text once", () => {
  const { text } = documentOf(60, 0);

  it("cellTargetContext(text): ONE split (the parent split it for the markdown lines and again inside plainFrontMatter)", () => {
    expect(countSplitsOf(text, () => void cellTargetContext(text))).toBe(1);
  });

  it("plainFrontMatter(text): one split", () => {
    expect(countSplitsOf(text, () => void plainFrontMatter(text))).toBe(1);
  });
});

describe("Session 345 -- indexLabels splits the text once of its own, whatever the engine", () => {
  const { text } = documentOf(60, 0);
  const { text: noSec } = documentOf(60, 0, false);
  // The share of part P1 is whatever `attributeBlockReader(text)` splits for itself, read from that function here and not written as a number: a cure of P1 that hands it the lines changes it, and these rows stay true.
  const p1 = (document: string): number => countSplitsOf(document, () => void attributeBlockReader(document));

  it("the premise: the document holds cells of all three kinds, and the reader of part P1 is counted on the same footing", () => {
    expect(text).toContain("#| label: sec-0");
    expect(text).toContain("#| label: tbl-4");
    expect(text).toContain("#| label: fig-1");
    warm(text);
    expect(p1(text)).toBe(countSplitsOf(text, () => void attributeBlockReader(text)));
    expect(p1(noSec)).toBeGreaterThanOrEqual(0);
  });

  for (const engine of [undefined, "knitr", "jupyter", "markdown"] as const) {
    it(`${String(engine)}: no join of a whole document's lines beside attributeBlockReader's (the parent's own made none)`, () => {
      warm(text);
      const own = countWholeJoins(text, () => void indexLabels(text, engine));
      expect(own).toBeLessThanOrEqual(countWholeJoins(text, () => void attributeBlockReader(text)));
    });
  }

  for (const engine of ["knitr", "jupyter"] as const) {
    it(`${engine}: at most one split of the text beside attributeBlockReader's (the parent made three more: the context's two and the reader's)`, () => {
      warm(text);
      const splits = countSplitsOf(text, () => void indexLabels(text, engine));
      expect(splits).toBeLessThanOrEqual(1 + p1(text));
      expect(splits).toBeGreaterThanOrEqual(1);
    });
  }

  for (const engine of [undefined, "markdown", "julia", "ambiguous"] as const) {
    it(`${String(engine)} with a sec- cell label (canWriteAtRunTime builds a context of its own): at most one split beside attributeBlockReader's`, () => {
      warm(text);
      const splits = countSplitsOf(text, () => void indexLabels(text, engine));
      expect(splits).toBeLessThanOrEqual(1 + p1(text));
      expect(splits).toBeGreaterThanOrEqual(1);
    });

    it(`${String(engine)} with no such label (no context at all): the same bound, true at the parent too`, () => {
      warm(noSec);
      const splits = countSplitsOf(noSec, () => void indexLabels(noSec, engine));
      expect(splits).toBeLessThanOrEqual(1 + p1(noSec));
      expect(splits).toBeGreaterThanOrEqual(1);
    });
  }
});

describe("Session 345 -- indexLabels reads the option lines of a column-0 cell from the scan's own memo", () => {
  it("60 cells, none indented: no call of cellOptionLinesOf (the parent made 60), the scan's memo asked at most once", () => {
    const { text } = documentOf(60, 0);
    warm(text);
    const made = askedOf(() => void indexLabels(text, "jupyter"));
    expect(made.cellOptionLinesOf).toBe(0);
    expect(made.findCellOptionLines).toBeLessThanOrEqual(1);
  });

  it("60 cells, every 10th indented (6): exactly those 6 are read by cellOptionLinesOf, the other 54 from the memo", () => {
    const { text, indented } = documentOf(60, 10);
    expect(indented).toBe(6);
    warm(text);
    const made = askedOf(() => void indexLabels(text, "jupyter"));
    expect(made.cellOptionLinesOf).toBe(6);
    expect(made.findCellOptionLines).toBeLessThanOrEqual(1);
  });

  it("every cell indented: every cell is read by cellOptionLinesOf, as at the parent", () => {
    const { text, indented } = documentOf(20, 1);
    expect(indented).toBe(20);
    warm(text);
    const made = askedOf(() => void indexLabels(text, "knitr"));
    expect(made.cellOptionLinesOf).toBe(20);
  });

  it("when the scan's list cannot be built (the reader threw on a cell the loop would not have read as it stands) every cell goes through its own read, and the answer is the old one", () => {
    const { text } = documentOf(30, 10);
    for (const engine of [undefined, "knitr", "jupyter", "markdown"] as const) {
      warm(text);
      asked.failMemo = true;
      let labels: unknown = null;
      let made: ReturnType<typeof askedOf>;
      try {
        made = askedOf(() => void (labels = indexLabels(text, engine)));
      } finally {
        asked.failMemo = false;
      }
      expect(labels).toEqual(oldIndexLabels(text, engine));
      expect(made.findCellOptionLines).toBe(1); // asked once, failed, and not asked again
      expect(made.cellOptionLinesOf).toBe(30); // every cell by its own read, as at the parent
    }
  });

  it("the same for every engine", () => {
    const { text } = documentOf(40, 8);
    for (const engine of [undefined, "knitr", "jupyter", "markdown", "julia", "ambiguous"] as const) {
      warm(text);
      expect(askedOf(() => void indexLabels(text, engine)).cellOptionLinesOf).toBe(5);
    }
  });
});
