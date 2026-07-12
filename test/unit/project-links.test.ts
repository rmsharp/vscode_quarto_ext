import { describe, expect, it } from "vitest";
import { findPathValueCandidates } from "../../src/core/project-links";

describe("findPathValueCandidates — scalar mapping values", () => {
  it("finds a top-level `key: value` scalar candidate", () => {
    const text = "bibliography: refs.bib";
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
    ]);
  });

  it("skips a pure-mapping container line (empty value) but keeps its child value", () => {
    const text = ["project:", "  type: default"].join("\n");
    // `project:` has an empty value -> nothing to link; `type:`'s value is a
    // candidate (the adapter's existence check, not the scanner, rejects it).
    expect(findPathValueCandidates(text)).toEqual([
      { line: 1, valueRange: { startCol: 8, endCol: 15 }, token: "default" },
    ]);
  });

  it("finds a candidate at ANY depth, not just project:/website:/book: (whole-document scope)", () => {
    // `bibliography:` lives in the general document schema, NOT project:/website:/
    // book: -- the scope decision (plan §0). It must still be found.
    const text = ["project:", "  type: book", "bibliography: refs.bib"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 1, valueRange: { startCol: 8, endCol: 12 }, token: "book" },
      { line: 2, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
    ]);
  });

  it("excludes boolean literals (true/false, any case)", () => {
    const text = ["toc: true", "number-sections: FALSE"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([]);
  });
});

describe("findPathValueCandidates — block-sequence items", () => {
  it("finds `- value` items at depth", () => {
    const text = ["project:", "  resources:", "    - data/raw.csv"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 2, valueRange: { startCol: 6, endCol: 18 }, token: "data/raw.csv" },
    ]);
  });

  it("ignores a lone `-` and a non-marker `-x` scalar", () => {
    const text = ["render:", "  -", "  -x"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([]);
  });

  it("extracts the value from an inline-mapping sequence item (`- href: page.qmd`)", () => {
    // The dominant navbar/sidebar `contents:` shape and book `- part:` lists.
    // The path is the VALUE of the inline mapping, not the whole `key: value`.
    const text = ["website:", "  navbar:", "    left:", "      - href: intro.qmd"].join(
      "\n",
    );
    expect(findPathValueCandidates(text)).toEqual([
      { line: 3, valueRange: { startCol: 14, endCol: 23 }, token: "intro.qmd" },
    ]);
  });

  it("extracts the value from a `- part: value` book-chapters item", () => {
    const text = ["book:", "  chapters:", "    - part: summary.qmd"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 2, valueRange: { startCol: 12, endCol: 23 }, token: "summary.qmd" },
    ]);
  });
});

describe("findPathValueCandidates — quoting and comments", () => {
  it("strips surrounding double quotes from the token, keeping the quotes in the range", () => {
    const text = '    - "images/logo.png"';
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 6, endCol: 23 }, token: "images/logo.png" },
    ]);
  });

  it("strips surrounding single quotes", () => {
    const text = "bibliography: 'refs.bib'";
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 14, endCol: 24 }, token: "refs.bib" },
    ]);
  });

  it("trims a trailing inline comment from an unquoted value", () => {
    const text = "bibliography: refs.bib  # the main bib";
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
    ]);
  });

  it("finds the mapping colon past a colon embedded in a quoted key", () => {
    // The mapping colon is the first `:` followed by whitespace/EOL, so the
    // in-quote `:` in `"a:b"` (followed by `b`) is correctly skipped.
    const text = '"a:b": intro.qmd';
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 7, endCol: 16 }, token: "intro.qmd" },
    ]);
  });
});

describe("findPathValueCandidates — line skipping", () => {
  it("skips blank and comment lines and reports multiple candidates", () => {
    const text = [
      "# leading comment",
      "bibliography: refs.bib",
      "",
      "csl: apa.csl",
    ].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 1, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
      { line: 3, valueRange: { startCol: 5, endCol: 12 }, token: "apa.csl" },
    ]);
  });
});
