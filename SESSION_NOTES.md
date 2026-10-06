# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 292 (IN PROGRESS, claimed 2026-10-05): the three callout-title shapes the direct-child rule still gets wrong (div lifetime, reader-dependent lazy continuation, the tabset rule's own holes; all DELETE).**
**#1 NEXT:** finish the claimed item. Still open after it: the AST first-block item, R6 residuals (e)-(g), the empty `---` pair.
**⚠ Gotchas:** (1) never `git add -A`; `scratchpad/s290/corpus` holds COPIES of personal corpus documents. (2) reuse `scratchpad/s291/{twin,cmp,monotone,diffscan}.cjs`. (3) agents can leave stray files at the repo root: check `git status`.

### What Session 292 Did
**Deliverable:** fix the callout-title deletions left by the direct-child rule: div lifetime, reader-dependent lazy continuation, the tabset rule's own holes (IN PROGRESS)
**Started:** 2026-10-05
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest.

## Session 290 Handoff Evaluation (by Session 291)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK named the item and the BACKLOG
item carried the S260 probe paths, so I had a verified defect (g02) within ten minutes; the ratchet citation matched a fresh run.
**Helped:** the ranked list, `render2.sh` and `xbuild.cjs` (I reused its omitted-multiset test), the corpus-copies warning.
**Missing:** nothing needed. **Wrong:** the BACKLOG item's causal claim: it blamed the callout rule for a list-item deletion that is
the marker-line ATX gap (a plain-div twin is wrong too), and its fix hypothesis (the tabset rule's `inQuote`/`containerDepth`
terms) regressed 111 probes; it did label that a hypothesis, not a measurement. **ROI: high.**

## Session 291 Self-Assessment

**Score: 8/10.**
**Went right.** I rendered the S260 probes beside plain-div twins and split the item before any fan-out (the list half was a
different defect). Workflow 1 (10 agents, ~8,000 probes) and workflow 2 (4 adversaries, ~14,000) were re-classified mechanically,
not read. TDD: RED shown for each of 14 slices; every term killed by a mutant. The change is monotone, proved oracle-free over
196,156 documents (0 headings dropped); corpus 0 of 3,383 moved; score unchanged 2,423/2,438; 3,634 tests, types clean.
**Went wrong.** (1) My first cut copied the tabset rule's `inQuote`+`containerDepth` terms and committed it; the mutation run had
shown both unpinned, and 111 HEAD-right probes became phantoms until a measuring lens found them. (2) I moved a shared
`firstContentLine` for the empty-quote rule without grepping its other reader, which broke tabsets; only an adversary found it.
(3) Shell slips: a zsh glob aborted a chain and ran the system `w`; an agent left a stray `quote` file at the repo root (removed).
(4) 158 + 17 right-to-phantom probes remain, all pre-existing defects un-masked; disclosed. (5) No `test:integration` run (needs
the screen; core-only change). (6) `quality_ratchet` reads `ledger-lag` 4 until this close-out commit lands.
**TDD:** RED shown before GREEN. **Cost:** 14 agents (~3.6M tokens), about five hours of renders; no screen-taking run.

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
