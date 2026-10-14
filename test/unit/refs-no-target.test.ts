import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { plainFrontMatter } from "../../src/core/qmd/model";
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
      ["eval=TRUE, eval=FALSE", "the last assignment wins (h27)"],
      ["echo=FALSE, eval=FALSE", "beside a harmless option (p35)"],
    ])("a header value that is FALSE stops the figure: %s — %s", (options) => {
      expect(ids(chunk(`{r fig-x, ${options}}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual([]);
    });

    describe("a value R evaluates is read ONLY when it is the literal FALSE", () => {
      // knitr evaluates a header value as R code in the document's own session, so anything but the reserved word FALSE can
      // mean something else. `F` is an ordinary variable: the white-box hunters rebound it in more than twenty ways (`F <- TRUE`,
      // a backtick or quoted name, `assign(x = "F", ...)`, a `for` variable, `delayedAssign`, `makeActiveBinding`, `list2env`,
      // `attach`, `F[1] <-`, `.GlobalEnv$F`, a sourced file, a child document, reticulate's `r.F`, an `eval(parse(...))` string:
      // hunt a01-a18, a40, b01-b13, f11-f16, all rendered, the label DEFINED), so a guard on the text can never be complete.
      // `eval=F`, `include=F` and `output=F` are therefore left as phantoms (k10, h19 and grid2 g096 measured them undefined).
      // The expressions that DO evaluate as written (`!TRUE`, `FALSE & TRUE`: h06, h07, h21) are left for the same reason.
      it.each([
        ["eval=F", "k10"],
        ["include=F", "h19"],
        ["output=F", "grid2 g096"],
        ["eval = F", "spaced"],
      ])("%s is not read, whatever the document does with F (%s)", (option) => {
        expect(ids(chunk(`{r fig-x, ${option}}`, '#| fig-cap: "Cap"', "plot(1)"))).toEqual(["fig-x"]);
        const rebound = [chunk("{r setup, include=FALSE}", "F <- TRUE"), "", chunk(`{r fig-x, ${option}}`, '#| fig-cap: "Cap"', "plot(1)")].join("\n");
        expect(ids(rebound)).toEqual(["fig-x"]);
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
      ["{r fig-x, output=FALSE}", "grid2 g095"],
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

    it.each([
      ['source("_common.R")', "hunt2 a12, a20, a24: a sourced file may rebind, hook or fill chunks"],
      ['sys.source("_common.R", envir = globalenv())', "the same through sys.source"],
      ["{{< include _setup.qmd >}}", "a09-style: an included file's chunks run first (a15, a19, a25)"],
      ['knitr::knit_child("part.Rmd", quiet = TRUE)', "a child document (a14)"],
      ["knitr::knit_hooks$set(plot = function(x, options) '![](x.png){#fig-x}')", "a knit hook writes markdown (f28, f29)"],
      ['knitr::opts_knit$set(aliases = c(go = "eval"))', "an alias for eval (a22)"],
      ['f <- get(paste0("opts_", "hooks"), envir = asNamespace("knitr"))', "an option hook fetched by a built name (a21, b23, f17)"],
      ['knitr:::opts_hooks', "an internal reached with :::"],
      ['eval(parse(text = paste("opts_", "hooks")))', "an eval(parse()) string"],
    ])("%s keeps a chunk with eval=FALSE or include=FALSE (%s)", (setup) => {
      for (const header of ["{r fig-x, eval=FALSE}", "{r fig-x, include=FALSE}"]) {
        const text = [chunk("{r setup, include=FALSE}", setup), "", chunk(header, '#| fig-cap: "Cap"', "plot(1)")].join("\n");
        expect(ids(text)).toEqual(["fig-x"]);
      }
    });

    it("a pandoc div and prose that mentions none of the words is no such thing (control)", () => {
      const text = ["::: {.callout-note}", "The data is documented below.", ":::", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(ids(text)).toEqual([]);
    });

    it("…while the bare word `source` in PROSE declines too, deliberately: no scan can tell it from a call handed on as a name", () => {
      const text = ["The data source is documented below.", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
    });

    it.each([
      ["knitr::opts_chunk$set(ref.label = 'src')", "a26: a default that gives an empty chunk its code"],
      ["---\nknitr:\n  opts_chunk:\n    ref.label: src\n---", "a27: the same from the front matter"],
    ])("an empty figure chunk is kept when the document names opts_chunk: %s (%s)", (where) => {
      const text = where.startsWith("---") ? [where, "", chunk("{r fig-x}", '#| fig-cap: "Cap"')].join("\n") : [chunk("{r setup, include=FALSE}", where), "", chunk("{r fig-x}", '#| fig-cap: "Cap"')].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
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

  describe("only a PLAIN front matter lets a rule remove a label (the engine resolver reads it as text)", () => {
    // Every rule here depends on which engine runs the document, and the engine resolver finds that by reading the front matter
    // as plain text. Round 2 of the hunt (hunt2 engine-resolution e01-e37, guard-evasion a28-a42, jupyter-visibility d01-d25,
    // option-spelling b14-b21, table-kind f08-f26; 121 rendered documents where the label is DEFINED) blinded it with front
    // matter YAML reads but the resolver does not: a flow mapping, an anchor or complex key, an escaped key or value, one or two
    // spaces of indent on every line, a quoted container key, an apostrophe or a quote inside a flow list, `jupyter: ""`, a BOM,
    // a block that never ends. So a rule removes a label only from a document whose front matter is built of nothing else than
    // plain `key: value` lines, nested by indent, with plain or simply quoted values: a whitelist, since a blacklist of the
    // spellings that blind a text reader can never be complete. The same gate stands for `keep-hidden` spelled in any of those.
    const body = chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)");
    const withFront = (yaml: string): string => ["---", yaml, "---", "", body].join("\n");
    const jbody = chunk("{python}", "#| label: tbl-x", "#| echo: false", "#| eval: false", '#| tbl-cap: "Cap"', "pass");
    const jupyterWith = (yaml: string): string => ["---", yaml, "---", "", jbody].join("\n");
    const jids = (text: string): string[] => indexLabels(text, "jupyter").map((l) => l.id);

    it.each([
      ['title: "A: B"\nauthor:\n  - Jane Doe\n  - John Roe\ndate: 2024-01-31', "quoted colon, list, date"],
      ["title: Plain title\nformat:\n  html:\n    toc: true\n    code-fold: false", "nested blocks"],
      ["title: t\nkeywords: [alpha, beta, gamma]\nbibliography: [a.bib, b.bib]", "plain flow lists"],
      ['title: t\n# a comment: with a colon\nexecute:\n  echo: true', "comments and an execute block"],
      ["title: t\nabstract: |\n  A block scalar may hold anything: even engine: knitr,\n  or eval: false.\nlang: en", "a block scalar"],
      ["title: t\n\nformat:\n  pdf:\n    documentclass: article", "a blank line between keys"],
    ])("a plain front matter still lets the rule fire: %s", (yaml) => {
      expect(ids(withFront(yaml))).toEqual([]);
    });

    it.each([
      ['{title: "t", engine: knitr}', "a flow mapping for the whole block (a33, e08)"],
      [' title: t\n engine: knitr', "every line indented one space (a34, e06)"],
      ['  title: t\n  jupyter: python3', "every line indented two (e05)"],
      ["title: t\n&e engine: knitr", "an anchor on a key (a35, e11, d19)"],
      ["title: t\n? engine\n: knitr", "a complex key (a38, e07, d11)"],
      ['title: t\n? "eng\\x69ne"\n: knitr', "a complex key with an escape (b17)"],
      ['title: t\nengine: "jup\\x79ter"', "an escaped engine value (e01, d13)"],
      ['title: t\nformat: {html: {"keep\\x2dhidden": true}}', "keep-hidden behind an escape in a flow mapping (a28, d01)"],
      ['title: t\n"execute":\n  engine: jupyter', "a quoted container key (e33, e34)"],
      ["title: t\nkeywords: [it's, fine]\nengine: knitr", "an apostrophe inside a flow list (d06, d21)"],
      ['title: t\nkeywords: [5" pipe, x]\nengine: knitr', "a double quote inside a flow list (d08)"],
      ['title: t\njupyter: "" # none', "an empty quoted jupyter key (e23)"],
      ["title: t\njupyter: ''", "a single-quoted empty jupyter key (e24)"],
      ['title: t\nengine: "knitr"', "a quoted engine value"],
      ["title: t\nnote: first line\n  continued here", "a multi-line plain scalar"],
      ['title: "multi\nline"', "a multi-line quoted scalar (c01)"],
      ["title: t\n\tengine: knitr", "a tab indent"],
      ["title: t\nformat: &fmt\n  html: default", "an anchor on a value"],
      ["title: t\nformat: *fmt", "an alias"],
      ["title: t\nbase: !expr x", "a tag"],
    ])("a front matter built of %s is not plain, so nothing is removed", (yaml, _why) => {
      expect(ids(withFront(yaml))).toEqual(["fig-x"]);
      expect(jids(jupyterWith(yaml))).toEqual(["tbl-x"]);
    });

    it("…a byte order mark before the first --- (e37)", () => {
      expect(ids("\uFEFF---\ntitle: t\n---\n\n" + body)).toEqual(["fig-x"]);
    });

    it("…a --- block that follows a blank line and is never closed (hunt2 e20, e25, e26: quarto sees no front matter)", () => {
      expect(ids(["", "---", "title: t", "", body].join("\n"))).toEqual(["fig-x"]);
    });

    it("an unclosed --- on the FIRST line swallows the document for the scanner, so no cell is found at all (as before this session)", () => {
      expect(ids(["---", "title: t", "", body].join("\n"))).toEqual([]);
    });

    it("a document with no front matter at all, or a --- rule lower down, is plain (a thematic break is no metadata)", () => {
      expect(ids(body)).toEqual([]);
      expect(ids(["Intro.", "", "---", "", body].join("\n"))).toEqual([]);
    });
  });

  describe("plainFrontMatter, the whitelist itself (a pure function: every clause pinned one row at a time)", () => {
    const doc = (...front: string[]): string => ["---", ...front, "---", "", "Body."].join("\n");

    it.each([
      ["", "an empty text"],
      ["Just prose.", "no front matter at all"],
      [doc("title: t"), "a single key"],
      [doc("title: 'It is'"), "a single-quoted value"],
      [doc('title: "A: B"'), "a double-quoted value with a colon"],
      [doc("format:", "  html:", "    toc: true"), "nested mappings"],
      [doc("author:", "  - Jane Doe", "  - John Roe"), "a list under a key with an empty value"],
      [doc("author:", "  - name: Jane", "    email: jane@x.org", "  - name: John", "    email: john@x.org"), "a list of mappings: sibling keys sit deeper than the dash (item-key column)"],
      [doc("abstract: |", "  free text: even a colon", "  - and a dash", "lang: en"), "a block scalar, then a key after it"],
      [doc("abstract: >-", "  folded text", "title: t"), "a folded scalar with a chomp indicator"],
      [doc("# a comment: with a colon", "", "title: t   # trailing comment"), "comments and blank lines"],
      [doc("keywords: [alpha, beta]", "bibliography: [a.bib]"), "plain flow lists"],
      [doc("date: 2024-01-31", "url: https://x.org/a?b=1"), "values holding colons that are not separators"],
      [doc("julia: python3"), "a plain julia key"],
      ["Intro.\n\n---\n\nA thematic break and a table.\n\n| a |\n|---|\n| 1 |", "a thematic break followed by a blank line, and a table rule"],
      ["Title\n---\nA setext heading followed at once by text.", "a setext underline directly under a text line"],
    ])("plain: %s", (text) => {
      expect(plainFrontMatter(text)).toBe(true);
    });

    it.each([
      ["---\ntitle: t\n\nBody.", "an opener that is never closed (P05)"],
      ["\uFEFF---\ntitle: t\n---\n", "a byte order mark"],
      [doc("- name: x"), "a mapping item at the top level (P09)"],
      [doc("- x"), "a plain item at the top level (P14)"],
      [doc("title: a: b"), "a colon followed by a space inside a plain value (P12)"],
      [doc("title:", "\tkey: v"), "a tab indent"],
      [doc("julia: \"\""), "a quoted julia key: false to quarto, truthy to the resolver (P20)"],
      [doc("knitr: ''"), "a single-quoted knitr key"],
      [doc('engine: "knitr"'), "a quoted engine value"],
      [doc("author:", "  - Jane", "      more words"), "an item continued on the next line"],
      [doc("author:", "  - Jane", "      - x"), "an item continued by a deeper item line (P22)"],
      [doc("engine: knitr", "  - x"), "a value continued by a deeper line"],
      [doc("keywords: [a, b", "  c]"), "a flow list that wraps"],
      [doc("abstract: |", "  text", "  more", "  - x", "title"), "a bare word that is no key after a block scalar"],
      [doc("a: b", " c: d"), "a key indented under a plain value"],
      [doc("  title: t"), "every line indented"],
      ["\n---\ntitle: t\n---\n", "a blank line before the opener"],
      [" ---\ntitle: t\n---\n", "an indented opener"],
      [doc("title: a\u00a0b"), "a no-break space"],
      ["Intro.\n\n---\nengine: knitr\n---\n", "a metadata block lower down (P15)"],
      [doc("title: t") + "\n\n---\nengine: knitr\n---\n", "a metadata block below the front matter"],
    ])("not plain: %s", (text) => {
      expect(plainFrontMatter(text)).toBe(false);
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

    it("…in a knitr document too: an escape-spelled engine key means this cannot say which engine runs (c47, c48's other half)", () => {
      const text = ["---", '"eng\\x69ne": jupyter', "---", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
      const plain = ["---", "title: t", "---", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(ids(plain)).toEqual([]);
    });

    it("a plain key is no such thing (control)", () => {
      const text = ["---", "jupyter: python3", "---", "", chunk("{python}", "#| label: tbl-x", '#| tbl-cap: "Cap"')].join("\n");
      expect(jids(text)).toEqual([]);
    });

    it("a read_chunk call whose name is BUILT from strings is caught by the built-name guard (hunt a10, rendered: defined)", () => {
      const text = [
        chunk("{r a10setup, include=FALSE}", 'rc <- get(paste0("read_", "chunk"), envir = asNamespace("knitr"))', 'rc(lines = c("## ---- fig-x", "plot(1:10)"))'),
        "",
        chunk("{r fig-x}", '#| fig-cap: "Cap"'),
      ].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
    });
  });

  describe("front matter the resolver trims and YAML does not, and shapes that could stall or throw (hunt3 plain-gate, robust-perf)", () => {
    // `empty` is a cell the Jupyter rule REMOVES when the front matter is plain (an empty source is dropped), so a test that expects
    // it KEPT shows the gate at work: with `eval: false` alone the label would be kept whatever the gate says.
    const empty = chunk("{python}", "#| label: fig-x", '#| fig-cap: "Cap"');
    const body = empty;
    const jids = (text: string): string[] => indexLabels(text, "jupyter").map((l) => l.id);

    it("control: an empty Jupyter cell under a plain front matter IS removed", () => {
      expect(jids(["---", "title: t", "---", "", empty].join("\n"))).toEqual([]);
    });

    it.each([
      ["\u00a0", "a no-break space"],
      ["\u2003", "an em space"],
      ["\u3000", "an ideographic space"],
      ["\u202f", "a narrow no-break space"],
      ["\u2028", "a line separator"],
      ["\u0085", "a next-line control"],
    ])("%s (%s) at the end of an engine value keeps the label: the resolver trims it and YAML does not", (space) => {
      const text = ["---", `engine: knitr${space}`, "---", "", empty].join("\n");
      expect(jids(text)).toEqual(["fig-x"]);
      const comment = ["---", `engine: knitr${space}# c`, "---", "", empty].join("\n");
      expect(jids(comment)).toEqual(["fig-x"]);
    });

    it("…and a non-ASCII space anywhere else in the front matter is refused too, while an accented letter is not", () => {
      const nbsp = ["---", "title: a\u00a0b", "---", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(indexLabels(nbsp, "knitr").map((l) => l.id)).toEqual(["fig-x"]);
      const accent = ["---", "title: Café, naïve — 日本語", "---", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(indexLabels(accent, "knitr").map((l) => l.id)).toEqual([]);
    });

    it.each([
      ["engine: knitr\n  - x", "a19: YAML reads the value as the one string `knitr - x`"],
      ["execute:\n  engine: knitr\n    - x", "a21: the same one level down"],
      ["engine: knitr\n\n  - x", "a22: the continuation sits across a blank line"],
      ["engine: knitr\n  more words", "a continuation line that is no item"],
    ])("a value continued on the next line (%s) is not plain (%s)", (yaml) => {
      const text = ["---", "title: t", yaml, "---", "", body].join("\n");
      expect(jids(text)).toEqual(["fig-x"]);
    });

    it("…while a key with an EMPTY value followed by an indented list is the ordinary nested shape (control)", () => {
      const ok = ["---", "title: t", "author:", "  - Jane Doe", "  - John Roe", "---", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(indexLabels(ok, "knitr").map((l) => l.id)).toEqual([]);
    });

    it.each([
      ['"keep-hidd\\x65n": true', "a32, a33: an escaped keep-hidden key"],
      ['format:\n  html:\n    "keep-hidd\\x65n": true', "a34: nested, escaped"],
      ["engine: jupyter", "a later block that says engine"],
    ])("a metadata block lower in the document makes the whole document opaque: %s (%s)", (yaml) => {
      const below = [chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)"), "", "---", yaml, "---"].join("\n");
      expect(indexLabels(["---", "title: t", "---", "", below].join("\n"), "knitr").map((l) => l.id)).toEqual(["fig-x"]);
      expect(indexLabels(below, "knitr").map((l) => l.id)).toEqual(["fig-x"]);
    });

    it("…but a thematic break followed by a blank line is no metadata block (control)", () => {
      const text = ["---", "title: t", "---", "", "Intro.", "", "---", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(indexLabels(text, "knitr").map((l) => l.id)).toEqual([]);
    });

    it("an opener that the resolver trims into a front matter (a leading space, a no-break space) is not plain (hunt3 reviewer)", () => {
      for (const lead of [" ", "\u00a0", "  "]) {
        const text = [`${lead}---`, 'engine: "kni\\x74r"', "---", "", chunk("{python}", "#| label: tbl-x", '#| tbl-cap: "Cap"')].join("\n");
        expect(jids(text)).toEqual(["tbl-x"]);
      }
    });

    it("a long run of spaces inside a value costs linear time, not quadratic (a 40,000-space run took 5 s)", () => {
      const run = " ".repeat(40000);
      for (const front of [`subtitle: a${run}b`, `keywords:\n  - a${run}b`, `subtitle: a${run}`]) {
        const text = ["---", "title: t", front, "---", "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
        const started = Date.now();
        indexLabels(text, "knitr");
        expect(Date.now() - started).toBeLessThan(1000);
      }
    });

    it("an enormous indent neither throws nor stalls (a 200,000-space indent made the closer test throw)", () => {
      const pad = " ".repeat(200000);
      const text = ["- item", "", `${pad}\`\`\`{r fig-x, eval=FALSE}`, `${pad}#| fig-cap: "Cap"`, `${pad}plot(1)`, `${pad}\`\`\``].join("\n");
      const started = Date.now();
      expect(() => indexLabels(text, "knitr")).not.toThrow();
      expect(Date.now() - started).toBeLessThan(1000);
    });

    it("a header holding a 12 MB string makes the option reader overflow its stack: the index must not throw, and keeps the label (hunt3 robust-perf f26)", () => {
      const text = ["```{r label=\"fig-x\", \"" + "A".repeat(12_000_000) + "\", eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)", "```"].join("\n");
      let found: string[] = [];
      expect(() => {
        found = indexLabels(text, "knitr").map((l) => l.id);
      }).not.toThrow();
      expect(found).toEqual(["fig-x"]);
    });

    it("thousands of hidden labelled cells cost one pass over the document, not one per cell", () => {
      const cell = (n: number): string => chunk(`{r fig-c${n}, eval=FALSE}`, '#| fig-cap: "Cap"', "plot(1)");
      const text = Array.from({ length: 3000 }, (_, n) => cell(n)).join("\n\n");
      const started = Date.now();
      expect(indexLabels(text, "knitr")).toEqual([]);
      expect(Date.now() - started).toBeLessThan(1500);
    });

    it.each([
      ["knitr::knit_engines$set(python = function(options) knitr::engine_output(options, options$code, 'x'))", "an engine re-registered (hunt3 python-knitr)"],
      ['knitr::set_alias(go = "eval")', "an option alias (set_alias)"],
      ["knit_engines$set(r = function(options) NULL)", "the bare registry"],
    ])("%s keeps a chunk with eval=FALSE (%s)", (setup) => {
      const text = [chunk("{r setup, include=FALSE}", setup), "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(indexLabels(text, "knitr").map((l) => l.id)).toEqual(["fig-x"]);
    });
  });

  describe("a document that can write markdown at run time, or load code by an indirect name, is not read (hunt3)", () => {
    // An id can be minted at run time by anything that emits MARKDOWN (an asis chunk, `Markdown()`, `display()`, an inline R
    // expression, a shortcode, a child document), built from pieces no text scan can join (hunt3 guard-regex b01-b12, b26-b40,
    // anchor-ids e23-e33, python-knitr d08-d13, d42, option-forms c37-c41), and options can be set from another file loaded by a
    // name that is not a `source(` call (b13-b19: `lapply(f, source)`, a backticked `source`, `do.call("source", ...)`,
    // `get("source")`). The sibling file or the string is the part that cannot be seen; the CHANNEL — the word that makes markdown or
    // code possible at all — can. All rendered, the label DEFINED. A mention in prose only declines a removal, the safe side.
    const kept = (text: string): void => {
      expect(ids(text)).toEqual(["fig-x"]);
    };
    const hidden = chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)");

    it.each([
      ["{r gen, results='asis', echo=FALSE}", 'cat("::: {#", "fig-x", "}\\n")', "an asis header with a split anchor (b01, b09, e24)"],
      ["{r gen, results='asis'}", 'cat(sprintf("![Cap](a.png){#%s}\\n", "fig-x"))', "sprintf with the id as an argument (b07, b10, d10, e23)"],
      ["{r gen, results=\"asis\"}", 'cat(paste0("{#", "fig", "-x}"))', "paste0 pieces (b11, c37)"],
      ["{r gen}", "#| results: asis", "a pipe results: asis"],
      ["{r gen}", "#| output: asis", "a pipe output: asis"],
      ["{r gen}", "knitr::asis_output('x')", "asis_output()"],
    ])("an asis channel — %s — keeps a hidden chunk's label (%s)", (header, code) => {
      const gen = header === "{r gen}" && code.startsWith("#|") ? chunk(header, code, "cat('x')") : chunk(header, code);
      kept([hidden, "", gen].join("\n"));
    });

    it.each([
      ['Markdown(f"::: {{#{id}}}")', "an f-string Markdown object (b34, d08)"],
      ["display(Markdown(parts))", "display of markdown (b35)"],
      ['HTML("<div id=\'x\'></div>")', "an HTML object"],
      ["from IPython.display import Markdown", "the markdown display module"],
    ])("a Jupyter markdown object — %s — keeps a hidden cell's label (%s)", (code) => {
      const text = ["---", "jupyter: python3", "---", "", chunk("{python}", "#| label: fig-x", "#| include: false", '#| fig-cap: "Cap"', "plt.plot([1])"), "", chunk("{python}", "#| label: gen", code)].join("\n");
      expect(indexLabels(text, "jupyter").map((l) => l.id)).toEqual(["fig-x"]);
    });

    it.each([
      ["The value is `r 1 + 1` and `r fig_id`.", "inline R (c38, d42)"],
      ["The value is `{python} x`.", "an inline python expression"],
      ["{{< embed _nb.ipynb#fig-x >}}", "an embed shortcode (e33)"],
      ["{{< meta title >}}", "any shortcode"],
    ])("%s keeps a hidden chunk's label (%s)", (line) => {
      kept([line, "", hidden].join("\n"));
    });

    it.each([
      ["{r gen, child='part.qmd'}", "a child chunk (d13, e31)"],
      ["{r gen}\n#| child: part.qmd", "a pipe child"],
    ])("a chunk that names a child document, %s, keeps a hidden chunk's label", (headline) => {
      const [header, ...rest] = headline.split("\n");
      kept([hidden, "", chunk(header, ...rest)].join("\n"));
    });

    it.each([
      ["lapply(c('a.R', 'b.R'), source)", "a bare `source` handed on (b13)"],
      ["`source`('hooks.R')", "a backticked source (b14)"],
      ['do.call("source", list("hooks.R"))', "do.call (b15)"],
      ['get("source")("hooks.R")', "get() (b16)"],
      ["base::eval(base::parse(file = 'hooks.R'))", "base::eval(base::parse()) (b17)"],
      ['getNamespace("knitr")[[paste0("opts_", "hooks")]]', "getNamespace (b18)"],
      ['utils::getFromNamespace("opts_hooks", "knitr")', "getFromNamespace (b19)"],
      ["knitr::knit_expand('tpl.Rmd')", "knit_expand (b06, b33)"],
      ["x <- readLines('frag.md')", "readLines (b27, e30)"],
      ["reticulate::py_run_file('x.py')", "py_run_file (b28)"],
      ["reticulate::source_python('x.py')", "source_python (b29)"],
      ["system2('Rscript', 'x.R')", "system2 (b32)"],
      ["exec(open('x.py').read())", "exec(open().read()) (b40)"],
      ["importlib.import_module('x')", "importlib (b30, b39)"],
    ])("%s keeps a hidden chunk's label (%s)", (setup) => {
      kept([chunk("{r setup, include=FALSE}", setup), "", hidden].join("\n"));
    });

    // One word at a time: each alternative of the guard expressions must decline ALONE, or a mutant that drops it survives behind
    // the other words a richer test document happens to contain (mutation run 3 found twelve such words).
    const setupWord = (snippet: string): string => [chunk("{r setup, include=FALSE}", snippet), "", hidden].join("\n");
    it.each([
      "x <- opts_hooks", "x <- opts_template", "x <- opts_knit", "x <- knit_hooks", "x <- knit_engines", "x <- set_alias",
      'x <- "opts.label"', 'x <- "opts-label"', "x <- knit_child", "x <- knit_expand", "x <- metadata-files", "x <- source",
      "eval(x)", "evalq(x)", "parse(x)", "do.call(f)", "match.fun(f)", "get(x)", "get0(x)", "mget(x)", "exec(x)", "execfile(x)",
      "system(x)", "system2(x)", "getNamespace(x)", "getFromNamespace(x)", "getExportedValue(x)", "asNamespace(x)",
      "loadNamespace(x)", "__import__(x)", "import_module(x)", "importlib", "runpy", "py_run_file(x)", "py_run_string(x)",
      "source_python(x)", "import_from_path(x)", "readLines(x)", "utils:::fun",
    ])("the word in `%s` ALONE keeps a hidden chunk's label", (snippet) => {
      kept(setupWord(snippet));
    });

    it.each([
      'x <- "asis"', "Markdown(x)", "display(x)", "HTML(x)", "from IPython.display import x", "%%markdown", "%%html", "%%latex",
    ])("the markdown channel in `%s` ALONE keeps a hidden chunk's label", (snippet) => {
      kept(setupWord(snippet));
    });

    it("a `.get(` or `dict.get(` method call is no loader, and `display` without a call is none either (controls)", () => {
      expect(ids(setupWord("d.get(1)\nx <- 'display'"))).toEqual([]);
    });

    it.each([["read_chunk"], ["read_demo"], ["read_rforge"], ["knit_code"], ["opts_chunk"]])("`%s` ALONE keeps an EMPTY figure chunk, and only that rule", (word) => {
      const text = [chunk("{r setup, include=FALSE}", `x <- ${word}`), "", chunk("{r fig-x}", '#| fig-cap: "Cap"')].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
      const withEval = [chunk("{r setup, include=FALSE}", `x <- ${word}`), "", hidden].join("\n");
      expect(ids(withEval)).toEqual([]); // eval=FALSE is no empty-body rule: these words do not touch it
    });

    it("the front matter's `metadata-files` pulls in options this text does not show (b41, b42, d37)", () => {
      kept(["---", "title: t", "metadata-files:", "  - _meta.yml", "---", "", hidden].join("\n"));
    });

    it("…and a document with none of these words still has its removal (control)", () => {
      const text = ["The figure is hidden.", "", chunk("{r setup, include=FALSE}", "library(knitr)", "x <- 1"), "", hidden].join("\n");
      expect(ids(text)).toEqual([]);
    });

    it("python's dict.get( and an R `get` as a plain word are no loader (control)", () => {
      const text = ["---", "jupyter: python3", "---", "", chunk("{python}", "#| label: fig-x", "#| include: false", '#| fig-cap: "Cap"', "d = {}", "d.get('k')")].join("\n");
      expect(indexLabels(text, "jupyter").map((l) => l.id)).toEqual([]);
    });
  });

  describe("an id the text writes another way is not removed (hunt2 f20-f23, f43)", () => {
    // A hidden or never-run chunk can carry a label while ANOTHER place writes the same id at run time (a `cat()` of
    // `{#tbl-x}`, a raw `<div id="tbl-x">`): quarto defines it from there, and the index would have answered "defined" only by
    // luck of the hidden chunk. So a label whose id is spelled as an anchor anywhere else in the text is kept.
    it.each([
      ['cat("| a |\\n|---|\\n| 1 |\\n\\n: Cap {#tbl-x}\\n")', "f20: a table caption written by cat() in an asis chunk"],
      ['cat("![Cap](data:image/gif;base64,R0lGODlh){#fig-x}\\n")', "f22: an image written by cat()"],
      ["print('<div id=\"fig-x\"></div>')", "a raw html id written from code"],
    ])("a hidden chunk's label survives when %s", (writer) => {
      const kind = writer.includes("tbl-x") ? "tbl" : "fig";
      const text = [
        chunk(`{r ${kind}-x, include=FALSE}`, `#| ${kind}-cap: "Cap"`, "shown <- 1"),
        "",
        chunk("{r gen, results='asis', echo=FALSE}", writer),
      ].join("\n");
      expect(ids(text)).toEqual([`${kind}-x`]);
    });

    it("…and a raw html anchor in the prose does too (f43)", () => {
      const text = ['<div id="tbl-x">', "", "| a | b |", "|---|---|", "| 1 | 2 |", "", "</div>", "", chunk("{r tbl-x, include=FALSE}", "shown <- 1")].join("\n");
      expect(ids(text)).toEqual(["tbl-x"]);
    });

    it.each([
      ['<div id=tbl-x>', "an UNQUOTED id (d11, e17, b05, c40)"],
      ['<DIV ID="tbl-x">', "upper case"],
      ["![Cap](a.png){\n#tbl-x}", "an attribute block split by a newline (e10, c41, e15)"],
      ["![Cap](a.png){.shot #tbl-x}", "a class before the id"],
      ["![Cap](a.png){width=50%#tbl-x}", "a value glued to the id (e13)"],
    ])("an id spelled as %s elsewhere keeps the hidden chunk's label (%s)", (anchor) => {
      const kind = "tbl";
      const text = [anchor, "", chunk(`{r ${kind}-x, include=FALSE}`, `#| ${kind}-cap: "Cap"`, "knitr::kable(head(cars))")].join("\n");
      expect(ids(text)).toEqual(["tbl-x"]);
    });

    it("an anchor pandoc sanitises counts as the id it becomes: `{#tbl-x$y}` is `tbl-xy` (hunt3 anchor-ids; the prose scan alone reads `tbl-x`)", () => {
      const text = ["| a |", "|---|", "| 1 |", "", ": Cap {#tbl-x$y}", "", chunk("{r tbl-xy, include=FALSE}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars))")].join("\n");
      expect(ids(text)).toContain("tbl-xy");
    });

    it.each([
      ['<div id="tbl&#45;x">', "a decimal character entity (hunt3 e19)"],
      ['<div id="tbl&#x2d;x">', "a hexadecimal entity"],
    ])("an id spelled with %s still counts as written there", (anchor) => {
      const text = [anchor, "", chunk("{r tbl-x, include=FALSE}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars))")].join("\n");
      expect(ids(text)).toEqual(["tbl-x"]);
    });

    it("a link TO the id, or a reference to it, is no anchor: the hidden chunk's label is still removed (control)", () => {
      const text = ["See [the table](#tbl-x) and @tbl-x.", "", chunk("{r tbl-x, include=FALSE}", '#| tbl-cap: "Cap"', "knitr::kable(head(cars, 2))")].join("\n");
      expect(ids(text)).toEqual([]);
    });

    it("another id's anchor is no reason to keep this one (control)", () => {
      const text = ['![Cap](a.png){#fig-other}', "", chunk("{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)")].join("\n");
      expect(ids(text)).toEqual(["fig-other"]);
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
      ["a tab-only line", ["\t"]],
      ["a space then a tab", [" \t"]],
      ["a tab and a comment", ["\t# nothing"]],
      ["blank, tab, blank", ["", "\t", ""]],
    ])("an R chunk holding %s defines no figure label (k14, c02, c03, grid2 g157-g161, grid6 g001-g017)", (_what, code) => {
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

    it("the Jupyter rules honour the same guard: `metadata-files` can set keep-hidden from a sibling (hunt3 b42)", () => {
      const text = ["---", "jupyter: python3", "metadata-files:", "  - keep.yml", "---", "", chunk("{python}", "#| label: tbl-x", "#| include: false", '#| tbl-cap: "Cap"', "pd.DataFrame({'a': [1]})")].join("\n");
      expect(indexLabels(text, "jupyter").map((l) => l.id)).toEqual(["tbl-x"]);
      const plain = ["---", "jupyter: python3", "---", "", chunk("{python}", "#| label: tbl-x", "#| include: false", '#| tbl-cap: "Cap"', "pd.DataFrame({'a': [1]})")].join("\n");
      expect(indexLabels(plain, "jupyter").map((l) => l.id)).toEqual([]);
    });

    it.each([
      ["{r, child='part.md', include=FALSE}", ["#| label: tbl-x"], "a child= in the header (hunt3 d13)"],
      ["{r, include=FALSE}", ["#| label: tbl-x", "#| child: part.md"], "a child: in the pipe"],
    ])("a cell that carries its OWN child document keeps its label even when it is hidden: %s (%s)", (header, pipe) => {
      expect(ids(chunk(header, ...pipe, '#| tbl-cap: "Cap"'))).toEqual(["tbl-x"]);
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
      ["a tab-only line", ["\t"]],
      ["a space then a tab", [" \t"]],
      ["blank, tab, blank", ["", "\t", ""]],
    ])("a cell with %s has no source and is dropped (grid2 k025-k030, k037-k042; grid6 g003-g020)", (_what, code) => {
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

    it("a tab before a comment is still a comment: shown without echo: false (grid6 g013, g015), nothing with it (g014)", () => {
      expect(jids(cell("fig", [], "\t# nothing"))).toEqual(["fig-x"]);
      expect(jids(cell("tbl", [], "\t# nothing"))).toEqual(["tbl-x"]);
      expect(jids(cell("fig", ["echo: false"], "\t# nothing"))).toEqual([]);
    });

    it.each([["no"], ["off"], ["n"], ["'false'"]])("echo/include: %s is not read: quarto refuses the document, so nothing is removed (grid g248-g252)", (v) => {
      expect(jids(cell("fig", [`include: ${v}`], ...FIG))).toEqual(["fig-x"]);
      expect(jids(cell("fig", [`echo: ${v}`, "eval: false"], ...FIG))).toEqual(["fig-x"]);
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

    it("a closer indented with NO-BREAK spaces is a closer to the scanner and no closer at the opener's indent: nothing is removed", () => {
      const text = ["- item", "", "  ```{r fig-x, eval=FALSE}", '  #| fig-cap: "Cap"', "  plot(1)", "\u00a0\u00a0```"].join("\n");
      expect(ids(text)).toEqual(["fig-x"]);
      const ascii = ["- item", "", "  ```{r fig-x, eval=FALSE}", '  #| fig-cap: "Cap"', "  plot(1)", "  ```"].join("\n");
      expect(ids(ascii)).toEqual([]);
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
    // `[extension, engine, quartoDefined, indexDefined, parentDefined, document]`, 1,611 distinct documents from `scratchpad/s304`:
    // the blind grids (`grid`..`grid6`), six blind lenses, and eighteen white-box hunters in three rounds (`hunt/`, `hunt2/`, `hunt3/`): the
    // suppressors in every spelling, the document defaults, the code contents, the indirection shapes, Jupyter, and every hazard
    // the hunts found. `quartoDefined` is what the rendered HTML says; `indexDefined` is what this index answered when the fixture
    // was written; `parentDefined` is what it answered BEFORE Session 304. A document that made quarto exit non-zero, or whose
    // id the HTML cannot decide, or that normalising its label name cannot reproduce (an id spelled in pieces or as an entity, a
    // sibling file), or that runs past 20 KB (a robustness probe, timed elsewhere), is omitted. This is Learning #685's closed-world pin: every row is pinned, so a rule that starts
    // removing a label quarto defines, or stops removing one, fails here and the fixture must be regenerated on purpose.
    // (The probes live in the untracked `scratchpad/`, as every earlier fixture's do.)
    type Row = [string, string, boolean, boolean, boolean, string];
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
      const id = /See @((?:fig|tbl|lst|eq|sec)-x)\./.exec(r[5])?.[1] ?? "";
      return indexLabels(r[5], resolveDocumentEngine("a" + r[0], r[5])).some((l) => l.id === id);
    };
    const against = (r: Row): "agree" | "PHANTOM" | "LOST" => (found(r) === r[2] ? "agree" : found(r) ? "PHANTOM" : "LOST");

    it("covers the whole fixture: 1,611 documents, 949 of which quarto defines the label for", () => {
      expect(rows).toHaveLength(1611);
      expect(rows.filter((r) => r[2])).toHaveLength(949);
    });

    it("the index, run now, agrees with quarto on 1,233 documents (the parent did on 934), keeps a phantom on 346 and misses a label on 32", () => {
      const counts = { agree: 0, PHANTOM: 0, LOST: 0 };
      for (const r of rows) {
        counts[against(r)]++;
      }
      expect(counts).toEqual({ agree: 1233, PHANTOM: 346, LOST: 32 });
      expect(rows.filter((r) => r[3] === r[2])).toHaveLength(1233);
      expect(rows.filter((r) => r[4] === r[2])).toHaveLength(934);
    });

    it("NO label that quarto defines and the parent kept is removed now (the property this session exists to keep)", () => {
      const worse = rows.filter((r) => r[2] && r[4] && !found(r));
      expect(worse.map((r) => shape(r[5]))).toEqual([]);
    });

    it("every one of the 32 missed labels was missed BEFORE this session too: the cell scanner or the engine resolver, not these rules", () => {
      const missed = rows.filter((r) => against(r) === "LOST");
      expect(missed).toHaveLength(32);
      expect(missed.every((r) => !r[4])).toBe(true);
    });

    it.each(rows.map((r) => [shape(r[5]), r] as const))("%s", (_shape, r) => {
      expect(found(r)).toBe(r[3]);
    });
  });
});
