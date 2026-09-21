# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
### What Session 276 Did
**Deliverable:** the list-item / backtick-info fence defect (IN PROGRESS) — BACKLOG *"A bare fence
inside a list item, and a backtick fence whose info string holds a backtick, are fences to this
model and not to pandoc"*. Deletion direction, PRE-EXISTING, corpus reach NOT yet measured.
**Plan:** measure reach over the corpus + ground truth with `quarto render` FIRST; then strict TDD;
adversarial deletion hunt BEFORE the fix commit (#581); realdoc score after (CLAUDE.md).
**Started:** 2026-09-21
**Status:** Session claimed. Work beginning. Operator picked it at Phase 0 (recommended option).
**Ledger:** `CHANGELOG: pending` — the claim commit's `CHANGELOG.md` entry says (in progress);
Phase 3F records the rest. Until close-out, this line is the crash breadcrumb.

**⚠ Gates:** `python3 quality_ratchet.py --run` at close-out; cite the head the RESULTS FILE records.
**⚠ No ledger hook is installed** (`git config core.hooksPath` is empty) — read `git show --stat
HEAD` after every commit; an f-string ate one `CHANGELOG.md` entry this session (#584).
**⚠ Never `git add -A`**, **never `grep -r` from the repo root** (`scratchpad/` is untracked,
~85,000 files), **`$?` after a pipe is not a measurement** (#567), **`cd` moves the cwd** (#535).
---

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


## Session 272 Handoff Evaluation (by Session 273)

**Score: 9/10.** Its recommendation was right and it was RIGHT ABOUT ITS OWN UNRELIABILITY — the one
sentence that shaped this session most was its warning that its own line numbers were stale. Every
number it stated as measured held when I re-measured it. One point off because the item it
recommended carried a factual error it passed on without flagging.

**What helped, specifically.**
- ⚠ **`whats_next` #1 labelled its own fix sites an ESTIMATE and told me to re-derive them.** They
  were all stale — `:6024` now lands on `endLine: number;`, `:7315`/`:7347` inside a docstring. A
  handoff that says "this part of me has probably rotted" is worth more than one that is quietly
  wrong, and it cost me nothing because it said so.
- ⚠ **Gotcha (3), #569 — check which probe rows DISCRIMINATE before spending the screen.** I labelled
  each of the six R5 probes DECIDING or CORROBORATING in its own `why:` before the launch. Three
  decided; the corroborating ones are what let me say a "no heading" answer would have been about
  the option tail rather than the engine name.
- ⚠ **Gotcha (7), screen runs need the go-ahead BEFORE launch, VS Code 1.129.0 pinned.** Consent was
  taken before all three launches, the pin was already in the file, and nothing cost a wasted run.
- **#552, #535, `git add -A`, the ordinal rule, and the one-entry-per-commit ledger rule** — all
  used, all accurate. #567 caught me in the act at Phase 0 and I re-measured.

**What was missing / wrong.**
- ⚠ **It repeated the backlog's trigger for R5 without checking it, and the trigger is wrong.**
  "Both knitr chunk-grammar … `{fortran95, eval = FALSE}`" carries the item's "digit-bearing engine
  with spaced options" framing. Measured: `{glue_sql, connection = con}` has no digit and fires;
  `{cpp11,eval=FALSE}` has a digit and does not. Same class of defect its own S271 evaluation
  criticised — a handoff that quotes an item inherits the item's errors.
- ⚠ **It ranked R5 and R6 together as one pick, "1 document and 1 heading each".** They are not
  comparable work: R6's ground truth was never measured under real execution, and R5's fix needed
  engine plumbing R6 does not obviously share. Taking them as one unit would have been FM #26.
- **It could not have known the fix needs the model to learn the document engine at all** — nothing
  in the record pointed there, and the root cause is a missing PIPELINE STAGE, not a wrong regex.
  Not a fault; recorded so the next session does not read its silence as evidence.

## Session 273 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I fixed the root cause, not the symptom, and the docstring proves I looked.** The naive fix is
  to widen `CELL_INFO` to accept digits; its docstring forbids that with measured render rows, and a
  refuter measured the price of ignoring it (5 unit tests red, 6 oracle rows moved, 4 corpus
  documents gaining cells — the cardinal-sin direction — for the identical +1). The real cause is
  that `computeRegions` modelled quarto's pipeline as `readqmd → pandoc` and a knitr document has a
  stage before both. `quarto pandoc -f markdown -t html` reproduces the model's answer exactly on the
  repro, which is the proof the pandoc layer was never at fault.
- ⚠ **The adversarial pass found two defects in a design that had already been built and
  corpus-measured by its author, and I re-measured both before acting** (#574). One was fatal to the
  regex — knitr's own grammar over-fires because pandoc refuses a class that does not start with a
  letter. ⚠ **My first attempt to reproduce that refutation FAILED and said "all 7 accepted"**; my
  probe lacked the trailing fence so the heading survived either way, and I was grepping for the
  consequence instead of the thing under test (#573). Reading one raw HTML output settled it.
- ⚠ **I caught my own Phase 3E gap instead of banking the green.** The first `test:integration` was
  549 passing, exit 0 — the baseline count — on a change that is mostly wiring. That proves no
  regression and cannot prove the engine reaches the model, and the unit suite cannot either since it
  passes the engine in directly. One adapter-level test took it to 550 and turned it into a real
  gate (#576). An unchanged test count on a wiring change is the tell, not the reassurance.
- ⚠ **The observation's BY-CATCH is worth more than its confirmation** (#575). Six probes, one
  launch, four answers: R5 confirmed against both oracles, the first measured quarto/Posit
  disagreement filed as an open decision, and the tilde divergence promoted to a plain defect.
- **Strict TDD:** ONE failing test first, shown failing for the right reason (`expected [] to
  deeply equal [ 'After Chunk' ]`) before any `src/` edit. Every guard expectation was measured
  against real `quarto render` with real knitr execution BEFORE it was written.
- **"Nothing else moved" is proved, not asserted:** 1 of 3,383 documents changed, 0 headings lost,
  `test:oracle` byte-identical to its standing S180-onward figure, and the pre-fix control run.

**What went wrong.**
- ⚠ **I spent a SECOND `test:integration` launch on a gap I should have seen before the first.**
  The deliverable was a wiring change from the moment the design landed; that the suite could not
  observe it was knowable without running anything. The operator granted the screen twice and the
  second was avoidable by thirty seconds of thought — S270's exact lesson, which I had read.
- ⚠ **My first pandoc probe was wrong and I nearly published its answer** (#573). It contradicted a
  refuter's measurement and I would have been entitled to believe myself.
- ⚠ **My own test comment inflated the count it cited.** I wrote "47 `assert.deepStrictEqual`" into
  a comment that itself contains that identifier, so the grep it tells the next session to run
  returns a different number. Corrected in place to the code-line count, with the trap named.
- **I wrote a self-referential fence bug into the first guard test** — the helper ignored its second
  argument, so the tilde row silently ran the backtick shape. The test failed and caught it, which
  is the system working, but it was my error.
- **TDD:** honoured for the behaviour that drove the code. The 7 guards and the integration test are
  measured pins on shapes the change bounds, added after GREEN and labelled as such.
  **Runtime:** `npm run test:integration` in a real Extension Development Host with the operator's
  go-ahead — **550 passing, exit 0**, including the new adapter-level R5 row. `npm run
  observe:posit` likewise — **9 passing, exit 0**, `ours-loaded: false`, both controls green.
  **Growth:** `src/` +~90 lines (mostly the measured docstring), `test/unit` +~135, `test/posit/`
  net −40, `test/integration` +60, `PROJECT_LEARNINGS.md` +5 rows, `BACKLOG.md` net +1 item.
  **Cost:** two workflows, 17 agents, 0 errors, ~2.03M subagent tokens, ~700 tool calls, plus ~60
  quarto renders of my own.

**Against the bar.** Sessions 270 and 271 shipped measured decisions; 272 shipped a measured fix.
This one shipped a fix whose verdict was itself measured against both oracles rather than assumed —
and the part worth repeating is that the two things that most improved it, the regex narrowing and
the Phase 3E gap, were both caught by attacking my own work after it already looked finished.
