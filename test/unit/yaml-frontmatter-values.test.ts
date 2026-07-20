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
