# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 269 — R4: a block-level HTML tag or TeX command anywhere in ATX content means
the line is NOT a heading** (`### 2. Overview <section>`, `## Intro \maketitle`); inline ones
(`<span>`, `\emph{}`) keep it. `BACKLOG.md` Up Next head item, sub-item **(d)**; report section R4 of
[`docs/REAL-DOCUMENT-RESCORE.md`](docs/REAL-DOCUMENT-RESCORE.md).
**Deliverable:** ONE implementation (IN PROGRESS). **Started:** 2026-09-19 22:15 CDT.
**Status:** Session claimed. Work beginning.
**Ledger:** `CHANGELOG: pending` — the claim commit's `CHANGELOG.md` entry says (in progress);
Phase 3F records the rest. Until close-out this line is the crash breadcrumb for the next reconcile.
**Operator pick:** chosen at Phase 0 by `AskUserQuestion` from four ranked options (R4 recommended;
the others were the attribute-tokenizer plan's P2, R3 grid-table cells, and a catch-all).
**Measured target:** 2 authored documents, 3 PHANTOM headings — the model reports headings quarto
does not render. Repro `scratchpad/s265/repro/synthetic/R4-block-in-atx.qmd` (model five, quarto three).
**Fix site:** tables at `model.ts:1438`, `:1557`; probably `parseHeadingLine` (`:9763`) or the ATX row
(`:8245`) — an ESTIMATE inherited from S268's handoff, not a measurement.
**DONE:** strict TDD (RED shown before GREEN); `npm run compile` + `npm test` green; and a
`tools/realdoc-score/run.sh` line in the receipt showing no corpus document moved into the losing
column (HEAD is 2,419 / 2,438 = 99.22%).
**⚠ Gates:** close-out runs `python3 quality_ratchet.py --run` (needs `dist/`; cite the summary line,
and cite the HEAD the results file records, not the one you expect — S268's receipt named `3a6e451d`
where the file says `ed135ec7`). One `CHANGELOG.md` entry per commit.
**⚠ Write a number only after measuring it** (#552). **⚠ `context_budget.py` exits 2** —
HANDOFFS/BACKLOG/PROJECT_LEARNINGS over ceiling; MEASURE, do not quote.
**⚠ `cd` in a Bash command moves the session cwd** (#535). **⚠ Never `git add -A`** — `scratchpad/`
is untracked, NOT ignored (~85,000 files).

---

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

## Session 266 Handoff Evaluation (by Session 267)

**Score: 8/10.** It made a two-commit session possible in minutes: the four open decisions were
listed with their report sections, and the one I needed most — R7 — carried its cost argument. Two
points off for a gap it could have closed and a fact nobody had.

**What helped, specifically.**
- **"Operator decisions still waiting (report F3, F5, F6, Rec. 4)"** — four pointers, each landing on
  the right section of `docs/REAL-DOCUMENT-RESCORE.md` on the first read.
- **F5's argument** (citation resolution, four metadata gates, a "section holds only its heading"
  test, HTML-specific) was exactly what the decision needed, and survived re-reading.
- **The gates, `cd`, Jupyter and `git add -A` warnings** — all still accurate.

**What was missing.**
- ⚠ **No home for a decision record.** The handoff said what was undecided, never where a settled
  decision goes. This session had to choose (a `BACKLOG.md` RECORD item beside Session 257's, plus
  `CHANGELOG.md`), and the next decision will face the same choice — now answered by the record.
- **The licence was nobody's fact yet.** Posit's extension is AGPL-3.0; the audit had read its
  bundle twice without noting it. Not a defect of the handoff, but it is what made this session's
  practice necessary.

**ROI: high**, and cheap: the report sections did the arguing.

## Session 267 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I measured the licence before writing the practice** — `"license": "agpl-3.0"` in the
  extension's `package.json`, AGPL v3 in its `LICENSE.txt` — rather than assuming MIT because the
  Quarto CLI is.
- ⚠ **I labelled the weak evidence instead of asserting it.** Both decisions' Posit half is a bundle
  grep, and the record says so, twice, with what a confirmation would look like.
- **Scope held:** two files of content, one record, no code; decisions 3 and 4 left open as directed.
- **I re-checked the one factual claim I could** — the fenced-div example still yields no heading in
  the current build — rather than quoting Session 265.

**What went wrong.**
- ⚠ **I used a bundle grep in the session that adopted "don't".** Existence facts only
  (`heading_open` present, `processDocumentAppendix` absent), and disclosed — but the honest order
  was to observe first and grep only if that failed.
- **The learning went to `CLAUDE.md`, not `PROJECT_LEARNINGS.md`** — deliberately, since a directive
  and a row would duplicate; stated here because Phase 3C expects a row.
- **Nothing was removed this session**, so the mandated-read files grew by the record and the
  practice (`BACKLOG.md` +1.9 KB, `CLAUDE.md` +1.9 KB); the notes trim below is the only reduction.
- **TDD:** exempt — no logic changed. **Runtime:** n/a — no runtime behaviour moved.

**Against the bar.** Session 266 shipped a measured fix; this one only wrote things down, which is
the right size for the task. The part I would repeat: refusing to let "Posit does X" into a record
without saying how that was learned.

## Session 265 Handoff Evaluation (by Session 266)

**Score: 9/10.** The best-prepared start I could have had: every citation resolved, the recipe ran
verbatim, and the DONE criterion was the exact number I finished on. It loses one point for a scope
prediction it did not label as one.

**What helped, specifically.**
- ⚠ **The DONE criterion — "ordinal 2494 agrees under `score_corrected.py` (expect 2,419 / 2,438),
  0 newly divergent".** I finished on 2,419, and it told me what to measure before I wrote a line.
- **The re-score recipe.** It reproduced 2,418 / 20 before I trusted any delta, then scored my build
  in seconds, three times.
- ⚠ **"Keep a widened row at column 0: an indented run is prose to quarto."** That warning shaped the
  final design: the new row takes the ATX row's column rule (guard G2).
- **The repro, `model.ts:1992` / `:111` / `:129`, and the privacy, `cd`, Jupyter and `git add -A`
  gotchas** — all accurate, all used.

**What was missing / wrong.**
- **"The fix is a widening of one closer row plus the text-bearing sibling"** (report
  Recommendation 1) — an unlabeled estimate. It took the closer, the fresh-block row, the
  simple-table outrank row, the tight readers, and a reader-resolved paragraph question.
- **"Column 0"** was shorthand for the content column: a literal column-0 row would have kept 12
  container rows of my grid lost (lists, quotes, divs).
- Nothing it stated as a fact turned out false.

**ROI: very high.** No time went on rediscovering the target; it all went on measuring it.

## Session 266 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **Measured before coding:** 422 designed probes rendered through quarto first; the HEAD baseline
  showed 87 + 37 lost rows and fixed the target before any RED.
- **Strict TDD:** R1–R7 each RED for its stated reason before GREEN; G1–G9 guards; 14/14 mutants
  killed, each guard by its own mutant.
- ⚠ **The adversarial pass refuted my first design, and I redesigned rather than patched.** Routing the
  run through the ATX branch lost `> #######` / `> ---` (a deletion HEAD had right). v2 keeps the run a
  body line; the quote rows came back without a special case (R5).
- ⚠ **I did not trust "379 new divergences" in either direction.** I rendered 779 twins and classified
  every row mechanically: all 379 are phantoms HEAD already reports on a twin (Learning #549).
- **Corpus:** only ordinal 2494 moved (+26/0), and no other public scan view moved in any of 3,383
  documents. **Runtime:** a PRESENT/ABSENT outline row, 548 passing.

**What went wrong.**
- ⚠ **My first design came from reasoning** ("the faithful model of a level-7 header") with no probe of
  a quoted UNDERLINE; my grid had quote rows but none of that shape (Learning #550).
- **R8's term was written before its test** (made explicit by the restructure); disclosed in the test.
- **v2 over-restricted unresolved readers on a polarity rule**; rendering the feared case fixed it in
  v3 (Learning #551).
- **I ran `test:integration` before writing its row**, so the operator had to consent twice.
- **The `cd` trap once more**, after reading the warning at Orient. **Growth:** `BACKLOG.md` +1.8 KB
  (one by-catch item), `PROJECT_LEARNINGS.md` +2.7 KB. **Cost:** one workflow, 6 agents, ~1.1M
  subagent tokens, ~3,100 quarto renders.

**Against the bar.** Session 263 executed a plan to the digit and attacked it; this one had no plan,
built its own measurement, lost its first design to the attack, and closed with the one real-document
loss it was sent for recovered and no heading deleted anywhere.
