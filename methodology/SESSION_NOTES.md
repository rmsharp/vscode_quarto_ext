# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 342 closed out.** g02's twenty-sixth session is done: parts (2) to (5) of the BACKLOG item "What Session 341's review round found beside the Outline and preview cures" left the item (part
(1), a QUESTION for you, and the records (6) and (7) stay; numbering kept): `createYamlRegionLookup`, `createRangeLookup`, a 150 ms trailing debounce (`src/core/typing-debounce.ts`) and `createCellVdocBuilder(text,
engine, mode)`. Three cure workers, a six-lens review round (`wf_e3b87390-7d5`, 72 agents) and a two-worker fix round (`wf_e641a092-f9c`); `test:integration` run with your go-ahead: 562 passing. `BACKLOG.md`
"Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**⚠ Two things that are not what the item promised.** (A) The debounce cures BURSTS (a held key, a paste, a replace-all), not steady typing: at gaps of 150 ms or more every keystroke still pays one cold scan (1
evaluation per 1,000 keystrokes below 150 ms, 1,000 at 150 ms or more; the rows' keystrokes are 10 ms apart). The 150 ms is my choice, and `quarto.inCodeCell` can lag an edit by up to 150 ms; the new item's part (1)
is the question. (B) Part (5) is a CORRECTNESS change and not a speed one: `resolveDocumentEngine` has already cached the engine-blind scan in the real flow (2.53 against 2.50 ms at 2,000 cells; only a text that
begins with whitespace saved time). The Outline's in-cell children now come from the symbol's OWN cell where the blind lookup found none or another one; 3 of 3,383 corpus documents are affected, all knitr.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows three and a catch-all): (a) the NEW Up Next item "What
Session 342's review round found beside the typing-path cures": part (1) is a QUESTION for you (leave steady typing alone, a longer delay, or a cached or incremental scan), parts (2) to (4) are small (estimate one
session together), (5) needs a host, (6) is the R6 (g) wiring change; (b) what stays of the Session 341 item (part (1), the vdoc's trailing newlines, a question; records (6), (7)); (c) the Up Next item "The knitr
silent-chunk reader copies the whole map of assigned names for every `echo=FALSE` R chunk" (estimate one session); (d) "Nothing in the repository notices a twelfth class-plus under the `u` flag or a twelfth call
with a spread argument"; (e) the S322 item's part (1), the S311 item's parts (4), (10), (11), the Session 333 and 334 items. Polish: the S339 item's part (4), "`npm test` exits 1 with every test green", "Residuals
of Session 338's eleven cures". Time the literal shape THROUGH THE ADAPTER'S WHOLE CALL SEQUENCE at HEAD first (Learnings 840, 916). After those, the terminal bounded session files ONE RESIDUAL record, owns the
sweep's unrun 68% (rule P5) and stops. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a
close-out commit).
(2) No harness of this session is in the repo except the Python recounts (`tools/*-count`) and the oracle files. Rebuild (Learning 848): `git archive <sha> src | tar -x`, a `node_modules` symlink, esbuild on the
entry; one fresh process per probe; the region scan memoises on the exact text, so vary the text per timed call. A worker's worktree starts BEHIND HEAD (all five did): reset it to the named sha first (Learning 891).
(3) SHELL (zsh): an unmatched glob is an error, `echo =====` is not found, `set -- $var` does NOT split (put a loop with arguments in a `bash script.sh`), a shell-variable `rm -rf` is refused (use `git worktree
remove`), a leading `sleep` is blocked. I hit three of these again this session. The Write and Edit tools drop a trailing space (Learning 778): edit with a Python replace and assert the count.
(4) The mutation runner tests the COMMITTED source: commit first, use each list's README row for its `--tests` set and `--cmd 'npx vitest run --bail 1 --maxWorkers=2'`, run ONE list at a time, in a scratch worktree
(`git worktree add --detach <scratchpad>/mut master` plus a `node_modules` symlink) so the main tree stays free. This session's six lists: 59 / 6, 98 / 1, 27 / 2, 36 / 0, 69 / 0, 37 / 1 killed / surviving.
`mutation-lists-apply` is 95 tests and goes red when a refactor moves a quoted line, OLDER lists included (Learning 918).
(5) Pins: Learnings 907 to 915 as before; new: 916 time through the caller's whole sequence, 917 a trailing debounce cures bursts (write the keystroke gap beside the figure), 918 a refactor breaks older lists, 919 a
clock baseline is the model's own residue, 920 an extraction can make a guarded read eager.
(6) BASELINE `npm test`: 195 files and 17,774 tests pass, `Errors 1 error` (`Timeout calling "onTaskUpdate"`) and EXIT CODE 1 (Learning 892; 183 files and 17,202 tests at Session 341's end). `npm test` drives the
one-minute load to about 60: wait before a list run. A new test file must run under 25 s alone; `s342-yaml-region-rows.test.ts` peaks at 712 to 720 MB resident.
(7) The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is still not mine: ask before removing it. This session's six worktrees and branches were removed after `git cherry` showed all 47 worker commits on
master. (8) Residuals: the BACKLOG items (the Session 342 round's seven parts, what stays of the Session 341 round, the knitr copy, the standing guard, the Polish lists); survivors are argued in each list's `why`
and its README row.
(9) `test:integration` WAS run, with go-ahead (562 passing, 2 minutes on the screen); no integration row drives the debounce's document and selection wiring. `test:lsp` NOT run (needs your own Pylance). (10)
Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), unchanged.
(11) The plan: update its status column AND its in-flight, next-group and g02 order-table rows at each close-out (done: "twenty-six sessions done"). (12) `master` is NOT pushed: 95 commits ahead of `origin/master`
before the close-out commits; the dashboard copy is v2.22.0 against canonical v2.23.0 (not synced). (13) `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in
slices, edit with a Python script (`python3 -I -`). After answering a direct question, STOP and wait (memory).

### What Session 342 Did
**Deliverable:** g02 of the backlog ordering plan, twenty-sixth session: parts (2) to (5) of the BACKLOG item "What Session 341's review round found beside the Outline and preview cures, none of them in
its diff" -- the YAML-region lookup per cell option line, the per-line cell lookups of the completion and formatter edit checks, the two undebounced typing-path handlers and the engine-blind cell list --
DONE; claim `10e6b9c`
**Started:** 2026-11-05 (closed 2026-11-06)
**Status:** Closed out. Timed all four shapes at the parent in fresh processes; three workers in isolated worktrees, strict TDD with the seam first (RED re-run from my side at each rows commit: 6 of 33, 6
of 29, 19 of 37 and 57 of 96 fail); 31 commits cherry-picked, then eight mutation entries respelled that the cures' refactors had moved. A six-lens review round (72 agents): 33 findings, 37 confirmed, 25
partly and 4 refuted of 66 verdicts; I re-ran the two that change code (T03 and A01 survive every committed test) and re-measured part (5) through the real call sequence, which overturned the item's speed
claim for it. A two-worker fix round (16 commits): five debouncer rows, eight pin rows, `isInCodeCell` (39 rows), the builder and lookup rows, wording corrections; the rest filed as a new Up Next item.
Eight lists run alone: 59 / 6, 98 / 1, 27 / 2, 36 / 0, 69 / 0, 37 / 1, 67 / 2, 41 / 4 killed / surviving, 0 contradicted. `npm test` 17,774 passing in 195 files (exit 1 from the known worker timeout); `npm
run package` 44 files; real-document score unchanged (2423 of 2438); `test:integration` run with go-ahead, 562 passing. Learnings 916 to 920.
**Ledger:** `CHANGELOG.md` 2026-11-05 and 2026-11-06 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the fix round, the SESSION_NOTES trim and the
quality-gate run), recorded in the close-out commits.

### What Session 341 Did
**Deliverable:** g02 of the backlog ordering plan, twenty-fifth session: parts (2) and (3) of the BACKLOG item "Slow shapes and residuals found by Session 339's review round, none of them in its diff" -- the Outline provider
built a whole-document virtual document for every code cell, and `quarto preview` re-parsed the whole accumulated stderr on every chunk -- DONE; claim `c20f0e8`
**Started:** 2026-11-05 (closed 2026-11-05)
**Status:** Closed out. Timed both shapes at the parent in fresh processes (4,337 ms at 2,000 six-line cells; 1,350 ms at 4 MiB and 8.8 s at 12 MiB in 4,096-byte chunks); seam first (`00f85d4`, `d912bbf`), clock rows RED on
the clock alone (4 failed | 10 passed; 6 failed | 6 passed); the old spelling kept as the oracle beside enumerated and seeded differentials and Python recounts (9,949,916 enumerated pairs, 0 disagreements); cures `aa4e37d`
and `190bd49` (10.2 ms and 9 ms, byte-identical output); a five-lens review round (99 agents): one low defect (a fractional `startLine`), 47 findings, 46 standing; a fix round (two workers, 20 commits): D1 RED first (13 rows)
then cured, both clocks pinned, both call-site pins read from the syntax tree; four lists run alone (67 / 2, 41 / 4, 42 / 6, 23 / 1 killed / surviving, 0 contradicted). `npm test` 17,202 passing in 183 files (exit 1 from the
known worker timeout); `npm run package` 44 files; real-document score unchanged (2423 of 2438); `test:integration` run with go-ahead, 562 passing. Learnings 910 to 915.
**Ledger:** `CHANGELOG.md` 2026-11-05 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the fix round, the SESSION_NOTES trim and the quality-gate run), recorded in the
close-out commits.

### What Session 340 Did
**Deliverable:** g02 of the backlog ordering plan, twenty-fourth session: part (1) of the BACKLOG item "Slow shapes and residuals found by Session 339's review round, none of them in its diff" -- the raw-TeX probe copied the whole
environment stack on every `\end{` line -- DONE; claim `9238682`
**Started:** 2026-11-04 (closed 2026-11-04)
**Status:** Closed out. Timed the shapes at the parent in fresh processes (88.5 / 224.6 / 895.9 / 3,085.6 ms at 10k to 80k nested; 5,537.3 ms unmatched); RED first (11 of the 14 tests of the rows file fail on the clock alone, 33 of
35 of the oracle file fail "is not a function"); the cure `rawTexEndPops` (332 / 319 ms); 18 older mutants re-anchored; the old spelling kept as the oracle beside a definition and a Python recount (E1, E2, E3: 3,378,858 pairs, 0
disagreements); 24 mutants (19 killed, 5 equivalent); the review round (35 agents): 0 differences over 6.2 million function cases and 312,000 documents, 15 findings of which 11 stood; 16 surviving mutants killed by 14 more rows, six
wrong statements corrected, the knitr silent-chunk copy filed. `npm test` 16,953 passing in 178 files (exit 1 from the known worker timeout); `npm run package` 44 files; real-document score unchanged (2423 of 2438).
**Ledger:** `CHANGELOG.md` 2026-11-04 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the SESSION_NOTES trim and the quality-gate run), recorded in the close-out commits.

### What Session 339 Did
**Deliverable:** g02 of the backlog ordering plan, twenty-third session: the BACKLOG item "Three more quadratic single-line shapes, found by Session 336's own probes and its review round, none of them in its diff" -- parts (9) `\end{` repeated,
(10) `class=` in a div opener, (11) `<pre ` and its family -- DONE; claim `4d1944c`
**Started:** 2026-10-30 (closed 2026-10-30)
**Status:** Closed out. Timed the three literal shapes at `4d1944c` in fresh processes and profiled them (93 to 97 percent of the time in the one pattern; the item's literal `class=` opener, unterminated, costs 12 ms because it is refused first);
three workers in isolated worktrees, strict TDD (27 of 33, 13 of 29 and 8 of 66 clock rows fail on the parent, all three oracle files fail "is not a function"); 15 commits cherry-picked with no conflict; the review round (54 agents): 0 differences
over more than a billion strings and ten million documents, 36 findings of which 21 of 24 verified stood, two regressions in the cures fixed (108 ns to 15 ns a call; 7.78 ms to 4.65 ms on a dense line), 36 survivors pinned, wrong figures and
comments corrected by a follow-up of 3 workers (12 commits); six lists run alone (222 edits, 192 killed, 30 equivalent, 0 contradict); the stack copy, the Outline's per-cell virtual document and the preview's stderr parse filed. `npm test` 16,877
passing in 176 files (exit 1 from the known worker timeout); `npm run package` 44 files; real-document score unchanged (2423 of 2438).
**Ledger:** `CHANGELOG.md` 2026-10-30 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round with its follow-up, the SESSION_NOTES trim and the quality-gate run), recorded in the close-out commits.

### What Session 338 Did
**Deliverable:** g02 of the backlog ordering plan, twenty-second session: the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (nine class patterns under the `u`
flag, two array spreads, found by Session 337's review round) -- DONE; claim `4f92d34`
**Started:** 2026-10-29 (closed 2026-10-30)
**Status:** Closed out. Re-bisected the sites at `fe6aaec` in fresh processes (a line up to U+00FF never throws; the item's spread figures did not reproduce); a shared reader and its 21 tests and 29
mutants first; five workers in isolated worktrees, strict TDD (247 of 499 new rows and 484 of 663 oracle tests fail on the parent, the rest are labelled controls); 29 commits cherry-picked, one anchor
collision fixed (`f3107b6`); the six lists run alone (295 killed, 27 equivalent, 0 contradict); the review round (70 agents): 0 differences in 200,000 documents, 32 findings of which 25 stood, the citation
loop moved into the core as `readCitations`, fourteen mutation survivors pinned (`s338-review.json`, 20 killed), a provider gate, limits raised, figures corrected; the standing guard and one Polish item
filed. `npm test` 16,399 passing in 170 files (exit 1 from the known worker timeout); `npm run package` 44 files; real-document score unchanged (2423 of 2438).
**Ledger:** `CHANGELOG.md` 2026-10-30 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the SESSION_NOTES trim and the quality-gate run), recorded in
the close-out commits.

### What Session 337 Did
**Deliverable:** g02 of the backlog ordering plan, twenty-first session: the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones, found by Session 336's own probes and its review round, none
of them in its diff" -- parts (1) to (8), the eight single-line `RangeError` shapes -- DONE; claim `8ebce73`
**Started:** 2026-10-29
**Status:** Closed out. Re-bisected the eight shapes at `8ebce73` (six figures held exactly; the corrections are in the CHANGELOG); eight workers in isolated worktrees, strict TDD (rows RED, oracle RED, cure, mutation list
per part; 215 of 263 new rows fail on the parent); 35 commits cherry-picked, one anchor collision fixed (`f94b258`); eight new lists run alone (416 killed, 60 survive, 0 contradict); the review round `wf_8650bf5a-af9` (54
agents): no disagreement between any new function and its old pattern, 204 new mutants with four real gaps pinned (`0e1efa4`), twelve false statements corrected (`aaf17a9`), eleven more places that throw filed. `npm test`
15,252 passing in 139 files (exit 1 from the known worker timeout); `npm run package` 44 files; real-document score unchanged (2423 of 2438).
**Ledger:** `CHANGELOG.md` 2026-10-29 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 336 Did
**Deliverable:** g02 of the backlog ordering plan, twentieth session: the BACKLOG item "Three more single-line shapes found by Session 335's review round" -- (1) a `<!--` line with no `-->` (`COMMENT_FULL_LINE`, `COMMENT_FULL_LINE_COL0`,
`provableProse`), (2) a bare `key=value` attribute value (`ATTR_KEY_VALUE`), (3) the table opener's call (mutant W01) -- DONE; claim `aea22f6`
**Started:** 2026-10-29
**Status:** Closed out. Timed the three shapes first in fresh processes (they held; first throw 8,388,573, not the item's 8,390,625); `e48a43d` 25 document rows RED by RangeError (12 distinct stacks); per part a seam-and-oracle commit (RED: the
import was not a function) and a cure commit (`a88b5f1`/`45dafc7`, `9dfc173`/`56f7823`); part (3): whole-function mutants named the follower, 20,736 probes found 2,640 differing documents, 22 rendered with quarto (the real build agrees on all
22, the mutant on 6), `6878c72` 22 rows, W01 killed. Four mutation lists (118 edits). Review `wf_bf455167-107` (5 lenses, 67 agents, 6.1 million subagent tokens, 78 minutes, 31 findings none refuted): cures right (about 187 million strings, 2.9
million documents, 0 differences), 33 of 109 new mutants alive (closed by `9d0a030`; lists `1ab0a93`), ten false statements of mine corrected, eight overflows and three quadratic shapes outside the diff filed. `npm test` 14,099 passing in 118
files; `npm run package` 44 files; real-document score unchanged (2423 of 2438).
**Ledger:** `CHANGELOG.md` 2026-10-29 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the SESSION_NOTES trim and the quality-gate citation), recorded in the close-out commits.

### What Session 335 Did
**Deliverable:** g02 of the backlog ordering plan, nineteenth session: the Session 317 item's parts (4) to (9), the regex-stack overflows (`tableRuleRow`/`pipeDelimiterRow`, the front matter `from:` extension lists, the YAML tag and
anchor group, a run of `#`, a run of `>`, the LaTeX macro argument tail) -- DONE; claim `c06ee06`
**Started:** 2026-10-28
**Status:** Closed out. Thirty document rows RED by RangeError on the parent (`3c0bb60`); per part a seam and oracle commit (RED: the import was not a function) and a cure commit (`ef74ed4`, `4be6114`, `33cab0e`, `f892887`,
`9b06d76`/`504b300`/`8ad09d0`, `14ba769`/`0a40980`); 233 mutants in six lists (`77040b9`, `cd93b09`, `8b8012f`; 12 survivors) and the survivor rows of `c26a4dc`; the pinned counts recounted by Python ports; shape maps of 360 and 128
shapes, 0 anomalies. Review `wf_b6efeab6-0c0` (5 lenses, 45 agents, 4.2 million subagent tokens): the cures agree with the old patterns on about 200 million comparisons, the tests did not pin 48 class-edge, cap and name-list edits
(killed by the sweep and the long-run rows, 69 mutants in group RV) and the records held about forty false or stale statements (corrected). `npm test` 13,898 passing in 115 files; `npm run package` 44 files; real-document score
unchanged (2423 of 2438); the item left `BACKLOG.md`, three shapes filed.
**Ledger:** `CHANGELOG.md` 2026-10-28 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the SESSION_NOTES trim and the quality-gate citation), recorded in the close-out commits.

### What Session 334 Did
**Deliverable:** g02 of the backlog ordering plan, eighteenth session: the Session 318 item's parts (4) to (7), `htmlLineHasText`, `linkAttributesHaveJunk` (was `linkDefinitionAt`'s attribute check), `knitrOptionNames` (was `knitrCodeMasksPrinters`' `options(`
scan) and `yamlAliasName` (was `YAML_ALIAS_VALUE`), all `model.ts` -- DONE; claim `08b271f`
**Started:** 2026-10-28
**Status:** Closed out. Timed the four literal shapes first in fresh processes (the item's figures held) and profiled (83% to 95% in the four patterns); `8cbb2d2` 32 document rows, 22 RED on the clock alone; per part a seam and oracle commit (RED: the import was
not a function) and a cure commit (`855e0e0`/`e3545a8`, `11102a0`/`50fa22b`, `5917d42`/`ae72f74`, `6c1417e`/`b48ecf7`); 216 million strings in a scratch differential, 0 differences; `0c072f6`, `64e1a47`, `131c423`, `5ebc915` 95 mutants (86 killed, 9 argued).
Review `wf_4c0e316d-989` (5 lenses, 73 agents, 8.2 million subagent tokens): the cures agree with the old spelling on about 400 million strings and 3 million documents, but the ANSWERS were pinned only on short strings: 82 real gaps, closed by `990cade`,
`85cce1f`, `761f308`, `221e12b`, `1a2b3a0`, 137 more mutants (`00a1ae0`: 106 killed, 31 argued), a wrong row of mine replaced by RESIDUAL rows after rendering nine documents with quarto, wording fixed (`5678884`), the item removed from BACKLOG.md, 7 shapes
filed. `npm test` 13,458 passing in 109 files; `npm run package` 44 files; real-document score unchanged (2423 of 2438).
**Ledger:** `CHANGELOG.md` 2026-10-28 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the SESSION_NOTES trim and the quality-gate citation), recorded in the close-out commits.

### What Session 333 Did
**Deliverable:** g02 of the backlog ordering plan, seventeenth session: the Session 318 item's part (1), `GRID_TABLE_BORDER` (`model.ts`), quadratic on `+` then n dashes then ` -` -- DONE; claim `1be4982`
**Started:** 2026-10-28
**Status:** Closed out. Timed the item's shape first (fresh processes, load 7 to 9: it held, 374 / 1,507 ms) and profiled before reading the cure (96.5% in the pattern). `4f4560b` 21 rows, 16 RED on the parent on the clock alone; `2fcd716` the seam and the oracle (the old
spelling kept in a test of its own; RED: the import was undefined); `a429813` the cure `^\+(?=[-+=:]*[-=:])[-+=:]*[ \t]*$` (20,000 dashes 1,507 ms to 6 ms, a million 28 ms; 47,079,208 strings, 0 differences); `9002d6b` 42 mutants in three lists and the two
rows they asked for; `4964fd1`, `fda7c4c` records. Review `wf_5cb9ea32-a35` (5 lenses, 37 verifiers): the old and new patterns agree on about 0.5 billion strings; 12 of 15 new mutants were alive on my rows and are killed by `c7d0bea` (5 document rows, 13
equivalence rows); the gate and the third call site had been described too narrowly (`PLUS_ONLY_ROW` guards only the line's own question; the third site does receive long lines); 12 wrong statements fixed; 6 shapes and 11 unpinned edits filed. `npm test` 13,071
passing in 105 files; `npm run package` 44 files; `test:oracle` 2 files pass (warm); real-document score unchanged (2423 of 2438).
**Ledger:** `CHANGELOG.md` 2026-10-28 -- one entry per action (the claim entry replaced by the outcome entry; one each for the review round, the SESSION_NOTES trim and the quality-gate citation), recorded in the close-out commits.

### What Session 332 Did
**Deliverable:** g02 of the backlog ordering plan, sixteenth session: the Session 318 item's part (9), a long paragraph of consecutive lines under a top-level `from: gfm`, `commonmark` or `commonmark_x` is quadratic -- DONE; claim `e2fb887`
**Started:** 2026-10-28
**Status:** Closed out. Timed the item's shapes in fresh processes first (all held) and profiled before reading the cure. `b8a62a8` 15 rows, 12 RED on the parent on the clock alone; `be9eed7` the gate with the old expression as the
oracle; `9cde0dc` 5 rows RED on the gate-only cure (a second quadratic shape I found by timing); `f440341` the first `ParagraphInterruptScan`. Two review workflows (`wf_4abc347e-5cc`, six lenses; `wf_dd22ee3d-421`, four) found, and
I reproduced, two faults in it: the scan was keyed on the columns array and restarted at every change of the open columns, and the else-branch gave a line that cannot underline the whole paragraph (17x the parent on a long first
line). `0918c3f` RED, `944fccb` the rewrite (the scan keeps the distinct indents; the else-branch is the default count), then rows and wording for 23 test gaps and 35 wrong statements. `npm test` 12,984 passing in 104 files; `npm
run package` 44 files; `test:oracle` 2 files pass; real-document score unchanged; 0 differences in 2 million random and 10 million exhaustive documents. Nothing new filed beyond the Polish item.
**Ledger:** `CHANGELOG.md` 2026-10-28 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 331 Did
**Deliverable:** g02 of the backlog ordering plan, fifteenth session: the Session 319 item's part (1), consecutive lines that each open a container column nothing closes (a long definition list) -- DONE; claim `673072d`
**Started:** 2026-10-27
**Status:** Closed out.
Timed first (16,000 lines of each of eight shapes 3.9 to 4.1 s; `~ a` under `commonmark_x` cubic) and profiled before the cure was read (the stack read per line, the item's hypothesis). `2bd08b7` 20 RED rows (clock alone, answers
right). `c2a8bd2` `ColumnStack` and its oracle (the plain arrays, every sequence of up to four operations, 15,000 seeded). `b65afb0` the wiring: 16,000 lines 55 to 65 ms, 64,000 lines 145 to 170 ms. `4be6b20` and `8b29b45` pins and an
80-mutant list (68 killed on the first whole-suite run, 77 at the end). A 600,000-document differential found 0 differences, with 3 of 9 controls invisible to it. Review `wf_24338eb5-04f` (5 lenses): 0 differences in 24.5 million
documents, 12 gaps closed by `67e270c` (13 rows and an identity row), 15 wrong statements fixed, the `lists` counter dropped. `npm test` 12,653 passing in 102 files; `npm run package` 44 files; real-document score unchanged. Nothing
new filed; the residuals are inside the BACKLOG item.
**Ledger:** `CHANGELOG.md` 2026-10-27 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 330 Did
**Deliverable:** g02 of the backlog ordering plan, fourteenth session: the Session 318 item's parts (2) and (3), `ATX_CLOSING_PANDOC` and `HEADING_ATTRIBUTE`, the slow time left on a heading line -- DONE; claim `4482bae`
**Started:** 2026-10-27
**Status:** Closed out. The profile put 98.5% (a `#` run), 94.1% (a `{` run) and 47.5% + 47.3% (a bare backslash run, which reaches both) in the two regexes the item named; each became a scan from the end of the line (`72f4762`:
`atxClosingPandocStart`, `headingAttributeStart`; `buildHeading` cuts at the index and asks for the attribute once), 13 clock rows RED on the parent first (`c0647be`: 3.2 to 3.9 s against 1,000 ms), the old regexes kept as the oracle
(`bf0653b`; 40,459,924 strings, 0 differences, a Python recount of all ten pinned counts), 51 mutants (`362c878`: 47 killed, 4 argued) with 24 wiring rows and 8 long-run rows for the one survivor (W01), and a five-lens review round
(`wf_25c3723d-9d5`) whose fixes landed in `b23e612` (9 more mutants: 8 killed, 1 argued; 14 rows; about a dozen wrong comments). Nothing new filed. `npm test` 12,584 passing in 100 files; `npm run package` 44 files; real-document score
unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-27 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 329 Did
**Deliverable:** g02 of the backlog ordering plan, thirteenth session: the Session 311 item's part (5), a front-matter block scalar and many `---` groups -- found already closed, pinned -- DONE; claim `66eba23`
**Started:** 2026-10-27
**Status:** Closed out. Timed first: neither document is slow at HEAD (58 ms for 20,000 scalar lines, 181 ms for 12,000 groups); both reproduce on the item's tree `066cfcc1` (2,349 and 25,606 ms). A timing scan of
the 55 trees that touched `src/` since then names the cures:
`778ea19` (Session 314, scalar) and `b63fafc` (Session 322, groups). A 4-lens neighbour sweep (`wf_55bf392e-40d`, about 870 runs) found every entry linear on the literal shapes and two known families that gained
witnesses. 11 rows pin the answers (`96a8ac1`, pass on arrival; RED =
4 mutants); a 2-lens review (`wf_4a28808e-a0f`) found `npm test` red at `96a8ac1`, 5 wrong statements and 4 surviving small-constant edits: `6ed890c` renames the constant, fixes the text and adds two larger rows; 14
review mutants killed. `npm test` 12,486 passing in 99 files; no `src/` change.
**Ledger:** `CHANGELOG.md` 2026-10-27 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 328 Did
**Deliverable:** g02 of the backlog ordering plan, twelfth session: the Session 311 item's part (3), unclosed fence-like lines with no blank line between them are quadratic (`` ```text i `` x N), the reviewer's attribution is `consumedCloserLine` -- DONE; claim `fdd1f66`
**Started:** 2026-10-27
**Status:** Closed out. The profile put 94% of the time in the item's three places (`FENCE_CLOSE` 48.9%, `consumedCloserLine` 29.0%, `fenceMatchAt` 16.3%); one function respelled (`c158265`: a reader made once per document that keeps, per KIND of opener, the span of its
last scan),
11 clock rows RED on the parent first (`9e80dbb`: 3.0 to 4.7 s against 1,000 ms), the old function kept as the oracle (`3c35c69`), 50 mutants (`e5c881b`) and the rows the survivors asked for (`31ae36a`, `216b39e`), and a six-lens review round (`wf_c7e9c82f-2fc`) whose
fixes landed in `aa6d6a9`, `a20167e` and `9a26e7f`
(31 more mutants, 25 killed, 6 argued). One part (11) added to the S311 item, two Polish items filed (BACKLOG). `npm test` 12,471 passing in 99 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-27 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 327 Did
**Deliverable:** g02 of the backlog ordering plan, eleventh session: the `$` half of the Session 311 item's part (6), `findMathRegions` on an unclosed `$` run (`$a ` repeated) is quadratic -- DONE; claim `9d16619`
**Started:** 2026-10-26 (closed 2026-10-27)
**Status:** Closed out. Three shapes share one cause (`$a `, a closer followed by a digit, an escaped closer); 7 clock rows RED on the parent (`72d4a9c`: 4.0 to 6.7 s against 1,000 ms), the cure (`38e557c`: one kept closer, a position-only test), the old scan as the oracle
(`ddd7923`; 10,049,350 enumerated strings, 300,000 seeded, 20,000 documents), 81 mutants (`6d01002`: 67 killed, 14 argued equivalent), and a six-lens review round (`wf_d7b78f0a-521`) whose fixes landed in `a19c06d` and `7bcb0f5` (13 more mutants, all killed).
One part added to the S311 item and one Polish item filed (BACKLOG). `npm test` 12,327 passing in 98 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-27 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 326 Did
**Deliverable:** g02 of the backlog ordering plan, tenth session: the Session 317 item's part (3), the native-div one-line check in `indexLabels` is quadratic (`<div` + `{` x N), with the `{` half of the Session 311 item's part (6) -- DONE; claim
`ada8bfb`
**Started:** 2026-10-19 (resumed and closed 2026-10-26, after a machine reboot)
**Status:** Closed out. The profile put 98% of the time in `braceGroups`, not in the regexes the item named; one function respelled (`97669ab`: each `{` read straight on until one read fails, then one backward table over three quote states), 10 clock
rows RED on the parent first (`7210ef6`: 3.0 to 7.7 s against 1,000 ms),
the old function kept as the oracle (`87b786e`; 8.56 million strings at the end), 47 mutants (`0048b6d`: 39 killed, 8 argued equivalent), and a six-lens review round (`wf_5ab762e4-a54`) whose fixes landed in `a1eda3a`, `7cef9f3`, `0fb75c5` and
`ee268a0` (25 more mutants: 21 killed, 4 equivalent).
Three items filed (BACKLOG). `npm test` 12,245 passing in 97 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-26 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 325 Did
**Deliverable:** g02 of the backlog ordering plan, ninth session: the Session 317 item's part (2) with the Session 319 item's part (3), a long heading of unclosed backticks, `[`, macro groups, comments, CDATA, instructions, tags or shortcodes is quadratic in
`headingContentRefused` -- DONE; claim `6c02220`
**Started:** 2026-10-19
**Status:** Closed out. The function and its five tables exported as a seam (`0f8f1a3`), 13 rows RED on the parent (`4172926`: 3.5 to 6.3 s against 1,000 ms, clock alone), four cure slices (`4498486`, `c61097e`, `2682196`, `0e5aeab`), the old functions as the oracle (`a110798`),
77 mutants (`39b0fdb`), a six-lens review round (`wf_b711409d-bcc`) whose fixes landed in `6e90e6d`, `4d7e5f5` and `6f07744`, records in `3bf73c8`. One item filed (BACKLOG Polish). `npm test` 12,185 passing in 96 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-19 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 324 Did
**Deliverable:** g02 of the backlog ordering plan, eighth session: the Session 317 item's part (1), `ATTR_ATOM_RUN` backtracks exponentially (and quadratically for a dash run) on a heading, fence, image, span or div attribute block with a refused tail -- DONE; claim `d9be8ec`
**Started:** 2026-10-19
**Status:** Closed out. One pattern respelled (`8432555`: dashes, at most one class, then ids), 12 of 19 document rows RED on the parent first (`047b5fa`: 3.7 to 12.3 s against 1,000 ms), the old alternation kept as the oracle (`15a8a04`; 85 tests at the end),
50 mutants (`2d717b2`, `8b57d78`: 46 killed, 4 argued equivalent), a tracked counting script (`51a8b8f`), and a five-lens review round (`wf_f4782c7f-c93`) whose fixes landed in `8b57d78` and `9677869`. Nothing new filed. `npm test` 12,088 passing in 95 files; `npm run
package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-19 -- one entry per action (the claim entry replaced), recorded in the close-out commits.

### What Session 323 Did
**Deliverable:** g02 of the backlog ordering plan, seventh session: B89 part (6a), YAML nesting depth is superlinear (close to cubic in depth) in the front-matter nested-value enumerator and its ancestor walk -- DONE; claim `236624d`
**Started:** 2026-10-18
**Status:** Closed out. One function respelled (`fce6996`: `containerChain`, a chain of containers per line kept in `index.chains`), 9 clock rows RED on the unmodified tree (5.3 to 16.4 s against 1 s) and the old climb kept as the oracle with the work
pinned as lines read (`b512ccd`: 50 tests, 14 fail on the parent), 45 mutants (`3880377`, `d436802`: 41 killed, 4 argued equivalent), and a six-agent review round (`wf_7b847a93-d5c`) whose fixes landed in `d436802`. Nothing new filed.
`npm test` 11,981 passing in 94 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-19 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

### What Session 322 Did
**Deliverable:** g02 of the backlog ordering plan, sixth session: B89 part (8), `insideHtmlComment` rescans every line from the top for each mid-document `---` YAML block, so every region-scanning entry is quadratic in the block count -- DONE; claim `05936de`
**Started:** 2026-10-18
**Status:** Closed out. One site respelled (`b63fafc`: `htmlCommentOpenAt`, a reader that keeps its place), 11 of 12 new document rows RED on the parent (2.7 to 5.0 s against 1 s) and proved against the old spelling (`03173a7`, `ac4f555`: 56 tests in all),
31 mutants (29 killed, 2 argued equivalent), and a five-lens review round (`wf_4a85c4da-db1`) whose fixes landed in `36e07fe`, `a154e41` and `db6d090`. One item filed (BACKLOG, the Session 322 sweep). `npm test` 11,915 passing in 92 files;
`npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-18 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

### What Session 321 Did
**Deliverable:** g02 of the backlog ordering plan, fifth session: B89 part (3), `refs.ts`'s unanchored `/[ \t]*$/.exec(...)` over the gap between `#|` and a cell option key -- DONE; claim `c956feb5`
**Started:** 2026-10-17
**Status:** Closed out. One site respelled (`f36f6634`: `trailingBlanks`, a scan back from the end), 6 document rows RED on the parent (about 6 s each) and proved against the old spelling (`c38230fb`: 14 mutants, all killed, and 7 more
behaviour rows),
and a four-lens review round (`wf_43a50d7c-b48`) whose fixes landed in `48f65ae2` (8 rows, 34 mutants, text made true). Nothing new filed (the ATTR_ATOM_RUN item gained a cold-start note). `npm test` 11,844 passing in 91 files; `npm
run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-18 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

### What Session 320 Did
**Deliverable:** g02 of the backlog ordering plan, fourth session: B89 part (4), the closing-run and rule-row patterns: `TABLE_RULE_ROW`, the two `[ \t]+#.*$` of `knitrDocumentDefaults`, `ATX_CLOSING` and `parseOutputPath` -- DONE; claim `9d0ffbcb`
**Started:** 2026-10-17
**Status:** Closed out. Five sites respelled in four commits (`614fd923`, `196fbe47`, `b80e5467`, `a95d49a2`), each RED first (24 of 118 new rows fail on the parent), proved against their old spellings, 76 mutants (73 killed, 3 argued equivalent),
and a five-lens review round whose fixes landed in `36216472`, `e2bc6bea`, `a202a6d6`, `4446237b`, `c8623ef8`, `736c9849` and `a827cf5b`. Nothing new filed. `npm test` 11,776 passing in 90 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-17 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

### What Session 319 Did
**Deliverable:** g02 of the backlog ordering plan, third session: B89 parts (5)+(9), the CR / U+2028 family, a blank run followed by a tail a CR stops -- DONE; claim `6ea0db00`
**Started:** 2026-10-16
**Status:** Closed out. Fifteen patterns and a ` #` strip respelled in nine commits (`ff31f31a` to `280cc912`), each slice RED first (55 document rows fail on the parent), proved against their old spellings (17 table entries, a
730,000-document differential with 0 differences),
51 + 77 mutants, and a four-lens review round whose fixes landed in `33ec9bc8`, `30dc71fa`, `76ed336c` and `4ad1228e`.
One new item filed (BACKLOG line 92). `npm test` 11,657 passing in 89 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-17 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

### What Session 318 Did
**Deliverable:** g02 of the backlog ordering plan, second session: B88 part (7), a fence run followed by CR or U+2028 is quadratic in the fence patterns' tails -- DONE; claim `b89b6d4c`
**Started:** 2026-10-16
**Status:** Closed out. Three patterns respelled (`f7076a6f`, `01954e39`), proved against their old spellings, 22 document rows RED on the parent (`398c68c0`), 36 mutants (`c7c510b1`), a five-lens review whose fixes landed in `73f6689f`, `602eba91`, `4755299f`.
One new item filed (eight regexes and a paragraph reader). `npm test` 11,403 passing in 86 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-16 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

### What Session 317 Did
**Deliverable:** g02 of the backlog ordering plan, first session: B88 part (8), `scanRegions` must not throw `RangeError` on one line of 2,100,000 `-`, `*` or `_` -- DONE; claim `ad731aeb`
**Started:** 2026-10-16
**Status:** Closed out. Five patterns respelled (`4627675d`), exhaustive proof plus near-miss and gap-grid rows, 51 + 4 mutants (49 + 3 killed, 3 argued equivalent), a five-lens review round that closed three test gaps.
Nine more families filed. `npm test` 11,347 passing plus one load-flake clock row (11,348 in 85 files); `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-16 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

## Session 341 Handoff Evaluation (by Session 342)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `e8d5a36`, gap 0), no `pending` receipt, the ratchet citation (2/2, equal to the
receipt) and the picker all held; candidate (a) was placed by finishing a feature and its estimate "one session together" held for the cures.
**Helped:** the cures for (2) and (3) were right as written and the figures reproduced in slope (part (2) 479 / 1,323 / 4,179 ms against 220 / 844 / 3,128; part (3) 0.59 / 2.30 / 9.40 ms per line against 0.46 to
0.50 and 1.8 to 1.9); gotcha 4 (the runner tests the COMMITTED source; `mutation-lists-apply` forces re-anchoring) is why the merge was safe; gotchas 6 and 7 held; Learnings 910, 911, 913 shaped every brief.
**Missing:** (1) part (5) was filed as a SPEED problem ("a second full region scan: 2.8 against 14.0 ms") and its probe left out `resolveDocumentEngine`, which the Outline calls first and which caches the
engine-blind scan: in the real flow the second scan is a cache hit (2.53 against 2.50 ms at 2,000 cells); "no differing list was reproduced on five knitr shapes" measured five shapes (a stress pool: 44 knitr, 484
jupyter, 206 markdown documents differ) (Learning 916). (2) Part (3)'s "500-line edit across 2,000 cells, 933 ms" is not a shape the loop can run (`rangeWithinCell` stops at the first fence). (3) Part (4) did not
say a trailing debounce coalesces only bursts (Learning 917).
**Wrong:** the speed claim for part (5). **ROI: medium-high.**

## Session 342 Self-Assessment

**Score: 7/10.**
**Went right.** Timed all four shapes at the parent before briefing; seam first, rows RED on the clock or a count, all four RED counts re-run from my side (6 of 33, 6 of 29, 19 of 37, 57 of 96); verified the claims
that change code (the mutants T03 and A01 survive every committed test), re-ran the part (5) change on two small documents and then re-measured its speed claim through the real call sequence, which overturned my
claim and the item's; `mutation-lists-apply` right after the pick caught eight moved entries; asked before the screen-taking run; all eight lists run alone in a scratch worktree and equal to the workers'; accepted
two worker contradictions that were right (the lazy `getText`, the self-contradicting FB item).
**Went wrong.** (1) I reported "about 13 ms of a 15.3 ms preparation is a second region scan" as measured and briefed a speed cure; my probe left out `resolveDocumentEngine`, as the item's did (Learning 916), and a
fix worker's docstring correction caught it. (2) My part (4) brief said K keystrokes were K evaluations (2K) and did not say the debounce cures bursts only; I named the 150 ms as a choice but the headline 1,052 to
39 ms is for 10 ms gaps (Learning 917). (3) The fix brief contradicted itself on FB and asked for an eager `getText()` (Learning 920). (4) The merge turned `mutation-lists-apply` red (eight entries): I did not tell
the workers to grep the older lists for the files they edit (Learning 918). (5) The zsh gotchas in the handoff bit again (`set -- $spec` left four junk worktrees; a variable `rm -rf` was refused; `echo ===`). (6)
The first list run started at load 27, the tail of my own `npm test`; results matched the workers' at lower loads.
**Known residuals:** the BACKLOG item "What Session 342's review round found beside the typing-path cures" (seven parts, the first a question for you), what stays of the Session 341 item, the other Up Next and
Polish items, the survivors (in each list's `why`), `test:lsp` NOT run; no integration row drives the debounce wiring.
**TDD:** RED before GREEN for every cure part and for the fix round's new logic (`isInCodeCell`: 39 rows failing "Failed to load url" before the module; the adapter pins 7 failed | 45 passed before
`updateCellContext` called it); the rows added for survivors are green on arrival by nature and their RED is the mutant (T03 fails 4 of 5 new rows, T04 5 of 5; A01, A02, A04, FA, K01 5 failed | 75 passed before the
problem lists grew; V19, V21, V22, M05 killed by name).
**Host:** `test:integration` RUN with go-ahead (562 passing, exit 0); `test:lsp` NOT run. **Cost:** three workflows (cures 3 workers 1,322,183 subagent tokens, 496 tool calls; review 72 agents 7,154,975, 1,540; fix
2 workers 577,213, 242: 9,054,371 in all), eight list runs, two `npm test`, one integration run, no quarto renders, load 3 to 27.

## Session 340 Handoff Evaluation (by Session 341)

**Score: 9/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `7175687`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`, equal
to the receipt) and the picker all held. Candidate (a) was placed by finishing a feature (g02 is in flight) and its estimate "one session together" held for the cures; the review and fix rounds were the rest of the session.
**Helped:** the item's two cures were right as written (a memo per text or one batch builder; "test only the new lines") and its figures reproduced in slope: part (2) 3,585 ms at 2,000 cells against my 4,337 ms, part (3) 4x
per doubling with my absolute times 2x to 3x under the item's (1,350 against 2,939 ms at 4 MiB in 4,096-byte chunks); Learning 903 named what must be well-formed to reach the preview site (the marker line); Learning 907
shaped the answer rows; gotcha 4 (the runner tests the COMMITTED source, one list at a time) and gotcha 6 (the baseline `npm test` exits 1 with every test green) held to the letter (one error, exit 1); gotcha 7 (the foreign
worktree) held.
**Missing:** nothing said that both slow paths sit behind `vscode` adapters no headless test reaches, so the first step is a behaviour-neutral seam in `src/core` (Learning 913); nothing warned that a cure replacing a loop by
an index must keep the old spelling's answer for a fractional `startLine` (Learning 914; the review found my first cure throws on 1.5); the item's "about 85% of the cost" for part (2) was a floor (4,337 to 10.2 ms is 99.8%).
**Wrong:** nothing material. **ROI: high.**

## Session 341 Self-Assessment

**Score: 8/10.**
**Went right.** Timed both shapes at the parent in fresh processes before reading the cure; seam first, so the clock rows were RED on the clock alone and shown (`5cd2336` 4 failed | 10 passed, `d22f0c9` 6 failed | 6 passed);
the old spelling kept as the oracle with enumerated and seeded differentials and Python recounts that share no code; cures byte-identical (4,337 to 10.2 ms, 8.8 s to 9 ms); a five-lens review round and a fix round, with every
claim that changes code or a verdict checked from my side (D1 re-run RED against `89d38e3`'s `virtual-doc.ts`: 13 rows failed; the stuck clock and the dead hashes re-run; all four lists re-run alone, one after another, and
equal to the workers' figures); the cherry-picks proved complete with `git cherry` before the worktrees went; asked before the screen-taking run and ran it only after the answer; gave status lines.
**Went wrong.** (1) The cure I accepted threw `TypeError` on a hand-made cell with a fractional `startLine` where the old function answered (D1, low: no real document makes one); the seeded generator drew whole numbers only
(Learning 914). (2) Pins incomplete a TWENTY-SEVENTH time: the clock rows' own clock was unpinned (a stuck clock passed every row, Learning 910), the gate on `preview.ts` was fooled by comments both ways and the Outline call
sites had no pin (Learning 911), and 22 of the review lens's 64 mutants survived, 15 real gaps. (3) Worker messages and committed prose cite branch hashes the cherry-pick changed (six messages on master and four citations in
the lists, repaired in `3a500e5`) and carry wrong counts ("27 rows", "11 rows", "86 passed"): I never told the first workers to cite by subject (Learning 912). (4) The refuters returned 46 of 47 as standing, which is not a
discriminating result; I re-ran the key repros myself (Learning 915). (5) My fix-round brief left out TD-7(b), a header that said "which no load moves" (the cure's ratio ranged 1.9 to 2.7); I fixed it after the picks
(`c35d3cb`). (6) My load gate compared the load as a string, so the monitor ended at load 59, and the lists ran at load 4 to 10, not under 6, because the machine's baseline (system `mediaanalysisd`) never dropped; survivors
are load-proof and every kill came with its failing title. (7) `echo =====` failed in zsh again, a gotcha already written down.
**Known residuals (filed or stated):** the BACKLOG item "What Session 341's review round found beside the Outline and preview cures" (seven parts, the first a question for you), the other Up Next and Polish items, the
survivors (B27, K09, F07, R16c, S04 S12 S16 S19 S21 S24 equivalent; WI03 on purpose; R33 and S06 gaps), the Session 333 and 334 items, the S322 item's part (1), the S311 item's parts (4), (10), (11); `test:lsp` NOT run.
**TDD:** RED before GREEN for both cures (rows RED on the clock at the seams, `5cd2336` and `d22f0c9`, then oracle, then cure) and for D1 (`1033e20`, 13 rows RED at `89d38e3`, re-run from my side, then `09dada7`); the pins
and the fix-round rows are green on arrival by nature and their RED is the mutant (the review lists: 9 killed and 21 survive before the rows, 41 / 4 after; 21 of 22 survived and one false kill, 23 / 1 after).
**Host:** `test:integration` RUN with go-ahead (562 passing, exit 0, 2 minutes on the screen); `test:lsp` NOT run. **Cost:** three workflows (the cures 2 workers, 599,106 subagent tokens, 278 tool calls; the review 99 agents,
8,298,432 and 1,741; the fix round 2 workers, 884,543 and 515: 9,782,081 in all), four list runs of 2 to 7 minutes, two `npm test`, no quarto renders, the machine at load 3 to 63 (my own `npm test` raised it to 63).

## Session 339 Handoff Evaluation (by Session 340)

**Score: 9/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `3be8ca8`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`, re-run and
equal) and the picker all held. Candidate (a) was placed by finishing a feature (g02 is in flight) and its estimate held: one session, with a review round.
**Helped:** the item's cure was right as written (a counter, `let top = ...; top--`; 284 to 346 ms predicted, 332 ms measured) and its timings reproduced within the load (88.5 / 224.6 / 895.9 / 3,085.6 against 86.0 / 218.6 / 849.7 /
2,861.1 ms); the warning that the `from` text of B01 to B14 and B18 was anchored on the probe's spelling and `mutation-lists-apply` must run first named exactly the 18 mutants that needed re-anchoring; gotcha 4 (the runner tests the
COMMITTED source; one list at a time) and gotcha 2 (rebuild the harness with esbuild, one fresh process per probe) held; the Session 339 files were templates for the oracle file and the list.
**Missing:** nothing said the shape needs a ROW THAT READS THE POP COUNT BACK through a later closer; the first rows that follow the item's own recipe kill the body mutants and leave 16 call-site, pop-loop, name and size mutants
alive (Learning 907). **Wrong:** nothing material; the S339 commit messages' counts were already named as wrong in its own self-assessment. **ROI: high.**

## Session 340 Self-Assessment

**Score: 8/10.**
**Went right.** Timed the item's shapes at the parent myself in fresh processes and profiled them before writing a row; RED first and shown (11 of the 14 tests of the rows file fail on the clock alone at `9238682`, 3.0 to 5.4 s
against 1 s, and the 2 controls and the sizes pin pass; the oracle file fails 33 of 35 with "is not a function"); an oracle three ways (the old spelling, a recursive reading by definition, a Python recount that shares no code) with
the stack frozen; the 18 older mutants re-anchored in the cure's own commit; a 24-mutant list run alone; a five-lens review round whose every standing finding I checked from my side (the knitr copy reproduced at 140 / 464 / 1,867
ms; the 14 new rows run on the parent and on the cure, same answers; the 16 survivors' kills listed per row with a stand-in runner; the list run alone, 16 killed); gave status lines when the harness nudged.
**Went wrong.** (1) The `b6726b4` message says "the 14 clock rows ... that were RED": 11 were (Learning 908); a commit cannot be amended. (2) My own tests held three false statements the review caught: a title "the heading stays
hidden" on a row that asserts the heading, a comment that promised a block-quote row never written, and "the parent takes 3 s or more" from one load (Learning 909). (3) Pins incomplete a TWENTY-SIXTH time: 16 real gaps among the
lens's 88 mutants (Learning 907); my first fix of them was itself weak (the 5,000-closer row ended on a heading that shows either way and killed nothing) until I listed every failing row per mutant. (4) The harness nudged me for
silence about five times during the long runs and waits: a status line belongs BEFORE each wait, not after the nudge. (5) The lens labelled `N70` equivalent and it is not (the length shrinks while the loop runs): I checked it by
reasoning and the old rows, not by a run of its own.
**Known residuals (filed or stated):** the BACKLOG Up Next items (Session 339's round parts (2) to (4), the knitr copy, the standing guard), the Polish items, 5 + 14 mutants argued equivalent, the Session 333 and 334 items, the S322
item's part (1), the S311 item's parts (4), (10), (11); `test:integration` and `test:lsp` NOT run.
**TDD:** RED before GREEN for the cure (rows and oracle committed RED first on the parent, `7417f64` and `1aa5e57`, re-run from my side); the pins (`779dd1a`, `2ef3b2b`) are green on arrival by nature and their RED is the mutant (24
edits: 19 killed, 5 equivalent; 16 edits: 0 killed before the rows, 16 after).
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** one workflow (35 agents, 2,597,235 subagent tokens, 403 tool calls, 70 min), three list runs of 3 to 5 minutes (plus the re-anchored 18), no quarto
renders, the machine at load 3 to 33.

## Session 338 Handoff Evaluation (by Session 339)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `acfd9ce`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`, compared by hash), the
baseline (170 files, 16,399 tests, exit 1) and the picker all held. Candidate (a) was placed by finishing a feature and its estimate of one session held (three workers, one review round).
**Helped:** gotcha 2 (rebuild the harness with esbuild, one fresh process per probe, verify the lower bound) and Learning 840 (time the literal shape at HEAD first) found that the item's `class=` opener is NOT slow as written; gotcha 4 (the runner
tests the COMMITTED source; one list at a time; run `mutation-lists-apply` after cherry-picking) and gotcha 5 (reset the worktree's empty branch) held for all six workers; the Session 338 files were templates a worker could start from.
**Missing:** the item's line numbers were stale by 100 to 800 lines (`model.ts:4657`, `5066`, `14351`, `12467`, `12671` against 4774, 5212, 14863, 12900, 13104 at the claim) and its `class=` repro had no closing `"}`, so as written it costs 12 ms;
nothing said that the site is reached only after `divOpenerVerdict` calls the opener well-formed (Learning 903). **Wrong:** nothing material; the "38 commits ahead" was true when written (four commits followed). I still hit the zsh `echo =====`
trap named in gotcha 3. **ROI: high.**

## Session 339 Self-Assessment

**Score: 8/10.**
**Went right.** Re-timed all three shapes at the parent myself and profiled them before briefing, which found the item's unreproducible repro; briefed three workers with the clean-room rule repeated in every prompt (the reviewers' and the
follow-up's too); checked the workers from my side instead of trusting their reports (the RED counts re-run on `4d1944c`: 27 of 33, 13 of 29, 8 of 66, every failure on the clock alone, 52 of 68, 64 of 82 and 68 of 68 on the seams; the cures
re-timed to 10,000,000 characters; the six lists run alone, one at a time; the whole suite, the type-check, `npm run package` and the real-document score on the final tree); ran a six-lens review and acted on what stood (two regressions in my own
cures fixed and re-measured by me, 36 survivors pinned, a dozen wrong figures and comments corrected, the vm watchdog for rows that cannot otherwise fail) and filed the rest (1 and done: the stack copy, the Outline, the preview, the Polish list);
gave status lines before each long run.
**Went wrong.** (1) The workers' commit messages carry counts the final files do not ("27 of 31" is 27 of 33 tests; five stated figures in comments and docstrings did not reproduce, three mutant ids in the README and test comments were wrong, a doc
comment was left on the wrong declaration); they cannot be amended and the review round caught them. (2) My follow-up brief said the cost-only mutants "take seconds" on a line of 10,000,000 characters; they take hours (one needed 44 s at 100,000
characters), so the worker had to add a `node:vm` watchdog: I copied a premise from a lens instead of measuring it (Learning 905). (3) The P1 speed-up I asked for made three of its own lists' mutants unreachable and flipped a fourth; the worker
caught it, I had not warned of it (Learning 904). (4) The review phase took 4 h 13 min with the machine at load 60 to 380 from other work, which made two kills false (E12, E16) and E03 look like a hang; I re-ran E03 alone (4 s, a real kill). (5) My
cap of 24 verifications left the 12 mutation findings M04 to M15 to the runner instead of two refuters (the runner is the stronger check, but the record must say so). (6) The harness nudged me once for silence during the review wait.
**Known residuals (filed or stated):** the BACKLOG Up Next items (Session 339's round, the standing guard), the Polish items, 30 mutants argued equivalent, the review's size-cap and ratio nits, the Session 333 and 334 items, the S322 item's part
(1), the S311 item's parts (4), (10), (11); `test:integration` and `test:lsp` NOT run.
**TDD:** RED before GREEN for every cure (rows and oracle committed RED first on the parent, re-run from my side); the survivor rows and the two speed-ups are green on arrival by nature, their RED is the mutant (each shown failing by a worker and
re-run by me in the six lists; P1 and P2 are refactors under the oracle with the oracle green before and after and the timings re-measured by me).
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** three workflows (3 workers, 898,512 tokens, 416 tool calls, 1 h 9 min; the review, 54 agents, 6,042,009 tokens, 1,563 tool calls, 4 h 13 min; 3 workers, 765,690
tokens, 365 tool calls, 52 min; 7.7 million subagent tokens in all), nine list runs of 3 to 15 minutes, no quarto renders, the machine at load 7 to 380.
