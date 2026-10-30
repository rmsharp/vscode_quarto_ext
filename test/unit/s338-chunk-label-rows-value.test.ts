import { describe, expect, it } from "vitest";
import { distinctTexts, registerRows, type Row } from "./support/chunk-label-rows";

// Session 338, part D of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", site (6), place (b): the VALUE and the QUOTED NAME of the argument pattern of
// `knitrChunkHeaderLabel`, `^([ \t]*(?:([\p{L}.][\p{L}\p{N}._]*)|(["'])([^"'\\]*)\3)[ \t]*=(?!=)[ \t]*)([^ \t](?:[\s\S]*[^ \t])?)?[ \t]*$` under the `u` flag. The value is `[\s\S]*` between a first and a last character
// that are no blank, and the quoted name is a negated class-star; under `u` each keeps one entry of V8's backtrack stack per character, and on a two-byte line (one character above U+00FF anywhere in the line)
// the pattern throws `RangeError: Maximum call stack size exceeded`: from 8,388,562 characters of the value, from 8,388,570 characters of the quoted name (bisected at HEAD `fe6aaec`, Session 338, Node 22.23.3, one
// fresh process per probe, through `indexLabels(text, "knitr")`, the lower bound verified OK first, Learning 885). The figure is about half the name's (the stack entry of these two is half the size) and the item's
// "about 8.4 million". With every character up to U+00FF the same lines read at 60,000,000. Every size below is twice the figure (Learning 775).
//
// The stated answer is what the short document gives. A `label=` whose value is a quoted or a bare `fig-` run defines that label (the value is read whole, the column is where its text starts); an option that is
// NOT `label`, whatever its value, and a quoted name that is not `label`, define nothing.

const FIRST_THROW_VALUE = 8_388_562;
const FIRST_THROW_QUOTED_NAME = 8_388_570;
const N = 16_800_000;
const LIMIT_MS = 10_000;

const fig = (n: number): string => "fig-" + "a".repeat(n);

const ROWS: Row[] = [
  { site: "knitrChunkHeaderLabel: a quoted `label=` value", entry: "header", head: '```{r, label="fig-', unit: "a", tail: '"', id: fig, column: () => 14, n: N },
  { site: "indexLabels: a quoted `label=` value", entry: "index", head: '```{r, label="fig-', unit: "a", tail: '"', id: fig, kind: "fig", column: () => 14, n: N },
  { site: "knitrChunkHeaderLabel: a bare `label=` value", entry: "header", head: "```{r label=fig-", unit: "a", tail: "", id: fig, column: () => 12, n: N },
  { site: "findLabel: a bare `label=` value", entry: "find", head: "```{r label=fig-", unit: "a", tail: "", id: fig, kind: "fig", column: () => 12, n: N },
  { site: "knitrChunkHeaderLabel: the value of an option that is not the label", entry: "header", head: "```{r other=", unit: "a", tail: "", n: N },
  { site: "indexLabels: the value of an option that is not the label", entry: "index", head: "```{r other=", unit: "+", tail: "", n: N },
  { site: "knitrChunkHeaderLabel: a quoted name that is not the label", entry: "header", head: '```{r "', unit: "a", tail: '"=1', n: N },
  { site: "indexLabels: a quoted name that is not the label", entry: "index", head: '```{r "', unit: "a", tail: '"=1', n: N },
];

describe("Session 338 — a knitr chunk header whose argument value or quoted name is millions of characters long (the BACKLOG item \"Eleven more places that throw RangeError on a long line or a long list\", site 6, place b)", () => {
  registerRows(ROWS, LIMIT_MS);

  it("builds a different text for every row, in both forms", () => {
    expect(distinctTexts(ROWS, "narrow")).toBe(ROWS.length);
    expect(distinctTexts(ROWS, "wide")).toBe(ROWS.length);
  });

  // The parent THROWS from 8,388,562 characters of a value and 8,388,570 of a quoted name on a two-byte line; a run below that, or a limit of minutes that would pass a quadratic cure, would say nothing.
  it("keeps the sizes and the limit the rows are built on", () => {
    expect([FIRST_THROW_VALUE, FIRST_THROW_QUOTED_NAME, N, LIMIT_MS]).toEqual([8_388_562, 8_388_570, 16_800_000, 10_000]);
    expect(N).toBeGreaterThanOrEqual(2 * Math.max(FIRST_THROW_VALUE, FIRST_THROW_QUOTED_NAME));
    for (const row of ROWS) {
      expect(row.n).toBe(N);
    }
    expect(ROWS.map((row) => `${row.entry} ${row.unit}${row.tail}`)).toEqual([
      'header a"', 'index a"', "header a", "find a", "header a", "index +", 'header a"=1', 'index a"=1',
    ]);
  });
});
