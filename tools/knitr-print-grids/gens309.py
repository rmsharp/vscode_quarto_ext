#!/usr/bin/env python3
"""usage: gens309.py <outdir>  -- the STATEMENT grid. One document per row: front matter + optional pre lines, `# Top`, ONE stray bare fence,
`## Between`, ONE chunk under test, `## After`. When the chunk emits a bare fence the stray one pairs with it and `Between` is swallowed
(`After` shows: the chunk's closing fence has nothing to pair with); when it emits none every heading shows. So the oracle's headings say whether
the chunk PRINTED (`P`, Between hidden) or was QUIET (`Q`, all shown).
Each row: id, expected truth ('P'|'Q', frozen BEFORE any render), design label ('Y' the rule must call it a certain print, 'N' it must not),
header, code lines, and the context (front matter lines, pre lines)."""
import json, os, sys
out = sys.argv[1]
os.makedirs(out, exist_ok=True)

PRE_X = ["```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "df <- cars", "fit <- lm(dist ~ speed, data = cars)", "```", ""]
rows = []


def add(id, truth, label, code, header="{r, echo=FALSE}", front=None, pre=None, note=""):
    rows.append(dict(id=id, truth=truth, label=label, code=code if isinstance(code, list) else [code], header=header,
                     front=front or [], pre=PRE_X if pre is None else pre, note=note))


# --- the whitelist, in the shapes real documents use ---------------------------------------------------------------------------
add("w001", "P", "Y", 'print("hi")')
add("w002", "P", "Y", "print(1)")
add("w003", "P", "Y", "print(1 + 1)")
add("w004", "P", "Y", "print(TRUE)")
add("w005", "P", "Y", 'cat("hello\\n")')
add("w006", "P", "Y", 'cat("a", "b", sep = "\\n")')
add("w007", "P", "Y", 'cat(sprintf("%d rows\\n", nrow(cars)))')
add("w008", "P", "Y", "summary(x)")
add("w009", "P", "Y", "summary(df)")
add("w010", "P", "Y", "summary(fit)")
add("w011", "P", "Y", "summary(lm(dist ~ speed, data = cars))")
add("w012", "P", "Y", "head(cars)")
add("w013", "P", "Y", "head(cars, 3)")
add("w014", "P", "Y", "tail(cars)")
add("w015", "P", "Y", "str(cars)")
add("w016", "P", "Y", "table(cars$speed > 10)")
add("w017", "P", "Y", "quantile(x)")
add("w018", "P", "Y", "cor(cars$speed, cars$dist)")
add("w019", "P", "Y", "mean(x)")
add("w020", "P", "Y", "nrow(cars)")
add("w021", "P", "Y", "names(cars)")
add("w022", "P", "Y", "levels(iris$Species)")
add("w023", "P", "Y", "unique(x)")
add("w024", "P", "Y", "round(3.14159, 2)")
add("w025", "P", "Y", "coef(fit)")
add("w026", "P", "Y", "anova(fit)")
add("w027", "P", "Y", "t.test(x)")
add("w028", "P", "Y", "aggregate(dist ~ speed, cars, mean)")
add("w029", "P", "Y", "tapply(cars$dist, cars$speed > 10, mean)")
add("w030", "P", "Y", "print(summary(x))")
add("w031", "P", "Y", "print(head(cars))")
add("w032", "P", "Y", "print(table(x))")
add("w033", "P", "Y", ["y <- 1", "print(y + 1)"], note="an assignment first, then a print: ANY statement prints")
add("w034", "P", "Y", ["# a comment", "summary(x)"])
add("w035", "P", "Y", ["summary(x) # trailing comment"])
add("w036", "P", "Y", ["summary(", "  x", ")"], note="a multi-line call")
add("w037", "P", "Y", ["plot(cars)", "summary(x)"], note="a plot, then a print")
add("w038", "P", "Y", ["x2 <- x * 2", "head(x2)", "plot(x2)"])
add("w039", "P", "Y", ["print('single quotes')"])
add("w040", "P", "Y", ["cat('x', 'y', '\\n')"])
add("w041", "P", "Y", ["summary(x); invisible(3)"], note="two statements on one line")

# --- shapes a word list would call printers and that print NOTHING (or the rule must not call certain) ------------------------
add("n001", "Q", "N", "x3 <- summary(cars)", note="assignment of a summary")
add("n002", "Q", "N", "invisible(summary(x))")
add("n003", "Q", "N", "y <- head(cars)")
add("n004", "P", "N", "(y <- head(cars))", note="a parenthesised assignment PRINTS")
add("n005", "Q", "N", "summary(x) -> s", note="right assignment")
add("n006", "P", "N", "s <- print(1)", note="the print inside prints")
add("n007", "P", "N", "suppressWarnings(summary(x))")
add("n008", "P", "N", "if (TRUE) print(1)")
add("n009", "P", "N", "for (i in 1:2) print(i)")
add("n010", "Q", "N", "f <- function() print(1)", note="a definition")
add("n011", "P", "N", ["f <- function() print(1)", "f()"], note="a call of it")
add("n012", "Q", "N", "plot(cars)")
add("n013", "Q", "N", "hist(cars$speed)")
add("n014", "Q", "N", "boxplot(dist ~ speed, cars)")
add("n015", "Q", "N", "knitr::kable(head(cars))", note="a table: display, no fence")
add("n016", "Q", "N", "library(stats)")
add("n017", "Q", "N", "set.seed(1)")
add("n018", "Q", "N", "options(digits = 3)")
add("n019", "Q", "N", "x4 <- 1:3")
add("n020", "P", "N", "x", note="a bare name prints; slice 1 does not read it")
add("n021", "P", "N", "cars", note="a bare data frame")
add("n022", "P", "N", "1 + 1", note="a literal expression")
add("n023", "P", "N", '"text"')
add("n024", "Q", "N", "# only a comment")
add("n025", "Q", "N", "")
add("n026", "P", "N", "print(x)", note="a variable: could be a plot object")
add("n027", "P", "N", "print(fit)")
add("n028", "P", "N", "print(invisible(1))")
add("n029", "Q", "N", 'cat("")', note="empty output")
add("n030", "Q", "N", 'cat("x", file = tempfile())', note="written to a file")
add("n031", "P", "N", "local({ print(1) })")
add("n032", "P", "N", "with(cars, print(speed))")
add("n033", "P", "N", "sapply(1:3, function(i) i)")
add("n034", "P", "N", "x |> summary()", note="a pipe")
add("n035", "P", "N", "quote(a)")
add("n036", "P", "N", "paste('a', 'b')")
add("n037", "Q", "N", "plot(cars); lines(lowess(cars))")
add("n038", "Q", "N", ["y <- summary(x)", "z <- head(cars)"])
add("n039", "P", "N", "print(knitr::kable(head(cars)))", note="measured, not guessed")
add("n040", "Q", "N", "suppressMessages(library(stats))")

# --- the chunk's OWN options -------------------------------------------------------------------------------------------------
for i, (hdr, truth, label, nt) in enumerate([
    ('{r, echo=FALSE, results="hide"}', "Q", "N", "results hide"),
    ("{r, echo=FALSE, results='hide'}", "Q", "N", "results hide, single quotes"),
    ('{r, echo=FALSE, results="asis"}', "Q", "N", "results asis: text is raw"),
    ('{r, echo=FALSE, results="hold"}', "P", "Y", "results hold"),
    ('{r, echo=FALSE, results="markup"}', "P", "Y", "results markup"),
    ("{r, echo=FALSE, include=FALSE}", "Q", "N", "include false"),
    ("{r, echo=FALSE, eval=FALSE}", "Q", "N", "eval false"),
    ("{r, echo=FALSE, eval=TRUE}", "P", "Y", "eval true"),
    ("{r, echo=FALSE, message=FALSE}", "P", "Y", "message false is irrelevant to stdout"),
    ("{r, echo=FALSE, warning=FALSE}", "P", "Y", "warning false is irrelevant to stdout"),
    ("{r, echo=FALSE, error=TRUE}", "P", "Y", "error true"),
    ("{r, echo=FALSE, collapse=TRUE}", "P", "Y", "collapse"),
    ("{r, echo=FALSE, comment=NA}", "P", "Y", "comment NA"),
    ('{r, echo=FALSE, class.output="bg-info"}', "Q", "N", "class.output gives the block an info string: it cannot close a fence"),
    ('{r, echo=FALSE, attr.output=\'style="color:red"\'}', "Q", "N", "attr.output"),
    ("{r, echo=FALSE, fig.show='hide'}", "P", "Y", "fig.show"),
    ("{r, echo=FALSE, fig.width=5}", "P", "Y", "fig.width"),
    ("{r, echo=FALSE, cache=FALSE}", "P", "Y", "cache false"),
    ("{r, echo=FALSE, results=hide_it}", "Q", "N", "results is an unread variable"),
    ("{r, echo=FALSE, eval=run_it}", "Q", "N", "eval is an unread variable"),
    ("{r, echo=FALSE, output=FALSE}", "Q", "N", "an `output` option"),
    ("{r lbl, echo=FALSE}", "P", "Y", "a label"),
    ("{r, echo=FALSE, tidy=TRUE}", "P", "Y", "tidy"),
    ("{r, echo=FALSE, strip.white=FALSE}", "P", "Y", "strip.white"),
    ("{R, echo=FALSE}", "P", "Y", "capital R"),
]):
    add(f"o{i + 1:03d}", truth, label, "print(summary(x))", header=hdr, note=nt)
for i, (pipe, truth, label, nt) in enumerate([
    (["#| echo: false"], "P", "Y", "pipe echo"),
    (["#| echo: false", "#| results: hide"], "Q", "N", "pipe results hide"),
    (["#| echo: false", "#| results: asis"], "Q", "N", "pipe results asis"),
    (["#| echo: false", "#| results: hold"], "P", "Y", "pipe results hold"),
    (["#| echo: false", "#| output: false"], "Q", "N", "pipe output false"),
    (["#| echo: false", "#| output: asis"], "Q", "N", "pipe output asis"),
    (["#| echo: false", "#| include: false"], "Q", "N", "pipe include false"),
    (["#| echo: false", "#| eval: false"], "Q", "N", "pipe eval false"),
    (["#| echo: false", "#| message: false"], "P", "Y", "pipe message false"),
    (["#| echo: false", "#| error: true"], "P", "Y", "pipe error true"),
    (["#| echo: false", "#| class-output: bg-info"], "Q", "N", "pipe class-output"),
    (["#| echo: false", "#| collapse: true"], "P", "Y", "pipe collapse"),
]):
    add(f"p{i + 1:03d}", truth, label, pipe + ["print(summary(x))"], header="{r}", note=nt)

# --- document DEFAULTS: the front matter ------------------------------------------------------------------------------------
FM = [
    ("f001", "P", "Y", ["execute:", "  echo: false"], "execute echo false"),
    ("f002", "P", "Y", ["echo: false"], "top-level echo false"),
    ("f003", "P", "Y", ["knitr:", "  opts_chunk:", "    echo: false"], "knitr opts_chunk echo false"),
    ("f004", "P", "Y", ["format:", "  html:", "    echo: false"], "format html echo false"),
    ("f005", "P", "Y", ["execute:", "  echo: false", "  message: false", "  warning: false"], "execute message/warning false"),
    ("f006", "Q", "N", ["execute:", "  echo: false", "  output: false"], "execute output false"),
    ("f007", "Q", "N", ["execute:", "  echo: false", "  eval: false"], "execute eval false"),
    ("f008", "Q", "N", ["execute:", "  echo: false", "  include: false"], "execute include false"),
    ("f009", "P", "Y", ["execute:", "  echo: false", "  error: true"], "execute error true"),
    ("f010", "Q", "N", ["knitr:", "  opts_chunk:", "    echo: false", "    results: hide"], "knitr opts_chunk results hide"),
    ("f011", "Q", "N", ["knitr:", "  opts_chunk:", "    echo: false", "    results: asis"], "knitr opts_chunk results asis"),
    ("f012", "P", "Y", ["knitr:", "  opts_chunk:", "    echo: false", "    collapse: true", '    comment: "#>"'], "knitr opts_chunk collapse, comment"),
    ("f013", "Q", "N", ["execute:", "  echo: false", "  output: asis"], "execute output asis"),
    ("f014", "P", "Y", ["execute:", "  echo: false", "  cache: false"], "execute cache false"),
    ("f015", "P", "Y", ["execute:", "  echo: false", "  freeze: false"], "execute freeze false"),
    ("f016", "P", "Y", ["format:", "  html:", "    echo: false", "    toc: true", "    code-fold: true"], "format html toc code-fold"),
    ("f017", "P", "Y", ["execute: {echo: false}"], "execute flow"),
    ("f018", "Q", "N", ["execute: {echo: false, output: false}"], "execute flow with output false"),
    ("f019", "P", "N", ["execute:", "  echo: false", "df-print: kable"], "df-print kable"),
    ("f020", "P", "N", ["execute:", "  echo: false", "df-print: paged"], "df-print paged"),
    ("f021", "P", "Y", ["execute:", "  echo: false", "toc: true", "number-sections: true"], "other top-level keys"),
]
for id, truth, label, front, nt in FM:
    add(id, truth, label, "print(summary(x))", header="{r}", front=front, note=nt)
# df-print and an implicit print of a data frame
add("f022", "Q", "N", "head(cars)", header="{r}", front=["execute:", "  echo: false", "df-print: kable"], note="head(cars) becomes a table, not a fence")
add("f023", "P", "Y", "print(head(cars))", header="{r}", front=["execute:", "  echo: false", "df-print: kable"], note="an explicit print stays text? MEASURE")

# --- document DEFAULTS: a setup chunk's call ---------------------------------------------------------------------------------
SETUP = lambda *a: ["```{r setup, include=FALSE}", *a, "```", ""]
CALLS = [
    ("c001", "P", "Y", "knitr::opts_chunk$set(echo = FALSE)", "echo false"),
    ("c002", "Q", "N", 'knitr::opts_chunk$set(echo = FALSE, results = "hide")', "results hide"),
    ("c003", "P", "Y", 'knitr::opts_chunk$set(echo = FALSE, results = "hold")', "results hold"),
    ("c004", "P", "Y", "knitr::opts_chunk$set(echo = FALSE, message = FALSE, warning = FALSE)", "message warning false"),
    ("c005", "P", "Y", "knitr::opts_chunk$set(echo = FALSE, collapse = TRUE, comment = NA)", "collapse comment"),
    ("c006", "Q", "N", "knitr::opts_chunk$set(echo = FALSE, eval = FALSE)", "eval false"),
    ("c007", "Q", "N", 'knitr::opts_chunk$set(echo = FALSE, class.output = "o")', "class.output"),
    ("c008", "P", "Y", "knitr::opts_chunk$set(echo = FALSE, fig.width = 5, fig.height = 4)", "fig sizes"),
    ("c009", "Q", "N", "knitr::opts_chunk$set(echo = FALSE, include = FALSE)", "include false"),
    ("c010", "P", "Y", "knitr::opts_chunk$set(echo = FALSE, error = TRUE)", "error true"),
    ("c011", "Q", "N", "knitr::opts_chunk$set(echo = FALSE, results = res)", "results unread"),
    ("c012", "P", "Y", 'knitr::opts_chunk$set(echo = FALSE, results = "markup")', "results markup"),
    ("c013", "P", "Y", "knitr::opts_chunk$set(echo = FALSE, tidy = FALSE, cache = FALSE)", "tidy cache"),
    ("c014", "Q", "N", 'knitr::opts_chunk$set(echo = FALSE, attr.output = "x")', "attr.output"),
]
for id, truth, label, call, nt in CALLS:
    add(id, truth, label, "print(summary(x))", header="{r}", pre=[*SETUP(call), *PRE_X], note=nt)

# --- MASKING: something earlier changes what the words do ------------------------------------------------------------------
M = lambda *a: [*PRE_X, "```{r mask, include=FALSE}", *a, "```", ""]
add("m001", "Q", "N", 'print("hi")', pre=M("print <- function(x, ...) invisible(x)"), note="print redefined")
add("m002", "Q", "N", "summary(x)", pre=M("summary <- function(...) invisible(NULL)"), note="summary redefined")
add("m003", "P", "N", "head(cars)", pre=M("head <- function(...) NULL"), note="head returns NULL: prints NULL")
add("m004", "Q", "N", 'cat("hi\\n")', pre=M("sink(tempfile())"), note="sink diverts the output")
add("m005", "Q", "N", "summary(x)", pre=M("knitr::knit_hooks$set(output = function(x, options) '')"), note="an output hook that drops the output")
add("m006", "P", "N", "summary(x)", pre=M("print.foo <- function(x, ...) invisible(x)"), note="a method for another class: harmless but declined")
add("m007", "P", "N", "summary(x)", pre=M('source("nope.R")'), note="source() may redefine: the document would fail, kept as a shape only")
add("m008", "P", "Y", "summary(x)", pre=M("options(digits = 3)"), note="a harmless option")
add("m009", "P", "N", "summary(x)", pre=M("options(warn = -1)"), note="options(warn): irrelevant to stdout, declined by the conservative gate")
add("m010", "Q", "N", 'cat("hi\\n")', pre=M("capture.output(print(1))"), note="capture.output with nothing else: no effect (a guess)")
add("m011", "P", "N", "summary(x)", pre=M("knitr::opts_hooks$set(echo = function(options) options)"), note="an opts_hook")
add("m012", "P", "N", "summary(x)", pre=M("knitr::opts_template$set(quiet = list(results = 'hide'))"), note="a template that is never applied")
add("m013", "P", "Y", "summary(x)", pre=M("suppressWarnings(print(1))"), note="a wrapper elsewhere")
add("m014", "P", "Y", 'cat("hi\\n")', pre=M("greet <- function() cat('hi')"), note="a function defined with cat in it")
add("m015", "Q", "N", 'cat("hi\\n")', pre=M("cat <- function(...) invisible()"), note="cat redefined")
add("m016", "Q", "N", "mean(x)", pre=M("mean <- function(...) invisible(0)"), note="mean redefined")

# --- the chunk's own echo, and the document's, against the printer --------------------------------------------------------------
add("e001", "P", "N", "print(summary(x))", header="{r, echo=TRUE}", note="echoed: the code fence closes the stray one, so Between is hidden anyway")

# --- write ---------------------------------------------------------------------------------------------------------------------
manifest = []
truthfile = {}
for r in rows:
    lines = ["---", 'title: "s"', *r["front"], "---", "", *r["pre"], "# Top", "", "```", "", "## Between", "", f"```{r['header']}", *r["code"], "```", "", "## After", ""]
    name = f"s_{r['id']}"
    open(os.path.join(out, name + ".qmd"), "w").write("\n".join(lines))
    manifest.append({"file": name + ".qmd", "engine": "r"})
    truthfile[name] = {"truth": r["truth"], "label": r["label"], "note": r["note"]}
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"))
json.dump(truthfile, open(os.path.join(out, "PRED.json"), "w"))
print(len(rows), "documents")
