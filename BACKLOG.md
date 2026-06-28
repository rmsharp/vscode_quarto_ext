# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **v1 release prep** — **v1 is feature-complete** (Phases 1–5 + 6a–6c). A packaging / README / marketplace-metadata pass to ship the `.vsix`.
  - [x] **Item 1 — git remote + packaging metadata (Session 10):** `origin` wired (`rmsharp/vscode_quarto_ext`, default branch `master`), `repository` added to `package.json`, `--allow-missing-repository` dropped from the `package` script, README relative-link restriction lifted. (Learnings #5/#17.)
  - [ ] **Item 2 — marketplace metadata:** a real `publisher` id (current `vscode-quarto-ext` is a placeholder), an `icon`, `keywords`, `bugs`/`homepage`, polished `displayName`/`description`; a listing `README.md` (its status line is now STALE — claims editor intelligence is "still to come", but outline + cross-ref + citation completion all shipped). Relative links now work.
  - [ ] **Item 3 — F5 visual pass:** screenshots/GIFs for the README (the standing residue: popups/outline/preview/keybindings are integration-proven but never eyeballed — no `code` CLI).
  - [ ] **`npm audit` posture decision** (7 dev-only vulns, none ship — document as accepted, or bump if clean).
  - Mostly non-code (FM #18: one deliverable per session; don't also do the deferred polish). See plan §7 (v1 DoD).

## Up Next

- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)

## Polish / deferred

- [ ] **Indented (4-space) code blocks as a skip-region** (deferred from Phase 6b adversarial review). `core/qmd/model.ts` `scanRegions` skips YAML front matter, HTML comments, and *fenced* code, but not CommonMark §4.4 *indented* code blocks (a line indented ≥4 spaces after a blank line). So `findBodyLines` emits them and `core/refs.ts` indexes a `{#fig-…}` shown inside one as a **phantom** cross-ref label (verified against `quarto render` → `?@fig-…` unresolved). The faithful fix must not false-skip 4-space **list-item continuation** content (the model tracks no list context), so it needs its own list-aware TDD pass. Low severity (uncommon construct). (Adversarial review B/D, Session 8.)
- [ ] **Setext headings in the outline** (deferred from Phase 6a). `core/qmd/model.ts` recognizes only ATX (`#`) headings; a line underlined with `===` (h1) or `---` (h2) is not detected, so such a section vanishes from the Outline view and its content mis-nests under the previous heading. Pandoc/Quarto and VS Code's built-in markdown outline both support setext. Needs careful `---` disambiguation (setext underline vs thematic break vs the front-matter fence) and its own TDD pass. Minority style in Quarto (ATX dominates), hence deferred. (Adversarial review #7, Session 7.)
