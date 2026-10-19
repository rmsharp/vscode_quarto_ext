# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 323 closed out.** g02's seventh session is done: B89 part (6a) is closed. `nestedParentPath` builds each container's chain once and keeps it in `index.chains` (`git diff 236624d HEAD -- src`);
3,200 levels cost 10.5 s before and 0.5 s after (load 8 to 10), linear in the text. The old climb is the oracle (`container-chain-equivalence.test.ts`, 50 tests) and the work is pinned as lines READ (400, against 160,400 on the parent).
45 mutants: 41 killed, 4 argued equivalent. The six-agent review found no wrong answer, 15 source edits the pins let through (all killed now) and 12 wrong statements in text (fixed in files).
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows four and a catch-all):
(a) the S317 item's part (1), the exponential `ATTR_ATOM_RUN` (the one hang; time it COLD; first in table order); (b) the S318 item's part (9), a long paragraph under `from: gfm` (a mid-document `from: gfm` triggers it too);
(c) the S319 item's part (1), consecutive container-column lines (a long definition list: likely in a real document); (d) the S322 item's part (1), `inQuartoYamlRegion` asked per cell option line (cells x regions).
After those, the terminal bounded session files ONE RESIDUAL record and stops the sweep (the plan's done criterion). Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) The runner tests the COMMITTED tree, copies `--tests` files from the working tree ONCE at its start, and SKIPS a mutant whose `from` no longer occurs once (`mutation-lists-apply.test.ts` reds). `mutants/b89-container-chain.json`:
45, 41 killed, C03 C07 C08 C19 survive on purpose, about 11 minutes with the four test files named in its README row. A kill row is shown RED by running the new mutants against the OLD tests first.
(3) Quote a timing only with its load: the machine sat at load 10 to 50 for days and a set moved by 25% (the parent at 3,200 levels: 8.3 s at load 40, 10.5 s at load 8). Quote ranges, name the load, recompute a rate from the table (Learnings 797, 805).
(4) Pins: the NINTH set was incomplete (807). Rows that carry strings need long, mixed-case, quoted, empty and no-break-space-ended text and a size past every cap; a comparison loop needs a wrong-oracle row and its `asked` count (809);
a read bound needs the exact count, derived and then checked by the run (810); a clock limit goes between the two measurements (811); a cache passed in is pinned by counting calls, in a file of its own (808).
(5) `index.chains` is a snapshot of the `lines` it was built from (812): a caller that edits lines in place must build a new index. The one caller builds a fresh index per call. The completion path (`nestedKeyContextAt`) has no index and keeps the old climb.
(6) Unchanged residuals: every emitted entry owns a full-depth path array (an 800-level trunk with 64,000 siblings needs a 512 MB old space; caching keys on the chain link would share them); `ATX_CLOSING_PANDOC`'s `#` runs and `TABLE_RULE_ROW`'s stack overflow (BACKLOG).
(7) Clock rows flake under load, more of them than one: a full run read 2,045 ms against 2,000 (`qmd-model.test.ts`, Session 308), and the last full run on HEAD failed 4 (Sessions 307, 308 x2, 322) that passed alone twice.
Name them, re-run the files alone, never loosen. The nine Session 323 rows allow 2,500 ms and passed every full run.
(8) The Session 314 vitest worker (pid 84774, cwd a `wt314` scratch worktree) is STILL spinning at 99% CPU after 3 days 10 hours: not mine; ask before killing it. The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is not mine either.
(9) `test:integration` NOT run for thirteen sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 11,981 tests in 94 files, clean apart from the load flakes in (7).
(10) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session.
(11) The plan: update its status column and "Current position" at each close-out; its key count command (`sed -n '/^## Where each key went/,$p' ... | grep -o 'B[0-9]\+' | sort -u | wc -l`) prints 221 (filed items carry no key).
(12) A review round is not bounded by its brief: six agents briefed at about 30 minutes a lens took 6.0 hours at load 4 to 52 (1,561,995 tokens). Send a wrap-up message at the limit and check `ps` and `lsof -d cwd` after; this time nothing was left.
(13) The Write and Edit tools turn a backslash-u escape for U+2028 into the raw character, in files AND in commit messages (Learning 792). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices.
macOS `sed` rejects `|` as a delimiter and `sed -i` needs `''`. After answering a direct question, STOP and wait (memory).

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

## Session 322 Handoff Evaluation (by Session 323)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`0aa0593`, gap 0), no `pending` receipt, the ratchet citation (2/2, results
`bba236856bad`), the real-document score (2423 of 2438, unchanged by this session), the plan's key count (221) and its gotcha 8 (the `qmd-model.test.ts` Session 308 row flakes under load: it read 2,045 ms
against 2,000 in a full run here) all held, and the picker the plan ranked was accurate: it offered B89 part (6a) first, as finishing a feature.
**Helped:** candidate (a) said "re-measure first": 1,203 ms at 1,600 and 8,262 ms at 3,200 levels (load 40) against the item's 1.2 s and 8.5 s, before any code was read, and a profile that gave 36 / 36 /
9% against the item's 71% in two regexes; gotcha 2 (the runner tests the COMMITTED tree; the list gate reds on a stale `from`) is why I grepped the list before renaming `above` to `up` and fixed three
texts in the same commit; gotcha 3 (quote a timing with its load, recompute a rate from the table, Learnings 797, 805) put a load beside every figure; gotcha 6 (count rows from titles, parent failures by
running HEAD's tests against the parent's source) is how I counted the 14 failing rows on the parent; gotcha 8 (the worker and the worktree are not mine) held and the worker is still there.
**Missing:** (a) that "a memo of the rooted key path per content line" is the wrong shape if it is read as an array per line: the simplify lens measured it at about 12 times the text in heap and 10 times
slower on a deep staircase, and a linked chain was the cure, so the handoff's one hint about the cure pointed at the costlier spelling; (b) that the nested-value path has a second, unindexed caller (the
completion path), which a cure must leave alone and a test must still cover; (c) that bounding a lens by minutes in the brief does not bound it: gotcha 13 says to check `ps` after, and six agents briefed
at about 30 minutes a lens took 6.0 hours.
**Wrong:** nothing I could find in the claims I checked; the BACKLOG item's "6.3 s in the reader" for the trunk shape read 5.2 to 7.0 s here (load moves it; I wrote the range). **ROI: high.**

## Session 323 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the site firsthand before reading code (22 / 48 / 202 / 1,203 / 8,262 ms at 200 to 3,200 levels, load 40: the item's numbers held), profiled it (36 / 36 / 9%), and wrote the nine
clock rows and ran them on the unmodified tree before the cure: 9 failed at 5.3 to 16.4 s with the control passing (transcript 2026-10-18 19:06 to 19:08, the cure's commit is 19:13). The cure is linear
(3,200 levels 10.5 s to 0.5 s at load 8; the last doubling costs 3.5 times for a text that grows 4.0 times). The old climb is the oracle (three enumerations and a seeded set; the enumerations' counts taken
again with a Python port, the seeded one with the real parent function) and the cost is pinned as lines READ (400 against 160,400). The review round (6 agents, 1,561,995 tokens) was held to firsthand
checking: I ran its 15 source gaps through the runner against the OLD tests (0 killed) and the new rows (15 killed), re-ran its test-file and call-site edits (11 of 19 killed, 8 left as harness edits with
no consequence), derived three `asked` counts by arithmetic before the run, re-timed the nine rows at load before moving a limit (276 to 717 ms), confirmed the TDD order in the transcript, ran the new
tests against the parent source in a throwaway worktree (14 fail) before writing the count, and declined the simplify lens's merge of the two branches and its cast-free loop, with reasons.
**Went wrong.** (1) My pins were incomplete for the NINTH set in a row (Learnings 773, 776, 780, 788, 793, 798, 802, 807): 15 source edits survived (key text, near-miss root names, the empty key, a path
past 4,096, the dropped index) after 30 mutants of my own, and `compareAsks` could not fail. (2) Text I wrote was wrong in 12 places in files and messages ('about 80,000 reads', '8.2 to 16.4 s', '25
killed, 4 argued', 'a six-level staircase', 'the line above', the pure-mapping definition, 'never given an index', C24's `why`, a comment on `nearestShallowerLine`, a README row missing), and in one
derivation of mine (a read count of 399; the run said 400). The `fce6996`, `b512ccd` and `3880377` messages stay wrong. (3) The clock rows' 1,000 ms limit left 1.4 to 1.9 times of headroom for the slowest
row: I picked a round number above the fix instead of measuring both sides (the critic found it; 2,500 ms now). (4) TDD: the nine clock rows were RED on the unmodified tree but landed in ONE commit with
the cure, so the commit order does not show it, and the oracle and read-count rows (`b512ccd`) were written after the cure (their RED is the parent run: 14 of 50 fail; the enumerations pass on the parent
by construction): a deviation to flag, not hide. (5) A review round briefed at about 30 minutes a lens took 6.0 hours of wall time at load up to 52 and 1.56 million tokens, and I did not cap it with a
message as Session 322 did.
**Known residuals (filed or stated):** the completion path keeps the old climb; per-entry path arrays (512 MB old space for 64,000 siblings under an 800-level trunk); `index.chains` staleness (stated,
unreachable); the unindexed branch is a copy of the climb (simplify S1, declined); eight harness-edit survivors (T08 to T10, T16, T20, T24, T26, T27); the clock rows' use sites (a limit multiplied, a loop
shortened) are not pinned; `test:integration` NOT run.
**TDD:** RED before GREEN for the 9 clock rows (shown on the unmodified tree); for the review's additions 15 of 15 mutants shown SURVIVING with the runner before the rows and killed after. Passed on
arrival, disclosed: the exact read counts and the sentinel rows were written against the correct code (their RED is a mutant: T05, T07, T22, T25 and the call-site edits die on them).
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 6 agents in 1 workflow (the review: 1,561,995 subagent tokens, 324 tool calls, 6.0 hours), about 125 mutant runs of mine, 0
quarto renders.

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
