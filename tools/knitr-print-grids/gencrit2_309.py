#!/usr/bin/env python3
"""usage: gencrit2_309.py <outdir>  -- rows that make each guard LOAD-BEARING (Session 309 mutation pass): one document per surviving mutant whose shape no earlier document had.
Stm layout unless a row gives its own `lines`. Truth comes from the heading oracle."""
import json, os, sys
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
BASE = ["```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "df <- cars", "```", ""]
def chunk(hdr, *code): return [f"```{hdr}", *code, "```", ""]
rows = []
def add(id, code, header="{r, echo=FALSE}", pre=None, front=None, stray="```", lines=None, note=""):
    rows.append(dict(id=id, code=code if isinstance(code, list) else [code], header=header, pre=BASE + (pre or []), front=front or [], stray=stray, lines=lines, note=note))
add("c05_own_unread", ["v <- c(1, 2)", "if (TRUE) v <- knitr::kable(df)", "v"], note="own chunk: a nested reassignment of v")
add("o03_include_variable", 'print("hi")', header="{r, echo=FALSE, include=show_it}", pre=chunk("{r flags, include=FALSE}", "show_it <- FALSE"), note="include is a variable that is FALSE")
add("o10_pipe_wins", 'print("hi")', header="{r, echo=FALSE, results='markup'}", pre=None, note="header markup, pipe hide: the pipe wins")
rows[-1]["code"] = ["#| results: hide", 'print("hi")']
add("d05_unknown_then_silent", 'print("hi")', header="{r}", pre=chunk("{r unknown, include=FALSE}", 'do.call(knitr::opts_chunk$set, list(results = "hide"))') + chunk("{r silence, include=FALSE}", "knitr::opts_chunk$set(echo = FALSE)"), note="an unreadable call, then a readable silencing one")
add("d12_quoted_key", 'print("hi")', header="{r}", front=["execute:", "  echo: false", '  "output": false'], note="a quoted front-matter key")
add("n08_backtick_assign", ["v"], pre=chunk("{r bt, include=FALSE}", "v <- c(1, 2)") + chunk("{r bt2, include=FALSE}", "`v` <- knitr::kable(df)"), note="a backtick-named assignment above makes the chunk unparseable")
add("n11_right_assign", ["v"], pre=chunk("{r ra, include=FALSE}", "v <- c(1, 2)", "knitr::kable(df) -> v"), note="a right assignment turns v into a table")
add("n13_if_equals_assign", ["v"], pre=chunk("{r ie, include=FALSE}", "v <- c(1, 2)", "if (TRUE) v = knitr::kable(df)"), note="an = assignment inside an if turns v into a table")
add("d13_two_results_calls", 'print("hi")', header="{r}", pre=chunk("{r two, include=FALSE}", 'knitr::opts_chunk$set(echo = FALSE, results = "hold")', 'knitr::opts_chunk$set(results = "hide")'), note="two calls: the later results wins")
add("d28_label_option", 'print("hi")', header='{r, echo=FALSE, label="lbl"}', note="a label given as an option")
add("k11_if_equals_redef", 'print("hi")', pre=chunk("{r red, include=FALSE}", "if (TRUE) print = function(...) invisible()"), note="print redefined with = after an if")
add("k22_knit_child_pieces", 'print("hi")', pre=chunk("{r kc, include=FALSE}", 'knitr::knit_child(text = paste0("```{r}\\n", "pri", "nt <- function(...) invisible()\\n```"), quiet = TRUE)'), note="print redefined inside a child built from pieces")
add("k07_knit_exit", 'print("hi")', pre=chunk("{r ke, include=FALSE}", "knitr::knit_exit()"), note="knit_exit drops the rest of the document")
add("s02_print_digits", 'print(summary(x), digits = 3)', note="a named second argument: prints, and this declines")
# stray fences of another kind WITH a later closer of the same kind
add("g01_four_stray_with_closer", 'print("hi")', lines=["---", 'title: "s"', "---", "", *BASE, "# Top", "", "````", "", "## Between", "", "```{r, echo=FALSE}", 'print("hi")', "```", "", "## After", "", "````", "", "## Last", ""], note="a four-backtick stray fence with a four-backtick closer below")
add("g02_tilde_stray_with_closer", 'print("hi")', lines=["---", 'title: "s"', "---", "", *BASE, "# Top", "", "~~~", "", "## Between", "", "```{r, echo=FALSE}", 'print("hi")', "```", "", "## After", "", "~~~", "", "## Last", ""], note="a tilde stray fence with a tilde closer below")
manifest, pred = [], {}
for r in rows:
    lines = r["lines"] or ["---", 'title: "s"', *r["front"], "---", "", *r["pre"], "# Top", "", r["stray"], "", "## Between", "", f"```{r['header']}", *r["code"], "```", "", "## After", ""]
    name = f"s_{r['id']}"
    open(os.path.join(out, name + ".qmd"), "w").write("\n".join(lines))
    manifest.append({"file": name + ".qmd", "engine": "r"}); pred[name] = {"note": r["note"]}
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w")); json.dump(pred, open(os.path.join(out, "PRED.json"), "w"))
print(len(rows), "documents")
