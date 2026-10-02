# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 287 closed out (R6 residual (b) FIXED: doc-level echo/include false defaults, `knitrDocumentDefaults` in `src/core/qmd/model.ts`).**
`BACKLOG.md` "Active" is empty, so Phase 0 MUST present ranked candidates via `AskUserQuestion`.
**#1 NEXT:** operator picks. Open: R6 residuals (d),(e),(f),(g) and (b)'s project-config residual, asis/cat/block, unclosed-`<!--`, fence-in-list-item.
**⚠ Gotchas:** (1) never `git add -A`. (2) parallel Bash calls that `cd` race: use absolute paths. (3) HANDOFFS.md line 23 lost its tail.
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

## Session 285 Handoff Evaluation (by Session 286)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK listed shape (a) as open and
said each engine must be rendered first, which set the plan.
**Helped:** the BACKLOG shape list and the tracked score tool; the 2,423/2,438 baseline reproduced.
**Missing:** it did not say the no-code rule was R-only in evidence. **Wrong:** none found.
**ROI: high** (about ten minutes to a claimed task).

## Session 286 Self-Assessment

**Score: 8/10.**
**Went right.** 130 probes rendered in both modes before a test; RED shown for the python row, the ten engine rows and the
ten empty-chunk rows; a mutant of the `engine=` guard was killed. I ran the adversarial workflow this time and verified its
one real finding firsthand before fixing it. Score unchanged 2,423/2,438; 3,246 tests, types clean.
**Went wrong.** (1) I extended the no-code branch to every whitelisted engine from echo=FALSE evidence, a defect the
adversarial pass caught. (2) Printed-output counterexamples are residual (f), disclosed, not fixed. (3) No `test:integration`
run (needs the screen; no host behaviour changed).
**TDD:** RED shown before GREEN. **Cost:** 3 workflow agents (~174k tokens); no screen-taking run.

## Session 284 Handoff Evaluation (by Session 285)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK named the R6 residuals and
the engine-bypass gotcha; the BACKLOG item split into lettered shapes, so scoping was one question.
**Helped:** the item's shape list and the tracked score tool; the baseline reproduced at 2,423/2,438.
**Missing:** it did not say the HANDOFFS.md header line (23) had already lost its tail. **Wrong:** none found.
**ROI: high** (about ten minutes to a claimed task).

## Session 285 Self-Assessment

**Score: 8/10.**
**Went right.** I rendered 17 probes in both modes before writing a test. RED was shown for the empty-chunk row and for the
four external-code rows against a naive rule, and a mutant of the no-code test was killed by 4 rows. I rendered the
exclusions and found `child=` was silent, so I disclosed it instead of pinning a false reason. Score unchanged 2,423/2,438.
**Went wrong.** (1) The exclusion list was a guess until rendered. (2) Nine rows are pins that went green with the first
row, disclosed in the test. (3) Ultracode was on and I ran no workflow or adversarial pass; the change is one predicate over
rendered shapes, but that was my call. (4) No `test:integration` run (needs the screen; no host behaviour changed).
**TDD:** RED shown before GREEN. **Cost:** no subagents; 3,208 tests passing; types clean.
