#!/bin/bash
# usage: build_bundle.sh <out.cjs> [<git-ref>]
# Bundles findHeadings, buildOutline and resolveDocumentEngine into one CommonJS file for score_modes.py (Session 310). Without a git ref it bundles the working tree; with one it
# bundles that commit's src/ (a clean baseline: `build_bundle.sh /tmp/head.cjs HEAD~1`). Needs node_modules (esbuild). Writes nothing into the repository.
set -e
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
if [ -n "$2" ]; then
  SRC=$(mktemp -d) && trap 'rm -rf "$SRC"' EXIT
  (cd "$ROOT" && git archive "$2" src) | tar -x -C "$SRC"
  ln -s "$ROOT/node_modules" "$SRC/node_modules"
else
  SRC=$(mktemp -d) && trap 'rm -rf "$SRC"' EXIT
  ln -s "$ROOT/src" "$SRC/src"
  ln -s "$ROOT/node_modules" "$SRC/node_modules"
fi
cat > "$SRC/entry.ts" <<'EOF'
export { findHeadings, buildOutline } from "./src/core/qmd/model";
export { resolveDocumentEngine } from "./src/core/document-engine-resolve";
EOF
(cd "$ROOT" && npx esbuild "$SRC/entry.ts" --bundle --platform=node --format=cjs --outfile="$OUT" --log-level=warning)
echo "built $OUT"
