# Plan — `execute:` document-key VALUE validation in `_quarto.yml`

**Session:** 140 (PLANNING). **Deliverable:** this plan. **Implementation:** a separate later session.
**Workstream:** Planning (evidence-based inventory + per-phase criteria + gate-(a) layer contract).
**Feature family:** the YAML value-validation family (S124/125/128/130/132/135/137/139) — this is its
**ninth slice** and its **third `_quarto.yml`-surface** slice (after S135 depth-1 and S137 depth-2).
**Origin:** the S135-deferred sub-bullet (b) "near-term win"; operator picked it via `AskUserQuestion`
at S140 Phase 0 (Active empty).

---

## §0 — Decision at a glance

Flag a **wrong CLOSED value of a child of a top-level `execute:` block in `_quarto.yml`** (e.g.
`execute:` → `echo: banana`, `cache: nope`, `freeze: banana`, `error: 5`, `daemon: banana`) with an
Error squiggle on the value span, matching what `quarto render` 1.7.33's `_quarto.yml`-schema layer
(`readAndValidateYamlFromFile`) rejects — the **exact** layer S135/S137/S139 already target.

**The headline finding (grounded firsthand this session): this ships with ZERO new core code.** The
resolution reader (`SchemaIndex.frontMatterKeys(["execute"])` → the annotated `CURATED_EXECUTE_KEYS`),
the matcher (`isWrongValue`), and the message (`valueMessage`) **already exist and are already used**
to validate `execute:` children on the **document** surface (S128, nested front-matter). Quarto's
behavior for `execute:` values in `_quarto.yml` is a **1:1 match** with those existing annotations
(§2). The gap is purely **surface plumbing**: the `_quarto.yml` value enumerator does not recognize
`execute:` as a container, and the `_quarto.yml` value feature resolves every value line against
`projectFields` (which has no `execute`). Two small, local changes close it.

**The two changes:**
1. **Enumerator** (`findProjectConfigValueLines`, `src/core/project-yaml.ts`): recognize `execute:` as
   a **value-side** top-level container and emit its depth-1 children (`container:"execute", path:[]`).
2. **Feature** (`yaml-project-value-diagnostics.ts`): **route** `container === "execute"` to
   `index.frontMatterKeys(["execute"])` instead of `index.projectFields(...)`.

**The one HIGH dragon (§7 / §11): the shared container set.** `isProjectConfigContainer` /
`PROJECT_CONFIG_CONTAINERS` (`project-yaml.ts:18/:96`) is used by BOTH the value enumerator (`:184`)
**and the unknown-KEY enumerator** `findProjectConfigKeyLines` (`:74`). Adding `execute` to that
*shared* set would make the unknown-KEY feature (`features/yaml-diagnostics.ts`) treat `execute:` as a
closed container and start flagging its keys — which is a **cardinal-sin false positive**, because
quarto **accepts** unknown execute keys (`custom-thing: whatever` → exit 0, grounded §2.3). The value
enumerator must get its **own** container predicate; the KEY enumerator's set stays `{project,
website, book}`, untouched and regression-tested.

**Scope is VALUE-only, and that is a correctness requirement, not just a scope choice** (§2.3): quarto
does not reject unknown `execute:` keys, so KEY validation of execute children is a *non-starter*, not
a deferral. `format:` document-keys, the general document-key case, and depth-2+ under execute are
**explicitly deferred** (§4.3).

---

## §1 — Context

### 1.1 Problem

`execute:` is a document-level options block (`echo`/`eval`/`cache`/`freeze`/…) that is **also valid at
the top level of `_quarto.yml`**, where it sets project-wide execution defaults. Quarto schema-validates
those values (§2.1), but this extension gives **no editor feedback** for them: the `.qmd` value feature
gates on `languageId === "quarto"` (a `_quarto.yml` is `"yaml"`), and the `_quarto.yml` value feature
only tracks `project:`/`website:`/`book:`. So `execute:\n  echo: banana` in `_quarto.yml` renders
exit-1 at the CLI but shows no squiggle in the editor.

### 1.2 Constraints (standing, binding)

- **Strict TDD** (project-wide, CLAUDE.md): one RED before each GREEN, vertical slices, ≤5 files/commit.
- **False-negative only** (the hard product rule, `BACKLOG.md`): NEVER flag a value quarto accepts.
  Everything the matcher is unsure about returns `false`. This is the whole safety story of the family.
- **Look-but-don't-copy** (Learning #1): `execute:` child names/values are uncopyrightable facts
  grounded against the installed 1.7.33 schema + `quarto render`, not Posit's AGPL extension.
- **1-and-done** (FM #17/#26): ONE capability — `execute:` value validation in `_quarto.yml`.
  `format:`/general-document-keys/depth-2-under-execute stay deferred.
- **Plan ≠ implementation** (FM #18/#19): this session's deliverable is the plan; NO code.

### 1.3 Current state — what to build ON (do NOT rebuild)

- **The matcher** `isWrongValue(rawToken, field)` (`src/core/yaml-value-check.ts:46`) — surface-agnostic;
  handles closed string enums, boolean-accepting enums (`acceptsBoolean`), numeric fields
  (`scalarType:"number"`), and numeric-member enums. **Unchanged.**
- **The message** `valueMessage(rawToken, key, field)` (`:184`) — numeric-first dispatch. **Unchanged.**
- **The reader** `SchemaIndex.frontMatterKeys(["execute"])` (`src/core/yaml-schema.ts:593`) → the
  hand-annotated `CURATED_EXECUTE_KEYS` (`:341-355`), returned **unconditionally** by the single shared
  index factory — so it is identical in the parsed and the offline-fallback index (`:328-329` comment).
  **Unchanged.** (Property: execute value validation therefore works **even offline**, unlike
  `projectFields`, which returns `[]` when the CLI schema fails to load — §7.)
- **The `_quarto.yml` value feature** `registerYamlProjectValueDiagnosticsFeature`
  (`src/features/yaml-project-value-diagnostics.ts`) — filename-gated, own collection
  (`quarto-project-value`), debounced, generation-guarded; resolves each `ProjectConfigValueLine`
  against `index.projectFields(entry.container)` (`:114`). **One line changes** (field-set routing).
- **The `_quarto.yml` value enumerator** `findProjectConfigValueLines` (`src/core/project-yaml.ts:149`)
  — a scanFlow-aware, depth-1+depth-2 bare-YAML scanner. **Recognizes one more top-level container.**
- **The `.qmd` value feature already validates `execute:` children** (S128) via
  `frontMatterKeys(nested.parentPath)` — the exact reader path this slice reuses on the other surface.

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33)

All probes: a two-file project (`_quarto.yml` + `doc.qmd`), `quarto render doc.qmd`, observing the
`readAndValidateYamlFromFile` validation layer. Scratch harness in the session scratchpad.

### 2.1 Quarto validates `execute:` values in `_quarto.yml` at the target schema layer — confirmed

`execute:\n  echo: banana` in `_quarto.yml` →
```
ERROR: Project …/_quarto.yml validation failed.
In file _quarto.yml (line 4, columns 9--14) Field "echo" has value banana, which must instead be `true` or `false`
    at readAndValidateYamlFromFile (…/quarto.js:20673:15)
```
Same `readAndValidateYamlFromFile` layer as S135/S137/S139. The error carries a **column span** on the
value token — the squiggle target.

### 2.2 The grounded closed-`execute`-child inventory (the flag surface) — a 1:1 match with `CURATED_EXECUTE_KEYS`

| child | closed value set (grounded) | matcher kind | reject example (exit 1) | accept example (exit 0) |
|---|---|---|---|---|
| `eval` | `true`/`false` | bool-enum | `eval: banana` | `eval: false` |
| `echo` | `true`/`false`/`fenced` | bool-enum | `echo: banana` | `echo: false`, `echo: fenced` |
| `warning` | `true`/`false` | bool-enum | `warning: nope` | `warning: true` |
| `error` | `true`/`false` | bool-enum | `error: 5` (→ "true or false") | `error: false` |
| `include` | `true`/`false` | bool-enum | `include: banana` | `include: true` |
| `cache` | `true`/`false`/`refresh` | bool-enum | `cache: banana` | `cache: refresh` |
| `freeze` | `true`/`false`/`auto` | bool-enum | `freeze: banana` | `freeze: auto` |
| `enabled` | `true`/`false` | bool-enum | `enabled: banana` | `enabled: false` |
| `daemon-restart` | `true`/`false` | bool-enum | `daemon-restart: banana` | `daemon-restart: true` |
| `keep-md` | `true`/`false` | bool-enum | `keep-md: banana` | `keep-md: true` |
| `keep-ipynb` | `true`/`false` | bool-enum | `keep-ipynb: nope` | `keep-ipynb: false` |
| `daemon` | number **or** boolean | **numeric** (`scalarType:"number"`+`acceptsBoolean`) | `daemon: banana`, `daemon: "30"` | `daemon: 30`, `daemon: true` |

**Every row above is already annotated in `CURATED_EXECUTE_KEYS` exactly as the matcher needs.** No new
annotation, no matcher branch. `error: 5` is the one anti-intuition to note: `error` is **boolean-only**
(not numeric) — quarto says "must instead be `true` or `false`", and the matcher flags `5` correctly.

### 2.3 Safe cases the matcher must (and does) leave alone — the cardinal-sin traps

- **`output` is schema-OPEN** (anyOf free arm): `output: banana` → **exit 0**. `CURATED_EXECUTE_KEYS`
  gives `output` **no** `valuesClosed`, so `isWrongValue` skips it. **Must never flag.**
- **`daemon` is numeric, not a string enum**: `daemon: 30`/`daemon: true` → exit 0, `daemon: banana`/
  `daemon: "30"` → exit 1. The matcher's numeric branch already gets this right.
- **Unknown execute keys are ACCEPTED**: `execute:\n  custom-thing: whatever` → **exit 0**. Quarto does
  not reject unknown execute children. The feature resolves an unknown child to `undefined` → skip.
  **This makes value-only scope a correctness property** (KEY-flagging execute would be an FP) and is the
  live payload behind the §7 shared-container-set dragon.
- **Multi-line quoted / flow values**: `echo: "line one\n    still: not-a-key"` → exit 1 (quarto
  rejects the folded *string* against `echo`'s bool enum), but the enumerator's `scanFlow` guard emits
  **nothing** for a multi-line opener and skips continuation lines → the feature stays **silent**. A
  **safe false negative** (we miss a quarto rejection; we never emit the folded `still: not-a-key` as a
  spurious mapping → no FP). Already covered by the existing `findProjectConfigValueLines` guard + its
  unit battery (`test/unit/project-yaml.test.ts:222/:342`).

### 2.4 Reachability

`execute:` in `_quarto.yml` is a **top-level** (column-0) block only — it is not nested under
`project:`/`website:`/`book:`. Its **common** children are flat scalars (echo/eval/cache/…), so the
**target** surface is **depth-1 under a top-level `execute:` container**. **Correction (S140 §9 review,
grounded):** execute DOES have **object-valued** children — `knitr`, `jupyter`, `julia`, `server`
(schema `document-execute.yml`; e.g. `execute:\n  knitr:\n    opts_chunk:\n      fig.width: 7` → exit
0) — so a depth-2+ execute value line *can* legitimately occur. It is still a **safe false negative**,
but for a precise reason (§7): none of those object children is listed in `CURATED_EXECUTE_KEYS`, whose
entries carry no `.children`, so any depth-2 execute line (`path=["knitr"]`) resolves to `undefined` and
is skipped. Path-based resolution also means a **name collision** — `execute.knitr.cache` vs the
closed depth-1 `execute.cache` — never mis-resolves (`knitr.cache: banana` → quarto exit 1, we stay
silent: a safe FN, never an FP with the wrong `cache` message).

---

## §3 — Decision (architecture)

### 3.1 Feature shape — one more container on the same surface, same shared tail

The `_quarto.yml` value feature already has the shape "enumerate `{container, path, key, value}` lines →
resolve each to an annotated `SchemaField` → `isWrongValue` → `valueMessage` → squiggle." This slice
adds **one recognized top-level container** (`execute`) whose fields come from a **different reader
method** (`frontMatterKeys` instead of `projectFields`) because `execute` is a document-level block, not
a project-config block. Everything downstream of field resolution is unchanged.

### 3.2 The two changes

**Change A — enumerator recognizes `execute:` (value-side only).** In `findProjectConfigValueLines`
(`src/core/project-yaml.ts`), the column-0 container branch (`:182-189`) currently sets
`currentContainer` only when `isProjectConfigContainer(key)`. Introduce a **value-scoped** predicate/set
— `VALUE_CONTAINERS = {project, website, book, execute}` with `isValueContainer` — used **only here**,
and widen the `container` field type on `ProjectConfigValueLine` (`:103`) and the `currentContainer`
local to `"project" | "website" | "book" | "execute"`. The depth machinery, `scanFlow` guard, and
emission logic are unchanged; `execute:` children emit `container:"execute", path:[]`. **The KEY
enumerator `findProjectConfigKeyLines` keeps `isProjectConfigContainer` (`:74`) and never sees
`execute`** — the dragon.

**Change B — feature routes `execute` to `frontMatterKeys`.** In `computeProjectValueDiagnostics`
(`src/features/yaml-project-value-diagnostics.ts:114`), select the field set by container before
path-resolving:
```ts
const fields = entry.container === "execute"
  ? index.frontMatterKeys(["execute"])   // curated execute children (offline-robust)
  : index.projectFields(entry.container); // project/website/book (may be [] offline)
const field = resolveProjectValueField(fields, entry);
```
`resolveProjectValueField` (the pure path resolver, `:79`) is **unchanged**: for `execute`, `path` is
always `[]`, so it does `fields.find(f => f.name === entry.key)`.

### 3.3 Data flow (a new container, the shared reader/matcher/message tail)

```
_quarto.yml text
  → findProjectConfigValueLines           [Change A: emits container:"execute", path:[] for execute children]
  → (feature) route by container          [Change B: execute → frontMatterKeys(["execute"]) = CURATED_EXECUTE_KEYS]
  → resolveProjectValueField (path=[])     [UNCHANGED]
  → isWrongValue(rawToken, field)          [UNCHANGED — closed-enum / numeric branches already correct]
  → valueMessage(rawToken, key, field)     [UNCHANGED]
  → Error diagnostic on the value span     [UNCHANGED — quarto-project-value collection]
```

Why `execute` is genuinely the "near-term win" (vs `format:` / general document-keys): its children are
a **bounded, flat, already-annotated** set resolvable by an **existing** reader method, so the slice is
plumbing with zero new schema/matcher logic.

---

## §4 — Scope: the vertical slice (ONE implementation session)

### 4.1 The layer set (gate-(a) contract — build in this order, checkpoint-commit each, ≤5 files/commit)

- **L1 — [INERT] feature routing + type widen.** Widen `ProjectConfigValueLine.container` to include
  `"execute"`; apply Change B (container-routed field-set selection) in the feature. **Dormant:** the
  enumerator does not yet emit `execute`, so no live diagnostic changes — proven by (i) a grep showing
  no emit site for `container:"execute"`, (ii) `npm run check-types` clean (the widened type compiles
  because the branch handles it — `projectFields` is only called for the three project containers), and
  (iii) the full existing suite green (unit 1149 / integration 393, unchanged). *Files:* `project-yaml.ts`
  (type only), `yaml-project-value-diagnostics.ts`.
  - **DONE looks like:** build clean, existing tests green, structurally dormant.
  - **Verify:** `npm run check-types && npm test`. Dormancy is STRUCTURAL, not a grep for a string
    literal (the emit site writes `container: currentContainer`, a variable — no literal to grep, S140
    §9 review): confirm the value-scoped predicate (`isValueContainer`/`VALUE_CONTAINERS`) is NOT yet
    referenced by `findProjectConfigValueLines`, so the enumerator cannot emit `execute` — and rely on
    `check-types` clean + the **unchanged** full-suite counts (unit 1149 / integration 393) as the
    operative dormancy evidence.

- **L2 — [GO-LIVE] enumerator emits `execute` (strict-TDD, pure).** Add the value-scoped
  `isValueContainer`/`VALUE_CONTAINERS` (incl. `execute`) used ONLY in `findProjectConfigValueLines`;
  keep `isProjectConfigContainer`/`PROJECT_CONFIG_CONTAINERS` untouched. **RED→GREEN unit tests** in
  `test/unit/project-yaml.test.ts`: `execute:\n  echo: banana` emits
  `{line, container:"execute", path:[], key:"echo", valueRange, rawToken:"banana"}`; `output`/`daemon`/
  an unknown child are ALSO emitted (the enumerator is closedness-blind — the *feature* decides what to
  flag); `execute:` + `project:` in one file both tracked; **a KEY-enumerator regression test proving
  `findProjectConfigKeyLines` still returns NO execute keys** (dragon #1 lock). GO-LIVE: execute values
  now flow through L1's routing → matcher → diagnostics. *Files:* `project-yaml.ts`, `project-yaml.test.ts`.
  - **DONE looks like:** each new unit test RED-before-GREEN; the KEY-isolation test green; build clean.
  - **Verify:** `npm test` (unit ~+8); confirm each RED was shown.

- **L3 — [fixtures + integration, real host] GO-LIVE proof.** New
  `test/fixtures/yaml-project-execute-value/{invalid,valid}/_quarto.yml`; a new `describe` in
  `test/integration/suite/yaml-project-value-diagnostics.test.ts`: (a) the invalid fixture flags
  **exactly N** wrong closed execute values, each on its value span; (b) the valid fixture produces
  **ZERO** diagnostics — the FP battery: `echo: false`/`echo: fenced`/`echo: True`/`cache: refresh`/
  `freeze: auto`/`enabled: false`, the OPEN trap `output: banana`, the numeric accepts `daemon: 30`/
  `daemon: true`, an unknown child `custom-thing: whatever` (KEY-out-of-scope trap), a benign multi-line
  quoted value, **and a depth-2 execute block** (e.g. `knitr:\n    cache: banana` — the name-collision
  lock: `knitr.cache` must NOT resolve to the closed depth-1 `execute.cache`); (c) live-edit drop; (d)
  the `.qmd` filename-gate exclusion. **Every fixture value render-grounded** (invalid → exit-1 SCHEMA;
  valid values → exit-0; the depth-2 `knitr.cache` case is exit-1 at the CLI but a deliberate safe FN
  for us — assert ZERO diagnostics). *Files:* 2 fixtures + 1 integration test.
  - **DONE looks like:** integration +~4, all green in a real Extension Development Host; fixtures grounded.
  - **Verify:** `npm run test:integration`; re-render each fixture with `quarto render` and record exit codes.

- **L4 — [MANDATORY §9 adversarial review].** A multi-lens, `quarto render`-verified panel (§9) +
  the author's own firsthand FP battery. Fold confirmed findings; if any lens finds a cardinal-sin FP,
  it is a blocker.
  - **DONE looks like:** panel run, findings re-verified firsthand + folded (or documented as
    refuted/deferred), zero surviving cardinal-sin FPs.

*(Alternative decomposition, acceptable: collapse L1+L2 into one GO-LIVE commit — the whole change is
~4 files. The 4-layer split is recommended for the dormant checkpoint and family consistency; either
respects ≤5 files/commit and per-boundary verify. The dormant-first ORDER is load-bearing: the
enumerator cannot emit `execute` before the feature can route it, or L1 fails to compile.)*

### 4.2 This is a vertical slice, NOT horizontal (pre-empting an FM #25 misread)

Each layer keeps the feature working end-to-end: L1 ships a dormant-but-compiling path; L2 makes execute
validation live and unit-proven; L3 proves it in a real host; L4 audits it. "If I stop here, is
something working?" — yes at every boundary. One capability (execute value validation in `_quarto.yml`),
one pre-declared layer set.

### 4.3 Deferred to a later session (filed to `BACKLOG.md`, NOT built here)

- **`format:` document-key values in `_quarto.yml`** — genuinely harder: per-format nested keys,
  reader-derived (not curated) closedness, and the top-level `format:` scalar-vs-container ambiguity.
  Its own plan.
- **The general document-key case** — any front-matter key (toc/title/author/…) placed at the
  `_quarto.yml` top level as a project default. The top level of `_quarto.yml` is an **OPEN** set
  (custom metadata is legal), so this needs the "validate values of RECOGNIZED closed keys only, never
  flag an unknown top-level key" discipline — materially larger. Its own plan.
- **KEY validation of `execute:` children** — a **non-starter**, not a deferral: quarto accepts unknown
  execute keys (§2.3), so flagging them would be a cardinal-sin FP.
- **Depth-2+ under `execute:`** — object-valued execute children (`knitr`/`jupyter`/`julia`/`server`)
  DO exist, but a safe FN: they are absent from `CURATED_EXECUTE_KEYS` and it carries no `.children`, so
  path-based resolution of any depth-2 execute line yields `undefined` → skip. L3 adds a depth-2
  regression fixture (below) to LOCK this against a future `.children` addition silently opening an FP.
- **The pre-existing KEY-enumerator `scanFlow` gap** (`findProjectConfigKeyLines`, filed S135) — untouched.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped S140)

**Changed:**
- `src/core/project-yaml.ts`
  - `:18` `PROJECT_CONFIG_CONTAINERS` — **unchanged** (KEY set stays project-only).
  - `:96-98` `isProjectConfigContainer` — used at `:74` (KEY, unchanged) and `:184` (VALUE). **Add a
    sibling `isValueContainer`/`VALUE_CONTAINERS` (incl. `execute`) used ONLY at the VALUE call site.**
  - `:101-122` `ProjectConfigValueLine` — widen `container` (`:103`) to include `"execute"`.
  - `:149-271` `findProjectConfigValueLines` — column-0 branch `:182-189` uses `isValueContainer`;
    `currentContainer` local type widened. Depth/scanFlow logic unchanged.
- `src/features/yaml-project-value-diagnostics.ts`
  - `:114` field-set selection — route `execute → index.frontMatterKeys(["execute"])`.
  - `:79-90` `resolveProjectValueField` — **unchanged** (path resolver; execute path is `[]`).

**Reused, UNCHANGED (assert, don't touch):**
- `src/core/yaml-schema.ts` — `frontMatterKeys` execute branch `:593-594`; `CURATED_EXECUTE_KEYS`
  `:341-355`; `SchemaField` bits `valuesClosed :78`, `acceptsBoolean :111`, `scalarType :124`
  (the range is not contiguous — cite each field).
- `src/core/yaml-value-check.ts` — `isWrongValue` `:46`, numeric branch `:57-62`, `valueMessage` `:184`.
- `src/features/yaml-diagnostics.ts` — the unknown-KEY feature (must stay blind to `execute`).

**Tests / fixtures:**
- `test/unit/project-yaml.test.ts:149+` — add an `execute` describe (+ KEY-isolation test).
- `test/integration/suite/yaml-project-value-diagnostics.test.ts:39/:141` — add an `execute` describe.
- NEW `test/fixtures/yaml-project-execute-value/{invalid,valid}/_quarto.yml`.

**Cycle check (S140):** `src/core/yaml-schema.ts` does **not** import `project-yaml.ts` → no import
cycle introduced (and Change B keeps resolution in the feature, so no new core→core edge anyway).

---

## §6 — Alternatives considered (honest)

1. **Add `execute` to the shared `PROJECT_CONFIG_CONTAINERS` set** — REJECTED: the KEY enumerator would
   then flag unknown execute keys, a cardinal-sin FP (§2.3/§7). The value enumerator must diverge.
2. **A brand-new enumerator + feature for `execute`** — REJECTED: needless duplication; the depth-1
   machinery of `findProjectConfigValueLines` already handles a flat top-level container. One predicate
   + one routing line is smaller and lower-risk.
3. **Extract the field-set routing into a pure `core` resolver for a unit RED→GREEN** — CONSIDERED,
   not recommended: the resolution is 3 lines and the family's precedent (S135's `resolveProjectValueField`
   lives in the feature, integration-tested). Keeping it in the feature matches precedent; the enumerator
   (the actual new logic) still gets pure RED→GREEN unit coverage, and L3's real-host integration proves
   the routing. Revisit only if the routing grows a second special container (then a core helper earns
   its keep).
4. **Do `execute:` + `format:` together** — REJECTED: `format:` is materially harder (§4.3) and would
   bundle two capabilities (FM #26). `execute` alone is the near-term win.

---

## §7 — Failure-mode analysis (the safety story)

The feature only ever flags a key that is (a) a recognized `execute:` child AND (b) provably CLOSED
(`valuesClosed === true`, or numeric via `scalarType`). Every uncertainty is a silent skip. Specific
traps and why each is safe:

| Trap | Why it could FP | Why it does NOT |
|---|---|---|
| **`output: banana`** | looks like a bad enum value | `output` has no `valuesClosed` → `isWrongValue` skips (grounded exit 0). Lock with a valid-fixture row. |
| **`daemon: 30` / `daemon: true`** | not in a string enum | `daemon` is `scalarType:"number"`+`acceptsBoolean` → numeric branch accepts both (grounded exit 0). |
| **`custom-thing: whatever`** (unknown child) | could be flagged as "wrong" | resolver → `undefined` → skip; quarto accepts it anyway (exit 0). Value-only scope = correctness. |
| **`error: 5`** | tempting to treat `error` as numeric | `error` is boolean-only; `5` is correctly flagged "true or false" (grounded exit 1). |
| **multi-line quoted / flow value** | a folded continuation line looks like a child mapping | `scanFlow` guard skips the opener and all continuation lines → silent (safe FN); never emits a folded mapping. |
| **shared container set (HIGH)** | KEY feature starts flagging execute keys | value-scoped `isValueContainer`; `isProjectConfigContainer` untouched; KEY-isolation regression test. |
| **offline (CLI schema unavailable)** | `projectFields` is `[]` offline | `frontMatterKeys(["execute"])` returns `CURATED_EXECUTE_KEYS` **unconditionally** → execute validation is offline-robust. |
| **`.qmd` double-flag** | two features on one execute block | the `.qmd` value feature gates on `languageId==="quarto"`; `_quarto.yml` is `"yaml"` → never runs there. Separate collections. |

**Direction of every uncertainty is false-NEGATIVE** — the family's invariant holds.

---

## §8 — Impact analysis

- **New user-visible behavior:** wrong closed `execute:` values in `_quarto.yml` get an Error squiggle
  matching `quarto render`. No behavior change to `.qmd` documents, to `project:`/`website:`/`book:`
  validation, or to the unknown-KEY feature.
- **Performance:** one more recognized container in an existing O(n) single-pass scan; the feature
  already awaits the schema index once. Negligible.
- **Docs to reconcile at close-out (Learning #7/#10):** `BACKLOG.md` (flip the S135 sub-bullet (b)
  `execute:` half; `format:` stays open), `CHANGELOG.md`, `PROJECT_LEARNINGS.md`, `HANDOFFS.md`,
  `docs/POSIT-COMPARISON.md` if it asserts anything about `_quarto.yml` execute validation.

---

## §9 — Verification plan (executor)

- **Per-layer:** the DONE/Verify lines in §4.1.
- **Full matrix at each boundary:** `npm run check-types` + `npm test` (unit) + `npm run test:integration`.
- **Firsthand grounding:** re-render every fixture value with `quarto render` 1.7.33 and record exit
  codes (invalid → exit 1 SCHEMA; valid → exit 0). Do NOT trust §2's table blindly — re-probe.
- **§9 adversarial review (L4, MANDATORY):** an independent multi-lens `Workflow`, each lens
  `quarto render`-verified:
  1. **fp-cardinal** — does the shipped feature flag ANY execute value quarto accepts? (sweep `output`,
     `daemon` numeric/boolean, unknown children, all valid enum members, quoted/multi-line forms.)
  2. **container-isolation** — does `findProjectConfigKeyLines` (the KEY feature) still ignore `execute`?
     Does adding execute leak into any other consumer of the value enumerator?
  3. **surface-parity** — does the `_quarto.yml` result match the `.qmd` (S128) result for the same
     execute block? (they share the reader/matcher — divergence would signal a plumbing bug.)
  4. **doc-drift** — §5 inventory accurate; BACKLOG/POSIT-COMPARISON claims reconciled.
- **Runtime smoke (Phase 3E):** the feature changes runtime diagnostics; the L3 integration run in a
  real Extension Development Host IS the smoke test (this project's standard, Learning #3).

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

- **Q1 — Should the invalid fixture bundle multiple wrong values in one file, or one-per-file?** Recommend
  one invalid `_quarto.yml` with several wrong closed execute values (assert exact count + spans), mirroring
  the S135/S137 fixtures. Note the S139 lesson: quarto reports only the FIRST schema error per render, so
  ground each wrong value with a **single-value** probe, not only the combined file.
- **Q2 — Include `keep-md`/`keep-ipynb`/`daemon-restart`/`enabled` in the fixtures?** They are valid
  closed children (grounded §2.2) but low-frequency. Recommend covering `echo`/`cache`/`freeze`/`error`/
  `daemon`/`include` (the common set) + `output`(open)/`custom-thing`(unknown) traps; the rest are
  covered by the shared matcher and need no per-child fixture.
- **Q3 — 4-layer vs 3-layer decomposition (§4.1 note)?** Recommend 4-layer (dormant checkpoint).
  Non-load-bearing; the dormant-first ORDER is the only hard constraint.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. **The shared container set (HIGH).** `isProjectConfigContainer`/`PROJECT_CONFIG_CONTAINERS`
   (`project-yaml.ts:18/:96`) is used by the KEY enumerator (`:74`) too. Give the VALUE enumerator its
   **own** `isValueContainer`; leave the KEY set at `{project,website,book}`. **Write the KEY-isolation
   regression test.** Skipping this ships a cardinal-sin FP (`custom-thing` under execute).
2. **`output` is OPEN, `daemon` is NUMERIC, unknown execute keys are ACCEPTED.** All three are exit-0 in
   quarto → must never be flagged. Put all three in the VALID fixture as locked FP traps.
3. **`error` is boolean-only, not numeric** — `error: 5` is a valid RED case ("true or false"), not a
   number field. Don't "fix" it.
4. **Dormant-first ORDER (L1 before L2).** Widening `ProjectConfigValueLine.container` to include
   `"execute"` forces Change B (the routing branch) into the SAME commit — otherwise the `:114`
   `projectFields(entry.container)` call fails to typecheck (`projectFields`'s signature is
   `"project"|"website"|"book"`, `:527`). And L2 (the enumerator emitting `container:"execute"`) cannot
   land before L1, because it emits against the widened interface. So: L1 = type-widen + routing
   (compiles, dormant); L2 = enumerator go-live. Never the reverse.
5. **`frontMatterKeys(["execute"])` is offline-robust; `projectFields` is not.** Don't route execute
   through `projectFields` "for consistency" — it returns `[]` offline and would silently disable execute
   validation whenever the CLI schema fails to load.
6. **Ground every fixture value single-valued** (S139 lesson): quarto stops at the first schema error per
   render, so a combined invalid file does not prove each row rejects on its own.
7. **Do not touch the matcher / reader / message.** If you find yourself editing `isWrongValue`,
   `CURATED_EXECUTE_KEYS`, or `valueMessage`, stop — this slice needs none of that. A needed change there
   means the surface diverges from §2 and must be re-grounded before proceeding.

---

## Provenance — how this plan was grounded (Session 140)

- **Firsthand `quarto render` 1.7.33 probes** (session scratchpad): the full `execute:`-in-`_quarto.yml`
  value matrix (§2.2/§2.3) — echo/eval/warning/error/include/cache/freeze/enabled/daemon-restart/
  keep-md/keep-ipynb (closed) + daemon (numeric, incl. quoted-reject) + output (open) + custom-thing
  (unknown, accepted) + a multi-line quoted continuation — each with its exit code.
- **Source read** (S140): `yaml-value-check.ts` (matcher/message), `yaml-project-value-diagnostics.ts`
  (project-surface feature), `project-yaml.ts` (enumerator + shared container set), `yaml-schema.ts`
  (`CURATED_EXECUTE_KEYS` + the single shared `frontMatterKeys` execute branch), `yaml-value-diagnostics.ts`
  (document-surface reuse via `frontMatterKeys(nested.parentPath)`).
- **Evidence-based grep inventory** (§5) — every reference to the touched symbols, POST-S139.
- **Mandatory adversarial plan review** (`Workflow` `wf_3380b341-948`, S140): a 4-lens,
  `quarto render`-verified panel (fp-cardinal / container-isolation / surface-parity / design-inventory),
  each lens independently re-grounding firsthand. Result: **0 HIGH, 1 MEDIUM, 2 LOW, 9 INFO
  confirmations** — the three risk lenses returned PLAN-SOUND with **zero cardinal-sin FPs** found across
  a wide independent value battery. All three actionable findings were re-verified firsthand and folded:
  (MEDIUM) execute DOES have object-valued children (`knitr`/`jupyter`/`julia`/`server`) — §2.4/§4.3
  corrected, the safe-FN reasoning re-based on the curated reader's absent `.children`, plus a new L3
  depth-2 name-collision regression fixture; (LOW) `scalarType` cite fixed to `:124`; (LOW) the L1
  dormancy proof re-based on the structural argument (the emit site writes a variable, not a literal).
- **Deliverable = this plan.** No code shipped (FM #18/#19). Implementation is a separate session.
