# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 265 IN PROGRESS** — **AUDIT: re-score the 3,383 authored documents against
quarto at HEAD** (`e075a9ca`), attribute every remaining divergence, and re-rank `BACKLOG.md` by
real-document reach. Operator-picked at Phase 0 (option 1 of 4). **Started:** 2026-09-18.
**Workstream:** `docs/methodology/workstreams/AUDIT_WORKSTREAM.md`. Predecessor audit:
`docs/REAL-DOCUMENT-TRIAGE.md` (Session 251: 2,314 of 2,438 scored agree, 124 divergent).
**Why now:** the three largest real-reach fixes landed after S251 (callout title S257, tabset S258,
`{{lang}}` fence S263), so "Up Next" no longer reflects real reach.
**NOT in scope:** any `src/` change, acting on a finding, the tokenizer plan's P2–P4, ledger trims.
**Status:** CLAIMED. Work beginning.
**Ledger:** `CHANGELOG: pending` — the claim commit carries an *(in progress)* entry; Phase 3F
records the rest. Until close-out this line is the crash breadcrumb for the next reconcile.
**Phase 0 findings (S265).** Zero undocumented commits; every receipt complete; the S264 gate
citation matches `.quality-gates-results.json`. Dashboard 76/100 — 9 devDependency advisories
(5 high) and `BACKLOG.md` at 311,524 B, past the 262,144 B read limit.
**⚠ Possibly completed record:** "A QUARTO FENCED DIV / CALLOUT is a container `contentColumns`
never pushes" — `divColumns` (`model.ts:6529`) and the S257 callout slot look like both halves.
**⚠ THE PROJECT NOW HAS QUALITY GATES** (`.quality-gates.json`: `release-gate`, `ledger-lag`). Every
close-out runs `python3 quality_ratchet.py --run` (~50 s; needs `dist/` built) and cites its summary
line in the receipt; Phase 0 checks it. Thresholds only tighten. The pre-commit hook is not installed.
**⚠ NEW LEDGER RULE, in force since the sync: ONE `CHANGELOG.md` ENTRY PER COMMIT.** The claim commit
carries an *(in progress)* entry; a committed entry is never edited — a correction is a new entry.
Rules: `docs/methodology/FRAMEWORK_APPARATUS.md:338`; this project's form: `CLAUDE.md:178`.
**⚠ Tag a backlog item `[BL-<item title>]`** (no `]`); methodology work `[ad hoc]`. Grep `BACKLOG.md`
for what a commit touches BEFORE tagging it `[ad hoc]` — S264 missed two items (Learning #543).
**⚠ D7 DECIDED (operator, methodology S191): `HANDOFFS.md` STAYS budgeted at 65,536 B**, so it reads
`over`; the remedy is a trim here, its own task. The trimmer fires only above 196,608 B (v1.5.0), so
that trim needs `--budget-bytes` or `--cut N --force`.
**Nothing is owed upstream:** methodology S191 recorded P8 (plan `:1009`) and filed the check-handoff
bug as BL-72; S192 is fixing it. Until then, find a pending receipt with grep, not `check-handoff`.
**⚠ Jupyter is installed** — force `engine: markdown` in render probes that are not about cells.
**⚠ `scratchpad/` is untracked and NOT ignored** — never `git add -A` (~85,000 files).

---

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

## Session 262 Handoff Evaluation (by Session 263)

**Score: 8/10.** Complete on all six Minimum Handoff Requirements, and its P1 was "specified to the
row" — which held for every RED, mutant and census number. It loses two points for two secondary claims
that did not survive measurement.

**What helped, specifically.**
- ⚠ **`whats_next` #2 — the ordered minimal-GREEN sequence `dd2 → p5 → l04 → d0`.** Each step was red for
  exactly its stated reason; I did not have to design a single cycle.
- **The census numbers and the README's 23 digests** — my runs matched to the digit, so a green census
  meant something.
- **`whats_next` #1 and §12** made the operator's decisions one two-question prompt at Orient.
- **Gotcha 4 (the `git archive` baseline) and §9.5's anchors** — all six resolved at the stated lines.
- **Gotcha 5 (the literal regex is quadratic)** gave me a real RED for linearity: 241 ms.

**What was wrong.**
- ⚠ **§9.5 step 6's timing control.** Pointing both builds at ONE directory loads the model once, so P1
  read 1.39× with no slowdown; two copies read 1.00× (Learning #538). Trusted, it would have failed P1.
- ⚠ **"Not modelled … 0 corpus documents" for the `{}` propagation** was right on reach but never measured
  on direction: P1 was strictly worse than its parent there (`c25`, Learning #539).

**What was missing.** Nothing I needed that it could have known.

**ROI: very high.** The plan did the design; this session executed it, then attacked it.

## Session 263 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **Strict TDD, every RED shown for its stated reason** — `dd2`, `p5`, `l04`, `d0`, the linearity row,
  `lst-i06`, then `c01`; guards green first; every pin killed by a named mutant (M0–M15, all killed).
- ⚠ **I did not rubber-stamp the plan's instruments.** The timing rule tripped; I found the control, not
  P1, was at fault. I fuzzed the linear scan against both readqmd patterns (10.7M strings) before trusting it.
- ⚠ **I checked all 97 adversarial claims in code**, re-rendering 164 files, not trusting agent verdicts —
  which separated 91 un-masked errors from the 5 that were P1's own.
- **I asked before extending the contract**, with a measured prototype, and re-derived it under TDD.
- **The runtime gate ran last**, after two explicit consents: 547 passing.

**What went wrong.**
- ⚠ **I shipped C2 with the propagation gap in it.** The plan disclosed it and I accepted "0 reach" without
  measuring its direction — the same miss I scored the plan down for; the adversarial pass caught it.
- ⚠ **I hit the `cd` trap twice more** (Learning #535), once in the first minutes of the session.
- **A render failed on engine selection** (`q09`) before I forced `engine: markdown`, as the plan says to.
- **I grew `PROJECT_LEARNINGS.md` again (+4.2 KB) and trimmed no ledger** — the trims stay a separate
  deliverable; `BACKLOG.md` nets +422 B after removing the finished item.

**Against the bar.** Sessions 257–261 shipped a rule and attacked it; 262 planned one. This one executed
the plan to the digit, attacked it with 555 probes, found and fixed the one deletion the plan itself had
accepted, and closed with the runtime gate green.
