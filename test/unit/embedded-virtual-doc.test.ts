import { describe, expect, it } from "vitest";
import {
  buildVirtualContent,
  embeddedCellAt,
} from "../../src/core/embedded/virtual-doc";

/** Indices of every `\n` in `s` — the newline-position invariant for identity mapping. */
function newlineIndices(s: string): number[] {
  const idx: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n") {
      idx.push(i);
    }
  }
  return idx;
}

const DOC = [
  "---", // 0  front matter
  "title: Demo", // 1
  "---", // 2
  "", // 3
  "Some prose.", // 4
  "", // 5
  "```{python}", // 6  opening fence
  "#| echo: false", // 7  cell-option line
  "import pandas as pd", // 8  python body
  "x = 1", // 9  python body
  "```", // 10 closing fence
  "", // 11
  "More prose.", // 12
].join("\n");

describe("buildVirtualContent — length-preserving per-language blanking", () => {
  it("keeps only {python} body lines verbatim, blanking everything else", () => {
    const v = buildVirtualContent(DOC, "python").split("\n");
    expect(v[8]).toBe("import pandas as pd");
    expect(v[9]).toBe("x = 1");
    // Front matter, prose, fences, and the `#|` option line are blanked to
    // equal-length space runs.
    expect(v[1]).toBe(" ".repeat("title: Demo".length));
    expect(v[4]).toBe(" ".repeat("Some prose.".length));
    expect(v[6]).toBe(" ".repeat("```{python}".length));
    expect(v[7]).toBe(" ".repeat("#| echo: false".length));
    expect(v[10]).toBe(" ".repeat("```".length));
    expect(v[12]).toBe(" ".repeat("More prose.".length));
  });

  it("is the identity map: same length and same newline positions as the source", () => {
    const v = buildVirtualContent(DOC, "python");
    expect(v.length).toBe(DOC.length);
    expect(newlineIndices(v)).toEqual(newlineIndices(DOC));
  });

  it("stays length/newline-preserving on a CRLF document (built from raw text)", () => {
    const crlf = ["```{python}", "x = 1", "```"].join("\r\n");
    const v = buildVirtualContent(crlf, "python");
    expect(v.length).toBe(crlf.length);
    expect(newlineIndices(v)).toEqual(newlineIndices(crlf));
    // The kept body line is verbatim, including its trailing CR.
    expect(v.split("\n")[1]).toBe("x = 1\r");
  });

  it("blanks an {r} cell's body in the python virtual document (other-language)", () => {
    const text = [
      "```{r}", // 0
      "y <- 2", // 1  r body — must be blanked in the python vdoc
      "```", // 2
      "```{python}", // 3
      "z = 3", // 4  python body — kept
      "```", // 5
    ].join("\n");
    const v = buildVirtualContent(text, "python").split("\n");
    expect(v[1]).toBe(" ".repeat("y <- 2".length));
    expect(v[4]).toBe("z = 3");
  });
});

describe("embeddedCellAt — the cursor body-gate", () => {
  it("returns a python hit on an interior body line", () => {
    expect(embeddedCellAt(DOC, 8)).toEqual({
      lang: "python",
      languageId: "python",
      ext: "py",
    });
  });

  it("returns null on the opening and closing fence lines (inclusive cell)", () => {
    expect(embeddedCellAt(DOC, 6)).toBeNull(); // ```{python}
    expect(embeddedCellAt(DOC, 10)).toBeNull(); // ```
  });

  it("returns null on a `#|` cell-option line (belongs to the YAML provider)", () => {
    expect(embeddedCellAt(DOC, 7)).toBeNull();
  });

  it("returns null on prose, blank, and front-matter lines", () => {
    expect(embeddedCellAt(DOC, 1)).toBeNull(); // front matter
    expect(embeddedCellAt(DOC, 4)).toBeNull(); // prose
    expect(embeddedCellAt(DOC, 11)).toBeNull(); // blank
  });

  it("returns null inside an unmapped-language ({r}) cell body — deferred to 6e-2", () => {
    const text = ["```{r}", "y <- 2", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toBeNull();
  });

  it("returns null inside a non-executable ```python fenced block", () => {
    const text = ["```python", "x = 1", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toBeNull();
  });
});
