# Plan — NESTED front-matter VALUE validation (`.qmd`)

**Session 127 (planning). Workstream:** `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`.
**Backlog:** `BACKLOG.md:46` — the **v2 "nested front-matter values"** slice the Session-123 plan
(`docs/planning/2026-07-19-value-validation-plan.md` §4.3) explicitly deferred.
**Predecessors shipped:** Phase 1 (cell options, S124), Phase 2 (top-level front-matter, S125), the
`createDebouncedDiagnosticsFeature` extract (S126).
**Deliverable of the IMPLEMENTATION session this plan governs:** flag a wrong VALUE of an
*already-recognized* **nested** front-matter key (under `execute:`, or `format:\n <fmt>:`) with an
Error squiggle matching `quarto render` 1.7.33 — emit **nothing** for open fields, unknown keys, or
valid values.

> **Read this first (the one-line reframing this plan makes):** the S123 §4.3 estimate called nested
> "the largest new pure-core surface … a forward-scan analog of `nestedParentPath`." Reading the code
> firsthand (this session) shows that framing is **too pessimistic**: the nested-path *resolution*
> (`frontMatterKeys(parentPath)`), the ancestor-walk *path computation* (`nestedParentPath`), the
> nested-child *closedness annotation* (`objectChildren`→`annotateClosedness`), the *matcher*
> (`isWrongValue`), and the *feature skeleton* (the `createDebouncedDiagnosticsFeature` factory) **all
> already exist and are already tested**. The genuinely-new surface is small: **(1)** hand-annotate one
> curated constant (`CURATED_EXECUTE_KEYS`) with the closedness bits, and **(2)** a new pure enumerator
> that walks indented front-matter lines and emits `{parentPath, key, value}` — reusing the existing
> `nestedParentPath` in a forward loop (the precedent `mappingContainerKey` already set). Everything
> else is wiring. This is why planning-first was correct: the design shrank once the code was read
> (Learning #6).

---

## §0 — Decision at a glance

| Question | Decision | Where |
|---|---|---|
| **What is validated** | The VALUE of an already-recognized **nested** front-matter key whose value set is *provably closed* — under `execute:` (one level) and under `format:\n <fmt>:` (per-format options, and one object level deeper) | §2, §3 |
| **Severity** | **Error** (reuse S123's grounded decision — `quarto render` aborts on a wrong nested closed value; see §2) | §3.1 |
| **Feature shape** | **EXTEND `computeValueDiagnostics`** with a third loop — NOT a new debounced feature. Same `.qmd` gate, same `quarto-value` collection, same `quarto-invalid-option-value` code, same message. *(Corrects the S126 handoff's "3rd caller of the factory" framing — nested is the same diagnostic surface as top-level.)* | §3.1 |
| **Nested-path resolution** | Invert the completion provider's own lookup: `frontMatterKeys(parentPath).find(f => f.name === key)`. Proven symmetric with `providers/yaml.ts:102-114`. | §3.4 |
| **Path computation** | **Export and reuse** the existing private `nestedParentPath` (`yaml-context.ts:232`) in a forward loop — do **not** hand-roll a path stack (it would re-derive the `format`-rooted-only + block-scalar-bail logic that `nestedParentPath` already gets right). Precedent: `mappingContainerKey`/`leadingWsLen` already exported for exactly this "forward loop, not cursor walk" reuse. | §3.3 |
| **New pure surface** | (1) hand-annotate `CURATED_EXECUTE_KEYS` closedness (11 closed, `daemon`/`output` **stay OPEN**); (2) a new `findNestedFrontMatterValueLines` enumerator **with quote-aware + node-property-aware flow-depth tracking** (three confirmed FPs without it — plan review, §7.1). | §3.2, §3.3 |
| **Scope (this plan → impl)** | **ONE strict-TDD implementation session**, structured as a pre-declared **vertical slice** (§4 is the gate-(a) contract) with checkpoint commits per layer. | §4 |
| **Deferred (filed, NOT built)** | numeric type-aware (`daemon: 30`, `fig-width: wide`) — a **separate** v2 slice; `.ipynb`; annotating the offline `CURATED_FORMAT_OPTIONS` fallback; object-sub-keys deeper than one level. | §4.3 |
| **The cardinal sin** | A **false positive** (flagging a value `quarto render` accepts). Every §7 dragon is an FP guard. | §7 |

---

## §1 — Context

### 1.1 Problem
`format:` and `execute:` are the two highest-value closed-enum containers in a Quarto document, and
their options (`execute.echo`, `format.html.toc`, `format.html.code-fold`, …) are exactly where a user
mistypes a value (`echo: maybe`, `toc: yes`, `code-fold: banana`). *(Other containers — `crossref:`,
`website:`, `brand:`, `jupyter:` — also host closed nested children `quarto render` validates; this
slice covers the first two, and the rest are a documented deferral, §4.3.)* Phases 1–2 validate cell
options and *top-level* front-matter scalars but **skip every indented line** (`yaml-frontmatter-values.ts:80-82`,
locked by the test `skips NESTED (indented) value lines — v2, not v1`, `test/unit/yaml-frontmatter-values.test.ts:63-66`).
This plan fills that seam.

### 1.2 Constraints (standing, binding)
- **Strict TDD** (project-wide gate, CLAUDE.md) — RED→GREEN, one behavior at a time.
- **The cardinal sin is a false positive** (§7). Value validation is safe ONLY on a key that is both
  already-recognized AND provably closed (`valuesClosed===true`); an open set is never flagged.
- **No publish near-term** (operator, S103) — this ships to the local build, not the marketplace.
- **Do NOT YAML-parse** — the enumerators are line-local scanners (Learning #14: one front-matter
  scanner, never a second `---` parser; the matcher is a pure string check, not a YAML load).
- **Reuse, don't re-litigate** (S123's already-decided model): severity=Error, the closedness model
  (`valuesClosed`/`acceptsBoolean`), the `isWrongValue` matcher, and the `createDebouncedDiagnosticsFeature`
  factory are all settled — this plan adds a surface, it does not revisit them.

### 1.3 Current state — what already exists (build on it, do NOT rebuild)
Grounded firsthand this session (file:line in §5):

| Piece | Status | Reuse |
|---|---|---|
| `SchemaField.valuesClosed` / `acceptsBoolean` | Exists (`yaml-schema.ts:78-87`) | unchanged |
| `closednessOfSchema` + `annotateClosedness` (inverted-risk derivation) | Exists (`:764`, `:828`) | unchanged |
| `objectChildren` sets closedness on **nested** children | Exists (`:1099`, calls `annotateClosedness:1122`) | unchanged |
| `toField` sets closedness on top-level/per-format fields | Exists (`:1145`, `annotateClosedness:1162`) | unchanged |
| `frontMatterKeys(parentPath)` resolves nested paths `["execute"]`, `["format"]`, `["format",fmt]`, `["format",fmt,opt]` | Exists (`:507-549`) | **inverted for validation** |
| `nestedParentPath(lines, line, indent)` — ancestor-walk path computation | Exists **private** (`yaml-context.ts:232`) | **export + reuse per-line** |
| `mappingContainerKey`, `leadingWsLen`, `valueSlotAfterColon`, `topLevelSlots` | Exported | reuse |
| `isWrongValue` — surface-agnostic matcher (six boolean spellings quote-rejecting; unquote+case-sensitive enum; skips open/non-scalar/empty; skips `[]{}|>&*!`-leading tokens; **quote-aware `unquote`**) | Exists (`yaml-value-check.ts`) | **unchanged** |
| `findFrontMatterValueLines` (top-level enumerator, with `netFlowDelta` flow tracking) | Exists (`yaml-frontmatter-values.ts`) | **pattern to mirror** |
| `computeValueDiagnostics` (the feature `compute`) | Exists (`yaml-value-diagnostics.ts:58`) | **extended (3rd loop)** |
| `createDebouncedDiagnosticsFeature` factory | Exists (`debounced-diagnostics.ts`, S126) | unchanged |
| completion provider's nested value resolution (the lookup to invert) | Exists (`providers/yaml.ts:102-114`) | mirror |

---

## §2 — Ground truth (empirical, `quarto render` 1.7.33 / pandoc 3.6.3)

Every row below was rendered firsthand this session (`quarto render c.qmd --to html --no-execute`,
front-matter-only doc, no nearby `_quarto.yml`; exit 1 = quarto REJECTS = we SHOULD flag a closed key,
exit 0 = quarto ACCEPTS = we must NEVER flag). **exit 0 on a wrong-looking value ⇒ the field is OPEN
or the shape is not a real nested scalar ⇒ a flag would be the cardinal sin.**

### 2.1 `execute:` children (one level) — the curated-annotation surface
| Case | exit | Verdict |
|---|---|---|
| `execute.echo: maybe` | 1 | CLOSED — flag (echo = `true/false/fenced`) |
| `execute.echo: fenced` / `echo: TRUE` | 0 | valid |
| `execute.{eval,warning,error,include,enabled,keep-md,keep-ipynb,daemon-restart}: banana` | 1 | CLOSED — flag (boolean) |
| `execute.cache: banana` / `cache: refresh` | 1 / 0 | CLOSED (`true/false/refresh`) |
| `execute.freeze: banana` / `freeze: auto` | 1 / 0 | CLOSED (`true/false/auto`) |
| **`execute.output: banana`** | **0** | **OPEN — never flag** (anyOf free arm, same as cell `output`) |
| **`execute.daemon: banana`** | **1** | but **`daemon: 30` → 0** and **`daemon: true` → 0** ⇒ boolean-**or-number** ⇒ **stays OPEN** (the numeric slice's job; a closed-boolean annotation would FP on `daemon: 30`) |

### 2.2 `format:\n <fmt>:` options (per-format, reader-derived) — cross-format
| Case | exit | Verdict |
|---|---|---|
| `format.html.toc: yes` / `format.pdf.toc: yes` | 1 | CLOSED bool — flag |
| `format.html.number-sections: yes` | 1 | CLOSED bool — flag |
| `format.html.code-fold: banana` / `code-fold: show` | 1 / 0 | CLOSED (`true/false/show`, boolean-accepting) |
| `format.html.df-print: banana` / `fig-format: banana` | 1 | CLOSED enum — flag |
| `format.revealjs.incremental: yes` | 1 | CLOSED bool — flag |
| **`format.html.theme: banana`** / **`output-file:`** / **`css:`** | **0** | **OPEN — never flag** (free strings) |
| `format.html.notarealoption: yes` (unknown key) | 0 | unknown key — never flag |

**Reader-derived closedness is CORRECT** (workflow agent A, `parseSchemaIndex` against the installed
`/Applications/quarto/share/editor/tools/yaml/yaml-intelligence-resources.json`, `USING_CURATED_FALLBACK=false`):
`frontMatterKeys(["format","html"])` → 170 fields with `toc/number-sections/code-fold`
`{valuesClosed:true, acceptsBoolean:true}`, `df-print/fig-format` `{valuesClosed:true}` (no
`acceptsBoolean`), `theme/output-file` carry no `values`/`valuesClosed` — **zero divergence** from the
renders above. `["format","pdf"]`=155 fields, `["format","revealjs"]`=193 (with `incremental` closed) —
per-format filtering is genuine, not a shared flat list. **⇒ the per-format path works out of the box;
the ONLY unannotated closed source is `execute:` (see §3.2).**

### 2.3 FP shapes at depth (ALL render exit 0 — a flag on any is the cardinal sin)
| Shape | exit | Guard |
|---|---|---|
| Nested anchor / tag: `execute.echo: &a true`, `!!bool true` | 0 | matcher skips `&*!`-leading tokens (S125 fix) — **already handled** |
| Quoted value + comment: `execute.echo: "fenced" # note`, `format.html.df-print: "kable" # c` | 0 | quote-aware `unquote` (S124 fix) — **already handled** |
| Block scalar content: `abstract: \|` / `format.html.include-in-header: \|` then a fake `echo: maybe`/`toc: yes` line (**more-indented**) | 0 | `nestedParentPath` bails on the `key: \|` container (`mappingContainerKey`→null) — **already handled** |
| **Multi-line FLOW continuation at depth**: `format.html.x: {` then `toc: yes` on a continuation line at the **same** indent | **0** | **NEW: the enumerator needs flow-depth tracking** — `nestedParentPath` does NOT protect the same-indent continuation (it skips the `x: {` opener and resolves `toc` under `format.html`) → **cardinal-sin FP without it** (§7.1, the depth-analog of the S125 review's top-level flow FP) |
| **Anchored/tagged flow opener at depth**: `format.html.foo: &a { x: 1,` then `toc: yes }` (plan-review CRITICAL) | **0** | flow-arm must be **net-based, not first-char** — the token starts with `&`, so a `/^[[{]/` test never arms and `toc: yes` is flagged (verified exit 0). §3.3 step 2 arms on `flowScan(token) > 0` |
| **Quoted brace inside a flow at depth**: `execute.foo: {` / `a: "}",` / `echo: maybe,` / `}` (plan-review HIGH) | **0** | the counter must be **quote-aware** — a naive count reads the quoted `}` as −1, drops `flowDepth` early, and flags `echo` (verified exit 0). No column-0 backstop exists at depth, so this is an FP not a safe FN |
| Inline flow value: `execute: {echo: maybe}` | 1 | quarto rejects, but our whole-value flow-token skip means a **safe false negative** (we don't flag inside a single-line flow) |
| Block content at the **same** indent as `key: \|` (block ends immediately → a real sibling key) `format.html.toc: yes` after an empty `include-in-header: \|` | 1 | correctly a real `toc` — flagged (indentation-sensitivity is correct, not an FP) |

---

## §3 — Decision (architecture)

### 3.1 Feature shape — EXTEND the existing feature (not a new one)
Nested front-matter values are the **same diagnostic surface** as cell options and top-level
front-matter: a wrong option value in a `.qmd`, surfaced through the `quarto-value`
`DiagnosticCollection` under code `quarto-invalid-option-value`, at **Error** severity, with the same
`valueMessage`. So the implementation **adds a third loop to `computeValueDiagnostics`**
(`yaml-value-diagnostics.ts:58`), after the cell loop (`:74-105`) and the top-level front-matter loop
(`:116-135`). It is **not** a new `createDebouncedDiagnosticsFeature` caller — the S126 handoff's
"3rd caller" phrasing conflated "a third value *source*" with "a third *feature*". One feature, three
sources.

### 3.2 Schema annotation — the one core change: `CURATED_EXECUTE_KEYS`
`frontMatterKeys(["execute"])` returns `CURATED_EXECUTE_KEYS` **unconditionally** — even when the
reader parsed the live schema (`yaml-schema.ts:517-519`; the live schema assembles the execute object
across files, deferred recursive-resolution). Those curated fields carry `values` but **no
`valuesClosed`/`acceptsBoolean`** (`:290-304`), so `isWrongValue`'s precondition
(`valuesClosed===true`) is never met → execute values silently go unvalidated (a safe false negative,
but the whole point of this slice). **Fix: hand-annotate the closed execute fields**, grounded against
§2.1:

| Field | `valuesClosed` | `acceptsBoolean` | `values` (unchanged) |
|---|---|---|---|
| `eval`, `warning`, `error`, `include`, `enabled`, `daemon-restart`, `keep-md`, `keep-ipynb` | ✅ | ✅ | `["true","false"]` |
| `echo` | ✅ | ✅ | `["true","false","fenced"]` |
| `cache` | ✅ | ✅ | `["true","false","refresh"]` |
| `freeze` | ✅ | ✅ | `["true","false","auto"]` |
| **`output`** | ❌ leave unmarked | — | `["true","false","asis"]` — **OPEN** (`output: banana` renders exit 0) |
| **`daemon`** | ❌ leave unmarked | — | `["true","false"]` — **OPEN** (boolean-**or-number**: `daemon: 30` renders exit 0; a closed-boolean mark would FP) |

This is the §7.1-analog "completion values ≠ closed for validation" case at depth: `output`/`daemon`
keep their completion `values` (autocomplete hints) but must NOT be `valuesClosed`. Completion is
unaffected (it reads `values`, not `valuesClosed`). **The `CURATED_FORMAT_OPTIONS` offline fallback
(`:343-380`) is left UNannotated (deferred, §4.3)** — it is the rare no-reader path; leaving it
open means nested `format.*` validation fires only when the reader is available (always, in practice:
Quarto 1.7.33 is installed). The reader-derived `perFormatOptions` are already correctly annotated
(§2.2, agent A), so `format.<fmt>.*` needs **no** schema change.

### 3.3 The nested enumerator (the new pure surface)
A new pure, `vscode`-free module `src/core/yaml-frontmatter-nested-values.ts`, sibling of
`yaml-frontmatter-values.ts`:

```
findNestedFrontMatterValueLines(text) -> NestedFrontMatterValueLine[]
  where NestedFrontMatterValueLine = {
    line: number,                    // 0-based absolute document line
    parentPath: string[],            // the CONTAINER path, EXCLUDING this line's key
    key: string,                     // the nested mapping key (quotes retained, as top-level)
    valueRange: { startCol, endCol },// half-open value-token span
    rawToken: string,                // value exactly as written (quoted ok; trailing comment excluded)
  }
```

Algorithm (bounded by the single front-matter scanner — `findFrontMatter`/`frontMatterContentLines`,
Learning #14):
1. Iterate the interior content lines. Skip **column-0** lines (the top-level enumerator's job) and
   `-`/`#` lines.
2. **Flow-depth tracking** (MANDATORY — §2.3, §7.1) — and it must be **quote-aware AND
   node-property-aware**, NOT the top-level enumerator's first-char/quote-naive version (the plan
   review caught two FPs the naive version ships, §7.1). Maintain a `flowDepth` counter using a
   **quote-aware** net-bracket scanner `flowScan(s)` = (`{`+`[` minus `}`+`]`), counting **only chars
   outside single/double quotes** (respect `\"` in a double-quoted scalar and `''` in a single-quoted
   one). **Arm flow whenever `flowScan(rawToken) > 0` — evaluated over the WHOLE value token, never the
   first character** (so an anchored/tagged opener `foo: &a { x: 1,` — whose token starts with `&`, not
   `{` — still arms, because a leading `&anchor`/`*alias`/`!tag` contributes no brace to the count).
   While `flowDepth > 0`, skip the line as a multi-line-flow continuation and update
   `flowDepth += flowScan(lineText)`. Bias toward over-skipping when ambiguous (a stray unbalanced
   brace in a plain scalar arms flow → a safe false negative). *This is the one guard `nestedParentPath`
   does not provide, and — unlike the top-level enumerator — there is no column-0 backstop, so a
   quote-naive UNDER-count here is a live FP, not a safe FN.*
3. For a candidate indented `key: value` line, compute `parentPath = nestedParentPath(contentLines, i, indent)`.
   `null` ⇒ skip (unresolvable structure, a `format`-rooted-non-`format` root, OR block-scalar/flow
   content — `nestedParentPath` bails on a scalar-value container via `mappingContainerKey`→null,
   which is what protects block scalars, §2.3).
4. Find the mapping colon (`indexOf(":", indent)`), the `key` (`slice(indent, colon)`, trailing ws
   trimmed), and the value slot (`valueSlotAfterColon`). Skip an empty key or empty `rawToken` (a
   block-opener like `html:` / `theme:`, or a still-typing line).
5. Emit `{line: baseLine + i, parentPath, key, valueRange, rawToken}`.

**Footgun to encode in the record's doc-comment:** the completion context's `parentPath`
(`nestedKeyContextAt`, `yaml-context.ts:205`) *includes* the key being valued
(`[...containers, key]`); `nestedParentPath()` (the function) returns the container path
*excluding* it. This enumerator's `parentPath` follows the **function's** convention (containers only)
so resolution is `frontMatterKeys(parentPath).find(name===key)` — not `.slice(0,-1)`.

**Why reuse `nestedParentPath` per-line, not a forward path-stack:** `nestedParentPath` already encodes
(a) `execute:` stays one level while `format:` descends N levels; (b) the `format`-rooted-only rule
(a non-`format` column-0 root bails); (c) the scalar-value-container bail that protects block scalars.
A hand-rolled stack would re-derive all three and is where an FP would hide. Cost is O(depth) per line
over a small front-matter block — negligible. **Export `nestedParentPath`** (currently private,
`yaml-context.ts:232`); precedent: `mappingContainerKey`/`leadingWsLen` were already exported for this
exact "forward loop instead of cursor-anchored walk" reuse (`project-yaml.ts`).

### 3.4 Resolution — invert the completion provider
For each emitted nested value line, resolve the field exactly as completion does, inverted:
```
const fields = index.frontMatterKeys(nested.parentPath);   // e.g. ["execute"] or ["format","html"]
const field  = fields.find(f => f.name === nested.key);
if (field && isWrongValue(nested.rawToken, field)) -> emit Error diagnostic at nested.valueRange
```
Proven symmetric with `providers/yaml.ts:102-114` (`frontMatterKeys(ctx.parentPath.slice(0,-1)).find(name===key)`).
An unknown key (`find` → `undefined`), an open field (`isWrongValue` precondition fails), or a valid
value all skip — the same three no-ops the top-level loop already relies on. The `format`-name-as-key
case (`format:\n <fmt>: <scalar>`) resolves `<fmt>` against `frontMatterKeys(["format"])`, whose
fields carry **no `values`** (format names are containers, not enums, `:314`) → never flagged (§7.4).

### 3.5 Data flow
```
document change (.qmd) ─debounce 350ms→ compute(document, {source, isCurrent})   [factory, S126]
   text = getText()                              (single pre-await snapshot — S124)
   cellLines = findCellOptionLines(text)         [Phase 1]
   fmLines   = findFrontMatterValueLines(text)   [Phase 2, top-level]
   nestedLines = findNestedFrontMatterValueLines(text)   [Phase 3, THIS plan — NEW]
   if all three empty -> isCurrent() ? [] : null
   index = await source.getIndex()
   if document.isClosed || !isCurrent() -> null  (generation guard — factory contract)
   for cell in cellLines:   ... (unchanged)
   for fm   in fmLines:     ... (unchanged)
   for n    in nestedLines: field = frontMatterKeys(n.parentPath).find(name===n.key);
                            if field && isWrongValue(n.rawToken, field): push Error @ n.valueRange
   return diagnostics
```
The generation guard, snapshot discipline, and null/[]/non-empty sentinel are the factory's contract
(S126) — the nested loop slices from the **same** pre-await `text`, never re-reads the live document
(the S124 rule; `findNestedFrontMatterValueLines` already returns `valueRange`/`rawToken` from that
snapshot, so the loop needs no live `lineAt`).

---

## §4 — Scope: the vertical slice (ONE implementation session)

This is **ONE capability** — nested front-matter value validation, end to end — so it qualifies as a
pre-declared **vertical slice** (SESSION_RUNNER §Vertical Slice Sessions). This §4 IS the gate-(a)
contract: the layer set below is approved here, before any code, and the implementing session
re-verifies it unchanged at Orient. Checkpoint-commit at every layer boundary (≤5 files/commit); run
the full build/test matrix + the §7 FP renders at each boundary.

### 4.1 The layer set (gate-(a) contract — build in this order, checkpoint each)
- **L1 — Schema annotation.** Hand-annotate `CURATED_EXECUTE_KEYS` closedness (§3.2; 11 closed,
  `output`/`daemon` open). **DONE looks like:** a unit test (mirroring `yaml-value-closedness.test.ts`)
  asserts `frontMatterKeys(["execute"])` returns `echo` with `valuesClosed:true, acceptsBoolean:true`
  and `daemon`/`output` **without** `valuesClosed`. **Verify:** `npm test` green; RED shown first.
- **L2 — The nested enumerator.** New `src/core/yaml-frontmatter-nested-values.ts`
  (`findNestedFrontMatterValueLines` + flow-depth tracking) + export `nestedParentPath` from
  `yaml-context.ts`. **DONE looks like:** a new unit file (mirror the 17-test `yaml-frontmatter-values.test.ts`)
  — input text → exact `{line,parentPath,key,valueRange,rawToken}` array, covering: `execute.echo`,
  `format.html.toc`, `format.pdf.toc`, the three flow FPs of §7.1 — **(a)** same-indent continuation,
  **(b)** anchored opener `foo: &a { … toc: yes }`, **(c)** quoted-brace under-count `a: "}"` — each
  asserting the closed sibling is NOT emitted; block-scalar content (NOT emitted), a sequence item
  (NOT emitted), an unknown-depth (still emitted — the reader gates it later), quoted value + comment. The existing `skips NESTED lines` top-level test stays `[]`
  (unchanged — nested is a **separate** function). **Verify:** `npm test` green; RED shown first.
- **L3 — Feature wiring + fixtures.** Add the third loop to `computeValueDiagnostics`; new fixtures
  `test/fixtures/yaml-value-diagnostics/nested-front-matter.qmd` (a `format:>html:` + `execute:` tree
  with wrong values to flag AND open/unknown values to leave alone) and `valid-nested-front-matter.qmd`
  (zero diagnostics), each with an inline prose block citing per-line `quarto render` 1.7.33 exit codes
  (the existing-fixture convention). A third `describe` block in `test/integration/suite/yaml-value-diagnostics.test.ts`
  asserting real `vscode.languages.getDiagnostics` at the **exact indented value-token character span**.
  **DONE looks like:** integration suite green; RED-before-wiring shown. **Verify:** check-types clean;
  `npm test`; the §7 FP renders re-run and confirmed exit 0 = no diagnostic.
- **L4 — Mandatory §9 adversarial review + FP fixes.** Non-negotiable (§9; Learning #138 — every value
  surface has shipped ≥1 review-caught FP). Fix each confirmed finding TDD.

### 4.2 Session boundary
This whole slice is **one implementation session**. It maps to one reversible intent with per-layer
commits; a crash strands ≤1 layer. Do NOT bundle the numeric slice (§4.3) — `daemon`/`output` are the
tell that nested and numeric overlap but are distinct capabilities.

### 4.3 Deferred to a later session (filed to `BACKLOG.md`, NOT built here)
| Candidate | Why deferred |
|---|---|
| **Numeric type-aware** (`daemon: 30`, `fig-width: wide`, 37 clean-number fields) | A **separate** slice (S123 §4.3): needs a `scalarType:'number'` bit + a not-a-YAML-number check. `daemon`/`output` stay OPEN here precisely so this slice can add them without an FP now. |
| **Annotate `CURATED_FORMAT_OPTIONS`** (offline fallback closedness) | Rare no-reader path; false-negative-safe to skip. Small additive follow-up. |
| **`.ipynb`** nested values | Scope cliff (separate `TextDocument`s, `vscode-notebook-cell:` scheme) — same deferral as S123 §4.3. |
| **Object sub-keys > one level** (`format.html.<opt>.<sub>.<sub2>`) | `frontMatterKeys` resolves one object level (`:539-547`); deeper is the shape-locked `b2-iii-deep` residue — resolution returns `[]` → skipped (safe). |
| **Other closed front-matter containers** (`crossref:`, `website:`, `brand:`, `jupyter:`, …) | Their KNOWN children carry closed values `quarto render` rejects (`crossref.chapters: banana` → exit 1; `chapters: true` → exit 0; `website.navbar.background: banana` → exit 1 — all rendered firsthand, plan review L4), but `NESTED_CONTAINERS = {execute, format}` (`yaml-context.ts:359`) makes `nestedParentPath` return `null` for these roots and `frontMatterKeys(["crossref"])` returns `[]` — so they stay **unvalidated (a safe false negative)**. A future slice widens `NESTED_CONTAINERS` and adds a reader/curated source per container. This slice covers the **two highest-value** closed containers, not all of them. |

---

## §5 — Evidence-based inventory (affected symbols, file:line)

**REUSE unchanged:**
- `src/core/yaml-value-check.ts` — `isWrongValue`, quote-aware `unquote` (surface-agnostic).
- `src/core/yaml-schema.ts` — `frontMatterKeys` (`:507-549`), `closednessOfSchema` (`:764`),
  `annotateClosedness` (`:828`), `objectChildren` (`:1099`), `toField` (`:1145`), `perFormatSource`
  (`:1214+`), `SchemaField` (`:22-87`).
- `src/core/yaml-context.ts` — `mappingContainerKey` (`:286`, exported), `leadingWsLen` (`:307`),
  `valueSlotAfterColon` (`:406`), `nearestShallowerLine` (`:319`, used internally by `nestedParentPath`),
  `NESTED_CONTAINERS` (`:359`).
- `src/core/qmd/model.ts` — `findFrontMatter`, `frontMatterContentLines`.
- `src/features/debounced-diagnostics.ts` — the factory (S126).

**TOUCH (add, don't alter existing behavior):**
- `src/core/yaml-schema.ts` — annotate `CURATED_EXECUTE_KEYS` (`:290-304`) with `valuesClosed`/
  `acceptsBoolean` per §3.2. *(Nothing else — the per-format reader path already derives closedness.)*
- `src/core/yaml-context.ts` — `export function nestedParentPath` (`:232`, currently private).
- `src/features/yaml-value-diagnostics.ts` — a third loop in `computeValueDiagnostics` after the
  front-matter loop (`:135`); import `findNestedFrontMatterValueLines`; the empty-fast-path guard
  (`:65`) grows a `&& nestedLines.length === 0` term.

**NEW:**
- `src/core/yaml-frontmatter-nested-values.ts` — `findNestedFrontMatterValueLines` +
  `NestedFrontMatterValueLine` (+ its own `netFlowDelta`, or import the top-level one).
- `test/unit/yaml-frontmatter-nested-values.test.ts` — mirror the 17-test top-level file.
- `test/fixtures/yaml-value-diagnostics/{nested-front-matter,valid-nested-front-matter}.qmd`.
- a third `describe` block in `test/integration/suite/yaml-value-diagnostics.test.ts`.

**Test baseline (agent D, 2026-07-20):** 1026 unit (53 vitest files, green), ~365 integration (static
`it(` grep), 14 LSP. value-validation slice: `yaml-frontmatter-values`=17, `yaml-value-check`=19,
`yaml-value-closedness`=12. No nested fixture/module/test exists yet.

---

## §6 — Alternatives considered (honest)

| Alternative | Why rejected |
|---|---|
| **Fold nested into `findFrontMatterValueLines`** (one enumerator for both) | Breaks the `skips NESTED lines` test contract, conflates two concerns (column-0 vs ancestor-walk), and forces the top-level function to grow indentation state it currently avoids. A separate sibling is cleaner and keeps Phase 2 untouched. |
| **A new `createDebouncedDiagnosticsFeature` caller** (a 4th feature/collection) | Same surface (`.qmd` value error) → same collection/code/message; a separate collection would split one URI's value diagnostics across two features for no reason. Extend `computeValueDiagnostics`. |
| **Hand-roll a forward path-stack** instead of reusing `nestedParentPath` | Re-derives the `format`-rooted-only rule + the block-scalar bail — exactly where an FP hides. Reuse the tested function. |
| **Make the reader derive `execute:` children** (drop the curated constant) | Large recursive-resolution work (the schema assembles execute across files); out of scope. The curated annotation is the grounded v1 (§3.2). |
| **Annotate `CURATED_FORMAT_OPTIONS` now** | Rare offline path; false-negative-safe to defer (§4.3). |
| **Skip flow-depth tracking** (rely on `nestedParentPath`) | Firsthand-refuted: the same-indent flow continuation `format.html.x: {` / `toc: yes` renders exit 0 but `nestedParentPath` resolves `toc` under `format.html` → cardinal-sin FP (§2.3/§7.1). |

---

## §7 — Failure-mode analysis (the safety story — this IS the feature)

The cardinal sin is a **false positive**. Each guard below was rendered firsthand (§2).

- **7.1 Multi-line flow collection at depth (the NEW FP — three variants, ALL confirmed by the plan
  review + firsthand renders).** The counter is the depth-analog of S125's top-level fix, but the
  top-level "quote-naive over-count is a safe FN" reasoning is **FALSE at depth** because there is no
  column-0 backstop — an early exit here flags a real key. All three renders below exit 0 (quarto
  accepts) and a naive enumerator flags a closed sibling → cardinal sin:
    - **(a) same-indent continuation:** `format.html.x: {` then a same-indent `toc: yes` (the
      `nestedParentPath` walk skips the `x: {` opener and resolves `toc` under `format.html`).
    - **(b) anchored/tagged opener (CRITICAL, plan review):** `format.html.foo: &a { x: 1,` then
      `toc: yes }` — the opener token starts with `&`, so a first-char `/^[[{]/` arm never fires.
    - **(c) quoted brace under-count (HIGH, plan review):** `execute.foo: {` / `a: "}",` /
      `echo: maybe,` / `}` — a naive scan counts the quoted `}` and drops `flowDepth` to 0 early.
  **Mitigation (§3.3 step 2):** a **quote-aware, node-property-aware, net-based** `flowScan` — arm on
  `flowScan(token) > 0` over the whole token (fixes b), count only outside quotes (fixes c), bias
  toward over-skipping (safe FN) when ambiguous. Mandatory "not emitted" unit rows for (a), (b), (c)
  before wiring. *If quote-aware scanning still proves leaky under the impl-session review, the
  conservative fallback is: once any flow/anchor/tag opener appears under a container, stop emitting
  nested value lines within that container's subtree (indent > container indent) — a blanket safe FN.*
- **7.2 Block scalars (`\|`/`>`) with colon-bearing content.** `abstract: \|` / `include-in-header: \|`
  then a fake `echo: maybe`/`toc: yes` (more-indented) renders exit 0. **Mitigation:** `nestedParentPath`
  bails because the `key: \|` line has a scalar value (`mappingContainerKey`→null). Indentation-sensitive
  and correct: a line at the SAME indent as the `\|` is a real sibling key (block ended) and is
  correctly flagged. **The review MUST probe both indentations.**
- **7.3 YAML node properties on a value** (`echo: &a true`, `!!bool true`, `*a`) render exit 0 —
  **already** skipped by the shared matcher's `[]{}|>&*!` guard (S125). No new work; a regression test
  at depth is cheap insurance.
- **7.4 `format`-name-as-key** (`format:\n html: <scalar>`). Resolves `html` against
  `frontMatterKeys(["format"])`, whose fields carry no `values` → never flagged. **The review should
  render `format:\n html: default` to confirm no reader path attaches a closed `values` to a format
  name.**
- **7.5 `output`/`daemon` over-reach.** Both render exit 0 on off-list values (`output: banana`,
  `daemon: 30`) → **must stay OPEN** (unmarked). A closed-boolean annotation is the classic FP. §3.2 is
  explicit; the closedness unit test locks it.
- **7.6 Unknown nested keys** (`format.html.notarealoption: yes`) render exit 0 — resolution `find`
  returns `undefined` → skipped (never the banned unknown-key territory).
- **7.7 Curated-annotation divergence** (§7.1 dragon, at depth). `CURATED_EXECUTE_KEYS` closedness is
  hand-maintained; if a future Quarto changes an execute option's type, the constant lags. **Mitigation:**
  the closedness unit test is grounded to §2.1 render facts; re-run §2.1 after a Quarto upgrade
  (a maintenance note, not a v1 blocker). The reader path (format) self-updates.
- **7.8 Async race.** Unchanged — the factory's generation guard + the pre-await snapshot (S124/S126)
  already cover the slow first-load schema race; the nested loop slices from the same snapshot.
- **7.9 Quoted nested key / embedded colon** (`"toc": yes`, `"a: b": v`). Resolution finds no field
  (name mismatch / truncated key) → skipped (safe false negative), same imprecision the top-level
  enumerator accepts. §10 Q2.

---

## §8 — Impact analysis

- **What changes:** one curated constant annotated; one new pure enumerator; one export; one added loop
  + empty-fast-path term in `computeValueDiagnostics`; new tests + fixtures.
- **What does NOT change:** the matcher, the closedness derivation, the factory, the completion
  providers (they read `values`; a new `valuesClosed` bit is invisible to them), Phases 1–2 behavior
  (the two existing loops and the top-level enumerator are untouched; the `skips NESTED lines` test
  stays green), `extension.ts` (registration unchanged — same feature).
- **What might break (risk):** an FP from the new nested surface — bounded by §7 and the mandatory §9
  review. The empty-fast-path guard must include the nested count or an all-nested-only doc would
  early-return `[]` and never validate (a self-inflicted false negative — cheap to test).

---

## §9 — Verification plan

- **Unit (vitest, headless):** the closedness annotation (L1), the enumerator (L2 — the §7 FP shapes as
  explicit "not emitted" rows), and the resolution symmetry. Matcher/closedness-core reused unchanged
  (no re-test).
- **Integration (`@vscode/test-electron`):** a third `describe` block asserting real
  `vscode.languages.getDiagnostics` at the exact indented value-token span on `nested-front-matter.qmd`,
  zero on `valid-nested-front-matter.qmd`, and a live-edit re-scan drop (mirror `:107-121`). This is the
  API VS Code renders squiggles from — no shadow-DOM channel gap.
- **Build gate:** `npm run check-types`; `npm test`; a clean `.vsix`.
- **MANDATORY adversarial review (§9, NOT optional — Learning #138).** A multi-lens `Workflow` (≥4
  lenses: FP-hunting on the nested surface, lifecycle/race, resolution-correctness, completeness/doc-drift),
  **each finding verified firsthand with `quarto render` 1.7.33** on the exact nested YAML shape. Every
  prior value surface (Phase 1: 2 FPs, Phase 2: 2 FPs) shipped review-caught false positives; assume
  this one hides ≥1 (prime suspects: the flow-depth counter's quote-naivety at depth, a `format`-name
  edge, a tab-indent case). Fix each TDD.
- **Phase 3E runtime smoke:** the integration suite exercises `activate()`→the factory-built feature in
  the real host; the on-screen EDH eyeball is operator-gated (shared screen) — disclose, don't skip.

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)

1. **The nested `flowScan` is a NEW quote-aware scanner, NOT the top-level `netFlowDelta`.** The plan
   review showed the top-level quote-naive `netFlowDelta` (`yaml-frontmatter-values.ts:107`) ships FPs
   at depth (§7.1c). So the nested enumerator needs its own quote-aware + node-property-aware
   `flowScan`. Open question: does the *top-level* enumerator also want the hardened scanner (its
   column-0 backstop makes its naive count a safe FN today, so not a bug — but single-sourcing a
   correct scanner is tidier)? *Recommend:* write the quote-aware `flowScan` for nested now; leave the
   top-level as-is (its FN is safe) and file "unify on the quote-aware scanner" alongside BACKLOG:182's
   value-slot-grammar single-sourcing — do NOT expand this slice to refactor Phase 2.
2. **Quoted-key handling.** Mirror the top-level "quotes retained" imprecision (safe FN) vs add a
   `mappingColonIndex`/`unquoteKey`-style resolve. *Recommend: mirror top-level* (rare, safe); revisit
   only if the review shows a real miss.
3. **Fixture depth.** One combined `nested-front-matter.qmd` (execute + format in one tree) vs two.
   *Recommend: one* mixed fixture + one all-valid fixture (matches Phase 2's two-fixture pattern).

---

## §11 — Here be dragons (executor quick-reference, Learning #3)

1. 🐉 **The FLOW-DEPTH counter is not optional AND must be quote-aware + node-property-aware — do NOT
   just copy the top-level `netFlowDelta`.** The plan review rendered THREE exit-0 docs a naive counter
   FPs on: `format.html.x: {` + same-indent `toc: yes`; the anchored opener `foo: &a { … toc: yes }`
   (first-char `/^[[{]/` never arms → arm on `flowScan(token) > 0` instead); and the quoted brace
   `a: "}"` (naive count drops depth early → count only outside quotes). At depth there is NO column-0
   backstop, so an under-count is a live FP, not a safe FN. Add "not emitted" unit rows for all three
   BEFORE wiring (§7.1).
2. 🐉 **`parentPath` EXCLUDES the key** (function convention), unlike the completion *context*'s
   `parentPath` which INCLUDES it. Resolution is `frontMatterKeys(parentPath).find(name===key)`, NOT
   `.slice(0,-1)`. Encode this in the record's doc-comment.
3. 🐉 **`daemon`/`output` stay OPEN.** They render exit 0 on off-list values. Do NOT mark them
   `valuesClosed` "for symmetry" — `daemon: 30`/`output: banana` would false-positive. The numeric slice
   owns `daemon`.
4. 🐉 **Block scalars are protected by `nestedParentPath`, not by a separate state machine** — but only
   because the `key: \|` line is a scalar-value container it bails on. Don't "optimize" the enumerator
   to stop calling `nestedParentPath` per line, or you lose the protection (and the `format`-rooted rule).
5. 🐉 **The empty fast-path must count nested lines too** (`computeValueDiagnostics:65`) — else an
   all-nested-only doc early-returns `[]`.
6. 🐉 **Reader path (format) is already correct; the curated path (execute) is the ONLY annotation
   surface.** Don't touch the per-format reader; don't forget the curated execute annotation.
7. 🐉 **The mandatory §9 adversarial review caught 2 criticals on EACH of Phases 1 & 2.** It is not
   optional. Render the NEW nested-surface shapes (flow-at-depth, tab indent, `format:\n <fmt>: scalar`,
   block-scalar both indentations) firsthand.
8. `BACKLOG:NNN` is a **line number**; item 46's v2 line flips its "nested" clause to shipped (keeping
   numeric/`.ipynb` open) when the impl session ships — NOT in this planning session.

---

## Provenance — how this plan was grounded and hardened (Session 127)

- **Firsthand ground truth (§2):** every `execute.*` and `format.<fmt>.*` closedness/FP row was rendered
  personally with `quarto render` 1.7.33 (`--no-execute`), not taken from the schema text.
- **Reader-closedness audit:** a grounding `Workflow` compiled the reader (`parseSchemaIndex`) against
  the installed `yaml-intelligence-resources.json` and confirmed `format.<fmt>.*` closedness is derived
  correctly (zero divergence from the renders) — so no format schema change is needed; the `execute:`
  curated-annotation gap (§3.2) is the only core change.
- **Mandatory adversarial review of the PLAN (5 lenses, each `quarto render`-verified):** L1 execute
  closedness **CLEAN**, L2 format closedness **CLEAN** (134/134 closed fields reject off-list values),
  L5 citations **CLEAN**. L3 caught a **CRITICAL** + **HIGH** FP in the flow-tracking design (anchored
  opener + quoted-brace under-count — both firsthand-reconfirmed here, exit 0) → folded into §2.3/§3.3
  step 2/§7.1/§11. L4 caught a **MEDIUM** coverage-disclosure gap (`crossref:`/`website:`/`brand:`
  closed children, safe FN) → §4.3. This mirrors S123's plan review catching a critical closedness FP;
  Learning #138 (every value surface hides ≥1 review-caught defect) held again — this time at the
  *plan* stage, before any code.
