#!/usr/bin/env python3
"""Regenerates test/fixtures/knitr-print-statements/quarto-1.7.33.json from the four rendered grids with the CURRENT tree (build/now.cjs) and HEAD (build/head.cjs)."""
import json, os, subprocess, sys
sys.path.insert(0, "tools/realdoc-score")
from extract_headings import extract
R = "/Users/rmsharp/Development/vscode_quarto_ext"
root = R + "/scratchpad/s309"
NODE = """
const fs=require('fs'); const b=require(process.argv[1]); const out={};
for (const f of process.argv.slice(2)) { const t=fs.readFileSync(f,'utf8'); out[f]=b.findHeadings(t,'knitr').map(h=>h.text); }
console.log(JSON.stringify(out));"""
rows = []
for grid in ["stm", "fn", "msg", "nm", "ko"]:
    d = f"{root}/{grid}"
    files = sorted(f for f in os.listdir(d) if f.endswith(".qmd"))
    paths = [f"{d}/{f}" for f in files]
    now = json.loads(subprocess.check_output(["node", "-e", NODE, f"{root}/build/now.cjs"] + paths))
    head = json.loads(subprocess.check_output(["node", "-e", NODE, f"{root}/build/head.cjs"] + paths))
    for f in files:
        b = f[:-4]
        rc = f"{d}/out/{b}.rc"
        if not os.path.exists(rc) or open(rc).read().strip() != "0":
            continue
        q = [t for _l, t in extract(open(f"{d}/out/{b}.html", encoding="utf-8").read())]
        rows.append([f"{grid}/{b}", open(f"{d}/{f}", encoding="utf-8").read(), q, now[f"{d}/{f}"], head[f"{d}/{f}"]])
dele = [r[0] for r in rows if [t for t in r[2] if t not in r[3]]]
agree_now = sum(1 for r in rows if r[3] == r[2]); agree_head = sum(1 for r in rows if r[4] == r[2])
worse = [r[0] for r in rows if r[4] == r[2] and r[3] != r[2]]
print(len(rows), "rows; deleting now:", dele, "; agree now", agree_now, "head", agree_head, "; worse than HEAD:", worse)
fx = json.load(open(R + "/test/fixtures/knitr-print-statements/quarto-1.7.33.json"))
fx["rows"] = rows
fx["note"] = fx["note"].replace("from four grids:", "from five grids:").replace("`nm` (a bare name and print(name) after assignments of every shape).", "`nm` (a bare name and print(name) after assignments of every shape) and `ko` (25 chunk options set as a setup-call default, each rendered).") if "five grids" not in fx["note"] else fx["note"]
json.dump(fx, open(R + "/test/fixtures/knitr-print-statements/quarto-1.7.33.json", "w"))
