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

## ⚠ `HANDOFFS-through-2026-08-24.md.verify.sh` FAILS, and the failure is spurious

Running it prints:

```
FAIL: L2 FRONT MATTER lost 1 line(s), first:
'**Older receipts are archived.** This file currently holds **218**; th'
```

**The archive is not corrupt and nothing was lost.** This is a known upstream bug, **already fixed
in canonical `methodology_trim.py` v1.3.0 as BL-27**. This project runs **v1.1.1**, the pre-release
UAT copy Session 188 installed.

**Why it fires.** `HANDOFFS.md`'s config declares a *regenerated* front-matter field — the receipt
count, which the trimmer rewrites to the retained count on every run (here `218` → `7`). The
in-process `assert_L2` is given the `reversals` list and replays it backwards, so it correctly
confines the front-matter diff to declared changes and passes. But v1.1.1's `build_verify()`
substitutes only `SHARD/LIVE/VER/INJECTED/KIND/START/INFO/FOOTER` into the emitted script — it
never passes `spec.regenerated`. The standalone script therefore has no way to know that the
changed line is a declared regeneration, and reports it as lost. v1.3.0 adds an `@@REGEN@@`
substitution plus a line-by-line carve-out for exactly these fields.

**It cannot affect the CHANGELOG shard.** `CHANGELOG.md` declares **zero** regenerated fields,
which is precisely why [`CHANGELOG-through-2026-08-24.md.verify.sh`](CHANGELOG-through-2026-08-24.md.verify.sh)
passes and this one does not.

**Do not fix it by editing `methodology_trim.py`** — it is a synced file, and a local edit blocks
future syncs (`CLAUDE.md`; `BOOTSTRAP.md` drift safety). The fix is to sync the tool to v1.3.0 and
regenerate the script. Note that v1.3.0 also changes shard naming (BL-41), so that sync is its own
deliverable, not a drive-by.

**What was verified instead**, for this shard:

1. the tool's in-process `L1_OK` / `L2_OK` / `L3_OK` / `P1A_OK`;
2. an independent verifier sharing no code with the tool — its own fence scanner, record splitter,
   code-span finder and link inverter — 8/8 passing, including the ordered record list compared
   byte-for-byte against `git show 8326cdd9:HANDOFFS.md`;
3. the front-matter diff read by hand: exactly two changes, both declared — the regenerated count
   and the inserted pointer block.

## Re-verifying a shard later

The scripts compare `HEAD` against the working tree, so they are meaningful in the commit that
introduces a trim. To re-check an older shard, run the trimmer's assertions against the commit that
created it rather than against a much later `HEAD`.
