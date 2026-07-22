# Plan — validate the scalar `format:` NAME (`.qmd` + `_quarto.yml`)

**Session:** 144 (PLANNING). **Deliverable:** this plan. **Implementation:** a LATER session (FM #18/#19).
**Workstream:** `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md` + `SESSION_RUNNER.md` §Planning Sessions, under the project-wide strict-TDD gate.
**Family:** the value-validation family's next item — the deliberate false-negative every prior slice left open (S135 depth-1, S137 depth-2, S141 `execute:`, S143 per-format option values). Operator picked "Plan: format NAME validation" via `AskUserQuestion` at Phase 0 (Active empty).

**Grounding:** `quarto render` 1.7.33 firsthand (80+ renders, `scratchpad/fmtname/GROUNDING.md`), quarto.js source (`makeFrontMatterFormatSchema` — the authoritative front-matter schema validator), the installed schema resource (`pandoc/formats.yml`), two read-only inventory agents + a **4-lens `quarto render`-verified §9 adversarial review** whose findings are folded (Provenance). Load-bearing anchors re-read firsthand (FM #11).

> **This plan was revised after its §9 review.** The first draft grounded the predicate on the wrong quarto function (`parseFormatString`, the *render-dispatch* algorithm) and shipped 2 cardinal-sin FP classes. The review refuted it with firsthand `quarto render` evidence; the corrected predicate below mirrors the actual front-matter **schema** validator and passes the same battery with **0 divergences**. The lesson is recorded as a family learning.

---

## §0 — Decision at a glance

Flag an **unknown / typo'd top-level output-format NAME** (`format: banana`, `format: reveal`, `format: word`) with an Error squiggle matching what `quarto render` 1.7.33's **front-matter schema layer** itself rejects ("Validation of YAML front matter failed") — **without** false-positiving on extension formats, pandoc modifiers, hidden legacy variants, extension+modifier combinations, or custom `.lua` writers.

**This slice's ONE surface × form: `.qmd` SCALAR `format: <name>` (Combo 1).** It is the only one of the four surface×form combinations whose token the reader *already emits* today, so it needs **feature-only** wiring on top of a small shared foundation. The other three combos (`_quarto.yml` scalar; the container-key form `format:\n  <name>:` on both surfaces) are **deferred** to later slices (§4.3).

**Headline — honest, and the OPPOSITE of the S143 format-value slice:** this slice **adds a new matcher**. The shipped value matcher `isWrongValue` requires `field.valuesClosed === true` and does **flat, exact-enum membership** (`yaml-value-check.ts:63-65`, verified) — it *cannot* express what quarto accepts, because format-name acceptance is a **regex union**, not an enumerable set: quarto's front-matter schema validates a scalar format against `^(.+-)?<name>([-+].+)?$` for *each* built-in name (an optional `<prefix>-` extension, the built-in name, an optional `[-+]<modifier>`), plus `^.+\.lua$` (a custom Lua writer). So the previous "zero new matcher code" reuse does **not** apply — the deliverable is a small **bespoke, pure `isKnownFormatName` predicate that mirrors that regex union** + a **null-safe reader accessor** for the complete built-in set + a **bespoke message**.

**Why this was deferred until now (S141/142/143 gotcha #3):** the format-name enum is injected as the top-level `format` field's `.values` *after* `annotateClosedness`, so `valuesClosed` stays unset and the matcher skips it (`yaml-schema.ts:565-569`). Naively flipping `valuesClosed: true` would false-positive on every extension format, modifier, hidden variant, and `.lua` writer — which is exactly why a bespoke regex-mirror predicate + an online-only gate are required.

**Four grounded FP dragons (all handled by the corrected predicate + gate; all in the FP battery):**
1. **Extension formats** — `format: acme-report-html` is *schema-accepted* (routed to extension resolution; a missing extension fails LATER with a non-schema "Unable to read the extension" error, out of the mimicked layer). Handled by the `(.+-)?` prefix in the regex — **no `_extensions/` filesystem scan needed**.
2. **Extension + modifier / built-in embedded mid-name** — `format: foo-html-smart`, `nature-pdf-draft` are *schema-accepted* (the built-in may sit anywhere it is bounded by `-`/`+`). Handled by the regex accepting an optional prefix AND an optional modifier suffix together. *(This is the class the first-draft two-path predicate missed — §9 review.)*
3. **Custom `.lua` writers** — `format: my-writer.lua` is *schema-accepted* (`^.+\.lua$`). Handled by a `.lua` branch in the predicate. *(Also missed by the first draft — §9 review.)*
4. **Offline** — the curated fallback carries only 14 of 71 real format names; validating against it would FP on `jats`/`docbook`/`man`/… Handled by an **online-only gate** (`formatNamesForValidation()` returns `null` for the curated index — never flag).

---

## §1 — Context

### 1.1 Problem
A wrong top-level output format is one of the most common Quarto authoring mistakes (`format: word`, `format: reveal`, `format: htmls`, `format: powerpoint`). `quarto render` catches every one at the front-matter schema layer. This extension — which already mimics that layer for option values — stays silent on the format NAME itself. This slice closes the `.qmd` scalar case.

### 1.2 Constraints (standing, binding)
- **Strict TDD** (project-wide gate): one RED before each GREEN, vertical slice, ≤5 files/commit, checkpoint-commit per layer.
- **Cardinal sin = a false positive** on a document `quarto render` accepts (exit 0, *or* whose only failure is a NON-schema error). Every prior slice's safety story is "only ever fire where quarto's *schema* layer errors." The format-name predicate must match `makeFrontMatterFormatSchema`'s acceptance exactly.
- **Mimic the SCHEMA layer only** — the "Validation of YAML front matter failed" errors from `makeFrontMatterFormatSchema`, NOT the later render-dispatch / extension-load / missing-file errors ("Unable to read the extension 'X'", "cannot open X.lua"). `foo-html` / `foo.lua` / `nature-pdf-draft` are schema-ACCEPTED and must NOT be flagged. **NB the render-dispatch `parseFormatString` is a DIFFERENT, differently-permissive layer** (it accepts `foo-bar`, which the schema rejects) — do not model on it.
- **Completion-only data must never break editing** (Learning #16): the new reader accessor and predicate are pure and never throw.
- **No publish near-term** (operator, S103).

### 1.3 Current state — what to build ON (do NOT rebuild)
- `.qmd` value feature: `src/features/yaml-value-diagnostics.ts` — three sources (cell / top-level / nested) → one `quarto-value` collection. The top-level `format` scalar **already flows** through the `fmValueLines` loop (`:120-139`) and is skipped only because the format field has no `valuesClosed` (`:110-118`, an in-code documented FN).
- Enumerator: `src/core/yaml-frontmatter-values.ts` `findFrontMatterValueLines` — **already emits** `{key:"format", rawToken:"banana", valueRange}` for `format: banana` (`:95-100`, verified). A bare block-opener `format:` (no scalar) is correctly skipped (`:92`).
- Reader: `src/core/yaml-schema.ts` — `collectFormatNames(data)` (`:1627`) derives the completion format list from `pandoc/formats.yml` + synthesized (`FORMAT_SYNTHESIZED`, `:1605`) MINUS hidden variants; `parseSchemaIndex` (`:1513`) → `indexOf` (`:549`); the curated fallback singleton `CURATED_SCHEMA_INDEX` (`:723`).
- Matcher/message: `src/core/yaml-value-check.ts` — `isWrongValue` (`:46`), `valueMessage` (`:184`). **Not reused for the name** (see §0 headline); a new sibling module is added.

---

## §2 — Ground truth (empirical: `quarto render` 1.7.33 + quarto.js `makeFrontMatterFormatSchema` + installed schema)

### 2.1 The rule quarto's FRONT-MATTER SCHEMA layer applies (what we mimic)
The layer that emits `Field "format" has value <N>, which must instead be 'ansi'` / "Validation of YAML front matter failed" is **`makeFrontMatterFormatSchema` (quarto.js 1.7.33:16697-16748)** — an `anyOf` union. It ACCEPTS a scalar format name `N` **iff**:
- **`N` matches `^.+\.lua$`** (a custom Lua pandoc writer, `regexSchema("^.+\.lua$")`, `:16724/16730`); **OR**
- **for SOME built-in format name `b`, `N` matches `^(.+-)?` + `b` + `([-+].+)?$`** (`:16713`) — an optional `<prefix>-` (extension) segment, the built-in `b`, and an optional `[-+]<modifier>` suffix (both optional, and *combinable*).

Else → **SCHEMA-REJECT**: `... value <N>, which must instead be 'ansi'` (`ansi` = enum[0], the representative — NOT a helpful suggestion; `:11774`). Exit 1.

**This is DISTINCT from the render-dispatch algorithm** `parseFormatString`/`breakFormatString` (quarto.js:41317/41365, reached only at render dispatch via `isValidFormat` `:81799`, AFTER schema validation). The two disagree: `parseFormatString` accepts `foo-bar` (non-strict last-element split), while the schema regex REJECTS `foo-bar` (grounded: exit-1 "must instead be 'ansi'"). **We mimic the schema layer** — it is what the user sees as the validation error, and every prior slice mimics `readAndValidateYamlFromFile`.

### 2.2 The built-in membership set `B` — and the hidden-variant dragon
`B` = **raw `pandoc/formats.yml` (all 67, unfiltered)** + quarto synthesized (`md`, `hugo`, `dashboard`, `email`) = **71 names**. This matches the schema layer's own descriptor set exactly (`pandocFormatsResource().concat("md","hugo","dashboard","email")`, quarto.js:16712). The 67 (from the installed resource):
`ansi asciidoc asciidoc_legacy asciidoctor beamer biblatex bibtex chunkedhtml commonmark commonmark_x context csljson djot docbook docbook4 docbook5 docx dokuwiki dzslides epub epub2 epub3 fb2 gfm haddock html html4 html5 icml ipynb jats jats_archiving jats_articleauthoring jats_publishing jira json latex man markdown markdown_github markdown_mmd markdown_phpextra markdown_strict markua mediawiki ms muse native odt opendocument opml org pdf plain pptx revealjs rst rtf s5 slideous slidy tei texinfo textile typst xwiki zimwiki`

**DRAGON — `B` ≠ `collectFormatNames`.** `collectFormatNames` (the *completion* accessor) STRIPS hidden legacy variants (`html4/html5`, `epub2/epub3`, `docbook4/docbook5` — `isHiddenFormat`/`FORMAT_HIDE_PREFIXES`, `:1612-1617`). But quarto *accepts all of them* (verified: `format: html5/html4/epub3/epub2/docbook5` → exit 0). A validator keyed on `collectFormatNames` would **false-positive on `format: html5`**. So the validation accessor must return the **raw, unstripped** set.

### 2.3 Grounded case matrix (all firsthand — `scratchpad/fmtname/GROUNDING.md` for the full table; every row re-verified against the corrected predicate → 0 divergences)
| input (`.qmd` scalar) | quarto SCHEMA layer | our target |
|---|---|---|
| `format: html` / `pdf` / `revealjs` / `dashboard` / `md` | ACCEPT (built-in) | no flag |
| `format: html5` / `html4` / `epub3` / `docbook5` | ACCEPT (hidden-but-valid) | **no flag** (dragon 2.2) |
| `format: markdown+emoji` / `html-smart` / `gfm-yaml_metadata_block` / `html+something` | ACCEPT (base + modifier) | **no flag** |
| `format: foo-html` (base suffix, NO ext) | schema-ACCEPT (ext-route; later non-schema ext-load error) | **no flag** (dragon 1) |
| `format: acme-report-html` (ext installed) | ACCEPT exit 0 | **no flag** |
| `format: foo-html-smart` / `nature-pdf-draft` / `acme-revealjs-clean` (ext + modifier / mid-embedded built-in) | schema-ACCEPT (non-schema ext-load error) | **no flag** (dragon 2 — §9-review class B) |
| `format: my-writer.lua` / `foo.lua` (custom Lua writer) | schema-ACCEPT (non-schema missing-file / ext error) | **no flag** (dragon 3 — §9-review class A) |
| `format: "html"` / `'revealjs'` (quoted) | ACCEPT | **no flag** (unquote first) |
| `format: banana` / `foo` / `reveal` / `word` / `htmls` / `reveal.js` | SCHEMA-REJECT ("must be 'ansi'") | **FLAG** |
| `format: foo-bar` (`bar` not a base) | SCHEMA-REJECT (render-dispatch would accept — we mimic schema) | **FLAG** |
| `format: plainfmt-banana` / `solo` | SCHEMA-REJECT | **FLAG** |
| `format: html-` / `html+` (bare trailing delimiter) | SCHEMA-REJECT (`([-+].+)?` needs ≥1 char after the delimiter) | **FLAG** |
| `format: [html, pdf]` (flow sequence) | **SCHEMA-REJECT** (no array branch in the schema) | **no flag** (skip flow — a deliberate FP-safe FALSE-NEGATIVE, §7) |

**Note on the flow-list:** quarto's valid *multi-format* syntax is the MAPPING form (`format:\n  html:\n  pdf:`), NOT a flow sequence — `makeFrontMatterFormatSchema` has only scalar-string / `.lua` / object branches, no array branch. So `format: [html, pdf]` is schema-INVALID. We skip the flow token anyway (§3.1 hygiene) — this is a deliberate FP-safe false-negative (we stay silent on a doc quarto errors), NOT protection of a valid doc. (First draft mis-stated this as "both valid" — §9 review, corrected.)

### 2.4 The four surface×form combos (all deliberate FN today — verified firsthand + by inventory)
| Combo | Enumerator emits the NAME token today? | This slice? |
|---|---|---|
| **1. `.qmd` scalar** `format: banana` | **YES** — `yaml-frontmatter-values.ts:95-100` | **YES (this slice)** |
| 2. `.qmd` container key `format:\n  banana:` | NO — nested enumerator emits leaf values only (`:135-137`); no key enumerator on `.qmd` | deferred (§4.3) |
| 3. `_quarto.yml` scalar `format: banana` | NO — col-0 scalars are structurally never emitted (`project-yaml.ts:221-228`) | deferred (§4.3) |
| 4. `_quarto.yml` container key `format:\n  banana:` | NO — block-opener name never pushed (`project-yaml.ts:270-278`); a depth-1 scalar emits `path=[]` → resolver skips (`yaml-project-value-diagnostics.ts:124-129`) | deferred (§4.3) |

---

## §3 — Decision (architecture)

### 3.1 Three new, pure, testable pieces + one feature wiring

**(A) A bespoke predicate + message — new module `src/core/format-name-check.ts`** (sibling of `yaml-value-check.ts`; pure, never throws). It mirrors `makeFrontMatterFormatSchema`'s regex union directly:

```ts
/** Escape a built-in name for use as a regex literal. A no-op for today's names
 *  (all `[a-z0-9_]`), but guards against a future name carrying a regex metachar. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether `name` is a format Quarto's front-matter SCHEMA layer accepts — a faithful
 *  mirror of `makeFrontMatterFormatSchema`'s anyOf union: a custom `.lua` writer, OR a
 *  built-in `b` optionally wrapped by an `<ext>-` prefix and/or a `[-+]<modifier>` suffix.
 *  `builtIn` is the raw built-in set from `SchemaIndex.formatNamesForValidation()`. */
export function isKnownFormatName(name: string, builtIn: ReadonlySet<string>): boolean {
  if (/^.+\.lua$/.test(name)) return true;                         // custom Lua writer
  for (const b of builtIn) {
    if (new RegExp(`^(.+-)?${escapeRegExp(b)}([-+].+)?$`).test(name)) return true;
  }
  return false;
}

/** The diagnostic message for an unrecognized output format. */
export function formatNameMessage(name: string): string {
  return `Unknown output format ${name}.`;   // NOT quarto's unhelpful "must instead be 'ansi'"
}
```
Verified against every §2.3 row + a 51-case §9-review battery → **0 divergences** from firsthand `quarto render` schema verdicts. (Optional micro-opt if profiling ever demands it — precompile ONE alternation `^(.+-)?(b1|b2|…)([-+].+)?$` from the escaped set rather than 71 per-call `RegExp`s; the loop runs once per `format:` line per debounced pass, so this is not needed for v1.)

**(B) A null-safe reader accessor — new `SchemaIndex` method, `src/core/yaml-schema.ts`:**
```ts
/** The COMPLETE built-in output-format name set for VALIDATION — raw `pandoc/formats.yml`
 *  (unfiltered; INCLUDES the hidden legacy variants html4/html5/…) plus the synthesized
 *  formats — or `null` when the set is not known to be complete (the curated fallback).
 *  Callers MUST NOT flag anything for a `null` result (absence of proof ≠ proof of absence). */
formatNamesForValidation(): ReadonlySet<string> | null;
```
This **exactly mirrors `projectKeys(container): Set<string> | null`** (`:505-514`) — the established null-means-don't-flag precedent. Wiring: `parseSchemaIndex` computes the raw set (a sibling of `collectFormatNames` WITHOUT the hidden-strip, returning `null` if `pandoc/formats.yml` is absent) and threads it through `indexOf`; `CURATED_SCHEMA_INDEX` supplies `null`. **The offline gate and the raw-set need are folded into this one method** — no new online/offline flag, no `_extensions/` scan, and the completion-facing `collectFormatNames`/`frontMatterKeys(["format"])` are left byte-untouched (completion still hides the legacy variants).

**(C) Token hygiene in the feature (the FP guards).** In `yaml-value-diagnostics.ts`, inside the existing `fmValueLines` loop, special-case `fm.key === "format"`:
```ts
if (fm.key === "format") {
  const set = index.formatNamesForValidation();
  if (set === null) continue;                                     // offline — never flag (dragon 4)
  if (fm.rawToken.length === 0 || /^[[\]{}|>&*!]/.test(fm.rawToken)) continue; // flow/block/node-prop — same guard isWrongValue uses (skips the schema-invalid `[html, pdf]`)
  const name = unquote(fm.rawToken);                              // `"html"` → html
  if (isKnownFormatName(name, set)) continue;
  // → push an Error diagnostic over fm.valueRange with formatNameMessage(fm.rawToken)
  continue;                                                       // do NOT fall through to isWrongValue
}
```
All other keys keep the existing `isWrongValue` path unchanged. (`unquote` is the same helper `isWrongValue` uses internally — extract/share it or reuse via import.)

### 3.2 Data flow (Combo 1)
`.qmd` edit → `findFrontMatterValueLines(text)` emits `{key:"format", rawToken}` (unchanged) → the feature's `format` branch → `index.formatNamesForValidation()` (null-gate) → hygiene skips → `isKnownFormatName(unquote(rawToken), set)` → Error diagnostic in the `quarto-value` collection. No new enumerator, no new collection, no new event wiring.

---

## §4 — Scope: the vertical slice (ONE implementation session)

### 4.1 The layer set — gate-(a) contract (build in order, checkpoint-commit each, ≤5 files/commit)

- **L1 [INERT] — the pure predicate + message.** Add `src/core/format-name-check.ts` (`isKnownFormatName`, `formatNameMessage`, `escapeRegExp`). Unit tests `test/unit/format-name-check.test.ts`: RED→GREEN one behavior at a time against a fixed test `builtIn` set — MUST-FLAG (`banana`/`foo`/`reveal`/`foo-bar`/`plainfmt-banana`/`html-`/`html+`) → false; MUST-KNOW built-ins (`html`/`pdf`/`revealjs`/`md`/`dashboard`), hidden (`html5`/`epub3`/`docbook5`), modifiers (`markdown+emoji`/`html-smart`), extension (`foo-html`/`acme-report-html`), **extension+modifier (`foo-html-smart`/`nature-pdf-draft`)**, **`.lua` (`my-writer.lua`/`foo.lua`)** → true. **Dormant** — nothing imports it yet. *DONE = predicate unit-proven against the full §2.3 matrix.* Files: 2.
- **L2 [INERT] — the reader accessor.** Add `formatNamesForValidation()` to the `SchemaIndex` interface + both implementations (`indexOf` returns the raw set; `CURATED_SCHEMA_INDEX` returns `null`) + the raw-set collector in `parseSchemaIndex`. Unit tests: a parsed index over a fixture resource returns a set that **includes `html5`**; the curated index returns `null`. **Dormant.** *DONE = accessor returns the complete raw set online / `null` offline, unit-proven.* Files: ≤3.
- **L3 [GO-LIVE] — wire Combo 1.** Add the `fm.key === "format"` branch to `yaml-value-diagnostics.ts` (§3.1 C). RED→GREEN driver. **TWO FN-lock tests FLIP** (both open `front-matter.qmd:7` = `format: htlm` — §5): `yaml-value-diagnostics.test.ts:147-177` (hard `assert.strictEqual(diags.length, 5)` + title "…NOTHING for … format") AND `:179-190` (`!lines.includes(6)`). Per Learning #156, **grep the corpus for the FN-lock BEFORE go-live**; reconcile by *intent-preserving swap* — bump the exact count (5→6) and retitle `:147-177`, AND change `:179-190` to assert `htlm` IS flagged; keep/relocate the FP-safety examples (a valid format + `foo-html`/`.lua`/quoted cases) so the lock still guards the FP surface. Do NOT weaken assertions. *DONE = a wrong scalar `format:` in a real host squiggles; valid/extension/modifier/`.lua`/list/quoted/hidden cases stay silent.* Files: ≤4.
- **L4 — fixtures + integration + MANDATORY §9 review.** Extend the front-matter fixture / add `test/fixtures/format-name/*.qmd`: INVALID (`banana`, `reveal`, `foo-bar`, `html-`) + a VALID FP battery (`html5`, `foo-html`, `markdown+emoji`, `html-smart`, **`foo-html-smart`**, **`my-writer.lua`**, `[html, pdf]`, `"revealjs"`, `dashboard`). Integration in a real Extension Development Host. Then the §9 adversarial-review `Workflow` (see §9) — **fuzz the predicate against `makeFrontMatterFormatSchema`'s regexes, not `parseFormatString`.** *DONE = integration green in a real host; §9 all lenses PLAN-SOUND, 0 cardinal-sin FPs.* Files: ≤3.

### 4.2 This is a vertical slice, NOT horizontal (pre-empting an FM #25 misread)
L1/L2 are dormant *foundations* of the SAME capability (a wrong `.qmd` scalar format name squiggles), not a separate "all-predicates-then-all-wiring" horizontal layer. Each layer is checkpoint-committed; the slice is end-to-end at L3. Dormant-first ordering is forced by the type system exactly as in S141/S143.

### 4.3 Deferred to later slices (filed to `BACKLOG.md`, NOT built here)
Each reuses this slice's `isKnownFormatName` + `formatNamesForValidation()`:
- **Combo 3 — `_quarto.yml` scalar `format: banana`.** Needs a NEW col-0 scalar emission in `findProjectConfigValueLines` (today col-0 lines only set container scope, `:221-228`). **Entangled** with the separate "general document-key value" backlog item (the same top-level-scalar enumeration gap). Do it WITH or AFTER that work, not bundled here (FM #26).
- **Combos 2 & 4 — container-key form** `format:\n  banana:` on both surfaces. Needs a NEW container-KEY emission (`.qmd` has no key enumerator at all; `_quarto.yml` never pushes the block-opener name). **Diagnostic-placement question:** quarto reports the unknown container on its first *child* line ("no possible value"); we would naturally squiggle the *name* token — a reasonable, arguably better UX, but not byte-identical to quarto. Settle in that slice's plan.
- **Multi-format list** (`format: [html, banana]`) — schema-invalid in the flow form anyway (§2.3); v1 skips the whole flow token. A later slice could validate the MAPPING multi-format form's names (that IS Combo 2/4's territory).
- **Nearest-match hint** (`Unknown output format 'reveal'. Did you mean 'revealjs'?`) — a message enhancement (Levenshtein); v1 ships the plain message.

---

## §5 — Evidence-based inventory (affected symbols, file:line — grepped/read S144)

**Changed by this slice:**
- `src/core/format-name-check.ts` — **NEW** (`isKnownFormatName`, `formatNameMessage`, `escapeRegExp`).
- `src/core/yaml-schema.ts` — ADD `formatNamesForValidation()` to `interface SchemaIndex` (near `:503`/`:514`); implement in `indexOf` (`:576-...`) and thread a raw-set param from `parseSchemaIndex` (`:1527-1535`); ADD a raw-set collector (sibling of `collectFormatNames` `:1627`, WITHOUT `isHiddenFormat`); `CURATED_SCHEMA_INDEX` (`:723`) passes `null`.
- `src/features/yaml-value-diagnostics.ts` — ADD the `fm.key === "format"` branch inside the `fmValueLines` loop (`:120-139`); update the in-code FN note (`:110-118`).
- Tests: `test/unit/format-name-check.test.ts` (NEW), a schema unit for the accessor, and **BOTH** FN-lock tests in `test/integration/suite/yaml-value-diagnostics.test.ts` — `:147-177` (hard `strictEqual(diags.length, 5)` + title "…NOTHING for open/valid/format/free-string") AND `:179-190` (`!lines.includes(6)`) — both open `test/fixtures/yaml-value-diagnostics/front-matter.qmd` (`:7` = `format: htlm`). New `format-name` fixtures.

**Reused UNCHANGED (assert, do NOT touch):**
- `src/core/yaml-frontmatter-values.ts` `findFrontMatterValueLines` (`:50`, push `:95-100`) — already emits the `format` scalar; NO enumerator change.
- `src/core/yaml-value-check.ts` `isWrongValue` (`:46`), `valueMessage` (`:184`) — NOT used for the name; the `format` branch returns before them. (Only `unquote` is shared — extract/import it.)
- `src/core/yaml-schema.ts` `collectFormatNames` (`:1627`), the `format` field `values` injection (`:565-569`), `frontMatterKeys` (`:583`) — completion path stays byte-identical (still hides legacy variants).
- `src/features/yaml-diagnostics.ts` (unknown-KEY `_quarto.yml` feature) + `src/features/yaml-project-value-diagnostics.ts` — untouched (this slice is `.qmd`-only).

---

## §6 — Alternatives considered (honest)

| Alternative | Why rejected |
|---|---|
| **Flip `valuesClosed: true` on the injected `format` field, reuse `isWrongValue`** | Flat exact-enum matching would FP on EVERY extension format (`foo-html`), modifier (`markdown+emoji`), extension+modifier (`foo-html-smart`), hidden variant (`html5`), and `.lua` writer — and the enum would be the completion-stripped set. Structurally cannot express the regex union. This is precisely why the FN exists. |
| **Model on `parseFormatString`/`breakFormatString` (the first draft)** | REJECTED by the §9 review with firsthand evidence: it is the render-DISPATCH layer, not the schema layer, and the two disagree (`foo-bar`, `foo-html-smart`, `.lua`). Modeling on it shipped 2 cardinal-sin FP classes. The corrected predicate mirrors `makeFrontMatterFormatSchema`. |
| **Scan `_extensions/` for contributed format names** | Unnecessary: the schema layer accepts ANY `<prefix>-<base>` (and `<prefix>-<base>-<mod>`) whether or not the extension is installed. The regex covers it with zero filesystem I/O and no workspace-root coupling. |
| **Union the completion set with a hardcoded hidden-6** | Fragile (a future `html6` would be stripped by completion and FP'd by validation). The raw-set accessor is robust and barely larger. |
| **Validate offline against the curated 14** | FPs on ~57 real formats absent from the curated subset. Offline MUST be a no-op (the `null` gate). |
| **Ship all 4 combos in one session** | Combos 2/3/4 each need a new enumerator emission; Combo 3 is entangled with a separate backlog item. Bundling is FM #26. One clean combo per slice. |
| **Byte-match quarto's message** ("must instead be 'ansi'") | Actively misleading (`ansi` is enum[0], not a suggestion). A clear bespoke message serves the user better. |

---

## §7 — Failure-mode analysis (the safety story)

The predicate fires an Error ONLY when ALL hold: key is `format`, the reader is online (`set !== null`), the token is not a flow/block/node-property, and `isKnownFormatName(unquote(token), set)` is false. Each guard kills a cardinal-sin FP class (all §9-review-verified, 0 divergences):
- **Extension formats / extension+modifier / mid-embedded built-in** — the `^(.+-)?b([-+].+)?$` regex (grounded: `foo-html`, `foo-html-smart`, `nature-pdf-draft`).
- **Modifiers / hidden variants** — the same regex + the raw (unfiltered) set (`markdown+emoji`, `html5`).
- **Custom `.lua` writers** — the `^.+\.lua$` branch (`my-writer.lua`).
- **Flow token** — the `/^[[\]{}|>&*!]/` skip. NB `format: [html, pdf]` is itself schema-INVALID (§2.3); the skip is therefore a deliberate FP-safe **false-negative** (we stay silent on a doc quarto rejects), not protection of a valid doc.
- **Quoted** — `unquote` before the predicate.
- **Offline** — the `null` gate.
- **Bare block-opener `format:`** (container form) — not emitted by `findFrontMatterValueLines` (`:92`); the container-name form is deferred (§4.3) and staying a FN is correct until its own slice.

Blast radius: `.qmd` only, one collection, one new pure module + one interface method + one localized feature branch. Offline / reader failure = silent FN. Never throws.

---

## §8 — Impact analysis
- **Changes:** wrong `.qmd` scalar `format:` names get an Error squiggle. Product: catches the single most common format typo.
- **Does NOT change:** completion (still hides legacy variants), `_quarto.yml` diagnostics, cell/option value validation, the unknown-KEY feature, any other key's value path.
- **Might break (expected go-live flips, reconcile in L3):** BOTH FN-lock tests in `yaml-value-diagnostics.test.ts` — `:147-177` (hard `strictEqual(diags.length, 5)` → becomes 6; retitle) AND `:179-190` (`!includes(6)` → assert flagged). Grep `htlm`/`format:` in the test corpus first (Learning #156).
- **Heads-up (no test breaks, no action needed):** `test/fixtures/render-error.qmd:2` (`format: nonexistent-format-xyz`) gains a *correct* format squiggle post-slice — the value feature is host-wide. Only a future global "zero diagnostics" smoke test over that fixture would notice.

---

## §9 — Verification plan (executor)
- Per layer: `npm run check-types`; unit (`npm test`) with the RED shown before each GREEN; the exhaustive grep inventory (§5) at each boundary.
- **A compiled feature-sim over the EXACT fixtures** proving INVALID→N flags at exact spans / VALID→0 flags, headlessly, BEFORE the slow integration run (Learning #156).
- Integration in a real Extension Development Host (the count grows from 401).
- **MANDATORY §9 adversarial-review `Workflow`** (family precedent, ultracode) — ≥4 `quarto render`-verified lenses: **fp-cardinal** (an independent accepted-battery: extension formats, extension+modifier, `.lua` writers, hidden variants, modifiers, lists, quoted, synthesized — each rendered, asserting *schema*-accept ⇒ we-don't-flag; classify accept as "no 'Validation of YAML front matter failed' marker"), **predicate-parity** (the predicate vs **`makeFrontMatterFormatSchema`'s regexes** on a fuzzed name set — NOT `parseFormatString`), **online/offline-gate** (curated index ⇒ `null` ⇒ silent), **doc-drift**. Apply adversarial refutation to the agents' own output. All lenses PLAN-SOUND + 0 cardinal-sin FPs before close-out. *(This plan's own §9 review already caught the render-dispatch-vs-schema error — run it against the schema regexes from the start.)*

---

## §10 — Residual open questions (low-risk; settle in the first RED slice)
1. **Message wording** — `Unknown output format 'banana'.` vs `'banana' is not a recognized Quarto output format.` Pick one; keep it bespoke. Nearest-match hint deferred (§4.3).
2. **`unquote` sharing** — extract the helper from `yaml-value-check.ts` into a shared spot, or import it. Prefer a tiny shared export over duplication.
3. **Predicate perf** — the 71-regex `.some()` loop runs once per `format:` line per debounced pass; fine. Precompile a single alternation only if a profile ever shows it (it won't).
4. **Where the `format` branch sits** — inside the `fmValueLines` loop (localized special-case) vs a small dedicated pass. Recommend in-loop. Decide at L3.

---

## §11 — Here be dragons (executor quick-reference, Learning #3)
1. 🔑 **The matcher is BESPOKE and mirrors the SCHEMA regex — NOT `isWrongValue`, NOT `parseFormatString`.** Acceptance = `^.+\.lua$` OR `∃b∈B: ^(.+-)?b([-+].+)?$`. Modeling on the render-dispatch `parseFormatString` (the first-draft error) ships cardinal-sin FPs on `.lua` writers and `<ext>-<builtin>-<mod>` names (§9 review, firsthand-grounded). (HIGH — the central design fact.)
2. 🔑 **The validation set `B` is the RAW `pandoc/formats.yml` (unfiltered, 67) + synthesized (4) = 71 — NOT `collectFormatNames`.** `collectFormatNames` strips `html4/html5/epub2/epub3/docbook4/docbook5`, which quarto ACCEPTS. Use `formatNamesForValidation()`, which must NOT hidden-strip. (HIGH.)
3. 🔑 **Offline = `null` = never flag.** The curated fallback has 14 of 71 names; `formatNamesForValidation()` returns `null` for `CURATED_SCHEMA_INDEX`. Gate on `set === null → continue`. (Cardinal-sin guard.)
4. 🔑 **Skip the flow token** (`/^[[\]{}|>&*!]/` + empty), BEFORE the predicate. `format: [html, pdf]` is schema-INVALID — the skip is an FP-safe FN, not validation of a valid doc.
5. 🔑 **`unquote` the token first** — `format: "html"` must not flag.
6. 🔑 **`foo-html` / `foo-html-smart` / `my-writer.lua` are schema-ACCEPTED** — we mimic the SCHEMA layer, not the later "Unable to read the extension" / "cannot open X.lua" errors. The regex `(.+-)?…([-+].+)?` + the `.lua` branch handle them; VALID-fixture-lock each.
7. 🔑 **TWO FN-locks FLIP at go-live** (both open `front-matter.qmd:7` = `format: htlm`): `yaml-value-diagnostics.test.ts:147-177` (hard `strictEqual(diags.length, 5)` → 6; retitle) AND `:179-190` (`!includes(6)` → assert flagged). Grep the corpus BEFORE L3; reconcile by intent-preserving swap, never by weakening (Learning #156).
8. 🔑 **Dormant-first ORDER (L1/L2 before L3).** The predicate + accessor must exist before the feature branch typechecks. Never wire L3 first.
9. 🔑 **This slice is `.qmd` SCALAR only (Combo 1).** Do NOT reach into `_quarto.yml` or the container-key form — each needs a new enumerator emission and is deferred (§4.3). Bundling is FM #26.
10. 🔑 `BACKLOG:NNN` is a LINE NUMBER.

---

## Provenance — how this plan was grounded (Session 144)
- **Firsthand `quarto render` 1.7.33** (`scratchpad/fmtname/`: `battery.sh`, `battery2.sh`, `battery3.sh`, typo/list/modifier/`.lua`/mid-embedded probes → `GROUNDING.md`): the scalar/container/list forms on both surfaces, the extension-format boundary (installed + uninstalled), the base-format enumeration, pandoc modifiers, extension+modifier combinations, custom `.lua` writers, hidden variants, quoted, common typos.
- **quarto.js 1.7.33 source** — **`makeFrontMatterFormatSchema` (:16697-16748)** = the authoritative front-matter **schema** acceptance algorithm (per-name regex `^(.+-)?name([-+].+)?$` + `^.+\.lua$`); the installed `yaml-intelligence-resources.json` `pandoc/formats.yml` = the exact 67-name enum; the synthesized set (`:16712`) = `+md,hugo,dashboard,email`. **NB `parseFormatString`/`breakFormatString` (:41317/41365) is the render-DISPATCH layer — differently permissive; NOT the schema validator** (the first-draft grounding error, caught by the §9 review).
- **Two read-only inventory agents** mapped the four code paths + the online/offline distinction + the matcher preconditions; every load-bearing file:line re-read firsthand (FM #11).
- **MANDATORY §9 adversarial plan-review** (`Workflow` `wf_fc737cbf-672`, 4 quarto-verified lenses) — REFUTED the first-draft predicate (2 cardinal-sin FP classes: `.lua` + `<ext>-<builtin>-<mod>`; the wrong-quarto-function root cause; a factual error in the flow-list dragon; an undercounted FN-lock inventory). Every finding re-verified firsthand and folded above; the corrected predicate re-verified → 0 divergences over the 32-case §2.3 matrix + the 51-case review battery. (Recorded as a family learning: ground a mimicked validator on the SCHEMA layer, not the render-dispatch layer.)
