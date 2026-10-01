# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
### What Session 279 Did
**Deliverable:** Re-measure the corpus ground truth's knitr exit-1 rows (ordinals 970, 977, 978, 1275, 2114 among them) at the fixed pandoc (IN PROGRESS)
**Started:** 2026-09-30
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` -- the claim commit's entry says (in progress); Phase 3F records the rest.

*(Prior ACTIVE TASK, S278's, follows and is the live guidance until close-out.)*
**Task:** **NONE — Session 278 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S278 did:** recorded the ROOT-CAUSE fix of the x86-pandoc environment item — no code change,
`src/` and `test/` byte-identical to S277's close-out. The operator installed Homebrew's arm64 pandoc
3.11 and removed the shadowing 2023 Intel `.pkg` install. MEASURED after removal, at the DEFAULT PATH
with no workaround and no cache: `pandoc` resolves to `/opt/homebrew/bin/pandoc` (arm64, 3.11); the
knitr fixture renders exit 0; both `r5tilde` `.Rmd` probes render exit 0 and AGREE with the shipped
build; **`npm run test:integration` is 552 passing, 0 failing, exit 0** against S277's 547/5 on the
identical tree. The item is DELETED (216 open); learning #600 records it.
Commits: `5e2f1823` claim · `45ddaf63` records · `774f67c8` close-out.

**⚠ S277's receipt and learnings #591/#599 still describe the workaround and "547/5 expected".** They
are append-only history and were true when written — **this ACTIVE TASK and the S278 receipt are the
live guidance.** The workaround (a PATH strip plus `RSTUDIO_PANDOC`) is retired; do not reapply it.
**⚠ A FAILING INTEGRATION TEST IS NOW A REAL SIGNAL AGAIN.** 552/0 is the expected reading.

**⚠ #1 FOR THE NEXT SESSION, now UNBLOCKED and more urgent than before:** S276's open question —
whether the corpus ground truth's knitr exit-1 rows (ordinals 970, 977, 978, 1275, 2114 among them)
are ENVIRONMENT failures rather than document failures. If they are, the scored population (2,438 of
3,383) is understated and the standing measure's knitr rows cannot be trusted until re-rendered.
Five renders settle the first part; the ground truth lives in `scratchpad/s265/quarto_v2.tsv`.
⚠ Its age is the open question: it was built at Sessions 251/265, and whether that predates the
machine change is UNMEASURED — establish that before re-rendering anything.

**⚠ Gates:** `python3 quality_ratchet.py --run` at close-out; cite the head the RESULTS FILE records.
**⚠ No ledger hook is installed** (`git config core.hooksPath` is empty) — read `git show --stat
HEAD` after every commit; never build ledger text in an f-string (#584).
**⚠ Never `git add -A`**, **never `grep -r` from the repo root** (`scratchpad/` is untracked,
~85,000 files), **`$?` after a pipe is not a measurement** (#567), **`cd` moves the cwd** (#535).
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

## Session 275 Handoff Evaluation (by Session 276)

**Score: 9/10.** Its gotcha (1) is the reason this session shipped nothing wrong: *"run the
adversarial deletion hunt BEFORE the fix commit"* — I did, twice, and both passes found hundreds
of deletions that TDD, mutants and the corpus had all passed. One point off for framing the item
more narrowly than it is.

**What helped, specifically.**
- ⚠ **Gotcha (1), #581.** Without it the broad rule — 504 of 606 designed probes right, zero
  regressions on its own corpus, zero corpus movement — would have been committed. It broke 626.
- ⚠ **`whats_next` #1: "corpus reach NOT measured — measure it first".** Measured first: zero. That
  single fact reframed everything after it and is in every record this session wrote.
- **Gotcha (3), no ledger hook / no f-strings (#584).** Followed; every commit's `--stat` was read.
- **`key_files` and the R6 describe blocks** — accurate; the S275 row pinning HEAD's `[B, C]` was the
  first thing my change moved, and restoring it was exact.

**What was missing / wrong.**
- ⚠ **The item described a knitr witness, and the defect is general** — plain `.qmd`, markdown
  engine, bullets, ordered, tilde, footnote and definition bodies. Not wrong, but it undersold the
  item's size (it is a root cause, not one shape).
- **Nothing it stated as fact turned out false.** Its note that knitr renders exit 0 was true for
  S275; the machine changed since (#591), which no handoff could have known.

**ROI: very high.** Orientation to a measured first step took about thirty minutes.

## Session 276 Self-Assessment

**Score: 7/10.**

**What went right.**
- ⚠ **The adversarial pass ran BEFORE the commit, twice, and I obeyed what it said.** Round 1: 203
  skeptic-verified regressions; round 2 on the narrowed rule: 169. Shipping nothing was the correct
  outcome under the stop rule of the option the operator chose, and I did not argue with it.
- ⚠ **I measured reach first (zero) and every decision cites it** — including that zero reach hides
  regressions as well as gains (#589).
- ⚠ **The cross-scorer turned 3,105 cached renders into a seconds-long gate** (#587): it caught the
  quadratic guard (9 → 298 ms, fixed by memoizing), separated missing unit rows from unobservable
  mutants, and is left for the next attempt.
- **Strict TDD throughout both builds**, RED shown before GREEN, every test document byte-checked
  against the probe quarto rendered (provenance, #577). Build back at HEAD: compile exit 0,
  2991 tests.

**What went wrong.**
- ⚠ **I ported N1 into `src/` through six full TDD cycles BEFORE attacking it.** Round 2 could have
  run against the scratch bundle I already had; the port was then discarded. Hours of TDD spent on a
  rule the adversary had not yet seen (#592).
- ⚠ **Round 1's own families already showed the mechanism** (freed lines misread) that doomed N1; I
  narrowed the symptoms rather than stopping to ask whether the approach could converge (#588).
- **`cd` into `scratchpad/s276` moved the cwd twice** (#535, which I had read), and a
  `vitest --root /` check scanned the whole filesystem until I killed it.
- **The first adversarial script failed to parse** on a backtick in a template literal — S274's
  exact failure (#590).
- **Two claims in my own findings doc were written from memory** (an uncounted test figure, and my
  option text quoted as the operator's words); both caught and fixed before the commit.
- **Runtime:** no runtime surface changed (`src/` is at HEAD), so no Extension Development Host run
  was owed; the prepared real-host row was reverted with the rest. **Growth:** `src/` 0, `test/` 0,
  `docs/planning/` +116, `BACKLOG.md` net +2 items, `PROJECT_LEARNINGS.md` +7 rows (#586-#592).
  **Cost:** four workflow launches (one failed to parse), 26 agents, 0 errors, ~5.7M subagent
  tokens, ~4,000 rendered probes across all passes.

**Against the bar.** Sessions 273-275 each shipped a measured change. This one shipped a measured
DECISION not to, backed by two adversarial passes and a regression gate the next attempt can reuse —
worth less than a fix, and the port-before-attack cost it a point beyond S275's.
