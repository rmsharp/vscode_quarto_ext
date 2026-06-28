import { describe, expect, it } from "vitest";
import {
  buildCellSnippet,
  delegateCommandsFor,
  pickDelegate,
} from "../../src/core/execution-delegate";

describe("delegateCommandsFor", () => {
  it("maps python to the Jupyter interactive-selection command", () => {
    expect(delegateCommandsFor("python")).toEqual([
      "jupyter.execSelectionInteractive",
    ]);
  });

  it("maps r to the R extension's runSelection command", () => {
    expect(delegateCommandsFor("r")).toEqual(["r.runSelection"]);
  });

  it("maps julia to the Julia extension's code-block command", () => {
    expect(delegateCommandsFor("julia")).toEqual([
      "language-julia.executeCodeBlockOrSelection",
    ]);
  });

  it("is case- and whitespace-insensitive on the language", () => {
    expect(delegateCommandsFor("  Python ")).toEqual([
      "jupyter.execSelectionInteractive",
    ]);
  });

  it("returns no candidates for a language with no known delegate", () => {
    expect(delegateCommandsFor("ojs")).toEqual([]);
    expect(delegateCommandsFor("bash")).toEqual([]);
  });
});

describe("pickDelegate", () => {
  it("picks the candidate command that is actually registered", () => {
    expect(
      pickDelegate("python", ["jupyter.execSelectionInteractive", "other.cmd"]),
    ).toBe("jupyter.execSelectionInteractive");
  });

  it("returns null when no candidate command is registered", () => {
    expect(pickDelegate("python", ["some.unrelated.command"])).toBeNull();
    expect(pickDelegate("python", [])).toBeNull();
  });

  it("returns null for a language with no known delegate, even if commands exist", () => {
    expect(pickDelegate("ojs", ["jupyter.execSelectionInteractive"])).toBeNull();
  });

  it("respects candidate preference order", () => {
    // A hypothetical multi-candidate language picks the first available one.
    expect(pickDelegate("r", ["x", "r.runSelection", "y"])).toBe(
      "r.runSelection",
    );
  });
});

describe("buildCellSnippet", () => {
  it("builds an empty fenced cell of the given language", () => {
    expect(buildCellSnippet("python")).toBe("```{python}\n\n```\n");
  });

  it("defaults to python when the language is blank", () => {
    expect(buildCellSnippet("")).toBe("```{python}\n\n```\n");
    expect(buildCellSnippet("   ")).toBe("```{python}\n\n```\n");
  });
});
