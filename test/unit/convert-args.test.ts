import { describe, expect, it } from "vitest";
import {
  buildConvertArgs,
  deriveConvertOutputPath,
  inferConvertDirection,
} from "../../src/core/convert-args";

describe("inferConvertDirection", () => {
  it("infers toIpynb for a .qmd input", () => {
    expect(inferConvertDirection("/abs/doc.qmd")).toBe("toIpynb");
  });

  it("infers toQmd for a .ipynb input", () => {
    expect(inferConvertDirection("/abs/doc.ipynb")).toBe("toQmd");
  });

  it("returns null for an input with neither extension", () => {
    expect(inferConvertDirection("/abs/doc.md")).toBeNull();
  });
});

describe("deriveConvertOutputPath", () => {
  it("swaps .qmd for .ipynb in the same directory", () => {
    expect(deriveConvertOutputPath("/abs/doc.qmd", "toIpynb")).toBe(
      "/abs/doc.ipynb",
    );
  });

  it("swaps .ipynb for .qmd in the same directory", () => {
    expect(deriveConvertOutputPath("/abs/doc.ipynb", "toQmd")).toBe(
      "/abs/doc.qmd",
    );
  });

  it("preserves a basename containing dots", () => {
    expect(
      deriveConvertOutputPath("/abs/my.analysis.qmd", "toIpynb"),
    ).toBe("/abs/my.analysis.ipynb");
  });
});

describe("buildConvertArgs", () => {
  it("builds argv for quarto convert <input> --output <output>", () => {
    expect(buildConvertArgs("/abs/doc.qmd", "/abs/doc.ipynb")).toEqual([
      "convert",
      "/abs/doc.qmd",
      "--output",
      "/abs/doc.ipynb",
    ]);
  });
});
