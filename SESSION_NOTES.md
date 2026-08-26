# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 256 closed out.** Pick from `BACKLOG.md` "Up Next", or take one of the
three named items under *What's next* below. `BACKLOG.md`'s "Active" section is empty, so Phase 0
must present ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**Last shipped:** Session 256 — reduced `SESSION_NOTES.md` from **3,949,501 B / 13,942 lines** to
**13,454 B / 172 lines** (99.66%), archiving 738 records to
[`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) with a
hand-written identity-keyed proof. Also denied `__pycache__/` in both ignore lists.
**Status:** DONE (SHIPPED). `compile` clean · `npm test` 2796 / 66 files · `check-package` OK 42 /
5.59 MB · `check-backlog` OK 193 · all three archive `verify.sh` OK.
**⚠ `context_budget.py` is still RED on three files** — `HANDOFFS.md` (its ceiling is
65,536 B; this session's receipt pushed it further, so measure it, do not trust a number written
here), `BACKLOG.md` (284,130 B) and `PROJECT_LEARNINGS.md` (954,418 B). `SESSION_NOTES.md` is now
green. Run `python3 context_budget.py`.
**⚠ Three synced tools went 1 commit behind DURING this session** — canonical committed at 08:43
(`84abc60`, its S111). Deliberately not re-synced mid-session; see gotcha 4.

---

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

## Session 253 Handoff Evaluation (by Session 254)

**Score: 7/10.** Well-formed, honest, and complete on all six Minimum Handoff Requirements. It had
**almost zero ROI for this session**, because the operator redirected to a ledger trim that no part
of it anticipated — that is a property of what task came next, not a flaw, and I have not docked it
for that.

**What helped.** Its `active_task` line saved me real time at Phase 0: *"the promotion question is
CLOSED — do not re-raise it on presence counts"* is exactly the kind of closed-door marker that stops
a fresh session from reopening a settled argument, and I did not. Its gotcha 1 — *a presence count is
not a priority signal until you check it was measured with the instrument the item needs* — is the
best sentence in the file and generalises well past its own subject; it is the same shape as the
error I nearly made when I wrote **219** into a front-matter count sentence from a bare grep.

**What was missing — one omission, and it is squarely in scope.** ⚠ **IT WAS TRACKING REPOSITORY
BLOAT AND POINTED THE LENS EVERYWHERE EXCEPT AT THE TWO FILES IT WAS ITSELF WRITING.** Its
`whats_next` carries a standing housekeeping flag — *"`.vscode-test/` 18 GB, `scratchpad/` ~2.9 GB and
untracked"* — so size was actively on its mind. Meanwhile `HANDOFFS.md`, the file that receipt was
being appended to, stood at **1.8 MB against a documented 65,536 B budget (27×)**, with a tool
installed in the repo that reports exactly that in one command. Not one of the 66 handoffs since
Session 188 mentions it. **This is not really S253's failure alone — it is a 66-session blind spot
(Learning #499) — but the handoff is where "what's next" lives, so it is where the miss shows.**

**What was wrong: nothing.** Every claim I checked reproduced.

**ROI: low for this task, through no fault of its own; its gotcha 1 still earned its place.**

---

## Session 254 Self-Assessment

**Score: 8/10.**

**What went right.**
- **I did not stop at the task as stated.** The ask was a trim. Getting there required finding and
  fixing **three separate pre-existing defects**, each of which had survived every prior session:
  the stale seed footer that made the tool refuse outright, **two receipts written with no closing
  fence**, and a declared front-matter field the file never had.
- ⚠ **THE FENCE REPAIR HAD TO HAPPEN BEFORE THE TRIM, AND ALMOST DIDN'T.** S227 and S226 are dated
  2026-08-19 — *inside* the archive cut. Trimming first would have **frozen a wrong partition into
  an immutable shard**. I found them only because a count sentence I was writing disagreed with the
  tool by 3, and I chased the discrepancy instead of trusting either number.
- **Losslessness was established three ways, one sharing no code with the tool.** The independent
  verifier re-implements the fence scanner, record splitter, code-span finder and link inverter,
  and compares the **ordered record list byte-for-byte** against the baseline commit. 8/8 on both
  files. I also ran a four-lens adversarial pass whose explicit job was to *refute* the claim.
- **I proved the seam on the artifacts, not from the absence of a warning** — retained ∩ archived
  dates empty, newest archived == the shard's name key, oldest retained strictly newer. The
  canonical repo's S107 receipt names this exact trap and I applied it deliberately.
- **I read both tool versions before believing either verdict** when the emitted `verify.sh`
  contradicted the in-process assertion, and found the real cause — a fixed upstream bug — rather
  than accepting the FAIL or waving it away.
- **I chose the clean calendar seam over the tool's default cut**, so both shard names are true
  statements rather than span labels, at a cost of ~10 KB of live file.
- **I did not edit the synced tool**, even though a two-line fix was obvious and tempting.

**What went wrong.**
- ⚠ **I WROTE 219 INTO THE FRONT MATTER FROM A BARE GREP, AND THE FILE I WAS EDITING WAS THE ONE
  THAT PROVES BARE GREPS DON'T WORK ON IT.** Caught before commit only because the tool's own count
  disagreed. Had the numbers happened to match, I would have shipped it and the recount advice
  attached to it would have propagated the error to whoever ran it next.
- ⚠ **I HIT THE P1 PRECONDITION TWICE.** The first time was legitimate discovery. The second was
  after my own fence-repair commit, and by then I knew the rule — I simply did not re-check before
  reaching for the dry run.
- **The two repaired receipts are still incomplete** — S227 and S226 lack `gotchas:` and
  `whats_next:` entirely. I fixed the structure and could not fix the content without fabricating
  it, so those two receipts are now well-formed and still hollow.
- **I shipped a known-broken artifact.** `verify.sh` for the HANDOFFS shard reports FAIL. Correct
  call given the alternative was editing a synced file, but the repo now contains a proof script
  that fails on a good archive, mitigated only by a README a reader has to notice.

**Against the bar.** Larger blast radius than Sessions 251–253, which touched one markdown file
each. This one rewrote both durable ledgers, deleted content from an append-only record, and
created a new archive directory — and every one of those steps is independently reversible by a
single `git revert`. What it adds to the project is not the 2.5 MB; it is that the tool is now
**wired and firing** rather than installed and mute, and that the next session inherits a Phase 0
that reads two small files instead of two huge ones.

