# `_quarto.yml` Document Links + Filepath Autocompletion: Implementation Plan

**Status:** PLAN (draft for an executor session). Produced by Session 79 (2026-07-11).
**Governs:** `BACKLOG.md` "Up Next" item #14, as originally framed: *"`_quarto.yml` document links + filepath autocompletion. Since v1.132.0 (PR #906): clickable DocumentLink navigation for file-path values in `_quarto.yml`, plus filepath autocompletion suggesting real project files. No `vscode.DocumentLinkProvider` exists in this project. Reuses existing `core/project-yaml.ts`/`core/yaml-context.ts` infrastructure."*
**Scope lock (operator-confirmed, this session, via a mid-planning `AskUserQuestion`):** **Whole-document, existence-checked heuristic** for BOTH capabilities — NOT scoped to `project:`/`website:`/`book:`. A candidate scalar/sequence value anywhere in `_quarto.yml` is linked only when it resolves to a real file/directory on disk relative to the document's own directory; filepath completion fires generically after `: `/`- ` anywhere in the file, not gated by schema field type. This diverges from item 14's own BACKLOG framing ("reuses existing `core/project-yaml.ts`... infrastructure") — that infrastructure only covers 15 of the 50 empirically-confirmed path-typed schema fields (§0/§2.2); reusing it unchanged would silently omit `bibliography`/`csl`/`css`/`template`/`include-in-header` and 32 others. Matches Posit's own shipped v1.132.0 behavior, grounded in public PR #906 facts (§0).
**Out of scope:** schema-driven path-type detection (a new `SchemaField.type` marker) — considered and rejected, §8; type/enum validation of path VALUES (e.g. confirming a referenced file has the "right" extension for its field) — no such feature exists in this codebase for any field type, out of scope by precedent; resolving paths relative to a discovered project root via `findProjectRoot` — not needed, §2.4; any change to `core/project-yaml.ts`'s existing `project:`/`website:`/`book:` closed-schema key diagnostics (Session 47) — a completely separate feature, untouched.

---

## 0. How this plan was produced (evidence provenance) — and the headline finding

Grounded via a 6-agent research + adversarial-verification `Workflow` (Session 79, ~331K subagent tokens, 103 tool calls): 4 parallel research agents (repo grep-inventory of existing `DocumentLinkProvider`/file-listing/value-span infrastructure; VS Code `DocumentLinkProvider`/`CompletionItemProvider` API mechanics via the official `vscode.d.ts` + two shipping MIT-licensed official providers [`typescript-language-features`'s `tsconfig.ts`, `vscode-markdown-languageservice`] + public PR #906 facts; a live empirical census of every path-typed field in the installed Quarto 1.7.33 schema; this project's own planning-document house style and provider-registration conventions) followed by 2 adversarial verifiers who independently re-derived the single most load-bearing claim (whether `resources`/`bibliography` are path-typed, and which container(s) each resolves inside) from scratch, with their own Python traversal code.

**The single most important finding:** item 14's own BACKLOG text says this feature "reuses existing `core/project-yaml.ts`/`core/yaml-context.ts` infrastructure" — implying the existing `project:`/`website:`/`book:` closed-schema scan (built for Session 47's diagnostics feature) is the right foundation. **It is not.** That infrastructure resolves only `project:`/`website:`/`book:`'s own children — **15 of the 50 empirically-confirmed path-typed fields in the installed schema** (§2.2). The other 35 (net of 2 same-name-different-scope duplicates) — `bibliography`, `csl`, `template`, `include-in-header`, `css`, and 30 more — live in the *general document front-matter schema*, a container `core/project-yaml.ts` never walks and, per the diagnostics plan's own headline finding, is *unsafe to make "unknown key" claims about* (open schema) — but that unsafety is specific to flagging unknown KEYS, not to linking a VALUE that verifiably exists on disk (§2.1 explains why the two features have different, non-transferable safety profiles).

Independently, Posit's own shipped implementation (PR #906, grounded in public PR-description/CHANGELOG/discussion text only — no AGPL source read, per this project's clean-room policy) confirms the same conclusion from the opposite direction: it is explicitly **not schema-driven** — the author's own description says it does "fairly hackish parsing... to find potential file names, then each match is checked to exist," gated only by filename (`_quarto.yml`/`_quarto.yaml`), not by which block a key sits in. A Posit maintainer's own comment on the PR states there is no "standard function for resolving files in quarto projects" yet, and a fuller, schema-aware solution is deferred to a future "Quarto 2" foundation.

**Operator-resolved (this session, mid-planning `AskUserQuestion`): build the whole-document, existence-checked heuristic**, not the schema-scoped one item 14's text implied. This is the plan's scope lock (header).

---

## 1. Executive summary (TL;DR)

Add two new, independent, pull-model `vscode.languages.register*Provider` registrations, both scoped to `_quarto.yml`/`_quarto.yaml` via a **pattern-based `DocumentSelector`** (`{ pattern: "**/_quarto.{yml,yaml}" }`) — genuinely simpler than the diagnostics feature's raw-event-plus-filename-gate wiring (§2.3), because VS Code itself routes calls for a matching document; no manual `onDid*TextDocument` subscriptions, no debounce, no generation counter.

1. **`QuartoYamlDocumentLinkProvider`** (`vscode.DocumentLinkProvider`): for every candidate scalar/sequence-item value in the document, resolve it relative to the document's own directory, `stat` it, and — only if it resolves to a real file or directory — return a `vscode.DocumentLink` targeting it. Existence-gating is the entire safety mechanism (§2.1); no schema awareness needed or used.
2. **`QuartoYamlFilepathCompletionProvider`** (`vscode.CompletionItemProvider`): when the cursor is in a value position after `key:` or `- ` anywhere in the document, list the contents of the resolved directory (prefix-scoped to whatever's already typed past the last `/`) via `vscode.workspace.fs.readDirectory`, offering `CompletionItemKind.File`/`Folder` items — no schema awareness needed here either (§2.1).

Recommended as **two separate vertical-slice sessions** (§9 Q1) — independently useful, independently verifiable, sharing one small pure-core module but otherwise unentangled.

| Layer | What it adds | New/changed files |
|---|---|---|
| L1 — pure core (shared by both slices) | A whole-document scanner for candidate VALUE tokens (scalar after `key:`, or a `- ` sequence item, at any depth) + a cursor-position value-slot detector | `src/core/project-links.ts` (new), `test/unit/project-links.test.ts` (new) |
| L2 — DocumentLinkProvider (Slice 1) | Existence-checked link resolution + registration | `src/providers/document-links.ts` (new) |
| L3 — CompletionItemProvider (Slice 2) | Directory-listing completion + registration | `src/providers/filepath-completion.ts` (new) |
| L4 — wiring + fixtures + integration tests | `extension.ts` wiring (2 calls); new fixture directory with real files/subfolders to link/complete against | `src/extension.ts` (+2 wires), `test/fixtures/document-links/...` (new), `test/integration/suite/document-links.test.ts` (new), `test/integration/suite/filepath-completion.test.ts` (new) |

---

## 2. The mechanism, resolved

### 2.1 Why existence-gating makes whole-document scope safe (the asymmetry with the diagnostics feature)

The diagnostics plan's headline finding was that front matter/cell options/`_quarto.yml`-root are OPEN schemas — flagging an "unknown key" there would false-positive on every legitimate custom field, because a made-up key and a genuine typo are indistinguishable. **That risk does not transfer to this feature.** A document link's or completion suggestion's "correctness" isn't about schema membership — it's about whether the thing on screen actually resolves to something real. A value that happens to look like a path AND resolves to a real file on disk, in the directory the user's own project lives in, is — overwhelmingly — actually a path the user intended to reference (Posit's own team reached the identical conclusion, §0). The only failure mode is a **coincidental** false link (a scalar value that isn't semantically a path but happens to match a real filename in the same directory, e.g. `type: book` in a directory that happens to contain a file literally named `book`) — rare, low-severity (clicking it just opens an unrelated file; nothing is silently broken or asserted false the way a wrong diagnostic would be), and an accepted risk in Posit's own shipped implementation.

### 2.2 The schema census (grep-verified, adversarially re-checked)

Full field-by-field inventory in the research transcript; summary:

- **50 distinct path-typed field names** in the installed Quarto 1.7.33 schema (`yaml-intelligence-resources.json`), found via a `path`/`{maybeArrayOf:"path"}`/`{arrayOf:"path"}` traversal resolved through the same `ref`/`resolveRef`/`super`/`anyOf` indirection chains `core/yaml-schema.ts` already resolves for other purposes (not reused code — a parallel Python traversal for research purposes only; this plan does NOT propose adding schema-driven path-type detection to `yaml-schema.ts`, §8).
- **15 inside `project:`/`website:`/`book:`/`manuscript:`** — `resources`, `output-dir`, `lib-dir`, `render`, `image`, `image-alt`, `drafts`, `references`, `output-file`, `cover-image`, `chapters`, `appendices`, `tools`, `article`, `environment`.
- **37 outside it** (net of 2 same-name/different-scope dupes: `image`, `output-file`) — `bibliography`, `csl`, `citation-abbreviations`, `template`, `template-partials`, `filters`, `shortcodes`, `resource-path`, `extract-media`, `include-in-header`, `include-before-body`, `include-after-body`, `metadata-file(s)`, `css`, `reference-doc`, `logo` (×2 distinct contexts), `titlegraphic`, `image` (website-format), `language`, `syntax-definition(s)`, 4 `epub-*` fields, `revealjs-url`, `parallax-background-image`, plus 5 internal/hidden fields and 3 cell-option fields (`cache-path`, `file`, `child`).
- **This census is informational only** — it grounds the scope decision (§0) and is NOT wired into the implementation. The implementation (§2.1) makes no schema query at all; a value is linked/completed purely by disk existence / directory listing, independent of which of these 50 names (or none of them) the key happens to be.

### 2.3 Provider registration is genuinely simpler than the diagnostics feature's event-driven pattern (a positive finding, not a dragon)

`vscode.languages.registerDocumentLinkProvider`/`registerCompletionItemProvider` both accept a `DocumentSelector`, and `DocumentFilter.pattern` accepts a `GlobPattern` — confirmed in the official `vscode.d.ts`. This means `{ pattern: "**/_quarto.{yml,yaml}" }` lets **VS Code itself** route `provideDocumentLinks`/`provideCompletionItems` calls only for matching documents, exactly the precision `src/providers/yaml.ts`'s `{ language: "quarto" }` selector already gets for `.qmd` files. `src/features/yaml-diagnostics.ts` could NOT do this (that plan's own §2.5) only because `DiagnosticCollection` is not a `LanguageFeatureProvider` — it has no selector-based routing at all, forcing raw `onDid*TextDocument` events + a manual filename gate + debounce + a generation counter. **None of that machinery is needed here.** This is the first `_quarto.yml`-scoped feature in this codebase that gets to use the simpler, standard pull-model registration `providers/yaml.ts`/`providers/embedded.ts`/`providers/workspace-symbols.ts` already use for `.qmd`.

### 2.4 `findProjectRoot` is not needed (same conclusion as the diagnostics plan, same reasoning)

Both features operate on the currently-open `_quarto.yml` document itself. The base directory a relative path resolves against is `path.dirname(document.fileName)` (adapter-side; `path.dirname`/`path.resolve` are already used this way by `src/features/clear-cache.ts`/`render.ts` for sibling concerns) — no ancestor walk, no `exists`-callback injection, no import of `core/project.ts`.

### 2.5 🐉 Dragon: no value-span extraction exists anywhere for bare `_quarto.yml` — and it needs to handle sequence items, which nothing in this codebase does today

Confirmed by this session's research: `core/project-yaml.ts`'s `ProjectConfigKeyLine` carries only `keyRange`, never a value span — `keySpanAt` stops at the colon. `yaml-context.ts`'s `valueSlotAfterColon` (the ONE place in this codebase that already computes a YAML value-token span — leading-whitespace-skip, quote handling, trailing-comment trim) is **not exported** and is scoped to `.qmd` front-matter/cell-option lines, not bare `_quarto.yml`. Neither handles a `- value` sequence item at all — `keySpanAt` explicitly bails (`rest.startsWith("-") → return null`) and nothing else in this codebase extracts a sequence item's own value span, because `resources:` under `project:` (and many of the 37 non-`project:`-scoped fields, e.g. `template-partials`, `filters`, `include-in-header`) are legitimately YAML lists:

```yaml
project:
  resources:
    - data/raw.csv
    - "images/logo.png"
```

`findPathValueCandidates` (§5.1, new) must walk BOTH shapes — `key: value` (reusing/duplicating `valueSlotAfterColon`'s grammar, exported or mirrored) and `- value` (new grammar: skip the `-`, one space, then the same trailing-comment/quote handling) — at ANY indentation depth (whole-document scope, §0), not gated to a specific container's child indent the way `findProjectConfigKeyLines` is.

### 2.6 🐉 Dragon: cursor-position value-slot detection for completion has no existing analog either

`yaml-context.ts`'s `completionContextAt`/`frontMatterContextAt`/`nestedKeyContextAt` are all built for `.qmd` documents (front-matter-fenced, engine-aware) — none apply to a bare `_quarto.yml`. A new, much simpler position detector is needed for Slice 2: given `(text, line, col)`, is the cursor after a `key:` (with optional whitespace) or after a `- ` sequence marker on `line`, at ANY indentation — if so, return the value-so-far token (up to `col`) and the resolved directory prefix (everything up to the last `/` in that token) for `vscode.workspace.fs.readDirectory` to list. This detector does NOT need `findPathValueCandidates`'s whole-document scan (§2.5) — it only needs the current line — but shares the same value-token grammar.

---

## 3. Scope

- **In scope:** `src/core/project-links.ts` (whole-document candidate-value scanner, `key:`/`- ` grammars, cursor-position value-slot detector); `src/providers/document-links.ts` (existence-checked `DocumentLinkProvider`); `src/providers/filepath-completion.ts` (directory-listing `CompletionItemProvider`); pattern-based `DocumentSelector` registration for both (no `activationEvents` change confirmed at kickoff — §9 Q2); fixtures with real linkable files/subfolders; unit + integration tests for both slices.
- **Out of scope (do not bundle — FM #18):** any schema-driven path-type detection (`SchemaField.type`) — considered and rejected (§8); modifying `core/project-yaml.ts`'s existing closed-schema diagnostics (Session 47) — untouched, unrelated feature; `resolveDocumentLink` lazy resolution — not needed, the eager pattern (`tsconfig.ts`'s own precedent) is simpler and sufficient for `_quarto.yml`'s typical small size; a settings toggle to disable either provider (matches this codebase's no-toggle convention; Posit's OWN version DOES offer per-provider toggles — a disclosed divergence, §8); directory-drill-down auto-retrigger-on-accept (§8) — a UX nicety, deferred; excluding `.gitignore`/workspace-excluded paths during directory-listing completion (§8) — deferred, a real disclosed gap.

---

## 4. Evidence-based inventory

### 4.1 Reuse table

| # | Component | Location | How this plan uses it |
|---|---|---|---|
| R1 | Pattern-based `DocumentSelector` precedent | `src/providers/yaml.ts:36-46` (`{language:"quarto"}`), VS Code's own `DocumentFilter.pattern`/`GlobPattern` (confirmed in `vscode.d.ts`) | Template for `{ pattern: "**/_quarto.{yml,yaml}" }` — same registration shape, new selector kind (§2.3). |
| R2 | `readDirectory`-based directory listing | `src/providers/image-paste.ts:126-134` (`vscode.workspace.fs.readDirectory`, single-directory, try/catch-to-empty-Set) | Closest existing precedent for Slice 2's directory listing — same API, same "degrade to nothing on failure" discipline; this plan's usage is prefix-scoped (§2.6) rather than the paste feature's whole-directory scan. |
| R3 | Provider-registration idiom | `src/providers/embedded.ts:51-76` (`registerEmbeddedLanguageFeature`, one `context.subscriptions.push(...)` with every disposable as args, module-level selector constant) | Template for `registerQuartoYamlDocumentLinksFeature`/`registerFilepathCompletionFeature` (or one combined call — §9 Q1). |
| R4 | Value-token grammar (leading-ws-skip, quote handling, trailing-comment trim) | `src/core/yaml-context.ts:401-415` (`valueSlotAfterColon`, currently unexported) | Reused pattern (export it, or mirror it) for `project-links.ts`'s `key: value` candidate extraction (§2.5) — the ONE existing implementation of this exact grammar in the codebase. |
| R5 | Path resolution relative to a document's own directory | `path.dirname`/`path.resolve` usage in `src/features/render.ts`/`clear-cache.ts` (adapter-side, non-core) | Template for resolving a candidate token against `path.dirname(document.fileName)` (§2.4) — no new resolution primitive needed, just applied to a new call site. |
| R6 | Integration test scaffolding for a real-on-disk-fixture, pattern-gated feature | `test/integration/suite/yaml-diagnostics.test.ts` (activation gate, `waitFor` polling helper, real fixture files, `afterEach` revert-and-close) | Direct template for both new integration suites — the closest existing precedent for exercising a `_quarto.yml`-scoped feature against real on-disk fixtures (an `untitled:` document has no fileName to resolve relative paths against). |

### 4.2 Gaps table

| # | Gap | Evidence | Built in layer |
|---|---|---|---|
| G1 | **No `vscode.DocumentLinkProvider` of any kind exists.** Zero hits for `DocumentLinkProvider`/`provideDocumentLinks`/`registerDocumentLinkProvider` across `src/` (grep, this session, independently re-confirmed by a second verifier). | Research + dedicated verifier | L2 |
| G2 | **No whole-document (as opposed to `project:`/`website:`/`book:`-scoped) `_quarto.yml` value scanner exists**, and no `- value` sequence-item value-span extraction exists anywhere in this codebase — `keySpanAt` explicitly bails on a `-`-prefixed line. | `project-yaml.ts` read in full, this session's research | L1 |
| G3 | **No cursor-position value-slot detector exists for bare `_quarto.yml`** — `yaml-context.ts`'s cursor-based logic is entirely `.qmd`-front-matter-shaped (fence-anchored, engine-aware), inapplicable to a bare YAML file. | `yaml-context.ts` read in full, this session's research | L1 |
| G4 | **No `CompletionItemKind.File`/`Folder` usage anywhere.** Zero hits (grep, independently re-confirmed). | Research + dedicated verifier | L3 |
| G5 | **No fixture directory with real, linkable/listable files exists for this feature.** `test/fixtures/project/_quarto.yml` (Session 45) is a minimal render fixture with no meaningfully-nested resource files to link/complete against. | `test/fixtures/project/` inventory, this session | L4 |

---

## 5. Interface contracts (interface-first; `core/` stays `vscode`-free per §3.3)

### 5.1 `src/core/project-links.ts` (new, pure)

```ts
/** One candidate VALUE token in a bare _quarto.yml document that MIGHT be a
 *  file path -- the caller (adapter) decides by checking filesystem existence.
 *  Covers both `key: value` scalars and `- value` sequence items, at any
 *  indentation depth (whole-document scope, plan §0). */
export interface PathValueCandidate {
  line: number;
  valueRange: { startCol: number; endCol: number };
  /** The token text, quotes stripped, trailing inline comment excluded. */
  token: string;
}

/** Enumerate every candidate scalar/sequence-item value in `text`. Skips
 *  blank/comment lines, pure-mapping container lines (`key:` with an empty
 *  value -- nothing to link), and boolean-literal tokens (`true`/`false` --
 *  never a path, cheap to exclude up front, §9 Q5). Does NOT check
 *  filesystem existence -- pure, `vscode`-free (plan §3.3). */
export function findPathValueCandidates(text: string): PathValueCandidate[];

/** The value-position context at (line, col) in a bare _quarto.yml document,
 *  or `null` if the cursor is not in a completable value slot (a key
 *  position, a comment, a pure-mapping container line, etc.). Mirrors
 *  `yaml-context.ts`'s `YamlCompletionContext` shape narrowly (token +
 *  replaceRange only -- no parentPath/engine, `.qmd`-specific concepts that
 *  don't apply here). */
export interface ProjectLinkValueContext {
  token: string;
  replaceRange: { line: number; startCol: number; endCol: number };
}
export function valueContextAt(text: string, line: number, col: number): ProjectLinkValueContext | null;
```

### 5.2 `src/providers/document-links.ts` (new adapter)

```ts
export function registerQuartoYamlDocumentLinksFeature(context: vscode.ExtensionContext): void;
```

`vscode.languages.registerDocumentLinkProvider({ pattern: "**/_quarto.{yml,yaml}" }, provider)`. `provideDocumentLinks(document)`: `findPathValueCandidates(document.getText())` → for each, resolve `path.resolve(path.dirname(document.fileName), candidate.token)` (skip candidates containing `*`, mirroring `tsconfig.ts`'s glob exclusion, §8) → `await vscode.workspace.fs.stat(uri)` in a `Promise.allSettled` batch (never let one bad candidate abort the rest) → for each that resolves without throwing, `new vscode.DocumentLink(range, uri)`. Eager target resolution throughout (§2's finding: `resolveDocumentLink` is unnecessary complexity for this case, matching `tsconfig.ts`'s own choice over `vscode-markdown-languageservice`'s lazier one).

### 5.3 `src/providers/filepath-completion.ts` (new adapter)

```ts
export function registerFilepathCompletionFeature(context: vscode.ExtensionContext): void;
```

`vscode.languages.registerCompletionItemProvider({ pattern: "**/_quarto.{yml,yaml}" }, provider, ":", "-", "/")`. `provideCompletionItems(document, position)`: `valueContextAt(document.getText(), position.line, position.character)` → `null` → `undefined` (no items, inverse-gating, matching `providers/yaml.ts`'s own convention). Otherwise: split `ctx.token` at the last `/` into a directory prefix + partial filename; resolve the prefix against `path.dirname(document.fileName)`; `await vscode.workspace.fs.readDirectory(dirUri)`; map each `[name, FileType]` entry to a `vscode.CompletionItem(name, type === Directory ? CompletionItemKind.Folder : CompletionItemKind.File)`, appending `/` to a folder's `insertText`/`label`; set `item.range` from `ctx.replaceRange` (the same dual-range-split discipline `providers/yaml.ts` already uses for its own value items).

### 5.4 `src/extension.ts` (+2 wires)

Two new imports + two new `registerXxxFeature(context);` calls (or one combined call if Slice 1+2 land together — §9 Q1) alongside the existing `registerXxxFeature(context)` calls.

No new command, no new keybinding. Whether a new `activationEvents` entry is needed is §9 Q2 (likely already covered by the diagnostics feature's own `onLanguage:yaml` entry, if present — confirm at kickoff, don't assume).

---

## 6. The slice(s)

> Format: **Goal → New/changed files → What DONE looks like → Verification → Dragons → Boundary.**

### Recommended: TWO vertical-slice sessions (§9 Q1)

#### Slice 1 — DocumentLink provider

- **Goal:** Cmd/Ctrl-clicking (or hovering to preview) a file-path value anywhere in an open `_quarto.yml` that resolves to a real file/directory on disk navigates to it; a value that doesn't resolve gets no link at all (never a broken/wrong link).
- **New/changed:** `src/core/project-links.ts` (`findPathValueCandidates` only — `valueContextAt` is Slice 2's), `test/unit/project-links.test.ts` (candidate-scanning tests), `src/providers/document-links.ts` (new), `src/extension.ts` (+1 wire), fixtures (§4.2 G5), `test/integration/suite/document-links.test.ts` (new).
- **DONE:** a candidate under `project: resources:` (the old, narrower scope) links; a candidate under `bibliography:` at the document root (previously out of scope under the rejected narrower framing) ALSO links — the direct proof this slice ships the whole-document scope decision (§0), not a narrower one; a `- value` sequence item links; a value that does NOT resolve to a real file gets no link; a value containing `*` gets no link (glob exclusion); re-opening the document doesn't produce stale/duplicate links (pull model, no persisted state to leak).
- **Verify:** `npm test` (unit: candidate scanning finds `key:`/`- ` values at multiple depths, skips booleans/empty-container lines, quote/comment stripping); `npm run test:integration` (real fixture with a linkable file, a linkable subdirectory entry, a non-existent-path value, a glob-looking value, a `bibliography:`-at-root value — the scope discriminator); `npm run compile`; `npm run package`. **Gate-d discriminator:** the `bibliography:`-at-root test — only passes if the scanner is genuinely whole-document, not silently narrowed back to `project:`/`website:`/`book:`; break-revert by temporarily gating the scanner to only the three closed-schema containers (mirrors `findProjectConfigKeyLines`'s own boundary) — this should turn the `bibliography:` test red while the `project: resources:` test stays green, precisely isolating what the whole-document decision is responsible for.
- **Dragons:** §2.5 (value/sequence-item span extraction — genuinely new).
- **Boundary:** one session. Do not also build Slice 2 in the same session even if this one finishes quickly (FM #2).

#### Slice 2 — Filepath completion provider

- **Goal:** typing inside a value position (after `key:` or `- `) anywhere in an open `_quarto.yml` offers real files/subdirectories from the resolved directory as completion items; typing `sub/` re-scopes suggestions to `sub/`'s own contents.
- **New/changed:** `src/core/project-links.ts` (`valueContextAt`, added alongside Slice 1's `findPathValueCandidates` in the same file — sibling pure functions, not a new file), `test/unit/project-links.test.ts` (+tests), `src/providers/filepath-completion.ts` (new), `src/extension.ts` (+1 wire), `test/integration/suite/filepath-completion.test.ts` (new).
- **DONE:** completion fires after `key: ` with real directory entries; completion fires after `- ` (sequence item) identically; typing a partial name filters to matching entries (VS Code's own built-in filtering, once items are supplied — no extra code needed); typing `sub/` lists `sub/`'s own contents, not the parent directory's; a folder entry's label/insertText carries a trailing `/`; completion does NOT fire when the cursor is in a KEY position (e.g. mid-typing `resour|:`) — the inverse-gating discriminator.
- **Verify:** `npm test` (unit: `valueContextAt` finds a value slot after `key:`/`- ` at multiple depths, returns `null` for a key position, correctly splits a partial path at the last `/`); `npm run test:integration` (real fixture directory with 2+ files/1 subdirectory, assert `vscode.executeCompletionItemProvider` returns the expected File/Folder items at each cursor position, assert the key-position discriminator returns nothing). **Gate-d discriminator:** the key-position-returns-nothing test (proves the detector's key/value distinction genuinely gates the feature, not just happens to always return something).
- **Dragons:** §2.6 (cursor-position value-slot detection — genuinely new, though smaller than §2.5 since it only inspects one line).
- **Boundary:** one session, after Slice 1 (shares `project-links.ts` — landing Slice 2 second avoids two simultaneous editors of one new file within a session; either order is technically valid, but Slice 1 first matches this plan's own presentation order and de-risks the larger unknown first).

---

## 7. Failure-mode / risk analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| D1 | **A coincidental false-positive link** — a non-path scalar (e.g. `type: book`) happens to match a real filename in the same directory. | Low | Accepted risk, matching Posit's own shipped behavior (§0/§2.1); clicking a coincidental link just opens an unrelated file, never silently asserts something false the way a wrong diagnostic would. Not mitigated further in v1 — a schema-aware suppression list is the rejected alternative (§8). |
| D2 | **Directory listing on a huge/monorepo-scale directory blocks the completion UI.** `vscode.workspace.fs.readDirectory` is not inherently bounded. | Medium | Prefix-scoped listing (§2.6) means only the ONE directory actually being typed into is ever listed, never the whole tree (matches `vscode-markdown-languageservice`'s own precedent, §0) — bounds the cost to one directory's entry count, not repo size. |
| D3 | **`stat`-ing every candidate on every `provideDocumentLinks` call could be slow for a `_quarto.yml` with many candidate values.** | Low | `_quarto.yml` files are typically small (same reasoning the diagnostics plan used for its debounce interval); `Promise.allSettled` parallelizes the stats; VS Code itself also re-requests links only on document change, not per-keystroke. Revisit only if a real large-project report surfaces a problem. |
| D4 | **A relative path with a leading `/`** — is it workspace-root-relative (`vscode-markdown-languageservice`'s convention) or filesystem-absolute? Ambiguous without a decision. | Medium | Resolve at Slice 1 kickoff (§9 Q3) — recommend treating a leading `/` as `path.resolve`'s own OS-absolute-path semantics (simplest, matches `tsconfig.ts`'s own `isAbsolute(...) ? Uri.file(...) : Uri.joinPath(...)` branch) rather than introducing a workspace-root-relative special case Quarto's own path-resolution semantics don't obviously call for. |
| D5 | **A quoted path containing YAML-escaped characters** (e.g. spaces) is mis-extracted by a naive quote-strip. | Low | Reuse `valueSlotAfterColon`'s existing quote-handling exactly (R4) rather than re-deriving it — that function already handles this class of case correctly for `.qmd` front matter; no new escaping logic needed. |

---

## 8. Alternatives considered

| Alternative | Why not |
|---|---|
| Schema-scoped to `project:`/`website:`/`book:` only, reusing `core/project-yaml.ts` unchanged | **REJECTED, operator-confirmed** (§0) — covers only 15 of 50 empirically-confirmed path-typed fields; diverges from Posit's own shipped behavior; the "reuse existing infrastructure" framing in item 14's original BACKLOG text turned out to be the plan's central wrong assumption, not a shortcut. |
| Add a `type?: "path"` marker to `SchemaField` and drive both features off the schema reader | **REJECTED** — would only re-narrow scope back to whatever the schema reader already resolves (still incomplete relative to a whole-document heuristic, since path-typed fields are scattered across many `document-*.yml`/`cell-*.yml` files the reader's `frontMatterKeys`/`cellOptions` methods aren't all wired to surface uniformly today), for no safety benefit the existence-check doesn't already provide (§2.1) — added complexity with no corresponding gain. |
| Lazy `resolveDocumentLink` (defer the `stat` check to click-time) | **REJECTED for v1** — `_quarto.yml` files are small (D3); the eager `tsconfig.ts` pattern is simpler and sufficient; `resolveDocumentLink` earns its complexity only when resolution needs expensive per-link work (`vscode-markdown-languageservice`'s heading-anchor lookups) — not applicable here. |
| Per-provider settings toggles (matching Posit's own `activateYamlLinks`/`activateYamlFilepathCompletions` independently-toggleable settings) | **Deferred, not rejected** — no existing feature in this codebase has a settings toggle (render/preview/completion/diagnostics are all always-on); disclosed as a real divergence from Posit's own UX, revisit if a user reports wanting to disable one half. |
| Excluding `.gitignore`'d / workspace-excluded paths from directory-listing completion (matching `vscode-markdown-languageservice`'s `isExcludedPath` check) | **Deferred** — a real, disclosed gap: v1's directory listing shows everything `readDirectory` returns, including `node_modules`/`.git`/build output if present in a listed directory. Cheap to add later (VS Code exposes the relevant exclude-pattern config the same way the markdown extension reads it); not blocking v1's core capability. |
| Auto-retrigger suggestions after accepting a folder entry (`editor.action.triggerSuggest` command chaining, matching the markdown extension's drill-down UX) | **Deferred** — a UX nicety; typing `/` after accepting a folder already re-triggers completion via this plan's own `/` trigger character (§5.3), just without the zero-extra-keystroke automatic chain. |

---

## 9. Open questions for the executor (resolve at implementation, not now)

1. **One session or two?** Recommend TWO (§6) — Slice 1 (links) and Slice 2 (completion) are independently useful and independently verifiable, sharing only the small `project-links.ts` core file. A single combined vertical-slice session is a valid alternative if the operator prefers that cadence at kickoff.
2. **Does `_quarto.yml`-only activation need an `activationEvents` fix** the way the diagnostics feature needed `onLanguage:yaml` (that plan's own §2.6)? Likely already covered if that entry landed with the diagnostics feature — confirm by reading `package.json`'s current `activationEvents` at Slice 1 kickoff rather than assuming either way.
3. **Leading-`/` path semantics** (D4) — OS-absolute (this plan's recommendation, matching `tsconfig.ts`) vs. workspace-root-relative (matching `vscode-markdown-languageservice`). Confirm before implementing Slice 1.
4. **Should directories themselves be linkable** (e.g. `output-dir: docs` pointing at a folder), or only files? `vscode.workspace.fs.stat` succeeds for both; VS Code's own "open" action reveals a directory Uri in the Explorer rather than opening it as a text buffer. Recommend: yes, link directories too — no reason to special-case them given `stat` already succeeds cleanly for both.
5. **Boolean/numeric exclusion in `findPathValueCandidates`** — should the scanner pre-exclude obviously-non-path tokens (`true`/`false`, bare integers) before the existence check, or let existence-checking alone be the filter (§2.1)? Recommend pre-excluding booleans (cheap, and `true`/`false` as filenames is a vanishingly unlikely legitimate collision) but NOT numbers (a numbered file like `1.qmd` in a `chapters:` list is plausible) — confirm at Slice 1 kickoff.

---

## 10. Quick reference

| File | Status | Role |
|---|---|---|
| `src/core/project-links.ts` | **New** | `findPathValueCandidates` (Slice 1, §5.1), `valueContextAt` (Slice 2, §5.1) |
| `src/providers/document-links.ts` | **New** | `registerQuartoYamlDocumentLinksFeature` (§5.2) |
| `src/providers/filepath-completion.ts` | **New** | `registerFilepathCompletionFeature` (§5.3) |
| `src/extension.ts` | +2 wires | One call per slice (§5.4) |
| `test/unit/project-links.test.ts` | **New** | Both slices' pure-core coverage |
| `test/fixtures/document-links/...` | **New** | Real linkable files/subdirectory for both integration suites (§4.2 G5) |
| `test/integration/suite/document-links.test.ts` | **New** | Slice 1 end-to-end |
| `test/integration/suite/filepath-completion.test.ts` | **New** | Slice 2 end-to-end via `vscode.executeCompletionItemProvider` |

**Unchanged:** `src/core/project-yaml.ts`, `src/core/project.ts` (`findProjectRoot` — confirmed not needed, §2.4), `src/core/yaml-schema.ts` (no `SchemaField.type` addition — rejected, §8), `src/features/yaml-diagnostics.ts`, `src/providers/yaml.ts`, every render/preview/embedded feature.

---

*End of `_quarto.yml` Document Links + Filepath Autocompletion plan. Implementation is a separate session (or two — §9 Q1). The headline finding (§0) reverses item 14's own BACKLOG framing — grounded by an empirical schema census (adversarially re-verified) and Posit's own public PR facts, not assumed from the BACKLOG's shorthand description.*
