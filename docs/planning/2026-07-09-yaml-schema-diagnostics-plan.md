# YAML Schema Diagnostics (`_quarto.yml` project/website/book unknown-key detection): Implementation Plan

**Status:** PLAN (draft for an executor session). Produced by Session 46 (2026-07-09).
**Governs:** `BACKLOG.md` "Up Next" item #2, as originally framed: *"YAML schema diagnostics (unknown-key-only, v1) ... in addition to per-document front-matter/cell-option keys."*
**Scope lock (operator-confirmed, this session, via a mid-planning AskUserQuestion):** **v1 = `_quarto.yml` unknown-key diagnostics for the interior of `project:`/`website:`/`book:` blocks ONLY.** Front-matter top-level keys, cell options (`#|`/`//|`), per-format nested options (`format:\n  <fmt>:\n    <key>`), and `_quarto.yml`'s own ROOT keys are **explicitly OUT OF SCOPE — not deferred, but empirically ruled UNSAFE** (see §0). This is a narrower v1 than BACKLOG.md's original framing implied; the narrowing is the plan's headline finding, not a scope-timidity choice.
**Out of scope:** everything just listed as unsafe; `book:`'s `type`-conditional variants (a book vs. website vs. manuscript distinction inside `type:` itself is not modeled — v1 checks whichever of `project:`/`website:`/`book:` blocks are literally present in the file, regardless of `project: type:`); type/enum/required-field validation (BACKLOG's own stated v1 boundary); a settings toggle to disable the feature (§9 Q4); proactively validating an unopened `_quarto.yml` from a nested `.qmd`'s context (§9 Q5, §8).

---

## 0. How this plan was produced (evidence provenance) — and the headline finding

Grounded via a 6-agent research + adversarial-verification `Workflow` (Session 46, ~467K subagent tokens, 205 tool calls): 4 parallel research agents (repo grep-inventory of reusable core/ infrastructure; VS Code Diagnostics API mechanics via official docs + production-extension source; a **live empirical test of the installed Quarto 1.7.33 CLI** probing open-vs-closed-schema semantics across every candidate surface; prior-art on Posit's own extension and the `redhat.vscode-yaml` alternative) followed by 2 adversarial verifiers who independently re-ran the single most load-bearing test from scratch, with their own fixtures and key names. Every file:line citation and every live-schema shape below was additionally re-confirmed firsthand by this session's own direct reads of `src/core/yaml-schema.ts`, `src/core/project.ts`, `src/features/yaml-schema-source.ts`, `src/extension.ts`, `package.json`, and direct `python3` probes of the real installed `yaml-intelligence-resources.json` (Learning #6 — read implementations, don't estimate from descriptions).

**The single most important finding, and the reason this plan's scope is a fraction of BACKLOG.md's original framing:**

BACKLOG.md item #2 as written asked for "flag a key absent from the schema" across front matter, cell options, and `_quarto.yml`. A live empirical test against the installed CLI — made-up key vs. a genuine typo of a real option, in each candidate surface, independently reproduced twice with different fixtures and key names — found:

| Surface | Open or closed (live-tested against Quarto 1.7.33) | Safe to flag "unknown key"? |
|---|---|---|
| `.qmd` front-matter top-level keys | **Open** — a fabricated key (`flux-capacitor-level: 88`) and a genuine typo of a real option (`number-secitons` for `number-sections`) are **byte-for-byte indistinguishable**: both `quarto render` exit 0, silent, no warning | **No** — would false-positive on every real project using custom template/params metadata |
| Cell options (`#\|`) | **Open**, and not even validated by `quarto render` at all (`parseAndValidateCellOptions`'s `validate` parameter defaults `false`, confirmed by reading `quarto.js`'s bundled source; even the assembled cell-option schema itself carries no `closed` flag) | **No** |
| Per-format nested options (`format:\n  html:\n    <key>`) | **Open** — absorbed into the same open front-matter/pandoc-metadata schema | **No** |
| `_quarto.yml` **root** keys | **Open** — even a typo of `project:` itself (e.g. `projec:`) is silently accepted as arbitrary sibling metadata | **No** |
| **Interior of `project:`/`website:`/`book:` blocks in `_quarto.yml`** | **Closed** — `quarto render`/`quarto inspect` already reject an unrecognized key here TODAY, with fuzzy "did you mean" suggestions (e.g. `output-dirr` → `ERROR: property name output-dirr is invalid ... Did you mean output-dir?`) | **Yes** — this is the one surface where flagging genuinely, provably matches what Quarto itself already enforces at render time. Zero false-positive risk found anywhere in the test matrix. |

Root-caused directly in the bundled `quarto.js` CLI source (not just observed as a black box): `getProjectConfigSchema()` (the `_quarto.yml` root validator) never sets `closed` on its own outer object — so arbitrary sibling keys at the root always pass — but each of `project:`/`website:`/`book:`'s own inner property lists IS separately marked `closed: true` in the schema data the CLI reads.

**A second dead end, resolved:** this project's prior sessions had flagged a "validation-shaped `json-schemas.json`" artifact (distinct from the completion-shaped `yaml-intelligence-resources.json` this extension already reads) as a lead worth investigating for this feature. Direct inspection (independently confirmed by both verifiers) found it is **not useful**: a flat, non-standard, 82-entry `$defs` library with `"object"`-wrapped types (not real JSON Schema `"type": "object"`), where the `ProjectConfig`/`BookSchema`/`BaseWebsite` defs are never `$ref`'d by anything else in the file. Traced through the bundled CLI source: it is a byproduct of Quarto's own release-time TypeScript-type-export tooling (`generateJsonSchemasFromSchemas`, wired only to an internal `build-js` command), **never read back by the CLI at runtime**. Everything needed for this feature — including the `"closed": true` flags — is already present in `yaml-intelligence-resources.json`, the file this extension already parses. No new artifact, no new CLI-output-parsing path.

**A third correction, smaller but real:** BACKLOG.md's stated rationale for sequencing item #2 after item #1 was *"#1's `_quarto.yml` discovery (`findProjectRoot`) is now available to reuse for validating `_quarto.yml` itself."* With v1 narrowed to "validate `_quarto.yml` when it is itself open in the editor" (§2.4 — the standard, simplest VS Code diagnostics pattern), **`findProjectRoot` turns out not to be needed by this plan at all** — the diagnostics provider reacts to a document literally named `_quarto.yml`/`_quarto.yaml`, wherever it lives, with no root-discovery step. Proactively validating a project's `_quarto.yml` from a nested `.qmd`'s context (which WOULD need `findProjectRoot`) is a real, legitimate future enhancement — documented as such in §8/§9 Q5, not built here.

---

## 1. Executive summary (TL;DR)

Add one new **always-on feature** (no command, no keybinding — mirrors how the existing YAML *completion* provider is just always active for `.qmd` documents): whenever a file named `_quarto.yml`/`_quarto.yaml` is open in the editor, scan its `project:`/`website:`/`book:` blocks (whichever are present) for keys that Quarto's own installed schema marks as **closed-set** and does not recognize, and surface each as a `vscode.Diagnostic` (red squiggle + Problems-panel entry), severity **Error** (this genuinely breaks `quarto render` today — not a heuristic guess). Recomputed on open/change (debounced 350ms) and on save; cleared on close.

**This is smaller and safer than a multi-slice epic, but touches a genuinely new architectural pattern for this codebase** (event-driven `DiagnosticCollection`, not a registered `LanguageFeatureProvider` — §2.5) and a genuinely new schema shape (a `super`/`$ref` merge chain for `book:` — §2.2's Dragon). Recommended as a **single vertical-slice implementing session** (`SESSION_RUNNER.md` §Vertical Slice Sessions), pre-declaring the four-layer contract now (Gate a):

| Layer | What it adds | New/changed files |
|---|---|---|
| L1 — pure core | Extend `SchemaIndex` with closed-set project/website/book key resolution (incl. the `book:` super-merge resolver); a new pure whole-document scanner for bare (non-front-matter-fenced) `_quarto.yml` key lines | `src/core/yaml-schema.ts` (+method, +resolver, +curated fallback), `src/core/project-yaml.ts` (new), `test/unit/yaml-schema-index.test.ts` (+tests), `test/unit/project-yaml.test.ts` (new) |
| L2 — adapter + wiring | `DiagnosticCollection` creation, filename-gated event subscriptions (open/change/save/close), debounce, activation-event fix | `src/features/yaml-diagnostics.ts` (new), `src/extension.ts` (+1 wire), `package.json` (+1 `activationEvents` entry) |
| L3 — test fixtures | A valid and an invalid `_quarto.yml` fixture (real on-disk files — see §2.5's filename-gate constraint on why in-memory docs can't exercise this feature) | `test/fixtures/yaml-diagnostics/valid/_quarto.yml` (new), `test/fixtures/yaml-diagnostics/invalid/_quarto.yml` (new) |
| L4 — integration tests | End-to-end verification via `vscode.languages.getDiagnostics(uri)` | `test/integration/suite/yaml-diagnostics.test.ts` (new) |

Each layer is a checkpoint commit (≤5 files each, under the per-commit cap); the full build/test matrix runs at every boundary (Gate c — and see Learning #52d's self-critique from the prior slice: run it at EVERY boundary this time, not once at the end).

---

## 2. The mechanism, resolved

### 2.1 What "closed" actually means here (recap of §0's table)

Only `project:`, `website:`, and `book:` — as direct children of `_quarto.yml`'s root — are in scope. Nothing else in the document is scanned.

### 2.2 The schema data: already in hand, but three different shapes to resolve

Probed directly against the real installed schema (`/Applications/quarto/share/editor/tools/yaml/yaml-intelligence-resources.json`, Quarto 1.7.33):

`data["schema/project.yml"]` is a 6-entry array (`project`, `website`, `book`, `manuscript`, `type` [hidden], `engines`) — **not currently read anywhere**; `parseSchemaIndex` (`yaml-schema.ts:844-845`) only collects `schema/cell-` and `schema/document-` prefixed keys. `manuscript`/`engines`/`type` are out of v1 scope (only `project`/`website`/`book` per §0's confirmed-closed set).

Each of the three in-scope entries resolves differently — this is the plan's real complexity, not a uniform "just read three lists":

- **`project:`** — flat, zero indirection. The entry's own `schema.object` carries `closed: true` and an inline `properties` object directly (11 keys: `title`, `type`, `render`, `execute-dir`, `output-dir`, `lib-dir`, `resources`, `preview`, `pre-render`, `post-render`, `detect`). No `$ref` to resolve.
- **`website:`** — one-hop `$ref`. The entry is `{"ref": "base-website"}`; resolving it in `schema/definitions.yml` finds `base-website` with its OWN `closed: true` + 36 inline `properties`. A single-hop indirection — the existing `resolveObjectProperties`'s `ref`-walking (Session 37, b2-iii-key) already resolves exactly this shape for a different purpose (per-format option children); this plan needs the analogous walk but for KEY-set + closedness, not a full `SchemaField[]` with values/descriptions (see §5.1 — a new sibling function, not a reuse, mirroring how `buildRenderProjectArgs` stayed a sibling of `buildRenderArgs` rather than forcing a shared shape onto two different needs).
- **`book:`** (🐉 the plan's headline dragon) — a two-level `super` merge. `schema/project.yml`'s `book` entry is `{"object": {"super": [{"resolveRef": "book-schema"}, {"resolveRef": "csl-item-shared"}]}}`. Resolving `book-schema` in `definitions.yml` finds it is ITSELF `{"closed": true, "super": {"resolveRef": "base-website"}, "properties": {...17 keys...}}` — i.e. `book-schema` supers `base-website` a second time. `csl-item-shared` contributes 108 more property names but carries no `closed` flag of its own (its openness is irrelevant — the OUTER `book`/`book-schema` closed flag governs the merged whole; this is a merge-then-close semantic, not "closed only if every part is independently closed"). **The full valid `book:` key set = `book-schema`'s own 17 properties ∪ `base-website`'s 36 properties ∪ `csl-item-shared`'s 108 properties**, closed as a whole. This is empirically confirmed, not inferred: the live probe (§0) independently verified `book: {bogus-book-key: true}` is rejected by `quarto render` with `exit 1`.

**Why include `book:` despite the complexity, rather than deferring it like this codebase's existing `super`/`allOf`-merge dragon (b2-iii-deep) was deferred:** multi-file book/website projects are the confirmed dominant workflow for this project's target usage (Session 43's ranking rationale) — `book:` misconfiguration is exactly the failure class this feature exists to catch, and (unlike b2-iii-deep's genuinely open-ended arbitrary-depth completion problem) THIS merge chain is now fully grounded and bounded: exactly three named definitions, resolved once, no recursion beyond what's been directly observed above. A new pure resolver (§5.1) walks `ref`/`resolveRef`/`super` with a `seenRefs` cycle-guard (mirroring the existing pattern in `resolveObjectProperties`, `yaml-schema.ts` Session 37) and returns the union of property names plus the closed flag from the outermost entry. **Verification requirement (§6): the gate-d discriminator MUST prove the merge actually walked the full chain, not just `book-schema`'s own shallow list** — `announcement` is a grounded, precise choice: it exists in `base-website`'s properties but NOT in `book-schema`'s own inline properties, so asserting `book:\n  announcement: ...` produces ZERO diagnostics is a real proof the resolver climbed through `book-schema`'s `super` to `base-website`, not a coincidence of a shallower, wrong implementation happening to pass a weaker test.

### 2.3 Enumerating candidate key lines in a bare `_quarto.yml` (no `---` fence)

`_quarto.yml` is a bare YAML file — it is not a `.qmd`, has no front-matter fences, and none of `core/qmd/model.ts`'s scanning (`findFrontMatter`, `inFrontMatter`, `frontMatterContentLines`, all anchored on `^---[ \t]*$`) applies to it at all. A new pure scanner is needed, but it is much narrower than a general "enumerate every key at every depth" walker would be, precisely BECAUSE v1's scope (§0/§2.1) is exactly three named top-level containers, one level deep:

```
findProjectConfigKeyLines(text: string): ProjectConfigKeyLine[]
  # ProjectConfigKeyLine = { line, container: "project"|"website"|"book", key, keyRange }
  currentContainer = null   # tracks which of project:/website:/book: we're under, or null
  containerIndent = null    # the indent level of that container's OWN children
  for each line, top to bottom:
    if line is column-0 (no leading whitespace) and matches `<name>:` (a pure-mapping
       container line — reuse yaml-context.ts's existing mappingContainerKey(text),
       already pure and line-local, §5.2):
      currentContainer = name if name in {"project","website","book"} else null
      containerIndent = null   # reset; set on the FIRST child line seen under it
      continue
    if currentContainer === null or line is blank/comment-only:
      continue
    indent = leading whitespace length
    if containerIndent === null:
      containerIndent = indent   # first indented line under the container defines its depth
    if indent !== containerIndent:
      continue   # deeper nesting or a dedent — out of v1 scope, skip (never a false flag)
    if line matches a `key:`/`key: value` mapping-line shape at this indent (reuse the
       same key-span grammar `topLevelSlots`/`valueSlotAfterColon` already extract for
       front matter, yaml-context.ts, applied here to an arbitrary indent instead of
       column 0 — a parameterization, not new grammar):
      emit { line, container: currentContainer, key: <extracted text>, keyRange }
    # a sequence item ("- ...") or anything else at this indent: skip, never flag
```

This is a single forward pass, O(n) in document lines, with no backward search (unlike `yaml-context.ts`'s cursor-based `nearestShallowerLine`, which is the wrong shape for whole-document enumeration per the research's finding — §0's code-inventory thread). It reuses two already-pure, line-local helpers (`mappingContainerKey`, the value/key-span grammar) rather than duplicating their logic, but lives in a NEW file (not `qmd/model.ts`, which is specifically the `.qmd`-with-front-matter scanner, nor `yaml-context.ts`, which is specifically cursor-position based) — see §5.2.

### 2.4 Why `findProjectRoot` (Session 45) is NOT needed here

The feature's trigger is "a document named `_quarto.yml`/`_quarto.yaml` is open" — no root-discovery step from an arbitrary starting file is needed (§0's third correction). This also means the feature's blast radius is trivially bounded: it can never touch a `.qmd` file, and it can never be wrong about which "project" it's validating, because it always validates the exact file the user has open, not a discovered ancestor.

### 2.5 Diagnostics lifecycle (VS Code API mechanics — genuinely new to this codebase)

Grepped confirmed-zero-hits, independently re-verified: `createDiagnosticCollection`, `vscode.Diagnostic`, `DiagnosticCollection`, `onDidOpenTextDocument`, `onDidSaveTextDocument` all have **zero** existing usage anywhere in `src/`. This is greenfield.

- **Collection:** `vscode.languages.createDiagnosticCollection("quarto-project")`, pushed into `context.subscriptions` (its `dispose()` calls `clear()` internally).
- **Events:** `onDidOpenTextDocument`, `onDidChangeTextDocument`, `onDidSaveTextDocument`, `onDidCloseTextDocument` — each handler filters by filename FIRST (`document.fileName.endsWith("_quarto.yml") || document.fileName.endsWith("_quarto.yaml")`) before doing any work. **This filename gate is load-bearing and structurally different from every existing provider in this codebase**: `providers/yaml.ts`, `providers/embedded.ts`, etc. are all registered via `vscode.languages.register*Provider` with a `DocumentSelector` (`{language:"quarto"}`) that VS Code itself uses to route calls — the provider function is simply never invoked for a non-matching document. A `DiagnosticCollection` driven by raw `workspace.onDidChangeTextDocument` has no such selector: the event fires for EVERY document change in the workspace (any `.ts` file, any `package.json` edit, any OTHER yaml file — GitHub Actions workflows, `.vscode/settings.json`, etc.), so the handler must filter itself, every time, first. Because `_quarto.yml` is not this extension's own `"quarto"` languageId (§2.6), filtering on `languageId` would both under-match (VS Code's built-in "yaml" language may not always be active, e.g. if the user has no YAML grammar contributor at all — rare but possible) and over-match (every OTHER yaml file in the workspace) — filename is the only reliable, precise gate.
- **Debounce:** 350ms on the change-event path (research-grounded: `vscode-markdownlint`, a mature non-LSP production extension doing this exact class of work, hardcodes 500ms; `asciidoctor-vscode`'s maintainers independently converged on the same figure for comparable per-keystroke re-analysis — 300-500ms is the de facto community standard, §0's VS Code-API research thread). Open/save/close events fire once per action already and do not need debouncing (mirrors `vscode-markdownlint`'s own split: immediate on open/save, debounced on type).
- **`delete(uri)` vs. `clear()` — get this right:** `onDidCloseTextDocument` → `collection.delete(uri)` (removes only that document's diagnostics). **Never call `collection.clear()` from a per-document handler** — it wipes every open `_quarto.yml`'s diagnostics workspace-wide, a real, documented footgun the official samples and `vscode-markdownlint` both explicitly avoid.
- **Priming at activation:** iterate `vscode.workspace.textDocuments`, filtered to the same filename gate, and run the check once for each already-open match — the official "Basic tier" pattern (`code-actions-sample`, `diagnostic-related-information-sample`) both prime the active/visible editor(s) at startup rather than waiting for the first edit event.

### 2.6 Activation — a confirmed real gap, not merely "worth checking" (🐉 second dragon)

`package.json`'s `activationEvents` is `["onLanguage:quarto"]` (confirmed, `package.json`), and the `"quarto"` language contribution's `extensions` list is `[".qmd", ".rmd", ".Rmd"]` only (confirmed) — **`_quarto.yml` does not match this extension's own language ID at all**; it opens with VS Code's built-in `"yaml"` languageId (or, in the rare case no YAML grammar is installed, plain text). **This means `onLanguage:quarto` will never fire from opening `_quarto.yml` alone** — a user who opens a project folder and edits only `_quarto.yml`, never any `.qmd` file, would never activate this extension, and the diagnostics feature would silently never run. This is a confirmed defect-in-waiting, not a "check it and see" item the way the render plan's D4 was (that one turned out to already work; this one has a grounded reason to expect it does NOT). **Fix: add `onLanguage:yaml` to `activationEvents`.** This is broad (fires for any YAML file, not just `_quarto.yml`), but activation only loads the extension into memory — the filename gate (§2.5) still governs whether the diagnostics feature actually does anything, so the broader activation event costs nothing beyond a slightly earlier extension load for users editing unrelated YAML files. (`workspaceContains:**/_quarto.yml` was considered as a narrower alternative — rejected, §8.)

---

## 3. Scope

- **In scope:** one new always-on feature; a `SchemaIndex` extension for closed project/website/book key resolution (incl. the `book:` merge); a new pure bare-YAML key-line scanner; `DiagnosticCollection` wiring with debounce/cleanup; an `activationEvents` fix; new fixtures; unit + integration tests.
- **Out of scope (do not bundle — FM #18):** front-matter/cell-option/per-format/`_quarto.yml`-root unknown-key flagging (§0 — empirically unsafe, a permanent scope boundary for "unknown-key" diagnostics, not a "later" item); type/enum/required-field validation (BACKLOG's own stated v1 boundary); a fuzzy "did you mean" suggestion in the diagnostic message (§8 — cheap, real, deliberately deferred to keep v1 exactly "flag absent-from-schema membership," matching BACKLOG's literal wording); a settings toggle to disable the feature (§9 Q4); proactive validation of an unopened `_quarto.yml` via `findProjectRoot` from a `.qmd`'s context (§8/§9 Q5); `manuscript:`/`engines:` blocks (present in `schema/project.yml` but not confirmed in-scope by the live probe — §9 Q6).

---

## 4. Evidence-based inventory (grep-verified firsthand + adversarially re-checked)

### 4.1 Reuse table

| # | Component | Location | How this plan uses it |
|---|---|---|---|
| R1 | Schema file location + read + degrade | `src/quarto/cli.ts` `quartoSharePath()` (`:89-105`), `src/features/yaml-schema-source.ts` `createSchemaSource()`/`loadSchemaIndex()` (`:38-69`) | Reused **unchanged** — the diagnostics feature calls `createSchemaSource().getIndex()` exactly like the completion provider does (a second independent instance, consistent with the existing per-provider-construction convention, `providers/yaml.ts:36-46`). No new CLI spawn, no new file read. |
| R2 | Schema JSON parse pipeline | `src/core/yaml-schema.ts` `parseSchemaIndex` (`:840-860`) already parses `data["schema/definitions.yml"]` into a `definitions: Map<string, unknown>` via `indexDefinitions` (`:782-792`) | Reused **unchanged plumbing** — the new `project`/`website`/`book` resolution (§5.1) reads `data["schema/project.yml"]` (a new top-level key read, same shape as the existing `data["schema/cell-*"]`/`data["schema/document-*"]` reads) and resolves `$ref`/`super` against the SAME already-built `definitions` map — no second definitions parse. |
| R3 | `$ref`/indirection-walking precedent | `src/core/yaml-schema.ts` `resolveObjectProperties` (Session 37, b2-iii-key) — walks `anyOf`/`ref`/`maybeArrayOf`/the `{schema:X}` wrapper, `seenRefs`-cycle-guarded | **Pattern reused, not the function itself** — the new resolver (§5.1) needs KEY-set + closedness, not a full `SchemaField[]` with values/descriptions/formats; a new sibling function mirrors the cycle-guard discipline rather than overloading a function built for a different return shape (same "sibling, not generalize" precedent as `buildRenderProjectArgs`/`buildRenderArgs`, prior plan §8). |
| R4 | Curated-fallback pattern | `src/core/yaml-schema.ts` `CURATED_FRONTMATTER_KEYS`/`CURATED_EXECUTE_KEYS`/etc. (`:199-333`) | Template for a new small curated `project:`/`website:`/`book:` key list (offline fallback when Quarto is absent/unreadable) — same shape, same never-throw philosophy. |
| R5 | Line-local syntactic helpers | `src/core/yaml-context.ts` `mappingContainerKey(text)` (`:283-297`, pure, line-local), the key/value-span grammar used by `topLevelSlots`/`valueSlotAfterColon` (`:367-408`) | Reused as-is / lightly parameterized (indent argument generalized from "column 0" to "the container's own child indent") by the new whole-document scanner (§2.3/§5.2) — these helpers are already cursor-independent internally, just never previously called in a forward whole-document loop. |
| R6 | Event-driven refresh precedent | `src/features/math-preview.ts:146-148`, `src/features/diagram-preview.ts:147`, `src/features/execution.ts:55-60` (all react to `onDidChangeTextDocument`, none debounced) | Shows the established "react to live edits" shape this codebase already uses — but **none of the three implement a debounce**, confirmed by reading each; the diagnostics feature's debounce (§2.5) is genuinely new code, not a reuse. |
| R7 | Feature-registration idiom | `src/features/render-project.ts:32-42` (`registerRenderProjectFeature`), `src/providers/embedded.ts:51-76` (`registerEmbeddedLanguageFeature`) | Template for `registerYamlDiagnosticsFeature(context)` — construct owned state, push every disposable into `context.subscriptions`, one function, one call from `extension.ts`'s `activate()`. |
| R8 | Integration test scaffolding | `test/integration/suite/render-project.test.ts` (129 lines, read in full, prior session) — `EXTENSION_ID` activation gate, `ROOT`-relative fixture paths, `describe`/`before`/`afterEach` shape | Template for `yaml-diagnostics.test.ts` — same activation/fixture/cleanup shape, but assertions read `vscode.languages.getDiagnostics(uri)` instead of a command's side effects (§4.2 G4). |

### 4.2 Gaps table (does not exist; must be built)

| # | Gap | Evidence | Built in layer |
|---|---|---|---|
| G1 | **Closed-set project/website/book key resolution.** `schema/project.yml` is never read anywhere (`parseSchemaIndex` only collects `schema/cell-`/`schema/document-` prefixes, `yaml-schema.ts:844-845`); no `closed`/`super` handling exists at all (`grep -c '"closed"' src/core/yaml-schema.ts` → 0, confirmed — this project's own reader has never needed the concept, since completion never cared whether a container was closed, only what its children were). | `yaml-schema.ts:844-845` (read in full, this session); live probe of `schema/project.yml`/`definitions.yml`, this session | L1 |
| G2 | **A bare-(non-front-matter-fenced)-YAML key scanner.** `findFrontMatter`/`inFrontMatter`/`frontMatterContentLines` (`qmd/model.ts:343-380`) are all anchored on `^---[ \t]*$` fence detection — structurally inapplicable to `_quarto.yml`, which has no fences. Zero existing whole-document (as opposed to cursor-position) key enumerator exists anywhere (`yaml-context.ts`'s logic is exclusively "what's at THIS line/col," confirmed by tracing every call site). | `qmd/model.ts` (read in full), `yaml-context.ts` (read in full), this session's research thread | L1 |
| G3 | **`vscode.Diagnostic`/`DiagnosticCollection` usage.** Zero hits anywhere in `src/` for `createDiagnosticCollection`, `vscode.Diagnostic`, `DiagnosticCollection`, `onDidOpenTextDocument`, `onDidSaveTextDocument` (whole-`src/` grep, this session, independently re-confirmed). | grep, this session | L2 |
| G4 | **A debounce utility.** `math-preview.ts`/`diagram-preview.ts`/`execution.ts` all react to `onDidChangeTextDocument` synchronously, no debounce anywhere in `src/` (read all three call sites in full, this session). | `math-preview.ts:146-148`, `execution.ts:55-60` | L2 |
| G5 | **`_quarto.yml` activation.** `activationEvents` is `["onLanguage:quarto"]` only; the `"quarto"` language's `extensions` is `[".qmd",".rmd",".Rmd"]` only (both confirmed, `package.json`, this session) — `_quarto.yml` cannot trigger activation today. | `package.json` (read via direct parse, this session) | L2 |
| G6 | **A real, on-disk, exactly-named `_quarto.yml` fixture pair.** The completion suite's `openInMemory` helper (`yaml.test.ts:50-54`) opens `{language:"quarto", content}` `untitled:`-scheme documents — structurally unable to exercise a filename-gated feature (an `untitled:` document has no filename to match). Session 45's existing `test/fixtures/project/_quarto.yml` is all-valid (zero diagnostics) and reusable as the "valid" baseline, but no invalid fixture exists anywhere. | `test/fixtures/project/_quarto.yml` (read in full, prior session); `yaml.test.ts:50-54` (read, this session) | L3 |

---

## 5. Interface contracts (interface-first; `core/` stays `vscode`-free per §3.3)

### 5.1 `src/core/yaml-schema.ts` (extend the existing file)

```ts
export interface SchemaIndex {
  cellOptions(engine?: "knitr" | "jupyter" | "ojs"): SchemaField[];
  frontMatterKeys(parentPath: string[]): SchemaField[];

  /**
   * The closed set of valid keys directly inside `_quarto.yml`'s `project:`,
   * `website:`, or `book:` block, or `null` when this container's closed-set
   * data could not be resolved (safe default: callers must NOT flag anything
   * for a `null` result — absence of proof is not proof of absence). `book:`
   * resolves through a `super` merge chain (`book-schema` supers
   * `base-website`; `book:` itself also supers `csl-item-shared`) — see plan
   * §2.2. Never throws.
   */
  projectKeys(container: "project" | "website" | "book"): Set<string> | null;
}
```

`parseSchemaIndex` (`:840-860`) gains one more `collectFields`-sibling read: `const projectFields = data["schema/project.yml"]` (an array, not run through `collectFields`/`toField` — its entries are containers, not leaf `SchemaField`s), threaded into `indexOf` (`:370-376`) as a new parameter alongside the existing four. A new private resolver, e.g.:

```ts
/** Cycle-guarded (seenRefs), never throws. Resolves ref/resolveRef/super into
 *  a flat property-name Set + the outermost entry's `closed` flag. */
function resolveClosedKeys(
  node: unknown,
  definitions: Map<string, unknown>,
  seenRefs: Set<string>,
): { names: Set<string>; closed: boolean } | null;
```

mirrors `resolveObjectProperties`'s existing `seenRefs`-cycle-guard discipline (Session 37) but is a NEW function — its return shape (name-set + closed-flag) is genuinely different from `resolveObjectProperties`'s `SchemaField[]` (which carries descriptions/values/formats this feature does not need). `indexOf`'s `projectKeys(container)` looks up the pre-resolved `Map<"project"|"website"|"book", {names,closed}|null>` built once per `parseSchemaIndex` call (not re-resolved per query — same "resolve once at parse time" discipline the rest of `indexOf` already follows). A small curated fallback (mirroring `CURATED_FRONTMATTER_KEYS`) covers `CURATED_SCHEMA_INDEX`'s offline case — the 11 `project:` keys grounded in §2.2 are cheap to hand-curate exactly; `website:`/`book:` curated lists can be a smaller "most common" subset (offline-only fallback, never authoritative — a false negative here just means "don't flag," never "flag wrongly").

### 5.2 `src/core/project-yaml.ts` (new, pure)

```ts
/** One key line found directly inside `project:`/`website:`/`book:` in a bare
 *  (non-front-matter-fenced) Quarto project YAML file. */
export interface ProjectConfigKeyLine {
  line: number;
  container: "project" | "website" | "book";
  key: string;
  keyRange: { startCol: number; endCol: number };
}

/** Enumerate every direct child key line under a top-level `project:`,
 *  `website:`, or `book:` block in `_quarto.yml`/`_quarto.yaml`'s content.
 *  Single forward pass, O(n) in line count. Deeper nesting, sequence items,
 *  and any other top-level key are silently skipped (never a false flag —
 *  plan §2.3). */
export function findProjectConfigKeyLines(text: string): ProjectConfigKeyLine[];
```

Algorithm: §2.3. Reuses `mappingContainerKey`/the key-span grammar from `core/yaml-context.ts` (R5) — import, don't duplicate.

### 5.3 `src/features/yaml-diagnostics.ts` (new adapter)

```ts
export function registerYamlDiagnosticsFeature(context: vscode.ExtensionContext): void;
```

Constructs one `DiagnosticCollection` + one `SchemaSource` (R1), wires the four document events (§2.5) with the filename gate, primes already-open matching documents at registration, pushes everything into `context.subscriptions`. Handler shape: `findProjectConfigKeyLines(document.getText())` → for each entry, `(await source.getIndex()).projectKeys(entry.container)` → if non-null and `!keys.has(entry.key)`, build a `vscode.Diagnostic(range, message, DiagnosticSeverity.Error)` with `source: "Quarto"`, `code: "quarto-unknown-project-key"` → `collection.set(document.uri, diagnostics)`. Message format: `` `Unknown key "${key}" in "${container}:" — not a recognized Quarto ${container} option.` `` (no fuzzy "did you mean" in v1 — §8).

### 5.4 `package.json` (+1 `activationEvents` entry)

```json
"activationEvents": ["onLanguage:quarto", "onLanguage:yaml"]
```

No new command entry (this is an always-on diagnostics feature, not a command — §1).

### 5.5 `src/extension.ts` (+1 wire)

One new import + one new `registerYamlDiagnosticsFeature(context);` call alongside the other `registerXxxFeature(context)` calls (`extension.ts:32-43`).

---

## 6. The slice(s)

> Format: **Goal → New/changed files → What DONE looks like → Verification → Dragons → Boundary.**

### Recommended: ONE vertical-slice session (pre-declared contract, Gate a satisfied by §1's layer table)

- **Goal:** opening (or editing) a `_quarto.yml`/`_quarto.yaml` with an unrecognized key directly inside `project:`, `website:`, or `book:` shows a red squiggle + Problems-panel entry, matching exactly what `quarto render` would reject — no false positives anywhere else in the document, ever.
- **New/changed:** exactly the four layers in §1's table.
- **DONE:** a valid `_quarto.yml` (Session 45's existing fixture, or one exercising all three blocks) produces ZERO diagnostics; an unknown key under `project:` is flagged; an unknown key under `website:` is flagged; an unknown key under `book:` is flagged AND a `base-website`-only key (`announcement`) under `book:` is NOT flagged (the merge-chain discriminator, §2.2); an unknown key anywhere else in the SAME file (front matter of a co-located `.qmd`, a top-level sibling of `project:`, a deeply-nested key under `project:`) is never flagged; closing the document clears its diagnostics; editing back to valid clears the diagnostic live (debounced).
- **Verify:** `npm test` (unit: `findProjectConfigKeyLines` — finds direct children of each of the three containers; ignores deeper nesting; ignores sequence items; ignores non-target top-level keys like `format:`; `projectKeys`/`resolveClosedKeys` — resolves `project:`'s flat list; resolves `website:`'s one-hop `$ref`; resolves `book:`'s full merged set INCLUDING `base-website`-only names; cycle-guard terminates on a synthetic circular `$ref` fixture; degrades to curated on malformed input, never throws); `npm run test:integration` (new `yaml-diagnostics.test.ts` against the new fixtures — zero diagnostics on valid, one each on the three invalid cases, the `announcement` no-false-positive discriminator, clear-on-close via `getDiagnostics` before/after `closeAllEditors`); `npm run compile`; `npm run package`. **Gate-d discriminator:** the `announcement`-under-`book:` test IS gate-d for the merge resolver (only passes if the resolver actually climbs `book:`→`book-schema`→`super`→`base-website`, not a shallower implementation); break-revert by temporarily short-circuiting `resolveClosedKeys` to return only the entry's OWN inline `properties` (skip `super`/`ref`) — this should turn BOTH the `website:` test (loses the `base-website` $ref hop) and the `announcement` discriminator RED, while `project:`'s test (no indirection at all) stays GREEN, precisely isolating what the indirection-walking code is responsible for.
- **Dragons:** see §7 (both apply to this one slice).
- **Boundary:** one session (or two — §9 Q1, same open question shape as the prior plan). Do not also build the fuzzy "did you mean" enhancement (§8) or the proactive-from-`.qmd`-context validation (§8) in the same session even if this one finishes quickly (FM #2 "keep going").

---

## 7. Failure-mode / risk analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| D1 | **`book:`'s `super` merge resolved incompletely** (e.g. only `book-schema`'s own 17 properties, missing the second-hop `base-website` 36 or the `csl-item-shared` 108) → false positives on genuinely valid `book:` keys, the worst possible outcome for a "zero false positive" feature. | **High** | The `announcement` gate-d discriminator (§6) is a direct, specific regression test for exactly this failure — it only passes if the FULL chain resolves. Also assert at least one `csl-item-shared`-only key (e.g. a citation-style field) is accepted, covering the second `super` member independently of the first. |
| D2 | **Activation never fires** for a user who only ever opens `_quarto.yml` (§2.6) — the feature silently never runs, indistinguishable from "everything is fine" to the user. | **High** | `onLanguage:yaml` added to `activationEvents` (§2.6/§5.4); verify at Phase 3E by launching the Extension Development Host with **zero** `.qmd` ever opened, opening only a `_quarto.yml`-containing folder, and confirming diagnostics appear on a deliberately-broken fixture with no other file ever touched. |
| D3 | **Filename gate false-negatives on an unusual URI scheme or path casing** (e.g. a `_quarto.yml` opened via a `vscode-remote:`/`vscode-vfs:` scheme, or — on a case-insensitive filesystem — `_Quarto.yml`). | Low | `document.fileName` is the resolved OS path regardless of scheme (VS Code normalizes this), so scheme is a non-issue; casing is a real but low-probability edge case (Quarto's own CLI marker-file check, per Session 45's `findProjectRoot`, is also exact-case) — match the existing precedent (exact case, `.yml`/`.yaml` both), do not add case-insensitivity v1 doesn't have anywhere else in this codebase. |
| D4 | **Debounce timer leak across rapid open/close** (a timer scheduled for a document that closes before it fires still runs, potentially calling `collection.set` on a URI that was just `delete`d, resurrecting a stale diagnostic). | Medium | Track pending timers in a `Map<string, NodeJS.Timeout>` keyed by `uri.toString()`; `onDidCloseTextDocument` must BOTH `collection.delete(uri)` AND clear/cancel any pending timer for that URI, in that order — a real, easy-to-miss ordering bug worth its own explicit unit-adjacent integration test (open, edit, close fast, assert no diagnostic reappears after the debounce window). |
| D5 | **A `.qmd` file that happens to be literally named `_quarto.yml`** is nonsensical (wrong extension) and not a real concern; but a workspace with a SECOND, differently-purposed file that happens to match the filename gate (unlikely, since `_quarto.yml`/`_quarto.yaml` are Quarto-specific marker names with no other common use) is not a real risk either. Noted and dismissed, not mitigated. | Negligible | No action — recorded so a future reviewer doesn't have to re-derive that this was considered. |

---

## 8. Alternatives considered

| Alternative | Why not |
|---|---|
| Flag unknown keys in front matter / cell options / `_quarto.yml` root too, as BACKLOG.md originally framed | **REJECTED, empirically** (§0) — all four surfaces are open by Quarto's own design; flagging there would false-positive on every real project using custom metadata, with zero way to distinguish a typo from an intentional custom field. This is a permanent scope boundary for "unknown-key" diagnostics specifically, not a "v2" deferral. |
| Shell out to `quarto inspect`/`quarto render` and parse its error output instead of hand-rolling the schema check | **REJECTED** (§0 pt. 5) — no structured/JSON error output exists on a validation failure (plain colorized stderr, first-error-only, would need fragile regex parsing); the schema data needed is already sitting in the file this extension already reads, with zero new CLI-output-parsing surface. |
| Use `json-schemas.json` as a real, standards-conformant JSON Schema | **REJECTED, empirically** (§0) — confirmed unused-at-runtime, non-standard-shaped, dangling-`$ref`ed build byproduct; the CLI itself never reads it back. |
| Point VS Code's built-in YAML validation at Quarto via `yaml.schemas`/`redhat.vscode-yaml`, instead of building this feature | **REJECTED as a substitute; noted as a narrow future complement** (prior-art research thread) — Quarto ships no conformant, published JSON Schema today (confirmed via a Quarto community-maintainer response in `quarto-dev/quarto-cli` discussion #6585: *"a properly formatted schema isn't currently published for public consumption"*); and `redhat.vscode-yaml` cannot validate `.qmd` front matter at all (a long-standing open upstream issue, `vscode-yaml#207`) even where a schema existed. Real MIT-licensed mechanism, zero licensing objection, but not buildable-without-new-schema-authoring today, and would never cover the harder `.qmd` half of "YAML diagnostics" even if it were. |
| A fuzzy "did you mean X?" suggestion in the diagnostic message, using edit-distance against the known key list | **Deferred, not rejected** — cheap (the data is already in hand) and would mirror Quarto's own error UX, but BACKLOG's stated v1 is literally "flag a key absent from the schema" (membership, not fuzzy-matching); bundling it risks under-testing the threshold/false-positive behavior of a genuinely different algorithm inside a session whose contract (§1) is already fully specified without it. Tracked as an easy v1.1 follow-up. |
| Reuse `findProjectRoot` (Session 45) to proactively validate a project's `_quarto.yml` even when the user is only editing a nested `.qmd`, never `_quarto.yml` itself | **Deferred, not rejected** — genuinely more proactive/valuable (catches project misconfig the user might never notice by never opening the file), but is the VS Code docs' "Advanced tier" (validate files not currently open), a materially larger feature (needs off-editor `fs.readFile`, re-triggering on `.qmd` switches, and `findProjectRoot`-after-all) than the "Basic tier" this plan scopes to (§2.4/§2.5). Also changes BACKLOG's original dependency claim (§0's third correction) from "false" to "true, but only for this larger version" — worth remembering if this follow-up is ever picked up. |
| `workspaceContains:**/_quarto.yml` instead of `onLanguage:yaml` for activation | **REJECTED** — narrower in one dimension (doesn't fire for a `_quarto.yml` opened as a genuinely loose file with no containing workspace scan) and no narrower in the dimension that matters (activation only loads the extension; the filename gate, not the activation event, is what actually scopes the feature) — `onLanguage:yaml` is simpler and has no real downside given the filename gate already does the precise work. |

---

## 9. Open questions for the executor (resolve at implementation, not now)

1. **One session or two?** All four layers (§1) are necessary for one usable, testable capability; recommend one session, matching the prior plan's ratified choice. Splitting **L1 alone** (schema resolver + scanner + unit tests) then **L2-L4** (wiring + fixtures + integration) in a follow-up session is equally valid if the operator prefers that cadence — ratify at kickoff.
2. **`csl-item-shared`'s 108 properties — curate a smaller offline-fallback list, or omit `book:` from the CURATED (Quarto-absent) fallback entirely?** The reader-derived path is fully specified (§5.1); the CURATED fallback for `book:` specifically is large if done exhaustively. Recommend a small "most common ~10" curated `book:` list (a false negative offline just means "don't flag," never wrong) — confirm before implementing.
3. **Debounce interval:** this plan recommends 350ms (§2.5, between the two cited real-world 500ms precedents and a snappier feel, since `_quarto.yml` files are typically small). Confirm, or match 500ms exactly for consistency with the cited precedents.
4. **A settings toggle to disable the feature?** No existing feature in this codebase has one (render/preview/completion are all always-on); recommend NOT adding one for v1 consistency, but flag since diagnostics-as-a-category is sometimes considered more opt-in-worthy than completion. Confirm before implementing if the operator disagrees.
5. **Should this plan's §8-deferred "proactive from `.qmd` context" enhancement be promoted into THIS BACKLOG item's remaining scope, or filed as its own new BACKLOG entry once this v1 ships?** Recommend the latter (keeps this plan's contract exactly as specified, §1) — flag at close-out either way.
6. **`manuscript:`/`engines:`** are present in `schema/project.yml`'s 6 entries but were not part of §0's live-tested confirmed-closed set (only `project`/`website`/`book` were tested). Recommend leaving both out of v1 (§3) unless a quick empirical check at kickoff confirms the same closed-set behavior — cheap to verify (same test shape as §0), not required to unblock the other three.

---

## 10. Quick reference

| File | Status | Role |
|---|---|---|
| `src/core/yaml-schema.ts` | +method, +resolver, +curated data | `SchemaIndex.projectKeys`, `resolveClosedKeys` (§5.1) |
| `src/core/project-yaml.ts` | **New** | `findProjectConfigKeyLines` — the bare-YAML key-line scanner (§5.2) |
| `src/features/yaml-diagnostics.ts` | **New** | `registerYamlDiagnosticsFeature` — `DiagnosticCollection`, event wiring, debounce (§5.3) |
| `package.json` | +1 `activationEvents` entry | `onLanguage:yaml` (§5.4/§2.6) |
| `src/extension.ts` | +1 wire | `registerYamlDiagnosticsFeature(context)` (§5.5) |
| `test/unit/yaml-schema-index.test.ts` | +tests | `projectKeys`/`resolveClosedKeys` coverage incl. the merge-chain discriminator |
| `test/unit/project-yaml.test.ts` | **New** | `findProjectConfigKeyLines` coverage |
| `test/fixtures/yaml-diagnostics/valid/_quarto.yml` | **New** | Zero-diagnostics baseline (all three blocks present, all-valid keys) |
| `test/fixtures/yaml-diagnostics/invalid/_quarto.yml` | **New** | One bad key each under `project:`/`website:`/`book:`, plus a valid `announcement` under `book:` (the merge discriminator) |
| `test/integration/suite/yaml-diagnostics.test.ts` | **New** | End-to-end via `vscode.languages.getDiagnostics` |

**Unchanged:** `src/core/project.ts` (`findProjectRoot` — confirmed NOT needed by this plan, §2.4/§0), `src/core/qmd/model.ts`, `src/core/yaml-context.ts` (its helpers are imported, not modified), `src/providers/yaml.ts`, every render/preview/embedded feature.

---

*End of YAML Schema Diagnostics plan. Implementation is a separate session (or two — §9 Q1). The headline finding (§0) is not a hypothetical — it was caught by actually running the installed Quarto CLI against fabricated-key and typo'd-key fixtures across every candidate surface and observing the exact open/closed boundary, independently replicated twice by adversarial verifiers with their own fixtures before being locked in here, and confirmed live via the operator's own scope decision mid-session.*
