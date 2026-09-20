# Changelog — Authoritative Action Ledger

The cumulative, append-only record of **actions taken** in this repository — across backlog
items, repository issues, and ad-hoc work. It is the authoritative answer to *"what was done
here, ever?"* Every session records its actions here at close-out (`SESSION_RUNNER.md`
Phase 3F); Phase 0 reconciles it against `git log` and backfills anything a crashed or
out-of-band session missed. Taking an action — any commit, or any non-commit action — and
not recording it is failure mode #27. Old entries may be archived, never deleted.

**The rules** — how to add an entry, source tags, reading and archiving — are in
[§The Action Ledger](docs/methodology/FRAMEWORK_APPARATUS.md#the-action-ledger), which `bin/sync`
keeps current. ledger-format: 2 — keep this marker; `bin/status` reads it.

**Archived 230 record(s), 2026-06-30 → 2026-08-24** into [`docs/archive/CHANGELOG-through-2026-08-24.md`](docs/archive/CHANGELOG-through-2026-08-24.md) — same format, same order, frozen.
Losslessness is proved by [`docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh`](docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh), which re-derives L1/L2/L3 from git; run it rather
than trusting this sentence. Written by `methodology_trim.py` v1.1.1.

## 2026-09

### 2026-09-19 · [ad hoc] Two operator decisions recorded — raw HTML `<hN>` are not Outline headings; R7's appendix re-level is not mirrored — plus the clean-room practice
- **Change:** `BACKLOG.md` — a RECORD item holding both decisions, and the head item's `(g)` sub-item retired into it (six sub-items remain, behind 12 of the 19 divergent documents, 9 of them fixable). `CLAUDE.md` — §Clean-room boundary: Posit's extension is AGPL-3.0 (`"license": "agpl-3.0"`, AGPL v3 in its `LICENSE.txt`, `quarto.quarto-1.135.0`), so behaviour parity is the goal and its source is not a reference; settle "what does Posit do?" by black-box observation, and where `quarto render` and Posit's Outline disagree, that is a decision rather than a defect. ⚠ Both decisions' Posit half rests on a BUNDLE GREP, labelled as such in the record and awaiting a black-box confirmation nothing yet depends on.
- **Commit/PR:** this entry's own commit
- **Session:** S267 · **Verified:** no code change — the model already implements both answers (re-checked this session on the fenced-div example); `check-backlog` OK, 207 open items; `CLAUDE.md` 19,905 B of its 28,000 B ceiling
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 267 claimed — record two operator decisions and the clean-room practice (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S267 receipt in `HANDOFFS.md`; the Phase 0 dashboard telemetry append rides along. Operator-directed after the S266 close-out report; no backlog item names these decisions (grepped), hence `[ad hoc]`.
- **Commit/PR:** this entry's own commit (the claim)
- **Session:** S267 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 266 closed out — (a), R1
- **Change:** the S266 `HANDOFFS.md` receipt set `status: complete` (self 8, predecessor 9); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; recommended next pick the same item's (d), R4, with the re-score recipe) plus the S265 handoff evaluation and the S266 self-assessment; one `context_budget.py` telemetry append. Commits this session: `801aa776` claim · `8256fb4d` fix · `9b3d878e` runtime gate · `132c7a9a` learnings · `efd7e7d0` notes trim · this close-out.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `efd7e7d0`; `npm run check-types` exit 0; `npm test` 2930/2930; `npm run test:integration` 548 passing; `check-backlog` OK (206 open items)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S262 evaluation by S263 + S263 self-assessment)
- **Change:** 51 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show 132c7a9a:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** `git diff --stat` shows deletions only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 266 learnings #549–#551 — unmasking vs causing, inherited gates, polarity is not a measurement
- **Change:** three rows appended to `PROJECT_LEARNINGS.md`: #549 classify a new divergence as inherited only from a rendered twin; #550 a construct routed through an existing branch inherits that branch's blind spots; #551 render the case a "declining is safe" rule guards against before applying it.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** n/a — docs-only; row numbers checked contiguous (540–551)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] The runtime gate for (a), R1 — an outline row in a real Extension Development Host, run and green
- **Change:** `test/integration/suite/outline.test.ts` — one row through `vscode.executeDocumentSymbolProvider`: PRESENT, a 64-`#` run and a text-bearing `########` run release three glued `##` headings and are no outline rows themselves; ABSENT, the same run pressed under prose releases nothing. Both documents rendered through quarto 1.7.33 first (`scratchpad/s266/probes/v/i1`, `i2`): quarto agrees with this build and not with HEAD's on PRESENT.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** `npm run test:integration` exit 0, 548 passing (547 before the row, run first with the operator's consent; this run after a second explicit yes)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Sub-item (a), R1 — a line of 7+ `#` is a pandoc header: it ends the paragraph, and the outline never shows it
- **Change:** `src/core/qmd/model.ts` — `DEEP_ATX_HEADER` (and its tight twin) and `deepAtxHeaderLineIsBlock`, read by `closesParagraph` and `opensFreshBlock` under the ATX row's column rule and paragraph question, plus one `SIMPLE_TABLE_HEADER_OUTRANKED` row. The run stays a BODY line, so an underline below still claims it. A first build routed the run through the ATX branch; the adversarial pass refuted it (a quoted `> #######` / `> ---` lost its heading, R5) and it never reached a commit. `test/unit/qmd-model.test.ts` — R1–R8, G1–G9 and one RESIDUAL pin. `BACKLOG.md` — (a) removed from its item, the Active note now recommends (d), the headline numbers and the item's `model.ts` line citations updated, and one by-catch item filed ("What a line of 7+ `#` used to MASK …").
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** strict TDD, every R row RED for its stated reason before GREEN (R8 written after its term, and says so); `npm test` 2930/2930; `check-types` exit 0; 14/14 mutants killed; corpus re-score 2,419 / 2,438 (was 2,418), ordinal 2494 +26 headings and 0 removed, no other document's headings, outline, cells, body lines or fence openers moved; 422 designed probes: 117 fixed, 0 broken; 1,941 adversarial probes: 398 fixed, 379 new phantoms, every one inherited from a rendered twin.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 266 claimed — sub-item (a), R1: a line of 7+ `#` ends the paragraph (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S266 receipt in `HANDOFFS.md`; the Phase 0 dashboard telemetry append rides along. Operator-picked at Phase 0 (option 1 of 4, the recommended one).
- **Commit/PR:** this entry's own commit (the claim)
- **Session:** S266 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 265 closed out — audit: the real-document re-score
- **Change:** the S265 `HANDOFFS.md` receipt set `status: complete` (self 7, predecessor 8); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; recommended next pick the Up Next head item's (a), R1, with the re-score recipe) plus the S264 handoff evaluation and the S265 self-assessment; one `context_budget.py` telemetry append. Commits this session: `2c611290` claim · `ad7a52a4` report + backlog · `2bf70504` learnings · `d403fc37` notes trim · this close-out.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `d403fc37`; `npm run compile` exit 0; `npm test` 2912/2912; `check-backlog` OK (205 open items)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S261 evaluation by S262 + S262 self-assessment)
- **Change:** 63 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show 2bf70504:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** `git diff --stat` shows deletions only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 265 records — learnings #545–#548
- **Change:** `PROJECT_LEARNINGS.md` gains four rows from the re-score: #545 a renamed input changes the engine quarto measures under; #546 construct presence is an upper bound, attribution the measure; #547 define "heading" by the parser the product mirrors, not the rendered tag; #548 give every headline number a script and grep every "synthetic" string against the corpus. None is a mechanical invariant, so none is a gate.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Audit: the real-document re-score — 98.24% agreement at HEAD (99.18% with the instrument corrected); the 20 divergences left come from eight root causes no open item describes
- **Change:** `docs/REAL-DOCUMENT-RESCORE.md` (new): six builds (Session 251 → HEAD) scored over one frozen copy of the 3,383-document authored corpus; Session 251's published numbers reproduced exactly first (three controls). Every change since Session 251 was a pure gain (45 + 21 + 15 documents fixed, 0 newly divergent, 0 real headings deleted). All 43 divergent documents attributed (a 14-agent diagnose-then-refute workflow; 23 reproductions re-run firsthand): 26 are instrument artifacts — I1 quarto UI chrome, I2 raw HTML `<hN>`, I3 every `.Rmd` rendered as `.qmd` (which also hid 3 real divergences) — and the corrected instrument (`scratchpad/s265/score_corrected.py`) gives 2,418 / 2,438 with 20 divergent. `BACKLOG.md`: new "Up Next" head item *The Outline's last real-document divergences — eight root causes …* ((a)–(h), R1 a 7+ `#` line = 26 lost headings in one document); the Active note's candidates and ranking guidance rewritten to supersede Session 251's; the fenced-div container item annotated as probably complete (operator decision, report F6). Privacy: corpus documents named only by ordinal; every quoted reproduction uses invented text. The report was reviewed by three agents (numbers, privacy, citations) before commit and their confirmed findings corrected.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** `node check-backlog.js` OK (205 open items); `npm test` 66 files / 2912 passed; no `src/` or `test/` change
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 265 claimed — audit: re-score the 3,383 authored documents at HEAD and re-rank the backlog by real reach (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S265 receipt in `HANDOFFS.md`; the Phase 0 dashboard telemetry append rides along. Operator-picked at Phase 0 (option 1 of 4); no backlog item names this re-score (grepped), hence `[ad hoc]`.
- **Commit/PR:** this entry's own commit (the claim)
- **Session:** S265 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Pushed `master` to `origin` (public), `ebaf7460..20e2708c` — 216 commits, Sessions 230–264
- **Change:** GitHub `rmsharp/vscode_quarto_ext` `master` moves from `ebaf7460` (Session 229, the last push, 2026-08-19) to `20e2708c`, a fast-forward (0 behind after a fresh fetch). Operator-directed ("push it"), then confirmed with the full scope shown: 216 commits, not only this session's 14. Before pushing, the range was scanned for secrets, key files, `.vsix`, `scratchpad/` and `node_modules` content, and none was found (48 files changed).
- **Commit/PR:** no commit, a non-commit action; this entry's own commit is the first after the push and is NOT pushed — the next push carries it
- **Session:** S264 · **Verified:** `git push` exit 0 (`ebaf7460..20e2708c  master -> master`); `git ls-remote origin refs/heads/master` = `20e2708c3f06…` = local HEAD; `git rev-list --left-right --count master...origin/master` = `0 0`
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264's handoff corrected — D7 is decided and nothing is owed upstream; both were written as open
- **Change:** after S264 closed out, methodology Session 191 recorded P8 in the upstream plan (row `:1009`, block `:354`; `10f931a`, `0b7e672`), filed the `check-handoff` fence bug as BL-72 (S192 claimed its fix, `96de3ee`), and recorded the operator's D7 decision for this project: `HANDOFFS.md` STAYS in `.context-budget.json` at 65,536 B, and the remedy is a trim here, not dropping the warning. S264's handoff still called both open, in three places, now corrected: `SESSION_NOTES.md` ACTIVE TASK; the S264 receipt's `active_task`, `whats_next` #2(a) and #3, `key_files` (plan anchors re-read at methodology `b27236e`: `:956` → `:1009`, and the rest) and gotcha 3; and the `HANDOFFS.md` comment in `.context-budget.json`, which said the entry was over "until the operator decides". No threshold changed. Noted for the trim: the trimmer fires only above 196,608 B, so it needs `--budget-bytes` or `--cut N --force`.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** every cited methodology anchor re-read at `b27236e` (`:354`, `:392`, `:960`, `:985`, `:1009`, `:1228`–`:1240`; the three commits exist); `grep -c ':956'` = 0 in `SESSION_NOTES.md` and `HANDOFFS.md`; `.context-budget.json` parses; `grep -c '^status: pending' HANDOFFS.md` = 0
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 close-out amended — the receipt cites the gate run; self-score lowered to 7
- **Change:** the S264 `HANDOFFS.md` receipt's `runtime_smoke` now cites the gate run and drops its "no gates, no citation owed" line, `whats_next` #5 tells the next session that every close-out runs the ratchet, and `self_score` goes 8 → 7. `SESSION_NOTES.md`'s ACTIVE TASK names the gates, and the self-assessment records the miss: this session closed out against the Orient-time runner rather than the one it had just synced, and the operator had to send the close-out back.
- **Commit/PR:** the commit that ships this entry; the gates themselves are `d71e5870`
- **Session:** S264 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `d71e5870`; `grep -c '^status: pending' HANDOFFS.md` = 0
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] The project's first quality gates — `release-gate` and `ledger-lag` — declared from Learning #544 (operator's decision)
- **Change:** `.quality-gates.json`, empty since the sync, now declares two gates at their measured values: `release-gate` (`npm run check-package` must exit 0; ~48 s) and `ledger-lag` (commits after the newest commit touching `CHANGELOG.md` must be 0 — Phase 0's reconcile set, and the set that makes the trimmer refuse with `P1_UNDOCUMENTED`). Learning #544's *When to apply* now points at them. Every close-out from here runs `python3 quality_ratchet.py --run` and cites its line in the receipt (`SESSION_RUNNER.md` Phase 3E); the ratchet means a gate is loosened only by plan-mode approval, in its own commit. The pre-commit hook (`install-hook`) is NOT installed. **Why:** the synced Phase 3C says *a mechanical learning is a gate, not a row*, and this session had closed out against the Orient-time runner, which lacked that rule. The operator chose both gates over `ledger-lag` alone, accepting ~48 s per close-out to catch a new root file at the close-out of the session that adds it. **Also on the record:** under the same synced rules, removing a gate takes approval, its own commit and a reason in the ledger. Dropping `CHANGELOG.md` from `.context-budget.json` had the first and third, but shared `4b727a9d` with the `CLAUDE.md` text that records it.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` on the working tree before this commit; controls — `ledger-lag` measures 1 → `fail` after an empty unrecorded commit (scratch clone), `release-gate` exits 1 → `fail` with a throwaway root file (real tree, file removed after)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 closed out — BL-57 P8 done for this project: methodology synced, both ledger seeds migrated, legacy tags recorded
- **Change:** `SESSION_NOTES.md` carries the S263 handoff evaluation (8/10) and the S264 self-assessment (8/10); the S264 `HANDOFFS.md` receipt is `status: complete`. The operator-facing findings P8 surfaced are in the receipt's `whats_next` #2–#3: the D7 budget question for `HANDOFFS.md`, two synced-rule references to `HANDOFFS.md` sections this file does not carry, and the methodology repo's `bin/check-handoff` skipping the newest receipt behind the seed section's ```` ```sh ```` fence. **One correction to this session's claim entry, which is not edited:** it says per-commit entries "arrive with this sync", but the old Phase 3F already said one per commit; what the sync added is the claim's *(in progress)* entry.
- **Commit/PR:** the close-out commit (ships this entry); session commits `48d1790c`, `e8c395b3`, `b8a503e7`, `acb43e0b`, `69f0dd43`, `4b727a9d`, `e2ad2dbb`, `6d66070a`, `3fa063aa`, `a8e56e54`
- **Session:** S264 · **Verified:** on the final tree — `compile` exit 0, `npm test` 2912/2912 (66 files), `check-package` OK (42 files), `check-backlog` OK (204 open); `bin/status` all `current`, both ledgers `present`; trimmer L1–L3 OK on both ledgers; archive proofs OK. Runtime smoke n/a — docs and config only.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S260 evaluation by S261 + S261 self-assessment)
- **Change:** 69 lines removed, old :143–211; lines :1–142 byte-identical. The retention rule in `CLAUDE.md` holds the live file at three pairs once this session's own pair lands. The dropped pair stays one command away: `git show 6d66070a:SESSION_NOTES.md`.
- **Commit/PR:** the commit that ships this entry — a trim commit, with no other edit to `SESSION_NOTES.md`
- **Session:** S264 · **Verified:** `cmp` of kept lines 1–142 against the parent; `git diff -U0` is one hunk, `-143,69`
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 records — learnings #543–#544
- **Change:** `PROJECT_LEARNINGS.md` gains #543 (a methodology sync can finish open backlog items, and `[ad hoc]` hides it — grep `BACKLOG.md` before tagging) and #544 (deny a sync's new root files before the sync commit; give every commit its own entry so the trimmer can verify it).
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — two phrases in the `.context-budget.json` comments `4b727a9d` rewrote, made exact
- **Change:** the top-level comment said "the 65,536 B read-mandated ceilings" matched the trimmer's budget; only the two ledgers' did — it now says so and notes `BACKLOG.md` uses the same number with no trimmer. The `HANDOFFS.md` comment said "62,521 B after the Session 254 trim"; that trim (`867e0fa2`) left 52,850 B, and 62,521 B is the size when the config was written at Session 255 (`d4c90592`). The error predates this session, but it sat inside a sentence `4b727a9d` rewrote. No number the tool reads changed.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `git show 867e0fa2:HANDOFFS.md | wc -c` = 52,850 and `git show d4c90592:HANDOFFS.md | wc -c` = 62,521; `python3 -m json.tool` parses the config
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [BL-Migrate `CHANGELOG.md`'s header/preamble to the current v3.1+ "Authoritative Action Ledger" seed format] Done by `acb43e0b` — the item leaves `BACKLOG.md` one commit late
- **Change:** the Session 158 grooming item is removed from `BACKLOG.md` "Up Next". Its own acceptance test holds: `bin/status --source=local` reads `CHANGELOG.md` `present`, and every entry is byte-identical. **Correction:** `acb43e0b`'s entry was tagged `[ad hoc]` and left the item open, against the rule that a finished backlog item leaves `BACKLOG.md` in the same commit. Found by this session's adversarial verification, not by `check-backlog`, which sees completed records rather than finished open items.
- **Commit/PR:** `acb43e0b` did the work; the commit that ships this entry removes the item
- **Session:** S264 · **Verified:** `bin/status` `present`; `node check-backlog.js` OK, 206 → 204 open items (this item and the next)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [BL-`methodology_dashboard.py` is two minor versions stale] Done by the sync `b8a503e7` — the item leaves `BACKLOG.md` one commit late
- **Change:** the Session 174 item is removed from `BACKLOG.md` "Up Next". The dashboard is now v2.18.0, canonical at fork `0ab3881`, and `bin/status` reads it `current`. **Correction:** `b8a503e7`'s entry was tagged `[ad hoc]` and left the item open; the item itself asked to be done together with the header migration, and it was.
- **Commit/PR:** `b8a503e7` did the work; the commit that ships this entry removes the item
- **Session:** S264 · **Verified:** `python3 methodology_dashboard.py --help` banner v2.18.0; `bin/status` `current`
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — `CLAUDE.md` records this ledger's legacy tags and its `[BL-<item title>]` form; `CHANGELOG.md` leaves `.context-budget.json`
- **Change:** a new `CLAUDE.md` Adaptations subsection, *`CHANGELOG.md` conventions (Session 264)*: backlog items are tagged `[BL-<item title>]` (no `]` in the title), methodology work `[ad hoc]`; the `[BACKLOG: <title>]` tags, the untagged June 2026 shard entries and the positional `[BL-<N>]` tags are legacy, left as written, with the command that lists what the audit skips; `## [Unreleased]` is gone. `.context-budget.json` drops its `CHANGELOG.md` entry (the operator's decision; the rules say no session reads the file whole), corrects two comments the sync made false (65,536 B is no longer the trimmer's budget — trim v1.5.0 archives above 196,608 B), and lists `quality_ratchet.py` among the synced files it checks for drift. `CLAUDE.md` :102 and :146, the lines the plan names, were read against the new rules and need no change.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `python3 -m json.tool` parses the config; `context_budget.py` no longer reports `CHANGELOG.md`, reads `CLAUDE.md` 17,989 B `ok` (ceiling 28,000) and `quality_ratchet.py` `synced ok`; the new command lists 11 skipped headings (5 `[BACKLOG: …]`, 6 untagged), identically in zsh and bash.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — `HANDOFFS.md` gains the current seed's `## Size, and when to archive` section above the trimmer's pointer block; every receipt untouched
- **Change:** the seed's section (`starter-kit/HANDOFFS.md:89`–`148` at fork `0ab3881`, carrying `handoffs-format: 2`) is inserted as new lines 29–88, plus one blank line, directly above the pointer block — plan item (21) and `BOOTSTRAP.md:387`–`388`, the *add, don't replace* route. The count sentence (:20–22), this project's fence-aware warning (:23–27), the pointer block and every receipt stay byte-identical. The insertion point was re-derived at the claim: the plan read it at `58f7bcbd` and it still held.
- **Commit/PR:** the commit that ships this entry; also records the plan's §9.8 check on the header commit `acb43e0b`
- **Session:** S264 · **Verified:** `cmp` — new :1–28 = old :1–28, :29–88 = seed :89–148, :89 blank, :90–end = old :29–end; `grep -c '^```handoff'` 17 → 17. §9.8 on `acb43e0b` (`CHANGELOG.md`, bounds 1 8): `only the block changed`; control bounds 1 7: `lines removed outside the block: [(6, 3)]`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — `CHANGELOG.md`'s Keep-a-Changelog header (old lines 1–8) replaced by the current seed's thin header; the shard pointer and every entry untouched
- **Change:** the header now points to [§The Action Ledger](docs/methodology/FRAMEWORK_APPARATUS.md#the-action-ledger) and carries `ledger-format: 2`. The block, re-derived by content at the claim, is old lines 1–8 — `# Changelog` through `## [Unreleased]`, the Keep-a-Changelog heading dropped as `airqino` dropped it: the ledger groups by month. The trimmer's archive-pointer block (old :10–12) and every entry are byte-identical.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `cmp` — new :1–12 equal the seed's :1–12, new :13–end equal old :9–end apart from this entry; the plan's §9.8 check on this commit is recorded in the next entry. `grep -c '^### '` 25 → 26 and the audit 250 → 251 (zsh and bash alike): this entry in, and the block held no `### ` line.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — methodology synced from fork `main` `0ab3881`: one `bin/sync --source=local` run, one commit, 14 files
- **Change:** 11 synced files updated (`SESSION_RUNNER.md`, `FRAMEWORK_LEARNINGS.md`, `SAFEGUARDS.md`, `BOOTSTRAP.md`, `methodology_dashboard.py` v2.18.0, `methodology_trim.py` v1.5.0, `context_budget.py` v1.2.0, `docs/methodology/ITERATIVE_METHODOLOGY.md`, `HOW_TO_USE.md`, `workstreams/DEVELOPMENT_WORKSTREAM.md`, `workstreams/AUDIT_WORKSTREAM.md`) and 3 created (`quality_ratchet.py`, the seed `.quality-gates.json` with `gates: []`, `docs/methodology/FRAMEWORK_APPARATUS.md`, the ledger rules' new home). From here on, one ledger entry per commit. Past `SAFEGUARDS.md`'s five-file cap by the operator's plan item (18): exactly the files the dry run listed, plus this entry.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** dry run exit 0, 14 files, and the real run wrote the same 14; `bin/status --source=local` reads every tracked file `current` (only the `CHANGELOG.md` and `HANDOFFS.md` seeds `present (stale format)`, migrated next); `check-package: OK — 42 files`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8, before the sync — the three root files the methodology sync adds are denied from the `.vsix`, so no commit on `master` fails `check-package`
- **Change:** `.vscodeignore` denies `quality_ratchet.py`, `.quality-gates.json` and `.quality-gates-results.json`; `.gitignore` ignores the last, as the seed manifest says to by default. Landed BEFORE the sync on purpose: item (18) keeps the sync commit to exactly the files `bin/sync` writes.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** measured in scratch clones at `48d1790c` — pre-sync `check-package: OK — 42 files`; after the sync `FAIL` on `.quality-gates.json` and `quality_ratchet.py` (and on the results file after `quality_ratchet.py --run`); with these lines `OK — 42 files`, before and after the sync. `npm test` 2912/2912 both sides. Re-run on the real tree after the sync commit.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 claimed — BL-57 P8 of the upstream methodology plan (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S264 receipt in `HANDOFFS.md`; the Phase 0 telemetry appends rode along.
- **Commit/PR:** `48d1790c` — recorded here, one commit late: the claim followed this project's old one-entry-per-session practice, and the per-commit rule (the claim carries an *(in progress)* entry) arrives with this session's sync.
- **Session:** S264 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [BACKLOG: a ```` ```{{lang}} ```` display fence — quarto's documented verbatim-cell idiom — is refused as a fence] P1 of the attribute-tokenizer plan — fences read after quarto's backtick tag rewrite; 41 headings restored in 23 real documents, and the one deletion P1 itself introduced, modelled away

- **Operator-picked at Phase 0** (option 1 of 4, the recommended one). Claimed in `0a33f600`; the operator's
  §12 decisions recorded in `7e4ee16f` — **P1 only approved**, the runtime gate consented at Orient.
- **The fix, strict TDD, every RED shown for its stated reason** — C1 `39d3a6aa` (13 guards, green first);
  C2 `d27114bc`: `quartoFenceTagRewrite` (readqmd.lua:37-40, :95-100) on the PHYSICAL line before
  `fenceInfoOpensBlock`, Session 224's brace clause deleted — REDs `dd2`, `p5`, `l04`, `d0` and a linearity row
  (241 ms → <50 ms; the scan fuzzed against both transcribed patterns, 10.7M strings, 0 disagreements); C3
  `2a69d6c4`: refs' intercept deleted, `fenceAttributeId` scans the rewritten line — RED `lst-i06`.
- **Every plan DONE number reproduced**: census 23 docs +41/−6 headings, 8 +8 cells, 2 +2 labels, `threw=0`,
  exactly the README's 23 digests; the fence grid's 10 rows fixed, none broken; M0–M10 killed; oracle
  131/124/4/3; all 12 headings restored on the 9 unrendered pages confirmed by render, none removed.
- **Adversarial certification** (7 agents, 555 probes; every claim re-rendered and checked in code): 91 of 97
  "introduced" findings un-masked pre-existing errors, filed by root cause; 1 quarto-internal split (k03);
  **5 P1's own** — readqmd's line-0 `{}` PROPAGATION, which the plan left "not modelled": strictly worse than
  P1's parent (`c25` −5 headings; `e03`/`e04` a lost cell). **Operator decision mid-session** (`a2699040`):
  model it — C3b `51449f24`, RED `c01`, guards g1–g3, 18/18 docstart probes now match quarto, M11–M15 killed.
- **Runtime gate** C4 `7c84e94a`: operator yes before launch; `test:integration` 547 passing (545 + 2).
- **Records** `1c768656` (the un-masked item, deferred item (f), the plan's P1 DONE banner, learnings
  #538–#542); notes trim `5fb65912`; this close-out removes the `{{lang}}` BACKLOG item.
- **Found on the way:** the plan's census timing control shares one module load, reading P1 at 1.39× with no
  real slowdown (two copies read 1.00×, Learning #538).

### 2026-09-14 · [BACKLOG: The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it] The attribute-tokenizer plan — four phases, the real-reach regression beside them, and the census that proves them

- **Operator-picked at Phase 0** (option 1 of 4, the recommended one): plan one tokenizer rather than
  patch either HIGH item. Claimed 2026-09-11 in `7a2397e2`. **PLAN ONLY — no file under `src/` or
  `test/` changed.**
- **The plan (`452ce271`)** — `docs/planning/2026-09-14-attribute-tokenizer-plan.md`: one import-free
  leaf, `src/core/qmd/attribute-block.ts`, built from measurement. P1 quarto's backtick fence-tag rewrite
  (the recommended stop; no tokenizer; 23 documents, +41 headings, −6 phantoms, +8 cells, +2 labels);
  P2 the leaf and accepted `:::` openers; P3 single-line refusals through the div stack (correcting, by
  measurement, the claim note's "not the `divColumns` push"); P4 (optional) the fence info rule. Every
  div/heading item it closes measures **0 of 3,383** documents; its ground truth is quarto's READER VIEW,
  not raw pandoc.
- **The census tool rides with the plan** (operator decision, mid-session, option 1 of 3): three files
  under `docs/planning/scripts/attribute-block/` — a three-view two-build census that fails on any throw;
  controls re-run from the committed copy (identity 0/0/0; pre-S257 108/+0/−289; P1 prototype 23/+41/−6,
  cells 8, labels 2), and P1's expected changed set as path digests, no paths.
- **Found, measured and filed: a Session 224 regression** — a ```` ```{{python}} ```` display fence is
  refused as a fence and swallows headings in 23 real documents (`95241beb`'s parent reports both
  headings of the witness, `95241beb` one). The new head of "Up Next"; the plan's P1.
- **Records (`61bcce86`):** that item; one consolidated *"Deferred by the attribute-tokenizer plan"*
  item; reach-0 annotations on the three items the plan schedules; five appends. `BACKLOG.md` 302,927 →
  313,343 B (+10,416), `check-backlog` OK, 206 open. Learnings #531–#537 (`PROJECT_LEARNINGS.md`
  +6,855 B).
- **Notes trim (`4b69957b`):** the oldest SESSION_NOTES pair (S257 eval + S258 self-assessment), deletion
  only.
- **How it was made:** four workflows — research (15 agents), a design panel (8), a plan review (11: 46
  findings + 4 critic gaps, 1 blocker) and a second review of the revision (6: 15 findings, 0 blockers)
  — about 10.9M subagent tokens; every load-bearing claim re-measured by the main session (plan §11.2).
  P3's blank-line rule was dropped after review (two measured deletion hazards, zero reach).
- **Gates:** `npm run compile` clean; `npm test` 2,875 passing / 66 files. No runtime behaviour changed,
  so no runtime gate (stated in the receipt, not skipped).
- **Model:** Claude Opus 5.

### 2026-09-11 · [BACKLOG: SHIPPED CODE DELETES A RENDERED HEADING: six of the nine readers have no `fenced_divs`, and the CALLOUT rule fires there anyway] The callout reader gate — 36 rendered losses fixed, no heading removed anywhere, and everything it un-masks filed

- **Operator-picked at Phase 0** (option 1 of 4, the recommended one); claimed 2026-09-10 in
  `468b310a`.
- **The fix (`ec1e1cfa`), strict TDD.** `calloutTitleTakes` now reads `fencedDivsDialect`, the flag
  the tabset rule has read since Session 258. RED first: R1 failed with `[Before, After]` where
  quarto renders `[Before, Inside, After]`, under every one of the six readers with no fenced divs.
  One condition of logic; the rest is tests, comments and records.
- **Measured before and after through quarto 1.7.33, against a baseline worktree at the parent
  commit:** 71 documents (`scratchpad/s261/rdr`, `tight`, `ext`, and the filed witness
  `s258/fix/d2`) — 36 LOST → AGREE across the ATX, setext, bare-word and glued spellings and the
  extension and quoted forms of the reader; 1 AGREE → PHANTOM, the disclosed push case. A two-build
  census over the 3,383 authored documents changed 0 of 28,103 headings: only 6 declare any
  `from:`, all of them readers WITH fenced divs, so the fix's reach in this corpus is zero.
- **Guards (`8b5884f5`, widened in `0f5ddff7`):** R2–R7, each tied to a render. A six-mutant harness
  (`scratchpad/s261/mutate.py`, a no-op control among them) kills every row, and every mutant is
  killed by at least one row. Plus the runtime row in `test/integration/suite/outline.test.ts`.
- ⚠ **A 157-agent adversarial certification — six lenses, 331 probes, 150 refuter verdicts, a
  completeness critic — and then every probe and twin re-rendered by the main session (1,419).** It
  reported 75 findings as introduced. All 75 reproduce, and none is new wrong logic: each is a shape
  whose PLAIN-DIV twin is wrong the same way in both builds — the title rule used to swallow the
  heading and so masked the error — or a front-matter resolver misread. The gate removed no heading
  anywhere. The comment that said the push "shows through in ONE measured place" was wrong and is
  corrected (`0f5ddff7`), with R6 widened to `+blank_before_header` and R7 pinning the duplicate-
  anchor misread in both directions.
- **Filed, not fixed.** The push-under-reader defect is carried into the existing "`divColumns` is
  pushed for `:::` lines that are not divs at all" item, which the completed item named as the wider
  defect. Three new items: the reader resolver's misreads (a dozen shapes, both directions); six
  pre-existing heading losses found beside the callout rule; five pre-existing phantom and text
  families. The completed item is removed from the head of "Up Next".
- **Runtime gate — satisfied, operator-authorised before it took the screen, and run last.**
  `npm run test:integration` launched a real VS Code Extension Development Host: **545 passing,
  exit 0** — Session 260's 544 plus this session's outline row, which drives
  `vscode.executeDocumentSymbolProvider` on a `from: gfm` callout and its default-reader twin. It ran
  only after every render and the mutation harness had finished, behind guards that refused to
  start it with a dirty `model.ts` or a live render; the one later edit to `model.ts` is a
  comment's count.
- **Records:** learnings #525–#530; the oldest `SESSION_NOTES.md` pair dropped in its own
  deletion-only commit (`c96e6a81`).
- **Commits:** `468b310a` claim · `ec1e1cfa` fix · `8b5884f5` guards · `0f5ddff7` corrected comment +
  pins · `c96e6a81` notes trim · `6e1b0601` records (the filings, learnings #525–#530, one
  comment's count) · the close-out commit carrying both ledgers.

### 2026-09-10 · [ad hoc] Session 260 — finish the close-out Session 259 abandoned: runtime gate closed, the fix certified, a regression found, and five root-cause items filed

- **Operator-picked at Phase 0** (option 1 of 4) after this session's reconcile found Session 259
  dead before Phase 3. The ledger half was repaired at Phase 0 — see the backfill entry below,
  written by this session in `7739ddd2`. This entry records everything else a close-out owed.
- **Runtime gate — satisfied, not waived, operator-authorised first.** `npm run test:integration`
  launched a real VS Code Extension Development Host against Session 259's shipped `findHeadings`:
  **544 passing, exit 0**, including the Session 257 and 258 outline rows that drive
  `vscode.executeDocumentSymbolProvider`. No code changed this session, so it ran against exactly
  what Session 259 shipped.
- **Session 259's fix is certified against its original witnesses, firsthand.** Session 258's
  rendered witnesses `d3`/`d4` now AGREE with quarto, and a baseline worktree at `efd5f478` rebuilt
  this session reproduces the deletions they were filed for.
- ⚠ **A seven-lens adversarial certification pass found that Session 259 introduced a deletion
  regression of its own.** 66 findings, every one rendered through quarto 1.7.33 and re-run by a
  refuter, and then every one re-rendered by this session: all 66 reproduce, 65 with exactly the
  claimed direction and origin, and the one mislabel is a finder's "phantom" that is really a
  deletion. 39 deletions (7 introduced, 32 pre-existing) and 27 phantoms (16 introduced, 11
  pre-existing). Seven are deletions the BASELINE did not make, and six share one root cause:
  `maskQuotedValues` pairs quotes blindly, so an escaped quote or a literal apostrophe in an
  unquoted value blanks a real `title=`, and the title lookup Session 259 moved onto the mask
  finds nothing. The seventh is an opener pandoc refuses outright, which the same change
  exposed. Session 259 bought a phantom fix with a deletion.
- **Filed, not fixed, by root cause — five items for 66 findings**, at the head of `BACKLOG.md`
  "Up Next" under the existing reader-gate item: the tabset reads that never got Session 259's
  fixes (the three residuals its commits said were filed and were not, plus an asymmetry Session
  259 created at `model.ts:4181` vs `:4245`); the `maskQuotedValues` regression; `.content-visible`
  winning quarto's class dispatch (read firsthand at `main.lua:1147-1155`); the callout first-block
  test ignoring containers; and the attribute spec never being tokenized as pandoc tokenizes it.
- **Removed the item Session 259 solved** from the head of "Up Next", where every future Phase 0
  would otherwise have ranked a fixed defect first.
- **Five learnings, #520–#524**, none of which existed: a commit saying "filed" is not a filing;
  a guard's stated reason no probe separates is an assertion (Session 259's own best move);
  routing a read through a normaliser inherits the normaliser's errors; a dead session loses its
  verification, not only its paperwork; a harness hard-coding a session temp path dies with it.
- **Gates.** `npm run compile` clean; `npm test` 2868 passing / 66 files; `check-backlog` OK;
  `check-package` OK, 42 files / 5.60 MB, roots unchanged.
- **Commits (5).** `7739ddd2` the Phase 0 reconcile · `e2825dcc` claim · `08ceabd4` the records
  (five backlog items and learnings #520–#524; its title says "six root causes" because the tabset
  item carries two — the inherited holes and Session 259's own `:4181`/`:4245` asymmetry) ·
  `8e6546a6` the SESSION_NOTES trim, deletion-only as CLAUDE.md requires · and the close-out
  commit, which carries this line AND both ledgers, so both frontiers land at `HEAD` together.
- **Non-commit actions.** Ran `npm run test:integration` on the operator's screen, authorised
  first; ran a 73-agent certification workflow; removed this session's baseline worktree and
  pruned Session 259's dead one (`git worktree prune`), whose directory no longer existed.
- **Context budget.** All four over-ceiling files grew and none was reduced. `HANDOFFS.md` has now
  been over its ceiling at eight consecutive close-outs.
- **A correction to this session's own records commit.** `08ceabd4` cited the class-terminator
  lens's probes under a directory named "classterm", which never existed — they are in
  `scratchpad/s260/boundary/`. Caught by checking every cited path before close-out; fixed in the
  close-out commit.
- **Model:** Claude Opus 5.

## 2026-08

### 2026-08-27 · [ad hoc] Backfilled (reconcile-on-read): undocumented commits `9d0aecd4`..`f6c8ee3e` — Session 259 shipped the callout attribute-value fix and then ended without any close-out

- ⚠ **This entry is a Phase 0 reconcile written on 2026-09-09, not a close-out.** Session 259
  claimed the task, authored five commits, and left **no** `CHANGELOG.md` entry, **no** completed
  `HANDOFFS.md` receipt (its 1B stub is still `status: pending`), no `SESSION_NOTES.md` close-out
  pair, no `PROJECT_LEARNINGS.md` rows, and did not remove the completed item from `BACKLOG.md`.
  The commits are summarised from their own messages and from the artifacts in
  `scratchpad/s259/`; nothing here is a claim this session verified beyond the gates named below.
- **What the commits did — `BACKLOG.md` "Up Next" head item, the HIGH heading-DELETING defect
  filed by Session 258 against Session 257's shipped `divCalloutTitleSlot`.** The predicate tested
  its two class patterns against the WHOLE attribute spec, so any `.callout…` substring anywhere in
  that spec read as a class and deleted the heading below it.
- **The filed item called the fix "one token"; the commit message reports it is three** — a leading
  token boundary `(?:^|[\s{])`, a trailing terminator `(?=[\s}]|#[\w:.-])` (a `.` is an identifier
  character to pandoc, so `{.callout-note.foo}` is ONE class literally named `callout-note.foo`),
  and `maskQuotedValues()`, because a quoted value may hold a token that is whitespace-delimited on
  both sides (`data-x="a .callout-note b"`) that no boundary test can distinguish from a class.
- **A fourth commit reversed a guard's stated reason after mutation refuted it.** Mutant M8 swapped
  the mask's filler for a space and flipped nothing; the probe built to separate the claim showed a
  closing quote OPENS the next token rather than ending one (`::: {.note x="q".callout-note}` is a
  real callout, rendered), so masking the quotes away had introduced a phantom two commits earlier.
  The boundary is asymmetric: a quote may PRECEDE a class, it may not TERMINATE one.
- **Evidence recorded in the commits.** A 43-probe grid rendered through quarto 1.7.33
  (`scratchpad/s259/probes`), both builds run side by side from a worktree at the parent commit:
  baseline **25 divergent (24 deletions + 1 phantom) → 3**. The 3 that remain are Session 258's
  shipped `divPanelTabset` carrying the same two holes (h1/h3/k1) — **and, contrary to the commit
  messages' "filed, not fixed", no `BACKLOG.md` item for them exists; the filing never happened.**
  Strict TDD is claimed per commit with the RED rows named (R1–R10, R3/R5/R7/R9 as controls).
- **Gates re-run at this reconcile, 2026-09-09, on the tree as committed:** `npm run compile`
  clean, `npm test` **2868 passing / 66 files**, `node check-backlog.js` OK (198 open). No runtime
  smoke test (Phase 3E) is recorded by Session 259 and none was run here.
- **Commits (5).** `9d0aecd4` claim · `23231f40` the token boundary, the terminator and the value
  mask (R1–R5) · `bd1382db` the `title=`-inside-a-value read (R6–R7) · `0a6b72a0` the closing-quote
  asymmetry, found by mutation (R8–R10) · `f6c8ee3e` the comment correction, no behaviour change.
- **Model:** Claude Opus 5 (Session 259); reconciled by Claude Opus 5 (Session 260).

### 2026-08-26 · [BACKLOG: EVERY heading inside a `::: {.panel-tabset}` is a TAB LABEL] The panel-tabset tab-label divergence — 21 authored documents fixed, 0 regressions

- **Shipped the rule.** Every heading at a `.panel-tabset` div's TAB LEVEL is a tab label, not a
  heading: quarto's filter puts its inlines in an `<a role="tab">` nav link and emits no `<hN>`.
  `findHeadings` reported all of them, so the Outline offered sections the reader never sees.
- **The rule is quarto's own code, not an inference.** `parse_tabset_contents`
  (`/Applications/quarto/share/filters/main.lua:21643`) takes the FIRST `Header` among the div's
  DIRECT blocks, freezes its level, and makes a tab of every direct-child `Header` at EXACTLY that
  level. Three consequences the filed item did not state, each rendered before any code was written:
  the tab level is the FIRST heading's level and **not** the shallowest (`### First` / `## Second`
  renders `h2:Second`); the test is EQUALITY and not `level <= tabLevel` (a `#` between two `##`
  tabs renders as a real `h1`); and tab-hood is a CONTAINER test, so a heading inside a nested div,
  list item or quote is real at the very level its siblings were consumed at.
- **Measured over Session 251's 3,383-document authored corpus**, baseline regenerated from the
  parent commit in a throwaway worktree: structural divergence **80 → 59 documents**, agreement
  **96.72% → 97.58%**, **21 fixed / 0 regressed**; at heading granularity **151 removed, 0 added,
  and 0 of the removals are headings quarto renders**, with 0 newly-introduced losses across all
  2,438 scored documents.
- ⚠ **My own adversarial pass found ELEVEN category-A defects in code that had already passed a
  90-document rendered grid, 2,844 unit tests and the corpus score.** The shape: S257's callout rule
  claims ONE line, so every pre-existing "the div stack is wrong here" defect cost at most one
  heading — a tabset claims EVERY heading at its tab level for as long as the entry lives, which
  turns each of them into an unbounded deletion. Four fixes, each driven RED first: a div opened
  inside a QUOTE now dies with the quote (it was deleting headings in *later* quotes, three in one
  witness); a div naming BOTH a callout and a tabset is resolved by CLASS ORDER; the tab level is
  learned only from the div's FIRST CONTENT LINE (the fail-safe against a phantom heading, or a real
  `Header` this model cannot see, setting the wrong level); and the six readers without
  `fenced_divs` have no div to suppress.
- **Closed two long-standing pinned residuals as a side effect**, re-rendered to confirm: Session
  229 R5 and Session 233 R1 — a div opened inside a quote and "closed" outside it. Both assertions
  are reversed in place.
- **Evidence.** A 117-document rendered grid (103 agree, **0 lost**, 12 disclosed phantoms, 2 quarto
  errors) and TWELVE mutants that each redden the shipped rows — `scratchpad/s258/mutate.py`,
  `mutate_tests.py`. Runtime gate satisfied: `npm run test:integration` **544 passing, exit 0**,
  including a new `outline.test.ts` row driving `vscode.executeDocumentSymbolProvider`.
- **Commits (6).** `5da87bc5` claim · `80fce2da` the rule, 27 unit rows and the runtime row ·
  `e12cb34b` the four post-adversarial fixes · `d519f434` the records · `3c1f2dda` close-out ·
  plus the both-ledgers commit and a final telemetry append (`.context-budget-history.jsonl`,
  `dashboard_history.jsonl`), folded into the same commit as this line so BOTH frontiers stay at
  `HEAD`. ⚠ **A LEDGER CANNOT RECORD THE COMMIT
  THAT FOLLOWS IT**, so whichever of `CHANGELOG.md` / `HANDOFFS.md` moves last is the only one
  with a zero frontier — touch BOTH in the final commit or the next Phase 0 reconcile chases a
  phantom gap (inherited from Session 257, and it held).
- **Model:** Claude Opus 5.

### 2026-08-26 · [ad hoc] File four items and annotate two, from Session 258's measurements

- **Two are HIGH and both are heading-DELETING defects in code that already ships** (Session 257's
  callout rule), each rendered firsthand and neither fixed here, to hold 1-and-done:
  `divCalloutTitleSlot` matches its class name inside an attribute VALUE
  (`::: {.note data-x=".callout-note"}` deletes a real heading; the `title=` spelling is masked,
  which is why it survived review), and the callout rule fires under the six readers that have no
  `fenced_divs`. Session 258 fixed its own half of the second one and left the flag ready to read.
- Also filed: the tabset PREAMBLE residual (a decision, with the 0-of-68 measurement behind it), and
  the `divColumns` pushes for `:::` lines that are not divs.
- Annotated the raw-HTML div item to cover BOTH rules rather than being filed twice, and the
  format-gated `.content-hidden` item with the measurement that a tabset's labels ARE real headings
  under `--to latex` and `--to gfm` — a second member of that same undecided question, already
  shipped.
- **Model:** Claude Opus 5.


### 2026-08-26 · [ad hoc] Relocate Session 257's 28 ground-truth witnesses to the path they are cited at

- ⚠ **The 23 distinct `scratchpad/s257/probes/p<N>` citations written into `src/`, the tests and all
  three record files pointed at files that did not exist** — the probes had been rendered in `/tmp`,
  which would have erased them before the next session read a word. Found by executing Phase 3F's
  *verify cross-references added this session* bullet literally, **after** the close-out commit.
  `git diff` cannot surface this: it shows the citation added, never the destination not created
  (Learning #7's shape; recorded as #514).
- All 28 `.qmd` sources plus their rendered `.html` now sit at the cited path with a `README.md`
  table naming what each one pins. Every cited name verified to resolve. The witnesses are
  untracked, matching this project's long-standing convention for `scratchpad/` evidence.

### 2026-08-26 · [BACKLOG: A heading inside a CALLOUT is consumed as the callout's title] The callout title slot — 44 authored documents fixed, 0 regressions

- **The defect.** Quarto's callout filter lifts a callout div's FIRST BLOCK, when it is a header,
  into the title bar: it emits no `<hN>`, no `<section>` and no `sec-` anchor for it. An `@sec-`
  reference to such a heading renders as quarto's unresolved `<strong>?@sec-hotel</strong>`.
  `findHeadings` reported the heading anyway, putting a section in the Outline the reader never
  sees — and offering a cross-reference target quarto cannot resolve. Filed by Session 205, ranked
  #1 by real-document reach by the Session 251 audit, unfixed for 52 sessions.
- **The measured result, over Session 251's 3,383-document authored corpus.** Structural
  divergence **124 → 80 documents**; structural agreement **94.91% → 96.72%**. **44 documents
  fixed, 0 regressed.** At heading granularity: **138 headings removed, 0 added, and 0 of the
  removals are headings quarto actually renders** — no deletion in the forbidden direction. 29 of
  the 138 sit in 20 documents quarto itself refuses to render (exit ≠ 0), so they are unscorable
  and disclosed rather than counted. Baseline regenerated from the parent commit in a throwaway
  worktree rather than read from S251's stored census, which was several model changes stale.
- **The rule is narrow, and every boundary was rendered before it was coded.** It fires only when
  the heading is the callout's own first block: a paragraph, code block, thematic break, HTML
  comment or nested div above it all defeat the lift, and only the FIRST heading is taken — a
  second one in the same callout is a real heading. It keys on a closed set of types
  (`note`/`tip`/`warning`/`caution`/`important`) plus **bare `.callout`**, which renders
  `callout-none` chrome and lifts a title exactly as the named five do — the one member Quarto's
  own documentation would not predict. `.callout-bogus` and `.note` are not callouts at all.
  ⚠ **A NON-EMPTY `title=` takes the slot and the heading then SURVIVES**, but `title=""` and
  `title=''` do not, and `title="   "` does — the gate is an empty quoted value, not the presence
  of the attribute. That last one was found by an adversarial verifier attacking the first cut of
  the predicate, and re-measured firsthand before it was believed.
- **Disclosed residual, declined on a measurement.** The filed item names two spellings and this
  closes one. The RAW-HTML form (`<div class="callout-note">`) really does render a callout and is
  still a phantom — but **244 of the 3,383 authored documents carry a fenced callout div and ZERO
  carry a raw-HTML one**, and closing it needs a `<div>`/`</div>` container the scanner does not
  have. Re-filed in `BACKLOG.md` with that measurement and pinned live as guard G12, so the
  phantom is asserted rather than forgotten.
- Also closes **two disclosed-residual pins** that Sessions 193 and 215 each filed against this
  exact phantom, and files two new items: the format-gated `.content-hidden` / `.content-visible`
  divs (NEW, unfiled — quarto deletes the whole block, but the answer is target-format-dependent,
  so the decision is the hard part) and the negative result recording the twelve div classes
  measured NOT to consume a heading, `.tabset` among them.
- Strict TDD: R1–R4 each shown RED before GREEN, R4 twice. 19 new assertions plus a drift gate
  asserting `model.ts`'s `CALLOUT_TYPES` equals `notebook-callout.ts`'s `CALLOUT_TITLES` key set.
  `npm test` 2817 / 66 files; `compile` clean; `check-package` OK 42 files / 5.60 MB;
  `check-backlog` OK 195 open.
- **The runtime gate was SATISFIED, not waived** — operator-authorised, since it takes over the
  screen. `npm run test:integration` launched a real VS Code Extension Development Host:
  **543 passing, exit 0**, including a new `outline.test.ts` row that drives
  `vscode.executeDocumentSymbolProvider` — the command the Outline view itself calls — and
  asserts the lifted heading is absent, a SECOND heading in the same callout is present, the
  headings outside it are present, and the same document with a non-callout class keeps its
  heading. Commits (7): `e7dd276e` claim, `a80a6de8` the rule, `ae9e8d94` the empty-title
  correction plus guards and gate, `c89b9608` the runtime test, `27485730` the records
  (BACKLOG/learnings), `2e6cab8c` close-out, `45e1e515` the commit list, and this both-ledgers commit.

### 2026-08-26 · [ad hoc] `SESSION_NOTES.md` is TRANSIENT, not append-only — retention rule added to `CLAUDE.md`

- A reduction with no rule attached regrows; this file had already been drained twice under an
  instruction to *"keep it clean"*. `CLAUDE.md` now carries the rule: **at Phase 3D, after writing
  your own close-out pair, delete the oldest so the live file holds at most three.** Three is the
  steady state, not a target — you write one and drop one, so the count never moves (~240 of the
  400-line ceiling).
- ⚠ **The root cause is a contradiction in canonical's own seed**, not local sloppiness.
  `../methodology/starter-kit/SESSION_NOTES.md` says at line 5 *"This file is transient — it is
  overwritten every session"* and at line 27 *"Session history accumulates below this line."* Those
  cannot both be followed. This project followed line 27 for **256 sessions**. Canonical's own repo,
  110 sessions of dogfooding, has **no `SESSION_NOTES.md` at all**, and its manifest
  (`bin/_manifest.py:120`) states the file *"is rewritten wholesale every session"*.
- Learnings `PROJECT_LEARNINGS.md` #506–#508 recorded. Session 256 close-out; predecessor scored
  7/10, self-score 8/10. Five commits: `3e1cf42f` claim, `b06ac6b2` trim (deliberately pure),
  `75bddb56` packaging guard, `b688d8b3` close-out, and this ledger commit.

### 2026-08-26 · [ad hoc] Deny `__pycache__/` in the packaging and git ignore lists

- ⚠ **The 5th instance of the new-root-file class** (Sessions 173, 174, 188, 255): `check-package`
  went RED at 43 files. Establishing *why* `methodology_trim.py` refuses `SESSION_NOTES.md` meant
  importing it as a module rather than shelling out, which drops a `__pycache__/` at the repo root.
  `vsce ls` obeys `.vscodeignore`, not `.gitignore`, so it was packaged.
- Denied in **both** ignore files rather than merely deleted — the three methodology tools at the
  root are Python, so the next session that imports one recreates it. Back to OK: 42 files,
  5.59 MB, roots unchanged.

### 2026-08-26 · [ad hoc] Reduce `SESSION_NOTES.md` → `docs/archive/SESSION_NOTES-through-S253.md` (738 record(s), 3,949,501 B → 13,454 B)

- The file Phase 0 step 2 **orders every session to read** stood at 3,949,501 B / 13,942 lines
  against a 120,000 B / 400-line ceiling — 33x over, and larger than both ledgers combined before
  the Session 254 trim. Now **13,454 B / 172 lines**, a 99.66% reduction. Retained: front matter,
  `## ACTIVE TASK`, and the two most recent close-out pairs (Session 255's and Session 254's).
- ⚠ **`methodology_trim.py` could not do this, and that is a property of the tool, not an omission.**
  `--file SESSION_NOTES.md --check` exits 3 with `NO_CONFIG`: its `LEDGERS` table
  (`methodology_trim.py:186`) holds exactly two entries and it reads **no config of any kind** —
  no env var, no config file, no plugin hook (searched exhaustively). Nor could a `LedgerSpec` be
  written for it: `date_of_record` is REQUIRED and `evaluate()` freezes the oldest **by date**,
  while **458 of the file's 740 records carry no date at all** and only 88 of 740 headings carry
  one. Its reduction axis is the **session number**. And the tool is canonical-owned (TRACKED in
  `bin/_manifest.py:50`), so the table cannot be edited locally anyway.
- **This is upstream BL-32, already open and undecided** (raised 2026-08-11) — *not* filed as new.
  Canonical met the identical wall on its own `BACKLOG.md` and answered it the same way: reduce by
  hand, prove it with an **identity-keyed** check. This shard is a second data point under BL-32.
- **Losslessness proved by a hand-written, self-locating check** —
  `docs/archive/SESSION_NOTES-through-S253.md.verify.sh`, C0–C6, modelled on canonical's
  `BACKLOG-archive-2026-08-15.md.verify.sh`. It is keyed on each record's own heading identity,
  never on position, so it cannot fail the way four of six upstream proofs do (BL-36). Records are
  byte-identical — deliberately **not** link-rebased, so C2/C3 are true byte identity rather than
  identity-modulo-a-transform; stated cost is that relative links inside archived records resolve
  against the repo root.
- **Written test-first.** The proof was authored before the split existed and driven RED through six
  injected defect classes (dropped record, edited record, duplicated record, swapped halves,
  false count, tampered front matter). That RED pass found **three real defects in this session's
  own tooling** — an off-by-one trailing newline that gave the last archived record a byte the
  original never had, a proof that crashed instead of reporting FAIL, and a corruption mode that
  never reached the check it targeted. All three fixed, then GREEN: C0–C6 pass, 743 records =
  5 retained + 738 archived, byte accounting exact.

### 2026-08-26 · [ad hoc] Session 255 — this project was not a current adopter; sync, install, gate, and file upstream

- **Session span:** 2026-08-26 (commits `3aea788e`..close-out). **Model:** Claude Opus 5. **Methodology adoption.** Operator directive: *"do it all in one session"*, plus the question *"should we place a backlog item in `../methodology` … or are the corrections already there?"*
- **Origin.** S254's close-out asked whether corrective actions existed. Comparing this repo against `../methodology/bin/_manifest.py` (26 rows) showed **we were not a current adopter**: **2 files missing** (`context_budget.py` TRACKED, `.context-budget.json` SEED) and **6 TRACKED files drifted** (`SESSION_RUNNER.md`, `FRAMEWORK_LEARNINGS.md`, `RECOMMENDED_SKILLS.md`, `BOOTSTRAP.md`, `methodology_dashboard.py`, `methodology_trim.py`). The 4 differing SEED files are *supposed* to diverge; 14 rows were byte-identical.
- ⚠ **LEARNING #499 WAS ALREADY SOLVED UPSTREAM AND I WAS ABOUT TO REBUILD IT.** `context_budget.py`'s own docstring: *"MEASUREMENT ALONE WAS ALREADY PRESENT AND DID NOT WORK … So this tool GATES … rather than a second thing to print."* Canonical's config governs both ledgers at **`max_bytes: 65536`** — the same constant `methodology_trim.py` uses. Upstream the two tools are a **pair**; we had one. (Learning #503.)
- ⚠ **THE DRIFT WAS INVISIBLE BY CONSTRUCTION.** An adopter may not edit these files, so zero local edits means `git status` is silent — six files stale and two never installed, with no signal anywhere. `bin/sync` needed **no `--force`**; it distinguishes *behind canonical* from *locally modified*, correcting what I had told the operator from the docs rather than from `--dry-run`. (Learning #504.)
- **`methodology_trim.py` v1.1.1 → v1.3.0**, which fixes **BL-27**. Both shard proofs regenerated and **both now PASS** — including `HANDOFFS-through-2026-08-24.md.verify.sh`, the one known-bad artifact S254 shipped deliberately. **That is a third independent confirmation the S254 trim was lossless, from the very artifact that had claimed otherwise.** BL-41 turned out to change only *collision* handling (`-2`, `-3`, …) and renames nothing existing — correcting my own earlier characterisation of that sync as risky.
- **`SESSION_RUNNER.md` changed mid-session and was diffed before continuing under it.** It adds **failure mode #28, "Unbounded mandatory read"** — the general form of what S254 fixed by hand — and a degradation row that is Learning #499 as protocol: *"The signal is not missing — nothing gates on it. Do not add a second report. Add a gate."*
- ⚠ **THE NEW GATE IMMEDIATELY FOUND SOMETHING BIGGER THAN THE S254 TRIM.** `SESSION_NOTES.md` is **3,946,063 B / 13,912 lines** against a 120,000 B ceiling — **larger than both ledgers combined before the trim** — and it is the file Phase 0 step 2 *orders* every session to read. Sessions 254 and 255 each read ~160 lines and inferred the rest: **failure mode #28, committed twice by the sessions that documented it.** Also over: `PROJECT_LEARNINGS.md` 950,857 B and `BACKLOG.md` 284,130 B. **Ceilings deliberately not raised** — raising one to silence a warning records the problem as the standard.
- **Configured, not left as the generic seed:** `LEARNINGS.md` → `PROJECT_LEARNINGS.md`; `CHANGELOG.md`/`HANDOFFS.md`/`BACKLOG.md` added as read-mandated at 65,536; `synced` expanded 2 → 10 entries so the drift above can never again be invisible; `protected_min_bytes` 800 → **700**, derived from this project's 732 B purpose statement rather than inherited, and that statement fenced in `CLAUDE.md`.
- **`check-package` FAILED exactly as predicted at claim** — `context_budget.py` and `.context-budget.json` are new root files and `.vscodeignore` is a **denylist**. Fourth instance of the S173/S174/S188 class. Three denylist lines added; back to **OK, 42 files / 5.59 MB**, roots unchanged.
- **UPSTREAM (`../methodology`, commit `1674b2a`) — the answer to the operator's question was BOTH.** Already fixed there and flowing on a push: **BL-27**, **BL-41**. ⚠ **And one finding was already filed as BL-46**, raised 2026-08-25 from a cross-repo sweep that names this repo and quotes its exact error — I nearly duplicated it. **BL-46's half (1) is this project's work and S254 completed it**, annotated in place. ⚠ **Its proposed remedy is too narrow and only we could show it:** BL-46 says the adopter *"never deleted"* the sentinel; we **had** — the trimmer refused because of the **trailing `---` and comment**, which the seed never mentions, so BL-46's sentinel-keyed detector **would not have fired here**. Three genuinely new items raised after checking each for duplicates: **BL-47** (seed budget config omits the two ledgers the trimmer bounds), **BL-48** (seed `HANDOFFS.md` lacks the count sentence its own `LedgerSpec` declares), **BL-49** (`content_probe` runs only at zero records, so a partial grammar mismatch freezes a wrong published span — the S254 shard labelled `2026-06-30` whose true oldest entry is `2026-06-27`). (Learning #505.)
- ⚠ **NOT DONE, deliberately:** **nothing was pushed.** `../methodology` is 398 commits ahead of `upstream/main`; `origin` is the fork, `upstream` is `KJ5HST/methodology`. A PR is outward-facing and needs the operator's explicit go-ahead. Also not done: reducing `SESSION_NOTES.md`, `PROJECT_LEARNINGS.md`, `BACKLOG.md` — now *gated* rather than invisible, and the named next deliverable.
- **Phase 3E: NOT APPLICABLE**, stated rather than skipped — synced documents, config, denylist lines. No `src/` change. Both new tools were RUN, which is the meaningful smoke test here.
- **Verification.** `npm run compile` clean · `npm test` **2796 passed / 66 files** · `check-package` **OK 42 / 5.59 MB** · `check-backlog` **OK 193 open items** · `methodology_trim.py --check` **does not fire** on either ledger · both regenerated `verify.sh` **OK** · upstream `BACKLOG-DETAIL.md.verify.sh` **OK, C1–C5 green**.
- **Backlog:** 193 → **193** (this was adoption maintenance, not a backlog item). Upstream: 23 → **26** open items.

### 2026-08-26 · [ad hoc] Ledger trim: `HANDOFFS.md` → `docs/archive/HANDOFFS-through-2026-08-24.md` (211 record(s), 1,801,150 B → 52,850 B)

**Written by:** `methodology_trim.py` v1.1.1 — a tool action, not a session's judgment.
Moved the oldest **211** record(s) (2026-07-09 → 2026-08-24) out of [`HANDOFFS.md`](HANDOFFS.md) into
[`docs/archive/HANDOFFS-through-2026-08-24.md`](docs/archive/HANDOFFS-through-2026-08-24.md). Losslessness is asserted by L1 (records-zone concatenation), L2 (zone
pinning) and L3 (record partition), and is **re-derivable** — run [`docs/archive/HANDOFFS-through-2026-08-24.md.verify.sh`](docs/archive/HANDOFFS-through-2026-08-24.md.verify.sh)
rather than trusting a digest printed here. Live file 1,801,150 B → 52,850 B (−97.1%).

### 2026-08-26 · [ad hoc] Ledger trim: `CHANGELOG.md` → `docs/archive/CHANGELOG-through-2026-08-24.md` (230 record(s), 831,830 B → 44,190 B)

**Written by:** `methodology_trim.py` v1.1.1 — a tool action, not a session's judgment.
Moved the oldest **230** record(s) (2026-06-30 → 2026-08-24) out of [`CHANGELOG.md`](CHANGELOG.md) into
[`docs/archive/CHANGELOG-through-2026-08-24.md`](docs/archive/CHANGELOG-through-2026-08-24.md). Losslessness is asserted by L1 (records-zone concatenation), L2 (zone
pinning) and L3 (record partition), and is **re-derivable** — run [`docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh`](docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh)
rather than trusting a digest printed here. Live file 831,830 B → 44,190 B (−94.7%).

### 2026-08-26 · [ad hoc] Session 254 — the trimmer was inert since bootstrap; both ledgers trimmed

- **Session span:** 2026-08-25 → 2026-08-26 (commits `fe4d029d`..close-out); dated by close-out, which crossed midnight.
- **Model:** Claude Opus 5. **Records maintenance.** Operator directive: *"lossless trim of `CHANGELOG.md` and `HANDOFFS.md`"*, with the diagnosis *"the trimmer has been inert since bootstrap — the seed-sentinel line was never deleted, so it refuses with `[ZONE_UNCLASSIFIED]`. 1.78 MB behind a one-line bootstrap miss, with the tool installed and reporting to nobody."*
- ⚠ **THIS ENTRY IS WRITTEN BEFORE THE TRIM, NOT AT CLOSE-OUT, AND THE TOOL IS WHY.** `methodology_trim.py` has a **P1 precondition** that refuses to trim while the undocumented set is non-empty: *"the undocumented set is non-empty (2 commit(s) since the ledger frontier `e8edafa`). A trim commit advances that frontier and would hide them PERMANENTLY. Reconcile first, then trim."* A trim moves the oldest records out of the live file, so the ledger frontier jumps — and any commit not yet recorded when that happens is not merely late, it is **unrecoverable by the Phase 0 reconcile**, whose whole method is `<frontier>..HEAD`. **Phase 3F's "record at close-out" and the trimmer's P1 are in direct tension, and P1 wins.** (Learning #498.)
- **The defect.** `HANDOFFS.md` ended with a standalone `---` and 113 B of orphaned seed comment — `<!-- Receipts go below, newest on top. Delete the seed-sentinel line above when you add the first one. -->` — sitting *below the oldest receipt*. The spec declares `footer_mode='none'` for this file and **asserts that declaration rather than assuming it**, so trailing content set apart by a separator is content the config cannot name, and the tool refused rather than sweeping it into a record that was about to move.
- ⚠ **IT HAS BEEN THERE SINCE THE FILE WAS BORN.** `git show 9f119c73:HANDOFFS.md` (2026-07-09, Session 38's methodology sync) already ends with that `---` + comment — **in the same commit that added the first receipt**, which is exactly the moment the comment instructs its own deletion. The `METHODOLOGY-SEED-SENTINEL` token itself is **already gone** from both ledgers, so the sentinel line *was* deleted and its separator and comment were not. A half-finished bootstrap, which is why it read as finished for 216 sessions.
- **Nothing was lost by deleting it.** Of the comment's two sentences, *"Delete the seed-sentinel line above"* is unsatisfiable (no sentinel exists) and *"Receipts go below, newest on top"* is already stated in the front matter — *"One `handoff` block per session (not per commit), newest on top."*
- ⚠ **THE TOOL WAS INSTALLED, FIRING, AND REPORTING TO NOBODY.** Session 188's sync recorded it verbatim as **"installed, not yet used"** and no session ran it in the 66 sessions since. Nothing in Phase 0 reads it, no test asserts it, and the dashboard does not surface it — so a refusal aimed at a one-line defect sat unread while both ledgers grew past their budget. **`CHANGELOG.md` 826,389 B (12.6×) and `HANDOFFS.md` 1,800,590 B (27×) against a 65,536 B budget**, both read at every Phase 0.
- ⚠ **A SECOND, UNRELATED DEFECT THE TRIMMER EXPOSED: TWO RECEIPTS WERE WRITTEN WITHOUT THEIR CLOSING FENCE.** S227 (line 418) and S226 (line 430), both 2026-08-19, each lack the bare ` ``` ` that terminates a `handoff` block. The record grammar is **fence-aware**, so the tool read **S227 + S226 + S225 as ONE merged record** — 216 record starts over a file holding **218** receipts. Swept the whole file: exactly these two, no others. Repaired by inserting the closer after each block's last field, matching the closer/blank/next-opener shape every well-formed receipt uses. **218 records now parse.**
- ⚠ **THE REPAIR HAD TO PRECEDE THE TRIM.** Both receipts date to 2026-08-19, inside the archive cut — trimming first would have **frozen the broken partition into an immutable shard** whose own record count was permanently wrong. Losslessness was never at risk (L1 asserts concatenation over the whole records zone, so a merged span moves intact); what was at risk was the **partition being true**. **NOT fixed, because it cannot be without fabricating content:** both receipts also lack `gotchas:` and `whats_next:`, which were never written.
- **A third bootstrap gap, same class as the first:** the config declares a regenerated front-matter field `retained receipt count` keyed to `(This file currently holds \*\*)(\d+)(\*\*)`; this file never had the sentence, so every run reported `FRONTMATTER_FIELD_ABSENT` — *"its value cannot be kept true. Add it, or remove it from the config."* Added the sentence to `HANDOFFS.md` rather than editing `methodology_trim.py`, which is **synced** and would block future syncs if edited locally.
- ⚠ **`grep -c '^```handoff' HANDOFFS.md` IS NOT A VALID RECOUNT — it reports 219.** It matches the worked example inside the 4-backtick documentation wrapper. My first draft of the count sentence shipped 219 for exactly this reason and was corrected to 218 before commit; the trap is now documented in the sentence itself, because the canonical repo's own count sentence drifted the same way (*"it read **3** from the S94 trim until this line was corrected"*).
- **THE TRIMS, both at a clean calendar seam (`--cut 2026-08-24`) rather than the tool's computed positional cut, which raised `CUT_STRADDLES_DAY` — the default would have named each shard `through-2026-08-25` while 2026-08-25 records stayed live, making the name a span label instead of a day boundary. The clean seam costs ~10 KB of live file and leaves both comfortably under budget.**
  - `CHANGELOG.md` **831,830 B → 44,190 B (−94.7%)**, 230 of 237 records to [`docs/archive/CHANGELOG-through-2026-08-24.md`](docs/archive/CHANGELOG-through-2026-08-24.md). `L1_OK` `L2_OK` `L3_OK` `P1A_OK` (ledger gained exactly one entry, 7 → 8).
  - `HANDOFFS.md` **1,801,150 B → 52,850 B (−97.1%)**, 211 of **218** receipts to [`docs/archive/HANDOFFS-through-2026-08-24.md`](docs/archive/HANDOFFS-through-2026-08-24.md). Retained S248–S254. `FRONTMATTER_FIELD_REGENERATED` count 218 → 7. **218, not 216 — the fence repair is what makes the partition true, and both repaired receipts are inside this shard.**
  - **Both triggers now DO NOT FIRE.** Combined **2,632,980 B → 97,040 B**, a 96.3% reduction in what every Phase 0 reads.
- ⚠ **ONE KNOWN-BAD ARTIFACT SHIPPED DELIBERATELY: `HANDOFFS-through-2026-08-24.md.verify.sh` REPORTS `FAIL`, AND THE FAILURE IS SPURIOUS.** *"L2 FRONT MATTER lost 1 line(s)"* — the regenerated count line. **Known upstream as BL-27 and already fixed in canonical v1.3.0**; this project runs **v1.1.1**, the pre-release UAT copy Session 188 installed. Root cause read in both versions: v1.1.1's `build_verify()` substitutes only `SHARD/LIVE/VER/INJECTED/KIND/START/INFO/FOOTER` and **never receives `spec.regenerated`**, while the in-process `assert_L2` *is* given the `reversals` list and replays it backwards — so the exported proof is strictly weaker than the check it claims to reproduce, and it fails in the direction that looks like corruption. It **cannot** fire on `CHANGELOG.md`, which declares zero regenerated fields — which is exactly why that shard's script passes and this one does not. Explained beside the artifact in [`docs/archive/README.md`](docs/archive/README.md). **Do not fix by editing `methodology_trim.py` — it is synced.** (Learning #501.)
- **LOSSLESSNESS ESTABLISHED THREE WAYS PER FILE, one sharing no code with the tool.** (1) the tool's in-process `L1`/`L2`/`L3`/`P1A`, asserted on the artifacts about to be written, not on the input partition; (2) `scratchpad/s254-verify.py` — an independent verifier with its own fence scanner, record splitter, code-span finder and link inverter — **8/8 PASS on both files**, including the **ORDERED record list compared byte-for-byte** against `git show <baseline>:<file>`; (3) the front-matter diff read by hand, confirming exactly the declared changes. The `CHANGELOG` shard's emitted `verify.sh` also **passes** (*"237 before = 7 retained + 230 archived"*).
- **The seam is proved ON THE ARTIFACTS, not from the absence of a warning** — retained and archived date sets do not intersect, the newest archived date equals each shard's name key, and the oldest retained date is strictly newer. (The canonical repo's own S107 receipt names *"a missing warning line is not evidence"* as the trap; applied deliberately here.)
- ⚠ **NOT DONE, and named rather than left implicit:** syncing `methodology_trim.py` to v1.3.0 and regenerating the failing script. v1.3.0 also changes shard naming (BL-41), so it is its own deliverable, not a drive-by. The two repaired receipts (S227, S226) remain **content-incomplete** — both lack `gotchas:` and `whats_next:`, which were never written and cannot be supplied without fabricating them.
- **ADVERSARIAL AUDIT: FOUR INDEPENDENT LENSES WERE TASKED WITH *REFUTING* LOSSLESSNESS, AND ALL FOUR FAILED TO.** Byte/line accounting, per-record identity+order, non-record scaffolding, and reconstruction from git history — each writing its own fence-aware extractor, importing nothing from `methodology_trim.py` or from my verifier. **No loss, no undeclared alteration, on either file.** The decisive shared result: concatenating each live records zone with its shard's reproduces the pre-trim records zone **byte-for-byte** (CHANGELOG 823,945 chars; HANDOFFS 1,791,612). 230/230 and 211/211 moved records byte-identical with **zero rebase insertions needed** — every eligible-looking link sat inside an inline code span or a fence, so the permitted mutation legitimately fired zero times. The full-history walk (286 revisions of `CHANGELOG.md`, 441 of `HANDOFFS.md`) located every sampled record. Byte arithmetic closed to **zero unexplained residual** on both trims.
- ⚠ **THE AUDIT FOUND TWO REAL SECONDARY DEFECTS THAT NO BYTE-LEVEL PROOF COULD SEE, BOTH NOW FIXED.**
  - **The CHANGELOG shard's published span is wrong at its old end.** Its `h1`, its own "Holds 230 record(s)" sentence and the live pointer block all say **2026-06-30 → 2026-08-24**; the content reaches back to **2026-06-27**. The record grammar is a date **plus a source tag** (`· [`), and the project's **six earliest entries predate that convention** — so they are not record starts, ride inside the oldest tagged record's span, and contribute to neither the count nor the computed span. **236 dated `###` headings, 230 counted records.** Nothing is missing; the *label* is wrong, and the label is the index people search. Corrected in [`docs/archive/README.md`](docs/archive/README.md), which is hand-owned; the shard header and pointer block are tool-generated and were left as written rather than hand-edited. (Learning #502.)
  - ⚠ **A WARNING I ADDED THIS SESSION WAS MADE FALSE BY MY OWN TRIM, TWO COMMITS LATER.** The `HANDOFFS.md` front-matter note said `grep -c '^```handoff'` *over-counts because it matches the worked example below* — but the trim moved that example into the shard, so the live file now has exactly 7 and the grep is **correct**. The sentence was actively telling readers to distrust a right answer. Rewritten to state the fence-aware rule, note that the grep agrees *today* and why, and keep the 219-vs-218 evidence. **A note about a file's contents can be invalidated by the very operation it was written to survive.**
- **Verification.** `npm run compile` clean · `npm test` **2796 passed / 66 files** · `check-package` **OK, 42 files / 5.59 MB** (roots unchanged) · `check-backlog` **OK, 193 open items** · `methodology_trim.py --check` **trigger does not fire** on either ledger (was: FIRES / refuses).
- **Phase 3E: NOT APPLICABLE**, stated rather than skipped — markdown records moved between files; no `src/` change, no runtime behaviour, nothing to launch. The gates above are the build equivalent.
- **Backlog:** 193 → **193** (0 closed, 0 filed — this was maintenance, not a backlog item).
- **Commits:** `fe4d029d` claim · `263521e1` seed-footer fix · `6a3a6e59` fence repair + count field · `5eec38df` pre-trim ledger record · `8326cdd9` CHANGELOG trim · `867e0fa2` HANDOFFS trim · `669b42e0` archive README · close-out.

### 2026-08-25 · [ad hoc] Session 253 — a severity premise the audit refuted, annotated in place

- **Session span:** 2026-08-25 (commits `aed7c9e1`..close-out); dated by close-out.
- **Model:** Claude Opus 5. **BACKLOG annotation.** Operator directive: *"Do not promote and make that one annotation."*
- **Deliverable:** one annotation on the `Indented (4-space) code blocks as a skip-region` item in "Polish / deferred". **Nothing moved, nothing promoted, nothing filed** — Up Next 67, Polish 126, total 193, all unchanged.
- **What it records.** The item justifies its severity as *"Low severity (uncommon construct)"*. Session 251's audit measures that construct in **180 of 3,383 authored documents (5.3%) — the highest construct count of all 192 items**. That half of the justification is refuted, and the original words are struck through rather than deleted so the supersession is visible.
- ⚠ **THE ANNOTATION ARGUES AGAINST ITS OWN HEADLINE NUMBER, WHICH IS THE POINT.** 180 is **construct presence measured with the WRONG INSTRUMENT for this item**: Session 251 scored `findHeadings` against `quarto render`, and this item describes a **CROSS-REFERENCE** defect (`{#fig-…}` inside an indented block indexed as a phantom label). The cross-ref surface was never measured, so the defect's real incidence is **UNKNOWN, not 180**. The 22 heading-divergent documents the construct co-occurs with are mixed-direction (12 phantom / 8 lost / 2 level) — the shape of coincidence, not cause. The annotation states what is owed before anyone sizes the item: measure the cross-ref behaviour over the real corpus the way headings were measured.
- **Origin — a flag of mine that did not survive reading the items.** At Session 252's close-out I raised 4 `REACHES_REAL` items sitting in "Polish / deferred" as a possible promotion, on their presence counts. Asked for the motivation, I read them: **three have ZERO divergent documents** (L437 13/0, L453 2/0 and explicitly *"accepted/documented Session 116"*, L441 0/0 and a cross-module refactor that `SAFEGUARDS.md` requires to go through plan mode — arguably mis-classified as `parser` by the audit). Only this one had any signal, and its signal is the wrong instrument. **Recommendation reversed to do-not-promote before the operator acted on it**; the operator confirmed. What survived is this annotation. (Learning #497.)
- **Phase 3E: NOT APPLICABLE**, stated rather than skipped — one sentence added to one markdown item; no runtime behaviour, no `src/` change.
- **Verification.** `check-backlog` **OK, 193 open items** · `npm test` **2796 passed / 66 files** · section counts unchanged at 67 + 126 = 193, confirming nothing moved.
- **Backlog:** 193 → **193** (0 closed, 0 filed, 0 moved, 1 annotated).

### 2026-08-25 · [ad hoc] Session 252 — the 90 enumeration-only items, downgraded with their measurement attached

- **Session span:** 2026-08-25 (commits `0d042777`..close-out); dated by close-out.
- **Model:** Claude Opus 5. **BACKLOG re-section.** Operator directive after reading Session 251's audit: *"downgrade them to Polish / deferred"*, with the annotation requirement raised as a question — *"will these include information that they do not touch document in our inventory?"* — answered YES and implemented.
- **Deliverable:** the 90 items Session 251 measured at **0 of 3,383 authored documents** moved from `BACKLOG.md` "Up Next" to "Polish / deferred", under a new `### Enumeration-only` subsection, each carrying a tag naming the measurement and its detector. **Up Next 157 → 67; Polish / deferred 36 → 126; total unchanged at 193.** No `src/` change.
- **Move and annotate only — nothing deleted, no item's own prose altered.** Verified as a SET comparison, not a count: all **193 item texts preserved byte-for-byte** modulo the appended tag. A count check would not have caught a loss — `check-backlog.js` counts `- [ ]` lines and would have reported 192 as happily as 193.
- ⚠ **THE DETECTOR FILENAMES ARE POSITIONAL AND THE BASE COMMIT IS NOT THE OBVIOUS ONE — THIS NEARLY MIS-TARGETED 83 OF THE 90 ITEMS.** `final.json`'s `line` field is each item's `BACKLOG.md` line number as read at the START of Session 251, i.e. `b85626f3`. Session 251 then FILED the panel-tabset item at line 52, shifting every line below it by +2 in its own close-out `b50e5f6b`. Items in this file sit exactly two lines apart (item, blank), **so resolving against `b50e5f6b` maps target k onto item k+1 — which is still a valid item start, and therefore resolves SILENTLY AND WRONGLY.** Only the 7 targets that happened to land on non-item lines tripped the "is it an item start" guard; the other 83 would have been mis-tagged. Caught by an INDEPENDENT cross-check of each resolved line against the title `final.json` recorded for it. This is precisely the hazard `BACKLOG.md`'s own header documents — *"any insertion above a cited line silently retargets it at a different item, which is worse than a broken link because it still looks valid"* — met in practice, by the session that had just written an audit about it. (Learning #496.)
- **What each moved item now carries:** `⚠ **ENUMERATION-ONLY (S251): 0 of 3,383 authored documents** — detector \`scratchpad/s251/det/<N>.py\`. Downgraded from Up Next by Session 252; see the section note above.` The method, the caveats and the promotion route are stated ONCE in the subsection note rather than repeated 90 times.
- **The subsection note is explicit about what the claim is NOT** — construct absence in ONE corpus (3,383 files but only 2,026 distinct basenames, one machine, R-centric), not a finding that any item is wrong; and it gives the promotion route: show the construct in a document someone wrote and move it back. Session 251's own adversarial pass cleared that bar six times.
- ⚠ **THE MOVE MADE ONE CROSS-REFERENCE STALE AND THE PHASE 3F SWEEP CAUGHT IT.** `BACKLOG.md`'s "Active" section names four "Remaining candidates"; the **quoted-KEY CONTAINER half** and its cell-option twin are two of them, and both are among the 90. The pointer now says so, and a new **Ranking guidance** note beside it records the audit's finding — rank by real-document reach, not enumerated document count. Verified before/after against the pre-move copy, so "stale" is a measurement rather than a guess: the other three named candidates are unmoved.
- **Deliberately NOT done:** the 4 `REACHES_REAL` items already sitting in "Polish / deferred" — the mirror-image problem — were left alone. Promoting them is the opposite action and was not asked for; raised for the operator instead.
- **Phase 3E (runtime smoke test): NOT APPLICABLE and stated rather than skipped.** One markdown file re-sectioned; no runtime behaviour, no `src/` change, nothing to launch.
- **Verification.** `check-backlog` **OK, 193 open items** · `npm test` **2796 passed / 66 files** (`backlog-hygiene-gate.test.ts` runs on every `npm test`, so the file is asserted twice) · set-equality of all 193 item texts before/after · section counts 67 + 126 = 193. Pre-move copy preserved at `scratchpad/s251/BACKLOG.md.pre-downgrade`.
- **Artifacts:** `scratchpad/s251/downgrade.py` — the move, with `--check` dry-run, the title cross-check that caught the off-by-two, and a set-equality postcondition.
- **Backlog:** 193 → **193** (0 closed, 0 filed, 90 re-sectioned).

### 2026-08-25 · [ad hoc] Session 251 — which backlog items touch a document a human wrote

- **Session span:** 2026-08-25 (commits `52b04173`..close-out); dated by close-out.
- **Model:** Claude Opus 5. **AUDIT**, `docs/methodology/workstreams/AUDIT_WORKSTREAM.md`. The operator DECLINED all five of Session 250's ranked candidates at Phase 0 and asked instead: *"Sort the 192 BL items by whether they affect real documents versus enumeration-only, so I can see how many actually matter."*
- **Deliverable:** `docs/REAL-DOCUMENT-TRIAGE.md` — one audit report classifying all **192 of 192** open `BACKLOG.md` items on a real-document-impact axis, plus the instrument that makes the axis measurable. Published also as an Artifact for the operator. **No `src/` change.**
- ⚠ **THE CORPUS THIS PROJECT HAS SWEPT FOR ~70 SESSIONS CONTAINS NO REAL DOCUMENTS.** All **60,998** paths in `scratchpad/s249/corpusfiles.txt` live under `scratchpad/` and are prior sessions' own generated probe output; median document **51 bytes / 5 lines**. So the nine items recording *"corpus weight ZERO"* — each citing exactly a probe-corpus size (`60,998`, `51,382`, `49,193`) — were measured probes-against-probes. The phrase has never meant "does not affect real documents", and it is routinely the deciding sentence at triage. ⚠ In fairness the project DOES keep a real-document control (`repofiles.txt`, 114 files) but it is 69 of its own methodology `.md` files plus 45 of its own `.qmd` fixtures, and it answers *"did my change move it?"* (regression), not *"does this occur in the wild?"* (prevalence).
- **NEW INSTRUMENT — a 3,383-document corpus of AUTHORED `.qmd`/`.Rmd`**, median **112 lines** (p90 464, max 4,397): 4,910 found, minus 1,467 byte-identical duplicates, 53 cloud-storage stubs, 3 unreadable, 4 empty. 1,332 `.qmd` + 2,051 `.Rmd`; 2,283 user projects, **602 quarto-web**, 456 R-package vignettes. All 3,383 rendered through the real quarto CLI, **HTML cached gzipped at 28 MB** so re-extraction never needs quarto again.
- ⚠ **THE RANKED LIST INVERTS UNDER MEASUREMENT.** Session 250's **#1 recommendation** (L52) and its #2, #3, #4 and #5 each occur in **0 of 3,383** authored documents; the item reaching the most (L56, 82) was not ranked. Every zero was adversarially re-attacked by a second agent forbidden the original detector, and upheld.
- ⚠ **THE SHIPPED MODEL AGREES WITH QUARTO ON 94.91% OF AUTHORED DOCUMENTS** — 2,314 of 2,438 scored (2,441 exit 0, minus 3 `{{< include >}}`). The **124** divergent: 81 phantom (217 extra Outline entries), 34 lost (157 missing), 9 wrong level.
- ⚠ **THE DOMINANT REAL CAUSE IS QUARTO'S OWN `:::` DIVS, NOT THE SETEXT GRAMMAR.** L268 (52 divergent documents) and L180 (50), both all-phantom, both already filed, **both unranked** — while the top of the list is a family with zero real reach. Confirmed by reading `wsfct/web/docs/articles/intro-for-leaders.qmd`: four `::: {.callout-*}` blocks each with a `##` inside, each a phantom Outline entry.
- ⚠ **NEW UNFILED DEFECT — EVERY heading inside a `::: {.panel-tabset}` is a TAB LABEL.** 11 of the 16 divergent documents no filed item explained. Minimal pair measured both halves firsthand: quarto renders `h2:Real Heading` + `h2:After`; this model reports those **plus** `h2:Tab A` and `h2:Tab B`. `grep -i tabset BACKLOG.md` and `grep -ri panel-tabset src/` were both EMPTY. ⚠ NOT covered by the two filed callout items: they key on `.callout-*` and lift the **FIRST** heading into a title bar; a tabset consumes **EVERY** heading, so a callout-derived fix leaves every tab after the first as a phantom. Invisible to enumeration because a 5-line probe never builds a tabset. Filed as Session 251 R1.
- ⚠ **THE INHERITED HTML EXTRACTOR IS UNSOUND ON AUTHORED DOCUMENTS — the FIFTH in a family of four already documented in `render250.sh`'s own header.** `H_DIRECT` requires heading text to contain no `<`, so it **drops** `## A concrete \`SKILL.md\`` (a `<code>` span — the heading-losing direction, like all four predecessors) and **invents** `Contents` / `Other Formats` from quarto's page chrome. Replaced with a real HTML parser skipping chrome by container class/id.
- ⚠ **THREE ARTIFACTS OF MY OWN INSTRUMENT WERE FOUND AND REMOVED, ALL POINTING THE SAME WAY.** Divergences fell **272 → 151 → 136 → 124**: quarto page chrome scored as headings the model lost (121 documents), blind tail-stripping of `References` deleting headings authors wrote (15), and skipping `id="footnotes"` which is also an author's own `## Footnotes` (12 rows). Every one made the model look worse; the 124 is what survived.
- **41% OF THE REAL `.Rmd` CORPUS HAS NO GROUND TRUTH.** 942 of 3,383 fail `quarto render`; **1,395 (41.2%)** carry an rmarkdown `output:` key quarto's front-matter validation rejects, 168 are `_`-prefixed include fragments. The extension still provides an Outline for those files, so for 41% of real R Markdown documents no render can check it.
- **A REAL DOCUMENT CRASHES QUARTO** — `broom/doc/bootstrapping.Rmd` (a published CRAN vignette) returns **exit 139**, a real-world instance of L377's generated-document crash class.
- **CONSTRUCT CENSUS — the probe corpus over-represents exactly what the backlog is about.** `from:` key: **0.12% real (4 documents, 2 unique) vs 7.9% probe**. Genuine setext headings: **3.67% real vs 32.17% probe** (8.8×). Conversely executable cells: **63.9% real vs 2.0% probe**; YAML front matter 77.9% vs 14.0%.
- **VERDICTS — 192/192, 0 unassigned.** **90 PROBE_ONLY** · **68 NOT_A_DOCUMENT_ITEM** (42 feature, 22 repo, 4 docs) · **34 REACHES_REAL**. Of the **124 parser items**, **73% have no reach into any authored document**.
- **Adversarial pass:** every `PROBE_ONLY` verdict attacked by a second agent forbidden the first agent's detector — **6 overturns**, each with a named document. ⚠ One found a defect OUTSIDE its own batch: **L66**, whose record claims *"corpus weight ZERO over 60,998 documents"*, is live in a real document — `1. alpha` / `2. bravo` / `---` gives the model `h2:"2. bravo"` and quarto `h2:"bravo"`. **The trigger needs an ordered list with ≥2 items**, which a 2-6 line probe never builds.
- **Agent claims verified firsthand rather than taken:** all **147** detectors re-run by this session, all passing their own control. **7 counts disagreed** with what the agents reported; my re-run governs, moving **5 verdicts** (3 down from REACHES_REAL, 2 up). Recorded in `final.json`, not smoothed away.
- **Two of the audit's own hypotheses were WRONG and caught by checking.** (a) 196 documents where the model reports zero headings despite `#` lines — correct behaviour, they are `.Rmd` files that are one R chunk and every `#` is an R comment. (b) A `\x01` in heading text looked like a control character leaking into the Outline — it was my own census writer's separator; a probe against `findHeadings` showed 0 of 22 headings carry it.
- **Phase 3E (runtime smoke test): NOT APPLICABLE and stated rather than skipped.** The deliverable is a report plus one backlog filing; no runtime behaviour, no `src/` change, nothing to launch.
- **Verification.** `npm run compile` exit 0 (both projects) · `npm test` **2796 passed / 66 files** (unchanged from claim) · `check-backlog` **OK, 193 open items**. NOT RUN: `test:integration` / `test:lsp` (screen-taking, no adapter surface touched) and `test:oracle` (no model change).
- **Artifacts:** `scratchpad/s251/` — `realfiles.txt` (the corpus list), `real.pkl`/`probe.pkl` (cached corpora), `det/` (147 calibrated detectors), `scan.py` (aborts on an uncalibrated detector), `extract_headings.py`, `render_real.py` + `htmlcache/`, `score_real.py`, `attribute.py`, `rescan_all.py`, `reconcile.py`, `final.json`, `struct_diverge.txt`.
- **Backlog:** 192 → **193** (0 closed, 1 filed — the audit classifies, it does not close).

### 2026-08-25 · [ad hoc] Session 250 — a roman marker is pandoc's parse, not the roman character set

- **Session span:** 2026-08-25 (commits `6a5f1513`..close-out); dated by close-out.
- **Model:** Claude Opus 5. IMPLEMENTATION, strict TDD. The operator picked Session 249's R4 at Phase 0 from the ranked `AskUserQuestion` candidate list — recommended there as the cheapest of the heading-DELETING candidates whose fix already existed in the file.
- **Deliverable:** `isPandocsRoman` (new) and the post-filter of `emptyItemMarkerIsPandocs` in `src/core/qmd/model.ts` — one capability, "which multi-letter runs are roman numerals pandoc would take". Closes **the empty-item half of Session 249's R4**; re-files the container-pop half with the measurement that declined it.
- ⚠ **THE FILED ITEM WAS RIGHT ABOUT THE DEFECT, RIGHT ABOUT THE FIX, AND WRONG THAT IT APPLIES TO BOTH CALL SITES.** It named eleven tokens and asked for the same narrowing in both post-filters. The defect is far larger than eleven — the character class is wrong on **274 of 441** tokens at lengths 2-3 and **2,482 of 3,151** at lengths 4-9 — and pandoc's tier parser is wrong on **ZERO of all 3,592**, exhaustively at lengths 2, 3 and 4 and stratified at 5-9. But the two post-filters are NOT the same question, and the second one measured 4,178 WORSE.
- ⚠ **THE TWO POST-FILTERS ASK DIFFERENT QUESTIONS OF THE SAME BYTES.** `emptyItemMarkerIsPandocs` asks what the line MEANS — is it an empty item? — and pandoc's parse is the whole answer. `popsEnclosingContainer` asks whether the marker CLOSES the container above, and that answer must mirror the PUSH `listItemContentColumn` performs on the same line. That push deliberately over-accepts `[a-zA-Z]{1,9}` — G4 has pinned `Elephants.` and `Dr.` for exactly this reason since Session 249 — and it pushes a column for `ixix.`, `dd.` and `cmcm.` just as it does for those two, measured firsthand. Narrowing only the POP de-synchronises the pair, strands the outer container's column, and a later underline AT that column invents a heading. (Learning #487.)
- ⚠ **THE DECLINE IS A MEASUREMENT, NOT A JUDGEMENT.** The pop narrowing was built as a candidate `src` copy and scored: **461 BETTER against 4,178 WORSE**, class-weighted over the 4,729 documents (of 1,679,616 enumerated across 36 line kinds) whose answer it moves, against 643 rendered witnesses. The 461 are real and are the heading-DELETING direction the item named; they are left wrong on purpose and re-filed, because the way to close them is to narrow the PUSH and the POP together. (Learning #488.)
- ⚠ **THE POP PREDICATE'S ROMAN BRANCH HAD ZERO TEST COVERAGE AT HEAD, AND AN ADVERSARIAL AGENT PROVED IT RATHER THAN ASSERTED IT.** Both `return true` and `return false` at that line survived the entire 2,792-test suite. The new R3 guard is the first coverage it has ever had, and mutant N7 — the narrowing itself — now fails against it. This is also why the unit suite alone could never have caught the regression: only the enumeration plus the render could. (Learning #489.)
- ⚠ **THE HEADING-BLIND GRID.** The 443-document container-pop geometry inherited from Session 249's `r5` scores quarto's BLOCKS skeleton correctly and is worth nothing for scoring the MODEL: quarto renders NO heading in it in either direction, so this model scores 443/443 on it before and after any change. The defect is visible only through the empty-item geometry (170/444 → 444/444). An instrument validated for one question is not validated for the next one. (Learning #490.)
- **TDD gate:** the RED was written first and confirmed to fail for the right reason (`expected [ 'h2:bravo' ] to deeply equal []`), then the minimal GREEN, then the full suite. **1 RED→GREEN cycle** for the one term that moved, plus **3 test-after guards** (R2 the valid-roman control, R3 the declined half, R4 the residual with its control). ⚠ `src/core/qmd/model.ts` restored **byte-identical** after all 7 mutants.
- **Measurement.** **6,098 documents** rendered through the real quarto CLI 1.7.33 across five grids, every exit code read, **all 6,098 exit 0**. Ground truth EXHAUSTIVE where affordable: every lowercase 2- and 3-character run and every uppercase 2-character run over `[ivxlcdm]` in BOTH geometries (887), every lowercase 4-character run (2,401), stratified at 5-9 (750), 643 pop witnesses, 1,861 shipped-change witnesses. Character class wrong on **2,756**; tier parser wrong on **0**. Corpus sweep **60,998 documents** and the repo's own 114 tracked files: **ZERO movers, both**. Enumeration **4,100,625 documents** over 45 line kinds → 45,573 movers in 349 classes, class-weighted against the rendered witnesses: **42,569 BETTER, 1,072 WORSE, 1,932 SIDEWAYS**. A second enumeration of **1,679,616** over 36 line kinds scored the declined half. Mutation hunt **7 mutants: 6 killed** (each by the intended guard, N7 by R3), 1 kept with a proof.
- **Residual, disclosed and filed.** 1,072 worse documents remain, **308 of them one class**: a prose token alone on a line with a block quote under it invents an ATX heading. **PRE-EXISTING and merely widened** — the control is what proves it: `Etc.` and `Dr.`, prose tokens the predicate already rejected, report the same phantom in the PRE-CHANGE build on the same bytes. Corpus weight ZERO. Filed as Session 250 R2, guarded at R4.
- **Verification.** `npm run check-types` exit 0 (both projects) · `npm test` **2796 passed / 66 files** (2792 at claim, **+4**) · `npm run test:oracle` green · `check-package` **OK 42 files / 5.59 MB** · `check-backlog` **OK** · `npm run package` **exit 0** (44 files, 1.83 MB) · `npm run test:integration` **542 passing / exit 0**, on the shipping build, on an operator go-ahead sought IN ADVANCE with every assertion pre-checked headlessly first — all 22 integration fixtures unmoved and `closes-paragraph-gate.qmd` still exactly 40 headings. NOT RUN: `test:lsp` — no LSP surface touched.
- **Backlog:** 191 → 192 (one closed, two filed).

### 2026-08-25 · [ad hoc] Session 249 — a marker's ordinal run is as long as its reader takes

- **Session span:** 2026-08-25 (commits `5805d920`..close-out); dated by close-out.
- **Model:** Claude Opus 5. IMPLEMENTATION, strict TDD. The operator picked Session 248's ranked #3 at Phase 0 from the ranked `AskUserQuestion` candidate list, promoted to #1 there on Session 248's own tiebreaker — a heading DELETED outranks a TEXT divergence — at the lowest filed effort among the heading-deleting candidates.
- **Deliverable:** the ordinal run in `ORDERED_MARKER_SRC` (with `ORDERED_MARKER_SRC_COMMONMARK`, `ROMAN_RUN_LOWER`/`ROMAN_RUN_UPPER`, `LONG_ROMAN_SRC`, `LIST_ITEM_OPEN_COMMONMARK`), and the two independent respellings of it in `emptyItemMarkerIsPandocs` and `popsEnclosingContainer`, in `src/core/qmd/model.ts` — one capability, "how long may a list marker's ordinal run be, and for which reader". The fixture and outline-test changes are adapter-side wiring evidence. Closes **Session 247's R3**.
- ⚠ **THE FILED ITEM WAS RIGHT ABOUT THE OWNER AND WRONG ABOUT THE RULE, IN BOTH HALVES.** It described "a marker longer than NINE characters" — a cap to be raised. The DECIMAL run is UNBOUNDED: rendered at every width from 1 to 24 and at 30, 40, 50, 64 and 100 digits, all opening an `<ol>`, with `.`, `)` and the parenthesised form alike. The LETTER half is not a length rule at all but pandoc's ORDER-RESPECTING roman parser — `mmmmmmmmmm`, `iiiiiiiiii` and twenty `m`s are markers though none is a valid numeral, while `ixixixixix` is not, and a NON-roman letter run is never a marker at any length. (Learning #482.)
- ⚠ **THE CAP IS CORRECT FOR THREE OF THE NINE READERS, AND THAT SPLIT IS MEASURED RATHER THAN ASSUMED.** Nine readers × eight markers = 72 documents, every one exit 0: `gfm`, `commonmark` and `commonmark_x` stop at nine and the other six do not. The set is EXACTLY `FRONTMATTER_COMMONMARK_FROM` — the same six-three split `atxClosingRun` already turns on, arrived at independently. A widening applied unconditionally would report a heading quarto does not render under a third of the readers. (Learning #483.)
- ⚠ **A CHARACTER CLASS IS NOT A PARSER.** The obvious `[ivxlcdm]{10,}` spelling is measurably wrong on `ixixixixix.` — ten characters all drawn from the roman set, rendering a bare `<p>`. Transcribing pandoc's own tier order predicts all 17 rendered roman-letter tokens. Every tier is OPTIONAL, so the run also matches the EMPTY string; a `{10}` lookahead keeps a bare `.` from becoming a marker AND makes the widening strictly additive. Guarded at G3 and G8. (Learning #484.)
- ⚠ **THE PRICE WAS PAID AT EACH INDEPENDENT RESPELLING, AND THE SESSION 248 HANDOFF NAMED BOTH IN ADVANCE.** While `emptyItemMarkerIsPandocs` lagged at `{1,9}`, `LIST_ITEM_EMPTY` matched a marker-only long line and that predicate denied it, so the line fell through to the setext path — 817 disagreements over 54,225 enumerated documents. While `popsEnclosingContainer` lagged, a long marker pushed a content column and CLOSED nothing, so columns accumulated (`[11,11,11,11]` where `1.` holds `[2]`) and the stale ones matched later underlines. Both comments have read "at any width" since Sessions 198 and 248 while their regexes capped at nine; they are true now.
- ⚠ **MY OWN FIRST ENUMERATION VERDICT WAS A SIGN ERROR CAUSED BY MY OWN SAMPLING.** Rendering 100% of the LOSS classes and a stepped ~20% of the GAIN classes produced 313 WORSE against 144 BETTER. Rendering all 1,587 classes reversed it: per class 453 → 585 (+132), per document 12,447 → 27,373 (+14,926). (Learning #485.)
- ⚠ **THREE MUTANTS SURVIVED THE FIRST HUNT AND TWO OF THEM WERE GUARD WEAKNESS, NOT REDUNDANCY.** A candidate `src` copy with all three reader gates removed, scored over 1,867 rendered documents, found 6 rows where the ungated build DELETES a real heading — all in Session 198's 2/4/6 container-pop geometry, which no alphabet or design grid contained. One new guard row (G7) killed both. The one genuine survivor is kept with a proof at its call site. (Learning #486.)
- **Measurement.** 1,867 documents rendered through the real quarto CLI 1.7.33 across nine grids, every exit code read and 32 non-zero rows discarded as not-data. Design grids 222 documents: 130 → 189 exactly right, 67 BETTER, 8 WORSE, 0 SIDEWAYS. Corpus sweep 60,998 documents and the repo's own 114 tracked files: **ZERO movers, both**. Enumeration 782,969 documents over five alphabets → 1,587 transition classes, **all 1,587 rendered**: per class +132, per document +14,926. Three candidate `src` copies built and SCORED rather than argued (`expA` the empty-item widening, `expB` the pop widening at 13 BETTER / 0 WORSE, `expN` all three gates removed). Mutation hunt 9 mutants: 8 killed, 1 kept with a proof. `src/core/qmd/model.ts` restored byte-identical after every mutant.
- **Residual, disclosed.** 453 worse classes / 12,447 documents remain, and they are TWO pre-existing, width-independent families, both demonstrated at `1.` and `123456789.` where this model has always been wrong: a `---` after a stack of empty items is a THEMATIC BREAK (67 classes, filed as R1) and a line consumed as a setext TITLE still pushes its list content column (386 classes, filed as R2). Also filed: the `fancy_lists` reader axis (R3), the roman post-filter that is a character class (R4), and one agent-reported item explicitly marked NOT verified firsthand (R5).
- **Verification.** `npm run check-types` exit 0; `npm test` **2792 passed / 66 files** (2779 at claim); `npm run test:oracle` byte-identical; `npm run package` green (44 files, 1.83 MB); `npm run test:integration` **542 passing / exit 0**, on the shipping build, on an operator go-ahead sought IN ADVANCE with every assertion pre-checked headlessly first — the model's 40 headings match quarto's 40 EXACTLY and in order. Fixture premise re-rendered, not assumed: 36 → 40 headings, the 36 byte-identical and in the same order, exactly four added.
- **Backlog:** 187 → 191 (one closed, five filed).

### 2026-08-25 · [ad hoc] Session 248 — a marker-only line is a complete empty item

- **Session span:** 2026-08-24/25 (commits `b991d711`..close-out); dated by close-out.
- **Model:** Claude Opus 5. IMPLEMENTATION, strict TDD. The operator picked Session 247's ranked #2 at Phase 0 from the ranked `AskUserQuestion` candidate list, promoted to #1 there because it DELETES a heading where Session 247's own #1 is a TEXT divergence with measured corpus weight zero.
- **Deliverable:** the second arm of `emptySiblingItem`, plus `listItemOpensHere`, `emptyItemMarkerIsPandocs`, `listItemOpensAtPrevLine`/`listItemAboveHeader` and `simpleTableOpensHere`'s `headerIsItemOfOpenList` in `src/core/qmd/model.ts` — one capability, "does a marker-only line count as a body line of the item it opens". The fixture and adapter changes are test-side wiring evidence.
- ⚠ **TWO FILED ITEMS WERE ONE MISSING CONJUNCT, FILED A SESSION APART UNDER DIFFERENT SYMPTOMS.** Session 247's R4 (`1.` / `bravo` / `---` renders `ol>h2` and every build reported NOTHING, because the marker line counted as a body line and the run reached 2) and Session 246's own R4 (`-` / `# Probe Z` renders `ul>h1` and no build reported the ATX, because `paragraphOpen` was left set) are the same term: a marker-only line that OPENS a list is an empty item, exactly as a sibling one is. Session 246 gated its rule on a list being open ABOVE the line, so the FIRST marker of a list was outside it by construction. One conjunct closed both. (Learning #477.)
- ⚠ **THE TWO ARMS ARE GATED DIFFERENTLY AND THE ASYMMETRY IS COMMONMARK'S OWN, NOT TIDINESS.** An EMPTY item may not interrupt a paragraph, so with prose open above it a lone `-` is a level-2 UNDERLINE and a lone `1.` is ordinary text — `alpha` / `-` / `bravo` / `---` renders BOTH headings and `alpha` / `1.` / `bravo` / `---` renders a bare `<p>`. A SIBLING marker interrupts nothing — it ENDS the item it is a sibling of — so it is an empty item even with a paragraph open. The arms cannot be merged; guarded at G1, G2 and G3, all written BEFORE the gate.
- ⚠ **CLEARING A FLAG THAT WAS TRUE BY ACCIDENT BROKE A READER THAT USED IT AS A PROXY, AND ONLY THE ENUMERATION SAW IT.** An empty item opens no paragraph — the whole point — but `simpleTableOpensHere` reads `paragraphOpenAboveHeader` as a proxy for *"some block above has already claimed this header row"*, true of a marker-only line only because that line used to be miscounted as paragraph content. With the accident gone, a bare marker became eligible as a simple table's HEADER and `inSimpleTable` suppressed the setext row: **53 of 120 heading-losing transition classes**, on a build where SEVEN other gates were green. Instrumented rather than argued — the two traces are identical through `titleLineCount` and diverge on `inSimpleTable` alone. The repair was a sentence already written one screen away for block quotes (`headerContinuesQuote`), with "list" for "quote". (Learning #478.)
- ⚠ **A SHARED GRAMMAR'S DELIBERATE OVER-ACCEPTANCE IS SAFE ONLY BEHIND THE SECOND GATE THAT MAKES IT SAFE, AND A NEW CONSUMER DOES NOT INHERIT THAT GATE.** `LIST_ITEM_EMPTY` is built on `ORDERED_MARKER_SRC`, which accepts `[a-zA-Z]{1,9}` before a `.`/`)` — safe for the STRIP because a pseudo-marker opens a column no underline is accepted at, and its docstring says so. An EMPTY item has no second gate, so every 1-9 letter prose token ending in a period, alone on a line, became a complete list item: `Etc.`, `Ibid.`, `Mr.`, `xyz.`, `Etc)` and two ATX spellings, **7 measured phantoms**. Repaired with `popsEnclosingContainer`'s measured rule minus its initial-in-a-name exclusion, which cannot apply to a marker alone on its line (`A.` / `bravo` / `---` renders `ol>h2`). (Learning #479.)
- ⚠ **AN AGENT READING THE GRAMMAR FOUND WHAT NINE RENDERED GRIDS COULD NOT.** 93 rendered probes, 60,998 corpus documents, 6,200,000 enumerated documents and a 15-mutant hunt were ALL green on the `Etc.` family, for one reason: not one alphabet contained a multi-letter prose token ending in a period. A fan-out agent asked what else the regex admits, named the already-filed backlog item it belongs to, and said plainly that it had not rendered. All 7 witnesses reproduced firsthand. (Learning #480.)
- ⚠ **TWO PINS IN SESSION 182'S BLOCK ASSERTED AN ANSWER QUARTO DOES NOT GIVE.** `"   -"` in M9/M10's loop and the `-` row in M13 both went red. Every measured example in those comments is an `=` run; the dash spellings were added by analogy and never rendered. Re-rendered on the exact bytes, `# Heading Above` / `   -` / `# ATX Below` and `# Heading Above` / `` / `-` / `# ATX Below` both render `section>h1>ul>h1` with BOTH headings. Third consecutive session in which an inherited red test was a filed defect's obituary rather than a regression.
- **TDD gate:** the guard block FIRST — **8 `it()`s green BEFORE any `src/` change**, every row rendered, weighted to the rows the obvious spellings break (G1's paragraph-interrupt gate, G2 one container in, G3 the sibling arm that cannot be folded into it). **3 RED→GREEN cycles**, each RED confirmed to fail for the right reason (`expected [ 'h2:bravo' ] to deeply equal []`, then `expected [] to deeply equal [ 'h2:1.' ]`, then `expected [ 'h2:bravo' ] to deeply equal []`), and **two of the three were regressions this session's own change created and its own gates caught**. **10 test-after pins (C1-C10)** and **1 residual pin (R1)**. ⚠ `src/core/qmd/model.ts` restored **byte-identical** after each of the 10 and then 15 mutants.
- **Measurement:** **1,047 documents** rendered through the real `quarto render` path (quarto 1.7.33) across ten grids, **every exit code read and 35 non-zero rows DISCARDED as not-data**. Design grids 93 documents: 44 movers, **44 BETTER, 0 WORSE, 0 SIDEWAYS**. Corpus sweep **60,998 documents**: 17 heading movers, **0 cell movers**, EVERY mover rendered — **16 exactly right, 0 worse**, and the 1 "sideways" is per-heading one heading's text corrected with a pre-existing phantom left untouched. Repo sweep 114 tracked files: 1 mover, and it is this session's own fixture moving exactly as intended. Enumeration **6,200,000 documents** across eight alphabets — 572,401 movers in 11,107 transition classes, stratified by DIRECTION (96 LOSS, 389 TEXT, 10,622 GAIN); **all 96 LOSS and all 389 TEXT rendered in full** plus a STEPPED sample of 400 GAIN, 885 documents scored: exactly right **55 → 479**. **Three candidate spellings built as `src` copies and SCORED, and the score contradicted the reasoning twice**: a NARROW arm loses on every grid (467 vs 479) because the one-line lag puts it out of reach, the table-outrank wins or ties everywhere (494), the pandoc-marker narrowing is **12/12 against 5** and identical on all eight other grids. Mutation hunt **15 mutants: 14 died**; N4 is redundant BY CONSTRUCTION — an indented code line already opens a fresh block AND closes any paragraph — proven on **7 directly NAMED reaching shapes** and 362,144 enumerated documents across two alphabets, and kept with the proof at the call site. (Learnings #477-#481.)
- **Residual, disclosed and filed:** an empty item's BODY line is still eligible as a simple table's header row — **55 of 11,107** transition classes, **36 of them behind a CommonMark-family `from:` prefix**, **corpus weight ZERO** over 60,998 documents and over the repo's own 114. **PRE-EXISTING IN KIND**: Session 246's sibling arm already opens no paragraph and quarto really does build a table under one (`-   alpha` / `-` / `bravo` / `   -` / `charlie` renders `ul>table`, and BOTH builds report nothing). Its OTHER leg is an INDENTED CODE line as the header row, which is measured to be a real header, so the two legs cannot be closed by one term. Pinned as R1.
- **Verification at close:** `check-types` **0** · `check-types:unit` **0** · `compile` **0** · `compile-tests` **0** · `npm test` **2779 passed / 66 files** (baseline 2760, **+19**) · `test:oracle` **131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated** (BYTE-IDENTICAL to S180-S247, verified by swapping the pre-change build in and diffing the full output) · `check-package` **OK 42 files / 5.59 MB** · `check-backlog` **OK, 187 open items** · `npm run package` **exit 0** · `test:integration` **542 passing / exit 0**. NOT RUN: `test:lsp` — no LSP surface touched.
- **Phase 3E:** green **TWICE**, both on an operator go-ahead sought IN ADVANCE, and the second run is against the exact build that ships — `src/` changed after the first (the third fix), so the gate was re-run rather than left one commit stale. All assertions pre-checked headlessly first (`scratchpad/s248/precheck248.test.ts` — S211's gotcha 3 for a **THIRTY-FOURTH** session), including an EXACT outline-vs-quarto match IN ORDER on all 36 names and a re-check of every prior session's assertion on this shared fixture, both directions; the one differing name is Session 241's already-filed internal-whitespace collapse, on a Session 247 row and not on this session's. The fixture's premise was **re-rendered, not assumed**: 32 → 36 headings, the 32 prior byte-identical and in the same order, exactly four added. ⚠ The underlines sit at the marker's own WIDTH, because an empty item's content column is one LEFT of a populated item's, and because a column-0 `---` would pair with an existing one and fail the render with exit 1. `src/` did NOT change after the second run.
- **Backlog:** **2 CLOSED** (Session 247's R4, the operator's pick; and Session 246's R4 as free by-catch on the same conjunct), **1 FILED**; 188 → **187** open items.
- **Commits:** 1B claim `b991d711` · FIX 1 `1159f9fa` · FIX 2 `b9161fc1` · WIRING `c8d14468` · FIX 3 `3af05aed` · close-out.

