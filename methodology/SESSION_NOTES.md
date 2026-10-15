# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 314 closed out.** Items (2) and (6) of the Session 312 sweep item are fixed: the `[ \t]+$` value trims (100,000 spaces 18.5 s to 8 ms) and the nested-key quadratic (8,000 keys 1,523 ms to 55 ms;
512,000 keys 1.7 s). `BACKLOG.md` "Active" is empty; present ranked candidates via AskUserQuestion at Phase 0.
**What the BACKLOG now holds:** the sweep item's (3) to (5) and (7), the new (8) and (9), and (6a) nesting depth (close to cubic: 1.2 s at depth 1,600), (6b) a no-break-space comment hides a key (lost diagnostic), (6c) the clock
rows' reach; the Session 311 item's (3) to (9); the non-tail pin item; the earlier Up Next items are untouched.
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
(7) `test:integration` NOT run (core-only, takes the screen: ask). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md`, `PROJECT_LEARNINGS.md` are past the 262,144 B read refusal: read in slices. Baseline `npm test` at HEAD: 11,221 passing in 83 files (see 13).
(8) The BASH tool's quoted heredoc expands `\uXXXX` into the glyph too (`regex-equiv.js` got raw U+2028 and NBSP): write such characters with `chr()` or doubled backslashes from Python and `grep -c` the file. `rm -rf $A/$B` is
BLOCKED by the safety check: use literal paths, and `git worktree remove --force <literal path>` for a worktree. A `( cmd ) &` inside a background Bash 'completes' at once: poll the process, not the notice.
(9) FOUR timing rows flake under load, not two: Sessions 307 (9 MB) and 308 (200,000 lines) and, in `pathological-inputs.test.ts`, Session 311's "a cell option's value holding a 100,000-space run" and "many unclosed long openers".
The operator's own `devtools::check` on another R package took the load to 22 here: look at `ps` before blaming a change, run the suite alone, never loosen.
(10) Session 313's harness is `scratchpad/s313/` (README): `oracle-table.ts` + `gen-pin-test.py` (the pin rows from the PARENT's answers), `regex-equiv.js <depth> narrow|wide` + `regex-equiv-mutcheck.py`, `mutate313.py <worktree> <json> <test files>`
and `mutate313-slow.py`, `corpusdiff313.cjs`, `hdr2.ts`. A clock row needs its OWN text (the engine-blind region cache holds two entries) and a mutant that is still quadratic but cheaper.
(11) The operator asked in Session 313 for a progress overview of the whole project; no file recorded it, and I answered in Session 314 and was told to STOP after answering until acknowledged (memory saved). The answer: v1
(highlighting, render, preview, run cell, outline, `@` completion) done since Session 9; v2 shipped (toggles, math and diagram previews, YAML completion read from the installed Quarto, embedded-cell forwarding, 33 commands);
recorded out of scope: visual editor, Zotero, the AI assistant, project-wide indexing (language server). No parity checklist against Posit's extension exists (build one by black-box observation); the Outline agrees with `quarto
render` on 2,423 of 2,438 documents; `test:integration` has not run for four sessions.
(12) Session 314's harness is `scratchpad/s314/` (README): `probe.ts` and `shapes2.ts` (n-scaled shapes, `@ROOT@` = a `src` directory), `corpus-entry.ts` + `corpusdiff314.cjs` (seven probes plus four `from:` variants) +
`mutcheck-corpus.py` (the harness is blind to the trim mutants and sees the index one), `mutate314.py` (pass test files to focus it) with `mutants314.json` (35) and `mutants314b.json` (14), `resid.ts`. `vi.spyOn(namespace,
"fn")` DOES intercept an importing module's call in vitest: the laziness rows use it with a control row.
(13) An R job and a VM held the load at 8 to 22 for hours: full runs fail Session 308's 200,000-line row (and once Session 307's 9 MB row) at 2.3 to 2.5 s; each passes alone at 0.71 to 0.75 s. A whole-suite mutation pass counts
them as kills: re-run survivors against the new test files alone. `git worktree list` also shows a foreign worktree under `.claude/worktrees/`: not mine, leave it.

## Session 313 Handoff Evaluation (by Session 314)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1 to 10, both ledger frontiers at HEAD (`55390b90`, gap 0), the ratchet citation (2/2, results `bba236856bad`), the test
baseline (11,176 passing in 81 files, exact) and the "Active empty, present candidates" instruction all held at Phase 0, and the numbers of the item I took reproduced: `findHeadings` on `from: gfm<run>x` 18.5 s (18,479 ms at
100,000 spaces), `knitrChunkHeaderLabel` 6.2 s (6,181 ms) and 8,000 nested keys 1.48 s (1,523 ms); `asciiTrim` was at `model.ts:3099` as filed.
**Helped:** the item's own shapes with their "MINE" marks and the reviewer's reach statement for `asciiTrim`; its hypothesis for (6) (`nearestShallowerLine` walks past every same-indent sibling), which ONE profile confirmed
(28.5% `leadingWsLen`, 27.0% `nearestShallowerLine`) and let me design at once; `scratchpad/s313/` (`mutate313.py`, which I copied and gave a test-file argument; the pin-from-the-parent idea) and `scratchpad/s312/topself.py`;
gotchas 5 and 9 (load-flake rows), which I met again (Session 308's row, 2.3 to 2.6 s under load, 0.71 s alone); gotcha 8 (non-ASCII from `chr()`), which sent me to `String.fromCharCode` in the new tests; "a clock row needs a
cheaper-quadratic mutant" (gotcha 10), though my rows still could not see one (6c).
**Missing:** that (6) is not about `format:` / `html:` or even about keys: any indented line under any container pays (an unlisted container, comment lines, block-scalar prose), sibling BLOCKS cost 3.5 times as much per line,
`valueFlags` enumerates twice, and the Outline, cross-reference and workspace-symbol providers all reach it through the resolver; that `asciiTrim` runs three times per `from:` line (18.5 s against 6.2 s for the same run); and
the depth residual.
**Wrong:** (a) the line of `knitrChunkHeaderLabel`'s trim, `model.ts:8325` (8,332 at HEAD: Session 313's own edits above it shifted it by seven); (b) the REACH sentence for (6) ("reached by the crossref provider") understates
it, as above. **ROI: high.**

## Session 314 Self-Assessment

**Score: 8/10.**
**Went right.** I reproduced all three defects firsthand and profiled before reading code (97.5 to 98.2% of the trim shapes in one regex; 55.5% of the nested shape in two functions), and every clock row was RED for the right
reason: the result assertion passed and only the clock failed (18,479, 6,111, 6,181, 6,166 and about 6.2 s four times). Exactness has three independent legs: an oracle over 928,491 strings against the old regex, an index oracle
over 837,930 documents and 40,000 seeded ones against a verbatim copy of the old scan, and a 3,382-document corpus differential (50,730 comparisons, 0 differences; the real-document score 2,423 of 2,438 and `model.tsv`
byte-identical). A three-agent mapping workflow BEFORE the design showed one cause behind 18 shapes; a four-lens review AFTER it (42 findings, no behavioural defect) found one real small-input cost, which I fixed (`5b237ef0`),
nine test gaps (eight closed with rows that fail on the parent) and four wrong numbers in my commit messages. Mutation: 35 and 14 mutants, 31 and 12 killed (the second pass by named rows), 6 survivors all equivalent. Gates: `npm
test` 11,220 of 11,221 (one load-flake row, 0.71 s alone), oracle 2 of 2, `npm run package` DONE (44 files, 1.86 MB), `check-backlog` OK. Learnings 760 to 765.
**Went wrong.** (1) Four numbers in my commit messages were wrong or loose ("614,656 documents" was 28^4; "up to seven characters over three alphabets"; "11,200 of 11,201" described the working tree; "single or low double-digit
ms" was 42 to 65): the claims audit found them, not I; one was amended, three are corrected in the ledger. (2) I built the index for every document and called the work done: the 24 to 27% cost on flat front matter came from the
review, not from my own A/B. (3) My oracle alphabets held 11 of the 25 characters `trim()` strips and my 28 kinds of line had no no-break-space-led line; a stale indent in the climb, the typed-array widths and shared arrays
survived the suite until a reviewer named them. (4) My first resolver rows ended in a top-level `engine: knitr` and could not fail. (5) The whole-suite mutation pass counted two load-flake rows as kills of two mutants I had
predicted would survive; I caught it only because prediction and table disagreed. My first monitor sent one notification per mutant (about 30). (6) The operator's Session 313 question about project progress was in no file: I
said so, answered it, and stopped until told to continue; a feedback memory is saved.
**Known residuals (filed):** (6a) nesting depth, (6b) the no-break-space comment, (6c) the clock rows' reach, (8) mid-document `---` blocks, (9) `proofValue`'s `[ \t]#.*$`; the sweep item's (3) to (5) and (7); the Session 311
item's (3) to (9); the non-tail pin item; the earlier Up Next items are untouched.
**TDD:** RED before GREEN for the 2 `from:` rows, the 2 chunk rows, the 4 nested rows, 2 of the 4 laziness rows and the 16-row `asciiTrim` oracle ("not a function"); the rows added in `8058d1c1` (no-root, two resolver, four
trim) fail on the PARENT source on the clock alone (9 of 10; the small-answer pin passes). Passed on arrival, disclosed: that pin, the 9 index oracle rows (written after the code, then mutation-checked) and the review-round rows
except those.
**Host:** `test:integration` NOT run (core-only change in `src/core`; it takes the screen and nobody was asked). Headless instead: unit suite, oracle, corpus identity, real-document score, mutation, `npm run package`. **Cost:**
7 agents (2 workflows, about 1.3M subagent tokens, 368 tool calls), 63 mutant runs, 5 corpus-harness mutants, 2 `npm run package`, 0 quarto renders beyond the cached oracle.

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
