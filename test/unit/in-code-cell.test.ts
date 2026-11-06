import { describe, expect, it } from "vitest";
import { isInCodeCell } from "../../src/core/in-code-cell";
import { findCellAtPosition } from "../../src/core/qmd/model";

// Session 342 -- the review round's mutation lens (M-02): NO test, unit or integration, read the VALUE of the `quarto.inCodeCell` context key. `updateCellContext` (`src/features/execution.ts`) held the whole question
// inline -- `editor !== undefined && editor.document.languageId === "quarto" && findCellAtPosition(text, editor.selection.active.line) !== null` -- in a file that imports `vscode`, so the selection's anchor for its active
// end, `=== null` for `!== null`, another language id and the inverted result all survived every row. The cheapest way to make the VALUE testable is the vscode-free predicate, `isInCodeCell(languageId, text, line)`, with
// exactly the old answer: a `quarto` document, and a line inside a cell (the fences and the `#|` option lines count: the cell is `[startLine, endLine]`, fences included, and the key gates `ctrl+enter`, `shift+enter`,
// `ctrl+shift+enter`, `ctrl+alt+c` and `ctrl+k ctrl+f`). That `updateCellContext` hands it the ACTIVE end of the selection, the document's language and the key's name is pinned by the syntax tree in
// `s342-typing-wiring-pin.test.ts`.

/** Line numbers are 0-based. The cells are lines 5-8 (a python cell with a `#|` option line) and 14-16 (an r cell); lines 11-13 are a fenced block with no braces, which is not a cell. */
const DOCUMENT = [
  "---", // 0
  "title: t", // 1
  "---", // 2
  "", // 3
  "Some prose.", // 4
  "```{python}", // 5
  "#| echo: false", // 6
  "x = 1", // 7
  "```", // 8
  "", // 9
  "More prose.", // 10
  "```python", // 11
  "not = 'a cell'", // 12
  "```", // 13
  "```{r}", // 14
  "y <- 2", // 15
  "```", // 16
  "The end.", // 17
];
const LF = DOCUMENT.join("\n");
const CRLF = DOCUMENT.join("\r\n");
const IN_CELL = new Set([5, 6, 7, 8, 14, 15, 16]);

describe("isInCodeCell -- the value of the quarto.inCodeCell key (Session 342 review, M-02)", () => {
  it.each([
    ["the opening fence of a python cell", 5, true],
    ["a #| option line", 6, true],
    ["a line of the cell body", 7, true],
    ["the closing fence", 8, true],
    ["the opening fence of the next cell", 14, true],
    ["the body of the r cell", 15, true],
    ["the closing fence of the r cell", 16, true],
    ["the front matter's opening rule", 0, false],
    ["a front matter line", 1, false],
    ["the front matter's closing rule", 2, false],
    ["a blank line before the first cell", 3, false],
    ["prose", 4, false],
    ["the blank line after a cell", 9, false],
    ["prose between cells", 10, false],
    ["the fence of a block with no braces (not an executable cell)", 11, false],
    ["the body of a block with no braces", 12, false],
    ["the closing fence of a block with no braces", 13, false],
    ["prose after the last cell", 17, false],
  ])("a quarto document, %s (line %i): %s", (_where, line, expected) => {
    expect(isInCodeCell("quarto", LF, line)).toBe(expected);
  });

  it("answers every line of the document exactly as the cell model does (findCellAtPosition is not null), and exactly the cell lines are true", () => {
    for (let line = 0; line < DOCUMENT.length; line++) {
      expect(isInCodeCell("quarto", LF, line)).toBe(findCellAtPosition(LF, line) !== null);
      expect(isInCodeCell("quarto", LF, line)).toBe(IN_CELL.has(line));
    }
  });

  it("a CRLF document answers the same on every line as the LF one", () => {
    for (let line = 0; line < DOCUMENT.length; line++) {
      expect(isInCodeCell("quarto", CRLF, line)).toBe(IN_CELL.has(line));
    }
  });

  describe("only a quarto document has the key (a line that is inside a fence of another language is not in a cell)", () => {
    it.each([["markdown"], ["python"], ["r"], ["plaintext"], ["Quarto"], ["QUARTO"], ["quarto "], [" quarto"], ["qmd"], ["quarto-md"], [""]])("languageId %j: false on a line inside a cell", (languageId) => {
      expect(IN_CELL.has(7)).toBe(true);
      expect(isInCodeCell(languageId, LF, 7)).toBe(false);
      expect(isInCodeCell(languageId, LF, 5)).toBe(false);
      expect(isInCodeCell(languageId, LF, 16)).toBe(false);
    });

    it("and quarto is true on the same lines (the language id is the one difference)", () => {
      expect(isInCodeCell("quarto", LF, 7)).toBe(true);
      expect(isInCodeCell("quarto", LF, 5)).toBe(true);
      expect(isInCodeCell("quarto", LF, 16)).toBe(true);
    });
  });

  describe("shapes of document and line", () => {
    it("an empty document has no cell", () => {
      expect(isInCodeCell("quarto", "", 0)).toBe(false);
      expect(isInCodeCell("quarto", "", 3)).toBe(false);
      expect(isInCodeCell("quarto", "\n", 0)).toBe(false);
    });

    it("a document that is one cell: every line of it, and not the line after", () => {
      const one = "```{python}\nx = 1\n```";
      expect([0, 1, 2, 3].map((line) => isInCodeCell("quarto", one, line))).toEqual([true, true, true, false]);
      const oneWithNewline = "```{python}\nx = 1\n```\n";
      expect([0, 1, 2, 3, 4].map((line) => isInCodeCell("quarto", oneWithNewline, line))).toEqual([true, true, true, false, false]);
    });

    it("an opening fence that is never closed is not a cell", () => {
      const open = "Prose.\n```{python}\nx = 1\ny = 2\n";
      expect([0, 1, 2, 3, 4].map((line) => isInCodeCell("quarto", open, line))).toEqual([false, false, false, false, false]);
    });

    it("a line number is a number field (Learning 914): a fraction, NaN, a negative and infinities answer as findCellAtPosition does", () => {
      const lines = [-1, -0.5, 0, 4.5, 5, 5.5, 7.25, 8, 8.5, 16, 16.5, 17, 1e9, Infinity, -Infinity, NaN, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
      for (const line of lines) {
        expect(isInCodeCell("quarto", LF, line)).toBe(findCellAtPosition(LF, line) !== null);
      }
      // by hand, so that the loop above is not the only judge: a fraction inside a cell is inside, outside is outside, and what is not a line number is in no cell
      expect(isInCodeCell("quarto", LF, 5.5)).toBe(true);
      expect(isInCodeCell("quarto", LF, 8.5)).toBe(false);
      expect(isInCodeCell("quarto", LF, 4.5)).toBe(false);
      expect(isInCodeCell("quarto", LF, NaN)).toBe(false);
      expect(isInCodeCell("quarto", LF, -1)).toBe(false);
      expect(isInCodeCell("quarto", LF, Infinity)).toBe(false);
      expect(isInCodeCell("quarto", LF, -Infinity)).toBe(false);
      expect(isInCodeCell("quarto", LF, 1e9)).toBe(false);
    });
  });

  describe("the text may be handed as a function, read only when the language id is quarto (the old code read the document only for a quarto document: a cursor move in a .ts file costs no getText)", () => {
    it("a quarto document: the function is called once, and the answer is the one for the text it returns", () => {
      let reads = 0;
      const text = (): string => {
        reads++;
        return LF;
      };
      expect(isInCodeCell("quarto", text, 7)).toBe(true);
      expect(reads).toBe(1);
      expect(isInCodeCell("quarto", text, 17)).toBe(false);
      expect(reads).toBe(2);
    });

    it("any other language id: the function is never called", () => {
      let reads = 0;
      const text = (): string => {
        reads++;
        return LF;
      };
      for (const languageId of ["markdown", "python", "typescript", "", "Quarto"]) {
        expect(isInCodeCell(languageId, text, 7)).toBe(false);
      }
      expect(reads).toBe(0);
    });

    it("a string and a function that returns it answer alike on every line", () => {
      for (let line = 0; line < DOCUMENT.length; line++) {
        expect(isInCodeCell("quarto", () => LF, line)).toBe(isInCodeCell("quarto", LF, line));
      }
    });
  });
});
