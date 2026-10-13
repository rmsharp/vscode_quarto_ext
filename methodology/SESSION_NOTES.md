# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** NONE -- Session 302 closed out. `scratchpad/` is trimmed (31 heavy entries gone) and `git status` is clean, ready for the operator's layout migration (its own session).
**Next:** (1) The migration: `bin/migrate-layout` is in `../methodology/bin/`; its dirt test (`git status --porcelain=v1 -z --untracked-files=all`) returns nothing now. (2) Then pick from `BACKLOG.md` "Up Next" (Active is empty).
**⚠ Gotchas:** (1) never `git add -A`. (2) `.git/info/exclude` now holds `scratchpad/` (THIS clone only), so `?? scratchpad/` no longer shows: remove the line after the migration if the signal is wanted back (Session 174 decision).
(3) `scratchpad/` now: 235 entries, 101,867 files, 1.93 GB. Kept: `s251` and `s265` whole, `s299`, `s301`, `s270`, `s273`, the `posit-observation.txt` of `s271`, `s272` and `s277`, and about 225 small entries.
(4) Tracked docs and comments cite the 31 deleted folders (647 mentions, 71 in `BACKLOG.md`): re-measure a witness before trusting a cited path. (5) The dashboard now takes about 1:12 (was 4:45) and `npm run package` 1:04.5 (was 15-20 min).
(6) `realdoc-score` now reads `agree 2423 of 2438 (99.38%)`; the 2419 in `CLAUDE.md` and `tools/realdoc-score/README.md` is a stale example (not fixed here).

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

## Session 300 Handoff Evaluation (by Session 301)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt said `BACKLOG.md` "Active" was empty and listed the open items; the `key_files` line numbers I
checked were exact at HEAD (`LANG_COMMENT_CHARS` 10627, the row 10635, `commentCharsFor` 10656, `cellOptionDirectiveFor` 10710, `findCellOptionLines` 10772, `CELL_HANDLER_LANGUAGES` 1012;
`refs.ts:130` was 129); the ratchet citation (2/2, `bba236856bad`, manifest `334939914945`) matched the stored results, and my Phase 0 found no ledger or receipt gap (both frontiers at HEAD).
**Helped:** the item's reproduction and its "ground first" instruction (one render settled the claim before any code), the fixture and the closed-world pins as the model for mine, `mutate300.py`
as the model for my harness, and gotchas 3 (count a kill only on "Tests N failed"), 4 (the commit order that keeps `ledger-lag` at 0), 6 (the host run takes the screen: ask) and 9 (stage history files by exact path).
**Missing:** that the item overlaps two older ones (the S160 second-scanner item and the prefix-consolidation item) and that the root fix is a cross-module change needing the operator's approval (it
cost the first hour); and that the old scan's `^\s*` was load-bearing: the consolidation item called indented options "non-idiomatic", and a real corpus document (ordinal 1887) has three labels in
an indented list-item cell. **Wrong:** nothing I could find (the item's "either" understated the choice). **ROI: high.**

## Session 301 Self-Assessment

**Score: 8/10.**
**Went right.** I grounded first: quarto 1.7.33 rendered about 110 probe documents (mermaid, dot, ojs, python under jupyter, R under knitr with execution) before a line of code moved, and the operator
approved the cross-module scope on those measurements (use the shared option scanner; it closes this item and two older ones). RED was shown before GREEN for each behaviour (the witness, the quoted
key, the indented cell, the nested key, the handler fence); the refactor (`cellOptionLinesOf`) is its own commit (`git diff -w`: 12 lines); 73 of the first 107 rows fail against the parent build. A
differential of the old and new builds over the 3,382 authored documents found what the unit suite could not: three labels of a list-item cell removed (ordinal 1887); after the fix, 0 removed and 46
added (all `{mermaid}` `%%|`). A 174-document hunt (4 authoring agents, 2 read-only reviewers, rendered by me 3 wide) scored against quarto and the parent: agreement 242 to 335 of 425; it found two
regressions the change itself introduced for mermaid (a handler fence indented at all, a nested `label`), both fixed with a RED row. The reviewers' findings are closed (the all-or-nothing-strip mutant,
tabs, CRLF, case and quote keys, two false comments, a mislabelled row). 27 mutants: 24 killed, 3 equivalent. Host run: 557 passing. Tests 5,023 to 5,155; type checks, `check-backlog`, the oracle clean.
**Went wrong.** (1) My first GREEN dropped real labels: I had read "indented options are non-idiomatic" and still routed through the column-0 scanner; only my own corpus differential caught it. (2) I
named a corpus document (R4DS) in two tracked files and in a commit message (`ea01ed5d`), against Learning #548; the test critic found it, the files are fixed, the message stays. (3) A row titled
"RESIDUAL (pre-existing)" pinned a phantom my change introduced (found by review; the handler rule fixed it). (4) An `echo: false` control under `--no-execute` nearly recorded a false rule. (5) Two
comments lost a `\u0065` escape on save (Learning #692). (6) The engine-dependent residuals (python blank-first lost, knitr spacing phantom, format-conditional divs) are filed, not fixed; one is a
regression against the parent, with corpus reach 0. (7) Three backlog items in one session (operator-approved). (8) No host RED. (9) The dashboard took 4:45 and drew a complaint; the 15-minute load
reached 114 while the workflow ran. (10) The corpus score was not re-run (no `findHeadings` change).
**TDD:** RED shown before GREEN for every behaviour; 34 of the first 107 rows and most of the later guard rows passed on arrival (controls, shapes the parent got right by accident, closed-world table
rows for `#` and `//` languages), disclosed; each guard was shown RED against a mutant.
**Cost:** 6 agents (about 1.07M subagent tokens, none rendered), about 330 renders by me at 3 wide behind the load gate, 28 mutant runs, one host run of about 2 minutes, `npm run package` at close-out.

## Session 299 Handoff Evaluation (by Session 300)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt said `BACKLOG.md` "Active" was empty and listed the open items; the `key_files` line numbers I
checked were exact at the commit it closed on (`LANG_COMMENT_CHARS` 10621, `commentCharsFor` 10650, `findCellOptionLines` 10766, `NOT_MODELLED` 45, `expectedOptionLine` 65); the ratchet
citation (2/2, `bba236856bad`, manifest `334939914945`) matched the stored results, and my Phase 0 found no ledger or receipt gap (both frontiers at HEAD).
**Helped:** the item's recipe (add the row, drop `mermaid` from `NOT_MODELLED`, run the oracle, ground completion in the host first), the 47-row fixture and the oracle file (the run was
instant, and its `{mermaid}` row became a live guard), `mutate299.py` as the model for my harness, and gotchas 3 (count a kill only on "Tests N failed"), 4 (commit order), 6 (the pin goes
red until the row is added: it did, for the right reason) and 7 (stage the history files by exact path).
**Missing:** that adding the row empties every control written with `#|` (the largest cost of this session); that a row-by-row pin proves presence and not the closed world (an extra row
survived it); and that its virtual-doc claim ("bail BEFORE it consults the option lines", inherited from S162) holds for one path in four.
**Wrong:** "a one-word edit of NOT_MODELLED" understated the change (the set, its pin and a per-row test went); nothing else I could find. **ROI: high.**

## Session 300 Self-Assessment

**Score: 8/10.**
**Went right.** I mapped every consumer before coding (one caller of `commentCharsFor`, three modules reading `findCellOptionLines`) and showed RED before GREEN for the row (with the absence pin
flipped, exactly the two `mermaid` rows failed). By grep, before any review, I found that three controls would go vacuous, and measured it: with the row present and the guard removed, the old
`yaml-value-flags.test.ts` passed 75 of 75, and the oracle gave 4 cardinal false positives (3 without the row). 13 mutants killed; one host run, 556 passing; the bundle is byte-identical across
the review fixes; the oracle tally matches the pre-session build. The adversarial review (4 lenses, 20 agents) found no production defect but 6 weak-test reports and 5 stale-prose findings; I
fixed them, and the 7 replayed mutants that survived the first cut are killed now. Tests 4,982 to 5,023; type checks, `check-backlog` and the oracle clean.
**Went wrong.** (1) Three gaps in my own new tests, found by the review and not by me: the mermaid emission test had nothing after its comment line, so it could not show the block ends; the
duplicate flags controls asserted no precondition; `%` versus `%%` was unpinned. (2) I copied S162's "bail before consulting" mechanism into three new comments without reading `virtual-doc.ts`,
and left a present-tense "has no `mermaid` row" sentence in `yaml-context.ts`. (3) A first draft of a pin asserted two options I had not measured (`eval`, `fig-align`) and a fixture line that
could not discriminate; both were removed before commit. (4) The review ran 20 agents against a 10-agent guideline, and two skeptics shared a scratch directory name (no harm; Learning #687).
(5) `test:integration` ran once, on the finished code, so the host tests have no host RED (the operator's choice; the unit RED and the mutants stand in). (6) The corpus score was not re-run
(no `findHeadings` change). (7) Several long runs went by without a status line and drew nudges. (8) A zsh glob (`--include=*.ts`) aborted my first grep.
**TDD:** RED shown before GREEN for the row. The consumer pins (emission, completion, the flags precondition) passed on arrival, disclosed; each was shown RED on a seeded fault (row deleted: 6
failing; guard removed: 4). The review-fix tests were written after each reviewer mutant was reproduced and fail on it.
**Cost:** 20 review agents (about 2.0M subagent tokens), no quarto render at all (the oracle cache was warm), one host run of about 2 minutes, no screen-taking run beyond it.
