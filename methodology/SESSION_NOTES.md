# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 311 (IN PROGRESS): the five measured robustness defects of the BACKLOG item "Three PRE-EXISTING slow or crashing inputs"** (operator picked it at Phase 0, the recommended option).
Linear scans and guards only, no behaviour change on well-formed input; strict TDD, a timing row per defect. The gotchas below are Session 310's and still hold.
**⚠ Gotchas:** (1) never `git add -A`; stage by exact path; the dashboard dirties `methodology/dashboard_history.jsonl`, `context_budget.py` dirties `methodology/.context-budget-history.jsonl` (both go in the close-out
commit).
(2) TWO different scratchpads: the repo's untracked `scratchpad/` (`s310/` holds the harness, grids, 125 held-out documents, the reviewers' documents) and the session one under `/private/tmp/...` (the three review JSONs).
Tracked twins: `tools/knitr-print-grids/score_modes.py`, `build_bundle.sh`.
(3) `score_modes.py <build.cjs[,build.cjs@no-execute]> <exdir>~<nedir>...` scores a build against paired renders by DIRECTION (`--fixture` writes `test/fixtures/knitr-print-noexec/`, 707 rows, closed-world);
`REALDOC_MODE=no-execute tools/realdoc-score/run.sh <label>`; `mutate310.py <sha> <mutants.json>` (in `s310`).
(4) zsh: an unquoted `$VAR` does NOT split (use `${=VAR}`); quote `grep --include='*.ts'`; `echo =====` is a command; the Bash tool KEEPS a `cd`: use absolute paths.
(5) Put "do not read installed quarto, knitr, xfun, rmarkdown or pandoc source" in EVERY agent prompt and audit `tool_use` inputs (`scratchpad/s309/audit309.py`: it flags REPO reads too, right for blind authors, noise for
reviewers).
(6) The row `Session 307 ... a 9 MB line of opts_chunk$set( repeats is read in linear time` (1.5 s bound) flakes when the machine is loaded (1.55 to 1.88 s at load average 30; about 650 ms alone). Do not loosen it; time it
alone.
(7) `test:integration` takes the screen: ask first (run once this session, 562 passing). `BACKLOG.md`, `HANDOFFS.md`, `CHANGELOG.md`, `PROJECT_LEARNINGS.md` are past the 262,144 B read refusal: read them in slices. Baseline
`npm test` at HEAD is 10,815 passing in 77 files.
(8) The default reading is byte-identical to Session 309's (707 paired documents and all 3,383 corpus outputs), pinned by `knitr-no-execute-fixture.test.ts`; a change to it fails there first.

### What Session 311 Did
**Deliverable:** fix the five measured robustness defects of the BACKLOG item "Three PRE-EXISTING slow or crashing inputs" (IN PROGRESS)
**Started:** 2026-10-15
**Status:** Session claimed. Work beginning. Phase 0 found both ledger frontiers at HEAD (`677fae9a`, gap 0), the ratchet citation matching (2/2, results `bba236856bad`) and `npm test` green at 10,815 in 77 files (5.6 s, no timing flake).
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

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
