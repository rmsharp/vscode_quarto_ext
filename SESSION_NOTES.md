# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 290 (IN PROGRESS, claimed 2026-10-05): `.content-visible` written BEFORE `.callout-*`/`.panel-tabset` makes quarto keep the heading; the Outline hides it (deletion).**
`BACKLOG.md` "Active" is empty, so Phase 0 MUST present ranked candidates via `AskUserQuestion`.
**#1 NEXT:** operator picks. Open: R6 residuals (e),(f),(g), (b)'s project-config residual, (d)'s disclosed hazards (bare `F`, opts_hooks), asis/cat/block, unclosed-`<!--`, fence-in-list-item.
**⚠ Gotchas:** (1) never `git add -A`. (2) parallel Bash calls that `cd` race: use absolute paths. (3) macOS `sed -i` needs a suffix arg; mutate with Python. (4) HANDOFFS.md line 23 lost its tail.
### What Session 290 Did
**Deliverable:** fix the class-ORDER Outline deletion (IN PROGRESS)
**Started:** 2026-10-05
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest.

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

## Session 286 Handoff Evaluation (by Session 287)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK named (b),(d)-(g) as open and
the BACKLOG item carried c-numbered probe ids, so I could re-render them; the 2,423/2,438 baseline reproduced.
**Helped:** the item's shape list, the tracked score tool, and the "absent = not established" gotcha, which set the rule.
**Missing:** it said (b)'s measurements were agent-made and not re-run, but not that they hide an engine split. **Wrong:** none found.
**ROI: high** (about ten minutes to a claimed task).

## Session 287 Self-Assessment

**Score: 8/10.**
**Went right.** 118 probes rendered in both modes before a test, which found the engine split (doc `echo: false` is loud when
executed for bash/sh/zsh/perl/ruby) and the project-config hazard. RED shown for the placements, the engine gate and seven
adversarial rows; three mutants killed. The 4-lens workflow (1,264 probes) found three real defects; I re-rendered each firsthand
before fixing. Score unchanged 2,423/2,438; 3,318 tests, types clean.
**Went wrong.** (1) The first reader stripped comments before counting keys, which a quoted `#` defeated; an adversarial pass
caught it, I did not. (2) A stray `e/` directory landed at the repo root from racing parallel `cd` calls; removed. (3) The
`execute:`/top-level placements are trusted despite an invisible project `knitr: opts_chunk` hazard: my judgement call, disclosed
in BACKLOG (b). (4) No `test:integration` run (needs the screen; no host behaviour changed).
**TDD:** RED shown before GREEN; guard rows are disclosed pins. **Cost:** 4 workflow agents (~287k tokens); no screen-taking run.
