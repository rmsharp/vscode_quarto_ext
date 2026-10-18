# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 319 closed out.** g02's third session is done: B89 parts (5) and (9) are closed. Fifteen patterns in five files and a ` #` strip with three call sites no longer retry a blank run (`git diff 6ea0db00 HEAD -- src`).
The old spelling is the oracle in `test/unit/blank-tail-equivalence.test.ts`; 55 document rows fail on the parent (5.5 to 22.3 s against a 1 s limit).
The review round found no semantic difference (20 billion comparisons), 43 test gaps and a dozen records errors: all fixed. It left a gate (`mutation-lists-apply.test.ts`) and a new BACKLOG item (line 92).
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight (estimate 11 sessions plus 3 to 5, 2 to 4 and 2 to 4 for the three filed items: none is in the plan's totals). Candidates the picker can offer:
(a) B89 part (4): `TABLE_RULE_ROW` takes `PIPE_DELIMITER_ROW`'s new spelling, the two `[ \t]+#.*$` in `knitrDocumentDefaults` take `cutHashComment` (finishing a feature); `ATX_CLOSING` and `render-args.ts:78` need a profile;
(b) the S317 item's part (1), the exponential `ATTR_ATOM_RUN` (the one hang); (c) the S318 item's part (9), a long paragraph under `from: gfm`; (d) the S319 item's part (1), consecutive container-column lines. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) `run.py` SKIPS a mutant whose `from` no longer occurs once; `mutation-lists-apply.test.ts` now reds `npm test` for it. After editing a line a list quotes, rebase the list (Session 319 found 26 retired mutants). The runner tests the COMMITTED tree.
My lists: `mutants/b89-blank-tail.json` (51) and `b89-blank-tail-review.json` (77); the README rows have the commands. S317's two `b88-thematic-break*.json` lists are still not in the README table.
(3) `blank-tail-equivalence.test.ts` is a TABLE (`SITES`): a new site is one entry plus five pinned counts. Take them from V8, then check the three enumerated ones with Python's `re`.
In Python `.` is `[^\n\r\u2028\u2029]`, `$` is `\Z`, and JavaScript's `\s` needs its own class; the helper scripts were in the scratchpad and are gone.
(4) The lookahead idiom is exact only when the tail may be empty (Learning 783); two touching runs need a restructure (Learning 784). zsh does not word-split a string variable: pass arguments explicitly (it bit twice).
(5) Clock rows flake under load: Session 308's "is linear: 200,000 lines" and Session 311's closer index both failed once at load 61. Name them, re-run the file alone, never loosen. The new rows allow 1 s a document and 100 ms an `exec`.
(6) The Session 314 vitest worker (pid 84774) is STILL at about 99% CPU after 1 day 8 hours, 889 MB: not mine; ask before killing it. The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is not mine either.
(7) `test:integration` NOT run for nine sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 11,657 tests in 89 files, clean.
(8) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; the parent is identical.
(9) The plan: update its status column and "Current position" at each close-out; its key count command (`sed -n '/^## Where each key went/,$p' ... | grep -o 'B[0-9]\+' | sort -u | wc -l`) prints 221 (filed items carry no key).
(10) The sweep's harnesses (`scratchpad/s319/`) will be gone: the first session on the filed items commits a seeded generator under `tools/` (plan rule P5). The Write and Edit tools can turn a backslash-u escape into the raw character: `xxd` the line (Learning 786).
`BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices. macOS `sed` rejects `|` as a delimiter. After answering a direct question, STOP and wait (memory).

### What Session 320 Did
**Deliverable:** g02 of the backlog ordering plan, fourth session: B89 part (4), the closing-run and rule-row patterns: `TABLE_RULE_ROW`, the two `[ \t]+#.*$` of `knitrDocumentDefaults`, `ATX_CLOSING` and `render-args.ts:78` (IN PROGRESS)
**Started:** 2026-10-17
**Status:** Session claimed. Work beginning. Strict TDD: time each named site firsthand before reading code (the item's list was a sample three sessions running), a RED doubling row per site, then a rewrite proved identical to the old pattern.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

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
