# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 277 IN PROGRESS** — the fence PARAGRAPH-INTERRUPT prerequisite, item (a) of
`BACKLOG.md` *"Pre-existing fence-grammar defects measured by Session 276's research"*, picked by
the operator from a ranked `AskUserQuestion` at Phase 0.
**The defect:** under pandoc markdown only a COLUMN-0 BACKTICK fence WITH a closer interrupts an
open paragraph; this model's `fenceColumns = [0]` also opens an indent-1-3 or a `~~~` one and
DELETES the heading below (witnesses `containers-readers/pi01`-`pi04`, `backtick-info/m/m83`).
**Status:** claimed. Corpus reach is NOT measured yet — measure it FIRST, before any rule.

**⚠ READ `docs/planning/2026-09-22-fence-bound-adversarial-findings.md` BEFORE ANY FENCE WORK.** It
holds S276's derived rule, both refuted candidates and the four prerequisites a retry needs first.
**⚠ ATTACK A SCRATCH BUNDLE BEFORE THE TDD PORT** (#592), and remember a REFUSAL FREES LINES
(#586): any rule that stops a fence HEAD pairs exposes the lines below to older misreads.
**⚠ Gate for any rule:** `python3 scratchpad/s276/harness/crossall.py <build.cjs>` scores all 3,105
cached renders against HEAD in seconds; it must print 0 REGRESSIONS (#587). Bundle with `bundle.sh`.
**⚠ knitr renders exit 1 through the default PATH** (x86 `/usr/local/bin/pandoc`, #591, filed).

**⚠ Gates:** `python3 quality_ratchet.py --run` at close-out; cite the head the RESULTS FILE records.
**⚠ No ledger hook is installed** (`git config core.hooksPath` is empty) — read `git show --stat
HEAD` after every commit; never build ledger text in an f-string (#584).
**⚠ Never `git add -A`**, **never `grep -r` from the repo root** (`scratchpad/` is untracked,
~85,000 files), **`$?` after a pipe is not a measurement** (#567), **`cd` moves the cwd** (#535).
---

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

## Session 273 Handoff Evaluation (by Session 274)

**Score: 9/10.** Its `whats_next` #1 put a DECISION first and labelled it the operator's to make,
which is exactly what let this session close it in one move. Every number it stated as measured held
when I re-measured it — including under adversarial pressure from an agent that said otherwise. One
point off because it framed the decision as having no cheap path to resolution, and there was one.

**What helped, specifically.**
- ⚠ **It named the three probes and their measured `<h4>` counts, so its claim was FALSIFIABLE.**
  When a search agent contradicted the record, I did not have to re-derive anything — I re-ran
  `r02`/`r03`/`r05` and got 0/0/0 exactly. A handoff whose numbers are re-runnable is worth more
  than one that argues well, and this one survived a deliberate attempt to break it.
- ⚠ **Gotcha (2), #573 — "grep for the thing under test, not its consequence".** This is the single
  highest-value line it wrote. A Session 274 agent committed that precise error — a probe with no
  trailing bare fence — and having #573 resident is why I suspected the probe within one experiment
  instead of believing a plausible refutation of a measured record.
- ⚠ **It stated the COST of the road not taken and labelled it UNMEASURED.** "Mirroring Posit would
  be a widening in the phantom-vs-quarto direction and its reach is UNMEASURED." That sentence went
  into the decision record verbatim in substance, as the honest price of the alternative.
- **Gotcha (4), "the backlog's own trigger can be wrong and its line numbers rot."** Acting on it, I
  found `docs/REAL-DOCUMENT-RESCORE.md` still carrying R5's falsified trigger and corrected it.
- **#552, #535, `git add -A`, the ordinal rule, the one-entry-per-commit ledger rule** — all used,
  all accurate. Its gate citation (manifest `8845021a4049`, head `089aa978`, 2/2) matched the
  results file exactly, and its build figures (66 files / 2971, 209 open items) reproduced.

**What was missing / wrong.**
- ⚠ **It presented (6) as an operator coin-flip plus an expensive measurement, and never suggested
  looking UPSTREAM.** The answer was free and public: an open issue filed by the maintainer of the
  very product it was treating as the oracle, stating that the Outline should follow the render.
  That is the same class of gap S273 itself criticised in S272 — carrying an expensive framing
  forward without asking the cheap disqualifying question first. This is the one point off.
- ⚠ **Its gotcha (2) is written as SELF-discipline, but the failure mode it describes is how a
  SUB-AGENT gets a shape wrong.** Framed as "what I did", it reads as a confession; framed as "the
  discriminator for did-the-fence-open is `<pre>`, and a uniform answer across a discriminating
  matrix means the probe is broken", it is a spec for validating anyone's probe. Minor, but the
  broader framing is what actually caught the agent.
- **Nothing it stated as a fact turned out false**, including under a direct challenge.

**ROI: very high.** Orientation to a decidable question took about twenty minutes, and its #1 was
actionable with no re-derivation of the ranking.

## Session 274 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I neither accepted nor dismissed the agent that contradicted the record — I adjudicated it
  with the record's own bytes** (#577). The probes were extracted from the compiled
  `out/test/posit/runTest.js` rather than retyped, which is what makes it a replication instead of
  a new experiment. Then a 2×2 isolated the actual lever (the trailing bare fence, not the blank
  line), so the record now says something S273's did not: *what controls the swallow*.
- ⚠ **I read the raw HTML instead of grepping for the consequence** — `#### Charlie After Chunk`
  sits inside `<pre><code>`, and the output carries `{.2x .cell-code}`, which shows knitr claimed
  the chunk and pandoc refused the class. That is #573 applied, not merely cited.
- ⚠ **The search's BY-CATCH decided the question.** I launched it to answer "has this been filed?"
  and it returned something better than a duplicate — the upstream maintainers' stated position
  (#578). Recognising that the by-catch outranked the deliverable is the move worth repeating.
- ⚠ **I caught that `CLAUDE.md`'s own norm contradicted the decision, and that its count was
  stale** — it claimed two such decisions where six exist. A decision recorded against a norm nobody
  updated is a decision the next session reverses on sight.
- **I verified every cited cross-reference before committing**, re-confirming both upstream issues
  still OPEN rather than trusting the agents, and replaced by hand the one verify agent lost to an
  API error (`quarto#488` — unrelated). **7 of 7 candidates refuted**, none quietly dropped.
- **I did NOT file upstream and did not treat a clean duplicate-search as authorization to** (#580).

**What went wrong.**
- ⚠ **I ran `grep -rn` from the repo root at Phase 0** and traversed the ~85,000-file untracked
  `scratchpad/`, producing a 64 MB truncated result. I had read the `git add -A` warning and
  generalised it to STAGING but not to SEARCHING. `git grep` is the tool and I used it thereafter.
  The gotcha is now written for both operations.
- ⚠ **My first workflow script failed to parse** — a literal triple-backtick inside a JS template
  literal. One wasted round-trip; the authoring reference warns about exactly this.
- ⚠ **My `AskUserQuestion` bundled two choices into one option.** The selected option named both the
  deliverable *and* the direction of the decision. The operator picked it and I stated that reading
  back before acting, so nothing was assumed silently — but a low-reversibility record deserved
  "which item?" and "which way?" as separate questions.
- **TDD:** exempt and stated — no `src/` logic changed; `CLAUDE.md`'s gate exempts declarative/doc
  edits with no logic while still requiring normal verification, which ran. **Runtime:** no Extension
  Development Host launch, and that is correct rather than skipped — no runtime surface changed, and
  such runs take the operator's screen. The mechanical half ran: `quality_ratchet` **2/2 pass** at
  head `ab4f8855` (the head the results file records), `npm test` **66 files / 2971 passed** and
  `tools/realdoc-score/run.sh s274-close` **2438 / agree 2422 / divergent 16** with byte-identical
  ordinal lists — both unchanged, which for a records-only change is the proof, not a gap (#579).
  **Growth:** `BACKLOG.md` +14/−6, `CLAUDE.md` +14/−3, `docs/` +18, `test/` +33/−11, no `src/`,
  `PROJECT_LEARNINGS.md` +4 rows (#577–#580). **Cost:** one workflow, 15 agents, 1 agent error,
  ~975k subagent tokens, 206 tool calls, plus ~10 quarto renders of my own.

**Against the bar.** Sessions 270 and 271 built the instrument and decided with it; 272 shipped a
change; 273 shipped a fix and surfaced this question. This session decided a question the previous
four could not — and the part worth repeating is that what made it decidable was not in the
repository at all, and was found by a search launched to answer a different question.
