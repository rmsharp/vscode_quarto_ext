import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { indexLabels } from "../../src/core/refs";

describe("Session 304 — a chunk that makes no figure defines no figure label", () => {
  // Rendered, quarto 1.7.33, knitr and Jupyter EXECUTING (`scratchpad/s304/grid`, `grid2` and the six lens
  // directories; the ids in the comments below name the probe a rule was measured on). The label index used to
  // answer "defined" for every `fig-`/`tbl-` label on a cell, so a cell that quarto leaves without the target it
  // names (`?@fig-x` in the output) was offered as a completion and a definition.
  const chunk = (header: string, ...body: string[]): string => ["```" + header, ...body, "```"].join("\n");
  const ids = (text: string): string[] => indexLabels(text, "knitr").map((l) => l.id);

  describe("a header option that stops the figure", () => {
    it("eval=FALSE: nothing runs, so no figure exists (a15)", () => {
      expect(ids(chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    it("…but eval=FALSE does NOT stop a TABLE label: the table sits on the cell itself (k07, k08)", () => {
      expect(ids(chunk("{r tbl-x, eval=FALSE}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))"))).toEqual(["tbl-x"]);
    });

    it("include=FALSE hides the cell's output, so it stops a figure label (a16) AND a table label (g030, e64)", () => {
      expect(ids(chunk("{r fig-x, include=FALSE}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
      expect(ids(chunk("{r tbl-x, include=FALSE}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))"))).toEqual([]);
    });

    it.each([
      ["{r fig-x, fig.show='hide'}", "single quotes (k12, g005)"],
      ['{r fig-x, fig.show="hide"}', "double quotes (h28)"],
      ["{r fig-x, fig.show = 'hide'}", "spaces around = (h29)"],
    ])("fig.show='hide' keeps the figure out of the output: %s — %s", (header) => {
      expect(ids(chunk(header, '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    it("…and it leaves a TABLE label alone: a table is no figure (g032, h35)", () => {
      expect(ids(chunk("{r tbl-x, fig.show='hide'}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))"))).toEqual(["tbl-x"]);
    });

    it.each([
      ["{r fig-x, fig.keep='none'}", "single quotes (g006, h36)"],
      ['{r fig-x, fig.keep="none"}', "double quotes"],
    ])("fig.keep='none' discards the plot: %s — %s", (header) => {
      expect(ids(chunk(header, '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    it("…while the other fig.keep values keep a figure: high, first, last, all (h37, h39, h40)", () => {
      for (const value of ["high", "first", "last", "all"]) {
        expect(ids(chunk(`{r fig-x, fig.keep='${value}'}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      }
    });

    it("…and fig.keep='none' leaves a TABLE label alone (g033, h41)", () => {
      expect(ids(chunk("{r tbl-x, fig.keep='none'}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))"))).toEqual(["tbl-x"]);
    });

    it.each([
      ["eval=FALSE", "a literal"],
      ["eval = FALSE", "spaces around = (h01)"],
      ["eval=F", "the short spelling (k10)"],
      ["eval=!TRUE", "a logical expression (h06)"],
      ["eval=FALSE & TRUE", "a logical expression (h07)"],
      ["eval=TRUE, eval=FALSE", "the last assignment wins (h27)"],
      ["include=F", "include, short spelling (h19)"],
      ["include=!TRUE", "include, a logical expression (h21)"],
      ["echo=FALSE, eval=FALSE", "beside a harmless option (p35)"],
    ])("a value that resolves to false stops the figure: %s — %s", (options) => {
      expect(ids(chunk(`{r fig-x, ${options}}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    it.each([
      ["{r fig-x, output=FALSE}", "g095"],
      ["{r fig-x, output=F}", "g096"],
    ])("output=FALSE drops the figure from the output: %s (%s)", (header) => {
      expect(ids(chunk(header, '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    it("…but not a TABLE (g111, g112), and output='asis' keeps the figure (g097)", () => {
      expect(ids(chunk("{r tbl-x, output=FALSE}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))"))).toEqual(["tbl-x"]);
      expect(ids(chunk("{r fig-x, output='asis'}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
    });

    it.each([
      ['eval="FALSE"', "a STRING is not logical false (h02)"],
      ["eval=NA", "NA is not false (h04)"],
      ["eval=TRUE", "true (h05)"],
      ["eval=c(TRUE, FALSE)", "a vector of two (h13)"],
      ["eval=2", "numeric eval selects expressions, and the plot is expression 2 (h15)"],
      ["include=TRUE", "true"],
      ["fig.show='hold'", "the figure is still shown (h30)"],
      ["fig.show='asis'", "the figure is still shown (h31)"],
      ["fig.show='animate'", "the figure is still shown (h32)"],
      ["fig.show=hide", "a bare word is an R symbol, not the string"],
      ["fig.show=c('hide')", "a call is not read"],
      ["results='hide'", "results hide the text, not the figure (h43)"],
      ["echo=FALSE", "echo hides the code only"],
      ["evaluate=FALSE", "a different option name (h55)"],
      ["EVAL=FALSE", "option names are case sensitive (h57)"],
      ["eval.after='fig.cap'", "a different option (h56)"],
    ])("a look-alike does NOT stop the figure: %s — %s", (options) => {
      expect(ids(chunk(`{r fig-x, ${options}}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
    });
  });

  describe("a chunk with no code makes no figure", () => {
    it.each([
      ["no lines at all", []],
      ["one blank line", [""]],
      ["blank lines", ["", ""]],
      ["a comment", ["# nothing to draw"]],
      ["comments and a blank line", ["# a", "", "# b"]],
      ["an indented comment", ["  # indented"]],
    ])("an R chunk holding %s defines no figure label (k14, c02, c03, g157-g161)", (_what, code) => {
      expect(ids(chunk("{r fig-x}", '#| fig-cap: "Cap"', ...code))).toEqual([]);
      expect(ids(chunk("{r}", "#| label: fig-x", '#| fig-cap: "Cap"', ...code))).toEqual([]);
    });

    it("a python chunk run by knitr is the same (g154-g162)", () => {
      const knitrDoc = (body: string[]): string => "---\nengine: knitr\n---\n" + chunk("{python}", "#| label: fig-x", '#| fig-cap: "Cap"', ...body);
      expect(ids(knitrDoc([]))).toEqual([]);
      expect(ids(knitrDoc(["# nothing"]))).toEqual([]);
      expect(ids(knitrDoc(["", ""]))).toEqual([]);
    });

    it("…but a TABLE label on an empty chunk is defined: the cell is the table's container (g198, c48, c49)", () => {
      expect(ids(chunk("{r tbl-x}", '#| tbl-cap: "Cap"'))).toEqual(["tbl-x"]);
      expect(ids(chunk("{r tbl-x}", '#| tbl-cap: "Cap"', "# commented-out kable"))).toEqual(["tbl-x"]);
    });

    it.each([
      ["plot(1)", "a plot call"],
      ["x <- 1:10", "an assignment: it may be a plot call, which only a render knows (c04 is undefined, this is the declined side)"],
      ['print("hello")', "text output (c07, declined for the same reason)"],
      ["# plot(1)\nplot(2)", "code after a comment"],
    ])("a chunk with code keeps the label, whatever the code does: %s — %s", (code) => {
      expect(ids(chunk("{r fig-x}", '#| fig-cap: "Cap"', ...code.split("\n")))).toEqual(["fig-x"]);
    });

    it.each([
      ["{r fig-x, ref.label='src'}", "ref.label brings code from another chunk (x01, x12)"],
      ["{r fig-x, code='plot(1)'}", "code= brings code (x12)"],
      ["{r fig-x, file='plot.R'}", "file= brings code (x14)"],
    ])("an empty chunk that takes its code from elsewhere keeps the label: %s — %s", (header) => {
      expect(ids(chunk(header, '#| fig-cap: "Cap"'))).toEqual(["fig-x"]);
    });

    it.each([
      ['knitr::read_chunk("plots.R")', "x17: the labelled chunk's code is read from the file by its label"],
      ["knitr::read_chunk('plots.R', from = 1)", "the same with arguments"],
      ["read_chunk('plots.R')", "after library(knitr)"],
      ["knitr::read_demo('plots')", "read_demo fills chunks from a demo file"],
      ["knitr::read_rforge('plots')", "read_rforge fills chunks from a file"],
      ["knitr::knit_code$set(`fig-x` = 'plot(1)')", "knit_code$set writes the code of a chunk by label"],
    ])("a document that fills chunks from outside keeps the label of an empty chunk: %s — %s", (call) => {
      const text = [chunk("{r setup, include=FALSE}", call), "", chunk("{r fig-x}", '#| fig-cap: "Cap"')].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
    });

    it("…and the guard reads the whole document, prose included: a mention anywhere declines (the safe side)", () => {
      const text = ["Read about `read_chunk` here.", "", chunk("{r fig-x}", '#| fig-cap: "Cap"')].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
    });

    it("a document that does not mention them is not guarded", () => {
      const text = [chunk("{r setup, include=FALSE}", "library(knitr)"), "", chunk("{r fig-x}", '#| fig-cap: "Cap"')].join("\n");
      expect(ids(text)).toEqual([]);
    });

    it("an engine other than r and python is not measured, so it keeps the label, empty or not", () => {
      expect(ids(chunk("{bash fig-x}", '#| fig-cap: "Cap"'))).toEqual(["fig-x"]);
      expect(ids(chunk("{r fig-x, engine='bash'}", '#| fig-cap: "Cap"'))).toEqual(["fig-x"]);
      expect(ids(chunk("{bash fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "echo hi"))).toEqual(["fig-x"]);
      expect(ids(chunk("{bash tbl-x, include=FALSE}", '#| tbl-cap: "Cap"', "echo hi"))).toEqual(["tbl-x"]);
      expect(ids(chunk("{r fig-x, eval=FALSE, engine='python'}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
    });

    it("python run by knitr follows the R rules (j50-j54, j56, j60)", () => {
      const doc = (header: string, ...body: string[]): string => "---\nengine: knitr\n---\n" + chunk(header, ...body);
      expect(ids(doc("{python fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "print(1)"))).toEqual([]);
      expect(ids(doc("{python fig-x, include=FALSE}", '#| fig-cap: "Cap"', "print(1)"))).toEqual([]);
      expect(ids(doc("{python fig-x, fig.show='hide'}", '#| fig-cap: "Cap"', "print(1)"))).toEqual([]);
      expect(ids(doc("{python}", "#| label: fig-x", "#| eval: false", '#| fig-cap: "Cap"', "print(1)"))).toEqual([]);
      expect(ids(doc("{python}", "#| label: fig-x", "#| output: false", '#| fig-cap: "Cap"', "print(1)"))).toEqual([]);
      expect(ids(doc("{python fig-x, eval=FALSE}", "#| eval: true", '#| fig-cap: "Cap"', "print(1)"))).toEqual(["fig-x"]);
    });
  });

  describe("the DOCUMENT's own defaults (front matter)", () => {
    const withFront = (front: string, ...rest: string[]): string => ["---", front, "---", "", ...rest].join("\n");
    const figure = chunk("{r fig-x}", '#| fig-cap: "Cap"', "plot(1)");
    const table = chunk("{r tbl-x}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))");

    it.each([
      ["execute:\n  eval: false", "g111, d01"],
      ["execute:\n  eval: False", "g068"],
      ["execute:\n  eval: FALSE", "g069"],
      ["execute:\n  eval: false # why", "g067"],
      ["execute:\n  include: false", "g114, d05"],
      ["knitr:\n  opts_chunk:\n    eval: false", "g123, d22"],
      ["knitr:\n  opts_chunk:\n    eval: FALSE", "g071"],
      ["knitr:\n  opts_chunk:\n    include: false", "g126, d23"],
      ["eval: false", "a top-level key (g059)"],
      ["include: false", "a top-level key (g060)"],
    ])("a figure label under %s defines nothing (%s)", (front) => {
      expect(ids(withFront(front, figure))).toEqual([]);
    });

    it.each([
      ["execute:\n  include: false", "g147"],
      ["knitr:\n  opts_chunk:\n    include: false", "g159"],
      ["include: false", "g078"],
    ])("a TABLE label under %s defines nothing either (%s)", (front) => {
      expect(ids(withFront(front, table))).toEqual([]);
    });

    it.each([
      ["execute:\n  eval: false", "g144"],
      ["knitr:\n  opts_chunk:\n    eval: false", "g156"],
      ["eval: false", "g077"],
    ])("…but a TABLE label survives a document eval of false: %s (%s)", (front) => {
      expect(ids(withFront(front, table))).toEqual(["tbl-x"]);
    });

    it("a chunk's own option re-enables what the document disabled, in the header and in a #| line (d02, d03, d06, g112, g113, g115, g116)", () => {
      const front = "execute:\n  eval: false\n  include: false";
      expect(ids(withFront(front, chunk("{r fig-x, eval=TRUE, include=TRUE}", '#| fig-cap: "Cap"', "plot(1)")))).toEqual(["fig-x"]);
      expect(ids(withFront(front, chunk("{r fig-x}", "#| eval: true", "#| include: true", '#| fig-cap: "Cap"', "plot(1)")))).toEqual(["fig-x"]);
    });

    it.each([
      ["execute:\n  echo: false", "echo hides code only (g117)"],
      ["execute:\n  eval: true", "true"],
      ["execute:\n  eval: no", "not a false spelling this reads (quarto rejects it, g070)"],
      ["knitr:\n  opts_chunk:\n    eval: F", "F is no YAML false (g072)"],
      ["execute:\n  fig-show: hide", "a document fig.show is not read (g129 is a different key)"],
    ])("%s keeps the label (%s)", (front) => {
      expect(ids(withFront(front, figure))).toEqual(["fig-x"]);
    });

    it.each([
      ["execute:\n  eval: false\nknitr:\n  opts_chunk:\n    eval: true", "knitr opts_chunk beats execute (g063)"],
      ["eval: false\nexecute:\n  eval: true", "execute beats a top-level key (g065)"],
      ["execute:\n  eval: true\nknitr:\n  opts_chunk:\n    eval: false", "quarto says undefined (g064); two keys disagree, so nothing is trusted"],
      ["execute:\n  eval: false\nformat:\n  html:\n    eval: true", "a format key counted and unread"],
      ["format:\n  html:\n    execute:\n      eval: false", "a format-nested key is not read: the format being rendered is unknown (g132)"],
      ["format:\n  pdf:\n    execute:\n      eval: false\n  html: default", "g076: not this render's format"],
    ])("a front matter two keys of which disagree, or one this does not read, keeps the label: %s — %s", (front) => {
      expect(ids(withFront(front, figure))).toEqual(["fig-x"]);
    });

    it("a setup chunk that sets opts_chunk may change the default, so no document default is trusted (d34-d44)", () => {
      const front = "execute:\n  eval: false";
      const setup = chunk("{r setup, include=FALSE}", "knitr::opts_chunk$set(eval = TRUE)");
      expect(ids(withFront(front, setup, "", figure))).toEqual(["fig-x"]);
    });

    it("but the chunk's OWN option is no default, so opts_chunk elsewhere does not unread it", () => {
      const setup = chunk("{r setup}", "knitr::opts_chunk$set(echo = FALSE)");
      expect(ids([setup, "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n"))).toEqual([]);
    });

    it("only the LEADING block is front matter (a --- block lower down sets nothing)", () => {
      expect(ids(["# Title", "", "---", "execute:", "  eval: false", "---", "", figure].join("\n"))).toEqual(["fig-x"]);
    });
  });

  describe("a Jupyter cell that shows nothing (the cell itself carries the id, so it needs something to show)", () => {
    // Rendered with Jupyter executing (`scratchpad/s304/grid` F, `grid2` J, `grid3` M, `jupyter-py`). The id sits on the
    // cell's own div, so a cell survives eval: false and output: false while its code is on show, whatever it makes;
    // only a cell with NOTHING left to show is dropped, and then both targets go with it.
    const jids = (text: string): string[] => indexLabels(text, "jupyter").map((l) => l.id);
    const cell = (kind: "fig" | "tbl", options: string[], ...code: string[]): string =>
      chunk("{python}", `#| label: ${kind}-x`, ...options.map((o) => `#| ${o}`), `#| ${kind}-cap: "Cap"`, ...code);
    const FIG = ["import matplotlib.pyplot as plt", "plt.plot([1, 2, 3])", "plt.show()"];
    const TBL = ["from IPython.display import Markdown", 'Markdown("| a | b |\\n|---|---|\\n| 1 | 2 |")'];
    const both = (options: string[], wanted: (kind: "fig" | "tbl") => string[], ...code: string[]): void => {
      expect(jids(cell("fig", options, ...(code.length > 0 ? code : FIG)))).toEqual(wanted("fig"));
      expect(jids(cell("tbl", options, ...(code.length > 0 ? code : TBL)))).toEqual(wanted("tbl"));
    };

    it.each([["false"], ["False"], ["FALSE"]])("include: %s drops the cell, so neither a figure nor a table is defined (g243, k007, k008)", (v) => {
      both([`include: ${v}`], () => []);
    });

    it("include: true, or no include at all, keeps both (g251, k009)", () => {
      both(["include: true"], (kind) => [`${kind}-x`]);
      both([], (kind) => [`${kind}-x`]);
    });

    it("eval: false ALONE does not: the code is still on show (g242, g256)", () => {
      both(["eval: false"], (kind) => [`${kind}-x`]);
    });

    it("output: false ALONE does not either (g244, g258)", () => {
      both(["output: false"], (kind) => [`${kind}-x`]);
    });

    it.each([
      ["eval: false + output: false, the code on show", ["eval: false", "output: false"], true, "k004, k016"],
      ["echo: false alone, the output on show", ["echo: false"], true, "k001, k013"],
      ["echo: false + include: true, still output", ["echo: false", "include: true"], true, "k006, k018"],
      ["echo: false + output: asis", ["echo: false", "output: asis"], true, "k010, k022"],
      ["echo: true + eval: false + output: false", ["echo: true", "eval: false", "output: false"], true, "m007, m025"],
    ])("%s keeps the label (%s)", (_what, options, keep) => {
      expect(keep).toBe(true);
      both(options, (kind) => [`${kind}-x`]);
    });

    it.each([
      ["echo: false + eval: false", ["echo: false", "eval: false"], "k003, k015"],
      ["echo: false + output: false", ["echo: false", "output: false"], "k002, k014"],
      ["all three", ["echo: false", "eval: false", "output: false"], "k005, k017"],
      ["echo: false + eval: false + include: true", ["echo: false", "eval: false", "include: true"], "m006, m024"],
      ["echo: false + eval: true + output: false", ["echo: false", "eval: true", "output: false"], "m008, m026"],
      ["echo: false + eval: false + code-fold", ["echo: false", "eval: false", "code-fold: true"], "m009, m027"],
    ])("hidden code and no output leave nothing to show: %s (%s)", (_what, options) => {
      both(options, () => []);
    });

    it.each([
      ["no line at all", []],
      ["one blank line", [""]],
      ["a whitespace-only line", ["   "]],
      ["blank lines", ["", ""]],
    ])("a cell with %s has no source and is dropped (k025-k030, k037-k042)", (_what, code) => {
      expect(jids(cell("fig", [], ...code))).toEqual([]);
      expect(jids(cell("tbl", [], ...code))).toEqual([]);
      expect(jids(cell("fig", ["echo: false"], ...code))).toEqual([]);
    });

    it("…but a comment or a `pass` is source and is shown (k031, k033, k043, k045, m012, m013)", () => {
      expect(jids(cell("fig", [], "# nothing"))).toEqual(["fig-x"]);
      expect(jids(cell("tbl", [], "pass"))).toEqual(["tbl-x"]);
      expect(jids(cell("fig", ["echo: true"], "# nothing"))).toEqual(["fig-x"]);
      expect(jids(cell("fig", [], "", "", "pass"))).toEqual(["fig-x"]);
    });

    it("a comment-only cell with echo: false shows nothing (k034, k046, m011, m029); `pass` with echo: false is undecidable and kept (k032)", () => {
      expect(jids(cell("fig", ["echo: false"], "# nothing"))).toEqual([]);
      expect(jids(cell("tbl", ["echo: false"], "# nothing"))).toEqual([]);
      expect(jids(cell("fig", ["echo: false", "eval: true"], "# nothing"))).toEqual([]);
      expect(jids(cell("fig", ["echo: false"], "pass"))).toEqual(["fig-x"]);
    });

    describe("the document's own include", () => {
      const doc = (front: string, ...options: string[]): string => ["---", "jupyter: python3", front, "---", "", cell("fig", options, ...FIG)].join("\n");

      it.each([
        ["execute:\n  include: false", "g287"],
        ["include: false", "a top-level key (k053)"],
      ])("%s drops every cell that does not say otherwise (%s)", (front) => {
        expect(jids(doc(front))).toEqual([]);
      });

      it("a cell's own include wins in both directions (g288, m004, m005)", () => {
        expect(jids(doc("execute:\n  include: false", "include: true"))).toEqual(["fig-x"]);
        expect(jids(doc("execute:\n  include: true", "include: false"))).toEqual([]);
      });

      it("the document's eval, echo and output are not read: eval: false keeps the cell (g285, k052)", () => {
        expect(jids(doc("execute:\n  eval: false"))).toEqual(["fig-x"]);
        expect(jids(doc("eval: false"))).toEqual(["fig-x"]);
        expect(jids(doc("execute:\n  echo: false\n  output: false"))).toEqual(["fig-x"]);
      });
    });

    it("a `knitr:` key makes the document ambiguous to the resolver, and nothing is removed in an engine nobody resolved", () => {
      const text = ["---", "jupyter: python3", "knitr:", "  opts_chunk:", "    include: false", "---", "", cell("fig", [], ...FIG)].join("\n");
      expect(indexLabels(text, "ambiguous").map((l) => l.id)).toEqual(["fig-x"]);
      expect(indexLabels(text).map((l) => l.id)).toEqual(["fig-x"]);
    });

    it("only a python cell is read: another language in the document is not measured (kept)", () => {
      expect(jids(chunk("{julia}", "#| label: fig-x", "#| include: false", '#| fig-cap: "Cap"', "1"))).toEqual(["fig-x"]);
    });

    it("an R chunk in a Jupyter document is no cell Jupyter runs, and the header label is not read there either", () => {
      expect(jids(chunk("{r fig-x, include=FALSE}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });
  });

  describe("the same options written as #| lines", () => {
    const withPipe = (label: "slot" | "pipe", kind: "fig" | "tbl", ...options: string[]): string =>
      label === "slot"
        ? chunk(`{r ${kind}-x}`, ...options.map((o) => `#| ${o}`), `#| ${kind}-cap: "Cap"`, "plot(1)")
        : chunk("{r}", `#| label: ${kind}-x`, ...options.map((o) => `#| ${o}`), `#| ${kind}-cap: "Cap"`, "plot(1)");

    it.each([
      ["eval: false", "k01, g055"],
      ["eval: False", "p02"],
      ["eval: FALSE", "p03"],
      ["include: false", "k02, g056"],
      ["fig-show: hide", "the dash spelling (p19)"],
      ["fig.show: hide", "the dot spelling (p20)"],
      ["fig-keep: none", "p22"],
      ["fig.keep: none", "p23"],
    ])("%s stops a figure label, whether the label is in the header or in a #| line (%s)", (option) => {
      expect(ids(withPipe("slot", "fig", option))).toEqual([]);
      expect(ids(withPipe("pipe", "fig", option))).toEqual([]);
    });

    it.each([
      ["fig-show: 'hide'", "single quotes (g131)"],
      ['fig-show: "hide"', "double quotes (g132)"],
      ["fig-keep: 'none'", "g133"],
      ["include: False", "g134"],
      ["include: FALSE", "g135"],
      ["include: !expr FALSE", "g136"],
      ["eval: !expr FALSE", "g138"],
      ["output: false", "g061"],
    ])("%s stops a figure label as well (%s)", (option) => {
      expect(ids(withPipe("slot", "fig", option))).toEqual([]);
    });

    it.each([
      ["include: !expr TRUE", "g137"],
      ["output: asis", "g127"],
      ["output: true", "g128"],
      ["fig-show: Hide", "case matters, though quarto rejects the spelling outright (g129)"],
    ])("%s keeps a figure label (%s)", (option) => {
      expect(ids(withPipe("slot", "fig", option))).toEqual(["fig-x"]);
    });

    it.each([
      ["include: false", [], "include hides a table too (g074)"],
      ["eval: false", ["tbl-x"], "eval does not stop a table (g073)"],
      ["fig-show: hide", ["tbl-x"], "fig-show is a figure option (g075)"],
      ["fig-keep: none", ["tbl-x"], "fig-keep is a figure option (g077)"],
      ["results: hide", ["tbl-x"], "results hides text, not the cell (g078)"],
      ["echo: false", ["tbl-x"], "echo hides code (g080)"],
    ])("a table label with %s: %j (%s)", (option, wanted) => {
      expect(ids(withPipe("slot", "tbl", option))).toEqual(wanted);
      expect(ids(withPipe("pipe", "tbl", option))).toEqual(wanted);
    });

    it.each([
      ["results: hide", "p28"],
      ["echo: false", "p29"],
      ["fig-show: hold", "p21"],
      ["fig-keep: last", "p24"],
      ["fig_show: hide", "an underscore is no spelling of the option (p25)"],
      ["Eval: false", "option names are case sensitive (p60)"],
      ["eval: true", "p10-ish control"],
    ])("%s keeps a figure label (%s)", (option) => {
      expect(ids(withPipe("slot", "fig", option))).toEqual(["fig-x"]);
      expect(ids(withPipe("pipe", "fig", option))).toEqual(["fig-x"]);
    });

    it("a leading #| line wins over the header, in both directions (g091-g100, p30, p31)", () => {
      // header says stop, the pipe says go
      expect(ids(chunk("{r fig-x, eval=FALSE}", "#| eval: true", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      expect(ids(chunk("{r fig-x, include=FALSE}", "#| include: true", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      expect(ids(chunk("{r fig-x, fig.show='hide'}", "#| fig-show: asis", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      expect(ids(chunk("{r fig-x, fig.keep='none'}", "#| fig.keep: all", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      // header says go, the pipe says stop
      expect(ids(chunk("{r fig-x, eval=TRUE}", "#| eval: false", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
      expect(ids(chunk("{r fig-x, include=TRUE}", "#| include: false", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });
  });

  describe("every shape rendered with quarto 1.7.33, document by document", () => {
    // `[extension, engine, quartoDefined, indexDefined, document]`, 795 distinct documents from `scratchpad/s304`
    // (`grid`, `grid2`, `grid3` and six blind lenses): the suppressors in every spelling, the document defaults, the
    // code contents, the indirection shapes and Jupyter. `quartoDefined` is what the rendered HTML says; `indexDefined`
    // is what this index answered when the fixture was written. A document that made quarto exit non-zero, or whose id
    // the HTML cannot decide, is omitted. This is Learning #685's closed-world pin: every row is pinned at BOTH, so a
    // rule that starts removing a label quarto defines, or that stops removing one it no longer should, fails here.
    type Row = [string, string, boolean, boolean, string];
    const FIXTURE = path.join(__dirname, "../fixtures/no-target-shapes/quarto-1.7.33.json");
    const rows = (JSON.parse(readFileSync(FIXTURE, "utf8")) as { rows: Row[] }).rows;
    const shape = (text: string): string =>
      text
        .replace(/^---\ntitle: "t"\n/, "")
        .replace(/\n---\n\nSee @\S+\.\n\n/, "\n")
        .replace(/\n+$/, "")
        .replace(/\n/g, " ⏎ ")
        .slice(0, 150);
    const verdicts = (r: Row): "agree" | "PHANTOM" | "LOST" => (r[2] === r[3] ? "agree" : r[3] ? "PHANTOM" : "LOST");
    const found = (r: Row): boolean => {
      const id = /See @((?:fig|tbl)-x)\./.exec(r[4])?.[1] ?? "";
      return indexLabels(r[4], resolveDocumentEngine("a" + r[0], r[4])).some((l) => l.id === id);
    };

    it("covers the whole fixture: 795 documents, 486 of which quarto defines the label for", () => {
      expect(rows).toHaveLength(795);
      expect(rows.filter((r) => r[2])).toHaveLength(486);
    });

    it("the index agrees with quarto on 675 documents and is wrong on 120, and NO label quarto defines is missing but three", () => {
      expect(rows.filter((r) => verdicts(r) === "agree")).toHaveLength(675);
      expect(rows.filter((r) => verdicts(r) === "PHANTOM")).toHaveLength(117);
      expect(rows.filter((r) => verdicts(r) === "LOST")).toHaveLength(3);
    });

    it("…and those three are all the Session 164 decline: the engine resolver gives up on a flow `execute: {…}`", () => {
      for (const r of rows.filter((x) => verdicts(x) === "LOST")) {
        expect(r[4]).toContain("execute: {eval: false}");
      }
    });

    it.each(rows.map((r) => [shape(r[4]), r] as const))("%s", (_shape, r) => {
      expect(found(r)).toBe(r[3]);
    });
  });
});
