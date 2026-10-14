# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 305 (IN PROGRESS): a `sec-`/`eq-` (and `lst-`) label on a code cell is defined by the label index; quarto defines none of them from a kernel cell (BACKLOG label-index item, family (7)).**
Operator chose it at Phase 0. Ground first, per language and engine (handler cells differ), then strict TDD. Scope is that guard; the rest of the item stays filed.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl`.
(2) `scratchpad/s304/` (untracked) holds the harness: `render304.sh` (3 wide, load gate), `score304.cjs`, `build.sh`, `mkfixture304.cjs`, `corpusdiff304.cjs`, `mutate304.py`.
(3) Put "do not read installed quarto, knitr, xfun, rmarkdown or pandoc source" in EVERY agent prompt (Learnings 700, 709); agents author documents only, the caller renders.
(4) A render can hang (pandoc at 100% CPU on a 300 KB single line): kill by hand. (5) `test:integration` takes the screen: ask first.
(6) `BACKLOG.md`, `HANDOFFS.md` and `CHANGELOG.md` are past the 262,144 B read refusal: read in slices.
(7) `refs.test.ts` 1818 pins mermaid cells as defining `lst-` and `tbl-` (rendered): the rule is per language, not a blanket. Fixtures are quarto 1.7.33.

### What Session 305 Did
**Deliverable:** `sec-`/`eq-`/`lst-` labels on code cells, in the cross-reference label index (IN PROGRESS)
**Started:** 2026-10-14
**Status:** Session claimed. Work beginning. Phase 0 found both ledger frontiers at HEAD (nothing to reconcile).
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

## Session 303 Handoff Evaluation (by Session 304)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its pointer to family (1)(i), its probe names (`scratchpad/s303/hdr*`, `hunt/`, `gen*.py`, `mutate303.py`) and gotchas 1, 3 and 6 all held
at HEAD; Phase 0 found both ledger frontiers at HEAD and the ratchet citation matched the stored results.
**Helped:** the item's reproduction (a15, k01 settled the claim in one render each); the grid and fixture design as the model for mine; gotcha 3 (agents read GPL source) and the mutation harness
as the model for `mutate304.py`; the standing `realdoc-score` command (2423 of 2438, unchanged).
**Missing:** that `BACKLOG.md`, `HANDOFFS.md` and `CHANGELOG.md` are each past the 262,144 B read refusal (Phase 0 read nothing until I sliced them); that "decidable with `knitrOptionResolvesFalse`" is unsafe in the
removal direction (it accepts `F` and logical expressions; my first cut used it and a hunt found 55 regressions).
**Wrong:** the estimate "one small slice through `knitrOptionResolvesFalse`": it took seven commits, 29 agents and four mutation runs, because the cost of a REMOVAL rule is its false positives, not its reader. **ROI: high.**

## Session 304 Self-Assessment

**Score: 8/10.**
**Went right.** Ground first and attack white-box: about 2,100 documents rendered by me (3 wide) in a 359-document blind round, three white-box rounds (55, then 121, then 97 regressions found against successive
revisions, each fixed or the rule dropped), and a closed-world fixture of 1,611 rendered documents (949 quarto-defined): the index agrees on 1,233 where the parent agreed on 934, 346 declined phantoms, 0 worse than the parent.
Deleting rules paid more than adding them: `fig.show`/`fig.keep`, all document-level defaults, `F` and logical expressions are no longer read. Corpus differential over 3,382 authored documents: 0 differ, 1,368 labels before and after;
`realdoc-score` unchanged (2423 of 2438). Mutation, 4 runs (52, 76, 138, 133 mutants): the last survivor was killed by one added row, so 133 of 133. Host: RED 558 passing + 1 failing (the new row, for the right reason), GREEN 559.
Unit tests 5,572 to 7,608; `check-types`, `check-backlog`, `check-package` and `npm run package` (exit 0, 44 files, 1.85 MB) clean. Nine learnings (701-709) record what the rounds taught.
**Went wrong.** (1) My first implementation read defaults, `F` and `fig.show` and had 55 regressions after the first checkpoint; it was never released, but the checkpoint commits carry it. (2) Round-1 reviewer prompts lacked the
no-GPL-source rule and a reviewer read quarto's installed scripts (Learning 700 again; the claim was re-rendered by me, nothing from the source is tracked; memory and Learning 709 saved). (3) Three tests were vacuous (a Jupyter
`eval: false`-only body, an out-of-scope `jbody`, `{#tbl-x$}` also indexed by Source 3), found by mutation, not by me. (4) One needless `git stash`/`pop`. (5) Three robustness documents hung pandoc for 50 minutes before I looked.
(6) Reasoned, not measured: the Outline `ref-label` alias (filed as such). **Known residuals (filed):** project-level `keep-hidden`/engines, obfuscated option names, 346 declined phantoms, and three pre-existing slow inputs
(resolver on 100k spaces 18.9 s; 300k backticks 52 s, 58 s here; a 5 MB backtick line overflows the stack).
**TDD:** RED before GREEN for each behaviour. Groups that passed on arrival, disclosed: pipe forms, look-alike controls, one row per guard word, direct whitelist rows, and the closed-world rows after each rule (each guard was shown RED against a mutant).
**Cost:** 29 agents (about 6.6M subagent tokens, none rendered), about 2,100 renders by me, 4 mutation runs, two host runs of about 2 minutes (operator-approved), `npm run package` at close-out.

## Session 302 Handoff Evaluation (by Session 303)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, keep list and costs held: `scratchpad/s301/` (hunt, probes, `score301.cjs`, `corpusdiff.cjs`, `render301.sh`) was intact and
I reused every tool in it; the dashboard took about a minute and `npm run package` 1:07; my Phase 0 found `CHANGELOG.md` current and `HANDOFFS.md` four commits behind (below).
**Helped:** gotcha 1 (never `git add -A`) and the stage-history-files-by-exact-path habit; the corpus-reach number for the item I took (54 cells in 8 documents, reproduced exactly by `reach.cjs` and by the differential);
the standing `realdoc-score` command (unchanged, 2423 of 2438).
**Missing:** that the layout migration would land four commits (sync, the `CLAUDE.md` pointer, the `PROJECT_LEARNINGS.md` move, the exclude-line removal) from the methodology repository's session with no receipt here, so my
Phase 0 reconciled one (`64af9364`); and that the item's evidence for the header spellings (`langs/r05`) is not under `scratchpad/s301/probes` (there is no `langs/`), so I rendered from nothing.
**Wrong:** nothing material; "remove the exclude line after the migration" was already done by then (stale, harmless). **ROI: high.**

## Session 303 Self-Assessment

**Score: 8/10.**
**Went right.** I grounded first and kept grounding: 779 documents rendered by me (3 wide, behind the load gate) in 7 rounds plus a 200-document hunt, so each rule has a probe behind it. A 352-document slot grid found the real
empty-slot rule; a 245-row fixture pins the reader to quarto's own verdicts (no phantom, no loss except 4 declined rows). RED was shown before GREEN for each behaviour; the host row was RED (557 passing, 1 failing) then
GREEN (558). Corpus differential: 54 labels added in exactly the 8 documents, 0 removed; `realdoc-score` unchanged. Mutation on the committed code: 60 of 61 killed, the survivor equivalent. 7 read-only agents (4 authors, 3 reviewers,
about 1.40M subagent tokens, none rendered); every finding was re-measured by me before a rule changed. Unit tests 5,155 to 5,572; `compile`, `check-types`, `check-backlog`, `check-package` and `npm run package` (exit 0, 1:07, 44 files) clean.
**Went wrong.** (1) My first commit (`36198c76`) shipped a reader whose empty-slot, `label`-prefix and bare-token rules the grid and the hunt then showed wrong, two of them phantoms; fixed in `367f0e8c` the same session, never released.
(2) I did not model "the chunk makes no figure": 26 rows of the final score are new phantoms of that family and the container family; filed with probe names, none in the 54 corpus cells. (3) Two bugs in my own tests (a default argument
swallowed `undefined`; the RED run with a mutated provider failed my own type-check first). (4) I ran `sed -i.bak` on Session 301's shared render script by mistake and restored it from the backup at once. (5) About ten long stretches
with no status line drew harness nudges, the lesson Session 302 recorded. (6) The hunters read the installed knitr and xfun (GPL) source to explain what they authored; nothing from it is in a tracked file (Learning 700).
**TDD:** RED before GREEN for every behaviour. Rows that passed on arrival (first-slot shapes the first cut already handled, pins, controls, fixture rows after each rule) were noted as they ran but not counted, so there
is no number here; each guard was shown RED against a mutant. **Cost:** 7 agents, about 780 renders by me (the 1-minute load reached 98 once, system processes dominate it), two host runs of about 2 minutes each (the operator allowed them).
## Session 301 Handoff Evaluation (by Session 302)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt named the directive, the keep list and the costs, and they held: `tools/realdoc-score/run.sh` scored 2423 of 2438
from `s265` and `s251/realfiles.txt` alone (sha256-identical intermediates before and after the trim), `s299/ratchet_long.py` is intact, and my Phase 0 found no ledger or receipt gap (both frontiers at HEAD).
**Helped:** the keep list and "the corpus is personal" warning; gotchas 1 (never `git add -A`), 8 (stage history files by exact path) and 4 (the commit order that keeps `ledger-lag` at 0); the memory
`project-trim-scratchpad-next-session`, whose "check tracked citations first" led to the numbers the operator chose with (2,038 mentions orphaned by the directive, 647 by the path taken).
**Missing:** that five `posit-observation.txt` files (three of them inside folders a size cut deletes) are the only record of the black-box observations behind five DECIDED Outline questions, so a keep-three
list would have deleted them; that the cost driver is 1,561,390 files and not 65.6 GiB (665,653 of them in `s291`); and that the operator planned a layout migration whose dirt test counts every untracked file.
**Wrong:** nothing material ("261 entries" was 263). **ROI: high.**

## Session 302 Self-Assessment

**Score: 7/10.**
**Went right.** I measured before proposing: sizes (65.6 GiB, 263 entries), file counts per entry (11 s), tracked citations per folder, and what tracked code reads from `scratchpad/` (only `realdoc-score` and a `mkdir -p` output
path). A `find` for evidence-named files found the Posit records the keep list missed. The delete was by rename into a quarantine, verified (score 2423 of 2438 and `model.tsv`/`rawadj.tsv` sha256-identical before and after,
the three kept files' sha256), and only then removed (159 s). `migrate-layout`'s own dirt test returns nothing. Dashboard 4:45 to 1:12; `npm run compile` exit 0; `npm test` 5,155 passing (unchanged).
**Went wrong.** (1) I told the operator the `s266` folder and all five Posit files survive a 50 MB cut; `du` said `s266` and three of the five do not. They asked, I re-derived, I corrected it before anything moved.
(2) My first pick list held four questions with an option that only made sense under one answer; the operator answered one and asked to clarify. (3) I answered "explain 1" about the wrong pick list, twice.
(4) My first before/after comparison (`sed 1,0d`) reported a difference that was my own bug. (5) The first dashboard run overran a tool call and drew a "have not heard from you" nudge. (6) The CLAUDE.md stale example (2419) is noted, not fixed.
**TDD:** not applicable (no logic changed; the gate exempts it). Verification was the byte-identical standing measure above, not a unit test. No `src/`, `test/` or `package.json` file changed, so no host run.
**Cost:** 0 agents. Ultracode defaults to a workflow, but this was one writer doing a destructive, mechanical step and every read was a command I could run myself; the price is no independent reviewer of the delete list.
