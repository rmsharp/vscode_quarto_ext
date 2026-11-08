import { describe, expect, it, vi } from "vitest";
import { indexLabels } from "../../src/core/refs";
import { indexLabels as oldIndexLabels } from "./support/s345-old-refs";
import { attributeBlockReader, cellOptionLinesOf, cellTargetContext, findAllCells, findCellOptionLines, plainFrontMatter } from "../../src/core/qmd/model";

// Session 345 -- part P2 of the BACKLOG item SIB-01 ("the first completion request after an edit pays a cold whole-document scan"): `indexLabels` stops re-deriving what it already holds.
//
// `indexLabels(text, engine)` is a SECOND whole-document pass after the scan, and it split the text again and again for facts it held: its own `sourceLines`, one split inside `cellTargetContext(text)` (the markdown
// channel lines; knitr and jupyter only, or the first `sec-` / `eq-` cell label of any other engine) and ANOTHER inside the `plainFrontMatter(text)` that call makes, plus the one inside `attributeBlockReader(text)`
// (part P1's, not this part's). It also read the option lines of EVERY cell through `cellOptionLinesOf`, though the scan's cache entry keeps exactly those lines (`findCellOptionLines`, the memo of Session 343) for a cell whose
// fence has no indent, and it split the body of EVERY cell, for rules that read the body of a few. The old spelling of the whole function is kept as the oracle (`support/s345-old-refs.ts`) and `s345-index-labels-equivalence.test.ts`
// compares it with the live one; THIS file counts.
//
// THE COUNTS, not the clock: a split of the document's own text is counted by the receiver (`countSplitsOf`, the pattern of `s343-completion-context-rows.test.ts`: a split of a slice, a line or any other string is not seen), a split of
// a CELL'S BODY the same way (`countBodySplits`: the receiver is one of the cells' code strings), and the calls `refs.ts` makes of the model's `cellOptionLinesOf` are written down by a wrapper that calls through (the pattern of
// `s342-builder-engine-rows.test.ts`: the model's OWN calls, `findCellOptionLines` reading its cells, are inside its module and not seen).
//
// MEASURED at the parent `acbc51f` on a 60-cell document (62 cells with the two at its end), one call WARM (the scan cached): knitr / jupyter 5 splits of the text, 2 of them `attributeBlockReader`'s (its own and the one in
// `quartoYamlRegions`, which it hands the lines joined again); every other engine 3, and 5 when a `sec-` cell label asks `canWriteAtRunTime` (which builds the whole context for itself). `cellTargetContext(text)` 2,
// `plainFrontMatter(text)` 1. 62 `cellOptionLinesOf` calls, one for each cell, and a split of the body of each of the 61 cells with code.
// After part P2 alone the warm count was 3 (the call's own and part P1's two). With part P1 in (the tree these rows run on, `9fcf624`, the same document, load 4 to 6), a WARM call splits the text exactly ONCE, whatever the
// engine and whatever the labels: its own `sourceLines` (`attributeBlockReader` answers from the scan's entry and splits nothing, so a bound has no term left for it), and joins no whole document's lines. A COLD call (no scan of the
// text yet) splits it THREE times, and they are three different ones: its own, `computeRegions` (the scan) and `quartoYamlRegions` (the scan's one read of the metadata block) -- the call's one split on top of the 2 the scan costs by
// itself, which the first ask of any view of that text pays. `cellTargetContext(text)` 1, no `cellOptionLinesOf` call for a cell read as it stands, and a body split for a cell whose figure or table label a knitr / Jupyter
// document judges (48 of the 61 here) and for no other, once.
const asked = vi.hoisted(() => ({ on: false, optionLines: 0, optionLineCalls: 0, failMemo: false, optionLineArgs: [] as unknown[][] }));
vi.mock("../../src/core/qmd/model", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/core/qmd/model")>();
  return {
    ...real,
    cellOptionLinesOf: (...args: Parameters<typeof real.cellOptionLinesOf>) => {
      if (asked.on) asked.optionLines++;
      return real.cellOptionLinesOf(...args);
    },
    findCellOptionLines: (...args: Parameters<typeof real.findCellOptionLines>) => {
      if (asked.on) {
        asked.optionLineCalls++;
        asked.optionLineArgs.push(args);
      }
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

/** How many times `String.prototype.split` is called with one of `bodies` as its receiver (a cell's code, compared by value) while `run` runs. A split of the text, of a line or of a cell's stripped copy is not seen. */
function countBodySplits(bodies: ReadonlySet<string>, run: () => void): number {
  const original = String.prototype.split;
  let count = 0;
  String.prototype.split = function (this: string, ...args: unknown[]): string[] {
    if (typeof this === "string" && bodies.has(this)) count++;
    return (original as (...a: unknown[]) => string[]).apply(this, args);
  } as typeof String.prototype.split;
  try {
    run();
  } finally {
    String.prototype.split = original;
  }
  return count;
}

/** The code of each cell of `text` that has any, the way the scan holds it: the strings `indexLabels` would split for a cell's body. */
const bodiesOf = (text: string): ReadonlySet<string> => new Set(findAllCells(text).map((cell) => cell.code).filter((code) => code !== ""));

/** `text` with a comment line at its end that no other text has: no scan of it exists, so the first ask of any view of it is COLD. The cells and the labels are the same. */
let unreadCount = 0;
const unread = (text: string): string => `${text}<!-- unread ${++unreadCount} -->\n`;

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
  asked.optionLineArgs = [];
  asked.on = true;
  try {
    run();
  } finally {
    asked.on = false;
  }
  return { cellOptionLinesOf: asked.optionLines, findCellOptionLines: asked.optionLineCalls };
}

/**
 * A document of `cells` python cells, each with a `label:` option and sixteen lines of code, and two more at the end (below). Every `indentedEvery`-th cell sits in a list item (an INDENTED fence), every 5th label is a
 * `sec-` label (no knitr / jupyter target, so it reaches `canWriteAtRunTime` for the engines that have no context yet) and every 4th a `tbl-` label; the rest are `fig-`. The front matter is plain. The cells are `{python}`
 * unless `lang` says otherwise (any language whose option lines begin `#|`).
 */
function documentOf(cells: number, indentedEvery: number, sec: boolean = true, lang: string = "python"): { text: string; indented: number } {
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
    out.push(`${pad}\`\`\`{${lang}}`, `${pad}#| label: ${kind}-${i}`, `${pad}#| echo: false`);
    for (let j = 0; j < 16; j++) out.push(`${pad}x${j} = ${j} + ${i}`);
    out.push(`${pad}\`\`\``, "");
  }
  // Two cells more, whatever the arguments: one at column 0 with code and NO option line, and one INDENTED with NO code at all (nothing to strip, so it is read as it stands). Both are read from the memo, which holds nothing for either.
  out.push(`\`\`\`{${lang}}`, "x = 1", "```", "", "- last item", "", `  \`\`\`{${lang}}`, "  ```", "");
  return { text: out.join(LF), indented };
}

/** The scan of `text` made, so that no row counts the scan's own split. */
const warm = (text: string): void => void findAllCells(text);

/**
 * The scan made AND the scan's memo of option lines built. `findCellOptionLines(text)` splits the code of EVERY cell once, for the first asker (it is `findAllCells` flat-mapped through `cellOptionLinesOf`), so a row that
 * counts the splits of cells' bodies starts from here, or its answer would depend on which row ran before it.
 */
const warmWithMemo = (text: string): void => {
  warm(text);
  void findCellOptionLines(text);
};

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

  it("the body counter counts a split of a cell's code and not a split of the text, of a line, of a slice or of a copy, and puts String.prototype.split back", () => {
    const original = String.prototype.split;
    const cells = findAllCells(text);
    const bodies = bodiesOf(text);
    expect(cells.length).toBe(5); // three cells, the one at column 0 with code and no option line, and the indented one with no code at all
    expect(bodies.size).toBe(4); // an empty code is not a body: nothing is split for it
    const [first] = cells;
    expect(countBodySplits(bodies, () => void first.code.split(LF))).toBe(1);
    expect(countBodySplits(bodies, () => void (first.code.split(LF), cells[1].code.split(LF)))).toBe(2);
    expect(countBodySplits(bodies, () => void text.split(LF))).toBe(0);
    expect(countBodySplits(bodies, () => void first.code.slice(1).split(LF))).toBe(0);
    expect(countBodySplits(bodies, () => void first.code.split(LF)[0].split(" "))).toBe(1);
    expect(countBodySplits(bodies, () => void "".split(LF))).toBe(0);
    expect(() =>
      countBodySplits(bodies, () => {
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

describe("Session 345 -- indexLabels splits the text once of its own, whatever the engine: exactly one on a warm call, and one on top of the scan's own on a cold one", () => {
  const { text } = documentOf(60, 0);
  const { text: noSec } = documentOf(60, 0, false);

  it("the premise: the document holds cells of all three kinds; a text no scan has read costs splits the counter SEES, a cached one costs none, and neither does the reader of part P1 on it", () => {
    expect(text).toContain("#| label: sec-0");
    expect(text).toContain("#| label: tbl-4");
    expect(text).toContain("#| label: fig-1");
    const cold = unread(text);
    // the first ask of a view: the scan splits the text, and joins its lines once (the metadata block), and the counters see both
    let scanJoins = 0;
    const scanSplits = countSplitsOf(cold, () => void (scanJoins = countWholeJoins(cold, () => void findAllCells(cold))));
    expect(scanSplits).toBeGreaterThanOrEqual(1);
    expect(scanJoins).toBeGreaterThanOrEqual(1);
    // the second ask finds the entry: the scan costs nothing, so `warm` leaves a call to show its OWN splits and joins
    expect(countSplitsOf(cold, () => void findAllCells(cold))).toBe(0);
    expect(countWholeJoins(cold, () => void findAllCells(cold))).toBe(0);
    for (const document of [text, noSec]) {
      warm(document);
      expect(countSplitsOf(document, () => void findAllCells(document))).toBe(0);
      // part P1: the reader answers from the scan's entry, so the bounds below carry no term for it (the parent's splits twice: its own and `quartoYamlRegions`'s)
      expect(countSplitsOf(document, () => void attributeBlockReader(document))).toBe(0);
      expect(countWholeJoins(document, () => void attributeBlockReader(document))).toBe(0);
    }
  });

  for (const engine of [undefined, "knitr", "jupyter", "markdown"] as const) {
    it(`${String(engine)}: no join of a whole document's lines on a warm call (the metadata block's join is the scan's, once)`, () => {
      warm(text);
      expect(countWholeJoins(text, () => void indexLabels(text, engine))).toBe(0);
    });
  }

  for (const engine of ["knitr", "jupyter"] as const) {
    it(`${engine}: exactly ONE split of the text on a warm call (the parent made five: its own, the context's two and the reader's two)`, () => {
      warm(text);
      expect(countSplitsOf(text, () => void indexLabels(text, engine))).toBe(1);
    });
  }

  for (const engine of [undefined, "markdown", "julia", "ambiguous"] as const) {
    it(`${String(engine)} with a sec- cell label (canWriteAtRunTime builds a context of its own): exactly one split on a warm call (the parent made five)`, () => {
      warm(text);
      expect(countSplitsOf(text, () => void indexLabels(text, engine))).toBe(1);
    });

    it(`${String(engine)} with no such label (no context at all): exactly one split on a warm call (the parent made three: its own and the reader's two)`, () => {
      warm(noSec);
      expect(countSplitsOf(noSec, () => void indexLabels(noSec, engine))).toBe(1);
    });
  }

  for (const engine of [undefined, "knitr", "jupyter", "markdown", "julia", "ambiguous"] as const) {
    it(`${String(engine)}, cold: the call's one split on top of the scan's own (measured 1 + 2 = 3; the parent made eight)`, () => {
      const scanned = unread(text);
      const asked = unread(text);
      const scanAlone = countSplitsOf(scanned, () => void findAllCells(scanned));
      const whole = countSplitsOf(asked, () => void indexLabels(asked, engine));
      expect(scanAlone).toBeGreaterThanOrEqual(1);
      expect(whole).toBe(scanAlone + 1);
    });
  }
});

describe("Session 345 -- indexLabels splits the body of a cell on first use: once for each cell whose figure or table label a knitr / Jupyter document judges, and for no other", () => {
  const { text } = documentOf(60, 0);
  const bodies = bodiesOf(text);
  // The labels the rules judge: the 12 `sec-` ones are dropped before the body is looked at (the document has no channel for code to write markdown), the other 48 are a figure or a table.
  const judged = (text.match(/#\| label: (?:fig|tbl)-\d+/g) ?? []).length;

  it("the premise: 61 cells have code (the 62nd is empty), 48 of the 60 labels are figures or tables", () => {
    expect(bodies.size).toBe(61);
    expect(judged).toBe(48);
  });

  for (const engine of [undefined, "markdown", "julia", "ambiguous"] as const) {
    it(`${String(engine)}: no body is split at all (nothing reads one; the parent split all 61)`, () => {
      warmWithMemo(text);
      expect(countBodySplits(bodies, () => void indexLabels(text, engine))).toBe(0);
    });
  }

  for (const engine of ["knitr", "jupyter"] as const) {
    it(`${engine}: one split for each of the ${judged} cells with a figure or table label, none for the sec- ones (the parent split 61)`, () => {
      warmWithMemo(text);
      expect(countBodySplits(bodies, () => void indexLabels(text, engine))).toBe(judged);
    });

    it(`${engine}: a cell that asks twice (two label lines) has its body split once, and the answer is the old one`, () => {
      const twice = ["---", "title: t", "---", "", "```{python}", "#| label: fig-a", "#| label: fig-b", "x = 1", "```", ""].join(LF);
      warmWithMemo(twice);
      expect(countBodySplits(bodiesOf(twice), () => void indexLabels(twice, engine))).toBe(1);
      expect(indexLabels(twice, engine)).toEqual(oldIndexLabels(twice, engine));
    });
  }
});

describe("Session 345 -- indexLabels reads the option lines of a column-0 cell from the scan's own memo", () => {
  it("62 cells, none indented but one empty: no call of cellOptionLinesOf (the parent made 62), the scan's memo asked at most once", () => {
    const { text } = documentOf(60, 0);
    warm(text);
    const made = askedOf(() => void indexLabels(text, "jupyter"));
    expect(made.cellOptionLinesOf).toBe(0);
    expect(made.findCellOptionLines).toBeLessThanOrEqual(1);
  });

  it("62 cells, every 10th indented (6): exactly those 6 are read by cellOptionLinesOf, the other 56 from the memo (the empty indented cell among them)", () => {
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
      expect(made.cellOptionLinesOf).toBe(32); // every cell (30 and the two at the end) by its own read, as at the parent
    }
  });

  it("it asks for the engine-BLIND list, the one `findAllCells(text)` makes its cells from, whatever the engine of the document", () => {
    const { text } = documentOf(12, 4);
    for (const engine of [undefined, "knitr", "jupyter", "markdown", "julia", "ambiguous"] as const) {
      warm(text);
      askedOf(() => void indexLabels(text, engine));
      expect(asked.optionLineArgs).toEqual([[text]]);
    }
  });

  it("the same for every engine", () => {
    const { text } = documentOf(40, 8);
    for (const engine of [undefined, "knitr", "jupyter", "markdown", "julia", "ambiguous"] as const) {
      warm(text);
      expect(askedOf(() => void indexLabels(text, engine)).cellOptionLinesOf).toBe(5);
    }
  });

  // The documents above hold `{python}` cells, which is Jupyter's; a knitr document's own cells are `{r}`. The memo is the scan's list of EVERY cell whatever its language, so a rule that reads it for one language only
  // (python) and goes through `cellOptionLinesOf` for the rest would keep every answer and lose the saving for the knitr documents.
  for (const lang of ["r", "R", "julia"] as const) {
    it(`{${lang}} cells: a column-0 cell is read from the memo and an indented one by cellOptionLinesOf, for every engine, and the answer is the old one`, () => {
      const column0 = documentOf(60, 0, true, lang).text;
      const mixed = documentOf(60, 10, true, lang);
      expect(mixed.indented).toBe(6);
      for (const engine of [undefined, "knitr", "jupyter", "markdown"] as const) {
        warm(column0);
        expect(askedOf(() => void indexLabels(column0, engine)).cellOptionLinesOf).toBe(0);
        expect(indexLabels(column0, engine)).toEqual(oldIndexLabels(column0, engine));
        warm(mixed.text);
        expect(askedOf(() => void indexLabels(mixed.text, engine)).cellOptionLinesOf).toBe(6);
        expect(indexLabels(mixed.text, engine)).toEqual(oldIndexLabels(mixed.text, engine));
      }
    });
  }
});
