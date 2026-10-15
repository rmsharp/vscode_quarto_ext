# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 311 closed out.** The five measured defects of the "slow or crashing inputs" item are fixed: a quadratic value trim, a quadratic code-span regex, a 5 MB fence line that threw `scanRegions`,
an entity throw, a quadratic unclosed flow mapping; a review round found and fixed one regression of its own. `BACKLOG.md` "Active" is empty; present ranked candidates via AskUserQuestion at Phase 0.
**What the BACKLOG now holds:** one item replaces the finished one, listing nine measured residuals; the likeliest to be met is `indexLabels` quadratic in `{#sec-...}` headings (8,000 headings 5.6 s), then seven key-side trims.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in the
close-out commit).
(2) TWO scratchpads: the repo's untracked `scratchpad/` (`s311/` holds the harness scripts and a README; `s265/runs/s311-*` the corpus runs) and the session one under `/private/tmp/...` (frozen trees, reviewers' output; not durable).
(3) The Edit tool EXPANDS an escape such as `\uFFFD` into the glyph: write it from Python with a doubled backslash and check `grep -c $'\xef\xbf\xbd'` on every file you touched (it bit `refs.ts`).
(4) `cmd | grep ... && git commit` tests the grep: redirect a gate to a file, `set -o pipefail`, print `$?`. After a scripted edit to a test file COUNT the rows (a bad splice duplicated half of one).
(5) `mutate311.py` prints NOTHING for a mutant whose pattern does not match: count result lines against mutants. Mutate in a throwaway `git worktree` with `node_modules` symlinked, never in the tree a reviewer reads.
(6) Before believing a differential harness's zero, mutate the code and see it report (Learning 740); `scanRegions` caches by text, so time a second reader on a different text.
(7) The row `Session 307 ... a 9 MB line of opts_chunk$set( repeats` (1.5 s) flakes under load (1.63 s at load 43; 55 to 72 ms alone three times). Do not loosen it. zsh: `${=VAR}` to split; the Bash tool keeps a `cd`.
(8) `test:integration` NOT run (core-only, takes the screen: ask). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md`, `PROJECT_LEARNINGS.md` are past the 262,144 B read refusal: read in slices. Baseline `npm test` at HEAD: 10,876 passing in 79 files.

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

## Session 309 Handoff Evaluation (by Session 310)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1 to 7, both ledger frontiers, the ratchet citation (2/2 at `35f188dc`), the test baseline (9,278 passing, 74 files; one timing row flaked under
load) and the function pointers all held at Phase 0, and its derived claim that `src` had no `--no-execute` setting and that two call sites reach `buildOutline` held.
**Helped:** item (A) with its three cost documents, which I put to the operator with numbers (they picked it); `scratchpad/s308` and `s309` had kept BOTH renders of about 500 documents, and `score308.py` was the template of the scorer I built; the
audit script; the method paragraph (render first, score by direction, attacker before the blind round).
**Missing:** that the cure needs a NEW SETTING (a manifest entry with a scope decision, README text, two provider integration tests), not only a core argument; that the paired renders made the whole core change scoreable for free (a reader inventory
found them); and that the no-execute reading is nine guards, three of which no stored render exercised.
**Wrong:** "the extension knows whether a render uses `--no-execute`" (`whats_next`; no spawn in `src/` passes the flag, and the BACKLOG text beside it said so correctly), and "estimate: one slice plus the host wiring": twelve work commits, three
workflows, four render grids and a review round. **ROI: high.**

## Session 310 Self-Assessment

**Score: 8/10.**
**Went right.** I read the data before designing: a reader inventoried about 500 paired renders already on disk, and a scorer built from them (by direction, per reading) priced every guard before it was written. Each guard came from a row that went
red (the first on the tracked `ne_front_default` cost row), and the three guards the stored data did not exercise (shell engines, `child=`, unlisted engines) got a render grid each (27, 12 and 38 documents) before any code. Over 707 paired real
renders the no-execute reading is right on 668 against 376, 27 rows hide a heading against 178, no row is worse than the executing reading, and the default is byte-identical to Session 309's on all 707 and on all 3,383 corpus documents (both modes
agree on the corpus: 2,423 of 2,438). A blind round (5 lenses, 125 documents, 0 of 165 tool calls flagged) gave the honest number before any fix: 121 right of 125 against 78. A read-only attacker, test critic and host reviewer (3 agents, 228 tool
calls) found one real regression (a `#|` expression inside a listed or quoted chunk: 3 documents, one root cause), an over-conservative guess of mine (R-only child), and 12 test gaps; every claim was checked by rendering their documents or reading
the code. Mutation 48 of 48 killed (43, then the 5 child-rule survivors pinned). Integration (with your go-ahead) 562 passing including both provider tests. `npm run test:oracle` 2 of 2; `npm run package` DONE, 44 files, 1.86 MB. Learnings 732 to
737.
**Went wrong.** (1) My own prompt told the readers a wrong premise (an inline `r` call does nothing under `--no-execute`); one agent contradicted it from the repository and was right. (2) The first cut's `#|` test was column-zero and the child guard
R-only because I generalised from what I had rendered: the first cost a regression the review found, the second a refuted guess a grid fixed. (3) I laid a test document out differently from the rendered grid it cited, and 8 of the critic's 12 comment
findings were true (wrong pairing prose, a control named for something it does not test, a detached doc comment). (4) RED was NOT shown for the two provider integration tests: written first, first run after the adapters, one screen takeover with your
go-ahead (a RED run would have cost a second). (5) About ten "have not heard from you" nudges, the lesson Sessions 302 and 306 to 309 recorded; long waits could have carried a one-line status. (6) I saved the review JSON in the session scratchpad and
looked for it in the repository's (Learning 736).
**Known residuals (filed):** the BACKLOG item by number: (1) header-borne channels (DELETING, both modes), (2) prefixed chunks (3 documents), (3) the document selecting the mode (`execute: enabled: false`, measured), (4) engines `go` and `stan`, (5)
the label index is executing-only, (6) the front matter reader's declines, (7) executing-reading defects the review found, (8) host: resource scope unpinned, no RED for the provider tests, (9) S309's carried (B) to (F).
**TDD:** RED before GREEN for the mode argument and its first guard, the cache flip, the setup call, the header call, the fence writer, the opts channel, `read_chunk`, the listed chunk's call, the shell engines (5 rows), the child rule (11 engines,
the list pipe), the 22 engines, an unknown mode (7 rows), the prefixed `#|` (2 rows), `resolveRenderMode`, the manifest pin, the setting-key constant and the fixture (ENOENT). Passed on arrival, disclosed: every executing control, the buildOutline,
engine-blind, front-matter and inline pins, `#|` e01 and e02, the five conservative child edges, the two provider integration tests, and the 1,418 fixture rows (written after the code, every document rendered).
**Host:** `test:integration` run ONCE with the operator's go-ahead: 562 passing. **Cost:** 11 agents (3 workflows, about 2.4M subagent tokens), about 460 renders by me, 48 mutants, one `npm run package` (1:22).

## Session 308 Handoff Evaluation (by Session 309)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1 to 6, harness paths (`score308.py`, `render304.sh`, `mutate308.py`, `corpusheads308.cjs`), the baseline (8,426 passing, 72 files), both ledger frontiers at HEAD and the
ratchet citation all held at Phase 0, and its item (A) reproduced EXACTLY at HEAD (right 83 of 150, 50 phantom-only rows, 119 phantom headings).
**Helped:** the 150 rendered lens documents and `score308.py` (scoring by direction), which became my regression set; the operator decision flagged in gotcha 6, which I could put to the operator at Phase 0 and again with numbers; `rev-*` for how a review round goes.
**Missing:** that a printing chunk is NOT a loud chunk: it emits two bare fences, so every one below a stray fence moves the pairing, and the item's "give it a CERTAIN loud verdict" would have been wrong (a 256-document grid showed it); and that the dominant remaining error was
not printer recall but the quiet `uncertain` chunks BETWEEN printing ones (26 of the 40 phantom documents had no unrecognized printer).
**Wrong:** "HEAD's blanket 'loud' was right for them by accident": right for the first printing chunk only. **ROI: high.**

## Session 309 Self-Assessment

**Score: 8/10.**
**Went right.** I settled the geometry before code: a fence-pairing simulator frozen before any render matched quarto on 256 of 256 documents (HEAD 242), and chunk-level truth came from `keep-md` (a chunk emitted a bare fence or not) over about 3,000 chunks.
Every family was RED first
(cat, text calls, print of a call, masking, `results`, front matter, a setup call, `message`, a name, a child). Two blind rounds (9 authors, about 1.4M subagent tokens, 0 of 308 tool calls flagged) and three read-only reviewers in worktrees (precision 48 documents, geometry 50,
test critic) found what my grids could not. Executing: S308's 150 documents right 83 to 117, phantom headings 119 to 34; 150 fresh round-B documents 52 to 130 right, phantom headings 295 to 59; deleting rows 17 to 17 (the same pre-existing 17) and 0 to 0. Chunk-level
precision 192 of 192 on round B. `realdoc-score` unchanged (2,423 of 2,438), all 3,382 corpus outputs identical, `npm run test:oracle` 2 of 2, `npm run package` DONE (44 files, 1.86 MB). Mutation: 108 of 139 killed, 8 deleted as redundant code, 23 accounted for.
Learnings 724 to 731.
**Went wrong.** (1) My guards began as a blacklist of words; the precision reviewer deleted a heading in 40 of 48 documents of its first round and I only ran a white-box attacker AFTER the blind rounds. (2) I asked the operator about the executing mode quoting
the S308 sample (7 to 21 of 100)
and the blind round later measured 1 to 77 of 144: the decision stands, the number I quoted was the kind one. (3) I wrote a quadratic regex (`options(`: 40,000 unclosed calls, 12 s) that the test critic found, not my timing. (4) Comments and counts overstated in
places (the critic's C1 to C9),
and 8 hand-written rows were not rendered as written until the critic named it. (5) Rendering my own 12 MB performance documents hung the render until I killed it. (6) A mutation pass counts a timing flake as a kill, so it ran alone. (7) About ten "have not
heard from you" nudges.
**Known residuals (filed):** the BACKLOG item by letter: (A) the `--no-execute` decision, (B) recall (a bare name from an unlisted constructor, `print(x, digits = 3)`, `(x <- ...)`, loops and `if`, a function call, `{python}`), (C) printed text that is itself
markdown or a heading,
(D) a stray fence inside a list item, footnote or tabset (pre-existing), (E) the unreadable setup call that keeps HEAD's loud answer (pre-existing, deleting), and S308's (B), (C), (D), (E).
**TDD:** RED before GREEN for the geometry (`g_p-p-p_s0`), each predictor family, each guard, the 40 precision rows, the 6 geometry rows, the `child=` row and the performance rows. Passed on arrival, disclosed: the other 255 geometry rows, the fixture-driven
rows of every grid, the rows of the
same behaviour after each first row, the critic's and the mutation rows (written after the code, every document rendered).
**Host:** `test:integration` NOT run (needs the screen; core-only change, as Sessions 294 to 298). Headless instead: the oracle, the corpus identity and 9,278 unit tests. **Cost:** 12 agents (3 workflows, about 2.5M subagent tokens), about 1,450 renders by me,
three mutation runs (179 mutant runs).
