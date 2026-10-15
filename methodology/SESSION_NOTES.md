# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 309 closed out.** The Outline reads which silenced knitr chunks PRINT (an output block = two bare fences) and moves the stray-fence pairing with them, for the EXECUTING mode. `BACKLOG.md` "Active" is empty;
present ranked candidates via AskUserQuestion at Phase 0.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in the close-out commit).
(2) `scratchpad/s309/` (untracked) holds the harness; its tracked twin is `tools/knitr-print-grids/` (generators, `regen.py` re-renders every document the fixtures store). `score308.py <b1.cjs,b2.cjs> <dir:mode>...` (in `s308`) scores by DIRECTION; `mutate309.py
<sha> <mutants.json>`.
(3) Fixtures `test/fixtures/knitr-print-{geometry,statements,hostile,geometry-hostile,critic,mutants}/` are CLOSED-WORLD: a rule change that moves a row fails until `mkfixture_stm.py` (statements) or a deliberate edit regenerates it.
(4) The Bash tool KEEPS a `cd`: use absolute paths. zsh: `${l}:exec`, not `$l:exec`; `echo ======` is a command; `node -e` argv starts at 1 (`slice(2)` for files); scripts written by Write are not executable.
(5) Put "do not read installed quarto, knitr, xfun, rmarkdown or pandoc source" in EVERY agent prompt (Learnings 700, 709) and audit by parsing `tool_use` inputs (`scratchpad/s309/audit309.py` flags REPO reads too: right for blind authors, wrong for reviewers).
(6) ⚠ OPEN DECISION FOR THE OPERATOR (BACKLOG item): the Outline follows the EXECUTING mode, and under `--no-execute` documents hide a heading quarto shows: 7 to 21 of 100 (S308's set) and 1 to 77 of 144 (round B). A mode argument from the host would end it.
(7) `test:integration` takes the screen: ask first. `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md` are past the 262,144 B read refusal: read them in slices. Baseline `npm test` at HEAD is 9,278 passing in 74 files.

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

## Session 307 Handoff Evaluation (by Session 308)

**Score: 7/10.** Self-check by the same model family, not an independent score. Its function names, harness paths (`render304.sh`, `score307.py`, `mutate307.py`, `audit307.py`), the baseline (8,304 passing, 72 files), both ledger frontiers at HEAD and the
ratchet citation all held at Phase 0; its forward-looking claims were marked "derived" or "estimate".
**Helped:** the BACKLOG item named the witnesses (`a05`, `a14`, `defaults_13`, `defaults_14`), still on disk and reproducing at HEAD; the rule to price a guard by a realistic lens first (Learning 715), which I followed and which changed the verdict; gotcha 6
(`--no-execute` never runs a setup chunk), which predicted the mode split exactly.
**Missing:** that a chunk which PRINTS stays loud under a default (its family (6) said it for the chunk-level case only), which proved the dominant remaining error class; and that this was not one expression: a setup call needed a statement reader and an ordered
state, about 300 lines and 80 rows.
**Wrong:** "(2)'s later-chunk shape is the cheapest deleting family, since `knitrDocumentDefaults` already counts the keys": the counting reads the FRONT MATTER only and a blanket `opts_chunk` decline had to be replaced; the cost was eight work commits, two
workflows (8 agents, about 1.6M subagent tokens) and four mutation passes. Its two operator decisions were not confirmed between sessions; I followed the executing mode and re-flagged it. **ROI: high.**

## Session 308 Self-Assessment

**Score: 7/10.**
**Went right.** I grounded before code: nine grids (134 documents, 197 predictions frozen before any render, none wrong; HEAD wrong in 35 rows of the first grid). That changed two designs: `format: html:` needs no mode decision, and a setup-call default is
`uncertain`, not `silent` (the silent variant on the same documents gained 4 executing rows and deleted 11 headings under `--no-execute` against 3). Five blind lenses (150 documents, 0 of 175 tool calls flagged) priced it by a realistic lens, and scoring by
DIRECTION found the chunk that PRINTS: HEAD's blanket loud was right for it by accident, and all five executing regressions are such chunks. Executing, 150 documents: right 63 to 83, deleting rows 40 to 17, phantom headings 92 to 119; `realdoc-score` and all
3,382 corpus outputs unchanged.
A review round (3 reviewers, 42 counterexamples, every one rendered by me before acting) found 19 documents where my first cut regressed against HEAD; 17 are fixed (a `%#%` operator, a bare `F`, a function or `if` body on the next line, an `eval` default, an
`opts_chunk` mention in a header or `#|` line, brackets hidden in quotes, a wrapped quoted scalar, `{echo:false}`, a second `format:` block, an alias key, `metadata-files:`), 2 are the `--no-execute` cost. Mutation: about 60 mutants over four runs, 4 survivors,
all equivalent. Learnings 719 to 723.
**Went wrong.** (1) The first cut shipped hazards I should have found; the reviewers did, and the front-matter ones were old holes of the shared reader that `format:` newly exposed. (2) I wrote the broad reader before its rows, so most rows passed on arrival
(disclosed; the first mutation pass left 10 of 41 alive, three of them real gaps). (3) Four pins stated HEAD's answer as quarto's (found when they went red) and my test comments carried wrong counts and a false "cannot delete" (the critic found eight comment
defects). (4) About eight "have not heard from you" nudges, the lesson Sessions 302, 306 and 307 recorded. (5) Three commands failed on shell traps (zsh `$l:exec`, BSD `sed -i`).
**Known residuals (filed):** the BACKLOG item by letter: (A) a chunk that prints under a default, (B) the call shapes the reader declines, (C) a silent front matter that code overrides, (D) `format:` read for the first format only, (E) the S307 sandwich; and a
pre-existing quadratic in an unclosed front-matter flow mapping (26 s on 20,000 lines, identical at HEAD).
**TDD:** RED before GREEN for the format arm (`f01`), the setup call (`d01`), `cache = FALSE`, the later duplicate argument and the front matter surviving an unreadable call (`p01`, `p05`), the per-option unread (`q03`), and 16 review rows (16 red at once, then
four, then eight, each fixed in turn). Passed on arrival, disclosed: the rows of the same behaviour after each first row and the g16 to g18 rows (later shown against mutants), the controls and the residual pins.
**Host:** `test:integration` NOT run (needs the screen; core-only change, as Sessions 294 to 298). Headless instead: `npm run test:oracle` 2 of 2 against the real quarto CLI. **Cost:** 8 agents (two workflows, about 1.6M subagent tokens), about 650 renders by
me, four mutation passes, `npm run package` 1:20.
## Session 306 Handoff Evaluation (by Session 307)

**Score: 7/10.** Self-check by the same model family, not an independent score. Its file pointers (`model.ts:6977`, `:7575`), harness paths (`render304.sh`, `build.sh`, `diff306.py`), the baseline (8,151 passing, 72 files), both ledger frontiers at
HEAD and the
ratchet citation all held; its forward-looking claims were marked "derived" or "estimate". **Helped:** the BACKLOG item named the function, the five rendered rows (the `silenceinterplay` documents, still on disk and still reproducing at HEAD) and the
sibling's pattern; gotchas 3, 4, 7.
**Missing:** that the realistic-document lens must be run BEFORE the grid (I priced the first guard by my own grid and was wrong); that a bare-word guard is wrong in the normal case (the label index's `codeFromElsewhere` is a doc-level bare word and
is safe there only because declining a removal is the safe side).
**Wrong:** "(3) is the only family that DELETES headings and is about one `codeFromElsewhere` conjunct". Family (2) deletes too (`a05`, `a14`, a default that silences the LATER chunk), and the conjunct as a bare word regressed 12 normal documents
against 1 fix; the real cost was ten commits, two workflows (13 agents, about 2.1M subagent tokens) and four mutation sets. Two of its five rows (`knit_child`, the include) are not that channel at all, and the include is not fixable. **ROI: high.**

## Session 307 Self-Assessment

**Score: 7/10.**
**Went right.** Ground first: four grids with predictions frozen before any render (a05, the sandwich and `merge` were found by the predictions that missed), then TDD with RED shown for every behaviour. Two blind rounds (13 agents, about 2.1M
subagent tokens, none rendered, both transcripts audited clean: 0 of 498 tool calls flagged), about 520 renders by me, and every reviewer
claim re-checked against a render or the code. The decisions are evidence-backed: the include is NOT a closer (the fence, include, fence idiom rendered right at HEAD), an uncertain chunk may end a swallow but never open one (ten shape-P twins, every
prediction held), the rule follows the executing mode (Session 287's precedent, flagged for the operator).
Found by timing, not by a reviewer: a 4.2 s quadratic scan on a 5 MB line (RED 9.5 s, fixed to 28 ms). Final, execute mode over 407 documents: 84 fixed, 41 regressed, 101 wrong both before and after, 178 right both; `realdoc-score` 2,423 of 2,438
unchanged and all 3,383 corpus outputs byte-identical; unit 8,151 to 8,304; mutation 83 killed on the final tree, 9 survivors accounted for (`read_demo`/`read_rforge`/`child` unmeasurable, two performance-only, `label=` equivalent, `G11`, `N13`,
`N14`). Learnings 715 to 718.
**Went wrong.** (1) My FIRST guard read bare words and I priced it by my own adversarial grid: the realistic lens scored 1 fix to 10 regressions and a reviewer's sandwich deleted a heading (Learning 714 again, at my own expense; it cost three commits
and the second workflow). (2) I wrote a regex for a label before grepping for the label index's own reader (the round-2 reviewer found it weaker). (3) Counts in commit messages were wrong three times (28 rows for 30, 8,282 tests for 8,279, "255
documents" for 253): two amended, `c3697b92` still says 255. (4) Three of my rows were vacuous or untrue (a comment that matched the option pattern, cell rows that pass with the cell missing, a row presented as a rendered document that was a
variant). (5) About six long stretches drew "have not heard from you" nudges, the lesson Sessions 302 and 306 recorded.
**Known residuals (filed):** the BACKLOG item, by family: label that supplies no code, a default hiding the later chunk (deletes), the unreadable channels (a fence built from pieces: 20 of 30 writer documents, wrong at HEAD too), the sandwich with an
uncertain middle (deletes), and the pre-existing shape-P `print()` output block.
**TDD:** RED before GREEN for the empty-chunk guard (`a01`, `a06`), the writer guard (`m01`, `m05`, `m03`, `n12`), every narrowing (10, 4, 10, 8 rows), the uncertain-closer principle (10 shape-P rows), the performance row and each mutation survivor
that got a row. Passed on arrival, disclosed: the rows of the same behaviour after each first row, the controls, the include decision rows (they pin HEAD, no logic), the residual pins.
**Host:** `test:integration` NOT run (needs the screen; core-only change, as Sessions 294 to 298). **Cost:** 13 agents (two workflows), about 520 renders, four mutation sets (about 115 mutant runs), `npm run package` at close-out.

## Session 305 Handoff Evaluation (by Session 306)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK, gotchas 1, 3, 4, 6, 7 and 8, its harness paths (`render304.sh`, `build.sh`) and its `key_files` lines (`refs.ts:402`, `:422-430`, the 239-line
`refs-cell-kinds.test.ts`) all held at HEAD; Phase 0 found both ledger frontiers at HEAD and the ratchet citation matched the stored results.
**Helped:** `render304.sh`, reused unchanged (18 renders in 13 s); the standing `realdoc-score` command (5 s, unchanged at 2,423 of 2,438); gotcha 7 (three files past the read refusal: I read them in slices at once); gotcha 2 (the no-source rule,
audited clean again); the BACKLOG item Session 304 filed, which named the function, the render to make and the one-expression fix.
**Missing:** a pointer to `tools/realdoc-score/extract_headings.py` as the way to read quarto's headings back from rendered HTML (I found it through the README); and that a grep over an agent transcript for third-party paths matches the
prompt prose, so every agent looks guilty until the `tool_use` inputs are parsed.
**Wrong:** the unit total. The receipt gives `npm test` 7,739 passing as final, and a clean HEAD worktree runs 8,115 (the number was taken before the last two test commits, `59e9a508` and `e9885724`). Small. **ROI: high.**

## Session 306 Self-Assessment

**Score: 8/10.**
**Went right.** I measured before changing code: two grids (36 documents, both modes), predictions frozen first, and every one held; the dashed alias deleted a heading in 9 shapes at HEAD. The fix is one expression, the sibling's. What took the
work was pricing it: one workflow (4 blind lenses and 2 read-only reviewers, 6 agents, about 640k subagent tokens, none rendered, transcripts audited clean) plus about 540 renders by me (3 wide) scored 189 fixed, 55 regressed, 35 wrong both
before and after, 159 right both before and after, 30 unrenderable rows, over 234 documents in both modes (468 rows). The dotted-twin test classified all 55 regressions in one step (twin-equal 55 of 55), so the fix is the sibling's behaviour, not a new defect.
Real-document score unchanged (2,423 of 2,438), corpus reach 0 of 3,383, mutation 9 of 9 non-equivalent mutants killed (M5 equivalent), unit 8,115 to 8,151, `npm run package` exit 0 (44 files, 1.85 MB, 1:19). Learning 714.
**Went wrong.** (1) My first test comments overclaimed, and the test critic caught it: "each guard shown RED against a mutant" was false for three controls, two "RESIDUAL" rows pinned a regression the fix introduced (right before, wrong now), and
(T)/(P) were defined only in a script. (2) The brief I wrote said the residual held "for BOTH spellings", false for the dashed one at HEAD. (3) Three commands failed on a relative path or a changed working directory, and one malformed mutant
(M11) broke the build. (4) The first transcript audit matched every agent because it searched the prompt text. (5) About five long stretches drew "have not heard from you" nudges, the lesson Session 302 recorded.
**Known residuals (filed):** the BACKLOG item with 3 families: a label that supplies no code, a default that hides it, and channels the rule never reads (the LOST direction).
**TDD:** RED before GREEN for the first row (`g03`, `After` deleted); the other 35 rows passed on arrival (disclosed), each guard then shown against a mutant: dropping the alias turns 21 of the 36 RED, and the other 15 are controls or dotted residuals by design.
**Host:** `test:integration` NOT run (needs the screen; core-only change, as Sessions 294 to 298). **Cost:** 6 agents, about 540 renders, one mutation pass, `npm run package` 1:19.
