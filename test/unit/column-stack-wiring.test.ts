import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

// Session 331 — two readers of the container-column stack that `computeRegions` asks and that no document of the earlier suites told apart from a wrong answer. `ColumnStack` replaced the three parallel arrays (BACKLOG item "More
// quadratic and stack-overflow shapes found by Session 319's sweep and review", part (1)); the stack's own oracle (column-stack.test.ts) holds the class to the plain arrays, and a generated differential (600,000 documents, parent against cure,
// 0 differences) held the wiring, but the differential never saw these two: a generator that breaks either one still reports 0. Each row is a document on which the wrong spelling gives another answer, found by a search aimed at the reader and
// shrunk by hand; the answers are the PARENT's (the build before Session 331), which is what the cure must keep.

const headings = (text: string): Array<[number, string, number]> => findHeadings(text).map((heading): [number, string, number] => [heading.level, heading.text, heading.line]);
const COMMONMARK_X = "---\nfrom: commonmark_x\n---\n\n";

describe("Session 331 — the host column of a quote stashed inside a list item is the top entry of the stashed stack", () => {
  // `hostColumn` (the setext row that lifts a callout's title): "indented" is measured from the content column of the container that hosts the quote, the LAST entry of the stack stashed at the quote's entry. An underline at that column is
  // relative column 0, so the title is not lifted over it; a stack that answered 0 for its top column read the same underline as indented and made `> T` a heading of its own.
  it.each([
    ["a bullet item (column 2) hosting a callout, a quote title, an underline at column 2", "- ::: {.callout-note}\n\n  > T\n  ===\n", []],
    ["a numbered item (column 3), the underline at column 3", "1. ::: {.callout-note}\n\n   > T\n   ===\n", []],
    ["the same under a `---` underline", "- ::: {.callout-note}\n\n  > T\n  ---\n", []],
    ["an underline at column 0, shallower than the host", "- ::: {.callout-note}\n\n  > T\n===\n", []],
    ["an underline at column 4, deeper than the host: indented, so the title is lifted and `T` is a heading", "- ::: {.callout-note}\n\n  > T\n    ===\n", [[1, "T", 2]]],
  ])("%s", (_name, text, expected) => {
    expect(headings(text)).toEqual(expected);
  });
});

describe("Session 331 — a div opened inside several container columns outlives an ATX heading that closes none of them", () => {
  // `columnsStillOpen` (the CommonMark ATX row): a fenced div ends at a heading when the container depth it was opened at is deeper than the number of ENTRIES still open at the heading's indent, and the number counts entries, not distinct
  // columns. `A. a` twice leaves two entries at column 3 (an initial in a name opens a column and closes nothing), a div opened at column 3 sits at depth 2, and the heading at column 3 closes neither entry; counting the column once ended the
  // div at its first heading, which put the callout's title, and a tabset's first tab, in the Outline.
  it.each([
    ["two entries and a callout: the heading is the callout's title, so it is not a heading", `${COMMONMARK_X}A. a\nA. a\n\n   ::: {.callout-note}\n   # H\n   text\n   :::\n`, []],
    ["three entries and a callout", `${COMMONMARK_X}A. a\nA. a\nA. a\n\n   ::: {.callout-note}\n   # H\n   text\n   :::\n`, []],
    ["two entries and a tabset: `H` is the first tab, `K` after the div is a heading", `${COMMONMARK_X}A. a\nA. a\n\n   ::: {.panel-tabset}\n   # H\n   text\n   :::\n   # K\n`, [[1, "K", 11]]],
    ["control: one entry and a callout", `${COMMONMARK_X}A. a\n\n   ::: {.callout-note}\n   # H\n   text\n   :::\n`, []],
    ["control: one entry and a tabset", `${COMMONMARK_X}A. a\n\n   ::: {.panel-tabset}\n   # H\n   text\n   :::\n   # K\n`, [[1, "K", 10]]],
    ["control: two entries, the heading after some text in the callout is an ordinary heading", `${COMMONMARK_X}A. a\nA. a\n\n   ::: {.callout-note}\n   text\n\n   # H\n   :::\n`, [[1, "H", 10]]],
  ])("%s", (_name, text, expected) => {
    expect(headings(text)).toEqual(expected);
  });
});
