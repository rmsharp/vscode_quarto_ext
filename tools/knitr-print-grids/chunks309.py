#!/usr/bin/env python3
"""usage: chunks309.py <twin dir with out/> > chunks.jsonl
One JSON line per (document, source chunk): the chunk's header, body, and what knitr handed pandoc for it, read from the kept
intermediate markdown (`out/<doc>.html.md`): stdout / stderr / error / display / code output blocks and the count of BARE fence lines
(a bare fence is what can close a stray fence). Documents whose cell count differs from their chunk count are reported on stderr
and written with "aligned": false."""
import json, os, re, sys
d = sys.argv[1].rstrip("/")
OPENER = re.compile(r"^```\{([A-Za-z0-9_]+)(.*)\}\s*$")


def source_chunks(text):
    lines = text.split("\n")
    out, i = [], 0
    # skip the front matter
    if lines and lines[0].strip() == "---":
        for k in range(1, len(lines)):
            if lines[k].strip() in ("---", "..."):
                i = k + 1
                break
    inside = None
    cur = None
    while i < len(lines):
        l = lines[i]
        if cur is None:
            m = OPENER.match(l)
            if m:
                cur = {"line": i, "header": l, "engine": m.group(1), "body": []}
        else:
            if re.match(r"^```\s*$", l):
                out.append(cur)
                cur = None
            else:
                cur["body"].append(l)
        i += 1
    return out


def md_cells(md):
    lines = md.split("\n")
    # skip front matter
    i = 0
    if lines and lines[0].strip() == "---":
        for k in range(1, len(lines)):
            if lines[k].strip() == "---":
                i = k + 1
                break
    cells, depth, cur = [], 0, None
    infence = False
    while i < len(lines):
        l = lines[i]
        s = l.rstrip()
        if re.match(r"^`{3,}", s):
            infence = not infence if re.match(r"^`{3,}\s*$", s) or not infence else infence
        if not infence:
            if re.match(r"^:{3,}\s*\{", s) or re.match(r"^:{3,}\s*\w", s):
                if depth == 0 and re.match(r"^:{3,}\s*\{\.cell[\s}]", s):
                    cur = []
                depth += 1
            elif re.match(r"^:{3,}\s*$", s):
                depth -= 1
        if cur is not None:
            cur.append(l)
            if depth == 0:
                cells.append(cur)
                cur = None
        i += 1
    return cells


def flags(cell):
    t = "\n".join(cell)
    bare = sum(1 for l in cell if re.match(r"^`{3,}\s*$", l))
    return {
        "stdout": ".cell-output-stdout" in t,
        "stderr": ".cell-output-stderr" in t,
        "error": ".cell-output-error" in t,
        "display": ".cell-output-display" in t,
        "code": ".cell-code" in t,
        "bare": bare,
        "info": sum(1 for l in cell if re.match(r"^`{3,}\s*\S", l)),
    }


for f in sorted(os.listdir(d)):
    if not f.endswith(".qmd"):
        continue
    base = f[:-4]
    rc = os.path.join(d, "out", base + ".rc")
    mdp = os.path.join(d, "out", base + ".html.md")
    if not os.path.exists(rc) or open(rc).read().strip() != "0" or not os.path.exists(mdp):
        print(json.dumps({"doc": base, "norender": True}))
        continue
    chunks = source_chunks(open(os.path.join(d, f), encoding="utf-8").read())
    cells = md_cells(open(mdp, encoding="utf-8").read())

    def own_include_false(c):
        # a chunk whose OWN header or `#|` line sets include to false produces no cell at all (measured)
        if re.search(r"\binclude\s*=\s*(FALSE|F)\b", c["header"]):
            return not re.search(r"\binclude\s*=\s*(TRUE|T)\b", c["header"])
        for l in c["body"]:
            if re.match(r"^#\|\s*include:\s*(false|no|off|False|FALSE)\s*$", l):
                return True
            if not l.startswith("#|"):
                break
        return False

    kept = [k for k, c in enumerate(chunks) if not own_include_false(c)]
    aligned = len(kept) == len(cells)
    if not aligned:
        sys.stderr.write(f"MISALIGNED {base}: {len(chunks)} chunks ({len(kept)} not include=FALSE), {len(cells)} cells\n")
    cell_of = {k: cells[n] for n, k in enumerate(kept)} if aligned else {}
    for k, c in enumerate(chunks):
        rec = {"doc": base, "path": os.path.join(d, f), "idx": k, "line": c["line"], "header": c["header"], "engine": c["engine"], "body": c["body"], "aligned": aligned}
        if aligned:
            if k in cell_of:
                rec.update(flags(cell_of[k]))
            else:
                rec.update({"stdout": False, "stderr": False, "error": False, "display": False, "code": False, "bare": 0, "info": 0, "nocell": True})
        print(json.dumps(rec))
