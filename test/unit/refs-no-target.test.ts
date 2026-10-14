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

    describe("fig.show and fig.keep decide nothing: they hide PLOTS, and what a chunk makes is not known here", () => {
      // Measured: on a base R plot `fig.show='hide'` and `fig.keep='none'` leave the figure undefined (k12, g005, g006, h28,
      // h36, h38), but the same options leave the target DEFINED when the chunk's output is a table (hunt kind-trap f20, f21), and
      // `fig.keep='none'` leaves a python (matplotlib) plot defined (f07, f10, f47). Which of these a chunk is depends on its
      // code, so the rule would remove a label quarto defines; the base-plot phantom is kept instead.
      it.each([
        ["{r fig-x, fig.show='hide'}", "k12, g005"],
        ['{r fig-x, fig.show="hide"}', "h28"],
        ["{r fig-x, fig.keep='none'}", "g006, h36"],
        ['{r fig-x, fig.keep="none"}', "g100"],
      ])("%s keeps the label, a base plot included (%s)", (header) => {
        expect(ids(chunk(header, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      });

      it.each([
        ["fig.show='hide'", "f20"],
        ["fig.keep='none'", "f21"],
      ])("a figure label on table code with %s is DEFINED in quarto (%s), and stays", (option) => {
        expect(ids(chunk(`{r fig-x, ${option}}`, '#| fig-cap: "Cap"', "knitr::kable(head(cars, 2))"))).toEqual(["fig-x"]);
      });

      it("a python plot run by knitr with fig.keep='none' is DEFINED in quarto (f07, f10), and stays", () => {
        const doc = "---\nengine: knitr\n---\n" + chunk("{python fig-x, fig.keep='none'}", '#| fig-cap: "Cap"', "import matplotlib.pyplot as plt", "plt.plot([1, 2])", "plt.show()");
        expect(ids(doc)).toEqual(["fig-x"]);
      });

      it.each([
        ["fig-show: hide", "p19"],
        ["fig.show: hide", "p20"],
        ["fig-keep: none", "p22"],
        ["fig.keep: none", "p23"],
        ["fig-show: 'hide'", "g131"],
        ['fig-show: "hide"', "g132"],
        ["fig-keep: 'none'", "g133"],
      ])("the pipe spelling %s keeps the label too (%s)", (option) => {
        expect(ids(chunk("{r}", "#| label: fig-x", `#| ${option}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
        expect(ids(chunk("{r fig-x}", `#| ${option}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      });
    });

    it.each([
      ["eval=FALSE", "a literal"],
      ["eval = FALSE", "spaces around = (h01)"],
      ["eval=F", "the short spelling (k10)"],
      ["eval=TRUE, eval=FALSE", "the last assignment wins (h27)"],
      ["include=F", "include, short spelling (h19)"],
      ["echo=FALSE, eval=FALSE", "beside a harmless option (p35)"],
    ])("a header value that is false stops the figure: %s — %s", (options) => {
      expect(ids(chunk(`{r fig-x, ${options}}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    describe("a value R evaluates is read ONLY when it is the literal FALSE or an F the document never rebinds", () => {
      // knitr evaluates a header value as R code in the document's own session, so anything but the reserved word FALSE can
      // mean something else: `F` is an ordinary variable, and `(`, `||`, `&`, `|` and `!` can be redefined (hunt hdr-trap
      // a01-a05, a45, pipe-trap b14-b19, struct-trap e11, e12, e31: all rendered, the label DEFINED). The logical
      // expressions that DO evaluate as written (`!TRUE`, `FALSE & TRUE`: h06, h07, h21) are left as phantoms for the same reason.
      it.each([
        ["F <- TRUE", "a01"],
        ["F = TRUE", "an equals assignment"],
        ["F <<- TRUE", "a global assignment"],
        ["TRUE -> F", "a right assignment"],
        ['assign("F", TRUE)', "assign()"],
        ["x <- c(F <- TRUE)", "an assignment inside a call"],
      ])("%s earlier in the document keeps a chunk with eval=F, include=F and output=F (%s)", (setup) => {
        for (const option of ["eval=F", "include=F", "output=F"]) {
          const text = [chunk("{r setup, include=FALSE}", setup), "", chunk(`{r fig-x, ${option}}`, '#| fig-cap: "Cap"', "plot(1)")].join("\n");
          expect(ids(text)).toEqual(["fig-x"]);
        }
      });

      it("…even when the rebinding sits in the header itself (a04) or in another chunk's python or comment text", () => {
        expect(ids(chunk("{r fig-x, my.opt=(F <- TRUE), eval=F}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      });

      it("a literal FALSE cannot be rebound, so it still removes the label with F rebound (a01 control)", () => {
        const text = [chunk("{r setup, include=FALSE}", "F <- TRUE"), "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
        expect(ids(text)).toEqual([]);
      });

      it.each([
        ["eval=!TRUE", "h06"],
        ["eval=FALSE & TRUE", "h07"],
        ["eval=FALSE || FALSE", "b16"],
        ["eval=(FALSE)", "b17"],
        ["eval=!TRUE & !TRUE", "an expression"],
        ["include=!TRUE", "h21"],
        ["include=TRUE & FALSE", "b19"],
        ["output=!TRUE", "an expression"],
      ])("a logical expression is not read: %s keeps the label (%s)", (option) => {
        expect(ids(chunk(`{r fig-x, ${option}}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      });

      it.each([
        ["eval: !expr FALSE", "g138"],
        ["include: !expr FALSE", "g136"],
      ])("a pipe %s is the literal FALSE and is read", (option) => {
        expect(ids(chunk("{r fig-x}", `#| ${option}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
      });

      it.each([
        ["eval: !expr FALSE | FALSE", "b18"],
        ["eval: !expr !TRUE", "an expression (quarto rejects it, g139)"],
        ["eval: !expr F", "F is not read in a !expr"],
        ["eval: !expr interactive()", "p11"],
      ])("a pipe %s is an expression and is not read (%s)", (option) => {
        expect(ids(chunk("{r fig-x}", `#| ${option}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      });
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

  describe("a document that can rewrite options, or keep what it hides, is not read", () => {
    // `opts_hooks` run when an option is set and may set another (hunt hdr-trap a06-a09, front-trap c21, struct-trap e13), and a
    // template applied with `opts.label` sets whole bundles of options (a11, c19, c20, f11, f12): in either the header text
    // says one thing and the chunk runs another. All rendered, the label DEFINED. They are R-only words, so the document text
    // is searched for them and every removal is declined (a mention in prose only declines, the safe side).
    it.each([
      ["knitr::opts_hooks$set(my.flag = function(options) { options$eval <- TRUE; options })", "a06, a09"],
      ["knitr::opts_hooks$set(eval = function(options) { options$eval <- TRUE; options })", "a09"],
      ["opts_template$set(on = list(eval = TRUE, include = TRUE))", "a11, c19, c20"],
    ])("%s keeps a chunk with eval=FALSE or include=FALSE (%s)", (setup) => {
      for (const header of ["{r fig-x, eval=FALSE, my.flag=TRUE}", "{r fig-x, include=FALSE, opts.label='on'}"]) {
        const text = [chunk("{r setup, include=FALSE}", setup), "", chunk(header, '#| fig-cap: "Cap"', "plot(1)")].join("\n");
        expect(ids(text)).toEqual(["fig-x"]);
      }
    });

    it("a chunk that NAMES a template keeps its label, whatever else the document says (f11)", () => {
      expect(ids(chunk("{r fig-x, opts.label='on', eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
      expect(ids(chunk("{r}", "#| label: fig-x", "#| opts-label: on", "#| eval: false", '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
    });

    it("a document without those words is read as before (control)", () => {
      const text = [chunk("{r setup, include=FALSE}", "library(knitr)"), "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(ids(text)).toEqual([]);
    });

    describe("keep-hidden shows what include, output and echo hide (grid5 g001-g008, g019-g026)", () => {
      const front = "format:\n  html:\n    keep-hidden: true";
      const withKeep = (...chunks: string[]): string => ["---", front, "---", "", ...chunks].join("\n");

      it("so include=FALSE and output=FALSE no longer remove a label, in the header or the pipe", () => {
        expect(ids(withKeep(chunk("{r fig-x, include=FALSE}", '#| fig-cap: "Cap"', "plot(1)")))).toEqual(["fig-x"]);
        expect(ids(withKeep(chunk("{r tbl-x, include=FALSE}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))")))).toEqual(["tbl-x"]);
        expect(ids(withKeep(chunk("{r fig-x}", "#| include: false", '#| fig-cap: "Cap"', "plot(1)")))).toEqual(["fig-x"]);
        expect(ids(withKeep(chunk("{r fig-x}", "#| output: false", '#| fig-cap: "Cap"', "plot(1)")))).toEqual(["fig-x"]);
      });

      it("…but eval=FALSE and an empty body still do (g004, g005)", () => {
        expect(ids(withKeep(chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")))).toEqual([]);
        expect(ids(withKeep(chunk("{r fig-x}", '#| fig-cap: "Cap"')))).toEqual([]);
      });

      it("and the Jupyter rules built on include and echo no longer remove a cell, while an empty source does (g006-g009)", () => {
        const jup = (...options: string[]): string =>
          ["---", "jupyter: python3", front, "---", "", chunk("{python}", "#| label: fig-x", ...options.map((o) => `#| ${o}`), '#| fig-cap: "Cap"', "plt.plot([1])")].join("\n");
        const jids = (text: string): string[] => indexLabels(text, "jupyter").map((l) => l.id);
        expect(jids(jup("include: false"))).toEqual(["fig-x"]);
        expect(jids(jup("echo: false", "eval: false"))).toEqual(["fig-x"]);
        expect(jids(jup("echo: false", "output: false"))).toEqual(["fig-x"]);
        const empty = ["---", "jupyter: python3", front, "---", "", chunk("{python}", "#| label: fig-x", '#| fig-cap: "Cap"')].join("\n");
        expect(jids(empty)).toEqual([]);
      });
    });
  });

  describe("a document whose engine this cannot decode, or whose code is called by a built name, is not read", () => {
    // The engine resolver reads the front matter as plain text, so a key spelled with a YAML escape (`"kni\\x74r":`, `"eng\\x69ne":`)
    // is a key it cannot see: quarto runs knitr and the resolver answers Jupyter (hunt front-trap c47, c48, rendered: the label
    // IS defined). A wrong engine now costs a label, not just a phantom, so such a document is not judged at all.
    const jids = (text: string): string[] => indexLabels(text, "jupyter").map((l) => l.id);

    it.each([
      ['"kni\\x74r":\n  opts_chunk:\n    comment: "#>"', "c47"],
      ['"eng\\x69ne": knitr', "c48"],
      ["'a\\tb': 1", "a single-quoted key with an escape"],
    ])("a front-matter key %s keeps every label (%s)", (key) => {
      const text = ["---", "jupyter: python3", key, "---", "", chunk("{python}", "#| label: tbl-x", '#| tbl-cap: "Cap"')].join("\n");
      expect(jids(text)).toEqual(["tbl-x"]);
      const echo = ["---", key, "---", "", chunk("{python}", "#| label: tbl-x", "#| echo: false", '#| tbl-cap: "Cap"', "# nothing to show")].join("\n");
      expect(jids(echo)).toEqual(["tbl-x"]);
    });

    it("a plain key is no such thing (control)", () => {
      const text = ["---", "jupyter: python3", "---", "", chunk("{python}", "#| label: tbl-x", '#| tbl-cap: "Cap"')].join("\n");
      expect(jids(text)).toEqual([]);
    });

    it("RESIDUAL — a read_chunk call whose name is BUILT from strings is invisible, and the empty chunk it fills loses its label (hunt a10)", () => {
      const text = [
        chunk("{r a10setup, include=FALSE}", 'rc <- get(paste0("read_", "chunk"), envir = asNamespace("knitr"))', 'rc(lines = c("## ---- fig-x", "plot(1:10)"))'),
        "",
        chunk("{r fig-x}", '#| fig-cap: "Cap"'),
      ].join("\n");
      expect(ids(text)).toEqual([]);
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

    it.each([
      ["ref-label: src", "the dashed spelling of ref.label (b10, f13): quarto reads it as the same option"],
      ["ref.label: src", "the dotted spelling in the pipe"],
      ["child: part.qmd", "child= brings a document in (pipe spelling)"],
      ["file: plots.R", "file= (pipe spelling)"],
      ["code: plot(1)", "code= (pipe spelling)"],
    ])("a pipe that brings code from elsewhere keeps the label of an empty chunk: %s — %s", (option) => {
      expect(ids(chunk("{r}", "#| label: fig-x", `#| ${option.replace("code: plot(1)", "code: 'plot(1)'")}`, '#| fig-cap: "Cap"'))).toEqual(["fig-x"]);
    });

    it("…and so does a header child= beside a pipe label (the header label itself is not read there, e60)", () => {
      expect(ids(chunk("{r, child='part.qmd'}", "#| label: fig-x", '#| fig-cap: "Cap"'))).toEqual(["fig-x"]);
    });

    it("an engine= in the PIPE hands the chunk to another engine, which is not measured (declined)", () => {
      expect(ids(chunk("{r}", "#| label: fig-x", "#| engine: bash", '#| fig-cap: "Cap"'))).toEqual(["fig-x"]);
      expect(ids(chunk("{r}", "#| label: fig-x", "#| engine: python", "#| eval: false", '#| fig-cap: "Cap"', "print(1)"))).toEqual(["fig-x"]);
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
      expect(ids(doc("{python}", "#| label: fig-x", "#| eval: false", '#| fig-cap: "Cap"', "print(1)"))).toEqual([]);
      expect(ids(doc("{python}", "#| label: fig-x", "#| output: false", '#| fig-cap: "Cap"', "print(1)"))).toEqual([]);
      expect(ids(doc("{python fig-x, eval=FALSE}", "#| eval: true", '#| fig-cap: "Cap"', "print(1)"))).toEqual(["fig-x"]);
    });
  });

  describe("the DOCUMENT's own defaults are not read", () => {
    // Session 304 first read them — `execute:`, `knitr: opts_chunk:` and a top-level `eval`/`include` — and 131 rendered rows
    // agreed. Its white-box hunt then broke the reader in the dangerous direction on 28 documents (hunt front-trap c01-c21,
    // c34, c38, c43, kind-trap f11, struct-trap e45-e48), all rendered with quarto 1.7.33 where the label IS defined:
    //  - a line that reads `eval: false` inside a multi-line quoted front-matter string is no key (c01-c11, c43);
    //  - `opts_chunk: {eval:false}` with no space after the colon is a string key, not `eval` (c15, c34);
    //  - a key spelled with an escape (`"ev\x61l": true`) is `eval`, one the reader cannot see (c12, c14, c16);
    //  - a `---` block lower down in the document changes the setting (c38);
    //  - a chunk template or hook that sets the option back (c19-c21, f11), and a spaced `# | include: true` Jupyter
    //    override (d17-d19, e45-e48);
    //  - what the document cannot say at all: a project `_quarto.yml` or a profile (`knitr: opts_chunk` there beats the
    //    document's own `execute:`), so the same text means two things.
    // A default is a statement about EVERY chunk, so one wrong reading removes labels in bulk; and a document that sets
    // `eval: false` for itself and also labels figures is rare (0 of 216 labelled cells of the authored corpus). So nothing
    // is read: the phantom of g111, g114, g123, g126 and g059 stays, and `knitrDocumentDefaults` stays the Outline's alone.
    const withFront = (front: string, ...rest: string[]): string => ["---", front, "---", "", ...rest].join("\n");
    const figure = chunk("{r fig-x}", '#| fig-cap: "Cap"', "plot(1)");
    const table = chunk("{r tbl-x}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))");

    it.each([
      ["execute:\n  eval: false", "g111, d01"],
      ["execute:\n  include: false", "g114, d05"],
      ["knitr:\n  opts_chunk:\n    eval: false", "g123, d22"],
      ["knitr:\n  opts_chunk:\n    include: false", "g126, d23"],
      ["knitr:\n  opts_chunk: {eval: false}", "grid4 g008"],
      ["eval: false", "a top-level key (g059)"],
      ["include: false", "a top-level key (g060)"],
      ['abstract: "Alpha\neval: false\nomega"', "a line inside a quoted string is no key (c01)"],
      ["knitr:\n  opts_chunk: {eval:false}", "no space after the colon: a string key (c34)"],
      ['eval: false\nexecute:\n  "ev\\x61l": true', "a key spelled with an escape (c12)"],
    ])("a figure label under %s is kept (%s)", (front) => {
      expect(ids(withFront(front, figure))).toEqual(["fig-x"]);
    });

    it.each([
      ["execute:\n  include: false", "g147"],
      ["knitr:\n  opts_chunk:\n    include: false", "g159"],
      ["include: false", "g078"],
      ["knitr:\n  opts_chunk: {include:false}", "c15"],
    ])("and so is a TABLE label under %s (%s)", (front) => {
      expect(ids(withFront(front, table))).toEqual(["tbl-x"]);
    });

    it("a block lower in the document that flips the setting is not an issue, because the first is not read either (c38)", () => {
      const text = ["---", "execute:", "  eval: false", "---", "", figure, "", "---", "execute:", "  eval: true", "---"].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
    });

    it("a chunk's OWN option still decides, with or without a front matter (a15, k01)", () => {
      expect(ids(withFront("execute:\n  echo: true", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")))).toEqual([]);
      expect(ids(chunk("{r fig-x}", "#| eval: false", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
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

    describe("the document's own include is not read (see the front matter block above)", () => {
      const doc = (front: string, ...options: string[]): string => ["---", "jupyter: python3", front, "---", "", cell("fig", options, ...FIG)].join("\n");

      it.each([
        ["execute:\n  include: false", "g287"],
        ["include: false", "a top-level key (k053)"],
      ])("%s keeps the cell's label although quarto drops the cell (%s)", (front) => {
        expect(jids(doc(front))).toEqual(["fig-x"]);
      });

      it("a cell's OWN include: false still drops it, whatever the front matter says (g243, m005)", () => {
        expect(jids(doc("execute:\n  include: true", "include: false"))).toEqual([]);
        expect(jids(doc("execute:\n  echo: true", "include: false"))).toEqual([]);
      });

      it("the document's eval, echo and output are not read either (g285, k052)", () => {
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

  describe("a cell the scanner may have cut short is not judged (hunt struct-trap e01-e08, e43)", () => {
    // The cell scanner closes a cell at a fence of the same run whatever its indent, but quarto closes it only at a fence at
    // the OPENER'S OWN indent. A document with a stray, differently indented ``` line inside a cell therefore reaches the
    // rules with a body that ends early: the cell looks EMPTY, though quarto reads the rest as code and defines the label.
    // Rendered: the label defined in every row below.
    const jids = (text: string): string[] => indexLabels(text, "jupyter").map((l) => l.id);
    const jupyterDoc = (...cell: string[]): string => ["---", "jupyter: python3", "---", "", ...cell].join("\n");
    const CODE = ["import matplotlib.pyplot as plt", "plt.plot([1, 2, 3])", "plt.show()"];

    it.each([
      ["four spaces", "    "],
      ["a tab", "\t"],
      ["one space", " "],
    ])("a Jupyter cell with a stray fence indented by %s keeps its label, though the body the scanner sees is empty (e01, e03)", (_what, pad) => {
      const text = jupyterDoc("```{python}", "#| label: fig-x", '#| fig-cap: "Cap"', "#| eval: false", pad + "```", ...CODE, "```");
      expect(jids(text)).toEqual(["fig-x"]);
    });

    it("…and so does one inside a list item, the stray fence indented deeper than the item (e05)", () => {
      const text = jupyterDoc("1. Step one", "", "   ```{python}", "   #| label: fig-x", '   #| fig-cap: "Cap"', "   #| eval: false", "        ```", ...CODE.map((l) => "   " + l), "   ```");
      expect(jids(text)).toEqual(["fig-x"]);
    });

    it("…and so does echo: false with a comment before the stray fence (e43)", () => {
      const text = jupyterDoc("```{python}", "#| label: fig-x", '#| fig-cap: "Cap"', "#| echo: false", "# set up", "    ```", ...CODE, "```");
      expect(jids(text)).toEqual(["fig-x"]);
    });

    it("a knitr chunk is the same: an empty-looking body behind a stray fence keeps the label", () => {
      expect(ids(["```{r fig-x}", '#| fig-cap: "Cap"', "    ```", "plot(1)", "```"].join("\n"))).toEqual(["fig-x"]);
    });

    it("an UNTERMINATED fence is no cell to the scanner, so it defines nothing here, as before this session and as in quarto", () => {
      expect(ids(["```{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)"].join("\n"))).toEqual([]);
      expect(ids(["```{r fig-x}", '#| fig-cap: "Cap"', "plot(1)"].join("\n"))).toEqual([]);
      expect(jids(jupyterDoc("```{python}", "#| label: fig-x", "#| include: false"))).toEqual([]);
    });

    it("a properly closed cell is judged as before, indented or not (control)", () => {
      expect(jids(jupyterDoc("```{python}", "#| label: fig-x", "#| include: false", "```"))).toEqual([]);
      expect(jids(jupyterDoc("- item", "", "  ```{python}", "  #| label: fig-x", "  #| include: false", "  ```"))).toEqual([]);
    });

    it("a longer opener needs a closer as long (a four-backtick cell is not closed by three)", () => {
      expect(jids(jupyterDoc("````{python}", "#| label: fig-x", '#| fig-cap: "Cap"', "#| eval: false", "```", ...CODE, "````"))).toEqual(["fig-x"]);
    });
  });

  describe("only the language `python`, spelled so, is a Jupyter cell the rules read", () => {
    it.each([["Python"], ["PYTHON"]])("a {%s} cell with include: false keeps its label (quarto reads no cell from this token: S301, and no probe measured it)", (lang) => {
      const text = ["---", "jupyter: python3", "---", "", chunk(`{${lang}}`, "#| label: fig-x", "#| include: false", '#| fig-cap: "Cap"', "plt.plot([1])")].join("\n");
      expect(indexLabels(text, "jupyter").map((l) => l.id)).toEqual(["fig-x"]);
    });

    it.each([["Rcpp"], ["rx"], ["pythonx"], ["RR"]])("a knitr {%s} chunk is not r or python, so it keeps its label", (lang) => {
      expect(ids(chunk(`{${lang} fig-x, eval=FALSE}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
    });

    it("an uppercase {R fig-x} chunk is the r engine (S286: KNITR_SILENT_ENGINES) and is read", () => {
      expect(ids(chunk("{R fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    it("a header the argument splitter declines keeps the label and does not throw", () => {
      expect(ids(chunk("{r, label='fig-x' # c\n}", '#| fig-cap: "Cap"'))).toEqual([]);
      expect(ids(chunk("{r}", "#| label: fig-x", '#| fig-cap: "Cap"'))).toEqual([]);
      expect(() => indexLabels(["```{r, `a`=1}", "#| label: fig-x", '#| fig-cap: "Cap"', "```"].join("\n"), "knitr")).not.toThrow();
      expect(ids(["```{r, `a`=1}", "#| label: fig-x", '#| fig-cap: "Cap"', "```"].join("\n"))).toEqual(["fig-x"]);
    });
  });

  describe("other label kinds and indented cells", () => {
    it.each([["lst"], ["eq"], ["sec"]])("a %s- id on a cell is not judged by these rules (they measure figures and tables only)", (kind) => {
      expect(ids(chunk("{r}", `#| label: ${kind}-x`, "#| include: false", "plot(1)"))).toEqual([`${kind}-x`]);
    });

    it.each([
      ["- item", "  ", "eval=FALSE", "fig", [], "n017"],
      ["- item", "  ", "include=FALSE", "fig", [], "n018"],
      ["- item", "  ", "include=FALSE", "tbl", [], "n027"],
      ["- item", "  ", "eval=FALSE", "tbl", ["tbl-x"], "n026"],
      ["1. item", "   ", "eval=FALSE", "fig", [], "n023"],
    ] as const)("a cell in a list item reads its own options: %s, %s %s, a %s label (%s)", (item, pad, option, kind, wanted, _probe) => {
      const body = kind === "fig" ? "plot(1)" : "knitr::kable(head(cars, 2))";
      const text = [item, "", `${pad}\`\`\`{r ${kind}-x, ${option}}`, `${pad}#| ${kind}-cap: "Cap"`, pad + body, `${pad}\`\`\``].join("\n");
      expect(ids(text)).toEqual(wanted.length === 0 && kind === "tbl" ? [] : wanted.length === 0 ? [] : wanted);
    });

    it("…and its pipe options (n019, n020), after the fence's own indent is stripped", () => {
      const cell = (option: string): string => ["- item", "", "  ```{r}", "  #| label: fig-x", `  #| ${option}`, '  #| fig-cap: "Cap"', "  plot(1)", "  ```"].join("\n");
      expect(ids(cell("eval: false"))).toEqual([]);
      expect(ids(cell("include: false"))).toEqual([]);
      expect(ids(cell("echo: false"))).toEqual(["fig-x"]);
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
    ])("%s stops a figure label, whether the label is in the header or in a #| line (%s)", (option) => {
      expect(ids(withPipe("slot", "fig", option))).toEqual([]);
      expect(ids(withPipe("pipe", "fig", option))).toEqual([]);
    });

    it.each([
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
      // header says go, the pipe says stop
      expect(ids(chunk("{r fig-x, eval=TRUE}", "#| eval: false", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
      expect(ids(chunk("{r fig-x, include=TRUE}", "#| include: false", '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });
  });

  describe("every shape rendered with quarto 1.7.33, document by document", () => {
    // `[extension, engine, quartoDefined, indexDefined, document]`, 1,130 distinct documents from `scratchpad/s304`: the blind
    // grids (`grid`..`grid5`), six blind lenses and six white-box hunters (`hunt/`). The suppressors in every spelling, the
    // document defaults, the code contents, the indirection shapes, Jupyter, and every hazard the hunt found. `quartoDefined` is
    // what the rendered HTML says; `indexDefined` is what this index answered when the fixture was written. A document that made
    // quarto exit non-zero, or whose id the HTML cannot decide, is omitted. This is Learning #685's closed-world pin: every row is
    // pinned at BOTH, so a rule that starts removing a label quarto defines, or stops removing one, fails here and the fixture
    // must be regenerated on purpose. (The probes live in the untracked `scratchpad/`, as every earlier fixture's do.)
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
    const found = (r: Row): boolean => {
      const id = /See @((?:fig|tbl|lst|eq|sec)-x)\./.exec(r[4])?.[1] ?? "";
      return indexLabels(r[4], resolveDocumentEngine("a" + r[0], r[4])).some((l) => l.id === id);
    };
    const against = (r: Row): "agree" | "PHANTOM" | "LOST" => (found(r) === r[2] ? "agree" : found(r) ? "PHANTOM" : "LOST");

    it("covers the whole fixture: 1,130 documents, 665 of which quarto defines the label for", () => {
      expect(rows).toHaveLength(1130);
      expect(rows.filter((r) => r[2])).toHaveLength(665);
    });

    it("the index, run now, agrees with quarto on 856 documents, keeps a phantom on 268 and misses a label on 6", () => {
      const counts = { agree: 0, PHANTOM: 0, LOST: 0 };
      for (const r of rows) {
        counts[against(r)]++;
      }
      expect(counts).toEqual({ agree: 856, PHANTOM: 268, LOST: 6 });
    });

    it("…and every one of the six missed labels has a named cause, five of them older than this session", () => {
      const causes: [RegExp, string][] = [
        [/execute: \{eval: false\}/, "the engine resolver gives up on a flow `execute: {…}` (Session 164): 3 rows, in the parent too"],
        [/label: fig-xx/, "a scanner shape, a cell closed or unclosed against another: 2 rows, in the parent too"],
        [/paste0\("read_", "chunk"\)/, "RESIDUAL: a read_chunk call whose name is built from strings (hunt a10): 1 row, this session's"],
      ];
      for (const r of rows.filter((x) => against(x) === "LOST")) {
        expect(causes.some(([pattern]) => pattern.test(r[4])), shape(r[4])).toBe(true);
      }
    });

    it.each(rows.map((r) => [shape(r[4]), r] as const))("%s", (_shape, r) => {
      expect(found(r)).toBe(r[3]);
    });
  });
});
