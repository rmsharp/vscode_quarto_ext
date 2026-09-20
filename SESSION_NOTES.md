# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 272 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S272 did:** took the NEW (S271) mid-document-metadata item and **FIXED it** — the first
`src/` change in three sessions, after two consecutive decisions. The Outline no longer models
mid-document YAML metadata at all; it models the OPENING block and only the opening block, which is
what Posit does.
**Measured, not quoted:** `tools/realdoc-score/run.sh s272-final` = **2,421 / 2,438 (99.30%),
divergent 17**, the IDENTICAL ordinal lists as the baseline run; the bundle diff is **30 documents,
80 headings GAINED, 0 LOST**. All 30 are `.Rmd` and `quarto render` exits 1 on all 30, so zero
scorable documents are touched — which is why the score cannot see a thing.
**The oracle was asked FIRST, and widely:** `npm run observe:posit`, 15 probes, every one rendered
through real quarto BEFORE the run and proved byte-identical to the bytes the harness writes. Posit
shows the heading for ALL SEVEN suppressed spellings — including both block-quote ones, never
observed before — and lists NO front-matter key (`m11_fm_only`), which is the control that turns
"Posit ignores YAML" into "Posit models the opening block only".
Commits: `bfd8d2f5` claim · `54a4a1c6` the 13 probes · `dc4c478d` the fix · `77c403df` records.
**Recommended next pick: (e) R5 and (f) R6** — the last two FIXABLE scorable divergences, 1 document
and 1 heading each, both knitr chunk-grammar. Or the two RECORD decisions still resting on a bundle
grep (raw-HTML `<hN>`, R7's appendix re-level); the harness now has 13 probes' worth of shape to
copy, so probing them is cheaper than it has ever been.
**⚠ The fix UNMASKED a pre-existing defect and it is filed, not hidden** — an EMPTY `---` / `---`
pair reads as a setext heading `h2:---`. Reach: 1 occurrence in 1 of 3,383 documents (ordinal 2256,
quarto-exit-1). ⚠ **Do NOT fix it by putting the suppression back**; that masked it and cost 80
headings. S241's C6 already refutes the obvious cheap fix with six rendered rows.
**⚠ The separation the item warned about was already in the code** — the two arms fork at the
enumeration and never rejoin, so every S211 reader-resolution test stayed green untouched. But the
skip reached FOUR features, not one: `findHeadings`, `findBodyLines` **and `findMathRegions`** all
move; cells and fence openers do not, which is why the oracle could not (and did not) move.
**⚠ Gates:** close-out runs `python3 quality_ratchet.py --run`; cite the head the RESULTS FILE
records. One `CHANGELOG.md` entry per commit. **⚠ Write a number only after measuring it** (#552).
**⚠ `cd` moves the session cwd** (#535) — tripped once. **⚠ Never `git add -A`.**
---

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

## Session 269 Handoff Evaluation (by Session 270)

**Score: 8/10.** The task was pickable in under twenty minutes, its DONE criterion was set before
any measurement, and nothing it stated as a fact turned out false. Two points off for a framing it
inherited without checking and a question it never raised.

**What helped, specifically.**
- ⚠ **`whats_next` #1 named (c), R3, with its cost, its fix sites AND the word ESTIMATE on both.**
  That is the shape a recommendation should have: actionable, and honest about which parts are guesses.
- ⚠ **"DONE for any heading fix includes a `run.sh` line in the receipt AND a document-by-document
  diff of the two model bundles."** I measured the baseline before touching anything because of that
  sentence, and the diff is what let this session prove "nothing changed" byte-identically instead of
  asserting it.
- ⚠ **The instrument trap (#554).** I grepped raw HTML for `<h[1-6]` on every probe whose heading
  line could open a swallowing element, and so did the 42 agents, because the warning was explicit
  about WHY the extractor is blind rather than just saying "be careful".
- **#555 one-name-per-document, #552 measure-then-write, the gate-citation rule and `git add -A`** —
  all used, all accurate. The gate citation caught me: the results file records `a55d90e1`, and I
  read it rather than assuming.

**What was missing / wrong.**
- ⚠ **It recommended R3 as a FIX and never asked which oracle governs it.** `CLAUDE.md`'s clean-room
  boundary — written three sessions earlier, by the session that made exactly this kind of call — says
  a quarto/Posit disagreement is a decision, not a defect. R3 turned out to be one, and the answer was
  "ship nothing". A single line ("check the oracle before building") would have reordered this whole
  session. It is the same class of omission as recommending a fix site without checking it.
- ⚠ **It repeated the audit's account of R3's mechanism, which is measurably wrong** ("a row wider
  than its border fuses `Head` / `====`"). One character wider is the single width that does NOT fire.
  Not originally its error, but a handoff that quotes an audit inherits the audit's defects.
- **Nothing it stated as a fact turned out false**, and its fix-site estimate (`:4531`–`:4586`) does
  land on the grid-table region — `GRID_TABLE_BORDER` is at `:4585`.

**ROI: high.** Orientation to the first measured baseline was about fifteen minutes, and its DONE
criterion is the reason this session has a proof rather than a claim.

## Session 270 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **The audit's own reproduction failed to reproduce, and I treated that as the finding rather
  than as my own typo.** Typing out F2's R3 repro gave no heading; six further mis-alignment
  spellings gave none either. Chasing that produced the corrected mechanism (two or more characters,
  not one; the last non-whitespace character, not the closing pipe) and a **second trigger the audit
  never mentions** — a `+===+` divider truncated at a column boundary.
- ⚠ **I built the observation the project had required for three sessions and never had.**
  `CLAUDE.md` has said since S267 that "what does Posit do?" is settled black-box; two sessions
  grepped the bundle anyway and both said afterwards it was wrong. `npm run observe:posit` answered
  it in one run, and its two design constraints are the load-bearing part: the symbol command MERGES
  providers, so ours must not load (`ours-loaded: false` is printed every run), and the control is
  the only assertion, because "no symbols" and "no provider" are otherwise the same output.
- ⚠ **I asked at both real decision points instead of deciding.** Which oracle governs R3 was not
  mine to settle, and neither was taking the screen — the go-ahead came before the launch, not after.
- **I verified the agents rather than believing them.** M1's surprising indent cliff, the corpus
  counts, the two ordinals that exit 1 — all re-measured firsthand. The adversarial pass corrected
  **9 of 37** verified claims, including one that would have put a wrong causal rule in the record.
- **"Nothing changed" is proved, not asserted:** `model.tsv` and `model.cjs` are byte-identical
  between the baseline and final runs across all 3,383 corpus documents.

**What went wrong.**
- ⚠ **I spent the operator's screen twice on one observation, and both failures were preventable.**
  First I left `@vscode/test-electron` unpinned — while `CLAUDE.md`'s own script table says the
  runners are pinned and the file I copied from carries a comment explaining why — so it downloaded
  302 MB of 1.138.0 and died on `ENOENT`. Then I wrote the suite with mocha `suite`/`test` against a
  runner configured `bdd`. Thirty seconds reading `test/integration/suite/outline.test.ts` would have
  caught the second. Consent for a screen-taking action is not a licence to iterate on it.
- ⚠ **I tripped the `cd` gotcha (#535) in the same session I read the warning.** Harmless here, and
  exactly the failure mode the warning exists for.
- **`.vscode-test/` grew by a 302 MB VS Code I do not need** — the filed item already says that
  directory is 18 GB with no visible signal. I am leaving it, and saying so, rather than quietly
  deleting a gitignored tree that other harnesses pin into.
- **TDD:** exempt — no `src/` logic changed; the harness's verification is its control, which fails
  loudly. **Runtime:** the harness ran in a real Extension Development Host and its control passed;
  the extension's own runtime is untouched and its bundle is byte-identical. **Growth:**
  `test/posit/` +~250 lines, `PROJECT_LEARNINGS.md` +4 rows, `BACKLOG.md` +~3 KB, `docs/` +1
  correction block. **Cost:** one workflow, 42 agents, 0 errors, ~3.16M subagent tokens, 774 tool
  calls, ~24 min wall, plus ~120 quarto renders of my own.

**Against the bar.** Session 269 shipped a measured fix; this one shipped a measured *decision* and
an instrument that makes the next such decision cheap. The part I would repeat: refusing to let the
audit's sentence stand once its own repro contradicted it. The part I would not: burning two launches
of the operator's screen on mistakes that reading two nearby files would have prevented.

## Session 268 Handoff Evaluation (by Session 269)

**Score: 8/10.** The task was pickable in minutes and its DONE criterion was set before any code was
written. Two points off: the one guess it made about WHERE the fix goes was wrong in the deleting
direction, and its own gate citation named the wrong commit.

**What helped, specifically.**
- ⚠ **`whats_next` #1 carried the repro path, the two tables and the expected verdict** ("model five
  headings, quarto three"). I re-rendered it at Orient and it was exact.
- ⚠ **"DONE for any heading fix now includes a `run.sh` line in the receipt."** That is the sentence
  that made this session measure a baseline *before* touching code, and measure it three times after.
- **The measure itself.** Four commands became one, ~5 s warm, so "did that change help?" was
  answerable at every checkpoint instead of once at the end.
- **The ordinal rule (#548), "measure the number then write it" (#552), and `git add -A`** — all used,
  all accurate.

**What was missing / wrong.**
- ⚠ **The fix-site guess was wrong, and trusting it would have deleted headings.** It named
  `parseHeadingLine (:9763)` or the ATX row (`:8245`). The gate belongs in `buildHeading`, which both
  heading paths share — and the ATX-row spelling of it (forcing `m` to null) is measurably WORSE than
  nothing: two rendered documents lose a real heading that way (Learning #557). It was labelled an
  ESTIMATE, which is the only reason this costs one point rather than three.
- ⚠ **Its `quality_ratchet` citation said "run at `3a6e451d`" where `.quality-gates-results.json`
  records `head: ed135ec7`.** Same class as the slip it had just filed as #552, in the one field the
  protocol tells you to cite.
- **Nothing it stated as a fact turned out false.**

**ROI: high.** Orientation to the first measured baseline was under twenty minutes.

## Session 269 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **Every design choice was decided by a render, not by reasoning.** The biggest one — drop the
  EMISSION rather than decline the MATCH — was settled by two documents quarto renders and the
  `m = null` spelling deletes (#557), and confirmed by quarto's own AST calling the refused line
  `Plain`, not `Para`.
- ⚠ **I refused to reuse the obvious table.** `RAW_TEX_BLOCK_OR_MACRO_LINE` denies by default; the
  heading question allows by default. Measured cost of getting that backwards: 18 corpus documents
  and 73 heading lines, against the 1 line R4 is about (#556).
- **Strict TDD on both halves**, each RED shown failing for its stated reason (the phantom
  `h2:\maketitle`, then the phantom `h3:1. <Section heading>`) before any `src/` change, with 19
  guards green first.
- **28 mutants, 27 killed** — including one that puts `applet`/`object` back. The survivor is
  disclosed in the docstring rather than quietly repaired.
- **The blast radius is a measurement, not an argument:** exactly **2 of 3,383** corpus outlines
  change. A pre-existing phantom `SETEXT_H1` documents was recovered as by-catch, and its pin rewritten.
- **The runtime gate ran with consent** and asserts both directions, so it cannot pass for a build
  that has simply stopped showing headings that mention a tag.

**What went wrong.**
- ⚠ **I shipped a DELETION for one commit, on my own bad measurement.** `applet` and `object` went
  into the refusing set because the project's standing extractor said they refused; it cannot see
  past the element they open. A subagent contradicted me and it was right. I had used the instrument
  without asking what it is blind to — and this rule is *about* the shapes it is blind to (#554).
- ⚠ **I drew a conclusion from a contaminated single-document sweep** before re-running it one name
  per document (#555). I caught that one myself, but only after acting on it.
- **The CDATA branch is pinned by nothing.** Disclosed, not fixed.
- **TDD:** honoured for the two behaviours that drove the code; R4c–R4m are labelled TEST-AFTER in
  the file itself. **Runtime:** 549 passing. **Growth:** `src/` +~330 lines, tests +~240,
  `PROJECT_LEARNINGS.md` +4 rows, `BACKLOG.md` net −1 item.
- **Cost:** one workflow, 9 agents, ~1.05M subagent tokens, ~700 quarto renders.

**Against the bar.** Session 268 made the measure cheap; this session spent that cheapness on
measuring the thing it was about to ship — and the one place it did not, it shipped a deletion and
had to be told.
