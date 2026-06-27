# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 1 (walking skeleton)** of `docs/planning/2026-06-27-extension-architecture-plan.md` — scaffold (TypeScript + esbuild + `package.json` + MIT `LICENSE`) + `Quarto: Verify Installation` command + `quarto/cli.ts` resolution infra + `core/`-vs-adapter boundary + test harness. **Gated on operator ratification of plan §12.** One session, then close out (FM #18).

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] Phase 2 — `.qmd` language contribution: file association + TextMate grammar (highlighting of prose, YAML front matter, `{lang}` cells) + `language-configuration.json`.
- [ ] Phase 3 — `Quarto: Render` (shell `quarto render`, Output channel, graceful degradation).
- [ ] Phase 4 — `Quarto: Preview` (live webview; parse `Browse at <url>`; own the process lifecycle).
- [ ] Phase 5 — Run-cell family (delegate to Jupyter/Python/R).
- [ ] Phase 6a–6c — Editor intelligence (Tier B): document outline → cross-ref completion → citation completion. **(v1 ships here.)**
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)
