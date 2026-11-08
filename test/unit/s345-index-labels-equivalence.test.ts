import { describe, expect, it } from "vitest";
import { indexLabels, type RefLabel } from "../../src/core/refs";
import { cellTargetContext, findCellOptionLines, plainFrontMatter } from "../../src/core/qmd/model";
import { indexLabels as oldIndexLabels } from "./support/s345-old-refs";
import { cellTargetContext as oldCellTargetContext, plainFrontMatter as oldPlainFrontMatter } from "./support/s345-old-target-context";
import {
  ENGINES,
  type Engine,
  SEED,
  frontMatterDocuments,
  seededDocuments,
  shapeDocuments,
  structuredDocuments,
  trackedDocuments,
  writtenEveryWay,
} from "./support/s345-index-labels-corpus";

// Session 345 -- part P2 of the BACKLOG item SIB-01. `indexLabels` (src/core/refs.ts) stopped splitting the document's text again for facts it already held, and reads the option lines of a column-0 cell from the scan's
// own memo (`findCellOptionLines`) instead of running `cellOptionLinesOf` over the cell. The answer must not move by a label, a kind, a line or a column, and its order stays.
//
// THE ORACLE is the OLD function itself: `support/s345-old-refs.ts` is `src/core/refs.ts` at the base commit acbc51f (the parent of the cure), verbatim but for its imports, and `support/s345-old-target-context.ts`
// holds the old `cellTargetContext` and `plainFrontMatter` the same way, so the oracle shares NO changed line with the live code (a bug in the new `cellTargetContext` would otherwise be in both). Everything the cure
// does not touch (the scan, the option reader, the rules that judge a cell, the attribute reader) is the live code in both, which is the point: the differential isolates the cure.
//
// THE DOCUMENTS (`support/s345-index-labels-corpus.ts`): the product of the slots of a one-cell document (19,404), the product of the front-matter variants and the cells that read them (432), every sequence of up to
// three line shapes (14,425), 3,000 whole documents composed at random from the seed 345001 and written with a line terminator, a prefix and sometimes cut short, the same written with every terminator behind every prefix, and
// every tracked `.qmd`, `.md` and `.Rmd` file. Each is asked of all six values of the engine (omitted, knitr, jupyter, markdown, julia, ambiguous). The ENGINE ORDER rotates from text to text, and a third of the texts have the scan's option-line
// memo built before the live function runs (an earlier asker built it), so the memo is cold for some engines and warm for others. The floors on how many texts and labels were drawn (Learning 929) come after the rows.

type Outcome = { labels: RefLabel[] } | { threw: string };
const outcomeOf = (run: () => RefLabel[]): Outcome => {
  try {
    return { labels: run() };
  } catch (error) {
    return { threw: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
};

interface Tally {
  texts: number;
  compared: number;
  disagreements: string[];
  labels: number;
  withLabels: number;
  byKind: Record<string, number>;
  /** Texts whose knitr or jupyter answer differs from the omitted-engine answer: the documents on which the engine decides a label. */
  engineSensitive: number;
  threw: number;
}
const newTally = (): Tally => ({ texts: 0, compared: 0, disagreements: [], labels: 0, withLabels: 0, byKind: {}, engineSensitive: 0, threw: 0 });

/** The three functions compared with their old spellings. Rows hand the harness a broken one to see that it notices (Learning 910: a harness that cannot fail passes everything). */
interface Live {
  indexLabels: typeof indexLabels;
  cellTargetContext: typeof cellTargetContext;
  plainFrontMatter: typeof plainFrontMatter;
}
const LIVE: Live = { indexLabels, cellTargetContext, plainFrontMatter };

/** Ask the old and the live `indexLabels` the same question for every engine, and the old and the live context the same question once. */
function compareText(text: string, index: number, tally: Tally, engines: readonly Engine[] = ENGINES, live: Live = LIVE): void {
  tally.texts++;
  const note = (what: string, expected: unknown, actual: unknown): void => {
    if (tally.disagreements.length < 5) {
      tally.disagreements.push(`${what} on ${JSON.stringify(text).slice(0, 400)}: expected ${JSON.stringify(expected)?.slice(0, 600)}, got ${JSON.stringify(actual)?.slice(0, 600)}`);
    }
  };
  const answers = new Map<Engine, string>();
  for (let k = 0; k < engines.length; k++) {
    const engine = engines[(k + index) % engines.length];
    if (index % 3 === 0) {
      void findCellOptionLines(text); // an earlier asker built the scan's memo of option lines
    }
    let expected: Outcome;
    let actual: Outcome;
    if (index % 2 === 0) {
      actual = outcomeOf(() => live.indexLabels(text, engine));
      expected = outcomeOf(() => oldIndexLabels(text, engine));
    } else {
      expected = outcomeOf(() => oldIndexLabels(text, engine));
      actual = outcomeOf(() => live.indexLabels(text, engine));
    }
    tally.compared++;
    const e = JSON.stringify(expected);
    if (e !== JSON.stringify(actual)) {
      note(`indexLabels(${String(engine)})`, expected, actual);
    }
    answers.set(engine, e);
    if ("threw" in expected) {
      tally.threw++;
    } else {
      tally.labels += expected.labels.length;
      for (const label of expected.labels) {
        tally.byKind[label.kind] = (tally.byKind[label.kind] ?? 0) + 1;
      }
    }
  }
  const blind = answers.get(undefined);
  if (answers.get("knitr") !== blind || answers.get("jupyter") !== blind) {
    tally.engineSensitive++;
  }
  if ([...answers.values()].some((a) => a !== '{"labels":[]}')) {
    tally.withLabels++;
  }
  // the two functions the cure re-spelled for the text-taking callers
  const context = live.cellTargetContext(text);
  const oldContext = oldCellTargetContext(text);
  if (JSON.stringify(context) !== JSON.stringify(oldContext)) {
    note("cellTargetContext", oldContext, context);
  }
  if (live.plainFrontMatter(text) !== oldPlainFrontMatter(text)) {
    note("plainFrontMatter", oldPlainFrontMatter(text), live.plainFrontMatter(text));
  }
}

function compareAll(texts: Iterable<string>, engines: readonly Engine[] = ENGINES, live: Live = LIVE): Tally {
  const tally = newTally();
  let index = 0;
  for (const text of texts) {
    compareText(text, index++, tally, engines, live);
  }
  return tally;
}

describe("Session 345 -- the harness can fail: each way a live function can differ from the old one is seen", () => {
  // two labels in one document (a cell label and an image label), so that a reorder, a drop and a shift each change the answer
  const TWO = "```{python}\n#| label: fig-a\n```\n\n![c](a.png){#fig-b}\n";
  const broken = (change: (labels: RefLabel[], engine: Engine) => RefLabel[]): Live => ({ ...LIVE, indexLabels: (text, engine) => change(indexLabels(text, engine), engine) });
  const CASES: Array<[string, Live]> = [
    ["the first label dropped", broken((l) => l.slice(1))],
    ["the last label dropped", broken((l) => l.slice(0, -1))],
    ["a label added", broken((l) => [...l, { id: "fig-z", kind: "fig", line: 99, column: 0 }])],
    ["the order reversed", broken((l) => l.slice().reverse())],
    ["a column moved by one", broken((l) => l.map((x) => ({ ...x, column: x.column + 1 })))],
    ["a line moved by one", broken((l) => l.map((x) => ({ ...x, line: x.line + 1 })))],
    ["a kind swapped", broken((l) => l.map((x) => ({ ...x, kind: x.kind === "fig" ? "tbl" : "fig" })))],
    ["an id changed", broken((l) => l.map((x) => ({ ...x, id: x.id + "x" })))],
    ["a wrong answer for one engine only (knitr)", broken((l, engine) => (engine === "knitr" ? [] : l))],
    [
      "a throw for one engine only (jupyter)",
      broken((l, engine) => {
        if (engine === "jupyter") throw new RangeError("boom");
        return l;
      }),
    ],
    ["a context with the hidden flag flipped", { ...LIVE, cellTargetContext: (text) => ({ ...cellTargetContext(text), keepsHidden: !cellTargetContext(text).keepsHidden }) }],
    ["a context with a markdown line added", { ...LIVE, cellTargetContext: (text) => ({ ...cellTargetContext(text), markdownLines: [...cellTargetContext(text).markdownLines, 0] }) }],
    ["a plain front matter answered the other way", { ...LIVE, plainFrontMatter: (text) => !plainFrontMatter(text) }],
  ];

  it.each(CASES)("%s", (_name, live) => {
    const tally = compareAll([TWO], ENGINES, live);
    expect(tally.disagreements.length).toBeGreaterThanOrEqual(1);
  });

  it("the live functions themselves leave nothing to see on the same document", () => {
    expect(compareAll([TWO]).disagreements).toEqual([]);
    // the engines that read a cell's label keep both here, knitr and jupyter drop the cell's (nothing is left to show): 10 in all
    expect(compareAll([TWO]).labels).toBe(10);
  });
});

describe("Session 345 -- indexLabels answers exactly as the old spelling did", () => {
  it("every one-cell document of the structured product (11 openers x 14 option blocks x 7 bodies x 3 closers x 6 tails), all six engines", () => {
    const tally = compareAll(structuredDocuments());
    expect(tally.disagreements).toEqual([]);
    expect(tally.texts).toBe(19404);
    expect(tally.compared).toBe(19404 * ENGINES.length);
    expect(tally.threw).toBe(0);
    // the product draws the labels the rules decide: all five kinds, and many documents on which the engine changes the answer
    expect(Object.keys(tally.byKind).sort()).toEqual(["eq", "fig", "lst", "sec", "tbl"]);
    expect(tally.withLabels).toBeGreaterThanOrEqual(12000);
    expect(tally.engineSensitive).toBeGreaterThanOrEqual(2000);
  });

  it("every front-matter variant against every cell and tail (12 x 6 x 6), all six engines", () => {
    const tally = compareAll(frontMatterDocuments());
    expect(tally.disagreements).toEqual([]);
    expect(tally.texts).toBe(432);
    expect(tally.withLabels).toBeGreaterThanOrEqual(350);
    expect(tally.engineSensitive).toBeGreaterThanOrEqual(90);
  });

  it("every sequence of up to three line shapes (14,425), all six engines", () => {
    const tally = compareAll(shapeDocuments());
    expect(tally.disagreements).toEqual([]);
    expect(tally.texts).toBe(14425);
    expect(tally.withLabels).toBeGreaterThanOrEqual(3000);
    expect(tally.engineSensitive).toBeGreaterThanOrEqual(10);
  });

  it(`3,000 whole documents from the seed ${SEED}, each with a terminator, a prefix and every fifth cut short`, () => {
    const tally = compareAll(seededDocuments(3000));
    expect(tally.disagreements).toEqual([]);
    expect(tally.texts).toBe(3000);
    expect(tally.withLabels).toBeGreaterThanOrEqual(1600);
    expect(tally.engineSensitive).toBeGreaterThanOrEqual(50);
    expect(Object.keys(tally.byKind).sort()).toEqual(["eq", "fig", "lst", "sec", "tbl"]);
  });

  it("every terminator behind every prefix: CR, CRLF, LF, U+2028, U+2029, a form feed; a byte order mark, blank lines, spaces, a tab", () => {
    const base = [...structuredDocuments()].filter((_, i) => i % 400 === 0);
    const tally = compareAll(writtenEveryWay(base));
    expect(base.length).toBe(49);
    expect(tally.disagreements).toEqual([]);
    expect(tally.texts).toBe(49 * 6 * 7);
    expect(tally.withLabels).toBeGreaterThanOrEqual(450);
    expect(tally.engineSensitive).toBeGreaterThanOrEqual(15);
  });

  it("the empty text and the texts that are a terminator and nothing else", () => {
    const tally = compareAll(["", "\n", "\r\n", "\r", "\u2028", "\u2029", "\f", "\n\n\n", BOM_ONLY, "---", "---\n", "```{python}", "```{python}\n#| label: fig-a"]);
    expect(tally.disagreements).toEqual([]);
    expect(tally.texts).toBe(13);
  });

  it("a header holding a 12 MB string (the shape that once overflowed the option reader's regex stack, hunt3 robust-perf f26): the same answer or the same error", () => {
    const header = ["```{r label=\"fig-x\", \"" + "A".repeat(12_000_000) + "\", eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)", "```"].join("\n");
    const tally = compareAll([header, "```{python}\n#| label: fig-y\n#| fig-cap: " + "'" + "A".repeat(12_000_000) + "'\n```\n"]);
    expect(tally.disagreements).toEqual([]);
    expect(tally.texts).toBe(2);
  });

  it("every tracked .qmd, .md and .Rmd file of the repository, all six engines", () => {
    const documents = trackedDocuments();
    const tally = compareAll(documents.map(([, text]) => text));
    expect(tally.disagreements).toEqual([]);
    expect(documents.length).toBeGreaterThanOrEqual(100);
    expect(documents.filter(([path]) => path.endsWith(".qmd")).length).toBeGreaterThanOrEqual(30);
    expect(tally.texts).toBe(documents.length);
    expect(tally.labels).toBeGreaterThanOrEqual(80);
    expect(tally.withLabels).toBeGreaterThanOrEqual(4);
  });
});

const BOM_ONLY = String.fromCharCode(0xfeff);
