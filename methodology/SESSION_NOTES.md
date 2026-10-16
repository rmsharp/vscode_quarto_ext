# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 315 closed out.** A planning session: the backlog ordering plan is written (`docs/planning/2026-10-15-backlog-ordering-plan.md`, commit `cf375442`) and the ordering rule is in `CLAUDE.md`.
No source code changed. `BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each option saying which rule placed it (dependency, finishing a feature, or neither).
**What's next (derived from the plan, not a promise):** the in-flight group first: g01 (B90 header-literal pins, test-only, 2 sessions), then g02 (the slow-input sweep; its crash row, B88 part (8), may run before g01).
Decisions are asked as the plan says: D2 and D3 before g03, D8 (plan mode once per group) before g05, D27 (format-name checks and `_metadata.yml` before or after the cell-option groups) before g10. Estimate: 202 core sessions.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) The plan's keys are `B<line>` at commit `1ed4197a` (`git show 1ed4197a:BACKLOG.md`); the live file's lines shift when g03 drains blocks. The plan's JSON source, its validator and the three workflows' results exist only
in the session scratchpad under `/private/tmp/...` (not durable): the markdown IS the source now. Update its status column and "Current position" block at each close-out; after a structural edit check coverage:
`sed -n '/^## Where each key went/,$p' docs/planning/2026-10-15-backlog-ordering-plan.md | grep -o 'B[0-9]\+' | sort -u | wc -l` prints 221.
(3) The gates the plan names can only see what they measure: `test:oracle` runs the cell-option flag decision, `tools/realdoc-score` compares heading LEVELS; Outline and label-index groups close on their own tracked fixture plus a ratchet
row (plan P6). Never run `tools/knitr-print-grids/regen.py` over `knitr-print-noexec`: it overwrites that fixture's engine column. Its `right(6)` 376 and `hiding(6)` 178 score the DEFAULT reading against the NO-EXECUTE render.
(4) `test:integration` NOT run for five sessions (takes the screen: ask first); the plan marks adapter integration rows OPEN until the operator approves a run. `scratchpad/` evidence cited by old records is mostly gone (plan P5).
(5) Four timing rows flake under load (Session 307's 9 MB row, 308's 200,000-line row, two of 311's): run alone, never loosen; a whole-suite mutation pass counts a flake as a kill. Baseline `npm test` at HEAD: 11,221 passing in 83 files.
(6) The Edit tool and the Bash heredoc expand `\uXXXX` into the glyph: write such characters with `chr()` and `grep -c` the file; `rm -rf $A/$B` is blocked: use literal paths. `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md`
and `PROJECT_LEARNINGS.md` are past the read refusal: read in slices. zsh does not word-split `$VAR`: `${=VAR}`.
(7) Workflow agents: `pkill -f <scratch dir name>` after each reports; `git worktree list` shows a foreign worktree under `.claude/worktrees/`: not mine, leave it. After answering a direct question, STOP and wait (memory).
(8) The sweep's harnesses are `scratchpad/s312/` to `scratchpad/s314/` (READMEs: mutation runners, corpus differentials, `regex-equiv.js`, `probe.ts`); g01 must commit its own runner under `tools/` because they are untracked.

### What Session 316 Did
**Deliverable:** g01 of the backlog ordering plan: pin the eleven B90 mutants of the four code-cell header literals and commit a mutation runner under `tools/` (IN PROGRESS)
**Started:** 2026-10-15
**Status:** Session claimed. Work beginning. Test-only: `git diff -- src` must stay empty.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

### What Session 315 Did
**Deliverable:** the backlog ordering plan (`docs/planning/2026-10-15-backlog-ordering-plan.md`) and the ordering rule in `CLAUDE.md` -- DONE (commit `cf375442`); claim `1ed4197a`
**Started:** 2026-10-15
**Status:** Closed out. 221 open items placed exactly once: 187 in 37 groups (36 scheduled in dependency order, one deferral-only), 34 parked; 23 decisions each asked once; three review rounds (125 findings, 9 high) with a disposition for each.
**Ledger:** `CHANGELOG.md` 2026-10-15 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

## Session 314 Handoff Evaluation (by Session 315)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`3a440054`, gap 0), no `pending` receipt, the ratchet citation (2/2, results `bba236856bad`), the test
baseline (11,221 passing in 83 files, exact; the same at close-out) and the "Active empty, present candidates" instruction all held at Phase 0.
**Helped:** gotcha 11's progress overview (v1 and v2 done, the recorded out-of-scope list, no Posit parity checklist) answered the operator's "what remains" follow-up with no new research; gotchas 1 (stage by exact path), 7 (read the
400 KB files in slices) and 8 (non-ASCII from `chr()`) saved time at every step; the sizes of `BACKLOG.md` and `HANDOFFS.md` were exact; the receipt's `whats_next` marked its figures derived or estimate.
**Missing:** that about 95 of the 221 open items sit under a Session 252 enumeration-only deferral (zero reach into authored documents; promotion bar: show the construct in a document someone wrote): "the earlier Up Next items are
untouched" does not say it, and it decides whether a planner may schedule them (my first plan deadlocked on it); that no ordering rule existed in the repository; and an order across features: the "what's next" listed residuals of one
thread, which my first picker followed.
**Wrong:** nothing I could check. **ROI: high.**

## Session 315 Self-Assessment

**Score: 7/10.**
**Went right.** The deliverable exists and is checkable: all 221 items placed exactly once (a script checks coverage, the dependency order, deferral flags, decision timing and the session totals), each group has a done criterion, a gate
that can go red, a surface and a one-session first deliverable. Every high finding I checked firsthand was right (the deadlock on the deferral; scratch evidence gone; no unit test imports an adapter; `test:oracle` and the realdoc score
cannot see the Outline or the label index; the front-matter resolver binds the first anchor; the g14 ratchet scored the wrong render, which I recomputed: 542 right and 70 hiding against 376 and 178). The operator's rule is in `CLAUDE.md`
(23,953 B, under the 24,000 B warn line) and the plan. Gates: `npm test` 11,221 in 83 files, exact.
**Went wrong.** (1) My first picker ranked four unconnected items by smallness and left out the user-visible gaps; the operator's "I want to always strive to address backlog items in the order that creates robust code" followed.
(2) I launched the first workflow before reading the Session 252 deferral header: its draft scheduled about 80 deferred items, asked "lift or keep" in 22 groups and hard-required two deferral-only groups; the reviewers and I found it afterwards. (3) Three review rounds and about
3 hours: 125 findings (4, 3 and 2 high), the last 18 applied by my own patch with no agent re-read, so the g08 split, D27 and the g06 gate were checked by me alone. (4) A commit message said 22 decisions; there are 23 (amended before
anything sat on it, the same slip as Learning 764). (5) The planning checklist asks for the deepest reasoning mode at session start: I could not set it and ran the reviser at max or xhigh instead. (6) Several "have not heard from you" nudges
during the workflow waits; the plan is 155 KB, so its first screen (position, order table) is what a successor will read.
**Known residuals:** the plan can still be wrong in detail (125 findings found, the last round local); 23 decisions are unanswered; D27 puts the operator-named format-name and `_metadata.yml` gaps at about session 57 unless the operator
reorders; B84 family (7) remainder and the other RESIDUAL records are filed in the plan, not yet in `BACKLOG.md`.
**TDD:** not applicable: documents only, no logic changed. **Host:** `test:integration` NOT run (nothing to run); no runtime change, so no smoke test. **Cost:** 39 agents in 3 workflows (about 8.4M subagent tokens, 3 hours), 0 quarto
renders, 0 mutation runs.

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
