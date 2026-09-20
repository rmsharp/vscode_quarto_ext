# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 269 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S269 did:** closed **R4** — sub-item (d) of the Up Next head item. A block-level raw HTML tag,
or a class-A raw-TeX command, anywhere in a heading's content means quarto renders NO heading; this
model reported one. The gate is ONE site, `buildHeading`, so the ATX and setext paths share it.
**Measured, not quoted:** `tools/realdoc-score/run.sh` went **2,419 → 2,421 of 2,438 (99.22% →
99.30%)**, divergent 19 → 17; ordinals 1985 and 3004 left the list and nothing joined it. A
document-by-document diff of the two model bundles says **exactly 2 of 3,383** outlines changed.
Commits: `9e84bbf7` claim · `73552c3c` 19 guards · `cf9d5bad` TeX half (RED R4a) · `07d48e14` HTML
half (RED R4b) · `bee53df7` applet/object removed + R4c–R4m + mutants · `d82e03b1` runtime gate ·
`014db19b` records · close-out · notes trim.
**Recommended next pick: the head item's (c), R3** — grid-table cells hold blocks; 3 documents and
8 **LOST** headings, the largest remaining and in the deletion direction, at three fix sites
(`model.ts:112`, `:905`, `:4531`–`:4586`) rather than R4's one. That cost is an ESTIMATE.
**⚠ The instrument trap this session paid for (#554):** `tools/realdoc-score/extract_headings.py`
CANNOT adjudicate a probe whose heading line opens a SWALLOWING element — it hides the heading's own
`</h3>`. It reported no heading for `### T <applet>` where the render holds
`<h3 class="anchored">T098 <applet>`, and acting on that put a DELETION on `master` for one commit.
Grep the raw HTML for `<h[1-6]` instead; a refused line shows as literal `### T …` text.
**⚠ DONE for any heading fix** now includes a `run.sh` line in the receipt AND the two-bundle
document-by-document diff — the score alone cannot say what else moved.
**⚠ Gates:** close-out runs `python3 quality_ratchet.py --run`; cite the head the RESULTS FILE
records, not the one you expect. One `CHANGELOG.md` entry per commit.
**⚠ Write a number only after measuring it** (#552). **⚠ `context_budget.py` exits 2** —
HANDOFFS/BACKLOG/PROJECT_LEARNINGS over ceiling; MEASURE, do not quote.
**⚠ `cd` in a Bash command moves the session cwd** (#535). **⚠ Never `git add -A`** — `scratchpad/`
is untracked, NOT ignored.

---

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
