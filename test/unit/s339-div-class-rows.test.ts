import { describe, expect, it } from "vitest";
import { buildOutline, findAllCells, findBodyLines, findHeadings } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";

// Session 339, part (10) of the BACKLOG item "Three more quadratic single-line shapes" (group g02). `divSpecReading` (model.ts) reads a fenced div's opener from pandoc's own tokens, and declines (returns null,
// so the regex readers answer) when a `class=` value holds a backslash or an ampersand: such a value is not decoded, so its words may not be the classes quarto reads. The test was
// `/class=[^}]*[\\&]/.test(tail)`: an unanchored scan that restarts at EVERY `class=` and reads on to the next `}` (or the end of the line) looking for a `\` or an `&`. A well-formed opener that repeats `class=`
// and holds no escape therefore costs n squared: `::: {k="` + n `class=` + `"}` measured at the parent `4d1944c`, one fresh process each (load 4.50): 400.8 ms at n = 8,000, 1,573.1 ms at 16,000, 6,256.8 ms at
// 32,000 (6 characters a repeat); `::: {` + n `class=a ` + `}`: 525.9 ms at 8,000 and 2,659.3 ms at 16,000. (An UNTERMINATED opener is refused by `divOpenerVerdict` before the test, which is why `{k="class=class=...`
// with no closing quote costs nothing.) Every entry reaches it, because every entry reads the document through `scanRegions`, and `computeRegions` asks `divCalloutTitleSlot` and `divPanelTabset`, each of
// which asks `divSpecReading`: the test runs twice for a div opener.
//
// WHAT THE ANSWER IS. Every opener below names `class="callout-note"` (or `"panel-tabset"`) FIRST, as a KEY, which only the token reading understands (the regex reader looks for `.callout-note`). With no escape
// before the next `}` the token reading answers: the div is a callout (a tabset), the heading `## T` below it is its title bar (a tab), and the Outline does not list it. With an escape the reader declines, the
// regex reader finds no `.callout-note`, and `## T` is a heading. So the answer tells the two readings apart, and a cure that gets the escape test wrong changes it. The expected answers were taken from the
// PARENT (`4d1944c`) on the same shapes at n = 3 (the small rows below pass on the parent and pin them); the shape adds no line, so the answer does not depend on n.
//
// THE CLOCK. The limit is 1,000 ms, well below the parent (3.27 to 3.62 s on the parent at these sizes, load 4.96 to 5.28: the rows that fail on it do so on the clock alone, their answers right) and at least 15 times the cure's cost. The
// CONTROL rows hold an escape right where the scan can end (an `&` after the last `class=`, a `\` between two runs): the parent is linear on them and they must stay so. Two documents are built for every
// shape, one with a character above U+00FF in the line (V8 stores such a string with two bytes a character and runs another regex path on it) and one without.

const LIMIT_MS = 1000;
// Vitest's own timeout is 5 s: a slow parent must fail on the clock assertion, not on that.
const ROW_TIMEOUT_MS = 120_000;
const QUOTED_N = 24_000;
const BARE_N = 20_000;
const WIDE = "Ā";

type Kind = "quoted" | "quoted-amp-end" | "quoted-bs-mid" | "braced" | "bare" | "bare-amp-end" | "tabset" | "tabset-amp" | "plain-quoted";
const CALLOUT_HEAD = '::: {class="callout-note" ';
const TABSET_HEAD = '::: {class="panel-tabset" ';

/** The opener line of a shape: `n` repeats of `class=` (quoted, inside the value of `k`) or of `class=a ` (bare, as attributes of their own). `w` is a character put in front of the run, or "". */
function opener(kind: Kind, n: number, w: string): string {
  const run = "class=".repeat(n);
  const bare = "class=a ".repeat(n);
  switch (kind) {
    case "quoted":
      return `${CALLOUT_HEAD}k="${w}${run}"}`;
    case "quoted-amp-end":
      return `${CALLOUT_HEAD}k="${w}${run}&"}`;
    case "quoted-bs-mid":
      return `${CALLOUT_HEAD}k="${w}${run}\\${run}"}`;
    case "braced":
      return `${CALLOUT_HEAD}k="${w}${run}}&"}`;
    case "bare":
      return `${CALLOUT_HEAD}${w}${bare}}`;
    case "bare-amp-end":
      return `${CALLOUT_HEAD}${w}${bare}x&y}`;
    case "tabset":
      return `${TABSET_HEAD}${w}${bare}}`;
    case "tabset-amp":
      return `${TABSET_HEAD}${w}${bare}x&y}`;
    case "plain-quoted":
      return `::: {k="${w}${run}"}`;
  }
}

/** The document: the opener, a heading `## T`, a python cell with a label, the closer, and a last heading whose text is `id` (a different id gives a different text, so the memoized scan never answers a second row). */
function documentOf(kind: Kind, n: number, w: string, id: string): string {
  return `${opener(kind, n, w)}\n\n## T\n\nbody\n\n\`\`\`{python}\n#| label: fig-dc\n1 + 1\n\`\`\`\n\n:::\n\n# H${id}\n`;
}

// Where the div's own reading applies (no escape before the next `}`) the heading `## T` is the callout's title bar or a tab; where the reader declines, or the div is plain, `## T` is a heading.
const HIDDEN = (id: string): Array<[number, string, number]> => [[1, `H${id}`, 13]];
const LISTED = (id: string): Array<[number, string, number]> => [
  [2, "T", 2],
  [1, `H${id}`, 13],
];
const headings = (text: string): Array<[number, string, number]> => findHeadings(text).map((h) => [h.level, h.text, h.line]);

function timed<T>(run: () => T): { result: T; ms: number } {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
}

// label, kind, n, whether a character above U+00FF stands in front of the run, and which answer the token reading gives
const SHAPES: Array<[string, Kind, number, boolean, "hidden" | "listed"]> = [
  ["a quoted value, no escape (`k=\"` + `class=` x n + `\"}`)", "quoted", QUOTED_N, false, "hidden"],
  ["a quoted value, no escape, one character above U+00FF in front of the run", "quoted", QUOTED_N, true, "hidden"],
  ["a `}` and an `&` after the run, inside the value (the `}` ends the scan: no escape in reach)", "braced", QUOTED_N, false, "hidden"],
  ["a `}` and an `&` after the run, one character above U+00FF in front of the run", "braced", QUOTED_N, true, "hidden"],
  ["bare attributes `class=a ` x n, no escape", "bare", BARE_N, false, "hidden"],
  ["bare attributes, no escape, one character above U+00FF in front of the run", "bare", BARE_N, true, "hidden"],
  ["a `.panel-tabset` opener with bare attributes `class=a ` x n, no escape", "tabset", BARE_N, false, "hidden"],
  ["a plain div (no class key), a quoted value, no escape", "plain-quoted", QUOTED_N, false, "listed"],
  ["a plain div, a quoted value, one character above U+00FF in front of the run", "plain-quoted", QUOTED_N, true, "listed"],
];

describe("Session 339 — divSpecReading: the shapes the `class=` escape test scanned in quadratic time", () => {
  it.each(SHAPES.map(([label, kind, n, wide, answer], i) => [label, kind, n, wide ? WIDE : "", answer, i] as const))("%s", (_label, kind, n, w, answer, i) => {
    const id = `${kind}${w === "" ? "N" : "W"}${i}`;
    const text = documentOf(kind, n, w, id);
    const { result, ms } = timed(() => headings(text));
    expect(result).toEqual(answer === "hidden" ? HIDDEN(id) : LISTED(id));
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);
});

// CONTROLS: an escape where the scan ends at once. The parent is linear on these (its first `class=` finds the escape within one backtrack) and they must stay linear; the reader declines, so `## T` is a heading.
describe("Session 339 — controls: an escape in reach of the scan is linear on the parent and stays so", () => {
  it.each([
    ["an `&` after the last `class=` in a quoted value", "quoted-amp-end", QUOTED_N, ""],
    ["an `&` after the last `class=`, one character above U+00FF in front of the run", "quoted-amp-end", QUOTED_N, WIDE],
    ["a `\\` between two runs of `class=`", "quoted-bs-mid", QUOTED_N / 2, ""],
    ["a `\\` between two runs, one character above U+00FF in front of the run", "quoted-bs-mid", QUOTED_N / 2, WIDE],
    ["bare attributes, then `x&y`", "bare-amp-end", BARE_N, ""],
    ["a `.panel-tabset` opener, bare attributes, then `x&y`", "tabset-amp", BARE_N, ""],
  ] as Array<[string, Kind, number, string]>)("%s", (_label, kind, n, w) => {
    const id = `${kind}${w === "" ? "N" : "W"}c`;
    const text = documentOf(kind, n, w, id);
    const { result, ms } = timed(() => headings(text));
    expect(result).toEqual(LISTED(id));
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);
});

// The other entries reach the same site through `scanRegions`; each row below gives its entry a document of its own (the scan of the last text is memoized, so a second entry on the same text would be free).
describe("Session 339 — every entry that reads the document reaches the test", () => {
  it("buildOutline: the Outline of a callout whose opener holds 24,000 `class=` and a character above U+00FF lists the cell and `# H`, not `## T`", () => {
    const id = "outline";
    const text = documentOf("quoted", QUOTED_N, WIDE, id);
    const { result, ms } = timed(() => buildOutline(text).map((s) => [s.kind, s.name, s.startLine, s.endLine, s.children.length]));
    expect(result).toEqual([
      ["cell", "```{python}", 6, 9, 0],
      ["heading", `H${id}`, 13, 14, 0],
    ]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  it("findAllCells: the cell behind a callout opener of 20,000 `class=a ` is found", () => {
    const text = documentOf("bare", BARE_N, "", "cells");
    const { result, ms } = timed(() => findAllCells(text).map((c) => [c.lang, c.startLine, c.endLine]));
    expect(result).toEqual([["python", 6, 9]]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  it("indexLabels: the label of the cell behind a callout opener of 24,000 `class=` is indexed", () => {
    const text = documentOf("quoted", QUOTED_N, "", "labels");
    const { result, ms } = timed(() => indexLabels(text).map((l) => [l.id, l.line]));
    expect(result).toEqual([["fig-dc", 7]]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  it("findBodyLines: the body lines of a document whose first line is a callout opener of 20,000 `class=a ` and a character above U+00FF are read", () => {
    const text = documentOf("bare", BARE_N, WIDE, "body");
    const { result, ms } = timed(() => findBodyLines(text).length);
    expect(result).toBe(11);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);
});

// The same shapes at n = 3, where the parent is fast: the answers the rows above expect, checked on the parent (these pass on it) and on every cure.
describe("Session 339 — the small shapes pin the answers the large rows expect", () => {
  it.each([
    ["quoted", "hidden"],
    ["braced", "hidden"],
    ["bare", "hidden"],
    ["tabset", "hidden"],
    ["plain-quoted", "listed"],
    ["quoted-amp-end", "listed"],
    ["quoted-bs-mid", "listed"],
    ["bare-amp-end", "listed"],
    ["tabset-amp", "listed"],
  ] as Array<[Kind, "hidden" | "listed"]>)("%s, n = 3, with and without a character above U+00FF", (kind, answer) => {
    for (const w of ["", WIDE]) {
      const id = `${kind}${w === "" ? "N" : "W"}s`;
      expect(headings(documentOf(kind, 3, w, id))).toEqual(answer === "hidden" ? HIDDEN(id) : LISTED(id));
    }
  });
});

describe("Session 339 — the sizes and the limit the clock rows are built on", () => {
  // A limit of 100 s, or a run of 2,400 `class=`, would pass the parent too.
  it("keeps them", () => {
    expect([LIMIT_MS, QUOTED_N, BARE_N]).toEqual([1000, 24_000, 20_000]);
  });
});
