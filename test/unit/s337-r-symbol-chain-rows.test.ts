import { describe, expect, it } from "vitest";
import { knitrChunkHeaderLabel } from "../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../src/core/refs";

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part 5. A knitr chunk header whose label is a bare token in any slot but the first is read as R CODE,
// and `R_SYMBOL_CHAIN` (`^\p{L}[\p{L}\p{N}_.]*(?:[-:](?:\p{L}[\p{L}\p{N}_.]*|(?:0|[1-9][0-9]{0,3})))*$`) reads the parts after the first as a quantified group. V8 keeps one entry of its regex backtrack stack per
// repetition of a group, so a token of millions of `-a` parts throws `RangeError: Maximum call stack size exceeded`, and the error reaches the label index (`indexLabels` and so `findLabel`, which the cross-reference
// completion and definition call with the RESOLVED engine, Learning 886). Only a document the engine resolver calls knitr reads a chunk header at all, so every row below reads with the knitr hint, and the controls
// show that no hint and the jupyter hint leave the line alone. The first slot is a plain class (`^[\p{L}\p{N}_:.-]+$`) and does not throw.
//
// The first throw was bisected at HEAD `8ebce73` (Session 337, Node 22.23.3, one fresh process per probe, the header reader and then `indexLabels` and `findLabel` through the entry, the lower bound checked OK first,
// Learning 885): the token `a` followed by n of the unit `-a` reads at 3,355,429 and throws from n = 3,355,430 (the item's figure is exact), and the units `:a`, `-ab` and `-a1` throw at the same count; a unit that is a
// canonical integer, `-0` and `-12`, reads at 8,388,572 and throws from 8,388,573 (the stack holds more for a repetition that takes the name alternative; the two figures are measured, the entry sizes are not). Every size below is twice the figure of
// its unit (Learning 775), so a size just under the limit cannot pass, and the parent THROWS at all of them: no clock limit passes it there.
//
// The stated answer is what the old pattern says with a stack that does not run out: a token that is a symbol chain defines the label it is (the whole token, its kind, its line and the column where it starts), and a
// token that is not (a leading zero, a fifth digit, a trailing separator, a `$`) defines nothing. The answer does not depend on the length: the old pattern gives it for 4 units, the short control of each row.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

describe("the clock helper", () => {
  it("timed reports the milliseconds the run took and hands back its result", () => {
    const { result, ms } = timed(() => {
      const started = Date.now();
      while (Date.now() - started < 30) {
        /* spin */
      }
      return "done";
    });
    expect(result).toBe("done");
    expect(ms).toBeGreaterThanOrEqual(25);
  });
});

describe("Session 337 — a knitr chunk header label of millions of `-a` parts, read as a quantified group (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 5)", () => {
  const S337_FEW = 4;
  // First throws, in repetitions of the unit (see the comment above): 3,355,430 for a unit that holds a letter, 8,388,573 for a canonical integer.
  const FIRST_THROW_NAME_UNIT = 3_355_430;
  const FIRST_THROW_NUMBER_UNIT = 8_388_573;
  const S337_NAME_MANY = 6_720_000;
  const S337_NUMBER_MANY = 16_800_000;
  // The cured read takes 0.4 to 0.5 s for a 13.4-million-character document and 1.0 s for a 33.6-million-character one (a spike of the cure, Node 22.23.3: 476 to 487 ms and 975 ms; the header reader alone 150 ms), so 4 s is eight times the
  // first and 10 s ten times the second. A quadratic reading of such a line would take hours, so the limit still tells the two apart.
  const S337_LIMIT_MS = 4000;
  const S337_NUMBER_LIMIT_MS = 10_000;

  type Entry = "index" | "find" | "header";
  type Row = {
    site: string;
    entry: Entry;
    /** The opener line of the chunk with `token` where the label sits. */
    chunk: (token: string) => string;
    /** The column of the token in that line. */
    column: number;
    head?: string;
    unit: string;
    many: number;
    /** A tail that makes the token NO symbol chain: the label is then not defined. */
    tail?: string;
    limitMs?: number;
  };
  const label1 = (token: string): string => "```{r label=" + token + "}";
  const label2 = (token: string): string => "```{r, label=" + token + "}";
  const label3 = (token: string): string => "```{r, echo=FALSE, label=" + token + "}";
  const unnamed2 = (token: string): string => "```{r echo=FALSE, " + token + "}";
  const unnamed3 = (token: string): string => "```{r, echo=FALSE, eval=TRUE, " + token + "}";
  const indented = (token: string): string => "   ```{r, label=" + token + "}";
  const NUMBER = { many: S337_NUMBER_MANY, limitMs: S337_NUMBER_LIMIT_MS };
  const NAME = { many: S337_NAME_MANY };

  const S337_ROWS: Row[] = [
    // The label index with the knitr hint, as the cross-reference completion calls it.
    { site: "indexLabels: `label=` in the second slot, n of `-a`", entry: "index", chunk: label2, column: 13, unit: "-a", ...NAME },
    { site: "indexLabels: `label=` in the second slot, n of `:a`", entry: "index", chunk: label2, column: 13, unit: ":a", ...NAME },
    { site: "indexLabels: `label=` in the first slot", entry: "index", chunk: label1, column: 12, unit: "-a", ...NAME },
    { site: "indexLabels: `label=` in the third slot", entry: "index", chunk: label3, column: 25, unit: "-a", ...NAME },
    { site: "indexLabels: a bare token in the second slot", entry: "index", chunk: unnamed2, column: 18, unit: "-a", ...NAME },
    { site: "indexLabels: a bare token in the third slot, n of `:a`", entry: "index", chunk: unnamed3, column: 30, unit: ":a", ...NAME },
    { site: "indexLabels: a cell indented three spaces", entry: "index", chunk: indented, column: 16, unit: "-a", ...NAME },
    { site: "indexLabels: a table label", entry: "index", chunk: label2, column: 13, head: "tbl-a", unit: "-a", ...NAME },
    { site: "indexLabels: n of `-1`, canonical integers", entry: "index", chunk: label2, column: 13, head: "fig-n", unit: "-1", ...NUMBER },
    { site: "indexLabels: n of `-0`, a zero", entry: "index", chunk: unnamed2, column: 18, head: "fig-n", unit: "-0", ...NUMBER },
    { site: "indexLabels: a leading zero at the end is no symbol chain", entry: "index", chunk: label2, column: 13, head: "fig-z", unit: "-a", tail: "-01", ...NAME },
    { site: "indexLabels: a trailing separator is no symbol chain", entry: "index", chunk: unnamed3, column: 30, head: "fig-z", unit: "-a", tail: "-", ...NAME },
    { site: "indexLabels: a fifth digit is no symbol chain", entry: "index", chunk: label3, column: 25, head: "fig-z", unit: ":a", tail: ":12345", ...NAME },
    { site: "indexLabels: a `$` is no symbol chain", entry: "index", chunk: unnamed2, column: 18, head: "fig-z", unit: ":a", tail: "$", ...NAME },
    // Go to definition: `findLabel(text, id, engine)`.
    { site: "findLabel: `label=` in the first slot, n of `:a`", entry: "find", chunk: label1, column: 12, unit: ":a", ...NAME },
    { site: "findLabel: a bare token in the third slot", entry: "find", chunk: unnamed3, column: 30, unit: "-a", ...NAME },
    { site: "findLabel: n of `-1`, canonical integers", entry: "find", chunk: label3, column: 25, head: "fig-n", unit: "-1", ...NUMBER },
    { site: "findLabel: a cell indented three spaces, n of `:a`", entry: "find", chunk: indented, column: 16, unit: ":a", ...NAME },
    { site: "findLabel: a leading zero at the end is no symbol chain", entry: "find", chunk: unnamed2, column: 18, head: "fig-z", unit: "-a", tail: "-01", ...NAME },
    // The header reader itself (the opener line alone).
    { site: "knitrChunkHeaderLabel: `label=` in the second slot", entry: "header", chunk: label2, column: 13, head: "fig-h", unit: "-a", ...NAME },
    { site: "knitrChunkHeaderLabel: a bare token in the third slot, n of `:a`", entry: "header", chunk: unnamed3, column: 30, head: "fig-h", unit: ":a", ...NAME },
    { site: "knitrChunkHeaderLabel: n of `-1`, canonical integers", entry: "header", chunk: label3, column: 25, head: "fig-h", unit: "-1", ...NUMBER },
    { site: "knitrChunkHeaderLabel: a fifth digit is no symbol chain", entry: "header", chunk: unnamed2, column: 18, head: "fig-h", unit: "-a", tail: "-12345", ...NAME },
  ];

  const tokenOf = (row: Row, units: number): string => (row.head ?? "fig-a") + row.unit.repeat(units) + (row.tail ?? "");
  // What the entry is handed: the opener line alone for the header reader, a document holding the chunk for the label index.
  const inputOf = (row: Row, units: number): string => (row.entry === "header" ? row.chunk(tokenOf(row, units)) : row.chunk(tokenOf(row, units)) + "\nplot(1)\n```\n\n# H\n");
  const kindOf = (row: Row): string => (row.head ?? "fig-a").slice(0, 3);
  const readRow = (row: Row, input: string, token: string): unknown => {
    if (row.entry === "header") {
      const header = knitrChunkHeaderLabel(input);
      return header === null ? null : [header.value === token, header.column];
    }
    if (row.entry === "find") {
      const label = findLabel(input, token, "knitr");
      return label === null ? null : [label.id === token, label.kind, label.line, label.column];
    }
    // the whole token is compared, not printed: a failure must not print 13 million characters
    return indexLabels(input, "knitr").map((label) => [label.id === token, label.kind, label.line, label.column]);
  };
  const answerOf = (row: Row): unknown => {
    const defines = row.tail === undefined;
    if (row.entry === "header") {
      return defines ? [true, row.column] : null;
    }
    if (row.entry === "find") {
      return defines ? [true, kindOf(row), 0, row.column] : null;
    }
    return defines ? [[true, kindOf(row), 0, row.column]] : [];
  };

  it.each(S337_ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    expect(readRow(row, inputOf(row, S337_FEW), tokenOf(row, S337_FEW))).toEqual(answerOf(row));
    const token = tokenOf(row, row.many);
    const input = inputOf(row, row.many);
    expect(input.length).toBeGreaterThan(row.unit.length * row.many); // the timed text holds the whole run
    const { result, ms } = timed(() => readRow(row, input, token));
    expect(result).toEqual(answerOf(row));
    expect(ms).toBeLessThan(row.limitMs ?? S337_LIMIT_MS);
  }, 120_000);

  // The hints that leave the header alone. These pass on the parent: they say WHICH hint reads the line, so a row above cannot be satisfied by an engine gate that quietly stopped reading headers.
  it.each([
    ["no hint", undefined, "-a"],
    ["the jupyter hint", "jupyter" as const, ":a"],
  ])("control: the label index with %s does not read the chunk header, whatever its length", (_hint, hint, unit) => {
    const token = "fig-c" + unit.repeat(S337_NAME_MANY);
    const text = label2(token) + "\nplot(1)\n```\n\n# H\n";
    const { result, ms } = timed(() => indexLabels(text, hint));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(S337_LIMIT_MS);
  }, 120_000);

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const small = S337_ROWS.map((row) => inputOf(row, S337_FEW));
    expect(new Set(small).size).toBe(S337_ROWS.length);
  });

  // The parent THROWS from 3,355,430 repetitions of a name unit and from 8,388,573 of a number unit; a run below that, or a unit that is not the throwing one, would pass on it, and a limit of minutes would pass a quadratic cure.
  it("keeps the sizes, the limits and the units the Session 337 rows are built on", () => {
    expect([S337_FEW, S337_LIMIT_MS, S337_NUMBER_LIMIT_MS, FIRST_THROW_NAME_UNIT, FIRST_THROW_NUMBER_UNIT, S337_NAME_MANY, S337_NUMBER_MANY]).toEqual([4, 4000, 10_000, 3_355_430, 8_388_573, 6_720_000, 16_800_000]);
    expect(S337_NAME_MANY).toBeGreaterThanOrEqual(2 * FIRST_THROW_NAME_UNIT);
    expect(S337_NUMBER_MANY).toBeGreaterThanOrEqual(2 * FIRST_THROW_NUMBER_UNIT);
    for (const row of S337_ROWS) {
      expect(row.many).toBeGreaterThanOrEqual(2 * (/^[-:]\d/.test(row.unit) ? FIRST_THROW_NUMBER_UNIT : FIRST_THROW_NAME_UNIT));
    }
    expect(S337_ROWS.map((row) => `${row.entry} ${row.unit}x${row.many}${row.tail === undefined ? "" : " +" + row.tail}`)).toEqual([
      ...["-a", ":a", "-a", "-a", "-a", ":a", "-a", "-a"].map((unit) => `index ${unit}x6720000`),
      "index -1x16800000", "index -0x16800000",
      "index -ax6720000 +-01", "index -ax6720000 +-", "index :ax6720000 +:12345", "index :ax6720000 +$",
      "find :ax6720000", "find -ax6720000", "find -1x16800000", "find :ax6720000", "find -ax6720000 +-01",
      "header -ax6720000", "header :ax6720000", "header -1x16800000", "header -ax6720000 +-12345",
    ]);
    expect(S337_ROWS.map((row) => row.limitMs ?? 0)).toEqual([...Array.from({ length: 8 }, () => 0), 10_000, 10_000, ...Array.from({ length: 4 }, () => 0), 0, 0, 10_000, 0, 0, 0, 0, 10_000, 0]);
  });
});
