# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **Implement Phase 6c (Citation completion)** of `docs/planning/2026-06-27-extension-architecture-plan.md` §6 — parse the `.bib`/CSL-JSON named in the YAML `bibliography:` key → citekeys; complete a bare `@key` on the `@` trigger (with title/author detail). **This is the last v1 phase — v1 ships when 6c is done.** Build on Phase 6b: reuse `core/refs.ts` `crossrefCompletionContext` + `isReferenceableLine`; mirror `src/providers/crossref.ts`. New pure pieces: read the `bibliography:` value from front matter (the region model skips front matter — needs a small reader; no YAML lib in the project, decide up front) + a `.bib`/CSL-JSON parser (`core/citations.ts`). Adapter `providers/citation.ts` reads the file (fs) relative to the doc and offers citekeys; 6b + 6c completion providers coexist on `@` (editor merges/filters). Verify: unit-test the bib parser + a `@vscode/test-electron` test via `vscode.executeCompletionItemProvider`; render-clean fixtures need doc-level `execute: enabled: false` (Learning #15). One session, then close out (FM #18). **Strict TDD is mandatory (CLAUDE.md §Mandatory development practice / Learnings #10, #14, #15).**

## Up Next

*(Phases from the plan — implement one per session, in order. See the plan for DONE gates + verification.)*

- [ ] **v1 release prep** (after 6c — v1 is then feature-complete: Phases 1–5 + 6a–6c). Packaging/README/marketplace metadata pass; add a git remote (drop `--allow-missing-repository`, add `repository` to `package.json`, lift the README relative-link restriction — Learning #5).
- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)

## Polish / deferred

- [ ] **Indented (4-space) code blocks as a skip-region** (deferred from Phase 6b adversarial review). `core/qmd/model.ts` `scanRegions` skips YAML front matter, HTML comments, and *fenced* code, but not CommonMark §4.4 *indented* code blocks (a line indented ≥4 spaces after a blank line). So `findBodyLines` emits them and `core/refs.ts` indexes a `{#fig-…}` shown inside one as a **phantom** cross-ref label (verified against `quarto render` → `?@fig-…` unresolved). The faithful fix must not false-skip 4-space **list-item continuation** content (the model tracks no list context), so it needs its own list-aware TDD pass. Low severity (uncommon construct). (Adversarial review B/D, Session 8.)
- [ ] **Setext headings in the outline** (deferred from Phase 6a). `core/qmd/model.ts` recognizes only ATX (`#`) headings; a line underlined with `===` (h1) or `---` (h2) is not detected, so such a section vanishes from the Outline view and its content mis-nests under the previous heading. Pandoc/Quarto and VS Code's built-in markdown outline both support setext. Needs careful `---` disambiguation (setext underline vs thematic break vs the front-matter fence) and its own TDD pass. Minority style in Quarto (ATX dominates), hence deferred. (Adversarial review #7, Session 7.)
