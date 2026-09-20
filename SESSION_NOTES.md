# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 271 IN PROGRESS — (b), R2 of the Up Next head item: a `---` pair around a knitr
chunk that emits nothing becomes valid YAML after knitr runs**, swallowing the heading between them.
The model reads the PRE-knitr fence, refuses the block (`FENCE_ANYWHERE_IN_BLOCK`) and reports the
heading. **2 authored documents (ordinals 2147, 2275), 8 PHANTOM headings** — the last phantom pair.
**Started:** 2026-09-20. Operator-picked at Phase 0 by `AskUserQuestion` from four ranked options
(R2 recommended; the others were probes for the two RECORD decisions that still rest on a bundle
grep, R5+R6, and a catch-all).
**Status:** Session claimed. Work beginning — no code touched yet.
**Ledger:** `CHANGELOG: pending` — the claim commit's entry says (in progress); Phase 3F records the
rest. Until close-out, this line is the crash breadcrumb for the next session's reconcile.
**⚠ ORACLE FIRST, CODE SECOND** — the S270 handoff's #2, and the reason R3 shipped nothing. Posit's
Outline is the product oracle where it and `quarto render` disagree (`CLAUDE.md` §Clean-room
boundary); `npm run observe:posit` settles it in one run. Ask it BEFORE building anything.
**⚠ Its constraint:** the ported region grammar feeds the validation partitioner
(`core/yaml-value-flags.ts`), so any change there needs its own `npm run test:oracle` run.
**⚠ `R` IS installed here** (`/usr/local/bin/R`), so R2's real-execution half — which the re-score
recorded as "measured by the diagnosing agent, not re-verified" — is measurable this session.
**⚠ Gates:** close-out runs `python3 quality_ratchet.py --run`; cite the head the RESULTS FILE
records. One `CHANGELOG.md` entry per commit. `tools/realdoc-score/run.sh <label>` after any change
reaching `findHeadings`, plus a document-by-document diff of the two model bundles.
**⚠ Screen-taking runs need the operator's go-ahead BEFORE launch** — `observe:posit`,
`test:integration`, `test:lsp`. Pin VS Code `1.129.0` and write mocha **bdd** (#558).
**⚠ Write a number only after measuring it** (#552). **⚠ `cd` moves the session cwd** (#535).
**⚠ Never `git add -A`** — `scratchpad/` is untracked, NOT ignored.

---

## Session 269 Handoff Evaluation (by Session 270)

**Score: 8/10.** The task was pickable in under twenty minutes, its DONE criterion was set before
any measurement, and nothing it stated as a fact turned out false. Two points off for a framing it
inherited without checking and a question it never raised.

**What helped, specifically.**
- ⚠ **`whats_next` #1 named (c), R3, with its cost, its fix sites AND the word ESTIMATE on both.**
  That is the shape a recommendation should have: actionable, and honest about which parts are guesses.
- ⚠ **"DONE for any heading fix includes a `run.sh` line in the receipt AND a document-by-document
  diff of the two model bundles."** I measured the baseline before touching anything because of that
  sentence, and the diff is what let this session prove "nothing changed" byte-identically instead of
  asserting it.
- ⚠ **The instrument trap (#554).** I grepped raw HTML for `<h[1-6]` on every probe whose heading
  line could open a swallowing element, and so did the 42 agents, because the warning was explicit
  about WHY the extractor is blind rather than just saying "be careful".
- **#555 one-name-per-document, #552 measure-then-write, the gate-citation rule and `git add -A`** —
  all used, all accurate. The gate citation caught me: the results file records `a55d90e1`, and I
  read it rather than assuming.

**What was missing / wrong.**
- ⚠ **It recommended R3 as a FIX and never asked which oracle governs it.** `CLAUDE.md`'s clean-room
  boundary — written three sessions earlier, by the session that made exactly this kind of call — says
  a quarto/Posit disagreement is a decision, not a defect. R3 turned out to be one, and the answer was
  "ship nothing". A single line ("check the oracle before building") would have reordered this whole
  session. It is the same class of omission as recommending a fix site without checking it.
- ⚠ **It repeated the audit's account of R3's mechanism, which is measurably wrong** ("a row wider
  than its border fuses `Head` / `====`"). One character wider is the single width that does NOT fire.
  Not originally its error, but a handoff that quotes an audit inherits the audit's defects.
- **Nothing it stated as a fact turned out false**, and its fix-site estimate (`:4531`–`:4586`) does
  land on the grid-table region — `GRID_TABLE_BORDER` is at `:4585`.

**ROI: high.** Orientation to the first measured baseline was about fifteen minutes, and its DONE
criterion is the reason this session has a proof rather than a claim.

## Session 270 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **The audit's own reproduction failed to reproduce, and I treated that as the finding rather
  than as my own typo.** Typing out F2's R3 repro gave no heading; six further mis-alignment
  spellings gave none either. Chasing that produced the corrected mechanism (two or more characters,
  not one; the last non-whitespace character, not the closing pipe) and a **second trigger the audit
  never mentions** — a `+===+` divider truncated at a column boundary.
- ⚠ **I built the observation the project had required for three sessions and never had.**
  `CLAUDE.md` has said since S267 that "what does Posit do?" is settled black-box; two sessions
  grepped the bundle anyway and both said afterwards it was wrong. `npm run observe:posit` answered
  it in one run, and its two design constraints are the load-bearing part: the symbol command MERGES
  providers, so ours must not load (`ours-loaded: false` is printed every run), and the control is
  the only assertion, because "no symbols" and "no provider" are otherwise the same output.
- ⚠ **I asked at both real decision points instead of deciding.** Which oracle governs R3 was not
  mine to settle, and neither was taking the screen — the go-ahead came before the launch, not after.
- **I verified the agents rather than believing them.** M1's surprising indent cliff, the corpus
  counts, the two ordinals that exit 1 — all re-measured firsthand. The adversarial pass corrected
  **9 of 37** verified claims, including one that would have put a wrong causal rule in the record.
- **"Nothing changed" is proved, not asserted:** `model.tsv` and `model.cjs` are byte-identical
  between the baseline and final runs across all 3,383 corpus documents.

**What went wrong.**
- ⚠ **I spent the operator's screen twice on one observation, and both failures were preventable.**
  First I left `@vscode/test-electron` unpinned — while `CLAUDE.md`'s own script table says the
  runners are pinned and the file I copied from carries a comment explaining why — so it downloaded
  302 MB of 1.138.0 and died on `ENOENT`. Then I wrote the suite with mocha `suite`/`test` against a
  runner configured `bdd`. Thirty seconds reading `test/integration/suite/outline.test.ts` would have
  caught the second. Consent for a screen-taking action is not a licence to iterate on it.
- ⚠ **I tripped the `cd` gotcha (#535) in the same session I read the warning.** Harmless here, and
  exactly the failure mode the warning exists for.
- **`.vscode-test/` grew by a 302 MB VS Code I do not need** — the filed item already says that
  directory is 18 GB with no visible signal. I am leaving it, and saying so, rather than quietly
  deleting a gitignored tree that other harnesses pin into.
- **TDD:** exempt — no `src/` logic changed; the harness's verification is its control, which fails
  loudly. **Runtime:** the harness ran in a real Extension Development Host and its control passed;
  the extension's own runtime is untouched and its bundle is byte-identical. **Growth:**
  `test/posit/` +~250 lines, `PROJECT_LEARNINGS.md` +4 rows, `BACKLOG.md` +~3 KB, `docs/` +1
  correction block. **Cost:** one workflow, 42 agents, 0 errors, ~3.16M subagent tokens, 774 tool
  calls, ~24 min wall, plus ~120 quarto renders of my own.

**Against the bar.** Session 269 shipped a measured fix; this one shipped a measured *decision* and
an instrument that makes the next such decision cheap. The part I would repeat: refusing to let the
audit's sentence stand once its own repro contradicted it. The part I would not: burning two launches
of the operator's screen on mistakes that reading two nearby files would have prevented.

## Session 268 Handoff Evaluation (by Session 269)

**Score: 8/10.** The task was pickable in minutes and its DONE criterion was set before any code was
written. Two points off: the one guess it made about WHERE the fix goes was wrong in the deleting
direction, and its own gate citation named the wrong commit.

**What helped, specifically.**
- ⚠ **`whats_next` #1 carried the repro path, the two tables and the expected verdict** ("model five
  headings, quarto three"). I re-rendered it at Orient and it was exact.
- ⚠ **"DONE for any heading fix now includes a `run.sh` line in the receipt."** That is the sentence
  that made this session measure a baseline *before* touching code, and measure it three times after.
- **The measure itself.** Four commands became one, ~5 s warm, so "did that change help?" was
  answerable at every checkpoint instead of once at the end.
- **The ordinal rule (#548), "measure the number then write it" (#552), and `git add -A`** — all used,
  all accurate.

**What was missing / wrong.**
- ⚠ **The fix-site guess was wrong, and trusting it would have deleted headings.** It named
  `parseHeadingLine (:9763)` or the ATX row (`:8245`). The gate belongs in `buildHeading`, which both
  heading paths share — and the ATX-row spelling of it (forcing `m` to null) is measurably WORSE than
  nothing: two rendered documents lose a real heading that way (Learning #557). It was labelled an
  ESTIMATE, which is the only reason this costs one point rather than three.
- ⚠ **Its `quality_ratchet` citation said "run at `3a6e451d`" where `.quality-gates-results.json`
  records `head: ed135ec7`.** Same class as the slip it had just filed as #552, in the one field the
  protocol tells you to cite.
- **Nothing it stated as a fact turned out false.**

**ROI: high.** Orientation to the first measured baseline was under twenty minutes.

## Session 269 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **Every design choice was decided by a render, not by reasoning.** The biggest one — drop the
  EMISSION rather than decline the MATCH — was settled by two documents quarto renders and the
  `m = null` spelling deletes (#557), and confirmed by quarto's own AST calling the refused line
  `Plain`, not `Para`.
- ⚠ **I refused to reuse the obvious table.** `RAW_TEX_BLOCK_OR_MACRO_LINE` denies by default; the
  heading question allows by default. Measured cost of getting that backwards: 18 corpus documents
  and 73 heading lines, against the 1 line R4 is about (#556).
- **Strict TDD on both halves**, each RED shown failing for its stated reason (the phantom
  `h2:\maketitle`, then the phantom `h3:1. <Section heading>`) before any `src/` change, with 19
  guards green first.
- **28 mutants, 27 killed** — including one that puts `applet`/`object` back. The survivor is
  disclosed in the docstring rather than quietly repaired.
- **The blast radius is a measurement, not an argument:** exactly **2 of 3,383** corpus outlines
  change. A pre-existing phantom `SETEXT_H1` documents was recovered as by-catch, and its pin rewritten.
- **The runtime gate ran with consent** and asserts both directions, so it cannot pass for a build
  that has simply stopped showing headings that mention a tag.

**What went wrong.**
- ⚠ **I shipped a DELETION for one commit, on my own bad measurement.** `applet` and `object` went
  into the refusing set because the project's standing extractor said they refused; it cannot see
  past the element they open. A subagent contradicted me and it was right. I had used the instrument
  without asking what it is blind to — and this rule is *about* the shapes it is blind to (#554).
- ⚠ **I drew a conclusion from a contaminated single-document sweep** before re-running it one name
  per document (#555). I caught that one myself, but only after acting on it.
- **The CDATA branch is pinned by nothing.** Disclosed, not fixed.
- **TDD:** honoured for the two behaviours that drove the code; R4c–R4m are labelled TEST-AFTER in
  the file itself. **Runtime:** 549 passing. **Growth:** `src/` +~330 lines, tests +~240,
  `PROJECT_LEARNINGS.md` +4 rows, `BACKLOG.md` net −1 item.
- **Cost:** one workflow, 9 agents, ~1.05M subagent tokens, ~700 quarto renders.

**Against the bar.** Session 268 made the measure cheap; this session spent that cheapness on
measuring the thing it was about to ship — and the one place it did not, it shipped a deletion and
had to be told.


## Session 267 Handoff Evaluation (by Session 268)

**Score: 9/10.** Everything this session needed was in it, including the two things it flagged as
unfinished, and its `whats_next` #3 is precisely the task the operator then gave. One point off for a
number it wrote before measuring — which this session then repeated.

**What helped, specifically.**
- ⚠ **`whats_next` #3 named both remaining decisions AND their report sections** (F6, Rec. 4), so
  Phase 1 was a scope question to the operator rather than an archaeology exercise.
- ⚠ **"adopting it should also move the SCRIPT somewhere tracked — the corpus stays personal"** —
  the design constraint that shaped every commit here, written down before anyone asked for it.
- **The AGPL fact and the ordinal rule** (`CLAUDE.md` §Clean-room boundary, Learning #548) were
  already resident, so scrubbing three corpus paths at the moment of tracking needed no re-derivation.
- **The gate citation, `cd`, and `git add -A` warnings** — all still accurate.

**What was missing / wrong.**
- ⚠ **Its own ledger correction (`cb4cb611`, 58 → 60 lines) was filed as a one-off, not a habit.**
  This session made the identical slip in the identical place (21,412 → 21,234 B) before filing it as
  Learning #552. A handoff that had said "write the command, not the number" would have stopped it.
- **Nothing it stated as a fact turned out false.**

**ROI: high.** Orientation to the first commit was minutes, and its constraint saved a redesign.

## Session 268 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **Every stage of the move was held to a byte-identical control** (#553): `cmp` for the census and
  the raw-HTML column against Session 265's outputs, `diff` for the extractor's executable region and
  the scan logic, and the scorer against TWO known scores — 2,419 at HEAD and 2,418 on `b5_head`,
  with ordinal 2494 the single difference.
- ⚠ **The packaging gate got a control that can fail:** `check-package` reds with `unexpected tools`
  when the `.vscodeignore` line is removed, and the line shipped in the SAME commit as the new root,
  so no commit on `master` is red.
- **Privacy at the moment of tracking:** three corpus paths in the extractor's comments became
  ordinals 1, 28 and 308/669 before the file was ever staged.
- **I asked before moving files** — scope and location by `AskUserQuestion`, which `SAFEGUARDS.md`
  requires for a move, and the answer ("whole pipeline + driver") is what made `run.sh` worth writing.
- **The measure got cheaper, not just tracked:** four commands became one, ~5 s warm.

**What went wrong.**
- ⚠ **I wrote `CLAUDE.md` 21,412 B into the ledger before the file was final** — the same slip I had
  scored the predecessor down for one session earlier. Corrected in place and disclosed (`ed135ec7`),
  then filed as #552 so the next session inherits the rule rather than the anecdote.
- **The ground-truth render passes are still untracked**, so "reproducible from tracked files" holds
  only while the corpus survives. Disclosed in the README rather than fixed — it is a session of its own.
- **`tools/**/*.ts` went into `tsconfig.unit.json`**, widening what a gate covers, in a commit whose
  subject is a file move. Right change, slightly wrong commit.
- **TDD:** exempt — no `src/` logic changed; the move's tests are the byte-identical controls above.
  **Runtime:** n/a. **Growth:** `PROJECT_LEARNINGS.md` +2.6 KB, `CLAUDE.md` +1.3 KB, `BACKLOG.md` −1.5 KB.

**Against the bar.** Session 267 wrote decisions down; this one turned one of them into something a
future session can run in five seconds, and proved the move rather than asserting it.
