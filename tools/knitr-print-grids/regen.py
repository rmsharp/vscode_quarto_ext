#!/usr/bin/env python3
"""usage: regen.py [fixture-name ...]   Re-renders every document stored in the knitr-print fixtures with the installed `quarto` and rewrites each row's QUARTO column.

Every row of `test/fixtures/knitr-print-*/quarto-1.7.33.json` stores its full document, so a fixture can be regenerated from a clean clone: this renders each document (3 at a time,
`--to html`, executing, in a temporary directory) and extracts the headings the way `tools/realdoc-score/extract_headings.py` does. It does NOT recompute the MODEL columns: after a
rule changes, rebuild and rewrite those with the generator of the fixture (`mkfixture_stm.py` for the statements fixture), or let the closed-world test fail and read its diff.
Run it only to refresh the quarto column when the pinned quarto version moves (the fixture is quarto 1.7.33 / knitr 1.51: re-measure then, Learning 623). It needs R and knitr; the documents
that load a helper file (`_h.R`, `_a.R`, child documents) are skipped, as the stored rows only ever needed the document text."""
import concurrent.futures, glob, json, os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "realdoc-score"))
from extract_headings import extract  # noqa: E402


def render(task):
    name, text = task
    d = tempfile.mkdtemp(prefix="kpg-")
    try:
        open(os.path.join(d, "doc.qmd"), "w", encoding="utf-8").write(text)
        r = subprocess.run(["quarto", "render", "doc.qmd", "--to", "html"], cwd=d, capture_output=True, text=True, timeout=300)
        if r.returncode != 0:
            return name, None
        return name, [t for _l, t in extract(open(os.path.join(d, "doc.html"), encoding="utf-8").read())]
    finally:
        shutil.rmtree(d, ignore_errors=True)


def main():
    wanted = set(sys.argv[1:])
    for path in sorted(glob.glob(os.path.join(ROOT, "test", "fixtures", "knitr-print-*", "quarto-1.7.33.json"))):
        fixture = os.path.basename(os.path.dirname(path))
        if wanted and fixture not in wanted:
            continue
        data = json.load(open(path))
        tasks = [(r[0], r[1]) for r in data["rows"]]
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            results = dict(pool.map(render, tasks))
        changed = 0
        for r in data["rows"]:
            got = results.get(r[0])
            if got is not None and got != r[2]:
                print(f"  {fixture}: {r[0]}: {r[2]} -> {got}")
                r[2] = got
                changed += 1
        json.dump(data, open(path, "w"))
        print(f"{fixture}: {len(tasks)} documents rendered, {changed} quarto answers changed")


main()
