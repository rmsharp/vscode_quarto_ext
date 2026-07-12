import { describe, expect, it } from "vitest";
import {
  isRenderScript,
  isRenderScriptExtension,
} from "../../src/core/render-script";

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

  it("rejects an ordinary .r script with neither a spin header nor a percent cell", () => {
    // Pins the CONTENT half of the spin branch. Without this, `ext === ".r"`
    // alone satisfies every .r case in the battery (they are all accepts), so a
    // detector that called EVERY .r file a render script would pass the whole
    // suite. Break-revert-proven against exactly that mutant.
    const text = ["# ordinary R", "x <- 1", "summary(cars)", ""].join("\n");
    expect(isRenderScript("/tmp/analysis.r", text)).toBe(false);
    expect(isRenderScript("/tmp/ANALYSIS.R", text)).toBe(false);
  });

  it("rejects a .r whose spin header is opened but never closed", () => {
    expect(isRenderScript("/tmp/a.r", "#' ---\n#' title: T\nx <- 1\n")).toBe(
      false,
    );
  });
});

describe("isRenderScript — cost", () => {
  it("stays linear on an unclosed spin header followed by a long whitespace run", () => {
    // The spin regex's lazy [\s\S]+? must not be able to backtrack quadratically
    // against an adjacent \s*. This input is the worst case: the header opens, so
    // the branch is entered, and never closes, so every expansion is tried.
    // Shipped-before-fix cost: ~3.7 SECONDS (O(n^2)). This is not academic — the
    // detector runs on the single-threaded extension host, and Slice 2 will call
    // it on every keystroke.
    const text = "#' ---\n" + "\n".repeat(80_000);
    const started = performance.now();
    expect(isRenderScript("/tmp/analysis.r", text)).toBe(false);
    expect(performance.now() - started).toBeLessThan(100);
  });
});

describe("isRenderScriptExtension — the cheap half, for the per-keystroke path", () => {
  // The context key recomputes on EVERY keystroke of the active document
  // (`updateRenderScriptContext`). `isRenderScript(fileName, text)` takes the text
  // as an eager argument, so calling it directly forces the WHOLE buffer to be
  // materialized (`doc.getText()`) before the extension check inside it can reject
  // a file that could never be a render script anyway. `updateCellContext` — the
  // precedent this key was modelled on — avoids exactly that by short-circuiting on
  // `languageId === "quarto"` BEFORE it calls `getText()`. This exposes the same
  // cheap pre-filter so the adapter can too. (Adversarial review, Session 85.)
  it("accepts every extension the detector can ever accept", () => {
    for (const name of ["a.py", "a.jl", "a.r", "a.R", "a.PY", "/x/y/a.Py"]) {
      expect(isRenderScriptExtension(name), name).toBe(true);
    }
  });

  it("rejects everything else, WITHOUT needing the text", () => {
    for (const name of [
      "a.qmd", // quarto.preview's territory, never previewScript's
      "a.rmd",
      "a.txt",
      "a.json",
      "a.ts",
      "a", // no extension
      ".env", // dotfile: not an extension
      "",
    ]) {
      expect(isRenderScriptExtension(name), name).toBe(false);
    }
  });

  it("is a strict SUPERSET of isRenderScript — it may never reject a real script", () => {
    // The pre-filter is only sound if it can never veto a file the full detector
    // would have accepted. Anything else silently turns the key false for a real
    // render script.
    const scripts: Array<[string, string]> = [
      ["a.py", "# %% [markdown]\n"],
      ["a.jl", "# %% [raw]\n"],
      ["a.r", "# %% [markdown]\n"],
      ["a.R", "#' ---\n#' t: 1\n#' ---\n"],
      ["a.r", "#' ---\n#' t: 1\n#' ---\n"],
    ];
    for (const [name, text] of scripts) {
      expect(isRenderScript(name, text), `precondition ${name}`).toBe(true);
      expect(isRenderScriptExtension(name), `pre-filter must not veto ${name}`).toBe(
        true,
      );
    }
  });
});
