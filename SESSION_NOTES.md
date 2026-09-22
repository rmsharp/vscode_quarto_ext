# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 277 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S277 did:** SHIPPED the fence PARAGRAPH-INTERRUPT rule at TOP LEVEL — only a column-0
BACKTICK fence interrupts an open paragraph; an opener at indent 1-3 or a `~~~` one is paragraph
text. Over **4,573 rendered probes**: 371 rows corrected (**255 deletions**) against 57 made worse,
every one a PRE-EXISTING misread losing its cover, each with an isolation control HEAD already
fails. Corpus NEUTRAL, proved byte-identical over all 3,383 documents (cells too).
**By-catch:** closes the S273 TILDE/knitr-header item (its own note predicted a pandoc-layer cause).
**RECORD decision (7)** — the 2nd departure from Posit, operator's call, observed not inferred.
Commits: `a148be2b` claim · `2863dbde` fix · `1effdbef` records.

**⚠ The four narrowings all came from the adversary, and two were DELETIONS** — read
`PROJECT_LEARNINGS.md` #593-#599 before the next fence item. A REFUSAL FREES LINES (#586) and the
freed line needs the SAME rule applied to it (#594); put a new refusal where the old one lives (#595).
**⚠ The gate for any heading change is now `scratchpad/s277/gate/crossall2.py`** — multi-root, scores
every cached render under s276+s277 (4,638 unique) against HEAD and N candidates in seconds.
**⚠ Measure a candidate on the WHOLE probe population, never on the lens that designed it** (#593):
the per-lens tally inverted the ranking of three variants.
**⚠ 5 integration tests FAIL on this machine and it is ENVIRONMENTAL** (x86 pandoc, #591/#599):
547 passing / 5 failing is the expected reading; proved by hand in both directions. Not a regression.

**⚠ Gates:** `python3 quality_ratchet.py --run` at close-out; cite the head the RESULTS FILE records.
**⚠ No ledger hook is installed** (`git config core.hooksPath` is empty) — read `git show --stat
HEAD` after every commit; never build ledger text in an f-string (#584).
**⚠ Never `git add -A`**, **never `grep -r` from the repo root** (`scratchpad/` is untracked,
~85,000 files), **`$?` after a pipe is not a measurement** (#567), **`cd` moves the cwd** (#535).
---

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

## Session 274 Handoff Evaluation (by Session 275)

**Score: 9/10.** Its `whats_next` #2 was the exact instruction this session needed, and every fact it
stated held when I re-measured it. One point off for a defect in its own durable record that its
close-out did not catch.

**What helped, specifically.**
- ⚠ **"Measure its ground truth FIRST — R IS installed."** That line is why the first thing I did was a
  real-execution render, and the answer was not the one anyone expected: the document does not
  render with execution at all (a data file is missing). Without the warning I would have designed
  against the `--no-execute` answer alone and never known the two conventions could disagree.
- ⚠ **"It may NOT share R5's mechanism."** Correct, and it saved a wrong start. R5 is about which
  chunks knitr CLAIMS; R6 is about which closers knitr CONSUMES — a different stage of the pipeline.
- **"The LAST fixable divergence the score can see."** Measured true: after R6 the 15 divergent
  ordinals are exactly the decided and unmodelable ones.
- **Gotchas (1), (2), (7), (8), (10)** — all used, all accurate. (2) generalised well: I extracted the
  refuters' probe bytes from their own files rather than retyping them, and caught a trailing-newline
  difference that way.

**What was missing / wrong.**
- ⚠ **Its own claim commit inserted the S274 receipt INSIDE the `HANDOFFS.md` header sentence**
  (it matched the first `` ```handoff `` in the file, which is prose), and the close-out never noticed.
  Phase 0 found it and the claim commit repaired it. This is the one point off.
- **It did not say that no ledger hook is installed in this clone.** Not a fault of the handoff as
  such, but it would have prevented this session's one unrecorded commit.
- **Nothing it stated as fact turned out false.**

**ROI: very high.** Orientation to a measured first step took about twenty minutes.

## Session 275 Self-Assessment

**Score: 7/10.**

**What went right.**
- ⚠ **I measured the ground truth under real execution before designing**, found the document cannot
  run as it sits, and took a what-if render rather than stopping there. The divergence is real under
  both conventions, which is what licensed a fix at all.
- ⚠ **I aimed a 31-agent adversarial pass at my OWN committed fix** — and it found ten real deletions.
  Every one was re-rendered firsthand before I acted, and the rule was narrowed until all ten failed
  to reproduce, with the corpus result unchanged (#581, #582).
- **Strict TDD throughout:** 10 behaviour rows, each shown RED for the right reason before its code;
  every expectation a measured render of the test's exact bytes, in both execution modes.
- **Mutation-tested my own guards:** 12 of 12 mutants of the final rule are killed. The first pass
  found one guard vacuous and one rule unpinned; both were fixed rather than explained away (#585).
- **Phase 3E discharged properly:** a real-host row asserting the new behaviour, then ONE
  `test:integration` run with the go-ahead taken before launch — 551 passing, exit 0.

**What went wrong.**
- ⚠ **I committed a rule that deletes headings.** `b1f054ac` passed TDD, three mutants and the corpus,
  and I treated that as enough to commit. The research critic had already warned that silence must
  be positively established; I wrote that sentence into the docstring and did not make the code
  honour it. The adversarial pass should have run BEFORE the first fix commit, not after (#581).
- ⚠ **One commit landed without its ledger entry.** A Python f-string choked on `{dot|mermaid…}`;
  no hook is installed, so nothing refused it. I caught it from `git show --stat` and amended before
  anything was pushed (#584).
- **My first test comments overclaimed** ("every row exit 0, both modes agreeing" — false for two
  rows) and one guard was vacuous. The refuters caught both; corrected in `d5997bf4`.
- **I timed a cached function and got 0.0 ms on three builds** before I saw why (#583). I also wrote
  two logs to `/tmp` instead of the session scratchpad once — deleted, but a slip.
- **Runtime:** `test:integration` 551 passing, exit 0, VS Code 1.129.0. One unhandled rejection was
  logged in the debounced-diagnostics suite — unrelated code, every test green, NOT verified
  pre-existing (needs a second screen run). **Growth:** `src/` +219/−3, `test/unit` +312,
  `test/integration` +44, `PROJECT_LEARNINGS.md` +5 rows (#581–#585), `BACKLOG.md` net +2 items.
  **Cost:** two workflows, 36 agents, 0 errors, ~3.34M subagent tokens, 757 subagent tool uses, plus
  ~125 quarto renders of my own.

**Against the bar.** Sessions 272–274 each shipped one measured change or decision. This one shipped
a measured fix that closes the last fixable divergence the score can see — but its first cut was
worse than the defect it fixed in shapes nobody has written yet, and it took an adversary to show it.
