# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE -- Session 280 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S280 did:** fixed the line-block fence deletion (`ba238160`): `lineBlockContinuationRefuses` +
`fromHasLineBlocks` in `src/core/qmd/model.ts`. Matrix 15 of 54 wrong at HEAD -> 1; corpus neutral
(2,423/2,438, outputs byte-identical). Two adversarial rounds (46 agents) confirmed 29 regressions in the
FIRST build; all fixed or recorded. 17 unit rows; every clause mutation-killed. No integration run.
**#1 NEXT:** operator picks; see BACKLOG.md "Up Next". Residuals: the item "Five shapes ... leaves at HEAD".
**⚠ Gotchas:** (1) compare heading TEXT, never anchor ids (quote headings have none): `scratchpad/s280/m/score3.js`.
(2) `scratchpad/s280/m/runlens.sh <dir>` renders + scores HEAD vs NEW; its bundles are static copies.
(3) `python3 quality_ratchet.py --run` at close-out. Never `git add -A`; `cd` moves the cwd (#535).
(4) `dashboard_history.jsonl` is appended by every dashboard run and left uncommitted by this session.
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

## Session 276 Handoff Evaluation (by Session 277)

**Score: 9/10.** Its three gotchas set this session's method before I wrote a line of code, and every
fact it stated held when I re-measured it. One point off for understating the size of the item it
recommended.

**What helped, specifically.**
- ⚠ **`whats_next` #1 named the item, its witnesses AND the first move**: *"probes rendered, corpus
  reach NOT measured: measure it first"*. I measured it first — zero, and the same zero the previous
  session found — which is what let the trade be argued on probes with the corpus as a safety proof
  rather than as evidence.
- ⚠ **Gotcha (1), #586 "A REFUSAL FREES LINES".** The single highest-value line it wrote. It predicted
  the entire 57-row cost of this change *and* the two cascades that made my first build delete
  headings. I built an adversarial lens around it from the start instead of discovering it late.
- ⚠ **Gotcha (2), #592 "ATTACK THE SCRATCH BUNDLE BEFORE THE TDD PORT".** Obeyed exactly: three
  variants built as scratch bundles and scored over 3,452 probes BEFORE any `src/` edit. That is why
  the top-level choice was measurable and why the port needed one attempt, not three.
- **`key_files` — the harness.** `probe.py`, `bundle.sh` and `crossall.py` were reused unmodified
  (the last generalised to multi-root). A session that had to build that instrument could not have
  reached 4,573 rendered probes.
- **Gotchas (4), (6), (7)** — all accurate and all needed: the knitr PATH workaround twice, `cd`
  twice (it warned me and I still did it), and `$?`-after-a-pipe once, caught because of the warning.

**What was missing / wrong.**
- ⚠ **It framed prerequisite (a) as one rule; it is four** (fence character, indent, reader, container)
  plus two cascade obligations (the freed line, the consumed closer). Not wrong — understated, and the
  understatement is what made "one narrow rule" look cheaper than it was.
- **It did not know (a) had a BY-CATCH**: closing it closes the S273 tilde item, whose own note had
  predicted the pandoc-layer cause. No handoff could have known, but it means the item was worth more
  than its entry claimed.
- **Its gate was single-root.** `crossall.py` walks `scratchpad/s276` only, so a session that renders
  new probes silently scores on a stale population. A one-line generalisation, but it had to be found.
- **Nothing it stated as fact turned out false.** Its #3 (re-measure the knitr exit-1 ground-truth
  rows) is untouched and stays open — not this session's item.

**ROI: very high.** Orientation to a measured first step took about twenty-five minutes.

## Session 277 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **The adversary ran BEFORE the commit and I obeyed all of it.** 65 agents, 5 hunting lenses, 60
  skeptic verifications. Four of its findings became narrowings — the lazy block-quote line, the
  knitr-claimed chunk, the consumed closer, the aliased reader — and **two of those were DELETIONS**
  my own probes had not found. 45 of its 96 claimed regressions are retired by the shipped build; the
  42 that remain are the two lenses that said SHIP.
- ⚠ **I measured on the whole population, not on the lens that designed the probes (#593).** The
  freed-line lens ranked top-level-only WORST on its own 126 probes; over 3,452 it was best by an
  order of magnitude (10 bad rows against 142 and 110). Building the multi-root cross-scorer first is
  the reason that was visible at all.
- ⚠ **Every family I disclosed, I controlled myself.** Raw-TeX, raw-HTML, unclosed comment,
  format-gated div, mid-YAML: isolation control rendered, HEAD fails identically. And the converse —
  the reader-alias rows were shown NOT pre-existing (`iso2/i04` agrees at HEAD), which is why they got
  fixed instead of disclosed.
- ⚠ **Both oracles settled properly.** `observe:posit` with the operator's go-ahead taken BEFORE the
  launch, every probe pre-rendered and proved byte-identical to the harness's bytes, two deciding rows
  and two controls — and the operator, not I, chose `quarto render` (decision (7)).
- **Runtime discharged, and its failures proved environmental by hand in both directions** (#599):
  547 passing, my new row passing at 44 ms, 5 failing — all five the x86 pandoc, shown by rendering
  the fixture at the default PATH and again with the workaround.
- **Corpus neutrality PROVED, not asserted:** `model.tsv`/`rawadj.tsv` byte-identical over 3,383
  documents, `findAllCells` byte-identical (21,340 cells), score 2423/2438 with identical ordinals.

**What went wrong.**
- ⚠ **Cycle 1 implemented four clauses at once, so cycle 2 would have gone GREEN with no RED.** I
  repaired the process by reverting the character clause to show RED first, and every later clause got
  its own honest RED — but the first cycle was not one behaviour, and that is the TDD gate's whole point.
- ⚠ **I patched `src/` to test a hypothesis and the experiment refuted it** (a tilde refusal consuming
  its closer). That is #592 at small scale: it should have been a scratch bundle. One patch/revert cycle.
- **My first guard row asserted hand-written bytes instead of the measured probe's**, failed, and had
  to be rewritten against the probe's exact bytes and engine — #573's lesson, self-inflicted.
- **I launched the adversary against a bundle that then moved.** Its skeptics verified the
  pre-narrowing build, so all 96 claims needed re-mapping against the final one. Cheap only because
  the cross-scorer already covered their probes; the right order was to narrow, then attack.
- **`cd` moved the cwd twice** (#535, which the handoff warned me about), and `$?` after a pipe
  printed a wrong exit code once (#567).
- **Growth:** `src/` +169/−7, `test/unit` +275, `test/integration` +45, `test/posit` +24,
  `BACKLOG.md` net +5 items (one completed item removed), `PROJECT_LEARNINGS.md` +7 rows (#593-#599),
  no new tracked docs. **Cost:** two workflows, 70 agents, 0 errors, ~6.03M subagent tokens, ~1,351
  subagent tool uses, plus ~200 quarto renders of my own.

**Against the bar.** Sessions 273-275 each shipped a measured change; 276 shipped a measured decision
not to. This one shipped a measured change *with* the largest verified probe population the project
has used, and priced it honestly: 255 deletions corrected, 57 pre-existing misreads made visible, and
every one of the 57 controlled rather than argued away.
