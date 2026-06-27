# Quarto VS Code Extension — Architecture & Phased Implementation Plan

**Date:** 2026-06-27
**Session:** 1 (Planning — Architecture workstream)
**Status:** DRAFT — awaiting operator ratification
**Author:** Session 1
**Supersedes:** none (first plan)
**Workstream:** `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`

> **This document is a deliverable, not a license to start coding.** Implementation happens in separate sessions, one phase each (SESSION_RUNNER §Planning Sessions, FM #18). The "Decisions to Ratify" section at the end lists what the operator should confirm or override before Phase 1 begins.

---

## 1. Executive Summary

Build an **MIT-licensed VS Code extension** that reimplements the core Quarto authoring loop independently of Posit's official (AGPL-3.0) extension. The extension **shells out to the locally-installed Quarto CLI** (MIT, verified `1.7.33`) for rendering/preview and provides editor intelligence **in-process** (no separate language-server process for v1).

The single load-bearing decision — *TextMate grammar only vs. full Language Server* — resolves to a three-tier model **A → B → C** where we **ship A, build to B, and defer C**:

- **A. TextMate grammar + `language-configuration.json`** — all syntax highlighting (prose, YAML front matter, `{python}/{r}/{julia}/{ojs}` cells), brackets, comments, folding. Declarative, no runtime code.
- **B. + in-process `vscode.languages.register*Provider`** — completion, hover, outline, navigation, diagnostics, and embedded-cell intelligence via the virtual-document request-forwarding technique. **This is v1's center of gravity.**
- **C. + out-of-process LSP (`vscode-languageclient`/`vscode-languageserver`)** — deferred. Only earns its cost when we need cross-file project-wide indexing at scale or multi-editor reuse.

The migration A→B→C is **strictly additive on the grammar and largely additive on the logic**, *provided* we follow one architectural guardrail from day one: **the intelligence core is a `vscode`-free pure-TS library; the extension is a thin adapter over it.** This makes B→C cheap and — critically given this environment has **no `code` CLI on PATH** — makes the bulk of the logic unit-testable headlessly.

**v1 scope = the core authoring loop:** highlight → render → preview → run-cell → outline → cross-reference/citation completion. The Visual (WYSIWYM) editor, Zotero sync, the Assist panel, and project-wide workspace indexing are **explicitly descoped from v1**.

---

## 2. Context

### 2.1 Problem statement

VS Code users authoring Quarto `.qmd` documents want first-class support — highlighting, one-key render and live preview, running code cells, and completion for YAML/citations/cross-references — without depending on an AGPL-3.0 extension. This project delivers that under MIT.

### 2.2 Hard constraints

| Constraint | Source | Consequence for the plan |
|---|---|---|
| **MIT licensing boundary** | `CLAUDE.md`, `CONTEXT.md` | Posit's official extension, its LSP, the Visual Editor, and Panmirror are **all AGPL-3.0** (confirmed twice this session, see §2.4). They are **look-but-don't-copy** reference only. We build on MIT upstreams instead. |
| **Quarto CLI is a runtime dependency** | `CONTEXT.md` | Render/preview shell out to `quarto`. The extension must degrade gracefully (clear message, not a crash) when the CLI is missing, too old, or a render dependency (e.g. Jupyter) is absent. |
| **Documented `vscode.*` API only** | `CONTEXT.md` | No undocumented internals. Every feature maps to a documented contribution point or provider API. |
| **No `code` CLI on PATH** (this env) | Verified this session | The Extension Development Host can't be driven headlessly. Runtime smoke-tests are a **manual F5** step; automated integration tests use `@vscode/test-electron` (which downloads its own VS Code and does *not* need the `code` CLI). The pure-core library is unit-tested with no VS Code at all. |

### 2.3 Current state

**Greenfield.** Single commit (methodology bootstrap). No `package.json`, no `src/`, no toolchain. Verified environment:

- Quarto CLI **1.7.33** — `render`, `preview`, `convert`, `create`, `check` subcommands present.
- Node **v22.21.1**, npm **11.10.0**.
- `quarto preview <file>` prints `Browse at http://localhost:<port>/` to stdout (the line the preview webview must parse). Verified live this session.
- `quarto preview --timeout N` exits only on **no active clients** — it does **not** reliably self-terminate; the extension must own the preview process lifecycle (kill on panel close). Verified live this session.
- Code-cell execution via the CLI requires **Jupyter** (`nbformat`) in the active Python env; absent here → `ModuleNotFoundError`. A real degradation case. Verified live this session.

### 2.4 Licensing & reference-architecture findings (evidence-based)

Two independent research passes this session (each confirmed against the live `quarto-dev/quarto` repo via the GitHub API, the VS Code Marketplace, and `quarto.org`) established:

**License — the official stack is AGPL-3.0.** Confirmed from `apps/vscode/package.json` (`"license": "agpl-3.0"`), `apps/vscode/LICENSE` (AGPL-3.0 full text), the root README license table (extension, `apps/lsp`, Visual Editor, Panmirror all AGPL-3.0), and `quarto.org/license.html`. The separate **Quarto CLI is MIT**; the `@quarto/*` npm helper packages are MIT; the OJS runtime is ISC.

**Reference architecture — Posit uses TextMate grammar + a full out-of-process LSP** (`quarto-lsp`, `vscode-languageclient ^8`), where the LSP is a **fork of Microsoft's `vscode-markdown-languageservice`** (dual Microsoft+Posit copyright headers in `apps/lsp/src/service/index.ts`), re-licensed AGPL-3.0. Execution, preview, and the Visual Editor are in-process / webview stacks.

**Clean MIT building blocks we MAY use** (licenses individually confirmed via each project's `package.json`/LICENSE):

| Asset | License | Use |
|---|---|---|
| `microsoft/vscode-markdown-tm-grammar` | MIT | Base markdown TextMate grammar to fork and extend with `{lang}` cell + YAML injections. |
| `wooorm/markdown-tm-language` | MIT | Alternative base grammar; explicitly handles YAML/TOML front matter, math, GFM. |
| `mjbvz/vscode-fenced-code-block-grammar-injection-example` | MIT | Canonical injection-grammar pattern for fenced code blocks. |
| `microsoft/vscode-markdown-languageservice` | MIT | LSP-typed Markdown intelligence (links, symbols, folding, references, smart-select). Usable in-process as a library; CommonMark-targeted. |
| Quarto CLI | MIT | Shell-out runtime dependency. |

> **The defining decision: we build our own intelligence core on MIT upstreams. We never copy from `apps/vscode`, `apps/lsp`, `apps/panmirror`, or `packages/editor`.** Studying their design for inspiration is fine; copying or close-adapting their source is not.

---

## 3. The Load-Bearing Decision — Language-Support Architecture

> 🐉 **HERE BE DRAGONS.** This is the highest-stakes, lowest-reversibility decision in the project. It was flagged in `CONTEXT.md` as under-review. It is resolved below; the resolution governs every later phase.

### 3.1 The three tiers

| Tier | What it is | What it delivers |
|---|---|---|
| **A** | TextMate grammar (`contributes.grammars`) + `language-configuration.json` | Highlighting of prose, YAML front matter, and `{python}/{r}/{julia}/{ojs}` cells; bracket matching; comment toggle; folding markers; auto-close. **Zero runtime code.** |
| **B** | A **+** in-process `vscode.languages.register*Provider` (CompletionItem, Hover, Definition, DocumentSymbol, FoldingRange, Diagnostics, SemanticTokens…) running in the extension host | All single-document intelligence: YAML/cell-option/citation/cross-ref completion, hover, outline, navigation, diagnostics, **and embedded Python/R/Julia completion via virtual-document request forwarding**. |
| **C** | B **+** out-of-process Language Server (`vscode-languageclient` ↔ `vscode-languageserver`) | Project-wide cross-file indexing (workspace symbols, cross-file cross-refs/citations), heavy parsing isolated off the UI thread, reuse of the server in non-VS-Code editors. |

### 3.2 Decision

**Ship A. Build to B. Defer C.** v1 targets **B**.

**Rationale:**

1. **Nothing in single-document `.qmd` intelligence *requires* an out-of-process server.** In-process providers cover completion, hover, navigation, outline, and diagnostics for the open document. Even embedded-cell Python/R completion uses **request forwarding** (`vscode.executeCompletionItemProvider` against a per-language virtual document) — the same technique Posit uses — which works on plain in-process providers. (Confirmed against the VS Code Embedded Languages guide.)
2. **The genuine drivers for C are absent in v1.** An LSP earns its keep for (a) cross-file project indexing at scale, (b) reusing the server in other editors, or (c) isolating heavy parsing off the UI thread. v1 is single-document and VS-Code-only; per-document parsing of a `.qmd` is cheap.
3. **B→C is cheap *if* we keep the core `vscode`-free.** Microsoft's `vscode-markdown-languageservice` already returns LSP-typed results. If our parsing/analysis lives in pure functions decoupled from `vscode.*`, promoting them behind an LSP transport later is relocation, not rewrite.
4. **Starting at C would be astronaut architecture** (Architecture anti-pattern #2): paying the cost of a second process, serialization, and cross-boundary debugging for scale we don't have yet.

### 3.3 The load-bearing guardrail (adopt in Phase 1, hold forever)

> **The intelligence core is a pure-TS library that does not import `vscode`. The extension is a thin adapter that registers providers and translates between `vscode.*` types and core types.**

This single rule pays three dividends:
- **Cheap B→C migration** — the core moves server-side untouched.
- **Headless testability** — the core is unit-tested with `vitest`/`mocha` and `npm test`, no Extension Development Host, no `code` CLI (which this environment lacks).
- **Single source of truth** — parsing the `.qmd` region model (front matter, cells, headings, labels, citations) happens once; every provider consumes it.

Proposed boundary:

```
src/
  extension.ts          # activate/deactivate — thin; wires features + providers
  quarto/cli.ts         # resolve binary, version-check, run render/preview  (imports child_process, vscode for config)
  core/                 # ← PURE TS, NO `vscode` import. Unit-tested headlessly.
    qmd/model.ts        #   parse a .qmd into a region model (frontmatter | cell | prose | heading)
    refs.ts             #   index @fig-/@tbl-/@sec-/@eq- labels
    citations.ts        #   parse .bib / CSL-JSON → citekeys
    completion/*.ts     #   pure: (model, position) -> CompletionItem[]  (core types, not vscode types)
  features/
    render.ts           # command → cli.ts → OutputChannel
    preview.ts          # command → cli.ts preview → webview + lifecycle
    execution.ts        # run-cell commands → delegate to Jupyter/terminal
  providers/*.ts        # vscode adapters: wrap core/ functions in register*Provider
syntaxes/quarto.tmLanguage.json
language-configuration.json
snippets/*.json
test/unit/              # vitest — pure-core
test/integration/       # @vscode/test-electron
```

### 3.4 Reversibility summary

A is **permanent** (the grammar is never thrown away). A→B is additive (new providers, grammar untouched). B→C relocates the already-isolated core behind a transport. **No tier discards prior work.** This is why starting in-process carries no architectural penalty.

---

## 4. Tech Stack (proposed — ratify in §12)

- **Language:** TypeScript (strict) on Node.js, VS Code Extension API.
- **Bundler:** esbuild (fast, the de-facto extension bundler).
- **Packaging:** `@vscode/vsce` → `.vsix` (the release gate).
- **Unit tests:** `vitest` (or `mocha`) for the pure `core/` — runs under `npm test`, no VS Code.
- **Integration tests:** `@vscode/test-electron` — downloads its own VS Code; no `code` CLI needed.
- **Engine target:** `engines.vscode` ≥ a recent stable (propose `^1.90.0`; ratify). Node ≥ 18 (have 22).
- **Activation:** lazy — `onLanguage:quarto` + command activation events, **never `*`** (activation-time budget).
- **Runtime dep:** Quarto CLI ≥ 1.7 (have 1.7.33), resolved via a `quarto.path` setting with PATH fallback.

---

## 5. Feature Inventory (parity target → v1 disposition)

Condensed from the confirmed contribution points of Posit's extension (47 commands). **Effort** is for an independent MIT reimplementation. **Disposition:** ✅ v1 / 🔶 v2 / ⛔ descoped-from-v1.

### 5.1 Rendering & preview
| Feature | Effort | Disposition |
|---|---|---|
| `Quarto: Render Document` (shell `quarto render`, Output channel) | SMALL | ✅ v1 (Phase 3) |
| `Quarto: Preview` (live webview, `quarto preview`, reload-on-save) | LARGE | ✅ v1 (Phase 4) |
| `Quarto: Verify Installation` (CLI probe + version) | SMALL | ✅ v1 (Phase 1) |
| Render Project / Preview Format / Render-on-Save | SMALL–MED | 🔶 v2 |
| Clear Cache | SMALL | 🔶 v2 |

### 5.2 `.qmd` language support
| Feature | Effort | Disposition |
|---|---|---|
| File association (`.qmd`/`.rmd` → `quarto`) | SMALL | ✅ v1 (Phase 2) |
| TextMate grammar (markdown + YAML + `{lang}` cells) | LARGE | ✅ v1 (Phase 2) |
| `language-configuration.json` (brackets/comments/folding) | SMALL | ✅ v1 (Phase 2) |
| Embedded mini-langs (dot/mermaid/typst grammars) | MEDIUM | 🔶 v2 |

### 5.3 Editor intelligence (in-process, Tier B)
| Feature | Effort | Disposition |
|---|---|---|
| Document outline / symbols (headings + cells) | SMALL | ✅ v1 (Phase 6a) |
| Cross-reference completion + go-to-definition (`@fig-/@tbl-/@sec-/@eq-`) | MEDIUM | ✅ v1 (Phase 6b) |
| Citation completion (`@key` from `.bib`/CSL-JSON) | MEDIUM | ✅ v1 (Phase 6c) |
| YAML front-matter + cell-option `#|` completion (schema-driven) | LARGE | 🔶 v2 (Phase 6d) — needs Quarto's YAML schema 🐉 |
| Embedded-cell language completion (virtual-doc forwarding) | MEDIUM–LARGE | 🔶 v2 (Phase 6e) 🐉 |
| Hover (yaml/ref/image/math), diagnostics, smart-select, folding ranges | MEDIUM | 🔶 v2 |
| Workspace symbols / cross-file indexing | MEDIUM | ⛔ descoped (the genuine Tier-C driver) |

### 5.4 Code-cell execution
| Feature | Effort | Disposition |
|---|---|---|
| Run cell / advance / above / below / all; insert cell; cell navigation | MEDIUM (family) | ✅ v1 (Phase 5) — delegate to Jupyter/Python/R extensions |
| Executable-cell background highlighting (decorations) | SMALL | 🔶 v2 |

### 5.5 Authoring aids
| Feature | Effort | Disposition |
|---|---|---|
| Snippets | SMALL | 🔶 v2 (Phase 7) |
| Math preview webview (`previewMath`) | MEDIUM | 🔶 v2 (Phase 7) |
| Diagram preview (mermaid/graphviz) | MEDIUM | 🔶 v2 |
| Bold/italic/code toggles | SMALL | 🔶 v2 (Phase 7) |
| Image paste | MEDIUM | 🔶 v2 |
| Assist panel | LARGE | ⛔ descoped |
| Zotero web-library sync | LARGE | ⛔ descoped |

### 5.6 Project / visual editor / misc
| Feature | Effort | Disposition |
|---|---|---|
| New Document / Notebook / Presentation; Create Project (CLI wrappers) | SMALL–MED | 🔶 v2 |
| Convert `.qmd`↔`.ipynb` (`quarto convert`) | SMALL | 🔶 v2 |
| Walkthrough; settings UI | SMALL | 🔶 v2 |
| **Visual (WYSIWYM) editor** (Panmirror/ProseMirror equivalent) | **VERY LARGE** | ⛔ **descoped** — largest single item; AGPL-only reference; clean-room rebuild is a project unto itself |

---

## 6. Phased Implementation Plan (vertical slices)

**Each phase below is ONE session.** Phases are **vertical slices** (FM #25): each ends with something the user can actually do, not a horizontal layer. The slice test for every phase — *"if I stop here, does something work?"* — is answered under "Slice check."

The 5-file-per-commit cap (`SAFEGUARDS.md`) applies; phases that touch more must checkpoint-commit at internal boundaries.

> **Phase numbering ≠ a single session's license to bundle.** A future "implement Phase N" session does Phase N only and closes out (FM #18).

---

### Phase 1 — Walking skeleton (scaffold + CLI probe)

**Goal:** The thinnest end-to-end path that proves the entire toolchain: TypeScript compiles, esbuild bundles, the extension activates, one command runs, and `vsce` produces a `.vsix`. The command is `Quarto: Verify Installation` — it resolves the Quarto binary (setting → PATH), shows the version, or a clear actionable error if absent. This also lands the **CLI-resolution + graceful-degradation infrastructure** (`quarto/cli.ts`) every later phase depends on, and the **`core/` vs adapter boundary** (§3.3).

**Scope:** `package.json` (engine, activation, one command, scripts), `tsconfig.json`, esbuild config, `MIT LICENSE`, `src/extension.ts`, `src/quarto/cli.ts`, `test/unit/` harness + one trivial core unit test, `test/integration/` harness via `@vscode/test-electron`, `.vscode/launch.json` (F5).

**What DONE looks like:**
- `npm run compile` → type-checks clean and bundles.
- `npm test` → pure-core unit test passes (proves headless test path works without `code` CLI).
- `npx @vscode/vsce package` → produces a `.vsix`.
- Manual F5 → Extension Development Host launches; `Quarto: Verify Installation` shows `quarto 1.7.33` (and, when `quarto.path` points nowhere, a clear error — not a crash).

**Verification commands:** `npm run compile` · `npm test` · `npx @vscode/vsce package` · manual F5 smoke test (record result in SESSION_NOTES per Phase 3E).

**🐉 Here be dragons:** esbuild + `@vscode/test-electron` wiring is fiddly the first time; confirm test-electron downloads VS Code in this environment (no `code` CLI) — this is the load-bearing assumption that the automated integration path works at all. If test-electron cannot fetch VS Code here, fall back to pure-core unit tests + manual F5 and **document the gap** (do not pretend integration tests run).

**Slice check:** ✅ Stop here and the user has an installable extension that verifies their Quarto install. Working capability.

**Session boundary:** One session. Close out when the `.vsix` builds and the command runs under F5.

---

### Phase 2 — `.qmd` highlighting (language + grammar + config)

**Goal:** A `.qmd` *looks like* a Quarto document: highlighted prose, YAML front matter, and `{python}/{r}/{julia}/{ojs}` code cells; bracket matching and comment toggling work.

**Scope:** `contributes.languages` (`.qmd`,`.rmd` → `quarto`), `syntaxes/quarto.tmLanguage.json` (forked from MIT `vscode-markdown-tm-grammar` or `wooorm/markdown-tm-language`, extended with YAML-front-matter injection and brace-identifier `{lang}` cell injections mapping to `source.python`/`source.r`/`source.julia`/`source.js`), `language-configuration.json`, a `test/fixtures/sample.qmd`.

**What DONE looks like:** Open `sample.qmd` in the EDH → prose, YAML header, and each cell language are correctly colored; ⌘/ toggles a comment; brackets match inside a cell. Grammar scopes verified with VS Code's **"Developer: Inspect Editor Tokens and Scopes"**.

**Verification commands:** `npm run compile` · `npm run package` · manual F5 + token-scope inspection on the fixture · `quarto render test/fixtures/sample.qmd` (confirms the fixture is a valid Quarto doc).

**🐉 Here be dragons:** Quarto cells use **brace-wrapped** identifiers (```` ```{python} ````), which the **stock markdown fenced-block rule does not match** — a custom injection keying on `{lang}` is required (this is exactly why Quarto ships its own grammar). Also the **string/comment trap**: embedded features disable inside scopes tagged as string/comment — wrap embedded regions in `meta.embedded.*`. License hygiene: record the upstream grammar's MIT origin and our modifications in a `NOTICE`/grammar header.

**Slice check:** ✅ Stop here and the user has a syntax-highlighting Quarto extension. Working capability.

**Session boundary:** One session.

---

### Phase 3 — Render command

**Goal:** `Quarto: Render` runs `quarto render <active.qmd>`, streams output to a dedicated Output channel, and surfaces success (output path) or failure (clear error) — degrading gracefully when the CLI or a render dependency (e.g. Jupyter) is missing.

**Scope:** `src/features/render.ts`, command registration in `extension.ts`, reuse `quarto/cli.ts` from Phase 1, Output channel.

**What DONE looks like:** Run on a prose `.qmd` → `*.html` produced, path shown; run on a `{python}` doc with no Jupyter → the `nbformat`/Jupiter error is surfaced verbatim in the Output channel (not swallowed, not a crash).

**Verification commands:** `npm run compile` · `npm test` (unit-test the arg-builder pure function in `core/`) · manual F5 on prose fixture and on a code-cell fixture (record both outcomes).

**🐉 Here be dragons:** none major — render is a thin CLI wrapper. Keep the arg-construction logic a pure function in `core/` so it's unit-tested without spawning a process.

**Slice check:** ✅ One-key render of the open document. Working capability.

**Session boundary:** One session.

---

### Phase 4 — Live preview (webview + process lifecycle)

**Goal:** `Quarto: Preview` spawns `quarto preview <file> --no-browser`, parses the `Browse at http://localhost:<port>/` line, embeds that URL in a webview panel beside the editor, reloads on save, and **cleans up the preview process when the panel closes**.

**Scope:** `src/features/preview.ts` (process manager + URL parser — the parser is a pure `core/` function), webview panel + CSP, `extension.ts` wiring.

**What DONE looks like:** Run on `sample.qmd` → preview pane opens showing the rendered doc; edit + save → it reloads; close the pane → `pgrep quarto preview` shows nothing (no orphan). One preview per document; re-running focuses the existing pane.

**Verification commands:** `npm run compile` · `npm test` (unit-test the `Browse at <url>` parser against captured CLI output) · manual F5: open preview, edit/save to confirm reload, close to confirm process cleanup (`pgrep -fl "quarto preview"`).

**🐉 Here be dragons (this is the LARGE one):**
- **Process lifecycle** — `--timeout` does NOT reliably auto-exit (verified this session: it only exits on no active clients). The extension MUST track the child process and kill it on panel dispose, on document close, and on extension deactivate. Orphaned preview servers are the predictable failure mode.
- **URL parsing** — depends on the exact `Browse at http://localhost:<port>/` stdout line (captured live this session). Pin a fixture of that output for the unit test; handle the not-yet-ready window before the line appears.
- **Webview CSP & cross-origin** — embedding a localhost server in a webview iframe needs correct `Content-Security-Policy` and `localResourceRoots`/port handling. Budget time here.
- **Port/host** — default random 3000–8000; pass `--port`/`--host` deterministically if needed.

**Slice check:** ✅ Live preview — the headline feature. Working capability.

**Session boundary:** One session. If lifecycle + webview both prove deep, the URL-parser + process-manager can checkpoint-commit before the webview wiring (still one capability, internal boundary).

---

### Phase 5 — Code-cell execution (run cell family)

**Goal:** `Quarto: Run Cell` (and Run Above / Run All / advance / insert-cell) sends the active cell's code to the user's interpreter by delegating to the installed Jupyter/Python/R extension (or a terminal fallback).

**Scope:** `src/features/execution.ts`, cell-boundary detection (pure `core/` function over the region model from Phase 6a's parser — or a minimal cell finder if 6a isn't done yet), command + keybinding contributions.

**What DONE looks like:** With the Jupyter extension installed, cursor in a `{python}` cell → Run Cell executes it in the interactive window; with no execution extension present → a clear "install the Python/Jupyter extension" message, not a crash.

**Verification commands:** `npm run compile` · `npm test` (cell-boundary detection unit tests) · manual F5 with Jupyter installed (and once without, to confirm graceful messaging).

**🐉 Here be dragons:** Execution is **delegated**, so behavior depends on which extensions the user has (Jupyter/Python/R/Julia) and their command IDs (e.g. `jupyter.execSelectionInteractive`) — these are external contracts that can change; pin and feature-detect them. Cell-boundary detection must handle nested fences and the `{{python}}` non-executable display form. Recall the local finding: the CLI path needs Jupyter; the *delegated* path needs the user's kernel — different dependency.

**Slice check:** ✅ Run a code cell from the editor. Working capability.

**Session boundary:** One session.

---

### Phase 6 — Editor intelligence (Tier B), as small slices

Each sub-phase is **its own session** and its own vertical slice (provider registered → parse → items appear). They share the `core/qmd/model.ts` region parser, which **6a establishes**.

- **Phase 6a — Document outline / symbols.** `DocumentSymbolProvider` over the region model (headings + cells). DONE: the Outline view and breadcrumbs populate for `sample.qmd`. Verify: unit-test the parser; F5 + open Outline. *Establishes `core/qmd/model.ts` — load-bearing for 6b–6e and retro-fits Phase 5's cell finder.* Slice: ✅ outline works.
- **Phase 6b — Cross-reference completion + go-to-definition.** Index `@fig-/@tbl-/@sec-/@eq-` labels in the open doc; `CompletionItemProvider` on `@`, `DefinitionProvider` to the label. DONE: typing `@fig-` lists labels; go-to-definition jumps to the figure. Verify: unit-test the indexer; F5. Slice: ✅ cross-ref completion.
- **Phase 6c — Citation completion.** Parse the `.bib`/CSL-JSON named in the YAML `bibliography:` key → citekeys; complete on `@`. DONE: `@` lists citekeys from the fixture bib. Verify: unit-test the bib parser; F5. Slice: ✅ citation completion.
- **Phase 6d — YAML + cell-option `#|` completion.** See 🐉 below. DONE: front-matter keys and `#|` options complete. *v2.*
- **Phase 6e — Embedded-cell language completion (virtual-document request forwarding).** See 🐉 below. DONE: Python/R completions appear *inside* a cell via re-dispatch to the user's language extension. *v2.*

**🐉 Here be dragons (6d, 6e):**
- **6d** needs **Quarto's YAML schema**. Posit's extension sources it from the CLI; we must find a license-clean way to obtain or generate the schema (investigate `quarto` CLI outputs before committing to an approach). Until then, 6d is a best-effort static schema. Flag at planning of that session.
- **6e** is the hardest in-process piece: a `TextDocumentContentProvider` for an `embedded-content://` scheme, completion middleware that builds a per-cell virtual document (rest blanked to whitespace) and re-dispatches via `vscode.executeCompletionItemProvider`, plus **offset mapping** between the `.qmd` and the virtual doc. ~150–250 lines; the offset math and edit-sync are the risk. It does NOT need an LSP. Known limits: diagnostics don't forward; cross-cell state is weak.

**Slice check (each sub-phase):** ✅ independently shippable.

**Session boundary:** Each sub-phase is one session. 6a first (it's the shared parser). 6d/6e are v2.

---

### Phase 7 — Authoring aids (v2, small slices)

Snippets (`contributes.snippets`), math-preview webview (`previewMath`), bold/italic/code toggles. Each is a small independent slice and its own session. **v2.**

---

## 7. v1 Definition of Done & Scope Boundary

**v1 ships when** Phases 1–5 + 6a–6c are complete: an installable `.vsix` that highlights `.qmd`, renders, live-previews, runs cells, and completes cross-references and citations — with graceful degradation when the CLI or kernels are absent.

**Explicitly NOT in v1 (scope boundary — what this plan does *not* build):**
- The **Visual (WYSIWYM) editor** (VERY LARGE; clean-room Panmirror equivalent).
- **Zotero** web-library sync and the **Assist** panel (LARGE each).
- **Project-wide / workspace-symbol indexing** (the Tier-C driver — deferred with the LSP decision).
- YAML-schema-driven completion (6d) and embedded-cell completion (6e) — v2.
- Render-project, render-on-save, convert, new-doc/project wizards, walkthrough, mini-language grammars — v2.

Changing this boundary is a new planning round, not scope creep mid-implementation (SAFEGUARDS §Two-Mode Problem).

---

## 8. Interface Contracts (interface-first)

**Quarto CLI adapter (`quarto/cli.ts`)** — the one external integration point.

| Operation | Input | Output | Error contract |
|---|---|---|---|
| `resolveBinary()` | `quarto.path` setting, PATH | absolute path + version string | throws `QuartoNotFound` → caller shows actionable message |
| `render(file, opts)` | file path, format/metadata | child process; stdout/stderr → Output channel; exit code | non-zero exit → surface stderr verbatim, no crash |
| `preview(file, opts)` | file path, port/host | child process + parsed `Browse at <url>`; lifecycle handle | URL-line never appears within timeout → show "preview failed to start"; process must be killable |
| `version()` | — | semver | `< 1.7` → warn but allow |

**Provider contracts (Tier B)** — every provider is `(vscode args) → translate → core fn → translate → vscode result`. Core functions take/return **core types**, never `vscode.*`, so they're portable to a server and unit-testable.

---

## 9. Failure-Mode Analysis

| Failure | Blast radius | Mitigation (in-plan) |
|---|---|---|
| Quarto CLI absent / wrong version | All render/preview/exec features | `resolveBinary()` + version-check in Phase 1; every feature checks before spawning; actionable message |
| Jupyter/kernel absent | Code execution (CLI render of code docs; delegated run-cell) | Surface the real error verbatim; document the dependency; never crash (verified failure mode this session) |
| Orphaned `quarto preview` process | User's machine (port leak, CPU) | Explicit lifecycle ownership in Phase 4 (kill on dispose/close/deactivate); `pgrep` check in the verification step |
| `@vscode/test-electron` can't fetch VS Code in CI/headless | Automated integration tests | Phase 1 confirms or documents the gap; pure-core unit tests are the always-available safety net |
| Upstream grammar/library license drift | Licensing compliance | Pin versions; record MIT origin + modifications in NOTICE; re-verify on upgrade |
| Delegated execution command IDs change (Jupyter/Python) | Run-cell family | Feature-detect command IDs; fail soft with guidance |

---

## 10. Verification & Testing Strategy

Three layers, matched to the no-`code`-CLI reality:

1. **Pure-core unit tests** (`npm test`, vitest/mocha) — the bulk of correctness lives here: `.qmd` parsing, ref/citation indexing, completion logic, CLI arg-building, the preview URL parser. No VS Code, no `code` CLI. **Always available.**
2. **Integration tests** (`@vscode/test-electron`) — provider registration, command activation, contribution wiring. test-electron downloads its own VS Code; no `code` CLI required. **Confirm availability in Phase 1.**
3. **Manual F5 smoke test** (Phase 3E) — the human-in-the-loop runtime check each implementation session records in SESSION_NOTES. Required for runtime-behavior changes; the `code` CLI is not needed for F5 (it's the in-editor Run command).

**Build equivalents** (per SAFEGUARDS): `npm run compile` (compiles), `npx @vscode/vsce package` (release gate), `quarto render <fixture>` (fixture validity).

---

## 11. Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Fork Posit's extension** | Instant parity | **AGPL-3.0** — incompatible with the MIT mandate | Hard constraint; reimplement independently |
| **Start at Tier C (out-of-process LSP) immediately**, mirroring Posit | Matches the reference architecture; ready for cross-file scale | Second process, serialization, cross-boundary debugging, slower first value — for scale v1 doesn't have | Astronaut architecture; B→C is cheap later if the core stays `vscode`-free |
| **Tier A only (grammar, no providers)** | Trivial; ships fast | No completion/navigation/execution intelligence — not parity | Insufficient for the stated goal |
| **Reimplement the Quarto render engine in-extension** | No CLI dependency | Enormous; duplicates Pandoc/Quarto | CLI is MIT and present; shelling out is the right tool |
| **Horizontal phasing** (all grammar → all providers → all commands) | "Layer complete" feels tidy | No end-to-end working slice until the end; mid-stack blockers cause cross-layer rework | FM #25; vertical slices instead |

---

## 12. Decisions to Ratify (operator input before Phase 1)

1. **v1 scope = Phases 1–5 + 6a–6c** (highlight, render, preview, run-cell, outline, cross-ref + citation completion). Visual editor / Zotero / Assist / workspace indexing descoped. **Confirm or adjust.**
2. **Tier B (in-process providers), not Tier C (out-of-process LSP), for v1**, with the `vscode`-free core guardrail. **Confirm.**
3. **Tech stack:** TypeScript + esbuild + `@vscode/vsce` + vitest + `@vscode/test-electron`; `engines.vscode ^1.90.0` (or your preferred floor). **Confirm the VS Code engine floor.**
4. **Base grammar:** fork `microsoft/vscode-markdown-tm-grammar` (MIT) vs `wooorm/markdown-tm-language` (MIT, richer front-matter/math). **Recommendation: evaluate both in Phase 2; default to `markdown-tm-language` for its built-in YAML/TOML front-matter handling.** Confirm or leave to Phase 2.

---

## 13. Per-Phase Quick Reference

| Phase | Deliverable (one session) | DONE gate | v-tier |
|---|---|---|---|
| 1 | Scaffold + `Verify Installation` + CLI infra + test harness | `.vsix` builds; command runs under F5 | A→B base |
| 2 | `.qmd` language + TextMate grammar + config | Highlighting + brackets/comments verified by token inspection | A |
| 3 | `Render` command | Output produced; errors surfaced; graceful CLI-absent | B |
| 4 | Live `Preview` webview + lifecycle | Preview reloads on save; no orphan process on close | B |
| 5 | Run-cell family (delegated) | Cell runs via Jupyter; graceful when absent | B |
| 6a | Document outline/symbols (+ shared parser) | Outline/breadcrumbs populate | B |
| 6b | Cross-ref completion + go-to-def | `@fig-` completes; def jumps | B |
| 6c | Citation completion | `@` lists citekeys from bib | B |
| — | **v1 ships here** | installable `.vsix`, core authoring loop | — |
| 6d/6e/7 | YAML/cell-option completion · embedded-cell completion · authoring aids | (per-phase) | B (v2) |

---

## 14. Load-Bearing Assumptions (verify before trusting)

- `@vscode/test-electron` can download VS Code in the target CI/dev environment (this env has no `code` CLI). **Verify in Phase 1.** If false, integration tests are unavailable and the plan leans on pure-core + manual F5 — document, don't pretend.
- The `Browse at http://localhost:<port>/` stdout line is stable across Quarto versions. **Pin a fixture; re-check on CLI upgrade.**
- Delegated execution command IDs (Jupyter/Python/R) are stable. **Feature-detect.**
- Quarto's YAML schema can be obtained license-clean for 6d. **Investigate before committing to 6d's approach.**
- The MIT licenses of the base grammar and `vscode-markdown-languageservice` hold at the pinned versions. **Pin + record in NOTICE.**

---

*End of plan. Next session: implement **Phase 1** only, then close out (FM #18).*
