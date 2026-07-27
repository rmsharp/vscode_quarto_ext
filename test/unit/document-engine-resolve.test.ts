import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";

/**
 * These pins are deliberately one-per-ARGUMENT. `resolveDocumentEngine` contains no logic
 * of its own — its entire job is handing `documentEngineForScoping` the right five inputs,
 * and a wrong one type-checks silently (`document-engine.ts:38-45` records that exact
 * escape). So each case below is chosen because DROPPING or SUBSTITUTING one argument
 * changes its answer; every one was confirmed by mutation, not by inspection.
 */
describe("resolveDocumentEngine — the ONE entry point both consumers call (S169)", () => {
  it("resolves knitr from the document's OWN cell languages (the S165 fallback)", () => {
    // `text` (5th argument). The case this session's completion fix hangs on, grounded
    // firsthand vs quarto 1.7.33: an `{r}` cell + a `{python}` cell carrying
    // `#| cache: banana` renders **exit 1** (`Field "cache" has value banana`), while the
    // identical document without the key renders exit 0 and the `{python}`-ONLY document
    // renders exit 0. So quarto really does scope the python cell to knitr here, and only
    // because of the other cell.
    const text = ["```{r}", "1 + 1", "```", "", "```{python}", "1 + 1", "```"].join("\n");
    expect(resolveDocumentEngine("doc.qmd", text)).toBe("knitr");
  });

  it("reads a TOP-LEVEL front-matter override, which outranks the languages", () => {
    // `findFrontMatterTopLevelLines` (2nd argument). The `{r}` cell would otherwise make
    // the fallback answer knitr, so this pin can only pass if the top-level scalars arrive.
    const text = ["---", "engine: markdown", "---", "", "```{r}", "1 + 1", "```"].join("\n");
    expect(resolveDocumentEngine("doc.qmd", text)).toBe("markdown");
  });

  it("reads the CONTAINER form of the override, not just value-bearing lines", () => {
    // Still `findFrontMatterTopLevelLines`, but specifically its `hasChildren` field —
    // the reason the 2nd argument may not be `findFrontMatterValueLines`, which carries no
    // such field and would drop this document to the language fallback (knitr). Quarto
    // tests the key for JS truthiness, and a mapping is truthy where a bare `key:` is not.
    const text = [
      "---",
      "jupyter:",
      "  kernelspec:",
      "    name: python3",
      "---",
      "",
      "```{r}",
      "1 + 1",
      "```",
    ].join("\n");
    expect(resolveDocumentEngine("doc.qmd", text)).toBe("jupyter");
  });

  it("reads the NESTED `execute:`/`  engine:` spelling", () => {
    // `findNestedFrontMatterValueLines` (3rd argument). Dropping it leaves this document
    // on the language fallback, which the `{r}` cell answers knitr.
    const text = [
      "---",
      "execute:",
      "  engine: markdown",
      "---",
      "",
      "```{r}",
      "1 + 1",
      "```",
    ].join("\n");
    expect(resolveDocumentEngine("doc.qmd", text)).toBe("markdown");
  });

  it("declines on a blank line BEFORE the opening `---` — quarto's engine partitioner is narrower", () => {
    // `frontMatterContentLines` (4th argument). Quarto's ENGINE partitioner runs
    // `lines(markdown.trimLeft())` and so still sees this front matter, while our scanner
    // opens front matter only at line 0 and sees none. Answering from the languages there
    // would claim knitr document-wide on a document whose `engine:` key we never read.
    const text = [
      "",
      "---",
      "title: t",
      "engine: markdown",
      "---",
      "",
      "```{r}",
      "1 + 1",
      "```",
    ].join("\n");
    expect(resolveDocumentEngine("doc.qmd", text)).toBeUndefined();
  });

  it("declines for an `.Rmd`, where knitr claimed the file by EXTENSION", () => {
    // `fileName` (1st argument). The same text answers knitr as a `.qmd` (first pin above).
    const text = ["```{r}", "1 + 1", "```", "", "```{python}", "1 + 1", "```"].join("\n");
    expect(resolveDocumentEngine("doc.Rmd", text)).toBeUndefined();
    expect(resolveDocumentEngine("doc.rmd", text)).toBeUndefined();
  });

  it("declines on an `{{< include >}}`, whose expansion we cannot see", () => {
    // Also `text`, but the other direction: quarto counts languages in the include-EXPANDED
    // markdown, so this file's own language set is not the one it resolves against.
    const text = ["{{< include child.qmd >}}", "", "```{r}", "1 + 1", "```"].join("\n");
    expect(resolveDocumentEngine("doc.qmd", text)).toBeUndefined();
  });

  it("answers `\"ambiguous\"` when the front matter selects more than one engine", () => {
    const text = [
      "---",
      "engine: knitr",
      "jupyter:",
      "  kernelspec:",
      "    name: python3",
      "---",
    ].join("\n");
    expect(resolveDocumentEngine("doc.qmd", text)).toBe("ambiguous");
  });
});
