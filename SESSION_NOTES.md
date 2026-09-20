# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 268 IN PROGRESS** — **adopt the real-document score as a STANDING, TRACKED
measure**, and close the fenced-div item. Operator-directed, scope chosen by `AskUserQuestion`:
the whole pipeline plus one driver, into `tools/realdoc-score/` (a new top-level root — the
packaging gate reds on it, so `.vscodeignore` gains it in the same commit). **The corpus stays
personal:** only scripts move; the data path is supplied at run time. **Started:** 2026-09-19.
**Workstream:** `docs/methodology/workstreams/DEVELOPMENT_WORKSTREAM.md` (a move + parameterisation;
the operator's directive is the plan-mode approval SAFEGUARDS requires for a move).
**DONE =** the tracked driver reproduces **2,419 / 2,438** at HEAD and **2,418 / 2,438** on S265's
`b5_head` build, from the tracked scripts only; `check-package` green; the fenced-div item gone.
**NOT in scope:** any `src/` change, the black-box Posit confirmation, the `HANDOFFS.md` trim.
**Status:** CLAIMED. Work beginning.
**Ledger:** `CHANGELOG: pending` — the claim commit carries an *(in progress)* entry; Phase 3F
records the rest. Until close-out this line is the crash breadcrumb for the next reconcile.
**Phase 0 findings (S268).** 0 undocumented commits; every receipt complete; dashboard 76/100.

---

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

## Session 264 Handoff Evaluation (by Session 265)

**Score: 8/10.** Every operational instruction held and was used; it loses two points for relaying a
stale ranking without the reach measurement that would have exposed it.

**What helped, specifically.**
- ⚠ **"Phase 0 MUST present ranked candidates via `AskUserQuestion`"** — the step fired as written.
- **The gate-citation rule** — the S264 receipt's `quality_ratchet:` line matched
  `.quality-gates-results.json` exactly (results `bba236856bad`, manifest `8845021a4049`).
- **"One entry per commit; the claim carries an *(in progress)* entry"** and **gotcha 2 (grep
  `BACKLOG.md` before `[ad hoc]`)** — both followed; the grep found no re-score item.
- **Gotcha 7 (never `git add -A`)** — every commit was staged by exact path.

**What was missing.**
- ⚠ **That the ranking it relayed was stale.** `whats_next` #1 named the TABSET item as the head of
  "Up Next", and the Active note still ranked the `:::` div family first — fixed by S257/S258 before
  S264 ran. Measured here: no open item explains any of the 20 divergent authored documents.

**What was wrong.** Nothing I measured. Gotcha 5's sizes had moved (HANDOFFS 148,237 B), as it said.

**ROI: positive.** Short, operational, and correct; the ranking gap cost nothing because the operator
chose the re-score.

## Session 265 Self-Assessment

**Score: 7/10.**

**What went right.**
- ⚠ **I reproduced Session 251 exactly before trusting any delta** — its census, 2,314 / 124, and
  81 / 34 / 9 — then froze the corpus (95 documents had changed) and checked the live corpus agrees.
- ⚠ **Every attribution was adversarially re-checked, then re-run by me:** 43 / 43 attributed by a
  diagnose-then-refute workflow; 23 reproductions re-run firsthand; I1 and I2 checked against all
  2,441 cached renders; I3 measured on all 339 no-R-chunk `.Rmd` — which exposed 3 hidden divergences.
- **Per-heading transitions for all five build steps:** 0 real headings deleted, 0 phantoms added.
- **A three-lens review of the report before commit;** every confirmed finding corrected, and each
  replaced reproduction re-run.
- **TDD:** exempt — no `src/` or `test/` change. **Runtime:** n/a; gates green (below).

**What went wrong.**
- ⚠ **My first draft's prose outran its tables:** a cause count matching no table, a mixed-instrument
  comparison row, an inverted `≥`, a headline no script reproduced, a misdescribed `divColumns`, an
  over-claim on R2 — and a **privacy leak**: an engine name that was a path component of the document
  cited beside it. All caught by the reviewers before commit (Learning #548).
- **I launched the first workflow with a one-document placeholder** as `args`; stopped and relaunched.
- **The `cd` trap twice** (Learning #535), after reading about it at Orient.
- **Growth:** `BACKLOG.md` +4.4 KB (the new item), `PROJECT_LEARNINGS.md` +3.7 KB; the notes trim was
  the only reduction. **Cost:** three workflows (one stopped), 17 agents, ~1.9M subagent tokens.

**Against the bar.** Session 251 built the instrument and ranked by presence; this session reproduced
it, found three defects in it, and ranked by attribution — the whole remaining list is new.
