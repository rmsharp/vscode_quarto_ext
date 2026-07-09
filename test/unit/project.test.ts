import { describe, expect, it } from "vitest";
import { findProjectRoot } from "../../src/core/project";

/**
 * `findProjectRoot` walks up from `startDir` looking for `_quarto.yml` /
 * `_quarto.yaml`, bounded (inclusive) at `boundaryDir` when one is given.
 * `exists` is injected so this stays a pure, headlessly-testable function
 * (plan `docs/planning/2026-07-09-project-level-render-plan.md` §5.1).
 */
describe("findProjectRoot", () => {
  it("finds the marker at startDir itself", () => {
    const files = new Set(["/proj/_quarto.yml"]);
    const exists = (p: string) => files.has(p);
    expect(findProjectRoot("/proj", null, exists)).toBe("/proj");
  });

  it("finds the marker several levels up from a nested file's directory", () => {
    const files = new Set(["/proj/_quarto.yml"]);
    const exists = (p: string) => files.has(p);
    expect(
      findProjectRoot("/proj/chapters/deep/nested", null, exists),
    ).toBe("/proj");
  });

  it("respects the boundary — returns null even when a marker exists further up, outside it", () => {
    // e.g. an unrelated ancestor _quarto.yml outside the user's workspace folder.
    const files = new Set(["/outer/_quarto.yml"]);
    const exists = (p: string) => files.has(p);
    expect(
      findProjectRoot("/outer/workspace/sub", "/outer/workspace", exists),
    ).toBeNull();
  });

  it("recognizes _quarto.yaml when only that variant exists", () => {
    const files = new Set(["/proj/_quarto.yaml"]);
    const exists = (p: string) => files.has(p);
    expect(findProjectRoot("/proj", null, exists)).toBe("/proj");
  });

  it("prefers _quarto.yml over _quarto.yaml on a tie (quarto-cli's own order)", () => {
    // Both variants existing in the same directory is a pathological case, but
    // the discovery must still be deterministic — .yml wins (plan §2.1).
    let ymlChecked = false;
    let yamlChecked = false;
    const exists = (p: string) => {
      if (p.endsWith("_quarto.yml")) {
        ymlChecked = true;
      }
      if (p.endsWith("_quarto.yaml")) {
        yamlChecked = true;
      }
      return true; // both "exist"
    };
    findProjectRoot("/proj", null, exists);
    expect(ymlChecked).toBe(true);
    // Short-circuits on .yml, so .yaml is never even checked.
    expect(yamlChecked).toBe(false);
  });

  it("returns null and terminates when no marker exists anywhere up to the filesystem root", () => {
    const exists = () => false;
    expect(findProjectRoot("/a/b/c", null, exists)).toBeNull();
  });
});
