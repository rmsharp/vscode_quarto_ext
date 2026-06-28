# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 6b (Cross-reference completion + go-to-definition)** of `docs/planning/2026-06-27-extension-architecture-plan.md` §6 — index `@fig-/@tbl-/@sec-/@eq-` labels in the open `.qmd`; a `CompletionItemProvider` on `@` lists them and a `DefinitionProvider` jumps to the label. **Build on the Phase 6a region model** (`core/qmd/model.ts` `scanRegions`/`findHeadings` — do NOT write a third scanner; consume the shared one). Section ids come from the Pandoc `{#sec-id}` heading attribute — Phase 6a strips it from the outline display name but does NOT yet store it structurally, so **add an `id`/attrs field to `Heading`** (or a labels index) as the first step. Keep logic pure `core/` (§3.3, likely `core/refs.ts`); add a `providers/` adapter. Verify: unit-test the indexer headlessly + a `@vscode/test-electron` test via `vscode.executeCompletionItemProvider` / `executeDefinitionProvider`. One session, then close out (FM #18). **Strict TDD is mandatory (CLAUDE.md §Mandatory development practice / Learnings #10, #14).**

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] Phase 6c — Citation completion (`@key` from `.bib`/CSL-JSON). **(v1 ships here.)**
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)

## Polish / deferred

- [ ] **Setext headings in the outline** (deferred from Phase 6a). `core/qmd/model.ts` recognizes only ATX (`#`) headings; a line underlined with `===` (h1) or `---` (h2) is not detected, so such a section vanishes from the Outline view and its content mis-nests under the previous heading. Pandoc/Quarto and VS Code's built-in markdown outline both support setext. Needs careful `---` disambiguation (setext underline vs thematic break vs the front-matter fence) and its own TDD pass. Minority style in Quarto (ATX dominates), hence deferred. (Adversarial review #7, Session 7.)
