"""Scoring primitives for the real-document measure (Session 265's `score.py`, moved here and
adopted as the standing instrument, Session 268).

Ground truth is a TSV of quarto's rendered headings, one row per document; the model side is a TSV
written by `census.test.ts`. Session 251's scoring rules, unchanged, so the numbers stay comparable
with `docs/REAL-DOCUMENT-TRIAGE.md` and `docs/REAL-DOCUMENT-RESCORE.md`:

  A1 `{{< include >}}` in the document text -> excluded    A3 quarto exit != 0 -> excluded
  STRUCTURE = the sequence of heading LEVELS (the headline); TEXT is scored apart (A4).

⚠ The CLI that used to sit at the bottom of this file wrote `divergent.json` to a hard-coded
`scratchpad/` path. It is gone: `score.py` beside this file is the entry point, and it takes its
paths from the environment. `score()` and `norm()` stay because they are the UNCORRECTED
instrument — the one whose numbers Session 251 published — and a future session comparing against
that baseline needs them.
"""

import json
import re
import sys
from collections import Counter

RS, US = "\u001e", "\u001f"
INC = re.compile(r"\{\{<\s*include\b")


def load_model(path):
    out = {}
    for ln in open(path, encoding="utf-8"):
        x = ln.rstrip("\n").split("\t")
        if len(x) < 3 or x[1] == "THREW": continue
        out[x[0]] = [(int(m.group(1)), m.group(2)) for t in x[2].split(RS) if (m := re.match(r"h(\d):(.*)$", t, re.S))]
    return out


def load_quarto(path):
    out = {}
    for ln in open(path, encoding="utf-8"):
        x = ln.rstrip("\n").split("\t")
        if len(x) < 4: continue
        out[x[0]] = (int(x[1]), [(int(m.group(1)), m.group(2)) for t in x[3].split(US) if (m := re.match(r"h(\d):(.*)$", t, re.S))])
    return out


def norm(t):
    t = re.sub(r"\{[^}]*\}\s*$", "", t); t = re.sub(r"[*_`]+", "", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t); t = re.sub(r"\[-?@[^\]]*\]", "", t)
    t = re.sub(r"(?<![\w`])@[\w:.#$%&+?<>~/-]+", "", t); t = re.sub(r"\\", "", t)
    t = re.sub(r"#+\s*$", "", t)
    return " ".join(t.split()).lower()


def score(model, quarto, docs):
    """The UNCORRECTED instrument — Session 251's, kept for baseline comparisons."""
    st, div, kinds = Counter(), {}, Counter()
    for p, (code, q) in quarto.items():
        if code != 0: st["A3_render_failed"] += 1; continue
        if p not in model: st["no_model_row"] += 1; continue
        if INC.search(docs.get(p, "")): st["A1_include_excluded"] += 1; continue
        st["scored"] += 1
        m = model[p]
        if [h[0] for h in m] == [h[0] for h in q]:
            st["agree"] += 1
            if [norm(h[1]) for h in m] != [norm(h[1]) for h in q]: st["text_only"] += 1
        else:
            st["diverge"] += 1
            k = "phantom" if len(m) > len(q) else "lost" if len(m) < len(q) else "level"
            kinds[k] += 1; div[p] = (m, q)
    return st, div, kinds


def die(message):
    print(f"realdoc-score: {message}", file=sys.stderr)
    raise SystemExit(2)


def data_dir():
    """The directory holding the PERSONAL corpus artefacts — never committed. See README.md."""
    import os
    d = os.environ.get("REALDOC_DATA")
    if not d:
        die("set REALDOC_DATA to the corpus directory (see tools/realdoc-score/README.md)")
    if not os.path.isdir(d):
        die(f"REALDOC_DATA is not a directory: {d}")
    return d


def ordinals():
    """`path -> 1-based ordinal`, the ONLY way a tracked file may name a corpus document (#548)."""
    import os
    f = os.environ.get("REALDOC_ORDINALS")
    if not f:
        die("set REALDOC_ORDINALS to the corpus file list (see tools/realdoc-score/README.md)")
    if not os.path.exists(f):
        die(f"REALDOC_ORDINALS does not exist: {f}")
    return {p: i + 1 for i, p in enumerate(l for l in open(f, encoding="utf-8").read().split("\n") if l)}


def require(path, what):
    import os
    if not os.path.exists(path):
        die(f"missing {what}: {path}")
    return path


def corpus(data):
    """The frozen corpus text as `{path: text}` — `snapshot.json`, `[[path, text], ...]`."""
    import os
    return dict(json.load(open(require(os.path.join(data, "snapshot.json"), "the frozen corpus"), encoding="utf-8")))
