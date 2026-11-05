import { describe, expect, it } from "vitest";
import { findAllCells, findCellAtPosition } from "../../src/core/qmd/model";
import {
  TYPE_IGNORE_DIRECTIVE,
  buildCellVirtualContent,
  createCellVdocBuilder,
} from "../../src/core/embedded/virtual-doc";

// Session 341 -- the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (2). The Outline provider forwards every code cell of a document into its own per-cell
// virtual document (`forwardCellSymbols` in `src/providers/outline.ts`): for each cell it asked `findCellAtPosition(text, cell.startLine)` (a scan of every cell) and `buildCellVirtualContent(text, cell)`
// (a split of the whole text, every cell's option lines recomputed, a callback over every line, and for a python cell a whole-document `some` for the mute). That is cells times document.
// `createCellVdocBuilder(text)` is made once per `provideDocumentSymbols` call and answers `cellAt(line)` (what `findCellAtPosition(text, line)` answers) and `build(cell)` (what
// `buildCellVirtualContent(text, cell)` answers, byte for byte) without redoing the per-text work for each cell.
//
// This file holds the ANSWER rows (they pass on the parent's logic and state what the builder must answer) and the CLOCK rows (they are the reason for the change). The old spelling is kept verbatim as the
// oracle in `cell-vdoc-builder-equivalence.test.ts`.

/** The line numbers are in the comments: the document is read through its own numbers, so a row names the line it means. */
const DOC = [
  "---", // 0
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Intro prose.", // 4
  "```{python}", // 5
  "#| echo: false", // 6
  "import os", // 7
  "  ", // 8  a whitespace-only body line
  "x = 1", // 9
  "```", // 10
  "", // 11
  "```{python}", // 12
  "y = 2", // 13
  "```", // 14
  "```{r}", // 15
  "z <- 3", // 16
  "```", // 17
].join("\n");

describe("createCellVdocBuilder -- the answers (Session 341)", () => {
  it("builds one cell's body lines verbatim, a whitespace-only one too, and empties everything else", () => {
    const builder = createCellVdocBuilder(DOC);
    const first = builder.cellAt(5);
    expect(first).not.toBeNull();
    const lines = builder.build(first!).split("\n");
    expect(lines[0]).toBe(TYPE_IGNORE_DIRECTIVE);
    expect(lines.slice(1, 7)).toEqual(["", "", "", "", "", ""]);
    expect(lines.slice(7, 10)).toEqual(["import os", "  ", "x = 1"]);
    expect(lines.slice(10)).toEqual(["", "", "", "", "", "", "", ""]);
  });

  it("keeps the line count of the text, whatever the cell", () => {
    const builder = createCellVdocBuilder(DOC);
    for (const cell of findAllCells(DOC)) {
      expect(builder.build(cell).split("\n")).toHaveLength(DOC.split("\n").length);
    }
  });

  it("empties a same-language sibling cell: the second python cell's vdoc holds only its own body", () => {
    const builder = createCellVdocBuilder(DOC);
    const second = builder.cellAt(12)!;
    const lines = builder.build(second).split("\n");
    expect(lines[13]).toBe("y = 2");
    expect(lines[7]).toBe("");
    expect(lines[9]).toBe("");
  });

  it("gives no mute to an r cell, and the mute to a python cell", () => {
    const builder = createCellVdocBuilder(DOC);
    expect(builder.build(builder.cellAt(15)!).split("\n")[0]).toBe("");
    expect(builder.build(builder.cellAt(12)!).split("\n")[0]).toBe(TYPE_IGNORE_DIRECTIVE);
  });

  it("answers cellAt as findCellAtPosition does: a fence line is inside the cell, prose and the line past the end are not", () => {
    const builder = createCellVdocBuilder(DOC);
    const total = DOC.split("\n").length;
    for (let line = -1; line <= total + 1; line++) {
      expect(builder.cellAt(line)).toEqual(findCellAtPosition(DOC, line));
    }
    expect(builder.cellAt(5)).not.toBeNull();
    expect(builder.cellAt(10)).not.toBeNull();
    expect(builder.cellAt(11)).toBeNull();
    expect(builder.cellAt(total)).toBeNull();
  });

  it("buildCellVirtualContent still answers what the builder answers", () => {
    const builder = createCellVdocBuilder(DOC);
    for (const cell of findAllCells(DOC)) {
      expect(buildCellVirtualContent(DOC, cell)).toBe(builder.build(cell));
    }
  });
});
