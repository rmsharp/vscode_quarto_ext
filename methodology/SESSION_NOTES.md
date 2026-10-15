# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 314 (IN PROGRESS): items (2) and (6) of the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028 after Session 312"** (operator pick at Phase 0, the recommended option).
(2) the two `[ \t]+$` value trims (`knitrChunkHeaderLabel`, `asciiTrim`); (6) `resolveDocumentEngine` and the front matter readers are quadratic in the NUMBER of nested keys. Strict TDD.
**State:** claimed; Phase 0 found both ledger frontiers at HEAD, no `pending` receipt, the ratchet citation matching (2/2, results `bba236856bad`). Baseline `npm test` per Session 313's receipt (11,176 in 81 files); re-measured below once run.
**What the BACKLOG now holds:** the sweep item's (2) to (7) (two value trims, the `#|` gap, closing-run and rule-row patterns, the CR / U+2028 family, nested front matter keys); the Session 311 item's (3) to (9), with (3) corrected
(IDENTICAL unclosed fence lines are quadratic too: 3.9 s at 16,000 lines); and a NEW item (the non-tail parts of the four literals are pinned by no test). The Session 165 item for `languagesInMarkdown` is deleted (fixed).
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) TWO scratchpads: the repo's untracked `scratchpad/` (`s312/` holds the mutation scripts, the corpus differential, the agents' and reviewers' scripts and a README) and the session one under `/private/tmp/...` (frozen trees, probes; not durable).
(3) The Edit tool EXPANDS an escape such as `\u00a0` into the glyph: write it from a quoted heredoc and `grep -c $'\xc2\xa0'` every file you touched. `cmd | grep ... && git commit` tests the grep: redirect a gate to a file,
`set -o pipefail`, print `$?`. After a scripted edit COUNT the rows.
(4) zsh does not word-split `$VAR` (it bit me again): `${=VAR}`. A failed `toEqual` of two 100,000-character strings costs vitest 6 s of diff: probe the small-n output, pin it, THEN add the clock. Read an entry's signature
before calling it (`completionContextAt(text, offset, thunk)`).
(5) Two timing rows flake under load (Session 307's 9 MB row and Session 308's 200,000-line row failed in 3 of 5 full runs with four to six agents measuring; 0.7 s alone). Never loosen; run alone. A mutation pass counts a
flake as a kill: run it ALONE and read the failing titles (`mutate312.py` prints them).
(6) Agents: `pkill -f <their scratch dir name>` after each reports (a reviewer's shell loop ran for an hour); bound a "find every other" sweep in its prompt; after a resume an agent may lack its structured-output tool and
hand back by message, so a monitor that waits for N results never fires.
(7) `test:integration` NOT run (core-only, takes the screen: ask). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md`, `PROJECT_LEARNINGS.md` are past the 262,144 B read refusal: read in slices. Baseline `npm test` at HEAD: 11,176 passing in 81 files.
(8) The BASH tool's quoted heredoc expands `\uXXXX` into the glyph too (`regex-equiv.js` got raw U+2028 and NBSP): write such characters with `chr()` or doubled backslashes from Python and `grep -c` the file. `rm -rf $A/$B` is
BLOCKED by the safety check: use literal paths, and `git worktree remove --force <literal path>` for a worktree. A `( cmd ) &` inside a background Bash 'completes' at once: poll the process, not the notice.
(9) FOUR timing rows flake under load, not two: Sessions 307 (9 MB) and 308 (200,000 lines) and, in `pathological-inputs.test.ts`, Session 311's "a cell option's value holding a 100,000-space run" and "many unclosed long openers".
The operator's own `devtools::check` on another R package took the load to 22 here: look at `ps` before blaming a change, run the suite alone, never loosen.
(10) Session 313's harness is `scratchpad/s313/` (README): `oracle-table.ts` + `gen-pin-test.py` (the pin rows from the PARENT's answers), `regex-equiv.js <depth> narrow|wide` + `regex-equiv-mutcheck.py`, `mutate313.py <worktree> <json> <test files>`
and `mutate313-slow.py`, `corpusdiff313.cjs`, `hdr2.ts`. A clock row needs its OWN text (the engine-blind region cache holds two entries) and a mutant that is still quadratic but cheaper.

### What Session 314 Did
**Deliverable:** items (2) and (6) of the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028 after Session 312": the front matter value trims and the nested-key quadratic (IN PROGRESS)
**Started:** 2026-10-15
**Status:** Session claimed. Work beginning. Phase 0 found both ledger frontiers at HEAD (`55390b90`, gap 0), no `pending` receipt, the ratchet citation matching (2/2, results `bba236856bad`).
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

## Session 312 Handoff Evaluation (by Session 313)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1 to 7, both ledger frontiers at HEAD (`7a07bc86`, gap 0), the ratchet citation (2/2, results `bba236856bad`), the test
baseline (10,913 passing in 80 files, exact) and the "Active empty, present candidates" instruction all held at Phase 0, and the numbers of the item I took reproduced: `findHeadings` 448 ms, 1.8 s and 7.1 s (465 ms, 1,812 ms,
7,125 ms here) and the engine resolver 9.4 s (9.5 s). The line numbers of the four literals (65, 549, 6714, 6767) were exact.
**Helped:** item (1)'s own repro shape with its "MINE" marks; `scratchpad/s312/` (README, `probe-template.ts`, `topself.py`, `mutate312.py`, which I copied and gave a test-file argument); gotcha 5 (a mutation pass counts a flake as a
kill), which sent every pass to a throwaway worktree with two test files; the recipe in the item ("profile the timed shape first, keep the OLD pattern as the oracle, mutate the fix, compare parent against final").
**Missing:** that `KNITR_CHUNK_BEGIN` already carried this exact cure with a comment explaining it (a one-line proof and a sibling to copy); that `START_CODE_CELL` runs twice per `findHeadings` (66% of the profile); that the class is
wider than "unterminated" (`} x`, `}x` and a bare run of spaces are quadratic too); that Session 165 had filed this very regex (BACKLOG, still open); that the region cache holds two entries, so a second clock row on the same text
looks cheap; and that FOUR rows flake under load, not two.
**Wrong:** (a) "an unterminated header" as the whole shape; (b) gotcha 3 says the EDIT tool expands `\uXXXX`: the Bash tool's heredoc does the same. **ROI: high.**

## Session 313 Self-Assessment

**Score: 8/10.**
**Went right.** I reproduced the defect firsthand, profiled before reading code (99% in three regexes, `START_CODE_CELL` twice), and every fix row was RED for the right reason (the result assertion passed, only the clock failed: 2,395,
2,401, 2,235 and 2,393 ms). Exactness has three independent legs: the old and new literals agree on every capture group over 430 million comparisons (1.43 billion on a 16-character alphabet), the corpus (3,382 documents, five probes) shows
ZERO differences, and the real-document score and the Outline model output are byte-identical to the parent's (2,423 of 2,438). A four-lens read-only review (4 agents, about 0.8M subagent tokens, none read third-party source) returned 30 findings: NO defect in
the change; the rest gaps and wording in my tests and record, each checked firsthand before I acted (fixed or corrected, one partly refuted: dropping `.trim()` at the main `CELL_INFO` call IS killed; the pre-existing holes filed).
76 mutants of the final rows: 65 killed, the 11 survivors equivalent or redundant. Gates: `npm test` 11,176 in 81 files, oracle 2 of 2, `npm run package` DONE (44 files, 1.86 MB). Learnings 754 to 759.
**Went wrong.** (1) My first clock rows were weak: 32,000 spaces (2.4x margin), one shape, and three of four passed a cheaper quadratic; the review measured it, I did not. (2) Three of my first five pin observables were constant over the
table, and my comments said the silent-chunk rows pin `KNITR_CHUNK_INFO` when they pin `KNITR_CHUNK_BEGIN`. (3) Commit messages said "430,467,200 strings" (comparisons) and merged two profiles, and my first harness mutation-check was an
inline command I never saved, over an alphabet with no tab or form feed. (4) A mutation runner of mine reused a variable name and left a mutant applied in the worktree (caught at once). (5) A quoted heredoc turned `\u2028` into a raw glyph
again. (6) About eight "have not heard from you" nudges: the review took 35 minutes and the mutation passes ten. (7) `rm -rf` on shell variables was refused by the safety check; I had no need of it.
**Known residuals (filed):** the sweep item's (2) to (7); the Session 311 item's (3) to (9) with (3) corrected; the non-tail item; the earlier Up Next items are untouched.
**TDD:** RED before GREEN for the four fix rows. Passed on arrival, disclosed: all 255 pin rows (written from the parent's answers, then mutation-checked), and the 8 final clock rows (written after the fix; each shown failing against the
parent, 22 to 94 s, and against the one-literal reverts, 8, 6, 2 and 2 rows).
**Host:** `test:integration` NOT run (core-only change in `src/core`; it takes the screen and nobody was asked); the packaged bundle was grepped for the four new spellings instead. **Cost:** 4 agents (1 workflow), 177 mutant runs, 1.9 billion
regex comparisons, 16,910 corpus comparisons, one `npm run package`, 0 quarto renders beyond the cached oracle.

## Session 311 Handoff Evaluation (by Session 312)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1 to 8, both ledger frontiers at HEAD (`a34f6e16`, gap 0), the ratchet citation (2/2, results `bba236856bad`), the test
baseline (10,876 passing in 79 files, exact) and the "Active empty, present candidates" instruction all held at Phase 0, and the numbers of the item I took reproduced: 5.6 s for 8,000 `{#sec-...}` headings (5,611 ms here) and 11.9 s
for a 100,000-space key (11.2 s).
**Helped:** `scratchpad/s311/resid.ts` and its README (the build-and-run recipe, one process per shape); `mutate311.py` (copied, plus the failing titles); gotcha 5 (count the mutant result lines) and gotcha 6 (mutation-check a
harness), both used; gotcha 3 (the Edit tool expands an escape), which made me write every non-ASCII character from a quoted heredoc; the item's own "profile first", which put 98.5% of the key trim in one regex and showed it split
between two sites.
**Missing:** that the key trims reach the Outline, cross-reference and workspace-symbol providers through `resolveDocumentEngine` on every request (the mapping agents found it); that a SECOND timing row flakes (Session 308's
200,000-line row, 2.1 s against 2 s, with four agents measuring); and that `findProjectConfigValueLines` calls `mappingContainerKey` only for a column-0 key.
**Wrong:** (a) "seven `/[ \t]+$/` trims ... `yaml-context.ts` twice": EIGHT, three of them in `yaml-context.ts` (216, 337, 453); (b) "20,000 headings 22.8 s": that is the 16,000-heading figure (22.3 s and 23.3 s measured; 20,000 is
about 35 to 39 s); (c) "a book chapter with thousands of section ids reaches it": the cost is headings times lines (8,000 one-line headings take 1.7 s, 8,000 in a 32,000-line chapter 5.6 s). **ROI: high.**

## Session 312 Self-Assessment

**Score: 8/10.**
**Went right.** I reproduced both defects firsthand, profiled before reading code, and found the key trims were two sites on the resolver's path (fixing one halved the time, both took 12.3 s to 13 ms). Every row was RED first for
the right reason except where disclosed. Three independent checks agreed with the diff: a read-only agent's scratch prototype was the same 8 lines, a second agent's profile gave the same halves, and the corpus run showed ZERO
differences over 3,382 documents (after mutation-checking the harness: a wrong label column was seen in 180 documents and a no-op trim in 199). A three-lens review (two workflows, nine agents, about 1.7M subagent tokens, none read
third-party source) found NO behaviour difference in about 140 million differential cases and seven defects of my tests and record, all fixed; the main one was that 8 of 8 `trimEnd()` swaps survived. Mutation 39 of 39 killed, each
kill attributed to a test title. Gates: `npm test` 10,913 in 80 files, oracle 2 of 2, `npm run package` DONE (44 files, 1.86 MB), real-document score 2,423 of 2,438 unchanged. Learnings 746 to 753.
**Went wrong.** (1) A "reach" row for `mappingContainerKey` protected nothing and I shipped it with a note that a mutation pass must decide; the critic decided it. (2) The first test round had no row that pins "space and tab only"
at any site, the one thing the item warned about in capitals. (3) I copied "20,000 headings 22.8 s" into a test comment without re-measuring, wrote a test title that said "seven characters" for an alphabet that ran to six, and wrote
a CRLF row that cannot tell `\r?\n` from `\n`. (4) A first RED row called `completionContextAt` with the wrong arguments (null in 5 ms); another "failed in 6 s" because vitest diffed two 100,000-character strings. (5) The sweep
agent ran 45 minutes and had to be stopped by message, and a reviewer's shell loop kept a core busy for an hour (found when my first mutation pass looked slow): I re-ran the pass and its failing titles now show each kill. (6) Two
timing rows flaked in three of five full runs and I committed with the failures named in the message and shown to pass alone instead of waiting for a quiet machine; the final run was clean. (7) About ten "have not heard from you"
nudges during long waits, and three monitors that waited for a result that could not arrive. (8) I re-measured value-side siblings (`asciiTrim`, `knitrChunkHeaderLabel`, the `#|` gap) and filed them with figures rather than fixing
them: one deliverable.
**Known residuals (filed):** the BACKLOG items by title: "Other regexes still quadratic on a long run of blanks, CR or U+2028 after Session 312 ..." (1) to (7), and "What is still quadratic or deep enough to overflow after Session
311 ..." (3) to (9); the earlier Up Next items are untouched.
**TDD:** RED before GREEN for the label rows (5,868 and 5,701 ms), the helper (`is not a function`), the resolver row (12,276 ms), the `project-yaml.ts` and `yaml-value-flags.ts` rows (6,238, 7,471 and 6,366 ms) and the
`completionContextAt`, `mappingContainerKey` and `findNestedFrontMatterValueLines` rows (6,147, 6,215 and 6,196 ms). Passed on arrival, disclosed: the CRLF row, the seven "still trims the blanks BEFORE the colon" rows, the nine rows
of the critic round (eight no-break-space rows and the third alphabet, each killed by its mutant), the column-0 container row (written after the code, killed by its mutant) and the indent-2 reach row it replaced.
**Host:** `test:integration` NOT run (core-only change in `src/core`; it takes the screen and nobody was asked). Headless instead: unit suite, oracle, corpus identity, mutation, `npm run package`. **Cost:** 9 agents (2 workflows,
about 1.7M subagent tokens, 502 tool calls), 78 mutant runs, about 140 million differential cases (the reviewer's), one `npm run package`, 0 quarto renders beyond the cached oracle.

## Session 310 Handoff Evaluation (by Session 311)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1 to 8, both ledger frontiers at HEAD (`677fae9a`, gap 0), the ratchet citation (2/2, results `bba236856bad`), the test baseline
(10,815 passing in 77 files, exact) and the "Active empty, present candidates" instruction all held at Phase 0, and every number in the BACKLOG item I took reproduced: the 1.96 s resolver cost (1.86 s here), 52 s for the code-span line
(51.5 s), 26 s for the unclosed flow mapping (26 s), the throw on `&#99999999999;`, and the 5 MB overflow.
**Helped:** the item's measured numbers and its repro recipes (a timing pattern at `refs-no-target.test.ts:485`, `trimEndSpaces` as the model for a linear trim); gotcha 6, the 9 MB timing row, which flaked exactly as written (1.63 s at load
43, 55 to 72 ms alone); gotcha 4 (zsh `${=VAR}`), which I hit the same minute; the Phase 0 picker rule.
**Missing:** the CAUSES, which one profile each supplied: (3) is not in `indexLabels` but in `scanRegions`'s fence regexes, so EVERY reader answered nothing; (2) is one regex in `maskInlineCode`; (5) is `flowRegion`; that a first fix of (3)
moves the failure to an index with one bucket per run length; and that the sibling KEY trims are `[ \t]+$`, so `trimEnd()` is wrong for them.
**Wrong:** (1) named the `\s#` trims (the cost was `/\s+$/`), (3) named `indexLabels`, "the `execute: {` route declines early" was irrelevant, and "estimate: negligible reach" for the entity throw understates a whole-index failure. **ROI: high.**

## Session 311 Self-Assessment

**Score: 8/10.**
**Went right.** I reproduced all five defects firsthand, profiled each (`node --cpu-prof`, self time by function) and found causes the item had missed or misnamed: the `/\s+$/` trim, one code-span regex, `flowRegion`, four fence regexes in
`scanRegions`. Each fix has the cheapest exactness proof I could find: `trimEnd` against `\s` on all 1,114,112 code points; the fence regexes against the old ones on 3,843,200 comparisons; the code-span scan against the old regex as an oracle on
873,812 enumerated lines (9 of 9 mutants killed); `flowRegion` and the closer index against the parent on 140,000 + 120,000 front matters and 200,000 + 160,000 fence documents. After the first GREEN of (3) I profiled again and found 86%
of the time in a per-length bucket loop that would have turned a `RangeError` into a heap exhaustion; a range-maximum side list replaced it. Over all 3,383 corpus documents the parent's and final headings are BYTE-IDENTICAL; the real-document
score is unchanged (2,423 of 2,438); `npm test` 10,876 in 79 files, oracle 2 of 2, `npm run package` DONE (44 files, 1.86 MB). An independent review (3 read-only agents, about 0.9M subagent tokens, none read third-party source) found no
output difference, ONE REGRESSION of mine (the side list scanned per opener: 100,000 lines 2.9 s against 0.68 s, reproduced and fixed), eight pre-existing pathologies (re-measured, filed) and 13 defects of my record. Mutation passes (68 mutant
runs) found three real gaps in the first rows and five in the sparse-table rows; all closed or equivalent. Learnings 738 to 745.
**Went wrong.** (1) My side list shipped a regression behind a docstring that said "no real document has more than a few"; the hunter found it, not my own adversarial pass. (2) Four numbers in commit messages were wrong or underived
(`Eleven pin rows` were ten; `about 6 s each` hid an 18 s row; a guard row guarded nothing; `about 9 million` was never summed): corrected in the ledger and in the tip commit before anything sat on it. (3) My differential harness printed a clean
zero while exercising nothing, three times (a correlated LCG, no blank lines, headings that never varied). (4) The first guard row passed the mutant it was written for. (5) A Python splice with the wrong anchor duplicated half a test file
(the row count caught it); `cmd | grep && git commit` committed through a flake; the Edit tool wrote a literal U+FFFD glyph into `refs.ts`, which also made one mutant silently skip (found by counting 26 lines against 27 mutants). (6) About
six "have not heard from you" nudges during long waits. (7) I widened (1) to the sibling `slotsOf` trims and the cell-option KEY (disclosed), but filed the seven key trims of another class instead of fixing them.
**Known residuals (filed):** the BACKLOG item by title ("What is still quadratic or deep enough to overflow after Session 311"), items (1) to (9); the earlier Up Next items are untouched.
**TDD:** RED before GREEN for the four value-trim rows (5.9 s each at the parent), the three entity rows (`RangeError`), the two flow rows (5.4 and 5.6 s), the 5 MB row (`RangeError`, then 3.6 s against 1.5 s), the three mask rows (5.7 s),
the doubling row (2.9 s against 1.5 s). Passed on arrival, disclosed: the two oracle files (written after the scan; mutation-checked), the ten long-run pin rows, the guard row, the 7 rows of `c1b30f70`, the 9 + 12 + 6 rows of the review round
(each verified against the PARENT tree's answers first), and the 2 entity pin rows (they throw at the parent; written after the code).
**Host:** `test:integration` NOT run (core-only change: `src/core`; it takes the screen and nobody was asked). Headless instead: unit suite, oracle, corpus identity, `npm run package`. **Cost:** 3 agents (1 workflow, 279 tool calls), 68 mutant runs,
about 700,000 lines of generated differential input, one `npm run package`, 0 quarto renders beyond the cached oracle.
