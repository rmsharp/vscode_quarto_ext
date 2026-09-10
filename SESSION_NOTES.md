# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 260 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S260 did:** finished the close-out Session 259 abandoned. Ledgers reconciled at Phase 0
(`7739ddd2`); runtime gate run and GREEN, 544 passing; S259's fix certified by a seven-lens
adversarial pass, all 66 findings re-rendered firsthand; five root-cause items filed; the solved
item removed; learnings #520–#524. Commits: `7739ddd2` reconcile · `e2825dcc` claim · `08ceabd4`
records · `8e6546a6` notes trim · the close-out commit. **Nothing in `src/` or `test/` changed.**
**⚠ SESSION 259 SHIPPED A DELETION REGRESSION — FILED, NOT FIXED.** `maskQuotedValues` pairs quotes
blindly: an escaped quote, or an apostrophe in an unquoted value (`data-author=O'Brien`), blanks a
real `title=`, and a heading quarto renders disappears from the Outline.
**Top three, ranked (DERIVED — the operator picks):** (1) the reader-gate HIGH item: add
`fencedDivsDialect` to `calloutTitleTakes` (`model.ts:6633`), one read, MEDIUM reach; (2) the
TABSET reads: port S259's mask AND both boundaries into `divPanelTabset`, `calloutClassIndex` and
the `tabsetFirst` read, all three TOGETHER; (3) the `maskQuotedValues` regression.
**⚠ (2) AND (3) TOUCH THE SAME TOKENIZER.** The attribute-tokenizer item says one pandoc-faithful
tokenizer would subsume both. Decide whether that is a PLAN session before patching either.
**⚠ A COMMIT MESSAGE SAYING "FILED" IS NOT A FILING.** Grep the destination (Learning #520).
**⚠ `scratchpad/s260/check.py` is the one instrument** — quarto + current + BASELINE for any .qmd.
Its baseline worktree was removed at close-out; it fails with the one-line rebuild command. For a
NEW fix, point `S260_BASELINE` at a worktree of YOUR parent commit, not `efd5f478`.
**⚠ `context_budget.py` is RED on FOUR files and S260 grew all four** — `CHANGELOG.md`,
`HANDOFFS.md` (over its ceiling at EIGHT consecutive close-outs), `BACKLOG.md`,
`PROJECT_LEARNINGS.md`. MEASURE them; do not quote this line.
**⚠ SIX synced files are behind canonical.** Sync at the START of a session, never mid-flight.
**⚠ `scratchpad/` is untracked and NOT ignored** — never `git add -A` (~85,000 files).

---

## Session 259 Handoff Evaluation (by Session 260)

**Score: 3/10.** Session 259 wrote no handoff — it died before Phase 3 — so requirements 2 through
6 are simply absent, and the rubric caps that at 4. It earns 3 rather than 1 because two things it
DID leave did real handoff work, and loses one because a third actively misled.

**What helped, specifically.**
- **Its commit messages were close to a handoff on their own.** Each named its RED rows, its grid
  numbers and its mechanism in plain words. I reconstructed the whole story from `git log` in
  minutes, and every number in them that I re-measured held.
- **Its 1B stub carried two gotchas that were right** — the `title=` spelling masks the defect,
  and do not widen. The first is why every certification lens was told to probe NON-title
  attributes — and the regression lives exactly there, in one written before `title=`.
- **Its breadcrumbs worked exactly as designed.** An unfinished receipt and `CHANGELOG: pending`,
  still in place thirteen days later, are what made the dead session visible at all.

**What was missing.** Everything a close-out owes: the runtime gate, the learnings, the backlog
removal, a self-assessment, and — the one that cost real risk — any review of its own finished
code. Its fix shipped a deletion regression that an adversarial pass finds in minutes.

**What was wrong.** ⚠ **Three commits say the `h1`/`h3`/`k1` residuals were "filed, not fixed".
They were filed nowhere.** A successor trusting that line would never have filed them, and silence
would have been safer than the claim. Also wrong, by decay rather than by error: its `check.py`
imported its baseline from a temp directory that no longer existed.

**ROI: medium.** The commit messages repaid their reading many times; the false "filed" claim was
the most expensive sentence in the record.

## Session 260 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **Phase 0 caught a dead session and repaired both ledgers BEFORE the report**, as a separate
  commit, marking the reconstructed receipt `reconciled` rather than `complete`.
- ⚠ **I grepped the destination instead of trusting the promise.** Three commits said "filed"; one
  `grep` said otherwise. That single check is the difference between the residuals being filed
  and being lost for good.
- ⚠ **I treated the dead session's code as unreviewed and certified it — and the certification
  found a regression in the cardinal direction** that Session 259 introduced: seven deletions the
  baseline did not make, six of them one root cause, filed with their controls.
- **I checked the refuters' load-bearing claims myself** rather than trusting 66 of 66 surviving:
  the diff (`divPanelTabset` and `calloutClassIndex` byte-identical, one changed call at `:4181`),
  quarto's dispatch loop in `main.lua`, and a firsthand re-render of every probe — all 66
  reproduce, and the one mislabel ran in the forbidden direction.
- **I found one defect by reading the code myself** before any lens reported it — the brace shape
  test running on the raw spec rather than the mask two lines above it — and rendered it.
- **I asked before taking the operator's screen, and ran the runtime gate only after the fan-out
  finished**, so 66 quarto renders could not flake a timeout-sensitive Extension Host run.
- **I filed by root cause, five items for 66 findings, and fixed nothing** — held 1-and-done with
  the tabset fix one function away.

**What went wrong.**
- ⚠ **I GREW ALL FOUR OVER-BUDGET FILES AND REDUCED NONE.** `HANDOFFS.md` is over its ceiling for
  an eighth consecutive session. Correct for 1-and-done; I am the eighth session to say so.
- **My first reconcile draft of the receipt put the literal pending-status string inside prose** —
  a false positive for the very grep that detects an unfinished receipt. Caught before commit.
- **I used `xargs -a`, which BSD xargs does not have**, and lost one background run to it.
- **I cited a probe directory I had never listed** — "classterm", where the lens wrote to
  `boundary/` — in the records commit. A check over every cited path caught it before close-out,
  and the fix rides the close-out commit. Failure mode #11, in the session that checked for it.
- **My own new harness had the SAME temp-directory trap as Session 259's** until I made a missing
  baseline fail with the command that rebuilds it. I wrote learning #524 about the trap while
  sitting in it.

**Against the bar.** Sessions 257 and 258 each shipped a rule and attacked it. This one shipped no
code: it finished a dead session's close-out, closed the runtime gate that session never ran, and
found that the session's fix had bought a phantom fix with a deletion — then filed that and five
other root causes with rendered witnesses. What it did not do is fix any of them, or reduce a
single over-budget file.

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
