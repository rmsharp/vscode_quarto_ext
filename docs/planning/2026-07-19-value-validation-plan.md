# Plan — Front-matter / cell-option VALUE validation

- **Deliverable of the implementation work:** a diagnostic that flags a wrong **value** of an
  *already-recognized* front-matter key or `#|` cell-option in a `.qmd` (e.g. `toc: yes`,
  `echo: maybe`, `code-overflow: banana`) with an Error squiggle, matching what `quarto render`
  1.7.33 itself rejects.
- **Author:** Session 123 (planning). **Date:** 2026-07-19. **Status:** plan v1.1 — *evidence-based,
  grounded firsthand against the installed Quarto 1.7.33 schema and renderer, then **adversarially
  reviewed** (16-agent panel; one CONFIRMED **critical** false-positive in the closedness model —
  `string.completions` misclassified as closed — caught and fixed, plus scope/citation hardening).*
  Implementation is a **separate strict-TDD session per phase** (plan↔code boundary, FM #18).
- **Backlog item:** `BACKLOG.md` line 43 — "Front-matter/cell-option type/enum validation" (filed
  Session 61 grill-me; "a genuinely different feature, not a continuation of the closed unknown-key
  item … its own future planning session").
- **Workstream:** `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`.

> **OUT OF SCOPE (stated up front, twice — this is a boundary, not a deferral):** a general
> **type system** (arbitrary string-length / date / path / range checks). This plan validates
> **closed value sets** (booleans + closed string enums) in v1, and adds **one** narrow type check
> (numeric) only as an explicitly-deferred v2 candidate. "type/enum/required-field validation" as a
> broad capability was already deferred as a permanent boundary by the unknown-key plan
> (`docs/planning/2026-07-09-yaml-schema-diagnostics-plan.md` §0/§3); this plan does **not** reopen it.

---

## §0 — Decision at a glance

| Question | Decision | Grounded on |
|---|---|---|
| **Feature shape** | A **new sibling feature** `src/features/yaml-value-diagnostics.ts` that **copies** the proven lifecycle skeleton from `yaml-diagnostics.ts` — NOT an extension of it, NOT "tier-2" of the unknown-key roadmap. | §3.1; CHANGELOG: front-matter/cell-option VALUE validation, Sessions 124-149` ("genuinely different feature") |
| **v1 value scope** | **Enum-only, closedness-aware.** Flag only when a recognized key's value set is provably **closed** (no open string/number/object arm) and the normalized token is not accepted. Booleans are the special closed set. | §3.3; schema dragon (§7.1) |
| **v1 surfaces** | **Phase 1:** `#|`/`//|` cell options. **Phase 2:** **top-level** front-matter scalars. Both `.qmd`/`.rmd`/`.Rmd` only. | §4 |
| **Deferred to v2** | **nested** front-matter values (`execute:`, `format: html:` …), **numeric** type-aware (`fig-width: wide`), **`.ipynb`**. Filed to backlog, not built. | §4.3 |
| **Severity** | **Error** — for both surfaces. `quarto render` 1.7.33 aborts (exit 1) on every wrong closed-type value in front matter AND cell metadata. | §2 (empirical) |
| **False-positive posture** | **False-negative-only.** Any uncertainty (unresolved field / no closed set / non-scalar value / unknown engine) → **flag nothing.** Mirrors the `projectKeys → Set|null` "absence of proof is not proof of absence" contract. | §3.4; `2026-07-09-…-plan.md` §5.1 |

**The one-sentence justification for a separate feature:** unknown-**key** flagging is *permanently
banned* on front-matter/cell-options (CHANGELOG: unknown-key diagnostics, closed as not a real gap`, operator-confirmed S61) because those schemas
are open — a typo is indistinguishable from a legal custom key. Value validation is **safe on exactly
those same surfaces** because it only ever fires on a key that is **already recognized**; the safety
story is *inverted*, which is why it is a sibling, not a continuation.

---

## §1 — Context

### 1.1 Problem

The extension already helps the author *write* valid config: the YAML completion provider
(`src/providers/yaml.ts`) offers valid keys and, for enum keys, valid **values** (it reads
`SchemaField.values`, `providers/yaml.ts:121-138`). But nothing flags a **wrong value** of a key the
provider recognizes. The author learns `toc: yes` is wrong only when `quarto render` fails. This plan
closes that gap with an in-editor Error diagnostic that mirrors Quarto's own pre-render validation.

### 1.2 Constraints (standing, binding)

- **Strict TDD, project-wide** (CLAUDE.md operator directive): RED→GREEN, one test at a time,
  vertical slices. Pure logic in `src/core/` unit-tested with vitest; VS Code adapters via
  `@vscode/test-electron`.
- **False-negative-only** direction is a hard product rule for this class of feature
  (CHANGELOG: front-matter/cell-option VALUE validation, Sessions 124-149`): never flag a value Quarto would accept.
- **No publish near-term** (operator, S103). **WYSIWYG editor excluded** (operator, S43).
- VS Code diagnostics are **push-only** — there is no diagnostic *provider* to register; a
  `DiagnosticCollection` driven by raw `workspace.onDid*TextDocument` events is the only mechanism
  (confirmed `yaml-diagnostics.ts` header, lines 13-22).

### 1.3 Current state (what already exists — build on it, don't rebuild)

| Capability | Where | Reuse for this feature |
|---|---|---|
| Value **enums** per key | `SchemaField.values` (`yaml-schema.ts:22-64`); resolved by `valuesOfSchema` (`638-697`) | The allowed-value data. **Missing:** a closedness / boolean-type signal (§3.2). |
| Key→field→values **lookup** | `providers/yaml.ts:valueItems:121-138` (`fields.find(f=>f.name===key)` → `field.values`) | The exact resolution a validator inverts. Currently vscode-coupled; lift the pure part into core. |
| Cell-option **enumerator** (whole-doc, with value ranges) | `qmd/model.ts:findCellOptionLines:526` → `CellOptionLine.valueSlot:230` | **Reused as-is.** Cell-option value ranges are already computed — no new position work. |
| Front-matter **block bounds** | `qmd/model.ts:findFrontMatter:456` / `inFrontMatter:470` (the single `---` scanner, Learning #14) | Bounds the Phase 2 scan. A second `---` parser is forbidden. |
| Front-matter **value-token grammar** | `yaml-context.ts:valueSlotAfterColon:401` (exported), `mappingContainerKey:286`, `leadingWsLen:307` | The value-range grammar for the Phase 2 enumerator (which does not yet exist). |
| Whole-doc **key enumerator** template | `project-yaml.ts:findProjectConfigKeyLines:58` (emits `{line,container,key,keyRange}`) | The **pattern** the Phase 2 front-matter *value* enumerator mirrors. |
| **DiagnosticCollection** lifecycle | `features/yaml-diagnostics.ts` (whole file, 193 lines) | The skeleton copied verbatim (§3.1). |
| Session-cached **schema source** | `features/yaml-schema-source.ts:createSchemaSource` (degrades to `CURATED_SCHEMA_INDEX`) | Reused unchanged. |
| Registration | `extension.ts:40,80` (`import` + `registerYamlDiagnosticsFeature(context)`) | One import + one call; no `package.json` contribution (already `onLanguage:quarto`). |

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 / pandoc 3.6.3)

Every row below was produced by rendering a fixture and reading the exit code + stderr (grounding
runs in the Session-123 workflow + the planner's own `norm/` renders). **This is the fidelity
reference — Quarto's *actual* schema behavior, not the docs' simplified enums.**

| Fixture | Result | What it establishes |
|---|---|---|
| `toc: true` (control) | exit 0 | baseline |
| `toc: yes` **and** `toc: "yes"` | **exit 1**, "must instead be `true` or `false`" | YAML **1.2**: bare `yes`/`no`/`on`/`off` are **strings**, not booleans — Quarto rejects them. |
| `toc: "true"` (quoted) | **exit 1** | A **quoted** boolean-looking value is a string → rejected. No coercion. |
| `toc: maybe` | **exit 1** | arbitrary string on a boolean → rejected. |
| `toc: True` / `TRUE` / `False` (unquoted) | **exit 0 — valid** | Quarto accepts the **six** YAML-1.2 boolean spellings: `true\|True\|TRUE\|false\|False\|FALSE`. |
| `#| echo: True` (unquoted) | **exit 0 — valid** | Cell-option booleans accept the same six spellings. |
| `#| echo: banana`, `#| eval: banana`, `#| fig-width: wide`, `#| fig-width: "5"` | **exit 1**, "Validation of YAML **cell metadata** failed" | **Cell options ARE render-validated (fatal).** ⚠ This **supersedes** the 2026-07-09 plan's §0 claim that "`#\|` cell options are not even validated by quarto render at all" — that claim is stale for 1.7.33. |
| `code-overflow: banana` | **exit 1**, "must instead be one of: `scroll`, `wrap`" | Closed string enum → rejected, error enumerates members. |
| `code-overflow: "scroll"` (quoted member) | **exit 0 — valid** | For a **string enum**, a quoted member is accepted → the matcher must **strip quotes** for enums. |
| `#\| output: banana` | **exit 0 — valid** | `output`'s real schema is `anyOf[boolean, "asis", string, object]` (`cell-textoutput.yml:1-11`) — an **open** set. The docs' `[true,false,asis]` enum is NOT what Quarto validates. **The first flagship false-positive trap (open via `anyOf`).** |
| `engine: banana` / `engine: knitr` (front matter) | **exit 0 — valid** | `engine`'s real schema is `string:{completions:[jupyter,knitr]}` (`document-execute.yml:1-5`) — an **open string**; completions are hints, any string renders. **The SECOND trap — same "docs-look-closed" symptom, DIFFERENT mechanism (`string.completions`, not `anyOf`).** |
| top-level `notarealkey: true`; nested `format.html.notarealsubkey: true` | **exit 0** | **Unknown *keys* render fine** — so a wrong *value* has a *stronger* claim to Error than the shipped unknown-key diagnostic (which flags things Quarto tolerates). |

**Two derived facts that drive the whole design:**

1. **Severity is binary and it is Error.** There is no observed "warn/coerce" tier — a value either
   satisfies the schema (exit 0, silent) or it is fatal (exit 1). Ground severity on render-fatality,
   which is verified, not on analogy to the unknown-key feature.
2. **The acceptance rule differs by kind.** Boolean fields accept the six unquoted spellings and
   reject everything quoted; string-enum fields accept members quoted or unquoted (case-sensitive).
   The matcher **must** know boolean-vs-enum (§3.2) — the current model can't tell them apart.

**⚠ Charter disclosure — one of the two operator-filed flagship examples is intentionally out of
reach.** CHANGELOG: front-matter/cell-option VALUE validation, Sessions 124-149` (quoted above as this feature's charter) names **two** examples: `toc: "yes"`
(a closed boolean — **IN** scope) and "an invalid `engine:` value." But `engine` is `string.completions`
→ **open** (`engine: banana` → exit 0, verified), so a *correctly-built* closed-set validator produces
**no diagnostic** for it, by design (false-negative-only). Validating a `string.completions` field as if
its hints were a closed enum is precisely the cardinal-sin false positive (§7.1). So `engine:`-style
"did you mean one of the suggested values?" checking is a **separate, future, Warning-tier
soft-completions feature**, explicitly NOT this one — noted so the charter is honestly reconciled, not
silently half-delivered.

---

## §3 — Decision (architecture)

### 3.1 Feature shape: a copied sibling

Build **`src/features/yaml-value-diagnostics.ts`** as a new sibling that **copies** the lifecycle
skeleton from `yaml-diagnostics.ts` (do not modify the hard-won 193-line unknown-key feature).
Reasons, grounded in the code:

- **Different gate.** Unknown-key gates on the *filename* `_quarto.yml` (which opens as VS Code's
  built-in `yaml` languageId). This feature gates on the *languageId* `quarto` — `.qmd` **is** the
  extension's own language. (`vscode.languages.match({language:"quarto"}, doc)` or a `languageId===
  "quarto"` check.)
- **Different query.** Unknown-key calls `index.projectKeys(container)`; this calls
  `index.cellOptions(engine)` / `index.frontMatterKeys(path)` and reads `.values`/closedness.
- **Different identity & isolation.** Its own `COLLECTION_NAME`/`code`; a separate
  `DiagnosticCollection` so a `_quarto.yml` (never a `.qmd`) can never share a URI, keeping the
  existing feature frozen for regression safety.

**Copied verbatim (target-agnostic — do NOT re-derive):** the `DEBOUNCE_MS = 350` change-debounce
(immediate on open/save); `pendingTimers` cancel-before-run; the per-URI **generation guard**
(`generations` map — **MANDATORY**, because this feature awaits the same slow-first-load
`SchemaSource`: the initial `quarto --paths` spawn + ~680 KB parse can let a stale result resolve
after a newer one); `collection.delete(uri)` **never** `.clear()` on close; cancel-before-delete on
close; prime already-open matching docs at activation. (`yaml-diagnostics.ts:57-131,145-192`.)

**Optional future refactor (NOT v1) — filed, not hand-waved:** once two features share this skeleton,
extract a generic `createDebouncedDiagnosticsFeature({gate, compute})`. Copying keeps the shipped
feature untouched now **at an acknowledged cost: it duplicates the Session-47 generation-guard
concurrency logic, so any future correction to that guard must be mirrored by hand across both
features until the extract lands.** Filed as a `BACKLOG.md` item (added at this plan's close-out), not
left as a floating "someday."

### 3.2 Schema model additions (the one change to shared core)

`SchemaField` (`yaml-schema.ts:22-64`) carries `values?: string[]` but **no** signal of whether that
set is *closed* and **no** boolean-vs-enum discriminator. Add **two derived, optional** fields, set at
parse time — mirroring the existing `ClosedKeySet.closed` precedent (`yaml-schema.ts:417-421`,
`projectKeys` returns a set only when `closed===true`):

```ts
export interface SchemaField {
  // … existing: name, description, values, engine, formats, contexts, children …
  /** True only when the value set is EXHAUSTIVE — every reachable arm is an `enum` (bare or
   *  object-form) or a `boolean` (bare or object-wrapped), with NO free arm anywhere in the
   *  resolution. A `string` node is ALWAYS a free/open arm — **INCLUDING `string:{completions:[…]}`**
   *  (completions are autocomplete HINTS, not a constraint: Quarto accepts ANY string — e.g.
   *  `engine: banana`, `documentclass: myclass` render exit 0). `number`/`path`/`arrayOf`/`object`,
   *  an unrecognized node, and the depth-cap bail-out are open too. Only closed fields are
   *  value-validated; anything not positively proven enumerable defaults to closed=false. */
  valuesClosed?: boolean;
  /** True when the closed set includes the YAML-1.2 boolean type (so the six spellings
   *  true|True|TRUE|false|False|FALSE are accepted UNQUOTED, and quoted forms are rejected). */
  acceptsBoolean?: boolean;
}
```

- **Where set:** in `toField` (`yaml-schema.ts:1002`, alongside the existing `values`/`engine`
  assignments), computed by a small **sibling of `valuesOfSchema`** that mirrors its recursion
  (anyOf/maybeArrayOf/ref/schema, same depth cap + `seenRefs` guard, `valuesOfSchema:638-697`) and
  reports `{closed, acceptsBoolean}`. **Enumerate the base cases explicitly — `closed`'s risk
  polarity is INVERTED from `values` (an unproven node defaulting to `closed=true` is a
  false-positive engine):** bare/object-wrapped `boolean` and bare/object `enum` ⇒ `closed=true`;
  bare `string` **and `string:{completions}`** / `number` / `path` / `arrayOf` / `object` / an
  unrecognized node / `depth>5` ⇒ `closed=false`; `anyOf` ⇒ closed iff **all** arms closed;
  `maybeArrayOf`/`ref`/`schema` ⇒ inherit inner closedness. **⚠ `string:{completions}` yields a
  non-empty `values` via `valuesOfSchema:683-688` yet is OPEN — `values` non-empty must NOT imply
  closed; the `valuesClosed` bit is the sole guard.** `objectChildren` (`957`) sets the same fields
  on nested children.
- **Curated constants must be hand-annotated to match the live schema** (§7.1 dragon): e.g.
  `output` (`yaml-schema.ts:113`) is hand-written `["true","false","asis"]` but is **open** → it must
  get `valuesClosed:false` (or be left unmarked, since the default is "not closed → don't validate").
  `echo` (`anyOf[boolean, enum[fenced]]`, both enumerable) is **closed** with `acceptsBoolean:true`.
  `toc`/`eval`/`warning` (BOOL) are closed booleans.

### 3.3 The value matcher (pure core — the highest-value TDD target)

A pure function in a new `src/core/yaml-value-check.ts` (unit-tested headlessly):

```
isWrongValue(rawToken, field) -> boolean          // true ⇒ emit a diagnostic
  Preconditions to VALIDATE at all (else return false — never flag):
    field.valuesClosed === true  AND  (field.values?.length ?? 0) > 0  AND  rawToken is non-empty
  Rule:
    1. If field.acceptsBoolean AND rawToken is UNQUOTED and matches /^(true|True|TRUE|false|False|FALSE)$/
         -> VALID (not wrong).
    2. Let lit = unquote(rawToken).  If lit ∈ (field.values minus the boolean reprs), case-SENSITIVE
         -> VALID.
    3. Otherwise -> WRONG (flag).
```

Grounded rule-by-rule (§2): step 1 encodes the six accepted boolean spellings + quote-sensitivity
(`toc:True` valid, `toc:"true"` flagged); step 2 encodes quote-stripping + case-sensitive membership
for string enums (`code-overflow:"scroll"` valid, `output:ASIS` would flag *if* output were closed —
it isn't, so it's skipped by the precondition). `unquote` already exists for keys
(`project-yaml.ts:unquoteKey:146`) — lift/adapt a value variant. **Do NOT YAML-parse** and **do NOT**
treat `yes`/`no`/`on`/`off` as booleans — Quarto 1.2 rejects them (§2).

### 3.4 Data flow

```
 document change (.qmd)  ─debounce 350ms→  refresh(uri)
        │
        ├─ Phase 1: findCellOptionLines(text)            [core, exists]
        │     └─ per line: engine = engineFor(cellLang); field = index.cellOptions(engine).find(name)
        │
        ├─ Phase 2: findFrontMatterValueLines(text)      [core, NEW — mirrors findProjectConfigKeyLines]
        │     └─ per top-level scalar: field = index.frontMatterKeys([]).find(name)
        │
        └─ for each {field, rawToken, valueRange}:
              if isWrongValue(rawToken, field):          [core, NEW]
                 collection.set(uri, Diagnostic(valueRange, msg, Error))
        (field unresolved / not closed / non-scalar / engine unknown ⇒ skip — never flag)
```

Message text (grounded on Quarto's own): `` Value "<token>" is not valid for "<key>" — expected one
of: <members> `` (for enums) / `` … expected true or false `` (for booleans). Do **not** attempt to
reproduce Quarto's exact anyOf sub-branch message (§7 note) — matching the *fact* of the error is
reliable; matching the exact expected-list string is not.

---

## §4 — Scope: the vertical slices (each is ONE implementation session)

Structured as **tracer bullets** (FM #25): each slice is end-to-end (schema → matcher → wiring →
tests) and leaves something working. Phase 1 is first because its enumerator already exists, so it
builds the whole shared skeleton at the lowest risk; Phase 2 then only adds the front-matter
enumerator. *(The operator may swap the order if they want the flagship `toc:` front-matter demo
first — noted, not assumed.)*

### 4.1 Phase 1 — cell-option value validation (`#|`/`//|`, `.qmd`)

**What DONE looks like:** typing `#| echo: maybe` (or `eval: 3`, `code-overflow: banana`) in a `{r}`/
`{python}` cell shows an Error squiggle on the *value*; `#| echo: True`, `#| echo: fenced`, and
`#| output: banana` (open set) show **nothing**.

**Layers (one vertical slice; ≤5 files per checkpoint commit):**
1. `SchemaField.valuesClosed` + `acceptsBoolean` + the closedness sibling of `valuesOfSchema`; wire
   into `toField`/`objectChildren`; hand-annotate the curated cell constants. *(core; vitest)*
2. `isWrongValue` + value `unquote` in `yaml-value-check.ts`. *(core; vitest — the normalization
   matrix from §2 is the RED battery)*
3. Export `engineFor` (currently module-private, `yaml-context.ts:422`) or add a thin core sibling;
   the cell-option scan reuses `findCellOptionLines` + `index.cellOptions(engine)`. *(core; vitest)*
4. `src/features/yaml-value-diagnostics.ts` (copied skeleton, `languageId==="quarto"` gate, cell path
   only) + register in `extension.ts`. *(features; integration test)*

**Verification (per RED/GREEN slice, fast):** `npx vitest run test/unit/<file>` → `npm test` (full
unit). **After the wiring layer:** `npm run check-types`, then `npm run test:integration` (one run,
pinned VS Code 1.129.0 — NOT per-slice; it is slow). **Close-out gate:** `npm run package` (.vsix).
**One session — close out when the cell path is green end-to-end.**

**Dragons:** the open-value traps — `output` (anyOf) **and** `animation-hook` (`string.completions`),
§7.1 — must flag nothing; quote/case boolean rules (§7.2); empty value slot (`#| echo:` mid-edit) and
unknown engine → never flag; do **not** flag engine-mismatch (a knitr-only key in a jupyter cell is
unknown-*key* territory, the permanently-closed item — this feature only fires when the key **is** in
`cellOptions(engine)`). **Regression battery must include** `#| output: banana` and
`#| animation-hook: myhook` → **emit nothing** (both render exit 0).

### 4.2 Phase 2 — top-level front-matter value validation (`.qmd`)

**What DONE looks like:** `toc: yes` / `toc: "true"` / a top-level closed-enum key with a bad value
shows an Error squiggle; `toc: True` shows nothing.

**Layers:** a **new** pure `findFrontMatterValueLines(text)` in core — a whole-document forward scan
bounded by `findFrontMatter`, emitting `{key, valueRange, rawToken}` for **top-level mapping scalars**,
built from `findProjectConfigKeyLines`' key-tracking + `valueSlotAfterColon`'s value grammar (use a
`mappingColonIndex`-style colon finder to avoid mis-splitting `title: My Talk: 2026`) — then reuse the
Phase-1 matcher + feature (add the front-matter path to `refresh`). *(core + features; vitest +
integration.)*

**Verification:** same matrix. **One session — close out when top-level front-matter is green.**

**Dragons:** skip **non-scalar** values — a key that opens a block (`format:`, `execute:`) has an empty
value slot → skip; flow collections (`[a,b]`) and block scalars (`|`/`>`) → skip (never
closed-enum-typed); quoted-value-plus-trailing-comment overrun (`valueSlotAfterColon` doesn't strip
comments inside quotes, `yaml-context.ts:406-411`) — unquote for comparison, accept the range quirk or
trim. Open-string regression tests: `documentclass: myclass`, `pagestyle: mystyle`, `linkstyle: fancy`
→ **emit nothing** (all render exit 0).

**⚠ Top-level `format` is deliberately UNVALIDATED in v1 (documented, not an oversight).** Its value
enum is injected in `indexOf` (`yaml-schema.ts:442-446`, `{...f, values: formatNames}`) **after**
`valuesClosed` is computed on the raw field in `toField` — and the raw `format` field is a plain
`schema: string` (`document-epub.yml:72-75`), so `valuesClosed` is unset on the injected field and the
§3.3 precondition (`valuesClosed===true`) **skips it**. This is a SAFE false negative even though
`format: banana`/`format: htlm` is in fact render-fatal (exit 1). **DO NOT "fix" it by marking the
injected `formatNames` closed:** extension/custom formats (`format: acm-html` from an `_extension`, or
legacy `html5`/`epub3` dropped by `isHiddenFormat`) render clean but are absent from `formatNames`, so
closing the set would false-positive on valid formats — the §7.1 dragon again. The
closedness-before-injection ordering (`collectFields`→`toField` runs before `indexOf`) is the invariant
that makes the skip automatic; state it in a test.

### 4.3 Deferred to v2 (filed to `BACKLOG.md`, NOT built in this plan)

| Candidate | Why deferred | Cost estimate (grounded) |
|---|---|---|
| **Nested** front-matter values (`execute:`, `format: html:` …) | Needs a forward-scan analog of the private cursor-anchored `nestedParentPath` (`yaml-context.ts:232`) — the largest new pure-core surface. Most `execute:`/`format:` enums live here, but cell options already cover echo/eval. | ~1 session (a nested enumerator + tests). |
| **Numeric** type-aware (`fig-width: wide`) | Genuinely useful (37 clean single-`number` fields) but crosses from "closed value set" into "type checking." Small: `scalarType?:'number'` + a ~20-line derivation + a not-a-YAML-number check. | ~½ session, additive, same files. |
| **`.ipynb`** cell/front-matter values | A scope cliff: notebook cells are separate `TextDocument`s (`vscode-notebook-cell:` scheme, cell languageId), no `.qmd` text/fence parse path, no serializer. | Separate, larger effort. |

---

## §5 — Evidence-based inventory (affected symbols)

Reuse / touch / new — every entry grounded to a file:line (Session-123 firsthand + workflow).

**REUSE unchanged:**
- `qmd/model.ts:findCellOptionLines:526`, `CellOptionLine.valueSlot:230`, `findFrontMatter:456`,
  `inFrontMatter:470` — parse surfaces.
- `yaml-context.ts:valueSlotAfterColon:401`, `mappingContainerKey:286`, `leadingWsLen:307` (exported).
- `yaml-schema.ts:SchemaIndex.cellOptions`/`frontMatterKeys`, `CURATED_*` (offline fallback values).
- `features/yaml-schema-source.ts:createSchemaSource` — session-cached, degrades to curated.
- `project-yaml.ts:findProjectConfigKeyLines:58` (**pattern** to mirror), `unquoteKey:146` (adapt).

**TOUCH (add, don't alter existing behavior):**
- `yaml-schema.ts` — add `SchemaField.valuesClosed`/`acceptsBoolean` (22-64); the closedness sibling
  of `valuesOfSchema` (638-697); set them in `toField` (1002) + `objectChildren` (957); hand-annotate
  curated constants (`output:113`, etc.). **Note `indexOf` (442-446) injects `format`'s value list
  *after* closedness is derived → `format` stays `valuesClosed`-unset → skipped (§4.2 dragon).**
  *Completion is unaffected — it reads `values` only.*
- `yaml-context.ts` — export `engineFor` (422) or add a core sibling (single-source it — cf.
  Learning #14; BACKLOG: Consolidate the cell-option-prefix grammar between refs.ts and model.ts is the *analogous* precedent, a small refs.ts/model.ts helper — the `#|`
  cell-option-prefix regex — that was copied and then diverged; **not** a warning about `engineFor`
  itself, which `grep` confirms BACKLOG never mentions).
- `extension.ts` — one `import` + one `registerYamlValueDiagnosticsFeature(context)` (mirror 40/80).

**NEW:**
- `src/core/yaml-value-check.ts` — `isWrongValue` + value `unquote` (pure).
- `src/core/yaml-frontmatter-values.ts` (or into `qmd/model.ts`) — `findFrontMatterValueLines`
  (Phase 2; top-level scalars).
- `src/features/yaml-value-diagnostics.ts` — the copied diagnostic feature.
- `test/unit/yaml-value-check.test.ts`, `test/unit/yaml-frontmatter-values.test.ts` (mirror
  `test/unit/project-yaml.test.ts`); `test/integration/suite/yaml-value-diagnostics.test.ts` (mirror
  `test/integration/suite/yaml-diagnostics.test.ts`); a `test/fixtures/*.qmd` with wrong values.

---

## §6 — Alternatives considered (honest)

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **Raw enum-only** (flag when value ∉ `field.values`) | Zero schema work — data exists today | **False-positives on 45 open-with-values fields** (anyOf-free-arm *and* `string.completions`) incl. `output: banana` and `engine: banana` (§7.1); violates the false-negative-only rule | **Rejected.** Unsafe. The closedness bit is non-negotiable. |
| **Full type system** (string-length/date/path/range) | Broad coverage | Reopens the permanently-deferred "type/enum/required-field validation" boundary; huge; low incremental value (any string is a valid string) | **Rejected for v1.** Only the narrow numeric slice is even a v2 candidate. |
| **Lowercase-membership** normalization (`toc: True` → lowercase → member) | Simple | Would still mis-handle string enums (case-sensitive) and the empirical boolean set; brittle | **Rejected.** §2 shows booleans need case-insensitive-among-6-forms while enums need case-sensitive — one rule can't serve both. |
| **Warning severity** | "softer" | No observed Quarto behavior maps to warn; wrong values are render-fatal (§2) | **Rejected.** Error, grounded on render-fatality. |
| **Extend the existing `yaml-diagnostics.ts` feature** | One feature | Different gate/query/identity; risks the frozen 193-line feature; co-mingles `_quarto.yml` and `.qmd` URIs | **Rejected.** Sibling + copy; extract-a-generic is an optional later refactor. |

---

## §7 — Failure-mode analysis (the safety story — this IS the feature's risk)

**7.1 Open-value false positives (THE primary dragon).** `field.values` being non-empty does **not**
mean the set is closed. Corrected census against Quarto 1.7.33 (re-derivable — see footnote):
**45 of 219 values-bearing fields are OPEN-with-values** (only **174 are safely closed**). They fall
in TWO families, each of which `valuesOfSchema` populates a `values` set for:
- **`anyOf`-with-a-free-arm** — e.g. `output` = `anyOf[boolean,"asis",string,object]`, plus `color`,
  `fig-pos`, `code-line-numbers`, `highlight-style`, … `valuesOfSchema` flattens the `anyOf` and
  silently drops the free string/number/object arm.
- **bare `string:{completions:[…]}`** — e.g. `engine`, `documentclass`, `pagestyle`, `linkstyle`,
  `animation-hook`. The completions *look* like a closed enum and land in `values`
  (`valuesOfSchema:683-688`), but the field accepts **any** string (`engine: banana` → exit 0).
  *(This second family is the class the Session-123 plan review caught — the earlier "22" census
  counted only the `anyOf` family and gave false safety assurance.)*

**Mitigation:** the `valuesClosed` bit (§3.2) is the sole guard — validate only provably-closed
fields, and it is `false` for BOTH families (a `string` node, with or without completions, is open).
Do **not** gate on "`values` non-empty" — that is exactly the false-positive trigger. Curated
constants that *look* closed but aren't (`output`) get `valuesClosed:false`. **Tests:**
`#| output: banana`, `#| animation-hook: myhook`, `engine: banana`, `documentclass: myclass` must
each emit **nothing** (all render exit 0).

> *Footnote (census reproducibility):* the 45/219/174 split and the 37 clean-number figure (§4.3) are
> re-derivable via `node docs/planning/scripts/count-value-field-shapes.mjs` against the installed
> schema; the numbers above are for **Quarto 1.7.33** — re-run after any Quarto upgrade. The counts are
> illustrative of the *scale* of the dragon; the design keys on the per-field `valuesClosed` bit, not
> on any aggregate.

**7.2 Boolean flattening + quoting + case.** Booleans are stored as `["true","false"]`,
indistinguishable from a 2-value string enum, yet their acceptance rule differs (six spellings,
quote-rejecting). **Mitigation:** `acceptsBoolean` (§3.2) + the two-branch matcher (§3.3). **Tests
(the RED battery — every row below is empirically verified against `quarto render` 1.7.33):**
`toc: True`/`TRUE`/`False` → valid; `toc: yes`/`"yes"`/`"true"`/`maybe`/`Yes`/`On` → flag;
`echo: fenced` → valid; `echo: "fenced"` → valid; `code-overflow: "scroll"` → valid;
`code-overflow: Scroll` → flag (enum membership is case-**sensitive** — confirmed exit 1); and the
open-value skips `output: banana` / `animation-hook: myhook` / `engine: banana` / `documentclass:
myclass` → flag **nothing**. *(Learning #54a: value equality is exactly where quoting/casing/whitespace
hide false positives — probe them explicitly; careful TDD alone was not sufficient last time.)*

**7.3 Nested-path mis-resolution (Phase 2 scope guard).** Validating a value where the key opens a
mapping (`format:`, `execute:`) would mis-flag. **Mitigation:** top-level scalars only in v1; a key
with an empty value slot (block-opener) is skipped.

**7.4 Engine-unknown over/under-reach.** `engineFor` returns `undefined` for non-r/python/julia/ojs/js
langs; `cellOptions(undefined)` returns the full set. **Mitigation:** never flag when the engine is
unknown or the key isn't in `cellOptions(engine)` — false-negative-only.

**7.5 Curated-fallback divergence.** When Quarto's schema can't load, `CURATED_SCHEMA_INDEX` is used;
its closedness annotations must match the live schema (§7.1). **Test:** an offline/curated-index unit
test that flags nothing it shouldn't.

**7.6 Non-scalar / flow / block values.** `[a,b]`, `{a:b}`, `|`/`>` block scalars — skip (never
closed-enum-typed; per-element flow validation is out of scope).

**7.7 Async race.** The generation guard is mandatory (§3.1) — the slow first schema load can resolve
a stale diagnostic after a newer edit.

---

## §8 — Impact analysis

- **What changes:** two optional derived fields on `SchemaField`; a new pure matcher + (Phase 2) a new
  front-matter value enumerator; a new sibling diagnostic feature + one registration line.
- **What does NOT change:** the completion providers (read `values` only — unaffected by the new
  fields); the unknown-key `yaml-diagnostics.ts` feature (untouched — copied, not extended);
  `_quarto.yml` handling; the `values` data itself (still built by `valuesOfSchema` as today).
- **What might break / regression surface:** (a) the closedness derivation must not mis-mark a genuine
  closed enum as open (false-negative — acceptable) or an open one as closed (false-positive —
  the cardinal sin; guarded by §7.1 tests); (b) a third `createSchemaSource()` means a third one-time
  `quarto --paths` spawn on first use — harmless, consistent with the two existing (a shared
  module-level source is an optional micro-refactor); (c) the `engineFor` export must not create a
  divergent duplicate — the same helper-copied-then-diverged class as BACKLOG: Consolidate the cell-option-prefix grammar between refs.ts and model.ts's refs.ts/model.ts
  prefix-regex duplication, applied here to `engineFor`.

---

## §9 — Verification plan

- **Per RED/GREEN slice:** `npx vitest run test/unit/<file>` (targeted, ~1 s) → `npm test` (full unit,
  ~1 s for the four relevant files today).
- **After the wiring layer only:** `npm run check-types` (tsc --noEmit) → `npm run test:integration`
  (single run; pinned VS Code 1.129.0; uses the `waitFor` poller — never fixed sleeps — because the
  first schema-dependent event spawns `quarto --paths` + a ~680 KB read).
- **Close-out gate:** `npm run package` (.vsix).
- **Adversarial review of the finished slice is MANDATORY** (Learning #54a) — a lens dedicated to
  YAML value quoting/casing/whitespace false positives, plus the open-enum trap.
- **Manual Phase 3E smoke (not automatable):** `onDidCloseTextDocument` does **not** fire for
  file-backed docs in `@vscode/test-electron` (Learning #54b) — verify close-clears by code trace +
  a manual EDH check, do **not** budget an automated close test.
- **Faithful-verification note:** the integration test asserts real `vscode.languages.getDiagnostics`
  at known ranges on a wrong-value `.qmd` fixture — it exercises the actual push path, not a mock.

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

1. **String-enum case-sensitivity — RESOLVED (empirically confirmed).** `code-overflow: Scroll` →
   exit 1 (the review verified the render), so enum membership is case-**sensitive** and the matcher's
   flag is correct. Keep case-sensitive membership. *(No longer an open question — moved here only for
   the record.)*
2. **`Yes`/`On` capitalized synonyms — RESOLVED (empirically confirmed).** `toc: Yes` → exit 1,
   `toc: On` → exit 1 (verified). They are strings, not booleans; the matcher's boolean regex
   correctly excludes them → flag is correct.
3. **Shared vs per-feature `SchemaSource`.** Ship per-feature (matches precedent); a module-level
   shared source is an optional micro-refactor, not a v1 decision. *(The only genuinely-open item.)*

*(The load-bearing normalization questions — the six boolean spellings, quote handling for
booleans-vs-enums, open-value skipping, cell-metadata fatality — are all **settled empirically**, §2.
Residuals #1/#2 were resolved by the plan-review renders; only the SchemaSource-sharing micro-decision
remains, and it does not block Phase 1.)*

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. 🐉 **Never flag an open set.** `values` present ≠ closed. Gate on `valuesClosed===true`. "Open"
   has TWO shapes: an `anyOf` with a free arm (`output: banana`) **and** a bare
   `string:{completions}` whose hints look like an enum (`engine: banana`, `documentclass: myclass`).
   Both render fine — flag either and you shipped the cardinal-sin bug.
1a. 🐉 **`format` is values-bearing but must stay OPEN.** Its enum is injected *after* closedness is
   derived, so it is correctly skipped; do NOT "fix" the resulting `format: htlm` miss by closing the
   injected list — custom/extension formats would false-positive (§4.2).
2. 🐉 **Booleans ≠ string enums.** Six spellings, quote-rejecting for booleans; unquote + case-
   sensitive for enums. `toc: True` is VALID; `toc: "true"` is WRONG. Get this backwards and you
   false-positive on the most common capitalization.
3. 🐉 **YAML 1.2, not 1.1.** `yes`/`no`/`on`/`off` are strings → wrong for a boolean. Do NOT accept them.
4. 🐉 **Cell options ARE render-validated (Error).** The 2026-07-09 plan says otherwise — it is stale
   for 1.7.33. Trust the renders in §2, not the old doc.
5. 🐉 **Top-level front-matter only in v1.** A key that opens a block (`format:`/`execute:`) → empty
   value slot → skip. Nested is v2.
6. 🐉 **Copy the skeleton; keep the generation guard.** Do not extend `yaml-diagnostics.ts`; do not
   drop the async race guard "because it looks like boilerplate."
7. 🐉 **`BACKLOG:NNN` is a line number**, and this is a **sibling** feature — do not phrase it as
   reopening the permanently-closed unknown-key-in-open-regions boundary (CHANGELOG: unknown-key diagnostics, closed as not a real gap`).
