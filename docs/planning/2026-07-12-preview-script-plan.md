# Plan — `quarto.previewScript` (preview a standalone Quarto render script)

**Session:** 83 (planning) · **Date:** 2026-07-12 · **Workstream:** `ARCHITECTURE_WORKSTREAM.md`
**BACKLOG item:** 15, second half (`previewScript`; `previewFormat` shipped Session 82).
**Status of this document:** PLAN ONLY. Implementation is a separate future session (FM #18). Strict-TDD gate applies to the implementation session.
**Review:** this plan was adversarially verified by a 14-agent `Workflow` (5 refutation lenses × per-finding skeptic) that re-grounded every load-bearing claim against the real Quarto 1.7.33 CLI, the codebase, Posit's public manifest, and the VS Code docs. It found **8 confirmed defects in the first draft**, all corrected below and re-verified firsthand by the author. The two biggest corrections are called out in the banner.

> **⚠ Two corrections this plan makes to Session 82's handoff — and to its own first draft.**
>
> 1. **There are TWO kinds of Quarto render script, not one.** S82 (and this plan's first draft) modeled only *Jupyter percent scripts* (`# %% [markdown]` cells → jupyter engine). Quarto **also** renders/previews **knitr *spin* scripts** — a `.r`/`.R` file whose prose lives in roxygen `#' ---` … `#' ---` / `#'` comments (`isKnitrSpinScript`, quarto.js:28691) → the **knitr** engine, **no jupyter kernel**. The detector must recognize both. (Firsthand: `quarto preview spin.R` produces a real `Browse at http://localhost:7454/` preview on this machine with **no jupyter installed** — R 4.6.1 + knitr 1.51 suffice.)
> 2. **The Jupyter-percent detection regex is buggy, and S82's "scan for `# %%`" was wrong in the other direction.** The CLI's `/^\s*#\s*%%+\s+\[markdown|raw\]/` (quarto.js:37367) has no grouping, so `|` splits it top-level into `(…\[markdown)` **or** `(raw\])` — the second branch is **unanchored**, matching the literal substring `raw]` *anywhere* (even `arr[raw]` in ordinary code; firsthand: `quarto render` accepts such a file). So "first line must be a `# %% [markdown]` cell" is only half the truth, and a naive verbatim copy would silently hijack the Shape-B context key on ordinary code. §5.2 resolves this with a deliberate, disclosed choice.

---

## 1. Context

### 1.1 Problem statement

Quarto renders/previews not only `.qmd` documents but standalone **render scripts** — `.py`/`.jl`/`.r` files authored so that prose and code interleave. `quarto preview script.py` serves a live-reloading preview exactly like `quarto preview doc.qmd`. This project's `quarto.preview` **refuses** anything whose `languageId !== "quarto"` (`src/features/preview.ts:404`), so it cannot preview a script. Posit's extension ships a sibling `quarto.previewScript` for this. It is CHANGELOG: preview command family breadth, Sessions 82-85's remaining half.

### 1.2 What the user gets

A **"Quarto: Preview Script"** command that, when the active editor is a render script, launches the same live preview `quarto.preview` gives `.qmd` documents — reusing the entire existing `PreviewManager` lifecycle (spawn, URL parse, webview, process-group reaping) unchanged.

### 1.3 Hard constraints

- **Clean-room (Learning #1):** Posit's extension is AGPL-3.0. We read its **public declarative manifest** (`apps/vscode/package.json`, via `gh api`) for command IDs, titles, keybindings, `when`-clauses, activation events — facts, never implementation. All CLI/engine behavior is grounded firsthand against the installed Quarto 1.7.33 and its **MIT** CLI source (`/Applications/quarto/bin/quarto.js` — reading it is allowed; it is not the AGPL extension).
- **Strict TDD** at implementation. The detector is pure logic → unit-tested; the command is an adapter → integration-tested.
- **No orphaned preview servers** — the existing `PreviewManager` reaping is reused unchanged; new tests reap with the same `pgrep`/SIGKILL safety net.

---

## 2. Firsthand grounding (the evidence this plan rests on)

All commands run against **Quarto 1.7.33** on this machine, 2026-07-12. Engines available here: **knitr** (R 4.6.1, knitr 1.51 — `quarto check knitr` OK); **jupyter NOT installed** (`quarto check jupyter` → `Jupyter: (None)`).

### 2.1 `quarto preview` accepts a file arg and forwards to `quarto render`

`quarto preview [file] [args...]` — "arbitrary command line arguments … forwarded to `quarto render`." `--no-browser`, `--no-watch`, `--timeout <seconds>` all accepted — the same flags `PreviewManager` already uses for `.qmd`.

### 2.2 🔑 The complete render-script detection surface

Quarto selects an execution engine in `fileExecutionEngineAndTarget` by asking each engine's `claimsFile` (quarto.js:42199). Enumerating every engine's `claimsFile` (grep of quarto.js) gives the **complete** set of ways a `.py`/`.jl`/`.r` file becomes a previewable script — exactly **two** independent paths:

**Path A — Jupyter percent script** (jupyter engine, quarto.js:40597; the julia engine at :41498 reuses the identical predicate for `.jl`):
```js
const kJupyterPercentScriptExtensions = [".py", ".jl", ".r"];   // :37357
function isJupyterPercentScript(file, extensions) {
    const ext = extname2(file).toLowerCase();                    // case-insensitive
    if ((extensions ?? kJupyterPercentScriptExtensions).includes(ext))
        return !!Deno.readTextFileSync(file)
            .match(/^\s*#\s*%%+\s+\[markdown|raw\]/);             // :37367 — buggy, see below
    return false;
}
```
**Path B — Knitr spin script** (knitr engine, quarto.js:28465 `claimsFile: kRmdExtensions.includes(ext) || isKnitrSpinScript(file)`):
```js
function isKnitrSpinScript(file) {                               // :28691
    const ext = extname2(file).toLowerCase();
    if (ext == ".r")                                             // .r / .R only
        return /^\s*#'\s*---[\s\S]+?\s*#'\s*---/.test(Deno.readTextFileSync(file));
    return false;
}
```
So the **union** the detector must mirror is:

| Extension | Path A (jupyter percent) | Path B (knitr spin) | Runtime engine |
|---|---|---|---|
| `.py`, `.jl` | ✔ (percent regex) | — | jupyter (needs a kernel) |
| `.r` / `.R` | ✔ (percent regex) | ✔ (spin regex) | jupyter **or** knitr |

**The Path-A regex is buggy.** `/^\s*#\s*%%+\s+\[markdown|raw\]/` has no group, so `|` (lowest precedence) splits it into `(^\s*#\s*%%+\s+\[markdown)` **OR** `(raw\])`. Branch 2 is a bare unanchored `raw]` — it matches that substring **anywhere** in the file. Net CLI behavior: a `.py`/`.jl`/`.r` file is a percent script iff *(first non-blank line is `# %% [markdown…`)* **OR** *(the substring `raw]` appears anywhere, including inside ordinary code)*.

Empirical confirmation (`quarto render` engine-determination signal: *"Can't determine execution engine"* = not detected; *"Starting python3 kernel"* / knitr render = detected; cross-checked with the exact regexes in Node):

| Fixture | First non-blank line / content | CLI verbatim regex | CLI result |
|---|---|---|---|
| `# %% [markdown]` then code | `# %% [markdown]` | `true` | jupyter engine ✅ |
| blank lines, then `# %% [markdown]` | `# %% [markdown]` | `true` | jupyter engine ✅ |
| `# %%` code cell first, `# %% [markdown]` later | `# %%` | `false` | *Can't determine engine* ❌ |
| bare `# %%` code cells only | `# %%` | `false` | *Can't determine engine* ❌ |
| **code only, contains `arr[raw]`** | `# %%` / `arr[raw]` | **`true`** (unanchored `raw]`) | **jupyter engine** ⚠️ (bug) |
| **`spin.R`** (`#' ---`…`#' ---`) | `#' ---` | percent `false`; **spin `true`** | **knitr engine ✅ (no kernel)** |

### 2.3 Engine availability shapes the test strategy — but knitr rescues it

Jupyter is absent here (and likely in CI): any **Path-A** script — even markdown-only — makes Quarto start a python3 kernel that fails with `ModuleNotFoundError: nbformat`. **But Path-B (knitr spin) is kernel-free** and works end-to-end here: `quarto preview spin.R --no-browser --no-watch --timeout 3` → `Output created: spin.html` → `Browse at http://localhost:7454/` (the exact line `core/preview-url.ts:parseBrowseUrl` parses), clean self-exit, no orphan. **So a `spin.R` fixture gives the accept-path integration test a real, successful `quarto preview` round-trip** on any machine with R + knitr (this machine; a CI runner that installs them). The Path-A percent-script success round-trip remains unverifiable without jupyter and is the disclosed residual boundary (§7).

### 2.4 Posit's public manifest (declarative facts only, clean-room)

From `repos/quarto-dev/quarto/contents/apps/vscode/package.json` (via `gh api`):

- **Command:** `quarto.previewScript`, title **"Quarto Preview"** (no `category`). (Note: `quarto.preview`'s title is **"Preview"** with `category: "Quarto"` — a *different* string; the two do not share a title.)
- **Context key:** `quartoRenderScriptActive`.
- **Keybindings (mutual-exclusion):** `quarto.preview` → `ctrl+shift+k`/`cmd+shift+k`, `when: "!quartoRenderScriptActive"`; `quarto.previewScript` → same key, `when: "quartoRenderScriptActive"`.
- **Menus:** `previewScript` in `editor/title` and `editor/title/run`, `when: "quartoRenderScriptActive"`; in `commandPalette`, `when: "false"` (**hidden from the palette**).
- **Activation:** `onLanguage:r`, `workspaceContains:**/*.{qmd,rmd}`, `workspaceContains:**/_quarto.{yml,yaml}`, `**/_brand.{yml,yaml}`, `**/_extension.{yml,yaml}`, plus webview reactivation. **Not** `onLanguage:python`/`julia`.

---

## 3. Evidence-based codebase inventory

Greps run 2026-07-12 (planning-session requirement — the "files to change" list comes from search, not assumption).

| What | Finding | Consequence |
|---|---|---|
| `grep -rniE "previewScript\|renderScript\|isJupyterPercent\|isKnitrSpin\|# %%\|#' ---" src/ test/` | **zero hits** | Greenfield — no existing render-script code. |
| `src/features/preview.ts:71` `PreviewManager.openPreview(doc,{to?})` | Input-agnostic: `doc.uri.fsPath`, saves if dirty, spawns `buildPreviewArgs`, reaps. **No `languageId` check inside.** | **Reusable as-is** — `manager.openPreview(scriptDoc)` is the entire "preview" action. |
| `src/features/preview.ts:402/:419` gate fns | Both gate `languageId !== "quarto"` and error. | New command = sibling gate on *render-script-ness*, then `openPreview`. |
| `src/core/preview-format.ts` `buildPreviewArgs(fsPath,{to})` | `["preview",fsPath,"--no-browser",...]`. | Reused unchanged (`previewScript` passes no `to`). |
| `src/features/execution.ts:30,404` `IN_CELL_CONTEXT`/`updateCellContext` | Content-driven context-key precedent: `setContext` recomputed on selection/active-editor/document-change + at registration. | `quartoRenderScriptActive` follows this exact shape, keyed on a **content** predicate. |
| `package.json` `languages` | `.qmd/.rmd/.Rmd → quarto`; **nothing maps `.py/.jl/.r`.** | Detector keys on **file-name extension**, never `languageId` (script languageIds vary by user-installed extensions). Matches Quarto's own `extname().toLowerCase()`. **`.qmd`/`.rmd` are excluded by extension → `previewScript` and `preview` never both claim a file.** |
| `package.json` `keybindings` (15) | **No `quarto.preview` keybinding**, no `ctrl+shift+k`. | Adopting Posit's mutual-exclusion adds `ctrl+shift+k` to `quarto.preview` too. |
| `package.json` `activationEvents` | `onLanguage:quarto`, `onLanguage:yaml`. | Extension does **not** activate for a bare `.py/.jl/.r` script → §5.3 activation decision. |
| `test/integration/suite/preview.test.ts` / `preview-format.test.ts` | Spawn real `quarto preview <fixture>`; reap via `pgrep -f "preview.*<fixture>" || true` + SIGKILL in `afterEach`; `.qmd` fixtures (markdown engine, no kernel). | New tests reuse the harness; `spin.R` gives a kernel-free real-spawn fixture (§2.3). |

---

## 4. Decision — architecture

### 4.1 Component responsibilities

| Component | New/Reused | Responsibility |
|---|---|---|
| `src/core/render-script.ts` (**new, pure**) | new | `isRenderScript(fileName, text): boolean` — recognize **both** Path-A percent and Path-B spin scripts (§5.2). Single source of truth for the command gate and the context key. |
| `quarto.previewScript` command (`src/features/preview.ts`) | new adapter | Resolve `activeTextEditor`; if `isRenderScript(...)` → `manager.openPreview(doc)`; else an actionable message. |
| `quartoRenderScriptActive` key (Slice 2) | new adapter | `updateRenderScriptContext(editor)` mirroring `updateCellContext`. |
| `PreviewManager.openPreview` / `buildPreviewArgs` | **reused unchanged** | Whole spawn/URL/webview/reap lifecycle; `preview <file> --no-browser`. |
| `package.json` | edited | command (Slice 1); keybindings/menu/palette/activation (Slice 2). |

### 4.2 Interface contract — the one new pure function

```ts
/**
 * True iff (fileName, text) is a Quarto render script — either a Jupyter
 * percent script OR a knitr spin script, matching what `quarto preview`
 * will accept (see §5.2 for the deliberate divergence from the CLI's buggy
 * percent regex). Total function, no I/O, no throw; only fileName's
 * extension is read.
 */
export function isRenderScript(fileName: string, text: string): boolean;
```
- **Input:** `fileName` (extension only — `.py`/`.jl`/`.r`/`.R`), `text` (`document.getText()`).
- **Output:** boolean. Empty/whitespace text → `false`; untitled/no-extension → `false`.
- **Cost:** both candidate regexes are anchored near the file start (`^…`, no `m`; the spin regex is lazy `[\s\S]+?`), so recomputation on every keystroke of the active editor (the context-key driver) is cheap.

### 4.3 Why a separate command

`quarto.preview` gates on `languageId === "quarto"` with a `.qmd`-specific message; Posit keeps the two distinct; and the mutual-exclusion keybinding needs two IDs. The shared work already lives in `PreviewManager.openPreview` (a deep module), so the two commands are thin single-purpose gates over it — no duplication to consolidate.

---

## 5. The decisions the plan must make explicit

### 5.1 Detector keys on extension, not languageId — LOCKED

Nothing maps `.py/.jl/.r` to a stable languageId here, and `.r`/`.jl` languageIds vary by installed extensions. The detector reads the **file-name extension**, exactly as Quarto does. `.qmd`/`.rmd` are not in the set, so `preview` and `previewScript` never both claim a file.

### 5.2 🐉 Detector semantics — the central design decision (verbatim-CLI vs intent-faithful)

The detector must cover Path B (knitr spin, `/^\s*#'\s*---[\s\S]+?\s*#'\s*---/` for `.r`/`.R`) — that half is unambiguous. The decision is how to handle **Path A**, given the CLI regex's unanchored-`raw]` bug (§2.2):

- **Option (i) — verbatim CLI:** copy `/^\s*#\s*%%+\s+\[markdown|raw\]/` exactly. *Agrees byte-for-byte with what `quarto preview` accepts*, **including** the bug: any file containing `raw]` (e.g. `df.loc[raw]`) is a "render script." For the command that means offering to preview ordinary code; for the Shape-B context key it means **`Ctrl+Shift+K` silently rebinds to `previewScript` while editing ordinary Python/R/Julia** that happens to contain `raw]`. Firsthand-confirmed false-positive.
- **Option (ii) — intent-faithful (RECOMMENDED):** the CLI regex with its one obvious bug fixed by grouping — `/^\s*#\s*%%+\s+\[(markdown|raw)\]/` — i.e. "the first non-blank line is a `# %% [markdown]` or `# %% [raw]` cell." Plus Path-B spin. This **agrees with the CLI on every conventionally-structured render script** (which start with a markdown/raw cell) and **diverges only on the buggy branch-2 cases**: a code-cell-first file whose only marker is a later `# %% [raw]` cell, and ordinary code containing `raw]`. Both divergences are *safe*: the former is a rare, unconventional script (user gets "not a render script"; recoverable); the latter is exactly the junk we want to exclude (no context-key hijack, no offering to preview code).

**Recommendation: Option (ii).** The detector's real job is "does this file have render-script *structure*?", not "would Quarto's buggy regex return true?". (ii) makes the command and the context key both well-behaved and still matches the CLI on all real scripts. **Disclose the divergence** and its rationale in code + session notes. *(If the operator prefers bug-for-bug fidelity, (i) is available — but then §5.3's context-key false-positive must be accepted or the key given a stricter predicate than the command.)*

**Required `isRenderScript` unit battery (strict TDD, one at a time) — and the cases that actually discriminate (i) from (ii):**

| Input | Ext | Expect under (ii) | Note |
|---|---|---|---|
| `# %% [markdown]` first | .py | `true` | Path-A markdown, conventional |
| `# %% [raw]` first | .jl | `true` | Path-A raw-first |
| blank lines then `# %% [markdown]` | .r | `true` | leading blanks |
| `.R`/`.PY` uppercase, markdown-first | .R/.PY | `true` | case-insensitive ext |
| `#' ---`…`#' ---` roxygen header | .r | `true` | **Path-B knitr spin** |
| `#' ---`…`#' ---` header | .py | `false` | spin is `.r`-only |
| code cell first, `# %% [markdown]` later | .py | `false` | CLI also rejects — agree |
| **code cell first, `# %% [raw]` later** | .py | **`false`** | **discriminator**: (i)/CLI say `true` (bug); (ii) `false` |
| **ordinary code w/ `arr[raw]`, no cells** | .py | **`false`** | **discriminator**: (i)/CLI say `true` (bug); (ii) `false` |
| plain `.txt` / `.qmd` | .txt/.qmd | `false` | wrong extension |
| empty / whitespace-only | .py | `false` | total function |

Break-revert-prove the two **discriminator** rows — they are the only cases that pin Option (ii) against a naive verbatim copy (or vice-versa). The first draft's battery omitted them, so it could not have caught the very bug this section documents (the review's finding #8).

### 5.3 🐉 Scope & activation — the operator decision (two viable shapes)

The preview action is trivially reused; the real surface is *how much of Posit's UX gating to replicate*, gated on the activation problem: **`quartoRenderScriptActive` can only be set while the extension is active, and the extension does not currently activate for `.py`/`.jl`/`.r` files.**

**Shape A — Command-only (minimal, 1 session).** `quarto.previewScript` as a palette-visible command with an internal `isRenderScript` gate. **No** context key, keybinding, or new activation (VS Code ≥1.74 auto-activates on command invocation — verified against the activation-events doc). Errors if the active file isn't a render script (as `quarto.preview` errors on a non-`.qmd`).
- *Pros:* smallest; matches this project's keybinding-minimal preview posture; no broad-activation cost; one clean slice.
- *Cons:* no `Ctrl+Shift+K`, no editor-title button, no mutual-exclusion; palette entry shows for every file.

**Shape B — Posit-parity UX (2 slices).** Slice 1 = Shape A. Slice 2 adds `quartoRenderScriptActive` (`updateRenderScriptContext`), the `Ctrl+Shift+K` mutual-exclusion pair (on **both** commands), the `editor/title` button (`when: quartoRenderScriptActive`), palette gating, and activation events.
- **Activation — mirror Posit fully:** `onLanguage:r` **and** `workspaceContains:**/*.{qmd,rmd}` **and** `workspaceContains:**/_quarto.{yml,yaml}`. (The first draft dropped the `_quarto.{yml,yaml}` event — the review's finding #6 — which would leave a render-script-only Quarto project, `_quarto.yml` + `.py` scripts but no `.qmd`, unactivated. Include it.) Deliberately **not** `onLanguage:python`/`julia` (Posit's judgment: activating for every Python/Julia file is too costly; this plan agrees).
- **Palette sub-decision:** Posit hides `previewScript` (`when:false`). This project favors palette discoverability → recommended `when: "quartoRenderScriptActive"` (visible only for scripts) — a small disclosed divergence.
- **Context-key false-positive (only under §5.2 Option (i)):** a verbatim detector makes the key `true` for any file containing `raw]`, hijacking `Ctrl+Shift+K` on ordinary code. **Option (ii) eliminates this** — another reason (ii) is recommended. Record in §8's failure-mode table.
- **⚠ Activation limitation (honest, shared by Posit):** a standalone `.py`/`.jl` script opened with **no** Quarto workspace file present won't activate the extension → the key stays unset and the keybinding/button are inert until activation happens otherwise. The palette command still works (auto-activates on invoke). The dominant case — a Quarto project containing both docs and render scripts — is covered by the two `workspaceContains` events. `.r`/`.R` scripts are additionally covered by `onLanguage:r`.

**Recommendation:** **Shape B as two slices** — Slice 1 (Shape A) ships a working, independently useful capability (passes "if I stop here, does something work?"); Slice 2 layers parity gating. The operator may stop after Slice 1, or (given the small size) fold both into one session. Confirm at the implementation kickoff via `AskUserQuestion`.

---

## 6. Implementation phases (each a SEPARATE session, strict TDD, vertical)

### Slice 1 — the `quarto.previewScript` command (Shape A)

**Layers (checkpoint-commit at each boundary; ≤5 files/commit):**
1. **L1 core** — `src/core/render-script.ts` `isRenderScript` + `test/unit/render-script.test.ts`. Strict TDD, one §5.2 case at a time; the two discriminator rows break-revert-proven.
2. **L2/L3 adapter + manifest + integration test** (one commit, per the S82 `previewFormat`/`create-project` precedent) — `quarto.previewScript` in `registerPreviewFeature`, a `previewScriptActiveDocument(manager)` gate, `package.json` command entry, fixtures `test/fixtures/render-script-spin.R` (valid Path-B, kernel-free) + `test/fixtures/not-a-render-script.py` (code-cell-first), and `test/integration/suite/preview-script.test.ts`.

**What DONE looks like:** "Quarto: Preview Script" on a `spin.R` editor reaches `manager.openPreview` and (with R+knitr) produces a real preview; on a non-script editor it shows the message and does **not** spawn. Full verify matrix green; clean `.vsix`.

**Verification commands:** `npm run check-types` · `npm test` · `npm run test:integration` · `npm run package`.

**Test strategy (§2.3 engine reality):**
- *Detector* — exhaustive pure unit tests (§5.2), byte-faithful, no engine needed. Highest value.
- *Reject path* (deterministic) — active editor = `not-a-render-script.py` (or a `.qmd`) → the gate message shows (monkey-patch `showErrorMessage`, the established stub technique — precedent: the `new-document`/`convert-notebook` suites) and `pgrep` count stays 0.
- *Accept path, REAL round-trip* — active editor = `render-script-spin.R` → command reaches `openPreview` → `quarto preview spin.R` renders via **knitr** (no jupyter) → assert a real preview appears (webview / `Browse at` URL parsed), then reap via the `pgrep`/SIGKILL `afterEach`. This is a genuine success round-trip, not a fast-fail. **Requires R + knitr in the test environment** (present here; a CI runner must install them — state this in the suite header).
- *Accept path fallback if R+knitr absent* — a Path-A percent fixture instead: the command reaches `openPreview`, `quarto preview script.py` **fast-fails in ~1 s** on missing jupyter (firsthand-verified: `spawnPreview`'s `child.on("close")` settles the promise; **no** 60 s `START_TIMEOUT_MS` hang) and surfaces Quarto's own "exited before it was ready" error — a *different* string from the gate's reject message. Assert only that the **gate** passed (the reject message is absent) and that no process orphans; do **not** assert a real URL. (This is why the accept-path assertion must target the gate-reject string specifically, not "no error at all.")
- *Disclosed residual (FM #24):* a successful **Path-A (jupyter)** preview round-trip is unverifiable without jupyter. With the `spin.R` fixture, the *success* path IS covered (knitr) — a real improvement over the first draft's "residual boundary."

**Session boundary:** Slice 1 is one session. Close out when the command previews `spin.R` and rejects non-scripts. Do not start Slice 2.

### Slice 2 — Posit-parity gating (`quartoRenderScriptActive` + keybinding + menu + activation)

**Layers:**
1. **L1 adapter (context key)** — `updateRenderScriptContext(editor)` in `preview.ts` reusing `isRenderScript`, wired to `onDidChangeActiveTextEditor` + `onDidChangeTextDocument` + a registration-time call (mirroring `execution.ts:updateCellContext`). Integration test: open `spin.R` → key true; open a `.qmd` → false. Break-revert the wiring.
2. **L2 manifest** — `ctrl+shift+k`/`cmd+shift+k` for `quarto.preview` (`when:"!quartoRenderScriptActive"`) **and** `previewScript` (`when:"quartoRenderScriptActive"`); `editor/title` menu (`when:"quartoRenderScriptActive"`); palette entry `when:"quartoRenderScriptActive"` (disclosed divergence from Posit's `false`); activation events `onLanguage:r` + `workspaceContains:**/*.{qmd,rmd}` + `workspaceContains:**/_quarto.{yml,yaml}`. Update the manifest-shape regression test.

**What DONE looks like:** editing `spin.R` in a Quarto workspace, `Ctrl+Shift+K` invokes `previewScript` and the editor-title button appears; editing a `.qmd`, the same key invokes `preview`; the key flips on editor/document change. Full matrix green.

**Session boundary:** one session. The activation limitation (§5.3) is disclosed, not "fixed" by broad activation.

### 🐉 Here-be-dragons (where the implementer should slow down)

- **Two detection paths** — do not ship only the percent path (S82's blind spot); `.r`/`.R` spin scripts are a first-class case and the *only* kernel-free one for tests.
- **The percent regex bug (§5.2)** — decide (i) vs (ii) *consciously*; the "obvious cleanup" regex is Option (ii), which is a real semantic choice, not a no-op. Lock it with the two discriminator tests, or the same fidelity gap that bit S82 recurs.
- **Context-key ⇄ activation coupling** (Slice 2) — test the covered case (script in a Quarto workspace) and disclose the uncovered case (lone script, no workspace). Do not paper over with `onLanguage:python`.
- **Engine-dependent tests** — the success round-trip needs knitr (spin) or jupyter (percent). Prefer the spin fixture; if neither engine is present, fall back to the gate-only assertion and disclose.
- **Untitled/dirty buffers** — untitled has no extension → `false` (correct: `quarto preview` needs a file on disk). `openPreview` already `save()`s a dirty on-disk doc.

---

## 7. Alternatives considered

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **Detect only Jupyter percent (`# %%`)** | simpler | **Misses knitr spin `.r`/`.R`** — false-negatives the common R spin workflow (and the only kernel-free test fixture). | Rejected — incomplete surface. |
| **Verbatim CLI percent regex (§5.2 (i))** | bug-for-bug fidelity to `quarto preview`'s acceptance | context-key hijack + offering to preview ordinary code containing `raw]`. | Available; not recommended. |
| **Intent-faithful detector (§5.2 (ii))** | agrees with CLI on all real scripts; safe context key | diverges from the buggy CLI on `raw]`-junk / code-first-then-raw (both safe). | **Recommended.** |
| **Gate on `languageId`** | reuses the `languageId` pattern | `.r`/`.jl` languageIds vary by installed extensions; unstable; diverges from Quarto. | Rejected — extension is the stable key. |
| **Teach `quarto.preview` to accept scripts (one command)** | one command | breaks Posit parity; mutual-exclusion needs two IDs; `.qmd`-specific message. | Rejected. |
| **Shape A only (no context key)** | minimal | no keybinding/menu/mutual-exclusion. | Viable — recommended Slice 1; operator may stop here. |
| **Add `onLanguage:python`/`julia`** | key live for lone scripts | activates for every Python/Julia file (Posit rejected). | Rejected as default; the only way to close the activation gap. |

---

## 8. Impact analysis

| Surface | Impact | Changes? |
|---|---|---|
| `src/core/render-script.ts` | new pure module (both paths) | **new** |
| `src/features/preview.ts` | +command + gate fn (Slice 1); +context-key updater & wiring (Slice 2) | **edited** |
| `PreviewManager.openPreview` / `buildPreviewArgs` | reused | **unchanged** |
| `package.json` | command (Slice 1); keybindings/menu/palette/activation (Slice 2) | **edited** |
| `src/extension.ts` | none — `registerPreviewFeature` already wired | **unchanged** |
| `quarto.preview` behavior | gains a `Ctrl+Shift+K` binding (Slice 2); logic unchanged | **manifest-only** |
| Existing `.qmd` preview / previewFormat | untouched | **unchanged** |
| Docs | `docs/POSIT-COMPARISON.md` preview-family row → parity; `PROJECT_LEARNINGS.md`; `CHANGELOG.md`/`BACKLOG.md` at close-out | **edited at close-out** |

**Failure-mode analysis.** False negative (`isRenderScript` misses a real script) → command errors, recoverable, no bad state. False positive from the command → `quarto preview` errors ("Can't determine engine") into the preview Output channel, graceful, no orphan (reaping unchanged). **Context-key false positive (Shape B under §5.2 Option (i) only):** `Ctrl+Shift+K` silently rebinds to `previewScript` while editing ordinary code containing `raw]` — mitigated by choosing Option (ii). Missing engine (jupyter/knitr) → spawn fast-fails into the channel with Quarto's own message, no orphan (firsthand-verified: ~1 s, `child.on("close")` settles). No path corrupts state or leaks a process beyond the existing reaping guarantees.

---

## 9. Verification plan (summary)

- **Detector:** pure unit tests, both paths, the two §5.2 discriminator rows break-revert-proven.
- **Command gating:** integration reject path (deterministic) + accept path (real knitr `spin.R` round-trip; percent fast-fail fallback) with `pgrep`/SIGKILL reaping.
- **Context key (Slice 2):** flip test (`spin.R` → true; `.qmd` → false), wiring break-revert-proven.
- **Manifest (Slice 2):** shape assertion that the two `ctrl+shift+k` bindings carry complementary `when` clauses; the three activation events present.
- **Build equivalent:** `check-types` + `npm test` + `npm run test:integration` + `npm run package`, at each checkpoint boundary.
- **Disclosed boundary:** a successful **jupyter-percent** preview round-trip requires jupyter and is not a CI gate; the knitr-spin success path IS covered where R+knitr are present.

---

## 10. Open questions for the implementation-session kickoff

1. **Scope (§5.3):** Shape A (command-only, 1 session) or Shape B (Posit-parity, 2 slices)? *(Recommend Shape B as two slices.)*
2. **Detector semantics (§5.2):** intent-faithful Option (ii, recommended) or verbatim-CLI Option (i)? This governs the two discriminator tests and the Shape-B context-key false-positive.
3. **Palette visibility (Slice 2):** gate `when: "quartoRenderScriptActive"` (recommended, discoverable) or hide `when:false` (Posit-exact)?
4. **Command title:** "Preview Script…" (this project's ellipsis convention, e.g. "Preview Format…") vs Posit's exact "Quarto Preview". (Posit's would read as a second "Quarto Preview" in the palette; the ellipsis convention is the reason to diverge — *not* a title collision with `quarto.preview`, whose title is "Preview".)
```
