# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

**Archived 738 record(s), Sessions 0–253** into [`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md) — same format, same newest-on-top order, frozen.
Losslessness is proved by [`SESSION_NOTES-through-S253.md.verify.sh`](docs/archive/SESSION_NOTES-through-S253.md.verify.sh), which re-derives C0–C6 from git — run it rather than trusting this sentence.

---

## ACTIVE TASK
**Task:** **NONE — Session 263 closed out.** `BACKLOG.md` "Active" is empty, so Phase 0 MUST present
ranked candidates via `AskUserQuestion` (CLAUDE.md, Additional Phase 0 steps).
**What S263 did:** IMPLEMENTED P1 of `docs/planning/2026-09-14-attribute-tokenizer-plan.md` — fences read
after quarto's backtick tag rewrite: 41 headings, 8 cells, 2 labels restored in 23 real documents.
Commits: `0a33f600` claim · `7e4ee16f` decisions · C1 `39d3a6aa` · C2 `d27114bc` · C3 `2a69d6c4` ·
`a2699040` decision · C3b `51449f24` · C4 `7c84e94a` · `1c768656` records · `5fb65912` trim · close-out.
**⚠ THE PLAN'S RECOMMENDED STOP IS REACHED.** P2–P4 are NOT approved (operator: P1 only), and every item
they close measures 0 of 3,383 documents. They need the operator's §12 decisions 2, 3, 4, 7, 8 first.
**⚠ The operator EXTENDED P1 mid-session:** readqmd's line-0 `{}` propagation is now modelled (C3b); the
helper's third parameter is `emptyTagAllowed`. `refs.ts` is deliberately NOT given it — see the plan's
P1 banner.
**⚠ Runtime gate GREEN:** 547 passing. `npm test` 2912 / 66 files.
**⚠ `context_budget.py` is RED on FOUR files**; this session grew `PROJECT_LEARNINGS.md` +4,225 B and
`BACKLOG.md` +422 B. MEASURE them; do not quote this line.
**⚠ Jupyter is now installed** — force `engine: markdown` in render probes that are not about cells.
**⚠ `scratchpad/` is untracked and NOT ignored** — never `git add -A` (~85,000 files).

---

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
