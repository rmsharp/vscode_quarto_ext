import { describe, expect, it } from "vitest";
import { findFrontMatterValueLines } from "../../src/core/yaml-frontmatter-values";

describe("findFrontMatterValueLines — top-level front-matter value lines", () => {
  it("emits a top-level scalar value line with key, value range, and raw token", () => {
    const text = ["---", "toc: true", "---", "", "Body."].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 9 }, rawToken: "true" },
    ]);
  });

  it("emits multiple top-level scalars in document order, with exact ranges", () => {
    const text = ["---", "toc: yes", "number-sections: maybe", "df-print: banana", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
      { line: 2, key: "number-sections", valueRange: { startCol: 17, endCol: 22 }, rawToken: "maybe" },
      { line: 3, key: "df-print", valueRange: { startCol: 10, endCol: 16 }, rawToken: "banana" },
    ]);
  });
});

describe("findFrontMatterValueLines — bounded to the front matter (never the body)", () => {
  it("excludes a `key: value` line in the document BODY (front-matter scanner bounds the scan)", () => {
    const text = ["---", "toc: false", "---", "", "date: today", "toc: yes"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 10 }, rawToken: "false" },
    ]);
  });

  it("returns [] for a document with no front matter", () => {
    const text = ["Just prose.", "", "toc: true"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });

  it("handles an UNTERMINATED front-matter block (last line counts as content)", () => {
    const text = ["---", "toc: yes"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });

  it("handles CRLF line endings", () => {
    const text = ["---", "toc: yes", "---", ""].join("\r\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });
});

describe("findFrontMatterValueLines — never a false line (out-of-scope shapes are skipped)", () => {
  it("skips a block-opener (no scalar value) but emits its top-level scalar sibling", () => {
    const text = ["---", "format:", "number-sections: true", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 2, key: "number-sections", valueRange: { startCol: 17, endCol: 21 }, rawToken: "true" },
    ]);
  });

  it("skips a comment-only value (treated as no scalar)", () => {
    const text = ["---", "toc: # just a comment", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });

  it("skips NESTED (indented) value lines — v2, not v1", () => {
    const text = ["---", "format:", "  html:", "    toc: true", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });

  it("skips comment lines and block-sequence items", () => {
    const text = ["---", "# a comment", "toc: false", "- seqitem", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 2, key: "toc", valueRange: { startCol: 5, endCol: 10 }, rawToken: "false" },
    ]);
  });
});

describe("findFrontMatterValueLines — value-token grammar (quotes, comments, multi-colon)", () => {
  it("retains the quotes of a quoted value in rawToken and its range", () => {
    const text = ["---", 'toc: "true"', "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 11 }, rawToken: '"true"' },
    ]);
  });

  it("strips a trailing unquoted inline comment from the value token", () => {
    const text = ["---", "toc: false # note", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 10 }, rawToken: "false" },
    ]);
  });

  it("splits on the FIRST (mapping) colon, keeping a colon inside the value (title: My Talk: 2026)", () => {
    const text = ["---", "title: My Talk: 2026", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 20 }, rawToken: "My Talk: 2026" },
    ]);
  });
});

describe("findFrontMatterValueLines — the key/value SEPARATOR guard (P2, THE cardinal-sin FP, plan §2.8)", () => {
  it("does NOT emit a `key:: value` top-level line (quarto renders it exit 0)", () => {
    // YAML's key is `toc:`, not `toc`. The `.qmd` front-matter top level is an OPEN key
    // set, so quarto accepts the odd key and renders exit 0 (firsthand-verified, S148),
    // while splitting at the first colon yields the bogus value token `: true` — which
    // the matcher flags against toc's closed boolean enum. A cardinal-sin false positive.
    const text = ["---", "toc:: true", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });
});

describe("findFrontMatterValueLines — multi-line flow collections (adversarial review, S125)", () => {
  // A value that opens an unclosed flow mapping `{…}` / sequence `[…]` spans
  // several lines; its continuation lines sit at column 0 and MUST NOT be
  // re-parsed as independent top-level mappings — quarto renders the whole thing
  // exit 0, so emitting e.g. `toc` from a continuation line would be a cardinal-sin
  // false positive downstream.
  it("does NOT emit column-0 continuation lines of a multi-line flow MAPPING", () => {
    const text = ["---", "mymeta: {", "toc: yes,", "x: 1}", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "mymeta", valueRange: { startCol: 8, endCol: 9 }, rawToken: "{" },
    ]);
  });

  it("resumes validation on the top-level line AFTER a multi-line flow SEQUENCE closes", () => {
    const text = ["---", "filters: [a,", "b]", "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "filters", valueRange: { startCol: 9, endCol: 12 }, rawToken: "[a," },
      { line: 3, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });

  it("does not enter flow-skip for a value that merely CONTAINS a bracket mid-scalar or is a QUOTED string", () => {
    // Neither opens a flow collection (a collection must START with [/{), so the
    // following top-level line stays validated — no over-suppression.
    const text = ["---", 'title: "A [ Talk"', "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 17 }, rawToken: '"A [ Talk"' },
      { line: 2, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });

  it("does not enter flow-skip for a single-line balanced flow collection", () => {
    const text = ["---", "filters: [a, b]", "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "filters", valueRange: { startCol: 9, endCol: 15 }, rawToken: "[a, b]" },
      { line: 2, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });
});

describe("findFrontMatterValueLines — multi-line QUOTED scalars (adversarial review, S130)", () => {
  // A multi-line single/double-QUOTED scalar folds its continuation line into the
  // value even when that continuation sits at COLUMN 0 — quarto renders the whole
  // span exit 0 as one string. So a continuation like `columns: wide"` is NOT a new
  // top-level mapping; emitting it would be a cardinal-sin false positive (the numeric
  // branch flags `columns`/`fig-width`, which were previously OPEN and masked it).
  // The quote-naive flow counter misses this (an open quote holds no `[]{}` brackets);
  // the fix is the quote-aware scanner the nested enumerator already uses (S128).
  it("does NOT emit the column-0 continuation of a multi-line DOUBLE-quoted scalar", () => {
    const text = ["---", 'title: "hello', 'columns: wide"', "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 13 }, rawToken: '"hello' },
    ]);
  });

  it("does NOT emit the column-0 continuation of a multi-line SINGLE-quoted scalar", () => {
    const text = ["---", "subtitle: 'intro", "fig-width: huge'", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "subtitle", valueRange: { startCol: 10, endCol: 16 }, rawToken: "'intro" },
    ]);
  });

  it("resumes validation on the top-level line AFTER the closing quote", () => {
    const text = ["---", 'title: "hello', 'world"', "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 13 }, rawToken: '"hello' },
      { line: 3, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });
});
