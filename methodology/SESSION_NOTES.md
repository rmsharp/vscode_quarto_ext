# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 329 closed out.** g02's thirteenth session is done: the S311 item's part (5), a front-matter block scalar and many `---` groups, was found ALREADY CLOSED and is pinned. No `src/` change: `git diff af3d653 HEAD --
src` is empty.
The item's 2.1 s and 22 s were true on its own tree (`066cfcc1`: 2,349 ms and 25,606 ms) and went away with two commits aimed at other parts: `778ea19` (Session 314, the scalar) and `b63fafc` (Session 322, the groups). At HEAD 20,000 lines
take 58 ms and 12,000 groups 181 ms.
13 rows ("Session 329" in `pathological-inputs.test.ts`) pin them with their answers; 4 + 14 mutants are their RED. A two-lens review found `npm test` red at `96a8ac1` (one constant), 5 wrong statements and 4 small-constant survivors
(closed by two larger rows).
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows three and a catch-all):
(a) the S318 item's parts (2) and (3), `HEADING_ATTRIBUTE` and `ATX_CLOSING_PANDOC`: the slow time left on a heading line; (b) the S319 item's part (1), consecutive container-column lines (a long definition list: likely in a real document);
(c) the S318 item's part (9), a long paragraph under `from: gfm` (three witnesses now; the steepest is `- item` followed by many `===` lines, 1,980 ms at 5,000); then the S311 item's parts (4), (10), (11), the `isAttributeBlock` prefix
item, the S322 item's part (1) and the S317 stack overflows (4) to (9).
At the claim of any of them time the literal shape at HEAD FIRST (Learning 840): part (5) had been closed twice over before it was claimed. After those, the terminal bounded session files ONE RESIDUAL record, owns the sweep's unrun 68%
(rule P5; the operator's decision of Session 325) and stops. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) The untracked harness is `scratchpad/s329/`: `shape.ts` + `build.sh`, `head.cjs` (a bundle of `af3d653`'s `src/`: valid only while `src/` is unchanged), `trees/<sha>.cjs` (the 55 scanned commits), `scan.py`. Usage: `node head.cjs
<engine|headings|cells|outline> <prefix> <unit> <suffix> n...`.
(3) The runner tests the COMMITTED source and SKIPS a stale `from`; `mutation-lists-apply.test.ts` kills any mutant that rewrites text a tracked list names, and a new describe's constant can duplicate one (S329: `LIMIT_MS`, Learning 842):
run that file before committing test text.
(4) Slow-input rows: one size under one limit misses a quadratic with a small constant (841); clock rows need unique texts (838); put the shape beside every profile figure (843); "its parent" is a git word: write "the last commit before it
that touched `src/`".
(5) `s329-part5-pins-review.json` (14 mutants) takes about 22 minutes at a load of 7 to 39 (the 100,000-line row is quadratic under a regression): run it alone, announce first. A backgrounded run wrapped in a subshell notifies when the
wrapper exits, not the run: wait on its log.
(6) Unchanged residuals: the ids are still a group (about 3.36 million `#a` throw `RangeError`, S319 item part (5)); the heading `{` run (S318 item part (2)); `isAttributeBlock`'s prefix test and the first-versus-last group at
`fenceAttributeId`; sizes beyond any real document (part (10)); many kinds in one run (part (11)).
(7) Clock rows flake under load: `qmd-model.test.ts` Session 307 and 308 rows, and one row of `math-scan-equivalence.test.ts`. Name them, re-run the files alone, never loosen. (8) The foreign worktree `.claude/worktrees/wf_f559ba89-653-5`
is still not mine: ask before removing it.
(9) `test:integration` NOT run for nineteen sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 12,486 tests in 99 files, clean.
(10) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session (no `src/` change).
(11) The plan: update its status column AND its in-flight, next-group and g02 order-table rows at each close-out (done in this one). (12) `master` is NOT pushed (344 commits ahead of `origin/master`); the dashboard copy is v2.22.0 against
canonical v2.23.0 (not synced).
(13) Not tried by the neighbour sweep: sizes above 32,000 for most variants, CRLF/BOM/cursor-position entries, the product of two dimensions. An unrendered observation, not filed: a `...` document-end marker inside a mid-document metadata
block (HEAD ignores a `from:` written after it; quarto's answer is not known).
(14) The Write and Edit tools turn a backslash-u escape for U+2028 into the raw character (Learning 792). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices, edit with a Python
script (`python3 -I -`).
macOS `sed` rejects `|` as a delimiter and `sed -i` needs `''`; zsh rejects a bare `=====` argument to echo. A foreground `sleep` is blocked: use a background run or the Monitor tool. After answering a direct question, STOP and wait
(memory).

### What Session 330 Did
**Deliverable:** g02 of the backlog ordering plan, fourteenth session: the Session 318 item's parts (2) and (3), `ATX_CLOSING_PANDOC` and `HEADING_ATTRIBUTE`, the slow time left on a heading line (IN PROGRESS)
**Started:** 2026-10-27
**Status:** Session claimed. Work beginning. Strict TDD: time the literal shapes at HEAD first, in fresh processes, with the load beside each figure (Learning 840: the item's figures are Session 318's).
Profile BEFORE reading the cure (Learning 739): part (3) infers that `buildHeading` runs `HEADING_ATTRIBUTE` twice (not run), and a bare backslash run reaches both patterns.
Size the RED rows from the warm figure, controls first; keep the old patterns as the oracle (an exhaustive proof, then mutants). Operator decision at Phase 0: this pair (recommended; placed by finishing a feature, the heading line).
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

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

## Session 328 Handoff Evaluation (by Session 329)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `af3d653`, gap 0), no `pending` receipt (the one grep hit is prose inside a gotcha),
the ratchet citation (2/2, results `bba236856bad`, matched on re-run),
the baseline (12,471 tests in 99 files) and the real-document score (2423 of 2438, unchanged) all held, and the picker the plan ranked was accurate: candidate (a) was part (5) as written, with the note that the
plan's candidate row does not list the item. Its harness directory
(`scratchpad/s328/harness`) exists, unlike the one the S327 handoff named.
**Helped:** gotcha 3 (the runner tests the COMMITTED source; a stale `from` is skipped) made me commit before each mutant run; gotcha 4 (the pins will be incomplete) was true a FIFTEENTH time; gotcha 5 (quote a
timing with its load AND its state) shaped every figure; gotchas 1, 7, 8, 9 and
12 (exact paths; the clock rows that flake; the worktree not mine; `test:integration` not run; the U+2028 trap and waiting after a question) held, and I waited at the picker.
**Missing:** (a) that HEAD was DETACHED with the session's last 8 commits on no branch and `master` 8 commits behind (Phase 0 found it; fixed by a fast-forward at the operator's word); (b) that part (5)'s premise
was stale: its figures predate Sessions 314 and 322, so "profile first
(Learning 739)" had nothing to profile and the right first step was to time the literal shape at HEAD (now Learning 840); the S318 and S311 items carry other figures of that age.
**Wrong:** nothing I checked. **ROI: high.**

## Session 329 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the item's shapes in fresh processes at HEAD before writing a row and found them not slow, then confirmed the reproduction on the item's own tree (the control) and scanned the 55 trees that
touched `src/` to name the closing commits. I checked the answers the rows
state against quarto 1.7.33 (two small renders, announced, `*_files` pruned). The 870-run sweep's two flagged families were re-run and profiled by me before they went into BACKLOG, which corrected my own attribution
(a "73% in computeRegions" had crossed a context break without its shape;
one of the two shapes I guessed was linear). The RED for the pass-on-arrival rows came from four mutants run with the new rows alone, and I read one assertion message under the first (`expected 9228 to be less than
1000` after the answer assertion passed) to show it is the clock.
Every claim of the review that I acted on was run here: the red `mutation-lists-apply` (reproduced), the four survivors against the committed rows (0 killed, 4 survive), the 14-mutant list against the new rows (14 killed), the new rows' margin at HEAD.
**Went wrong.** (1) `96a8ac1` left `npm test` red: I ran the new describe and `check-types:unit` and not the suite before committing; the review's baseline found it, my gate run would have. (2) Text I wrote was
wrong in 5 places (a commit called a parent, a comment that never said its lines
are 0-based and misattributed a `from: gfm`, "a bisect" for a scan, the reason of P02, "undo"/"revert" for edits two of which are other doors), and in the commit message of `96a8ac1`, which stays. (3) My pins were
incomplete a FIFTEENTH time: one size under one limit cannot see a quadratic
with a small constant (four survivors, 136 to 663 ms at the row sizes). (4) TDD: there was no GREEN to write, so no RED-before-GREEN; the rows pass on arrival, their RED is a mutant list, and the two larger rows
were written after survivors (shown surviving before, killed after). (5) Two
background commands notified when their wrapper exited and not when the run ended; I waited on the log. (6) The scan's per-commit log was not kept, so the interior ranges in the ledger cannot be re-derived (the
audit re-timed the commits at each transition and they fit).
**Known residuals (filed or stated):** the S311 item's parts (4), (10) and (11); the S318 item's part (9) with its new witnesses; a `...` marker inside a mid-document block (a pin no test has, not rendered); the
sweep's untried dimensions; the `isAttributeBlock` prefix item; the heading `{` run;
`test:integration` NOT run.
**TDD:** disclosed in (4). **Host:** `test:integration` NOT run (no `src/` change; it takes the screen). **Cost:** 6 agents in 2 workflows (949,197 subagent tokens: the sweep 544,731, the review 404,466; 58 minutes
for the review), 22 runner mutant runs of mine (4 + 4 + 14), a 55-tree timing scan,
2 small quarto renders, 0 renders by agents.

## Session 327 Handoff Evaluation (by Session 328)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `b029af9`, gap 0), no `pending` receipt (the one grep hit is prose inside a gotcha), the ratchet citation (2/2, results `bba236856bad`, read
from the results file)
and the real-document score (2423 of 2438, 15 divergent, unchanged by this session) all held, and the picker the plan ranked was accurate: candidate (a) was part (3), placed by finishing a feature, with the note that the plan's candidate row does not list the item.
**Helped:** candidate (a) said "profile first (Learning 739)" and gave the item's figures (12,000 lines 2.2 s): my cold figures (2,243 ms, 576 ms at 6,000) matched before any code was read, and the profile (94% in the item's three places) confirmed the reviewer's
attribution, which Learning 739 had made me doubt.
Gotcha 2 (the runner tests the COMMITTED tree, skips a stale `from`) made me commit before each mutant run; gotcha 4 (the pins will be incomplete) was true a FOURTEENTH time (17 answer-changing survivors the lens found, 2 of my own); gotcha 5 (quote a timing with its
load) shaped every figure;
gotchas 1, 7, 8, 9 and 12 (exact paths; the clock rows that flake; the worktree not mine; `test:integration` not run; the U+2028 trap and waiting after a question) held, and I waited at the picker.
**Missing:** (a) that `scanRegions` keeps the last two scans by text, so a clock row whose text another row just read cannot be RED (my first `indexLabels` row passed on the parent); (b) that the flaky clock row I met was in `math-scan-equivalence.test.ts`, not the
`qmd-model.test.ts` rows it named;
(c) that nothing of S327's untracked harness survived (below).
**Wrong:** gotcha 3 said "the harness is `scratchpad/s327/` (`mkvariant.py`, `diff.js`, untracked)": the directory does not exist (`ls scratchpad` shows s325, s326 only before this session), so the timing and differential harnesses were rebuilt from
`scratchpad/s326/harness`. The rest of what I checked was accurate. **ROI: high.**

## Session 328 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the item's shapes in fresh processes and profiled before reading the cure (the item's attribution held and I had expected it not to). The 11 refused-shape rows were run on the unmodified tree in a commit of their own BEFORE the cure and failed on
the clock alone (3.0 to 4.7 s, answers right);
the extra rows I added after the cure were shown RED on a copy of the parent (14 RED, 9 pass). I kept the old function as the oracle, enumerated 34.1 million questions (singles, pairs, sweeps, and after the review triples) and had every pinned count re-derived by a
Python port that enumerates each history. Every claim of the review I acted on was run here:
the lens's 31-mutant list (20 survive the first tests, 25 killed after, 6 argued), a parent-versus-cure differential of my own (500,000 documents, 4 readers, 0 differences, the control 616), the many-kinds reads, the constant factor on four synthetic shapes and on 3,382
real documents, and the K35 shrink to six lines. The cost pins became relative.
I waited at the Phase 0 picker.
**Went wrong.** (1) My pins were incomplete for the FOURTEENTH set (Learnings 773 to 839): K35 and T02 survived my own 50 mutants, and the lens found 17 more answer-changing survivors (the fields of a key and the arguments of a call the alphabets never varied, an order
of three questions, one blank class), though the handoff's gotcha 4 had said to expect it.
(2) Text I wrote was wrong in 12 places (the direction of an effect, "three rows" for two, "N x N", "four lines" for three, a mutant named for the inverse of its edit, a duration I never timed, a count the pins did not give) and in three commit messages (`3c35c69`,
`c158265`, `a20167e`: "25 stated answers" for 26, "N x N", "400 + 144 documents" for 157; they stay).
(3) Two statements went into files before they were true: a comment claiming a 600,000-document differential with 0 differences (I had run a mutant-against-cure search; rewritten within minutes, before any commit) and a brief that told the document lens "the caller
already ran a differential" (run right after). A commit message and the first ledger text said a full-suite row "timed out" when the output I read was cut off before its message.
(4) My first `indexLabels` row passed on the parent because `scanRegions` served it the previous row's scan; I caught it on the first RED run. (5) My first cost pins were exact (`2 * (n - 1)`) and bound an implementation detail. (6) TDD deviations, disclosed: the oracle
passes on arrival (its RED is a mutant); the three interleaved-kind rows, the call-site rows, the kind-field rows, the triples, the blank classes and the cost rows were written after a mutant survived
(their RED is the survivor, shown with the runner). (7) The review took 37.5 minutes and 1.06 million tokens at a machine load of 88 to 160 from other projects; the lenses quoted counts.
**Known residuals (filed or stated):** the S311 item's parts (4), (5), (10) and (11); the cure's constant factor (filed, Polish; decided against); the duplicated test helper (filed, Polish); the heading `{` run (S318 item part (2)); `isAttributeBlock`'s prefix test
(filed); a non-finite `len` and a non-integer `from` (unreachable, said in the source and the ledger); `test:integration` NOT run.
**TDD:** RED before GREEN for the 11 refused-shape rows (`9e80dbb` before `c158265`) and for the three interleaved-kind rows (shown on a copy of the parent); for the review's additions 17 of 17 answer-changing mutants shown SURVIVING with the runner before the rows and
killed after. Passed on arrival, disclosed: the oracle file, its stated rows, the comparator's self-test, the controls and guards.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 6 agents in 1 workflow (1,056,213 subagent tokens, 214 tool calls, 37.5 minutes), 114 mutant runs of mine in the runner (50 + 2 + 31 + 31), a 500,000-document differential, 0 quarto renders.

## Session 326 Handoff Evaluation (by Session 327)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at the claim commit `9d16619`'s parent `363e00c`, gap 0), no `pending` receipt other than this session's, the
ratchet citation (2/2, results `bba236856bad`, read from the results file) and the baseline (12,245 in 97 files) all held, and the picker the plan ranked was accurate: candidate (a) was the `$` half, placed by finishing a feature,
with the note that the plan's candidate row does not list the item.
**Helped:** candidate (a) said "profile first (Learning 739)" and gave the item's figures (1.6 s at 32,002 characters, 6.5 s at 64,000): my cold figures (1,407 and 5,441 ms) matched in slope before any code was read, and the profile
(`scan` 39%, the `\s` test 37%) showed the item's three shapes were one cause. Gotcha 2 (the runner tests the COMMITTED tree, skips a stale `from`) made me commit before each mutant run; gotcha 3 (a kill with no title is a crash; a
survivor needs a parent-versus-mutant differential) is how L04, L05 and the 14 equivalents were handled; gotcha 4 (the pins will be incomplete) was true a THIRTEENTH time; gotcha 5 (quote a timing with its load) shaped every figure;
gotchas 1, 7, 8, 9 and 12 (exact paths; the clock rows that flake; the worker gone and the worktree not mine; `test:integration` not run; the U+2028 trap and waiting after a question) held, and I waited at the picker.
**Missing:** (a) that the item's `$a ` is one of three shapes with one cause (the item named only the first; the digit and escape refusals cost the same and the digit one is the worst, 30 s at 25,600 repeats); (b) that the 81-mutant
list takes about 30 minutes, not the 17 of the Session 326 lists; (c) that "the plan's key count prints 221" was not something I could re-run cheaply (I did not); nothing it said was stale.
**Wrong:** nothing I could find in the claims I checked; the item's `$a ` figures (1.6 s at 32,002 characters, 6.5 s at 64,000) are within 20% of mine (1.4 and 5.4 s cold, load 6 to 8), and it said load moves them. **ROI: high.**

## Session 327 Self-Assessment

**Score: 7/10.**
**Went right.** I timed three shapes in fresh processes before reading code and profiled one (that found the item's attribution right but incomplete: three refusals of a closer, one cause). The 7 refused-shape rows were run on the
unmodified tree and failed on the clock alone (4.0 to 6.7 s, answers right) in a commit of their own BEFORE the cure. I kept the old scan as the oracle by script and proved the rename reversible, enumerated 10 million strings, and
had every pinned count re-derived by a separate Python port. Every claim of the review I acted on was run here: the 13 gap mutants (13 survive on the tests as they stood, 13 killed after the rows), the two new refused-shape rows on
a copy of the parent (4,790 and 3,753 ms) and the 210,000-character reach row there (54,465 ms), the timeout kill R01 timed alone (436,916 ms), and the reviewer's wording of which guard kills which cap against my own run 1 (it was
wrong; the comment now says what my run says). I waited at the Phase 0 picker, which Session 326 had skipped.
**Went wrong.** (1) My pins were incomplete for the THIRTEENTH set (Learnings 773 to 826; 830, 831): 13 survivors after 81 mutants of my own, six of them cost-only (a kept value forgotten at a statement the cure passes) and seven
about characters, widths and a window that no alphabet held, though the handoff's gotcha 4 had said to expect it. (2) Text I wrote was wrong in ten places (two about my own tests, a control that does not exist, a parenthesis
describing the parent, "kept across skip regions", the oracle header, the README duration) and in two commit messages (`ddd7923` "9.5 million" for 10,049,350, `38e557c` "34 math rows", not reproduced; both stay); I also miscounted
the review commit's tests (10 for 15) and caught it before any push. (3) TDD deviations, disclosed: the oracle file passes on arrival (its RED is a mutant); the 15 stated rows and the clock rows for R01 to R04 were written after the
mutants survived (their RED is the survivor, shown with the runner); the 400,000-opener and 100,000-opener reach rows were not run on the parent (about half an hour and two minutes, extrapolated); the 70,000-opener one was (54 s).
(4) The review took 98 minutes and 1.03 million tokens; the performance lens ran at a load of up to 104 from other processes, so its timings are the ones taken at load 3.6 to 4.9. (5) A harness defect of mine (`mkvariant.py
--parent` left a call site unrenamed) cost three lenses a workaround. (6) I mistyped a relative path to my own timing harness once (it needed an absolute path) and re-ran.
**Known residuals (filed or stated):** the S311 item's parts (3), (4), (5) and (10); the constant factor of the cure (filed, Polish; decided against); the heading `{` run (S318 item part (2)); `isAttributeBlock`'s prefix test
(filed); `test:integration` NOT run.
**TDD:** RED before GREEN for the 7 refused-shape rows (`72d4a9c` before `38e557c`) and for the review's additions: 13 of 13 gap mutants shown SURVIVING with the runner before the rows and killed after; 2 of the 6 new clock rows
shown failing on a copy of the parent. Passed on arrival, disclosed: the oracle file, its first stated rows, the comparator's self-test, the controls and guards.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 6 agents in 1 workflow (1,032,020 subagent tokens, 211 tool calls, 98 minutes), about 190 mutant runs of mine (81 in run 1, 6 again, 13 twice, 81 again
on the final tests, one 7-minute timing), 0 quarto renders.
