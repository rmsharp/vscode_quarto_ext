#!/bin/bash
# usage: render304.sh <lensdir> [width=3]. Reads <lensdir>/manifest.json and renders every listed document into <lensdir>/out/,
# WIDTH at a time, deleting each <doc>_files folder right after (Spotlight indexes those), skipping a doc whose bytes match its
# last render, and waiting for the 1-minute load to fall below 25 before each batch of 12 (feedback_cap_render_load).
# Engine field of the manifest: "r" and "jupyter" EXECUTE (knitr / Jupyter; reticulate is pointed at the python that has matplotlib),
# anything else is rendered with --no-execute. Every other file in the lens dir (child documents, .R sources) is copied beside the outputs.
d=${1%/}; W=${2:-3}; w=$d/out; mkdir -p "$w"
find "$d" -maxdepth 1 -type f ! -name manifest.json -exec cp -n {} "$w"/ \;
node -e '
const m = JSON.parse(require("fs").readFileSync(process.argv[1] + "/manifest.json", "utf8"));
for (const e of m) { if (require("fs").existsSync(process.argv[1] + "/" + e.file)) console.log(e.file + "\t" + (e.engine === "r" || e.engine === "jupyter" ? "exec" : "ne")); }
' "$d" > "$w/.jobs"
one(){ f=$1; mode=$2; b=${f%.*}
  if [ -f "$w/$f" ] && cmp -s "$d/$f" "$w/$f" && [ -f "$w/$b.rc" ]; then return; fi
  cp "$d/$f" "$w/$f"; flag=--no-execute; [ "$mode" = exec ] && flag=
  ( cd "$w" && RETICULATE_PYTHON=/Users/rmsharp/miniforge3/bin/python quarto render "$f" --to html $flag >"$b.log" 2>&1; echo $? > "$b.rc"; rm -rf "${b}_files" ); }
export -f one; export d w
n=0
while IFS=$'\t' read -r f mode; do
  n=$((n+1)); if [ $((n % 12)) -eq 1 ]; then while [ "$(uptime | sed 's/.*load averages*: *//' | awk -F'[ ,]+' '{print int($1)}')" -ge 25 ]; do sleep 5; done; fi
  printf '%s %s\0' "$f" "$mode"
done < "$w/.jobs" | xargs -0 -P "$W" -n1 bash -c 'one $0'
echo "rendered $(ls $w/*.rc 2>/dev/null | wc -l) docs in $w; non-zero rc: $(grep -L '^0$' $w/*.rc 2>/dev/null | wc -l)"
