#!/usr/bin/env python3
"""Scores a READING of the Outline against quarto's real headings, once per render mode (Session 310).

usage: score_modes.py [--rows FILE] [--fixture FILE] <build.cjs[@mode][,build.cjs[@mode]...]> <executing-dir>~<no-execute-dir> [...]

A READING is a bundle from `build_bundle.sh`, optionally with a render mode: `now.cjs` is the default (executing) reading, `now.cjs@no-execute` the other one.
A PAIR is the same documents rendered twice, `<dir>/<doc>.qmd` plus `<dir>/out/<doc>.{html,rc}`: once normally and once with `quarto render --no-execute`. Only a document with exit 0
in BOTH renders and identical bytes counts, so every reading is scored on the same rows. The engine each reading gets is what the host passes (`resolveDocumentEngine`).

Per reading and per truth it prints rows right, rows HIDING a heading quarto shows (the deleting direction, the worse error) and phantom-only rows (it shows a heading quarto hides).
--rows FILE writes one JSON line per document with every reading's headings. --fixture FILE writes the closed-world fixture `test/fixtures/knitr-print-noexec/quarto-1.7.33.json`
and needs EXACTLY two readings, the default one first: rows are [name, document, engine, quarto executing, quarto --no-execute, the no-execute reading, the default reading]."""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "realdoc-score"))
from extract_headings import extract  # noqa: E402

args = sys.argv[1:]


def take(flag):
    if flag in args:
        i = args.index(flag)
        value = args[i + 1]
        del args[i:i + 2]
        return value
    return None


rows_out = take("--rows")
fixture_out = take("--fixture")
specs = []
for s in args[0].split(","):
    b, _, m = s.partition("@")
    specs.append((os.path.abspath(b), m or None))

NODE = r"""
const fs = require('fs'); const b = require(process.argv[1]); const mode = process.argv[2] || undefined;
const docs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); const out = {};
for (const [name, t] of Object.entries(docs)) {
  const engine = b.resolveDocumentEngine(name + '.qmd', t);
  out[name] = [engine, b.findHeadings(t, engine, mode).map(h => h.text)];
}
console.log(JSON.stringify(out));"""


def heads(path):
    return [t for _l, t in extract(open(path, encoding="utf-8", errors="replace").read())]


def rendered(d, base):
    rc = os.path.join(d, "out", base + ".rc")
    return os.path.exists(rc) and open(rc).read().strip() == "0" and os.path.exists(os.path.join(d, "out", base + ".html"))


rows, skipped = [], {"differ": 0, "norender": 0, "missing": 0}
for pair in args[1:]:
    exd, ned = [os.path.abspath(x).rstrip("/") for x in pair.split("~")]
    for f in sorted(x for x in os.listdir(exd) if x.endswith(".qmd")):
        base = f[:-4]
        if not os.path.exists(os.path.join(ned, f)):
            skipped["missing"] += 1
            continue
        if open(os.path.join(exd, f), "rb").read() != open(os.path.join(ned, f), "rb").read():
            skipped["differ"] += 1
            continue
        if not (rendered(exd, base) and rendered(ned, base)):
            skipped["norender"] += 1
            continue
        rows.append({"set": os.path.basename(exd), "doc": base, "text": open(os.path.join(exd, f), encoding="utf-8").read(),
                     "ex": heads(os.path.join(exd, "out", base + ".html")), "ne": heads(os.path.join(ned, "out", base + ".html"))})

key = lambda r: r["set"] + "/" + r["doc"]
with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
    json.dump({key(r): r["text"] for r in rows}, tmp)
models = [json.loads(subprocess.check_output(["node", "-e", NODE, b, m or "", tmp.name])) for b, m in specs]
os.unlink(tmp.name)


def score(truth):
    out = []
    for model in models:
        s = {"rows": 0, "right": 0, "delRows": 0, "del": 0, "phRows": 0, "ph": 0}
        for r in rows:
            q, got = r[truth], model[key(r)][1]
            sq, sg = set(q), set(got)
            hidden = [t for t in q if t not in sg]
            phantom = [t for t in got if t not in sq]
            s["rows"] += 1
            s["right"] += got == q
            s["del"] += len(hidden)
            s["ph"] += len(phantom)
            s["delRows"] += bool(hidden)
            s["phRows"] += bool(phantom) and not hidden
        out.append(s)
    return out


print(f"paired documents scored: {len(rows)}   skipped: {skipped}   headings differ between the two renders: {sum(r['ex'] != r['ne'] for r in rows)}")
for truth, name in (("ex", "executing"), ("ne", "no-execute")):
    for (b, m), s in zip(specs, score(truth)):
        label = os.path.basename(b) + ("@" + m if m else "")
        print(f"  vs {name:10} truth  {label:26} right={s['right']:4}/{s['rows']:4} | rows hiding a heading={s['delRows']:3} (headings {s['del']:3}) | phantom-only rows={s['phRows']:3} (headings {s['ph']:3})")
if rows_out:
    with open(rows_out, "w") as fh:
        for r in rows:
            fh.write(json.dumps({**r, "engine": models[0][key(r)][0], "readings": [m[key(r)][1] for m in models]}) + "\n")
if fixture_out:
    if len(specs) != 2:
        sys.exit("--fixture needs exactly two readings: the default one first, then the no-execute one")
    fixture = {
        "quarto": "1.7.33 (knitr 1.51)",
        "note": "Session 310: documents rendered BOTH ways with quarto 1.7.33 (exit 0 in both, identical bytes): normally, and with `quarto render --no-execute`. `rows` are [name, document, "
                "engine (what the host passes), quarto's headings executing, quarto's headings under --no-execute, this model's headings read for no-execute when written, this model's "
                "headings read for the executing render when written (the default; byte-identical to the Session 309 build, which `knitr-no-execute-fixture.test.ts` also pins). Closed-world: "
                "regenerate the model columns with `tools/knitr-print-grids/score_modes.py --fixture`; the quarto columns come from the untracked renders named in each row's set.",
        "rows": [[key(r), r["text"], models[0][key(r)][0], r["ex"], r["ne"], models[1][key(r)][1], models[0][key(r)][1]] for r in rows],
    }
    with open(fixture_out, "w") as fh:
        json.dump(fixture, fh)
    print(f"wrote {len(rows)} rows to {fixture_out}")
