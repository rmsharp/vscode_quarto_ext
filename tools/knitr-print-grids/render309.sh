#!/bin/bash
# usage: render309.sh <ABSOLUTE dir> [width=3]. Like render304.sh, but renders with `-M keep-md:true` so that quarto's intermediate markdown
# (`<doc>.html.md`) is kept: it lists, per chunk, the fences knitr hands pandoc. Executes (manifest engine "r"); deletes `<doc>_files/`
# right after (Spotlight); skips a doc whose bytes match its last render; waits for the 1-minute load to fall below 25 before each batch of 12.
d=${1%/}; W=${2:-3}; w=$d/out; mkdir -p "$w"
find "$d" -maxdepth 1 -type f ! -name manifest.json -exec cp -n {} "$w"/ \;
node -e '
const m = JSON.parse(require("fs").readFileSync(process.argv[1] + "/manifest.json", "utf8"));
for (const e of m) { if (require("fs").existsSync(process.argv[1] + "/" + e.file)) console.log(e.file); }
' "$d" > "$w/.jobs"
one(){ f=$1; b=${f%.*}
  if [ -f "$w/$f" ] && cmp -s "$d/$f" "$w/$f" && [ -f "$w/$b.rc" ]; then return; fi
  cp "$d/$f" "$w/$f"
  ( cd "$w" && RETICULATE_PYTHON=/Users/rmsharp/miniforge3/bin/python quarto render "$f" --to html -M keep-md:true >"$b.log" 2>&1; echo $? > "$b.rc"; rm -rf "${b}_files" ); }
export -f one; export d w
n=0
while IFS= read -r f; do
  n=$((n+1)); if [ $((n % 12)) -eq 1 ]; then while [ "$(uptime | sed 's/.*load averages*: *//' | awk -F'[ ,]+' '{print int($1)}')" -ge 25 ]; do sleep 5; done; fi
  printf '%s\0' "$f"
done < "$w/.jobs" | xargs -0 -P "$W" -n1 bash -c 'one $0'
echo "rendered $(ls $w/*.rc 2>/dev/null | wc -l) docs in $w; non-zero rc: $(grep -L '^0$' $w/*.rc 2>/dev/null | wc -l)"
