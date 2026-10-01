# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 281 closed out (P2 of the attribute-tokenizer plan SHIPPED).** `BACKLOG.md` "Active" is
empty, so Phase 0 MUST present ranked candidates via `AskUserQuestion`.
**What S281 did:** new leaf `src/core/qmd/attribute-block.ts` + pandoc truth fixture (`a55735ae`); `:::` openers read
through it in `model.ts` (`db7cf046`); runtime row, 553 passing (`7e2adbd9`). Corpus census 0/0/0; score 2,423/2,438.
**#1 NEXT:** operator picks. Natural: **P3** of the same plan (single-line REFUSED openers become paragraph text); see the
tokenizer item in BACKLOG.md for the residuals. P3 is a separate session and needs its own §9.5 drift check.
**⚠ Gotchas:** (1) P2 shows NO gain on refused openers: the leaf says `refused` but `divSpecReading` answers null and the
legacy reader still hides the heading. (2) pandoc refuses every INDENTED `:::`. (3) `python3 quality_ratchet.py --run` at
close-out; never `git add -A`; `cd` moves the cwd (#535). (4) `dashboard_history.jsonl` is appended by every dashboard run.
## Session 280 Handoff Evaluation (by Session 281)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK was short and
true, and the candidate list for Phase 0 came straight from it plus `BACKLOG.md`.
**Helped:** gotcha (4) (`dashboard_history.jsonl` is left uncommitted) and the untracked-`scratchpad/` warning, both
true. **Missing:** the commit after its close-out (`ba6eb69e`, budget rows) again had no ledger entry, the second
session running; Phase 0 reconcile backfilled it (`d8b7c764`). **Not verified:** its "15 of 54 wrong at HEAD" figure;
I did not reopen `scratchpad/s280`. **ROI: high** (about ten minutes to a claimed task).

## Session 281 Self-Assessment

**Score: 7/10.**
**Went right.** I asked the operator about the plan's drift rule instead of waiving it, with evidence (anchors resolve,
zero hits on the five symbols). The leaf is checked against 804 live-pandoc rows per dialect and, separately, 24,000
fuzzed specs (0 kind/fallback disagreements). Two adversary workflows (~2,000 model documents against `quarto render`)
found 0 regressions. I re-rendered every layer-2 witness myself (via an agent) and it caught a wrong plan expectation.
**Went wrong.** (1) The leaf parser was written in ONE pass after its first nine RED rows, so the refusal, quote-fallback
and escape rows passed on arrival; I proved them load-bearing by mutation (11 of 14 killed, 3 equivalent) rather than by
RED. (2) Layer 2 was likewise one implementation for 33 RED rows, not one row at a time. (3) My first TAB-column row
assumed a refusal gain P2 does not have; a mutation run exposed it and I replaced it. (4) §9.5 step 6's identity control
and its timing were not run; the census ran parent-vs-tree only (0/0/0, 3,382 of 3,383 read, 0 threw).
**TDD:** RED shown for the first leaf group and for all 33 layer-2 rows before GREEN; the rest are pins, disclosed above.
**Cost:** two workflows, 5 agents, 0 errors, ~0.5M subagent tokens; one screen-taking integration run, approved just before.

## Session 279 Handoff Evaluation (by Session 280)

**Score: 8/10.** Self-check by the same model family, not an independent score. Its ACTIVE TASK was
accurate and short, and the Phase 0 candidate list could be built from it plus `BACKLOG.md` in minutes.
**Helped:** the gotchas (untracked `scratchpad/`, `cd` moves the cwd) were both true and both bit me once.
**Missing:** two commits after its close-out (the notes trim and the budget row) had no ledger entry, so
Phase 0 reconcile had to backfill them (`a5242893`); a trim is an action and needs its own entry.
**Not verified:** its note that the tabset-deletion and `maskQuotedValues` items are the deletion-direction
candidates; I did not open them. **ROI: high** (orientation to a claimed task took about fifteen minutes).

## Session 280 Self-Assessment

**Score: 7/10.**
**Went right.** I measured quarto before touching `src/` (54 probes) and wrote each rule clause RED first.
Two adversarial rounds with skeptic verification found 29 regressions in my first build; I reproduced the
first batch myself before trusting it, then rescored ALL prior probe directories with each new bundle. A
mutation pass shows every clause is load-bearing. The corpus check is byte-identical, not just a score.
**Went wrong.** (1) My comparator read heading anchor ids, which a quoted heading lacks, so I wrote a test
and a guard for the opposite of the truth; the adversary's text-based read exposed it. (2) The first
build's gate was the markdown FAMILY, not the `line_blocks` feature. (3) I reused the Session 224
closer-consumption premise where it is false. (4) The first pins were written after the rule and went GREEN
on arrival. (5) I did not run the integration suite (core-only change; no screen-taking run was authorised).
**TDD:** RED shown before GREEN for every behaviour test (two re-done after re-measurement); pins disclosed.
**Cost:** two workflows, 46 agents, 0 errors, ~2.6M subagent tokens, ~1,900 quarto renders.

## Session 278 Handoff Evaluation (by Session 279)

**Score: 9/10.** Self-check by the same model family, not an independent score. Its #1 named the
question, the five witness ordinals, the ground-truth path and its open caveat ("its age is the open
question"), so the measurement started at once. It also corrected its own stale "547/5" guidance.
**Wrong or missing:** it did not say the ground-truth driver uses `--no-execute`, which decides whether
"knitr failure" can mean an R failure; I read `render_keep.py` to learn that. It also did not say that
S265 rendered from snapshot text in a bare temp dir, which is why sibling files are missing.
**ROI: high.** Orientation to a measured first step took about ten minutes.

## Session 279 Self-Assessment

**Score: 8/10.**
**Went right.** I measured the whole population (942 rows) with the original driver, not just the five
named rows, so old and new exit codes compare one-to-one. I confirmed the five named rows by hand.
I diagnosed a spread sample of 79 rows for cause. I touched no `src/` and no corpus file, and rendered
only into scratch directories.
**Went wrong.** (1) The first ground-truth question was framed as "environment or document"; the answer
is "document" but my 79-row cause sample left 26 rows with no recognisable error line, so the cause of
those is UNCLASSIFIED. (2) I armed a throwaway placeholder monitor by mistake. (3) A `cd` into
`scratchpad/` moved the cwd (#535) twice.
**TDD:** exempt and stated -- no logic changed. **Cost:** no workflows, no subagents; ~1,020 renders.

---

## Session 277 Handoff Evaluation (by Session 278)

**Score: 7/10.** ⚠ **Written by the same model that wrote the handoff, so treat it as a self-check
rather than an independent score** — the protocol asks for it and I would rather flag the conflict
than skip the step.

**What helped.** Its gotcha (5) named the 5 integration failures as the x86 pandoc AND said they were
proved by hand in both directions, so when the operator fixed pandoc I knew exactly which count to
re-measure and what the old reading meant. Its `runtime_smoke` recorded the fixture, the error string
and the workaround, which is what made the root-cause diagnosis a five-minute job (`which -a`, `file`,
`pkgutil --pkgs`) instead of a hunt.

**What was wrong, and it cost this session's whole existence.** ⚠ **Its gotcha (5) wrote a MACHINE
STATE into a durable receipt as if it were a standing fact** — *"547 passing / 5 failing is the
expected reading"*. One `brew install` later that sentence is a trap: it tells the next session to read
five real failures as environmental. A receipt should record what was measured and WHEN, and point at
the item for the current state, rather than publishing an expected test count. ⚠ **And it repeated
#591's compound workaround without testing its levers** — PATH order alone was always sufficient, which
one render would have shown.

**ROI: high, but the defect it carried is the reason this session exists.**

## Session 278 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I diagnosed to the FILE, not the directory, and that is what kept the fix safe.** `which -a`,
  `file` and `pkgutil --pkgs` showed one unrunnable x86 binary from a 2023 `.pkg`. The tidy-looking
  fix — demoting `/usr/local/bin`, which `~/.zprofile` re-prepends after `brew shellenv` — would have
  silently switched `python3`, `npm`, `pip3` and `npx` too, because 9 names overlap with Homebrew.
  I checked the overlap BEFORE recommending anything.
- ⚠ **I tested the workaround's two levers separately and refuted half of the filed reasoning**: PATH
  order alone renders exit 0 with the broken binary still present, so only the `RSTUDIO_PANDOC`-alone
  claim had ever been refuted (#600).
- **I did not run the destructive command.** It needed `sudo`, so the operator ran it, with the exact
  file list named rather than a glob.
- **Every claim re-measured after the change, at the default PATH, cache deleted** — resolution,
  version, architecture, the fixture, both `.Rmd` probes, and one screen-taking integration run with
  the go-ahead taken before the launch.
- ⚠ **I did not rewrite history to make the record tidy.** #591, #599 and S277's receipt stay as
  written; the correction lives in the ACTIVE TASK, the S278 receipt and row #600, each naming the
  superseded claim. Editing an append-only record to hide a stale fact is how a ledger stops being
  evidence.

**What went wrong.**
- ⚠ **The stale guidance was mine, written an hour earlier.** The real failure is upstream of this
  session: I published a test count as an expectation in a durable receipt. #600 records the rule I
  should have followed.
- **I nearly treated this as a continuation of S277 rather than a new session.** It is a second
  deliverable and needed its own claim, stub and receipt; had I shaved that, the fix would have landed
  off the books (failure mode #17, and #27 for the ledger).
- **I have not measured the consequence I flagged as #1** — whether the corpus ground truth's knitr
  exit-1 rows are environment failures. It is correctly out of scope for a records session, but it
  means the standing measure now rests on ground truth of unestablished age.
- **TDD:** exempt and stated — no logic changed; `git diff` against S277's close-out is empty for
  `src/` and `test/`. Verification was the render matrix plus the real-host suite.
- **Growth:** `BACKLOG.md` −1 item (216 open), `PROJECT_LEARNINGS.md` +1 row (#600), no `src/`, no
  `test/`, no new docs. **Cost:** no workflows, no subagents; ~10 renders and one integration run.

**Against the bar.** S277 shipped a measured code change. This one shipped a measured ENVIRONMENT
change and, more importantly, corrected a trap its predecessor had put in the highest-authority file
the next session reads — which is the cheaper of the two kinds of work and the easier to skip.
