# Backlog

*Open, actionable work items only. Completed work → `CHANGELOG.md`. Feature inventory & plans → `ROADMAP.md`.*

## Active

- [ ] **v1 release prep** — **v1 is feature-complete** (Phases 1–5 + 6a–6c). A packaging / README / marketplace-metadata pass to ship the `.vsix`.
  - [x] **Item 1 — git remote + packaging metadata (Session 10):** `origin` wired (`rmsharp/vscode_quarto_ext`, default branch `master`), `repository` added to `package.json`, `--allow-missing-repository` dropped from the `package` script, README relative-link restriction lifted. (Learnings #5/#17.)
  - [x] **Item 2 — marketplace metadata + README (Session 11):** `publisher` → `rmsharp`; original `icon` (`media/icon.png`); `keywords`/`bugs`/`homepage`/`galleryBanner`/`preview`; polished `description`; `categories` Programming Languages + Data Science. `README.md` rewritten for the Marketplace (stale status line fixed; drafted via a judge-panel + accuracy-critic workflow). Caught + fixed the publisher→extension-ID coupling that broke 8 integration suites (Learning #18). Clean 10-file `.vsix`; 190 unit + 42 integration green.
  - [x] **Item 3 — F5 visual pass + screenshots (Session 12):** captured 5 faithful screenshots (highlighting, outline, `@` completion, live preview, render) in an Extension Development Host isolated with `--disable-extensions` (the user has Posit's `quarto.quarto` installed, which otherwise merges with ours), and wired them into the README `## Screenshots` gallery. Screenshots excluded from the `.vsix` (`.vscodeignore media/screenshots/**`); vsce rewrites the relative paths to repo raw URLs. This also closes the "F5-only visual residue" every prior phase carried. (Learning #19.)
  - [ ] **`npm audit` posture decision** (7 dev-only vulns, none ship — document as accepted, or bump if clean). **← the only release-prep item left before publish.**
  - **Operator step (not an agent task):** actual `vsce publish` needs a registered Marketplace publisher `rmsharp` + a PAT; `preview: true` is set — flip when the listing is deemed stable.
  - Mostly non-code (FM #18: one deliverable per session; don't also do the deferred polish). See plan §7 (v1 DoD).

## Up Next

- [ ] Phase 6d/6e, 7 — YAML/cell-option + embedded-cell completion + authoring aids. (v2)

## Polish / deferred

- [ ] **De-duplicate the integration `EXTENSION_ID` constant** (surfaced Session 11). `const EXTENSION_ID = "rmsharp.vscode-quarto-ext"` is copy-pasted into all 8 `test/integration/suite/*.test.ts` files. When the `publisher` changed this session, every copy went stale at once and RED'd 8 "should be discoverable" failures. Extract to one shared module (ideally derived from `package.json`'s `publisher`+`name`) so an identity change can't silently break discoverability again. Low risk, pure test refactor — its own TDD-exempt pass. (Learning #18.)
- [ ] **Indented (4-space) code blocks as a skip-region** (deferred from Phase 6b adversarial review). `core/qmd/model.ts` `scanRegions` skips YAML front matter, HTML comments, and *fenced* code, but not CommonMark §4.4 *indented* code blocks (a line indented ≥4 spaces after a blank line). So `findBodyLines` emits them and `core/refs.ts` indexes a `{#fig-…}` shown inside one as a **phantom** cross-ref label (verified against `quarto render` → `?@fig-…` unresolved). The faithful fix must not false-skip 4-space **list-item continuation** content (the model tracks no list context), so it needs its own list-aware TDD pass. Low severity (uncommon construct). (Adversarial review B/D, Session 8.)
- [ ] **Setext headings in the outline** (deferred from Phase 6a). `core/qmd/model.ts` recognizes only ATX (`#`) headings; a line underlined with `===` (h1) or `---` (h2) is not detected, so such a section vanishes from the Outline view and its content mis-nests under the previous heading. Pandoc/Quarto and VS Code's built-in markdown outline both support setext. Needs careful `---` disambiguation (setext underline vs thematic break vs the front-matter fence) and its own TDD pass. Minority style in Quarto (ATX dominates), hence deferred. (Adversarial review #7, Session 7.)
