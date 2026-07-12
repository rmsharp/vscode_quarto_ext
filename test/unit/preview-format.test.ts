import { describe, expect, it } from "vitest";
import {
  buildPreviewArgs,
  parseDeclaredFormats,
} from "../../src/core/preview-format";

describe("parseDeclaredFormats", () => {
  it("reads a single scalar format", () => {
    const text = ['---', 'title: "T"', "format: html", "---", "", "# Hi"].join(
      "\n",
    );
    expect(parseDeclaredFormats(text)).toEqual(["html"]);
  });

  it("reads block-mapping children as format names, skipping nested options", () => {
    const text = [
      "---",
      'title: "T"',
      "format:",
      "  html:",
      "    toc: true",
      "  pdf: default",
      "---",
      "",
      "# Hi",
    ].join("\n");
    expect(parseDeclaredFormats(text)).toEqual(["html", "pdf"]);
  });

  // Remaining branches locked as a battery after the two genuine REDs above
  // (module-missing for the scalar path, mapping-returns-[] for the block path).

  it("reads block-sequence items as format names", () => {
    const text = [
      "---",
      "format:",
      "  - html",
      "  - pdf",
      "---",
    ].join("\n");
    expect(parseDeclaredFormats(text)).toEqual(["html", "pdf"]);
  });

  it("preserves hyphens/underscores in format names", () => {
    const text = [
      "---",
      "format:",
      "  revealjs:",
      "    incremental: true",
      "  commonmark_x: default",
      "---",
    ].join("\n");
    expect(parseDeclaredFormats(text)).toEqual(["revealjs", "commonmark_x"]);
  });

  it("strips quotes and an inline comment from a scalar format", () => {
    const text = ['---', 'format: "html"  # the default', "---"].join("\n");
    expect(parseDeclaredFormats(text)).toEqual(["html"]);
  });

  it("returns [] when there is no top-level format key", () => {
    const text = ['---', 'title: "T"', "toc: true", "---", "# Hi"].join("\n");
    expect(parseDeclaredFormats(text)).toEqual([]);
  });

  it("returns [] when the document has no front matter", () => {
    expect(parseDeclaredFormats("# Just a heading\n\nProse.")).toEqual([]);
  });

  it("ignores a format key nested under another key (not top-level)", () => {
    const text = [
      "---",
      "metadata:",
      "  format: bogus",
      "format: html",
      "---",
    ].join("\n");
    expect(parseDeclaredFormats(text)).toEqual(["html"]);
  });

  it("skips deeper nested option lines under a format", () => {
    const text = [
      "---",
      "format:",
      "  html:",
      "    toc: true",
      "    number-sections: true",
      "  pdf:",
      "    documentclass: report",
      "---",
    ].join("\n");
    expect(parseDeclaredFormats(text)).toEqual(["html", "pdf"]);
  });

  it("handles CRLF line endings (via the shared front-matter scanner)", () => {
    const text = ["---", "format:", "  html:", "  pdf:", "---"].join("\r\n");
    expect(parseDeclaredFormats(text)).toEqual(["html", "pdf"]);
  });
});

describe("buildPreviewArgs", () => {
  it("previews a file with no format (plain preview args)", () => {
    expect(buildPreviewArgs("/abs/doc.qmd")).toEqual([
      "preview",
      "/abs/doc.qmd",
      "--no-browser",
    ]);
  });

  it("appends --to when a format is given", () => {
    expect(buildPreviewArgs("/abs/doc.qmd", { to: "pdf" })).toEqual([
      "preview",
      "/abs/doc.qmd",
      "--no-browser",
      "--to",
      "pdf",
    ]);
  });

  it("omits --to for an empty or whitespace format", () => {
    expect(buildPreviewArgs("/abs/doc.qmd", { to: "  " })).toEqual([
      "preview",
      "/abs/doc.qmd",
      "--no-browser",
    ]);
  });

  it("does not shell-split a path containing spaces (argv, not a string)", () => {
    expect(buildPreviewArgs("/a b/doc.qmd", { to: "html" })).toEqual([
      "preview",
      "/a b/doc.qmd",
      "--no-browser",
      "--to",
      "html",
    ]);
  });
});
