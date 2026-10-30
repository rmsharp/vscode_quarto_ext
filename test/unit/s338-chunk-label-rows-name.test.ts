import { describe, expect, it } from "vitest";
import { distinctTexts, openerOf, registerRows, WIDE_OPTION, type Row } from "./support/chunk-label-rows";

// Session 338, part D of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", site (6), places (b) and (c).
//
//  - (b), the NAME of an argument: `knitrChunkHeaderLabel` judges every segment of the header with the pattern `^([ \t]*(?:([\p{L}.][\p{L}\p{N}._]*)|(["'])([^"'\\]*)\3)[ \t]*=(?!=)[ \t]*)(...)?[ \t]*$` under the `u`
//    flag, and its bare name `[\p{L}.][\p{L}\p{N}._]*` is a class-plus. A header whose label is a run of LETTERS (`{r aaaa…}`, an ordinary chunk label) feeds the whole run to that star before anything else is
//    asked, so the pattern throws `RangeError: Maximum call stack size exceeded` from 4,194,287 letters on a two-byte line (bisected at HEAD `fe6aaec`, Session 338, Node 22.23.3, one fresh process per probe,
//    through `indexLabels(text, "knitr")`, the lower bound verified OK first, Learning 885). It hides the first-slot class of `readChunkLabelToken` for a label of letters, and the Outline reaches it too (a document
//    that calls `read_chunk` asks `knitrChunkHeaderLabel` whether an empty chunk is labelled).
//  - (c), `HEADER_LABEL_ID` (`^(fig|tbl)-[\p{L}\p{N}_:.-]+$` under `u`), which `indexLabels` runs on the label the header reader answers: alone (a `fig-` label that is NOT in the first slot, which the first-slot
//    class does not read, and that the argument pattern passes) it throws from 4,194,288 letters after `fig-` (`{r echo=FALSE, fig-` and a run; bisected the same way). It sits behind the first-slot class for a
//    first-slot label (the label is read by it first) and behind the argument pattern's VALUE star for a `label=` label past 8,388,562 characters, so the rows that reach it alone use the second slot and a `label=`
//    label between the two figures.
// With every character up to U+00FF all of these read at 60,000,000. The sizes below are twice 4,194,288 where the line allows it (Learning 775); the `label=` rows sit at 6,000,000, which is between the
// throw of `HEADER_LABEL_ID` and the throw of the value star, because a size past the second would throw somewhere else.

const FIRST_THROW_NAME = 4_194_287;
const FIRST_THROW_HEADER_ID = 4_194_288;
const FIRST_THROW_VALUE = 8_388_562;
const N = 8_400_000;
const N_BETWEEN = 6_000_000;
const LIMIT_MS = 10_000;

const fig = (n: number): string => "fig-" + "a".repeat(n);
const letters = (n: number): string => "a".repeat(n);

const ROWS: Row[] = [
  // (b): the name of an argument is the run.
  { site: "knitrChunkHeaderLabel: a label of letters in the first slot", entry: "header", head: "```{r ", unit: "a", tail: "", id: letters, column: () => 6, n: N },
  { site: "indexLabels: a label of letters in the first slot defines no figure", entry: "index", head: "```{r ", unit: "a", tail: "", n: N },
  { site: "findHeadings: a labelled empty chunk (a label of letters) below read_chunk echoes", entry: "headings", head: "```{r ", unit: "a", tail: "", defines: true, n: N },
  { site: "buildOutline: a labelled empty chunk (a label of letters) below read_chunk is listed", entry: "outline", head: "```{r ", unit: "b", tail: "", defines: true, n: N },
  { site: "knitrChunkHeaderLabel: an option named by the run defines no label", entry: "header", head: "```{r ", unit: "a", tail: "=1", n: N },
  { site: "indexLabels: an option named by the run defines no label", entry: "index", head: "```{r ", unit: "a", tail: "=1", n: N },
  // (c): HEADER_LABEL_ID alone.
  { site: "indexLabels: a figure label in the second slot", entry: "index", head: "```{r echo=FALSE, fig-", unit: "a", tail: "", id: fig, kind: "fig", column: () => 18, n: N },
  { site: "findLabel: a figure label in the second slot", entry: "find", head: "```{r echo=FALSE, fig-", unit: "a", tail: "", id: fig, kind: "fig", column: () => 18, n: N },
  { site: "indexLabels: a `label=` figure label", entry: "index", head: "```{r, label=fig-", unit: "a", tail: "", id: fig, kind: "fig", column: () => 13, n: N_BETWEEN },
  { site: "findLabel: a quoted `label=` figure label", entry: "find", head: '```{r, label="fig-', unit: "a", tail: '"', id: fig, kind: "fig", column: () => 14, n: N_BETWEEN },
];

describe("Session 338 — a knitr chunk header whose argument name or figure label is millions of characters long (the BACKLOG item \"Eleven more places that throw RangeError on a long line or a long list\", site 6, places b and c)", () => {
  registerRows(ROWS, LIMIT_MS);

  it("builds a different text for every row, in both forms", () => {
    expect(distinctTexts(ROWS, "narrow")).toBe(ROWS.length);
    expect(distinctTexts(ROWS, "wide")).toBe(ROWS.length);
  });

  // The parent THROWS from 4,194,287 letters of a name and 4,194,288 of a figure label on a two-byte line, and its value star from 8,388,562: a run below the first, or a `label=` row past the last, says nothing.
  it("keeps the sizes and the limit the rows are built on", () => {
    expect([FIRST_THROW_NAME, FIRST_THROW_HEADER_ID, FIRST_THROW_VALUE, N, N_BETWEEN, LIMIT_MS]).toEqual([4_194_287, 4_194_288, 8_388_562, 8_400_000, 6_000_000, 10_000]);
    expect(WIDE_OPTION).toBe(', x="\u4e2d"'); // the wide form holds ONE character above U+00FF, which is what makes the line a two-byte string
    expect(openerOf(ROWS[0], 4, "narrow").split("").every((c) => c.charCodeAt(0) <= 0xff)).toBe(true); // and the narrow form holds none
    expect(N).toBeGreaterThanOrEqual(2 * FIRST_THROW_HEADER_ID);
    expect(N_BETWEEN).toBeGreaterThan(FIRST_THROW_HEADER_ID);
    expect(N_BETWEEN).toBeLessThan(FIRST_THROW_VALUE);
    expect(ROWS.map((row) => `${row.entry} ${row.n}`)).toEqual([
      ...Array.from({ length: 8 }, (_, i) => `${["header", "index", "headings", "outline", "header", "index", "index", "find"][i]} 8400000`),
      "index 6000000", "find 6000000",
    ]);
  });
});
