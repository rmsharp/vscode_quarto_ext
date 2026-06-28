# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

---

## ACTIVE TASK
**Task:** Implement **Phase 6b** of the architecture plan — Cross-reference completion + go-to-definition: index `@fig-/@tbl-/@sec-/@eq-` labels in the open `.qmd`, a `CompletionItemProvider` on `@` to list them, and a `DefinitionProvider` to jump from a `@ref` to its label. **Build on the Phase 6a region model** (`core/qmd/model.ts`) — do NOT write a third scanner.
**Status:** NOT STARTED. Phases 1 (skeleton) + 2 (highlighting) + 3 (render) + 4 (preview) + 5 (run-cell) + 6a (outline/symbols) are **COMPLETE + verified** (Sessions 2–7). The plan is ratified.
**Plan:** `docs/planning/2026-06-27-extension-architecture-plan.md` §6 "Phase 6b" (line ~323) → implement **Phase 6b ONLY**, then close out (FM #18: do not bundle 6c citation).
**Priority:** HIGH
**⚠ STRICT TDD IS MANDATORY** (operator directive — `CLAUDE.md` §"Mandatory development practice" + Learnings #10, #14). Invoke `/tdd`; write the failing test before the code; red → green → refactor, one behavior at a time. Lead with the failing test (Sessions 5–7 confirm this is the expectation).

### What You Must Do
This is an **implementation** session (Development workstream). Deliverable: in a `.qmd`, typing `@fig-` lists the figure labels defined in the doc, and go-to-definition on a `@ref` jumps to where the label is defined.
1. Read plan §6 Phase 6b (line ~323) + §3.3 (the pure-core guardrail). Read `src/core/qmd/model.ts` IN FULL — you are extending it.
2. **Where labels come from — two sources:**
   - **Section ids** from the Pandoc heading-attribute block `{#sec-id}`. **Phase 6a strips this from the outline display name but does NOT store it structurally yet** (see `parseHeadingLine` / `ATX_ATTRIBUTE` in `model.ts`). **First step: add an `id`/attrs field to the `Heading` interface** and capture it in `parseHeadingLine` (TDD it), so 6b consumes the parsed id instead of re-parsing the name. The matching test to update: `test/unit/qmd-model.test.ts` "Pandoc/Quarto heading attributes".
   - **`#| label: fig-foo` / `#| label: tbl-bar` cell options** inside `{python}/{r}` cells (figures/tables produced by code), and `{#fig-... }`/`{#tbl-...}` on fenced divs/images. Scan cell bodies (you have `findAllCells` → `cell.code`) for the `label:` option.
3. **Build a pure `core/refs.ts`** (`vscode`-free, §3.3) that indexes labels (id, kind fig/tbl/sec/eq, defining line) by consuming `scanRegions`/`findHeadings`/`findAllCells` from `model.ts` — **do NOT write a third line scanner** (Learning #14: parsers that overlap must agree on skip-regions; reuse the shared one). TDD headlessly; add a fixture or extend `sample.qmd`.
4. **Adapter** `providers/crossref.ts` + `registerCrossrefProviders(context)`: a `CompletionItemProvider` (trigger char `@`) and a `DefinitionProvider`, both for `{ language: "quarto" }`, wrapping `core/refs.ts`. Wire in `src/extension.ts` `activate()` after `registerOutlineProvider(context)` (`:26`).
5. Verify (TDD throughout): `npm run compile` · `npm test` (the indexer — the bulk) · `npm run test:integration` via `vscode.executeCompletionItemProvider` / `vscode.executeDefinitionProvider` (env-independent, faithful — the strongest verification; mirror `test/integration/suite/outline.test.ts`). F5 only for the completion popup's visual feel.
6. Close out after Phase 6b. Do NOT start 6c (FM #2, FM #18).

### Useful starting context
- **Phases 1–6a are done — reuse them.** `core/`-vs-adapter boundary + both harnesses established, all green: **111 unit + 25 integration**, clean 9-file `.vsix`.
- **`core/qmd/model.ts` is the shared region model (Learning #14) — consume it, don't duplicate it.** `scanRegions(text)` → `{headings, cells}` is the single line-classifying pass (front matter, HTML comments, fences, ATX headings); `findHeadings`/`findAllCells`/`findCellAtPosition`/`buildOutline` are thin views. `core/cells.ts` is a re-export shim (Phase 5 still imports it). The 17 cell tests + 38 model tests are your regression net.
- **The `{#sec-id}` id is already PARSED-AND-DISCARDED** in `parseHeadingLine` (it strips `ATX_ATTRIBUTE` from the display text). 6b's first job is to *keep* it. This is flagged in the BACKLOG "Active" item.
- **Provider-via-`execute*Provider` is the faithful test** (Learnings #3/#9/#14): `vscode.executeCompletionItemProvider(uri, position, "@")` and `vscode.executeDefinitionProvider(uri, position)` run in the real downloaded host with no CLI/Jupyter. `test/integration/suite/outline.test.ts` is the template.
- **`microsoft/vscode-markdown-languageservice` (MIT)** is a *reference* for link/definition logic — write original code; never copy Posit's AGPL extension/LSP (licensing hard gate).

### How You Will Be Evaluated
The user rates every session's handoff. Your handoff will be scored on:
1. Was the ACTIVE TASK block sufficient to orient the next session?
2. Were key files listed with line numbers?
3. Were gotchas and traps flagged?
4. Was the "what's next" actionable and specific?

---

*Session history accumulates below this line. Newest session at the top.*

### What Session 8 Did — 2026-06-27
**Deliverable:** Implement **Phase 6b** — Cross-reference completion + go-to-definition (IN PROGRESS)
**Started:** 2026-06-27 22:55 CDT
**Status:** Session claimed. Work beginning (strict TDD).

### What Session 7 Did — 2026-06-27
**Deliverable:** Implement **Phase 6a** — Document outline / symbols. **COMPLETE + verified + adversarially hardened.**

**What was done (4 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `b4b9a24` chore: claim Session 7 (WIP stub).
2. `d7f9b55` feat: Phase 6a **core** — new pure `src/core/qmd/model.ts` (`findHeadings`, `buildOutline`); **folded in** Phase 5's `core/cells.ts` (now a re-export shim) so heading + cell detection share one fence scanner. Strict-TDD (6 red→green cycles).
3. `74794ed` feat: Phase 6a **adapter + wiring** — `src/providers/outline.ts` (`registerOutlineProvider`, maps core→`vscode.DocumentSymbol`) + `src/extension.ts:27`; `test/integration/suite/outline.test.ts` (faithful via `executeDocumentSymbolProvider`).
4. `dc2e868` fix: Phase 6a **hardening** from a 5-lens adversarial review — unified the two scanners into one `scanRegions` pass (6 confirmed findings fixed).
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #14, model.ts setext note, BACKLOG/CHANGELOG/ROADMAP; + a dashboard refresh.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 24.6 KB → **29.3 KB**, +model+provider).
- `npm test` → **111/111** vitest (38 new in `qmd-model.test.ts`; the 17 `cells` tests stayed green throughout the consolidation = regression net).
- `npm run test:integration` → **25/25** in real downloaded VS Code (v1.126.0): the new outline test asserts the **full `sample.qmd` symbol tree** via `vscode.executeDocumentSymbolProvider` (Heading One › {Embedded code cells › 4 cells, Done}) — env-independent, no CLI/Jupyter. All Phase 5 run-cell tests still pass (the shared-model hardening did not regress them).
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).
- §3.3 guardrail: `grep vscode src/core/` → only doc-comment matches; no import. The provider imports core, never the reverse.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #14):**
- **One region scanner, many views.** `scanRegions()` classifies every line once (front matter | HTML comment | fence | ATX heading); `findHeadings`/`findAllCells`/`findCellAtPosition`/`buildOutline` are thin views. This is what makes the "single source of truth" docstring TRUE.
- **The "two scanners disagree" trap** (the review's core catch). 6a first shipped `findHeadings` (front-matter+fence aware) and a SEPARATE `findAllCells` (fence-aware only). They disagreed on skip-regions → `findAllCells` found phantom cells inside YAML front matter / HTML comments / 4-space-indented fences, corrupting both the outline AND Phase 5 run-cell. **97/25 happy-path tests all missed it.** The 5-lens adversarial review (refute-by-default verification) found 8 confirmed; unifying the scanner fixed 6.
- **Provider-via-`executeDocumentSymbolProvider` is the faithful, env-independent test** (extends #3/#9). Registering a provider needs no `package.json` contribution and isn't context-key-gated → the Learning #13a dead-on-arrival activation trap does NOT recur here.

**Adversarial review outcome (5 lenses, refute-by-default verify, 10 findings → 8 confirmed / 2 refuted):**
- **Fixed 6** (commit `dc2e868`): front-matter skip now shared with cells (#1/#2/#5); HTML-comment skip (#1); 0–3-space fence-indent cap matching ATX, CommonMark §4.5 (#3/#6); strip Pandoc `{#sec-id .class}` from the display name (#8); drop empty closing-hash heading `## ##` (#4).
- **Deferred 1** (documented, not a defect in handled input): **setext headings** `===`/`---` (#7) — needs `---` disambiguation vs thematic break / front matter; own TDD pass. In BACKLOG "Polish / deferred" + a `model.ts` docstring note.
- **Refuted 2** (no action — correctly): lone-`\r` classic-Mac EOL (a verifier opened such a file in the real host and confirmed VS Code normalizes EOL, so `getText()` never yields lone `\r` — my `lineSpan` clamp is sound); and a duplicate setext vote.

**Key files (with anchors):**
- `src/core/qmd/model.ts` — `scanRegions` (`:~165`, the single pass: front matter `:~180`, fence/cell `:~195`, HTML comment `:~210`, ATX heading `:~228`); `findHeadings`/`findAllCells` (thin wrappers `:~240`); `buildOutline` (`:~260`, nest-by-level stack + `sectionEndOf`); `parseHeadingLine` (`:~320`, strips `ATX_ATTRIBUTE` then `ATX_CLOSING` — **the `{#sec-id}` is parsed and currently discarded; Phase 6b must keep it**). Regexes `:58–95`. Pure.
- `src/core/cells.ts` — now a 1-line re-export shim over `./qmd/model` (Phase 5 + `cells.test.ts` import it unchanged).
- `src/providers/outline.ts` — `registerOutlineProvider` (`:16`), `QmdDocumentSymbolProvider` (`:25`), `toDocumentSymbol` (`:~37`, heading→`SymbolKind.String` / cell→`Function`), `lineSpan` (`:~62`, clamps to `document.lineCount`). Adapter.
- `src/extension.ts:27` — `registerOutlineProvider(context)`.
- `test/unit/qmd-model.test.ts` (38) — heading parsing, ATX edge rules, fence/front-matter/comment awareness, attribute strip, `buildOutline` nesting + sample.qmd ground-truth, region-consistency (cells & headings agree).
- `test/integration/suite/outline.test.ts` — `symbolsFor()` via `executeDocumentSymbolProvider`; asserts the sample.qmd tree.

**Gotchas for the next session (Phase 6b):**
1. **`core/qmd/model.ts` is the shared model — consume it, don't write a third scanner** (Learning #14). 6b's `core/refs.ts` should call `findHeadings`/`findAllCells`/`scanRegions`.
2. **The `{#sec-id}` id is parsed-and-discarded** in `parseHeadingLine`. 6b's FIRST step: add an `id`/attrs field to `Heading` and keep it (update the "Pandoc/Quarto heading attributes" test). The section-id label source for `@sec-`.
3. **Labels also live in `#| label: fig-foo` cell options** (figures/tables from code) — scan `cell.code`. And `{#fig-...}` on images/divs.
4. **Provider test via `vscode.executeCompletionItemProvider`/`executeDefinitionProvider`** in the host (faithful, env-independent) — mirror `outline.test.ts`. Completion trigger char is `@`.
5. **Setext headings are NOT parsed** (deferred) — if a 6b test doc uses a setext-underlined section as a `@sec-` target, it won't be found. Use ATX `{#sec-id}` headings in fixtures.
6. **`npm audit`** still 7 dev-only vulns (unchanged; none ship). No git remote → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 7): 9/10.**
- **+** Delivered exactly Phase 6a's scope, no bundling (FM #18 held — stopped before 6b). Four recoverable commits, ≤5 files each, full verification at each layer boundary (vertical-slice gate c). **Strict TDD held throughout** — RED observed before every GREEN across 9 cycles (6 core + 3 hardening), and the consolidation refactor kept the 17 Phase-5 cell tests green as a deliberate regression net (FM #20: re-read model.ts before each edit). Kept §3.3 (pure `core/qmd/model.ts`; thin adapter; grep-verified no `vscode` import). **Faithful verification:** the integration test exercises the REAL registered provider via `executeDocumentSymbolProvider` (not a stand-in), asserting the full tree env-independently. Ran a 5-lens adversarial review whose verification was discriminating (10 findings → 8 confirmed / 2 refuted, incl. a verifier that opened a lone-`\r` file in the real host to refute a plausible-but-wrong EOL finding); **unified the two scanners** to fix the root cause (not symptom-patch each producer) — which also improved Phase 5 run-cell — and re-ran the full unit+integration suite to confirm no regression. Honest scope discipline: deferred setext with documentation rather than gold-plating at close-out.
- **−** **I shipped the "two scanners disagree" defect in the first two commits** — `findAllCells` not honoring front matter was a latent Phase-5 gap I carried forward by consolidating cell logic without re-checking it against the new front-matter awareness I'd just added to `findHeadings`. A moment's thought at the consolidation step ("do both producers now agree on skip-regions?") would have caught it before the review. Caught and fixed in-session (root-cause unification), but it cost a review cycle. Genuine residual gap: the **Outline view's visual rendering** is F5-unverified (no `code` CLI) — the symbol *structure* is fully integration-proven, so this is cosmetic, stated honestly (not a skipped Phase 3E).

#### Session 6 Handoff Evaluation (by Session 7) — Phase 3A
**Score: 9.5/10.** An excellent, precise handoff — I was implementing within minutes and nearly every pointer held exactly.
- **What helped:** The ACTIVE TASK named the deliverable, the plan line, and the §3.3 guardrail, and the gotchas were all real and load-bearing. The single most valuable item: *"`core/cells.ts` is the cell half of 6a's model — FOLD IT IN, don't duplicate"* with the explicit "call it, or move it under `core/qmd/`" latitude — that shaped the whole core design (I made `cells.ts` a shim over the new model). The **"heading-in-cell trap"** gotcha (a `#` inside a cell is a comment, `#|` is an option) pointed me straight at fence-awareness as the core requirement. The **"provider, not command → `executeDocumentSymbolProvider` is the strongest verification"** note was exactly right and became the faithful integration test. File anchors (`render.ts:24` for the registration shape, `extension.ts:24` for wiring) all resolved. The "73 unit + 24 integration, clean 9-file `.vsix`" baseline matched reality.
- **What was missing / worth correcting:** The handoff framed `core/cells.ts` as something to "reuse for the cell regions" alongside new heading parsing — which subtly invited the **two-scanners-disagree** architecture I initially built (separate cell + heading scans). It did not flag that the two producers must agree on ALL skip-regions (front matter, comments, indented code), which the adversarial review then surfaced. Not Session 6's fault (a 6a-specific discovery), but it's now Learning #14 and the §"Gotchas" above. Minor: the handoff's `findAllCells :55` anchor was pre-consolidation (the line moved when I folded it into `model.ts`).
- **What was wrong:** Nothing material. Every factual claim (test counts, the fold-in latitude, the verification approach, anchors) held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

### What Session 6 Did — 2026-06-27
**Deliverable:** Implement **Phase 5** — `Quarto: Run Cell` family. **COMPLETE + verified.**

**What was done (8 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `0590d73` chore: claim Session 6 (WIP stub).
2. `8048dbc` feat: Phase 5 **core cell-finder** — `src/core/cells.ts` (`findAllCells`/`findCellAtPosition`) + `test/unit/cells.test.ts`. Strict-TDD (RED→GREEN per behavior).
3. `1200a09` feat: Phase 5 **core delegate logic** — `src/core/execution-delegate.ts` (`delegateCommandsFor`/`pickDelegate`/`buildCellSnippet`) + test.
4. `8953482` feat: Phase 5 **adapter + wiring + contributions** — `src/features/execution.ts` + `src/extension.ts` + `package.json` (5 commands + keybindings).
5. `95b020d` test: Phase 5 **integration** — `test/integration/suite/execution.test.ts` (registration + faithful stand-in dispatch) + `test/fixtures/run-cells.qmd`.
6. `6defa26` fix: Phase 5 **core** — track `~~~` tilde fences (review #1).
7. `a9d481d` fix: Phase 5 **hardening** from an adversarial review — 4 confirmed (#4 activation, #3 skip-and-continue, #5 advance-past-empty, #6 context-key staleness).
8. `0f8380b` test: Phase 5 — faithful coverage for the fixes (+6 tests) + `test/fixtures/run-cells-mixed.qmd`.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #13, CHANGELOG/BACKLOG/ROADMAP; + a dashboard-refresh commit.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 16.5 KB → **24.6 KB**, +execution).
- `npm test` → **73/73** vitest (17 `cells` + 11 `execution-delegate` new).
- `npm run test:integration` → **24/24** in real downloaded VS Code (v1.126.0): registers all 5 commands; **faithfully dispatches via a stand-in `jupyter.execSelectionInteractive`** (clean host has no Jupyter) asserting find-cell→select-code→invoke and the exact **selected text**; skip-and-continue across the mixed fixture; advance-past-empty; graceful in non-quarto / no-active-editor; `onLanguage:quarto` contribution guard.
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).

**🔑 Three load-bearing findings (→ CLAUDE.md Learning #13):**
- **Dead-on-arrival keybindings (review #4).** `activationEvents: []` does NOT activate the extension when a `.qmd` opens (language/grammar contributions don't trigger activation — only the auto-`onCommand` does), so the `quarto.inCodeCell` context key gating ctrl/shift+enter was never set → keybindings dead until a palette command ran. The integration suite **masked** this (it force-`activate()`s in `before()`). Fixed: `onLanguage:quarto`. Caught only by the adversarial review.
- **Faithful delegated-dispatch via a STAND-IN command.** The clean test-electron host has no Jupyter, so registering a stand-in `jupyter.execSelectionInteractive` that captures the **selected text** proves the whole dispatch chain env-independently (gate d; extends Learning #9).
- **Run-cell runs the IN-EDITOR buffer (no `doc.save()`)** — unlike render/preview (which save because the CLI reads disk). The delegated path depends on the user's **kernel + language extension**, not the Quarto CLI.

**Key files (with anchors):**
- `src/core/cells.ts` — `findAllCells` (`:55`), `findCellAtPosition` (`:~100`): fence-char-aware (backtick+tilde) linear scanner; `CELL_INFO` (`:39`) excludes `{{}}`/`{.}`; nested + tilde fences tracked as opaque non-cells. Pure.
- `src/core/execution-delegate.ts` — `pickDelegate(lang, available)` (`:~22`), `delegateCommandsFor` (`:~46`: python→`jupyter.execSelectionInteractive` / r→`r.runSelection` / julia→`language-julia.executeCodeBlockOrSelection`), `buildCellSnippet`. Pure.
- `src/features/execution.ts` — `registerExecutionFeature` (`:~30`, 5 commands + selection/active-editor/doc-change listeners), `runCells` (`:~120`, **skip-and-continue** + one end-of-batch summary warning), `cellCodeRange` (`:~155`, selection math), `advanceToNextCell`, `insertCell`, `updateCellContext` (`:~215`, active-editor-only guard). Adapter.
- `src/extension.ts:24` — `registerExecutionFeature(context)`.
- `package.json` — `activationEvents:["onLanguage:quarto"]` (`:16`); 5 `quarto.run*`/`insertCell` commands; `contributes.keybindings` (ctrl/shift+enter, `when: "… && quarto.inCodeCell"`).
- `test/integration/suite/execution.test.ts` — `registerStandInDelegate()` (`:~32`, the faithful technique; captures selected text), 14 tests. Fixtures: `run-cells.qmd` (2 python cells), `run-cells-mixed.qmd` (python multi-line / r / empty / python).

**Gotchas for the next session (Phase 6a):**
1. **`core/cells.ts` is the cell half of 6a's region model — FOLD IT IN, don't duplicate.** It's pure, fence-aware, 17 tests. 6a adds heading parsing on top of the same fence-awareness.
2. **Heading-in-cell trap:** a `#` inside a cell is a comment, `#|` is a cell option — scan for headings only OUTSIDE cells (reuse `cells.ts`'s fence tracking).
3. **6a is a provider, not a command** — `registerDocumentSymbolProvider`; test faithfully + env-independently via `vscode.executeDocumentSymbolProvider` (no Jupyter/CLI). Strongest verification here.
4. **Strict TDD held this session** (RED shown before every GREEN, incl. re-deriving RED on the integration behavior-changes). Keep it.
5. **F5-only residue (NOT a skipped 3E — automation-impossible):** the **keybinding feel** (ctrl/shift+enter inside a cell) and **real run-in-interactive-window with Jupyter installed** are not headlessly verifiable (no `code` CLI; clean host has no Jupyter). The *behavior* is integration-proven via the stand-in; only the real-extension hop + key feel are F5. **Recommend the operator F5-check** ctrl+enter inside a `{python}` cell with the Jupyter extension installed.
6. **`npm audit`** still 7 dev-only vulns (unchanged; none ship in the `.vsix`). No git remote → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 6): 9/10.**
- **+** Delivered exactly Phase 5's pre-declared family scope (5 commands), no bundling — stopped before 6a (FM #18 held). **Strict TDD held throughout** — RED observed before every GREEN, including deliberately removing my own over-anticipated unterminated-cell branch to drive it back via a failing test (a direct correction of Session 5's impl-first lapse). Kept §3.3 (two pure `core/` modules; thin adapter). **Faithful verification:** invented the stand-in-delegate technique so dispatch is proven env-independently (gate d), and captured the selected **text** (not just "something happened") to pin the selection math. Ran an adversarial multi-agent review whose verification was discriminating (23 findings → **10 confirmed / 13 rejected**); fixed **8** of the confirmed (incl. the dead-on-arrival keybinding bug the happy-path suite masked — exactly the class Learning #12 warned about) and **declined 2** borderline with documented rationale, each fix TDD'd (re-ran the integration suite to observe RED on the 3 behavior changes).
- **−** I set a **lenient confirmation threshold** in the review (a single "real" vote among two confirmed a finding), so "10 confirmed" included borderline splits I then triaged by hand — a strict-majority gate would have pre-filtered #2. The **activation gap (#4) I should have foreseen** (I knew `activationEvents` was `[]`); it took the review to surface it. Context-key staleness (#6) and the real-delegation hop remain **F5-verified only** (automation-impossible here) — stated honestly, not a skipped 3E.

#### Session 5 Handoff Evaluation (by Session 6) — Phase 3A
**Score: 9.5/10.** An outstanding, precise handoff — I was implementing within minutes, and nearly every pointer held.
- **What helped:** The ACTIVE TASK named the exact deliverable (the Phase 5 family) and plan lines, and the **4 dragons** were all real and correctly prioritized. The single most valuable item: *"keep cell detection a pure `core/` fn and TDD it — the bulk of correctness is there"* — exactly right; `core/cells.ts` is where the session's value concentrated. Reuse pointers were accurate and load-bearing: `render.ts`/`preview.ts` were the right adapter templates, `sample.qmd`'s discrimination cases (`{python}` vs plain ` ```python ` vs `{{}}`) were precisely the cases to test, and the **Learning #9 faithful-verification warning** (host extensions differ) directly shaped the stand-in-delegate technique. The *"STRICT TDD, lead with the failing test, Session 5 was corrected for impl-first"* note was heeded — RED led every cycle.
- **What was missing / worth correcting:** The handoff noted keybindings were "safe now the TOCTOU is fixed" (true for lifecycle) but did NOT flag the **activation-event gap** — a keybinding gated on a context key set in `activate()` is dead until the extension activates, and `activationEvents:[]` doesn't activate on `.qmd` open. Not Session 5's fault (a Phase-5-specific discovery), but it cost a review cycle; now Learning #13(a). It also under-specified that run-cell should NOT save the buffer (a real design point vs render/preview) — minor, I derived it.
- **What was wrong:** Nothing material. Every file anchor (`render.ts:24`, `preview.ts:343`, `cli.ts:60/:22`), test count, and reuse target held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

### What Session 5 Did — 2026-06-27
**Deliverable:** Implement **Phase 4** of the architecture plan — `Quarto: Preview`. **COMPLETE + verified.** (Plus two operator directives handled mid-session: enshrining strict TDD, and fixing the stale README.)

**What was done (6 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `9307970` docs: **enshrine strict TDD project-wide** (operator directive) — added a binding override subsection + Learning #10 to `CLAUDE.md` (the correct non-synced file; SESSION_RUNNER/SAFEGUARDS/`docs/methodology/` are synced byte-identical).
2. `dc25322` feat: Phase 4 **core parser** — `src/core/preview-url.ts` (`parseBrowseUrl`, pure/`vscode`-free) + `test/unit/preview-url.test.ts`. Built strict-TDD (4 red→green cycles).
3. `a7fbfa1` feat: Phase 4 **core HTML/CSP builder** — `src/core/preview-html.ts` (`buildPreviewHtml`) + test (3 TDD cycles).
4. `ff9e2c2` feat: Phase 4 **adapter + wiring + contribution** — `src/features/preview.ts` (`PreviewManager`, spawn/parse/webview/lifecycle) + `src/extension.ts` (wire + `deactivate()` body) + `package.json` (`quarto.preview`).
5. `0e56d93` test: Phase 4 **integration** — `test/integration/suite/preview.test.ts` (registration + faithful no-orphan lifecycle).
6. `9ec813d` fix: Phase 4 **hardening from an adversarial review** — 5 confirmed fixes (TOCTOU race + 4 low-sev), TOCTOU regression-tested.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learnings #11/#12, README, BACKLOG/CHANGELOG/ROADMAP; + a dashboard-refresh commit.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 8.5 KB → **16.5 KB**, render+preview).
- `npm test` → **45/45** vitest (4 preview-url + 3 preview-html new).
- `npm run test:integration` → **10/10** in real downloaded VS Code (v1.126.0): registers `quarto.preview`; **spawns a real preview and reaps the deno worker on pane close (no orphan)** in ~3.8 s; **TOCTOU test** fires the command twice concurrently and confirms no orphan.
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).
- **Live CLI verification (observed, not assumed):** captured `quarto preview sample.qmd --no-browser` → `Browse at http://localhost:3958/` on **STDERR** (stdout empty), ANSI-wrapped; the process-group kill leaves no orphan.

**🔑 Three load-bearing findings:**
- **Process-tree reaping + the deno-worker faithful-verification trap (→ Learning #11).** `quarto preview` is a bash wrapper that spawns a long-lived **deno worker** (`quarto.js preview`). Killing the wrapper first **reparents** the worker → orphan. Fix: spawn **`detached`** and group-kill (`process.kill(-pid, SIGTERM→SIGKILL)`, gated on a `kill(-pid,0)` liveness probe). **`pgrep -f "quarto preview"` matches the wrapper but NOT `quarto.js preview`** — so that probe (which the Session-4 handoff and Learning #4 both suggested) reports "clean" while the worker orphans. Caught a real orphan from my own capture script this way; the test probe now matches `preview.*sample.qmd` (both processes).
- **TOCTOU race in the single-preview guard (→ Learning #12), found by adversarial review, missed by the happy-path test.** The guard read the sessions map before the `save()`/`resolveBinary()` awaits; the session was registered after → two rapid invocations orphan the first server. Fix: reserve the slot synchronously in a `starting` Set before any await.
- **Strict TDD is now a standing operator directive** (Learning #10 / CLAUDE.md §Mandatory development practice). Applies to every future session.

**Key files (with anchors):**
- `src/core/preview-url.ts` — `parseBrowseUrl(stderr)` (`:30`): strips ANSI, requires a complete newline-terminated line (truncation guard). Pure.
- `src/core/preview-html.ts` — `buildPreviewHtml({url})` (`:28`): full-bleed sandboxed iframe; CSP `default-src 'none'`, `frame-src <origin>` (origin from `new URL().origin`), URL HTML-escaped (`escapeAttr` `:20`). Pure.
- `src/features/preview.ts` — `PreviewManager` (`:48`): `openPreview` (`:66`, `starting`-Set TOCTOU guard), `spawnPreview` (`:108`, detached spawn + webview + `urlShown`/`settled` state machine + 60 s startup timeout), `showPreview` (`:219`, `asExternalUri` then `buildPreviewHtml`), `disposeSession` (`:231`, delete-before-kill re-entry guard), `killProcessGroup` (`:263`, group-kill + liveness-probed SIGKILL escalation). `registerPreviewFeature` (`:343`), `disposeAllPreviews` (`:374`).
- `src/extension.ts:23` — `registerPreviewFeature(context)`; `:64` — `deactivate()` reaps all previews.
- `package.json` — `quarto.preview` command (`contributes.commands`, after `quarto.render`).
- `test/integration/suite/preview.test.ts` — `previewProcessCount()` (`:31`, the faithful `preview.*sample.qmd` probe), lifecycle + TOCTOU tests; `afterEach` SIGKILLs stragglers.

**Gotchas for the next session (Phase 5):**
1. **Phase 5 has NO long-lived process** (it delegates run-cell to other extensions) — so the Phase-4 lifecycle dragon does NOT recur. The hard part shifts to **feature-detecting delegate command IDs** and **cell-boundary detection** (keep it a pure `core/` fn and TDD it).
2. **STRICT TDD is mandatory** (operator directive). Lead with the failing test. Session 5 was corrected for starting impl-first — don't repeat it.
3. **Faithful verification (Learnings #9 + #11):** when a test depends on the host's installed extensions/kernels (Jupyter for run-cell), it can pass/fail for host-env reasons. Keep automated tests env-independent (registration, cell-finder units, the no-delegate graceful message); verify real delegated execution via F5. And if you ever probe for processes, match the real worker, not a wrapper.
4. **F5-only residue from Phase 4 (NOT skipped 3E — automation-impossible):** the webview's **visual render**, **livereload-in-iframe on save**, and **notification wording** are not headlessly verifiable (no `code` CLI). The *behavior* (spawn, registration, no-orphan lifecycle, TOCTOU) is integration-proven; only pixels/UX text are unverified. Reload-on-save relies on **Quarto's native livereload inside the iframe** (the reference pattern) — if F5 shows it doesn't fire, the documented fallback is a stderr-`Output created:`-driven `postMessage` reload.
5. **`npm audit`** still 7 dev-only vulns (unchanged; none ship in the `.vsix`). No git remote → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 5): 9/10.**
- **+** Delivered exactly Phase 4's scope, no bundling (FM #18 held — stopped before Phase 5). Six recoverable commits, all ≤5 files, full verification at each layer boundary (vertical-slice gate c). Kept the §3.3 guardrail (two pure `core/` modules; the adapter is thin). **Verified the `Browse at` stream/format live before coding** (found it's stderr+ANSI, as Learning #8 predicted). **Caught a real process-orphan via the deno-worker trap** and made the no-orphan test *faithful* (matches the worker, not the wrapper) rather than green-but-hollow (gate d). Ran an **adversarial multi-agent review** that found a genuine TOCTOU race the happy-path integration test missed, fixed it + 4 more, and **regression-tested the race** (red→green). Adopted strict TDD on operator correction and enshrined it in the correct non-synced file. Two new Learnings (#11/#12) for Phases 5+.
- **−** **Started impl-first on the parser before its test** — a real TDD lapse the operator had to flag; I reset to genuine red-green, but it shouldn't have happened given the Development workstream already names "Test-last" as anti-pattern #3. The TOCTOU race shipped in commit 4 and was only caught by the post-hoc review — a stronger up-front concurrency analysis (or writing the double-invocation test first) would have caught it during implementation, not after. Genuine residual gap: the webview **visual + livereload-on-save** are F5-unverified (automation-impossible here) — stated honestly, not a skipped Phase 3E.

#### Session 4 Handoff Evaluation (by Session 5) — Phase 3A
**Score: 9.5/10.** An excellent, precise handoff — I was productive within minutes of orientation.
- **What helped:** The ACTIVE TASK block named the deliverable (Phase 4 only), the exact plan lines (§6 ~278–296, §8), and the **4 dragons** — all of which held. The reuse pointers were accurate and load-bearing: `src/features/render.ts` was *exactly* the right template (spawn + stream + fail-soft + `registerRenderFeature` wiring shape), and `resolveBinary()`/`QuartoNotFound` anchors were correct. The strongest single item: **"VERIFY the exact `Browse at` line live before coding" (Learning #8)** — I did, and confirmed it's on **stderr**, ANSI-wrapped (the plan §2.3 wrongly said stdout), which is what made the parser correct. Gotcha #3 (`showInformationMessage` doesn't block in the headless host → fire-and-forget) and the "keep the parser a pure `core/` fn like `parseOutputPath`" guidance were both spot-on and followed.
- **What was missing / worth correcting:** The handoff's orphan-check command — `pgrep -fl "quarto preview"` — is **unfaithful**: it matches the bash *wrapper* but not the **deno worker** (`quarto.js preview`), so it reports "clean" while the worker orphans. Not Session 4's fault (it's how Learning #4 framed it), but it cost me a real orphan + a render-test timeout before I root-caused it. Now corrected as Learning #11 (probe `preview.*<fixture>`). Also: the handoff (reasonably) treated the `pgrep` orphan check as F5-only; it turns out to be **automatable and faithful** if you match the worker — which is now the strongest integration test.
- **What was wrong:** Nothing material. Every file anchor, version, and reuse target held. The one inaccuracy (the `pgrep` pattern) was inherited from a Learning, not invented.
- **ROI:** Strongly positive — the handoff + plan let me spend the session on engineering, live verification, and the adversarial review, not archaeology.

### What Session 4 Did — 2026-06-27
**Deliverable:** Implement **Phase 3** of the architecture plan — `Quarto: Render`. **COMPLETE + verified.**

**What was done (3 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `996d157` feat: Phase 3 **core** — `src/core/render-args.ts` (pure, `vscode`-free): `buildRenderArgs(file, opts)→argv` + `parseOutputPath(output)→path` (ANSI-tolerant, returns last match) + `test/unit/render-args.test.ts` (9 cases).
2. `9b3461c` feat: Phase 3 **feature** — `src/features/render.ts` (`registerRenderFeature(context)` + spawn/stream adapter) + wired in `src/extension.ts` + `quarto.render` command in `package.json`.
3. `92de193` test: Phase 3 **integration** — `test/integration/suite/render.test.ts` (3 cases) + `test/fixtures/render-error.qmd` (deterministic failure) + `test/fixtures/needs-jupyter.qmd` (documented missing-Jupyter case).
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learnings #8/#9, BACKLOG/CHANGELOG/ROADMAP, dashboard.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 4.8 KB → 8.5 KB).
- `npm test` → **38/38** vitest (9 new render-args cases).
- `npm run test:integration` → **7/7** in real downloaded VS Code (v1.126.0): registers `quarto.render`; **success path actually renders `sample.qmd`→`sample.html`** (asserted via `existsSync`, ~4 s); **failure path** runs `render-error.qmd` (exit 1) and confirms no host crash (<1 s).
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak — verified via `vsce ls`).
- **Live CLI verification (observed, not assumed):** `quarto render sample.qmd` → exit 0, `Output created: sample.html` **on stderr**; `quarto render needs-jupyter.qmd` → exit 1, `ModuleNotFoundError: No module named 'nbformat'` verbatim on stderr.

**🔑 Two load-bearing findings (now CLAUDE.md Learnings #8, #9):**
- **#8 — `quarto render` writes progress + the `Output created:` success marker AND errors all to STDERR (stdout empty).** You CANNOT key success off stream routing — **use the exit code**. Output path is relative to the input dir; the line carries ANSI escapes (strip before parsing). Same shape will hit Phase 4's `Browse at` parsing.
- **#9 — faithful-verification trap (gate d / FM #24):** the test-electron host resolves a **different, Jupyter-capable Python** than this shell, so an executable-`{python}` fixture **renders SUCCESSFULLY in the host** — a missing-Jupyter "does-not-throw" test passes *trivially*. Caught it because the host left a rendered `needs-jupyter.html` (cell output present) and the test ran 7 s (success) not <1 s (failure). Fixed by using an **environment-independent** deterministic-failure fixture (`render-error.qmd`, invalid `format:`); the real missing-Jupyter case is verified live via the CLI instead.

**Key files (with anchors):**
- `src/core/render-args.ts` — `buildRenderArgs` (`:25`), `parseOutputPath` (`:52`, strips `ANSI_PATTERN` at `:38`, returns LAST `Output created:` match). Pure — no `vscode`. The template for Phase 4's `Browse at` parser.
- `src/features/render.ts` — `registerRenderFeature(context)` (`:24`, creates the "Quarto Render" channel + registers the command, both via `context.subscriptions`); `renderActiveDocument` (`:41`, requires active `quarto` doc, saves if dirty, fail-soft on `QuartoNotFound`); `runRender` (`:90`, `spawn` + stream both streams, key off exit code on `close`); `showSuccess` (`:144`, Open-button → `openExternal`).
- `src/extension.ts:21` — `registerRenderFeature(context)` call in `activate`.
- `package.json:53-57` — `quarto.render` command contribution (activation auto-inferred; `activationEvents: []` unchanged).
- `test/integration/suite/render.test.ts` — success (`existsSync(SAMPLE_HTML)`) + deterministic failure (`assert.doesNotReject`); `afterEach` cleans render artifacts.
- `test/fixtures/render-error.qmd` (deterministic fail, used by the test) · `test/fixtures/needs-jupyter.qmd` (real missing-Jupyter case, manual/CLI only — header explains why it's not host-test-reliable).

**Gotchas for the next session (Phase 4):**
1. **Learnings #8 + #9 apply directly to Phase 4.** Preview also emits `Browse at` to **stderr** (re-verify the exact line live before pinning a parser fixture); and if any preview test touches code-cell rendering, remember the host has Jupyter (env-dependent — use deterministic fixtures, verify env-dependent behavior via CLI).
2. **Process lifecycle is the Phase 4 dragon, not parsing.** `--timeout` does NOT self-exit reliably — track the child and kill on panel dispose / doc close / `deactivate()` (currently `src/extension.ts:62` is a no-op; that's where the kill goes). An integration test that spawns preview MUST kill it in `after`/`afterEach` or it orphans.
3. **`showInformationMessage(..., "Open")` does NOT block in the headless host** — it resolves `undefined`; `showSuccess` is fire-and-forget (`void`) so the render promise resolves on child `close`, independent of the notification. Rely on the same pattern for preview.
4. **F5 still owns the visual gap:** the Output-channel text and the success/error **notification wording** were NOT visually confirmed (no `code` CLI → no headless F5). The *behavior* is proven by integration tests; only the cosmetic UI text is unverified. For Phase 4 the webview render + the `pgrep` orphan check are genuinely F5-only — plan for a manual pass.
5. **`npm audit`** still 7 dev-only vulns (unchanged; none ship in the `.vsix`). No git remote yet → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 4): 9/10.**
- **+** Delivered exactly Phase 3's scope, no bundling (FM #18 held — stopped before Phase 4). Three recoverable commits, all ≤5 files. **Kept the §3.3 guardrail** (pure `core/render-args.ts`, the feature is a thin adapter). Verified BOTH render paths **live via the CLI first** (observed, not assumed) before coding the parser — which is how I found that the success marker is on stderr (would have produced a silently-broken success/failure split otherwise). **Caught a faithful-verification trap myself** (FM #24/gate d): the missing-Jupyter integration test was passing trivially because the host renders it successfully — I noticed the leftover rendered artifact + the 7 s-vs-<1 s timing, root-caused it to PATH/Python divergence, and replaced it with a deterministic env-independent failure fixture rather than shipping a green-but-hollow test. Recorded both findings as Learnings #8/#9 for Phases 4–5.
- **−** First draft of the degradation test was the hollow one — I should have predicted the host/shell environment divergence up front (Learning #4 already flagged Jupyter as environment-specific), rather than discovering it from a leftover artifact. Cost one extra integration-test iteration. The genuine residual gap: the **Output-channel text + notification wording** are not visually confirmed (no headless F5) — stated honestly, behavior is integration-proven, only cosmetics are unverified (not a skipped Phase 3E).

#### Session 3 Handoff Evaluation (by Session 4) — Phase 3A
**Score: 9.5/10.** An excellent, precise handoff — I was building within minutes of orientation.
- **What helped:** The ACTIVE TASK block named the deliverable (Phase 3 only), the exact plan lines (§6 ~260–274, §8), and the §3.3 guardrail with the concrete suggestion `core/render-args.ts: (file,opts)→string[]` — I followed it almost verbatim. The pointers to `resolveBinary()` (`:60`) / `QuartoNotFound` (`:22`) were accurate and saved lookup. The two flagged tricks were both load-bearing and correct: **`#| eval: false` ⇒ render-clean fixture** (reused `sample.qmd` directly as the success fixture) and **"for the failure path you need an executable `{python}` cell (no eval:false)"** (which is exactly the fixture I built — and which surfaced the deeper host/shell trap). The "Jupyter/`nbformat` is ABSENT here" note (Gotcha #4 / Learning #4) was the seed that let me recognize the faithful-verification problem.
- **What was missing:** Two things the handoff couldn't have known, now Learnings #8/#9: (a) `quarto render` writes the success marker + errors to **stderr**, not stdout (so success/failure is exit-code-keyed); (b) the test-electron **host resolves a different, Jupyter-capable Python** than this shell, so the missing-Jupyter degradation can't be tested in the host. Both are mine to pass forward — done.
- **What was wrong:** Nothing. Every claim held — versions, file anchors, the reuse targets, the render-clean trick, the activation-inference note.
- **ROI:** Strongly positive — the handoff + plan let me spend the session on engineering and the faithful-verification fix, not archaeology.

### What Session 3 Did — 2026-06-27
**Deliverable:** Implement **Phase 2** of the architecture plan — `.qmd` syntax highlighting. **COMPLETE + verified.**

**Grammar-approach decision (this session resolves the operator's deferred "base grammar" question — by NOT forking):** rather than fork `wooorm/markdown-tm-language` or `microsoft/vscode-markdown-tm-grammar`, I authored an **original** `text.html.quarto` grammar that `include`s VS Code's built-in `text.html.markdown` **by scope-name reference** (no source copied) for prose/plain fences, and adds only Quarto-specific rules. Cleaner (nothing large to copy/attribute; markdown stays current), license-clean (the canonical `mjbvz` MIT injection pattern), reversible. Recorded in `/NOTICE`, `CONTEXT.md` (decision pointer), `CLAUDE.md` Learning #6.

**What was done (3 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `d8bc4b8` feat: grammar + `language-configuration.json` + `NOTICE` + `package.json` wiring
2. `63ab34f` test: `test/fixtures/sample.qmd` + structural guard (`test/unit/grammar.test.ts`) + real-host registration test (`test/integration/suite/language.test.ts`) + `.gitignore` render-artifact guard
3. `46763a9` test: headless tokenization (`test/unit/tokenize.test.ts`) + `vscode-textmate`/`vscode-oniguruma` devDeps

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild.
- `npm test` → **29/29** vitest (12 version + 10 structural grammar + 7 tokenization).
- `npm run test:integration` → **4/4** in real downloaded VS Code (v1.126.0): `.qmd` opens as `languageId 'quarto'` end-to-end. Exit 0.
- `npm run package` → clean **9-file** `.vsix` (adds `syntaxes/quarto.tmLanguage.json`, `language-configuration.json`, `NOTICE`; **no** test/fixture/`.claude` leak — verified via `vsce ls`).
- `quarto render test/fixtures/sample.qmd` → exit 0, `sample.html` created (cells use `#| eval: false` so no Jupyter needed). Render artifacts cleaned + gitignored.

**🔑 Headless grammar verification (stronger than the plan's manual-F5 budget):** `test/unit/tokenize.test.ts` loads the grammar into the SAME engines VS Code uses (`vscode-textmate`+`vscode-oniguruma`) and asserts the actual token scopes — front matter, all four `meta.embedded.block.*`, fence punctuation, AND the discriminating cases (a plain ` ```python ` block and post-cell prose are NOT in a cell). This proves the regexes work (back-referenced closing fence, `\A` anchor, `\b` boundaries), not just that the JSON is well-formed. See CLAUDE.md Learning #7.

**Key files (with anchors):**
- `syntaxes/quarto.tmLanguage.json` — the grammar. `patterns` order is load-bearing: `frontmatter` → `cell-python/r/julia/ojs` → `cell-generic` (catch-all) → `text.html.markdown` (include). Each cell rule: `begin` matches ` ```{lang} `, `end` is `^\s*(\2)\s*$` (back-references the opening fence), `contentName: meta.embedded.block.<lang>`.
- `language-configuration.json` — block comment `<!-- -->`, brackets, autoclose, folding markers.
- `package.json:18-32` — `contributes.languages` (`.qmd`/`.rmd`/`.Rmd` → `quarto`); `:33-50` — `contributes.grammars` incl. `embeddedLanguages` (the map that enables bracket/comment inside cells — NOT the grammar itself).
- `NOTICE` — MIT attribution (licensing hard gate).
- `test/unit/tokenize.test.ts` — headless scope verification (the high-value test). `test/unit/grammar.test.ts` — structural/manifest guard. `test/integration/suite/language.test.ts` — real-host registration.
- `test/fixtures/sample.qmd` — front matter + prose + 4 cells + a plain fence; `#| eval: false` makes it render-clean.

**Gotchas for the next session:**
1. **DON'T touch the grammar for Phase 3** — render is a CLI/command feature, orthogonal to highlighting.
2. **vscode-textmate test gotcha (cost most of my debug time):** in `tokenize.test.ts`, `loadGrammar` returns an empty **stub** `{scopeName, patterns: []}` for unresolved external includes — returning **`null` corrupts vscode-textmate's pattern compilation** (sibling rules silently stop matching). Real VS Code always has those grammars, so the extension is fine. If you write more grammar tests, stub, don't null.
3. **`source.r`/`source.julia` aren't bundled with VS Code** → `{r}`/`{julia}` cells get the embedded scope but only colorize if the user installs those extensions (python/js always colorize). Expected, not a bug.
4. **`#| eval: false` ⇒ render without a kernel.** Reuse for any render-clean fixture; for the Phase 3 *failure* path, you need an executable `{python}` cell (no `eval: false`).
5. **`npm audit`** still reports 7 dev-only vulns (now incl. vscode-textmate/oniguruma transitively — count unchanged); none ship in the `.vsix`. Not chased.
6. **No git remote yet** → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`); README still avoids relative links. When a remote is added: add `repository`, drop the flag.

**Self-assessment (Session 3): 9/10.**
- **+** Delivered exactly Phase 2's scope, no bundling (FM #18 held — stopped before Phase 3). Three recoverable commits, all ≤5 files. **Resolved the operator's deferred base-grammar decision** with a cleaner-than-asked approach (include-by-reference vs fork) and documented the rationale + attribution. Went beyond the plan's manual-F5 budget: built **headless tokenization verification** that actually proves the grammar works (per Learning #3's "prefer automated runtime verification"), including discriminating negative cases. Caught and root-caused a non-obvious vscode-textmate behavior (null-include corruption) rather than working around it blindly. Updated CLAUDE.md (Learnings #6/#7), CONTEXT.md (decision + 2 pitfalls), BACKLOG/CHANGELOG/ROADMAP.
- **−** Spent significant debug time on the null-include false alarm — my first `tokenize.test.ts` reported failures that looked like grammar bugs but were harness bugs; I should have suspected the harness sooner given the regexes passed in isolation. The one genuine gap: **theme COLOR** (scope→color mapping) is not verified headlessly — that's the operator's F5 check. The scopes ARE proven, so this is cosmetic and honestly stated (not a skipped Phase 3E). Minor: didn't add `quarto`/`onLanguage` activation events, but Phase 2 has zero runtime code so none are needed (correct, but worth noting for Phase 3).

#### Session 2 Handoff Evaluation (by Session 3) — Phase 3A
**Score: 9.5/10.** An excellent, accurate handoff — I started building within minutes of orientation.
- **What helped:** The ACTIVE TASK block was precise — named the deliverable (Phase 2 only), the exact plan lines (§6 ~242–256), and the 🐉 load-bearing trap (brace-wrapped `{python}` cells need a custom rule; wrap in `meta.embedded.*` to dodge the string/comment trap) — that callout pointed me straight at the core design. The "reuse Phase 1, don't re-scaffold" note and the working-scripts list saved real time. The suggestion to "consider an integration test asserting the `quarto` language registers" was spot-on and I implemented it. Verified facts (Quarto 1.7.33, no `code` CLI, Node/npm versions) all held.
- **What was missing:** Almost nothing. Two things the handoff couldn't have known but a heads-up would've saved time: (a) the `vscode-textmate` null-include corruption gotcha (now Learning #7); (b) that `#| eval: false` is the trick to render a cell fixture without Jupyter (now documented). Both are mine to pass forward, now done.
- **What was wrong:** Nothing. Every claim held. The "base grammar default `wooorm/markdown-tm-language`" was framed as a default to evaluate, which correctly left me room to choose include-by-reference instead.
- **ROI:** Strongly positive — the handoff + plan let me spend the session on engineering and verification, not archaeology.

### What Session 2 Did — 2026-06-27
**Deliverable:** Implement **Phase 1** of the architecture plan — the walking skeleton. **COMPLETE + verified.**

**§12 ratification (operator, this session):** v1 scope = Phases 1–5 + 6a–6c (confirmed as proposed) · Tier B in-process providers + `vscode`-free core (confirmed) · stack TS+esbuild+vsce+vitest+test-electron, `engines.vscode ^1.90.0` (confirmed) · base grammar **deferred to Phase 2**, default `wooorm/markdown-tm-language`.

**What was done (6 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `3bf9e96` scaffold build config (package.json, tsconfig, esbuild.js, LICENSE, .vscodeignore)
2. `52b1144` package-lock.json (pinned dep tree)
3. `fc621d6` source: `core/version.ts` (pure) + `quarto/cli.ts` (adapter) + `extension.ts` (thin) + README
4. `2aa3ce5` unit harness (vitest, 12 tests) + F5 launch/tasks config
5. `913ad7d` integration harness (@vscode/test-electron, 2 tests)
6. `eb8df12` packaging fixes (.vscodeignore excludes `.claude`/`.git`; `--allow-missing-repository`; README relative-link removed)

**Verification (all green):**
- `npm run compile` → tsc `--noEmit` clean + esbuild → `dist/extension.js` (4.8 KB).
- `npm test` → **12/12** vitest unit tests (pure-core, headless).
- `npm run test:integration` → **2/2** in a real downloaded VS Code (v1.126.0): activates the extension AND executes `quarto.verifyInstallation` end-to-end against the real CLI. Exit 0.
- `npm run package` → clean **6-file** `.vsix` (LICENSE, package.json, readme, dist/extension.js only).

**🔑 RESOLVED the plan's #1 load-bearing assumption (§14, FM #19/§9):** `@vscode/test-electron` **CAN** download + run VS Code headlessly here (no `code` CLI). Automated runtime verification is available for all future phases — see CLAUDE.md Learning #3 (updated). This is *stronger* than the manual-F5 fallback the plan budgeted for.

**Key files (with anchors):**
- `src/core/version.ts` — pure semver parsing; `parseQuartoVersion`/`toSemVer`/`meetsMinimum`. **No `vscode` import** (the §3.3 guardrail; keep it that way).
- `src/quarto/cli.ts:60` — `resolveBinary()` (`QuartoNotFound` at `:22`); reads `quarto.path`→PATH, runs `<bin> --version`. The one external integration point (plan §8); every later phase reuses it.
- `src/extension.ts:13` — thin `activate()`; `:26` the `verifyInstallation` handler (info/warn/actionable-error paths).
- `esbuild.js` — bundles src → dist, `vscode` external. `tsconfig.test.json` — compiles `test/integration/**` → `out/` (separate from esbuild; test-electron runs the JS).
- `test/integration/suite/extension.test.ts` — the runtime-verification tests. `test/unit/version.test.ts` — the 12 unit tests.
- `package.json:36-45` — the scripts (`compile`/`test`/`test:integration`/`package`).

**Gotchas for the next session:**
1. **Two compilers by design** — esbuild bundles the extension; `tsc -p tsconfig.test.json` compiles integration tests to `out/`. Don't try to make esbuild do the tests or vice-versa. vitest is scoped to `test/unit/**` (won't run the mocha integration tests).
2. **`.vscodeignore` must keep excluding `.claude/**` and `.git/**`** — they leaked into the first `.vsix` until fixed. Re-check the `vsce package` file list whenever you add top-level files.
3. **No git remote yet** → `vsce package` needs `--allow-missing-repository` (baked into `npm run package`) and README must avoid relative links (`./LICENSE` was rejected). When a remote is added: add `repository` to package.json, drop the flag, restore the link.
4. **Integration tests download ~261 MB** the first time (into `.vscode-test/`, gitignored) and take ~30–40 s on first run; fast thereafter (cached).
5. **`npm audit`** reports 7 vulns (4 moderate/2 high/1 critical) — all in **dev-only transitive deps** (test/build tooling); none ship in the `.vsix` (node_modules is excluded). Not chased in Phase 1; revisit if a fix lands without breaking changes.
6. Phase 2 dragon (carried from the plan): brace-wrapped `{python}` cells need a **custom grammar injection** — the stock markdown rule won't match them. See the ACTIVE TASK block above.

**Self-assessment (Session 2): 9/10.**
- **+** Delivered exactly Phase 1's scope, no bundling (FM #18 held — stopped before Phase 2). Six recoverable commits, all ≤5 files. **Resolved the project's biggest open risk** (headless integration testing) rather than just documenting it as unknown. Went one step beyond build-clean: the integration test *executes* the command against the real CLI, so this is genuine runtime verification (not FM #24). Caught two real packaging defects (`.claude` leak, README link) at the release gate and fixed them. Updated CLAUDE.md learnings (#3 resolved, #5 added), BACKLOG/CHANGELOG/ROADMAP.
- **−** First `vsce package` failed (README relative link) — a known vsce behavior I should have pre-empted given there's no remote; cost one extra iteration. The `.claude/` leak likewise should have been in `.vscodeignore` from the first draft. Both caught + fixed in-session, but reflect not anticipating vsce's stricter packaging rules up front. Could not visually confirm the notification *text* via F5 (no `code` CLI / headless) — but the integration test covers the behavioral path, so this is a cosmetic gap, stated honestly, not a skipped Phase 3E.

#### Session 1 Handoff Evaluation (by Session 2) — Phase 3A
**Score: 9.5/10.** Among the best handoffs I could ask for.
- **What helped:** The ACTIVE TASK block was exact — named the deliverable (Phase 1 only), the §12 ratification gate, the precise plan sections to read (§3.3/§6/§10/§13) with line anchors, and the verification commands. The "load-bearing check" callout (confirm test-electron downloads VS Code, or document the gap) pointed me straight at the session's highest-value experiment. The verified-facts list (`quarto 1.7.33`, `Browse at` line, no `code` CLI) was accurate and saved re-derivation. FM #18/#19 reminders were correctly emphasized and kept me disciplined.
- **What was missing:** Two minor things the plan couldn't have known but a heads-up would've saved an iteration each: (a) `vsce` rejects README relative links / missing `repository` when there's no remote; (b) `.vscodeignore` needs `.claude/`. Both are now Learning #5.
- **What was wrong:** Nothing. Every claim (versions, file layout, the test-electron hypothesis, the boundary design) held up — and the test-electron question resolved *positively*, better than the plan's hedge.
- **ROI:** Strongly positive. The handoff + plan let me start building within minutes of orientation; I spent the session on engineering, not archaeology.

### What Session 1 Did — 2026-06-27
**Deliverable:** Planning session (Architecture workstream) — feature inventory + phased architecture/implementation plan for the Quarto VS Code extension. **COMPLETE.**

**What was done:**
- Phase 0 Orient (full): read SAFEGUARDS, SESSION_NOTES, BACKLOG, ARCHITECTURE_WORKSTREAM; ran dashboard; ghost-session check clean; reported; waited for direction.
- **Evidence-based research** (the greenfield equivalent of the grep-inventory): verified the Quarto CLI surface locally, and ran two parallel research agents against the live `quarto-dev/quarto` repo / Marketplace / official docs.
- **Resolved the load-bearing decision** (TextMate vs LSP) → ship Tier A grammar, build to Tier B in-process providers, defer Tier C out-of-process LSP; with the `vscode`-free-core guardrail making B→C cheap and the core headlessly testable.
- Wrote the plan: `docs/planning/2026-06-27-extension-architecture-plan.md` (447 lines) — 7 phases as vertical slices, each with DONE gate + verification commands + one-session boundary + 🐉 dragon flags; v1 scope + explicit descope; licensing-compliance findings; interface contracts; failure-mode analysis; honest alternatives; §12 ratification list.
- Updated `CONTEXT.md` (decision pointer resolved + 2 new pitfalls) and `CLAUDE.md` (Project-specific Learnings). 
- **Deliverable was OUTPUT, not input** — no plan was provided to me; I produced it.

**Commit:** (see git log — committed at close-out, message `docs: architecture & phased implementation plan (Session 1)`).

**Key files (with line anchors):**
- `docs/planning/2026-06-27-extension-architecture-plan.md` — the deliverable. §3 (lines ~77–137) = the load-bearing decision + the `core/`-vs-adapter guardrail; §6 (~210–337) = the 7 phases; §12 (~411–419) = decisions to ratify; §14 (~437–447) = load-bearing assumptions to verify.
- `CONTEXT.md:40-45` — Architecture Decision Pointer (now resolved → points to the plan).
- `CLAUDE.md` → "Project-specific Learnings" — 4 learnings recorded this session.

**Verified facts (live, this session — trust these):**
- `quarto 1.7.33`; `quarto preview <f>` prints `Browse at http://localhost:<port>/` (the line the preview webview must parse).
- `quarto preview --timeout N` does NOT reliably self-exit (only on no active clients) → the extension must own preview process lifecycle (Phase 4 dragon).
- Code-cell render needs **Jupyter** (`nbformat`) in the active Python env — absent here (degradation case).
- **No `code` CLI on PATH** → manual F5 for runtime checks; `@vscode/test-electron` downloads its own VS Code (verify in Phase 1).

**Gotchas for the next session:**
1. The plan is a **DRAFT** — get operator ratification of §12 before coding (FM #19/#23: a plan in the prompt is not a go-ahead).
2. Implement **Phase 1 ONLY**, then close out (FM #18). The phase numbering is not license to bundle.
3. Quarto cells use brace-wrapped `{python}` identifiers — the stock markdown fenced rule won't match them (Phase 2 dragon, not Phase 1).
4. Licensing is a hard gate: never copy from Posit's AGPL `apps/vscode`/`apps/lsp`. Build on MIT `vscode-markdown-tm-grammar` / `markdown-tm-language` / `vscode-markdown-languageservice`.

**Self-assessment (Session 1): 8.5/10.**
- **+** Resolved the load-bearing decision with two independent evidence passes (both cross-confirmed AGPL + architecture). Did not assume — verified the CLI live and the repo facts via GitHub API. Vertical-slice phasing with per-phase DONE/verification/boundary. Honest descope + alternatives. Flagged dragons and load-bearing assumptions per Learning #3.
- **−** Two typos required in-session correction (stray chars in plan §6; filename in handoff) — caught and fixed, but reflects draft-speed writing. Could not runtime-verify anything (correct for a planning session — no runtime artifact exists; not FM #24). The §12 decisions are proposed, not operator-confirmed, so the plan ships as a draft (by design).

#### Session 0 Handoff Evaluation (by Session 1) — Phase 3A
**Score: 9/10.** Session 0's handoff prepared me well.
- **What helped:** The ACTIVE TASK block was specific and correct — it named the deliverable (plan, not code), the workstream, the load-bearing decision to resolve, the suggested filename/location, and the vertical-slice + FM #18 constraints. The "Useful starting context" (Quarto 1.7.33, Node/npm versions, pointers to CONTEXT/BACKLOG) saved discovery time. The **gotcha was prescient**: "CLAUDE.md is only read at session start, so this setup session never ran Phase 0 — the next session must begin with Phase 0 Orient" — exactly what I did.
- **What was missing:** Nothing material. It could have noted that there is **no git remote** (so `gh issue list` fails and BACKLOG is the source of truth) — minor; I discovered it in one command.
- **What was wrong:** Nothing. Every claim (versions, file layout, adoption mode) checked out.
- **ROI:** Strongly positive — reading it cost ~1 min and saved re-deriving the task framing and constraints.

### Session 0 (Setup / Bootstrap) — 2026-06-27
**Deliverable:** Bootstrap the Iterative Session Methodology (KJ5HST/methodology v3.0) into the project. COMPLETE.
**What was done:**
- `git init` (branch `main`); repo created from an empty directory.
- Ran the methodology's own `bin/sync` (committed mode, local source) — installed `SESSION_RUNNER.md`, `SAFEGUARDS.md`, `RECOMMENDED_SKILLS.md`, `CONTEXT_TEMPLATE.md`, `CLAUDE_TEMPLATE.md`, `BOOTSTRAP.md`, `methodology_dashboard.py`, seeded `SESSION_NOTES.md`/`CHANGELOG.md`/`ROADMAP.md`, and the framework under `docs/methodology/` (+ `workstreams/`).
- Instantiated `CLAUDE.md` (SESSION PROTOCOL + project purpose/stack/build) and `CONTEXT.md` (Quarto domain vocabulary + MIT-license constraint) from the templates.
- Created `BACKLOG.md` (first task = planning session) and `.gitignore` (ignores `dashboard.html`, `node_modules/`, `dist/`, `*.vsix`).
- Ran `methodology_dashboard.py` → `dashboard.html` (health 30/100, expected at 0 commits).
**Adoption mode:** Committed (single-project). To update later: clone `KJ5HST/methodology` as a sibling and run `bin/sync`, or tell the agent "Update methodology using https://github.com/KJ5HST/methodology".
**Gotcha:** The methodology requires starting a FRESH session before the first real task — `CLAUDE.md` (with the SESSION PROTOCOL) is only read at session start, so this setup session never ran Phase 0 against it. The next session must begin with Phase 0 Orient.
**Self-assessment:** Setup-only session (no predecessor to evaluate — this is Session 0). Bootstrap executed faithfully via the upstream tool rather than hand-copying, so synced files are byte-identical to canonical (no drift; future syncs are clean). No runtime behavior to smoke-test.
**Next:** See ACTIVE TASK above — the planning session.
