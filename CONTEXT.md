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

- **Decision:** Language support strategy (TextMate grammar only vs. full Language Server) — **Status:** under-review — **Where:** TBD (first planning session).

---

## Common Pitfalls

*To be populated as sessions discover them.*

- **Pitfall:** Assuming `quarto` is on `PATH` for every user — **Why it happens:** dev machine has it globally — **Recovery:** resolve the binary via a configurable setting and validate at activation.

---

## Maintenance

At close-out, propose any new domain term, constraint, or pitfall discovered during the session, and either add it inline or leave a note for the next session.
