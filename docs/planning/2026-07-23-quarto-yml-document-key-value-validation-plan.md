# Plan — general top-level document-key VALUE validation in `_quarto.yml`

**Session:** 146 (PLANNING). **Deliverable:** this plan. **Implementation:** separate later sessions.
**Workstream:** Planning (`SESSION_RUNNER.md` §Planning Sessions + `ARCHITECTURE_WORKSTREAM.md`),
under the project-wide strict-TDD gate.
**Feature family:** the YAML value-validation family (S124/125/128/130/132/135/137/139/141/143/145) —
this is its **twelfth slice** and its **fifth `_quarto.yml`-surface** slice.
**Origin:** the "general document-key case", deferred as *"harder — its own plan"* by S135, S141
(§4.3) and S143; operator picked it via `AskUserQuestion` at S146 Phase 0 (Active empty).

---

## §0 — Decision at a glance

Flag a **wrong CLOSED/numeric value of a recognized general document key written at column 0 of
`_quarto.yml`** — `toc: banana`, `number-sections: yes`, `fig-width: wide`, `code-fold: banana`,
`df-print: KABLE` — with an Error squiggle on the value span, matching what `quarto render` 1.7.33's
`_quarto.yml`-schema layer (`readAndValidateYamlFromFile`) rejects: the **exact** layer S135/S137/
S139/S141/S143 already target (§2.1, verbatim error captured).

**Headline 1 — this ships with ZERO new matcher, reader, or message code.** The resolution reader
(`SchemaIndex.frontMatterKeys([])`), the matcher (`isWrongValue`) and the message (`valueMessage`)
are the **same three** the `.qmd` document surface has used for top-level front-matter values since
**S125**. Quarto's behavior for these keys in `_quarto.yml` is a **1:1 match** with that annotation
(§2.3: 170/170 wrong-value probes schema-rejected, 169/170 valid-value probes exit 0, and an
exhaustive enum-parity check against quarto's *own* expectation clauses). The gap is purely
**enumerator plumbing**: `findProjectConfigValueLines` classifies a column-0 line as *container
bookkeeping only* and never emits a column-0 **scalar** (`project-yaml.ts:221-228`).

**Headline 2 — grounding + the §9 review uncovered THREE live cardinal-sin false positives.** None is
introduced by this slice; all three are pre-existing and firsthand-verified in both directions
(quarto accepts / we flag):

- **Defect A — the null-enum-member drop (CROSS-SURFACE, live on `.qmd` TODAY).** `valuesOfSchema`
  (`yaml-schema.ts:827-829`) silently drops a literal `null` member from an `enum`, while
  `closednessOfSchema` still marks the field CLOSED. Quarto **accepts** `auto-play-media: null`
  (and `~`/`Null`/`NULL`); we flag it. Exactly **3** schema fields in all of Quarto 1.7.33 are
  affected, on the `.qmd` top-level (S125) and per-format (S143) surfaces — and the new
  `_quarto.yml` column-0 surface would inherit it. **This slice must not go live before A is
  fixed.** A is fully specified as a **prerequisite slice (§4.0)** so no extra planning session is
  needed.
- **Defect B — the missing column-0 continuation-guard arming (THIS surface).** The column-0 branch
  `continue`s before the `scanFlow` arming, so a mapping-looking line **folded inside a column-0
  multi-line quoted value — or inside a column-0 flow collection —** is read as a real child and
  flagged, on a document quarto renders **exit 0**. B is **fixed in-slice**: the same restructure that
  emits column-0 scalars routes them through the shared arming tail. (The `.qmd` surface got this fix
  at S130; `_quarto.yml` never did.) **The arming must use the NARROWED opener rule of §3.2** — the
  shipped whole-token arming would swallow the rest of the file after an ordinary
  `title: Don't Panic` (§2.6).
- **Defect C — the key/value SEPARATOR (CROSS-SURFACE, live on `.qmd` and on `_quarto.yml`'s
  `execute:`/`format:` containers TODAY).** YAML's separator is a colon followed by space/tab (or a
  colon at end of line), but every value enumerator splits at `lineText.indexOf(":")`
  (`project-yaml.ts:260`, `yaml-context.ts:421`). On a line like `toc:: true` quarto's key is
  `toc:` — unknown on an OPEN key set, so it renders **exit 0** — while we resolve `toc` and flag the
  bogus token `: true`. Verified firsthand on both shipped open surfaces. Like A, this must be fixed
  before the column-0 arm lands on the most open surface there is (§4.0 P2).

**The two changes (this slice):**
1. **Enumerator** (`findProjectConfigValueLines`, `src/core/project-yaml.ts`): a column-0 line that
   is **not** a pure block-opener falls through to the **existing, shared** emission tail and emits
   `container:"document", path:[]` — which also arms the continuation guard (Defect B).
2. **Feature** (`yaml-project-value-diagnostics.ts`): route `container === "document"` to
   `index.frontMatterKeys([])`; everything downstream is unchanged.

**Scope is VALUE-only, and that is a correctness requirement, not a scope choice** (§2.4): the top
level of `_quarto.yml` is an **OPEN** set — `custom-thing: whatever` renders exit 0 — so KEY
validation there is a *non-starter*, not a deferral. The scalar `format:` NAME at column 0
(**Combo 3** of the S145 backlog item) is **explicitly not built here** (§4.3), though this slice is
the enumerator work it was blocked on.

---

## §1 — Context

### 1.1 Problem

A `_quarto.yml` may set **document-level defaults at its top level** — `toc: true`,
`number-sections: true`, `code-fold: show`, `fig-width: 6` — alongside the project blocks. Quarto
schema-validates those values (§2.1), but this extension gives **no editor feedback** for them: the
`.qmd` value feature gates on `languageId === "quarto"` (a `_quarto.yml` is `"yaml"`), and the
`_quarto.yml` value feature only enumerates lines **inside** a recognized top-level container
(`project`/`website`/`book` since S135/S137, `execute` since S141, `format` since S143). So
`toc: banana` at column 0 renders exit 1 at the CLI and shows no squiggle in the editor. For the
operator's dominant workflow (multi-file books/websites, where `_quarto.yml` carries the shared
document defaults) this is the largest remaining hole in the family.

### 1.2 Constraints (standing, binding)

- **Strict TDD** (project-wide, `CLAUDE.md`): one RED before each GREEN, vertical slices,
  ≤5 files per commit.
- **False-negative only** (the hard product rule): NEVER flag a value quarto accepts. Everything the
  matcher is unsure about returns `false`. This is the whole safety story of the family — and it is
  why Defect A blocks go-live rather than being filed for later.
- **Look-but-don't-copy** (Learning #1): key names and value sets are uncopyrightable facts grounded
  against the installed 1.7.33 schema + `quarto render`, never Posit's AGPL extension.
- **1-and-done** (FM #17/#26): ONE capability per session. The prerequisite null fix (§4.0) and this
  slice are **two sessions**, not one.
- **Plan ≠ implementation** (FM #18/#19): this session's deliverable is the plan; NO code.

### 1.3 Current state — what to build ON (do NOT rebuild)

- **The matcher** `isWrongValue(rawToken, field)` (`src/core/yaml-value-check.ts:46`) — surface-
  agnostic; node-property skip `:47`, numeric branch `:57`, closed-enum gate `:63`, numeric-member
  `:66`, boolean spellings `:19`, `unquote:164`. **Unchanged by this slice** (Defect A changes it —
  see §4.0).
- **The message** `valueMessage(rawToken, key, field)` (`:184`) — numeric-first dispatch.
  **Unchanged by this slice.**
- **The reader** `SchemaIndex.frontMatterKeys([])` (`src/core/yaml-schema.ts:503` / impl `:599-608`
  → `topLevelFields:582`) → the parsed 378 top-level document fields, or `CURATED_FRONTMATTER_KEYS`
  (`:283-301`) offline. **Unchanged.** This is the identical call the `.qmd` feature makes at
  `src/features/yaml-value-diagnostics.ts:126`.
- **The `_quarto.yml` value feature** `registerYamlProjectValueDiagnosticsFeature`
  (`src/features/yaml-project-value-diagnostics.ts:172`) — filename-gated (`:54`), own collection
  `quarto-project-value` (`:43-45`), debounced, generation-guarded; resolves each value line at
  `:126-145`. **One routing branch is added.**
- **The `_quarto.yml` value enumerator** `findProjectConfigValueLines`
  (`src/core/project-yaml.ts:188`) — a `scanFlow`-aware depth-1+depth-2 bare-YAML scanner. **Its
  column-0 branch (`:221-228`) is restructured.**
- **The `.qmd` counterpart already exists and is the model:** `findFrontMatterValueLines`
  (`src/core/yaml-frontmatter-values.ts:50`) enumerates column-0 front-matter scalars and **arms the
  continuation guard at `:101-110`** — the arming this surface lacks (Defect B).

---

## §2 — Ground truth (empirical: `quarto render` 1.7.33 + the installed schema + a compiled reader harness)

All probes: a fresh two-file project (`_quarto.yml` + `doc.qmd`), `quarto render doc.qmd`, one
probed line per render (S139 lesson: quarto reports only the FIRST schema error per render, so a
combined file does not prove each row on its own). Harnesses + raw TSVs in
`scratchpad/dockey146/` (`GROUNDING.md` indexes them).

### 2.1 Quarto validates top-level document-key values in `_quarto.yml` at the target layer — confirmed

`toc: banana` at column 0 of `_quarto.yml`:

```
ERROR: Project …/_quarto.yml validation failed.
In file _quarto.yml
(line 1, columns 6--11) Field "toc" has value banana, which must instead be `true` or `false`
1: toc: banana
        ~~~~~~
  at readAndValidateYamlFromFile (file:///Applications/quarto/bin/quarto.js:20673:15)
```

Same `readAndValidateYamlFromFile` layer as every prior `_quarto.yml` slice, and the error carries a
**column span on the value token** — the squiggle target.

### 2.2 The flag surface (from the LIVE reader, not a sample)

`frontMatterKeys([])` → **378** top-level document fields:

| class | count | matcher path | examples |
|---|---|---|---|
| CLOSED enums (`valuesClosed`, non-empty `values`) | **138** | enum / boolean-enum | `toc`, `number-sections`, `code-fold`, `df-print`, `fig-format`, `citeproc`, `pdf-engine`, `transition` |
| NUMERIC (`scalarType:"number"`) | **32** | numeric | `fig-width`, `fig-height`, `toc-depth`, `columns`, `number-depth`, `toc-expand` (also boolean) |
| NUMERIC-MEMBER enum | **1** | numeric-member coercion | `aspectratio` (`43`/`169`/…) |
| OPEN (never flagged) | **208** | skipped by `isWrongValue`'s `valuesClosed` gate | `title`, `author`, `bibliography`, `theme`, `editor`, `engine`, `crossref`, `logo` |

`format` is present but **not closed** (`valuesClosed` unset, 65 injected names) — the S143/S145
property that keeps the scalar `format:` NAME a deliberate FN on this surface (§4.3, Combo 3).
`project`/`website`/`book`/`execute` are **absent** from the document set, so a column-0 scalar with
one of those names resolves to `undefined` → skip (quarto rejects them; a safe FN).

### 2.3 Exhaustive accept/reject batteries — 1:1 with the matcher

Probe lists were generated **from the reader itself** (`cases.ts`), so coverage is the exact flag
surface, not a hand-picked sample:

- **Wrong values — 170/170 rejected at the SCHEMA layer.** One `<field>: banana` probe for every
  closed/numeric field (138 + 32). Every one exits 1 via `readAndValidateYamlFromFile`. **Zero**
  fields where quarto accepts a value we would flag.
- **Valid values — 169/170 exit 0.** One valid-member probe per field. The single exception,
  `ipynb-output: none`, is **schema-ACCEPTED** and rejected further downstream by pandoc's own
  decoder (`Aeson exception … expected a String with the tag of a constructor`) — a different layer
  than the one we mirror, so staying silent is correct.
- **Enum parity against quarto's OWN expectation clause** (`parity.ts`, parsing
  `which must instead be …` out of all 170 rejections): 32 prose "a number" clauses all correspond
  to fields we treat as numeric; every enumerated clause is a **subset of** our `values` list —
  **except 3**, which list `null` and we do not. That is Defect A (§2.5).

### 2.4 Safe cases the matcher must (and does) leave alone — the cardinal-sin traps

All firsthand (`edge.tsv`, `edge2.tsv`); "we" = the shipped matcher + the planned column-0 emission.

| shape | quarto | us | why safe |
|---|---|---|---|
| `custom-thing: whatever`, `my-metadata: banana` | **exit 0** (top level is OPEN) | silent | unknown key → `undefined` → skip. **KEY validation here is a non-starter.** |
| `title: banana`, `theme: banana`, `engine: banana` | exit 0 | silent | open fields carry no `valuesClosed` |
| `toc: TRUE` / `True` | exit 0 | silent | `BOOLEAN_SPELLINGS` (`yaml-value-check.ts:19`) |
| `toc: yes` / `no` / `on` / `off` | **exit 1** | flag | YAML-1.2 core: not booleans. Parity, not FP. |
| `toc: "true"` / `'false'` | **exit 1** | flag | quoted boolean is a string. Parity. |
| `toc: &a true`, `toc: !!bool true` | exit 0 | silent | node-property skip (`:47`) |
| `code-copy: Hover`, `df-print: KABLE` | **exit 1** | flag | membership is case-SENSITIVE both sides |
| `fig-width: "6"` | **exit 1** | flag | quoted scalar is a string for a number field |
| `fig-width: 6.5` / `6` / `1_0` | exit 0 | silent | `NUMBER_LITERAL` covers underscores |
| `aspectratio: 169` / `169.0` | exit 0 | silent | numeric-member coercion (S139) |
| `aspectratio: "169"` | **exit 1** | flag | quoted form rejected |
| `toc-expand: 3` / `true` | exit 0 | silent | number-OR-boolean field |
| `toc: true # comment` | exit 0 | silent | `valueSlotAfterColon` strips the unquoted trailing comment |
| `"toc": banana` / `'toc': banana` | **exit 1** | flag | the emission unquotes the key (`unquoteKey:359`) |
| `toc:` (empty value) | **exit 1** | silent | empty token → not emitted. Deliberate safe FN. |
| `project: banana`, `website: banana`, `book: banana`, `execute: banana` | **exit 1** | silent | absent from the document field set → safe FN |
| `format: banana`, `format: htlm` | **exit 1** | silent | `format` is not closed → Combo 3, deferred (§4.3) |
| `project:` / `website:` / `execute:` / `format:` block-openers | n/a | not emitted | `mappingContainerKey` (`yaml-context.ts:294`) — a pure opener has no scalar |
| a multi-line quoted / flow value at column 0 | exit 0 | not emitted; continuation lines skipped | the arming this slice adds (Defect B) |
| `toc:: true`, `fig-width:: 6`, `toc:x: banana` | **exit 0** (quarto's key is `toc:`/`toc:x`, unknown on an OPEN set) | **flags today on `.qmd`/`execute:`; would flag here** | Defect C — the separator guard of §2.8 / §4.0 P2 |
| `toc:banana` (no space after the colon) | exit 1 (not a mapping at all — a scalar document) | silent under the separator guard | a safe FN, the guard's only cost |
| `title: Don't Panic` at column 0 | exit 0 | must NOT arm the continuation guard | the narrowed opener rule (§3.2); the shipped whole-token arming would swallow the rest of the file |

### 2.5 🔴 Defect A — the null-enum-member drop (cross-surface, PRE-EXISTING, LIVE on `.qmd` today)

**Root cause.** `valuesOfSchema` (`yaml-schema.ts:827-829`) maps enum members through
`scalarToYaml` (`:777-788`, which returns `null` for a JSON `null`) and then **filters those out**,
while `closednessOfSchema` (`:883`) still reports the enum CLOSED. A field whose schema is
`enum: [null, true, false]` therefore ships as `values:["true","false"], valuesClosed:true` —
and the matcher flags the very value quarto lists as valid.

**Grounded behavior** (`null.tsv`, `null2.tsv`, `qmdprobe.sh`):

| probe | `_quarto.yml` | `.qmd` front matter | our matcher |
|---|---|---|---|
| `auto-play-media: null` | exit 0 | exit 0 | **FLAGS** ⇠ cardinal-sin FP |
| `auto-play-media: ~` / `Null` / `NULL` | exit 0 | exit 0 | **FLAGS** ⇠ cardinal-sin FP |
| `auto-play-media: banana` | exit 1 (`must instead be one of: `null`, `true`, `false``) | exit 1 | flags (correct) |
| `auto-play-media: NuLl`, `"null"` | exit 1 | exit 1 | flags (correct) |
| `toc: null` / `~` / `Null` / `NULL` | exit 1 | exit 1 | flags (correct — no null arm) |

**Blast radius — exactly 3 fields in all of Quarto 1.7.33** (`nullscan.ts` walks the whole resource
file for null-admitting enums): `auto-play-media`, `preload-iframes`, `ipynb-shell-interactivity`.
Per shipped surface: `frontMatterKeys([])` **3** (`.qmd` top level, S125 — **live FP today**, proven
by `qmdsim.cjs`), per-format options **1–3** depending on format (`revealjs` 3, others 1 — S143, both
surfaces), cell options **0**, curated `execute` **0**, `projectFields` **0**. The planned column-0
surface would add a fourth exposure.

> **Correction (Session 147, while implementing §4.0 — the count above is right about the FP, wrong
> about the schema).** "Exactly 3 fields in all of Quarto 1.7.33" is the count of fields that admit
> null **and are validated**. **Four** names admit a literal null: the three above plus `output-file`
> (`ref: pandoc-format-output-file`), which resolves **OPEN** and so was never validated and never a
> false positive. S146's `nullscan.ts` could not see it because its walk treated `node.ref` as an
> object when the DSL makes it a **string**, so it never resolved into `definitions.yml`. This is
> direct evidence for the §4.0 L1 requirement to walk EVERY arm: the shipped `acceptsNullOfSchema`
> resolves `ref`, and a null-admitting enum moving behind one is now caught. The FP counts, the
> per-surface blast radius, and the design in §4.0 are all unaffected.

**Consequence for this plan:** the general document-key slice cannot go live before A is fixed, or
it knowingly ships a cardinal-sin FP on a new surface. A is specified as a prerequisite slice in
**§4.0** (its own session — the S139 precedent for a cross-surface correctness fix).

### 2.6 🔴 Defect B — the missing column-0 continuation-guard arming (this surface, PRE-EXISTING)

`findProjectConfigValueLines` arms `scanFlow` **only for values it emits** (`:282-299`). Its column-0
branch (`:221-228`) `continue`s first, so a column-0 scalar never arms anything. Verified live
(`sim.cjs`, and `quarto render` firsthand):

```yaml
title: "multi
website:
  page-navigation: banana
  more: text"
```

`quarto render` → **exit 0** (the whole thing is one `title` string). Shipped code → **flags**
`Value banana is not valid for "page-navigation"`. A cardinal-sin FP on a document quarto accepts —
the exact class the `.qmd` surface fixed at S130 (`yaml-frontmatter-values.ts:101-110`) and the
depth-2 surface fixed at S137, which this surface never received at column 0.

A second shape — a column-0 **flow** collection folding a container-looking line — is also
mis-scanned. The naive form is merely invalid YAML (`YAMLException: missed comma between flow
collection entries`, exit 1 at the parse layer), **but a comma-separated variant is VALID YAML that
quarto renders exit 0 and the shipped enumerator still flags** (§9 review, verified independently:
flow-sequence, flow-map, bracket-on-its-own-line, and the same against `execute:` — four shapes). So
the flow variant is a genuine cardinal-sin FP too, not noise. The same arming removes both.

**B is fixed in-slice**, because the fix *is* the restructure this slice needs: routing column-0
scalars through the shared emission tail arms the guard for them (§3.2 Change A) — **with the
narrowed opener rule**, without which the fix trades one defect for a worse one:

> **The arming rule must narrow, not widen.** `scanFlow` scans the WHOLE token and treats any
> unmatched `'`/`"`/`[`/`{` anywhere in it as opening a multi-line value. At column 0 that is
> catastrophic: an ordinary `title: Don't Panic` (quarto exit 0) arms a phantom open quote and the
> continuation guard then swallows **every remaining line of the file**, silently disabling all
> shipped `project:`/`website:`/`book:`/`execute:`/`format:` value validation below it — and a
> column-0 `title:`/`description:` above the container blocks is the single most common `_quarto.yml`
> shape. Verified: with the verbatim arming, `title: Don't Panic` + `website:\n  page-navigation:
> banana` drops the true positive the shipped code reports today. (The same over-arming already
> exists for INDENTED values — verified — but there its blast radius is one container, not the file.)
> **Rule:** strip an optional leading node property (`&anchor `/`!tag `), then arm only if the first
> remaining character is `"`, `'`, `[` or `{`. Verified against 13 tokens: it preserves every shipped
> opener case (`"a long title that wraps`, `'wraps`, `[`, `{a: 1,`, `&a {`, `"nav\`) and every
> non-opener (`&a sm`, `[edit, source]`, `"closed"`, `banana`), while correctly refusing to arm on
> `Don't Panic` and `Panic [1`.

### 2.7 Reachability

Column-0 document keys are the normal way a Quarto **book/website** project sets shared defaults —
`toc`, `number-sections`, `bibliography`, `csl`, `code-fold`, `fig-width` sit at column 0 of
`_quarto.yml` in Quarto's own project templates. The 3 committed `_quarto.yml` fixture files that
carry column-0 scalars carry 4 of them, all open keys (`bibliography` ×3, `csl` ×1) — representative: the
open keys dominate, and the closed ones (`toc`, `number-sections`, `code-fold`) are exactly where a
typo is silent today.

### 2.8 🔴 Defect C — the key/value separator (CROSS-SURFACE, PRE-EXISTING, live on TWO shipped surfaces)

YAML's block-mapping separator is `:` followed by **space, tab, or end of line**. Every value
enumerator instead splits at the first colon (`project-yaml.ts:260`
`lineText.indexOf(":", indent)`; `yaml-context.ts:421` `topLevelSlots`). So on `toc:: true` quarto's
key is `toc:` while ours is `toc`, and our value token is the bogus `: true`.

The consequence is asymmetric, and that is what makes it a cardinal-sin FP: on a **closed** key set
(`website:`/`project:`) quarto rejects the unknown `page-navigation:` key, so both sides agree; but on
an **OPEN** key set quarto simply accepts the odd key and renders **exit 0** while we flag it — and
the surfaces this slice touches are the openest there are. Verified firsthand:

| probe | surface | quarto | shipped/planned code |
|---|---|---|---|
| `toc:: true`, `toc:: banana` | `_quarto.yml` column 0 (this slice) | **exit 0** (`'toc:': true` lands in metadata) | planned code **FLAGS** `Value : true is not valid for "toc"` |
| `toc:: true`, `toc:: banana` | `.qmd` front matter (S125, SHIPPED) | **exit 0** | **FLAGS today** |
| `echo:: true`, `echo:: banana` under `execute:` | `_quarto.yml` (S141, SHIPPED) | **exit 0** | **FLAGS today** |
| `page-navigation:: true` under `website:` | `_quarto.yml` (S135) | exit 1 (closed key set) | flags — agreement, not an FP |
| `toc:banana` (no space) | `_quarto.yml` column 0 | exit 1 (a scalar document, not a mapping) | silent under the guard — a safe FN |

**Fix:** after the colon scan, require the next character to be a space, a tab, or absent. One line in
the shared tail covers the new column-0 arm *and* the shipped `execute:`/`format:` surfaces; the same
guard in `topLevelSlots` covers the `.qmd` surfaces. Its only cost is the `toc:banana` safe FN above.
Because it changes SHIPPED behavior on other surfaces, it belongs in a prerequisite slice (§4.0 P2),
exactly like Defect A.

---

## §3 — Decision (architecture)

### 3.1 Feature shape — one more *level* on the same surface, same shared tail

The `_quarto.yml` value feature's shape is "enumerate `{container, path, key, value}` lines → resolve
each to an annotated `SchemaField` → `isWrongValue` → `valueMessage` → squiggle". S141 added a
container (`execute`), S143 added another (`format`). This slice adds the **document root itself** as
a synthetic container `"document"`, whose fields come from `frontMatterKeys([])` — the reader method
the `.qmd` surface already uses for exactly these keys. Nothing downstream of field resolution
changes.

### 3.2 The two changes

**Change A — the enumerator emits column-0 scalars (and arms the guard for them).** In
`findProjectConfigValueLines` (`src/core/project-yaml.ts:188`), the column-0 branch currently is:

```ts
if (indent === 0) {
  const key = mappingContainerKey(lineText);
  currentContainer = key !== null && isValueContainer(key) ? key : null;
  containerIndent = null;
  childKey = null;
  childIndent = null;
  continue;                       // ← a column-0 SCALAR dies here: never emitted, never armed
}
```

Restructure so that a column-0 line which is **not** a pure block-opener falls through to the
**existing shared emission tail** (`:257-307`) with a synthetic container:

```ts
// BOTH declarations move ABOVE the branch (today `path` is declared at :237, BELOW it —
// assigning it inside the column-0 branch as-is is a TDZ error, TS2448).
let path: string[] | null = null;
let documentLevel = false;
if (indent === 0) {
  const key = mappingContainerKey(lineText);
  currentContainer = key !== null && isValueContainer(key) ? key : null;
  containerIndent = null;
  childKey = null;
  childIndent = null;
  if (key !== null) {
    continue;                                    // a pure block-opener has no scalar value
  }
  documentLevel = true;                          // a column-0 `key: value` → the document root
  path = [];
} else if (currentContainer === null) {
  continue;
} else {
  // UNCHANGED, but it must stay INSIDE this else — including the `containerIndent` bootstrap
  // that today sits between the column-0 branch and the classification (`:232-234`). Left
  // outside, `containerIndent` is `null` on the column-0 path and the `indent > containerIndent`
  // comparison stops type-checking (TS18047).
  if (containerIndent === null) { containerIndent = indent; }
  /* …the existing depth-1 / depth-2 classification, verbatim… */
}
```

and emit `container: documentLevel ? "document" : currentContainer`. **One emission tail, not a
second grammar** (§6 alternative 2): the sequence-item skip (`:257`), colon scan (`:260`), key
unquoting (`:264`/`:359`), `valueSlotAfterColon` (`:268`), empty-token skip (`:270`), `scanFlow`
arming (`:282-288`) and multi-line-opener skip (`:289-299`) are reused — which is precisely what
fixes Defect B and keeps this surface's value grammar single-sourced.

**Two corrections to "reused verbatim", both required (§2.6/§2.8), both inside that same tail:**

```ts
const colon = lineText.indexOf(":", indent);
if (colon < 0) { continue; }
const after = lineText[colon + 1];                       // ← Defect C (ships in P2, §4.0)
if (after !== undefined && after !== " " && after !== "\t") { continue; }
…
// ← Defect B's arming, NARROWED (§2.6): only a token that OPENS a quoted/flow scalar arms the
//    continuation guard. A plain scalar's inner apostrophe/bracket is literal text.
const opener = rawToken.replace(/^(?:[&!][^\s]*\s+)+/, "")[0];
if (opener === '"' || opener === "'" || opener === "[" || opener === "{") {
  const s = scanFlow(rawToken, 0, null);
  if (s.depth > 0) { flowDepth = s.depth; }
  if (s.quote !== null) { openQuote = s.quote; }
  if (s.depth > 0 || s.quote !== null) { continue; }     // unresolvable opener — never emit
}
```

The narrowing also *restores* true positives the shipped indented path drops today (a
`  title: Don't Panic` currently swallows the rest of its container) — a strict improvement in the
same direction, but note it as a deliberate behavior change when it lands.

Type changes: `ProjectConfigValueLine.container` (`:142`) and the `currentContainer` local
(`:191`) gain `"document"`.

**Change B — the feature routes `"document"` to `frontMatterKeys([])`.** In
`computeProjectValueDiagnostics` (`src/features/yaml-project-value-diagnostics.ts:92`), the
container switch at `:126-145` gains a first arm:

```ts
if (entry.container === "document") {
  // A column-0 document key: the SAME reader the .qmd top-level surface uses (S125,
  // yaml-value-diagnostics.ts:126). `path` is always [] here. An unknown key (the OPEN top
  // level), an open field, or a valid value all skip.
  field = documentFields.find((f) => f.name === entry.key);
} else if (entry.container === "format") { … } else { … }
```

with `const documentFields = index.frontMatterKeys([]);` hoisted above the loop.
`resolveProjectValueField` (`:79`) is **unchanged** and is not used for this arm (path is always
`[]`). `projectFields(entry.container)` (`:143`) keeps its three-container signature — the widened
union makes the compiler force this branch, which is the L1 dormancy property (§4.1).

### 3.3 Data flow (a new level, the SAME reader/matcher/message tail)

```
_quarto.yml text
  → findProjectConfigValueLines        [Change A: emits container:"document", path:[] for col-0 scalars
                                        AND arms the scanFlow guard for them — Defect B]
  → (feature) route by container       [Change B: "document" → frontMatterKeys([])]
  → isWrongValue(rawToken, field)      [UNCHANGED — closed-enum / numeric / numeric-member branches]
  → valueMessage(rawToken, key, field) [UNCHANGED]
  → Error diagnostic on the value span [UNCHANGED — quarto-project-value collection]
```

### 3.4 Why the document root is a *container* value, not a second enumerator

A second, independent column-0 scanner would have to duplicate the flow/quote continuation state —
and could **disagree** with the container scanner about which lines are real, which is how a folded
line becomes a false child (Defect B in a new guise). The continuation state is a property of the
file, not of a level, so it must live in one forward pass. This also matches how the `.qmd` surface
is *not* structured (three separate enumerators there share no state because front matter, cells and
nested values are disjoint regions) — here they are the same region.

---

## §4 — Scope

### 4.0 PREREQUISITE slice P (its own session, before this one): the null-arm fix

**Why separate:** it changes SHIPPED behavior on two other surfaces (`.qmd` top-level, per-format
both surfaces), which this slice's fixtures do not cover; it is a cross-surface *correctness* fix,
not a coverage slice — the exact class S139 gave its own plan and session ("General numeric-member-
enum matcher fix (cross-surface, PRE-EXISTING)"). Bundling it here would be two capabilities in one
session (FM #26). It needs **no further planning session**: the design below is complete and
grounded.

**Recommended design (option ii — precise, mirrors the existing `acceptsBoolean` machinery):**

- **L1 [INERT]** — `SchemaField.acceptsNull?: boolean` (a sibling of `acceptsBoolean:111`), set by
  the annotator when the resolved schema admits a literal `null` member. **Derive it by walking the
  SAME arms `valuesOfSchema`/`closednessOfSchema` walk** — bare `enum` array, `enum:{values}`,
  `anyOf`, `maybeArrayOf`, `ref` into `definitions`, the `{tags, schema:…}` wrapper, and the
  `depth > 5` guard — not just the two arms 1.7.33 happens to need today (§9 review, MEDIUM). Any arm
  the annotator omits silently re-breaks the family's invariant (`valuesClosed === true` ⟹ `values`
  enumerates every accepted spelling) the moment a null-admitting enum moves behind a `ref`.
  RED→GREEN in `test/unit/yaml-schema-index.test.ts`: `auto-play-media`/`preload-iframes`/
  `ipynb-shell-interactivity` carry `acceptsNull:true`; `toc`, `code-copy`, `df-print`, `fig-width`
  do not; plus a synthetic-resource case per non-enum arm. Nothing reads the flag yet.
  - **DONE looks like:** build clean, existing suite green with **unchanged** counts, flag unread.
  - **Verify:** `npm run check-types && npm test`; grep that nothing consumes `acceptsNull` yet.
- **L2 [GO-LIVE]** — in `isWrongValue` (`yaml-value-check.ts:46`), before the enum-membership test:
  `if (field.acceptsNull === true && NULL_SPELLINGS.test(rawToken)) return false;` with
  `const NULL_SPELLINGS = /^(?:null|Null|NULL|~)$/` — **grounded exactly**: `null`/`Null`/`NULL`/`~`
  are accepted, `NuLl` and `"null"` are rejected (§2.5). And in `valueMessage` (`:184`), include
  `null` in the expected list when `acceptsNull` (quarto's own message does). RED→GREEN unit tests
  for all 4 spellings × 3 fields + the two rejected forms.
  - **DONE looks like:** each RED shown before GREEN; `auto-play-media: null` no longer flags on any
    surface; `auto-play-media: banana` still flags, now messaging `null` as valid.
  - **Verify:** `npm test` (unit ≈ +5 or more); re-render each probed value.
- **L3 [locks]** — integration locks on **all three** surfaces where the FP is live (§2.5): the `.qmd`
  top level (`auto-play-media: null` in front matter → **zero** diagnostics, `quarto-value`), the
  `.qmd` per-format path, **and** `_quarto.yml`'s `format:` container
  (`format:\n  revealjs:\n    preload-iframes: null` → zero, `quarto-project-value` — a different
  feature, a different collection, and a different integration suite from the `.qmd` locks; §9 review,
  LOW, verified).
  - **DONE looks like:** integration ≈ +2–3, green in a real host.
  - **Verify:** `npm run test:integration`; each fixture value render-grounded single-valued.
- **L4 [MANDATORY §9 adversarial review]** — P edits the SHARED matcher/message on two already-shipped
  surfaces, so it carries the same review obligation as any go-live, and the S139 precedent it cites
  made this an explicit layer. Lenses: fp-cardinal (does the null acceptance leak to a field WITHOUT
  a null arm?), annotator-parity (does `acceptsNull` agree with `valuesOfSchema` on every arm?),
  surface-sweep (all three surfaces), doc-drift.

**Fallback design (option iii), only if the annotator plumbing proves disproportionate:** treat a
null-admitting enum as **OPEN** (leave `valuesClosed` unset) in `closednessOfSchema`, dropping
validation for those 3 fields entirely. Smaller and equally FP-safe, but it loses the correct
`auto-play-media: banana` catch and diverges from quarto's own message. Record which was chosen in
the implementing session's handoff.

### 4.0b PREREQUISITE slice P2 (its own session): the key/value-separator guard

Defect C (§2.8), same reasoning as P: it changes SHIPPED behavior on surfaces this slice's fixtures do
not cover, so it is its own session. Also fully specified here — no further planning session needed.

- **L1 [GO-LIVE, `_quarto.yml`]** — add the separator guard to the shared emission tail in
  `findProjectConfigValueLines` (after `:260`). RED→GREEN unit tests: `execute:\n  echo:: banana`
  emits **nothing**; `echo: banana` still emits; `toc:banana` (no space) emits nothing;
  `page-navigation:: true` under `website:` emits nothing. Fixture + integration lock on the
  `execute:` FP (`echo:: true` → zero diagnostics; grounded exit 0).
  - **DONE:** each RED shown; unit ≈ +4, integration ≈ +1. **Verify:** full matrix + re-render.
- **L2 [GO-LIVE, `.qmd`]** — the same guard in `topLevelSlots` (`yaml-context.ts:421`), which serves
  the `.qmd` top-level (S125) and nested (S128) value surfaces **and the completion providers that
  share it** — so check the completion tests, not only the diagnostics ones. RED→GREEN: `toc:: true`
  in front matter produces zero diagnostics (grounded exit 0).
  - **DONE:** each RED shown; no completion regression. **Verify:** full matrix.
- **L3 [MANDATORY §9 review]** — lenses: fp-cardinal (any *new* FP from the guard?), FN-accounting
  (what does the guard now skip, and is every skipped shape quarto-rejected?), shared-consumer sweep
  (`topLevelSlots`'s completion callers), doc-drift.

**Ordering:** P and P2 are independent of each other; both must ship before **this slice's L2**.
This slice's L1 is inert and may land at any point. If the operator prefers fewer sessions, P and P2
could be one session — they are both "cross-surface matcher/grammar correctness" — but they are two
distinct root causes and two distinct FP classes, so the default is two.

### 4.1 The layer set for THIS slice (gate-(a) contract — build in order, checkpoint-commit each, ≤5 files/commit)

- **L1 — [INERT] type widen + feature routing.** Widen `ProjectConfigValueLine.container` (`:142`)
  and the `currentContainer` local (`:191`) with `"document"`; add the `"document"` arm + hoisted
  `documentFields` in the feature (`:126`). **Dormant:** the enumerator cannot yet emit `"document"`.
  *Files:* `project-yaml.ts` (types only), `yaml-project-value-diagnostics.ts`.
  - **DONE looks like:** build clean, existing suite green with **counts unchanged from the START of
    your own session** — record them at Orient rather than pinning them here. At `14a9062` they are
    unit **1223** / integration **417** (both verified firsthand S146), but P and P2 land first and
    each adds tests (post-P/P2 ≈ unit 1230+, integration ≈ 420), so a pinned literal here would read
    as a failure (§9 review, LOW). What must be unchanged is the *delta*, not the absolute.
  - **Verify:** `npm run check-types && npm test`. Dormancy is STRUCTURAL (the emit site writes a
    variable, not a literal — S140 §9 review): confirm no code path sets `documentLevel`/emits
    `"document"` yet, and rely on unchanged suite counts.
- **L2 — [GO-LIVE] enumerator emits column-0 scalars (strict-TDD, pure).** Change A. **RED→GREEN**
  unit tests in `test/unit/project-yaml.test.ts` (a new describe):
  (a) `toc: banana` at column 0 emits
  `{line:0, container:"document", path:[], key:"toc", valueRange:{6,12}, rawToken:"banana"}`;
  (b) closedness-BLIND — an open (`title: x`), unknown (`custom-thing: whatever`) and container-named
  (`project: banana`) column-0 scalar are ALSO emitted (the *feature* decides what to flag);
  (c) a pure block-opener (`website:`) is NOT emitted and still opens container scope, with a
  column-0 scalar **between** two containers not breaking either;
  (d) **Defect B lock** — the `title: "multi …` fold (§2.6) emits **nothing** for the folded
  `page-navigation: banana` line and nothing for the opener, and resumes emitting after the closing
  quote (this test is RED before the restructure — it is the FP proof); **plus the valid-YAML
  column-0 FLOW fold** (§2.6, the comma-separated variant quarto renders exit 0);
  (e) **NARROWED-ARMING lock** (§2.6) — `title: Don't Panic` at column 0 followed by
  `website:\n  page-navigation: banana` still flags the `banana` (i.e. the plain scalar does NOT arm
  the guard). Same for `title: Panic [1`. This is the anti-regression test for the fix's own trap;
  (f) **KEY-ISOLATION LOCK** (dragon 1) — `findProjectConfigKeyLines` still returns `[]` for a
  document-key-only file: the OPEN top level must never reach the unknown-KEY feature.
  *Files:* `project-yaml.ts`, `project-yaml.test.ts`.
  - **DONE looks like:** each new unit test RED-before-GREEN; **no existing expectation edited**
    (verified in §5: zero unit inputs contain a column-0 scalar); build clean.
  - **Verify:** `npm test` (unit ≈ +8); confirm each RED was shown.
- **L3 — [fixtures + integration, real host] GO-LIVE proof.** New
  `test/fixtures/yaml-project-document-value/{invalid,valid}/_quarto.yml`; a new describe in
  `test/integration/suite/yaml-project-value-diagnostics.test.ts` mirroring the family's four-test
  shape: (a) the invalid fixture flags **exactly N** wrong column-0 values, each on its value span;
  (b) the valid fixture produces **ZERO** — the FP battery: valid members, `TRUE`, an anchor, an
  open key, an unknown key, a numeric accept, a trailing comment, `format: banana` (Combo-3 FN
  lock), `project: banana` (absent-from-document-set FN lock), the §2.6 multi-line fold, and — once
  P has shipped — `auto-play-media: null`; (c) live-edit drop; (d) the `.qmd` filename-gate
  exclusion. **Every fixture value render-grounded single-valued.**
  *Files:* 2 fixtures + 1 integration test.
  - **DONE looks like:** integration ≈ +4 green in a real Extension Development Host.
  - **Verify:** `npm run test:integration`; re-render each fixture line and record exit codes.
- **L4 — [MANDATORY §9 adversarial review].** The multi-lens `quarto render`-verified panel (§9)
  plus the author's own FP battery. Fold confirmed findings; a surviving cardinal-sin FP is a
  blocker.

### 4.2 This is a vertical slice, NOT horizontal (pre-empting an FM #25 misread)

Each layer keeps the feature working end to end: L1 ships a dormant-but-compiling path, L2 makes
column-0 validation live and unit-proven (and removes a live FP), L3 proves it in a real host, L4
audits it. "If I stop here, is something working?" — yes at every boundary. One capability
(general document-key value validation in `_quarto.yml`), one pre-declared layer set.

### 4.3 Deferred — NOT built here (file to `BACKLOG.md`)

- **Combo 3 — the scalar `format:` NAME at column 0** (the open S145 backlog item). This slice
  removes its blocker (the column-0 emission), leaving a ~6-line branch that mirrors
  `yaml-value-diagnostics.ts:128-155` (null-gate → hygiene skip → `unquote` → `isKnownFormatName` →
  `formatNameMessage`). It is a **different capability** (format-NAME acceptance is a regex union,
  not a closed enum) and stays its own slice (FM #26). **Update the backlog item to say the
  entanglement is resolved.**
- **KEY validation at column 0** — a **non-starter**, not a deferral: the top level is an OPEN set
  (`custom-thing: whatever` → exit 0, §2.4).
- **DEPTH-2 under a column-0 document key** (`crossref:\n  chapters: banana`,
  `brand:\n  color: …`) — the reader supports it (`frontMatterKeys([<container>])` →
  `.children`, `yaml-schema.ts:623-625`, the S132 general branch) and the enumerator's depth-2
  machinery already exists, but the container gate (`VALUE_CONTAINERS:34`) and its FP surface
  need their own grounding pass. A safe FN today. Its own slice.
- **Sequence-form and depth-3+ project values, the KEY-enumerator `scanFlow` gap, `.ipynb` values** —
  unchanged standing deferrals.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped/read S146)

**Changed by this slice:**
- `src/core/project-yaml.ts`
  - `:34` `VALUE_CONTAINERS` / `:122` `isValueContainer` — **unchanged** (`"document"` is not a
    container *name*; it is the absence of one).
  - `:140-161` `ProjectConfigValueLine` — widen `container` (`:142`); `path` (`:154`) doc note.
  - `:188-310` `findProjectConfigValueLines` — column-0 branch `:221-228` restructured; the shared
    tail `:257-307` reused verbatim; `currentContainer` local `:191` widened.
  - `:18` `PROJECT_CONFIG_CONTAINERS`, `:75` `findProjectConfigKeyLines`, `:112`
    `isProjectConfigContainer`, `:319` `stripBom`, `:334` `keySpanAt`, `:359` `unquoteKey` —
    **unchanged** (`unquoteKey` is *reused* by the new emission).
- `src/features/yaml-project-value-diagnostics.ts`
  - `:126-145` container routing — add the `"document"` arm; hoist `frontMatterKeys([])`.
  - `:79-90` `resolveProjectValueField`, `:54` gate, `:43-45` constants — **unchanged**.

**Changed by prerequisite slice P only (§4.0):** `src/core/yaml-schema.ts` `SchemaField:22-125`
(new `acceptsNull`; the interface closes at `:125` — `scalarType:124` is its last member),
`valuesOfSchema:804` (enum arms `:827-829`, `:834-839`, plus the `anyOf`/`maybeArrayOf`/`ref`/
`{tags,schema}` arms `:840-861`), `closednessOfSchema:883` or a sibling annotator,
`annotateClosedness:996`; `src/core/yaml-value-check.ts` `isWrongValue:46`, `valueMessage:184`.

**Changed by prerequisite slice P2 only (§4.0b):** `src/core/project-yaml.ts` (the colon scan in the
shared tail, `:260`) and `src/core/yaml-context.ts` `topLevelSlots:415-441` — the latter is shared
with the `.qmd` completion providers, so its consumers must be swept, not just the diagnostics path.

**Reused, UNCHANGED (assert, don't touch):**
- `src/core/yaml-schema.ts` — `SchemaIndex.frontMatterKeys:503` (impl `:599-608`, `topLevelFields:582`),
  `CURATED_FRONTMATTER_KEYS:283-301`, `CURATED_SCHEMA_INDEX:746`, `parseSchemaIndex:1537`;
  `SchemaField` bits `values:32`, `children:63`, `valuesClosed:78`, `numericMemberEnum:96`,
  `acceptsBoolean:111`, `scalarType:124` (the range is not contiguous — cite each).
- `src/core/yaml-value-check.ts` — `BOOLEAN_SPELLINGS:19`, `NUMBER_LITERAL:33`, `isWrongValue:46`,
  `unquote:164`, `valueMessage:184`.
- `src/core/yaml-context.ts` — `mappingContainerKey:294`, `leadingWsLen:315`,
  `valueSlotAfterColon:442`.
- `src/core/qmd/model.ts` — `scanFlow:648`.
- `src/core/yaml-frontmatter-values.ts:50` — the `.qmd` model for this emission (arming `:101-110`).
- `src/features/yaml-diagnostics.ts:58` — the unknown-KEY feature; its enumerator
  (`findProjectConfigKeyLines`) must stay blind to column-0 scalars.

**Consumers (grepped, complete):** `findProjectConfigValueLines` has **exactly one** consumer,
`src/features/yaml-project-value-diagnostics.ts:96`. `findProjectConfigKeyLines` has exactly one,
`src/features/yaml-diagnostics.ts:58`. No other module imports either.

**Count-dependent-test check (Learning #156 / the S145 gotcha — done, not assumed):**
- **No existing unit expectation changes** — every `findProjectConfigValueLines` input in
  `test/unit/project-yaml.test.ts` begins with a container opener, and the two column-0 scalar
  literals it does contain sit inside container-scoped inputs. ⚠ **Do not re-derive this with a
  line-anchored grep** (the plan's first draft used `grep -nE '^\s*"[A-Za-z…]+: [^"]'`, which returns
  0 but is *blind* to the file's dominant idiom — `const text = ["website:", "  x: y"].join("\n")`
  puts every element on ONE line, so the anchor never matches; §9 review, verified: it missed 2 of 2
  real hits). Extract the string elements first (a 5-line node script over the test source, or read
  the describes), then run them through the planned enumerator and diff. The conclusion was confirmed
  that way and by reading the full value corpus.
- `scratchpad/dockey146/fixturescan.cjs` runs the planned emission over **all 14** committed
  `_quarto.yml` fixtures: 4 column-0 scalars exist (`bibliography` ×3, `csl` ×1), all open →
  **no fixture gains a diagnostic**, so **no existing integration count assertion changes**.
- Expected suite deltas are therefore purely additive: unit ≈ +8 (L2), integration ≈ +4 (L3).

**Cycle check:** `yaml-schema.ts` does not import `project-yaml.ts`; Change B keeps resolution in
the feature. No new core→core edge.

---

## §6 — Alternatives considered (honest)

1. **Add `"document"` to `VALUE_CONTAINERS` and treat the root as a named container** — REJECTED:
   there is no column-0 *line* to open such a container, and `isValueContainer` is keyed on a real
   YAML key name. The synthetic marker belongs on the emission, not in the container set.
2. **A second, independent column-0 enumerator** (mirroring `findFrontMatterValueLines`) — REJECTED
   (§3.4): the flow/quote continuation state is file-global; two scanners can disagree about which
   lines are real, which is exactly how Defect B produces a false child. One pass, one state.
3. **Fix Defects A and C inside this slice as an L0** — CONSIDERED, not recommended: both change
   shipped `.qmd`/per-format/`execute:` behavior that this slice's fixtures do not cover, and folding
   them in bundles three capabilities (FM #26). S139 set the precedent of a separate session for a
   cross-surface matcher fix. Kept as a documented option in §10 Q1 if the operator prefers fewer
   sessions.
4. **Ship this slice with Defect A or C unfixed and file them** — REJECTED: it would knowingly light
   up two known cardinal-sin FP classes on a NEW surface. The family's hard rule outranks slice
   convenience.
5. **Validate only a hand-picked "common" subset of document keys** (toc/number-sections/…) —
   REJECTED: the reader already annotates closedness correctly for all 378, the batteries prove 1:1
   parity across all 170 closed/numeric ones, and a curated subset would rot against the next Quarto
   release.
6. **Also do Combo 3 (`format:` NAME) here, since it is now unblocked** — REJECTED: a different
   matcher (regex union vs closed enum) and a different capability (FM #26). It becomes a ~6-line
   follow-on slice.

---

## §7 — Failure-mode analysis (the safety story)

The feature only ever flags a key that is (a) a recognized top-level **document** key AND (b)
provably CLOSED (`valuesClosed === true`) or numeric (`scalarType`). Every uncertainty is a silent
skip.

| Trap | Why it could FP | Why it does NOT |
|---|---|---|
| **unknown column-0 key** (`custom-thing:`) | looks like a typo | absent from `frontMatterKeys([])` → `undefined` → skip; quarto accepts it (exit 0). KEY validation here is a non-starter. |
| **open document keys** (`title`, `theme`, `engine`, `editor`) | non-empty `values` on some (`editor`, `engine`) | `isWrongValue` gates on `valuesClosed`, which those lack (`:63`) — grounded exit 0. |
| **`format: banana` at column 0** | a wrong format name | the `format` field is not closed (names injected post-closedness) → skip. Deliberate FN (Combo 3). |
| **`project:`/`website:`/`book:`/`execute:` as scalars** | container names | absent from the document field set → skip (quarto rejects them: safe FN). |
| **container block-openers** | might be emitted as values | `mappingContainerKey` (`yaml-context.ts:294`) returns non-null → `continue` before emission. |
| **multi-line quoted/flow value at column 0** | a folded line reads as a real mapping | the shared arming this slice adds (Defect B fix); the opener itself is never emitted (`:289-299`). |
| **null-admitting enums** (`auto-play-media: null`) | quarto accepts, our set omits `null` | **only after prerequisite P** (§4.0). Until P ships, this is a real FP — which is why P gates go-live. |
| **key/value separator** (`toc:: true`, `toc:x: banana`) | quarto's key is `toc:`/`toc:x`, accepted on an OPEN set (exit 0); we split at the first colon | **only after prerequisite P2** (§4.0b/§2.8). Until P2 ships, this is a real FP — live on `.qmd` and `execute:` today. |
| **plain scalar containing a quote/bracket** (`title: Don't Panic`) | the shipped whole-token arming reads it as a multi-line opener and swallows the file | the NARROWED opener rule (§2.6/§3.2) + the L2(e) anti-regression lock. Direction is FN, but unbounded — so it is a defect, not an acceptable FN. |
| **YAML node properties** (`toc: &a true`, `!!bool true`) | unreducible token | matcher's leading-`[]{}\|>&*!` skip (`:47`) — grounded exit 0. |
| **quoted keys** (`"toc": banana`) | quote characters in the key | the emission unquotes (`unquoteKey:359`) — parity with quarto (exit 1). |
| **empty value** (`toc:`) | quarto rejects it | not emitted (empty token, `:270`) → safe FN. |
| **offline (CLI schema unavailable)** | curated fallback might over-flag | `CURATED_FRONTMATTER_KEYS` (`:283-301`) carries `values` but **no** `valuesClosed` → `isWrongValue` skips everything → offline is a total safe FN (unlike `execute`, which is offline-robust). |
| **`.qmd` double-flag** | two features on one document | this feature is filename-gated to `_quarto.yml`; the `.qmd` feature is `languageId`-gated. Separate collections. |
| **KEY feature leakage (HIGH)** | the unknown-KEY feature starting to flag column-0 keys | `findProjectConfigKeyLines` is untouched and keyed on `PROJECT_CONFIG_CONTAINERS:18`; L2 adds the isolation lock test. |

**Direction of every uncertainty is false-NEGATIVE** — the family's invariant holds, *conditional on
P shipping first*.

---

## §8 — Impact analysis

- **New user-visible behavior:** a wrong closed/numeric value of a top-level document key in
  `_quarto.yml` gets an Error squiggle matching `quarto render`. **Plus a removal:** the §2.6 folded-
  value FP stops firing. No change to `.qmd` documents (except via prerequisite P), to
  `project:`/`website:`/`book:`/`execute:`/`format:` validation, or to the unknown-KEY feature.
- **Performance:** the same single O(n) forward pass; one extra `frontMatterKeys([])` call per
  compute (a field-array return, hoisted out of the loop). Negligible.
- **Docs to reconcile at close-out (Learning #7/#10) — verified against the tree at `14a9062`, not
  from memory:** `docs/POSIT-COMPARISON.md` **:320** (enumerates exactly which `_quarto.yml` regions
  the value feature covers — must gain the document root), **:485/:491** (the "reusing the SAME
  reader … so the two surfaces agree exactly" claim — still true, and now true of a third level),
  **:833** (the session-by-session value-validation history); `BACKLOG.md` (this item, plus the S145
  item's Combo-3 entanglement note, which this slice *resolves*); `CHANGELOG.md`;
  `PROJECT_LEARNINGS.md`; `HANDOFFS.md`; and the enumerator/feature doc comments that enumerate the
  recognized containers (`project-yaml.ts:20-34`, `:128-139`, `:163-187`;
  `yaml-project-value-diagnostics.ts:1-28`, `:110-124`). ⚠ Do **not** grep for the string
  `"both surfaces"` — S145 (`e2e81e7`) rewrote both of those comments and the phrase no longer exists
  anywhere in `src`/`test` (verified: 0 matches). P and P2 additionally touch `.qmd`-surface claims.

---

## §9 — Verification plan (executor)

- **Per-layer:** the DONE/Verify lines in §4.0/§4.1.
- **Full matrix at each boundary:** `npm run check-types` + `npm test` + `npm run test:integration`.
- **Firsthand grounding:** re-render every fixture line with `quarto render` 1.7.33 single-valued and
  record exit codes (invalid → exit 1 SCHEMA; valid → exit 0). Do **not** trust §2's tables blindly —
  re-probe. The harnesses in `scratchpad/dockey146/` are reusable as-is.
- **§9 adversarial review (L4, MANDATORY):** an independent multi-lens `Workflow`, each lens
  `quarto render`-verified:
  1. **fp-cardinal** — does the shipped feature flag ANY column-0 value quarto accepts? Sweep the
     open keys, unknown keys, container names, `format:`, node properties, quoted/multi-line forms,
     the null-arm fields (post-P), boolean spellings, and numeric shapes.
  2. **enumerator-reality** — does the restructured column-0 branch still track containers exactly as
     before (a scalar between two containers; an opener after a scalar; BOM; CRLF; tabs; comments)?
     Does `findProjectConfigKeyLines` still ignore column-0 keys?
  3. **surface-parity** — does `_quarto.yml` now agree with the `.qmd` top-level surface (S125) for
     the same key/value pairs? They share reader + matcher, so an *unexplained* divergence signals a
     plumbing bug. **Exactly one divergence is known and deliberate:** `format: <unknown name>` is
     flagged on `.qmd` (S145's bespoke predicate) and must stay **silent** here (Combo 3, deferred —
     §4.3, dragon 5). An exhaustive S146 sweep of all 378 top-level fields found no others, so treat
     any *additional* divergence as a defect and this one as a fixture-locked expectation — do not
     "fix" it (that is dragon 5, a different capability).
  4. **doc-drift** — §5 inventory accurate; BACKLOG/POSIT-COMPARISON/in-code "both surfaces" comments
     reconciled; the S145 Combo-3 entanglement note updated.
- **Runtime smoke (Phase 3E):** the L3 integration run in a real Extension Development Host is this
  project's runtime smoke (Learning #3).

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

- **Q1 — Prerequisites P and P2 as their own sessions (recommended), or one combined "cross-surface
  FP fix" session, or folded into this slice?** Recommend two separate sessions (§4.0/§4.0b/§6 alt 3,
  S139 precedent): two distinct root causes, two distinct FP classes, and both change shipped
  behavior this slice's fixtures do not cover. A single combined P+P2 session is defensible (both are
  "cross-surface matcher/grammar correctness"); folding either into this slice is not — that is three
  capabilities in one session (FM #26). Whatever is chosen, state it in the gate-(a) contract.
  **Sequencing note:** this makes the document-key capability a 3-session arc (P, P2, then the
  slice), which is the honest cost of the two live FPs the grounding uncovered — not scope creep.
- **Q2 — The marker name: `"document"` (recommended), `"root"`, or `container: null`?**
  `"document"` matches the family's language ("document keys") and keeps `container` a non-nullable
  string union; `null` would force every existing consumer branch to null-check. Non-load-bearing.
- **Q3 — Fixture directory name.** Recommend `test/fixtures/yaml-project-document-value/{invalid,
  valid}/` for symmetry with `yaml-project-{execute,format}-value/`.
- **Q4 — Should the invalid fixture bundle several wrong values (recommended, mirrors S141/S143) or
  one per file?** Bundle, assert exact count + spans — but ground each value single-valued (dragon 6).
- **Q5 — Does P's `acceptsNull` also belong on the *curated* offline fields?** No: the curated
  fallback carries no `valuesClosed`, so nothing is validated offline; adding it would be dead data.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. **🔴 Do not go live before BOTH prerequisites (§4.0 P and §4.0b P2).**
   (a) `auto-play-media: null` / `preload-iframes: null` / `ipynb-shell-interactivity: null` are
   quarto-ACCEPTED (verified on both surfaces) and our matcher flags them today.
   (b) `toc:: true` / `fig-width:: 6` are quarto-ACCEPTED on any OPEN key set (verified) and our
   enumerators mis-split them today. Going live before either fix ships a known cardinal-sin FP on a
   new surface.
2. **🔴 The Defect-B arming must NARROW, not widen (§2.6/§3.2).** Reusing the shipped whole-token
   `scanFlow` arming at column 0 makes `title: Don't Panic` arm a phantom quote and swallow the rest
   of the file — silently disabling every shipped `_quarto.yml` value diagnostic below it. Strip a
   leading `&anchor`/`!tag`, then arm only on a leading `"`/`'`/`[`/`{`. Write the L2(e) lock; if it
   is green before your change, you transcribed the arming rule wrong.
3. **🔴 The KEY enumerator must stay blind to column 0.** The top level of `_quarto.yml` is an OPEN
   set (`custom-thing: whatever` → exit 0). `findProjectConfigKeyLines` (`:75`) and
   `PROJECT_CONFIG_CONTAINERS` (`:18`) are untouched; write the isolation lock (L2f). This is the
   S141 dragon in its most dangerous form — the open surface is the *whole* document root.
4. **One emission tail.** Route column-0 scalars through the existing tail (`:257-307`); do not
   copy the value-slot/`scanFlow` grammar into a second branch. The copy is how Defect B survives
   (and how the two standing "consolidate the grammar" backlog items were born).
5. **The arming is the FP fix, not an optimization.** If L2's Defect-B lock test (§4.1 L2d) is not
   RED before your change, you have not reproduced the bug — re-read §2.6 and check you used a
   quote that closes on a *later* line (a token like `banana"`, whose quote opens at the end, is
   accidentally skipped by the current code and does not reproduce it).
6. **`format` at column 0 must stay silent.** Its field is deliberately not closed (names injected
   post-closedness, `yaml-schema.ts:582-585`). If you find yourself making it closed to "finish the
   job", stop — that is Combo 3, a different matcher, a different slice. It is also the ONE
   deliberate `.qmd`-vs-`_quarto.yml` divergence (§9 lens 3) — expected, fixture-locked, not a bug.
7. **Ground every fixture value single-valued** (S139 lesson): quarto reports only the first schema
   error per render.
8. **Offline is a total FN here** (`CURATED_FRONTMATTER_KEYS` has no `valuesClosed`) — unlike
   `execute:`, which is offline-robust. Do not "fix" the curated fallback to close that gap; an
   unverified curated closedness is how a cardinal-sin FP gets shipped offline.
9. **Do not touch the matcher/reader/message in THIS slice.** Any needed change there means either
   the surface diverges from §2 (re-ground it) or you are doing P's/P2's work in the wrong session.
10. **Transcribe §3.2's snippet, don't paste it.** `path` and `documentLevel` must be declared ABOVE
    the `indent === 0` branch (today `path` lives at `:237`, below it → TDZ error), and the
    `containerIndent` bootstrap (`:232-234`) must stay INSIDE the `else` arm or the depth comparison
    stops type-checking. Both were caught by type-checking a literal transcription (§9 review).

---

## Provenance — how this plan was grounded (Session 146)

- **Firsthand `quarto render` 1.7.33 probes** (`scratchpad/dockey146/`, indexed by its
  `GROUNDING.md`): the layer + column span (§2.1); a **170-case wrong-value battery generated from
  the live reader** (170/170 schema-rejected); a **170-case valid-value battery** (169/170 exit 0,
  the one exception traced to pandoc's decoder, not the schema layer); an **enum-parity check
  against quarto's own `which must instead be …` clauses** for all 170 rejections (3 divergences,
  all the null arm); edge-shape probes (boolean spellings, quoted forms, case sensitivity, node
  properties, numeric shapes, quoted keys, trailing comments, empty values, container scalars,
  `format:`); and the null-arm boundary (`null`/`Null`/`NULL`/`~` accepted; `NuLl`/`"null"`
  rejected), on **both** the `_quarto.yml` and `.qmd` surfaces.
- **Compiled-reader harnesses against current `src/`** (`reader.ts`, `nullscan.ts`, `boolcheck.ts`):
  the 378-field flag surface and its 138/32/1/208 split; the exact blast radius of the null-enum
  drop per shipped reader surface.
- **Feature simulations** (`sim.ts`, `qmdsim.ts`, `fixturescan.ts`, Learning #156): TODAY-vs-PLANNED
  flags over 11 shapes (proving both the gap and Defect B), the live `.qmd` null FP, and the
  planned emission run over **all 14** committed `_quarto.yml` fixtures (no fixture gains a
  diagnostic).
- **Source read firsthand (FM #11):** `project-yaml.ts` (whole file), `yaml-project-value-
  diagnostics.ts` (whole file), `yaml-value-check.ts` (whole file), `yaml-frontmatter-values.ts`
  (whole file), `yaml-value-diagnostics.ts` (whole file), `yaml-schema.ts` (`SchemaField`,
  `SchemaIndex`, `indexOf`/`frontMatterKeys`, `CURATED_*`, `scalarToYaml`, `valuesOfSchema`,
  `closednessOfSchema`), `yaml-context.ts` (`mappingContainerKey`/`leadingWsLen`/
  `valueSlotAfterColon`), plus the full `test/unit/project-yaml.test.ts` value corpus and the
  `_quarto.yml` integration suite's describe structure.
- **Evidence-based grep inventory** (§5) — every consumer of both enumerators, every committed
  `_quarto.yml` fixture, and the count-dependent-test check (both came back **zero**, verified by
  command, not assumed).
- **Author FP battery (S146, before the review):** 936 exotic column-0 shapes (13 representative
  fields × 72 YAML tokens: boolean spellings, null forms, hex/octal/underscore/exponent/leading-dot
  numbers, sexagesimals, timestamps, quoted forms, anchors/tags/aliases, flow/block openers, trailing
  comments). The 614 the planned code would flag were each rendered: **614/614 schema-rejected — 0
  cardinal-sin FPs.** (Its blind spot, which the review found: it varied the VALUE, never the
  key/separator — hence Defect C.)
- **Mandatory adversarial §9 review** (`Workflow` `wf_314c0811-6c9`, S146): a 4-lens
  `quarto render`-verified panel (fp-cardinal / defect-verification / enumerator-reality / doc-drift),
  each lens re-grounding firsthand, plus an independent verify-or-refute skeptic per actionable
  finding (18 agents, 587 tool calls, ~1.75 M tokens). **It earned its keep decisively — 2 HIGH, 5
  MEDIUM, 4 LOW, all folded, and I re-verified every one firsthand before folding:**
  - **HIGH (fp-cardinal, verified TRUE and UNDERSTATED)** — Defect C, the key/value separator: a
    FOURTH FP class my own 936-shape battery structurally could not find (it varied values, not
    separators). Live TODAY on `.qmd` and on `_quarto.yml`'s `execute:`. → new §2.8 + prerequisite
    P2 + §7/§11 entries. Re-verified by me: `toc:: true`, `fig-width:: 6` and `execute:\n echo:: true`
    all render exit 0 while our code flags them; the guard removes all of them at the cost of one
    quarto-rejected FN (`toc:banana`).
  - **HIGH (enumerator-reality, verified TRUE)** — my §3.2 restructure as first written would arm the
    guard on `title: Don't Panic` and swallow the rest of the file. Re-verified with my own faithful
    single-pass transcription (`author-verify.ts`): the shipped code reports the `page-navigation:
    banana` below it, the naive restructure does not. → the NARROWED opener rule (§2.6/§3.2), whose
    13-token behavior I checked against every shipped opener/non-opener case, plus an L2(e) lock.
  - **MEDIUM (verified TRUE)** — §2.6's "the flow variant is only invalid YAML" was WRONG: valid-YAML
    column-0 flow folds exist that quarto renders exit 0 and shipped code flags. → §2.6 corrected.
  - **MEDIUM/LOW, folded:** `acceptsNull` must walk every arm `valuesOfSchema` walks, not two; P's
    locks must cover all three affected surfaces; P needed an L4 review layer + per-layer DONE
    criteria; the L1 baseline counts must not be pinned across the prerequisite sessions; §9 lens 3
    had to name the one deliberate `format:` divergence; the §8 doc-drift list was stale (it chased a
    `"both surfaces"` comment S145 had already rewritten — my own FM #11 slip, written from the
    handoff rather than the tree) and incomplete; `SchemaField:22-140` → `:22-125`; §2.7's fixture
    count; and §3.2's snippet did not type-check as literally transcribed.
- **Deliverable = this plan.** No code shipped (FM #18/#19). Implementation is a **3-session arc**:
  prerequisite P, prerequisite P2, then this slice.
