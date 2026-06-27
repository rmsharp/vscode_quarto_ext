# CONTEXT.md — vscode-quarto-ext

**This file is the project's shared vocabulary and load-bearing context.** Agents read it during Research before exploring code. Contributors maintain it as they work.

---

## What This Project Is

`vscode-quarto-ext` is an MIT-licensed Visual Studio Code extension that brings Quarto authoring features to VS Code: rendering and live preview of `.qmd` documents, syntax highlighting, code-cell execution, and editor intelligence (completions for YAML front matter, citations, and cross-references). It is an *independent reimplementation* targeting feature parity with Posit's official Quarto extension — not a fork of it. The extension shells out to the locally-installed **Quarto CLI** for rendering and preview rather than reimplementing the Quarto engine.

---

## Domain Vocabulary

Project-specific / Quarto-specific terms a new reader needs. General industry terms are omitted.

| Term | Meaning in this project | Notes |
|------|------------------------|-------|
| `.qmd` | Quarto Markdown document — Pandoc-flavored Markdown with a YAML header and executable code cells. | The extension's primary language/file type. |
| Code cell / chunk | A fenced ` ```{lang} ` block (e.g. `{python}`, `{r}`, `{julia}`, `{ojs}`) executed during render. | Distinct from a plain fenced code block. |
| YAML front matter | The `---`-delimited metadata block at the top of a `.qmd` (and per-cell `#| key: value` options). | Completion target. |
| `quarto preview` | Quarto CLI mode that renders and serves a document with live reload over a local HTTP server. | The extension embeds this server's URL in a webview. |
| `quarto render` | Quarto CLI mode that produces a static output (HTML/PDF/docx). | The non-live build path. |
| Cross-reference | `@fig-…`, `@tbl-…`, `@sec-…`, `@eq-…` reference to a labeled element. | Completion + navigation target. |
| Citation | `@citekey` resolved against a bibliography (`.bib`/CSL-JSON). | Completion target. |

**Adding a term:** when a session encounters a project-specific name during research that would have helped to know up front, propose an entry here at close-out.

---

## Load-Bearing Constraints

- **MIT licensing boundary** — the deliverable must be MIT-licensed. Features are reimplemented independently; do **not** copy source from any extension whose license is incompatible with MIT redistribution. Before borrowing any third-party code, verify license compatibility and record it here.
- **Quarto CLI is a runtime dependency** — rendering/preview shell out to `quarto`. The extension must degrade gracefully (clear error, not a crash) when `quarto` is absent or too old.
- **VS Code API surface** — features must map onto documented `vscode.*` extension APIs (commands, language features, webviews, tasks); avoid undocumented internals.

---

## Architecture Decision Pointers

*To be populated by the first planning session. Detailed ADRs (if adopted) go under `docs/adr/`.*

- **Decision:** Language support strategy (TextMate grammar only vs. full Language Server) — **Status:** RESOLVED (Session 1, awaiting operator ratification) → ship **Tier A** (TextMate grammar) + build to **Tier B** (in-process `register*Provider`s); **defer Tier C** (out-of-process LSP). Guardrail: `vscode`-free intelligence core. — **Where:** `docs/planning/2026-06-27-extension-architecture-plan.md` §3.
- **Decision:** Reuse boundary under the MIT mandate — **Status:** RESOLVED (Session 1) → Posit's official extension/LSP/visual-editor are **AGPL-3.0** (look-but-don't-copy); build on MIT `vscode-markdown-tm-grammar` / `markdown-tm-language` / `vscode-markdown-languageservice` and the MIT Quarto CLI. — **Where:** plan §2.4.
- **Decision:** Base grammar for `.qmd` highlighting — **Status:** RESOLVED (Session 3, Phase 2) → do **not** fork either MIT base; author an original `text.html.quarto` grammar that `include`s VS Code's built-in `text.html.markdown` **by reference** and adds Quarto front-matter + brace-cell rules. — **Where:** `syntaxes/quarto.tmLanguage.json`, `/NOTICE`, `CLAUDE.md` Learning #6.

---

## Common Pitfalls

*To be populated as sessions discover them.*

- **Pitfall:** Assuming `quarto` is on `PATH` for every user — **Why it happens:** dev machine has it globally — **Recovery:** resolve the binary via a configurable setting and validate at activation.
- **Pitfall:** Relying on `quarto preview --timeout` to clean up the preview server — **Why it happens:** the flag *sounds* like an idle-exit, but it only exits on **no active clients**; with a webview attached it keeps running — **Recovery:** the extension owns the child-process lifecycle and kills it on panel dispose / document close / deactivate (verified Session 1).
- **Pitfall:** Assuming code cells "just run" — **Why it happens:** they render fine as prose — **Recovery:** CLI render of code cells needs **Jupyter** (`nbformat`) in the active Python env; the delegated run-cell path needs the user's kernel/extension. Surface the real error; degrade gracefully (verified Session 1).
- **Pitfall:** Treating "build clean" as runtime-verified for the extension — **Why it happens:** `npm run compile` passes — **Recovery:** there is **no `code` CLI on PATH** here; runtime checks are a manual **F5**; keep logic in the `vscode`-free `core/` so it's unit-testable headlessly. For grammars, the scope assignment IS automatable headlessly via `vscode-textmate` + `vscode-oniguruma` (`test/unit/tokenize.test.ts`) — only theme COLOR needs F5.
- **Pitfall:** Testing a grammar with `vscode-textmate` and returning `null` from `loadGrammar` for unresolved external includes (`text.html.markdown`, `source.*`) — **Why it happens:** the standalone test registry has only your grammar, so null seems natural — **Recovery:** return an **empty stub grammar** `{ scopeName, patterns: [] }` instead; null silently corrupts pattern compilation so sibling rules stop matching (cost most of Phase 2's debugging — `CLAUDE.md` Learning #7).

---

## Maintenance

At close-out, propose any new domain term, constraint, or pitfall discovered during the session, and either add it inline or leave a note for the next session.
