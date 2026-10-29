# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 336 closed out.** g02's twentieth session is done: the Session 335 review item's three parts. A `<!--` line with no `-->` (three sites) and a bare `key=value` attribute value threw `RangeError`
from 8,388,573 repetitions (the item's 8,390,625 was 2,052 high); they are `commentFullLine`, `commentFullLineCol0`, `commentThenText` and `attributeKeyValue` now, each with the old pattern kept as the oracle. Part (3), the table
opener's call (mutant W01), found its witness: an indent-4 `{bash}` opener directly under a table whose delimiter row ends in a form feed; quarto 1.7.33 rendered 22 documents and the real build is right on all 22. Commits: `aea22f6`
the claim; `e48a43d` 25 RED rows; `a88b5f1`/`45dafc7` the comment oracle and cure; `9dfc173`/`56f7823` the attribute oracle and cure; `6878c72` part (3); `a55c18b`, `29a7904` four mutation lists; the review round (`wf_bf455167-107`)
`9d0a030`, `1ab0a93`; then the records. `BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows three and a catch-all): (a) the new Up Next item "Eight more single-line
RangeError shapes and three more quadratic ones, found by Session 336's own probes and its review round" (the Session 335 class, whose recipe is written; three of the eight are reachable only with the engine hint; the quadratic three
belong with the Session 318 and 319 items); (b) the S322 item's part (1) and the S311 item's parts (4), (10), (11); (c) the Up Next items "Three more slow shapes found by Session 334's review round", the amended `isAttributeBlock` item
and "Six more shapes found by Session 333's review round". "Two answers where this build and quarto differ" belongs to g22 and g14. Time the literal shape at HEAD FIRST (Learning 840). After those, the terminal bounded session files
ONE RESIDUAL record, owns the sweep's unrun 68% (rule P5; the operator's decision of Session 325) and stops. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) No harness of this session is in the repo (the scratchpad held the bundles, the bisect, the Python recounts, the 22 rendered documents). Rebuild (Learning 848): `git archive <sha> src | tar -x -C dir`; `node_modules/.bin/esbuild
entry.ts --bundle --platform=node --format=cjs --outfile=x.cjs`; one fresh process per timing and per bisect probe; VERIFY the bisect's lower bound is OK first (Learning 885: 8,388,573 for a one-character group, 3,355,430 for two).
(3) SHELL (zsh): an unmatched glob is an error (`rm -f x_*.qmd`) and so is `echo =====`; an UNQUOTED heredoc delimiter lets the shell eat backticks in the Python text (a mutant name lost its `=`): quote it; start a detached job with
`(nohup bash x.sh >/dev/null 2>&1 &)` and wait with Monitor on a DONE file or a foreground `until [ -f done ]; do sleep 20; done` loop (a leading `sleep` is blocked); the Write and Edit tools drop a trailing space (Learning 778): edit with a Python replace.
(4) The mutation runner tests the COMMITTED source and copies only the `--tests` files from the working tree: commit source first, use the list's README set and `--cmd 'npx vitest run --bail 1 --maxWorkers=2'`; a survivor from a
partial set is no survivor (Learnings 872, 884); label a mutant by running it (Learning 887). This session's lists: the six `s336-*` (227 edits: 195 killed, 32 argued equivalent, each in its `why`); `mutation-lists-apply` goes red when a new
function repeats an old list's anchor (Learning 883).
(5) Pins are incomplete a TWENTY-SECOND time (33 of the review's 109 mutants were alive): sweep every code unit into every structural position, not the heads (Learning 887).
(6) Rows must read WITH the engine hint (`buildOutline(text, "knitr")`, `"jupyter"`, `indexLabels(text, "knitr")`): the providers pass it and three of the eight filed overflows are reachable only with it (Learning 886).
(7) Clock rows flake under load: the S336 comment rows have 4 s, only the 13 attribute rows 10 s (the heading tokenizer is linear, 1.9 s at 16.8 million characters); the earlier flakers stand (`qmd-model.test.ts` Sessions 307 and 308, `math-scan-equivalence`,
the oracle file of `column-stack`, `paragraph-interrupt-equivalence`, the million-character row of `grid-table-border-equivalence`). Name them, re-run alone, never loosen.
(8) Residuals: the BACKLOG item above and two Polish items; 32 equivalents argued on purpose; two recorded trade-offs (a whole-line comment followed by 4,000,000 blanks takes 97 ms against 53 ms, `skipBlanks` is a JS loop; the heading tokenizer).
(9) The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is still not mine: ask before removing it. (10) `test:integration` NOT run for twenty-six sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 14,099 tests in 118 files, clean.
(11) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session.
(12) The plan: update its status column AND its in-flight, next-group and g02 order-table rows at each close-out (Session 335 left the order-table row at "eighteen"; fixed). (13) `master` is NOT pushed: 127 commits ahead of `origin/master` when the
close-out began (Sessions 330 to 336);
the dashboard copy is v2.22.0 against canonical v2.23.0 (not synced). (14) `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices, edit with a Python script (`python3 -I -`). After answering
a direct question, STOP and wait (memory).

### What Session 337 Did
**Deliverable:** g02 of the backlog ordering plan, twenty-first session: the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones, found by Session 336's own probes and its review round, none of them in its diff" -- parts (1) to (8), the eight single-line `RangeError` shapes (`ATTR_ATOM_RUN`'s id group, `GRID_PLAIN_BORDER`, `COMMONMARK_HTML_TYPE7_OPEN`, the empty native-div pattern in `endsHtmlBlock`, `R_SYMBOL_CHAIN`, `REF_USAGE`, the unnamed-argument string mask of `knitrHeaderOptions`, `KEY_LINE`), taken in order of cost; parts (9) to (11), the three quadratic shapes, stay in the item for the Session 318 and 319 quadratic items (IN PROGRESS)
**Started:** 2026-10-29
**Status:** Session claimed. Work beginning. Strict TDD: time each literal shape at HEAD first, one fresh process per probe (Learnings 840 and 871: the item's first-throw figures are the verifiers' bisects, re-bisect with the lower bound verified OK before quoting one), make the RED row assert the ANSWER (a `RangeError` answers nothing for the whole document) and read every row WITH the engine hint (Learning 886: `buildOutline(text, "knitr")`, `"jupyter"`, `indexLabels(text, "knitr")`, `findLabel(text, id, "knitr")`). The item says all eight are the Session 335 class (an index loop or a respelling, the old pattern kept as the oracle, a code-unit sweep); that is the item's claim and UNTESTED here, and its hosts and thresholds are agent-measured. Scope is by cost: the session closes at the last part whose whole slice (RED rows, seam and oracle, cure, mutants, review) lands, and the parts not closed stay in the item.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

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

## Session 333 Handoff Evaluation (by Session 334)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `39bb039`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`, at `6152f28`), the real-document score
(2423 of 2438) and the `master` count (56 commits ahead) all held, and the picker the plan ranked was accurate: candidate (a) was the S318 item's parts (4) to (7), placed by finishing a feature, and the item's figures held (`htmlLineHasText` 256 / 994 ms at
10,000 / 20,000 against the item's 251 / 981).
**Helped:** gotcha 2 (the harness is gone: rebuild it from tracked files with three commands) took minutes and worked; gotcha 3 (quoted heredocs, bash loops, wait on a log's end marker) kept me out of the stray-file trap; gotcha 4 (the runner tests the COMMITTED
source) held; gotcha 5 (the pins are incomplete) was true a twentieth time; Learnings 840 and 739 made me time the literal shape and profile before reading the cure; gotcha 6 named the clock rows that flake.
**Missing:** nothing that cost time. **Wrong:** nothing I checked (the handoff's warning that the lookahead recipe is NOT equivalent for the YAML alias held: `*a#b,`). **ROI: high.**

## Session 334 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the four literal shapes in fresh processes at HEAD before reading code (they held) and profiled before the cures; the clock rows were RED on the parent (22 of 32, on the clock alone, `8cbb2d2`) before any cure; each part has a
seam-and-oracle commit (RED: the import was not a function) and a cure commit; the old spelling is the oracle in a test of its own beside a reading by definition; a scratch differential of 216 million strings found no difference; the mutation runner found four
incomplete pins of mine on the first run (95 mutants) and I fixed them; the five-lens review reproduced nothing wrong in the cures and I reproduced every claim I acted on with my own builders (the old-function stack overflow, the cap and wiring survivors by a
mutant-bundle fuzz, the touching-attribute divergence by rendering nine documents with quarto), and filed what I did not fix.
**Went wrong.** (1) My pins were incomplete a TWENTIETH time, and the review showed how: the answers were pinned only on strings of at most about 260 characters over small alphabets, so caps at 4,096, 65,536 and 2^20, a guard on part of the value, whitespace
characters no alphabet held, `$`, `&a`, `!a`, the call sites and the `at = close` cost guard were all alive (82 real gaps of 127 survivors). (2) A row of mine claimed quarto's answer without a render and was wrong (link attributes that touch the URL); I replaced
it with RESIDUAL rows only after the mutation run exposed that my link-wiring rows put a thematic break last and killed nothing. (3) One stated answer of mine was wrong in the first round (`*a` + U+0085 is an alias named `a` + U+0085). (4) Five numbers in commit
messages are wrong (enumeration sizes quoting the pinned TRUE counts, 32 for 33 failing rows, "within 5%" for a shape 22 to 46% slower, "7 argued equivalent" for 9, 14.3 million for the yaml file); I cannot amend them and corrected them in the CHANGELOG. (5) The
item's second pattern for part (7) was needless and its "74,160 of 6,725,601" I did not re-count (said so in the comment). (6) Shell traps again: a `cat >` with no stdin hung a call, an `rm -rf *` after a `cd` was blocked (no harm; I used a fresh directory), and
a detached job's wrapper notification looked like completion. (7) TDD deviations, disclosed: the oracle files, the controls and every review-round row pass on arrival; their RED is a mutant (232 edits across nine lists: 192 killed, 40 argued or without a
witness), and the first-round link rows were green and wrong.
**Known residuals (filed or stated):** the BACKLOG Up Next items "Three more slow shapes found by Session 334's review round" and "Two answers where this build and quarto differ", the amended `isAttributeBlock` and Session 319 items, the Session 333 item "Six
more shapes", the S317 stack overflows (4) to (9), the S322 item's part (1), the S311 item's parts (4), (10), (11); two mutants with no witness (HC04, HC05); `test:integration` NOT run.
**TDD:** RED before GREEN for the clock rows (`8cbb2d2` before the cures) and for each oracle's seam (the import was not a function: `855e0e0`, `11102a0`, `5917d42`, `6c1417e`); every later row is mutant-RED.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 73 agents in 1 workflow (8,213,265 subagent tokens; 2,085 tool calls; 3.6 hours), 232 runner mutants of mine in nine lists (95 + 137, with re-runs), a 216-million-string scratch
differential, 20 quarto renders (three at a time, `--no-execute`), the machine at load 5 to 250 from other projects and the workflow.
