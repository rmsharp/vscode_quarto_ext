# Phase 6d — YAML / `#|` Cell-Option Completion: Implementation Plan

**Status:** PLAN (draft for executor sessions). Produced by Session 17 (2026-06-28) as a **spike + plan** — the dragon (license-clean YAML-schema source) is resolved here; **implementation is separate, later sessions.**
**Author:** Session 17 (R. Mark Sharp / Claude).
**Governs:** `docs/planning/2026-06-27-extension-architecture-plan.md` §5.3 (Editor intelligence, Tier B) and §6 Phase 6d (the 🐉 "needs Quarto's YAML schema" item). This document is the per-phase plan the parent plan's §6 deferred to ("Flag at planning of that session", parent line 329).
**Out of scope:** Phase 6e (embedded-cell language completion via virtual-document forwarding) — a separate capability and separate session(s) per parent plan line 334.

---

## 0. How this plan was produced (evidence provenance)

This plan is grounded in firsthand inspection of the installed Quarto CLI (1.7.33) and the repo, plus a 7-agent investigation+adversarial-verification workflow (Session 17). Every load-bearing claim below was either verified by the author directly or confirmed by ≥2 independent agents. The three adversarial verdicts materially changed the plan:

- **Licensing** — CONFIRMED MIT-clean (4 refutation angles failed), with the vendor-vs-runtime attribution nuance below.
- **Scope** — the framing "6d is one capability" was **REFUTED**: 6d is ~5 distinct completion capabilities. This plan slices accordingly (§3, §6).
- **Stability** — two claims were **REFUTED**: `quarto --paths` is *undocumented*, and `yaml-intelligence-resources.json` is *internal editor tooling*. This plan parses defensively and ships a curated fallback (§2.4, §2.5).

---

## 1. Executive summary (TL;DR)

**The dragon is resolved.** The Quarto-shipped YAML schema is **MIT-licensed** (it lives in the Quarto **CLI** share dir — `/Applications/quarto/share/`, `COPYING.md` = MIT, Posit PBC — the Learning #1 CLI-vs-extension distinction; the AGPL part is the *extension*, not this). The completion-shaped data the feature needs (option names, descriptions, value enums, jupyter-vs-knitr engine tags) is pre-digested in **`<share>/editor/tools/yaml/yaml-intelligence-resources.json`**. The approach is **runtime-read** the user's own installed schema (zero version drift, zero bundle weight, no redistribution → **no NOTICE needed**), with a **tiny curated static fallback** when the read fails.

**6d is not one session.** It decomposes into **5 vertical slices + an optional 6th**, sequenced so cell-option completion (small key space, curated fallback viable) ships before front-matter completion (414-key space, needs the schema reader), and key-completion before value-completion:

| Slice | Capability | Ships | Needs the runtime reader? |
|---|---|---|---|
| **6d-1** | `#\|` cell-option **KEY** completion (curated set) | type `#\| ` in a cell → key suggestions | No (curated) |
| **6d-2** | `#\|` cell-option **VALUE** completion (enum/bool, curated) | `#\| echo: ` → `true`/`false` | No (curated) |
| **6d-3** | **Schema reader** — enrich cell-option completion from live Quarto schema | full 97-option set + descriptions | **Yes (the dragon-resolution slice)** |
| **6d-4** | Front-matter **top-level KEY** completion | key suggestions in the `---` block | Yes |
| **6d-5** | Front-matter **top-level VALUE** completion (enum/bool) | values after `key:` | Yes |
| **6d-6+** | 🐉 Format-conditional **NESTED** completion (`execute:`/`format: html:`) | nested keys/values | Yes; recursive — budget >1 session, or defer to v2.x |

Each slice is **one session, strict TDD, vertical** (provider registered → a real completion appears in the editor). The operator can stop after any slice with a working feature. **6d-1…6d-3 is the headline `#|` milestone**; 6d-4/5 is the front-matter milestone; 6d-6+ is optional.

---

## 2. The dragon, resolved — schema source decision

### 2.1 Licensing (the hard gate) — MIT-clean, CONFIRMED

The schema ships under `/Applications/quarto/share/` (resolve via the CLI, §2.4). `/Applications/quarto/share/COPYING.md` is a plain MIT license (`Copyright (c) 2020-2024 Posit Software, PBC`); `COPYRIGHT` says *"this code is released under the MIT License"* with source at `quarto-dev/quarto-cli`. The adversarial licensing check tried four refutation angles and **could not refute**:

- **(a) No carve-out.** `COPYRIGHT` says "with the exceptions noted below" but enumerates **zero** exceptions in-file; the only nested `LICENSE` files under `share/` are `formats/typst/fonts/` and `formats/pdf/pdfjs/` — **neither is an ancestor of `schema/` or `editor/tools/yaml/`**. Those trees fall under the default MIT grant.
- **(b) Provenance runs the safe direction.** The schema (`.yml` DSL) and `yaml-intelligence-resources.json` are authored *in* `quarto-cli` (MIT). Posit's AGPL VS Code extension *consumes* this schema; it does not author it. Shipping in the MIT CLI share dir is dispositive.
- **(c) Vendor vs runtime-read changes the obligation.** **Runtime-reading the user's own files copies nothing** into our repo/`.vsix` → **no MIT redistribution duty attaches** (and it auto-tracks the user's Quarto version). **Vendoring** *would* be redistribution → MIT's one condition (include the copyright + permission notice) attaches → we'd add a NOTICE block like KaTeX/Mermaid (`NOTICE:45-87`).
- **(d) Distilling is permitted.** MIT grants "modify, merge, publish"; a distilled JSON is a permitted derivative.

**Decision: runtime-read (§2.3) → no NOTICE required.** If a future slice ever vendors a snapshot, it MUST add a NOTICE block (Posit MIT, pinned Quarto version, provenance) — flagged in §6 / §9.

### 2.2 Which artifact to consume — `yaml-intelligence-resources.json` (grounded)

Quarto ships two compiled forms. The author probed both directly:

| Artifact | Shape | Carries completion data? | Verdict |
|---|---|---|---|
| `<share>/schema/json-schemas.json` (~96 KB) | Standard JSON Schema (draft 2020-12): `$schema` + 82 `$defs` keyed by **type names** (`Date`, `NavigationItem`, `BookSchema`…) | Has `description`/`enum` buried deep in the `$defs` graph, but **no flat cell-vs-document grouping** and no `tags.engine`. Built for **validation**, not completion. | ✗ Wrong shape — would require reconstructing option sets from the full graph (the resolver complexity we want to avoid). |
| `<share>/editor/tools/yaml/yaml-intelligence-resources.json` (~679 KB) | Dict keyed `schema/<file>.yml`; each value is the **pre-parsed** `.yml`: `[{name, schema, description:{short,long}, tags:{engine}, hidden, default}]` | **Yes — exactly the completion shape.** `schema/cell-*.yml` → cell options (97 unique names, with `tags.engine` ∈ jupyter/knitr); `schema/document-*.yml` → front-matter keys (414 unique names). | ✓ **The source to consume.** |

> Note: this **flips** the stability verifier's instinct (which preferred `json-schemas.json` for format-durability). That preference was about the *format* being a public standard, but `json-schemas.json` does not actually contain the completion-shaped data — so it is unusable here without reimplementing the resolver. We accept `yaml-intelligence-resources.json`'s "internal file" risk and mitigate it (§2.5).

**Caveat — the `schema` field is still Quarto's DSL.** For **KEY** completion we need only `name` + `description` (trivial). For **VALUE** completion we must interpret the `schema` field: `boolean` → `[true,false]`; `{enum:[…]}` → the list; `string` → no enum; `{anyOf:[…]}` → union; `{arrayOf:…}` → element schema; `ref`/`resolveRef` → look up in `schema/definitions.yml` (also a key in the same file). Slice 6d-3 resolves the **simple** cases (boolean/enum/anyOf-of-those) and **defers** deep ref/super resolution. This is why KEY slices precede VALUE slices.

### 2.3 Runtime-read vs vendor — runtime-read (primary)

| Criterion | (i) Vendor snapshot | **(ii) Runtime-read [CHOSEN]** | (iii) Both |
|---|---|---|---|
| Version drift | Worst — frozen, wrong for any user not on our exact version | **Best — reads the user's own schema, always matches their CLI** | Good |
| `.vsix` size | +up to 679 KB on a 1.29 MB pkg | **+0 bytes** | +679 KB |
| Maintenance | Re-distill + sha256 each Quarto release | **None (Posit maintains; we read)** | Worst |
| Posture fit | Adds a snapshot | **Same trust model as existing `quarto --version`/render/preview shell-outs** | Mixed |
| Licensing | MIT + NOTICE required | **MIT, no NOTICE (we redistribute nothing)** | NOTICE required |

The extension **already** hard-depends on the Quarto CLI at runtime (render/preview/run shell out; `CLAUDE.md:30`, `README.md:107`, `core/version.ts` all assert `quarto>=1.7`; `package.json` has **no `dependencies` key**). Reading a local file from that same install is **strictly weaker coupling** than spawning the CLI. **Decision: runtime-read.**

### 2.4 Resolving the share dir — `quarto --paths`, parsed DEFENSIVELY

`quarto --paths` prints two lines (bin dir, then share dir) and exits 0 — verified live. **But the stability check proved it is UNDOCUMENTED** (absent from `quarto --help`, which lists only `-h/--help`, `-V/--version`, and 21 subcommands). Treat it like the `Browse at`/`Output created` stderr markers (Learnings #4/#8/#11): a fragile, live-captured signal, not an API contract. Implementation rules:

- Reuse the existing binary resolution (`configuredBinary()` → `quarto.path` setting, else `quarto`; `src/quarto/cli.ts:46`). `cli.ts` currently spawns only `--version` (`cli.ts:64`); add a `quartoSharePath()` that spawns `--paths`.
- **Parse defensively:** take the **last** non-empty stdout line, OR the line that is an existing directory ending in `share`. Tolerate a format change.
- Add `--paths` to the "re-verify on Quarto upgrade" list (the project already maintains this for CLI markers).
- Pure parsing stays in `core/`; the spawn + `fs.readFile` live in the adapter (§3.3 guardrail).

### 2.5 Graceful degradation — a tiny curated fallback (NOT the 679 KB file)

The stability check refuted "no fallback." The schema reader degrades through a chain:

1. **try** runtime-read `<share>/editor/tools/yaml/yaml-intelligence-resources.json` → parse → cache (keyed by `quarto --version`).
2. **on any failure** (`--paths` shape changed / file absent / unparseable / `quarto` not found / version `< 1.7`) → fall back to a **hand-curated static set** of the ~15–20 highest-frequency cell options and ~dozen front-matter keys (authored by us, with our own descriptions → independently license-clean; option *names* are uncopyrightable facts).
3. The reader **never throws → returns `[]` or the curated set** (Learning #16 parser-robustness posture).

The curated set authored in **6d-1** is therefore **not throwaway** — it is the permanent fallback the reader (6d-3) needs. Use the schema **for completion only, never authoritative validation**, so a lagging reader degrades to "fewer suggestions," never a false "unknown key" error.

---

## 3. Scope — 6d is ~5 capabilities, not one (the slice boundaries)

The adversarial scope check **refuted** "6d is one capability." It is a bundle differing on **two independent cost axes**:

- **Axis 1 — position detector.** Cell-option detection reuses the existing cell scanner (`findAllCells`); front-matter detection needs **brand-new model surface that does not exist** (the region model deliberately *skips* front matter — §4 GAP #1). These are two different detectors.
- **Axis 2 — schema subset / value interpretation.** KEY completion just lists `name`s. VALUE completion must interpret each entry's `schema` field (a separate interpreter). Format-conditional NESTED completion requires walking the recursive DSL + resolving `format-aliases` (a multi-session subsystem).

**Binding rule from the check (do not violate):** REFUTE any plan that (a) puts front-matter and cell-option completion in the **same** session; (b) bundles **key + value** in one slice; (c) builds the schema-consumption core as a **standalone all-schema session with no completion shipping** (the forbidden horizontal layer — FM #25). **Grow the pure core just-enough per slice.**

The slice sequence (§6) follows directly: smallest surface first (cell-option key, curated), reader isolated to its own slice, front-matter after the reader, key before value, nested last/optional.

---

## 4. Evidence-based inventory (MANDATORY — grep-verified)

All `file:line` below were confirmed firsthand this session (not from memory). This inventory **is** the plan's verification step — the executor's "files to change" list comes from here, not from architectural guesswork.

### 4.1 Reuse table (exists; consume, do not rebuild)

| # | Component | Location | How 6d uses it |
|---|---|---|---|
| R1 | Region scanner (single source of truth — Learning #14) | `src/core/qmd/model.ts:189` (`scanRegions`, **private**); public views `findHeadings:279`, `findAllCells:284`, `findBodyLines:294`, `maskInlineCode:305`, `findCellAtPosition:337`, `buildOutline:352` | Add 6d's new front-matter + cell-option-line **views here** (never a 2nd/3rd scanner). |
| R2 | `Cell` type | `model.ts:44` (`startLine/endLine/lang/code`; `code` is `\n`-joined) | Read `cell.lang` for engine; `startLine` to map an option line to an absolute line; re-split `cell.code` to find `#\|` lines. |
| R3 | Completion-context shape `{start,typed,end}` + token-scan pattern | `refs.ts:207` (`crossrefCompletionContext`), `citations.ts:79` (`citationCompletionContext`); `ID_CHAR` `refs.ts:196` | **Template** for the new YAML context fn — mirror the detection/items split. **Do NOT reuse `ID_CHAR`** for YAML tokens (Learning #16b: different grammar). |
| R4 | Provider registration + `{inserting,replacing}` range + selector | `providers/crossref.ts:22` (`QMD = {language:"quarto"}`), `:27` (register), `:58` (range trick); `citation.ts` mirror | Register `YamlCompletionProvider` the same way (no `package.json` contribution; activation unchanged). The `{inserting,replacing}` range avoids mid-token suffix duplication (Learning #15b). |
| R5 | Activation wiring | `extension.ts:35-37` (`registerOutlineProvider`/`registerCrossrefProviders`/`registerCitationProviders`); `package.json` `activationEvents:["onLanguage:quarto"]` | Append `registerYamlCompletionProvider(context)`. **No Learning #13a trap** (completion providers aren't gated on an extension-set context key). |
| R6 | Front-matter helpers | `frontmatter.ts:81` (`bibliographyPaths`, exported); private `frontMatterLines:22`, `unquote:39`, `stripComment:53`; `FRONTMATTER_OPEN/CLOSE:13-15` | Extend for the front-matter key-path reader; **consolidate** the duplicated `---` regexes onto the shared model accessor (R1) in 6d-4. |
| R7 | Parse-robustness patterns | `citations.ts:32` (BOM strip), `:121` (`try/catch → []`) | Template for the schema reader: BOM strip, never-throw → fallback. |
| R8 | Binary resolution | `quarto/cli.ts:46` (`configuredBinary`), `:60` (`resolveBinary`, spawns `--version` at `:64`) | Add `quartoSharePath()` (spawns `--paths`) reusing `configuredBinary()`. |
| R9 | Test layout | `vitest.config.ts:7` (unit `test/unit/**`); integration via `vscode.executeCompletionItemProvider` (`crossref.test.ts:53`); `EXTENSION_ID` const duplicated in **11** suite files | Unit-test pure core under `test/unit/`; verify the provider via `executeCompletionItemProvider` in a new `test/integration/suite/yaml.test.ts` (copy `EXTENSION_ID`; re-run the **full** integration suite — Learning #18). |

### 4.2 Gaps table (does NOT exist; must be built)

| # | Gap | Evidence | Built in slice |
|---|---|---|---|
| G1 | **Front-matter region boundaries.** `scanRegions` `continue`s over front matter and emits no boundary (`model.ts:202-210`); front-matter lines are absent from headings/cells/bodyLines. The only FM reader (`frontmatter.ts`) extracts one key and its line-slicer is private. | `model.ts:201-211`; `frontmatter.ts:5-6,22` | **6d-4** — add `findFrontMatter(text)`/`inFrontMatter(text,line)` to the shared model + a Learning #14 agreement test; fold `frontmatter.ts` onto it. |
| G2 | **General `#\|`/`//\|` cell-option-line detection.** Only a hard-coded `label:` extractor exists (`refs.ts:65`); `Cell.code` is one joined string with no option/code split. | `refs.ts:65,112`; `model.ts:44` | **6d-1** — add a cell-option-line view (which interior lines are `#\|`/`//\|` options, the key/value slots). |
| G3 | **YAML key-path / indent computation + position discriminator.** No function answers "at this cursor, am I at a front-matter key / cell-option key / value, and what is the parent key-path?" | `frontmatter.ts:86` (single-level only); `refs.ts:207`, `citations.ts:79` (`@`-token scanners only) | **6d-1** (cell-option-key) → grown per slice. |
| G4 | **Schema source.** Nothing reads Quarto's schema; `cli.ts` resolves only `--version`, never the share dir. | `cli.ts:60-64`; no `src/` grep hit for `yaml-intelligence`/`json-schemas`/`share` | **6d-3** — `core/yaml-schema.ts` reader + `quartoSharePath()`. |
| G5 | **Trigger characters.** Only `@` is registered. | `crossref.ts:30`, `citation.ts:39` | **6d-1+** — register `["\|",":","-"]` for the YAML provider. |

### 4.3 The inverted provider-gating trap (load-bearing)

The `@` providers (crossref, citation) gate **to prose**: `if (!isReferenceableLine(text, position.line)) return undefined;` (`crossref.ts:48`, `citation.ts:52`), and `isReferenceableLine` = "line ∈ `findBodyLines`" (`refs.ts:172-173`), which **excludes** front matter and cells. The YAML provider is the **COMPLEMENT**: it must fire **only** in front matter + `#|`/`//|` cell-option lines and return `undefined` in prose/code. All three providers share the whole-document `{language:"quarto"}` selector (embedded TextMate scopes don't reroute providers — Learning #15b), so **each must hard-gate to its own region or they cross-pollute.** Every slice that adds a provider surface MUST include a **regression test asserting NO YAML items at a prose position AND NO `@` items at a front-matter position.**

---

## 5. Interface contracts (interface-first; all core types, never `vscode.*`)

Per the §3.3 guardrail, every provider is `(vscode args) → translate → core fn → translate → vscode result`. The core signatures (grown incrementally — **only the parts a slice needs are added in that slice**):

### 5.1 Shared model additions (`core/qmd/model.ts`)
```ts
// 6d-1: which interior lines of cells are `#|` / `//|` option lines.
export interface CellOptionLine {
  line: number;            // absolute 0-based line in the document
  cellLang: string;        // owning cell's lang (python|r|julia|ojs|js|…)
  prefix: "#|" | "//|";
  keySlot: { startCol: number; endCol: number } | null;   // the key token span, if a key is present/being typed
  // value-slot fields added in 6d-2
}
export function findCellOptionLines(text: string): CellOptionLine[];

// 6d-4: front-matter boundaries (the missing surface — G1). Single scanner (Learning #14).
export function findFrontMatter(text: string): { startLine: number; endLine: number } | null;
export function inFrontMatter(text: string, line: number): boolean;
```

### 5.2 Position discriminator (`core/yaml-context.ts`)
```ts
export type YamlContextKind =
  | "cell-option-key" | "cell-option-value"     // 6d-1 / 6d-2
  | "frontmatter-key" | "frontmatter-value";    // 6d-4 / 6d-5
export interface YamlCompletionContext {
  kind: YamlContextKind;
  parentPath: string[];     // mapping path; for *-value the last element is the key being valued; root => []
  token: string;            // partial key/value fragment ("" allowed)
  replaceRange: { line: number; startCol: number; endCol: number };  // half-open, covers the whole token past the cursor
  engine?: "knitr" | "jupyter" | "ojs";   // cell-option-*; approximated from cell.lang (knitr={r}, jupyter={python|julia}, ojs={ojs|js})
  listItem?: boolean;       // a `- value` block-sequence item (deferred contexts)
}
// returns null when the cursor is NOT in a completable YAML position (prose, code, ambiguous block scalar/flow → bail)
export function completionContextAt(text: string, offset: number): YamlCompletionContext | null;
```

### 5.3 Schema index (`core/yaml-schema.ts`, 6d-3)
```ts
export interface SchemaField {
  name: string;
  description?: string;          // from description.short (or the scalar form)
  values?: string[];            // enum / [true,false] / string.completions — simple cases only in 6d-3
  engine?: "knitr" | "jupyter"; // from tags.engine (cell options)
}
export interface SchemaIndex {
  cellOptions(engine?: "knitr" | "jupyter" | "ojs"): SchemaField[];   // tags.engine unset OR == engine; hidden excluded
  frontMatterKeys(parentPath: string[]): SchemaField[];               // 6d-4+: top-level when parentPath==[]
  valuesFor(kind: YamlContextKind, parentPath: string[], engine?: string): string[];
}
// Pure: parse the yaml-intelligence-resources.json TEXT → SchemaIndex. NEVER throws → returns the curated fallback.
export function parseSchemaIndex(jsonText: string): SchemaIndex;
export const CURATED_CELL_OPTIONS: SchemaField[];      // the ~15-20 fallback set (authored in 6d-1)
export const CURATED_FRONTMATTER_KEYS: SchemaField[];  // ~dozen fallback set (authored in 6d-4)
```
The **adapter** (e.g. `features/yaml-schema-source.ts`) does the impure work: `quartoSharePath()` → `fs.readFile` → `parseSchemaIndex` → cache keyed by `quarto --version`; invalidate on binary/version change; return the curated index on any failure.

### 5.4 Provider (`providers/yaml.ts`)
`YamlCompletionProvider` on `QMD = {language:"quarto"}`, `triggerCharacters: ["|", ":", "-"]`, gated to FM + cell-option regions (inverse of `isReferenceableLine`): `offset = document.offsetAt(position)` → `completionContextAt` → query the `SchemaIndex` by `{kind, parentPath, engine}` → map `replaceRange` to `{inserting:[start,cursor], replacing:[start,end]}` (mirror `crossref.ts:58`). Register in `extension.ts:35-37`.

---

## 6. The slices (each = ONE session, strict TDD, vertical)

> Format per slice: **Goal → New/changed files → What DONE looks like → Verification → Dragons → Session boundary.** The 5-file-per-commit cap (`SAFEGUARDS.md`) is per-commit; checkpoint-commit at each layer boundary (core → provider → tests).

### Slice 6d-1 — `#|` cell-option KEY completion (curated set) — SMALLEST, SHIP FIRST
- **Goal:** Typing on a `#|` (python/r/julia) or `//|` (ojs/js) line inside an executable cell offers cell-option **key** suggestions from a curated set.
- **New/changed:** `model.ts` (+`findCellOptionLines`, G2 — add to the shared scanner) · `core/yaml-context.ts` (+`completionContextAt` for `cell-option-key` only, G3) · `core/yaml-schema.ts` (just `CURATED_CELL_OPTIONS` + a `SchemaField` type; no reader yet) · `providers/yaml.ts` (new, gated to cell-option lines) · `extension.ts` (+register) · `test/unit/yaml-context.test.ts` + `test/unit/cell-option-lines.test.ts` + `test/integration/suite/yaml.test.ts`.
- **DONE:** type `#| ` in a `{python}` cell → `echo`, `eval`, `output`, `warning`, `label`, `fig-cap`, … appear; nothing appears on a prose line or a code line; `@`-completion still suppressed in cells (gating regression test green).
- **Verify:** `npm test` (new unit cases RED→GREEN); `npm run test:integration` (provider via `executeCompletionItemProvider`; the inverted-gating regression — §4.3); `npm run compile`; `npm run package`.
- **Dragons:** the cell-option-line detector must require `line > cell.startLine` and rely on the `#|`/`//|` prefix (the fence line never matches) — don't offer options on the opening fence. Engine approximated by `cell.lang` (benign over-offer in mixed-engine docs; document as deferred).
- **Boundary:** one session. Close out when cell-option keys complete. **Do not also do values.**

### Slice 6d-2 — `#|` cell-option VALUE completion (enum/boolean, curated)
- **Goal:** After `#| echo: `, offer `true`/`false`; after `#| output: `, offer `true`/`false`/`asis`/… — from curated enums for the common options.
- **New/changed:** `yaml-context.ts` (+`cell-option-value` detection, value-slot on `CellOptionLine`) · `yaml-schema.ts` (curated `values` on the fallback fields) · `providers/yaml.ts` (handle value kind, `:` trigger) · unit + integration tests.
- **DONE:** value enums complete after a known cell-option key; unknown keys offer nothing (no crash).
- **Verify:** as 6d-1.
- **Dragons:** value position detection must not fire mid-key; `:` trigger must not pop on prose `Note:` lines (the region gate suppresses prose — assert it in the host).
- **Boundary:** one session.

### Slice 6d-3 — Schema READER (the dragon-resolution slice): enrich from live Quarto schema
- **Goal:** Replace the curated cell-option source with the **full** schema read from the user's Quarto (`yaml-intelligence-resources.json`), degrading to the curated set on any failure. Adds descriptions + the full 97-option set + all simple value enums.
- **New/changed:** `quarto/cli.ts` (+`quartoSharePath()` via `--paths`, defensively parsed — §2.4) · `core/yaml-schema.ts` (+`parseSchemaIndex(jsonText)` — pure, never-throw; resolve simple `schema`→values: boolean/enum/anyOf-of-those; exclude `hidden:true`) · adapter `features/yaml-schema-source.ts` (spawn + read + cache keyed by version + fallback) · wire the provider to query the index · unit tests (parse a fixture JSON) + integration test (stand-in share dir).
- **DONE:** with Quarto present, the full cell-option set + descriptions appear; with `quarto` absent/unreadable, the curated set still appears (degradation test, proven by break-revert — Learning #16 gate d).
- **Verify:** as above + a faithful degradation test (temporarily break `quartoSharePath` → curated fallback still serves → revert).
- **Dragons (🐉):** `--paths` is undocumented (defensive parse, §2.4). `yaml-intelligence-resources.json` is internal editor tooling — completion-only, never-throw, re-verify on upgrade. The `schema`-field interpreter resolves **simple** cases only; deep `ref`/`super`/`resolveRef` into `definitions.yml` is **deferred** (a richer value pass). **Do NOT** vendor here (runtime-read needs no NOTICE); if a future change vendors, add the NOTICE block (§2.1).
- **Boundary:** one session. This is where the dragon lands — give it full attention.

### Slice 6d-4 — Front-matter top-level KEY completion
- **Goal:** Inside the `---`…`---` block, offer top-level document keys (`title`, `author`, `date`, `format`, `execute`, `bibliography`, `toc`, …) from the schema (414 names) with curated fallback.
- **New/changed:** `model.ts` (+`findFrontMatter`/`inFrontMatter`, G1 — **the new front-matter position surface**; add the Learning #14 agreement test; fold `frontmatter.ts`'s private `---` logic onto it) · `yaml-context.ts` (+`frontmatter-key`, top-level only — column-0 key, no parent scan) · `yaml-schema.ts` (`frontMatterKeys([])` + `CURATED_FRONTMATTER_KEYS`) · `providers/yaml.ts` (extend gate to front matter) · unit + integration tests (incl. the inverted-gating regression for the FM side).
- **DONE:** key suggestions appear in front matter; nothing in prose/cells; `@`-completion suppressed in front matter.
- **Verify:** as above; the agreement test (label-like text in front matter is consistently handled across all `scanRegions` consumers).
- **Dragons (🐉):** front-matter detection is the new model surface — keep it in the ONE scanner (Learning #14). The `frontmatter.ts`↔`model.ts` `---`-regex consolidation is a small same-slice cross-file touch (both files); if it grows, stop and defer the de-dup (FM #18 / no cross-module refactor without plan mode).
- **Boundary:** one session.

### Slice 6d-5 — Front-matter top-level VALUE completion (enum/boolean)
- **Goal:** After a top-level `key: `, offer enum/boolean values (`toc: true/false`, `engine: jupyter/knitr`, …).
- **New/changed:** `yaml-context.ts` (+`frontmatter-value`) · `yaml-schema.ts` (`valuesFor` for front-matter keys) · provider · tests.
- **DONE:** value enums complete after known top-level keys.
- **Boundary:** one session.

### Slice 6d-6+ — 🐉 Format-conditional NESTED completion (OPTIONAL / likely v2.x)
- **Goal:** Nested keys/values one level deep under well-known containers (`execute:` children; `format:` → format names), then deeper.
- **Why separate / deferred:** requires the recursive DSL walk (`schema.yml` ~20 recursive defs with `resolveRef`/`super`/`anyOf`) + `format-aliases.yml` expansion (e.g. `$pdf-all → [latex,pdf,beamer]`) to filter keys/values per concrete format. The scope check flagged this as **plausibly multiple sessions on its own**. v1 of nested completion should offer the **union** of all format-option keys (no alias filtering) as a cheap one-level approximation; precise per-format filtering is its own later work.
- **Boundary:** budget **>1 session**; or descope from 6d and revisit. Document the union-approximation limitation if shipped.

---

## 7. Failure-mode / risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Provider cross-pollution** (YAML items in prose, or `@` items in front matter) — shared `{language:"quarto"}` selector | High | Hard-gate each provider to its region; **regression test** asserting no-leak both directions in every provider-touching slice (§4.3). |
| **YAML indentation fragility** — the model tracks no indentation; the upward parent scan is the only nesting inference; tabs-vs-spaces, list-introduced indent, block scalars, flow collections can mis-scope | High (for nested slices) | v1 limits to top-level + an allow-list of one-level containers; **bail (`return null`)** on any block-scalar (`key: |`/`>`) or flow (`[…]`/`{…}`) ambiguity rather than offer wrong keys. |
| **`--paths` format change / share dir moved** | Medium | Defensive parse (last line / existing `share` dir); re-verify on upgrade; curated fallback (§2.5). |
| **`yaml-intelligence-resources.json` restructured by Posit** | Medium | Completion-only, never-throw → curated fallback; it's internal tooling (accepted, documented). |
| **Vendored-snapshot drift** (if a future slice vendors) | Medium | Don't vendor — runtime-read. If vendored, pin version + NOTICE + re-distill discipline (Learning #20/#23). |
| **Engine mis-approximation** (knitr option offered in a `{python}` cell) | Low | Approximate by `cell.lang`; benign extra suggestion; document as deferred (true doc-wide engine resolution is later). |
| **CLI-absent authoring** — no schema completions with no Quarto installed | Low | Accepted: render/preview/run are already unavailable then; curated fallback still serves a useful subset. |
| **`< 1.7` users** — older share dir may lack the file/shape | Low | Reader tolerates missing/odd file → curated fallback; never throw. |

---

## 8. Alternatives considered

| Alternative | Why not |
|---|---|
| **Consume `json-schemas.json`** (standard, durable format) | Probed: it's the **validation** schema keyed by type names — lacks the flat cell-vs-document grouping, `tags.engine`, and per-key descriptions completion needs. Using it means reconstructing option sets from the full `$defs` graph (the resolver complexity we avoid). |
| **Vendor a distilled schema JSON** | Version drift (wrong for any user not on our distill version), +up to 679 KB on the `.vsix`, re-distill+sha256 maintenance each release, and triggers MIT NOTICE duty — all for data meant to track the user's CLI. Runtime-read dominates. |
| **Fold the schema reader into 6d-1** (the scope check's framing) | Defensible, but couples "do cell-option keys complete?" to the fragile `--paths`/file-read/caching machinery. Isolating the reader to 6d-3 ships a working feature faster and contains the dragon. The curated set 6d-1 builds is the permanent fallback either way. |
| **Bundle key + value, or front-matter + cell-option, in one session** | Refuted by the scope check (FM #26 mega-session): different position models + schema subsets + TDD suites. |
| **Build the pure schema core first, all of it, then the UI** | Forbidden horizontal layer (FM #25). Grow the core just-enough per slice. |
| **Reimplement / copy Quarto's `yaml-intelligence.js` completion engine** | Licensing-legal (MIT) but architecturally wrong (Learning #2/#3.3: clean-room a pure `vscode`-free core). Consume the **data**, not Posit's engine. |
| **Full YAML parser dependency** | `package.json` has no runtime `dependencies` (Learning #20); a line-based + indent-scan detector mirrors the existing `@`-context functions and keeps that posture. |

---

## 9. Open questions for the executor (resolve at implementation, not now)

1. **Curated fallback contents (6d-1/6d-4):** which ~15-20 cell options and ~dozen front-matter keys? Seed from the highest-frequency real-world usage (`echo`, `eval`, `output`, `warning`, `error`, `include`, `label`, `fig-cap`, `fig-width`, `fig-height`, `fig-align`, `code-fold`, `code-summary`; `title`, `author`, `date`, `format`, `execute`, `bibliography`, `toc`, `number-sections`, `lang`). Confirm against the schema's own `name` lists.
2. **`schema`-field interpreter depth (6d-3):** confirm which value forms appear for the common options (boolean / `{enum:[…]}` / `{anyOf:[…]}` / `string.completions`) and where `ref`/`resolveRef` into `definitions.yml` first becomes necessary — that boundary is the 6d-3/6d-6 line.
3. **`quarto --paths` cross-platform/version:** verified only on macOS/1.7.33. Re-confirm the 2-line format on Windows/Linux and on a version bump (it's undocumented).
4. **`--paths` floor:** at which Quarto version did `editor/tools/yaml/yaml-intelligence-resources.json` first appear in this shape? Confirm the `< 1.7` degradation path against an older install if one is available.
5. **Trigger `:` UX:** verify in the test-electron host that registering `:` does not pop completion on a prose line containing a colon (the region gate should suppress it).
6. **`frontmatter.ts`↔`model.ts` consolidation (6d-4):** fold the duplicated `---` regexes onto the shared accessor in-slice, or leave duplicated and file a polish item? (Recommend fold — it's small and the agreement test guards it.)

---

## 10. Per-slice quick reference

| Slice | One-line goal | Key new file(s) | Reader? | Session(s) |
|---|---|---|---|---|
| 6d-1 | `#\|` cell-option **keys** (curated) | `findCellOptionLines` (model), `yaml-context.ts`, `providers/yaml.ts` | No | 1 |
| 6d-2 | `#\|` cell-option **values** (curated enums) | extend `yaml-context.ts`, provider | No | 1 |
| 6d-3 | 🐉 **schema reader** (enrich; runtime-read + fallback) | `core/yaml-schema.ts` parser, `quartoSharePath()`, adapter | **Yes** | 1 |
| 6d-4 | Front-matter **top-level keys** | `findFrontMatter`/`inFrontMatter` (model), extend context | Yes | 1 |
| 6d-5 | Front-matter **top-level values** | extend context + `valuesFor` | Yes | 1 |
| 6d-6+ | 🐉 nested / format-conditional | recursive DSL walk + `format-aliases` | Yes | >1 (or defer) |

**Recommended stopping points:** after **6d-3** (the complete `#|` cell-option milestone — the headline feature) or after **6d-5** (front matter too). 6d-6+ is optional and may be descoped to v2.x.

---

*End of Phase 6d plan. Implementation is separate sessions, one slice each, strict TDD. The first executor session should start with Slice 6d-1.*
