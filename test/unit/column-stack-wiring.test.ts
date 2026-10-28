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

describe("Session 331 — six more readers of the column stack, each pinned by a document on which the wrong spelling answers differently", () => {
  // The Session 331 mutation list (tools/mutation-run/mutants/s331-column-stack.json) left ten edits of the wiring alive after the first rows (W11, W12, W19, W25, W31, W47 here; W01 and W42 found no document until the review round, below; W26 and W30
  // are equivalent, see the README). Each document below was found by a search aimed at the reader, then cut down by hand or by the search's shrinker, and its answer is the PARENT's: the build before Session 331, which the cure must keep.
  const cases: Array<[string, string, unknown]> = [
    // W11: `deeperColumnsAreAllLists` asks whether every entry DEEPER than the line is a list entry. The definition column 4 is deeper than a bullet at indent 3, so the bullet does not close it and the column stays open; asked about one column
    // further (indent 4) the answer is yes, the column is popped, and `    # H` below the blank line is indented code.
    ["a definition column deeper than a list start at indent 3 stays open, so the indented heading below the blank line is a heading", ": a\n   - b\n\n    # H\n", [[1, "H", 3]]],
    // W12: `cmBlockStartEndsItems` finds the deepest column at or below the heading's own and ends the items deeper than the heading when it is within three columns of it. With no columns it reads the heading as six columns from the page edge, ends nothing,
    // and the `# K` below stays inside an item that the parent closed (and so reads as a heading).
    ["under commonmark an ATX heading within three columns of a surviving container column ends the deeper item (a list marker 'A.')", "---\nfrom: commonmark\n---\nA. a\n      - b\n      # K\n        # K\n", []],
    ["the same under commonmark_x with a definition column", "---\nfrom: commonmark_x\n---\n: a\n      - b\n      # K\n        # K\n", []],
    // W19: a bullet-spelled break INSIDE an item opens a column but is not the simple table's dash column (`tableDashColumns` is set only when that column is the only one open). Marked as the table's, it is popped at the blank line, taking the item's own
    // column with it once a heading has closed the break's, and a callout fence at the item's column then opens no div, so its title is a heading.
    ["a bullet break inside an item is not a table dash column: the item's column survives the blank line, so the callout at that column swallows its title", "---\nfrom: commonmark_x\n---\n\n- a\n  * * *\n  # H\n\n  ::: {.callout-note}\n  # T\n  text\n  :::\n", [[1, "H", 6]]],
    // W25: the table dash column is popped at the blank line only when it is still a LIST column on top. A heading closes it, a definition column is pushed in its place, and the stack is as deep as before: popping that one is wrong, and the
    // indented heading below the blank line would be code.
    ["a definition column pushed after the table dash column was closed is not the table's, so the blank line leaves it open", "---\nfrom: commonmark_x\n---\n\na b c\n- - -\n# H\n: a\n\n    # K\n", [[1, "H", 6], [1, "K", 9]]],
    // W31: whether a callout's title line lost a list marker of its own (`titleListMarkerStripped`) is decided by `setextTitleText` against the open columns. Judged against no columns the second `- T` is lost: the cure and the parent list both.
    ["a callout whose setext title is a list-marked line: the title's marker is judged against the open columns", "  - T\n    ===\n::: {.callout-note}\n    - T\n===\n", [[1, "T", 0], [1, "T", 3]]],
    // W47: a bullet-spelled break inside a container opens a column like any other list marker; only a break at the top of the page, with no container open, opens none. Judged as top-level here, the `    # K` after it is read against a stack that lacks the column.
    ["a bullet break inside an item opens its column, so a heading at that column is a heading", "---\nfrom: gfm\n---\n- a\n        # K\n  * * *\n    # K\n", [[1, "K", 6]]],
  ];

  it.each(cases)("%s", (_name, text, expected) => {
    expect(headings(text)).toEqual(expected);
  });

  it("states every document once", () => {
    expect(new Set(cases.map(([, text]) => text)).size).toBe(cases.length);
  });
});

describe("Session 331 review round — nine more readers of the column stack, each pinned by a document on which the wrong spelling answers differently", () => {
  // Five blind reviewers ran the committed list, and the mutation lens invented 40 edits of its own: eight of the 20 that survived the earlier rows are wiring edits with a witness document (N16, N17, N26, N30, N33, N35, N37, N39), and two
  // searches found documents for W01 and W42 of the committed list, which had none. The answers are the PARENT's (every document here gives the same answer on the build before Session 331, checked when the row was written), which is
  // what the cure must keep. The four edits of the cached snapshots (N02 to N05) are pinned in column-stack.test.ts.
  const cases: Array<[string, string, unknown]> = [
    // W01 and N17: the marker columns of a quote line (which decide whether a `>` is a marker or code) are read from the live stack at each use, as the array they replaced was an alias of it. One edit reads them once when the line starts
    // (W01), the other reads the stash at use time (N17); each loses or invents a heading.
    ["the marker columns are read when they are used, not when the line starts: a bare item, then a quote opened at column 4 with no content", "-\n    >=", [[1, "-", 0]]],
    ["the marker columns are read when they are used: a bare item, a quote underline, a heading below", "- \n    > ===\n## H\n", [[2, "H", 2]]],
    ["the stash of a quote's marker columns is taken when the line starts: a bare item, a quote underlined by `---`, a lone `> ===` below", "- \n    > ---\n> ===\n", []],
    ["the stash of a quote's marker columns is taken when the line starts: a definition column, a code line, a quote at column 4", ": a\n\n        A. a\n    > ===", [[1, "A. a", 2]]],
    // N16: the live marker columns hold EVERY entry's column, the fancy-list `A.` among them; read as CommonMark entries only, the tab-indented `>` below is code and its heading is lost.
    ["the marker columns hold a fancy-list column: a quote at a tab after `A. a`", "A. a\n\n\t> # H", [[1, "H", 2]]],
    // W42 and N27: the host column of a div is the deepest column at or below the div's own fence column; the deepest of ALL columns reads the div as hosted by an inner item, and the callout title below it is a heading.
    ["a div in a quote after a definition column: the host column is read at the fence, so the callout's title is not a heading", "> : a\n>\n> ::: {.callout-note}\n>\n> ## T\n", []],
    ["the same after a list item", "> - a\n>\n> ::: {.callout-note}\n>\n> ## T\n", []],
    // N35: a bullet-spelled break is judged as top-level only when NO entry is open, a definition column included; read as 'no list open' the break at column 4 is no heading.
    ["a bullet break after a definition column and a numbered item is not top-level", ": a\n    2) a\n    * * *\n\t===", [[1, "* * *", 2]]],
    // N37: under CommonMark a raw HTML block that opens inside a container needs its end marker to end; a definition column is a container, and `hasList()` does not count it.
    ["an unclosed `<![CDATA[` after a definition marker does not swallow the heading below", `${COMMONMARK_X}~ a\n<![CDATA[\n# K`, [[1, "K", 6]]],
    // N39: the line-block continuation is told whether the stack is empty (entries), not whether a list is open.
    ["a line-block row, then a definition marker, then a fenced code block that is the row's continuation", "| row2\n  : a\n  ```\n      # H\n  ```", []],
    // N30: the container block's code-depth test sees every entry's column, a fancy-list column among them; given the CommonMark ones only, `    * b` below ` A. a` is code.
    ["a bullet at column 4 under a fancy-list item at column 3 is a list item, so its text is a heading", " A. a\n    * b\n===", [[1, "b", 1]]],
    // N33: an empty item is a sibling when the NEXT line starts a list at that column; read at its own line the heading below is lost.
    ["an empty item, an indented heading, an empty item", "-\n ## H\n-", [[2, "H", 1]]],
    // N26: the entries still open at an ATX heading are counted at or below the heading's own column; counted one column further a buried column at heading + 1 keeps the callout open.
    ["a definition column buried under a fancy-list column: the heading at column 3 ends the callout, so `T` is a heading", `${COMMONMARK_X}: a\nA. a\n\n   ::: {.callout-note}\n   # T\n   text\n   :::\n`, [[1, "T", 8]]],
  ];

  it.each(cases)("%s", (_name, text, expected) => {
    expect(headings(text)).toEqual(expected);
  });

  it("states every document once", () => {
    expect(new Set(cases.map(([, text]) => text)).size).toBe(cases.length);
  });
});
