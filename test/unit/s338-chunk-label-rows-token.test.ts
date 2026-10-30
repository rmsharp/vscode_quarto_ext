import { describe, expect, it } from "vitest";
import { distinctTexts, openerOf, registerRows, WIDE_OPTION, type Row } from "./support/chunk-label-rows";

// Session 338, part D of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", site (6), place (a): the first-slot class of `readChunkLabelToken`. A bare token in the
// FIRST slot of a knitr chunk header is the text written (`{r fig-x}` defines `fig-x`), and it was judged by `/^[\p{L}\p{N}_:.-]+$/u`. V8 keeps one entry of its regex backtrack stack per character of a class-plus
// under the `u` flag, and twice as large once the line holds a character above U+00FF (the line is then a two-byte string): the pattern throws `RangeError: Maximum call stack size exceeded` and the error reaches
// every reader of the header: the label index (`indexLabels`, so `findLabel`), the header reader itself, and, for a document that calls `read_chunk`, the Outline (`findHeadings`, `buildOutline` with the
// knitr hint), which asks whether an empty chunk is labelled.
//
// The first throw was bisected at HEAD `fe6aaec` (Session 338, Node 22.23.3, one fresh process per probe, `indexLabels(text, "knitr")` through the entry, the lower bound verified OK first, Learning 885):
// `{r fig-` and then n letters reads at 4,194,283 and throws from n = 4,194,284, with the run made of CJK letters (U+4E2D) and with the run made of `a` and ONE `中` in another segment of the line alike. With every
// character up to U+00FF the same line reads at 60,000,000. Every size below is twice that figure (Learning 775), so a size just under the limit cannot pass.
//
// The stated answer is what the short document gives: the token is the label (`fig-` and the run, the kind, line 0, column 6), a `$` at its end makes it no label, and a chunk below a `read_chunk` call that is
// labelled echoes the file's code (`Top, After, Last`) where an unlabelled one is silent (`Top, Last`).

const FIRST_THROW_TOKEN = 4_194_284;
const N = 8_400_000;
const LIMIT_MS = 10_000;

const fig = (n: number): string => "fig-" + "a".repeat(n);
const tbl = (n: number): string => "tbl-" + "a".repeat(n);

const ROWS: Row[] = [
  { site: "indexLabels: `{r fig-` and a run", entry: "index", head: "```{r fig-", unit: "a", tail: "", id: fig, kind: "fig", column: () => 6, n: N },
  { site: "indexLabels: `{r tbl-` and a run", entry: "index", head: "```{r tbl-", unit: "a", tail: "", id: tbl, kind: "tbl", column: () => 6, n: N },
  { site: "findLabel: `{r fig-` and a run", entry: "find", head: "```{r fig-", unit: "a", tail: "", id: fig, kind: "fig", column: () => 6, n: N },
  { site: "knitrChunkHeaderLabel: `{r fig-` and a run", entry: "header", head: "```{r fig-", unit: "a", tail: "", id: fig, column: () => 6, n: N },
  { site: "indexLabels: a `$` at the end of the token declines it", entry: "index", head: "```{r fig-", unit: "a", tail: "$", n: N },
  { site: "knitrChunkHeaderLabel: a `$` at the end of the token declines it", entry: "header", head: "```{r fig-", unit: "a", tail: "$", n: N },
  { site: "findHeadings: a labelled empty chunk below read_chunk echoes", entry: "headings", head: "```{r fig-", unit: "a", tail: "", defines: true, n: N },
  { site: "findHeadings: a declined label leaves the chunk silent", entry: "headings", head: "```{r fig-", unit: "a", tail: "$", defines: false, n: N },
  { site: "buildOutline: a labelled empty chunk below read_chunk is listed", entry: "outline", head: "```{r tbl-", unit: "a", tail: "", defines: true, n: N },
  { site: "buildOutline: a declined label leaves the chunk silent", entry: "outline", head: "```{r tbl-", unit: "a", tail: "$", defines: false, n: N },
];

describe("Session 338 — a knitr chunk header whose first-slot label is millions of characters long (the BACKLOG item \"Eleven more places that throw RangeError on a long line or a long list\", site 6, place a)", () => {
  registerRows(ROWS, LIMIT_MS);

  it("builds a different text for every row, in both forms", () => {
    expect(distinctTexts(ROWS, "narrow")).toBe(ROWS.length);
    expect(distinctTexts(ROWS, "wide")).toBe(ROWS.length);
  });

  // The parent THROWS from 4,194,284 characters of the run on a two-byte line; a run below that, or a limit of minutes that would pass a quadratic cure, would make the rows below say nothing.
  it("keeps the sizes and the limit the rows are built on", () => {
    expect([FIRST_THROW_TOKEN, N, LIMIT_MS]).toEqual([4_194_284, 8_400_000, 10_000]);
    expect(WIDE_OPTION).toBe(', x="\u4e2d"'); // the wide form holds ONE character above U+00FF, which is what makes the line a two-byte string
    expect(openerOf(ROWS[0], 4, "narrow").split("").every((c) => c.charCodeAt(0) <= 0xff)).toBe(true); // and the narrow form holds none
    expect(N).toBeGreaterThanOrEqual(2 * FIRST_THROW_TOKEN);
    for (const row of ROWS) {
      expect(row.n).toBeGreaterThanOrEqual(2 * FIRST_THROW_TOKEN);
    }
    expect(ROWS.map((row) => `${row.entry}${row.tail === "" ? "" : " +" + row.tail}`)).toEqual([
      "index", "index", "find", "header", "index +$", "header +$", "headings", "headings +$", "outline", "outline +$",
    ]);
  });
});
