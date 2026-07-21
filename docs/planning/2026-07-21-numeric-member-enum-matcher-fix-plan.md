# Plan — the GENERAL numeric-member-enum matcher fix (cross-surface, `isWrongValue`)

**Session:** 136-family continuation (planning session, Session 138) · **Deliverable:** THIS plan; NO code (FM #18/#19 — implementation is the next session).
**Workstream:** `SESSION_RUNNER.md` §Planning Sessions + `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`, under the project-wide strict-TDD gate.
**Origin:** the `BACKLOG.md` "Up Next" deferred follow-up filed at S136/S137 close-out — "General numeric-member-enum matcher fix (cross-surface, PRE-EXISTING) — teach `isWrongValue` a numeric-member enum accepts a NUMBER_LITERAL whose parsed value equals a member (restores validation on `version`/`aspectratio` without the coercion FP). Touches the SHARED matcher + a document-surface regression pass." Operator picked it via `AskUserQuestion` at Session 138 Phase 0 (Active empty).

---

## §0 — Decision at a glance

**The bug (two faces of one root cause).** The shared value matcher `isWrongValue` (`src/core/yaml-value-check.ts:46`) compares a closed enum by **string membership**. For a **numeric-member enum** — a closed `enum` whose members are YAML *numbers* — quarto **coerces the value numerically before matching** (`3.0` ≡ `3`, `+4` ≡ `4`, `04` ≡ `4`, `3e0` ≡ `3`). String membership gets this wrong in **both** directions:

- **`aspectratio`** (document front-matter, `enum:[43,169,1610,149,141,54,32]`) is CLOSED today, so string membership produces **live cardinal-sin FALSE POSITIVES that ship right now** — `aspectratio: 169.0`, `+169`, `0169` (and more coercible forms) are flagged with a red Error squiggle though `quarto render` 1.7.33 accepts them (exit 0). Grounded firsthand through the real shipped code path (§2.4).
- **`google-analytics.version`** (`_quarto.yml` project depth-2, under `website:` and `book:`, `enum:[3,4]`) was **defused to a safe false-negative** by S137's `openNumericMemberEnum` guard (`yaml-schema.ts:1319`), which unsets `valuesClosed` on any numeric-member enum → the matcher skips it → **no validation at all** (`version: 5`, a genuine error, is silently unflagged).

**The fix.** Teach the matcher numeric-member-enum semantics once, in the SHARED core, so BOTH surfaces are corrected by construction:

> A numeric-member enum accepts an **unquoted** YAML number literal whose **parsed numeric value equals a member**; it flags everything else — a quoted string (`"3"` → quarto exit 1), a non-number (`banana`), and an out-of-set number (`5`, `3.5`).

Because the detection is annotated at `annotateClosedness` (called at all three annotation sites — top-level `toField`, `objectChildren`, and the project reader, §2.6) and consumed at the one `isWrongValue`, the fix reaches every surface (document / cell / project depth-1 / depth-2) automatically, and it lets us **delete** the S137 `openNumericMemberEnum` guard (net simplification — `version` stays CLOSED and is now validated correctly).

**Design (recommended, §3):** annotate a new `SchemaField.numericMemberEnum` bit — set ONLY when a closed enum's members are all JS *numbers* (distinguishable from a JS *string* enum `["3","4"]` at annotation time, which the stringified `field.values` cannot tell apart) — and add a numeric-equality branch to `isWrongValue`. Delete `openNumericMemberEnum` + its now-orphaned `NUMERIC_LITERAL`.

**The surface (grounded, exhaustive — §2.2):** exactly **2 distinct schema positions** (4 container reachabilities), `aspectratio` (document — top-level AND nested `format.beamer`) + `google-analytics.version` (project, under both `website:` and `book:`). No other all-numeric closed enum is reachable anywhere in the 1.7.33 schema; the one mixed numeric/string enum (`brand-font-weight`) is unreachable on any validated surface and, being mixed, can never receive the fix's bit (§2.5).

**The slice (§4):** ONE strict-TDD vertical slice, 4 checkpoint-committed layers — **L1** matcher numeric branch gated on the new bit [INERT] → **L2** the annotation (this makes the DOCUMENT-surface `aspectratio` go live) → **L3** delete `openNumericMemberEnum` (this makes the PROJECT-surface `version` go live) + fixtures + integration → **L4** MANDATORY §9 adversarial review, the shared-matcher numeric branch the primary FP target.

**Net product effect:** kills ≥3 live shipped FPs on `aspectratio`, tightens a quoted-form FN on `aspectratio`, and restores lost validation on `version` — all under one small, cross-surface, FN-safe change.

---

## §1 — Context

### 1.1 Where this sits in the value-validation family

The value-validation family has shipped six document-surface slices (Phases 1–5, S123–S132) and two `_quarto.yml` project-config slices (depth-1 S135, depth-2 S137). Throughout, the ONE hard product rule has been **false-negative-only**: never flag a value `quarto render` accepts (`yaml-value-check.ts:8`). The single guard against the cardinal-sin false positive is `SchemaField.valuesClosed` — a non-empty `values` list is NOT proof the set is closed (`yaml-schema.ts:64`).

The numeric-member-enum defect is the family's **first cross-surface correctness bug** rather than a new coverage slice. It was discovered in two steps:

- **S136 (depth-2 planning):** the mandatory adversarial plan-review Workflow caught a HIGH — `google-analytics.version: 3.0` ≡ `3` renders exit 0, yet the string matcher flags `3.0`. The plan's fix was a **local** guard (`openNumericMemberEnum`) that simply opens numeric-member enums on the depth-2 project reader, trading the FP for a safe FN. The **general** fix (validate by parsed value) was explicitly deferred as a cross-surface item touching the shared matcher.
- **S137 (depth-2 implementation)** shipped that local guard and re-filed the general fix in `BACKLOG.md`, noting it "restores validation on `version`/`aspectratio`" and "touches the SHARED matcher + a document-surface regression pass."

This plan is that deferred general fix.

### 1.2 Why it is worth doing now (not just tidiness)

S137's local guard covered the *project* surface only (its `openNumericMemberEnum` is scoped there deliberately — `yaml-schema.ts:1313`). The identical latent property on the *document* surface (`aspectratio`) was left **unfixed and CLOSED**, so it is a **live cardinal-sin FP shipping today** (§2.4). This is not a hypothetical — a user who writes `aspectratio: 169.0` (a perfectly valid beamer aspect ratio) in `.qmd` front matter currently gets a spurious red Error squiggle. Fixing it is a genuine correctness win, not a refactor.

### 1.3 Why it is a planning session, not a direct implementation

- The change is to the **shared** `isWrongValue` matcher, consumed by four call sites across two features (§5) — a cross-module blast radius. SAFEGUARDS §Blast Radius Limits: "Never refactor across module boundaries without plan mode."
- Its entire reason for deferral is the numeric-**coercion cardinal-sin FP** — the exact failure class the family plans-then-implements-with-adversarial-review for (S134→S135, S136→S137).
- There is **no pre-declared gate-(a) contract** for this item, so a vertical-slice implementation is barred outright (`SESSION_RUNNER.md` §Vertical Slice Sessions gate (a)). Producing that contract IS this plan.

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 / the actual parser)

*All facts below were grounded firsthand this session with esbuild-bundled harnesses over the REAL installed schema (`/Applications/quarto/share/editor/tools/yaml/yaml-intelligence-resources.json`, via the shipped `parseSchemaIndex`) and ~30 `quarto render` 1.7.33 probes. Harness sources are in `scratchpad/` (uncommitted — verification artifacts, not code): `numenum-scan.ts`, `verify-iwv.ts`, `confirm-live-fp.ts`, `mixed-scan.ts`, `numenum-ground/`.*

### 2.1 What a "numeric-member enum" is

A `SchemaField` with `valuesClosed === true` and a non-empty `values` list whose members are all numeric literals — i.e. a closed `enum` whose raw schema members are YAML **numbers**. The two in the schema:

| Position | Surface | Raw schema (grounded) | `field.values` |
|---|---|---|---|
| `aspectratio` | document front-matter, top-level | `document-options.yml:233` → `schema: {enum: [43, 169, 1610, 149, 141, 54, 32]}` | `["43","169","1610","149","141","54","32"]` |
| `google-analytics.version` | `_quarto.yml` project, depth-2 (under `website:` and `book:`) | `definitions.yml:730` → `version: {enum: [3, 4]}` (inside `google-analytics: anyOf[string, object]`) | `["3","4"]` |

Both raw enums list JS **numbers** (`43`, `3`), not strings (`"43"`, `"3"`). This distinction is preserved in the raw schema and is the enabler for the recommended design (§3).

### 2.2 The surface is exhaustively 2 positions (`numenum-scan.ts`)

A recursive scan (depth ≤ 3) for every all-numeric closed enum across **cell options, document front-matter, and all three project containers** returns exactly:

```
fm.aspectratio                            valuesClosed=true       values=[43,169,1610,149,141,54,32]
proj:website.google-analytics.version     valuesClosed=undefined  values=[3,4]   (already opened by the S137 guard)
proj:book.google-analytics.version        valuesClosed=undefined  values=[3,4]   (book inherits google-analytics via super base-website)
```

`version` shows `valuesClosed=undefined` because `openNumericMemberEnum` already ran inside `projectFields`. There are **no other** all-numeric closed enums anywhere. `website` and `book` are the same schema position reached via two containers (book's `super: base-website`). `aspectratio` is likewise ONE position with **two reachabilities** — top-level front-matter AND nested `format.<fmt>.aspectratio` (beamer only; the SAME field object, §2.4). A more exhaustive walk (per-engine cell options, all 65 per-format option sets, nested containers, project depth ≤3 — grounded this session via the §9 review's `lens2-scan`) confirms exactly **4 all-numeric-value hits**: `fm.aspectratio`, `fm.format.beamer.aspectratio`, `website.google-analytics.version`, `book.google-analytics.version`. So the fix has **2 distinct positions, 4 container reachabilities** (aspectratio ×2, version ×2).

### 2.3 Quarto's coercion accept-set — IDENTICAL for both positions (`numenum-ground/`)

`google-analytics.version` (members 3, 4), rendered in a real website `_quarto.yml`:

```
version: 3      -> exit 0            version: 5      -> exit 1 SCHEMA
version: 4      -> exit 0            version: 3.5    -> exit 1 SCHEMA
version: 3.0    -> exit 0 (coerced)  version: banana -> exit 1 SCHEMA
version: 4.0    -> exit 0 (coerced)  version: "3"    -> exit 1 SCHEMA  (quoted string REJECTED)
version: +4     -> exit 0 (coerced)  version: "4"    -> exit 1 SCHEMA  (quoted string REJECTED)
version: 04     -> exit 0 (coerced)
version: 3e0    -> exit 0 (coerced)
```

`aspectratio` (members 43, 169, 1610, …), rendered under `format: beamer` (system LaTeX present):

```
aspectratio: 169    -> exit 0            aspectratio: 5      -> exit 1 SCHEMA
aspectratio: 43     -> exit 0            aspectratio: banana -> exit 1 SCHEMA
aspectratio: 169.0  -> exit 0 (coerced)  aspectratio: "169"  -> exit 1 SCHEMA  (quoted string REJECTED)
aspectratio: 43.0   -> exit 0 (coerced)
aspectratio: +169   -> exit 0 (coerced)
aspectratio: 0169   -> exit 0 (coerced)
```

**The rule, grounded and uniform:** a numeric-member enum accepts an **unquoted** YAML number literal whose **numeric value equals a member**, and rejects (exit 1 at the schema layer) an out-of-set number, a non-number, **and a quoted string** — even one whose content matches a member (`"3"`, `"169"`). The quoted-rejection is the sharp edge: the fix must NOT accept quoted forms (a naive `unquote`-then-compare would).

### 2.4 The currently-shipped defect (`confirm-live-fp.ts`, `verify-iwv.ts`)

Running the **real shipped `isWrongValue`** on the **real `aspectratio` field** pulled from the schema:

```
token     quarto verdict     current isWrongValue    correctness
169       exit 0             ok                      ✓
169.0     exit 0 (coerced)   FLAG                    ✗ cardinal-sin FALSE POSITIVE (ships today)
+169      exit 0 (coerced)   FLAG                    ✗ cardinal-sin FALSE POSITIVE (ships today)
0169      exit 0 (coerced)   FLAG                    ✗ cardinal-sin FALSE POSITIVE (ships today)
"169"     exit 1 (reject)    ok                      ✗ safe false NEGATIVE
5         exit 1 (reject)    FLAG                    ✓
banana    exit 1 (reject)    FLAG                    ✓
```

- **Document surface (`aspectratio`, CLOSED, ungued):** ≥3 live cardinal-sin FPs on coercible forms (`169.0`/`+169`/`0169`, and the underscore forms `4_3`/`1_610`/`16_10`, §7.3), plus a safe FN on quoted forms. Reachable in a real host via **two** paths, both grounded live this session: (i) the top-level front-matter path `yaml-value-diagnostics.ts:119-122` (`frontMatterKeys([])` returns `aspectratio`), and (ii) the nested per-format path `yaml-value-diagnostics.ts:150-152` — `findNestedFrontMatterValueLines` emits `parentPath:["format","beamer"]`, and `frontMatterKeys(["format","beamer"]).find(...)` resolves the SAME `aspectratio` field object, so the current shipped `isWrongValue("169.0", …)` returns `true` there too (grounded: `format:\n  beamer:\n    aspectratio: 169.0` renders exit 0, yet is flagged). The fix corrects both paths at once (one field, one matcher).
- **Project surface (`version`, OPENED by S137 guard):** no FP, but no validation — `version: 5` is a lost-coverage safe FN.

### 2.5 No mixed-member enum exists — deleting the guard is safe (`mixed-scan.ts`)

`openNumericMemberEnum` opens any grandchild whose members include **`.some()`** numeric literal — so a *mixed* enum (some numeric, some string members) would also have been opened, and deleting the guard would re-CLOSE it. **One mixed enum does exist in the raw schema — `brand-font-weight` (`definitions.yml`, `enum:[100,200,…,900,"thin",…,"black"]`) — but it is UNREACHABLE on any matcher-validated surface** (grounded via the §9 review's raw-schema + real-index walk): it lives at `brand.*.weight` (depth-3+), and `objectChildren` computes only grandchildren (depth-2), so it is never a project grandchild the guard could open, and it never appears in `frontMatterKeys`/`cellOptions`/`projectFields` (a reachability walk over the real index returns zero `brand-font-weight` hits — top-level `brand` expands only to `light`/`dark`). And being *mixed*, it can never receive the fix's all-JS-number `numericMemberEnum` bit. So the true invariant is **reachability + mixed⇒no-bit**, NOT "no mixed enum exists": deleting the guard re-closes ONLY `version` (the sole reachable all-numeric enum), which the fix handles correctly, and the mixed enum poses no FP through the guard OR the new annotation. State the real invariant so it does not silently break if `brand` nesting or `objectChildren` depth ever changes. (This also means the guard's `.some()` vs the fix's `.every()`-numeric never diverge on any *reachable* field.)

### 2.6 The annotation is genuinely shared (`yaml-schema.ts`)

`annotateClosedness` (`:905`) is the single function that stamps `valuesClosed`/`acceptsBoolean`, called at **all three** field-construction sites:

```
:1276  (project depth-1 field build)     via projectFieldsFromProperties
:1403  objectChildren  (grandchildren)   → google-analytics.version
:1444  toField         (top-level keys)  → aspectratio
```

Hooking numeric-member detection into `annotateClosedness` (or `closednessOfSchema`, its `:841` helper, which already inspects raw member types via `s.enum.some(v => typeof v === "boolean")`, `:865`) reaches every surface with a single edit. This is why the fix is cross-surface *for free*.

### 2.7 `valueMessage` needs no change

`valueMessage` (`:144`) for a closed enum already says `expected one of: 3, 4` (for `version`) / `expected one of: 43, 169, 1610, …` (for `aspectratio`). That message is fact-correct for every reject case a numeric-member enum produces (out-of-set number, non-number, quoted form). No new message arm is required — confirm with a unit assertion but expect zero change.

---

## §3 — Decision (architecture)

### 3.1 Recommended: annotate `numericMemberEnum`, add a matcher branch, delete the S137 guard

**A. `SchemaField.numericMemberEnum?: boolean`** (new bit, `yaml-schema.ts` interface near `:78`). Set **only** when the field is a closed enum whose members are all JS *numbers*. Semantics documented like its siblings (`valuesClosed`/`scalarType`), with the inverted-risk note: it *tightens* validation, so an over-eager set is an FP risk — set it precisely.

**B. Detection in the annotator** (extend `closednessOfSchema` `:841` to also report `numericMembers`, or a focused sibling `numericMemberEnumOfSchema` mirroring its arm order + depth guard). The predicate: the field is closed AND every reachable `enum` member across all arms is `typeof === "number"` (no string/boolean member, no non-enum content). For `aspectratio`/`version` (bare enums, JS numbers) this is a direct read of `s.enum`. `annotateClosedness` sets `field.numericMemberEnum = true` alongside `field.valuesClosed = true`. Because it reads the **raw JS types**, it distinguishes `enum:[3,4]` (numbers → set the bit) from a hypothetical `enum:["3","4"]` (strings → do NOT set → keep string membership) — a distinction `field.values` (stringified by `scalarToYaml`, `:786`) has already lost.

**C. The matcher branch in `isWrongValue`** (`yaml-value-check.ts:46`), placed AFTER the `valuesClosed`/non-empty precondition (`:63`) and taken when `field.numericMemberEnum === true`:

1. quoted token (leading `"`/`'`) → **flag** (quarto rejects `"3"`/`"169"`, §2.3).
2. strip an unquoted trailing ` #…` comment, trim.
3. token not a number literal (does not match `NUMBER_LITERAL`) → **flag** (`banana`).
4. parse to a number with **`Number()`**; if the result is **`NaN` → do NOT flag** (safe FN); else if it is not numerically equal to any member (members parsed once, also via `Number()`) → **flag** (`5`, `3.5`).
5. otherwise → **ok** (`3`, `3.0`, `+4`, `04`, `3e0`, `169.0`, `0169`).

⚠ **The `NaN`-safe step-4 clause and the `Number()` pin are load-bearing, not optional prose (the §9-review HIGH, §7.3).** `NUMBER_LITERAL` (`:33`) matches YAML digit-group underscores (`4_3`, `1_610`, `16_10`), which `quarto render` ACCEPTS and coerces to a member (grounded exit-0, §2.3) — but `Number("4_3")` is `NaN` in JS. Without the `NaN → don't-flag` guard, step 4 flags `4_3` (NaN ≠ 43) = a **cardinal-sin FALSE POSITIVE** on a value quarto accepts. And the parser MUST be `Number()`, never `parseFloat`/`parseInt`: `parseFloat("0x2b")` is `0` (would FP hex `0x2b`, which quarto accepts as 43). `Number()` is the only JS parser that matches quarto's numeric coercion (returns a correct finite value for `0x2b`/`0o53`/`003`/`+43`/`4.3e1`, and `NaN` for `4_3`/`.inf`/`.nan`, all of which the guard then handles FN-safely). Reuse the anchored `NUMBER_LITERAL` (`:33`, a verified strict-superset of quarto's number set) for step 3; ground the remaining exotic forms as a §10 residual — every one resolves FN-safe via the `NaN` guard (§7.3).

**D. Delete `openNumericMemberEnum` (`:1319`) + its call (`:1289`) + the now-orphaned `NUMERIC_LITERAL` (`:1299`).** With the matcher handling numeric-member enums correctly, the project reader no longer needs to open them — `version` keeps `valuesClosed = true` (and now also `numericMemberEnum = true`) and is validated correctly. This is a net deletion.

**Why this shape.** One annotation edit + one matcher branch + one deletion. The annotation is at the shared choke point (§2.6), so document and project surfaces are corrected together with no per-surface code. The bit is precise (JS-type-keyed), so it is forward-compat-safe against a future all-numeric *string* enum (§6, alternative A'). And it *removes* code (the S137 guard), leaving the reader simpler than before.

### 3.2 Interface contract (the one new/changed surface)

| Symbol | Before | After |
|---|---|---|
| `SchemaField.numericMemberEnum?: boolean` | — (absent) | set `true` iff closed enum, all members JS numbers |
| `isWrongValue(raw, field)` | closed enum → string membership | if `numericMemberEnum`: numeric-equality branch (§3.1 C); else unchanged |
| `annotateClosedness(field, schema, defs)` | sets `valuesClosed`/`acceptsBoolean` | additionally sets `numericMemberEnum` |
| `openNumericMemberEnum`, `NUMERIC_LITERAL` (`yaml-schema.ts`) | present | **deleted** |
| `valueMessage` | — | **unchanged** (§2.7) |

---

## §4 — Scope: the vertical slice (ONE implementation session), gate-(a) contract

**Pre-declared layer set (this is the gate-(a) contract the implementing session re-verifies at Orient).** Four checkpoint-committed layers, ≤5 files per commit, full `check-types` + unit (+ integration where noted) matrix at each boundary. Strict TDD: one RED at a real assertion, for the right reason, before each GREEN.

### L1 — the matcher numeric-member branch [INERT]
**Do:** add `SchemaField.numericMemberEnum?: boolean` (interface + doc comment only — nothing sets it yet) and the numeric-equality branch in `isWrongValue` gated on `field.numericMemberEnum === true`.
**INERT because:** no annotation sets the bit yet (grep-provable: the only writer arrives in L2), so no real field takes the branch; every existing test is unchanged.
**Tests:** `test/unit/yaml-value-check.test.ts` — a new `describe` driving `isWrongValue` with **synthetic** numeric-member fields, asserting the full grounded truth table (§2.3):
- a `version`-shaped field `{numericMemberEnum:true, valuesClosed:true, values:["3","4"]}`: `3`/`4`/`3.0`/`+4`/`04`/`3e0` → ok; `5`/`3.5`/`banana` → flag; `"3"`/`"4"` → flag; empty/flow/anchor still skipped.
- an `aspectratio`-shaped field `{…, values:["43","169","1610","149","141","54","32"]}` covering the **NaN-underscore guard**: `43`/`169`/`169.0`/`+169`/`0169` → ok; **`4_3`/`1_610`/`16_10` → ok** (member-valued digit-group underscores — quarto coerces them exit-0, §7.3; this is the row that exercises the `NaN` guard, and it MUST fail RED against a naive `Number()!==member` branch); `5`/`banana`/`"169"` → flag.
RED first (bit unread → `3.0` still flags AND `4_3` flags), then GREEN (both fixed by the branch + its `NaN` guard).
**DONE:** `check-types` + unit green; the branch shown RED before GREEN; grep confirms no annotator sets the bit (inertness).

### L2 — the annotation (this makes DOCUMENT-surface `aspectratio` go live)
**Do:** extend `closednessOfSchema`/`annotateClosedness` to set `numericMemberEnum` when a closed enum's members are all JS numbers.
**GO-LIVE scope:** the top-level `toField` (`:1444`) path now stamps the bit on `aspectratio` (which is already `valuesClosed=true`), so the DOCUMENT value feature immediately numeric-compares it. `version` is UNAFFECTED this layer — `openNumericMemberEnum` still unsets its `valuesClosed`, so its matcher precondition fails and the bit is inert there.
**Tests:**
- `test/unit/yaml-schema-index.test.ts` — the real `aspectratio` field (or a fixture enum with JS-number members) gets `numericMemberEnum=true`; a JS-*string* enum fixture (`["3","4"]`) does NOT (the forward-compat guard); a mixed/string enum does not.
- Document-surface regression (unit-level over the real field or an integration row, §9): `aspectratio: 169.0`/`+169`/`0169` no longer flagged; `aspectratio: "169"` NOW flagged; `aspectratio: 5`/`banana` still flagged. RED before the annotation lands.
**DONE:** `check-types` + unit green; the aspectratio FP regression shown RED→GREEN; the JS-string-enum negative case proves the bit is type-keyed, not value-keyed.

### L3 — delete the S137 guard (this makes PROJECT-surface `version` go live) + fixtures + integration
**Do:** delete `openNumericMemberEnum` (`:1319`), its call in `projectFieldsFromProperties` (`:1289`), and the orphaned `NUMERIC_LITERAL` (`:1299`). Now `version` keeps `valuesClosed=true` + gains `numericMemberEnum=true` → the matcher validates it.
**Fixtures (re-grounded firsthand):**
- `test/fixtures/yaml-project-depth2-value/invalid/_quarto.yml` — add `google-analytics.version: 5` (grounded exit-1 SCHEMA); keep the fixture exit-1 overall.
- `test/fixtures/yaml-project-depth2-value/valid/_quarto.yml` — the existing `version: 3.0` (line 17) STAYS valid (coerced, exit 0); optionally add `+4`/`04` valid forms.
- A document-surface fixture for `aspectratio` covering BOTH reachabilities (§2.4): a top-level `aspectratio: 169.0` AND a nested `format:\n  beamer:\n    aspectratio: 169.0` coercible-valid row (each exit-0), plus an out-of-set (`5`) / quoted (`"169"`) / **member-valued underscore (`4_3`, must-NOT-flag)** row set — each render-grounded, under `test/fixtures/yaml-value-diagnostics/`.
**Tests:** integration `describe`s in `test/integration/suite/yaml-project-value-diagnostics.test.ts` (version) and `test/integration/suite/yaml-value-diagnostics.test.ts` (aspectratio) asserting the exact spans flag/clear against the REAL installed schema. RED: the `version: 5` assertion fails before the guard deletion (version still open).
**DONE:** `check-types` + unit + integration green; every changed fixture value re-grounded against `quarto render` 1.7.33 (invalid exit-1 SCHEMA, valid exit-0); a unit regression asserts no depth-2 numeric-member field is left spuriously open.

### L4 — MANDATORY §9 adversarial review
**Do:** an independent, `quarto render`-verified adversarial panel (Workflow), primary target = **the shared-matcher numeric branch as a new FP surface**. Lenses (at least): (1) **fp-cardinal** — does the numeric branch flag ANY value quarto accepts, across every numeric form and both positions (incl. hex/`.inf`/`.nan`/underscored/exponent/leading-zero, and the quoted-vs-unquoted boundary)? (2) **guard-deletion** — does removing `openNumericMemberEnum` re-expose the depth-2 coercion FP it was added for, on ANY grandchild (prove: the matcher now covers it; §2.5 proves no other field is affected)? (3) **type-keying soundness** — can a JS-string enum ever get `numericMemberEnum`? can an `anyOf`/`ref`/`maybeArrayOf`-wrapped numeric enum be mis-annotated? (4) **doc-drift** — `docs/POSIT-COMPARISON.md`, `BACKLOG.md`, `PROJECT_LEARNINGS.md`. Re-verify EVERY finding firsthand before folding (family rule — the panel proposes, the author grounds).
**DONE:** panel run; all findings firsthand-re-verified; any real defect fixed TDD with the fixture/test that would have caught it; the review recorded as a verification artifact (not committed code).

**Slice-test (FM #26):** all four layers are ONE capability — "numeric-member enums validate correctly, cross-surface" — mapped to this single pre-declared layer set. Not two capabilities; not a plan + code. `aspectratio` and `version` are the SAME behavior on two reachabilities of one shared matcher, not two features.

**Recoverability:** each layer is an independent, reversible checkpoint commit. L1 is inert; L2 corrects the document surface; L3 corrects the project surface + removes the guard. A crash mid-slice strands one layer, not the set.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped this session)

**Changed (write):**
- `src/core/yaml-schema.ts` — `SchemaField` interface add `numericMemberEnum?` (near `:78`); `closednessOfSchema` (`:841`) / `annotateClosedness` (`:905`) EXTEND to set it; **DELETE** `openNumericMemberEnum` (`:1319`), its call in `projectFieldsFromProperties` (`:1289`), and `NUMERIC_LITERAL` (`:1299`). UNCHANGED: `valuesOfSchema:762`, `scalarToYaml:735`, `numericTypeOfSchema:942`, `annotateScalarType:1003`, `objectChildren:1380`, `toField:1427`, all `super`/resolveRef machinery.
- `src/core/yaml-value-check.ts` — `isWrongValue` (`:46`) ADD the numeric-member branch after `:63`; reuse `NUMBER_LITERAL:33` + `unquote:124`. UNCHANGED: `isWrongNumber:100`, `valueMessage:144` (§2.7), `BOOLEAN_SPELLINGS:19`.

**Consumers of `isWrongValue` (UNCHANGED — they gain correct behavior for free):**
- `src/features/yaml-value-diagnostics.ts:92` (cell), `:122` (top-level fm — the `aspectratio` path), `:152` (nested).
- `src/features/yaml-project-value-diagnostics.ts:115` (project value — the `version` path).

**Tests (write):**
- `test/unit/yaml-value-check.test.ts` (matcher branch — synthetic fields, the truth table).
- `test/unit/yaml-schema-index.test.ts` (annotation — real `aspectratio`/`version`-shaped fields get the bit; JS-string enum does NOT; guard-deletion leaves `version` closed).
- `test/integration/suite/yaml-project-value-diagnostics.test.ts` (`version: 5` flagged, `3.0` clean).
- `test/integration/suite/yaml-value-diagnostics.test.ts` (`aspectratio` coercible clean, out-of-set/quoted flagged).
- `test/fixtures/yaml-project-depth2-value/{invalid,valid}/_quarto.yml` (add `version` rows); a document `aspectratio` fixture under `test/fixtures/yaml-value-diagnostics/`.

**Close-out docs (reconcile — the change makes them stale, Learning #10):** `docs/POSIT-COMPARISON.md` (value-validation coverage — numeric-member enums now validated on both surfaces), `BACKLOG.md` (flip the item `[x]` SHIPPED; the S137 deferred sub-bullet resolved), `PROJECT_LEARNINGS.md` (new entry), `CHANGELOG.md`, `HANDOFFS.md`, `SESSION_NOTES.md`.

---

## §6 — Alternatives considered (honest)

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **A' — detect-in-matcher on `field.values.every(NUMBER_LITERAL)`** (no SchemaField bit, no annotator change; ~10 lines in the pure matcher) | Smallest diff; entirely in one pure function; also deletes the S137 guard | Keyed on the **stringified** `values` (`["3","4"]`), so it CANNOT distinguish a JS-number enum `[3,4]` from a JS-string enum `["3","4"]`. No such string-enum exists in 1.7.33 (§2.5), but a future one would be **wrongly coerced** — flagging quoted `"3"` which a string-enum ACCEPTS = a cardinal-sin FP. Trades forward-compat precision for a few lines. | **Rejected** — the family's cardinal-sin discipline favours the type-keyed bit (§3). Documented because it is the tempting minimal fix; the delta is the annotation edit only. |
| **C — keep `openNumericMemberEnum`, add a symmetric `openNumericMemberEnum` to the document surface** (extend the S137 guard to also open `aspectratio`) | Removes the live `aspectratio` FP with a proven pattern | Restores NO validation (`version:5`/`aspectratio:5` become safe FNs — coverage stays lost); duplicates the guard onto a second surface instead of fixing the root; still leaves the safe-FN-on-quoted-form gap. | **Rejected** — defuses the FP but abandons the coverage the BACKLOG item explicitly asks to *restore*. |
| **D — do nothing** | Zero risk | Ships ≥3 live cardinal-sin FPs on `aspectratio` indefinitely; `version` never validated. | **Rejected.** |
| **Widen the numeric branch to MIXED enums** (some numeric, some string members) | Would generalize | No mixed enum exists (§2.5) — pure speculation, and mixed coercion semantics are ungrounded. Astronaut architecture. | **Out of scope** — a safe FN today; revisit only if the schema grows one. |

---

## §7 — Failure-mode analysis (the safety story)

The whole feature's product rule is **false-negative-only**. Each way the change could produce a cardinal-sin FP, and why it does not:

- **§7.1 Over-eager annotation.** `numericMemberEnum` is set only when the enum is closed AND all members are JS numbers. A `string:{completions}` (open), a mixed enum, a string-enum, a numeric-*typed* field (`scalarType:"number"`, no enum) — none qualify. The bit rides `valuesClosed`, so the matcher precondition still gates it.
- **§7.2 The quoted-form edge.** Quarto rejects `"3"`/`"169"` (§2.3) — the branch flags quoted tokens FIRST, matching quarto. (Contrast: the string-membership path would `unquote` and ACCEPT `"3"` — a current safe FN the fix corrects to a true flag.)
- **§7.3 Exotic numeric forms** (hex `0x3`, octal, `.inf`, `.nan`, `1_000`, exponent, leading-zero). These resolve **FN-safe by construction**: step 4 flags a token only when it IS a number literal whose parsed value is out of set. If parsing is uncertain (e.g. `Number(".inf")` → NaN), treat the token as *not confidently out-of-set* and **do not flag** (safe FN) — never flag an ambiguous form. The first RED slice grounds the handful of exotic forms against `quarto render` for the two real positions; anything ungrounded stays unflagged. (Guarded target of the L4 fp-cardinal lens.)
- **§7.4 Guard deletion.** Removing `openNumericMemberEnum` re-closes only `version` — the sole *reachable* all-numeric enum (§2.5; the one mixed enum `brand-font-weight` is unreachable AND mixed⇒no-bit), which the branch validates correctly. No other grandchild changes closedness. A unit regression asserts this.
- **§7.5 Cross-surface blast radius.** The four `isWrongValue` consumers (§5) are unchanged; they only ever benefit. No feature registration, no lifecycle, no debounce touched — this is a pure-core behavior change, not a runtime-wiring change (so Phase 3E's runtime-smoke concern is satisfied by integration, not new registration).
- **§7.6 Message correctness.** `valueMessage` unchanged and fact-correct for every reject case (§2.7).

---

## §8 — Impact analysis

| Surface | Before | After |
|---|---|---|
| Document `aspectratio` (front-matter) | CLOSED; string membership → ≥3 live FPs on coercible forms + FN on quoted | CLOSED + numeric-member → coercible forms accepted, quoted flagged, out-of-set flagged — matches quarto |
| Project `version` (website/book, depth-2) | OPENED by guard → no validation | CLOSED + numeric-member → `5` flagged, `3.0` accepted — validation restored |
| Cell options / other document keys | unchanged | unchanged (no numeric-member enum there — §2.2) |
| `openNumericMemberEnum` guard | present | deleted (net simplification) |
| Every other `isWrongValue` caller | unchanged | unchanged |

**Explicit non-goals (unchanged):** the general document-nesting cliff, `.ipynb` values, depth-3+/sequence-form project values, `execute:`/`format:` in `_quarto.yml`, the KEY-enumerator scanFlow gap — all remain the family's separately-filed deferrals.

---

## §9 — Verification plan (executor)

- **Per layer:** `npm run check-types` + `npm test` (unit) at every boundary; `npm run test:integration` at L3 (and L2 if the aspectratio regression is written as an integration test).
- **Firsthand grounding (MANDATORY, author — not delegated):** re-run the §2 harnesses after each change; render-ground every fixture value (`quarto render`: invalid exit-1 SCHEMA, valid exit-0); A/B the real `isWrongValue` over the real `aspectratio`/`version` fields against the §2.3 truth table.
- **L4 adversarial review (MANDATORY):** independent `quarto render`-verified Workflow, fp-cardinal the primary lens (§4 L4). The panel PROPOSES; the author RE-GROUNDS every finding firsthand before folding (Learnings #148/#150 — a prior clean review and the author's own sweep are not substitutes for a fresh independent panel; S136's panel caught the HIGH that started this whole thread).
- **Runtime smoke (Phase 3E):** satisfied by the L3 integration `describe`s exercising the real extension host against the real installed schema (stronger than a manual F5, FM #24) — no new feature registration is introduced, so there is no activation/dispatch change to F5-verify.

---

## §10 — Residual open questions (low-risk; settle in the first RED slice with grounding)

1. **Exotic numeric forms.** Ground `version`/`aspectratio` against `0x…`, `0o…`, `.inf`, `.nan`, a bare leading-`.` (`.5`), and — crucially — **member-VALUED digit-group underscores** (`aspectratio: 4_3`/`1_610`/`16_10`, all grounded exit-0 → must NOT flag). The §10/L1 probe MUST be a *member-valued* underscore, NOT the out-of-set `1_0` (=10) which renders reject and would hide the `NaN`-guard bug (the §9-review HIGH). Confirm each form is accepted-and-coerced (→ must not flag) or rejected (→ safe to flag), and encode the FN-safe `NaN → don't-flag` default (§3.1 C step 4). Decision recorded as unit rows.
2. **Where the detection lives** — extend `closednessOfSchema` to return a third field vs a focused `numericMemberEnumOfSchema` sibling. Sibling is cleaner if the `anyOf` fold complicates the existing two-field return; decide at L2 by writing the annotation test first.
3. **Document `aspectratio` regression as unit-over-real-field vs integration.** Prefer at least one integration row (a real host proving the shipped FP is gone), plus fast unit rows over the real field. Both are cheap.
4. **`+4`/`04`/`3e0` in the VALID project fixture** — optional; the truth table is already unit-grounded. Add one coercible-valid row for defense-in-depth if it stays exit-0 (grounded).

None of these are load-bearing on the architecture; each is a small grounded decision inside a RED slice.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. 🔑 **Quarto REJECTS the quoted form** (`version: "3"`, `aspectratio: "169"` → exit 1), even though the content matches a member. The numeric branch must flag quoted tokens FIRST. A naive `unquote`-then-numeric-compare would wrongly accept `"3"` — a safe FN, but the fix's whole point is to be exact here (it also fixes the current quoted-form FN).
2. 🔑 **Key on JS member TYPE, not stringified value.** `field.values` is `["3","4"]` for BOTH a number-enum and a hypothetical string-enum — indistinguishable. Detect at annotation time via the raw `s.enum` member types (`typeof v === "number"`), exactly as `closednessOfSchema:865` already does for booleans. This is the forward-compat guard against a future all-numeric string-enum FP (§6 A').
3. 🔑 **The annotation is the shared choke point** (`annotateClosedness:905`, called at `:1276/:1403/:1444`). Set the bit there and BOTH `aspectratio` (top-level) and `version` (grandchild) get it — do NOT special-case per surface.
4. 🔑 **Delete `openNumericMemberEnum`, don't extend it.** The S137 guard (`:1319`) was the *local* stopgap; the matcher branch supersedes it. Deleting it is what RESTORES `version` validation. `NUMERIC_LITERAL:1299` is then orphaned — delete it too (grep first: it has no other user).
5. 🔑 **`aspectratio` is a LIVE shipped FP via TWO paths, not a hypothetical** (§2.4) — `169.0`/`+169`/`0169` (and underscore forms `4_3`/`1_610`, dragon 11) flagged today though quarto accepts, reachable BOTH at top-level front-matter (`:122`) AND nested `format.beamer.aspectratio` (`:152`; the SAME field object). The L2/L3 regression must show these go FLAG→ok (RED→GREEN) and cover BOTH reachabilities (§4 L3).
6. 🔑 **No mixed-member enum is REACHABLE** (§2.5) — the one mixed enum (`brand-font-weight`) lives at depth-3+ under `brand`, never computed by `objectChildren` (grandchildren only), so the guard's `.some()` never opened anything but `version`; deleting it re-closes only `version`. A future *reachable* mixed enum is a safe FN anyway (the bit requires ALL-numeric), not an FP.
7. 🔑 **`version` reaches via BOTH `website:` and `book:`** (book's `super: base-website`) — one schema position, two container reachabilities. Fixture-cover at least one; the matcher is path-agnostic so both are fixed together.
8. 🔑 **`valueMessage` needs no change** (§2.7) — assert it, expect zero diff.
9. 🔑 **This is a pure-core change** — no new feature registration, no `extension.ts` edit, no debounce/lifecycle. Integration tests (not F5) are the runtime smoke.
10. 🔑 **`BACKLOG:NNN` is a LINE NUMBER**, not an item ID.
11. 🔑 **The NaN-underscore trap (the §9-review HIGH, §3.1 C / §7.3).** `NUMBER_LITERAL` matches YAML digit-group underscores (`4_3`/`1_610`/`16_10`); quarto coerces them to a member (exit 0), but `Number("4_3")` is `NaN` — so a naive `Number()!==member → flag` branch ships a cardinal-sin FP. Parse with `Number()` (NEVER `parseFloat`/`parseInt` — `parseFloat("0x2b")`=0 would itself FP hex), and treat `NaN → do NOT flag`. This case MUST be a RED row in the L1 truth table and a §10/L2 grounding probe — use a *member-valued* underscore (`4_3`=43), not the out-of-set `1_0` (=10) which renders reject and hides the bug.

---

## Provenance — how this plan was grounded (Session 138)

Firsthand this session: read `isWrongValue`/`valueMessage`/`isWrongNumber`/`unquote` (`yaml-value-check.ts`), the `SchemaField` interface + `closednessOfSchema`/`annotateClosedness`/`valuesOfSchema`/`numericTypeOfSchema`/`openNumericMemberEnum`/`NUMERIC_LITERAL`/`projectFieldsFromProperties`/`objectChildren`/`toField` (`yaml-schema.ts`), the four `isWrongValue` call sites, and the raw schema (`document-options.yml:233`, `definitions.yml:730`). Built + ran esbuild-bundled harnesses over the REAL installed schema via the shipped `parseSchemaIndex`: `numenum-scan.ts` (the exhaustive 2-position surface), `verify-iwv.ts` + `confirm-live-fp.ts` (the live `aspectratio` FP on the real shipped code path), `mixed-scan.ts` (no mixed-member enum → guard-deletion safe). Render-grounded both positions with ~30 `quarto render` 1.7.33 probes (`scratchpad/numenum-ground/`) → the identical coercion accept-set (§2.3). Harnesses are uncommitted verification artifacts in `scratchpad/` (NOT gitignored — do not `git add`). NO code was changed this session (FM #18/#19).

**Adversarial plan review (the family's standing planning-session discipline — distinct from the §4 L4 code review the implementer owes).** A 4-lens `quarto render`-verified Workflow (`wf_f52ca1a1-827`: fp-cardinal / surface-completeness / guard-deletion-safety / consistency-anchors) reviewed this plan. It returned a **HIGH** and two **MEDIUM**s, all re-verified firsthand before folding (the author grounds; the panel proposes): (1) HIGH — the §3.1 C algorithm as originally written would ship a cardinal-sin FP on member-valued digit-group underscores (`aspectratio: 4_3`→43, quarto exit 0; `Number("4_3")`=NaN) because the NaN guard lived only in prose → folded the `NaN`-safe step + `Number()` pin into §3.1 C, added the underscore RED row to §4 L1 + §10, and dragon 11; (2) MEDIUM — `aspectratio` has a *second* live-FP reachability, nested `format.beamer.aspectratio` via `yaml-value-diagnostics.ts:150-152` (grounded: `findNestedFrontMatterValueLines` emits `parentPath:["format","beamer"]`, the current matcher flags `169.0` there too) → folded into §2.2/§2.4/§4 L3/dragon 5; (3) MEDIUM — the "no mixed enum exists" claim was an overclaim (`brand-font-weight` is a mixed enum in the raw schema, merely *unreachable* at depth≤2) → corrected §0/§2.2/§2.5/§7.4/dragon 6 to the accurate reachability+mixed⇒no-bit invariant. Lens 4 (consistency) returned SOUND with four *verified-absent* confirmations: every file:line anchor resolves, the L1-inertness and L2-go-live logic hold over the real schema, and `valueMessage` needs no change. Review is a verification artifact, not committed code.
