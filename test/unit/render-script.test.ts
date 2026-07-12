import { describe, expect, it } from "vitest";
import { isRenderScript } from "../../src/core/render-script";

describe("isRenderScript — Jupyter percent scripts (path A)", () => {
  it("accepts a .py whose first non-blank line is a `# %% [markdown]` cell", () => {
    const text = ["# %% [markdown]", "# Hello", "", "# %%", "x = 1", ""].join(
      "\n",
    );
    expect(isRenderScript("/tmp/report.py", text)).toBe(true);
  });

  it("rejects a percent cell in a file whose extension Quarto never claims", () => {
    const text = ["# %% [markdown]", "# Hello", ""].join("\n");
    expect(isRenderScript("/tmp/notes.txt", text)).toBe(false);
  });
});

describe("isRenderScript — knitr spin scripts (path B)", () => {
  it("accepts a .r whose roxygen `#' ---` header delimits front matter", () => {
    const text = [
      "#' ---",
      "#' title: Spin",
      "#' format: html",
      "#' ---",
      "",
      "#' ## A heading",
      "summary(cars)",
      "",
    ].join("\n");
    expect(isRenderScript("/tmp/spin.r", text)).toBe(true);
  });
});

// The remaining §5.2 cases are locked as a battery after the three genuine REDs
// above. The two DISCRIMINATOR cases below are the only ones that distinguish
// this detector from a verbatim copy of Quarto's own (buggy) percent regex, so
// they are break-revert-proven against it — see the suite note at the bottom.
describe("isRenderScript — behavior lock (plan §5.2 battery)", () => {
  const SPIN_HEADER = ["#' ---", "#' title: S", "#' ---", "", "1 + 1", ""].join(
    "\n",
  );

  it("accepts a `# %% [raw]` first cell (.jl)", () => {
    expect(isRenderScript("/tmp/a.jl", "# %% [raw]\nstuff\n")).toBe(true);
  });

  it("accepts leading blank lines before the first percent cell", () => {
    expect(isRenderScript("/tmp/a.r", "\n\n# %% [markdown]\n# Hi\n")).toBe(true);
  });

  it("matches the extension case-insensitively, as Quarto does", () => {
    expect(isRenderScript("/tmp/A.PY", "# %% [markdown]\n# Hi\n")).toBe(true);
    expect(isRenderScript("/tmp/SPIN.R", SPIN_HEADER)).toBe(true);
  });

  it("does not spin a .py — the knitr engine only claims R", () => {
    expect(isRenderScript("/tmp/a.py", SPIN_HEADER)).toBe(false);
  });

  it("rejects a code cell first with the markdown cell only later (CLI agrees)", () => {
    const text = "# %%\nx = 1\n\n# %% [markdown]\n# Hi\n";
    expect(isRenderScript("/tmp/a.py", text)).toBe(false);
  });

  it("DISCRIMINATOR: rejects a code cell first with a `[raw]` cell only later", () => {
    // Quarto's own regex says TRUE here — its unanchored `raw]` branch matches
    // the later cell. We deliberately diverge (plan §5.2 option (ii)).
    const text = "# %%\nx = 1\n\n# %% [raw]\nhi\n";
    expect(isRenderScript("/tmp/a.py", text)).toBe(false);
  });

  it("DISCRIMINATOR: rejects ordinary code that merely contains `raw]`", () => {
    // Quarto's own regex says TRUE here too — the same unanchored branch matches
    // a bare substring anywhere in the file. This is the case that would hijack
    // the Slice-2 context key on ordinary Python/R/Julia.
    const text = "import numpy\narr = data[raw]\nprint(arr)\n";
    expect(isRenderScript("/tmp/a.py", text)).toBe(false);
  });

  it("rejects extensions Quarto never claims as scripts", () => {
    const text = "# %% [markdown]\n# Hi\n";
    expect(isRenderScript("/tmp/a.qmd", text)).toBe(false);
    expect(isRenderScript("/tmp/a.txt", text)).toBe(false);
  });

  it("is total on empty, whitespace-only, and extension-less input", () => {
    expect(isRenderScript("/tmp/a.py", "")).toBe(false);
    expect(isRenderScript("/tmp/a.py", "   \n\n\t\n")).toBe(false);
    expect(isRenderScript("Untitled-1", "# %% [markdown]\n")).toBe(false);
    expect(isRenderScript("", "# %% [markdown]\n")).toBe(false);
  });
});
