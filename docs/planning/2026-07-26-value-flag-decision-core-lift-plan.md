# Lifting the value-flag decision into `src/core/`

**Plan — Session 167 (2026-07-26).** Architecture/refactor plan for extracting the pure
"what would we squiggle?" decision out of `src/features/yaml-value-diagnostics.ts` into a
new `src/core/` module, so that the feature and the exit-code oracle
(`test/oracle/flags.ts`) call **one** implementation instead of two.

**Status: PLAN ONLY.** No code was written this session. Implementation is a separate
session (SESSION_RUNNER FM #18). Workstream: `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`.

**Origin:** filed by Session 166 while committing the oracle
(`BACKLOG.md` — *"The oracle MIRRORS the feature's flag decision instead of calling it,
because the decision lives behind `vscode`"*), ranked #1 in the S166 `HANDOFFS.md` receipt's
`next_steps`, and selected by the operator via `AskUserQuestion` at this session's Phase 0.

**This document was revised after an adversarial review panel** (§11). The panel found **29
grounded defects** in the first draft — including a false inventory claim produced by an
unsound grep, and a false safety justification that would have licensed the one edit in this
refactor that actually changes behaviour. Both are corrected below. **§11 records what was
wrong and why; read it before trusting any reasoning in §3 or §5.**

---

## 1. Context

### 1.1 The problem

`computeValueDiagnostics` (`src/features/yaml-value-diagnostics.ts:78-355`) takes a
`vscode.TextDocument` and the module imports `vscode`, so **no headless harness can call
it.** The oracle therefore re-walks the same steps over the same core modules in
`test/oracle/flags.ts:61-123`, keeping the step order and every `continue` reason verbatim
so the two loops can be diffed by eye.

**The drift is not hypothetical — it has already happened once, undetected.** S165's
scratchpad copy of this mirror omitted the S163 `validate-yaml` escape hatch *entirely*. No
corpus row used the flag, so nothing could have caught it; any document using quarto's
documented opt-out would have been scored "we flag" where the feature is silent. S166 closed
that instance and pinned every step (`test/unit/oracle-flags.test.ts`, 5 pins), but the
mirror itself remains — and it is the harness's own README's stated *"single biggest
weakness"* (`test/oracle/README.md:78-88`).

A mirror that drifts does not merely go quiet. It keeps producing **confident numbers about
a decision the product no longer makes** — and those numbers have been this feature family's
primary safety evidence for three consecutive sessions.

### 1.2 Constraints

| Constraint | Source | Consequence for this design |
|---|---|---|
| `src/core/` must never import `vscode` | CLAUDE.md §3.3 guardrail; verified — `grep -rn "from \"vscode\"" src/core/` returns **nothing** across all 42 modules under `src/core/` (37 top-level + `qmd/` + `embedded/`) | The new module takes `text`/`fileName`/`SchemaIndex`, never a `TextDocument` |
| Strict TDD, RED→GREEN, one test at a time | CLAUDE.md, project-wide operator directive | **Every layer that adds logic is test-first.** Layer 1 writes its first failing pin before the module exists (§4) |
| Refactoring requires plan-mode approval | `SAFEGUARDS.md` §Blast Radius Limits | This document; the operator's approval is the gate (a) contract |
| ≤5 files per commit | `SAFEGUARDS.md` §Blast Radius Limits (per-commit, not per-session) — a **hard rule, no exceptions** | Layer boundaries below are all ≤5 files, and the doc layer is split from close-out so the final commit does not breach it (§4 Layer 5) |
| The S124 snapshot invariant | `yaml-value-diagnostics.ts:70-76` — never re-read the live document after an `await` | `text` is captured **once** and travels inside `ValueSources`, so a text/sources desync is not representable (§2.1) |
| The generation guard | `debounced-diagnostics.ts:46-55` — `compute` must re-check `isCurrent()` after every `await` and return `null` | Stays in the feature. Core is synchronous and has no notion of supersession |
| Quarto's behaviour is the spec, and only measurement establishes it | this family's standing doctrine (S163–S166) | **This refactor must change no measurement.** But see §6 — the oracle covers only ONE of the three moved surfaces, so it is not by itself sufficient evidence |

### 1.3 Current state

```
                        ┌─ src/extension.ts:83
                        ▼
   registerYamlValueDiagnosticsFeature  (features/yaml-value-diagnostics.ts:362)
                        │
                        ├─ createDebouncedDiagnosticsFeature  (features/debounced-diagnostics.ts:93)
                        │     └─ lifecycle: collection, 350 ms debounce, generation guard, close-cancel
                        ▼
              computeValueDiagnostics  (:78-355)   ◄── imports vscode; PRIVATE, never exported
                        │
      ┌─────────────────┼────────────────────────────────┐
      │ PURE                                             │ STAYS IN THE ADAPTER
      │  · 3 enumerators + empty fast path       :83-88  │  · document.getText()        :82
      │  · lines split                           :93     │  · document.isClosed         :90
      │  · validate-yaml gate                    :103-104│  · document.fileName         :121
      │  · documentEngineForScoping              :120-126│  · await source.getIndex()   :89
      │  · cell-option loop                      :127-202│  · isCurrent() re-check      :90
      │  · top-level front-matter loop + format  :218-305│  · 4 × Range+Diagnostic blocks,
      │  · nested front-matter loop              :321-338│    14 lines each  :203-216, :253-266,
      │                                                  │                   :306-319, :339-352
      └──────────────────────────────────────────────────┘
                        ▲
                        │ COPIED, by hand, cell-option loop only
                        │
              cellOptionFlags  (test/oracle/flags.ts:61)  ── called by ──▶ test/oracle/run.oracle.test.ts:112
                        ▲                                                  test/unit/oracle-flags.test.ts:61
                        └─ OracleCoreApi (:40-53): 12 core functions injected, so any build's src/ can be replayed
```

Two separate inventories, both verified, that the executor needs kept apart:

- **16 lines carry a `vscode.` prefix** — `:61,79,81,94,203,209,212,253,259,262,306,312,315,339,345,348`.
- **Three more lines touch the `vscode` API with NO `vscode.` prefix** — `document.getText()`
  at `:82`, `document.isClosed` at `:90`, `document.fileName` at `:121`. A grep for `vscode.`
  misses all three, and the first draft of this plan wrongly filed `:82` and `:121` under
  PURE. **They stay in the adapter**, which passes `text` and `fileName` across the boundary.

Of the body's 272 lines (`:82-353`), 57 are the four `Range`/`Diagnostic` blocks plus the
accumulator declaration, and 3 are the `TextDocument` reads above. The rest is pure. That
ratio is what makes this a mechanical move rather than a redesign — but "verbatim" has
exactly eight exceptions and §4 Layer 1 names them.

---

## 2. Decision

Create **`src/core/yaml-value-flags.ts`**, a pure module that answers *"which spans of this
document would this feature squiggle, and with what message?"*. The feature keeps the gate,
the lifecycle contract, and the `vscode.Diagnostic` construction — nothing else. The oracle
calls the same function the product calls, and `test/oracle/flags.ts` is **deleted**.

### 2.1 Interface contract

```ts
/** Which of the feature's three value surfaces produced a flag (reporting only). */
export type ValueSurface = "cell" | "front-matter" | "format-name" | "nested";

/** One span this feature would squiggle, with the message it would carry. */
export interface ValueFlag {
  readonly surface: ValueSurface;
  readonly line: number;      // 0-based, as vscode.Range wants
  readonly startCol: number;
  readonly endCol: number;
  readonly key: string;       // the resolved option / front-matter key
  readonly rawToken: string;  // the value token exactly as sliced
  readonly message: string;   // valueMessage(...) / formatNameMessage(...)
}

/**
 * One document snapshot and everything derived from it. The text travels WITH the
 * derived arrays so a caller cannot pass `sources` from one snapshot and `text` from
 * another — the S124 desync is unrepresentable rather than merely forbidden.
 */
export interface ValueSources {
  readonly text: string;                                  // the snapshot, captured once
  readonly lines: readonly string[];                      // text.split(/\r?\n/)   (feature :93)
  readonly cellLines: readonly CellOptionLine[];          // findCellOptionLines    (:83)
  readonly fmValueLines: readonly FrontMatterValueLine[]; // findFrontMatterValueLines (:84)
  readonly nestedLines: readonly NestedValueLine[];       // findNestedFrontMatterValueLines (:85)
}

/** Enumerate everything derivable from the snapshot. Cheap; needs no schema. */
export function collectValueSources(text: string): ValueSources;

/** True when no source produced a line — the feature's pre-await fast path (:86-88). */
export function hasNoValueLines(sources: ValueSources): boolean;

/**
 * The decision. Pure, synchronous, total.
 *
 * Returns flags GROUPED BY SOURCE, not as one flat array. Grouping is a safety
 * property, not a style choice — see §5 dragon 2.
 */
export function valueFlags(
  sources: ValueSources,
  fileName: string,
  index: SchemaIndex,
): { readonly cell: ValueFlag[]; readonly frontMatter: ValueFlag[]; readonly nested: ValueFlag[] };
```

(The three element types are the enumerators' existing return types — import them, do not
re-declare them.)

| Contract | Value |
|---|---|
| **Input** | A `ValueSources` (which carries its own text snapshot), the document's `fileName` (the `.Rmd` veto inside `documentEngineForScoping`), and a parsed `SchemaIndex` |
| **Output** | Three arrays. `frontMatter` holds top-level **and** format-name flags **interleaved in source order**, exactly as the single loop at `:234-320` emits them today. The feature's diagnostic order is `cell` ++ `frontMatter` ++ `nested` |
| **Errors** | None. Total function — every existing `continue`/`break` is a skip, not a throw. An offline `index.formatNamesForValidation() === null` yields no format-name flags (today's `:238` behaviour) |
| **Versioning** | Internal module; the only consumers are the feature and the oracle, both in-tree |

**Why `sources` is a parameter rather than computed inside `valueFlags`.** The feature's fast
path at `:86-88` returns before `await source.getIndex()` — its purpose is to skip the
**schema load** (a `quarto --paths` spawn plus a ~680 KB read/parse on first use), and it
runs on every keystroke's debounce. Splitting enumeration from decision preserves that with
no double enumeration. Bundling the text *into* `ValueSources` is what keeps that split from
reintroducing the desync hazard the S124 docstring warns about.

### 2.2 Target state

```
   registerYamlValueDiagnosticsFeature ──▶ createDebouncedDiagnosticsFeature   (unchanged)
                        ▼
              computeValueDiagnostics   ~40 lines: getText, collectValueSources, fast path,
                        │               await index, isClosed/isCurrent re-check,
                        │               concat the three groups, map ValueFlag → vscode.Diagnostic
                        ▼
   ┌──────────  src/core/yaml-value-flags.ts  ──────────┐
   │  collectValueSources · hasNoValueLines · valueFlags │  ◄── ONE implementation
   └─────────────────────────────────────────────────────┘
                        ▲
                        │ dynamic import of the BUILD UNDER TEST (test/oracle/load.ts)
              test/oracle/run.oracle.test.ts        test/unit/yaml-value-flags.test.ts
```

### 2.3 Why this shape — the deletion test

Applying `ARCHITECTURE_WORKSTREAM.md` §Refactor Heuristics to `computeValueDiagnostics`:
mentally delete it, and its work **concentrates at one new, smaller, more focused module
that does not exist** — the pure decision — leaving a thin adapter behind. That is the
heuristic's third case: *"the original module's name was wrong, but a deep abstraction
exists nearby — replace with the focused module."*

The resulting core module is **deep**: a three-function interface over ~280 lines of
measured, heavily-documented logic. The remaining feature is a genuinely thin adapter, which
is correct — it is an adapter.

There is a second, independent payoff. `computeValueDiagnostics` is module-private and has
**never been unit-testable**; its only proof today is a 2 226-line integration suite that
seizes the operator's screen to run. After this change the decision is unit-testable
headlessly, and the 5 pins in `test/unit/oracle-flags.test.ts` stop testing *a copy* and
start testing *the product*.

---

## 3. Evidence-based inventory

**MANDATORY per SESSION_RUNNER §Planning Sessions.** Every list below is a search result,
not architectural recall. Commands are reproducible from the repo root; results are as of
`f4fdf03` + the 1B claim `9e1c721`.

> **⚠ Read §3.5 before trusting any grep in this section.** The first draft of this plan
> published a grep whose *pattern could not match the file it searched*, and reported the
> empty result as an inventory finding. When you re-run anything here, confirm the pattern
> can match by first running it in a form you know returns hits.

### 3.1 Consumers of the symbols that move

```bash
grep -rn "computeValueDiagnostics" src/ test/ docs/ *.md
grep -rn "registerYamlValueDiagnosticsFeature" src/ test/
grep -rn "cellOptionFlags\|OracleCoreApi" src/ test/
```

| Symbol | Live references | Verdict |
|---|---|---|
| `computeValueDiagnostics` | `yaml-value-diagnostics.ts:78` (def), `:365` (the `compute:` slot). **Module-private — zero other live call sites.** Prose only: `test/oracle/README.md:78`, `test/oracle/flags.ts:58`, `BACKLOG.md:100`, **21 lines across `docs/planning/`**, **5 lines in `CHANGELOG.md`** | Rename/reshape is free. Prose to update: README + BACKLOG (Layer 5); `flags.ts` is deleted (Layer 4). The `docs/planning/` and `CHANGELOG.md` hits are **dated records that were true when written — leave them.** (Strictly append-only: `SESSION_NOTES.md`, `HANDOFFS.md`, `CHANGELOG.md`, `PROJECT_LEARNINGS.md`) |
| `registerYamlValueDiagnosticsFeature` | `src/extension.ts:41` (import), `:83` (call), `:362` (def) | **Unchanged by this plan.** The activation path does not move |
| `cellOptionFlags` | `test/oracle/run.oracle.test.ts:15,112`; `test/unit/oracle-flags.test.ts:16,61,65,95` | Both migrate to `valueFlags` |
| `OracleCoreApi` | `test/oracle/flags.ts:40` (def), `test/oracle/load.ts:25,34`, `test/unit/oracle-flags.test.ts:16,31` | **Deleted.** `load.ts` returns the loaded module itself instead of a 12-function struct |

### 3.2 The `src/core/` guardrail

```bash
grep -rn "from \"vscode\"\|from 'vscode'\|require(\"vscode\")" src/core/
# → no matches (42 .ts files: 37 top-level, plus src/core/qmd/ and src/core/embedded/)
```

The guardrail holds today. Adding a pure module is architecturally consistent; **the
executor must re-run this grep after the move** — an accidental `vscode` import in
`yaml-value-flags.ts` would break the oracle's headless load with an error far from its
cause.

### 3.3 Modules the decision depends on — and who else imports them

**Nine modules, not eight.** The first draft omitted `core/format-name-check`, which the
format-name branch at `:250`/`:261` calls and which §2.1's contract itself names.

```bash
for m in core/qmd/model core/yaml-frontmatter-values core/yaml-frontmatter-nested-values \
         core/yaml-context core/document-engine core/yaml-value-check core/validate-yaml \
         core/format-name-check core/yaml-schema; do
  echo "--- $m"; grep -rln "$m\"" src/ test/; done
```

| Module | Used by the moved body at | Other `src/` importers (must keep working) |
|---|---|---|
| `core/qmd/model` | `:83`, `:124` | `features/format-cell.ts`, `providers/outline.ts`, `providers/workspace-symbols.ts` |
| `core/yaml-context` | `:144`, `:170`, `:198` | `providers/yaml.ts` (completion) |
| `core/yaml-value-check` | `:200`, `:211`, `:250`, `:303` | `features/yaml-project-value-diagnostics.ts` |
| **`core/format-name-check`** | **`:250`, `:261`** | **`features/yaml-project-value-diagnostics.ts`** (+ `test/unit/format-name-check.test.ts`) |
| `core/yaml-schema` | the `SchemaIndex` type | `features/yaml-project-value-diagnostics.ts`, `features/yaml-schema-source.ts`, `providers/yaml.ts` |
| `core/yaml-frontmatter-values`, `core/yaml-frontmatter-nested-values`, `core/document-engine`, `core/validate-yaml` | `:84-85`, `:103-104`, `:120-126` | **none besides this feature** |

**No module is edited by this plan.** The new module only *composes* them, so every importer
above is unaffected. This is the single most important inventory result: the change is
additive in `src/core/` and subtractive in `src/features/`.

### 3.4 Test surfaces that must stay green

| Surface | Size | Command | Relationship to this change |
|---|---|---|---|
| `test/unit/**` | **1 494 passing / 61 files** (run firsthand at Orient) | `npm test` | Must not fall. The 5 `oracle-flags` pins migrate and new per-surface pins are added |
| `test/integration/suite/yaml-value-diagnostics.test.ts` | 2 226 lines, **71 `it(` call sites** | `npm run test:integration` | The adapter's only proof. **⚠ ASK the operator — it seizes the screen** |
| `test/oracle/**` | 66 corpus documents | `npm run test:oracle` | Regression net for the **cell surface only** (§6) |
| Type-check | — | `npm run check-types` (`src` only); `npm run compile-tests` (covers `test/oracle/**` and `test/integration/**` since S166) | Neither covers `test/unit` — use the incantation in §4 Layer 1 |

> **Do not use "71" as a pass/fail number.** 71 counts `it(` *call sites*; three of them sit
> inside `for` loops over literal arrays (`:332`, `:353`, `:812`), so mocha reports more
> tests than that. The criterion is **"the suite is green with no new failures"**. Record the
> runner's own total at the executor session's Orient and compare against that.

### 3.5 Assertion style in the integration suite — a corrected finding

**The first draft got this wrong, and the way it got it wrong is the lesson.** It published:

```bash
grep -n "diagnostics\[[0-9]\]\|\.at(\|sort(" test/integration/suite/yaml-value-diagnostics.test.ts
# → no matches
```

and reported "the suite never asserts by array index". **The pattern could not have matched:
the suite names its array `diags`, not `diagnostics`, in all 11 declarations.** The sound
command and its real result:

```bash
grep -nE "(diags|diagnostics)\[[0-9]+\]|\.at\(|sort\(" test/integration/suite/yaml-value-diagnostics.test.ts
# → 6 hits: :310, :341, :342, :923, :938, :985
```

**The conclusion survives, but on a different and stronger footing.** Each of those six sites
is immediately preceded by a cardinality guard — `assert.strictEqual(diags.length, 1, …)` at
`:309`, `:340`, `:918-922`, `:933-937`, `:980-984`. A one-element array has no ordering. Every
multi-diagnostic test routes through the `byLine` map built at `:80`, and the only
`assert.deepStrictEqual` calls compare `byLine`-keyed tuples. So:

> **No assertion anywhere in the suite can distinguish two orderings of a multi-diagnostic
> result.** Order preservation is a discipline requirement (§5 dragon 3), not something any
> test enforces — but if a document's diagnostic *count* changes, the length guards fire
> immediately and their failure messages enumerate every diagnostic.

---

## 4. Migration path

**Pre-declared as ONE vertical slice** under `SESSION_RUNNER.md` §Vertical Slice Sessions:
one capability — *the feature and the oracle share one implementation* — across five layers.
This document, once approved by the operator, **is the gate (a) contract**. A half-done
extraction (core module exists, oracle still mirrors) is strictly worse than either endpoint,
which is why the layers belong to one intent rather than two sessions.

> **Gate (a) is a duty, not a checkbox.** SESSION_RUNNER puts a positive obligation on the
> *implementing* session: re-verify this contract at Orient and treat drift as voiding it.
> **Executor: before Layer 1, confirm (i) `git log --oneline f4fdf03..HEAD` shows nothing
> touching `src/features/yaml-value-diagnostics.ts`, `src/core/`, or `test/oracle/`; (ii) the
> ~30 line-number citations in §1.3/§3/§5 still resolve — spot-check `:82`, `:90`, `:121`,
> `:267`, `:299`, `:333`, and the four construction blocks; (iii) `npm test` and
> `npm run check-types` are green.** If any drifted, this plan is void — re-plan, do not
> improvise.

> **Executor requirement — deepest available reasoning setting.**
> `ARCHITECTURE_WORKSTREAM.md` §Refactor Heuristics binds not just the analysis but *"the
> refactor they motivate"*: run the implementation session at the agent's deepest reasoning
> mode. Refactoring an existing module is high blast-radius and hard to reverse once
> committed. This plan is the contract, and that directive is part of it.

> **Gates (b), (c), (d).** (b) checkpoint commit at every layer boundary, each ≤5 files.
> (c) the verification each layer *can* meaningfully run — stated per layer below, with an
> explicit note where a command would be vacuous. (d) faithfulness per surface: §6.
> The allowance **adds** a gate; Phase 0, the 1B stub, and all of Phase 3 are unchanged.

### Layer 1 — the core module, test-first [RED→GREEN]

**Strict TDD applies here — this is the layer that adds the logic.** Do not write the module
first. Write one failing pin, make it pass, repeat.

**Do:** start with the 5 pins migrated from `test/unit/oracle-flags.test.ts` retargeted at
`valueFlags(...).cell` — the first one RED against a module that does not yet exist. Then add
pins for the three surfaces the mirror never covered, driving out the corresponding loops:

- `frontMatter` — a top-level closed-enum value (`toc: banana`), and the `validate-yaml`
  suppression of it;
- `format-name` — an unknown name flagged, a schema-accepted extension/modifier name silent,
  and the offline `formatNamesForValidation() === null` path silent;
- `nested` — an `execute:`-child value, and its `validate-yaml` suppression.

These three loops are ~136 lines that **no headless test has ever covered** and that the
oracle will not cover after this change (§6). "At least one pin" is not enough; pin each
branch you move.

**The eight lines that do NOT move**, despite sitting inside `:82-353`: `document.getText()`
`:82`, `await source.getIndex()` `:89`, `document.isClosed`/`isCurrent()` `:90`,
`document.fileName` `:121`, and the accumulator declaration `:94`. Everything else in the
range moves **verbatim** — every comment, every `continue` reason, the `break` at `:333` (see
dragon 3 before touching it).

**DONE looks like:** the module exists, pinned per surface; the feature still runs its own
copy; the tree is green.

```bash
npm run check-types                                   # clean
# the single-file incantation — the BARE form defaults to --target ES5 and emits
# 6 phantom TS2802 errors inside src/core/, files §8 forbids you to touch:
npx tsc --noEmit --skipLibCheck --target es2022 --module esnext \
        --moduleResolution bundler --strict test/unit/yaml-value-flags.test.ts
npm test                                              # ≥ 1494 + the new pins, 0 failures
grep -rn "from \"vscode\"" src/core/                  # still empty
```

Files: 2 (new module, new test). **Checkpoint commit.**

### Layer 2 — the feature becomes an adapter [RED→GREEN]

**Do:** delete the pure body from `computeValueDiagnostics` and replace it with
`getText` → `collectValueSources` → `hasNoValueLines` fast path → `await source.getIndex()` →
`isClosed`/`isCurrent` re-check → `valueFlags(sources, document.fileName, index)` → concat
`cell ++ frontMatter ++ nested` → one `.map()` to `vscode.Diagnostic`, setting `.source` and
`.code` exactly as the four blocks do today. The gate, the debounce contract, and the `null`
return semantics are untouched.

**Also move the module docstring.** `yaml-value-diagnostics.ts:1-34` describes the *decision*
— three surfaces, the `validate-yaml` hatch, the 26-of-170 pandoc-survivor accounting — and
points into code this layer removes. Move that content to the new core module's header and
leave the feature a short docstring about what an adapter does.

**RED first:** stub `valueFlags` to return three empty arrays and confirm the expected
integration pins fail *for the right reason*. A NEGATIVE assertion can pass against a dead
provider (S163 gotcha #5), so confirm a positive control fails too.

**DONE looks like:** one implementation in the tree; the mirror still exists but the product
no longer duplicates it.

```bash
npm run check-types && npm run compile-tests          # both clean
npm test                                              # unchanged count, 0 failures
npm run test:integration                              # ⚠ THE GATE for this layer — ASK FIRST
```

> **Do NOT treat `npm run test:oracle` as a gate here.** Nothing under `test/oracle/` imports
> `src/features/` (verified: the only match is a comment in `flags.ts:2`), so the oracle
> still measures the *mirror* and its output is guaranteed identical after Layer 2 whether
> the adapter is correct or completely broken. **The integration suite is the only thing that
> can observe this layer.** Run the oracle anyway if you like, but record it as a no-op.

Files: 1–2. **Checkpoint commit.**

### Layer 3 — the oracle calls the product

**Do:** rewrite `test/oracle/load.ts:34-59` to dynamically import
`${srcDir}/core/yaml-value-flags` and return **the loaded module object** (dropping the
12-function `OracleCoreApi` struct). Update `run.oracle.test.ts:112` to call
`mod.valueFlags(mod.collectValueSources(text), entryOf(c), index).cell`.

> **⚠ Annotate the loader's return type, or Layer 3's only non-oracle gate checks nothing.**
> A dynamic `import()` with a template-literal specifier is `any` in TypeScript, so an
> unannotated loader makes the new call site completely unchecked — wrong arity, wrong
> argument order, missing `.cell`, all invisible to `npm run compile-tests`. Today
> `load.ts:34` gets this for free via `Promise<OracleCoreApi>`. Replace it with
> `Promise<typeof import("../../src/core/yaml-value-flags")>`, which types the call site
> against the **current tree** while still loading the build under test at runtime — the same
> deliberate choice `flags.ts:36-38` documents for `OracleCoreApi` (a signature mismatch in an
> older build is a real incompatibility and should surface, not be papered over).

> **⚠ Call through the loaded module object, never a static `import { valueFlags } from
> "../../src/core/yaml-value-flags"`.** A static import silently pins the oracle to the
> *working tree's* build and makes `QMD_ORACLE_SRC` a no-op — the replay parameter that is
> the harness's entire reason for existing (`load.ts:1-19`) would still appear to work while
> measuring the wrong build.

**The differential check — mirror vs core over the SAME tree.** This is the strongest
available evidence that the extraction preserved the cell decision, and the window for it is
exactly this layer. It needs no throwaway code:

1. **Before** touching `run.oracle.test.ts`, run `npm run test:oracle` and save its output —
   specifically the per-row `ours [...]` detail lines the driver prints at `:116-119`. That is
   the **mirror's** answer for all 66 documents.
2. Make the Layer 3 edits.
3. Run `npm run test:oracle` again against the same `DEFAULT_SRC` and diff the two detail
   blocks. **They must be byte-identical** — not merely the same row classes, the same flag
   lists.

Row-class equality alone is too weak: two different flag sets both being non-empty produce the
same `agree`, so a real divergence could hide inside a passing run. Diff the detail lines.

**DONE looks like:** the oracle's numbers come from the product's own code, and the mirror
and the core module were proven to agree before the mirror was removed.

```bash
npm run compile-tests                                 # test/oracle/** is type-checked since S166
npm run test:oracle                                   # ⚠ THE GATE: identical row classes vs baseline.json
```

Files: 2–3. **Checkpoint commit.**

### Layer 4 — delete the mirror

**Do:** `git rm test/oracle/flags.ts` and `test/unit/oracle-flags.test.ts` (its pins now live
in `test/unit/yaml-value-flags.test.ts`). Grep for dangling references:

```bash
grep -rn "oracle/flags\|cellOptionFlags\|OracleCoreApi\|oracle-flags" src/ test/ docs/ *.md \
  | grep -v "SESSION_NOTES.md\|HANDOFFS.md\|CHANGELOG.md\|PROJECT_LEARNINGS.md"
git log --oneline -- test/oracle/flags.ts             # committed before removal (SAFEGUARDS)
npm run check-types && npm run compile-tests          # a deletion can break a type-check
npm test                                              # count must not fall
npm run test:oracle                                   # still green with the mirror gone
```

**DONE looks like:** zero live references outside the append-only history.

Files: 2 deletions + any reference fixes. **Checkpoint commit.**

### Layer 5 — the documentation the change invalidates

**Do:** update `test/oracle/README.md` at **three** places, not two:

- `:78-88` — the *"`flags.ts` is a MIRROR"* bullet becomes false; replace with dragon 1's
  honest replacement limitation;
- `:89-91` — the *"Cell options only"* bullet stays TRUE but its **cause changes**, from "the
  mirror only implements the cell loop" to "the driver takes `.cell`"; say so, and say what
  it would take to widen;
- `:100-110` — the file table lists a file that no longer exists;
- `:45-58` — the "Replaying another build" section, if dragon 1's trade changes it.

Also remove the completed `BACKLOG.md` item and append the `CHANGELOG.md` entry (Phase 3F).

This layer is `SESSION_RUNNER.md` framework Learning #10 applied deliberately: *a review pass scoped to the diff has a
blind spot — what the change made stale outside it.* None of these files appear in the code
diff.

```bash
grep -rn "mirror\|MIRROR" test/oracle/ src/core/yaml-value-flags.ts   # every hit still true?
```

Files: 3 (README, BACKLOG, CHANGELOG). **Checkpoint commit — and STOP here.**

> **The close-out is a SEPARATE commit.** This project's close-out additionally writes
> `SESSION_NOTES.md`, `HANDOFFS.md`, and `PROJECT_LEARNINGS.md`. Folding those into Layer 5
> makes a six-file commit, breaching a rule `SAFEGUARDS.md` labels **"Hard Rules (No
> Exceptions)"**. Commit Layer 5's three documentation files, then commit close-out
> separately.

---

## 5. Here be dragons

Per `SESSION_RUNNER.md` framework Learning #3 — not all layers are equally risky. These are where the cost actually lives.

### 🐉 1 — The oracle loses the ability to replay pre-refactor builds

`load.ts` dynamically imports from an arbitrary `srcDir`. After Layer 3 it imports
`core/yaml-value-flags`, which **does not exist in any commit before this refactor**. So
`QMD_ORACLE_SRC=/tmp/old/src npm run test:oracle` will fail to load for every historical
build — exactly as it already does for builds older than S164 (`load.ts:17-19`).

This is a **real capability regression** and must not be discovered after the fact.

- **Recommended: accept it, and say so in the README.** The replay capability's purpose is
  answering *"did my change regress anything?"*, and `baseline.json` already encodes the
  answer for all 66 rows per-document. For this refactor specifically, Layer 3's differential
  check plus baseline equality is stronger evidence than a replay would be.
- **Alternative A:** freeze `flags.ts` as a legacy replay path used only when the build under
  test lacks the core module. Rejected: it reinstates the artefact whose existence is the
  problem, and a frozen mirror still invites someone to quote its numbers.
- **Alternative B (not in the first draft):** invert the mechanism — have the driver load the
  build's *own* harness entry point rather than a fixed module path, so each build supplies
  its own adapter. More flexible, but it makes the oracle's contract a per-build negotiation
  and there is no second consumer to justify it yet. Reconsider if a third build shape appears.

### 🐉 2 — Why the return is grouped, not a flat tagged array

An earlier draft returned one flat `ValueFlag[]` carrying a `surface` tag, and required the
oracle driver to remember `.filter(f => f.surface === "cell")` before the count reached
`classifyRow`. That filter is load-bearing: `classifyRow(weFlag, verdict)`
(`classify.ts:44-55`) consumes only a boolean, and `baseline.json`'s `rows` are per-document
row *classes*. **Forgetting the filter would make front-matter flags flip a document's row
class, and the run would report a regression that is not one** — a silent failure that looks
exactly like a real one.

The grouped return makes the mistake **unrepresentable**: the driver takes `.cell` and there
is nothing to forget. Diagnostic order is still exact (`cell ++ frontMatter ++ nested`), and
the `surface` tag survives on each flag for reporting. Prefer designs that delete a failure
mode over designs that document one.

**But do not mistake the oracle for proof that the grouping works.** On today's corpus the
non-cell groups are expected to be **empty for all 66 documents** — the only front-matter
scalars the corpus carries are `title: t` and *valid* engine selectors, and a valid value
never flags. (Read off `corpus.ts`; **not** re-measured this session — the executor should
confirm it and say so.) So taking `.cell` versus taking everything would produce identical row
classes either way, and an oracle run can never fail because the grouping was misused.

**The grouping's real proof belongs in a unit positive control**, in
`test/unit/yaml-value-flags.test.ts`: one document that flags on *two different surfaces at
once*, asserting each flag lands in its own group and that the concatenation
`cell ++ frontMatter ++ nested` reproduces the feature's diagnostic order. Still report the
per-group counts in the oracle's output — a non-zero non-cell count is a signal to adjudicate,
never a confirmation that anything works.

### 🐉 3 — Verbatim means verbatim, and `break` ⇄ `continue` is NOT symmetric

The moved body carries **133 comment lines** (of 272) recording **measured quarto
behaviour** — the 26 pandoc-validated keys (`:278-298`), the quoted-key FP interaction
(`:148-160`), the `contentEndCol` clamp (`:162-169`). These are the most valuable artefacts
in the file and four separate sessions were docked for prose that drifted from measurement.
**Move them with their code. Do not summarise, reorder, or "improve" them.**

*(A first draft of this plan also listed "the `!!str`/`!!bool` trap" here. That comment is
**not** in this file — it lives in `src/core/validate-yaml.ts` and `src/core/document-engine.ts`,
which §8 forbids touching. Nothing to move.)*

**The `break`/`continue` pair — read this before "normalising" it.** An earlier draft claimed
both are correct "because the condition is loop-invariant". That reasoning is wrong, and
taken at face value it licenses the one edit that **does** change behaviour:

- **`:332-334` (nested loop) — `break` ≡ `continue`.** The test sits at the *top* of the loop
  with nothing above it, so skipping the rest of the body and exiting the loop have the same
  effect. Either spelling is safe.
- **`:299-301` (top-level loop) — `break` is NOT equivalent to `continue`.** This test sits
  **below** the `format` branch, which `continue`s at `:267` and is **deliberately not
  suppressed** by `documentValidationOff`. Replacing this `continue` with `break` would exit
  the loop entirely, so a `format:` line appearing *later* in `fmValueLines` would never be
  examined — **a lost true positive on a document quarto really does reject** (S163's HEADLINE
  1: `validate-yaml: false` + `format: banana` renders exit 1).

**Leave both exactly as they are.** Likewise preserve the order of `:267`'s `continue` and
`:299`'s gate: the gate sits below the format branch on purpose, and S163 measured that
hoisting it trades a false-positive fix for a lost true positive.

### 🐉 4 — Integration is the adapter's only proof, and it seizes the screen

The integration suite is what proves the `ValueFlag → vscode.Diagnostic` mapping still
produces the right ranges, severities, source and code. Unit tests cannot see it; the oracle
cannot see it (it never constructs a `Diagnostic`, and after Layer 3 it only scores the cell
surface). It must run at Layer 2 **and** once more at the end.

`npm run test:integration` seizes the operator's screen — **ask before every run** (S163
gotcha #7). It fails fast on a compile error, which costs nothing, so run
`npm run compile-tests` first every time.

---

## 6. Impact analysis

| Surface | Impact | Action required |
|---|---|---|
| `src/core/yaml-value-flags.ts` | **NEW** — the decision | Layer 1 |
| `src/features/yaml-value-diagnostics.ts` | 366 → ~90 lines; keeps gate, lifecycle contract, `Diagnostic` construction; docstring rehomed | Layer 2 |
| `test/oracle/flags.ts`, `test/unit/oracle-flags.test.ts` | **DELETED** | Layer 4 |
| `test/oracle/load.ts`, `run.oracle.test.ts` | Load the module dynamically; take `.cell` | Layer 3 |
| `test/oracle/README.md`, `BACKLOG.md`, `CHANGELOG.md` | Prose the change invalidates | Layer 5 |
| **`src/extension.ts`** | **UNCHANGED** — activation path does not move | none |
| **`src/core/*` (all 42 existing modules)** | **UNCHANGED** — composed, never edited | none |
| **`src/providers/yaml.ts`** (completion) | **UNCHANGED** | none — see §8 |
| **`test/oracle/corpus.ts`, `baseline.json`, `classify.ts`** | **UNCHANGED** — the invariant this refactor is measured against | none. *(Note: `corpus.ts:14` says "these 64 documents" while the corpus is 66 — pre-existing drift, not this change's to fix. File it.)* |
| **User-visible behaviour** | **NONE INTENDED.** Identical diagnostics, identical ranges, identical messages | the verification below is what turns "intended" into evidence |

### Faithful verification, per surface (slice gate d)

Stating what each surface actually exercises, rather than assuming green means covered:

| Surface | What it genuinely proves | What it does **not** |
|---|---|---|
| `npm test` | The core modules the decision composes, and — new — the decision itself, headlessly, per surface | Nothing about `vscode.Diagnostic` construction; nothing about real quarto |
| `npm run test:integration` | The adapter: ranges, severity, `source`, `code`, debounce, clearing | Only the shapes its fixtures contain; **not** diagnostic ordering (§3.5) |
| `npm run test:oracle` | That the **cell** decision still agrees with real `quarto render` exactly as before, row by row | Only these 66 documents; **and only the cell surface** — see below |
| Layer 3's differential check | That the extracted cell decision and the mirror agree over the whole corpus | Available for one layer only |
| `check-types` / `compile-tests` | `src`, `test/oracle`, `test/integration` | **Not `test/unit`** — use Layer 1's incantation |

> **⚠ The biggest coverage loss this change introduces.** The oracle scores the **cell
> surface only**, both before and after. The two front-matter loops — ~136 of the 272 moved
> lines — have **no end-to-end quarto evidence at all**, and today no headless test either.
> That is precisely why Layer 1 requires per-branch pins for `frontMatter`, `format-name` and
> `nested` rather than "at least one". Do not let baseline equality stand in for evidence
> about surfaces the baseline cannot see.

**The refactor's acceptance criterion:** `baseline.json`'s 66 row classes reproduced exactly,
Layer 3's differential check clean, the unit count not fallen with new per-surface pins
added, and the integration suite green with no new failures. Anything else is a regression,
whatever the diff looks like.

---

## 7. Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Keep the mirror; harden it further** (S166's choice) | Zero production risk | The drift is structural. S166 already pinned every step and *its own headline finding* was that this mirror had drifted anyway. More pins cannot fix a copy | It mitigates the symptom. The operator selected the fix |
| **Extract the cell-option loop only** (the literal BACKLOG wording, `cellOptionFlagsFor`) | Smallest diff; matches the filed item | `documentValidationOff` (`:103`) is computed once and consumed by **all three** loops (`:128`, `:299`, `:332`); extracting one loop splits that gate across a module boundary and computes it twice. It also permanently caps the oracle at the cell surface. *(`optedOutCells` at `:104` is used by the cell loop only — an earlier draft wrongly claimed both were shared)* | Half the extraction, most of the risk, a worse interface |
| **Flat `ValueFlag[]` with a `surface` tag** | Simplest signature | Requires the oracle to remember a load-bearing filter whose omission is silent and mimics a real regression (dragon 2) | Grouping deletes the failure mode instead of documenting it |
| **Export `computeValueDiagnostics` and have the oracle stub `vscode`** | No production code moves | A stubbed `vscode` is a *third* mirror, of the API rather than the logic; `Range`/`Diagnostic`/`DiagnosticSeverity` would all need doubles | Replaces a mirror with a subtler one |
| **Move the whole feature into `core/` with a registration shim** | Fewest files | `createDebouncedDiagnosticsFeature`, the collection, and the generation guard are irreducibly `vscode` | Not possible under the §3.3 guardrail |
| **Two sessions (core module, then oracle)** | Smaller sessions | The intermediate state is worse than either endpoint (§9), and a crash there strands the least useful state | The layers are one intent; the slice model exists for exactly this |

---

## 8. Scope boundary — what this plan does NOT do

Explicitly out of scope (FM #26). Each stays filed:

- **No behaviour change of any kind.** None of the four remaining cardinal false positives in
  `baseline.json` is fixed here. Success is measured by nothing moving.
- **Completion is not touched.** `providers/yaml.ts` still scopes by cell language rather than
  document engine (BACKLOG: *Cell-option COMPLETION never learns the document engine*). This
  extraction makes that fix easier later; wiring it is a different capability.
- **The corpus is not widened**, and `corpus.ts:14`'s stale "64 documents" is filed, not
  fixed. Widening in the same session would make the before/after unreadable.
- **`features/yaml-project-value-diagnostics.ts` (249 lines) is not extracted**, though it has
  the same shape and would be the rule-of-two. Separate deliverable.
- **The `test/unit` type-check gap is not closed** (S162's filed item) beyond running the
  corrected incantation on the new test file.
- **No sibling module is edited.** A defect found in a composed core module is a filing, not a
  fix (SAFEGUARDS §The Two-Mode Problem).

---

## 9. Session boundaries and the revert rule

| Session | Deliverable | Stop condition |
|---|---|---|
| **This one (167)** | This plan | Committed. **STOP.** |
| **Next (implementation)** | Layers 1–5 as ONE pre-declared vertical slice, five checkpoint commits + a separate close-out commit, strict TDD | Acceptance criterion in §6 met, mirror deleted, README true. **Close out.** |
| **Later (optional)** | Widen the corpus to front-matter/nested/format-name rows, now that the decision covers them | Separate session |

**The revert rule — and its one trap.** SESSION_RUNNER says a slice that cannot produce a
boundary's evidence reverts to the last clean checkpoint commit and closes out there. **But
Layer 1's checkpoint is not a safe resting state**: it leaves *three* copies of the decision
in the tree (the feature's body, `test/oracle/flags.ts`, and the new core module) — worse
than never starting, by this plan's own argument in §7.

So: if Layer 2's evidence cannot be produced — most likely because the screen-seizing
integration run needs an operator who is unavailable — **revert to `HEAD` before Layer 1**,
not to Layer 1's checkpoint. Layers 3, 4 and 5 are each safe resting places; Layer 1 alone is
not. Whatever lands still owes its `HANDOFFS.md` receipt and `CHANGELOG.md` entry (FM #27).

---

## 10. Verification checklist (architecture)

- [x] Every component has a defined responsibility — core decides, feature adapts, oracle replays
- [x] Input/output/error contracts defined (§2.1), including the three element types
- [x] No circular dependencies — the new module only imports existing `src/core/*`; nothing in `src/core/` imports it
- [x] Failure modes analysed (§5), including the one the design deletes rather than documents
- [x] Migration path with a rollback point at every layer, and the one layer that is **not** a rollback point named (§9)
- [x] Assumptions verified against code — every §3 claim is a search result, re-run after §11
- [x] Alternatives documented with honest cons (§7)
- [x] Scope boundary explicit — what changes **and** what does not (§6, §8)

---

## 11. Review record

An adversarial review panel was run against the first draft of this document with the
operator's explicit go-ahead (`Workflow` run `wf_25552832-cd9`): 6 independent read-only
lenses (factual, executor blind spots, completeness/staleness, behaviour preservation,
protocol compliance, design/alternatives), 2 refuters per finding (one factual, one
relevance), plus a completeness critic. **77 agents, 0 errors, ~4.4M subagent tokens, 35
findings.**

The run's own summary reported `survivors: []`. **That was an artefact of the survival
predicate, not a verdict** — it required *both* refuters to vote non-refuted, so any finding
one refuter dismissed as low-impact was recorded as killed even where the factual refuter had
independently *confirmed* it with grounded evidence. Reading the per-agent results rather than
the summary, **24 findings were factually confirmed**, and every one was re-verified firsthand
before this revision. (This is the S164 lesson — *never read a review's summary as a verdict*
— recurring in a new form.)

The corrections that mattered most, each verified by command before being applied:

| # | Defect in the first draft | Correction |
|---|---|---|
| 1 | §3.5 published a grep (`diagnostics\[`) that **could not match** the file it searched (the suite names its array `diags`), and reported the empty result as an inventory finding. Six index-based assertions exist | §3.5 rewritten with the sound command, the six sites, and the *real* reason order is unpinned (`length === 1` guards) |
| 2 | Dragon 3 justified `break` ⇄ `continue` as "loop-invariant, both correct" — **wrong, and asymmetric**. At `:299` a `break` would exit before a later `format:` line, losing a true positive | Dragon 3 rewritten to distinguish the two sites and forbid the normalisation |
| 3 | Layer 2 labelled `npm run test:oracle` "⚠ THE GATE" — but nothing in `test/oracle/` imports `src/features/`, so it cannot observe the adapter rewrite at all | Gate moved to the integration suite; oracle recorded as a no-op there; a differential check added at Layer 3 |
| 4 | §3.3's "modules the decision depends on" omitted `core/format-name-check`, which the moved body calls at `:250`/`:261` | Table now lists nine modules |
| 5 | "Move `:82-353` verbatim" swept up `document.getText()`, `document.isClosed` and `document.fileName`; §1.3 filed two of them under PURE | §1.3 separates the 16 `vscode.`-prefixed lines from the 3 bare `TextDocument` reads; Layer 1 names all eight exceptions |
| 6 | Layer 1 was implementation-first while §1.2 claimed every layer was RED-verified — a strict-TDD gate violation | Layer 1 is now test-first and tagged `[RED→GREEN]` |
| 7 | Layer 1's bare `npx tsc --noEmit --skipLibCheck <file>` defaults to ES5 and emits 6 phantom TS2802 errors inside `src/core/` | Corrected incantation with explicit `--target es2022` (verified exit 0) |
| 8 | Layer 5 merged documentation with close-out — a six-file commit, breaching the hard 5-file cap | Split into a documentation commit and a separate close-out commit |
| 9 | §9 named Layer 1 as the revert target, the one state the plan calls worse than either endpoint | Revert rule corrected: fall back to pre-Layer-1 `HEAD` |
| 10 | Gate (a)'s Orient re-verification duty was asserted ✔ but never passed to the executor | §4 now states the three checks the executor must perform before Layer 1 |
| 11 | Counts: "5 prose mentions" (actually 21 in `docs/planning/` + 5 in `CHANGELOG.md`); "71 integration pins" used as a pass/fail number though three `it(` sites are loop-parameterised | Both corrected; "71" demoted to a call-site count with an explicit warning |
| 12 | `ValueSources` was an unspecified placeholder, and passing `text` separately made the S124 desync representable | Fully specified, and the text now travels **inside** `ValueSources` |
| 13 | The flat tagged array required a load-bearing filter the oracle could silently forget | Return grouped by source; the mistake is now unrepresentable (dragon 2) |
| 14 | Layer 4 ran no build/test commands; README `:89-91` and the feature's `:1-34` docstring were in no edit list | Verification added to Layer 4; both sites added to Layers 2 and 5 |

The **completeness critic** raised five further findings, all verified and all applied:

| # | Critic finding | Correction |
|---|---|---|
| 15 | Dragon 2's oracle-side check **cannot fail**: no corpus document produces a non-cell flag, so taking `.cell` or taking everything gives identical row classes | Dragon 2 now says so, and moves the grouping's real proof to a **unit positive control** (a document flagging on two surfaces at once). The "expected zero" is marked *not re-measured this session* — the executor confirms it |
| 16 | Dragon 1's mitigation named a window that **does not exist** (there is no core path in the oracle "before Layer 3"), and asked for the wrong comparison (old build vs new, rather than mirror vs core over the same tree) | Replaced with a concrete three-step recipe needing no throwaway code: save the `ours [...]` detail lines, make the edits, re-run, **diff byte-identically**. Also notes that row-class equality alone is too weak |
| 17 | A template-literal dynamic `import()` is `any`, so Layer 3's new oracle call site would be **completely unchecked** — while the plan cites `compile-tests` as that layer's gate | Layer 3 now requires annotating the loader `Promise<typeof import("../../src/core/yaml-value-flags")>` |
| 18 | `ARCHITECTURE_WORKSTREAM.md`'s directive to run a refactor at the deepest reasoning setting binds the **implementation** session, and the plan never carried it forward | Added to §4's gate box |
| 19 | Bare "Learning #3"/"Learning #10" resolve to `PROJECT_LEARNINGS.md` under this project's convention, where both are entirely different learnings | Both citations disambiguated to `SESSION_RUNNER.md` framework learnings |

Findings **correctly refuted** and deliberately not acted on include: that Layer 3's sketch
implied a static import (it did not, though the plan now says so explicitly anyway), and that
`corpus.ts`'s stale "64 documents" should be fixed here (pre-existing; filed in §6/§8 instead,
per the scope boundary).

**Standing caution for the executor.** Two of the three highest-value findings in this review
were *false-justification* defects, not code defects: a conclusion that happened to be right
resting on reasoning that was wrong (§3.5's grep, dragon 3's `break`/`continue`). Both would
have read as fine to anyone who trusted the prose. When this plan asserts *why* something is
safe, re-derive it — do not inherit it.
