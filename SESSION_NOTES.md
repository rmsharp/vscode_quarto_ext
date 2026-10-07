# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 297 (IN PROGRESS): the `from:` RESOLVER'S PROOF OF THE READER -- item (6) of "CommonMark-family readers: what the Session 296 rules still miss".**
Operator picked it at Phase 0. Workstream: `DEVELOPMENT_WORKSTREAM.md`, strict TDD. Six rendered controls delete today; the fix is a plain top-level scalar test (Learning #652).
**⚠ Gotchas:** (1) never `git add -A`. (2) CAP and ANNOUNCE renders: authors never render, the caller renders 3 wide, load gate 25. (3) `score.cjs` REFUSES a stale bundle.

### What Session 297 Did
**Deliverable:** make the two run-to-the-end rules (unclosed plain fence, raw HTML type 3-5) fire only where the reader is PROVEN a CommonMark-family reader by a plain top-level `from:` scalar (IN PROGRESS)
**Started:** 2026-10-07
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

## Session 295 Handoff Evaluation (by Session 296)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt said `BACKLOG.md` "Active" was empty and listed the open
items; `freeCaseTableReader` 7360, `startsAtBoundary` 10666, `isBoundaryLine` 10675, `runStart` 10685, `endsFreshBlock` 10704, `LINK_REFERENCE_DEFINITION`
5306 and the suite start 22268 were exact at HEAD (`htmlRunBeginsWithTag` was 10776, not 10775); the ratchet citation (2/2, `bba236856bad`) matched the stored results.
**Helped:** the 320-document reader grid, its renders and `truth.json` (they confirmed the 33 deletions in two minutes), `score.cjs`'s stale-bundle refusal (it
fired once after a comment edit), `render.sh`'s load gate, Learning #640 (grid across readers first) and gotchas 1, 7 and 9. **Missing:** that the reader grid held
TOP-LEVEL contexts only (every container shape, where most of the work was, had to be measured fresh), any warning that dropping the cell pairing unmasks older
gaps the pairing hid by accident (S282 and S294 had said so; the item's own `estimate: one session` priced the one-line rule, not what it unmasked: 18 commits),
and that `truth.json` is keyed by relative path, so another session's keys collide with and outlive its files. **Wrong:** only that estimate. **ROI: high.**

## Session 296 Self-Assessment

**Score: 8/10.**
**Went right.** I measured before coding: a 288-document context grid and a 336-document language x indent grid (uniform across engine, reader and indent), then a
240-document container grid; each slice RED before GREEN. Three blind rounds were scored against the PARENT build (609, 549 and 155 documents), a seeded 1,200-document
product grid found seven deletions no author wrote, and two mutation passes (74 mutants) found five gates of mine that were too strict (+35 fixes), ten killers that
lacked unit rows and a script bug that had dropped the first row of 12 generated tables. Final: 3,979 rendered probes, 1,215 fixed, 43 regressed (all pinned);
155 realistic documents: 2 fixed, 0 regressed; 27,853 (document x pandoc reader) pairs unchanged; corpus 0 of 3,383 changed; score unchanged 2,423/2,438; tests 4,225 to 4,463.
**Went wrong.** (1) The first cut (slices 1-2) fixed 234 and regressed 94 of 609: every regression an older gap the pairing had hidden, because my grids put each
heading at column 0 and only one reader axis moved. (2) The run-to-the-end rules (slices 4 and 5) were my own over-reach: round 2 showed one wrong trigger deletes everything
below it with NO opener in the document (154 regressions) and needed eight gates. (3) Two narrowing prototypes I expected to help scored worse (95 and 69 against 71 regressions).
(4) About a dozen deletion-direction shapes ship pinned (multi-marker lines, markers that cannot interrupt a paragraph, a capital initial, six misread `from:` controls).
(5) Scope: one item became 18 commits, each forced by a measured regression of my own change. (6) A learning row first named a wrong cause (caught before commit). (7) No
`test:integration` run (needs the screen; core-only change). (8) `mutate296.py` wrote its bundles into the S295 directory until I moved them.
**TDD:** RED shown before GREEN for slices 1-8 and every gate family; the guard rows, the pinned RESIDUAL rows and the mutation killers and witnesses pass on arrival (disclosed).
**Cost:** 26 authoring agents (about 4.7M subagent tokens, none rendered) in three workflows, about 3,660 renders by the caller at 3 wide, no screen-taking run; load peaks of 64 were other apps.

## Session 294 Handoff Evaluation (by Session 295)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt said `BACKLOG.md` "Active" was empty and listed the open
items; all four key_files line numbers I checked (`endsBlock` 10564, `indentedCellFenceFor` 10512, `closesOnOwnIndent` 10603, `HANDLER_CELL_LANGUAGES`
10501) were exact at HEAD; the ratchet citation (2/2, `bba236856bad`, `8845021a4049`) matched the stored results at Phase 0.
**Helped:** `render.sh`, `score.cjs`, `build.sh` and `h/engine.cjs` (copied forward, only the paths changed), the backlog item's witness list (I read 35
of them to design the grid), and gotcha 3 (the stale-bundle refusal: I rebuilt before every score). **Missing:** that the scanner's `paragraphOpen` is NOT
a usable "began fresh" signal after raw TeX, a comment or a break (Learning #625 says so for the raw-construct trap; my first cut paid seven regressions),
and that the free case had only ever been measured under the default reader (a `markdown_strict` regression followed). **Wrong:** item (3) said pandoc is
between blocks after "a table caption" and "an adjacent chain": a tight `: Caption` is paragraph text in every context, and a chain of bash cells ends
nothing (only a closed KERNEL cell does); gotcha 2's load of 37-55 was gone at my start (load 5). **ROI: high.**

## Session 295 Self-Assessment

**Score: 8/10.**
**Went right.** I measured before every rule: an 87-construct grid x three contexts, 129 tag names x six shapes (774 documents), an outer-element grid, a
225-pair stacking matrix and a 16 x 10 reader grid (320 documents); every unit row's claim was re-derived from quarto (`gen_rows.cjs` + `check_rows.cjs`:
392 claims, it caught 3 wrong claims and 6 wrong expected lists). Two blind rounds (542 + 532 documents) found 9 documents my rules broke; the reader grid
found the `markdown_strict` regression no author wrote; three mutation rounds (final 67 mutants, 60 killed, 7 proved unobservable) removed three harmful or
dead terms. Final: 4,689 probe documents, 1,588 fixed, 0 regressions; Session 293/294's 2,160 probes 0; corpus 0 of 3,383; score unchanged 2,423/2,438;
4,225 tests (was 4,028).
**Went wrong.** (1) My first cut used `paragraphOpen` as the freshness signal although Learning #625 warns that raw constructs make it false: seven
regressions only the blind authors found. (2) The reader dimension was missing from my first design; a `markdown_strict` regression lived for several
commits. (3) My first HTML measurement used `Text.` as filler, a list marker: a confound that cost two render passes. (4) Three figures written from
memory ("about 90 of 140", "about 6,400", "eleven killers"): two caught and corrected, one remains in commit `8cc5001d` (the true figure was 6,320).
(5) Scope: the item named one list; six slices, a refactor and reader gating shipped, each forced by a measured defect, but more than listed. (6) One unit
test failed once under load (~40-60) during a mutation run and not in three reruns: a flaky test exists, uncaptured. (7) No `test:integration` run
(needs the screen; core-only change). (8) The dashboard run took over two minutes because `scratchpad/` is 65 GB.
**TDD:** RED shown before GREEN for each slice and fix; the GUARD and MUTATION KILLER rows pass on arrival by construction (they pin behaviour HEAD
already had right), disclosed.
**Cost:** 21 authoring agents (about 1.63M subagent tokens), 4,707 renders at 3 wide or fewer; no screen-taking run.

## Session 293 Handoff Evaluation (by Session 294)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt said `BACKLOG.md` "Active" was empty and listed the
open items; all ten line numbers in its key_files were exact at HEAD (grep-checked); the ratchet citation matched the stored results at Phase 0.
**Helped:** the `lg` probes with cached renders (I used five byte for byte as test inputs), `adv_score.cjs` and `corpusdiff_eng.cjs` (forked), the
pinned `{bash}` RESIDUAL row (my first RED to flip), and gotchas 1, 2, 3, 5 and 7 (the ratchet walks the scratchpad: minutes, 127 is a timeout).
**Missing:** how to build a `findHeadings` bundle (esbuild one-liner; `h/head.cjs` is the PRE-S293 commit, `head.sha` says so), and that the
`lg` `{r}` rows forced the jupyter hint on documents quarto resolves to knitr, so they read "right" by accident. **Wrong:** gotcha 4, "the
exact-indent rule is python ONLY": true as a measurement, but it hid that `python` was a constant standing in for the document's kernel, which
was the defect my first cut inherited. It did label the non-python kernel UNMEASURED. **ROI: high.**

## Session 294 Self-Assessment

**Score: 8/10.**
**Went right.** I measured before coding: a 51-language grid showed the rule is a negative list, a context grid showed S293's free case carries
over, and a kernel grid (100 documents) fixed the reader's accept set before I wrote it. Mutation testing found two unpinned terms, and scoring
candidate rows through the MUTANT bundle chose the rows that kill them. Two adversarial rounds (ten lenses, about 640 documents) found two
defects of MY design, both fixed test-first: the kernel constant (5 regressions) and "python by default" on front matter the reader could not
read (7). The 58 raw-construct phantoms were pinned and filed, not gated. Final: 917 documents scored, 462 fixed; S293's 1,124 probes give 0
regressions; corpus 0 of 3,383 changed; score unchanged 2,423/2,438; 4,028 tests; 27 mutants killed, 1 equivalent term removed.
**Went wrong.** (1) A stale `h/new.cjs` (built after slice 1, never rebuilt) made me chase an R-specific deletion that was already fixed;
`score.cjs` now refuses a stale bundle. (2) My first rule inherited S293's `python` constant and a second rule defaulted to python on unreadable
input: the same pattern as S292/S293, my matrices share my assumptions and only the adversaries find the flaw. (3) Three unmeasured numbers in
prose: a commit message (105 documents, was 100: amended), "162 + 300" in a learning, a witness range that included a right row; all caught
before close. (4) Mutation SKIPs read as a pass until I counted them. (5) Scope grew from a five-language skip to a front-matter reader (a new
module), each step forced by a measured regression of my own rule, but more than the item listed. (6) One `npm test` run failed once, uncaptured
(five green reruns). (7) No `test:integration` run (needs the screen; core-only change). (8) A reviewer's pass AFTER close-out found two
quadratic regexes in my new module (550 ms for one 30,000-space line): I should have written the hostile-line row with the regex; fixed test-first (Learning #636).
**TDD:** RED shown before GREEN for each slice (5, 42, 12, 8, 1, 10, 32 and 1 failing rows); guard rows passed on arrival and are disclosed in the ledger.
**Cost:** 10 authoring agents (about 2.07M subagent tokens), about 1,270 renders at 3 wide or fewer; no screen-taking run.
