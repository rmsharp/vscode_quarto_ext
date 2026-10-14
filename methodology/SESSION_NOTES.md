# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 306 closed out.** The Outline's knitr silence rule now reads a dashed `#| ref-label:` pipe as `ref.label`. `BACKLOG.md` "Active" is empty; present ranked candidates via AskUserQuestion at Phase 0.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in the close-out commit).
(2) `scratchpad/s306/` (untracked) holds this session's harness: `gen306.py`, `gen306b.py` (grids), `BRIEF306.md`, `diff306.py <head.cjs> <fix.cjs> <dirs>` (quarto vs two builds), `twinall306.py prep|check`, `mutate306.py`, `build.sh <label>`, lens dirs with renders.
(3) `scratchpad/s304/render304.sh <ABSOLUTE lensdir> [width]` renders 3 wide behind a load gate from a `manifest.json` (engine `r` executes, anything else is `--no-execute`). A relative path failed here after a `cd`. In zsh pass dir lists as an ARRAY.
(4) Put "do not read installed quarto, knitr, xfun, rmarkdown or pandoc source" in EVERY agent prompt (Learnings 700, 709). Audit transcripts by parsing `tool_use` inputs: a grep over the whole file also matches the prompt prose.
(5) `test:integration` takes the screen: ask first. `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` are past the 262,144 B read refusal: read them in slices.
(6) Baseline `npm test` at HEAD is 8,151 passing in 72 files. Next candidates: the new BACKLOG Outline item (its family (3) deletes headings and is about one `codeFromElsewhere` conjunct) or label-index families (2) to (10).

## Session 305 Handoff Evaluation (by Session 306)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1, 3, 4, 6, 7 and 8, its harness paths (`render304.sh`, `build.sh`) and its `key_files` lines (`refs.ts:402`, `:422-430`, the 239-line
`refs-cell-kinds.test.ts`) all held at HEAD; Phase 0 found both ledger frontiers at HEAD and the ratchet citation matched the stored results.
**Helped:** `render304.sh`, reused unchanged (18 renders in 13 s); the standing `realdoc-score` command (5 s, unchanged at 2,423 of 2,438); gotcha 7 (three files past the read refusal: I read them in slices at once); gotcha 2 (the no-source rule,
audited clean again); the BACKLOG item Session 304 filed, which named the function, the render to make and the one-expression fix.
**Missing:** a pointer to `tools/realdoc-score/extract_headings.py` as the way to read quarto's headings back from rendered HTML (I found it through the README); and that a grep over an agent transcript for third-party paths matches the
prompt prose, so every agent looks guilty until the `tool_use` inputs are parsed.
**Wrong:** the unit total. The receipt gives `npm test` 7,739 passing as final, and a clean HEAD worktree runs 8,115 (the number was taken before the last two test commits, `59e9a508` and `e9885724`). Small. **ROI: high.**

## Session 306 Self-Assessment

**Score: 8/10.**
**Went right.** I measured before changing code: two grids (36 documents, both modes), predictions frozen first, and every one held; the dashed alias deleted a heading in 9 shapes at HEAD. The fix is one expression, the sibling's. What took the
work was pricing it: one workflow (4 blind lenses and 2 read-only reviewers, 6 agents, about 640k subagent tokens, none rendered, transcripts audited clean) plus about 540 renders by me (3 wide) scored 189 fixed, 55 regressed, 35 wrong both
before and after, 159 right both before and after, 30 unrenderable rows, over 234 documents in both modes (468 rows). The dotted-twin test classified all 55 regressions in one step (twin-equal 55 of 55), so the fix is the sibling's behaviour, not a new defect.
Real-document score unchanged (2,423 of 2,438), corpus reach 0 of 3,383, mutation 9 of 9 non-equivalent mutants killed (M5 equivalent), unit 8,115 to 8,151, `npm run package` exit 0 (44 files, 1.85 MB, 1:19). Learning 714.
**Went wrong.** (1) My first test comments overclaimed, and the test critic caught it: "each guard shown RED against a mutant" was false for three controls, two "RESIDUAL" rows pinned a regression the fix introduced (right before, wrong now), and
(T)/(P) were defined only in a script. (2) The brief I wrote said the residual held "for BOTH spellings", false for the dashed one at HEAD. (3) Three commands failed on a relative path or a changed working directory, and one malformed mutant
(M11) broke the build. (4) The first transcript audit matched every agent because it searched the prompt text. (5) About five long stretches drew "have not heard from you" nudges, the lesson Session 302 recorded.
**Known residuals (filed):** the BACKLOG item with 3 families: a label that supplies no code, a default that hides it, and channels the rule never reads (the LOST direction).
**TDD:** RED before GREEN for the first row (`g03`, `After` deleted); the other 35 rows passed on arrival (disclosed), each guard then shown against a mutant: dropping the alias turns 21 of the 36 RED, and the other 15 are controls or dotted residuals by design.
**Host:** `test:integration` NOT run (needs the screen; core-only change, as Sessions 294 to 298). **Cost:** 6 agents, about 540 renders, one mutation pass, `npm run package` 1:19.

## Session 304 Handoff Evaluation (by Session 305)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its harness names (`render304.sh`, `score304.cjs`, `build.sh`, `mkfixture304.cjs`, `corpusdiff304.cjs`, `mutate304.py`), gotchas 1 and 2 and the
`cellTargetContext` pointer (`model.ts:7320`) all held at HEAD; Phase 0 found both ledger frontiers at HEAD and the ratchet citation matched the stored results.
**Helped:** the harness, reused nearly unchanged (two sed-cloned scripts); `cellTargetContext`, which the final rule reuses whole; gotcha 6 (Jupyter `eval: false` alone keeps the label), which pointed at the per-engine facts; the BACKLOG item's
"(7) `sec-`/`eq-`" row (k32, k33), which named the probes to start from.
**Missing:** that Learning 703 (guard the channel, not the string) is the starting point for any removal rule: I designed a text-anchor exemption first and a white-box round proved it wrong; and that two of the item's own claims
were over-general: "(7b) a `#| label: lst-x` on a cell is a phantom" is true under knitr only, and "the cheapest first is (7)'s `sec-`/`eq-` kinds (one guard)" took six commits and two workflows.
**Wrong:** the `lst-` scope above, and `refs.ts` line numbers off by about 15 (`writtenElsewhere` at 382, not 367): small. **ROI: high.**

## Session 305 Self-Assessment

**Score: 8/10.**
**Went right.** I grounded before code: a 78-document grid (kind x cell language x engine) with predictions frozen first; two were wrong (`lst-` under Jupyter and markdown), which stopped a blanket "cells define figures and tables only" that a pinned
mermaid test already contradicted. Two workflows (11 agents, about 1.6M subagent tokens, none rendered, transcripts audited clean for third-party source reads): 297 blind documents, then 150 white-box documents and three read-only reviewers; I
rendered about 550 documents (3 wide) and re-checked every reviewer claim against the HTML. The white-box round found 34 documents where my first rule lost a label quarto defines; the final rule (Session 304's channel test over the whole
document) is simpler, deletes the shared anchor reader, and scores 518 agreements against the parent's 329 on 686 rendered rows (phantoms 329 to 138, lost 28 to 30: two heading gaps the label used to hide). Corpus differential 0 of 3,382.
Mutation: 58 mutants, 56 killed, the two survivors equivalent (caching only); the first run's three survivors led to four rendered documents that prove the two legs needed. Host RED (559 passing, 1 failing, the new row) then GREEN (560); unit 7,739;
`npm run package` exit 0, 44 files, 1.85 MB. Learnings 710-713.
**Went wrong.** (1) I did not grep the learnings before designing the exemption, so Learning 703 was rediscovered at the cost of a round and two commits (`def7cff3`, `d8cc5d15` carry the weaker rules and the shared reader, never released).
(2) My first control rows pinned phantoms as defined (r and python under `engine: markdown`, a `lst-` row citing a Jupyter document for the markdown engine): a reviewer found them, not I. (3) A vacuous position row (passes whatever the guard does).
(4) The first host RED attempt failed at the type-check (nothing ran, no screen takeover). (5) About five long waits drew "have not heard from you" nudges. (6) Two wrong numbers in a first draft of a learning and a comment, caught on re-read.
**Known residuals (filed):** the kept phantoms where a channel exists, the heading gaps (li18, wl50), `lst-` under knitr, `engine: markdown` and Jupyter `echo: false`, a pre-existing `RangeError` in the anchor reader.
**TDD:** RED before GREEN for the guard (`sec`, then `eq`), the channel rule and the no-channel rows; the two anchor-text commits were RED first too and later retired. Passed on arrival, disclosed: the 70-row language x engine grid, the control rows,
the residual pins, the unseen-code rows (each guard then shown against a mutant) and the 367 fixture rows. **Cost:** 11 agents, about 550 renders by me, two mutation runs, two operator-approved host runs of about 2 minutes, `npm run package` 1:17.

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
