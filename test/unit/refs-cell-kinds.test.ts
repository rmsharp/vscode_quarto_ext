import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { indexLabels } from "../../src/core/refs";

describe("Session 305 — a code cell defines no `sec-` or `eq-` label", () => {
  // Rendered, quarto 1.7.33, one cell per document under knitr, Jupyter and the markdown engine (`scratchpad/s305/grid1`, g040-g065):
  // `#| label: sec-x` and `#| label: eq-x` print `?@sec-x` / `?@eq-x` in EVERY cell language (r, python, mermaid, dot, ojs) under
  // EVERY engine, 26 rows of 26. A section is owned by a heading and an equation by display math; a cell has neither. The index used
  // to answer "defined" for a label of any kind on a cell, so the completion list and go-to-definition offered a target quarto never makes.
  const ids = (text: string): string[] => indexLabels(text).map((l) => l.id);

  it("a python cell's `#| label: sec-x` defines nothing", () => {
    expect(ids(["```{python}", "#| label: sec-x", "x = 1", "```"].join("\n"))).toEqual([]);
  });

  it("…and so does `eq-x`", () => {
    expect(ids(["```{python}", "#| label: eq-x", "x = 1", "```"].join("\n"))).toEqual([]);
  });

  // The comment character is the cell language's own (`%%|` mermaid, `//|` dot and ojs): the guard is about the KIND, so it must hold for
  // every language the scanner reads, and the document engine (what `resolveDocumentEngine` answered) must not change it.
  type Engine = NonNullable<Parameters<typeof indexLabels>[1]> | undefined;
  const LANGS: ReadonlyArray<readonly [string, string]> = [
    ["r", "#|"],
    ["python", "#|"],
    ["mermaid", "%%|"],
    ["dot", "//|"],
    ["ojs", "//|"],
  ];
  // Rendered: knitr, Jupyter and markdown (plus no engine at all). `julia` and `ambiguous` are the two other answers `resolveDocumentEngine` can give;
  // they are not rendered, the guard does not read the engine, and a guard that skipped either would be a regression this list now catches.
  const ENGINES: readonly Engine[] = [undefined, "knitr", "jupyter", "markdown", "julia", "ambiguous"];
  const cellOf = (lang: string, comment: string, id: string, caption: string | null, ...body: string[]): string =>
    ["```{" + lang + "}", `${comment} label: ${id}`, ...(caption === null ? [] : [`${comment} ${caption}`]), ...body, "```"].join("\n");

  describe.each(["sec", "eq"] as const)("`%s-x` on a cell, in every language under every engine (g040-g065)", (kind) => {
    it.each(LANGS.flatMap(([lang, comment]) => ENGINES.map((engine) => [lang, comment, engine] as const)))(
      "{%s} (%s), engine %s",
      (lang, comment, engine) => {
        expect(indexLabels(cellOf(lang, comment, `${kind}-x`, null, "1 + 1"), engine)).toEqual([]);
      },
    );
  });

  describe("a document with a channel for run-time markdown, or for code this text does not show, keeps the label", () => {
    // The rule is Session 304's channels (`cellTargetContext`: an asis output, `Markdown()`, `display()`, an inline expression, a shortcode, a `child`,
    // `source`, `get(`, `exec` ...): a `sec-`/`eq-` target is written by a cell's OUTPUT, never by its label (hunt output, langs, interactions; white-box lost
    // lens wl09-wl43; grid2 h10, h11: 34 documents rendered, the id DEFINED in each), and a template, an escape, a sibling file or another cell can mint the
    // id with nothing in the text to read. A wrong removal loses a label quarto defines; a wrong keep leaves the phantom this index always had.
    it.each([
      ["an R cat() with output: asis (lo11, lo14, li12)", "sec-x", ["```{r}", "#| label: sec-x", "#| output: asis", 'cat("## Title {#sec-x}\\n")', "```"]],
      ["an R sprintf template (wl09)", "sec-x", ["```{r}", "#| label: sec-x", "#| output: asis", 'cat(sprintf("## T {#%s}\\n", "sec-x"))', "```"]],
      ["a python f-string template (wl12)", "eq-x", ["```{python}", "#| label: eq-x", "#| output: asis", 'sid = "eq-x"', 'print(f"$$ y = x $$ {{#{sid}}}")', "```"]],
      ["a python print with output: asis (lg19, lo45, li14)", "eq-x", ["```{python}", "#| label: eq-x", "#| output: asis", 'print("$$ y = x $$ {#eq-x}")', "```"]],
      ["a python Markdown() as the last expression (lo42, lo46, lo53)", "eq-x", ["```{python}", "#| label: eq-x", "from IPython.display import Markdown", 'Markdown("$$ y = x $$ {#eq-x}")', "```"]],
      ["a python display(Markdown()) (lg28, li15)", "eq-x", ["```{python}", "#| label: eq-x", "from IPython.display import display, Markdown", 'display(Markdown("$$ y = x $$ {#eq-x}"))', "```"]],
      ["an {asis} cell whose content IS the heading (lg21)", "sec-x", ["```{asis}", "#| label: sec-x", "## Self defined heading {#sec-x}", "```"]],
      ["a {bash} printf with output: asis (lg20)", "eq-x", ["```{bash}", "#| label: eq-x", "#| output: asis", "printf '$$ x = 1 $$ {#eq-x}\\n'", "```"]],
      ["an id built from pieces (h11)", "eq-x", ["```{r}", "#| label: eq-x", "#| output: asis", 'cat("$$ y = x $$ {#eq-", "x}\\n", sep = "")', "```"]],
      ["an include shortcode beside a plain cell (wl33)", "sec-x", ["{{< include _x.md >}}", "", "```{r}", "#| label: sec-x", "x <- 1", "```"]],
      ["a cell with child: (wl36)", "sec-x", ["```{r}", "#| label: sec-x", "#| child: _x.qmd", "```"]],
      ["a source() of a file (wl34)", "sec-x", ["```{r}", "#| label: sec-x", "#| output: asis", 'source("_x.R")', "```"]],
      ["a python exec() of a file (wl37)", "sec-x", ["```{python}", "#| label: sec-x", "#| output: asis", 'exec(open("_x.py").read())', "```"]],
      ["a cell that takes its code from a file (wl35)", "sec-x", ["```{r}", "#| label: sec-x", "#| file: _x.R", "#| output: asis", "```"]],
      ["an inline R expression in prose (wl39)", "sec-x", ["## Inline `r \"{#sec-x}\"`", "", "```{r}", "#| label: sec-x", "x <- 1", "```"]],
      ["an R source()$value of a file that returns asis_output, with no asis in this text (u01)", "sec-x", ["```{r}", "#| label: sec-x", 'source("_x.R")$value', "```"]],
      ["a python exec() of a file that displays Markdown, with no Markdown in this text (u02)", "eq-x", ["```{python}", "#| label: eq-x", 'exec(open("_x.py").read())', "```"]],
      [
        "a knitr chunk hook that writes the heading (u03)",
        "sec-x",
        ["```{r}", "#| include: false", 'knitr::knit_hooks$set(u = function(before, options) { if (!before) "## T {#sec-x}" })', "```", "", "```{r}", "#| label: sec-x", "#| u: true", "x <- 1", "```"],
      ],
      ["read_chunk supplies the labelled chunk's code from a file (u04)", "sec-x", ["```{r}", "#| include: false", 'knitr::read_chunk("_x.R")', "```", "", "```{r}", "#| label: sec-x", "```"]],
      [
        "ANOTHER cell does the printing (h10)",
        "eq-x",
        ["```{r}", "#| label: eq-x", "x <- 1", "```", "", "```{r}", "#| output: asis", 'cat("$$ y = x $$ {#eq-x}\\n")', "```"],
      ],
    ])("%s keeps the label", (_name, id, lines) => {
      expect(ids(lines.join("\n"))).toEqual([id]);
    });
  });

  describe("no channel, no definition: an anchor spelled in plain code is not output (h04-h07)", () => {
    // Rendered: a `{#eq-x}` in a code comment (h04, h05), or printed WITHOUT an asis output (h06, h07: it lands in a code block), defines nothing.
    it.each([
      ["R cat() without asis (h06)", ["```{r}", "#| label: eq-x", 'cat("$$ y = x $$ {#eq-x}\\n")', "```"]],
      ["python print() without asis (h07)", ["```{python}", "#| label: eq-x", 'print("$$ y = x $$ {#eq-x}")', "```"]],
      ["an R comment (h04)", ["```{r}", "#| label: eq-x", "# {#eq-x} only a comment", "x <- 1", "```"]],
      ["a python comment (h05)", ["```{python}", "#| label: sec-x", "# {#sec-x} only a comment", "x = 1", "```"]],
    ])("%s", (_name, lines) => {
      expect(ids(lines.join("\n"))).toEqual([]);
    });

    it("the definition is the prose equation, at ITS line, whether the cell comes before or after it (h14)", () => {
      const first = ["```{r}", "#| label: eq-x", "x <- 1", "```", "", "$$ y = x $$ {#eq-x}"].join("\n");
      expect(indexLabels(first)).toEqual([{ id: "eq-x", kind: "eq", line: 5, column: 14 }]);
    });
  });

  describe("RESIDUALS: a label kept although quarto leaves it undefined, because a channel exists and the text cannot tell what it writes", () => {
    // The same phantom the index had before this session, measured one by one (each rendered: `?@id`).
    const asis = (label: string, ...code: string[]): string => ["```{r}", `#| label: ${label}`, "#| output: asis", ...code, "```"].join("\n");

    it("a DIFFERENT id is printed (h01a, h02a, h03a): quarto defines only the printed one", () => {
      expect(ids(asis("eq-a", 'cat("$$ y = x $$ {#eq-b}\\n")'))).toEqual(["eq-a"]);
      expect(ids(asis("sec-a", 'cat("## T {#sec-b}\\n")'))).toEqual(["sec-a"]);
    });

    it.each([
      ["a raw HTML id= on a heading (lo18, h13)", "sec-x", `cat('<h2 id="sec-x">T</h2>\\n')`],
      ["a raw HTML id= on a div (h12)", "eq-x", `cat('<div id="eq-x">x</div>\\n')`],
      ["a fenced div (lo13)", "sec-x", 'cat("::: {#sec-x}\\nSome text.\\n:::\\n")'],
      ["a paragraph carrying the attribute (lo16)", "sec-x", 'cat("A plain paragraph. {#sec-x}\\n")'],
      ["a heading carrying an eq- id (lo17)", "eq-x", 'cat("## Title {#eq-x}\\n")'],
    ])("the printed construct is the wrong one: %s", (_name, id, code) => {
      expect(ids(asis(id, code))).toEqual([id]);
    });

    it("the printing code never runs, or its output is dropped (lo07, lo08, lo52, h08)", () => {
      expect(ids(asis("eq-x", "#| include: false", 'cat("$$ y = x $$ {#eq-x}\\n")'))).toEqual(["eq-x"]);
      expect(ids(asis("eq-x", "#| output: false", 'cat("$$ y = x $$ {#eq-x}\\n")'))).toEqual(["eq-x"]);
      expect(ids(asis("eq-x", "#| eval: false", 'cat("$$ y = x $$ {#eq-x}\\n")'))).toEqual(["eq-x"]);
    });

    it("code run by name that writes nothing is the price of the unseen-code test (u05 source, u06 exec)", () => {
      expect(ids(["```{r}", "#| label: sec-x", 'source("_x.R")', "```"].join("\n"))).toEqual(["sec-x"]);
      expect(ids(["```{python}", "#| label: sec-x", 'exec("x = 1")', "```"].join("\n"))).toEqual(["sec-x"]);
    });

    it("an IPython Latex() display (lo44) is no markdown", () => {
      expect(ids(["```{python}", "#| label: eq-x", "from IPython.display import Latex", 'Latex(r"$$ y = x $$ {#eq-x}")', "```"].join("\n"))).toEqual(["eq-x"]);
    });
  });

  describe("RESIDUALS: a label quarto defines and this index does not report, because the definition was never the cell's (the label used to hide it)", () => {
    it("a heading whose TEXT is the id has the auto id quarto resolves, which this model never generates (li18)", () => {
      expect(ids(["# sec-x", "", "```{r}", "#| label: sec-x", "x <- 1", "```"].join("\n"))).toEqual([]);
    });

    it("a heading whose attribute block holds a quoted brace is not read as a heading id (wl50): a gap that predates the guard", () => {
      expect(ids(['## Prose heading {data-x="}" #sec-x}', "", "```{r}", "#| label: sec-x", "x <- 1", "```"].join("\n"))).toEqual([]);
    });
  });

  describe("the kinds a cell DOES define stay defined (g001-g026, g029-g038)", () => {
    // Controls for the guard: it is a list of two kinds, not a rule about cells. A figure and a table keep their label in every language and
    // engine where quarto defines it: a handler cell (mermaid, dot, ojs) under every engine, an r or python cell under knitr and Jupyter.
    const engineOf = (lang: string): readonly Engine[] => ENGINES.filter((engine) => !(["r", "python"].includes(lang) && engine === "markdown"));
    it.each(LANGS.flatMap(([lang, comment]) => engineOf(lang).map((engine) => [lang, comment, engine] as const)))("fig-x and tbl-x on a {%s} cell (%s), engine %s", (lang, comment, engine) => {
      expect(indexLabels(cellOf(lang, comment, "fig-x", 'fig-cap: "C"', "plot(1)"), engine).map((l) => l.id)).toEqual(["fig-x"]);
      expect(indexLabels(cellOf(lang, comment, "tbl-x", 'tbl-cap: "C"', "plot(1)"), engine).map((l) => l.id)).toEqual(["tbl-x"]);
    });

    it.each([
      ["python", "#|", "jupyter", "g032"],
      ["mermaid", "%%|", "knitr", "g029"],
      ["mermaid", "%%|", "jupyter", "g033"],
      ["mermaid", "%%|", "markdown", "g036"],
      ["dot", "//|", "knitr", "g030"],
      ["dot", "//|", "jupyter", "g034"],
      ["ojs", "//|", "knitr", "g031"],
      ["ojs", "//|", "jupyter", "g035"],
    ] as const)("lst-x on a {%s} cell is defined under %s (%s)", (lang, comment, engine, _probe) => {
      expect(indexLabels(cellOf(lang, comment, "lst-x", 'lst-cap: "C"', "x = 1"), engine).map((l) => l.id)).toEqual(["lst-x"]);
    });

    describe("RESIDUALS: a label the index keeps although quarto leaves it undefined, because the answer is not the kind's alone", () => {
      it("lst-x on a knitr cell (g027, g028: r and python), on an `engine: markdown` python cell (lg37) and on a Jupyter cell whose code is hidden (li57a: echo: false)", () => {
        expect(indexLabels(cellOf("r", "#|", "lst-x", 'lst-cap: "C"', "x <- 1"), "knitr").map((l) => l.id)).toEqual(["lst-x"]);
        expect(indexLabels(cellOf("python", "#|", "lst-x", 'lst-cap: "C"', "x = 1"), "markdown").map((l) => l.id)).toEqual(["lst-x"]);
        expect(indexLabels(cellOf("python", "#|", "lst-x", "echo: false", "x = 1"), "jupyter").map((l) => l.id)).toEqual(["lst-x"]);
      });

      it("fig-x on an r or python cell under `engine: markdown` (li55b: the cell is plain code there)", () => {
        expect(indexLabels(cellOf("r", "#|", "fig-x", 'fig-cap: "C"', "plot(1)"), "markdown").map((l) => l.id)).toEqual(["fig-x"]);
      });
    });
  });

  describe("every shape rendered with quarto 1.7.33, document by document", () => {
    // `[extension, engine, quartoDefined, indexDefined, parentDefined, document]`, 367 distinct documents from `scratchpad/s305`: the 78-document grid, the
    // 15-document narrow-exemption grid, the 6-document unseen-code grid, five blind lenses (297 documents: languages, outputs, spellings, containers, interactions) and three white-box
    // lenses (150 documents: the dangerous direction, the phantom direction, odd structure). `quartoDefined` is what the rendered HTML says; `indexDefined`
    // is what this index answered when the fixture was written; `parentDefined` is what it answered BEFORE Session 305. A document that made quarto exit
    // non-zero, or whose id the HTML cannot decide, or that normalising its label name cannot reproduce, is omitted. Learning #685's closed-world pin: every
    // row is pinned, so a change that drops a label quarto defines, or stops dropping a phantom, fails here and the fixture must be regenerated on purpose.
    // (The probes live in the untracked `scratchpad/`, as every earlier fixture's do.)
    type Row = [string, string, boolean, boolean, boolean, string];
    const FIXTURE = path.join(__dirname, "../fixtures/cell-label-kinds/quarto-1.7.33.json");
    const rows = (JSON.parse(readFileSync(FIXTURE, "utf8")) as { rows: Row[] }).rows;
    const shape = (text: string): string =>
      text
        .replace(/^---\ntitle: "t"\n/, "")
        .replace(/\n---\n\nSee @\S+\.\n\n/, "\n")
        .replace(/\n+$/, "")
        .replace(/\n/g, " ⏎ ")
        .slice(0, 150);
    const found = (r: Row): boolean => {
      const id = /See @([a-z]+-x)\./.exec(r[5])?.[1] ?? "";
      return indexLabels(r[5], resolveDocumentEngine("a" + r[0], r[5])).some((l) => l.id === id);
    };
    const against = (r: Row): "agree" | "PHANTOM" | "LOST" => (found(r) === r[2] ? "agree" : found(r) ? "PHANTOM" : "LOST");

    it("covers the whole fixture: 367 documents, 159 of which quarto defines the label for", () => {
      expect(rows).toHaveLength(367);
      expect(rows.filter((r) => r[2])).toHaveLength(159);
    });

    it("the index, run now, agrees with quarto on 268 documents (the parent did on 173), keeps a phantom on 91 and misses a label on 8", () => {
      const counts = { agree: 0, PHANTOM: 0, LOST: 0 };
      for (const r of rows) {
        counts[against(r)]++;
      }
      expect(counts).toEqual({ agree: 268, PHANTOM: 91, LOST: 8 });
      expect(rows.filter((r) => r[3] === r[2])).toHaveLength(268);
      expect(rows.filter((r) => r[4] === r[2])).toHaveLength(173);
    });

    it("the ONLY labels quarto defines that the parent kept and this drops are the two heading gaps the label used to hide (li18, wl50)", () => {
      const worse = rows.filter((r) => r[2] && r[4] && !found(r));
      expect(worse.map((r) => shape(r[5]))).toEqual([
        "number-sections: true ⏎ --- ⏎  ⏎ # sec-x ⏎  ⏎ See @sec-x. ⏎  ⏎ ```{r} ⏎ #| label: sec-x ⏎ x <- 1:3 ⏎ ```",
        '--- ⏎  ⏎ See @sec-x. ⏎  ⏎ ## Prose heading {data-x="}" #sec-x} ⏎  ⏎ ```{r} ⏎ #| label: sec-x ⏎ x <- 1 ⏎ ```',
      ]);
    });

    it("the six other missed labels were missed BEFORE this session too: the cell scanner, a YAML spelling or a kind this index does not know", () => {
      const missed = rows.filter((r) => against(r) === "LOST" && !r[4]);
      expect(missed).toHaveLength(6);
    });

    it.each(rows.map((r) => [shape(r[5]), r] as const))("%s", (_shape, r) => {
      expect(found(r)).toBe(r[3]);
    });
  });
});
