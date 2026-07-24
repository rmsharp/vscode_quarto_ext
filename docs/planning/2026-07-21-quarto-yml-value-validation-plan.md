# Plan — VALUE validation for `_quarto.yml` project-config CONTAINERS (`project:`/`website:`/`book:`)

*Session 134 (PLANNING). Deliverable = this document only; implementation is a separate
session (FM #18/#19 — NO code shipped this session). Governs: `SESSION_RUNNER.md`
§Planning Sessions + `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`, under the
project-wide strict-TDD gate.*

The value-validation family's **sixth** widening, and the FIRST on a NEW SURFACE: cell → S124,
top-level `.qmd` → S125, nested `execute:`/`format:` → S128, numeric-across-surfaces → S130,
15 other `.qmd` containers → S132. All five prior slices live on the **document** surface
(`.qmd` front matter, languageId `"quarto"`). This slice reaches the SIBLING surface the S131/S132
work explicitly grounded OUT and deferred: the **project-config** surface (`_quarto.yml`/
`_quarto.yaml`, filename-gated), whose `project:`/`website:`/`book:` blocks resolve against a
DIFFERENT schema (`schema/project.yml`) that the existing unknown-KEY feature already owns.

---

## §0 — Decision at a glance

- **What ships:** a wrong VALUE of a recognized one-level child of `project:`/`website:`/`book:`
  in `_quarto.yml` (`draft-mode: hidden`, `downloads: mobi`, `sharing: mastodon`, `repo-actions:
  fork`, `execute-dir: banana`) shows an **Error** squiggle matching `quarto render` 1.7.33's
  `_quarto.yml`-schema-validation layer (`readAndValidateYamlFromFile`). Emits nothing for valid
  values, open-string children (`website.title`, `book.description`, `project.output-dir`), flow
  sequences, unknown keys, `manuscript:`, or offline.
- **This slice is HEAVIER than the S132 sibling — three genuinely-new pieces, not two edited
  lines.** The project surface resolves only key NAMES today (`projectKeys` → `Set<string>`); it
  has NO per-child value-schema annotation, and the general `frontMatterKeys` length-1 reader does
  NOT reach it (§1.3, §3). So the slice adds: **(1)** a project-child FIELD resolver (super-chain-
  aware) exposing annotated `SchemaField[]` per container; **(2)** a scanFlow-aware VALUE-line
  enumerator for bare `_quarto.yml`; **(3)** a thin filename-gated value-diagnostics feature. All
  three REUSE the shipped matcher (`isWrongValue`), message (`valueMessage`, relocated to the pure
  core), debounce skeleton, and annotation functions (`annotateClosedness`/`annotateScalarType`).
- **The surface is MODEST but real (honest framing, §8).** 16 grounded (container, child)
  positions / 10 distinct names — ~5 genuinely-useful string enums (`draft-mode`, `repo-actions`,
  `downloads`, `sharing`, `execute-dir`) + `book.type` + 4 booleans. The RICHER project-config
  surface is DEEPER (options under `navbar:`/`sidebar:`/`search:` at depth 2+), which needs a
  deeper enumerator than v1's one-level scope — deferred (§4.3). v1 closes a real gap on the
  operator's dominant multi-file/book workflow: these typos currently fail `quarto render` with no
  editor feedback.
- **Cardinal-sin safety established firsthand (§2.1).** Every one of the 16 marked-closed children,
  given an off-list value, makes `quarto render` exit 1 at the SCHEMA layer; every open child
  renders exit 0. Zero closedness FPs. The one live risk is the **scanFlow FP** (a mapping-looking
  line inside a multi-line quoted value — PROVEN exit-0 firsthand, §2.3) — the new enumerator MUST
  be `scanFlow`-aware, and the MANDATORY §9 review re-hunts it.
- **`project.type` is the calibration trap — deliberately NOT flagged (§2.2).** It is
  `{string:{completions:[…]}}` → schema-OPEN; `project.type: banana` exit-1s DOWNSTREAM
  (`ERROR: Unsupported project type banana`), not at the schema layer. Mirroring only the schema
  layer (Learning #142), we must NOT flag it — and must NOT curate it closed (that would flag a
  value the SCHEMA accepts = the cardinal sin).

---

## §1 — Context

### 1.1 Problem

The value-validation feature flags a wrong VALUE of an already-*recognized* key whose schema is
provably CLOSED. Five shipped slices cover the **document** surface (`.qmd`), all gated on
languageId `"quarto"` and all resolving keys through `frontMatterKeys`/`cellOptions`. But
`_quarto.yml` is a **different surface**: a bare YAML file (no `---` fences), filename-gated, whose
`project:`/`website:`/`book:` blocks validate against `schema/project.yml`. Today that surface has
an unknown-KEY feature (`features/yaml-diagnostics.ts`) but **no value validation at all** — a
typo like `website:\n  draft-mode: hidden` or `book:\n  downloads: mobi` fails `quarto render`
(exit 1, schema-validation) with no editor squiggle. This is the value family's first cross-surface
gap (the S131/S132 handoffs filed it explicitly as "a DIFFERENT surface the KEY-checking side owns").

### 1.2 Constraints (standing, binding)

- **Strict TDD** (project-wide gate). Red → Green → Refactor, one behavior at a time.
- **Cardinal-sin rule (absolute).** NEVER flag a value quarto accepts at its schema layer. Only
  fields whose schema is provably closed (`valuesClosed===true`) or numeric (`scalarType==="number"`)
  are ever checked; any string/open arm → left open → never flagged. Inherited unchanged from
  `isWrongValue`.
- **Mirror only quarto's `_quarto.yml`-SCHEMA layer** (Learning #142). Do NOT chase downstream
  errors — `project.type: banana` fails at `projectType()`, NOT `readAndValidateYamlFromFile`, so
  it is out of scope (§2.2).
- **One shared matcher + message, no new matcher/predicate.** Reuse `isWrongValue` and `valueMessage`
  verbatim (relocate `valueMessage` to the pure core so both surfaces import it).
- **≤5 files per checkpoint commit** (blast radius).

### 1.3 Current state — what already exists (build on it, do NOT rebuild)

- **The project surface resolves NAMES ONLY.** `SchemaIndex.projectKeys(container)`
  (`src/core/yaml-schema.ts:494/:594`) returns a `Set<string>` of valid key names (or `null`),
  built by `buildProjectConfigKeys` (`:1164`) → `resolveClosedKeys` (`:1072`) →
  `resolveClosedKeysObject` (`:1124`). That resolution **walks the `super`/`resolveRef` merge chains**
  (`website:`/`book:` merge through `base-website` and `csl-item-shared`) — but it collects only the
  property **names**, discarding each property's value schema. There is **no** per-child closedness/
  enum/scalarType anywhere on this surface.
- **The document surface's general reader does NOT reach the project surface.** `frontMatterKeys`'s
  general length-1 branch (`:565`, S132) returns `topLevelFields.find(name).children` — but
  `topLevelFields` is the `schema/document-*` field set; `project`/`website`/`book` are absent from
  it (they live in `schema/project.yml`). So `frontMatterKeys(["website"])` → `[]`.
- **`resolveObjectProperties` (what `objectChildren` uses, `:1002`) does NOT handle `super`/
  `resolveRef`** — only `object`/`anyOf`/`ref`/`maybeArrayOf`/`schema`. So naively running
  `objectChildren` on a project container would MISS every super-merged child (website/book resolve
  almost entirely through super). This is why the S132 "reuse the already-annotated `.children`"
  trick does NOT transfer — the project children are not annotated anywhere.
- **The KEY enumerator is one-level and NOT scanFlow-aware.** `findProjectConfigKeyLines`
  (`src/core/project-yaml.ts:58`) enumerates direct child KEY lines under `project:`/`website:`/
  `book:` (one indent level; deeper nesting / dedents / sequence items skipped), returning
  `{line, container, key, keyRange}` — no value token, no `scanFlow`. (Its lack of `scanFlow` is a
  latent FP on the KEY side too — out of scope, §4.3.)
- **The matcher + skeleton are surface-agnostic and reusable UNCHANGED.** `isWrongValue`
  (`src/core/yaml-value-check.ts:46`) validates a raw token against any annotated `SchemaField`
  (leading-`[`/`{`/`|`/`>`/`&`/`*`/`!` skip FIRST → numeric branch → closed-enum membership; booleans
  via the six spellings). `createDebouncedDiagnosticsFeature` (`src/features/debounced-diagnostics.ts:93`)
  supplies the `DiagnosticCollection` lifecycle + 350 ms debounce + per-URI guard, parameterized by a
  `gate` (filename here) and a `compute`. `valueMessage` (`src/features/yaml-value-diagnostics.ts:179`,
  currently PRIVATE) already covers enum/boolean/numeric arms.
- **`scanFlow`** (`src/core/qmd/model.ts:648`, exported) is the shared quote/flow-aware, node-
  property-aware line scanner all three document enumerators use; it is pure and works on bare YAML
  lines (no fence assumption).

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 / the actual parser)

*All grounded firsthand this session: (a) a harness mirroring the parser's resolution EXACTLY
(`valuesOfSchema`/`closednessOfSchema`/`numericTypeOfSchema` ports) but with the `super`/`resolveRef`
merge `resolveObjectProperties` lacks, run over the installed `schema/project.yml`; (b) `quarto render
--to html` of real website/book project probes, ~25 invalid + valid + calibration.*

### 2.1 The parser's closedness annotation is FAITHFUL — zero FPs across 16 positions

The actual `schema/project.yml` marks **16 (container, child) positions** (10 distinct names) as
closed enums / booleans. **Every one, given an off-list value, makes `quarto render` exit 1 at the
`_quarto.yml`-schema layer** (`ERROR: Project …/_quarto.yml validation failed. Field "X" has value
Y, which must instead be one of: …` / `… must instead be true or false`). No open child is
mis-marked: open strings (`website.title`, `book.description`, `project.output-dir` path) render
exit 0 on the same garbage token. This is the cardinal-sin guarantee, established firsthand per
container.

### 2.2 The grounded closed-child inventory (depth-1 — the v1 target)

| container | validatable one-level children (parser kind) |
|---|---|
| `project` | `execute-dir` enum[file, project] |
| `website` | `back-to-top-navigation` bool, `bread-crumbs` bool, `draft-mode` enum[visible, unlinked, gone], `page-navigation` bool, `reader-mode` bool, `repo-actions` enum[none, edit, source, issue] (maybeArrayOf[enum]) |
| `book` | the **6 website children** (via `super base-website`) + `downloads` enum[pdf, epub, docx], `sharing` enum[twitter, facebook, linkedin], `type` enum[CSL 45-value: article, book, chapter, …] (via `super csl-item-shared`) |

**Containers / children ruled OUT (empirical scope correction — the executor must NOT re-add them):**

- **`project.type`** — `{string:{completions:[default, website, book, manuscript]}}` → schema-OPEN.
  `project.type: banana` renders exit 1, but the error is `ERROR: Unsupported project type banana`
  from `projectType()` — a DOWNSTREAM error, NOT `readAndValidateYamlFromFile`. We mirror only the
  schema layer (Learning #142), so `project.type` stays OPEN and unflagged (a documented safe FN).
  **Do NOT hand-curate it closed** — the schema validator ACCEPTS any string there, so flagging
  `banana` would be a cardinal-sin FP on a value quarto's schema layer accepts.
- **`manuscript:`** — 0 closed one-level children (grounded). Also absent from the KEY feature's
  scope (`PROJECT_CONFIG_CONTAINERS = {project, website, book}`). Out of scope.
- **Depth-2+ children** — two sub-classes, both DEFERRED (need a deeper-than-one-level enumerator):
  **(i)** `project.preview.{browser, navigate, watch-inputs}` — closed booleans reachable through the
  SAME `super`/`ref` resolution as depth-1 (grounded: `project:\n  preview:\n    browser: banana` →
  exit 1 SCHEMA "must instead be `true` or `false`"); the CHEAPER depth-2 target (the reader already
  resolves them). **(ii)** `website.navbar.*` / `website.sidebar.*` / `website.search.*` — resolve
  through `anyOf`, which neither the harness's one-level walk nor the current resolver reaches; the
  richer surface, but harder. Deferred (§4.3).
- **Broader `_quarto.yml` document keys** (`execute:`/`format:`/any document front-matter key placed
  in `_quarto.yml` to apply project-wide) — schema-validated TODAY with no editor feedback (grounded:
  `_quarto.yml` with `execute:\n  echo: banana` → exit 1 SCHEMA), because the document value features
  are languageId-`"quarto"`-gated and never run on bare `_quarto.yml`. Split by distance: **`execute:`**
  is depth-1 and its children are ALREADY resolved by the document reader (`frontMatterKeys(["execute"])`,
  §1.3), so it is a near-term win once an enumerator routes the container to the document reader;
  **`format:`** is genuinely nested (harder). A DIFFERENT surface from the three project containers;
  deferred (§4.3).

### 2.3 Safe false negatives (documented, deferred — NOT flagged, by design)

- **The scanFlow continuation class** (the load-bearing risk, §7.3): a mapping-looking line inside
  a multi-line quoted value is folded into the value by quarto. Firsthand: `website:\n  title: "a
  long title that wraps\n    draft-mode: not-a-real-value here"` renders **exit 0** — the
  `draft-mode:` is part of the quoted title string. A naive line-scanner flags it (cardinal-sin FP).
  The enumerator's `scanFlow` guard turns this into a correct non-flag; if `scanFlow` ever missed a
  form, over-skipping is the safe (FN) direction.
- **Flow-sequence values** (`repo-actions: [edit, source]`, and even `[edit, fork]`): the matcher's
  leading-`[` guard skips the whole flow collection → safe FN (we never flag a member typo inside a
  sequence). A scalar `repo-actions: fork` IS flagged. Identical to the document surface's
  `fig-align` (`maybeArrayOf[enum]`).
- **Curated-fallback / offline path**: `CURATED_PROJECT_CONFIG_KEYS` has no per-child closedness, so
  `projectFields` returns `[]` offline → value validation silently no-ops (the same offline deferral
  every value slice noted).

---

## §3 — Decision (architecture)

### 3.1 Feature shape — a new value SOURCE on a new surface, reusing the shared matcher

The family invariant holds (position ⊥ data): an enumerator emits `{container, key, rawToken,
valueRange}`; a reader decides what the name resolves to; the shared `isWrongValue` decides if the
value is wrong; the shared `valueMessage` phrases the error. This slice adds a new enumerator + a new
reader on a new surface, then feeds the SAME matcher + message. No new matcher, predicate, or message.

### 3.2 The three changes

**(A) Reader — annotated project-child fields (`src/core/yaml-schema.ts`).**
Add `SchemaIndex.projectFields(container: "project"|"website"|"book"): SchemaField[]` returning the
container's one-level children as fully-annotated `SchemaField[]` (`values` + `valuesClosed` +
`acceptsBoolean` + `scalarType`), or `[]` when unresolved / curated-fallback. Build it by
**refactoring the EXISTING project resolution to keep each merged property's schema, then annotating
each** — reusing `valuesOfSchema` + `annotateClosedness` + `annotateScalarType` (the exact functions
the document surface uses):

- Change `resolveClosedKeys*` (or add a parallel walk) to return the super-merged property→schema
  **map**, not just names. `resolveClosedKeysObject` (`:1124`) ALREADY merges `super` by union — thread
  the schemas through instead of discarding them.
- `projectKeys(container)` keeps returning `names` (derive from the map's keys — behavior unchanged,
  regression-guarded).
- `projectFields(container)` maps each `(name, schema)` → a `SchemaField` via
  `valuesOfSchema`/`annotateClosedness`/`annotateScalarType`. A container whose resolution did not
  prove closed still yields fields (each child individually annotated) — only genuinely closed
  children get `valuesClosed`, so the matcher fires only on them.
- Curated fallback: `projectFields` returns `[]` for all three (no per-child closedness offline).

*Rationale for a project-SCOPED resolver rather than extending the shared `resolveObjectProperties`
to handle `super`:* extending the shared resolver would ALSO change `objectChildren` on the DOCUMENT
surface (new completions / new value validations on any document container that uses `super`) — a
wider blast radius on shipped behavior. Keeping the super-walk project-scoped isolates the change
(§6).

**(B) Enumerator — a scanFlow-aware value-line scanner (`src/core/project-yaml.ts`).**
Add `findProjectConfigValueLines(text): ProjectConfigValueLine[]` returning
`{line, container, key, valueRange, rawToken}` for each one-level child of `project:`/`website:`/
`book:` that carries a non-empty scalar value — structurally the bare-YAML analogue of
`findNestedFrontMatterValueLines` (`src/core/yaml-frontmatter-nested-values.ts:62`): container tracked
by the column-0 header (as `findProjectConfigKeyLines` does), value slot via `valueSlotAfterColon`,
and — **critically — `scanFlow` continuation-skip** (arm on a value that opens an unclosed flow
collection or quoted scalar; skip continuation lines). `findProjectConfigKeyLines` stays UNCHANGED
(its own scanFlow gap on the KEY side is a separate pre-existing item, §4.3).

**(C) Feature — a thin filename-gated value-diagnostics feature (`src/features/`).**
Add `registerYamlProjectValueDiagnosticsFeature` (new module, e.g.
`features/yaml-project-value-diagnostics.ts`): reuse `createDebouncedDiagnosticsFeature` with
`gate = isProjectConfigDocument` (filename), a new collection `"quarto-project-value"` + code
`"quarto-invalid-project-value"`, and a `compute` that runs `findProjectConfigValueLines`, resolves
each line's key via `index.projectFields(container).find(f => f.name === key)`, and emits an Error via
`isWrongValue` + `valueMessage`. Register it in `extension.ts` beside the other two. Relocate
`valueMessage` from `yaml-value-diagnostics.ts` to the pure `yaml-value-check.ts` (beside
`isWrongValue`) and export it, so both surfaces import one message function.

*A separate feature (not folding value diagnostics into the existing KEY feature's compute) is
recommended: it mirrors the document surface's clean key/value separation, leaves the shipped KEY
feature UNTOUCHED (lower risk), and is independently testable. The cost — a second debounced pass +
index-fetch on the same small `_quarto.yml` — is negligible (§6).*

### 3.3 Data flow (new source, shared tail)

```
_quarto.yml text
  → findProjectConfigValueLines           (NEW; scanFlow-aware; one level under project/website/book)
  → compute: index.projectFields(container) (NEW reader; super-aware, annotated SchemaField[])
      .find(name===key) → isWrongValue      (UNCHANGED matcher)
      → valueMessage                        (RELOCATED to pure core; enum/bool arms cover all 16)
  → Error squiggle at valueRange            (filename-gated feature; own collection/code)
```

---

## §4 — Scope: the vertical slice (ONE implementation session)

### 4.1 The layer set (gate-(a) contract — build in this order, checkpoint-commit each)

- **L1 (core reader) — `projectFields` + the super-aware field resolution.** INERT (no enumerator/
  feature reaches it yet), independently unit-testable.
  DONE: `projectFields("website")` returns `draft-mode` (closed, values [visible,unlinked,gone]),
  `reader-mode` (closed, acceptsBoolean), `title` (OPEN, no `valuesClosed`); `projectFields("book")`
  includes `downloads`/`sharing`/`type` (closed) AND the 6 website children (super-merged);
  `projectFields("project")` returns `execute-dir` closed and `type` OPEN (string:completions);
  the curated fallback returns `[]`. `projectKeys` unchanged (regression row).
  Verify: new unit tests in `test/unit/yaml-schema-index.test.ts` (RED first — `projectFields`
  absent / returns `[]`); `npm run test:unit`; `npm run check-types`.

- **L2 (core enumerator) — `findProjectConfigValueLines` (scanFlow-aware).** INERT, unit-testable.
  DONE: enumerates `{container, key, rawToken, valueRange}` for one-level scalar children under
  project/website/book; the value span is exact; a multi-line quoted value's continuation line is
  SKIPPED (the §2.3 FP case — RED first: without `scanFlow`, the embedded `draft-mode:` line is
  enumerated); a flow-sequence value is enumerated as a `[…]` token (the matcher skips it, not the
  enumerator); deeper nesting / dedents / sequence-item lines / unknown top-level containers all
  skipped.
  Verify: new unit tests in `test/unit/project-yaml.test.ts` (RED first); `npm run test:unit`;
  `check-types`.

- **L3 (feature wiring + integration) — GO-LIVE.** The new `registerYamlProjectValueDiagnostics
  Feature` + the `valueMessage` relocation to `yaml-value-check.ts` + `extension.ts` registration +
  two `_quarto.yml` fixtures + an integration `describe`. Diagnostics go live HERE.
  Fixtures under `test/fixtures/yaml-project-value/` (each a dir with a `_quarto.yml`, mirroring
  `test/fixtures/yaml-diagnostics/{valid,invalid}/`): `invalid/_quarto.yml` (FLAG cases across all
  three containers — `website.draft-mode: hidden`, `website.repo-actions: fork`, `book.downloads:
  mobi`, `book.sharing: mastodon`, `project.execute-dir: banana`) and `valid/_quarto.yml` (the FP
  battery — valid closed values + open strings `website.title`/`book.description` + a multi-line
  quoted `title:` with an embedded `draft-mode:`-looking line + a flow-seq `repo-actions: [edit,
  source]` + `project.type: whatever` [open] — all exit 0, zero diagnostics).
  DONE: both fixtures render firsthand per §2.1 (invalid exit 1 SCHEMA, valid exit 0); the
  integration `describe` (modeled on `test/integration/suite/yaml-diagnostics.test.ts`) asserts an
  Error at each flag's exact value span and ZERO on the valid fixture; `valueMessage` moved with its
  own unit rows; `projectKeys`/document-surface value diagnostics unregressed.
  Verify: `npm run test:integration`; `npm run test:unit`; `check-types`; both fixtures render
  firsthand.

- **L4 (MANDATORY §9 adversarial review + TDD fixes).** See §9. Non-negotiable; it caught a real
  cardinal-sin FP in S124/S125/S128/S130 (S132 was clean for a structural reason — but this slice
  adds a NEW enumerator, so the scanFlow FP surface is genuinely live again).
  DONE: L4 == §9's outcome — a fresh multi-lens review AND the author's firsthand sweep return CLEAN
  (or every finding fixed TDD + re-verified), full matrix green, both fixtures re-rendered post-fix.
  Verify: the §9 checklist; `check-types` + `test:unit` + `test:integration` green.

### 4.2 This is a vertical slice, NOT horizontal (pre-empting an FM #25 misread)

L1 (reader) and L2 (enumerator) are BOTH inert until L3 wires the feature — because this surface,
unlike S132, has neither an annotated reader nor a value enumerator to reuse. This is still ONE
capability (project-surface value validation) with a pre-declared layer set, each layer independently
unit-tested and checkpoint-committed. The "if I stop here, does something work?" test passes at each
boundary: after L1 the reader works (unit-tested), after L2 the enumerator works (unit-tested), after
L3 the feature is live end-to-end. Two inert core layers before go-live is the shape the surface
requires, not horizontal slicing.

### 4.3 Deferred to a later session (filed to `BACKLOG.md`, NOT built here)

- **Depth-2+ project-config values**, two tiers: **(i)** `project.preview.*` (closed booleans, reachable
  via the current super/ref resolution — the cheapest deferred win, grounded exit-1 §2.2); **(ii)**
  `website.navbar.*` / `website.sidebar.*` / `website.search.*` (the richer closed surface, needing
  `anyOf` resolution + a deeper enumerator). Both need a deeper-than-one-level enumerator than v1.
- **Broader `_quarto.yml` document-key values**, split by distance: **`execute:`** children in
  `_quarto.yml` are schema-validated today with no editor feedback AND already resolved by the document
  reader (`frontMatterKeys(["execute"])`) — a near-term win once an enumerator routes `_quarto.yml`'s
  `execute:` block to the document reader; **`format:`** is genuinely nested (harder). A different
  surface from the three project containers.
- **`.ipynb` project values** — N/A (project config is a bare YAML file, not a notebook), but the
  general `.ipynb` value cliff still stands for document front matter.
- **The KEY enumerator's scanFlow gap** — `findProjectConfigKeyLines` is not scanFlow-aware, so a
  multi-line quoted value could hide a `key:`-looking line and produce an unknown-KEY FP. Pre-existing,
  separate feature; adjacent to CHANGELOG: createDebouncedDiagnosticsFeature extraction, Session 126`. Note only.
- **Fallback subsetting:** if L4 finds a per-child FP that cannot be cleanly fixed, drop the offending
  child(ren) from the closed set (e.g. skip `book.type` if the CSL 45-enum causes trouble) and defer —
  the reader is general, so subsetting is a small change. The slice stays recoverable.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped this session)

| Symbol / site | File:line | Change |
|---|---|---|
| `SchemaIndex` interface | `src/core/yaml-schema.ts:462-495` | ADD `projectFields(container): SchemaField[]` |
| `projectKeys` impl | `src/core/yaml-schema.ts:594` | KEEP behavior; derive names from the new merged map |
| `resolveClosedKeys*` | `src/core/yaml-schema.ts:1072-1153` | REFACTOR to keep property→schema (super-merged), not just names |
| `buildProjectConfigKeys` | `src/core/yaml-schema.ts:1164-1185` | EXTEND to also build annotated `SchemaField[]` per container |
| `annotateClosedness` / `annotateScalarType` / `valuesOfSchema` | `:872` / `:970` / `:729` | REUSE — annotate each project child |
| `CURATED_PROJECT_CONFIG_KEYS` / `CURATED_SCHEMA_INDEX` | `:448` | `projectFields` → `[]` (no per-child closedness offline) |
| `findProjectConfigValueLines` (NEW) | `src/core/project-yaml.ts` (beside `findProjectConfigKeyLines:58`) | ADD — scanFlow-aware value-line enumerator |
| `findProjectConfigKeyLines` | `src/core/project-yaml.ts:58` | UNCHANGED |
| `scanFlow` / `FlowState` | `src/core/qmd/model.ts:648` / `:618` | REUSE (import) |
| `leadingWsLen` / `mappingContainerKey` / `valueSlotAfterColon` | `src/core/yaml-context.ts:315` / `:294` / `:442` | REUSE |
| `isWrongValue` | `src/core/yaml-value-check.ts:46` | UNCHANGED (matcher reused) |
| `valueMessage` | `src/features/yaml-value-diagnostics.ts:179` → `src/core/yaml-value-check.ts` | RELOCATE to pure core + export; update the 3 call sites |
| `registerYamlProjectValueDiagnosticsFeature` (NEW) | `src/features/yaml-project-value-diagnostics.ts` | ADD — modeled on `features/yaml-diagnostics.ts` |
| `createDebouncedDiagnosticsFeature` | `src/features/debounced-diagnostics.ts:93` | REUSE (filename gate + value compute) |
| `isProjectConfigFileName` | `src/core/project-yaml.ts:32` | REUSE (the gate) |
| extension registration | `src/extension.ts:40-42, 80-82` | ADD the import + `register…(context)` call |
| Tests | `test/unit/yaml-schema-index.test.ts`, `test/unit/project-yaml.test.ts`, `test/unit/yaml-value-check.test.ts` (valueMessage rows), `test/integration/suite/yaml-project-value-diagnostics.test.ts`, `test/fixtures/yaml-project-value/{invalid,valid}/_quarto.yml` | ADD |

Grounding scratch (this session): `scratchpad/S134-findings.md`, `scratchpad/ground-project.cjs`
(the parser-mirroring, super-aware closed-child harness), `scratchpad/gp/{web,book}` (the render
probes).

---

## §6 — Alternatives considered (honest)

- **Hand-curate the 16 closed children** (like `CURATED_EXECUTE_KEYS`). Tempting because the set is
  small and stable. Rejected as the PRIMARY mechanism: the schema IS the ground truth and IS
  resolvable (my harness proved it), and curation drifts across quarto versions (a new
  `draft-mode` value would silently FN, or a removed one would FP). `execute` is curated only because
  the live schema assembles it across many files; the project containers do not have that problem.
  Kept as the documented FALLBACK if the super-walk proves fragile (§4.3).
- **Extend the shared `resolveObjectProperties` to handle `super`/`resolveRef`**, so `objectChildren`
  resolves project children for free. Rejected: it also changes `objectChildren` on the DOCUMENT
  surface (`toField`/completion), so any document container using `super` would gain newly-resolved
  children — new completions and possibly new value validations on SHIPPED behavior, an unreviewed
  blast radius. The project-scoped resolver isolates the change (§3.2 A).
- **Fold value diagnostics into the existing KEY feature's `compute`** (one debounced pass, one
  collection). Rejected: couples two concerns in one compute, touches the shipped KEY feature, and
  mixes a scanFlow-aware value loop with a non-scanFlow key loop. A separate feature is cleaner and
  lower-risk; the double-scan cost on a small config file is negligible.
- **`project.type` as a curated closed enum** (4 values). Rejected as a cardinal-sin violation:
  the schema layer treats it as `string:{completions}` (OPEN) and ACCEPTS any string; the failure is
  downstream. Flagging it would flag a value quarto's schema layer accepts (§2.2).
- **Reach depth-2 now** (`website.navbar.*` etc.). Rejected for v1: needs a deeper enumerator than
  the one-level project scanner; orthogonal effort, deferred (§4.3).

---

## §7 — Failure-mode analysis (the safety story)

1. **Cardinal-sin FP on a closed child.** Guarded by `isWrongValue`'s `valuesClosed`/`scalarType`
   precondition + §2.1's firsthand proof that all 16 marked-closed children are genuinely
   schema-rejected. Zero divergence found.
2. **FP on an OPEN child** (`website.title`, `project.type`, `book.description`). Guarded — the parser
   leaves strings/`string:{completions}` open; §2.1/§2.2 confirm exit 0 and not flagged. The valid
   fixture makes this a standing regression guard, `project.type: whatever` included.
3. **Latent ENUMERATOR scanFlow FP (the load-bearing risk, Learning #143).** PROVEN firsthand
   (§2.3): a mapping-looking line inside a multi-line quoted value renders exit 0; a naive scanner
   flags it. This slice adds a NEW enumerator, so — unlike S132 (which reused a hardened one) — this
   FP surface is genuinely live. The enumerator MUST carry `scanFlow`; L4's §9 review MUST re-hunt
   the bare-`_quarto.yml` document shapes (multi-line quoted values, flow collections, anchors/tags,
   sequences, block scalars) for any continuation misread as a mapping value. This is THE primary
   review target.
4. **Super-chain mis-resolution** (a website/book child dropped or wrongly merged). A DROPPED child →
   the reader returns no field → the matcher can't fire → a safe FN (missed validation, never an FP).
   A child wrongly marked CLOSED → a cardinal-sin FP — retired firsthand (§2.1 grounded every
   super-merged child, including book's csl-item-shared `type`), and re-hunted by L4.
5. **Flow-sequence values** (`repo-actions: [edit, source]`): the matcher's leading-`[` guard skips
   → safe FN. The valid fixture includes one as a standing guard.
6. **Name collisions across containers** (`website.repo-actions` vs `book.repo-actions`): resolution
   is per-container (`projectFields(container)`), so each returns only its own children. Never mark by
   bare name.
7. **`projectKeys` regression.** Refactoring the shared resolution to keep schemas must not change the
   name set `projectKeys` returns. A unit regression row (a known key set for `project`/`website`/
   `book` unchanged) guards it.

---

## §8 — Impact analysis

- **Users:** wrong values under `_quarto.yml`'s `project:`/`website:`/`book:` blocks get an Error
  squiggle before render (a real gap on the operator's dominant multi-file/book workflow). The surface
  is modest (16 positions, ~5 high-value string enums) — honest framing: this is a targeted gap-close,
  not the family's biggest coverage jump (S132 was 35 fields). No behavior change for valid documents.
- **Code:** three new pieces (a super-aware field resolver + method, a scanFlow-aware value enumerator,
  a thin feature) + a `valueMessage` relocation. Reuses the matcher, message, skeleton, and annotation
  functions. The shipped KEY feature and all document-surface value code are untouched.
- **Risk:** MEDIUM (higher than S132). Two genuinely-new core pieces (the super-walk and a new
  enumerator) each carry a cardinal-sin risk retired firsthand but re-hunted at L4. The scanFlow FP is
  live (new enumerator). Mitigated by firsthand grounding, the `scanFlow` reuse, the matcher's unchanged
  precondition, and the fallback-subset escape (§4.3).

---

## §9 — Verification plan (executor)

- **Per-layer:** the build/test matrix (`check-types`, `test:unit`, `test:integration`) at EACH
  checkpoint boundary; firsthand `quarto render` of both fixtures at L3.
- **Runtime smoke test (Phase 3E) — L3 is a runtime-behavior change** (a new feature registration):
  F5 the Extension Development Host, open a `_quarto.yml` with `website:\n  draft-mode: hidden`, and
  confirm the Error squiggle appears (and disappears when corrected). "Build clean" is necessary but
  not sufficient (FM #24). Isolate with `--disable-extensions` (Posit's `quarto.quarto` is installed
  and would otherwise co-diagnose — Learning #19).
- **MANDATORY §9 adversarial review (L4), non-negotiable.** A fresh multi-lens `quarto render`-verified
  `Workflow` AND the author's own firsthand sweep, INDEPENDENTLY, over: **(fp-hunt)** the new
  enumerator's real bare-`_quarto.yml` shapes for a scanFlow continuation misread (Learning #143 — the
  primary target, PROVEN live §2.3); **(closedness)** re-confirm all 16 marked-closed children reject
  off-list values and no open child (`project.type` especially) is flagged; **(super-resolution)**
  re-confirm book's super-merged children (base-website + csl-item-shared) resolve with correct
  closedness and the name set is unchanged; **(resolution/lifecycle/doc-drift)** the standard lenses.
  Every finding re-verified firsthand (render exit code + a matcher harness) before fixing, TDD.
  Confirm CLEAN verdicts rather than trusting them.
- **Grounding to reproduce:** `node scratchpad/ground-project.cjs` (the parser-mirroring, super-aware
  harness) enumerates the closed children; then `quarto render --to html` an invalid + valid probe per
  child in a real website/book project (`scratchpad/gp/{web,book}`) — the §2.1 result.

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

- **Q1 — reader-derived vs curated?** Recommendation: reader-derived (schema-resolved, super-aware),
  curation as the §4.3 fallback. The super-walk is the load-bearing implementation risk (§11 dragon 1).
- **Q2 — separate feature vs fold into the KEY compute?** Recommendation: separate feature (§3.2 C).
- **Q3 — include `book.type` (the CSL 45-enum)?** It IS schema-validated (grounded), so flagging a wrong
  value is correct, but it is an odd/rare field. Recommendation: include it (it's free once the reader
  resolves book's super chain); drop it via the fallback-subset if L4 finds it noisy.
- **Q4 — the four booleans** (`back-to-top-navigation`, `bread-crumbs`, `page-navigation`, `reader-mode`):
  low typo-likelihood but grounded-safe (exit 1 on a non-boolean). Include (identical code); the valid
  fixture guards them.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. **The super-walk is the load-bearing new code.** `resolveObjectProperties`/`objectChildren` do NOT
   handle `super`/`resolveRef` — website/book resolve almost entirely through them. Build the
   project-child resolver on the EXISTING `resolveClosedKeys*` super-merge (which already unions the
   names), threading each property's SCHEMA through so you can annotate it. Do NOT extend the shared
   `resolveObjectProperties` (it would change the document surface — §6).
2. **The enumerator MUST be `scanFlow`-aware.** The multi-line-quoted-continuation FP is PROVEN live on
   this surface (§2.3). Model `findProjectConfigValueLines` on `findNestedFrontMatterValueLines`
   (`yaml-frontmatter-nested-values.ts:62`) — arm the flow/quote skip on each value token, skip
   continuation lines. `findProjectConfigKeyLines` is NOT a model here (it lacks scanFlow).
3. **`project.type` is the cardinal-sin trap.** `{string:{completions}}` → OPEN; `banana` fails
   DOWNSTREAM, not at the schema layer. NEVER flag it and NEVER curate it closed. Put
   `project.type: whatever` in the valid fixture as a standing guard.
4. **`manuscript:` is out of scope** (0 closed children; also outside the KEY feature's container set).
   Do NOT add it.
5. **`repo-actions` is `maybeArrayOf[enum]`** — a scalar `repo-actions: fork` IS flagged; a flow-seq
   `[edit, source]` (even `[edit, fork]`) is a safe FN via the matcher's leading-`[` guard. Same as
   `fig-align`. Put a flow-seq in the valid fixture.
6. **`projectKeys` must not regress.** Refactoring the resolution to keep schemas is name-set-preserving
   — add a regression row asserting the `project`/`website`/`book` name sets are unchanged.
7. **`book.type` is the CSL 45-value enum** (via `super csl-item-shared`), not a small set — grounded
   `book.type: banana` → exit 1, `book.type: book` → exit 0. Don't assume project enums are short.
8. **Fixtures are directories.** The filename gate needs the basename to be exactly `_quarto.yml`, so
   each fixture is a subdir with a `_quarto.yml` (mirror `test/fixtures/yaml-diagnostics/{valid,
   invalid}/`). The integration test opens that file and waits for diagnostics like
   `test/integration/suite/yaml-diagnostics.test.ts`.
9. **`valueMessage` is currently PRIVATE** in `yaml-value-diagnostics.ts` — relocate it to the pure
   `yaml-value-check.ts` and export, update the 3 existing call sites, and give it unit rows there.

---

## Provenance — how this plan was grounded (Session 134)

- **Firsthand code read** of the entire project + document value-validation machinery:
  `yaml-diagnostics.ts` (KEY feature), `project-yaml.ts` (`findProjectConfigKeyLines`),
  `yaml-schema.ts` (`projectKeys`/`buildProjectConfigKeys`/`resolveClosedKeys*`/`objectChildren`/
  `resolveObjectProperties`/`annotate*`/`valuesOfSchema`/`closednessOfSchema`/`numericTypeOfSchema`),
  `yaml-frontmatter-nested-values.ts` (the enumerator model), `qmd/model.ts` (`scanFlow`),
  `yaml-value-check.ts` (`isWrongValue`), `yaml-value-diagnostics.ts` (`valueMessage`),
  `debounced-diagnostics.ts` (the skeleton), `extension.ts` (registration) — established the
  three-change design + the §5 file:line inventory + why the S132 reuse does not transfer (the project
  surface has no annotated children, and `resolveObjectProperties` lacks super).
- **A parser-mirroring harness** (`scratchpad/ground-project.cjs`) — verbatim ports of
  `valuesOfSchema`/`closednessOfSchema`/`numericTypeOfSchema` PLUS a super/resolveRef-aware property
  resolver — run over the installed 1.7.33 `schema/project.yml`: the §2.2 16-position inventory is
  parser ground truth (project 1, website 6, book 9 via super chains; manuscript 0).
- **`quarto render` 1.7.33 grounding** — real website + book projects (`scratchpad/gp/{web,book}`),
  ~25 probes: every marked-closed child rejects off-list values (exit 1, `_quarto.yml validation
  failed`); open children render exit 0; the `project.type` downstream-vs-schema boundary confirmed
  (`ERROR: Unsupported project type banana` ≠ schema validation); the scanFlow continuation FP PROVEN
  (multi-line quoted title with an embedded `draft-mode:` line → exit 0); the flow-seq skip confirmed.
