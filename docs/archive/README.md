# Ledger archive

Frozen shards of the two grow-and-must-be-read ledgers, written by
[`methodology_trim.py`](../../methodology_trim.py). Same format, same newest-on-top order as the
live files — a shard is the same ledger, continued. Nothing here is edited by hand.

| Shard | Records | Span |
|---|---|---|
| [`CHANGELOG-through-2026-08-24.md`](CHANGELOG-through-2026-08-24.md) | 230 records (+6 untagged entries, see below) | **2026-06-27** → 2026-08-24 |
| [`HANDOFFS-through-2026-08-24.md`](HANDOFFS-through-2026-08-24.md) | 211 | 2026-07-09 → 2026-08-24 |

Both were written by Session 254 — the project's first trim. `methodology_trim.py` had been
installed since Session 188 and recorded there as *"installed, not yet used"*.

## ⚠ The CHANGELOG shard's own span label says `2026-06-30`; its true oldest entry is `2026-06-27`

The shard's `h1`, its "Holds **230 record(s)**" sentence, and the pointer block left in
`CHANGELOG.md` all give the span as **2026-06-30 → 2026-08-24**. **The content actually reaches back
to 2026-06-27.** Nothing is missing — this is a labelling artifact, and the earlier entries are
present verbatim.

**Why.** The record grammar is `^### \d{4}-\d{2}-\d{2} · \[` — a dated heading *plus* a source tag.
The project's six earliest entries were written before that tagging convention existed:

    ### 2026-06-27      ### 2026-06-28      ### 2026-06-29
    ### 2026-06-30      ### 2026-06-30 (later)      ### 2026-06-30 (latest)

None carries a `· [tag]`, so none is a *record start*. A record runs to the next record start, so
these six ride inside the span of the oldest tagged record and moved with it — bytes intact — while
contributing nothing to the count or to the computed span. That is why the shard holds **230
records** but **236 dated `###` headings**.

**Verified, not assumed:** four independent audit lenses (byte accounting, per-record identity,
non-record scaffolding, and reconstruction from git history) each confirmed that concatenating the
live records zone with the shard's reproduces the pre-trim records zone byte-for-byte. The bootstrap
entries — the Phase 1 walking skeleton, the Phase 2 grammar, the Phase 3 render work, the TDD
directive — are all in this shard. **Search it for `2026-06-27`, not the span label.**

## Both verify scripts pass — RESOLVED at Session 255

**Run them.** Both re-derive L1/L2/L3 from git against the trim commit that produced their shard:

```
$ bash docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh
source : the trim commit 8326cdd
records: 237 before = 7 retained + 230 archived; added by the trim commit: 1
OK: L1, L2/front-matter, L3 hold for docs/archive/CHANGELOG-through-2026-08-24.md

$ bash docs/archive/HANDOFFS-through-2026-08-24.md.verify.sh
source : the trim commit 867e0fa
records: 218 before = 7 retained + 211 archived; added by the trim commit: 0
OK: L1, L2/front-matter, L3 hold for docs/archive/HANDOFFS-through-2026-08-24.md
```

**History, because the fix is more interesting than the bug.** As written at Session 254 the
HANDOFFS script reported `FAIL: L2 FRONT MATTER lost 1 line(s)` on an intact archive. `HANDOFFS.md`
declares a *regenerated* front-matter field — the receipt count, rewritten to the retained count on
every trim (`218` → `7`). The trimmer's in-process `assert_L2` is handed a `reversals` list and
replays it backwards, so it correctly confined the diff to declared changes and passed. But
**v1.1.1's `build_verify()` never received `spec.regenerated`**, so the *exported* proof could not
tell a declared regeneration from a lost line — it was strictly weaker than the check it claimed to
reproduce, and it failed in the direction that looks like corruption. It could not fire on
`CHANGELOG.md`, which declares zero regenerated fields; that asymmetry was the whole tell.

Known upstream as **BL-27** and fixed in **v1.3.0**, which passes the patterns in via an `@@REGEN@@`
substitution plus a line-by-line carve-out, and carries a regression test named for the symptom
(`TestVerifyShHandoffFalsePositives`). Session 255 synced the tool `v1.1.1 → v1.3.0` and regenerated
both scripts from it. **The HANDOFFS archive was never damaged** — Session 254 established that four
independent ways before shipping it; what changed is that the tool's own exported proof now agrees.

## Re-verifying a shard later

The scripts compare `HEAD` against the working tree, so they are meaningful in the commit that
introduces a trim. To re-check an older shard, run the trimmer's assertions against the commit that
created it rather than against a much later `HEAD`.
