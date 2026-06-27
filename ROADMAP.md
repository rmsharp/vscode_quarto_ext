# Roadmap

## Current Milestone
**v1 — the core authoring loop.** An installable, MIT-licensed `.vsix` that: highlights `.qmd`, renders, live-previews, runs code cells, and completes cross-references + citations — degrading gracefully when the Quarto CLI or a kernel is absent. Defined in `docs/planning/2026-06-27-extension-architecture-plan.md` §7. Architecture: TextMate grammar (Tier A) + in-process providers (Tier B), shelling out to the Quarto CLI. Visual editor / Zotero / Assist / project-wide indexing are out of v1.

## Planned
<!-- The active task list is in BACKLOG.md. This is the higher-level shape. -->
- **v1 phases (vertical slices, one session each):** 1 scaffold → 2 grammar → 3 render → 4 preview → 5 run-cell → 6a outline → 6b cross-ref completion → 6c citation completion. See the plan for per-phase DONE gates, verification commands, and "here be dragons" flags.
- **v2 (deferred):** YAML/cell-option completion (needs Quarto's YAML schema), embedded-cell language completion (virtual-document forwarding), authoring aids (snippets, math/diagram preview, formatting toggles), project/convert/walkthrough commands.
- **Tier C (deferred until a driver appears):** out-of-process LSP for cross-file project indexing or multi-editor reuse — cheap to reach because the intelligence core is kept `vscode`-free.

## What's Built
*Nothing shipped yet — pre-scaffold.* The repo holds the methodology harness and the architecture plan; no extension code exists until Phase 1.

## Completed Milestones
- **Methodology bootstrap** (Session 0) — installed the Iterative Session Methodology and instantiated project docs.
- **Architecture planning** (Session 1) — resolved the load-bearing language-support decision and produced the phased implementation plan.
