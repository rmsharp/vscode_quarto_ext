# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

---

## ACTIVE TASK
**Task:** **Session 20 DONE — Phase 6d Slice 6d-3 (`#|` cell-option SCHEMA READER — the 🐉 dragon slice)**. SHIPPED + adversarial-review-hardened. Cell-option completion now reads the user's **installed** Quarto schema (`<share>/editor/tools/yaml/yaml-intelligence-resources.json` via the undocumented `quarto --paths`): the **full** 94-of-97 option set + descriptions + value enums **resolved from the live schema** (`column` → all 18 `page-column` values from `definitions.yml`), **engine-filtered**, degrading to the curated `CURATED_CELL_OPTIONS` fallback on ANY failure. **Recommended next deliverable: implement Slice 6d-4** (front-matter top-level KEY completion — the FIRST front-matter slice; needs NEW model surface) — but the operator may pick otherwise (6d-5 front-matter VALUE, a Phase 7 slice, 6e, a Polish item, or the operator-only `vsce publish`). *Background: v1 feature-complete + release prep AGENT-COMPLETE (Sessions 1–13); 14 formatting toggles, 15 math preview, 16 diagram preview, 17 6d plan, 18 6d-1, 19 6d-2.*
**Status:** Shipped + committed (8 commits: the standalone Phase 1B stub + 5 layer-checkpoint feature commits + 1 review-fix doc commit + this close-out docs commit). Baselines now **326 unit + 81 integration** green (was 297/79). Clean **33-file** `.vsix` (1.29 MB — new core is bundled). `npm audit` unchanged = 7 dev-only vulns (Learning #20; no new deps — `node:fs` is built-in). §3.3 guardrail intact (no `vscode` import in `core/`). Repo PUBLIC; `origin` → `rmsharp/vscode_quarto_ext` (branch `master`). **`master` is AHEAD of `origin` by Sessions 17–19's commits + this session's ~10 — confirm with `git status`; pushing is the operator's call** (prior sessions left it to the operator).
**Plan:** **6d is governed by `docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md`** (per-phase plan). 6d-1 + 6d-2 + 6d-3 are done; **6d-4** is next (plan §6 — front-matter top-level KEY). Other v2 phases (Phase 7 remaining slices, 6e) are implemented directly from the parent plan. Strict TDD throughout.
**Priority:** Implement Phase 6d, one slice per session, **next is 6d-4** (plan §6). Each slice = strict TDD, §3.3 pure-`core/` guardrail, vitest + `@vscode/test-electron`.
**⚠ STRICT TDD IS MANDATORY** for any code/bugfix (operator directive — `CLAUDE.md` §"Mandatory development practice" + Learnings #10, #14, #15, #16, #21, #22, #23, #24, #25, #26, **#27**). Pure config/grammar/doc edits with no logic are exempt but still need their normal verification (compile, package, AND — per **Learning #18** — `npm run test:integration` after any `publisher`/`name`/activation change; the suites hard-code the extension ID).

### What You Must Do (recommended: implement Slice 6d-4; operator may redirect)
**Read `docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md` §6 (Slice 6d-4) first.** 6d-4 = **front-matter top-level KEY completion** — inside the `---`…`---` block, offer top-level document keys (`title`, `author`, `format`, `execute`, `bibliography`, `toc`, …). **This is the FIRST slice that needs NEW model surface** (the region model deliberately SKIPS front matter — plan §4 GAP #1): add `findFrontMatter(text)`/`inFrontMatter(text, line)` to the shared `core/qmd/model.ts` (ONE scanner — Learning #14; add the agreement test; fold `core/frontmatter.ts`'s private `---` logic onto it), a `frontmatter-key` branch to `completionContextAt` (top-level only — column-0 key, no parent scan), `SchemaIndex.frontMatterKeys([])` over `schema/document-*.yml` (the 6d-3 reader already loads the file — just add the query + parse the document-* entries; reuse `parseSchemaIndex`'s machinery) + `CURATED_FRONTMATTER_KEYS`, and extend the provider's gate to front matter. **The inverted-gating regression for the FM side is load-bearing** (plan §4.3): no YAML items in prose/cells; the `@` providers still suppressed in front matter — test both directions. **One slice, close out** (FM #18 — do NOT also do 6d-5/values). If the operator instead wants a non-6d item: Phase 7 slices (snippets, image paste, graphviz `{dot}` rendering — Learning #23f), Phase 6e (🐉 offset-mapping), a Polish item (BACKLOG — the new spawn-timeout / cache-retry items are from the 6d-3 review), or the operator-only `vsce publish`.

### Useful starting context
- **★ Phase 6d-3 SHIPPED (Session 20, → Learning #27) — the 6d-4 executor reuses all of this:** `src/core/quarto-paths.ts` `parseSharePath(stdout)` (pure; parses the undocumented `quarto --paths`). `src/core/yaml-schema.ts` now has `parseSchemaIndex(jsonText): SchemaIndex` (pure, NEVER-throws → `CURATED_SCHEMA_INDEX`; helpers `valuesOfSchema`/`indexDefinitions`/`toField`/`engineTag`/`scalarToYaml`/`indexOf`) + `interface SchemaIndex { cellOptions(engine?) }` + `CURATED_SCHEMA_INDEX`. **6d-4 EXTENDS `SchemaIndex` with `frontMatterKeys(parentPath)`** — `parseSchemaIndex` already parses the whole file; just iterate `schema/document-*.yml` entries the same way `toField` handles `cell-*` (the `document-*` keys are currently SKIPPED — line ~`!key.startsWith("schema/cell-")`). `src/quarto/cli.ts` `quartoSharePath()` spawns `--paths` (defensive). `src/features/yaml-schema-source.ts` `createSchemaSource()` → `getIndex(): Promise<SchemaIndex>` (cached once/session, fallback to curated on any failure) — **directly reusable; the provider already awaits it**. `src/providers/yaml.ts` is now **async** and reads `(await source.getIndex()).cellOptions(ctx.engine)` for key+value (gate on `ctx===null` BEFORE awaiting). Tests: `test/unit/quarto-paths.test.ts` (6), `test/unit/yaml-schema-index.test.ts` (23 — uses a synthetic FIXTURE mirroring the real schema shape), `test/integration/suite/yaml.test.ts` (now 18; +2 enrichment tests asserting the schema-only `code-overflow` key+value appear end-to-end). **The real installed schema** is at `/Applications/quarto/share/editor/tools/yaml/yaml-intelligence-resources.json` (probe with python to ground value-resolution; `schema/document-*.yml` holds the 414 front-matter keys 6d-4 needs).
- **★ Phase 6d-2 SHIPPED (Session 19, → Learning #26) — the 6d-3 executor reuses all of this:** `src/core/qmd/model.ts` `findCellOptionLines(text)` returns `{line, cellLang, prefix, keySlot, valueSlot}` — `keySlot`/`valueSlot` are token spans or `null`, both computed in one `slotsOf` pass (`model.ts:357`); `valueSlot` is terminated at an unquoted YAML inline comment, quoted scalars kept intact. `src/core/yaml-context.ts` `completionContextAt(text, offset)` returns a `cell-option-key` OR `cell-option-value` context (`parentPath:[key]` for values) or `null` off-region — **6d-3 does NOT change this; it swaps the DATA source behind the provider**. `src/core/yaml-schema.ts` `SchemaField` (`{name, description?, values?, engine?}`) + `CURATED_CELL_OPTIONS` (~18, grounded names + values + own descriptions) — **6d-3 adds `parseSchemaIndex(jsonText)` and degrades to `CURATED_CELL_OPTIONS`**. `src/providers/yaml.ts` `YamlCompletionProvider` (gated to key+value slots; triggers `| : -`; key items `detail:"Quarto cell option"`, value items `detail:"Quarto cell option value"`; value path prepends a space when the value abuts the colon — `valueItems`); wired in `extension.ts:38`. Tests: `test/unit/cell-option-lines.test.ts` (26), `test/unit/yaml-context.test.ts` (16), `test/unit/yaml-schema.test.ts` (12), `test/integration/suite/yaml.test.ts` (16; uses both the fixture and in-memory `openTextDocument` docs), fixture `test/fixtures/yaml-completion.qmd`.
- **★ Phase 6d plan (Session 17, → Learning #24) — READ THIS FIRST if doing 6d:** `docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md`. The schema dragon is resolved: **runtime-read** the user's Quarto schema from `<share>/editor/tools/yaml/yaml-intelligence-resources.json` (MIT — the CLI, not the AGPL extension; the completion-shaped artifact, NOT the validation-shaped `json-schemas.json`), resolving the share dir via the **undocumented** `quarto --paths` (parse defensively), with a **tiny curated static fallback**; no vendoring → no NOTICE. 6d = **5 vertical slices** (§6): 6d-1 cell-option KEY (start here) → 6d-2 cell-option VALUE → 6d-3 schema reader → 6d-4 front-matter KEY → 6d-5 front-matter VALUE → 6d-6+ 🐉 nested (optional). The plan's §4 is the grep-verified reuse/gaps inventory (file:line), §5 the pure-core interface contracts, §4.3/§7 the inverted provider-gating trap (the new YAML provider is the complement of the `@` providers on the shared `{language:"quarto"}` selector).
- **Phase 7 diagram preview (Session 16, → Learning #23):** `core/diagram-regions.ts` `findDiagramRegions(text)` is pure — a thin FILTER over the shared `findAllCells` (no 2nd scanner), returning `{engine:'mermaid'|'dot', code, startLine, endLine}`; `core/diagram-preview-html.ts` `buildDiagramPreviewHtml` is the pure Mermaid-webview HTML+CSP builder (CSP adds `img-src ${cspSource} data:` for C4/architecture icons — Learning #23e); `features/diagram-preview.ts` is the thin adapter (single reused panel, debounced live re-render). Mermaid (MIT 11.16.0) vendored as the **single** `media/mermaid/mermaid.min.js` (3.56 MB UMD, NOT a devDep — sha256 in `NOTICE`). **Mermaid is rendered; `{dot}` is detected but shown as source + a "not yet rendered" note** — the graphviz-rendering follow-up is its own slice (needs a WASM renderer + `wasm-unsafe-eval`). One deferred shared-model finding (over-detection of glued malformed info strings) is in the `diagram-regions.ts` docstring + BACKLOG.
- **Phase 7 math preview (Session 15, → Learning #22):** `core/math-regions.ts` `findMathRegions(text)` is pure (Pandoc `tex_math_dollars` inline rules + `$$` display; skip-region-aware via `scanRegions`; masks inline code spans); `core/math-preview-html.ts` `buildMathPreviewHtml` is the pure KaTeX-webview HTML+CSP builder; `features/math-preview.ts` is the thin adapter (single reused webview panel, debounced live re-render). KaTeX (MIT) vendored under `media/katex/` (js+css+woff2). Two documented shared-model gaps (mid-line HTML comments) are in the `math-regions.ts` docstring + BACKLOG. Reuse this **pure-detection + pure-HTML-builder + thin-adapter** shape for any webview authoring aid (diagram preview, image paste).
- **Phase 7 formatting toggles (Session 14, → Learning #21):** `core/format-toggle.ts` `toggleFormat(text, selStart, selEnd, marker)` is pure; `features/formatting.ts` is the adapter (wired in `extension.ts`; commands+keybindings in `package.json`). The load-bearing subtlety is the `*`-vs-`**` disambiguation (don't strip a `*` that's part of a `**` run) — guard BOTH outer and inner neighbours. Reuse this pure-core+thin-adapter shape for any new editor-mutation command.
- **`npm audit` posture (Session 13, → Learning #20):** all 7 vulns are dev-only — `dependencies:{}` empty, what ships is the esbuild bundle + static assets, never `node_modules`. Re-evaluate only if a runtime `dependency` is added.
- **All features done — reuse the patterns.** Pure `core/` (`format-toggle`, `frontmatter`, `citations`, `refs`, `qmd/model`, `render-args`, `preview-*`, `version`, `execution-delegate`) is `vscode`-free; adapters live in `features/` + `providers/`; both harnesses (vitest unit + `@vscode/test-electron` integration) are established. `extension.ts` `activate()` wires everything (now incl. `registerMathPreviewFeature` + `registerDiagramPreviewFeature`).
- **Marketplace state (Sessions 11/12):** full metadata is in `package.json` (top block, ~lines 1-45). Runtime extension ID is **`rmsharp.vscode-quarto-ext`** — the 8 integration suites' `EXTENSION_ID` constants hard-code it (**Learning #18: re-run `test:integration` after ANY publisher/name change**). Icon `media/icon.png` (regenerate from `scratchpad/icon.svg` via `rsvg-convert` if needed). `README.md` is the marketplace listing with a `## Screenshots` gallery (5 shots under `media/screenshots/`, excluded from the `.vsix`; render only while the repo is PUBLIC — Learning #19).
- **`microsoft/vscode-markdown-languageservice` (MIT)** is reference only; never copy Posit's AGPL code (licensing hard gate). **Original art only** for icons/branding (Learning #18b).

### How You Will Be Evaluated
The user rates every session's handoff on: (1) was the ACTIVE TASK sufficient to orient? (2) key files with line numbers? (3) gotchas/traps flagged? (4) "what's next" actionable and specific?

---

*Session history accumulates below this line. Newest session at the top.*

### What Session 21 Did — 2026-06-29
**Deliverable:** **Phase 6d Slice 6d-4 — front-matter top-level KEY completion** (IN PROGRESS)
**Started:** 2026-06-29
**Status:** Session claimed. Work beginning — strict TDD, vertical slice (model surface → context → schema → provider → integration), checkpoint commit per layer (plan §6 Slice 6d-4). Load-bearing discovery at orientation: the flat `schema/document-*.yml` name list (378 visible) OMITS pure container keys like `execute` (they live in `schema/schema.yml`'s object structure — recursive resolution, deferred to 6d-6); `execute` stays in the curated fallback with a documented limitation.

### What Session 20 Did — 2026-06-29
**Deliverable:** **Phase 6d Slice 6d-3 — `#|` cell-option SCHEMA READER (the 🐉 dragon slice)**. **COMPLETE + adversarial-review-hardened.** The third 6d slice and the one the plan flagged as the dragon. Cell-option completion now reads the user's INSTALLED Quarto schema and enriches to the full option set with descriptions and value enums resolved from the live schema, **degrading to the curated `CURATED_CELL_OPTIONS` fallback on any failure**. It SWAPS the data source behind the existing provider — detection, the position discriminator, and the inverted gating are unchanged.

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `6f411d8` chore: claim Session 20 (standalone Phase 1B stub).
2. `1c307ce` feat: pure `core/quarto-paths.ts` `parseSharePath` (layer 1) + 6 vitest cases.
3. `46489bb` feat: pure `core/yaml-schema.ts` `parseSchemaIndex` + `SchemaIndex` + `CURATED_SCHEMA_INDEX` (layer 2) + 23 vitest cases across 4 RED→GREEN cycles (extraction → value resolution → engine filter → fallback/BOM).
4. `90fc627` feat: `quarto/cli.ts` `quartoSharePath()` via `quarto --paths` (layer 3).
5. `8d26789` feat: `features/yaml-schema-source.ts` cached load + fallback adapter (layer 4).
6. `d67ecea` feat: wire the async provider to the source (layer 5) + 2 `@vscode/test-electron` enrichment tests; gate-d break-revert performed + reverted.
7. `1a95261` docs: refresh the stale `yaml-schema.ts` module docstring (the one real adversarial-review fix).
8. (this close-out docs commit: SESSION_NOTES + CLAUDE.md Learning #27 + BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**How it was built (strict TDD — operator directive held):** ONE failing test → minimal code → green, one behavior at a time, vertical layers with a checkpoint commit at each of the 5 boundaries (paths-parser → schema-parser → cli → adapter → provider), the full matrix green at each. Genuine REDs shown before GREEN: `parseSharePath` (RED: module missing); `parseSchemaIndex` in 4 sub-cycles (RED: function missing → values undefined → engine unset/no-filter → `CURATED_SCHEMA_INDEX` missing/no-fallback); the provider wiring (RED: the 2 integration enrichment tests got `code-overflow`-absent with the curated provider, then flipped GREEN once wired to the reader). The cli.ts/adapter layers are `vscode`-coupled (no vitest) — verified via compile + the integration host.

**Architecture (plan §5/§6 Slice 6d-3; the §3.3 split held — the slice SWAPS the data source, never the detection):** TWO new pure `vscode`-free core modules — `core/quarto-paths.ts` (`parseSharePath`) and `core/yaml-schema.ts` (`parseSchemaIndex`/`SchemaIndex`/`CURATED_SCHEMA_INDEX`, never-throws → curated) — plus thin adapters `quarto/cli.ts` `quartoSharePath()` (spawn) + `features/yaml-schema-source.ts` (`fs.readFile` + cache once/session + fallback) and an **async** `providers/yaml.ts` that reads `index.cellOptions(engine)`. `completionContextAt`/`findCellOptionLines`/the 6d-2 value surface are untouched.

**The dragon, resolved:** (a) **Value enums resolve from the REAL schema**, not a hand-copy — `column`/`fig-column`/`tbl-column` → `{ref:page-column}` → the 18 `page-column` values from `schema/definitions.yml` — so the recurring Learning #25/#26 transcription trap is structurally ELIMINATED. (b) **Simple value forms only** (`boolean`/`enum`/`anyOf`-of-those/`maybeArrayOf`-of-those/`ref` one hop/`string.completions`); I mirrored `valuesOfSchema` in python over the real 695 KB file and confirmed every deferred form (`arrayOf`, `anyOf`-of-string/number, deep `super`/`resolveRef`) is genuinely non-enumerable → deferring offers nothing, never a wrong value. (c) **Non-string enum values stringify** (`message:[true,false,"NA"]` → `["true","false","NA"]`); **`tags.engine` is string OR list** (`["knitr","jupyter"]`→agnostic). (d) **Engine filtering** (`cellOptions(engine)`): once the full 94-set is read, the benign over-offer of ~3 knitr options becomes ~40 in a `{python}` cell, so knitr-only options are filtered out of jupyter/ojs cells; unknown engine → full set.

**Verification (full matrix green at every layer boundary — vertical-slice gate c):**
- `npm run compile` clean at each layer; `npm run package` → clean **33-file** `.vsix` (1.29 MB); `npm audit` **7** (no new deps — `node:fs` is built-in).
- **`npm test` → 326 unit** (was 297; +29: 6 `parseSharePath` + 23 `parseSchemaIndex`).
- **`npm run test:integration` → 81 integration** (was 79; +2 enrichment), real `@vscode/test-electron` host via `executeCompletionItemProvider`.
- **Phase 3E (runtime smoke test) — SATISFIED via test-electron** (Learning #3): the host activates the extension AND runs the real Quarto CLI (`quarto --paths` + reads the 695 KB schema), so the 2 enrichment tests prove the reader end-to-end. **F5-only residue:** the completion-popup *visual* appearance only.
- **Gate-d degradation PROVEN by break-revert:** with `quartoSharePath` broken (bogus `--paths` arg), the 2 enrichment tests RED (`code-overflow` is schema-only) while `echo`/value completions stayed GREEN from the curated fallback — proving BOTH that the fallback serves AND that the enrichment tests genuinely depend on the reader. Reverted; cli.ts back to its committed state (confirmed via `git status`).
- §3.3 guardrail held: `grep` confirms no `vscode` import in `core/`.

**Adversarial review (per-phase hardening — Learnings #12/#14/#15/#16/#21–#26):** a 5-lens / refute-by-default Workflow (3 refuters/finding; **26 agents, ~1.56M subagent tokens**) raised **7**, confirmed **0** (the FIRST 6d slice with a clean review). **The fidelity lens returned ZERO findings** — corroborating my own python resolver mirrored over the real file: the reader's value resolution is faithful (the dragon's whole point). The one real fix was a **stale module docstring** (`yaml-schema.ts` still described 6d-3 as a future slice) — refreshed (`1a95261`). The other 6 refuted findings I judged independently (refute-by-default applied to my OWN urge to fix) and documented/backlogged rather than over-fixing: a HUNG `quarto --paths` would leave the first completion pending rather than degrade (a PRE-EXISTING project-wide spawn posture — render/preview/`--version` also spawn without a timeout — so a consistent spawn-timeout hardening is BACKLOG, not a 6d-3 spot-fix, FM #18); the load-once cache pins curated after a transient first-load failure (window reload fixes it — BACKLOG); object-form `enum:{values}` is latent/unreachable for 1.7.33 cell options (graceful — BACKLOG); `quarto --paths` added to the upgrade-marker list (this Learning #27).

**🔑 Load-bearing findings (→ CLAUDE.md Learning #27):** the slice swaps the DATA source, not detection; the reader ELIMINATES the transcription trap by resolving enums from real definitions (ground a parser by mirroring it over the REAL data, not just a synthetic fixture); resolve simple value forms only and verify the deferral boundary against the real schema; engine filtering becomes necessary once the full set is read; faithful enrichment tests assert a SOURCE-ONLY item (can't pass via fallback) + break-revert proves degradation (gate d); the undocumented `quarto --paths` joins the upgrade-marker list; runtime-read needs no NOTICE; an async provider must gate on `ctx===null` BEFORE awaiting.

**Key files:**
- `src/core/quarto-paths.ts` — `parseSharePath(stdout)` (NEW; defensive — last `…/share` line, else last non-empty).
- `src/core/yaml-schema.ts` — `parseSchemaIndex`/`SchemaIndex`/`CURATED_SCHEMA_INDEX` + helpers (`valuesOfSchema`/`indexDefinitions`/`toField`/`engineTag`/`scalarToYaml`/`indexOf`); top-of-file docstring refreshed.
- `src/quarto/cli.ts` — `quartoSharePath()` (NEW; spawns `--paths`).
- `src/features/yaml-schema-source.ts` — `createSchemaSource()`/`SchemaSource`/`loadSchemaIndex` (NEW; cached load + fallback).
- `src/providers/yaml.ts` — provider now async, reads `(await source.getIndex()).cellOptions(ctx.engine)`; `valueItems` takes the engine-filtered fields.
- `test/unit/quarto-paths.test.ts` (6) / `test/unit/yaml-schema-index.test.ts` (23) / `test/integration/suite/yaml.test.ts` (18; +2 enrichment) — NEW/extended.

**Gotchas for the next session:**
1. **No forced next deliverable — WAIT for the operator to pick** (FM #2/#13). Recommended is 6d-4 (front-matter KEY), but don't auto-start.
2. **`master` is AHEAD of `origin`** (Sessions 17–19's + this session's ~10 commits, UNPUSHED). Pushing is the operator's call; offer it, don't assume.
3. **6d-4 needs NEW model surface** — `findFrontMatter`/`inFrontMatter` in the shared `core/qmd/model.ts` (the region model SKIPS front matter — plan §4 GAP #1; ONE scanner, Learning #14, + the agreement test; fold `frontmatter.ts`'s `---` logic). Then a `frontmatter-key` context, `SchemaIndex.frontMatterKeys([])` over `schema/document-*.yml` (the reader already loads the file — `parseSchemaIndex` currently SKIPS non-`cell-*` keys; add the document-* path), `CURATED_FRONTMATTER_KEYS`, and extend the provider gate. Inverted-gating regression both directions.
4. **The schema reader caches once per session** — a Quarto upgrade needs a window reload (documented limitation). A HUNG `quarto --paths` is the pre-existing no-spawn-timeout posture (BACKLOG: a project-wide spawn-timeout pass; do NOT spot-fix it in a feature slice, FM #18).
5. **`refs.ts` `CELL_LABEL_OPTION` consolidation is STILL deferred** (the 6d-2 follow-up) — a cross-module change, its own pass (FM #18). The new BACKLOG Polish items (spawn-timeout, cache-retry, object-form-enum) are all from this session's review.
6. **`quarto --paths` + `parseSchemaIndex`'s schema-shape assumptions are Quarto-version-coupled** — re-verify against the installed schema on a Quarto upgrade (Learnings #4/#8/#11/#25/#27).
7. **`EXTENSION_ID` is still duplicated in 12 integration suite files** (de-dup is a separate Polish item, Learning #18).

**Self-assessment (Session 20): 9/10.**
- **+** Held strict TDD faithfully — genuine RED before GREEN for every logic increment across 5 layers (module-missing, the 4 `parseSchemaIndex` sub-cycles, the 2 integration enrichment tests RED on the curated provider before wiring). Checkpoint-committed at each of the 5 layer boundaries (≤5 files), full matrix green at each. Made a standalone Phase 1B stub commit. Kept the §3.3 guardrail (two new pure `vscode`-free core modules) and reused the 6d-2 surface intact (no new scanner). **The headline win: I grounded the parser against the REAL installed schema firsthand (a python mirror of `valuesOfSchema`, diffed) BEFORE the review — anticipating the fidelity lens, which then found 0 defects.** The reader STRUCTURALLY eliminates the recurring transcription trap (Learnings #25/#26) by resolving enums from real definitions — the discipline "anticipate the review, don't rely on it" (S14–S19) finally produced a 0-confirmed review. Proved gate-d degradation with a clean break-revert that demonstrated both the fallback AND the enrichment-test faithfulness at once. Applied refute-by-default to my OWN fix urges (Learning #22): fixed the one real doc defect, documented/backlogged the rest with honest rationale instead of over-fixing or spot-fixing the cross-cutting hang. Held FM #18 cleanly (no 6d-4 bleed; the spawn-timeout correctly deferred).
- **−** Engine filtering broadened scope slightly beyond a pure "swap the data source" — it changes the curated path's behavior too (previously unfiltered). I judged it necessary (the full set makes over-offer non-benign) and it broke no existing test, but a stricter reading of "one capability" could flag it; I documented the rationale. The load-once cache (vs the plan's "cache by version") leaves the transient-failure-pinning + hung-spawn edges (both refuted/low, documented + BACKLOG) — a more robust cache would have closed them in-slice, a defensible-but-not-maximal v1 choice. And the per-phase review ran AFTER all 5 layers; its 0-confirmed result largely VALIDATED the self-grounding I did myself — the python-mirror was the primary safeguard, the review the corroboration.

#### Session 19 Handoff Evaluation (by Session 20) — Phase 3A
**Score: 10/10.** The strongest kind of handoff: it turned the 🐉 dragon slice into "swap exactly this data source behind these named surfaces, in the established idiom, and prove degradation" — with zero rediscovery and no inaccuracy that survived orientation. The dragon was genuinely pre-resolved (Session 17's plan + Session 19's pointer), so I never re-derived the schema source/licensing.
- **What helped:** The ACTIVE TASK's "What You Must Do" named **Slice 6d-3's exact scope** — `quartoSharePath()` via the undocumented `--paths` (parse defensively, add to the marker list), a pure never-throw `parseSchemaIndex` (BOM-strip, the SIMPLE value forms `boolean`/`enum`/`anyOf`/`maybeArrayOf`/`ref`→`definitions`, defer deep `super`/`resolveRef`, exclude `hidden`, read `tags.engine`), the adapter with fallback, the break-revert gate-d test, "do NOT vendor", "one slice close out" — which mapped 1:1 onto what I built. Gotcha #3 ("6d-3 swaps the DATA source behind the provider — does NOT change `completionContextAt`/`findCellOptionLines`/the gating") was the single most load-bearing framing of the session: it told me to keep the slice surgical. The "Useful starting context" bullet gave the exact reuse surfaces (`SchemaField` shape, the provider's `detail` discriminators, the test files + counts). Baselines (297/79, 33-file `.vsix`, audit 7) all matched reality at orientation.
- **What was missing (not Session 19's fault — left to implementation by design):** the handoff couldn't know the implementation-time discoveries (engine filtering becoming necessary with the full set; the exact real schema shapes — non-string enums, `tags.engine` as a list, `string.completions`). The plan §2.2 flagged the DSL forms at a high level; the firsthand probe filled the rest. Nothing 6d-3-specific was absent.
- **What was wrong:** Two minor, both defensible: (1) the handoff said "cache keyed by `quarto --version`" — I implemented load-once-per-session caching instead (simpler, correct; version-keying deferred as a documented limitation; the plan §5.3 called for version-keying, a refinement). (2) The recurring stale-by-orientation item: "`master` is AHEAD of `origin`… confirm with `git status`" — it was indeed ahead (18 commits), so I re-verified rather than assuming (FM #4). Nothing materially wrong.
- **ROI:** Strongly positive — the pre-resolved dragon + the exact-scope 6d-3 pointer + the "swaps data not detection" framing + the reuse inventory let me land the dragon slice as a surgical data-source swap with a 0-confirmed review, without rediscovery.

### What Session 19 Did — 2026-06-28
**Deliverable:** **Phase 6d Slice 6d-2 — `#|` cell-option VALUE completion (curated enums/booleans)**. **COMPLETE + adversarial-review-hardened.** The second 6d slice. After a known cell-option key's colon, typing on a `#|` (python/r/julia) or `//|` (ojs/js) line inside an executable cell now offers that option's **value** enum from a curated set, gated to fire ONLY in the value slot (after the colon). The runtime schema reader is the later 6d-3 — this ships the curated value enums 6d-3 will enrich/replace.

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `811bba9` chore: claim Session 19 (standalone Phase 1B stub) — fixed the S17/S18 self-critique (a separate stub commit, not folded into the first feature commit).
2. `1372b9e` feat: `valueSlot` on `findCellOptionLines` (model `slotsOf` computes key+value spans in one pass) + 7 vitest value-slot behaviors; 4 existing `.toEqual` shape-locks updated.
3. `a4ce476` feat: `cell-option-value` branch in `completionContextAt` (parentPath=[key], whole-token replaceRange) + 6 vitest value-context behaviors.
4. `bcd89e1` feat: curated `values` on `CURATED_CELL_OPTIONS` (grounded against live Quarto 1.7.33) + 8 vitest value-enum guards.
5. `0f05a83` feat: cell-option VALUE handling in `providers/yaml.ts` (value items, leading-space normalization) + 8 `@vscode/test-electron` tests (positive + inverted-gating negatives, RED baseline established).
6. `cc51fa8` fix: restore dropped `page-inset` to the curated column enum + tighten the column test to exact full-enum equality (review finding A).
7. `f9b6bf6` fix: exclude a trailing YAML inline comment from the value slot (review finding B) + model/context/integration regression tests.
8. (this close-out docs commit: SESSION_NOTES + CLAUDE.md Learning #26 + BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**How it was built (strict TDD — operator directive held):** ONE failing test → minimal code → green, one behavior at a time, vertical layers with a checkpoint commit at each boundary (model → context → data → provider), the full matrix green at each. Genuine REDs shown before GREEN: `valueSlot` (RED: field `undefined`), `cell-option-value` context (RED: 4 value tests returned null), curated `values` (RED: 6 enum guards failed), the provider (RED: the 4 positive integration tests got `[]` while the 4 negative-gating tests passed trivially — the positive+negative control baseline, Learning #16d), and both review fixes (RED: column `toEqual` failed on 17-of-18; the 2 comment tests spanned the comment). The 4 shape-lock `.toEqual` updates (adding `valueSlot` to the returned object) were flagged honestly as mechanical shape consequences, not behavior REDs.

**Architecture (plan §5/§6 Slice 6d-2; the §3.3 split held — the slice EXTENDS 6d-1, never rebuilds):** pure **`core/qmd/model.ts`** gained `valueSlot` (one `slotsOf` pass with `keySlot`; comment-terminated, quote-aware) — still a VIEW over `findAllCells`, no 2nd scanner (Learning #14) + pure **`core/yaml-context.ts`** gained the `cell-option-value` branch + pure **`core/yaml-schema.ts`** gained grounded `values` + thin **`providers/yaml.ts`** gained the value path. Both core modules import **zero `vscode`**.

**The inverted provider-gating contract (plan §4.3) — value side:** `completionContextAt` returns a value context ONLY in the value slot, so the provider yields no value items at the key, in prose/code, in front matter, for an unknown key, or inside a trailing comment, while the `@` providers still fire in prose. Proven by the RED baseline: the negative-gating integration tests passed before the provider handled values AND after (no leak); the positive value tests flipped RED→GREEN via the `detail==="Quarto cell option value"` discriminator.

**Valid-YAML-on-accept:** the `:` trigger can fire before a space is typed (`#| echo:`), so the adapter prepends a space when the value slot abuts the colon (`lineText[startCol-1]===":"`) → `#| echo: true`, not `#| echo:true`. `filterText` is kept bare (no leading space) so fuzzy matching still works.

**Adversarial review (the per-phase hardening step — Learnings #12/#14/#15/#16/#21/#22/#23/#25/#26):** a 5-lens / refute-by-default Workflow (3 refuters/finding; ~1.07M subagent tokens, 17 agents) raised **4**, confirmed **4** (all low, 3/3 refuters each — disciplined lenses), refuted **0**. The 4 findings collapse to **2 distinct defects** (the `page-inset` one surfaced via 3 lenses — edge/faithful/fidelity). Fixed both test-first:
- **(low, fixed) curated `page-column` enum was 17 of 18** — I dropped the base `page-inset` transcribing my own correct probe output (the Learning #25 trap recurring). My `column` test used a 4-value `toContain` spot-check (unlike its `toEqual` siblings), so it missed it. Restored `page-inset` (re-verified firsthand against `definitions.yml`) AND tightened the test to full-enum exact equality.
- **(low, fixed) `slotsOf` swallowed a trailing inline comment** (`#| echo: false  # note` → value span covered `false  # note`), so values popped while editing the comment and accepting one clobbered it. Fixed to terminate the value at an unquoted whitespace-preceded / value-start `#` (YAML comment rule); quoted scalars kept intact (deferred). + model/context/integration regressions.

**Verification (full matrix green at every layer boundary — vertical-slice gate c):**
- `npm run compile` clean (tsc + esbuild) at each layer.
- **`npm test` → 297 unit** (was 273; +24: 7 value-slot + 3 comment/quoted model + 6 value-context + 1 comment context + 8 value-enum; net of the 1 removed "null at value" test and the 4 shape-lock updates).
- **`npm run test:integration` → 79 integration** (was 70; +9 value tests), all in a real `@vscode/test-electron` host via `executeCompletionItemProvider`. **Faithful (gate d):** positive value cases RED→GREEN; the inverted-gating negatives faithful via the RED baseline; edge cases (no-space leading space, unknown key, prose colon, inline comment) on in-memory `openTextDocument` docs proven to genuinely exercise the registered provider (the positive in-memory cases flipped RED→GREEN).
- `npm run package` → clean **33-file** `.vsix` (1.29 MB; the new core is bundled into `dist/extension.js`). `npm audit` unchanged at **7** (no new deps).
- **Phase 3E (runtime smoke test) — SATISFIED via test-electron** (Learning #3): the integration suite activates the extension in a real host and exercises the value provider end-to-end. **F5-only residue:** the completion-popup *visual* appearance (theme/icon) is not headlessly assertable; behavior/wiring is integration-proven.
- §3.3 guardrail held: `grep` confirms no `vscode` import in `core/`.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #26):** the slice extends 6d-1's three-piece split (valueSlot in the same `slotsOf` pass — no new scanner); value completion must emit valid YAML on accept (prepend a space when the value abuts the colon, decided in the adapter, `filterText` bare); **ground enum values against the installed schema AND pin them with EXACT-equality tests — a `toContain` spot-check hid a 17-of-18 transcription error (Learning #25 recurred)**; a value-token detector must stop at an unquoted inline comment; in-memory `openTextDocument` docs are the clean way to integration-test provider edge cases (proven to fire the real provider).

**Key files:**
- `src/core/qmd/model.ts` — `CellOptionLine.valueSlot` (interface at `:174`, field at `:195`); `slotsOf` (`:371`, replaces `keySlotOf`, computes both spans, comment-terminated).
- `src/core/yaml-context.ts` — `completionContextAt` value branch (`cell-option-value`, `parentPath:[key]`).
- `src/core/yaml-schema.ts` — `CURATED_CELL_OPTIONS` `values` (+ `BOOL`/`PAGE_COLUMNS` consts).
- `src/providers/yaml.ts` — `valueItems` (curated lookup + leading-space), `valueItem`, `keyItem` (renamed from `toCompletionItem`).
- `test/unit/cell-option-lines.test.ts` (26) / `test/unit/yaml-context.test.ts` (16) / `test/unit/yaml-schema.test.ts` (12) / `test/integration/suite/yaml.test.ts` (16) — extended.

**Gotchas for the next session:**
1. **No forced next deliverable — WAIT for the operator to pick** (FM #2/#13). Recommended is 6d-3 (the dragon slice), but don't auto-start.
2. **`master` is AHEAD of `origin`** (Sessions 17–18's + this session's ~9 commits, UNPUSHED). Pushing is the operator's call; offer it, don't assume.
3. **6d-3 swaps the DATA source behind the provider** — it does NOT change `completionContextAt`/`findCellOptionLines`/the provider gating. Add `quartoSharePath()` + pure `parseSchemaIndex` + an adapter that caches by version and degrades to `CURATED_CELL_OPTIONS`. Prove degradation by break-revert (gate d). `quarto --paths` is undocumented — parse defensively, add to the upgrade-marker list (Learnings #4/#8/#11).
4. **`refs.ts` `CELL_LABEL_OPTION` consolidation is STILL deferred** — 6d-2 did NOT route refs' `label:` extraction through `findCellOptionLines` (that cross-module change stays its own pass, FM #18 / SAFEGUARDS no cross-module refactor without plan mode). `refs.ts` still has the looser leading-`\s*` that would index an indented `  #| label:` Quarto treats as code. (BACKLOG Polish.)
5. **`EXTENSION_ID` is still duplicated in 12 integration suite files** (the `yaml.test.ts` const, unchanged this session) — de-dup is a separate Polish item (Learning #18).
6. **`CELL_OPTION_PREFIX` + the value-slot comment rule are Quarto-syntax-coupled** — re-verify against the installed source on a Quarto upgrade.

**Self-assessment (Session 19): 9/10.**
- **+** Held strict TDD faithfully — genuine RED before GREEN for every logic increment (valueSlot field-missing, the 4 value-context nulls, the 6 enum-guard fails, the provider's 4 positive integration `[]`, and both review fixes), and flagged the 4 mechanical `.toEqual` shape-lock updates + the data-guard tests honestly rather than dressing them as REDs. Kept the §3.3 guardrail (two pure `vscode`-free core modules) and Learning #14 (valueSlot computed in the SAME `slotsOf` pass — no 2nd scanner). Checkpoint-committed at each of the 4 layer boundaries (≤5 files), full matrix green at each. **Made a standalone Phase 1B stub commit** — fixing the exact self-critique S17 and S18 both flagged. Grounded the value enums in firsthand schema facts. Ran the per-phase adversarial review and it earned its keep again — it caught a **real Quarto-fidelity defect** (a dropped `page-column` value) AND the **weak test that let it through** (a `toContain` spot-check among `toEqual` siblings), plus a real value-slot-vs-comment defect, all fixed test-first; I re-verified the `page-inset` finding firsthand against the schema before fixing. Held the FM #18 boundary cleanly (no 6d-3 bleed; left the refs consolidation deferred).
- **−** The `page-inset` omission was MY transcription error — I had the correct 18-value probe output in front of me when I wrote `PAGE_COLUMNS` and dropped one, AND I wrote a weaker `toContain` test for `column` than the `toEqual` I used for every other enum, so my own test couldn't catch it. The recurring "anticipate the review, don't rely on it" lesson (S14/S15/S16/S18), now applied to *self-consistency of test strength*: had I used exact equality for `column` like its siblings from the start, my own RED would have caught the drop before the review. The inline-comment value-slot gap is a defensible v1 edge (uncommon on `#|` lines) but a reasonable critic could have wanted it handled in the first pass given the value-slot was new code I authored this slice.

#### Session 18 Handoff Evaluation (by Session 19) — Phase 3A
**Score: 10/10.** The strongest handoff I've inherited in this project — it turned 6d-2 into "extend exactly these four named surfaces in the established idiom and harden," with zero rediscovery and no inaccuracies that survived orientation.
- **What helped:** The ACTIVE TASK's "What You Must Do" named **Slice 6d-2's exact scope** — extend `completionContextAt` for the value position it "currently returns null on, PAST the colon", add a value-slot to `CellOptionLine`, add curated `values`, handle the value kind + `:` trigger in the provider, add the inverted-gating regression — which mapped 1:1 onto what I built. The "Useful starting context" bullet gave the precise reuse sites with line numbers (`CELL_OPTION_PREFIX` at `model.ts:319`, the provider's `detail`-discriminator + `{inserting,replacing}` contract, the exact test files + counts), so I knew the idiom to mirror before reading a line. Gotcha #3 ("6d-2 extends `completionContextAt` for the VALUE position … cursor PAST the colon") was exactly the core change. Gotcha #4 pre-flagged the deferred `refs.ts` consolidation so I correctly left it alone (FM #18). Baselines (273/70, 33-file `.vsix`, audit 7) all matched reality at orientation. The Learning #25 write-up's "match the tool's ACTUAL syntax verified against the installed source" primed me to probe the schema for real enum values up front — which is exactly the discipline that *should* have also caught my transcription slip (the lesson held; my execution of it didn't).
- **What was missing (not Session 18's fault — left to implementation by design):** the handoff couldn't know the two implementation-time edges the review found (the leading-space-on-`:` need, the inline-comment value-slot gap); both are reasonable to discover in-slice. Nothing 6d-2-specific was absent.
- **What was wrong:** One stale-by-orientation item, the recurring pattern: the handoff predicted `master` "AHEAD of `origin` … confirm with `git status`"; it was indeed ahead (9 commits), so I re-verified rather than assuming (FM #4). The Session-18 self-noted "engine non-filtering" benign over-offer is still present and still defensibly deferred. Nothing materially wrong.
- **ROI:** Strongly positive — the exact-scope 6d-2 pointer + the file:line reuse inventory + the §4.3 priming let me ship + harden the slice as a clean extension of 6d-1 without rediscovery.

### What Session 18 Did — 2026-06-28
**Deliverable:** **Phase 6d Slice 6d-1 — `#|` cell-option KEY completion (curated set)**. **COMPLETE + adversarial-review-hardened.** The first 6d slice. Typing on a `#|` (python/r/julia) or `//|` (ojs/js) option line inside an executable cell now offers cell-option **key** suggestions from a curated set; gated to fire ONLY in a key slot (the inverse of the `@` providers' prose gate). The runtime schema reader is the later 6d-3 — this slice ships the curated fallback that 6d-3 will degrade to.

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `faa4cf4` feat: `findCellOptionLines` view in the shared `core/qmd/model.ts` (G2) + Phase 1B stub + 12 vitest behaviors.
2. `b2829bb` feat: pure `core/yaml-context.ts` `completionContextAt` (cell-option-key only, G3) + 10 vitest behaviors.
3. `a027bb9` feat: `SchemaField` + `CURATED_CELL_OPTIONS` in `core/yaml-schema.ts` (~18 grounded names, own descriptions) + 4 guard tests.
4. `8347287` feat: `providers/yaml.ts` `YamlCompletionProvider` + `extension.ts` wiring + 7 `@vscode/test-electron` tests (incl. the no-cross-pollination regression).
5. `369e656` fix: the 3 confirmed adversarial-review findings, all test-first.
6. (this close-out docs commit: SESSION_NOTES + CLAUDE.md Learning #25 + BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**How it was built (strict TDD — operator directive held):** ONE failing test → minimal code → green, one behavior at a time, vertical layers with a checkpoint commit at each boundary. Genuine REDs shown before GREEN: `findCellOptionLines` (RED: function missing), `completionContextAt` (RED: module missing), the provider (RED: the two "completes keys" integration tests got `[]` — provider unregistered — while the negative-gating tests passed trivially), and the 5 review-fix tests (RED: indented over-detected / `# |` not detected). The 4 `yaml-schema` guard tests are honestly green-on-add (curated data, TDD-exempt but guarded). The extra `findCellOptionLines` coverage cases (prefix variants, exclusions) were green-on-add coverage locks, flagged as such.

**Architecture (plan §5/§6 Slice 6d-1; the §3.3 split held):** pure **`core/qmd/model.ts` `findCellOptionLines`** (a VIEW over the shared `findAllCells` — never a 2nd scanner, Learning #14; only interior lines of executable cells, so a `#|` in prose / a non-executable ```` ```python ```` block / a fence line is never reported) + pure **`core/yaml-context.ts` `completionContextAt`** (the position discriminator: `cell-option-key` context or `null`) + pure **`core/yaml-schema.ts`** (curated data) + thin **`providers/yaml.ts`** adapter. Both core modules import **zero `vscode`**.

**The inverted provider-gating contract (plan §4.3) — the load-bearing bit:** `completionContextAt` returns `null` everywhere except a key slot, so the YAML provider yields no items in prose/code/value/front matter while the `@` providers still fire in prose. **Faithfulness is proven by the RED baseline itself:** the no-cross-pollination integration tests were GREEN before the provider existed (trivially) and STAYED green after wiring it (no leak), while the positive test flipped RED→GREEN via the same `detail === "Quarto cell option"` discriminator — positive + negative controls in one transition (Learning #16d).

**Adversarial review (the per-phase hardening step — Learnings #12/#14/#15/#16/#21/#22/#23):** a 5-lens / refute-by-default Workflow (3 refuters/finding; ~2.1M subagent tokens, 29 agents) raised **8**, confirmed **3** (all low), refuted **5**. Fixed all 3 test-first:
- **(low, fixed) indented `#|`/`//|` over-detected:** Quarto anchors the option directive at column 0 (`/^#\s*\| ?/`); my first `CELL_OPTION_PREFIX`'s leading `(\s*)` offered completion on an indented `  #| echo` that Quarto treats as code. Tightened to `/^(#|\/\/)([ \t]*)\|([ \t]*)(.*)$/`.
- **(low, fixed) `# |` under-detected:** Quarto's `\s*` allows whitespace between the comment char and the pipe; my regex required adjacency. Same fix matches both (and normalizes the reported prefix). Both verified against `/Applications/quarto/.../web-worker.js` `optionCommentPattern` + an empirical `quarto render`.
- **(low, fixed) two "skip-region agreement" unit tests trivially green:** their fenceless fixtures passed for the "no cell" reason, never exercising skip-region handling. Replaced with fixtures nesting a real `{python}` cell INSIDE front matter / an HTML comment; proven faithful by **break-revert** (disabling the skip turns them RED, then reverted).
- **Refuted (correctly out of scope):** non-contiguous-`#|` over-detection (benign, not §4.3); prefix/language-agnostic matching (per the plan contract); a missing front-matter `@`-suppression test (behavior already guarded by the 6b/6c in-cell suites); the `refs.ts` `CELL_LABEL_OPTION` duplication (consolidation is the deferred 6d-2 follow-up).

**Verification (full matrix green at every layer boundary — vertical-slice gate c):**
- `npm run compile` clean (tsc + esbuild) at each layer.
- **`npm test` → 273 unit** (was 242; +31: 16 cell-option-lines + 11 yaml-context + 4 yaml-schema; net of the 2 replaced skip-region tests).
- **`npm run test:integration` → 70 integration** (was 63; +7 yaml), all in a real `@vscode/test-electron` host via `executeCompletionItemProvider`. **Faithful (gate d):** positive (keys complete on a `#|` line) + negative (no items in prose/code/value/front matter) controls share the `detail` discriminator; the RED baseline established no-leak.
- `npm run package` → clean **33-file** `.vsix` (1.29 MB; `vsce ls` count unchanged — the new core is bundled into `dist/extension.js`, the fixture is excluded). `npm audit` unchanged at **7** (no new deps).
- **Phase 3E (runtime smoke test) — SATISFIED via test-electron** (Learning #3): the integration suite activates the extension in a real host and exercises the provider end-to-end (registration + dispatch + gating). **F5-only residue:** the actual completion-popup *visual* appearance (theme/icon) is not headlessly assertable; behavior/wiring is integration-proven.
- §3.3 guardrail held: `grep` confirms no `vscode` import in `core/`.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #25):** the 6d-1 detector is a view over `findAllCells` (Learning #14 holds); the inverted-gating contract is enforced by `completionContextAt` returning `null` off-region, with the RED baseline as the faithfulness proof; **match the tool's ACTUAL syntax pattern verified against its installed source, not a hand-written guess** (the review caught both over- and under-detection from my first regex); a skip-region-agreement test for a cell-interior view must embed a real cell in the skip region (break-revert it); the curated set is grounded in real schema names with own descriptions (license-clean, permanent fallback).

**Key files:**
- `src/core/qmd/model.ts` — `findCellOptionLines` (NEW; `CellOptionLine` interface; `CELL_OPTION_PREFIX` at line 319 aligned to Quarto's pattern; `keySlotOf` helper).
- `src/core/yaml-context.ts` — `completionContextAt`, `YamlCompletionContext`, `engineFor`, `lineColAt` (NEW; cell-option-key only — value/front-matter kinds reserved for later slices).
- `src/core/yaml-schema.ts` — `SchemaField` + `CURATED_CELL_OPTIONS` (NEW; ~18; `engine` tag on knitr-only options).
- `src/providers/yaml.ts` — `YamlCompletionProvider` + `registerYamlCompletionProvider` (NEW). `src/extension.ts:38` — wired.
- `test/unit/cell-option-lines.test.ts` (16) / `test/unit/yaml-context.test.ts` (11) / `test/unit/yaml-schema.test.ts` (4) / `test/integration/suite/yaml.test.ts` (7) / `test/fixtures/yaml-completion.qmd` — NEW.

**Gotchas for the next session:**
1. **No forced next deliverable — WAIT for the operator to pick** (FM #2/#13). Recommended is 6d-2, but don't auto-start.
2. **`master` is AHEAD of `origin`** (Session 17's 2 + this session's ~6 commits, UNPUSHED). Pushing is the operator's call (prior sessions left it to the operator); offer it, don't assume.
3. **6d-2 extends `completionContextAt`** for the VALUE position it currently returns `null` on (cursor PAST the colon). Add a value-slot to `CellOptionLine`, curated `values` to `CURATED_CELL_OPTIONS`, handle the value kind + `:` trigger in the provider. Reuse the 6d-1 shape + the inverted-gating `detail`-discriminator regression.
4. **`refs.ts` `CELL_LABEL_OPTION` still has the loose leading-`\s*`** (it would index an indented `  #| label: fig-x` that Quarto treats as code) — a pre-existing latent looseness, now diverging from the Quarto-faithful `model.ts CELL_OPTION_PREFIX`. The `refs.ts`↔`model.ts` cell-option-prefix consolidation is the deferred **6d-2 follow-up** (BACKLOG Polish; cross-module → don't do it ad-hoc, FM #18).
5. **`CELL_OPTION_PREFIX` is Quarto-syntax-coupled** — re-verify against `quarto --paths`'s `.../editor/tools/yaml/web-worker.js` `optionCommentPattern` on a Quarto upgrade (same posture as the `Browse at`/`Output created` markers — Learnings #4/#8/#11).
6. **`EXTENSION_ID` is now duplicated in 12 integration suite files** (the new `yaml.test.ts` copies the const; was 11) — de-dup is still a separate Polish item (Learning #18).
7. **`quarto --paths` / the runtime schema reader is NOT wired yet** — that's 6d-3. 6d-1/6d-2 ship the curated fallback only.

**Self-assessment (Session 18): 9/10.**
- **+** Held strict TDD faithfully — genuine RED before GREEN for every logic increment (`findCellOptionLines` function-missing, `completionContextAt` module-missing, the provider via the two integration tests getting `[]`, and all 5 review-fix tests), and I flagged the green-on-add coverage locks + the TDD-exempt curated-data guard tests honestly rather than dressing them as REDs. Kept the §3.3 guardrail (two pure `vscode`-free core modules) and Learning #14 (the detector is a VIEW over `findAllCells`, not a 2nd scanner, with a real skip-region agreement test). Checkpoint-committed at each layer boundary (≤5 files), full matrix green at each. **Grounded the curated set in firsthand facts** (probed the live Quarto schema for real option names, wrote my own descriptions → license-clean). Ran the per-phase adversarial review and it earned its keep again — it caught a **real two-directional Quarto-fidelity bug** (indented `#|` over-detected, `# |` under-detected) and a **gate-d over-claim in my own tests**, all fixed test-first; I proved the replacement skip-region tests faithful by break-revert and confirmed the review's refutations were correctly out of scope. Held the FM #18 boundary cleanly (no 6d-2/6d-3 bleed).
- **−** The two confirmed Quarto-fidelity findings were defects in MY first `CELL_OPTION_PREFIX` — I hand-wrote a plausible `#|` regex instead of checking Quarto's actual `optionCommentPattern` against the installed source first (the plan dragons said "rely on the `#|`/`//|` prefix", which I took too literally). A 2-minute check of Quarto's directive regex up front would have pre-empted both — the recurring "anticipate the review, don't rely on it" lesson (S14/S15/S16), now applied to *matching a tool's real syntax*. The two trivially-green skip-region tests were also my own over-claim (fenceless fixtures labeled "skip-region agreement"). And — same minor miss Session 17 flagged about itself — I folded the Phase 1B stub into the first feature commit rather than a standalone stub commit (it was checkpoint-committed with the first feature, so a crash would still have left a trace, but a separate commit is the stronger signal). Engine non-filtering (a knitr-only option offered in a python cell) is a defensible plan-accepted benign over-offer for 6d-1, but a reasonable critic could want it filtered now.

#### Session 17 Handoff Evaluation (by Session 18) — Phase 3A
**Score: 9/10.** Accurate, honest, and load-bearing exactly where executing the first 6d slice needed it — it turned this into "implement the smallest slice in the established idiom and harden it," not rediscovery. The dragon was genuinely pre-resolved, so I never had to re-derive the schema source.
- **What helped:** The ACTIVE TASK named **Slice 6d-1 as the recommended deliverable with its exact scope** — `findCellOptionLines` (G2), `completionContextAt` (G3, cell-option-key only), `CURATED_CELL_OPTIONS`, `providers/yaml.ts` gated + the no-cross-pollination regression, wire in `extension.ts` — which mapped 1:1 onto what I built. The pointer to **read the plan §6 first** + the plan's grep-verified §4 reuse/gaps inventory (file:line) gave me the exact reuse sites (`crossrefCompletionContext`/`citationCompletionContext` as the `{start,typed,end}` template, the `{inserting,replacing}` range trick, provider registration, `isReferenceableLine` as the gate to complement). The **§4.3 inverted-gating trap** was flagged in three places (ACTIVE TASK, plan, gotchas), so I built the no-cross-pollination test from the start. The §9 Q1 **curated-set seed list** was a good starting point I confirmed/refined against the live schema. Baselines (242/63, 33-file `.vsix`, audit 7) all matched reality. The "strict TDD mandatory" + FM #18 reminders kept scope honest.
- **What was missing (not Session 17's fault — left to implementation by design):** the plan's dragons said "rely on the `#|`/`//|` prefix" but did not flag that Quarto's directive is **column-0-anchored with `\s*` between `#` and `|`** (`optionCommentPattern`) — so a naive prefix regex over-/under-detects. A reasonable implementation-time detail, and the adversarial review caught it; but a one-line "match Quarto's `^#\s*\| ?`, verify against the installed source" note would have pre-empted my regex bug.
- **What was wrong:** One stale-by-orientation item, the recurring pattern: the handoff predicted the Session-17 commits "may be unpushed — confirm `git status`"; they were indeed unpushed (2 commits), so I re-verified rather than assuming (FM #4). The plan's "`EXTENSION_ID` duplicated in 11 suites" was correct at the time (my new `yaml.test.ts` makes it 12). Nothing materially wrong.
- **ROI:** Strongly positive — the pre-resolved dragon + the exact-scope 6d-1 pointer + the file:line reuse inventory + the §4.3 priming let me ship + harden the slice without rediscovery.

### What Session 17 Did — 2026-06-28
**Deliverable:** **Phase 6d spike + implementation plan** (YAML/`#|` cell-option completion). **COMPLETE.** A PLANNING session — the operator chose "Spike + plan" over implement-now (the parent plan's 🐉 "flag at planning of that session" gate, line 329, governs). Resolved the schema-source dragon and wrote **`docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md`**. **No code — implementation is later sessions (FM #18/#19).** 6e is out of scope (separate session, parent plan line 334).

**What was done (single close-out commit — planning deliverable):**
- Phase 1B stub claimed the session; the orientation report + the operator's "Spike + plan" answer set the deliverable.
- Firsthand grounding: located the Quarto CLI install (`/Applications/quarto/share`), found the schema artifacts, read `COPYING.md`/`COPYRIGHT` (MIT), inspected `schema/*.yml` (Quarto DSL), `json-schemas.json` (validation), and `yaml-intelligence-resources.json` (completion-shaped); probed both compiled files in python to pick the source; spot-verified the repo reuse/gaps inventory (file:line) in `src/`.
- A **7-agent investigate+adversarially-verify Workflow** (4 grounded investigators: schema-artifact, vendor-vs-runtime, repo-inventory, completion-contexts; 3 refute-by-default skeptics: licensing, scope-split, schema-stability). ~454K subagent tokens.
- Wrote the plan (the deliverable). Updated `BACKLOG.md` (split 6d/6e; 6d now PLANNED with the slice breakdown + 6d-1 start pointer), `CHANGELOG.md`, `CLAUDE.md` (Learning #24), and these `SESSION_NOTES`.

**The dragon, resolved (the whole point of the session):**
- **Licensing CONFIRMED MIT-clean** (the licensing skeptic tried 4 refutation angles, all failed): the schema ships in the Quarto **CLI** share dir (MIT, Posit; no carve-out for `schema/` or `editor/tools/yaml/`) — the Learning #1 CLI-vs-AGPL-extension line. **Runtime-read needs no NOTICE** (we redistribute nothing); vendoring *would* require one.
- **Artifact: `yaml-intelligence-resources.json`** (completion-shaped: `[{name, schema, description, tags.engine}]`, 97 cell + 414 doc keys), NOT `json-schemas.json` (validation schema keyed by type names — lacks the grouping/tags/descriptions). **Grounded by a probe I ran myself after Agent A returned a degenerate stub — and it FLIPPED the stability skeptic's durability-based preference.**
- **Runtime-read** the user's own install (zero drift, +0 `.vsix` bytes, no NOTICE) via the **undocumented** `quarto --paths` (absent from `--help` → parse defensively, like the `Browse at` marker) + a **tiny curated static fallback** (never "no fallback"; completion-only, never-throw).
- **Scope: 6d is ~5 capabilities, not one** (the scope skeptic REFUTED "one capability"): two cost axes — position detector (cell reuses `findAllCells`; front-matter needs NEW model surface) × schema subset/value-interpreter (key vs value vs nested). Sliced **one-context-per-session, vertical**: 6d-1 cell-option KEY (smallest, first) → 6d-2 cell-option VALUE → 6d-3 schema reader (dragon slice) → 6d-4 front-matter KEY → 6d-5 front-matter VALUE → 6d-6+ 🐉 nested (optional).

**Verification (planning deliverable — explicit, not silently skipped):**
- **No code/asset/`package.json` changed** → unit/integration baselines unchanged at **242/63** (definitionally; not re-run, nothing they cover changed).
- **Phase 3E (runtime smoke test): N/A by design** — pure documentation, no runtime/extension behavior changed; nothing to launch-verify (FM #24 — stated, not a silent skip).
- Planning "build equivalent": the plan's file:line inventory (§4) was **grep-verified firsthand** this session (model front-matter skip, `isReferenceableLine`/provider gating, `cli.ts` `--version`-only, the `#|` regex, `EXTENSION_ID` in 11 suites — one correction to the agent's "12"). The plan's cross-refs to the parent plan (§5.3, §6, lines 329/334) were checked against the source.
- Planning Session Checklist (SESSION_RUNNER): deepest reasoning set ✓; plan with file paths+lines ✓; evidence-based inventory ✓ (§4); per-slice completion criteria + verification commands ✓ (§6); each slice = separate session w/ STOP ✓.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #24):** the schema source is MIT (CLI, not the AGPL extension); pick the completion-shaped artifact (probe before choosing); prefer runtime-read for version-drifting data (defensive parse of the undocumented `--paths` + curated fallback); a "LARGE 🐉" phase is usually several capabilities (decompose along position-detector × schema-subset axes); the inverted provider-gating trap; and — process — verify a degenerate delegated result firsthand before enshrining it.

**Key files:**
- `docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md` — **the deliverable.** §2 schema decision, §3 scope, §4 grep-verified inventory (file:line), §5 interface contracts, §6 the 5 slices (per-slice DONE/verify/dragons/boundary), §7 risks, §8 alternatives, §9 open questions, §10 quick-ref.
- `BACKLOG.md` — 6d now PLANNED (slice breakdown + 6d-1 pointer); 6e split out. `CHANGELOG.md` — Session 17 planning entry. `CLAUDE.md` — Learning #24.
- (Reference, not changed) the Quarto schema at `/Applications/quarto/share/editor/tools/yaml/yaml-intelligence-resources.json` (the runtime-read target) + `src/core/qmd/model.ts`, `src/core/refs.ts`, `src/providers/crossref.ts`, `src/quarto/cli.ts` (the reuse/gap sites — see plan §4).

**Gotchas for the next session:**
1. **READ the 6d plan first** (`docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md`). The dragon is resolved — do NOT re-derive it. Start with **Slice 6d-1** (cell-option KEY, curated — the schema reader is 6d-3, not 6d-1).
2. **ONE slice per session** (FM #18). 6d-1 ships `#|` cell-option key completion and closes out; do NOT also do values (6d-2) or the reader (6d-3).
3. **The inverted provider-gating trap (plan §4.3):** the new YAML provider shares the `{language:"quarto"}` selector with the `@` providers — it must fire ONLY in front matter + `#|`/`//|` lines and return `undefined` in prose/cells. Every provider-touching slice needs a no-cross-pollination regression test.
4. **`quarto --paths` is undocumented** (not in `--help`) — when 6d-3 wires it, parse defensively and add it to the "re-verify on Quarto upgrade" list (Learnings #4/#8/#11).
5. **Strict TDD** for every slice (operator directive). Pure core (`yaml-context`, `yaml-schema`, model additions) unit-tested headlessly (vitest); the provider via `@vscode/test-electron` `executeCompletionItemProvider`. Re-run the **full** integration suite (Learning #18).
6. **`EXTENSION_ID` is duplicated in 11 integration suite files** — a 6d suite copies the const (de-dup is a separate Polish item, Learning #18).
7. **Confirm push state** — this session's commit may be unpushed; prior sessions left pushing to the operator. (The Session 16 handoff's "unpushed" prediction was already pushed by orientation — same stale-by-orientation pattern; re-verify with `git status`.)
8. **Phase 6e stays separate** (parent plan line 334) — don't fold it into 6d.

**Self-assessment (Session 17): 9/10.**
- **+** Held the planning boundary cleanly: the operator's "Spike + plan" answer + the parent plan's 🐉 gate made this a plan, not code, and I did NOT bleed into implementation (FM #18/#19) — one deliverable, the plan. **Resolved the dragon on grounded firsthand facts, not guesses:** read the actual `COPYING.md`/`COPYRIGHT`, probed both schema artifacts in python, grep-verified the reuse/gaps inventory in `src/` (caught the agent's "12 suites" → actual 11). Used a workflow well — the three refute-by-default skeptics each **changed the plan** (licensing attribution nuance; scope decomposed 6d into 5 slices, pre-empting an FM #26 mega-session; stability flagged `--paths` undocumented + the curated fallback). **Caught and recovered from a degenerate sub-agent result** (Agent A returned a stub for the load-bearing artifact question) by running the probe myself — which flipped a recommendation (the validation-shaped `json-schemas.json` was the wrong source). The plan satisfies every Planning Session Checklist item (evidence inventory with file:line, per-slice completion criteria + verification, explicit session boundaries, here-be-dragons) and treats Phase 3E honestly (N/A-by-design with the reason).
- **−** Did NOT make a separate Phase 1B "WIP stub" *commit* (prior sessions did) — I wrote the stub to disk but folded it into the single close-out commit; defensible for a one-commit planning session (a crash would have left the stub on disk), but the separate commit is the stronger trace and I should have made it. Agent A's degenerate return cost a little (I had to backfill its job), though the workflow's redundancy (B/D/verifiers also inspected the artifacts) covered most of it — a tighter schema for A or a cheaper, more constrained probe-prompt might have avoided the stub. The plan is long; an executor in a hurry could skip to §6 and miss the §4.3 gating trap — I mitigated by repeating it in the BACKLOG + gotchas. And the curated-fallback contents (§9 Q1) and the `schema`-field value-interpreter depth (§9 Q2) are left as executor open-questions rather than pinned — defensible (they're slice-time decisions) but a reasonable critic could want the curated list enumerated.

#### Session 16 Handoff Evaluation (by Session 17) — Phase 3A
**Score: 9/10.** Accurate, honest, and — crucially for this session — it **pre-flagged the exact fork I had to resolve**, which is what let me correctly run this as a planning session instead of stumbling into implement-first.
- **What helped:** The ACTIVE TASK option list named *"Phase 6d/6e (YAML/cell-option completion 🐉needs a YAML-schema-source decision — likely a spike/plan first)"* — that single parenthetical, plus the inherited Session-14 gotcha *"Phase 6d likely needs a planning/spike first… don't start it as a pure implementation session without resolving that,"* is precisely why I treated the operator's "Phase 6d" as a planning fork and asked rather than coding. The "WAIT for the operator to pick" framing + FM #18 reminder kept the scope honest. The baselines (242 unit / 63 integration, 33-file `.vsix`, audit 7) all matched reality at orientation. The pointer to the parent plan's §5.3/§6 + the §3.3 guardrail oriented the architecture work.
- **What was missing (not Session 16's fault — this work didn't exist):** nothing 6d-specific; the entire 6d design (schema source, artifact choice, slice decomposition, gating trap) was mine to derive — now captured in the plan + Learning #24.
- **What was wrong:** One stale-by-orientation item, identical to the recurring pattern: Gotcha #2 predicted *"`master` is ahead of `origin` and UNPUSHED"*; by orientation `git status` read up-to-date (the operator had pushed). Not a defect — state moved on; I re-verified rather than trusting the note (FM #4).
- **ROI:** Strongly positive — the pre-flagged dragon + accurate baselines turned this into "resolve the known dragon and plan it well," not rediscovery.

### What Session 16 Did — 2026-06-28
**Deliverable:** **Phase 7 (v2) — diagram preview webview** (`Quarto: Preview Diagram` / `quarto.previewDiagram`). **COMPLETE + adversarial-review-hardened.** The third v2 webview feature. Detects ```` ```{mermaid} ```` and ```` ```{dot} ```` diagram cells in a `.qmd`; renders each Mermaid cell in a webview (beside the editor) with vendored Mermaid (MIT), re-rendering live as the tracked document changes. Graphviz (`{dot}`) cells are detected but shown as source + a "not yet rendered" note (graphviz rendering = its own future slice).

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius, except the one inert-asset vendoring commit):**
1. `7b2c2a1` chore: claim Session 16 (WIP stub).
2. `eff976f` feat: pure `core/diagram-regions.ts` — a thin filter over the shared `findAllCells` (no 2nd scanner) + 10 vitest behaviors (mermaid + dot are the TDD drivers; the rest are coverage locks).
3. `3d513c0` feat: pure `core/diagram-preview-html.ts` (Mermaid webview HTML + nonce CSP) + 6 vitest behaviors (CSP is the RED→GREEN driver, pinned exact-equality, break-revert verified).
4. `7575cfe` build: vendor Mermaid 11.16.0 (MIT) — the single 3.56 MB `mermaid.min.js` into `media/mermaid/` + NOTICE (NOT a devDep; sha256 recorded). One atomic inert-asset commit.
5. `27d1151` feat: `quarto.previewDiagram` adapter (`features/diagram-preview.ts`) + `extension.ts` wiring + `package.json` command + 6 `@vscode/test-electron` tests. RED shown live (command-not-found before wiring).
6. `e570e9a` fix: the 3 confirmed adversarial-review findings fixed test-first (CSP `img-src`; two honest test renames) + 1 documented deferral.
7. (this close-out docs commit: SESSION_NOTES + CLAUDE.md Learning #23 + BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**How it was built (strict TDD — operator directive held):** ONE failing test → minimal code → green, repeated. Genuine REDs shown before GREEN for every logic-bearing increment: `{mermaid}` detection (RED: module missing), `{dot}` detection (RED: dot returns `[]` until the filter is generalized to a membership check), the CSP lockdown (RED: module missing; later the `img-src` fix RED'd before the directive was added), and the adapter (RED: all 6 integration tests `command 'quarto.previewDiagram' not found` before wiring). Coverage-only locks (the 8 detection discriminators inherited from the shared scanner; the builder's script-tag/JSON/escape/empty-state assertions) were flagged honestly as green-on-add, not manufactured as fake REDs.

**Architecture (plan §6 Phase 7 "diagram-preview webview"; mirrors the Learning-#22 math shape exactly):** the §3.3 split held end to end — **pure `core/diagram-regions.ts`** (`findDiagramRegions` = `findAllCells(text).filter(engine ∈ {mermaid,dot})` — reuses the shared `scanRegions`/`findAllCells`, so diagrams are never found in YAML/comments/prose and the non-executable cell forms are excluded for free) + **pure `core/diagram-preview-html.ts`** (Mermaid webview HTML + strict nonce CSP) + **thin `features/diagram-preview.ts`** adapter (single reused panel, re-target on re-invoke, debounced live update; `asWebviewUri` for the vendored bundle, `localResourceRoots`=`media/mermaid`). Both core modules import **zero `vscode`**.

**Adversarial review (the project's per-phase hardening step — Learnings #12/#14/#15/#16/#21/#22):** a 6-lens / refute-by-default Workflow (3 skeptics/finding) raised **4**, confirmed **4** (3/3 refuters each — disciplined lenses, 0 spurious). Fixed **3** test-first; **1** documented as a principled cross-cutting deferral:
- **(low, fixed) CSP `img-src` gap:** the CSP omitted `img-src`, so Mermaid **C4 / architecture-beta** diagrams' inert `data:image` icons (SVG `<image>`) fell through to `default-src 'none'` and silently broke (flowchart/sequence/class have none). Fixed: `img-src ${cspSource} data:` (data: images can't execute → safe; scripts stay strictly nonce-only). CSP test extended RED→GREEN, stays exact-equality per directive (gate d).
- **(medium, fixed) gate-d test over-claim — re-render:** the "re-renders on edit" integration test's only assertion was panel-count, which proves no-stacking, NOT re-render. Renamed the test + comment to what it proves (edit→debounce path runs without stacking/crash; webview content is F5 residue, covered by the pure units).
- **(low, fixed) gate-d test over-claim — discrimination:** the "mermaid vs dot" unit test asserted two **static template** strings (present whenever regions≠[]) — proves presence, not engine discrimination (the per-engine branch runs CLIENT-SIDE). Renamed to say so.
- **(low, documented) over-detection of glued malformed info strings:** `findDiagramRegions` reports a diagram for `{mermaid=x}`/`{dot=1}`/`{mermaid#id}`/`{mermaid.foo}` (Quarto renders none as diagrams) because the **shared `CELL_INFO`** captures the first token greedily then accepts trailing garbage. The faithful fix tightens that scanner (also feeds outline/run-cell/math/refs; must keep knitr `{r,echo=FALSE}`) → cross-cutting, its own TDD pass (SAFEGUARDS: no cross-module refactor without plan mode). Documented in the `diagram-regions.ts` docstring + BACKLOG.

**Verification (full matrix green at every layer boundary — vertical-slice gate c):**
- `npm run compile` clean (tsc + esbuild).
- **`npm test` → 242 unit** (was 226; +16: 10 diagram-regions + 6 diagram-preview-html, incl. the review-driven `img-src`).
- **`npm run test:integration` → 63 integration** (was 57; +6 diagram-preview), all in a real `@vscode/test-electron` host. **Faithful (gate d):** they register the command, open an in-memory `.qmd` with a `{mermaid}` cell, run `quarto.previewDiagram`, and assert a webview tab opened via `vscode.window.tabGroups` + `TabInputWebview` (single-panel reuse; edit→no-stacking; non-quarto no-op). No Quarto CLI / kernel needed.
- `npm run package` → clean **33-file** `.vsix` (**1.29 MB**); `vsce ls` confirms `media/mermaid/mermaid.min.js` ships with **no** `node_modules`/`src`/`test`/`.map`/`.claude` leak.
- **`npm audit` unchanged at 7** (Mermaid added 0 — vendored as a single file, not a devDep; Learning #20 posture preserved).
- **Phase 3E (runtime smoke test) — SATISFIED via test-electron** (Learning #3). **F5-only residue:** the actual Mermaid SVG *visual* render inside the webview and scroll behavior aren't headlessly assertable (no API reads another panel's HTML) — content correctness is covered by the pure `findDiagramRegions` + `buildDiagramPreviewHtml` units; behavior/wiring is integration-proven.
- §3.3 guardrail held: `core/diagram-regions.ts` and `core/diagram-preview-html.ts` import no `vscode`.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #23):**
- Diagram detection is a pure FILTER over the shared `findAllCells` — never a 2nd scanner (Learning #14).
- Vendoring a large pre-bundled UMD lib: verify it's self-contained (0 runtime `import(`, `self`-based global, dead `Function("return this")` fallback) → no `'unsafe-eval'` needed → classic nonce'd `<script src>` + strict CSP works. Vendor the **single file** with sha256/version/URL in `NOTICE`, **skip the heavy devDep** (keeps `node_modules` + audit posture clean — unlike KaTeX).
- Diagram CSP needs `img-src ${cspSource} data:` (C4/architecture-beta data: icons) — broader than math's KaTeX CSP.
- Scope a heavy multi-renderer feature to ONE engine per slice (mermaid rendered, dot detected+placeholder); graphviz rendering is its own WASM slice.
- Name tests for what they PROVE — a panel-count assertion ≠ re-render proof; a `toContain` on a static template ≠ discrimination proof (gate d).

**Key files:**
- `src/core/diagram-regions.ts` — pure `findDiagramRegions` (NEW). `DIAGRAM_ENGINES`/`engineFor` filter over `findAllCells`. Docstring carries the deferred over-detection limitation.
- `src/core/diagram-preview-html.ts` — pure `buildDiagramPreviewHtml` (NEW): CSP (incl. `img-src … data:`) + Mermaid `<script nonce src>` + an inline nonce'd script that `mermaid.initialize({securityLevel:'strict', theme})` then per region `await mermaid.render(id, code)` (mermaid) or shows source + note (dot).
- `src/features/diagram-preview.ts` — the adapter (NEW): `DiagramPreviewManager` (single panel, `show`/`onDocumentChanged` debounced 200 ms/`render`/`dispose`), `registerDiagramPreviewFeature`.
- `src/extension.ts` — `registerDiagramPreviewFeature(context)` added to `activate()`. `package.json` — `quarto.previewDiagram` command.
- `media/mermaid/mermaid.min.js` — vendored Mermaid 11.16.0 (NEW, sha256 `74d7c46d…fb9b`). `NOTICE` — Mermaid MIT attribution + provenance.
- `test/unit/diagram-regions.test.ts` (10) / `test/unit/diagram-preview-html.test.ts` (6) / `test/integration/suite/diagram-preview.test.ts` (6) — NEW.

**Gotchas for the next session:**
1. **No forced next deliverable — WAIT for the operator to pick** (FM #2/#13). Don't auto-start another slice.
2. **`master` is ahead of `origin` and UNPUSHED** (this session's 7 commits). Pushing is the operator's call (prior sessions left it to the operator); offer it, don't assume.
3. **`vsce publish` is an OPERATOR step** (Marketplace publisher `rmsharp` + PAT). You can't do it.
4. **The `.vsix` jumped 368 KB → 1.29 MB** — that's the vendored Mermaid (`media/mermaid/`, 3.56 MB on disk, compresses ~3× in the zip). Expected, not a leak; `npm audit` is unchanged (Mermaid added 0 — single file, no devDep). To refresh: re-download the pinned tarball, verify MIT, re-copy `dist/mermaid.min.js`, update version+sha256 in NOTICE (see NOTICE).
5. **The diagram webview's visual render is F5-only residue** — the integration suite proves the panel opens/reuses/updates, but the Mermaid SVG glyphs want a manual F5 to eyeball (isolate the dev host with `--disable-extensions`, Learning #19, since the user has Posit's `quarto.quarto` installed). **F5 is also the only way to confirm the strict-CSP/no-`unsafe-eval` claim renders correctly in the real webview** — it's statically verified (0 `import(`, dead `Function` fallback) but never visually confirmed in-session.
6. **Graphviz rendering is the natural follow-up slice** (BACKLOG "Up Next"): `{dot}` is already detected; add a vendored WASM dot renderer (`@viz-js/viz` or `@hpcc-js/wasm`) + a `script-src … 'wasm-unsafe-eval'` CSP branch + extend `buildDiagramPreviewHtml`'s dot path. Its own TDD slice.
7. **One deferred shared-model finding** (over-detection of glued malformed info strings) lives in `core/diagram-regions.ts`'s docstring + BACKLOG — it affects ALL `findAllCells` consumers (outline/run-cell/math/refs), so the fix is a `CELL_INFO` change (its own TDD pass), NOT a diagram-preview follow-up. (Same shape as Session 15's mid-line-comment deferral.)
8. **The math-preview "re-render on edit" integration test has the SAME over-claim** this review flagged in diagram-preview (panel-count ≠ re-render proof) — added to BACKLOG Polish; not touched this session (FM #8/#18, another feature's code).
9. **`dashboard_history.jsonl` changes whenever you run the dashboard** — fold it into the close-out dashboard-refresh commit. The "critical" risk flag is still the 7 dev-only `npm audit` vulns (Learning #20), not this feature.

**Self-assessment (Session 16): 9/10.**
- **+** Held strict TDD faithfully (genuine RED shown before GREEN for mermaid-detect, dot-detect, the CSP, the `img-src` fix, and the whole adapter via live "command not found"; flagged green-on-add coverage locks honestly). Kept the §3.3 guardrail (two pure, `vscode`-free core modules) and the pure-detection + pure-builder + thin-adapter split, reusing the shared `findAllCells` rather than writing a third scanner (Learning #14). **Made the load-bearing scope/vendoring decisions on grounded facts, not guesses:** verified the Mermaid UMD bundle is self-contained (0 runtime `import(`, `self`-based global, dead `Function` fallback) BEFORE committing to the strict-CSP classic-script approach, and deliberately vendored the single file without the heavy devDep to preserve the documented audit posture. Scoped to one engine (mermaid) with an honest dot placeholder rather than over-reaching into a second WASM renderer (recoverability ceiling; FM #8/#18 held). Ran the per-phase adversarial review and it earned its keep again — it caught a **real CSP gap** (C4 icons) and **two gate-d test over-claims** my 22 happy-path tests missed — each fixed test-first; verified the CSP faithfully by break-revert. Checkpoint-committed at each layer boundary (≤5 files), full matrix green at each.
- **−** Two of the three review findings were over-claims in MY OWN tests (the panel-count re-render assertion and the static-template discrimination assertion) — and the panel-count one is a pattern I inherited verbatim from the math-preview test without questioning it; a sharper "what does this assertion actually prove?" pass while writing the integration test would have pre-empted both (the recurring "anticipate before the review" lesson from S14/S15). The deferred over-detection finding ships documented-but-unfixed (defensible — cross-cutting/low-severity), and the graphviz half of "mermaid/graphviz" is a placeholder this slice (honest, but a reasonable critic could want both engines). And the strict-CSP-renders claim is statically verified but not F5-confirmed (inherent headless residue).

#### Session 15 Handoff Evaluation (by Session 16) — Phase 3A
**Score: 9/10.** Accurate, honest, and load-bearing on exactly what building a third webview feature needed — it turned this into "build one well-scoped feature in the established idiom, then harden it," not rediscovery.
- **What helped:** The ACTIVE TASK's "WAIT for the operator to pick" + the explicit option list made the FM #18 boundary obvious and pre-empted FM #2. The **"reuse the math-preview webview shape"** pointer (Learning #22: pure detection + pure HTML/CSP builder + thin adapter, vendored MIT asset, faithful `tabGroups` verification) was the precise orientation — it pointed me straight at the four files to mirror (`core/math-regions.ts`, `core/math-preview-html.ts`, `features/math-preview.ts`, and the math integration test), and I reused their exact structure (debounce, nonce CSP, `localResourceRoots`, the `</script>`-escape). The baselines (226 unit / 57 integration, 32-file `.vsix`, audit 7) all matched reality at start. Crucially, Session 15's framing of **the adversarial review as the per-phase hardening step that catches what happy-path tests miss** primed me to run it — and it caught 4 real findings again.
- **What was missing / discovered (not Session 15's fault — this work didn't exist):** nothing diagram-specific; the whole feature design (the `{mermaid}`/`{dot}` cell-detection-as-filter, the large-pre-bundled-lib vendoring + self-containment check, the `img-src`-for-C4 CSP nuance, the one-engine-per-slice scoping) was mine to derive — now captured in Learning #23.
- **What was wrong:** One stale-by-the-time-I-read-it item, identical to the S14→S15 pattern: the handoff said "`master` is ahead of `origin` — unpushed"; by orientation the operator had pushed, so `git status` read up-to-date. Not a defect (state moved on); I re-verified rather than trusting the note (FM #4). Everything else (baselines, operator-only-publish caveat, the reuse pointers, the gate-d CSP/break-revert discipline) held.
- **ROI:** Strongly positive — the accurate baselines + the reuse pointers + the "run the adversarial review" priming were exactly what let me ship + harden a new webview feature in-idiom.

### What Session 15 Did — 2026-06-28
**Deliverable:** **Phase 7 (v2) — math preview webview** (`Quarto: Preview Math` / `quarto.previewMath`). **COMPLETE + adversarial-review-hardened.** The second v2 feature. Detects inline `$…$` and display `$$…$$` LaTeX in a `.qmd` and renders every region in a webview (beside the editor) with vendored KaTeX (MIT), re-rendering live as the tracked document changes.

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius, except the one inert-asset vendoring commit):**
1. `fa0b4cc` chore: claim Session 15 (WIP stub).
2. `79f8e29` feat: pure `core/math-regions.ts` + 16 vitest behaviors (TDD red→green each).
3. `f2e669c` feat: pure `core/math-preview-html.ts` (KaTeX webview HTML + nonce CSP) + 5 vitest behaviors.
4. `78f138a` build: vendor KaTeX 0.16.x (MIT) into `media/katex/` (js+css+20 woff2, ~588 KB) + NOTICE + `katex` devDep (one atomic vendoring commit — CSS is inert without its fonts).
5. `2575bcb` feat: `quarto.previewMath` adapter (`features/math-preview.ts`) + `extension.ts` wiring + `package.json` command + 5 `@vscode/test-electron` tests.
6. `5ef2ceb` fix: exclude inline code spans (adversarial finding) — relocated `maskInlineCode` to the shared `core/qmd/model` (one impl, Learning #14); + documented the mid-line-comment gaps.
7. `589b3e9` fix: debounce live re-render + pin CSP `script-src` exactly in the unit test (two adversarial findings).
8. (this close-out docs commit: SESSION_NOTES + CLAUDE.md Learning #22 + BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**How it was built (strict TDD — operator directive held):** ONE failing test → minimal code → green, repeated. RED shown before GREEN for every behavior that added logic: the 16 `core/math-regions` behaviors (basic inline; display single/multi-line; the Pandoc inline rule set — open-after-nonspace, close-before-nonspace, close-not-before-digit, `\$` escaping; skip-regions via `scanRegions`; the inline-code-span exclusion fix), the 5 HTML-builder behaviors, and the 5 adapter integration behaviors (RED'd live: "command not found" before wiring). Coverage-only/green-on-add cases (ordering, empty input, the backtick-preserve regression lock) were flagged transparently, not manufactured as fake REDs.

**Architecture (plan §6 Phase 7 "math-preview webview `previewMath`"):** the §3.3 split held end to end — **pure `core/math-regions.ts`** (delimiter detection; Pandoc rules; consumes the shared `scanRegions` so math is never found in YAML/comments/cells; masks inline code spans) + **pure `core/math-preview-html.ts`** (KaTeX webview HTML + CSP) + **thin `features/math-preview.ts`** adapter (single reused panel, re-target on re-invoke, debounced live update; `asWebviewUri` for the vendored assets). Both core modules import **zero `vscode`**.

**Adversarial review (the project's per-phase hardening step — Learnings #12/#14/#15/#16/#21):** a 5-lens / refute-by-default Workflow raised **14**, confirmed **5** (≥2/3 refuters traced a real repro), refuted 9. Fixed **3** test-first; **2** documented as principled shared-model deferrals:
- **(medium, fixed) inline code-span phantom:** `` `$x$` `` in prose was reported as math. Fixed by reusing the SAME masking `refs.ts` already does — relocated `maskInlineCode` to the shared `core/qmd/model` so both consumers share one impl (Learning #14). Detect on the masked copy; slice content from the unmasked source (length-preserving mask) so a real backtick inside math survives.
- **(high, fixed) CSP test faithfulness (gate d):** the only CSP test used `toContain`, so appending `'unsafe-inline'` to `script-src` stayed green. Fixed: parse the directives, assert `script-src` EXACTLY equals the nonce; **verified faithful by break-revert** (weakened the impl → test RED → reverted).
- **(medium, fixed) no debounce:** `onDidChangeTextDocument` reloaded the whole webview (losing scroll) on every keystroke. Fixed: coalesce to one render per 200 ms idle; timer cleared on dispose. New integration test drives a real edit → re-render.
- **(medium, documented) mid-line HTML comments ×2:** `scanRegions` classifies comments per WHOLE line, so a comment that opens mid-line (`text <!--`) still yields math inside it, and real math after a mid-line `-->` is missed. This is a **shared-model gap (also affects `refs`)**; fixing it is a cross-cutting `scanRegions` change needing its own TDD pass (FM #18 / SAFEGUARDS "no cross-module refactor without plan mode"). Documented in the `math-regions.ts` docstring + BACKLOG.
- **The review also prevented an unnecessary change:** the refuters correctly REFUTED my own U+2028/2029 "script-breakout" worry (those are valid in ES2019+ `<script>` string literals on the webview's modern Chromium) and the indented-code phantom (already a documented model limitation). Refute-by-default applied to my OWN hypotheses, not just the primary code.

**Verification (full matrix green at every layer boundary — vertical-slice gate c):**
- `npm run compile` clean (tsc + esbuild).
- **`npm test` → 226 unit** (was 202; +24: 19 math-regions [incl. 3 review-driven] + 5 html-builder; the CSP test was strengthened in place, not added).
- **`npm run test:integration` → 57 integration** (was 51; +6 math-preview, incl. the edit→re-render path), all in a real `@vscode/test-electron` host. **Faithful (gate d):** they register the command, open an in-memory `.qmd`, run `quarto.previewMath`, and assert a webview tab opened via `vscode.window.tabGroups` + `TabInputWebview` (single-panel reuse; non-quarto no-op; edit→re-render). No Quarto CLI / kernel needed.
- `npm run package` → clean **32-file** `.vsix` (368.5 KB); `vsce ls` confirms `media/katex/**` ships (22 files) with **no** `node_modules`/test/src/`.claude` leak.
- **Phase 3E (runtime smoke test) — SATISFIED via test-electron** (Learning #3). **F5-only residue:** the actual KaTeX *visual* rendering inside the webview and the scroll behavior are not headlessly assertable (no API to read another panel's HTML) — content correctness is covered by the pure `findMathRegions` + `buildMathPreviewHtml` unit tests; behavior/wiring is integration-proven. Consistent with every prior phase's visual residue.
- §3.3 guardrail held: `core/math-regions.ts` and `core/math-preview-html.ts` import no `vscode`.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #22):**
- A body-line consumer MUST mask inline code spans (reuse the shared `maskInlineCode`); detect on the masked copy, slice content from the unmasked source.
- Mid-line HTML comments are a `scanRegions` whole-line gap (cross-cutting; defer to its own pass).
- KaTeX vendoring: MIT, ship js+css+**woff2-only** (the CSS lists woff2 first so Chromium picks it), `media/**` ships by default; this is a webview ASSET, not a bundled runtime `dependency`, so it does NOT trip Learning #20.
- Webview CSP: `script-src 'nonce-…'` (no `unsafe-inline`); `style-src ${cspSource} 'unsafe-inline'` (KaTeX needs inline element styles); `font-src ${cspSource}`. Pin it with parsed-directive **exact-equality** + break-revert, not `toContain` (gate d).
- Verify a webview opened via `tabGroups`/`TabInputWebview` (no API reads another panel's HTML → visual render is F5 residue).

**Key files:**
- `src/core/math-regions.ts` — pure `findMathRegions` (NEW). Branch order per `$`: escaped→skip; `$$`→display (find next `$$`, multi-line); else inline (open-after-nonspace guard → `findInlineClose` with the close rules). `contiguousRuns` groups body lines so display math can't cross a skip region; `scan(detect, source, …)` detects on masked text, slices content from source.
- `src/core/math-preview-html.ts` — pure `buildMathPreviewHtml` (NEW): CSP + KaTeX `<link>`/`<script nonce>` + regions-as-JSON (with `<`→`<`) + empty-state.
- `src/features/math-preview.ts` — the adapter (NEW): `MathPreviewManager` (single panel, `show`/`onDocumentChanged` debounced/`render`/`dispose`), `registerMathPreviewFeature`.
- `src/core/qmd/model.ts` — `maskInlineCode` + `INLINE_CODE_SPAN` relocated here (now exported, shared by refs + math-regions).
- `src/extension.ts` — `registerMathPreviewFeature(context)` added to `activate()`. `package.json` — `quarto.previewMath` command + `katex` devDep.
- `media/katex/**` — vendored KaTeX (NEW). `NOTICE` — KaTeX MIT attribution.
- `test/unit/math-regions.test.ts` (19) / `test/unit/math-preview-html.test.ts` (5) / `test/integration/suite/math-preview.test.ts` (6) — NEW.

**Gotchas for the next session:**
1. **No forced next deliverable — WAIT for the operator to pick** (FM #2/#13). Don't auto-start another slice.
2. **`master` is ahead of `origin` and UNPUSHED** (this session's ~8 commits). Pushing is the operator's call (prior sessions left it to the operator); offer it, don't assume.
3. **`vsce publish` is an OPERATOR step** (Marketplace publisher `rmsharp` + PAT). You can't do it.
4. **The `.vsix` jumped 30 KB → 368 KB** — that's the vendored KaTeX (`media/katex/`, ~588 KB on disk, woff2-only). Expected, not a leak; `npm audit` is unchanged (katex added 0 vulns). To refresh KaTeX: re-copy `katex.min.js`/`katex.min.css`/`fonts/*.woff2` from `node_modules/katex/dist` and re-verify MIT (see NOTICE).
5. **Two documented shared-model gaps** (mid-line HTML comments) live in `core/math-regions.ts`'s docstring + BACKLOG — they affect `refs` too; fixing them is a `scanRegions` change (its own TDD pass), NOT a math-preview follow-up.
6. **The math webview's visual render is F5-only residue** — the integration suite proves the panel opens/reuses/updates, but the KaTeX glyphs and scroll behavior want a manual F5 to eyeball (isolate the dev host with `--disable-extensions`, Learning #19, since the user has Posit's `quarto.quarto` installed).
7. **`dashboard_history.jsonl` changes whenever you run the dashboard** — fold it into the close-out dashboard-refresh commit. The "critical" risk flag is still the 7 dev-only `npm audit` vulns (Learning #20), not this feature.

**Self-assessment (Session 15): 9/10.**
- **+** Held strict TDD faithfully (RED shown before GREEN for all logic-bearing behaviors, incl. the 3 review fixes; flagged green-on-add coverage cases honestly). Kept the §3.3 guardrail (two pure, `vscode`-free core modules) and the pure-detection + pure-builder + thin-adapter split, so the bulk is headlessly unit-tested and the adapter is faithfully integration-tested through the real host (gate d — `tabGroups`, not a force-activating happy-path-only suite). Ran the project's per-phase adversarial review and it earned its keep AGAIN: it caught a **silent false-positive** (inline-code-span math) and a **gate-d test hole** (the `toContain` CSP test) and a real UX defect (no debounce) that my 26 happy-path tests missed — and I fixed each test-first (the CSP fix verified by break-revert). Notably the refuters also **stopped me from over-fixing** (U+2028/2029). Reused `maskInlineCode` rather than duplicating (relocated to the shared model — Learning #14). Vendored KaTeX cleanly (MIT/NOTICE/woff2-only, confirmed it ships). Checkpoint-committed at each layer boundary, full matrix green at each. One deliverable; resisted scope-creeping into the shared comment model (documented #3/#4 instead — FM #8/#18 held).
- **−** I could have anticipated the inline-code-span phantom *before* the review: `refs.ts` already masks for exactly this reason, and a body-line consumer mirroring `refs` should have masked from the start — the review caught it, but a sharper "what does the sibling consumer guard against?" pass would have pre-empted a review cycle (same lesson Session 14 noted). The two mid-line-comment gaps ship documented-but-unfixed; defensible (cross-cutting, blast radius) but a reasonable critic could argue the false-negative (missed math after `-->`) deserved a fix. And the live-update integration test asserts panel-persistence + path execution, not webview *content* (unassertable headlessly) — honest, but weaker than the pure-core coverage.

#### Session 14 Handoff Evaluation (by Session 15) — Phase 3A
**Score: 9/10.** Accurate, honest, and it correctly framed this as a clean operator-pick fork (no forced next deliverable), which is exactly what let me scope to a single capability.
- **What helped:** The ACTIVE TASK's "WAIT for the operator to pick" + the explicit option list made the FM #18 boundary obvious and pre-empted FM #2. The **"reuse the patterns"** pointer (Learning #21: pure-core + thin-adapter, faithful real-editor integration tests, strict TDD with `/tdd`) was precisely the orientation needed to build a new feature in-idiom — it pointed me straight at the files to mirror (`features/formatting.ts`, `features/preview.ts` for the webview shape, `core/preview-html.ts` for the CSP idiom). The baselines (202 unit / 51 integration, 10-file `.vsix`) matched reality at start. Crucially, Session 14's note that **the adversarial review is the per-phase hardening step that catches what happy-path tests miss** primed me to run it — and it caught 3 real defects again.
- **What was missing / discovered (not Session 14's fault — this work didn't exist):** nothing math-specific; the whole feature design (Pandoc delimiter rules, the KaTeX-webview decision, vendoring, the inline-code-span subtlety) was mine to derive — now captured in Learning #22.
- **What was wrong:** One stale-by-the-time-I-read-it item: the handoff said "`master` is ahead of `origin` — unpushed"; by orientation the operator had pushed, so `origin/master` was current. Not a defect (state simply moved on); I re-verified with `git status` rather than trusting the note (FM #4). Everything else (baselines, operator-only-publish caveat, the `*`-vs-`**` reuse subtlety) held.
- **ROI:** Strongly positive — the accurate baselines + reuse pointers + the "run the adversarial review" priming turned this into "build one well-scoped feature in the established idiom, then harden it," not rediscovery.

### What Session 14 Did — 2026-06-28
**Deliverable:** **Phase 7 (v2) — formatting toggles** (`Quarto: Toggle Bold` / `Toggle Italic` / `Toggle Code`). **COMPLETE + adversarial-review-hardened.** The first v2 feature. Wrap/unwrap the selection — or the word at a bare cursor — in `**` / `*` / `` ` `` markers; second invocation round-trips; bare cursor not in a word inserts an empty pair with the cursor between.

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `9644ddd` chore: claim Session 14 (WIP stub).
2. `2acd9c1` feat: pure `core/format-toggle.ts` + 10 vitest behaviors (TDD red→green each).
3. `d435f85` feat: `features/formatting.ts` adapter + 3 commands + `ctrl/cmd+b`/`ctrl/cmd+i` keybindings, wired in `extension.ts`; 9 `@vscode/test-electron` tests.
4. `103636b` fix: the 3 confirmed adversarial-review findings (each TDD'd).
5. (this close-out docs commit: SESSION_NOTES + CLAUDE.md Learning #21 + BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**How it was built (strict TDD — operator directive held):** ONE failing test → minimal code → green, repeated. RED shown before GREEN for every behavior that added logic (10 core behaviors: wrap; outer-marker unwrap; inner-marker unwrap; word-at-cursor wrap; insert-empty; the `*`-vs-`**` disambiguation for cursor and explicit selection; code marker; round-trip). Pure-core `toggleFormat(text, selStart, selEnd, marker) → {start,end,replacement,selectionStart,selectionEnd}` where the returned `selection*` offsets are POST-edit; `features/formatting.ts` translates `offsetAt`→core→`editor.edit(replace)`→restore selection via `doc.positionAt` against the LIVE post-edit doc.

**Adversarial review (the project's per-phase hardening step — Learnings #12/#14/#15/#16):** a 5-lens / 3-refuter refute-by-default Workflow raised **11**, confirmed **3** (≥2/3 verifiers traced a real repro), refuted 8. All 3 fixed, each via a failing-first test:
- **(core, silent data loss) empty-`**` disambiguation hole:** `toggleFormat("a**b",2,2,"*")` (bare cursor between the two asterisks, toggle italic) **deleted** the `**` → `"ab"`. The `*`-vs-`**` guard only checked OUTER neighbours; on an empty selection the two candidate markers are mutually adjacent. Fix: inner-neighbour guards (`text[s] !== marker[0]` && `text[e-1] !== marker[0]`) → inserts an empty pair instead.
- **(core, malformed output) ASCII-only word expansion:** `isWordChar = /[A-Za-z0-9_]/` split accented prose (`café` + bare-cursor bold → `**caf**é`), diverging from `language-configuration.json` `wordPattern`. Fix: `/[\p{L}\p{N}_]/u`.
- **(test faithfulness, gate d) substring keybinding-scope check:** `binding.when?.includes("editorLangId == quarto")` stays green even if broadened to `… || markdown`. Fix: `strictEqual(binding.when, "editorTextFocus && editorLangId == quarto")`.
- Refuted (left as-is, by ≥2/3 verifiers): "fires inside code cells/YAML" (intended — user-invoked, no silent corruption), reversed-selection normalization, re-entrancy/TOCTOU on key-repeat, the 5-adapter guard duplication, and three weaker test-faithfulness nits.

**Verification (full matrix green at every layer boundary — vertical-slice gate c):**
- `npm run compile` clean (tsc + esbuild).
- **`npm test` → 202 unit** (was 190; +12 format-toggle).
- **`npm run test:integration` → 51 integration** (was 42; +9 formatting), all in a real `@vscode/test-electron` host — faithful (gate d): they drive the editor, set selections by offset, run the commands, and assert document text + resulting selection, pinning the offset mapping end to end. No Quarto CLI / kernel needed (env-independent).
- `npm run package` → clean **10-file** `.vsix` (29.82 KB; bundle 47.75 KB); no test/fixture/`node_modules`/`.claude` leak.
- **Phase 3E (runtime smoke test) — SATISFIED via test-electron** (Learning #3: stronger than manual F5 for wiring/dispatch). The integration suite activates the extension in a real host and exercises the commands end to end. **F5-only residue:** the keybindings physically firing (`cmd+b`) and the visual marker insertion are not headlessly verifiable; behavior is fully integration-proven (consistent with every prior phase's residue note).
- §3.3 guardrail held: `core/format-toggle.ts` imports no `vscode`.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #21):**
- The `*`-vs-`**` disambiguation is the crux: a `*` adjacent to another `*` is part of a `**` run — guard BOTH outer AND inner neighbours, or an empty-selection toggle silently deletes a `**`.
- Cursor-to-word expansion must be Unicode-aware (`\p{L}`/`\p{N}`) and aligned with the editor's `wordPattern`.
- A contributed-`when`/scope test must assert EXACT equality, not a substring (a broadened clause is a real regression that a substring check misses).
- No Learning-#13a activation trap here: the keybinding gates on the BUILT-IN `editorLangId` (not an extension-set context key), and `onLanguage:quarto` registers the commands on `.qmd` open.

**Key files:**
- `src/core/format-toggle.ts` — pure `toggleFormat` (NEW). The branch order is word-expand → outer-unwrap → inner-unwrap → wrap; the disambiguation guards live on the two unwrap branches.
- `src/features/formatting.ts` — the `vscode` adapter (NEW): `registerFormattingFeature`, gated to `languageId === "quarto"`, primary selection only.
- `src/extension.ts` — `registerFormattingFeature(context)` added to `activate()` (import + call).
- `package.json` — 3 commands (`quarto.toggleBold/Italic/Code`) + 2 keybindings (`ctrl/cmd+b`, `ctrl/cmd+i`, `when: editorTextFocus && editorLangId == quarto`).
- `test/unit/format-toggle.test.ts` (12 cases) / `test/integration/suite/formatting.test.ts` (9 cases) — NEW.
- `CLAUDE.md` — Learning #21. `BACKLOG.md`/`CHANGELOG.md`/`ROADMAP.md` — updated.

**Gotchas for the next session:**
1. **No forced next deliverable — WAIT for the operator to pick** (FM #2/#13). Don't auto-start another Phase 7 slice or 6d/6e.
2. **`master` is ahead of `origin` and UNPUSHED** (Session 13's 3 + this session's ~5 commits). Pushing is the operator's call (prior sessions left pushing to the operator); offer it, don't assume.
3. **`vsce publish` is an OPERATOR step** (Marketplace publisher `rmsharp` + PAT). You can't do it.
4. **Multi-cursor formatting is deferred** (BACKLOG Polish, new this session) — `features/formatting.ts` toggles only `editor.selection` (primary). If you add it, it's its own TDD slice (N replacements + N shifting-offset selections).
5. **`dashboard_history.jsonl` changes whenever you run the dashboard** — fold it into the close-out dashboard-refresh commit. The "critical" risk flag is still the 7 dev-only `npm audit` vulns (cosmetic, documented — Learning #20), not this feature.
6. **`.vsix` is gitignored** (`*.vsix`) — the release-gate artifact is not committed.
7. **Phase 6d (YAML/`#|` completion) likely needs a planning/spike first** — the plan (§6 dragon) says the license-clean YAML-schema source is undecided ("investigate before committing to an approach"). Don't start it as a pure implementation session without resolving that.

**Self-assessment (Session 14): 9/10.**
- **+** Held strict TDD faithfully — RED shown before GREEN for all 10 core behaviors and for all 3 review fixes (the operator directive's enforcement clause is satisfiable from this log). Kept the §3.3 guardrail (pure core, zero `vscode` import) and the pure-core+thin-adapter split, so the bulk is headlessly unit-tested and the adapter is faithfully integration-tested through the real editor (gate d — not a force-activating happy-path suite). Ran the project's per-phase adversarial review and it earned its keep: it caught a **silent character-deletion** bug (empty-`**` italic) and a malformed-output bug (accented words) that all 21 of my own happy-path tests missed — exactly the Learning-#12/#14/#15/#16 pattern — and I fixed each test-first, not patch-first. Checkpoint-committed at each layer boundary (core → adapter → fixes), each ≤5 files, full matrix green at each. One deliverable, no bundling (FM #18) — surfaced the remaining Phase 7 slices and 6d/6e as operator options rather than continuing.
- **−** The two coverage-only behaviors (5/6) and the code-marker/round-trip cases (8/9) were added GREEN-on-first-run (the general logic already satisfied them) rather than RED-first — defensible (they add no logic, only lock regressions) but I flagged it transparently rather than manufacturing artificial REDs. I also could have written the empty-`**` and accented-word cases proactively (the review found them); a sharper pre-review edge-case pass on the disambiguation + word-class would have caught both before spending a review cycle. Net: the safety nets (TDD + adversarial review) worked exactly as designed, but the first-pass edge coverage could be tighter.

#### Session 13 Handoff Evaluation (by Session 14) — Phase 3A
**Score: 9/10.** Accurate, honest, and it correctly framed this as a clean fork: v1 release prep is agent-complete, so there is no forced next deliverable — pick one v2/polish item and close out. That framing is exactly what let me scope to a single capability without archaeology.
- **What helped:** The ACTIVE TASK's "WAIT for the operator to pick" + the explicit option list (operator publish / v2 features / polish) made the FM #18 boundary obvious and pre-empted FM #2 keep-going. The "reuse the patterns" pointer (pure `core/` is `vscode`-free; adapters in `features/`+`providers/`; vitest + test-electron harnesses established; strict TDD mandatory with `/tdd`) was precisely the orientation I needed to build a new feature in-idiom — it pointed me straight at the right files to mirror (`features/execution.ts`, `render-args.ts` + its test) without hunting. Baselines (190 unit / 42 integration, 10-file `.vsix`) all matched reality at start.
- **What was missing / discovered (not Session 13's fault — this work didn't exist yet):** nothing about formatting toggles specifically (it was one option among many), so the per-feature design (the `*`-vs-`**` disambiguation, the POST-edit offset contract, Unicode word class) was mine to derive — now captured in Learning #21 for the next authoring-aid slice. The handoff also didn't flag the unpushed-commits state (Session 13's own 3 commits were ahead of origin); minor, but I inherited a `master`-ahead-of-`origin` repo and now call it out explicitly for my successor.
- **What was wrong:** Nothing material. Vuln posture, baselines, the operator-only-publish caveat, and the "don't invent work" guidance all held.
- **ROI:** Strongly positive — the accurate baselines + the reuse pointers turned this into "build one well-scoped feature in the established idiom," not rediscovery.

### What Session 13 Did — 2026-06-28
**Deliverable:** v1 release-prep — the **`npm audit` posture decision** (the last agent-actionable release-prep item). **COMPLETE + documented + release gate re-verified. v1 release prep is now AGENT-COMPLETE; only the operator-only `vsce publish` remains.**

**Decision: accept all 7 vulnerabilities as dev-only** (none ship), documented in a new `docs/SECURITY-AUDIT.md`. **No code/dependency/`package.json` change** — no fix was applied because none is clean + non-breaking, and `--force` is net-negative.

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `621a281` chore: claim Session 13 (WIP stub).
2. (this close-out commit: `docs/SECURITY-AUDIT.md` + BACKLOG/CHANGELOG/ROADMAP + SESSION_NOTES + CLAUDE.md Learning #20; + a separate dashboard-refresh commit.)

**The investigation (read-only) and its evidence:**
- `npm audit --json`: **7 vulns** = `esbuild`≤0.24.2 (mod, direct devDep — the bundler), `vite`≤6.4.2 (high, transitive via vitest), `vitest`≤3.2.5 (**critical**, direct devDep — unit runner), `@vitest/mocker` + `vite-node` (mod, transitive), `serialize-javascript`≤7.0.4 (high, transitive via mocha), `mocha` (mod, direct devDep — integration runner).
- **"None ship" verified FOUR ways (gate d — faithfulness, not assertion):** (1) `package.json` `"dependencies": {}` is empty — zero runtime deps; (2) `grep -rnE "esbuild|vite|vitest|mocha|serialize-javascript" src/` → no matches; (3) the shipped bundle `dist/extension.js` (45.23 KB) contains none of their names; (4) `vsce ls` / `npm run package` show the `.vsix` ships only `dist/extension.js` + 7 static files (LICENSE/NOTICE/README/package.json/language-configuration.json/grammar/icon) — **no `node_modules`**.
- **No clean fix exists:** `npm audit fix --dry-run` (semver-safe) fixes **0 of 7**; every remediation is gated behind `--force`, which is breaking AND net-negative — it would major-bump esbuild (0.24→0.28) & vitest (2→3) and **DOWNGRADE mocha (10.8.2→8.1.3)**. That risks the verified 190-unit/42-integration/clean-`.vsix` pipeline to silence advisories on surfaces this project never uses (esbuild/vite **dev server**, **Vitest UI server**, serialize-javascript via crafted input — we run headless one-shot builds/tests).

**Verification (release gate green; nothing else changed):**
- `npm run package` → clean **10-file** `.vsix` (29.09 KB): `[Content_Types].xml` + `extension.vsixmanifest` + 8 content files; `LICENSE`→`LICENSE.txt`, `README.md`→`readme.md` (Learning #17). No test/fixture/`node_modules`/`.claude` leak.
- **Unit/integration baselines unchanged at 190/42** — definitionally, because zero code/dependency/`package.json` changed (only markdown docs added/edited). Not re-run (no surface they cover changed); stated, not silently skipped.
- **Phase 3E (runtime smoke test):** N/A by design — pure documentation, **no runtime/extension behavior changed**, so there is nothing to launch-verify; the relevant release gate is the clean package, which passed. (Explicit, not a silent skip — FM #24.)
- §3.3 guardrail: untouched (no `src/` change).

**🔑 Load-bearing findings (→ CLAUDE.md Learning #20):**
- **What `npm audit` scans ≠ what ships.** It scans the whole 487-dep dev tree; the extension ships the **esbuild bundle + static assets, never `node_modules`**. A vuln is user-facing only if it's a **runtime `dependency` that gets bundled** — and `dependencies:{}` here means none are.
- **`npm audit` exits 0 regardless of findings** (the exit code keys off flags, not vuln presence) — never gate a script on it; parse `--json`.
- **`npm audit fix --force` can be net-negative** — here it *downgrades* mocha. Treat it as suspect; do real toolchain upgrades as their own verified pass.

**Key files:**
- `docs/SECURITY-AUDIT.md` — the posture note (decision, four-way "none ship" evidence, per-advisory table, why-not-fix, when-to-revisit). **NEW.**
- `package.json` — `"dependencies": {}` (the load-bearing fact); the 7 vulns are all under `devDependencies`. (Read-only this session.)
- `CLAUDE.md` — Learning #20.
- `BACKLOG.md` — `npm audit` item `[x]`; v1-release-prep parent `[x]`; new Polish item "deliberate dev-toolchain upgrade".
- `CHANGELOG.md` / `ROADMAP.md` — release-prep-complete entries.

**Gotchas for the next session:**
1. **There is no forced next deliverable — WAIT for the operator to pick** (v2 feature, a Polish item, or they do the operator-only `vsce publish`). Don't invent work (FM #2 keep-going / FM #13).
2. **`vsce publish` is an OPERATOR step** — needs a registered Marketplace publisher `rmsharp` + a PAT. You cannot do it; don't try.
3. **The `npm audit` set will reappear on every `npm install`/audit** — it is *accepted*, not fixed. `docs/SECURITY-AUDIT.md` is the record; re-check with `npm audit --json` and confirm the set is unchanged + still all `devDependencies`. **Re-evaluate the instant a runtime `dependency` is added** (it WOULD ship).
4. **If you clear the advisories for real** (the new Polish item), do bump + full-matrix re-verify, **NOT `npm audit fix --force`** (it downgrades mocha) — Learning #20.
5. **`dashboard_history.jsonl` changes whenever you run the dashboard** — fold it into the close-out dashboard-refresh commit. **The dashboard's "critical" risk flag was driven by these 7 dev-only vulns** — it will likely stay flagged until a real toolchain upgrade clears them; that's cosmetic, the posture is documented.
6. **`.vsix` is gitignored** (`*.vsix`) — the `vscode-quarto-ext-0.0.1.vsix` produced by the release-gate check is not committed.

**Self-assessment (Session 13): 9/10.**
- **+** Delivered exactly the one item, no bundling (FM #18 held — did NOT start any Polish/v2 work; surfaced them as options for the operator instead). **Faithfulness was the crux and I held gate d:** I did not take the handoff's "7 dev-only vulns, none ship" on faith — I proved "none ship" four independent ways (empty `dependencies`, `src/` grep, the shipped-bundle grep, `vsce ls`), which is the difference between a documented decision and a hopeful one. Caught the **`npm audit fix --force` mocha *downgrade*** via `--dry-run` before recommending against it (a wrong "fix" that a naive `audit fix --force` would have silently applied). Reconciled the "8-file vs 10-file `.vsix`" terminology by running the actual `npm run package` rather than guessing (the `vsce ls` content count is 8; the packaged count is 10 incl. the 2 manifest files) — and corrected the CHANGELOG accordingly. Documented the decision durably (`docs/SECURITY-AUDIT.md`) with a clear re-evaluation trigger, and distilled the reusable lesson into Learning #20. Treated Phase 3E honestly (N/A-by-design with the reason, not a silent skip).
- **−** The Phase 1B stub edit FAILED on the first attempt (the harness didn't count my earlier *partial* read of SESSION_NOTES.md as a read) — I had to re-read the section and retry; minor friction, the stub still landed before any technical work (the protocol order held). I also initially wrote "8-file `.vsix`" in the CHANGELOG from the `vsce ls` count before running the authoritative `npm run package` — caught and corrected in-session, but the cleaner order is to package first, then write the count.

#### Session 12 Handoff Evaluation (by Session 13) — Phase 3A
**Score: 9/10.** Accurate, well-scoped, and it correctly framed the `npm audit` item as the last small thing — turning this into a focused decision pass, not archaeology.
- **What helped:** The ACTIVE TASK named the exact remaining item and pre-stated the shape of the answer — *"7 dev-only vulns, none ship... document as accepted (dev-only `devDependencies`, not in the bundled `dist/extension.js`), or `npm audit fix` if clean + non-breaking"* — which is precisely the decision tree I executed. The FM #18 scoping ("don't also start the deferred polish") was right and I held to it. The baselines (10-file `.vsix` 29.09 KB, 190/42) all matched reality (I reconfirmed the package). The Session 12 gotcha list (push+public invariants, `--disable-extensions`, image-cache) wasn't needed for this item but was accurate.
- **What was slightly off / discovered this session (now Learning #20 — not Session 12's fault):** the handoff said "7 dev-only vulns, none ship" as an established fact; it was *correct*, but it hadn't been *proven* — I had to establish the four-way evidence myself, and along the way found two things no prior note mentioned: `npm audit` **exits 0 regardless of findings**, and `npm audit fix --force` **downgrades mocha**. Neither is a defect in the handoff (no prior session ran the audit decision); they're genuine discoveries now captured.
- **What was wrong:** Nothing material. The vuln count (7), the dev-only framing, the baselines, and the "operator-only publish" caveat all held.
- **ROI:** Strongly positive — the pre-stated decision tree + accurate baselines meant the session was investigation + documentation, not rediscovery.

### What Session 12 Did — 2026-06-28
**Deliverable:** v1 release-prep **item 3** — F5 visual pass + README screenshots. **COMPLETE + verified. Release prep is now down to one item (the `npm audit` decision) + the operator publish.**

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `cdf9320` chore: Session 12 prep — `test/fixtures/showcase.qmd` (one render-clean doc exercising every feature; doc-level `execute: enabled: false` so it needs no kernel), `docs/F5-VISUAL-CHECKLIST.md` (repeatable runbook), `.vscodeignore` (`media/screenshots/**` excluded from the `.vsix`), SESSION_NOTES claim stub.
2. `8aacc0a` feat: the 5 screenshots → `media/screenshots/0{1..5}-*.png`.
3. `05ef0f5` docs: README `## Screenshots` gallery (replaced the placeholder; one captioned + alt-texted image per feature).
4. (this close-out commit: SESSION_NOTES, CLAUDE.md Learning #19, BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)
Plus a **temporary** `--disable-extensions` tweak to `.vscode/launch.json` during capture, **reverted before commit** (verified clean diff).

**The pass was live + interactive** (operator chose "live together, now"): the operator drove the dev host and pasted each screenshot into chat; I QA'd framing live and copied each from Claude's image-cache into the repo.

**Verification (all green):**
- `npm run package` → clean **10-file** `.vsix` (29.09 KB); `vsce ls` confirms `media/` ships **only `icon.png`** (screenshots excluded).
- All 5 README image links resolve to real files; vsce rewrites the relative paths to `https://github.com/rmsharp/vscode_quarto_ext/raw/HEAD/media/screenshots/...` (verified by unzipping the packaged `readme.md`) — so they render on the Marketplace **once pushed**.
- `showcase.qmd` renders **exit 0** (`Output created: showcase.html`); `git diff` shows it matches committed (the operator's in-editor edits were undone).
- No `src/` change → **190 unit / 42 integration** baselines unchanged (nothing they cover changed).
- **Phase 3E (runtime smoke test) — SATISFIED, definitively:** the F5 visual pass IS the strongest possible runtime verification — every feature's UI was eyeballed live in a real Extension Development Host running ONLY our extension: highlighting (status bar `Quarto`), Outline populated, `@` completion firing (cross-refs + citekeys in one list), live preview rendering, render succeeding. **This closes the "F5-only visual residue" every prior phase (5 / 6a–6c) logged as un-eyeballed.**

**🔑 Load-bearing findings (→ CLAUDE.md Learning #19):**
- **THE FAITHFULNESS TRAP: Posit's official Quarto extension (`quarto.quarto`) is installed in the user's VS Code and runs in the dev host alongside ours, MERGING providers** (grammar / outline / `@`-completion / `Preview`+`Render`). The first screenshots showed its UI (the tell: a `▷ Run Cell | Run Next Cell` CodeLens — we register none; `grep -ri codelens src/` is empty). **Fix: `--disable-extensions` on the dev host** (keeps the `--extensionDevelopmentPath` extension, disables installed ones). Without this the whole pass is non-faithful.
- **Two-windows trap:** the dev host is a SEPARATE window from the project window; disabling Posit in the *normal* window did nothing. Act only where the file is colorized / status bar reads `Quarto` (title contains `[Extension Development Host]`).
- **Capture: pasted images live at `~/.claude/image-cache/<session-uuid>/<N>.png`** (path printed in chat) — copy from there; macOS clipboard captures don't hit the Desktop.
- **Packaging: screenshots OUT of the `.vsix` but committed + PUSHED** (Marketplace fetches them via the rewritten repo raw URLs).

**Key files:**
- `media/screenshots/01-syntax-highlighting.png` (2000×1951), `02-outline.png` (2000×399), `03-completion.png` (1540×560), `04-preview.png` (1972×2000), `05-render.png` (2000×1366).
- `README.md` — the `## Screenshots` section (after the Status blockquote, before `## Features`).
- `test/fixtures/showcase.qmd` — the render-clean showcase doc (reuses `test/fixtures/refs.bib` for citation completion).
- `docs/F5-VISUAL-CHECKLIST.md` — the repeatable F5 runbook.
- `.vscodeignore` — `media/screenshots/**` exclusion (icon still ships).
- `CLAUDE.md` — Learning #19.

**Gotchas for the next session (the `npm audit` decision):**
1. **Item 3 was the last visual/feature work — what remains is the `npm audit` decision + the operator publish.** Don't re-open the screenshots. (FM #18.)
2. **Push + PUBLIC matter:** the README's screenshot URLs point at `origin/master` raw — they only render once pushed AND while the repo is **public** (verified all 5 → HTTP 200 after the operator made it public; they 404 anonymously on a private repo). The repo is public now; preserve both invariants for any future screenshot change.
3. **If you re-run an F5 pass, re-apply `--disable-extensions`** (the user has Posit's `quarto.quarto` installed) — it is reverted in `launch.json` now.
4. **`npm audit`** = 7 dev-only vulns (`devDependencies`, not in the bundled `dist/extension.js`) — the honest posture is "accepted (dev-only)" unless `npm audit fix` is clean + non-breaking.
5. **Operator cleanup (courtesy):** the operator disabled Posit's Quarto in their *normal* VS Code window during this session; they may want to re-enable it.

**Self-assessment (Session 12): 9/10.**
- **+** Delivered exactly item 3, no bundling (FM #18 held — did NOT touch the `npm audit` decision or any polish item). **The crux was faithfulness, and I held the line:** I refused the first screenshots the moment I saw the `Run Cell` CodeLens (not ours), diagnosed Posit's extension merging in the dev host, and isolated it with `--disable-extensions` so every shipped screenshot is unambiguously our extension (gate-d discipline applied to a *visual* pass, not just tests). Adapted the capture pipeline when the Desktop assumption failed (pivoted to the image-cache — the better mechanism). Recoverable commits, ≤5 files each (split images and README to honor the per-commit cap). Verified the packaging invariants that matter (screenshots excluded, icon ships, vsce URL rewrite confirmed by unzip) instead of assuming; reverted the temporary `launch.json` change and confirmed a clean diff. Retired the standing cross-cutting "F5-only visual residue." And the post-push curl check caught that the rewritten Marketplace image URLs 404'd on the (then-private) repo *before* I declared them live — the operator made the repo public and all 5 verified HTTP 200, so the outward-facing artifact was faithfully confirmed, not assumed.
- **−** The Phase 1B claim stub silently FAILED on the first attempt (I tried to edit from a truncated read) and I did real technical work (showcase + the prep commit) before noticing and re-writing the stub — a protocol slip (the stub must land before technical work); caught and corrected in-session. I also burned a step assuming macOS screenshots land on the Desktop and copied a stale (April) file before switching to the image-cache. Both minor, no lasting damage.

#### Session 11 Handoff Evaluation (by Session 12) — Phase 3A
**Score: 9/10.** Accurate, well-scoped, and load-bearing on exactly the points item 3 needed.
- **What helped:** The ACTIVE TASK named item 3 precisely and pointed at the `<!-- SCREENSHOTS: placeholder -->` slot with "put images under `media/`" — I knew exactly where the output goes. The FM #18 scoping ("don't also do the `npm audit` / deferred polish") was right and I held to it. The baselines (10-file `.vsix`, 190/42) and the Learning #18 icon / `.vscodeignore` notes were accurate and let me reason about the packaging (screenshot exclusion, icon inclusion) confidently.
- **What was missing (genuinely undiscoverable beforehand — now Learning #19):** the handoff (and every prior session) framed the F5 pass as "just eyeball the UI," with no warning that **the user has Posit's `quarto.quarto` installed and it merges with ours in the dev host** — the single biggest issue this session and the thing that makes a naive visual pass non-faithful. No prior session had run an F5 pass, so this couldn't have been known — not Session 11's fault. It also didn't mention the dev-host-vs-normal-window distinction or the image-cache capture path.
- **What was wrong:** Nothing material. Every claim (placeholder location, `media/` convention, baselines, the operator-publish caveat) held.
- **ROI:** Strongly positive — turned the prep into focused execution + a faithfulness-hardening pass, not archaeology.

### What Session 11 Did — 2026-06-28
**Deliverable:** v1 release-prep **item 2** — marketplace metadata (`package.json`) + listing README rewrite. **COMPLETE + verified (incl. a coupling bug caught and fixed).**

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `c18b847` chore: item 2 — marketplace metadata + listing README. `package.json`: `publisher` → `rmsharp`, original `icon` `media/icon.png`, `keywords`/`bugs`/`homepage`/`galleryBanner`/`preview:true`, polished `description`, categories Programming Languages + Data Science. `media/icon.png`: original 256×256 (document card + `</>` + "MIT" badge, from an SVG via `rsvg-convert` — not Quarto's logo). `README.md`: rewritten for the Marketplace, stale status line fixed (drafted via a judge-panel + accuracy-critic workflow against a fixed factual brief).
2. `dcab15e` fix(test): update integration `EXTENSION_ID` for new publisher (1/2) — 5 suites.
3. `98e15aa` fix(test): update integration `EXTENSION_ID` for new publisher (2/2) — 3 suites.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #18, BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**Verification (all green):**
- `npm run package` → clean **10-file** `.vsix` (28.82 KB) with **`media/icon.png` embedded** (confirmed via `vsce ls`); no missing-publisher/icon/repository warnings.
- `npm test` → **190/190** vitest (unchanged — no test reads the changed metadata fields; grep confirmed the only `package.json` reads are `contributes.languages`/`grammars`/`activationEvents`).
- `npm run test:integration` → **42/42** in the real downloaded VS Code host (after the `EXTENSION_ID` fix; see below).
- §3.3 guardrail: no `src/` change at all, so untouched.
- **Phase 3E:** no extension/runtime behavior changed (pure metadata/docs/asset); the relevant gate is the clean package with the icon embedded + the integration suite still activating — both done. Not a silent skip — there is no new runtime code path to launch-verify, but the integration run IS the activation smoke test and it passes 42/42.

**🔑 Load-bearing finding (→ CLAUDE.md Learning #18): the publisher→extension-ID coupling.**
- Changing `publisher` `vscode-quarto-ext` → `rmsharp` changed the runtime extension ID `<publisher>.<name>` to `rmsharp.vscode-quarto-ext`. The integration suite **hard-codes** `const EXTENSION_ID = "vscode-quarto-ext.vscode-quarto-ext"` in **all 8** `test/integration/suite/*.test.ts` files (it resolves the extension by ID in each file's `before all` hook).
- `npm run compile`, `npm run package` (clean `.vsix`), AND `npm test` (190/190) ALL passed — only the **full `test:integration` run RED'd 8 "should be discoverable" failures**. Fixed by updating the constant in all 8 suites (commits `dcab15e`, `98e15aa`), then re-ran → 42/42.
- **Lesson (now Learning #18): metadata that is also an identity (publisher/name) is runtime-coupled — re-run the integration suite after such a change; package + unit green is NOT sufficient.** The constant is duplicated across 8 files → added a BACKLOG "Polish" item to extract/derive it from `package.json`.

**README workflow (multi-agent, ultracode):** 3 independent drafts (feature-tour / quick-start / positioning) from a FIXED factual brief (drafters told NOT to read the repo → no stale-content bleed) → judge panel (picked the positioning draft) → accuracy critic (refute-by-default; flagged only 2 low-severity `quarto.org` link items — kept, it's the legitimate CLI download site). Final README = winner + grafted grouped feature subheadings + the colorize `> Note:` callout + the CLI download link. Zero fabricated/overreaching claims (the critic confirmed no NOT-IN-v1 capability leaked in).

**Key files:**
- `package.json` — top metadata block (lines ~1-45): `publisher` `rmsharp`, `icon`, `keywords`, `bugs`, `homepage`, `galleryBanner`, `preview`, `description`, `categories`.
- `media/icon.png` — the shipped icon (256×256). Source SVG is in the session scratchpad (`scratchpad/icon.svg`) — re-author there + `rsvg-convert -w 256 -h 256` if it needs changing; it is NOT checked in.
- `README.md` — the full marketplace listing. `<!-- SCREENSHOTS: placeholder -->` marks where item-3 screenshots go.
- `test/integration/suite/*.test.ts` (×8) — `EXTENSION_ID` now `"rmsharp.vscode-quarto-ext"`.
- `CLAUDE.md` — Learning #18 (the coupling trap + icon/README method).

**Gotchas for the next session (item 3 + audit):**
1. **Re-run `npm run test:integration` after ANY `publisher`/`name`/activation change** — package + unit will lie to you (Learning #18). The 8 `EXTENSION_ID` constants are the tripwire.
2. **`.vsix` is gitignored** (`*.vsix`) — don't commit it. `media/icon.png` IS tracked (not gitignored — verified).
3. **`dashboard_history.jsonl` changes whenever you run the dashboard** — fold it into the close-out dashboard-refresh commit.
4. **`npm audit`** still 7 dev-only vulns (none ship). Decide the posture.
5. **F5 visual pass** remains the only way to eyeball UI (no `code` CLI) — capture screenshots there for the README's placeholder slot.
6. **Actual `vsce publish` is an operator step** — needs a registered Marketplace publisher `rmsharp` + a PAT. `preview: true` is set; flip it when the listing is deemed stable.

**Self-assessment (Session 11): 9/10.**
- **+** Delivered exactly item 2, no bundling into item 3 (FM #18 held — the README leaves a screenshot placeholder rather than starting the F5 pass). Verification was faithful and it MATTERED: I ran the full integration suite even though the change was "just metadata," which caught the publisher→ID coupling that package + 190 unit missed — the failing run was a genuine RED, the fix a clean GREEN, re-verified 42/42 (gate d / Learning #13 discipline applied). Honored the 5-file blast-radius cap (split the 8-file test fix into two commits). Used a judge+critic workflow to keep the outward-facing README free of fabricated/stale claims (the whole point of item 2). Generated original icon art (clean-room posture extends to branding). Asked the operator only the two genuinely-owned decisions (publisher, icon) up front, then proceeded.
- **−** I introduced the coupling bug in the first place by committing the metadata (`c18b847`) before running the integration suite — had I sequenced integration before the deliverable commit, the RED would have preceded the commit. It was caught and fixed in-session with no lasting damage, but the cleaner order is: change identity → integration → commit. Also the duplicated `EXTENSION_ID` constant is a pre-existing smell I had to touch 8 times; I logged it for extraction rather than fixing it now (correctly scoped, but it's debt the project carried).

#### Session 10 Handoff Evaluation (by Session 11) — Phase 3A
**Score: 9/10.** A precise, accurate handoff that made item 2 fast and correctly scoped.
- **What helped:** The ACTIVE TASK enumerated item 2 exactly — "real `publisher` id (the current `vscode-quarto-ext` is a placeholder), an `icon` (PNG ≥128×128), `keywords`, `bugs`/`homepage`; polished `displayName`/`description`" and the README rewrite with the **specific stale-line callout** ("says editor intelligence is 'still to come', but outline + cross-ref + citation completion all shipped") — I knew precisely what to fix and didn't have to rediscover it. The FM #18 scoping ("don't also start item 3") was right and I held to it. Learning #17's note that relative links now work (because `repository` is set) was directly load-bearing for the README's `LICENSE`/`NOTICE` links. The verification baselines (190 unit / 42 integration, clean `.vsix`) all matched reality.
- **What was missing:** It couldn't have known about the publisher→extension-ID coupling (now Learning #18) — that was a live discovery this session. Minor: it said the icon should be "PNG ≥128×128" but didn't flag that no `media/` dir existed yet (trivial — I created it).
- **What was wrong:** Nothing material. Every claim held; the 9-file `.vsix` / flag-free `package` script / `repository`-set state were all exactly as described.
- **ROI:** Strongly positive — turned item 2 into a focused execution pass, not archaeology.

### What Session 10 Did — 2026-06-28
**Deliverable:** v1 release-prep **item 1** — wire the git remote + downstream packaging metadata. **COMPLETE + verified + pushed.**

**What was done (3 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `cdb030b` chore: claim Session 10 (WIP stub).
2. `3fc953d` chore: release-prep item 1 — wired `origin` (`rmsharp/vscode_quarto_ext`), added the `repository` field to `package.json`, dropped `--allow-missing-repository` from the `package` script, made the README `LICENSE` reference a relative link.
3. (this close-out commit: SESSION_NOTES, CLAUDE.md Learning #17, BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)
Plus a git operation (not a file commit): renamed local `main`→`master` and **force-pushed** (`--force-with-lease`) over GitHub's auto-init commit, so `origin/master` is now at the project HEAD.

**Verification (all green):**
- `npm run package` → clean **9-file** `.vsix` (19 KB) **without** `--allow-missing-repository` (the `repository` field now satisfies vsce; no missing-repo warning).
- `npm test` → **190/190** vitest (unchanged — confirms nothing asserts on the changed `package.json` fields).
- `git ls-remote origin master` → `3fc953d…` (push succeeded; remote default branch is already `master`).
- **Phase 3E N/A by design:** this is pure packaging metadata — **no extension/runtime behavior changed**, so there's nothing to launch-verify; the relevant gate is the clean package, which is done (stated explicitly, not a silent skip).

**🔑 Load-bearing findings (→ CLAUDE.md Learning #17):**
- The repo `rmsharp/vscode_quarto_ext` **pre-existed with GitHub auto-init** (throwaway `LICENSE` + 1-line `README.md`) on an **UNRELATED history**, default branch **`master`** (operator's choice, corrected mid-session). Reconciled by renaming local `main`→`master` and **force-pushing with `--force-with-lease`**. Inspect any remote first (`git ls-remote`, `git show origin/<b>`, `git merge-base`) before pushing.
- **vsce normalizes the repo's `LICENSE` (no extension) to `LICENSE.txt` inside the `.vsix`**, but the working-tree file is `LICENSE` — so the README relative link must target `LICENSE` (verified the local filename before linking).
- **Dropping `--allow-missing-repository` needs only the `repository` field in `package.json`** (vsce reads package.json, not the remote) — packaging needs no push.

**Key files:**
- `package.json` — `repository` field added after `"license"`; `scripts.package` is now `npm run compile && vsce package` (flag dropped).
- `README.md` — the License paragraph now uses `[`LICENSE`](LICENSE)` (relative link).
- `CLAUDE.md` — Learning #17 (release-prep item 1 traps).
- Git: `origin` → `https://github.com/rmsharp/vscode_quarto_ext.git`, branch `master` (tracks `origin/master`).

**Gotchas for the next session (release prep item 2/3):**
1. **The README status line is STALE** — it claims editor intelligence (outline/completion) is "still to come", but all of it shipped (Phases 6a–6c). The item-2 README rewrite must fix this.
2. **`publisher` is still the placeholder `vscode-quarto-ext`** — item 2 needs a real Marketplace publisher id (and actually publishing needs a Marketplace account/PAT — an operator step).
3. **Relative links now work** in the README (the `repository` field is set) — safe to use for LICENSE/NOTICE etc.
4. **`.vsix` is gitignored** — don't commit it. `dashboard_history.jsonl` changes whenever you run the dashboard — fold it into the close-out dashboard-refresh commit.
5. **`npm audit`** still 7 dev-only vulns (none ship). Decide the posture.
6. **F5 visual pass** remains the only way to eyeball UI (no `code` CLI) — capture screenshots there for the README.

**Self-assessment (Session 10): 9/10.**
- **+** Delivered exactly item 1, no bundling (FM #18 held — did NOT start item 2's publisher/icon/keywords or the README rewrite). Config/metadata is TDD-exempt, and verification was faithful: `npm run package` *without the flag* directly exercises the claim (the `repository` field is what makes it pass), and 190/190 unit green confirms nothing read the changed fields. Handled two operator corrections cleanly — branch name (`master`) and the force-push reconciliation — and **confirmed the destructive force-push before doing it** (surfaced the auto-init/unrelated-history situation, used `--force-with-lease`, rather than blindly overwriting a commit I didn't create). Caught the `LICENSE` vs `LICENSE.txt` correctness detail (verified the actual local filename before linking). Recorded the wiring traps as Learning #17.
- **−** I proposed the README relative link before verifying the license filename (checked it immediately after — it was correct, but the check should have come first). I also asked the push question before discovering the repo had auto-init, so reconciliation needed a second question — inspecting the remote's contents up front would have folded both into one decision. Both minor, resolved in-session.

#### Session 9 Handoff Evaluation (by Session 10) — Phase 3A
**Score: 9/10.** A precise, well-structured handoff that made item 1 fast.
- **What helped:** The ACTIVE TASK named the exact recipe — *"Add a git remote … add `repository` to `package.json`, DROP `--allow-missing-repository`, lift the README relative-link restriction (Learning #5)"* — verbatim what item 1 required; I was wiring the remote within minutes. The "No git remote yet → vsce needs the flag; README avoids relative links; both lift once a remote + `repository` exist" gotcha was exactly right and told me precisely what to change and why. The verification baselines (190 unit / 42 integration, clean 9-file `.vsix`) all matched reality. The FM #18 reminder correctly scoped me to item 1 only.
- **What was missing (operator-dependent, not Session 9's fault):** it couldn't know the operator would create the repo with **auto-init on a `master` default branch**, so the unrelated-history force-push (now Learning #17) was a live discovery. It also didn't flag that the **README content itself is stale** — a separate item-2 concern I've now surfaced.
- **What was wrong:** Nothing material. Every claim held.
- **ROI:** Strongly positive — turned item 1 into a short mechanical pass, not archaeology.

### What Session 9 Did — 2026-06-28
**Deliverable:** Implement **Phase 6c** — Citation completion. **COMPLETE + verified + adversarially hardened. v1 IS NOW FEATURE-COMPLETE.**

**What was done (9 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `983bea7` chore: claim Session 9 (WIP stub).
2. `9359bdc` feat: Phase 6c **core front-matter reader** — `src/core/frontmatter.ts` `bibliographyPaths(text)` (the region model skips front matter, so this reads the one key); scalar / flow-list / block-list forms, no YAML lib (decided up front — a focused reader is enough for v1). 8 TDD cycles.
3. `14b413b` feat: Phase 6c **core citation parser** — `src/core/citations.ts` `parseCitations(content)`: BibTeX (brace/quote-aware scanner, skips `@string`/`@comment`/`@preamble`) + CSL-JSON, → `{key,title?,author?,year?}`; never throws on malformed input. 12 TDD cycles.
4. `986f378` feat: Phase 6c **adapter + wiring** — `src/providers/citation.ts` (`registerCitationProviders`, CompletionItemProvider trigger `@`) reads bib paths relative to `dirname(doc)`, parses (core), offers citekeys with title detail; gated on `isReferenceableLine`; wired in `src/extension.ts:30`. Faithful integration tests via `executeCompletionItemProvider` over `citations.qmd` + `refs.bib`.
5. `82af496` fix: review **A/D/E** (frontmatter) — zero-indent block list; trailing YAML comment; empty quoted scalar. TDD.
6. `f7e8509` fix: review **B/F/G/H** (parser) — CSL BOM strip; quote-aware brace matching; paren-delimited entries; CSL year leaf type-guard. TDD.
7. `bbde8a3` fix: review **C** (core) — `citationCompletionContext` with a citekey char class (`:`/`.` keys). TDD.
8. `f793623` fix: review **C** (provider) — use `citationCompletionContext`; colon-key fixture + faithful integration test.
9. `e19a939` test: review **I** — adapter degradation coverage (missing bib / no bib / non-file), discrimination established by break-revert.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #16, BACKLOG/CHANGELOG/ROADMAP; + a dashboard refresh.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 36.3 KB → **43.3 KB**, +frontmatter+citations+provider).
- `npm test` → **190/190** vitest (+40: frontmatter 15, citations 25 incl. the context).
- `npm run test:integration` → **42/42** in real downloaded VS Code: citation completion offers citekeys, attaches title detail, **coexists with cross-refs on `@`** (both `@knuth1984` and `@sec-intro` in one list), is **gated out of code cells**, completes a **colon citekey with a whole-token replace range** (no `:1984` dup), and the three degradation paths (no bib / missing bib / untitled) offer nothing without crashing.
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak — verified via `vsce ls`).
- Fixtures render **exit 0** (`citations.qmd`, `citations-nobib.qmd` via doc-level `execute: enabled: false`); `citations-missingbib.qmd` intentionally fails render (the condition under test; never rendered by the suite — documented like `render-error.qmd`).
- §3.3 guardrail: `grep vscode src/core/` → only doc-comment matches; no import.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #16):**
- **The region model skips front matter**, so reading `bibliography:` needs its own reader. A minimal no-YAML-lib reader is right for v1, but real front matter is messy — the review caught a **zero-indent block list**, a **trailing `# comment`**, and an **empty quoted scalar** the happy path missed.
- **THE BIG TRAP — don't reuse a token-scanner across token grammars.** Reusing the cross-ref `crossrefCompletionContext`/`ID_CHAR` (`[A-Za-z0-9_-]`) for citekeys silently reintroduced the **finding-E class** (Learning #15(b)): citekeys contain `:`/`.` (biblatex/DBLP), so completion **stopped firing after a `:`** and **duplicated the suffix on a mid-token accept**. Fix: a citation-specific `citationCompletionContext` with a citekey char class.
- **Parser robustness the happy path misses:** quote-aware brace matching (a stray `{` in a quoted value else discards the rest of the file); **strip a UTF-8 BOM before `JSON.parse`** (BOM-saved CSL-JSON otherwise loads zero citations, silently — CSL-only, BibTeX is BOM-immune via `indexOf`); paren-delimited entries; CSL date-parts leaf type-guard.
- **Faithful tests for layered-defense adapter branches (gate d):** no single behavior test isolates one guard (defense in depth), so discrimination was established by **breaking each guard and observing the targeted test go RED, then reverting**.

**Adversarial review outcome (5 lenses, 3 refute-by-default verifiers each; 13 raised → 12 confirmed / 1 refuted):**
- **Fixed all 12 confirmed** (9 unique, commits `82af496`–`e19a939`), each TDD'd (RED before GREEN). A=zero-indent block list, B=CSL BOM, C=citekey charset (×2 findings), D=trailing YAML comment (×2), E=empty quoted scalar, F=quote-aware brace match, G=paren entries, H=CSL year leaf, I=adapter degradation tests.
- **Refuted 1** (correctly, 3/3): a leading BOM defeating `.qmd` front-matter detection — verifiers confirmed it's not reachable in the real provider path.
- **Resync-on-match-failure** (review F secondary suggestion) was **considered and NOT added** — no discriminating test exists (a missing brace balances against a later entry rather than returning −1), and strict TDD forbids untested code.

**Key files (with anchors):**
- `src/core/frontmatter.ts` — `bibliographyPaths` (`:54`), `frontMatterLines` (`:22`), `stripComment` (`:54`-ish, quote-aware), `unquote`. Pure.
- `src/core/citations.ts` — `parseCitations` (`:29`, BOM strip + format detect), `citationCompletionContext` (`:~60`, `CITEKEY_CHAR`), `parseBibtex`/`matchBrace`/`matchParen` (quote-aware), `parseCslJson`/`cslAuthors`/`cslYear`. Pure.
- `src/providers/citation.ts` — `registerCitationProviders` (`:27`); completion uses `citationCompletionContext` + `isReferenceableLine`, builds `{inserting,replacing}` range; `loadCitations` (`:94`, reads bib relative to `dirname(doc)`, scheme guard, try/catch). Adapter.
- `src/extension.ts:30` — `registerCitationProviders(context)`.
- `test/unit/frontmatter.test.ts` (15) · `test/unit/citations.test.ts` (25) · `test/integration/suite/citation.test.ts` (8). Fixtures: `citations.qmd`, `refs.bib` (+colon key `Knuth:1984`), `citations-nobib.qmd`, `citations-missingbib.qmd`.

**Gotchas for the next session (v1 release prep):**
1. **v1 is feature-complete — the next milestone is packaging, NOT a feature.** See the ACTIVE TASK above. Don't start the deferred polish items (separate sessions).
2. **No git remote yet** → `vsce package` needs `--allow-missing-repository` (baked into `npm run package`); README avoids relative links. Adding a remote lifts both (Learning #5) and is the first release-prep step.
3. **F5 visual residue is now cross-cutting** — every phase's UI visuals (popups, outline, preview webview, notifications, keybinding feel) are integration-proven but never eyeballed (no `code` CLI). Release prep is the natural time for one F5 pass + screenshots.
4. **`citations-missingbib.qmd` is intentionally not render-clean** (it names an absent bib — the condition under test). Don't "fix" it; it's documented in its body like `render-error.qmd`.
5. **`npm audit`** still 7 dev-only vulns (none ship). Decide the posture during release prep.

**Self-assessment (Session 9): 9/10.**
- **+** Delivered exactly Phase 6c's scope — no bundling (FM #18 held: stopped at v1-feature-complete, did NOT start release prep or the deferred polish). **Strict TDD held throughout** — RED observed before every GREEN across 20 core cycles (8 frontmatter + 12 citations) + every review fix; flagged the no-YAML-lib decision up front per the handoff. Kept §3.3 (three pure modules; thin adapter; grep-verified). **Reused the shared scanner** (`isReferenceableLine`) and the faithful `executeCompletionItemProvider` test pattern. Ran a **5-lens / 3-verifier refute-by-default adversarial review** (44 agents) that found **12 confirmed defects the happy-path suite missed** — including the citekey-charset bug, which is the **finding-E class Learning #15 claimed eliminated, silently reintroduced by reusing the cross-ref scanner** (exactly the kind of regression the review exists to catch). Fixed all 12 with TDD, and **established gate-d discrimination for the degradation tests by break-revert** rather than shipping green-but-hollow guards. Honest discipline: declined the untestable resync tweak; documented the non-render-clean fixture.
- **−** I **shipped the citekey-charset bug in the first adapter pass** by following the handoff's "reuse `crossrefCompletionContext`" advice literally without checking that citekeys have a wider character grammar than cross-ref ids — a moment's thought about "do `:`/`.` keys fit `[A-Za-z0-9_-]`?" would have pre-empted it before the review (it's the precise trap Learning #15 had already flagged once). Likewise the YAML-edge defects (zero-indent list, trailing comment) were foreseeable from "real front matter is messier than the fixture." Both caught and fixed in-session, but they cost review cycles. Residual: the completion **popup's visual feel** is F5-unverified (no `code` CLI) — behavior is fully integration-proven; only pixels are unverified (stated honestly, not a skipped Phase 3E).

#### Session 8 Handoff Evaluation (by Session 9) — Phase 3A
**Score: 9/10.** An excellent, precise handoff — I was building the front-matter reader within minutes and nearly every pointer held.
- **What helped:** The ACTIVE TASK named the deliverable, the plan line, the §3.3 guardrail, and a clean 6-step recipe. The single most valuable items: **"the region model SKIPS front matter, so you need to read it — a minimal `bibliography:`-only reader is likely enough; decide and flag up front"** (I did exactly that, commit 2) and **"make the fixture render-clean — doc-level `execute: enabled: false`"** (Learning #15 gotcha #2 — saved a debugging detour; `citations.qmd` rendered exit 0 first try). The "mirror `crossref.test.ts`, faithful via `executeCompletionItemProvider`" pointer was exactly right, and the coexistence note (both providers on `@`, editor filters) held precisely — the coexistence integration test passed first try. Test-count baselines (150 unit / 34 integration, 9-file `.vsix`) all matched reality.
- **What was slightly off (a 6c-specific discovery, now Learning #16 — not Session 8's fault):** the handoff's step 3 said **"reuse `crossrefCompletionContext` … a bare `@key` is detected the same way."** It is detected the same way *for the happy path*, but citekeys have a **wider character grammar** (`:`/`.`) than cross-ref ids, so verbatim reuse broke completion for biblatex/DBLP keys (review finding C). The advice was reasonable and worked for the demo; the charset mismatch is a genuine discovery. I followed it literally and paid a review cycle — my lapse as much as the handoff's.
- **What was wrong:** Nothing material. Every file anchor (`crossref.ts`, `refs.ts` helpers, `extension.ts:28`), the verification approach, and the counts held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

### What Session 8 Did — 2026-06-27
**Deliverable:** Implement **Phase 6b** — Cross-reference completion + go-to-definition. **COMPLETE + verified + adversarially hardened.**

**What was done (8 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `4c9f1e8` chore: claim Session 8 (WIP stub).
2. `cc77e99` feat: Phase 6b **core model** — `Heading.id` (the `{#sec-id}` previously parsed-and-discarded is now kept structurally) + `findBodyLines()` (live prose/heading lines, for inline-label scanning), both consuming the single `scanRegions` pass (Learning #14). 2 TDD cycles.
3. `533cb1e` feat: Phase 6b **core refs** — new pure `src/core/refs.ts`: `indexLabels` (3 sources: heading `sec-` ids, `#|`/`//|` cell `label:` options, inline `{#fig-/tbl-/eq-/lst-…}` on body lines), `refIdAt`, `crossrefCompletionContext`, `findLabel`. 8 TDD cycles. **Also fixed a single-line-comment skip-region leak** surfaced by the Learning-#14 agreement test.
4. `2e9b580` feat: Phase 6b **adapter + wiring** — `src/providers/crossref.ts` (`registerCrossrefProviders`: CompletionItemProvider trigger `@` + DefinitionProvider) + `src/extension.ts:29`; faithful integration test via `executeCompletionItemProvider`/`executeDefinitionProvider` over a new `crossrefs.qmd`.
5. `5ea7818` fix: review hardening (refs) — A/C/I/H (idColumn lastIndexOf; cell-label id grammar + quotes; skip heading lines in Source 3; mask inline code spans) + E-core (`crossrefCompletionContext.end`).
6. `4d4fc97` fix: review hardening (model) — J: tempered single-line-comment regex (greedy `.*` was swallowing content between two same-line comments).
7. `9a1b75b` fix: review hardening (providers) — E (whole-token `{inserting,replacing}` range) + F/G (gate both providers to prose via new `isReferenceableLine`); in-cell fixture + tests.
8. `95d065f` docs: defer indented-code-block phantom (B/D) as a known limitation (model docstring + backlog).
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #15, CHANGELOG/ROADMAP/BACKLOG; + a dashboard refresh.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 29.3 KB → **36.3 KB**, +refs+providers).
- `npm test` → **150/150** vitest (+39: 35 in new `refs.test.ts`, +4 model). The 17 cell tests + model tests held throughout (regression net).
- `npm run test:integration` → **34/34** in the real downloaded VS Code: 9 crossref tests via `executeCompletionItemProvider`/`executeDefinitionProvider` — completes all 6 labels; resolves go-to-def to heading + cell-label; **no completion/definition inside a `{python}` cell** (with a prose control); whole-token replace range — all env-independent (no CLI/Jupyter).
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).
- Both fixtures (`crossrefs.qmd`, `crossrefs-incell.qmd`) render **exit 0**.
- §3.3 guardrail: `grep vscode src/core/` → none. Providers import core, never the reverse.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #15):**
- **Three label sources, one scanner.** `core/refs.ts` builds its index entirely on `findHeadings`/`findAllCells`/`findBodyLines` (all views over `scanRegions`) — no third scanner. The Learning-#14 agreement test (label-like text in front matter / comments / fences must NOT be indexed) is the guard; it immediately caught a **single-line `<!-- … -->` comment leak** (only block comments were skipped before).
- **The jupyter-engine render trap.** A python-only `.qmd` with per-cell `#| eval: false` STILL fails `quarto render` in this shell (no `nbformat`) — the **jupyter engine ignores per-cell eval:false at kernel-start**. `sample.qmd` only rendered clean because its `{r}` cell selects the **knitr** engine. Fix for python-only fixtures: doc-level **`execute: enabled: false`** in front matter.
- **The adversarial review earns its keep again.** A 5-lens / refute-by-default workflow found **10 findings, all confirmed by two independent verifiers** (several traced through the real code AND `quarto render`). 7 fixed with TDD; 1 (indented-code-block phantom) deferred with documentation.

**Adversarial review outcome (5 lenses, 2 refute-by-default verifiers each; 10 confirmed):**
- **Fixed 7** (TDD, commits `5ea7818`/`4d4fc97`/`9a1b75b`): A idColumn `lastIndexOf`; C cell-label id grammar + optional YAML quote; I skip heading lines in inline Source 3; H mask inline backtick code spans; J tempered single-line-comment regex; E whole-`@id`-token replace range; F/G gate both providers out of code cells / front matter / comments (`isReferenceableLine`).
- **Deferred 1** (documented, BACKLOG + model docstring): B/D inline `{#fig-…}` inside a CommonMark §4.4 *indented* (4-space) code block is a phantom — a faithful fix must not false-skip 4-space list-item continuation content (model tracks no list context), so it needs its own list-aware TDD pass. Low severity.

**Key files (with anchors):**
- `src/core/refs.ts` — `indexLabels` (`:78`, 3 sources + sort + dedupe), `findLabel` (`:~140`), `isReferenceableLine` (`:~150`, prose/heading gate for the providers), `refIdAt` (`:~165`), `crossrefCompletionContext` (`:~190`, returns `{start, typed, end}`), `maskInlineCode`/`idColumn` (`:~210`/`:~230`). Regexes `:44–66`. Pure.
- `src/core/qmd/model.ts` — `Heading.id` (`:18`), `findBodyLines` (`:~245`), `scanRegions` adds `bodyLines` + the `COMMENT_FULL_LINE` tempered regex (`:~118`). Known-limitations docstring `:11`.
- `src/providers/crossref.ts` — `registerCrossrefProviders` (`:24`); completion gates on `isReferenceableLine` + builds `{inserting, replacing}` range (`:40`); definition gates + resolves via `findLabel` (`:~90`). Adapter.
- `src/extension.ts:29` — `registerCrossrefProviders(context)`.
- `test/unit/refs.test.ts` (35) · `test/integration/suite/crossref.test.ts` (9, incl. in-cell guard + `replaceRange` helper). Fixtures: `crossrefs.qmd`, `crossrefs-incell.qmd`.

**Gotchas for the next session (Phase 6c):**
1. **Reuse `crossrefCompletionContext` + `isReferenceableLine`** from `core/refs.ts` — a bare `@key` citation is detected the same way, and citations are prose-only too. Don't re-derive the `@` context.
2. **Render trap (above):** make any `{python}`-cell fixture render-clean with doc-level **`execute: enabled: false`** (per-cell `eval: false` is NOT enough for the jupyter engine). `sample.qmd` only escapes it via its `{r}` cell (knitr engine).
3. **Reading `bibliography:` means reading FRONT MATTER** — the region model deliberately skips it, so 6c needs a small front-matter reader. No YAML lib is in the project; a minimal `bibliography:`-only parser is likely enough for v1 (decide and flag up front).
4. **6b + 6c completion providers coexist on `@`** — VS Code merges them; the editor filters by typed text. Just register both; no conflict.
5. **Deferred from 6b (NOT bugs in handled input):** indented-code-block phantom (B/D, backlog) and setext headings (Phase 6a, backlog). If a 6c fixture needs them, it won't behave — use ATX headings and fenced/inline constructs.
6. **`npm audit`** still 7 dev-only vulns (none ship). No git remote → `vsce package` needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 8): 9/10.**
- **+** Delivered exactly Phase 6b's scope, no bundling (FM #18 held — stopped before 6c). **Strict TDD held throughout** — RED observed before every GREEN across 10 core cycles + every review fix (incl. re-running the integration suite to see the 3 provider-fix failures RED before implementing). Kept §3.3 (pure `core/refs.ts`; thin adapter; grep-verified). **Consumed the shared scanner** (Learning #14) — `core/refs.ts` writes no line logic of its own; the agreement test caught a real single-line-comment leak mid-implementation. **Faithful, env-independent verification** via `execute*Provider` (incl. discriminating negative + control tests: no completion/definition inside a cell, with a prose control that still resolves). Ran an adversarial review whose verification was genuinely discriminating (verifiers reproduced findings against the real code AND `quarto render`); fixed 7 with TDD and deferred 1 with honest documentation rather than risking a list-unaware shared-scanner change. Caught + documented the jupyter-engine render trap.
- **−** I shipped several real defects in the first adapter pass that the happy-path tests missed — most notably the **providers firing inside code cells** (F/G) and the **mid-token replace-range duplication** (E), both of which a moment's thought about "where does this provider fire / what does accept replace?" would have pre-empted before the review. The **review's confirmation gate was lenient** (≥1 real, ties→confirmed) — it happened that both verifiers voted real on all 10, so no false-confirm slipped through, but I adjudicated each by hand rather than trusting the count (correct, but a strict-majority gate would have been cleaner up front). Residual: the completion **popup's visual feel** is F5-unverified (no `code` CLI) — behavior is fully integration-proven; only the rendered popup is cosmetic-unverified (stated honestly, not a skipped Phase 3E).

#### Session 7 Handoff Evaluation (by Session 8) — Phase 3A
**Score: 9.5/10.** An outstanding, precise handoff — I was extending the model within minutes and nearly every pointer held exactly.
- **What helped:** The ACTIVE TASK named the deliverable, the plan line, the §3.3 guardrail, and the **exact first step** — *"the `{#sec-id}` is parsed-and-discarded in `parseHeadingLine`; 6b's first job is to keep it; the matching test to update is 'Pandoc/Quarto heading attributes'"* — which I followed verbatim (Cycle 1). The single most load-bearing item: **Learning #14 "consume `scanRegions`, don't write a third scanner; parsers that overlap must agree on skip-regions"** — that shaped the whole `core/refs.ts` design (three sources, all views over the one scan) and the agreement test it prescribed immediately caught a real single-line-comment leak. The "provider-via-`execute*Provider` is the faithful test, mirror `outline.test.ts`" pointer was exactly right. Test-count baselines (111 unit / 25 integration, 9-file `.vsix`) all matched reality.
- **What was missing / worth correcting (all 6b-specific discoveries, now Learning #15):** it couldn't have flagged (a) the **jupyter-engine render trap** (per-cell `eval:false` doesn't avoid the kernel for a python-only doc — cost a debugging detour on the fixture), or (b) that the cross-ref **completion/definition providers must be gated out of code cells** (the adversarial review caught it). Neither is Session 7's fault.
- **What was wrong:** Nothing material. Every file anchor, the parsed-and-discarded claim, the verification approach, and the counts held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

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
