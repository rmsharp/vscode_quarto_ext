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

  it("returns null on an INDENTED `#|` line (Quarto treats it as code)", () => {
    const text = ["```{python}", "  #| ec", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 7))).toBeNull();
  });
});

describe("completionContextAt — cell-option value (6d-2)", () => {
  it("returns a value context at an empty value position (`#| echo: `)", () => {
    const text = ["```{python}", "#| echo: ", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 9)); // after "echo: "
    expect(ctx).toEqual({
      kind: "cell-option-value",
      parentPath: ["echo"], // the key being valued
      token: "",
      replaceRange: { line: 1, startCol: 9, endCol: 9 },
      engine: "jupyter",
    });
  });

  it("fires right after the colon with no space yet (`:` trigger, `#| echo:`)", () => {
    const text = ["```{python}", "#| echo:", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 8)); // right after ":"
    expect(ctx?.kind).toBe("cell-option-value");
    expect(ctx?.parentPath).toEqual(["echo"]);
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 8, endCol: 8 });
  });

  it("replaces the WHOLE value token on a mid-value cursor (`#| echo: false`)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 11)); // inside "fa|lse"
    expect(ctx?.kind).toBe("cell-option-value");
    expect(ctx?.token).toBe("fa");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 9, endCol: 14 });
  });

  it("maps the engine on a value position: {r} → knitr", () => {
    const text = ["```{r}", "#| eval: ", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 9))?.engine).toBe("knitr");
  });

  it("stays a KEY context (not value) when the cursor is at the colon", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    // col 7 = end of "echo", at the colon: still the key slot, not a value.
    expect(completionContextAt(text, offsetAt(text, 1, 7))?.kind).toBe("cell-option-key");
  });

  it("returns null in the whitespace gap between the colon and the value", () => {
    const text = ["```{python}", "#| echo:   false", "```"].join("\n");
    // col 9 sits in the run of spaces before "false" (value starts at col 11).
    expect(completionContextAt(text, offsetAt(text, 1, 9))).toBeNull();
  });

  it("returns null when the cursor is inside a trailing inline comment", () => {
    const text = ["```{python}", "#| echo: false  # comment", "```"].join("\n");
    // col 18 is inside the comment; the value span ends at "false" (col 14).
    expect(completionContextAt(text, offsetAt(text, 1, 18))).toBeNull();
  });
});

describe("completionContextAt — front-matter key (6d-4)", () => {
  it("returns a frontmatter-key context for a partially-typed top-level key", () => {
    const text = ["---", "title: x", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 2)); // inside "ti|tle"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: [],
      token: "ti",
      replaceRange: { line: 1, startCol: 0, endCol: 5 }, // covers all of "title"
    });
  });

  it("offers all keys (empty token) on a blank front-matter line", () => {
    const text = ["---", "title: x", "", "format: html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 0));
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 2, startCol: 0, endCol: 0 });
  });

  it("completes a bare key still being typed (no colon yet)", () => {
    const text = ["---", "titl", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 4));
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.token).toBe("titl");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 4 });
  });

  it("replaces the WHOLE key token on a mid-token cursor (Learning #15b)", () => {
    const text = ["---", "format: html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 3)); // inside "for|mat"
    expect(ctx?.token).toBe("for");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 6 });
  });

  it("returns null past the colon (a value position — 6d-5, not this slice)", () => {
    const text = ["---", "title: My Doc", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 9))).toBeNull(); // in "My Doc"
  });

  it("returns null on an INDENTED (nested) key line — deferred to 6d-6", () => {
    const text = ["---", "execute:", "  enabled: false", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4))).toBeNull(); // inside "enabled"
  });

  it("returns null on a block-sequence item line (`- value`)", () => {
    const text = ["---", "bibliography:", "- a.bib", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 3))).toBeNull();
  });

  it("returns null on a YAML comment line in front matter", () => {
    const text = ["---", "# a comment", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 3))).toBeNull();
  });

  it("returns null on the `---` fence lines themselves", () => {
    const text = ["---", "title: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 0, 0))).toBeNull();
    expect(completionContextAt(text, offsetAt(text, 2, 0))).toBeNull();
  });
});
