# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 325 closed out.** g02's ninth session is done: the S317 item's part (2) with the S319 item's part (3), `headingContentRefused` is linear. Each opener asks a per-line `HeadingLine` where its closer is: `git diff 09b0b0f HEAD -- src`.
64,000 backticks took 5.6 s warm, now 4 ms. The old functions are the oracle (`heading-scan-equivalence.test.ts`: 4.3 million strings, 500,000 seeded). 76 mutants: 65 killed, 11 argued equivalent.
A six-lens review found no wrong answer in 2.15 billion comparisons, 22 test gaps (closed here) and nine wrong statements (fixed). One polish item filed: the tables are built at the first question.
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows four and a catch-all):
(a) the S317 item's part (3): the native-div one-line check in `indexLabels` is quadratic (`<div` + `{` x N); the cause is NOT isolated, profile first (Learning 739); (b) the S318 item's parts (2) and (3), `ATX_CLOSING_PANDOC` and `HEADING_ATTRIBUTE`:
now the only slow time on a heading line, a bare backslash run included (it would finish the heading line; the plan's row does not list them: ask which rule places them); (c) the S318 item's part (9), a long paragraph under `from: gfm`;
(d) the S319 item's part (1), consecutive container-column lines (a long definition list); the S322 item's part (1) and the S317 stack overflows (4) to (9) follow.
After those, the terminal bounded session files ONE RESIDUAL record, owns the sweep's unrun 68% (rule P5; the operator's decision of Session 325) and stops. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) The runner tests the COMMITTED source, copies `--tests` once, and SKIPS a mutant whose `from` no longer occurs once. `mutants/s317-heading-scan.json`: 76, 65 killed, 11 survive on purpose, about 27 minutes (nine timeouts); commands in its README rows.
(3) A mutant you expect killed may be equivalent: B01, B02, M03, A07 returned a place the scan steps over. Run a survivor through a parent-versus-mutant differential before writing a row; the harness is `scratchpad/s325/harness/` (untracked, README there).
(4) Pins: the ELEVENTH set was incomplete (823): near-miss tokens, needles longer than the enumeration, one clock row per CALLER of a cache, a hashed variant rotation. Ask the mutation lens for survivors, then run them yourself.
(5) Quote a timing with its load AND its state (cold or warm); size a RED row from the WARM figure, controls first (816). Benchmark a cure on content where EVERY item reaches the new path, and on each other caller (824).
(6) Unchanged residuals: the ids are still a group (about 3.36 million `#a` throw `RangeError`, S319 item part (5)); `braceGroups` quadratic (filed); the tables are built at the FIRST question (filed, Polish; patch `scratchpad/s325/design-v7.patch`).
(7) Clock rows flake under load: `qmd-model.test.ts` Session 307 and 308 rows. Name them, re-run the files alone, never loosen. This session's full runs (load 10 to 18) passed.
(8) The Session 314 vitest worker (pid 84774) is STILL spinning at 100% CPU after 4 days 19 hours: not mine; ask before killing it. The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is not mine either.
(9) `test:integration` NOT run for fifteen sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 12,185 tests in 96 files, clean (`mutation-lists-apply.test.ts` picks up each new mutant list by itself).
(10) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session.
(11) The plan: update its status column AND its in-flight, next-group and g02 order-table rows at each close-out (the order-table row was stale from S323 to S325); its key count command prints 221 (filed items carry no key).
(12) The Write and Edit tools turn a backslash-u escape for U+2028 into the raw character (Learning 792). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices, edit with a Python script.
macOS `sed` rejects `|` as a delimiter and `sed -i` needs `''`. After answering a direct question, STOP and wait (memory).

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

## Session 324 Handoff Evaluation (by Session 325)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`09b0b0f`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`, re-run here), the real-document score (2423 of
2438), the plan's
key count (221) and the baseline (12,088 in 95 files; 12,109 after my first 21 rows) all held, and the picker the plan ranked was accurate: it offered the S317 item's part (2) first, as finishing a feature.
**Helped:** candidate (a) said "profile first (Learning 739)": the self-time table per shape showed the item's attributions were wrong for two of four shapes before any code was read; gotcha 2 (the runner tests the COMMITTED tree, skips a stale `from`) made me commit
the source before each
mutant run and is why the six re-based mutants were found at once; gotcha 4 (compare a mutant that claims to keep the language with the base FIRST) is how I checked the ten survivors on 900,000 strings each; gotcha 5 (a tool-call budget and a `ps` check, 819) kept six
lenses to 33 to 62 calls
(68 minutes, 303 calls in all); gotcha 7 (plan rule P5 not met; ask who owns the unrun 68%) was asked at the picker and answered; gotchas 1, 9 and 13 (exact paths; the worker and worktree are not mine; the U+2028 trap) held.
**Missing:** (a) that the plan's g02 ORDER-TABLE row was already stale (it said "seven sessions done" from Session 323; only the "Current position" block had been updated), so a session reading the table alone would have been two sessions behind; (b) that the candidate
list leaves out the S318 item's
parts (1) to (7), of which (2) and (3), the closing-hash and attribute regexes, turned out to be the remaining slow time on a heading line, so the handoff did not say whether they come before part (9); (c) that part (2) was likely wider than named: the item said "not
re-profiled", but not that part (3) of a different item (S319) shares its function.
**Wrong:** nothing I could find in the claims I checked; the item's "`model.ts` near 14476 and 14303" were positions at a commit (the file had moved), as Sessions 320 to 322 said. **ROI: high.**

## Session 325 Self-Assessment

**Score: 7/10.**
**Went right.** I took a self-time table per shape before reading the cure (that is what showed a bare `{` run and a bare backslash run belong to two regexes filed under Session 318, and that the function itself was quadratic on thirteen shapes). The 13 rows were
written and run on the unmodified
tree before the cure (all fail on the clock alone, 3.5 to 6.3 s, the answer each asserts first right, 6 controls pass); the cure went in four slices, each its rows GREEN with the full suite and 600,000 to 900,000 random strings against the parent. The oracle was copied
by script and
checked against the parent module on 1,000,000 strings before any count was pinned. Every claim of the six lenses I acted on was run here: the 22 gap mutants (22 survive before the new rows, 22 killed after), A01 against the whole suite (killed by seven older rows), the
ten survivors on 900,000
strings each, the 9 new rows on a copy of the parent tree (9 fail, 3 guards pass), the variant rotation (another hash constant moves the markers count from 82,203 to 82,156). I did not adopt the lens's larger design changes (lazy-first reading, one stack, no `close`
parameter): they reopen code the mutants and
the oracle had just verified, for microseconds; they are filed with the measurements.
**Went wrong.** (1) My pins were incomplete for the ELEVENTH set (Learnings 773 to 815; 823): after 77 mutants of my own the mutation lens found 22 real gaps (near-miss tokens, three needles of seven tokens, four call sites with no clock row), and the tests lens found
that my variant
rotation followed the last token for two alphabets. (2) Text I wrote was wrong in nine places (the escapable set called the default, "2.4 to 6 s", "Session 324's HEAD", "union" for 14 of 41 tokens, "every alphabet holds a block tag", "above" for a row below, "four"
older rows for seven; the
`a110798` message says 3.1 million strings for 4.3 million and the `39b0fdb` message says four for seven, both stay) and one commit message miscounted rows (amended at once, unpushed). (3) I expected five mutants killed (B01, B02, M03, A07, A01) and four are equivalent:
my predictions are not evidence.
(4) My first benchmark (40,000 mixed headings, 205 to 212 ms) hid the cost the design lens found with headings that ALL hold a link (306 to 379 ms; Learning 824). (5) TDD deviations, disclosed: the oracle and the 18 fixed rows were written after the cure and pass on
arrival (their RED is a mutant);
the 200,000-CDATA row was not run on the parent (about 17 minutes) and is held by mutant PM8; the three guards are linear on the parent by design. (6) Scope: I put the S319 item's part (3) in this session by the operator's standing Session 315 directive; the operator
chose part (2) only, and has not seen
the reading (stated in the ledger and the plan; the angle slice is its own commit and revertible). (7) The review round took 68 minutes of wall time at load up to 18 and 1.19 million tokens, inside every lens's call budget but long.
**Known residuals (filed or stated):** the tables are built at the first question (about 1 us more on a heading with a link; `endsHtmlBlock` 1.6 to 1.8 times); transient memory about 24 bytes a character (150,000,000 `[` threw `RangeError`); `HEADING_ATTRIBUTE` and
`ATX_CLOSING_PANDOC` (S318 item parts
(2) and (3)) are the time left on a heading line; `test:integration` NOT run.
**TDD:** RED before GREEN for the 13 refused-shape rows (`4172926` before `4498486` to `0e5aeab`) and for the review's 9 clock rows (shown failing on a copy of the parent tree before they were committed); for the oracle's additions 22 of 22 mutants shown SURVIVING with
the runner before the rows and killed after.
Passed on arrival, disclosed: the oracle file, its 18 fixed rows, the 3 guards, the 6 controls.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 6 agents in 1 workflow (1,186,325 subagent tokens, 303 tool calls, 68 minutes), about 190 mutant runs of mine in four runs (77 + 22 + 6 + 10, the 76 again on the final tree, A01
whole-suite), 0 quarto renders.

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
