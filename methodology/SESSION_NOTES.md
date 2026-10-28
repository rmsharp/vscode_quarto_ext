# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 331 closed out.** g02's fifteenth session is done: the S319 item's part (1), consecutive container-column lines (`: a`, `~ a`, `A. a`, one per line). `computeRegions` keeps its container columns in a
`ColumnStack` (`src/core/qmd/column-stack.ts`): 16,000 lines took 3.9 to 4.1 s and take 55 to 65 ms. `2bd08b7` the RED rows, `c2a8bd2` the class and its oracle, `b65afb0` the wiring, `4be6b20` and `8b29b45` pins and 80 mutants,
`67e270c` the review round (12 more gaps closed, 15 wrong statements fixed).
`BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows three and a catch-all): (a) the S318 item's part (9), a long paragraph under
`from: gfm` or `commonmark_x` (it is now the whole cost of `~ a` under `commonmark_x`: 203 / 744 / 2,842 ms at 1,500 / 3,000 / 6,000 lines; `- item` plus `===` lines 1,980 ms at 5,000); (b) the S318 item's other open parts, (1)
`GRID_TABLE_BORDER`, (4) `htmlLineHasText`, (5) `linkDefinitionAt`, (6) `knitrCodeMasksPrinters`, (7) `YAML_ALIAS_VALUE` (each needs one long line; the item's figures are Session 318's); then the S311 item's parts (4), (10), (11), the
`isAttributeBlock` prefix item, the S322 item's part (1) and the S317 stack overflows (4) to (9). At the claim of any of them time the literal shape at HEAD FIRST (Learning 840; the part (1) figures held). After those, the terminal
bounded session files ONE RESIDUAL record, owns the sweep's unrun 68% (rule P5; the operator's decision of Session 325) and stops. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) No harness of this session is in the repo (it lived in the session scratchpad). Rebuild (Learning 848): `git archive <sha> src | tar -x -C parent`; `node_modules/.bin/esbuild src/core/qmd/model.ts --bundle --platform=node
--format=cjs --outfile=x.cjs`; one fresh process per timing, `performance.now()` around one `findHeadings` on a string built in-process; `node --cpu-prof` for the split.
(3) The runner tests the COMMITTED source (a throwaway worktree of HEAD), copies `--tests` files from the working tree and SKIPS a stale `from`; `mutation-lists-apply.test.ts` kills any mutant that rewrites text a tracked list names:
run it before the mutation run after any refactor that removes a field (Learning 852; it caught C07 and C08 here).
(4) Pins are incomplete a SEVENTEENTH time: the first 80 mutants left 12 alive and the review's 40 left 12 more (Learning 850). Before the review list, enumerate every document of up to 3 lines over each reader's own forms; a random
generator's zero proves nothing without a control of its kind.
(5) `s331-column-stack.json` (80) takes about 25 minutes whole-suite at a load of 15 to 35; `s331-column-stack-review.json` (20) takes 13 s a mutant with `--tests test/unit/column-stack.test.ts test/unit/column-stack-wiring.test.ts
--cmd "npx vitest run"`. Run alone, announce first.
(6) Residuals, all in BACKLOG item S319 part (1): the paragraph scan under `commonmark_x` (the S318 part (9)); the per-line cost in the DISTINCT columns open (750 nested bullets, 40,000 `: a` lines 0.8 s; a cached `[0, ...columns]`
array measured 2.5x faster on a shape built for it, not adopted); a copy of the columns at each quote entry. The helpers' "reads a SET" claim has no standing guard: if a helper that takes the columns is added, rerun the wrapped-columns
experiment (Learning 849). The cure removed a `RangeError` the parent threw for a quote over a very deep stack (verified at `--stack-size=100`, NOT at the default).
(7) Clock rows flake under load: `qmd-model.test.ts` Session 307 and 308 rows, `math-scan-equivalence.test.ts`, and the oracle file of `column-stack.test.ts` (about 12 s). Name them, re-run the files alone, never loosen. (8) The
foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is still not mine: ask before removing it.
(9) `test:integration` NOT run for twenty-one sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 12,653 tests in 102 files, clean.
(10) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session (the cure answers the same on
24.5 million reviewed documents).
(11) The plan: update its status column AND its in-flight, next-group and g02 order-table rows at each close-out (done in this one). (12) `master` is NOT pushed: it is ahead of `origin/master` by Session 330's and this session's
commits; the dashboard copy is v2.22.0 against canonical v2.23.0 (not synced).
(13) The Write and Edit tools turn a backslash-u escape for U+2028 into the raw character (Learning 792). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices, edit with a
Python script (`python3 -I -`).
macOS `sed` rejects `|` as a delimiter and `sed -i` needs `''`; zsh rejects a bare `=====` argument to echo and does not word-split `$var`. A foreground `sleep` is blocked: use a background run or the Monitor tool. After answering a
direct question, STOP and wait (memory).

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

## Session 330 Handoff Evaluation (by Session 331)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `23d6018`, gap 0), no `pending` receipt (the one grep hit is prose inside a gotcha), the ratchet citation (2/2,
results `bba236856bad`, read from the results file), the baseline (12,584 tests in 100 files) and the real-document score (2423 of 2438, unchanged) all held, and the picker the plan ranked was accurate: candidate (a) was the S319 item's
part (1), placed by finishing a feature, and the item's own figures were NOT stale (`: a` x 2,000 lines 115 to 135 ms against the item's 104 ms at 8,000 characters).
**Helped:** gotcha 3 (the runner tests the COMMITTED source; run `mutation-lists-apply.test.ts` before the mutation run) caught two orphaned mutants after a refactor; gotcha 4 (the pins are incomplete, a SIXTEENTH time) was true a
seventeenth time and is why the review list was read for gaps before the rows were trusted; the Learning 840 line made me time the literal shapes before reading code and Learning 848 told me to rebuild the harness from tracked files;
gotchas 1, 7, 8, 9 and 14 held, and I waited at the picker.
**Missing:** nothing that cost time. **Wrong:** nothing I checked, including the `master` claim (it was 11 commits ahead of `origin/master`, Session 330's, as the handoff said). **ROI: high.**

## Session 331 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the eight shapes in fresh processes before reading any code and profiled before reading the cure; the item's hypothesis held and the profile named the readers. The 20 rows were run on the unmodified tree in a commit
of their own BEFORE the cure and failed on the clock alone (2.5 to 4.0 s against 1,000 ms, answers right). The class has its own oracle (the plain arrays and the old expressions, every sequence of up to four operations and 15,000 seeded
ones), and the claim that the helpers read a set was proved two ways, with a control that fails (2,338 differences). A 600,000-document differential found 0 differences and its own controls told me what that zero was worth: 3 of 9
deliberate breakages were invisible to it, and I wrote aimed searches for them. Every witness and every wrong statement of the review that I acted on was run or read here, on the parent and the cure; I waited on the mutation logs and on the
quiet machine for the final timings.
**Went wrong.** (1) My pins were incomplete for the SEVENTEENTH set (Learnings 773 to 852): the first whole-suite run of my 80 mutants left 12 alive (68 killed, 11 contradicting their expectation), and the review's mutation lens found 12
more gaps; W01 and W42 I recorded as "no witness found" and the README said so, and they had two- and five-line witnesses. I searched with random generators and not with an exhaustive enumeration of each reader's own forms until the review
did. (2) Text I wrote was wrong in 15 places (a "linear" that was quadratic, a sentence reversed on W31, W47 named for its inverse, W13's direction, "ascending" left in a declaration comment, "nine" for ten, the columns 4 and 3 swapped
between the markers, comments naming the removed arrays). (3) The first wiring script of the session was a failed first run (no file was written) and was redone. (4) `computeRegions` needed three type annotations (TS7022) that I found at
the first compile and did not comment until the review. (5) The machine ran at a load of 14 to 45 from other projects for most of the session, so the timings were taken again at a load of 3 at the end; the review ran at up to 197.
(6) TDD deviations, disclosed: the oracle file, the wiring rows (the first 19, the review's 13) and the identity row pass on arrival; their RED is a mutant, shown with the runner (68 killed first; 12 of the review's 20 killed after the
rows, 8 argued). The `ColumnStack` methods `topColumn` was added test-first (RED shown); the class itself was written after its oracle (a stub that throws, RED shown) in a commit before the wiring.
**Known residuals (filed or stated):** the S318 item's parts (1), (4) to (7) and (9); the S311 item's parts (4), (10), (11); the `isAttributeBlock` prefix item; the S322 item's part (1); the S317 stack overflows (4) to (9); the per-line
cost in distinct columns and the quote-entry copy (S319 part (1)); `test:integration` NOT run.
**TDD:** RED before GREEN for the 20 clock rows (`2bd08b7` before `b65afb0`), for the class's oracle (stub, then class) and for `topColumn`; the pins and review rows are mutant-RED (above).
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 14 agents in 2 workflows (886,067 and 1,131,848 subagent tokens; the review 401 tool calls, 73.9 minutes at a machine load of 2 to 197 from other projects),
80, 12, 20, 9 and 1 mutant runs of mine, a 600,000-document differential, 0 quarto renders.

## Session 329 Handoff Evaluation (by Session 330)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `24fa414`, gap 0), no `pending` receipt (the one grep hit is prose inside a gotcha), the ratchet citation
(2/2, results `bba236856bad`, matched on re-run), the baseline (12,486 tests in 99 files) and the real-document score (2423 of 2438, unchanged) all held, and the picker the plan ranked was accurate: candidate (a) was the S318 item's
parts (2) and (3), placed by finishing a feature, and the item's own figures were NOT stale (`#` x 10,000 / 20,000: 341 / 1,383 ms cold against the item's 320 / 1,273; `{` x 10,000 / 20,000: 58 / 211 against 50 / 190).
**Helped:** gotcha 3 (the runner tests the COMMITTED source; run `mutation-lists-apply.test.ts` before committing test text) kept `npm test` green at every commit; gotcha 4 (one size under one limit misses a small constant) was true a
SIXTEENTH time and is why the rows were sized warm with controls first; gotcha 5 (a backgrounded subshell notifies when the wrapper exits) held again and I waited on the log; the Learning 840 line made me time the literal shapes before
reading code; gotchas 1, 7, 8, 9 and 14 held, and I waited at the picker.
**Missing:** (a) the S318 item's other open parts, (1) and (4) to (7), were left out of the candidate list (it named parts (2), (3) and (9) of that item only; the plan's candidate row has the same gap, now fixed); (b) the harness:
gotcha 2 named `scratchpad/s329/` (`shape.ts`, `build.sh`, `head.cjs`, `trees/`, `scan.py`), which does not exist, the second handoff in a row whose named directory was gone after S327's `scratchpad/s327/`;
`scratchpad/s328/harness/{build.sh,shape.ts}` existed and was copied (Learning 848).
**Wrong:** gotcha 12, "`master` is NOT pushed (344 commits ahead of `origin/master`)": at Phase 0 `master` equalled `origin/master` (0 ahead, 0 behind). Nothing else I checked was wrong. **ROI: high.**

## Session 330 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the item's shapes in fresh processes before reading any code (its figures held) and profiled before reading the cure: the profile found the third shape, a bare backslash run, which neither of the item's titles
named. The 13 refused-shape rows were run on the unmodified tree in a commit of their own BEFORE the cure and failed on the clock alone (3.2 to 3.9 s against 1,000 ms, answers right). I kept the old regexes as the oracle (40,459,924
enumerated strings, two seeded samples of 300,000, two grids, 0 differences) and had every pinned count re-derived by a Python port that uses no regex for the match. A parent-versus-cure differential over 1,000,000 generated documents
found 0 differences and, as its control, saw my own W01 mutant in 26,249. Every claim of the review that I acted on was run here: the 9-mutant list against the committed rows (0 killed, 9 survive, 8 contradict their expectation) and
against the new rows (8 killed, 1 argued), the no-break-space rows against a build of the parent, the negative control's strings, the sibling files' timeouts. I waited at the Phase 0 picker and on the mutation logs.
**Went wrong.** (1) My pins were incomplete for the SIXTEENTH set (Learnings 773 to 848): my own 51 mutants left W01 alive (the attribute text sliced one character late, visible only on `# T {{#a}`), and the review's mutation lens
found 8 more (caps one size above my rows, a loop whose real brace is always last in the rows, a trim per iteration that no row multiplied by a long blank run, `trimEnd()` at the call site), though the handoff's gotcha 4 had said to
expect it. (2) The oracle file shipped without a per-row timeout (the sibling files use 120,000 ms) and went red under a machine load of 60 to 90 (3 and 6 rows at the 5 s default); a full `npm test` at load 8 had not shown it.
(3) Text I wrote was wrong in about a dozen places: the negative control's comment (the wrong shortcut and the wrong string), three docstring phrases left stale by the rewrite (a lookbehind and a `text.replace` that no longer exist, a
one-pattern figure quoted for the default reader), the README's duration (25 minutes for 11), a mutant reason (5e9 steps for 2.5e9), the counting script's duration, an `atxClosingRun` doc that said it returned the index, an ambiguous
sentence and a loop comment that said the opposite of its code, two integration-suite comments naming the removed constant, and my draft's RED figure "expected 3xxx" (six of the 13 re-run values start with 4 at load 38 to 68); the
commit message of `362c878` says "five reader groups" for four (it stays).
(4) TDD deviations, disclosed: the oracle file passes on arrival (its RED is a mutant list); W01's 24 wiring rows, the 8 long-run rows and the review's 14 rows were written after a mutant survived (their RED is the survivor, shown with
the runner). (5) A backgrounded run wrapped in a subshell notified at once, when the wrapper exited and not when the run ended; I waited on the log. (6) My draft of the first Learning claimed the scratchpad is "cleaned between
sessions", which I could not show; the row says what I saw.
**Known residuals (filed or stated):** the S318 item's parts (1), (4) to (7) and (9); the S319 item's part (1); the S311 item's parts (4), (10), (11); the `isAttributeBlock` prefix item; the S322 item's part (1); the S317 stack
overflows (4) to (9); a heading-dense document with no blank line costs about 4.7x more per heading under the CommonMark-family readers (linear, a constant; not filed); `test:integration` NOT run.
**TDD:** RED before GREEN for the 13 refused-shape rows (`c0647be` before `72f4762`), for W01 (shown surviving, then killed by the wiring rows) and for the review's additions (8 of 9 mutants shown surviving with the runner before the
rows and killed after; the ninth, a cap at index 3,000,000, survives on purpose). Passed on arrival, disclosed: the oracle file, its stated rows, the comparator's self-test, the controls and guards.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 5 agents in 1 workflow (834,167 subagent tokens, 246 tool calls, 67.8 minutes at a machine load of 4 to 134 from other projects), 70 mutant runs of mine
in the runner (51 + 1 + 9 + 9), a 1,000,000-document differential, 0 quarto renders.

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
