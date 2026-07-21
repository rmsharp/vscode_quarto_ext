# Plan — DEPTH-2 VALUE validation for `_quarto.yml` project-config CONTAINERS

*Session 136 (PLANNING). Deliverable = this document only; implementation is a separate
session (FM #18/#19 — NO code shipped this session). Governs: `SESSION_RUNNER.md`
§Planning Sessions + `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`, under the
project-wide strict-TDD gate.*

The value-validation family's **seventh** widening, extending S135's shipped depth-1
`_quarto.yml` project-config slice **one level deeper**: value-validate a wrong CLOSED value
of a `project:`/`website:`/`book:` GRANDCHILD (e.g. `website.navbar.collapse-below: banana`,
`website.sidebar.style: docked-typo`, `project.preview.browser: nope`), matching `quarto
render` 1.7.33's `readAndValidateYamlFromFile` schema layer — the SAME layer S135's depth-1
slice mirrors. Prior slices: cell → S124, top-level `.qmd` → S125, nested `execute:`/`format:`
→ S128, numeric → S130, 15 `.qmd` containers → S132, `_quarto.yml` depth-1 → S135.

---

## §0 — Decision at a glance

- **What ships:** a wrong VALUE of a recognized CLOSED grandchild (two levels under
  `project:`/`website:`/`book:`) in `_quarto.yml` shows an **Error** squiggle matching `quarto
  render` 1.7.33's `_quarto.yml`-schema layer. Flags e.g. `navbar.collapse-below: banana`,
  `sidebar.style: x`, `search.location: y`, `cookie-consent.type: z`, `announcement.position: w`,
  `preview.browser: nope`. Emits nothing for valid values, OPEN grandchildren (`navbar.title`,
  `navbar.background`, `sidebar.foreground` — the depth-2 cardinal-sin traps, §2.3), unknown keys,
  depth-3+, sequence-item grandchildren, flow/quoted continuations, or offline.
- **The surface is the FULL depth-2 super+anyOf-reachable set — 59 grounded (container, child,
  grandchild) positions** (project.preview 3 · website 28 · book 28 via `super base-website`): **55
  closed enum/bool** + **4 numeric** (`search.limit`/`search.collapse-after`, website+book —
  `scalarType:"number"`, §2.2). Of the 55 enum/bool, **`google-analytics.version` (×2, enum[3,4]) is
  deliberately LEFT OPEN — a documented safe FN, NOT flagged** (§2.3/§7.2b): it is the one
  numeric-VALUED enum, and the shared string-membership matcher would flag `version: 3.0`≡`3` (a value
  quarto coerces and ACCEPTS — cardinal-sin FP, grounded firsthand, caught by the §9 review). So **57
  positions are flagged** (53 enum/bool + 4 numeric) across 8 nested containers (`preview`, `navbar`,
  `sidebar`, `search`, `cookie-consent`, `announcement`, `google-analytics`, `twitter-card`). Operator
  picked the full surface over a `project.preview`-only subset (Phase 0 `AskUserQuestion`), after the
  grounding below flipped S134's tier-i/tier-ii cost model.
- **The tier-i/tier-ii split S134 drew DISSOLVES at the reader (the key architectural finding,
  §2.4/§3.2).** S134 deferred depth-2 in two tiers: (i) `project.preview.*` "cheap, super-reachable",
  (ii) `navbar`/`sidebar`/`search` "harder, via `anyOf`". But the **existing** shared
  `resolveObjectProperties` (already `anyOf`-aware, already used by `objectChildren` on the DOCUMENT
  surface) resolves **all 55** grandchildren with **zero mismatches** vs a super+anyOf union
  resolver — no `super` is needed at depth-2 (container-level `super` merged the depth-1 CHILDREN
  already; each child's grandchildren come from its own object/`anyOf`). So the depth-2 reader is a
  **≈2-line reuse** of `objectChildren`, identical cost for tier-i and tier-ii.
- **This slice is LIGHTER than S135 on the reader, HEAVIER on the enumerator.** S135 built a
  super-aware child-FIELD resolver from scratch. This slice adds NO new resolver — it reuses
  `objectChildren` to populate `SchemaField.children`. The genuinely-new work is the **depth-2
  enumerator** (a bounded 2-level forward state machine extending S135's one-level scanner) and its
  scanFlow FP surface — now live at a level with NO column-0 backstop.
- **`valueMessage` is ALREADY in the pure core** (S135 relocated it to `yaml-value-check.ts`) — no
  relocation this time. The matcher (`isWrongValue`), message (`valueMessage`), skeleton
  (`createDebouncedDiagnosticsFeature`), and annotation functions (`annotateClosedness`/
  `annotateScalarType`/`valuesOfSchema`) are all reused UNCHANGED.
- **Cardinal-sin safety established firsthand (§2.1–2.3), with ONE numeric-coercion exception the §9
  review caught.** Every marked-closed grandchild, given an off-list *string* value, makes `quarto
  render` exit 1 at the SCHEMA layer; every OPEN grandchild renders exit 0 (or fails DOWNSTREAM). The
  exception is **`google-analytics.version` (enum[3,4])** — quarto COERCES YAML numerics, so
  `version: 3.0`/`+4`/`04`/`4.0`/`3e0` all render exit 0, yet the shared string-membership matcher
  would flag them (`"3.0" ∉ ["3","4"]`) = a cardinal-sin FP (grounded: real `isWrongValue("3.0",…)`
  ⇒ true; `quarto render version: 3.0` ⇒ exit 0). The reader LEAVES numeric-member enums OPEN so
  `version` is never flagged (§3.2 A / §7.2b — this is a latent property of the shared matcher, also
  present pre-existing on the document surface via `aspectratio`; §6). The remaining live risk is the
  **depth-2 scanFlow FP** (a mapping-looking line inside a multi-line quoted grandchild value — PROVEN
  exit-0 firsthand, §2.3) — the new enumerator MUST stay `scanFlow`-aware. Both are the MANDATORY §9
  review's primary targets.

---

## §1 — Context

### 1.1 Problem

S135 shipped depth-1 value validation for `_quarto.yml`'s `project:`/`website:`/`book:` blocks
(a wrong value of a ONE-level child — `draft-mode: hidden`, `downloads: mobi`). But the richer
config surface is DEEPER: the options that actually carry closed enums under `website:` live TWO
levels down, inside `navbar:`/`sidebar:`/`search:`/`cookie-consent:`/`announcement:` blocks
(`navbar:\n  collapse-below: sm`, `sidebar:\n  style: docked`). A typo there
(`sidebar:\n  style: dock`) fails `quarto render` (exit 1, schema-validation) today with **no editor
squiggle** — S135's one-level enumerator skips it (its `indent !== containerIndent` guard, §1.3),
and its reader carries no per-grandchild annotation. This is the value family's first depth-2 slice
on the project surface, and the natural continuation S135's handoff named as "What's next (1)".

### 1.2 Constraints (standing, binding)

- **Strict TDD** (project-wide gate). Red → Green → Refactor, one behavior at a time.
- **Cardinal-sin rule (absolute).** NEVER flag a value quarto accepts at its schema layer. Only
  grandchildren whose schema is provably closed (`valuesClosed===true`) are checked; every
  string/`string:{completions}`/`anyOf`-with-a-free-arm grandchild → left open → never flagged.
  Inherited UNCHANGED from `isWrongValue`/`annotateClosedness`.
- **Mirror only quarto's `_quarto.yml`-SCHEMA layer** (Learning #142). Do NOT chase downstream
  errors — `navbar.background: banana` fails DOWNSTREAM (theme resolution), NOT
  `readAndValidateYamlFromFile`, so it is out of scope (§2.3, the depth-2 `project.type` analogue).
- **One shared matcher + message, no new matcher/predicate/message.** Reuse `isWrongValue` and
  `valueMessage` verbatim (both already in the pure `yaml-value-check.ts` after S135).
- **≤5 files per checkpoint commit** (blast radius).

### 1.3 Current state — what S135 shipped (build on it, do NOT rebuild)

- **The reader resolves ONE level, no `.children`.** `SchemaIndex.projectFields(container)`
  (`src/core/yaml-schema.ts:509/:626`) returns the container's one-level children as annotated
  `SchemaField[]`, built by `projectFieldsFromProperties` (`:1265`) from the super-merged
  property→schema map (`ClosedKeySet.properties`, threaded through `resolveClosedKeysObject`'s
  super-walk, `:1157`). Each field is annotated via `valuesOfSchema`/`annotateClosedness`/
  `annotateScalarType` — but `projectFieldsFromProperties` does **NOT** populate `field.children`,
  so there is no depth-2 annotation anywhere on this surface today.
- **`SchemaField.children` already exists and is one-level** (`:56-63`) — populated on the DOCUMENT
  surface by `objectChildren` (`:1334`) → `resolveObjectProperties` (`:1035`), annotated per child,
  capped at exactly one object level (`objectChildren` returns `[]` at `depth>0`). This is the exact
  machinery the depth-2 project reader reuses (§3.2 A).
- **`resolveObjectProperties` is `anyOf`-aware but NOT `super`-aware** (`:1035` — handles
  `object`/`anyOf`/`ref`/`maybeArrayOf`/`schema`, first resolving `anyOf` arm wins). Grounded (§2.4):
  at depth-2 this is SUFFICIENT — no grandchild needs `super`.
- **The depth-1 enumerator is one-level and scanFlow-aware.** `findProjectConfigValueLines`
  (`src/core/project-yaml.ts:128`) tracks the container by its column-0 header and emits scalar
  children at exactly `containerIndent` (the first indent level); its `indent !== containerIndent`
  guard (`:168`) SKIPS everything deeper — this is the one-level cap this slice lifts. It ALREADY
  carries the `scanFlow` continuation guard (`:145/:198`) — the depth-2 enumerator keeps it.
- **The matcher + message + skeleton are surface-agnostic, reused UNCHANGED.** `isWrongValue`
  (`yaml-value-check.ts:46`), `valueMessage` (`:144`, already pure + exported after S135),
  `createDebouncedDiagnosticsFeature` (`features/debounced-diagnostics.ts`), and the shipped feature
  `registerYamlProjectValueDiagnosticsFeature` (`features/yaml-project-value-diagnostics.ts:112`,
  collection `quarto-project-value`, code `quarto-invalid-project-value`).

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 / the actual parser)

*All grounded firsthand this session: (a) verbatim ports of `valuesOfSchema`/`closednessOfSchema`/
`resolveClosedKeys*`/`resolveObjectProperties` run over the installed
`editor/tools/yaml/yaml-intelligence-resources.json`, cross-validated so the depth-1 closed set is
BYTE-IDENTICAL to the real compiled `projectFields` (`scratchpad/pf-harness.cjs`, S135); (b)
`quarto render --to html` of real website/book/project probes, ~30 invalid + valid + calibration.*

### 2.1 The parser's closedness annotation is FAITHFUL at depth-2 — with one numeric-coercion caveat

Every one of the 55 closed (container, child, grandchild) positions §2.2 marks closed, given an
off-list STRING value, makes `quarto render` exit 1 at the `_quarto.yml`-schema layer (`ERROR: …
validation failed. Field "X" has value Y, which must instead be one of: …` / `… must instead be true
or false`). No OPEN grandchild is mis-marked (§2.3). **The 4 NUMERIC grandchildren** (§2.2:
`search.limit`/`search.collapse-after`) render exit 1 on a non-number and exit 0 on a number —
validated by `isWrongValue`'s numeric branch (grounded: `search.limit: banana` exit 1 SCHEMA,
`limit: 20` exit 0, and no FP on `20`/`3.0` — the numeric branch handles coercion).

**The one calibration caveat (grounded, §9-caught):** an enum whose MEMBERS are numeric can NOT be
string-matched — quarto coerces `3.0`≡`3`. `google-analytics.version` (enum[3,4]) renders exit 0 on
`3.0`/`+4`/`04`/`4.0`/`3e0` (all numerically ∈{3,4}) and exit 1 only on `5`/`3.5`; but the shared
string-membership `isWrongValue` flags `3.0` (`"3.0" ∉ ["3","4"]`) = a cardinal-sin FP. Firsthand:
real `isWrongValue("3.0", {values:["3","4"],valuesClosed:true})` ⇒ **true**; `quarto render
version: 3.0` ⇒ **exit 0**. The reader neutralizes it by leaving any numeric-member enum OPEN (§3.2 A),
so `version` is a documented safe FN (§2.3). **Grounding lesson (folded into §9): probe YAML-coercible
numeric forms — N.0, +N, 0N, NeM — for ANY numeric-valued enum before marking it closed, not only
off-list garbage.**

### 2.2 The grounded closed-grandchild inventory (depth-2 — the v1 target, 59 closed-schema positions)

| container.child | closed grandchildren (parser kind) |
|---|---|
| `project.preview` | `browser` bool, `navigate` bool, `watch-inputs` bool |
| `website.navbar` | `search` bool, `pinned` bool, `collapse` bool, `tools-collapse` bool, `collapse-below` enum[sm,md,lg,xl,xxl], `toggle-position` enum[left,right] |
| `website.sidebar` | `search` bool, `pinned` bool, `border` bool, `style` enum[docked,floating], `alignment` enum[left,right,center] |
| `website.search` | `copy-button` bool, `merge-navbar-crumbs` bool, `location` enum[navbar,sidebar], `type` enum[overlay,textbox], `show-item-context` enum[tree,parent,root]+bool, **`limit` NUMBER**, **`collapse-after` NUMBER** |
| `website.cookie-consent` | `type` enum[implied,express], `style` enum[simple,headline,interstitial,standalone], `palette` enum[light,dark] |
| `website.announcement` | `dismissable` bool, `position` enum[above-navbar,below-navbar], `type` enum[primary,secondary,success,danger,warning,info,light,dark] |
| `website.google-analytics` | `anonymize-ip` bool, `storage` enum[cookies,none], **`version` enum[3,4] — LEFT OPEN (numeric-member enum, §2.3/§3.2 A), NOT flagged** |
| `website.twitter-card` | `card-style` enum[summary,summary_large_image] |
| `book.*` | **the SAME 28 website grandchildren** (via `super base-website`) — grounded `book.sidebar.style: banana` → exit 1 SCHEMA, `book.search.limit: banana` → exit 1 SCHEMA |

**Counts:** 55 closed enum/bool + 4 numeric = **59 closed-schema positions** (project.preview 3;
website 28 = 26 enum/bool + 2 numeric; book 28 via super). Of the 55 enum/bool, `google-analytics.
version` (×2) is left OPEN (numeric-member coercion, §2.3) ⇒ **57 flagged** (53 enum/bool + 4 numeric),
2 safe-FN. All grounded firsthand (§9 harnesses + `quarto render`).

**Ruled OUT (empirical scope corrections — the executor must NOT re-add / must NOT flag):**

- **Depth-2 OPEN-with-values traps (the `project.type` analogue — §2.3).** `navbar`/`sidebar`
  `title` (anyOf bool-or-string), `background`/`foreground` (`string:{completions}` theme colors),
  `page-footer.border`, `comments.hypothesis` (anyOf bool-or-object). The reader's `annotateClosedness`
  leaves ALL of these OPEN (no `valuesClosed`) → never flagged. Grounded: `navbar.background: "#abc"`
  and `navbar.title: "My Site"` render exit 0; `navbar.background: banana` fails exit-1 but
  **DOWNSTREAM** (kind≠SCHEMA — theme resolution), exactly the `project.type` pattern.
- **Depth-3+ grandchildren** (`navbar.tools.*`, `sidebar.contents.*`) — the reader caps at one child
  level (`SchemaField.children` is one-level; `objectChildren` returns `[]` at `depth>0`) AND the
  enumerator caps at depth-2 (§3.2 B). A safe FN, deferred (§4.3).
- **Sequence-form `navbar`/`sidebar`** (`sidebar:\n  - id: main\n    style: x`) — grandchildren under
  a `- ` item are skipped by the enumerator (a `- `-prefixed line hosts no depth-2 mapping value). A
  safe FN (grounded: `book.sidebar` as a sequence with `style: banana` renders exit 1, but our tool
  correctly does not flag it — a MISS, never an FP).

### 2.3 Safe false negatives (documented, deferred — NOT flagged, by design)

- **The depth-2 scanFlow continuation class (the load-bearing risk, §7.3).** A mapping-looking line
  inside a multi-line QUOTED grandchild value is folded into the value by quarto. Firsthand:
  `website:\n  navbar:\n    title: "a very long navbar title that wraps\n    collapse-below:
  not-a-real-value"` renders **exit 0** — the `collapse-below:` is part of the quoted `title` string.
  A naive line-scanner flags it (cardinal-sin FP). The enumerator's `scanFlow` guard turns this into
  a correct non-flag; over-skipping when ambiguous is the safe (FN) direction. **This surface has NO
  column-0 backstop** (a depth-2 continuation can sit at any indent), so the guard is strictly more
  load-bearing than at depth-1.
- **`anyOf[boolean, object]` grandchildren** (`comments.hypothesis`): the object arm is a free/open
  arm → `annotateClosedness` marks the grandchild OPEN → a bare `hypothesis: banana` (which quarto
  schema-REJECTS, exit 1) is NOT flagged — a safe FN, IDENTICAL to the document surface's treatment
  of `echo`-style bool-or-object options. Documented, not an FP.
- **Numeric-member enums** (`google-analytics.version` enum[3,4], the ONLY one in the surface) — LEFT
  OPEN by the reader (§3.2 A) because quarto coerces YAML numerics and the shared string matcher can
  not safely membership-test them (§2.1 caveat). `version: 3.0` and `version: 7` are BOTH unflagged (a
  safe FN — we lose validation on one rare field rather than risk a coercion FP). A `version: 3.0`
  row in the valid fixture is a standing must-NOT-flag guard.
- **`anyOf` children with MULTIPLE object arms** (`open-graph`): `resolveObjectProperties` returns the
  FIRST resolving object arm only, so `open-graph`'s reader `.children` = `[locale, site-name]` (grounded)
  and `image-height`/`image-width` (a later arm) are absent → a wrong `open-graph.image-height: banana`
  (which quarto schema-REJECTS, exit 1) is NOT flagged — a safe FN (under-flagging, never an FP),
  distinct from the `comments.hypothesis` anyOf[bool,object] case. Impl session: expect
  `open-graph`'s `.children` to be `[locale, site-name]`.
- **OPEN string / `string:{completions}` grandchildren** (§2.2 ruled-OUT) — never flagged.
- **Flow-sequence / block-scalar grandchild values** — the matcher's leading-`[`/`{`/`|`/`>` guard
  skips them → safe FN (unchanged from every prior slice).
- **Curated-fallback / offline path** — `projectFields` returns `[]` offline → depth-2 value
  validation silently no-ops (same offline deferral every value slice notes).

### 2.4 The reader crux — `resolveObjectProperties` resolves ALL 55 (no `super` at depth-2)

Grounded (`scratchpad/rop-compare.cjs`): for every depth-1 child, the CLOSED grandchildren resolved
by the EXISTING `resolveObjectProperties` (anyOf-aware, no super) EQUAL those resolved by a
super+anyOf union resolver — **0 mismatches across all 8 nested containers** (project.preview 3;
website navbar 6, sidebar 5, search 5, cookie-consent 3, announcement 3, google-analytics 3,
twitter-card 1; book the same 26). Container-level `super` (website→book) merged the depth-1
CHILDREN already, so each child's schema is present in the super-merged depth-1 property map; its
grandchildren then come from its own `object`/`anyOf`, which `resolveObjectProperties` handles. **This
is why the depth-2 reader needs NO new resolver — `objectChildren` (which calls
`resolveObjectProperties`) is exactly sufficient**, and the tier-i/tier-ii distinction S134 drew
(based on the depth-1 super-walk's lack of `anyOf`) does not exist at depth-2.

---

## §3 — Decision (architecture)

### 3.1 Feature shape — one capability deeper, same shared tail

The family invariant holds (position ⊥ data): an enumerator emits `{container, path, key, rawToken,
valueRange}`; a reader decides what `container`+`path`+`key` resolves to; the shared `isWrongValue`
decides if the value is wrong; the shared `valueMessage` phrases it. This slice deepens the enumerator
to two levels and deepens the reader to populate `.children`, then feeds the SAME matcher + message.
No new matcher, predicate, or message. Same collection/code as S135 (`quarto-project-value`).

### 3.2 The three changes

**(A) Reader — populate `.children` on project fields (`src/core/yaml-schema.ts`).**
Extend `projectFieldsFromProperties` (`:1265`) to also set `field.children` per depth-1 field, by
calling the EXISTING `objectChildren(schema, definitions, 0, new Set())` — the same function the
DOCUMENT surface uses. `objectChildren` resolves one object level via `resolveObjectProperties`
(anyOf-aware, §2.4), annotates each grandchild (`valuesOfSchema`/`annotateClosedness`/
`annotateScalarType`), and caps at one level (`depth>0` → `[]`). ≈2 lines:

```ts
const children = objectChildren(schema, definitions, 0, new Set());
if (children.length > 0) field.children = children;
```

A scalar/enum depth-1 field (`draft-mode`) resolves to no properties → `[]` → no `.children` (cheap).
`objectChildren` already runs `annotateScalarType`, so a NUMERIC grandchild (`search.limit`,
`search.collapse-after`) is annotated `scalarType:"number"` and validated by `isWrongValue`'s numeric
branch for free — no extra work. `projectFields(container)` now returns depth-1 fields EACH carrying
its annotated depth-2 grandchildren. `projectKeys` is untouched; the depth-1 annotation is unchanged
(S135 tests unregressed).

**REQUIRED reader guard — leave numeric-member enums OPEN (the §2.1 cardinal-sin caveat).** After the
`.children` are annotated, unset `valuesClosed` on any grandchild whose closed `values` include a
numeric literal (`/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/`), because the shared string-membership
`isWrongValue` would FP on a numeric coercion quarto accepts (`version: 3.0`≡`3`, grounded §2.1).
`google-analytics.version` (enum[3,4]) is the ONLY such position → it becomes a safe FN. Scope this
guard to the **depth-2 project reader** (a small post-annotation filter in `projectFieldsFromProperties`,
or an equivalent check where the grandchild is built) — do **NOT** change the shared
`annotateClosedness`/`isWrongValue` (that would touch the document/cell surfaces; the SAME latent FP
exists there via `aspectratio`, filed as the deferred general fix, §4.3). A `version: 3.0` valid-fixture
row (§4.1 L3) is the standing regression guard; the RED test asserts the guard leaves `version` open.

*Rationale for reusing `objectChildren` rather than a project-scoped depth-2 resolver:* it is the exact
shipped, tested machinery the document surface's `frontMatterKeys` length-1 branch relies on, is
already `anyOf`-aware (§2.4 proves it resolves all 55), and enforces the one-level cap for free.
Grounded 0-mismatch, so there is no super-walk to re-implement (§6).

**(B) Enumerator — a depth-2 path-aware value-line scanner (`src/core/project-yaml.ts`).**
Generalize `findProjectConfigValueLines` to a **bounded 2-level forward state machine** emitting
`{container, path, key, valueRange, rawToken}` (ADD `path: string[]` to `ProjectConfigValueLine`):
`path=[]` for a depth-1 child (BYTE-IDENTICAL to S135), `path=[childKey]` for a depth-2 grandchild
under a pure block-opener child. State: `containerIndent` (depth-1 level) plus, when a depth-1 line is
a pure block-opener (`mappingContainerKey`/no scalar value), `childKey` + `childIndent` (depth-2
level). A depth-1 sibling resets `childKey`/`childIndent`; a column-0 line resets all. Emit a depth-2
line only when `indent === childIndent` and the line is a scalar mapping (not `-`-prefixed, has a
non-empty value slot). The `scanFlow` continuation guard is UNCHANGED (skips continuation lines at any
level). Depth-3+ (`indent > childIndent`) and sequence-item grandchildren are NOT emitted (safe FN,
matching the reader's depth-2 cap). `findProjectConfigKeyLines` stays UNCHANGED.

**(C) Compute — path-aware resolution (`src/features/yaml-project-value-diagnostics.ts`).**
Resolve each entry BY PATH: `path.length === 0` → `projectFields(container).find(name===key)`
(unchanged); `path.length === 1` → `projectFields(container).find(name===path[0])?.children?.
find(name===key)`; `path.length >= 2` → skip (defensive; the enumerator won't emit these). Feed the
resolved field to the SAME `isWrongValue` + `valueMessage`. Resolution MUST be by PATH, never bare
name — grandchild names collide with depth-1 names (`navbar.search` bool vs `website.search` object;
`sidebar.search` bool) and only the path disambiguates (§7.6, §11 dragon 3).

### 3.3 Data flow (deeper source + reader, shared tail)

```
_quarto.yml text
  → findProjectConfigValueLines            (GENERALIZED; scanFlow-aware; emits path=[] AND path=[child])
  → compute: resolve by path —
       path=[]     → projectFields(c).find(key)
       path=[child]→ projectFields(c).find(child)?.children?.find(key)   (NEW reader: .children via objectChildren)
     → isWrongValue                         (UNCHANGED matcher)
     → valueMessage                         (UNCHANGED, already pure since S135)
  → Error squiggle at valueRange            (SAME filename-gated feature; SAME collection/code)
```

---

## §4 — Scope: the vertical slice (ONE implementation session)

### 4.1 The layer set (gate-(a) contract — build in this order, checkpoint-commit each)

- **L1 (core reader) — `.children` via `objectChildren`.** INERT (no depth-2 enumerator/compute reads
  `.children` yet), independently unit-testable.
  DONE: `projectFields("project").find("preview").children` = `browser`/`navigate`/`watch-inputs`
  (closed bool); `projectFields("website").find("navbar").children` includes `collapse-below`
  (closed enum), `pinned` (closed bool), AND `title`/`background` WITHOUT `valuesClosed` (open traps);
  `projectFields("website").find("search").children` includes `limit`/`collapse-after` with
  `scalarType:"number"` (numeric grandchildren) AND `location` (closed enum);
  `projectFields("website").find("google-analytics").children.find("version")` has NO `valuesClosed`
  (the numeric-member-enum guard left it OPEN — the RED test asserts this before the guard exists);
  `projectFields("book").find("sidebar").children` includes `style` (closed, via super-merged
  `sidebar`); a scalar field (`draft-mode`) has no `.children`. `projectKeys` + the depth-1 field
  annotation unchanged (regression rows).
  Verify: new unit rows in `test/unit/yaml-schema-index.test.ts` (RED first — `.children` absent);
  `npm run test:unit`; `npm run check-types`.

- **L2 (core enumerator + inert compute guard) — depth-2 path-aware.** INERT via the guard.
  Generalize `findProjectConfigValueLines` to emit `path`, AND add a one-line compute guard
  `if (entry.path.length !== 0) continue;` so the new depth-2 emissions are explicitly skipped (the
  feature stays depth-1-only until L3 — guarantees inertness even where a grandchild name collides
  with a closed depth-1 field).
  DONE (enumerator): depth-2 grandchild lines emit `{path:[child]}` with exact value spans; the
  quoted-continuation FP (§2.3) is scanFlow-SKIPPED (RED first: without the child-level scanFlow
  continuation guard the embedded `collapse-below:` line is enumerated); depth-3 / sequence-item /
  dedent lines are NOT emitted; depth-1 emissions are byte-identical to S135 with `path:[]` added.
  Verify: new unit rows in `test/unit/project-yaml.test.ts` (RED first) + the S135 depth-1 rows
  updated to assert `path:[]`; `npm run test:unit`; `check-types`.

- **L3 (feature wiring + integration) — GO-LIVE.** Replace L2's `path.length !== 0 → continue` guard
  with real path-aware resolution (§3.2 C). Add two `_quarto.yml` fixtures + an integration `describe`.
  Diagnostics go live for depth-2 HERE. (No `valueMessage` relocation — already pure since S135.)
  Fixtures under `test/fixtures/yaml-project-depth2-value/` (each a dir with a `_quarto.yml`):
  `invalid/_quarto.yml` (FLAG cases across containers — `website.navbar.collapse-below: banana`,
  `website.sidebar.style: dock`, `website.search.location: x`, `website.search.limit: banana`
  (NUMERIC), `website.cookie-consent.type: y`, `project.preview.browser: nope`, `book.sidebar.alignment:
  z`) and `valid/_quarto.yml` (the FP battery — valid closed grandchildren (`collapse-below: lg`,
  `search.limit: 20`) + OPEN traps `navbar.title`/`navbar.background`/`comments.hypothesis` +
  **`google-analytics.version: 3.0`** (numeric-member-enum coercion — MUST NOT flag) +
  **`book.cookie-consent.type: express`** (the closed depth-1 `book.type` CSL-enum collision — MUST NOT
  flag; a by-path-resolution guard, §7.5) + a multi-line quoted `navbar.title:` with an embedded
  `collapse-below:`-looking line + a valid `sidebar:`-as-sequence + a flow-seq + a `navbar: true` scalar
  (anyOf boolean arm) + `project.type: whatever` — all exit 0, zero diagnostics).
  DONE: both fixtures render firsthand per §2.1 (invalid exit 1 SCHEMA, valid exit 0); the integration
  `describe` (modeled on `test/integration/suite/yaml-project-value-diagnostics.test.ts`) asserts an
  Error at each flag's exact value span and ZERO on the valid fixture; the depth-1 surface + document
  value diagnostics unregressed (filter by `code`).
  Verify: `npm run test:integration`; `npm run test:unit`; `check-types`; both fixtures render firsthand.

- **L4 (MANDATORY §9 adversarial review + TDD fixes).** See §9. Non-negotiable; the depth-2 scanFlow
  FP surface (§2.3, NO column-0 backstop) is the primary target.
  DONE: L4 == §9's outcome — a fresh multi-lens `quarto render`-verified `Workflow` AND the author's
  firsthand sweep return CLEAN (or every finding fixed TDD + re-verified), full matrix green, both
  fixtures re-rendered post-fix.
  Verify: the §9 checklist; `check-types` + `test:unit` + `test:integration` green.

### 4.2 This is a vertical slice, NOT horizontal (pre-empting an FM #25 misread)

L1 (reader) and L2 (enumerator+guard) are BOTH inert until L3 flips the compute. This is ONE capability
(depth-2 project-config value validation) with a pre-declared layer set, each layer independently
unit-tested and checkpoint-committed. "If I stop here, does something work?": after L1 the reader
resolves depth-2 fields (unit-tested); after L2 the enumerator emits depth-2 lines (unit-tested,
inert via guard); after L3 the feature is live end-to-end. Two inert core layers before go-live is the
shape the surface requires (a deeper reader AND a deeper enumerator must both exist before a depth-2
value can be flagged), not horizontal slicing.

### 4.3 Deferred to a later session (filed to `BACKLOG.md`, NOT built here)

- **Depth-3+ project-config values** (`navbar.tools.*`, `sidebar.contents.*`) — needs a reader past
  the `SchemaField.children` one-level cap AND an enumerator past the 2-level cap. Grounded a safe FN
  today (§2.2). Note: much of depth-3 is sequences of items (navbar tools/links), not closed scalars.
- **Sequence-form `navbar`/`sidebar` grandchildren** — value-validate `style:`/etc. inside a
  `sidebar:\n  - id: … \n    style: x` list item. Needs sequence-item descent in the enumerator.
- **Broader `_quarto.yml` document-key values** (`execute:` near-term, `format:` nested) — the
  cross-surface item S135 deferred; a DIFFERENT surface (document reader), unchanged by this slice.
- **The KEY enumerator's scanFlow gap** — `findProjectConfigKeyLines` is not scanFlow-aware
  (pre-existing, adjacent to `BACKLOG:158`). Note only.
- **General numeric-member-enum matcher fix (cross-surface, PRE-EXISTING).** The shared
  string-membership `isWrongValue` can not safely validate a closed enum whose members are numeric
  (quarto coerces `3.0`≡`3`). This slice neutralizes it LOCALLY (leave `version` open, §3.2 A), but the
  same latent FP exists on the DOCUMENT surface via `aspectratio` (enum[43,169,…] — grounded present,
  `scratchpad/numenum.cjs`). A detection-preserving general fix — teach `isWrongValue` that a
  numeric-member enum accepts a `NUMBER_LITERAL` token whose parsed value equals a member (still flags
  `version: 5`/`banana`, no FP on `3.0`) — would restore validation on `version`/`aspectratio` across
  all surfaces. Filed separately (touches the shared matcher + a document-surface regression pass).
- **Fallback subsetting:** if L4 finds a per-grandchild FP that cannot be cleanly fixed, the reader is
  general (annotation per grandchild), so the offending grandchild is simply left open — no code change
  needed, it just stops being flagged. The slice stays recoverable.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped this session, POST-S135)

| Symbol / site | File:line | Change |
|---|---|---|
| `SchemaField.children` | `src/core/yaml-schema.ts:56-63` | REUSE (the one-level child slot, already defined) |
| `projectFieldsFromProperties` | `src/core/yaml-schema.ts:1265-1281` | EXTEND — set `field.children` via `objectChildren`; + the numeric-member-enum-OPEN guard (§3.2 A, unset `valuesClosed` on a numeric-member grandchild enum) |
| `objectChildren` | `src/core/yaml-schema.ts:1334` | REUSE (call at depth 0; anyOf-aware via `resolveObjectProperties`) |
| `resolveObjectProperties` | `src/core/yaml-schema.ts:1035` | REUSE UNCHANGED (resolves all 55 grandchildren, §2.4) |
| `annotateClosedness`/`annotateScalarType`/`valuesOfSchema` | `:905`/`:1003`/`:762` | REUSE (annotate each grandchild — inside `objectChildren`) |
| `projectFields` impl / `buildProjectConfigFields` | `:626` / `:1245` | UNCHANGED (they call `projectFieldsFromProperties`) |
| `projectKeys` | `:496/:619` | UNCHANGED |
| `ProjectConfigValueLine` | `src/core/project-yaml.ts:101-110` | ADD `path: string[]` |
| `findProjectConfigValueLines` | `src/core/project-yaml.ts:128` | GENERALIZE — bounded 2-level state machine; emit `path`; keep scanFlow |
| `findProjectConfigKeyLines` | `src/core/project-yaml.ts:59` | UNCHANGED |
| `mappingContainerKey`/`leadingWsLen`/`valueSlotAfterColon` | `src/core/yaml-context.ts:294`/`:315`/`:442` | REUSE |
| `scanFlow` | `src/core/qmd/model.ts` (imported in `project-yaml.ts:14`) | REUSE UNCHANGED |
| `isWrongValue` / `valueMessage` | `src/core/yaml-value-check.ts:46` / `:144` | UNCHANGED (both already pure since S135) |
| `computeProjectValueDiagnostics` | `src/features/yaml-project-value-diagnostics.ts:66` | EXTEND — resolve by `entry.path` (L2 inert guard → L3 real resolution) |
| `registerYamlProjectValueDiagnosticsFeature` / collection / code | `:112` / `quarto-project-value` / `quarto-invalid-project-value` | UNCHANGED (same feature, same collection) |
| `extension.ts` registration | `src/extension.ts:42/:84` | UNCHANGED (feature already registered) |
| Tests | `test/unit/yaml-schema-index.test.ts` (+`.children` rows incl. numeric + version-open guard), `test/unit/project-yaml.test.ts` (+depth-2 rows; S135 rows +`path:[]`), `test/integration/suite/yaml-project-value-diagnostics.test.ts` (+depth-2 `describe`), `test/fixtures/yaml-project-depth2-value/{invalid,valid}/_quarto.yml` (NEW) | ADD |
| Close-out docs OWED (Phase 3, at GO-LIVE) | `docs/POSIT-COMPARISON.md:320` ("one level under" → depth-2), `:472-473`, `:479` + `:817` (drop "depth-2+ under navbar/sidebar/search" from the remaining-gap list); `BACKLOG.md:28` BL-47 deferred sub-bullet (a) → SHIPPED/annotated (its "needs anyOf + a deeper enumerator" is corrected — anyOf came free via `objectChildren`); `PROJECT_LEARNINGS.md` + `CHANGELOG.md` (protocol-covered) | RECONCILE |

Grounding scratch (this session, uncommitted — `scratchpad/` is NOT gitignored, do NOT `git add`):
`scratchpad/depth2-explore.cjs` (super-aware depth-2 closed inventory), `scratchpad/anyof-probe.cjs`
(tier-ii sizing), `scratchpad/rop-compare.cjs` (the 0-mismatch reader crux), `scratchpad/d2trap.cjs`
(depth-2 open-with-values traps), `scratchpad/verify-iwv.cjs` (**REAL `isWrongValue` on the version-enum
+ numeric fields — the §9 FP proof**), `scratchpad/numenum.cjs` (the pre-existing `aspectratio`
numeric-enum on the document surface), `scratchpad/og.cjs` (open-graph partial-arm), `scratchpad/d2render/`,
`d2fp/`, `d2trap-render/`, `verify-render/` (the `quarto render` probes). Reuses S135's
`scratchpad/pf-harness.cjs` (real-compiled cross-validation) and `scratchpad/flag-harness.cjs`
(full-path A/B — extend for depth-2 in the impl session).

---

## §6 — Alternatives considered (honest)

- **Build a project-scoped depth-2 resolver (mirror S135's super-walk one level deeper).** Tempting by
  analogy to S135. Rejected: grounded 0-mismatch (§2.4) proves `super` is NOT needed at depth-2, so a
  new super-aware resolver would be dead weight; `objectChildren` (shipped, anyOf-aware, tested)
  resolves everything. Reuse beats rebuild.
- **Extend the shared `resolveObjectProperties` to handle `super`.** Rejected (same reasoning S134 §6
  gave): it would change `objectChildren` on the DOCUMENT surface, and it is unnecessary — depth-2
  needs no super.
- **A general N-level ancestor-walk enumerator (mirror `findNestedFrontMatterValueLines` /
  `nestedParentPath`).** Cleaner reuse of the tested nested-doc walk, BUT `nestedParentPath` is
  hardcoded `format`-rooted (`yaml-context.ts:277`), so reuse would require exporting the private
  `nearestShallowerLine` + a new project-rooted path function, and it emits arbitrary depth the reader
  (capped at depth-2) cannot use. Rejected for v1 in favor of the bounded 2-level state machine (§3.2 B)
  — a minimal extension of the SHIPPED, reviewed S135 enumerator that keeps depth-1 byte-identical and
  matches the reader cap exactly. (If depth-3 is ever pursued, the general walk is the right refactor —
  noted in §4.3.)
- **Hand-curate the 55 closed grandchildren.** Rejected as PRIMARY (drifts across quarto versions;
  the schema IS resolvable, §2.4). Kept as the documented fallback-subset escape (§4.3).
- **Fold depth-2 into a new separate feature.** Rejected: it is the SAME capability on the SAME surface
  as S135's depth-1 — one enumerator, one compute, one collection is cleaner than two features
  double-scanning the same `_quarto.yml`.
- **Flag the OPEN-with-values traps** (`navbar.background`, `navbar.title`). Rejected as cardinal-sin
  violations: the schema layer ACCEPTS any string there (§2.3, grounded exit-0 / downstream-fail).

---

## §7 — Failure-mode analysis (the safety story)

1. **Cardinal-sin FP on a closed grandchild.** Guarded by `isWrongValue`'s `valuesClosed` precondition
   + §2.1's firsthand proof that all 55 marked-closed grandchildren are genuinely schema-rejected.
2. **FP on an OPEN grandchild trap** (`navbar.title`/`background`/`foreground`, `comments.hypothesis`).
   Guarded — `annotateClosedness` leaves anyOf-with-free-arm / `string:{completions}` OPEN; §2.3 grounds
   exit-0 (or downstream-fail). The valid fixture makes these standing regression guards.
3. **Latent depth-2 ENUMERATOR scanFlow FP (the load-bearing risk, Learning #143).** PROVEN firsthand
   (§2.3): a mapping-looking line inside a multi-line quoted grandchild value renders exit 0; a naive
   scanner flags it. THIS surface has NO column-0 backstop (a depth-2 continuation can sit at any
   indent), so the `scanFlow` guard is strictly more load-bearing than at depth-1. THE primary §9 target.
4. **Depth-cap breach** (a depth-3 grandchild flagged). Guarded twice: the reader caps `.children` at
   one level (`objectChildren` `depth>0` → `[]`) AND the enumerator caps at `path.length===1`. Either
   alone makes depth-3 a safe FN. A unit test asserts a depth-3 line is not emitted / not resolved.
5. **Name collision across levels — a CARDINAL-SIN FP if resolved by bare name.** Grandchild names
   collide with depth-1 names, and at least one collision is with a CLOSED depth-1 field:
   `book.type` is the closed 45-value CSL enum, while `book.cookie-consent.type: express` is a VALID
   grandchild (grounded: `book: {type: express}` exit 1 SCHEMA — `express ∉ CSL`; `book:
   {cookie-consent: {type: express}}` exit 0). Bare-name resolution would look up the depth-1
   `book.type` CSL enum, find `express ∉ it`, and FLAG a value quarto accepts = cardinal-sin FP. (Also
   `navbar.search` bool vs `website.search` object — an FN, safe.) Resolution is BY PATH
   (`projectFields(c).find(child).children.find(key)`), never bare name (§3.2 C / dragon 3). A
   `book.cookie-consent.type: express` valid-fixture row + the L2 `path.length!==0` guard (dragon 10)
   are the standing guards.
6. **`anyOf[boolean, object]` grandchild** (`comments.hypothesis`): left OPEN → a bare bad scalar is a
   safe FN (matches the document surface). Not an FP.
7. **`projectKeys` / depth-1 regression.** Adding `.children` must not change the depth-1 name set or
   the depth-1 field annotation. Regression rows assert both unchanged.
8. **Book super-merge at depth-2.** Book's grandchildren come from website's nested objects via the
   CONTAINER-level `super` (already in the depth-1 property map); depth-2 resolution needs no super
   (§2.4). A `book.sidebar.style` unit + render row guards the super-merged path.
9. **Numeric-member-enum coercion FP (the §9-caught cardinal sin).** `google-analytics.version`
   (enum[3,4]) is closed, but quarto coerces YAML numerics, so `version: 3.0`≡`3` renders exit 0 while
   the string-membership matcher flags it (grounded firsthand, §2.1). Guarded by the §3.2 A reader
   filter (leave numeric-member enums OPEN → `version` a safe FN). A `version: 3.0` valid-fixture row
   + a RED unit asserting the guard leaves `version` open are the standing guards. (The same latent
   matcher property affects `aspectratio` on the document surface — the deferred general fix, §4.3.)
   Grounding lesson: probe YAML-coercible numeric forms for ANY numeric-valued enum, not off-list
   garbage alone.

---

## §8 — Impact analysis

- **Users:** wrong values TWO levels under `_quarto.yml`'s `project:`/`website:`/`book:` blocks get an
  Error squiggle before render — the richer, more typo-prone surface (navbar/sidebar/search options) on
  the operator's dominant multi-file/book workflow. 57 flagged (of 59 closed-schema) positions, the
  family's largest project-surface jump. No behavior change for valid documents or the depth-1 surface.
- **Code:** ≈2 reader lines (reuse `objectChildren`), one generalized enumerator (the real new work),
  a path-aware compute, +`path` on one interface. NO new resolver, matcher, message, feature,
  collection, or `extension.ts` change. The shipped depth-1 surface, the KEY feature, and all
  document-surface value code are untouched.
- **Risk:** MEDIUM. The reader is near-free and grounded 0-mismatch; the enumerator is the genuine risk
  (a new 2-level state machine + a scanFlow FP surface with no column-0 backstop). Mitigated by
  firsthand grounding, the `scanFlow` reuse, the unchanged matcher precondition, the depth-2 cap
  (double-guarded), and the fallback-subset escape (§4.3).

---

## §9 — Verification plan (executor)

- **Per-layer:** the build/test matrix (`check-types`, `test:unit`, `test:integration`) at EACH
  checkpoint boundary; firsthand `quarto render` of both fixtures at L3.
- **Runtime smoke test (Phase 3E).** L3 flips existing-feature behavior (depth-2 now flagged) — NOT a
  new registration, so the runtime surface is the same feature S135 wired. Still: F5 the Extension
  Development Host, open a `_quarto.yml` with `website:\n  navbar:\n    collapse-below: banana`, confirm
  the Error squiggle appears (and disappears when corrected to `lg`). Isolate with `--disable-extensions`
  (Posit's `quarto.quarto` co-diagnoses — Learning #19). "Build clean" is necessary but not sufficient
  (FM #24).
- **MANDATORY §9 adversarial review (L4), non-negotiable.** A fresh multi-lens `quarto render`-verified
  `Workflow` AND the author's own firsthand sweep, INDEPENDENTLY, over: **(fp-hunt, PRIMARY)** the
  depth-2 enumerator's real bare-`_quarto.yml` shapes for a scanFlow continuation misread — multi-line
  quoted grandchild values, unclosed flow collections, anchors/tags, block scalars, dedents — at a level
  with NO column-0 backstop (Learning #143, PROVEN live §2.3); **(closedness + numeric-coercion)**
  re-confirm all 55 marked-closed grandchildren reject off-list values, no OPEN trap
  (`navbar.background`/`title`, `comments.hypothesis`) is flagged, AND — for every numeric-VALUED enum
  and numeric grandchild — probe YAML-coercible numeric forms (`N.0`/`+N`/`0N`/`NeM`): confirm
  `google-analytics.version` is left OPEN (the §2.1 coercion FP the review caught) and the numeric
  grandchildren (`search.limit`/`collapse-after`) accept `20`/`3.0` but reject `banana`;
  **(anyOf-resolution)** re-confirm `resolveObjectProperties`
  resolves each nested container's grandchildren with correct closedness (the §2.4 0-mismatch);
  **(depth-cap / name-collision)** depth-3 and cross-level name collisions resolve safely; **(lifecycle/
  doc-drift)** the standard lenses. Every finding re-verified firsthand (render exit code + a matcher
  harness) before fixing, TDD. Confirm CLEAN verdicts rather than trusting them.
- **Grounding to reproduce:** `node scratchpad/depth2-explore.cjs` + `rop-compare.cjs` (the closed
  inventory + the reader crux) then `quarto render --to html` an invalid + valid probe per nested
  container (`scratchpad/d2render/`, `d2fp/`, `d2trap-render/`).

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

- **Q1 — reader via `objectChildren` vs a project depth-2 resolver?** Recommendation: `objectChildren`
  (§3.2 A / §2.4 0-mismatch). The load-bearing risk is the ENUMERATOR, not the reader.
- **Q2 — bounded 2-level state machine vs general ancestor walk (§6)?** Recommendation: bounded
  (minimal S135 extension, depth-1 byte-identical, matches the reader cap). General walk is the depth-3
  refactor.
- **Q3 — include the OPEN-with-values traps in the reader at all?** They are resolved as `.children`
  but left OPEN (no `valuesClosed`) so never flagged — include them (free; the valid fixture guards
  they are not flagged). Do NOT special-case-exclude them (annotation is the guard).
- **Q4 — depth-2 `path` field shape** (`path: string[]` vs `parentChild: string`)? Recommendation:
  `path: string[]` (mirrors `NestedFrontMatterValueLine.parentPath`; forward-compatible with depth-3).

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. **The reader is `objectChildren` REUSE (≈2 lines) + the numeric-member-enum guard (dragon 11) — do
   NOT rebuild a resolver.** `resolveObjectProperties` (via `objectChildren`) resolves ALL 59 closed-schema
   grandchildren (§2.4, grounded 0-mismatch). No `super` at depth-2. Do NOT re-implement S135's
   super-walk one level deeper.
2. **The enumerator MUST stay `scanFlow`-aware at depth-2 — the FP surface has NO column-0 backstop.**
   The multi-line-quoted-continuation FP is PROVEN live (§2.3). Keep S135's `scanFlow` continuation
   guard; a depth-2 continuation can sit at any indent, so the guard (not a column-0 reset) is the only
   protection. THE primary §9 risk.
3. **Resolve BY PATH, never bare name — this is CARDINAL-SIN safety, not just FN-avoidance.** Grandchild
   names collide with depth-1 names, and one collision is with a CLOSED depth-1 enum: `book.type` is
   the 45-value CSL enum, while `book.cookie-consent.type: express` is VALID (grounded). Resolving by
   bare `key` would hit `book.type`, find `express ∉ CSL`, and FLAG a value quarto accepts = cardinal-sin
   FP (not merely a miss). The compute MUST resolve `projectFields(c).find(path[0]).children.find(key)`.
   Put `book.cookie-consent.type: express` in the valid fixture as the standing collision guard.
4. **The depth-2 OPEN-with-values traps are the cardinal-sin trap** (the `project.type` analogue):
   `navbar`/`sidebar` `title` (anyOf bool-or-string), `background`/`foreground` (`string:{completions}`
   — `banana` fails DOWNSTREAM, not schema), `page-footer.border`, `comments.hypothesis` (anyOf
   bool-or-object). NEVER flag them. Put `navbar.background: banana` + `navbar.title: "x"` in the valid
   fixture as standing must-not-flag guards. `annotateClosedness` already leaves them open — do not
   curate them closed.
5. **`navbar`/`sidebar` are `anyOf[boolean, object]`.** `navbar: true` is a valid depth-1 SCALAR (navbar
   itself OPEN → not flagged); `navbar:\n  …` is a block (grandchildren validated). Both handled: the
   enumerator emits `navbar: true` as a depth-1 line (open → not flagged) and grandchildren as depth-2.
6. **Sequence-form `navbar`/`sidebar`** (`sidebar:\n  - id: …\n    style: x`) — a `- `-prefixed line
   hosts no depth-2 mapping value; grandchildren under it are a safe FN (grounded exit-1 quarto but not
   flagged). Put a VALID sidebar-as-sequence in the valid fixture to confirm no FP on the sequence shape.
7. **Depth-3 is double-capped** (reader `objectChildren` one-level + enumerator `path.length===1`). A
   safe FN. Assert a depth-3 line is not emitted / not resolved.
8. **`valueMessage` is ALREADY pure** (`yaml-value-check.ts:144`, S135 relocated it) — NO relocation
   this slice. Reuse it and `isWrongValue` verbatim.
9. **Fixtures are directories.** Basename must be exactly `_quarto.yml`, so each fixture is a subdir with
   a `_quarto.yml` (mirror S135's `test/fixtures/yaml-project-value/{invalid,valid}/`). Filter integration
   diagnostics by `code === "quarto-invalid-project-value"` — the KEY feature and the document value
   feature co-diagnose the same host.
10. **L2 must stay INERT** — emit depth-2 lines but gate the compute (`path.length !== 0 → continue`)
    so nothing is flagged until L3 flips it. Without the guard, a depth-2 line whose grandchild name
    collides with a closed depth-1 field could flag prematurely at the L2 checkpoint.
11. **Numeric-MEMBER enums are a cardinal-sin trap — leave them OPEN.** `google-analytics.version`
    (enum[3,4]) is the ONLY one. Quarto coerces `version: 3.0`≡`3` (exit 0), but the string matcher
    flags `3.0` (grounded: real `isWrongValue("3.0",…)` ⇒ true). The reader MUST unset `valuesClosed`
    for a closed enum with any numeric-literal member (§3.2 A) — `version` becomes a safe FN. Put
    `google-analytics.version: 3.0` in the valid fixture. This is DIFFERENT from numeric-TYPED
    grandchildren (`search.limit`/`collapse-after`, `scalarType:"number"`) which ARE validated (the
    numeric branch handles coercion correctly — `20`/`3.0` accepted, `banana` flagged); add both a
    `search.limit: banana` (invalid) and `search.limit: 20` (valid) fixture row.
12. **`open-graph` resolves to a PARTIAL grandchild set.** `resolveObjectProperties` takes the first
    `anyOf` object arm, so `open-graph`'s `.children` = `[locale, site-name]` (grounded) — `image-height`/
    `image-width` (a later arm) are safe FNs. Don't be surprised the reader under-flags `open-graph`.

---

## Provenance — how this plan was grounded (Session 136)

- **Firsthand code read** of the S135-shipped machinery + the document-surface depth machinery:
  `yaml-schema.ts` (`projectFields`/`projectFieldsFromProperties`/`buildProjectConfigFields`/
  `ClosedKeySet.properties`/`resolveClosedKeys*`/`resolveObjectProperties`/`objectChildren`/`toField`/
  `annotate*`/`valuesOfSchema`/`closednessOfSchema`), `project-yaml.ts` (`findProjectConfigValueLines`/
  `findProjectConfigKeyLines`), `yaml-frontmatter-nested-values.ts` + `yaml-context.ts`
  (`findNestedFrontMatterValueLines`/`nestedParentPath`/`nearestShallowerLine` — the nested-enumerator
  model and why it is `format`-rooted), `yaml-value-check.ts` (`isWrongValue`/`valueMessage`),
  `yaml-project-value-diagnostics.ts` (the shipped feature) — established the 3-change design + the §5
  file:line inventory (post-S135) + why the reader is `objectChildren` reuse (no new resolver).
- **Verbatim-port harnesses** over the installed 1.7.33 schema, cross-validated against the real
  compiled resolver: `depth2-explore.cjs` (super-aware depth-2 closed inventory — depth-1 output
  BYTE-IDENTICAL to `pf-harness.cjs`, proving the port faithful), `anyof-probe.cjs` (tier-ii sizing),
  `rop-compare.cjs` (**the reader crux — `resolveObjectProperties` = super+anyOf union at depth-2, 0
  mismatches across all 8 nested containers**), `d2trap.cjs` (the depth-2 OPEN-with-values traps).
- **`quarto render` 1.7.33 grounding** — real website/book/project probes (`scratchpad/d2render/`,
  `d2fp/`, `d2trap-render/`), ~30 probes: every marked-closed grandchild rejects off-list values (exit 1
  SCHEMA); every OPEN trap renders exit 0 or fails DOWNSTREAM (`navbar.background: banana` — the
  `project.type` analogue); the depth-2 scanFlow continuation FP PROVEN (quoted `title` folding an
  embedded `collapse-below:` → exit 0); the depth-3 / sequence-form safe-FN cases confirmed; the
  `book.sidebar.style` super-merged path confirmed exit-1.
- **Operator scope decision** (Phase 0 `AskUserQuestion`): full depth-2 surface over a
  `project.preview`-only subset, after the grounding flipped S134's tier-i/tier-ii cost model (the
  `anyOf` "harder" tier is the same `objectChildren` reader as the "cheap" tier).
- **MANDATORY adversarial plan-review `Workflow`** (`wf_c99d35f6-b02`, 4 `quarto render`-verified
  lenses): soundness SOUND_WITH_FIXES, completeness SOUND_WITH_FIXES, doc-drift SOUND_WITH_FIXES,
  **fp-cardinal UNSOUND (HIGH)**. All 5 findings RE-VERIFIED firsthand before folding (not trusted):
  (1) HIGH — the `google-analytics.version` numeric-enum coercion FP (real `isWrongValue("3.0",…)` ⇒
  true while `quarto render version: 3.0` ⇒ exit 0) → folded as the §3.2 A reader guard + §2.1/§2.3/§7.9
  + the deferred general fix (§4.3); (2) MEDIUM — the 4 numeric grandchildren omitted → folded into
  §2.2/§4.1; (3) LOW — `open-graph` partial-arm → §2.3/dragon 12; (4) LOW — the `book.type` collision
  is a cardinal-sin (not FN) → §7.5/dragon 3 + fixture; (5) MEDIUM — the close-out docs owed
  (POSIT-COMPARISON/BACKLOG BL-47) → §5. The review changed the plan's headline count (55 → 57 flagged /
  59 closed-schema) and added a cardinal-sin reader guard the original plan would have shipped without.
