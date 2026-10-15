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

  // `scratchpad/s308/g18ex` and `g18ne`, `p04_front_echoF_listed_chunk_call` (and `p06`, the same chunk in a block quote). A chunk inside a list item or a quote is never judged, but a call in
  // its body still counted as an unreadable default when the document executes: the call runs, sets `echo = TRUE`, and `Between` is swallowed. Under `--no-execute` it never runs, the front
  // matter's `echo: false` stands, the chunk below is silent and quarto lists `Between`.
  const LISTED_CALL = [
    "---", "title: t", "execute:", "  echo: false", "---", "", "- item", "", "  ```{r}", "  knitr::opts_chunk$set(echo = TRUE)", "  ```", "", "# Top", "", "```", "", "## Between", "", "```{r}", "x <- 1", "```", "",
    "## Mid", "", "```{r}", "y <- 2", "```", "", "## After", "", "## Last", "",
  ].join("\n");
  it("a call in an unjudged (listed or quoted) chunk's body does not run, so the front matter's silence stands", () => {
    expect(headings(LISTED_CALL, "no-execute")).toEqual(["Top", "Between", "Mid", "After", "Last"]);
    expect(headings(LISTED_CALL, "execute")).toEqual(["Top", "Mid", "After", "Last"]);
  });
});

describe("Session 310 — code that WRITES a fence writes nothing under --no-execute", () => {
  // Rendered with quarto 1.7.33 (knitr 1.51), exit 0, both ways (`scratchpad/s307/g3ex` and `g3ne`, `b04_echoF_asis_cat_fence`). A chunk whose options hide its code but whose code writes a
  // fence line (`results = "asis"` and `cat("```...")`) emits that fence when it runs, so the executing reading keeps it `uncertain` (it may end a swallow, never open one). Under
  // `--no-execute` it emits nothing, the chunk is as silent as any other, and the stray fence pairs with the closer of the loud chunk below, which swallows `Between` AND `After`.
  const WRITES_A_FENCE = [
    "---", "title: t", "---", "", "```{r src, include=FALSE}", "z <- 3", "```", "", "# Top", "", "```", "", "## Between", "", '```{r, echo=FALSE, results="asis"}', 'cat("```\\nx\\n```\\n")', "```", "",
    "## After", "", "", "```{r}", "y <- 1", "```", "", "## Last", "",
  ].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);

  it("is silent, so the stray fence swallows what quarto swallows", () => {
    expect(headings(WRITES_A_FENCE, "no-execute")).toEqual(["Top", "Last"]);
  });
  // HEAD's answer, unchanged by the mode argument: a phantom `After` (quarto lists `Top`, `Last` when executing too, because the stray fence pairs with the fence the chunk writes).
  it("executing, the answer is the one the model has always given", () => {
    expect(headings(WRITES_A_FENCE, "execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(WRITES_A_FENCE)).toEqual(["Top", "After", "Last"]);
  });
});

describe("Session 310 — code a setup chunk runs does not reach a chunk under --no-execute", () => {
  // Rendered with quarto 1.7.33 (knitr 1.51), exit 0, both ways (`scratchpad/s307/g3ex` and `g3ne`, `a01_optschunk_ref_label`). A setup call `opts_chunk$set(ref.label = "src")` hands the
  // code of `src` to EVERY chunk, so the empty `{r}` chunk below it echoes a fence when the document executes (the stray fence pairs with it and only `Between` is swallowed); under
  // `--no-execute` the call never runs, the chunk stays empty and silent, and the stray fence pairs with the closer of the chunk after it, swallowing `After` too.
  const REF_LABEL_CALL = [
    "---", "title: t", "---", "", "```{r src, include=FALSE}", "z <- 3", "```", "", "```{r setup, include=FALSE}", 'knitr::opts_chunk$set(ref.label = "src")', "```", "", "# Top", "", "```", "", "## Between", "",
    "```{r}", "```", "", "## After", "", "", "```{r}", "y <- 1", "```", "", "## Last", "",
  ].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);

  it("an `opts_chunk` call that supplies code supplies none: the empty chunk is silent", () => {
    expect(headings(REF_LABEL_CALL, "no-execute")).toEqual(["Top", "Last"]);
  });
  it("executing, the call supplies the code and the empty chunk is not silent: unchanged", () => {
    expect(headings(REF_LABEL_CALL, "execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(REF_LABEL_CALL)).toEqual(["Top", "After", "Last"]);
  });

  // `scratchpad/s307/g3ex` and `g3ne`, `a06_read_chunk_lbl`: `read_chunk("_lbl.R")` fills the LABELLED empty chunk `lbl` when it runs; under `--no-execute` it does not.
  const READ_CHUNK_CALL = [
    "---", "title: t", "---", "", "```{r src, include=FALSE}", "z <- 3", "```", "", "```{r setup, include=FALSE}", 'knitr::read_chunk("_lbl.R")', "```", "", "# Top", "", "```", "", "## Between", "",
    "```{r lbl}", "```", "", "## After", "", "", "```{r}", "y <- 1", "```", "", "## Last", "",
  ].join("\n");
  it("a `read_chunk` call fills nothing: the labelled empty chunk is silent", () => {
    expect(headings(READ_CHUNK_CALL, "no-execute")).toEqual(["Top", "Last"]);
    expect(headings(READ_CHUNK_CALL, "execute")).toEqual(["Top", "After", "Last"]);
  });
});
