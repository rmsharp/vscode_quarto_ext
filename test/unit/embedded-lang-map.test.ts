import { describe, expect, it } from "vitest";
import {
  cellLanguageId,
  needsLanguageExtension,
} from "../../src/core/embedded/lang-map";

describe("cellLanguageId — engine token → embedded language target", () => {
  it("maps the {python} engine to the python languageId and .py extension", () => {
    expect(cellLanguageId("python")).toEqual({ languageId: "python", ext: "py" });
  });

  it("maps the {r} engine to the r languageId and .r extension", () => {
    expect(cellLanguageId("r")).toEqual({ languageId: "r", ext: "r" });
  });

  it("maps the {julia} engine to the julia languageId and .jl extension", () => {
    expect(cellLanguageId("julia")).toEqual({ languageId: "julia", ext: "jl" });
  });

  it("maps the {ojs} engine to the javascript languageId (token ≠ languageId) and .js extension", () => {
    expect(cellLanguageId("ojs")).toEqual({ languageId: "javascript", ext: "js" });
  });

  it("maps the {js} engine token to javascript as well (alias)", () => {
    expect(cellLanguageId("js")).toEqual({ languageId: "javascript", ext: "js" });
  });

  it("returns null for an unknown / non-code engine token", () => {
    expect(cellLanguageId("mermaid")).toBeNull();
    expect(cellLanguageId("")).toBeNull();
  });
});

describe("needsLanguageExtension — degradation signal (§9 Q6)", () => {
  it("is true when the target languageId is not among the host's registered languages", () => {
    // No R extension installed → "r" is absent from getLanguages() → hint.
    expect(needsLanguageExtension("r", ["python", "javascript"])).toBe(true);
    expect(needsLanguageExtension("julia", ["python", "javascript"])).toBe(true);
  });

  it("is false when the target languageId IS registered (a provider can serve it)", () => {
    expect(needsLanguageExtension("python", ["python", "javascript"])).toBe(false);
  });

  it("is false for javascript, which is always built-in (so {ojs} never hints)", () => {
    expect(needsLanguageExtension("javascript", ["python", "javascript"])).toBe(false);
  });
});
