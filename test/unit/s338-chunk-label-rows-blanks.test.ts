import { describe, expect, it } from "vitest";
import { distinctTexts, registerRows, type Row } from "./support/chunk-label-rows";

// Session 338, part D of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", site (6), place (b): the BLANK runs of the argument pattern of
// `knitrChunkHeaderLabel`, `^([ \t]*(?:name)[ \t]*=(?!=)[ \t]*)([^ \t](?:[\s\S]*[^ \t])?)?[ \t]*$` under the `u` flag. A run of spaces or tabs before the equals sign, after it, or after the value is a class-star
// like the rest, and on a two-byte line (one character above U+00FF anywhere in the line) each keeps one entry of V8's backtrack stack per character: the pattern throws `RangeError: Maximum call stack size
// exceeded` from 8,388,557 blanks (bisected at HEAD `fe6aaec`, Session 338, Node 22.23.3, one fresh process per probe, through `indexLabels(text, "knitr")`, the lower bound verified OK first, Learning 885; the
// three places give the same figure). The blanks are only up to U+00FF, so these rows say what the line's OTHER character does: the wide form is the one that throws. With every character up to U+00FF the same
// lines read at 60,000,000. Every size below is twice the figure (Learning 775).
//
// The stated answer is what the short document gives: `label` and blanks and `=fig-x` defines `fig-x` at the column where the text of `fig-x` starts (past the blanks), whatever number of blanks stand where.

const FIRST_THROW_BLANKS = 8_388_557;
const N = 16_800_000;
const LIMIT_MS = 10_000;

const figX = (): string => "fig-x";

const ROWS: Row[] = [
  { site: "knitrChunkHeaderLabel: blanks before the equals sign", entry: "header", head: "```{r label", unit: " ", tail: "=fig-x", id: figX, column: (n) => 12 + n, n: N },
  { site: "indexLabels: blanks before the equals sign", entry: "index", head: "```{r label", unit: " ", tail: "=fig-x", id: figX, kind: "fig", column: (n) => 12 + n, n: N },
  { site: "knitrChunkHeaderLabel: blanks after the equals sign", entry: "header", head: "```{r label=", unit: " ", tail: "fig-x", id: figX, column: (n) => 12 + n, n: N },
  { site: "findLabel: blanks after the equals sign", entry: "find", head: "```{r label=", unit: " ", tail: "fig-x", id: figX, kind: "fig", column: (n) => 12 + n, n: N },
  { site: "knitrChunkHeaderLabel: blanks after the value", entry: "header", head: "```{r label=fig-x", unit: " ", tail: "", id: figX, column: () => 12, n: N },
  { site: "indexLabels: blanks after the value", entry: "index", head: "```{r label=fig-x", unit: " ", tail: "", id: figX, kind: "fig", column: () => 12, n: N },
  { site: "knitrChunkHeaderLabel: tabs after the value", entry: "header", head: "```{r label=fig-x", unit: "\t", tail: "", id: figX, column: () => 12, n: N },
  { site: "knitrChunkHeaderLabel: blanks inside a value of an option that is not the label", entry: "header", head: "```{r other=a", unit: " ", tail: "b", n: N },
];

describe("Session 338 — a knitr chunk header with millions of blanks around an argument's equals sign (the BACKLOG item \"Eleven more places that throw RangeError on a long line or a long list\", site 6, place b)", () => {
  registerRows(ROWS, LIMIT_MS);

  it("builds a different text for every row, in both forms", () => {
    expect(distinctTexts(ROWS, "narrow")).toBe(ROWS.length);
    expect(distinctTexts(ROWS, "wide")).toBe(ROWS.length);
  });

  // The parent THROWS from 8,388,557 blanks on a two-byte line; a run below that, or a limit of minutes that would pass a quadratic cure, would say nothing.
  it("keeps the sizes and the limit the rows are built on", () => {
    expect([FIRST_THROW_BLANKS, N, LIMIT_MS]).toEqual([8_388_557, 16_800_000, 10_000]);
    expect(N).toBeGreaterThanOrEqual(2 * FIRST_THROW_BLANKS);
    for (const row of ROWS) {
      expect(row.n).toBe(N);
    }
    expect(ROWS.map((row) => `${row.entry} ${JSON.stringify(row.unit)}`)).toEqual([
      'header " "', 'index " "', 'header " "', 'find " "', 'header " "', 'index " "', 'header "\\t"', 'header " "',
    ]);
  });
});
