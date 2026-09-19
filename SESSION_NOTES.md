# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 266 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S266 did:** fixed the Up Next head item's (a), R1 — a line of 7+ `#` is a pandoc header, so it
ends the paragraph and the outline never shows it. Corpus 2,418 → 2,419 / 2,438; only ordinal 2494
moves (+26 headings, 0 removed). Commits: `801aa776` claim · `8256fb4d` fix · `9b3d878e` runtime
gate (548 passing) · `132c7a9a` learnings #549–#551 · `efd7e7d0` notes trim · close-out.
**Recommended next pick: that item's (d), R4** — a block-level HTML tag or TeX command in ATX text
(`### 2. Overview <section>`, `## Intro \maketitle`) means the line is no heading. Repro:
`scratchpad/s265/repro/synthetic/R4-block-in-atx.qmd` (the model reports all five; quarto three).
Tag/macro tables `model.ts:1438`, `:1557`; the fix site is probably `parseHeadingLine` (`:9763`) or
the ATX row (`:8245`) — an ESTIMATE, not measured. Then (b) R2 (needs the `START_CODE` oracle run).
**Operator decisions still waiting** (report F3, F5, F6, Rec. 4): raw HTML `<hN>` not headings; R7
recorded not built; close the fenced-div container item; adopt `score_corrected.py` as the measure.
**Re-score after any model change** — S265's recipe, verbatim, reproduced 2,418 / 20 before use:
`S=scratchpad/s265`; copy the build's `src/` to `$S/builds/<new>/src`; `CENSUS_SRC=$S/builds/<new>`
`CENSUS_CORPUS=$S/snapshot.json CENSUS_OUT=$S/model_<new>.snap.tsv npx vitest run --config`
`$S/vitest.s265.config.ts`; esbuild its `model.ts` to `$S/tools/model_<new>.cjs`; `rawhtml_adjust.js`;
`python3 $S/score_corrected.py <new> …` (HEAD now: 2419 / 19). `scratchpad/s266/tools/views.js`
diffs every public scan view between two builds over the corpus (edit its two `require`s).
**⚠ A line that becomes a block UNMASKS misreads above it** (Learning #549): classify new divergence
with rendered twins, `scratchpad/s266/tools/twins.py`; the `adv/` set is 1,941 probes to reuse.
**⚠ The corpus is personal:** tracked files name a corpus document only by its ordinal (#548).
**⚠ Gates:** close-out runs `python3 quality_ratchet.py --run` (needs `dist/`; cite the summary line).
One `CHANGELOG.md` entry per commit; the claim commit carries an *(in progress)* one.
**⚠ `context_budget.py` exits 2** — HANDOFFS/BACKLOG/PROJECT_LEARNINGS over; MEASURE, do not quote.
**⚠ `test:integration` takes over the screen** — ask first, and add any new row BEFORE the run.
**⚠ `cd` in a Bash command moves the session cwd** (#535; hit once again). **⚠ Jupyter is
installed** — force `engine: markdown` in probes. **⚠ Never `git add -A`** — `scratchpad/` is not ignored.

---

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

## Session 263 Handoff Evaluation (by Session 264)

**Score: 8/10.** Accurate on everything this session could check, and the four lines of it that bore
on an out-of-band task were right. It loses two points for one connection it had the facts to make.

**What helped, specifically.**
- ⚠ **`whats_next` #3 — "Sync the synced methodology files at the START of a session."** The
  operator's brief made the sync the task; the receipt had already said to do it first.
- **Gotcha 7's sizes matched to the byte** — `CHANGELOG.md` 90,244, `BACKLOG.md` 313,765,
  `PROJECT_LEARNINGS.md` 990,741 — and "MEASURE, do not quote" is what I did.
- **"`scratchpad/` is untracked — never `git add -A`."** Every commit was staged by exact path, which
  is the only way the sync commit could be exactly the dry run's 14 files.

**What was missing.**
- ⚠ **That the sync would finish two open "Up Next" items.** `BACKLOG.md`'s stale-dashboard item said
  *"do them together"* with the CHANGELOG-header item; #3 said "sync" without naming either. Both
  stayed open through P8 until my verifier found them (`e2ad2dbb`).

**What was wrong.**
- **#2, "TRIM CHANGELOG.md and HANDOFFS.md — trimmer-supported, over ceiling"** — true of the tools it
  had; the synced trimmer's trigger is 196,608 B and fires on neither. A premise the sync retired.

**ROI: positive, modest.** Most of the receipt is P1 detail this session did not need; the relevant
lines were short and correct.

## Session 264 Self-Assessment

**Score: 7/10** (8 at the first close-out; lowered when the operator had to prompt the missed gate rule).

**What went right.**
- ⚠ **Phase 0 caught the brief's false premise** — `58f7bcbd` was not HEAD (11 commits later) — and I
  re-derived every line the plan cites before editing; all still held.
- **Both operator decisions were asked at Orient, before any edit** (budget drop, tag form).
- ⚠ **Impact analysis before editing found what the plan did not:** the sync reds the release gate
  (`check-package`, two new root files). Denied one commit earlier, so no commit on `master` is red
  and the sync commit is exactly the dry run's 14 files plus its entry.
- ⚠ **Every DONE item measured with a control that can fail:** §9.8 (1–7 control caught it),
  `bin/status` flipping per commit, `cmp` at every boundary, trimmer L1–L3 on both ledgers.
- **Adversarial verification, then every claim re-checked firsthand** before acting on it, including
  the `check-handoff` skip. Build: `compile` 0, `npm test` 2912/2912, `check-package` OK 42 files.
- **TDD:** exempt — no logic changed (docs and config only).

**What went wrong.**
- ⚠ **I tagged P8's commits `[ad hoc]` without grepping `BACKLOG.md`.** Two finished items stayed open,
  against the same-commit rule, until the verifier found them — correction `e2ad2dbb` (Learning #543).
- **The claim entry says per-commit entries "arrive with this sync".** The old Phase 3F already said
  one per commit; only the claim's *(in progress)* entry is new. Entries are never edited — noted here.
- **I rewrote a budget comment around a pre-existing wrong figure** (62,521 B "after the S254 trim";
  it was 52,850 B) — second correction, `6d66070a`.
- ⚠ **I closed out against the runner I read at Orient, not the one I had just synced.** The new Phase
  3C says *a mechanical learning is a gate, not a row*; #544 was left a row until the operator said
  "finish the close-out". Two gates, operator-chosen, each shown to fail — `d71e5870`.
- **Cost:** two workflows, 8 agents, ~1.3M subagent tokens for a docs-and-config migration.
- **Ledger growth:** `CHANGELOG.md` +10.9 KB (per-commit entries), `PROJECT_LEARNINGS.md` +1.6 KB;
  `BACKLOG.md` −2.2 KB.

**Against the bar.** P7 in `wsfct` landed in six commits. This one took thirteen: two corrections my
own verification forced, and a close-out the operator had to send back. The migration itself was right
the first time, and verified with controls rather than asserted.
