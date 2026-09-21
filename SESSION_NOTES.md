# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
### What Session 274 Did
**Deliverable:** Close open RECORD bullet (6) as a recorded DECISION — keep following
`quarto render`; do NOT mirror Posit's engine-blind fence pairing. (IN PROGRESS)
**Started:** 2026-09-20
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` — the claim commit's `CHANGELOG.md` entry says (in progress);
Phase 3F records the rest. Until close-out this line is the crash breadcrumb for the next
session's reconcile.

**⚠ THE NEW EVIDENCE THAT MAKES (6) DECIDABLE — it is UPSTREAM, and it is not a bundle grep.**
`quarto-dev/quarto#829` ("Outline includes headers in divs", OPEN, filed 2025-09-26 by
**vezwork — the Quarto VS Code extension maintainer**): *"it does seem that the outline should
match the TOC that ends up in the rendered document."* `cscheid` (quarto-cli) replies that
quarto-cli should own outline generation for clients; vezwork answers "yes please."
**So Posit's own maintainers hold that the Outline should follow the RENDER.** That makes the
Posit behaviour in (6) an acknowledged open defect on their side, not a design choice — and this
model already follows quarto there. Read firsthand, `gh issue view 829 --repo quarto-dev/quarto`.

**⚠ NOTHING IS FILED UPSTREAM for our shape, and nothing is filed HERE.** `gh issue list --state
all` on `rmsharp/vscode_quarto_ext` returns ZERO issues (issues ARE enabled; this project has
never used them — `BACKLOG.md` is the tracker). Upstream: 29 searches on `quarto-cli`, 38 on
`quarto`, label sweeps of `code-blocks` and `ast`, Discussions, and the web. Seven candidates,
**all seven refuted** by an adversarial pass. Adjacent and worth citing: `quarto-cli#14182`
(maintainer-filed, OPEN — attribute order should not decide cell-ness).

**⚠ AN AGENT CONTRADICTED THE S273 RECORD AND WAS WRONG. I MEASURED IT.** It claimed the
digit-led probe does not swallow, and that the lever is the blank line. Re-rendered the EXACT
harness bytes (extracted from `out/test/posit/runTest.js`, not retyped), quarto 1.7.33:
r02 h4=0, r03 h4=0, r05 h4=0, r01 h4=1, r06 h4=1 — **the S273 record reproduces exactly.**
2x2 on r03: the lever is the TRAILING BARE FENCE, not the blank line (with it h4=0 both ways;
without it h4=1 both ways). Raw HTML shows `#### Charlie After Chunk` INSIDE `<pre><code>`, and
`{.2x .cell-code}` proves knitr claimed it and pandoc refused the class. The agent's probe had no
trailing fence — **the exact error S273 filed as Learning #573**, committed by an agent that had it.

**⚠ Gates:** close-out runs `python3 quality_ratchet.py --run`; cite the head the RESULTS FILE
records. One `CHANGELOG.md` entry per commit. **⚠ Write a number only after measuring it** (#552).
**⚠ `$?` after a pipe is not a measurement** (#567). **⚠ `cd` moves the session cwd** (#535).
**⚠ Never `git add -A`** — `scratchpad/` is untracked. **⚠ Never `grep -r` from the repo root** —
`scratchpad/` is ~85,000 files; use `git grep`.
---

## Session 272 Handoff Evaluation (by Session 273)

**Score: 9/10.** Its recommendation was right and it was RIGHT ABOUT ITS OWN UNRELIABILITY — the one
sentence that shaped this session most was its warning that its own line numbers were stale. Every
number it stated as measured held when I re-measured it. One point off because the item it
recommended carried a factual error it passed on without flagging.

**What helped, specifically.**
- ⚠ **`whats_next` #1 labelled its own fix sites an ESTIMATE and told me to re-derive them.** They
  were all stale — `:6024` now lands on `endLine: number;`, `:7315`/`:7347` inside a docstring. A
  handoff that says "this part of me has probably rotted" is worth more than one that is quietly
  wrong, and it cost me nothing because it said so.
- ⚠ **Gotcha (3), #569 — check which probe rows DISCRIMINATE before spending the screen.** I labelled
  each of the six R5 probes DECIDING or CORROBORATING in its own `why:` before the launch. Three
  decided; the corroborating ones are what let me say a "no heading" answer would have been about
  the option tail rather than the engine name.
- ⚠ **Gotcha (7), screen runs need the go-ahead BEFORE launch, VS Code 1.129.0 pinned.** Consent was
  taken before all three launches, the pin was already in the file, and nothing cost a wasted run.
- **#552, #535, `git add -A`, the ordinal rule, and the one-entry-per-commit ledger rule** — all
  used, all accurate. #567 caught me in the act at Phase 0 and I re-measured.

**What was missing / wrong.**
- ⚠ **It repeated the backlog's trigger for R5 without checking it, and the trigger is wrong.**
  "Both knitr chunk-grammar … `{fortran95, eval = FALSE}`" carries the item's "digit-bearing engine
  with spaced options" framing. Measured: `{glue_sql, connection = con}` has no digit and fires;
  `{cpp11,eval=FALSE}` has a digit and does not. Same class of defect its own S271 evaluation
  criticised — a handoff that quotes an item inherits the item's errors.
- ⚠ **It ranked R5 and R6 together as one pick, "1 document and 1 heading each".** They are not
  comparable work: R6's ground truth was never measured under real execution, and R5's fix needed
  engine plumbing R6 does not obviously share. Taking them as one unit would have been FM #26.
- **It could not have known the fix needs the model to learn the document engine at all** — nothing
  in the record pointed there, and the root cause is a missing PIPELINE STAGE, not a wrong regex.
  Not a fault; recorded so the next session does not read its silence as evidence.

## Session 273 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I fixed the root cause, not the symptom, and the docstring proves I looked.** The naive fix is
  to widen `CELL_INFO` to accept digits; its docstring forbids that with measured render rows, and a
  refuter measured the price of ignoring it (5 unit tests red, 6 oracle rows moved, 4 corpus
  documents gaining cells — the cardinal-sin direction — for the identical +1). The real cause is
  that `computeRegions` modelled quarto's pipeline as `readqmd → pandoc` and a knitr document has a
  stage before both. `quarto pandoc -f markdown -t html` reproduces the model's answer exactly on the
  repro, which is the proof the pandoc layer was never at fault.
- ⚠ **The adversarial pass found two defects in a design that had already been built and
  corpus-measured by its author, and I re-measured both before acting** (#574). One was fatal to the
  regex — knitr's own grammar over-fires because pandoc refuses a class that does not start with a
  letter. ⚠ **My first attempt to reproduce that refutation FAILED and said "all 7 accepted"**; my
  probe lacked the trailing fence so the heading survived either way, and I was grepping for the
  consequence instead of the thing under test (#573). Reading one raw HTML output settled it.
- ⚠ **I caught my own Phase 3E gap instead of banking the green.** The first `test:integration` was
  549 passing, exit 0 — the baseline count — on a change that is mostly wiring. That proves no
  regression and cannot prove the engine reaches the model, and the unit suite cannot either since it
  passes the engine in directly. One adapter-level test took it to 550 and turned it into a real
  gate (#576). An unchanged test count on a wiring change is the tell, not the reassurance.
- ⚠ **The observation's BY-CATCH is worth more than its confirmation** (#575). Six probes, one
  launch, four answers: R5 confirmed against both oracles, the first measured quarto/Posit
  disagreement filed as an open decision, and the tilde divergence promoted to a plain defect.
- **Strict TDD:** ONE failing test first, shown failing for the right reason (`expected [] to
  deeply equal [ 'After Chunk' ]`) before any `src/` edit. Every guard expectation was measured
  against real `quarto render` with real knitr execution BEFORE it was written.
- **"Nothing else moved" is proved, not asserted:** 1 of 3,383 documents changed, 0 headings lost,
  `test:oracle` byte-identical to its standing S180-onward figure, and the pre-fix control run.

**What went wrong.**
- ⚠ **I spent a SECOND `test:integration` launch on a gap I should have seen before the first.**
  The deliverable was a wiring change from the moment the design landed; that the suite could not
  observe it was knowable without running anything. The operator granted the screen twice and the
  second was avoidable by thirty seconds of thought — S270's exact lesson, which I had read.
- ⚠ **My first pandoc probe was wrong and I nearly published its answer** (#573). It contradicted a
  refuter's measurement and I would have been entitled to believe myself.
- ⚠ **My own test comment inflated the count it cited.** I wrote "47 `assert.deepStrictEqual`" into
  a comment that itself contains that identifier, so the grep it tells the next session to run
  returns a different number. Corrected in place to the code-line count, with the trap named.
- **I wrote a self-referential fence bug into the first guard test** — the helper ignored its second
  argument, so the tilde row silently ran the backtick shape. The test failed and caught it, which
  is the system working, but it was my error.
- **TDD:** honoured for the behaviour that drove the code. The 7 guards and the integration test are
  measured pins on shapes the change bounds, added after GREEN and labelled as such.
  **Runtime:** `npm run test:integration` in a real Extension Development Host with the operator's
  go-ahead — **550 passing, exit 0**, including the new adapter-level R5 row. `npm run
  observe:posit` likewise — **9 passing, exit 0**, `ours-loaded: false`, both controls green.
  **Growth:** `src/` +~90 lines (mostly the measured docstring), `test/unit` +~135, `test/posit/`
  net −40, `test/integration` +60, `PROJECT_LEARNINGS.md` +5 rows, `BACKLOG.md` net +1 item.
  **Cost:** two workflows, 17 agents, 0 errors, ~2.03M subagent tokens, ~700 tool calls, plus ~60
  quarto renders of my own.

**Against the bar.** Sessions 270 and 271 shipped measured decisions; 272 shipped a measured fix.
This one shipped a fix whose verdict was itself measured against both oracles rather than assumed —
and the part worth repeating is that the two things that most improved it, the regex narrowing and
the Phase 3E gap, were both caught by attacking my own work after it already looked finished.

## Session 271 Handoff Evaluation (by Session 272)

**Score: 9/10.** Its recommendation was right, its two warnings about the fix were the two things
worth warning about, and every number it stated held when I re-measured it. One point off because
its single ESTIMATE was wrong in the direction that would have made the work look harder than it is.

**What helped, specifically.**
- ⚠ **`whats_next` #1 named the item, its direction and its size, and the ranking survived.** "80
  headings across 30 documents, deletion direction, against the product oracle" — I re-derived all
  three from a throwaway build before touching anything and got 30 / 80 / 0-lost exactly. A
  recommendation whose numbers reproduce is worth more than one that argues well.
- ⚠ **Gotcha (6), "a score that excludes failing documents cannot price a change that touches
  them."** This is why I classified all 30 documents against the ground truth instead of reading the
  score line — and the answer (all 30 exit 1, zero scorable) is the fact the whole decision rests on.
- ⚠ **`whats_next` #2 corrected the inherited oracle-cost claim, and it was right.** It measured
  that `midDocumentMetadataRegions` is module-local, so a heading-side fix reaches no diagnostic.
  I verified it independently — the oracle's import closure touches `model.ts` only through
  `findCellOptionLines`, which reads the `cells` view — and ran `test:oracle` green to confirm.
- **Gotcha (8), screen-taking runs need the go-ahead BEFORE launch, pin 1.129.0, mocha `bdd`.** Two
  screen runs this session, both with consent taken first, both green on the first attempt.
- **#552, #535, `git add -A`, and the ordinal rule** — all used, all accurate.

**What was missing / wrong.**
- ⚠ **Its one ESTIMATE was wrong, and it was labelled as one, which is why this costs a single
  point.** "A fix has to separate reader resolution from heading suppression." It does not: the two
  arms already fork at the enumeration and never rejoin, so removing the span arm needed no
  separation work at all and every Session 211 test stayed green with no edit. Believing it would
  have bought engineering that was not needed.
- ⚠ **And the blast radius it implied was too NARROW in the other direction.** The suppression's
  `continue` sat in `computeRegions`' shared loop, so it skipped the line for every region view —
  `findMathRegions` moves too, which no record mentions. The handoff sized the change by the name of
  the flag rather than by what the `continue` skips.
- **It could not have known the fix unmasks a pre-existing defect** (the empty `---` / `---` pair),
  and nothing it wrote pointed at it. Not a fault; recorded so the next session does not read its
  silence as evidence.

**ROI: very high.** Orientation to a reproduced defect and a measured baseline took about thirty
minutes, and its #1 was directly actionable with no re-derivation of the ranking.

## Session 272 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I asked the oracle FIRST and asked it about the FEATURE, not the two spellings I inherited.**
  Fifteen probes, each rendered through real quarto before the run and then proved byte-identical to
  the bytes the harness writes by reading them back out of the compiled `out/test/posit/runTest.js`.
  Posit answered all seven suppressed spellings the same way, including both block-quote ones no
  session had ever observed — so the decision rests on the rule, not on a sample of it.
- ⚠ **The control I added is the one that turned an observation into a conclusion.**
  `m11_fm_only` carries `author: Kilo Author` and Posit lists only the real heading. Without it the
  finding is "Posit shows things inside `---` spans"; with it the finding is "Posit models the
  opening block and only the opening block", which is a rule this model can implement exactly.
- ⚠ **Two test rows went red in the DELETING direction and I did not narrow the change to make them
  green.** The disproof took one probe: the same bytes on the PRE-change build under a reader that
  never consumed already answered `h2:---`. The suppression was masking a pre-existing defect, and
  narrowing would have put the mask back and cost the 80 headings (#568). Filed with its reach — 1
  occurrence in 1 of 3,383 documents — rather than hidden.
- **Strict TDD:** ONE failing test written first and shown failing for the right reason (the heading
  absent, its control present) before any `src/` edit. The five inverse-polarity guards — the rows
  asserting a heading is PRESENT — needed no edit at all, which is the mechanical proof the change
  only ever added headings; the corpus says the same thing as a number: 80 gained, **0 lost**.
- **25 unit expectations and 2 integration assertions were REVERSED IN PLACE with their reason,
  not deleted** (#570). Every one is still a correct measurement of `quarto render`; only the
  product's answer changed, and the suite now says so at the point of use.
- **I measured the corpus claim rather than quoting it** — 30 documents, 80 headings, 0 lost, all 30
  `.Rmd` and all 30 quarto-exit-1, classified against the ground truth rather than inferred from the
  unchanged score.

**What went wrong.**
- ⚠ **I wrote "every one a real slide title" into the permanent record before counting.** One of the
  80 is an `h2:---` row from the defect the change unmasks. I caught it myself, two steps later, and
  corrected the docstring in place — but it is the second session running to publish an unmeasured
  number into a code comment, and #552 exists precisely for this.
- ⚠ **I tripped the `cd` gotcha (#535)**, in the session whose ACTIVE TASK warns about it. Harmless.
- **My first pass at the reversals guessed at actual values instead of measuring them**, and the
  parse of the vitest log silently returned nothing because I had filtered blank lines out of it. I
  switched to reading the real actuals out of an unfiltered run, and later to evaluating the two
  remaining expressions directly. No wrong value reached the file, but the first approach would have.
- **TDD:** honoured for the one behaviour that drove the code; the 27 reversals are expectation
  updates to existing pins, not new behaviour, and are labelled as reversals. **Runtime:**
  `npm run test:integration` in a real Extension Development Host with the operator's go-ahead —
  **549 passing, exit 0**, including the reversed Outline test and Session 211's reader-resolution
  test. **Growth:** `src/` **−286 lines net**, `test/unit` +~200, `PROJECT_LEARNINGS.md` +4 rows,
  `BACKLOG.md` net 0 items (one closed, one filed). **Cost:** one workflow, 11 agents, 0 errors,
  ~1.04M subagent tokens, 271 tool calls, ~22 min wall, plus ~40 quarto renders of my own.

**Against the bar.** Sessions 270 and 271 each built the instrument and used it to decide *not* to
change anything. This session used the same instrument to decide the other way and then shipped the
change — and the part worth repeating is that the two red rows which looked like my regression were
measured on a build where the mask never applied before I touched the design.

## Session 270 Handoff Evaluation (by Session 271)

**Score: 9/10.** Its single most important sentence reordered this entire session, its gotchas were
accurate enough that two screen-taking traps cost nothing, and nothing it stated as a fact turned out
false. One point off for a recommendation ranked by a measure its own gotcha says is partial.

**What helped, specifically.**
- ⚠ **`whats_next` #2: "ASK WHICH ORACLE GOVERNS BEFORE BUILDING."** This is the whole session. R2
  was the top-ranked fixable divergence; one screen run turned it into a decision with no `src/`
  change. A handoff that puts the cheap disqualifying question ahead of the expensive work is worth
  more than one that describes the work well.
- ⚠ **Gotcha (5), Learning #561 — "a corpus document quarto REFUSES to render is invisible to the
  score."** This is why I looked past the score line at all. The candidate fix *improves* the score;
  the bundle diff says it deletes 90 headings, 83 of them in documents the score cannot see. Without
  that sentence resident I would have shipped a +1 and called it a fix.
- ⚠ **Gotchas (1) and (2) — pin the VS Code version, write mocha `bdd`.** S270 paid two launches of
  the operator's screen for these; I paid none. The pin was already in the file I extended and I ran
  `npm run compile-tests` before asking for the screen.
- **Gotcha (3), `ours-loaded:`** — read it every run, `false` every run. **#552, #535, `git add -A`**
  — all used, all accurate. Its ordinals (2147, 2275) and phantom count matched my baseline exactly.

**What was missing / wrong.**
- ⚠ **It ranked R2 "the largest remaining once (c) was decided" by headings the SCORE attributes,
  while its own gotcha (5) says that measure is blind to exit-1 documents.** The deciding fact — that
  a fix touches 32 documents, 31 of them unscorable — was one bundle diff away and was not flagged.
  Same class as the criticism S270 itself levelled at S269: carrying a ranking forward without
  re-checking the metric behind it.
- **The inherited "a change needs its own `test:oracle` run" is broader than the code.** Measured this
  session: `quarto-yaml-regions.ts` has exactly two importers, so only a change to the PORT reaches
  the validation partitioner; `midDocumentMetadataRegions` is module-local to `model.ts`. Not its
  error — it carried the phrasing from the `START_CODE` item — but a handoff that quotes a constraint
  inherits the constraint's imprecision.
- **Nothing it stated as a fact turned out false.**

**ROI: very high.** Orientation to a measured baseline took about twenty minutes, and its #2 saved the
session from building a 90-heading deletion.

## Session 271 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I priced the alternative before asking the operator to choose.** The score says the fix is an
  improvement; the document-by-document bundle diff says it deletes 90 headings across 32 documents,
  31 of which quarto exits 1 on. Both throwaway builds (`build-nofence`, `build-nomidyaml`) were
  scored and diffed rather than argued about, which is what turned "should we fix R2?" into a
  decision the operator could make from numbers.
- ⚠ **The observation was designed to be readable before it was run.** Every probe file was rendered
  through real quarto FIRST, so the record holds both oracles' answers for the same bytes; an `.Rmd`
  control went in beside the `.qmd` one, so a `(no symbols)` row for an `.Rmd` probe could not be
  confused with "Posit does not handle `.Rmd`" (#565). One launch, with the go-ahead taken before it,
  and it answered more than it was asked.
- ⚠ **The by-catch is worth more than the deliverable.** The same run showed the model DELETING a
  heading Posit shows on the no-chunk spelling — 80 headings across 30 documents, and the score does
  not move when the feature is turned off entirely. Filed with its measurement rather than fixed,
  because it is a different capability (FM #26).
- **"Nothing changed" is proved:** `model.tsv`, `model.cjs` and `rawadj.tsv` are byte-identical
  between the baseline and final runs across all 3,383 corpus documents.
- ⚠ **I verified the fan-out rather than believing it, and that is what caught the errors.** 16
  agents; every refinement I adopted was re-rendered firsthand before being written down. Two claims
  did not survive as stated: a sibling's corpus scan said 310 documents where my own
  stated-definition scan says 104, and the same-stem `.rmarkdown` deletion looked refuted. ⚠ **That
  second one was MY error, not theirs** — my negative probe had no code chunk, so knitr never ran and
  the hazard could not fire. It reproduces exactly as reported when the render invokes knitr, and I
  had already published "does not reproduce" before finding out (#567).

**What went wrong.**
- ⚠ **I wrote an INFERRED mechanism into the permanent record and had to correct it.** Quarto's own
  warning named `Duplicate key: ['::']`, so I wrote the `::: {.cell}` pair in as the cause. Deleting
  both lines swallows the heading just the same — the div is a passenger, and the load-bearing clause
  is the blank line I never varied. A fan-out found it, not me. Filed as #566 with the rule that
  would have caught it: delete the part you called load-bearing and re-render.
- ⚠ **I published a REFUTATION that was itself under-tested.** I recorded that two agents' same-stem
  `.rmarkdown` claim "does not reproduce"; it reproduces whenever the render actually runs knitr, and
  my probe had no chunk in it. A non-reproduction measures your probe, not the claim — folded into
  #567, and it is the more useful half of that row.
- ⚠ **I wrote a SECOND unmeasured number into the record: "`.rmarkdown` render exits 0."** It exits
  1; the 0 was the status of the `head` the command was piped into. Corrected in place with the slip
  disclosed, and filed as #567 — `$?` after a pipe is not a measurement. Two write-then-verify
  failures in one session is the pattern worth carrying forward, not either instance.
- ⚠ **I tripped the `cd` gotcha (#535) twice**, in the session whose ACTIVE TASK warns about it.
  Harmless both times; the warning exists because it is not always harmless.
- **I committed records while the fan-out's verification half was still running**, then had to
  reopen them when it landed. Nothing rested on an unverified claim — but two of the four commits that
  followed exist because I did not wait, and one of them corrects a number I had already published.
- **TDD:** exempt — no `src/` logic changed; the harness change is declarative probe data and its
  verification is its two controls, which fail loudly. **Runtime:** `npm run observe:posit` ran in a
  real Extension Development Host with consent, 11 passing, exit 0. **Growth:** `test/posit/` +~60
  lines, `BACKLOG.md` +1 item and 4 edits, `PROJECT_LEARNINGS.md` +5 rows, `docs/` +1 decision block.

**Against the bar.** Session 270 built the instrument and made one decision with it; this session used
it twice in one run — once to decide R2 and once to find the defect pointing the other way — and put a
price on the road not taken instead of asserting that it was wrong.

