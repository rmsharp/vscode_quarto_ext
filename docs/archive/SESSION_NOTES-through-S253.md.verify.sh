#!/usr/bin/env bash
# Losslessness proof for docs/archive/SESSION_NOTES-through-S253.md
#
# Run from the repository root:
#   bash docs/archive/SESSION_NOTES-through-S253.md.verify.sh
#
# Exit 0 = every record the trim moved is byte-identical to the text it replaced, and the split is
# an exhaustive partition of the pre-trim file. Non-zero = a real finding.
#
# WHAT THIS PROVES, AND WHY IT IS HAND-WRITTEN
# --------------------------------------------
# `methodology_trim.py` CANNOT produce this proof, and that is a property of the tool's model rather
# than an omission. Its `LEDGERS` table (methodology_trim.py:186) holds exactly two entries and the
# tool reads no config of any kind, so `--file SESSION_NOTES.md` exits 3 with `NO_CONFIG` — by
# design: *"There is deliberately no generic fallback: a generic rule is what would mis-zone a
# differently-shaped ledger."* And a `LedgerSpec` could not be written for this file even if the
# table were editable: `date_of_record` is a REQUIRED parameter and `evaluate()` freezes the oldest
# BY DATE, but 458 of this file's 740 session records carry no date anywhere in their body and only
# 88 of 740 headings carry one. This file's reduction axis is the SESSION NUMBER, not the calendar.
# That is the same wall canonical hit for its own `BACKLOG.md` (upstream BL-32, open, undecided),
# and the same answer: reduce by hand, prove it with an identity-keyed check.
#
# Identity-keyed, never positional. Each record is keyed on its own heading text (plus an occurrence
# index, because exactly one heading text repeats — asserted below, not assumed). The trimmer's
# generated proofs compare by POSITION with a 0/1 `injected` flag standing in for "how many records
# did this commit add", which is why positional identity breaks by construction whenever a trim
# commit is bundled with any other same-ledger edit (upstream BL-36). An identity-keyed comparison
# cannot fail that way: it asks "is THIS record's content still exactly what it was".
#
# SELF-LOCATING. It finds its own commits, so it stays meaningful at any future HEAD:
#   TRIM = the commit that ADDED the shard;  BASE = that commit's first parent.
# Before the trim is committed it falls back to BASE=HEAD vs the WORKING TREE, so the same script
# is the in-session check and the durable artifact.

set -u

LIVE="SESSION_NOTES.md"
SHARD="docs/archive/SESSION_NOTES-through-S253.md"

if [ ! -f "$SHARD" ]; then
  echo "verify: FAIL — $SHARD not found. Run from the repository root." >&2
  exit 2
fi

TRIM_SHA="$(git log --diff-filter=A --format=%H -- "$SHARD" | tail -1)"
if [ -n "$TRIM_SHA" ]; then
  BASE_SHA="$(git rev-parse --verify "${TRIM_SHA}^" 2>/dev/null || true)"
  MODE="committed"
else
  TRIM_SHA=""
  BASE_SHA="$(git rev-parse --verify HEAD)"
  MODE="worktree"
fi
if [ -z "$BASE_SHA" ]; then
  echo "verify: FAIL — cannot resolve the pre-trim commit." >&2
  exit 2
fi
if ! git cat-file -e "${BASE_SHA}:${LIVE}" 2>/dev/null; then
  echo "verify: FAIL — cannot read ${BASE_SHA}:${LIVE}. Is this the right clone?" >&2
  exit 2
fi

BEFORE="$(mktemp)"; AFTER="$(mktemp)"; SHARDTXT="$(mktemp)"
trap 'rm -f "$BEFORE" "$AFTER" "$SHARDTXT"' EXIT
git show "${BASE_SHA}:${LIVE}" > "$BEFORE" || exit 2
if [ "$MODE" = "committed" ]; then
  git show "${TRIM_SHA}:${LIVE}"  > "$AFTER"    || exit 2
  git show "${TRIM_SHA}:${SHARD}" > "$SHARDTXT" || exit 2
else
  cp "$LIVE"  "$AFTER"
  cp "$SHARD" "$SHARDTXT"
fi

echo "source : ${MODE}; base ${BASE_SHA:0:7}${TRIM_SHA:+, trim ${TRIM_SHA:0:7}}"

BEFORE="$BEFORE" AFTER="$AFTER" SHARDTXT="$SHARDTXT" SHARD="$SHARD" python3 - <<'PY'
import os, re, sys, pathlib

before = pathlib.Path(os.environ["BEFORE"]).read_text(encoding="utf-8")
after  = pathlib.Path(os.environ["AFTER"]).read_text(encoding="utf-8")
shard  = pathlib.Path(os.environ["SHARDTXT"]).read_text(encoding="utf-8")

HEAD_RE = re.compile(r"^#{1,6} .*$", re.M)
FENCE_RE = re.compile(r"^(`{3,}|~{3,})", re.M)

# The first record of the LIVE file. Everything above it is front matter, which the trim PINS.
FIRST_RECORD = "### What Session 256 Did"
# The shard's own front matter ends at this sentinel; records follow it.
SHARD_SENTINEL = "<!-- ARCHIVED RECORDS BEGIN — nothing above this line came from SESSION_NOTES.md -->"

fails, checks = [], []

def note(ok, label, detail=""):
    checks.append((ok, label, detail))
    if not ok:
        fails.append(label)

# ---------------------------------------------------------------------------------------------
# C0 — preconditions. Both are asserted rather than assumed, because each one, if it silently
# stopped holding, would make every later check measure the wrong thing.
# ---------------------------------------------------------------------------------------------
note(not FENCE_RE.search(before),
     "C0a no fenced blocks in the pre-trim file",
     "a fence would make the plain heading scan below unsound")

note(before.count(FIRST_RECORD) == 1 and SHARD_SENTINEL in shard,
     "C0b zone sentinels present and unique",
     "FIRST_RECORD count=%d; shard sentinel=%s"
     % (before.count(FIRST_RECORD), SHARD_SENTINEL in shard))

# C0c — the retained file must still OPEN on the same first record, and the shard must not have
# stolen it. Checked here rather than left to crash inside zones(): a proof that dies with a
# traceback reports nothing, and "no output" reads far too much like "nothing was wrong".
note(after.count(FIRST_RECORD) == 1 and FIRST_RECORD not in shard,
     "C0c retained file still opens on its first record",
     "in retained=%d; leaked into shard=%s"
     % (after.count(FIRST_RECORD), FIRST_RECORD in shard))

if fails:
    for ok, label, detail in checks:
        print("  %s  %s%s" % ("ok  " if ok else "FAIL", label, (" — " + detail) if detail and not ok else ""))
    print("verify: FAIL — %s" % ", ".join(fails)); sys.exit(1)

def zones(text, first_record):
    i = text.index(first_record)
    return text[:i], text[i:]

before_front, before_recs = zones(before, FIRST_RECORD)
after_front,  after_recs  = zones(after,  FIRST_RECORD)
shard_recs = shard.split(SHARD_SENTINEL, 1)[1].lstrip("\n")

def records(text):
    """{(heading, occurrence): verbatim body}. A body runs from its heading to the next heading
    or EOF. Keyed on identity — heading text plus occurrence index — never on ordinal position."""
    hits = [m.start() for m in HEAD_RE.finditer(text)]
    seen, out, order = {}, {}, []
    for k, pos in enumerate(hits):
        end = hits[k + 1] if k + 1 < len(hits) else len(text)
        head = text[pos:text.index("\n", pos)] if "\n" in text[pos:] else text[pos:]
        n = seen.get(head, 0); seen[head] = n + 1
        key = (head, n)
        out[key] = text[pos:end]
        order.append(key)
    return out, order

was,   was_order   = records(before_recs)
kept,  kept_order  = records(after_recs)
arch,  arch_order  = records(shard_recs)

# ---------------------------------------------------------------------------------------------
# C1 — identity set. Every pre-trim record appears exactly once across {retained, archived};
# nothing was added and nothing vanished. Caught here, before any byte comparison.
# ---------------------------------------------------------------------------------------------
overlap = sorted(set(kept) & set(arch))
lost    = sorted(set(was) - set(kept) - set(arch))
added   = sorted(set(kept) | set(arch)) and sorted((set(kept) | set(arch)) - set(was))
note(not overlap and not lost and not added,
     "C1 identity set: %d before = %d retained + %d archived" % (len(was), len(kept), len(arch)),
     "overlap=%s lost=%s added=%s" % (overlap[:3], lost[:3], added[:3]))

# ---------------------------------------------------------------------------------------------
# C2 — per-record byte identity. Every record still holds exactly the bytes it held before.
# ---------------------------------------------------------------------------------------------
diff = [k for k in was if k in kept and kept[k] != was[k]] + \
       [k for k in was if k in arch and arch[k] != was[k]]
note(not diff, "C2 per-record byte identity over %d records" % len(was),
     "first differing: %s" % (diff[:2],))

# ---------------------------------------------------------------------------------------------
# C3 — exhaustive partition. The strongest single check: retained records ++ archived records
# reproduces the pre-trim records zone byte-for-byte. Byte accounting, not record accounting.
# ---------------------------------------------------------------------------------------------
recombined = after_recs + shard_recs
note(recombined == before_recs,
     "C3 exhaustive partition: %d B retained + %d B archived == %d B before"
     % (len(after_recs.encode()), len(shard_recs.encode()), len(before_recs.encode())),
     "recombined %d B vs before %d B%s"
     % (len(recombined.encode()), len(before_recs.encode()),
        "" if len(recombined) != len(before_recs) else
        " — SAME LENGTH, CONTENT DIFFERS: first divergence at byte %d"
        % next((i for i, (x, y) in enumerate(zip(recombined, before_recs)) if x != y), -1)))

# ---------------------------------------------------------------------------------------------
# C4 — front matter confined. The pinned zone changed ONLY by the declared pointer block. This is
# what stops a trim quietly rewriting standing instructions while the records all check out.
# ---------------------------------------------------------------------------------------------
POINTER_OPEN = "**Archived "
pb = [l for l in after_front.split("\n") if l not in before_front.split("\n")]
removed = [l for l in before_front.split("\n") if l not in after_front.split("\n")]
note(not removed and all(l.strip() == "" or l.startswith(POINTER_OPEN) or l.startswith("Losslessness")
                         or l.startswith("run it") for l in pb),
     "C4 front matter confined to the declared pointer block",
     "removed=%s unexpected_added=%s" % (removed[:2], [l[:60] for l in pb if l.strip()][:3]))

# ---------------------------------------------------------------------------------------------
# C5 — the seam. Retained is strictly newer than archived in the file's own order: every retained
# record precedes every archived record in the pre-trim ordering. This is the check that a
# byte-level proof cannot supply — C3 passes just as happily on a WRONG partition.
# ---------------------------------------------------------------------------------------------
pos = {k: i for i, k in enumerate(was_order)}
newest_archived = min((pos[k] for k in arch if k in pos), default=None)
oldest_retained = max((pos[k] for k in kept if k in pos), default=None)
note(newest_archived is not None and oldest_retained is not None
     and oldest_retained < newest_archived,
     "C5 seam: oldest retained (#%s) strictly precedes newest archived (#%s)"
     % (oldest_retained, newest_archived),
     "the split is not a clean prefix of the file's own order")

# ---------------------------------------------------------------------------------------------
# C6 — the shard's own count sentence is true. A hand-maintained count is a future lie; this is
# the one place it gets checked against the artifact it describes.
# ---------------------------------------------------------------------------------------------
m = re.search(r"Holds \*\*(\d+) record\(s\)\*\*", shard)
note(m is not None and int(m.group(1)) == len(arch),
     "C6 shard count sentence == %d archived records" % len(arch),
     "sentence says %s" % (m.group(1) if m else "<absent>"))

for ok, label, detail in checks:
    print("  %s  %s%s" % ("ok  " if ok else "FAIL", label, (" — " + detail) if detail and not ok else ""))

if fails:
    print("verify: FAIL — %s" % ", ".join(fails)); sys.exit(1)
print("OK: C0-C6 hold for %s" % os.environ["SHARD"])
PY
