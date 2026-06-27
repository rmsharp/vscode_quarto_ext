# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 3 (`Quarto: Render`)** of `docs/planning/2026-06-27-extension-architecture-plan.md` §6 — `src/features/render.ts` shells `quarto render <active.qmd>`, streams stdout/stderr to a dedicated Output channel, and surfaces success (output path) or failure (stderr verbatim) — degrading gracefully when the CLI or a render dependency (Jupyter) is missing. Reuse `src/quarto/cli.ts` (`resolveBinary()`). Keep the arg-construction a **pure `core/` function** so it's unit-tested without spawning. 🐉 minor (thin CLI wrapper). DONE: prose `.qmd` → `*.html` + path shown; `{python}` doc with no Jupyter → the `nbformat` error surfaced verbatim, not a crash. One session, then close out (FM #18).

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] Phase 4 — `Quarto: Preview` (live webview; parse `Browse at <url>`; own the process lifecycle).
- [ ] Phase 5 — Run-cell family (delegate to Jupyter/Python/R).
- [ ] Phase 6a–6c — Editor intelligence (Tier B): document outline → cross-ref completion → citation completion. **(v1 ships here.)**
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)
