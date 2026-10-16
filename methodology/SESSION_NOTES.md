# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 316 closed out.** g01 of the backlog ordering plan is closed: the eleven B90 mutants are pinned, with a tracked mutation runner and a review round that widened it (details in the receipt).
Test-only: `git diff 6ebed922 HEAD -- src` is empty. `BACKLOG.md` "Active" is empty: present candidates via AskUserQuestion at Phase 0, ranked by the plan, each option saying which rule placed it.
**What's next (derived from the plan, not a promise):** the in-flight group, g02, the slow-input sweep (estimate 11 sessions). Its first session is B88 part (8): a RED row that `scanRegions` does not throw on one line of 2,100,000 `-`, then `*` and `_`.
g02 no longer waits on g01: `INDENTED_CELL_FENCE_OPEN` (which B88 (3) and (7) rewrite) and `START_CODE_CELL` are pinned in `test/unit/cell-header-literal-pins.test.ts`. Decisions as the plan says: D2 and D3 before g03, D8 before g05, D27 before g10.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in a close-out commit).
(2) `tools/mutation-run/` is the tracked mutation runner (read its README): five mutant lists, a 28-case self-test, a 33-mutant self-check. It tests the COMMITTED tree (commit a source or `test_run.py` edit first); `--tests` copies uncommitted pin files; run it ALONE.
(3) The machine is shared: the load average ran 87 to 438 from other projects' Playwright, next-server, R and VM jobs. Whole-suite runs then flake on clock rows and on vitest's 5 s timeout: use the README's
`--testTimeout` command, name the failing titles, never loosen a row.
(4) Workflow `isolation: 'worktree'` made worktrees at `82e6049e`, 166 commits behind HEAD: put `git log -1` in step one of the prompt. A Session 314 vitest worker (pid 84774, cwd `scratchpad/wt314`) was still at 100% CPU after 6 hours: not mine; ask before killing it.
(5) `test:integration` NOT run for six sessions (takes the screen: ask first). Baseline `npm test` at HEAD: 11,297 passing in 84 files.
(6) The plan: update its status column and "Current position" at each close-out; `sed -n '/^## Where each key went/,$p' docs/planning/2026-10-15-backlog-ordering-plan.md | grep -o 'B[0-9]\+' | sort -u | wc -l`
prints 221. This session's one open finding is filed in g14 (the `knitrClaims` no-break-space item in `BACKLOG.md`).
(7) The Edit tool and the Bash heredoc expand `\uXXXX` into the glyph: write such characters with `chr()` or a placeholder and check the file. `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` and
`PROJECT_LEARNINGS.md` are past the read refusal: read in slices. macOS `sed` rejects `|` as a delimiter.
(8) After answering a direct question, STOP and wait (memory). `git worktree list` may show a foreign worktree under `.claude/worktrees/`: not mine.

### What Session 316 Did
**Deliverable:** g01 of the backlog ordering plan -- pin the non-tail parts of the code-cell header literals (B90's eleven mutants) and commit a mutation runner -- DONE; claim `6ebed922`
**Started:** 2026-10-15
**Status:** Closed out. 76 pin rows kill all eleven mutants; of the review round's 123 further mutants 85 are killed by the pins, 25 by older files and 16 argued equivalent. Runner: 28 self-tests, 33 of 33
self-mutants killed. `npm test` 11,297 in 84 files; `npm run package` 44 files.
**Ledger:** `CHANGELOG.md` 2026-10-15 -- one entry per action (the claim entry replaced), recorded in the close-out commit.

## Session 315 Handoff Evaluation (by Session 316)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, both ledger frontiers at HEAD (`b7510a72`, gap 0), no `pending` receipt, the ratchet citation (2/2, results
`bba236856bad`), the test baseline (11,221 passing in 83 files, exact) and the "Active empty, present candidates" instruction all held at Phase 0, and the picker the plan ranked (g01 first, g02's crash row
allowed before it) was accurate.
**Helped:** gotcha 8 (the sweep's harnesses are untracked, so g01 must commit its own runner) and the harnesses themselves: `scratchpad/s313/mutate313.py`, `mutants313-t5.json` and `review-results.json`
(finding T5) gave the exact form of all eleven mutants, which the backlog item's prose alone could not; gotcha 5 (a whole-suite mutation pass counts a flake as a kill) named the trap I then met, and its "never
loosen" kept me off the clock rows; the plan's g01 block (scope, done criterion, surface, first session) was exact; gotchas 1 and 6 (stage by path; `\uXXXX` expansion) saved time.
**Missing:** (a) that B90's "survives the whole suite" holds only with the wall-clock rows excluded: measured under load, 8 of the 11 looked killed, five of them by clock rows; (b) that the B90 list is a
sample, not the surface: two reviewers found 48 more unpinned parts of two small regexes and the five unpinned parts of `INDENTED_CELL_FENCE_OPEN`, the literal g02's fence rewrites touch; (c) that more than
four rows flake: I met at least ten (jupyter-kernel's `stall` row, the 5-million-backtick row, two exhaustive rows over vitest's 5 s default timeout, the 307 and 308 rows); (d) that the machine is shared and
loaded to 87 to 438 by other projects; (e) that a Session 314 vitest worker was still at 100% CPU after six hours; (f) that `isolation: 'worktree'` makes worktrees at an old commit.
**Wrong:** the estimate "2 sessions" for g01 (one long session closed it), and gotcha 5's "four timing rows". **ROI: high.**

## Session 316 Self-Assessment

**Score: 7/10.**
**Went right.** The deliverable is checkable on the committed tree: all eleven B90 mutants are killed by named rows (11 of 11 through the tracked runner), measured RED first (0 of 11 killed by the 78 files
without wall-clock rows, and none by the other five files minus their clock rows), and `git diff 6ebed922 HEAD -- src` is empty. The tracked runner has a 28-case self-test (12 RED before its review fixes,
shown) and 33 self-mutants, all killed after its own check found four gaps in the self-test. Two workflows (4 probe agents, 4 reviewers, about 1.27M subagent tokens) were each followed by firsthand checks: the
reviewers refuted two of my own records (E01 "equivalent", the runner's "never edits the repo") and found the gap g02 needs. Final lists on the final tree: 11 killed; 14 killed and 1 expected survivor; 85
killed; 25 killed; 16 survive; 0 contradictions. Gates: `npm test` 11,297 in 84 files, `check-types` clean, `check-backlog` OK, `npm run package` 44 files, 1.86 MB. Learnings 771 to 774.
**Went wrong.** (1) My first record called E01 EQUIVALENT after 2,520 documents; it is not (a lazy line under a quoted paragraph, a header whose option tail pandoc refuses): two reviewers found it
independently. (2) Runner v1 had six defects: a leaked worktree on a setup failure, a timeout that killed only `npx`, a mutant file that could leave the worktree, a `--worktree` that overwrote the user's files,
a mangled dirty report, a crash that exited 1. (3) I started a 123-mutant run with that runner; one hang mutant left workers behind and the load rose; I stopped the runner and no process with a mutation
worktree as its cwd remained. (4) The pin file's first header held several loose or false statements (the N-row coverage, K00's purpose, "tables", "drained"). (5) vitest does not type-check:
`resolveDocumentEngine` returns `string | undefined`, and `check-types:unit` caught my helper's type. (6) The probe agents' worktrees were 166 commits old; I re-ran every row on HEAD (all held). (7) Scope: the
review widened the work from 11 to 76 rows, and the runner from one file to a tool with a README; I judged it the one deliverable (the plan's scope sentence is "pin the unpinned non-tail parts" and a runner),
and say so here; the operator may weigh it differently. (8) Whole-suite verification fought a machine at load 87 to 438: three red baselines, lists 4 and 5 re-run, and a wider title filter that hid the Y03
killer until I narrowed it. (9) Several "have not heard from you" nudges during the long waits.
**Known residuals (filed or stated):** the no-break-space direction of the knitr claim (BACKLOG, g14); the sampler bounds and never proves (about 190 mutants tried, none known unpinned and non-equivalent);
`test:integration` NOT run; the option-tail test's comment ("BEGIN's tail is a subset of INFO's") omits that BEGIN's blanks are ASCII, not edited.
**TDD:** the runner: its self-test was written first and was RED (7 of 9 failed; the 2 that passed did so by accident, Python exits 2 for a missing script), then 12 of 28 were RED before the review fixes.
Passed on arrival, disclosed: the vitest-mode, ERROR and timeout self-tests (written after the code, then mutation-checked) and every pin row (written against existing behaviour; the RED is the mutant surviving
the suite first, 0 of 11 killed, then 11 of 11 killed).
**Host:** `test:integration` NOT run (test files and a tool only; it takes the screen). **Cost:** 8 agents in 2 workflows (about 1.27M subagent tokens, 368 tool calls), about 500 mutant runs, 0 quarto renders.

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
