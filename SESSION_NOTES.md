# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 291 (IN PROGRESS, claimed 2026-10-05): a heading inside a block quote or list item that opens a callout is suppressed by the Outline (deletion).**
`BACKLOG.md` "Active" is empty, so Phase 0 MUST present ranked candidates via `AskUserQuestion`.
**#1 NEXT:** finish the claimed item. Still open after it: R6 residuals (e)-(g), the empty `---` pair, S290's regex-route residuals; the removal-phantom position awaits the operator.
**⚠ Gotchas:** (1) never `git add -A`; `scratchpad/s290/corpus` holds COPIES of personal corpus documents. (2) `cmp2.cjs` hides deletes-MORE; use `xbuild.cjs`. (3) parallel Bash `cd` races: use absolute paths.
### What Session 291 Did
**Deliverable:** fix the callout-title deletion for a heading nested in a block quote or list item (IN PROGRESS)
**Started:** 2026-10-05
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest.

## Session 289 Handoff Evaluation (by Session 290)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt's `whats_next` named my item first and
the BACKLOG item carried the S260 probe paths, so the claim took one question; the ratchet citation matched a fresh run.
**Helped:** the ranked list, the tracked score tool, and `render3.sh`/`cmp3.cjs`, which I copied into `scratchpad/s290`.
**Missing:** nothing needed. **Wrong:** its ACTIVE TASK still listed unclosed-`<!--` as open after it had closed that item; its
gotcha (4), "HANDOFFS.md line 23 lost its tail", I could not reproduce. **ROI: high** (about ten minutes to a claimed task).

## Session 290 Self-Assessment

**Score: 8/10.**
**Went right.** I rendered the S260 probes myself before fanning out, so the first workflow started from a verified defect. Its six
lenses (1,923 probes) found that only nine class names ever dispatch and that the corpus has zero reach. TDD: RED shown per slice
(31 of 71 tests RED at HEAD); 12 mutants killed after I closed the one that survived. The adversarial pass (3,679 probes) was
refuted claim by claim, and I re-classified 4,366 cached renders against three builds to prove the final fix monotone.
**Went wrong.** (1) My compare tool labelled by class, so a shape where my first cut deleted one MORE heading than HEAD read
"still-DELETES"; only a refuter caught it, and I fixed it (3 RED rows). (2) I wrote one vacuous assertion (a literal against
itself) and caught it on re-reading. (3) The fix leaves removal unmodelled: 63 of 4,366 probes went right to phantom; disclosed,
and the position awaits the operator. (4) The corpus lens left COPIES of personal corpus documents under `scratchpad/s290/corpus`
(untracked, not ignored). (5) No `test:integration` run (needs the screen; core-only change).
**TDD:** RED shown before GREEN. **Cost:** 14 agents (~2.3M tokens), about two hours of renders; no screen-taking run.

## Session 288 Handoff Evaluation (by Session 289)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK said `BACKLOG.md` "Active" was
empty and listed the open items, so Phase 0 took one question; the 2,423/2,438 baseline reproduced.
**Helped:** the ranked open list and the tracked score tool. **Missing:** nothing needed. **Wrong:** its BACKLOG item and the
`insideHtmlComment` docstring said an unclosed `<!--` runs "to the next blank line"; measured, it is paragraph text. **ROI: high.**

## Session 289 Self-Assessment

**Score: 8/10.**
**Went right.** 55 probes in both modes before any test showed the real rule (paragraph text, not a comment), not the one the
backlog assumed. RED shown for the core row and for the three CommonMark-family rows; three mutants killed. I measured the
reader axis myself before fanning out, which caught that `gfm`/`commonmark` swallow to EOF and gated the rule. A 4-lens workflow
(655 probes) found no deletion; I re-ran the tabset claim firsthand. Score unchanged 2,423/2,438; 3,519 tests; corpus diff 0 of 3,383.
**Went wrong.** (1) My first cut ignored the reader and would have regressed `gfm`; found by my own probe, not a test. (2) The
`insideHtmlComment` docstring still repeats the wrong "next blank line" claim; not edited, by scope. (3) No `test:integration` run.
**TDD:** RED shown before GREEN. **Cost:** 4 workflow agents (~294k tokens); no screen-taking run.

## Session 287 Handoff Evaluation (by Session 288)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK listed (d)-(g) as open and the
BACKLOG item carried lettered shapes and probe paths, so scoping took one question; the 2,423/2,438 baseline reproduced.
**Helped:** the shape list, the tracked score tool, and the harness (`run1.sh`, generator) that I reused for 310 probes.
**Missing:** it did not say that the header reader pre-dated a raw-string hazard. **Wrong:** none found.
**ROI: high** (about ten minutes to a claimed task).

## Session 288 Self-Assessment

**Score: 8/10.**
**Went right.** Three probe rounds in both modes before any test; round 3 found a pre-existing deleting defect (raw strings),
fixed first. Five TDD slices with RED shown each time; seven mutants killed; the evaluator was differential-tested against R
(242,547 expressions, 0 mismatches). A 4-lens workflow (4,990 probes) found no defect in the new rules; I re-rendered the three
consequential reports firsthand. Score unchanged 2,423/2,438; 3,471 tests, types clean.
**Went wrong.** (1) My first mutation script used `sed -i` on macOS and silently applied nothing; I caught it from identical
results and redid it in Python. (2) I wrote one comment claiming `0` was loud when I had measured it silent; fixed before commit.
(3) The pass reproduced residuals I did not fix (bare `F`, `opts_hooks`, redefined `&`, printing chunks): disclosed in BACKLOG
(d), not fixed, by scope. (4) No `test:integration` run (needs the screen; no host behaviour changed). (5) `quality_ratchet`
reads `ledger-lag` 2 until this close-out commit lands; budget over-ceilings on three files predate me.
**TDD:** RED shown before GREEN. **Cost:** 4 workflow agents (~419k tokens); no screen-taking run.
