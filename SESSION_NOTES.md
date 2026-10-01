# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 281 closed out (P2 of the attribute-tokenizer plan SHIPPED).** `BACKLOG.md` "Active" is
empty, so Phase 0 MUST present ranked candidates via `AskUserQuestion`.
**What S281 did:** new leaf `src/core/qmd/attribute-block.ts` + pandoc truth fixture (`a55735ae`); `:::` openers read
through it in `model.ts` (`db7cf046`); runtime row, 553 passing (`7e2adbd9`). Corpus census 0/0/0; score 2,423/2,438.
**#1 NEXT:** operator picks. Natural: **P3** of the same plan (single-line REFUSED openers become paragraph text); see the
tokenizer item in BACKLOG.md for the residuals. P3 is a separate session and needs its own §9.5 drift check.
**⚠ Gotchas:** (1) P2 shows NO gain on refused openers: the leaf says `refused` but `divSpecReading` answers null and the
legacy reader still hides the heading. (2) pandoc refuses every INDENTED `:::`. (3) `python3 quality_ratchet.py --run` at
close-out; never `git add -A`; `cd` moves the cwd (#535). (4) `dashboard_history.jsonl` is appended by every dashboard run.
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

## Session 279 Handoff Evaluation (by Session 280)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK was
accurate and short, and the Phase 0 candidate list could be built from it plus `BACKLOG.md` in minutes.
**Helped:** the gotchas (untracked `scratchpad/`, `cd` moves the cwd) were both true and both bit me once.
**Missing:** two commits after its close-out (the notes trim and the budget row) had no ledger entry, so
Phase 0 reconcile had to backfill them (`a5242893`); a trim is an action and needs its own entry.
**Not verified:** its note that the tabset-deletion and `maskQuotedValues` items are the deletion-direction
candidates; I did not open them. **ROI: high** (orientation to a claimed task took about fifteen minutes).

## Session 280 Self-Assessment

**Score: 7/10.**
**Went right.** I measured quarto before touching `src/` (54 probes) and wrote each rule clause RED first.
Two adversarial rounds with skeptic verification found 29 regressions in my first build; I reproduced the
first batch myself before trusting it, then rescored ALL prior probe directories with each new bundle. A
mutation pass shows every clause is load-bearing. The corpus check is byte-identical, not just a score.
**Went wrong.** (1) My comparator read heading anchor ids, which a quoted heading lacks, so I wrote a test
and a guard for the opposite of the truth; the adversary's text-based read exposed it. (2) The first
build's gate was the markdown FAMILY, not the `line_blocks` feature. (3) I reused the Session 224
closer-consumption premise where it is false. (4) The first pins were written after the rule and went GREEN
on arrival. (5) I did not run the integration suite (core-only change; no screen-taking run was authorised).
**TDD:** RED shown before GREEN for every behaviour test (two re-done after re-measurement); pins disclosed.
**Cost:** two workflows, 46 agents, 0 errors, ~2.6M subagent tokens, ~1,900 quarto renders.

## Session 278 Handoff Evaluation (by Session 279)

**Score: 9/10.** Self-check by the same model family, not an independent score. Its #1 named the
question, the five witness ordinals, the ground-truth path and its open caveat ("its age is the open
question"), so the measurement started at once. It also corrected its own stale "547/5" guidance.
**Wrong or missing:** it did not say the ground-truth driver uses `--no-execute`, which decides whether
"knitr failure" can mean an R failure; I read `render_keep.py` to learn that. It also did not say that
S265 rendered from snapshot text in a bare temp dir, which is why sibling files are missing.
**ROI: high.** Orientation to a measured first step took about ten minutes.

## Session 279 Self-Assessment

**Score: 8/10.**
**Went right.** I measured the whole population (942 rows) with the original driver, not just the five
named rows, so old and new exit codes compare one-to-one. I confirmed the five named rows by hand.
I diagnosed a spread sample of 79 rows for cause. I touched no `src/` and no corpus file, and rendered
only into scratch directories.
**Went wrong.** (1) The first ground-truth question was framed as "environment or document"; the answer
is "document" but my 79-row cause sample left 26 rows with no recognisable error line, so the cause of
those is UNCLASSIFIED. (2) I armed a throwaway placeholder monitor by mistake. (3) A `cd` into
`scratchpad/` moved the cwd (#535) twice.
**TDD:** exempt and stated -- no logic changed. **Cost:** no workflows, no subagents; ~1,020 renders.

---
