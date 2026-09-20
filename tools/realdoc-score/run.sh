#!/usr/bin/env bash
# The real-document measure, end to end: how often this extension's Outline agrees with
# `quarto render` across the authored corpus. Session 268; see README.md.
#
#   tools/realdoc-score/run.sh <label> [src-dir]
#
# <src-dir> is a directory holding `src/` — the repo root by default, or any build snapshot
# (e.g. one made with `git archive <sha> src | tar -x -C <dir>`), which is how two builds are
# compared over byte-identical input. Intermediates land in $REALDOC_DATA/runs/<label>/.
#
# Requires REALDOC_DATA and REALDOC_ORDINALS (the personal corpus; never committed) — each script
# names the one it is missing. `set -u` here makes a missing variable fail before any work.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LABEL="${1:-}"
SRC="$(cd "${2:-$REPO}" && pwd)"
if [ -z "$LABEL" ]; then
  echo "realdoc-score: usage: tools/realdoc-score/run.sh <label> [src-dir]" >&2
  exit 2
fi
: "${REALDOC_DATA:?set REALDOC_DATA to the corpus directory (see tools/realdoc-score/README.md)}"
: "${REALDOC_ORDINALS:?set REALDOC_ORDINALS to the corpus file list (see tools/realdoc-score/README.md)}"
DATA="$(cd "$REALDOC_DATA" && pwd)"
WORK="${REALDOC_RUNS:-$DATA/runs}/$LABEL"
mkdir -p "$WORK"
cd "$REPO"

echo "realdoc-score: [1/4] census — $SRC over $DATA/snapshot.json"
REALDOC_SRC="$SRC" REALDOC_CORPUS="$DATA/snapshot.json" REALDOC_OUT="$WORK/model.tsv" \
  npx vitest run --config tools/realdoc-score/vitest.census.config.ts >"$WORK/census.log" 2>&1 ||
  { tail -20 "$WORK/census.log" >&2; exit 1; }
grep -F "realdoc-score census" "$WORK/census.log" | tail -1

echo "realdoc-score: [2/4] bundle — $SRC/src/core/qmd/model.ts"
npx esbuild "$SRC/src/core/qmd/model.ts" --bundle --platform=node --format=cjs \
  --outfile="$WORK/model.cjs" --log-level=warning

echo "realdoc-score: [3/4] raw-HTML adjustment"
node tools/realdoc-score/rawhtml_adjust.js "$DATA/snapshot.json" "$WORK/rawadj.tsv" "$WORK/model.cjs"

echo "realdoc-score: [4/4] score"
REALDOC_DATA="$DATA" REALDOC_ORDINALS="$REALDOC_ORDINALS" \
  python3 tools/realdoc-score/score.py "$LABEL" "$WORK/model.tsv" "$WORK/rawadj.tsv"
