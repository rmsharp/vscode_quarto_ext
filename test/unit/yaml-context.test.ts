import { describe, expect, it } from "vitest";
import { completionContextAt } from "../../src/core/yaml-context";

/** Compute a 0-based character offset for (line, col) in `\n`-joined text. */
function offsetAt(text: string, line: number, col: number): number {
  const lines = text.split("\n");
  let off = 0;
  for (let i = 0; i < line; i++) {
    off += lines[i].length + 1; // + the "\n"
  }
  return off + col;
}

describe("completionContextAt — cell-option key", () => {
  it("returns a cell-option-key context for a partially-typed key on a #| line", () => {
    const text = ["```{python}", "#| ec", "x = 1", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 5)); // after "ec"
    expect(ctx).toEqual({
      kind: "cell-option-key",
      parentPath: [],
      token: "ec",
      replaceRange: { line: 1, startCol: 3, endCol: 5 },
      engine: "jupyter",
    });
  });

  it("offers all keys (empty token) right after `#| `", () => {
    const text = ["```{python}", "#| ", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 3));
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 3, endCol: 3 });
  });

  it("replaces the WHOLE key token on a mid-token cursor (Learning #15b)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 5)); // inside "ec|ho"
    expect(ctx?.token).toBe("ec");
    // The replace span covers all of "echo" [3,7), not just up to the cursor.
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 3, endCol: 7 });
  });

  it("returns null at a VALUE position (past the colon) — that is Slice 6d-2", () => {
    const text = ["```{python}", "#| echo: ", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 9)); // after "echo: "
    expect(ctx).toBeNull();
  });

  it("returns null inside the prefix/gap, before the key slot", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 1)); // between # and |
    expect(ctx).toBeNull();
  });

  it("returns null on a plain code line inside the cell", () => {
    const text = ["```{python}", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 3))).toBeNull();
  });

  it("returns null on a prose line", () => {
    const text = ["# Heading", "", "Some prose here."].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 5))).toBeNull();
  });

  it("returns null on a sequence-item option line (no key)", () => {
    const text = ["```{python}", "#| fig-cap:", "#|   - a", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 7))).toBeNull();
  });

  it("maps the engine: {r} → knitr", () => {
    const text = ["```{r}", "#| ec", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5))?.engine).toBe("knitr");
  });

  it("maps the engine: {ojs} //| line → ojs", () => {
    const text = ["```{ojs}", "//| ec", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6))?.engine).toBe("ojs");
  });
});
