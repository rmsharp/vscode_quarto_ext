# Handoff Receipts — durable close-out proof

The cumulative, append-only record of **each session's close-out handoff**, distilled into a
machine-checkable block. It is the durable answer to *"was close-out actually performed, and what
did the session hand its successor?"* — the part of close-out that otherwise lives only in the
transient `SESSION_NOTES.md` (overwritten every session) or the spoken report (which leaves no file
at all).

One `handoff` block per **session** (not per commit), newest on top. The canonical-only
`bin/check-handoff` (copy it into your `bin/` if you want the structural check) asserts each block is
present and structurally complete; the next session's Phase 0 reconcile greps this file for a missing
or still-`pending` receipt and backfills it — that reconcile, not the checker, is the dependable
backstop, so the discipline needs no tooling. Together — a write-step at close-out **and** a
reconcile-on-read backstop — this makes a skipped handoff *detectable* rather than silent.

> **A green `bin/check-handoff` is not a good handoff.** The check verifies presence and structure,
> never semantic quality. Faithfulness is still scored 1–10 by the next session (Phase 3A). A
> well-formed but hollow receipt passes the check and is caught only by that human judgement.

## How to write a receipt

**At Phase 1B (claim the session)** — write the stub block below with `status: pending`, filling what
you can, and commit it with your session-claim commit. This committed `pending` block is the crash
breadcrumb: if the session ends before close-out, the next session's Phase 0 reconcile sees it.

**At Phase 3D (close-out)** — overwrite that block in place to `status: complete` and fill every
field. The block must satisfy all six Minimum Handoff Requirements (`SESSION_RUNNER.md` §3D).

## Format — a fenced `handoff` block

````
```handoff
session: S<N>
date: YYYY-MM-DD
status: <pending | complete>
self_score: <1-10>
predecessor_score: <1-10>
active_task: <current state>
what_was_done: <what you did, including a commit sha — or the literal `pending`>
next_steps: <specific and actionable; never "pick next from backlog">
key_files: <each entry carries a path:line token, e.g. SessionManager.java:245>
gotchas: <traps the next session should watch for>
runtime_smoke: <a run result, or "n/a — docs-only", or "impossible: <reason>">
changelog_ref: <PR #N or a short-sha into CHANGELOG.md>
commit: <short-sha — or `pending` until the next session reconciles it>
```
<free-text prose: the durable proxy for the Phase 3G spoken report, plus the +/- self-score breakdown>

Write clean `key: value` lines — no inline `#` comments (a `#` is a literal value character,
as in `changelog_ref: PR #52`). The keys are the six Phase 3D Minimum Handoff Requirements (the sixth
*is* `self_score`) plus `predecessor_score` (the Phase 3A evaluation) and a little metadata. `status`
is `pending` at the Phase 1B claim and `complete` at
close-out; a third value, `reconciled`, is written *only* by a later session's Phase 0 reconcile
when it reconstructs a receipt a crashed session never completed — you never write it yourself.
````

`self_score` and `predecessor_score` are distinct keys so one can never stand in for the other; omit
`predecessor_score` on Session 1 (there is no predecessor to score). `commit: pending` and
`what_was_done: pending` are legal at write time (the receipt ships in the very commit whose sha it
would name); the next session reconciles them to real shas.

## Three files, three questions, one shared key

- **`SESSION_NOTES.md`** — the *transient scratchpad*: rich working notes, overwritten every session.
- **`HANDOFFS.md`** (this file) — the *durable receipt*: the distilled, machine-checkable proof that
  the handoff was written, kept forever.
- **`CHANGELOG.md`** — the *cumulative action ledger*: *"what was done here, ever?"*, append-only.

The shared key across all three is the commit sha (`changelog_ref` / `commit` here). This file
**distills** the handoff; it does not copy the scratchpad. The belongs-here test: *would the next
session need this block to continue the work without re-reading the whole repo?*

---

```handoff
session: S40
date: 2026-07-09
status: pending
self_score: pending
predecessor_score: pending
active_task: Phase 6d-6+ (b2-iii-value) — deep-nested per-format option VALUE completion. Ground+fix
  3 valuesOfSchema gaps ({enum:{values:[...]}} definition-enum form, {tags,schema:...} wrapper,
  object-wrapped {boolean:{description,default}} DSL form) against the real installed schema, trace
  first for already-working inline sub-values, then wire values through. NOT bundling b2-iii-deep.
what_was_done: pending
next_steps: pending
key_files: pending
gotchas: pending
runtime_smoke: pending
changelog_ref: pending
commit: pending
```

---

```handoff
session: S39
date: 2026-07-09
status: complete
self_score: 8
predecessor_score: 7
active_task: Extraction deliverable complete. Feature-development state UNCHANGED from Session 38's
  handoff — b2-iii-key still SHIPPED, b2-iii-value still the top open option, operator still has not
  chosen the next deliverable. This session was an out-of-band ad hoc task, not a step in that
  thread.
what_was_done: Measured the target first (wc -c: the Learnings table was 159,412 of CLAUDE.md's
  164,525 bytes, ~97%). Pinned exact line boundaries (sed/awk), sliced CLAUDE.md with a Python
  script, and byte-exact `diff`-verified the moved content against the original before overwriting
  the source. Created PROJECT_LEARNINGS.md (project root, committed) with an intro + the 45-row
  table + new Learning #46 (this extraction pattern). CLAUDE.md's "Project-specific Learnings"
  heading kept stable (grepped 4 synced/canonical files that hard-code that heading path) with only
  its content swapped for a plain-Markdown-link pointer — explicitly not an @-import (operator
  mid-task correction, applied before the edit landed). Net: CLAUDE.md 164,525 to 5,811 bytes.
  Verified npm run compile clean, python3 methodology_dashboard.py unchanged 78/100, repo-wide grep
  for stray @-imports and the old heading text both clean, PROJECT_LEARNINGS.md not gitignored.
  Documented CHANGELOG.md 2026-07-09 [ad hoc] (later) entry, this receipt. Commit: pending (see
  below).
next_steps: Operator picks the next deliverable — unchanged menu from Session 37/38's handoffs: (1)
  Phase 6d-6+ b2-iii-value (ground+fix 3 valuesOfSchema gaps first, NOT test-only — see
  SESSION_NOTES.md ACTIVE TASK option 1), (2) the Posit feature-comparison research/doc session, or
  (3) a smaller item (copyright dedup bug, a Phase 7 slice, BACKLOG polish, or the operator-only
  `vsce publish`/`git push` — Sessions 31-39 remain unpushed to origin/master, operator's call). No
  structural gates changed this session (HANDOFFS.md Phase 1B/3D discipline unchanged from Session
  38); this was the first session to exercise it end-to-end.
key_files: CLAUDE.md:75-83 (the new pointer paragraph, heading kept stable), PROJECT_LEARNINGS.md
  (new file, project root — the 45+1 row table lives here now), CHANGELOG.md (2026-07-09 · [ad hoc]
  (later) entry), SESSION_NOTES.md ACTIVE TASK + "What Session 39 Did" (full narrative + Session 38
  evaluation), HANDOFFS.md (this receipt).
gotchas: (1) CLAUDE.md's "Project-specific Learnings" HEADING must stay exactly as-is if this
  pattern is ever repeated for another section — SESSION_RUNNER.md/BOOTSTRAP.md/CLAUDE_TEMPLATE.md/
  docs/methodology/HOW_TO_USE.md all hard-code that heading path and are synced/uneditable; only the
  content under a heading is safe to relocate. (2) A pointer to an externalized file MUST be a plain
  Markdown link, never an @-import — the harness auto-expands @-imports into context every session,
  silently reintroducing the exact bloat being removed. (3) PROJECT_LEARNINGS.md is project-owned,
  never touched by bin/sync — no tooling changes were needed and none should be expected on a future
  methodology sync. (4) At Phase 3C going forward, new learnings append to PROJECT_LEARNINGS.md, not
  CLAUDE.md — the next session's close-out should target the new file.
runtime_smoke: n/a — pure docs/CLAUDE.md-context restructuring, no runtime behavior touched. npm run
  compile clean; python3 methodology_dashboard.py unchanged at 78/100 (same pre-existing CRITICAL
  npm-audit flag, Learning #20, unrelated).
changelog_ref: CHANGELOG.md, 2026-07-09 · [ad hoc] (later) entry
commit: pending
```
This session's task was narrow, mechanical, and operator-specified (extract one file, keep one
heading, use a plain link not an @-import), so there was little ambiguity to resolve beyond
confirming the extraction target by measurement and confirming no synced file's instructions would
break. `self_score: 8` — **+** measured the target rather than assuming (wc -c before touching
anything), moved 160 KB of content via scripted tooling with an explicit byte-exact diff proof
rather than a risky manual Edit-tool retype, proactively grepped all four synced/canonical files for
a hard-coded heading dependency before deciding to keep the heading stable, incorporated the
operator's mid-task correction immediately and verified compliance afterward, and followed the full
Phase 1B/HANDOFFS.md discipline end-to-end (the first session to do so since Session 38 introduced
it). **−** did not proactively specify the pointer's exact syntax (plain link vs. possible
@-import) before the operator had to raise it — the risk was real (the harness does auto-expand
@-imports) and should have been preempted rather than corrected. `predecessor_score: 7` — Session
38's handoff was well-formed, accurate on every re-verified fact (commit hash, unpushed count,
dashboard score), and its structural documentation of the new HANDOFFS.md/Phase-1B discipline was
followed successfully by this session with no rediscovery needed; docked to 7 (not higher) only
because its content (b2-iii-value prep, feature-work options) had zero direct ROI for this session's
actual unrelated task — the same "content vs. task mismatch" property Session 38 itself noted about
inheriting Session 37's handoff.

---

```handoff
session: S38
date: 2026-07-09
status: complete
self_score: 8
predecessor_score: 9
active_task: Methodology sync deliverable complete. Feature-development state UNCHANGED from Session
  37's handoff — b2-iii-key still SHIPPED, b2-iii-value still the top open option, operator still
  has not chosen the next deliverable. This session was an out-of-band ad hoc task, not a step in
  that thread.
what_was_done: Ran `../methodology/bin/sync .` from the sibling methodology checkout (origin=
  rmsharp/methodology fork, upstream=KJ5HST/methodology — already 0 commits behind upstream/main, so
  no GitHub fetch was needed). `bin/status .` confirmed zero locally-modified tracked files first.
  Updated 10 tracked files (SESSION_RUNNER.md, SAFEGUARDS.md, RECOMMENDED_SKILLS.md, BOOTSTRAP.md,
  methodology_dashboard.py, docs/methodology/ITERATIVE_METHODOLOGY.md, docs/methodology/
  HOW_TO_USE.md, 4 workstream docs); created the new HANDOFFS.md seed. Verified npm run compile
  clean and `python3 methodology_dashboard.py` clean (78/100; the 1 CRITICAL flag is the
  pre-existing documented dev-only npm-audit posture, unrelated). Documented CLAUDE.md Learning #45,
  CHANGELOG.md 2026-07-09 [ad hoc] entry, this receipt. Commit: pending (see below).
next_steps: Operator picks the next deliverable — unchanged menu from Session 37's handoff (1)
  Phase 6d-6+ b2-iii-value (ground+fix 3 valuesOfSchema gaps first, NOT test-only — see
  SESSION_NOTES.md ACTIVE TASK option 1), (2) the Posit feature-comparison research/doc session, or
  (3) a smaller item (copyright dedup bug, a Phase 7 slice, BACKLOG polish, or the operator-only
  `vsce publish`/`git push` — Sessions 31-38, ~36 commits, remain unpushed to origin/master, still
  the operator's call). STRUCTURAL: starting with the NEXT session, Phase 1B must open a
  `status: pending` stub in this file (this session could not, since HANDOFFS.md did not exist yet
  when the task began) and Phase 3D must close it — this is now enforced by Phase 0 step 6 reconcile.
key_files: CLAUDE.md:127 (Learning #45, the full sync narrative and gotchas), CHANGELOG.md:12-13
  (the 2026-07-09 [ad hoc] entry), SESSION_NOTES.md ACTIVE TASK (updated to note the sync),
  HANDOFFS.md (this file, the first real receipt), SESSION_RUNNER.md Phase 0 step 6 / Phase 1B /
  Phase 3D (the new HANDOFFS.md-aware text), SAFEGUARDS.md "Ledger Co-Staging Hook" / "Close-Out
  Completeness Hook" (the two new optional, unwired mechanisms).
gotchas: (1) The HANDOFFS.md receipt discipline is brand new to this project as of this sync —
  future sessions must remember the Phase 1B stub, not just the Phase 3D close. (2) A sibling
  `../methodology` checkout already exists at `/Users/rmsharp/Development/methodology` with both
  `origin` (fork) and `upstream` (canonical) remotes — check there before ever reaching for
  `bin/sync --source=github`. (3) This sync touched ONLY methodology/tooling files — zero src/**
  changes, zero effect on the b2-iii-value/Posit-comparison feature-work options queued since
  Session 37. (4) Sessions 31-38 remain unpushed to origin/master (pre-existing, unrelated to this
  session, operator's call).
runtime_smoke: n/a — docs/tooling-only change, no runtime behavior touched. npm run compile clean;
  python3 methodology_dashboard.py ran clean (78/100 health, pre-existing unrelated CRITICAL flag).
changelog_ref: CHANGELOG.md, 2026-07-09 · [ad hoc] entry
commit: pending
```
This session's task was narrow and mechanical (an operator-directed methodology sync), so Phase 0/1B
were followed in spirit but abbreviated relative to the full 8-step checklist — the task was already
fully specified by the operator's one-line request and the existing `bin/sync`/`bin/status` tooling,
so there was little ambiguity to resolve by reading GitHub Issues/BACKLOG first. `self_score: 8` —
**+** correctly discovered and used the pre-existing sibling checkout instead of a redundant GitHub
fetch, ran `bin/status` before `bin/sync` (drift-safety-first), verified with the two normal checks
for a docs-only change (compile + dashboard) rather than skipping verification because "nothing code
changed," and documented the new HANDOFFS.md discipline prominently enough that the next session
won't be surprised by it. **−** did not write a Phase 1B `SESSION_NOTES.md` claim-stub before
starting technical work (the task was simple enough that this was low-risk, but it is still a
protocol step skipped); could not open a `HANDOFFS.md` Phase-1B stub for the same reason the file did
not exist until this session's own sync created it. `predecessor_score: 9` — Session 37's handoff
(ACTIVE TASK, key files with line numbers, gotchas, self-assessment breakdown) met every Minimum
Handoff Requirement and was immediately legible; docked one point only because its content (b2-iii-
value prep) had zero ROI for this session's actual (unrelated, operator-redirected) task — a
property of what task the operator picked next, not a flaw in the handoff itself.

---

<!-- Receipts go below, newest on top. Delete the seed-sentinel line above when you add the first one. -->
