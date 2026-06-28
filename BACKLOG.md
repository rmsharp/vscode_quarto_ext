# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 5 (`Quarto: Run Cell` family)** of `docs/planning/2026-06-27-extension-architecture-plan.md` §6 — `Quarto: Run Cell` (+ Run Above / Run All / advance / insert-cell): detect the active cell's boundaries and **delegate** execution to the installed Jupyter/Python/R extension (e.g. `jupyter.execSelectionInteractive`), with a clear "install the Python/Jupyter extension" message when none is present (no crash). Keep cell-boundary detection a **pure `core/` function** (mirrors Phase 4's `core/` split). 🐉 External command-ID contracts (feature-detect them) + the CLI-needs-Jupyter vs delegated-path-needs-kernel distinction (Learning #4/#9); handle nested fences and the non-executable `{{python}}` display form. One session, then close out (FM #18). **Reminder: strict TDD is mandatory (CLAUDE.md §Mandatory development practice / Learning #10).**

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] Phase 6a–6c — Editor intelligence (Tier B): document outline → cross-ref completion → citation completion. **(v1 ships here.)** 6a establishes the shared `core/qmd/model.ts` region parser (and can retro-fit Phase 5's cell finder).
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)
