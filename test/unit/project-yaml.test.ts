import { describe, expect, it } from "vitest";
import { findProjectConfigKeyLines, isProjectConfigFileName } from "../../src/core/project-yaml";

describe("findProjectConfigKeyLines — direct children of project:/website:/book:", () => {
  it("finds direct children of project:", () => {
    const text = ["project:", "  title: My Project", "  type: website"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 2, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
    ]);
  });

  it("finds direct children of website:", () => {
    const text = ["website:", "  title: My Site", "  navbar: {}"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "website", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 2, container: "website", key: "navbar", keyRange: { startCol: 2, endCol: 8 } },
    ]);
  });

  it("finds direct children of book:", () => {
    const text = ["book:", "  title: My Book", "  chapters:"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "book", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 2, container: "book", key: "chapters", keyRange: { startCol: 2, endCol: 10 } },
    ]);
  });

  it("ignores a top-level container that is not project:/website:/book:", () => {
    const text = ["format:", "  html:", "    toc: true"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });
});

describe("findProjectConfigKeyLines — never a false flag (out-of-scope shapes are skipped)", () => {
  it("skips deeper nesting under a project: child (only the container's OWN indent is scanned)", () => {
    const text = ["project:", "  execute-dir: file", "    fake-deep: 1"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "execute-dir", keyRange: { startCol: 2, endCol: 13 } },
    ]);
  });

  it("skips a dedent back to a shallower indent under the same container", () => {
    const text = [
      "project:",
      "  render:",
      "    - \"*.qmd\"",
      " type: website", // 1-space dedent, not the established 2-space child indent
    ].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "render", keyRange: { startCol: 2, endCol: 8 } },
    ]);
  });

  it("skips block-sequence items ('- ...') at the container's own indent", () => {
    const text = ["project:", "  - not-a-key", "  type: website"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 2, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
    ]);
  });

  it("never flags a column-0 sibling key as a child, even when the container has no children yet", () => {
    // project: has NO indented child before the column-0 `bibliography:` line —
    // a naive scanner that lets the first-seen-indent default to 0 here would
    // misread `bibliography` as a project: child. It must not.
    const text = ["project:", "bibliography: refs.bib"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });

  it("does not enter a container written with an inline scalar value (not a pure mapping)", () => {
    const text = ["project: not-a-mapping", "  type: website"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });

  it("ignores blank lines and full-line comments inside a container without breaking the scan", () => {
    const text = [
      "project:",
      "",
      "  # a comment",
      "  type: website",
    ].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 3, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
    ]);
  });
});

describe("findProjectConfigKeyLines — multiple containers in one document", () => {
  it("scans project:, website:, and book: independently, each with its own child indent", () => {
    const text = [
      "project:",
      "  type: website",
      "website:",
      "  title: Site",
      "book:",
      "  title: Book",
    ].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
      { line: 3, container: "website", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 5, container: "book", key: "title", keyRange: { startCol: 2, endCol: 7 } },
    ]);
  });

  it("returns an empty array for a document with none of project:/website:/book:", () => {
    const text = ["format:", "  html:", "    toc: true"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });

  it("returns an empty array for an empty document", () => {
    expect(findProjectConfigKeyLines("")).toEqual([]);
  });
});

describe("findProjectConfigKeyLines — quoted keys (adversarial review, Session 47)", () => {
  it("unquotes a double-quoted key so it compares equal to its unquoted form", () => {
    const text = ['project:', '  "output-dir": docs'].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      // keyRange spans the FULL token on screen, quotes included (col 2..14 = `"output-dir"`,
      // 12 chars); `key` is the unquoted logical name used for schema comparison.
      { line: 1, container: "project", key: "output-dir", keyRange: { startCol: 2, endCol: 14 } },
    ]);
  });

  it("unquotes a single-quoted key the same way", () => {
    const text = ["project:", "  'output-dir': docs"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "output-dir", keyRange: { startCol: 2, endCol: 14 } },
    ]);
  });

  it("real-world case: a quoted UNKNOWN key is still reported (as its unquoted name), not silently swallowed", () => {
    const text = ["project:", '  "bogus-key": true'].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "bogus-key", keyRange: { startCol: 2, endCol: 13 } },
    ]);
  });
});

describe("findProjectConfigKeyLines — a leading UTF-8 BOM does not disable scanning (adversarial review, Session 47)", () => {
  it("still recognizes project: as a container when the file starts with a BOM", () => {
    const text = "﻿project:\n  bogus-key: 1";
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "bogus-key", keyRange: { startCol: 2, endCol: 11 } },
    ]);
  });
});

describe("isProjectConfigFileName — the filename gate is EXACT, never a suffix match (adversarial review, Session 47)", () => {
  it("accepts the exact basenames", () => {
    expect(isProjectConfigFileName("/a/b/_quarto.yml")).toBe(true);
    expect(isProjectConfigFileName("/a/b/_quarto.yaml")).toBe(true);
    expect(isProjectConfigFileName("_quarto.yml")).toBe(true);
  });

  it("rejects a file that merely ENDS WITH the target name (the confirmed false-positive shape)", () => {
    expect(isProjectConfigFileName("/a/b/not_quarto.yml")).toBe(false);
    expect(isProjectConfigFileName("/a/b/my_quarto.yml")).toBe(false);
    expect(isProjectConfigFileName("/a/b/backup_quarto.yaml")).toBe(false);
    expect(isProjectConfigFileName("/a/b/template_quarto.yml")).toBe(false);
  });

  it("rejects an unrelated file, and a directory component that happens to match", () => {
    expect(isProjectConfigFileName("/a/_quarto.yml/b.txt")).toBe(false);
    expect(isProjectConfigFileName("/a/b/readme.md")).toBe(false);
  });
});
