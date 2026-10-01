# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** Session 285 -- R6 residual (c): knitr chunks with no code (IN PROGRESS, claimed 2026-10-01).
**Status:** Session claimed. Orient done; operator chose shape (c) from `BACKLOG.md` "R6 residuals". Work beginning.
**Ledger:** `CHANGELOG: pending` -- close-out records the rest.
**Note:** HANDOFFS.md line 23 lost its `` ``` `` tail in an earlier trim (S284's receipt opener is fused into prose); not fixed here.
## Session 283 Handoff Evaluation (by Session 284)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK named the cmx phantom as
open and the BACKLOG item carried a rendered witness path, which reproduced at once.
**Helped:** the item's `scratchpad/s282/ws3/b.qmd` probe and its "treated as empty" hypothesis (confirmed, with a boundary).
**Missing:** it did not say commonmark readers bypass the tokenizer, so my first edit landed on a dead path. **Wrong:** none.
**ROI: high** (about five minutes to a claimed task).

## Session 284 Self-Assessment

**Score: 8/10.**
**Went right.** I rendered eight probes before writing a test, which gave the boundary (ASCII space/tab empty; U+00A0 and
U+2003 real; single quotes refused). RED was shown for four rows and the three guards were green first. The RED staying red after
my first edit exposed the dead path. Score re-run: 2,423/2,438, no document moved. 3,193 tests passing, types clean.
**Went wrong.** (1) First edit on the wrong branch, reverted. (2) No adversarial pass or workflow this session although
ultracode was on; the change is one regex term over a rendered boundary, so I judged it proportionate, but that was my call.
(3) No `test:integration` run (needs the screen; no host behaviour changed).
**TDD:** RED shown before GREEN. **Cost:** no subagents; no screen-taking run.

## Session 282 Handoff Evaluation (by Session 283)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK said plainly that the
plan was done and Phase 0 must present candidates, and the new filings it named were exactly the item I was handed.
**Helped:** the BACKLOG item's `scratchpad/s282` pointers and the tracked score tool; the baseline reproduced (2,423/2,438).
**Missing:** it did not say both families were already identical with plain text AND carry a decided residual, so the item
needed a scoping question before it was a deliverable. **Wrong:** none found. **Not verified:** its "38 of 6,477" count.
**ROI: high** (about ten minutes to a scoped task).

## Session 283 Self-Assessment

**Score: 7/10.**
**Went right.** I asked for scope before claiming rather than starting a fix on an item that bundles a decided residual with
an unbounded family. The count is firsthand: shape scans over 3,383 documents, then heading COUNT agreement where quarto
exits 0; I read the four tabset hits and found indented code, not the family. The base score re-ran at 2,423/2,438.
**Went wrong.** (1) Three of my comparison scripts failed on the wrong table (`rawadj.tsv`). (2) Ultracode asked for a
workflow and I did the scan inline; the scans are cheap, but nothing independent re-checked my regexes. (3) The comment scan
is a naive open/close count, so the 12 `<!--` documents are not a clean measure. (4) I never rendered a document for this.
**TDD:** not applicable; no logic changed. **Cost:** no subagents; one `npm test` (3,186 passing); no screen-taking run.

## Session 281 Handoff Evaluation (by Session 282)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK named P3 as the natural
next step and the plan's drift rule as the first thing to re-check, which is exactly what I needed.
**Helped:** gotcha (1) (a refused opener gains nothing in P2) and gotcha (2) (every indented `:::` is refused) both held.
**Missing:** it did not say the census tooling and fill-1 probe truth were still on disk; I found them by looking.
**Wrong:** none found. **Not verified:** its "553 passing" figure was reproduced only as 3,109 unit tests at Orient.
**ROI: high** (about fifteen minutes to a claimed task).

## Session 282 Self-Assessment

**Score: 8/10.**
**Went right.** I re-rendered 146 rows with quarto before editing and found no drift from the plan's recorded truth. The two
halves of the encoding went in one at a time, and the push-only half's six broken guards were the RED for the second half. All
ten plan mutants are killed. I did not accept the workflow's "0 regressions": the raw files held 38, and plain-text controls
showed both families pre-existing and phantom-only.
**Went wrong.** (1) The 35 later rows went green on arrival, so they are pins of one encoding, disclosed in the test comment.
(2) My shell cwd drifted into `scratchpad` several times (#535). (3) The agents' prose misreported their own result files.
(4) The cmx `title="   "` phantom and the two exposed families are filed, not fixed.
**TDD:** RED shown for `r3` and for the six guards before the open arm; the rest are pins. **Cost:** one workflow, 12 agents,
0 errors, ~0.83M subagent tokens; one screen-taking integration run, approved just before launch.
