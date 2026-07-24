# Plan — `format:` per-format option VALUE validation in `_quarto.yml`

**Session:** 142 (PLANNING). **Deliverable:** this plan. **Implementation:** a separate later session.
**Workstream:** Planning (evidence-based inventory + per-phase criteria + gate-(a) layer contract).
**Feature family:** the YAML value-validation family (S124/125/128/130/132/135/137/139/141) — this is
its **tenth slice** and its **fourth `_quarto.yml`-surface** slice (after S135 depth-1, S137 depth-2,
S141 `execute:`).
**Origin:** the S141 handoff's "What's next" (1) — "`format:` document-key VALUES in `_quarto.yml` …
the obvious next `_quarto.yml`-value item"; operator picked "Plan: format: values" via `AskUserQuestion`
at S142 Phase 0 (Active empty).

---

## §0 — Decision at a glance

Flag a **wrong CLOSED value of a per-format option in `_quarto.yml`** — a value at
`format:` → `<format-name>:` → `<option>:` (e.g. `format:\n  html:\n    toc: banana`,
`df-print: banana`, `fig-format: banana`, `toc-depth: banana`; `format:\n  revealjs:\n    transition:
banana`; `format:\n  pdf:\n    number-sections: banana`) — with an Error squiggle on the value span,
matching what `quarto render` 1.7.33's `_quarto.yml`-schema layer (`readAndValidateYamlFromFile`)
rejects — the **exact** layer S135/S137/S139/S141 already target (§2.1 grounded).

**The headline finding (grounded firsthand this session): this ships with ZERO new reader / matcher /
message logic.** The reader path `SchemaIndex.frontMatterKeys(["format", <fmt>])` → `perFormatOptions(fmt)`
(reader-derived, fully annotated `SchemaField[]`), the matcher (`isWrongValue`), and the message
(`valueMessage`) **already exist and already validate per-format option values on the `.qmd` document
surface today** (shipped + integration-tested — `yaml-value-diagnostics.ts:150-169`, test
`yaml-value-diagnostics.test.ts:240-284`). A fresh compiled-reader harness against the current source
confirms the reader annotates every FP-critical per-format field **1:1 with the `quarto render` ground
truth** (§2.2/§2.3), including the `code-fold` anyOf(bool+`show`) trap. The gap is purely **surface
plumbing on the `_quarto.yml` side**: the project value enumerator does not recognize `format:` as a
container, and the project value feature has no `format` resolution branch.

**The two changes (mirroring S141's `execute:` slice, one nesting level deeper):**
1. **Enumerator** (`findProjectConfigValueLines`, `src/core/project-yaml.ts`): add `"format"` to the
   **value-only** container set `VALUE_CONTAINERS` (`:30`) and widen `ProjectConfigValueLine.container`
   (`:133`). The **depth-2 machinery is already sufficient** (S137) — `format → html → toc` is the exact
   shape of the already-emitted `website → navbar → collapse-below` — so this is a one-name data change +
   a type widen; **no new depth logic, no new predicate** (the value/KEY fork already exists, S141).
2. **Feature** (`yaml-project-value-diagnostics.ts`): a `format` **resolver branch** that resolves a
   depth-2 line (`path=[fmt], key=option`) against `index.frontMatterKeys(["format", fmt])` — the SAME
   reader path the `.qmd` surface uses — instead of the project `.children` descent.

**Why `format:` is "materially harder" than `execute:` (S141's flag), now characterized** — three real
differences, none a blocker:
- **Depth-2, not depth-1.** The value lives at `format → <fmt> → <option>` (path length 1), vs
  execute's `execute → <option>` (path length 0). The enumerator already emits depth-2; the *resolver*
  needs a format branch (the reader consumes `["format", fmt]`, NOT a `.children` descent — §7 dragon 2).
- **Reader-derived closedness, not curated.** Per-format options are auto-annotated
  (`perFormatOptions(fmt)`, ~155–193 fields per format), not a small hand-annotated list like
  `CURATED_EXECUTE_KEYS`. Consequence: **format validation is a safe false-negative OFFLINE** — the
  offline `CURATED_FORMAT_OPTIONS` (`yaml-schema.ts:394-431`) carries no `valuesClosed`, so it flags
  nothing when the CLI schema fails to load (unlike execute, which is offline-robust). Documented
  property (§7), not a defect; **do not "fix" it** by hand-annotating the curated fallback (out of scope).
- **The top-level `format:` scalar is a deliberate FN on BOTH surfaces.** `format: banana` (a wrong
  format *name*) is NOT flagged — its enum is injected AFTER `annotateClosedness`, so `valuesClosed`
  stays unset (`yaml-schema.ts:565-569`; proven NOT-flagged on `.qmd` at
  `yaml-value-diagnostics.test.ts:185-187`). Our children-only enumerator naturally skips it (§4.3).

**Scope is per-format-OPTION VALUE only.** KEY validation of format options is a **non-starter** (quarto
accepts unknown per-format option keys — `custom-opt: whatever` → exit 0, §2.3), exactly as for execute.
The top-level `format:` scalar name, unknown format-NAME containers, offline validation, and depth-3+
are **explicitly deferred** (§4.3).

---

## §1 — Context

### 1.1 Problem

`format:` is a document-level key that selects output formats and their options; it is **also valid at
the top level of `_quarto.yml`**, where it sets project-wide format defaults. Quarto schema-validates
per-format option values there (§2.1), but this extension gives **no editor feedback** for them on the
`_quarto.yml` surface: the `.qmd` value feature gates on `languageId === "quarto"` (a `_quarto.yml` is
`"yaml"`), and the `_quarto.yml` value feature only recognizes `project:`/`website:`/`book:`/`execute:`.
So `format:\n  html:\n    toc: banana` in `_quarto.yml` renders exit-1 at the CLI but shows no squiggle.

### 1.2 Constraints (standing, binding)

- **Strict TDD** (project-wide, CLAUDE.md): one RED before each GREEN, vertical slices, ≤5 files/commit.
- **False-negative only** (the hard product rule, `BACKLOG.md`): NEVER flag a value quarto accepts.
  Everything the matcher is unsure about returns `false`. This is the whole safety story of the family.
- **Look-but-don't-copy** (Learning #1): per-format option names/values are uncopyrightable facts read
  from the installed 1.7.33 schema + grounded against `quarto render`, not Posit's AGPL extension.
- **1-and-done** (FM #17/#26): ONE capability — per-format option VALUE validation in `_quarto.yml`.
  The scalar `format:` name / unknown-format-name / offline / depth-3 cases stay deferred.
- **Plan ≠ implementation** (FM #18/#19): this session's deliverable is the plan; NO code.

### 1.3 Current state — what to build ON (do NOT rebuild)

- **The reader path** `SchemaIndex.frontMatterKeys(["format", <fmt>])` (`src/core/yaml-schema.ts:615-617`)
  → `perFormatOptions(fmt)` (`:574-575`) = `perFormatFields.filter(f => formatMatches(f.formats, fmt,
  aliases))`. Returns fully-annotated `SchemaField[]` (`valuesClosed`/`acceptsBoolean`/`scalarType`/
  `numericMemberEnum`) — the SAME `toField`→`annotateClosedness`/`annotateScalarType` choke point as
  top-level fields (`:1483-1484`). **Unchanged.** (Property: because closedness is reader-derived, this
  is **live-reader-only** — offline it is a safe no-op, §2.4/§7.)
- **The matcher** `isWrongValue(rawToken, field)` (`src/core/yaml-value-check.ts:46`) — surface-agnostic;
  closed string enums, boolean-accepting enums (`acceptsBoolean`), numeric (`scalarType:"number"`),
  numeric-member enums (`numericMemberEnum`, S139). **Unchanged.**
- **The message** `valueMessage(rawToken, key, field)` (`:184`) — numeric-first dispatch. **Unchanged.**
- **The `.qmd` value feature already validates `format → <fmt> → <option>`** (`yaml-value-diagnostics.ts:150-169`)
  via `frontMatterKeys(nested.parentPath).find(f => f.name === key)` — the EXACT reader path this slice
  reuses on the other surface. Proven at `yaml-value-diagnostics.test.ts:240-284`.
- **The `_quarto.yml` value feature** `registerYamlProjectValueDiagnosticsFeature`
  (`src/features/yaml-project-value-diagnostics.ts`) — filename-gated (`quarto-project-value` collection),
  debounced, generation-guarded; routes each `ProjectConfigValueLine` by container (`:121-125`), then
  `resolveProjectValueField` (`:79-90`) + `isWrongValue` (`:126`). **Gains one resolver branch.**
- **The `_quarto.yml` value enumerator** `findProjectConfigValueLines` (`src/core/project-yaml.ts`) — a
  scanFlow-aware depth-1+depth-2 scanner. **Recognizes one more top-level container** (`format`).
- **The value/KEY container fork** (`VALUE_CONTAINERS`/`isValueContainer` at `:30`/`:118` vs
  `PROJECT_CONFIG_CONTAINERS`/`isProjectConfigContainer` at `:18`/`:108`) — built S141. `format` rides
  the existing value-only side; the KEY enumerator never sees it.

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 + a fresh compiled-reader harness)

Two independent sources, cross-checked. **(a)** Firsthand `quarto render` 1.7.33 on a two-file project
(`_quarto.yml` + `doc.qmd`), observing the `readAndValidateYamlFromFile` layer (scratch `probe.sh`).
**(b)** A fresh harness compiling the CURRENT `src/core/yaml-schema.ts` `parseSchemaIndex` against the
installed schema, printing each field's `valuesClosed`/`acceptsBoolean`/`scalarType`/`numericMemberEnum`
(scratch `s142-fmt-reader.ts`). **The reader annotation matches the CLI ground truth 1:1 for every case.**

### 2.1 Quarto validates per-format option values in `_quarto.yml` at the target schema layer — confirmed

`format:\n  html:\n    toc: banana` in `_quarto.yml` →
```
ERROR: Project …/_quarto.yml validation failed.
(line 3, columns 10--15) Field "toc" has value banana, which must instead be `true` or `false`
```
Same `readAndValidateYamlFromFile` layer as S135/S137/S139/S141. The error carries a **column span** on
the value token (the squiggle target), at **depth-2** (`toc` under `html` under `format`).

### 2.2 The grounded closed / numeric per-format inventory (the flag surface)

| line (`_quarto.yml`) | quarto | reader annotation (`frontMatterKeys(["format",fmt])`) | matcher verdict |
|---|---|---|---|
| `format:\n  html:\n    toc: banana` | exit 1 | `closed=true bool=true values=[true,false]` | flag |
| `format:\n  html:\n    number-sections: banana` | exit 1 | `closed=true bool=true [true,false]` | flag |
| `format:\n  html:\n    df-print: banana` | exit 1 | `closed=true [default,kable,tibble,paged]` | flag |
| `format:\n  html:\n    code-overflow: banana` | exit 1 | `closed=true [scroll,wrap]` | flag |
| `format:\n  html:\n    fig-format: banana` | exit 1 | `closed=true [retina,png,jpeg,svg,pdf]` | flag |
| `format:\n  html:\n    toc-depth: banana` | exit 1 | `closed=false scalar=number` | flag (numeric) |
| `format:\n  html:\n    fig-width: banana` | exit 1 | `closed=false scalar=number` | flag (numeric) |
| `format:\n  revealjs:\n    transition: banana` | exit 1 | `closed=true [none,fade,slide,convex,concave,zoom]` | flag |
| `format:\n  pdf:\n    number-sections: banana` | exit 1 | `closed=true bool=true [true,false]` | flag |

### 2.3 Safe cases the matcher must (and does) leave alone — the cardinal-sin traps

- **`theme` / `title` are schema-OPEN**: `theme: banana`, `title: whatever` → **exit 0**. Reader:
  `closed=false`, no `scalarType` → `isWrongValue` skips. **Must never flag.**
- **`code-fold` is anyOf(bool, `"show"`)**: `code-fold: false`/`code-fold: show` → exit 0;
  `code-fold: hide`/`code-fold: banana` → exit 1. Reader: `closed=true bool=true values=[true,false,show]`
  — the anyOf is resolved correctly, so `show`/`false` are members (skip) and `hide`/`banana` are not
  (flag), matching quarto exactly. **The primary FP trap; put `code-fold: show` in the VALID fixture.**
- **Unknown per-format option keys are ACCEPTED**: `format:\n  html:\n    custom-opt: whatever` →
  **exit 0**. Reader: `custom-opt` **absent** from the field set → resolver → `undefined` → skip. **This
  makes value-only scope a correctness property** (KEY-flagging format options would be a cardinal-sin FP).
- **Cross-format options that don't apply to the format are ACCEPTED**: `format:\n  html:\n
    documentclass: article` (pdf-only) → exit 0. Reader: `documentclass` absent from `["format","html"]`
  → skip. (And `documentclass` under pdf is `closed=false` — accepts custom classes — so never flagged.)
- **`toc-depth: 2.5` is a PANDOC-layer error, not schema**: schema accepts a number (exit 0 at
  `readAndValidateYamlFromFile`; the exit-1 is downstream pandoc requiring an integer). Reader:
  `scalar=number` → `isWrongValue` accepts `2.5`. **Deliberately NOT flagged** (Learning #142, consistent
  with S130's `toc-depth: 2.5` position). Put it in the VALID fixture.
- **Quoted booleans**: `code-fold: "true"` → exit 1 (quoted → string). The matcher's quoted-first
  handling flags it; PRE-EXISTING matcher behavior, not format-specific — optional to fixture.
- **Multi-line / flow values**: `include-in-header:\n  text: |\n    <script>x: not-a-key</script>` →
  exit 0 (and depth-3, not emitted). `title: "a: b: c"` → exit 0. The enumerator's `scanFlow` guard
  emits **nothing** for a multi-line opener → **silent** (safe FN); never emits a folded mapping.

### 2.4 Reachability / structure

- **Depth-2 is the target**: `format:` (column 0) → `<format-name>:` (depth-1, block opener, NOT emitted)
  → `<option>: <value>` (depth-2, emitted as `{container:"format", path:[fmt], key:option}`).
- **Depth-1 lines under `format:` are the format NAMES** (`html: default`) — emitted as `path=[]`, but
  the feature's format branch resolves only `path.length === 1` → depth-1 lines resolve to `undefined`
  → skip (and quarto accepts `html: default`, exit 0). A benign extra no-op line.
- **Depth-3+ under `format:`** (`format → html → <object-opt> → <sub>`) — the enumerator caps at depth-2
  (S137), so any depth-3 line is **not emitted** → safe FN. (Grounded: `code-tools:\n  source: banana`
  → exit 0 anyway.)
- **The top-level `format:` scalar** (`format: html`/`format: banana`) is NOT a child of a container —
  our children-only enumerator never emits the `format` key's own value → naturally skipped (§4.3).
- **Unknown format NAME as a container key** (`format:\n  banana:\n    toc: true`) → quarto exit 1
  (banana is not a format). `frontMatterKeys(["format","banana"])` degrades to universal-only; `toc:true`
  is valid → we stay silent (safe FN). If the option value were wrong (`toc: nope`) we would flag the
  OPTION (never a cardinal-sin — quarto also rejects the block), which matches the `.qmd` surface exactly
  (no format-name guard — §6 alt 3, §7 dragon 4).
- **Offline** (CLI schema unavailable): `CURATED_FORMAT_OPTIONS` carries no `valuesClosed` → format
  validation flags nothing (safe FN). Unlike execute, which is offline-robust.

---

## §3 — Decision (architecture)

### 3.1 Feature shape — one more container on the same surface, resolved via the format reader

The `_quarto.yml` value feature already has the shape "enumerate `{container, path, key, value}` lines →
resolve each to an annotated `SchemaField` → `isWrongValue` → `valueMessage` → squiggle." This slice adds
**one recognized top-level container** (`format`) whose fields come from a **different reader path**
(`frontMatterKeys(["format", fmt])` — a 2-element path that the reader consumes) because `format` options
are per-format-name and reader-derived, not a `.children` descent. Everything downstream of field
resolution is unchanged, and the reader path is the SAME one the `.qmd` surface uses.

### 3.2 The two changes

**Change A — enumerator recognizes `format:` (value-side only).** In `src/core/project-yaml.ts`, add
`"format"` to `VALUE_CONTAINERS` (`:30`) and widen `ProjectConfigValueLine.container` (`:133`) to include
`"format"`. The depth-2 machinery (S137) already classifies `format → html → toc` as a `path=["html"]`
grandchild — structurally identical to `website → navbar → collapse-below` — so it emits
`{container:"format", path:["html"], key:"toc", valueRange, rawToken}` with no other enumerator change.
**The KEY enumerator `findProjectConfigKeyLines` keeps `PROJECT_CONFIG_CONTAINERS` (`:18`) and never sees
`format`** (dragon 1). `isValueContainer` is unchanged — `format` simply joins the set it reads.

**Change B — feature resolves `format` via the format reader.** Restructure the field/field-resolution
in `computeProjectValueDiagnostics` (`src/features/yaml-project-value-diagnostics.ts:121-125`) to add a
`format` branch BEFORE the existing execute/project routing:
```ts
let field: SchemaField | undefined;
if (entry.container === "format") {
  // Per-format option value: resolve against the SAME reader path the .qmd surface uses
  // (frontMatterKeys(["format", fmt])). ONLY depth-2 (path=[fmt], key=option). A depth-1
  // format line (path=[], the format NAME itself) → undefined → skip: the top-level `format:`
  // scalar is a deliberate FN on both surfaces (its enum is injected post-closedness).
  field =
    entry.path.length === 1
      ? index.frontMatterKeys(["format", entry.path[0]]).find((f) => f.name === entry.key)
      : undefined;
} else {
  const fields =
    entry.container === "execute"
      ? index.frontMatterKeys(["execute"])
      : index.projectFields(entry.container);
  field = resolveProjectValueField(fields, entry);
}
```
`resolveProjectValueField` (`:79-90`) is **unchanged** and is **NOT** used for `format` — its `.children`
descent is wrong for per-format options (the format-name fields don't carry the options as `.children`;
the options come from `perFormatOptions(fmt)` — dragon 2).

### 3.3 Data flow (a new container, the SAME reader/matcher/message tail)

```
_quarto.yml text
  → findProjectConfigValueLines          [Change A: emits container:"format", path:[fmt] for per-format options]
  → (feature) route by container         [Change B: format → frontMatterKeys(["format", fmt]) = perFormatOptions(fmt)]
  → .find(f => f.name === entry.key)       [in the format branch; depth-1 format lines → undefined → skip]
  → isWrongValue(rawToken, field)          [UNCHANGED — closed-enum / numeric / numeric-member branches already correct]
  → valueMessage(rawToken, key, field)     [UNCHANGED]
  → Error diagnostic on the value span     [UNCHANGED — quarto-project-value collection]
```

Why `format` is genuinely the next `_quarto.yml`-value item despite being harder than execute: the
reader+matcher already validate this exact surface on the `.qmd` side, so the slice is plumbing with
**zero new schema/matcher/message logic** — only a value-side container + a resolver branch.

---

## §4 — Scope: the vertical slice (ONE implementation session)

### 4.1 The layer set (gate-(a) contract — build in this order, checkpoint-commit each, ≤5 files/commit)

- **L1 — [INERT] type widen + feature resolver branch.** Widen `ProjectConfigValueLine.container` to
  include `"format"`; add Change B (the `format` resolver branch) in the feature. **Dormant:** the
  enumerator does not yet emit `format` (it is not in `VALUE_CONTAINERS`), so no live diagnostic changes.
  The type widen FORCES the format branch into the same commit — otherwise the `else`'s
  `projectFields(entry.container)` call fails to typecheck (`projectFields`'s signature is
  `"project"|"website"|"book"`; a widened `entry.container` including `"format"` must be handled before
  that call). *Files:* `project-yaml.ts` (type only), `yaml-project-value-diagnostics.ts`.
  - **DONE looks like:** `npm run check-types` clean, existing suite green (unit/integration counts
    unchanged), structurally dormant.
  - **Verify:** `npm run check-types && npm test`. Dormancy is STRUCTURAL: confirm `"format"` is NOT yet
    in `VALUE_CONTAINERS`, so `findProjectConfigValueLines` cannot emit a `format` line — and rely on
    `check-types` clean + the **unchanged** full-suite counts as the operative dormancy evidence.

- **L2 — [GO-LIVE] enumerator emits `format` (strict-TDD, pure).** Add `"format"` to `VALUE_CONTAINERS`
  (`:30`); keep `PROJECT_CONFIG_CONTAINERS` untouched. **RED→GREEN unit tests** in
  `test/unit/project-yaml.test.ts`: `findProjectConfigValueLines("format:\n  html:\n    toc: banana")`
  currently returns `[]` (RED — the enumerator is value-blind and `format` is not yet in
  `VALUE_CONTAINERS`; today's `project-yaml.test.ts:218` proves the sibling `toc: true` case returns
  `[]`) → returns `{line, container:"format", path:["html"], key:"toc", valueRange, rawToken:"banana"}`
  (GREEN); a
  depth-1 format line (`html: default` → `path:[], key:"html"`) is ALSO emitted (the enumerator is
  resolution-blind — the *feature* skips it); a multi-format file (`html` + `pdf` blocks) tracks both;
  **a KEY-enumerator regression test proving `findProjectConfigKeyLines` returns NO keys for a
  top-level `format:` block** (dragon 1 lock). GO-LIVE: format values now flow through L1's resolver →
  matcher → diagnostics. *Files:* `project-yaml.ts`, `project-yaml.test.ts`.
  - **DONE looks like:** each new unit test RED-before-GREEN; the KEY-isolation test green; build clean.
  - **Verify:** `npm test` (unit +~6); confirm each RED was shown.

- **L3 — [fixtures + integration, real host] GO-LIVE proof.** New
  `test/fixtures/yaml-project-format-value/{invalid,valid}/_quarto.yml`; a new `describe` in
  `test/integration/suite/yaml-project-value-diagnostics.test.ts`:
  - **(a) invalid fixture** flags **exactly N** wrong per-format option values, each on its value span:
    `html.toc: banana` (bool), `html.df-print: banana` (enum), `html.fig-format: banana` (enum),
    `html.toc-depth: banana` (numeric), `revealjs.transition: banana` (enum), `pdf.number-sections:
    banana` (bool). *(Optional cross-surface bonus: `beamer.aspectratio: banana` — the S139 numeric-member
    matcher on the project surface.)*
  - **(b) valid fixture** produces **ZERO** diagnostics — the FP battery: `html.toc: true`,
    `html.code-fold: show` (the anyOf trap), `html.code-fold: false`, `html.number-sections: false`,
    `html.df-print: kable`, `html.fig-format: svg`, `html.toc-depth: 3`, `html.fig-width: 3.5`,
    the OPEN traps `html.theme: banana` / `html.title: whatever`, the unknown-key trap
    `html.custom-opt: whatever`, the cross-format trap `html.documentclass: article`, the pandoc-layer
    trap `html.toc-depth: 2.5`, a benign multi-line quoted value, and an **unknown-format-name** block
    (`format:\n  banana:\n    toc: true` — silent, safe FN). *(The VALID fixture's contract is "zero of
    OUR diagnostics", NOT "renders clean at quarto" — `toc: 2.5` and the `banana:` block are exit-1 at
    the CLI but deliberate FNs for us — mirror S141's `knitr.cache` VALID-fixture convention.)*
  - **(c)** live-edit drop; **(d)** the `.qmd` filename-gate exclusion.
  - **Every fixture value render-grounded** (invalid → exit-1 SCHEMA; valid → exit-0 or documented
    non-schema exit). *Files:* 2 fixtures + 1 integration test.
  - **DONE looks like:** integration +~N, all green in a real Extension Development Host; fixtures grounded.
  - **Verify:** `npm run test:integration`; re-render each fixture value SINGLE-valued with `quarto render`
    and record exit codes.

- **L4 — [MANDATORY §9 adversarial review].** A multi-lens, `quarto render`-verified panel (§9) + the
  author's own firsthand FP battery. Fold confirmed findings; any surviving cardinal-sin FP is a blocker.
  - **DONE looks like:** panel run, findings re-verified firsthand + folded (or documented as
    refuted/deferred), zero surviving cardinal-sin FPs.

*(Alternative decomposition, acceptable: collapse L1+L2 into one GO-LIVE commit — the whole change is
~4 files. The 4-layer split is recommended for the dormant checkpoint and family consistency; either
respects ≤5 files/commit and per-boundary verify. The dormant-first ORDER is load-bearing: L2's
`VALUE_CONTAINERS` add cannot land before L1's type-widen + resolver branch, or the feature fails to
typecheck / would emit format lines with no resolver.)*

### 4.2 This is a vertical slice, NOT horizontal (pre-empting an FM #25 misread)

Each layer keeps the feature working end-to-end: L1 ships a dormant-but-compiling path; L2 makes format
validation live and unit-proven; L3 proves it in a real host; L4 audits it. "If I stop here, is something
working?" — yes at every boundary. One capability (per-format option value validation in `_quarto.yml`),
one pre-declared layer set.

### 4.3 Deferred to a later session (filed to `BACKLOG.md`, NOT built here)

- **The top-level `format:` scalar name** (`format: banana`) — a deliberate FN on BOTH surfaces (the
  format-name enum is injected after `annotateClosedness`, so `valuesClosed` stays unset —
  `yaml-schema.ts:565-569`; proven NOT-flagged at `yaml-value-diagnostics.test.ts:185-187`). Validating
  it would need the "recognized-closed-keys-only" discipline of the general document-key case (S141
  deferred item 2) AND a closedness decision that risks FP-ing on extension/custom formats. Its own item.
- **Unknown format NAMES as container keys** (`format:\n  banana:`) — quarto rejects these (a KEY-axis
  concern, not value-only). We mirror the `.qmd` surface (no format-name guard), which is never a
  cardinal-sin FP (§2.4). Flagging the *name* is a separate future feature (format-NAME validation).
- **Offline per-format validation** — `CURATED_FORMAT_OPTIONS` (`yaml-schema.ts:394-431`) is not
  annotated with `valuesClosed`, so format validation is a safe FN when the CLI schema fails to load.
  Hand-annotating the curated fallback is a separate, larger change; NOT this slice.
- **Depth-3+ under `format:`** (`format → fmt → object-opt → sub`) — the enumerator caps at depth-2 (safe
  FN, S137). NOT built.
- **Integer-typed pandoc-layer validation** (`toc-depth: 2.5`) — schema accepts a number; pandoc rejects
  downstream. Deliberately NOT flagged (Learning #142, consistent with S130).
- **The pre-existing KEY-enumerator `scanFlow` gap** (`findProjectConfigKeyLines`, filed S135) — untouched.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped/read S142)

**Changed:**
- `src/core/project-yaml.ts`
  - `:18` `PROJECT_CONFIG_CONTAINERS` (KEY set `{project,website,book}`) — **unchanged**.
  - `:30` `VALUE_CONTAINERS` (value set, currently `{project,website,book,execute}`) — **add `"format"`**.
  - `:108`/`:118` `isProjectConfigContainer` (KEY) / `isValueContainer` (VALUE) — **unchanged** (`format`
    joins the set `isValueContainer` reads; the predicate body does not change).
  - `ProjectConfigValueLine.container` (`:133`, per S141) — **widen** to include `"format"`.
  - `findProjectConfigValueLines` — depth machinery + `scanFlow` guard **unchanged**; emits `format`
    depth-2 lines once `"format"` is in `VALUE_CONTAINERS`.
- `src/features/yaml-project-value-diagnostics.ts`
  - `:121-125` field/field-resolution — **add a `format` branch** (Change B) resolving via
    `index.frontMatterKeys(["format", entry.path[0]])`.
  - `:79-90` `resolveProjectValueField` — **unchanged** (NOT used for `format`).

**Reused, UNCHANGED (assert, don't touch):**
- `src/core/yaml-schema.ts` — `frontMatterKeys` format-2 branch `:615-617`; `perFormatOptions` `:574-575`;
  `formatMatches` wiring `:1532`/`:1555-1574`; `toField`/`annotateClosedness`/`annotateScalarType`
  `:1466-1502`/`:972-986`/`:1073-1081`; `CURATED_FORMAT_OPTIONS` `:394-431` (offline, un-annotated — the
  offline-FN reason); top-level `format` field enum injection `:565-569` (the scalar-FN reason).
- `src/core/format-aliases.ts` — `formatMatches` `:68-91`, `expandFormatAliases` `:30-57`.
- `src/core/yaml-value-check.ts` — `isWrongValue` `:46`, numeric branch, numeric-member branch (S139),
  `valueMessage` `:184`.
- `src/features/yaml-diagnostics.ts` — the unknown-KEY feature (must stay blind to `format`).
- `src/core/yaml-context.ts` — `NESTED_CONTAINERS` `:370-395` (the `.qmd`-surface analog; NOT edited —
  the `_quarto.yml` surface uses `VALUE_CONTAINERS`, a separate set).

**Tests / fixtures:**
- `test/unit/project-yaml.test.ts` — add a `format` describe (+ the KEY-isolation lock); today `:218`
  proves `findProjectConfigValueLines("format:\n  html:\n    toc: true")` → `[]` (the L2 RED baseline).
- `test/integration/suite/yaml-project-value-diagnostics.test.ts` — add a `format` describe.
- NEW `test/fixtures/yaml-project-format-value/{invalid,valid}/_quarto.yml`.
- Document-surface precedent to mirror: `test/fixtures/yaml-value-diagnostics/nested-front-matter.qmd`
  + `yaml-value-diagnostics.test.ts:240-284` (the `.qmd` per-format value proof).

**Cycle check:** `src/core/yaml-schema.ts` does not import `project-yaml.ts`; Change B keeps resolution
in the feature (which already imports the reader) → no new core→core edge.

---

## §6 — Alternatives considered (honest)

1. **Add `format` to the shared `PROJECT_CONFIG_CONTAINERS` set** — REJECTED: the KEY enumerator would
   then descend into `format:` and flag unknown per-format option keys, a cardinal-sin FP (quarto accepts
   them, §2.3). `format` must ride `VALUE_CONTAINERS` only (the S141 fork already enforces this).
2. **Route `format` through `resolveProjectValueField`'s `.children` descent** — REJECTED: per-format
   options are NOT the `.children` of a format-name field; they come from `perFormatOptions(fmt)`. The
   `.children` path resolves `undefined` (agent-traced). The format branch must call
   `frontMatterKeys(["format", fmt])` directly.
3. **Add a format-NAME guard** (only resolve options if `fmt` is a recognized format) — REJECTED: it
   would make the `_quarto.yml` surface DIVERGE from the `.qmd` surface (which has no such guard), and it
   buys nothing for FP-safety (an unknown-format block is never a cardinal-sin FP — quarto rejects it
   too, §2.4). Surface parity is a feature, not a bug; the §9 surface-parity lens confirms it.
4. **Also validate the top-level `format:` scalar name** — REJECTED here: a deliberate FN on both
   surfaces (§4.3); bundling it would add a different mechanism (recognized-closed-name discipline) and a
   real FP risk (custom/extension formats). Its own item.
5. **Do `format:` + the general document-key case together** — REJECTED: two capabilities (FM #26). This
   slice is per-format-option values only.

---

## §7 — Failure-mode analysis (the safety story)

The feature only ever flags a value that is (a) a recognized per-format option (`perFormatOptions(fmt)`
returns a field) AND (b) provably CLOSED (`valuesClosed === true`, or numeric via `scalarType`, or a
numeric-member enum). Every uncertainty is a silent skip. Specific traps and why each is safe:

| Trap | Why it could FP | Why it does NOT |
|---|---|---|
| **`theme: banana` / `title: whatever`** | look like bad values | `closed=false`, no `scalarType` → `isWrongValue` skips (grounded exit 0). Locked in the VALID fixture. |
| **`code-fold: show`** | `show` is not a boolean | reader resolves the anyOf → `values=[true,false,show]`, so `show` is a member → skip (grounded exit 0). The primary FP trap; VALID-fixture locked. |
| **`custom-opt: whatever`** (unknown option) | could be flagged as "wrong" | absent from `perFormatOptions` → resolver → `undefined` → skip; quarto accepts it (exit 0). Value-only scope = correctness. |
| **`documentclass: article`** (cross-format, under html) | pdf-only option present under html | absent from `["format","html"]` → skip; quarto accepts (exit 0). |
| **`toc-depth: 2.5`** | looks like a bad integer | schema accepts a number (exit 0 at the schema layer; pandoc rejects downstream) → `isWrongValue` numeric branch accepts `2.5`. Deliberate FN (Learning #142). |
| **unknown format NAME** (`format:\n  banana:\n    toc: true`) | resolving under a non-format | mirrors the `.qmd` surface (no name guard); `toc:true` valid → silent; a wrong option value would flag the OPTION (never a cardinal-sin — quarto rejects the block too). |
| **multi-line / flow value** | a folded continuation looks like a mapping | `scanFlow` guard skips the opener and all continuation lines → silent (safe FN); never emits a folded mapping. |
| **depth-3 object option** (`code-tools.source`) | a grandchild-of-option value | enumerator caps at depth-2 → not emitted → skip (grounded exit 0 anyway). |
| **shared container set (dragon 1)** | KEY feature starts flagging format keys | `format` in `VALUE_CONTAINERS` only; `PROJECT_CONFIG_CONTAINERS` untouched; KEY-isolation regression test. |
| **offline (CLI schema unavailable)** | reader returns un-annotated curated fields | `CURATED_FORMAT_OPTIONS` has no `valuesClosed` → flags nothing (safe FN). Documented; NOT "fixed" here. |
| **`.qmd` double-flag** | two features on one format block | the `.qmd` value feature gates on `languageId==="quarto"`; `_quarto.yml` is `"yaml"` → never runs there. Separate collections. |

**Direction of every uncertainty is false-NEGATIVE** — the family's invariant holds. **New vs the `.qmd`
surface:** this slice introduces NO new FP surface — it routes the project surface's format lines to the
SAME reader+matcher the `.qmd` surface already ships. Any FP would be a pre-existing document-surface bug;
the §9 surface-parity lens asserts the two surfaces agree on the same format block.

---

## §8 — Impact analysis

- **New user-visible behavior:** wrong closed per-format option values in `_quarto.yml` get an Error
  squiggle matching `quarto render`. No behavior change to `.qmd` documents, to
  `project:`/`website:`/`book:`/`execute:` validation, or to the unknown-KEY feature.
- **Performance:** one more recognized container in an existing O(n) single-pass scan; the feature
  already awaits the schema index once. `frontMatterKeys(["format", fmt])` is called per depth-2 format
  line (one `perFormatFields.filter` each) — negligible for a `_quarto.yml`.
- **Docs to reconcile at close-out (Learning #7/#10):** `BACKLOG.md` (this plan's Up-Next item →
  PLANNED-ready; on implementation, flip the S141-handoff "What's next" (1) format half),
  `CHANGELOG.md`, `PROJECT_LEARNINGS.md`, `HANDOFFS.md`, `docs/POSIT-COMPARISON.md` if it asserts anything
  about `_quarto.yml` format validation.

---

## §9 — Verification plan (executor)

- **Per-layer:** the DONE/Verify lines in §4.1.
- **Full matrix at each boundary:** `npm run check-types` + `npm test` (unit) + `npm run test:integration`.
- **Firsthand grounding:** re-render every fixture value SINGLE-valued with `quarto render` 1.7.33 and
  record exit codes (invalid → exit 1 SCHEMA; valid → exit 0, or a documented non-schema exit for the
  `2.5` / unknown-name FN cases). Do NOT trust §2's tables blindly — re-probe. A fresh compiled-reader
  harness (reuse `scratchpad/s142-fmt-reader.ts`) confirms each field's annotation bits.
- **§9 adversarial review (L4, MANDATORY):** an independent multi-lens `Workflow`, each lens
  `quarto render`-verified:
  1. **fp-cardinal** — does the shipped feature flag ANY per-format value quarto accepts? (sweep OPEN
     options `theme`/`title`, unknown options, cross-format options, the `code-fold`/other anyOf(bool+enum)
     forms across `html`/`pdf`/`revealjs`/`beamer`, numeric floats, `toc-depth: 2.5`, quoted forms.)
  2. **container-isolation** — does `findProjectConfigKeyLines` (the KEY feature) still ignore `format`?
     Does adding `format` leak into `project`/`website`/`book` resolution or any other value-enumerator
     consumer?
  3. **surface-parity** — does the `_quarto.yml` result MATCH the `.qmd` result for the same
     `format → fmt → option` block? (they share the reader/matcher — divergence signals a plumbing bug.)
  4. **doc-drift** — §5 inventory accurate; BACKLOG/POSIT-COMPARISON claims reconciled.
- **Runtime smoke (Phase 3E):** the feature changes runtime diagnostics; the L3 integration run in a real
  Extension Development Host IS the smoke test (this project's standard, Learning #3).

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

- **Q1 — invalid fixture: one file with several wrong values, or one-per-file?** Recommend one invalid
  `_quarto.yml` with several wrong per-format values (assert exact count + spans), mirroring
  S135/S137/S141. Note the S139 lesson: quarto reports only the FIRST schema error per render, so ground
  each wrong value with a **single-value** probe, not only the combined file.
- **Q2 — which formats to cover in fixtures?** Recommend `html` (the common set: toc/df-print/fig-format/
  toc-depth) + one `revealjs` (`transition` enum) + one `pdf` (`number-sections`) to prove cross-format;
  optionally one `beamer.aspectratio` (numeric-member, S139) as a cross-surface bonus. The shared matcher
  covers the rest — no per-option fixture needed.
- **Q3 — 4-layer vs 3-layer decomposition (§4.1 note)?** Recommend 4-layer (dormant checkpoint).
  Non-load-bearing; the dormant-first ORDER is the only hard constraint.
- **Q4 — resolver branch inline in the feature vs a pure `core` helper?** Recommend inline in the feature
  (it needs `index`, the reader) — matches the execute precedent (S141 kept routing in the feature) and
  keeps `resolveProjectValueField` pure. The enumerator (the actual new emit) still gets pure RED→GREEN
  unit coverage; L3's real-host integration proves the routing. Revisit only if a third special container
  appears.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. **The shared container set (MEDIUM — the fork already exists, S141).** Add `format` to
   `VALUE_CONTAINERS` (`:30`) ONLY; leave `PROJECT_CONFIG_CONTAINERS` (`:18`) at `{project,website,book}`.
   The KEY enumerator (`findProjectConfigKeyLines`) must never see `format` (else it would flag unknown
   per-format option keys — a cardinal-sin FP, quarto accepts them). **Write the KEY-isolation
   regression test** even though the fork pre-exists (locks it against a future re-merge).
2. **`format` resolves via the FORMAT READER, not `.children` (HIGH).** Per-format options come from
   `frontMatterKeys(["format", fmt])` → `perFormatOptions(fmt)`, NOT from a format-name field's
   `.children`. Do NOT route `format` through `resolveProjectValueField` — its `.children` descent
   resolves `undefined` for format. Add the dedicated branch (Change B).
3. **Depth-1 format lines (the format NAME) must resolve to `undefined` (skip).** The format branch
   handles only `path.length === 1` (depth-2). A depth-1 line (`html: default`, `path=[]`) → skip. The
   top-level `format:` scalar is a deliberate FN on both surfaces — do NOT try to validate it.
   **(2026-07-24 correction: this was the scope boundary for THIS per-format-OPTION slice. The
   top-level scalar `format:` NAME itself is now validated as Combo 3, SHIPPED Session 152 — but the
   `html: default` mapping-KEY case named here stays a deliberate FN, Combos 2 & 4.)**
4. **Offline is a safe FN for `format`; do NOT "fix" it.** `CURATED_FORMAT_OPTIONS` is un-annotated (no
   `valuesClosed`), so format validation flags nothing offline. Unlike execute (offline-robust). This is
   correct-by-design (a safe FN); hand-annotating the curated fallback is a separate, larger change.
5. **`code-fold` (and any anyOf(bool+enum)) — trust the reader, VALID-fixture-lock `show`.** The reader
   resolves `code-fold` to `values=[true,false,show]` (verified). `code-fold: show` MUST NOT flag; put it
   in the VALID fixture. If it flags, the reader/matcher diverged from `quarto` — re-ground before
   proceeding (do NOT special-case in the feature).
6. **Dormant-first ORDER (L1 before L2).** L1 = type-widen + the format resolver branch (compiles because
   `format` is handled before the `projectFields` call). L2 = the `VALUE_CONTAINERS` add (go-live). Never
   the reverse: L2 alone would emit format lines with no resolver / a type error.
7. **`toc-depth: 2.5` is a PANDOC-layer error, not schema.** The schema accepts a number; the matcher
   accepts `2.5`. Do NOT flag it (Learning #142). VALID-fixture-lock it.
8. **Ground every fixture value single-valued** (S139 lesson): quarto stops at the first schema error per
   render, so a combined invalid file does not prove each row rejects on its own.
9. **Do not touch the reader / matcher / message.** If you find yourself editing `perFormatOptions`,
   `isWrongValue`, `annotateClosedness`, or `valueMessage`, stop — this slice needs none of that. A needed
   change there means the surface diverges from §2 and must be re-grounded before proceeding.
10. `BACKLOG:NNN` is a LINE NUMBER.

---

## Provenance — how this plan was grounded (Session 142)

- **Firsthand `quarto render` 1.7.33 probes** (`scratchpad/fmtgnd/probe.sh` → `scratchpad/s142-GROUNDING.md`):
  the per-format value matrix (§2.2/§2.3) across `html`/`pdf`/`revealjs` — closed bools
  (toc/number-sections/code-fold), the `code-fold` anyOf(bool+`show`) incl. `hide`-reject/quoted-reject,
  closed enums (df-print/code-overflow/fig-format/transition), numerics (toc-depth/fig-width incl. float),
  OPEN traps (theme/title), unknown option, cross-format option, the pandoc-layer `toc-depth: 2.5`, the
  scalar/container split, and the unknown-format-name block — each with its exit code and layer.
- **Fresh compiled-reader harness** (`scratchpad/s142-fmt-reader.ts` → `.cjs`, against the CURRENT
  `src/core/yaml-schema.ts` `parseSchemaIndex` + the installed 1.7.33 schema): printed each field's
  `valuesClosed`/`acceptsBoolean`/`scalarType`/`numericMemberEnum`/`values` for the FP-critical set —
  **1:1 with the CLI ground truth** (§2.2/§2.3), incl. `code-fold=[true,false,show]` and the OPEN/absent
  skips.
- **Codebase inventory** (three parallel read-only agents, cross-checked + spot-verified firsthand):
  the `.qmd`-surface per-format value path (`yaml-value-diagnostics.ts:150-169`, test `:240-284`), the
  reader walk (`frontMatterKeys` `:583-636`, format-2 branch `:615-617`, `perFormatOptions` `:574-575`,
  annotation choke points `:1466-1502`), the project value enumerator + the value/KEY fork
  (`project-yaml.ts` `VALUE_CONTAINERS:30`/`PROJECT_CONFIG_CONTAINERS:18`, depth-2 machinery), the feature
  routing + resolver (`yaml-project-value-diagnostics.ts:121-125`/`:79-90`), and the deliberate scalar-FN
  (`yaml-schema.ts:565-569`, test `:185-187`). Load-bearing file:lines re-read firsthand (FM #11).
- **Mandatory adversarial plan review** (`Workflow` `wf_4c1ebefd-c10`, S142): a 4-lens,
  `quarto render`-verified panel, each lens independently re-grounding firsthand —
  **(1) fp-cardinal** (hunt a per-format value quarto ACCEPTS that the design would flag, across
  html/pdf/revealjs/beamer/docx/gfm — enum case/alias, YAML-1.1 booleans, numeric keywords, quoted,
  cross-format, list/mapping, trailing-comment), **(2) enumerator-reality** (does adding `"format"` to
  `VALUE_CONTAINERS` actually emit the depth-2 record, with the KEY enumerator unaffected),
  **(3) resolver-parity** (Change B resolves via `frontMatterKeys(["format", fmt])`, shares the `.qmd`
  reader path, and the L1 typecheck ordering holds), **(4) doc-drift** (§5 file:line citations + the
  deferred-set reasoning). **Result: all 4 lenses PLAN-SOUND — 0 cardinal-sin FPs** across the fp-cardinal
  battery; the enumerator-reality lens **firsthand-confirmed** the depth-2 emit by temporarily adding
  `"format"` to `VALUE_CONTAINERS`, observing the exact `{container:"format", path:["html"], key:"toc"}`
  record, and reverting. One **LOW** doc-drift finding folded: §4.1-L2 now cites `project-yaml.test.ts:218`
  precisely (it asserts the sibling `toc: true` returns `[]`, the value-blind RED baseline; the L2 RED adds
  the `toc: banana` assertion). No design change resulted — the panel converged with the author's grounding.
- **The mandatory §9 IMPLEMENTATION review still applies** at the implementing session's L4 (a shipped
  diff to attack). This planning panel front-loads the FP surface; the L4 panel re-verifies it live.
- **Deliverable = this plan.** No code shipped (FM #18/#19). Implementation is a separate session.
