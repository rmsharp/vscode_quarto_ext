# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

When completing work, remove the item from `BACKLOG.md` and add an entry here.

## [Unreleased]

<!-- Add entries here as work is completed. Group by month when the list grows. -->

### 2026-06-27
- **Phase 1 — walking skeleton** — Scaffolded the extension (TypeScript + esbuild + `@vscode/vsce`, `engines.vscode ^1.90.0`, MIT `LICENSE`) with the `core/`-vs-adapter boundary in place (`src/core/version.ts` is pure/`vscode`-free; `src/quarto/cli.ts` is the CLI adapter; `src/extension.ts` is thin). Shipped the `Quarto: Verify Installation` command (resolves `quarto.path`→PATH, reports version or actionable error). Test harness: 12 vitest unit tests + 2 `@vscode/test-electron` integration tests (activation + end-to-end command execution against the real CLI). **Confirmed test-electron downloads + runs VS Code headlessly here** (resolves plan §14's load-bearing assumption). `npm run package` produces a clean 6-file `.vsix`. Operator ratified plan §12 (v1 scope, Tier B, stack, engine ^1.90.0; base grammar deferred to Phase 2). (Session 2)
- **Architecture & implementation plan** — Produced `docs/planning/2026-06-27-extension-architecture-plan.md`: resolved the TextMate-vs-LSP decision (Tier A grammar → Tier B in-process providers → defer Tier C LSP; `vscode`-free core guardrail), confirmed Posit's extension is AGPL-3.0 (build on MIT upstreams instead), inventoried features, and laid out 7 vertical-slice phases with DONE gates and verification commands. Draft pending operator ratification (plan §12). (Session 1)
- **Project bootstrap** — Initialized git and installed the Iterative Session Methodology (KJ5HST/methodology v3.0, committed mode) via upstream `bin/sync`. Created `CLAUDE.md`, `CONTEXT.md`, `BACKLOG.md`, `.gitignore`; generated the health dashboard. Project goal: MIT-licensed VS Code extension replicating Posit's Quarto extension features. (Session 0)
