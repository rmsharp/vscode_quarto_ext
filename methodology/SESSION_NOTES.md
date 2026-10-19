# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 324 closed out.** g02's eighth session is done: the S317 item's part (1), the exponential `ATTR_ATOM_RUN`, is closed. It is the atom grammar factored (dashes, one class, then ids): `git diff d9be8ec HEAD -- src`.
The parent took 7.4 s warm at 30 classes and 12.3 s for 100,000 dashes after an id; now 3 ms and 10 ms. The old alternation is the oracle (`attr-atom-run-equivalence.test.ts`, 85 tests; 3.04 million strings, counts from `tools/attr-atom-count/`).
50 mutants: 46 killed, 4 argued equivalent. The five-lens review found no wrong answer, four mutants every row let through (all killed now) and wrong statements in text (fixed in files).
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows four and a catch-all):
(a) the S317 item's part (2): a long `# ` heading of backticks, `[`, `{` or a backslash is quadratic in `headingContentRefused` (first in table order; profile first, Learning 739); (b) the same item's part (3), the native-div check in `indexLabels` (profile first);
(c) the S318 item's part (9), a long paragraph under `from: gfm`; (d) the S319 item's part (1), consecutive container-column lines (a long definition list); the S322 item's part (1) and the S317 stack overflows (4) to (9) follow.
After those, the terminal bounded session files ONE RESIDUAL record and stops the sweep (the plan's done criterion). Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) The runner tests the COMMITTED tree, copies `--tests` once, and SKIPS a mutant whose `from` no longer occurs once. `mutants/s317-attr-atom-run.json`: 50, 46 killed, E01 to E04 survive on purpose; about 25 minutes (nine timeouts); command in its README row.
(3) Quote a timing with its load AND its state: cold (the first run of a pattern in a process, interpreted) is about 10x slower than warm (4,326 ms against 455 ms at 26 classes). Size a RED row from the WARM figure, controls first (Learning 816).
(4) Pins: the TENTH set was incomplete (815): for each loop of a linear cure, a row that repeats the body ending in each character its tail already holds. Compare a mutant that claims to keep the language with the base on an enumeration FIRST.
(5) Give a review lens a number of TOOL CALLS and a `ps` check, not minutes (819): five lenses took 27 minutes and 200 calls. Run an agent's claim about a mutant before building a row on it (818).
(6) Unchanged residuals: the ids are still a group, so about 3.36 million ids (`#a`, 6.7 MB) throw `RangeError` (S319 item part (5), boundary bisected); `ATX_CLOSING_PANDOC`, `HEADING_ATTRIBUTE`, `braceGroups` quadratics (filed); nested-value entries own full-depth paths.
(7) Plan rule P5 (a tracked sweep generator under `tools/` from the first session on the filed items) was NOT met: only seeded samples in the equivalence test and the counting script. Ask the operator who owns the sweep's unrun 68%: the next session or the terminal one.
(8) Clock rows flake under load, more than one: `qmd-model.test.ts` Session 307 and 308 rows (2,045 ms against 2,000; one failed in a lens's run at load 20 to 37). Name them, re-run the files alone, never loosen. This session's full runs (load 19 and 26) passed.
(9) The Session 314 vitest worker group (pid 84774, cwd a `wt314` scratch worktree) is STILL spinning at 100% CPU after 3 days 21 hours: not mine; ask before killing it. The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is not mine either.
(10) `test:integration` NOT run for fourteen sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 12,088 tests in 95 files, clean.
(11) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session.
(12) The plan: update its status column and "Current position" at each close-out; its key count command (`sed -n '/^## Where each key went/,$p' ... | grep -o 'B[0-9]\+' | sort -u | wc -l`) prints 221 (filed items carry no key).
(13) The Write and Edit tools turn a backslash-u escape for U+2028 into the raw character (Learning 792). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices, edit with a Python script.
macOS `sed` rejects `|` as a delimiter and `sed -i` needs `''`. After answering a direct question, STOP and wait (memory).

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

## Session 323 Handoff Evaluation (by Session 324)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`5f628c7`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`), the real-document score (2423 of 2438), the plan's
key count (221) and the baseline (11,981 in 94 files; 12,002 after my 21 rows) all held, and the picker the plan ranked was accurate: it offered the S317 item's part (1) first, as finishing a feature.
**Helped:** candidate (a) said "time it COLD" and that the BACKLOG figures are warm: my cold figures (276 / 1,094 / 4,326 ms at 22 / 24 / 26 classes) matched the item's cold ones (285 / 1,138 / 4.5 s) before any code was read; gotcha 2 (the runner tests the COMMITTED
tree, skips a stale `from`) made me commit
before each mutant run; gotcha 3 (a timing is a fact about a load) put a load beside every figure; gotcha 12 (a review round is not bounded by its brief; check `ps`) is why this round was briefed a tool-call budget and took 27 minutes against 6.0 hours; gotchas 1 and 13
(exact paths; the U+2028 trap) held; gotcha 9 (the worker and the worktree are not mine) held.
**Missing:** (a) that the item's part (1) is wider than it names: an id before the classes costs twice as much, a dash after each class has three splits a boundary, and a run of dashes after an id or a class is QUADRATIC (12.3 s at 100,000), on seven routes; I found it by
measuring, the item said only the class shape;
(b) "set a test's clock limit from the cold figure" points the wrong way for a row in a file of many (a pattern warmed by an earlier row runs about 10 times faster: Learning 816); (c) that the plan's rule P5 makes the first session on a filed item commit a tracked sweep
generator under `tools/`: the handoff offered the item without saying so, and I met the rule only in part.
**Wrong:** the item's "74-byte line" is not the shape the rows time (68 bytes): the item's figure, not the handoff's, but I copied it into four places before the records lens corrected it. Nothing else I could find in the claims I checked. **ROI: high.**

## Session 324 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the site firsthand before reading code, cold and warm and by doubling (276 / 1,094 / 4,326 / 17,230 ms; 455 ms warm at 26), and the timing found what the item had not named (an id first, three splits a boundary, a quadratic dash run, seven routes).
The 12 refused-shape rows were run on the unmodified tree and failed on the clock alone
(3.7 to 12.3 s against 1,000 ms, answers equal, 7 controls passing) in a commit of their own BEFORE the cure. I derived the language as its shape and proved it three ways that share nothing: enumerations counted by a recogniser with no regex (now tracked), the review's
product walk of two automata with 58 million of its own strings, and 120,000 documents end to end.
The review round was held to a tool-call budget and every claim I acted on was checked firsthand: I reproduced M01 with the runner (A39 to A42 SURVIVE), refuted the design lens's claim about a bare `(?:-)*` by running it (a capture `(-)*` and a lookahead are what throw at
9,000,000 dashes), bisected the stack boundary (3,340,000 answers, 3,360,000 throws; `.A#a` shifts by one),
showed that the `#a.A` row alone kills A43, and re-checked each records finding against the files.
**Went wrong.** (1) The TENTH set of pins was incomplete (Learnings 773, 776, 780, 788, 793, 798, 802, 807; 815): four language-preserving mutants of the id loop survived every row after 43 mutants of my own, and the mutation lens found them, though the handoff's gotcha 4
said to expect it. (2) Text I wrote was wrong in several places: "74-byte" in four places (the item's figure, never re-run), a "by luck" example that is false,
"the first five rows" for six, a row title that read backwards, "about 8 s" for 7.4 to 7.6, and "55 hand-stated tokens" for 56 in the `15a8a04` message (stays). (3) My first draft of the replacement mutants A40 to A43 dropped the `+`, so four changed the language and were
killed for the wrong reason; the runner's table showed it. (4) TDD deviations, disclosed: the equivalence file landed after the cure and passes on arrival
(its RED is a mutant: A00 and A07 hang), the 9,000,000-dash row passed on arrival (A44 is also killed by the group comparison of the older rows; A45 was NOT shown surviving before the row), and the document rows were sized from my own warm figure, not the item's cold one.
(5) Plan rule P5 was not met: no sweep generator under `tools/`, only seeded samples and the counting script (stated; the operator decides who owns the unrun 68% of the sweep).
**Known residuals (filed or stated):** the ids are a group, so about 3.36 million of them throw `RangeError` (S319 item part (5)); `headingAttributeTokens` builds a token a character at a time (115 bytes resident a character, the lens's figure); the commonmark arm of
`atoms` is unobservable (B03); the call-site mutants were not run (the design lens showed 3 call-site kills); `test:integration` NOT run.
**TDD:** RED before GREEN for the 12 refused-shape document rows (`047b5fa` before `8432555`); for the review's additions, 4 of 4 id-loop mutants shown SURVIVING with the runner before the five rows and killed after (A43 was already killed by the `#a.A` row). Passed on
arrival, disclosed: the equivalence file, the 9,000,000-dash row, the 7 controls.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 5 agents in 1 workflow (923,678 subagent tokens, 200 tool calls, about 27 minutes), about 115 mutant runs of mine, 0 quarto renders.

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
