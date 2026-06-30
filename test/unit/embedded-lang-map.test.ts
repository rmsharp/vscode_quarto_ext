import { describe, expect, it } from "vitest";
import { cellLanguageId } from "../../src/core/embedded/lang-map";

describe("cellLanguageId — engine token → embedded language target", () => {
  it("maps the {python} engine to the python languageId and .py extension", () => {
    expect(cellLanguageId("python")).toEqual({ languageId: "python", ext: "py" });
  });

  it("returns null for r and julia — deferred to slice 6e-2 (not mapped in 6e-1)", () => {
    expect(cellLanguageId("r")).toBeNull();
    expect(cellLanguageId("julia")).toBeNull();
    expect(cellLanguageId("ojs")).toBeNull();
  });

  it("returns null for an unknown / non-code engine token", () => {
    expect(cellLanguageId("mermaid")).toBeNull();
    expect(cellLanguageId("")).toBeNull();
  });
});
