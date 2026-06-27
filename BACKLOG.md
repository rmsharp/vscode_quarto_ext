# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Planning session** — Research Posit's Quarto VS Code extension feature set, inventory candidate features, and produce a phased architecture + implementation plan in `docs/planning/`. (Deliverable = the plan document, not code. Follow `ARCHITECTURE_WORKSTREAM.md`.)

## Up Next

- [ ] Scaffold the extension skeleton (TypeScript + esbuild + `package.json` contribution points + MIT `LICENSE`) — first implementation slice, gated on the plan above.
- [ ] `.qmd` language contribution: file association + TextMate grammar (syntax highlighting).
- [ ] Commands: `Quarto: Render` and `Quarto: Preview` (shell out to the Quarto CLI, embed preview in a webview).
