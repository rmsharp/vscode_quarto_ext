# Feature Comparison vs. Posit's Official Quarto Extension

**Purpose.** This project (`vscode_quarto_ext`, MIT-licensed) independently reimplements many of the
authoring features found in Posit's official Quarto extension for VS Code. This document compares the
two on **features only** — what a user can do — grounded in our own source and in Posit's public
documentation, changelog, and manifest facts. Requested by the operator (Session 29); authored Session 42;
refreshed Session 67 (see "Session 67 refresh" below).

**The licensing boundary (read this first).** Posit's official extension — including its Visual Editor
(built on a ProseMirror fork called Panmirror) and its language-server components — is licensed
**AGPL-3.0**. This project's stance is **look-but-don't-copy**: every row below was researched from
public marketing copy, README/CHANGELOG prose, official `quarto.org` documentation, and factual
manifest data (command IDs, config keys — not creative implementation code). No implementation logic,
algorithms, or code structure from Posit's repository was read, copied, or adapted into this project.
See `PROJECT_LEARNINGS.md` Learning #1.

**Methodology.** Our own inventory was grounded against this repo's `ROADMAP.md`, `CHANGELOG.md`,
`package.json`, and `src/`. Posit's inventory was researched via parallel web-research agents against
`quarto.org` docs (currently split across `quarto.org/docs/tools/vscode/index.html` and a separate
`.../visual-editor.html` page — the old unqualified `vscode.html` URL now just redirects), the VS Code
Marketplace listing, and the `quarto-dev/quarto` repository's public `README.md`/`CHANGELOG.md`/`package.json`
manifest (`apps/vscode/`, formerly the archived `quarto-dev/quarto-vscode`). **Every one of the 31 original
rows was adversarially refute-checked** by an independent agent with repo access (re-grepping our claims)
and web access (re-fetching Posit's cited sources) — not to rubber-stamp the claim, but to find what was
wrong with it. 14 of 31 rows had a real defect caught and corrected: stale citations (a 2022 changelog entry
cited as current), wrong URLs (a quote attributed to a page that didn't contain it), overclaims (calling
one-level-deep completion "recursive"), and understatements (undercounting a command-family gap by half).

**Session 67 refresh.** The rows above were last comprehensively re-swept against Posit's *current* state
at Session 42 (with individual rows spot-corrected through Session 65) — the highest Posit version number
cited anywhere in the pre-refresh document was v1.132.0. As of this refresh, Posit's `apps/vscode` extension
is at **v1.135.0 shipped (2026-07-08), v1.136.0 open/unreleased** — three full releases past that ceiling.
Rather than re-verify only the rows already on file, this refresh ran an **exhaustive structural diff**
against Posit's current manifest (every `contributes.commands`/`configuration`/`languages`/`menus` entry,
not just the categories the original research happened to think to check) plus a changelog diff for every
entry since v1.132.0 and a docs/marketplace prose scan — specifically to catch *unknown unknowns*: Posit
features with no corresponding row in this document at all, not just drift in rows that already exist. That
produced 28 candidate findings, each adversarially refute-checked by 3 independent agents (mirroring the
original methodology exactly): 18 survived unchanged, and 10 had a real inaccuracy in their own framing
caught and corrected by the refuters (e.g. "9 commands" corrected to the true count of 10; "moved to the
Activity Bar" shown to have been reverted nine days later, in 2022) — every one of those 10 still yielded a
genuine, corrected finding, none were dropped as pure noise. The corrected findings are folded into the rows
below (marked "Session 67" where added); **8 new rows** were added for gaps with no prior row at all, and
the At a Glance table below now carries a 5th bucket (**Soft / ambiguous comparison**) for rows that
genuinely don't fit "parity / ahead / gap" cleanly — resolving an arithmetic drift the refresh also caught
(the pre-refresh table's bucket counts summed to 28 against a claimed 31 rows; 3 rows had simply never been
assigned to a bucket).

---

## At a Glance

**39 rows total** (31 original + 8 added Session 67). Counts below reflect the Session 67 refresh —
see individual rows for what changed and why.

| | Count | Examples |
|---|---|---|
| **Parity** (same capability, comparable depth) | 22 | render, preview, project-level render, execution delegation, most `@`-completion, cell-option completion, scaffolding commands, getting-started walkthrough, notebook `.ipynb` conversion, outline granularity, Format Cell, cell navigation/cache commands, `_quarto.yml` document links + filepath completion (Sessions 80–81) |
| **We're ahead** | 4 | format-scoped nested option completion (Posit's own docs admit their top-level suggestions aren't format-filtered); default keybindings for Bold/Italic (Posit removed theirs in 2022 after a conflict and never restored them); image *paste* for `.qmd` (Posit's source editor still doesn't support it — drag-drop is a narrower story, see below, Session 67); spell checking in the plain source editor (a documented `cspell` config recipe — Posit's own spell check is Visual-Editor-only — Session 65) |
| **Real gaps** (Posit has, we don't) | 9 | Visual (WYSIWYG) editor, Contextual Assist Panel, Zotero (Visual-Editor-only for them), YAML diagnostics (partial), syntax-highlighting breadth (Session 67 — the *semantic highlighting* half of this bucket is CLOSED, Sessions 88–90, item 16: a real `SemanticTokensProvider` forwards every embedded language to its own server; only static-grammar breadth remains), code-cell diagnostics forwarding (Session 67 finding; investigated and accepted as a permanent, documented gap, Session 69 — see below), Reticulate execution (Session 67), standalone diagram/typst language registration (partial — registration/config shipped Session 77; grammar + DOT-snippet-family residual), cell-background highlighting (Session 67) — project-level render gap closed, Session 45; scaffolding-commands gap closed, Sessions 49–50; walkthrough gap closed, Session 51; run-cell command family gap closed, Session 52 (residual `runCurrent` sub-gap closed, Session 78, item 13(e)); snippets gap closed, Session 53; Graphviz rendering gap closed, Session 56; notebook conversion gap closed, Session 63; spell-checking gap closed (source-editor recipe), Session 65; outline granularity gap closed, Sessions 71–74; Format Cell gap closed, Session 75 (this row's own detailed-section body text was found still stale — still saying "Not implemented" — while updating this table for Session 78's own item 13(d)/(e) closures; corrected here, not a Session 78 finding about its own work); cell navigation/cache-management commands gap closed, Session 78, item 13(d); `_quarto.yml` document links + filepath completion gap closed, Sessions 80–81, item 14; preview-command-family breadth gap closed, Sessions 82/84/85, item 15 (per-format picker + render-script preview + the Posit-parity gating layer) |
| **True parity in absence** (neither has it) | 1 | AI/Copilot-native features (both rely on a separately-installed Copilot extension) |
| **Soft / ambiguous comparison** (new bucket, Session 67) | 3 | per-key nested/deep YAML completion depth (neither side has an exhaustive inventory); project-wide/multi-file cross-ref & citation intelligence (both largely single-file-scoped, Posit's is conditional); extensibility surfaces — a public CLI-query API and Quarto-Extension/Lua-authoring support (developer-facing, arguably outside this doc's own "what a document author can do" scope) |

The single largest gap is still architectural, not incremental: Posit ships a full **Visual (WYSIWYG)
editor** (rich-text editing of `.qmd` prose without seeing raw markdown). That one gap is also the reason
a related smaller gap exists — Posit's Zotero **live picker** is a Visual-Editor-only feature on their
side, so that row is a narrower deficit than it first appears. Spell checking was similarly gated on the
Visual Editor in Posit's own implementation, but plain-source-editor spell checking turned out to be
independently solvable (Session 65) — see above. **Session 67's exhaustive manifest diff found the
second-largest gap was hiding in plain sight**: Posit now forwards the embedded language server's own
diagnostics (squiggly underlines from Pylance/Ruff/etc.) directly into `.qmd` code cells (since v1.133.0) —
this project has zero code-cell diagnostics of any kind, only YAML diagnostics. **Session 68/69: unlike
every other Session 67 finding, this one was investigated (`docs/planning/2026-07-10-code-cell-diagnostics-plan.md`)
and found to be architecturally hard, not merely unimplemented** — VS Code's request-forwarding API (what
this project's existing embedded-language forwarding already uses for completion/hover) cannot serve
diagnostics at all, and closing the gap the way Posit did requires spawning and owning a dedicated external
language-server process, a new class of dependency this project has never taken on. The operator decided
(Session 69) to accept this as a permanent, documented gap — the same treatment as the excluded Visual
Editor — rather than take on that dependency. See "Code-cell language embedding" below.

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
  added a Render-on-Save toggle. **Session 67:** Render-on-Save is a concrete command,
  `quarto.toggleRenderOnSave` ("Render on Save"), backed by two settings —
  `quarto.render.renderOnSave` and a Shiny-document-specific `quarto.render.renderOnSaveShiny`
  (defaults `true` for `server: shiny` documents). Its toolbar placement
  (`menus["editor/actions/left"]`) is a **Positron-only** contribution point (Positron is Posit's own
  VS Code fork, not vanilla VS Code — confirmed via the manifest's `engines.positron` entry and
  `@posit-dev/positron` devDependency) — in plain VS Code, Posit's own toggle is Command-Palette/
  settings-only too, no visible toolbar button. So the gap here is genuinely just "no command, no
  setting" on our side, not "no toolbar button."

**Project-level render command ("Render Project").**
- *Ours:* Present — `quarto.renderProject` discovers the project root (`_quarto.yml`/`_quarto.yaml`,
  ancestor-walk) and spawns `quarto render <root>` with `cwd` pinned to root, rendering the whole project
  rather than just the active document — **Session 45**, CHANGELOG: project-level render, Session 45. (`src/core/project.ts`,
  `src/features/render-project.ts`.)
- *Posit's:* Present — a dedicated "Render Project" command (v1.11.2) that renders every document in a
  project.
- *Notes:* Parity reached (Session 45) — no longer a gap. (Historical: this doc's research, Session 42,
  originally found this unimplemented.) "Preview Project" remains a deliberate, unshipped follow-up —
  `features/preview.ts`'s process-group-owning model doesn't trivially generalize to multi-output-file
  projects (confirmed Session 44).

**Preview command family breadth (render-script preview, per-format preview picker). (Session 67; `previewFormat` SHIPPED Session 82; `previewScript` command SHIPPED Session 84; `previewScript` GATING LAYER shipped Session 85 — PARITY REACHED, item 15 closed.)**
- *Ours:* **Capability parity — both commands ship; the residual gap is Posit's UX *gating*, not the feature.**
  `quarto.previewFormat` ("Preview Format...", Session 82) enumerates a document's declared `format:` outputs and
  previews the chosen one (`quarto preview … --to <fmt>`). `quarto.previewScript` ("Preview Script...", Session 84)
  previews a standalone render script, gated by a pure `isRenderScript` detector that recognizes **both** kinds
  Quarto's engines actually claim — jupyter-percent (`.py`/`.jl`/`.r`, opening with a `# %% [markdown]`/`[raw]`
  cell) **and knitr *spin*** (`.r`, opening with a roxygen `#' ---` block; note Posit's own docs and our earlier
  notes framed this as percent-only — the spin path is a first-class second kind). Both reuse the existing
  `PreviewManager` lifecycle unchanged. **Still pending (Session 84 Slice 2):** Posit's *gating* around the
  command — the `quartoRenderScriptActive` context key, the mutually-exclusive `Ctrl+Shift+K` shared with
  `quarto.preview`, the editor/title button, and the script-file activation events. Ours is currently reachable
  from the Command Palette only. (`src/core/render-script.ts`, `src/core/preview-format.ts`, `src/features/preview.ts`.)
- *Posit's:* Present — beyond `quarto.preview`, the manifest declares `quarto.previewScript` (same
  keybinding as Preview, but active only when previewing a standalone Quarto *render script* rather
  than a `.qmd` document) and `quarto.previewFormat` ("Preview Format...", a per-format preview
  QuickPick, no default keybinding). A third command, `quarto.previewContentShortcut` (`Ctrl+Shift+L`),
  is a general contextual dispatcher across the Visual Editor / plain `.qmd` / Mermaid / Graphviz — that
  one is substantively the same `Ctrl+Shift+L` capability this doc's "Live preview of LaTeX math" row
  already covers, just not previously tied to its command ID; it is not counted as a gap here.
- *Notes:* **Parity reached — gap CLOSED (Sessions 82/84/85; CHANGELOG: preview command family breadth, Sessions 82-85 closed).** Both commands
  exist (per-format picker Session 82; render-script preview Session 84), and Session 85 shipped the
  gating layer that was the residual delta: the `quartoRenderScriptActive` context key, the
  mutually-exclusive `Ctrl+Shift+K` pair, the editor-title entry, the palette gate, and the
  render-script activation events.
  **Two deliberate divergences, both in the safer direction and both grounded firsthand against the
  VS Code 1.128 build:**
  (a) *Keybinding scope.* `Ctrl+Shift+K` is VS Code's built-in **Delete Line**
  (`editor.action.deleteLines`, `primary: 3113`, weight 100 — and an external extension's keybindings
  register at weight 400+, so they win every collision). Posit gates `quarto.preview` on a bare
  `!quartoRenderScriptActive`, which is true in essentially every editor, so their binding overrides
  Delete Line in *every* file type. Ours is scoped `editorLangId == quarto && !quartoRenderScriptActive`:
  the mutual exclusion is identical, but Delete Line keeps working outside Quarto documents.
  (b) *Palette entry.* Posit hides `previewScript` from the palette (`when: false`); we show it, gated on
  `resourceExtname` (`.py`/`.jl`/`.r`/`.R`) rather than on the context key — deliberately, because the key
  is only settable *after* activation and VS Code will not activate an extension merely to evaluate a
  `when` clause, so keying the palette entry off it would make the command unreachable for a lone script
  in a non-Quarto folder (adversarial review, Session 85; Learning #93).
  *Shared residual (Posit has it too, disclosed not papered over):* a standalone `.py`/`.jl` script opened
  with no Quarto workspace file present does not activate the extension, so the keybinding and
  editor-title button stay inert there — the palette command still reaches it and auto-activates.

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
- *Ours:* Present — **10 commands** (run cell, run+advance, run selected line(s), run current code, run
  next cell, run previous cell, run above, run below, run all, insert cell), each individually keybound
  (`ctrl/shift+enter` for the original two, `ctrl+alt+<mnemonic>` for most of the rest — **Session 52**,
  CHANGELOG: run-cell command family completion, Session 52 — `ctrl+alt+c` for `runCurrent`, **Session 78**, item 13(e)).
- *Posit's:* Present — **Session 67 recount: 10 commands, not 8.** The manifest declares
  `quarto.runSelection`, `quarto.runCurrent` ("Run Current Code"), `quarto.runCurrentAdvance`,
  `quarto.runCurrentCell`, `quarto.runPreviousCell`, `quarto.runNextCell`, `quarto.runCellsAbove`,
  `quarto.runCellsBelow`, `quarto.runAllCells`, and `quarto.insertCodeCell` — this doc's original
  8-command enumeration (Session 42) missed both `runCurrent` and `runCurrentAdvance`. A byte-identical
  diff of Posit's manifest between the v1.132.0 tag and current confirms the family itself hasn't
  changed since v1.132.0 — this was always a 10-command family, just under-enumerated by the original
  research.
- *Notes:* **Parity reached on all 10 of Posit's 10 commands (Session 78, item 13(e))** — no longer a
  gap. `runCurrentAdvance` already mapped to our `runCellAndAdvance`; the residual gap
  (`quarto.runCurrent`, "Run Current Code") is now `quarto.runCurrent` here too, registered to the SAME
  selection-or-current-line handler as `runSelectedLines`. Keybound `Ctrl+Alt+C`/`Cmd+Alt+C`, **not**
  Posit's own `Ctrl+Enter`/`Cmd+Enter` — this project's pre-existing `quarto.runCell` already claims
  `Ctrl+Enter` (this project's own keybinding scheme is the reverse of Posit's: `runCell`↔`Ctrl+Enter`/
  `runSelectedLines`↔`Ctrl+Shift+Enter` here vs. `runCurrentCell`↔`Ctrl+Shift+Enter`/`runCurrent`↔
  `Ctrl+Enter` on Posit's side), a disclosed keybinding-scheme divergence discovered this session. The
  exact internal behavioral distinction between Posit's `runCurrent` and `runSelection` is unverifiable
  without reading their AGPL source; this project's reimplementation is a disclosed, defensible judgment
  call grounded in cross-validated public facts (VS Code's own built-in Python extension's identical
  `Ctrl+Enter` convention; a `quarto-cli` GitHub discussion), not a guess at unverifiable internals.

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

**Format Cell (delegate a code cell's contents to the embedded language's own formatter). (Session 67; SHIPPED Session 75.)**
- *Ours:* Present — `quarto.formatCell` (`src/features/format-cell.ts`), keybound `Ctrl+K Ctrl+F` /
  `Cmd+K Cmd+F`, gated on `quarto.inCodeCell`. Delegates a cell's contents to the embedded language's own
  formatter via a virtual document (`vscode.executeFormatDocumentProvider`), preserving `#|`/`//|`
  cell-option directive lines (reuses item 11 slice 2's `buildCellVirtualContent`).
- *Posit's:* Present — `quarto.formatCell` ("Format Cell", `Ctrl+K Ctrl+F` / `Cmd+K Cmd+F`) hands a code
  cell's contents to the embedded language's own installed formatter (e.g. Black/autopep8/styler for
  Python/R) via a virtual document and writes the result back. A continuous CHANGELOG history from
  v1.66.0 (2023) through v1.134.0 (2026-06-22, preserving `#|` cell-option directives so formatters
  can't reflow them) confirms this is real and actively maintained, not a stub.
- *Notes:* **Parity reached (Session 75)** — no longer a gap. (This row's own body was found still
  claiming "Not implemented" while updating this document for Session 78's item 13(d)/(e) closures, even
  though the "At a Glance" summary table had already been corrected to count Format Cell as Parity, Session
  77 — a genuine, previously-uncovered doc inconsistency, corrected here.)

**Cell navigation & cache-management commands. (Session 67; SHIPPED Session 78.)**
- *Ours:* Present — `quarto.goToNextCell`/`quarto.goToPreviousCell` (`src/features/execution.ts`), pure
  cursor-navigation siblings of `runNextCell`/`runPreviousCell` with no delegate dispatch, keybound
  `Ctrl+PageDown`/`Ctrl+PageUp` (`Cmd+` on macOS), matching Posit's own manifest exactly. `quarto.clearCache`
  (`src/features/clear-cache.ts`) spawns `quarto render <file> --cache-refresh` — the documented way to
  force-refresh a document's Jupyter/Knitr execution cache (confirmed against the installed Quarto CLI's
  own `render --help` and quarto.org's code-execution docs) — editor-title-menu placed, matching Posit's
  placement.
- *Posit's:* Present — `quarto.goToNextCell`/`quarto.goToPreviousCell` (`Ctrl+PageDown`/`Ctrl+PageUp`)
  move the cursor between cells with no execution attached, distinct from the run-cell family above; and
  `quarto.clearCache` ("Clear Cache...", editor-title-toolbar-placed) clears Quarto's Jupyter/Knitr
  execution cache — a long-standing command (since v1.14.0, 2022), simply never itemized in this doc.
- *Notes:* **Parity reached (Session 78)** — no longer a gap. Discovered `--cache-refresh` creates a
  `<doc>_cache/` directory as a real side effect (gitignored, cleaned up in the integration test).

**Reticulate (R↔Python) execution pathway. (Session 67.)**
- *Ours:* **Not implemented** — this project has no reticulate-related configuration or code.
- *Posit's:* Present — `quarto.cells.useReticulate` (boolean, default `true`) lets Python code cells
  execute via R's `reticulate` bridge specifically within Knitr-engine (R-Markdown-style) documents, as
  an alternative to native Jupyter-kernel delegation.
- *Notes:* A narrow, previously-uncovered gap — relevant only to Knitr-engine documents mixing R and
  Python, which is a smaller audience than this project's primary Jupyter-engine delegation model above.

---

## Editing & Language Support

**Syntax highlighting / language registration for `.qmd`. (Verdict revised — Session 67: Parity → Real gap; breadth partially closed Session 76.)**
- *Ours:* Present — registers a `quarto` language for `.qmd`/`.rmd`/`.Rmd`, TextMate grammar
  (`text.html.quarto`), **20 embedded scopes** as of Session 76 (yaml/frontmatter, python, r, julia,
  javascript/ojs, bash, c, cpp, csharp, fsharp, rust, go, sql, lua, ruby, php, perl, java, dockerfile,
  powershell — CHANGELOG: quick declarative wins bundle, Sessions 76-78(a), each confirmed against this repo's own bundled `.vscode-test` VS Code
  install's built-in extensions, not guessed).
- *Posit's:* Present — "Syntax highlighting for markdown and embedded languages," but **Session 67's
  manifest diff found the grammar's `embeddedLanguages` map currently lists 50 scope keys**, not just
  the 4 languages this doc previously framed the comparison around — bash/shell, C/C++/C#/F#, Rust, Go,
  SQL, Stan, PRQL, Lua, Ruby, PHP, Perl, Java, Dockerfile, PowerShell, Scala, `typst`, `dot`, `mermaid`,
  and more. **Separately, since v1.127.0 (2025-12-17, PR #868), Posit layers real semantic-tokens
  highlighting on top of the static grammar** when the user's installed language extension supplies an
  LSP with semantic-highlighting support (Posit's own documented example: Pylance). **We now have this
  mechanism too, for EVERY embedded language at once — Sessions 88–89 (item 16, Slices 1–2)**: each
  language in a `.qmd` is forwarded to its own server and the answers are merged into one ordered
  stream (verified against real Pylance **and** the real built-in TS/JS service together, in
  `npm run test:lsp`). The residual gap is no longer scope but *theming*: we carry only the **standard**
  VS Code token types, so a server's own names (Pylance's `module`, `selfParameter`, `builtinConstant`,
  `magicFunction` — a measured **36%** of its tokens; the built-in JS service loses **0%**) are dropped
  and keep their TextMate colour. Slice 3 settles that legend/theming question (D4). A real gap still,
  and now a narrow one.
- *Notes:* **No longer "Direct parity."** Two distinct, previously-uncovered gaps: (1) breadth —
  **narrowed Session 76 from 5 scopes to 20** (our new count) vs. Posit's 50; the residual gap is
  `dot`/`mermaid`/`typst` (deliberately excluded from item 13(a) — see the new "Standalone diagram/typst
  language registration" row below, a distinct registration mechanism, not this grammar's
  `embeddedLanguages` map) and Stan/PRQL/Scala/others from Posit's undisclosed "and more" (no confirmed
  VS-Code-bundled scope for these; Scala in particular is not bundled, unlike everything else on the
  list, so a real one needs its own firsthand research, not assumption); (2) mechanism — **closed for
  every embedded language, Sessions 88–89.** `src/providers/semantic-tokens.ts` is a real
  `SemanticTokensProvider`; it forwards **every** language present in the document to its own server and
  merges the streams (`mergeSemanticTokens`) into the one ascending stream VS Code accepts. Proven with
  two REAL servers at once, not stand-ins: a `.qmd` whose `{ojs}` cell sits between two `{python}` cells
  comes back correctly interleaved from real Pylance and the real built-in TS/JS service. (3) theming —
  **closed, Session 90 (D4, Slice 3), and the answer was NOT the obvious one.** The tempting move —
  carry all of Pylance's foreign token names, "recovering" the 36% we drop — is a **regression**: a
  `.qmd`'s `{python}` cell is already coloured by VS Code's bundled MagicPython grammar, so the semantic
  layer paints *over* a grammar that is mostly right, and a carried-but-unstyleable name **overrides**
  TextMate rather than degrading to it. Pylance's own `contributes.semanticTokenScopes` entries — which
  say "the superType default is wrong for this type" — are `language: "python"`-gated and therefore inert
  on a `.qmd`. So we carry exactly **`module`** (`os`, `np`), the one name MagicPython gives no scope at
  all and the one real Pylance is observed emitting, plus a `semanticTokenScopes` contribution for
  `language: "quarto"`. `magicFunction` would have turned `__init__` from #DCDCAA to #d2a8ff purple.
  **Item 16 is now fully SHIPPED — this row is at parity.** *(Session 97 extended the same discipline to
  the MODIFIER axis, CHANGELOG: semantic-token modifier axis, Session 97: it carries the one modifier `typeHintComment` — the interior of a legacy
  `# type:` comment, which we were repainting from the #8b949e comment colour to #4EC9B0 teal — with a
  matching `*.typeHintComment` scope contribution, and REFUTED the filed `builtin` instance, which already
  matches a real `.py`.)*

**Code-cell language embedding — completion/hover/go-to-def/signature-help/diagnostics forwarding.
(Verdict revised — Session 67: previously ambiguous/unbucketed → Real gap.)**
- *Ours:* Present for completion/hover/go-to-definition/signature-help — embedded grammar regions for
  python/r/julia/ojs, plus request forwarding into the user's installed language extension via
  per-language virtual documents, with graceful degradation. (`src/core/embedded/`,
  `src/providers/embedded.ts`, `src/features/embedded-vdoc.ts`.) **All four — completion, hover,
  go-to-definition, signature-help — plus in-cell symbols are verified against real Pylance**
  (`npm run test:lsp`), not only against test doubles; the go-to-definition test also confirms the
  vdoc-URI-to-`.qmd` remap end to end — see the note below. **Diagnostics forwarding:
  not implemented** — the three `DiagnosticCollection`s in `src/` are
  `src/features/yaml-diagnostics.ts` (unknown keys in `_quarto.yml`'s project/website/book blocks),
  `src/features/yaml-value-diagnostics.ts` (wrong cell-option, front-matter, nested, numeric, and other-container *values* in `.qmd`, Sessions 124–125/128/130/132),
  and `src/features/yaml-project-value-diagnostics.ts` (wrong closed *values* one and two levels under `_quarto.yml`'s project/website/book blocks, Sessions 135/137, plus a top-level `execute:` block's children, Session 141, plus per-format option values under `format:` → `<fmt>:`, Session 143, plus general document keys at COLUMN 0, Session 149);
  none of the three forwards code-cell diagnostics, and `src/providers/embedded.ts` registers none. **The inverse leak — background vdocs
  *publishing* phantom diagnostics under Pylance's non-default `diagnosticMode: "workspace"` — is
  muted (Session 93):** the two vdoc builders inject a file-level `# type: ignore` on line 0 of a
  python vdoc, suppressing the type/name/import phantom errors on `.quarto/vdoc-mit/` paths (verified
  RED→GREEN against real Pylance under `QMD_LSP_DIAGMODE=workspace`). The default `openFilesOnly`
  posture never leaked. Transient parse-error residuals (mid-typing) and R/Julia remain as tracked
  follow-ups (`BACKLOG.md`).

  > **⚠ These features were BROKEN from Phase 6e until Session 87 (CHANGELOG: embedded-language forwarding did not reach real language servers, Session 87), and this document
  > claimed parity for them the whole time.** The virtual documents were served on a custom URI scheme
  > (`quarto-embedded:`), and real language servers register their providers against a
  > `documentSelector` scoped to the schemes they can read — so no provider was ever registered for
  > them and every forward returned nothing, with no error and no warning. Measured against real
  > Pylance on identical content: **306 completions on a `file:` URI, 0 on ours.** In-cell outline
  > symbols were dead the same way (2 → 0). `{ojs}` alone kept working, because VS Code's *built-in*
  > TS/JS provider happens to be scheme-agnostic. Session 87 moved the vdoc to a real `file:` document
  > and added `npm run test:lsp`, which exercises the forwards against a real language server with a
  > control proving it was alive. The entry below is the parity claim as it now stands — earned, and
  > checked against the real dependency rather than a double.
- *Posit's:* Present for Python/R/Julia, explicitly documented ("Completion for embedded languages…
  enhanced features… can be enabled by installing the most recent version(s) of these extensions" —
  Python/Jupyter, R, Julia). **Session 67, MAJOR finding:** since v1.133.0 (2026-06-03, PR #980,
  refined in v1.134.0 PR #1013), Posit additionally forwards the embedded language server's own
  *diagnostics* (e.g. Pylance/Pyrefly/Ruff squiggly underlines) as native VS Code Diagnostics directly
  inside `.qmd` code cells — independently toggleable via `quarto.cells.diagnostics.enabled` (default
  `true`) and `.debounceDelay` (default 500ms), alongside the pre-existing
  `quarto.cells.hoverHelp.enabled`/`quarto.cells.signatureHelp.enabled` toggles.
- *Notes:* We match on substance for completion/hover/go-to-def/signature-help across all four
  languages — **as of Session 87, and now verified against a real language server rather than a test
  double.** The previous wording here ("better test-evidenced than what Posit's docs page shows") was
  the most confidently wrong sentence in this document: the suite was 100% green precisely *because*
  every stand-in was registered on our own custom URI scheme — the exact axis a real server
  discriminates by — so it could not have detected that no real server registers there. Test count is
  not test evidence when the doubles agree with the code about the wrong thing. Diagnostics
  forwarding is a real, substantive gap — a Python code cell with a real type error or lint violation shows
  nothing in this project, where Posit's extension shows the same red squiggle the user would see in a
  plain `.py` file — and was the single largest *incremental* (non-Visual-Editor) gap Session 67's refresh
  found. **Session 68 investigated it and found it is not a simple extension of the existing forwarding
  architecture** (contra this row's own original framing): VS Code's own Extension API docs state directly
  that diagnostics cannot be served by request-forwarding (no `vscode.executeDiagnosticProvider` pull
  command exists) — confirmed independently three ways (the official docs; five firsthand Extension
  Development Host tests showing this project's existing vdoc pattern gets zero diagnostics unless the
  document is a genuinely visible, active editor tab, which cannot coexist with the user editing their real
  `.qmd` tab; and Posit's own PR prose, which shows they solved it by abandoning delegation to the user's
  installed extension entirely in favor of spawning and owning their own dedicated language-server
  connections). **Session 69: the operator decided to accept this as a permanent, documented gap** — the
  same treatment as the excluded Visual Editor — rather than take on that new class of dependency, closing
  CHANGELOG: code-cell diagnostics forwarding, closed as not pursued, Session 69 as investigated-not-pursued. Full evidence trail:
  `docs/planning/2026-07-10-code-cell-diagnostics-plan.md`.

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

**Nested/deep object option completion (e.g. `theme:`, `code-tools:`, `grid:` sub-keys). (Bucket resolved
Session 67: Soft / ambiguous comparison — this row was previously left unassigned to any At-a-Glance
bucket.)**
- *Ours:* Present for `execute:` and per-format option sub-keys — **one object level deep only**
  (schema-driven, explicitly **not recursive**: deeper 3+-level nesting is deferred, unimplemented
  `b2-iii-deep` work). No `_brand.yml`-specific handling exists.
- *Posit's:* Partial — confirmed support for `_brand.yml` validation/autocompletion (CHANGELOG v1.116.0,
  "if supported by the Quarto version ≥ 1.6.24"); general nested-key completion is described but not
  itemized for `theme`/`code-tools`/`grid` specifically.
- *Notes:* Neither side has an exhaustive, confirmed sub-key inventory for the same named keys — a soft
  comparison, not cleanly "parity," "ahead," or "gap." We have zero `_brand.yml` support, which Posit
  does have. Do not describe our own nested completion as "recursive" — it is capped at one level by
  design.

**Document links + filepath autocompletion for file-path values in `_quarto.yml`. (Session 67; SHIPPED Sessions 80–81 — full parity.)**
- *Ours:* **Present (parity) — (1) document links SHIPPED Session 80, (2) filepath completion SHIPPED Session 81.**
  `src/providers/document-links.ts` registers an existence-checked `vscode.DocumentLinkProvider` and
  `src/providers/filepath-completion.ts` registers a `CompletionItemProvider`, both on the same
  pattern-based `DocumentSelector` (`{pattern:"**/_quarto.{yml,yaml}"}`). Links: any scalar / sequence /
  inline-mapping value anywhere in `_quarto.yml`/`_quarto.yaml` that resolves to a real file/directory
  on disk (relative to the config file's own dir) becomes clickable; a value that resolves to nothing
  gets no link. Completion: typing a value after `key:`, a `- ` sequence marker, or a `- key:` inline
  mapping offers the real files/subdirectories of the directory the value-so-far points at (`File`/
  `Folder` items, folders suffixed `/`, re-scoping into subdirectories on `/`). Both are whole-document,
  existence-grounded heuristics with no schema query, matching Posit's own PR #906 approach (plan
  `docs/planning/2026-07-11-quarto-yml-document-links-plan.md`; both slices share one pure-core module,
  `src/core/project-links.ts`).
- *Posit's:* Present — since v1.132.0 (PR #906): (1) clickable `DocumentLink`-style navigation for
  file-path values referenced inside `_quarto.yml` that jump directly to the referenced file, and (2)
  filepath autocompletion suggesting actual project files when editing those YAML values. Shipped and
  stable for roughly two months as of this refresh.
- *Notes:* Both halves are now at parity (Sessions 80–81). Distinct from the key/value completion and
  diagnostics rows already tracked here.

**YAML schema validation / diagnostics (red squiggles for invalid/unknown keys).**
- *Ours:* Present, narrower in scope — always-on diagnostics flag unknown keys inside the
  `project:`/`website:`/`book:` blocks of `_quarto.yml`/`_quarto.yaml` only (the one region confirmed
  "closed" against the live schema), **and (Sessions 124–125, 128, 130, 132) flag a wrong *value* of an
  already-recognized `#|` cell option, top-level front-matter key, NESTED front-matter key (under
  `execute:`/`format:\n <fmt>:`), OR a child ONE level under any of 15 OTHER closed front-matter
  containers (`crossref:`/`listing:`/`mermaid:`/`editor:`/`chalkboard:`/`lightbox:`/`grid:`/`about:`/…)
  in `.qmd` when its value set is provably closed** — including NUMERIC-typed values on every one of
  those surfaces (`echo: maybe`, `code-overflow: banana`, `toc: yes`, `pdf-engine: PDFLATEX`,
  `execute.echo: maybe`, `format.html.toc: yes`, `crossref.chapters: banana`, `mermaid.theme: sunset`,
  `columns: wide` → Error; open sets like
  `output`/`engine`/`documentclass`/`execute.output`/`execute.daemon`/`format.html.theme`/`crossref.fig-title`
  are never flagged; the top-level `.qmd` `format` NAME is now VALIDATED against `quarto render`'s
  front-matter schema layer (Session 145 — `format: banana`/`reveal`/`word` → Error, while
  extension/modifier/hidden/`.lua` names stay silent; the `_quarto.yml` `format` scalar NAME shipped
  Session 152 via the SAME predicate, leaving only the container-key form deferred on both surfaces);
  and unknown KEYS remain intentionally unflagged
  since those schemas are open). Coverage:
  **Session 47** (project keys) + **124** (cell values) + **125** (top-level front-matter values) +
  **128** (nested `execute:`/`format:` values) + **130** (numeric-typed values on every surface) +
  **132** (15 other closed containers) + **135** (`_quarto.yml` project-config container values —
  `project:`/`website:`/`book:`), CHANGELOG: YAML schema diagnostics, Session 47/#43/#46/#47. (`src/core/yaml-schema.ts`
  `SchemaIndex.projectKeys`/`projectFields`, `src/core/yaml-value-check.ts`,
  `src/core/yaml-frontmatter-values.ts`, `src/core/yaml-frontmatter-nested-values.ts`,
  `src/core/project-yaml.ts`, `src/features/yaml-diagnostics.ts`,
  `src/features/yaml-value-diagnostics.ts`, `src/features/yaml-project-value-diagnostics.ts`.)
- *Posit's:* Present, with caveats — on-save validation for both the classic editor and (since v1.124.0)
  the Visual Editor, plus profile-specific `_quarto.yml` (since v1.39.0), and (unlike ours) also covers
  front matter and cell options. Coverage is inconsistent because some internal schemas are "open"
  (unknown keys silently accepted) vs. "closed" (flagged) — per an unofficial community reference
  (`quarto-tdg.org/yaml`); Posit's own docs don't state this caveat directly. Implemented as a custom
  internal LSP diagnostics provider, not the standard VS Code `yamlValidation`/`jsonValidation` manifest
  points.
- *Notes:* Partial parity (Sessions 47 + 124 + 125 + 128 + 130 + 132 + 135 + 137) — narrowed, not closed. We validate the
  project-config block keys, cell-option *values*, top-level front-matter *values*, nested
  front-matter *values* under `execute:`/`format:`, values one level under 15 OTHER closed containers
  (`crossref:`/`listing:`/`mermaid:`/`editor:`/…; Session 132), the `_quarto.yml`-config container VALUES
  one level under `project:`/`website:`/`book:` (`draft-mode`/`repo-actions`/`downloads`/`sharing`/
  `execute-dir`/…; Session 135 — the first slice on the `_quarto.yml` surface, matching `quarto render`'s
  `readAndValidateYamlFromFile` schema layer) AND two levels under them — a wrong closed GRANDCHILD value
  (`navbar.collapse-below`/`sidebar.style`/`search.location`/`search.limit`/`cookie-consent.type`/
  `project.preview.browser`/…; Session 137, website + book via `super base-website`), AND NUMERIC-typed values on every one of
  those surfaces (`fig-width: wide`, `columns: fat`, `execute.daemon: banana`, a cell `#| layout-ncol: two`;
  Session 130), AND numeric-MEMBER enums by COERCED value (`aspectratio` document front matter incl. nested
  `format.beamer`, `google-analytics.version` under website + book; Session 139 — the shared matcher now
  compares `169.0`≡`169`/`3.0`≡`3` numerically, removing ≥3 live `aspectratio` false positives and restoring
  `version` validation), AND a wrong closed value of a top-level `execute:` block's children in `_quarto.yml`
  (`echo`/`cache`/`freeze`/`error`/`daemon`/…; Session 141 — reusing the SAME `frontMatterKeys(["execute"])`
  reader + `isWrongValue` matcher the `.qmd` document surface uses, S128, so the two surfaces agree exactly),
  AND — Session 147, the second cross-surface CORRECTNESS fix after S139 — the NULL ARM: a field whose
  schema lists a literal `null` enum member (`auto-play-media`, `preload-iframes`,
  `ipynb-shell-interactivity`) no longer has its `key: null`/`~`/`Null`/`NULL` flagged, because
  `valuesOfSchema` silently DROPPED that member from `values` while `closednessOfSchema` still
  marked the field CLOSED — removing 3 live false positives reachable from the `.qmd` top level,
  the `.qmd` per-format path, and `_quarto.yml`'s `format:` container, while the case-inexact `NuLl`
  and the quoted `"null"` (both quarto-rejected) keep flagging,
  AND — Session 148, the third such fix — the KEY/VALUE SEPARATOR: YAML's block-mapping separator is
  a colon followed by space/tab/end-of-line, but all FOUR value paths split at the first
  colon, so `toc:: true` (whose real key is `toc:`, unknown but ACCEPTED on an OPEN key set, exit 0)
  was read as key `toc` with the bogus value `: true` and flagged. Removing 14 measured live false
  positives across every surface the family validates — the `.qmd` top level and nested paths, the
  `#|` CELL OPTIONS, and `_quarto.yml`'s `execute:`/`format:` containers plus DEPTH-2 under
  `project:`/`website:`/`book:`.
  The rule is diagnostics-side only: completion still offers values on a `key:value` line, since
  there it is a user mid-typing that the provider repairs by prepending the space
  — empirically the regions safe to flag without false positives (see `BACKLOG.md`'s
  "Polish / deferred" for known false-negative edge cases). The remaining gap on our side is narrower
  still: `.ipynb` cell/front-matter values, the DEEPER `_quarto.yml`-config container values
  (depth-3+ under `navbar:`/`sidebar:`/`search:`, sequence-form navbar/sidebar items, and `format:` document keys placed in
  `_quarto.yml` — the `execute:` half shipped Session 141 and the `format:` per-format OPTION-value half Session 143, leaving depth-2+/KEY-under-`execute` open — **the general document-key case shipped Session 149** (a wrong value of a recognized document key at COLUMN 0 of `_quarto.yml`: `toc: banana`, `number-sections: yes`, `fig-width: wide`, resolved through the SAME `frontMatterKeys([])` reader the `.qmd` top-level surface has used since S125) **and the top-level scalar `format:` NAME shipped Session 152** (Combo 3, via the SAME bespoke predicate the `.qmd` surface has used since Session 145 — so the two surfaces now agree on 378 of 378 top-level fields, with no remaining top-level-scalar divergence); `brand:`/`jupyter:`/`manuscript:` are grounded OUT with no closed one-level children),
  integer-typed pandoc-layer rejections
  (`toc-depth: 2.5` — a downstream pandoc error, not quarto's YAML-schema layer), the
  container-key form of `format:` on both surfaces (the scalar `format:` NAME shipped Session 145 on `.qmd` and Session 152 on `_quarto.yml`), and unknown front-matter/cell KEYS (intentionally
  unflagged — open schemas).

---

## Outline & Navigation

**Document outline / symbols (headings + code cells). (Verdict revised — Session 67: Parity → Real gap
(granularity).)**
- *Ours:* Present, both document- and workspace-scope — a `DocumentSymbolProvider` (Outline view,
  breadcrumbs, Go to Symbol in Editor) **and**, as of Session 54, a `WorkspaceSymbolProvider` (Go to
  Symbol in Workspace, Ctrl+T/Cmd+T), searching every `.qmd` file in the workspace via
  `vscode.workspace.findFiles`, not just the active editor. Setext heading support added Session 66. One
  `DocumentSymbol` per heading/cell — no symbol extraction from *within* a cell's body.
- *Posit's:* Present — both document- and workspace-scope symbol providers ("Go to Symbol in Workspace…
  Ctrl+T"). **Session 67:** since v1.133.0 (PRs #972/#974), Posit's outline additionally (a) extracts
  code symbols from *within* code-cell bodies (not just one node per cell), and (b) offers a
  setting/command (`quarto.symbols.showCodeCellsInOutline` / `quarto.toggleCodeCellsInOutline`) to
  show/hide cells in the outline. Separately, since v1.127.0, Posit by default excludes markdown headers
  from R-package projects (a `DESCRIPTION` file present) from workspace symbols unless
  `quarto.symbols.exportToWorkspace` is set.
- *Notes:* Both in-document and cross-file symbol navigation are covered at the top level, but Posit's
  outline is a deeper tree (in-cell symbols) with more configurability (show/hide, R-project exclusion)
  than this project's flat one-symbol-per-heading/cell model — this doc's prior "Parity" verdict
  overstated granularity parity.

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

**Project-wide / multi-file intelligence (cross-ref + citation resolution across files). (Bucket resolved
Session 67: Soft / ambiguous comparison — this row was previously left unassigned to any At-a-Glance
bucket.)**
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

**Contextual Assist Panel (non-AI help/documentation on cursor context). (Session 67: concrete identifiers
added.)**
- *Ours:* Partial — no unified contextual-help sidebar; the narrower equivalent is two separate webview
  commands (Preview Math, Preview Diagram) rather than one cursor-context panel.
- *Posit's:* Present — one unified sidebar panel showing contextual assistance (code-doc lookup, LaTeX
  preview, image thumbnails) based on cursor position. **Session 67 concrete detail:** commands
  `quarto.showAssist`/`quarto.codeViewAssist`, pin/unpin (`quarto.assist.pin`/`.unpin`), a dedicated
  Explorer webview view (id `quarto-assist`), a `quarto.assist.updateMode` setting, and a default
  `Ctrl+F1`/`Cmd+F1` keybinding (bound to `quarto-assist.focus`). **Correcting a plausible
  misconception:** the panel lives in the **Explorer** sidebar today, not the Activity Bar — it was
  briefly moved to the Activity Bar in 2022 (v1.21.0) and moved back nine days later (v1.23.0). All of
  these facts are 2022–2023-vintage; there has been no assist-panel-related change since.
- *Notes:* We cover the math/diagram-preview slice of this via separate commands, not the code-doc-lookup
  or image-thumbnail modes. Still a real gap — just with concrete identifiers now on record instead of
  prose-only.

**Live preview of LaTeX math (`$..$`) embedded in the editor. (Session 67: engine identity added.)**
- *Ours:* Present — renders inline `$…$` and display `$$…$$` regions in a webview beside the editor with
  vendored KaTeX, live-updating as the document changes.
- *Posit's:* Present — a Preview button / `Ctrl+Shift+L` shortcut opens a live-updating preview, using
  **MathJax** as its rendering engine (previously unnamed in this row), configurable via
  `quarto.mathjax.scale` (preview scaling) and `quarto.mathjax.extensions` (which MathJax TeX extensions
  load, beyond the always-on `ams`/`color`/`newcommand`/`noerrors`/`noundefined`).
- *Notes:* Direct parity on the capability; ours is Command-Palette-only (no inline Preview button or
  keybinding, no confirmed auto dark/light theming), and we expose no equivalent scale/extension
  configurability for our KaTeX renderer.

**Live preview of diagrams (Mermaid / Graphviz) embedded in the editor.**
- *Ours:* Present — Mermaid cells render live via vendored Mermaid; Graphviz (`{dot}`) cells render live
  via a vendored WASM build of Graphviz itself (`@viz-js/viz`, shipped Session 56).
- *Posit's:* Present — both Mermaid and Graphviz render live.
- *Notes:* At parity on live rendering. Unlike every other vendored asset in this project, the Graphviz
  WASM module's compiled contents are EPL-2.0 (not MIT) — disclosed in `NOTICE`; see CHANGELOG: Graphviz dot diagram rendering, Session 56.
  A related but distinct gap (standalone `.dot`/`.mmd` file-type support, not just live rendering inside
  `.qmd`) is tracked as its own row below — Session 67.

**Standalone diagram/typst language registration (`.dot`, `.mmd`, `.typ` as first-class file types).
(Session 67; SHIPPED Session 76's item 13(b) list corrected below.)**
- *Ours:* **Present, config-only — SHIPPED Session 77 (CHANGELOG: quick declarative wins bundle, Sessions 76-78(b)).** `dot` (`.dot`/`.gv`),
  `mermaid` (`.mmd`), and `typst` (`.typ`) are each registered as standalone, first-class VS Code
  languages — own `contributes.languages` entry + a dedicated `languages/<id>-language-configuration.json`
  each (comments, brackets, auto-closing/surrounding pairs) — independent of the embedded-grammar scopes
  used inside `.qmd` code cells (item 13(a)). Deliberately no TextMate grammar of our own (declarative
  registration + config only, per item 13(b)'s scope), so these standalone files get correct
  comment-toggling/bracket-matching from this extension but not our own syntax coloring (coloring depends
  on the user having a companion extension installed for that language id, same delegated-companion
  posture as this project's embedded-cell languages).
- *Posit's:* Present — `dot` (`.dot`/`.DOT`/`.gv`), `mermaid` (`.mmd`), and `typst` are each registered
  as standalone, first-class VS Code languages (own `language-configuration.json` each), independent of
  the embedded-grammar scopes used inside `.qmd` code cells. `dot` additionally ships 4 dedicated
  snippet files (general/node-attribute/edge-attribute/graph-attribute) — a gap we don't close (not part
  of item 13(b)'s scope; DOT-specific completion snippets would be their own future item).
- *Notes:* Distinct from the live-diagram-preview row above (which is about rendering *inside* `.qmd`,
  where we're at parity) — this was about editing support for the *standalone* file types themselves,
  now closed at the registration/config layer. **Corrected a factual error this row itself previously
  carried: Typst source files use the `.typ` extension, not `.typst`** (confirmed against the installed
  Quarto CLI's own bundled `.typ` template files and typst.app's own docs — `PROJECT_LEARNINGS.md`
  Learning #85). Residual gap vs. Posit: no TextMate grammar (syntax coloring) for these 3 standalone
  languages, and no DOT-specific snippet family — both unranked, future candidates if picked up.

**Cell-execution background highlighting. (Session 67.)**
- *Ours:* **Not implemented** — no equivalent configuration or visual treatment for executable code
  cells.
- *Posit's:* Present — five configuration keys (`quarto.cells.background.enabled` [deprecated, points to
  `.color`], `.color`, `.lightDefault`, `.darkDefault`, `.delay`) apply a background-color highlight to
  executable code cells, with separate light/dark defaults and a debounce delay. A long-standing feature
  (since v1.3.0, 2022), not a recent addition — simply never itemized in this doc before.
- *Notes:* A cosmetic/visual-affordance gap, not a functional one — genuinely uncovered until this
  refresh.

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
  `quarto create-project`, opens the result as the workspace) — **Sessions 49–50**, CHANGELOG: onboarding walkthrough + scaffolding commands, Sessions 49-51
  Tracks A/B. (`src/core/new-document.ts`, `src/features/new-document.ts`,
  `src/core/create-project-args.ts`, `src/features/create-project.ts`.)
- *Posit's:* Present — `quarto.newDocument`, `quarto.createProject`, `quarto.fileCreateProject`, etc.
  **Session 67:** the manifest also declares `quarto.newPresentation` ("New Quarto Presentation (qmd)"),
  `quarto.newNotebook` ("New Quarto Notebook (ipynb)"), and `quarto.fileNewDocument` (an Explorer "New
  File..." variant of `newDocument`, via `contributes.menus["file/newFile"]`) — all long-standing
  (2022), simply never itemized here before.
- *Notes:* Parity reached (Sessions 49–50) — no longer a gap for the core create-document/create-project
  capability, which our single flexible `quarto.newDocument` (format/title-prompted) and
  `quarto.createProject` already cover. We don't have Posit's separate `quarto.fileCreateProject`
  (Explorer-context-menu project creation) or the format-preset/Explorer-integration commands newly
  itemized above (`newPresentation`, `newNotebook`, `fileNewDocument`) — a real but narrow
  discoverability gap, not a capability gap.

**Notebook (`.ipynb`) support.**
- *Ours:* Present — `quarto.convertToIpynb` (`.qmd`→`.ipynb`) and `quarto.convertToQmd`
  (`.ipynb`→`.qmd`), mirroring Posit's own command IDs and titles — **Session 63**, `BACKLOG.md` item
  #8. A thin adapter spawns `quarto convert <input> --output <derived-path>`; a modal
  overwrite-confirmation guards the bare CLI's silent-overwrite default (this project's first modal
  prompt). No vendored asset and no new notebook UI — VS Code's own built-in `ipynb` extension (MIT,
  bundled) already renders/edits `.ipynb`. (`src/core/convert-args.ts`, `src/features/convert-notebook.ts`.)
- *Posit's:* Present — "Convert to `.ipynb`" and "Convert to `.qmd`" commands (v1.132.0).
- *Notes:* Parity reached (Session 63) — no longer a gap for conversion. (Historical: this doc's research
  originally claimed this "would need notebook-renderer/serializer work well beyond our current
  single-file `.qmd` scope" — Session 62's plan found that estimate wrong: VS Code's own built-in
  `ipynb` extension already supplies the renderer/serializer, so the actual scope was a thin
  CLI-spawning adapter, comparable in size to `render`/`createProject`.) Notebook cell **execution**
  remains the user's own `ms-toolsai.jupyter` install, the same boundary already drawn for `.qmd` cell
  execution. **Session 67, one narrower gap surfaced:** Posit also declares a
  `contributes.notebookRenderer` (id `quarto.markdown-it.qmd-extension`, extending VS Code's built-in
  `vscode.markdown-it-renderer`) that gives Quarto-flavored markdown Quarto-aware rendering inside
  markdown *cells* of an open `.ipynb` notebook — a long-standing feature (since ~v1.81.0, 2023), not a
  recent addition, just never itemized here. This project has no equivalent notebook-renderer
  contribution.

**Zotero integration.**
- *Ours:* **Not implemented.**
- *Posit's:* Present, but **Visual-Editor-only** — a native Insert Citation picker over Zotero libraries
  with auto-`.bib` updates, inside their WYSIWYG editor. Source-mode Zotero support is an unresolved
  community feature request on their side too, worked around only via a third-party fork extension.
- *Notes:* A softer gap than it first appears — Posit itself only ships Zotero inside its (also-absent
  for us) Visual Editor, not in plain source-mode editing, which is where we operate. **Session 67
  precision:** the library setup commands (`quarto.zoteroConfigureLibrary`/`quarto.zoteroSyncWebLibrary`)
  are *not* scoped to the Visual Editor in the manifest — they're reachable from the Command Palette
  regardless of editor mode (unlike sibling commands such as `convertToIpynb`, which do carry editor-mode
  `when`-clauses). That's a real manifest nuance, but the actual user-facing payoff — the `@`-completion
  Insert Citation picker over a connected library — remains confirmed Visual-Editor-only per Posit's own
  maintainers, so this row's "narrower deficit" conclusion still holds.

**Visual (WYSIWYG) editor.**
- *Ours:* **Not implemented** — no custom-editor/WYSIWYG/ProseMirror-style code anywhere; we ship only
  the raw source `.qmd` editor.
- *Posit's:* Present — "includes a visual markdown editor that supports all of Quarto's markdown syntax
  including tables, citations, cross-references, footnotes, divs/spans…"
- *Notes:* **Posit's single largest feature we do not attempt.** A major, likely multi-session
  undertaking (custom editor + rich-text engine) if ever pursued. Several other gaps (Zotero-in-editor,
  spell check) are downstream of this one — and are explicitly out of this project's v1 scope per
  `docs/planning/2026-06-27-extension-architecture-plan.md` §7. **Session 67 concrete detail** (for the
  record, not a scope change): the manifest registers `contributes.customEditors` with viewType
  `quarto.visualEditor` (`*.{md,qmd}`, priority `option`) and two mode-switch commands,
  `quarto.editInSourceMode`/`quarto.editInVisualMode` (both bound to `Ctrl+Shift+F4`/`Cmd+Shift+F4` under
  mutually exclusive `when`-clauses; menu placement is asymmetric — `editInVisualMode` is in
  `editor/context`+`editor/title`, `editInSourceMode` is in `webview/context`+`editor/title`, both also
  in the Command Palette).

**Snippets for common Quarto constructs.**
- *Ours:* Present — **15 snippets** (`snippets/quarto.json`, `contributes.snippets`): front matter, the
  4 executable-cell languages, callouts, fenced divs, tabset panels, one per cross-reference kind this
  extension itself recognizes (fig/tbl/eq/sec/lst) — **Session 53**, CHANGELOG: snippets, Session 53 — plus
  `list-table` and a reveal.js `fragment` snippet — **SHIPPED Session 77, CHANGELOG: quick declarative wins bundle, Sessions 76-78(c)**.
- *Posit's:* Present — "Code snippets… make it easier to enter repeating code patterns (code blocks,
  callouts, divs, etc.)."
- *Notes:* **Parity reached (Session 77)** for every construct named in this comparison. Independently
  designed from Quarto's own documented markdown syntax (grounded against this repo's own
  fixtures/`core/refs.ts` for the original 13; `list-table`/`fragment` grounded against Quarto's own
  public docs — the 1.9 release notes and the revealjs Advanced Reveal page), not from Posit's AGPL
  extension's actual snippet content (Learning #1 look-but-don't-copy gate). **Session 67** had found
  Posit's snippet set also includes a `list-table` directive snippet (CHANGELOG v1.131.0) and a reveal.js
  `fragment` snippet (v1.129.0) — both pre-date Session 53 by months (v1.129.0/v1.131.0 shipped Jan/Apr
  2026; Session 53 ran 2026-07-09), so this was always a pre-existing granularity gap, not something
  Posit added afterward. Session 77 closes it.

**Image paste / drag-drop (clipboard paste or file drag-drop → auto-save + insert markdown reference).
(Session 67: split into two distinct claims — paste stays "we're ahead," drag-drop is parity, not ahead.)**
- *Ours:* **Present** — `vscode.languages.registerDocumentPasteEditProvider` +
  `registerDocumentDropEditProvider` for `.qmd` (paste AND drag-drop, bundled into v1): writes the
  image under `images/` next to the document and inserts `![](images/<file>)`, with collision-avoidance
  naming — **Session 58**, `BACKLOG.md` "Phase 7 authoring aids."
- *Posit's:* **Split by mechanism (Session 67, from public GitHub issues, not source code):**
  **clipboard paste** of image data (e.g. a screenshot with no backing file) is confirmed **still not
  supported** in the plain source editor (quarto-dev/quarto#326, open since 2023, most recent comment
  2026-03) — the maintainer-endorsed workaround is literally "paste into the file explorer, then
  drag-drop into the source." **Drag-drop of an existing image file**, however, **does work** and has
  since v1.76.0 (2023-03-16, "Shift-Drag/Drop of images in markdown source editor") — confirmed by
  user reports as recently as Aug 2025 (quarto-dev/quarto#330, modulo a mapped-network-drive path bug).
- *Notes:* **Paste is still a genuine "we're ahead"** — that half of Posit's own source editor remains
  unimplemented. **Drag-drop is parity, not an advantage** — the doc's prior wording bundled both
  mechanisms as one undifferentiated "still absent," which overclaimed the drag-drop half.
  Independently designed from VS Code's own MIT built-in markdown paste-image implementation (read
  directly for precedent, not Posit's AGPL extension — Learning #1 look-but-don't-copy gate).

**AI/Copilot authoring assistance.**
- *Ours:* Not implemented (out of scope by design — no AI feature on this project's roadmap).
- *Posit's:* Also absent as a bespoke feature — GitHub Copilot works in `.qmd` only via the separately
  installed generic Copilot extension; Posit ships only compatibility fixes ("Fixed Copilot completions
  in `.qmd` documents," v1.129.0).
- *Notes:* True parity — both extensions are AI-feature-free by design.

**Getting-started walkthrough / onboarding UI.**
- *Ours:* Present — a `contributes.walkthroughs` entry (`quartoGettingStarted`, 5 steps: install/verify
  Quarto, create a document, create a project, render/preview, run a cell), each with a command-link
  action button and a completion event — **Session 51**, CHANGELOG: onboarding walkthrough + scaffolding commands, Sessions 49-51 Track C.
- *Posit's:* Present — "Getting started with Quarto walkthrough" (v1.17.0).
- *Notes:* Parity reached (Session 51) — no longer a gap.

**Spell checking integration.**
- *Ours:* **Present** — a documented `cSpell.languageSettings` config recipe
  ([`docs/SPELL-CHECK.md`](SPELL-CHECK.md)) scoping the third-party `streetsidesoftware.code-spell-checker`
  ("cspell") extension to Quarto's prose regions — skipping YAML front matter, code cells (and their
  `#|`/`//|` options), inline code spans, HTML comments, math, and cross-reference/citation tokens — so
  plain-source-editor spelling works with zero false positives on real content, empirically validated
  against a multi-region fixture. No spell-check engine, dictionary, or `DiagnosticCollection` of our
  own — **Session 65**, CHANGELOG: spell checking, Session 65.
- *Posit's:* Partial — native spell checking exists, but only inside the Visual Editor, not in plain
  source/markdown editing; their Visual Editor's spell checker also has a documented single-language-at-
  a-time limitation.
- *Notes:* No longer a gap — **we're now ahead of Posit's own source editor** here (their spell check is
  Visual-Editor-only; ours works in plain source `.qmd` editing), via a documented third-party-extension
  recipe rather than a built-in checker — the same "delegated" pattern this project already uses for
  code-cell execution (an installed Jupyter/R/Julia extension). cspell's underlying engine library is
  MIT; its published VS Code extension is GPL-3.0-or-later — recommended only, never vendored or
  bundled.

**Extensibility surfaces: public CLI-query API, Quarto-Extension/Lua authoring support. (Session 67 —
Soft / ambiguous comparison; developer-facing, arguably outside this doc's own "what a document author
can do" scope, included for completeness rather than as a strict real-gap claim.)**
- *Ours:* **Not implemented** — `src/extension.ts`'s `activate()` returns no consumable API object for
  other extensions to query; no Lua/Quarto-Extension (custom-filter) authoring support of any kind (no
  `.luarc.json` provisioning, no `_extension.yml`-triggered activation).
- *Posit's:* Present, both developer/extension-author-facing rather than document-author-facing: (1)
  since v1.128.0 (2026-01-08, PR #879), a public extension API other VS Code extensions can query for
  the Quarto CLI's path, version, and availability; (2) a long-standing (since v1.39.0, 2022) Lua/Quarto
  Extension authoring surface — `quarto.lua.provideTypes` (auto-provisions Pandoc/Quarto Lua types for
  workspaces with Lua filter scripts) plus an `activationEvents` trigger on
  `workspaceContains:**/_extension.{yml,yaml}` (the manifest file for a Quarto Extension, typically
  implemented via Lua filters/shortcodes).
- *Notes:* Neither maps cleanly to "a document author's feature" the way every other row in this
  document does — the API is for extension developers, and Lua-filter authoring is for a different user
  role (Quarto Extension authors, not `.qmd` document authors). Included for completeness per this
  refresh's own goal of catching "unknown unknowns," not because closing this gap would obviously serve
  this project's stated document-authoring mission.

---

## What This Suggests for Future Work

### Historical priority list (Session 42, tracked through Session 65) — mostly shipped

1. ~~YAML schema diagnostics~~ (red squiggles for invalid front-matter/cell-option keys) — **PARTIALLY
   SHIPPED Sessions 47 + 124 + 125 + 128 + 130** (CHANGELOG: YAML schema diagnostics, Session 47/#43/#46/#47): Session 47 covers
   unknown KEYS in `_quarto.yml`'s `project:`/`website:`/`book:` blocks; Sessions 124/125/128 flag wrong
   enum/boolean *VALUES* of cell options, top-level front-matter keys, and nested `execute:`/`format:`
   keys in `.qmd`; Session 130 adds NUMERIC-typed value validation on all those surfaces; Session 132
   adds values one level under 15 OTHER closed containers (`crossref:`/`listing:`/`mermaid:`/… — Phase 5
   of the value-validation family); Session 135 adds the FIRST slice on the `_quarto.yml` surface —
   wrong closed values one level under `project:`/`website:`/`book:` (`draft-mode`/`downloads`/`sharing`/
   `repo-actions`/`execute-dir`/…); Session 137 extends it one level deeper — wrong closed GRANDCHILD values two
   levels under those blocks (`navbar.collapse-below`/`sidebar.style`/`search.location`/`cookie-consent.type`/
   `project.preview.browser`/…; all SHIPPED); Session 139 corrects numeric-MEMBER enums (`aspectratio`,
   `google-analytics.version`) to validate by COERCED numeric value on both the document and project
   surfaces — removing ≥3 live `aspectratio` false positives (`169.0`/`+169`/`0169`) and restoring
   `version` validation (`version: 5` now flagged, `3.0`≡`3` accepted); Session 147 corrects the NULL ARM on
   every surface — a schema `enum` listing a literal `null` had that member dropped from `values` while the
   field stayed CLOSED, so `auto-play-media: null` (and `~`/`Null`/`NULL`) was flagged though `quarto render`
   exits 0; **3 validated fields** Quarto-wide (a 4th, `output-file`, admits null behind a `ref` but
   resolves OPEN, so it was never validated and never a false positive), 3 live false positives removed;
   Session 148 corrects the KEY/VALUE SEPARATOR on every surface — all three value enumerators split at
   the first colon rather than at YAML's separator (a colon followed by space/tab/end-of-line), so
   `toc:: true`, whose real key is `toc:` and which quarto ACCEPTS on an OPEN key set (exit 0), was read
   as key `toc` with the bogus value `: true` and flagged; **live false positives removed on all FOUR
   value paths** — the `.qmd` top-level and nested paths, the `#|` cell options, and `_quarto.yml`'s
   `execute:`/`format:` containers and DEPTH-2 under `project:`/`website:`/`book:`. Diagnostics-side only — completion still offers values on
   a `key:value` line, where it is a user mid-typing the provider repairs by prepending the space;
   Session 143 adds per-format option VALUE validation under
   `_quarto.yml`'s `format:` → `<fmt>:` blocks (`format:\n  html:\n    toc: banana` etc., all SHIPPED). Only `.ipynb`, the DEEPER `_quarto.yml`-config values
   (depth-3+; the `execute:` half shipped Session 141, the `format:` per-format OPTION values Session 143, the general document-key case at COLUMN 0 Session 149, and the top-level scalar `format:` NAME Session 152), and integer-typed pandoc-layer rejections remain open;
   unknown front-matter/cell KEYS stay intentionally unflagged (open schemas). Built on the existing schema reader (`src/core/yaml-schema.ts`).
2. ~~Snippets~~ — **SHIPPED Session 53** (CHANGELOG: snippets, Session 53): `snippets/quarto.json`, 13 snippets,
   declarative and TDD-gate-exempt, as predicted here. ~~And a **getting-started walkthrough**~~ —
   **SHIPPED Session 51** (CHANGELOG: onboarding walkthrough + scaffolding commands, Sessions 49-51 Track C) — both declarative, TDD-gate-exempt,
   low-effort, as predicted here.
3. ~~Project-level render~~ (`_quarto.yml` discovery + "render whole project") — **SHIPPED Session 45**
   (CHANGELOG: project-level render, Session 45): `quarto.renderProject` discovers the project root and renders it with `cwd`
   pinned to root. "Preview Project" remains a deliberate, unshipped follow-up.
4. ~~A fuller run-cell command family~~ — **SHIPPED Session 52** (CHANGELOG: run-cell command family completion, Session 52): Run Selected
   Line(s), Run Next Cell, Run Previous Cell, and Run Cells Below, plus default keybindings across the
   resulting 9-command family. (Session 67 recount: the family's true size was 10 on Posit's side, not
   9 — see the Run-cell row above.)
5. ~~Graphviz (`{dot}`) diagram rendering~~ — **SHIPPED Session 56** (CHANGELOG: Graphviz dot diagram rendering, Session 56): vendored
   `@viz-js/viz`'s WASM Graphviz build (`media/graphviz/viz-global.js`), a `'wasm-unsafe-eval'` CSP
   addition, and a `dot` render branch calling `Viz.instance().renderString(...)` — at parity with
   Mermaid. First vendored asset whose compiled contents are non-MIT (EPL-2.0 Graphviz core), disclosed
   in `NOTICE` per an explicit operator decision.
6. The **Visual (WYSIWYG) editor** is Posit's single largest feature and this project's single largest
   gap — but it is a major, multi-session undertaking, explicitly out of v1 scope, and would need to be
   built from an MIT-clean editor foundation (never from Posit's AGPL Panmirror). Any future decision to
   pursue it belongs in its own planning session. Still open.

### Session 67 refresh: newly-found real gaps, priority order

The exhaustive manifest/changelog diff (see "Session 67 refresh" note near the top) surfaced 11 new real
gaps with no prior row in this document, plus one severity-changing correction to an existing row
(outline granularity) and one to a "Direct parity" verdict (syntax highlighting breadth + semantic
highlighting). Rough priority order, weighing everyday-authoring impact against apparent implementation
size (sizes are impressions from this refresh's research, not a planning-session estimate — a future
planning session should still verify before implementing):

1. ~~**Code-cell diagnostics forwarding**~~ — **Investigated and closed as not pursued (Option A, Session
   68/69, CHANGELOG: code-cell diagnostics forwarding, closed as not pursued, Session 69).** This item's original framing above ("builds on the existing
   `src/providers/embedded.ts` forwarding infrastructure... a new forwarding kind on the same architecture,
   not a new subsystem") turned out to be **empirically wrong** — diagnostics cannot be served by that
   pull-based forwarding mechanism at all (VS Code API limitation, confirmed three independent ways; see
   the "Code-cell language embedding" row above). Closing this gap the way Posit did requires spawning and
   owning a dedicated external language-server process — a materially heavier architecture and a new class
   of dependency this project has never taken on. The operator decided to accept the gap permanently
   instead, the same treatment as the excluded Visual Editor. Full evidence trail:
   `docs/planning/2026-07-10-code-cell-diagnostics-plan.md`.
2. ~~**Outline granularity**~~ — **SHIPPED, both slices (Sessions 71–74, CHANGELOG: outline granularity, in-cell code symbols + show/hide toggle, Sessions 71-73).**
   In-cell code symbols + a show/hide-cells toggle, built on the existing `DocumentSymbolProvider`
   (`src/providers/outline.ts`), pixel-verified in a live Extension Development Host.
3. ~~**Format Cell**~~ — **SHIPPED (Session 75, CHANGELOG: Format Cell, Session 75).** `quarto.formatCell` delegates a
   code cell's body to the embedded language's installed formatter via a virtual document.
4. **Quick, mostly-declarative wins** (bundle, similar in shape to the Session 51/53 walkthrough/snippets
   work): ~~embedded-grammar breadth~~ — **SHIPPED (Session 76, item 13(a)):** 5→20 scopes.
   ~~standalone `.dot`/`.mmd`/`.typ` language registration~~ — **SHIPPED (Session 77, item 13(b)):** own
   `contributes.languages` entries + `language-configuration.json` (note: the file extension is `.typ`,
   not `.typst` as this row previously said — corrected Session 77, `PROJECT_LEARNINGS.md` Learning #85).
   ~~the 2 residual snippets (`list-table`, `fragment`)~~ — **SHIPPED (Session 77, item 13(c)).**
   ~~cell navigation + cache-clearing commands (`goToNextCell`/`goToPreviousCell`/`clearCache`)~~ —
   **SHIPPED (Session 78, item 13(d)).** ~~the single residual run-cell command (`quarto.runCurrent`)~~ —
   **SHIPPED (Session 78, item 13(e)).** All 5 sub-items of item 13 are now shipped.
5. ~~**`_quarto.yml` document links + filepath autocompletion**~~ — **SHIPPED (Sessions 80–81, item 14)**
   (plan `docs/planning/2026-07-11-quarto-yml-document-links-plan.md`, Session 79). Corrected the framing
   above: this does NOT meaningfully reuse `core/project-yaml.ts`/`core/yaml-context.ts`'s existing
   `project:`/`website:`/`book:` closed-schema scan (that infrastructure covers only 15 of 50
   empirically-confirmed path-typed schema fields; Posit's own shipped PR #906 is itself a
   non-schema-driven, whole-document, existence-checked heuristic, not scoped to those three
   blocks). Shipped as a whole-document heuristic across two vertical-slice sessions: Slice 1
   `DocumentLinkProvider` (Session 80), Slice 2 filepath `CompletionItemProvider` (Session 81).
6. ~~**Preview command family breadth** (`previewScript` for standalone render scripts; `previewFormat` as
   a per-format preview picker).~~ **SHIPPED — Sessions 82 (`previewFormat`), 84 (`previewScript`), 85
   (the `quartoRenderScriptActive` gating layer). Item 15 closed; parity reached.**
7. ~~**Semantic highlighting via the embedded language's LSP**~~ — **DONE (Sessions 86–90, item 16).**
   Planned Session 86; shipped across three slices (88: single-language `{python}`; 89: the multi-language
   merge; 90: theming / the D4 legend decision). It did warrant its own planning session, as predicted.
   The theming slice's finding is worth carrying forward: the *obvious* answer — carry the embedded
   server's foreign token names to "recover" the tokens a standard legend drops — is a **regression**,
   because a `.qmd` code cell is already coloured by its embedded TextMate grammar, so the semantic layer
   overrides a mostly-correct incumbent rather than filling a void. See `PROJECT_LEARNINGS.md` #99/#100.
8. **Lower priority / narrower audience**: cell-execution background highlighting (cosmetic only);
   Reticulate (R↔Python via Knitr engine) execution pathway (narrow audience — mixed R/Python Knitr
   documents); the create-project-family discoverability gap (`newPresentation`/`newNotebook`/
   `fileNewDocument` — `quarto.newDocument` already covers the underlying capability); the notebook
   markdown-cell Quarto-aware renderer (niche — only matters when editing `.ipynb` markdown cells
   directly with Quarto-flavored syntax).

**Not proposed as gaps to close:** the three rows in the new "Soft / ambiguous comparison" bucket
(nested/deep YAML completion depth, project-wide/multi-file cross-ref intelligence, and the
developer-facing extensibility surfaces) are included for this refresh's own completeness goal, not
because they cleanly fit this project's document-authoring mission the way every other row does — a
future session should treat them as "worth knowing about," not automatically rank them into
`BACKLOG.md`.

This document does not itself change `BACKLOG.md` — see that file for the project's actual prioritized
work list; the items above are this research's suggestions for what to feed into it. (Session 67 did
also add corresponding `BACKLOG.md` entries for the newly-found real gaps, in the same priority order —
see that file's "Post-Posit-comparison feature roadmap" section.)
