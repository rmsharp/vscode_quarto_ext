# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 2 (`.qmd` highlighting)** of `docs/planning/2026-06-27-extension-architecture-plan.md` §6 — `contributes.languages` (`.qmd`/`.rmd` → `quarto`) + `syntaxes/quarto.tmLanguage.json` (forked from MIT base, extended with YAML front-matter injection + brace-identifier `{lang}` cell injections) + `language-configuration.json` + `test/fixtures/sample.qmd`. **Base grammar deferred to this phase — default `wooorm/markdown-tm-language` (richer front-matter/math); evaluate against `microsoft/vscode-markdown-tm-grammar`.** 🐉 brace-wrapped `{python}` cells need a custom injection; wrap embedded regions in `meta.embedded.*` to avoid the string/comment trap. One session, then close out (FM #18).

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] Phase 3 — `Quarto: Render` (shell `quarto render`, Output channel, graceful degradation).
- [ ] Phase 4 — `Quarto: Preview` (live webview; parse `Browse at <url>`; own the process lifecycle).
- [ ] Phase 5 — Run-cell family (delegate to Jupyter/Python/R).
- [ ] Phase 6a–6c — Editor intelligence (Tier B): document outline → cross-ref completion → citation completion. **(v1 ships here.)**
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)
