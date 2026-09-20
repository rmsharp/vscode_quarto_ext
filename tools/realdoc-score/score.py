"""The real-document measure — how often this extension's Outline agrees with `quarto render`
across the authored corpus. The CORRECTED instrument, end to end
(`docs/REAL-DOCUMENT-RESCORE.md` I1–I3; Session 265's `score_corrected.py`, adopted as the standing
measure and moved here in Session 268).

  I1  ground truth re-extracted with `extract_headings.py`, which skips quarto's own UI (the
      code-tools dialog, and the Reuse / Copyright / Citation sections minted from metadata)
  I3  every `.Rmd` with no R chunk re-rendered under its REAL extension (its engine differs)
  I2  raw HTML `<hN>` tags are not headings (the operator decision, Session 267): each line-start
      raw tag is inserted into the MODEL's list at its source line, which is the same as removing
      it from quarto's — `rawhtml_adjust.js` produces that column

Usage:  REALDOC_DATA=<corpus dir> REALDOC_ORDINALS=<file list> \\
          python3 tools/realdoc-score/score.py <label> <model.tsv> <rawadj.tsv>

`run.sh` beside this file runs the whole pipeline and calls this last. Divergent documents are
reported by ORDINAL only — the corpus is personal and never committed (Learning #548).
"""

import gzip
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from extract_headings import extract
from scorelib import INC, corpus, data_dir, die, load_model, load_quarto, ordinals, require

if len(sys.argv) != 4:
    die("usage: score.py <label> <model.tsv> <rawadj.tsv>  (see the module docstring)")
label, model_tsv, rawadj_tsv = sys.argv[1:4]
data = data_dir()
order = ordinals()

# Ground truth: the corrected extraction, with the no-R-chunk `.Rmd` documents taken from the
# renders made under their real extension (I3).
truth = load_quarto(require(os.path.join(data, "quarto_v2.tsv"), "the corrected ground truth"))
keep = load_quarto(require(os.path.join(data, "quarto_rmd_keep.tsv"), "the .Rmd re-render index"))
for p in json.load(open(require(os.path.join(data, "rmd_no_r.json"), "the no-R-chunk .Rmd list"), encoding="utf-8")):
    code, _ = keep[p]
    cached = os.path.join(data, "htmlcache_keep", hashlib.sha1(p.encode()).hexdigest() + ".html.gz")
    truth[p] = (
        code,
        extract(gzip.open(cached, "rt", encoding="utf-8", errors="replace").read())
        if code == 0 and os.path.exists(cached)
        else [],
    )

# The model side: heading LEVELS per document, with the raw-HTML column substituted where it exists.
M = {p: [h[0] for h in hs] for p, hs in load_model(require(model_tsv, "the model census")).items()}
for ln in open(require(rawadj_tsv, "the raw-HTML adjustment"), encoding="utf-8"):
    p, _n, levels = ln.rstrip("\n").split("\t")
    M[p] = [int(x) for x in levels.split(",") if x]

docs = corpus(data)
scored = agree = 0
kinds = {"phantom": [], "lost": [], "level": []}
for p, (code, q) in truth.items():
    if code != 0 or INC.search(docs[p]):
        continue
    scored += 1
    m = M[p]
    ql = [h[0] for h in q]
    if m == ql:
        agree += 1
        continue
    kinds["phantom" if len(m) > len(ql) else "lost" if len(m) < len(ql) else "level"].append(order[p])
div = sum(len(v) for v in kinds.values())
print(
    f"{label}: scored {scored} agree {agree} ({100 * agree / scored:.2f}%) divergent {div} "
    + " ".join(f"{k} {len(v)}" for k, v in kinds.items())
)
for k, v in kinds.items():
    print(f"   {k:7s} {sorted(v)}")
