import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

// Session 310: the Outline can read a knitr document for `quarto render --no-execute`. The executing reading (the default) is Session 308 and 309's; every row below that names a mode
// passes it as the THIRD argument, and every document that ever drove the executing reading still has to answer the same when that argument is left out.

describe("Session 310 — a hidden-code chunk that prints, read for --no-execute", () => {
  // `[name, document, quarto's headings executing, quarto's headings under --no-execute, this model's (S309), HEAD's pre-S308]`, the tracked `cost` rows (Session 309): three printing
  // chunks under a hidden-code default with a stray fence above them. Executing, each chunk emits an output block (two bare fences) and the swallow runs through `H0` and `H1`; under
  // `--no-execute` nothing prints, nothing is fenced and quarto lists all three.
  type CostRow = [string, string, string[], string[], string[], string[]];
  const critic = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-critic/quarto-1.7.33.json"), "utf8")) as { cost: CostRow[] };
  const cost = (name: string): CostRow => {
    const row = critic.cost.find((r) => r[0] === name);
    if (row === undefined) {
      throw new Error(`no cost row ${name}`);
    }
    return row;
  };
  const noExecute = (document: string): string[] => findHeadings(document, "knitr", "no-execute").map((h) => h.text);

  it("a front-matter `echo: false` over three printing chunks lists all three headings", () => {
    const row = cost("ne_front_default");
    expect(noExecute(row[1])).toEqual(row[3]);
  });

  // The Outline provider is re-registered when the setting changes, but the document text is NOT: `scanRegions` memoizes on the text, so a cache keyed on the text and the engine alone
  // would serve the previous mode's regions for an unchanged document and the setting would appear to do nothing.
  it("flipping the mode on UNCHANGED text answers each mode, in both directions", () => {
    const row = cost("ne_front_default");
    const executing = (): string[] => findHeadings(row[1], "knitr", "execute").map((h) => h.text);
    expect(executing()).toEqual(row[2]);
    expect(noExecute(row[1])).toEqual(row[3]);
    expect(executing()).toEqual(row[2]);
    expect(findHeadings(row[1], "knitr").map((h) => h.text)).toEqual(row[2]);
    expect(noExecute(row[1])).toEqual(row[3]);
  });
});

describe("Session 310 — a setup chunk's `opts_chunk$set()` does not run under --no-execute", () => {
  // Rendered with quarto 1.7.33 (knitr 1.51), exit 0, both ways (`scratchpad/s308/g13ex` and `g13ne`, `d02_set_echoF_abbrev`). A setup chunk's call changes the default for the chunks
  // BELOW it only when the document EXECUTES: the chunks are silent then (no fence reaches pandoc, so the stray fence above never pairs and swallows nothing), and loud under
  // `--no-execute` (each echoes its code as a fence, and the stray fence pairs with the first one, so `Between` and `After` are swallowed).
  const SETUP_CALL = [
    "---", "title: t", "---", "", "```{r setup, include=FALSE}", "knitr::opts_chunk$set(echo = F)", "```", "", "# Top", "", "```", "", "## Between", "", "```{r}", "```", "", "## After", "",
    "```{r}", "y <- 1", "```", "", "## Last", "",
  ].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);

  it("the chunks below stay loud, so the stray fence swallows what quarto swallows", () => {
    expect(headings(SETUP_CALL, "no-execute")).toEqual(["Top", "Last"]);
  });
  it("executing, the call applies and the chunks are silent: the headings the model always listed", () => {
    expect(headings(SETUP_CALL, "execute")).toEqual(["Top", "Between", "After", "Last"]);
    expect(headings(SETUP_CALL)).toEqual(["Top", "Between", "After", "Last"]);
  });

  // What RUNS under --no-execute is not nothing: a chunk's HEADER options are R expressions that knitr evaluates before it decides whether to run the chunk. Rendered both ways with the
  // SAME answer (`scratchpad/s308/rev-soundness` and `rev-soundness-ne`, `rev-soundness_14_header_expression_call`): the header's `opts_chunk$set(echo = TRUE)` turns the default back
  // on for `Between`, so the stray fence swallows it and quarto lists `Mid`. Skipping every mention made `--no-execute` trust the front matter's silence and hide `Mid`.
  const HEADER_CALL = [
    "---", 'title: "header call"', "execute:", "  echo: false", "---", "", "```{r setup, include = is.null(knitr::opts_chunk$set(echo = TRUE))}", "invisible(NULL)", "```", "", "# Top", "", "```", "",
    "## Between", "", "```{r}", "x <- 1", "```", "", "## Mid", "", "```{r, echo=TRUE}", "y <- 2", "```", "", "## After", "", "Text after.", "", "## Last", "", "Final text.", "",
  ].join("\n");
  it("a call in a chunk HEADER still runs, and still drops the front matter's silence below it", () => {
    expect(headings(HEADER_CALL, "no-execute")).toEqual(["Top", "Mid", "After", "Last"]);
    expect(headings(HEADER_CALL, "execute")).toEqual(["Top", "Mid", "After", "Last"]);
  });
});
