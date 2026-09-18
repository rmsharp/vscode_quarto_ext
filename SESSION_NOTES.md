# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **Session 263 IN PROGRESS** — **implement P1 of the attribute-tokenizer plan**: quarto's
backtick fence-tag rewrite, so a ```` ```{{lang}} ```` display fence is read as a fence (the "Up
Next" head; a Session 224 regression, `95241beb`; 23 documents, +41 headings). Strict TDD.
Operator-picked at Phase 0. **Started:** 2026-09-18.
**Plan:** `docs/planning/2026-09-14-attribute-tokenizer-plan.md` §4 P1. **Operator decisions (§12),
2026-09-18:** (1) **P1 ONLY is approved** as the gate (a) contract; P2–P4 and §12 items 2, 3, 4, 7, 8
are decided when a later session picks them up. (5) **Runtime gate consented at Orient** — C4 stays in
the layer set; a second explicit yes is still owed immediately before `npm run test:integration`.
**§9.5 re-verification:** no drift in P1's seven files since `7a2397e2`; all six anchors resolve at the
plan's lines; `quarto` 1.7.33; `scratchpad/s262` present.
**Operator decision, mid-session (2026-09-18) — the contract is EXTENDED:** P1 also models readqmd's
`{}` PROPAGATION (a line-0 `{}` tag is rewritten on every later fence), which the plan listed as "not
modelled". The adversarial pass measured P1 strictly worse than its parent there (`c25` −5 headings,
`e03`/`e04` a lost cell; zero corpus reach). Own checkpoint, C3b, strict TDD.
**NOT in scope:** P2–P4, the tokenizer leaf, the `divColumns` push, the ledger trims, the syncs.
**Status:** CLAIMED. Work beginning.
**Ledger:** `CHANGELOG: pending` — this session's actions are recorded in `CHANGELOG.md` at Phase 3F.
Until close-out this line is the crash breadcrumb for the next session's reconcile.
**Phase 0 findings (S263).** Tree clean but for `scratchpad/` and the two telemetry appends. Both
ledger frontiers are `HEAD` (`58f7bcbd`); zero undocumented commits. `gh issue list` empty.
Dashboard 76/100. `compile` exit 0; `npm test` 2875 / 66 files.
**⚠ `context_budget.py` RED on FOUR files, measured:** `CHANGELOG.md` 87,837 B, `HANDOFFS.md`
129,409 B, `BACKLOG.md` 313,343 B, `PROJECT_LEARNINGS.md` 986,516 B; ceiling 65,536 B.
**⚠ `context_budget.py` flags seven synced files as differing from canonical.** Not synced mid-flight.
**⚠ `scratchpad/` is untracked and NOT ignored** — never `git add -A` (~85,000 files).

---

## Session 261 Handoff Evaluation (by Session 262)

**Score: 8/10.** Complete on all six Minimum Handoff Requirements, and its `whats_next` #1 was the
exact question the operator chose to answer. It loses two points for not applying its own newest
learning to its own ranking.

**What helped, specifically.**
- ⚠ **`whats_next` #1 — "Decide whether that is a PLAN session before patching either"** — framed the
  whole session. The operator picked it at Phase 0, and the three items it named by TITLE resolved at
  once, where line numbers would have drifted.
- **"MEASURE them; do not quote this line"** — I measured: all four red, as the receipt said.
- **Every `key_files` anchor resolved firsthand** — `READER_HAS_FENCED_DIVS :2483`,
  `fromHasFencedDivs :2492`, `calloutTitleTakes :6660`, `tabsetTabTakes :6694`.
- **Gotcha 7 — the baseline worktree is gone; `check.py` takes its path.** Pointing `S260_BASELINE`
  at the working tree gave a one-document check that worked first time.
- **Gotcha 3 — `check.py`'s VERDICT mislabels a TEXT difference** — I read its three lists instead.

**What was missing.**
- ⚠ **The reach of its own #1.** Session 261 wrote Learning #528 — *"a reach label nobody measured is
  a guess, even on a HIGH-severity item"* — and then ranked the two HIGH heads first, marked DERIVED,
  with no reach, while its #3 carried a measured "0 of 3,383". Measured this session: both heads reach
  **0** documents, and the only real reach in the family is a ```` ```{{lang}} ```` fence REGRESSION
  (23 documents) no session had filed. Had #1 carried its reach, the Phase 0 ranking would have differed.

**What was wrong.** Nothing material that I measured.

**ROI: high.** The framing and anchors repaid the read many times over; the missing reach cost this
session nothing — its research measured it — but it would have changed what the operator was shown.

## Session 262 Self-Assessment

**Score: 7/10.**

**What went right.**
- ⚠ **I measured reach before designing, and it changed what the plan is.** Every item the task was
  about measures 0 of 3,383 documents; the one real-reach defect in the family surfaced from the same
  census, and I bisected it to a Session 224 regression (`95241beb`) myself. The recommended stop is that
  fix, which needs no tokenizer.
- **I re-measured every load-bearing claim before it went into the plan** — 14 groups in its §11.2,
  including real renders, the bisect and the census controls from the committed copy.
- **I put the plan through two reviews and changed it on the evidence**, and dropped P3's blank-line
  rule rather than patching it — two measured deletion hazards for zero-reach fixes.
- **I asked the operator the one decision that changed this session's commit** (the census tool) and
  put the rest in the plan's §12, where the operator can see and overrule them.
- **Nothing under `src/` or `test/` changed**; compile clean, 2,875/2,875; `check-backlog` OK.

**What went wrong.**
- ⚠ **My first draft carried a blocker I could have found myself:** P3's second RED already passed at
  HEAD, six of P1's nine "cycles" were pins, and P4's stub made its own first RED pass. I wrote REDs from
  the synthesis without running them (Learning #537).
- ⚠ **My revision then specified a command I had never run** — the grid recipe crashed as written; the
  second review caught it, along with 14 smaller defects.
- ⚠ **I repeated the `cd` trap after writing the learning about it** (Learning #535).
- **The plan is long** — 1,632 lines, 139 KB; each phase block is self-contained, but it is heavy.
- **I grew both over-budget ledgers and reduced nothing** (`BACKLOG.md` +10.4 KB, `PROJECT_LEARNINGS.md`
  +6.9 KB) — the tenth consecutive close-out to grow them.
- **The research was expensive:** four workflows, 40 agents, ~10.9M subagent tokens.

**Against the bar.** Sessions 257–261 each shipped or certified a rule and attacked it. This one shipped
no code: it planned one, measured that most of its value is zero, found the real-reach regression beside
it, and put the plan through the same adversarial discipline — though it took two reviews to catch what
running my own REDs would have caught first.

## Session 260 Handoff Evaluation (by Session 261)

**Score: 8/10.** Complete on all six Minimum Handoff Requirements, and its `whats_next` #1 was the
task the operator picked, with the file, the line and the one-read size of the fix. It loses two
points for two claims that did not survive measurement.

**What helped, specifically.**
- ⚠ **Gotcha 4 — "the baseline for a new fix is your OWN parent commit; set `S260_BASELINE`"** —
  and `check.py` as "the one instrument". I built one worktree at my claim commit and wrote no
  harness of my own; every render I ran went through it with a baseline column.
- ⚠ **Gotcha 2 — "a refute stage that kills nothing is not evidence on its own"** — is why I
  re-rendered all 1,419 adversarial probes and twins myself rather than trust 150 refuter verdicts. That
  re-render is what showed the 75 "introduced" findings were un-masked, not new (Learning #525).
- **Gotcha 3 — "score against the parent commit, never in absolute"** — the baseline column is the
  only thing that separates the phantoms my gate exposed from any it created (there were none).
- **`whats_next` #1 cited `model.ts:6633` and `:6666` correctly**, re-read firsthand; "one read"
  was exactly the size of the fix.
- **The budget warning said "MEASURE them; do not quote this line"**, and I measured them.

**What was wrong.**
- ⚠ **"One read; MEDIUM reach; deletion direction. MEASURED."** The reach was never measured: 6 of
  3,383 authored documents declare any `from:`, all with fenced divs, and a two-build census
  changed 0 of 28,103 headings. The label was the filed item's, carried under a MEASURED tag
  (Learning #528).
- **"Six synced files are behind canonical."** `cmp` finds seven; two are under
  `docs/methodology/`, which `context_budget.py` does not track.

**What was missing.** Nothing it could have known: that gating the callout rule would un-mask every
plain-div defect under the same readers took a 157-agent fan-out to see.

**ROI: high** — the pick, the instrument and three gotchas repaid the read many times over.

## Session 261 Self-Assessment

**Score: 8/10.**

**What went right.**
- ⚠ **I rendered the reader grid BEFORE writing a test, and it found the one place the fix would
  be wrong** — a glued heading under `markdown-fenced_divs` — and a plain-div twin showed the same
  wrong answer already existed, so I disclosed and pinned it instead of bending the gate around it.
- **Strict TDD, shown:** R1 RED for the right reason (the model hid `Inside` under all six readers),
  one condition GREEN, then guards each killed by a mutant, re-run after R7 was added.
- ⚠ **I did not trust 150 refuter verdicts or 75 "introduced" claims.** I re-rendered all 1,419
  probes and twins and classified direction from the three lists myself. That is what turned "75
  regressions" into "no new wrong logic, no heading removed" — and it exposed my own comment.
- **I measured reach before claiming value:** the census changed 0 of 28,103 headings, and I
  recorded that the filed "MEDIUM" was never measured instead of repeating it.
- **I asked before taking the screen and ran the runtime gate last**, behind guards that refused to
  start it with a dirty `model.ts` or a live render: 545 passing.
- **Everything the fan-out found is filed by root cause** — one widened item, three new — and every
  cited probe path was checked to resolve before commit.

**What went wrong.**
- ⚠ **I committed a comment claim before the adversarial pass could test it.** "The push still shows
  through in ONE measured place" shipped with the fix and was false; the fan-out found five more
  readers and three more paths. It cost a correction commit (`0f5ddff7`).
- ⚠ **I wrote a count from a render that was still running.** "839" went into a comment, a commit
  message and three records; the final is 1,419. The `0f5ddff7` message cannot be corrected.
- **I lost a render group to zsh word-splitting** (19 of 71 rows), the same class of shell trap
  Session 260 hit with BSD xargs (Learning #529).
- **The fan-out was expensive:** 157 agents, ~94 minutes, and its refuters wrote 1,088 variants I
  then re-rendered. "Reproduce, then build ONE plain twin" would have cost a third as much.
- **I grew all four over-budget files again and reduced none** — the ninth close-out to do so.

**Against the bar.** Sessions 257 and 258 each shipped a rule and attacked it; Session 260 certified
a dead session's. This shipped a one-condition fix for a HIGH deletion item, attacked it harder than
any of them, and established by measurement that everything the attack found was un-masked rather
than created. What it did not do is reduce a single over-budget file.
