# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 261 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S261 did:** the callout reader gate — `calloutTitleTakes` now reads `fencedDivsDialect`
(`ec1e1cfa`). 36 rendered losses fixed; a 157-agent adversarial pass plus a firsthand re-render of
all 1,419 probes found no heading removed and no new wrong logic; everything it un-masked is pinned
(R6, R7) and filed. Runtime gate GREEN, 545 passing. Commits: `468b310a` claim · `ec1e1cfa` fix ·
`8b5884f5` guards · `0f5ddff7` corrected comment + pins · `c96e6a81` notes trim · `6e1b0601` records
· the close-out one.
**Top three, by title (DERIVED — the operator picks):** (1) "the TABSET reads never got Session
259's three fixes" and (2) "`maskQuotedValues` pairs quote characters blindly" — now the head of
"Up Next"; (3) "`divColumns` is pushed for `:::` lines that are not divs at all", widened by S261.
**⚠ (1) AND (2) TOUCH THE SAME TOKENIZER.** The attribute-tokenizer item says one pandoc-faithful
tokenizer subsumes both. Decide whether that is a PLAN session before patching either.
**⚠ A CHANGE THAT STOPS SUPPRESSING SOMETHING UN-MASKS OLD ERRORS.** Build the plain twin of every
"introduced" finding before believing it (Learning #525).
**⚠ `scratchpad/s260/check.py` is still the one instrument.** Point `S260_BASELINE` at a worktree of
YOUR parent commit; S261's (`468b310a`) was removed at close-out.
**⚠ `context_budget.py` is RED on FOUR files and S261 grew all four** — `CHANGELOG.md`,
`HANDOFFS.md` (over its ceiling at NINE consecutive close-outs), `BACKLOG.md`,
`PROJECT_LEARNINGS.md`. MEASURE them; do not quote this line.
**⚠ SEVEN synced files differ from canonical by `cmp`.** Sync at the START of a session, never
mid-flight.
**⚠ `scratchpad/` is untracked and NOT ignored** — never `git add -A` (~85,000 files).

---

## Session 260 Handoff Evaluation (by Session 261)

**Score: 8/10.** Complete on all six Minimum Handoff Requirements, and its `whats_next` #1 was the
task the operator picked, with the file, the line and the one-read size of the fix. It loses two
points for two claims that did not survive measurement.

**What helped, specifically.**
- ⚠ **Gotcha 4 — "the baseline for a new fix is your OWN parent commit; set `S260_BASELINE`"** —
  and `check.py` as "the one instrument". I built one worktree at my claim commit and wrote no
  harness of my own; every render I ran went through it with a baseline column.
- ⚠ **Gotcha 2 — "a refute stage that kills nothing is not evidence on its own"** — is why I
  re-rendered all 1,419 adversarial probes and twins myself rather than trust 150 refuter verdicts. That
  re-render is what showed the 75 "introduced" findings were un-masked, not new (Learning #525).
- **Gotcha 3 — "score against the parent commit, never in absolute"** — the baseline column is the
  only thing that separates the phantoms my gate exposed from any it created (there were none).
- **`whats_next` #1 cited `model.ts:6633` and `:6666` correctly**, re-read firsthand; "one read"
  was exactly the size of the fix.
- **The budget warning said "MEASURE them; do not quote this line"**, and I measured them.

**What was wrong.**
- ⚠ **"One read; MEDIUM reach; deletion direction. MEASURED."** The reach was never measured: 6 of
  3,383 authored documents declare any `from:`, all with fenced divs, and a two-build census
  changed 0 of 28,103 headings. The label was the filed item's, carried under a MEASURED tag
  (Learning #528).
- **"Six synced files are behind canonical."** `cmp` finds seven; two are under
  `docs/methodology/`, which `context_budget.py` does not track.

**What was missing.** Nothing it could have known: that gating the callout rule would un-mask every
plain-div defect under the same readers took a 157-agent fan-out to see.

**ROI: high** — the pick, the instrument and three gotchas repaid the read many times over.

## Session 261 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I rendered the reader grid BEFORE writing a test, and it found the one place the fix would
  be wrong** — a glued heading under `markdown-fenced_divs` — and a plain-div twin showed the same
  wrong answer already existed, so I disclosed and pinned it instead of bending the gate around it.
- **Strict TDD, shown:** R1 RED for the right reason (the model hid `Inside` under all six readers),
  one condition GREEN, then guards each killed by a mutant, re-run after R7 was added.
- ⚠ **I did not trust 150 refuter verdicts or 75 "introduced" claims.** I re-rendered all 1,419
  probes and twins and classified direction from the three lists myself. That is what turned "75
  regressions" into "no new wrong logic, no heading removed" — and it exposed my own comment.
- **I measured reach before claiming value:** the census changed 0 of 28,103 headings, and I
  recorded that the filed "MEDIUM" was never measured instead of repeating it.
- **I asked before taking the screen and ran the runtime gate last**, behind guards that refused to
  start it with a dirty `model.ts` or a live render: 545 passing.
- **Everything the fan-out found is filed by root cause** — one widened item, three new — and every
  cited probe path was checked to resolve before commit.

**What went wrong.**
- ⚠ **I committed a comment claim before the adversarial pass could test it.** "The push still shows
  through in ONE measured place" shipped with the fix and was false; the fan-out found five more
  readers and three more paths. It cost a correction commit (`0f5ddff7`).
- ⚠ **I wrote a count from a render that was still running.** "839" went into a comment, a commit
  message and three records; the final is 1,419. The `0f5ddff7` message cannot be corrected.
- **I lost a render group to zsh word-splitting** (19 of 71 rows), the same class of shell trap
  Session 260 hit with BSD xargs (Learning #529).
- **The fan-out was expensive:** 157 agents, ~94 minutes, and its refuters wrote 1,088 variants I
  then re-rendered. "Reproduce, then build ONE plain twin" would have cost a third as much.
- **I grew all four over-budget files again and reduced none** — the ninth close-out to do so.

**Against the bar.** Sessions 257 and 258 each shipped a rule and attacked it; Session 260 certified
a dead session's. This shipped a one-condition fix for a HIGH deletion item, attacked it harder than
any of them, and established by measurement that everything the attack found was un-masked rather
than created. What it did not do is reduce a single over-budget file.

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
