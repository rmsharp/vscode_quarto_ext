# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 283 closed out (measure-then-decide on P3's two phantom families; NO `src/` change).**
`BACKLOG.md` "Active" is empty, so Phase 0 MUST present ranked candidates via `AskUserQuestion`.
**What S283 did:** priced both families over 3,383 documents: reach 0 (tabset preamble, raw TeX/HTML blocks); score 2,423/2,438 unchanged.
**#1 NEXT:** operator picks. Open: cmx `title="   "` phantom, R6 residuals, unclosed-`<!--` deletion shape (reach 0 too).
**⚠ Gotchas:** (1) `rawadj.tsv` is only 14 rows; use `model.tsv` per document. (2) never `git add -A`; `cd` moves the cwd (#535).
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

## Session 280 Handoff Evaluation (by Session 281)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK was short and
true, and the candidate list for Phase 0 came straight from it plus `BACKLOG.md`.
**Helped:** gotcha (4) (`dashboard_history.jsonl` is left uncommitted) and the untracked-`scratchpad/` warning, both
true. **Missing:** the commit after its close-out (`ba6eb69e`, budget rows) again had no ledger entry, the second
session running; Phase 0 reconcile backfilled it (`d8b7c764`). **Not verified:** its "15 of 54 wrong at HEAD" figure;
I did not reopen `scratchpad/s280`. **ROI: high** (about ten minutes to a claimed task).

## Session 281 Self-Assessment

**Score: 7/10.**
**Went right.** I asked the operator about the plan's drift rule instead of waiving it, with evidence (anchors resolve,
zero hits on the five symbols). The leaf is checked against 804 live-pandoc rows per dialect and, separately, 24,000
fuzzed specs (0 kind/fallback disagreements). Two adversary workflows (~2,000 model documents against `quarto render`)
found 0 regressions. I re-rendered every layer-2 witness myself (via an agent) and it caught a wrong plan expectation.
**Went wrong.** (1) The leaf parser was written in ONE pass after its first nine RED rows, so the refusal, quote-fallback
and escape rows passed on arrival; I proved them load-bearing by mutation (11 of 14 killed, 3 equivalent) rather than by
RED. (2) Layer 2 was likewise one implementation for 33 RED rows, not one row at a time. (3) My first TAB-column row
assumed a refusal gain P2 does not have; a mutation run exposed it and I replaced it. (4) §9.5 step 6's identity control
and its timing were not run; the census ran parent-vs-tree only (0/0/0, 3,382 of 3,383 read, 0 threw).
**TDD:** RED shown for the first leaf group and for all 33 layer-2 rows before GREEN; the rest are pins, disclosed above.
**Cost:** two workflows, 5 agents, 0 errors, ~0.5M subagent tokens; one screen-taking integration run, approved just before.
