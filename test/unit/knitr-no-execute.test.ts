import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOutline, findAllCells, findHeadings, type OutlineSymbol } from "../../src/core/qmd/model";

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
  // BELOW it only when the document EXECUTES: the chunks are silent then (no fence reaches pandoc, so the stray fence above never pairs and swallows nothing). Under `--no-execute` the
  // call never runs: the empty first `{r}` chunk still emits nothing, but the second echoes its code as a fence, and the stray fence pairs with THAT fence's closer, so `Between`
  // AND `After` are swallowed. (`echo = F`, the abbreviation, is read as `unsure` when executing: the chunks then end a swallow early, which is the answer this row has always had.)
  const SETUP_CALL = [
    "---", "title: t", "---", "", "```{r setup, include=FALSE}", "knitr::opts_chunk$set(echo = F)", "```", "", "# Top", "", "```", "", "## Between", "", "```{r}", "```", "", "## After", "",
    "```{r}", "y <- 1", "```", "", "## Last", "",
  ].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);

  it("the chunks below stay loud, so the stray fence swallows what quarto swallows", () => {
    expect(headings(SETUP_CALL, "no-execute")).toEqual(["Top", "Last"]);
  });
  it("executing, the call applies: the headings the model always listed", () => {
    expect(headings(SETUP_CALL, "execute")).toEqual(["Top", "Between", "After", "Last"]);
    expect(headings(SETUP_CALL)).toEqual(["Top", "Between", "After", "Last"]);
  });
  // The two common spellings (`scratchpad/s308/g13ex` and `g13ne`, `d01_set_echoF` and `d03_set_includeF`, rendered both ways): the call is CERTAIN silence when executing, which the
  // abbreviation above is not, so these rows pin the guard on the kind (`exec`) the other row never reaches (the critic's T07).
  it.each(["echo = FALSE", "include = FALSE"])("the call opts_chunk$set(%s) does not apply either", (call) => {
    const document = SETUP_CALL.replace("echo = F)", call + ")");
    expect(headings(document, "no-execute")).toEqual(["Top", "Last"]);
    expect(headings(document, "execute")).toEqual(["Top", "Between", "After", "Last"]);
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
  // `p06_front_echoF_quoted_chunk_call`: the same call in a chunk inside a block quote.
  const QUOTED_CALL = [
    "---", "title: t", "execute:", "  echo: false", "---", "", "> ```{r}", "> knitr::opts_chunk$set(echo = TRUE)", "> ```", "", "# Top", "", "```", "", "## Between", "", "```{r}", "x <- 1", "```", "",
    "## Mid", "", "```{r}", "y <- 2", "```", "", "## After", "", "## Last", "",
  ].join("\n");
  it.each([["listed", LISTED_CALL], ["quoted", QUOTED_CALL]])("a call in an unjudged (%s) chunk's body does not run, so the front matter's silence stands", (_kind, document) => {
    expect(headings(document, "no-execute")).toEqual(["Top", "Between", "Mid", "After", "Last"]);
    expect(headings(document, "execute")).toEqual(["Top", "Mid", "After", "Last"]);
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
  // HEAD's answer, unchanged by the mode argument: a phantom `After` (quarto lists `Top`, `Last` when executing too, because the stray fence pairs with the fence the chunk writes). This control
  // cannot tell a guard that LEAKED into the executing reading from an executing reading that was later FIXED; the fixture pin (`knitr-no-execute-fixture.test.ts`) holds the default byte-identical.
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

describe("Session 310 — a document-level `echo: false` silences the shell-like engines under --no-execute", () => {
  // Rendered with quarto 1.7.33 (knitr 1.51), exit 0, both ways (`scratchpad/s310/ga-ex` and `ga-ne`, `s12_<engine>_front_echoF`; Session 287's comment recorded the split, the renders were
  // not on disk). The front matter's `echo: false` hides every chunk's code, and with nothing running nothing prints either: the chunk is silent, and so is the `{r}` chunk below it, so
  // the stray fence pairs with nothing and quarto lists all four headings. When the chunk RUNS, `bash`, `sh`, `zsh`, `perl` and `ruby` still print their output as a block (two bare
  // fences), which closes the stray fence at its first one, so `Between` is swallowed: the executing reading is unchanged (`KNITR_DOC_ECHO_ENGINES`).
  const SHELL_CODE: Record<string, string> = { bash: "echo hi", sh: "echo hi", zsh: "echo hi", perl: 'print "hi\\n";', ruby: 'puts "hi"' };
  const shellDocument = (engine: string): string =>
    ["---", "title: t", "execute:", "  echo: false", "---", "", "# Top", "", "```", "", "## Between", "", "```{" + engine + "}", SHELL_CODE[engine], "```", "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", ""].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);

  it.each(Object.keys(SHELL_CODE))("a {%s} chunk is silent: all four headings", (engine) => {
    expect(headings(shellDocument(engine), "no-execute")).toEqual(["Top", "Between", "After", "Last"]);
  });
  it.each(Object.keys(SHELL_CODE))("executing, a {%s} chunk still ends the swallow: unchanged", (engine) => {
    expect(headings(shellDocument(engine), "execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(shellDocument(engine))).toEqual(["Top", "After", "Last"]);
  });
});

describe("Session 310 — a child= chunk emits nothing under --no-execute", () => {
  // Rendered with quarto 1.7.33 (knitr 1.51), exit 0, both ways (`scratchpad/s310/gb-ex` and `gb-ne`, 12 documents: five children (an echoed chunk, a printing chunk, a plain fence, a quiet
  // chunk, plain text) each with the default options and with `echo=FALSE`, plus the echoing child with `include=FALSE` and with the `#| child:` spelling). The child document is NOT knit when
  // nothing executes, so the chunk emits no fence at all, whatever its options say and whatever the child holds: quarto lists `Top` and `Last` in all 12 (the stray fence pairs with the loud
  // chunk below). The model cannot see the child, so the four option spellings below run once. Executing, the child's own chunks are knit, so the model cannot tell (`uncertain`, as it has
  // always said); it answers `Top`, `After`, `Last` for the default options, as it did before this session.
  const childDocument = (chunk: string): string =>
    ["---", "title: t", "---", "", "# Top", "", "```", "", "## Between", "", chunk, "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", ""].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);
  const CHUNKS: Record<string, string> = {
    "default options": '```{r, child="_child_echo.Rmd"}\n```',
    "echo=FALSE": '```{r, child="_child_echo.Rmd", echo=FALSE}\n```',
    "the #| child: spelling": "```{r}\n#| child: _child_echo.Rmd\n```",
    "include=FALSE (a CONTROL: already silent through include, passes without the guard)": '```{r, child="_child_echo.Rmd", include=FALSE}\n```',
  };
  it.each(Object.keys(CHUNKS))("%s: silent, so the stray fence pairs with the loud chunk below", (name) => {
    expect(headings(childDocument(CHUNKS[name]), "no-execute")).toEqual(["Top", "Last"]);
  });
  it("executing, a child chunk is still `uncertain` and ends the swallow: unchanged", () => {
    expect(headings(childDocument(CHUNKS["default options"]), "execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(childDocument(CHUNKS["default options"]))).toEqual(["Top", "After", "Last"]);
  });
});

describe("Session 310 — an unknown mode is the default reading, never the other one", () => {
  // The review's finding H4: `resolveRenderMode` falls back to `execute` for anything it does not know, and the model must agree, because the non-default reading hides headings quarto
  // shows when it is wrong. The type forbids this call; a JavaScript caller (the census harness reads an environment variable, a test passes a string) is not stopped by the type.
  const DOCUMENT = [
    "---", 'title: "ne"', "execute:", "  echo: false", "---", "", "Intro.", "", "```", "", "```{r}", 'print("p0")', "```", "", "# H0", "", "```{r}", 'print("p1")', "```", "", "# H1", "", "```{r}", 'print("p2")', "```", "", "# H2", "",
  ].join("\n");
  it.each(["banana", "", "No-Execute", "no_execute", null, 0, true])("%s reads as the executing render", (mode) => {
    expect(findHeadings(DOCUMENT, "knitr", mode as never).map((h) => h.text)).toEqual(["H2"]);
  });
});

describe("Session 310 — only a knitr document reads the mode", () => {
  // `knitrSilentChunkClosers` is reached for `engine === "knitr"` alone, so every other answer (`undefined`, `ambiguous`, a Jupyter, Julia or markdown document) is the pre-Session-273
  // Outline whatever the mode says, and shares ONE cache entry per text: `scanRegions` normalises the mode before it looks the entry up. The document is the tracked `ne_front_default` cost row,
  // where the two modes differ for a knitr document (`H2` against `H0`, `H1`, `H2`). Passed on arrival (the normalisation was written with the cache), pinned by a mutant.
  const DOCUMENT = [
    "---", 'title: "ne"', "execute:", "  echo: false", "---", "", "Intro.", "", "```", "", "```{r}", 'print("p0")', "```", "", "# H0", "", "```{r}", 'print("p1")', "```", "", "# H1", "",
    "```{r}", 'print("p2")', "```", "", "# H2", "",
  ].join("\n");
  it("knitr: the two modes differ (the premise of the rows below)", () => {
    expect(findHeadings(DOCUMENT, "knitr", "execute").map((h) => h.text)).toEqual(["H2"]);
    expect(findHeadings(DOCUMENT, "knitr", "no-execute").map((h) => h.text)).toEqual(["H0", "H1", "H2"]);
  });
  it.each([undefined, "ambiguous", "jupyter", "julia", "markdown"] as const)("engine %s: both modes give the same headings from ONE cache entry", (engine) => {
    const executing = findHeadings(DOCUMENT, engine, "execute");
    const noExecute = findHeadings(DOCUMENT, engine, "no-execute");
    expect(noExecute.map((h) => h.text)).toEqual(executing.map((h) => h.text));
    expect(noExecute.map((h) => h.text)).toEqual(findHeadings(DOCUMENT, engine).map((h) => h.text));
    // The heading objects are the memoized scan's own: the same objects, so the second mode did not scan again.
    expect(noExecute[0]).toBe(executing[0]);
  });
});

describe("Session 310 — an option given as a `#|` expression still runs under --no-execute", () => {
  // Rendered with quarto 1.7.33 (knitr 1.51), exit 0, both ways with the SAME answer (`scratchpad/s310/ga-ex` and `ga-ne`, `e01_pipe_expr_include`, `e02_pipe_expr_echo_later_chunk`; the
  // header spelling is `e03` and the Session 308 `rev-soundness_14`): an option written as `!expr` is evaluated before knitr decides whether to run the chunk, so a call inside it sets
  // the default for the chunks below even when nothing executes, and the front matter's silence is NOT trusted below it. Passed on arrival (the `#|` clause shares the header's helper).
  // The layout of the rendered grid: the chunk under test sits BELOW the stray fence, and the `{r}` chunk after `After` is echoed only if the expression turned the default back on.
  const pipeDocument = (option: string): string =>
    ["---", "title: t", "execute:", "  echo: false", "---", "", "# Top", "", "```", "", "## Between", "", "```{r}", option, "invisible(NULL)", "```", "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", ""].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);

  it("`#| include: !expr` that calls opts_chunk$set: the same answer in both modes", () => {
    const document = pipeDocument("#| include: !expr is.null(knitr::opts_chunk$set(echo = TRUE))");
    expect(headings(document, "no-execute")).toEqual(["Top", "Last"]);
    expect(headings(document, "execute")).toEqual(["Top", "Last"]);
  });
  // Passes with or without the `#|` clause (the chunk's own unreadable `echo` makes it loud either way, so what follows cannot matter): a control for the same answer in both modes, not a pin.
  it("`#| echo: !expr` that calls opts_chunk$set: the same answer in both modes", () => {
    const document = pipeDocument("#| echo: !expr knitr::opts_chunk$set(echo = TRUE)");
    expect(headings(document, "no-execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(document, "execute")).toEqual(["Top", "After", "Last"]);
  });
});

describe("Session 310 — what the review found unpinned", () => {
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);
  const names = (nodes: readonly OutlineSymbol[]): string[] => nodes.flatMap((n) => [n.name, ...names(n.children)]);
  // The tracked `ne_front_default` cost row: executing lists `H2`, `--no-execute` lists all three.
  const COST = [
    "---", 'title: "ne"', "execute:", "  echo: false", "---", "", "Intro.", "", "```", "", "```{r}", 'print("p0")', "```", "", "# H0", "", "```{r}", 'print("p1")', "```", "", "# H1", "", "```{r}", 'print("p2")', "```", "", "# H2", "",
  ].join("\n");

  // The Outline and Go to Symbol in Workspace call `buildOutline`, not `findHeadings`: the unit rows above only reach the second (the reviewer's H3 and T05).
  it("buildOutline carries the mode to the regions it builds the tree from", () => {
    expect(names(buildOutline(COST, "knitr", "no-execute")).filter((n) => /^H\d$/.test(n))).toEqual(["H0", "H1", "H2"]);
    expect(names(buildOutline(COST, "knitr", "execute")).filter((n) => /^H\d$/.test(n))).toEqual(["H2"]);
    expect(names(buildOutline(COST, "knitr")).filter((n) => /^H\d$/.test(n))).toEqual(["H2"]);
  });

  // The engine-blind callers (`findAllCells`, `inFrontMatter`, completion) pass no engine and no mode, and the Outline passes both: they must keep separate entries, or each call evicts the
  // other (the reviewer's H10). The returned heading objects are the memoized scan's own, so identity shows the knitr entry survived the blind call.
  it("an engine-blind call between two no-execute reads does not evict the knitr entry", () => {
    const first = findHeadings(COST, "knitr", "no-execute");
    findAllCells(COST);
    const second = findHeadings(COST, "knitr", "no-execute");
    expect(second[0]).toBe(first[0]);
  });

  // The `child=` guard covers every engine the rule trusts (the reviewer's T01 asked what pinned its edge; the answer was a render). Rendered with quarto 1.7.33 under `--no-execute`
  // (`scratchpad/s310/gc-ne`, `s13c_*`): a `child=` chunk of the R, bash, sh, zsh, perl, ruby, awk, python, rcpp, css, js and node engines lists `Top` and `Last`, so each is silent.
  const childDocument = (chunk: string): string =>
    ["---", "title: t", "---", "", "# Top", "", "```", "", "## Between", "", chunk, "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", ""].join("\n");
  it.each(["r", "bash", "sh", "zsh", "perl", "ruby", "awk", "python", "rcpp", "css", "js", "node"])("a {%s} child= chunk is silent", (engine) => {
    expect(headings(childDocument("```{" + engine + ', child="_child_text.Rmd"}\n```'), "no-execute")).toEqual(["Top", "Last"]);
  });
  it("executing, an engine's child chunk keeps the answer it always had", () => {
    expect(headings(childDocument('```{bash, child="_c.Rmd", echo=FALSE}\n```'), "execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(childDocument('```{python, child="_c.Rmd"}\n```'), "execute")).toEqual(["Top", "After", "Last"]);
  });
  // `scratchpad/s310/gc-ne` `s13c_r_child_list_pipe`: the YAML list spelling of the pipe option names the option too, though the reader cannot parse the value (the reviewer's S06), and
  // `eval=TRUE` does not make a child run (`s13c_r_child_eval_true`, the reviewer's S09).
  it("`#| child: [a, b]` and `child=` with `eval=TRUE` are silent as well", () => {
    expect(headings(childDocument("```{r}\n#| child: [_child_text.Rmd, _child_text2.Rmd]\n```"), "no-execute")).toEqual(["Top", "Last"]);
    expect(headings(childDocument('```{r, child="_child_text.Rmd", eval=TRUE}\n```'), "no-execute")).toEqual(["Top", "Last"]);
    expect(headings(childDocument("```{r}\n#| child: [_child_text.Rmd, _child_text2.Rmd]\n```"), "execute")).toEqual(["Top", "After", "Last"]);
  });
  // The engines this rule does not trust when executing are silent under `--no-execute` (nothing is compiled or run, so nothing is written): `scratchpad/s310/gc-ne` `s14_*_echoF`, 22
  // engines rendered with `echo=FALSE`, every one listing `Top` and `Last`. `go` and `stan` did not render and are NOT here; `mermaid`, `dot` and `ojs` are quarto's own and re-emit their fence.
  const UNLISTED = [
    "c", "cc", "fortran", "fortran95", "haskell", "octave", "sas", "scala", "sql", "tikz", "Rscript", "asis", "cat", "block", "coffee", "groovy", "php", "sed", "gawk", "stata", "highlight", "mysql",
  ];
  it.each(UNLISTED)("a {%s} chunk with echo=FALSE is silent when nothing runs, and loud as ever when it does", (engine) => {
    const document = childDocument("```{" + engine + ", echo=FALSE}\nx\n```");
    expect(headings(document, "no-execute")).toEqual(["Top", "Last"]);
    expect(headings(document, "execute")).toEqual(["Top", "After", "Last"]);
  });
  it("an engine quarto handles itself still emits its fence: mermaid, dot, ojs are not silenced", () => {
    for (const engine of ["mermaid", "dot", "ojs"]) {
      expect(headings(childDocument("```{" + engine + ", echo=FALSE}\nx\n```"), "no-execute")).toEqual(["Top", "After", "Last"]);
    }
  });

  // Code that supplies a chunk's code through the FRONT MATTER or an INLINE `r` call runs in both renders; one in a chunk's body does not (the reviewer's T04). Rendered with quarto 1.7.33
  // (knitr 1.51), exit 0, both ways (`scratchpad/s307/g5ex` and `g5ne`): `k12_optschunk_in_yaml` and `k11_inline_r_opts_chunk` list `Top`, `After`, `Last` in BOTH renders (the empty chunk
  // is filled and echoes a fence that ends the swallow), while `k08_opts_chunk_code`, the same call in a setup chunk's body, lists `Top`, `Last` under `--no-execute` (pinned above).
  const EMPTY_CHUNK_BELOW = ["# Top", "", "```", "", "## Between", "", "```{r}", "```", "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", ""];
  const SRC_CHUNK = ["```{r src, include=FALSE}", "z <- 3", "```", ""];
  it("a front matter's `knitr: opts_chunk: ref.label` supplies the code in both modes", () => {
    const document = ["---", "title: t", "knitr:", "  opts_chunk:", "    ref.label: src", "---", "", ...SRC_CHUNK, ...EMPTY_CHUNK_BELOW].join("\n");
    expect(headings(document, "no-execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(document, "execute")).toEqual(["Top", "After", "Last"]);
  });
  it("an inline `r` call that sets `ref.label` supplies the code in both modes", () => {
    const document = ["---", "title: t", "---", "", ...SRC_CHUNK, '`r knitr::opts_chunk$set(ref.label = "src")`', "", ...EMPTY_CHUNK_BELOW].join("\n");
    expect(headings(document, "no-execute")).toEqual(["Top", "After", "Last"]);
    expect(headings(document, "execute")).toEqual(["Top", "After", "Last"]);
  });
});

describe("Session 310 — a #| expression inside a LISTED or QUOTED chunk still runs under --no-execute", () => {
  // Found by the review round (the soundness attacker's `soundness_03` and `soundness_04`, the test critic's `critic_02`), each RENDERED by quarto 1.7.33 (knitr 1.51) both ways
  // (`scratchpad/s310/rev/*`, exit 0): the option expression runs whether or not the chunk executes, sets `echo = TRUE` for the chunks below, and quarto lists what the EXECUTING
  // reading already lists. A chunk inside a list item or a block quote is not judged, and its body lines carry the container's prefix (`  #| ...`, `> #| ...`), which a column-zero test of
  // `#|` never matched: the first cut of the no-execute reading skipped the mention, trusted the front matter's silence and hid the heading.
  const LISTED = [
    "---", 'title: "critic 02 listed pipe expr"', "execute:", "  echo: false", "---", "", "- item", "", "  ```{r}", "  #| include: !expr is.null(knitr::opts_chunk$set(echo = TRUE))", "  invisible(NULL)", "  ```", "",
    "# Top 02", "", "```", "", "## Between 02", "", "```{r}", "x <- 1", "```", "", "## Mid 02", "", "```{r, echo=TRUE}", "y <- 2", "```", "", "## After 02", "", "Text after.", "", "## Last 02", "", "Final text.", "",
  ].join("\n");
  const QUOTED = [
    "---", 'title: "Orchard Yield Review"', "execute:", "  echo: false", "---", "", "# Summary", "", "This review looks at apple yield over four years.", "", "> Reader setup, run once:", ">",
    "> ```{r}", "> #| include: !expr is.null(knitr::opts_chunk$set(echo = TRUE))", "> invisible(NULL)", "> ```", "", "# Orchard Layout", "", "The orchard has six rows of mixed varieties.", "", "```", "",
    "## Pruning", "", "Pruning is done in late winter.", "", "```{r}", "x <- 1", "```", "", "## Pollination", "", "Hives are brought in during bloom.", "", "```{r, echo=TRUE}", "y <- 2", "```", "", "## Harvest", "",
    "Picking runs for about three weeks.", "", "## Storage Losses", "", "Losses in cold storage stayed small.", "",
  ].join("\n");
  const headings = (document: string, mode?: "execute" | "no-execute"): string[] => findHeadings(document, "knitr", mode).map((h) => h.text);

  it("listed: the same headings in both modes", () => {
    expect(headings(LISTED, "execute")).toEqual(["Top 02", "Mid 02", "After 02", "Last 02"]);
    expect(headings(LISTED, "no-execute")).toEqual(["Top 02", "Mid 02", "After 02", "Last 02"]);
  });
  it("quoted: the same headings in both modes", () => {
    expect(headings(QUOTED, "execute")).toEqual(["Summary", "Orchard Layout", "Pollination", "Harvest", "Storage Losses"]);
    expect(headings(QUOTED, "no-execute")).toEqual(["Summary", "Orchard Layout", "Pollination", "Harvest", "Storage Losses"]);
  });
});
