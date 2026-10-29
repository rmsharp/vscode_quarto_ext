import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

// Session 336 — the BACKLOG item "Three more single-line shapes found by Session 335's review round", part (3). The pipe-table opener of `tableOrLineBlockEndsAt` asks `pipeDelimiterRow(lines[k + 1])`, and mutant W01
// of `tools/mutation-run/mutants/s335-table-rule-row.json` put `tableRuleRow` there instead: the same pipe body, but any white space (`\s*`) after it where the delimiter row allows blanks and tabs only. Session
// 335 recorded it as a survivor (77,040 documents with a pressed heading below the table, none separated). The follower that separates them is the one the Session 295 free case uses: an indent-4 `{bash}` opener
// DIRECTLY below the table. Where the table ends, the opener is indented code and `## In` is a heading (quarto lists it); where it does not, the opener is a lazy line of the paragraph and `## In` is swallowed.
// A delimiter row that ends in a form feed, a vertical tab, a no-break space or any other white space that is not a blank or a tab is NOT a delimiter row to pandoc, so no table exists, and the model says so only
// because the opener asks the exact function. Every expected list below was RENDERED with quarto 1.7.33 (`quarto render x.qmd --to html`, markdown engine, 22 documents, Session 336) and the headings read from
// the HTML; the real build agrees with all 22, and the W01 mutant disagrees with 16.

const LISTED = ["Before", "In", "After"]; // the table ended: the opener is indented code and quarto lists `In`
const SWALLOWED = ["Before", "After"]; //   no table: the opener is a lazy line of the paragraph above and quarto swallows `In`

const FF = "\f";
const VT = "\v";
const NBSP = String.fromCharCode(0xa0);
const EM_SPACE = String.fromCharCode(0x2003);
const IDEOGRAPHIC = String.fromCharCode(0x3000);
const BOM = String.fromCharCode(0xfeff);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

type Shape = "outer pipes" | "no body row" | "no outer pipes" | "indented delimiter row";
const tableLines = (shape: Shape, tail: string): string[] => {
  switch (shape) {
    case "outer pipes":
      return ["| a | b |", `|---|---|${tail}`, "| 1 | 2 |"];
    case "no body row":
      return ["| a | b |", `|---|---|${tail}`];
    case "no outer pipes":
      return ["a | b", `--|--${tail}`, "1 | 2"];
    case "indented delimiter row":
      return ["| a | b |", ` |---|---|${tail}`, "| 1 | 2 |"];
  }
};
/** The Session 295 probe, markdown engine: `## Before`, the table (under a blank line and a prose line, or directly under the heading), the indent-4 `{bash}` opener directly below it, `## In` inside, the closer, `## After`. */
function probe(tail: string, shape: Shape = "outer pipes", context: "blank" | "heading" = "blank", from: string | null = null): string {
  return (
    [
      "---",
      'title: "T"',
      "engine: markdown",
      ...(from === null ? [] : [`from: ${from}`]),
      "---",
      "",
      "## Before",
      ...(context === "blank" ? ["", "Prose before.", ""] : []),
      ...tableLines(shape, tail),
      "    ```{bash}",
      "## In",
      "x = 1",
      "    ```",
      "",
      "## After",
      "",
      "tail",
    ].join("\n") + "\n"
  );
}
const headings = (text: string): string[] => findHeadings(text, "markdown").map((h) => h.text);

describe("Session 336 — a pipe-table delimiter row ends in blanks and tabs only, so the table opener asks the exact function (W01 of s335-table-rule-row.json)", () => {
  // Rendered: a delimiter row that is a delimiter row. A trailing CR is the CR of a CRLF line end.
  it.each([
    ["no tail", ""],
    ["a space", " "],
    ["a tab", "\t"],
    ["a carriage return (CRLF)", "\r"],
  ])("%s after the delimiter row: a table, the opener below it is indented code", (_label, tail) => {
    expect(headings(probe(tail))).toEqual(LISTED);
  });

  // Rendered: white space that is not a blank or a tab. Quarto draws no table (0 tables in the HTML) and swallows `In`.
  it.each([
    ["a form feed", FF],
    ["a vertical tab", VT],
    ["a no-break space", NBSP],
    ["an em space (U+2003)", EM_SPACE],
    ["an ideographic space (U+3000)", IDEOGRAPHIC],
    ["a byte order mark (U+FEFF)", BOM],
    ["a line separator (U+2028)", LS],
    ["a paragraph separator (U+2029)", PS],
    ["a space and a form feed", ` ${FF}`],
    ["a form feed and a space", `${FF} `],
    ["a tab and a vertical tab", `\t${VT}`],
  ])("%s after the delimiter row: no table, the opener below it is a line of the paragraph and `In` is swallowed", (_label, tail) => {
    expect(headings(probe(tail))).toEqual(SWALLOWED);
  });

  // Rendered, with a form feed: the table shape does not matter, only the delimiter row's end.
  it.each<[string, Shape, string[]]>([
    ["a table with no body row", "no body row", SWALLOWED],
    ["a table with no outer pipes", "no outer pipes", SWALLOWED],
    // a delimiter row indented ONE space is no delimiter row here either, and quarto lists `In` for another reason (the line below the header is paragraph text, the opener a fresh indented code block)
    ["a delimiter row indented one space", "indented delimiter row", LISTED],
  ])("a form feed after the delimiter row of %s", (_label, shape, expected) => {
    expect(headings(probe(FF, shape))).toEqual(expected);
  });

  // Rendered: the table directly under the heading, and the readers. `markdown` and `markdown-line_blocks` keep pandoc's rules; under `gfm` an ATX line interrupts a paragraph, so `In` is a heading with or without a table.
  it("a form feed after the delimiter row, the table directly under the heading: no table, `In` is swallowed", () => {
    expect(headings(probe(FF, "outer pipes", "heading"))).toEqual(SWALLOWED);
  });
  it.each([
    ["markdown", SWALLOWED],
    ["markdown-line_blocks", SWALLOWED],
    ["gfm", LISTED],
  ])("a form feed after the delimiter row under from: %s", (from, expected) => {
    expect(headings(probe(FF, "outer pipes", "blank", from))).toEqual(expected);
  });
});
