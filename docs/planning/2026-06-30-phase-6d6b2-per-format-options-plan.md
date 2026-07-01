# Phase 6d-6+ (b2) — Per-Format Options + Deeper Nesting: Implementation Plan

**Status:** PLAN (draft for executor sessions). Produced by Session 33 (2026-06-30) as a **grounding + plan** — the "🐉 recursive `schema.yml` walk" the parent 6d plan feared is **resolved (dissolved) here**; implementation is separate, later sessions.
**Author:** Session 33 (R. Mark Sharp / Claude).
**Governs:** `docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md` §6 Slice **6d-6+** (the deferred "Format-conditional NESTED completion (OPTIONAL / likely v2.x)"). This is the per-slice plan that §6 6d-6+ deferred to ("budget >1 session; or descope from 6d and revisit").
**Out of scope:** Everything already shipped in 6d-1…6d-6 + the `format:`-name and top-level-`format:`-scalar continuations (Sessions 18–26). This plan covers ONLY per-format **option** completion under a concrete format name (`format:\n  html:\n    <opt>`) and the residual deep-nesting deferral.

---

## 0. How this plan was produced (evidence provenance)

Grounded in firsthand inspection of the installed Quarto CLI (1.7.33) share dir + the repo, corroborated by a 7-agent grounding+adversarial-verification Workflow (Session 33). **Every load-bearing claim below was verified by the author directly** (per the Planning workstream mandate — Learning #24), then cross-checked by the Workflow. The two adversarial verdicts materially shaped the plan:

- **"Per-format completion REQUIRES a recursive `schema.yml` object-graph walk"** — **REFUTED** (verdict `cheap-reuse-viable`). Confirmed firsthand: `schema/schema.yml` is the DSL *meta-grammar* (20 records: `schema/scalar`, `schema/enum`, `schema/ref`, `schema/resolve-ref`, `schema/any-of`, …), NOT the format-option graph. Quarto's own editor derives per-format options with a **bounded flat filter** over the `document-*`/`cell-*` field lists keyed by each field's `tags.formats` (alias-expanded, negation-aware) — no meta-schema walk. The parent plan's "🐉 recursive DSL walk" framing (inherited into the Session 32 handoff) was an over-estimate.
- **"Reusing the flat document-key set (a cheap union) is a faithful-enough v1"** — **REFUTED** (verdict `mixed`). Firsthand, the naive union is wrong for the concrete format **49–76 % of the time** (docx/typst ~75 % invalid, gfm ~76 %, html/pdf ~55–59 %); it makes `format:\n  html:` and `format:\n  pdf:` offer the **identical** list (defeating the feature's only purpose); and it is **not even cheaper** than the correct filter — `toField` already parses `tags.formats` and discards it (`src/core/yaml-schema.ts:485`). The project's own precedent (Learning #27d) already rejected a 1/7-this-scale over-offer and implemented `cellOptions(engine)` filtering. **Do not ship the union.**

**Net:** the correct per-format KEY filter is BOTH cheap AND faithful. That is the v1. The only genuine recursive-graph residue is *deep nesting below the first per-format level* (object-valued options + `super`/`allOf` merges), which is explicitly deferred (§6 b2-iii) and must NOT gate the feature.

---

## 1. Executive summary (TL;DR)

**The dragon is dissolved.** Per-format option completion is a **flat `tags.formats` filter**, not a recursive schema walk. Under `format:\n  <fmt>:\n    <opt>` the valid option KEYS are exactly the `document-*` (and format-scoped `cell-*`) fields whose `tags.formats` admits the concrete format `<fmt>` — where an option is valid iff it is **untagged** (format-agnostic) OR **no `!`-negated tag matches** `<fmt>` AND **(no positive tag OR some positive tag matches)** `<fmt>`, with every tag recursively expanded through the closed **14-entry `schema/format-aliases.yml`** table. This mirrors Quarto's own `getFormatSchema`/`useSchema` exactly.

**6d-6+ (b2) is ~2 implementation sessions, not a multi-session recursive-walk epic:**

| Slice | Capability | Ships | New logic |
|---|---|---|---|
| **6d-6+ (b2-i)** | Per-format option **KEY** completion (the correct `tags.formats` filter) | `format:\n  html:\n    <key>` → html's valid options | Detector 2-level walk + reader per-format filter + a pure `core/format-aliases.ts` |
| **6d-6+ (b2-ii)** | Per-format option **VALUE** completion | `format:\n  html:\n    toc: <value>` → `true`/`false` | Mostly FREE — `valuesOfSchema` already resolves each field's values; trace-first |
| **6d-6+ (b2-iii)** | 🐉 Deep nesting (3+ levels, object-valued options, `super`/`allOf`) | *deferred* | The ONLY genuine recursive-graph residue — degrade gracefully, own future slice |

Each slice is **one session, strict TDD, vertical**. The provider (`src/providers/yaml.ts`) is already **generic over `parentPath`** (`:99`, `:110`) → it needs **ZERO change**; the whole feature lives in pure `vscode`-free core (§3.3 clean). **Recommended stopping point:** after **b2-ii** (the complete per-format key+value milestone). b2-iii is optional/v2.x.

---

## 2. The mechanism, resolved — how per-format scoping actually works

### 2.1 The data is a per-option tag + a tiny alias table (grounded firsthand)

The installed completion resource `<share>/editor/tools/yaml/yaml-intelligence-resources.json` (68 top-level keys) carries **NO precomputed `format-name → [options]` map**. Per-format scoping lives on each field:

- **`tags.formats`** on each option (`schema/document-*.yml` + format-scoped `schema/cell-*.yml`). Firsthand distribution over the non-hidden `document-*` fields (383 entries): **318 positive-only**, **58 untagged (universal)**, **6 negation-only**, **1 mixed**. Values are concrete names (`revealjs`, `beamer`, `typst`, `docx`, …), `$`-aliases (`$pdf-all`, `$html-doc`, `$html-all`, …), and `!`-negations (`!man`, `!$docbook-all`, …).
- **`schema/format-aliases.yml`** — a closed **14-entry** table (`{aliases: {…}}`), recursively nested:
  - `pdf-all → [latex, pdf, beamer]`, `epub-all → [epub, epub2, epub3]`, `office-all → [docx, pptx]`, `docbook-all → [docbook, docbook4, docbook5]`, `odt-all → [odt, opendocument]`, `markdown-all → [markdown, gfm, commonmark, commonmark_x, markua, md]`, `asciidoc-all → [asciidoc, asciidoctor]`
  - `html-doc → [html, html4, html5]`, `html-pres → [slidy, slideous, s5, revealjs, dzslides]`, `pres-all → [pptx, beamer, $html-pres]`, `html-files → [$html-doc, $html-pres, dashboard]`, `html-all → [$html-files, $epub-all]`, `jats-all → […]`
  - **Nested** (`$html-all` expands two levels to 12 concrete formats incl. `dashboard` + all epub variants — a firsthand-verified recursion).
- **`pandoc/formats.yml`** — the flat 67-name format universe (already consumed by `collectFormatNames`, Session 25). The `format:`-name completion (Session 25) already derives from this.

**Both `format-aliases.yml` AND all the `tags.formats` data are ALREADY in the parsed resource JSON** the reader loads today — so per-format completion needs **NO new spawn / file read**. `parseSchemaIndex` already has `data` in hand; it currently reads `e.tags` only for `engineTag` (`:485`) and discards `e.tags.formats`.

### 2.2 The filter algorithm (mirrors Quarto's `useSchema`, verified firsthand)

For a concrete format `fmt` and an option whose `tags.formats` is `T`:

```
valid(T, fmt):
  if T is undefined            → true                       # untagged = universal
  disabled = expandAliases( [t[1:] for t in T if t starts "!"] )
  enabled  = expandAliases( [t     for t in T if not "!"]     )
  if fmt ∈ disabled            → false
  if enabled is empty          → true                        # only negations = all-except
  return fmt ∈ enabled
```

`expandAliases(list)` recursively flattens each `$`-prefixed name through `format-aliases.yml` into concrete format names (non-`$` entries are already concrete); guard against cycles with a `seen` set (the table is acyclic today, but be defensive — Learning #16). Firsthand negation-aware counts confirm the filter *materially* discriminates (not a rubber stamp): **html 155, pdf 142, revealjs 180, docx 77, typst 79, gfm 72** valid options — vs. a 383-name flat union. The single `mixed` example (`columns: ['!$pdf-all', '!$office-all', '!$odt-all', '!$html-all', '!$docbook-all', 'typst']`) exercises both arms and is a good test fixture.

### 2.3 Source set — `document-*` ∪ format-scoped `cell-*` (faithfulness note)

Quarto's `getFormatSchema` globs `schema/{document,cell}-*.yml`. A **document-only** source UNDER-offers a few canonical per-format options that live in `cell-*.yml` — notably **`code-fold`** (THE canonical html option), `fig-align`, `code-line-numbers`. So the faithful per-format source is:

> **document-\* fields ∪ cell-\* fields that carry a `tags.formats`** (i.e. the format-scoped cell options, not the pure execution options like `echo`/`eval`), each passed through `valid(T, fmt)`.

The reader already collects `cell-*` fields (`collectFields(data, "schema/cell-", …)`); the format-scoped subset is those with a `tags.formats`. (b2-i) should fold these in; §9 Q3 leaves the exact inclusion rule as a small executor decision.

### 2.4 Licensing / posture — unchanged from 6d-3

All of this is **runtime-read** from the user's own MIT Quarto CLI share dir (already loaded), so: **+0 `.vsix` bytes, no NOTICE, auto-tracks the user's Quarto version, never throws → curated fallback** (Learning #27, the established 6d posture). Option names + alias-group names are uncopyrightable facts; descriptions are our own. Add `getFormatSchema` / `useSchema` / `expandAliasesFrom` / `format-aliases.yml` to the **re-verify-on-Quarto-upgrade** marker list (Learnings #4/#8/#11/#25/#27/#32).

---

## 3. Scope — the slice boundaries

Per the parent 6d plan §3 binding rules (do NOT violate):

- **(a) Never bundle KEY + VALUE in one slice.** → b2-i (key) and b2-ii (value) are separate sessions.
- **(b) Grow the pure core just-enough per slice.** → b2-i adds the detector 2-level walk + the filter; b2-ii adds only what value completion still needs (likely near-nothing — trace first).
- **(c) Never build the schema-consumption core as a standalone no-UI session** (forbidden horizontal layer, FM #25). → each slice ships a real completion in the editor.

The genuine remaining dragon (b2-iii) — deep nesting + `super`/`allOf` — is **descoped to its own future slice** and must not block b2-i/b2-ii. It degrades gracefully (offer the option key; no deep sub-completion).

---

## 4. Evidence-based inventory (MANDATORY — grep-verified firsthand)

All `file:line` below were confirmed firsthand this session (`grep -n`, and full reads of the three files). This inventory **is** the plan's verification step — the executor's "files to change" list comes from here.

### 4.1 Reuse table (exists; consume/extend, do not rebuild)

| # | Component | Location | How b2 uses it |
|---|---|---|---|
| R1 | Nested-context detector (one-level) | `src/core/yaml-context.ts` `nestedKeyContextAt:159-226`; `nearestShallowerLine:235-254`; `NESTED_CONTAINERS:271` (`{execute, format}`) | **Generalize** to a bounded 2-level ancestor walk rooted at `format` (§5.1). The KEY branch (`parentPath:[parentKey]` `:205`) and VALUE branch (`parentPath:[parentKey,keyText]` `:219`) grow to multi-element paths. |
| R2 | One-level bail | `yaml-context.ts:178-181` (`if (/^[ \t]/.test(parent) || …) return null` — rejects an indented container) | This is the exact guard to relax **for the `format` root only** (execute stays one-level). |
| R3 | Value-slot grammar (shared) | `yaml-context.ts` `valueSlotAfterColon:313-327` (used by `topLevelSlots` + `nestedKeyContextAt`) | Reused unchanged for the nested value slot. |
| R4 | Schema reader + index | `src/core/yaml-schema.ts` `parseSchemaIndex:501-515`, `indexOf:292-335`, `frontMatterKeys:316-333`, `toField:468-490` (reads `e.tags` at `:485`), `collectFields:570-590`, `collectFormatNames:545-563` | Capture `tags.formats` in `toField`; add a `parentPath==["format",fmt]` branch in `frontMatterKeys` (before the `return []` at `:332`); extract the alias table in `parseSchemaIndex` from the already-parsed `data`. |
| R5 | Value resolver | `yaml-schema.ts` `valuesOfSchema:418-452` | **Unchanged** — already resolves each field's `.values` (boolean/enum/anyOf/ref one-hop) regardless of format scope → per-format VALUE completion (b2-ii) comes free. |
| R6 | Provider (generic over `parentPath`) | `src/providers/yaml.ts` frontmatter-key branch `:97-101` (`frontMatterKeys(ctx.parentPath)`), frontmatter-value branch `:102-115` (`frontMatterKeys(ctx.parentPath.slice(0,-1))`) | **ZERO change** — a longer `parentPath` flows through unmodified. |
| R7 | Format-name source | `yaml-schema.ts` `collectFormatNames:545-563`, `CURATED_FORMAT_NAMES:243-258` | The concrete-format universe (Session 25). NB the detector does NOT need it (§5.1); the reader's filter handles an unknown `fmt` → universal-only. |
| R8 | Impure read (isolated) | `src/features/yaml-schema-source.ts` (`node:fs/promises`, `quartoSharePath`, degrade to `CURATED_SCHEMA_INDEX`) | **Unchanged** — the alias table rides in the same JSON already read; no new spawn/read. §3.3 guardrail untouched. |
| R9 | Tests | `test/unit/yaml-context.test.ts` (49), `test/unit/yaml-schema.test.ts` (30), `test/unit/yaml-schema-index.test.ts` (38), `test/integration/suite/yaml.test.ts` (58); `EXTENSION_ID` const (Learning #18) | Add cases + FLIP the deferral shape-lock at `yaml-context.test.ts:301-305` (§4.4). Re-run the FULL integration suite. |

### 4.2 Gaps table (does NOT exist; must be built)

| # | Gap | Evidence | Built in slice |
|---|---|---|---|
| G1 | **2-level nested-position detection.** `nestedKeyContextAt` bails when the immediate parent is itself indented (`yaml-context.ts:178-181`), so `format:\n  html:\n    <opt>` yields `null`. | `yaml-context.ts:178-181`; the deferral test `yaml-context.test.ts:301-305` | **b2-i** — the bounded 2-level ancestor walk (§5.1). |
| G2 | **`tags.formats` capture + the alias-expansion filter.** `toField` reads `e.tags` only for `engineTag` (`yaml-schema.ts:485`) and discards `e.tags.formats`; nothing reads `schema/format-aliases.yml` from the parsed `data`; there is no per-format predicate. | `yaml-schema.ts:485`; no grep hit for `format-aliases` / `formats` filter in `src/` | **b2-i** — `SchemaField.formats`, a pure `core/format-aliases.ts` (`expandFormatAliases` + `formatMatches`), extract the alias table in `parseSchemaIndex`. |
| G3 | **`frontMatterKeys(["format", fmt])` resolution.** Any `parentPath.length>1` returns `[]` (`yaml-schema.ts:332`). | `yaml-schema.ts:329-332` | **b2-i** — add the `["format", fmt]` branch: filtered per-format source (§2.3). |
| G4 | **Per-format offline fallback.** `CURATED_SCHEMA_INDEX` has no per-format set and no curated alias table. | `yaml-schema.ts:365-369` (`CURATED_SCHEMA_INDEX`) | **b2-i** — a curated alias table (the 14 entries) + a small curated universal option set OR `[]` (§9 Q2). |

### 4.3 The inverted provider-gating trap (still load-bearing)

Unchanged from the parent plan §4.3: the YAML provider is the COMPLEMENT of the `@` cross-ref/citation providers on the shared `{language:"quarto"}` selector. A new per-format position must still return `undefined` in prose/cells and must not let `@` items leak into front matter. Because the whole b2 change is *inside* `nestedKeyContextAt` (already front-matter-gated) and the reader, the gating contract is structurally preserved — **but** every b2 slice MUST still include the both-directions no-cross-pollination regression (no per-format items at a prose/cell position; no `@` items at a `format:\n  html:\n    <opt>` position), keyed on the `detail` discriminator (`"Quarto document option"` / `"Quarto document option value"`), per Learnings #25b/#28c.

### 4.4 The deferral shape-locks that FLIP (specify exactly)

Implementing a deferred behavior flips its shape-lock in the SAME change (Learnings #29c/#31d/#33e). Two tests in `test/unit/yaml-context.test.ts`:

- **`:301-305` "bails (null) on a per-format option line — deeper nesting under a format name"** (`format:\n  html:\n    toc: true`, cursor in `toc`) — **FLIPS** to assert `{kind:"frontmatter-key", parentPath:["format","html"], token:"to", replaceRange:{line:3,startCol:4,endCol:7}}`. This is THE b2-i RED→GREEN discriminator.
- **`:254-257` "bails (null) on deeper nesting (parent is itself indented)"** (`execute:\n  julia:\n    exeflags: x`) — **STAYS null** (execute is one-level only; per-format 2-level is rooted at `format`, not `execute`). Keep this as the negative control proving the 2-level walk is `format`-scoped, not universal. If the executor's walk wrongly generalizes to any container, this test goes RED — a built-in guard.
- **`:288-299` "returns a nested frontmatter-VALUE context past the colon (`  html: default`)"** — **STAYS** (a format name with a scalar value on its own line is the one-level `["format","html"]` value case; unaffected by 2-level nesting).

---

## 5. Interface contracts (interface-first; all core types, never `vscode.*`)

### 5.1 Detector — bounded 2-level ancestor walk (`core/yaml-context.ts`)

Generalize `nestedKeyContextAt` so the parent chain may be **exactly two levels deep when the column-0 root is `format`** (execute stays one level). Algorithm (schema-free — the detector never imports schema data; the reader decides what a format name means):

```
nestedKeyContextAt(lines, line, col):
  option line indented at indent1 > 0 (else null); rest is a key line, not `- `/`#` (existing guards)
  parent  = nearestShallowerLine(lines, line, indent1)      # the `<fmt>:` or the column-0 container
  parent must be a pure-mapping key (existing scalar/flow/block-scalar bail applies to it)
  indent2 = leading-ws(parent)
  if indent2 == 0:                                           # ONE level (unchanged):
      containerKey = key(parent); require containerKey ∈ NESTED_CONTAINERS
      parentPath = [containerKey]                            # e.g. ["execute"] / ["format"]
  else:                                                      # TWO levels (NEW, format-only):
      grand = nearestShallowerLine(lines, parentLine, indent2)
      require grand at column 0, a pure-mapping key, and key(grand) == "format"
      parentPath = ["format", key(parent)]                  # e.g. ["format","html"]
  # (a THIRD indented ancestor, or a 2-level root ≠ "format", falls through to null — b2-iii deferred)
  KEY slot  → {kind:"frontmatter-key",   parentPath,                 token, replaceRange}
  VALUE slot→ {kind:"frontmatter-value", parentPath:[...parentPath, keyText], token, replaceRange}
```

Note `nearestShallowerLine` already takes `(lines, line, indent)`; the 2-level step calls it again from the parent's line with `indent2`. Keep the conservative posture: **bail (`null`) on any ambiguity** — a 3rd level, a non-`format` 2-level root, a scalar/flow/block-scalar intermediate parent, a sequence item. The detector stays in `yaml-context.ts` (model.ts is out of scope — SAFEGUARDS: no cross-module refactor without plan mode).

### 5.2 Per-format filter (new pure `core/format-aliases.ts`)

```ts
export type FormatAliases = Map<string, string[]>;   // alias name (no `$`) → member names (concrete or `$`-alias)

/** Recursively flatten `$`-aliases in `names` to the set of concrete format names. Cycle-guarded. */
export function expandFormatAliases(names: string[], aliases: FormatAliases): Set<string>;

/** Quarto `useSchema` semantics: valid iff untagged, or (no `!`-match) and (no positive OR a positive match). */
export function formatMatches(tagsFormats: string[] | undefined, format: string, aliases: FormatAliases): boolean;
```

`SchemaField` gains an optional carrier for the raw tag list (split at filter time, or pre-split):
```ts
export interface SchemaField {
  name: string; description?: string; values?: string[]; engine?: "knitr" | "jupyter";
  formats?: string[];   // raw tags.formats (incl. `$`-aliases and `!`-negations); undefined = universal
}
```

### 5.3 Index (`core/yaml-schema.ts`)

`SchemaIndex.frontMatterKeys(parentPath)` gains one branch (before `:332 return []`):
```ts
if (parentPath.length === 2 && parentPath[0] === "format") {
  const fmt = parentPath[1];
  return perFormatFields.filter((f) => formatMatches(f.formats, fmt, aliases));  // document-* ∪ format-scoped cell-*
}
```
`parseSchemaIndex` extracts `aliases` from `data["schema/format-aliases.yml"].aliases` (already parsed) and threads it + the per-format source into `indexOf`. Offline `CURATED_SCHEMA_INDEX` uses `CURATED_FORMAT_ALIASES` (the 14 entries) + a small curated universal option set (§9 Q2). `toField` sets `field.formats = e.tags.formats` when present.

### 5.4 Provider (`providers/yaml.ts`) — UNCHANGED

`frontMatterKeys(ctx.parentPath)` (key, `:99`) and `frontMatterKeys(ctx.parentPath.slice(0,-1))` (value, `:110`) already accept any-length paths. A `["format","html"]` key path and a `["format","html","toc"]` value path both resolve correctly with no provider edit. Verified firsthand.

---

## 6. The slices (each = ONE session, strict TDD, vertical)

> Format per slice: **Goal → New/changed files → What DONE looks like → Verification → Dragons → Session boundary.** 5-file-per-commit cap is per-commit; checkpoint-commit at each layer boundary (core detector → core reader → tests).

### Slice 6d-6+ (b2-i) — per-format option KEY completion (the correct `tags.formats` filter) — SHIP FIRST

- **Goal:** On an option-key line two levels under `format:` (`format:\n  html:\n    <key>`), offer exactly the options Quarto considers valid for that concrete format (untagged ∪ tag-matched, alias-expanded, negation-aware). `format:\n  pdf:` and `format:\n  html:` offer *different* sets.
- **New/changed:** `core/yaml-context.ts` (generalize `nestedKeyContextAt` to the bounded 2-level walk — §5.1) · **new** `core/format-aliases.ts` (`expandFormatAliases` + `formatMatches`) · `core/yaml-schema.ts` (`SchemaField.formats`; capture in `toField`; extract the alias table in `parseSchemaIndex`; the `["format", fmt]` branch in `frontMatterKeys`; `CURATED_FORMAT_ALIASES` + a small curated universal fallback) · `providers/yaml.ts` **UNCHANGED** · unit tests (`format-aliases.test.ts` new; `yaml-context.test.ts` +walk cases & FLIP `:301-305`; `yaml-schema-index.test.ts` +`frontMatterKeys(["format","html"])`) + integration (`yaml.test.ts`).
- **DONE:** in `format:\n  html:\n    <cursor>`, html's valid options appear (incl. `code-fold` if cell-\* folded in — §2.3); under `format:\n  gfm:` an html-only key (e.g. `theme`) does NOT appear; `execute:`-nested and prose/cell positions still yield nothing (gating regression, both directions); the `execute:\n  julia:\n    exeflags` deeper-nesting case STILL bails (`:254`).
- **Verify:** `npm test` (new unit RED→GREEN; the `:301` flip is the headline RED→GREEN); `npm run test:integration` (provider via `executeCompletionItemProvider`, inverted-gating regression); `npm run compile`; `npm run package`. **Gate-d discriminator:** the integration positive must assert a **reader-only** document-\* key that is **valid for html but INVALID for gfm** — assert it appears under `format:\n  html:` AND is ABSENT under `format:\n  gfm:` (this fails against a naive union, proving the *filter* ran, not just the reader). Break-revert the relaxed detector guard (reds the 2-level cases; runtime-conditional so the build stays clean — Learning #33d/#38d) and the `formatMatches` filter (force it to `true` → the gfm-absence assertion reds).
- **Dragons (🐉):** (1) **Alias recursion + negation** — `expandFormatAliases` must handle nested `$`-aliases (`html-all`→12 concrete) and cycle-guard; `formatMatches` must handle untagged=universal, `!`-negation (`all-except`), and the `mixed` case (`columns`) — encode all three as failing-first tests (§2.2). (2) **Unknown `fmt`** — the detector is schema-free, so a typo/newer format name reaches the reader; the filter yields universal-only (safe degradation) — do NOT bail in the detector (keeps core layering: position ⊥ data). (3) **cell-\* inclusion** — decide whether to fold format-scoped `cell-*` fields into the per-format source in-slice (recommended, recovers `code-fold`) or file it (§9 Q3). (4) **Keep the 2-level walk `format`-rooted** — `:254` is the guard that it didn't over-generalize to `execute`.
- **Boundary:** one session. Close out when per-format KEYS complete. **Do not also do values.**

### Slice 6d-6+ (b2-ii) — per-format option VALUE completion

- **Goal:** After a per-format option key (`format:\n  html:\n    toc: <value>`), offer that option's enum/boolean values (`true`/`false`; `fig-format:` → `retina/png/jpeg/svg/pdf`; `pdf-engine:` → its enum).
- **Trace first (Learning #29a/#33a):** after b2-i, the detector already emits `{kind:"frontmatter-value", parentPath:["format","html","toc"]}` for the value slot, and the provider's value branch does `frontMatterKeys(["format","html"]).find("toc").values` — and `valuesOfSchema` already resolved `toc`'s `[true,false]`. So **per-format VALUE completion is very likely already working after b2-i**. This slice may be **test-only** (like the top-level `format:` scalar was in Session 26). Verify firsthand before assuming a code change is needed.
- **New/changed:** likely `yaml-schema.ts`/curated only if anything at all; unit + integration VALUE tests. (If the trace shows it already works, the slice is the value TESTS + confirming the value path end-to-end — an honest, faithful slice.)
- **DONE:** value enums complete after a known per-format option key; an option with no enum offers nothing (no crash); the leading-space-on-`:` normalization holds (`toc:` → ` true`).
- **Verify:** as b2-i. Gate-d: a reader-only value discriminator (a format-scoped option whose enum comes only from the reader).
- **Dragons:** the value `parentPath` is now 3 elements (`["format","html","toc"]`); confirm `parentPath.slice(0,-1)` = `["format","html"]` resolves the per-format field list, not `[]`.
- **Boundary:** one session.

### Slice 6d-6+ (b2-iii) — 🐉 deep nesting + `super`/`allOf` (DEFERRED / v2.x)

- **Goal:** completion **below** the first per-format level — options whose value is itself an object (`format:\n  html:\n    <opt>:\n      <sub-opt>`) and `super`/`allOf` merges inside complex object-valued format options.
- **Why deferred:** THIS is the only part that genuinely touches the recursive `schema/schema.yml` object graph (`resolveRef`/`super`/`anyOf`). It is a distinct, larger capability; it degrades gracefully in b2-i/b2-ii (the option key completes; the deep sub-object offers nothing — the project's benign-degradation posture) and MUST NOT gate the per-format feature.
- **Boundary:** its own future planning + implementation session(s). Document the one-level-under-format limitation when b2-i ships.

---

## 7. Failure-mode / risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Detector over-generalizes** the 2-level walk to non-`format` containers (e.g. lets `execute:\n  x:\n    y` complete) | High | Root the 2-level path on `key(grand) == "format"` only; the `:254` execute test is the standing guard; break-revert-prove the relaxed guard reds ONLY the format cases. |
| **Filter incorrect** (drops universal options / mishandles `!`-negation / mis-expands nested aliases) → wrong or missing keys | High | Encode the three grounded gotchas (untagged=universal; `!`=all-except; nested alias recursion) as failing-first tests; mirror `formatMatches` over the real schema and diff (Learning #27b). |
| **Naive union regression** (someone ships the flat document-\* list to "save time") | High | §8 rejected-alternative with the 49–76 %-wrong data; the gate-d gfm-absence assertion fails against the union. |
| **Provider cross-pollution** (per-format items in prose; `@` items under `format:`) | Medium | Both-directions no-leak regression each slice (§4.3); the change is inside the already-gated `nestedKeyContextAt`. |
| **cell-\* under-offer** (`code-fold`/`fig-align` missing if only document-\* is sourced) | Medium | Fold format-scoped `cell-*` fields into the per-format source (§2.3); §9 Q3. |
| **`format-aliases.yml` restructured / grows** | Low | Runtime-read the parsed table; cycle-guard `expandFormatAliases`; curated 14-entry fallback; re-verify on upgrade. |
| **Unknown/typo `fmt`** | Low | Filter degrades to universal-only (never a wrong "unknown key"); detector stays schema-free. |
| **Deep nesting (b2-iii) typed by a user** | Low | Graceful — the option key completes; the deep sub-object offers nothing. Documented limitation. |

---

## 8. Alternatives considered

| Alternative | Why not |
|---|---|
| **Recursive `schema/schema.yml` object-graph walk** (the parent plan's framing) | REFUTED firsthand + by an adversarial verifier: `schema/schema.yml` is the DSL *meta-grammar*, not the format graph. Quarto derives per-format options with a flat `tags.formats` filter — no meta-schema walk for the option KEY set. Reserving the walk for the genuine residue (b2-iii deep nesting) is correct; using it for the whole feature is a large over-build. |
| **Naive flat document-\* union under `format:` (a "cheap v1")** | REFUTED (verifier `mixed`, firsthand): wrong 49–76 % per format; makes every format identical (defeats the feature); violates Learning #27d's own precedent; and NOT cheaper — `tags.formats` is already parsed and discarded (`:485`). A misleading affordance (Quarto validation is lenient → the user gets a silent no-op, harder to debug than an error). |
| **Precomputed per-format map in the resource JSON** | Doesn't exist — confirmed firsthand (68 keys: flat `document-*`/`cell-*`, `format-aliases.yml`, `pandoc/formats.yml`; `getFrontMatterFormatSchema` is `defineCached`/lazy). |
| **New runtime read of `schema/format-aliases.yml`** | Unnecessary — the table is already a key in the resource JSON the reader loads; extract it from the parsed `data` (no new spawn). |
| **Validate `fmt` against the format-name list in the detector** | Rejected: couples the pure position module to schema data. The reader's filter already degrades an unknown `fmt` to universal-only — a cleaner separation (position ⊥ data). |
| **Provider special-case for `["format", fmt]`** | Unnecessary — the provider is already generic over `parentPath` (`:99`/`:110`); the change is pure core. |

---

## 9. Open questions for the executor (resolve at implementation, not now)

1. **VALUE slice size (b2-ii):** trace first — per-format values likely already work after b2-i (the reader resolves `values`, the provider is generic). If so, b2-ii is a test-only slice (state that honestly). Confirm firsthand.
2. **Offline per-format fallback (b2-i):** `frontMatterKeys(["format", fmt])` offline should return a small curated **universal** option set (e.g. `toc`, `number-sections`, `fig-width`, `fig-height`, `fig-format`) OR `[]`. Recommend a small curated universal set (mirrors the curated-then-reader pattern), since a full curated per-format set (155 html options) is infeasible. The reader is a hard dependency, so offline is the rare path.
3. **cell-\* inclusion (b2-i, §2.3):** include format-scoped `cell-*` fields (those with a `tags.formats`) in the per-format source so `code-fold`/`fig-align`/`code-line-numbers` appear? Recommend YES (they are canonical per-format options); confirm the exact predicate (a `tags.formats` present, or Quarto's `tags.contexts` context match) against the installed schema. Watch de-dup against document-\* names.
4. **`enabled`-empty-after-negation default:** Quarto treats a negation-only tag (`["!man"]`) as "all formats except man." Confirm the concrete-format universe used for the empty-enabled case (the `formatMatches` semantics in §2.2 returns `true` unless negated — verify that matches Quarto's `pandoc-all` default firsthand for a couple of formats).
5. **Cross-platform / version:** the `tags.formats` + `format-aliases.yml` shape verified on macOS/1.7.33. Re-confirm on a version bump (add to the marker list).

---

## 10. Per-slice quick reference

| Slice | One-line goal | Key new/changed | New logic | Session(s) |
|---|---|---|---|---|
| b2-i | per-format option **keys** (correct `tags.formats` filter) | `yaml-context.ts` 2-level walk · **new** `core/format-aliases.ts` · `yaml-schema.ts` filter branch | detector walk + filter | 1 |
| b2-ii | per-format option **values** | (likely test-only — trace first) | ~none | 1 |
| b2-iii | 🐉 deep nesting + `super`/`allOf` | recursive `schema.yml` walk | the real residue | >1 / defer |

**Recommended stopping point:** after **b2-ii** (complete per-format key+value milestone). b2-iii is optional/v2.x and degrades gracefully. **The operator may also descope b2 entirely** — 6d already ships a complete cell-option + front-matter key/value + one-level-nested key/value + format-name + format-scalar milestone; per-format options are an enhancement, not a gap.

---

*End of Phase 6d-6+ (b2) plan. Implementation is separate sessions, one slice each, strict TDD. The first executor session starts with Slice b2-i. The "recursive schema.yml dragon" the parent plan feared applies ONLY to b2-iii (deep nesting) — b2-i/b2-ii are a bounded detector change + a flat tag filter, grounded firsthand against Quarto 1.7.33.*
