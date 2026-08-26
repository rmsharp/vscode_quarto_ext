# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 257 closed out.** `BACKLOG.md`'s "Active" section is empty, so Phase 0
must present ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**Last shipped:** Session 257 — **the callout title slot**. A heading that is a `::: {.callout-*}`
div's FIRST BLOCK is quarto's title bar, not a heading; `findHeadings` no longer reports it.
**Measured over the 3,383-document authored corpus: 124 → 80 divergent documents, 94.91% →
96.72% structural agreement, 44 fixed, 0 regressed.** At heading granularity 138 removed, 0 added,
and **0 of the removals are headings quarto renders**.
**Status:** DONE (SHIPPED). `compile` clean · `npm test` **2817** / 66 files · `test:integration`
**543 passing, exit 0** (operator-authorised; it takes over the screen) · `check-package` OK 42 /
5.60 MB · `check-backlog` OK **195** open.
**⚠ The RAW-HTML half of that item was DECLINED on a measurement and is re-filed** — a raw
`<div class="callout-note">` really does render a callout, but **244 of 3,383 authored documents
carry a fenced callout div and ZERO carry a raw-HTML one**. Pinned live as guard G12.
**⚠ `context_budget.py` is now RED on FOUR files, and I TIPPED THE FOURTH.** `CHANGELOG.md` was
GREEN at my Phase 0 and my ledger entry pushed it to 67,279 B against a 65,536 B ceiling. ⚠ Unlike
`SESSION_NOTES.md`, it IS supported by the trimmer: `python3 methodology_trim.py --file
CHANGELOG.md --cut <date>`, clean calendar seam, and RECORD BEFORE YOU TRIM (Learning #498).
Also still red: `HANDOFFS.md` (a FOURTH consecutive session, and this receipt pushes it further),
`BACKLOG.md`, `PROJECT_LEARNINGS.md`. Measure them; do not trust a number written inside the file
it measures.
**⚠ The three synced tools are 1–2 commits behind canonical.** Sync at the START of a session.
**⚠ `scratchpad/` is untracked but NOT ignored** — a bare `git add -A` stages ~85,000 files.

---

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

## Session 254 Handoff Evaluation (by Session 255)

**Score: 6/10.** Written by me, one session earlier, and scored on what it actually did for its
successor rather than on how thorough it felt. Its `key_files` block was genuinely excellent — line
numbers into both tool versions (`methodology_trim.py:1231` vs canonical `:1417`) that resolved
exactly and made the root-cause diff a two-minute job. Its `whats_next` **#1 is what produced this
session's first half**, precisely scoped and correct.

**It loses four points for forward-looking claims that were wrong in the direction that causes
wasted work.**
- ⚠ **`whats_next` #2 SENT ITS SUCCESSOR TO BUILD SOMETHING THAT ALREADY EXISTED.** *"WIRE THE
  TRIMMER TO SOMETHING THAT READS IT … it is a methodology change, so it belongs in CLAUDE.md's
  adaptations, not in a synced file."* The methodology already ships `context_budget.py` for exactly
  this, listed in the manifest as an adopter file. Had I followed my own instruction I would have
  hand-built a worse copy of a distributed tool. (Learning #503.)
- ⚠ **Two risk claims were inferred from documentation rather than measured.** *"`bin/sync` REFUSES
  to overwrite drifted files"* — it does not; `--dry-run` said "would write" for all eight, no
  `--force`. And *"v1.3.0 ALSO CHANGES SHARD NAMING (BL-41), so this is its own deliverable, NOT a
  drive-by"* — BL-41 changes only *collision* handling and renames nothing existing. Both claims
  made the correct action look riskier than it was, which is the direction that causes a successor
  to defer.
- **It never asked the general question.** It cited `../methodology` six times and never diffed this
  repo against the manifest — the check that found two missing files and six stale ones in a single
  command.

**What was right:** every measurement reproduced exactly, and its gotchas 1–4 all held.

**ROI: high for #1, negative for #2** — the whole point of the score.

---

## Session 255 Self-Assessment

**Score: 8/10.**

**What went right.**
- **The operator's four-word question — *"Did you look at ../methodology"* — was worth more than my
  entire prior analysis, and I treated it as a real question rather than defending the work.** The
  answer was "yes, but never at the one question that mattered," and running that comparison
  reframed the whole task from *invent a gate* to *you are missing the gate that exists*.
- **I checked upstream before filing and it stopped me duplicating BL-46**, which had been raised
  the day before from a sweep naming this very repo. Then I read it properly and found its remedy
  would not have fired here — a correction only the site that reproduced the defect could supply.
- **I diffed `SESSION_RUNNER.md` before continuing under it**, since a sync changes the protocol
  mid-session. It added FM #28, which is the general form of what S254 had just fixed by hand.
- **I let the new gate report three files over budget rather than tuning ceilings to green**, and
  said so explicitly — including that the worst offender is a file *I* skimmed at Phase 0 twice.
- **I corrected two of my own wrong claims to the operator** (the `--force` requirement, the BL-41
  risk) as soon as measurement contradicted them, in the record and not only in conversation.
- **I predicted the `check-package` break at claim time** and it failed exactly as predicted.

**What went wrong.**
- ⚠ **THE WRONG CLAIMS I CORRECTED WERE MINE, AND I MADE THEM BY READING DOCUMENTATION INSTEAD OF
  RUNNING A DRY RUN THAT COSTS ONE COMMAND.** I reported a `--force` requirement to the operator as
  fact. `bin/sync --dry-run` was available the entire time.
- ⚠ **I ALMOST FILED A DUPLICATE UPSTREAM ITEM.** I had drafted four findings and only checked the
  tracker at the last step. One was already BL-46.
- **This session is large** — two repos, ten commits, a protocol change adopted mid-flight. It is
  one coherent intent and the operator authorised it explicitly, but the blast radius is the widest
  of any session in this stretch and a crash midway would have left a genuinely confusing tree.
- **`HANDOFFS.md` is near its ceiling and this receipt pushes it closer**, which I noted rather than
  pre-emptively trimmed — correct for 1-and-done, but it hands a near-full file to the next session.

**Against the bar.** S254 fixed two files. This one fixed why they were broken and why nobody
noticed, then reported both back to the upstream that would otherwise ship the same defect to the
next adopter. What it did not do is reduce the 3.9 MB file it just proved nobody can read.
