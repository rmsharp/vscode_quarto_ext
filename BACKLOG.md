# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 4 (`Quarto: Preview`)** of `docs/planning/2026-06-27-extension-architecture-plan.md` §6 — spawn `quarto preview <file> --no-browser`, parse the `Browse at http://localhost:<port>/` stderr line (keep the parser a **pure `core/` function**, like `parseOutputPath`), embed the URL in a webview beside the editor, reload on save, and **kill the preview process on panel close / doc close / deactivate** (no orphans). Reuse `src/quarto/cli.ts` + the `core/`-vs-adapter split. 🐉 LARGE (process lifecycle + webview CSP — the plan's biggest single phase). One session, then close out (FM #18).

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] Phase 5 — Run-cell family (delegate to Jupyter/Python/R).
- [ ] Phase 6a–6c — Editor intelligence (Tier B): document outline → cross-ref completion → citation completion. **(v1 ships here.)**
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)
