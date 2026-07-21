# Plan — VALUE validation for other closed front-matter CONTAINERS (`.qmd` front matter)

*Session 131 (PLANNING). Deliverable = this document only; implementation is a separate
session (FM #18/#19 — NO code shipped this session). Governs: `SESSION_RUNNER.md`
§Planning Sessions + `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`, under the
project-wide strict-TDD gate.*

The fourth widening of the value-validation family (cell → S124, top-level → S125, nested
`execute:`/`format:` → S128, numeric-across-surfaces → S130). This slice reaches the value of
an already-recognized key one level under **any other closed object container** that carries
provably-closed children — grounded firsthand to **15 containers, 35 children**.

---

## §0 — Decision at a glance

- **What ships:** a wrong VALUE of a recognized child of a closed object container in `.qmd`
  front matter (`crossref:\n  chapters: banana`, `listing:\n  type: fancy`, `mermaid:\n
  theme: sunset`, `editor:\n  mode: wysiwyg`, …) shows an **Error** squiggle matching
  `quarto render` 1.7.33's YAML-schema layer. Emits nothing for valid values, for the many
  OPEN string children (`crossref.fig-title`, `menu.width`), for unknown keys, or under the
  curated-fallback no-reader path.
- **The mechanism is GENERAL, the code is tiny.** Two changes: (1) a general `length===1`
  branch in `frontMatterKeys` returning the container's already-resolved `.children`
  (`toField`→`objectChildren` already populates + annotates them at parse time — no new
  parsing, no curation); (2) the 15 grounded container names added to `NESTED_CONTAINERS`.
  **The Phase-3 nested diagnostics loop is UNCHANGED** — it already resolves
  `frontMatterKeys(parentPath).find(...)` and emits with the shared `isWrongValue`.
- **Scope corrected empirically, as every prior value slice was.** The operator's named set
  was `crossref:`/`website:`/`brand:`/`jupyter:`; grounding shows **`website`/`book`/`project`
  are project config, absent from `document-*`** (an `_quarto.yml` surface, not this one), and
  **`brand`/`jupyter` have NO closed children at one level** (0 diagnostics). The real
  grounded set is 15 OTHER containers (crossref among them). See §2.2.
- **v1 = all 15 grounded containers** (identical code whether 1 or 15). Fallback if the §9
  review surfaces a per-container enumerator FP: ship the clean subset, defer the rest —
  the general mechanism makes subsetting a one-line edit (§4.3).
- **Cardinal-sin safety is already established, firsthand:** all 35 parser-marked-closed
  children are genuinely rejected by `quarto render` (exit 1); zero closedness FPs across all
  15 containers (§2.1). The one live risk is a *latent enumerator* quote/flow FP the newly
  validated keys make live (Learning #143) — the MANDATORY §9 review re-hunts it (§9).

---

## §1 — Context

### 1.1 Problem

The value-validation feature flags a wrong VALUE of an already-*recognized* key. Its three
sources (cell `#|`, top-level front matter, nested under `execute:`/`format:`) all resolve the
key against `frontMatterKeys(parentPath)` and run the surface-agnostic `isWrongValue`. But the
nested source only descends into `execute:` and `format:` (`NESTED_CONTAINERS`), so a wrong
value under **any other closed object container** — `crossref.chapters: banana`,
`listing.type: fancy`, `mermaid.theme: sunset` — is silently unflagged even though
`quarto render` rejects it at the same YAML-schema layer. This is the family's last
document-front-matter gap (the S128/S130 handoffs filed it explicitly).

### 1.2 Constraints (standing, binding)

- **Strict TDD** (project-wide gate). Red → Green → Refactor, one behavior at a time.
- **Cardinal-sin rule (absolute).** NEVER flag a value quarto accepts. Only fields whose
  schema is *provably closed* (`valuesClosed===true`) or *provably numeric*
  (`scalarType==="number"`) are ever checked; any string/open arm anywhere → left open →
  never flagged. This is `isWrongValue`'s existing precondition — inherited unchanged.
- **Mirror only quarto's YAML-SCHEMA layer** (Learning #142). Do not chase downstream pandoc
  errors, required-property presence, or integer/float distinctions.
- **One shared matcher, no new loop/enumerator/feature.** Reuse the Phase-3 loop and the
  Phase-3 enumerator verbatim; widen only the container allow-list + the reader.
- **≤5 files per checkpoint commit** (blast radius).

### 1.3 Current state — what already exists (build on it, do NOT rebuild)

- `frontMatterKeys(parentPath)` (`src/core/yaml-schema.ts:540`) resolves `[]`→top-level,
  `["execute"]`→curated, `["format"]`→format names, `["format",fmt(,opt…)]`→per-format;
  **everything else → `[]`** (`:581`). That final `[]` is the gap for a new container.
- **`toField` (`:1274`) already calls `objectChildren(e.schema,…)` (`:1305`) on EVERY
  top-level field** and stores `.children` when non-empty. `objectChildren` (`:1227`) resolves
  one object level and calls `annotateClosedness` (`:1250`) + `annotateScalarType` (`:1251`)
  on each child. So `frontMatterKeys([]).find(name==="crossref").children` is **already a
  fully-annotated `SchemaField[]`** — the reader just doesn't expose it under `["crossref"]`.
- `nestedParentPath` (`src/core/yaml-context.ts:240`) gates on
  `NESTED_CONTAINERS = {"execute","format"}` (`:367`) — returns a one-level path
  `[container]` only when the column-0 container is in the set (`:256`); the deeper climb
  returns a path only for a `format:` root (`:277`). Shared by BOTH the nested-value
  enumerator (`findNestedFrontMatterValueLines`, defined
  `src/core/yaml-frontmatter-nested-values.ts:62`, calling `nestedParentPath` at `:118`) and the
  completion detector (`nestedKeyContextAt`, defined `yaml-context.ts:162`, calling it at `:179`).
- The Phase-3 diagnostics loop (`src/features/yaml-value-diagnostics.ts:151`) does
  `index.frontMatterKeys(nested.parentPath).find(f=>f.name===nested.key)` then `isWrongValue`
  — **already container-agnostic**. `valueMessage` (`:179`) already covers enum + boolean +
  numeric arms. Nothing in the feature needs to change.
- All three value-line enumerators already carry the shared quote/flow-aware `scanFlow`
  (`src/core/qmd/model.ts`, relocated S130) — the multi-line quoted/flow FP class is guarded.

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 / the actual parser)

*All grounded firsthand this session: (a) the ACTUAL `parseSchemaIndex` bundled with esbuild
and run over the installed `yaml-intelligence-resources.json`; (b) `quarto render --to html`
of minimal `.qmd` probes, 48 invalid + 35 valid + calibration.*

### 2.1 The parser's closedness annotation is FAITHFUL — zero FPs across 15 containers

The actual parser marks exactly **35 children** across **15 containers** as
`valuesClosed`/`scalarType`. **Every one of the 35, given an off-list value (`quartozzz`),
makes `quarto render` exit 1 at the YAML-schema layer.** No container is a false positive:
the parser never marks closed a child quarto actually accepts open. The open string children
(`crossref.fig-title`, `listing.id`, `menu.width`, …) are correctly left open and render
exit 0 on the same garbage token. This is the cardinal-sin guarantee, established firsthand
per-container, not assumed from the top-level machinery.

Format-independence confirmed: revealjs-only containers (`chalkboard`, `scroll-view`,
`menu`) still schema-validate at document top level in a plain HTML render (`chalkboard:\n
theme: quartozzz` → exit 1 to `--to html`). The extension's format-agnostic top-level check
matches quarto here.

### 2.2 The grounded container inventory (15 containers, 35 validatable children)

| container | validatable children (parser kind) |
|---|---|
| `about` | `image-shape` enum[rectangle,round,rounded] |
| `code-tools` | `toggle` bool |
| `crossref` | `chapters` bool, `ref-hyperlink` bool |
| `editor` | `mode` enum[source,visual], `render-on-save` bool |
| `identifier` | `schema` enum[ISBN-10,GTIN-13,UPC,ISMN-10,DOI,LCCN,GTIN-14,ISBN-13,Legal deposit number,URN,OCLC,ISMN-13,ISBN-A,JP,OLCC] |
| `ibooks` | `specified-fonts` bool, `scroll-axis` enum[vertical,horizontal,default] |
| `grid` | `content-mode` enum[auto,standard,full,slim] |
| `lightbox` | `match` enum[auto], `effect` enum[fade,zoom,none], `desc-position` enum[top,bottom,left,right], `loop` bool |
| `notebook-preview-options` | `back` bool |
| `listing` | `type` enum[default,table,grid,custom], `categories` enum[…]+bool, `image-lazy-loading` bool, `image-align` enum[left,right], `grid-item-border` bool, `grid-item-align` enum[left,right,center], `table-striped` bool, `table-hover` bool |
| `mermaid` | `theme` enum[default,dark,forest,neutral] |
| `html-math-method` | `method` enum[plain,webtex,gladtex,mathml,mathjax,katex] |
| `menu` | `side` enum[left,right], `numbers` bool, `use-text-content-for-missing-titles` bool |
| `chalkboard` | `theme` enum[chalkboard,whiteboard], `read-only` bool, `buttons` bool |
| `scroll-view` | `activate` bool, `progress` enum[true,false,auto]+bool, `snap` enum[mandatory,proximity,false]+bool, `layout` enum[compact,full] |

**Containers ruled OUT (empirical scope correction — the executor must NOT re-add them):**

- **`website` / `book` / `project`** — ABSENT from `schema/document-*`; they live in the
  project schema, so they are `_quarto.yml` config, not `.qmd` document front matter. Value
  validation of them is a *different surface* (the KEY-checking feature already owns
  `_quarto.yml`); it is a separate future effort, not this slice.
- **`brand`** — its one-level children `light`/`dark` are `anyOf[string, ref->brand]` → OPEN
  → 0 diagnostics. Adding it is pure FP surface with no benefit.
- **`jupyter`** — one-level child `kernelspec` is an object → OPEN; the interesting leaves
  (`display_name`/`language`/`name`) are depth-2 strings → still open. Top-level `jupyter:`
  itself is `anyOf[boolean,string,object]` → open (kernel name is free). 0 diagnostics.

### 2.3 Safe false negatives (documented, deferred — NOT flagged, by design)

- **Mixed number-or-string dimensions** (`grid.sidebar-width`, `chalkboard.boardmarker-width`,
  `scroll-view.activation-width`): `anyOf[number, string]` → open (`number && !other` fails).
  quarto rejects pure garbage but accepts `"800px"`; we cannot distinguish a valid dimension
  string from a typo, so we correctly stay silent (exactly `linestretch: 2em`, numeric slice).
- **Array-valued children** (`crossref.custom` = `arrayOf(object)`): open; a `custom:` block
  opener has no scalar → the enumerator skips it.
- **Mixed boolean-or-object children** (e.g. `comments.hypothesis` = `anyOf[boolean, object]`):
  `quarto render` rejects a bare-string value at the schema layer (`comments:\n  hypothesis:
  banana` → exit 1) but accepts both `hypothesis: true` and `hypothesis:\n    theme: clean`
  (exit 0) — so the object arm makes the child OPEN and the extension correctly stays silent on
  the scalar mismatch. Same mechanism as the number-or-string bullet. (Firsthand this session;
  `comments`/`notebook-view` are the observed cases — both correctly excluded from the 15,
  the parser exposing no closed child. `notebook-view.title`'s exit-1 is instead a
  required-property artifact, not a value rejection.)
- **`listing:` as a SEQUENCE** (`listing:\n  - id: a\n    type: default`): the `- id: a`
  sequence item makes `mappingContainerKey` return null → `nestedParentPath` bails → the
  `type:` under it is NOT reached. Safe FN (the single-object `listing:` form IS validated).
- **2-level nesting under a non-`format` container** (`objectChildren` caps at one level; the
  deeper climb returns a path only for a `format:` root). Deferred (b2-iii-deep-style residue).
- **Missing REQUIRED properties** (`about:` without `template` → quarto exit 1): the feature
  validates wrong VALUES, not required-property presence. Out of scope, safe FN.
- **Curated-fallback / no-reader path**: under `CURATED_SCHEMA_INDEX` these containers have no
  `.children`, so validation silently no-ops (the same offline deferral every value slice noted).

---

## §3 — Decision (architecture)

### 3.1 Feature shape — a wider allow-list + a general reader, NOT a new anything

Position ⊥ data (the family's invariant): the enumerator emits `{parentPath, key, rawToken}`;
the reader decides what a name resolves to; the matcher decides if the value is wrong. This
slice touches only *which containers the enumerator descends into* and *how the reader
resolves a length-1 container path*. No new feature, loop, enumerator, matcher, or message.

### 3.2 The two core changes

**(A) `frontMatterKeys` — a general length-1 container branch** (`src/core/yaml-schema.ts`,
inside `indexOf`, AFTER the `execute`/`format` length-1 branches, BEFORE the length-2 format
branch):

```js
// One level under any OTHER top-level object container: its already-resolved,
// already-annotated one-object-level children (toField → objectChildren). A non-container
// name (a scalar field, or an unknown key) has no `.children` → []. execute:/format: are
// handled by their explicit branches above and never reach here.
if (parentPath.length === 1) {
  return topLevelFields.find((f) => f.name === parentPath[0])?.children ?? [];
}
```

This is fully general and needs no allow-list of its own — **`NESTED_CONTAINERS` (the
enumerator + the completion detector) is the single gate** on which containers are actually
validated/completed. A caller asking for a non-listed container's children still gets a
correct answer (`[]` or the children), but no enumerator ever asks unless the container is
allow-listed.

**(B) `NESTED_CONTAINERS` — add the 15 grounded names** (`src/core/yaml-context.ts:367`):

```js
const NESTED_CONTAINERS = new Set<string>([
  "execute", "format",
  // §2.2 grounded object containers with ≥1 provably-closed one-level child:
  "about", "code-tools", "crossref", "editor", "identifier", "ibooks", "grid",
  "lightbox", "notebook-preview-options", "listing", "mermaid", "html-math-method",
  "menu", "chalkboard", "scroll-view",
]);
```

The deeper-climb rule (`:277`, `format`-root only) is unchanged, so these 15 stay one level
deep — matching `objectChildren`'s one-level cap and §2.3's deferred deeper nesting.

### 3.3 Completion comes along for free (a bonus, must be regression-checked)

Both the diagnostics enumerator and the completion detector (`nestedKeyContextAt`) call
`nestedParentPath`, and the completion provider (`src/providers/yaml.ts:99/110`) calls the
same `frontMatterKeys`. So this slice ALSO enables key + value completion under these 15
containers (`crossref:\n  <tab>` → crossref's keys; `mermaid:\n  theme: <tab>` → its enum).
This is strictly additive (previously the detector returned `null` there → no completion), so
it is an enhancement, not a regression — but it MUST be verified (an integration test that a
container child key/value completes, and that no previously-working completion changed).

### 3.4 Data flow (unchanged skeleton)

```
.qmd text
  → findNestedFrontMatterValueLines           (UNCHANGED code; now reaches 15 more containers
      → nestedParentPath  [gate: NESTED_CONTAINERS ← widened]        via the widened gate)
  → Phase-3 loop: frontMatterKeys(parentPath)  [reader ← new length-1 branch]
      .find(name===key) → isWrongValue         (UNCHANGED matcher)
      → valueMessage                            (UNCHANGED — enum/bool/numeric arms cover it)
```

---

## §4 — Scope: the vertical slice (ONE implementation session)

### 4.1 The layer set (gate-(a) contract — build in this order, checkpoint-commit each)

- **L1 (core reader) — the general length-1 `frontMatterKeys` branch.**
  DONE: `frontMatterKeys(["crossref"])` returns crossref's annotated children;
  `frontMatterKeys(["title"])` (a scalar field) and `frontMatterKeys(["nope"])` return `[]`;
  `["execute"]`/`["format"]`/`["format",fmt]` unchanged.
  Verify: new unit tests in `test/unit/yaml-schema.test.ts` (RED first — the branch absent →
  `["crossref"]` returns `[]`); `npm run test:unit`; `npm run check-types`.
  *This layer is INERT for diagnostics* (no enumerator reaches these containers yet) but makes
  the reader correct and is independently unit-testable.

- **L2 (enumerator gate) — GO-LIVE: add the 15 names to `NESTED_CONTAINERS`.**
  DONE: `findNestedFrontMatterValueLines` now enumerates one-level lines under each of the 15;
  the Phase-3 loop flags a wrong closed value and skips valid/open ones. Diagnostics go live
  HERE (L1+L2 together are the minimum shippable unit).
  Verify: unit tests on `findNestedFrontMatterValueLines` for a representative container
  (RED first — `crossref:\n  chapters: banana` not enumerated until the name is added); the
  `nestedParentPath` unit suite gains rows for a non-format container's one-level path and its
  2-level bail. `npm run test:unit`; `check-types`.

- **L3 (fixtures + integration).** Two fixtures under
  `test/fixtures/yaml-value-diagnostics/`, each grounded per-line to `quarto render`:
  `container-values.qmd` (a spread of FLAG cases across ≥6 containers: `crossref.chapters:
  banana`, `listing.type: fancy`, `mermaid.theme: sunset`, `editor.mode: wysiwyg`,
  `chalkboard.theme: green`, `lightbox.effect: sparkle`) and `valid-container-values.qmd`
  (the FP battery: valid closed values + OPEN string children `crossref.fig-title: "Figura"` /
  `menu.width` / `listing.id`, + a mixed-dimension `grid.sidebar-width: 250px`, + a
  `listing:`-as-sequence block, + `about:` WITH `template` so it renders — all exit 0, zero
  diagnostics). A 5th integration `describe` asserting the real host's diagnostics at the exact
  spans + zero on the valid fixture. Plus the §3.3 completion regression/bonus integration test.
  DONE: both fixtures render per §2.1 (flag fixture exit 1 SCHEMA, valid fixture exit 0); the
  integration `describe` asserts an Error diagnostic at the exact value span for each flag case
  and ZERO diagnostics on the valid fixture; the completion test confirms a container child
  key/value completes with no regression.
  Verify: `npm run test:integration`; both fixtures render firsthand (flag fixture exit 1
  SCHEMA, valid fixture exit 0).

- **L4 (MANDATORY §9 adversarial review + TDD fixes).** See §9. Non-negotiable; it caught a
  real cardinal-sin FP in EACH of S124/S125/S128/S130.
  DONE: L4's acceptance == §9's outcome — a fresh multi-lens review AND the author's firsthand
  sweep return CLEAN (or every finding fixed TDD and re-verified), with the full build/test
  matrix green and both fixtures re-rendered after any fix.
  Verify: the §9 checklist; `check-types` + `test:unit` + `test:integration` green post-fix.

### 4.2 Session boundary

One implementation session. Close out after L4. Do NOT also chase `_quarto.yml`
container-value validation, `.ipynb`, the curated-fallback annotation, 2-level nesting, or the
deferred containers.

### 4.3 Deferred to a later session (filed to `BACKLOG.md`, NOT built here)

- `_quarto.yml`-surface value validation of `website:`/`book:`/`project:` (a different surface).
- `.ipynb` container values (NotebookDocument plumbing — every value slice's cliff).
- The curated-fallback `.children` annotation (rare no-reader path).
- 2-level nesting under a non-`format` container; `listing:`-as-sequence child values.
- **Fallback subsetting:** if L4's review finds a per-container enumerator FP that cannot be
  cleanly fixed for all 15, drop the offending container(s) from `NESTED_CONTAINERS` (a
  one-line edit — the general reader needs no change) and defer them. The slice stays
  recoverable and ships the clean subset.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped this session)

| Symbol / site | File:line | Change |
|---|---|---|
| `frontMatterKeys` branches | `src/core/yaml-schema.ts:540-582` | ADD a general `length===1` branch after the format branch's closing brace at `:555` (before the length-2 comment at `:556`) |
| `topLevelFields` (in `indexOf`) | `src/core/yaml-schema.ts:523` | READ (the source of `.children`) — no change |
| `toField`→`objectChildren` | `src/core/yaml-schema.ts:1305` / `:1227` | READ — already populates/annotates `.children` |
| `NESTED_CONTAINERS` | `src/core/yaml-context.ts:367` | ADD 15 names |
| `nestedParentPath` | `src/core/yaml-context.ts:240-282` | READ — unchanged (one-level `:256`, format-deep `:277`) |
| `findNestedFrontMatterValueLines` | `src/core/yaml-frontmatter-nested-values.ts:62-158` | UNCHANGED — reaches new containers via the widened gate |
| Phase-3 diagnostics loop | `src/features/yaml-value-diagnostics.ts:151-170` | UNCHANGED — already `frontMatterKeys(parentPath).find` |
| `valueMessage` | `src/features/yaml-value-diagnostics.ts:179-194` | UNCHANGED — enum/bool/numeric arms cover all 35 |
| `isWrongValue` | `src/core/yaml-value-check.ts:31` | UNCHANGED |
| completion detector / provider | `src/core/yaml-context.ts:179` / `src/providers/yaml.ts:99,110` | UNCHANGED code; behavior widens (§3.3) |
| Tests | `test/unit/yaml-schema.test.ts`, `test/unit/yaml-context.test.ts` (or `nestedParentPath` suite), `test/unit/yaml-frontmatter-nested-values.test.ts`, `test/integration/suite/yaml-value-diagnostics.test.ts`, `test/fixtures/yaml-value-diagnostics/{container,valid-container}-values.qmd` | ADD |

Grounding scratch (this session): `scratchpad/S131-findings.md`, `scratchpad/matrix.json`
(the 15-container/35-child matrix + valid/invalid samples).

---

## §6 — Alternatives considered (honest)

- **Per-container curated closedness (like `CURATED_EXECUTE_KEYS`).** Rejected: the schema
  reader ALREADY resolves + annotates these children (§1.3). Curation would duplicate the
  schema and drift. `execute:` is curated only because the live schema assembles it across
  files; these 15 do not have that problem.
- **A fully general gate (validate under ANY object container, no allow-list).** Rejected:
  it removes the per-container grounding discipline — a future schema container with a
  mis-annotated child would auto-FP unreviewed. The explicit `NESTED_CONTAINERS` allow-list
  encodes "grounded firsthand." (The *reader* is general; the *gate* is the allow-list.)
- **crossref-only (the operator's literal example).** Rejected as under-delivery: the code is
  identical for 1 or 15 containers; 14 grounded-safe containers would be left unvalidated for
  no code saving. (Kept as the fallback-subset floor if L4 forces it, §4.3.)
- **A per-format deep path instead** (`format:\n revealjs:\n chalkboard:\n theme:`).
  Orthogonal — the length-≥3 format branch may already reach some of these under `format:`;
  this slice is about the TOP-LEVEL container form. (Executor: spot-check whether the format
  path already flags `format.revealjs.chalkboard.theme: x`; if so, note it, do not rebuild.)

---

## §7 — Failure-mode analysis (the safety story)

1. **Cardinal-sin FP on a closed child.** Guarded by `isWrongValue`'s `valuesClosed`/
   `scalarType` precondition + §2.1's firsthand proof that all 35 marked-closed children are
   genuinely rejected by quarto. Zero divergence found.
2. **FP on an OPEN string child** (`crossref.fig-title: "Figura"`). Guarded — the parser leaves
   strings/`string:{completions}` open; §2.1 confirms exit 0 + not flagged. The valid fixture
   makes this a standing regression guard.
3. **Latent ENUMERATOR quote/flow FP the new keys expose** (Learning #143 — the S130 lesson).
   The nested enumerator already carries `scanFlow` (quote + flow continuation), so the known
   multi-line class is guarded. **But widening WHICH keys are validated can surface a NEW
   masked FP** — L4's §9 review MUST re-hunt every container's real document shapes
   (multi-line quoted values, flow collections, anchors/tags, sequences, block scalars) for
   any continuation misread as a mapping value. This is the one genuinely open risk.
4. **`listing:`-as-sequence** (§2.3): sequence items bail via `mappingContainerKey`→null. The
   valid fixture includes a multi-listing sequence as a standing guard.
5. **Mixed number-or-dimension** (§2.3): left open → safe FN. Guarded by the
   `grid.sidebar-width: 250px` valid-fixture row.
6. **Name collisions across containers** (`listing.type` vs `editor.mode` vs a top-level key):
   resolution is per-`parentPath` node, so each container returns ONLY its own children —
   never mark by bare key name (the numeric-slice Learning, satisfied structurally here).

---

## §8 — Impact analysis

- **Users:** wrong values under 15 more front-matter containers get an Error squiggle before
  render (the biggest single-slice coverage jump in the family — 35 fields); plus key/value
  completion under those containers. No behavior change for valid documents.
- **Code:** ~2 edited core lines + 15 allow-list entries + tests/fixtures. The feature module,
  matcher, message, and all three enumerators are untouched.
- **Risk:** LOW-MEDIUM. The closedness FP risk is retired firsthand (§2.1). The residual risk
  is the enumerator FP re-hunt across 15 containers (proportionally the largest §9 pass in the
  family) — mitigated by the shared `scanFlow` guard and the fallback-subset escape (§4.3).

---

## §9 — Verification plan (executor)

- **Per-layer:** the build/test matrix (`check-types`, `test:unit`, `test:integration`) at
  EACH checkpoint boundary; firsthand `quarto render` of both fixtures.
- **MANDATORY §9 adversarial review (L4), non-negotiable.** A fresh multi-lens
  `quarto render`-verified `Workflow` AND the author's own firsthand sweep, INDEPENDENTLY,
  over: **(fp-hunt)** every container's real document shapes for an enumerator quote/flow/
  sequence/anchor/block-scalar continuation misread as a mapping value (Learning #143 — the
  primary target); **(closedness)** re-confirm no marked-closed child is quarto-accepted and no
  open child is flagged, across all 15; **(completion)** the §3.3 widening introduces no
  regression and the bonus works; **(resolution/lifecycle/doc-drift)** the standard lenses.
  Every finding adversarially re-verified firsthand (render exit code + a matcher harness)
  before fixing, TDD. Confirm CLEAN verdicts rather than trusting them.
- **Grounding to reproduce:** `esbuild`-bundle `yaml-schema.ts`, run `parseSchemaIndex` over
  `/Applications/quarto/share/editor/tools/yaml/yaml-intelligence-resources.json`, enumerate
  each top-level field's closed/numeric `.children` (the §2.2 matrix — 15/35); then
  `quarto render --to html` an invalid + valid probe per child (the §2.1 result).

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

- **Q1 — all 15 at once, or a curated high-value subset first?** Recommendation: all 15 (§0/§6)
  — identical code, all grounded. Fallback-subset is the escape (§4.3). *(Operator may prefer
  a smaller v1; that is a one-line change and does not alter the plan's shape.)*
- **Q2 — does the length-≥3 `format:` path already validate the presentation containers under
  `format:\n revealjs:`?** Spot-check at Orient; if yes, note parity, do not rebuild (§6).
- **Q3 — fixture container spread.** Pick ≥6 containers spanning enum, bool, and enum+bool
  kinds (crossref/listing/mermaid/editor/chalkboard/lightbox recommended) so the integration
  suite exercises each matcher arm.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. **The reader branch is GENERAL; the GATE is `NESTED_CONTAINERS`.** Do NOT add an allow-list
   to `frontMatterKeys` — the enumerator/detector gate is the single source of truth. A general
   `length===1` branch returning `topLevelFields.find(...).children ?? []` is correct and safe.
2. **Place the new branch AFTER the `execute`/`format` length-1 branches** — those keep their
   overrides (`execute` is CURATED; `format` returns format names), and must return first.
3. **The Phase-3 loop, `isWrongValue`, `valueMessage`, and all three enumerators DO NOT
   CHANGE.** If you find yourself editing the feature file's loop, stop — the wiring is already
   container-agnostic. Only `NESTED_CONTAINERS` and the one reader branch change.
4. **`website`/`book`/`project`/`brand`/`jupyter` are NOT in scope** (§2.2) — do not re-add them
   from the operator's original wording; they are grounded OUT (project-config surface / no
   closed children). Re-adding `brand`/`jupyter` is harmless (0 diagnostics) but pure FP surface
   — leave them out.
5. **The §9 enumerator FP re-hunt is the load-bearing risk, not the closedness** (which is
   retired firsthand). Learning #143: a value slice that widens validated keys EXPOSES latent
   enumerator FPs. Render a wrapped/quoted/flow/sequence form under a real container BEFORE
   trusting the enumerator.
6. **`about:` needs `template` to render at all** — a required-property error, NOT a value
   error the feature flags. The valid fixture's `about:` block MUST include `template:` or the
   fixture won't render exit 0 (and the feature correctly does not flag the missing property).
7. **The matcher's `values` for `identifier.schema` include a value with a space** (`Legal
   deposit number`) — do not assume enum values are single tokens when building fixtures.

---

## Provenance — how this plan was grounded and hardened (Session 131)

- **Firsthand code read** of `frontMatterKeys`/`toField`/`objectChildren`/`annotate*`/
  `nestedParentPath`/`NESTED_CONTAINERS`/the Phase-3 loop/the nested enumerator — established
  the two-change design and the §5 file:line inventory.
- **The ACTUAL parser** (`parseSchemaIndex`, esbuild-bundled) run over the installed 1.7.33
  schema — the §2.2 15-container/35-child inventory is parser ground truth, not a hand
  simulation.
- **`quarto render` 1.7.33 grounding** — 48 invalid + 35 valid probes across all 35 children +
  calibration: all 35 closed children reject off-list values (exit 1, zero closedness FPs);
  34/35 valid values accepted; the 1 exception is a required-property error (§2.1). Format-
  independence and open-child non-flagging confirmed.
- **Adversarial plan review** — a 4-lens `quarto render`-verified `Workflow` (`wf_e36facbb-375`):
  **soundness** and **fp-cardinal** returned SOUND with ZERO findings (the two-change design and
  the cardinal-sin safety independently re-grounded clean — the fp lens re-rendered 8+ closed +
  4 open children + the multi-line-quoted enumerator shape); **completeness-scope** and
  **doc-drift** returned SOUND_WITH_FIXES with 4 LOW findings, ALL re-verified firsthand and
  folded in: (1) the boolean-or-object mixed safe-FN class (`comments.hypothesis`, §2.3);
  (2) the §5 insertion-point line (`:554`→`:555`, the format branch's closing brace);
  (3) §1.3's function-definition vs call-site line labels (:62/:162 defs, :118/:179 calls);
  (4) explicit `DONE:` lines for L3/L4. No finding changed the 15-container set or the design.
