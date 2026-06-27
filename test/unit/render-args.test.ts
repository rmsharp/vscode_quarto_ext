import { describe, expect, it } from "vitest";
import { buildRenderArgs, parseOutputPath } from "../../src/core/render-args";

describe("buildRenderArgs", () => {
  it("renders a file with no options", () => {
    expect(buildRenderArgs("/abs/doc.qmd")).toEqual(["render", "/abs/doc.qmd"]);
  });

  it("appends --to when a format is given", () => {
    expect(buildRenderArgs("/abs/doc.qmd", { to: "pdf" })).toEqual([
      "render",
      "/abs/doc.qmd",
      "--to",
      "pdf",
    ]);
  });

  it("omits --to for an empty or whitespace format", () => {
    expect(buildRenderArgs("/abs/doc.qmd", { to: "  " })).toEqual([
      "render",
      "/abs/doc.qmd",
    ]);
  });

  it("does not shell-split paths containing spaces (argv, not a string)", () => {
    expect(buildRenderArgs("/abs/my doc.qmd")).toEqual([
      "render",
      "/abs/my doc.qmd",
    ]);
  });
});

describe("parseOutputPath", () => {
  it("extracts the path from the real 1.7.33 success line", () => {
    // Captured live this session; the marker is emitted on STDERR.
    const stderr = [
      "metadata",
      "  title: Quarto Grammar Fixture",
      "",
      "Output created: sample.html",
      "",
    ].join("\n");
    expect(parseOutputPath(stderr)).toBe("sample.html");
  });

  it("tolerates surrounding ANSI color escapes", () => {
    expect(parseOutputPath("\x1b[1mOutput created: out.html\x1b[22m")).toBe(
      "out.html",
    );
  });

  it("returns the last match for a multi-format render", () => {
    const out = "Output created: doc.html\nOutput created: doc.pdf\n";
    expect(parseOutputPath(out)).toBe("doc.pdf");
  });

  it("preserves relative subdirectory paths verbatim", () => {
    expect(parseOutputPath("Output created: _site/index.html")).toBe(
      "_site/index.html",
    );
  });

  it("returns null when the success marker is absent (e.g. a failed render)", () => {
    // The real missing-Jupyter stderr captured live this session.
    const stderr =
      "Starting python3 kernel..." +
      "ModuleNotFoundError: No module named 'nbformat'\n" +
      "Jupyter is not available in this Python installation.";
    expect(parseOutputPath(stderr)).toBeNull();
  });
});
