# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 6a (Document outline / symbols)** of `docs/planning/2026-06-27-extension-architecture-plan.md` §6 — a `DocumentSymbolProvider` over a `.qmd` region model (headings + cells) so the Outline view and breadcrumbs populate. **This phase establishes the shared `core/qmd/model.ts` region parser** that 6b–6e consume, and it can **retro-fit/subsume Phase 5's `core/cells.ts`** cell finder (the cell-finding logic is already pure + tested — fold it into the richer model, don't duplicate). Keep the model pure `core/` (§3.3); add a `providers/` adapter wrapping it in `vscode.languages.registerDocumentSymbolProvider`. Verify: unit-test the parser headlessly + a `@vscode/test-electron` test asserting symbols populate for `sample.qmd`. One session, then close out (FM #18). **Reminder: strict TDD is mandatory (CLAUDE.md §Mandatory development practice / Learning #10).**

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] Phase 6b — Cross-reference completion + go-to-definition (`@fig-/@tbl-/@sec-/@eq-`), over the 6a region model.
- [ ] Phase 6c — Citation completion (`@key` from `.bib`/CSL-JSON). **(v1 ships here.)**
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)
