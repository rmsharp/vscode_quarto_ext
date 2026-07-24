# Plan — NUMERIC type-aware VALUE validation (`.qmd` front matter + cell options)

*Planning session: Session 129 (2026-07-20). Deliverable of that session = THIS plan. Implementation is a
separate, later session (one strict-TDD vertical slice). Governed by `SESSION_RUNNER.md` §Planning Sessions
+ `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`, under the project-wide strict-TDD gate.*

This is the **v2 "numeric" slice** the two prior value-validation plans filed as deferred:
`docs/planning/2026-07-19-value-validation-plan.md` §4.3 and
`docs/planning/2026-07-20-nested-frontmatter-value-validation-plan.md` §4.3. Cell-option, top-level
front-matter, and nested front-matter **enum/boolean** value validation are ALL shipped (Sessions 122–128,
CHANGELOG: nested front-matter values, Session 128`). This slice adds ONE new value-TYPE dimension — a scalar typed `number` — flagging a
non-number value of an already-recognized numeric option, matching `quarto render` 1.7.33.

---

## §0 — Decision at a glance

- **What ships:** a wrong VALUE of an already-recognized **numeric** option — e.g. `fig-width: wide`,
  `columns: fat`, `execute:\n  daemon: banana`, `format:\n  html:\n    fig-dpi: hi`, or a cell
  `#| layout-ncol: two` — shows an **Error** squiggle in `.qmd`, on the value token, matching what
  `quarto render` 1.7.33 rejects at its **YAML-schema layer**. A quoted number (`fig-width: "6"`) is also
  flagged (quarto rejects it). Valid numbers, boolean-or-number fields' booleans, open/unknown fields, and
  every non-numeric surface emit nothing.
- **How:** ONE new `SchemaField` bit — `scalarType?: "number"` — derived from the schema by a
  `numericTypeOfSchema` detector (the structural sibling of the existing `closednessOfSchema`, §3.2), stamped by a new
  `annotateScalarType` at the same TWO reader choke points that already call `annotateClosedness`, plus ONE
  hand annotation on the curated `daemon`. The pure matcher `isWrongValue` gains a numeric branch. Because
  all THREE existing diagnostic loops already call `isWrongValue`, **numeric validation reaches cell /
  top-level / nested surfaces with NO new loop and NO new enumerator** — this slice is strictly smaller than
  the nested slice.
- **Safety (the whole point):** false-negative-only, unchanged. The matcher's number predicate `R` is a
  **verified strict superset** of quarto's numeric-accept set (§2.3), so anything it flags, quarto also
  rejects — zero false positives. The `scalarType` bit is DERIVED PER-SCHEMA-NODE (never a global
  by-name list), so a same-named key that is numeric in one container and string in another (`section`,
  `year`, `transition`, `items`) never cross-contaminates (§7.3).
- **Scope:** ONE vertical slice, 4 checkpoint-committed layers (§4.1). The integer-vs-`number` distinction,
  deeper-than-one-level nested numerics, `.ipynb`, and the offline curated fallbacks stay deferred (§4.3).

---

## §1 — Context

### 1.1 Problem

The value-validation feature flags a wrong value of a recognized option whose value set is provably CLOSED
(enum / boolean). Numeric options — `fig-width`, `fig-height`, `fig-dpi`, `columns`, `dpi`, `toc-depth`,
`execute.daemon`, per-format `format.<fmt>.fig-width`, cell `#| layout-ncol`, … — are typed `number` in the
schema, carry **no `values` enum**, and so are invisible to the current matcher (which requires
`valuesClosed===true && values.length>0`). Yet `quarto render` 1.7.33 **rejects a non-number for them at its
YAML-schema layer** with a precise, format-independent error (`Field "fig-width" has value wide, which must
instead be a number`). Today the author only discovers `fig-width: wide` when the render fails; this slice
surfaces it as an inline Error squiggle, exactly as the enum/boolean slices already do for `echo: maybe`.

### 1.2 Constraints (standing, binding)

- **C1 — false-negative-only (the hard product rule, CHANGELOG: front-matter/cell-option VALUE validation, Sessions 124-149`).** NEVER flag a value quarto would
  accept. Everything the matcher is unsure about returns "not wrong" (flag nothing). This is the cardinal
  rule the entire feature's trust rests on; the numeric branch upholds it via a superset predicate (§2.3).
- **C2 — `quarto render` 1.7.33 is the sole oracle.** Flag only what quarto's **YAML-schema layer** rejects
  (message family "…which must instead be a number" / "has empty value but it must instead be a number").
  Do **NOT** mirror a downstream **pandoc** error (§2.4) — those are integer-typed, format-specific, and
  outside this feature's grounding authority.
- **C3 — pure `core/` where the logic lives.** The type detector and matcher are `vscode`-free and unit-
  tested headlessly (vitest). The `vscode` seam is only the existing feature's three loops, unchanged.
- **C4 — extend, do not fork.** This is the same feature, same `quarto-value` collection, same
  `isWrongValue` matcher, same three loops. No new feature, no new `createDebouncedDiagnosticsFeature`
  caller, no new enumerator.
- **C5 — strict TDD, vertical slice.** RED→GREEN→refactor, one behavior at a time; ≤5 files per checkpoint
  commit; the §9 adversarial review is mandatory (Learning #138/#141 — a fresh lens has caught a CRITICAL FP
  the author's own sweep missed on EVERY value slice so far).

### 1.3 Current state — what already exists (build on it, do NOT rebuild)

| Piece | Where | Reuse |
|---|---|---|
| `SchemaField` shape | `src/core/yaml-schema.ts:22` | ADD one optional bit `scalarType?: "number"`. |
| Closedness detector | `closednessOfSchema` `:775` | `numericTypeOfSchema` is its structural sibling. NOTE `:787-788` (`typeof schema === "string" ⇒ OPEN`) *swallows* bare `"number"` into non-numeric — it does NOT positively recognize it; the sibling must SPLIT that arm so `"number"`/`"integer"` return numeric FIRST (§3.2, dragon #8). |
| Annotation choke points | `annotateClosedness` called at `toField:1173` and `objectChildren:1133` | ADD `annotateScalarType(field, schema, definitions)` alongside at BOTH. |
| The matcher | `isWrongValue` `src/core/yaml-value-check.ts:31` | ADD a numeric branch; reuse the node-property/flow/block skip (`:35`) and boolean-spelling logic. |
| The three loops | `computeValueDiagnostics` `src/features/yaml-value-diagnostics.ts:79/121/151` (cell/top-level/nested), each calling `isWrongValue` | UNCHANGED — numeric flows through all three for free. |
| The message | `valueMessage` `:179` | ADD a numeric arm. |
| Curated `execute:` set | `CURATED_EXECUTE_KEYS` `:301` (`daemon` `:311`) — ALWAYS the source for `frontMatterKeys(["execute"])` (`:291`) | Hand-annotate `daemon` `scalarType:"number", acceptsBoolean:true`. |
| Completion provider | `src/providers/yaml.ts:130,137` — reads `field.values` ONLY | UNCHANGED and unaffected (a new bit is invisible to completion). |

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 / pandoc 3.6.3)

*Every row below was grounded firsthand this session (`quarto render <fixture> --to <fmt>`, exit code +
error source). The number-literal boundary (§2.3) was additionally characterized by a dedicated grounding
agent (60 literal probes) and cross-checked firsthand.*

### 2.1 Numeric fields reject a non-number at the QUARTO-schema layer — on every surface

| Surface | Probe | Result |
|---|---|---|
| top-level FM | `fig-width: wide` / `columns: fat` / `dpi: zz` / `order: zz` / `section: zz` | exit 1, **"Validation of YAML front matter failed … which must instead be a number"** |
| per-format | `format:\n  html:\n    fig-width: wide` | exit 1, same front-matter-schema message |
| nested `execute:` | `execute:\n  daemon: banana` | exit 1, same |
| cell option | `` ```{r}\n#| fig-width: zz `` / `#| layout-ncol: zz` | exit 1, **"Validation of YAML CELL METADATA failed … must instead be a number"** |
| reveal (format:revealjs) | `view-distance: zz` / `min-scale: zz` | exit 1, front-matter-schema |
| epub | `group-position: zz` | exit 1, front-matter-schema |

All are the same schema-validation family the enum/boolean slices already mirror ("front matter" and "cell
metadata" are the two spellings of one layer). **Every reader-surfaced numeric field is flaggable.**

### 2.2 Quoted numbers, empty values, and the boolean-or-number fields

| Probe | Result | Consequence |
|---|---|---|
| `fig-width: "6"` / `daemon: "30"` (quoted) | exit 1 quarto-schema ("must instead be a number") | **flag** — quoted numbers are rejected, exactly like quoted booleans (`toc: "true"`). |
| `fig-width:` (empty value) | exit 1 quarto-schema ("has empty value but it must instead be a number") | out of scope — the loops already skip an empty value token (mid-edit); a deliberate safe FN (§7.5). |
| `execute.daemon: 30` / `daemon: true` | exit 0 (both) | `daemon` = **number OR boolean** → `scalarType:"number"` + `acceptsBoolean:true`. |
| `execute.daemon: banana` | exit 1 quarto-schema | flag. |
| `toc-expand: 3` / `toc-expand: true` / `toc-expand: banana` | 0 / 0 / **1** | `toc-expand` = number OR boolean (reader-derived; same shape as daemon). |
| `auto-slide: false` / `auto-slide: true` / `auto-slide: 3000` / `auto-slide: fast` | 0 / **1** / 0 / 1 | `anyOf[number, enum[false]]` — accepts `false` but **rejects `true`**. Neither number-only nor number+bool models it → **leave OPEN** (safe FN, §4.3). |

### 2.3 The number-literal acceptance boundary — the matcher predicate `R`

Quarto tags an unquoted scalar via its bundled YAML resolver; a `number` field accepts iff it tags int/float.
Verified accept set (each = exit 0, or exit≠0 only at the pandoc layer, i.e. quarto-schema accepts):
`6 6.5 -6 +6 0 00 09 0777 1e2 1E2 1.5e-3 1.e2 1e+2 .5 .5e2 5. -0 +0.5 1_000 0_0 0x1A 0o17 0b101 .inf .Inf
.nan .NaN` (and, after YAML comment-strip/trim, `6   ` / `6 # note`).
Verified quarto-schema-REJECT: `wide 6abc 6px 1,000 inf nan 10:30 1.0.0 . + e2 _1 1_ 0X1A 0xG 0x 0b2 0o8`
`+.5 -.5 +.nan` and any **quoted** scalar.

**Predicate (mirror of quarto; false-negative-only → ZERO false positives):**

```
PREPROCESS the raw value token exactly as YAML sees it:
  (1) if UNQUOTED, strip a trailing comment: remove  ` #…`  (a space then `#` to end);
  (2) trim surrounding whitespace.
FLAG "quarto would reject this as not-a-number" iff ANY of:
  A. the trimmed value is EMPTY (empty / whitespace-only);            [loops already skip empty → inert here]
  B. the value is QUOTED (first non-space char is `"` or `'`);        [quoted → string → rejected for number]
  C. the unquoted trimmed value does NOT fully match R:
     R = ^[+-]?(?: \.?[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9]+)?   # decimal int/float (lead-/trail-dot, exp)
                 | 0[xX][0-9a-fA-F_]+                                   # hex
                 | 0[oO][0-7_]+                                         # octal
                 | 0[bB][01_]+                                          # binary
                 | \.(?:inf|Inf|INF) )$                                 # signed infinity
         | ^\.(?:nan|NaN|NAN)$                                          # NaN (unsigned only)
For an `acceptsBoolean` numeric field (daemon/toc-expand), the six boolean spellings
(true|True|TRUE|false|False|FALSE, UNQUOTED) are ALSO accepted (checked BEFORE R).
```

`R` was verified to accept **every** token quarto accepts, so it is a strict superset of quarto's accept set;
any token `R` fails is genuinely rejected by quarto → flagging it is always correct. Forms where quarto is
*stricter* than `R` — `+.5`, `-.5` (signed leading-dot: `R` matches, quarto rejects), trailing-underscore
`1_` (`R`'s `[0-9_]*` matches, quarto rejects), uppercase-radix `0X1A` — are left UNFLAGGED, deliberate safe
false negatives under C1. (`_1` leading-underscore and `10:30` sexagesimal are NOT safe FNs: `R` does not
match either, so the matcher FLAGS them — correctly, since quarto schema-rejects both. Grounded:
`fig-width: _1`/`10:30` → exit 1 quarto-schema.) (The listed "optional tightenings" from the grounding are NOT adopted in v1: `R` as-is is
already zero-FP, and tightening trades safe FNs for complexity with no FP benefit.)

### 2.4 The integer/number distinction is a PANDOC concern — do NOT mirror it (a cardinal-sin guard)

`toc-depth: 2.5` / `columns: 2.5` / `slide-level: 2.5` → exit 1, but the error is **`pandoc … Error in $:
parsing Int failed, value is either floating`** — a DOWNSTREAM pandoc-writer error, NOT quarto's YAML-schema
layer. Meanwhile `number-depth: 2.5` / `fig-width: 6.5` → exit 0. The schema resource types ALL of these
`"number"` (there is **no `"integer"` leaf anywhere** in the 1.7.33 resource — verified by two independent
resolvers). Therefore: the extension treats every numeric field as `number`, accepts any numeric literal,
and **must not attempt to flag a float on a conceptually-integer field** — doing so would mirror a
format-specific pandoc error the extension has no reliable signal for, and would false-positive on a format
where pandoc accepts it. This is the numeric analogue of the enum slice's `output`/`daemon`-stay-open rule.

---

## §3 — Decision (architecture)

### 3.1 Feature shape — a new value-TYPE, not a new surface

Numeric validation is a **type dimension on the shared matcher**, not a fourth loop. The three loops
(`computeValueDiagnostics`, cell `:79` / top-level `:121` / nested `:151`) each already resolve a field and
call `isWrongValue(rawToken, field)`. Give the field a `scalarType:"number"` bit and teach `isWrongValue` a
numeric branch, and all three surfaces validate numbers with **zero new wiring**. This is the deepest reuse
available and is strictly simpler than the nested slice (which needed a new enumerator).

### 3.2 Schema model addition — the one core change

```ts
// SchemaField gains ONE optional field (yaml-schema.ts:22):
scalarType?: "number";   // set when the field's schema resolves EXCLUSIVELY to number/integer
                         // (+ optionally boolean, which sets acceptsBoolean). Orthogonal to
                         // valuesClosed (a numeric field has no `values` enum). Unused by completion.
```

- **`numericTypeOfSchema(schema, definitions, depth)`** — the structural sibling of `closednessOfSchema`,
  walking the SAME arms in the same order (`boolean` / `enum` / `anyOf` / `maybeArrayOf` / `ref` /
  `string:{}` / `schema` / depth-cap). Returns `{ numeric: boolean; acceptsBoolean: boolean }`, `numeric`
  true iff **every** reachable arm resolves to `number`/`integer` (or `boolean`, which additionally sets
  `acceptsBoolean`). Two arms need explicit care and are NOT verbatim copies of the sibling:
  - **The bare-string arm MUST be SPLIT** (dragon #8): `schema === "number" || schema === "integer"` returns
    `numeric:true`, placed **ahead of** the generic `typeof schema === "string" ⇒ non-numeric` fallback that
    `closednessOfSchema:787-788` uses. `closednessOfSchema` *swallows* bare `"number"` into OPEN; a verbatim
    copy would return non-numeric for `"number"` and leave the ENTIRE feature inert (a total FN). This
    positive `"number"`/`"integer"` recognition is the load-bearing new line.
  - **`maybeArrayOf` RECURSES into its inner node** (like `closednessOfSchema:817`), so
    `maybeArrayOf[number]` ⇒ `numeric:true`. This deliberately marks `number-offset` (the ONLY
    `maybeArrayOf`-of-number field) as numeric — grounded: `number-offset: wide` → exit 1 quarto-schema,
    `number-offset: 3` → exit 0, `number-offset: [1,2]` → exit 0. The **array form is skip-guarded** by the
    matcher's `:35` leading-`[` guard, exactly as the shipped enum feature already marks the
    `maybeArrayOf[enum]` field `fig-align` closed and relies on the same guard for `fig-align: [left,right]`.
    This keeps `numericTypeOfSchema` a true sibling (no arm-order deviation) and catches one more real error.

  Every OTHER arm ⇒ `numeric:false`: a `string`/`string:{completions}` arm, an `enum` arm (even an
  all-numeric enum like `aspectratio` — it is a CLOSED set, handled by the enum path, not the numeric one),
  a bare `arrayOf`, an `object`, a `path`, an unrecognized node, or the depth-cap. Risk polarity matches the
  sibling: an unproven node defaults to non-numeric (open). Grounded consequences: the 38 bare-`number`
  fields **plus `number-offset`** (39 marked, `daemon`/`toc-expand` additionally `acceptsBoolean`) qualify;
  the remaining 10 mixed fields (`linestretch` number|string, `margin` number|object, `auto-slide`
  enum|number, `fig-keep` array|enum|number, the cell-card/reveal number|string pairs, `dependson`
  array|number|string) do NOT.
- **`annotateScalarType(field, schema, definitions)`** — runs `numericTypeOfSchema`; if `numeric`, sets
  `field.scalarType = "number"` and, if `acceptsBoolean`, `field.acceptsBoolean = true`. **NOT gated behind
  `field.values` being non-empty** (numeric fields have no `values` — so this canNOT ride inside
  `annotateClosedness`, which early-returns on empty `values`; it is a separate call). Invoked at BOTH choke
  points (`toField:1173`, `objectChildren:1133`), alongside the existing `annotateClosedness`.
- **Curated `daemon`** (`CURATED_EXECUTE_KEYS:311`, always the source for `frontMatterKeys(["execute"])`) —
  hand-annotate `scalarType:"number", acceptsBoolean:true`. It keeps `values: BOOL` (offered for completion)
  and stays enum-OPEN (`valuesClosed` unset); the numeric branch, not the enum path, handles it.

### 3.3 The matcher — `isWrongValue` numeric branch (pure core, the highest-value TDD target)

Restructure so the **shared skip** runs first, then dispatch by type:

```
isWrongValue(rawToken, field):
  if rawToken empty OR starts with [ ] { } | > & * !   -> false   // mid-edit / flow / block / node property (unchanged :35)
  if field.scalarType === "number":                                // NEW numeric branch
      if field.acceptsBoolean and BOOLEAN_SPELLINGS.test(rawToken) -> false   // daemon: true
      return isWrongNumber(rawToken)                               // §2.3 predicate (preprocess + quoted + R)
  // existing enum/boolean path (unchanged):
  if field.valuesClosed !== true OR values empty -> false
  … boolean spellings / enum membership …
```

`isWrongNumber(token)` implements §2.3 exactly: strip an unquoted trailing ` #…`, trim; return `true`
(wrong) iff empty, OR quoted (leading `"`/`'`), OR `!R.test(trimmed)`. `R` is a module-level anchored
`RegExp`. No YAML parsing (C1/C3). The node-property/flow/block skip at `:35` already protects a
`fig-width: &a 6` / `fig-width: !expr 1+1` from the numeric branch (returns false before it).

### 3.4 The message — `valueMessage` numeric arm (dispatch on `scalarType` FIRST)

The numeric arm MUST sit at the TOP of `valueMessage` (`:179`), **before** the existing
`if (field.acceptsBoolean && values.every(true/false))` branch at `:181`:

```
function valueMessage(raw, key, field):
    if field.scalarType === "number":                 // NEW — must be FIRST
        return field.acceptsBoolean
          ? `Value ${raw} is not valid for "${key}" — expected a number or true or false.`
          : `Value ${raw} is not valid for "${key}" — expected a number.`
    // …existing acceptsBoolean-enum branch (:181) and enum branch (:184), unchanged…
```

**Why FIRST (dragon #9):** curated `daemon` keeps `values: BOOL` and gains `acceptsBoolean:true` (§3.2), so
it satisfies the existing `:181` predicate (`acceptsBoolean && values.every(true/false)`). If the numeric arm
were appended, `execute:\n  daemon: banana` — the §0 headline example — would render "expected true or false"
(omitting "number", and implying the valid `daemon: 30` is wrong). Dispatching on `scalarType` first yields
"expected a number or true or false". (Grounded on the FACT of quarto's error, not its exact wording — same
policy as the enum arm.) This arm ships in **L2**, not L3 (§4.1) — L2 is the go-live layer.

### 3.5 Data flow (unchanged skeleton, one new gate)

`computeValueDiagnostics` reads the snapshot once, enumerates cell/top-level/nested value lines (unchanged),
`await`s the schema index, resolves each key to its container-scoped `SchemaField`
(`cellOptions(engine)` / `frontMatterKeys([])` / `frontMatterKeys(parentPath)`), and calls the shared
`isWrongValue`. The ONLY behavioral change is that a resolved field may now carry `scalarType:"number"`, so
`isWrongValue` may now return true for a non-number. The generation-guard/`isCurrent()`/pre-await-snapshot
contract (Sessions 124/126) is untouched. The empty-fast-path (`:70`) is unchanged — it counts value LINES,
not their types; a numeric field still produces a value line.

---

## §4 — Scope: the vertical slice (ONE implementation session)

### 4.1 The layer set (gate-(a) contract — build in this order, checkpoint-commit each)

> This layer list IS the pre-declared vertical-slice contract (`SESSION_RUNNER.md` §Vertical Slice
> Sessions, gate (a)). ONE capability — numeric value validation — across four layers. The implementing
> session re-verifies this contract unchanged at Orient; drift voids it and reverts to a new plan-mode round.

- **L1 — schema type detection (pure core, INERT).** `SchemaField.scalarType` + `numericTypeOfSchema` +
  `annotateScalarType` wired at `toField:1173` and `objectChildren:1133` + hand-annotate curated `daemon`.
  **DONE looks like:** a new unit test `test/unit/yaml-scalar-type.test.ts` (mirroring
  `yaml-value-closedness.test.ts`) proving `numericTypeOfSchema`/`annotateScalarType` set `scalarType:"number"`
  on `fig-width`/`columns`/`daemon`(+acceptsBoolean)/`toc-expand`(+acceptsBoolean)/**`number-offset`**
  (via `maybeArrayOf[number]`) and a representative per-format field, and do NOT set it on the 10 mixed
  fields (`linestretch` number|string, `auto-slide` enum|number, `margin` number|object, `fig-keep`
  array|enum|number), an enum field (`echo`), or a string field (`engine`). **Verify:** `npm test` green;
  RED shown first. **Safe checkpoint — this layer alone is genuinely inert:** nothing reads `scalarType`
  until L2, so L1 changes no diagnostics. (Contrast L2 below — do NOT assume the same of it.)
- **L2 — the matcher numeric branch + message (pure core) — ⚠ THIS IS THE GO-LIVE LAYER.** Restructure
  `isWrongValue` (§3.3) + `isWrongNumber` + the `R` regex, **AND the `valueMessage` numeric arm (§3.4),
  placed FIRST**. Because the three loops ALREADY call `isWrongValue` then `valueMessage` on real
  reader-stamped fields, numeric Error squiggles go LIVE at this checkpoint commit — so the message arm
  cannot wait for L3 (an appended-late or missing arm ships a degenerate "expected one of: ." / a
  daemon-mismessage at a declared safe stopping point). **DONE looks like:** unit tests in
  `test/unit/yaml-value-check.test.ts` covering the §2.3 matrix — ACCEPT (not wrong) `6 6.5 -6 +6 0 1e2
  1.5e-3 .5 5. 1_000 0x1A 0o17 0b101 .inf .nan` and (daemon) `true`/`30`; FLAG (wrong) `wide 6abc 6px "6"
  '6' 1,000 inf _1 10:30` and (daemon) `banana`/`"30"`; the deliberate safe-FN cases (`+.5`, `-.5`, `0X1A`,
  `1_`) left NOT-wrong; a node-property token (`&a 6`, `!expr x`) and a flow/block token left NOT-wrong; the
  enum path unchanged (regression) — plus a `valueMessage` unit assertion that a numeric `acceptsBoolean`
  field yields "…a number or true or false" and a plain numeric field yields "…a number". **Verify:**
  `npm test` green; RED first; **smoke-launch once** (the feature is live now, §3E) — the L3 integration
  describe formalizes it.
- **L3 — integration + fixtures (the runtime proof of the now-live L2).** Two fixtures + a 4th integration
  `describe`. **DONE looks like:**
  - `test/fixtures/yaml-value-diagnostics/numeric-front-matter.qmd` — flags on ALL three surfaces
    (top-level `columns: wide`; nested `execute:\n  daemon: banana`; per-format `format:\n  html:\n
    fig-dpi: hi`; a cell `#| layout-ncol: two`), each line grounded to `quarto render` exit 1.
  - `test/fixtures/yaml-value-diagnostics/valid-numeric-front-matter.qmd` — ZERO diagnostics, an FP guard
    battery. Every line is a value the matcher accepts AND (to keep the whole fixture render-green, §9.2)
    that both quarto layers accept: `fig-width: 6.5`, `fig-width: 1e2`, `fig-width: .inf`, `fig-width: 1_000`
    (exotic literals go on the float field `fig-width` — NOT on integer-conceptual fields like `dpi`/`columns`,
    which pandoc-reject a float/`.inf`, §2.4); `columns: 2`, `dpi: 96` (in-range ints); `execute:\n  daemon:
    30` and `daemon: true`; `number-offset: [1, 2]` (array form — skip-guarded, NOT flagged) and
    `number-offset: 3`; `linestretch: 1.5` AND `linestretch: 2em` (mixed number|string — NEITHER flagged);
    `auto-slide: false` (open — not flagged); `fig-width: 6  # note` (unquoted trailing comment).
  - a 4th `describe` in `test/integration/suite/yaml-value-diagnostics.test.ts` asserting real
    `vscode.languages.getDiagnostics` at the exact value spans on the flag fixture (incl. a message-contains-
    "number" assertion on the `daemon: banana` line, to regression-lock the §3.4 ordering) and NONE on the
    valid fixture, plus a live-edit re-scan. **Verify:** `npm test` (unit) + the integration suite green.
- **L4 — MANDATORY §9 adversarial review + TDD fixes.** A fresh 4-lens `quarto render`-verified review
  (§9). Any confirmed FP is fixed TDD (RED→GREEN) before close-out. This layer is NON-optional (§0/C5).

### 4.2 Session boundary

ONE implementation session. Each layer is one checkpoint commit (≤5 files). The slice maps to one reversible
intent (numeric value validation); a crash strands ≤1 layer. This is NOT bundled with the deferred items in
§4.3 — those are distinct capabilities (integer-typed pandoc validation is a different oracle; deep-nested is
a different traversal; `.ipynb` is a different document model).

### 4.3 Deferred to a later session (filed to `BACKLOG.md`, NOT built here)

| Deferred | Why |
|---|---|
| **Integer-typed / float-on-integer** (`toc-depth: 2.5`) | PANDOC-layer, format-specific error — not quarto's YAML-schema layer (§2.4). No reliable schema signal (no `"integer"` leaf exists). Mirroring it risks a format-dependent FP. |
| **`auto-slide`** (`anyOf[number, enum[false]]`) | Accepts `false` but rejects `true` — neither number-only nor number+bool models it; a bespoke number-or-literal-`false` matcher for ONE obscure reveal field is not worth the surface. Stays OPEN (safe FN). |
| **Deep-nested numerics** (`website:\n  sidebar:\n    collapse-level`, `chalkboard.boardmarker-width`, csl `month`/`day`) | Beyond the enumerators' one-level depth cap (the same cap the nested slice set). A future slice that deepens the nested enumerator picks these up. Safe FN. |
| **Offline curated numeric fallbacks** (`CURATED_CELL_OPTIONS` `fig-width`/`fig-height`/`layout-ncol`; any `CURATED_FRONTMATTER_KEYS`/`CURATED_FORMAT_OPTIONS` numerics) | The rare no-reader path (§8). Same false-negative-safe deferral the nested slice made for `CURATED_FORMAT_OPTIONS`. The online reader path (the common case) is fully covered by `annotateScalarType`. |
| **`.ipynb` numeric values** | Separate `NotebookDocument` plumbing — same cliff as every prior value slice. |

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped this session)

| Symbol / site | Location | Change |
|---|---|---|
| `SchemaField` interface | `src/core/yaml-schema.ts:22` | +`scalarType?: "number"` (with doc comment). |
| `closednessOfSchema` | `src/core/yaml-schema.ts:775` | UNCHANGED — model for the new sibling. |
| `numericTypeOfSchema` | NEW in `src/core/yaml-schema.ts` (beside `closednessOfSchema`) | new pure detector. |
| `annotateClosedness` | `src/core/yaml-schema.ts:839` | UNCHANGED. |
| `annotateScalarType` | NEW in `src/core/yaml-schema.ts` (beside `annotateClosedness`) | new; called at the two choke points. |
| choke point 1 | `src/core/yaml-schema.ts:1173` (`toField`) | +`annotateScalarType(field, e.schema, definitions)`. |
| choke point 2 | `src/core/yaml-schema.ts:1133` (`objectChildren`) | +`annotateScalarType(field, sub, definitions)`. |
| curated `daemon` | `src/core/yaml-schema.ts:311` | +`scalarType:"number", acceptsBoolean:true`. |
| `isWrongValue` | `src/core/yaml-value-check.ts:31` | restructure + numeric branch + `isWrongNumber` + `R`. |
| `isWrongValue` call sites (3) | `src/features/yaml-value-diagnostics.ts:93,123,153` | UNCHANGED — inherit numeric. |
| `valueMessage` | `src/features/yaml-value-diagnostics.ts:179` | +numeric arm. |
| completion provider | `src/providers/yaml.ts:130,137` | UNCHANGED (reads `values` only; `scalarType` invisible). |
| unit tests | `test/unit/yaml-scalar-type.test.ts` (NEW), `test/unit/yaml-value-check.test.ts` (+numeric) | . |
| integration + fixtures | `test/integration/suite/yaml-value-diagnostics.test.ts` (+describe); `test/fixtures/yaml-value-diagnostics/{numeric-front-matter,valid-numeric-front-matter}.qmd` (NEW) | . |

Grep confirmations run this session: `scalarType` — **zero** existing refs (new symbol, no collision).
`isWrongValue` — 3 call sites, all in `yaml-value-diagnostics.ts`. `annotateClosedness` — 2 choke points.
`valuesClosed`/`acceptsBoolean` consumers — `yaml-value-check.ts`, `yaml-value-diagnostics.ts` only.
Field inventory (51 numeric-bearing schema fields) written to the session scratch (`numeric-fields.json`),
reconciled by an independent resolver (the review's completeness critic): 38 bare-`number` + `number-offset`
(`maybeArrayOf[number]`) + `daemon`/`toc-expand` (number+bool) = **39 MARKED numeric**; the remaining **10
stay OPEN** (mixed with a string/enum/object/array arm). The plan-review flip of `number-offset` from
mixed→marked (it has no string arm; its array form is skip-guarded) is the one correction to the first-pass
`numeric+MIXED` count.

---

## §6 — Alternatives considered (honest)

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **A new fourth loop / enumerator for numerics** | mirrors the nested slice's shape | numerics live on the SAME surfaces the three loops already scan; a fourth loop would re-walk the same value lines and duplicate resolution | **Rejected** — `scalarType` on the shared matcher is deeper reuse (§3.1). |
| **Mirror the integer/float pandoc error too** (`toc-depth: 2.5`) | catches more real errors | pandoc-layer, format-specific; no schema signal; FP risk on formats where pandoc accepts it (§2.4) | **Rejected** — violates C2. Deferred (§4.3). |
| **A global by-name numeric key list** (e.g. `{fig-width, columns, dpi, …}`) | trivially simple | `section`/`year`/`transition`/`items` are numeric in one container and string in another → cross-container FP (§7.3) | **Rejected** — annotation MUST be per-schema-node. |
| **Encode `scalarType: "number" \| "integer"`** | forward-looking | no `"integer"` leaf exists in 1.7.33; integer-ness is pandoc-layer; adds an unused arm | **Rejected** — single `"number"` (YAGNI / §2.4). |
| **Tighten `R`** (drop leading-dot on signed, lowercase-only radix) | flags a few more real errors (`+.5`) | trades safe FNs for regex complexity; no FP benefit (`R` is already zero-FP) | **Rejected for v1** — noted as an optional future tightening. |

---

## §7 — Failure-mode analysis (the safety story — this IS the feature)

- **7.1 The superset guarantee (C1).** `R` accepts every token quarto accepts (§2.3, verified over 60
  literals). ⇒ any token the matcher flags, quarto also rejects ⇒ **no false positive from the number
  predicate**. When `R` is unsure it is *looser* than quarto (safe FN), never tighter.
- **7.2 Quoted / node-property / flow / block tokens.** A quoted number is flagged (quarto rejects it,
  §2.2). A node-property (`&a`/`*a`/`!tag`), flow (`[`/`{`), or block (`|`/`>`) token is skipped by the
  shared `:35` guard BEFORE the numeric branch (quarto resolves the node property and may accept — a flag
  would be the cardinal sin, per the S125 review that added that guard).
- **7.3 The `section`/`year`/`transition`/`items` name-collision (critic-caught, CRITICAL).** These keys are
  numeric in ONE container (`section` in `document-options`, top-level) but string/array in ANOTHER (`section:
  "3-5"` in CSL citation metadata; `year` in csl-date; `transition` string-enum at reveal top-level; `items`
  an array elsewhere). **Because `annotateScalarType` derives the bit PER-SCHEMA-NODE at the reader choke
  points, each container's field carries only ITS node's type** — the reader never applies a top-level
  numeric mark to a CSL `section`. Grounded: `section: "3-5"` at TOP LEVEL is genuinely rejected by quarto
  (numeric there) → flagging it there is CORRECT; the FP would only arise from a by-name list, which §6/§3.2
  forbid. **The plan's binding rule: never mark numeric by bare key name; only via `numericTypeOfSchema` on
  the field's own node.**
- **7.4 Unknown / open / mixed fields.** An unrecognized key is never resolved (permanently-banned
  unknown-key territory). A field whose schema has any string/enum/array/object arm gets `numeric:false` from
  `numericTypeOfSchema` ⇒ no bit ⇒ the numeric branch never runs (the enum path's `valuesClosed` gate then
  also skips it). `linestretch` (number|string), `margin` (number|object), `auto-slide` (enum|number),
  `fig-keep` (array|enum|number), and the cell-card/reveal `width`/`height`/`padding` (number|string) are
  all left OPEN — grounded exit-0 on their string/array forms. (`number-offset` is `maybeArrayOf[number]` —
  no string arm — so it IS marked numeric; its array form is skip-guarded, §3.2/§7.2.)
- **7.5 Empty value.** `fig-width:` renders exit 1 at the schema layer, but the three loops already skip an
  empty value token (a value still being typed) — a deliberate safe FN, unchanged.
- **7.6 The integer trap (§2.4).** `toc-depth: 2.5` renders exit 1 but at the PANDOC layer; the extension
  types it `number` and does NOT flag `2.5`. A future contributor must not "tighten" the number predicate to
  reject floats "for symmetry" — that reintroduces a format-specific FP.
- **7.7 Completion untouched.** `scalarType` is invisible to the completion provider (`values`-only, §5), so
  numeric fields' completion behavior is unchanged.

---

## §8 — Impact analysis

| Surface | Impact |
|---|---|
| `.qmd` numeric value diagnostics (online reader) | NEW — a non-number on a recognized numeric option shows an Error squiggle (cell/top-level/nested/per-format). |
| Offline (no-reader) fallback | Numeric curated fields NOT annotated in v1 → safe FN (§4.3). Reader-available is the common case. |
| Enum/boolean value validation | UNCHANGED (the enum path is untouched; L1 bit is inert, L2 restructure preserves it via regression tests). |
| Completion, unknown-key diagnostics, all other features | UNCHANGED. |
| Build/package | +1 core detector, +1 matcher branch, +2 fixtures, +1 unit file — no new dependency, no new command, no `package.json`/`extension.ts` change (same feature registration). |

**What does NOT change (explicit scope boundary):** no new command, no new `DiagnosticCollection`, no new
`createDebouncedDiagnosticsFeature` caller, no new enumerator/loop, no completion change, no
`extension.ts`/`package.json` change, no touch to the frozen `yaml-diagnostics.ts` (unknown-key feature).

---

## §9 — Verification plan (executor)

1. **Per-layer TDD.** RED shown before GREEN at each of L1–L3; `npm run check-types` clean; unit + integration
   green at every checkpoint commit.
2. **Fixtures grounded to `quarto render` 1.7.33.** Every flag line in `numeric-front-matter.qmd` = exit 1
   at the quarto-SCHEMA layer ("…must instead be a number" / "…cell metadata…"). Every line in
   `valid-numeric-front-matter.qmd` must **(a)** be quarto-SCHEMA-accepted (no "must instead be a number"
   rejection — this is the FP-safety criterion the matcher mirrors) AND **(b)** render exit 0 overall (chosen
   so the render is green). Note the two are NOT the same: a schema-valid literal can still pandoc-reject on an
   integer-conceptual field (`dpi: .inf` / `columns: 2.5` → exit 1 pandoc, §2.4) — so keep exotic literals on
   genuinely-float fields (`fig-width`), which satisfy both. Re-run `quarto render` on both fixtures during L3
   and record exit codes (do not trust the schema — trust the render).
3. **Integration = the real API.** The 4th `describe` asserts `vscode.languages.getDiagnostics` (the API VS
   Code renders squiggles from) at exact value spans in the `@vscode/test-electron` host.
4. **MANDATORY §9 adversarial review (L4) — a fresh multi-lens `Workflow`, `quarto render`-verified:**
   - **FP-hunt (the cardinal lens):** try to construct ANY `.qmd` where the numeric branch flags a value
     `quarto render` accepts — quoted forms, node properties, YAML number exotica (`.inf`, `1_000`, hex),
     per-format scoping, tabs/CRLF, multi-line/flow/block scalars carrying a numeric-looking continuation,
     the boolean-or-number fields, the mixed fields' string forms, name-collision keys (`section`, `year`).
     Any confirmed FP → fix TDD before close-out.
   - **Resolution / reader-plumbing:** does `annotateScalarType` at both choke points set the bit on exactly
     the intended fields and not leak across containers? Does `numericTypeOfSchema` mirror
     `closednessOfSchema`'s arm order (no missed `ref`/`anyOf`/`maybeArrayOf`)?
   - **Lifecycle:** generation-guard/`isCurrent()`/snapshot contract intact; empty-fast-path still correct.
   - **Doc-drift (named targets — verified this planning session):** (i) CHANGELOG: numeric type-aware front-matter values, Session 130` — the
     `- [ ] **v2 (still deferred, plan §4.3):** numeric type-aware …` bullet under item 46: flip its NUMERIC
     clause to a shipped `[x]` bullet (mirroring item 46's structure), **keeping `.ipynb` /
     `CURATED_FORMAT_OPTIONS` / other-containers open**. (ii) `docs/POSIT-COMPARISON.md:466` and `:797` — both
     still assert NUMERIC-typed values are an unshipped gap; remove NUMERIC from those remaining-gap lists.
     (iii) `ROADMAP.md` — carries NO value-validation entry (verified: grep empty), so nothing changes there;
     do not invent one (Learning #10 is bidirectional — don't add a stale forward-reference either).
5. **Runtime.** The integration suite is the runtime proof (activate → registered feature runs in the real
   host). An on-screen eyeball needs shared-screen consent (operator directive) — disclose if not done,
   don't silently skip (FM #24).

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

1. **`R` as a single regex vs a small parser.** A single anchored `RegExp` (§2.3) is simplest and testable;
   the executor may split it into named alternatives for readability. Either way, the L2 matrix pins behavior.
2. **`isWrongNumber` comment-strip fidelity.** The loops mostly hand the matcher a comment-stripped unquoted
   token already; the matcher's own ` #…` strip is belt-and-suspenders. Confirm against a
   `fig-width: 6  # note` fixture (should be NOT-wrong) and a quoted-with-comment (`fig-width: "6" # n`, which
   quarto rejects as a quoted string → wrong).
3. **`toc-expand` reader coverage.** `toc-expand` is reader-derived from `document-toc` → gets its bit
   automatically online; no curated annotation needed. Confirm the L1 test resolves it via the reader path
   (not a curated constant).
4. **Message wording for a per-format numeric.** `expected a number` reads fine for `format.html.fig-dpi`;
   confirm the key shown is the leaf (`fig-dpi`), not the path.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. 🐉 **`annotateScalarType` must NOT be gated on `values`.** Numeric fields have NO `values` enum, so it
   cannot live inside `annotateClosedness` (which early-returns on empty `values`, `:840`). It is a separate
   call at both choke points.
2. 🐉 **NEVER mark numeric by bare key name.** `section`/`year`/`transition`/`items` are numeric in one
   container, string in another. Per-node derivation via `numericTypeOfSchema` is the ONLY safe source (§7.3).
   A global name list is a CRITICAL FP.
3. 🐉 **Do NOT mirror the integer/float pandoc error** (`toc-depth: 2.5`). It is not the quarto-schema layer
   (§2.4). There is no `"integer"` leaf to key on. Tightening the number predicate to reject floats
   reintroduces a format-specific FP.
4. 🐉 **`R` is a SUPERSET on purpose.** `+.5`, `-.5`, trailing-underscore `1_`, and uppercase-radix `0X…`
   are quarto-rejected but left UNFLAGGED (safe FN, C1) — `R` matches them. Do NOT "fix" them into flags
   without re-grounding. (Contrast: `_1` and `10:30` are NOT safe FNs — `R` does not match them, so the
   matcher correctly FLAGS them; quarto rejects them too.)
5. 🐉 **`daemon`/`toc-expand` accept booleans too.** The numeric branch must check the six boolean spellings
   (via `acceptsBoolean`) BEFORE `R`, else `daemon: true` false-positives. `auto-slide` is NOT one of these —
   it rejects `true` (accepts only number + literal `false`), so it stays OPEN (§4.3), not number+bool.
6. 🐉 **Quoted number ⇒ flag.** `fig-width: "6"` is rejected by quarto. The shared `:35` skip does not skip a
   leading `"` (only `[]{}|>&*!`), so the numeric branch sees it and flags it — verify this is deliberate.
7. 🐉 **The §9 review is not optional.** Every value slice so far (S122–128) had a fresh lens catch a CRITICAL
   FP the author's own sweep missed (Learning #138/#141). Budget for it; fix any FP TDD before close-out.
8. 🐉 **`numericTypeOfSchema` is a STRUCTURAL sibling, not a verbatim copy.** Two arms differ from
   `closednessOfSchema` (§3.2): the bare-string arm must be SPLIT so `"number"`/`"integer"` return numeric
   BEFORE the generic `string ⇒ non-numeric` fallback (a verbatim copy of `:787-788` swallows `"number"` and
   leaves the whole feature inert — a total FN); and `maybeArrayOf[number]` recurses ⇒ marks `number-offset`
   (array form skip-guarded, like the shipped `fig-align` enum precedent).
9. 🐉 **`valueMessage` numeric arm goes FIRST, and ships in L2 (not L3).** Curated `daemon` satisfies the
   existing `:181` acceptsBoolean+values branch, so an appended arm mis-messages `daemon: banana` as "expected
   true or false". And because the three loops already consume `valueMessage`, the feature goes LIVE at the L2
   checkpoint — the message cannot wait for L3.

---

## Provenance — how this plan was grounded and hardened (Session 129)

- **Firsthand `quarto render` 1.7.33 calibration** of the representative pattern across every surface
  (top-level, per-format, nested `execute:`, cell `#|`, reveal, epub), the quoted-number and empty-value
  cases, the boolean-or-number fields, and the integer/float pandoc-vs-schema split (§2).
- **A schema resolver** over the installed `yaml-intelligence-resources.json` enumerated the 51
  numeric-bearing fields; after the plan-review reclassification of `number-offset` (§5), the marked-numeric
  set is **39** (38 bare-`number` + `number-offset`) + `daemon`/`toc-expand`, with 10 mixed left open. The
  "~37 clean-number" estimate from the two prior plans is confirmed (≈38 bare-`number`).
- **A grounding `Workflow`** (`wf_df0905c0-611`) produced the number-literal acceptance boundary `R` (60
  literal probes, verified superset) and an independent completeness/FP critic that (a) reconciled the
  51-field classification EXACTLY, (b) caught the `section` cross-container FP risk (→ §7.3 binding rule),
  (c) flagged `auto-slide` (firsthand render then showed it rejects `true` → stays OPEN, §4.3), and (d)
  confirmed NO `"integer"` leaf exists (→ single `scalarType`, §2.4). *(The per-field grounding batches in
  that workflow were starved by an args-plumbing bug — args arrived as a JSON string; the load-bearing
  boundary + critic agents ran, and the per-field pattern was covered firsthand instead.)*
- **A firsthand code read** of `SchemaField`, `closednessOfSchema`, `annotateClosedness`, the two choke
  points, `isWrongValue`, the three loops, `valueMessage`, and the completion provider established the
  per-node/one-detector/one-branch design and the §5 file:line inventory (every file:line re-verified).
- **A 3-lens adversarial review of the DRAFT plan** (`Workflow` `wf_40d923a0-fe3`: FP-safety, feasibility/
  plumbing, contract/completeness) — all three verdicts "sound and implementable", the `R`-superset claim
  independently re-confirmed over 60+ live `quarto render` probes. Its findings were folded back in: the
  `number-offset` maybeArrayOf reclassification (HIGH), the L2-is-go-live / message-in-L2 / message-FIRST
  contract fixes (3×MEDIUM), the `dpi: .inf`→`fig-width: .inf` valid-fixture + §9.2 schema-accept-vs-exit-0
  criterion (MEDIUM), the named CHANGELOG: createDebouncedDiagnosticsFeature extraction, Session 126`/`POSIT-COMPARISON:466,797`/no-ROADMAP doc-drift targets (MEDIUM),
  and the `_1`/`10:30`-are-flagged-not-safe-FN and bare-string-split corrections (2×LOW). Zero CRITICAL.
