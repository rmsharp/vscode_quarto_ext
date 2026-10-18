# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 320 closed out.** g02's fourth session is done: B89 part (4) is closed. Five sites (`TABLE_RULE_ROW`, `ATX_CLOSING`, the two knitr strips, `parseOutputPath`) no longer retry a blank run (`git diff 9d0ffbcb HEAD -- src`).
The old spelling is the oracle (`blank-tail-equivalence.test.ts`, the new `output-created-equivalence.test.ts`); 24 of the 118 new rows fail on the parent. 76 mutants: 73 killed, 3 argued equivalent.
The five-lens review found no semantic difference (about 1.52 billion strings), 19 real source survivors, 28 test-side ones and 14 records findings: all fixed except three polish notes (the plan says which).
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight. Candidates the picker can offer:
(a) B89 part (3): `refs.ts:502`, `/[ \t]*$/.exec(...)` over the gap between `#|` and a cell option key (finishing a feature: the unanchored family cured in `ATX_CLOSING`; profile first, the item's numbers are one session's);
(b) the S317 item's part (1), the exponential `ATTR_ATOM_RUN` (the one hang); (c) the S318 item's part (9), a long paragraph under `from: gfm`; (d) the S319 item's part (1), consecutive container-column lines. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) `blank-tail-equivalence.test.ts` is a TABLE (`SITES`) and each site's seed is 319 plus its POSITION: APPEND a new site last (a 19-name row pins the order), add its five counts; the one-code-unit sweep and the leg counts need a row each.
(3) The runner tests the COMMITTED tree and SKIPS a mutant whose `from` no longer occurs once; `mutation-lists-apply.test.ts` reds for it (it caught a rename of mine). My list: `mutants/b89-closing-run.json` (76), about 25 minutes.
(4) Three mechanisms make a blank run quadratic: a lookahead after it cures a retried `(.*)$` (Learning 779); touching runs need a restructure (784); an UNANCHORED search that begins with a quantified class needs a lookbehind guard (790).
For that third kind the oracle is quadratic on an ACCEPTED line too: cap the first run of an accepted-lines list.
(5) The Write and Edit tools turn a backslash-u escape for U+2028 into the raw character, in files AND in commit messages (Learning 792). `src/` is gated; check a message with `git log -1 --format=%B`. Prefer `.` to an explicit class.
(6) Count new rows and rows failing on the parent from `vitest list` titles and a run of HEAD's tests against the parent's source (add only `export`), not from a title filter (Learning 794).
(7) `ATX_CLOSING_PANDOC` is still quadratic on a long `#` run or a backslash run (BACKLOG, the S318 item, part (2)); `TABLE_RULE_ROW` still overflows the regex stack at 1,525,196 cells (unchanged, S317 item part (4)).
(8) Clock rows flake under load: Session 308's "is linear: 200,000 lines" failed once at load 7 in the Phase 0 baseline. Name it, re-run the file alone, never loosen.
(9) The Session 314 vitest worker (pid 84774) is STILL spinning at about 99% CPU (started Thursday 4 PM, 3,000 CPU minutes, 1 GB): not mine; ask before killing it. The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is not mine either.
(10) `test:integration` NOT run for ten sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 11,776 tests in 90 files, clean.
(11) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; the parent is identical.
(12) The plan: update its status column and "Current position" at each close-out; its key count command (`sed -n '/^## Where each key went/,$p' ... | grep -o 'B[0-9]\+' | sort -u | wc -l`) prints 221 (filed items carry no key).
`BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices. macOS `sed` rejects `|` as a delimiter. After answering a direct question, STOP and wait (memory).

### What Session 320 Did
**Deliverable:** g02 of the backlog ordering plan, fourth session: B89 part (4), the closing-run and rule-row patterns: `TABLE_RULE_ROW`, the two `[ \t]+#.*$` of `knitrDocumentDefaults`, `ATX_CLOSING` and `parseOutputPath` -- DONE; claim `9d0ffbcb`
**Started:** 2026-10-17
**Status:** Closed out. Five sites respelled in four commits (`614fd923`, `196fbe47`, `b80e5467`, `a95d49a2`), each RED first (24 of 118 new rows fail on the parent), proved against their old spellings, 76 mutants (73 killed, 3 argued equivalent),
and a five-lens review round whose fixes landed in `36216472`, `e2bc6bea`, `a202a6d6`, `4446237b`, `c8623ef8`, `736c9849` and `a827cf5b`. Nothing new filed. `npm test` 11,776 passing in 90 files; `npm run package` 44 files; real-document score unchanged.
**Ledger:** `CHANGELOG.md` 2026-10-17 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

### What Session 319 Did
**Deliverable:** g02 of the backlog ordering plan, third session: B89 parts (5)+(9), the CR / U+2028 family, a blank run followed by a tail a CR stops -- DONE; claim `6ea0db00`
**Started:** 2026-10-16
**Status:** Closed out. Fifteen patterns and a ` #` strip respelled in nine commits (`ff31f31a` to `280cc912`), each slice RED first (55 document rows fail on the parent), proved against their old spellings (17 table entries, a 730,000-document differential with 0 differences),
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

## Session 319 Handoff Evaluation (by Session 320)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`9bac0078`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`),
the baseline (11,657 in 89 files, on two of three runs: the first failed a clock row at load 7), the real-document score (2423 of 2438, identical on the parent and HEAD) and the plan's key count (221) all held at Phase 0, and the picker the plan ranked was accurate.
**Helped:** gotcha 2 (the runner SKIPS a mutant whose `from` is gone, the gate reds): I rebased R01 to R07 when I respelled a line and the gate caught a rename of mine; gotcha 3 (the table: V8 first, then Python) is how both sites got their counts, though the helper
scripts were gone and I wrote them again; gotcha 4 (the lookahead idiom is exact only when the tail may be empty; touching runs need a restructure) told me at once that neither fit `ATX_CLOSING`; gotcha 6 named the load-flaky clock rows and one flaked, so I named it
and re-ran the file alone.
**Missing:** (a) that a new site's seed is its POSITION in the table: "a new site is one entry plus five pinned counts" is true only at the end, and a mid-table entry failed five unrelated seeded rows (Learning 791); (b) that part (4) was a sample again:
`TABLE_RULE_ROW` had a second quadratic (the grid body) beside the one the
item named, and the knitr strips were quadratic on shapes the item did not name; (c) the gotcha about the Write and Edit tools turning an escape into a raw U+2028 was given and I hit it twice anyway (once in `src/`, once in a commit message): a gate was the answer, not a note.
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
**Wrong:** (a) README rows 'about 2 minutes ... 32 killed and 4 survives' were no longer true after the respelling; (b) 'one-line cure' for `DIV_FENCE`'s blank tail was right for that site and read as a family rule, which Learning 779 itself says it is not. **ROI: high.**

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

## Session 317 Handoff Evaluation (by Session 318)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`f354b542`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`),
the baseline (11,348 in 85 files), the real-document score (2423 of 2438, identical on the parent and HEAD) and the plan's key count (221) all held at Phase 0, and the picker the plan ranked was accurate.
**Helped:** gotcha 2 (the runner tests the COMMITTED tree, the plain `|`): I committed before every list and used `--only` for re-runs; gotcha 3 named the flaky clock row and the rule, and it did flake once, so I named it, ran it alone and left it;
gotcha 6 (the Edit tool drops trailing whitespace) is why I ended every edit on a visible character; `thematic-break-equivalence.test.ts` and its 'Session 317' describe were the template for my equivalence file and document rows
(old spelling as oracle, near-miss lines timed at the pattern level, a gap grid); Learnings 775 to 778 were all used; the worker note (4) was exact and saved a kill.
**Missing:** (a) which patterns: the next-session line said 'the fence patterns' `(.*)$` and `\s*$` tails'. A profile found THREE patterns (`DIV_FENCE` too, which nobody had named) and the `\s*$` tails are linear (measured, flat from 20,000 to 80,000 characters);
(b) the `scanRegions` two-entry memo, which made three of my four entry-point rows pass on the parent; (c) the README table has no row for the two `b88-thematic-break*.json` lists (the receipt names them by a glob).
**Wrong:** (a) the `\s*$` half of part (7) (carried from the Session 311 review, not written by Session 317); (b) nothing else I could find. **ROI: high.**

## Session 318 Self-Assessment

**Score: 7/10.**
**Went right.** The cause was found by profile before any code was read: three patterns, not the item's attribution. The cure (a lookahead after the longest run) is argued, not assumed: the first try is the only one that can
succeed, and the old spelling is the oracle over every string of up to 7 and 5 characters,
100,000 seeded lines and a gap grid, with accepted counts checked by a regex-free Python reader; a parent-versus-fixed differential over 320,000 documents (and the review's 120 million strings per pattern) found no difference,
with a control mutant to show the harness can see one.
22 document rows fail on the parent (5.7 to 12.4 s each) and pass in milliseconds. I ran the new rows against the parent's `model.ts` and found the memo trap myself. I left `DIV_FENCE`'s blank tail to B89 part (5) and measured it
(237 ms at 20,000 blanks, 953 ms at 40,000) instead of widening scope.
Every review finding was reproduced before I acted: 12 gap mutants survived the file I had committed, I wrote the rows, and all 17 are killed. Eight siblings and a quadratic paragraph were reproduced at two sizes and filed; the
performance agent's cause for the last was wrong and a profile corrected it. Learnings 779 to 782.
**Went wrong.** (1) My pins were incomplete for the third session running: answers on ACCEPTED lines were compared only to 1,000 characters, so a `{3,4096}` cap (the obvious other cure) passed everything; the alphabets lacked a
vertical tab and a byte order mark; the oracle table could drift to the new spelling.
(2) I never read the verbose titles of my own it.each: nine rows had three titles, the terminator named nowhere. (3) Several comments were wrong, found by reviewers: contexts 'each call a different pattern' (they reach the same
three sites; a fourth site had no row), a document's 12 s placed beside one pattern, a mid-run '564 of 1,134', a 'shortest string' claim that cannot be true, and a commit message that said 23 rows (22; amended).
(4) The review took about 70 minutes and 1.32 million subagent tokens; its finds were worth it, but my checkpoint 4 declared the pins done before the test lens ran. (5) One full run hit the known clock row; I named it and re-ran
it alone. (6) I did not change the 100 ms clock threshold the test lens flagged: its exposure at load 200 is arithmetic, not measured.
**Known residuals (filed or stated):** the filed item (nine shapes); `DIV_FENCE`'s blank tail (B89 part (5)); the clock-row exposure at extreme load; four argued-equivalent mutants F09, I08, D05, D11 (three guards that read two
characters, one blank guard that changes no answer); `test:integration` NOT run.
**TDD:** RED before GREEN for the 22 document rows (all fail on the parent), the 9 title fixes (the duplicate list shown, then 9 distinct titles), and every review addition (17 mutants survived, then 17 killed, each by the row
meant for it). Passed on arrival, disclosed: the equivalence rows themselves (RED = a surviving mutant, or the missing exports), and the memo-trap rows until I gave each its own text.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 5 agents in 1 workflow (1,322,038 subagent tokens, 506 tool calls, about 70 minutes), about 150 mutant runs, no quarto renders (the realdoc score and the oracle used the cached corpus).
