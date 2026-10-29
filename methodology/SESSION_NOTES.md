# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 337 closed out.** g02's twenty-first session is done: the Session 336 item's parts (1) to (8), the eight single-line `RangeError` shapes (`ATTR_ATOM_RUN`'s id group, `GRID_PLAIN_BORDER`, the
CommonMark type-7 tag's attribute group, the empty native div, `R_SYMBOL_CHAIN`, `REF_USAGE`, the knitr string mask, `KEY_LINE`'s dash group). Each is an index loop now (`attributeAtomRun`, `gridPlainBorder`,
`commonmarkTagLine`, `emptyNativeDivLine`, `isRSymbolChain`, `refUsageEnd`, `blankQuotedStrings`, `readKeyLine`) with the old pattern kept as the oracle of its own test file. Eight workers in isolated worktrees
(`wf_aae03494-884`); 35 commits cherry-picked with no conflict (`820b6d4` to `0709a1d`) and the merge fix `f94b258`; the review round (`wf_8650bf5a-af9`, 54 agents) `fe271ed` to `aaf17a9`; then the records. `BACKLOG.md`
"Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows three and a catch-all): (a) the new Up Next item "Eleven more places
that throw `RangeError` on a long line or a long list" (nine class patterns under the `u` flag from 4,194,288 letters above U+00FF, two array spreads from about 125,700 elements; the recipe is written and every row needs a
character above U+00FF; it finishes the same feature; estimate two sessions); (b) the Up Next item "Three more quadratic single-line shapes" with the Session 318 and 319 quadratic items; (c) the S322 item's part (1) and the
S311 item's parts (4), (10), (11); (d) the Up Next items "Three more slow shapes found by Session 334's review round", the amended `isAttributeBlock` item and "Six more shapes found by Session 333's review round". The Polish
item "`npm test` exits 1 with every test green" (split `pathological-inputs.test.ts` and `table-rule-row-equivalence.test.ts` below 40 s) is cheap and makes every later baseline readable: offer it and say which rule places it
(robustness: a red exit code hides a real failure). "Two answers where this build and quarto differ" belongs to g22 and g14. Time the literal shape at HEAD FIRST (Learning 840). After those, the terminal bounded session files
ONE RESIDUAL record, owns the sweep's unrun 68% (rule P5; the operator's decision of Session 325) and stops. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) No harness of this session is in the repo except the Python recounts (`tools/*-count`) and the oracle files. Rebuild (Learning 848): `git worktree add --detach <dir> <sha>`, a `node_modules` symlink, esbuild's `buildSync`
on `src/core/qmd/model.ts` and `src/core/refs.ts` (`bundle`, `platform: 'node'`, `format: 'cjs'`, `outdir`); one fresh process per probe and per bisect step; VERIFY the lower bound is OK first (Learning 885). A first-throw
figure depends on the line's byte width (a character above U+00FF halves it), on the unit and on the tail: say which (Learnings 889, 890).
(3) SHELL (zsh): an unmatched glob is an error (`rm -f x_*.log`), `echo =====` is not found, `for a in "x 1"; do set -- $a` does NOT split (use `${=a}`), an unquoted heredoc eats backticks, and a leading `sleep` is blocked:
wait with a foreground `for i in $(seq 1 58); do [ -f done ] && break; sleep 10; done` loop. The Write and Edit tools drop a trailing space (Learning 778): edit with a Python replace and assert the occurrence count.
(4) The mutation runner tests the COMMITTED source and copies only the `--tests` files from the working tree: commit source first, use each list's README row for its `--tests` set and `--cmd 'npx vitest run --bail 1
--maxWorkers=2'`, run ONE list at a time. This session's lists: the eight `s337-*` (416 killed, 60 survive, 6 to 22 minutes each) and `s337-review.json` (4 killed, 3 survive). Label an expectation by running the mutant
(Learning 887); `mutation-lists-apply` goes red when a new function repeats an old list's anchor (Learnings 883, 891: start the anchor one line earlier).
(5) ISOLATED WORKTREES START AT AN OLD COMMIT (`24fa414`, 132 behind): every worker brief must begin with `git rev-parse HEAD` against the stated base and a reset of the empty branch (Learning 891). The merge of eight
branches was conflict-free because each part owned its functions and its new test files.
(6) BASELINE `npm test`: 139 files and 15,252 tests pass, `Errors 1 error` (`Timeout calling "onTaskUpdate"`, `pathological-inputs.test.ts` at 79.6 s) and EXIT CODE 1 (Learning 892); the Session 336 handoff's "clean" was
wrong. Under another project's load (here 40) 180 clock rows fail in the same suite: read `uptime` first, rerun on a quiet machine, never loosen a limit. Every new test file must run under 25 s alone.
(7) Rows must read WITH the engine hint and, from now on, on a line with one character above U+00FF as well as one without (Learnings 886, 890). Pins were incomplete a TWENTY-THIRD time: the mutation lens found four real gaps
among 204 new mutants, three in the first-slot class the cure sat beside (Learning 895).
(8) Residuals: the BACKLOG items above (Up Next: eleven more places, three quadratic; Polish: the cures' constant factor and deoptimization, the `npm test` exit code, the heading tokenizer's garbage); 60 plus 41 mutants
argued equivalent or recorded as gaps; three call-site edits of `endsHtmlBlock` have no witness (S4-01 to S4-03 of `s337-review.json`: a render may find one, as for W01).
(9) The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is still not mine: ask before removing it. The eight `wf_aae03494-884-N` worktrees and their `s337-p*` branches were removed at close-out (their commits are on
`master`). (10) `test:integration` NOT run for twenty-seven sessions (takes the screen: ask first).
(11) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session.
(12) The plan: update its status column AND its in-flight, next-group and g02 order-table rows at each close-out (done this session: "twenty-one sessions done"). (13) `master` is NOT pushed: 173 commits ahead of
`origin/master` when the close-out began (Phase 0 of this session: 131); the dashboard copy is v2.22.0 against canonical v2.23.0 (not synced). (14) `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are
past the read refusal: read in slices, edit with a Python script (`python3 -I -`). After answering a direct question, STOP and wait (memory).

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

## Session 336 Handoff Evaluation (by Session 337)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `7635df2`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`), the
real-document score (2423 of 2438), the dashboard and the picker all held; `master` was 131 commits ahead at Phase 0 (the note said 127 when the close-out began, and four close-out commits followed). Candidate (a), the new Up
Next item, was placed by finishing a feature, and its parts (1) to (8) took the whole session.
**Helped:** the item's figures: six of eight held exactly and the corrections were small, so the bisects went fast (gotcha 2 was right to insist on the lower bound); the written recipe (a loop, the old pattern as the oracle,
a code-unit sweep, rows with the engine hint) and `comment-full-line-equivalence.test.ts` as a template let eight workers start from one brief; gotcha 4 (the runner tests the COMMITTED source, the README's `--tests` set)
held; gotcha 7 named the clock flakers and they were not the ones that failed.
**Missing:** the rows of Sessions 335 and 336 are built from ASCII and one-byte letters, so their figures are the one-byte ones and a character above U+00FF halves them (Learning 890); nothing said so. **Wrong:** gotcha 10
said `npm test` at HEAD was "14,099 tests in 118 files, clean": it prints `Errors 1 error` (`Timeout calling "onTaskUpdate"`) and exits 1, twice here (Learning 892). The zsh traps were named and I still hit `echo =====`
twice. **ROI: high.**

## Session 337 Self-Assessment

**Score: 8/10.**
**Went right.** Read the baseline's exit code and found what the handoff had called clean; timed the shapes at HEAD first; briefed eight workers with the clean-room rule repeated in every prompt (the reviewers' too), one part
and its own files each, so the merge of 35 commits had no conflict; checked the workers from my side instead of trusting their reports (215 of 263 rows fail on the parent, the figures of parts 1, 6 and 8 re-bisected, the
eight lists run alone with every label holding, the whole suite on the merged tree, which found the one anchor collision); ran a six-lens review whose findings two refuters re-ran each, and acted on what stood (four mutation
gaps pinned and killed, twelve statements corrected, four recount scripts tracked, eleven more places filed), filing the outside shapes instead of fixing them (1 and done).
**Went wrong.** (1) Numbers again: seven of eight workers wrote commit numbers from memory (Learning 894), and my own commit `aaf17a9` says "eleven" statements corrected where there are twelve; my first draft of Learning 894
carried examples I had not taken from the reports (caught before the commit). (2) The review brief said "nine mutation lists: 416 killed" when 416 is the eight new lists (the ninth adds 4). (3) My first full run of the final
tree was discarded: another project's load (40) failed 180 clock rows; the rerun on a quiet machine passed (15,252, exit 1 from the known worker error). (4) The refuter cap of 24 left the four mutation gaps without refuters;
I verified them myself by running the mutants. (5) The workflows ran for hours with few status lines from me: the harness nudged me several times. (6) zsh traps again (`echo =====` twice; `set -- $spec` does not split). (7)
TDD deviations, disclosed: the review's rows, the oracles' later rows and the four gap rows are green on arrival (their RED is a mutant); every cure's RED was shown first on the parent.
**Known residuals (filed or stated):** the BACKLOG Up Next items (eleven more places that throw, three quadratic), three Polish items, 60 plus 41 mutants argued equivalent or recorded as gaps, S4-01 to S4-03 without a
witness; the Session 333 and 334 items, the S322 item's part (1), the S311 item's parts (4), (10), (11); `test:integration` NOT run.
**TDD:** RED before GREEN for every cure (rows and oracle committed RED first on the parent); the review's rows are mutant-RED.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** two workflows (8 and 54 agents; 8.3 million subagent tokens; 2,500 tool calls; about 5 hours), nine mutation runs of 90 minutes in all, no
quarto renders, the machine at load 3 to 54 (another project's load of 40 during one suite run).

## Session 335 Handoff Evaluation (by Session 336)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `f31059c`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`), the baseline
(13,898 tests in 115 files), the real-document score (2423 of 2438) and the picker all held; `master` was 115 commits ahead at Phase 0 (the note said 110 when the close-out began, and five close-out commits followed). Candidate (a), the
new Up Next item, was placed by finishing a feature and took the whole session.
**Helped:** gotcha 2 (rebuild the harness from tracked files; re-bisect a first-throw figure in a fresh process) took minutes and was right to insist: the item's 8,390,625 was 2,052 high; gotcha 3 (quoted heredocs, a detached job, Monitor on a DONE
file) kept me out of the stray-file trap for the mutation runs; gotcha 4 (the runner tests the COMMITTED source, the README's `--tests` set) held; gotcha 5 (the pins are incomplete) was true a twenty-second time; the item's recipe (a loop, the old
pattern as the oracle, a code-unit sweep) and `node-property-end-equivalence.test.ts` as a template saved the most time.
**Missing:** part (3) said "finds a document or argues the call away" and not that the function has a SECOND caller whose own tests are the generator to extend (Learning 880): an hour went on a pressed-heading family before whole-function mutants named
the follower. The zsh traps beyond word splitting (an unmatched glob is an error, `echo =====` is not found). **Wrong:** gotcha 11 said the plan's in-flight, next-group and g02 order-table rows were updated; the order-table row still read "eighteen
sessions done" and ended at Session 334 (fixed here); the item's first-throw figure (the handoff itself warned it needs a re-bisect). **ROI: high.**

## Session 336 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the three shapes in fresh processes at HEAD before reading code (they held, except the item's figure) and showed 25 document rows RED by RangeError before any cure (`e48a43d`); each part has a seam-and-oracle commit
(RED: the import was not a function) and a cure commit; every pinned count was recounted by a Python port that shares no code with the TypeScript; the four functions agree with the old patterns on about 187 million strings and 2.9 million documents.
Part (3): whole-function mutants named the follower, a forced-true/forced-false control showed my first families were blind, and 22 documents were rendered with quarto (one at a time) before any row stated an answer. The review's refuters reproduced all 31
findings, I re-ran every claim I acted on, and I filed the eleven outside shapes instead of fixing them (1 and done).
**Went wrong.** (1) My pins were incomplete a TWENTY-SECOND time: 33 of the review's 109 new mutants were alive (fifteen more characters and four pairs as a quote, caps on long blank runs, a terminator in the middle of a long body, a `}` in the middle of a value);
seven mutant labels I had written by reading were wrong, both ways. (2) Five numbers in commit messages were wrong (12 against 14.26 million strings, 105 mutants with 14 argued against 12, the 22 rendered documents' antecedent, two rows against three, a 10 s limit
on 27 rows and not 10); I cannot amend and corrected them in the CHANGELOG. (3) A probe of mine bypassed the production call path and reported `KEY_LINE` safe, and I wrote that into the siblings brief as "known not to throw" (the lens corrected it).
(4) My rows, like Session 335's, read with no engine hint; three of the eight filed overflows were invisible to them (rows added). (5) A bisect with an unverified lower bound collapsed to "last ok 8,000,000, first throw 8,000,001"; I caught it by reading the output.
(6) Shell traps again: zsh unmatched glob and `echo =====`, and an unquoted heredoc let the shell eat the backticks of a mutant name. (7) The third comment site could not be reached by a document row until the first throw was gone, so its RED exists only on a
variant (disclosed). (8) A sentence copied from Session 335's rows ("a run of 9,000,000 would pass on the parent") was false here. (9) TDD deviations, disclosed: the oracle files, W01's rows and the review's rows pass on arrival; their RED is a mutant (W01: 16 failing).
**Known residuals (filed or stated):** the BACKLOG Up Next item (8 overflows, 3 quadratic), two Polish items, 32 mutants argued equivalent, the Session 333 and 334 items, the S322 item's part (1), the S311 item's parts (4), (10), (11); `test:integration` NOT run.
**TDD:** RED before GREEN for the 25 document rows (`e48a43d` before `45dafc7`) and for each oracle's seam; every later row is mutant-RED.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** the review workflow 67 agents (6,080,530 subagent tokens; 1,528 tool calls; 78 minutes), about 230 runner mutants in six lists, 22 quarto renders (one at a time,
markdown engine, no kernel), differentials of
20,736 probes and 300,000 documents, the machine at load 7 to 30.

## Session 334 Handoff Evaluation (by Session 335)

**Score: 9/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `42fc73f`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`), the baseline
(13,458 tests in 109 files), the real-document score
(2423 of 2438) and the picker all held; `master` was 85 commits ahead at Phase 0 (the note said 81 when the close-out began, and the close-out commits followed). Candidate (a), the S317 item's parts (4) to (9), was placed by finishing
a feature and took the whole session.
**Helped:** gotcha 2 (the harness is gone: rebuild it from tracked files) took minutes and worked; gotcha 3 (quoted heredocs, a detached job, Monitor on a DONE file, a blocked `sleep`) kept me out of the stray-file trap; gotcha 4 (the
runner tests the COMMITTED source) bit once more when a support helper was uncommitted; gotcha 5 (the pins are incomplete) was true a twenty-first time; Learnings 840, 739, 866 and 870 shaped the rows; gotcha 13 (read in slices, edit
with Python) saved time on four large files.
**Missing:** the item's thresholds are Session 317's AGENT-MEASURED figures ("about 1.7M" for `|-`; 1,525,196 measured here); they held as magnitudes and the handoff did not say that a first-throw figure has to be re-bisected before it
is quoted (Learning 871). **Wrong:** nothing I checked. **ROI: high.**

## Session 335 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the shapes in fresh processes before reading code; the 30 document rows were RED by RangeError on the parent before any cure (`3c0bb60`); each part has a seam-and-oracle commit and a cure commit, the old pattern
kept as the oracle beside a reading by definition; every pinned count was recounted by a Python port that shares no code with the TypeScript; 360 shapes at 4.5 million characters and 128 at 45 million found no anomaly; 233 mutants
found incomplete pins of mine on the first run and I fixed them; the five-lens review reproduced nothing wrong in the cures, and I re-ran every claim I acted on (the thresholds in fresh processes, the survivors with the reviewers' own
mutants, the table survivors against the list's full test set) and filed what I did not fix.
**Went wrong.** (1) My pins were incomplete a TWENTY-FIRST time: 48 class-edge, cap and name-list edits passed every row because the alphabets held no form feed, vertical tab, NUL, `@`, `[`, `z` or lower case and no run beyond a few
thousand. (2) Eight first-throw figures were wrong in about twenty places (104 to 866 repetitions high, quoted as bisected in fresh processes); I do not know why my first bisect read high, and the second (one process per probe) agrees
with two independent re-runs. (3) A commit message and a list entry said W01 was "filed in BACKLOG.md" before I filed it. (4) The Edit tool dropped a space in `export const DEEP_ATX_HEADER = /.../` (`ef74ed4`; Learning 778 again),
found three commits later by the list generator's gate. (5) Records: a docstring example that takes no blank (`>[>]*`), docstrings and comments naming the retired patterns, a comment above the wrong test, F01's `why`, a title that
asserted less than it claimed, three README rows stale after the retirement. (6) About seven stated answers were wrong and caught only because each row also asserts the old pattern's answer. (7) The runner's baseline was red once (an
uncommitted support helper). (8) TDD deviations, disclosed: the oracle files, the controls and every review-round row pass on arrival; their RED is a mutant (the reviewers' runs, each reproduced by two refuters or by me).
**Known residuals (filed or stated):** the BACKLOG Up Next item "Three more single-line shapes found by Session 335's review round" (two overflows and W01), 22 mutants that survive on purpose, two recorded trade-offs, the Session 333
and 334 items, the S322 item's part (1), the S311 item's parts (4), (10), (11); `test:integration` NOT run.
**TDD:** RED before GREEN for the 30 document rows (`3c0bb60` before the cures) and for each oracle's seam (the import was not a function); every later row is mutant-RED.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** the review workflow 45 agents (4.2 million subagent tokens; 1,008 tool calls; 87 minutes), 302 runner mutants in six lists, a scratch differential of the
six functions, shape maps of 488 shapes, the machine at load 4 to 160 from other projects and the workflow.
