#!/usr/bin/env python3
"""usage: gencrit309.py <outdir>  -- the test critic's rows (Session 309 review): guards that nothing pinned. Stm layout: front matter, a setup0 chunk, `# Top`, a stray fence,
`## Between`, ONE chunk under test (plus `pre` chunks above it), `## After`. Truth comes from the heading oracle, as in gens309.py."""
import json, os, sys
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
BASE = ["```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "```", ""]
def chunk(hdr, *code): return [f"```{hdr}", *code, "```", ""]
MASK = lambda *c: chunk("{r mask, include=FALSE}", *c)
rows = []
def add(id, code, header="{r, echo=FALSE}", pre=None, front=None, stray="```", tail=None, note=""):
    rows.append(dict(id=id, code=code if isinstance(code, list) else [code], header=header, pre=BASE + (pre or []), front=front or [], stray=stray, note=note))
# --- masks the rows never reached (own code and earlier chunks)
add("k01_own_sink", ['sink(tempfile())', 'print("hi")', 'sink()'], note="own code diverts the output")
add("k02_own_redef", ['print <- function(...) invisible()', 'print("hi")'], note="own code redefines print")
add("k03_eval_parse", 'print("hi")', pre=MASK('eval(parse(text = "print <- function(...) invisible()"))'))
add("k04_assign", 'print("hi")', pre=MASK('assign("print", function(...) invisible())'))
add("k05_source", 'print("hi")', pre=MASK('source("_h.R")'))
add("k06_s3_register", 'print("hi")', pre=MASK('registerS3method("print", "character", function(x, ...) invisible(x))'))
add("k07_equals_form", 'print("hi")', pre=MASK('print = function(...) invisible()'))
add("k08_right_arrow", 'print("hi")', pre=MASK('function(...) invisible() -> print'))
add("k09_backtick_name", 'print("hi")', pre=MASK('`print` <- function(...) invisible()'))
add("k10_inline_mask", 'print("hi")', pre=["Prose with `r print <- function(x, ...) invisible(x)` inside.", ""])
add("k11_warn_before", 'warning("hi")', pre=MASK('options(warn = -1)'))
# --- engines other than R
add("e01_python", 'print("hi")', header="{python, echo=FALSE}")
add("e02_css", 'head(cars)', header="{css, echo=FALSE}")
add("e03_js", 'summary(x)', header="{js, echo=FALSE}")
# --- stray fences of another kind, and tutorial blocks that show a chunk
add("s01_tilde_stray", 'print("hi")', stray="~~~")
add("s02_four_stray", 'print("hi")', stray="````")
add("s03_tutorial_backticks", 'print("hi")', stray="````markdown")
add("s04_tutorial_tilde", 'print("hi")', stray="~~~markdown")
# --- an unreadable setup call
add("u01_do_call_set", 'print("hi")', header="{r}", pre=MASK('do.call(knitr::opts_chunk$set, list(echo = FALSE, results = "hide"))'))
add("u02_if_set", 'cat("hi\\n")', header="{r}", pre=chunk("{r setup, include=FALSE}", 'knitr::opts_chunk$set(echo = FALSE)', 'if (TRUE) knitr::opts_chunk$set(results = "asis")'))
# --- front matter keys the alternatives of the key regex stand for
add("f01_class_output_default", 'print("hi")', header="{r}", front=["knitr:", "  opts_chunk:", "    echo: false", '    class.output: "bg-info"'])
add("f02_attr_output_default", 'print("hi")', header="{r}", front=["knitr:", "  opts_chunk:", "    echo: false", '    attr.output: \'style="color:red"\''])
add("f03_ref_label_default", 'print("hi")', header="{r}", front=["knitr:", "  opts_chunk:", "    echo: false", '    ref.label: "src"'])
# --- the chunk's own body plus code from elsewhere
add("r01_ref_label", ['print("x")'], header='{r, echo=FALSE, ref.label="src"}', pre=chunk("{r src, eval=FALSE}", "invisible(1)"))
add("r02_code_option", ['print("x")'], header='{r, echo=FALSE, code="y <- 1"}')
add("r03_file_option", ['print("x")'], header='{r, echo=FALSE, file="_a.R"}')
add("r04_pipe_ref_label", ['#| ref-label: src', 'print("x")'], header="{r, echo=FALSE}", pre=chunk("{r src, eval=FALSE}", "invisible(1)"))
# --- whitespace strings
add("w02_space", 'cat(" ")')
add("w03_tab_newline", 'cat("\\t\\n")')
add("w05_two_newlines", 'cat("\\n", "\\n")')
add("w06_nbsp_escape", 'cat("\\u00a0")')
add("w07_formfeed", 'cat("\\f")')
manifest, pred = [], {}
for r in rows:
    lines = ["---", 'title: "s"', *r["front"], "---", "", *r["pre"], "# Top", "", r["stray"], "", "## Between", "", f"```{r['header']}", *r["code"], "```", "", "## After", ""]
    if r["stray"] == "````markdown":
        lines = lines  # the tutorial block is never closed here: a stray four-backtick fence with an info string
    name = f"s_{r['id']}"
    open(os.path.join(out, name + ".qmd"), "w").write("\n".join(lines))
    manifest.append({"file": name + ".qmd", "engine": "r"}); pred[name] = {"note": r["note"]}
open(os.path.join(out, "_h.R"), "w").write("print <- function(...) invisible()\n")
open(os.path.join(out, "_a.R"), "w").write("z <- 1\n")
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w")); json.dump(pred, open(os.path.join(out, "PRED.json"), "w"))
print(len(rows), "documents")
