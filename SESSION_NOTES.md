# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 259 IN PROGRESS** — **`divCalloutTitleSlot` matches its class name inside an
ATTRIBUTE VALUE**, so `::: {.note data-x=".callout-note"}` / `## D3 Inside` is a PLAIN div whose
`<h2>` quarto really renders, and this model deletes it. `BACKLOG.md` "Up Next" head item, filed by
Session 258 against Session 257's SHIPPED code; operator-picked at Phase 0.
**Why this one:** it is the **deletion direction** — the cardinal-sin direction — in shipped code,
with a rendered witness already on disk, and the fix is ONE token: prefix both patterns with
`(?:^|[\s{])`, exactly as S258's `divPanelTabset` and `calloutClassIndex` already do.
**Status:** CLAIMED. Work beginning. Strict TDD (CLAUDE.md operator directive) — RED before GREEN.
**Ledger:** `CHANGELOG: pending` — this session's actions are recorded in `CHANGELOG.md` at Phase 3F.
Until close-out this line is the crash breadcrumb for the next session's reconcile.
**⚠ THE `title=` SPELLING MASKS THE DEFECT AND THAT IS WHY IT SURVIVED REVIEW.**
`title=".callout-note"` is non-empty, so the title branch returns false first and the probe AGREES.
Any OTHER attribute exposes it (`data-x=`, a bare `=`-less value). Probe a non-`title` attribute.
**⚠ DO NOT WIDEN WHILE YOU ARE THERE.** The filed item says so explicitly. The reader-gate half
(six of nine readers have no `fenced_divs`) is a SEPARATE filed HIGH item — that is next session's.
**Phase 0 findings (S259).** Tree clean; `scratchpad/` untracked and NOT ignored — a bare
`git add -A` stages ~85,000 files. Both ledger frontiers are `HEAD` (`efd5f478`); zero undocumented
commits; no ghost sessions; no `pending` receipt. `gh issue list` genuinely empty, so `BACKLOG.md`
governs — 198 open. Dashboard 76/100, risk high. `compile` clean, `npm test` 2858 / 66 files.
**⚠ `context_budget.py` is RED on FOUR files** — measured this session, not quoted: `CHANGELOG.md`
73,320 B, `HANDOFFS.md` 97,150 B (a **SEVENTH** consecutive session), `BACKLOG.md` 290,925 B,
`PROJECT_LEARNINGS.md` 970,359 B, all against a 65,536 B ceiling. The first two are
trimmer-supported; the last two are not (upstream BL-32: a backlog's reduction axis is STATUS).
**⚠ FOUR synced files are behind canonical** — `FRAMEWORK_LEARNINGS.md` 3 commits,
`methodology_dashboard.py` 5, `methodology_trim.py` 4, `context_budget.py` 2. Sync at the START.

---

## Session 257 Handoff Evaluation (by Session 258)

**Score: 9/10.** The most useful handoff I could have been given for this task, and its value was
direct rather than incidental: it had annotated the very item the operator picked, and four of its
eight gotchas fired. Complete on all six Minimum Handoff Requirements.

**What helped, specifically.**
- ⚠ **Gotcha 1 — *"WHEN A FILED ITEM'S WORDING ADMITS TWO PREDICATES, BUILD THE PROBE THAT
  DISAGREES BETWEEN THEM BEFORE WRITING CODE"* — is the reason this rule is correct.** The filed
  item said *"suppress headings at the tabset's TAB LEVEL"*, which admits at least four predicates
  that agree on every obvious probe. One render separated them: `### First` / `## Second` inside a
  tabset renders `h2:Second`, so the level is the FIRST heading's, **not** the shallowest — and a
  fifth probe showed the test is EQUALITY, not `level <= tabLevel`. Both wrong readings delete a
  heading quarto renders.
- **Gotcha 2 — *"a document-level 0 regressions can hide a deletion"*** — is why I scored per
  HEADING as well as per document. That check is what exposed a defect in my own scorer.
- **Gotcha 3 — *"regenerate the baseline from the parent commit; READ the TSV separator"*** — I did
  both, in a throwaway worktree, and asserted the separator in the census rather than assuming it.
- **Gotcha 5 — *"`outline.test.ts` runs mocha BDD; `test(` fails the whole FILE"*** — saved the
  exact 2-minute Extension Host run S257 lost to it.
- **Gotcha 6 — *"verify every fan-out claim firsthand"*** — the defining discipline of this session.
  My adversarial pass returned 21 findings, every one claiming a deletion; **16 were pre-existing
  and not mine**, and only a mechanical baseline comparison could tell which.
- **Its `whats_next` #3 said DO NOT DERIVE THIS FROM THE CALLOUT CODE and listed four measured ways
  a tabset is wider.** All four held. That warning is why I started from renders instead of from
  `divCalloutTitleSlot`.

**What was missing.** ⚠ **Its own rule carries two live heading-DELETING defects that the same
reasoning would have found, and its adversarial pass did not.** Gotcha 4 says *"when a rule turns
on an attribute, probe the EMPTY value"* — the neighbouring question, *does my class pattern
require a token boundary*, was never asked, and `::: {.note data-x=".callout-note"}` deletes a real
heading today. The second is the reader gap: under the six readers with no `fenced_divs` a `:::` is
prose, and the callout rule fires anyway. I found both by accident while hardening my own
predicate; both are now filed as HIGH with rendered witnesses.

**What was wrong: nothing.** Every measurement I re-checked reproduced, including the 0-of-3,383
raw-HTML claim, which I re-measured for `.panel-tabset` and got 0 of 51.

**ROI: very high** — four gotchas fired and one of them determined the shape of the rule.

## Session 258 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I RENDERED THE LEVEL GRID BEFORE WRITING A LINE, AND IT REFUTED THE OBVIOUS PREDICATE.** The
  filed wording admits *first*, *shallowest*, *`<=`* and *every-level* readings; they agree on the
  minimal pair and disagree on real documents. Then I read quarto's own filter and found the code
  says exactly what the renders said (`main.lua:21643`) — measurement first, source second, and
  they had to agree before I believed either.
- ⚠ **I RAN AN ADVERSARIAL PASS AGAINST MY OWN FINISHED, GREEN, CORPUS-SCORED CHANGE, AND IT FOUND
  ELEVEN REAL DEFECTS.** The change had passed a 90-document rendered grid, 2,844 unit tests and a
  3,383-document corpus score reporting 0 losses. It was still deleting headings — because a wide
  rule inherits every latent defect a narrow one was hiding (Learning #515). Fixing them took four
  more RED→GREEN cycles and cost the corpus score nothing.
- ⚠ **I SEPARATED "MY DEFECT" FROM "PRE-EXISTING" MECHANICALLY RATHER THAN BY JUDGEMENT.** All 21
  findings were re-run against quarto, the BASELINE build and mine. 16 were not mine. A session
  that argued about them instead would have burned the time and got it wrong.
- ⚠ **I DISTRUSTED MY OWN SCORER WHEN TWO OF MY MEASUREMENTS DISAGREED.** A firsthand sweep said 14
  documents lost a rendered heading; the corpus scorer said 0. Both were right about different
  questions, and the baseline comparison reconciled them at 0 newly-introduced losses. I also found
  and fixed a stale-file defect in my own mutation harness that had scored one mutant with the
  previous mutant's output.
- **I measured the fail-safe's cost BEFORE adopting it** — 0 of 68 real tabset openers have a
  preamble — rather than trading away real coverage on a hunch.
- **Every guard is shown RED by mutation, twice**: 12 mutants against a 117-document rendered grid
  and the same 12 against the shipped rows.
- **I asked before taking the operator's screen**, and the runtime row drives the real
  `DocumentSymbolProvider` with two deletion guards, not just an absence check.
- **Two long-standing pinned residuals closed as a side effect** (S229 R5, S233 R1), re-rendered to
  confirm rather than assumed, and their assertions reversed in place.

**What went wrong.**
- ⚠ **I SHIPPED A COMMIT THAT DELETED HEADINGS QUARTO RENDERS.** `80fce2da` was green on every gate
  this project has and wrong in eleven ways. It was caught inside the session, but the fact that
  the full gate set passed it is the finding, not the recovery.
- ⚠ **I WROTE THE TOKEN-BOUNDARY GUARD SPECULATIVELY, WITHOUT A FAILING TEST FIRST.** It turned out
  to be load-bearing (mutant M1 deletes three probes' headings), but I established that by
  mutation AFTER the fact. That is test-after wearing a mutation-testing costume.
- ⚠ **MY FAN-OUT HELPER WROTE THREE FIXED TEMP FILENAMES AND FIVE AGENTS RAN IT CONCURRENTLY.** I
  fixed it before the refute phase, but the attack phase's results were produced by an instrument
  that could have crossed agents' outputs — which is why every finding had to be re-run anyway.
- **`HANDOFFS.md` is over budget for a SIXTH session and I pushed `CHANGELOG.md` further too.**
  Correct for 1-and-done; I am the sixth session to say so instead of fixing it.

**Against the bar.** S257 shipped one rule and disclosed one residual. This shipped a rule with a
wider blast radius, then attacked it hard enough to find that it was wrong, fixed it, and left two
HIGH defects in *shipped* code filed with rendered witnesses. What it did not do is fix those two,
or reduce any of the four over-budget files.

## Session 256 Handoff Evaluation (by Session 257)

**Score: 8/10.** Complete on all six Minimum Handoff Requirements, and honest about its own
misses in a way that made them usable. Its ROI for THIS session was mostly indirect — the
operator picked feature work, which S256 explicitly listed as `whats_next` #4 and did not rank —
but three of its gotchas fired anyway and one of them changed how I ran the session.

**What helped, specifically.**
- ⚠ **Gotcha 1 — *"RUN THE TOOL AGAINST THE TARGET BEFORE PLANNING THE WORK"* — generalised
  past its own subject and is the reason this session's shape was right.** S256 meant a python
  trimmer. I read it as *measure the target before designing the fix*, rendered the minimal pair
  through the real quarto CLI at claim time, and the second probe (a paragraph before the
  heading) inverted the filed item's own wording: the rule is FIRST BLOCK, not FIRST HEADING. A
  session that trusted the filed sentence would have deleted a heading quarto renders.
- **Gotcha 7 — *"MY OWN FAN-OUT PRODUCED TWO CONFIDENT WRONG REFUTATIONS"*** — is why I verified
  every agent claim firsthand before acting on it. Two mattered: the raw-HTML callout (true, and
  I re-measured it) and `title=""` (true, and sharper than reported — whitespace is NOT empty).
- **Its `whats_next` #4 named the `:::` div family with the F4 counts**, which is what let Phase 0
  present a ranked `AskUserQuestion` in one pass instead of re-deriving the ranking.

**What was missing.** ⚠ **Its context-budget warning was written as a static list and has now
been true for three sessions running with no owner.** `HANDOFFS.md` has been over budget since
S255 named it, each close-out pushes it further, and every handoff since has repeated the warning
rather than either fixing it or saying who should. Mine is the fourth. That is a warning
decaying into furniture.

**What was wrong: nothing.** Every measurement I re-checked reproduced.

**ROI: medium-high** — indirect for the task, but gotcha 1 shaped the method.

## Session 257 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I RENDERED THE PROBE THAT DISAGREES BETWEEN THE TWO READINGS OF THE FILED ITEM, BEFORE
  WRITING ANY CODE.** The item says quarto lifts *"the first heading inside a callout"*. That
  sentence admits two predicates — *first heading in the div* and *first BLOCK is a header* —
  which agree on the obvious probe. One render separated them, and four more boundary shapes fell
  out of the correct reading (a nested div, a code block, a thematic break, an HTML comment above
  the heading all defeat the lift). A rule built on the other reading deletes a real heading in
  every one of those.
- ⚠ **I SCORED THE CHANGE OVER 3,383 AUTHORED DOCUMENTS AND REPORTED THE DIRECTION THAT MATTERS,
  NOT JUST THE HEADLINE.** 124 → 80 divergent, 44 fixed, 0 regressed — and then the stronger
  check: 138 headings removed, 0 added, and **0 of the removals are headings quarto renders**.
  A document-level "0 regressions" would have hidden a deletion inside a still-divergent document.
- ⚠ **I DISTRUSTED MY OWN GREEN RESULT WHEN ITS ARITHMETIC DID NOT RECONCILE.** The first scoring
  pass said *0 regressions* AND *57 headings added* — impossible for a suppression-only change.
  Two real instrument defects were behind it: a stored baseline several model changes stale, and
  a TSV separator I had assumed (`\x1f`) rather than read (`\x01`). Rebuilding the baseline in a
  throwaway worktree at the parent commit made it reconcile exactly.
- **The adversarial verifier earned its cost.** It found `title=""` — my predicate read the
  attribute's PRESENCE where quarto reads its VALUE — in code that already passed every test I
  had written. I re-measured firsthand and found it sharper still: `title="   "` is not empty.
- **I declined half the filed item on a measurement and pinned the residual as a live test.** The
  raw-HTML spelling really is still a phantom; **244 of 3,383 documents use a fenced callout and
  ZERO use raw HTML**. It is measured, disclosed, pinned as a failing-if-fixed assertion, and
  re-filed — which is what separates partial delivery from scope-shaving.
- **I asked before taking the operator's screen**, and once authorised I did not stop at "the
  extension runs": I added an outline row that drives the real `DocumentSymbolProvider`, so the
  runtime gate proves THIS change rather than the build.
- **Every `[]` expectation carries a plain-div control**, so a narrowing that rejected everything
  could not pass.

**What went wrong.**
- ⚠ **I USED `test(` IN A BDD SUITE AND FAILED THE WHOLE FILE AT LOAD — IN A FILE THAT DOCUMENTS
  THAT EXACT TRAP.** Session 211 lost a row to it and left a comment saying so, ~200 lines above
  where I was typing. I had read that file. That is a wasted 2-minute Extension Host run on the
  operator's screen, which is the expensive kind of avoidable.
- ⚠ **I SHIPPED A PREDICATE THAT WAS WRONG TWICE AND A VERIFIER FOUND BOTH, NOT ME.** Presence vs
  value, then a value that read past its own closing quote. My probes were all shapes I had
  already thought of; I did not probe the empty case at all until told to.
- **I mis-parsed the divergence file on the first attempt** and briefly reported 150/92 with two
  regressions, all artifacts of a path heuristic that matched non-path lines. Caught within the
  minute because the numbers disagreed with the scorer, but I had already printed them.
- **`HANDOFFS.md` is over budget for a fourth session and my receipt pushes it further.** Correct
  for 1-and-done, and I am now the fourth session to say so instead of fixing it.

**Against the bar.** S254–S256 were records maintenance. This is the first feature change in that
stretch, and it moves the model's agreement with quarto on real authored documents by 1.81 points
with zero measured regressions — the highest-reach item on the ranked list, filed 52 sessions ago
by S205 and unranked until S251 measured it. What it did not do is close the raw-HTML half, or
touch the three files that are still over budget.


## Session 255 Handoff Evaluation (by Session 256)

**Score: 7/10.** Its `whats_next` **#1 is what produced this session** — correctly named, correctly
measured, and framed with the observation that mattered most (*"S254 and S255 each read ~160 of its
13,912 lines and inferred the rest, which is FM #28 committed by the sessions that documented it"*).
Three of its six gotchas fired here and all three had real ROI, which is a high hit rate.

**What helped, specifically.**
- ⚠ **Gotcha 3 — *"grep the upstream tracker before filing, then read what you find"* — was the
  single highest-value line in the file.** Acting on it found **BL-32**, open since 2026-08-11 and
  describing this exact gap, so nothing was filed as a duplicate; it also found canonical's own
  hand-built `BACKLOG-archive-2026-08-15.md.verify.sh` (the template this session's proof follows)
  **and BL-36**, which is why that proof is identity-keyed rather than positional.
- **Gotcha 5 — *"`context_budget.py` switches axis"*** — saved a wrong diagnosis. After the trim the
  tool printed `173 ln / 400 ln` and still said `over`; because of this gotcha I looked for the
  other axis (`max_line_bytes: 280`) instead of assuming a tool bug.
- **Gotcha 6 — *"a sync can change things mid-session; diff before continuing"*** — canonical
  committed at 08:43 and three synced tools flipped `ok`→`warn` under me. This gotcha is why they
  were reported rather than re-synced mid-flight.

**What was missing — one omission, and it is the defining fact of the task it was handing over.**
⚠ **IT NAMED THE DELIVERABLE WITHOUT EVER RUNNING THE TOOL AT IT.**
`methodology_trim.py --file SESSION_NOTES.md --check` returns `NO_CONFIG` in under a second and
inverts the whole shape of the work: the trimmer refuses this file *by design*, and no `LedgerSpec`
could be authored for it at all. S255 had just synced that tool and read its version diff, so it was
the session best placed to find this. Worse, listing #1 (this file) adjacent to #3 (a `HANDOFFS.md`
trim, complete with a ready `methodology_trim.py --file HANDOFFS.md --cut <date>` command) reads as
though they are the same operation at different scale. **They are not**, and a successor who trusted
the adjacency would have opened by typing a command that exits 3.

**What was wrong: nothing.** Every measurement reproduced, including the ones it flagged as
estimates. Its byte figure differs from Phase 0's only because its own close-out commit landed after
it measured.

**ROI: high** — three gotchas fired, and #1 was the session.

## Session 256 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I RAN THE TOOL AT THE TARGET BEFORE PLANNING, AND IT INVERTED THE TASK.** One command at claim
  time turned "re-run the S254 trim on a third file" into "the tool refuses this, and cannot be made
  to accept it". Everything good about this session follows from that one second.
- **I established WHY it refuses by measurement, not by reading the docstring.** `date_of_record` is
  required and `evaluate()` freezes oldest-by-date; **458 of 740 records carry no date at all** and
  only 88 of 740 headings do. That is a stronger and more useful reason than "nobody added a config
  row", and it is what rules out ever filing "add a `LedgerSpec` for this file" as a fix.
- **I searched canonical before building, and it paid three ways** — BL-32 already open (so nothing
  filed), a working hand-trim precedent to model, and BL-36's positional-proof trap avoided.
- ⚠ **I WROTE THE PROOF FIRST AND DROVE IT RED THROUGH SIX INJECTED DEFECT CLASSES, AND IT FOUND
  THREE REAL DEFECTS IN MY OWN TOOLING** — an off-by-one trailing newline, a proof that crashed
  instead of reporting FAIL, and a corruption mode that never reached the check it targeted. A green
  check never shown to go red is an assertion, not evidence.
- **I kept the trim commit free of any other edit to the trimmed file** — the independent second
  defence against BL-36 — and split at 5 files when the staged set hit 7, rather than waving the
  blast-radius cap through.
- **`check-package` caught a real leak I caused** (`__pycache__/` from importing the trimmer) and I
  denied it durably in both ignore files rather than deleting it, because the next import recreates
  it.
- **I attached a rule to the reduction.** This file had already been drained twice under an
  instruction to "keep it clean"; without a gated rule it regrows a third time.
- **I corrected my own rule when it did not survive contact.** I first wrote "keep two pairs", then
  noticed a closing session *writes* a pair, so three is the honest steady state. Fixed the rule
  rather than quietly violating it.

**What went wrong.**
- ⚠ **I CAUSED THE PACKAGING BREAK MYSELF.** Importing `methodology_trim` as a module was the right
  investigative move, but this is the 5th instance of a failure class this project has recorded four
  times. I knew the class and still did not set `PYTHONDONTWRITEBYTECODE` consistently.
- ⚠ **TWO OF MY OWN VERIFIER AGENTS "REFUTED" TRUE CLAIMS BY CHECKING THE WRONG REPOSITORY** — my
  prompt template hard-coded one repo path into the refuter preamble while the claims under test
  were scoped to a sibling. I caught it because I had verified canonical's HEAD firsthand, but a
  session that trusted the fan-out would have discarded two correct findings.
- **I did not reduce the other three red files.** Correct for 1-and-done, but `HANDOFFS.md` has now
  been over budget for two consecutive sessions and my own receipt pushes it further.
- **The shard is 3.94 MB of tracked content.** Defensible (it matches the precedent in this repo and
  in canonical, and `docs/**` is excluded from packaging) but it is a real cost, chosen rather than
  forced — the tool's own advice ranks a bare `git show` pointer above it at zero bytes.

**Against the bar.** S254 trimmed two files with a tool. S255 found the project was not a current
adopter. This one found that the tool cannot do the third file *and cannot be made to*, and shipped
a reduction plus the rule that stops it recurring. What it did not do is reduce the three files that
are still red.
