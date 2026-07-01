# Phase 6d-6+ (b2-iii) — Deep-Nested Per-Format Option Completion: Implementation Plan

**Status:** PLAN (draft for executor sessions). Produced by Session 36 (2026-06-30) as a **grounding + plan** — the "🐉 recursive `schema/schema.yml` object-graph walk" the parent 6d plan and every b2 handoff reserved to b2-iii is **resolved (right-sized) here**; implementation is separate, later sessions.
**Author:** Session 36 (R. Mark Sharp / Claude).
**Governs:** `docs/planning/2026-06-30-phase-6d6b2-per-format-options-plan.md` §6 Slice **b2-iii** ("🐉 Deep nesting (3+ levels, object-valued options, `super`/`allOf`) — the ONLY genuine recursive-graph residue → deferred"). This is the per-slice plan that b2's §6 deferred.
**Out of scope:** Everything already shipped in 6d-1…6d-6 + the `format:`-name / top-level-`format:`-scalar / per-format KEY (b2-i) / per-format VALUE (b2-ii) work (Sessions 18–35). This plan covers ONLY completion **below** the first per-format option level — the sub-keys and sub-values of an object-valued format option (`format:\n  html:\n    code-tools:\n      <sub>`).

---

## 0. How this plan was produced (evidence provenance)

Grounded in firsthand inspection of the installed Quarto CLI (1.7.33) share dir + the repo, corroborated by a **9-agent grounding + adversarial-verification Workflow** (Session 36: 5 firsthand-re-derivation probes + 3 refute-by-default adversaries + 1 synthesizer, ~772K tokens). **Every load-bearing number below was verified by the author directly** (Planning-workstream mandate — Learning #24), then independently re-derived by the Workflow, which **corrected four drafted figures** (§2.1 caveats). The three adversarial verdicts materially shaped the plan:

- **"Deep-nested completion REQUIRES a recursive `schema/schema.yml` meta-graph walk"** — **REFUTED** (verifier verdict `supported` for the bounded-resolver thesis). Confirmed firsthand two ways: (1) `schema/schema.yml` is the **20-record DSL meta-grammar** (`schema/scalar`, `schema/enum`, `schema/ref`, `schema/object`, `schema/any-of`, `schema/all-of`, `schema/record`, `schema/schema-field`, …) — walking it would mean walking the *grammar that describes schemas*, never an option's property keys; (2) Quarto's own editor (`web-worker.js`) completes object sub-keys with **`navigateSchemaByInstancePath`** (exactly one `properties[key]` descent per YAML path segment, cycle-guarded via `resolveSchema`'s Floyd tortoise-and-hare on `$ref`) then **`getObjectCompletions`** (lists `Object.getOwnPropertyNames(properties)` — the terminal node's DIRECT keys, one level). There is **zero runtime `super`**: inheritance is flattened at schema build time. So the mechanism is **bounded path-navigation + list-object-properties** over the option DATA files (`schema/document-*.yml` + `schema/definitions.yml`), the same shape the repo's existing `valuesOfSchema` already uses for the VALUE side — NOT a meta-graph epic.
- **"b2-iii is test-only / nearly free, like b2-ii was"** — **REFUTED** (verifier verdict `refuted`, firsthand). b2-ii was test-only because all three layers were pre-wired (detector emitted the context, provider was generic, reader resolved `.values`). b2-iii is categorically different: the detector **hard-bails** at a 3-level position (`yaml-context.ts:246`), the reader returns `[]` for any `parentPath.length ≥ 3` (`yaml-schema.ts:391`), and **no function anywhere resolves an object schema's `properties`** — `valuesOfSchema` explicitly `return []` for the object form (`:553`). b2-iii needs genuine new production code in the detector + reader + a net-new resolver. **Do NOT plan it as a trace-and-test slice.**
- **"Sub-option VALUE completion comes essentially FREE by reusing `valuesOfSchema`"** — **REFUTED-mixed** (verifier verdict `mixed`, firsthand). Reusing `valuesOfSchema` on a sub-property IS right and free for ~5/16 sampled sub-props (inline `enum`/`boolean`), and ~10/16 are legitimately free-text (`[]`). BUT two genuine enums are **silently missed** because they use schema forms that only surface at the sub-property/definition level: `html-math-method.method = {ref: math-methods}` where the definition is `{enum: {values: […]}}` (the *object* enum form — `valuesOfSchema` only handles the inline `Array.isArray(s.enum)` list form, `:535`), and `editor.render-on-save = {tags, schema: boolean}` (a `{tags, schema}` wrapper `valuesOfSchema` has no case for). So the value side needs **two small `valuesOfSchema` extensions**, not zero work.

**Net:** the object graph reachable under a format option is **bounded and shallow** (40 object-valued options, max depth 4, exactly one reachable cycle). Deep-nested completion is a bounded object-property resolver + a detector generalization — **NOT** a `schema/schema.yml` walk — but it IS genuine new code (unlike b2-ii). The dragon shrinks to a lizard; it is still a lizard, not a photograph.

---

## 1. Executive summary (TL;DR)

**The dragon is bounded, not slain-for-free.** Completing `format:\n  html:\n    <opt>:\n      <sub>` means: (a) the detector walks the ancestor chain up to the column-0 `format` root and emits a path like `["format","html","code-tools"]`; (b) the reader resolves the named option's `object.properties` into child fields and returns them. The resolution is a bounded, depth-and-cycle-guarded object-schema walk — **the same primitive shape as the existing `valuesOfSchema`** (`anyOf` arms + one-hop `ref` into `definitions.yml` + a `depth>5` guard), but returning property KEYS instead of enum values. It never touches `schema/schema.yml`.

**b2-iii is ~2 implementation sessions + an optional third:**

| Slice | Capability | Ships | New logic |
|---|---|---|---|
| **b2-iii-key** | Deep-nested option **KEY** completion (one object level) | `format:\n  html:\n    code-tools:\n      <key>` → `source`/`toggle`/`caption` | Detector N-level format-rooted walk + a NEW `objectChildren` resolver + a reader `length≥3` navigation branch |
| **b2-iii-value** | Deep-nested option **VALUE** completion | `format:\n  html:\n    code-tools:\n      toggle: <value>` → `true`/`false` | Two small `valuesOfSchema` extensions (`{enum:{values}}` + `{tags,schema}`) + tests — small, NOT free |
| **b2-iii-deep** | 🐉 depth-4 (a second object level) + full `super`/`resolveRef` merge | *deferred* | The genuine residue — degrade gracefully, own future slice |

Each slice is **one session, strict TDD, vertical**. The provider (`src/providers/yaml.ts`) is already **generic over `parentPath`** (`:97-114`, verified firsthand) → it needs **ZERO change**; the whole feature lives in pure `vscode`-free core (§3.3 clean). **Recommended stopping point:** after **b2-iii-value** (one object level, key+value). b2-iii-deep is optional/v2.x and degrades gracefully.

**Honest value note (like the b2 plan's descope note):** deep-nested sub-key completion is a genuine enhancement for the common object options — `code-tools`, `theme` (light/dark), `grid`, `html-math-method`, `editor`, `mermaid`, `crossref` (49 subs), the `execute:` engine objects `julia`/`knitr`/`jupyter` — but many of the 40 objects are niche (`epub-*`, `about`, `listing`, `reveal-*`, `dashboard`). 6d already ships a complete cell-option + front-matter key/value + one-level-nested key/value + format-name + format-scalar + per-format key/value milestone. **The operator may reasonably descope b2-iii entirely** — it degrades gracefully today (a 3-level position offers nothing). This plan exists so that IF it is built, it is built right.

---

## 2. The mechanism, resolved — how deep-nested completion actually works

### 2.1 The data: 40 object-valued options, a shallow bounded graph (grounded firsthand + Workflow-verified)

Every format option whose value is an object exposes its sub-keys through its own `schema` field in `schema/document-*.yml`, resolved one hop into `schema/definitions.yml` when it is a `ref`. Firsthand counts over the installed 1.7.33 resource (`<share>/editor/tools/yaml/yaml-intelligence-resources.json`), independently re-derived by the Workflow:

- **40 non-hidden object-valued options**, **ALL** in `schema/document-*.yml`, **ZERO** in `schema/cell-*.yml` (+1 hidden, `document-execute.server`, giving 41 with hidden). → deep-nested completion is a **document-front-matter-only** concern; the per-format `cell-*` fold-in (b2-i's `perFormatSource`) contributes no object options.
- **13 of the 40** resolve their sub-properties only via **one `ref` hop** into `definitions.yml` (`citation`, `about`, `listing`, `comments`, `date`, epub contributors, links, `brand`, `filters`, …) → the resolver **MUST** implement the one-hop `ref` or ~⅓ of the objects complete nothing.
- Direct sub-property counts (the KEYS available at one level): `crossref` 49, `listing` 30, `citation` 10 (shallow — see `super` below), `about` 8, `chalkboard` 7, `nav-buttons` 7, `margin` 6, `title-slide-attributes` 6, `grid` 5, `lightbox` 5, `other-links`/`code-links` 5; plus the common ones `code-tools` 3, `theme` 2, `editor` 3, `html-math-method` 2, `mermaid` 1, `comments` 3, execute's `julia` 2 / `knitr` 2 / `jupyter` 1.
- **Max object-nesting depth reachable under a single format option = 4** (e.g. `comments → hypothesis → focus → user`; `brand` also reaches 4). Bounded and shallow.
- **Exactly ONE cycle is reachable** from a `document-*` format option: `about → links → navigation-item ↔ navigation-item-object`. → **cycle-guarding is MANDATORY** (a visited-ref set, in addition to the `depth` guard).
- **`allOf`: ZERO** object-valued options use it → **do not build `allOf` resolution.**
- **`super`: 8 definitions carry it**, but it is load-bearing for only **`citation`** (shallow — `citation-item.super = {resolveRef: csl-item}`, and `csl-item.super = {resolveRef: csl-item-shared}`; merging adds 113 keys, 10→123) and **`brand`** (5 ref-hops deep, niche). Every real `super` value is a single `{resolveRef: <name>}` dict — never a bare string, never a list. → **`super` is deferrable in general**; deferring it degrades only `citation` (to its 10 own keys) and deep `brand`.

> **⚠ Four drafted numbers the Workflow CORRECTED (do not re-inherit the wrong ones):** (1) the parent framing's "14 nested-object options" is a **miscount** — it is **9** options with a nested-object sub-property (`about`, `brand`, `citation`, `comments`, `crossref`, `editor`, `funding`, `jupyter`, `listing`) OR **19** option→subprop object pairs. (2) Max depth is **4**, not ≤3. (3) `super` is reached by **two** options (`citation` hop-1, `brand` hop-5), not "exactly one". (4) `EXTENSION_ID` is now hardcoded in **13** integration suites, not Learning #18's documented 8 — a doc-hygiene fix to make during this work.

### 2.2 The algorithm (mirrors Quarto's `navigateSchemaByInstancePath` + `getObjectCompletions`, verified firsthand)

Quarto completes a deep-nested sub-key by navigating the compiled JSON schema along the YAML key path, then listing the terminal object node's direct properties. Reproduced for our reader as a bounded resolver over `SchemaField` sub-trees:

```
frontMatterKeys(path):                      # path = ["format", fmt, opt1, opt2, ...]
  if path.length < 3 or path[0] != "format" → (existing branches)
  fields = perFormatFields.filter(formatMatches(_, path[1]))   # the ["format", fmt] set (b2-i)
  node   = find(fields, name == path[2])                       # the object option, e.g. code-tools
  for seg in path[3:]:                                         # descend one object level per extra segment
      node = find(node.children, name == seg)
      if node is undefined → return []                         # unknown sub-key → nothing (never wrong)
  return node?.children ?? []                                  # the terminal object's child keys
```

where each object-valued field carries a resolved `children: SchemaField[]` computed once at parse time by the NEW `objectChildren` resolver:

```
objectChildren(rawSchema, definitions, depth, seenRefs):       # sibling of valuesOfSchema
  if depth > CAP or cyclic(rawSchema) → []                     # depth + visited-ref cycle guard (about→links!)
  resolve rawSchema through: anyOf (first object arm), one-hop ref into definitions, maybeArrayOf
  if it is {object: {properties}}:
      return [ toChildField(name, propSchema) for name, propSchema in properties ]   # name + description + values(propSchema)
  return []                                                    # bare object / scalar leaf → no children (never throws)
```

`toChildField` reuses `descriptionOf` and `valuesOfSchema` (so a child that is itself `enum`/`boolean` carries its `values` for the value side — free), and recursively sets its own `children` up to the depth cap. **Do NOT build `allOf` (zero real usages) and DEFER `super` for v1** (document the `citation`/`brand` limitation, §7).

### 2.3 Why `children` (eager resolution), not raw-schema-on-demand

Two designs were considered for how the reader reaches an option's sub-keys:

- **(chosen) `children: SchemaField[]` resolved eagerly in `toField`.** The `SchemaField` type gains an optional `children`; `objectChildren` runs once per object-valued field at parse time (40 fields, cheap, bounded). `frontMatterKeys` then just navigates the `children` tree. **This makes the VALUE side reuse the existing machinery verbatim:** for `format:\n  html:\n    code-tools:\n      toggle: <value>`, the provider calls `frontMatterKeys(parentPath.slice(0,-1))` = `frontMatterKeys(["format","html","code-tools"])` = `code-tools.children`, then finds `toggle` and reads its `.values` — the exact same value path b2-ii/6d-5 use. No provider change, no new value navigation.
- **(rejected) carry the raw `schema` on `SchemaField` and resolve on demand in `frontMatterKeys`.** Leaks raw DSL into the query path, duplicates the resolve logic between key and value, and gives no reuse of the value machinery. Rejected.

`children` keeps the pure-core boundary clean (§3.3), keeps the resolver in one place, and makes b2-iii-value a small `valuesOfSchema` extension rather than new navigation.

### 2.4 Licensing / posture — unchanged from 6d-3 / b2-i

All of this is **runtime-read** from the user's own MIT Quarto CLI share dir (the same JSON already loaded by `features/yaml-schema-source.ts`), so: **+0 `.vsix` bytes, no NOTICE, auto-tracks the user's Quarto version, never throws → curated fallback** (Learning #27, the established 6d posture). Property names + definition names are uncopyrightable facts; descriptions are our own. Add `navigateSchemaByInstancePath` / `getObjectCompletions` / `resolveSchema` (the object-completion path in `web-worker.js`) and the `{enum:{values}}` definition form to the **re-verify-on-Quarto-upgrade** marker list (Learnings #4/#8/#11/#25/#27/#32/#40/#41).

---

## 3. Scope — the slice boundaries

Per the parent 6d plan §3 binding rules (do NOT violate):

- **(a) Never bundle KEY + VALUE in one slice.** → b2-iii-key and b2-iii-value are separate sessions.
- **(b) Grow the pure core just-enough per slice.** → b2-iii-key adds the detector N-level walk + the `objectChildren` resolver + the reader `length≥3` branch; b2-iii-value adds only the two `valuesOfSchema` cases + tests.
- **(c) Never build the schema-consumption core as a standalone no-UI session** (forbidden horizontal layer, FM #25). → each slice ships a real completion in the editor.

**The genuine remaining residue (b2-iii-deep) — a SECOND object level (depth-4) + full `super`/`resolveRef` merge — is descoped to its own future slice** and must not block b2-iii-key/-value. It degrades gracefully: a depth-4 position offers nothing (the reader returns `[]` for `path.length ≥ 4` in v1), and `citation`/`brand` complete their direct keys without the inherited `super` keys.

**v1 depth policy (ratify at §9 Q2):** the detector is **schema-free** (position ⊥ data — Learning #24/#40e): it emits the *full* format-rooted ancestor path regardless of depth. The **reader** is the depth gate — it resolves **one object level** (`path.length === 3`) in v1 and returns `[]` for `path.length ≥ 4` (deferred, shape-locked). This keeps the detector simple (climb to the `format` root) and puts the one depth decision in one place.

---

## 4. Evidence-based inventory (MANDATORY — grep-verified firsthand + Workflow-cross-checked)

All `file:line` below were confirmed firsthand this session (`grep -n`, full reads of the three source files + the test file) AND independently re-verified by the Workflow's grep probe (which reported every anchor matching exactly). This inventory **is** the plan's verification step — the executor's "files to change" list comes from here.

### 4.1 Reuse table (exists; consume/extend, do not rebuild)

| # | Component | Location | How b2-iii uses it |
|---|---|---|---|
| R1 | Nested-context detector | `src/core/yaml-context.ts` `nestedKeyContextAt:160-210`; `nestedParentPath:225-253`; `nearestShallowerLine:291-310`; `mappingContainerKey:262-276`; `NESTED_CONTAINERS:329` (`{execute, format}`) | **Generalize** `nestedParentPath` from a bounded 2-level walk to an N-level ancestor walk rooted at the column-0 `format` (§5.1). KEY branch (`:187`) and VALUE branch (`:201`) already build multi-element paths from `parentPath` — they grow automatically. |
| R2 | The 2-level cap | `yaml-context.ts:245-252` (`grandLine` must be column 0 `:246`; root must be `"format"` `:249`; `return ["format", container]` `:252`) | This is the exact cap to lift — climb past the grandparent while each ancestor is a pure-mapping key and the eventual column-0 root is `format`. |
| R3 | Value-slot grammar (shared) | `yaml-context.ts` `valueSlotAfterColon:371-385` (used by `topLevelSlots` + `nestedKeyContextAt`) | Reused unchanged for the deep-nested value slot. |
| R4 | Value resolver | `src/core/yaml-schema.ts` `valuesOfSchema:520-554` (handles `boolean`/inline `enum`(`:535`)/`anyOf`/`maybeArrayOf`/one-hop `ref`(`:544`)/`string.completions`; `return []` for object/deferred forms `:553`; `depth>5` guard `:525`) | **b2-iii-key:** reused by `objectChildren` to give each child field its `values` (free for inline enum/boolean). **b2-iii-value:** EXTEND with two cases — the `{enum:{values:[…]}}` definition form and the `{tags, schema:…}` wrapper (§5.4). |
| R5 | Field translator | `yaml-schema.ts` `toField:570-600` (captures name/description/values/engine/formats/contexts) | **Extend** to resolve `children` for an object-valued field (call `objectChildren` on `e.schema`), set `field.children` when non-empty. |
| R6 | Index query | `yaml-schema.ts` `frontMatterKeys:366-392` (`[]`→top; `["execute"]`; `["format"]`; `["format",fmt]`→per-format `:387`; catch-all `return []` `:391`) | **Add** a `parentPath[0]==="format" && parentPath.length>=3` navigation branch (before `:391`) that descends `children` (§5.3). |
| R7 | Provider (generic over `parentPath`) | `src/providers/yaml.ts` frontmatter-key `:97-101` (`frontMatterKeys(ctx.parentPath)`), frontmatter-value `:102-114` (`frontMatterKeys(ctx.parentPath.slice(0,-1))`) | **ZERO change** — a 3+ element path flows through unchanged (verified firsthand; both branches are length-agnostic). |
| R8 | Per-format source + filter | `yaml-schema.ts` `perFormatSource:647-656`, `formatMatches` (`core/format-aliases.ts`), `indexOf:340-394` | The `["format",fmt]` set b2-iii navigates FROM (b2-i). `objectChildren` runs on fields already in this set. |
| R9 | Impure read (isolated) | `src/features/yaml-schema-source.ts` (`node:fs/promises`, `quartoSharePath`, degrade to `CURATED_SCHEMA_INDEX`) | **Unchanged** — object schemas ride in the same JSON already read; no new spawn/read. §3.3 guardrail untouched. |
| R10 | Tests | `test/unit/yaml-context.test.ts` (54), `test/unit/yaml-schema.test.ts` (32), `test/unit/yaml-schema-index.test.ts` (46), `test/integration/suite/yaml.test.ts` (66); `EXTENSION_ID` const in **13** suites (Learning #18, drifted from 8) | Add cases + FLIP the one deferral shape-lock at `yaml-context.test.ts:325` (§4.3). Re-run the FULL integration suite (Learning #18). |

### 4.2 Gaps table (does NOT exist; must be built)

| # | Gap | Evidence | Built in slice |
|---|---|---|---|
| G1 | **N-level nested-position detection.** `nestedParentPath` hard-bails when the grandparent is not at column 0 (`yaml-context.ts:246`), so `format:\n  html:\n    opt:\n      <sub>` yields `null`. No code path emits a 3+ element `parentPath`. | `yaml-context.ts:245-252`; the deferral test `yaml-context.test.ts:325` | **b2-iii-key** — the N-level format-rooted walk (§5.1). |
| G2 | **Object-property resolver.** No function resolves an `object` schema's `properties`; `valuesOfSchema` returns `[]` for the object form (`:553`); `toField` never recurses into a nested object. | `yaml-schema.ts:553`; no `object.*properties` read in `src/` | **b2-iii-key** — the pure `objectChildren` resolver + `SchemaField.children` + `toField` wiring (§5.2). |
| G3 | **`frontMatterKeys(["format",fmt,opt,…])` navigation.** Any `parentPath.length ≥ 3` returns `[]` (`yaml-schema.ts:391`). | `yaml-schema.ts:387-391` | **b2-iii-key** — the `length≥3` descend-`children` branch (§5.3). |
| G4 | **Sub-value schema forms.** `valuesOfSchema` misses the `{enum:{values:[…]}}` definition-enum form (only inline `Array.isArray(s.enum)` at `:535`) and the `{tags, schema:…}` wrapper — so `html-math-method.method` (6 values) and `editor.render-on-save` (boolean) resolve to `[]`. | `yaml-schema.ts:535`, `:531-533` (no `{tags,schema}` case) | **b2-iii-value** — two `valuesOfSchema` cases (§5.4). |
| G5 | **Deep (depth-4) + `super` residue.** No second-object-level navigation; no `super`/`resolveRef` merge. | `about`/`comments`/`brand` reach depth 4; `citation` super chain 10→123 | **b2-iii-deep** (DEFERRED) — §6. |

### 4.3 The deferral shape-locks (specify exactly which FLIPS and which STAY)

Implementing a deferred behavior flips its shape-lock in the SAME change (Learnings #29c/#31d/#33e/#41d). The Workflow's grep probe confirmed the exact set:

- **`test/unit/yaml-context.test.ts:325-330` "bails (null) THREE levels under `format:` — deep nesting is deferred (b2-iii)"** — fixture `["---","format:","  html:","    theme:","      x","---"]`, cursor in `x` at (line 4, col 7), currently asserts `.toBeNull()`. **THIS FLIPS** (the single b2-iii-key RED→GREEN detector discriminator). `theme` resolves to an `{object: {properties: {light, dark}}}`, so after b2-iii-key it must assert `{kind:"frontmatter-key", parentPath:["format","html","theme"], token:"x", replaceRange:{line:4,startCol:6,endCol:7}}`. (Note: the completion VALUES `light`/`dark` are a reader concern, proven at the integration layer; the detector test only pins the context/path.)
- **`test/unit/yaml-context.test.ts:332-337` "bails (null) two levels under a NON-`format` root (the walk is format-rooted)"** — fixture `website:\n  html:\n    toc: x`. **STAYS null** — a permanent scoping guard, NOT a deferral lock. If the N-level walk wrongly generalizes to any container, this goes RED — a built-in guard the executor must keep green.
- **`test/unit/yaml-context.test.ts:254` "bails (null) on deeper nesting (parent is itself indented)"** (`execute:\n  julia:\n    exeflags: x`) — **STAYS null.** The N-level walk is `format`-rooted; `execute` stays one level. Keep as the negative control that the walk did not over-generalize to `execute` (whose `julia`/`knitr`/`jupyter` ARE object-valued but are out of scope — §7).
- **Integration `test/integration/suite/yaml.test.ts` "offers NOTHING three levels under `format:`"** (the Workflow probe located it near `:1167`; the executor must re-grep the exact line, as line numbers drift) — **FLIPS** to assert the sub-keys appear (the b2-iii-key integration RED→GREEN, gate-d).

---

## 5. Interface contracts (interface-first; all core types, never `vscode.*`)

### 5.1 Detector — N-level format-rooted ancestor walk (`core/yaml-context.ts`)

Generalize `nestedParentPath` so the ancestor chain may climb **any number of pure-mapping levels up to a column-0 `format` root** (execute stays one level). Schema-free (the detector never imports schema data; the reader decides what a name means):

```
nestedParentPath(lines, line, indent):
  parent = nearestShallowerLine(lines, line, indent)            # the immediate container
  container = mappingContainerKey(parent); require non-null (scalar/flow/block-scalar/sequence bail)
  parentIndent = leadingWs(parent)
  if parentIndent == 0:
      return NESTED_CONTAINERS.has(container) ? [container] : null    # ONE level (unchanged: execute/format)
  # container is indented — climb the chain, collecting keys, until a column-0 root:
  path = [container]
  cur  = parentLine; curIndent = parentIndent
  loop (bounded by line count):
      up = nearestShallowerLine(lines, cur, curIndent)
      if up < 0 → return null
      key = mappingContainerKey(lines[up]); if key == null → return null   # scalar/flow/seq intermediate bail
      upIndent = leadingWs(lines[up])
      path.unshift(key)
      if upIndent == 0:
          return key == "format" ? path : null                  # rooted at format only (keeps :254 / :332 green)
      cur = up; curIndent = upIndent
```

`nearestShallowerLine` already returns the line index (b2-i change), so the loop steps up repeatedly. **Conservative posture unchanged:** bail (`null`) on any scalar/flow/block-scalar/sequence intermediate, or a non-`format` column-0 root. A `["format", fmt, opt1, …]` path of any length flows out; the KEY branch (`nestedKeyContextAt:187`) and VALUE branch (`:201`) already build `parentPath` / `[...parentPath, keyText]` from it. Detector stays in `yaml-context.ts` (model.ts is out of scope — SAFEGUARDS: no cross-module refactor without plan mode).

### 5.2 Object-property resolver (new pure function in `core/yaml-schema.ts`)

```ts
export interface SchemaField {
  name: string; description?: string; values?: string[];
  engine?: "knitr" | "jupyter"; formats?: string[]; contexts?: string[];
  /** For an object-valued option: its resolved child fields (one object level; b2-iii-key). */
  children?: SchemaField[];
}

/** The child SchemaFields of an object-valued schema, or `[]` — a bounded, depth+cycle-guarded
 *  sibling of `valuesOfSchema` (resolves anyOf/ref-one-hop/maybeArrayOf to {object:{properties}},
 *  lists properties as child fields with their own values). Never throws. `allOf`/`super` deferred. */
function objectChildren(schema: unknown, definitions: Map<string, unknown>, depth: number,
                        seenRefs: Set<string>): SchemaField[];
```

- Resolve `schema` through `anyOf` (first arm that lands on an object), one-hop `ref` into `definitions` (guarded by `seenRefs` — the `about→links` cycle is reachable), and `maybeArrayOf`.
- On `{object: {properties}}`: return `Object.entries(properties).map((name, sub) => ({ name, description: descriptionOf(sub.description), values: valuesOfSchema(sub, …) || undefined, children: objectChildren(sub, …, depth+1, seenRefs) }))` — reusing `descriptionOf` + `valuesOfSchema`. (For **v1 depth policy** §3, cap `children` recursion at ONE level: pass `depth+1` and have the branch return `[]` at `depth >= 1` so only the first object level is resolved; deeper is b2-iii-deep. Ratify the exact cap at §9 Q2.)
- Bare `object` (no `properties` — `journal`/`article`/`variables`/`metadata`) and scalar leaves → `[]` (never-throw/empty posture).
- **Do NOT build `allOf`** (zero real usages). **DEFER `super`** (document `citation`/`brand` limitation, §7).

`toField` (`:570`) calls `objectChildren(e.schema, definitions, 0, new Set())` and sets `field.children` when non-empty.

### 5.3 Index navigation (`core/yaml-schema.ts` `frontMatterKeys`)

Add before the catch-all `return []` (`:391`):

```ts
if (parentPath.length >= 3 && parentPath[0] === "format") {
  const perFormat = /* the ["format", parentPath[1]] per-format set (existing :387 logic, factored) */;
  let node: SchemaField | undefined = perFormat.find((f) => f.name === parentPath[2]);
  for (const seg of parentPath.slice(3)) {          // v1: this loop body is unreachable (len===3);
    node = node?.children?.find((c) => c.name === seg);   // present for b2-iii-deep, returns [] via the guard
  }
  return node?.children ?? [];                      // the object option's child keys (or [] — unknown/leaf)
}
```

For **v1** (`parentPath.length === 3`) this returns the named option's `children`. For `length ≥ 4` the descend loop runs; with the v1 one-level `children` cap (§5.2) the deeper `children` are absent → returns `[]` (deferred, shape-locked). The VALUE path is automatic: the provider's `frontMatterKeys(parentPath.slice(0,-1))` resolves the child list, then `valueItems` finds the last segment and reads its `.values` (§2.3).

### 5.4 Value resolver extensions (`core/yaml-schema.ts` `valuesOfSchema`) — **b2-iii-value only**

Two cases, so real sub-enums complete (adv:value-side-free MIXED, §0):

```ts
// (a) the definition/ref enum-OBJECT form {enum: {values: [...]}} (math-methods etc.):
if (s.enum !== null && typeof s.enum === "object" && Array.isArray((s.enum as any).values)) {
  return dedupe((s.enum as any).values.map(scalarToYaml).filter(nonNull));
}
// (b) the {tags, schema: ...} wrapper form (editor.render-on-save):
if (s.schema !== undefined) { return valuesOfSchema(s.schema, definitions, depth + 1); }
```

Ground BOTH firsthand against the installed schema (Learning #41c) before coding — the `definitions.yml` enum forms are inconsistent (`page-column` uses a plain list, `math-methods` uses `{values:[…]}}`), so a resolver handling only one silently drops completions.

### 5.5 Provider (`providers/yaml.ts`) — UNCHANGED

`frontMatterKeys(ctx.parentPath)` (key, `:99`) and `frontMatterKeys(ctx.parentPath.slice(0,-1))` (value, `:110`) already accept any-length paths. A `["format","html","code-tools"]` key path and a `["format","html","code-tools","toggle"]` value path both resolve with no provider edit. Verified firsthand + Workflow-confirmed.

---

## 6. The slices (each = ONE session, strict TDD, vertical)

> Format per slice: **Goal → New/changed files → What DONE looks like → Verification → Dragons → Session boundary.** 5-file-per-commit cap is per-commit; checkpoint-commit at each layer boundary (core detector → core resolver/reader → tests).

### Slice b2-iii-key — deep-nested option KEY completion (one object level) — SHIP FIRST

- **Goal:** On a sub-key line one object level under a per-format option (`format:\n  html:\n    code-tools:\n      <key>`), offer that option's object sub-keys (`source`/`toggle`/`caption`). Works for the 40 object-valued options at depth 3; a non-object option or an unknown format offers nothing (safe).
- **New/changed:** `core/yaml-context.ts` (generalize `nestedParentPath` to the N-level format-rooted walk — §5.1) · `core/yaml-schema.ts` (`SchemaField.children`; the pure `objectChildren` resolver — §5.2; wire it in `toField`; the `frontMatterKeys` `length≥3` navigation branch — §5.3; optionally a tiny curated fallback — §9 Q3) · `providers/yaml.ts` **UNCHANGED** · unit tests (`yaml-context.test.ts` +N-level walk cases & FLIP `:325`; `yaml-schema.test.ts`/`yaml-schema-index.test.ts` +`objectChildren`/`frontMatterKeys(["format","html","code-tools"])`) + integration (`yaml.test.ts`, FLIP the "offers NOTHING three levels" lock).
- **DONE:** in `format:\n  html:\n    code-tools:\n      <cursor>`, `source`/`toggle`/`caption` appear; a non-object option (`format:\n  html:\n    toc:\n      <cursor>`) offers nothing; a DEPTH-4 position (`format:\n  html:\n    comments:\n      hypothesis:\n        <cursor>`) STILL offers nothing (deferred, shape-locked); `execute:\n  julia:\n    <cursor>` STILL bails (`:254` green); the `website:` non-format root STILL bails (`:332` green); prose/cell positions still yield nothing (both-directions gating regression).
- **Verify:** `npm test` (the `:325` flip is the headline detector RED→GREEN; `objectChildren` unit RED→GREEN); `npm run test:integration` (provider via `executeCompletionItemProvider`; inverted-gating regression; re-run the FULL suite — 13 `EXTENSION_ID` suites, Learning #18); `npm run compile`; `npm run package`. **Gate-d discriminator:** the integration positive must assert a **reader-only** object sub-key that cannot come from any curated fallback (e.g. `code-tools → toggle`, or `grid → sidebar-width`) appears under `format:\n  html:\n    <opt>:` — proving `objectChildren` ran end-to-end against the real installed schema. Break-revert (runtime-conditional, build stays clean — Learning #33d/#38d): (1) neuter the N-level walk (reds the `:325` flip + the integration positive); (2) force `objectChildren` to `[]` (reds the sub-key integration positive while the per-format b2-i/b2-ii tests stay green); (3) force `quartoSharePath` to throw (reds the reader-only discriminator while curated-served tests stay green — proves reader-derived).
- **Dragons (🐉):** (1) **Cycle guard is MANDATORY** — `about → links` reaches the `navigation-item ↔ navigation-item-object` cycle; `objectChildren` needs a `seenRefs` set (not just `depth`); add a fixture asserting `about`-object completes without hanging. (2) **The one-hop `ref`** — 13/40 objects (incl. `citation`/`about`/`listing`/`comments`) resolve their properties only via a `ref` into `definitions.yml`; resolve it or ⅓ complete nothing. (3) **Fidelity grounding is the HIGHEST-risk step** (exactly where Session 34/Learning #41 broke the 0-confirmed streak) — mirror Quarto's `navigateSchemaByInstancePath` + `getObjectCompletions` over the REAL installed schema and diff to zero BEFORE coding; ground `objectChildren` against every one of the 40 objects. (4) **Depth cap** — return `[]` at the second object level for v1; lock the depth-4 deferral with a shape-lock, don't silently mis-navigate. (5) **Keep the walk `format`-rooted** — `:254`/`:332` are the standing guards.
- **Boundary:** one session. Close out when deep-nested KEYS complete at one object level. **Do not also do values.**

### Slice b2-iii-value — deep-nested option VALUE completion

- **Goal:** After a deep-nested option sub-key (`format:\n  html:\n    code-tools:\n      toggle: <value>`), offer that sub-key's enum/boolean values (`true`/`false`; `html-math-method:\n  method:` → `plain`/`webtex`/`mathml`/`mathjax`/`katex`; `grid:\n  content-mode:` → its enum).
- **Trace first (Learning #29a/#33a/#42a), but it is NOT test-only** (adv:value-side-free MIXED): after b2-iii-key, the detector already emits `{kind:"frontmatter-value", parentPath:["format","html","code-tools","toggle"]}`, the provider does `frontMatterKeys(["format","html","code-tools"]).find("toggle").values`, and `children` already carry `values` from `valuesOfSchema` — so INLINE enum/boolean sub-values (~5/16) already work. BUT two forms are missed: the `{enum:{values:[…]}}` definition-enum and the `{tags, schema}` wrapper (§5.4). This slice = the two `valuesOfSchema` cases + the value TESTS.
- **New/changed:** `core/yaml-schema.ts` (`valuesOfSchema` +2 cases — §5.4) + unit + integration VALUE tests.
- **DONE:** `html-math-method:\n  method:` completes its 6 values; `editor:\n  render-on-save:` completes `true`/`false`; an inline-enum sub-key (`code-tools:\n  toggle:`) completes `true`/`false`; a free-text sub-key (`grid:\n  sidebar-width:`) offers nothing (no crash); the leading-space-on-`:` normalization holds.
- **Verify:** as b2-iii-key. Gate-d: a reader-only value discriminator whose enum comes ONLY via a missed form (`html-math-method.method` → 6 values); break-revert the `{enum:{values}}` case (reds that test while inline-enum sub-values stay green).
- **Dragons:** the value `parentPath` is now 4 elements (`["format","html","code-tools","toggle"]`); confirm `parentPath.slice(0,-1)` = `["format","html","code-tools"]` resolves `children`, not `[]`. Ground the two `valuesOfSchema` forms firsthand (the `definitions.yml` enum inconsistency — §5.4).
- **Boundary:** one session.

### Slice b2-iii-deep — 🐉 depth-4 + `super`/`resolveRef` merge (DEFERRED / v2.x)

- **Goal:** completion at a SECOND object level (`format:\n  html:\n    comments:\n      hypothesis:\n        <sub>`, and the depth-4 `brand`/`comments` chains), plus full `super` merge so `citation` completes its 123 resolved keys (not just 10).
- **Why deferred:** it lifts the v1 one-level `children` cap (recursive resolution to depth 4, still bounded + cycle-guarded) and adds `super`-via-`{resolveRef}` merge — a distinct, larger fidelity capability touching a handful of niche options. It degrades gracefully in b2-iii-key/-value (the option's direct keys complete; the deeper object offers nothing; `citation` completes its 10 own keys). **Alternative to a general `super` resolver:** special-case the single `citation-item → csl-item → csl-item-shared` `resolveRef` chain (10→123) if citation-object keys are judged high-value — cheaper than a general merger.
- **Boundary:** its own future planning + implementation session(s). Document the one-object-level + no-`super` limitation when b2-iii-key ships.

---

## 7. Failure-mode / risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Missing cycle guard** → infinite loop on `about → links` | High | `objectChildren` MUST carry a `seenRefs` visited set (not just `depth`); the `about → navigation-item ↔ navigation-item-object` cycle is reachable (Workflow-confirmed). Add a fixture asserting `about`-object completes without hanging. |
| **Fidelity: resolver drops real sub-keys** (mis-resolves `anyOf`-object arm / the one-hop `ref` / a bare object) | High | Mirror Quarto's `navigateSchemaByInstancePath` + `getObjectCompletions` over the REAL installed schema and diff to zero BEFORE coding (Learning #41c — the exact step whose omission broke the 0-confirmed streak in Session 34). Ground against all 40 objects. |
| **Value side treated as free** → `html-math-method.method`/`editor.render-on-save` complete nothing | Medium | b2-iii-value adds the `{enum:{values}}` + `{tags,schema}` cases (§5.4); ground the `definitions.yml` enum-form inconsistency firsthand. Do NOT fold value into the key slice assuming zero work. |
| **Detector over-generalizes** the N-level walk to non-`format` roots (`execute:\n  julia:\n    …` completes) | High | The walk returns non-null only when the column-0 root is `format`; `:254` (execute) and `:332` (website) are standing guards; break-revert-prove the walk reds ONLY the format cases. |
| **Depth-4 mis-navigation** (silently offers wrong keys instead of nothing) | Medium | v1 caps `children` at one object level → `frontMatterKeys(len≥4)` returns `[]`; lock the depth-4 deferral with a shape-lock test, don't silently descend. |
| **Deferring `super` degrades `citation` 123→10 keys** | Low | Document as a known limitation when b2-iii-key ships, OR special-case the `citation-item → csl-item → csl-item-shared` chain (b2-iii-deep). Do NOT leave it implicit. |
| **Bare `object` options** (`journal`/`article`/`variables`/`metadata`) error instead of completing nothing | Low | `objectChildren` returns `[]` for an object with no `properties`; test it (never-throw/empty posture). |
| **Provider-unchanged assumption wrong** | Low | Verified firsthand (`:97-114` generic). Keep a regression proving a 3+ element `parentPath` flows through unchanged; the RED baseline for the reader change must use a reader-only discriminator (Learning #31b/#41), since a 3-element path already degrades to `[]` pre-slice. |
| **`format-scoped` filtering at the object level** (does `formatMatches` still apply below the option level?) | Low | The per-format filter applies at the OPTION level (b2-i); an option's own sub-keys are not independently format-tagged. Confirm against `getFormatSchema` firsthand (§9 Q5). |
| **Doc drift** — `EXTENSION_ID` now in 13 suites, not Learning #18's 8 | Low (hygiene) | Correct the count in Learning #18 during this work to keep the inventory honest. |

---

## 8. Alternatives considered

| Alternative | Why not |
|---|---|
| **Recursive `schema/schema.yml` object-graph walk** (the inherited framing) | REFUTED firsthand + by an adversarial verifier: `schema/schema.yml` is the 20-record DSL *meta-grammar*, not the format-option graph. Quarto completes sub-keys with a bounded path-navigation (`navigateSchemaByInstancePath` + `getObjectCompletions`) over the option DATA files + `definitions.yml`. Using a meta-graph walk would be a large over-build. |
| **b2-iii as a test-only slice (like b2-ii)** | REFUTED (verifier `refuted`, firsthand): the detector hard-bails at 3 levels, the reader returns `[]` for `len≥3`, and NO function resolves an object's `properties`. Genuine new code in 3 layers. |
| **Carry the raw `schema` on `SchemaField`, resolve on demand in `frontMatterKeys`** | Rejected (§2.3): leaks raw DSL into the query path, duplicates resolution between key and value, and loses the free reuse of the value machinery. `children` (eager, resolved once in `toField`) is cleaner and makes the value side reuse existing code. |
| **Build `allOf` resolution** | Unnecessary — ZERO object-valued options use `allOf` (Workflow-confirmed EXACT); it appears only in the meta-grammar. |
| **Build a general `super` merger in v1** | Over-build for v1 — only `citation` (shallow) + `brand` (5-hops, niche) reach `super`. Defer; if `citation`-object is in scope, special-case its single `resolveRef` chain (b2-iii-deep). |
| **Validate the format/option names in the DETECTOR** | Rejected: couples the pure position module to schema data. The reader degrades an unknown option/format to `[]` — cleaner separation (position ⊥ data — Learning #24/#40e). |
| **Provider special-case for the deep path** | Unnecessary — the provider is already generic over `parentPath` (`:97-114`, verified firsthand). |
| **Descope b2-iii entirely** | A LEGITIMATE operator choice (§1). 6d already ships a complete milestone; deep-nested completion is an enhancement that degrades gracefully. This plan makes it buildable-if-chosen, not mandatory. |

---

## 9. Open questions for the executor (resolve at implementation, not now)

1. **VALUE slice is NOT free (b2-iii-value):** it needs the two `valuesOfSchema` cases (`{enum:{values}}` + `{tags,schema}`). Keep it a SEPARATE slice from keys (do not bundle). Trace after b2-iii-key to confirm which inline sub-values already work vs which need the extensions.
2. **Depth cap for v1 (§3, §5.2):** stop at one object level (`children` depth 1, `frontMatterKeys` resolves `len===3`) and defer depth-4 with a shape-lock — RECOMMENDED. Or resolve the full bounded depth-4 graph now (only `comments`/`brand` reach it). The operator/executor should ratify; recommend depth-1 + a depth-4 deferral test.
3. **Curated fallback scope (b2-iii-key):** reader-derived is the primary source (a single readable object graph EXISTS, unlike `execute`'s cross-file assembly), so the offline path is rare. Options: (a) a tiny curated child-key fallback for the highest-value objects (`code-tools`, `theme`) to honor the reader+curated pairing precedent; (b) empty-degrade offline (sub-keys simply don't complete when the CLI is absent). Recommend a small curated set for `code-tools`/`theme` only, exact-equality-tested (Learning #26); confirm the pairing-precedent expectation.
4. **`super`/`citation` (b2-iii-deep):** special-case the `citation-item → csl-item → csl-item-shared` `resolveRef` chain (10→123 keys) now, or defer all `super` with a documented limitation? Depends on whether citation-object sub-keys are judged high-value. Recommend defer + document.
5. **Per-format filtering at the object level (§7):** confirm firsthand against Quarto's `getFormatSchema` that an option's sub-keys are NOT independently `formats`-tagged (i.e. `formatMatches` gates the OPTION, not its sub-keys). Resolve before coding the reader branch.
6. **Cross-platform / version:** the object-schema shape + the `navigateSchemaByInstancePath`/`getObjectCompletions` algorithm verified on macOS / 1.7.33. Re-confirm on a version bump (add to the marker list).

---

## 10. Per-slice quick reference

| Slice | One-line goal | Key new/changed | New logic | Session(s) |
|---|---|---|---|---|
| b2-iii-key | deep-nested option **keys** (one object level) | `yaml-context.ts` N-level walk · `yaml-schema.ts` `objectChildren` + `SchemaField.children` + `frontMatterKeys` len≥3 branch | detector walk + object-property resolver | 1 |
| b2-iii-value | deep-nested option **values** | `yaml-schema.ts` `valuesOfSchema` +2 cases + tests | 2 small value-form extensions (NOT free) | 1 |
| b2-iii-deep | 🐉 depth-4 + `super`/`resolveRef` merge | recursive `children` (lift the cap) + `super`-via-`{resolveRef}` | the real bounded residue | >1 / defer |

**Recommended stopping point:** after **b2-iii-value** (deep-nested key+value at one object level). b2-iii-deep is optional/v2.x and degrades gracefully. **The operator may also descope b2-iii entirely** — 6d already ships a complete milestone; deep-nested completion is an enhancement, not a gap.

---

*End of Phase 6d-6+ (b2-iii) plan. Implementation is separate sessions, one slice each, strict TDD. The first executor session starts with Slice b2-iii-key. The "recursive schema.yml dragon" the parent plans feared is a category error — `schema.yml` is the DSL meta-grammar; deep-nested completion is a bounded, depth-and-cycle-guarded object-property resolver (a sibling of the existing `valuesOfSchema`) over `document-*` + `definitions.yml`, grounded firsthand against Quarto 1.7.33 and independently re-verified by a 9-agent grounding + adversarial-refutation Workflow (Session 36).*
