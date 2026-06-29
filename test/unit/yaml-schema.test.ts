import { describe, expect, it } from "vitest";
import { CURATED_CELL_OPTIONS } from "../../src/core/yaml-schema";

/**
 * CURATED_CELL_OPTIONS is the permanent fallback set the YAML completion provider
 * serves (and that the future runtime schema reader, 6d-3, degrades to). These
 * guard the data contract the provider depends on — not "imagined behavior".
 */
describe("CURATED_CELL_OPTIONS — data contract", () => {
  it("is a non-empty set of well-formed fields (name + description)", () => {
    expect(CURATED_CELL_OPTIONS.length).toBeGreaterThanOrEqual(15);
    for (const field of CURATED_CELL_OPTIONS) {
      expect(field.name).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/);
      expect(field.description, `${field.name} needs a description`).toBeTruthy();
    }
  });

  it("has unique names", () => {
    const names = CURATED_CELL_OPTIONS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes the highest-frequency execution options", () => {
    const names = new Set(CURATED_CELL_OPTIONS.map((f) => f.name));
    for (const expected of ["echo", "eval", "output", "warning", "label", "fig-cap"]) {
      expect(names.has(expected), `curated set should include ${expected}`).toBe(true);
    }
  });

  it("tags knitr-only options with the knitr engine", () => {
    const cache = CURATED_CELL_OPTIONS.find((f) => f.name === "cache");
    expect(cache?.engine).toBe("knitr");
  });
});
