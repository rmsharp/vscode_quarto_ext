# Roadmap

## Current Milestone
**v1 — the core authoring loop.** An installable, MIT-licensed `.vsix` that: highlights `.qmd`, renders, live-previews, runs code cells, and completes cross-references + citations — degrading gracefully when the Quarto CLI or a kernel is absent. Defined in `docs/planning/2026-06-27-extension-architecture-plan.md` §7. Architecture: TextMate grammar (Tier A) + in-process providers (Tier B), shelling out to the Quarto CLI. Visual editor / Zotero / Assist / project-wide indexing are out of v1.

## Planned
<!-- The active task list is in BACKLOG.md. This is the higher-level shape. -->
- **v1 phases (vertical slices, one session each):** 1 scaffold → 2 grammar → 3 render → 4 preview → 5 run-cell → 6a outline → 6b cross-ref completion → 6c citation completion. See the plan for per-phase DONE gates, verification commands, and "here be dragons" flags.
- **v2 (deferred):** YAML/cell-option completion (needs Quarto's YAML schema), embedded-cell language completion (virtual-document forwarding), authoring aids (snippets, math/diagram preview, formatting toggles), project/convert/walkthrough commands.
- **Tier C (deferred until a driver appears):** out-of-process LSP for cross-file project indexing or multi-editor reuse — cheap to reach because the intelligence core is kept `vscode`-free.

## What's Built
- **Phase 2 — `.qmd` highlighting (Session 3).** `.qmd`/`.rmd` register as the `quarto` language; an original `text.html.quarto` grammar highlights prose (via the built-in markdown grammar by reference), YAML front matter, and `{python}/{r}/{julia}/{ojs}` cells, with bracket/comment/folding config. Verified headlessly via `vscode-textmate` tokenization + a real-host registration test. Phases 3–6c remain.
- **Phase 1 — walking skeleton (Session 2).** Installable `.vsix` builds from a TypeScript/esbuild scaffold; the `core/`-vs-adapter boundary is established (`vscode`-free `core/`); the `Quarto: Verify Installation` command resolves the CLI and reports its version; unit (vitest) + integration (`@vscode/test-electron`) test harnesses both run green headlessly.

## Completed Milestones
- **Methodology bootstrap** (Session 0) — installed the Iterative Session Methodology and instantiated project docs.
- **Architecture planning** (Session 1) — resolved the load-bearing language-support decision and produced the phased implementation plan.
- **Phase 1 walking skeleton** (Session 2) — scaffold + `Quarto: Verify Installation` + test harness; confirmed headless integration testing works.
- **Phase 2 `.qmd` highlighting** (Session 3) — language registration + TextMate grammar + config; resolved the base-grammar decision (include-by-reference, no fork); added headless grammar tokenization tests.
