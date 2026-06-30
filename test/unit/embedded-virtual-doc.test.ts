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

describe("buildVirtualContent — multi-language documents (6e-2)", () => {
  // One cell per mapped language, each body distinct; the {ojs} cell carries a
  // `//|` option line (ojs/js use `//|`, not `#|`).
  const MIXED = [
    "```{python}", // 0
    "p = 1", // 1  python body
    "```", // 2
    "```{r}", // 3
    "r_v <- 2", // 4  r body
    "```", // 5
    "```{julia}", // 6
    "j = 3", // 7  julia body
    "```", // 8
    "```{ojs}", // 9
    "//| echo: false", // 10 ojs option line
    "o = 4", // 11 ojs (javascript) body
    "```", // 12
  ].join("\n");

  it("the python vdoc keeps only python bodies, blanking r/julia/ojs", () => {
    const v = buildVirtualContent(MIXED, "python").split("\n");
    expect(v[1]).toBe("p = 1");
    expect(v[4]).toBe(" ".repeat("r_v <- 2".length));
    expect(v[7]).toBe(" ".repeat("j = 3".length));
    expect(v[11]).toBe(" ".repeat("o = 4".length));
  });

  it("the r vdoc keeps only r bodies, blanking python/julia/ojs", () => {
    const v = buildVirtualContent(MIXED, "r").split("\n");
    expect(v[4]).toBe("r_v <- 2");
    expect(v[1]).toBe(" ".repeat("p = 1".length));
    expect(v[7]).toBe(" ".repeat("j = 3".length));
    expect(v[11]).toBe(" ".repeat("o = 4".length));
  });

  it("the julia vdoc keeps only julia bodies, blanking the rest", () => {
    const v = buildVirtualContent(MIXED, "julia").split("\n");
    expect(v[7]).toBe("j = 3");
    expect(v[1]).toBe(" ".repeat("p = 1".length));
    expect(v[4]).toBe(" ".repeat("r_v <- 2".length));
  });

  it("the javascript vdoc keeps the {ojs} body and blanks its `//|` option line", () => {
    const v = buildVirtualContent(MIXED, "javascript").split("\n");
    expect(v[11]).toBe("o = 4");
    expect(v[10]).toBe(" ".repeat("//| echo: false".length));
    expect(v[1]).toBe(" ".repeat("p = 1".length));
  });

  it("keeps cross-cell same-language state: two {python} cells both survive in one python vdoc", () => {
    const text = [
      "```{python}", // 0
      "import numpy as np", // 1
      "```", // 2
      "Some prose.", // 3
      "```{python}", // 4
      "np.array([1])", // 5  cell 2 — sees cell 1's import in the SAME vdoc
      "```", // 6
    ].join("\n");
    const v = buildVirtualContent(text, "python").split("\n");
    expect(v[1]).toBe("import numpy as np");
    expect(v[5]).toBe("np.array([1])");
    expect(v[3]).toBe(" ".repeat("Some prose.".length));
  });

  it("is the identity map (length + newline positions) for every languageId of a mixed doc", () => {
    for (const lang of ["python", "r", "julia", "javascript"]) {
      const v = buildVirtualContent(MIXED, lang);
      expect(v.length).toBe(MIXED.length);
      expect(newlineIndices(v)).toEqual(newlineIndices(MIXED));
    }
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

  it("returns an r hit inside an {r} cell body (mapped in 6e-2)", () => {
    const text = ["```{r}", "y <- 2", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toEqual({
      lang: "r",
      languageId: "r",
      ext: "r",
    });
  });

  it("returns null inside a still-unmapped-engine ({bash}) cell body", () => {
    const text = ["```{bash}", "echo hi", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toBeNull();
  });

  it("returns null inside a non-executable ```python fenced block", () => {
    const text = ["```python", "x = 1", "```"].join("\n");
    expect(embeddedCellAt(text, 1)).toBeNull();
  });
});
