# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 334 closed out.** g02's eighteenth session is done: the S318 item's parts (4) to (7), four regexes in `src/core/qmd/model.ts` (`htmlLineHasText`, `linkAttributesHaveJunk`, `knitrOptionNames`, `yamlAliasName`), and with them the item,
which left BACKLOG.md. Each read its text from every start and is a function now with the old spelling as the oracle in its own test file (40,000 `<` 3.9 s to 17 ms; 60,000 braces 3.3 s to 12 ms at a million; 72,000 letters 3.2 s to 99 ms at a million; 72,000
`#` and a CR about 3 s to 7 ms). Commits: `08b271f` the claim; `8cbb2d2` the RED rows; `855e0e0` to `b48ecf7` the seams and cures; `0c072f6` to `5ebc915` rows and mutants; the review round `990cade` to `00a1ae0`; records `ef32c94` to `0bfca56`; then the
close-out commits. `BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each saying which rule placed it.
**What's next (derived from the plan, not a promise):** g02 is still in flight; its items are taken in the plan's table order. Candidates (the picker shows three and a catch-all): (a) the S317 item's parts (4) to (9), the regex-stack overflows (a RangeError
answers NOTHING for the whole document); (b) the S322 item's part (1) (`collectValueSources` per cell option line) and the S311 item's parts (4), (10), (11); (c) the new Up Next items "Three more slow shapes found by Session 334's review round" (quote-hosted
`:::` openers, `embeddedCellAt` per line, `endMarkerBelow`), the amended `isAttributeBlock` item (it has a SECOND quadratic regex, `FENCE_RUN`, so its guessed cure is not enough) and "Six more shapes found by Session 333's review round". "Two answers where this
build and quarto differ" (link attributes that touch the URL; the dead `max.print` entry) belongs to g22 and g14. Time the literal shape at HEAD FIRST (Learning 840). After those, the terminal bounded session files ONE RESIDUAL record, owns the sweep's unrun 68%
(rule P5; the operator's decision of Session 325) and stops. Decisions as the plan says: D2, D3 before g03.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) No harness of this session is in the repo (it lived in the session scratchpad). Rebuild (Learning 848): `git archive <sha> src | tar -x -C dir`; `node_modules/.bin/esbuild src/core/qmd/model.ts --bundle --platform=node --format=cjs --outfile=x.cjs`; one
fresh process per timing. A mutant applied by a Python `replace` (assert it occurs once) and bundled the same way gives a differential in minutes (this session's `mut_*.cjs` found the documents for the 4,096-character cap and the touching link attributes).
(3) SHELL: write generated files through QUOTED heredocs; zsh does not word-split `$var`; a `run_in_background` Bash that starts a detached job notifies when its WRAPPER exits and looks like completion: start the job with `(nohup bash x.sh >/dev/null 2>&1 &)`
and wait with Monitor on a DONE file; `cat > file` with no stdin hangs; `rm -rf *` after a `cd` is blocked (use a fresh directory); the Write and Edit tools turn a backslash-u escape for U+2028 into the raw character (Learning 792).
(4) The runner tests the COMMITTED source, copies `--tests` files from the working tree and SKIPS a stale `from`; run `mutation-lists-apply.test.ts` first. This session's lists (README rows hold the commands): the six `s334-*` lists (95) and
`s334-review-functions` (87), `-wiring` (33, the whole suite minus clock rows) and `-tests` (17).
(5) Pins are incomplete a TWENTIETH time (Learnings 864 to 870): 4 of 95 mutants alive on the first run and 82 real gaps in the review (the answers were pinned only on strings of at most about 260 characters; the call sites; a pre-existing cost guard, `at =
close`). A row's claim about quarto is a RENDER: nine documents rendered three at a time showed one of my rows wrong (link attributes that touch the URL), now a RESIDUAL row.
(6) Clock rows flake under load: `qmd-model.test.ts` Session 307 and 308 rows, `math-scan-equivalence.test.ts`, the oracle file of `column-stack.test.ts`, `paragraph-interrupt-equivalence.test.ts`, the million-character row of
`grid-table-border-equivalence.test.ts`. Name them, re-run the files alone, never loosen.
(7) Residuals: the BACKLOG items above; 31 review mutants survive on purpose, two with NO witness (HC04, HC05 in `s334-review-wiring.json`: the trim and the 4,096-character cap in `endsFreshHtml`); four regexes that are superlinear alone but unreachable from
document text (`jupyter-kernel.ts:43`, two `#.*$` tails in `yaml-value-check.ts`, `version.ts:29`) are left alone. Wrong figures in five commit messages are corrected in the CHANGELOG, not amended. The lenses' full results are in the workflow's `journal.jsonl`
under `~/.claude/projects/.../subagents/workflows/wf_4c0e316d-989`.
(8) The foreign worktree `.claude/worktrees/wf_f559ba89-653-5` is still not mine: ask before removing it. (9) `test:integration` NOT run for twenty-four sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 13,458 tests in 109 files, clean.
(10) Real-document score: `REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt tools/realdoc-score/run.sh head` prints 2423 of 2438 (99.38%), 15 divergent; unchanged by this session (the cures answer the same on 216 million strings).
(11) The plan: update its status column AND its in-flight, next-group and g02 order-table rows at each close-out (done in this one). (12) `master` is NOT pushed: 81 commits ahead of `origin/master` when the close-out began (Sessions 330 to 334); the dashboard
copy is v2.22.0 against canonical v2.23.0 (not synced).
(13) `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices, edit with a Python script (`python3 -I -`). macOS `sed` rejects `|` as a delimiter and `sed -i` needs `''`. A foreground `sleep` is blocked:
use a background run or the Monitor tool. After answering a direct question, STOP and wait (memory).

### What Session 335 Did
**Deliverable:** g02 of the backlog ordering plan, nineteenth session: the Session 317 item's parts (4) to (9), the regex-stack overflows (`pipeTableOpensHere`, the front matter `from:` extension lists, the YAML tag and anchor group, a run of `#`, a run of `>`, the LaTeX macro argument tail) (IN PROGRESS)
**Started:** 2026-10-28
**Status:** Session claimed. Work beginning. Strict TDD: reproduce each literal shape at HEAD first, in fresh processes (Learning 840; the item's figures are Session 317's), and read the failure: a RangeError that answers nothing for the whole document is the defect, so the RED row asserts the ANSWER on a line of millions of characters, not the clock. Profile BEFORE reading the cures (Learning 739).
The item says parts (4) to (9) are part (8)'s class (rewrite the group away, keep the old pattern as the oracle, enumerate short strings, then time a failing near-miss line as well as an accepted one); that is the item's claim and UNTESTED here. One checkpoint commit per part (5-file cap per commit); if a part does not overflow at HEAD, pin it as Session 329 did. Operator decision at Phase 0: these parts (recommended; placed by finishing a feature and by robustness).
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

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

## Session 332 Handoff Evaluation (by Session 333)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `03f9696`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`, at `8efa6ac`) and the real-document score
(2423 of 2438, re-measured at close-out) held, and the picker the plan ranked was accurate: candidate (a) was the S318 item's part (1), placed by finishing a feature, and the item's figures held (`+` + dashes + ` -` 374 / 1,507 ms at 10,000 / 20,000
against the item's 354 / 1,394).
**Helped:** gotcha 2 (the harness is gone: rebuild it from tracked files with the three commands) took five minutes and worked; gotcha 3 (quoted heredocs, bash for loops) kept me out of the stray-file trap; gotcha 4 (the runner tests the COMMITTED source)
held; gotcha 5 (the pins are incomplete) was true a nineteenth time; Learnings 840 and 739 made me time the literal shape and profile before reading the cure; gotcha 6 named the clock rows that flake, and two did under the review's load.
**Missing:** nothing that cost time except the `master` count: the handoff said 37 commits ahead and Orient measured 42 (three commits were made after the count was written, and two were not in it). **Wrong:** nothing else I checked. **ROI: high.**

## Session 333 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the item's shape in fresh processes at HEAD before reading code (it held), profiled before reading the cure, and showed the clock rows RED first (16, on the clock alone, answers already right). The old spelling is the oracle in a test of its
own, with four enumerations (4,819,915 strings, counts recounted by a Python port of the definition), a reading by definition with no regex, a scratch run of 47,079,208 strings and wrong cures the comparator must see. The runner found two incomplete pins of mine
(G01 killed only by its 600 s timeout, C04 alive at 599 ms) and I fixed both. The five-lens review found 0 semantic differences and I reproduced every claim I acted on with my own builders before changing a file (the ungated tail beside a border, the long
line at the third site by a counting bundle, the S03 and S04 row counts, the 346,476 control, the two document-level differences for R06 and R07), and I filed what I did not fix instead of dropping it.
**Went wrong.** (1) Three records, a Learning and a test comment said an `x` tail never reaches the pattern and the third call site never sees a long line; both were claims about my probes (about 100 documents, none with the third site's trigger, and no `x` tail
beside a border), and the review corrected them. (2) My pins were incomplete a NINETEENTH time: 12 of the review's 15 new mutants were alive on my rows (a `+` star after the class star and a tab star after the blank star, which I should have found by listing every
adjacent pair of stars; the old spelling at the third site alone; a class widened to `|`, a form feed or a no-break space; repetition caps), and my alphabet had none of those characters. (3) Twelve statements were wrong or too wide (the 5,094 control attached to the
wrong run in four places, G21's note, S03 and S04 "4 rows" against 17 and 14, the 18% of the wrong denominator, "a 30,000-space control" that was a never-committed draft, "both against a reading by definition", the 2 ms and 6 ms figures on different bases); I had also
drafted "about 590 ms" before I measured 599. (4) The cure reads an accepted run twice (1.9x the old spelling on a long accepted line) and a one-pass spelling exists; I did not find it, did not adopt it once the review did (microseconds a call; the mutants naming the lookahead
would be rewritten) and filed it. (5) TDD deviations, disclosed: the oracle file, the added controls, the C04 and G01 fixes and the review round's rows all pass on arrival; their RED is a mutant (12 of 15 alive on the tests as committed, 14 killed after, run with the
runner). (6) The machine ran at a load of 3 to 20 from other projects, and 15 to 240 during the review lenses, so I re-ran every cited timing at 6 to 10.
**Known residuals (filed or stated):** the Up Next item "Six more shapes found by Session 333's review round"; the S318 item's parts (4) to (7); the S311 item's parts (4), (10), (11); the `isAttributeBlock` prefix item; the S322 item's part (1); the S317 stack
overflows (4) to (9); `test:integration` NOT run.
**TDD:** RED before GREEN for the clock rows (`4f4560b` before `a429813`) and for the oracle's seam (import undefined, `2fcd716`); every later row is mutant-RED.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 42 agents in 1 workflow (4,692,545 subagent tokens; 1,258 tool calls; 2.1 hours), about 150 runner mutants of mine (36 + 4 + 2 + 15 + 11, with re-runs), a 47-million-string scratch
enumeration, 0 quarto renders (the oracle ran warm).

## Session 331 Handoff Evaluation (by Session 332)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers (at HEAD `8e03d50`, gap 0), no `pending` receipt (the one grep hit is prose inside an old receipt's gotchas), the
ratchet citation (2/2, results `bba236856bad`, read from the results file) and the real-document score (2423 of 2438, re-measured at close-out) held, and the picker the plan ranked was accurate: candidate (a) was the S318 item's
part (9), placed by finishing a feature, and the item's own figures held (`x` x 2,000 / 4,000 / 6,000: 334 / 1,210 / 2,667 ms against the item's 321 / 1,194 / 2,653; `- item` and `===` x 5,000 2,051 against 1,980; `~ a` under
`commonmark_x` 212 / 763 against 203 / 744).
**Helped:** gotcha 2 (the harness is gone: rebuild it from tracked files, with the three commands) took five minutes and worked at once; gotcha 3 (the runner tests the COMMITTED source; run `mutation-lists-apply.test.ts` after a
refactor) caught W29 of the Session 331 list at the first full `npm test`, which I retargeted instead of deleting (Learning 852); gotcha 4 (the pins are incomplete) was true an eighteenth time; the Learning 840 and 739 lines made me
time the literal shapes and profile before reading code, which found the item's hypothesis right and its cure incomplete; gotchas 1, 7, 8, 9 and 13 held, and I waited at the picker.
**Missing:** nothing that cost time. The handoff and the BACKLOG item both called the item's cure "UNTESTED" and it was: computing the count only at an underline left a second quadratic shape on the same line (an interrupter far
down the paragraph, then many underline-shaped lines), which my own timing found at once, and the cure that followed had two faults that only the review found. **Wrong:** nothing I checked, including the `master` claim (22 commits
ahead of `origin/master`, Sessions 330 and 331). **ROI: high.**

## Session 332 Self-Assessment

**Score: 7/10.**
**Went right.** I timed the item's shapes in fresh processes at HEAD before reading any code (its figures held), profiled before reading the cure, and found a second quadratic shape on the same line by timing the cure's own residue,
before any review. The clock rows were RED first, three times, and I read each failure message to confirm it was the clock with the answer already right. The old expression is the oracle, with an exhaustive count recomputed by a
script that does not use the project's code; a differential against the parent found 0 differences in 12 million documents and saw 9 of 9 deliberate breakages; the mutation runs found a false "equivalent" of mine (G08) and two rows
I had missed. I ran two review workflows (ten lenses, 2.7 million subagent tokens), and every claim I acted on I reproduced here with my own builders before changing code (the three-line unit, the long first line, the false control
row), and I kept the lens findings I did not act on in the BACKLOG instead of dropping them. I waited on the logs and on the quiet machine for the final timings.
**Went wrong.** (1) The cure was incomplete twice and the review found it, not me: the memo keyed on the columns ARRAY (I wrote "the columns of an open paragraph almost never change between two questions" from 412 changes in 400,000
documents, a count taken WITH the gate; asking at every line it is 136,244), and the whole-paragraph else-branch, which I chose by what an uninterrupted paragraph holds without timing a long first line (17x the parent). (2)
Statements I wrote were wrong or unsupported in 35 places across the two rounds (20 and 15), among them three claims of equivalence or of no witness (G08, G01, P07) and a "control" row that is quadratic on the parent from 16,000
lines; I measured it at 4,000 only. (3) My pins were incomplete for the EIGHTEENTH set: the first 35 mutants left 3 contradicting their expectation and the lens's 81 left 11 that no row noticed. (4) Shell slips, four: zsh
word-splitting twice, an unquoted heredoc three times (a mangled test file, eaten backticks in notes, and a stray empty file named `=` that failed `npm run package` until I removed it), a pin list rebuilt from a runner diff that
lost 12 entries, and a mutation run that hung for 600 s per clock mutant until the loop read the clock. (5) TDD deviations, disclosed: the oracle was written against a throwing stub (RED shown), but the class, the wiring rows and
most of the oracle's later rows were written after the first cure, so their RED is a mutant, shown with the runner. (6) The machine ran at a load of 3 to 13 from other projects; the final timings were taken again at 3 to 5.
**Known residuals (filed or stated):** the Polish item "Session 332 residuals of the paragraph-title scan"; the S318 item's parts (1), (4) to (7); the S311 item's parts (4), (10), (11); the `isAttributeBlock` prefix item; the S322
item's part (1); the S317 stack overflows (4) to (9); `test:integration` NOT run.
**TDD:** RED before GREEN for the clock rows (`b8a62a8` before `be9eed7`, `9cde0dc` before `f440341`, `0918c3f` before `944fccb`) and for the oracle's class (stub, then class); the wiring and review rows are mutant-RED.
**Host:** `test:integration` NOT run (core-only; it takes the screen). **Cost:** 10 agents in 2 workflows (1,626,651 and 1,039,720 subagent tokens; 569 and 328 tool calls; 2.24 hours and 53 minutes), about 190 runner mutants of mine
and the lens's 105, a 12-million-document differential, 0 quarto renders (the oracle ran warm).
