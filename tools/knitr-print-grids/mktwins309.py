#!/usr/bin/env python3
"""usage: mktwins309.py <srcdir> <outdir>
Copies every document of <srcdir> (a lens dir with manifest.json) into <outdir>, REMOVING its one stray bare fence, and writes a manifest
for render309.sh. A stray fence is a column-0 line holding only 3+ backticks that is not the closer of a chunk/fence opened above it.
Documents with zero or several strays are reported and skipped."""
import json, os, re, shutil, sys
src, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
OPEN = re.compile(r"^(`{3,})(.*)$")
manifest = json.load(open(os.path.join(src, "manifest.json")))
kept, skipped = [], []
for ent in manifest:
    f = ent["file"]
    p = os.path.join(src, f)
    if not os.path.exists(p):
        continue
    lines = open(p, encoding="utf-8").read().split("\n")
    inside = None
    strays = []
    for i, l in enumerate(lines):
        m = OPEN.match(l)
        if inside is None:
            if m:
                if m.group(2).strip() == "":
                    strays.append(i)          # a bare fence opened outside any fence: the stray (it never closes)
                else:
                    inside = len(m.group(1))   # an info-string opener: a chunk or a labelled block
        else:
            if m and m.group(2).strip() == "" and len(m.group(1)) >= inside:
                inside = None
    if len(strays) != 1:
        skipped.append((f, len(strays)))
        continue
    del lines[strays[0]]
    open(os.path.join(out, f), "w", encoding="utf-8").write("\n".join(lines))
    kept.append(ent)
    # helper files (child documents, .R sources) travel with the documents
for g in os.listdir(src):
    gp = os.path.join(src, g)
    if os.path.isfile(gp) and g != "manifest.json" and not g.endswith(".qmd"):
        shutil.copy(gp, os.path.join(out, g))
json.dump(kept, open(os.path.join(out, "manifest.json"), "w"))
print(f"{src}: {len(kept)} twins written, {len(skipped)} skipped {skipped}")
