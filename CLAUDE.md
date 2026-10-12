# CLAUDE.md

## SESSION PROTOCOL — FOLLOW BEFORE DOING ANYTHING

Read and follow `methodology/SESSION_RUNNER.md` step by step. It is your operating procedure for every session. It tells you what to read, when to stop, and how to close out.

**Three rules you will be tempted to violate:**
1. **Orient first** — Read methodology/SAFEGUARDS.md → methodology/SESSION_NOTES.md → run `methodology/methodology_dashboard.py` → git status → report findings → WAIT FOR THE USER TO SPEAK
2. **1 and done** — One deliverable per session. When it's complete, close out. Do not start the next thing.
3. **Auto-close** — When done: evaluate previous handoff, self-assess, document learnings, write handoff notes, commit, report, STOP.

`methodology/SESSION_RUNNER.md` documents known failure modes and their countermeasures. The protocol compensates for documented tendencies to skip orientation, skip close-out, and continue past the deliverable.

---

<!-- budget:protected -->
## Purpose

This is the `vscode-quarto-ext` project: an **MIT-licensed** Visual Studio Code extension (this project's own source code; a small number of vendored third-party webview assets carry their own OSI-approved licenses, disclosed in `NOTICE` — see the Graphviz/EPL-2.0 entry) that reimplements many — ideally most — of the features of Posit's official Quarto extension for VS Code (render, live preview, `.qmd` language support, code-cell execution, YAML/citation/cross-reference completion, snippets, and related authoring aids). The primary deliverable is a packaged, installable VS Code extension (`.vsix`) plus its source.

The goal is feature parity *reimplemented independently under MIT licensing*, not a fork.
<!-- /budget:protected -->

---

## Tech Stack

- **TypeScript on Node.js**, VS Code Extension API (`engines.vscode` `^1.90.0`). `vscode` is
  host-provided and marked external — it is never bundled.
- **esbuild** produces two bundles: `dist/extension.js` (cjs, node18) and
  `dist/notebook-renderer.js` (esm, browser). **`@vscode/vsce`** packages the `.vsix`.
- **The Quarto CLI is the one external program the extension runs** — spawned via
  `node:child_process` from the adapter layer (`quarto` ≥ 1.7; 1.7.33 installed).
- **Nothing is installed from npm at runtime.** `package.json` has no `dependencies` key at all;
  every package is a devDependency used at build or test time. The two apparent exceptions are
  not: `markdown-it` is a **type-only** import (erased at build — the instance comes from VS
  Code's built-in `vscode.markdown-it-renderer`), and **KaTeX / Mermaid / Graphviz ship as
  vendored static webview assets** under `media/`, not as bundled imports — each under its own
  OSI licence, disclosed in `NOTICE`.
- **No language server, and no `vscode-languageclient`** — it appears in neither `package.json`
  nor any source file. Language intelligence *inside* code cells is instead forwarded to the
  **user's own** language servers through embedded virtual documents; that is what
  `npm run test:lsp` exercises against real Pylance.
- **`src/core/` is `vscode`-free by design** and is where the logic lives; `vscode` is confined to
  the adapters (`src/extension.ts`, `src/features/`, `src/providers/`, `src/quarto/`). That split
  is what makes the bulk of the project unit-testable headlessly.

---

## Build / Test / Verify

**The build equivalent (record the run in close-out, see methodology/SAFEGUARDS.md) is:**

```bash
npm run compile      # type-checks src AND test/unit, then bundles — seconds
npm test             # vitest over test/unit — headless, hermetic, seconds
```

**The release gate is `npm run package`.** It runs `compile`, then `vsce package` — and `vsce`
walks the `vscode:prepublish` edge itself, which runs `compile` again plus `check-package`. That
edge is why even a bare `npx vsce package`, which touches none of our npm scripts, is still gated.

### What each script actually runs

| Script | Runs | Notes |
|---|---|---|
| `check-types` | `tsc --noEmit` (`tsconfig.json` → `src`), then `check-types:unit` | Exit 0 means **both** projects are clean. |
| `check-types:unit` | `tsc -p tsconfig.unit.json` (`test/unit`) | The one definition — see the gotcha below. |
| `bundle` | `node esbuild.js` | Two bundles: `dist/extension.js` (cjs, node18, `vscode` external) and `dist/notebook-renderer.js` (esm, browser). |
| `compile` | `check-types` + `bundle` | |
| `watch` | `node esbuild.js --watch` | Bundles only — **no type-check**. |
| `compile-tests` | `tsc -p tsconfig.test.json` → `out/` | Emits (not `--noEmit`) `test/integration`, `test/lsp`, `test/oracle`; the two Electron runners execute what it emits. |
| `test` | `vitest run` over `test/unit/**/*.test.ts` | **Not** `@vscode/test-electron`. No VS Code, no `quarto`. |
| `test:oracle` | `vitest run --config vitest.oracle.config.ts` over `test/oracle/**/*.oracle.test.ts` | Shells out to the **real `quarto` CLI** once per corpus document, so its verdict depends on the installed quarto version. Cached in the gitignored `test/oracle/.quarto-cache.json`, keyed by quarto version + document bytes — sub-second warm, ~1.5 min cold (measured, one render per corpus document). |
| `test:integration` | `compile` + `compile-tests` + `out/test/integration/runTest.js` | `@vscode/test-electron` downloads its own VS Code — no `code` CLI needed — pinned in the runner to a fixed version, and launches an Extension Development Host. **Takes over the screen.** |
| `test:lsp` | same chain → `out/test/lsp/runTest.js` | Extension Development Host with a throwaway extensions dir holding only `ms-python.python` + Pylance, copied from the user's own install. Deliberately not in CI (Pylance licensing). **Takes over the screen.** |
| `test:lsp:workspace` | `QMD_LSP_DIAGMODE=workspace npm run test:lsp` | The workspace-diagnostics variant of the same harness. |
| `check-package` | `node check-package.js` | Deny-by-default allowlist over `vsce ls` output, so a new top-level file **reds** instead of silently shipping. Read its docstring before changing it. |
| `check-backlog` | `node check-backlog.js` | Reds if `BACKLOG.md` holds a completed-work record. Also asserted by `test/unit/backlog-hygiene-gate.test.ts`, so it runs on **every `npm test`** — the script is the readable form (it prints every offending line at once). Read its docstring before widening the rule. |
| `package` | `compile` + `vsce package` | The release gate — see above. |

For any Quarto-document fixture the doc-build equivalent is `quarto render`; `test:oracle` is the
automated form of that check.

### Gotchas that `package.json` does not show

- **`npm test` passing is not evidence that `test/unit` type-checks** — vitest transpiles with
  esbuild and checks nothing. Type-checking a unit test you just edited is `npm run
  check-types:unit` (CHANGELOG: the `test/unit` type-check gate, Session 173). From S162 to S172
  nothing type-checked `test/unit`, so every handoff in that range carried a hand-typed per-file
  `npx tsc …` incantation as a gotcha — one whose `--moduleResolution bundler` is measurably wrong
  for this repo (it reports 6 phantom TS2702 errors in `src/core/notebook-callout.ts`).
  `tsconfig.unit.json` is now the one definition, and `npm run check-types` runs it, so `compile`,
  `package`, `vscode:prepublish`, `test:integration` and `test:lsp` all reach it.
- **`vsce package` exits 0 no matter what it packages.** Nothing in the build, test, type-check or
  packaging pipeline can observe a packaging leak — only reading the produced file tree, or
  `check-package`, can. The default was wrong twice — CHANGELOG: the `test/unit` type-check gate,
  Session 173, and the `scratchpad/` `.vsix` packaging leak, Session 174.
- **`test:integration` and `test:lsp` take over the screen** — each launches a real VS Code
  Extension Development Host window. Get the operator's explicit go-ahead before running either.
- **A red `check-backlog` is not fixed by deleting the block.** It means a completed record is
  sitting in an open-work file: record the outcome in `methodology/CHANGELOG.md` and anything worth carrying
  forward in `PROJECT_LEARNINGS.md` **first**, then delete. ⚠ Verify per block — Session 195 found
  an OPEN, operator-pending decision (the lone `+` gate suspension, 2 recovered against 32 new
  phantoms) buried inside a tombstone, recorded in no other tracked file.

### The real-document measure — run it after any heading-model change (Session 268)

**`tools/realdoc-score/run.sh <label>` is this project's standing answer to "did that change help?"**
It scores this extension's Outline against `quarto render` over an authored corpus — real documents,
not probes — and takes about five seconds warm:

```bash
export REALDOC_DATA=scratchpad/s265 REALDOC_ORDINALS=scratchpad/s251/realfiles.txt
tools/realdoc-score/run.sh head      # head: scored 2438 agree 2419 (99.22%) divergent 19 …
```

- **Run it after any change reaching `findHeadings`** and cite the line in the close-out receipt. A
  change that moves a corpus document into the losing column is a defect, whatever the unit tests say.
  Any directory holding `src/` scores, so a past build is `run.sh <sha> /tmp/build-<sha>`.
- ⚠ **It is machine-specific and can never be a gate.** The corpus is personal and is never
  committed: `methodology/.quality-gates.json` and CI cannot run this, which is exactly why the habit has to be
  written down here instead.
- ⚠ **Name a corpus document only by its ORDINAL** in any tracked file (Learning #548).
- The scripts are tracked and the corpus is not; `tools/realdoc-score/README.md` says which files it
  needs, what the number excludes, and which divergences are decided rather than open.

---

## Project-Specific Methodology Adaptations

*Additions and overrides to the base methodology at `methodology/SESSION_RUNNER.md` and `methodology/SAFEGUARDS.md` (synced from the methodology repo, not project-owned). The base files govern unless explicitly overridden here.*

> **Why this file and not a synced one:** `methodology/SESSION_RUNNER.md`, `methodology/SAFEGUARDS.md`, and everything under `docs/methodology/` (including the workstream docs) are synced byte-identical from the canonical methodology repo — editing them blocks future syncs (BOOTSTRAP, "Customizations Go in CLAUDE.md, Not in Synced Files"). Every project-specific rule, including the one below, lives here.

### Mandatory development practice — strict TDD (operator directive, project-wide)

**For the entire duration of this project, all implementation and bug-fix work MUST follow strict test-driven development.** This is a hard gate, an override that strengthens the base Development-workstream guidance (which lists "Test-last" as anti-pattern #3 and already says "write the failing test first"). It is not optional and does not lapse between sessions.

- **Red → Green → Refactor, one test at a time.** Write ONE failing test for the next behavior, run it and confirm it fails *for the right reason* (RED), write the minimal code to pass (GREEN), then refactor with tests green. Repeat.
- **Vertical slices, never horizontal.** Do NOT write all tests first then all implementation — that produces tests of imagined behavior. One test → one implementation → repeat (see the `/tdd` skill, which is the operative how-to; cited in `methodology/RECOMMENDED_SKILLS.md`).
- **Test behavior through the public interface,** not implementation details, so tests survive refactors. For this project the pure `core/` library (the §3.3 guardrail) is where most logic lives and is unit-tested headlessly with `npm test` (vitest); `vscode` adapters are verified with `@vscode/test-electron` (Learning #3).
- **Scope of the gate:** anything with logic (parsers, arg-builders, indexers, providers, lifecycle/state machines). Pure declarative/config/doc edits with no logic (e.g. a `package.json` command contribution, grammar JSON) are exempt from a unit test but still require their normal verification (compile, integration registration, render).
- **Enforcement at close-out:** a session's self-assessment must state that implementation was TDD (RED shown before GREEN). A commit that adds logic with no preceding failing test is a protocol violation to flag in the handoff.

*Origin: operator directive, Session 5 (2026-06-27), after an implementation began impl-first; the operator asked that TDD be enshrined in the correct (non-synced) methodology file so it persists across sessions.*

### Clean-room boundary — Posit's extension is AGPL-3.0: observe it, do not read it (operator directive, Session 267)

**This project reimplements Posit's feature set independently under MIT (see §Purpose), and Posit's
extension is licensed AGPL-3.0** — `"license": "agpl-3.0"` in its `package.json` and the AGPL v3 text in
its `LICENSE.txt` (`quarto.quarto-1.135.0`, measured Session 267). Matching what it *does* is the goal
and is fine; its SOURCE is not a reference this project builds from, and AGPL terms would follow any
code taken from it into a `.vsix` that ships MIT.

- **Settle "what does Posit do?" by BLACK-BOX observation** — enable their extension in a VS Code
  window, open a document holding the shape, and read the Outline (or the behaviour) off the screen.
  Record the document and what it showed; that observation is the evidence.
- **Do not read their bundle to design a rule.** Two sessions have reached into `out/lsp.js` /
  `out/main.js` for a behavioural fact — Session 265 for the raw-HTML definition, Session 267 to
  confirm the Outline is built from markdown `heading_open` tokens and never from rendered HTML. Both
  answers were right; both should have been observations. Treat a bundle grep as a last resort, keep it
  to existence facts, and say in the record that is what it was.
- **Where quarto's RENDER and Posit's OUTLINE disagree, that is a decision, not a defect.** The audits
  score against `quarto render` because that is mechanical over thousands of documents; the product
  **defaults to mirroring Posit**, because Posit is the *product* oracle — what a user expects an
  Outline to do. **Seven such decisions are now recorded** in `BACKLOG.md`'s RECORD item and in
  `methodology/CHANGELOG.md`; five mirror Posit, and ⚠ **two deliberately do not.**
- ⚠ **The default is rebuttable, and decisions (6) and (7) are the cases that rebutted it (Sessions
  274 and 277).**
  Mirroring Posit rests on Posit's behaviour being *intended*. Where Posit's own maintainers have
  **publicly disowned** the behaviour upstream, it is an acknowledged defect rather than a design
  choice, and mirroring it would copy a bug its authors intend to remove. That is why decisions (6)
  and (7) follow `quarto render`: [`quarto-dev/quarto#829`](https://github.com/quarto-dev/quarto/issues/829)
  (open) has the Quarto VS Code extension maintainer stating *"the outline should match the TOC that
  ends up in the rendered document"*, with a quarto-cli maintainer agreeing the CLI should own outline
  generation. **The bar is a public upstream statement by a maintainer, read black-box** (issue titles
  and prose — never their source); a session's own sense that Posit "looks wrong" does not clear it.

*Origin: operator directive, Session 267 (2026-09-19), when the Session 266 close-out asked which of the
two oracles governs and the licence was measured while answering. The rebuttal clause is the operator's
decision (6) at Session 274 (2026-09-20), the first of the seven to depart from the default; the operator
applied it a second time as decision (7) at Session 277 (2026-09-22), where quarto renders a heading that
Posit's markdown-it (CommonMark) Outline hides.*

### Additional Phase 0 steps

**Present open backlog candidates via `AskUserQuestion` immediately after the Phase 0 report, whenever `BACKLOG.md`'s "Active" section is empty.** Rank the still-open items across `BACKLOG.md`'s "Up Next" list and any relevant "Polish / deferred" items, then hand the top ones to `AskUserQuestion` (max 4 options; recommend the top-ranked one) rather than free-form prose. If more than 4 open candidates exist, surface the top-ranked ones plus a catch-all "something lower-priority" option, and only drill into the remainder with a follow-up question if the operator picks the catch-all. This satisfies Phase 0 step 8's "STOP. Wait for the user to give you a task" — presenting a structured choice and blocking on the answer *is* waiting, not working; it does not license skipping the stop, starting work unprompted, or picking unilaterally.

*Origin: operator directive, Session 75 (2026-07-11) — formalizes a pattern already used ad hoc in Sessions 71/73/74 into a standing procedural step, so it fires automatically at every future Phase 0 rather than being re-derived per session. See also the standing `feedback` memory `candidate-list-selection` (general interaction preference: arrow+enter selection over a typed-digit prose list).*

### `methodology/SESSION_NOTES.md` retention — it is TRANSIENT, not append-only (Session 256)

**At Phase 3D, after writing your own close-out pair, DELETE the oldest pair so the live file holds
at most three. Do not append indefinitely.** A close-out pair is what one closing session writes:
its `## Session N-1 Handoff Evaluation (by Session N)` plus its `## Session N Self-Assessment`.
Three is the steady state, not a target to grow into: you write one, so you hold your own plus the
two you inherited, and you drop one — the count never moves. Roughly 65 lines per pair, so ~240 of
the 400-line ceiling, leaving real headroom instead of the next session inheriting a full file.

**A dropped pair is not lost — it is one command away**, and the file is small enough that this is
trivial: `git show <sha>:methodology/SESSION_NOTES.md`. Records through Session 253 additionally live in
[`docs/archive/SESSION_NOTES-through-S253.md`](docs/archive/SESSION_NOTES-through-S253.md). The
live file's job is only to answer *"what is the active task, and whose handoff am I scoring?"* The
durable record is `methodology/HANDOFFS.md` (the receipts), `methodology/CHANGELOG.md` (the ledger) and git.

**Why this rule exists, because the reason is not obvious and the canonical seed argues both sides.**
`../methodology/starter-kit/SESSION_NOTES.md` says at line 5 *"This file is transient — it is
overwritten every session"* and then at line 27 *"Session history accumulates below this line.
Newest session at the top."* Those cannot both be followed. This project followed line 27 for **256
sessions** and reached **3,949,501 B / 13,942 lines** — 33x its declared ceiling, and larger than
both ledgers combined before the Session 254 trim — in the one file Phase 0 step 2 *orders* every
session to read. Sessions 254 and 255 each read ~160 of its ~13,900 lines and inferred the rest,
which is failure mode #28 committed by the sessions that documented it. Canonical's own repo, 110
sessions of dogfooding, has **no `methodology/SESSION_NOTES.md` at all**.

**Two things that make this rule non-obvious in practice:**
- ⚠ **`methodology/methodology_trim.py` cannot enforce it.** `--file methodology/SESSION_NOTES.md` exits 3 with `NO_CONFIG`
  by design, and a `LedgerSpec` cannot be authored for this file at all: `date_of_record` is
  required and `evaluate()` freezes the oldest **by date**, while **458 of 740 records carried no
  date**. The reduction axis here is the **session number**. Upstream **BL-32** (open, undecided)
  is this exact gap; do not re-file it. Reduce by hand and prove it identity-keyed, the way
  `docs/archive/SESSION_NOTES-through-S253.md.verify.sh` does.
- ⚠ **A trim commit must contain no other edit to the file being trimmed.** Positional proofs break
  by construction otherwise (upstream BL-36). Rewrite `## ACTIVE TASK` in the close-out commit, not
  the trim commit.

**The gate that actually catches regrowth is `python3 methodology/context_budget.py`** — `max_lines: 400`,
`max_bytes: 120000`, `max_line_bytes: 280`. The line ceiling binds ~4.7x harder than the byte one,
and `max_line_bytes` is the one that stays red after a trim: keep every ACTIVE TASK line under
280 B rather than writing one 620 B paragraph.

*Origin: Session 256 (2026-08-26), the session that performed the reduction. A reduction with no
rule attached regrows — this file had already been drained twice under an instruction to "keep it
clean", which is what `BACKLOG.md`'s own header records about itself.*

### `methodology/CHANGELOG.md` conventions (Session 264)

**The rules are [§The Action Ledger](methodology/FRAMEWORK_APPARATUS.md#the-action-ledger).**
This project adds:
- **Tag a `BACKLOG.md` item `[BL-<item title>]`.** Its items carry no ids, so the title is the id;
  leave out any `]`, which ends the tag early. Methodology-repo work (a sync, BL-57) is `[ad hoc]`,
  naming that item in the summary.
- **Legacy, left as written** (entries are never edited): `[BACKLOG: <title>]` tags, untagged
  pre-vocabulary entries in the shard, and numeric `[BL-<N>]` tags — positional item numbers that no
  longer resolve (`BACKLOG.md`'s header). Most entries before S264 cover a whole session, not one
  commit. The Keep-a-Changelog `## [Unreleased]` heading is gone; entries group under `## YYYY-MM`.
  The headings the audit skips:
  `cat methodology/CHANGELOG.md $(git ls-files 'docs/archive/CHANGELOG-*.md') | grep '^### ' | grep -vE '^### [0-9]{4}-[0-9]{2}-[0-9]{2} · \[(issue #[0-9]+|BL-[^]]+|ad hoc)\]'`
- **`methodology/CHANGELOG.md` is not in `methodology/.context-budget.json`.** No session reads it whole, so it has no read
  budget. Its only size trigger is `python3 methodology/methodology_trim.py --file methodology/CHANGELOG.md --check`, and
  archiving is optional.

*Origin: Session 264 (2026-09-18), BL-57 P8. Operator decisions: the tag form, recording the legacy
tags rather than retagging them, and dropping the budget entry.*

### Additional task-to-workstream mappings

(none)

### Project-specific Learnings

See [`PROJECT_LEARNINGS.md`](PROJECT_LEARNINGS.md) (project root, committed) — extracted there on
2026-07-09 (Session 39). This table had grown to ~97% of this file's size (45 rows, 159 KB of
CLAUDE.md's 164 KB) and CLAUDE.md is loaded in full into every session's context; PROJECT_LEARNINGS.md
is not. **At Phase 3C (Document Learnings), append new rows to PROJECT_LEARNINGS.md, not here.**
Before starting work in an area with prior sessions, grep PROJECT_LEARNINGS.md for relevant keywords
(a phase name, a file path, a feature name) — it is not auto-loaded, so read/grep it explicitly, and
prefer targeted greps over reading it in full as it keeps growing.

### Project-specific Failure Modes

(none)
