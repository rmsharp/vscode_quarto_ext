import { describe, expect, it } from "vitest";
import { cellTargetContext, cellTargetContextOfLines, plainFrontMatter, plainFrontMatterOfLines } from "../../src/core/qmd/model";
import { cellTargetContext as oldCellTargetContext, plainFrontMatter as oldPlainFrontMatter } from "./support/s345-old-target-context";
import { BOM, frontMatterDocuments, seededDocuments, shapeDocuments, structuredDocuments, trackedDocuments } from "./support/s345-index-labels-corpus";

// Session 345 -- part P2 of the BACKLOG item SIB-01. `cellTargetContext(text)` and `plainFrontMatter(text)` each split the whole text for themselves, and `cellTargetContext` calls `plainFrontMatter`, so one call
// of the first split the text twice. `indexLabels` already holds the lines (it splits once to read them by index), so the model now exports the same two functions for a caller that HOLDS the lines:
// `cellTargetContextOfLines(text, lines)` and `plainFrontMatterOfLines(lines)`, where `lines` is `text.split(/\r?\n/)`. The text-taking functions keep their signatures and their answers and delegate (one split each).
//
// The OLD spellings are kept verbatim in `support/s345-old-target-context.ts` and every row compares against them, never against the delegating wrappers: a mistake in the shared body would otherwise be in both.

const LINES = /\r?\n/;
const sameContext = (text: string): boolean => JSON.stringify(cellTargetContextOfLines(text, text.split(LINES))) === JSON.stringify(oldCellTargetContext(text));

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

describe("Session 345 -- cellTargetContextOfLines and plainFrontMatterOfLines answer as the old text-taking spellings did", () => {
  it("the structured product, every 7th document (2,772), and every front-matter variant (432)", () => {
    let compared = 0;
    const disagreements: string[] = [];
    let index = 0;
    for (const text of [...structuredDocuments()].filter(() => index++ % 7 === 0).concat([...frontMatterDocuments()])) {
      compared++;
      if (!sameContext(text) && disagreements.length < 5) disagreements.push(JSON.stringify(text).slice(0, 300));
      if (plainFrontMatterOfLines(text.split(LINES)) !== oldPlainFrontMatter(text) && disagreements.length < 5) disagreements.push("pfm " + JSON.stringify(text).slice(0, 300));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(2772 + 432);
  });

  it("every sequence of up to three line shapes (14,425) and 3,000 seeded documents", () => {
    let compared = 0;
    const disagreements: string[] = [];
    for (const text of [...shapeDocuments(), ...seededDocuments(3000)]) {
      compared++;
      if (!sameContext(text) && disagreements.length < 5) disagreements.push(JSON.stringify(text).slice(0, 300));
      if (plainFrontMatterOfLines(text.split(LINES)) !== oldPlainFrontMatter(text) && disagreements.length < 5) disagreements.push("pfm " + JSON.stringify(text).slice(0, 300));
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(14425 + 3000);
  });

  it("every tracked .qmd, .md and .Rmd file", () => {
    const documents = trackedDocuments();
    const disagreements = documents.filter(([, text]) => !sameContext(text) || plainFrontMatterOfLines(text.split(LINES)) !== oldPlainFrontMatter(text)).map(([path]) => path);
    expect(disagreements).toEqual([]);
    expect(documents.length).toBeGreaterThanOrEqual(100);
  });

  // The front matter is where `plainFrontMatter` spends its answer: every sequence of up to three lines out of the shapes below, inside the fences, behind a leading line or a byte order mark, closed by `---`, by `...`, by nothing,
  // or followed by a metadata block of the body.
  const INNER = [
    "title: t",
    "engine: knitr",
    'engine: "knitr"',
    "jupyter: python3",
    "jupyter: ''",
    "keep-hidden: true",
    "format:",
    "  html:",
    "    toc: true",
    "- a",
    "  - b",
    "# c",
    "",
    "k: [a, b]",
    "k: 'x y'",
    'k: "q"',
    "k: |",
    "  text",
    " bad: 1",
    "a: b: c",
    "x: &anc 1",
    "tab:\tv",
  ];
  const LEADS = ["", "\n", " ", BOM, "\nintro\n\n"];
  const CLOSES = ["\n---\n", "\n...\n", "", "\n---\n\ntext\n\n---\nkeep-hidden: true\n---\n", "\n---\nmore\n---\nx\n"];

  it("every front matter of up to three lines (22 shapes: 1 + 22 + 484 + 10,648), behind 5 leads and closed 5 ways", () => {
    const sequences: string[][] = [[]];
    for (const a of INNER) {
      sequences.push([a]);
      for (const b of INNER) {
        sequences.push([a, b]);
        for (const c of INNER) sequences.push([a, b, c]);
      }
    }
    let compared = 0;
    let plain = 0;
    const disagreements: string[] = [];
    for (const lead of LEADS) {
      for (const close of CLOSES) {
        for (const inner of sequences) {
          const text = lead + "---\n" + inner.join("\n") + close;
          compared++;
          const expected = oldPlainFrontMatter(text);
          if (expected) plain++;
          if (plainFrontMatterOfLines(text.split(LINES)) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
          if (plainFrontMatter(text) !== expected && disagreements.length < 5) disagreements.push("wrapper " + JSON.stringify(text));
        }
      }
    }
    expect(disagreements).toEqual([]);
    expect(sequences.length).toBe(1 + 22 + 484 + 10648);
    expect(compared).toBe(5 * 5 * sequences.length);
    // both answers are drawn in numbers: a front matter that is plain, and one that is not
    expect(plain).toBeGreaterThanOrEqual(6000);
    expect(compared - plain).toBeGreaterThanOrEqual(250000);
  });

  it("the text-taking functions answer as the old ones did", () => {
    const disagreements: string[] = [];
    for (const text of frontMatterDocuments()) {
      if (JSON.stringify(cellTargetContext(text)) !== JSON.stringify(oldCellTargetContext(text))) disagreements.push(JSON.stringify(text).slice(0, 200));
      if (plainFrontMatter(text) !== oldPlainFrontMatter(text)) disagreements.push("pfm " + JSON.stringify(text).slice(0, 200));
    }
    expect(disagreements).toEqual([]);
  });
});

describe("Session 345 -- the lines are the caller's: no split of the text, and the lines are only read", () => {
  const text = ["---", "title: t", "---", "", "```{python}", "#| label: fig-a", "Markdown(x)", "```", ""].join("\n");
  const lines = text.split(LINES);

  it("cellTargetContextOfLines splits nothing; the text-taking one splits once", () => {
    expect(countSplitsOf(text, () => void cellTargetContextOfLines(text, lines))).toBe(0);
    expect(countSplitsOf(text, () => void cellTargetContext(text))).toBe(1);
  });

  it("plainFrontMatterOfLines splits nothing; the text-taking one splits once", () => {
    expect(countSplitsOf(text, () => void plainFrontMatterOfLines(lines))).toBe(0);
    expect(countSplitsOf(text, () => void plainFrontMatter(text))).toBe(1);
  });

  it("a frozen array of lines is read, never written", () => {
    const frozen = Object.freeze(text.split(LINES));
    expect(() => cellTargetContextOfLines(text, frozen)).not.toThrow();
    expect(() => plainFrontMatterOfLines(frozen)).not.toThrow();
    expect(frozen).toEqual(lines);
  });

  it("the markdown lines and the front matter come from the LINES handed over, the three word searches from the TEXT", () => {
    // not a text a caller would build, but the contract: the lines are used as given and the text is searched as given
    const context = cellTargetContextOfLines("read_chunk keep-hidden", ["", "x = Markdown(1)", "---"]);
    expect(context.markdownLines).toEqual([1]);
    expect(context.codeFromElsewhere).toBe(true);
    expect(context.keepsHidden).toBe(true);
    expect(context.unseenCode).toBe(false);
    expect(context.opaqueFrontMatter).toBe(!plainFrontMatterOfLines(["", "x = Markdown(1)", "---"]));
  });
});
