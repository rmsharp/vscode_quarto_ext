# Code-Cell Diagnostics Forwarding (CHANGELOG: code-cell diagnostics forwarding, closed as not pursued, Session 69): Architecture Plan

## 0. How this plan was produced (evidence provenance) — and the headline finding

This plan follows `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`. Three independent evidence
streams were run, per that workstream's §7 "Verify Assumptions" ("verify by testing... verify by reading
the library source, not the README"):

1. **Public-source research on Posit's own shipped feature** (`quarto.cells.diagnostics.enabled`/
   `.debounceDelay`, since Posit `apps/vscode` v1.133.0/v1.134.0) — PR titles/descriptions/prose only
   (GitHub PR `body` text, changelog entries, `package.json` `configuration` manifest data), never their
   AGPL-3.0 source diffs, per this project's established look-but-don't-copy gate (Learning #1).
2. **MIT/permissively-licensed prior art** for the same class of problem — Microsoft's own
   `code.visualstudio.com` Extension API docs, and `microsoft/vscode-jupyter` (MIT), which solves an
   architecturally similar problem (forwarding Pylance IntelliSense into notebook cells).
3. **Firsthand empirical grounding in THIS repo's own real Extension Development Host** (`npm run
   test:integration`, `@vscode/test-electron`) — five scratch tests (written, run, and then deleted before
   this plan was written; never committed) directly exercising the exact mechanism this project's existing
   `src/providers/embedded.ts` forwarding architecture would need to extend, against VS Code's own
   built-in TypeScript/JavaScript language service (chosen because it requires zero extra extension
   install and is always present, unlike Pylance/an R extension, whose absence on this dev machine was
   not independently confirmed either way).

**Headline finding, and it reshapes the whole plan: this project's existing request-forwarding
architecture — the same virtual-document + `vscode.executeXxxProvider` mechanism that already forwards
completion/hover/go-to-definition/signature-help into embedded cells — CANNOT be extended to diagnostics.
This is not a scoping nuance to narrow around (contrast the YAML-diagnostics plan's "open schema" finding,
which narrowed scope but left a real, buildable v1); it is a hard wall in VS Code's public extension API,
independently confirmed three separate ways (§2 below).** Posit's own team hit the identical wall and
solved it by abandoning "forward to whatever the user has installed" entirely, replacing it with a
materially heavier architecture: their own bundled, self-managed language-server connections. §3 lays out
the resulting decision the operator needs to make — this plan does not have a low-risk "just build it"
recommendation to offer, and says so plainly rather than papering over the finding to produce a tidier
document.

---

## 1. Executive summary (TL;DR)

- **The problem Posit solves:** since v1.133.0/v1.134.0, Posit's extension shows real embedded-language
  diagnostics (e.g. a Pylance type error, a Ruff lint violation) as native red squiggles directly inside
  `.qmd` Python/R code cells — the same signal a plain `.py` file would show. This project has zero
  code-cell diagnostics today.
- **Why the obvious approach ("add a `DiagnosticCollection` to the existing `embedded.ts` forwarding,
  same as completion/hover") doesn't work:** diagnostics are the one capability VS Code's own docs say
  request-forwarding cannot serve (§2.1) — there is no `vscode.executeDiagnosticProvider` pull command.
  Diagnostics are inherently push-based: some extension must be *actively watching* a document and choose,
  on its own schedule, to publish. Getting a *third-party, user-installed* extension to do that for a
  virtual document this project owns turns out to be much harder than the existing pull-based forwarding
  ever needed to be — confirmed empirically in §2.3, not merely asserted.
- **What Posit actually built instead (from their own PR prose, §2.2):** they don't forward to the user's
  installed Python/R extension at all. They bundle and manage their *own* `vscode-languageclient`
  connections directly to specific language servers (Pyrefly for Python, Ark for R) that they spawn
  themselves, write the vdoc content to **real temporary files** (not `TextDocumentContentProvider` URIs —
  their first prototype tried that and it didn't work, per their own PR body), and drive the LSP
  `didOpen`/`didChange`/`didClose` protocol directly rather than relying on VS Code's own document-open
  machinery. This is a fundamentally different, heavier architecture than anything else in this codebase.
- **The decision this plan hands the operator (§3, §9):** (A) accept code-cell diagnostics as a permanent,
  documented architectural gap — same treatment as the excluded Visual Editor — because closing it means
  taking on a genuinely new class of dependency and maintenance burden that cuts against this project's
  established "delegate to the user's own installed tooling" philosophy; or (B) commit to building Posit's
  heavier architecture for a first language (Python is the obvious candidate — MIT-licensed servers exist,
  §2.4), accepting the new scope, a new required-or-optional external dependency, and its own future
  planning pass to nail down the details this session intentionally left open. **This plan does not
  recommend one over the other — it is a genuinely close call between this project's stated minimalism and
  a real, user-visible gap — and defers it to the operator (§9 Q1).**

---

## 2. The mechanism, investigated

### 2.1 VS Code's own documented limitation (public docs, MIT — Microsoft's Extension API guide)

The [Embedded Programming Languages guide](https://code.visualstudio.com/api/language-extensions/embedded-languages)
states directly: Request Forwarding (`vscode.executeCompletionItemProvider` etc. — exactly what
`src/providers/embedded.ts` already does) **"Does not work with diagnostics errors. The VS Code API does
not support diagnostic providers that can 'pull' (request) diagnostics."** The doc's only offered
alternative is the "Language Service" pattern — bundling your own diagnostics *engine* (their worked
example computes CSS diagnostics itself via a bundled `vscode-css-languageservice`) — which means owning
the analysis, not delegating to whatever the user already has installed. That doesn't fit this project's
target (nobody wants to reimplement Pylance).

### 2.2 Posit's own architecture, from their PR's own prose (public GitHub, PR title/description text only)

Sources: [`quarto-dev/quarto` PR #980](https://github.com/quarto-dev/quarto/pull/980) (the feature, v1.133.0),
[PR #1013](https://github.com/quarto-dev/quarto/pull/1013) (v1.134.0 follow-up), [PR #957](https://github.com/quarto-dev/quarto/pull/957)
(the earlier, telling prototype), [issue #208](https://github.com/quarto-dev/quarto/issues/208) (the
multi-year-old feature request this closed), `apps/vscode/CHANGELOG.md`, `apps/vscode/package.json`
(`contributes.configuration` — factual manifest data).

- **Settings:** `quarto.cells.diagnostics.enabled` (boolean, default `true`, scope `window`) and
  `quarto.cells.diagnostics.debounceDelay` (number, default `500`, scope `window`) — siblings of the
  pre-existing `quarto.cells.hoverHelp.enabled`/`quarto.cells.signatureHelp.enabled` toggles.
- **They run their own bundled LSP clients** (`vscode-languageclient`) directly to *specific* language
  servers — Pyrefly for Python, Ark for R — that they spawn and own. This is not "the same forwarding
  architecture, just for diagnostics" (contra this project's own BACKLOG.md item-10 text, written before
  this plan's research — see the correction noted in §8): it is a materially different mechanism run
  *alongside* their existing (pull-based) completion/hover forwarding, not an extension of it.
  Posit does **not** reuse the user's own already-running Pylance instance — there is no public VS Code API
  for one extension to borrow another's running language-server connection, so this is architecturally
  unavoidable for anyone taking this path, not a Posit-specific choice.
- **The critical empirical admission, stated directly in PR #980's own body:** *"LSPs don't seem to want
  to give diagnostics for vdocs when they aren't in the workspace."* Their first prototype (PR #957),
  which by its own description worked more like this project's existing in-memory virtual documents,
  didn't get diagnostics. The shipped fix: write a **real file to disk** — the OS temp directory when the
  target server tolerates it (Pyrefly, Ark), falling back to an in-workspace `.quarto/` folder for servers
  that require it (vscode-R specifically named).
- **Cleanup is disclosed as hacky:** VS Code doesn't let an extension force a `didClose` directly, so they
  retype the vdoc's language to `plaintext` (which triggers one) before deleting the temp file.
- **A disclosed, accepted, unfixed cosmetic bug:** the vdoc's own diagnostics entry visibly flickers in
  VS Code's global Problems panel before their code filters/re-publishes it against the `.qmd` URI.
- **A separate, earlier bugfix (PR #832, pre-v1.133.0):** *"Diagnostics are no longer reported for internal
  temporary virtual document files"* — i.e. their pre-existing completion/hover forwarding vdocs were
  *already* leaking spurious Problems-panel entries by accident, before the dedicated diagnostics feature
  even existed, and needed an explicit suppression fix. This is a real risk for *any* project using
  request-forwarding vdocs, independent of whether diagnostics forwarding is deliberately built — worth a
  quick audit of this project's own `src/providers/embedded.ts` vdocs regardless of which option (§3) is
  chosen (flagged as a new, small, unranked Polish/deferred candidate — see §9 Q4).
- **PR #1013 (v1.134.0):** IPython-magic lines (`%`, `%%`, `!`) inside Python cells aren't valid Python and
  produced spurious diagnostics from Pyrefly/Ruff — fixed by commenting those specific lines out in the
  vdoc content sent to the language server (the same "blank the parts that aren't real code" technique this
  project's own `buildVirtualContent` already uses, just applied to a narrower case).
- Coverage is Python + R only in both PRs' own text; Julia is not mentioned in either.

### 2.3 Firsthand empirical grounding in this repo's own Extension Development Host

Five scratch tests (`test/integration/suite/zz-scratch-diagnostics-grounding.test.ts` — written, run,
observed, and **deleted before this plan was written**; never committed, `git status` confirmed clean
afterward) exercised the exact mechanism `src/providers/embedded.ts`'s existing `VirtualDocStore` uses,
against VS Code's own bundled TypeScript/JavaScript language service (chosen so the result doesn't depend
on what happens to be installed on any particular dev machine — it ships with every VS Code install,
mirroring this project's existing `{ojs}`→`javascript` mapping in `src/core/embedded/lang-map.ts`). Full
transcript available in this session's `HANDOFFS.md` receipt if a future session needs the raw numbers;
summarized findings:

| # | What was tested | Result |
|---|---|---|
| 1 | A synthetic-scheme `TextDocumentContentProvider` vdoc (this project's existing `quarto-embedded:` pattern), opened via `workspace.openTextDocument()`, **never shown** | **Zero diagnostics** after 8s (`vscode.languages.getDiagnostics` empty; `onDidChangeDiagnostics` never fired for it) |
| 2 | The SAME vdoc, then `vscode.window.showTextDocument()` (a real, visible, active editor tab) | Diagnostics appeared in ~400ms — confirms the mechanism works *only* once genuinely shown/active |
| 3 | A **real on-disk file**, inside the actual open workspace folder (`scheme: file`, matching Posit's fix), opened via `openTextDocument()`, **never shown** | **Zero diagnostics** after 8s — rules out "just write to disk" alone as sufficient; disk + workspace membership, without visibility, was not enough for VS Code's own built-in checker |
| 4 | Show the vdoc once, then immediately move editor focus to a second, different document (the realistic shape: user is actively editing their `.qmd` tab, not the hidden vdoc tab) | The vdoc **dropped out of `vscode.window.visibleTextEditors` entirely** — VS Code does not consider a background/inactive tab "visible," even though it is technically still open |
| 5 | Apply a genuine `TextEditor.edit()` (not a content-provider swap) to a shown-then-unfocused vdoc, wait for re-diagnosis | Test could not even reach this step — the editor was no longer in `visibleTextEditors` per #4, confirming there is no "shown once, then safely backgrounded" middle ground via public API |

**Conclusion, converging with §2.1/§2.2 from an independent angle:** getting VS Code's own document/editor
model to keep a background, non-active document under live diagnostic analysis is not achievable through
any combination of `workspace.openTextDocument` / real files / `TextDocumentContentProvider` alone. The
*only* thing that produced a diagnostic in this project's own testing was a genuinely active editor tab —
which cannot coexist with the user actually having their `.qmd` tab focused to edit it. This independently
reproduces the *qualitative* shape of Posit's own "vdocs don't get diagnosed unless [some condition]"
finding, though this session's test used VS Code's built-in TS/JS service, not a real third-party
`vscode-languageclient`-based extension (Pylance etc.) — see the explicitly disclosed open gap in §7 Risk
R1. Posit's own fix (drive the LSP protocol directly, bypassing VS Code's editor-visibility heuristics
entirely) is consistent with why a lighter, editor-visibility-based trick was never going to work for them
either.

### 2.4 MIT-licensed prior art, and candidate servers for Option B

[`microsoft/vscode-jupyter`](https://github.com/microsoft/vscode-jupyter) (MIT) solves an architecturally
similar problem (Pylance IntelliSense across notebook cells) two different ways over its history, per its
own wiki:
- **Old way:** a `NotebookConcatDocument` (whole-notebook virtual Python file) + custom `vscode-languageclient`
  **middleware**, talking over a raw LSP connection to a **dedicated Pylance server process the extension
  spawns and owns itself** — not the user's own running instance, and not routed through VS Code's
  provider-registration system at all.
- **Current way:** abandoned virtual documents entirely for native **LSP 3.17 notebook-document
  synchronization** (`DidOpenNotebookDocument` etc.) — this requires VS Code's **Notebook API**
  (`NotebookDocument`, cells as separate documents). **Not applicable here**: a `.qmd` file is a single
  `TextDocument`, not a `NotebookDocument`, so this path is closed to this project without a much larger,
  separate architectural change (representing `.qmd` cells as notebook cells) that is far out of this
  item's scope.

Both confirm the same lesson as §2.2: solving this for real requires **owning the LSP client relationship
directly**, not leaning on VS Code's own document/editor visibility machinery.

**If Option B (§3) is chosen, quick license-checked candidates for a first (Python) slice** (verified this
session via `gh api repos/<org>/<repo>/license` / a direct `LICENSE` file fetch, not assumed):
[`microsoft/pyright`](https://github.com/microsoft/pyright) — MIT (confirmed via its `LICENSE.txt`, GitHub's
API returns `NOASSERTION` for it — a known GitHub license-detection gap, not a license fact, so the file
itself was fetched and decoded to confirm);
[`astral-sh/ruff`](https://github.com/astral-sh/ruff) — MIT (GitHub API `license.spdx_id: MIT`);
[`facebook/pyrefly`](https://github.com/facebookresearch/pyrefly) — MIT (GitHub API `license.spdx_id: MIT`,
apparently the same tool Posit itself adopted for Python). All three are viable candidates for a spawned,
user-installed-separately binary (the same "required external tool, not vendored" posture this project
already has for the `quarto` CLI itself) — **not vendored/bundled into this extension**, avoiding a new
NOTICE-file entry. R and Julia server candidates were not researched this session (out of scope until the
operator picks Option B and a language priority — §9 Q2).

---

## 3. The decision (§9 Q1 — for the operator)

**Option A — Accept this as a permanent, documented gap.** Add code-cell diagnostics forwarding to
`docs/POSIT-COMPARISON.md` as an explicitly excluded gap (parallel treatment to the Visual Editor), close
CHANGELOG: code-cell diagnostics forwarding, closed as not pursued, Session 69 as "investigated, not pursued," and redirect effort to items 11+ (outline granularity,
Format Cell, etc.), which this session's research did not find any comparable hard blocker for.
**Rationale for A:** this project's whole embedded-language story to date (Learning #1/#13, the "delegated
companion-extension" pattern cited for spell-checking and run-cell delegation) is built on *reusing what the
user already has installed*, with zero new required dependencies beyond the Quarto CLI itself. Option B
breaks that pattern for the first time — it requires either a new optional external dependency (a
separately-installed language server binary per supported language) or, if bundled, a new and nontrivial
vendoring/licensing/binary-size commitment. The gap is real and user-visible, but "we require you to
`npm install -g pyright` for this one feature" is a materially bigger ask than anything else in this
project's DoD to date.

**Option B — Build Posit's heavier architecture, for Python first.** Spawn and manage a dedicated LSP
client connection to a separately-installed, MIT-licensed Python server (Pyright/Ruff/Pyrefly — §2.4),
write cell content to a real temp file (in-workspace, per Posit's own finding for servers that require it),
drive `didOpen`/`didChange`/`didClose` directly (not via `workspace.openTextDocument`, which §2.3 shows is
insufficient on its own), debounce on `.qmd` edits (mirroring `yaml-diagnostics.ts`'s existing
`DiagnosticCollection` + 350–500ms-debounce + generation-counter pattern — directly reusable prior art, not
a novel design), and map ranges back through the existing identity-offset-mapping (`buildVirtualContent`)
already proven correct for completion/hover. **Rationale for B:** this is the single highest-impact
remaining gap this project's own Posit-comparison research has found (Session 67); "a Python cell with a
real bug shows nothing here, the same red squiggle you'd see in a plain `.py` file" is a genuine, everyday
correctness signal Posit's users get and this project's don't.

**Rejected — Option C, "make the existing forwarding architecture work as-is":** disproven empirically in
§2.3. Not a viable middle ground; listed here only so a future session doesn't have to re-derive why it
was ruled out.

This plan takes **no position** on A vs. B — see §9 Q1. What it does commit to: if B is chosen, the
scope below (§4–§6) is the right shape to execute against, evidence-based rather than invented at
implementation time; if A is chosen, §8 has the exact `docs/POSIT-COMPARISON.md`/`BACKLOG.md` edits ready
to make.

---

## 4. Evidence-based inventory (for Option B; grep-verified firsthand)

### 4.1 Reuse table

| Existing code | What it already proves / provides | Reused how |
|---|---|---|
| `src/features/yaml-diagnostics.ts` | The **only** existing `DiagnosticCollection` in this codebase — debounce (350ms), a generation-counter race guard against a slow async resolve overwriting a newer result, `onDidOpenTextDocument`/`onDidChangeTextDocument`/`onDidSaveTextDocument`/`onDidCloseTextDocument` wiring, `collection.set()` never `.clear()` (footgun avoidance) | Directly reusable *shape* for the new `DiagnosticCollection` lifecycle — same debounce/generation pattern, different trigger scope (per-cell-language, not per-filename) |
| `src/core/embedded/virtual-doc.ts` `buildVirtualContent`/`embeddedCellAt` | Identity-offset-mapping (blank everything except one language's cell bodies to equal-length spaces) — proven correct for completion/hover/definition/signature-help | The RANGE-MAPPING half is reusable as-is; the DELIVERY half (`TextDocumentContentProvider`, ephemeral rebuild-per-request) is **not** — §2.3 proves it doesn't get diagnosed. A new persistent, on-disk delivery path is needed (§5) |
| `src/core/embedded/lang-map.ts` `cellLanguageId` | Engine-token → languageId/extension map (python/r/julia/ojs→javascript) | Reusable for language routing; Julia has no researched server candidate yet (§2.4) |
| `src/providers/embedded.ts` `VirtualDocStore.evict` | Per-document cleanup on `onDidCloseTextDocument` | Pattern reusable for temp-file cleanup, but the *mechanism* differs — Posit's own disclosed hack (retype to `plaintext` to force a `didClose`) may be needed here too if a spawned LSP client doesn't expose a cleaner shutdown path |

### 4.2 Gaps (new code needed for Option B, not a narrowing like prior items)

- A **process-spawning + `vscode-languageclient` connection manager** for at least one external server —
  nothing in this codebase spawns and owns a long-lived LSP client today (`quarto/cli.ts` only does
  one-shot `execFile` calls for render/preview/`--paths`).
- A **real-file-backed temp-document lifecycle** (write/update/delete on disk, in-workspace per §2.2's
  `.quarto/`-folder finding) — this project's `test/fixtures/**` real-file patterns (notebook conversion,
  Session 63) are the closest existing precedent for "write a real file, clean it up in `afterEach`/finally,"
  but none of that code runs in the shipped extension itself today.
- **Binary-presence detection + graceful degradation** when the chosen server isn't installed — the
  existing `needsLanguageExtension` one-time-hint pattern (`lang-map.ts`) is a reusable UX precedent, but
  the underlying check (`registeredLanguages.includes(...)`) doesn't apply to a spawned external process;
  a new `which`/`execFile --version`-style probe is needed, mirroring `quarto/cli.ts` `resolveBinary()`'s
  own shape.
- **Settings** (`quarto.cellDiagnostics.enabled`/`.debounceDelay` or similar — naming is an open question,
  §9 Q3) and a new `package.json` `contributes.configuration` section — this project has no prior
  `contributes.configuration` entries at all (grep-confirmed: `package.json` has no `configuration` key
  today), so this is also a new manifest surface, not just new code.

---

## 5. Interface contracts (sketch only — contingent on Option B; NOT to be treated as final at implementation time)

```
core/diagnostics/temp-doc.ts (pure-ish; the fs write itself needs an injectable seam, per architecture §3.3)
  buildCellDocument(text: string, languageId: string): string   // reuses buildVirtualContent's blanking
  tempFilePath(workspaceRoot: string, docUri: vscode.Uri, ext: string): string  // deterministic per-(doc,lang)

features/cell-diagnostics.ts (impure adapter)
  registerCellDiagnosticsFeature(context): void
    - one LanguageClient per (language, spawned-server) — lazy-started on first relevant cell, not at activation
    - on .qmd open/change/save (debounced, mirroring yaml-diagnostics.ts): rebuild the temp file, send didChange
    - on .qmd close: send didClose (or the plaintext-retype trick if didClose can't be forced), delete the temp file
    - subscribe to the LanguageClient's own diagnostics (or vscode.languages.onDidChangeDiagnostics scoped to
      the temp file's URI) and re-publish, range-mapped, against the REAL .qmd URI via a DiagnosticCollection
    - binary-presence probe per language server, one-time degradation hint (mirrors needsLanguageExtension)
```

This is deliberately a sketch, not a committed design — a future implementation-planning session (if B is
chosen) should re-verify the exact `vscode-languageclient` API shape needed (e.g. can a single
`LanguageClient` be pointed at a `file:` URI outside the normal `documentSelector` root without confusing
its own workspace-root inference?) before committing to it, per this workstream's own "Interface-First
Design" step (§ARCHITECTURE_WORKSTREAM.md).

---

## 6. The slice(s) (if Option B is chosen)

Recommend Python-only as the tracer-bullet slice (mirrors 6e-1's own precedent — "the tracer bullet ...
+ ALL shared infra"), given Pyright/Ruff/Pyrefly are all license-clear MIT candidates (§2.4) and Python is
this project's most common cell language by every existing signal (run-cell, completion, hover, notebook
conversion all shipped Python-first). R and Julia would each be their own follow-up slice, contingent on
finding an equally clear MIT/permissive server candidate for each (not yet researched — §9 Q2). Each slice
needs its own full vertical-slice contract (SESSION_RUNNER.md §Vertical Slice Sessions gate a) — this plan
does not pre-declare one, since the interface (§5) is explicitly a sketch, not yet approved.

---

## 7. Failure-mode / risk analysis

| Risk | Severity | Notes |
|---|---|---|
| **R1 — This session's empirical grounding (§2.3) used VS Code's built-in TS/JS service, not a real external `vscode-languageclient`-based extension.** Whether a real Pylance/Pyright/R-language-server behaves identically (visibility-gated) or differently (workspace-membership-gated only, matching Posit's own framing more literally) is genuinely unconfirmed. | **High — this is the load-bearing open question for Option B's exact design.** | Posit's own PR prose describes a workspace-membership problem, not an editor-visibility one, and their fix (real files) doesn't mention needing to keep anything "shown." If real external LSP-based extensions sync purely on `workspace.openTextDocument` (standard LSP `textDocumentSync` behavior, per the generic client contract) without needing visibility, then a MUCH lighter fix than Option B's full self-spawned-server architecture might work: write a real in-workspace temp file + `openTextDocument` (no `showTextDocument`) + drive `didChange` via the *user's own already-running* extension's LSP client rather than spawning a new one. **This needs its own firsthand empirical spike — installing a real Python extension in a test Extension Development Host — before Option B's design is finalized**, not assumed from this session's necessarily-approximate stand-in test. |
| R2 — Duplicated resource usage | Medium | A spawned, self-owned language server runs *alongside* whatever the user's own Python extension is already running for the same files — real CPU/memory cost, and potentially divergent diagnostics from what the user sees in a plain `.py` file (undermining Posit's own "same signal as a real file" value prop, since Pyrefly/Ruff may disagree with the user's own configured Pylance/mypy/flake8 setup) |
| R3 — Problems-panel flicker | Low, disclosed | Posit's own known, accepted, unfixed cosmetic issue (§2.2) — expect the same here if the same real-file-vdoc technique is used |
| R4 — New dependency posture | Medium | First-ever "you must separately install X" ask beyond the Quarto CLI itself — a philosophy change worth the operator's explicit sign-off (§9 Q1), not something to slip in via an "obviously good" feature |
| R5 — Existing vdoc Problems-panel leakage (§2.2's PR #832 finding) | Low, but actionable independent of A/B | Worth a quick, SEPARATE, small audit of `src/providers/embedded.ts`'s existing vdocs for the same accidental-Problems-panel-entry bug Posit found and fixed in their own pre-existing forwarding vdocs — filed as its own small Polish/deferred candidate (§9 Q4), not bundled into this item |

---

## 8. Alternatives considered

| Alternative | Pros | Cons | Why not chosen (or: why it's the actual §3 options) |
|---|---|---|---|
| Extend the existing pull-based `embedded.ts` forwarding (the BACKLOG.md item-10 text's original framing) | Would have been the smallest possible change — reuse everything | **Empirically disproven** — no pull API for diagnostics exists (§2.1), confirmed not to work in this project's own vdoc architecture (§2.3) | Rejected, not a live option |
| Real file + `openTextDocument`, no `showTextDocument`, targeting VS Code's own built-in checker | Simple | Empirically disproven this session (§2.3 test 3) | Rejected for the built-in-checker case; **unresolved for a real external extension (R1)** |
| LSP 3.17 native notebook-document sync (vscode-jupyter's current approach) | The "correct," modern mechanism Microsoft now recommends | Requires VS Code's Notebook API — `.qmd` is a `TextDocument`, not a `NotebookDocument`; would require representing `.qmd` cells as notebook cells, a far larger, unrelated architectural change | Rejected — out of scope |
| Bundle/vendor a language-server engine directly into this extension (rather than spawning a separately-installed binary) | No new "you must install X" ask | A much bigger vendoring/NOTICE/binary-size commitment than Graphviz's small `viz.js` (Session 56) — a full type-checker binary/npm tree, per platform | Rejected in favor of the "separately installed, like the Quarto CLI itself" posture, if B is chosen |
| Accept the gap (Option A) | Zero new scope, consistent with existing minimalism | A real, disclosed, user-visible feature gap remains, and it's this refresh's own highest-ranked finding | **A live option — §3, §9 Q1** |
| Spawn dedicated LSP clients to specific external servers (Option B) | The only approach proven to actually work (Posit's own shipped precedent) | New dependency class, new maintenance surface, duplicated resource usage (R2) | **A live option — §3, §9 Q1** |

---

## 9. Open questions for the operator (resolve before or at implementation, not now)

- **Q1 (the big one).** Option A (accept the gap, document it, redirect effort to items 11+) vs. Option B
  (commit to the heavier spawned-language-server architecture, Python first)? This plan takes no position
  — see §3 for the honest tradeoff. **Recommendation if forced to pick: lean A** — this project's stated
  identity (MIT-only, delegate-to-installed-tooling, small footprint) is a real asset, and R1's unresolved
  status means even Option B's exact shape isn't fully known yet; picking B commits to discovering that
  mid-implementation rather than mid-planning.
- **Q2.** If B: Python only (this plan's assumption), or also commit to researching R/Julia server
  candidates now? (Not researched this session — §2.4.)
- **Q3.** If B: setting names — mirror Posit's exactly (`quarto.cells.diagnostics.enabled`/
  `.debounceDelay`, easier for users coming from Posit's extension) or this project's own naming convention
  (no existing `contributes.configuration` precedent to match — this would be the first)?
  **Recommendation: mirror Posit's naming** — zero benefit to inventing a different name for an identical
  user-facing toggle, and it's free (a `configuration` key name has no licensing weight, unlike
  implementation code).
- **Q4.** File the §7 R5 (Problems-panel-flicker audit of the *existing* completion/hover forwarding vdocs)
  as its own small, unranked `BACKLOG.md` Polish/deferred candidate now, independent of A/B? **Recommendation:
  yes** — it's real, small, and unrelated to whichever of A/B is chosen.
- **Q5.** If B: should the R1 spike (installing a real external language extension in a test Extension
  Development Host, to resolve whether visibility-gating is a built-in-TS/JS-specific artifact or a
  general VS Code constraint) be its own short planning/spike session before the implementation session, or
  folded into the start of the implementation session itself? **Recommendation: its own short spike
  session** — if R1 resolves unfavorably (a real extension needs the same must-be-visible workaround),
  that's a scope-changing finding that belongs in a plan, not discovered mid-implementation (FM #18/#19's
  spirit: don't let an implementation session silently re-become a planning session).

---

## 10. Quick reference

- **This project's diagnostics precedent:** `src/features/yaml-diagnostics.ts` (debounce/generation-guard
  pattern, directly reusable if B is chosen).
- **This project's embedded-forwarding precedent:** `src/providers/embedded.ts` /
  `src/core/embedded/virtual-doc.ts` / `src/core/embedded/lang-map.ts` (range-mapping reusable; delivery
  mechanism is NOT, per §2.3).
- **Posit's PRs (public prose only, never their source):** [#980](https://github.com/quarto-dev/quarto/pull/980),
  [#1013](https://github.com/quarto-dev/quarto/pull/1013), [#957](https://github.com/quarto-dev/quarto/pull/957),
  [issue #208](https://github.com/quarto-dev/quarto/issues/208).
- **MIT prior art:** [`microsoft/vscode-jupyter` wiki](https://github.com/microsoft/vscode-jupyter/wiki/Intellisense-for-notebooks-(old-way)),
  [VS Code Embedded Languages guide](https://code.visualstudio.com/api/language-extensions/embedded-languages).
- **License-checked Python server candidates (if B):** `microsoft/pyright` (MIT), `astral-sh/ruff` (MIT),
  `facebookresearch/pyrefly` (MIT).
