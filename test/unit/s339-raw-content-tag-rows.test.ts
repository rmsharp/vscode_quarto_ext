import { describe, expect, it } from "vitest";
import { buildOutline, findAllCells, findHeadings } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";

// Session 339, part (11) of the BACKLOG item "Three more quadratic single-line shapes" (group g02): a line of `<pre `, `<script `, `<style ` or `<textarea ` openers with no `>`.
// `computeRegions` reads every ordinary body line that holds a `<` with `HTML_RAW_CONTENT_TAG`, `/<(\/?)(pre|script|style|textarea)\b[^>]*?(\/?)>/gi`, to keep the count of raw-content elements that are open (`rawContentDepth`: the
// count decides whether a complete `<div>x</div>` below ends a block, and under a CommonMark reader whether an unclosed fence or a raw-HTML block runs to the end of the document). The lazy `[^>]*?` reads on to the FIRST `>`
// after the name, so on a line that repeats the opener and holds no `>` every opener restarts a scan that ends at the end of the line and finds nothing: n squared. Measured at the parent `4d1944c`, one fresh node process per
// timing, `findHeadings` of the line + a blank line + a heading: `<pre ` x 10,000 / 20,000 / 40,000 took 152.6 / 599.2 / 2,335.6 ms (4x a doubling), `<script ` x 40,000 3,762 ms, `<style ` x 20,000 825 ms, `<textarea ` x 20,000 1,170 ms.
// Every public entry reaches it, because every entry reads the one `computeRegions` (measured at n = 20,000: findHeadings, findAllCells, buildOutline, findBodyLines, findCellOptionLines and indexLabels took 605 to 609 ms alike).
//
// THE ANSWERS DEPEND ON THE COUNT, so the rows are documents whose headings, outline names, cells and labels change with it. Two templates, both taken from rows that already exist in `qmd-model.test.ts` (the Session 295 "GUARD: a
// complete <div> inside an open <pre> keeps the opener swallowed" family and the Session 296 "pre blank fence" family), and both checked by switching the loop off (the pattern replaced by one that never matches): the
// first family fails 4 rows of the older suite (one per element) and the second 3 more, 7 in all (`qmd-model.test.ts`, run with the loop switched off).
//   A. `engine: markdown`, an opener line, `<div>x</div>`, an indented `{bash}` opener: with a raw-content element open the opener is swallowed (headings Before, After); with none open it is indented code (Before, In, After).
//   G. `from: commonmark_x`, an opener line, a blank line, an unclosed plain fence: with an element open the fence ends where the element does (Before, After, and the label `sec-after`); with none open the fence runs to the end
//      of the document (Before only, no label).
// EVERY EXPECTED ANSWER BELOW IS WHAT THE PARENT `4d1944c` GAVE for the same builder at 5 units (the rows run the builder at 5 units and at the long size and expect the same answer from both), and the answers of the table of
// small documents were read off the parent in the same way. The clock rows must fail on the parent on the clock alone.

const LIMIT_MS = 1000; // the cure takes 5 to 10 ms on these sizes (the same documents with the loop switched off took 5.1 to 9.2 ms in a fresh process); the parent takes 3.3 s and more on every clock row
const ROW_TIMEOUT_MS = 120_000; // the parent takes seconds on a row, and the default 5 s timeout would fail it before the clock row could

const doc = (...lines: string[]): string => lines.join("\n") + "\n";
const docA = (line: string, closer = "</pre>"): string =>
  doc("---", 'title: "T"', "engine: markdown", "---", "", "## Before", "", "Prose before.", "", line, "<div>x</div>", "    ```{bash}", "## In", "x = 1", "    ```", closer, "", "## After", "", "tail");
const docG = (line: string): string =>
  doc("---", 'title: "T"', "engine: markdown", "from: commonmark_x", "---", "", "## Before", "", line, "", "```text", "## In", "</pre>", "", "## After {#sec-after}", "", "tail");

const headings = (text: string): string[] => findHeadings(text, "markdown").map((h) => h.text);
const outline = (text: string): string[] => buildOutline(text, "markdown").map((s) => s.name);
const cells = (text: string): Array<[string, number]> => findAllCells(text).map((c) => [c.lang, c.startLine]);
const labels = (text: string): string[] => indexLabels(text).map((l) => l.id);

const OPEN_A = ["Before", "After"];
const SHUT_A = ["Before", "In", "After"];
const OPEN_G = ["Before", "After"];
const SHUT_G = ["Before"];

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
};

type Row = { label: string; build: (n: number) => string; read: (text: string) => unknown; answer: unknown; n: number };
const LONE_SURROGATE = String.fromCharCode(0xd83d);
const CJK = String.fromCharCode(0x4e2d);
const ASTRAL = String.fromCodePoint(0x1f600);

describe("Session 339 — `<pre `, `<script `, `<style ` and `<textarea ` openers with no `>` on one line are read in linear time (the BACKLOG item \"Three more quadratic single-line shapes\", part 11)", () => {
  const CLOCK: Row[] = [
    { label: "findHeadings, template A: `<pre ` x 80,000 (nothing opens)", build: (n) => docA("<pre ".repeat(n)), read: headings, answer: SHUT_A, n: 80_000 },
    { label: "findHeadings, template G: `<pre>` then `<pre ` x 60,000 (the first opens, the rest hold no `>`)", build: (n) => docG("<pre>" + "<pre ".repeat(n)), read: headings, answer: OPEN_G, n: 60_000 },
    { label: "findHeadings, template A: `<script>` then `<script ` x 40,000", build: (n) => docA("<script>" + "<script ".repeat(n), "</script>"), read: headings, answer: OPEN_A, n: 40_000 },
    { label: "buildOutline, template G: `<style ` x 40,000", build: (n) => docG("<style ".repeat(n)), read: outline, answer: SHUT_G, n: 40_000 },
    { label: "indexLabels, template G: `<textarea>` then `<textarea ` x 40,000", build: (n) => docG("<textarea>" + "<textarea ".repeat(n)), read: labels, answer: ["sec-after"], n: 40_000 },
    { label: "findAllCells, template A: `<pre ` x 60,000 then a CJK letter (a two-byte string)", build: (n) => docA("<pre ".repeat(n) + CJK), read: cells, answer: [["bash", 11]], n: 60_000 },
    { label: "findHeadings, template A: `<style>` then `<style ` x 40,000 then an astral letter (a surrogate pair)", build: (n) => docA("<style>" + "<style ".repeat(n) + ASTRAL, "</style>"), read: headings, answer: OPEN_A, n: 40_000 },
    { label: "findHeadings, template G: `<textarea ` x 40,000 then a lone surrogate", build: (n) => docG("<textarea ".repeat(n) + LONE_SURROGATE), read: headings, answer: SHUT_G, n: 40_000 },
  ];
  it.each(CLOCK.map((row) => [row.label, row] as const))("%s: the answer is the parent's at 5 units and at the long size, and the long size is read in linear time", (_label, row) => {
    expect(row.read(row.build(5))).toEqual(row.answer);
    const text = row.build(row.n);
    const { result, ms } = timed(() => row.read(text));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  // CONTROLS: a line that is linear today and must stay so, and keeps its answer. A line of complete `<pre></pre>` pairs, a line of closers, of self-closing tags, and a run of openers with ONE `>` at the very end (the scan from the first
  // opener reads once to that `>` and the rest of the line is the match), each at 40,000 units (the parent reads them in 5 to 15 ms in a fresh process).
  const CONTROLS: Row[] = [
    { label: "40,000 complete `<pre></pre>` pairs", build: (n) => docA("<pre></pre>".repeat(n)), read: headings, answer: SHUT_A, n: 40_000 },
    { label: "`<pre ` x 40,000 and one `>` at the very end", build: (n) => docA("<pre ".repeat(n) + ">"), read: headings, answer: OPEN_A, n: 40_000 },
    { label: "40,000 closers `</pre>`", build: (n) => docG("</pre>".repeat(n)), read: headings, answer: SHUT_G, n: 40_000 },
    { label: "40,000 self-closing `<script/>`", build: (n) => docG("<script/>".repeat(n)), read: headings, answer: SHUT_G, n: 40_000 },
    { label: "`<textarea ` x 40,000 and `/>` at the end (self-closing)", build: (n) => docA("<textarea ".repeat(n) + "/>", "</textarea>"), read: headings, answer: SHUT_A, n: 40_000 },
    { label: "40,000 complete `<pre>` tags (only the first is at the start of the line)", build: (n) => docG("<pre>".repeat(n)), read: headings, answer: OPEN_G, n: 40_000 },
  ];
  it.each(CONTROLS.map((row) => [row.label, row] as const))("CONTROL %s: the answer is the parent's and the line is read in linear time", (_label, row) => {
    expect(row.read(row.build(5))).toEqual(row.answer);
    const text = row.build(row.n);
    const { result, ms } = timed(() => row.read(text));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  // The clock can fail: the pattern itself takes over a second on `<pre ` x 40,000 (2,335.6 ms at the parent), so a limit of one second is not one the parent can meet.
  it("the clock row can fail: the old pattern takes over a second on `<pre ` x 40,000", () => {
    const line = "<pre ".repeat(40_000);
    const { ms } = timed(() => [...line.matchAll(/<(\/?)(pre|script|style|textarea)\b[^>]*?(\/?)>/gi)]);
    expect(ms).toBeGreaterThan(LIMIT_MS);
  }, ROW_TIMEOUT_MS);

  it("keeps the limit, the sizes and the number of clock rows the rows above are built on", () => {
    expect([LIMIT_MS, ROW_TIMEOUT_MS]).toEqual([1000, 120_000]);
    expect(CLOCK.map((row) => row.n)).toEqual([80_000, 60_000, 40_000, 40_000, 40_000, 60_000, 40_000, 40_000]);
    expect(CONTROLS.map((row) => row.n)).toEqual([40_000, 40_000, 40_000, 40_000, 40_000, 40_000]);
    expect(new Set([...CLOCK, ...CONTROLS].map((row) => row.label)).size).toBe(CLOCK.length + CONTROLS.length);
  });
});

// SMALL DOCUMENTS: one opener line in each template and what the parent answered (headings of A, headings of G, the labels of G). These pass on the parent and are the cure's semantic rows at document level: the case of the name, the
// self-closing spellings, the indent that lets an opener count (0 to 3 blanks), the characters after the name that end it (`\b`), a closer that floors at zero, and the openers a tag swallows.
const LS = String.fromCharCode(0x2028);
const E_ACUTE = String.fromCharCode(0xe9);
const LONG_S = String.fromCharCode(0x17f);
const DOTLESS_I = String.fromCharCode(0x131);
const TABLE: Array<[string, string, string[], string[], string[]]> = [
  ["an opener", "<pre>", OPEN_A, OPEN_G, ["sec-after"]],
  ["upper case", "<PRE>", OPEN_A, OPEN_G, ["sec-after"]],
  ["mixed case with attributes", '<Pre class="a">', OPEN_A, OPEN_G, ["sec-after"]],
  ["script upper", "<SCRIPT src=x>", OPEN_A, OPEN_G, ["sec-after"]],
  ["style mixed", "<Style>", OPEN_A, OPEN_G, ["sec-after"]],
  ["textarea upper", "<TEXTAREA rows=2>", OPEN_A, OPEN_G, ["sec-after"]],
  ["self-closing pre", "<pre/>", SHUT_A, SHUT_G, []],
  ["self-closing with a blank", "<pre />", SHUT_A, SHUT_G, []],
  ["double slash", "<pre//>", SHUT_A, SHUT_G, []],
  ["slash then blank is not self-closing", "<pre/ >", OPEN_A, OPEN_G, ["sec-after"]],
  ["self-closing script", "<script/>", SHUT_A, SHUT_G, []],
  ["self-closing style with a blank", "<style />", SHUT_A, SHUT_G, []],
  ["self-closing textarea", "<textarea/>", SHUT_A, SHUT_G, []],
  ["closed on the same line", "<pre>x</pre>", SHUT_A, SHUT_G, []],
  ["an empty pair", "<pre></pre>", SHUT_A, SHUT_G, []],
  ["a lone closer", "</pre>", SHUT_A, SHUT_G, []],
  ["two closers then an opener", "</pre></pre><pre>", SHUT_A, SHUT_G, []],
  ["indent 2", "  <pre>", OPEN_A, OPEN_G, ["sec-after"]],
  ["indent 3", "   <pre>", OPEN_A, OPEN_G, ["sec-after"]],
  ["indent 4 opens nothing", "    <pre>", SHUT_A, SHUT_G, []],
  ["a tab opens nothing", "\t<pre>", SHUT_A, SHUT_G, []],
  ["text before opens nothing", "x <pre>", SHUT_A, SHUT_G, []],
  ["a prefix of a longer name", "<prefix>", SHUT_A, SHUT_G, []],
  ["an underscore after the name", "<pre_>", SHUT_A, SHUT_G, []],
  ["a digit after the name", "<pre1>", SHUT_A, SHUT_G, []],
  ["a hyphen after the name", "<pre-x>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["e acute after the name", `<pre${E_ACUTE}>`, OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["long s after the name", `<pre${LONG_S}>`, OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["long s in the name is no s", `<${LONG_S}cript>`, SHUT_A, SHUT_G, []],
  ["dotless i in the name is no i", `<scr${DOTLESS_I}pt>`, SHUT_A, SHUT_G, []],
  ["a plural", "<scripts>", SHUT_A, SHUT_G, []],
  ["a truncated name", "<textare>", SHUT_A, SHUT_G, []],
  ["no angle bracket after the name", "<pre", SHUT_A, SHUT_G, []],
  ["a carriage return after the name", "<pre\r>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["a line separator after the name", `<pre${LS}>`, OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["a CJK letter after the blank", `<pre ${CJK}>`, OPEN_A, OPEN_G, ["sec-after"]],
  ["two openers, the first swallows the second", "<pre <pre>", OPEN_A, OPEN_G, ["sec-after"]],
  ["two openers", "<pre><pre>", OPEN_A, OPEN_G, ["sec-after"]],
  ["a closer then an opener", "</pre><pre>", SHUT_A, SHUT_G, []],
  ["a pair then an opener", "<pre></pre><pre>", SHUT_A, SHUT_G, []],
  ["two names open", "<pre><script>", OPEN_A, OPEN_G, ["sec-after"]],
  ["one name opens, another closes", "<pre></script>", SHUT_A, SHUT_G, []],
  ["five unterminated openers", "<pre ".repeat(5), SHUT_A, SHUT_G, []],
  ["an opener then five unterminated", "<pre>" + "<pre ".repeat(5), OPEN_A, OPEN_G, ["sec-after"]],
  ["five openers, one `>` at the end", "<pre ".repeat(5) + ">", OPEN_A, OPEN_G, ["sec-after"]],
  ["five openers then a closer", "<pre ".repeat(5) + "</pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["five openers, a slash and `>`", "<pre ".repeat(5) + "/>", SHUT_A, SHUT_G, []],
  ["unterminated script openers with a CJK tail", "<script>" + "<script ".repeat(5) + CJK, OPEN_A, OPEN_G, ["sec-after"]],
  ["a quoted opener", "> <pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
];

describe("Session 339 — one opener line in each template: what the parent answered for the raw-content count (part 11)", () => {
  it.each(TABLE.map(([label, line, a, g, l]) => [label, line, a, g, l] as const))("%s", (_label, line, answerA, answerG, answerLabels) => {
    expect(headings(docA(line))).toEqual(answerA);
    expect(headings(docG(line))).toEqual(answerG);
    expect(labels(docG(line))).toEqual(answerLabels);
  });

  it("the table holds each line once and both answers of each kind", () => {
    expect(new Set(TABLE.map((row) => row[1])).size).toBe(TABLE.length);
    expect(TABLE.some((row) => row[2] === OPEN_A) && TABLE.some((row) => row[2] === SHUT_A)).toBe(true);
    expect(TABLE.length).toBe(49);
  });
});

// THE REVIEW ROUND (Session 339, mutation lens): an opener counts only at the start of a LINE, so `<pre><pre>` opens one element, and the table above never takes the count past one. A closer that took two (R05 of
// `tools/mutation-run/mutants/s339-raw-content-tag.json`: `Math.max(0, rawContentDepth - 2)`) therefore passed every row of both templates and of the older suites. These documents open an element on one line and another on the
// next, and close one: the opener below is still inside the first. Every answer is the parent `4d1944c`'s for the same two builders (the loop switched off gives the shut answer on 10 of the 13).
const MULTILINE: Array<[string, string, string[], string[], string[]]> = [
  ["two openers on two lines", "<pre>\n<pre>", OPEN_A, OPEN_G, ["sec-after"]],
  ["two openers and a closer", "<pre>\n<pre>\n</pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["two openers and two closers", "<pre>\n<pre>\n</pre>\n</pre>", SHUT_A, SHUT_G, []],
  ["two openers, two closers and an opener", "<pre>\n<pre>\n</pre>\n</pre>\n<pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["an opener, then a pair on one line", "<script>\n<pre></pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["two names open, the first closes", "<pre>\n<script>\n</pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["two names open, the second closes", "<pre>\n<script>\n</script>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["an opener, a pair on one line", "<pre>\n<pre></pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["a closer too many", "<pre>\n</pre>\n</pre>", SHUT_A, SHUT_G, []],
  ["a closer then an opener", "</pre>\n<pre>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["a pair then an opener", "<pre>\n</pre>\n<pre>", OPEN_A, OPEN_G, ["sec-after"]],
  ["style and textarea", "<style>\n<textarea>\n</textarea>", OPEN_A, ["Before", "In", "After"], ["sec-after"]],
  ["a textarea around a script", "<textarea>\n<script>\n</script>\n</textarea>", SHUT_A, SHUT_G, []],
];

describe("Session 339 review — elements opened and closed on several lines: the count goes past one (part 11)", () => {
  it.each(MULTILINE.map(([label, line, a, g, l]) => [label, line, a, g, l] as const))("%s", (_label, line, answerA, answerG, answerLabels) => {
    expect(headings(docA(line))).toEqual(answerA);
    expect(headings(docG(line))).toEqual(answerG);
    expect(labels(docG(line))).toEqual(answerLabels);
  });

  it("the table holds each line once, every line is on several lines, and both answers of each kind are there", () => {
    expect(new Set(MULTILINE.map((row) => row[1])).size).toBe(MULTILINE.length);
    expect(MULTILINE.every((row) => row[1].includes("\n"))).toBe(true);
    expect(MULTILINE.some((row) => row[2] === OPEN_A) && MULTILINE.some((row) => row[2] === SHUT_A)).toBe(true);
    expect(MULTILINE.length).toBe(13);
  });
});
