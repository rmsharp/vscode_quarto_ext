#!/usr/bin/env python3
"""usage: gengeo309.py <outdir> <length>  -- the GEOMETRY grid. Every sequence of chunk kinds of the given length over
  P  = {r, echo=FALSE} print("pN")          (certain print: emits TWO bare fences)
  Q  = {r, echo=FALSE} xN <- N                (quiet: emits none)
  L  = {r}             xN <- N                (echoed, no output: info-open + bare close)
  LP = {r}             print("lN")            (echoed and printing: info-open, bare close, then a bare output pair)
with a heading `# HN` after every chunk, ONE stray bare fence placed before heading 0..len (so len+1 positions), executed under knitr.
Writes <outdir>/g_<seq>_s<pos>.qmd + manifest.json (engine r) and PRED.json with the simulator's hidden/visible headings per document."""
import itertools, json, os, sys
out, n = sys.argv[1], int(sys.argv[2])
os.makedirs(out, exist_ok=True)
KINDS = ["P", "Q", "L", "LP"]


def chunk(kind, i):
    if kind == "P":
        return ["```{r, echo=FALSE}", f'print("p{i}")', "```"]
    if kind == "Q":
        return ["```{r, echo=FALSE}", f"x{i} <- {i}", "```"]
    if kind == "L":
        return ["```{r}", f"x{i} <- {i}", "```"]
    if kind == "LP":
        return ["```{r}", f'print("l{i}")', "```"]


def emitted(kind):
    """The fence lines pandoc sees for a chunk: ('i' = fence WITH an info string, 'b' = bare)."""
    return {"P": ["b", "b"], "Q": [], "L": ["i", "b"], "LP": ["i", "b", "b", "b"]}[kind]


def simulate(seq, pos):
    """Pandoc's pairing over the stream: tokens are headings and fences. Returns the visible headings."""
    toks = []   # ('h', name) | ('f', 'i'|'b')
    for k in range(len(seq) + 1):
        if k == pos:
            toks.append(("f", "b"))   # the stray bare fence
        if k < len(seq):
            for f in emitted(seq[k]):
                toks.append(("f", f))
            toks.append(("h", f"H{k}"))
    # pair fences: an opener needs a closer later (a bare fence); inside a region everything is code, info fences included
    visible = []
    i = 0
    N = len(toks)
    while i < N:
        t = toks[i]
        if t[0] == "h":
            visible.append(t[1]); i += 1; continue
        # a fence outside a region: does a bare closer exist below?
        j = i + 1
        while j < N and not (toks[j][0] == "f" and toks[j][1] == "b"):
            j += 1
        if j < N:
            i = j + 1      # everything between is code
        else:
            i += 1         # unclosed: prose
    return visible


manifest, pred = [], {}
for seq in itertools.product(KINDS, repeat=n):
    for pos in range(n + 1):
        lines = ['---', 'title: "geo"', '---', '', 'Intro.', '']
        for k in range(n + 1):
            if k == pos:
                lines += ["```", ""]
            if k < n:
                lines += chunk(seq[k], k) + [""]
                lines += [f"# H{k}", ""]
        name = f"g_{'-'.join(s.lower() for s in seq)}_s{pos}"
        open(os.path.join(out, name + ".qmd"), "w").write("\n".join(lines))
        manifest.append({"file": name + ".qmd", "engine": "r"})
        pred[name] = simulate(seq, pos)
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"))
json.dump(pred, open(os.path.join(out, "PRED.json"), "w"))
print(len(manifest), "documents")
