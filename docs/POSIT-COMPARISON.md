# Feature Comparison vs. Posit's Official Quarto Extension

**Purpose.** This project (`vscode_quarto_ext`, MIT-licensed) independently reimplements many of the
authoring features found in Posit's official Quarto extension for VS Code. This document compares the
two on **features only** — what a user can do — grounded in our own source and in Posit's public
documentation, changelog, and manifest facts. Requested by the operator (Session 29); authored Session 42.

**The licensing boundary (read this first).** Posit's official extension — including its Visual Editor
(built on a ProseMirror fork called Panmirror) and its language-server components — is licensed
**AGPL-3.0**. This project's stance is **look-but-don't-copy**: every row below was researched from
public marketing copy, README/CHANGELOG prose, official `quarto.org` documentation, and factual
manifest data (command IDs, config keys — not creative implementation code). No implementation logic,
algorithms, or code structure from Posit's repository was read, copied, or adapted into this project.
See `PROJECT_LEARNINGS.md` Learning #1.

**Methodology.** Our own inventory was grounded against this repo's `ROADMAP.md`, `CHANGELOG.md`,
`package.json`, and `src/`. Posit's inventory was researched via parallel web-research agents against
`quarto.org` docs, the VS Code Marketplace listing, and the `quarto-dev/quarto` repository's public
`README.md`/`CHANGELOG.md`/`package.json` manifest (`apps/vscode/`, formerly the archived
`quarto-dev/quarto-vscode`). **Every one of the 31 rows below was then adversarially refute-checked** by
an independent agent with repo access (re-grepping our claims) and web access (re-fetching Posit's cited
sources) — not to rubber-stamp the claim, but to find what was wrong with it. 14 of 31 rows had a real
defect caught and corrected: stale citations (a 2022 changelog entry cited as current), wrong URLs (a
quote attributed to a page that didn't contain it), overclaims (calling one-level-deep completion
"recursive"), and understatements (undercounting a command-family gap by half). The rows below reflect
the **corrected, verified** claims, not the first draft.

---

## At a Glance

| | Count | Examples |
|---|---|---|
| **Parity** (same capability, comparable depth) | 18 | render, preview, project-level render, execution delegation, syntax highlighting, most `@`-completion, cell-option completion, scaffolding commands, getting-started walkthrough |
| **We're ahead** | 3 | format-scoped nested option completion (Posit's own docs admit their top-level suggestions aren't format-filtered); default keybindings for Bold/Italic (Posit removed theirs in 2022 after a conflict and never restored them); image paste/drag-drop for `.qmd` (Posit's own source editor has this as an open, unimplemented feature request — Session 58) |
| **Real gaps** (Posit has, we don't) | 6 | Visual (WYSIWYG) editor, notebook `.ipynb` conversion, Contextual Assist Panel, spell checking, Zotero (Visual-Editor-only for them), YAML diagnostics (partial — we cover only `_quarto.yml`'s project/website/book blocks; Posit also covers front matter/cell options) — project-level render gap closed, Session 45; scaffolding-commands gap closed, Sessions 49–50; walkthrough gap closed, Session 51; run-cell command family gap closed, Session 52; snippets gap closed, Session 53; Graphviz rendering gap closed, Session 56 |
| **True parity in absence** (neither has it) | 1 | AI/Copilot-native features (both rely on a separately-installed Copilot extension) |

The single largest gap is architectural, not incremental: Posit ships a full **Visual (WYSIWYG) editor**
(rich-text editing of `.qmd` prose without seeing raw markdown). That one gap is also the reason several
smaller gaps exist — Posit's Zotero picker and spell checker are both Visual-Editor-only features on
their side, so those two rows are narrower deficits than they first appear.

---

## Rendering & Preview

**Render command (document-level).**
- *Ours:* Present — one generic `quarto.render` command, no format-specific variants, no editor-toolbar
  button. (`package.json` commands; `src/features/render.ts:30`, `src/core/render-args.ts`.)
- *Posit's:* Present — comparable, not clearly richer. A single `quarto.renderDocument` (+ separate
  `quarto.renderProject`); on multi-format documents, format choice is a runtime QuickPick, not separate
  command IDs; no editor-toolbar button for Render (their toolbar button is for Preview). (Verified
  directly against `apps/vscode/package.json` and `src/providers/render.ts` at commit `566b351f`,
  2026-07-08 — same day as this research, so current.)
- *Notes:* An earlier draft of this row cited a 2022 changelog entry claiming Posit has per-format render
  commands and a Render toolbar button — that feature was since consolidated into the QuickPick design
  described above and no longer exists in that form. Roughly at parity.

**Live preview.**
- *Ours:* Present — embedded webview panel, owns the process-group lifecycle (no orphaned `deno`
  workers), no dedicated keybinding. (`src/features/preview.ts`, `src/core/preview-url.ts`,
  `src/core/preview-html.ts`.)
- *Posit's:* Present — same core capability, plus a `Ctrl+Shift+K` keybinding and a Render-on-Save
  option. (`quarto.org/docs/tools/vscode` — Preview command; embedded preview supported for HTML/PDF
  formats including revealjs/beamer.)
- *Notes:* Functional parity on the embedded preview itself; we haven't bound a keyboard shortcut or
  added a Render-on-Save toggle.

**Project-level render command ("Render Project").**
- *Ours:* Present — `quarto.renderProject` discovers the project root (`_quarto.yml`/`_quarto.yaml`,
  ancestor-walk) and spawns `quarto render <root>` with `cwd` pinned to root, rendering the whole project
  rather than just the active document — **Session 45**, `BACKLOG.md` item #1. (`src/core/project.ts`,
  `src/features/render-project.ts`.)
- *Posit's:* Present — a dedicated "Render Project" command (v1.11.2) that renders every document in a
  project.
- *Notes:* Parity reached (Session 45) — no longer a gap. (Historical: this doc's research, Session 42,
  originally found this unimplemented.) "Preview Project" remains a deliberate, unshipped follow-up —
  `features/preview.ts`'s process-group-owning model doesn't trivially generalize to multi-output-file
  projects (confirmed Session 44).

---

## Code Execution

**Delegation model (no bespoke kernel).**
- *Ours:* Present — dispatches to the user's installed Jupyter/R/Julia extension commands rather than
  owning a kernel, with feature-detection and graceful degradation when the target extension is missing.
  (`src/core/execution-delegate.ts`, `src/features/execution.ts`.)
- *Posit's:* Present — the same delegation model ("integrates directly with the Jupyter, R, and Julia
  extensions").
- *Notes:* Architecturally identical approach, independently arrived at — a genuine parity point, not a
  copy.

**Run cell / run code chunk (command family).**
- *Ours:* Present — **9 commands, matching Posit's own count** (run cell, run+advance, run selected
  line(s), run next cell, run previous cell, run above, run below, run all, insert cell), each
  individually keybound (`ctrl/shift+enter` for the original two, `ctrl+alt+<mnemonic>` for the rest —
  **Session 52**, `BACKLOG.md` item #4).
- *Posit's:* Present — an 8-command family (current cell, selected line(s), next cell, previous
  cell, all cells, cells above, cells below, insert new cell), each individually keybound.
- *Notes:* Parity reached (Session 52) — no longer a gap. (Historical: this doc's research, Session 42,
  originally found us missing 4 discrete commands with only 2 of 5 keybound.)

**Interactive/notebook-like execution UX (output console).**
- *Ours:* Present, but not uniform across languages — Python delegates to
  `jupyter.execSelectionInteractive` (a true notebook-style Jupyter Interactive Window); R delegates to
  `r.runSelection` (a plain "R Interactive" terminal REPL); Julia delegates to
  `language-julia.executeCodeBlockOrSelection` (a plain "Julia REPL" terminal). Only the Python path is a
  rich notebook panel.
- *Posit's:* Present — the same per-language split (Python → Jupyter Interactive Window; R → R
  Interactive terminal; Julia → Julia REPL terminal), per their own docs' Execution Directory section.
- *Notes:* Parity by construction, per language — but it's inaccurate to describe all three as riding
  "the Jupyter extension's interactive window"; only Python does, on both sides.

---

## Editing & Language Support

**Syntax highlighting / language registration for `.qmd`.**
- *Ours:* Present — registers a `quarto` language for `.qmd`/`.rmd`/`.Rmd`, TextMate grammar
  (`text.html.quarto`), embedded YAML/Python/R/Julia/JS regions.
- *Posit's:* Present — "Syntax highlighting for markdown and embedded languages."
- *Notes:* Direct parity.

**Code-cell language embedding — completion/hover/go-to-def/signature-help forwarding.**
- *Ours:* Present — embedded grammar regions for python/r/julia/ojs, plus request forwarding
  (completion, hover, go-to-definition, signature-help) into the user's installed language extension via
  per-language virtual documents, with graceful degradation. (`src/core/embedded/`, `src/providers/embedded.ts`.)
- *Posit's:* Present for Python/R/Julia, explicitly documented ("Completion for embedded languages…
  enhanced features… can be enabled by installing the most recent version(s) of these extensions" —
  Python/Jupyter, R, Julia). Observable JS is not documented on this specific page (though OJS likely
  gets JS-based tooling "for free," similar to our own `ojs→javascript` mapping).
- *Notes:* We match on substance for Python/R/Julia; our own coverage of hover/go-to-def/signature-help
  across all four languages is more granular and better-evidenced (via our own test suite) than what
  Posit documents on this page.

---

## YAML Intelligence

**YAML front-matter key/value completion (document-level options).**
- *Ours:* Present — top-level key and value completion inside `---`…`---`, schema-read from the user's
  installed Quarto CLI with a curated offline fallback.
- *Posit's:* Present — "YAML code completion is available for project files, YAML front matter, and
  executable cell options" (CHANGELOG v1.5.0, 2022-02-27).
- *Notes:* Same schema-driven architecture (read the installed Quarto's schema, curated fallback
  offline) on both sides — a genuine independently-arrived-at parity point.

**Cell-option (`#|`/`//|`) completion inside executable code cells.**
- *Ours:* Present — key and value completion on `#|` (python/r/julia) and `//|` (ojs/js) option lines,
  gated to the correct slot, enriched from the live installed schema.
- *Posit's:* Present — "Completion for YAML options within cell comments" (v1.69.0); "Tolerate space
  between `#` and `|`" (v1.20.2).
- *Notes:* Direct parity on the `#|` mechanism. Our `//|` (ojs/js) support is real and tested, but is
  **not a confirmed differentiator** — Posit's own source maps `ojs`/`js` to `//`-comment-prefixed
  handling in adjacent features, suggesting their completion engine likely already handles it too; their
  actual completion-provider source wasn't locatable in the public repo to confirm either way.

**Per-format option completion (options scoped to a specific output format).**
- *Ours:* Present — nested key/value completion under `format:` → `<fmt>:` → `<opt>:`, including 3-level
  nested (`format → <fmt> → <opt> → <key>`) object-valued option completion, scoped to the format
  actually declared via a `tags.formats` match. A 4th level (a sub-key's own children) is explicitly
  deferred and not yet implemented — do not describe our depth as open-ended.
- *Posit's:* **Partial** — their own community documentation states top-level suggestions do **not**
  filter to the targeted format ("a PDF-only key like `fig-pos` is suggested while targeting HTML");
  nested-block filtering is unconfirmed by any official source.
- *Notes:* **This may be a genuine edge for us** — but it needs a live side-by-side check against the
  current Posit extension before being claimed with full confidence, since no official Posit source
  confirms their own nested-block behavior one way or the other.

**Nested/deep object option completion (e.g. `theme:`, `code-tools:`, `grid:` sub-keys).**
- *Ours:* Present for `execute:` and per-format option sub-keys — **one object level deep only**
  (schema-driven, explicitly **not recursive**: deeper 3+-level nesting is deferred, unimplemented
  `b2-iii-deep` work). No `_brand.yml`-specific handling exists.
- *Posit's:* Partial — confirmed support for `_brand.yml` validation/autocompletion (CHANGELOG v1.116.0,
  "if supported by the Quarto version ≥ 1.6.24"); general nested-key completion is described but not
  itemized for `theme`/`code-tools`/`grid` specifically.
- *Notes:* Neither side has an exhaustive, confirmed sub-key inventory for the same named keys — a soft
  comparison. We have zero `_brand.yml` support, which Posit does have. Do not describe our own nested
  completion as "recursive" — it is capped at one level by design.

**YAML schema validation / diagnostics (red squiggles for invalid/unknown keys).**
- *Ours:* Present, narrower in scope — always-on diagnostics flag unknown keys inside the
  `project:`/`website:`/`book:` blocks of `_quarto.yml`/`_quarto.yaml` only (the one region confirmed
  "closed" against the live schema); front matter and cell options remain completion-only, no diagnostics
  — **Session 47**, `BACKLOG.md` item #2. (`src/core/yaml-schema.ts` `SchemaIndex.projectKeys`,
  `src/core/project-yaml.ts`, `src/features/yaml-diagnostics.ts`.)
- *Posit's:* Present, with caveats — on-save validation for both the classic editor and (since v1.124.0)
  the Visual Editor, plus profile-specific `_quarto.yml` (since v1.39.0), and (unlike ours) also covers
  front matter and cell options. Coverage is inconsistent because some internal schemas are "open"
  (unknown keys silently accepted) vs. "closed" (flagged) — per an unofficial community reference
  (`quarto-tdg.org/yaml`); Posit's own docs don't state this caveat directly. Implemented as a custom
  internal LSP diagnostics provider, not the standard VS Code `yamlValidation`/`jsonValidation` manifest
  points.
- *Notes:* Partial parity (Session 47) — narrowed, not closed. We validate only the project-config block
  (empirically the one region safe to flag without false positives; see `BACKLOG.md`'s "Polish /
  deferred" for two known false-negative edge cases). Posit's front-matter/cell-option coverage remains a
  real, smaller gap on our side.

---

## Outline & Navigation

**Document outline / symbols (headings + code cells).**
- *Ours:* Present, both document- and workspace-scope — a `DocumentSymbolProvider` (Outline view,
  breadcrumbs, Go to Symbol in Editor) **and**, as of Session 54, a `WorkspaceSymbolProvider` (Go to
  Symbol in Workspace, Ctrl+T/Cmd+T), searching every `.qmd` file in the workspace via
  `vscode.workspace.findFiles`, not just the active editor.
- *Posit's:* Present — both document- and workspace-scope symbol providers ("Go to Symbol in Workspace…
  Ctrl+T").
- *Notes:* Parity. Both in-document and cross-file symbol navigation are covered.

---

## Cross-References & Citations

**Cross-reference autocomplete (`@fig-`, `@tbl-`, `@sec-`, `@eq-`, `@lst-`, etc.).**
- *Ours:* Present — completion pops on `@` and offers every defined label, from a pure index over
  headings, cell `label:` options, and inline attribute blocks. The index itself is restricted to 5
  reserved kinds via a prefix check; the provider does not itself re-filter by typed text (that's
  delegated to VS Code's own completion-widget matching, untested).
- *Posit's:* Present — "Code completion for cross references" (v1.33.0); "Filter crossref completions by
  prefix match" (v1.50.0) — their filter narrows by whatever text is already typed (any token), not
  specifically a cross-ref *kind* prefix.
- *Notes:* Headline feature is at parity. Don't claim mechanism-level parity on "type-prefix filtering"
  specifically — the two sides implement narrowing differently (Posit: explicit server-side typed-text
  filter; ours: none, relies on the VS Code host).

**Cross-reference go-to-definition / "jump to label."**
- *Ours:* Present — jumps to a label's defining heading/cell/attribute block.
- *Posit's:* Present — a long-standing feature ("Navigation to cross references located in other project
  files," v1.62.0; "Go to Definition within code cells," v1.63.0; "…now works with local file
  references," v1.71.0). No later entry indicates removal.
- *Notes:* **This is parity, not a differentiator.** An earlier draft of this row checked only Quarto's
  syntax-reference docs page (which doesn't mention editor tooling at all) and concluded Posit lacked
  this — the extension's own CHANGELOG shows it's existed since ~Feb 2023.

**Citation autocomplete from bibliography (`@citekey`, BibTeX/CSL-JSON).**
- *Ours:* Present — completion on `@` sourced from a parsed `.bib`/CSL-JSON bibliography (auto-detected
  format); offers all citekeys and relies on VS Code's built-in fuzzy suggest-widget matching to narrow,
  not a custom prefix filter.
- *Posit's:* Present — "Completions and hover/assist for citations" (v1.30.0, 2022-08-02).
- *Notes:* Direct parity on the core mechanism; we don't additionally provide Posit's hover/assist detail
  cards.

**Project-wide / multi-file intelligence (cross-ref + citation resolution across files).**
- *Ours:* **Not implemented** — indexing operates on the single open document/its own bibliography file
  only; no workspace-wide scanning.
- *Posit's:* Partial — also largely single-file-scoped. Crossrefs inside `{{< include >}}`-ed files are
  maintainer-confirmed **not** indexed for completion. The one documented exception is Book projects: a
  project-wide crossref index is built for cross-chapter completion, but only if the book has an `html`
  format configured **and** has been rendered to HTML at least once to populate that index.
- *Notes:* A near-parity gap rather than a clear deficit — Posit's own multi-file completion is
  conditional and maintainer-confirmed incomplete outside that one narrow case.

---

## Formatting & Live Preview

**Contextual Assist Panel (non-AI help/documentation on cursor context).**
- *Ours:* Partial — no unified contextual-help sidebar; the narrower equivalent is two separate webview
  commands (Preview Math, Preview Diagram) rather than one cursor-context panel.
- *Posit's:* Present — one unified sidebar panel showing contextual assistance (code-doc lookup, LaTeX
  preview, image thumbnails) based on cursor position.
- *Notes:* We cover the math/diagram-preview slice of this via separate commands, not the code-doc-lookup
  or image-thumbnail modes.

**Live preview of LaTeX math (`$..$`) embedded in the editor.**
- *Ours:* Present — renders inline `$…$` and display `$$…$$` regions in a webview beside the editor with
  vendored KaTeX, live-updating as the document changes.
- *Posit's:* Present — a Preview button / `Ctrl+Shift+L` shortcut opens a live-updating preview.
- *Notes:* Direct parity on the capability; ours is Command-Palette-only (no inline Preview button or
  keybinding, no confirmed auto dark/light theming).

**Live preview of diagrams (Mermaid / Graphviz) embedded in the editor.**
- *Ours:* Present — Mermaid cells render live via vendored Mermaid; Graphviz (`{dot}`) cells render live
  via a vendored WASM build of Graphviz itself (`@viz-js/viz`, shipped Session 56).
- *Posit's:* Present — both Mermaid and Graphviz render live.
- *Notes:* At parity. Unlike every other vendored asset in this project, the Graphviz WASM module's
  compiled contents are EPL-2.0 (not MIT) — disclosed in `NOTICE`; see BACKLOG.md item #7.

**Formatting keyboard shortcuts (bold/italic/code).**
- *Ours:* Present — `toggleBold`/`toggleItalic`/`toggleCode` wrap/unwrap the selection or word-at-cursor
  in the plain source editor; `Ctrl/Cmd+B` and `Ctrl/Cmd+I` bound by default; `toggleCode` has no default
  keybinding.
- *Posit's:* Present but split across two unrelated mechanisms — (1) the Visual Editor's internal
  ProseMirror keymap supports traditional + markdown-native shortcuts, entirely inside that webview; (2)
  separately, the plain-source-editor exposes the same-named commands but ships them with **no default
  keybinding at all** — default bindings were added in v1.36.0 and removed four days later in v1.37.0
  (2022-09-05, "due to conflicts") and have never been restored.
- *Notes:* **We're ahead here.** Contrary to an earlier draft's assumption, Posit does not bind anything
  to `toggleCode` by default (or to bold/italic, in the plain editor) — they removed all three in 2022
  and never restored them. Our extension currently has more default keyboard-shortcut coverage for
  plain-editor formatting (2 of 3 bound) than Posit's does (0 of 3).

---

## Additional Findings (surfaced by research, outside our own roadmap)

**Create project / create Quarto document commands.**
- *Ours:* Present — `quarto.newDocument` (title-prompted, opens an untitled `.qmd` buffer from a
  YAML-safe front-matter template) and `quarto.createProject` (type/parent-folder/name prompts, spawns
  `quarto create-project`, opens the result as the workspace) — **Sessions 49–50**, `BACKLOG.md` item #3
  Tracks A/B. (`src/core/new-document.ts`, `src/features/new-document.ts`,
  `src/core/create-project-args.ts`, `src/features/create-project.ts`.)
- *Posit's:* Present — `quarto.newDocument`, `quarto.createProject`, `quarto.fileCreateProject`, etc.
- *Notes:* Parity reached (Sessions 49–50) — no longer a gap. We don't have Posit's separate
  `quarto.fileCreateProject` (an Explorer-context-menu variant of the same command).

**Notebook (`.ipynb`) support.**
- *Ours:* **Not implemented** — the extension only registers `.qmd`/`.rmd`/`.Rmd`; no notebook command,
  serializer, or renderer exists.
- *Posit's:* Present — "Convert to `.ipynb`" and "Convert to `.qmd`" commands (v1.132.0).
- *Notes:* A sizeable capability we don't attempt; would need notebook-renderer/serializer work well
  beyond our current single-file `.qmd` scope.

**Zotero integration.**
- *Ours:* **Not implemented.**
- *Posit's:* Present, but **Visual-Editor-only** — a native Insert Citation picker over Zotero libraries
  with auto-`.bib` updates, inside their WYSIWYG editor. Source-mode Zotero support is an unresolved
  community feature request on their side too, worked around only via a third-party fork extension.
- *Notes:* A softer gap than it first appears — Posit itself only ships Zotero inside its (also-absent
  for us) Visual Editor, not in plain source-mode editing, which is where we operate.

**Visual (WYSIWYG) editor.**
- *Ours:* **Not implemented** — no custom-editor/WYSIWYG/ProseMirror-style code anywhere; we ship only
  the raw source `.qmd` editor.
- *Posit's:* Present — "includes a visual markdown editor that supports all of Quarto's markdown syntax
  including tables, citations, cross-references, footnotes, divs/spans…"
- *Notes:* **Posit's single largest feature we do not attempt.** A major, likely multi-session
  undertaking (custom editor + rich-text engine) if ever pursued. Several other gaps (Zotero-in-editor,
  spell check) are downstream of this one — and are explicitly out of this project's v1 scope per
  `docs/planning/2026-06-27-extension-architecture-plan.md` §7.

**Snippets for common Quarto constructs.**
- *Ours:* Present — **13 snippets** (`snippets/quarto.json`, `contributes.snippets`): front matter, the
  4 executable-cell languages, callouts, fenced divs, tabset panels, and one per cross-reference kind
  this extension itself recognizes (fig/tbl/eq/sec/lst) — **Session 53**, `BACKLOG.md` item #5.
- *Posit's:* Present — "Code snippets… make it easier to enter repeating code patterns (code blocks,
  callouts, divs, etc.)."
- *Notes:* Parity reached (Session 53) — no longer a gap. Independently designed from Quarto's own
  documented markdown syntax (grounded against this repo's own fixtures/`core/refs.ts`), not from
  Posit's AGPL extension's actual snippet content (Learning #1 look-but-don't-copy gate).

**Image paste (clipboard paste → auto-save + insert markdown reference).**
- *Ours:* **Present** — `vscode.languages.registerDocumentPasteEditProvider` +
  `registerDocumentDropEditProvider` for `.qmd` (paste AND drag-drop, bundled into v1): writes the
  image under `images/` next to the document and inserts `![](images/<file>)`, with collision-avoidance
  naming — **Session 58**, `BACKLOG.md` "Phase 7 authoring aids."
- *Posit's:* **Still absent** — confirmed by a Quarto maintainer as an open feature request, not
  implemented in their source editor; only their excluded AGPL Visual Editor supports it.
- *Notes:* No longer a gap — **we're now ahead of Posit's own source editor** here, not merely at
  parity. Independently designed from VS Code's own MIT built-in markdown paste-image implementation
  (read directly for precedent, not Posit's AGPL extension — Learning #1 look-but-don't-copy gate).

**AI/Copilot authoring assistance.**
- *Ours:* Not implemented (out of scope by design — no AI feature on this project's roadmap).
- *Posit's:* Also absent as a bespoke feature — GitHub Copilot works in `.qmd` only via the separately
  installed generic Copilot extension; Posit ships only compatibility fixes ("Fixed Copilot completions
  in `.qmd` documents," v1.129.0).
- *Notes:* True parity — both extensions are AI-feature-free by design.

**Getting-started walkthrough / onboarding UI.**
- *Ours:* Present — a `contributes.walkthroughs` entry (`quartoGettingStarted`, 5 steps: install/verify
  Quarto, create a document, create a project, render/preview, run a cell), each with a command-link
  action button and a completion event — **Session 51**, `BACKLOG.md` item #3 Track C.
- *Posit's:* Present — "Getting started with Quarto walkthrough" (v1.17.0).
- *Notes:* Parity reached (Session 51) — no longer a gap.

**Spell checking integration.**
- *Ours:* **Not implemented.**
- *Posit's:* Partial — native spell checking exists, but only inside the Visual Editor, not in plain
  source/markdown editing; their Visual Editor's spell checker also has a documented single-language-at-
  a-time limitation.
- *Notes:* Coupled to the Visual Editor gap above rather than an independent deficit, since Posit's own
  spell check requires its Visual Editor too.

---

## What This Suggests for Future Work

In rough priority order, if this project were to close the largest real gaps:

1. ~~YAML schema diagnostics~~ (red squiggles for invalid front-matter/cell-option keys) — **PARTIALLY
   SHIPPED Session 47** (`BACKLOG.md` item #2): covers `_quarto.yml`'s `project:`/`website:`/`book:`
   blocks only, built on the existing schema reader (`src/core/yaml-schema.ts`). Front-matter and
   cell-option diagnostics remain unimplemented — a narrower residual gap, not yet re-ranked.
2. ~~Snippets~~ — **SHIPPED Session 53** (`BACKLOG.md` item #5): `snippets/quarto.json`, 13 snippets,
   declarative and TDD-gate-exempt, as predicted here. ~~And a **getting-started walkthrough**~~ —
   **SHIPPED Session 51** (`BACKLOG.md` item #3 Track C) — both declarative, TDD-gate-exempt,
   low-effort, as predicted here.
3. ~~Project-level render~~ (`_quarto.yml` discovery + "render whole project") — **SHIPPED Session 45**
   (`BACKLOG.md` item #1): `quarto.renderProject` discovers the project root and renders it with `cwd`
   pinned to root. "Preview Project" remains a deliberate, unshipped follow-up.
4. ~~A fuller run-cell command family~~ — **SHIPPED Session 52** (`BACKLOG.md` item #4): Run Selected
   Line(s), Run Next Cell, Run Previous Cell, and Run Cells Below, plus default keybindings across the
   resulting 9-command family.
5. ~~Graphviz (`{dot}`) diagram rendering~~ — **SHIPPED Session 56** (`BACKLOG.md` item #7): vendored
   `@viz-js/viz`'s WASM Graphviz build (`media/graphviz/viz-global.js`), a `'wasm-unsafe-eval'` CSP
   addition, and a `dot` render branch calling `Viz.instance().renderString(...)` — at parity with
   Mermaid. First vendored asset whose compiled contents are non-MIT (EPL-2.0 Graphviz core), disclosed
   in `NOTICE` per an explicit operator decision.
6. The **Visual (WYSIWYG) editor** is Posit's single largest feature and this project's single largest
   gap — but it is a major, multi-session undertaking, explicitly out of v1 scope, and would need to be
   built from an MIT-clean editor foundation (never from Posit's AGPL Panmirror). Any future decision to
   pursue it belongs in its own planning session.

This document does not itself change `BACKLOG.md` — see that file for the project's actual prioritized
work list; the items above are this research's suggestions for what to feed into it.
