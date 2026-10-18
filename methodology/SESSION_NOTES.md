# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 322 closed out.** g02's sixth session is done: B89 part (8) is closed. `htmlCommentOpenAt` keeps how far it has read and whether a comment was open there (`git diff 05936de HEAD -- src`);
8,000 blocks cost `findHeadings` 2.9 s before and 0.2 s after, about 2x per doubling to 128,000. The old rescan is the oracle (`html-comment-open-equivalence.test.ts`, 56 tests); 11 of 12 new document rows fail on the parent (2.7 to 5.0 s).
31 mutants: 29 killed, 2 argued equivalent. The five-lens review found no defect in the code, 7 test gaps (11 mutants added, 8 survived the old rows) and 12 wrong statements in text (fixed), and one item was filed.
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight. Candidates (the picker shows four and a catch-all):
(a) B89 part (6a): YAML nesting depth, close to cubic, cure not tried (finishing a feature: it is the last part of B89 and the plan's done criterion names it; re-measure first);
(b) the S317 item's part (1), the exponential `ATTR_ATOM_RUN` (the one hang; time it COLD); (c) the S318 item's part (9), a long paragraph under `from: gfm` (a mid-document `from: gfm` triggers it too: the S322 item);
(d) the S319 item's part (1), consecutive container-column lines; (e) the S322 item's part (1), `inQuartoYamlRegion` asked per cell option line (cells x regions). Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) The runner tests the COMMITTED tree and SKIPS a mutant whose `from` no longer occurs once; `mutation-lists-apply.test.ts` reds for it (and adds one test per list). `mutants/b89-html-comment-open.json` (31: 29 killed, W02 and W04 survive on purpose):
run it with `--timeout 60`, H08 never ends and the default costs 10 minutes. A kill row for a mutant is shown RED by running the new mutants against the OLD tests first.
(3) Quote a timing only from a quiet machine (load under about 6) with the load beside it, and recompute a rate from the table's neighbouring cells (Learnings 797, 805). `scanRegions` memoizes the last two texts: every timed row needs a text of its own.
(4) A function that keeps a position needs rows that ask FAR, read LONG lines and put blanks and tabs beside the token (Learning 802); a differential through the public entries cannot see a branch the caller never takes (803).
(5) The Write and Edit tools turn a backslash-u escape for U+2028 into the raw character, in files AND in commit messages (Learning 792). `src/` is gated; check a message with `git log -1 --format=%B`. Prefer `.` to an explicit class.
(6) Count new rows and rows failing on the parent from `vitest list` titles and a run of HEAD's tests against the parent's source (add only `export`), not from a title filter (Learning 794).
(7) `ATX_CLOSING_PANDOC` is still quadratic on a long `#` run or a backslash run (BACKLOG, the S318 item, part (2)); `TABLE_RULE_ROW` still overflows the regex stack at 1,525,196 cells (unchanged, S317 item part (4)).
(8) Clock rows flake under load: the `qmd-model.test.ts` Session 308 `;` row read 2,047.7 ms against 2,000 at load 30 in this session. Name it, re-run the file alone, never loosen.
(9) The Session 314 vitest worker (pid 84774) is STILL spinning at 70 to 100% CPU: not mine; ask before killing it. The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is not mine either.
(10) `test:integration` NOT run for twelve sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 11,915 tests in 92 files, clean.
(11) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session.
(12) The plan: update its status column and "Current position" at each close-out; its key count command (`sed -n '/^## Where each key went/,$p' ... | grep -o 'B[0-9]\+' | sort -u | wc -l`) prints 221 (filed items carry no key).
(13) A sweep lens with a wide brief (148 shapes) ran about 1 h 15 min at load up to 196 and ended only when asked to wrap up (`SendMessage`);
its shell script kept launching runs after its report (killed): bound a sweep lens by shapes and minutes, and check `ps` for its scripts.
(14) `governingMetadataContent` (so `midDocumentMetadataBlocks` and `quartoYamlRegions`) runs 2 to 3 times per scan: about 12% of `findHeadings` at 64,000 blocks, no asymptotic cost; left alone (CHANGELOG), not filed.
`BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices. macOS `sed` rejects `|` as a delimiter and `sed -i` needs `''`. After answering a direct question, STOP and wait (memory).

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

## Session 321 Handoff Evaluation (by Session 322)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`b58ce5dd`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`), the plan's key count (221), the real-document
score (2423 of 2438, unchanged by this session) and the baseline (11,844 in 91 files; 11,915 in 92 after my 71) all held, and the picker the plan ranked was accurate: it offered B89 part (8) first, as finishing a feature.
**Helped:** candidate (a) said "re-measure first": 2,892 ms for `findHeadings` at 8,000 blocks against the item's 2.9 s, and the doubling (87 / 235 / 742 / 2,892 / 10,511 ms) before any code was read; gotcha 2 (the runner tests the COMMITTED tree, the list gate reds)
made me commit before each mutant run and the gate kept my list honest; gotcha 6 (count rows from `vitest list` titles, parent failures by running HEAD's tests against the parent's source) is how I showed 11 of 12 document rows RED (2.7 to 5.0 s); gotcha 4
(a timing is a fact about a load, Learning 797) put every quoted figure at load about 5; gotcha 9 (clock rows flake under load: name it, re-run alone) covered the `;` row at 2,047.7 ms against 2,000; gotchas 10 and 11 (the worker, the worktree, `test:integration`) held.
**Missing:** (a) that a mutant that never ends costs the runner's 10-minute default: H08 needs `--timeout 60`, which only the README of an older list mentioned; (b) that `scanRegions` memoizes the last two texts, so every timed row
needs a text of its own: it is in the S318 item,
not in the gotchas, and I met it only because I read the item; (c) that the Learning 798 sentinel sentence ("a letter put in an alphabet in place of a character moves neither count") is not true: I copied it into my file, and it was
false there (a letter for `!` takes the answered count to 0).
**Wrong:** (a) the item's "`model.ts` near `:3560`" was at 3576 to 3603 once the file moved (a position at a commit, as Sessions 320 and 321 said); (b) nothing else I could find. **ROI: high.**

## Session 322 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the site firsthand before reading code (87 / 235 / 742 / 2,892 / 10,511 ms at 1,000 to 16,000 blocks, the item's 2.9 s held), so the RED rows had a real shape: 11 of 12 document rows fail on the parent at 2.7 to
5.0 s against 1 s and the control passes. The old spelling is the oracle
(three enumerations of 488,281 / 349,525 / 55,987 documents, counts of the old answers also taken with Python; 100,000 seeded documents; three asking orders, shared and fresh closures), an 800,000-document parent-versus-fix differential of mine and the review's
540,000 documents and 5.7 million enumerated ones found no difference, and the cost is linear (199 ms at 8,000 blocks, 2.2 s at 128,000). The review round (5 lenses) was held to firsthand checking: I ran the 11 mutants it invented
through the project's runner against the OLD
tests (8 survive RED, all killed GREEN), re-ran W05 and W06 with a row filter to see which named row kills which, re-counted the alphabet swap with Python (0 for `!`, 8,836 for `>`), and timed the sweep's three shapes in fresh
processes (load 7 to 8.6, slopes 3.3 to 4x) before filing them.
**Went wrong.** (1) My pins were incomplete for the EIGHTH set in a row (Learnings 773, 776, 780, 788, 793, 798): no row asked a line far from the last answer, read a line longer than a cap, put a blank or a tab beside a marker, or put
the comment question to an unterminated block; 8 mutants survived,
and three edits were guarded by one assertion each (Learning 802). (2) Text I wrote was wrong in 12 places: a rate ("3.7 to 3.9 per doubling" from a table whose ratios are 2.7, 3.2, 3.9, 3.6: Learning 805), "the first steps are mostly
the process starting" with no evidence, sentences copied from the Session 321 file that
are false here, a comment that swapped which row kills W05 and which W06, a docstring paragraph that re-dated Session 211's sentences (806), three `why` lines, a missing README row, and a status line to the operator that gave W04's
reason wrongly (it is asked before the first-content test, over blank lines). The `b63fafc` and `ac4f555` messages stay wrong.
(3) I set the sweep lens too wide (148 shapes, no minute limit): it ran about 1 h 15 min at load up to 196 and I had to ask it to stop. (4) Disclosed: the helper-level equivalence rows passed on arrival (their RED is a surviving mutant), as
did the 13 `findHeadings` rows (answers from the parent).
**Known residuals (filed or stated):** the clock rows' use sites (a limit multiplied by 1,000 or a loop of 20 asks in the repeat row) are not pinned; `htmlCommentOpenAt(NaN)` after a read answers the stale state (unreachable);
`governingMetadataContent` runs 2 to 3 times per scan (12% at 64,000 blocks, not filed);
the S322 sweep item (BACKLOG); `test:integration` NOT run.
**TDD:** RED before GREEN for the 11 document rows (fail on the parent for the right reason, time) and for the review's kill rows (8 of 11 mutants shown SURVIVING with the runner before the rows, killed after; H17, H22 and H23 already
died on one assertion each and now have named rows).
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 5 agents in 1 workflow (the review: 345 tool calls, about 2 hours of wall time), about 100 mutant runs of mine, 0 quarto renders.

## Session 320 Handoff Evaluation (by Session 321)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`34d6c00c`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`), the baseline
(11,776 in 90 files), the real-document score (2423 of 2438) and the plan's key count (221) all held at Phase 0, and the picker the plan ranked was accurate.
**Helped:** gotcha 7 (clock rows flake under load): three `qmd-model.test.ts` rows failed at load 97 in the baseline, I named it and re-ran the file alone; gotcha 8 (the worker and the worktree are not mine): untouched; gotcha 3 (the
runner tests the COMMITTED tree, the list gate reds): it caught a comment of mine that quoted a constant's line; gotcha 6 (count rows from `vitest list` titles, parent failures by running HEAD's tests against the parent's source) is
how I counted the rows and the 68 new tests; gotcha 4 (three mechanisms) named this one at once.
**Missing:** (a) the candidate list left out B89's own remaining parts (6a) and (8), which the plan's done criterion names: the next picker must offer them; (b) the item said "profile first, its numbers are one session's": they held
(43 / 161 / 628 ms against my 42 / 156 / 614) and what broke was my own load-60 figures, which the handoff could not know, but it did not say to time at a quiet load; (c) that a `fig-` or `tbl-` label on a cell with no code is dropped
by the no-target rule, so behaviour rows need `lst-`: I met it as an empty answer.
**Wrong:** (a) gotcha 2 (the SITES table, "append a new site last") did not apply: one site with its own file was cheaper and needed no seed order; (b) `refs.ts:502` was at line 512 once my import and helper sat above it (a position at
a commit, not an address, as Session 320's own evaluation said). **ROI: high.**

## Session 321 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the site firsthand before reading code (42 / 156 / 614 ms at 8,000 / 16,000 / 32,000 blanks, 3.9x per doubling, 5.98 s at 100,000), so the RED rows were built on a real shape: 6 of the 7 new document rows fail
on the parent at 6.0 to 6.8 s against a 1 s limit and the control passes. The old spelling is the oracle (three enumerations of 488,281 / 137,257 / 299,593 strings, counts also taken with Python's `re`; 100,000 seeded texts; every
UTF-16 code unit), an 800,000-document parent-versus-fix differential found no difference with its controls visible, and the 14 mutants were all killed. I read my own mutant C13 as a survivor by reasoning before the runner could, and
added the list-item rows. The review round (4 lenses, 973,248 subagent tokens) was held to firsthand checking: I re-timed the numbers it questioned (mine were load-60 figures), ran its mutants through the project's runner (17 survive
RED, 17 killed GREEN), re-measured the cost it reported (4 times the old search on a trailing run) and the cold-start fact before writing either down. The list gate caught my one comment that quoted a line.
**Went wrong.** (1) My pins were incomplete for the SEVENTH set in a row (Learnings 773, 776, 780, 788, 793): the consumer lines (the fold and the compare) and the new file's own constants and alphabets had no row, 17 mutants survived,
and the sentinel row that three earlier describes carry was missing from the new file (Learning 798). (2) Text I wrote was wrong in five places: a load-60 timing and an impossible pair (1.6 s at 32,000 and 6 s at 100,000) in two
comments, `trimEnd()` said to strip U+0085, a title that said the long answer equals the short one, the C06 and C14 descriptions; and the `c38230fb` message says the CRLF rows pin C13 (they do not; history is not rewritten, the ledger
says so). (3) My first behaviour rows used `fig-` labels, which the no-target rule drops, and the first document rows were green only because that rule abstains on a spaced pipe. (4) The comment that corrected a note wrote two
constants' lines out and reddened `mutation-lists-apply` at once. (5) Disclosed: the helper-level equivalence rows could only be RED as a missing export, not for the right reason.
**Known residuals (filed or stated):** the document rows' limit is pinned by a sentinel, not by its use (a row weakened tenfold survives, only vitest's 5 s timeout would fail it); `run.py` cuts a failing title at 160 characters;
`ATX_CLOSING_PANDOC` and `TABLE_RULE_ROW`'s stack overflow (unchanged); `test:integration` NOT run.
**TDD:** RED before GREEN for the 6 document rows and the 5 near-miss clock rows (fail on the parent for the right reason: 5,986 ms against 1,000). Passed on arrival, disclosed: the 14 fixed rows, the enumerations, the seeded sample
and the 31 behaviour rows compare the old spelling with itself or pin what must not change (their RED is a surviving mutant; the helper-level ones were RED only as a missing export). The review's additions: 17 of 17 mutants shown
SURVIVING with the runner before the rows, killed after.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 4 agents in 1 workflow (the review: 973,248 subagent tokens, 352 tool calls, about 1.7 hours), about 90 mutant runs of mine, 0 quarto renders.

## Session 319 Handoff Evaluation (by Session 320)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`9bac0078`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`),
the baseline (11,657 in 89 files, on two of three runs: the first failed a clock row at load 7), the real-document score (2423 of 2438, identical on the parent and HEAD) and the plan's key count (221) all held at Phase 0, and the picker the plan ranked was accurate.
**Helped:** gotcha 2 (the runner SKIPS a mutant whose `from` is gone, the gate reds): I rebased R01 to R07 when I respelled a line and the gate caught a rename of mine; gotcha 3 (the table: V8 first, then Python) is how both sites got their counts, though the helper
scripts were gone and I wrote them again; gotcha 4 (the lookahead idiom is exact only when the tail may be empty; touching runs need a restructure) told me at once that neither fit `ATX_CLOSING`; gotcha 6 named the load-flaky clock rows and one flaked, so I named it
and re-ran the file alone.
**Missing:** (a) that a new site's seed is its POSITION in the table: "a new site is one entry plus five pinned counts" is true only at the end, and a mid-table entry failed five unrelated seeded rows (Learning 791); (b) that part (4) was a sample again:
`TABLE_RULE_ROW` had a second quadratic (the grid body) beside the one the
item named, and the knitr strips were quadratic on shapes the item did not name; (c) the gotcha about the Write and Edit tools turning an escape into a raw U+2028 was given and I hit it twice anyway (once in `src/`, once in a commit
message): a gate was the answer, not a note.
**Wrong:** (a) "`ATX_CLOSING` and `render-args.ts:78` need a profile" was right, but the whole of `render-args.ts:78` was reachable only through the output of a render, a fact the item did not say; (b) `key_files` line numbers had drifted by the time I read them
(they are positions at a commit, not addresses). **ROI: high.**

## Session 320 Self-Assessment

**Score: 7/10.**
**Went right.** I timed each named site firsthand before reading code, so the item's list was corrected early: `TABLE_RULE_ROW` held two quadratics, the strips four shapes, and `parseOutputPath` is real and unlikely. The deliverable is checkable on the committed
tree: 24 of the 118 new rows fail on the parent
(19 document rows at 6.1 to 20.8 s, four table-entry rows, one clock row) and pass in milliseconds on HEAD; the old spelling is the oracle at all five sites; I compared the committed patterns exhaustively (`TABLE_RULE_ROW` 883,708,281, 153,391,689, 39,089,245 and
1,227,133,513 strings, `ATX_CLOSING`
48 and 21 million, counts also taken with Python's `re`) with no difference; the real-document score is identical. I put the research agents on pinned worktrees and ran my own comparer on my own patterns instead of trusting theirs. The review round (5 lenses,
1,454,540 subagent tokens) was held to firsthand
checking: I reproduced the later-cell dash run (120 / 483 / 1,932 ms), the pipe in `acceptedTails`, the separators in a commit message and the parent counts before acting. Learnings 790 to 796.
**Went wrong.** (1) My pins were incomplete for the SIXTH set in a row (Learnings 773, 776, 780, 788): the mutation lens found 19 real source survivors (a class that admits a character no alphabet holds, a dash run after a pipe, nine `parseOutputPath` shapes) and 28
of 38 test-file mutants, kinds (d) and (e) of my own
Learning 788. (2) Records findings against me, 14: a count taken with a title filter ("20 of the 44"), "four patterns and two strips" (five sites), an "exhaustive" claim about comparers that ran the agents' own spellings, K03 to K06, a timing without a size, three
timings of which one reproduced, a comment that said a pipe ends neither body,
and raw separators in a commit message. Several of those sit in commit messages I did not rewrite (the ledger lists them). (3) Harness traps again: a mid-table insert moved five seeds, an oracle ran 53 s on accepted lines, the Edit tool wrote raw separators, a clock
row hung at 200,000 characters (I killed my own orphan worker only),
T14 survived and T19 was argued equivalent and is not. (4) A simplify finding made me rename constants and the mutation-list gate reddened on Session 319's mutants at once; I reverted and wrote down why (Learning 796). (5) Scope: five sites, three gates and eight fix
commits for one "part": I judged it one deliverable (one cause, one capability, plan: B89 part (4)) and the review fixes part of it; the operator may weigh that.
(6) The review's polish notes S6 (the compare loop is copied a seventh time), S8 (a seed beside its counts) and S10 (magic divisors) are NOT done; the plan says so.
**Known residuals (filed or stated):** `ATX_CLOSING_PANDOC`'s `#` and backslash runs (BACKLOG, S318 item part (2)); `TABLE_RULE_ROW`'s stack overflow at 1,525,196 cells (unchanged); the three polish notes; `test:integration` NOT run.
**TDD:** RED before GREEN for every document row and the two table entries' clock and guard rows (24 fail on the parent, shown). Passed on arrival, disclosed: 94 of the 118 new rows compare the old spelling with itself or pin what must not change (their RED is a
surviving mutant). The review's additions were shown surviving by the lens's runner, not re-run by me on the earlier tests
(I reproduced the later-cell dash run's cost); each is killed now (21 new mutants, the other 55 re-run). **Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 9 agents in 2 workflows (the review: 1,454,540 subagent tokens, 507 tool calls,
about 2.2 hours; the research workflow's tokens were not recorded), about 150 mutant runs of mine, 0 quarto renders.

## Session 318 Handoff Evaluation (by Session 319)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`c20e473d`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`),
the baseline (11,403 in 86 files), the real-document score (2423 of 2438, identical on the parent and HEAD) and the plan's key count (221) all held at Phase 0, and the picker the plan ranked was accurate.
**Helped:** gotcha 3 (the lookahead idiom does not travel, Learning 779) decided the session: `ATX_HEADING` needed a different spelling and the enumeration found it in minutes; gotcha 4 (`scanRegions` memoizes two texts, time a bare `exec`) shaped every row;
gotcha 5 named the load-flaky clock rows, and three of them flaked at load 61, so I named them and re-ran the files alone; `fence-run-equivalence.test.ts` was the template for the table; Learnings 779 to 782 were all used; the runner README's commands were exact.
**Missing:** (a) that the B89 list was a sample: four of its named shapes were linear or unreachable, two mechanisms were not named (touching runs, a key with no terminator), and the `echo`/`include` reader was filed twice (B89 and the Session 318 item (8));
(b) that Session 318's own respelling retired 15 of its mutants (`DIV_FENCE`) and 11 of Session 316's (`INDENTED_CELL_FENCE_OPEN`): the runner SKIPS them, the README rows said 'all killed', and nothing noticed for two sessions;
(c) that the sweep's harnesses are untracked, so the table's generator had to be written afresh (plan rule P5 was named and followed).
**Wrong:** (a) README rows 'about 2 minutes ... 32 killed and 4 survives' were no longer true after the respelling; (b) 'one-line cure' for `DIV_FENCE`'s blank tail was right for that site and read as a family rule, which Learning 779
itself says it is not. **ROI: high.**

## Session 319 Self-Assessment

**Score: 7/10.**
**Went right.** The deliverable is checkable on the committed tree: 55 document rows fail on the parent at 5.5 to 22.3 s (median 6.0 s) and pass in milliseconds; the old spelling is the oracle for all 15 patterns and the strip (counts also taken with Python's `re`);
a 730,000-document parent-versus-final differential found no difference; `findHeadings` over 3,382 authored documents takes 1,022 ms on the parent and 1,028 ms now; the real-document score is identical (2423 of 2438).
I measured before reading code (bare `exec` at three sizes, then six read-only agents), so the item's list was corrected early: 15 patterns, four named shapes linear, two unnamed mechanisms (touching runs; a key needing no terminator, cubic with the tail).
The review round (4 lenses, 1.49 million subagent tokens, 20 billion comparisons with no difference) was held to firsthand checking: I reproduced every finding before acting, re-timed ten of the critic's shapes, and ran the reviewer's 102 survivors
against the new tests (51 killed, the rest argued equivalent or needing the whole suite).
It left a gate (`mutation-lists-apply.test.ts`: RED on the stale lists, GREEN after the rebase). Learnings 783 to 789.
**Went wrong.** (1) My pins were incomplete for the FIFTH set in a row (Learnings 773, 776, 780): the mutation lens found 43 survivors in a table I called complete (a fourth call site with no row, a cap anywhere but the first run, a long run after a shorter beginning,
classes no alphabet composed, helpers with no test). (2) Harness bugs of mine: `names.sort()` moved a seed, an accepted-lines list the old spelling refused ran 313 s, Python's `\s` differs, and the Write tool put two raw separator characters into
`hash-comment.ts` (the mutation-list generator found it, not I).
(3) Records errors the review found: the delimiter-row comment put 18 s on a pattern that accounted for 6, B02's reason was false, counts that did not add up (49, 48, 52), '8.2 million' for 4.9, 730,000 documents with one run not saved to a file, '89
ms' beside '11 s'; three of those sit in commit messages that I did not rewrite.
(4) The document differential saw 4 of its 6 control mutants and two of my first six controls were bad (one equivalent): I reported what it cannot see instead of tuning it.
(5) Scope: 15 patterns, a helper, a gate for the lists and 77 + 51 mutants for one 'part'; I judged it one deliverable (one cause, one capability, plan: 'B89 (5), (9) share a cause') and the gate a review fix, and say so for the operator to weigh.
(6) The session ran about 14 hours of machine time; several 'have not heard from you' nudges drew a status line each, and two zsh loops failed on word splitting (my own gotcha, hit twice).
**Known residuals (filed or stated):** the new item (BACKLOG line 92); `TABLE_RULE_ROW` and the two `[ \t]+#.*$` of `knitrDocumentDefaults` (part (4)); table weakenings the table cannot see in itself (a removed `expect`, a removed shape); fourteen
call-site edits that need the whole suite; `test:integration` NOT run.
**TDD:** RED before GREEN for every document row (all 55 fail on the parent, shown per slice; 8 slices had several sites red together before their fixes, disclosed). Passed on arrival, disclosed: the equivalence rows (RED = a surviving mutant), the
helper's self-test, the strip's enumerations, the invariants rows;
the review's additions were each shown RED as a surviving mutant and killed.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 10 agents in 2 workflows (3,101,796 subagent tokens, 1,112 tool calls, about 5.5 hours), about 290 mutant runs, 0 quarto renders (the realdoc score and the oracle used the cached corpus).
