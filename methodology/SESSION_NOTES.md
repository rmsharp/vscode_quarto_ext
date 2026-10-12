# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 298 (IN PROGRESS): row (3)(a) of "Kernel-cell closing and the unbounded second look" -- STACKED BLOCK ENDERS in the free case.**
Operator picked it at Phase 0. Workstream: `DEVELOPMENT_WORKSTREAM.md`, strict TDD. Quarto lists the heading in 298 of 450 `stk` documents, this build in 94.
**⚠ Gotchas:** (1) never `git add -A`. (2) CAP and ANNOUNCE renders: authors never render, the caller renders 3 wide, load gate 25. (3) mutation edits `src/`: run it alone.

### What Session 298 Did
**Deliverable:** make the free case's block-boundary test accept a second ender of any kind after an ender, where quarto does (IN PROGRESS)
**Started:** 2026-10-12
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` -- the claim commit's `CHANGELOG.md` entry says (in progress); Phase 3F records the rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.

## Session 296 Handoff Evaluation (by Session 297)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its receipt said `BACKLOG.md` "Active" was empty and listed the open items; the
`key_files` line numbers I checked were exact at HEAD (`cmColumns` and `fenceColumns` 8487-8488, the raw block start 8426, the unclosed-fence rule 8681,
`fancyListsReader` 7446); the ratchet citation (2/2, `bba236856bad`) matched the stored results; its figures reproduced exactly (`tally.sh` over 3,979 probes:
1,215 fixed, 43 regressed).
**Helped:** the item's row (6) (six controls named with their corpus path), the cached renders under `scratchpad/s296` (I scored the controls in two minutes),
`render.sh`, `score.cjs`'s stale-bundle refusal, `hn.cjs`, `mutate296.py` and `mutdiff.cjs` (forked), Learnings #646, #652 and #654, gotchas 1, 2 and 7.
**Missing:** that the item's one-line fix ("a plain top-level scalar test") was a seed and not a design, since the six controls were a sample of an open-ended
space (the real cost was three blind rounds, 27 slices and a differential fuzz); that the item named only Session 296's rules when Session 289's
unclosed-comment swallow had the identical hole; and that `render.sh` copies no helper files, so include probes cannot render (found only when a lens came back
24 of 50 refused). **Wrong:** the item's estimate priced the rule, not the proof; and "six rendered controls delete" was seven (control 046 also lost more
headings). **ROI: high.**

## Session 297 Self-Assessment

**Score: 8/10.**
**Went right.** I measured before coding (a 100-spelling x 5-trigger grid, the controls' cached renders, a 1,058-document misread product grid) and showed RED
before GREEN for each slice (126 rows in the Session 297 suite, 6 retired). Three blind rounds (20 agents, about 4.4M subagent tokens, none rendered; about
2,650 renders by the caller at 3 wide) found in RENDERED documents every way past three successive designs (36, then 33 and 12 documents); the third design is a
whitelist, and a differential fuzz (about 5 million documents, js-yaml as the oracle) reports 0 hazards while finding 4,830 in the parent build and 963 in the
first whitelist. A critic's ten gaps were measured: an include shortcode, `metadata-files` and a later block that replaces `format:` were real, `pandoc-args`, a project-level reader and a later `format: null`
block were refuted, and five rule-side leads stay unrendered. The product grid showed the Session 296 rules the proof does not gate cost phantoms and no deletions, so I left them. Mutation: 93 mutants, 11 observable survivors got rows from their
shortest rendered killers and 3 unreached guards got crafted witnesses. Final: 0 of 887 blind documents where the pre-Session-296 build was right and this one
deletes (the parent: 205); grid deletion cells 55 to 0 and 11 to 0; Session 296's corpora 8 lost fixes and 5 deletions removed; realistic retention 88 of 103;
corpus 0 of 3,383 changed; score unchanged 2,423/2,438; tests 4,463 to 4,583.
**Went wrong.** (1) My first proof (a bracket counter) and then a quote lexer were unsound in ways the rounds had to find; I reached the whitelist only after
round 1 showed a lexer loses its place in the unsound direction. (2) I took "two rules" as the scope: the same hole lived in a third and a fourth, found only
because the grid used every trigger kind (the fourth I extended in this session, disclosed). (3) `render.sh` could not render documents with helper files, so a
lens scored 26 of 50 and the include and `metadata-files` hazards stayed hidden for a round. (4) Rows that claimed quarto's exact answer failed where the old
phantom remained: 10 rows became RESIDUAL. (5) Scope: one item became 27 slices, each forced by a measured hazard of my own design. (6) No `test:integration`
run (needs the screen; core-only change). (7) Two background jobs launched with both `&` and run-in-background died silently, a stale sweep had to be killed
after a late fix, and a test file was edited while authors read it (harmless).
**TDD:** RED shown before GREEN for slices 1-3, 6-27 (each class's rows failed first); slices 4-5 (an alias, a body block) passed on arrival because slice 1's
byte-equality already covered them; the retention rows, the guards, the residual rows and the mutation killers and witnesses pass on arrival (disclosed).
**Cost:** 20 authoring agents (about 4.4M subagent tokens), about 2,650 renders at 3 wide, 93 mutants, about 5 million fuzz documents, no screen-taking run.

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
